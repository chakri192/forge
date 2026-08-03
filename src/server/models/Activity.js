import { db } from '../db/database.js';

export const ActivityModel = {
  create({ id, userId, action, entityType, entityId, details }) {
    const actId = id || `act_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const detailsJson = typeof details === 'object' ? JSON.stringify(details) : (details || null);

    const stmt = db.prepare(`
      INSERT INTO activity_log (id, user_id, action, entity_type, entity_id, details, created_at)
      VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `);

    stmt.run(actId, userId || null, action, entityType || 'system', entityId || null, detailsJson);
    return this.getById(actId);
  },

  getById(id) {
    const stmt = db.prepare(`
      SELECT a.*, u.name as user_name, u.username as user_username
      FROM activity_log a
      LEFT JOIN users u ON a.user_id = u.id
      WHERE a.id = ?
    `);
    const row = stmt.get(id);
    if (!row) return null;
    return this.formatRow(row);
  },

  getAll({ type, userId, startDate, endDate, limit = 50, offset = 0 } = {}) {
    let sql = `
      SELECT a.*, u.name as user_name, u.username as user_username
      FROM activity_log a
      LEFT JOIN users u ON a.user_id = u.id
      WHERE 1=1
    `;
    const params = [];

    if (type) {
      sql += ` AND (a.action = ? OR a.entity_type = ?)`;
      params.push(type, type);
    }

    if (userId) {
      sql += ` AND a.user_id = ?`;
      params.push(userId);
    }

    if (startDate) {
      sql += ` AND a.created_at >= ?`;
      params.push(startDate);
    }

    if (endDate) {
      sql += ` AND a.created_at <= ?`;
      params.push(endDate);
    }

    sql += ` ORDER BY a.created_at DESC LIMIT ? OFFSET ?`;
    params.push(parseInt(limit, 10) || 50, parseInt(offset, 10) || 0);

    const rows = db.prepare(sql).all(...params);
    return rows.map(r => this.formatRow(r));
  },

  getByUserId(userId, { type, startDate, endDate, limit = 50, offset = 0 } = {}) {
    return this.getAll({ type, userId, startDate, endDate, limit, offset });
  },

  count({ type, userId, startDate, endDate } = {}) {
    let sql = `SELECT COUNT(*) as total FROM activity_log a WHERE 1=1`;
    const params = [];

    if (type) {
      sql += ` AND (a.action = ? OR a.entity_type = ?)`;
      params.push(type, type);
    }

    if (userId) {
      sql += ` AND a.user_id = ?`;
      params.push(userId);
    }

    if (startDate) {
      sql += ` AND a.created_at >= ?`;
      params.push(startDate);
    }

    if (endDate) {
      sql += ` AND a.created_at <= ?`;
      params.push(endDate);
    }

    const row = db.prepare(sql).get(...params);
    return row ? row.total : 0;
  },

  formatRow(row) {
    let parsedDetails = null;
    if (row.details) {
      try {
        parsedDetails = JSON.parse(row.details);
      } catch (e) {
        parsedDetails = { raw: row.details };
      }
    }
    return {
      id: row.id,
      user_id: row.user_id,
      user_name: row.user_name || 'System',
      user_username: row.user_username || 'system',
      action: row.action,
      entity_type: row.entity_type,
      entity_id: row.entity_id,
      details: parsedDetails,
      created_at: row.created_at
    };
  }
};
