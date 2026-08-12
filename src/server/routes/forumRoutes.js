import express from 'express';
import { z } from 'zod';
import { requireAuth, requirePermission } from '../middleware/auth.js';
import { validate } from '../middleware/validation.js';
import { ForumService, MarketplaceService } from '../services/forumService.js';
import { SubtaskModel } from '../models/Subtask.js';
import { TaskModel } from '../models/Task.js';
import { hasRole } from '../middleware/rbac.js';

const router = express.Router();

// The fixed categories and tags, so the client renders filters from one source.
router.get('/forum/taxonomy', requireAuth, (req, res, next) => {
  try {
    res.json(ForumService.taxonomy());
  } catch (err) {
    next(err);
  }
});

const threadSchema = {
  body: z.object({
    title: z.string().trim().min(3, 'Title must be at least 3 characters').max(160),
    category: z.string().trim().max(40).optional(),
    content: z.string().trim().max(8000).optional(),
    // Declared here or zod strips it — the service validates the values
    // themselves against the fixed vocabulary.
    tags: z.array(z.string().max(40)).max(10).optional()
  })
};

const postSchema = {
  body: z.object({
    content: z.string().trim().min(1, 'Content is required').max(8000)
  })
};

const voteSchema = {
  body: z.object({
    target_type: z.enum(['FORUM_THREAD', 'FORUM_POST', 'SUGGESTION']),
    target_id: z.string().min(1),
    value: z.union([z.literal(1), z.literal(-1)])
  })
};

const suggestionSchema = {
  body: z.object({
    title: z.string().trim().min(3).max(160),
    description: z.string().trim().min(1).max(4000)
  })
};

// ---------------------------------------------------------------- Forum

router.get('/forum/threads', requireAuth, validate({}), (req, res, next) => {
  try {
    res.json({
      threads: ForumService.listThreads(req.user, {
        category: req.query.category || null,
        sort: req.query.sort || 'hot',
        limit: req.query.limit,
        offset: req.query.offset
      })
    });
  } catch (err) {
    next(err);
  }
});

router.post('/forum/threads', requireAuth, validate(threadSchema), (req, res, next) => {
  try {
    res.status(201).json(ForumService.createThread(req.user, req.body));
  } catch (err) {
    next(err);
  }
});

router.get('/forum/threads/:id', requireAuth, validate({}), (req, res, next) => {
  try {
    res.json(ForumService.getThread(req.user, req.params.id));
  } catch (err) {
    next(err);
  }
});

router.patch('/forum/threads/:id', requireAuth, validate({}), (req, res, next) => {
  try {
    res.json({
      thread: ForumService.updateThread(req.user, req.params.id, {
        title: req.body.title,
        category: req.body.category,
        isPinned: req.body.is_pinned,
        isLocked: req.body.is_locked
      })
    });
  } catch (err) {
    next(err);
  }
});

router.delete('/forum/threads/:id', requireAuth, validate({}), (req, res, next) => {
  try {
    res.json(ForumService.deleteThread(req.user, req.params.id));
  } catch (err) {
    next(err);
  }
});

router.post('/forum/threads/:id/posts', requireAuth, validate(postSchema), (req, res, next) => {
  try {
    res.status(201).json({ post: ForumService.reply(req.user, req.params.id, req.body.content) });
  } catch (err) {
    next(err);
  }
});

router.post('/forum/threads/:id/accept/:postId', requireAuth, validate({}), (req, res, next) => {
  try {
    res.json({ post: ForumService.acceptAnswer(req.user, req.params.id, req.params.postId) });
  } catch (err) {
    next(err);
  }
});

router.patch('/forum/posts/:id', requireAuth, validate(postSchema), (req, res, next) => {
  try {
    res.json({ post: ForumService.editPost(req.user, req.params.id, req.body.content) });
  } catch (err) {
    next(err);
  }
});

router.delete('/forum/posts/:id', requireAuth, validate({}), (req, res, next) => {
  try {
    res.json(ForumService.deletePost(req.user, req.params.id));
  } catch (err) {
    next(err);
  }
});

router.post('/votes', requireAuth, validate(voteSchema), (req, res, next) => {
  try {
    res.json(
      ForumService.vote(req.user, {
        targetType: req.body.target_type,
        targetId: req.body.target_id,
        value: req.body.value
      })
    );
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------- Marketplace

router.get('/marketplace', requireAuth, validate({}), (req, res, next) => {
  try {
    res.json({ suggestions: MarketplaceService.list(req.user, { status: req.query.status }) });
  } catch (err) {
    next(err);
  }
});

router.post('/marketplace', requireAuth, validate(suggestionSchema), (req, res, next) => {
  try {
    res.status(201).json({ suggestion: MarketplaceService.suggest(req.user, req.body) });
  } catch (err) {
    next(err);
  }
});

router.post(
  '/marketplace/:id/promote',
  requirePermission('TASK_CREATE'),
  validate({}),
  (req, res, next) => {
    try {
      res.json(MarketplaceService.promote(req.user, req.params.id, req.body || {}));
    } catch (err) {
      next(err);
    }
  }
);

router.patch(
  '/marketplace/:id',
  requirePermission('TASK_CREATE'),
  validate({}),
  (req, res, next) => {
    try {
      res.json({ suggestion: MarketplaceService.setStatus(req.user, req.params.id, req.body.status) });
    } catch (err) {
      next(err);
    }
  }
);

// ------------------------------------------------------------- Subtasks

function assertTaskManager(req, task) {
  const isOwner = task.assigned_by === req.user.id || task.assigned_user_id === req.user.id;
  if (!isOwner && !hasRole(req.user, ['leader', 'teacher', 'admin'])) {
    throw { status: 403, message: 'Not allowed to modify this task checklist' };
  }
}

router.get('/tasks/:id/subtasks', requireAuth, validate({}), (req, res, next) => {
  try {
    res.json({
      subtasks: SubtaskModel.listForTask(req.params.id),
      progress: SubtaskModel.progressFor(req.params.id)
    });
  } catch (err) {
    next(err);
  }
});

router.post(
  '/tasks/:id/subtasks',
  requireAuth,
  validate({ body: z.object({ title: z.string().trim().min(1).max(200), assigned_to: z.string().nullable().optional() }) }),
  (req, res, next) => {
    try {
      const task = TaskModel.getById(req.params.id);
      if (!task) throw { status: 404, message: 'Task not found' };
      assertTaskManager(req, task);
      const subtask = SubtaskModel.create({
        taskId: req.params.id,
        title: req.body.title,
        assignedTo: req.body.assigned_to || null
      });
      res.status(201).json({ subtask, progress: SubtaskModel.progressFor(req.params.id) });
    } catch (err) {
      next(err);
    }
  }
);

router.patch('/subtasks/:id', requireAuth, validate({}), (req, res, next) => {
  try {
    const subtask = SubtaskModel.getById(req.params.id);
    if (!subtask) throw { status: 404, message: 'Subtask not found' };
    const updated = SubtaskModel.update(req.params.id, {
      title: req.body.title,
      isCompleted: req.body.is_completed,
      assignedTo: req.body.assigned_to
    });
    res.json({ subtask: updated, progress: SubtaskModel.progressFor(subtask.task_id) });
  } catch (err) {
    next(err);
  }
});

router.delete('/subtasks/:id', requireAuth, validate({}), (req, res, next) => {
  try {
    const subtask = SubtaskModel.getById(req.params.id);
    if (!subtask) throw { status: 404, message: 'Subtask not found' };
    const task = TaskModel.getById(subtask.task_id);
    if (task) assertTaskManager(req, task);
    SubtaskModel.delete(req.params.id);
    res.json({ success: true, progress: SubtaskModel.progressFor(subtask.task_id) });
  } catch (err) {
    next(err);
  }
});

export default router;
