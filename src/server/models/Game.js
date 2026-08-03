import { db } from '../db/database.js';
import { genId } from '../utils/genId.js';

/**
 * Score ceilings are enforced server-side. The games run entirely in the
 * browser, so a submitted score is a claim, not a measurement — without a cap
 * anyone could post a made-up number straight onto the leaderboard.
 */
export const GAMES = {
  hex: {
    label: 'Hex Hunt',
    blurb: 'Read a colour and pick its hex before the clock runs out.',
    max: 30,
    unit: 'correct'
  },
  sprint: {
    label: 'Type Sprint',
    blurb: 'Retype a snippet accurately. Speed counts, mistakes count more.',
    max: 200,
    unit: 'wpm'
  },
  sequence: {
    label: 'Sequence',
    blurb: 'Watch the pattern, then play it back. It gets one longer each round.',
    max: 40,
    unit: 'rounds'
  }
};

export const GameModel = {
  record({ userId, game, score, detail = null }) {
    const id = genId('gs');
    db.prepare(
      `INSERT INTO game_scores (id, user_id, game, score, detail, created_at)
       VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`
    ).run(id, userId, game, score, detail);
    return { id, game, score };
  },

  bestFor(userId, game) {
    const row = db
      .prepare(`SELECT MAX(score) AS best FROM game_scores WHERE user_id = ? AND game = ?`)
      .get(userId, game);
    return row?.best ?? 0;
  },

  /** Every game's personal best in one query rather than one call per game. */
  bestsFor(userId) {
    const rows = db
      .prepare(`SELECT game, MAX(score) AS best FROM game_scores WHERE user_id = ? GROUP BY game`)
      .all(userId);
    const out = {};
    for (const row of rows) out[row.game] = row.best;
    return out;
  },

  /** Top scores per game, one row per player so a single person cannot fill it. */
  topFor(game, limit = 5) {
    return db
      .prepare(
        `SELECT u.name, u.username, MAX(g.score) AS score
         FROM game_scores g
         JOIN users u ON u.id = g.user_id
         WHERE g.game = ? AND u.role != 'DEV_STEALTH'
         GROUP BY g.user_id
         ORDER BY score DESC, u.name ASC
         LIMIT ?`
      )
      .all(game, limit);
  }
};
