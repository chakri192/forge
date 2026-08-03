import { db } from '../db/database.js';
import { genId, nowIso } from '../utils/genId.js';

const MESSAGE_SELECT = `
  SELECT m.*, u.name AS user_name, u.role AS user_role
  FROM messages m
  LEFT JOIN users u ON u.id = m.user_id
`;

export const MessageModel = {
  create({ id, channelId, userId, content }) {
    const messageId = id || genId('msg');
    const now = nowIso();
    db.prepare(`
      INSERT INTO messages (id, channel_id, user_id, content, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(messageId, channelId, userId, content, now, now);
    return this.getById(messageId);
  },

  getById(id) {
    return db.prepare(`${MESSAGE_SELECT} WHERE m.id = ?`).get(id);
  },

  getByChannel(channelId, { limit = 50 } = {}) {
    const capped = Math.max(1, Math.min(parseInt(limit, 10) || 50, 200));
    const rows = db
      .prepare(`${MESSAGE_SELECT} WHERE m.channel_id = ? ORDER BY m.created_at DESC, m.id DESC LIMIT ?`)
      .all(channelId, capped);
    return rows.reverse();
  },

  update(id, content) {
    db.prepare(`UPDATE messages SET content = ?, updated_at = ? WHERE id = ?`).run(
      content,
      nowIso(),
      id
    );
    return this.getById(id);
  },

  delete(id) {
    return db.prepare(`DELETE FROM messages WHERE id = ?`).run(id).changes > 0;
  }
};
