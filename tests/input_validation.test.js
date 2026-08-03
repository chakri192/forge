import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { app } from '../src/server/app.js';
import { resetTestDb } from './helpers/testDb.js';
import { UserFactory, AuthFactory, TeamFactory, TaskFactory } from './helpers/factories.js';

test('Input Validation & Edge Cases Security Suite', async (t) => {
  resetTestDb();

  const admin = UserFactory.create({ role: 'admin', id: 'u_val_admin' });
  const adminToken = AuthFactory.createToken(admin);

  const member = UserFactory.create({ role: 'member', id: 'u_val_member' });
  const memberToken = AuthFactory.createToken(member);

  await t.test('1. Auth login with missing parameters should return 400', async () => {
    const res1 = await request(app).post('/api/auth/login').send({});
    assert.equal(res1.status, 400);

    const res2 = await request(app).post('/api/auth/login').send({ identifier: 'aaron' });
    assert.equal(res2.status, 400);
  });

  await t.test('2. Auth signup missing required fields should return 400', async () => {
    const res = await request(app).post('/api/auth/signup').send({
      name: 'Test Name',
      username: 'incomplete_user'
    });
    assert.equal(res.status, 400);
    assert.ok(res.body.error);
  });

  await t.test('3. Task suggestion without title or description should return 400', async () => {
    const res = await request(app)
      .post('/api/tasks/suggest')
      .set('Authorization', `Bearer ${memberToken}`)
      .send({ total_points: 50 });

    assert.equal(res.status, 400);
    assert.equal(res.body.success, false);
    assert.ok(res.body.error.includes('Title and description required') || res.body.error.includes('Validation error'));
  });

  await t.test('4. Role update with invalid role string should return 400', async () => {
    const res = await request(app)
      .patch(`/api/users/${member.id}/role`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ role: 'SUPER_SUPER_ROLE' });

    assert.equal(res.status, 400);
    assert.equal(res.body.success, false);
    assert.ok(res.body.error.includes('Invalid role') || res.body.error.includes('Validation error'));
  });

  await t.test('5. Attempting to delete reserved owner u_dev should return 403 Forbidden', async () => {
    const res = await request(app)
      .delete('/api/users/u_dev')
      .set('Authorization', `Bearer ${adminToken}`);

    assert.equal(res.status, 403);
    assert.ok(res.body.error.includes('owner account cannot be deleted'));
  });

  await t.test('6. Attempting to change role of reserved owner u_dev should return 403 Forbidden', async () => {
    const res = await request(app)
      .patch('/api/users/u_dev/role')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ role: 'member' });

    assert.equal(res.status, 403);
    assert.ok(res.body.error.includes('owner role cannot be changed'));
  });

  await t.test('7. Team point override with negative value should return 400 Bad Request', async () => {
    const team = TeamFactory.create({ captain_id: admin.id });
    const res = await request(app)
      .post(`/api/teams/${team.id}/points/override`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ user_id: member.id, custom_point_share: -5 });

    assert.equal(res.status, 400);
  });

  await t.test('8. SQL Injection input strings should be safely handled without error/leak', async () => {
    const sqlPayload = "' OR '1'='1' --";
    const res = await request(app)
      .post('/api/auth/login')
      .send({ identifier: sqlPayload, password: 'password' });

    assert.equal(res.status, 401);
    assert.equal(res.body.error, 'Invalid credentials');
  });

  await t.test('9. Non-existent resource requests should return 404', async () => {
    const res = await request(app)
      .post('/api/tasks/task_nonexistent_12345/assign')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ user_id: member.id });

    assert.equal(res.status, 404);
  });
});
