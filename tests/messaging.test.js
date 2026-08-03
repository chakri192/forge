import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import supertest from 'supertest';
import bcrypt from 'bcryptjs';
import { app } from '../src/server/app.js';
import { db, initSchema } from '../src/server/db/database.js';

describe('Messaging: channels and messages', () => {
  let memberToken, leaderToken, adminToken, outsiderToken;
  let publicChannelId, teamChannelId, messageId;

  before(async () => {
    initSchema();
    const passHash = bcrypt.hashSync('pass123', 10);
    const insertUser = db.prepare(`
      INSERT OR REPLACE INTO users (id, name, username, email, password_hash, role, tag)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    insertUser.run('u_msg_member', 'Msg Member', 'msg_member', 'msg_member@forge.local', passHash, 'member', 'Member');
    insertUser.run('u_msg_leader', 'Msg Leader', 'msg_leader', 'msg_leader@forge.local', passHash, 'leader', 'Leader');
    insertUser.run('u_msg_admin', 'Msg Admin', 'msg_admin', 'msg_admin@forge.local', passHash, 'admin', 'Admin');
    insertUser.run('u_msg_outsider', 'Msg Outsider', 'msg_outsider', 'msg_outsider@forge.local', passHash, 'member', 'Member');

    db.prepare(`INSERT OR REPLACE INTO teams (id, name) VALUES (?, ?)`).run('t_msg_squad', 'Msg Squad');
    db.prepare(`
      INSERT OR REPLACE INTO team_memberships (id, user_id, team_id) VALUES (?, ?, ?)
    `).run('tm_msg_1', 'u_msg_member', 't_msg_squad');

    const login = async (identifier) => {
      const res = await supertest(app).post('/api/auth/login').send({ identifier, password: 'pass123' });
      assert.equal(res.status, 200);
      return res.body.token;
    };
    memberToken = await login('msg_member');
    leaderToken = await login('msg_leader');
    adminToken = await login('msg_admin');
    outsiderToken = await login('msg_outsider');
  });

  it('rejects channel access without authentication (401)', async () => {
    const res = await supertest(app).get('/api/channels');
    assert.equal(res.status, 401);
  });

  it('forbids members from creating channels (403)', async () => {
    const res = await supertest(app)
      .post('/api/channels')
      .set('Authorization', `Bearer ${memberToken}`)
      .send({ name: 'sneaky-channel' });
    assert.equal(res.status, 403);
  });

  it('allows leaders to create public channels', async () => {
    const res = await supertest(app)
      .post('/api/channels')
      .set('Authorization', `Bearer ${leaderToken}`)
      .send({ name: 'general' });
    assert.equal(res.status, 201);
    assert.match(res.body.channel.id, /^chn_/);
    assert.equal(res.body.channel.type, 'text');
    publicChannelId = res.body.channel.id;
  });

  it('validates channel payloads (400)', async () => {
    const shortName = await supertest(app)
      .post('/api/channels')
      .set('Authorization', `Bearer ${leaderToken}`)
      .send({ name: 'x' });
    assert.equal(shortName.status, 400);

    const badType = await supertest(app)
      .post('/api/channels')
      .set('Authorization', `Bearer ${leaderToken}`)
      .send({ name: 'weird', type: 'voice-chat' });
    assert.equal(badType.status, 400);

    const privateWithoutTeam = await supertest(app)
      .post('/api/channels')
      .set('Authorization', `Bearer ${leaderToken}`)
      .send({ name: 'secret', is_private: true });
    assert.equal(privateWithoutTeam.status, 400);
  });

  it('posts and lists messages in a public channel', async () => {
    const sent = await supertest(app)
      .post(`/api/channels/${publicChannelId}/messages`)
      .set('Authorization', `Bearer ${memberToken}`)
      .send({ content: 'Hello Forge!' });
    assert.equal(sent.status, 201);
    assert.equal(sent.body.message.content, 'Hello Forge!');
    assert.equal(sent.body.message.user_name, 'Msg Member');
    messageId = sent.body.message.id;

    const list = await supertest(app)
      .get(`/api/channels/${publicChannelId}/messages`)
      .set('Authorization', `Bearer ${leaderToken}`);
    assert.equal(list.status, 200);
    assert.equal(list.body.messages.length, 1);
    assert.equal(list.body.messages[0].id, messageId);
  });

  it('rejects empty message content (400)', async () => {
    const res = await supertest(app)
      .post(`/api/channels/${publicChannelId}/messages`)
      .set('Authorization', `Bearer ${memberToken}`)
      .send({ content: '   ' });
    assert.equal(res.status, 400);
  });

  it('returns 404 for unknown channels', async () => {
    const res = await supertest(app)
      .get('/api/channels/chn_missing/messages')
      .set('Authorization', `Bearer ${memberToken}`);
    assert.equal(res.status, 404);
  });

  it('restricts private team channels to team members', async () => {
    const created = await supertest(app)
      .post('/api/channels')
      .set('Authorization', `Bearer ${leaderToken}`)
      .send({ name: 'squad-room', type: 'team', team_id: 't_msg_squad', is_private: true });
    assert.equal(created.status, 201);
    teamChannelId = created.body.channel.id;

    const outsiderRead = await supertest(app)
      .get(`/api/channels/${teamChannelId}/messages`)
      .set('Authorization', `Bearer ${outsiderToken}`);
    assert.equal(outsiderRead.status, 403);

    const outsiderPost = await supertest(app)
      .post(`/api/channels/${teamChannelId}/messages`)
      .set('Authorization', `Bearer ${outsiderToken}`)
      .send({ content: 'let me in' });
    assert.equal(outsiderPost.status, 403);

    const memberPost = await supertest(app)
      .post(`/api/channels/${teamChannelId}/messages`)
      .set('Authorization', `Bearer ${memberToken}`)
      .send({ content: 'squad only' });
    assert.equal(memberPost.status, 201);

    const outsiderList = await supertest(app)
      .get('/api/channels')
      .set('Authorization', `Bearer ${outsiderToken}`);
    assert.equal(outsiderList.status, 200);
    assert.ok(!outsiderList.body.channels.some((c) => c.id === teamChannelId));
  });

  it('locks announcement-type channels to leaders and above', async () => {
    const created = await supertest(app)
      .post('/api/channels')
      .set('Authorization', `Bearer ${leaderToken}`)
      .send({ name: 'broadcasts', type: 'announcement' });
    assert.equal(created.status, 201);

    const memberPost = await supertest(app)
      .post(`/api/channels/${created.body.channel.id}/messages`)
      .set('Authorization', `Bearer ${memberToken}`)
      .send({ content: 'not allowed' });
    assert.equal(memberPost.status, 403);

    const leaderPost = await supertest(app)
      .post(`/api/channels/${created.body.channel.id}/messages`)
      .set('Authorization', `Bearer ${leaderToken}`)
      .send({ content: 'important update' });
    assert.equal(leaderPost.status, 201);
  });

  it('allows only the author to edit a message', async () => {
    const otherEdit = await supertest(app)
      .patch(`/api/messages/${messageId}`)
      .set('Authorization', `Bearer ${leaderToken}`)
      .send({ content: 'hijacked' });
    assert.equal(otherEdit.status, 403);

    const authorEdit = await supertest(app)
      .patch(`/api/messages/${messageId}`)
      .set('Authorization', `Bearer ${memberToken}`)
      .send({ content: 'Hello Forge! (edited)' });
    assert.equal(authorEdit.status, 200);
    assert.equal(authorEdit.body.message.content, 'Hello Forge! (edited)');
  });

  it('allows the author or an admin to delete a message', async () => {
    const otherDelete = await supertest(app)
      .delete(`/api/messages/${messageId}`)
      .set('Authorization', `Bearer ${outsiderToken}`);
    assert.equal(otherDelete.status, 403);

    const adminDelete = await supertest(app)
      .delete(`/api/messages/${messageId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    assert.equal(adminDelete.status, 200);

    const gone = await supertest(app)
      .delete(`/api/messages/${messageId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    assert.equal(gone.status, 404);
  });
});
