import { suggestTask, upvoteTask } from '../services/api.js';
import { openModal } from '../components/modal.js';

export function renderChallengesView(state) {
  const { tasksData, currentUser } = state;
  const marketplace = tasksData.marketplace || [];
  const challenges = tasksData.challenges || [];
  const activeChallenges = challenges.filter(t => t.task_type === 'CHALLENGE' || t.mode === 'CHOICE');

  return `
    <div class="space-y-8 max-w-6xl mx-auto">
      <!-- Header Banner -->
      <div class="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-4 border-b border-white/10">
        <div>
          <div class="flex items-center gap-2">
            <span class="px-2.5 py-0.5 rounded-full text-xs font-extrabold uppercase bg-royal-slate-blue/20 text-royal-slate-blue border border-royal-slate-blue/40 accent-target">
              Peer Currency & Bounties
            </span>
          </div>
          <h1 class="text-3xl font-black text-white uppercase tracking-tight mt-1">Community Challenges</h1>
          <p class="text-xs text-outline mt-1 max-w-2xl">
            Create custom challenges, earn challenge points, and test your mastery on open peer-to-peer bounties.
          </p>
        </div>

        <button id="btnCreateChallenge" class="py-2.5 px-5 bg-gradient-to-r from-royal-slate-blue to-ice-blue/80 hover:from-royal-slate-blue hover:to-royal-slate-blue text-white font-bold rounded-xl shadow-lg transition-all flex items-center gap-2 text-xs self-start md:self-auto cursor-pointer">
          <span class="material-symbols-outlined text-sm">add_circle</span>
          <span>+ Create Challenge</span>
        </button>
      </div>

      <!-- Active Challenges Section -->
      <div class="space-y-4">
        <h2 class="text-lg font-bold text-white flex items-center gap-2">
          <span class="material-symbols-outlined text-royal-slate-blue accent-target">bolt</span>
          Active Open Challenges
        </h2>

        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          ${activeChallenges.length === 0 ? `
            <div class="col-span-3 glass-card p-8 rounded-2xl text-center text-outline text-xs">
              No active challenges right now. Click <strong>+ Create Challenge</strong> to post one!
            </div>
          ` : activeChallenges.map(c => `
            <div class="glass-card p-6 rounded-2xl flex flex-col justify-between hover:border-royal-slate-blue/40 transition-all group">
              <div class="space-y-3">
                <div class="flex justify-between items-center">
                  <span class="px-2 py-0.5 text-[10px] font-bold rounded bg-royal-slate-blue/20 text-royal-slate-blue border border-royal-slate-blue/30 uppercase accent-target">
                    CHALLENGE
                  </span>
                  <span class="text-xs font-black text-amber-400 flex items-center gap-1 bg-amber-400/10 px-2 py-0.5 rounded border border-amber-400/20">
                    <span class="material-symbols-outlined text-sm">stars</span>
                    ${c.total_points} PTS
                  </span>
                </div>
                <div>
                  <h3 class="font-bold text-base text-white group-hover:text-royal-slate-blue transition-colors line-clamp-1">
                    ${c.title}
                  </h3>
                  <p class="text-xs text-outline mt-1 line-clamp-3">${c.description}</p>
                </div>
              </div>

              <div class="pt-4 mt-4 border-t border-white/5 flex justify-between items-center text-xs">
                <span class="text-outline text-[11px]">Open Bounty</span>
                <button class="btn-claim-challenge px-3 py-1.5 rounded-lg bg-white/5 hover:bg-royal-slate-blue hover:text-white border border-white/10 text-xs font-semibold transition-all" data-id="${c.id}">
                  Undertake
                </button>
              </div>
            </div>
          `).join('')}
        </div>
      </div>

      <!-- Proposed Community Marketplace Challenges -->
      <div class="space-y-4 pt-4">
        <h2 class="text-lg font-bold text-white flex items-center gap-2">
          <span class="material-symbols-outlined text-amber-400">storefront</span>
          Community Proposed Bounties & Ideas
        </h2>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          ${marketplace.length === 0 ? `
            <div class="col-span-2 glass-card p-8 rounded-2xl text-center text-outline text-xs">
              No community proposed challenges yet.
            </div>
          ` : marketplace.map(m => `
            <div class="glass-card p-6 rounded-2xl flex gap-4 border-l-4 border-l-amber-400/80">
              <!-- Upvote Column -->
              <div class="flex flex-col items-center justify-center gap-1 bg-white/5 p-2 rounded-xl border border-white/5 min-w-[56px]">
                <button class="btn-upvote text-amber-400 hover:scale-125 transition-transform" data-id="${m.id}">
                  <span class="material-symbols-outlined text-xl">keyboard_arrow_up</span>
                </button>
                <span class="text-xs font-extrabold text-amber-400">${m.upvotes || 0}</span>
                <span class="text-[9px] text-outline uppercase font-semibold">Votes</span>
              </div>

              <!-- Details Column -->
              <div class="flex-1 space-y-2">
                <div class="flex justify-between items-start">
                  <h3 class="font-bold text-sm text-white line-clamp-1">${m.title}</h3>
                  <span class="text-xs font-bold text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded border border-amber-400/20">${m.total_points || 20} PTS</span>
                </div>
                <p class="text-xs text-outline line-clamp-2">${m.description}</p>
                <div class="flex items-center justify-between pt-2 text-[11px] text-outline">
                  <span>Suggested Bounty</span>
                  <button class="btn-upvote-text text-amber-400 hover:underline font-semibold flex items-center gap-1" data-id="${m.id}">
                    <span class="material-symbols-outlined text-xs">thumb_up</span> Upvote Challenge
                  </button>
                </div>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    </div>
  `;
}

export function attachChallengesEvents(state, refreshData) {
  const createBtn = document.getElementById('btnCreateChallenge');
  if (createBtn) {
    createBtn.addEventListener('click', () => {
      openModal({
        title: 'Create Community Challenge / Bounty',
        contentHtml: `
          <div class="space-y-3">
            <div>
              <label class="block text-xs font-bold text-ice-blue uppercase tracking-wider mb-1">Challenge Title</label>
              <input type="text" id="modalChallengeTitle" class="w-full bg-white/5 border border-white/15 rounded-xl px-3 py-2 text-sm text-white focus:border-royal-slate-blue focus:outline-none" placeholder="e.g. Master CSS Grid Layout & Animations" />
            </div>
            <div>
              <label class="block text-xs font-bold text-ice-blue uppercase tracking-wider mb-1">Points Bounty</label>
              <input type="number" id="modalChallengePoints" class="w-full bg-white/5 border border-white/15 rounded-xl px-3 py-2 text-sm text-white focus:border-royal-slate-blue focus:outline-none" value="25" />
            </div>
            <div>
              <label class="block text-xs font-bold text-ice-blue uppercase tracking-wider mb-1">Description & Requirements</label>
              <textarea id="modalChallengeDesc" rows="3" class="w-full bg-white/5 border border-white/15 rounded-xl px-3 py-2 text-sm text-white focus:border-royal-slate-blue focus:outline-none" placeholder="Describe the challenge goals..."></textarea>
            </div>
          </div>
        `,
        onConfirm: async (overlay) => {
          const title = overlay.querySelector('#modalChallengeTitle').value.trim();
          const total_points = parseInt(overlay.querySelector('#modalChallengePoints').value, 10) || 20;
          const description = overlay.querySelector('#modalChallengeDesc').value.trim();

          if (!title || !description) return false;

          await suggestTask({
            title,
            description,
            total_points,
            task_type: 'CHALLENGE',
            mode: 'CHOICE',
            user_id: state.currentUser?.id
          });

          refreshData();
          return true;
        }
      });
    });
  }

  // Upvote Event Listeners
  const upvoteBtns = document.querySelectorAll('.btn-upvote, .btn-upvote-text');
  upvoteBtns.forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const taskId = e.currentTarget.getAttribute('data-id');
      if (taskId) {
        try {
          await upvoteTask(taskId);
          refreshData();
        } catch (err) {
          console.error('Failed to upvote:', err);
        }
      }
    });
  });
}
