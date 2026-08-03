import { db } from '../db/database.js';

export const TeamModel = {
  teamById: db.prepare('SELECT * FROM teams WHERE id = ?'),
  membershipCheck: db.prepare('SELECT id FROM team_memberships WHERE team_id = ? AND user_id = ?'),

  getById(id) {
    return this.teamById.get(id);
  },

  checkMembership(teamId, userId) {
    return !!this.membershipCheck.get(teamId, userId);
  },

  getAllActive() {
    const teams = db.prepare(`
      SELECT t.*, u.name as captain_name, tk.title as task_title
      FROM teams t LEFT JOIN users u ON t.captain_id = u.id LEFT JOIN tasks tk ON t.task_id = tk.id
      WHERE t.is_active = 1
    `).all();

    const getMembersStmt = db.prepare(`
      SELECT u.id, u.name, u.username, u.role, u.tag, tm.custom_point_share
      FROM team_memberships tm JOIN users u ON tm.user_id = u.id
      WHERE tm.team_id = ? AND u.role != 'DEV_STEALTH'
    `);

    return teams.map(team => ({
      ...team,
      members: getMembersStmt.all(team.id)
    }));
  },

  create({ id, name, captain_id, task_id, member_ids }) {
    db.prepare("INSERT INTO teams (id, name, captain_id, task_id, is_active, status) VALUES (?, ?, ?, ?, 1, 'ACTIVE')")
      .run(id, name, captain_id || null, task_id || null);

    if (Array.isArray(member_ids)) {
      const ins = db.prepare('INSERT INTO team_memberships (id, user_id, team_id, custom_point_share) VALUES (?, ?, ?, 1.0)');
      member_ids.forEach((uid, i) => ins.run(`tm_${Date.now()}_${i}`, uid, id));
    }
  },

  updateTask(teamId, taskId) {
    db.prepare('UPDATE teams SET task_id = ? WHERE id = ?').run(taskId, teamId);
  },

  updateCustomPointShare(teamId, userId, customPointShare) {
    return db.prepare('UPDATE team_memberships SET custom_point_share = ? WHERE team_id = ? AND user_id = ?')
      .run(customPointShare, teamId, userId);
  },

  dissolve(teamId, reason = 'MANUAL') {
    return db.prepare(`
      UPDATE teams SET is_active = 0, status = 'DISSOLVED', dissolved_at = CURRENT_TIMESTAMP, dissolution_reason = ?
      WHERE id = ?
    `).run(reason, teamId);
  },

  getMemberCount(teamId) {
    if (!teamId) return 0;
    const res = db.prepare('SELECT COUNT(*) as cnt FROM team_memberships WHERE team_id = ?').get(teamId);
    return res ? res.cnt : 0;
  },

  tryAutoDissolve(teamId) {
    if (!teamId) return false;
    const cnt = this.getMemberCount(teamId);
    if (cnt >= 4) {
      db.prepare(`
        UPDATE teams SET is_active = 0, status = 'DISSOLVED', dissolved_at = CURRENT_TIMESTAMP, dissolution_reason = 'TASK_COMPLETED'
        WHERE id = ?
      `).run(teamId);
      return true;
    }
    return false;
  }
};
