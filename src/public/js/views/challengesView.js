// Challenges are tasks with task_type = 'CHALLENGE'. They live inside the Tasks
// view as a labelled section with its own filter, so this module is only a
// redirect shim kept so old links and the router entry keep working.
import { store } from '../state/store.js';

export function renderChallengesView() {
  return `
    <div class="glass-card rounded-2xl p-10 text-center space-y-3 max-w-lg mx-auto">
      <span class="material-symbols-outlined text-4xl accent-target" aria-hidden="true">bolt</span>
      <h2 class="text-lg font-bold">Challenges moved into Tasks</h2>
      <p class="text-xs text-outline">They are now a section of the Tasks board, so everything you can do with a task works on a challenge too.</p>
      <button id="btnGoToChallenges" class="btn btn--primary">
        Open Tasks
      </button>
    </div>`;
}

export function attachChallengesEvents() {
  document.getElementById('btnGoToChallenges')?.addEventListener('click', () => {
    store.setState({ activeTab: 'tasks' });
  });
}
