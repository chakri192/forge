import { db } from '../db/database.js';
import { genId } from '../utils/genId.js';

/** XP ledger. Every award is an immutable row; totals are always derived. */
export const XpModel = {
  award({ userId, amount, sourceType, sourceId = null, description = null }) {
    const id = genId('xp');
    db.prepare(`
      INSERT INTO xp_history (id, user_id, amount, source_type, source_id, description, created_at)
      VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `).run(id, userId, amount, sourceType, sourceId, description);
    return id;
  },

  /** Guards against double-awarding for the same source event. */
  hasAward(userId, sourceType, sourceId) {
    if (!sourceId) return false;
    const row = db
      .prepare(
        `SELECT 1 FROM xp_history WHERE user_id = ? AND source_type = ? AND source_id = ? LIMIT 1`
      )
      .get(userId, sourceType, sourceId);
    return Boolean(row);
  },

  totalFor(userId) {
    const row = db
      .prepare(`SELECT COALESCE(SUM(amount), 0) AS total FROM xp_history WHERE user_id = ?`)
      .get(userId);
    return row ? row.total : 0;
  },

  historyFor(userId, { limit = 50 } = {}) {
    return db
      .prepare(
        `SELECT * FROM xp_history WHERE user_id = ? ORDER BY created_at DESC, id DESC LIMIT ?`
      )
      .all(userId, Math.max(1, Math.min(limit, 200)));
  },

  /** Daily totals for a contribution-graph style view. */
  dailyTotals(userId, days = 90) {
    return db
      .prepare(
        `SELECT date(created_at) AS day, SUM(amount) AS total
         FROM xp_history
         WHERE user_id = ? AND created_at >= date('now', ?)
         GROUP BY day
         ORDER BY day ASC`
      )
      .all(userId, `-${Math.max(1, days)} days`);
  },

  totalsForAll() {
    return db
      .prepare(
        `SELECT user_id, COALESCE(SUM(amount), 0) AS total FROM xp_history GROUP BY user_id`
      )
      .all();
  }
};

const XP_PER_LEVEL_BASE = 100;

/**
 * Levels follow a square-root curve so early levels come quickly and later
 * ones stretch out. Derived on read — never stored, so the curve can change
 * without a migration.
 */
export function levelFromXp(xp) {
  const total = Math.max(0, Number(xp) || 0);
  const level = Math.floor(Math.sqrt(total / XP_PER_LEVEL_BASE)) + 1;
  const currentLevelFloor = XP_PER_LEVEL_BASE * (level - 1) ** 2;
  const nextLevelFloor = XP_PER_LEVEL_BASE * level ** 2;
  const span = nextLevelFloor - currentLevelFloor;
  return {
    level,
    xp: total,
    xpIntoLevel: total - currentLevelFloor,
    xpForNextLevel: nextLevelFloor - total,
    levelSpan: span,
    progress: span > 0 ? Math.min(1, (total - currentLevelFloor) / span) : 0
  };
}
