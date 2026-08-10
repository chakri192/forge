import { ConversationModel, pairKey } from '../models/Conversation.js';
import { ChannelModel } from '../models/Channel.js';
import { MessageModel } from '../models/Message.js';
import { NotificationService } from './notification.js';
import { publish } from './sse.js';
import { db } from '../db/database.js';
import { nowIso } from '../utils/genId.js';

const MAX_GROUP = 25;

/**
 * Direct messages and group conversations.
 *
 * Everything here rides on an ordinary private channel, so reactions,
 * @mentions, editing, SSE and the Discord relay all work unchanged.
 *
 * One thing these are NOT is secret. When the Discord bridge is on, a
 * conversation is mirrored into a Discord channel, where both bots, every admin
 * of that server, and Discord itself can read it. The UI says so out loud; see
 * DISCORD_VISIBILITY_NOTE.
 */
export const DISCORD_VISIBILITY_NOTE =
  'Messages here are mirrored to the cohort Discord server, where server admins can read them. Do not share anything you would not post in a channel.';

function assertParticipant(conversationId, userId) {
  if (!ConversationModel.isParticipant(conversationId, userId)) {
    // 404 rather than 403: confirming a conversation exists tells an outsider
    // that two particular people are talking.
    throw { status: 404, message: 'Conversation not found' };
  }
}

function realUser(userId) {
  return db.prepare(`SELECT id, name, username, role FROM users WHERE id = ?`).get(userId) || null;
}

export const ConversationService = {
  list(user) {
    return {
      conversations: ConversationModel.listFor(user.id),
      visibilityNote: DISCORD_VISIBILITY_NOTE
    };
  },

  /** Opens the thread with one other person, reusing it if it already exists. */
  openDirect(user, otherUserId) {
    if (otherUserId === user.id) {
      throw { status: 400, message: 'You cannot start a conversation with yourself' };
    }
    const other = realUser(otherUserId);
    if (!other) throw { status: 404, message: 'That person could not be found' };
    if (other.role === 'DEV_STEALTH') {
      // Same reasoning as mentions: a stealth account must not be discoverable.
      throw { status: 404, message: 'That person could not be found' };
    }

    const existing = ConversationModel.findPair(user.id, otherUserId);
    if (existing) return this.detail(user, existing.id);

    const conversation = ConversationModel.create({
      kind: 'dm',
      createdBy: user.id,
      memberIds: [user.id, otherUserId],
      key: pairKey(user.id, otherUserId)
    });
    return this.detail(user, conversation.id);
  },

  createGroup(user, { title, memberIds }) {
    const unique = [...new Set([user.id, ...(memberIds || [])])];
    if (unique.length < 3) {
      throw { status: 400, message: 'A group needs at least two other people — use a direct message otherwise' };
    }
    if (unique.length > MAX_GROUP) {
      throw { status: 400, message: `A group tops out at ${MAX_GROUP} people` };
    }

    const found = db
      .prepare(
        `SELECT id FROM users WHERE id IN (${unique.map(() => '?').join(',')}) AND role != 'DEV_STEALTH'`
      )
      .all(...unique)
      .map((r) => r.id);
    if (found.length !== unique.length) {
      throw { status: 400, message: 'One of those people could not be found' };
    }

    const conversation = ConversationModel.create({
      kind: 'group',
      title: String(title || '').trim() || 'Group',
      createdBy: user.id,
      memberIds: unique
    });

    for (const memberId of unique.filter((id) => id !== user.id)) {
      NotificationService.createNotification({
        userId: memberId,
        title: `${user.name} added you to ${conversation.title}`,
        message: 'Open Messages to join the conversation.',
        type: 'INFO',
        link: `#/messages/${conversation.channel_id}`
      });
    }

    return this.detail(user, conversation.id);
  },

  detail(user, conversationId) {
    assertParticipant(conversationId, user.id);
    const conversation = ConversationModel.getById(conversationId);
    const participants = ConversationModel.participants(conversationId);
    const others = participants.filter((p) => p.id !== user.id);
    return {
      conversation: {
        ...conversation,
        title: conversation.title || others.map((p) => p.name).join(', ') || 'Empty conversation',
        participants
      },
      visibilityNote: DISCORD_VISIBILITY_NOTE
    };
  },

  messages(user, conversationId, { limit = 50 } = {}) {
    assertParticipant(conversationId, user.id);
    const conversation = ConversationModel.getById(conversationId);
    ConversationModel.markRead(conversationId, user.id);
    return { messages: MessageModel.getByChannel(conversation.channel_id, { limit }) };
  },

  /**
   * Adding someone to a group shows them everything already said. That is the
   * behaviour people expect from a group chat, but it is worth being explicit
   * that it is a disclosure.
   */
  addMembers(user, conversationId, memberIds) {
    assertParticipant(conversationId, user.id);
    const conversation = ConversationModel.getById(conversationId);
    if (conversation.kind !== 'group') {
      throw { status: 400, message: 'A direct message is between two people — start a group instead' };
    }
    const current = ConversationModel.participants(conversationId).length;
    const adding = [...new Set(memberIds)].filter(
      (id) => !ConversationModel.isParticipant(conversationId, id)
    );
    if (current + adding.length > MAX_GROUP) {
      throw { status: 400, message: `A group tops out at ${MAX_GROUP} people` };
    }

    ConversationModel.addParticipants(conversationId, adding);
    for (const memberId of adding) {
      NotificationService.createNotification({
        userId: memberId,
        title: `${user.name} added you to ${conversation.title || 'a group'}`,
        message: 'You can see the messages sent before you joined.',
        type: 'INFO',
        link: `#/messages/${conversation.channel_id}`
      });
    }
    return this.detail(user, conversationId);
  },

  leave(user, conversationId) {
    assertParticipant(conversationId, user.id);
    const conversation = ConversationModel.getById(conversationId);
    if (conversation.kind === 'dm') {
      throw { status: 400, message: 'A direct message cannot be left — it is only ever the two of you' };
    }
    ConversationModel.removeParticipant(conversationId, user.id);
    return { left: true };
  },

  /**
   * Called by the message service after a message lands in a conversation's
   * channel, so ordering and unread state stay correct without the composer
   * needing to know it is in a conversation.
   */
  noteMessage(channelId, at = nowIso()) {
    const conversation = ConversationModel.byChannelId(channelId);
    if (!conversation) return null;
    ConversationModel.touch(conversation.id, at);
    return conversation;
  },

  /** Who a message in this channel should be delivered to over SSE. */
  audience(channelId) {
    const conversation = ConversationModel.byChannelId(channelId);
    if (!conversation) return null;
    return ConversationModel.participants(conversation.id).map((p) => p.id);
  },

  /** Whether a private channel is one this user is a participant of. */
  canAccessChannel(channelId, userId) {
    const conversation = ConversationModel.byChannelId(channelId);
    if (!conversation) return false;
    return ConversationModel.isParticipant(conversation.id, userId);
  },

  notifyOthers({ channelId, author, content }) {
    const conversation = ConversationModel.byChannelId(channelId);
    if (!conversation) return;
    const others = ConversationModel.participants(conversation.id).filter((p) => p.id !== author.id);
    for (const person of others) {
      publish(person.id, { type: 'conversation', action: 'message', channelId });
    }
    void content;
  },

  channelIdFor(conversationId) {
    return ConversationModel.getById(conversationId)?.channel_id || null;
  }
};
