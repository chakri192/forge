import { systemBot } from './systemBot.js';
import { adminBot } from './adminBot.js';
import { messengerBot } from './messengerBot.js';
import { ChannelManager } from './channelManager.js';
import { startCleanupScheduler, stopCleanupScheduler } from './cleanupScheduler.js';
import { DiscordMap } from '../../models/DiscordMap.js';
import { parseMessageEmbed } from './embed.js';
import { pushToChannel } from './chatSocket.js';
import { isReady, readinessMessage } from './config.js';
import { logger } from '../../utils/logger.js';

export const bots = { system: systemBot, admin: adminBot, messenger: messengerBot };

/**
 * Bring the bridge up. Safe to call when Discord is not configured: it reports
 * that and returns, leaving the rest of the app running.
 */
export async function startDiscordBridge() {
  logger.info('discord_bridge_boot', { status: readinessMessage() });
  if (!isReady()) return { started: false, reason: 'not_configured' };

  const results = await Promise.all(Object.values(bots).map((bot) => bot.connect()));

  ChannelManager.seedStaticChannels();

  // Discord is the source of truth for messages, so an inbound MESSAGE_CREATE
  // is what tells Forge a message exists — including ones posted from Discord
  // directly rather than through the web UI.
  for (const bot of [adminBot, messengerBot]) {
    bot.onMessage((message) => {
      if (message.author?.bot && message.embeds?.length === 0) return;
      const mapped = DiscordMap.channelByDiscordId(message.channelId);
      if (!mapped) return;
      const parsed = parseMessageEmbed(message.embeds?.[0]);
      pushToChannel(message.channelId, {
        discordMessageId: message.id,
        discordChannelId: message.channelId,
        ...(parsed || { content: message.content, fromForge: false })
      });
    });
  }

  // Archiving is Forge-side bookkeeping and runs whether or not Discord came
  // up, so it starts regardless of the connection result.
  startCleanupScheduler();

  return { started: results.some(Boolean) };
}

export async function stopDiscordBridge() {
  stopCleanupScheduler();
  await Promise.all(Object.values(bots).map((bot) => bot.disconnect()));
}
