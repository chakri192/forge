import { db } from '../db/database.js';
import { genId } from '../utils/genId.js';

/**
 * A conservative allowlist. Reactions are rendered as raw text in the client,
 * so accepting arbitrary strings here would let anyone push a paragraph — or
 * markup — into everyone else's message list.
 */
export const ALLOWED_EMOJI = [
  '👍', '👎', '❤️', '🔥', '🎉', '👀', '✅', '❌',
  '💯', '🙏', '🤝', '👏', '😄', '😂', '🙂', '😉',
  '😍', '🤔', '😅', '😬', '😮', '😢', '😴', '🤯',
  '🥳', '😎', '🙃', '🚀', '💡', '🐛', '🛠️', '📌',
  '📝', '📚', '⏰', '⚡', '🧠', '🎯', '🧪', '🔍',
  '🟢', '🟡', '🔴', '⚠️', '🚧', '🆘', '🔒', '🏁',
  '☕', '🍕', '🎮', '🎵', '🌱', '⭐', '🏆', '🎁'
];

const ALLOWED = new Set(ALLOWED_EMOJI);

export function isAllowedEmoji(emoji) {
  return ALLOWED.has(emoji);
}

export const ReactionModel = {
  /**
   * Toggle: the same emoji from the same user removes it, anything else adds.
   * @returns {{ added: boolean }}
   */
  toggle({ messageId, userId, emoji }) {
    const existing = db
      .prepare(`SELECT id FROM message_reactions WHERE message_id = ? AND user_id = ? AND emoji = ?`)
      .get(messageId, userId, emoji);

    if (existing) {
      db.prepare(`DELETE FROM message_reactions WHERE id = ?`).run(existing.id);
      return { added: false };
    }

    db.prepare(`
      INSERT INTO message_reactions (id, message_id, user_id, emoji, created_at)
      VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
    `).run(genId('rxn'), messageId, userId, emoji);
    return { added: true };
  },

  /** Grouped counts for one message, with the caller's own reactions marked. */
  forMessage(messageId, viewerId = null) {
    const rows = db
      .prepare(`
        SELECT emoji, COUNT(*) AS count,
               SUM(CASE WHEN user_id = ? THEN 1 ELSE 0 END) AS mine
        FROM message_reactions
        WHERE message_id = ?
        GROUP BY emoji
        ORDER BY count DESC, emoji ASC
      `)
      .all(viewerId, messageId);
    return rows.map((r) => ({ emoji: r.emoji, count: r.count, mine: r.mine > 0 }));
  },

  /**
   * Reactions for a page of messages in one query — a per-message lookup would
   * reintroduce an N+1 on the busiest view in the app.
   */
  forMessages(messageIds, viewerId = null) {
    if (!messageIds.length) return {};
    const placeholders = messageIds.map(() => '?').join(',');
    const rows = db
      .prepare(`
        SELECT message_id, emoji, COUNT(*) AS count,
               SUM(CASE WHEN user_id = ? THEN 1 ELSE 0 END) AS mine
        FROM message_reactions
        WHERE message_id IN (${placeholders})
        GROUP BY message_id, emoji
        ORDER BY count DESC, emoji ASC
      `)
      .all(viewerId, ...messageIds);

    const grouped = {};
    for (const row of rows) {
      if (!grouped[row.message_id]) grouped[row.message_id] = [];
      grouped[row.message_id].push({ emoji: row.emoji, count: row.count, mine: row.mine > 0 });
    }
    return grouped;
  }
};
