// Announcements View: role-scoped broadcasts with priority levels
import {
  fetchAnnouncements,
  createAnnouncement,
  updateAnnouncement,
  deleteAnnouncement
} from '../services/api.js';
import { showToast } from '../components/toast.js';
import { openModal } from '../components/modal.js';
import { showConfirmDialog } from '../components/confirmDialog.js';
import { bindDraft, clearDraft } from '../utils/drafts.js';
import { renderSkeleton } from '../components/spinner.js';
import { escapeHtml, timeAgo } from '../utils/dom.js';

const MANAGE_ROLES = ['leader', 'teacher', 'admin', 'DEV_STEALTH', 'STUDENT_LEADER', 'TEACHER'];

const PRIORITY_STYLES = {
  URGENT: 'bg-red-500/15 text-red-400 border-red-500/30',
  HIGH: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  NORMAL: 'bg-royal-slate-blue/15 accent-target border-royal-slate-blue/30',
  LOW: 'bg-white/5 text-outline border-white/10'
};

const PRIORITY_ICONS = { URGENT: 'priority_high', HIGH: 'keyboard_double_arrow_up', NORMAL: 'campaign', LOW: 'low_priority' };

const AUDIENCE_OPTIONS = [
  ['', 'Everyone'],
  ['member', 'Members only'],
  ['leader', 'Leaders only'],
  ['teacher', 'Teachers only'],
  ['admin', 'Admins only']
];

export function renderAnnouncementsView(state) {
  const user = state.currentUser;
  if (!user) {
    return `
      <div class="glass-card p-10 rounded-2xl text-center space-y-2">
        <span class="material-symbols-outlined text-4xl text-outline">campaign</span>
        <p class="text-sm text-outline">Sign in to read community announcements.</p>
      </div>`;
  }
  const canPost = MANAGE_ROLES.includes(user.role);

  return `
    <div class="space-y-5 max-w-3xl">
      <div>
        <h2 class="text-2xl font-extrabold tracking-tight flex items-center gap-2.5">
          <span class="material-symbols-outlined text-3xl accent-target">campaign</span> Announcements
        </h2>
        <p class="text-xs text-outline mt-1">Broadcasts from leaders, teachers, and admins — delivered live.</p>
      </div>
      ${
        canPost
          ? `<form class="glass-card rounded-2xl p-5 space-y-4" id="announcementForm">
              <h3 class="text-sm font-bold flex items-center gap-2">
                <span class="material-symbols-outlined text-base accent-target">edit_square</span> Publish announcement
              </h3>
              <input id="annTitle" maxlength="120" required placeholder="Title"
                class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-outline focus:outline-none focus:border-royal-slate-blue/60 transition-colors" />
              <textarea id="annContent" maxlength="8000" required rows="3" placeholder="What does the community need to know?"
                class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-outline focus:outline-none focus:border-royal-slate-blue/60 transition-colors"></textarea>
              <div class="flex flex-wrap items-center gap-2.5">
                <select id="annPriority" class="bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none">
                  <option value="NORMAL">Normal priority</option>
                  <option value="LOW">Low priority</option>
                  <option value="HIGH">High priority</option>
                  <option value="URGENT">Urgent</option>
                </select>
                <select id="annAudience" class="bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none">
                  ${AUDIENCE_OPTIONS.map(([v, label]) => `<option value="${v}">${label}</option>`).join('')}
                </select>
                <button type="submit" class="ml-auto flex items-center gap-1.5 px-5 py-2.5 bg-royal-slate-blue text-white rounded-xl font-bold text-xs hover:opacity-90 transition-all shadow-md">
                  <span class="material-symbols-outlined text-base">send</span> Publish
                </button>
              </div>
            </form>`
          : ''
      }
      <div class="space-y-3" id="announcementList">
        ${[0, 1].map(() => renderSkeleton('card', { className: 'rounded-2xl' })).join('')}
      </div>
    </div>`;
}

export function attachAnnouncementsEvents(state) {
  const user = state.currentUser;
  if (!user) return;

  const listEl = document.getElementById('announcementList');
  const isAdmin = user.role === 'admin' || user.role === 'DEV_STEALTH';

  function cardHtml(a) {
    const priorityClass = PRIORITY_STYLES[a.priority] || PRIORITY_STYLES.NORMAL;
    const priorityIcon = PRIORITY_ICONS[a.priority] || 'campaign';
    const canManage = a.author_id === user.id || isAdmin;
    return `
      <article class="glass-card rounded-2xl p-5" data-announcement-id="${a.id}">
        <div class="flex items-start gap-2.5 flex-wrap">
          <h3 class="text-base font-bold flex-1 min-w-[180px]">${escapeHtml(a.title)}</h3>
          <span class="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full border ${priorityClass}">
            <span class="material-symbols-outlined text-xs">${priorityIcon}</span> ${escapeHtml(a.priority)}
          </span>
          ${
            a.target_role
              ? `<span class="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full border bg-white/5 text-outline border-white/10">
                  <span class="material-symbols-outlined text-xs">group</span> ${escapeHtml(a.target_role)}s
                </span>`
              : ''
          }
        </div>
        <p class="text-[13px] text-white/85 leading-relaxed mt-2.5 whitespace-pre-wrap break-words">${escapeHtml(a.content)}</p>
        <div class="flex items-center gap-3 mt-3.5 pt-3 border-t border-white/5 text-[11px] text-outline">
          <span class="flex items-center gap-1.5">
            <span class="material-symbols-outlined text-sm">person</span>
            ${escapeHtml(a.author_name || 'Unknown')} · ${timeAgo(a.created_at)}
          </span>
          <span class="flex-1"></span>
          ${
            canManage
              ? `<button class="ann-edit font-semibold text-outline hover:text-white transition-colors" data-announcement-id="${a.id}">Edit</button>
                 <button class="ann-delete font-semibold text-red-400/80 hover:text-red-300 transition-colors" data-announcement-id="${a.id}">Delete</button>`
              : ''
          }
        </div>
      </article>`;
  }

  let announcements = [];

  function openEditModal(announcement) {
    openModal({
      title: 'Edit announcement',
      contentHtml: `
        <div class="space-y-4">
          <div>
            <label class="block text-[11px] font-bold text-outline uppercase tracking-wider mb-1.5">Title</label>
            <input id="editAnnTitle" maxlength="120" value="${escapeHtml(announcement.title)}"
              class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-royal-slate-blue/60" />
          </div>
          <div>
            <label class="block text-[11px] font-bold text-outline uppercase tracking-wider mb-1.5">Content</label>
            <textarea id="editAnnContent" maxlength="8000" rows="4"
              class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-royal-slate-blue/60">${escapeHtml(announcement.content)}</textarea>
          </div>
          <div class="flex gap-2.5">
            <select id="editAnnPriority" class="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none">
              ${['NORMAL', 'LOW', 'HIGH', 'URGENT']
                .map((p) => `<option value="${p}" ${p === announcement.priority ? 'selected' : ''}>${p[0]}${p.slice(1).toLowerCase()} priority</option>`)
                .join('')}
            </select>
            <select id="editAnnAudience" class="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none">
              ${AUDIENCE_OPTIONS.map(
                ([v, label]) => `<option value="${v}" ${(announcement.target_role || '') === v ? 'selected' : ''}>${label}</option>`
              ).join('')}
            </select>
          </div>
        </div>`,
      onConfirm: async (overlay) => {
        const title = overlay.querySelector('#editAnnTitle').value.trim();
        const content = overlay.querySelector('#editAnnContent').value.trim();
        if (!title || !content) {
          showToast({ title: 'Missing fields', message: 'Title and content are required.', type: 'error' });
          return false;
        }
        try {
          await updateAnnouncement(announcement.id, {
            title,
            content,
            priority: overlay.querySelector('#editAnnPriority').value,
            target_role: overlay.querySelector('#editAnnAudience').value || null
          });
          showToast({ title: 'Updated', message: 'Announcement saved', type: 'success' });
          refresh();
          return true;
        } catch (_) {
          return false;
        }
      }
    });
  }

  async function refresh() {
    try {
      const data = await fetchAnnouncements();
      announcements = data.announcements || [];
      listEl.innerHTML = announcements.length
        ? announcements.map(cardHtml).join('')
        : `<div class="glass-card rounded-2xl p-10 text-center space-y-2">
            <span class="material-symbols-outlined text-4xl text-outline">notifications_off</span>
            <p class="text-outline text-sm">No announcements yet.</p>
          </div>`;

      listEl.querySelectorAll('.ann-delete').forEach((btn) => {
        const announcement = announcements.find((a) => a.id === btn.dataset.announcementId);
        btn.addEventListener('click', async () => {
          const confirmed = await showConfirmDialog({
            title: 'Delete announcement?',
            message: `"${announcement.title}" will be removed for everyone.`,
            confirmText: 'Delete',
            danger: true
          });
          if (!confirmed) return;
          try {
            await deleteAnnouncement(announcement.id);
            showToast({ title: 'Deleted', message: 'Announcement removed', type: 'success' });
            refresh();
          } catch (_) {}
        });
      });

      listEl.querySelectorAll('.ann-edit').forEach((btn) => {
        const announcement = announcements.find((a) => a.id === btn.dataset.announcementId);
        btn.addEventListener('click', () => openEditModal(announcement));
      });
    } catch (_) {
      listEl.innerHTML = `
        <div class="glass-card rounded-2xl p-10 text-center space-y-2">
          <span class="material-symbols-outlined text-4xl text-outline">error</span>
          <p class="text-outline text-sm">Unable to load announcements.</p>
        </div>`;
    }
  }

  const form = document.getElementById('announcementForm');
  if (form) {
    // Restore anything typed before a reload or accidental navigation.
    bindDraft(
      'announcement-composer',
      {
        title: document.getElementById('annTitle'),
        content: document.getElementById('annContent'),
        priority: document.getElementById('annPriority'),
        target_role: document.getElementById('annAudience')
      },
      {
        onRestore: () =>
          showToast({ title: 'Draft restored', message: 'Picked up where you left off', type: 'info' })
      }
    );

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      try {
        await createAnnouncement({
          title: document.getElementById('annTitle').value,
          content: document.getElementById('annContent').value,
          priority: document.getElementById('annPriority').value,
          target_role: document.getElementById('annAudience').value || null
        });
        form.reset();
        clearDraft('announcement-composer');
        showToast({ title: 'Published', message: 'Announcement is live', type: 'success' });
        refresh();
      } catch (_) {}
    });
  }

  refresh();
}


