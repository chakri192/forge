// Mirrors app state into the URL hash so views are shareable, bookmarkable,
// and the browser Back button behaves the way users expect.
import { store } from '../state/store.js';

const VALID_TABS = new Set([
  'dashboard',
  'tasks',
  'teams',
  'halloffame',
  'messages',
  'announcements',
  'profile',
  'forum',
  'marketplace',
  'calendar',
  'collab',
  'analytics',
  'review',
  'appearance',
  'leaderboard',
  'games',
  'store',
  'duels',
  'settings',
  'devdashboard',
  'componentstest',
  'login',
  'signup'
]);

// Set while we write the hash ourselves, so our own write doesn't echo back
// through hashchange and re-render the view.
let selfWrite = false;

// Challenges used to be their own tab before becoming a section of Tasks.
// Old links and bookmarks still exist, so they resolve to the filtered board
// rather than dying at an unknown route.
const TAB_ALIASES = { challenges: { tab: 'tasks', param: 'challenges' } };

export function parseHash(hash = location.hash) {
  const clean = String(hash || '').replace(/^#\/?/, '');
  if (!clean) return null;
  const [tab, param] = clean.split('/');
  if (TAB_ALIASES[tab]) return { ...TAB_ALIASES[tab] };
  if (!VALID_TABS.has(tab)) return null;
  return { tab, param: param || null };
}

export function currentParam() {
  return parseHash()?.param ?? null;
}

export function syncHash(tab, param = null) {
  if (!tab || !VALID_TABS.has(tab)) return;
  const next = `#/${tab}${param ? `/${param}` : ''}`;
  if (location.hash === next) return;
  selfWrite = true;
  history.replaceState(null, '', next);
  selfWrite = false;
}

/** Push a new entry so Back returns to the previous view. */
export function pushHash(tab, param = null) {
  if (!tab || !VALID_TABS.has(tab)) return;
  const next = `#/${tab}${param ? `/${param}` : ''}`;
  if (location.hash === next) return;
  selfWrite = true;
  history.pushState(null, '', next);
  selfWrite = false;
}

/** Returns the tab encoded in the URL at boot, if any. */
export function initRouting() {
  const initial = parseHash();

  window.addEventListener('hashchange', () => {
    if (selfWrite) return;
    const parsed = parseHash();
    // A hash we no longer recognise — a bookmark to a removed feature, say —
    // used to leave whatever was on screen, which reads as the link doing
    // nothing. Send it to the dashboard instead.
    if (!parsed && window.location.hash.length > 2) {
      store.setState({ activeTab: 'dashboard' });
      return;
    }
    if (parsed && parsed.tab !== store.getState().activeTab) {
      store.setState({ activeTab: parsed.tab });
    } else if (parsed) {
      // Same tab, different param (e.g. a different channel) — let views react.
      document.dispatchEvent(
        new CustomEvent('forge:route-param', { detail: { tab: parsed.tab, param: parsed.param } })
      );
    }
  });

  window.addEventListener('popstate', () => {
    const parsed = parseHash();
    if (parsed && parsed.tab !== store.getState().activeTab) {
      store.setState({ activeTab: parsed.tab });
    }
  });

  return initial ? initial.tab : null;
}
