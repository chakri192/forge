import { describe, it, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import supertest from 'supertest';
import bcrypt from 'bcryptjs';
import { app } from '../src/server/app.js';
import { db, initSchema } from '../src/server/db/database.js';

/**
 * A season windows the leaderboard so a member who joins late can still
 * compete. Nothing is deleted when one ends — these tests pin that, because a
 * destructive reset would quietly throw away everyone's history.
 */
describe('Seasons', () => {
  let teacherToken, memberToken;

  const xp = (userId, amount, at) =>
    db
      .prepare(
        `INSERT INTO xp_history (id, user_id, amount, source_type, created_at)
         VALUES (?, ?, ?, 'TEST', ?)`
      )
      .run(`xph_${Math.random().toString(36).slice(2)}`, userId, amount, at);

  before(async () => {
    initSchema();
    const hash = bcrypt.hashSync('pass123', 10);
    const insert = db.prepare(`
      INSERT OR REPLACE INTO users (id, name, username, email, password_hash, role, tag)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    insert.run('u_se_teach', 'Season Teacher', 'se_teach', 'set@forge.local', hash, 'teacher', 'Instructor');
    insert.run('u_se_early', 'Early Joiner', 'se_early', 'see@forge.local', hash, 'member', 'Member');
    insert.run('u_se_late', 'Late Joiner', 'se_late', 'sel@forge.local', hash, 'member', 'Member');

    teacherToken = (await supertest(app).post('/api/auth/login').send({ identifier: 'se_teach', password: 'pass123' })).body.token;
    memberToken = (await supertest(app).post('/api/auth/login').send({ identifier: 'se_late', password: 'pass123' })).body.token;
  });

  beforeEach(() => {
    db.prepare(`DELETE FROM season_standings`).run();
    db.prepare(`DELETE FROM seasons`).run();
    db.prepare(`DELETE FROM xp_history WHERE source_type = 'TEST'`).run();
  });

  const asTeacher = (method, path) =>
    supertest(app)[method](path).set('Authorization', `Bearer ${teacherToken}`);

  const openSeason = (name = 'Season One', startsAt = '2026-01-01T00:00:00.000Z', endsAt = '2026-12-31T00:00:00.000Z') =>
    asTeacher('post', '/api/seasons').send({ name, startsAt, endsAt });

  it('lets someone running the cohort open a season', async () => {
    const res = await openSeason();
    assert.equal(res.status, 201);
    assert.equal(res.body.season.status, 'ACTIVE');
  });

  it('refuses a second open season', async () => {
    await openSeason();
    const res = await openSeason('Season Two');
    assert.equal(res.status, 409, 'two open seasons makes "current standings" unanswerable');
  });

  it('refuses a season that ends before it starts', async () => {
    const res = await openSeason('Backwards', '2026-06-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z');
    assert.equal(res.status, 400);
  });

  it('will not let an ordinary member open or close one', async () => {
    const create = await supertest(app)
      .post('/api/seasons')
      .set('Authorization', `Bearer ${memberToken}`)
      .send({ name: 'Nope', startsAt: '2026-01-01T00:00:00.000Z', endsAt: '2026-02-01T00:00:00.000Z' });
    assert.ok(create.status === 403 || create.status === 401);
  });

  it('counts only XP earned inside the window', async () => {
    // Earned long before the season opened.
    xp('u_se_early', 500, '2025-03-01T10:00:00.000Z');
    // Earned during it.
    xp('u_se_early', 10, '2026-06-01T10:00:00.000Z');
    xp('u_se_late', 40, '2026-06-02T10:00:00.000Z');

    await openSeason();
    const res = await supertest(app)
      .get('/api/leaderboard?metric=xp')
      .set('Authorization', `Bearer ${teacherToken}`);

    const early = res.body.leaders.find((r) => r.username === 'se_early');
    const late = res.body.leaders.find((r) => r.username === 'se_late');
    assert.equal(early.score, 10, 'pre-season XP must not carry into the season');
    assert.equal(late.score, 40);
    assert.ok(late.rank < early.rank, 'the late joiner can lead a fresh season');
  });

  it('reports which season the board covers', async () => {
    await openSeason('Spring');
    const res = await supertest(app)
      .get('/api/leaderboard')
      .set('Authorization', `Bearer ${teacherToken}`);
    assert.equal(res.body.season.name, 'Spring');
  });

  it('falls back to all-time when no season is running', async () => {
    xp('u_se_early', 500, '2025-03-01T10:00:00.000Z');
    const res = await supertest(app)
      .get('/api/leaderboard?metric=xp')
      .set('Authorization', `Bearer ${teacherToken}`);
    assert.equal(res.body.season, null);
    const early = res.body.leaders.find((r) => r.username === 'se_early');
    assert.equal(early.score, 500);
  });

  describe('archiving', () => {
    it('freezes the standings and closes the season', async () => {
      xp('u_se_early', 10, '2026-06-01T10:00:00.000Z');
      xp('u_se_late', 40, '2026-06-02T10:00:00.000Z');
      const { body } = await openSeason();

      const res = await asTeacher('post', `/api/seasons/${body.season.id}/archive`);
      assert.equal(res.status, 200);
      assert.equal(res.body.season.status, 'ARCHIVED');
      assert.ok(res.body.season.archived_at);

      const standings = await supertest(app)
        .get(`/api/seasons/${body.season.id}/standings?metric=xp`)
        .set('Authorization', `Bearer ${memberToken}`);
      assert.equal(standings.body.standings[0].username, 'se_late');
      assert.equal(standings.body.standings[0].score, 40);
    });

    it('keeps every XP row — a season is a window, not a delete', async () => {
      xp('u_se_early', 10, '2026-06-01T10:00:00.000Z');
      const before = db.prepare(`SELECT COUNT(*) AS n FROM xp_history`).get().n;

      const { body } = await openSeason();
      await asTeacher('post', `/api/seasons/${body.season.id}/archive`);

      const after = db.prepare(`SELECT COUNT(*) AS n FROM xp_history`).get().n;
      assert.equal(after, before, 'archiving must not destroy history');
    });

    it('does not touch points or cosmetics', async () => {
      // The two currencies are deliberately separate: the board runs on XP,
      // the store runs on points, and a season must not wipe someone's
      // purchases.
      const points = db.prepare(`SELECT COUNT(*) AS n FROM point_transactions`).get().n;
      const owned = db.prepare(`SELECT COUNT(*) AS n FROM user_cosmetics`).get().n;

      const { body } = await openSeason();
      await asTeacher('post', `/api/seasons/${body.season.id}/archive`);

      assert.equal(db.prepare(`SELECT COUNT(*) AS n FROM point_transactions`).get().n, points);
      assert.equal(db.prepare(`SELECT COUNT(*) AS n FROM user_cosmetics`).get().n, owned);
    });

    it('leaves nobody scoring zero in the archive', async () => {
      xp('u_se_early', 10, '2026-06-01T10:00:00.000Z');
      const { body } = await openSeason();
      await asTeacher('post', `/api/seasons/${body.season.id}/archive`);

      const rows = db
        .prepare(`SELECT user_id, score FROM season_standings WHERE season_id = ? AND metric = 'xp'`)
        .all(body.season.id);
      assert.equal(rows.length, 1, 'only people who took part are placed');
      assert.equal(rows[0].user_id, 'u_se_early');
    });

    it('tells each placed member where they finished', async () => {
      xp('u_se_late', 40, '2026-06-02T10:00:00.000Z');
      const { body } = await openSeason('Spring');
      await asTeacher('post', `/api/seasons/${body.season.id}/archive`);

      const note = db
        .prepare(`SELECT title, message FROM notifications WHERE user_id = 'u_se_late' AND type = 'SEASON' ORDER BY rowid DESC LIMIT 1`)
        .get();
      assert.match(note.title, /Spring has ended/);
      assert.match(note.message, /#1 with 40 XP/);
    });

    it('refuses to archive the same season twice', async () => {
      const { body } = await openSeason();
      await asTeacher('post', `/api/seasons/${body.season.id}/archive`);
      const again = await asTeacher('post', `/api/seasons/${body.season.id}/archive`);
      assert.equal(again.status, 409);
    });

    it('frees the slot so the next season can open', async () => {
      const { body } = await openSeason('One');
      await asTeacher('post', `/api/seasons/${body.season.id}/archive`);
      const next = await openSeason('Two', '2027-01-01T00:00:00.000Z', '2027-06-01T00:00:00.000Z');
      assert.equal(next.status, 201);
    });

    it('will not hand out standings for a season still running', async () => {
      const { body } = await openSeason();
      const res = await supertest(app)
        .get(`/api/seasons/${body.season.id}/standings`)
        .set('Authorization', `Bearer ${memberToken}`);
      assert.equal(res.status, 409);
    });

    it('keeps a frozen result even after the XP behind it changes', async () => {
      xp('u_se_early', 10, '2026-06-01T10:00:00.000Z');
      const { body } = await openSeason();
      await asTeacher('post', `/api/seasons/${body.season.id}/archive`);

      // A correction lands afterwards.
      xp('u_se_early', 999, '2026-06-01T11:00:00.000Z');

      const res = await supertest(app)
        .get(`/api/seasons/${body.season.id}/standings?metric=xp`)
        .set('Authorization', `Bearer ${memberToken}`);
      assert.equal(res.body.standings[0].score, 10, 'a settled season must not be rewritten');
    });
  });
});
