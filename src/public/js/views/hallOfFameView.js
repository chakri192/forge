// The Hall of Fame View Renderer (Marble & Granite Theme)
import { openModal } from '../components/modal.js';
import { awardTitle } from '../services/api.js';
import { escapeHtml } from '../utils/dom.js';

export function renderHallOfFameView(state) {
  const { hallOfFameData, currentUser } = state;
  const allTime = hallOfFameData.allTime || [];
  const season1 = hallOfFameData.season1 || [];
  const titles = hallOfFameData.titles || [];
  // Mirror the server's HOF_AWARD permission (leader/teacher/admin, plus the
  // DEV_STEALTH overlay whose public_role is masked to "member").
  const rawRole = currentUser ? currentUser.role : '';
  const publicRole = currentUser ? currentUser.public_role || currentUser.role : '';
  const isTeacherOrDev =
    ['leader', 'teacher', 'admin'].includes(publicRole) ||
    ['leader', 'teacher', 'admin', 'DEV_STEALTH', 'STUDENT_LEADER', 'TEACHER'].includes(rawRole);

  return `
    <div class="space-y-5">
      <div class="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6">
        <div>
          <h2 class="text-2xl font-extrabold tracking-tight flex items-center gap-2.5">
            <span class="material-symbols-outlined text-3xl accent-target">emoji_events</span> Hall of Fame
          </h2>
          <p class="text-xs text-outline mt-1">Academic excellence, coding mastery, and community titles.</p>
        </div>
        ${isTeacherOrDev ? `
          <button id="btnAwardTitle" class="btn btn--primary">
            <span class="material-symbols-outlined text-base" aria-hidden="true">workspace_premium</span> Award Title
          </button>
        ` : ''}
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] gap-5 items-start">
        <!-- Leaderboard with season toggle -->
        <section class="glass-card rounded-2xl overflow-hidden">
          <div class="flex items-center justify-between gap-3 px-5 py-4 border-b border-white/10 flex-wrap">
            <h3 class="text-sm font-bold flex items-center gap-2">
              <span class="material-symbols-outlined text-base accent-target" aria-hidden="true">leaderboard</span>
              Rankings
            </h3>
            <div class="flex gap-1 p-1 rounded-xl bg-white/5 border border-white/10" role="tablist" aria-label="Ranking period">
              <button role="tab" aria-selected="true" data-season="allTime"
                class="season-tab px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all bg-royal-slate-blue/25 text-white">
                All-time
              </button>
              <button role="tab" aria-selected="false" data-season="season1"
                class="season-tab px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all text-outline hover:text-white">
                Season 1
              </button>
            </div>
          </div>
          <div id="seasonPanel-allTime" class="season-panel">
            ${renderRankingList(allTime, currentUser)}
          </div>
          <div id="seasonPanel-season1" class="season-panel hidden">
            ${renderRankingList(season1, currentUser)}
          </div>
        </section>

        <!-- Awarded honors -->
        <section class="glass-card rounded-2xl p-5">
          <h3 class="text-sm font-bold flex items-center gap-2 mb-4">
            <span class="material-symbols-outlined text-base accent-target" aria-hidden="true">workspace_premium</span>
            Awarded Honors
          </h3>
          ${
            titles.length === 0
              ? `<div class="text-center py-8 space-y-2">
                  <span class="material-symbols-outlined text-3xl text-outline" aria-hidden="true">military_tech</span>
                  <p class="text-xs text-outline">No titles awarded yet.</p>
                  ${isTeacherOrDev ? '<p class="text-[11px] text-outline/70">Recognise a standout member with the Award Title button.</p>' : ''}
                </div>`
              : `<ul class="space-y-2.5">
                  ${titles
                    .map(
                      (t) => `
                    <li class="p-3.5 rounded-xl bg-gradient-to-br from-amber-500/10 to-transparent border border-amber-500/25">
                      <div class="flex items-center gap-2 text-sm font-bold text-amber-300">
                        <span class="material-symbols-outlined text-base" aria-hidden="true">trophy</span>
                        ${escapeHtml(t.title_name)}
                      </div>
                      <div class="text-[11px] text-outline mt-1">
                        ${escapeHtml(t.user_name || t.team_name || 'Cohort')}${t.category ? ` · ${escapeHtml(t.category)}` : ''}
                      </div>
                    </li>`
                    )
                    .join('')}
                </ul>`
          }
        </section>
      </div>
    </div>
  `;
}

const MEDALS = [
  'bg-amber-400/20 text-amber-300 border-amber-400/40',
  'bg-slate-300/20 text-slate-200 border-slate-300/40',
  'bg-orange-600/20 text-orange-300 border-orange-600/40'
];

function renderRankingList(entries, currentUser) {
  if (!entries.length) {
    return `
      <div class="text-center py-12 space-y-2">
        <span class="material-symbols-outlined text-3xl text-outline" aria-hidden="true">social_leaderboard</span>
        <p class="text-sm text-white font-semibold">No rankings yet</p>
        <p class="text-xs text-outline">Points appear here once tasks are completed and approved.</p>
      </div>`;
  }

  return `
    <ol class="divide-y divide-white/5">
      ${entries
        .map((u, index) => {
          const isSelf = currentUser && u.id === currentUser.id;
          const medal = MEDALS[index] || 'bg-white/5 text-outline border-white/10';
          return `
            <li class="flex items-center gap-3 px-5 py-3 transition-colors ${isSelf ? 'bg-royal-slate-blue/10' : 'hover:bg-white/[0.03]'}">
              <span class="w-7 h-7 shrink-0 rounded-lg border flex items-center justify-center text-[11px] font-black ${medal}">
                ${index + 1}
              </span>
              <span class="flex-1 min-w-0">
                <span class="flex items-center gap-2 text-sm font-semibold text-white truncate">
                  ${escapeHtml(u.name)}
                  ${isSelf ? '<span class="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-royal-slate-blue/30 text-white shrink-0">You</span>' : ''}
                </span>
                ${u.tag ? `<span class="block text-[11px] text-outline truncate">${escapeHtml(u.tag)}</span>` : ''}
              </span>
              <span class="text-right shrink-0">
                <span class="block text-sm font-black text-white tabular-nums">
                  ${Number(u.xp || 0).toLocaleString()}
                  <span class="text-[10px] font-bold text-outline ml-0.5">XP</span>
                </span>
                <span class="block text-[10px] text-outline tabular-nums">${Number(u.points || 0).toLocaleString()} pts</span>
              </span>
            </li>`;
        })
        .join('')}
    </ol>`;
}


export function attachHallOfFameEvents(state, refreshData) {
  const seasonTabs = [...document.querySelectorAll('.season-tab')];
  seasonTabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      seasonTabs.forEach((other) => {
        const isActive = other === tab;
        other.setAttribute('aria-selected', String(isActive));
        other.classList.toggle('bg-royal-slate-blue/25', isActive);
        other.classList.toggle('text-white', isActive);
        other.classList.toggle('text-outline', !isActive);
        const panel = document.getElementById(`seasonPanel-${other.dataset.season}`);
        if (panel) panel.classList.toggle('hidden', !isActive);
      });
    });
  });

  const awardBtn = document.getElementById('btnAwardTitle');
  if (awardBtn) {
    awardBtn.addEventListener('click', () => {
      openModal({
        title: 'Award Hall of Fame Title',
        contentHtml: `
          <div class="form-group">
            <label>Title Name</label>
            <input type="text" id="modalTitleName" class="form-control" placeholder="e.g. Master UI Craftsperson" />
          </div>
          <div class="form-group">
            <label>Category</label>
            <select id="modalTitleCategory" class="form-control">
              <option value="Academics">Academics</option>
              <option value="Coding">Coding</option>
              <option value="Design">Design</option>
              <option value="Leadership">Leadership</option>
              <option value="Collaboration">Collaboration</option>
            </select>
          </div>
          <div class="form-group">
            <label>Awardee User ID (Optional)</label>
            <input type="text" id="modalAwardeeUser" class="form-control" placeholder="e.g. u_o1" />
          </div>
        `,
        onConfirm: async (overlay) => {
          const title_name = overlay.querySelector('#modalTitleName').value.trim();
          const category = overlay.querySelector('#modalTitleCategory').value;
          const awarded_to_user_id = overlay.querySelector('#modalAwardeeUser').value.trim() || null;

          if (!title_name) return false;

          await awardTitle({ title_name, category, awarded_to_user_id, season: 'Season 1' });
          refreshData();
          return true;
        }
      });
    });
  }
}
