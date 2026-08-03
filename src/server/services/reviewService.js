import { db } from '../db/database.js';
import { RubricModel, ReviewModel } from '../models/Review.js';
import { TaskModel } from '../models/Task.js';
import { hasRole } from '../middleware/rbac.js';
import { TaskService } from './taskService.js';
import { NotificationService } from './notification.js';
import { ActivityService } from './activity.js';

const REVIEWER_ROLES = ['leader', 'teacher', 'admin'];

function canReview(user) {
  return hasRole(user, REVIEWER_ROLES);
}

/**
 * Scores, the verdict, and the resulting status move together. A partial
 * write here would leave a submission marked approved with no rubric behind
 * it, which is exactly the state a teacher cannot recover from by hand.
 */
const recordReviewTx = db.transaction(({ submission, reviewer, scores, verdict, comment }) => {
  for (const entry of scores) {
    ReviewModel.score({
      submissionId: submission.id,
      criterionId: entry.criterion_id,
      reviewerId: reviewer.id,
      score: entry.score,
      note: entry.note ?? null
    });
  }

  if (comment) {
    ReviewModel.comment({
      submissionId: submission.id,
      authorId: reviewer.id,
      body: comment,
      isResolution: true
    });
  }

  const status = verdict === 'approve' ? 'APPROVED' : 'CHANGES_REQUESTED';
  ReviewModel.setStatus(submission.id, status, reviewer.id);

  return { status, result: ReviewModel.weightedResult(submission.id) };
});

export const ReviewService = {
  defineRubric(user, taskId, criteria) {
    if (!canReview(user)) throw { status: 403, message: 'Only leaders and above can define a rubric' };
    const task = TaskModel.getById(taskId);
    if (!task) throw { status: 404, message: 'Task not found' };
    if (!Array.isArray(criteria) || !criteria.length) {
      throw { status: 400, message: 'At least one criterion is required' };
    }

    const write = db.transaction(() => {
      for (const c of criteria) {
        if (!c.label) throw { status: 400, message: 'Every criterion needs a label' };
        RubricModel.add(taskId, {
          label: c.label,
          description: c.description ?? null,
          maxScore: c.max_score ?? 5,
          weight: c.weight ?? 1.0
        });
      }
    });
    write();
    return RubricModel.forTask(taskId);
  },

  rubricFor(taskId) {
    return RubricModel.forTask(taskId);
  },

  removeCriterion(user, criterionId) {
    if (!canReview(user)) throw { status: 403, message: 'Only leaders and above can edit a rubric' };
    if (!RubricModel.remove(criterionId)) throw { status: 404, message: 'Criterion not found' };
    return { success: true, id: criterionId };
  },

  /** Full review detail: submission, rubric, scores so far, and the thread. */
  detail(user, submissionId) {
    const submission = ReviewModel.submissionById(submissionId);
    if (!submission) throw { status: 404, message: 'Submission not found' };
    // The submitter can read their own feedback; otherwise reviewers only.
    if (submission.submitted_by !== user.id && !canReview(user)) {
      throw { status: 403, message: 'Not allowed to view this review' };
    }
    return {
      submission,
      rubric: RubricModel.forTask(submission.task_id),
      scores: ReviewModel.scoresFor(submissionId),
      comments: ReviewModel.commentsFor(submissionId),
      result: ReviewModel.weightedResult(submissionId)
    };
  },

  queue(user) {
    if (!canReview(user)) throw { status: 403, message: 'Only leaders and above can see the review queue' };
    return ReviewModel.queue();
  },

  /**
   * Record a review. Approving delegates completion to TaskService so XP,
   * streaks, and achievements run through the existing progression path —
   * including its idempotency — rather than being reimplemented here.
   */
  submitReview(user, submissionId, { scores = [], verdict, comment = null }) {
    if (!canReview(user)) throw { status: 403, message: 'Only leaders and above can review submissions' };
    if (!['approve', 'request_changes'].includes(verdict)) {
      throw { status: 400, message: "verdict must be 'approve' or 'request_changes'" };
    }

    const submission = ReviewModel.submissionById(submissionId);
    if (!submission) throw { status: 404, message: 'Submission not found' };
    if (String(submission.status).toUpperCase() === 'APPROVED') {
      throw { status: 409, message: 'This submission has already been approved' };
    }

    const rubric = RubricModel.forTask(submission.task_id);
    const validIds = new Set(rubric.map((c) => c.id));
    for (const entry of scores) {
      const criterion = rubric.find((c) => c.id === entry.criterion_id);
      if (!validIds.has(entry.criterion_id)) {
        throw { status: 400, message: 'Score refers to a criterion from another task' };
      }
      if (entry.score < 0 || entry.score > criterion.max_score) {
        throw { status: 400, message: `Score for "${criterion.label}" must be between 0 and ${criterion.max_score}` };
      }
    }
    // Approving on a rubric nobody scored produces a meaningless record.
    if (verdict === 'approve' && rubric.length > 0 && scores.length < rubric.length) {
      throw { status: 400, message: 'Score every criterion before approving' };
    }

    const { status, result } = recordReviewTx({ submission, reviewer: user, scores, verdict, comment });

    let completion = null;
    if (verdict === 'approve') {
      completion = TaskService.completeTask(submission.task_id, user, submissionId);
    } else {
      // Send the task back so the submitter can act on the feedback.
      try {
        TaskService.updateTaskStatus(submission.task_id, 'in_progress', user);
      } catch (_) {
        /* the task may already be in progress; the review still stands */
      }
    }

    if (submission.submitted_by && submission.submitted_by !== user.id) {
      NotificationService.createNotification({
        userId: submission.submitted_by,
        title: verdict === 'approve' ? 'Your submission was approved' : 'Changes requested on your submission',
        message: `${submission.task_title} — scored ${result.percent}%`,
        type: 'REVIEW',
        link: '#/tasks'
      });
    }

    ActivityService.logActivity({
      userId: user.id,
      action: verdict === 'approve' ? 'REVIEW_APPROVE' : 'REVIEW_CHANGES',
      entityType: 'SUBMISSION',
      entityId: submissionId,
      details: { description: `${user.name} reviewed "${submission.task_title}" (${result.percent}%)` }
    });

    return { submissionId, status, result, completion };
  },

  /** Threaded discussion — open to the submitter and any reviewer. */
  addComment(user, submissionId, body) {
    const submission = ReviewModel.submissionById(submissionId);
    if (!submission) throw { status: 404, message: 'Submission not found' };
    if (submission.submitted_by !== user.id && !canReview(user)) {
      throw { status: 403, message: 'Not allowed to comment on this review' };
    }

    const comment = ReviewModel.comment({ submissionId, authorId: user.id, body });

    // Notify the other side of the conversation.
    const recipient = submission.submitted_by === user.id ? submission.reviewed_by : submission.submitted_by;
    if (recipient && recipient !== user.id) {
      NotificationService.createNotification({
        userId: recipient,
        title: `${user.name} commented on a submission`,
        message: body.slice(0, 120),
        type: 'REVIEW',
        link: '#/tasks'
      });
    }
    return comment;
  }
};
