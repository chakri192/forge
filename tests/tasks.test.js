import test from 'node:test';
import assert from 'node:assert/strict';
import supertest from 'supertest';
import { app } from '../src/server/app.js';
import { resetTestDb } from './helpers/testDb.js';
import { UserFactory, TaskFactory, AuthFactory } from './helpers/factories.js';

test('Task System Full Lifecycle & Specifications', async (t) => {
  resetTestDb();

  const memberUser = UserFactory.create({ role: 'member', username: 'standard_member' });
  const memberToken = AuthFactory.createToken(memberUser);

  const leaderUser = UserFactory.create({ role: 'leader', username: 'squad_leader' });
  const leaderToken = AuthFactory.createToken(leaderUser);

  const adminUser = UserFactory.create({ role: 'admin', username: 'system_admin' });
  const adminToken = AuthFactory.createToken(adminUser);

  let createdTaskId = null;

  await t.test('should list tasks and return grouped task objects', async () => {
    const res = await supertest(app)
      .get('/api/tasks')
      .set('Authorization', `Bearer ${memberToken}`);

    assert.equal(res.status, 200);
    assert.ok(res.body.teamTasks !== undefined || res.body.official !== undefined || Array.isArray(res.body));
  });

  await t.test('should block unauthorized standard member from creating a task (403)', async () => {
    const res = await supertest(app)
      .post('/api/tasks')
      .set('Authorization', `Bearer ${memberToken}`)
      .send({
        title: 'Unauthorized Task Attempt',
        description: 'Should fail',
        total_points: 50
      });

    assert.equal(res.status, 403);
  });

  await t.test('should allow leader/admin to create task with all expanded fields', async () => {
    const taskPayload = {
      title: 'Full Lifecycle Auth Microservice',
      description: 'Build robust JWT & RBAC auth module',
      instructions: '1. Set up JWT middleware\n2. Integrate SQLite role tables\n3. Write test cases',
      resources: 'https://jwt.io\nhttps://expressjs.com',
      deadline: new Date(Date.now() + 86400000).toISOString(),
      difficulty: 'HARD',
      total_points: 100,
      xp_reward: 250,
      badge_reward: 'Security Champion',
      proof_requirements: 'Submit GitHub Pull Request link and test output logs',
      task_type: 'TEAM_TASK',
      mode: 'TEAM',
      status: 'draft'
    };

    const res = await supertest(app)
      .post('/api/tasks')
      .set('Authorization', `Bearer ${leaderToken}`)
      .send(taskPayload);

    assert.equal(res.status, 201);
    assert.equal(res.body.success, true);
    assert.ok(res.body.task);
    assert.equal(res.body.task.title, taskPayload.title);
    assert.equal(res.body.task.instructions, taskPayload.instructions);
    assert.equal(res.body.task.difficulty, 'HARD');
    assert.equal(res.body.task.xp_reward, 250);
    assert.equal(res.body.task.badge_reward, 'Security Champion');
    assert.equal(res.body.task.proof_requirements, taskPayload.proof_requirements);
    assert.equal(res.body.task.status, 'draft');

    createdTaskId = res.body.task.id;
  });

  await t.test('should retrieve full task details by ID via GET /api/tasks/:id', async () => {
    const res = await supertest(app)
      .get(`/api/tasks/${createdTaskId}`)
      .set('Authorization', `Bearer ${memberToken}`);

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.ok(res.body.task);
    assert.equal(res.body.task.id, createdTaskId);
    assert.equal(res.body.task.instructions, '1. Set up JWT middleware\n2. Integrate SQLite role tables\n3. Write test cases');
    assert.equal(res.body.task.xp_reward, 250);
    assert.ok(Array.isArray(res.body.task.submissions));
  });

  await t.test('should validate allowed lifecycle status transitions (draft -> active)', async () => {
    const res = await supertest(app)
      .patch(`/api/tasks/${createdTaskId}/status`)
      .set('Authorization', `Bearer ${leaderToken}`)
      .send({ status: 'active' });

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.task.status, 'active');
  });

  await t.test('should block invalid status transitions (e.g. draft/active directly to completed) (400)', async () => {
    const res = await supertest(app)
      .patch(`/api/tasks/${createdTaskId}/status`)
      .set('Authorization', `Bearer ${leaderToken}`)
      .send({ status: 'completed' });

    assert.equal(res.status, 400);
    assert.equal(res.body.success, false);
    assert.ok(res.body.error.includes('Invalid status transition'));
  });

  await t.test('should transition active -> in_progress -> pending_review -> completed', async () => {
    // active -> in_progress
    let res = await supertest(app)
      .patch(`/api/tasks/${createdTaskId}/status`)
      .set('Authorization', `Bearer ${leaderToken}`)
      .send({ status: 'in_progress' });
    assert.equal(res.status, 200);
    assert.equal(res.body.task.status, 'in_progress');

    // in_progress -> pending_review
    res = await supertest(app)
      .patch(`/api/tasks/${createdTaskId}/status`)
      .set('Authorization', `Bearer ${leaderToken}`)
      .send({ status: 'pending_review' });
    assert.equal(res.status, 200);
    assert.equal(res.body.task.status, 'pending_review');

    // pending_review -> completed
    res = await supertest(app)
      .patch(`/api/tasks/${createdTaskId}/status`)
      .set('Authorization', `Bearer ${leaderToken}`)
      .send({ status: 'completed' });
    assert.equal(res.status, 200);
    assert.equal(res.body.task.status, 'completed');
  });

  await t.test('should filter and search tasks via GET /api/tasks query params', async () => {
    const res = await supertest(app)
      .get('/api/tasks?status=completed&difficulty=HARD&search=Auth')
      .set('Authorization', `Bearer ${memberToken}`);

    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.body));
    assert.ok(res.body.length >= 1);
    assert.equal(res.body[0].id, createdTaskId);
  });

  await t.test('should update task details via PUT /api/tasks/:id', async () => {
    const res = await supertest(app)
      .put(`/api/tasks/${createdTaskId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        title: 'Full Lifecycle Auth Microservice (Updated)',
        total_points: 150
      });

    assert.equal(res.status, 200);
    assert.equal(res.body.task.title, 'Full Lifecycle Auth Microservice (Updated)');
    assert.equal(res.body.task.total_points, 150);
  });

  await t.test('should delete task via DELETE /api/tasks/:id', async () => {
    const res = await supertest(app)
      .delete(`/api/tasks/${createdTaskId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);

    const getRes = await supertest(app)
      .get(`/api/tasks/${createdTaskId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    assert.equal(getRes.status, 404);
  });
});
