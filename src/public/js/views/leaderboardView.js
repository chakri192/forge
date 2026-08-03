// Leaderboard: standings across the metrics people actually compete on.
import { fetchLeaderboard } from '../services/api.js';
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
    body: `<div id="leaderboardRoot" class="stack">${renderSkeleton('card', { className: '' })}</div>`
  });
}

export function attachLeaderboardEvents(state) {
  if (!state.currentUser) return;
  const root = document.getElementById('leaderboardRoot');
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

  function paint(data) {
    const active = data.metrics.find((m) => m.id === data.metric);
    const leaders = data.leaders;

    // Everyone on zero is a tie, so a podium of three "#1 · 0" is technically
    // right and completely useless. Until someone scores, say so plainly.
    const noneScored = !leaders.length || leaders.every((row) => row.score === 0);
    if (noneScored) {
      root.innerHTML = `
        <p class="lb-note">${escapeHtml(active.description)}</p>
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

  load();
}
