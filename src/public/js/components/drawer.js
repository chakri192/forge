import { store } from '../state/store.js';
import { disconnectStream } from '../services/stream.js';

// Matches the `lg` breakpoint where the sidebar becomes a persistent rail.
const DESKTOP_QUERY = '(min-width: 1024px)';

export function initDrawerNav() {
  const toggleBtn = document.getElementById('drawerToggleBtn');
  const closeBtn = document.getElementById('drawerCloseBtn');
  const backdrop = document.getElementById('drawerBackdrop');
  const drawer = document.getElementById('sidebarDrawer');

  const isDesktop = () => window.matchMedia(DESKTOP_QUERY).matches;

  function openDrawer() {
    if (isDesktop()) return;
    if (drawer) drawer.dataset.open = 'true';
    if (backdrop) backdrop.dataset.open = 'true';
    if (toggleBtn) toggleBtn.setAttribute('aria-expanded', 'true');
    if (closeBtn) closeBtn.focus();
  }

  function closeDrawer() {
    if (drawer) drawer.dataset.open = 'false';
    if (backdrop) backdrop.dataset.open = 'false';
    if (toggleBtn) toggleBtn.setAttribute('aria-expanded', 'false');
  }

  if (toggleBtn) toggleBtn.addEventListener('click', openDrawer);
  if (closeBtn) closeBtn.addEventListener('click', closeDrawer);
  if (backdrop) backdrop.addEventListener('click', closeDrawer);

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && toggleBtn?.getAttribute('aria-expanded') === 'true') {
      closeDrawer();
      toggleBtn.focus();
    }
  });

  const logoutBtn = document.getElementById('drawerLogoutBtn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      localStorage.removeItem('forge_jwt_token');
      localStorage.removeItem('forge_user_session');
      disconnectStream();
      store.setState({ currentUser: null, activeTab: 'login' });
      closeDrawer();
    });
  }

  const navItems = document.querySelectorAll('.nav-item');
  navItems.forEach((item) => {
    item.addEventListener('click', (e) => {
      const activeTab = e.currentTarget.getAttribute('data-tab');
      if (!activeTab) return;
      store.setState({ activeTab });
      updateActiveNavHighlight(activeTab);
      closeDrawer();
    });
  });

  initNavGroups();
}

const GROUP_STATE_KEY = 'forge_nav_groups';

function readGroupState() {
  try {
    return JSON.parse(localStorage.getItem(GROUP_STATE_KEY)) || {};
  } catch (_) {
    return {};
  }
}

function writeGroupState(state) {
  try {
    localStorage.setItem(GROUP_STATE_KEY, JSON.stringify(state));
  } catch (_) {}
}

/** Collapsible nav sections, with each section's open/closed state remembered. */
function initNavGroups() {
  const saved = readGroupState();

  document.querySelectorAll('.nav-group').forEach((group) => {
    const id = group.dataset.navGroup;
    const toggle = group.querySelector('.nav-group__toggle');
    const items = group.querySelector('.nav-group__items');
    const chevron = group.querySelector('.nav-group__chevron');
    if (!toggle || !items) return;

    const setOpen = (open) => {
      items.classList.toggle('hidden', !open);
      toggle.setAttribute('aria-expanded', String(open));
      if (chevron) chevron.textContent = open ? 'expand_more' : 'chevron_right';
    };

    if (saved[id] !== undefined) setOpen(saved[id]);

    toggle.addEventListener('click', () => {
      const open = items.classList.contains('hidden');
      setOpen(open);
      const next = readGroupState();
      next[id] = open;
      writeGroupState(next);
    });
  });
}

/**
 * Hide role-gated groups (e.g. Manage) from members. Called whenever the
 * signed-in user changes.
 */
export function applyNavRoleVisibility(user) {
  const role = user ? user.role : null;
  const publicRole = user ? user.public_role || user.role : null;

  document.querySelectorAll('[data-nav-roles]').forEach((group) => {
    const allowed = group.dataset.navRoles.split(',').map((r) => r.trim());
    const permitted = Boolean(role) && (allowed.includes(role) || allowed.includes(publicRole));
    group.classList.toggle('hidden', !permitted);
  });

  // Signed-out visitors should not see app sections at all.
  document.querySelectorAll('.nav-group:not([data-nav-roles])').forEach((group) => {
    group.classList.toggle('hidden', !user);
  });

  const signedInOnly = ['drawerSettingsLink'];
  const signedOutOnly = ['drawerLoginLink', 'drawerSignUpLink'];
  for (const id of signedInOnly) document.getElementById(id)?.classList.toggle('hidden', !user);
  for (const id of signedOutOnly) document.getElementById(id)?.classList.toggle('hidden', Boolean(user));
  document.getElementById('drawerLogoutBtn')?.classList.toggle('hidden', !user);
}

// Unread channel count, surfaced on the Messages nav item from anywhere.
document.addEventListener('forge:unread-channels', (event) => {
  const badge = document.getElementById('navUnreadChannels');
  if (!badge) return;
  const count = event.detail?.count || 0;
  badge.textContent = count > 9 ? '9+' : String(count);
  badge.classList.toggle('hidden', count === 0);
});

export function updateActiveNavHighlight(activeTab) {
  document.querySelectorAll('.nav-item[data-tab]').forEach((item) => {
    const isActive = item.getAttribute('data-tab') === activeTab;
    if (isActive) item.setAttribute('aria-current', 'page');
    else item.removeAttribute('aria-current');
  });
}
