import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import supertest from 'supertest';
import bcrypt from 'bcryptjs';
import { app } from '../src/server/app.js';
import { db, initSchema } from '../src/server/db/database.js';

describe('Full-text search', () => {
  let memberToken, teacherToken;

  before(async () => {
    initSchema();
    const passHash = bcrypt.hashSync('pass123', 10);
    const insert = db.prepare(`
      INSERT OR REPLACE INTO users (id, name, username, email, password_hash, role, tag)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    insert.run('u_s_member', 'Search Member', 's_member', 'sm@forge.local', passHash, 'member', 'Member');
    insert.run('u_s_teacher', 'Search Teacher', 's_teacher', 'st@forge.local', passHash, 'teacher', 'Teacher');

    // Triggers index these on insert, so no explicit reindex is needed.
    db.prepare(`
      INSERT OR REPLACE INTO tasks (id, title, description, status, total_points)
      VALUES ('task_search', 'Build a Kubernetes operator', 'Reconcile custom resources', 'active', 40)
    `).run();
    db.prepare(`
      INSERT OR REPLACE INTO announcements (id, title, content, author_id, priority, target_role)
      VALUES ('ann_public_s', 'Kubernetes workshop', 'Open to everyone', 'u_s_teacher', 'NORMAL', NULL)
    `).run();
    db.prepare(`
      INSERT OR REPLACE INTO announcements (id, title, content, author_id, priority, target_role)
      VALUES ('ann_teachers_s', 'Kubernetes grading rubric', 'Teachers only', 'u_s_teacher', 'NORMAL', 'teacher')
    `).run();
    db.prepare(`
      INSERT OR REPLACE INTO quizzes (id, title, description, category, kind, difficulty, xp_reward, pass_percent, is_published)
      VALUES ('qz_search_pub', 'Kubernetes basics', 'Pods and services', 'devops', 'QUIZ', 'MEDIUM', 50, 70, 1)
    `).run();
    db.prepare(`
      INSERT OR REPLACE INTO quizzes (id, title, description, category, kind, difficulty, xp_reward, pass_percent, is_published)
      VALUES ('qz_search_draft', 'Kubernetes internals draft', 'Not ready', 'devops', 'QUIZ', 'HARD', 50, 70, 0)
    `).run();

    const login = async (id) => {
      const res = await supertest(app).post('/api/auth/login').send({ identifier: id, password: 'pass123' });
      assert.equal(res.status, 200);
      return res.body.token;
    };
    memberToken = await login('s_member');
    teacherToken = await login('s_teacher');
  });

  it('requires auth', async () => {
    assert.equal((await supertest(app).get('/api/search?q=kubernetes')).status, 401);
  });

  it('finds matches across entity types', async () => {
    const res = await supertest(app)
      .get('/api/search?q=kubernetes')
      .set('Authorization', `Bearer ${memberToken}`);
    assert.equal(res.status, 200);

    const kinds = new Set(res.body.results.map((r) => r.kind));
    assert.ok(kinds.has('task'), 'should match a task');
    assert.ok(kinds.has('announcement'), 'should match an announcement');
    assert.ok(kinds.has('quiz'), 'should match a quiz');
  });

  it('matches on body text, not just titles', async () => {
    const res = await supertest(app)
      .get('/api/search?q=reconcile')
      .set('Authorization', `Bearer ${memberToken}`);
    assert.ok(res.body.results.some((r) => r.id === 'task_search'));
  });

  it('supports prefix matching for as-you-type', async () => {
    const res = await supertest(app)
      .get('/api/search?q=kubern')
      .set('Authorization', `Bearer ${memberToken}`);
    assert.ok(res.body.results.length > 0, 'a partial word should still match');
  });

  it('respects announcement audience targeting', async () => {
    const asMember = await supertest(app)
      .get('/api/search?q=kubernetes')
      .set('Authorization', `Bearer ${memberToken}`);
    assert.equal(
      asMember.body.results.some((r) => r.id === 'ann_teachers_s'),
      false,
      'a member must not find a teachers-only announcement'
    );

    const asTeacher = await supertest(app)
      .get('/api/search?q=kubernetes')
      .set('Authorization', `Bearer ${teacherToken}`);
    assert.ok(asTeacher.body.results.some((r) => r.id === 'ann_teachers_s'));
  });

  it('hides unpublished quizzes from players but shows them to authors', async () => {
    const asMember = await supertest(app)
      .get('/api/search?q=internals')
      .set('Authorization', `Bearer ${memberToken}`);
    assert.equal(asMember.body.results.some((r) => r.id === 'qz_search_draft'), false);

    const asTeacher = await supertest(app)
      .get('/api/search?q=internals')
      .set('Authorization', `Bearer ${teacherToken}`);
    assert.ok(asTeacher.body.results.some((r) => r.id === 'qz_search_draft'));
  });

  it('survives FTS5 syntax characters instead of erroring', async () => {
    for (const q of ['")(*:', 'NEAR(', '^^^', 'a" OR "b', '*']) {
      const res = await supertest(app)
        .get(`/api/search?q=${encodeURIComponent(q)}`)
        .set('Authorization', `Bearer ${memberToken}`);
      assert.equal(res.status, 200, `query ${q} should not 500`);
      assert.ok(Array.isArray(res.body.results));
    }
  });

  it('returns nothing for an empty or single-character query', async () => {
    for (const q of ['', ' ', 'a']) {
      const res = await supertest(app)
        .get(`/api/search?q=${encodeURIComponent(q)}`)
        .set('Authorization', `Bearer ${memberToken}`);
      assert.equal(res.body.results.length, 0);
    }
  });

  it('reflects edits and deletions through the triggers', async () => {
    db.prepare(`UPDATE tasks SET title = 'Build a Nomad operator' WHERE id = 'task_search'`).run();
    const renamed = await supertest(app)
      .get('/api/search?q=nomad')
      .set('Authorization', `Bearer ${memberToken}`);
    assert.ok(renamed.body.results.some((r) => r.id === 'task_search'), 'index should follow an update');

    db.prepare(`DELETE FROM tasks WHERE id = 'task_search'`).run();
    const removed = await supertest(app)
      .get('/api/search?q=nomad')
      .set('Authorization', `Bearer ${memberToken}`);
    assert.equal(removed.body.results.some((r) => r.id === 'task_search'), false, 'index should follow a delete');
  });
});
