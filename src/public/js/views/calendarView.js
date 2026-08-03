// Cohort calendar: events and task deadlines on one agenda timeline.
import { fetchCalendar, createCalendarEvent, deleteCalendarEvent } from '../services/api.js';
import { showToast } from '../components/toast.js';
import { openModal } from '../components/modal.js';
import { showConfirmDialog } from '../components/confirmDialog.js';
import { renderSkeleton } from '../components/spinner.js';
import { escapeHtml } from '../utils/dom.js';

const CREATE_ROLES = ['leader', 'teacher', 'admin', 'DEV_STEALTH', 'STUDENT_LEADER', 'TEACHER'];

const TYPE_STYLES = {
  EVENT: { cls: 'bg-royal-slate-blue/15 text-accent-text border-royal-slate-blue/30', icon: 'event' },
  DEADLINE: { cls: 'bg-red-500/15 text-red-300 border-red-500/30', icon: 'schedule' },
  WORKSHOP: { cls: 'bg-purple-500/15 text-purple-300 border-purple-500/30', icon: 'school' },
  MEETING: { cls: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30', icon: 'groups' }
};

export function renderCalendarView(state) {
  if (!state.currentUser) {
    return `<div class="glass-card p-10 rounded-2xl text-center text-sm text-outline">Sign in to see the schedule.</div>`;
  }
  const canCreate = CREATE_ROLES.includes(state.currentUser.role);
  return `
    <div class="space-y-5 max-w-4xl">
      <div class="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h2 class="text-2xl font-extrabold tracking-tight flex items-center gap-2.5">
            <span class="material-symbols-outlined text-3xl accent-target">calendar_month</span> Calendar
          </h2>
          <p class="text-xs text-outline mt-1">Everything coming up — events, workshops, and task deadlines together.</p>
        </div>
        ${
          canCreate
            ? `<button id="btnNewEvent" class="btn btn--primary">
                <span class="material-symbols-outlined text-base" aria-hidden="true">add</span> New Event
              </button>`
            : ''
        }
      </div>
      <div id="calendarRoot">${renderSkeleton('card', { className: 'rounded-2xl' })}</div>
    </div>`;
}

export function attachCalendarEvents(state) {
  if (!state.currentUser) return;
  const root = document.getElementById('calendarRoot');

  async function refresh() {
    try {
      const { events } = await fetchCalendar();
      const upcoming = events.filter((e) => new Date(e.end_time || e.start_time) >= new Date(Date.now() - 86400000));

      if (!upcoming.length) {
        root.innerHTML = `
          <div class="glass-card rounded-2xl p-10 text-center space-y-2">
            <span class="material-symbols-outlined text-4xl text-outline" aria-hidden="true">event_available</span>
            <p class="text-sm text-white font-semibold">Nothing scheduled</p>
            <p class="text-xs text-outline">Events and upcoming task deadlines will appear here.</p>
          </div>`;
        return;
      }

      // Group by calendar day so the agenda reads as a timeline.
      const groups = new Map();
      for (const event of upcoming) {
        const day = String(event.start_time).slice(0, 10);
        if (!groups.has(day)) groups.set(day, []);
        groups.get(day).push(event);
      }

      root.innerHTML = [...groups.entries()]
        .map(
          ([day, items]) => `
        <section class="mb-5">
          <h3 class="eyebrow mb-2 flex items-center gap-2">
            <span class="material-symbols-outlined text-sm" aria-hidden="true">today</span>
            ${formatDay(day)}
            ${isToday(day) ? '<span class="px-2 py-0.5 rounded-full bg-royal-slate-blue/25 text-accent-text text-[9px]">Today</span>' : ''}
          </h3>
          <div class="space-y-2">${items.map(eventHtml).join('')}</div>
        </section>`
        )
        .join('');

      bindDeletes();
    } catch (_) {
      root.innerHTML = `<div class="glass-card rounded-2xl p-8 text-center text-sm text-outline">Unable to load the calendar.</div>`;
    }
  }

  function eventHtml(e) {
    const style = TYPE_STYLES[e.event_type] || TYPE_STYLES.EVENT;
    const isTaskDeadline = e.source === 'task';
    const canDelete = !isTaskDeadline && (e.created_by === state.currentUser.id ||
      ['teacher', 'admin', 'DEV_STEALTH'].includes(state.currentUser.role));
    return `
      <article class="glass-card is-interactive rounded-2xl p-4 flex items-start gap-3.5" data-event-id="${escapeHtml(e.id)}">
        <span class="w-9 h-9 rounded-xl border flex items-center justify-center shrink-0 ${style.cls}">
          <span class="material-symbols-outlined text-lg" aria-hidden="true">${style.icon}</span>
        </span>
        <div class="flex-1 min-w-0">
          <h4 class="text-sm font-bold text-white truncate">${escapeHtml(e.title)}</h4>
          ${e.description ? `<p class="text-xs text-outline mt-0.5 line-clamp-2">${escapeHtml(e.description)}</p>` : ''}
          <div class="flex items-center gap-2.5 mt-1.5 text-[11px] text-outline flex-wrap">
            <span>${formatTime(e.start_time)}${!isTaskDeadline && e.end_time !== e.start_time ? ` – ${formatTime(e.end_time)}` : ''}</span>
            ${e.location ? `<span class="flex items-center gap-1"><span class="material-symbols-outlined text-xs" aria-hidden="true">place</span>${escapeHtml(e.location)}</span>` : ''}
            ${e.team_name ? `<span class="px-2 py-0.5 rounded-full bg-white/5 border border-white/10">${escapeHtml(e.team_name)}</span>` : ''}
            ${isTaskDeadline ? '<span class="px-2 py-0.5 rounded-full bg-red-500/15 text-red-300 border border-red-500/30">Task due</span>' : ''}
          </div>
        </div>
        ${
          canDelete
            ? `<button class="event-delete text-[11px] font-semibold text-red-400/80 hover:text-red-300 shrink-0" data-id="${escapeHtml(e.id)}">Delete</button>`
            : ''
        }
      </article>`;
  }

  function bindDeletes() {
    root.querySelectorAll('.event-delete').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const confirmed = await showConfirmDialog({
          title: 'Delete this event?',
          message: 'It will be removed from everyone\'s calendar.',
          confirmText: 'Delete',
          danger: true
        });
        if (!confirmed) return;
        try {
          await deleteCalendarEvent(btn.dataset.id);
          showToast({ title: 'Event deleted', type: 'success' });
          refresh();
        } catch (_) {}
      });
    });
  }

  const newBtn = document.getElementById('btnNewEvent');
  if (newBtn) {
    newBtn.addEventListener('click', () => {
      const now = new Date();
      const defaultStart = new Date(now.getTime() + 86400000).toISOString().slice(0, 16);
      const defaultEnd = new Date(now.getTime() + 90000000).toISOString().slice(0, 16);
      openModal({
        title: 'New event',
        contentHtml: `
          <div class="space-y-3.5">
            <div>
              <label class="field__label" style="margin-bottom:.375rem;display:block">Title</label>
              <input id="eventTitle" maxlength="160" placeholder="e.g. Sprint demo"
                class="input" />
            </div>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label class="field__label" style="margin-bottom:.375rem;display:block">Starts</label>
                <input id="eventStart" type="datetime-local" value="${defaultStart}"
                  class="select" />
              </div>
              <div>
                <label class="field__label" style="margin-bottom:.375rem;display:block">Ends</label>
                <input id="eventEnd" type="datetime-local" value="${defaultEnd}"
                  class="select" />
              </div>
            </div>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label class="field__label" style="margin-bottom:.375rem;display:block">Type</label>
                <select id="eventType" class="select">
                  <option value="EVENT">Event</option>
                  <option value="WORKSHOP">Workshop</option>
                  <option value="MEETING">Meeting</option>
                  <option value="DEADLINE">Deadline</option>
                </select>
              </div>
              <div>
                <label class="field__label" style="margin-bottom:.375rem;display:block">Location</label>
                <input id="eventLocation" maxlength="200" placeholder="Optional"
                  class="input" />
              </div>
            </div>
            <div>
              <label class="field__label" style="margin-bottom:.375rem;display:block">Details</label>
              <textarea id="eventDescription" rows="2" maxlength="2000"
                class="input"></textarea>
            </div>
          </div>`,
        onConfirm: async (overlay) => {
          const title = overlay.querySelector('#eventTitle').value.trim();
          const start = overlay.querySelector('#eventStart').value;
          const end = overlay.querySelector('#eventEnd').value;
          if (title.length < 2 || !start || !end) {
            showToast({ title: 'Missing details', message: 'Title, start, and end are required.', type: 'error' });
            return false;
          }
          if (new Date(end) < new Date(start)) {
            showToast({ title: 'Check the times', message: 'The end must come after the start.', type: 'error' });
            return false;
          }
          try {
            await createCalendarEvent({
              title,
              start_time: new Date(start).toISOString(),
              end_time: new Date(end).toISOString(),
              event_type: overlay.querySelector('#eventType').value,
              location: overlay.querySelector('#eventLocation').value.trim() || null,
              description: overlay.querySelector('#eventDescription').value.trim() || null
            });
            showToast({ title: 'Event scheduled', message: title, type: 'success' });
            refresh();
            return true;
          } catch (_) {
            return false;
          }
        }
      });
    });
  }

  refresh();
}

function formatDay(day) {
  const date = new Date(`${day}T00:00:00`);
  if (Number.isNaN(date.getTime())) return day;
  return date.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });
}

function isToday(day) {
  return day === new Date().toISOString().slice(0, 10);
}

function formatTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}
