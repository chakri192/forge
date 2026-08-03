import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { app } from '../src/server/app.js';
import { resetTestDb } from './helpers/testDb.js';
import { UserFactory, AuthFactory, TaskFactory, TeamFactory, NotificationFactory } from './helpers/factories.js';

test('Exhaustive RBAC Endpoint Authorization Matrix', async (t) => {
  resetTestDb();

  // Create test actors across all RBAC roles
  const stealthUser = UserFactory.createStealth({ username: 'stealth_rbac' });
  const adminUser = UserFactory.createAdmin({ username: 'admin_rbac' });
  const teacherUser = UserFactory.createTeacher({ username: 'teacher_rbac' });
  const leaderUser = UserFactory.createLeader({ username: 'leader_rbac' });
  const memberUser = UserFactory.createMember({ username: 'member_rbac' });
  const otherMemberUser = UserFactory.createMember({ username: 'other_member_rbac' });

  const stealthToken = AuthFactory.createToken(stealthUser);
  const adminToken = AuthFactory.createToken(adminUser);
  const teacherToken = AuthFactory.createToken(teacherUser);
  const leaderToken = AuthFactory.createToken(leaderUser);
  const memberToken = AuthFactory.createToken(memberUser);

  // Setup target resources for RBAC testing
  const sampleTask = TaskFactory.create({ title: 'RBAC Matrix Test Task' });
  const sampleTeam = TeamFactory.create({ name: 'RBAC Matrix Test Team', captain_id: leaderUser.id });

  await t.test('1. Unauthenticated Guest Access Matrix', async () => {
    // Unauthenticated requests to protected endpoints MUST return 401 Unauthorized
    const meRes = await request(app).get('/api/auth/me');
    assert.equal(meRes.status, 401);

    const settingsRes = await request(app).get('/api/dev/settings');
    assert.equal(settingsRes.status, 401);

    const tasksRes = await request(app).get('/api/tasks');
    assert.equal(tasksRes.status, 401);

    const submitRes = await request(app).post(`/api/tasks/${sampleTask.id}/submit`);
    assert.equal(submitRes.status, 401);

    const activityRes = await request(app).get('/api/activity');
    assert.equal(activityRes.status, 401);

    const notifRes = await request(app).get('/api/notifications');
    assert.equal(notifRes.status, 401);
  });

  await t.test('2. Member Role Permissions Matrix', async () => {
    // Member CAN suggest tasks
    const suggestRes = await request(app)
      .post('/api/tasks/suggest')
      .set('Authorization', `Bearer ${memberToken}`)
      .send({ title: 'Member Suggested Task', description: 'Testing member suggest', total_points: 20 });
    assert.equal(suggestRes.status, 200);

    // Member CAN view their own notifications
    const notifRes = await request(app)
      .get('/api/notifications')
      .set('Authorization', `Bearer ${memberToken}`);
    assert.equal(notifRes.status, 200);

    // Member CANNOT access system dev settings (403)
    const settingsRes = await request(app)
      .get('/api/dev/settings')
      .set('Authorization', `Bearer ${memberToken}`);
    assert.equal(settingsRes.status, 403);

    // Member CANNOT assign tasks (403)
    const assignRes = await request(app)
      .post(`/api/tasks/${sampleTask.id}/assign`)
      .set('Authorization', `Bearer ${memberToken}`)
      .send({ team_id: sampleTeam.id });
    assert.equal(assignRes.status, 403);

    // Member CANNOT assign user roles (403)
    const roleRes = await request(app)
      .patch(`/api/users/${memberUser.id}/role`)
      .set('Authorization', `Bearer ${memberToken}`)
      .send({ role: 'leader' });
    assert.equal(roleRes.status, 403);

    // Member CANNOT access global activity audit log (403)
    const globalActRes = await request(app)
      .get('/api/activity')
      .set('Authorization', `Bearer ${memberToken}`);
    assert.equal(globalActRes.status, 403);

    // Member CANNOT dissolve team (403)
    const dissolveRes = await request(app)
      .post(`/api/teams/${sampleTeam.id}/dissolve`)
      .set('Authorization', `Bearer ${memberToken}`)
      .send({ reason: 'Unauthorized dissolution' });
    assert.equal(dissolveRes.status, 403);

    // Member CANNOT rotate student leaders (403)
    const rotateRes = await request(app)
      .post('/api/student-leaders/rotate')
      .set('Authorization', `Bearer ${memberToken}`)
      .send({ leader_ids: [memberUser.id] });
    assert.equal(rotateRes.status, 403);
  });

  await t.test('3. Leader Role Permissions Matrix', async () => {
    // Leader CAN assign tasks
    const assignRes = await request(app)
      .post(`/api/tasks/${sampleTask.id}/assign`)
      .set('Authorization', `Bearer ${leaderToken}`)
      .send({ team_id: sampleTeam.id });
    assert.equal(assignRes.status, 200);

    // Leader CAN create team
    const teamRes = await request(app)
      .post('/api/teams')
      .set('Authorization', `Bearer ${leaderToken}`)
      .send({ name: 'Leader Created Team', captain_id: leaderUser.id });
    assert.equal(teamRes.status, 200);

    // Leader CANNOT assign user roles (403)
    const roleRes = await request(app)
      .patch(`/api/users/${memberUser.id}/role`)
      .set('Authorization', `Bearer ${leaderToken}`)
      .send({ role: 'admin' });
    assert.equal(roleRes.status, 403);

    // Leader CANNOT access dev settings (403)
    const settingsRes = await request(app)
      .get('/api/dev/settings')
      .set('Authorization', `Bearer ${leaderToken}`);
    assert.equal(settingsRes.status, 403);

    // Leader CANNOT delete users (403)
    const deleteRes = await request(app)
      .delete(`/api/users/${otherMemberUser.id}`)
      .set('Authorization', `Bearer ${leaderToken}`);
    assert.equal(deleteRes.status, 403);
  });

  await t.test('4. Teacher & Admin Role Permissions Matrix', async () => {
    // Teacher CAN access dev settings
    const teacherSettingsRes = await request(app)
      .get('/api/dev/settings')
      .set('Authorization', `Bearer ${teacherToken}`);
    assert.equal(teacherSettingsRes.status, 200);

    // Teacher CAN rotate student leaders
    const rotateRes = await request(app)
      .post('/api/student-leaders/rotate')
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({ leader_ids: [leaderUser.id] });
    assert.equal(rotateRes.status, 200);

    // Admin CAN assign roles
    const adminRoleRes = await request(app)
      .patch(`/api/users/${memberUser.id}/role`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ role: 'leader' });
    assert.equal(adminRoleRes.status, 200);

    // Admin CAN view global activity log
    const adminActRes = await request(app)
      .get('/api/activity')
      .set('Authorization', `Bearer ${adminToken}`);
    assert.equal(adminActRes.status, 200);
  });

  await t.test('5. DEV_STEALTH Superadmin Overlay Matrix', async () => {
    // DEV_STEALTH has access to ALL endpoints
    const settingsRes = await request(app)
      .get('/api/dev/settings')
      .set('Authorization', `Bearer ${stealthToken}`);
    assert.equal(settingsRes.status, 200);

    const actRes = await request(app)
      .get('/api/activity')
      .set('Authorization', `Bearer ${stealthToken}`);
    assert.equal(actRes.status, 200);

    const roleRes = await request(app)
      .patch(`/api/users/${memberUser.id}/role`)
      .set('Authorization', `Bearer ${stealthToken}`)
      .send({ role: 'teacher' });
    assert.equal(roleRes.status, 200);
  });
});
