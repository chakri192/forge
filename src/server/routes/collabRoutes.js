import express from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validation.js';
import { CollabService } from '../services/collabService.js';

const router = express.Router();

const noteBody = z.object({
  title: z.string().trim().min(1).max(160),
  content: z.string().max(20000).optional()
});

router.get('/tasks/:id/collab', requireAuth, (req, res, next) => {
  try {
    res.json(CollabService.hub(req.user, req.params.id));
  } catch (err) {
    next(err);
  }
});

router.post(
  '/tasks/:id/notes',
  requireAuth,
  validate({ body: noteBody }),
  (req, res, next) => {
    try {
      res.status(201).json({ note: CollabService.createNote(req.user, req.params.id, req.body) });
    } catch (err) {
      next(err);
    }
  }
);

router.patch(
  '/notes/:id',
  requireAuth,
  validate({ body: noteBody.partial() }),
  (req, res, next) => {
    try {
      res.json({ note: CollabService.updateNote(req.user, req.params.id, req.body) });
    } catch (err) {
      next(err);
    }
  }
);

router.delete('/notes/:id', requireAuth, (req, res, next) => {
  try {
    res.json(CollabService.deleteNote(req.user, req.params.id));
  } catch (err) {
    next(err);
  }
});

export default router;
