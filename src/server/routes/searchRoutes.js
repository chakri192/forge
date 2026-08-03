import express from 'express';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validation.js';
import { SearchService } from '../services/searchService.js';

const router = express.Router();

router.get('/search', requireAuth, validate({}), (req, res, next) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 20, 50);
    res.json(SearchService.query(req.user, req.query.q, { limit }));
  } catch (err) {
    next(err);
  }
});

export default router;
