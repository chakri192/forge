import { ChannelType, PermissionFlagsBits } from 'discord.js';
import { systemBot } from './systemBot.js';
import { DiscordMap } from '../../models/DiscordMap.js';
import { guildId, isReady, staticChannels } from './config.js';
import { db } from '../../db/database.js';
import { logger } from '../../utils/logger.js';

/**
 * Channel lifecycle, always through the System Bot.
 *
 * Every function returns a result object instead of throwing when Discord is
 * unavailable, so a Forge action that would create a channel still succeeds
 * with the bridge switched off.
 */
export const ChannelManager = {
  /**
   * Record the pre-made public channels named in .env, and link each to the
   * Forge channel of the same name. The name is the join key because these
   * channels exist on both sides already — nothing created one from the other.
   * DISCORD_CHANNEL_OFF_TOPIC therefore pairs with a Forge channel named
   * "off-topic", and an unmatched Discord channel is still mapped so it can be
   * used later.
   */
  seedStaticChannels() {
    const entries = Object.entries(staticChannels());
    let linked = 0;

    for (const [envName, discordId] of entries) {
      const name = envName.replace(/_/g, '-');
      const forgeChannel = db
        .prepare(`SELECT id FROM channels WHERE LOWER(name) = ?`)
        .get(name);

      DiscordMap.upsertChannel({
        discordChannelId: discordId,
        type: 'public',
        referenceId: forgeChannel?.id || null,
        name
      });
      if (forgeChannel) linked += 1;
    }

    logger.info('discord_static_channels_seeded', { mapped: entries.length, linkedToForge: linked });
    return { mapped: entries.length, linked };
  },

  async createPrivateChannel({ name, parentId = null, memberBotIds = [], type = 'private_dm', referenceId = null }) {
    if (!isReady() || !systemBot.isReady()) {
      return { created: false, reason: 'discord_unavailable' };
    }
    const client = systemBot.raw();
    try {
      const guild = await client.guilds.fetch(guildId());
      // Deny @everyone first; the bots that must post are added explicitly.
      const overwrites = [
        { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
        ...memberBotIds.map((botId) => ({
          id: botId,
          allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages]
        }))
      ];
      const channel = await guild.channels.create({
        name,
        type: ChannelType.GuildText,
        parent: parentId || undefined,
        permissionOverwrites: overwrites
      });
      DiscordMap.upsertChannel({
        discordChannelId: channel.id,
        parentId: parentId || null,
        type,
        referenceId,
        name
      });
      return { created: true, discordChannelId: channel.id };
    } catch (err) {
      logger.error('discord_channel_create_failed', { name, message: err.message });
      return { created: false, reason: err.message };
    }
  },

  async deleteChannel(discordChannelId) {
    DiscordMap.deactivateChannel(discordChannelId);
    if (!isReady() || !systemBot.isReady()) return { deleted: false, reason: 'discord_unavailable' };
    try {
      const channel = await systemBot.raw().channels.fetch(discordChannelId);
      await channel.delete('Forge channel lifecycle');
      return { deleted: true };
    } catch (err) {
      logger.error('discord_channel_delete_failed', { discordChannelId, message: err.message });
      return { deleted: false, reason: err.message };
    }
  }
};
