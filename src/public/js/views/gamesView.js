// Mini games. Short, replayable, and scored against your own previous best.
import { fetchGames, submitGameScore } from '../services/api.js';
import { showToast } from '../components/toast.js';
import { renderSkeleton } from '../components/spinner.js';
import { escapeHtml } from '../utils/dom.js';

const SNIPPETS = [
  'const total = items.reduce((sum, item) => sum + item.price, 0);',
  'export function clamp(n, min, max) { return Math.min(max, Math.max(min, n)); }',
  'db.prepare("SELECT * FROM users WHERE id = ?").get(userId);',
  'element.addEventListener("click", () => setOpen((open) => !open));',
  'const [first, ...rest] = await Promise.all(pending);'
];

export function renderGamesView(state) {
  if (!state.currentUser) {
    return `<div class="empty"><p class="empty__text">Sign in to play.</p></div>`;
  }
  return `
    <div class="page__inner">
      <header class="page__head">
        <div>
          <h1 class="title">Mini games</h1>
          <p class="subtitle">Short rounds that sharpen the things you use daily. Beat your own best to earn XP.</p>
        </div>
      </header>
      <div id="gamesRoot">${renderSkeleton('card', { className: '' })}</div>
    </div>`;
}

export function attachGamesEvents(state) {
  if (!state.currentUser) return;
  const root = document.getElementById('gamesRoot');

  async function load() {
    try {
      const { games } = await fetchGames();
      root.innerHTML = `<div class="games">${games.map(cardHtml).join('')}</div>`;
      games.forEach((g) => bindCard(g));
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
            <strong>${game.best}<small>${escapeHtml(game.unit)}</small></strong>
          </span>
        </header>

        <div class="game__stage" data-stage>
          <button class="btn btn--primary" data-start>Play</button>
        </div>

        ${
          game.top.length
            ? `<ol class="game__top" data-top>
                ${game.top.map((t, i) => topRow(t, i, game.unit)).join('')}
              </ol>`
            : '<p class="game__empty" data-top>No scores yet. Set the first one.</p>'
        }
      </section>`;
  }

  function topRow(entry, index, unit) {
    return `
      <li class="game__top-row">
        <span class="game__top-rank">${index + 1}</span>
        <span class="game__top-name">${escapeHtml(entry.name)}</span>
        <span class="game__top-score">${entry.score}<small>${escapeHtml(unit)}</small></span>
      </li>`;
  }

  function bindCard(game) {
    const card = root.querySelector(`[data-game="${game.id}"]`);
    const stage = card.querySelector('[data-stage]');

    const finish = async (score, detail) => {
      try {
        const res = await submitGameScore(game.id, score, detail);
        card.querySelector('[data-best] strong').innerHTML =
          `${res.best}<small>${escapeHtml(game.unit)}</small>`;
        const top = card.querySelector('[data-top]');
        if (res.top.length) {
          top.outerHTML = `<ol class="game__top" data-top>${res.top
            .map((t, i) => topRow(t, i, game.unit))
            .join('')}</ol>`;
        }
        showToast({
          title: res.improved ? 'New personal best' : `Scored ${score}`,
          message: res.improved
            ? `+${res.xpAwarded} XP · previous best ${res.previousBest}`
            : `Your best is still ${res.best}.`,
          type: res.improved ? 'success' : 'info'
        });
      } catch (_) {
        /* requestApi surfaces the reason */
      }
      stage.innerHTML = `<button class="btn btn--primary" data-start>Play again</button>`;
      stage.querySelector('[data-start]').addEventListener('click', () => play(game, stage, finish));
    };

    stage.querySelector('[data-start]').addEventListener('click', () => play(game, stage, finish));
  }

  // The view re-attaches whenever app state changes, so a stage can end up
  // hosting more than one run. Each run carries a token and stops as soon as a
  // newer one starts — without this, two Sequence instances drove the same
  // pads and the round counter advanced with no input at all.
  function play(game, stage, finish) {
    const token = (Number(stage.dataset.run || 0) + 1).toString();
    stage.dataset.run = token;
    const live = () => stage.dataset.run === token;

    if (game.id === 'hex') return playHex(stage, finish, live);
    if (game.id === 'sprint') return playSprint(stage, finish, live);
    return playSequence(stage, finish, live);
  }

  load();
}

/* ------------------------------------------------------------------ Hex Hunt
   A colour is shown; pick its hex from four options. Thirty seconds, one
   point per correct answer, and a wrong answer costs you the round. */

function playHex(stage, finish, live = () => true) {
  let score = 0;
  let remaining = 30;
  let ticker;

  const randomHex = () =>
    '#' + Array.from({ length: 3 }, () =>
      Math.floor(Math.random() * 256).toString(16).padStart(2, '0')).join('');

  function round() {
    const answer = randomHex();
    // Decoys are perturbations of the answer, so the game tests reading a
    // colour rather than spotting the one option that is obviously different.
    const options = [answer];
    while (options.length < 4) {
      const shifted = answer.replace(/[0-9a-f]{2}/g, (pair) => {
        const v = parseInt(pair, 16) + Math.round((Math.random() - 0.5) * 90);
        return Math.max(0, Math.min(255, v)).toString(16).padStart(2, '0');
      });
      if (!options.includes(shifted)) options.push(shifted);
    }
    options.sort(() => Math.random() - 0.5);

    stage.innerHTML = `
      <div class="hex">
        <div class="hex__bar">
          <span class="hex__score">${score} correct</span>
          <span class="hex__clock" data-clock>${remaining}s</span>
        </div>
        <div class="hex__swatch" style="background:${answer}"></div>
        <div class="hex__options">
          ${options
            .map((o) => `<button class="btn hex__option" data-hex="${o}">${o}</button>`)
            .join('')}
        </div>
      </div>`;

    stage.querySelectorAll('[data-hex]').forEach((btn) => {
      btn.addEventListener('click', () => {
        if (btn.dataset.hex === answer) {
          score += 1;
          round();
        } else {
          btn.classList.add('is-wrong');
          stage.querySelector(`[data-hex="${answer}"]`)?.classList.add('is-right');
          stop();
        }
      });
    });
  }

  function stop() {
    clearInterval(ticker);
    if (!live()) return;
    setTimeout(() => live() && finish(score, `${score} correct`), 700);
  }

  ticker = setInterval(() => {
    if (!live()) { clearInterval(ticker); return; }
    remaining -= 1;
    const clock = stage.querySelector('[data-clock]');
    if (clock) clock.textContent = `${remaining}s`;
    if (remaining <= 0) stop();
  }, 1000);

  round();
}

/* --------------------------------------------------------------- Type Sprint
   Retype a snippet. Score is words per minute scaled by accuracy, so racing
   ahead with mistakes scores worse than typing it properly. */

function playSprint(stage, finish, live = () => true) {
  const snippet = SNIPPETS[Math.floor(Math.random() * SNIPPETS.length)];
  let started = null;

  stage.innerHTML = `
    <div class="sprint">
      <p class="sprint__target" data-target>${renderTarget(snippet, '')}</p>
      <textarea class="sprint__input" data-input rows="3"
        placeholder="Start typing to begin the clock…" spellcheck="false"></textarea>
      <div class="sprint__meta"><span data-stats>0 wpm · 100% accurate</span></div>
    </div>`;

  const input = stage.querySelector('[data-input]');
  const target = stage.querySelector('[data-target]');
  const stats = stage.querySelector('[data-stats]');
  input.focus();

  input.addEventListener('input', () => {
    if (!started) started = Date.now();
    const typed = input.value;
    target.innerHTML = renderTarget(snippet, typed);

    const correct = [...typed].filter((ch, i) => ch === snippet[i]).length;
    const accuracy = typed.length ? correct / typed.length : 1;
    const minutes = (Date.now() - started) / 60000;
    const wpm = minutes > 0 ? correct / 5 / minutes : 0;
    stats.textContent = `${Math.round(wpm)} wpm · ${Math.round(accuracy * 100)}% accurate`;

    if (typed.length >= snippet.length) {
      input.disabled = true;
      // Accuracy is squared so a sloppy fast run cannot beat a clean one.
      const score = Math.max(0, Math.min(200, Math.round(wpm * accuracy * accuracy)));
      setTimeout(() => live() && finish(score, `${Math.round(accuracy * 100)}% accurate`), 500);
    }
  });
}

function renderTarget(snippet, typed) {
  return [...snippet]
    .map((ch, i) => {
      const state =
        i >= typed.length ? '' : typed[i] === ch ? 'is-ok' : 'is-bad';
      const safe = ch === ' ' ? '&nbsp;' : escapeHtml(ch);
      return `<span class="${state}">${safe}</span>`;
    })
    .join('');
}

/* ------------------------------------------------------------------ Sequence
   Simon: watch the pattern, play it back, one longer each round. */

function playSequence(stage, finish, live = () => true) {
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

    const onPad = async (event) => {
      const index = Number(event.currentTarget.dataset.pad);
      event.currentTarget.classList.add('is-lit');
      setTimeout(() => event.currentTarget.classList.remove('is-lit'), 180);

      if (index !== pattern[position]) {
        pads.forEach((p) => {
          p.disabled = true;
          p.removeEventListener('click', onPad);
        });
        status.textContent = `Wrong pad — you reached round ${round}`;
        // Score is rounds *completed*, so failing round 1 scores zero.
        setTimeout(() => live() && finish(round - 1, `reached round ${round}`), 800);
        return;
      }

      position += 1;
      if (position === pattern.length) {
        pads.forEach((p) => {
          p.disabled = true;
          p.removeEventListener('click', onPad);
        });
        setTimeout(nextRound, 500);
      }
    };

    pads.forEach((p) => p.addEventListener('click', onPad));
    showPattern();
  }

  nextRound();
}
