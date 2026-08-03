import { db } from '../db/database.js';
import { genId, nowIso } from '../utils/genId.js';

export const ChannelModel = {
  create({ id, name, type = 'text', teamId = null, isPrivate = 0 }) {
    const channelId = id || genId('chn');
    db.prepare(`
      INSERT INTO channels (id, name, type, team_id, is_private, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(channelId, name, type, teamId, isPrivate ? 1 : 0, nowIso());
    return this.getById(channelId);
  },

  getById(id) {
    return db.prepare(`SELECT * FROM channels WHERE id = ?`).get(id);
  },

  getVisibleForUser(userId) {
    return db.prepare(`
      SELECT c.*,
        (SELECT content FROM messages m WHERE m.channel_id = c.id ORDER BY m.created_at DESC LIMIT 1) AS last_message,
        (SELECT created_at FROM messages m WHERE m.channel_id = c.id ORDER BY m.created_at DESC LIMIT 1) AS last_message_at
      FROM channels c
      WHERE c.is_private = 0
         OR c.team_id IN (SELECT team_id FROM team_memberships WHERE user_id = ?)
      ORDER BY c.created_at ASC
    `).all(userId);
  },

  getTeamMemberIds(teamId) {
    return db
      .prepare(`SELECT user_id FROM team_memberships WHERE team_id = ?`)
      .all(teamId)
      .map((row) => row.user_id);
  },

  delete(id) {
    return db.prepare(`DELETE FROM channels WHERE id = ?`).run(id).changes > 0;
  }
};
