import { db } from '../db/database.js';
import { genId, nowIso } from '../utils/genId.js';

/**
 * Seasons bound the leaderboard to a stretch of time.
 *
 * Without them whoever joined first stays on top for good, and a member who
 * arrives in month six can never catch up — which makes the whole board
 * something to read rather than something to compete in.
 */
export const SeasonModel = {
  /** The open season, if there is one. At most one can exist (see migration). */
  active() {
    return db.prepare(`SELECT * FROM seasons WHERE status = 'ACTIVE'`).get() || null;
  },

  getById(id) {
    return db.prepare(`SELECT * FROM seasons WHERE id = ?`).get(id) || null;
  },

  list() {
    return db
      .prepare(`SELECT * FROM seasons ORDER BY starts_at DESC`)
      .all()
      .map((season) => ({
        ...season,
        // Cheap enough to attach here, and every caller wants it.
        winner: season.status === 'ARCHIVED' ? this.winner(season.id) : null
      }));
  },

  create({ name, startsAt, endsAt }) {
    if (!name || !startsAt || !endsAt) {
      throw { status: 400, message: 'name, startsAt, and endsAt are required' };
    }
    if (new Date(endsAt) <= new Date(startsAt)) {
      throw { status: 400, message: 'A season must end after it starts' };
    }
    if (this.active()) {
      throw { status: 409, message: 'Archive the current season before starting another' };
    }

    const id = genId('season');
    db.prepare(
      `INSERT INTO seasons (id, name, starts_at, ends_at, status) VALUES (?, ?, ?, ?, 'ACTIVE')`
    ).run(id, name, startsAt, endsAt);
    return this.getById(id);
  },

  /**
   * Closes a season and freezes its standings.
   *
   * One transaction: a season that is marked archived without its standings
   * written would lose the result permanently, since the live query would then
   * be scoped to a different window.
   *
   * @param {string} id
   * @param {(season: object) => Record<string, Array<{userId: string, rank: number, score: number}>>} computeStandings
   */
  archive(id, computeStandings) {
    const season = this.getById(id);
    if (!season) throw { status: 404, message: 'Season not found' };
    if (season.status === 'ARCHIVED') {
      throw { status: 409, message: 'That season is already archived' };
    }

    const byMetric = computeStandings(season);

    const insert = db.prepare(
      `INSERT OR REPLACE INTO season_standings (id, season_id, metric, user_id, rank, score)
       VALUES (?, ?, ?, ?, ?, ?)`
    );
    const close = db.prepare(
      `UPDATE seasons SET status = 'ARCHIVED', archived_at = ? WHERE id = ?`
    );

    db.transaction(() => {
      for (const [metric, rows] of Object.entries(byMetric)) {
        for (const row of rows) {
          insert.run(genId('sstand'), id, metric, row.userId, row.rank, row.score);
        }
      }
      close.run(nowIso(), id);
    })();

    return this.getById(id);
  },

  /** Frozen standings for an archived season. */
  standings(seasonId, metric) {
    return db
      .prepare(
        `SELECT s.rank, s.score, u.id, u.name, u.username, u.role, u.tag
         FROM season_standings s
         JOIN users u ON u.id = s.user_id
         WHERE s.season_id = ? AND s.metric = ?
         ORDER BY s.rank ASC, u.name ASC`
      )
      .all(seasonId, metric);
  },

  /** Whoever topped the XP board, which is the one people mean by "won". */
  winner(seasonId) {
    return (
      db
        .prepare(
          `SELECT s.score, u.id, u.name, u.username
           FROM season_standings s
           JOIN users u ON u.id = s.user_id
           WHERE s.season_id = ? AND s.metric = 'xp' AND s.rank = 1
           ORDER BY u.name ASC
           LIMIT 1`
        )
        .get(seasonId) || null
    );
  }
};
