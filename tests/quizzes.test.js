import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import supertest from 'supertest';
import bcrypt from 'bcryptjs';
import { app } from '../src/server/app.js';
import { db, initSchema } from '../src/server/db/database.js';
import { seedQuizzes } from '../src/server/db/seedQuizzes.js';
import { gradeAnswer } from '../src/server/services/quizService.js';
import { QuizModel } from '../src/server/models/Quiz.js';
import { XpModel } from '../src/server/models/Xp.js';

const MEMBER = 'u_quiz_member';

describe('Quizzes and puzzles', () => {
  let memberToken, leaderToken;
  let quizId;

  before(async () => {
    initSchema();
    seedQuizzes();
    const passHash = bcrypt.hashSync('pass123', 10);
    const insert = db.prepare(`
      INSERT OR REPLACE INTO users (id, name, username, email, password_hash, role, tag)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    insert.run(MEMBER, 'Quiz Member', 'quiz_member', 'qm@forge.local', passHash, 'member', 'Member');
    insert.run('u_quiz_leader', 'Quiz Leader', 'quiz_leader', 'ql@forge.local', passHash, 'leader', 'Leader');

    const login = async (identifier) => {
      const res = await supertest(app).post('/api/auth/login').send({ identifier, password: 'pass123' });
      assert.equal(res.status, 200);
      return res.body.token;
    };
    memberToken = await login('quiz_member');
    leaderToken = await login('quiz_leader');
  });

  describe('grading logic', () => {
    it('grades MCQ case- and whitespace-insensitively', () => {
      const q = { question_type: 'MCQ', correct_answer: '"object"' };
      assert.equal(gradeAnswer(q, '"object"'), true);
      assert.equal(gradeAnswer(q, '  "OBJECT" '), true);
      assert.equal(gradeAnswer(q, '"undefined"'), false);
    });

    it('grades MULTI as order-independent set equality', () => {
      const q = { question_type: 'MULTI', correct_answer: ['let', 'const'] };
      assert.equal(gradeAnswer(q, ['const', 'let']), true);
      assert.equal(gradeAnswer(q, ['let', 'const']), true);
      // A superset is wrong, not partially right.
      assert.equal(gradeAnswer(q, ['let', 'const', 'var']), false);
      // A subset is wrong too.
      assert.equal(gradeAnswer(q, ['let']), false);
    });

    it('accepts any listed variant for short answers', () => {
      const q = { question_type: 'SHORT_ANSWER', correct_answer: ['minmax', 'minmax()'] };
      assert.equal(gradeAnswer(q, 'minmax'), true);
      assert.equal(gradeAnswer(q, 'MinMax()'), true);
      assert.equal(gradeAnswer(q, 'repeat'), false);
    });

    it('normalises truthy spellings for true/false', () => {
      const q = { question_type: 'TRUE_FALSE', correct_answer: 'true' };
      assert.equal(gradeAnswer(q, 'true'), true);
      assert.equal(gradeAnswer(q, 'YES'), true);
      assert.equal(gradeAnswer(q, '1'), true);
      assert.equal(gradeAnswer(q, 'false'), false);
    });

    it('collapses internal whitespace for code output', () => {
      const q = { question_type: 'CODE_OUTPUT', correct_answer: ['3 3 3'] };
      assert.equal(gradeAnswer(q, '3 3 3'), true);
      assert.equal(gradeAnswer(q, '3   3   3'), true);
      assert.equal(gradeAnswer(q, '0 1 2'), false);
    });

    it('treats a missing answer as incorrect rather than throwing', () => {
      const q = { question_type: 'MCQ', correct_answer: 'a' };
      assert.equal(gradeAnswer(q, undefined), false);
      assert.equal(gradeAnswer(q, null), false);
    });
  });

  describe('playing a quiz', () => {
    it('requires auth', async () => {
      assert.equal((await supertest(app).get('/api/quizzes')).status, 401);
    });

    it('lists published quizzes with the seeded content', async () => {
      const res = await supertest(app).get('/api/quizzes').set('Authorization', `Bearer ${memberToken}`);
      assert.equal(res.status, 200);
      assert.ok(res.body.quizzes.length >= 3);
      const fundamentals = res.body.quizzes.find((q) => q.id === 'qz_js_fundamentals');
      assert.ok(fundamentals);
      assert.equal(fundamentals.question_count, 4);
      assert.equal(fundamentals.max_score, 6);
      quizId = fundamentals.id;
    });

    it('NEVER exposes correct answers or explanations to players', async () => {
      const res = await supertest(app)
        .get(`/api/quizzes/${quizId}`)
        .set('Authorization', `Bearer ${memberToken}`);
      assert.equal(res.status, 200);
      assert.ok(res.body.questions.length > 0);

      for (const question of res.body.questions) {
        assert.equal(question.correct_answer, undefined, 'correct_answer leaked to the player');
        assert.equal(question.explanation, undefined, 'explanation leaked to the player');
      }
      // Belt and braces: the serialized payload must not contain the answer text.
      assert.equal(JSON.stringify(res.body).includes('correct_answer'), false);
    });

    it('blocks members from the author view', async () => {
      const res = await supertest(app)
        .get(`/api/quizzes/${quizId}/edit`)
        .set('Authorization', `Bearer ${memberToken}`);
      assert.equal(res.status, 403);
    });

    it('grades a perfect submission and awards XP', async () => {
      const questions = QuizModel.questionsFor(quizId);
      const answers = {};
      for (const q of questions) {
        answers[q.id] = Array.isArray(q.correct_answer) && q.question_type !== 'MULTI'
          ? q.correct_answer[0]
          : q.correct_answer;
      }

      const before = XpModel.totalFor(MEMBER);
      const res = await supertest(app)
        .post(`/api/quizzes/${quizId}/submit`)
        .set('Authorization', `Bearer ${memberToken}`)
        .send({ answers, duration_seconds: 45 });

      assert.equal(res.status, 200);
      assert.equal(res.body.percent, 100);
      assert.equal(res.body.passed, true);
      assert.equal(res.body.score, res.body.max_score);
      assert.ok(XpModel.totalFor(MEMBER) > before, 'passing should award XP');

      // The result IS allowed to reveal answers — that is the teaching moment.
      assert.ok(res.body.results.every((r) => r.explanation !== undefined));
    });

    it('does not pay XP twice for the same quiz', async () => {
      const questions = QuizModel.questionsFor(quizId);
      const answers = {};
      for (const q of questions) {
        answers[q.id] = Array.isArray(q.correct_answer) && q.question_type !== 'MULTI'
          ? q.correct_answer[0]
          : q.correct_answer;
      }
      const before = XpModel.totalFor(MEMBER);
      const res = await supertest(app)
        .post(`/api/quizzes/${quizId}/submit`)
        .set('Authorization', `Bearer ${memberToken}`)
        .send({ answers });
      assert.equal(res.body.already_passed, true);
      assert.equal(XpModel.totalFor(MEMBER), before, 'a repeat pass must not pay again');
    });

    it('scores a wrong submission as a failure without XP', async () => {
      const target = 'qz_css_layout';
      const questions = QuizModel.questionsFor(target);
      const answers = Object.fromEntries(questions.map((q) => [q.id, 'definitely wrong']));

      const before = XpModel.totalFor(MEMBER);
      const res = await supertest(app)
        .post(`/api/quizzes/${target}/submit`)
        .set('Authorization', `Bearer ${memberToken}`)
        .send({ answers });

      assert.equal(res.status, 200);
      assert.equal(res.body.score, 0);
      assert.equal(res.body.percent, 0);
      assert.equal(res.body.passed, false);
      assert.equal(XpModel.totalFor(MEMBER), before, 'failing must not award XP');
    });

    it('records every attempt for review', async () => {
      const res = await supertest(app)
        .get(`/api/quizzes/${quizId}/attempts`)
        .set('Authorization', `Bearer ${memberToken}`);
      assert.equal(res.status, 200);
      assert.ok(res.body.attempts.length >= 2);
      assert.ok(res.body.attempts.every((a) => a.user_id === MEMBER));
    });

    it('404s on an unknown quiz', async () => {
      const res = await supertest(app)
        .get('/api/quizzes/qz_missing')
        .set('Authorization', `Bearer ${memberToken}`);
      assert.equal(res.status, 404);
    });
  });

  describe('daily puzzle', () => {
    it('serves the puzzle scheduled for today', async () => {
      const res = await supertest(app)
        .get('/api/quizzes/daily')
        .set('Authorization', `Bearer ${memberToken}`);
      assert.equal(res.status, 200);
      assert.ok(res.body.puzzle, 'a puzzle should be scheduled for today');
      assert.equal(res.body.puzzle.kind, 'PUZZLE');
      assert.equal(res.body.solved, false);
    });

    it('marks the puzzle solved once passed', async () => {
      const daily = (
        await supertest(app).get('/api/quizzes/daily').set('Authorization', `Bearer ${memberToken}`)
      ).body.puzzle;
      const questions = QuizModel.questionsFor(daily.id);
      const answers = Object.fromEntries(
        questions.map((q) => [q.id, Array.isArray(q.correct_answer) ? q.correct_answer[0] : q.correct_answer])
      );

      const submitted = await supertest(app)
        .post(`/api/quizzes/${daily.id}/submit`)
        .set('Authorization', `Bearer ${memberToken}`)
        .send({ answers });
      assert.equal(submitted.body.passed, true);

      const after = await supertest(app)
        .get('/api/quizzes/daily')
        .set('Authorization', `Bearer ${memberToken}`);
      assert.equal(after.body.solved, true);
    });

    it('hides puzzles scheduled for a future date from players', async () => {
      db.prepare(`
        INSERT OR REPLACE INTO quizzes (id, title, description, category, kind, difficulty, xp_reward, pass_percent, scheduled_for, is_published)
        VALUES ('pz_future', 'Tomorrow', 'x', 'general', 'PUZZLE', 'EASY', 10, 70, date('now', '+7 days'), 1)
      `).run();

      const list = await supertest(app).get('/api/quizzes').set('Authorization', `Bearer ${memberToken}`);
      assert.equal(list.body.quizzes.some((q) => q.id === 'pz_future'), false);

      const direct = await supertest(app)
        .get('/api/quizzes/pz_future')
        .set('Authorization', `Bearer ${memberToken}`);
      assert.equal(direct.status, 403);
    });
  });

  describe('authoring', () => {
    let authoredId;

    it('blocks members from creating quizzes', async () => {
      const res = await supertest(app)
        .post('/api/quizzes')
        .set('Authorization', `Bearer ${memberToken}`)
        .send({ title: 'Sneaky quiz' });
      assert.equal(res.status, 403);
    });

    it('lets a leader author a quiz with questions', async () => {
      const created = await supertest(app)
        .post('/api/quizzes')
        .set('Authorization', `Bearer ${leaderToken}`)
        .send({ title: 'Testing Fundamentals', category: 'testing', xp_reward: 40, is_published: true });
      assert.equal(created.status, 201);
      authoredId = created.body.quiz.id;

      const question = await supertest(app)
        .post(`/api/quizzes/${authoredId}/questions`)
        .set('Authorization', `Bearer ${leaderToken}`)
        .send({
          prompt: 'What does a unit test isolate?',
          question_type: 'MCQ',
          options: ['One unit of behaviour', 'The whole system', 'The database', 'The network'],
          correct_answer: 'One unit of behaviour',
          explanation: 'Unit tests target one behaviour with its collaborators controlled.',
          points: 2
        });
      assert.equal(question.status, 201);
      assert.equal(question.body.question.points, 2);
    });

    it('rejects a multiple-choice question with too few options', async () => {
      const res = await supertest(app)
        .post(`/api/quizzes/${authoredId}/questions`)
        .set('Authorization', `Bearer ${leaderToken}`)
        .send({ prompt: 'Bad question', question_type: 'MCQ', options: ['only one'], correct_answer: 'only one' });
      assert.equal(res.status, 400);
    });

    it('validates quiz payloads', async () => {
      const res = await supertest(app)
        .post('/api/quizzes')
        .set('Authorization', `Bearer ${leaderToken}`)
        .send({ title: 'x', pass_percent: 250 });
      assert.equal(res.status, 400);
    });

    it('refuses to grade a quiz with no questions', async () => {
      const empty = await supertest(app)
        .post('/api/quizzes')
        .set('Authorization', `Bearer ${leaderToken}`)
        .send({ title: 'Empty quiz', is_published: true });
      const res = await supertest(app)
        .post(`/api/quizzes/${empty.body.quiz.id}/submit`)
        .set('Authorization', `Bearer ${memberToken}`)
        .send({ answers: {} });
      assert.equal(res.status, 400);
    });

    it('shows the author view with answers and stats', async () => {
      const res = await supertest(app)
        .get(`/api/quizzes/${authoredId}/edit`)
        .set('Authorization', `Bearer ${leaderToken}`);
      assert.equal(res.status, 200);
      assert.ok(res.body.questions[0].correct_answer);
      assert.ok(res.body.stats);
    });
  });

  describe('attempt limits', () => {
    it('stops a player once max_attempts is reached', async () => {
      const created = await supertest(app)
        .post('/api/quizzes')
        .set('Authorization', `Bearer ${leaderToken}`)
        .send({ title: 'One shot', is_published: true, max_attempts: 1, pass_percent: 100 });
      const id = created.body.quiz.id;
      await supertest(app)
        .post(`/api/quizzes/${id}/questions`)
        .set('Authorization', `Bearer ${leaderToken}`)
        .send({ prompt: 'Pick A', question_type: 'MCQ', options: ['A', 'B'], correct_answer: 'A' });

      const first = await supertest(app)
        .post(`/api/quizzes/${id}/submit`)
        .set('Authorization', `Bearer ${memberToken}`)
        .send({ answers: {} });
      assert.equal(first.status, 200);

      const second = await supertest(app)
        .post(`/api/quizzes/${id}/submit`)
        .set('Authorization', `Bearer ${memberToken}`)
        .send({ answers: {} });
      assert.equal(second.status, 403);

      const play = await supertest(app)
        .get(`/api/quizzes/${id}`)
        .set('Authorization', `Bearer ${memberToken}`);
      assert.equal(play.status, 403);
    });
  });
});
