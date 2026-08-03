import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import supertest from 'supertest';
import bcrypt from 'bcryptjs';
import { app } from '../src/server/app.js';
import { db, initSchema } from '../src/server/db/database.js';

describe('Message reactions and votes', () => {
  let aliceToken, bobToken, channelId, messageId;

  before(async () => {
    initSchema();
    const passHash = bcrypt.hashSync('pass123', 10);
    const insert = db.prepare(`
      INSERT OR REPLACE INTO users (id, name, username, email, password_hash, role, tag)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    insert.run('u_rx_a', 'Alice React', 'rx_alice', 'rxa@forge.local', passHash, 'member', 'Member');
    insert.run('u_rx_b', 'Bob React', 'rx_bob', 'rxb@forge.local', passHash, 'member', 'Member');

    db.prepare(`
      INSERT OR REPLACE INTO channels (id, name, type, is_private)
      VALUES ('chn_rx', 'reactions', 'text', 0)
    `).run();
    channelId = 'chn_rx';

    const login = async (id) => {
      const res = await supertest(app).post('/api/auth/login').send({ identifier: id, password: 'pass123' });
      assert.equal(res.status, 200);
      return res.body.token;
    };
    aliceToken = await login('rx_alice');
    bobToken = await login('rx_bob');

    const sent = await supertest(app)
      .post(`/api/channels/${channelId}/messages`)
      .set('Authorization', `Bearer ${aliceToken}`)
      .send({ content: 'Reaction target' });
    assert.equal(sent.status, 201);
    messageId = sent.body.message.id;
  });

  it('requires auth to react', async () => {
    const res = await supertest(app).post(`/api/messages/${messageId}/reactions`).send({ emoji: '🔥' });
    assert.equal(res.status, 401);
  });

  it('adds a reaction and marks it as the caller’s own', async () => {
    const res = await supertest(app)
      .post(`/api/messages/${messageId}/reactions`)
      .set('Authorization', `Bearer ${aliceToken}`)
      .send({ emoji: '🔥' });
    assert.equal(res.status, 200);
    assert.deepEqual(res.body.reactions, [{ emoji: '🔥', count: 1, mine: true }]);
  });

  it('toggles the same emoji off on a second call', async () => {
    await supertest(app)
      .post(`/api/messages/${messageId}/reactions`)
      .set('Authorization', `Bearer ${aliceToken}`)
      .send({ emoji: '👍' });
    const off = await supertest(app)
      .post(`/api/messages/${messageId}/reactions`)
      .set('Authorization', `Bearer ${aliceToken}`)
      .send({ emoji: '👍' });
    assert.equal(off.body.reactions.some((r) => r.emoji === '👍'), false);
  });

  it('counts separate users once each and scopes "mine" per viewer', async () => {
    await supertest(app)
      .post(`/api/messages/${messageId}/reactions`)
      .set('Authorization', `Bearer ${bobToken}`)
      .send({ emoji: '🔥' });

    const asBob = await supertest(app)
      .post(`/api/messages/${messageId}/reactions`)
      .set('Authorization', `Bearer ${bobToken}`)
      .send({ emoji: '🎉' });
    const fire = asBob.body.reactions.find((r) => r.emoji === '🔥');
    assert.equal(fire.count, 2, 'both users reacted with fire');
    assert.equal(fire.mine, true, 'bob reacted with fire');

    const list = await supertest(app)
      .get(`/api/channels/${channelId}/messages`)
      .set('Authorization', `Bearer ${aliceToken}`);
    const target = list.body.messages.find((m) => m.id === messageId);
    const asAlice = target.reactions.find((r) => r.emoji === '🔥');
    assert.equal(asAlice.count, 2);
    assert.equal(asAlice.mine, true);
    assert.equal(target.reactions.find((r) => r.emoji === '🎉').mine, false, 'alice did not send the party emoji');
  });

  it('rejects emoji outside the allowlist', async () => {
    for (const emoji of ['<script>', '🦄', 'x'.repeat(100), '']) {
      const res = await supertest(app)
        .post(`/api/messages/${messageId}/reactions`)
        .set('Authorization', `Bearer ${aliceToken}`)
        .send({ emoji });
      assert.ok(res.status >= 400 && res.status < 500, `${JSON.stringify(emoji)} should be rejected, got ${res.status}`);
    }
  });

  it('exposes the allowlist so the client picker cannot drift', async () => {
    const res = await supertest(app)
      .get('/api/reactions/available')
      .set('Authorization', `Bearer ${aliceToken}`);
    assert.equal(res.status, 200);
    assert.ok(res.body.emoji.includes('🔥'));
  });

  it('records votes and lets a repeat vote clear itself', async () => {
    const up = await supertest(app)
      .post(`/api/messages/${messageId}/vote`)
      .set('Authorization', `Bearer ${aliceToken}`)
      .send({ value: 1 });
    assert.equal(up.body.score, 1);

    const down = await supertest(app)
      .post(`/api/messages/${messageId}/vote`)
      .set('Authorization', `Bearer ${bobToken}`)
      .send({ value: -1 });
    assert.equal(down.body.score, 0, 'one up and one down cancel out');

    // Re-sending the same value is the "unvote" gesture.
    const cleared = await supertest(app)
      .post(`/api/messages/${messageId}/vote`)
      .set('Authorization', `Bearer ${aliceToken}`)
      .send({ value: 1 });
    assert.equal(cleared.body.value, 0, 'a repeat upvote clears it');
    assert.equal(cleared.body.score, -1, 'leaving only the downvote');
  });

  it('returns each viewer’s own vote with the message list', async () => {
    const res = await supertest(app)
      .get(`/api/channels/${channelId}/messages`)
      .set('Authorization', `Bearer ${bobToken}`);
    const target = res.body.messages.find((m) => m.id === messageId);
    assert.equal(target.score, -1);
    assert.equal(target.my_vote, -1);
  });

  it('rejects a vote value that is not -1, 0 or 1', async () => {
    for (const value of [5, -3, 'up', null, 0]) {
      const res = await supertest(app)
        .post(`/api/messages/${messageId}/vote`)
        .set('Authorization', `Bearer ${aliceToken}`)
        .send({ value });
      assert.ok(res.status >= 400 && res.status < 500, `value ${value} should be rejected`);
    }
  });
});
