import express from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validation.js';
import { ConversationService } from '../services/conversationService.js';

const router = express.Router();

router.get('/conversations', requireAuth, (req, res, next) => {
  try {
    res.json(ConversationService.list(req.user));
  } catch (err) {
    next(err);
  }
});

router.post(
  '/conversations/direct',
  requireAuth,
  validate({ body: z.object({ userId: z.string().min(1) }) }),
  (req, res, next) => {
    try {
      res.status(201).json(ConversationService.openDirect(req.user, req.body.userId));
    } catch (err) {
      next(err);
    }
  }
);

router.post(
  '/conversations/group',
  requireAuth,
  validate({
    body: z.object({
      title: z.string().trim().min(1).max(80),
      memberIds: z.array(z.string().min(1)).min(2).max(24)
    })
  }),
  (req, res, next) => {
    try {
      res.status(201).json(ConversationService.createGroup(req.user, req.body));
    } catch (err) {
      next(err);
    }
  }
);

router.get('/conversations/:id', requireAuth, (req, res, next) => {
  try {
    res.json(ConversationService.detail(req.user, req.params.id));
  } catch (err) {
    next(err);
  }
});

router.get(
  '/conversations/:id/messages',
  requireAuth,
  validate({ query: z.object({ limit: z.coerce.number().int().min(1).max(200).optional() }) }),
  (req, res, next) => {
    try {
      res.json(ConversationService.messages(req.user, req.params.id, req.query));
    } catch (err) {
      next(err);
    }
  }
);

router.post(
  '/conversations/:id/members',
  requireAuth,
  validate({ body: z.object({ memberIds: z.array(z.string().min(1)).min(1).max(24) }) }),
  (req, res, next) => {
    try {
      res.json(ConversationService.addMembers(req.user, req.params.id, req.body.memberIds));
    } catch (err) {
      next(err);
    }
  }
);

router.post('/conversations/:id/leave', requireAuth, (req, res, next) => {
  try {
    res.json(ConversationService.leave(req.user, req.params.id));
  } catch (err) {
    next(err);
  }
});

export default router;
