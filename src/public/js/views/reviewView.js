// Review queue: score submissions against a rubric and talk to the submitter.
import {
  fetchReviewQueue, fetchReviewDetail, submitReview, addReviewComment
} from '../services/api.js';
import { showToast } from '../components/toast.js';
import { renderSkeleton } from '../components/spinner.js';
import { pushHash, currentParam } from '../router/hashRouter.js';
import { escapeHtml, timeAgo } from '../utils/dom.js';

const REVIEWER_ROLES = ['leader', 'teacher', 'admin', 'DEV_STEALTH', 'STUDENT_LEADER', 'TEACHER'];

export function renderReviewView(state) {
  const user = state.currentUser;
  if (!user) {
    return `<div class="empty"><p class="empty__text">Sign in to review submissions.</p></div>`;
  }
  if (!REVIEWER_ROLES.includes(user.role)) {
    return `
      <div class="empty">
        <p class="empty__title">Reviewers only</p>
        <p class="empty__text">Reviewing submissions is limited to leaders, teachers, and admins.</p>
      </div>`;
  }

  return `
    <div class="page__inner">
      <header class="page__head">
        <div>
          <h1 class="title">Review</h1>
          <p class="subtitle">Score work against its rubric and send feedback the submitter can act on.</p>
        </div>
      </header>
      <div id="reviewRoot">${renderSkeleton('card', { className: '' })}</div>
    </div>`;
}

export function attachReviewEvents(state) {
  const user = state.currentUser;
  if (!user || !REVIEWER_ROLES.includes(user.role)) return;
  const root = document.getElementById('reviewRoot');

  async function showQueue() {
    pushHash('review');
    try {
      const { submissions } = await fetchReviewQueue();
      if (!submissions.length) {
        root.innerHTML = `
          <div class="empty">
            <p class="empty__title">Nothing waiting</p>
            <p class="empty__text">Every submission has been reviewed. New work will appear here as it arrives.</p>
          </div>`;
        return;
      }

      root.innerHTML = `
        <p class="eyebrow" style="margin-bottom:var(--sp-3)">${submissions.length} awaiting review · oldest first</p>
        <div class="list">
          ${submissions.map(rowHtml).join('')}
        </div>`;

      root.querySelectorAll('[data-review-open]').forEach((el) => {
        el.addEventListener('click', () => showDetail(el.dataset.reviewOpen));
      });
    } catch (_) {
      root.innerHTML = `<div class="empty"><p class="empty__text">Unable to load the review queue.</p></div>`;
    }
  }

  function rowHtml(s) {
    const waiting = timeAgo(s.created_at);
    const isRework = String(s.status).toUpperCase() === 'CHANGES_REQUESTED';
    return `
      <button class="list__row" data-review-open="${s.id}" style="width:100%;text-align:left;border-width:0 0 1px 0;background:none;cursor:pointer">
        <span class="col col--tight" style="flex:1;min-width:0">
          <span class="row row--tight">
            <strong class="truncate">${escapeHtml(s.task_title)}</strong>
            ${isRework ? '<span class="chip chip--warning chip--upper">Resubmitted</span>' : ''}
          </span>
          <span class="text-faint" style="font-size:.8125rem">
            ${escapeHtml(s.submitter_name || 'Unknown')} · submitted ${waiting}
            ${s.comment_count > 0 ? ` · ${s.comment_count} comment${s.comment_count === 1 ? '' : 's'}` : ''}
          </span>
        </span>
        <span class="btn btn--sm btn--ghost" aria-hidden="true">Review</span>
      </button>`;
  }

  async function showDetail(submissionId) {
    pushHash('review', submissionId);
    try {
      const data = await fetchReviewDetail(submissionId);
      const { submission, rubric, scores, comments, result } = data;

      // Pre-fill with this reviewer's existing scores so revisiting a review
      // shows what they already recorded rather than an empty form.
      const mine = Object.fromEntries(
        scores.filter((s) => s.reviewer_id === user.id).map((s) => [s.criterion_id, s.score])
      );

      root.innerHTML = `
        <button class="btn btn--subtle btn--sm" id="btnBackToQueue" style="margin-bottom:var(--sp-4)">
          <span class="material-symbols-outlined" style="font-size:18px" aria-hidden="true">arrow_back</span> Queue
        </button>

        <section style="margin-bottom:var(--sp-6)">
          <h2>${escapeHtml(submission.task_title)}</h2>
          <p class="text-faint" style="font-size:.875rem;margin-top:var(--sp-1)">
            ${escapeHtml(submission.submitter_name || 'Unknown')} · ${timeAgo(submission.created_at)}
            ${result.scored > 0 ? ` · currently ${result.percent}%` : ''}
          </p>
          ${
            submission.proof_notes
              ? `<div class="panel" style="margin-top:var(--sp-4)">
                  <span class="eyebrow" style="margin-bottom:var(--sp-2)">Submitted work</span>
                  <p style="white-space:pre-wrap;word-break:break-word">${escapeHtml(submission.proof_notes)}</p>
                  ${submission.proof_url ? `<p style="margin-top:var(--sp-2)"><button type="button" class="linklike" data-attachment="${escapeHtml(submission.proof_url)}">Open attachment</button></p>` : ''}
                </div>`
              : ''
          }
        </section>

        <form id="reviewForm">
          ${
            rubric.length
              ? `<section style="margin-bottom:var(--sp-6)">
                  <span class="eyebrow" style="margin-bottom:var(--sp-3)">Rubric</span>
                  <div class="col">${rubric.map((c) => criterionHtml(c, mine[c.id])).join('')}</div>
                </section>`
              : `<p class="text-faint" style="margin-bottom:var(--sp-5);font-size:.875rem">
                  This task has no rubric, so approval is a straight judgement call.
                </p>`
          }

          <div class="field" style="margin-bottom:var(--sp-5)">
            <label class="field__label" for="reviewComment">Feedback</label>
            <textarea class="textarea" id="reviewComment" maxlength="4000"
              placeholder="What was strong, and what would you change?"></textarea>
          </div>

          <div class="row row--wrap">
            <button type="submit" class="btn btn--primary" data-verdict="approve">Approve</button>
            <button type="button" class="btn" id="btnRequestChanges">Request changes</button>
          </div>
        </form>

        ${commentsHtml(comments)}`;

      document.getElementById('btnBackToQueue').addEventListener('click', showQueue);

      const form = document.getElementById('reviewForm');
      const send = async (verdict) => {
        const scoreEntries = rubric
          .map((c) => {
            const el = document.getElementById(`score_${c.id}`);
            const value = el ? Number(el.value) : NaN;
            return Number.isFinite(value) && el.value !== '' ? { criterion_id: c.id, score: value } : null;
          })
          .filter(Boolean);

        try {
          const res = await submitReview(submissionId, {
            verdict,
            comment: document.getElementById('reviewComment').value.trim() || null,
            scores: scoreEntries
          });
          showToast({
            title: verdict === 'approve' ? 'Approved' : 'Changes requested',
            message: `Scored ${res.result.percent}%`,
            type: verdict === 'approve' ? 'success' : 'info'
          });
          showQueue();
        } catch (_) {
          /* requestApi surfaces the reason */
        }
      };

      form.addEventListener('submit', (e) => {
        e.preventDefault();
        send('approve');
      });
      document.getElementById('btnRequestChanges').addEventListener('click', () => send('request_changes'));

      const commentForm = document.getElementById('threadForm');
      if (commentForm) {
        commentForm.addEventListener('submit', async (e) => {
          e.preventDefault();
          const input = document.getElementById('threadInput');
          const body = input.value.trim();
          if (!body) return;
          try {
            await addReviewComment(submissionId, body);
            showDetail(submissionId);
          } catch (_) {}
        });
      }
    } catch (_) {
      root.innerHTML = `<div class="empty"><p class="empty__text">Unable to open this submission.</p></div>`;
    }
  }

  function criterionHtml(c, existing) {
    return `
      <div class="panel">
        <div class="row" style="align-items:flex-start">
          <div style="flex:1;min-width:0">
            <strong>${escapeHtml(c.label)}</strong>
            ${c.description ? `<p class="text-faint" style="font-size:.8125rem">${escapeHtml(c.description)}</p>` : ''}
            <p class="text-faint" style="font-size:.75rem;margin-top:var(--sp-1)">
              Weight ${c.weight}× · max ${c.max_score}
            </p>
          </div>
          <input class="input num" id="score_${c.id}" type="number" min="0" max="${c.max_score}"
            value="${existing !== undefined ? existing : ''}" placeholder="—"
            style="width:84px;text-align:center" aria-label="Score for ${escapeHtml(c.label)}" />
        </div>
      </div>`;
  }

  function commentsHtml(comments) {
    return `
      <section style="margin-top:var(--sp-8)">
        <span class="eyebrow" style="margin-bottom:var(--sp-3)">Discussion</span>
        ${
          comments.length
            ? `<div class="list">${comments.map((c) => `
                <div class="list__row" style="align-items:flex-start">
                  <span class="avatar avatar--sm">${escapeHtml(initials(c.author_name))}</span>
                  <span class="col col--tight" style="flex:1;min-width:0">
                    <span class="row row--tight">
                      <strong style="font-size:.875rem">${escapeHtml(c.author_name || 'Unknown')}</strong>
                      <span class="text-faint" style="font-size:.75rem">${timeAgo(c.created_at)}</span>
                    </span>
                    <span style="white-space:pre-wrap;word-break:break-word">${escapeHtml(c.body)}</span>
                  </span>
                </div>`).join('')}</div>`
            : '<p class="text-faint" style="font-size:.875rem">No discussion yet.</p>'
        }
        <form class="row" id="threadForm" style="margin-top:var(--sp-4)">
          <input class="input" id="threadInput" maxlength="4000" placeholder="Add a comment…" />
          <button type="submit" class="btn">Send</button>
        </form>
      </section>`;
  }

  function initials(name) {
    return String(name || '?').split(/\s+/).slice(0, 2).map((p) => p[0] || '').join('').toUpperCase();
  }

  const linked = currentParam();
  if (linked) showDetail(linked);
  else showQueue();
}
