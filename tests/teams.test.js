import test from 'node:test';
import assert from 'node:assert/strict';
import supertest from 'supertest';
import { app } from '../src/server/app.js';
import { resetTestDb } from './helpers/testDb.js';
import { UserFactory, TeamFactory, AuthFactory } from './helpers/factories.js';

test('Teams & Point Override Endpoints (Production App Routes)', async (t) => {
  resetTestDb();

  const leader = UserFactory.create({ role: 'leader', username: 'team_lead_user' });
  const member = UserFactory.create({ role: 'member', username: 'team_mem_user' });
  const leaderToken = AuthFactory.createToken(leader);

  const team = TeamFactory.create({ name: 'Prod Route Team', captain_id: leader.id, members: [member.id] });

  await t.test('should list active teams', async () => {
    const res = await supertest(app)
      .get('/api/teams')
      .set('Authorization', `Bearer ${leaderToken}`);

    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.body));
    assert.ok(res.body.some(t => t.id === team.id));
  });

  await t.test('should override custom point share for team member', async () => {
    const res = await supertest(app)
      .post(`/api/teams/${team.id}/points/override`)
      .set('Authorization', `Bearer ${leaderToken}`)
      .send({ user_id: member.id, custom_point_share: 1.5 });

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
  });

  await t.test('should dissolve team and set is_active to 0', async () => {
    const res = await supertest(app)
      .post(`/api/teams/${team.id}/dissolve`)
      .set('Authorization', `Bearer ${leaderToken}`)
      .send({ reason: 'Testing dissolution via supertest' });

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.is_active, 0);
  });
});
