import { db } from '../db/database.js';
import { genId, nowIso } from '../utils/genId.js';
// Reused rather than reimplemented: a second copy of the host allowlist would
// drift, and this module is plain ESM with no DOM dependency.
import { isEmbeddableMedia } from '../../public/js/utils/richText.js';

const REVIEW_ROLES = new Set(['admin', 'teacher', 'leader', 'DEV_STEALTH', 'TEACHER', 'STUDENT_LEADER']);

/**
 * The per-task collaboration hub.
 *
 * Four tabs over things that already exist separately — the team's channel, the
 * files attached to the task, its subtasks, and its slice of the activity log —
 * plus meeting notes, which are new. The point is that a team stops hopping
 * between four screens to answer "where are we".
 */

function taskOrThrow(taskId) {
  const task = db
    .prepare(`SELECT id, title, status, assigned_team_id, assigned_user_id FROM tasks WHERE id = ?`)
    .get(taskId);
  if (!task) throw { status: 404, message: 'Task not found' };
  return task;
}

/**
 * Who may open a task's hub: the people doing the work, and the people who
 * review it. A task's workspace is not cohort-wide reading.
 */
function assertAccess(task, user) {
  if (REVIEW_ROLES.has(user.role)) return;
  if (task.assigned_user_id === user.id) return;
  if (task.assigned_team_id) {
    const onTeam = db
      .prepare(`SELECT 1 FROM team_memberships WHERE team_id = ? AND user_id = ?`)
      .get(task.assigned_team_id, user.id);
    if (onTeam) return;
  }
  throw { status: 403, message: 'This workspace belongs to the team working on the task' };
}

/** The team's channel, which the Chat tab renders. Null before a team is assigned. */
function channelFor(task) {
  if (!task.assigned_team_id) return null;
  return (
    db
      .prepare(`SELECT id, name, type, is_private, team_id FROM channels WHERE team_id = ? LIMIT 1`)
      .get(task.assigned_team_id) || null
  );
}

/**
 * Files attached to the task.
 *
 * Two sources, deliberately merged: what people submitted for review, and what
 * they shared in the team channel while working. Both are "files for this task"
 * to everyone except the database.
 */
function filesFor(task, channel) {
  const submissions = db
    .prepare(
      `SELECT s.id, s.proof_url AS url, s.created_at, u.name AS uploader
       FROM task_submissions s
       LEFT JOIN users u ON u.id = s.submitted_by
       WHERE s.task_id = ? AND s.proof_url IS NOT NULL
       ORDER BY s.created_at DESC`
    )
    .all(task.id)
    .map((row) => ({ ...row, source: 'submission', name: String(row.url).split('/').pop() }));

  if (!channel) return submissions;

  // Media shared in conversation. Stored inline in the message body, so the
  // links are pulled back out rather than tracked separately.
  const shared = [];
  const messages = db
    .prepare(
      `SELECT m.id, m.content, m.created_at, u.name AS uploader
       FROM messages m LEFT JOIN users u ON u.id = m.user_id
       WHERE m.channel_id = ? ORDER BY m.created_at DESC LIMIT 200`
    )
    .all(channel.id);

  for (const message of messages) {
    for (const word of String(message.content || '').split(/\s+/)) {
      if (!isEmbeddableMedia(word)) continue;
      shared.push({
        id: `${message.id}:${shared.length}`,
        url: word,
        name: decodeURIComponent(word.split('/').pop().split('?')[0]),
        uploader: message.uploader,
        created_at: message.created_at,
        source: 'chat'
      });
    }
  }

  return [...submissions, ...shared].sort((a, b) =>
    String(b.created_at).localeCompare(String(a.created_at))
  );
}

function progressFor(task) {
  const subtasks = db
    .prepare(
      `SELECT s.id, s.title, s.is_completed, s.position, u.name AS assignee
       FROM subtasks s LEFT JOIN users u ON u.id = s.assigned_to
       WHERE s.task_id = ? ORDER BY s.position ASC, s.created_at ASC`
    )
    .all(task.id);

  const done = subtasks.filter((s) => s.is_completed).length;
  return {
    subtasks,
    done,
    total: subtasks.length,
    // Guard the divide: a task with no subtasks is not 0% done, it is unmeasured.
    percent: subtasks.length ? Math.round((done / subtasks.length) * 100) : null
  };
}

function activityFor(taskId) {
  return db
    .prepare(
      `SELECT a.id, a.action, a.details, a.created_at, u.name AS actor
       FROM activity_log a LEFT JOIN users u ON u.id = a.user_id
       WHERE a.entity_type = 'task' AND a.entity_id = ?
       ORDER BY a.created_at DESC
       LIMIT 40`
    )
    .all(taskId);
}

export const CollabService = {
  hub(user, taskId) {
    const task = taskOrThrow(taskId);
    assertAccess(task, user);

    const channel = channelFor(task);
    return {
      task: { id: task.id, title: task.title, status: task.status },
      // Null until a team is assigned; the UI says so rather than showing an
      // empty chat box that can never receive anything.
      channel,
      files: filesFor(task, channel),
      progress: progressFor(task),
      notes: this.listNotes(task.id),
      activity: activityFor(task.id),
      canEditNotes: true
    };
  },

  listNotes(taskId) {
    return db
      .prepare(
        `SELECT n.id, n.title, n.content, n.created_at, n.updated_at, u.name AS author
         FROM meeting_notes n LEFT JOIN users u ON u.id = n.author_user_id
         WHERE n.task_id = ? ORDER BY n.updated_at DESC`
      )
      .all(taskId);
  },

  createNote(user, taskId, { title, content = '' }) {
    const task = taskOrThrow(taskId);
    assertAccess(task, user);
    if (!String(title || '').trim()) {
      throw { status: 400, message: 'A note needs a title' };
    }
    const id = genId('note');
    db.prepare(
      `INSERT INTO meeting_notes (id, task_id, title, content, author_user_id)
       VALUES (?, ?, ?, ?, ?)`
    ).run(id, taskId, String(title).trim(), String(content), user.id);
    return db.prepare(`SELECT * FROM meeting_notes WHERE id = ?`).get(id);
  },

  updateNote(user, noteId, { title, content }) {
    const note = db.prepare(`SELECT * FROM meeting_notes WHERE id = ?`).get(noteId);
    if (!note) throw { status: 404, message: 'Note not found' };
    const task = taskOrThrow(note.task_id);
    // Anyone on the team may edit: these are the team's notes, not the
    // note-taker's. Whoever was typing during the meeting is an accident.
    assertAccess(task, user);

    db.prepare(
      `UPDATE meeting_notes SET title = ?, content = ?, updated_at = ? WHERE id = ?`
    ).run(
      title === undefined ? note.title : String(title).trim() || note.title,
      content === undefined ? note.content : String(content),
      nowIso(),
      noteId
    );
    return db.prepare(`SELECT * FROM meeting_notes WHERE id = ?`).get(noteId);
  },

  deleteNote(user, noteId) {
    const note = db.prepare(`SELECT * FROM meeting_notes WHERE id = ?`).get(noteId);
    if (!note) throw { status: 404, message: 'Note not found' };
    const task = taskOrThrow(note.task_id);
    assertAccess(task, user);
    db.prepare(`DELETE FROM meeting_notes WHERE id = ?`).run(noteId);
    return { deleted: true };
  }
};
