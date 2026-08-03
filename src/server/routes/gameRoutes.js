import express from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validation.js';
import { mutationRateLimiter } from '../middleware/rateLimit.js';
import { GameService } from '../services/gameService.js';
import { GAMES } from '../models/Game.js';

const router = express.Router();

router.get('/games', requireAuth, validate({}), (req, res, next) => {
  try {
    res.json(GameService.catalogue(req.user));
  } catch (err) {
    next(err);
  }
});

router.post(
  '/games/:game/scores',
  requireAuth,
  mutationRateLimiter,
  validate({
    params: z.object({ game: z.enum(Object.keys(GAMES)) }),
    body: z.object({
      score: z.number().int().min(0),
      detail: z.string().max(200).optional()
    })
  }),
  (req, res, next) => {
    try {
      res.json(GameService.submit(req.user, req.params.game, req.body.score, req.body.detail ?? null));
    } catch (err) {
      next(err);
    }
  }
);

export default router;
