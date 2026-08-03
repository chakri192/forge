import { Router } from 'express';
import { UserService } from '../services/userService.js';
import { ActivityService } from '../services/activity.js';
import { requirePermission, requireAuth } from '../middleware/auth.js';
import { validate, authSchemas } from '../middleware/validation.js';
import { authRateLimiter } from '../middleware/rateLimit.js';
import { sanitizeUser } from '../utils/sanitize.js';
import { generateToken } from '../utils/jwt.js';

const router = Router();

router.get('/dev/settings', requirePermission('SETTINGS_MANAGE'), (_req, res, next) => {
  try {
    res.json(UserService.getSettings());
  } catch (err) {
    next(err);
  }
});

router.post('/dev/settings', requirePermission('SETTINGS_MANAGE'), (req, res, next) => {
  try {
    const updated = UserService.updateSettings(req.body);
    res.json({ success: true, settings: updated });
  } catch (err) {
    next(err);
  }
});

router.post('/auth/login', authRateLimiter, validate(authSchemas.login), (req, res, next) => {
  try {
    const { identifier, password } = req.body;
    const user = UserService.login(identifier, password);
    const token = generateToken(user);
    ActivityService.logLogin(user);
    res.json({ success: true, token, user });
  } catch (err) {
    next(err);
  }
});

router.post('/auth/signup', authRateLimiter, validate(authSchemas.signup), (req, res, next) => {
  try {
    const user = UserService.signup(req.body);
    const token = generateToken(user);
    ActivityService.logLogin(user);
    res.json({ success: true, token, user });
  } catch (err) {
    next(err);
  }
});

router.get('/auth/me', requireAuth, (req, res) => {
  res.json({ user: sanitizeUser(req.user) });
});

router.post('/auth/change-password', requireAuth, validate(authSchemas.changePassword), (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const result = UserService.changePassword(req.user.id, currentPassword, newPassword);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

export default router;
