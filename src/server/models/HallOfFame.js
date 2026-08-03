import { db } from '../db/database.js';

export const HallOfFameModel = {
  getLeaderboard() {
    const users = db.prepare(`
      SELECT id, name, username, email, phone, role, tag 
      FROM users 
      WHERE role != 'DEV_STEALTH'
    `).all();

    const leaderboard = users.map(user => {
      const teamTasks = db.prepare(`
        SELECT t.total_points, tm.custom_point_share
        FROM team_memberships tm
        JOIN tasks t ON tm.team_id = t.assigned_team_id
        WHERE tm.user_id = ? AND t.status = 'COMPLETED'
      `).all(user.id);

      let teamPoints = 0;
      for (const tt of teamTasks) {
        teamPoints += (tt.total_points * (tt.custom_point_share !== undefined && tt.custom_point_share !== null ? tt.custom_point_share : 1.0));
      }

      const indivTasks = db.prepare(`
        SELECT SUM(total_points) as total
        FROM tasks
        WHERE assigned_user_id = ? AND status = 'COMPLETED'
      `).get(user.id);

      const indivPoints = (indivTasks && indivTasks.total) ? indivTasks.total : 0;
      const totalPoints = Math.round(teamPoints + indivPoints);

      const publicRole = user.role === 'DEV_STEALTH' ? 'OPERATIVE' : user.role;
      return {
        id: user.id,
        name: user.name,
        username: user.username,
        tag: user.tag,
        role: publicRole,
        public_role: publicRole,
        points: totalPoints
      };
    });

    return leaderboard.sort((a, b) => b.points - a.points);
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
