// ⌘K command palette: fuzzy jump to any section, task, channel, announcement,
// or person, plus common verbs. Searches data already in the store, so opening
// it costs nothing.
import { store } from '../state/store.js';
import { fetchChannels, fetchAnnouncements, fetchAllUsers, search } from '../services/api.js';
import { escapeHtml } from '../utils/dom.js';

const OVERLAY_ID = 'forgeCommandPalette';

const SECTIONS = [
  { tab: 'dashboard', label: 'Dashboard', icon: 'dashboard' },
  { tab: 'tasks', label: 'Tasks', icon: 'assignment' },
  { tab: 'teams', label: 'Teams', icon: 'groups' },
  { tab: 'halloffame', label: 'Hall of Fame', icon: 'emoji_events' },
  { tab: 'messages', label: 'Messages', icon: 'forum' },
  { tab: 'announcements', label: 'Announcements', icon: 'campaign' },
  { tab: 'forum', label: 'Forum', icon: 'tips_and_updates' },
  { tab: 'marketplace', label: 'Task Marketplace', icon: 'storefront' },
  { tab: 'calendar', label: 'Calendar', icon: 'calendar_month' },
  { tab: 'profile', label: 'My Progress', icon: 'military_tech' },
  { tab: 'journal', label: 'Reflection Journal', icon: 'menu_book' },
  { tab: 'analytics', label: 'Cohort Analytics', icon: 'insights' },
  { tab: 'games', label: 'Mini Games', icon: 'stadia_controller' },
  { tab: 'store', label: 'Store', icon: 'redeem' },
  { tab: 'leaderboard', label: 'Leaderboard', icon: 'leaderboard' },
  { tab: 'appearance', label: 'Appearance & Themes', icon: 'palette' },
  { tab: 'settings', label: 'Account Settings', icon: 'settings' }
];

let overlay = null;
let inputEl = null;
let listEl = null;
let items = [];
let activeIndex = 0;
let cache = { channels: [], announcements: [], users: [], loadedAt: 0 };
// Server-side full-text hits for the current query.
let remoteResults = [];

/** Subsequence match — "bru" matches "Build Responsive UI". */
function fuzzyScore(haystack, needle) {
  if (!needle) return 0;
  const text = haystack.toLowerCase();
  const query = needle.toLowerCase();
  if (text.includes(query)) return 1000 - text.indexOf(query);

  let score = 0;
  let cursor = 0;
  for (const char of query) {
    const found = text.indexOf(char, cursor);
    if (found === -1) return -1;
    score += found === cursor ? 5 : 1;
    cursor = found + 1;
  }
  return score;
}

function buildCandidates() {
  const state = store.getState();
  const candidates = [];

  for (const section of SECTIONS) {
    candidates.push({
      group: 'Go to',
      label: section.label,
      icon: section.icon,
      run: () => store.setState({ activeTab: section.tab })
    });
  }

  candidates.push(
    {
      group: 'Actions',
      label: 'Create task',
      icon: 'add_task',
      run: () => {
        store.setState({ activeTab: 'tasks' });
        setTimeout(() => document.getElementById('btnCreateTask')?.click(), 220);
      }
    },
    {
      group: 'Actions',
      label: 'New channel',
      icon: 'add_comment',
      run: () => {
        store.setState({ activeTab: 'messages' });
        setTimeout(() => document.getElementById('btnNewChannel')?.click(), 220);
      }
    },
    {
      group: 'Actions',
      label: 'Publish announcement',
      icon: 'campaign',
      run: () => {
        store.setState({ activeTab: 'announcements' });
        setTimeout(() => document.getElementById('annTitle')?.focus(), 220);
      }
    }
  );

  const tasksData = state.tasksData || {};
  const seenTasks = new Set();
  for (const task of [
    ...(tasksData.official || []),
    ...(tasksData.teamTasks || []),
    ...(tasksData.challenges || [])
  ]) {
    if (!task || seenTasks.has(task.id)) continue;
    seenTasks.add(task.id);
    candidates.push({
      group: 'Tasks',
      label: task.title,
      hint: (task.status || '').replace(/_/g, ' '),
      icon: 'assignment',
      run: () => {
        store.setState({ activeTab: 'tasks' });
        setTimeout(() => {
          document.querySelector(`.btn-view-details[data-id="${task.id}"]`)?.click();
        }, 220);
      }
    });
  }

  for (const channel of cache.channels) {
    candidates.push({
      group: 'Channels',
      label: `#${channel.name}`,
      icon: channel.is_private ? 'lock' : 'tag',
      run: () => {
        store.setState({ activeTab: 'messages' });
        setTimeout(() => {
          document.querySelector(`.channel-item[data-channel-id="${channel.id}"]`)?.click();
        }, 250);
      }
    });
  }

  for (const announcement of cache.announcements) {
    candidates.push({
      group: 'Announcements',
      label: announcement.title,
      hint: announcement.priority,
      icon: 'campaign',
      run: () => store.setState({ activeTab: 'announcements' })
    });
  }

  for (const user of cache.users) {
    candidates.push({
      group: 'People',
      label: user.name,
      hint: user.public_role || user.role,
      icon: 'person',
      run: () => store.setState({ activeTab: 'halloffame' })
    });
  }

  return candidates;
}

async function warmCache() {
  if (Date.now() - cache.loadedAt < 30000) return;
  const [channels, announcements, users] = await Promise.allSettled([
    fetchChannels(),
    fetchAnnouncements(),
    fetchAllUsers()
  ]);
  cache = {
    channels: channels.status === 'fulfilled' ? channels.value.channels || [] : cache.channels,
    announcements:
      announcements.status === 'fulfilled'
        ? announcements.value.announcements || []
        : cache.announcements,
    users:
      users.status === 'fulfilled'
        ? (Array.isArray(users.value) ? users.value : users.value.users || []).filter(Boolean)
        : cache.users,
    loadedAt: Date.now()
  };
}


function renderResults(query) {
  const candidates = buildCandidates();
  const ranked = query
    ? candidates
        .map((c) => ({ c, score: fuzzyScore(`${c.label} ${c.group}`, query) }))
        .filter((r) => r.score >= 0)
        .sort((a, b) => b.score - a.score)
        .map((r) => r.c)
    : candidates.filter((c) => c.group === 'Go to' || c.group === 'Actions');

  // Fold in full-text matches, skipping anything already matched locally.
  if (query && remoteResults.length) {
    const seen = new Set(ranked.map((r) => r.label));
    for (const remote of remoteResults) {
      if (!seen.has(remote.label)) ranked.push(remote);
    }
  }

  items = ranked.slice(0, 12);
  activeIndex = 0;

  if (!items.length) {
    listEl.innerHTML = `<li class="px-4 py-8 text-center text-xs text-outline">No matches for "${escapeHtml(query)}"</li>`;
    return;
  }

  let lastGroup = null;
  listEl.innerHTML = items
    .map((item, index) => {
      const header =
        item.group !== lastGroup
          ? `<li class="px-4 pt-3 pb-1 text-[10px] font-bold uppercase tracking-wider text-outline/70">${item.group}</li>`
          : '';
      lastGroup = item.group;
      return `${header}
        <li>
          <button data-index="${index}" role="option" aria-selected="${index === 0}"
            class="palette-item w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
              index === 0 ? 'bg-royal-slate-blue/25' : 'hover:bg-white/5'
            }">
            <span class="material-symbols-outlined text-base text-outline" aria-hidden="true">${item.icon}</span>
            <span class="flex-1 min-w-0 text-sm text-white truncate">${escapeHtml(item.label)}</span>
            ${item.hint ? `<span class="text-[10px] uppercase tracking-wide text-outline shrink-0">${escapeHtml(item.hint)}</span>` : ''}
          </button>
        </li>`;
    })
    .join('');

  listEl.querySelectorAll('.palette-item').forEach((btn) => {
    btn.addEventListener('click', () => runItem(Number(btn.dataset.index)));
    btn.addEventListener('mousemove', () => setActive(Number(btn.dataset.index)));
  });
}

function setActive(index) {
  if (!items.length) return;
  activeIndex = (index + items.length) % items.length;
  listEl.querySelectorAll('.palette-item').forEach((btn) => {
    const isActive = Number(btn.dataset.index) === activeIndex;
    btn.classList.toggle('bg-royal-slate-blue/25', isActive);
    btn.setAttribute('aria-selected', String(isActive));
    if (isActive) btn.scrollIntoView({ block: 'nearest' });
  });
}

function runItem(index) {
  const item = items[index];
  if (!item) return;
  closePalette();
  item.run();
}

export function openPalette() {
  if (!store.getState().currentUser) return;
  overlay.classList.remove('hidden');
  remoteResults = [];
  inputEl.value = '';
  renderResults('');
  inputEl.focus();
  warmCache().then(() => {
    if (!overlay.classList.contains('hidden')) renderResults(inputEl.value.trim());
  });
}

export function closePalette() {
  overlay.classList.add('hidden');
}

export function isPaletteOpen() {
  return overlay && !overlay.classList.contains('hidden');
}

export function initCommandPalette() {
  if (document.getElementById(OVERLAY_ID)) return;

  overlay = document.createElement('div');
  overlay.id = OVERLAY_ID;
  overlay.className =
    'hidden fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm flex items-start justify-center pt-[12vh] px-4';
  overlay.innerHTML = `
    <div class="w-full max-w-lg rounded-2xl border border-white/15 bg-deep-obsidian/95 backdrop-blur-2xl shadow-2xl overflow-hidden"
      role="dialog" aria-modal="true" aria-label="Command palette">
      <div class="flex items-center gap-3 px-4 py-3 border-b border-white/10">
        <span class="material-symbols-outlined text-outline" aria-hidden="true">search</span>
        <input id="paletteInput" type="text" autocomplete="off" placeholder="Search tasks, channels, people…"
          aria-controls="paletteResults"
          class="flex-1 bg-transparent text-sm text-white placeholder:text-outline focus:outline-none" />
        <kbd class="px-1.5 py-0.5 rounded bg-white/10 text-[10px] font-bold text-outline">ESC</kbd>
      </div>
      <ul id="paletteResults" role="listbox" class="max-h-80 overflow-y-auto py-1"></ul>
      <div class="px-4 py-2 border-t border-white/10 flex items-center gap-3 text-[10px] text-outline">
        <span><kbd class="px-1 py-0.5 rounded bg-white/10">↑↓</kbd> navigate</span>
        <span><kbd class="px-1 py-0.5 rounded bg-white/10">↵</kbd> open</span>
      </div>
    </div>`;
  document.body.appendChild(overlay);

  inputEl = overlay.querySelector('#paletteInput');
  listEl = overlay.querySelector('#paletteResults');

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closePalette();
  });

  let searchTimer = null;
  inputEl.addEventListener('input', () => {
    const q = inputEl.value.trim();
    renderResults(q);

    // Full-text search runs against the server, debounced, and merges into the
    // already-rendered local matches rather than replacing them.
    clearTimeout(searchTimer);
    if (q.length < 2) return;
    searchTimer = setTimeout(async () => {
      try {
        const { results } = await search(q);
        if (inputEl.value.trim() !== q || !results.length) return;
        remoteResults = results.map((r) => ({
          group: r.label,
          label: r.title,
          hint: r.snippet ? r.snippet.slice(0, 40) : '',
          icon: { task: 'assignment', forum: 'tips_and_updates', announcement: 'campaign', quiz: 'quiz' }[r.kind] || 'search',
          run: () => { location.hash = r.link; }
        }));
        renderResults(q);
      } catch (_) {
        /* local results already shown */
      }
    }, 180);
  });

  // The topbar search button is the discoverable path to the palette for
  // anyone who does not know the shortcut.
  document.getElementById('btnOpenPalette')?.addEventListener('click', openPalette);

  inputEl.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive(activeIndex + 1);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive(activeIndex - 1);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      runItem(activeIndex);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      closePalette();
    }
  });
}
