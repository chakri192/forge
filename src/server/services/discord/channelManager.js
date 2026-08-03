import { ChannelType, PermissionFlagsBits } from 'discord.js';
import { systemBot } from './systemBot.js';
import { DiscordMap } from '../../models/DiscordMap.js';
import { guildId, isReady, staticChannels } from './config.js';
import { logger } from '../../utils/logger.js';

/**
 * Channel lifecycle, always through the System Bot.
 *
 * Every function returns a result object instead of throwing when Discord is
 * unavailable, so a Forge action that would create a channel still succeeds
 * with the bridge switched off.
 */
export const ChannelManager = {
  /** Record the pre-made public channels named in .env. */
  seedStaticChannels() {
    const entries = Object.entries(staticChannels());
    for (const [name, id] of entries) {
      DiscordMap.upsertChannel({ discordChannelId: id, type: 'public', name });
    }
    return entries.length;
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
