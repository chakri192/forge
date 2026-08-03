import { db } from '../db/database.js';
import { genId } from '../utils/genId.js';

/**
 * The points wallet. Every movement is a signed row; the balance is always
 * derived. Nothing writes a running total, so a crash between two statements
 * cannot leave a purchase without its debit.
 */
export const WalletModel = {
  balanceFor(userId) {
    const row = db
      .prepare(`SELECT COALESCE(SUM(amount), 0) AS balance FROM point_transactions WHERE user_id = ?`)
      .get(userId);
    return row?.balance ?? 0;
  },

  /** Lifetime earned, ignoring anything spent. */
  earnedFor(userId) {
    const row = db
      .prepare(
        `SELECT COALESCE(SUM(amount), 0) AS earned
         FROM point_transactions WHERE user_id = ? AND amount > 0`
      )
      .get(userId);
    return row?.earned ?? 0;
  },

  /** True when this user has already been credited for this exact source. */
  hasEarned(userId, sourceType, sourceId) {
    const row = db
      .prepare(
        `SELECT 1 FROM point_transactions
         WHERE user_id = ? AND source_type = ? AND source_id = ? AND amount > 0
         LIMIT 1`
      )
      .get(userId, sourceType, sourceId);
    return Boolean(row);
  },

  record({ userId, amount, reason, sourceType = null, sourceId = null }) {
    const id = genId('ptx');
    db.prepare(
      `INSERT INTO point_transactions (id, user_id, amount, reason, source_type, source_id, created_at)
       VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`
    ).run(id, userId, amount, reason, sourceType, sourceId);
    return { id, amount, reason };
  },

  historyFor(userId, limit = 30) {
    return db
      .prepare(
        `SELECT amount, reason, created_at FROM point_transactions
         WHERE user_id = ? ORDER BY created_at DESC, rowid DESC LIMIT ?`
      )
      .all(userId, limit);
  }
};
