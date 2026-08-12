import { db } from '../db/database.js';
import { genId, nowIso } from '../utils/genId.js';

/** Stable key for a one-to-one pair, so the same two people always reuse one thread. */
export function pairKey(a, b) {
  return [a, b].sort().join(':');
}

/**
 * One scannable line.
 *
 * Both kinds of attachment link are stripped: a remote GIF URL, and our own
 * `/uploads/<uuid>.png`. The second is easy to forget — it is not an http URL,
 * so a naive check leaves a caption reading "first pass at the layout
 * /uploads/7d709220-2753-49d9-a7b3-60a32fa306a8.png".
 */
const MEDIA_WORD = /(^https?:\/\/\S+|^\/uploads\/\S+)\.(gif|png|jpe?g|webp|avif)(\?\S*)?$/i;

function summarise(content) {
  const text = String(content || '').trim();
  const stripped = text
    .split(/\s+/)
    .filter((word) => !MEDIA_WORD.test(word))
    .join(' ')
    .trim();
  if (stripped) return stripped.length > 80 ? `${stripped.slice(0, 77)}…` : stripped;
  return text ? 'Attachment' : '';
}

export const ConversationModel = {
  getById(id) {
    return db.prepare(`SELECT * FROM conversations WHERE id = ?`).get(id) || null;
  },

  byChannelId(channelId) {
    return db.prepare(`SELECT * FROM conversations WHERE channel_id = ?`).get(channelId) || null;
  },

  participants(conversationId) {
    return db
      .prepare(
        `SELECT u.id, u.name, u.username, u.tag, p.last_read_at
         FROM conversation_participants p
         JOIN users u ON u.id = p.user_id
         WHERE p.conversation_id = ?
         ORDER BY u.name ASC`
      )
      .all(conversationId);
  },

  isParticipant(conversationId, userId) {
    return Boolean(
      db
        .prepare(`SELECT 1 FROM conversation_participants WHERE conversation_id = ? AND user_id = ?`)
        .get(conversationId, userId)
    );
  },

  /**
   * Conversations a user is in, newest activity first, with an unread count
   * and one line of preview.
   */
  listFor(userId) {
    const rows = db
      .prepare(
        `SELECT c.*, p.last_read_at
         FROM conversations c
         JOIN conversation_participants p ON p.conversation_id = c.id
         WHERE p.user_id = ?
         ORDER BY COALESCE(c.last_message_at, c.created_at) DESC`
      )
      .all(userId);

    // Counted rather than flagged: "3 unread" and "unread" are different
    // answers to the question of whether this is worth opening now.
    const countUnread = db.prepare(
      `SELECT COUNT(*) AS n FROM messages
       WHERE channel_id = ? AND user_id != ? AND (? IS NULL OR created_at > ?)`
    );
    const lastMessage = db.prepare(
      `SELECT m.content, m.created_at, u.name AS author
       FROM messages m LEFT JOIN users u ON u.id = m.user_id
       WHERE m.channel_id = ? ORDER BY m.created_at DESC LIMIT 1`
    );

    return rows.map((row) => {
      const participants = this.participants(row.id);
      const others = participants.filter((u) => u.id !== userId);
      const preview = lastMessage.get(row.channel_id) || null;

      return {
        ...row,
        participants,
        // A dm has no title of its own — it is whoever else is in it.
        title: row.title || others.map((u) => u.name).join(', ') || 'Empty conversation',
        unread: countUnread.get(row.channel_id, userId, row.last_read_at, row.last_read_at).n,
        // The list is scanned, not read. A line of what was last said tells you
        // whether to open it; a name and a timestamp do not.
        preview: preview
          ? { author: preview.author, at: preview.created_at, text: summarise(preview.content) }
          : null
      };
    });
  },

  /**
   * Creates the channel and the conversation together.
   *
   * One transaction: a conversation whose channel is missing, or a private
   * channel nobody is a participant of, is unreachable and invisible — it would
   * just accumulate.
   */
  create({ kind, title = null, createdBy, memberIds, key = null }) {
    const conversationId = genId('conv');
    const channelId = genId('chn');

    db.transaction(() => {
      db.prepare(
        `INSERT INTO channels (id, name, type, is_private, team_id)
         VALUES (?, ?, 'text', 1, NULL)`
      ).run(channelId, title || `conversation-${conversationId.slice(-6)}`);

      db.prepare(
        `INSERT INTO conversations (id, channel_id, kind, title, created_by)
         VALUES (?, ?, ?, ?, ?)`
      ).run(conversationId, channelId, kind, title, createdBy);

      const addMember = db.prepare(
        `INSERT OR IGNORE INTO conversation_participants (id, conversation_id, user_id)
         VALUES (?, ?, ?)`
      );
      for (const userId of memberIds) addMember.run(genId('cpart'), conversationId, userId);

      if (key) {
        db.prepare(`INSERT INTO dm_pairs (pair_key, conversation_id) VALUES (?, ?)`).run(
          key,
          conversationId
        );
      }
    })();

    return this.getById(conversationId);
  },

  /** The existing thread for a pair, if they have one. */
  findPair(a, b) {
    const row = db.prepare(`SELECT conversation_id FROM dm_pairs WHERE pair_key = ?`).get(pairKey(a, b));
    return row ? this.getById(row.conversation_id) : null;
  },

  touch(conversationId, at = nowIso()) {
    db.prepare(`UPDATE conversations SET last_message_at = ? WHERE id = ?`).run(at, conversationId);
  },

  markRead(conversationId, userId, at = nowIso()) {
    db.prepare(
      `UPDATE conversation_participants SET last_read_at = ? WHERE conversation_id = ? AND user_id = ?`
    ).run(at, conversationId, userId);
  },

  addParticipants(conversationId, userIds) {
    const add = db.prepare(
      `INSERT OR IGNORE INTO conversation_participants (id, conversation_id, user_id) VALUES (?, ?, ?)`
    );
    db.transaction(() => {
      for (const userId of userIds) add.run(genId('cpart'), conversationId, userId);
    })();
  },

  removeParticipant(conversationId, userId) {
    db.prepare(
      `DELETE FROM conversation_participants WHERE conversation_id = ? AND user_id = ?`
    ).run(conversationId, userId);
  }
};
