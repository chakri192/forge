// Private reflection journal. Entries never leave the owner's account.
import { fetchJournal, createJournalEntry, deleteJournalEntry } from '../services/api.js';
import { showToast } from '../components/toast.js';
import { withUndo } from '../utils/undo.js';
import { bindDraft, clearDraft } from '../utils/drafts.js';
import { renderSkeleton } from '../components/spinner.js';
import { escapeHtml, timeAgo } from '../utils/dom.js';

const MOODS = [
  { value: 'great', icon: 'sentiment_very_satisfied', label: 'Great', cls: 'text-emerald-400' },
  { value: 'good', icon: 'sentiment_satisfied', label: 'Good', cls: 'text-sky-400' },
  { value: 'okay', icon: 'sentiment_neutral', label: 'Okay', cls: 'text-outline' },
  { value: 'tough', icon: 'sentiment_dissatisfied', label: 'Tough', cls: 'text-amber-400' },
  { value: 'stuck', icon: 'sentiment_very_dissatisfied', label: 'Stuck', cls: 'text-red-400' }
];

export function renderJournalView(state) {
  if (!state.currentUser) {
    return `<div class="glass-card p-10 rounded-2xl text-center text-sm text-outline">Sign in to write in your journal.</div>`;
  }
  return `
    <div class="space-y-5 max-w-3xl">
      <div>
        <h2 class="text-2xl font-extrabold tracking-tight flex items-center gap-2.5">
          <span class="material-symbols-outlined text-3xl accent-target">menu_book</span> Reflection Journal
        </h2>
        <p class="text-xs text-outline mt-1 flex items-center gap-1.5">
          <span class="material-symbols-outlined text-sm" aria-hidden="true">lock</span>
          Private to you — nobody else can read these entries.
        </p>
      </div>

      <form class="glass-card rounded-2xl p-5 space-y-3.5" id="journalForm">
        <input id="journalTitle" maxlength="160" required placeholder="What did you work on?"
          class="input" />
        <textarea id="journalContent" rows="4" maxlength="20000" required placeholder="What was hard? What clicked? What would you do differently?"
          class="input"></textarea>
        <div class="flex items-center gap-2.5 flex-wrap">
          <div class="flex gap-1" role="radiogroup" aria-label="How did it go?">
            ${MOODS.map(
              (m) => `
              <button type="button" class="mood-btn p-2 rounded-xl border border-transparent hover:bg-white/5 transition-all ${m.cls}"
                data-mood="${m.value}" role="radio" aria-checked="false" title="${m.label}" aria-label="${m.label}">
                <span class="material-symbols-outlined text-xl" aria-hidden="true">${m.icon}</span>
              </button>`
            ).join('')}
          </div>
          <input id="journalTags" maxlength="200" placeholder="tags: css, testing"
            class="flex-1 min-w-[140px] bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder:text-outline focus:outline-none focus:border-royal-slate-blue/60" />
          <button type="submit" class="btn btn--primary">
            <span class="material-symbols-outlined text-base" aria-hidden="true">save</span> Save entry
          </button>
        </div>
      </form>

      <div id="journalList" class="space-y-3">${renderSkeleton('card', { className: 'rounded-2xl' })}</div>
    </div>`;
}

export function attachJournalEvents(state) {
  if (!state.currentUser) return;
  const listEl = document.getElementById('journalList');
  const form = document.getElementById('journalForm');
  let selectedMood = null;

  form.querySelectorAll('.mood-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      selectedMood = selectedMood === btn.dataset.mood ? null : btn.dataset.mood;
      form.querySelectorAll('.mood-btn').forEach((b) => {
        const active = b.dataset.mood === selectedMood;
        b.classList.toggle('bg-white/10', active);
        b.classList.toggle('border-white/20', active);
        b.setAttribute('aria-checked', String(active));
      });
    });
  });

  bindDraft('journal-composer', {
    title: document.getElementById('journalTitle'),
    content: document.getElementById('journalContent'),
    tags: document.getElementById('journalTags')
  });

  async function refresh() {
    try {
      const { entries } = await fetchJournal();
      listEl.innerHTML = entries.length
        ? entries.map(entryHtml).join('')
        : `<div class="glass-card rounded-2xl p-10 text-center space-y-2">
            <span class="material-symbols-outlined text-4xl text-outline" aria-hidden="true">edit_note</span>
            <p class="text-sm text-white font-semibold">No entries yet</p>
            <p class="text-xs text-outline">Reflecting on what you build is how it sticks.</p>
          </div>`;
      bindEntries();
    } catch (_) {
      listEl.innerHTML = `<div class="glass-card rounded-2xl p-8 text-center text-sm text-outline">Unable to load your journal.</div>`;
    }
  }

  function entryHtml(e) {
    const mood = MOODS.find((m) => m.value === e.mood);
    const tags = (e.tags || '')
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);
    return `
      <article class="glass-card rounded-2xl p-5" data-entry-id="${e.id}">
        <div class="flex items-start gap-2.5">
          ${mood ? `<span class="material-symbols-outlined text-xl ${mood.cls} shrink-0" title="${mood.label}" aria-hidden="true">${mood.icon}</span>` : ''}
          <h3 class="text-sm font-bold text-white flex-1 min-w-0">${escapeHtml(e.title)}</h3>
          <span class="text-[11px] text-outline shrink-0">${timeAgo(e.created_at)}</span>
        </div>
        <p class="text-[13px] text-white/85 leading-relaxed mt-2 whitespace-pre-wrap break-words">${escapeHtml(e.content)}</p>
        <div class="flex items-center gap-2 mt-3 pt-3 border-t border-white/5 flex-wrap">
          ${tags
            .map(
              (t) => `<span class="px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-[10px] text-outline">${escapeHtml(t)}</span>`
            )
            .join('')}
          <span class="flex-1"></span>
          <button class="entry-delete text-[11px] font-semibold text-red-400/80 hover:text-red-300" data-id="${e.id}">Delete</button>
        </div>
      </article>`;
  }

  function bindEntries() {
    listEl.querySelectorAll('.entry-delete').forEach((btn) => {
      btn.addEventListener('click', () => {
        const card = listEl.querySelector(`[data-entry-id="${btn.dataset.id}"]`);
        if (!card) return;
        const anchor = card.nextElementSibling;
        withUndo({
          title: 'Entry deleted',
          message: 'Your reflection will be removed.',
          optimistic: () => card.remove(),
          revert: () => {
            if (anchor && anchor.isConnected) listEl.insertBefore(card, anchor);
            else listEl.appendChild(card);
            bindEntries();
          },
          apply: () => deleteJournalEntry(btn.dataset.id)
        });
      });
    });
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const title = document.getElementById('journalTitle').value.trim();
    const content = document.getElementById('journalContent').value.trim();
    if (!title || !content) return;
    try {
      await createJournalEntry({
        title,
        content,
        mood: selectedMood,
        tags: document.getElementById('journalTags').value.trim() || null
      });
      form.reset();
      clearDraft('journal-composer');
      selectedMood = null;
      form.querySelectorAll('.mood-btn').forEach((b) => {
        b.classList.remove('bg-white/10', 'border-white/20');
        b.setAttribute('aria-checked', 'false');
      });
      showToast({ title: 'Entry saved', message: 'Only you can see it.', type: 'success' });
      refresh();
    } catch (_) {}
  });

  refresh();
}
