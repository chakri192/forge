import { db } from '../db/database.js';
import { genId } from '../utils/genId.js';

export const ForumModel = {
  createThread({ title, category = 'general', authorId }) {
    const id = genId('thr');
    db.prepare(`
      INSERT INTO forum_threads (id, title, category, author_id, is_pinned, is_locked, view_count, created_at, updated_at)
      VALUES (?, ?, ?, ?, 0, 0, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `).run(id, title, category, authorId);
    return this.getThread(id);
  },

  getThread(id) {
    return db
      .prepare(`
        SELECT t.*, u.name AS author_name, u.role AS author_role,
          (SELECT COUNT(*) FROM forum_posts p WHERE p.thread_id = t.id) AS reply_count,
          (SELECT MAX(created_at) FROM forum_posts p WHERE p.thread_id = t.id) AS last_reply_at
        FROM forum_threads t
        LEFT JOIN users u ON u.id = t.author_id
        WHERE t.id = ?
      `)
      .get(id) ?? null;
  },

  listThreads({ category = null, limit = 50, offset = 0 } = {}) {
    const where = category ? `WHERE t.category = ?` : '';
    const params = category ? [category] : [];
    // Unbounded lists are fine at 50 rows and not at 50,000.
    const capped = Math.max(1, Math.min(Number(limit) || 50, 100));
    const skip = Math.max(0, Number(offset) || 0);
    return db
      .prepare(`
        SELECT t.*, u.name AS author_name, u.role AS author_role,
          (SELECT COUNT(*) FROM forum_posts p WHERE p.thread_id = t.id) AS reply_count,
          (SELECT MAX(created_at) FROM forum_posts p WHERE p.thread_id = t.id) AS last_reply_at,
          (SELECT COUNT(*) FROM forum_posts p WHERE p.thread_id = t.id AND p.is_answer = 1) AS answer_count
        FROM forum_threads t
        LEFT JOIN users u ON u.id = t.author_id
        ${where}
        ORDER BY t.is_pinned DESC, t.updated_at DESC
        LIMIT ? OFFSET ?
      `)
      .all(...params, capped, skip);
  },

  categories() {
    return db
      .prepare(`SELECT category, COUNT(*) AS total FROM forum_threads GROUP BY category ORDER BY total DESC`)
      .all();
  },

  incrementViews(id) {
    db.prepare(`UPDATE forum_threads SET view_count = view_count + 1 WHERE id = ?`).run(id);
  },

  updateThread(id, { title, category, isPinned, isLocked }) {
    const sets = [];
    const params = [];
    if (title !== undefined) { sets.push('title = ?'); params.push(title); }
    if (category !== undefined) { sets.push('category = ?'); params.push(category); }
    if (isPinned !== undefined) { sets.push('is_pinned = ?'); params.push(isPinned ? 1 : 0); }
    if (isLocked !== undefined) { sets.push('is_locked = ?'); params.push(isLocked ? 1 : 0); }
    if (!sets.length) return this.getThread(id);
    sets.push('updated_at = CURRENT_TIMESTAMP');
    params.push(id);
    db.prepare(`UPDATE forum_threads SET ${sets.join(', ')} WHERE id = ?`).run(...params);
    return this.getThread(id);
  },

  deleteThread(id) {
    return db.prepare(`DELETE FROM forum_threads WHERE id = ?`).run(id).changes > 0;
  },

  createPost({ threadId, authorId, content }) {
    const id = genId('pst');
    db.prepare(`
      INSERT INTO forum_posts (id, thread_id, author_id, content, is_answer, created_at, updated_at)
      VALUES (?, ?, ?, ?, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `).run(id, threadId, authorId, content);
    // Bumping the thread keeps active discussions at the top of the list.
    db.prepare(`UPDATE forum_threads SET updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(threadId);
    return this.getPost(id);
  },

  getPost(id) {
    return db
      .prepare(`
        SELECT p.*, u.name AS author_name, u.role AS author_role
        FROM forum_posts p
        LEFT JOIN users u ON u.id = p.author_id
        WHERE p.id = ?
      `)
      .get(id) ?? null;
  },

  listPosts(threadId) {
    return db
      .prepare(`
        SELECT p.*, u.name AS author_name, u.role AS author_role
        FROM forum_posts p
        LEFT JOIN users u ON u.id = p.author_id
        WHERE p.thread_id = ?
        ORDER BY p.is_answer DESC, p.created_at ASC
      `)
      .all(threadId);
  },

  updatePost(id, content) {
    db.prepare(`UPDATE forum_posts SET content = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`)
      .run(content, id);
    return this.getPost(id);
  },

  /** Only one accepted answer per thread. */
  markAnswer(threadId, postId) {
    const tx = db.transaction(() => {
      db.prepare(`UPDATE forum_posts SET is_answer = 0 WHERE thread_id = ?`).run(threadId);
      db.prepare(`UPDATE forum_posts SET is_answer = 1 WHERE id = ?`).run(postId);
    });
    tx();
    return this.getPost(postId);
  },

  deletePost(id) {
    return db.prepare(`DELETE FROM forum_posts WHERE id = ?`).run(id).changes > 0;
  }
};

export const SuggestionModel = {
  create({ title, description, suggestedBy }) {
    const id = genId('sug');
    db.prepare(`
      INSERT INTO marketplace_suggestions (id, title, description, suggested_by, status, upvotes_count, created_at)
      VALUES (?, ?, ?, ?, 'PENDING', 0, CURRENT_TIMESTAMP)
    `).run(id, title, description, suggestedBy);
    return this.getById(id);
  },

  getById(id) {
    return db
      .prepare(`
        SELECT s.*, u.name AS suggested_by_name
        FROM marketplace_suggestions s
        LEFT JOIN users u ON u.id = s.suggested_by
        WHERE s.id = ?
      `)
      .get(id) ?? null;
  },

  list({ status = null } = {}) {
    const where = status ? `WHERE s.status = ?` : '';
    const params = status ? [status] : [];
    return db
      .prepare(`
        SELECT s.*, u.name AS suggested_by_name
        FROM marketplace_suggestions s
        LEFT JOIN users u ON u.id = s.suggested_by
        ${where}
        ORDER BY s.upvotes_count DESC, s.created_at DESC
      `)
      .all(...params);
  },

  setStatus(id, status) {
    db.prepare(`UPDATE marketplace_suggestions SET status = ? WHERE id = ?`).run(status, id);
    return this.getById(id);
  },

  /** Denormalized count kept in step with the votes table after each vote. */
  syncUpvotes(id, score) {
    db.prepare(`UPDATE marketplace_suggestions SET upvotes_count = ? WHERE id = ?`).run(score, id);
  }
};
