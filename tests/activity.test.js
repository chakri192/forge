import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { app } from '../src/server/app.js';
import { resetTestDb } from './helpers/testDb.js';
import { UserFactory, AuthFactory, TaskFactory, TeamFactory } from './helpers/factories.js';
import { ActivityService } from '../src/server/services/activity.js';

test('Activity Logging & API Endpoints', async (t) => {
  resetTestDb();

  const adminUser = UserFactory.create({ role: 'admin', username: 'act_admin_user' });
  const memberUser = UserFactory.create({ role: 'member', username: 'act_member_user', password: 'pass123' });

  const adminToken = AuthFactory.createToken(adminUser);
  const memberToken = AuthFactory.createToken(memberUser);

  await t.test('1. ActivityService should log activity directly into DB', () => {
    const entry = ActivityService.logActivity({
      userId: adminUser.id,
      action: 'TEST_ACTION',
      entityType: 'test',
      entityId: 't_123',
      details: { foo: 'bar' }
    });

    assert.ok(entry);
    assert.equal(entry.action, 'TEST_ACTION');
    assert.equal(entry.entity_type, 'test');
    assert.equal(entry.details.foo, 'bar');
  });

  await t.test('2. GET /api/activity should allow Admin access and return logs', async () => {
    const res = await request(app)
      .get('/api/activity')
      .set('Authorization', `Bearer ${adminToken}`);

    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.body.activities));
    assert.ok(res.body.total >= 1);
  });

  await t.test('3. GET /api/activity should DENY non-admin access (403 Forbidden)', async () => {
    const res = await request(app)
      .get('/api/activity')
      .set('Authorization', `Bearer ${memberToken}`);

    assert.equal(res.status, 403);
    assert.ok(res.body.error.includes('Forbidden'));
  });

  await t.test('4. GET /api/activity/user/:id should allow user to view their own history', async () => {
    const res = await request(app)
      .get(`/api/activity/user/${memberUser.id}`)
      .set('Authorization', `Bearer ${memberToken}`);

    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.body.activities));
  });

  await t.test('5. GET /api/activity/user/:id should DENY standard user from viewing another user history', async () => {
    const res = await request(app)
      .get(`/api/activity/user/${adminUser.id}`)
      .set('Authorization', `Bearer ${memberToken}`);

    assert.equal(res.status, 403);
  });

  await t.test('6. Login action should generate activity log record', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ identifier: memberUser.username, password: 'pass123' });

    assert.equal(res.status, 200);

    const logs = ActivityService.getGlobalActivity({ type: 'LOGIN' });
    assert.ok(logs.activities.length > 0);
    assert.equal(logs.activities[0].action, 'LOGIN');
  });

  await t.test('7. Task creation & submission should generate activity log records', async () => {
    const taskRes = await request(app)
      .post('/api/tasks/suggest')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ title: 'Activity Test Task', description: 'Testing logging', total_points: 10, task_type: 'CHALLENGE', mode: 'SOLO' });

    assert.equal(taskRes.status, 200);
    const taskId = taskRes.body.taskId;

    const taskLogs = ActivityService.getGlobalActivity({ type: 'TASK_CREATE' });
    assert.ok(taskLogs.activities.some(a => a.entity_id === taskId));

    const subRes = await request(app)
      .post(`/api/tasks/${taskId}/submit`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ proof_notes: 'Proof notes for activity test' });

    assert.equal(subRes.status, 200);

    const subLogs = ActivityService.getGlobalActivity({ type: 'TASK_SUBMIT' });
    assert.ok(subLogs.activities.some(a => a.entity_id === taskId));

    const approveRes = await request(app)
      .post(`/api/tasks/${taskId}/approve`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({});

    assert.equal(approveRes.status, 200);

    const reviewLogs = ActivityService.getGlobalActivity({ type: 'TASK_REVIEW' });
    assert.ok(reviewLogs.activities.some(a => a.entity_id === taskId));
  });

  await t.test('8. Team creation & dissolution should generate activity log records', async () => {
    const teamRes = await request(app)
      .post('/api/teams')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Activity Test Team', captain_id: adminUser.id });

    assert.equal(teamRes.status, 200);
    const teamId = teamRes.body.teamId;

    const teamLogs = ActivityService.getGlobalActivity({ type: 'TEAM_CREATE' });
    assert.ok(teamLogs.activities.some(a => a.entity_id === teamId));

    const disRes = await request(app)
      .post(`/api/teams/${teamId}/dissolve`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ reason: 'Testing dissolution log' });

    assert.equal(disRes.status, 200);

    const dissolveLogs = ActivityService.getGlobalActivity({ type: 'TEAM_DISSOLVE' });
    assert.ok(dissolveLogs.activities.some(a => a.entity_id === teamId));
  });

  await t.test('9. Role change should generate activity log record', async () => {
    const roleRes = await request(app)
      .patch(`/api/users/${memberUser.id}/role`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ role: 'leader' });

    assert.equal(roleRes.status, 200);

    const roleLogs = ActivityService.getGlobalActivity({ type: 'ROLE_CHANGE' });
    assert.ok(roleLogs.activities.some(a => a.entity_id === memberUser.id));
  });
});
