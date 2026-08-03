import { db } from '../db/database.js';
import { genId } from '../utils/genId.js';

export const VOTE_TARGETS = ['FORUM_THREAD', 'FORUM_POST', 'SUGGESTION'];

export const VoteModel = {
  /**
   * Casting a vote is an upsert with toggle semantics:
   *   same value again -> removes the vote
   *   opposite value   -> flips it
   * UNIQUE(user_id, target_type, target_id) enforces one vote per user.
   *
   * @returns {{ value: number, score: number }} the user's resulting vote and the new score
   */
  cast({ userId, targetType, targetId, value }) {
    const existing = db
      .prepare(
        `SELECT * FROM votes WHERE user_id = ? AND target_type = ? AND target_id = ?`
      )
      .get(userId, targetType, targetId);

    let resulting = value;
    if (existing && existing.vote_value === value) {
      db.prepare(`DELETE FROM votes WHERE id = ?`).run(existing.id);
      resulting = 0;
    } else if (existing) {
      db.prepare(`UPDATE votes SET vote_value = ?, created_at = CURRENT_TIMESTAMP WHERE id = ?`)
        .run(value, existing.id);
    } else {
      db.prepare(`
        INSERT INTO votes (id, user_id, target_type, target_id, vote_value, created_at)
        VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      `).run(genId('vot'), userId, targetType, targetId, value);
    }

    return { value: resulting, score: this.scoreFor(targetType, targetId) };
  },

  scoreFor(targetType, targetId) {
    const row = db
      .prepare(
        `SELECT COALESCE(SUM(vote_value), 0) AS score FROM votes WHERE target_type = ? AND target_id = ?`
      )
      .get(targetType, targetId);
    return row ? row.score : 0;
  },

  /** Scores for many targets at once — keeps list views to a single query. */
  scoresFor(targetType, targetIds) {
    if (!targetIds.length) return {};
    const placeholders = targetIds.map(() => '?').join(',');
    const rows = db
      .prepare(
        `SELECT target_id, COALESCE(SUM(vote_value), 0) AS score
         FROM votes WHERE target_type = ? AND target_id IN (${placeholders})
         GROUP BY target_id`
      )
      .all(targetType, ...targetIds);
    return Object.fromEntries(rows.map((r) => [r.target_id, r.score]));
  },

  /** What this user voted on each target, so the UI can show active state. */
  userVotesFor(userId, targetType, targetIds) {
    if (!targetIds.length || !userId) return {};
    const placeholders = targetIds.map(() => '?').join(',');
    const rows = db
      .prepare(
        `SELECT target_id, vote_value FROM votes
         WHERE user_id = ? AND target_type = ? AND target_id IN (${placeholders})`
      )
      .all(userId, targetType, ...targetIds);
    return Object.fromEntries(rows.map((r) => [r.target_id, r.vote_value]));
  }
};
