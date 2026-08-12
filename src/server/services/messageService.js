import { ChannelModel } from '../models/Channel.js';
import { db } from '../db/database.js';
import { genId } from '../utils/genId.js';
import { MessageModel } from '../models/Message.js';
import { hasRole } from '../middleware/rbac.js';
import { ActivityService } from './activity.js';
import { publish, publishAll } from './sse.js';
import { ReactionModel, isAllowedEmoji } from '../models/Reaction.js';
import { VoteModel } from '../models/Vote.js';
import { MessageRelay } from './discord/messageRelay.js';
import { DiscordMap } from '../models/DiscordMap.js';
import { NotificationService } from './notification.js';
import { resolveMentions } from '../utils/mentions.js';
import { ConversationService } from './conversationService.js';

const MANAGE_ROLES = ['leader', 'teacher', 'admin'];
const CHANNEL_TYPES = ['text', 'announcement', 'team'];

function assertChannelAccess(channel, user) {
  if (!channel) {
    throw { status: 404, message: 'Channel not found' };
  }
  if (hasRole(user, ['admin'])) return;
  if (channel.is_private && channel.team_id) {
    const memberIds = ChannelModel.getTeamMemberIds(channel.team_id);
    if (!memberIds.includes(user.id)) {
      throw { status: 403, message: 'Forbidden: you do not have access to this channel' };
    }
    return;
  }
  if (channel.is_private) {
    // A conversation channel is private and team-less; being a participant is
    // what grants access.
    if (ConversationService.canAccessChannel(channel.id, user.id)) return;
    throw { status: 403, message: 'Forbidden: this channel is private' };
  }
}

/**
 * Can this user open this channel? The same rule assertChannelAccess enforces,
 * as a question rather than a throw — a notification must never reach someone
 * who could not have read the message that triggered it.
 */
function canSeeChannel(channel, userId) {
  if (!channel) return false;
  if (channel.is_private && channel.team_id) {
    return ChannelModel.getTeamMemberIds(channel.team_id).includes(userId);
  }
  if (channel.is_private) return ConversationService.canAccessChannel(channel.id, userId);
  return true;
}

/**
 * Tells anyone named in a message that they were named, once the message is
 * safely stored. Never fatal: a failed notification must not undo a delivered
 * message.
 */
function notifyMentions({ channel, message, author, content }) {
  try {
    const mentioned = resolveMentions(content, (id) => canSeeChannel(channel, id), author.id);
    for (const user of mentioned) {
      NotificationService.createNotification({
        userId: user.id,
        title: `${author.name} mentioned you`,
        // A one-line preview, so the notification is worth reading without
        // dragging the whole message into a second place.
        message: content.length > 140 ? `${content.slice(0, 137)}…` : content,
        type: 'MENTION',
        link: `#/messages/${channel.id}`
      });
    }
  } catch (_) {
    /* a mention that fails to notify is not a reason to lose the message */
  }
}

function broadcastToChannel(channel, event) {
  if (channel.is_private && channel.team_id) {
    return publish(ChannelModel.getTeamMemberIds(channel.team_id), event);
  }
  if (channel.is_private) {
    // A private channel with no team is a conversation. Falling through to
    // publishAll here would push every direct message to the whole cohort.
    const audience = ConversationService.audience(channel.id);
    return publish(audience || [], event);
  }
  publishAll(event);
}

export const MessageService = {
  listChannels(user) {
    return ChannelModel.getVisibleForUser(user.id);
  },

  createChannel(user, { name, type = 'text', team_id = null, is_private = false }) {
    if (!CHANNEL_TYPES.includes(type)) {
      throw { status: 400, message: `Channel type must be one of: ${CHANNEL_TYPES.join(', ')}` };
    }
    if (is_private && !team_id) {
      throw { status: 400, message: 'Private channels must belong to a team' };
    }
    const channel = ChannelModel.create({ name, type, teamId: team_id, isPrivate: is_private });
    ActivityService.logActivity({
      userId: user.id,
      action: 'CHANNEL_CREATE',
      entityType: 'CHANNEL',
      entityId: channel.id,
      details: { description: `${user.name} created channel "${channel.name}"` }
    });
    return channel;
  },

  getChannelMessages(user, channelId, { limit } = {}) {
    const channel = ChannelModel.getById(channelId);
    assertChannelAccess(channel, user);

    const messages = MessageModel.getByChannel(channelId, { limit });
    const ids = messages.map((m) => m.id);
    // Batched so a busy channel stays one query per concern, not one per row.
    const reactions = ReactionModel.forMessages(ids, user.id);
    const scores = VoteModel.scoresFor('MESSAGE', ids);
    const myVotes = VoteModel.userVotesFor(user.id, 'MESSAGE', ids);

    return {
      channel,
      messages: messages.map((m) => ({
        ...m,
        reactions: reactions[m.id] || [],
        score: scores[m.id] || 0,
        my_vote: myVotes[m.id] || 0
      }))
    };
  },

  /** Toggle an emoji reaction and broadcast the new tally to the channel. */
  react(user, messageId, emoji) {
    if (!isAllowedEmoji(emoji)) {
      throw { status: 400, message: 'That emoji is not available' };
    }
    const message = MessageModel.getById(messageId);
    if (!message) throw { status: 404, message: 'Message not found' };

    const channel = ChannelModel.getById(message.channel_id);
    assertChannelAccess(channel, user);

    ReactionModel.toggle({ messageId, userId: user.id, emoji });
    const reactions = ReactionModel.forMessage(messageId, user.id);

    // The broadcast carries no viewer-specific `mine` flag; each client
    // recomputes its own state from its existing view.
    broadcastToChannel(channel, {
      type: 'reaction',
      channelId: message.channel_id,
      messageId,
      reactions: reactions.map(({ emoji: e, count }) => ({ emoji: e, count }))
    });

    return { messageId, reactions };
  },

  /** Up/down vote a message, reusing the shared polymorphic votes table. */
  vote(user, messageId, value) {
    if (![1, -1].includes(value)) throw { status: 400, message: 'value must be 1 or -1' };
    const message = MessageModel.getById(messageId);
    if (!message) throw { status: 404, message: 'Message not found' };

    const channel = ChannelModel.getById(message.channel_id);
    assertChannelAccess(channel, user);

    const result = VoteModel.cast({
      userId: user.id, targetType: 'MESSAGE', targetId: messageId, value
    });
    broadcastToChannel(channel, {
      type: 'vote', targetType: 'MESSAGE', targetId: messageId, messageId, score: result.score
    });
    return result;
  },

  postMessage(user, channelId, content) {
    const channel = ChannelModel.getById(channelId);
    assertChannelAccess(channel, user);
    if (channel.is_archived) {
      throw { status: 409, message: 'This workspace is archived — the conversation is kept, but it is read-only now' };
    }
    if (channel.type === 'announcement' && !hasRole(user, MANAGE_ROLES)) {
      throw { status: 403, message: 'Only leaders, teachers, or admins can post in announcement channels' };
    }
    const message = MessageModel.create({ channelId, userId: user.id, content });
    broadcastToChannel(channel, { type: 'message', action: 'created', channelId, message });
    notifyMentions({ channel, message, author: user, content });
    // Keeps a conversation at the top of its list and drives unread state.
    ConversationService.noteMessage(channelId, message.created_at);

    // Mirror to Discord when this channel is mapped. Deliberately not awaited
    // and never fatal: the message is already saved and delivered to Forge
    // clients, so a Discord outage must not fail the request or lose the post.
    const mapped = DiscordMap.channelForReference('public', channelId)
      || DiscordMap.channelByDiscordId(channel.discord_channel_id || '');
    if (mapped?.discord_channel_id) {
      MessageRelay.relay({
        user,
        discordChannelId: mapped.discord_channel_id,
        content,
        sentAt: message.created_at
      }).catch(() => {});
    }

    return message;
  },

  /**
   * Pin a message. Leaders, teachers and admins only — the spec routes pins
   * through the Admin Bot, which is the one holding ManageMessages, and a
   * member has no way to pin on either side.
   */
  pin(user, messageId) {
    const message = MessageModel.getById(messageId);
    if (!message) throw { status: 404, message: 'Message not found' };
    const channel = ChannelModel.getById(message.channel_id);
    assertChannelAccess(channel, user);
    if (!hasRole(user, MANAGE_ROLES)) {
      throw { status: 403, message: 'Only leaders, teachers and admins can pin a message' };
    }

    db.prepare(
      `INSERT OR IGNORE INTO message_pins (id, message_id, channel_id, pinned_by)
       VALUES (?, ?, ?, ?)`
    ).run(genId('pin'), messageId, message.channel_id, user.id);

    broadcastToChannel(channel, { type: 'message', action: 'pinned', channelId: channel.id, messageId });
    return this.pins(user, channel.id);
  },

  unpin(user, messageId) {
    const message = MessageModel.getById(messageId);
    if (!message) throw { status: 404, message: 'Message not found' };
    const channel = ChannelModel.getById(message.channel_id);
    assertChannelAccess(channel, user);
    if (!hasRole(user, MANAGE_ROLES)) {
      throw { status: 403, message: 'Only leaders, teachers and admins can unpin a message' };
    }
    db.prepare(`DELETE FROM message_pins WHERE message_id = ?`).run(messageId);
    broadcastToChannel(channel, { type: 'message', action: 'unpinned', channelId: channel.id, messageId });
    return this.pins(user, channel.id);
  },

  pins(user, channelId) {
    const channel = ChannelModel.getById(channelId);
    assertChannelAccess(channel, user);
    return {
      pins: db
        .prepare(
          `SELECT m.id, m.content, m.created_at, u.name AS user_name,
                  p.pinned_at, pu.name AS pinned_by_name
           FROM message_pins p
           JOIN messages m ON m.id = p.message_id
           LEFT JOIN users u ON u.id = m.user_id
           LEFT JOIN users pu ON pu.id = p.pinned_by
           WHERE p.channel_id = ?
           ORDER BY p.pinned_at DESC`
        )
        .all(channelId),
      canPin: hasRole(user, MANAGE_ROLES)
    };
  },

  /** Search inside one channel the user can already read. */
  search(user, channelId, query, { limit = 30 } = {}) {
    const channel = ChannelModel.getById(channelId);
    assertChannelAccess(channel, user);
    const term = String(query || '').trim();
    if (term.length < 2) {
      throw { status: 400, message: 'Search for at least two characters' };
    }
    // LIKE rather than the FTS index: that index covers tasks, threads and
    // announcements, and adding private conversation content to a corpus other
    // queries read would be a leak waiting to happen.
    return db
      .prepare(
        `SELECT m.id, m.content, m.created_at, u.name AS user_name
         FROM messages m LEFT JOIN users u ON u.id = m.user_id
         WHERE m.channel_id = ? AND m.content LIKE ? ESCAPE '\\'
         ORDER BY m.created_at DESC
         LIMIT ?`
      )
      .all(channelId, `%${term.replace(/[\\%_]/g, '\\$&')}%`, Math.min(limit, 100));
  },

  editMessage(user, messageId, content) {
    const message = MessageModel.getById(messageId);
    if (!message) {
      throw { status: 404, message: 'Message not found' };
    }
    if (message.user_id !== user.id) {
      throw { status: 403, message: 'Only the author can edit a message' };
    }
    const updated = MessageModel.update(messageId, content);
    const channel = ChannelModel.getById(message.channel_id);
    broadcastToChannel(channel, {
      type: 'message',
      action: 'updated',
      channelId: message.channel_id,
      message: updated
    });
    return updated;
  },

  deleteMessage(user, messageId) {
    const message = MessageModel.getById(messageId);
    if (!message) {
      throw { status: 404, message: 'Message not found' };
    }
    if (message.user_id !== user.id && !hasRole(user, ['admin'])) {
      throw { status: 403, message: 'Only the author or an admin can delete a message' };
    }
    MessageModel.delete(messageId);
    const channel = ChannelModel.getById(message.channel_id);
    broadcastToChannel(channel, {
      type: 'message',
      action: 'deleted',
      channelId: message.channel_id,
      message: { id: messageId }
    });
    return { success: true, id: messageId };
  }
};
