import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import supertest from 'supertest';
import bcrypt from 'bcryptjs';
import { app } from '../src/server/app.js';
import { db, initSchema } from '../src/server/db/database.js';
import { AnalyticsService } from '../src/server/services/analyticsService.js';

describe('Calendar, journal, and analytics', () => {
  let memberToken, otherToken, teacherToken;
  let eventId, entryId;
  const memberId = 'u_cohort_member';
  const otherId = 'u_cohort_other';

  before(async () => {
    initSchema();
    const passHash = bcrypt.hashSync('pass123', 10);
    const insert = db.prepare(`
      INSERT OR REPLACE INTO users (id, name, username, email, password_hash, role, tag)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    insert.run(memberId, 'Cohort Member', 'cohort_member', 'cm@forge.local', passHash, 'member', 'Member');
    insert.run(otherId, 'Cohort Other', 'cohort_other', 'co@forge.local', passHash, 'member', 'Member');
    insert.run('u_cohort_teacher', 'Cohort Teacher', 'cohort_teacher', 'ct@forge.local', passHash, 'teacher', 'Teacher');

    const login = async (identifier) => {
      const res = await supertest(app).post('/api/auth/login').send({ identifier, password: 'pass123' });
      assert.equal(res.status, 200);
      return res.body.token;
    };
    memberToken = await login('cohort_member');
    otherToken = await login('cohort_other');
    teacherToken = await login('cohort_teacher');
  });

  describe('calendar', () => {
    it('requires auth and blocks members from creating events', async () => {
      assert.equal((await supertest(app).get('/api/calendar')).status, 401);

      const res = await supertest(app)
        .post('/api/calendar')
        .set('Authorization', `Bearer ${memberToken}`)
        .send({ title: 'Sneaky', start_time: '2026-09-01T10:00:00Z', end_time: '2026-09-01T11:00:00Z' });
      assert.equal(res.status, 403);
    });

    it('lets a teacher create an event', async () => {
      const res = await supertest(app)
        .post('/api/calendar')
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({
          title: 'Sprint demo',
          description: 'Show your work',
          start_time: '2026-09-01T10:00:00Z',
          end_time: '2026-09-01T11:00:00Z',
          location: 'Main hall',
          event_type: 'WORKSHOP'
        });
      assert.equal(res.status, 201);
      assert.match(res.body.event.id, /^evt_/);
      assert.equal(res.body.event.event_type, 'WORKSHOP');
      eventId = res.body.event.id;
    });

    it('rejects an end before the start and a bad event type', async () => {
      const backwards = await supertest(app)
        .post('/api/calendar')
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({ title: 'Backwards', start_time: '2026-09-02T12:00:00Z', end_time: '2026-09-02T09:00:00Z' });
      assert.equal(backwards.status, 400);

      const badType = await supertest(app)
        .post('/api/calendar')
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({
          title: 'Bad type', start_time: '2026-09-02T09:00:00Z',
          end_time: '2026-09-02T10:00:00Z', event_type: 'PARTY'
        });
      assert.equal(badType.status, 400);
    });

    it('merges task deadlines into the timeline', async () => {
      db.prepare(`
        INSERT OR REPLACE INTO tasks (id, title, description, status, total_points, deadline, assigned_user_id)
        VALUES ('task_deadline', 'Ship the thing', 'x', 'active', 40, '2026-09-03T17:00:00Z', ?)
      `).run(memberId);

      const res = await supertest(app)
        .get('/api/calendar')
        .set('Authorization', `Bearer ${memberToken}`);
      assert.equal(res.status, 200);

      const deadline = res.body.events.find((e) => e.task_id === 'task_deadline');
      assert.ok(deadline, 'task deadline should appear on the calendar');
      assert.equal(deadline.event_type, 'DEADLINE');
      assert.equal(deadline.source, 'task');

      const event = res.body.events.find((e) => e.id === eventId);
      assert.ok(event);
      assert.equal(event.source, 'event');

      // Merged results stay chronologically ordered.
      const times = res.body.events.map((e) => String(e.start_time));
      assert.deepEqual(times, [...times].sort());
    });

    it('excludes completed tasks from deadlines', async () => {
      db.prepare(`UPDATE tasks SET status = 'completed' WHERE id = 'task_deadline'`).run();
      const res = await supertest(app)
        .get('/api/calendar')
        .set('Authorization', `Bearer ${memberToken}`);
      assert.equal(res.body.events.some((e) => e.task_id === 'task_deadline'), false);
      db.prepare(`UPDATE tasks SET status = 'active' WHERE id = 'task_deadline'`).run();
    });

    it('scopes team events to team members', async () => {
      db.prepare(`INSERT OR REPLACE INTO teams (id, name) VALUES ('t_cohort', 'Cohort Squad')`).run();
      db.prepare(`INSERT OR REPLACE INTO team_memberships (id, user_id, team_id) VALUES ('tm_cohort', ?, 't_cohort')`)
        .run(memberId);

      const created = await supertest(app)
        .post('/api/calendar')
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({
          title: 'Squad standup', start_time: '2026-09-04T09:00:00Z',
          end_time: '2026-09-04T09:15:00Z', team_id: 't_cohort'
        });
      assert.equal(created.status, 201);

      const asMember = await supertest(app).get('/api/calendar').set('Authorization', `Bearer ${memberToken}`);
      assert.ok(asMember.body.events.some((e) => e.title === 'Squad standup'));

      const asOutsider = await supertest(app).get('/api/calendar').set('Authorization', `Bearer ${otherToken}`);
      assert.equal(asOutsider.body.events.some((e) => e.title === 'Squad standup'), false);
    });

    it('restricts edits to the organiser or a teacher', async () => {
      const res = await supertest(app)
        .patch(`/api/calendar/${eventId}`)
        .set('Authorization', `Bearer ${memberToken}`)
        .send({ title: 'Hijacked' });
      assert.equal(res.status, 403);

      const ok = await supertest(app)
        .patch(`/api/calendar/${eventId}`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({ title: 'Sprint demo (updated)' });
      assert.equal(ok.status, 200);
      assert.equal(ok.body.event.title, 'Sprint demo (updated)');
    });
  });

  describe('journal (private)', () => {
    it('creates an entry', async () => {
      const res = await supertest(app)
        .post('/api/journal')
        .set('Authorization', `Bearer ${memberToken}`)
        .send({ title: 'Week 1 retro', content: 'Flexbox finally clicked.', mood: 'good', tags: 'css,learning' });
      assert.equal(res.status, 201);
      assert.match(res.body.entry.id, /^jrn_/);
      entryId = res.body.entry.id;
    });

    it('never exposes another user\'s entries', async () => {
      const list = await supertest(app).get('/api/journal').set('Authorization', `Bearer ${otherToken}`);
      assert.equal(list.status, 200);
      assert.equal(list.body.entries.some((e) => e.id === entryId), false);

      // Reads as 404, not 403 — the entry's existence is itself private.
      const read = await supertest(app)
        .patch(`/api/journal/${entryId}`)
        .set('Authorization', `Bearer ${otherToken}`)
        .send({ content: 'peeking' });
      assert.equal(read.status, 404);

      const del = await supertest(app)
        .delete(`/api/journal/${entryId}`)
        .set('Authorization', `Bearer ${otherToken}`);
      assert.equal(del.status, 404);
    });

    it('lets the owner edit and delete', async () => {
      const edit = await supertest(app)
        .patch(`/api/journal/${entryId}`)
        .set('Authorization', `Bearer ${memberToken}`)
        .send({ content: 'Flexbox clicked, grid still fuzzy.' });
      assert.equal(edit.status, 200);
      assert.match(edit.body.entry.content, /grid still fuzzy/);

      const del = await supertest(app)
        .delete(`/api/journal/${entryId}`)
        .set('Authorization', `Bearer ${memberToken}`);
      assert.equal(del.status, 200);
    });

    it('validates entry payloads', async () => {
      const res = await supertest(app)
        .post('/api/journal')
        .set('Authorization', `Bearer ${memberToken}`)
        .send({ title: '', content: '' });
      assert.equal(res.status, 400);
    });
  });

  describe('analytics', () => {
    it('is teacher/admin only', async () => {
      assert.equal((await supertest(app).get('/api/analytics')).status, 401);
      const asMember = await supertest(app)
        .get('/api/analytics')
        .set('Authorization', `Bearer ${memberToken}`);
      assert.equal(asMember.status, 403);
    });

    it('returns a cohort overview with a completion rate', async () => {
      const res = await supertest(app)
        .get('/api/analytics')
        .set('Authorization', `Bearer ${teacherToken}`);
      assert.equal(res.status, 200);
      assert.ok(res.body.overview.members >= 3);
      assert.ok(typeof res.body.overview.completion_rate === 'number');
      assert.ok(Array.isArray(res.body.trend));
      assert.ok(Array.isArray(res.body.members));
      assert.ok(res.body.review_latency);
    });

    it('flags members with no activity as high risk', async () => {
      const breakdown = AnalyticsService.memberBreakdown();
      const other = breakdown.find((m) => m.id === otherId);
      assert.ok(other);
      assert.ok(other.risks.includes('never_active') || other.risks.includes('no_submissions'));

      const atRisk = await supertest(app)
        .get('/api/analytics/at-risk')
        .set('Authorization', `Bearer ${teacherToken}`);
      assert.equal(atRisk.status, 200);
      assert.ok(atRisk.body.members.every((m) => m.risk_level !== 'none'));
    });

    it('sorts the highest-risk members first', async () => {
      const breakdown = AnalyticsService.memberBreakdown();
      const order = { high: 0, medium: 1, none: 2 };
      for (let i = 1; i < breakdown.length; i += 1) {
        assert.ok(
          order[breakdown[i - 1].risk_level] <= order[breakdown[i].risk_level],
          'risk ordering must be monotonic'
        );
      }
    });

    it('computes review latency without dividing by zero', () => {
      const latency = AnalyticsService.reviewLatency();
      assert.ok(latency.count >= 0);
      if (latency.count === 0) assert.equal(latency.median_hours, null);
    });
  });
});
