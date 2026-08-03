import express from 'express';
import { z } from 'zod';
import { requireAuth, requireLeaderOrTeacher } from '../middleware/auth.js';
import { validate, messageSchemas } from '../middleware/validation.js';
import { MessageService } from '../services/messageService.js';
import { ALLOWED_EMOJI } from '../models/Reaction.js';

const router = express.Router();

router.get('/channels', requireAuth, validate({}), (req, res, next) => {
  try {
    res.json({ channels: MessageService.listChannels(req.user) });
  } catch (err) {
    next(err);
  }
});

router.post(
  '/channels',
  requireLeaderOrTeacher,
  validate(messageSchemas.createChannel),
  (req, res, next) => {
    try {
      const channel = MessageService.createChannel(req.user, req.body);
      res.status(201).json({ channel });
    } catch (err) {
      next(err);
    }
  }
);

router.get('/channels/:id/messages', requireAuth, validate({}), (req, res, next) => {
  try {
    const { channel, messages } = MessageService.getChannelMessages(req.user, req.params.id, {
      limit: req.query.limit
    });
    res.json({ channel, messages });
  } catch (err) {
    next(err);
  }
});

router.post(
  '/channels/:id/messages',
  requireAuth,
  validate(messageSchemas.postMessage),
  (req, res, next) => {
    try {
      const message = MessageService.postMessage(req.user, req.params.id, req.body.content);
      res.status(201).json({ message });
    } catch (err) {
      next(err);
    }
  }
);

router.patch(
  '/messages/:id',
  requireAuth,
  validate(messageSchemas.postMessage),
  (req, res, next) => {
    try {
      const message = MessageService.editMessage(req.user, req.params.id, req.body.content);
      res.json({ message });
    } catch (err) {
      next(err);
    }
  }
);

router.delete('/messages/:id', requireAuth, validate({}), (req, res, next) => {
  try {
    res.json(MessageService.deleteMessage(req.user, req.params.id));
  } catch (err) {
    next(err);
  }
});

router.post(
  '/messages/:id/reactions',
  requireAuth,
  validate({ body: z.object({ emoji: z.string().min(1).max(8) }) }),
  (req, res, next) => {
    try {
      res.json(MessageService.react(req.user, req.params.id, req.body.emoji));
    } catch (err) { next(err); }
  }
);

router.post(
  '/messages/:id/vote',
  requireAuth,
  validate({ body: z.object({ value: z.union([z.literal(1), z.literal(-1)]) }) }),
  (req, res, next) => {
    try {
      res.json(MessageService.vote(req.user, req.params.id, req.body.value));
    } catch (err) { next(err); }
  }
);

router.get('/reactions/available', requireAuth, validate({}), (_req, res) => {
  res.json({ emoji: ALLOWED_EMOJI });
});

export default router;
