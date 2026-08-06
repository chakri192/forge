import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import supertest from 'supertest';
import bcrypt from 'bcryptjs';
import { app } from '../src/server/app.js';
import { db, initSchema } from '../src/server/db/database.js';
import { WalletModel } from '../src/server/models/Wallet.js';
import { ChallengeRewardService } from '../src/server/services/challengeRewardService.js';

describe('Points wallet and cosmetics store', () => {
  let token;
  const USER = 'u_cur_1';

  before(async () => {
    initSchema();
    db.prepare(`
      INSERT OR REPLACE INTO users (id, name, username, email, password_hash, role, tag)
      VALUES (?, 'Coin Holder', 'cur_one', 'cur1@forge.local', ?, 'member', 'Member')
    `).run(USER, bcrypt.hashSync('pass123', 10));
    db.prepare(`DELETE FROM point_transactions WHERE user_id = ?`).run(USER);
    db.prepare(`DELETE FROM user_cosmetics WHERE user_id = ?`).run(USER);

    const res = await supertest(app).post('/api/auth/login').send({ identifier: 'cur_one', password: 'pass123' });
    token = res.body.token;
  });

  const auth = (r) => r.set('Authorization', `Bearer ${token}`);
  const store = () => auth(supertest(app).get('/api/store'));
  const buy = (id) => auth(supertest(app).post(`/api/store/${id}/buy`));

  it('starts everyone on a zero balance', async () => {
    const res = await store();
    assert.equal(res.status, 200);
    assert.equal(res.body.balance, 0);
  });

  it('refuses a purchase that would overdraw the wallet', async () => {
    const res = await buy('frame_gold');
    assert.equal(res.status, 400);
    assert.match(res.body.error || res.body.message || '', /not enough points/i);
  });

  it('lets a free item through even at zero balance', async () => {
    const res = await buy('frame_slate');
    assert.equal(res.status, 200);
    assert.equal(res.body.balance, 0);
  });

  it('will not sell the same item twice', async () => {
    assert.equal((await buy('frame_slate')).status, 409);
  });

  it('debits the balance when something is bought', async () => {
    WalletModel.record({ userId: USER, amount: 500, reason: 'test credit' });
    const before = WalletModel.balanceFor(USER);
    const res = await buy('title_builder');   // costs 80
    assert.equal(res.status, 200);
    assert.equal(res.body.balance, before - 80);
    assert.equal(WalletModel.balanceFor(USER), before - 80);
  });

  it('keeps lifetime earned separate from the spendable balance', async () => {
    const res = await store();
    assert.ok(res.body.earned > res.body.balance, 'spending lowers balance but not earnings');
  });

  it('equips one item per kind, replacing its sibling', async () => {
    WalletModel.record({ userId: USER, amount: 1000, reason: 'test credit' });
    await buy('frame_ember');

    await auth(supertest(app).post('/api/store/frame_slate/equip')).send({ equipped: true });
    await auth(supertest(app).post('/api/store/frame_ember/equip')).send({ equipped: true });

    const equipped = db.prepare(`
      SELECT c.id FROM user_cosmetics uc JOIN cosmetics c ON c.id = uc.cosmetic_id
      WHERE uc.user_id = ? AND uc.equipped = 1 AND c.kind = 'frame'
    `).all(USER);
    assert.equal(equipped.length, 1, 'only one frame can be worn');
    assert.equal(equipped[0].id, 'frame_ember', 'the newest choice wins');
  });

  it('refuses to equip something the user does not own', async () => {
    const res = await auth(supertest(app).post('/api/store/banner_forest/equip')).send({ equipped: true });
    assert.equal(res.status, 403);
  });

  it('requires auth for the wallet and the store', async () => {
    assert.equal((await supertest(app).get('/api/store')).status, 401);
    assert.equal((await supertest(app).get('/api/wallet')).status, 401);
  });

  it('only serves cosmetics whose colour is a safe hex', async () => {
    const res = await store();
    for (const item of res.body.items) {
      assert.match(item.value, /^#[0-9a-f]{6}$/i, `${item.id} has an unsafe colour`);
    }
  });
});

describe('Challenge rewards', () => {
  const HOST = 'u_cr_host';
  const PLAYER = 'u_cr_player';

  before(() => {
    initSchema();
    const insert = db.prepare(`
      INSERT OR REPLACE INTO users (id, name, username, email, password_hash, role, tag)
      VALUES (?, ?, ?, ?, 'x', ?, 'Member')
    `);
    insert.run(HOST, 'Host Admin', 'cr_host', 'crh@forge.local', 'admin');
    insert.run(PLAYER, 'Player One', 'cr_player', 'crp@forge.local', 'member');

    db.prepare(`
      INSERT OR REPLACE INTO tasks (id, title, description, total_points, task_type, status, xp_reward, point_reward)
      VALUES ('task_ch_1', 'Hosted Challenge', 'desc', 40, 'CHALLENGE', 'active', 120, 80)
    `).run();
    db.prepare(`
      INSERT OR REPLACE INTO tasks (id, title, description, total_points, task_type, status, xp_reward, point_reward)
      VALUES ('task_plain', 'Ordinary Task', 'desc', 40, 'TEAM_TASK', 'active', 50, 50)
    `).run();

    db.prepare(`DELETE FROM point_transactions WHERE user_id = ?`).run(PLAYER);
    db.prepare(`DELETE FROM xp_history WHERE user_id = ?`).run(PLAYER);
  });

  const submission = (taskId) => ({ id: 'sub_x', task_id: taskId, submitted_by: PLAYER });

  it('pays the participant, not the host', () => {
    const awarded = ChallengeRewardService.payOut(submission('task_ch_1'));
    assert.deepEqual(awarded, { xp: 120, points: 80 });
    assert.equal(WalletModel.balanceFor(PLAYER), 80);
    assert.equal(WalletModel.balanceFor(HOST), 0, 'hosting is the job, not the achievement');
  });

  it('never pays twice for the same challenge', () => {
    const again = ChallengeRewardService.payOut(submission('task_ch_1'));
    assert.equal(again, null);
    assert.equal(WalletModel.balanceFor(PLAYER), 80, 'balance is unchanged on a re-review');
  });

  it('ignores tasks that are not challenges', () => {
    assert.equal(ChallengeRewardService.payOut(submission('task_plain')), null);
  });

  it('awards XP and points independently', () => {
    db.prepare(`
      INSERT OR REPLACE INTO tasks (id, title, description, total_points, task_type, status, xp_reward, point_reward)
      VALUES ('task_ch_xp', 'XP only', 'desc', 10, 'CHALLENGE', 'active', 60, 0)
    `).run();
    const awarded = ChallengeRewardService.payOut({ id: 's2', task_id: 'task_ch_xp', submitted_by: PLAYER });
    assert.equal(awarded.xp, 60);
    assert.equal(awarded.points, 0, 'a challenge can reward XP without points');
  });
});
