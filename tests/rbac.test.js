import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import supertest from 'supertest';
import bcrypt from 'bcryptjs';
import { app } from '../src/server/app.js';
import { db, initSchema } from '../src/server/db/database.js';

describe('RBAC Middleware & Endpoint Security', () => {
  let memberToken, leaderToken, teacherToken, adminToken, stealthToken;

  before(() => {
    initSchema();

    // Create test accounts with standardized roles
    const passHash = bcrypt.hashSync('pass123', 10);
    const insert = db.prepare(`
      INSERT OR REPLACE INTO users (id, name, username, email, password_hash, role, tag)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    insert.run('u_test_member', 'Test Member', 'test_member', 'member@forge.local', passHash, 'member', 'Member');
    insert.run('u_test_leader', 'Test Leader', 'test_leader', 'leader@forge.local', passHash, 'leader', 'Leader');
    insert.run('u_test_teacher', 'Test Teacher', 'test_teacher', 'teacher@forge.local', passHash, 'teacher', 'Instructor');
    insert.run('u_test_admin', 'Test Admin', 'test_admin', 'admin@forge.local', passHash, 'admin', 'Administrator');
    insert.run('u_dev', 'Aaron Dev', 'aaron_dev', 'aaron@forge.local', passHash, 'DEV_STEALTH', 'Superadmin');
  });

  it('should authenticate users and obtain tokens for each role', async () => {
    const loginMember = await supertest(app).post('/api/auth/login').send({ identifier: 'test_member', password: 'pass123' });
    memberToken = loginMember.body.token;

    const loginLeader = await supertest(app).post('/api/auth/login').send({ identifier: 'test_leader', password: 'pass123' });
    leaderToken = loginLeader.body.token;

    const loginTeacher = await supertest(app).post('/api/auth/login').send({ identifier: 'test_teacher', password: 'pass123' });
    teacherToken = loginTeacher.body.token;

    const loginAdmin = await supertest(app).post('/api/auth/login').send({ identifier: 'test_admin', password: 'pass123' });
    adminToken = loginAdmin.body.token;

    const loginStealth = await supertest(app).post('/api/auth/login').send({ identifier: 'aaron_dev', password: 'pass123' });
    stealthToken = loginStealth.body.token;

    assert.ok(memberToken);
    assert.ok(leaderToken);
    assert.ok(teacherToken);
    assert.ok(adminToken);
    assert.ok(stealthToken);
  });

  it('should DENY member access to teacher/admin endpoints (403 Forbidden)', async () => {
    // Attempt settings access
    const settingsRes = await supertest(app)
      .get('/api/dev/settings')
      .set('Authorization', `Bearer ${memberToken}`);
    assert.equal(settingsRes.status, 403);
    assert.equal(settingsRes.body.error, 'Forbidden: insufficient permissions');

    // Attempt leader rotation access
    const rotateRes = await supertest(app)
      .post('/api/student-leaders/rotate')
      .set('Authorization', `Bearer ${memberToken}`)
      .send({ leader_ids: ['u_test_member'] });
    assert.equal(rotateRes.status, 403);

    // Attempt role assignment access
    const roleRes = await supertest(app)
      .patch('/api/users/u_test_member/role')
      .set('Authorization', `Bearer ${memberToken}`)
      .send({ role: 'teacher' });
    assert.equal(roleRes.status, 403);
  });

  it('should DENY leader access to admin role-assignment and system settings (403 Forbidden)', async () => {
    const settingsRes = await supertest(app)
      .get('/api/dev/settings')
      .set('Authorization', `Bearer ${leaderToken}`);
    assert.equal(settingsRes.status, 403);

    const roleRes = await supertest(app)
      .patch('/api/users/u_test_member/role')
      .set('Authorization', `Bearer ${leaderToken}`)
      .send({ role: 'leader' });
    assert.equal(roleRes.status, 403);
  });

  it('should ALLOW admin to assign and update user roles', async () => {
    const updateRes = await supertest(app)
      .patch('/api/users/u_test_member/role')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ role: 'leader' });

    assert.equal(updateRes.status, 200);
    assert.equal(updateRes.body.success, true);
    assert.equal(updateRes.body.user.role, 'leader');

    // Revert back to member
    const revertRes = await supertest(app)
      .patch('/api/users/u_test_member/role')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ role: 'member' });

    assert.equal(revertRes.status, 200);
    assert.equal(revertRes.body.user.role, 'member');
  });

  it('should ALLOW DEV_STEALTH superadmin overlay to access all endpoints while masking public_role', async () => {
    // DEV_STEALTH accesses dev settings
    const settingsRes = await supertest(app)
      .get('/api/dev/settings')
      .set('Authorization', `Bearer ${stealthToken}`);
    assert.equal(settingsRes.status, 200);

    // DEV_STEALTH accesses role assignment
    const roleRes = await supertest(app)
      .patch('/api/users/u_test_member/role')
      .set('Authorization', `Bearer ${stealthToken}`)
      .send({ role: 'teacher' });
    assert.equal(roleRes.status, 200);

    // DEV_STEALTH public profile is masked
    const meRes = await supertest(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${stealthToken}`);
    assert.equal(meRes.status, 200);
    assert.equal(meRes.body.user.role, 'DEV_STEALTH');
    assert.equal(meRes.body.user.public_role, 'member');

    // Clean up
    await supertest(app)
      .patch('/api/users/u_test_member/role')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ role: 'member' });
  });
});
