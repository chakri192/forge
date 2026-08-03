// Profile: level, XP curve, streak, badges, achievements, contribution graph.
import { fetchProgression, fetchAchievements } from '../services/api.js';
import { renderSkeleton } from '../components/spinner.js';
import { escapeHtml } from '../utils/dom.js';

const RARITY_STYLES = {
  COMMON: 'bg-white/5 text-outline border-white/15',
  UNCOMMON: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  RARE: 'bg-sky-500/15 text-sky-300 border-sky-500/30',
  EPIC: 'bg-purple-500/15 text-purple-300 border-purple-500/30',
  LEGENDARY: 'bg-amber-500/15 text-amber-300 border-amber-500/40'
};

export function renderProfileView(state) {
  if (!state.currentUser) {
    return `<div class="glass-card p-10 rounded-2xl text-center text-sm text-outline">Sign in to view your profile.</div>`;
  }
  return `
    <div class="space-y-5 max-w-5xl">
      <div>
        <h2 class="text-2xl font-extrabold tracking-tight flex items-center gap-2.5">
          <span class="material-symbols-outlined text-3xl accent-target">military_tech</span> Your Progress
        </h2>
        <p class="text-xs text-outline mt-1">Level, streak, badges, and everything you have earned.</p>
      </div>
      <div id="progressionRoot" class="space-y-5">
        ${renderSkeleton('card', { className: 'rounded-2xl' })}
      </div>
    </div>`;
}

export function attachProfileEvents(state) {
  if (!state.currentUser) return;
  const root = document.getElementById('progressionRoot');

  Promise.all([fetchProgression(), fetchAchievements()])
    .then(([progression, achievementData]) => {
      root.innerHTML = `
        ${levelCardHtml(progression, state.currentUser)}
        ${contributionsHtml(progression.contributions || [])}
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">
          ${badgesHtml(progression.badges || [])}
          ${achievementsHtml(achievementData.achievements || [])}
        </div>
        ${recentXpHtml(progression.recentXp || [])}`;
    })
    .catch(() => {
      root.innerHTML = `<div class="glass-card p-8 rounded-2xl text-center text-sm text-outline">Unable to load your progress.</div>`;
    });
}

function levelCardHtml(p, user) {
  const pct = Math.round((p.progress || 0) * 100);
  return `
    <section class="glass-card rounded-2xl p-6">
      <div class="flex items-center gap-5 flex-wrap">
        <div class="w-20 h-20 rounded-2xl bg-gradient-to-br from-royal-slate-blue to-ice-blue/60 flex flex-col items-center justify-center shrink-0">
          <span class="text-[10px] font-bold uppercase tracking-wider text-white/80">Level</span>
          <span class="text-3xl font-black text-white leading-none">${p.level}</span>
        </div>
        <div class="flex-1 min-w-[220px]">
          <h3 class="text-lg font-bold">${escapeHtml(user.name)}</h3>
          <p class="text-xs text-outline mb-2.5">${p.xp.toLocaleString()} XP total · ${p.xpForNextLevel.toLocaleString()} XP to level ${p.level + 1}</p>
          <div class="h-2.5 rounded-full bg-white/10 overflow-hidden">
            <div class="h-full rounded-full bg-gradient-to-r from-royal-slate-blue to-ice-blue transition-all duration-700" style="width:${pct}%"></div>
          </div>
        </div>
        <div class="flex gap-3">
          ${statTile('local_fire_department', p.streak.current, 'day streak', p.streak.current > 0 ? 'text-amber-400' : 'text-outline')}
          ${statTile('trending_up', p.streak.longest, 'longest', 'text-emerald-400')}
          ${statTile('workspace_premium', (p.badges || []).length, 'badges', 'text-purple-300')}
        </div>
      </div>
    </section>`;
}

function statTile(icon, value, label, colour) {
  return `
    <div class="text-center px-3.5 py-2 rounded-xl bg-white/5 border border-white/10 min-w-[74px]">
      <span class="material-symbols-outlined text-lg ${colour}" aria-hidden="true">${icon}</span>
      <div class="text-lg font-black text-white leading-none">${value}</div>
      <div class="text-[10px] text-outline uppercase tracking-wide">${label}</div>
    </div>`;
}

/** GitHub-style heatmap of the last 90 days, rendered as plain divs. */
function contributionsHtml(contributions) {
  const byDay = Object.fromEntries(contributions.map((c) => [c.day, c.total]));
  const cells = [];
  const today = new Date();
  for (let i = 89; i >= 0; i -= 1) {
    const date = new Date(today);
    date.setDate(today.getDate() - i);
    const key = date.toISOString().slice(0, 10);
    const value = byDay[key] || 0;
    const intensity =
      value === 0 ? 'bg-white/5' :
      value < 25 ? 'bg-royal-slate-blue/30' :
      value < 75 ? 'bg-royal-slate-blue/55' :
      value < 150 ? 'bg-royal-slate-blue/80' : 'bg-ice-blue';
    cells.push(
      `<div class="w-3 h-3 rounded-sm ${intensity}" title="${key}: ${value} XP"></div>`
    );
  }
  return `
    <section class="glass-card rounded-2xl p-5">
      <h3 class="text-sm font-bold mb-3 flex items-center gap-2">
        <span class="material-symbols-outlined text-base accent-target" aria-hidden="true">grid_view</span>
        Last 90 days
      </h3>
      <div class="overflow-x-auto">
        <div class="grid grid-rows-7 grid-flow-col gap-1 w-max">${cells.join('')}</div>
      </div>
    </section>`;
}

function badgesHtml(badges) {
  return `
    <section class="glass-card rounded-2xl p-5">
      <h3 class="text-sm font-bold mb-3 flex items-center gap-2">
        <span class="material-symbols-outlined text-base accent-target" aria-hidden="true">workspace_premium</span>
        Badges <span class="text-outline font-normal">· ${badges.length}</span>
      </h3>
      ${
        badges.length === 0
          ? `<p class="text-xs text-outline py-6 text-center">No badges yet — complete tasks to start earning them.</p>`
          : `<div class="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              ${badges
                .map(
                  (b) => `
                <div class="p-3 rounded-xl border text-center ${RARITY_STYLES[b.rarity] || RARITY_STYLES.COMMON}">
                  <span class="material-symbols-outlined text-2xl" aria-hidden="true">${escapeHtml(b.icon || 'military_tech')}</span>
                  <div class="text-[11px] font-bold mt-1 truncate">${escapeHtml(b.name)}</div>
                  <div class="text-[9px] uppercase tracking-wider opacity-70">${escapeHtml(b.rarity)}</div>
                </div>`
                )
                .join('')}
            </div>`
      }
    </section>`;
}

function achievementsHtml(achievements) {
  const sorted = [...achievements].sort((a, b) => Number(b.unlocked) - Number(a.unlocked));
  return `
    <section class="glass-card rounded-2xl p-5">
      <h3 class="text-sm font-bold mb-3 flex items-center gap-2">
        <span class="material-symbols-outlined text-base accent-target" aria-hidden="true">emoji_events</span>
        Achievements
        <span class="text-outline font-normal">· ${achievements.filter((a) => a.unlocked).length}/${achievements.length}</span>
      </h3>
      <ul class="space-y-2 max-h-80 overflow-y-auto pr-1">
        ${sorted
          .map((a) => {
            const pct = Math.min(100, Math.round((a.progress / a.target) * 100));
            return `
            <li class="p-3 rounded-xl border ${a.unlocked ? 'bg-emerald-500/10 border-emerald-500/25' : 'bg-white/5 border-white/10'}">
              <div class="flex items-center gap-2">
                <span class="material-symbols-outlined text-base ${a.unlocked ? 'text-emerald-400' : 'text-outline'}" aria-hidden="true">
                  ${a.unlocked ? 'check_circle' : 'lock'}
                </span>
                <span class="flex-1 min-w-0">
                  <span class="block text-xs font-bold ${a.unlocked ? 'text-white' : 'text-outline'} truncate">${escapeHtml(a.title)}</span>
                  <span class="block text-[10px] text-outline truncate">${escapeHtml(a.description)}</span>
                </span>
                <span class="text-[10px] font-bold text-outline shrink-0">${a.progress}/${a.target}</span>
              </div>
              ${
                a.unlocked
                  ? ''
                  : `<div class="h-1 rounded-full bg-white/10 mt-2 overflow-hidden">
                      <div class="h-full bg-royal-slate-blue" style="width:${pct}%"></div>
                    </div>`
              }
            </li>`;
          })
          .join('')}
      </ul>
    </section>`;
}

function recentXpHtml(entries) {
  if (!entries.length) return '';
  return `
    <section class="glass-card rounded-2xl p-5">
      <h3 class="text-sm font-bold mb-3 flex items-center gap-2">
        <span class="material-symbols-outlined text-base accent-target" aria-hidden="true">history</span> Recent XP
      </h3>
      <ul class="divide-y divide-white/5">
        ${entries
          .map(
            (e) => `
          <li class="flex items-center gap-3 py-2">
            <span class="text-xs font-black text-emerald-400 w-14 shrink-0">+${e.amount}</span>
            <span class="flex-1 min-w-0 text-xs text-white truncate">${escapeHtml(e.description || e.source_type)}</span>
            <span class="text-[10px] text-outline shrink-0">${new Date(e.created_at).toLocaleDateString()}</span>
          </li>`
          )
          .join('')}
      </ul>
    </section>`;
}
