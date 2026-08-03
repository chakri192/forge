import { db } from '../db/database.js';
import { hasRole } from '../middleware/rbac.js';

/**
 * FTS5 treats characters like " * ( ) : - as query syntax, so raw user input
 * can produce a parse error rather than a result. Quote each token and append
 * a prefix wildcard, which also gives useful as-you-type behaviour.
 */
function toMatchQuery(raw) {
  const tokens = String(raw || '')
    .replace(/["*()':^-]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 1)
    .slice(0, 8);
  if (!tokens.length) return null;
  return tokens.map((t) => `"${t}"*`).join(' AND ');
}

const KIND_LABELS = {
  task: 'Task',
  forum: 'Discussion',
  announcement: 'Announcement'
};

export const SearchService = {
  /**
   * Search everything the user is allowed to see. Results are re-checked
   * against source tables rather than trusting the index, so visibility rules
   * (announcement audiences) still apply.
   */
  query(user, raw, { limit = 20 } = {}) {
    const match = toMatchQuery(raw);
    if (!match) return { results: [], query: raw };

    let rows;
    try {
      rows = db
        .prepare(`
          SELECT kind, ref_id, title, body, rank
          FROM search_index
          WHERE search_index MATCH ?
          ORDER BY rank
          LIMIT ?
        `)
        .all(match, limit * 3);
    } catch (_) {
      // A malformed query should return nothing, not a 500.
      return { results: [], query: raw };
    }

    // Collapse the multiple index rows a forum thread can produce.
    const seen = new Set();
    const results = [];
    for (const row of rows) {
      const key = `${row.kind}:${row.ref_id}`;
      if (seen.has(key)) continue;
      seen.add(key);

      const hydrated = this.hydrate(user, row);
      if (hydrated) results.push(hydrated);
      if (results.length >= limit) break;
    }

    return { results, query: raw };
  },

  hydrate(user, row) {
    switch (row.kind) {
      case 'task': {
        const task = db.prepare(`SELECT id, title, description, status FROM tasks WHERE id = ?`).get(row.ref_id);
        if (!task) return null;
        return {
          kind: 'task', label: KIND_LABELS.task, id: task.id,
          title: task.title, snippet: (task.description || '').slice(0, 140),
          link: '#/tasks'
        };
      }
      case 'forum': {
        const thread = db.prepare(`SELECT id, title, category FROM forum_threads WHERE id = ?`).get(row.ref_id);
        if (!thread) return null;
        return {
          kind: 'forum', label: KIND_LABELS.forum, id: thread.id,
          title: thread.title, snippet: (row.body || '').slice(0, 140),
          link: `#/forum/${thread.id}`
        };
      }
      case 'announcement': {
        const ann = db
          .prepare(`SELECT id, title, content, target_role, author_id FROM announcements WHERE id = ?`)
          .get(row.ref_id);
        if (!ann) return null;
        // Respect audience targeting exactly as the announcements list does.
        const visible =
          hasRole(user, ['admin']) ||
          !ann.target_role ||
          ann.target_role === (user.public_role || user.role) ||
          ann.author_id === user.id;
        if (!visible) return null;
        return {
          kind: 'announcement', label: KIND_LABELS.announcement, id: ann.id,
          title: ann.title, snippet: (ann.content || '').slice(0, 140),
          link: '#/announcements'
        };
      }
      default:
        return null;
    }
  }
};
