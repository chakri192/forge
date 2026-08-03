import test from 'node:test';
import assert from 'node:assert/strict';
import supertest from 'supertest';
import { app } from '../src/server/app.js';
import { resetTestDb } from './helpers/testDb.js';
import { UserFactory, AuthFactory } from './helpers/factories.js';

test('Hall of Fame Endpoints (Production App Routes)', async (t) => {
  resetTestDb();

  const leader = UserFactory.create({ role: 'leader', username: 'hof_lead' });
  const token = AuthFactory.createToken(leader);

  await t.test('should fetch hall of fame rankings and titles', async () => {
    const res = await supertest(app)
      .get('/api/hall-of-fame')
      .set('Authorization', `Bearer ${token}`);

    assert.equal(res.status, 200);
    assert.ok(res.body.titles !== undefined || res.body.allTime !== undefined);
  });

  await t.test('should award a new hall of fame title', async () => {
    const res = await supertest(app)
      .post('/api/hall-of-fame/award')
      .set('Authorization', `Bearer ${token}`)
      .send({ title_name: 'Test Champion', category: 'Coding', awarded_to_user_id: leader.id });

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.ok(res.body.titleId || res.body.id);
  });
});
