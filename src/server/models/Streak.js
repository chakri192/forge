import { db } from '../db/database.js';
import { genId } from '../utils/genId.js';

/** Whole days between two YYYY-MM-DD strings. */
function dayDiff(fromDate, toDate) {
  const from = Date.parse(`${fromDate}T00:00:00Z`);
  const to = Date.parse(`${toDate}T00:00:00Z`);
  if (Number.isNaN(from) || Number.isNaN(to)) return null;
  return Math.round((to - from) / 86400000);
}

export const StreakModel = {
  getByUser(userId) {
    return db.prepare(`SELECT * FROM streaks WHERE user_id = ?`).get(userId) ?? null;
  },

  ensure(userId) {
    const existing = this.getByUser(userId);
    if (existing) return existing;
    db.prepare(`
      INSERT INTO streaks (id, user_id, current_streak, longest_streak, last_activity_date, updated_at)
      VALUES (?, ?, 0, 0, NULL, CURRENT_TIMESTAMP)
    `).run(genId('stk'), userId);
    return this.getByUser(userId);
  },

  /**
   * Roll the streak forward for a day of activity.
   * Same day is a no-op, the next day increments, any larger gap resets to 1.
   * `today` is injectable so tests can cross date boundaries deterministically.
   */
  recordActivity(userId, today = new Date().toISOString().slice(0, 10)) {
    const streak = this.ensure(userId);
    const last = streak.last_activity_date;

    let current;
    if (!last) {
      current = 1;
    } else {
      const gap = dayDiff(last, today);
      if (gap === null) current = 1;
      else if (gap <= 0) return { ...streak, changed: false };
      else if (gap === 1) current = (streak.current_streak || 0) + 1;
      else current = 1;
    }

    const longest = Math.max(current, streak.longest_streak || 0);
    db.prepare(`
      UPDATE streaks
      SET current_streak = ?, longest_streak = ?, last_activity_date = ?, updated_at = CURRENT_TIMESTAMP
      WHERE user_id = ?
    `).run(current, longest, today, userId);

    return { ...this.getByUser(userId), changed: true };
  },

  /**
   * A stored streak goes stale once its last activity is more than a day old;
   * report 0 rather than a number the user hasn't actually earned today.
   */
  currentFor(userId, today = new Date().toISOString().slice(0, 10)) {
    const streak = this.getByUser(userId);
    if (!streak || !streak.last_activity_date) {
      return { current_streak: 0, longest_streak: streak ? streak.longest_streak : 0, last_activity_date: null };
    }
    const gap = dayDiff(streak.last_activity_date, today);
    const current = gap !== null && gap > 1 ? 0 : streak.current_streak;
    return { ...streak, current_streak: current };
  }
};
