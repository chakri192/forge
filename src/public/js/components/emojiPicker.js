// Emoji picker: search, grouping, recents, and full keyboard control.
//
// One instance at a time, anchored to whatever opened it. The previous version
// was a flat grid of fourteen — fine to look at, useless to search.
import { EMOJI, EMOJI_GROUPS, searchEmoji, recentEmoji, rememberEmoji } from '../utils/emoji.js';
import { escapeHtml } from '../utils/dom.js';

let open = null;

/**
 * @param {HTMLElement} anchor  element the picker points at
 * @param {(emoji: string) => void} onPick
 */
export function openEmojiPicker(anchor, onPick) {
  closeEmojiPicker();

  const el = document.createElement('div');
  el.className = 'epick';
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-label', 'Choose an emoji');
  el.innerHTML = `
    <div class="epick__head">
      <input class="epick__search" type="search" placeholder="Search emoji…"
        aria-label="Search emoji" autocomplete="off" spellcheck="false" />
    </div>
    <div class="epick__tabs" role="tablist">
      ${['Recent', ...EMOJI_GROUPS]
        .map(
          (g, i) => `<button class="epick__tab ${i === 0 ? 'is-active' : ''}" role="tab"
            data-group="${escapeHtml(g)}" aria-selected="${i === 0}">${escapeHtml(g)}</button>`
        )
        .join('')}
    </div>
    <div class="epick__grid" role="listbox" aria-label="Emoji"></div>
    <div class="epick__foot"><span class="epick__hint" data-hint>Arrow keys to move, Enter to pick</span></div>`;

  document.body.appendChild(el);

  const search = el.querySelector('.epick__search');
  const grid = el.querySelector('.epick__grid');
  const hint = el.querySelector('[data-hint]');
  let group = 'Recent';
  let cursor = 0;

  function visible() {
    const q = search.value.trim();
    if (q) return searchEmoji(q);
    if (group === 'Recent') {
      const recents = recentEmoji();
      // An empty Recent tab is a dead end, so fall back to the first group.
      return recents.length
        ? recents.map((e) => EMOJI.find((x) => x.emoji === e)).filter(Boolean)
        : EMOJI.filter((e) => e.group === EMOJI_GROUPS[0]);
    }
    return EMOJI.filter((e) => e.group === group);
  }

  function paint() {
    const items = visible();
    cursor = Math.min(cursor, Math.max(0, items.length - 1));

    grid.innerHTML = items.length
      ? items
          .map(
            (e, i) => `
        <button class="epick__item ${i === cursor ? 'is-cursor' : ''}" role="option"
          aria-selected="${i === cursor}" data-emoji="${escapeHtml(e.emoji)}"
          title="${escapeHtml(e.keywords[0])}" tabindex="-1">${escapeHtml(e.emoji)}</button>`
          )
          .join('')
      : `<p class="epick__empty">Nothing matches “${escapeHtml(search.value.trim())}”.</p>`;

    grid.querySelectorAll('[data-emoji]').forEach((btn) =>
      btn.addEventListener('click', () => choose(btn.dataset.emoji))
    );
    if (items[cursor]) hint.textContent = items[cursor].keywords[0];
  }

  function choose(emoji) {
    rememberEmoji(emoji);
    onPick(emoji);
    closeEmojiPicker();
  }

  el.querySelectorAll('[data-group]').forEach((tab) =>
    tab.addEventListener('click', () => {
      group = tab.dataset.group;
      search.value = '';
      cursor = 0;
      el.querySelectorAll('[data-group]').forEach((t) => {
        t.classList.toggle('is-active', t === tab);
        t.setAttribute('aria-selected', String(t === tab));
      });
      paint();
    })
  );

  search.addEventListener('input', () => {
    cursor = 0;
    paint();
  });

  // Arrow keys move a cursor rather than focus, so typing in the search box
  // and navigating the grid work at the same time.
  const onKey = (event) => {
    const items = visible();
    const perRow = 8;
    const moves = {
      ArrowRight: 1, ArrowLeft: -1, ArrowDown: perRow, ArrowUp: -perRow
    };
    if (event.key in moves) {
      event.preventDefault();
      cursor = Math.max(0, Math.min(items.length - 1, cursor + moves[event.key]));
      paint();
      grid.querySelector('.is-cursor')?.scrollIntoView({ block: 'nearest' });
      return;
    }
    if (event.key === 'Enter' && items[cursor]) {
      event.preventDefault();
      choose(items[cursor].emoji);
      return;
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      closeEmojiPicker();
      anchor.focus();
    }
  };

  const onOutside = (event) => {
    if (!el.contains(event.target) && event.target !== anchor) closeEmojiPicker();
  };

  el.addEventListener('keydown', onKey);
  document.addEventListener('click', onOutside, true);

  // A panel pinned to a fixed position is wrong the moment its anchor moves,
  // and its anchor may not survive a route change at all — so dismiss instead
  // of chasing.
  const dismiss = () => closeEmojiPicker();
  window.addEventListener('hashchange', dismiss);
  window.addEventListener('resize', dismiss);
  window.addEventListener('scroll', dismiss, true);

  open = {
    el,
    teardown: () => {
      document.removeEventListener('click', onOutside, true);
      window.removeEventListener('hashchange', dismiss);
      window.removeEventListener('resize', dismiss);
      window.removeEventListener('scroll', dismiss, true);
    }
  };

  // Paint first: the grid decides the height, and the height decides whether
  // the panel opens above or below the anchor.
  paint();
  position(el, anchor);
  // Opening mid-relayout gives a stale anchor rect, which pins the panel to a
  // corner. A second pass on the next frame corrects it, and is a no-op
  // otherwise since nothing has moved.
  requestAnimationFrame(() => open?.el === el && position(el, anchor));
  search.focus();
}

export function closeEmojiPicker() {
  if (!open) return;
  open.teardown();
  open.el.remove();
  open = null;
}

/** Anchored below when there is room, above when there is not — and never
 *  past an edge, however little room either side leaves. */
function position(el, anchor) {
  const box = anchor.getBoundingClientRect();
  const height = el.offsetHeight;
  const width = el.offsetWidth;
  const fitsBelow = window.innerHeight - box.bottom > height + 12;

  const top = fitsBelow ? box.bottom + 6 : box.top - height - 6;
  const clamp = (value, max) => Math.max(8, Math.min(value, max - 8));

  el.style.top = `${clamp(top, window.innerHeight - height)}px`;
  el.style.left = `${clamp(box.left, window.innerWidth - width)}px`;
}
