import { db } from '../db/database.js';
import { genId } from '../utils/genId.js';

/**
 * Score ceilings are enforced server-side. The games run entirely in the
 * browser, so a submitted score is a claim, not a measurement — without a cap
 * anyone could post a made-up number straight onto the leaderboard.
 */
export const GAMES = {
  snake: {
    label: 'Snake',
    blurb: 'Eat the apples and grow. Do not hit the wall or yourself.',
    max: 300,
    unit: 'apples'
  },
  memory: {
    label: 'Memory Match',
    blurb: 'Flip two cards at a time and remember where the pairs are.',
    max: 120,
    unit: 'pairs'
  },
  pop: {
    label: 'Bubble Pop',
    blurb: 'Pop as many bubbles as you can before the thirty seconds run out.',
    max: 150,
    unit: 'pops'
  },
  sequence: {
    label: 'Colour Sequence',
    blurb: 'Watch the colours light up, then tap them back in order.',
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
