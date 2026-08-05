// Cohort calendar: a real month grid, with an agenda view for the read-through.
//
// The month is the default because "what does this week look like" is the
// question people actually arrive with; the agenda answers "what is next",
// which is a different and rarer question.
import { fetchCalendar, createCalendarEvent, deleteCalendarEvent } from '../services/api.js';
import { showToast } from '../components/toast.js';
import { openModal } from '../components/modal.js';
import { showConfirmDialog } from '../components/confirmDialog.js';
import { renderSkeleton } from '../components/spinner.js';
import { escapeHtml } from '../utils/dom.js';

const CREATE_ROLES = ['leader', 'teacher', 'admin', 'DEV_STEALTH', 'STUDENT_LEADER', 'TEACHER'];
const MANAGE_ROLES = ['teacher', 'admin', 'DEV_STEALTH'];

const TYPE_META = {
  EVENT: { label: 'Event', icon: 'event', tone: 'event' },
  DEADLINE: { label: 'Deadline', icon: 'schedule', tone: 'deadline' },
  WORKSHOP: { label: 'Workshop', icon: 'school', tone: 'workshop' },
  MEETING: { label: 'Meeting', icon: 'groups', tone: 'meeting' }
};

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/* --- date helpers: local time throughout ---------------------------------
   toISOString() would shift a late-evening event into the next day for anyone
   east of UTC, putting it in the wrong cell. Every key here is built from the
   local calendar fields instead. */

function dayKey(date) {
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function startOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

/** Monday-first index for a Sunday-first getDay(). */
function weekIndex(date) {
  return (date.getDay() + 6) % 7;
}

/** The six-week window a month grid draws, always starting on a Monday. */
function monthGridRange(month) {
  const first = startOfMonth(month);
  const start = new Date(first);
  start.setDate(first.getDate() - weekIndex(first));
  const end = new Date(start);
  end.setDate(start.getDate() + 41);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

export function renderCalendarView(state) {
  if (!state.currentUser) {
    return `<div class="glass-card p-10 rounded-2xl text-center text-sm text-outline">Sign in to see the schedule.</div>`;
  }
  const canCreate = CREATE_ROLES.includes(state.currentUser.role);
  return `
    <div class="space-y-5">
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

  let mode = localStorage.getItem('forge_calendar_mode') === 'agenda' ? 'agenda' : 'month';
  let month = startOfMonth(new Date());
  let selected = dayKey(new Date());
  let events = [];

  const canManage = (e) =>
    e.source !== 'task' &&
    (e.created_by === state.currentUser.id || MANAGE_ROLES.includes(state.currentUser.role));

  /** Events bucketed by local day key — the grid asks per-cell, so build once. */
  function byDay() {
    const map = new Map();
    for (const event of events) {
      const key = dayKey(event.start_time);
      if (!key) continue;
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(event);
    }
    for (const list of map.values()) {
      list.sort((a, b) => String(a.start_time).localeCompare(String(b.start_time)));
    }
    return map;
  }

  async function load() {
    // Fetch the whole drawn grid, not just the month, so the leading and
    // trailing days of adjacent months are not mysteriously empty.
    const { start, end } = monthGridRange(month);
    try {
      const res = await fetchCalendar({ from: start.toISOString(), to: end.toISOString() });
      events = res.events || [];
      paint();
    } catch (_) {
      root.innerHTML = `<div class="glass-card rounded-2xl p-8 text-center text-sm text-outline">Unable to load the calendar.</div>`;
    }
  }

  function paint() {
    root.innerHTML = `
      <div class="cal">
        ${headerHtml()}
        ${mode === 'month' ? monthHtml() : agendaHtml()}
      </div>`;
    bind();
  }

  function headerHtml() {
    const label = month.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
    return `
      <div class="cal__bar">
        <div class="cal__nav">
          <button class="cal__step" data-move="-1" aria-label="Previous month">
            <span class="material-symbols-outlined" aria-hidden="true">chevron_left</span>
          </button>
          <button class="cal__step" data-move="1" aria-label="Next month">
            <span class="material-symbols-outlined" aria-hidden="true">chevron_right</span>
          </button>
          <h3 class="cal__month">${escapeHtml(label)}</h3>
          <button class="cal__today" data-today>Today</button>
        </div>
        <div class="cal__modes" role="tablist" aria-label="Calendar view">
          <button class="cal__mode ${mode === 'month' ? 'is-active' : ''}" data-mode="month"
            role="tab" aria-selected="${mode === 'month'}">Month</button>
          <button class="cal__mode ${mode === 'agenda' ? 'is-active' : ''}" data-mode="agenda"
            role="tab" aria-selected="${mode === 'agenda'}">Agenda</button>
        </div>
      </div>`;
  }

  function monthHtml() {
    const map = byDay();
    const { start } = monthGridRange(month);
    const today = dayKey(new Date());
    const cells = [];

    for (let i = 0; i < 42; i++) {
      const date = new Date(start);
      date.setDate(start.getDate() + i);
      const key = dayKey(date);
      const items = map.get(key) || [];
      const outside = date.getMonth() !== month.getMonth();

      // Three chips fit the cell; beyond that a count is more honest than a
      // squeeze, and the day panel below shows the rest.
      const shown = items.slice(0, 3);
      const rest = items.length - shown.length;

      cells.push(`
        <button class="cal__day ${outside ? 'is-outside' : ''} ${key === today ? 'is-today' : ''} ${key === selected ? 'is-selected' : ''}"
          data-day="${key}" aria-label="${escapeHtml(longDay(date))}${items.length ? `, ${items.length} item${items.length === 1 ? '' : 's'}` : ''}">
          <span class="cal__daynum">${date.getDate()}</span>
          <span class="cal__chips">
            ${shown.map((e) => `<span class="cal__chip cal__chip--${tone(e)}" title="${escapeHtml(e.title)}">${escapeHtml(e.title)}</span>`).join('')}
            ${rest > 0 ? `<span class="cal__more">+${rest} more</span>` : ''}
          </span>
        </button>`);
    }

    return `
      <div class="cal__grid" role="grid">
        ${WEEKDAYS.map((d) => `<div class="cal__weekday" role="columnheader">${d}</div>`).join('')}
        ${cells.join('')}
      </div>
      ${dayPanelHtml(map.get(selected) || [])}`;
  }

  function dayPanelHtml(items) {
    const date = new Date(`${selected}T00:00:00`);
    return `
      <section class="cal__panel">
        <h4 class="cal__panel-title">
          ${escapeHtml(longDay(date))}
          ${selected === dayKey(new Date()) ? '<span class="cal__badge">Today</span>' : ''}
        </h4>
        ${
          items.length
            ? `<div class="cal__panel-list">${items.map(eventHtml).join('')}</div>`
            : `<p class="cal__panel-empty">Nothing on this day.</p>`
        }
      </section>`;
  }

  function agendaHtml() {
    const now = Date.now();
    const upcoming = events
      .filter((e) => new Date(e.end_time || e.start_time).getTime() >= now - 86400000)
      .sort((a, b) => String(a.start_time).localeCompare(String(b.start_time)));

    if (!upcoming.length) {
      return `
        <div class="glass-card rounded-2xl p-10 text-center space-y-2">
          <span class="material-symbols-outlined text-4xl text-outline" aria-hidden="true">event_available</span>
          <p class="text-sm text-white font-semibold">Nothing scheduled</p>
          <p class="text-xs text-outline">Events and upcoming task deadlines will appear here.</p>
        </div>`;
    }

    const groups = new Map();
    for (const event of upcoming) {
      const key = dayKey(event.start_time);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(event);
    }

    return [...groups.entries()]
      .map(
        ([key, items]) => `
      <section class="cal__agenda-day">
        <h4 class="cal__panel-title">
          ${escapeHtml(longDay(new Date(`${key}T00:00:00`)))}
          ${key === dayKey(new Date()) ? '<span class="cal__badge">Today</span>' : ''}
        </h4>
        <div class="cal__panel-list">${items.map(eventHtml).join('')}</div>
      </section>`
      )
      .join('');
  }

  function eventHtml(e) {
    const meta = TYPE_META[e.event_type] || TYPE_META.EVENT;
    const isTask = e.source === 'task';
    return `
      <article class="cal__event cal__event--${tone(e)}" data-event-id="${escapeHtml(e.id)}">
        <span class="cal__event-icon">
          <span class="material-symbols-outlined" aria-hidden="true">${isTask ? 'assignment_late' : meta.icon}</span>
        </span>
        <div class="cal__event-body">
          <h5 class="cal__event-title">${escapeHtml(e.title)}</h5>
          ${e.description ? `<p class="cal__event-desc">${escapeHtml(e.description)}</p>` : ''}
          <div class="cal__event-meta">
            <span>${escapeHtml(timeRange(e))}</span>
            ${e.location ? `<span>${escapeHtml(e.location)}</span>` : ''}
            ${e.team_name ? `<span class="cal__tag">${escapeHtml(e.team_name)}</span>` : ''}
            ${isTask ? '<span class="cal__tag cal__tag--due">Task due</span>' : ''}
          </div>
        </div>
        ${
          canManage(e)
            ? `<button class="cal__event-del" data-del="${escapeHtml(e.id)}" aria-label="Delete ${escapeHtml(e.title)}">Delete</button>`
            : ''
        }
      </article>`;
  }

  function bind() {
    root.querySelectorAll('[data-move]').forEach((btn) =>
      btn.addEventListener('click', () => {
        month = new Date(month.getFullYear(), month.getMonth() + Number(btn.dataset.move), 1);
        load();
      })
    );

    root.querySelector('[data-today]')?.addEventListener('click', () => {
      const now = new Date();
      month = startOfMonth(now);
      selected = dayKey(now);
      load();
    });

    root.querySelectorAll('[data-mode]').forEach((btn) =>
      btn.addEventListener('click', () => {
        mode = btn.dataset.mode;
        localStorage.setItem('forge_calendar_mode', mode);
        paint();
      })
    );

    root.querySelectorAll('[data-day]').forEach((cell) =>
      cell.addEventListener('click', () => {
        selected = cell.dataset.day;
        paint();
      })
    );

    root.querySelectorAll('[data-del]').forEach((btn) =>
      btn.addEventListener('click', async () => {
        const confirmed = await showConfirmDialog({
          title: 'Delete this event?',
          message: "It will be removed from everyone's calendar.",
          confirmText: 'Delete',
          danger: true
        });
        if (!confirmed) return;
        try {
          await deleteCalendarEvent(btn.dataset.del);
          showToast({ title: 'Event deleted', type: 'success' });
          load();
        } catch (_) {
          /* requestApi surfaces the reason */
        }
      })
    );
  }

  // Arrow keys move between days when the grid is showing, which is how every
  // calendar people already use behaves.
  const onKey = (event) => {
    // The view re-attaches on every state change, so a listener from a previous
    // attach must retire itself rather than accumulate for the session.
    if (!root.isConnected) return document.removeEventListener('keydown', onKey);
    if (mode !== 'month') return;
    if (event.target?.matches?.('input, textarea, select')) return;
    const steps = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };
    if (!(event.key in steps)) return;
    event.preventDefault();
    const next = new Date(`${selected}T00:00:00`);
    next.setDate(next.getDate() + steps[event.key]);
    selected = dayKey(next);
    if (next.getMonth() !== month.getMonth()) {
      month = startOfMonth(next);
      load();
    } else {
      paint();
    }
  };
  document.addEventListener('keydown', onKey);

  const newBtn = document.getElementById('btnNewEvent');
  if (newBtn) newBtn.addEventListener('click', () => openCreateModal());

  /** Opens on the selected day rather than tomorrow — you picked it for a reason. */
  function openCreateModal() {
    const base = new Date(`${selected}T00:00:00`);
    if (Number.isNaN(base.getTime())) base.setTime(Date.now());
    const start = new Date(base);
    start.setHours(10, 0, 0, 0);
    const end = new Date(base);
    end.setHours(11, 0, 0, 0);

    openModal({
      title: 'New event',
      contentHtml: `
        <div class="space-y-3.5">
          <div>
            <label class="field__label" style="margin-bottom:.375rem;display:block">Title</label>
            <input id="eventTitle" maxlength="160" placeholder="e.g. Sprint demo" class="input" />
          </div>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label class="field__label" style="margin-bottom:.375rem;display:block">Starts</label>
              <input id="eventStart" type="datetime-local" value="${localInput(start)}" class="select" />
            </div>
            <div>
              <label class="field__label" style="margin-bottom:.375rem;display:block">Ends</label>
              <input id="eventEnd" type="datetime-local" value="${localInput(end)}" class="select" />
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
              <input id="eventLocation" maxlength="200" placeholder="Optional" class="input" />
            </div>
          </div>
          <div>
            <label class="field__label" style="margin-bottom:.375rem;display:block">Details</label>
            <textarea id="eventDescription" rows="2" maxlength="2000" class="input"></textarea>
          </div>
        </div>`,
      onConfirm: async (overlay) => {
        const title = overlay.querySelector('#eventTitle').value.trim();
        const from = overlay.querySelector('#eventStart').value;
        const to = overlay.querySelector('#eventEnd').value;
        if (title.length < 2 || !from || !to) {
          showToast({ title: 'Missing details', message: 'Title, start, and end are required.', type: 'error' });
          return false;
        }
        if (new Date(to) < new Date(from)) {
          showToast({ title: 'Check the times', message: 'The end must come after the start.', type: 'error' });
          return false;
        }
        try {
          await createCalendarEvent({
            title,
            start_time: new Date(from).toISOString(),
            end_time: new Date(to).toISOString(),
            event_type: overlay.querySelector('#eventType').value,
            location: overlay.querySelector('#eventLocation').value.trim() || null,
            description: overlay.querySelector('#eventDescription').value.trim() || null
          });
          showToast({ title: 'Event scheduled', message: title, type: 'success' });
          // Jump to the month it landed in, so it is visible immediately.
          selected = dayKey(new Date(from));
          month = startOfMonth(new Date(from));
          load();
          return true;
        } catch (_) {
          return false;
        }
      }
    });
  }

  load();
}

function tone(event) {
  if (event.source === 'task') return 'deadline';
  return (TYPE_META[event.event_type] || TYPE_META.EVENT).tone;
}

function longDay(date) {
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
}

function timeRange(event) {
  const start = formatTime(event.start_time);
  if (event.source === 'task' || !event.end_time || event.end_time === event.start_time) return start;
  return `${start} – ${formatTime(event.end_time)}`;
}

function formatTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

/** `datetime-local` wants local wall-clock, which toISOString does not give. */
function localInput(date) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
