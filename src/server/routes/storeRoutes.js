import express from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validation.js';
import { mutationRateLimiter } from '../middleware/rateLimit.js';
import { StoreService } from '../services/storeService.js';

const router = express.Router();

router.get('/store', requireAuth, validate({}), (req, res, next) => {
  try {
    res.json(StoreService.catalogue(req.user));
  } catch (err) { next(err); }
});

router.get('/wallet', requireAuth, validate({}), (req, res, next) => {
  try {
    res.json(StoreService.wallet(req.user));
  } catch (err) { next(err); }
});

router.post('/store/:id/buy', requireAuth, mutationRateLimiter, validate({}), (req, res, next) => {
  try {
    res.json(StoreService.buy(req.user, req.params.id));
  } catch (err) { next(err); }
});

router.post(
  '/store/:id/equip',
  requireAuth,
  mutationRateLimiter,
  validate({ body: z.object({ equipped: z.boolean() }) }),
  (req, res, next) => {
    try {
      res.json(StoreService.equip(req.user, req.params.id, req.body.equipped));
    } catch (err) { next(err); }
  }
);

export default router;
