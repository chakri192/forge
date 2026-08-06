import express from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validation.js';
import { mutationRateLimiter } from '../middleware/rateLimit.js';
import { DuelService } from '../services/duelService.js';

const router = express.Router();

router.get('/duels', requireAuth, validate({}), (req, res, next) => {
  try {
    res.json(DuelService.list(req.user));
  } catch (err) { next(err); }
});

router.post(
  '/duels',
  requireAuth,
  mutationRateLimiter,
  validate({
    body: z.object({
      opponentId: z.string().min(1),
      stakePoints: z.number().int().min(0).max(5000).optional(),
      stakeXp: z.number().int().min(0).max(5000).optional()
    })
  }),
  (req, res, next) => {
    try {
      res.status(201).json(DuelService.create(req.user, req.body));
    } catch (err) { next(err); }
  }
);

router.post(
  '/duels/:id/accept',
  requireAuth,
  mutationRateLimiter,
  validate({ body: z.object({ topic: z.string().min(1).max(80) }) }),
  (req, res, next) => {
    try {
      res.json(DuelService.accept(req.user, req.params.id, req.body.topic));
    } catch (err) { next(err); }
  }
);

router.post('/duels/:id/decline', requireAuth, mutationRateLimiter, validate({}), (req, res, next) => {
  try {
    res.json(DuelService.decline(req.user, req.params.id));
  } catch (err) { next(err); }
});

router.post('/duels/:id/cancel', requireAuth, mutationRateLimiter, validate({}), (req, res, next) => {
  try {
    res.json(DuelService.cancel(req.user, req.params.id));
  } catch (err) { next(err); }
});

router.post(
  '/duels/:id/resolve',
  requireAuth,
  mutationRateLimiter,
  validate({ body: z.object({ winnerId: z.string().min(1) }) }),
  (req, res, next) => {
    try {
      res.json(DuelService.resolve(req.user, req.params.id, req.body.winnerId));
    } catch (err) { next(err); }
  }
);

export default router;
