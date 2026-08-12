import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import supertest from 'supertest';
import bcrypt from 'bcryptjs';
import fs from 'fs';
import path from 'path';
import { app } from '../src/server/app.js';
import { db, initSchema } from '../src/server/db/database.js';
import { uploadsDir } from '../src/server/middleware/upload.js';

/**
 * The rest of milestone 3.2: pinning, unread counts, previews, in-conversation
 * search, and attaching a file.
 */
describe('Messaging extras', () => {
  let memberToken, teacherToken, otherToken;
  const CHANNEL = 'chn_mx';
  const written = [];

  before(async () => {
    initSchema();
    const hash = bcrypt.hashSync('pass123', 10);
    const user = db.prepare(`
      INSERT OR REPLACE INTO users (id, name, username, email, password_hash, role, tag)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    user.run('u_mx_mem', 'MX Member', 'mx_member', 'mxm@forge.local', hash, 'member', 'Member');
    user.run('u_mx_other', 'MX Other', 'mx_other', 'mxo@forge.local', hash, 'member', 'Member');
    user.run('u_mx_teach', 'MX Teacher', 'mx_teacher', 'mxt@forge.local', hash, 'teacher', 'Instructor');

    db.prepare(`
      INSERT OR REPLACE INTO channels (id, name, type, is_private, team_id)
      VALUES (?, 'mx-general', 'text', 0, NULL)
    `).run(CHANNEL);

    const login = async (u) =>
      (await supertest(app).post('/api/auth/login').send({ identifier: u, password: 'pass123' })).body.token;
    memberToken = await login('mx_member');
    otherToken = await login('mx_other');
    teacherToken = await login('mx_teacher');
  });

  const as = (token, method, p) => supertest(app)[method](p).set('Authorization', `Bearer ${token}`);
  const say = (token, content) =>
    as(token, 'post', `/api/channels/${CHANNEL}/messages`).send({ content });

  describe('pinning', () => {
    let messageId;

    before(async () => {
      const res = await say(memberToken, 'the deadline moved to Friday');
      messageId = res.body.message?.id || res.body.id;
    });

    it('lets a teacher pin', async () => {
      const res = await as(teacherToken, 'post', `/api/messages/${messageId}/pin`);
      assert.equal(res.status, 200);
      assert.equal(res.body.pins.length, 1);
      assert.equal(res.body.pins[0].pinned_by_name, 'MX Teacher');
    });

    it('does not let a member pin', async () => {
      const res = await as(memberToken, 'post', `/api/messages/${messageId}/pin`);
      assert.equal(res.status, 403, 'pinning is a moderation power');
    });

    it('tells a member they cannot, rather than hiding the list', async () => {
      const res = await as(memberToken, 'get', `/api/channels/${CHANNEL}/pins`);
      assert.equal(res.status, 200);
      assert.equal(res.body.canPin, false);
      assert.equal(res.body.pins.length, 1, 'members still see what is pinned');
    });

    it('records who pinned it and when', async () => {
      const row = db.prepare(`SELECT pinned_by, pinned_at FROM message_pins WHERE message_id = ?`).get(messageId);
      assert.equal(row.pinned_by, 'u_mx_teach');
      assert.ok(row.pinned_at, 'a pin that cannot be attributed is not much use when it turns out to be wrong');
    });

    it('does not pin the same message twice', async () => {
      await as(teacherToken, 'post', `/api/messages/${messageId}/pin`);
      const n = db.prepare(`SELECT COUNT(*) n FROM message_pins WHERE message_id = ?`).get(messageId).n;
      assert.equal(n, 1);
    });

    it('unpins', async () => {
      const res = await as(teacherToken, 'delete', `/api/messages/${messageId}/pin`);
      assert.equal(res.status, 200);
      assert.equal(res.body.pins.length, 0);
    });

    it('does not let a member unpin either', async () => {
      await as(teacherToken, 'post', `/api/messages/${messageId}/pin`);
      const res = await as(memberToken, 'delete', `/api/messages/${messageId}/pin`);
      assert.equal(res.status, 403);
    });
  });

  describe('search within a conversation', () => {
    before(async () => {
      await say(memberToken, 'the parser chokes on nested quotes');
      await say(memberToken, 'fixed the tokeniser');
    });

    it('finds a message by its words', async () => {
      const res = await as(memberToken, 'get', `/api/channels/${CHANNEL}/search?q=tokeniser`);
      assert.equal(res.status, 200);
      assert.equal(res.body.results.length, 1);
      assert.match(res.body.results[0].content, /tokeniser/);
    });

    it('refuses a one-character search', async () => {
      const res = await as(memberToken, 'get', `/api/channels/${CHANNEL}/search?q=a`);
      assert.equal(res.status, 400);
    });

    it('treats wildcards as literal text', async () => {
      // A raw %% would otherwise match every message in the channel.
      const res = await as(memberToken, 'get', `/api/channels/${CHANNEL}/search?q=%25%25`);
      assert.equal(res.status, 200);
      assert.equal(res.body.results.length, 0);
    });

    it('will not search a channel the user cannot read', async () => {
      db.prepare(`
        INSERT OR REPLACE INTO channels (id, name, type, is_private, team_id)
        VALUES ('chn_mx_secret', 'mx-secret', 'text', 1, NULL)
      `).run();
      const res = await as(otherToken, 'get', '/api/channels/chn_mx_secret/search?q=anything');
      assert.equal(res.status, 403);
    });
  });

  describe('unread counts and previews', () => {
    let conversationId;

    before(async () => {
      const res = await as(memberToken, 'post', '/api/conversations/direct').send({ userId: 'u_mx_other' });
      conversationId = res.body.conversation.id;
      const channelId = res.body.conversation.channel_id;
      for (const line of ['first', 'second', 'third']) {
        await as(otherToken, 'post', `/api/channels/${channelId}/messages`).send({ content: line });
      }
    });

    it('counts what you have not read, rather than just flagging it', async () => {
      const res = await as(memberToken, 'get', '/api/conversations');
      const conv = res.body.conversations.find((c) => c.id === conversationId);
      assert.equal(conv.unread, 3, '"3 unread" and "unread" answer different questions');
    });

    it('does not count your own messages against you', async () => {
      const { body } = await as(otherToken, 'get', '/api/conversations');
      const conv = body.conversations.find((c) => c.id === conversationId);
      assert.equal(conv.unread, 0, 'the sender has read their own message by definition');
    });

    it('clears once the conversation is opened', async () => {
      await as(memberToken, 'get', `/api/conversations/${conversationId}/messages`);
      const { body } = await as(memberToken, 'get', '/api/conversations');
      const conv = body.conversations.find((c) => c.id === conversationId);
      assert.equal(conv.unread, 0);
    });

    it('shows a line of the last message', async () => {
      const { body } = await as(memberToken, 'get', '/api/conversations');
      const conv = body.conversations.find((c) => c.id === conversationId);
      assert.equal(conv.preview.text, 'third');
      assert.equal(conv.preview.author, 'MX Other');
    });

    it('keeps a local upload path out of the preview', async () => {
      // Our own /uploads/<uuid>.png is not an http URL, so a naive check leaves
      // it in and the preview reads as a file path.
      const { body: conv } = await as(memberToken, 'post', '/api/conversations/direct').send({ userId: 'u_mx_other' });
      await supertest(app)
        .post(`/api/channels/${conv.conversation.channel_id}/attachments`)
        .set('Authorization', `Bearer ${memberToken}`)
        .attach('file', Buffer.from('bytes'), 'wireframe.png')
        .field('caption', 'first pass at the layout');

      const { body } = await as(memberToken, 'get', '/api/conversations');
      const row = body.conversations.find((c) => c.id === conv.conversation.id);
      assert.equal(row.preview.text, 'first pass at the layout');
    });

    it('previews a bare attachment as a word, not a URL', async () => {
      const { body: conv } = await as(memberToken, 'post', '/api/conversations/direct').send({ userId: 'u_mx_teach' });
      await as(memberToken, 'post', `/api/channels/${conv.conversation.channel_id}/messages`)
        .send({ content: 'https://media.giphy.com/media/abc/very-long-tracking-name.gif' });

      const { body } = await as(memberToken, 'get', '/api/conversations');
      const row = body.conversations.find((c) => c.id === conv.conversation.id);
      assert.equal(row.preview.text, 'Attachment', 'a preview of a tracking URL tells you nothing');
    });
  });

  describe('attaching a file', () => {
    it('saves it on this server and posts it to the channel', async () => {
      const res = await supertest(app)
        .post(`/api/channels/${CHANNEL}/attachments`)
        .set('Authorization', `Bearer ${memberToken}`)
        .attach('file', Buffer.from('diagram bytes'), 'diagram.png')
        .field('caption', 'the layout we agreed');

      assert.equal(res.status, 201);
      assert.match(res.body.file.url, /^\/uploads\//);
      assert.match(res.body.message.content, /the layout we agreed/);

      const onDisk = path.join(uploadsDir, res.body.file.url.split('/').pop());
      written.push(onDisk);
      assert.ok(fs.existsSync(onDisk), 'the file must live on our server, not a CDN that expires');
    });

    it('rejects a request with no file', async () => {
      const res = await as(memberToken, 'post', `/api/channels/${CHANNEL}/attachments`);
      assert.equal(res.status, 400);
    });

    after(() => {
      for (const f of written) {
        try {
          fs.unlinkSync(f);
        } catch (_) {}
      }
    });
  });
});
