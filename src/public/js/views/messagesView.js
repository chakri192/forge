// Messages View: channel list + live thread over SSE
import {
  fetchChannels,
  fetchChannelMessages,
  sendChannelMessage,
  editChannelMessage,
  deleteChannelMessage,
  reactToMessage,
  voteOnMessage,
  searchGifs,
  createChannel,
  fetchTeams
} from '../services/api.js';
import { onStreamEvent } from '../services/stream.js';
import { showToast } from '../components/toast.js';
import { openModal } from '../components/modal.js';
import { withUndo } from '../utils/undo.js';
import { saveDraft, readDraft, clearDraft } from '../utils/drafts.js';
import { renderSkeleton } from '../components/spinner.js';
import { pushHash, currentParam } from '../router/hashRouter.js';
import { escapeHtml, timeAgo } from '../utils/dom.js';
import { renderMessageBody, mediaHtml, isEmbeddableMedia } from '../utils/richText.js';
import { GIF_CATEGORIES, recentGifs, rememberGif } from '../utils/emoji.js';
import { openEmojiPicker } from '../components/emojiPicker.js';
import { attachMentionAutocomplete } from '../components/mentionAutocomplete.js';

const MANAGE_ROLES = ['leader', 'teacher', 'admin', 'DEV_STEALTH', 'STUDENT_LEADER', 'TEACHER'];
const SEEN_KEY = 'forge_channel_seen';

let activeChannelId = null;
let unsubscribeStream = null;

/** Per-channel "last read" marks, used to derive unread state locally. */
function readSeenMap() {
  try {
    return JSON.parse(localStorage.getItem(SEEN_KEY)) || {};
  } catch (_) {
    return {};
  }
}

function markChannelSeen(channelId, at = new Date().toISOString()) {
  const seen = readSeenMap();
  seen[channelId] = at;
  try {
    localStorage.setItem(SEEN_KEY, JSON.stringify(seen));
  } catch (_) {}
}

/**
 * One line of channel-list preview. A message that is only a media link would
 * otherwise render as 64 characters of Giphy tracking URL, which says nothing
 * about the conversation — name the medium instead.
 */
function previewText(body) {
  const text = String(body || '').trim();
  const stripped = text
    .split(/\s+/)
    .filter((word) => !isEmbeddableMedia(word))
    .join(' ')
    .trim();

  if (stripped) return stripped.slice(0, 64);
  return text ? 'GIF' : '';
}

function isChannelUnread(channel, seen) {
  if (!channel.last_message_at) return false;
  const lastSeen = seen[channel.id];
  if (!lastSeen) return true;
  return new Date(channel.last_message_at).getTime() > new Date(lastSeen).getTime();
}

export function renderMessagesView(state) {
  const user = state.currentUser;
  if (!user) {
    return `
      <div class="glass-card p-10 rounded-2xl text-center space-y-2">
        <span class="material-symbols-outlined text-4xl text-outline">forum</span>
        <p class="text-sm text-outline">Sign in to access community messaging.</p>
      </div>`;
  }
  const canManage = MANAGE_ROLES.includes(user.role);

  return `
    <div class="space-y-5">
      <div class="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 class="text-2xl font-extrabold tracking-tight flex items-center gap-2.5">
            <span class="material-symbols-outlined text-3xl accent-target">forum</span> Messages
          </h2>
          <p class="text-xs text-outline mt-1">Community channels with live delivery over SSE.</p>
        </div>
        ${
          canManage
            ? `<button id="btnNewChannel" class="flex items-center gap-1.5 px-4 py-2.5 bg-royal-slate-blue text-white rounded-xl font-bold text-xs hover:opacity-90 transition-all shadow-md">
                <span class="material-symbols-outlined text-base">add</span> New Channel
              </button>`
            : ''
        }
      </div>
      <div class="grid grid-cols-1 md:grid-cols-[280px_1fr] gap-4" style="height: calc(100vh - 240px); min-height: 420px;">
        <div class="glass-card rounded-2xl p-2.5 space-y-1 overflow-y-auto" id="channelList">
          ${[0, 1, 2]
            .map(
              () => `
            <div class="px-3.5 py-2.5 space-y-2">
              ${renderSkeleton('text', { width: '60%', height: '13px' })}
              ${renderSkeleton('text', { width: '85%', height: '10px' })}
            </div>`
            )
            .join('')}
        </div>
        <div class="glass-card rounded-2xl flex flex-col overflow-hidden">
          <div class="px-5 py-3.5 border-b border-white/10 flex items-center gap-2 min-h-[52px]" id="threadHeader">
            <span class="text-sm font-semibold text-outline">Select a channel</span>
          </div>
          <div class="flex-1 overflow-y-auto p-5 space-y-4" id="threadBody">
            <div class="h-full flex flex-col items-center justify-center gap-2 text-center py-10">
              <span class="material-symbols-outlined text-4xl text-outline">chat_bubble</span>
              <p class="text-outline text-sm">Pick a channel on the left to start chatting.</p>
            </div>
          </div>
          <form class="p-3.5 border-t border-white/10 flex gap-2.5 hidden" id="composerForm">
            <textarea id="composerInput" rows="1" maxlength="4000" autocomplete="off" placeholder="Write a message…  (Shift+Enter for a new line)"
              class="flex-1 resize-none bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-outline focus:outline-none focus:border-royal-slate-blue/60 transition-colors"></textarea>
            <button type="button" id="btnComposerEmoji" class="composer-tool" aria-label="Insert emoji" title="Emoji">
              <span class="material-symbols-outlined" aria-hidden="true">mood</span>
            </button>
            <button type="button" id="btnComposerGif" class="composer-tool" aria-label="Insert a GIF" title="GIF">
              <span class="material-symbols-outlined" aria-hidden="true">gif_box</span>
            </button>
            <button type="submit" class="flex items-center gap-1.5 px-5 py-2.5 bg-royal-slate-blue text-white rounded-xl font-bold text-xs hover:opacity-90 transition-all shadow-md">
              <span class="material-symbols-outlined text-base">send</span>
            </button>
          </form>
        </div>
      </div>
    </div>`;
}

export function attachMessagesEvents(state) {
  const user = state.currentUser;
  if (!user) return;

  const channelListEl = document.getElementById('channelList');
  const threadHeaderEl = document.getElementById('threadHeader');
  const threadBodyEl = document.getElementById('threadBody');
  const composerForm = document.getElementById('composerForm');
  const composerInput = document.getElementById('composerInput');
  if (composerInput) attachMentionAutocomplete(composerInput);

  let channels = [];
  const isAdmin = user.role === 'admin' || user.role === 'DEV_STEALTH';

  const channelIcon = (c) =>
    c.type === 'announcement' ? 'campaign' : c.is_private ? 'lock' : 'tag';

  function renderChannelList() {
    if (!channels.length) {
      channelListEl.innerHTML = `
        <div class="flex flex-col items-center justify-center gap-2 py-10 text-center">
          <span class="material-symbols-outlined text-3xl text-outline">tag</span>
          <p class="text-outline text-xs">No channels yet.</p>
        </div>`;
      return;
    }
    const seen = readSeenMap();
    let unreadTotal = 0;

    channelListEl.innerHTML = channels
      .map((c) => {
        const active = c.id === activeChannelId;
        const unread = !active && isChannelUnread(c, seen);
        if (unread) unreadTotal += 1;
        return `
          <button data-channel-id="${c.id}" class="channel-item w-full text-left px-3.5 py-2.5 rounded-xl transition-all ${
            active
              ? 'bg-royal-slate-blue/20 border border-royal-slate-blue/40 text-white'
              : 'text-outline hover:text-white hover:bg-white/5 border border-transparent'
          }">
            <span class="flex items-center gap-2 text-[13px] ${unread ? 'font-bold text-white' : 'font-semibold'}">
              <span class="material-symbols-outlined text-base ${active ? 'accent-target' : ''}">${channelIcon(c)}</span>
              <span class="truncate">${escapeHtml(c.name)}</span>
              ${
                unread
                  ? '<span class="ml-auto w-2 h-2 rounded-full bg-royal-slate-blue shrink-0" aria-label="Unread messages"></span>'
                  : c.type === 'announcement'
                    ? '<span class="ml-auto text-[9px] font-bold uppercase tracking-wider text-amber-400/80">Read-only</span>'
                    : ''
              }
            </span>
            ${
              c.last_message
                ? `<span class="block text-[11px] ${unread ? 'text-white/70' : 'text-outline'} truncate mt-1 pl-6">${escapeHtml(previewText(c.last_message))}</span>`
                : `<span class="block text-[11px] text-outline/60 italic mt-1 pl-6">No messages yet</span>`
            }
          </button>`;
      })
      .join('');

    // Surface the total on the sidebar nav item so unread activity is visible
    // from anywhere in the app.
    document.dispatchEvent(
      new CustomEvent('forge:unread-channels', { detail: { count: unreadTotal } })
    );

    channelListEl.querySelectorAll('.channel-item').forEach((btn) => {
      btn.addEventListener('click', () => openChannel(btn.dataset.channelId));
    });
  }

  function initialsOf(name) {
    return String(name || '?')
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0] || '')
      .join('')
      .toUpperCase();
  }

  function reactionBarHtml(m, mine) {
    const list = m.reactions || [];
    const score = Number(m.score || 0);
    const myVote = Number(m.my_vote || 0);
    return `
      <div class="msg-meta mt-1.5 flex flex-wrap items-center gap-1.5 ${mine ? 'justify-end' : ''}">
        ${list
          .map(
            (r) => `
          <button class="msg-reaction ${r.mine ? 'is-mine' : ''}" data-message-id="${m.id}"
            data-emoji="${escapeHtml(r.emoji)}"
            aria-pressed="${r.mine ? 'true' : 'false'}"
            aria-label="${escapeHtml(r.emoji)} — ${r.count} ${r.count === 1 ? 'reaction' : 'reactions'}">
            <span aria-hidden="true">${escapeHtml(r.emoji)}</span><span class="msg-reaction__n">${r.count}</span>
          </button>`
          )
          .join('')}
        <button class="msg-react-add" data-message-id="${m.id}" aria-label="Add a reaction" title="Add a reaction">
          <span class="material-symbols-outlined" aria-hidden="true">add_reaction</span>
        </button>
        <span class="msg-vote" data-message-id="${m.id}">
          <button class="msg-vote__btn ${myVote === 1 ? 'is-on' : ''}" data-vote="1"
            data-message-id="${m.id}" aria-label="Upvote" aria-pressed="${myVote === 1}">
            <span class="material-symbols-outlined" aria-hidden="true">arrow_upward</span>
          </button>
          <span class="msg-vote__score ${score > 0 ? 'is-pos' : score < 0 ? 'is-neg' : ''}">${score}</span>
          <button class="msg-vote__btn ${myVote === -1 ? 'is-on' : ''}" data-vote="-1"
            data-message-id="${m.id}" aria-label="Downvote" aria-pressed="${myVote === -1}">
            <span class="material-symbols-outlined" aria-hidden="true">arrow_downward</span>
          </button>
        </span>
      </div>`;
  }

  function messageHtml(m, { pending = false } = {}) {
    const mine = m.user_id === user.id;
    const canEdit = mine && !pending;
    const canDelete = (mine || isAdmin) && !pending;
    const edited = m.updated_at && m.updated_at !== m.created_at ? ' · edited' : '';
    const { html: body, media } = renderMessageBody(m.content, user.username);
    return `
      <div class="msg-row group flex gap-3 ${mine ? 'flex-row-reverse' : ''} ${pending ? 'opacity-60' : ''}" data-message-id="${m.id}">
        <div class="w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-[10px] font-bold ${
          mine ? 'bg-royal-slate-blue/40 text-white' : 'bg-white/10 text-outline'
        }">${escapeHtml(initialsOf(m.user_name))}</div>
        <div class="max-w-[75%] ${mine ? 'text-right' : ''}">
          <div class="text-[11px] text-outline mb-1">${escapeHtml(m.user_name || 'Unknown')} · ${timeAgo(m.created_at)}${edited}</div>
          ${
            body
              ? `<div class="msg-bubble inline-block text-left px-4 py-2.5 rounded-2xl text-[13px] leading-relaxed break-words ${
                  mine
                    ? 'bg-royal-slate-blue/25 border border-royal-slate-blue/40 rounded-tr-md'
                    : 'bg-white/5 border border-white/10 rounded-tl-md'
                }" data-raw="${escapeHtml(m.content)}">${body}</div>`
              : `<span class="msg-bubble hidden" data-raw="${escapeHtml(m.content)}"></span>`
          }
          ${mediaHtml(media)}
          ${pending ? '' : reactionBarHtml(m, mine)}
          ${
            canEdit || canDelete
              ? `<div class="opacity-0 group-hover:opacity-100 transition-opacity mt-1 flex gap-2.5 ${mine ? 'justify-end' : ''}">
                  ${canEdit ? `<button class="msg-edit text-[11px] font-semibold text-outline hover:text-white" data-message-id="${m.id}">Edit</button>` : ''}
                  ${canDelete ? `<button class="msg-delete text-[11px] font-semibold text-red-400/80 hover:text-red-300" data-message-id="${m.id}">Delete</button>` : ''}
                </div>`
              : ''
          }
        </div>
      </div>`;
  }

  // 'error' does not bubble, so this listens in the capture phase on the
  // container instead of per-image. Remote hosts delete GIFs regularly, and a
  // dead embed should leave a usable link, not a blank space.
  threadBodyEl.addEventListener(
    'error',
    (e) => {
      const img = e.target;
      if (!(img instanceof HTMLImageElement) || !img.classList.contains('msg-media__item')) return;
      const link = document.createElement('a');
      link.href = img.src;
      link.target = '_blank';
      link.rel = 'noopener noreferrer nofollow';
      link.className = 'msg-media__broken';
      link.textContent = 'Media unavailable — open original';
      img.replaceWith(link);
    },
    true
  );

  function emptyThreadHtml() {
    return `
      <div class="h-full flex flex-col items-center justify-center gap-2 text-center py-10" id="threadEmpty">
        <span class="material-symbols-outlined text-4xl text-outline">waving_hand</span>
        <p class="text-outline text-sm">No messages yet — say hello!</p>
      </div>`;
  }

  function bindMessageActions() {
    threadBodyEl.querySelectorAll('.msg-delete').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.messageId;
        const row = threadBodyEl.querySelector(`[data-message-id="${id}"]`);
        if (!row) return;
        const anchor = row.nextElementSibling;

        // No confirm dialog: hide it now, delete for real in 6s unless undone.
        withUndo({
          title: 'Message deleted',
          message: 'It will be removed for everyone.',
          optimistic: () => row.remove(),
          revert: () => {
            if (anchor && anchor.isConnected) threadBodyEl.insertBefore(row, anchor);
            else threadBodyEl.appendChild(row);
            bindMessageActions();
          },
          apply: () => deleteChannelMessage(id)
        });
      });
    });

    threadBodyEl.querySelectorAll('.msg-reaction').forEach((btn) => {
      btn.addEventListener('click', () => toggleReaction(btn.dataset.messageId, btn.dataset.emoji));
    });

    threadBodyEl.querySelectorAll('.msg-react-add').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        openEmojiPicker(btn, (emoji) => toggleReaction(btn.dataset.messageId, emoji));
      });
    });

    threadBodyEl.querySelectorAll('.msg-vote__btn').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const id = btn.dataset.messageId;
        // Re-sending the same value clears the vote server-side, which is how
        // the forum arrows already behave — no separate "unvote" call.
        try {
          const res = await voteOnMessage(id, Number(btn.dataset.vote));
          applyVote(id, res.score, res.value);
        } catch (_) {
          /* requestApi surfaces the reason */
        }
      });
    });

    threadBodyEl.querySelectorAll('.msg-edit').forEach((btn) => {
      btn.addEventListener('click', () => {
        const row = threadBodyEl.querySelector(`[data-message-id="${btn.dataset.messageId}"]`);
        const current = row?.querySelector('.msg-bubble')?.dataset.raw ?? '';
        openModal({
          title: 'Edit message',
          contentHtml: `
            <textarea id="editMessageInput" maxlength="4000" rows="4"
              class="input">${escapeHtml(current)}</textarea>`,
          onConfirm: async (overlay) => {
            const content = overlay.querySelector('#editMessageInput').value.trim();
            if (!content) return false;
            try {
              await editChannelMessage(btn.dataset.messageId, content);
              return true;
            } catch (_) {
              return false;
            }
          }
        });
      });
    });
  }

  async function openChannel(channelId) {
    activeChannelId = channelId;
    markChannelSeen(channelId);
    pushHash('messages', channelId);
    renderChannelList();
    try {
      const { channel, messages } = await fetchChannelMessages(channelId);
      threadHeaderEl.innerHTML = `
        <span class="material-symbols-outlined text-lg accent-target">${channelIcon(channel)}</span>
        <span class="text-sm font-bold">${escapeHtml(channel.name)}</span>
        <span class="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-outline ml-1.5">${channel.type}</span>
        ${channel.is_private ? '<span class="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/25 text-amber-400">Private</span>' : ''}`;
      threadBodyEl.innerHTML = messages.length ? messages.map(messageHtml).join('') : emptyThreadHtml();
      bindMessageActions();
      composerForm.classList.remove('hidden');
      composerInput.value = readDraft(`channel:${channelId}`) || '';
      composerInput.focus();
      threadBodyEl.scrollTop = threadBodyEl.scrollHeight;
      if (messages.length) markChannelSeen(channelId, messages[messages.length - 1].created_at);
    } catch (_) {
      threadBodyEl.innerHTML = `
        <div class="h-full flex flex-col items-center justify-center gap-2 text-center py-10">
          <span class="material-symbols-outlined text-4xl text-outline">lock</span>
          <p class="text-outline text-sm">Unable to load this channel.</p>
        </div>`;
    }
  }

  async function refreshChannels() {
    try {
      const data = await fetchChannels();
      channels = data.channels || [];
      renderChannelList();
    } catch (_) {}
  }

  /** Replace one message's reaction pills without re-rendering the thread. */
  function applyReactions(messageId, reactions) {
    const row = threadBodyEl.querySelector(`[data-message-id="${messageId}"]`);
    if (!row) return;
    const meta = row.querySelector('.msg-meta');
    if (!meta) return;
    const mine = row.classList.contains('flex-row-reverse');
    const vote = meta.querySelector('.msg-vote');
    const score = Number(vote?.querySelector('.msg-vote__score')?.textContent || 0);
    const myVote = vote?.querySelector('.msg-vote__btn.is-on');
    meta.outerHTML = reactionBarHtml(
      {
        id: messageId,
        reactions,
        score,
        my_vote: myVote ? Number(myVote.dataset.vote) : 0
      },
      mine
    );
    bindMessageActions();
  }

  function applyVote(messageId, score, myValue) {
    const wrap = threadBodyEl.querySelector(`.msg-vote[data-message-id="${messageId}"]`);
    if (!wrap) return;
    const scoreEl = wrap.querySelector('.msg-vote__score');
    scoreEl.textContent = score;
    scoreEl.classList.toggle('is-pos', score > 0);
    scoreEl.classList.toggle('is-neg', score < 0);
    wrap.querySelectorAll('.msg-vote__btn').forEach((b) => {
      const on = myValue !== undefined && Number(b.dataset.vote) === Number(myValue);
      b.classList.toggle('is-on', on);
      b.setAttribute('aria-pressed', String(on));
    });
  }

  async function toggleReaction(messageId, emoji) {
    try {
      const res = await reactToMessage(messageId, emoji);
      applyReactions(messageId, res.reactions);
    } catch (_) {
      /* requestApi surfaces the reason */
    }
  }

  composerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const content = composerInput.value.trim();
    if (!content || !activeChannelId) return;
    composerInput.value = '';
    clearDraft(`channel:${activeChannelId}`);

    // Show the message immediately at reduced opacity; the SSE echo replaces
    // this placeholder with the server's copy (dedupe keys off the real id).
    const pendingId = `pending_${Date.now()}`;
    const channelAtSend = activeChannelId;
    document.getElementById('threadEmpty')?.remove();
    threadBodyEl.insertAdjacentHTML(
      'beforeend',
      messageHtml(
        {
          id: pendingId,
          user_id: user.id,
          user_name: user.name,
          content,
          created_at: new Date().toISOString()
        },
        { pending: true }
      )
    );
    threadBodyEl.scrollTop = threadBodyEl.scrollHeight;

    try {
      const { message } = await sendChannelMessage(channelAtSend, content);
      const placeholder = threadBodyEl.querySelector(`[data-message-id="${pendingId}"]`);
      if (placeholder) {
        if (threadBodyEl.querySelector(`[data-message-id="${message.id}"]`)) placeholder.remove();
        else {
          placeholder.outerHTML = messageHtml(message);
          bindMessageActions();
        }
      }
    } catch (err) {
      const placeholder = threadBodyEl.querySelector(`[data-message-id="${pendingId}"]`);
      if (placeholder) {
        placeholder.classList.add('opacity-60');
        const bubble = placeholder.querySelector('.msg-bubble');
        if (bubble) bubble.classList.add('border-red-500/50');
        const retry = document.createElement('button');
        retry.className = 'text-[11px] font-semibold text-red-400 hover:text-red-300 mt-1';
        retry.textContent = 'Failed — retry';
        retry.addEventListener('click', () => {
          placeholder.remove();
          composerInput.value = content;
          composerForm.requestSubmit();
        });
        placeholder.querySelector('div:last-child')?.appendChild(retry);
      }
    }
  });

  // Enter sends, Shift+Enter inserts a newline — the convention every chat app
  // shares. The textarea also grows with the message up to a sane ceiling.
  composerInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      composerForm.requestSubmit();
    }
  });

  // Keep unsent text across reloads and channel switches.
  composerInput.addEventListener('input', () => {
    if (activeChannelId) saveDraft(`channel:${activeChannelId}`, composerInput.value);
    composerInput.style.height = 'auto';
    composerInput.style.height = `${Math.min(composerInput.scrollHeight, 140)}px`;
  });

  document.getElementById('btnComposerEmoji')?.addEventListener('click', (e) => {
    e.stopPropagation();
    openEmojiPicker(e.currentTarget, (emoji) => {
      const at = composerInput.selectionStart ?? composerInput.value.length;
      composerInput.value = `${composerInput.value.slice(0, at)}${emoji}${composerInput.value.slice(at)}`;
      composerInput.focus();
      composerInput.selectionStart = composerInput.selectionEnd = at + emoji.length;
      if (activeChannelId) saveDraft(`channel:${activeChannelId}`, composerInput.value);
    });
  });

  document.getElementById('btnComposerGif')?.addEventListener('click', () => openGifPicker());

  /**
   * GIF picker. Search runs through our own server so no third-party API key
   * reaches the browser; when search is not configured the same dialog still
   * accepts a pasted link, which is the common case for a self-hosted install.
   */
  /**
   * GIF picker. Opens on recents, then categories, so it is never an empty
   * box. Search proxies through our server so no third-party key reaches the
   * browser; without one configured the dialog says so and still takes a link.
   */
  function openGifPicker() {
    let chosen = null;

    openModal({
      title: 'Send a GIF',
      confirmLabel: 'Send',
      contentHtml: `
        <div class="gifp">
          <div class="row row--tight">
            <input class="input" id="gifQuery" placeholder="Search GIFs…" maxlength="60"
              autocomplete="off" aria-label="Search GIFs" />
            <button type="button" class="btn" id="gifSearchBtn">Search</button>
          </div>
          <div class="gifp__chips" id="gifChips">
            ${GIF_CATEGORIES.map(
              (c) => `<button type="button" class="chip gifp__chip" data-gif-suggest="${escapeHtml(c)}">${escapeHtml(c)}</button>`
            ).join('')}
          </div>
          <div class="gifp__results" id="gifResults"></div>
          <details class="gifp__link">
            <summary>Paste a link instead</summary>
            <input class="input mono" id="gifUrl" autocomplete="off"
              placeholder="https://media.tenor.com/…/example.gif" />
            <p class="field__hint">
              An embedded GIF loads from whoever hosts it, so that host sees the
              IP of everyone who views this channel.
            </p>
          </details>
        </div>`,
      onOpen: (overlay) => {
        const results = overlay.querySelector('#gifResults');
        const queryEl = overlay.querySelector('#gifQuery');
        const urlEl = overlay.querySelector('#gifUrl');

        const select = (gif, tile) => {
          chosen = gif;
          urlEl.value = gif.url;
          results.querySelectorAll('.gifp__tile').forEach((el) => el.classList.remove('is-selected'));
          tile?.classList.add('is-selected');
        };

        const paint = (gifs, emptyNote) => {
          if (!gifs.length) {
            results.innerHTML = `<p class="gifp__note">${escapeHtml(emptyNote)}</p>`;
            return;
          }
          results.innerHTML = gifs
            .map(
              (g) => `
              <button type="button" class="gifp__tile" data-url="${escapeHtml(g.url)}"
                aria-label="${escapeHtml(g.description || 'GIF')}">
                <img src="${escapeHtml(g.preview)}" alt="${escapeHtml(g.description || 'GIF')}"
                  loading="lazy" referrerpolicy="no-referrer" />
              </button>`
            )
            .join('');
          results.querySelectorAll('.gifp__tile').forEach((tile) => {
            const gif = gifs.find((g) => g.url === tile.dataset.url);
            tile.addEventListener('click', () => select(gif, tile));
            tile.addEventListener('dblclick', () => {
              select(gif, tile);
              overlay.querySelector('#modalConfirmBtn').click();
            });
          });
        };

        const runSearch = async (term) => {
          if (!term) return;
          queryEl.value = term;
          results.innerHTML = '<p class="gifp__note">Searching…</p>';
          try {
            const data = await searchGifs(term);
            if (!data.configured) {
              results.innerHTML = `<p class="gifp__note">${escapeHtml(data.message)}</p>`;
              overlay.querySelector('.gifp__link').open = true;
              return;
            }
            paint(data.results, `Nothing matched “${term}”.`);
          } catch (_) {
            results.innerHTML = '<p class="gifp__note">GIF search is unavailable.</p>';
            overlay.querySelector('.gifp__link').open = true;
          }
        };

        overlay.querySelector('#gifSearchBtn').addEventListener('click', () => runSearch(queryEl.value.trim()));
        queryEl.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            runSearch(queryEl.value.trim());
          }
        });
        overlay.querySelectorAll('[data-gif-suggest]').forEach((chip) =>
          chip.addEventListener('click', () => runSearch(chip.dataset.gifSuggest))
        );

        // Open on what you used last; it is the likeliest next choice.
        const recents = recentGifs();
        if (recents.length) paint(recents, '');
        else results.innerHTML = '<p class="gifp__note">Pick a category above, or search.</p>';
      },
      onConfirm: (overlay) => {
        const url = (chosen?.url || overlay.querySelector('#gifUrl').value).trim();
        if (!url) {
          showToast({ title: 'Pick a GIF first', type: 'error' });
          return false;
        }
        if (!isEmbeddableMedia(url)) {
          showToast({
            title: 'That link will not embed',
            message: 'Use a direct .gif/.png/.jpg link from a supported host.',
            type: 'error'
          });
          return false;
        }
        if (chosen) rememberGif(chosen);
        composerInput.value = `${composerInput.value.trim()} ${url}`.trim();
        composerForm.requestSubmit();
        return true;
      }
    });
  }

  const newChannelBtn = document.getElementById('btnNewChannel');
  if (newChannelBtn) {
    newChannelBtn.addEventListener('click', async () => {
      let teams = [];
      try {
        teams = (await fetchTeams()) || [];
      } catch (_) {}
      openModal({
        title: 'Create channel',
        contentHtml: `
          <div class="space-y-4">
            <div>
              <label class="field__label" style="margin-bottom:.375rem;display:block">Name</label>
              <input id="newChannelName" maxlength="60" placeholder="e.g. project-updates"
                class="input" />
            </div>
            <input type="hidden" id="newChannelType" value="text" />
            <p class="text-[11px] text-outline">
              Need a broadcast that everyone reads but nobody replies to? Use
              <strong class="text-white">Announcements</strong> instead — it supports priority and audience targeting.
            </p>
            ${
              teams.length
                ? `<div>
                    <label class="field__label" style="margin-bottom:.375rem;display:block">Visibility</label>
                    <select id="newChannelTeam" class="select">
                      <option value="">Public — visible to everyone</option>
                      ${teams.map((t) => `<option value="${t.id}">Private — ${escapeHtml(t.name)} only</option>`).join('')}
                    </select>
                  </div>`
                : ''
            }
          </div>`,
        onConfirm: async (overlay) => {
          const name = overlay.querySelector('#newChannelName').value.trim();
          if (!name) {
            showToast({ title: 'Name required', message: 'Give the channel a name.', type: 'error' });
            return false;
          }
          const teamId = overlay.querySelector('#newChannelTeam')?.value || '';
          try {
            const data = await createChannel({
              name,
              type: overlay.querySelector('#newChannelType').value,
              ...(teamId ? { team_id: teamId, is_private: true } : {})
            });
            showToast({ title: 'Channel created', message: `#${data.channel.name} is live`, type: 'success' });
            await refreshChannels();
            openChannel(data.channel.id);
            return true;
          } catch (_) {
            return false;
          }
        }
      });
    });
  }

  if (unsubscribeStream) unsubscribeStream();
  unsubscribeStream = onStreamEvent((event) => {
    if (!document.getElementById('threadBody')) return;

    // Reaction and vote broadcasts carry no viewer-specific state, so keep the
    // local "mine"/"my vote" flags and only refresh the shared counts.
    if (event.type === 'reaction') {
      const row = threadBodyEl.querySelector(`[data-message-id="${event.messageId}"]`);
      if (!row) return;
      const previous = row.querySelectorAll('.msg-reaction.is-mine');
      const minesByEmoji = new Set([...previous].map((b) => b.dataset.emoji));
      applyReactions(
        event.messageId,
        (event.reactions || []).map((r) => ({ ...r, mine: minesByEmoji.has(r.emoji) }))
      );
      return;
    }
    if (event.type === 'vote') {
      applyVote(event.messageId, event.score);
      return;
    }

    if (event.type !== 'message') return;
    if (event.action === 'created' && event.channelId === activeChannelId) {
      markChannelSeen(activeChannelId, event.message.created_at);
    }
    if (event.channelId === activeChannelId) {
      const existing = threadBodyEl.querySelector(`[data-message-id="${event.message.id}"]`);
      if (event.action === 'deleted') {
        existing?.remove();
        if (!threadBodyEl.querySelector('.msg-row')) threadBodyEl.innerHTML = emptyThreadHtml();
      } else if (event.action === 'updated' && existing) {
        existing.outerHTML = messageHtml(event.message);
        bindMessageActions();
      } else if (event.action === 'created' && !existing) {
        document.getElementById('threadEmpty')?.remove();
        threadBodyEl.insertAdjacentHTML('beforeend', messageHtml(event.message));
        bindMessageActions();
        threadBodyEl.scrollTop = threadBodyEl.scrollHeight;
      }
    }
    refreshChannels();
  });

  // Deep link (#/messages/chn_123) wins over the previously active channel.
  const linkedChannel = currentParam();
  if (linkedChannel) activeChannelId = linkedChannel;

  refreshChannels().then(() => {
    if (activeChannelId && channels.some((c) => c.id === activeChannelId)) {
      openChannel(activeChannelId);
    }
  });
}


