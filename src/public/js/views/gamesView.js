// Mini games: four classics, playable in a minute, scored against your own best.
import { fetchGames, submitGameScore } from '../services/api.js';
import { showToast } from '../components/toast.js';
import { renderSkeleton } from '../components/spinner.js';
import { escapeHtml } from '../utils/dom.js';
import { renderScreen } from '../components/screen.js';
import { attachToolbar } from '../components/toolbar.js';

export function renderGamesView(state) {
  if (!state.currentUser) {
    return `<div class="empty"><p class="empty__text">Sign in to play.</p></div>`;
  }
  return renderScreen({
    title: 'Mini games',
    subtitle: 'Beating your own best earns XP.',
    toolbar: {
      groups: [
        { collapsible: true, actions: [{ id: 'refresh', label: 'Refresh scores', icon: 'refresh', iconOnly: true }] }
      ]
    },
    body: `<div id="gamesRoot" class="stack">${renderSkeleton('card', { className: '' })}</div>`
  });
}

export function attachGamesEvents(state) {
  if (!state.currentUser) return;
  const root = document.getElementById('gamesRoot');

  async function load() {
    try {
      const { games } = await fetchGames();
      root.innerHTML = `<div class="games">${games.map(cardHtml).join('')}</div>`;
      games.forEach(bindCard);
    } catch (_) {
      root.innerHTML = `<div class="empty"><p class="empty__text">Games could not be loaded.</p></div>`;
    }
  }

  function cardHtml(game) {
    return `
      <section class="game" data-game="${game.id}">
        <header class="game__head">
          <div>
            <h2 class="game__title">${escapeHtml(game.label)}</h2>
            <p class="game__blurb">${escapeHtml(game.blurb)}</p>
          </div>
          <span class="game__best" data-best>
            <span class="game__best-label">Your best</span>
            <strong>${bestHtml(game.best, game.unit)}</strong>
          </span>
        </header>
        <div class="game__stage" data-stage>
          <button class="btn btn--primary" data-start>Play</button>
        </div>
        ${
          game.top.length
            ? `<ol class="game__top" data-top>${game.top.map((t, i) => topRow(t, i, game.unit)).join('')}</ol>`
            : '<p class="game__empty" data-top>No scores yet. Set the first one.</p>'
        }
      </section>`;
  }

  function topRow(entry, index, unit) {
    return `
      <li class="game__top-row">
        <span class="game__top-rank">${index + 1}</span>
        <span class="game__top-name">${escapeHtml(entry.name)}</span>
        <span class="game__top-score">${entry.score}<small>${escapeHtml(unitFor(entry.score, unit))}</small></span>
      </li>`;
  }

  function bindCard(game) {
    const card = root.querySelector(`[data-game="${game.id}"]`);
    const stage = card.querySelector('[data-stage]');

    const finish = async (score, detail) => {
      // Null when the submit fails: the run still happened and the player
      // should still see what they scored, just without the standing.
      let result = null;
      try {
        result = await submitGameScore(game.id, score, detail);
        card.querySelector('[data-best] strong').innerHTML = bestHtml(result.best, game.unit);
        if (result.top.length) {
          card.querySelector('[data-top]').outerHTML =
            `<ol class="game__top" data-top>${result.top.map((t, i) => topRow(t, i, game.unit)).join('')}</ol>`;
        }
        if (result.improved) {
          showToast({
            title: 'New personal best',
            message: `+${result.xpAwarded} XP · previous best ${result.previousBest}`,
            type: 'success'
          });
        }
      } catch (_) {
        /* requestApi surfaces the reason */
      }
      stage.innerHTML = resultHtml(score, result, game.unit);
      stage.querySelector('[data-start]').addEventListener('click', () => play(game, stage, finish));
    };

    stage.querySelector('[data-start]').addEventListener('click', () => play(game, stage, finish));
  }

  /** Every unit the server sends is plural ("apples", "pairs"), which reads
   *  wrong on a score of exactly one. */
  function unitFor(score, unit) {
    return score === 1 ? String(unit).replace(/s$/, '') : unit;
  }

  /** Zero is a real score in some games but never a real *best* — a player who
   *  has not played has no best, and "0" reads like they tried and failed. */
  function bestHtml(best, unit) {
    if (!best) return '<span class="game__best-none">—</span>';
    return `${best}<small>${escapeHtml(unitFor(best, unit))}</small>`;
  }

  /** The run's own scoreboard. A toast slides away before you have read it,
   *  and "how did that compare" is the question you have right then. */
  function resultHtml(score, result, unit) {
    const best = result ? result.best : null;
    let verdict = '';
    if (result?.improved) {
      verdict = `<span class="game__verdict is-best">New best · +${result.xpAwarded} XP</span>`;
    } else if (best) {
      const gap = best - score;
      verdict = gap > 0
        ? `<span class="game__verdict">${gap} ${escapeHtml(unitFor(gap, unit))} off your best of ${best}</span>`
        : `<span class="game__verdict">Matched your best</span>`;
    }
    return `
      <div class="game__result">
        <p class="game__result-score">${score}<small>${escapeHtml(unitFor(score, unit))}</small></p>
        ${verdict}
        <button class="btn btn--primary" data-start>Play again</button>
      </div>`;
  }

  // The view re-attaches whenever app state changes, so a stage can end up
  // hosting more than one run. Each run carries a token and stops as soon as a
  // newer one starts.
  function play(game, stage, finish) {
    const token = (Number(stage.dataset.run || 0) + 1).toString();
    stage.dataset.run = token;
    const live = () => stage.dataset.run === token;

    const runners = { snake: playSnake, memory: playMemory, pop: playPop, sequence: playSequence };
    // Every one of these starts a clock or a moving snake the instant it is
    // called. Without a beat to get your hands ready, the first second of a
    // timed run is always wasted.
    countIn(stage, live, () => runners[game.id](stage, finish, live));
  }

  attachToolbar(document.querySelector('.screen__header'), { refresh: load });

  load();
}

/* --------------------------------------------------------------- run helpers */

/**
 * A three-beat lead-in before any run starts. Ends early on any key or click,
 * because a player who is already ready should not have to wait for a ritual.
 */
function countIn(stage, live, start) {
  stage.innerHTML = `
    <div class="countin" data-countin>
      <p class="countin__num" data-num>3</p>
      <p class="countin__hint">Get ready — press any key to start now</p>
    </div>`;
  const numEl = stage.querySelector('[data-num]');
  let n = 3;
  let timer = null;

  const detach = () => {
    document.removeEventListener('keydown', go);
    stage.removeEventListener('click', go);
  };

  function go() {
    if (timer === null) return; // already fired
    clearInterval(timer);
    timer = null;
    detach();
    if (live()) start();
  }

  timer = setInterval(() => {
    if (!live()) {
      clearInterval(timer);
      timer = null;
      detach();
      return;
    }
    n -= 1;
    if (n <= 0) return go();
    numEl.textContent = String(n);
  }, 600);

  // Attached a tick late: this runs from the Play button's own click handler,
  // and that click is still bubbling — binding now would let it dismiss the
  // count-in it just started.
  setTimeout(() => {
    if (timer === null) return;
    document.addEventListener('keydown', go);
    stage.addEventListener('click', go);
  }, 0);
}

/**
 * Pauses a run while the tab is hidden. Switching away should not cost you the
 * game — the snake kept moving and the thirty-second clock kept running, so
 * you came back to a corpse through no fault of play.
 *
 * @param {() => void} pause   stop timers
 * @param {() => void} resume  restart them
 * @param {() => boolean} live
 * @returns {() => void} detach, to be called from the game's own cleanup
 */
function pauseWhenHidden(pause, resume, live) {
  let paused = false;
  const onVisibility = () => {
    if (!live()) return detach();
    if (document.hidden && !paused) {
      paused = true;
      pause();
    } else if (!document.hidden && paused) {
      paused = false;
      resume();
    }
  };
  const detach = () => document.removeEventListener('visibilitychange', onVisibility);
  document.addEventListener('visibilitychange', onVisibility);
  return detach;
}

/* ------------------------------------------------------------------- Snake */

function playSnake(stage, finish, live) {
  const SIZE = 15;
  const START_SPEED = 190;

  let snake = [{ x: 7, y: 7 }];
  let dir = { x: 1, y: 0 };
  let queued = null;
  let apple = { x: 11, y: 7 };
  let score = 0;
  let timer = null;
  let over = false;

  stage.innerHTML = `
    <div class="snake">
      <div class="game__bar">
        <span data-score>0 apples</span>
        <span class="game__hint">Arrow keys, WASD, or swipe</span>
      </div>
      <div class="snake__board" data-board></div>
      <div class="pad">
        <button class="pad__btn pad__up" data-dir="up" aria-label="Up">↑</button>
        <button class="pad__btn pad__left" data-dir="left" aria-label="Left">←</button>
        <button class="pad__btn pad__right" data-dir="right" aria-label="Right">→</button>
        <button class="pad__btn pad__down" data-dir="down" aria-label="Down">↓</button>
      </div>
    </div>`;

  const board = stage.querySelector('[data-board]');
  const scoreEl = stage.querySelector('[data-score]');
  board.style.setProperty('--cells', SIZE);
  board.innerHTML = Array.from({ length: SIZE * SIZE }, () => '<i></i>').join('');
  const cells = [...board.querySelectorAll('i')];

  const DIRS = {
    up: { x: 0, y: -1 }, down: { x: 0, y: 1 },
    left: { x: -1, y: 0 }, right: { x: 1, y: 0 }
  };

  function turn(name) {
    const next = DIRS[name];
    if (!next) return;
    // Ignore a straight reversal — it would run the head into the neck.
    const current = queued || dir;
    if (next.x === -current.x && next.y === -current.y) return;
    queued = next;
  }

  const onKey = (e) => {
    const map = {
      ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
      w: 'up', s: 'down', a: 'left', d: 'right'
    };
    const name = map[e.key] || map[String(e.key).toLowerCase()];
    if (!name) return;
    e.preventDefault();
    turn(name);
  };
  document.addEventListener('keydown', onKey);

  stage.querySelectorAll('[data-dir]').forEach((btn) =>
    btn.addEventListener('click', () => turn(btn.dataset.dir))
  );

  // Swipe, so it is playable on a phone without reaching for the pad.
  let touchStart = null;
  board.addEventListener('touchstart', (e) => {
    touchStart = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  }, { passive: true });
  board.addEventListener('touchend', (e) => {
    if (!touchStart) return;
    const dx = e.changedTouches[0].clientX - touchStart.x;
    const dy = e.changedTouches[0].clientY - touchStart.y;
    touchStart = null;
    if (Math.abs(dx) < 24 && Math.abs(dy) < 24) return;
    turn(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up'));
  }, { passive: true });

  function placeApple() {
    const free = [];
    for (let y = 0; y < SIZE; y += 1) {
      for (let x = 0; x < SIZE; x += 1) {
        if (!snake.some((s) => s.x === x && s.y === y)) free.push({ x, y });
      }
    }
    apple = free[Math.floor(Math.random() * free.length)] || apple;
  }

  function draw() {
    cells.forEach((c) => (c.className = ''));
    snake.forEach((s, i) => {
      const cell = cells[s.y * SIZE + s.x];
      if (cell) cell.className = i === 0 ? 'is-head' : 'is-body';
    });
    const appleCell = cells[apple.y * SIZE + apple.x];
    if (appleCell) appleCell.className = 'is-apple';
  }

  function speed() {
    return Math.max(80, START_SPEED - score * 6);
  }

  function cleanup() {
    clearInterval(timer);
    timer = null;
    document.removeEventListener('keydown', onKey);
    detachPause();
  }

  const detachPause = pauseWhenHidden(
    () => { clearInterval(timer); timer = null; },
    () => { if (!over && timer === null) timer = setInterval(tick, speed()); },
    live
  );

  function stop() {
    if (over) return;
    over = true;
    cleanup();
    if (!live()) return;
    board.classList.add('is-over');
    setTimeout(() => live() && finish(score, `${score} apples`), 700);
  }

  function tick() {
    if (!live()) return cleanup();
    if (queued) { dir = queued; queued = null; }

    const head = { x: snake[0].x + dir.x, y: snake[0].y + dir.y };
    const hitWall = head.x < 0 || head.y < 0 || head.x >= SIZE || head.y >= SIZE;
    // The tail tip vacates this tick, so touching it is not a collision.
    const body = snake.slice(0, -1);
    if (hitWall || body.some((s) => s.x === head.x && s.y === head.y)) return stop();

    snake.unshift(head);
    if (head.x === apple.x && head.y === apple.y) {
      score += 1;
      scoreEl.textContent = `${score} ${score === 1 ? 'apple' : 'apples'}`;
      placeApple();
      // Speed up gently, with a floor so it stays playable.
      clearInterval(timer);
      timer = setInterval(tick, speed());
    } else {
      snake.pop();
    }
    draw();
  }

  draw();
  timer = setInterval(tick, START_SPEED);
}

/* ------------------------------------------------------------ Memory Match */

function playMemory(stage, finish, live) {
  const FACES = ['🍎', '🌟', '🎈', '🐙', '🍄', '🚀', '🎧', '🧊', '🌵', '🍩'];
  const PAIRS = 6;
  const SECONDS = 60;

  let matched = 0;
  let remaining = SECONDS;
  let busy = false;
  let first = null;
  let ticker;

  stage.innerHTML = `
    <div class="memory">
      <div class="game__bar">
        <span data-score>0 pairs</span>
        <span class="game__clock" data-clock>${SECONDS}s</span>
      </div>
      <div class="memory__grid" data-grid></div>
    </div>`;

  const grid = stage.querySelector('[data-grid]');
  const scoreEl = stage.querySelector('[data-score]');

  function deal() {
    const faces = [...FACES].sort(() => Math.random() - 0.5).slice(0, PAIRS);
    const deck = [...faces, ...faces].sort(() => Math.random() - 0.5);
    grid.innerHTML = deck
      .map(
        (face) => `
        <button class="card" data-face="${face}" aria-label="Hidden card">
          <span class="card__face">${face}</span>
        </button>`
      )
      .join('');
    grid.querySelectorAll('[data-face]').forEach((card) =>
      card.addEventListener('click', () => flip(card))
    );
    first = null;
    busy = false;
  }

  function flip(card) {
    if (busy || card.classList.contains('is-up') || card.classList.contains('is-done')) return;
    card.classList.add('is-up');

    if (!first) { first = card; return; }

    if (first.dataset.face === card.dataset.face) {
      first.classList.add('is-done');
      card.classList.add('is-done');
      matched += 1;
      scoreEl.textContent = `${matched} ${matched === 1 ? 'pair' : 'pairs'}`;
      first = null;
      // Board cleared: deal a fresh one so the clock is the only limit.
      if (grid.querySelectorAll('.is-done').length === PAIRS * 2) {
        setTimeout(() => live() && deal(), 450);
      }
      return;
    }

    busy = true;
    const previous = first;
    first = null;
    setTimeout(() => {
      previous.classList.remove('is-up');
      card.classList.remove('is-up');
      busy = false;
    }, 700);
  }

  const countdown = () => {
    if (!live()) return clearInterval(ticker);
    remaining -= 1;
    stage.querySelector('[data-clock]').textContent = `${remaining}s`;
    if (remaining <= 0) {
      clearInterval(ticker);
      ticker = null;
      detachPause();
      setTimeout(() => live() && finish(matched, `${matched} pairs in ${SECONDS}s`), 400);
    }
  };

  const detachPause = pauseWhenHidden(
    () => { clearInterval(ticker); ticker = null; },
    () => { if (remaining > 0 && ticker === null) ticker = setInterval(countdown, 1000); },
    live
  );

  ticker = setInterval(countdown, 1000);

  deal();
}

/* -------------------------------------------------------------- Bubble Pop */

function playPop(stage, finish, live) {
  const SECONDS = 30;
  const COLOURS = [
    'var(--accent)',
    'var(--accent-2, var(--accent))',
    'var(--accent-3, var(--accent))',
    'var(--success)'
  ];

  let score = 0;
  let remaining = SECONDS;
  let ticker;
  let spawner;

  stage.innerHTML = `
    <div class="pop">
      <div class="game__bar">
        <span data-score>0 pops</span>
        <span class="game__clock" data-clock>${SECONDS}s</span>
      </div>
      <div class="pop__field" data-field></div>
    </div>`;

  const field = stage.querySelector('[data-field]');
  const scoreEl = stage.querySelector('[data-score]');

  function spawn() {
    if (!live()) return;
    const bubble = document.createElement('button');
    const size = 34 + Math.random() * 34;
    bubble.className = 'bubble';
    bubble.setAttribute('aria-label', 'Pop the bubble');
    bubble.style.width = `${size}px`;
    bubble.style.height = `${size}px`;
    bubble.style.left = `${Math.random() * Math.max(0, field.clientWidth - size)}px`;
    bubble.style.top = `${Math.random() * Math.max(0, field.clientHeight - size)}px`;
    bubble.style.background = COLOURS[Math.floor(Math.random() * COLOURS.length)];

    let popped = false;
    bubble.addEventListener('click', () => {
      if (popped) return;
      popped = true;
      score += 1;
      scoreEl.textContent = `${score} ${score === 1 ? 'pop' : 'pops'}`;
      bubble.classList.add('is-popped');
      setTimeout(() => bubble.remove(), 180);
    });

    field.appendChild(bubble);
    // Bubbles drift away on their own, so hesitating costs you.
    setTimeout(() => { if (!popped) bubble.remove(); }, 1400);
  }

  function cleanup() {
    clearInterval(ticker);
    clearInterval(spawner);
    ticker = null;
    spawner = null;
    detachPause();
  }

  const countdown = () => {
    if (!live()) return cleanup();
    remaining -= 1;
    stage.querySelector('[data-clock]').textContent = `${remaining}s`;
    if (remaining <= 0) {
      cleanup();
      field.innerHTML = '';
      setTimeout(() => live() && finish(score, `${score} in ${SECONDS}s`), 400);
    }
  };

  // Hidden tab: freeze the clock and stop spawning. Bubbles already on the
  // field expire on their own timers, which is fine — they were about to
  // anyway, and the score cannot move while nobody is looking.
  const detachPause = pauseWhenHidden(
    () => { clearInterval(ticker); clearInterval(spawner); ticker = null; spawner = null; },
    () => {
      if (remaining <= 0 || ticker !== null) return;
      ticker = setInterval(countdown, 1000);
      spawner = setInterval(spawn, 520);
    },
    live
  );

  spawner = setInterval(spawn, 520);
  spawn();
  ticker = setInterval(countdown, 1000);
}

/* --------------------------------------------------------- Colour Sequence */

function playSequence(stage, finish, live) {
  const PADS = 4;
  const pattern = [];
  let round = 0;

  stage.innerHTML = `
    <div class="seq">
      <p class="seq__status" data-status>Watch closely…</p>
      <div class="seq__grid">
        ${Array.from({ length: PADS }, (_, i) => `<button class="seq__pad" data-pad="${i}" disabled></button>`).join('')}
      </div>
    </div>`;

  const status = stage.querySelector('[data-status]');
  const pads = [...stage.querySelectorAll('[data-pad]')];

  const flash = (index) =>
    new Promise((resolve) => {
      pads[index].classList.add('is-lit');
      setTimeout(() => {
        pads[index].classList.remove('is-lit');
        setTimeout(resolve, 140);
      }, 320);
    });

  async function showPattern() {
    if (!live()) return;
    pads.forEach((p) => (p.disabled = true));
    status.textContent = `Round ${round} — watch`;
    await new Promise((r) => setTimeout(r, 550));
    for (const step of pattern) {
      if (!live()) return;
      await flash(step);
    }
    if (!live()) return;
    status.textContent = `Round ${round} — your turn`;
    pads.forEach((p) => (p.disabled = false));
  }

  function nextRound() {
    if (!live()) return;
    round += 1;
    pattern.push(Math.floor(Math.random() * PADS));
    let position = 0;

    const onPad = (event) => {
      const index = Number(event.currentTarget.dataset.pad);
      event.currentTarget.classList.add('is-lit');
      setTimeout(() => event.currentTarget.classList.remove('is-lit'), 180);

      const release = () =>
        pads.forEach((p) => {
          p.disabled = true;
          p.removeEventListener('click', onPad);
        });

      if (index !== pattern[position]) {
        release();
        status.textContent = `Wrong pad — you reached round ${round}`;
        setTimeout(() => live() && finish(round - 1, `reached round ${round}`), 800);
        return;
      }

      position += 1;
      if (position === pattern.length) {
        release();
        setTimeout(nextRound, 500);
      }
    };

    pads.forEach((p) => p.addEventListener('click', onPad));
    showPattern();
  }

  nextRound();
}
