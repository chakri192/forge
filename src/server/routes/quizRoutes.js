import express from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validation.js';
import { QuizService } from '../services/quizService.js';
import { QuizModel } from '../models/Quiz.js';

const router = express.Router();

const quizSchema = {
  body: z.object({
    title: z.string().trim().min(3).max(160),
    description: z.string().trim().max(2000).nullable().optional(),
    category: z.string().trim().max(40).optional(),
    kind: z.enum(['QUIZ', 'PUZZLE']).optional(),
    difficulty: z.enum(['EASY', 'MEDIUM', 'HARD', 'EXPERT']).optional(),
    time_limit_seconds: z.number().int().positive().nullable().optional(),
    xp_reward: z.number().int().min(0).optional(),
    pass_percent: z.number().int().min(0).max(100).optional(),
    max_attempts: z.number().int().positive().nullable().optional(),
    scheduled_for: z.string().nullable().optional(),
    is_published: z.boolean().optional()
  })
};

const questionSchema = {
  body: z.object({
    prompt: z.string().trim().min(3).max(2000),
    question_type: z.enum(['MCQ', 'MULTI', 'TRUE_FALSE', 'SHORT_ANSWER', 'CODE_OUTPUT']).optional(),
    options: z.array(z.string()).max(10).nullable().optional(),
    correct_answer: z.union([z.string(), z.array(z.string()), z.boolean()]),
    explanation: z.string().trim().max(2000).nullable().optional(),
    code_snippet: z.string().max(4000).nullable().optional(),
    hint: z.string().trim().max(500).nullable().optional(),
    points: z.number().int().min(1).max(20).optional()
  })
};

const submitSchema = {
  body: z.object({
    answers: z.record(z.string(), z.any()).optional(),
    duration_seconds: z.number().int().min(0).nullable().optional()
  })
};

router.get('/quizzes', requireAuth, validate({}), (req, res, next) => {
  try {
    res.json({ quizzes: QuizService.list(req.user, { kind: req.query.kind || null }) });
  } catch (err) {
    next(err);
  }
});

router.get('/quizzes/daily', requireAuth, validate({}), (req, res, next) => {
  try {
    res.json(QuizService.daily(req.user));
  } catch (err) {
    next(err);
  }
});

router.get('/quizzes/leaderboard', requireAuth, validate({}), (req, res, next) => {
  try {
    res.json({ leaderboard: QuizModel.leaderboard(10) });
  } catch (err) {
    next(err);
  }
});

router.post('/quizzes', requireAuth, validate(quizSchema), (req, res, next) => {
  try {
    const quiz = QuizService.create(req.user, {
      title: req.body.title,
      description: req.body.description ?? null,
      category: req.body.category || 'general',
      kind: req.body.kind || 'QUIZ',
      difficulty: req.body.difficulty || 'MEDIUM',
      timeLimitSeconds: req.body.time_limit_seconds ?? null,
      xpReward: req.body.xp_reward ?? 50,
      passPercent: req.body.pass_percent ?? 70,
      maxAttempts: req.body.max_attempts ?? null,
      scheduledFor: req.body.scheduled_for ?? null,
      isPublished: req.body.is_published ?? false
    });
    res.status(201).json({ quiz });
  } catch (err) {
    next(err);
  }
});

/** Play view — never includes correct answers. */
router.get('/quizzes/:id', requireAuth, validate({}), (req, res, next) => {
  try {
    res.json(QuizService.getForPlay(req.user, req.params.id));
  } catch (err) {
    next(err);
  }
});

/** Author view — includes answers and stats. */
router.get('/quizzes/:id/edit', requireAuth, validate({}), (req, res, next) => {
  try {
    res.json(QuizService.getForEdit(req.user, req.params.id));
  } catch (err) {
    next(err);
  }
});

router.patch('/quizzes/:id', requireAuth, validate({}), (req, res, next) => {
  try {
    res.json({
      quiz: QuizService.update(req.user, req.params.id, {
        title: req.body.title,
        description: req.body.description,
        category: req.body.category,
        difficulty: req.body.difficulty,
        xpReward: req.body.xp_reward,
        passPercent: req.body.pass_percent,
        maxAttempts: req.body.max_attempts,
        scheduledFor: req.body.scheduled_for,
        isPublished: req.body.is_published
      })
    });
  } catch (err) {
    next(err);
  }
});

router.delete('/quizzes/:id', requireAuth, validate({}), (req, res, next) => {
  try {
    res.json(QuizService.remove(req.user, req.params.id));
  } catch (err) {
    next(err);
  }
});

router.post('/quizzes/:id/questions', requireAuth, validate(questionSchema), (req, res, next) => {
  try {
    const question = QuizService.addQuestion(req.user, req.params.id, {
      prompt: req.body.prompt,
      questionType: req.body.question_type || 'MCQ',
      options: req.body.options ?? null,
      correctAnswer: req.body.correct_answer,
      explanation: req.body.explanation ?? null,
      codeSnippet: req.body.code_snippet ?? null,
      hint: req.body.hint ?? null,
      points: req.body.points ?? 1
    });
    res.status(201).json({ question });
  } catch (err) {
    next(err);
  }
});

router.delete('/quiz-questions/:id', requireAuth, validate({}), (req, res, next) => {
  try {
    res.json(QuizService.removeQuestion(req.user, req.params.id));
  } catch (err) {
    next(err);
  }
});

router.post('/quizzes/:id/submit', requireAuth, validate(submitSchema), (req, res, next) => {
  try {
    res.json(
      QuizService.submit(req.user, req.params.id, {
        answers: req.body.answers || {},
        durationSeconds: req.body.duration_seconds ?? null
      })
    );
  } catch (err) {
    next(err);
  }
});

router.get('/quizzes/:id/attempts', requireAuth, validate({}), (req, res, next) => {
  try {
    res.json({ attempts: QuizModel.attemptsFor(req.params.id, req.user.id) });
  } catch (err) {
    next(err);
  }
});

export default router;
