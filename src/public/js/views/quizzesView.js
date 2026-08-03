// Quizzes & puzzles: browse, play, and review with explanations.
import { fetchQuizzes, fetchQuiz, fetchDailyPuzzle, submitQuiz } from '../services/api.js';
import { showToast } from '../components/toast.js';
import { renderSkeleton } from '../components/spinner.js';
import { pushHash, currentParam } from '../router/hashRouter.js';
import { escapeHtml } from '../utils/dom.js';

const DIFFICULTY_STYLES = {
  EASY: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  MEDIUM: 'bg-sky-500/15 text-sky-300 border-sky-500/30',
  HARD: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  EXPERT: 'bg-red-500/15 text-red-300 border-red-500/30'
};

let startedAt = null;

export function renderQuizzesView(state) {
  if (!state.currentUser) {
    return `<div class="glass-card p-10 rounded-2xl text-center text-sm text-outline">Sign in to take quizzes.</div>`;
  }
  return `
    <div class="space-y-5 max-w-4xl">
      <div>
        <h2 class="text-2xl font-extrabold tracking-tight flex items-center gap-2.5">
          <span class="material-symbols-outlined text-3xl accent-target">quiz</span> Quizzes &amp; Puzzles
        </h2>
        <p class="text-xs text-outline mt-1">Test what you know, earn XP, and see exactly where you went wrong.</p>
      </div>
      <div id="quizRoot">${renderSkeleton('card', { className: 'rounded-2xl' })}</div>
    </div>`;
}

export function attachQuizzesEvents(state) {
  if (!state.currentUser) return;
  const root = document.getElementById('quizRoot');

  async function showList() {
    pushHash('quizzes');
    try {
      const [{ quizzes }, daily] = await Promise.all([fetchQuizzes(), fetchDailyPuzzle()]);
      const puzzles = quizzes.filter((q) => q.kind === 'PUZZLE');
      const standard = quizzes.filter((q) => q.kind !== 'PUZZLE');

      root.innerHTML = `
        ${daily.puzzle ? dailyPuzzleHtml(daily) : ''}
        ${section('Quizzes', 'quiz', standard)}
        ${section('Puzzle archive', 'extension', puzzles)}
        ${
          quizzes.length === 0
            ? `<div class="glass-card rounded-2xl p-10 text-center space-y-2">
                <span class="material-symbols-outlined text-4xl text-outline" aria-hidden="true">quiz</span>
                <p class="text-sm text-white font-semibold">No quizzes yet</p>
                <p class="text-xs text-outline">Leaders and teachers can publish quizzes for the cohort.</p>
              </div>`
            : ''
        }`;

      root.querySelectorAll('[data-quiz-open]').forEach((el) => {
        el.addEventListener('click', () => showQuiz(el.dataset.quizOpen));
      });
    } catch (_) {
      root.innerHTML = `<div class="glass-card rounded-2xl p-8 text-center text-sm text-outline">Unable to load quizzes.</div>`;
    }
  }

  function dailyPuzzleHtml(daily) {
    const p = daily.puzzle;
    return `
      <section class="glass-card rounded-2xl p-5 border-royal-slate-blue/30 bg-gradient-to-br from-royal-slate-blue/10 to-transparent mb-5">
        <div class="flex items-center gap-2 mb-2">
          <span class="material-symbols-outlined text-base text-amber-400" aria-hidden="true">local_fire_department</span>
          <span class="text-[10px] font-bold uppercase tracking-wider text-amber-400">Puzzle of the day</span>
          ${daily.solved ? '<span class="ml-auto flex items-center gap-1 text-[10px] font-bold text-emerald-400"><span class="material-symbols-outlined text-xs" aria-hidden="true">check_circle</span>Solved</span>' : ''}
        </div>
        <h3 class="text-lg font-bold">${escapeHtml(p.title)}</h3>
        <p class="text-xs text-outline mt-1">${escapeHtml(p.description || '')}</p>
        <button data-quiz-open="${p.id}" class="mt-3 px-4 py-2 bg-royal-slate-blue hover:opacity-90 text-white font-bold text-xs rounded-xl transition-all">
          ${daily.solved ? 'Review it' : 'Solve it'} · ${p.xp_reward} XP
        </button>
      </section>`;
  }

  function section(title, icon, items) {
    if (!items.length) return '';
    return `
      <section class="space-y-2.5 mb-5">
        <h3 class="eyebrow flex items-center gap-2">
          <span class="material-symbols-outlined text-sm" aria-hidden="true">${icon}</span>
          ${title} <span class="text-outline/60">· ${items.length}</span>
        </h3>
        ${items.map(cardHtml).join('')}
      </section>`;
  }

  function cardHtml(q) {
    const diff = DIFFICULTY_STYLES[q.difficulty] || DIFFICULTY_STYLES.MEDIUM;
    return `
      <article class="glass-card is-interactive rounded-2xl p-4 flex items-center gap-4">
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-2 flex-wrap">
            <h4 class="text-sm font-bold text-white">${escapeHtml(q.title)}</h4>
            <span class="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${diff}">${escapeHtml(q.difficulty)}</span>
            ${q.passed ? '<span class="flex items-center gap-1 text-[10px] font-bold text-emerald-400"><span class="material-symbols-outlined text-xs" aria-hidden="true">check_circle</span>Passed</span>' : ''}
            ${!q.is_published ? '<span class="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-white/5 border border-white/15 text-outline">Draft</span>' : ''}
          </div>
          <p class="text-xs text-outline mt-1 line-clamp-1">${escapeHtml(q.description || '')}</p>
          <div class="flex items-center gap-3 mt-1.5 text-[11px] text-outline">
            <span>${q.question_count} question${q.question_count === 1 ? '' : 's'}</span>
            <span>${q.xp_reward} XP</span>
            <span>Pass at ${q.pass_percent}%</span>
            ${q.best_percent !== null && q.best_percent !== undefined ? `<span class="text-white font-semibold">Best ${q.best_percent}%</span>` : ''}
          </div>
        </div>
        <button data-quiz-open="${q.id}" class="btn btn--ghost">
          ${q.attempts ? 'Retry' : 'Start'}
        </button>
      </article>`;
  }

  async function showQuiz(id) {
    pushHash('quizzes', id);
    try {
      const { quiz, questions, attempts_used } = await fetchQuiz(id);
      startedAt = Date.now();

      root.innerHTML = `
        <button id="btnBackToQuizzes" class="flex items-center gap-1.5 text-xs text-outline hover:text-white mb-3 transition-colors">
          <span class="material-symbols-outlined text-sm" aria-hidden="true">arrow_back</span> All quizzes
        </button>
        <form id="quizForm" class="space-y-4">
          <header class="glass-card rounded-2xl p-5">
            <h3 class="text-lg font-bold">${escapeHtml(quiz.title)}</h3>
            <p class="text-xs text-outline mt-1">${escapeHtml(quiz.description || '')}</p>
            <div class="flex items-center gap-3 mt-2.5 text-[11px] text-outline flex-wrap">
              <span>${questions.length} questions</span>
              <span>${quiz.max_score} points</span>
              <span>Pass at ${quiz.pass_percent}%</span>
              <span>${quiz.xp_reward} XP</span>
              ${quiz.max_attempts ? `<span>Attempt ${attempts_used + 1} of ${quiz.max_attempts}</span>` : ''}
            </div>
          </header>
          ${questions.map(questionHtml).join('')}
          <div class="flex justify-end">
            <button type="submit" class="px-6 py-3 bg-royal-slate-blue hover:opacity-90 text-white font-bold text-sm rounded-xl shadow-md transition-all">
              Submit answers
            </button>
          </div>
        </form>`;

      document.getElementById('btnBackToQuizzes').addEventListener('click', showList);
      bindHints();

      document.getElementById('quizForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const answers = collectAnswers(questions);
        const unanswered = questions.filter((q) => {
          const a = answers[q.id];
          return a === undefined || a === '' || (Array.isArray(a) && a.length === 0);
        });
        if (unanswered.length && !confirm(`${unanswered.length} question(s) are unanswered. Submit anyway?`)) {
          return;
        }
        try {
          const result = await submitQuiz(id, answers, Math.round((Date.now() - startedAt) / 1000));
          showResult(quiz, result);
        } catch (_) {}
      });
    } catch (err) {
      root.innerHTML = `
        <div class="glass-card rounded-2xl p-8 text-center space-y-2">
          <span class="material-symbols-outlined text-3xl text-outline" aria-hidden="true">lock</span>
          <p class="text-sm text-white font-semibold">${escapeHtml(err.message || 'Unable to open this quiz')}</p>
          <button id="btnBackToQuizzes" class="text-xs text-accent-text hover:underline">Back to quizzes</button>
        </div>`;
      document.getElementById('btnBackToQuizzes')?.addEventListener('click', showList);
    }
  }

  function questionHtml(q, index) {
    const inputs = {
      MCQ: () =>
        q.options
          .map(
            (opt, i) => `
        <label class="flex items-center gap-2.5 p-2.5 rounded-xl border border-white/10 hover:bg-white/5 cursor-pointer transition-colors">
          <input type="radio" name="q_${q.id}" value="${escapeHtml(opt)}" class="accent-royal-slate-blue" />
          <span class="text-xs text-white">${escapeHtml(opt)}</span>
        </label>`
          )
          .join(''),
      MULTI: () =>
        q.options
          .map(
            (opt) => `
        <label class="flex items-center gap-2.5 p-2.5 rounded-xl border border-white/10 hover:bg-white/5 cursor-pointer transition-colors">
          <input type="checkbox" name="q_${q.id}" value="${escapeHtml(opt)}" class="accent-royal-slate-blue" />
          <span class="text-xs text-white">${escapeHtml(opt)}</span>
        </label>`
          )
          .join(''),
      TRUE_FALSE: () =>
        ['true', 'false']
          .map(
            (opt) => `
        <label class="flex items-center gap-2.5 p-2.5 rounded-xl border border-white/10 hover:bg-white/5 cursor-pointer transition-colors">
          <input type="radio" name="q_${q.id}" value="${opt}" class="accent-royal-slate-blue" />
          <span class="text-xs text-white capitalize">${opt}</span>
        </label>`
          )
          .join(''),
      SHORT_ANSWER: () => `
        <input type="text" name="q_${q.id}" placeholder="Type your answer…"
          class="input" />`,
      CODE_OUTPUT: () => `
        <input type="text" name="q_${q.id}" placeholder="What does it print?"
          class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm font-mono text-white placeholder:text-outline focus:outline-none focus:border-royal-slate-blue/60" />`
    };

    return `
      <fieldset class="glass-card rounded-2xl p-5" data-question="${q.id}">
        <legend class="sr-only">Question ${index + 1}</legend>
        <div class="flex items-start gap-2.5 mb-3">
          <span class="w-6 h-6 rounded-lg bg-white/10 flex items-center justify-center text-[11px] font-bold shrink-0">${index + 1}</span>
          <p class="flex-1 text-sm font-semibold text-white">${escapeHtml(q.prompt)}</p>
          <span class="text-[10px] text-outline shrink-0">${q.points} pt${q.points === 1 ? '' : 's'}</span>
        </div>
        ${
          q.code_snippet
            ? `<pre class="bg-black/40 border border-white/10 rounded-xl p-3.5 mb-3 overflow-x-auto"><code class="text-xs font-mono text-ice-blue whitespace-pre">${escapeHtml(q.code_snippet)}</code></pre>`
            : ''
        }
        <div class="space-y-2">${(inputs[q.question_type] || inputs.MCQ)()}</div>
        ${
          q.hint
            ? `<button type="button" class="hint-btn mt-3 text-[11px] font-semibold text-outline hover:text-white transition-colors" data-hint="${escapeHtml(q.hint)}">
                Need a hint?
              </button>
              <p class="hint-text hidden mt-2 text-[11px] text-amber-300/90 italic"></p>`
            : ''
        }
      </fieldset>`;
  }

  function bindHints() {
    root.querySelectorAll('.hint-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const target = btn.parentElement.querySelector('.hint-text');
        if (!target) return;
        target.textContent = btn.dataset.hint;
        target.classList.remove('hidden');
        btn.classList.add('hidden');
      });
    });
  }

  function collectAnswers(questions) {
    const answers = {};
    for (const q of questions) {
      const nodes = root.querySelectorAll(`[name="q_${q.id}"]`);
      if (q.question_type === 'MULTI') {
        answers[q.id] = [...nodes].filter((n) => n.checked).map((n) => n.value);
      } else if (['MCQ', 'TRUE_FALSE'].includes(q.question_type)) {
        const picked = [...nodes].find((n) => n.checked);
        answers[q.id] = picked ? picked.value : '';
      } else {
        answers[q.id] = nodes[0] ? nodes[0].value.trim() : '';
      }
    }
    return answers;
  }

  function showResult(quiz, result) {
    const tone = result.passed ? 'emerald' : 'amber';
    root.innerHTML = `
      <section class="glass-card rounded-2xl p-6 text-center mb-4 border-${tone}-500/30">
        <span class="material-symbols-outlined text-5xl text-${tone}-400" aria-hidden="true">
          ${result.passed ? 'workspace_premium' : 'refresh'}
        </span>
        <h3 class="text-2xl font-black text-white mt-2">${result.percent}%</h3>
        <p class="text-sm text-${tone}-300 font-semibold">${result.passed ? 'Passed' : 'Not quite — try again'}</p>
        <p class="text-xs text-outline mt-1">${result.score} of ${result.max_score} points</p>
        ${
          result.progression && !result.already_passed
            ? `<p class="text-xs text-emerald-400 font-bold mt-2">+${result.progression.awarded} XP earned</p>`
            : result.already_passed
              ? `<p class="text-[11px] text-outline mt-2">Already passed before — no additional XP.</p>`
              : ''
        }
        <div class="flex gap-2 justify-center mt-4">
          <button id="btnRetake" class="btn btn--ghost">Retake</button>
          <button id="btnBackToQuizzes" class="btn btn--primary">All quizzes</button>
        </div>
      </section>

      <h3 class="eyebrow mb-2">Review</h3>
      <div class="space-y-2.5">
        ${result.results
          .map(
            (r, i) => `
          <article class="glass-card rounded-2xl p-4 ${r.correct ? 'border-emerald-500/25' : 'border-red-500/25'}">
            <div class="flex items-start gap-2.5">
              <span class="material-symbols-outlined text-base ${r.correct ? 'text-emerald-400' : 'text-red-400'} shrink-0" aria-hidden="true">
                ${r.correct ? 'check_circle' : 'cancel'}
              </span>
              <div class="flex-1 min-w-0">
                <p class="text-xs font-semibold text-white">${i + 1}. ${escapeHtml(r.prompt)}</p>
                ${
                  !r.correct
                    ? `<p class="text-[11px] text-red-300/90 mt-1">Your answer: ${escapeHtml(formatAnswer(r.submitted)) || '<em>blank</em>'}</p>
                       <p class="text-[11px] text-emerald-300/90">Correct: ${escapeHtml(formatAnswer(r.correct_answer))}</p>`
                    : ''
                }
                ${r.explanation ? `<p class="text-[11px] text-outline mt-1.5 leading-relaxed">${escapeHtml(r.explanation)}</p>` : ''}
              </div>
            </div>
          </article>`
          )
          .join('')}
      </div>`;

    document.getElementById('btnBackToQuizzes').addEventListener('click', showList);
    document.getElementById('btnRetake').addEventListener('click', () => showQuiz(quiz.id));

    showToast({
      title: result.passed ? 'Quiz passed' : 'Keep going',
      message: `${result.percent}% — ${result.score}/${result.max_score} points`,
      type: result.passed ? 'success' : 'info'
    });
  }

  function formatAnswer(value) {
    if (Array.isArray(value)) return value.join(', ');
    return String(value ?? '');
  }

  const linked = currentParam();
  if (linked) showQuiz(linked);
  else showList();
}
