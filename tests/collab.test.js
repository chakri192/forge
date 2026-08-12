import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import supertest from 'supertest';
import bcrypt from 'bcryptjs';
import { app } from '../src/server/app.js';
import { db, initSchema } from '../src/server/db/database.js';

/**
 * The per-task collaboration hub (milestone 3.5).
 *
 * A task workspace gathers the team's chat, its files, its progress and its
 * notes in one response — which makes the access check the whole ballgame. One
 * endpoint now exposes four things that used to be guarded separately.
 */
describe('Collaboration hub', () => {
  let memberToken, outsiderToken, teacherToken, soloToken;
  const TASK = 'task_collab';
  const SOLO = 'task_solo';

  before(async () => {
    initSchema();
    const hash = bcrypt.hashSync('pass123', 10);
    const user = db.prepare(`
      INSERT OR REPLACE INTO users (id, name, username, email, password_hash, role, tag)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    user.run('u_cb_mem', 'Team Member', 'cb_member', 'cbm@forge.local', hash, 'member', 'Member');
    user.run('u_cb_out', 'Outsider', 'cb_outsider', 'cbo@forge.local', hash, 'member', 'Member');
    user.run('u_cb_solo', 'Solo Owner', 'cb_solo', 'cbs@forge.local', hash, 'member', 'Member');
    user.run('u_cb_teach', 'Reviewer', 'cb_teacher', 'cbt@forge.local', hash, 'teacher', 'Instructor');

    db.prepare(`INSERT OR REPLACE INTO teams (id, name, is_active, status) VALUES ('t_cb','Collab Team',1,'ACTIVE')`).run();
    db.prepare(`INSERT OR REPLACE INTO team_memberships (id, user_id, team_id) VALUES ('tm_cb','u_cb_mem','t_cb')`).run();
    db.prepare(`
      INSERT OR REPLACE INTO channels (id, name, type, is_private, team_id)
      VALUES ('ch_cb', 'collab-team-chat', 'team', 1, 't_cb')
    `).run();

    db.prepare(`
      INSERT OR REPLACE INTO tasks (id, title, description, status, total_points, assigned_team_id)
      VALUES (?, 'Collab task', 'x', 'active', 20, 't_cb')
    `).run(TASK);
    db.prepare(`
      INSERT OR REPLACE INTO tasks (id, title, description, status, total_points, assigned_user_id)
      VALUES (?, 'Solo task', 'x', 'active', 10, 'u_cb_solo')
    `).run(SOLO);

    db.prepare(`
      INSERT OR REPLACE INTO subtasks (id, task_id, title, is_completed, position)
      VALUES ('st_cb_1', ?, 'First step', 1, 0)
    `).run(TASK);
    db.prepare(`
      INSERT OR REPLACE INTO subtasks (id, task_id, title, is_completed, position)
      VALUES ('st_cb_2', ?, 'Second step', 0, 1)
    `).run(TASK);

    const login = async (u) =>
      (await supertest(app).post('/api/auth/login').send({ identifier: u, password: 'pass123' })).body.token;
    memberToken = await login('cb_member');
    outsiderToken = await login('cb_outsider');
    soloToken = await login('cb_solo');
    teacherToken = await login('cb_teacher');
  });

  const as = (token, method, path) =>
    supertest(app)[method](path).set('Authorization', `Bearer ${token}`);

  describe('who can open it', () => {
    it('lets a member of the assigned team in', async () => {
      const res = await as(memberToken, 'get', `/api/tasks/${TASK}/collab`);
      assert.equal(res.status, 200);
      assert.equal(res.body.task.id, TASK);
    });

    it('lets a reviewer in', async () => {
      assert.equal((await as(teacherToken, 'get', `/api/tasks/${TASK}/collab`)).status, 200);
    });

    it('lets the individually assigned person into their own task', async () => {
      assert.equal((await as(soloToken, 'get', `/api/tasks/${SOLO}/collab`)).status, 200);
    });

    it('keeps everyone else out', async () => {
      const res = await as(outsiderToken, 'get', `/api/tasks/${TASK}/collab`);
      assert.equal(res.status, 403);
    });

    it('404s for a task that does not exist', async () => {
      assert.equal((await as(teacherToken, 'get', '/api/tasks/nope/collab')).status, 404);
    });
  });

  describe('what it gathers', () => {
    it('resolves the team channel for the chat tab', async () => {
      const { body } = await as(memberToken, 'get', `/api/tasks/${TASK}/collab`);
      assert.equal(body.channel.id, 'ch_cb');
    });

    it('reports progress from the subtasks', async () => {
      const { body } = await as(memberToken, 'get', `/api/tasks/${TASK}/collab`);
      assert.equal(body.progress.total, 2);
      assert.equal(body.progress.done, 1);
      assert.equal(body.progress.percent, 50);
    });

    it('calls a task with no subtasks unmeasured, not zero percent', async () => {
      const { body } = await as(soloToken, 'get', `/api/tasks/${SOLO}/collab`);
      assert.equal(body.progress.total, 0);
      assert.equal(body.progress.percent, null, '0% would claim no progress; there is nothing to measure');
    });

    it('has no channel before a team is assigned', async () => {
      const { body } = await as(soloToken, 'get', `/api/tasks/${SOLO}/collab`);
      assert.equal(body.channel, null);
    });

    it('surfaces media shared in the team channel as files', async () => {
      await as(memberToken, 'post', '/api/channels/ch_cb/messages')
        .send({ content: 'here it is https://media.giphy.com/media/abc/diagram.gif' });

      const { body } = await as(memberToken, 'get', `/api/tasks/${TASK}/collab`);
      const shared = body.files.find((f) => f.source === 'chat');
      assert.ok(shared, 'a link shared in chat should appear in Files');
      assert.equal(shared.name, 'diagram.gif');
    });
  });

  describe('meeting notes', () => {
    let noteId;

    it('creates one', async () => {
      const res = await as(memberToken, 'post', `/api/tasks/${TASK}/notes`)
        .send({ title: 'Standup 12 Aug', content: 'Decided to split the parser work.' });
      assert.equal(res.status, 201);
      noteId = res.body.note.id;
    });

    it('shows it in the hub', async () => {
      const { body } = await as(memberToken, 'get', `/api/tasks/${TASK}/collab`);
      assert.equal(body.notes[0].title, 'Standup 12 Aug');
      assert.equal(body.notes[0].author, 'Team Member');
    });

    it('lets another teammate edit it', async () => {
      // The team's notes, not the note-taker's — whoever was typing during the
      // meeting is an accident of who had a keyboard free.
      const res = await as(teacherToken, 'patch', `/api/notes/${noteId}`)
        .send({ title: 'Standup 12 Aug (amended)' });
      assert.equal(res.status, 200);
      assert.equal(res.body.note.title, 'Standup 12 Aug (amended)');
    });

    it('refuses a note with no title', async () => {
      const res = await as(memberToken, 'post', `/api/tasks/${TASK}/notes`).send({ title: '   ' });
      assert.equal(res.status, 400);
    });

    it('keeps an outsider away from notes entirely', async () => {
      const create = await as(outsiderToken, 'post', `/api/tasks/${TASK}/notes`)
        .send({ title: 'sneaking in' });
      assert.equal(create.status, 403);

      const edit = await as(outsiderToken, 'patch', `/api/notes/${noteId}`).send({ title: 'nope' });
      assert.equal(edit.status, 403);
    });

    it('deletes one', async () => {
      assert.equal((await as(memberToken, 'delete', `/api/notes/${noteId}`)).status, 200);
      const { body } = await as(memberToken, 'get', `/api/tasks/${TASK}/collab`);
      assert.equal(body.notes.length, 0);
    });
  });
});
