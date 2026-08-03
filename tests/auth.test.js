import test from 'node:test';
import assert from 'node:assert/strict';
import supertest from 'supertest';
import { app } from '../src/server/app.js';
import { resetTestDb } from './helpers/testDb.js';
import { UserFactory, AuthFactory } from './helpers/factories.js';

test('Auth & User Role Endpoints (Production App Routes)', async (t) => {
  resetTestDb();

  const authUser = UserFactory.create({
    name: 'Auth Test User',
    username: 'auth_test_user',
    password: 'pass123',
    role: 'DEV_STEALTH'
  });

  await t.test('should authenticate user via bcrypt and return JWT token with masked public_role', async () => {
    const res = await supertest(app)
      .post('/api/auth/login')
      .send({ identifier: 'auth_test_user', password: 'pass123' });

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.ok(res.body.token, 'JWT token should be returned');
    assert.equal(res.body.user.role, 'DEV_STEALTH');
    assert.equal(res.body.user.public_role, 'member');
  });

  await t.test('should return 401 on /api/auth/me without Authorization token', async () => {
    const res = await supertest(app).get('/api/auth/me');
    assert.equal(res.status, 401);
  });

  await t.test('should return 401 Unauthorized when sending legacy x-user-id header', async () => {
    const res = await supertest(app)
      .get('/api/auth/me')
      .set('x-user-id', authUser.id);
    assert.equal(res.status, 401);
  });

  await t.test('should return current user profile via /api/auth/me with valid Bearer token', async () => {
    const token = AuthFactory.createToken(authUser);

    const res = await supertest(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${token}`);

    assert.equal(res.status, 200);
    assert.equal(res.body.user.id, authUser.id);
    assert.equal(res.body.user.public_role, 'member');
  });

  await t.test('should register a new user via /api/auth/signup and return JWT token', async () => {
    const res = await supertest(app)
      .post('/api/auth/signup')
      .send({
        name: 'New Operative',
        username: `new_op_${Date.now()}`,
        email: `new_op_${Date.now()}@forge.local`,
        password: 'securepass123',
        role: 'member',
        tag: 'Code Ninja'
      });

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.ok(res.body.token, 'Signup should return JWT token');
    assert.equal(res.body.user.name, 'New Operative');
  });

  await t.test('should change password via /api/auth/change-password endpoint', async () => {
    const user = UserFactory.create({ password: 'oldpassword123' });
    const token = AuthFactory.createToken(user);

    const changeRes = await supertest(app)
      .post('/api/auth/change-password')
      .set('Authorization', `Bearer ${token}`)
      .send({ currentPassword: 'oldpassword123', newPassword: 'newpassword123' });

    assert.equal(changeRes.status, 200);
    assert.equal(changeRes.body.success, true);

    // Old password fails
    const failLogin = await supertest(app)
      .post('/api/auth/login')
      .send({ identifier: user.username, password: 'oldpassword123' });
    assert.equal(failLogin.status, 401);

    // New password succeeds
    const newLogin = await supertest(app)
      .post('/api/auth/login')
      .send({ identifier: user.username, password: 'newpassword123' });
    assert.equal(newLogin.status, 200);
  });

  await t.test('should fetch and update system settings via /api/dev/settings', async () => {
    const token = AuthFactory.createToken(authUser);

    const getRes = await supertest(app)
      .get('/api/dev/settings')
      .set('Authorization', `Bearer ${token}`);
    assert.equal(getRes.status, 200);
    assert.equal(typeof getRes.body.signup_enabled, 'boolean');

    const updateRes = await supertest(app)
      .post('/api/dev/settings')
      .set('Authorization', `Bearer ${token}`)
      .send({ signup_enabled: false, max_capacity: 10 });

    assert.equal(updateRes.status, 200);
    assert.equal(updateRes.body.success, true);

    // Restore default
    await supertest(app)
      .post('/api/dev/settings')
      .set('Authorization', `Bearer ${token}`)
      .send({ signup_enabled: true, max_capacity: 50 });
  });
});
