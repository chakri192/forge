// Dashboard: what is assigned to you, where you stand, what is open.
//
// The previous version opened with a hero banner, a watermark, an "Active
// Session" chip and a paragraph describing the page you were already looking
// at. None of it was information. What remains is three figures and two lists.
import { label } from '../utils/labels.js';
import { escapeHtml } from '../utils/dom.js';
import { renderScreen } from '../components/screen.js';
import { attachToolbar } from '../components/toolbar.js';

export function renderDashboard(state) {
  const { tasksData = {}, teamsData = [], hallOfFameData = {}, currentUser } = state;
  const teamTasks = tasksData?.teamTasks || [];
  const challenges = tasksData?.challenges || [];
  const openWork = [...teamTasks, ...challenges];
  const leaders = hallOfFameData?.allTime || [];

  const myStanding = leaders.find((l) => l.id === currentUser?.id);
  const points = myStanding ? myStanding.points : 0;
  const teams = Array.isArray(teamsData) ? teamsData : [];
  const myTeam = teams.find((t) => t?.members?.some((m) => m?.id === currentUser?.id));

  return renderScreen({
    title: currentUser ? `Hello, ${currentUser.name.split(' ')[0]}` : 'Dashboard',
    subtitle: `${openWork.length} open ${openWork.length === 1 ? 'item' : 'items'} assigned to you.`,
    toolbar: {
      groups: [
        { actions: [{ id: 'tasks', label: 'View tasks', icon: 'assignment', variant: 'primary' }] },
        {
          collapsible: true,
          actions: [
            { id: 'challenges', label: 'Challenges', icon: 'bolt' },
            { id: 'leaderboard', label: 'Leaderboard', icon: 'leaderboard', iconOnly: true }
          ]
        }
      ]
    },
    body: `
      ${statsHtml({ points, team: myTeam, user: currentUser })}
      <div class="split">
        ${workHtml(openWork)}
        ${standingsHtml(leaders, currentUser)}
      </div>`
  });
}

/* Figures first, at one size, on one line. No icon tiles — the tile was
   larger than the number it decorated. */
function statsHtml({ points, team, user }) {
  const stats = [
    { label: 'Points', value: points.toLocaleString() },
    { label: 'Team', value: team ? team.name : 'Unassigned' },
    { label: 'Role', value: user ? user.public_role || user.role : 'Member' }
  ];
  return `
    <dl class="stats">
      ${stats
        .map(
          (s) => `
        <div class="stats__item">
          <dt class="stats__label">${escapeHtml(s.label)}</dt>
          <dd class="stats__value">${escapeHtml(String(s.value))}</dd>
        </div>`
        )
        .join('')}
    </dl>`;
}

function workHtml(items) {
  return `
    <section class="block">
      <div class="block__head">
        <h2 class="block__label">Assigned to you</h2>
        <button class="tool" data-action="tasks-all" type="button">
          <span class="tool__label">All tasks</span>
        </button>
      </div>
      ${
        items.length
          ? `<ul class="rows">${items.slice(0, 5).map(rowHtml).join('')}</ul>`
          : `<p class="rows__empty">Nothing assigned right now.</p>`
      }
    </section>`;
}

/* A row, not a card: title, one line of context, the figure right-aligned.
   Five of these fit in the space two cards used. */
function rowHtml(task) {
  const isChallenge = task.task_type === 'CHALLENGE';
  return `
    <li class="row-item" data-tab="tasks" ${isChallenge ? 'data-param="challenges"' : ''} tabindex="0" role="link">
      <span class="row-item__main">
        <span class="row-item__title">${escapeHtml(task.title)}</span>
        <span class="row-item__meta">
          ${isChallenge ? 'Challenge' : 'Team task'} · ${escapeHtml(label(task.status))}
        </span>
      </span>
      <span class="row-item__value">${task.total_points}<small>pts</small></span>
    </li>`;
}

function standingsHtml(leaders, currentUser) {
  return `
    <section class="block">
      <div class="block__head">
        <h2 class="block__label">Standings</h2>
        <button class="tool" data-action="leaderboard-all" type="button">
          <span class="tool__label">Full board</span>
        </button>
      </div>
      ${
        leaders.length
          ? `<ol class="rows rows--ranked">
              ${leaders
                .slice(0, 5)
                .map(
                  (l, i) => `
                <li class="row-item ${l.id === currentUser?.id ? 'is-you' : ''}">
                  <span class="row-item__rank">${i + 1}</span>
                  <span class="row-item__main">
                    <span class="row-item__title">${escapeHtml(l.name)}</span>
                    <span class="row-item__meta">@${escapeHtml(l.username)}</span>
                  </span>
                  <span class="row-item__value">${l.points}<small>pts</small></span>
                </li>`
                )
                .join('')}
            </ol>`
          : `<p class="rows__empty">No scores recorded yet.</p>`
      }
    </section>`;
}

export function attachDashboardEvents() {
  const go = (tab, param = null) =>
    document.dispatchEvent(new CustomEvent('forge:navigate', { detail: { tab, param } }));

  attachToolbar(document.querySelector('.screen__header'), {
    tasks: () => go('tasks'),
    challenges: () => go('tasks', 'challenges'),
    leaderboard: () => go('leaderboard')
  });

  document.querySelector('[data-action="tasks-all"]')?.addEventListener('click', () => go('tasks'));
  document.querySelector('[data-action="leaderboard-all"]')?.addEventListener('click', () => go('leaderboard'));

  // Rows behave like links, including from the keyboard.
  document.querySelectorAll('.row-item[data-tab]').forEach((row) => {
    const open = () => go(row.dataset.tab);
    row.addEventListener('click', open);
    row.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        open();
      }
    });
  });
}
