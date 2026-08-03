import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { io as connect } from 'socket.io-client';
import { app } from '../src/server/app.js';
import { db, initSchema } from '../src/server/db/database.js';
import { generateToken } from '../src/server/utils/jwt.js';
import { attachChatSocket, closeChatSocket, pushToChannel } from '../src/server/services/discord/chatSocket.js';
import { DiscordMap } from '../src/server/models/DiscordMap.js';

describe('Chat socket', () => {
  let server;
  let url;
  let insiderToken;
  let outsiderToken;

  const open = (auth) =>
    new Promise((resolve, reject) => {
      const socket = connect(`${url}/chat`, { auth, transports: ['websocket'], reconnection: false });
      socket.on('connect', () => resolve(socket));
      socket.on('connect_error', (err) => reject(err));
      setTimeout(() => reject(new Error('timeout')), 3000);
    });

  before(async () => {
    initSchema();
    const insert = db.prepare(`
      INSERT OR REPLACE INTO users (id, name, username, email, password_hash, role, tag)
      VALUES (?, ?, ?, ?, 'x', 'member', 'Member')
    `);
    insert.run('u_sock_in', 'Insider', 'sock_in', 'si@forge.local');
    insert.run('u_sock_out', 'Outsider', 'sock_out', 'so@forge.local');
    insiderToken = generateToken({ id: 'u_sock_in', role: 'member', username: 'sock_in' });
    outsiderToken = generateToken({ id: 'u_sock_out', role: 'member', username: 'sock_out' });

    db.prepare(`DELETE FROM discord_channel_map WHERE discord_channel_id = 'sock_dm'`).run();
    db.prepare(`DELETE FROM discord_dm_participants WHERE discord_channel_id = 'sock_dm'`).run();
    DiscordMap.upsertChannel({ discordChannelId: 'sock_dm', type: 'private_dm', name: 'dm' });
    DiscordMap.addDmParticipant('sock_dm', 'u_sock_in');
    DiscordMap.upsertChannel({ discordChannelId: 'sock_pub', type: 'public', name: 'general' });

    server = http.createServer(app);
    attachChatSocket(server);
    await new Promise((r) => server.listen(0, r));
    url = `http://localhost:${server.address().port}`;
  });

  after(async () => {
    closeChatSocket();
    await new Promise((r) => server.close(r));
  });

  it('refuses a connection with no token', async () => {
    await assert.rejects(() => open({}), /unauthorised/);
  });

  it('refuses a connection with a forged token', async () => {
    await assert.rejects(() => open({ token: 'not.a.real.token' }), /unauthorised/);
  });

  it('accepts a valid token', async () => {
    const socket = await open({ token: insiderToken });
    assert.equal(socket.connected, true);
    socket.close();
  });

  it('lets a participant join their private channel', async () => {
    const socket = await open({ token: insiderToken });
    const ack = await socket.emitWithAck('join', 'sock_dm');
    assert.deepEqual(ack, { ok: true });
    socket.close();
  });

  it('refuses a non-participant joining a private channel', async () => {
    // Without this, "join" would be an unauthenticated read of any conversation.
    const socket = await open({ token: outsiderToken });
    const ack = await socket.emitWithAck('join', 'sock_dm');
    assert.equal(ack.ok, false);
    assert.equal(ack.reason, 'forbidden');
    socket.close();
  });

  it('refuses an unknown channel', async () => {
    const socket = await open({ token: insiderToken });
    const ack = await socket.emitWithAck('join', 'no_such_channel');
    assert.equal(ack.reason, 'unknown_channel');
    socket.close();
  });

  it('lets anyone join a public channel', async () => {
    const socket = await open({ token: outsiderToken });
    const ack = await socket.emitWithAck('join', 'sock_pub');
    assert.deepEqual(ack, { ok: true });
    socket.close();
  });

  it('delivers a message only to sockets in that channel', async () => {
    const inside = await open({ token: insiderToken });
    const outside = await open({ token: outsiderToken });
    await inside.emitWithAck('join', 'sock_dm');
    await outside.emitWithAck('join', 'sock_pub');

    const received = new Promise((resolve) => inside.once('message', resolve));
    let leaked = false;
    outside.once('message', () => { leaked = true; });

    pushToChannel('sock_dm', { content: 'private words' });
    const payload = await received;

    assert.equal(payload.content, 'private words');
    await new Promise((r) => setTimeout(r, 150));
    assert.equal(leaked, false, 'a socket outside the room must not receive it');

    inside.close();
    outside.close();
  });
});
