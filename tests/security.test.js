import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import supertest from 'supertest';
import bcrypt from 'bcryptjs';
import { app } from '../src/server/app.js';
import { db, initSchema } from '../src/server/db/database.js';
import { UserModel } from '../src/server/models/User.js';

describe('Security — endpoints that expose people', () => {
  let memberToken, adminToken;

  before(async () => {
    initSchema();
    const hash = bcrypt.hashSync('pass123', 10);
    const insert = db.prepare(`
      INSERT OR REPLACE INTO users (id, name, username, email, phone, password_hash, role, tag)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'Member')
    `);
    insert.run('u_sec_m', 'Sec Member', 'sec_member', 'secm@forge.local', '+15550001', hash, 'member');
    insert.run('u_sec_a', 'Sec Admin', 'sec_admin', 'seca@forge.local', '+15550002', hash, 'admin');
    insert.run('u_sec_s', 'Sec Stealth', 'sec_stealth', 'secs@forge.local', '+15550003', hash, 'DEV_STEALTH');

    const login = async (u) =>
      (await supertest(app).post('/api/auth/login').send({ identifier: u, password: 'pass123' })).body.token;
    memberToken = await login('sec_member');
    adminToken = await login('sec_admin');
  });

  const anon = (path) => supertest(app).get(path);
  const as = (token, path) => supertest(app).get(path).set('Authorization', `Bearer ${token}`);

  it('does not serve the member directory to anonymous callers', async () => {
    assert.equal((await anon('/api/users')).status, 401);
  });

  it('does not serve standings or leaders anonymously', async () => {
    assert.equal((await anon('/api/hall-of-fame')).status, 401);
    assert.equal((await anon('/api/student-leaders')).status, 401);
  });

  it('never returns contact details to another member', async () => {
    const res = await as(memberToken, '/api/users');
    assert.equal(res.status, 200);
    const others = res.body.filter((u) => u.id !== 'u_sec_m');
    assert.ok(others.length > 0, 'precondition: other people exist');
    for (const u of others) {
      assert.equal('email' in u, false, `${u.username} leaked an email`);
      assert.equal('phone' in u, false, `${u.username} leaked a phone number`);
    }
  });

  it('never returns a password hash to anyone', async () => {
    for (const token of [memberToken, adminToken]) {
      const res = await as(token, '/api/users');
      assert.equal(JSON.stringify(res.body).includes('password_hash'), false);
      assert.equal(JSON.stringify(res.body).includes('$2b$'), false);
    }
  });

  it('hides stealth accounts from members but not from admins', async () => {
    const asMember = await as(memberToken, '/api/users');
    assert.equal(
      asMember.body.some((u) => u.username === 'sec_stealth'),
      false,
      'a stealth account must not appear in a member directory'
    );

    const asAdmin = await as(adminToken, '/api/users');
    assert.ok(asAdmin.body.some((u) => u.username === 'sec_stealth'));
  });

  it('never reveals the DEV_STEALTH role to a member', async () => {
    const res = await as(memberToken, '/api/users');
    assert.equal(JSON.stringify(res.body).includes('DEV_STEALTH'), false);
  });

  it('still gives admins the contact details they need', async () => {
    const res = await as(adminToken, '/api/users');
    const target = res.body.find((u) => u.username === 'sec_member');
    assert.equal(target.email, 'secm@forge.local');
  });

  it('lets a member see their own contact details', async () => {
    const res = await as(memberToken, '/api/users');
    const me = res.body.find((u) => u.id === 'u_sec_m');
    assert.equal(me.email, 'secm@forge.local', 'your own details are your own business');
  });
});

describe('Security — write paths', () => {
  it('refuses to write a column that is not on the allow-list', () => {
    // Column names are interpolated into SQL, so an unknown key must stop the
    // query rather than reach it.
    assert.throws(
      () => UserModel.update('u_sec_m', { 'name = ?, role': 'admin' }),
      /refusing to write unknown column/
    );
  });

  it('still writes the columns it should', () => {
    assert.equal(UserModel.update('u_sec_m', { bio: 'updated bio' }), true);
    assert.equal(UserModel.getByIdOrUsername('u_sec_m').bio, 'updated bio');
  });

  it('strips markup from stored input', async () => {
    const token = (await supertest(app).post('/api/auth/login')
      .send({ identifier: 'sec_admin', password: 'pass123' })).body.token;
    const res = await supertest(app).post('/api/teams')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Squad <img src=x onerror=alert(1)>', captain_id: 'u_sec_m' });
    if (res.status < 300) {
      const stored = db.prepare(`SELECT name FROM teams WHERE id = ?`).get(res.body.teamId || res.body.id);
      if (stored) assert.equal(/<[^>]+>/.test(stored.name), false, 'markup must not reach the database');
    } else {
      assert.ok(res.status >= 400, 'or the request is rejected outright');
    }
  });
});
