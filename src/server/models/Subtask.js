import { db } from '../db/database.js';
import { genId } from '../utils/genId.js';

export const SubtaskModel = {
  create({ taskId, title, assignedTo = null }) {
    const id = genId('sub');
    const next = db
      .prepare(`SELECT COALESCE(MAX(position), -1) + 1 AS next FROM subtasks WHERE task_id = ?`)
      .get(taskId).next;
    db.prepare(`
      INSERT INTO subtasks (id, task_id, title, is_completed, assigned_to, position)
      VALUES (?, ?, ?, 0, ?, ?)
    `).run(id, taskId, title, assignedTo, next);
    return this.getById(id);
  },

  getById(id) {
    return db.prepare(`SELECT * FROM subtasks WHERE id = ?`).get(id) ?? null;
  },

  listForTask(taskId) {
    return db
      .prepare(`
        SELECT s.*, u.name AS assigned_name
        FROM subtasks s
        LEFT JOIN users u ON u.id = s.assigned_to
        WHERE s.task_id = ?
        ORDER BY s.position ASC, s.id ASC
      `)
      .all(taskId);
  },

  update(id, { title, isCompleted, assignedTo }) {
    const sets = [];
    const params = [];
    if (title !== undefined) {
      sets.push('title = ?');
      params.push(title);
    }
    if (isCompleted !== undefined) {
      sets.push('is_completed = ?');
      params.push(isCompleted ? 1 : 0);
    }
    if (assignedTo !== undefined) {
      sets.push('assigned_to = ?');
      params.push(assignedTo);
    }
    if (!sets.length) return this.getById(id);
    params.push(id);
    db.prepare(`UPDATE subtasks SET ${sets.join(', ')} WHERE id = ?`).run(...params);
    return this.getById(id);
  },

  delete(id) {
    return db.prepare(`DELETE FROM subtasks WHERE id = ?`).run(id).changes > 0;
  },

  progressFor(taskId) {
    const row = db
      .prepare(
        `SELECT COUNT(*) AS total, COALESCE(SUM(is_completed), 0) AS done
         FROM subtasks WHERE task_id = ?`
      )
      .get(taskId);
    const total = row.total || 0;
    const done = row.done || 0;
    return { total, done, percent: total ? Math.round((done / total) * 100) : 0 };
  },

  /** Bulk progress for a set of tasks, avoiding an N+1 in list views. */
  progressForMany(taskIds) {
    if (!taskIds.length) return {};
    const placeholders = taskIds.map(() => '?').join(',');
    const rows = db
      .prepare(
        `SELECT task_id, COUNT(*) AS total, COALESCE(SUM(is_completed), 0) AS done
         FROM subtasks WHERE task_id IN (${placeholders}) GROUP BY task_id`
      )
      .all(...taskIds);
    return Object.fromEntries(
      rows.map((r) => [
        r.task_id,
        { total: r.total, done: r.done, percent: r.total ? Math.round((r.done / r.total) * 100) : 0 }
      ])
    );
  }
};
