// Duels: one challenger, one opponent. The challenger sets the stake and the
// person challenged chooses the topic.
import { fetchDuels, createDuel, respondToDuel, resolveDuel, fetchAllUsers } from '../services/api.js';
import { showToast } from '../components/toast.js';
import { openModal } from '../components/modal.js';
import { renderSkeleton } from '../components/spinner.js';
import { escapeHtml, timeAgo } from '../utils/dom.js';

const STATUS_LABEL = {
  PENDING: 'Waiting',
  ACTIVE: 'On',
  RESOLVED: 'Settled',
  DECLINED: 'Declined',
  CANCELLED: 'Cancelled'
};

export function renderDuelsView(state) {
  if (!state.currentUser) {
    return `<div class="empty"><p class="empty__text">Sign in to challenge anyone.</p></div>`;
  }
  return `
    <div class="page__inner">
      <header class="page__head">
        <div>
          <h1 class="title">Duels</h1>
          <p class="subtitle">
            Challenge someone head to head. You set the stake, they choose the topic.
          </p>
        </div>
        <button class="btn btn--primary" id="btnNewDuel">Challenge someone</button>
      </header>
      <div id="duelsRoot">${renderSkeleton('card', { className: '' })}</div>
    </div>`;
}

export function attachDuelsEvents(state) {
  if (!state.currentUser) return;
  const root = document.getElementById('duelsRoot');
  let topics = [];

  async function load() {
    try {
      const data = await fetchDuels();
      topics = data.topics || [];
      paint(data);
    } catch (_) {
      root.innerHTML = `<div class="empty"><p class="empty__text">Duels could not be loaded.</p></div>`;
    }
  }

  function paint(data) {
    root.innerHTML = `
      <div class="wallet">
        <div class="wallet__row">
          <span class="wallet__label">Available to stake</span>
          <strong class="wallet__value">${data.wallet.points.toLocaleString()}<small> pts</small>
            · ${data.wallet.xp.toLocaleString()}<small> xp</small></strong>
        </div>
      </div>
      ${
        data.duels.length
          ? `<div class="duels">${data.duels.map(duelHtml).join('')}</div>`
          : `<div class="empty">
              <p class="empty__title">No duels yet</p>
              <p class="empty__text">Pick someone, put something on it, and let them choose the ground.</p>
            </div>`
      }`;
    bind();
  }

  function duelHtml(duel) {
    const challenger = duel.participants.find((p) => p.side === 'CHALLENGER');
    const opponent = duel.participants.find((p) => p.side === 'OPPONENT');
    const mine = duel.viewer;

    return `
      <article class="duel is-${duel.status.toLowerCase()}" data-duel="${duel.id}">
        <header class="duel__head">
          <span class="chip ${duel.status === 'ACTIVE' ? 'chip--accent' : ''}">${STATUS_LABEL[duel.status]}</span>
          <span class="duel__pot">
            Pot ${duel.pot.points.toLocaleString()} pts · ${duel.pot.xp.toLocaleString()} xp
          </span>
          <span class="duel__age">${timeAgo(duel.createdAt)}</span>
        </header>

        <p class="duel__line">
          <strong>${escapeHtml(challenger?.name || 'Someone')}</strong>
          <span class="duel__vs">vs</span>
          <strong>${escapeHtml(opponent?.name || 'someone')}</strong>
        </p>

        <p class="duel__topic">
          ${
            duel.topic
              ? `Topic: <strong>${escapeHtml(duel.topic)}</strong>`
              : `Waiting on ${escapeHtml(opponent?.name || 'them')} to choose the topic.`
          }
        </p>

        ${
          duel.status === 'RESOLVED'
            ? `<p class="duel__result">
                Won by <strong>${escapeHtml(duel.participants.find((p) => p.isWinner)?.name || 'nobody')}</strong>
              </p>`
            : ''
        }

        <div class="duel__actions">
          ${
            duel.status === 'PENDING' && mine?.side === 'OPPONENT'
              ? `<button class="btn btn--primary btn--sm" data-accept="${duel.id}">
                   Accept and choose the topic
                 </button>
                 <button class="btn btn--sm" data-decline="${duel.id}">Decline</button>`
              : ''
          }
          ${
            duel.status === 'PENDING' && mine?.side === 'CHALLENGER'
              ? `<button class="btn btn--sm" data-cancel="${duel.id}">Cancel</button>`
              : ''
          }
          ${
            duel.canJudge
              ? `<button class="btn btn--primary btn--sm" data-resolve="${duel.id}">Call the winner</button>`
              : ''
          }
        </div>
      </article>`;
  }

  function bind() {
    root.querySelectorAll('[data-accept]').forEach((btn) =>
      btn.addEventListener('click', () => pickTopic(btn.dataset.accept))
    );
    root.querySelectorAll('[data-decline]').forEach((btn) =>
      btn.addEventListener('click', () => respond(btn.dataset.decline, 'decline'))
    );
    root.querySelectorAll('[data-cancel]').forEach((btn) =>
      btn.addEventListener('click', () => respond(btn.dataset.cancel, 'cancel'))
    );
    root.querySelectorAll('[data-resolve]').forEach((btn) =>
      btn.addEventListener('click', () => callWinner(btn.dataset.resolve))
    );
  }

  function pickTopic(duelId) {
    openModal({
      title: 'Pick the topic',
      confirmLabel: 'Accept',
      contentHtml: `
        <div class="col">
          <p class="text-muted" style="font-size:.875rem">
            You were challenged, so the topic is yours to pick. Accepting starts
            the duel and holds your stake.
          </p>
          <div class="field">
            <label class="field__label" for="duelTopic">Topic</label>
            <select class="select" id="duelTopic">
              ${topics.map((t) => `<option value="${escapeHtml(t)}">${escapeHtml(t)}</option>`).join('')}
              <option value="__custom">Something else…</option>
            </select>
          </div>
          <div class="field" id="customWrap" hidden>
            <label class="field__label" for="duelCustom">Your own topic</label>
            <input class="input" id="duelCustom" maxlength="80" placeholder="e.g. Regular expressions" />
          </div>
        </div>`,
      onOpen: (overlay) => {
        const select = overlay.querySelector('#duelTopic');
        const wrap = overlay.querySelector('#customWrap');
        select.addEventListener('change', () => {
          wrap.hidden = select.value !== '__custom';
        });
      },
      onConfirm: async (overlay) => {
        const select = overlay.querySelector('#duelTopic');
        const topic =
          select.value === '__custom' ? overlay.querySelector('#duelCustom').value.trim() : select.value;
        if (!topic) {
          showToast({ title: 'Name a topic', message: 'Pick one or type your own.', type: 'error' });
          return false;
        }
        try {
          const res = await respondToDuel(duelId, 'accept', { topic });
          showToast({ title: 'Duel is on', message: `Topic: ${res.topic}`, type: 'success' });
          load();
          return true;
        } catch (_) {
          return false;
        }
      }
    });
  }

  async function respond(duelId, action) {
    try {
      await respondToDuel(duelId, action);
      load();
    } catch (_) {}
  }

  function callWinner(duelId) {
    const duel = root.querySelector(`[data-duel="${duelId}"]`);
    const names = [...duel.querySelectorAll('.duel__line strong')].map((el) => el.textContent);
    fetchDuels().then(({ duels }) => {
      const target = duels.find((d) => d.id === duelId);
      openModal({
        title: 'Who won?',
        confirmLabel: 'Award the pot',
        contentHtml: `
          <div class="col">
            <p class="text-muted" style="font-size:.875rem">
              The winner takes ${target.pot.points.toLocaleString()} points and
              ${target.pot.xp.toLocaleString()} XP. This cannot be undone.
            </p>
            <div class="field">
              <label class="field__label" for="duelWinner">Winner</label>
              <select class="select" id="duelWinner">
                ${target.participants
                  .map((p) => `<option value="${p.id}">${escapeHtml(p.name)}</option>`)
                  .join('')}
              </select>
            </div>
          </div>`,
        onConfirm: async (overlay) => {
          try {
            await resolveDuel(duelId, overlay.querySelector('#duelWinner').value);
            showToast({ title: 'Duel settled', type: 'success' });
            load();
            return true;
          } catch (_) {
            return false;
          }
        }
      });
    });
    void names;
  }

  document.getElementById('btnNewDuel')?.addEventListener('click', async () => {
    let people = [];
    try {
      const res = await fetchAllUsers();
      people = (res.users || res || []).filter((u) => u.id !== state.currentUser.id);
    } catch (_) {}

    openModal({
      title: 'Challenge someone',
      confirmLabel: 'Send it',
      contentHtml: `
        <div class="col">
          <p class="text-muted" style="font-size:.875rem">
            You set what is on the line. They decide what it is about.
          </p>
          <div class="field">
            <label class="field__label" for="duelOpponent">Who are you challenging?</label>
            <select class="select" id="duelOpponent">
              ${people.map((u) => `<option value="${u.id}">${escapeHtml(u.name)}</option>`).join('')}
            </select>
          </div>
          <div class="row row--tight">
            <div class="field" style="flex:1">
              <label class="field__label" for="duelPoints">Points each</label>
              <input class="input" id="duelPoints" type="number" min="0" max="5000" value="50" />
            </div>
            <div class="field" style="flex:1">
              <label class="field__label" for="duelXp">XP each</label>
              <input class="input" id="duelXp" type="number" min="0" max="5000" value="25" />
            </div>
          </div>
          <p class="field__hint">
            You both put in the same amount. The winner takes both stakes.
          </p>
        </div>`,
      onConfirm: async (overlay) => {
        const opponentId = overlay.querySelector('#duelOpponent').value;
        if (!opponentId) {
          showToast({ title: 'Pick someone to challenge', type: 'error' });
          return false;
        }
        try {
          await createDuel({
            opponentId,
            stakePoints: Number(overlay.querySelector('#duelPoints').value) || 0,
            stakeXp: Number(overlay.querySelector('#duelXp').value) || 0
          });
          showToast({ title: 'Challenge sent', message: 'They choose the topic now.', type: 'success' });
          load();
          return true;
        } catch (_) {
          return false;
        }
      }
    });
  });

  load();
}
