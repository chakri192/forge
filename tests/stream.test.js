import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import supertest from 'supertest';
import bcrypt from 'bcryptjs';
import { app } from '../src/server/app.js';
import { db, initSchema } from '../src/server/db/database.js';

describe('SSE stream: /api/stream', () => {
  let server, baseUrl;
  let aliceToken, bobToken;
  let channelId;

  before(async () => {
    initSchema();
    const passHash = bcrypt.hashSync('pass123', 10);
    const insertUser = db.prepare(`
      INSERT OR REPLACE INTO users (id, name, username, email, password_hash, role, tag)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    insertUser.run('u_sse_alice', 'Sse Alice', 'sse_alice', 'sse_alice@forge.local', passHash, 'member', 'Member');
    insertUser.run('u_sse_bob', 'Sse Bob', 'sse_bob', 'sse_bob@forge.local', passHash, 'leader', 'Leader');

    const login = async (identifier) => {
      const res = await supertest(app).post('/api/auth/login').send({ identifier, password: 'pass123' });
      assert.equal(res.status, 200);
      return res.body.token;
    };
    aliceToken = await login('sse_alice');
    bobToken = await login('sse_bob');

    const channel = await supertest(app)
      .post('/api/channels')
      .set('Authorization', `Bearer ${bobToken}`)
      .send({ name: 'sse-room' });
    assert.equal(channel.status, 201);
    channelId = channel.body.channel.id;

    server = app.listen(0);
    baseUrl = `http://127.0.0.1:${server.address().port}`;
  });

  after(() => {
    server.close();
  });

  function sseReader(body) {
    const reader = body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    const queue = [];
    return {
      async next(predicate, timeoutMs = 5000) {
        const timer = setTimeout(() => reader.cancel(), timeoutMs);
        try {
          while (true) {
            while (queue.length > 0) {
              const event = queue.shift();
              if (predicate(event)) return event;
            }
            const { value, done } = await reader.read();
            if (done) throw new Error('Stream ended before the expected SSE event arrived');
            buffer += decoder.decode(value, { stream: true });
            const parts = buffer.split('\n\n');
            buffer = parts.pop();
            for (const part of parts) {
              if (part.startsWith('data: ')) queue.push(JSON.parse(part.slice(6)));
            }
          }
        } finally {
          clearTimeout(timer);
        }
      },
      cancel: () => reader.cancel()
    };
  }

  it('rejects unauthenticated stream connections (401)', async () => {
    const res = await supertest(app).get('/api/stream');
    assert.equal(res.status, 401);
  });

  it('delivers connected, message, and notification events', async () => {
    const res = await fetch(`${baseUrl}/api/stream?token=${encodeURIComponent(aliceToken)}`);
    assert.equal(res.status, 200);
    assert.match(res.headers.get('content-type'), /text\/event-stream/);
    const stream = sseReader(res.body);

    const connected = await stream.next((e) => e.type === 'connected');
    assert.equal(connected.userId, 'u_sse_alice');

    const sent = await supertest(app)
      .post(`/api/channels/${channelId}/messages`)
      .set('Authorization', `Bearer ${bobToken}`)
      .send({ content: 'realtime hello' });
    assert.equal(sent.status, 201);

    const messageEvent = await stream.next((e) => e.type === 'message');
    assert.equal(messageEvent.action, 'created');
    assert.equal(messageEvent.channelId, channelId);
    assert.equal(messageEvent.message.content, 'realtime hello');
    assert.equal(messageEvent.message.user_name, 'Sse Bob');

    const published = await supertest(app)
      .post('/api/announcements')
      .set('Authorization', `Bearer ${bobToken}`)
      .send({ title: 'Realtime announcement', content: 'Delivered over SSE' });
    assert.equal(published.status, 201);

    const notificationEvent = await stream.next((e) => e.type === 'notification');
    assert.ok(notificationEvent.notification.title.includes('Realtime announcement'));

    await stream.cancel();
  });
});
