// Main ES Module Entry Point
import { store } from './state/store.js';
import { fetchCurrentUser, fetchTasks, fetchTeams, fetchHallOfFame } from './services/api.js';
import { initDrawerNav, applyNavRoleVisibility } from './components/drawer.js';
import { updateUserBadges } from './components/userBadges.js';
import { initNotificationBell, refreshUnreadCount } from './components/notificationBell.js';
import { connectStream, disconnectStream, onStreamEvent } from './services/stream.js';
import { initTheme } from './services/theme.js';
import { initConnectionStatus } from './components/connectionStatus.js';
import { initCommandPalette } from './components/commandPalette.js';
import { initKeyboardShortcuts } from './services/keyboard.js';
import { clearSession, rememberView, lastView, resetSessionExpiry } from './services/session.js';
import { initRouting, syncHash } from './router/hashRouter.js';
import { Router } from './router/router.js';

// Explicit view imports re-exported for static asset inspection and router dispatch
export { renderDashboard } from './views/dashboardView.js';
export { renderTasksView } from './views/tasksView.js';
export { renderChallengesView } from './views/challengesView.js';
export { renderTeamsView } from './views/teamsView.js';
export { renderHallOfFameView } from './views/hallOfFameView.js';
export { renderLoginView } from './views/loginView.js';
export { renderSignUpView } from './views/signUpView.js';
export { renderSettingsView } from './views/settingsView.js';
export { renderDevDashboardView } from './views/devDashboardView.js';
export { renderComponentsTestView } from './views/componentsTestView.js';
export { renderMessagesView } from './views/messagesView.js';
export { renderAnnouncementsView } from './views/announcementsView.js';
export { renderProfileView } from './views/profileView.js';
export { renderForumView } from './views/forumView.js';
export { renderMarketplaceView } from './views/marketplaceView.js';
export { renderCalendarView } from './views/calendarView.js';
export { renderJournalView } from './views/journalView.js';
export { renderAnalyticsView } from './views/analyticsView.js';
export { renderQuizzesView } from './views/quizzesView.js';
export { renderReviewView } from './views/reviewView.js';

const router = new Router('appView');

/**
 * `/p/:slug` is a public page. It must render without a session, so it short
 * circuits before any auth, nav, or stream setup runs.
 */
async function bootPublicProfile(slug) {
  initTheme();
  document.querySelector('.sidebar')?.remove();
  document.querySelector('.topbar')?.remove();
  document.querySelector('.backdrop')?.remove();
  const main = document.querySelector('.main');
  if (main) main.style.marginLeft = '0';
  const mount = document.getElementById('appView');
  const { renderPublicProfile } = await import('./views/publicProfileView.js');
  await renderPublicProfile(slug, mount);
}

function bootApp() {
  const publicMatch = location.pathname.match(/^\/p\/([\w-]+)\/?$/);
  if (publicMatch) {
    bootPublicProfile(publicMatch[1]);
    return;
  }

  initTheme();
  initDrawerNav();
  initNotificationBell();
  initConnectionStatus();
  initCommandPalette();
  initKeyboardShortcuts();

  // Restore the section the user was last in before validating the session,
  // so a reload lands where they left off instead of always on the dashboard.
  const restored = initRouting() || lastView();
  if (restored) store.setState({ activeTab: restored });

  initUserSession();

  document.addEventListener('forge:navigate', (e) => {
    if (e.detail && e.detail.tab) {
      store.setState({ activeTab: e.detail.tab });
    }
  });

  let lastRenderedTab = null;
  store.subscribe((state) => {
    router.renderRoute(state, loadAllData);
    updateUserBadges(state.currentUser);
    applyNavRoleVisibility(state.currentUser);
    if (state.activeTab !== lastRenderedTab) {
      lastRenderedTab = state.activeTab;
      rememberView(state.activeTab);
      syncHash(state.activeTab);
    }
  });

  // Render initial view immediately so page is never empty on load
  router.renderRoute(store.getState(), loadAllData);
  updateUserBadges(store.getState().currentUser);
  applyNavRoleVisibility(store.getState().currentUser);

  loadAllData();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootApp);
} else {
  bootApp();
}

// Live updates: refresh the notification bell whenever the server pushes a
// notification; message events are consumed directly by the messages view.
onStreamEvent(async (event) => {
  if (event.type === 'notification') {
    try {
      await refreshUnreadCount();
    } catch (_) {}
    if (event.notification && event.notification.title) {
      try {
        const { showToast } = await import('./components/toast.js');
        showToast({
          title: event.notification.title,
          message: event.notification.message || '',
          type: 'info'
        });
      } catch (_) {}
    }
  }
});

export async function logoutUser() {
  clearSession();
  disconnectStream();
  store.setState({ currentUser: null, activeTab: 'login' });
}

export async function initUserSession() {
  const token = localStorage.getItem('forge_jwt_token');
  if (token) {
    resetSessionExpiry();
    try {
      const userRes = await fetchCurrentUser();
      if (userRes && userRes.user) {
        localStorage.setItem('forge_user_session', JSON.stringify(userRes.user));
        store.setState({ currentUser: userRes.user });
        connectStream();
        return;
      }
    } catch (e) {
      // A 401 here has already routed to login via the session handler.
      if (e.status !== 401) console.error('Session validation failed:', e);
      return;
    }
  }

  clearSession();
  store.setState({ currentUser: null, activeTab: 'login' });
}

export async function loadAllData() {
  try {
    const [tasksSettled, teamsSettled, hallSettled] = await Promise.allSettled([
      fetchTasks(),
      fetchTeams(),
      fetchHallOfFame()
    ]);

    const tasksData = tasksSettled.status === 'fulfilled' ? tasksSettled.value : store.getState().tasksData;
    const teamsData = teamsSettled.status === 'fulfilled' ? teamsSettled.value : store.getState().teamsData;
    const hallOfFameData = hallSettled.status === 'fulfilled' ? hallSettled.value : store.getState().hallOfFameData;

    store.setState({
      tasksData: tasksData || { teamTasks: [], challenges: [], marketplace: [] },
      teamsData: teamsData || [],
      hallOfFameData: hallOfFameData || { allTime: [], season1: [], titles: [] }
    });
  } catch (err) {
    console.error('Error loading API data:', err);
  }
}
