// Dashboard View Renderer (FORGE Platform Theme)

export function renderDashboard(state) {
  const { tasksData = {}, teamsData = [], hallOfFameData = {}, currentUser } = state;
  const teamTasks = (tasksData && tasksData.teamTasks) || [];
  const challenges = (tasksData && tasksData.challenges) || [];
  const allTasks = [...teamTasks, ...challenges];
  const leaders = (hallOfFameData && hallOfFameData.allTime) || [];

  // Total points earned
  const userLeaderData = leaders.find(l => l.id === currentUser?.id);
  const totalPoints = userLeaderData ? userLeaderData.points : 0;

  // Find user's active team
  const safeTeams = Array.isArray(teamsData) ? teamsData : [];
  const myTeam = safeTeams.find(t => t && Array.isArray(t.members) && t.members.some(m => m && m.id === currentUser?.id));

  return `
    <div class="space-y-8 max-w-6xl mx-auto">
      
      <!-- Welcome Hero Banner -->
      <div class="glass-card p-8 rounded-2xl relative overflow-hidden border border-white/10 shadow-2xl">
        <!-- Ambient Watermark Logo Glow -->
        <div class="absolute -top-12 -right-12 opacity-20 pointer-events-none">
          <img src="/assets/logo/HALF.png" alt="FORGE Watermark" class="w-72 h-72 object-contain" />
        </div>

        <div class="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div class="space-y-2">
            <div class="flex items-center gap-2">
              <span class="px-2.5 py-0.5 rounded-full text-xs font-extrabold uppercase bg-royal-slate-blue/20 text-royal-slate-blue border border-royal-slate-blue/40 accent-target">
                FORGE Platform
              </span>
              <span class="text-xs text-outline">• Active Session</span>
            </div>
            <h1 class="text-3xl md:text-4xl font-black text-white tracking-tight">
              Welcome back, <span class="text-royal-slate-blue accent-target">${currentUser ? currentUser.name : 'Aaron (Dev)'}</span>
            </h1>
            <p class="text-sm text-outline max-w-xl">
              Community platform dashboard. View assigned missions, open community challenges, and track active team progress.
            </p>
          </div>

          <!-- Quick Action Buttons -->
          <div class="flex flex-wrap items-center gap-3">
            <button class="nav-drawer-item px-4 py-2.5 rounded-xl bg-royal-slate-blue hover:bg-royal-slate-blue/80 text-white font-bold text-xs shadow-lg transition-all flex items-center gap-2" data-tab="tasks">
              <span class="material-symbols-outlined text-sm">assignment</span>
              <span>View Tasks</span>
            </button>
            <button class="nav-drawer-item px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-white font-bold text-xs border border-white/10 transition-all flex items-center gap-2" data-tab="challenges">
              <span class="material-symbols-outlined text-sm">bolt</span>
              <span>Challenges</span>
            </button>
          </div>
        </div>
      </div>

      <!-- Personal Progress Grid -->
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div class="glass-card p-6 rounded-2xl border border-white/10 flex items-center gap-4 hover:border-white/20 transition-all">
          <div class="w-12 h-12 rounded-xl bg-royal-slate-blue/20 border border-royal-slate-blue/40 flex items-center justify-center text-royal-slate-blue accent-target">
            <span class="material-symbols-outlined text-2xl">insights</span>
          </div>
          <div>
            <span class="text-xs text-outline font-semibold uppercase block">Total Earned Points</span>
            <span class="text-2xl font-black text-white">${totalPoints} PTS</span>
          </div>
        </div>

        <div class="glass-card p-6 rounded-2xl border border-white/10 flex items-center gap-4 hover:border-white/20 transition-all">
          <div class="w-12 h-12 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
            <span class="material-symbols-outlined text-2xl">local_fire_department</span>
          </div>
          <div>
            <span class="text-xs text-outline font-semibold uppercase block">Active Streak</span>
            <span class="text-2xl font-black text-white">Active</span>
          </div>
        </div>

        <div class="glass-card p-6 rounded-2xl border border-white/10 flex items-center gap-4 hover:border-white/20 transition-all">
          <div class="w-12 h-12 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
            <span class="material-symbols-outlined text-2xl">groups</span>
          </div>
          <div>
            <span class="text-xs text-outline font-semibold uppercase block">Active Team</span>
            <span class="text-lg font-extrabold text-white truncate max-w-[120px] block">${myTeam ? myTeam.name : 'Unassigned'}</span>
          </div>
        </div>

        <div class="glass-card p-6 rounded-2xl border border-white/10 flex items-center gap-4 hover:border-white/20 transition-all">
          <div class="w-12 h-12 rounded-xl bg-purple-500/20 border border-purple-500/40 flex items-center justify-center text-purple-400">
            <span class="material-symbols-outlined text-2xl">shield</span>
          </div>
          <div>
            <span class="text-xs text-outline font-semibold uppercase block">Role Privilege</span>
            <span class="text-sm font-extrabold text-white uppercase">${currentUser ? (currentUser.public_role || currentUser.role) : 'MEMBER'}</span>

          </div>
        </div>
      </div>

      <!-- Active Objectives & Community Leaderboard Grid -->
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <!-- Objectives Section (2 Cols) -->
        <div class="lg:col-span-2 space-y-4">
          <div class="flex justify-between items-center">
            <h2 class="text-xl font-extrabold text-white flex items-center gap-2">
              <span class="material-symbols-outlined text-royal-slate-blue accent-target">task_alt</span>
              Active Missions & Tasks
            </h2>
            <button class="nav-drawer-item text-xs text-royal-slate-blue hover:underline accent-target font-bold" data-tab="tasks">View All Tasks →</button>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            ${allTasks.length === 0 ? `
              <div class="col-span-2 glass-card p-8 rounded-2xl text-center text-outline">
                No active tasks currently registered.
              </div>
            ` : allTasks.slice(0, 4).map(t => `
              <div class="glass-card p-6 rounded-2xl flex flex-col justify-between hover:border-royal-slate-blue/40 transition-all group">
                <div class="space-y-3">
                  <div class="flex justify-between items-start">
                    <span class="px-2.5 py-1 text-[11px] font-extrabold rounded-lg bg-royal-slate-blue/20 text-royal-slate-blue border border-royal-slate-blue/40 accent-target">
                      ${t.task_type === 'CHALLENGE' ? 'CHALLENGE' : 'TEAM TASK'}
                    </span>
                    <span class="text-xs font-bold px-2.5 py-1 rounded-lg bg-white/5 text-ice-blue border border-white/10">
                      ${t.total_points} PTS
                    </span>
                  </div>
                  <div>
                    <h3 class="font-bold text-base text-white group-hover:text-royal-slate-blue transition-colors line-clamp-1">
                      ${t.title}
                    </h3>
                    <p class="text-xs text-outline mt-1 line-clamp-2">${t.description}</p>
                  </div>
                </div>
                <div class="pt-4 mt-4 border-t border-white/5 flex justify-between items-center text-xs">
                  <span class="text-outline flex items-center gap-1">
                    <span class="material-symbols-outlined text-sm">schedule</span>
                    ${t.status}
                  </span>
                  <button class="nav-drawer-item text-royal-slate-blue hover:underline font-bold" data-tab="${t.task_type === 'CHALLENGE' ? 'challenges' : 'tasks'}">
                    Details →
                  </button>
                </div>
              </div>
            `).join('')}
          </div>
        </div>

        <!-- Leaderboard Preview Sidebar (1 Col) -->
        <div class="space-y-4">
          <div class="flex justify-between items-center">
            <h2 class="text-xl font-extrabold text-white flex items-center gap-2">
              <span class="material-symbols-outlined text-amber-400">emoji_events</span>
              Hall of Fame Top 3
            </h2>
            <button class="nav-drawer-item text-xs text-amber-400 hover:underline font-bold" data-tab="halloffame">View All →</button>
          </div>

          <div class="glass-card p-6 rounded-2xl border border-white/10 space-y-4">
            ${leaders.length === 0 ? `
              <p class="text-xs text-outline text-center py-4">No points recorded yet in Hall of Fame.</p>
            ` : leaders.slice(0, 3).map((l, idx) => `
              <div class="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/5">
                <div class="flex items-center gap-3">
                  <div class="w-7 h-7 rounded-lg flex items-center justify-center font-black text-xs ${idx === 0 ? 'bg-amber-400 text-black' : idx === 1 ? 'bg-slate-300 text-black' : 'bg-amber-700 text-white'}">
                    #${idx + 1}
                  </div>
                  <div>
                    <span class="font-bold text-sm text-white block">${l.name}</span>
                    <span class="text-[10px] text-outline">@${l.username} • ${l.public_role}</span>
                  </div>
                </div>
                <span class="font-black text-sm text-amber-400">${l.points} PTS</span>
              </div>
            `).join('')}
          </div>
        </div>
      </div>

    </div>
  `;
}

export function attachDashboardEvents(state, refreshData) {
  // Event listeners for dashboard actions if any
}
