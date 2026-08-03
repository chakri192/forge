import { renderDashboard, attachDashboardEvents } from '../views/dashboardView.js';
import { renderTasksView, attachTasksEvents } from '../views/tasksView.js';
import { renderChallengesView, attachChallengesEvents } from '../views/challengesView.js';
import { renderTeamsView, attachTeamsEvents } from '../views/teamsView.js';
import { renderHallOfFameView, attachHallOfFameEvents } from '../views/hallOfFameView.js';
import { renderLoginView, attachLoginEvents } from '../views/loginView.js';
import { renderSignUpView, attachSignUpEvents } from '../views/signUpView.js';
import { renderSettingsView, attachSettingsEvents } from '../views/settingsView.js';
import { renderDevDashboardView, attachDevDashboardEvents } from '../views/devDashboardView.js';
import { renderComponentsTestView, attachComponentsTestEvents } from '../views/componentsTestView.js';
import { updateActiveNavHighlight } from '../components/drawer.js';

const routes = {
  dashboard: { render: renderDashboard, attach: attachDashboardEvents },
  tasks: { render: renderTasksView, attach: attachTasksEvents },
  challenges: { render: renderChallengesView, attach: attachChallengesEvents },
  teams: { render: renderTeamsView, attach: attachTeamsEvents },
  halloffame: { render: renderHallOfFameView, attach: attachHallOfFameEvents },
  login: { render: renderLoginView, attach: attachLoginEvents },
  signup: { render: renderSignUpView, attach: attachSignUpEvents },
  settings: { render: renderSettingsView, attach: attachSettingsEvents },
  devdashboard: { render: renderDevDashboardView, attach: attachDevDashboardEvents },
  componentstest: { render: renderComponentsTestView, attach: attachComponentsTestEvents }
};

export class Router {
  constructor(appViewId = 'appView') {
    this.appViewId = appViewId;
  }

  renderRoute(state, reloadDataFn) {
    const appView = document.getElementById(this.appViewId);
    if (!appView) return;

    const activeTab = state.activeTab || 'dashboard';
    const route = routes[activeTab] || routes.dashboard;

    updateActiveNavHighlight(activeTab);

    try {
      appView.innerHTML = route.render(state);
      if (route.attach) {
        route.attach(state, reloadDataFn);
      }
    } catch (err) {
      console.error('Error rendering app view:', err);
      appView.innerHTML = `
        <div class="glass-card p-8 rounded-2xl text-center space-y-4">
          <h2 class="text-xl font-bold text-red-400">Rendering Exception</h2>
          <p class="text-xs text-outline">${err.message || 'An error occurred while loading the view.'}</p>
          <button onclick="location.reload()" class="px-4 py-2 bg-royal-slate-blue text-white rounded-xl font-bold text-xs">Reload Application</button>
        </div>
      `;
    }
  }
}
