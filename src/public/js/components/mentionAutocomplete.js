// Autocomplete for @mentions in a composer.
//
// Attaches to a textarea and watches the token under the caret. Nothing is
// inserted without an explicit pick — typing "@" then carrying on writing
// leaves the text exactly as typed.
import { fetchAllUsers } from '../services/api.js';
import { escapeHtml } from '../utils/dom.js';

const MAX_SHOWN = 6;

/** Cached for the session: the roster does not change mid-sentence, and a
 *  request per keystroke would be absurd. */
let rosterPromise = null;

function roster() {
  if (!rosterPromise) {
    rosterPromise = fetchAllUsers()
      .then((users) => (Array.isArray(users) ? users : users?.users || []))
      .catch(() => []);
  }
  return rosterPromise;
}

/**
 * The @token the caret currently sits in, if any.
 *
 * Only fires when the "@" starts a word, so an email address never opens the
 * picker mid-typing.
 */
function tokenAtCaret(input) {
  const caret = input.selectionStart ?? 0;
  const upTo = input.value.slice(0, caret);
  const match = upTo.match(/(^|[^\w@])@([a-zA-Z0-9_]{0,32})$/);
  if (!match) return null;
  return { query: match[2], start: caret - match[2].length - 1, end: caret };
}

/**
 * @param {HTMLTextAreaElement} input
 * @returns {() => void} detach
 */
export function attachMentionAutocomplete(input) {
  if (!input || input.dataset.mentionBound === '1') return () => {};
  input.dataset.mentionBound = '1';

  let panel = null;
  let matches = [];
  let cursor = 0;
  let token = null;

  const close = () => {
    panel?.remove();
    panel = null;
    matches = [];
    token = null;
  };

  function paint() {
    if (!panel) {
      panel = document.createElement('div');
      panel.className = 'mentions';
      panel.setAttribute('role', 'listbox');
      panel.setAttribute('aria-label', 'Mention someone');
      document.body.appendChild(panel);
    }

    panel.innerHTML = matches
      .map(
        (u, i) => `
        <button type="button" class="mentions__item ${i === cursor ? 'is-cursor' : ''}"
          role="option" aria-selected="${i === cursor}" data-username="${escapeHtml(u.username)}">
          <span class="mentions__name">${escapeHtml(u.name)}</span>
          <span class="mentions__handle">@${escapeHtml(u.username)}</span>
        </button>`
      )
      .join('');

    panel.querySelectorAll('[data-username]').forEach((btn) =>
      // mousedown, not click: the textarea must not lose focus first, or the
      // caret position we are about to splice into is gone.
      btn.addEventListener('mousedown', (e) => {
        e.preventDefault();
        pick(btn.dataset.username);
      })
    );

    position();
  }

  /** Above the composer when there is no room below, same as the emoji picker. */
  function position() {
    const box = input.getBoundingClientRect();
    const height = panel.offsetHeight;
    const below = window.innerHeight - box.bottom;
    const top = below > height + 12 ? box.bottom + 6 : box.top - height - 6;
    panel.style.top = `${Math.max(8, Math.min(top, window.innerHeight - height - 8))}px`;
    panel.style.left = `${Math.max(8, Math.min(box.left, window.innerWidth - panel.offsetWidth - 8))}px`;
    panel.style.width = `${Math.min(320, box.width)}px`;
  }

  function pick(username) {
    if (!token) return;
    const before = input.value.slice(0, token.start);
    const after = input.value.slice(token.end);
    const insert = `@${username} `;
    input.value = `${before}${insert}${after}`;
    const caret = before.length + insert.length;
    input.setSelectionRange(caret, caret);
    input.focus();
    close();
    // Drafts and autosize listen on input; a programmatic splice fires neither.
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }

  async function refresh() {
    token = tokenAtCaret(input);
    if (!token) return close();

    const query = token.query.toLowerCase();
    const users = await roster();
    // The token may have moved on while the roster was loading.
    const still = tokenAtCaret(input);
    if (!still || still.start !== token.start) return;
    token = still;

    matches = users
      .filter(
        (u) =>
          u.username &&
          (u.username.toLowerCase().startsWith(query) || u.name?.toLowerCase().includes(query))
      )
      .slice(0, MAX_SHOWN);

    if (!matches.length) return close();
    cursor = 0;
    paint();
  }

  const onInput = () => refresh();

  const onKey = (event) => {
    if (!panel || !matches.length) return;
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      cursor = (cursor + (event.key === 'ArrowDown' ? 1 : -1) + matches.length) % matches.length;
      paint();
      return;
    }
    // Enter picks rather than sending: the picker is only open because the
    // author is mid-name, and sending a half-typed handle is never the intent.
    if (event.key === 'Enter' || event.key === 'Tab') {
      event.preventDefault();
      event.stopPropagation();
      pick(matches[cursor].username);
      return;
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      close();
    }
  };

  const onBlur = () => setTimeout(close, 120);

  input.addEventListener('input', onInput);
  input.addEventListener('keydown', onKey, true);
  input.addEventListener('blur', onBlur);

  return () => {
    close();
    input.removeEventListener('input', onInput);
    input.removeEventListener('keydown', onKey, true);
    input.removeEventListener('blur', onBlur);
    delete input.dataset.mentionBound;
  };
}
