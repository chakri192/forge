import express from 'express';
import { requireAuth, requirePermission } from '../middleware/auth.js';
import { validate } from '../middleware/validation.js';
import { ProgressionService } from '../services/progressionService.js';
import { AchievementService } from '../services/achievementService.js';
import { BadgeModel } from '../models/Badge.js';
import { XpModel, levelFromXp } from '../models/Xp.js';

const router = express.Router();

router.get('/progression/me', requireAuth, validate({}), (req, res, next) => {
  try {
    res.json(ProgressionService.summaryFor(req.user.id));
  } catch (err) {
    next(err);
  }
});

router.get('/progression/achievements', requireAuth, validate({}), (req, res, next) => {
  try {
    res.json({ achievements: AchievementService.progressFor(req.user.id) });
  } catch (err) {
    next(err);
  }
});

router.get('/progression/badges', requireAuth, validate({}), (req, res, next) => {
  try {
    res.json({ badges: BadgeModel.list() });
  } catch (err) {
    next(err);
  }
});

router.get('/progression/:userId', requireAuth, validate({}), (req, res, next) => {
  try {
    res.json(ProgressionService.summaryFor(req.params.userId));
  } catch (err) {
    next(err);
  }
});

/** Leaderboard by XP — distinct from the points-based Hall of Fame. */
router.get('/progression', requireAuth, validate({}), (req, res, next) => {
  try {
    const totals = XpModel.totalsForAll();
    res.json({
      leaderboard: totals
        .map((row) => ({ userId: row.user_id, xp: row.total, ...levelFromXp(row.total) }))
        .sort((a, b) => b.xp - a.xp)
    });
  } catch (err) {
    next(err);
  }
});

/** Manual badge grant for teachers/admins. */
router.post(
  '/progression/badges/:badgeId/award',
  requirePermission('HOF_AWARD'),
  validate({}),
  (req, res, next) => {
    try {
      const { user_id: userId } = req.body;
      if (!userId) throw { status: 400, message: 'user_id is required' };
      const badge = BadgeModel.getById(req.params.badgeId);
      if (!badge) throw { status: 404, message: 'Badge not found' };
      const awarded = BadgeModel.awardToUser(userId, badge.id, req.user.id);
      res.json({ success: true, awarded, badge });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
