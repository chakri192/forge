import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import supertest from 'supertest';
import bcrypt from 'bcryptjs';
import { app } from '../src/server/app.js';
import { db, initSchema } from '../src/server/db/database.js';
import { parseMentions, resolveMentions } from '../src/server/utils/mentions.js';

describe('@mentions', () => {
  let aliceToken, channelId, privateChannelId, teamId;

  before(async () => {
    initSchema();
    const hash = bcrypt.hashSync('pass123', 10);
    const insert = db.prepare(`
      INSERT OR REPLACE INTO users (id, name, username, email, password_hash, role, tag)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    insert.run('u_mn_a', 'Alice Mention', 'mn_alice', 'mna@forge.local', hash, 'member', 'Member');
    insert.run('u_mn_b', 'Bob Mention', 'mn_bob', 'mnb@forge.local', hash, 'member', 'Member');
    insert.run('u_mn_out', 'Outsider', 'mn_outsider', 'mno@forge.local', hash, 'member', 'Member');
    insert.run('u_mn_dev', 'Hidden Dev', 'mn_dev', 'mnd@forge.local', hash, 'DEV_STEALTH', 'Ops');

    teamId = 'team_mn';
    db.prepare(`INSERT OR REPLACE INTO teams (id, name, is_active, status) VALUES (?, 'Mention Team', 1, 'ACTIVE')`).run(teamId);
    db.prepare(`INSERT OR REPLACE INTO team_memberships (id, user_id, team_id) VALUES ('tm_mn_a','u_mn_a',?)`).run(teamId);
    db.prepare(`INSERT OR REPLACE INTO team_memberships (id, user_id, team_id) VALUES ('tm_mn_b','u_mn_b',?)`).run(teamId);

    channelId = 'chn_mn_public';
    privateChannelId = 'chn_mn_private';
    db.prepare(`
      INSERT OR REPLACE INTO channels (id, name, type, is_private, team_id)
      VALUES (?, 'mn-general', 'text', 0, NULL)
    `).run(channelId);
    db.prepare(`
      INSERT OR REPLACE INTO channels (id, name, type, is_private, team_id)
      VALUES (?, 'mn-team', 'team', 1, ?)
    `).run(privateChannelId, teamId);

    const res = await supertest(app).post('/api/auth/login').send({ identifier: 'mn_alice', password: 'pass123' });
    aliceToken = res.body.token;
  });

  const unread = (userId) =>
    db.prepare(`SELECT COUNT(*) AS n FROM notifications WHERE user_id = ? AND type = 'MENTION'`).get(userId).n;

  const post = (channel, content) =>
    supertest(app)
      .post(`/api/channels/${channel}/messages`)
      .set('Authorization', `Bearer ${aliceToken}`)
      .send({ content });

  describe('parsing', () => {
    it('finds handles and ignores email addresses', () => {
      assert.deepEqual(parseMentions('hey @mn_bob look'), ['mn_bob']);
      assert.deepEqual(parseMentions('write to me at alice@forge.local'), []);
      assert.deepEqual(parseMentions('@mn_bob and @mn_bob again'), ['mn_bob'], 'deduped');
      assert.deepEqual(parseMentions('@mn_bob. done'), ['mn_bob'], 'punctuation is not part of the name');
      assert.deepEqual(parseMentions('email@@mn_bob'), [], 'a run of @ is not a mention');
    });

    it('caps how many one message can carry', () => {
      const many = Array.from({ length: 25 }, (_, i) => `@user_${i}`).join(' ');
      assert.equal(parseMentions(many).length, 10);
    });

    it('only resolves handles that are real accounts', () => {
      const found = resolveMentions('@mn_bob @nobody_at_all', () => true, 'u_mn_a');
      assert.deepEqual(found.map((u) => u.username), ['mn_bob']);
    });

    it('never resolves a stealth account', () => {
      // A DEV_STEALTH user is meant to be invisible; being mentionable would
      // confirm the account exists.
      assert.deepEqual(resolveMentions('@mn_dev', () => true, 'u_mn_a'), []);
    });
  });

  describe('notifying', () => {
    it('notifies the person named', async () => {
      const before = unread('u_mn_b');
      const res = await post(channelId, 'can you review this @mn_bob?');
      assert.equal(res.status, 201);
      assert.equal(unread('u_mn_b'), before + 1);
    });

    it('does not notify you for naming yourself', async () => {
      const before = unread('u_mn_a');
      await post(channelId, 'note to self @mn_alice');
      assert.equal(unread('u_mn_a'), before);
    });

    it('does not notify someone who cannot open the channel', async () => {
      // mn_outsider is not on the team, so a mention in the private team
      // channel would otherwise leak both the channel and the message preview.
      const before = unread('u_mn_out');
      const res = await post(privateChannelId, 'psst @mn_outsider');
      assert.equal(res.status, 201);
      assert.equal(unread('u_mn_out'), before, 'a mention must not reach a non-member');
    });

    it('still notifies a teammate in a private channel', async () => {
      const before = unread('u_mn_b');
      await post(privateChannelId, 'standup in five @mn_bob');
      assert.equal(unread('u_mn_b'), before + 1);
    });

    it('links the notification at the channel it came from', async () => {
      await post(channelId, 'one more @mn_bob');
      const row = db
        .prepare(`SELECT link, message FROM notifications WHERE user_id = 'u_mn_b' ORDER BY created_at DESC, rowid DESC LIMIT 1`)
        .get();
      assert.equal(row.link, `#/messages/${channelId}`);
      assert.match(row.message, /one more/);
    });
  });

  it('keeps the client and server mention patterns in step', async () => {
    // Two copies of the rule exist — the server decides who is notified, the
    // client decides what is highlighted. If they drift, a message highlights
    // a name that never gets told, or vice versa.
    const { renderMessageBody } = await import('../src/public/js/utils/richText.js');
    const samples = [
      'hey @mn_bob',
      'mail me at a@b.com',
      '@mn_bob. done',
      'nested @@mn_bob',
      'start @mn_bob mid @mn_alice end'
    ];
    for (const text of samples) {
      const serverNames = parseMentions(text);
      const highlighted = [...renderMessageBody(text).html.matchAll(/class="mention[^"]*">@([a-zA-Z0-9_]+)</g)]
        .map((m) => m[1].toLowerCase());
      assert.deepEqual(
        [...new Set(highlighted)],
        serverNames,
        `client and server disagree about: ${text}`
      );
    }
  });
});
