import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import supertest from 'supertest';
import bcrypt from 'bcryptjs';
import { app } from '../src/server/app.js';
import { db, initSchema } from '../src/server/db/database.js';
import { TeamWorkspace } from '../src/server/services/teamWorkspace.js';

/**
 * Team workspace lifecycle (milestone 3.3).
 *
 * A channel appears when the team forms and is archived a grace period after
 * the task finishes. "Archived" deliberately does not mean deleted: the
 * transcript is often the only record of why something was decided.
 */
describe('Team workspaces', () => {
  let teacherToken, memberToken;

  before(async () => {
    initSchema();
    const hash = bcrypt.hashSync('pass123', 10);
    const user = db.prepare(`
      INSERT OR REPLACE INTO users (id, name, username, email, password_hash, role, tag)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    user.run('u_tw_teach', 'WS Teacher', 'tw_teach', 'twt@forge.local', hash, 'teacher', 'Instructor');
    user.run('u_tw_mem', 'WS Member', 'tw_member', 'twm@forge.local', hash, 'member', 'Member');

    const login = async (u, p = 'pass123') =>
      (await supertest(app).post('/api/auth/login').send({ identifier: u, password: p })).body.token;
    teacherToken = await login('tw_teach');
    memberToken = await login('tw_member');
  });

  const as = (token, method, path) =>
    supertest(app)[method](path).set('Authorization', `Bearer ${token}`);

  describe('creation', () => {
    it('gives a new team somewhere to talk', async () => {
      const res = await as(teacherToken, 'post', '/api/teams')
        .send({ name: 'Rocket Squad', captain_id: 'u_tw_mem', member_ids: ['u_tw_mem'] });
      assert.ok(res.status === 200 || res.status === 201, `got ${res.status}`);

      const teamId = res.body.teamId || res.body.id || res.body.team?.id;
      const channel = db.prepare(`SELECT * FROM channels WHERE team_id = ?`).get(teamId);
      assert.ok(channel, 'a team with no channel is just a list of names');
      assert.equal(channel.type, 'team');
      assert.equal(channel.is_private, 1);
    });

    it('does not create a second channel for the same team', () => {
      const before = db.prepare(`SELECT COUNT(*) n FROM channels WHERE team_id = 't_dup'`).get().n;
      db.prepare(`INSERT OR REPLACE INTO teams (id, name, is_active, status) VALUES ('t_dup','Dup',1,'ACTIVE')`).run();
      TeamWorkspace.create({ teamId: 't_dup', teamName: 'Dup' });
      TeamWorkspace.create({ teamId: 't_dup', teamName: 'Dup' });
      const after = db.prepare(`SELECT COUNT(*) n FROM channels WHERE team_id = 't_dup'`).get().n;
      assert.equal(after, before + 1, 'creation must be idempotent');
    });
  });

  describe('archiving', () => {
    const TEAM = 't_arch';
    const TASK = 'task_arch';
    let channelId;

    before(() => {
      db.prepare(`INSERT OR REPLACE INTO teams (id, name, is_active, status) VALUES (?,'Archive Team',1,'ACTIVE')`).run(TEAM);
      db.prepare(`INSERT OR REPLACE INTO team_memberships (id, user_id, team_id) VALUES ('tm_arch','u_tw_mem',?)`).run(TEAM);
      channelId = TeamWorkspace.create({ teamId: TEAM, teamName: 'Archive Team', taskId: TASK }).id;
      db.prepare(`
        INSERT OR REPLACE INTO messages (id, channel_id, user_id, content, created_at, updated_at)
        VALUES ('msg_arch', ?, 'u_tw_mem', 'we decided to use a trie', ?, ?)
      `).run(channelId, new Date().toISOString(), new Date().toISOString());
    });

    const setTask = (status, completedAt) =>
      db.prepare(`
        INSERT OR REPLACE INTO tasks (id, title, description, status, total_points, assigned_team_id, completed_at)
        VALUES (?, 'Archive task', 'x', ?, 10, ?, ?)
      `).run(TASK, status, TEAM, completedAt);

    it('leaves a live task alone', () => {
      setTask('active', null);
      assert.equal(TeamWorkspace.dueForArchive(48).length, 0);
    });

    it('leaves a recently completed task alone', () => {
      // Teams keep talking after they submit, and review can bounce it back.
      setTask('COMPLETED', new Date(Date.now() - 2 * 3600 * 1000).toISOString());
      assert.equal(TeamWorkspace.dueForArchive(48).length, 0, 'the grace period exists for a reason');
    });

    it('picks it up once the grace period has passed', () => {
      setTask('COMPLETED', new Date(Date.now() - 72 * 3600 * 1000).toISOString());
      const due = TeamWorkspace.dueForArchive(48);
      assert.equal(due.length, 1);
      assert.equal(due[0].channel_id, channelId);
    });

    it('keeps the transcript when it archives', () => {
      const result = TeamWorkspace.sweep(48);
      assert.equal(result.archived, 1);

      const messages = db.prepare(`SELECT COUNT(*) n FROM messages WHERE channel_id = ?`).get(channelId).n;
      assert.equal(messages, 1, 'archiving must not destroy the conversation');

      const channel = db.prepare(`SELECT is_archived FROM channels WHERE id = ?`).get(channelId);
      assert.equal(channel.is_archived, 1);

      const record = db
        .prepare(`SELECT * FROM channel_archive WHERE channel_id = ?`)
        .get(channelId);
      assert.ok(record, 'an archive record should exist');
      assert.equal(record.message_count, 1);
    });

    it('makes the channel read-only rather than unreachable', async () => {
      const post = await as(memberToken, 'post', `/api/channels/${channelId}/messages`)
        .send({ content: 'anyone still here?' });
      assert.equal(post.status, 409, 'posting to an archived workspace should be refused');

      const read = await as(memberToken, 'get', `/api/channels/${channelId}/messages`);
      assert.equal(read.status, 200, 'but the history stays readable');
      assert.match(JSON.stringify(read.body), /trie/);
    });

    it('does not archive the same workspace twice', () => {
      assert.equal(TeamWorkspace.sweep(48).archived, 0);
    });

    it('tells the people who were in it', () => {
      const note = db
        .prepare(`SELECT title FROM notifications WHERE user_id = 'u_tw_mem' ORDER BY rowid DESC LIMIT 1`)
        .get();
      assert.match(note.title, /archived/i);
    });
  });
});
