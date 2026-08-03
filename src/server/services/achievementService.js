import { db } from '../db/database.js';
import { BadgeModel, AchievementModel } from '../models/Badge.js';
import { XpModel } from '../models/Xp.js';
import { StreakModel } from '../models/Streak.js';

/**
 * Declarative achievement criteria. Each evaluator returns the user's CURRENT
 * progress as a number, which is compared against `criteria_value`.
 *
 * Every evaluator reads from durable history (activity_log, xp_history,
 * task_submissions) rather than counting forward from "now" — so an
 * achievement added today is immediately earned by users who already met it.
 */
export const CRITERIA_EVALUATORS = {
  TASKS_COMPLETED: (userId) =>
    db
      .prepare(
        `SELECT COUNT(*) AS n FROM task_submissions WHERE submitted_by = ? AND status = 'APPROVED'`
      )
      .get(userId).n,

  SUBMISSIONS_MADE: (userId) =>
    db.prepare(`SELECT COUNT(*) AS n FROM task_submissions WHERE submitted_by = ?`).get(userId).n,

  XP_EARNED: (userId) => XpModel.totalFor(userId),

  STREAK_DAYS: (userId) => {
    const streak = StreakModel.getByUser(userId);
    return streak ? streak.longest_streak || 0 : 0;
  },

  MESSAGES_SENT: (userId) =>
    db.prepare(`SELECT COUNT(*) AS n FROM messages WHERE user_id = ?`).get(userId).n,

  FORUM_POSTS: (userId) =>
    db.prepare(`SELECT COUNT(*) AS n FROM forum_posts WHERE author_id = ?`).get(userId).n,

  UPVOTES_RECEIVED: (userId) =>
    db
      .prepare(
        `SELECT COALESCE(SUM(v.vote_value), 0) AS n
         FROM votes v
         LEFT JOIN forum_threads t ON v.target_type = 'FORUM_THREAD' AND t.id = v.target_id
         LEFT JOIN forum_posts p ON v.target_type = 'FORUM_POST' AND p.id = v.target_id
         WHERE v.vote_value = 1 AND (t.author_id = ? OR p.author_id = ?)`
      )
      .get(userId, userId).n,

  TEAMS_JOINED: (userId) =>
    db.prepare(`SELECT COUNT(*) AS n FROM team_memberships WHERE user_id = ?`).get(userId).n,

  ACTIVITY_EVENTS: (userId) =>
    db.prepare(`SELECT COUNT(*) AS n FROM activity_log WHERE user_id = ?`).get(userId).n
};

export const AchievementService = {
  /**
   * Evaluate every achievement for a user and grant any newly met ones.
   * Callers MUST run this inside an existing transaction when it accompanies
   * another award, so XP and badges commit together.
   *
   * @returns {Array} newly unlocked achievements
   */
  evaluateForUser(userId) {
    if (!userId) return [];
    const unlocked = [];

    for (const achievement of AchievementModel.list()) {
      const evaluate = CRITERIA_EVALUATORS[achievement.criteria_type];
      if (!evaluate) continue;

      let progress = 0;
      try {
        progress = Number(evaluate(userId)) || 0;
      } catch (_) {
        continue; // A table for an unbuilt feature — skip rather than fail the award.
      }
      if (progress < (achievement.criteria_value || 1)) continue;

      // The badge grant is the idempotency key: if it was already held, the
      // achievement was already unlocked and must not pay out again.
      let isNew = true;
      if (achievement.badge_id) {
        isNew = BadgeModel.awardToUser(userId, achievement.badge_id);
      } else {
        isNew = !XpModel.hasAward(userId, 'ACHIEVEMENT', achievement.id);
      }
      if (!isNew) continue;

      if (achievement.xp_reward > 0) {
        XpModel.award({
          userId,
          amount: achievement.xp_reward,
          sourceType: 'ACHIEVEMENT',
          sourceId: achievement.id,
          description: `Achievement unlocked: ${achievement.title}`
        });
      }

      const badge = achievement.badge_id ? BadgeModel.getById(achievement.badge_id) : null;
      unlocked.push({ ...achievement, badge });
    }

    return unlocked;
  },

  progressFor(userId) {
    return AchievementModel.list().map((achievement) => {
      const evaluate = CRITERIA_EVALUATORS[achievement.criteria_type];
      let progress = 0;
      try {
        progress = evaluate ? Number(evaluate(userId)) || 0 : 0;
      } catch (_) {
        progress = 0;
      }
      const target = achievement.criteria_value || 1;
      return {
        ...achievement,
        badge: achievement.badge_id ? BadgeModel.getById(achievement.badge_id) : null,
        progress: Math.min(progress, target),
        target,
        unlocked: progress >= target
      };
    });
  }
};
