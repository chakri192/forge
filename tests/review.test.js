import { describe, it, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import supertest from 'supertest';
import bcrypt from 'bcryptjs';
import { app } from '../src/server/app.js';
import { db, initSchema } from '../src/server/db/database.js';
import { XpModel } from '../src/server/models/Xp.js';
import { ReviewModel } from '../src/server/models/Review.js';

const MEMBER = 'u_rev_member';
const OTHER = 'u_rev_other';

describe('Structured submission review', () => {
  let memberToken, otherToken, teacherToken;
  let taskId = 'task_review';
  let criteria = [];

  before(async () => {
    initSchema();
    const passHash = bcrypt.hashSync('pass123', 10);
    const insert = db.prepare(`
      INSERT OR REPLACE INTO users (id, name, username, email, password_hash, role, tag)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    insert.run(MEMBER, 'Rev Member', 'rev_member', 'rm@forge.local', passHash, 'member', 'Member');
    insert.run(OTHER, 'Rev Other', 'rev_other', 'ro@forge.local', passHash, 'member', 'Member');
    insert.run('u_rev_teacher', 'Rev Teacher', 'rev_teacher', 'rt@forge.local', passHash, 'teacher', 'Teacher');

    const login = async (id) => {
      const res = await supertest(app).post('/api/auth/login').send({ identifier: id, password: 'pass123' });
      assert.equal(res.status, 200);
      return res.body.token;
    };
    memberToken = await login('rev_member');
    otherToken = await login('rev_other');
    teacherToken = await login('rev_teacher');
  });

  beforeEach(() => {
    db.prepare(`DELETE FROM review_scores`).run();
    db.prepare(`DELETE FROM review_comments`).run();
    db.prepare(`DELETE FROM rubric_criteria WHERE task_id = ?`).run(taskId);
    db.prepare(`DELETE FROM task_submissions WHERE task_id = ?`).run(taskId);
    db.prepare(`DELETE FROM xp_history WHERE user_id = ?`).run(MEMBER);
    db.prepare(`
      INSERT OR REPLACE INTO tasks (id, title, description, status, total_points, xp_reward)
      VALUES (?, 'Reviewable task', 'x', 'pending_review', 40, 60)
    `).run(taskId);
    criteria = [];
  });

  async function defineRubric() {
    const res = await supertest(app)
      .post(`/api/tasks/${taskId}/rubric`)
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({
        criteria: [
          { label: 'Correctness', max_score: 5, weight: 2 },
          { label: 'Readability', max_score: 5, weight: 1 }
        ]
      });
    assert.equal(res.status, 201);
    criteria = res.body.criteria;
    return criteria;
  }

  function makeSubmission(id = 'sub_review_1', submitter = MEMBER) {
    db.prepare(`
      INSERT OR REPLACE INTO task_submissions (id, task_id, submitted_by, proof_notes, status)
      VALUES (?, ?, ?, 'my work', 'PENDING')
    `).run(id, taskId, submitter);
    return id;
  }

  describe('rubric', () => {
    it('blocks members from defining one', async () => {
      const res = await supertest(app)
        .post(`/api/tasks/${taskId}/rubric`)
        .set('Authorization', `Bearer ${memberToken}`)
        .send({ criteria: [{ label: 'Sneaky' }] });
      assert.equal(res.status, 403);
    });

    it('lets a teacher define weighted criteria', async () => {
      const defined = await defineRubric();
      assert.equal(defined.length, 2);
      assert.equal(defined[0].label, 'Correctness');
      assert.equal(defined[0].weight, 2);
      assert.equal(defined[0].position, 0);
    });

    it('rejects an empty rubric', async () => {
      const res = await supertest(app)
        .post(`/api/tasks/${taskId}/rubric`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({ criteria: [] });
      assert.equal(res.status, 400);
    });
  });

  describe('reviewing', () => {
    it('requires a reviewer role', async () => {
      await defineRubric();
      const sub = makeSubmission();
      const res = await supertest(app)
        .post(`/api/submissions/${sub}/review`)
        .set('Authorization', `Bearer ${memberToken}`)
        .send({ verdict: 'approve' });
      assert.equal(res.status, 403);
    });

    it('refuses to approve without scoring every criterion', async () => {
      await defineRubric();
      const sub = makeSubmission();
      const res = await supertest(app)
        .post(`/api/submissions/${sub}/review`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({ verdict: 'approve', scores: [{ criterion_id: criteria[0].id, score: 5 }] });
      assert.equal(res.status, 400);
      assert.match(res.body.error, /every criterion/i);
    });

    it('rejects a score above the criterion maximum', async () => {
      await defineRubric();
      const sub = makeSubmission();
      const res = await supertest(app)
        .post(`/api/submissions/${sub}/review`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({
          verdict: 'approve',
          scores: [
            { criterion_id: criteria[0].id, score: 99 },
            { criterion_id: criteria[1].id, score: 5 }
          ]
        });
      assert.equal(res.status, 400);
      assert.match(res.body.error, /between 0 and 5/);
    });

    it('rejects a criterion belonging to another task', async () => {
      await defineRubric();
      db.prepare(`INSERT OR REPLACE INTO tasks (id, title, description, status, total_points) VALUES ('task_other', 'Other', 'x', 'active', 10)`).run();
      const foreign = await supertest(app)
        .post('/api/tasks/task_other/rubric')
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({ criteria: [{ label: 'Foreign' }] });

      const sub = makeSubmission();
      const res = await supertest(app)
        .post(`/api/submissions/${sub}/review`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({ verdict: 'request_changes', scores: [{ criterion_id: foreign.body.criteria[0].id, score: 1 }] });
      assert.equal(res.status, 400);
      assert.match(res.body.error, /another task/);
    });

    it('computes a weighted percentage and awards XP on approval', async () => {
      await defineRubric();
      const sub = makeSubmission();

      // Correctness 4/5 at weight 2, Readability 5/5 at weight 1
      // => ((0.8*2) + (1.0*1)) / 3 = 86.67% -> 87
      const res = await supertest(app)
        .post(`/api/submissions/${sub}/review`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({
          verdict: 'approve',
          comment: 'Solid work.',
          scores: [
            { criterion_id: criteria[0].id, score: 4, note: 'One edge case missed' },
            { criterion_id: criteria[1].id, score: 5 }
          ]
        });

      assert.equal(res.status, 200);
      assert.equal(res.body.status, 'APPROVED');
      assert.equal(res.body.result.percent, 87);
      assert.ok(XpModel.totalFor(MEMBER) > 0, 'approval should run the progression path');

      const task = db.prepare(`SELECT status FROM tasks WHERE id = ?`).get(taskId);
      assert.equal(task.status, 'completed');
    });

    it('sends work back on request_changes without awarding XP', async () => {
      await defineRubric();
      const sub = makeSubmission();

      const res = await supertest(app)
        .post(`/api/submissions/${sub}/review`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({
          verdict: 'request_changes',
          comment: 'Please handle the empty case.',
          scores: [{ criterion_id: criteria[0].id, score: 2 }]
        });

      assert.equal(res.status, 200);
      assert.equal(res.body.status, 'CHANGES_REQUESTED');
      assert.equal(XpModel.totalFor(MEMBER), 0, 'requesting changes must not award XP');

      const task = db.prepare(`SELECT status FROM tasks WHERE id = ?`).get(taskId);
      assert.equal(task.status, 'in_progress', 'the task returns to the submitter');
    });

    it('notifies the submitter', async () => {
      await defineRubric();
      const sub = makeSubmission();
      await supertest(app)
        .post(`/api/submissions/${sub}/review`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({ verdict: 'request_changes', scores: [{ criterion_id: criteria[0].id, score: 1 }] });

      const notifications = await supertest(app)
        .get('/api/notifications')
        .set('Authorization', `Bearer ${memberToken}`);
      assert.ok(notifications.body.some((n) => /changes requested/i.test(n.title)));
    });

    it('refuses to review an already-approved submission', async () => {
      await defineRubric();
      const sub = makeSubmission();
      const scores = criteria.map((c) => ({ criterion_id: c.id, score: 5 }));

      const first = await supertest(app)
        .post(`/api/submissions/${sub}/review`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({ verdict: 'approve', scores });
      assert.equal(first.status, 200);

      const second = await supertest(app)
        .post(`/api/submissions/${sub}/review`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({ verdict: 'approve', scores });
      assert.equal(second.status, 409);
    });

    it('rolls the whole review back if any part fails', async () => {
      await defineRubric();
      const sub = makeSubmission();
      const original = ReviewModel.setStatus;
      ReviewModel.setStatus = () => { throw new Error('boom'); };
      try {
        await supertest(app)
          .post(`/api/submissions/${sub}/review`)
          .set('Authorization', `Bearer ${teacherToken}`)
          .send({ verdict: 'request_changes', scores: [{ criterion_id: criteria[0].id, score: 3 }] });
      } finally {
        ReviewModel.setStatus = original;
      }
      assert.equal(ReviewModel.scoresFor(sub).length, 0, 'scores must not survive a failed review');
    });
  });

  describe('visibility and discussion', () => {
    it('lets the submitter read their own feedback but not a stranger', async () => {
      await defineRubric();
      const sub = makeSubmission();
      await supertest(app)
        .post(`/api/submissions/${sub}/review`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({ verdict: 'request_changes', comment: 'See notes', scores: [{ criterion_id: criteria[0].id, score: 3 }] });

      const own = await supertest(app)
        .get(`/api/submissions/${sub}/review`)
        .set('Authorization', `Bearer ${memberToken}`);
      assert.equal(own.status, 200);
      assert.equal(own.body.comments.length, 1);

      const stranger = await supertest(app)
        .get(`/api/submissions/${sub}/review`)
        .set('Authorization', `Bearer ${otherToken}`);
      assert.equal(stranger.status, 403);
    });

    it('supports a threaded reply from the submitter', async () => {
      const sub = makeSubmission();
      const res = await supertest(app)
        .post(`/api/submissions/${sub}/comments`)
        .set('Authorization', `Bearer ${memberToken}`)
        .send({ body: 'Fixed the empty case, please re-check.' });
      assert.equal(res.status, 201);
      assert.equal(res.body.comment.author_name, 'Rev Member');

      const stranger = await supertest(app)
        .post(`/api/submissions/${sub}/comments`)
        .set('Authorization', `Bearer ${otherToken}`)
        .send({ body: 'butting in' });
      assert.equal(stranger.status, 403);
    });

    it('exposes the pending queue to reviewers only, oldest first', async () => {
      makeSubmission('sub_q1');
      makeSubmission('sub_q2');

      const denied = await supertest(app)
        .get('/api/reviews/queue')
        .set('Authorization', `Bearer ${memberToken}`);
      assert.equal(denied.status, 403);

      const queue = await supertest(app)
        .get('/api/reviews/queue')
        .set('Authorization', `Bearer ${teacherToken}`);
      assert.equal(queue.status, 200);
      assert.ok(queue.body.submissions.length >= 2);
      const times = queue.body.submissions.map((s) => s.created_at);
      assert.deepEqual(times, [...times].sort());
    });
  });
});
