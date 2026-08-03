import express from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validation.js';
import { LeaderboardService } from '../services/leaderboardService.js';
import { METRICS } from '../models/Leaderboard.js';

const router = express.Router();

router.get(
  '/leaderboard',
  requireAuth,
  validate({
    query: z.object({
      metric: z.enum(Object.keys(METRICS)).optional(),
      limit: z.coerce.number().int().min(1).max(100).optional()
    })
  }),
  (req, res, next) => {
    try {
      res.json(LeaderboardService.get(req.user, req.query));
    } catch (err) {
      next(err);
    }
  }
);

export default router;
