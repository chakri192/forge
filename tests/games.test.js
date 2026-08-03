import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import supertest from 'supertest';
import bcrypt from 'bcryptjs';
import { app } from '../src/server/app.js';
import { db, initSchema } from '../src/server/db/database.js';

describe('Mini games', () => {
  let token;

  before(async () => {
    initSchema();
    db.prepare(`
      INSERT OR REPLACE INTO users (id, name, username, email, password_hash, role, tag)
      VALUES ('u_game_1', 'Gamer One', 'game_one', 'g1@forge.local', ?, 'member', 'Member')
    `).run(bcrypt.hashSync('pass123', 10));
    db.prepare(`DELETE FROM game_scores WHERE user_id = 'u_game_1'`).run();
    db.prepare(`DELETE FROM xp_history WHERE user_id = 'u_game_1'`).run();

    const res = await supertest(app).post('/api/auth/login').send({ identifier: 'game_one', password: 'pass123' });
    assert.equal(res.status, 200);
    token = res.body.token;
  });

  const post = (game, body) =>
    supertest(app).post(`/api/games/${game}/scores`).set('Authorization', `Bearer ${token}`).send(body);

  it('requires auth', async () => {
    assert.equal((await supertest(app).get('/api/games')).status, 401);
  });

  it('lists the games with the caller’s bests', async () => {
    const res = await supertest(app).get('/api/games').set('Authorization', `Bearer ${token}`);
    assert.equal(res.status, 200);
    assert.deepEqual(res.body.games.map((g) => g.id), ['hex', 'sprint', 'sequence']);
    assert.ok(res.body.games.every((g) => typeof g.best === 'number'));
  });

  it('records a score and awards XP for a first result', async () => {
    const res = await post('hex', { score: 7 });
    assert.equal(res.status, 200);
    assert.equal(res.body.improved, true);
    assert.equal(res.body.best, 7);
    assert.ok(res.body.xpAwarded > 0);
  });

  it('does not award XP again for a worse score', async () => {
    const res = await post('hex', { score: 3 });
    assert.equal(res.body.improved, false);
    assert.equal(res.body.xpAwarded, 0);
    assert.equal(res.body.best, 7, 'the best is unchanged');
  });

  it('awards XP only for beating the previous best', async () => {
    const before = db.prepare(
      `SELECT COALESCE(SUM(amount),0) AS t FROM xp_history WHERE user_id='u_game_1'`
    ).get().t;

    await post('hex', { score: 2 });
    const unchanged = db.prepare(
      `SELECT COALESCE(SUM(amount),0) AS t FROM xp_history WHERE user_id='u_game_1'`
    ).get().t;
    assert.equal(unchanged, before, 'a worse score grants nothing');

    const better = await post('hex', { score: 9 });
    const after = db.prepare(
      `SELECT COALESCE(SUM(amount),0) AS t FROM xp_history WHERE user_id='u_game_1'`
    ).get().t;
    assert.equal(better.body.improved, true);
    assert.ok(after > before, 'a new best grants XP');
  });

  it('rejects a score above the game’s ceiling', async () => {
    // Games run in the browser, so a submitted score is a claim, not a fact.
    const res = await post('hex', { score: 99999 });
    assert.equal(res.status, 400);
  });

  it('rejects negative and non-integer scores', async () => {
    for (const score of [-1, 2.5]) {
      const res = await post('sprint', { score });
      assert.ok(res.status >= 400 && res.status < 500, `${score} should be rejected`);
    }
  });

  it('rejects an unknown game', async () => {
    assert.equal((await post('chess', { score: 1 })).status, 400);
  });

  it('keeps one row per player in the top scores', async () => {
    await post('sequence', { score: 4 });
    await post('sequence', { score: 6 });
    const res = await supertest(app).get('/api/games').set('Authorization', `Bearer ${token}`);
    const seq = res.body.games.find((g) => g.id === 'sequence');
    const mine = seq.top.filter((t) => t.username === 'game_one');
    assert.equal(mine.length, 1, 'a player appears once however many times they play');
    assert.equal(mine[0].score, 6, 'and it is their best');
  });

  it('stores every attempt even when it is not a best', async () => {
    const count = db.prepare(
      `SELECT COUNT(*) AS n FROM game_scores WHERE user_id='u_game_1' AND game='hex'`
    ).get().n;
    assert.ok(count >= 4, `history is kept, found ${count} rows`);
  });
});
