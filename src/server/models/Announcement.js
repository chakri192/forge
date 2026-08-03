import { db } from '../db/database.js';
import { genId, nowIso } from '../utils/genId.js';

const ANNOUNCEMENT_SELECT = `
  SELECT a.*, u.name AS author_name, u.role AS author_role
  FROM announcements a
  LEFT JOIN users u ON u.id = a.author_id
`;

export const AnnouncementModel = {
  create({ id, title, content, authorId, priority = 'NORMAL', targetRole = null, expiresAt = null }) {
    const announcementId = id || genId('ann');
    db.prepare(`
      INSERT INTO announcements (id, title, content, author_id, priority, target_role, expires_at, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(announcementId, title, content, authorId, priority, targetRole, expiresAt, nowIso());
    return this.getById(announcementId);
  },

  getById(id) {
    return db.prepare(`${ANNOUNCEMENT_SELECT} WHERE a.id = ?`).get(id);
  },

  getVisible({ role = null, userId = null, includeAll = false } = {}) {
    const clauses = [`(a.expires_at IS NULL OR datetime(a.expires_at) > datetime('now'))`];
    const params = [];

    if (!includeAll) {
      clauses.push(`(a.target_role IS NULL OR a.target_role = ? OR a.author_id = ?)`);
      params.push(role, userId);
    }

    return db
      .prepare(
        `${ANNOUNCEMENT_SELECT} WHERE ${clauses.join(' AND ')}
         ORDER BY CASE a.priority WHEN 'URGENT' THEN 0 WHEN 'HIGH' THEN 1 WHEN 'NORMAL' THEN 2 ELSE 3 END,
                  a.created_at DESC`
      )
      .all(...params);
  },

  update(id, fields) {
    const allowed = ['title', 'content', 'priority', 'target_role', 'expires_at'];
    const sets = [];
    const params = [];
    for (const key of allowed) {
      if (fields[key] !== undefined) {
        sets.push(`${key} = ?`);
        params.push(fields[key]);
      }
    }
    if (!sets.length) return this.getById(id);
    params.push(id);
    db.prepare(`UPDATE announcements SET ${sets.join(', ')} WHERE id = ?`).run(...params);
    return this.getById(id);
  },

  delete(id) {
    return db.prepare(`DELETE FROM announcements WHERE id = ?`).run(id).changes > 0;
  }
};
