import { ChannelModel } from '../models/Channel.js';
import { MessageModel } from '../models/Message.js';
import { hasRole } from '../middleware/rbac.js';
import { ActivityService } from './activity.js';
import { publish, publishAll } from './sse.js';
import { ReactionModel, isAllowedEmoji } from '../models/Reaction.js';
import { VoteModel } from '../models/Vote.js';

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
    throw { status: 403, message: 'Forbidden: this channel is private' };
  }
}

function broadcastToChannel(channel, event) {
  if (channel.is_private && channel.team_id) {
    publish(ChannelModel.getTeamMemberIds(channel.team_id), event);
  } else {
    publishAll(event);
  }
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
    if (channel.type === 'announcement' && !hasRole(user, MANAGE_ROLES)) {
      throw { status: 403, message: 'Only leaders, teachers, or admins can post in announcement channels' };
    }
    const message = MessageModel.create({ channelId, userId: user.id, content });
    broadcastToChannel(channel, { type: 'message', action: 'created', channelId, message });
    return message;
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
