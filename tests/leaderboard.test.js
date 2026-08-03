import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import supertest from 'supertest';
import bcrypt from 'bcryptjs';
import { app } from '../src/server/app.js';
import { db, initSchema } from '../src/server/db/database.js';

describe('Leaderboard', () => {
  let memberToken, stealthToken;

  before(async () => {
    initSchema();
    const hash = bcrypt.hashSync('pass123', 10);
    const user = db.prepare(`
      INSERT OR REPLACE INTO users (id, name, username, email, password_hash, role, tag)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    user.run('u_lb_1', 'Ada Lovelace', 'lb_ada', 'ada@forge.local', hash, 'member', 'Member');
    user.run('u_lb_2', 'Barb Liskov', 'lb_barb', 'barb@forge.local', hash, 'member', 'Member');
    user.run('u_lb_3', 'Cy Stealth', 'lb_cy', 'cy@forge.local', hash, 'DEV_STEALTH', 'Ops');

    db.prepare(`DELETE FROM xp_history WHERE user_id LIKE 'u_lb_%'`).run();
    const xp = db.prepare(`
      INSERT INTO xp_history (id, user_id, amount, source_type, source_id, description)
      VALUES (?, ?, ?, 'TEST', 'seed', 'test')
    `);
    xp.run('xp_lb_a', 'u_lb_1', 120);
    xp.run('xp_lb_b', 'u_lb_2', 120);   // deliberate tie with Ada
    xp.run('xp_lb_c', 'u_lb_3', 9999);  // stealth account, must stay hidden

    const login = async (id) => {
      const res = await supertest(app).post('/api/auth/login').send({ identifier: id, password: 'pass123' });
      assert.equal(res.status, 200);
      return res.body.token;
    };
    memberToken = await login('lb_ada');
    stealthToken = await login('lb_cy');
  });

  const get = (token, qs = '') =>
    supertest(app).get(`/api/leaderboard${qs}`).set('Authorization', `Bearer ${token}`);

  it('requires authentication', async () => {
    assert.equal((await supertest(app).get('/api/leaderboard')).status, 401);
  });

  it('defaults to XP and lists the available metrics', async () => {
    // Points became a spendable wallet, so they are no longer a standing.
    const res = await get(memberToken);
    assert.equal(res.status, 200);
    assert.equal(res.body.metric, 'xp');
    assert.deepEqual(res.body.metrics.map((m) => m.id), ['xp', 'tasks', 'streak']);
  });

  it('no longer offers points as a ranking metric', async () => {
    assert.equal((await get(memberToken, '?metric=points')).status, 400);
  });

  it('rejects an unknown metric rather than silently defaulting', async () => {
    assert.equal((await get(memberToken, '?metric=vibes')).status, 400);
  });

  it('ranks by the requested metric, highest first', async () => {
    const res = await get(memberToken, '?metric=xp');
    const scores = res.body.leaders.map((r) => r.score);
    assert.deepEqual([...scores].sort((a, b) => b - a), scores, 'scores must descend');
  });

  it('gives tied scores the same rank', async () => {
    const res = await get(memberToken, '?metric=xp');
    const ada = res.body.leaders.find((r) => r.username === 'lb_ada');
    const barb = res.body.leaders.find((r) => r.username === 'lb_barb');
    assert.equal(ada.score, barb.score, 'precondition: both on 120');
    assert.equal(ada.rank, barb.rank, 'a tie must share a rank');
  });

  it('skips the rank after a tie instead of reusing it', async () => {
    const res = await get(memberToken, '?metric=xp');
    const ranks = res.body.leaders.map((r) => r.rank);
    for (let i = 1; i < ranks.length; i += 1) {
      assert.ok(ranks[i] >= ranks[i - 1], 'ranks never decrease');
    }
    // With two people sharing rank N, no third person may also hold rank N.
    const counts = ranks.reduce((acc, r) => ({ ...acc, [r]: (acc[r] || 0) + 1 }), {});
    for (const [rank, count] of Object.entries(counts)) {
      const sharing = res.body.leaders.filter((r) => r.rank === Number(rank));
      assert.equal(new Set(sharing.map((s) => s.score)).size, 1,
        `rank ${rank} is shared by different scores`);
    }
  });

  it('hides stealth accounts from ordinary members', async () => {
    const res = await get(memberToken, '?metric=xp');
    assert.equal(res.body.leaders.some((r) => r.username === 'lb_cy'), false);
  });

  it('shows a stealth account its own row', async () => {
    const res = await get(stealthToken, '?metric=xp');
    assert.ok(res.body.leaders.some((r) => r.username === 'lb_cy'));
  });

  it('never leaks credentials or contact details', async () => {
    const res = await get(memberToken);
    const serialised = JSON.stringify(res.body);
    for (const leaked of ['password', 'password_hash', 'email', '@forge.local', 'phone']) {
      assert.equal(serialised.includes(leaked), false, `${leaked} must not appear`);
    }
  });

  it('returns the viewer their own standing even when off the page', async () => {
    const res = await get(memberToken, '?metric=xp&limit=1');
    assert.equal(res.body.leaders.length, 1);
    assert.ok(res.body.viewerRank >= 1, 'viewerRank is always reported');
    const onPage = res.body.leaders.some((r) => r.username === 'lb_ada');
    if (!onPage) {
      assert.ok(res.body.viewer, 'a viewer off the page gets their own row');
      assert.equal(res.body.viewer.username, 'lb_ada');
    } else {
      assert.equal(res.body.viewer, null, 'no duplicate row when already visible');
    }
  });

  it('supports every advertised metric without erroring', async () => {
    for (const metric of ['xp', 'tasks', 'streak']) {
      const res = await get(memberToken, `?metric=${metric}`);
      assert.equal(res.status, 200, `${metric} should work`);
      assert.ok(Array.isArray(res.body.leaders));
      assert.equal(res.body.metric, metric);
    }
  });
});
