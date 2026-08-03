import { store } from '../state/store.js';

export function initDrawerNav() {
  const toggleBtn = document.getElementById('drawerToggleBtn');
  const closeBtn = document.getElementById('drawerCloseBtn');
  const backdrop = document.getElementById('drawerBackdrop');
  const drawer = document.getElementById('sidebarDrawer');

  function openDrawer() {
    if (drawer) drawer.classList.remove('-translate-x-full');
    if (backdrop) {
      backdrop.classList.remove('opacity-0', 'pointer-events-none');
      backdrop.classList.add('opacity-100', 'pointer-events-auto');
    }
  }

  function closeDrawer() {
    if (drawer) drawer.classList.add('-translate-x-full');
    if (backdrop) {
      backdrop.classList.remove('opacity-100', 'pointer-events-auto');
      backdrop.classList.add('opacity-0', 'pointer-events-none');
    }
  }

  if (toggleBtn) toggleBtn.addEventListener('click', openDrawer);
  if (closeBtn) closeBtn.addEventListener('click', closeDrawer);
  if (backdrop) backdrop.addEventListener('click', closeDrawer);

  const logoutBtn = document.getElementById('drawerLogoutBtn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      localStorage.removeItem('forge_jwt_token');
      localStorage.removeItem('forge_user_session');
      store.setState({ currentUser: null, activeTab: 'login' });
      closeDrawer();
    });
  }

  const navItems = document.querySelectorAll('.nav-drawer-item');
  navItems.forEach(item => {
    item.addEventListener('click', (e) => {
      const target = e.currentTarget;
      const activeTab = target.getAttribute('data-tab');

      if (activeTab) {
        store.setState({ activeTab });
        updateActiveNavHighlight(activeTab);
        closeDrawer();
      }
    });
  });
}

export function updateActiveNavHighlight(activeTab) {
  const navItems = document.querySelectorAll('.nav-drawer-item[data-tab]');
  navItems.forEach(item => {
    const tab = item.getAttribute('data-tab');
    if (tab === activeTab) {
      item.classList.add('bg-royal-slate-blue/20', 'border-royal-slate-blue/40', 'text-white');
      item.classList.remove('text-outline');
    } else {
      item.classList.remove('bg-royal-slate-blue/20', 'border-royal-slate-blue/40', 'text-white');
      item.classList.add('text-outline');
    }
  });
}
