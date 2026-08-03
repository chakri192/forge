import assert from 'node:assert/strict';
import supertest from 'supertest';
import bcrypt from 'bcryptjs';
import { app } from '../../src/server/app.js';
import { db, initSchema } from '../../src/server/db/database.js';

async function testAuth() {
  initSchema();
  db.prepare("DELETE FROM users WHERE id = 'u_dev'").run();
  db.prepare("INSERT OR REPLACE INTO users (id, name, username, email, phone, password_hash, role, tag) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
    .run('u_dev', 'Aaron', 'aaron_dev', 'aaron@forge.local', '9990001111', bcrypt.hashSync('pass123', 10), 'DEV_STEALTH', 'Creator');

  console.log('Testing login...');
  const loginRes = await supertest(app)
    .post('/api/auth/login')
    .send({ identifier: 'aaron_dev', password: 'pass123' });
  console.log('Login status:', loginRes.status, loginRes.body);

  const token = loginRes.body.token;

  console.log('Testing change-password...');
  const changeRes = await supertest(app)
    .post('/api/auth/change-password')
    .set('Authorization', `Bearer ${token}`)
    .send({ currentPassword: 'pass123', newPassword: 'newpass123' });
  console.log('Change-password status:', changeRes.status, changeRes.body);

  console.log('Testing settings...');
  const getRes = await supertest(app)
    .get('/api/dev/settings')
    .set('Authorization', `Bearer ${token}`);
  console.log('Settings status:', getRes.status, getRes.body);
}

testAuth().catch(console.error);
