import { fetchGlobalActivity, fetchUserActivity } from '../services/api.js';

export function renderActivityFeed({ containerId, title = 'Activity Feed', isGlobal = true, userId = null }) {
  return `
    <div id="${containerId}" class="glass-card p-6 rounded-2xl border border-white/10 space-y-6">
      <!-- Activity Feed Header & Filters -->
      <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-white/10">
        <div>
          <h2 class="text-lg font-bold text-white flex items-center gap-2">
            <span class="material-symbols-outlined text-royal-slate-blue accent-target">history</span>
            ${title}
          </h2>
          <p class="text-xs text-outline mt-0.5">Real-time audit log of user actions and platform events</p>
        </div>

        <button id="${containerId}_refreshBtn" class="px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 text-white font-bold text-xs rounded-xl transition-all flex items-center gap-1.5 cursor-pointer self-start md:self-auto">
          <span class="material-symbols-outlined text-sm">refresh</span>
          <span>Refresh</span>
        </button>
      </div>

      <!-- Filter Controls Toolbar -->
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 p-4 rounded-xl bg-white/5 border border-white/5">
        <!-- Filter by Type -->
        <div>
          <label class="block text-[11px] font-bold text-ice-blue uppercase tracking-wider mb-1">Action Type</label>
          <select id="${containerId}_filterType" class="w-full bg-white/5 border border-white/15 rounded-xl px-3 py-2 text-xs text-white focus:border-royal-slate-blue focus:outline-none cursor-pointer">
            <option value="">All Actions</option>
            <option value="LOGIN">Logins</option>
            <option value="TASK_CREATE">Task Creations</option>
            <option value="TASK_SUBMIT">Task Submissions</option>
            <option value="TASK_REVIEW">Task Reviews</option>
            <option value="TEAM_CREATE">Team Creations</option>
            <option value="TEAM_DISSOLVE">Team Changes / Dissolutions</option>
            <option value="ROLE_CHANGE">Role Changes</option>
          </select>
        </div>

        ${isGlobal ? `
        <!-- Filter by User -->
        <div>
          <label class="block text-[11px] font-bold text-ice-blue uppercase tracking-wider mb-1">User ID / Username</label>
          <input type="text" id="${containerId}_filterUser" placeholder="e.g. u_dev or alex_r" 
            class="w-full bg-white/5 border border-white/15 rounded-xl px-3 py-2 text-xs text-white placeholder-white/30 focus:border-royal-slate-blue focus:outline-none" />
        </div>
        ` : ''}

        <!-- Date Range Start -->
        <div>
          <label class="block text-[11px] font-bold text-ice-blue uppercase tracking-wider mb-1">Start Date</label>
          <input type="date" id="${containerId}_filterStartDate" 
            class="w-full bg-white/5 border border-white/15 rounded-xl px-3 py-2 text-xs text-white focus:border-royal-slate-blue focus:outline-none" />
        </div>

        <!-- Date Range End -->
        <div>
          <label class="block text-[11px] font-bold text-ice-blue uppercase tracking-wider mb-1">End Date</label>
          <input type="date" id="${containerId}_filterEndDate" 
            class="w-full bg-white/5 border border-white/15 rounded-xl px-3 py-2 text-xs text-white focus:border-royal-slate-blue focus:outline-none" />
        </div>
      </div>

      <!-- Timeline Container -->
      <div id="${containerId}_timeline" class="space-y-4 min-h-[160px]">
        <div class="p-8 text-center text-xs text-outline">Loading activity timeline...</div>
      </div>
    </div>
  `;
}

export function attachActivityFeedEvents({ containerId, isGlobal = true, userId = null }) {
  const filterType = document.getElementById(`${containerId}_filterType`);
  const filterUser = document.getElementById(`${containerId}_filterUser`);
  const filterStartDate = document.getElementById(`${containerId}_filterStartDate`);
  const filterEndDate = document.getElementById(`${containerId}_filterEndDate`);
  const refreshBtn = document.getElementById(`${containerId}_refreshBtn`);

  const loadData = async () => {
    const timelineEl = document.getElementById(`${containerId}_timeline`);
    if (!timelineEl) return;

    timelineEl.innerHTML = `<div class="p-8 text-center text-xs text-outline">Loading activity timeline...</div>`;

    const params = {
      type: filterType ? filterType.value : '',
      startDate: filterStartDate && filterStartDate.value ? new Date(filterStartDate.value).toISOString() : '',
      endDate: filterEndDate && filterEndDate.value ? new Date(filterEndDate.value + 'T23:59:59').toISOString() : '',
      limit: 50
    };

    if (isGlobal && filterUser && filterUser.value.trim()) {
      params.user = filterUser.value.trim();
    }

    try {
      let data;
      if (isGlobal) {
        data = await fetchGlobalActivity(params);
      } else {
        data = await fetchUserActivity(userId, params);
      }

      renderTimeline(timelineEl, data.activities);
    } catch (err) {
      console.error('Failed to load activity timeline:', err);
      timelineEl.innerHTML = `
        <div class="p-6 rounded-xl bg-red-500/10 border border-red-500/20 text-xs text-red-300 text-center">
          ${err.message || 'Failed to load activity feed.'}
        </div>
      `;
    }
  };

  if (filterType) filterType.addEventListener('change', loadData);
  if (filterUser) filterUser.addEventListener('input', debounce(loadData, 400));
  if (filterStartDate) filterStartDate.addEventListener('change', loadData);
  if (filterEndDate) filterEndDate.addEventListener('change', loadData);
  if (refreshBtn) refreshBtn.addEventListener('click', loadData);

  // Initial load
  loadData();
}

function renderTimeline(container, activities) {
  if (!activities || activities.length === 0) {
    container.innerHTML = `
      <div class="p-8 rounded-xl bg-white/5 border border-white/5 text-center text-xs text-outline">
        No activity records found matching the criteria.
      </div>
    `;
    return;
  }

  container.innerHTML = `
    <div class="relative border-l-2 border-white/10 ml-3 space-y-6 py-2">
      ${activities.map(act => {
        const style = getEventStyle(act.action);
        const formattedDate = new Date(act.created_at).toLocaleString(undefined, {
          month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
        });
        const detailsText = act.details && act.details.description
          ? act.details.description
          : (act.action + ' on ' + act.entity_type);

        return `
          <div class="relative pl-6 group">
            <!-- Icon Badge on Timeline -->
            <div class="absolute -left-[17px] top-0 w-8 h-8 rounded-full ${style.bg} ${style.border} border flex items-center justify-center ${style.text} shadow-lg transition-transform group-hover:scale-110">
              <span class="material-symbols-outlined text-sm">${style.icon}</span>
            </div>

            <!-- Content Card -->
            <div class="p-4 rounded-xl bg-white/5 border border-white/10 hover:border-white/20 transition-all space-y-1.5">
              <div class="flex items-center justify-between gap-2">
                <div class="flex items-center gap-2">
                  <span class="text-xs font-bold text-white">${act.user_name || 'System'}</span>
                  <span class="text-[10px] text-outline">(@${act.user_username || 'system'})</span>
                  <span class="px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase ${style.badgeBg} ${style.badgeText} border ${style.badgeBorder}">
                    ${act.action}
                  </span>
                </div>
                <span class="text-[11px] text-outline font-medium whitespace-nowrap">${formattedDate}</span>
              </div>

              <p class="text-xs text-white/90 leading-relaxed font-normal">${detailsText}</p>

              ${act.details && (act.details.team_name || act.details.title || act.details.old_role) ? `
                <div class="text-[11px] text-outline pt-1 flex flex-wrap gap-3 border-t border-white/5 mt-2">
                  ${act.details.title ? `<span>Task: <strong class="text-white">${act.details.title}</strong></span>` : ''}
                  ${act.details.team_name ? `<span>Team: <strong class="text-white">${act.details.team_name}</strong></span>` : ''}
                  ${act.details.old_role ? `<span>Role: <span class="text-red-300 font-semibold">${act.details.old_role}</span> → <span class="text-emerald-300 font-semibold">${act.details.new_role}</span></span>` : ''}
                </div>
              ` : ''}
            </div>
          </div>
        `;
      }).join('')}
    </div>
  `;
}

function getEventStyle(action) {
  switch (action) {
    case 'LOGIN':
      return {
        icon: 'login',
        bg: 'bg-cyan-500/20', border: 'border-cyan-500/40', text: 'text-cyan-300',
        badgeBg: 'bg-cyan-500/20', badgeText: 'text-cyan-300', badgeBorder: 'border-cyan-500/30'
      };
    case 'TASK_CREATE':
      return {
        icon: 'add_task',
        bg: 'bg-blue-500/20', border: 'border-blue-500/40', text: 'text-blue-300',
        badgeBg: 'bg-blue-500/20', badgeText: 'text-blue-300', badgeBorder: 'border-blue-500/30'
      };
    case 'TASK_SUBMIT':
      return {
        icon: 'upload_file',
        bg: 'bg-purple-500/20', border: 'border-purple-500/40', text: 'text-purple-300',
        badgeBg: 'bg-purple-500/20', badgeText: 'text-purple-300', badgeBorder: 'border-purple-500/30'
      };
    case 'TASK_REVIEW':
      return {
        icon: 'verified',
        bg: 'bg-emerald-500/20', border: 'border-emerald-500/40', text: 'text-emerald-300',
        badgeBg: 'bg-emerald-500/20', badgeText: 'text-emerald-300', badgeBorder: 'border-emerald-500/30'
      };
    case 'TEAM_CREATE':
    case 'TEAM_OVERRIDE':
      return {
        icon: 'groups',
        bg: 'bg-amber-500/20', border: 'border-amber-500/40', text: 'text-amber-300',
        badgeBg: 'bg-amber-500/20', badgeText: 'text-amber-300', badgeBorder: 'border-amber-500/30'
      };
    case 'TEAM_DISSOLVE':
      return {
        icon: 'group_off',
        bg: 'bg-orange-500/20', border: 'border-orange-500/40', text: 'text-orange-300',
        badgeBg: 'bg-orange-500/20', badgeText: 'text-orange-300', badgeBorder: 'border-orange-500/30'
      };
    case 'ROLE_CHANGE':
      return {
        icon: 'manage_accounts',
        bg: 'bg-rose-500/20', border: 'border-rose-500/40', text: 'text-rose-300',
        badgeBg: 'bg-rose-500/20', badgeText: 'text-rose-300', badgeBorder: 'border-rose-500/30'
      };
    default:
      return {
        icon: 'notifications',
        bg: 'bg-slate-500/20', border: 'border-slate-500/40', text: 'text-slate-300',
        badgeBg: 'bg-slate-500/20', badgeText: 'text-slate-300', badgeBorder: 'border-slate-500/30'
      };
  }
}

function debounce(func, wait) {
  let timeout;
  return function (...args) {
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(this, args), wait);
  };
}
