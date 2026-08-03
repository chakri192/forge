// Community forum: threads, replies, accepted answers, and live vote counts.
import {
  fetchThreads, fetchThread, createThread, replyToThread, acceptAnswer, castVote
} from '../services/api.js';
import { onStreamEvent } from '../services/stream.js';
import { showToast } from '../components/toast.js';
import { openModal } from '../components/modal.js';
import { renderSkeleton } from '../components/spinner.js';
import { pushHash, currentParam } from '../router/hashRouter.js';
import { escapeHtml, timeAgo } from '../utils/dom.js';
import { saveDraft, readDraft, clearDraft } from '../utils/drafts.js';

let unsubscribe = null;
let activeThreadId = null;
let sortMode = 'hot';

export function renderForumView(state) {
  if (!state.currentUser) {
    return `<div class="glass-card p-10 rounded-2xl text-center text-sm text-outline">Sign in to join the discussion.</div>`;
  }
  return `
    <div class="space-y-5 max-w-4xl">
      <div class="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h2 class="text-2xl font-extrabold tracking-tight flex items-center gap-2.5">
            <span class="material-symbols-outlined text-3xl accent-target">tips_and_updates</span> Forum
          </h2>
          <p class="text-xs text-outline mt-1">Ask questions, share answers, vote the best to the top.</p>
        </div>
        <button id="btnNewThread" class="btn btn--primary">
          <span class="material-symbols-outlined text-base" aria-hidden="true">add</span> New Thread
        </button>
      </div>
      <div id="forumRoot">${renderSkeleton('card', { className: 'rounded-2xl' })}</div>
    </div>`;
}

export function attachForumEvents(state) {
  if (!state.currentUser) return;
  const root = document.getElementById('forumRoot');
  const user = state.currentUser;
  const isModerator = ['leader', 'teacher', 'admin', 'DEV_STEALTH'].includes(user.role);

  activeThreadId = currentParam();

  async function showList() {
    activeThreadId = null;
    pushHash('forum');
    try {
      const { threads } = await fetchThreads({ sort: sortMode });
      root.innerHTML = `
        <div class="flex gap-1 p-1 rounded-xl bg-white/5 border border-white/10 w-max mb-4" role="tablist">
          ${['hot', 'new', 'top']
            .map(
              (mode) => `
            <button data-sort="${mode}" role="tab" aria-selected="${mode === sortMode}"
              class="sort-tab px-3 py-1.5 rounded-lg text-[11px] font-bold capitalize transition-all ${
                mode === sortMode ? 'bg-royal-slate-blue/25 text-white' : 'text-outline hover:text-white'
              }">${mode}</button>`
            )
            .join('')}
        </div>
        ${
          threads.length === 0
            ? `<div class="glass-card rounded-2xl p-10 text-center space-y-2">
                <span class="material-symbols-outlined text-4xl text-outline" aria-hidden="true">forum</span>
                <p class="text-sm text-white font-semibold">No discussions yet</p>
                <p class="text-xs text-outline">Start the first thread and get the conversation going.</p>
              </div>`
            : `<div class="space-y-2.5">${threads.map(threadRowHtml).join('')}</div>`
        }`;

      root.querySelectorAll('.sort-tab').forEach((tab) => {
        tab.addEventListener('click', () => {
          sortMode = tab.dataset.sort;
          showList();
        });
      });
      bindVoteButtons(root);
      root.querySelectorAll('[data-thread-open]').forEach((el) => {
        el.addEventListener('click', () => showThread(el.dataset.threadOpen));
      });
    } catch (_) {
      root.innerHTML = `<div class="glass-card rounded-2xl p-8 text-center text-sm text-outline">Unable to load the forum.</div>`;
    }
  }

  function threadRowHtml(t) {
    return `
      <article class="glass-card is-interactive rounded-2xl p-4 flex gap-4">
        ${voteColumnHtml('FORUM_THREAD', t.id, t.score, t.my_vote)}
        <div class="flex-1 min-w-0">
          <button data-thread-open="${t.id}" class="text-left w-full group">
            <h3 class="text-sm font-bold text-white group-hover:text-accent-text transition-colors flex items-center gap-2">
              ${t.is_pinned ? '<span class="material-symbols-outlined text-sm text-amber-400" aria-hidden="true">push_pin</span>' : ''}
              ${t.is_locked ? '<span class="material-symbols-outlined text-sm text-outline" aria-hidden="true">lock</span>' : ''}
              <span class="truncate">${escapeHtml(t.title)}</span>
            </h3>
          </button>
          <div class="flex items-center gap-3 mt-1.5 text-[11px] text-outline flex-wrap">
            <span class="px-2 py-0.5 rounded-full bg-white/5 border border-white/10">${escapeHtml(t.category)}</span>
            <span>${escapeHtml(t.author_name || 'Unknown')} · ${timeAgo(t.created_at)}</span>
            <span class="flex items-center gap-1"><span class="material-symbols-outlined text-xs" aria-hidden="true">chat_bubble</span>${t.reply_count}</span>
            <span class="flex items-center gap-1"><span class="material-symbols-outlined text-xs" aria-hidden="true">visibility</span>${t.view_count}</span>
            ${t.answer_count > 0 ? '<span class="flex items-center gap-1 text-emerald-400 font-semibold"><span class="material-symbols-outlined text-xs" aria-hidden="true">check_circle</span>Answered</span>' : ''}
          </div>
        </div>
      </article>`;
  }

  function voteColumnHtml(targetType, targetId, score, myVote) {
    return `
      <div class="flex flex-col items-center gap-0.5 shrink-0" data-vote-group="${targetId}">
        <button class="vote-btn p-1 rounded-lg transition-colors ${myVote === 1 ? 'text-emerald-400' : 'text-outline hover:text-white'}"
          data-target-type="${targetType}" data-target-id="${targetId}" data-value="1" aria-label="Upvote">
          <span class="material-symbols-outlined text-lg" aria-hidden="true">arrow_upward</span>
        </button>
        <span class="vote-score text-xs font-black ${score > 0 ? 'text-white' : 'text-outline'}">${score}</span>
        <button class="vote-btn p-1 rounded-lg transition-colors ${myVote === -1 ? 'text-red-400' : 'text-outline hover:text-white'}"
          data-target-type="${targetType}" data-target-id="${targetId}" data-value="-1" aria-label="Downvote">
          <span class="material-symbols-outlined text-lg" aria-hidden="true">arrow_downward</span>
        </button>
      </div>`;
  }

  function bindVoteButtons(scope) {
    scope.querySelectorAll('.vote-btn').forEach((btn) => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        try {
          const result = await castVote(btn.dataset.targetType, btn.dataset.targetId, Number(btn.dataset.value));
          const group = scope.querySelector(`[data-vote-group="${btn.dataset.targetId}"]`);
          if (!group) return;
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
  }

  async function showThread(threadId) {
    activeThreadId = threadId;
    pushHash('forum', threadId);
    try {
      const { thread, posts } = await fetchThread(threadId);
      const canAccept = thread.author_id === user.id || isModerator;
      root.innerHTML = `
        <button id="btnBackToForum" class="flex items-center gap-1.5 text-xs text-outline hover:text-white mb-3 transition-colors">
          <span class="material-symbols-outlined text-sm" aria-hidden="true">arrow_back</span> All threads
        </button>
        <article class="glass-card rounded-2xl p-5 flex gap-4 mb-4">
          ${voteColumnHtml('FORUM_THREAD', thread.id, thread.score, thread.my_vote)}
          <div class="flex-1 min-w-0">
            <h3 class="text-lg font-bold flex items-center gap-2 flex-wrap">
              ${thread.is_pinned ? '<span class="material-symbols-outlined text-base text-amber-400" aria-hidden="true">push_pin</span>' : ''}
              ${escapeHtml(thread.title)}
            </h3>
            <div class="text-[11px] text-outline mt-1">
              ${escapeHtml(thread.author_name || 'Unknown')} · ${timeAgo(thread.created_at)} ·
              <span class="px-2 py-0.5 rounded-full bg-white/5 border border-white/10">${escapeHtml(thread.category)}</span>
            </div>
          </div>
        </article>

        <div class="space-y-3" id="postList">
          ${posts.map((p) => postHtml(p, canAccept, thread.id)).join('')}
        </div>

        ${
          thread.is_locked && !isModerator
            ? `<div class="glass-card rounded-2xl p-4 mt-4 text-center text-xs text-outline flex items-center justify-center gap-2">
                <span class="material-symbols-outlined text-sm" aria-hidden="true">lock</span> This thread is locked.
              </div>`
            : `<form class="glass-card rounded-2xl p-4 mt-4 space-y-2.5" id="replyForm">
                <textarea id="replyInput" rows="3" maxlength="8000" placeholder="Write a reply…"
                  class="input"></textarea>
                <div class="flex justify-end">
                  <button type="submit" class="btn btn--primary">Reply</button>
                </div>
              </form>`
        }`;

      document.getElementById('btnBackToForum').addEventListener('click', showList);
      bindVoteButtons(root);
      bindAcceptButtons(thread.id);

      const replyForm = document.getElementById('replyForm');
      if (replyForm) {
        const input = document.getElementById('replyInput');
        const draftKey = `forum:${threadId}`;
        input.value = readDraft(draftKey) || '';
        input.addEventListener('input', () => saveDraft(draftKey, input.value));

        replyForm.addEventListener('submit', async (e) => {
          e.preventDefault();
          const content = input.value.trim();
          if (!content) return;
          try {
            await replyToThread(threadId, content);
            clearDraft(draftKey);
            showThread(threadId);
          } catch (_) {}
        });
      }
    } catch (_) {
      root.innerHTML = `<div class="glass-card rounded-2xl p-8 text-center text-sm text-outline">Unable to load this thread.</div>`;
    }
  }

  function postHtml(p, canAccept, threadId) {
    return `
      <article class="glass-card rounded-2xl p-4 flex gap-4 ${p.is_answer ? 'border-emerald-500/40 bg-emerald-500/[0.04]' : ''}">
        ${voteColumnHtml('FORUM_POST', p.id, p.score, p.my_vote)}
        <div class="flex-1 min-w-0">
          ${p.is_answer ? '<div class="flex items-center gap-1.5 text-[11px] font-bold text-emerald-400 mb-1.5"><span class="material-symbols-outlined text-sm" aria-hidden="true">check_circle</span>Accepted answer</div>' : ''}
          <p class="text-sm text-white/90 leading-relaxed whitespace-pre-wrap break-words">${escapeHtml(p.content)}</p>
          <div class="flex items-center gap-3 mt-2.5 text-[11px] text-outline">
            <span>${escapeHtml(p.author_name || 'Unknown')} · ${timeAgo(p.created_at)}</span>
            <span class="flex-1"></span>
            ${
              canAccept && !p.is_answer
                ? `<button class="accept-btn font-semibold text-emerald-400 hover:text-emerald-300" data-post-id="${p.id}" data-thread-id="${threadId}">Accept answer</button>`
                : ''
            }
          </div>
        </div>
      </article>`;
  }

  function bindAcceptButtons(threadId) {
    root.querySelectorAll('.accept-btn').forEach((btn) => {
      btn.addEventListener('click', async () => {
        try {
          await acceptAnswer(threadId, btn.dataset.postId);
          showToast({ title: 'Answer accepted', message: 'The author earned XP for helping.', type: 'success' });
          showThread(threadId);
        } catch (_) {}
      });
    });
  }

  document.getElementById('btnNewThread').addEventListener('click', () => {
    openModal({
      title: 'Start a discussion',
      contentHtml: `
        <div class="space-y-3.5">
          <div>
            <label class="field__label" style="margin-bottom:.375rem;display:block">Title</label>
            <input id="threadTitle" maxlength="160" placeholder="What do you want to ask or share?"
              class="input" />
          </div>
          <div>
            <label class="field__label" style="margin-bottom:.375rem;display:block">Category</label>
            <select id="threadCategory" class="select">
              <option value="general">General</option>
              <option value="help">Help</option>
              <option value="showcase">Showcase</option>
              <option value="resources">Resources</option>
            </select>
          </div>
          <div>
            <label class="field__label" style="margin-bottom:.375rem;display:block">Body</label>
            <textarea id="threadBody" rows="4" maxlength="8000" placeholder="Add the details…"
              class="input"></textarea>
          </div>
        </div>`,
      onConfirm: async (overlay) => {
        const title = overlay.querySelector('#threadTitle').value.trim();
        if (title.length < 3) {
          showToast({ title: 'Title too short', message: 'Use at least 3 characters.', type: 'error' });
          return false;
        }
        try {
          const created = await createThread({
            title,
            category: overlay.querySelector('#threadCategory').value,
            content: overlay.querySelector('#threadBody').value.trim() || undefined
          });
          showToast({ title: 'Thread created', message: title, type: 'success' });
          showThread(created.thread.id);
          return true;
        } catch (_) {
          return false;
        }
      }
    });
  });

  // Live vote counts ride the existing SSE 'vote' event type.
  if (unsubscribe) unsubscribe();
  unsubscribe = onStreamEvent((event) => {
    if (event.type !== 'vote') return;
    const group = document.querySelector(`[data-vote-group="${event.targetId}"] .vote-score`);
    if (group) group.textContent = event.score;
  });

  if (activeThreadId) showThread(activeThreadId);
  else showList();
}
