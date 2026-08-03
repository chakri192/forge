import { db } from '../db/database.js';
import { XpModel, levelFromXp } from '../models/Xp.js';
import { StreakModel } from '../models/Streak.js';
import { BadgeModel } from '../models/Badge.js';
import { AchievementService } from './achievementService.js';
import { NotificationService } from './notification.js';
import { publish } from './sse.js';

/**
 * All progression side effects for one earning event, committed atomically.
 *
 * better-sqlite3 transactions are synchronous, so everything inside the
 * callback must stay synchronous. Notifications and SSE fan-out happen AFTER
 * the commit — pushing them inside would announce rewards that a later
 * rollback erased.
 */
const awardTx = db.transaction(({ userId, amount, sourceType, sourceId, description, today }) => {
  if (amount > 0) {
    XpModel.award({ userId, amount, sourceType, sourceId, description });
  }
  const streak = StreakModel.recordActivity(userId, today);
  const unlocked = AchievementService.evaluateForUser(userId);

  // Badges can carry their own XP bonus; credit it in the same transaction.
  for (const achievement of unlocked) {
    if (achievement.badge && achievement.badge.xp_bonus > 0) {
      XpModel.award({
        userId,
        amount: achievement.badge.xp_bonus,
        sourceType: 'BADGE_BONUS',
        sourceId: achievement.badge.id,
        description: `Badge bonus: ${achievement.badge.name}`
      });
    }
  }

  return { streak, unlocked, total: XpModel.totalFor(userId) };
});

export const ProgressionService = {
  /**
   * Credit XP for an event and roll everything that depends on it.
   * `sourceId` makes the award idempotent — re-approving the same submission
   * will not pay twice.
   */
  award({ userId, amount = 0, sourceType, sourceId = null, description = null, today }) {
    if (!userId || !sourceType) {
      throw { status: 400, message: 'userId and sourceType are required' };
    }
    if (sourceId && XpModel.hasAward(userId, sourceType, sourceId)) {
      return { skipped: true, ...this.summaryFor(userId) };
    }

    const before = levelFromXp(XpModel.totalFor(userId));
    const result = awardTx({ userId, amount, sourceType, sourceId, description, today });
    const after = levelFromXp(result.total);

    // Post-commit announcements.
    if (amount > 0) {
      publish(userId, {
        type: 'xp',
        amount,
        total: result.total,
        level: after.level,
        streak: result.streak.current_streak
      });
    }

    if (after.level > before.level) {
      NotificationService.createNotification({
        userId,
        title: `Level ${after.level} reached`,
        message: `You have earned ${result.total} XP in total. Keep going!`,
        type: 'INFO',
        link: '#profile'
      });
    }

    for (const achievement of result.unlocked) {
      NotificationService.createNotification({
        userId,
        title: `Achievement unlocked: ${achievement.title}`,
        message: achievement.description,
        type: 'INFO',
        link: '#profile'
      });
    }

    return {
      skipped: false,
      awarded: amount,
      total: result.total,
      level: after,
      leveledUp: after.level > before.level,
      streak: result.streak,
      unlocked: result.unlocked
    };
  },

  /** Everything the profile and dashboard need in one read. */
  summaryFor(userId) {
    const total = XpModel.totalFor(userId);
    const streak = StreakModel.currentFor(userId);
    return {
      ...levelFromXp(total),
      streak: {
        current: streak.current_streak || 0,
        longest: streak.longest_streak || 0,
        lastActivity: streak.last_activity_date || null
      },
      badges: BadgeModel.listForUser(userId),
      recentXp: XpModel.historyFor(userId, { limit: 20 }),
      contributions: XpModel.dailyTotals(userId, 90)
    };
  },

  /**
   * Rebuild streaks from activity_log. Used to seed the feature over existing
   * history so long-standing members are not reset to zero on launch.
   */
  backfillStreaks() {
    const rows = db
      .prepare(
        `SELECT user_id, date(created_at) AS day
         FROM activity_log
         WHERE user_id IS NOT NULL
         GROUP BY user_id, day
         ORDER BY user_id, day ASC`
      )
      .all();

    const run = db.transaction(() => {
      const seen = new Set();
      for (const row of rows) {
        if (!seen.has(row.user_id)) {
          db.prepare(`DELETE FROM streaks WHERE user_id = ?`).run(row.user_id);
          seen.add(row.user_id);
        }
        StreakModel.recordActivity(row.user_id, row.day);
      }
      return seen.size;
    });

    return run();
  }
};
