// Standalone public profile. Reachable without a session, so it renders from
// the public endpoint alone and never touches authenticated state.
import { escapeHtml } from '../utils/dom.js';

const RARITY_ORDER = { LEGENDARY: 0, EPIC: 1, RARE: 2, UNCOMMON: 3, COMMON: 4 };

export async function renderPublicProfile(slug, mount) {
  mount.innerHTML = '<div class="empty"><p class="empty__text">Loading…</p></div>';

  let profile;
  try {
    const res = await fetch(`/api/public/profile/${encodeURIComponent(slug)}`);
    if (!res.ok) throw new Error('not found');
    profile = (await res.json()).profile;
  } catch (_) {
    mount.innerHTML = `
      <div class="empty">
        <p class="empty__title">Profile not available</p>
        <p class="empty__text">This profile does not exist, or its owner has not made it public.</p>
      </div>`;
    return;
  }

  const badges = [...profile.badges].sort(
    (a, b) => (RARITY_ORDER[a.rarity] ?? 9) - (RARITY_ORDER[b.rarity] ?? 9)
  );

  mount.innerHTML = `
    <article class="page__inner">
      <header class="page__head">
        <div class="row" style="align-items:flex-start;gap:var(--sp-5)">
          <span class="avatar avatar--lg">${escapeHtml(initials(profile.name))}</span>
          <div>
            <h1 class="title">${escapeHtml(profile.name)}</h1>
            ${profile.tag ? `<p class="subtitle">${escapeHtml(profile.tag)}</p>` : ''}
            ${profile.bio ? `<p class="lede" style="margin-top:var(--sp-3)">${escapeHtml(profile.bio)}</p>` : ''}
            ${linksHtml(profile.links)}
          </div>
        </div>
      </header>

      <section class="grid grid--3" style="margin-bottom:var(--sp-8)">
        <div class="stat"><span class="stat__value num">${profile.level}</span><span class="stat__label">Level</span></div>
        <div class="stat"><span class="stat__value num">${Number(profile.xp).toLocaleString()}</span><span class="stat__label">Experience</span></div>
        <div class="stat"><span class="stat__value num">${profile.work.length}</span><span class="stat__label">Approved pieces</span></div>
      </section>

      ${contributionsHtml(profile.contributions)}

      ${badges.length ? `
        <section class="section">
          <span class="eyebrow" style="margin-bottom:var(--sp-3)">Badges</span>
          <div class="row row--wrap">
            ${badges.map((b) => `<span class="chip" title="${escapeHtml(b.description || '')}">${escapeHtml(b.name)}</span>`).join('')}
          </div>
        </section>` : ''}

      ${profile.titles.length ? `
        <section class="section">
          <span class="eyebrow" style="margin-bottom:var(--sp-3)">Titles</span>
          <div class="row row--wrap">
            ${profile.titles.map((t) => `<span class="chip chip--accent">${escapeHtml(t.name)}</span>`).join('')}
          </div>
        </section>` : ''}

      <section class="section">
        <span class="eyebrow" style="margin-bottom:var(--sp-3)">Approved work</span>
        ${
          profile.work.length
            ? `<div class="list">${profile.work.map((w) => `
                <div class="list__row">
                  <span style="flex:1;min-width:0">
                    <strong class="truncate" style="display:block">${escapeHtml(w.title)}</strong>
                    <span class="text-faint" style="font-size:.8125rem">${escapeHtml(w.difficulty || '')}</span>
                  </span>
                  <span class="text-faint num" style="font-size:.8125rem">${w.completed_at ? new Date(w.completed_at).toLocaleDateString() : ''}</span>
                </div>`).join('')}</div>`
            : '<p class="text-faint">No approved work published yet.</p>'
        }
      </section>

      <footer style="margin-top:var(--sp-10);padding-top:var(--sp-5);border-top:1px solid var(--rule, var(--line, rgba(127,127,140,.25)))">
        <p class="text-faint" style="font-size:.8125rem">Built on Forge</p>
      </footer>
    </article>`;
}

function linksHtml(links) {
  const items = [
    links.github ? `<a href="${escapeHtml(links.github)}" rel="noopener noreferrer nofollow" target="_blank">GitHub</a>` : '',
    links.portfolio ? `<a href="${escapeHtml(links.portfolio)}" rel="noopener noreferrer nofollow" target="_blank">Portfolio</a>` : ''
  ].filter(Boolean);
  return items.length ? `<p class="row row--tight" style="margin-top:var(--sp-3)">${items.join('')}</p>` : '';
}

/** A year of activity as a compact heatmap. */
function contributionsHtml(contributions) {
  if (!contributions || !contributions.length) return '';
  const byDay = Object.fromEntries(contributions.map((c) => [c.day, c.total]));
  const cells = [];
  const today = new Date();
  for (let i = 364; i >= 0; i -= 1) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    const v = byDay[key] || 0;
    const shade = v === 0 ? 'var(--paper-tint, rgba(127,127,140,.22))'
      : v < 25 ? 'var(--accent-line, rgba(91,141,239,.35))'
      : v < 75 ? 'rgba(91,141,239,.55)'
      : v < 150 ? 'rgba(91,141,239,.78)'
      : 'var(--accent-text, var(--accent, #5b8def))';
    cells.push(`<span style="width:9px;height:9px;border-radius:2px;background:${shade}" title="${key}: ${v} XP"></span>`);
  }
  return `
    <section class="section">
      <span class="eyebrow" style="margin-bottom:var(--sp-3)">Last year</span>
      <div style="overflow-x:auto">
        <div style="display:grid;grid-template-rows:repeat(7,9px);grid-auto-flow:column;gap:3px;width:max-content">${cells.join('')}</div>
      </div>
    </section>`;
}

function initials(name) {
  return String(name || '?').split(/\s+/).slice(0, 2).map((p) => p[0] || '').join('').toUpperCase();
}
