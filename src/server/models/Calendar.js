import { db } from '../db/database.js';
import { genId } from '../utils/genId.js';

export const EVENT_TYPES = ['EVENT', 'DEADLINE', 'WORKSHOP', 'MEETING'];

export const CalendarModel = {
  create({ title, description = null, startTime, endTime, location = null, eventType = 'EVENT', createdBy, teamId = null }) {
    const id = genId('evt');
    db.prepare(`
      INSERT INTO calendar_events (id, title, description, start_time, end_time, location, event_type, created_by, team_id, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `).run(id, title, description, startTime, endTime, location, eventType, createdBy, teamId);
    return this.getById(id);
  },

  getById(id) {
    return db
      .prepare(`
        SELECT e.*, u.name AS created_by_name, t.name AS team_name
        FROM calendar_events e
        LEFT JOIN users u ON u.id = e.created_by
        LEFT JOIN teams t ON t.id = e.team_id
        WHERE e.id = ?
      `)
      .get(id) ?? null;
  },

  /**
   * Events visible to a user: everything cohort-wide plus anything scoped to a
   * team they belong to.
   */
  listVisible(userId, { from, to } = {}) {
    const clauses = [`(e.team_id IS NULL OR e.team_id IN (SELECT team_id FROM team_memberships WHERE user_id = ?))`];
    const params = [userId];
    if (from) {
      clauses.push(`datetime(e.end_time) >= datetime(?)`);
      params.push(from);
    }
    if (to) {
      clauses.push(`datetime(e.start_time) <= datetime(?)`);
      params.push(to);
    }
    return db
      .prepare(`
        SELECT e.*, u.name AS created_by_name, t.name AS team_name
        FROM calendar_events e
        LEFT JOIN users u ON u.id = e.created_by
        LEFT JOIN teams t ON t.id = e.team_id
        WHERE ${clauses.join(' AND ')}
        ORDER BY datetime(e.start_time) ASC
      `)
      .all(...params);
  },

  update(id, fields) {
    const map = {
      title: 'title', description: 'description', startTime: 'start_time',
      endTime: 'end_time', location: 'location', eventType: 'event_type', teamId: 'team_id'
    };
    const sets = [];
    const params = [];
    for (const [key, column] of Object.entries(map)) {
      if (fields[key] !== undefined) {
        sets.push(`${column} = ?`);
        params.push(fields[key]);
      }
    }
    if (!sets.length) return this.getById(id);
    params.push(id);
    db.prepare(`UPDATE calendar_events SET ${sets.join(', ')} WHERE id = ?`).run(...params);
    return this.getById(id);
  },

  delete(id) {
    return db.prepare(`DELETE FROM calendar_events WHERE id = ?`).run(id).changes > 0;
  },

  /**
   * Task deadlines normalized into the same shape as calendar events, so the
   * timeline is one merged list rather than two parallel ones.
   */
  taskDeadlinesFor(userId, { from, to } = {}) {
    const clauses = [
      `t.deadline IS NOT NULL`,
      `UPPER(t.status) NOT IN ('COMPLETED', 'ARCHIVED')`,
      `(t.assigned_user_id = ? OR t.assigned_team_id IN (SELECT team_id FROM team_memberships WHERE user_id = ?) OR (t.assigned_user_id IS NULL AND t.assigned_team_id IS NULL))`
    ];
    const params = [userId, userId];
    if (from) { clauses.push(`datetime(t.deadline) >= datetime(?)`); params.push(from); }
    if (to) { clauses.push(`datetime(t.deadline) <= datetime(?)`); params.push(to); }

    return db
      .prepare(`
        SELECT t.id, t.title, t.description, t.deadline AS start_time, t.deadline AS end_time,
               'DEADLINE' AS event_type, t.status AS task_status
        FROM tasks t
        WHERE ${clauses.join(' AND ')}
        ORDER BY datetime(t.deadline) ASC
      `)
      .all(...params)
      .map((row) => ({ ...row, id: `task:${row.id}`, task_id: row.id, source: 'task' }));
  }
};

export const JournalModel = {
  create({ userId, title, content, mood = null, tags = null }) {
    const id = genId('jrn');
    db.prepare(`
      INSERT INTO journal_entries (id, user_id, title, content, mood, tags, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `).run(id, userId, title, content, mood, tags);
    return this.getById(id);
  },

  getById(id) {
    return db.prepare(`SELECT * FROM journal_entries WHERE id = ?`).get(id) ?? null;
  },

  listForUser(userId, { limit = 50 } = {}) {
    return db
      .prepare(
        `SELECT * FROM journal_entries WHERE user_id = ? ORDER BY created_at DESC LIMIT ?`
      )
      .all(userId, Math.max(1, Math.min(limit, 200)));
  },

  update(id, { title, content, mood, tags }) {
    const sets = [];
    const params = [];
    if (title !== undefined) { sets.push('title = ?'); params.push(title); }
    if (content !== undefined) { sets.push('content = ?'); params.push(content); }
    if (mood !== undefined) { sets.push('mood = ?'); params.push(mood); }
    if (tags !== undefined) { sets.push('tags = ?'); params.push(tags); }
    if (!sets.length) return this.getById(id);
    sets.push('updated_at = CURRENT_TIMESTAMP');
    params.push(id);
    db.prepare(`UPDATE journal_entries SET ${sets.join(', ')} WHERE id = ?`).run(...params);
    return this.getById(id);
  },

  delete(id) {
    return db.prepare(`DELETE FROM journal_entries WHERE id = ?`).run(id).changes > 0;
  }
};
