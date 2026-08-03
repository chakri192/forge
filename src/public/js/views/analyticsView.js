// Teacher analytics: cohort health, review latency, and at-risk members.
import { fetchAnalytics } from '../services/api.js';
import { renderSkeleton } from '../components/spinner.js';
import { escapeHtml, timeAgo } from '../utils/dom.js';

const TEACHER_ROLES = ['teacher', 'admin', 'DEV_STEALTH', 'TEACHER'];

const RISK_LABELS = {
  never_active: 'Never active',
  inactive_critical: 'Inactive 14+ days',
  inactive_warning: 'Inactive 7+ days',
  no_submissions: 'No submissions',
  repeated_rejections: 'Repeated rejections',
  streak_broken: 'Streak broken'
};

export function renderAnalyticsView(state) {
  const user = state.currentUser;
  if (!user || !TEACHER_ROLES.includes(user.role)) {
    return `
      <div class="glass-card p-10 rounded-2xl text-center space-y-2">
        <span class="material-symbols-outlined text-4xl text-outline" aria-hidden="true">lock</span>
        <p class="text-sm text-white font-semibold">Teachers only</p>
        <p class="text-xs text-outline">Cohort analytics are limited to teachers and admins.</p>
      </div>`;
  }
  return `
    <div class="space-y-5 max-w-5xl">
      <div>
        <h2 class="text-2xl font-extrabold tracking-tight flex items-center gap-2.5">
          <span class="material-symbols-outlined text-3xl accent-target">insights</span> Cohort Analytics
        </h2>
        <p class="text-xs text-outline mt-1">Participation, throughput, and who needs attention.</p>
      </div>
      <div id="analyticsRoot" class="space-y-5">${renderSkeleton('card', { className: 'rounded-2xl' })}</div>
    </div>`;
}

export function attachAnalyticsEvents(state) {
  const user = state.currentUser;
  if (!user || !TEACHER_ROLES.includes(user.role)) return;
  const root = document.getElementById('analyticsRoot');

  fetchAnalytics()
    .then((data) => {
      root.innerHTML = `
        ${overviewHtml(data.overview, data.review_latency)}
        ${trendHtml(data.trend)}
        ${atRiskHtml(data.members.filter((m) => m.risk_level !== 'none'))}
        ${rosterHtml(data.members)}`;
    })
    .catch(() => {
      root.innerHTML = `<div class="glass-card rounded-2xl p-8 text-center text-sm text-outline">Unable to load analytics.</div>`;
    });
}

function overviewHtml(o, latency) {
  const tiles = [
    { icon: 'group', value: o.members, label: 'Members' },
    { icon: 'assignment', value: o.tasks, label: 'Active tasks' },
    { icon: 'task_alt', value: `${o.completion_rate}%`, label: 'Completion' },
    { icon: 'pending_actions', value: o.pending_review, label: 'Awaiting review' },
    { icon: 'bolt', value: Number(o.xp_awarded).toLocaleString(), label: 'XP awarded' },
    {
      icon: 'timer',
      value: latency.median_hours === null ? '—' : `${latency.median_hours}h`,
      label: 'Median review time'
    }
  ];
  return `
    <section class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
      ${tiles
        .map(
          (t) => `
        <div class="glass-card rounded-2xl p-4 text-center">
          <span class="material-symbols-outlined text-xl accent-target" aria-hidden="true">${t.icon}</span>
          <div class="text-xl font-black text-white mt-1 leading-none">${t.value}</div>
          <div class="text-[10px] text-outline uppercase tracking-wide mt-1">${t.label}</div>
        </div>`
        )
        .join('')}
    </section>`;
}

/** Inline SVG sparkline — no chart library. */
function trendHtml(trend) {
  if (!trend.length) {
    return `<section class="glass-card rounded-2xl p-5"><p class="text-xs text-outline text-center py-4">Not enough history yet for a trend.</p></section>`;
  }
  const width = 600;
  const height = 80;
  const max = Math.max(...trend.map((t) => t.events), 1);
  const step = trend.length > 1 ? width / (trend.length - 1) : width;
  const coords = trend.map((t, i) => ({
    x: trend.length === 1 ? width / 2 : i * step,
    y: height - (t.events / max) * height,
    events: t.events,
    week: t.week
  }));
  const points = coords.map((c) => `${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(' ');
  // A single week has no line to draw, so always plot the points themselves.
  const dots = coords
    .map(
      (c) =>
        `<circle cx="${c.x.toFixed(1)}" cy="${c.y.toFixed(1)}" r="3" fill="currentColor" class="text-accent-text"><title>${escapeHtml(c.week)}: ${c.events} events</title></circle>`
    )
    .join('');

  return `
    <section class="glass-card rounded-2xl p-5">
      <h3 class="text-sm font-bold mb-3 flex items-center gap-2">
        <span class="material-symbols-outlined text-base accent-target" aria-hidden="true">show_chart</span>
        Weekly activity
        <span class="text-outline font-normal text-xs">· peak ${max} events</span>
      </h3>
      <div class="overflow-x-auto">
        <svg viewBox="0 0 ${width} ${height}" class="w-full h-20 overflow-visible" role="img" aria-label="Weekly activity trend">
          <polyline points="${points}" fill="none" stroke="currentColor" stroke-width="2"
            class="text-accent-text" stroke-linejoin="round" stroke-linecap="round" />
          ${dots}
        </svg>
      </div>
      <div class="flex justify-between text-[10px] text-outline mt-1">
        <span>${escapeHtml(trend[0].week)}</span>
        <span>${escapeHtml(trend[trend.length - 1].week)}</span>
      </div>
    </section>`;
}

function atRiskHtml(members) {
  return `
    <section class="glass-card rounded-2xl p-5">
      <h3 class="text-sm font-bold mb-3 flex items-center gap-2">
        <span class="material-symbols-outlined text-base ${members.length ? 'text-amber-400' : 'text-emerald-400'}" aria-hidden="true">
          ${members.length ? 'warning' : 'check_circle'}
        </span>
        Needs attention
        <span class="text-outline font-normal">· ${members.length}</span>
      </h3>
      ${
        members.length === 0
          ? `<p class="text-xs text-outline text-center py-6">Everyone is engaged right now.</p>`
          : `<ul class="space-y-2">
              ${members
                .map(
                  (m) => `
                <li class="flex items-center gap-3 p-3 rounded-xl border ${
                  m.risk_level === 'high'
                    ? 'bg-red-500/10 border-red-500/25'
                    : 'bg-amber-500/10 border-amber-500/25'
                }">
                  <span class="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-[10px] font-bold shrink-0">
                    ${escapeHtml(initials(m.name))}
                  </span>
                  <span class="flex-1 min-w-0">
                    <span class="block text-xs font-bold text-white truncate">${escapeHtml(m.name)}</span>
                    <span class="block text-[10px] text-outline">
                      ${m.last_active_at ? `Last active ${timeAgo(m.last_active_at)}` : 'Never active'}
                    </span>
                  </span>
                  <span class="flex gap-1 flex-wrap justify-end shrink-0">
                    ${m.risks
                      .map(
                        (r) =>
                          `<span class="px-2 py-0.5 rounded-full bg-white/10 text-[9px] font-bold uppercase tracking-wide text-white/80">${RISK_LABELS[r] || r}</span>`
                      )
                      .join('')}
                  </span>
                </li>`
                )
                .join('')}
            </ul>`
      }
    </section>`;
}

function rosterHtml(members) {
  return `
    <section class="glass-card rounded-2xl p-5">
      <h3 class="text-sm font-bold mb-3 flex items-center gap-2">
        <span class="material-symbols-outlined text-base accent-target" aria-hidden="true">table_rows</span> Roster
      </h3>
      <div class="overflow-x-auto">
        <table class="w-full text-xs">
          <thead>
            <tr class="text-[10px] uppercase tracking-wider text-outline border-b border-white/10">
              <th class="text-left font-bold py-2 pr-3">Member</th>
              <th class="text-right font-bold py-2 px-2">XP</th>
              <th class="text-right font-bold py-2 px-2">Subs</th>
              <th class="text-right font-bold py-2 px-2">Approved</th>
              <th class="text-right font-bold py-2 px-2">Streak</th>
              <th class="text-right font-bold py-2 pl-2">Last active</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-white/5">
            ${members
              .map(
                (m) => `
              <tr class="hover:bg-white/[0.03]">
                <td class="py-2 pr-3">
                  <span class="font-semibold text-white">${escapeHtml(m.name)}</span>
                  <span class="text-outline text-[10px] ml-1.5">${escapeHtml(m.role)}</span>
                </td>
                <td class="text-right py-2 px-2 tabular-nums text-white">${Number(m.xp).toLocaleString()}</td>
                <td class="text-right py-2 px-2 tabular-nums text-outline">${m.submissions}</td>
                <td class="text-right py-2 px-2 tabular-nums text-emerald-400">${m.approved}</td>
                <td class="text-right py-2 px-2 tabular-nums ${m.current_streak > 0 ? 'text-amber-400' : 'text-outline'}">${m.current_streak}</td>
                <td class="text-right py-2 pl-2 text-outline">${m.last_active_at ? timeAgo(m.last_active_at) : '—'}</td>
              </tr>`
              )
              .join('')}
          </tbody>
        </table>
      </div>
    </section>`;
}

function initials(name) {
  return String(name || '?')
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0] || '')
    .join('')
    .toUpperCase();
}
