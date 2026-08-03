import { db } from '../db/database.js';
import { genId } from '../utils/genId.js';

/** Lookups between Forge records and the Discord objects that back them. */
export const DiscordMap = {
  upsertChannel({ discordChannelId, parentId = null, type, referenceId = null, name }) {
    const existing = db
      .prepare(`SELECT id FROM discord_channel_map WHERE discord_channel_id = ?`)
      .get(discordChannelId);
    if (existing) {
      db.prepare(
        `UPDATE discord_channel_map
         SET discord_parent_id = ?, forge_channel_type = ?, forge_reference_id = ?, name = ?, is_active = 1
         WHERE discord_channel_id = ?`
      ).run(parentId, type, referenceId, name, discordChannelId);
      return existing.id;
    }
    const id = genId('dcm');
    db.prepare(
      `INSERT INTO discord_channel_map
         (id, discord_channel_id, discord_parent_id, forge_channel_type, forge_reference_id, name, is_active, created_at)
       VALUES (?, ?, ?, ?, ?, ?, 1, CURRENT_TIMESTAMP)`
    ).run(id, discordChannelId, parentId, type, referenceId, name);
    return id;
  },

  channelByDiscordId(discordChannelId) {
    return db.prepare(`SELECT * FROM discord_channel_map WHERE discord_channel_id = ?`).get(discordChannelId) || null;
  },

  channelForReference(type, referenceId) {
    return (
      db
        .prepare(
          `SELECT * FROM discord_channel_map
           WHERE forge_channel_type = ? AND forge_reference_id = ? AND is_active = 1`
        )
        .get(type, referenceId) || null
    );
  },

  listChannels(type = null) {
    return type
      ? db.prepare(`SELECT * FROM discord_channel_map WHERE forge_channel_type = ? AND is_active = 1`).all(type)
      : db.prepare(`SELECT * FROM discord_channel_map WHERE is_active = 1`).all();
  },

  deactivateChannel(discordChannelId) {
    db.prepare(`UPDATE discord_channel_map SET is_active = 0 WHERE discord_channel_id = ?`).run(discordChannelId);
  },

  addDmParticipant(discordChannelId, userId) {
    db.prepare(
      `INSERT OR IGNORE INTO discord_dm_participants (id, discord_channel_id, user_id, joined_at)
       VALUES (?, ?, ?, CURRENT_TIMESTAMP)`
    ).run(genId('ddp'), discordChannelId, userId);
  },

  participantsOf(discordChannelId) {
    return db
      .prepare(`SELECT user_id FROM discord_dm_participants WHERE discord_channel_id = ?`)
      .all(discordChannelId)
      .map((r) => r.user_id);
  },

  isParticipant(discordChannelId, userId) {
    return Boolean(
      db
        .prepare(`SELECT 1 FROM discord_dm_participants WHERE discord_channel_id = ? AND user_id = ?`)
        .get(discordChannelId, userId)
    );
  },

  markRead(discordChannelId, userId, messageId) {
    db.prepare(
      `UPDATE discord_dm_participants SET last_read_message_id = ?
       WHERE discord_channel_id = ? AND user_id = ?`
    ).run(messageId, discordChannelId, userId);
  }
};
