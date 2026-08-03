import { db } from '../db/database.js';
import { genId } from '../utils/genId.js';

/** Answers are stored as JSON text; parse defensively. */
function parseJson(value, fallback = null) {
  if (value === null || value === undefined) return fallback;
  try {
    return JSON.parse(value);
  } catch (_) {
    return fallback;
  }
}

function hydrateQuestion(row) {
  if (!row) return null;
  return {
    ...row,
    options: parseJson(row.options, []),
    correct_answer: parseJson(row.correct_answer, row.correct_answer)
  };
}

export const QuizModel = {
  create({
    title, description = null, category = 'general', kind = 'QUIZ', difficulty = 'MEDIUM',
    timeLimitSeconds = null, xpReward = 50, passPercent = 70, maxAttempts = null,
    scheduledFor = null, isPublished = 0, createdBy
  }) {
    const id = genId('qz');
    db.prepare(`
      INSERT INTO quizzes (id, title, description, category, kind, difficulty, time_limit_seconds,
        xp_reward, pass_percent, max_attempts, scheduled_for, is_published, created_by, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `).run(id, title, description, category, kind, difficulty, timeLimitSeconds,
      xpReward, passPercent, maxAttempts, scheduledFor, isPublished ? 1 : 0, createdBy);
    return this.getById(id);
  },

  getById(id) {
    return db
      .prepare(`
        SELECT q.*, u.name AS created_by_name,
          (SELECT COUNT(*) FROM quiz_questions qq WHERE qq.quiz_id = q.id) AS question_count,
          (SELECT COALESCE(SUM(points), 0) FROM quiz_questions qq WHERE qq.quiz_id = q.id) AS max_score
        FROM quizzes q
        LEFT JOIN users u ON u.id = q.created_by
        WHERE q.id = ?
      `)
      .get(id) ?? null;
  },

  list({ kind = null, includeDrafts = false, userId = null } = {}) {
    const clauses = [];
    const params = [];
    if (!includeDrafts) clauses.push('q.is_published = 1');
    if (kind) {
      clauses.push('q.kind = ?');
      params.push(kind);
    }
    // Puzzles scheduled for a future day stay hidden until their date arrives.
    clauses.push(`(q.scheduled_for IS NULL OR date(q.scheduled_for) <= date('now'))`);

    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
    const rows = db
      .prepare(`
        SELECT q.*, u.name AS created_by_name,
          (SELECT COUNT(*) FROM quiz_questions qq WHERE qq.quiz_id = q.id) AS question_count,
          (SELECT COALESCE(SUM(points), 0) FROM quiz_questions qq WHERE qq.quiz_id = q.id) AS max_score
        FROM quizzes q
        LEFT JOIN users u ON u.id = q.created_by
        ${where}
        ORDER BY q.scheduled_for DESC, q.created_at DESC
      `)
      .all(...params);

    if (!userId) return rows;

    const stats = Object.fromEntries(
      db
        .prepare(`
          SELECT quiz_id, COUNT(*) AS attempts, MAX(percent) AS best_percent, MAX(passed) AS ever_passed
          FROM quiz_attempts WHERE user_id = ? GROUP BY quiz_id
        `)
        .all(userId)
        .map((r) => [r.quiz_id, r])
    );

    return rows.map((row) => ({
      ...row,
      attempts: stats[row.id]?.attempts || 0,
      best_percent: stats[row.id]?.best_percent ?? null,
      passed: Boolean(stats[row.id]?.ever_passed)
    }));
  },

  /** Today's puzzle, if one is scheduled and published. */
  dailyPuzzle(today = new Date().toISOString().slice(0, 10)) {
    return db
      .prepare(`
        SELECT q.*, (SELECT COUNT(*) FROM quiz_questions qq WHERE qq.quiz_id = q.id) AS question_count,
          (SELECT COALESCE(SUM(points), 0) FROM quiz_questions qq WHERE qq.quiz_id = q.id) AS max_score
        FROM quizzes q
        WHERE q.kind = 'PUZZLE' AND q.is_published = 1 AND date(q.scheduled_for) = date(?)
        LIMIT 1
      `)
      .get(today) ?? null;
  },

  update(id, fields) {
    const map = {
      title: 'title', description: 'description', category: 'category', difficulty: 'difficulty',
      timeLimitSeconds: 'time_limit_seconds', xpReward: 'xp_reward', passPercent: 'pass_percent',
      maxAttempts: 'max_attempts', scheduledFor: 'scheduled_for', isPublished: 'is_published'
    };
    const sets = [];
    const params = [];
    for (const [key, column] of Object.entries(map)) {
      if (fields[key] !== undefined) {
        sets.push(`${column} = ?`);
        params.push(key === 'isPublished' ? (fields[key] ? 1 : 0) : fields[key]);
      }
    }
    if (!sets.length) return this.getById(id);
    sets.push('updated_at = CURRENT_TIMESTAMP');
    params.push(id);
    db.prepare(`UPDATE quizzes SET ${sets.join(', ')} WHERE id = ?`).run(...params);
    return this.getById(id);
  },

  delete(id) {
    return db.prepare(`DELETE FROM quizzes WHERE id = ?`).run(id).changes > 0;
  },

  addQuestion(quizId, {
    prompt, questionType = 'MCQ', options = null, correctAnswer,
    explanation = null, codeSnippet = null, hint = null, points = 1
  }) {
    const id = genId('qq');
    const next = db
      .prepare(`SELECT COALESCE(MAX(position), -1) + 1 AS next FROM quiz_questions WHERE quiz_id = ?`)
      .get(quizId).next;
    db.prepare(`
      INSERT INTO quiz_questions (id, quiz_id, prompt, question_type, options, correct_answer,
        explanation, code_snippet, hint, points, position, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `).run(id, quizId, prompt, questionType,
      options ? JSON.stringify(options) : null,
      JSON.stringify(correctAnswer),
      explanation, codeSnippet, hint, points, next);
    return hydrateQuestion(db.prepare(`SELECT * FROM quiz_questions WHERE id = ?`).get(id));
  },

  questionsFor(quizId) {
    return db
      .prepare(`SELECT * FROM quiz_questions WHERE quiz_id = ? ORDER BY position ASC, id ASC`)
      .all(quizId)
      .map(hydrateQuestion);
  },

  deleteQuestion(id) {
    return db.prepare(`DELETE FROM quiz_questions WHERE id = ?`).run(id).changes > 0;
  },

  recordAttempt({ quizId, userId, score, maxScore, percent, passed, answers, durationSeconds }) {
    const id = genId('qa');
    db.prepare(`
      INSERT INTO quiz_attempts (id, quiz_id, user_id, score, max_score, percent, passed, answers, duration_seconds, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `).run(id, quizId, userId, score, maxScore, percent, passed ? 1 : 0,
      JSON.stringify(answers || {}), durationSeconds ?? null);
    return db.prepare(`SELECT * FROM quiz_attempts WHERE id = ?`).get(id);
  },

  attemptsFor(quizId, userId) {
    return db
      .prepare(`SELECT * FROM quiz_attempts WHERE quiz_id = ? AND user_id = ? ORDER BY created_at DESC`)
      .all(quizId, userId);
  },

  attemptCount(quizId, userId) {
    return db
      .prepare(`SELECT COUNT(*) AS n FROM quiz_attempts WHERE quiz_id = ? AND user_id = ?`)
      .get(quizId, userId).n;
  },

  hasPassed(quizId, userId) {
    const row = db
      .prepare(`SELECT 1 FROM quiz_attempts WHERE quiz_id = ? AND user_id = ? AND passed = 1 LIMIT 1`)
      .get(quizId, userId);
    return Boolean(row);
  },

  /** Per-quiz stats for author dashboards. */
  statsFor(quizId) {
    const row = db
      .prepare(`
        SELECT COUNT(*) AS attempts, COUNT(DISTINCT user_id) AS participants,
               COALESCE(AVG(percent), 0) AS avg_percent,
               SUM(passed) AS passes
        FROM quiz_attempts WHERE quiz_id = ?
      `)
      .get(quizId);
    return {
      attempts: row.attempts || 0,
      participants: row.participants || 0,
      avg_percent: Math.round(row.avg_percent || 0),
      passes: row.passes || 0
    };
  },

  leaderboard(limit = 10) {
    return db
      .prepare(`
        SELECT a.user_id, u.name, COUNT(*) AS attempts,
               SUM(a.passed) AS passed, COALESCE(AVG(a.percent), 0) AS avg_percent
        FROM quiz_attempts a
        LEFT JOIN users u ON u.id = a.user_id
        GROUP BY a.user_id
        ORDER BY passed DESC, avg_percent DESC
        LIMIT ?
      `)
      .all(limit)
      .map((r) => ({ ...r, avg_percent: Math.round(r.avg_percent) }));
  }
};
