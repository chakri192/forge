// Leaderboard: standings across the metrics people actually compete on.
import { fetchLeaderboard, fetchSeasons, createSeason, archiveSeason } from '../services/api.js';
import { openModal } from '../components/modal.js';
import { showConfirmDialog } from '../components/confirmDialog.js';
import { showToast } from '../components/toast.js';
import { renderSkeleton } from '../components/spinner.js';
import { escapeHtml } from '../utils/dom.js';
import { pushHash, currentParam } from '../router/hashRouter.js';
import { renderScreen } from '../components/screen.js';
import { attachToolbar } from '../components/toolbar.js';

const VALID = ['xp', 'tasks', 'streak'];

export function renderLeaderboardView(state) {
  if (!state.currentUser) {
    return `<div class="empty"><p class="empty__text">Sign in to see the standings.</p></div>`;
  }

  const active = VALID.includes(currentParam()) ? currentParam() : 'xp';
  return renderScreen({
    title: 'Leaderboard',
    subtitle: 'Standings update as work is approved.',
    toolbar: {
      groups: [
        {
          actions: [
            { id: 'xp', label: 'XP', pressed: active === 'xp' },
            { id: 'tasks', label: 'Tasks', pressed: active === 'tasks' },
            { id: 'streak', label: 'Streak', pressed: active === 'streak' }
          ]
        },
        {
          collapsible: true,
          actions: [{ id: 'refresh', label: 'Refresh', icon: 'refresh', iconOnly: true }]
        }
      ]
    },
    body: `
      <div id="leaderboardRoot" class="stack">${renderSkeleton('card', { className: '' })}</div>
      <div id="seasonsRoot" class="stack"></div>`
  });
}

const RUN_SEASON_ROLES = ['leader', 'teacher', 'admin', 'DEV_STEALTH', 'TEACHER', 'STUDENT_LEADER'];

export function attachLeaderboardEvents(state) {
  if (!state.currentUser) return;
  const root = document.getElementById('leaderboardRoot');
  const seasonsRoot = document.getElementById('seasonsRoot');
  const canRunSeasons = RUN_SEASON_ROLES.includes(state.currentUser.role);
  const linked = currentParam();
  let metric = VALID.includes(linked) ? linked : 'xp';

  async function load() {
    pushHash('leaderboard', metric === 'xp' ? null : metric);
    try {
      const data = await fetchLeaderboard(metric);
      paint(data);
    } catch (_) {
      root.innerHTML = `
        <div class="empty">
          <p class="empty__title">Standings unavailable</p>
          <p class="empty__text">The leaderboard could not be loaded. Try again in a moment.</p>
        </div>`;
    }
  }

  /**
   * Says what window the board covers. Without it, a fresh season looks
   * identical to a cohort that has done nothing.
   */
  function seasonNote(data) {
    if (!data.season) return '';
    const ends = new Date(data.season.endsAt);
    const days = Math.ceil((ends.getTime() - Date.now()) / 86400000);
    const left =
      days > 1 ? `${days} days left` : days === 1 ? '1 day left' : 'ending today';
    return `
      <p class="lb-season">
        <span class="lb-season__name">${escapeHtml(data.season.name)}</span>
        <span class="lb-season__left">${escapeHtml(left)}</span>
      </p>`;
  }

  function paint(data) {
    const active = data.metrics.find((m) => m.id === data.metric);
    const leaders = data.leaders;

    // Everyone on zero is a tie, so a podium of three "#1 · 0" is technically
    // right and completely useless. Until someone scores, say so plainly.
    const noneScored = !leaders.length || leaders.every((row) => row.score === 0);
    if (noneScored) {
      root.innerHTML = `
        ${seasonNote(data)}
        <p class="lb-note">${escapeHtml(active.description)}${
          data.season && data.metric === 'streak' ? ' Streaks carry across seasons.' : ''
        }</p>
        <div class="empty">
          <p class="empty__title">No ${escapeHtml(active.label.toLowerCase())} recorded yet</p>
          <p class="empty__text">
            ${
              data.total
                ? `All ${data.total} people are level here. The first approved ${
                    data.metric === 'streak' ? 'day of activity' : 'submission'
                  } takes the lead.`
                : 'Standings appear once there is someone to rank.'
            }
          </p>
        </div>`;
      return;
    }

    // The top three read as a podium; the rest as a table. Same data, but the
    // shape of the lead is the part people actually look for.
    const podium = leaders.slice(0, 3);
    const rest = leaders.slice(3);

    root.innerHTML = `
      ${seasonNote(data)}
      <p class="lb-note">${escapeHtml(active.description)}</p>

      <ol class="podium">
        ${podium.map((row) => podiumHtml(row, active, state)).join('')}
      </ol>

      ${
        rest.length
          ? `<ol class="lb-list">${rest.map((row) => rowHtml(row, active, state)).join('')}</ol>`
          : ''
      }

      ${
        data.viewer
          ? `<div class="lb-you">
              <span class="lb-you__label">Your position</span>
              <ol class="lb-list">${rowHtml(data.viewer, active, state)}</ol>
            </div>`
          : ''
      }

      <p class="lb-foot">
        ${data.total} ${data.total === 1 ? 'person' : 'people'} ranked${
          data.viewerRank ? ` · you are #${data.viewerRank}` : ''
        }
      </p>`;

  }

  function podiumHtml(row, metric, state) {
    const mine = row.id === state.currentUser.id;
    return `
      <li class="podium__slot podium__slot--${row.rank} ${mine ? 'is-you' : ''}">
        <span class="podium__rank">#${row.rank}</span>
        <span class="avatar avatar--lg">${escapeHtml(initials(row.name))}</span>
        <span class="podium__name">${escapeHtml(row.name)}${mine ? ' <span class="lb-badge">You</span>' : ''}</span>
        <span class="podium__meta">@${escapeHtml(row.username)} · ${escapeHtml(row.role)}</span>
        <span class="podium__score">${row.score.toLocaleString()}<small>${escapeHtml(metric.unit)}</small></span>
      </li>`;
  }

  function rowHtml(row, metric, state) {
    const mine = row.id === state.currentUser.id;
    return `
      <li class="lb-row ${mine ? 'is-you' : ''}">
        <span class="lb-row__rank">#${row.rank}</span>
        <span class="avatar avatar--sm">${escapeHtml(initials(row.name))}</span>
        <span class="lb-row__who">
          <span class="lb-row__name">${escapeHtml(row.name)}${mine ? ' <span class="lb-badge">You</span>' : ''}</span>
          <span class="lb-row__sub">@${escapeHtml(row.username)} · ${escapeHtml(row.tag || row.role)}</span>
        </span>
        <span class="lb-row__score">${row.score.toLocaleString()}<small>${escapeHtml(metric.unit)}</small></span>
      </li>`;
  }

  function initials(name) {
    return String(name || '?')
      .split(/\s+/)
      .slice(0, 2)
      .map((p) => p[0] || '')
      .join('')
      .toUpperCase();
  }

  attachToolbar(document.querySelector('.screen__header'), {
    xp: () => switchMetric('xp'),
    tasks: () => switchMetric('tasks'),
    streak: () => switchMetric('streak'),
    refresh: load
  });

  function switchMetric(next) {
    if (next === metric) return;
    metric = next;
    document
      .querySelectorAll('.screen__header .toolbar__group:first-child .tool')
      .forEach((btn) => btn.setAttribute('aria-pressed', String(btn.dataset.action === next)));
    load();
  }


  /* --- seasons ---------------------------------------------------------- */

  const fmt = (iso) =>
    new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });

  async function loadSeasons() {
    if (!seasonsRoot) return;
    try {
      const { seasons } = await fetchSeasons();
      // Nothing to say to a member when no season has ever run.
      if (!seasons.length && !canRunSeasons) return (seasonsRoot.innerHTML = '');

      seasonsRoot.innerHTML = `
        <section class="panel">
          <div class="row" style="align-items:center;justify-content:space-between">
            <h2 class="block__label" style="margin:0">Seasons</h2>
            ${canRunSeasons ? '<button class="btn btn--sm" data-new-season>Start a season</button>' : ''}
          </div>
          ${
            seasons.length
              ? seasons.map(seasonRow).join('')
              : '<p class="empty__text" style="padding:var(--sp-4) 0">No season yet — the board is all-time until one starts.</p>'
          }
        </section>`;
      bindSeasons();
    } catch (_) {
      seasonsRoot.innerHTML = '';
    }
  }

  function seasonRow(season) {
    const isActive = season.status === 'ACTIVE';
    return `
      <div class="season-row">
        <div class="season-row__main">
          <p class="season-row__name">${escapeHtml(season.name)}</p>
          <span class="season-row__dates">${fmt(season.starts_at)} – ${fmt(season.ends_at)}</span>
          ${
            season.winner
              ? `<span class="season-row__winner"> · won by ${escapeHtml(season.winner.name)} on ${season.winner.score} XP</span>`
              : ''
          }
        </div>
        <span class="season-row__state ${isActive ? 'is-active' : 'is-archived'}">
          ${isActive ? 'Running' : 'Archived'}
        </span>
        ${
          isActive && canRunSeasons
            ? `<button class="btn btn--sm" data-archive="${escapeHtml(season.id)}">End it</button>`
            : ''
        }
      </div>`;
  }

  function bindSeasons() {
    seasonsRoot.querySelector('[data-new-season]')?.addEventListener('click', openNewSeason);

    seasonsRoot.querySelectorAll('[data-archive]').forEach((btn) =>
      btn.addEventListener('click', async () => {
        const confirmed = await showConfirmDialog({
          title: 'End this season?',
          message:
            'Standings are frozen and everyone who placed is told where they finished. No XP is deleted — the board simply starts counting from the next season.',
          confirmText: 'End season',
          danger: true
        });
        if (!confirmed) return;
        try {
          await archiveSeason(btn.dataset.archive);
          showToast({ title: 'Season archived', type: 'success' });
          load();
          loadSeasons();
        } catch (_) {
          /* requestApi surfaces the reason */
        }
      })
    );
  }

  function openNewSeason() {
    const start = new Date();
    const end = new Date();
    end.setMonth(end.getMonth() + 1);
    const asInput = (d) => d.toISOString().slice(0, 10);

    openModal({
      title: 'Start a season',
      confirmLabel: 'Start',
      contentHtml: `
        <div class="stack">
          <div>
            <label class="field__label" style="margin-bottom:.375rem;display:block">Name</label>
            <input id="seasonName" class="input" maxlength="80" placeholder="e.g. Spring sprint" />
          </div>
          <div class="row">
            <div style="flex:1">
              <label class="field__label" style="margin-bottom:.375rem;display:block">Starts</label>
              <input id="seasonStart" type="date" class="select" value="${asInput(start)}" />
            </div>
            <div style="flex:1">
              <label class="field__label" style="margin-bottom:.375rem;display:block">Ends</label>
              <input id="seasonEnd" type="date" class="select" value="${asInput(end)}" />
            </div>
          </div>
          <p class="field__hint">
            The leaderboard will count only XP earned between these dates. Nothing is deleted,
            and points and cosmetics are untouched.
          </p>
        </div>`,
      onConfirm: async (overlay) => {
        const name = overlay.querySelector('#seasonName').value.trim();
        const from = overlay.querySelector('#seasonStart').value;
        const to = overlay.querySelector('#seasonEnd').value;
        if (name.length < 2 || !from || !to) {
          showToast({ title: 'Missing details', message: 'Name, start, and end are all required.', type: 'error' });
          return false;
        }
        if (new Date(to) <= new Date(from)) {
          showToast({ title: 'Check the dates', message: 'A season has to end after it starts.', type: 'error' });
          return false;
        }
        try {
          await createSeason({
            name,
            startsAt: new Date(`${from}T00:00:00`).toISOString(),
            endsAt: new Date(`${to}T23:59:59`).toISOString()
          });
          showToast({ title: 'Season started', message: name, type: 'success' });
          load();
          loadSeasons();
          return true;
        } catch (_) {
          return false;
        }
      }
    });
  }

  load();
  loadSeasons();
}
