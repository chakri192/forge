import { adminBot } from './adminBot.js';
import { messengerBot } from './messengerBot.js';
import { buildMessageEmbed } from './embed.js';
import { ensureCodeFor } from './forgeCode.js';
import { isReady } from './config.js';

/**
 * Which bot speaks for whom.
 *
 * Elevated roles post through the Admin Bot, which holds ManageMessages and so
 * can pin; everyone else posts through the Messenger Bot, which cannot. The
 * split is a permission boundary enforced by Discord, not a label.
 */
const ADMIN_VOICE = new Set(['admin', 'DEV_STEALTH', 'teacher', 'TEACHER', 'leader', 'STUDENT_LEADER']);

/** Pure: which bot should carry this role's messages. */
export function botKeyForRole(role) {
  return ADMIN_VOICE.has(role) ? 'admin' : 'messenger';
}

export function botForRole(role) {
  return botKeyForRole(role) === 'admin' ? adminBot : messengerBot;
}

/** Only the Admin Bot has the permission, so only its speakers may pin. */
export function canPin(role) {
  return botKeyForRole(role) === 'admin';
}

export const MessageRelay = {
  botKeyForRole,
  canPin,

  /**
   * Post a Forge message into a Discord channel on the author's behalf.
   *
   * Returns a result rather than throwing when Discord is unavailable: a
   * message that reached Forge should not be lost because the bridge is down,
   * and the caller decides whether that is fatal.
   */
  async relay({ user, discordChannelId, content, sentAt }) {
    if (!isReady()) return { delivered: false, reason: 'discord_not_configured' };
    if (!discordChannelId) return { delivered: false, reason: 'channel_not_mapped' };

    const forgeCode = ensureCodeFor(user);
    const embed = buildMessageEmbed({
      author: { name: user.name, role: user.role },
      forgeCode,
      content,
      sentAt: sentAt ? new Date(sentAt) : new Date()
    });

    const result = await botForRole(user.role).sendEmbed(discordChannelId, embed);
    return { ...result, forgeCode, via: botKeyForRole(user.role) };
  }
};
