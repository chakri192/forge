import express from 'express';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validation.js';
import { NotificationService } from '../services/notification.js';

const router = express.Router();

router.get('/notifications', requireAuth, validate({}), (req, res, next) => {
  try {
    const { limit, offset, unreadOnly } = req.query;
    const notifications = NotificationService.getUserNotifications(req.user.id, {
      limit,
      offset,
      unreadOnly
    });
    res.json(notifications);
  } catch (err) {
    next(err);
  }
});

router.get('/notifications/count', requireAuth, validate({}), (req, res, next) => {
  try {
    const result = NotificationService.getUnreadCount(req.user.id);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.put('/notifications/read-all', requireAuth, validate({}), (req, res, next) => {
  try {
    const result = NotificationService.markAllAsRead(req.user.id);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.put('/notifications/:id/read', requireAuth, validate({}), (req, res, next) => {
  try {
    const result = NotificationService.markAsRead(req.params.id, req.user.id);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.post('/notifications/test', requireAuth, validate({}), (req, res, next) => {
  try {
    const { title, message, type, link } = req.body;
    const notif = NotificationService.createNotification({
      userId: req.user.id,
      title: title || 'Test Notification',
      message: message || 'This is a test notification generated at ' + new Date().toLocaleTimeString(),
      type: type || 'INFO',
      link: link || '#dashboard'
    });
    res.status(201).json(notif);
  } catch (err) {
    next(err);
  }
});

export default router;
