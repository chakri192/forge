import { Router } from 'express';
import { TaskService } from '../services/taskService.js';
import { requirePermission, requireAuth } from '../middleware/auth.js';
import { validate, taskSchemas } from '../middleware/validation.js';
import { upload } from '../middleware/upload.js';

const router = Router();

// GET /api/tasks (List all or filter with query params)
router.get('/tasks', requireAuth, validate({}), (req, res, next) => {
  try {
    const { status, difficulty, task_type, assigned_to, search } = req.query;
    if (status || difficulty || task_type || assigned_to || search) {
      const filtered = TaskService.getTasks({ status, difficulty, task_type, assigned_to, search });
      return res.json(filtered);
    }
    res.json(TaskService.getTasks());
  } catch (err) {
    next(err);
  }
});

// GET /api/tasks/:id (Retrieve single task full details)
router.get('/tasks/:id', requireAuth, validate({}), (req, res, next) => {
  try {
    const task = TaskService.getTaskDetails(req.params.id);
    res.json({ success: true, task });
  } catch (err) {
    next(err);
  }
});

// POST /api/tasks (Create new task - Admin/Leader RBAC required)
router.post('/tasks', requirePermission('TASK_CREATE'), validate(taskSchemas.create), (req, res, next) => {
  try {
    const task = TaskService.createTask(req.body, req.user);
    res.status(201).json({ success: true, task });
  } catch (err) {
    next(err);
  }
});

// PUT /api/tasks/:id (Update task - Admin/Leader RBAC required)
router.put('/tasks/:id', requirePermission('TASK_CREATE'), validate(taskSchemas.update), (req, res, next) => {
  try {
    const task = TaskService.updateTask(req.params.id, req.body, req.user);
    res.json({ success: true, task });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/tasks/:id/status (Update task lifecycle status)
router.patch('/tasks/:id/status', requirePermission('TASK_CREATE'), validate(taskSchemas.updateStatus), (req, res, next) => {
  try {
    const task = TaskService.updateTaskStatus(req.params.id, req.body.status, req.user);
    res.json({ success: true, task });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/tasks/:id (Delete task - Admin/Leader RBAC required)
router.delete('/tasks/:id', requirePermission('TASK_CREATE'), validate({}), (req, res, next) => {
  try {
    const result = TaskService.deleteTask(req.params.id, req.user);
    res.json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
});

// Marketplace suggestion endpoint
router.post('/tasks/suggest', validate(taskSchemas.suggest), (req, res, next) => {
  try {
    const userId = req.user ? req.user.id : (req.body && req.body.user_id ? req.body.user_id : null);
    if (!userId) return res.status(401).json({ success: false, error: 'Unauthorized' });
    const taskId = TaskService.suggestTask({ ...req.body, userId });
    res.json({ success: true, taskId });
  } catch (err) {
    next(err);
  }
});

// Upvote task endpoint
router.post('/tasks/:id/upvote', validate({}), (req, res, next) => {
  try {
    const userId = req.user ? req.user.id : (req.body && req.body.user_id ? req.body.user_id : null);
    const upvotes = TaskService.upvoteTask(req.params.id, userId);
    res.json({ success: true, upvotes });
  } catch (err) {
    next(err);
  }
});

// Remove upvote endpoint
router.delete('/tasks/:id/upvote', validate({}), (req, res, next) => {
  try {
    if (!req.user) return res.status(401).json({ success: false, error: 'Unauthorized' });
    const upvotes = TaskService.removeUpvote(req.params.id, req.user.id);
    res.json({ success: true, upvotes });
  } catch (err) {
    next(err);
  }
});

// Assign task endpoint
router.post('/tasks/:id/assign', requirePermission('TASK_ASSIGN'), validate(taskSchemas.assign), (req, res, next) => {
  try {
    TaskService.assignTask(req.params.id, { ...req.body, assigned_by: req.user.id });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// Submit proof endpoint
router.post('/tasks/:id/submit', upload.single('proof_file'), validate(taskSchemas.submit), (req, res, next) => {
  try {
    if (!req.user) return res.status(401).json({ success: false, error: 'Unauthorized' });
    const submissionId = TaskService.submitProof(req.params.id, req.user, req.file, req.body.proof_notes);
    res.json({ success: true, submissionId });
  } catch (err) {
    next(err);
  }
});

function completeTaskHandler(req, res, next) {
  try {
    const result = TaskService.completeTask(req.params.id, req.user, req.body.submission_id);
    res.json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
}

// Approve / Complete task endpoints
router.post('/tasks/:id/approve', requirePermission('TASK_APPROVE'), validate(taskSchemas.review), completeTaskHandler);
router.post('/tasks/:id/complete', requirePermission('TASK_APPROVE'), validate(taskSchemas.review), completeTaskHandler);

export default router;
