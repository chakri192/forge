import { db } from '../db/database.js';
import { genId, nowIso } from '../utils/genId.js';

/** Stable key for a one-to-one pair, so the same two people always reuse one thread. */
export function pairKey(a, b) {
  return [a, b].sort().join(':');
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
   * Conversations a user is in, newest activity first, with unread derived
   * rather than counted.
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

    return rows.map((row) => {
      const others = this.participants(row.id).filter((u) => u.id !== userId);
      return {
        ...row,
        participants: this.participants(row.id),
        // A dm has no title of its own — it is whoever else is in it.
        title: row.title || others.map((u) => u.name).join(', ') || 'Empty conversation',
        unread: Boolean(
          row.last_message_at && (!row.last_read_at || row.last_message_at > row.last_read_at)
        )
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
