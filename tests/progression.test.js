import { describe, it, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import supertest from 'supertest';
import bcrypt from 'bcryptjs';
import { app } from '../src/server/app.js';
import { db, initSchema } from '../src/server/db/database.js';
import { seedProgression } from '../src/server/db/seedProgression.js';
import { ProgressionService } from '../src/server/services/progressionService.js';
import { AchievementService } from '../src/server/services/achievementService.js';
import { XpModel, levelFromXp } from '../src/server/models/Xp.js';
import { StreakModel } from '../src/server/models/Streak.js';
import { BadgeModel } from '../src/server/models/Badge.js';

const USER = 'u_prog_user';
const OTHER = 'u_prog_other';

function resetUserProgress(userId) {
  db.prepare(`DELETE FROM xp_history WHERE user_id = ?`).run(userId);
  db.prepare(`DELETE FROM streaks WHERE user_id = ?`).run(userId);
  db.prepare(`DELETE FROM user_badges WHERE user_id = ?`).run(userId);
  db.prepare(`DELETE FROM task_submissions WHERE submitted_by = ?`).run(userId);
  db.prepare(`DELETE FROM notifications WHERE user_id = ?`).run(userId);
}

describe('Progression: XP, levels, streaks, achievements', () => {
  before(() => {
    initSchema();
    seedProgression();
    const passHash = bcrypt.hashSync('pass123', 10);
    const insert = db.prepare(`
      INSERT OR REPLACE INTO users (id, name, username, email, password_hash, role, tag)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    insert.run(USER, 'Prog User', 'prog_user', 'prog_user@forge.local', passHash, 'member', 'Member');
    insert.run(OTHER, 'Prog Other', 'prog_other', 'prog_other@forge.local', passHash, 'member', 'Member');
  });

  beforeEach(() => {
    resetUserProgress(USER);
    resetUserProgress(OTHER);
  });

  describe('level curve', () => {
    it('starts at level 1 and rises monotonically', () => {
      assert.equal(levelFromXp(0).level, 1);
      assert.equal(levelFromXp(99).level, 1);
      assert.equal(levelFromXp(100).level, 2);
      assert.equal(levelFromXp(400).level, 3);
      assert.equal(levelFromXp(900).level, 4);

      let previous = 0;
      for (let xp = 0; xp <= 5000; xp += 50) {
        const { level } = levelFromXp(xp);
        assert.ok(level >= previous, `level dropped at ${xp} XP`);
        previous = level;
      }
    });

    it('reports progress within the current level', () => {
      const at150 = levelFromXp(150);
      assert.equal(at150.level, 2);
      assert.equal(at150.xpIntoLevel, 50);
      assert.equal(at150.xpForNextLevel, 250);
      assert.ok(at150.progress > 0 && at150.progress < 1);
    });

    it('handles nonsense input without throwing', () => {
      assert.equal(levelFromXp(null).level, 1);
      assert.equal(levelFromXp(-500).level, 1);
      assert.equal(levelFromXp('abc').level, 1);
    });
  });

  describe('streaks', () => {
    it('starts at 1 on first activity', () => {
      const streak = StreakModel.recordActivity(USER, '2026-03-01');
      assert.equal(streak.current_streak, 1);
      assert.equal(streak.longest_streak, 1);
    });

    it('is idempotent within the same day', () => {
      StreakModel.recordActivity(USER, '2026-03-01');
      StreakModel.recordActivity(USER, '2026-03-01');
      StreakModel.recordActivity(USER, '2026-03-01');
      assert.equal(StreakModel.getByUser(USER).current_streak, 1);
    });

    it('increments on consecutive days', () => {
      StreakModel.recordActivity(USER, '2026-03-01');
      StreakModel.recordActivity(USER, '2026-03-02');
      const streak = StreakModel.recordActivity(USER, '2026-03-03');
      assert.equal(streak.current_streak, 3);
      assert.equal(streak.longest_streak, 3);
    });

    it('resets after a missed day but preserves the longest run', () => {
      for (const day of ['2026-03-01', '2026-03-02', '2026-03-03', '2026-03-04']) {
        StreakModel.recordActivity(USER, day);
      }
      const afterGap = StreakModel.recordActivity(USER, '2026-03-10');
      assert.equal(afterGap.current_streak, 1);
      assert.equal(afterGap.longest_streak, 4);
    });

    it('crosses month and year boundaries correctly', () => {
      StreakModel.recordActivity(USER, '2026-01-31');
      assert.equal(StreakModel.recordActivity(USER, '2026-02-01').current_streak, 2);

      resetUserProgress(OTHER);
      StreakModel.recordActivity(OTHER, '2025-12-31');
      assert.equal(StreakModel.recordActivity(OTHER, '2026-01-01').current_streak, 2);
    });

    it('reports a stale streak as zero without destroying the record', () => {
      StreakModel.recordActivity(USER, '2026-03-01');
      StreakModel.recordActivity(USER, '2026-03-02');
      const stale = StreakModel.currentFor(USER, '2026-03-20');
      assert.equal(stale.current_streak, 0);
      assert.equal(stale.longest_streak, 2);
      // Yesterday still counts as live.
      assert.equal(StreakModel.currentFor(USER, '2026-03-03').current_streak, 2);
    });
  });

  describe('XP awards', () => {
    it('credits XP and returns the new total and level', () => {
      const result = ProgressionService.award({
        userId: USER,
        amount: 120,
        sourceType: 'TASK_COMPLETED',
        sourceId: 'task_a',
        today: '2026-03-01'
      });
      assert.equal(result.awarded, 120);
      assert.equal(result.total, 120);
      assert.equal(result.level.level, 2);
      assert.equal(result.leveledUp, true);
      assert.equal(XpModel.totalFor(USER), 120);
    });

    it('never pays twice for the same source event', () => {
      ProgressionService.award({
        userId: USER, amount: 100, sourceType: 'TASK_COMPLETED', sourceId: 'task_b', today: '2026-03-01'
      });
      const repeat = ProgressionService.award({
        userId: USER, amount: 100, sourceType: 'TASK_COMPLETED', sourceId: 'task_b', today: '2026-03-01'
      });
      assert.equal(repeat.skipped, true);
      assert.equal(XpModel.totalFor(USER), 100);
    });

    it('keeps each user ledger independent', () => {
      ProgressionService.award({ userId: USER, amount: 50, sourceType: 'TASK_COMPLETED', sourceId: 't1', today: '2026-03-01' });
      ProgressionService.award({ userId: OTHER, amount: 75, sourceType: 'TASK_COMPLETED', sourceId: 't1', today: '2026-03-01' });
      assert.equal(XpModel.totalFor(USER), 50);
      assert.equal(XpModel.totalFor(OTHER), 75);
    });

    it('rejects an award with no source type', () => {
      assert.throws(() => ProgressionService.award({ userId: USER, amount: 10 }));
    });
  });

  describe('achievements', () => {
    it('unlocks on threshold and grants the badge exactly once', () => {
      db.prepare(`INSERT OR REPLACE INTO tasks (id, title, description, status, total_points) VALUES ('task_ach', 'Ach task', 'x', 'active', 10)`).run();
      db.prepare(`
        INSERT INTO task_submissions (id, task_id, submitted_by, status)
        VALUES ('sub_ach_1', 'task_ach', ?, 'APPROVED')
      `).run(USER);

      const first = ProgressionService.award({
        userId: USER, amount: 10, sourceType: 'TASK_COMPLETED', sourceId: 'task_ach', today: '2026-03-01'
      });
      const titles = first.unlocked.map((a) => a.title);
      assert.ok(titles.includes('First Steps'), `expected First Steps, got ${titles.join(', ')}`);
      assert.equal(BadgeModel.listForUser(USER).some((b) => b.id === 'bdg_first_steps'), true);

      // A later award must not re-grant it.
      const second = ProgressionService.award({
        userId: USER, amount: 10, sourceType: 'TASK_COMPLETED', sourceId: 'task_ach_2', today: '2026-03-02'
      });
      assert.equal(second.unlocked.some((a) => a.title === 'First Steps'), false);
      assert.equal(BadgeModel.listForUser(USER).filter((b) => b.id === 'bdg_first_steps').length, 1);
    });

    it('backfills achievements already satisfied by past history', () => {
      // History exists BEFORE any progression award happens.
      db.prepare(`INSERT OR REPLACE INTO tasks (id, title, description, status, total_points) VALUES ('task_bf', 'Backfill', 'x', 'active', 10)`).run();
      for (let i = 0; i < 5; i += 1) {
        db.prepare(`
          INSERT INTO task_submissions (id, task_id, submitted_by, status)
          VALUES (?, 'task_bf', ?, 'APPROVED')
        `).run(`sub_bf_${i}`, USER);
      }

      const unlocked = AchievementService.evaluateForUser(USER);
      const titles = unlocked.map((a) => a.title);
      assert.ok(titles.includes('First Steps'));
      assert.ok(titles.includes('Finisher'), 'five approvals should unlock Finisher immediately');
    });

    it('credits achievement XP and badge bonus on top of the base award', () => {
      db.prepare(`INSERT OR REPLACE INTO tasks (id, title, description, status, total_points) VALUES ('task_xp', 'XP task', 'x', 'active', 10)`).run();
      db.prepare(`
        INSERT INTO task_submissions (id, task_id, submitted_by, status)
        VALUES ('sub_xp_1', 'task_xp', ?, 'APPROVED')
      `).run(USER);

      ProgressionService.award({
        userId: USER, amount: 40, sourceType: 'TASK_COMPLETED', sourceId: 'task_xp', today: '2026-03-01'
      });

      // 40 base + 25 First Steps achievement + 10 badge bonus = 75
      assert.equal(XpModel.totalFor(USER), 75);
      const sources = XpModel.historyFor(USER).map((row) => row.source_type);
      assert.ok(sources.includes('TASK_COMPLETED'));
      assert.ok(sources.includes('ACHIEVEMENT'));
      assert.ok(sources.includes('BADGE_BONUS'));
    });

    it('reports progress for locked achievements', () => {
      const progress = AchievementService.progressFor(USER);
      const finisher = progress.find((a) => a.title === 'Finisher');
      assert.ok(finisher);
      assert.equal(finisher.unlocked, false);
      assert.equal(finisher.target, 5);
      assert.equal(finisher.progress, 0);
    });
  });

  describe('atomicity', () => {
    it('rolls the whole award back when part of it fails', () => {
      const before = XpModel.totalFor(USER);
      // recordActivity runs inside the transaction, immediately after the XP
      // insert — failing there proves the earlier write is rolled back too.
      const original = StreakModel.recordActivity;
      StreakModel.recordActivity = () => {
        throw new Error('boom');
      };
      try {
        assert.throws(
          () =>
            ProgressionService.award({
              userId: USER, amount: 500, sourceType: 'TASK_COMPLETED', sourceId: 'task_fail', today: '2026-03-01'
            }),
          /boom/
        );
      } finally {
        StreakModel.recordActivity = original;
      }
      assert.equal(XpModel.totalFor(USER), before, 'XP must not persist when the transaction fails');
      assert.equal(
        XpModel.hasAward(USER, 'TASK_COMPLETED', 'task_fail'),
        false,
        'the rolled-back award must not block a later retry'
      );

      // The same award must succeed cleanly once the fault is removed.
      const retry = ProgressionService.award({
        userId: USER, amount: 500, sourceType: 'TASK_COMPLETED', sourceId: 'task_fail', today: '2026-03-01'
      });
      assert.equal(retry.skipped, false);
      assert.equal(XpModel.totalFor(USER), before + 500);
    });
  });

  describe('HTTP surface', () => {
    let token;

    before(async () => {
      const res = await supertest(app)
        .post('/api/auth/login')
        .send({ identifier: 'prog_user', password: 'pass123' });
      token = res.body.token;
    });

    it('requires auth', async () => {
      assert.equal((await supertest(app).get('/api/progression/me')).status, 401);
      assert.equal((await supertest(app).get('/api/progression/achievements')).status, 401);
    });

    it('returns a full progression summary', async () => {
      ProgressionService.award({
        userId: USER, amount: 250, sourceType: 'TASK_COMPLETED', sourceId: 'task_http', today: '2026-03-01'
      });
      const res = await supertest(app)
        .get('/api/progression/me')
        .set('Authorization', `Bearer ${token}`);
      assert.equal(res.status, 200);
      assert.equal(res.body.level, 2);
      assert.ok(res.body.xp >= 250);
      assert.ok(Array.isArray(res.body.badges));
      assert.ok(Array.isArray(res.body.recentXp));
      assert.ok(Array.isArray(res.body.contributions));
      assert.ok(res.body.streak);
    });

    it('lists achievements with progress', async () => {
      const res = await supertest(app)
        .get('/api/progression/achievements')
        .set('Authorization', `Bearer ${token}`);
      assert.equal(res.status, 200);
      assert.ok(res.body.achievements.length >= 12);
      assert.ok(res.body.achievements.every((a) => typeof a.unlocked === 'boolean'));
    });

    it('blocks members from awarding badges manually', async () => {
      const res = await supertest(app)
        .post('/api/progression/badges/bdg_scholar/award')
        .set('Authorization', `Bearer ${token}`)
        .send({ user_id: OTHER });
      assert.equal(res.status, 403);
    });
  });
});
