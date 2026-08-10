import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import supertest from 'supertest';
import bcrypt from 'bcryptjs';
import { app } from '../src/server/app.js';
import { db, initSchema } from '../src/server/db/database.js';

/**
 * Direct messages and groups.
 *
 * A conversation rides on an ordinary private channel, which is convenient but
 * means every existing "is this channel public?" branch is a potential leak.
 * Most of these tests exist to hold those shut.
 */
describe('Conversations', () => {
  let aliceToken, bobToken, malloryToken, adminToken;

  const login = async (identifier, password = 'pass123') =>
    (await supertest(app).post('/api/auth/login').send({ identifier, password })).body.token;

  before(async () => {
    initSchema();
    const hash = bcrypt.hashSync('pass123', 10);
    const insert = db.prepare(`
      INSERT OR REPLACE INTO users (id, name, username, email, password_hash, role, tag)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    insert.run('u_cv_a', 'Alice Conv', 'cv_alice', 'cva@forge.local', hash, 'member', 'Member');
    insert.run('u_cv_b', 'Bob Conv', 'cv_bob', 'cvb@forge.local', hash, 'member', 'Member');
    insert.run('u_cv_m', 'Mallory Conv', 'cv_mallory', 'cvm@forge.local', hash, 'member', 'Member');
    insert.run('u_cv_c', 'Carol Conv', 'cv_carol', 'cvc@forge.local', hash, 'member', 'Member');
    insert.run('u_cv_admin', 'Conv Admin', 'cv_admin', 'cvad@forge.local', hash, 'admin', 'Admin');
    insert.run('u_cv_dev', 'Conv Dev', 'cv_dev', 'cvd@forge.local', hash, 'DEV_STEALTH', 'Ops');

    aliceToken = await login('cv_alice');
    bobToken = await login('cv_bob');
    malloryToken = await login('cv_mallory');
    adminToken = await login('cv_admin');
  });

  const as = (token, method, path) =>
    supertest(app)[method](path).set('Authorization', `Bearer ${token}`);

  const openDm = (token, userId) => as(token, 'post', '/api/conversations/direct').send({ userId });

  describe('direct messages', () => {
    it('opens a thread between two people', async () => {
      const res = await openDm(aliceToken, 'u_cv_b');
      assert.equal(res.status, 201);
      assert.equal(res.body.conversation.kind, 'dm');
      assert.deepEqual(
        res.body.conversation.participants.map((p) => p.username).sort(),
        ['cv_alice', 'cv_bob']
      );
    });

    it('reuses the same thread rather than opening a second', async () => {
      const first = await openDm(aliceToken, 'u_cv_b');
      const again = await openDm(aliceToken, 'u_cv_b');
      const reversed = await openDm(bobToken, 'u_cv_a');
      assert.equal(again.body.conversation.id, first.body.conversation.id);
      assert.equal(reversed.body.conversation.id, first.body.conversation.id, 'order of the pair must not matter');
    });

    it('refuses a conversation with yourself', async () => {
      const res = await openDm(aliceToken, 'u_cv_a');
      assert.equal(res.status, 400);
    });

    it('will not open one with a stealth account', async () => {
      const res = await openDm(aliceToken, 'u_cv_dev');
      assert.equal(res.status, 404, 'a stealth account must not be discoverable');
    });

    it('cannot be left — it is only ever the two of you', async () => {
      const { body } = await openDm(aliceToken, 'u_cv_b');
      const res = await as(aliceToken, 'post', `/api/conversations/${body.conversation.id}/leave`);
      assert.equal(res.status, 400);
    });
  });

  describe('keeping outsiders out', () => {
    let convId, channelId;

    before(async () => {
      const { body } = await openDm(aliceToken, 'u_cv_b');
      convId = body.conversation.id;
      channelId = body.conversation.channel_id;
      await as(aliceToken, 'post', `/api/channels/${channelId}/messages`).send({ content: 'just between us' });
    });

    it('answers 404 to a non-participant, not 403', async () => {
      const res = await as(malloryToken, 'get', `/api/conversations/${convId}`);
      // A 403 would confirm these two are talking, which is the disclosure.
      assert.equal(res.status, 404);
    });

    it('refuses the messages to a non-participant', async () => {
      const res = await as(malloryToken, 'get', `/api/conversations/${convId}/messages`);
      assert.equal(res.status, 404);
      assert.equal(/just between us/.test(JSON.stringify(res.body)), false);
    });

    it('refuses the underlying channel to a non-participant', async () => {
      // The conversation rides on a real channel; reaching it directly must
      // not be a way around the participant check.
      const res = await as(malloryToken, 'get', `/api/channels/${channelId}/messages`);
      assert.ok(res.status === 403 || res.status === 404, `got ${res.status}`);
      assert.equal(/just between us/.test(JSON.stringify(res.body)), false);
    });

    it('will not let a non-participant post into it', async () => {
      const res = await as(malloryToken, 'post', `/api/channels/${channelId}/messages`).send({ content: 'hello?' });
      assert.ok(res.status === 403 || res.status === 404, `got ${res.status}`);
    });

    it('keeps conversations out of the public channel list', async () => {
      const res = await as(malloryToken, 'get', '/api/channels');
      const ids = (res.body.channels || res.body).map((c) => c.id);
      assert.equal(ids.includes(channelId), false, 'a conversation must not appear as a channel');
    });

    it('lists a conversation only to its participants', async () => {
      const mine = await as(aliceToken, 'get', '/api/conversations');
      const theirs = await as(malloryToken, 'get', '/api/conversations');
      assert.ok(mine.body.conversations.some((c) => c.id === convId));
      assert.equal(theirs.body.conversations.some((c) => c.id === convId), false);
    });
  });

  describe('groups', () => {
    it('needs at least three people', async () => {
      const res = await as(aliceToken, 'post', '/api/conversations/group')
        .send({ title: 'Too small', memberIds: ['u_cv_b'] });
      assert.equal(res.status, 400);
    });

    it('creates a group and tells the people added', async () => {
      const res = await as(aliceToken, 'post', '/api/conversations/group')
        .send({ title: 'Project Vega', memberIds: ['u_cv_b', 'u_cv_c'] });
      assert.equal(res.status, 201);
      assert.equal(res.body.conversation.kind, 'group');
      assert.equal(res.body.conversation.title, 'Project Vega');

      const note = db
        .prepare(`SELECT title FROM notifications WHERE user_id = 'u_cv_c' ORDER BY rowid DESC LIMIT 1`)
        .get();
      assert.match(note.title, /added you to Project Vega/);
    });

    it('lets a member leave', async () => {
      const { body } = await as(aliceToken, 'post', '/api/conversations/group')
        .send({ title: 'Leavers', memberIds: ['u_cv_b', 'u_cv_c'] });
      const res = await as(bobToken, 'post', `/api/conversations/${body.conversation.id}/leave`);
      assert.equal(res.status, 200);

      const after = await as(bobToken, 'get', `/api/conversations/${body.conversation.id}`);
      assert.equal(after.status, 404, 'leaving means losing access');
    });

    it('will not let a non-member add people', async () => {
      const { body } = await as(aliceToken, 'post', '/api/conversations/group')
        .send({ title: 'Closed', memberIds: ['u_cv_b', 'u_cv_c'] });
      const res = await as(malloryToken, 'post', `/api/conversations/${body.conversation.id}/members`)
        .send({ memberIds: ['u_cv_m'] });
      assert.equal(res.status, 404);
    });
  });

  it('states plainly that Discord admins can read these', async () => {
    // The bridge mirrors conversations into Discord, where server admins can
    // read them. Calling that "private" without saying so would be a promise
    // the product cannot keep.
    const res = await as(aliceToken, 'get', '/api/conversations');
    assert.match(res.body.visibilityNote, /Discord/);
    assert.match(res.body.visibilityNote, /admins can read/i);
  });

  it('does not hand an admin somebody else\'s conversation', async () => {
    const { body } = await openDm(aliceToken, 'u_cv_b');
    const res = await as(adminToken, 'get', `/api/conversations/${body.conversation.id}`);
    // Being a Forge admin is not the same as being in the room. Discord admins
    // can read the mirror; that is disclosed, and is not a reason to open the
    // Forge-side API to everyone with a role.
    assert.equal(res.status, 404);
  });
});
