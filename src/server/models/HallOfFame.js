import { db } from '../db/database.js';

/** Rows -> { [key]: value } lookup, for joining aggregates in memory. */
function mapBy(rows, keyField, valueField) {
  return Object.fromEntries(rows.map((r) => [r[keyField], r[valueField]]));
}

export const HallOfFameModel = {
  /**
   * Whole-cohort standings in a fixed number of queries.
   *
   * This previously ran two queries per user inside a `.map()`, so a
   * dashboard load cost 2N+2 round trips — a thousand queries at 500
   * members, on the hottest path in the app. Aggregation now happens in
   * SQL and the results are joined in memory.
   *
   * Task status is stored lowercase but compared here against 'COMPLETED';
   * SQLite string comparison is case-sensitive, so the UPPER() is load
   * bearing — without it no points are ever counted.
   */
  getLeaderboard() {
    const users = db.prepare(`
      SELECT id, name, username, email, phone, role, tag
      FROM users
      WHERE role != 'DEV_STEALTH'
    `).all();

    const xpTotals = mapBy(
      db.prepare(`SELECT user_id, COALESCE(SUM(amount), 0) AS total FROM xp_history GROUP BY user_id`).all(),
      'user_id',
      'total'
    );

    // Team points, weighted by each member's contribution share.
    const teamPoints = mapBy(
      db.prepare(`
        SELECT tm.user_id AS user_id,
               COALESCE(SUM(t.total_points * COALESCE(tm.custom_point_share, 1.0)), 0) AS total
        FROM team_memberships tm
        JOIN tasks t ON tm.team_id = t.assigned_team_id
        WHERE UPPER(t.status) = 'COMPLETED'
        GROUP BY tm.user_id
      `).all(),
      'user_id',
      'total'
    );

    const soloPoints = mapBy(
      db.prepare(`
        SELECT assigned_user_id AS user_id, COALESCE(SUM(total_points), 0) AS total
        FROM tasks
        WHERE assigned_user_id IS NOT NULL AND UPPER(status) = 'COMPLETED'
        GROUP BY assigned_user_id
      `).all(),
      'user_id',
      'total'
    );

    return users
      .map((user) => {
        const publicRole = user.role === 'DEV_STEALTH' ? 'OPERATIVE' : user.role;
        return {
          id: user.id,
          name: user.name,
          username: user.username,
          tag: user.tag,
          role: publicRole,
          public_role: publicRole,
          points: Math.round((teamPoints[user.id] || 0) + (soloPoints[user.id] || 0)),
          xp: xpTotals[user.id] || 0
        };
      })
      // XP is the authoritative progression ledger; points stay secondary.
      .sort((a, b) => b.xp - a.xp || b.points - a.points);
  },

  getTitles() {
    return db.prepare(`
      SELECT h.*, u.name as user_name, tm.name as team_name
      FROM hall_of_fame_titles h LEFT JOIN users u ON h.awarded_to_user_id = u.id LEFT JOIN teams tm ON h.awarded_to_team_id = tm.id
      ORDER BY h.awarded_at DESC
    `).all();
  },

  awardTitle({ id, title_name, category, awarded_to_user_id, awarded_to_team_id, season }) {
    db.prepare('INSERT INTO hall_of_fame_titles (id, title_name, category, awarded_to_user_id, awarded_to_team_id, season) VALUES (?, ?, ?, ?, ?, ?)')
      .run(id, title_name, category || 'Academics', awarded_to_user_id || null, awarded_to_team_id || null, season || 'Season 1');
  }
};
