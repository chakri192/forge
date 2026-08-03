// Main ES Module Entry Point
import { store } from './state/store.js';
import { fetchCurrentUser, fetchTasks, fetchTeams, fetchHallOfFame } from './services/api.js';
import { initDrawerNav } from './components/drawer.js';
import { updateUserBadges } from './components/userBadges.js';
import { initNotificationBell } from './components/notificationBell.js';
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

const router = new Router('appView');

function bootApp() {
  initDrawerNav();
  initNotificationBell();
  initUserSession();

  document.addEventListener('forge:navigate', (e) => {
    if (e.detail && e.detail.tab) {
      store.setState({ activeTab: e.detail.tab });
    }
  });

  store.subscribe((state) => {
    router.renderRoute(state, loadAllData);
    updateUserBadges(state.currentUser);
  });

  // Render initial view immediately so page is never empty on load
  router.renderRoute(store.getState(), loadAllData);
  updateUserBadges(store.getState().currentUser);

  loadAllData();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootApp);
} else {
  bootApp();
}

export async function logoutUser() {
  localStorage.removeItem('forge_jwt_token');
  localStorage.removeItem('forge_user_session');
  store.setState({ currentUser: null, activeTab: 'login' });
}

export async function initUserSession() {
  const token = localStorage.getItem('forge_jwt_token');
  if (token) {
    try {
      const userRes = await fetchCurrentUser();
      if (userRes && userRes.user) {
        localStorage.setItem('forge_user_session', JSON.stringify(userRes.user));
        store.setState({ currentUser: userRes.user });
        return;
      }
    } catch (e) {
      console.error('Session validation failed:', e);
    }
  }

  localStorage.removeItem('forge_jwt_token');
  localStorage.removeItem('forge_user_session');
  store.setState({ currentUser: null });
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
