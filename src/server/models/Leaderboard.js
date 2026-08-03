import { db } from '../db/database.js';

/**
 * Standings across the metrics people actually compete on.
 *
 * Each metric is a single set-based query joined onto the user list, rather
 * than a per-user lookup — the same N+1 that made the Hall of Fame slow.
 */

export const METRICS = {
  xp: {
    label: 'XP',
    description: 'Experience from every scored activity.',
    unit: 'xp'
  },
  tasks: {
    label: 'Tasks completed',
    description: 'Submissions that passed review.',
    unit: 'tasks'
  },
  streak: {
    label: 'Current streak',
    description: 'Consecutive days active right now.',
    unit: 'days'
  }
};

export const DEFAULT_METRIC = 'xp';

function mapBy(rows, key, value) {
  const out = new Map();
  for (const row of rows) out.set(row[key], row[value]);
  return out;
}

export const LeaderboardModel = {
  /**
   * @param {object} opts
   * @param {string} opts.metric   one of METRICS
   * @param {boolean} opts.includeHidden  include DEV_STEALTH accounts
   * @returns {Array} every eligible user, scored and ranked
   */
  standings({ metric = DEFAULT_METRIC, includeHidden = false } = {}) {
    const key = METRICS[metric] ? metric : DEFAULT_METRIC;

    const users = db
      .prepare(
        `SELECT id, name, username, role, tag
         FROM users
         ${includeHidden ? '' : `WHERE role != 'DEV_STEALTH'`}`
      )
      .all();

    const scores = this[`${key}ByUser`]();

    const ranked = users
      .map((u) => ({
        id: u.id,
        name: u.name,
        username: u.username,
        role: u.role,
        tag: u.tag,
        score: Math.round(scores.get(u.id) || 0)
      }))
      // Ties break alphabetically so the order is stable between requests
      // rather than left to whatever SQLite returns.
      .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));

    // Standard competition ranking: equal scores share a rank, and the next
    // distinct score skips ahead. Two people on 40 are both 2nd, not 2nd/3rd.
    let lastScore = null;
    let lastRank = 0;
    return ranked.map((row, index) => {
      const rank = row.score === lastScore ? lastRank : index + 1;
      lastScore = row.score;
      lastRank = rank;
      return { ...row, rank };
    });
  },

  xpByUser() {
    return mapBy(
      db
        .prepare(
          `SELECT user_id, COALESCE(SUM(amount), 0) AS total FROM xp_history GROUP BY user_id`
        )
        .all(),
      'user_id',
      'total'
    );
  },

  tasksByUser() {
    return mapBy(
      db
        .prepare(
          `SELECT submitted_by AS user_id, COUNT(*) AS total
           FROM task_submissions
           WHERE UPPER(status) IN ('APPROVED', 'ACCEPTED', 'COMPLETED')
           GROUP BY submitted_by`
        )
        .all(),
      'user_id',
      'total'
    );
  },

  streakByUser() {
    return mapBy(
      db.prepare(`SELECT user_id, COALESCE(current_streak, 0) AS total FROM streaks`).all(),
      'user_id',
      'total'
    );
  }
};
