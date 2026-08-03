import express from 'express';
import { requireAuth, requireLeaderOrTeacher } from '../middleware/auth.js';
import { validate, announcementSchemas } from '../middleware/validation.js';
import { AnnouncementService } from '../services/announcementService.js';

const router = express.Router();

router.get('/announcements', requireAuth, validate({}), (req, res, next) => {
  try {
    res.json({ announcements: AnnouncementService.list(req.user) });
  } catch (err) {
    next(err);
  }
});

router.post(
  '/announcements',
  requireLeaderOrTeacher,
  validate(announcementSchemas.create),
  (req, res, next) => {
    try {
      const announcement = AnnouncementService.create(req.user, req.body);
      res.status(201).json({ announcement });
    } catch (err) {
      next(err);
    }
  }
);

router.patch(
  '/announcements/:id',
  requireAuth,
  validate(announcementSchemas.update),
  (req, res, next) => {
    try {
      const announcement = AnnouncementService.update(req.user, req.params.id, req.body);
      res.json({ announcement });
    } catch (err) {
      next(err);
    }
  }
);

router.delete('/announcements/:id', requireAuth, validate({}), (req, res, next) => {
  try {
    res.json(AnnouncementService.remove(req.user, req.params.id));
  } catch (err) {
    next(err);
  }
});

export default router;
