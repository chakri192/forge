import { db } from '../db/database.js';
import { genId } from '../utils/genId.js';

/** A curated list keeps topics readable; a custom one is still allowed. */
export const TOPICS = [
  'CSS layout',
  'JavaScript fundamentals',
  'Debugging',
  'Accessibility',
  'SQL and data modelling',
  'Git workflow',
  'Testing',
  'Performance'
];

export const DuelModel = {
  create({ challengerId, opponentIds, stakePoints, stakeXp }) {
    const id = genId('duel');
    db.prepare(
      `INSERT INTO duels (id, challenger_id, stake_points, stake_xp, status, created_at)
       VALUES (?, ?, ?, ?, 'PENDING', CURRENT_TIMESTAMP)`
    ).run(id, challengerId, stakePoints, stakeXp);

    const addParticipant = db.prepare(
      `INSERT INTO duel_participants (id, duel_id, user_id, side, accepted)
       VALUES (?, ?, ?, ?, ?)`
    );
    // The challenger is in from the moment they propose it.
    addParticipant.run(genId('dp'), id, challengerId, 'CHALLENGER', 1);
    for (const opponentId of opponentIds) {
      addParticipant.run(genId('dp'), id, opponentId, 'OPPONENT', 0);
    }
    return id;
  },

  byId(id) {
    return db.prepare(`SELECT * FROM duels WHERE id = ?`).get(id);
  },

  participants(duelId) {
    return db
      .prepare(
        `SELECT p.*, u.name, u.username, u.role
         FROM duel_participants p
         JOIN users u ON u.id = p.user_id
         WHERE p.duel_id = ?
         ORDER BY CASE p.side WHEN 'CHALLENGER' THEN 0 ELSE 1 END, u.name`
      )
      .all(duelId);
  },

  /** Every duel this user is part of, newest first. */
  forUser(userId, limit = 30) {
    return db
      .prepare(
        `SELECT d.* FROM duels d
         JOIN duel_participants p ON p.duel_id = d.id
         WHERE p.user_id = ?
         ORDER BY d.created_at DESC, d.rowid DESC
         LIMIT ?`
      )
      .all(userId, limit);
  },

  /** Active duels the viewer is not in, for whoever has to call them. */
  activeForJudge(limit = 30) {
    return db
      .prepare(`SELECT * FROM duels WHERE status = 'ACTIVE' ORDER BY created_at DESC LIMIT ?`)
      .all(limit);
  },

  setAccepted(duelId, userId, topicChoice) {
    db.prepare(
      `UPDATE duel_participants SET accepted = 1, topic_choice = ? WHERE duel_id = ? AND user_id = ?`
    ).run(topicChoice, duelId, userId);
  },

  markStaked(duelId, userId) {
    db.prepare(`UPDATE duel_participants SET staked = 1 WHERE duel_id = ? AND user_id = ?`)
      .run(duelId, userId);
  },

  setStatus(duelId, status, extra = {}) {
    db.prepare(
      `UPDATE duels
       SET status = ?,
           topic = COALESCE(?, topic),
           winner_id = COALESCE(?, winner_id),
           resolved_by = COALESCE(?, resolved_by),
           resolved_at = CASE WHEN ? IN ('RESOLVED','DECLINED','CANCELLED')
                              THEN CURRENT_TIMESTAMP ELSE resolved_at END
       WHERE id = ?`
    ).run(status, extra.topic ?? null, extra.winnerId ?? null, extra.resolvedBy ?? null, status, duelId);
  }
};
