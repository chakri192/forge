// Complete Task System & Lifecycle View Renderer
import { openModal, closeModal } from '../components/modal.js';
import { showConfirmDialog } from '../components/confirmDialog.js';
import {
  submitTaskProof,
  approveTask,
  createTask,
  updateTask,
  updateTaskStatus,
  deleteTask,
  fetchTaskDetails,
  filterTasks
} from '../services/api.js';

let filterState = {
  search: '',
  status: 'ALL',
  difficulty: 'ALL',
  task_type: 'ALL'
};

export function renderTasksView(state) {
  const { tasksData, currentUser } = state;
  let allTasks = [];

  if (Array.isArray(tasksData)) {
    allTasks = tasksData;
  } else if (tasksData && typeof tasksData === 'object') {
    const teamTasks = tasksData.teamTasks || [];
    const challenges = tasksData.challenges || [];
    const official = tasksData.official || [];
    allTasks = Array.from(new Set([...official, ...teamTasks, ...challenges]));
  }

  const userRole = currentUser ? (currentUser.public_role || currentUser.role) : 'member';
  const isLeaderOrTeacher = ['leader', 'teacher', 'admin', 'DEV_STEALTH', 'STUDENT_LEADER', 'TEACHER'].includes(currentUser ? currentUser.role : '') || ['leader', 'teacher', 'admin', 'STUDENT_LEADER', 'TEACHER'].includes(userRole);

  // Client-side filtering
  const filteredTasks = allTasks.filter(t => {
    if (filterState.status !== 'ALL' && (t.status || '').toLowerCase() !== filterState.status.toLowerCase()) {
      return false;
    }
    if (filterState.difficulty !== 'ALL' && (t.difficulty || 'MEDIUM').toUpperCase() !== filterState.difficulty.toUpperCase()) {
      return false;
    }
    if (filterState.task_type !== 'ALL' && (t.task_type || 'TEAM_TASK').toUpperCase() !== filterState.task_type.toUpperCase()) {
      return false;
    }
    if (filterState.search) {
      const q = filterState.search.toLowerCase();
      const matchTitle = (t.title || '').toLowerCase().includes(q);
      const matchDesc = (t.description || '').toLowerCase().includes(q);
      const matchInst = (t.instructions || '').toLowerCase().includes(q);
      if (!matchTitle && !matchDesc && !matchInst) return false;
    }
    return true;
  });

  const activeCount = allTasks.filter(t => ['active', 'in_progress', 'pending_review', 'pending_approval', 'open'].includes((t.status || '').toLowerCase())).length;
  const completedCount = allTasks.filter(t => (t.status || '').toLowerCase() === 'completed').length;
  const draftCount = allTasks.filter(t => (t.status || '').toLowerCase() === 'draft').length;

  return `
    <div class="space-y-8 max-w-6xl mx-auto">

      <!-- Header Banner -->
      <div class="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-4 border-b border-white/10">
        <div>
          <div class="flex items-center gap-2">
            <span class="px-2.5 py-0.5 rounded-full text-xs font-extrabold uppercase bg-royal-slate-blue/20 text-royal-slate-blue border border-royal-slate-blue/40 accent-target">
              Forge Mission Control
            </span>
          </div>
          <h1 class="text-3xl font-black text-white uppercase tracking-tight mt-1">Task & Mission System</h1>
          <p class="text-xs text-outline mt-1 max-w-2xl">
            Create, manage, track, and complete community tasks and challenges across the full lifecycle.
          </p>
        </div>

        <div class="flex flex-wrap items-center gap-2 text-xs">
          <span class="px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-white font-bold">
            ${activeCount} Active
          </span>
          <span class="px-3 py-1.5 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-bold">
            ${completedCount} Completed
          </span>
          ${draftCount > 0 ? `
            <span class="px-3 py-1.5 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30 font-bold">
              ${draftCount} Drafts
            </span>
          ` : ''}

          ${isLeaderOrTeacher ? `
            <button id="btnCreateTask" class="px-4 py-2 bg-royal-slate-blue hover:bg-royal-slate-blue/80 text-white font-bold text-xs rounded-xl shadow-lg transition-all flex items-center gap-1.5 ml-2">
              <span class="material-symbols-outlined text-sm">add_task</span>
              Create Task
            </button>
          ` : ''}
        </div>
      </div>

      <!-- Filter & Search Toolbar -->
      <div class="glass-card p-4 rounded-2xl border border-white/10 space-y-3">
        <div class="flex flex-col md:flex-row gap-3 items-center justify-between">
          
          <!-- Search Input -->
          <div class="relative w-full md:w-80">
            <span class="material-symbols-outlined absolute left-3 top-2.5 text-outline text-sm">search</span>
            <input type="text" id="taskSearchInput" placeholder="Search tasks by title, brief, or keywords..." value="${escapeHtml(filterState.search)}"
              class="w-full bg-white/5 border border-white/10 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder:text-outline focus:outline-none focus:border-royal-slate-blue" />
          </div>

          <!-- Dropdown Filters -->
          <div class="flex flex-wrap items-center gap-2 w-full md:w-auto">
            
            <!-- Status Filter -->
            <select id="filterStatusSelect" class="bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-royal-slate-blue">
              <option value="ALL" ${filterState.status === 'ALL' ? 'selected' : ''}>Status: All</option>
              <option value="draft" ${filterState.status === 'draft' ? 'selected' : ''}>Draft</option>
              <option value="active" ${filterState.status === 'active' ? 'selected' : ''}>Active</option>
              <option value="in_progress" ${filterState.status === 'in_progress' ? 'selected' : ''}>In Progress</option>
              <option value="pending_review" ${filterState.status === 'pending_review' ? 'selected' : ''}>Pending Review</option>
              <option value="completed" ${filterState.status === 'completed' ? 'selected' : ''}>Completed</option>
              <option value="archived" ${filterState.status === 'archived' ? 'selected' : ''}>Archived</option>
            </select>

            <!-- Difficulty Filter -->
            <select id="filterDifficultySelect" class="bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-royal-slate-blue">
              <option value="ALL" ${filterState.difficulty === 'ALL' ? 'selected' : ''}>Difficulty: All</option>
              <option value="EASY" ${filterState.difficulty === 'EASY' ? 'selected' : ''}>Easy</option>
              <option value="MEDIUM" ${filterState.difficulty === 'MEDIUM' ? 'selected' : ''}>Medium</option>
              <option value="HARD" ${filterState.difficulty === 'HARD' ? 'selected' : ''}>Hard</option>
              <option value="EXPERT" ${filterState.difficulty === 'EXPERT' ? 'selected' : ''}>Expert</option>
            </select>

            <!-- Task Type Filter -->
            <select id="filterTaskTypeSelect" class="bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-royal-slate-blue">
              <option value="ALL" ${filterState.task_type === 'ALL' ? 'selected' : ''}>Type: All</option>
              <option value="TEAM_TASK" ${filterState.task_type === 'TEAM_TASK' ? 'selected' : ''}>Team Task</option>
              <option value="CHALLENGE" ${filterState.task_type === 'CHALLENGE' ? 'selected' : ''}>Challenge</option>
            </select>

            ${(filterState.search || filterState.status !== 'ALL' || filterState.difficulty !== 'ALL' || filterState.task_type !== 'ALL') ? `
              <button id="btnResetFilters" class="px-3 py-2 text-xs text-amber-400 hover:text-amber-300 font-semibold flex items-center gap-1">
                <span class="material-symbols-outlined text-sm">restart_alt</span> Reset
              </button>
            ` : ''}

          </div>
        </div>
      </div>

      <!-- Tasks Grid -->
      <div class="space-y-4">
        ${filteredTasks.length === 0 ? `
          <div class="glass-card p-12 rounded-2xl text-center space-y-2">
            <span class="material-symbols-outlined text-4xl text-outline">assignment_late</span>
            <p class="text-sm font-bold text-white">No tasks match your filters</p>
            <p class="text-xs text-outline max-w-md mx-auto">Try clearing search terms or status filters to see existing community objectives.</p>
          </div>
        ` : `
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            ${filteredTasks.map(t => renderTaskCard(t, isLeaderOrTeacher)).join('')}
          </div>
        `}
      </div>

    </div>
  `;
}

function getDifficultyBadgeClass(difficulty) {
  switch ((difficulty || 'MEDIUM').toUpperCase()) {
    case 'EASY':
      return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
    case 'HARD':
      return 'bg-amber-500/20 text-amber-400 border-amber-500/30';
    case 'EXPERT':
      return 'bg-rose-500/20 text-rose-400 border-rose-500/30';
    case 'MEDIUM':
    default:
      return 'bg-sky-500/20 text-sky-400 border-sky-500/30';
  }
}

function getStatusBadgeClass(status) {
  switch ((status || 'active').toLowerCase()) {
    case 'completed':
      return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
    case 'pending_review':
    case 'pending_approval':
      return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
    case 'in_progress':
      return 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30';
    case 'draft':
      return 'bg-gray-500/20 text-gray-300 border-gray-500/30';
    case 'archived':
      return 'bg-rose-900/30 text-rose-300 border-rose-700/30';
    case 'active':
    case 'open':
    default:
      return 'bg-royal-slate-blue/20 text-royal-slate-blue border-royal-slate-blue/40';
  }
}

function renderTaskCard(t, isLeaderOrTeacher) {
  const status = (t.status || 'active').toLowerCase();
  const diffClass = getDifficultyBadgeClass(t.difficulty);
  const statusClass = getStatusBadgeClass(t.status);

  return `
    <div class="glass-card p-6 rounded-2xl space-y-4 border border-white/10 hover:border-royal-slate-blue/40 transition-all flex flex-col justify-between">
      <div class="space-y-3">
        
        <!-- Header Badges -->
        <div class="flex flex-wrap items-center justify-between gap-2">
          <div class="flex flex-wrap items-center gap-1.5">
            <span class="px-2.5 py-0.5 text-[10px] font-black rounded uppercase border ${statusClass}">
              ${escapeHtml(status.replace('_', ' '))}
            </span>
            <span class="px-2 py-0.5 text-[10px] font-black rounded uppercase border ${diffClass}">
              ${escapeHtml(t.difficulty || 'MEDIUM')}
            </span>
            <span class="px-2 py-0.5 text-[10px] font-extrabold rounded bg-white/5 text-outline uppercase border border-white/10">
              ${escapeHtml(t.task_type || 'TEAM_TASK')}
            </span>
          </div>

          <div class="flex items-center gap-2">
            <span class="text-xs font-black text-white bg-white/10 px-2.5 py-1 rounded-xl border border-white/10">
              ${t.total_points || 50} PTS
            </span>
            ${t.xp_reward ? `
              <span class="text-xs font-black text-amber-400 bg-amber-400/10 px-2.5 py-1 rounded-xl border border-amber-400/20">
                +${t.xp_reward} XP
              </span>
            ` : ''}
          </div>
        </div>

        <!-- Task Title & Description -->
        <div>
          <h3 class="text-lg font-bold text-white leading-snug hover:text-royal-slate-blue transition-colors cursor-pointer btn-view-details" data-id="${t.id}">
            ${escapeHtml(t.title)}
          </h3>
          <p class="text-xs text-outline mt-1 line-clamp-3 leading-relaxed">
            ${escapeHtml(t.description)}
          </p>
        </div>

        <!-- Meta info -->
        <div class="pt-2 border-t border-white/5 grid grid-cols-2 gap-2 text-[11px] text-outline">
          <div>
            <span class="block font-semibold">Scope / Assigned:</span>
            <span class="text-white font-medium">${escapeHtml(t.assigned_team_name ? `Squad: ${t.assigned_team_name}` : t.assigned_user_name ? `User: ${t.assigned_user_name}` : 'Open Objective')}</span>
          </div>
          <div>
            <span class="block font-semibold">Deadline:</span>
            <span class="text-white font-medium">${t.deadline ? new Date(t.deadline).toLocaleDateString() : 'No hard deadline'}</span>
          </div>
        </div>
      </div>

      <!-- Footer Buttons -->
      <div class="pt-3 border-t border-white/5 flex flex-wrap items-center justify-between gap-2">
        <button class="btn-view-details px-3 py-1.5 bg-white/5 hover:bg-white/10 text-white font-bold text-xs rounded-xl border border-white/10 transition-all" data-id="${t.id}">
          View Details
        </button>

        <div class="flex flex-wrap items-center gap-1.5">
          ${status !== 'completed' && status !== 'archived' ? `
            <button class="btn-submit-task px-3 py-1.5 bg-royal-slate-blue hover:bg-royal-slate-blue/80 text-white font-bold text-xs rounded-xl transition-all" data-id="${t.id}">
              Submit Proof
            </button>
          ` : ''}

          ${isLeaderOrTeacher ? `
            <button class="btn-edit-task p-1.5 bg-white/5 hover:bg-white/15 text-outline hover:text-white rounded-xl transition-all" data-id="${t.id}" title="Edit Task">
              <span class="material-symbols-outlined text-base">edit</span>
            </button>
            <button class="btn-delete-task p-1.5 bg-rose-500/10 hover:bg-rose-500/30 text-rose-400 rounded-xl transition-all" data-id="${t.id}" title="Delete Task">
              <span class="material-symbols-outlined text-base">delete</span>
            </button>
          ` : ''}
        </div>
      </div>
    </div>
  `;
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function attachTasksEvents(state, refreshData) {
  const currentUserId = state.currentUser ? state.currentUser.id : null;

  // Filter change handlers
  const searchInput = document.getElementById('taskSearchInput');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      filterState.search = e.target.value;
      renderAndReattach(state, refreshData);
    });
  }

  const statusSelect = document.getElementById('filterStatusSelect');
  if (statusSelect) {
    statusSelect.addEventListener('change', (e) => {
      filterState.status = e.target.value;
      renderAndReattach(state, refreshData);
    });
  }

  const diffSelect = document.getElementById('filterDifficultySelect');
  if (diffSelect) {
    diffSelect.addEventListener('change', (e) => {
      filterState.difficulty = e.target.value;
      renderAndReattach(state, refreshData);
    });
  }

  const typeSelect = document.getElementById('filterTaskTypeSelect');
  if (typeSelect) {
    typeSelect.addEventListener('change', (e) => {
      filterState.task_type = e.target.value;
      renderAndReattach(state, refreshData);
    });
  }

  const btnReset = document.getElementById('btnResetFilters');
  if (btnReset) {
    btnReset.addEventListener('click', () => {
      filterState = { search: '', status: 'ALL', difficulty: 'ALL', task_type: 'ALL' };
      renderAndReattach(state, refreshData);
    });
  }

  // Create Task button handler
  const btnCreate = document.getElementById('btnCreateTask');
  if (btnCreate) {
    btnCreate.addEventListener('click', () => {
      openTaskFormModal(null, refreshData);
    });
  }

  // View Details handler
  document.querySelectorAll('.btn-view-details').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const taskId = e.currentTarget.getAttribute('data-id');
      try {
        const res = await fetchTaskDetails(taskId);
        if (res && res.task) {
          openTaskDetailModal(res.task, state, refreshData);
        }
      } catch (err) {
        console.error('Error fetching task details:', err);
      }
    });
  });

  // Edit Task handler
  document.querySelectorAll('.btn-edit-task').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const taskId = e.currentTarget.getAttribute('data-id');
      try {
        const res = await fetchTaskDetails(taskId);
        if (res && res.task) {
          openTaskFormModal(res.task, refreshData);
        }
      } catch (err) {
        console.error('Error fetching task for edit:', err);
      }
    });
  });

  // Delete Task handler
  document.querySelectorAll('.btn-delete-task').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const taskId = e.currentTarget.getAttribute('data-id');
      const confirmed = await showConfirmDialog({
        title: 'Delete Task?',
        message: 'Are you sure you want to permanently delete this task? This action cannot be undone.',
        confirmText: 'Delete',
        danger: true
      });
      if (confirmed) {
        try {
          await deleteTask(taskId);
          refreshData();
        } catch (err) {
          console.error('Error deleting task:', err);
        }
      }
    });
  });

  // Submit Proof handler
  document.querySelectorAll('.btn-submit-task').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const taskId = e.currentTarget.getAttribute('data-id');
      openModal({
        title: 'Submit Task Deliverable Proof',
        contentHtml: `
          <div class="space-y-4 text-xs">
            <div>
              <label class="block font-bold text-white uppercase tracking-wider mb-1">Deliverable Notes & Links</label>
              <textarea id="modalProofNotes" rows="3" class="w-full bg-white/5 border border-white/15 rounded-xl px-3 py-2 text-sm text-white focus:border-royal-slate-blue focus:outline-none" placeholder="Enter pull request link, documentation URL, or summary notes..."></textarea>
            </div>
            <div>
              <label class="block font-bold text-white uppercase tracking-wider mb-1">Upload Proof File (Optional)</label>
              <input type="file" id="modalProofFile" class="w-full text-xs text-white" />
            </div>
          </div>
        `,
        onConfirm: async (overlay) => {
          const proof_notes = overlay.querySelector('#modalProofNotes').value.trim();
          const fileInput = overlay.querySelector('#modalProofFile');
          const formData = new FormData();
          if (currentUserId) formData.append('submitted_by', currentUserId);
          formData.append('proof_notes', proof_notes);
          if (fileInput.files[0]) {
            formData.append('proof_file', fileInput.files[0]);
          }

          await submitTaskProof(taskId, formData);
          refreshData();
          return true;
        }
      });
    });
  });
}

function renderAndReattach(state, refreshData) {
  const container = document.getElementById('viewContent');
  if (container) {
    container.innerHTML = renderTasksView(state);
    attachTasksEvents(state, refreshData);
  }
}

// Open Task Form Modal (Create or Edit)
function openTaskFormModal(taskToEdit, refreshData) {
  const isEdit = !!taskToEdit;
  const titleText = isEdit ? `Edit Task: ${escapeHtml(taskToEdit.title)}` : 'Create New Task & Mission';

  const contentHtml = `
    <div class="space-y-4 text-xs max-h-[70vh] overflow-y-auto pr-1">
      <div>
        <label class="block font-bold text-white mb-1">Task Title *</label>
        <input type="text" id="formTitle" value="${escapeHtml(taskToEdit ? taskToEdit.title : '')}" placeholder="e.g., Build Authentication Microservice"
          class="w-full bg-white/5 border border-white/15 rounded-xl px-3 py-2 text-sm text-white focus:border-royal-slate-blue focus:outline-none" />
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <label class="block font-bold text-white mb-1">Difficulty</label>
          <select id="formDifficulty" class="w-full bg-white/5 border border-white/15 rounded-xl px-3 py-2 text-white focus:border-royal-slate-blue focus:outline-none">
            <option value="EASY" ${(taskToEdit ? taskToEdit.difficulty : '') === 'EASY' ? 'selected' : ''}>Easy</option>
            <option value="MEDIUM" ${(taskToEdit ? taskToEdit.difficulty : 'MEDIUM') === 'MEDIUM' ? 'selected' : ''}>Medium</option>
            <option value="HARD" ${(taskToEdit ? taskToEdit.difficulty : '') === 'HARD' ? 'selected' : ''}>Hard</option>
            <option value="EXPERT" ${(taskToEdit ? taskToEdit.difficulty : '') === 'EXPERT' ? 'selected' : ''}>Expert</option>
          </select>
        </div>
        <div>
          <label class="block font-bold text-white mb-1">Task Type</label>
          <select id="formTaskType" class="w-full bg-white/5 border border-white/15 rounded-xl px-3 py-2 text-white focus:border-royal-slate-blue focus:outline-none">
            <option value="TEAM_TASK" ${(taskToEdit ? taskToEdit.task_type : 'TEAM_TASK') === 'TEAM_TASK' ? 'selected' : ''}>Team Task</option>
            <option value="CHALLENGE" ${(taskToEdit ? taskToEdit.task_type : '') === 'CHALLENGE' ? 'selected' : ''}>Challenge</option>
          </select>
        </div>
        <div>
          <label class="block font-bold text-white mb-1">Status</label>
          <select id="formStatus" class="w-full bg-white/5 border border-white/15 rounded-xl px-3 py-2 text-white focus:border-royal-slate-blue focus:outline-none">
            <option value="active" ${(taskToEdit ? taskToEdit.status : 'active') === 'active' ? 'selected' : ''}>Active</option>
            <option value="draft" ${(taskToEdit ? taskToEdit.status : '') === 'draft' ? 'selected' : ''}>Draft</option>
            <option value="in_progress" ${(taskToEdit ? taskToEdit.status : '') === 'in_progress' ? 'selected' : ''}>In Progress</option>
            <option value="pending_review" ${(taskToEdit ? taskToEdit.status : '') === 'pending_review' ? 'selected' : ''}>Pending Review</option>
            <option value="completed" ${(taskToEdit ? taskToEdit.status : '') === 'completed' ? 'selected' : ''}>Completed</option>
            <option value="archived" ${(taskToEdit ? taskToEdit.status : '') === 'archived' ? 'selected' : ''}>Archived</option>
          </select>
        </div>
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <label class="block font-bold text-white mb-1">Points Reward</label>
          <input type="number" id="formTotalPoints" value="${taskToEdit ? (taskToEdit.total_points || 50) : 50}"
            class="w-full bg-white/5 border border-white/15 rounded-xl px-3 py-2 text-white focus:border-royal-slate-blue focus:outline-none" />
        </div>
        <div>
          <label class="block font-bold text-white mb-1">XP Reward</label>
          <input type="number" id="formXpReward" value="${taskToEdit ? (taskToEdit.xp_reward || 0) : 100}"
            class="w-full bg-white/5 border border-white/15 rounded-xl px-3 py-2 text-white focus:border-royal-slate-blue focus:outline-none" />
        </div>
        <div>
          <label class="block font-bold text-white mb-1">Badge Reward</label>
          <input type="text" id="formBadgeReward" value="${escapeHtml(taskToEdit ? taskToEdit.badge_reward || '' : '')}" placeholder="e.g. Master Coder"
            class="w-full bg-white/5 border border-white/15 rounded-xl px-3 py-2 text-white focus:border-royal-slate-blue focus:outline-none" />
        </div>
      </div>

      <div>
        <label class="block font-bold text-white mb-1">Deadline Date & Time</label>
        <input type="datetime-local" id="formDeadline" value="${taskToEdit && taskToEdit.deadline ? new Date(taskToEdit.deadline).toISOString().slice(0, 16) : ''}"
          class="w-full bg-white/5 border border-white/15 rounded-xl px-3 py-2 text-white focus:border-royal-slate-blue focus:outline-none" />
      </div>

      <div>
        <label class="block font-bold text-white mb-1">Description / Summary *</label>
        <textarea id="formDescription" rows="2" placeholder="Brief summary of task objectives..."
          class="w-full bg-white/5 border border-white/15 rounded-xl px-3 py-2 text-white focus:border-royal-slate-blue focus:outline-none">${escapeHtml(taskToEdit ? taskToEdit.description : '')}</textarea>
      </div>

      <div>
        <label class="block font-bold text-white mb-1">Detailed Instructions</label>
        <textarea id="formInstructions" rows="3" placeholder="Step-by-step instructions and technical details..."
          class="w-full bg-white/5 border border-white/15 rounded-xl px-3 py-2 text-white focus:border-royal-slate-blue focus:outline-none">${escapeHtml(taskToEdit ? taskToEdit.instructions || '' : '')}</textarea>
      </div>

      <div>
        <label class="block font-bold text-white mb-1">Resource Attachments & Links</label>
        <textarea id="formResources" rows="2" placeholder="Resource URLs or links (newline separated)..."
          class="w-full bg-white/5 border border-white/15 rounded-xl px-3 py-2 text-white focus:border-royal-slate-blue focus:outline-none">${escapeHtml(taskToEdit ? taskToEdit.resources || '' : '')}</textarea>
      </div>

      <div>
        <label class="block font-bold text-white mb-1">Proof & Verification Requirements</label>
        <textarea id="formProofRequirements" rows="2" placeholder="Specify required deliverables (e.g. GitHub PR link, demo video, test coverage report)..."
          class="w-full bg-white/5 border border-white/15 rounded-xl px-3 py-2 text-white focus:border-royal-slate-blue focus:outline-none">${escapeHtml(taskToEdit ? taskToEdit.proof_requirements || '' : '')}</textarea>
      </div>
    </div>
  `;

  openModal({
    title: titleText,
    contentHtml,
    onConfirm: async (overlay) => {
      const title = overlay.querySelector('#formTitle').value.trim();
      const description = overlay.querySelector('#formDescription').value.trim();
      if (!title || !description) {
        alert('Title and description are required.');
        return false;
      }

      const payload = {
        title,
        description,
        difficulty: overlay.querySelector('#formDifficulty').value,
        task_type: overlay.querySelector('#formTaskType').value,
        status: overlay.querySelector('#formStatus').value,
        total_points: parseInt(overlay.querySelector('#formTotalPoints').value) || 50,
        xp_reward: parseInt(overlay.querySelector('#formXpReward').value) || 0,
        badge_reward: overlay.querySelector('#formBadgeReward').value.trim() || null,
        deadline: overlay.querySelector('#formDeadline').value || null,
        instructions: overlay.querySelector('#formInstructions').value.trim() || null,
        resources: overlay.querySelector('#formResources').value.trim() || null,
        proof_requirements: overlay.querySelector('#formProofRequirements').value.trim() || null
      };

      try {
        if (isEdit) {
          await updateTask(taskToEdit.id, payload);
        } else {
          await createTask(payload);
        }
        refreshData();
        return true;
      } catch (err) {
        console.error('Error saving task:', err);
        return false;
      }
    }
  });
}

// Open Detailed Task View Modal
function openTaskDetailModal(task, state, refreshData) {
  const userRole = state.currentUser ? (state.currentUser.public_role || state.currentUser.role) : 'member';
  const isLeaderOrTeacher = ['leader', 'teacher', 'admin', 'DEV_STEALTH', 'STUDENT_LEADER', 'TEACHER'].includes(state.currentUser ? state.currentUser.role : '') || ['leader', 'teacher', 'admin', 'STUDENT_LEADER', 'TEACHER'].includes(userRole);

  const status = (task.status || 'active').toLowerCase();
  const statusClass = getStatusBadgeClass(task.status);
  const diffClass = getDifficultyBadgeClass(task.difficulty);

  // Format resource links
  let resourcesHtml = '<p class="text-outline italic">No resources attached.</p>';
  if (task.resources) {
    const lines = task.resources.split('\n').map(l => l.trim()).filter(Boolean);
    resourcesHtml = `
      <ul class="space-y-1.5">
        ${lines.map(res => {
          const isUrl = res.startsWith('http://') || res.startsWith('https://') || res.startsWith('/');
          if (isUrl) {
            return `
              <li class="flex items-center gap-1.5 text-royal-slate-blue hover:underline">
                <span class="material-symbols-outlined text-sm">link</span>
                <a href="${escapeHtml(res)}" target="_blank" rel="noopener noreferrer" class="break-all font-semibold">${escapeHtml(res)}</a>
              </li>
            `;
          }
          return `
            <li class="flex items-center gap-1.5 text-white/90">
              <span class="material-symbols-outlined text-sm text-outline">description</span>
              <span>${escapeHtml(res)}</span>
            </li>
          `;
        }).join('')}
      </ul>
    `;
  }

  // Format Submissions
  let submissionsHtml = '<p class="text-outline italic">No submissions recorded yet.</p>';
  if (task.submissions && task.submissions.length > 0) {
    submissionsHtml = `
      <div class="space-y-2">
        ${task.submissions.map(sub => `
          <div class="p-3 rounded-xl bg-white/5 border border-white/10 space-y-1 text-xs">
            <div class="flex justify-between items-center text-white">
              <span class="font-bold">${escapeHtml(sub.submitter_name || 'Member')}</span>
              <span class="text-[10px] text-outline">${new Date(sub.created_at).toLocaleString()}</span>
            </div>
            ${sub.proof_notes ? `<p class="text-white/80">${escapeHtml(sub.proof_notes)}</p>` : ''}
            ${sub.proof_url ? `
              <a href="${escapeHtml(sub.proof_url)}" target="_blank" class="inline-flex items-center gap-1 text-emerald-400 hover:underline font-bold text-[11px]">
                <span class="material-symbols-outlined text-xs">download</span> View Deliverable File
              </a>
            ` : ''}
          </div>
        `).join('')}
      </div>
    `;
  }

  const contentHtml = `
    <div class="space-y-6 text-xs max-h-[75vh] overflow-y-auto pr-2">
      
      <!-- Top Overview Badges -->
      <div class="flex flex-wrap items-center justify-between gap-3 p-4 rounded-2xl bg-white/5 border border-white/10">
        <div class="flex flex-wrap items-center gap-2">
          <span id="detailStatusBadge" class="px-3 py-1 rounded-xl text-xs font-black uppercase border ${statusClass}">
            ${escapeHtml(status.replace('_', ' '))}
          </span>
          <span class="px-3 py-1 rounded-xl text-xs font-black uppercase border ${diffClass}">
            ${escapeHtml(task.difficulty || 'MEDIUM')}
          </span>
          <span class="px-3 py-1 rounded-xl text-xs font-bold bg-white/5 text-white border border-white/10">
            ${escapeHtml(task.task_type || 'TEAM_TASK')}
          </span>
        </div>

        <div class="flex items-center gap-3">
          <span class="text-sm font-black text-white bg-white/10 px-3 py-1.5 rounded-xl border border-white/10">
            ${task.total_points || 50} PTS
          </span>
          ${task.xp_reward ? `
            <span class="text-sm font-black text-amber-400 bg-amber-400/10 px-3 py-1.5 rounded-xl border border-amber-400/20">
              +${task.xp_reward} XP
            </span>
          ` : ''}
          ${task.badge_reward ? `
            <span class="text-xs font-bold text-purple-400 bg-purple-400/10 px-3 py-1.5 rounded-xl border border-purple-400/20 flex items-center gap-1">
              <span class="material-symbols-outlined text-sm">workspace_premium</span> ${escapeHtml(task.badge_reward)}
            </span>
          ` : ''}
        </div>
      </div>

      <!-- Description & Background -->
      <div class="space-y-1.5">
        <h4 class="text-xs font-bold text-ice-blue uppercase tracking-wider flex items-center gap-1.5">
          <span class="material-symbols-outlined text-sm">info</span> Description & Overview
        </h4>
        <p class="text-white/90 leading-relaxed text-xs p-3 rounded-xl bg-white/5 border border-white/5">
          ${escapeHtml(task.description)}
        </p>
      </div>

      <!-- Detailed Instructions -->
      <div class="space-y-1.5">
        <h4 class="text-xs font-bold text-ice-blue uppercase tracking-wider flex items-center gap-1.5">
          <span class="material-symbols-outlined text-sm">assignment</span> Detailed Instructions
        </h4>
        <div class="text-white/90 leading-relaxed text-xs p-3 rounded-xl bg-white/5 border border-white/5 whitespace-pre-wrap">
          ${task.instructions ? escapeHtml(task.instructions) : '<p class="text-outline italic">No detailed step-by-step instructions provided.</p>'}
        </div>
      </div>

      <!-- Resources & Attachments -->
      <div class="space-y-1.5">
        <h4 class="text-xs font-bold text-ice-blue uppercase tracking-wider flex items-center gap-1.5">
          <span class="material-symbols-outlined text-sm">attach_file</span> Resource Attachments
        </h4>
        <div class="p-3 rounded-xl bg-white/5 border border-white/5">
          ${resourcesHtml}
        </div>
      </div>

      <!-- Proof Requirements -->
      <div class="space-y-1.5">
        <h4 class="text-xs font-bold text-ice-blue uppercase tracking-wider flex items-center gap-1.5">
          <span class="material-symbols-outlined text-sm">verified_user</span> Proof & Deliverable Requirements
        </h4>
        <div class="text-white/90 leading-relaxed text-xs p-3 rounded-xl bg-white/5 border border-white/5 whitespace-pre-wrap">
          ${task.proof_requirements ? escapeHtml(task.proof_requirements) : '<p class="text-outline italic">Standard deliverable proof (notes/artifacts) required upon completion.</p>'}
        </div>
      </div>

      <!-- Submissions History -->
      <div class="space-y-1.5">
        <h4 class="text-xs font-bold text-ice-blue uppercase tracking-wider flex items-center gap-1.5">
          <span class="material-symbols-outlined text-sm">folder_zip</span> Submissions & Proof History
        </h4>
        ${submissionsHtml}
      </div>

      <!-- State Transition Controls (for Leaders/Admins) -->
      ${isLeaderOrTeacher ? `
        <div class="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-2">
          <h4 class="text-xs font-bold text-white uppercase tracking-wider">Lifecycle Status Control</h4>
          <div class="flex flex-wrap items-center gap-2">
            ${renderStatusTransitionButtons(task)}
          </div>
        </div>
      ` : ''}

    </div>
  `;

  openModal({
    title: `Task Details: ${escapeHtml(task.title)}`,
    contentHtml,
    onConfirm: async () => {
      closeModal();
      return true;
    }
  });

  // Attach status transition button events inside the modal
  document.querySelectorAll('.btn-transition-status').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const newStatus = e.currentTarget.getAttribute('data-status');
      try {
        await updateTaskStatus(task.id, newStatus);
        closeModal();
        refreshData();
      } catch (err) {
        console.error('Failed to update status:', err);
      }
    });
  });
}

function renderStatusTransitionButtons(task) {
  const current = (task.status || 'active').toLowerCase();
  const transitions = {
    draft: [{ label: 'Activate Task', status: 'active', color: 'bg-royal-slate-blue' }, { label: 'Archive', status: 'archived', color: 'bg-rose-600' }],
    active: [{ label: 'Start Progress', status: 'in_progress', color: 'bg-indigo-600' }, { label: 'Archive', status: 'archived', color: 'bg-rose-600' }],
    open: [{ label: 'Start Progress', status: 'in_progress', color: 'bg-indigo-600' }, { label: 'Archive', status: 'archived', color: 'bg-rose-600' }],
    in_progress: [{ label: 'Submit for Review', status: 'pending_review', color: 'bg-yellow-600' }, { label: 'Archive', status: 'archived', color: 'bg-rose-600' }],
    pending_review: [{ label: 'Mark Completed', status: 'completed', color: 'bg-emerald-600' }, { label: 'Request Revision', status: 'in_progress', color: 'bg-indigo-600' }, { label: 'Archive', status: 'archived', color: 'bg-rose-600' }],
    pending_approval: [{ label: 'Mark Completed', status: 'completed', color: 'bg-emerald-600' }, { label: 'Request Revision', status: 'in_progress', color: 'bg-indigo-600' }, { label: 'Archive', status: 'archived', color: 'bg-rose-600' }],
    completed: [{ label: 'Archive Task', status: 'archived', color: 'bg-rose-600' }],
    archived: [{ label: 'Re-activate', status: 'active', color: 'bg-royal-slate-blue' }, { label: 'Revert to Draft', status: 'draft', color: 'bg-gray-600' }]
  };

  const list = transitions[current] || [];
  if (list.length === 0) return '<span class="text-outline">No transitions available.</span>';

  return list.map(item => `
    <button class="btn-transition-status px-3 py-1.5 ${item.color} hover:opacity-90 text-white font-bold text-xs rounded-xl shadow transition-all" data-status="${item.status}">
      ${item.label}
    </button>
  `).join('');
}
