// Teams View Renderer (Glassmorphism Deep Obsidian Theme)
import { openModal } from '../components/modal.js';
import { overridePoints, dissolveTeam, createTeam } from '../services/api.js';

export function renderTeamsView(state) {
  const { teamsData, currentUser } = state;
  const userRole = currentUser ? (currentUser.public_role || currentUser.role) : 'member';
  const isLeaderOrTeacher = ['leader', 'teacher', 'admin', 'DEV_STEALTH', 'STUDENT_LEADER', 'TEACHER'].includes(currentUser ? currentUser.role : '') || ['leader', 'teacher', 'admin', 'STUDENT_LEADER', 'TEACHER'].includes(userRole);


  return `
    <div class="space-y-8">
      
      <!-- Top Header -->
      <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-4 border-b border-white/10">
        <div>
          <h1 class="text-2xl font-black text-white flex items-center gap-2 tracking-tight uppercase">
            <span class="material-symbols-outlined text-royal-slate-blue text-3xl">groups</span>
            Community Squads & Captains
          </h1>
          <p class="text-xs text-outline mt-1">
            4-member cohort squads. Squad captains defend completed tasks and adjust member contribution shares.
          </p>
        </div>

        ${isLeaderOrTeacher ? `
          <button id="btnCreateTeam" class="px-4 py-2.5 bg-royal-slate-blue hover:bg-royal-slate-blue/80 text-white font-semibold text-xs rounded-lg flex items-center gap-2 shadow-lg transition-all btn-spring-fill">
            <span class="material-symbols-outlined text-sm">group_add</span>
            Create New Squad
          </button>
        ` : ''}
      </div>

      <!-- Teams Grid -->
      ${teamsData.length === 0 ? `
        <div class="glass-card p-10 rounded-xl text-center space-y-3">
          <span class="material-symbols-outlined text-5xl text-outline">diversity_3</span>
          <h3 class="font-bold text-lg text-white">No Active Squads</h3>
          <p class="text-xs text-outline max-w-md mx-auto">
            All teams are currently dissolved. Student Leaders or Teachers can create new 4-member squads above!
          </p>
        </div>
      ` : `
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
          ${teamsData.map(t => renderTeamCard(t, currentUser, isLeaderOrTeacher)).join('')}
        </div>
      `}

    </div>
  `;
}

function renderTeamCard(t, currentUser, isLeaderOrTeacher) {
  const currentUserId = currentUser ? currentUser.id : null;
  const isCaptain = currentUserId && t.captain_id === currentUserId;
  const canManage = isCaptain || isLeaderOrTeacher;

  return `
    <div class="glass-card p-6 rounded-xl space-y-5 flex flex-col justify-between">
      
      <!-- Card Header -->
      <div class="space-y-3">
        <div class="flex justify-between items-start">
          <div>
            <h2 class="text-xl font-bold text-white flex items-center gap-2">
              <span class="material-symbols-outlined text-royal-slate-blue">shield</span>
              ${t.name}
            </h2>
            <p class="text-xs text-outline mt-0.5">
              Captain: <strong class="text-ice-blue">${t.captain_name || 'Unassigned'}</strong>
            </p>
          </div>
          <span class="text-xs font-semibold px-2.5 py-1 rounded bg-white/5 text-ice-blue border border-white/10">
            ${t.members?.length || 0} Members
          </span>
        </div>

        ${t.task_title ? `
          <div class="p-2.5 rounded bg-white/5 border border-white/5 text-xs text-outline flex items-center gap-2">
            <span class="material-symbols-outlined text-sm text-royal-slate-blue">assignment</span>
            <span>Task: <strong class="text-white">${t.task_title}</strong></span>
          </div>
        ` : ''}
      </div>

      <!-- Members Roster with Custom Point Shares -->
      <div class="space-y-2">
        <div class="flex justify-between items-center text-xs text-outline font-medium px-1">
          <span>Roster Members</span>
          <span>Point Share Weight</span>
        </div>

        <div class="space-y-2">
          ${t.members?.map(m => `
            <div class="flex justify-between items-center text-xs p-3 rounded-lg bg-white/5 border border-white/5 hover:border-white/15 transition-all">
              <div class="flex items-center gap-2">
                <span class="material-symbols-outlined text-sm text-royal-slate-blue">person</span>
                <span class="font-semibold text-white">${m.name}</span>
                ${m.tag ? `<span class="text-[10px] text-outline">(${m.tag})</span>` : ''}
                ${m.id === t.captain_id ? '<span class="text-[10px] bg-royal-slate-blue/30 text-royal-slate-blue px-1.5 py-0.2 rounded font-bold">CPT</span>' : ''}
              </div>

              <div class="flex items-center gap-2">
                <span class="px-2 py-0.5 rounded text-xs font-semibold bg-royal-slate-blue/20 text-ice-blue border border-royal-slate-blue/30">
                  ${Math.round((m.custom_point_share || 1) * 100)}%
                </span>
                ${canManage ? `
                  <button class="btn-edit-share px-2 py-1 bg-white/5 hover:bg-white/15 text-[11px] font-semibold text-outline hover:text-white rounded border border-white/10 transition-all" data-team="${t.id}" data-user="${m.id}" data-current="${m.custom_point_share}">
                    Edit
                  </button>
                ` : ''}
              </div>
            </div>
          `).join('') || ''}
        </div>
      </div>

      <!-- Card Footer Actions -->
      ${canManage ? `
        <div class="pt-3 border-t border-white/5 flex justify-end">
          <button class="btn-dissolve-team px-3 py-1.5 bg-red-950/30 hover:bg-red-900/50 text-red-400 font-semibold text-xs rounded border border-red-500/30 transition-all flex items-center gap-1" data-id="${t.id}">
            <span class="material-symbols-outlined text-sm">remove_circle</span>
            Dissolve Squad
          </button>
        </div>
      ` : ''}

    </div>
  `;
}

export function attachTeamsEvents(state, refreshData) {
  const currentUserId = state.currentUser ? state.currentUser.id : null;

  // Create Team Modal Handler
  const createTeamBtn = document.getElementById('btnCreateTeam');
  if (createTeamBtn) {
    createTeamBtn.addEventListener('click', () => {
      openModal({
        title: 'Create New 4-Member Squad',
        contentHtml: `
          <div class="form-group">
            <label>Squad Name</label>
            <input type="text" id="modalTeamName" class="form-control" placeholder="e.g. Gamma Cyberpunks" />
          </div>
        `,
        onConfirm: async (overlay) => {
          const name = overlay.querySelector('#modalTeamName').value.trim();
          if (!name) return false;
          await createTeam({ name, created_by: currentUserId });
          refreshData();
          return true;
        }
      });
    });
  }

  // Point Redistribution Override Handler
  document.querySelectorAll('.btn-edit-share').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const teamId = e.currentTarget.getAttribute('data-team');
      const userId = e.currentTarget.getAttribute('data-user');
      const currentShare = parseFloat(e.currentTarget.getAttribute('data-current')) || 1.0;

      openModal({
        title: 'Adjust Member Point Weight Share',
        contentHtml: `
          <p class="text-xs text-outline mb-3">Adjust individual point share multiplier based on contribution (1.0 = equal 100%, 1.5 = 150%, 0.5 = 50%).</p>
          <div class="form-group">
            <label>Point Weight Share</label>
            <input type="number" step="0.1" min="0" max="3" id="modalShareWeight" class="form-control" value="${currentShare}" />
          </div>
        `,
        onConfirm: async (overlay) => {
          const val = parseFloat(overlay.querySelector('#modalShareWeight').value);
          if (isNaN(val) || val < 0) return false;
          await overridePoints(teamId, userId, val);
          refreshData();
          return true;
        }
      });
    });
  });

  // Dissolve Team Handler
  document.querySelectorAll('.btn-dissolve-team').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const teamId = e.currentTarget.getAttribute('data-id');
      openModal({
        title: 'Confirm Squad Dissolution',
        contentHtml: `
          <p class="text-xs text-outline">Are you sure you want to dissolve this squad back into the unassigned cohort pool?</p>
        `,
        onConfirm: async () => {
          await dissolveTeam(teamId, 'MANUAL');
          refreshData();
          return true;
        }
      });
    });
  });
}
