import { describe, it, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import supertest from 'supertest';
import bcrypt from 'bcryptjs';
import { app } from '../src/server/app.js';
import { db, initSchema } from '../src/server/db/database.js';
import { WalletModel } from '../src/server/models/Wallet.js';
import { XpModel } from '../src/server/models/Xp.js';

const A = 'u_duel_a';   // challenger
const B = 'u_duel_b';   // opponent one
const C = 'u_duel_c';   // opponent two
const J = 'u_duel_j';   // judge

describe('Duels', () => {
  let tokenA, tokenB, tokenC, tokenJ;

  const fund = (id, points, xp) => {
    db.prepare(`DELETE FROM point_transactions WHERE user_id = ?`).run(id);
    db.prepare(`DELETE FROM xp_history WHERE user_id = ?`).run(id);
    if (points) WalletModel.record({ userId: id, amount: points, reason: 'test float' });
    if (xp) XpModel.award({ userId: id, amount: xp, sourceType: 'TEST', sourceId: `seed_${id}` });
  };

  before(async () => {
    initSchema();
    const hash = bcrypt.hashSync('pass123', 10);
    const insert = db.prepare(`
      INSERT OR REPLACE INTO users (id, name, username, email, password_hash, role, tag)
      VALUES (?, ?, ?, ?, ?, ?, 'Member')
    `);
    insert.run(A, 'Duel Ann', 'duel_a', 'da@forge.local', hash, 'member');
    insert.run(B, 'Duel Bob', 'duel_b', 'db@forge.local', hash, 'member');
    insert.run(C, 'Duel Cal', 'duel_c', 'dc@forge.local', hash, 'member');
    insert.run(J, 'Duel Judge', 'duel_j', 'dj@forge.local', hash, 'teacher');

    const login = async (u) => {
      const res = await supertest(app).post('/api/auth/login').send({ identifier: u, password: 'pass123' });
      return res.body.token;
    };
    tokenA = await login('duel_a');
    tokenB = await login('duel_b');
    tokenC = await login('duel_c');
    tokenJ = await login('duel_j');
  });

  beforeEach(() => {
    db.prepare(`DELETE FROM duel_participants`).run();
    db.prepare(`DELETE FROM duels`).run();
    [A, B, C].forEach((id) => fund(id, 500, 500));
  });

  const as = (token) => (req) => req.set('Authorization', `Bearer ${token}`);
  const propose = (token, body) =>
    as(token)(supertest(app).post('/api/duels')).send({
      opponentIds: [B, C], stakePoints: 100, stakeXp: 50, ...body
    });

  it('needs exactly two opponents', async () => {
    for (const ids of [[B], [B, C, J], []]) {
      const res = await as(tokenA)(supertest(app).post('/api/duels'))
        .send({ opponentIds: ids, stakePoints: 10, stakeXp: 0 });
      assert.ok(res.status >= 400, `${ids.length} opponents should be rejected`);
    }
  });

  it('refuses a duel with nothing on it', async () => {
    const res = await propose(tokenA, { stakePoints: 0, stakeXp: 0 });
    assert.equal(res.status, 400);
  });

  it('will not let you stake more than you have', async () => {
    const res = await propose(tokenA, { stakePoints: 9000 });
    assert.ok(res.status >= 400);
  });

  it('holds the challenger stake the moment it is proposed', async () => {
    const before = WalletModel.balanceFor(A);
    const res = await propose(tokenA);
    assert.equal(res.status, 201);
    assert.equal(WalletModel.balanceFor(A), before - 100, 'points are escrowed');
    assert.equal(XpModel.totalFor(A), 500 - 50, 'XP is escrowed too');
  });

  it('stays pending until both opponents name the same topic', async () => {
    const { body: duel } = await propose(tokenA);
    let res = await as(tokenB)(supertest(app).post(`/api/duels/${duel.id}/accept`)).send({ topic: 'Debugging' });
    assert.equal(res.body.status, 'PENDING', 'one acceptance is not enough');

    res = await as(tokenC)(supertest(app).post(`/api/duels/${duel.id}/accept`)).send({ topic: 'Testing' });
    assert.equal(res.body.status, 'PENDING', 'disagreeing on the topic does not start it');
    assert.equal(res.body.awaitingTopic, true, 'and the hold-up is visible');

    res = await as(tokenC)(supertest(app).post(`/api/duels/${duel.id}/accept`)).send({ topic: 'Debugging' });
    assert.equal(res.body.status, 'ACTIVE', 'agreement starts it');
    assert.equal(res.body.topic, 'Debugging', 'the opponents own the topic');
  });

  it('takes each opponent stake only once, however often they change topic', async () => {
    const { body: duel } = await propose(tokenA);
    const start = WalletModel.balanceFor(B);
    for (const topic of ['Debugging', 'Testing', 'Git workflow']) {
      await as(tokenB)(supertest(app).post(`/api/duels/${duel.id}/accept`)).send({ topic });
    }
    assert.equal(WalletModel.balanceFor(B), start - 100, 'staked once, not three times');
  });

  it('stops the challenger choosing the topic', async () => {
    const { body: duel } = await propose(tokenA);
    const res = await as(tokenA)(supertest(app).post(`/api/duels/${duel.id}/accept`)).send({ topic: 'CSS layout' });
    assert.equal(res.status, 403);
  });

  it('refunds everyone when one opponent declines', async () => {
    const { body: duel } = await propose(tokenA);
    await as(tokenB)(supertest(app).post(`/api/duels/${duel.id}/accept`)).send({ topic: 'Testing' });
    const res = await as(tokenC)(supertest(app).post(`/api/duels/${duel.id}/decline`));
    assert.equal(res.body.status, 'DECLINED');
    assert.equal(WalletModel.balanceFor(A), 500, 'challenger made whole');
    assert.equal(WalletModel.balanceFor(B), 500, 'the opponent who accepted is made whole');
    assert.equal(XpModel.totalFor(A), 500, 'XP returned too');
  });

  it('pays the whole pot to the winner', async () => {
    const { body: duel } = await propose(tokenA);
    await as(tokenB)(supertest(app).post(`/api/duels/${duel.id}/accept`)).send({ topic: 'Testing' });
    await as(tokenC)(supertest(app).post(`/api/duels/${duel.id}/accept`)).send({ topic: 'Testing' });

    const res = await as(tokenJ)(supertest(app).post(`/api/duels/${duel.id}/resolve`)).send({ winnerId: B });
    assert.equal(res.status, 200);
    assert.equal(res.body.status, 'RESOLVED');

    // Three stakes of 100 go in; the winner leaves with their own back plus two.
    assert.equal(WalletModel.balanceFor(B), 400 + 300);
    assert.equal(WalletModel.balanceFor(A), 400, 'the losers forfeit their stake');
    assert.equal(WalletModel.balanceFor(C), 400);
    assert.equal(XpModel.totalFor(B), 450 + 150);
  });

  it('conserves the pot exactly — nothing minted, nothing burned', async () => {
    const { body: duel } = await propose(tokenA);
    await as(tokenB)(supertest(app).post(`/api/duels/${duel.id}/accept`)).send({ topic: 'Testing' });
    await as(tokenC)(supertest(app).post(`/api/duels/${duel.id}/accept`)).send({ topic: 'Testing' });
    await as(tokenJ)(supertest(app).post(`/api/duels/${duel.id}/resolve`)).send({ winnerId: C });

    const totalPoints = [A, B, C].reduce((sum, id) => sum + WalletModel.balanceFor(id), 0);
    const totalXp = [A, B, C].reduce((sum, id) => sum + XpModel.totalFor(id), 0);
    assert.equal(totalPoints, 1500, 'the three wallets still hold what they started with');
    assert.equal(totalXp, 1500);
  });

  it('lets only leaders and above call a duel', async () => {
    const { body: duel } = await propose(tokenA);
    await as(tokenB)(supertest(app).post(`/api/duels/${duel.id}/accept`)).send({ topic: 'Testing' });
    await as(tokenC)(supertest(app).post(`/api/duels/${duel.id}/accept`)).send({ topic: 'Testing' });

    const asPlayer = await as(tokenA)(supertest(app).post(`/api/duels/${duel.id}/resolve`)).send({ winnerId: A });
    assert.equal(asPlayer.status, 403, 'you cannot award yourself the pot');
  });

  it('refuses a winner who was not in the duel', async () => {
    const { body: duel } = await propose(tokenA);
    await as(tokenB)(supertest(app).post(`/api/duels/${duel.id}/accept`)).send({ topic: 'Testing' });
    await as(tokenC)(supertest(app).post(`/api/duels/${duel.id}/accept`)).send({ topic: 'Testing' });
    const res = await as(tokenJ)(supertest(app).post(`/api/duels/${duel.id}/resolve`)).send({ winnerId: J });
    assert.equal(res.status, 400);
  });

  it('cannot be resolved twice', async () => {
    const { body: duel } = await propose(tokenA);
    await as(tokenB)(supertest(app).post(`/api/duels/${duel.id}/accept`)).send({ topic: 'Testing' });
    await as(tokenC)(supertest(app).post(`/api/duels/${duel.id}/accept`)).send({ topic: 'Testing' });
    await as(tokenJ)(supertest(app).post(`/api/duels/${duel.id}/resolve`)).send({ winnerId: B });
    const again = await as(tokenJ)(supertest(app).post(`/api/duels/${duel.id}/resolve`)).send({ winnerId: C });
    assert.equal(again.status, 409, 'the pot is only paid out once');
  });

  it('keeps outsiders out', async () => {
    const { body: duel } = await propose(tokenA);
    const res = await as(tokenJ)(supertest(app).post(`/api/duels/${duel.id}/accept`)).send({ topic: 'Testing' });
    assert.equal(res.status, 403);
  });

  it('shows a judge the active duels they are not part of', async () => {
    const { body: duel } = await propose(tokenA);
    let seen = await as(tokenJ)(supertest(app).get('/api/duels'));
    assert.equal(seen.body.duels.some((d) => d.id === duel.id), false,
      'a pending duel is nobody else\'s business');

    await as(tokenB)(supertest(app).post(`/api/duels/${duel.id}/accept`)).send({ topic: 'Testing' });
    await as(tokenC)(supertest(app).post(`/api/duels/${duel.id}/accept`)).send({ topic: 'Testing' });

    seen = await as(tokenJ)(supertest(app).get('/api/duels'));
    const found = seen.body.duels.find((d) => d.id === duel.id);
    assert.ok(found, 'an active duel reaches the judge');
    assert.equal(found.canJudge, true);
  });

  it('does not show active duels to uninvolved players', async () => {
    const { body: duel } = await propose(tokenA);
    await as(tokenB)(supertest(app).post(`/api/duels/${duel.id}/accept`)).send({ topic: 'Testing' });
    await as(tokenC)(supertest(app).post(`/api/duels/${duel.id}/accept`)).send({ topic: 'Testing' });

    db.prepare(`UPDATE users SET role = 'member' WHERE id = ?`).run(J);
    const seen = await as(tokenJ)(supertest(app).get('/api/duels'));
    db.prepare(`UPDATE users SET role = 'teacher' WHERE id = ?`).run(J);
    assert.equal(seen.body.duels.some((d) => d.id === duel.id), false);
  });

  it('requires auth', async () => {
    assert.equal((await supertest(app).get('/api/duels')).status, 401);
  });
});
