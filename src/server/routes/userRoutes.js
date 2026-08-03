import { Router } from 'express';
import { UserService } from '../services/userService.js';
import { requirePermission } from '../middleware/auth.js';
import { validate, userSchemas } from '../middleware/validation.js';

const router = Router();

router.get('/users', validate({}), (req, res, next) => {
  try {
    const users = UserService.getAllUsers(req.query.role);
    res.json(users);
  } catch (err) {
    next(err);
  }
});

router.post('/users', requirePermission('USER_MANAGE'), validate({}), (req, res, next) => {
  try {
    const userId = UserService.createUser(req.body);
    res.json({ success: true, userId });
  } catch (err) {
    next(err);
  }
});

router.delete('/users/:id', requirePermission('USER_MANAGE'), validate({}), (req, res, next) => {
  try {
    UserService.deleteUser(req.params.id);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

router.patch('/users/:id/role', requirePermission('ROLE_ASSIGN'), validate(userSchemas.updateRole), (req, res, next) => {
  try {
    const updatedUser = UserService.updateUserRole(req.params.id, req.body.role, req.user);
    res.json({ success: true, user: updatedUser });
  } catch (err) {
    next(err);
  }
});

router.patch('/users/:id', validate(userSchemas.updateProfile), (req, res, next) => {
  try {
    const updatedUser = UserService.updateProfile(req.params.id, req.body, req.user);
    res.json({ success: true, user: updatedUser });
  } catch (err) {
    next(err);
  }
});

export default router;
