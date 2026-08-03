import { Router } from 'express';
import { ActivityService } from '../services/activity.js';
import { requireAuth, hasRole, hasPermission } from '../middleware/auth.js';
import { validate } from '../middleware/validation.js';
import { ADMIN_ROLES } from '../config/constants.js';

const router = Router();

// GET /api/activity - Admin/Global activity log viewer
router.get('/activity', requireAuth, validate({}), (req, res, next) => {
  try {
    if (!hasRole(req.user, ADMIN_ROLES) && !hasPermission(req.user, 'USER_MANAGE')) {
      return res.status(403).json({ success: false, error: 'Forbidden: Admin access required to view global activity logs.' });
    }

    const { type, user, userId, startDate, endDate, limit, offset } = req.query;
    const result = ActivityService.getGlobalActivity({
      type,
      userId: user || userId,
      startDate,
      endDate,
      limit,
      offset
    });

    res.json(result);
  } catch (err) {
    next(err);
  }
});

// GET /api/activity/user/:id - User activity log history
router.get('/activity/user/:id', requireAuth, validate({}), (req, res, next) => {
  try {
    const targetUserId = req.params.id;

    if (req.user.id !== targetUserId && !hasRole(req.user, ADMIN_ROLES) && !hasPermission(req.user, 'USER_MANAGE')) {
      return res.status(403).json({ success: false, error: 'Forbidden: You can only view your own activity history.' });
    }

    const { type, startDate, endDate, limit, offset } = req.query;
    const result = ActivityService.getUserActivity(targetUserId, {
      type,
      startDate,
      endDate,
      limit,
      offset
    });

    res.json(result);
  } catch (err) {
    next(err);
  }
});

export default router;
