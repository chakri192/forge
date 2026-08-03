import { Server } from 'socket.io';
import { verifyToken } from '../../utils/jwt.js';
import { DiscordMap } from '../../models/DiscordMap.js';
import { logger } from '../../utils/logger.js';

let io = null;

/**
 * Real-time delivery for chat, on the /chat namespace.
 *
 * A socket is authenticated before it joins anything, and a client may only
 * join rooms for channels it is a participant of — otherwise "join this room"
 * would be an unauthenticated read of any conversation on the server.
 */
export function attachChatSocket(httpServer) {
  io = new Server(httpServer, { path: '/socket.io' });

  const chat = io.of('/chat');

  chat.use((socket, next) => {
    const token = socket.handshake.auth?.token || socket.handshake.query?.token;
    if (!token) return next(new Error('unauthorised'));
    // verifyToken returns null for a bad token rather than throwing, so a
    // try/catch alone would let a forged token through with user = null.
    const user = verifyToken(token);
    if (!user?.id) return next(new Error('unauthorised'));
    socket.data.user = user;
    next();
  });

  chat.on('connection', (socket) => {
    const userId = socket.data.user?.id;
    // A per-user room means a notification can reach someone without knowing
    // which conversation they happen to have open.
    if (userId) socket.join(`user:${userId}`);

    socket.on('join', (discordChannelId, ack) => {
      const mapped = DiscordMap.channelByDiscordId(discordChannelId);
      if (!mapped) return ack?.({ ok: false, reason: 'unknown_channel' });

      const isPrivate = ['private_dm', 'group', 'team_chat'].includes(mapped.forge_channel_type);
      if (isPrivate && !DiscordMap.isParticipant(discordChannelId, userId)) {
        return ack?.({ ok: false, reason: 'forbidden' });
      }
      socket.join(`channel:${discordChannelId}`);
      ack?.({ ok: true });
    });

    socket.on('leave', (discordChannelId) => socket.leave(`channel:${discordChannelId}`));
  });

  logger.info('chat_socket_ready', { namespace: '/chat' });
  return io;
}

/** Push a message to everyone watching a channel. No-op before attach. */
export function pushToChannel(discordChannelId, payload) {
  if (!io) return false;
  io.of('/chat').to(`channel:${discordChannelId}`).emit('message', payload);
  return true;
}

export function pushToUser(userId, event, payload) {
  if (!io) return false;
  io.of('/chat').to(`user:${userId}`).emit(event, payload);
  return true;
}

export function closeChatSocket() {
  if (io) io.close();
  io = null;
}
