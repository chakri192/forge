import { QuizModel } from '../models/Quiz.js';
import { hasRole } from '../middleware/rbac.js';
import { ProgressionService } from './progressionService.js';
import { ActivityService } from './activity.js';

const AUTHOR_ROLES = ['leader', 'teacher', 'admin'];

function canAuthor(user) {
  return hasRole(user, AUTHOR_ROLES);
}

function normalize(value) {
  return String(value ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
}

/**
 * Grade one submitted answer. Returns true only on an exact match under the
 * rules for that question type.
 */
export function gradeAnswer(question, submitted) {
  const expected = question.correct_answer;

  switch (question.question_type) {
    case 'MULTI': {
      // Order-independent set equality — every correct option and nothing else.
      const expectedSet = new Set((Array.isArray(expected) ? expected : [expected]).map(normalize));
      const gotSet = new Set((Array.isArray(submitted) ? submitted : [submitted]).map(normalize));
      if (expectedSet.size !== gotSet.size) return false;
      for (const value of expectedSet) if (!gotSet.has(value)) return false;
      return true;
    }

    case 'SHORT_ANSWER':
    case 'CODE_OUTPUT': {
      // An array of accepted answers allows for spelling/format variants.
      const accepted = Array.isArray(expected) ? expected : [expected];
      return accepted.some((candidate) => normalize(candidate) === normalize(submitted));
    }

    case 'TRUE_FALSE': {
      const truthy = (v) => ['true', 't', 'yes', '1'].includes(normalize(v));
      return truthy(expected) === truthy(submitted);
    }

    case 'MCQ':
    default:
      return normalize(Array.isArray(expected) ? expected[0] : expected) === normalize(submitted);
  }
}

export const QuizService = {
  list(user, { kind } = {}) {
    return QuizModel.list({ kind, includeDrafts: canAuthor(user), userId: user.id });
  },

  /**
   * Questions as the player should see them: no correct answers, no
   * explanations. Those only ever appear in a grading result.
   */
  getForPlay(user, quizId) {
    const quiz = QuizModel.getById(quizId);
    if (!quiz) throw { status: 404, message: 'Quiz not found' };
    if (!quiz.is_published && !canAuthor(user)) {
      throw { status: 404, message: 'Quiz not found' };
    }
    if (quiz.scheduled_for && new Date(quiz.scheduled_for) > new Date() && !canAuthor(user)) {
      throw { status: 403, message: 'This puzzle is not available yet' };
    }

    const attempts = QuizModel.attemptCount(quizId, user.id);
    if (quiz.max_attempts && attempts >= quiz.max_attempts) {
      throw { status: 403, message: `You have used all ${quiz.max_attempts} attempts` };
    }

    const questions = QuizModel.questionsFor(quizId).map((q) => ({
      id: q.id,
      prompt: q.prompt,
      question_type: q.question_type,
      options: q.options || [],
      code_snippet: q.code_snippet,
      hint: q.hint,
      points: q.points,
      position: q.position
    }));

    return { quiz, questions, attempts_used: attempts };
  },

  /** Full detail including answers — authors only. */
  getForEdit(user, quizId) {
    if (!canAuthor(user)) throw { status: 403, message: 'Only leaders and above can edit quizzes' };
    const quiz = QuizModel.getById(quizId);
    if (!quiz) throw { status: 404, message: 'Quiz not found' };
    return { quiz, questions: QuizModel.questionsFor(quizId), stats: QuizModel.statsFor(quizId) };
  },

  /**
   * Grade a submission server-side and award XP the first time it is passed.
   * Repeat passes are recorded but never pay out again — the XP source id is
   * the quiz, so ProgressionService enforces that.
   */
  submit(user, quizId, { answers = {}, durationSeconds = null }) {
    const quiz = QuizModel.getById(quizId);
    if (!quiz) throw { status: 404, message: 'Quiz not found' };
    if (!quiz.is_published && !canAuthor(user)) throw { status: 404, message: 'Quiz not found' };

    const priorAttempts = QuizModel.attemptCount(quizId, user.id);
    if (quiz.max_attempts && priorAttempts >= quiz.max_attempts) {
      throw { status: 403, message: `You have used all ${quiz.max_attempts} attempts` };
    }

    const questions = QuizModel.questionsFor(quizId);
    if (!questions.length) throw { status: 400, message: 'This quiz has no questions yet' };

    let score = 0;
    let maxScore = 0;
    const results = questions.map((question) => {
      maxScore += question.points;
      const submitted = answers[question.id];
      const correct = submitted !== undefined && gradeAnswer(question, submitted);
      if (correct) score += question.points;
      return {
        question_id: question.id,
        prompt: question.prompt,
        correct,
        submitted: submitted ?? null,
        correct_answer: question.correct_answer,
        explanation: question.explanation
      };
    });

    const percent = maxScore > 0 ? Math.round((score / maxScore) * 100) : 0;
    const passed = percent >= (quiz.pass_percent || 0);
    const alreadyPassed = QuizModel.hasPassed(quizId, user.id);

    const attempt = QuizModel.recordAttempt({
      quizId, userId: user.id, score, maxScore, percent, passed, answers, durationSeconds
    });

    ActivityService.logActivity({
      userId: user.id,
      action: quiz.kind === 'PUZZLE' ? 'PUZZLE_ATTEMPT' : 'QUIZ_ATTEMPT',
      entityType: 'QUIZ',
      entityId: quizId,
      details: { description: `${user.name} scored ${percent}% on "${quiz.title}"` }
    });

    // Scale the reward by accuracy so a bare pass earns less than a perfect run.
    let progression = null;
    if (passed && !alreadyPassed) {
      const amount = Math.max(1, Math.round((quiz.xp_reward || 0) * (percent / 100)));
      progression = ProgressionService.award({
        userId: user.id,
        amount,
        sourceType: quiz.kind === 'PUZZLE' ? 'PUZZLE_SOLVED' : 'QUIZ_PASSED',
        sourceId: quizId,
        description: `Passed "${quiz.title}" with ${percent}%`
      });
    }

    return {
      attempt,
      score,
      max_score: maxScore,
      percent,
      passed,
      already_passed: alreadyPassed,
      results,
      progression,
      attempts_used: priorAttempts + 1,
      max_attempts: quiz.max_attempts
    };
  },

  create(user, data) {
    if (!canAuthor(user)) throw { status: 403, message: 'Only leaders and above can create quizzes' };
    const quiz = QuizModel.create({ ...data, createdBy: user.id });
    ActivityService.logActivity({
      userId: user.id,
      action: 'QUIZ_CREATE',
      entityType: 'QUIZ',
      entityId: quiz.id,
      details: { description: `${user.name} created "${quiz.title}"` }
    });
    return quiz;
  },

  update(user, quizId, fields) {
    if (!canAuthor(user)) throw { status: 403, message: 'Only leaders and above can edit quizzes' };
    const quiz = QuizModel.getById(quizId);
    if (!quiz) throw { status: 404, message: 'Quiz not found' };
    if (quiz.created_by !== user.id && !hasRole(user, ['teacher', 'admin'])) {
      throw { status: 403, message: 'Only the author or a teacher can edit this quiz' };
    }
    return QuizModel.update(quizId, fields);
  },

  remove(user, quizId) {
    const quiz = QuizModel.getById(quizId);
    if (!quiz) throw { status: 404, message: 'Quiz not found' };
    if (!canAuthor(user)) throw { status: 403, message: 'Only leaders and above can delete quizzes' };
    if (quiz.created_by !== user.id && !hasRole(user, ['teacher', 'admin'])) {
      throw { status: 403, message: 'Only the author or a teacher can delete this quiz' };
    }
    QuizModel.delete(quizId);
    return { success: true, id: quizId };
  },

  addQuestion(user, quizId, data) {
    if (!canAuthor(user)) throw { status: 403, message: 'Only leaders and above can edit quizzes' };
    const quiz = QuizModel.getById(quizId);
    if (!quiz) throw { status: 404, message: 'Quiz not found' };
    if (data.correctAnswer === undefined || data.correctAnswer === null || data.correctAnswer === '') {
      throw { status: 400, message: 'correct_answer is required' };
    }
    if (['MCQ', 'MULTI'].includes(data.questionType) && (!data.options || data.options.length < 2)) {
      throw { status: 400, message: 'Multiple-choice questions need at least two options' };
    }
    return QuizModel.addQuestion(quizId, data);
  },

  removeQuestion(user, questionId) {
    if (!canAuthor(user)) throw { status: 403, message: 'Only leaders and above can edit quizzes' };
    const removed = QuizModel.deleteQuestion(questionId);
    if (!removed) throw { status: 404, message: 'Question not found' };
    return { success: true, id: questionId };
  },

  daily(user) {
    const puzzle = QuizModel.dailyPuzzle();
    if (!puzzle) return { puzzle: null };
    return {
      puzzle,
      solved: QuizModel.hasPassed(puzzle.id, user.id),
      attempts: QuizModel.attemptCount(puzzle.id, user.id)
    };
  }
};
