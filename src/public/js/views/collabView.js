// Collaboration hub: one task, four tabs, and the activity behind it.
//
// The parts already existed on four different screens. What was missing was a
// place that answers "where are we on this" without a tour of the app.
import { fetchCollabHub, createMeetingNote, updateMeetingNote, deleteMeetingNote } from '../services/api.js';
import { fetchChannelMessages, sendChannelMessage } from '../services/api.js';
import { renderSkeleton } from '../components/spinner.js';
import { showToast } from '../components/toast.js';
import { showConfirmDialog } from '../components/confirmDialog.js';
import { escapeHtml, timeAgo } from '../utils/dom.js';
import { renderMessageBody, mediaHtml } from '../utils/richText.js';
import { currentParam, pushHash } from '../router/hashRouter.js';
import { attachMentionAutocomplete } from '../components/mentionAutocomplete.js';

const TABS = [
  { id: 'chat', label: 'Chat', icon: 'forum' },
  { id: 'files', label: 'Files', icon: 'folder' },
  { id: 'progress', label: 'Progress', icon: 'checklist' },
  { id: 'notes', label: 'Notes', icon: 'edit_note' }
];

export function renderCollabView(state) {
  if (!state.currentUser) {
    return `<div class="empty"><p class="empty__text">Sign in to open a workspace.</p></div>`;
  }
  if (!currentParam()) {
    return `
      <div class="empty">
        <p class="empty__title">No task selected</p>
        <p class="empty__text">Open a task and choose Workspace to get here.</p>
      </div>`;
  }
  return `<div id="collabRoot" class="stack">${renderSkeleton('card', { className: '' })}</div>`;
}

export function attachCollabEvents(state) {
  if (!state.currentUser) return;
  const root = document.getElementById('collabRoot');
  if (!root) return;

  const taskId = currentParam();
  let hub = null;
  let tab = sessionStorage.getItem('forge_collab_tab') || 'chat';

  async function load() {
    try {
      hub = await fetchCollabHub(taskId);
      paint();
    } catch (err) {
      root.innerHTML = `
        <div class="empty">
          <p class="empty__title">${err.status === 403 ? 'Not your workspace' : 'Could not open this workspace'}</p>
          <p class="empty__text">${escapeHtml(
            err.status === 403
              ? 'A task workspace is for the team working on it and the people reviewing it.'
              : 'The task may have been removed.'
          )}</p>
        </div>`;
    }
  }

  function paint() {
    root.innerHTML = `
      <div class="collab">
        <header class="collab__head">
          <div>
            <p class="collab__eyebrow">Workspace</p>
            <h1 class="collab__title">${escapeHtml(hub.task.title)}</h1>
          </div>
          <span class="collab__status">${escapeHtml(String(hub.task.status).replace(/_/g, ' '))}</span>
        </header>

        <nav class="collab__tabs" role="tablist">
          ${TABS.map(
            (t) => `
            <button class="collab__tab ${t.id === tab ? 'is-active' : ''}" role="tab"
              aria-selected="${t.id === tab}" data-tab="${t.id}">
              <span class="material-symbols-outlined" aria-hidden="true">${t.icon}</span>
              ${t.label}
              ${badgeFor(t.id)}
            </button>`
          ).join('')}
        </nav>

        <div class="collab__body" id="collabPanel">${panelHtml()}</div>

        ${
          hub.activity.length
            ? `<details class="collab__activity">
                 <summary>Activity · ${hub.activity.length}</summary>
                 <ol class="collab__timeline">
                   ${hub.activity
                     .map(
                       (a) => `
                     <li>
                       <span class="collab__timeline-what">${escapeHtml(String(a.action).replace(/_/g, ' '))}</span>
                       <span class="collab__timeline-who">${escapeHtml(a.actor || 'System')} · ${escapeHtml(timeAgo(a.created_at))}</span>
                     </li>`
                     )
                     .join('')}
                 </ol>
               </details>`
            : ''
        }
      </div>`;
    bind();
  }

  /** A count only where it tells you something you would act on. */
  function badgeFor(id) {
    if (id === 'files' && hub.files.length) return `<span class="collab__count">${hub.files.length}</span>`;
    if (id === 'notes' && hub.notes.length) return `<span class="collab__count">${hub.notes.length}</span>`;
    if (id === 'progress' && hub.progress.total) {
      return `<span class="collab__count">${hub.progress.done}/${hub.progress.total}</span>`;
    }
    return '';
  }

  function panelHtml() {
    if (tab === 'files') return filesHtml();
    if (tab === 'progress') return progressHtml();
    if (tab === 'notes') return notesHtml();
    return chatHtml();
  }

  /* --- chat ------------------------------------------------------------- */

  function chatHtml() {
    if (!hub.channel) {
      return `
        <div class="empty">
          <p class="empty__title">No team channel yet</p>
          <p class="empty__text">A channel appears here once a team is assigned to this task.</p>
        </div>`;
    }
    return `
      <div class="collab__chat">
        <div class="collab__thread" id="collabThread">${renderSkeleton('text', { width: '70%' })}</div>
        <form class="collab__composer" id="collabComposer">
          <textarea id="collabInput" rows="1" maxlength="4000" autocomplete="off"
            placeholder="Message the team…  (Shift+Enter for a new line)"></textarea>
          <button type="submit" class="btn btn--primary">Send</button>
        </form>
      </div>`;
  }

  async function loadThread() {
    const threadEl = document.getElementById('collabThread');
    if (!threadEl || !hub.channel) return;
    try {
      const { messages } = await fetchChannelMessages(hub.channel.id);
      threadEl.innerHTML = messages.length
        ? messages
            .map((m) => {
              const { html, media } = renderMessageBody(m.content, state.currentUser.username);
              return `
                <article class="collab__msg">
                  <span class="collab__msg-who">${escapeHtml(m.user_name || 'Someone')}<span>${escapeHtml(timeAgo(m.created_at))}</span></span>
                  ${html ? `<p class="collab__msg-body">${html}</p>` : ''}
                  ${media.length ? mediaHtml(media) : ''}
                </article>`;
            })
            .join('')
        : '<p class="collab__hint">Nothing said yet. Start the thread.</p>';
      threadEl.scrollTop = threadEl.scrollHeight;
    } catch (_) {
      threadEl.innerHTML = '<p class="collab__hint">Could not load the conversation.</p>';
    }
  }

  /* --- files ------------------------------------------------------------ */

  function filesHtml() {
    if (!hub.files.length) {
      return `
        <div class="empty">
          <p class="empty__title">No files yet</p>
          <p class="empty__text">Submitted work and anything shared in the team channel collects here.</p>
        </div>`;
    }
    return `
      <ul class="collab__files">
        ${hub.files
          .map(
            (f) => `
          <li class="collab__file">
            <span class="material-symbols-outlined" aria-hidden="true">${f.source === 'submission' ? 'assignment_turned_in' : 'attachment'}</span>
            <span class="collab__file-main">
              <span class="collab__file-name">${escapeHtml(f.name || 'File')}</span>
              <span class="collab__file-meta">
                ${escapeHtml(f.uploader || 'Someone')} · ${escapeHtml(timeAgo(f.created_at))}
                · ${f.source === 'submission' ? 'submitted for review' : 'shared in chat'}
              </span>
            </span>
            ${
              f.source === 'submission'
                ? `<button type="button" class="linklike" data-attachment="${escapeHtml(f.url)}">Open</button>`
                : `<a href="${escapeHtml(f.url)}" target="_blank" rel="noopener noreferrer">Open</a>`
            }
          </li>`
          )
          .join('')}
      </ul>`;
  }

  /* --- progress --------------------------------------------------------- */

  function progressHtml() {
    const { subtasks, done, total, percent } = hub.progress;
    if (!total) {
      return `
        <div class="empty">
          <p class="empty__title">No subtasks</p>
          <p class="empty__text">Break the task into steps and progress shows up here.</p>
        </div>`;
    }
    return `
      <div class="collab__progress">
        <div class="collab__meter" role="img" aria-label="${percent}% complete">
          <div class="collab__meter-fill" style="width:${percent}%"></div>
        </div>
        <p class="collab__hint">${done} of ${total} done · ${percent}%</p>
        <ul class="collab__subtasks">
          ${subtasks
            .map(
              (s) => `
            <li class="collab__subtask ${s.is_completed ? 'is-done' : ''}">
              <span class="material-symbols-outlined" aria-hidden="true">${s.is_completed ? 'check_circle' : 'radio_button_unchecked'}</span>
              <span class="collab__subtask-title">${escapeHtml(s.title)}</span>
              ${s.assignee ? `<span class="collab__subtask-who">${escapeHtml(s.assignee)}</span>` : ''}
            </li>`
            )
            .join('')}
        </ul>
      </div>`;
  }

  /* --- notes ------------------------------------------------------------ */

  function notesHtml() {
    return `
      <div class="collab__notes">
        <button class="btn btn--primary btn--sm" data-new-note>New note</button>
        ${
          hub.notes.length
            ? hub.notes
                .map(
                  (n) => `
              <article class="collab__note" data-note="${escapeHtml(n.id)}">
                <header class="collab__note-head">
                  <h3>${escapeHtml(n.title)}</h3>
                  <span class="collab__note-meta">${escapeHtml(n.author || 'Someone')} · ${escapeHtml(timeAgo(n.updated_at))}</span>
                </header>
                <div class="collab__note-body" data-note-body>${escapeHtml(n.content || '').replace(/\n/g, '<br />')}</div>
                <div class="collab__note-actions">
                  <button type="button" class="linklike" data-edit-note="${escapeHtml(n.id)}">Edit</button>
                  <button type="button" class="linklike collab__danger" data-delete-note="${escapeHtml(n.id)}">Delete</button>
                </div>
              </article>`
                )
                .join('')
            : `<p class="collab__hint">No notes yet. Meeting notes live here, not in chat — they are documents you come back to.</p>`
        }
      </div>`;
  }

  function noteEditor(note = null) {
    const panel = document.getElementById('collabPanel');
    panel.innerHTML = `
      <form class="collab__editor" id="noteForm">
        <input id="noteTitle" class="input" maxlength="160" placeholder="Note title"
          value="${escapeHtml(note?.title || '')}" />
        <textarea id="noteContent" rows="12" maxlength="20000"
          placeholder="What was decided, what happens next, who is doing it…">${escapeHtml(note?.content || '')}</textarea>
        <div class="row">
          <button type="submit" class="btn btn--primary">${note ? 'Save' : 'Create'}</button>
          <button type="button" class="btn" data-cancel-note>Cancel</button>
        </div>
      </form>`;

    document.getElementById('noteTitle').focus();
    panel.querySelector('[data-cancel-note]').addEventListener('click', () => {
      panel.innerHTML = notesHtml();
      bindPanel();
    });

    document.getElementById('noteForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const title = document.getElementById('noteTitle').value.trim();
      const content = document.getElementById('noteContent').value;
      if (!title) {
        showToast({ title: 'Give the note a title', type: 'error' });
        return;
      }
      try {
        if (note) await updateMeetingNote(note.id, { title, content });
        else await createMeetingNote(taskId, { title, content });
        showToast({ title: note ? 'Note saved' : 'Note created', type: 'success' });
        await load();
      } catch (_) {
        /* requestApi surfaces the reason */
      }
    });
  }

  /* --- wiring ----------------------------------------------------------- */

  /**
   * Refetches the hub without repainting the open panel, so the tab counts and
   * the other tabs' contents are current while the chat keeps its scroll and
   * the caret stays where it was.
   */
  async function refreshQuietly() {
    try {
      hub = await fetchCollabHub(taskId);
      root.querySelectorAll('[data-tab]').forEach((btn) => {
        const badge = badgeFor(btn.dataset.tab);
        const existing = btn.querySelector('.collab__count');
        if (!badge) return existing?.remove();
        if (existing) existing.outerHTML = badge;
        else btn.insertAdjacentHTML('beforeend', badge);
      });
    } catch (_) {
      /* the message already sent; a stale count is not worth an error */
    }
  }

  function bindPanel() {
    const panel = document.getElementById('collabPanel');

    panel.querySelector('[data-new-note]')?.addEventListener('click', () => noteEditor(null));

    panel.querySelectorAll('[data-edit-note]').forEach((btn) =>
      btn.addEventListener('click', () =>
        noteEditor(hub.notes.find((n) => n.id === btn.dataset.editNote))
      )
    );

    panel.querySelectorAll('[data-delete-note]').forEach((btn) =>
      btn.addEventListener('click', async () => {
        const ok = await showConfirmDialog({
          title: 'Delete this note?',
          message: 'It is the team\'s note, and this removes it for everyone.',
          confirmText: 'Delete',
          danger: true
        });
        if (!ok) return;
        try {
          await deleteMeetingNote(btn.dataset.deleteNote);
          showToast({ title: 'Note deleted', type: 'success' });
          await load();
        } catch (_) {}
      })
    );

    const composer = document.getElementById('collabComposer');
    if (composer) {
      const input = document.getElementById('collabInput');
      attachMentionAutocomplete(input);
      composer.addEventListener('submit', async (e) => {
        e.preventDefault();
        const content = input.value.trim();
        if (!content) return;
        input.value = '';
        try {
          await sendChannelMessage(hub.channel.id, content);
          // A message can carry a file link, which belongs in the Files tab.
          // Without refreshing, sharing something and switching tabs shows
          // nothing until a reload.
          await refreshQuietly();
          await loadThread();
        } catch (_) {
          input.value = content;
        }
      });
      loadThread();
    }
  }

  function bind() {
    root.querySelectorAll('[data-tab]').forEach((btn) =>
      btn.addEventListener('click', () => {
        tab = btn.dataset.tab;
        sessionStorage.setItem('forge_collab_tab', tab);
        paint();
      })
    );
    bindPanel();
  }

  void pushHash;
  load();
}
