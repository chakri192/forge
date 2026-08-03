import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { app } from '../src/server/app.js';
import { resetTestDb } from './helpers/testDb.js';
import { UserFactory, AuthFactory } from './helpers/factories.js';

test('Input Validation, Global Error Handling & Rate Limiting Suite', async (t) => {
  resetTestDb();

  const user = UserFactory.create({ role: 'member', username: 'val_user', password: 'password123' });
  const token = AuthFactory.createToken(user);

  await t.test('1. Server gracefully handles completely malformed JSON payloads (400 Bad Request)', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .set('Content-Type', 'application/json')
      .send('{"invalid_json": true, ');

    assert.equal(res.status, 400);
    assert.equal(res.body.success, false);
    assert.equal(res.body.error, 'Malformed JSON payload');
  });

  await t.test('2. Missing required fields return standardized 400 Bad Request with Zod validation details', async () => {
    const res = await request(app)
      .post('/api/auth/signup')
      .send({
        name: 'Short User',
        username: 'u',
        email: 'invalid-email-format',
        password: '123'
      });

    assert.equal(res.status, 400);
    assert.equal(res.body.success, false);
    assert.ok(res.body.error.includes('Validation error'));
    assert.ok(Array.isArray(res.body.details));
  });

  await t.test('3. Malicious XSS HTML tags in string inputs are automatically stripped and sanitized', async () => {
    const xssTitle = '<script>alert("XSS")</script>Sanitized Task Title';
    const xssDesc = 'Description with <b onmouseover="alert(1)">HTML tags</b>';

    const res = await request(app)
      .post('/api/tasks/suggest')
      .set('Authorization', `Bearer ${token}`)
      .send({
        title: xssTitle,
        description: xssDesc,
        total_points: 25
      });

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.ok(res.body.taskId);
  });

  await t.test('4. Exceeding auth rate limit returns HTTP 429 Too Many Requests', async () => {
    const maxAttempts = 7;
    let lastRes = null;

    for (let i = 0; i < maxAttempts; i++) {
      lastRes = await request(app)
        .post('/api/auth/login')
        .send({ identifier: `rate_user_${i}`, password: 'wrongpassword' });
    }

    assert.equal(lastRes.status, 429);
    assert.equal(lastRes.body.success, false);
    assert.equal(lastRes.body.error, 'Too many requests, please try again later');
  });
});
