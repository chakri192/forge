import { Router } from 'express';
import { UserService } from '../services/userService.js';
import { requirePermission } from '../middleware/auth.js';
import { validate } from '../middleware/validation.js';

const router = Router();

router.get('/student-leaders', validate({}), (_req, res, next) => {
  try {
    res.json(UserService.getActiveLeaders());
  } catch (err) {
    next(err);
  }
});

router.post('/student-leaders/rotate', requirePermission('LEADER_ROTATE'), validate({}), (req, res, next) => {
  try {
    const activeLeaders = UserService.rotateLeaders(req.body ? req.body.leader_ids : null);
    res.json({ success: true, active_leaders: activeLeaders });
  } catch (err) {
    next(err);
  }
});

export default router;
