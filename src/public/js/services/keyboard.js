// Global keyboard shortcuts. All handlers bail out when the user is typing so
// shortcuts never steal keystrokes from an input, textarea, or select.
import { store } from '../state/store.js';
import { openPalette, isPaletteOpen, closePalette } from '../components/commandPalette.js';

const GOTO_MAP = {
  d: 'dashboard',
  t: 'tasks',
  e: 'teams',
  h: 'halloffame',
  m: 'messages',
  a: 'announcements',
  f: 'forum',
  k: 'marketplace',
  l: 'calendar',
  p: 'profile',
  j: 'journal',
  s: 'settings'
};

// `g` then a letter jumps between sections; the prefix expires quickly so a
// stray `g` never swallows the next keypress.
const CHORD_TIMEOUT_MS = 900;

function isTyping(target) {
  if (!target) return false;
  if (target.isContentEditable) return true;
  const tag = target.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
}

export function initKeyboardShortcuts() {
  let gotoPending = false;
  let gotoTimer = null;

  const clearChord = () => {
    gotoPending = false;
    clearTimeout(gotoTimer);
  };

  document.addEventListener('keydown', (event) => {
    // Command palette works from anywhere, including inside inputs.
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
      event.preventDefault();
      isPaletteOpen() ? closePalette() : openPalette();
      return;
    }

    if (event.metaKey || event.ctrlKey || event.altKey) return;
    if (isTyping(event.target)) return;
    if (!store.getState().currentUser) return;

    if (gotoPending) {
      const tab = GOTO_MAP[event.key.toLowerCase()];
      clearChord();
      if (tab) {
        event.preventDefault();
        store.setState({ activeTab: tab });
      }
      return;
    }

    if (event.key === 'g') {
      gotoPending = true;
      gotoTimer = setTimeout(clearChord, CHORD_TIMEOUT_MS);
      return;
    }

    // `/` focuses the most relevant search box on the current view.
    if (event.key === '/') {
      const search =
        document.getElementById('taskSearchInput') || document.getElementById('composerInput');
      if (search) {
        event.preventDefault();
        search.focus();
      } else {
        event.preventDefault();
        openPalette();
      }
      return;
    }

    if (event.key === '?') {
      event.preventDefault();
      showShortcutHelp();
    }
  });
}

async function showShortcutHelp() {
  const { openModal } = await import('../components/modal.js');
  openModal({
    title: 'Keyboard shortcuts',
    contentHtml: `
      <dl class="space-y-2 text-xs">
        ${[
          ['⌘K / Ctrl+K', 'Open command palette'],
          ['g then d', 'Dashboard'],
          ['g then t', 'Tasks'],
          ['g then m', 'Messages'],
          ['g then a', 'Announcements'],
          ['g then h', 'Hall of Fame'],
          ['/', 'Focus search'],
          ['Enter / Shift+Enter', 'Send message / new line'],
          ['Esc', 'Close dialogs and menus']
        ]
          .map(
            ([keys, description]) => `
          <div class="flex items-center justify-between gap-4 py-1.5 border-b border-white/5">
            <dt class="text-outline">${description}</dt>
            <dd><kbd class="px-2 py-1 rounded-lg bg-white/10 text-[11px] font-bold text-white">${keys}</kbd></dd>
          </div>`
          )
          .join('')}
      </dl>`
  });
}
