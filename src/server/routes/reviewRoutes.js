import express from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validation.js';
import { ReviewService } from '../services/reviewService.js';

const router = express.Router();

const rubricSchema = {
  body: z.object({
    criteria: z.array(z.object({
      label: z.string().trim().min(1).max(120),
      description: z.string().trim().max(500).nullable().optional(),
      max_score: z.number().int().min(1).max(100).optional(),
      weight: z.number().min(0.1).max(10).optional()
    })).min(1).max(20)
  })
};

const reviewSchema = {
  body: z.object({
    verdict: z.enum(['approve', 'request_changes']),
    comment: z.string().trim().max(4000).nullable().optional(),
    scores: z.array(z.object({
      criterion_id: z.string().min(1),
      score: z.number().int().min(0),
      note: z.string().trim().max(1000).nullable().optional()
    })).optional()
  })
};

router.get('/tasks/:id/rubric', requireAuth, validate({}), (req, res, next) => {
  try {
    res.json({ criteria: ReviewService.rubricFor(req.params.id) });
  } catch (err) { next(err); }
});

router.post('/tasks/:id/rubric', requireAuth, validate(rubricSchema), (req, res, next) => {
  try {
    res.status(201).json({ criteria: ReviewService.defineRubric(req.user, req.params.id, req.body.criteria) });
  } catch (err) { next(err); }
});

router.delete('/rubric-criteria/:id', requireAuth, validate({}), (req, res, next) => {
  try {
    res.json(ReviewService.removeCriterion(req.user, req.params.id));
  } catch (err) { next(err); }
});

router.get('/reviews/queue', requireAuth, validate({}), (req, res, next) => {
  try {
    res.json({ submissions: ReviewService.queue(req.user) });
  } catch (err) { next(err); }
});

router.get('/submissions/:id/review', requireAuth, validate({}), (req, res, next) => {
  try {
    res.json(ReviewService.detail(req.user, req.params.id));
  } catch (err) { next(err); }
});

router.post('/submissions/:id/review', requireAuth, validate(reviewSchema), (req, res, next) => {
  try {
    res.json(ReviewService.submitReview(req.user, req.params.id, {
      scores: req.body.scores || [],
      verdict: req.body.verdict,
      comment: req.body.comment ?? null
    }));
  } catch (err) { next(err); }
});

router.post(
  '/submissions/:id/comments',
  requireAuth,
  validate({ body: z.object({ body: z.string().trim().min(1).max(4000) }) }),
  (req, res, next) => {
    try {
      res.status(201).json({ comment: ReviewService.addComment(req.user, req.params.id, req.body.body) });
    } catch (err) { next(err); }
  }
);

export default router;
