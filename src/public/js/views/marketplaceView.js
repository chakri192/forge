// Marketplace: members propose tasks, the community votes, leaders promote.
import { fetchSuggestions, createSuggestion, promoteSuggestion, castVote } from '../services/api.js';
import { onStreamEvent } from '../services/stream.js';
import { showToast } from '../components/toast.js';
import { openModal } from '../components/modal.js';
import { renderSkeleton } from '../components/spinner.js';
import { escapeHtml, timeAgo } from '../utils/dom.js';

const PROMOTE_ROLES = ['leader', 'teacher', 'admin', 'DEV_STEALTH', 'STUDENT_LEADER', 'TEACHER'];

const STATUS_STYLES = {
  PENDING: 'bg-white/5 text-outline border-white/15',
  APPROVED: 'bg-sky-500/15 text-sky-300 border-sky-500/30',
  REJECTED: 'bg-red-500/15 text-red-300 border-red-500/30',
  IMPLEMENTED: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
};

let unsubscribe = null;

export function renderMarketplaceView(state) {
  if (!state.currentUser) {
    return `<div class="glass-card p-10 rounded-2xl text-center text-sm text-outline">Sign in to browse community proposals.</div>`;
  }
  return `
    <div class="space-y-5 max-w-4xl">
      <div class="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h2 class="text-2xl font-extrabold tracking-tight flex items-center gap-2.5">
            <span class="material-symbols-outlined text-3xl accent-target">storefront</span> Task Marketplace
          </h2>
          <p class="text-xs text-outline mt-1">Propose what you want to build. The most-wanted ideas become real tasks.</p>
        </div>
        <button id="btnSuggest" class="flex items-center gap-1.5 px-4 py-2.5 bg-royal-slate-blue hover:opacity-90 text-white font-bold text-xs rounded-xl shadow-md transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-royal-slate-blue/70">
          <span class="material-symbols-outlined text-base" aria-hidden="true">lightbulb</span> Suggest a Task
        </button>
      </div>
      <div id="marketplaceRoot">${renderSkeleton('card', { className: 'rounded-2xl' })}</div>
    </div>`;
}

export function attachMarketplaceEvents(state) {
  if (!state.currentUser) return;
  const root = document.getElementById('marketplaceRoot');
  const canPromote = PROMOTE_ROLES.includes(state.currentUser.role);

  async function refresh() {
    try {
      const { suggestions } = await fetchSuggestions();
      root.innerHTML = suggestions.length
        ? `<div class="space-y-2.5">${suggestions.map(cardHtml).join('')}</div>`
        : `<div class="glass-card rounded-2xl p-10 text-center space-y-2">
            <span class="material-symbols-outlined text-4xl text-outline" aria-hidden="true">lightbulb</span>
            <p class="text-sm text-white font-semibold">No proposals yet</p>
            <p class="text-xs text-outline">Suggest something you would like the community to build.</p>
          </div>`;
      bindCards();
    } catch (_) {
      root.innerHTML = `<div class="glass-card rounded-2xl p-8 text-center text-sm text-outline">Unable to load the marketplace.</div>`;
    }
  }

  function cardHtml(s) {
    const statusClass = STATUS_STYLES[s.status] || STATUS_STYLES.PENDING;
    return `
      <article class="glass-card rounded-2xl p-4 flex gap-4" data-suggestion-id="${s.id}">
        <div class="flex flex-col items-center gap-0.5 shrink-0" data-vote-group="${s.id}">
          <button class="vote-btn p-1 rounded-lg transition-colors ${s.my_vote === 1 ? 'text-emerald-400' : 'text-outline hover:text-white'}"
            data-target-id="${s.id}" data-value="1" aria-label="Upvote this proposal">
            <span class="material-symbols-outlined text-lg" aria-hidden="true">arrow_upward</span>
          </button>
          <span class="vote-score text-xs font-black ${s.score > 0 ? 'text-white' : 'text-outline'}">${s.score}</span>
          <button class="vote-btn p-1 rounded-lg transition-colors ${s.my_vote === -1 ? 'text-red-400' : 'text-outline hover:text-white'}"
            data-target-id="${s.id}" data-value="-1" aria-label="Downvote this proposal">
            <span class="material-symbols-outlined text-lg" aria-hidden="true">arrow_downward</span>
          </button>
        </div>
        <div class="flex-1 min-w-0">
          <div class="flex items-start gap-2 flex-wrap">
            <h3 class="text-sm font-bold text-white flex-1 min-w-[160px]">${escapeHtml(s.title)}</h3>
            <span class="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${statusClass}">${escapeHtml(s.status)}</span>
          </div>
          <p class="text-xs text-white/80 leading-relaxed mt-1.5 whitespace-pre-wrap break-words">${escapeHtml(s.description)}</p>
          <div class="flex items-center gap-3 mt-2.5 text-[11px] text-outline">
            <span>${escapeHtml(s.suggested_by_name || 'Unknown')} · ${timeAgo(s.created_at)}</span>
            <span class="flex-1"></span>
            ${
              canPromote && s.status !== 'IMPLEMENTED'
                ? `<button class="promote-btn font-semibold text-accent-text hover:underline" data-id="${s.id}">Promote to task →</button>`
                : ''
            }
          </div>
        </div>
      </article>`;
  }

  function bindCards() {
    root.querySelectorAll('.vote-btn').forEach((btn) => {
      btn.addEventListener('click', async () => {
        try {
          const result = await castVote('SUGGESTION', btn.dataset.targetId, Number(btn.dataset.value));
          const group = root.querySelector(`[data-vote-group="${btn.dataset.targetId}"]`);
          group.querySelector('.vote-score').textContent = result.score;
          group.querySelectorAll('.vote-btn').forEach((b) => {
            const active = Number(b.dataset.value) === result.value;
            b.classList.toggle('text-emerald-400', active && result.value === 1);
            b.classList.toggle('text-red-400', active && result.value === -1);
            b.classList.toggle('text-outline', !active);
          });
        } catch (_) {}
      });
    });

    root.querySelectorAll('.promote-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        openModal({
          title: 'Promote to a real task',
          contentHtml: `
            <div class="space-y-3.5">
              <p class="text-xs text-outline">This creates a task the whole community can pick up, and rewards the person who proposed it.</p>
              <div>
                <label class="block text-[11px] font-bold text-outline uppercase tracking-wider mb-1.5">Points</label>
                <input id="promotePoints" type="number" value="40" min="0"
                  class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-royal-slate-blue/60" />
              </div>
              <div>
                <label class="block text-[11px] font-bold text-outline uppercase tracking-wider mb-1.5">Type</label>
                <select id="promoteType" class="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none">
                  <option value="TEAM_TASK">Team task</option>
                  <option value="CHALLENGE">Challenge</option>
                </select>
              </div>
            </div>`,
          onConfirm: async (overlay) => {
            try {
              await promoteSuggestion(btn.dataset.id, {
                total_points: Number(overlay.querySelector('#promotePoints').value) || 40,
                task_type: overlay.querySelector('#promoteType').value
              });
              showToast({ title: 'Promoted', message: 'It is now a live task.', type: 'success' });
              refresh();
              return true;
            } catch (_) {
              return false;
            }
          }
        });
      });
    });
  }

  document.getElementById('btnSuggest').addEventListener('click', () => {
    openModal({
      title: 'Suggest a task',
      contentHtml: `
        <div class="space-y-3.5">
          <div>
            <label class="block text-[11px] font-bold text-outline uppercase tracking-wider mb-1.5">Title</label>
            <input id="suggestTitle" maxlength="160" placeholder="e.g. Build a colour-palette generator"
              class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-royal-slate-blue/60" />
          </div>
          <div>
            <label class="block text-[11px] font-bold text-outline uppercase tracking-wider mb-1.5">Why is it worth building?</label>
            <textarea id="suggestBody" rows="4" maxlength="4000" placeholder="Describe the idea and what people would learn…"
              class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-royal-slate-blue/60"></textarea>
          </div>
        </div>`,
      onConfirm: async (overlay) => {
        const title = overlay.querySelector('#suggestTitle').value.trim();
        const description = overlay.querySelector('#suggestBody').value.trim();
        if (title.length < 3 || !description) {
          showToast({ title: 'Missing details', message: 'Add a title and a description.', type: 'error' });
          return false;
        }
        try {
          await createSuggestion({ title, description });
          showToast({ title: 'Proposal submitted', message: 'The community can vote on it now.', type: 'success' });
          refresh();
          return true;
        } catch (_) {
          return false;
        }
      }
    });
  });

  if (unsubscribe) unsubscribe();
  unsubscribe = onStreamEvent((event) => {
    if (event.type !== 'vote' || event.targetType !== 'SUGGESTION') return;
    const score = document.querySelector(`[data-vote-group="${event.targetId}"] .vote-score`);
    if (score) score.textContent = event.score;
  });

  refresh();
}
