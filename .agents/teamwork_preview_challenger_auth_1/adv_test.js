import assert from 'node:assert/strict';
import supertest from 'supertest';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { app } from '../../src/server/app.js';
import { db, initSchema } from '../../src/server/db/database.js';

const JWT_SECRET = process.env.JWT_SECRET || 'forge_jwt_secret_key_2026_dev';

async function runAdversarialSuite() {
  console.log('=== STARTING EMPIRICAL ADVERSARIAL AUTH TEST SUITE ===\n');
  initSchema();

  // Reset u_dev user
  db.prepare("DELETE FROM users WHERE id = 'u_dev'").run();
  db.prepare("INSERT OR REPLACE INTO users (id, name, username, email, phone, password_hash, role, tag) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
    .run('u_dev', 'Aaron', 'aaron_dev', 'aaron@forge.local', '9990001111', bcrypt.hashSync('pass123', 10), 'DEV_STEALTH', 'Creator');

  const results = [];

  async function testCase(name, fn) {
    try {
      await fn();
      console.log(`[PASS] ${name}`);
      results.push({ name, status: 'PASS' });
    } catch (err) {
      console.error(`[FAIL] ${name}:`, err.message);
      results.push({ name, status: 'FAIL', error: err.message });
    }
  }

  // 1. Expired JWTs
  await testCase('1. Expired JWT token returns 401 Unauthorized', async () => {
    const expiredToken = jwt.sign(
      { id: 'u_dev', username: 'aaron_dev', role: 'DEV_STEALTH' },
      JWT_SECRET,
      { expiresIn: '-1s' }
    );
    const res = await supertest(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${expiredToken}`);
    assert.equal(res.status, 401, `Expected 401, got ${res.status}`);
    assert.equal(res.body.error, 'Unauthorized');
  });

  // 2. Malformed tokens
  await testCase('2. Malformed token returns 401 Unauthorized', async () => {
    const malformedTokens = [
      'not.a.valid.jwt',
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.invalidpayload.invalidsig',
      'random_garbage_string_12345'
    ];
    for (const token of malformedTokens) {
      const res = await supertest(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${token}`);
      assert.equal(res.status, 401, `Token "${token}" expected 401, got ${res.status}`);
      assert.equal(res.body.error, 'Unauthorized');
    }
  });

  // 3. Missing Bearer prefix
  await testCase('3. Missing Bearer prefix returns 401 Unauthorized', async () => {
    const validToken = jwt.sign(
      { id: 'u_dev', username: 'aaron_dev', role: 'DEV_STEALTH' },
      JWT_SECRET,
      { expiresIn: '1h' }
    );
    
    // No "Bearer " prefix
    const res1 = await supertest(app)
      .get('/api/auth/me')
      .set('Authorization', validToken);
    assert.equal(res1.status, 401, `Raw token header expected 401, got ${res1.status}`);

    // Wrong prefix "Basic "
    const res2 = await supertest(app)
      .get('/api/auth/me')
      .set('Authorization', `Basic ${validToken}`);
    assert.equal(res2.status, 401, `Basic header expected 401, got ${res2.status}`);

    // Prefix "Token "
    const res3 = await supertest(app)
      .get('/api/auth/me')
      .set('Authorization', `Token ${validToken}`);
    assert.equal(res3.status, 401, `Token prefix header expected 401, got ${res3.status}`);
  });

  // 4. Forged signature
  await testCase('4. Forged signature (wrong secret) returns 401 Unauthorized', async () => {
    const forgedToken = jwt.sign(
      { id: 'u_dev', username: 'aaron_dev', role: 'DEV_STEALTH' },
      'attacker_fake_secret_key_999',
      { expiresIn: '1h' }
    );
    const res = await supertest(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${forgedToken}`);
    assert.equal(res.status, 401, `Forged token expected 401, got ${res.status}`);
    assert.equal(res.body.error, 'Unauthorized');
  });

  // 5. Invalid current password on password change
  await testCase('5. Invalid current password on password change returns 400 Bad Request', async () => {
    const validToken = jwt.sign(
      { id: 'u_dev', username: 'aaron_dev', role: 'DEV_STEALTH' },
      JWT_SECRET,
      { expiresIn: '1h' }
    );
    const res = await supertest(app)
      .post('/api/auth/change-password')
      .set('Authorization', `Bearer ${validToken}`)
      .send({ currentPassword: 'WRONG_PASSWORD_123', newPassword: 'newpassword456' });

    assert.equal(res.status, 400, `Expected 400, got ${res.status}`);
    assert.equal(res.body.error, 'Current password incorrect');
  });

  // 6. Legacy x-user-id header presence
  await testCase('6. Legacy x-user-id header presence fails auth (returns 401)', async () => {
    const res = await supertest(app)
      .get('/api/auth/me')
      .set('x-user-id', 'u_dev');
    assert.equal(res.status, 401, `x-user-id header expected 401, got ${res.status}`);
    assert.equal(res.body.error, 'Unauthorized');

    // Test privileged route with x-user-id header only
    const devRes = await supertest(app)
      .get('/api/dev/settings')
      .set('x-user-id', 'u_dev');
    assert.equal(devRes.status, 401, `x-user-id header on /api/dev/settings expected 401, got ${devRes.status}`);
  });

  // 7. DEV_STEALTH superadmin capabilities & public role masking
  await testCase('7. DEV_STEALTH superadmin capabilities work and public role is masked to OPERATIVE', async () => {
    // Authenticate u_dev
    const loginRes = await supertest(app)
      .post('/api/auth/login')
      .send({ identifier: 'aaron_dev', password: 'pass123' });
    assert.equal(loginRes.status, 200);
    const token = loginRes.body.token;

    // Check login user payload
    assert.equal(loginRes.body.user.role, 'DEV_STEALTH');
    assert.equal(loginRes.body.user.public_role, 'OPERATIVE');

    // Check /api/auth/me endpoint
    const meRes = await supertest(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${token}`);
    assert.equal(meRes.status, 200);
    assert.equal(meRes.body.user.role, 'DEV_STEALTH');
    assert.equal(meRes.body.user.public_role, 'OPERATIVE');

    // Verify privileged access: /api/dev/settings requires ADMIN_ROLES ('TEACHER' or 'DEV_STEALTH')
    const settingsRes = await supertest(app)
      .get('/api/dev/settings')
      .set('Authorization', `Bearer ${token}`);
    assert.equal(settingsRes.status, 200, `DEV_STEALTH should be able to access /api/dev/settings, got ${settingsRes.status}`);
    assert.ok(settingsRes.body.signup_enabled !== undefined);

    // Verify update settings capability
    const updateRes = await supertest(app)
      .post('/api/dev/settings')
      .set('Authorization', `Bearer ${token}`)
      .send({ signup_enabled: true, max_capacity: 100 });
    assert.equal(updateRes.status, 200);
    assert.equal(updateRes.body.settings.max_capacity, 100);
  });

  console.log('\n=================================================');
  console.log(`SUMMARY: ${results.filter(r => r.status === 'PASS').length}/${results.length} PASSED`);
  console.log('=================================================\n');

  if (results.some(r => r.status === 'FAIL')) {
    process.exit(1);
  }
}

runAdversarialSuite().catch(err => {
  console.error('Test suite runner crashed:', err);
  process.exit(1);
});
