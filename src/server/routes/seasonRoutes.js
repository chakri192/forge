import express from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { requirePermission } from '../middleware/rbac.js';
import { validate } from '../middleware/validation.js';
import { SeasonService } from '../services/seasonService.js';
import { SEASONAL_METRICS } from '../models/Leaderboard.js';

const router = express.Router();

const createSchema = z.object({
  name: z.string().trim().min(2).max(80),
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime()
});

router.get('/seasons', requireAuth, (req, res, next) => {
  try {
    res.json({ seasons: SeasonService.list(), active: SeasonService.active() });
  } catch (err) {
    next(err);
  }
});

router.get(
  '/seasons/:id/standings',
  requireAuth,
  validate({ query: z.object({ metric: z.enum(SEASONAL_METRICS).optional() }) }),
  (req, res, next) => {
    try {
      res.json(SeasonService.standings(req.params.id, req.query.metric || 'xp'));
    } catch (err) {
      next(err);
    }
  }
);

/** A member's own placings, for a profile. */
router.get('/seasons/history/:userId', requireAuth, (req, res, next) => {
  try {
    res.json({ history: SeasonService.historyFor(req.params.userId) });
  } catch (err) {
    next(err);
  }
});

// Starting and ending a season resets what everyone is competing for, so it
// sits behind the same permission as running the cohort.
router.post(
  '/seasons',
  requirePermission('TASK_APPROVE'),
  validate({ body: createSchema }),
  (req, res, next) => {
    try {
      res.status(201).json({ season: SeasonService.create(req.body) });
    } catch (err) {
      next(err);
    }
  }
);

router.post('/seasons/:id/archive', requirePermission('TASK_APPROVE'), (req, res, next) => {
  try {
    res.json({ season: SeasonService.archive(req.params.id) });
  } catch (err) {
    next(err);
  }
});

export default router;
