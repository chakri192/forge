import { Client, GatewayIntentBits } from 'discord.js';
import { tokenFor } from './config.js';
import { logger } from '../../utils/logger.js';

/**
 * One Discord client, or a dormant stand-in when there is no token.
 *
 * Every bot is created through here so the "not configured" path is written
 * once. A caller never has to check whether Discord is available before using
 * a bot; send() simply reports that it did nothing.
 */
export function createBot({ name, key, intents }) {
  const token = tokenFor(key);
  let client = null;
  let ready = false;

  return {
    name,
    key,

    isReady: () => ready,

    async connect() {
      if (!token) {
        logger.warn('discord_bot_skipped', { bot: name, reason: 'no token configured' });
        return false;
      }
      client = new Client({ intents });
      client.once('clientReady', () => {
        ready = true;
        logger.info('discord_bot_connected', { bot: name, tag: client.user?.tag });
      });
      client.on('error', (err) => logger.error('discord_bot_error', { bot: name, message: err.message }));

      try {
        await client.login(token);
        return true;
      } catch (err) {
        logger.error('discord_bot_login_failed', { bot: name, message: err.message });
        client = null;
        return false;
      }
    },

    async disconnect() {
      if (client) await client.destroy();
      client = null;
      ready = false;
    },

    raw: () => client,

    /** @returns {{delivered: boolean, reason?: string, messageId?: string}} */
    async sendEmbed(channelId, embed) {
      if (!ready || !client) return { delivered: false, reason: 'discord_unavailable' };
      try {
        const channel = await client.channels.fetch(channelId);
        if (!channel?.isTextBased()) return { delivered: false, reason: 'channel_not_text' };
        const sent = await channel.send({ embeds: [embed] });
        return { delivered: true, messageId: sent.id };
      } catch (err) {
        logger.error('discord_send_failed', { bot: name, channelId, message: err.message });
        return { delivered: false, reason: err.message };
      }
    },

    onMessage(handler) {
      if (!client) return;
      client.on('messageCreate', handler);
    }
  };
}

export const INTENTS = {
  // The System Bot manages channels and members; it never posts user content.
  system: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.GuildMembers],
  poster: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages]
};
