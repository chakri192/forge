import { db } from '../db/database.js';

export const NotificationModel = {
  create({ id, userId, title, message, type = 'INFO', link = null }) {
    const notifId = id || `n_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    const stmt = db.prepare(`
      INSERT INTO notifications (id, user_id, title, message, type, link, is_read, created_at)
      VALUES (?, ?, ?, ?, ?, ?, 0, CURRENT_TIMESTAMP)
    `);
    stmt.run(notifId, userId, title, message, type, link);
    return this.getById(notifId);
  },

  createBulk(notifications) {
    const stmt = db.prepare(`
      INSERT INTO notifications (id, user_id, title, message, type, link, is_read, created_at)
      VALUES (?, ?, ?, ?, ?, ?, 0, CURRENT_TIMESTAMP)
    `);

    const insertMany = db.transaction((items) => {
      for (const item of items) {
        const notifId = item.id || `n_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
        stmt.run(notifId, item.userId, item.title, item.message, item.type || 'INFO', item.link || null);
      }
    });

    insertMany(notifications);
    return true;
  },

  getById(id) {
    const stmt = db.prepare(`SELECT * FROM notifications WHERE id = ?`);
    return stmt.get(id);
  },

  getByUserId(userId, { limit = 20, offset = 0, unreadOnly = false } = {}) {
    let sql = `SELECT * FROM notifications WHERE user_id = ?`;
    const params = [userId];

    if (unreadOnly) {
      sql += ` AND is_read = 0`;
    }

    sql += ` ORDER BY created_at DESC LIMIT ? OFFSET ?`;
    params.push(limit, offset);

    return db.prepare(sql).all(...params);
  },

  markAsRead(id, userId) {
    const stmt = db.prepare(`
      UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?
    `);
    const result = stmt.run(id, userId);
    return result.changes > 0;
  },

  markAllAsRead(userId) {
    const stmt = db.prepare(`
      UPDATE notifications SET is_read = 1 WHERE user_id = ? AND is_read = 0
    `);
    const result = stmt.run(userId);
    return result.changes;
  },

  getUnreadCount(userId) {
    const stmt = db.prepare(`
      SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND is_read = 0
    `);
    const row = stmt.get(userId);
    return row ? row.count : 0;
  }
};
