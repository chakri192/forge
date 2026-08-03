import { PRIVILEGED_ROLES } from '../config/constants.js';
import { TaskModel } from '../models/Task.js';
import { TeamModel } from '../models/Team.js';
import { UserModel } from '../models/User.js';
import { ActivityService } from './activity.js';

const ALLOWED_TRANSITIONS = {
  draft: ['active', 'archived'],
  active: ['in_progress', 'archived'],
  open: ['in_progress', 'active', 'archived'],
  marketplace: ['active', 'in_progress', 'archived'],
  in_progress: ['pending_review', 'pending_approval', 'archived'],
  pending_review: ['completed', 'in_progress', 'archived'],
  pending_approval: ['completed', 'in_progress', 'archived'],
  completed: ['archived'],
  archived: ['draft', 'active']
};

export const TaskService = {
  getTasks(filters = {}) {
    if (Object.keys(filters).length > 0) {
      return TaskModel.queryTasks(filters);
    }
    return TaskModel.getAllGrouped();
  },

  getTaskDetails(id) {
    const task = TaskModel.getById(id);
    if (!task) {
      throw { status: 404, message: 'Task not found' };
    }
    return task;
  },

  createTask(data, currentUser) {
    const taskId = `task_${Date.now()}_${Math.floor(Math.random() * 1000)}`;

    const task = TaskModel.create({
      id: taskId,
      title: data.title,
      description: data.description,
      instructions: data.instructions,
      resources: data.resources,
      total_points: data.total_points !== undefined ? data.total_points : 50,
      xp_reward: data.xp_reward || 0,
      badge_reward: data.badge_reward,
      difficulty: data.difficulty || 'MEDIUM',
      task_type: data.task_type || 'TEAM_TASK',
      mode: data.mode || 'CHOICE',
      is_marketplace: data.is_marketplace || false,
      assigned_team_id: data.assigned_team_id,
      assigned_user_id: data.assigned_user_id,
      assigned_by: currentUser ? currentUser.id : null,
      proof_requirements: data.proof_requirements,
      deadline: data.deadline,
      status: data.status || 'active'
    });

    if (currentUser) {
      ActivityService.logTaskCreate(currentUser, {
        id: taskId,
        title: data.title,
        total_points: data.total_points,
        task_type: data.task_type
      });
    }

    return task;
  },

  updateTask(id, data, currentUser) {
    const existing = TaskModel.getById(id);
    if (!existing) {
      throw { status: 404, message: 'Task not found' };
    }

    if (data.status && data.status.toLowerCase() !== existing.status.toLowerCase()) {
      this.validateStatusTransition(existing.status, data.status);
    }

    const updated = TaskModel.update(id, data);
    return updated;
  },

  deleteTask(id, currentUser) {
    const existing = TaskModel.getById(id);
    if (!existing) {
      throw { status: 404, message: 'Task not found' };
    }
    TaskModel.delete(id);
    return { success: true, message: 'Task deleted successfully' };
  },

  validateStatusTransition(currentStatus, newStatus) {
    const current = (currentStatus || 'active').toLowerCase();
    const target = (newStatus || '').toLowerCase();

    if (current === target) return true;

    const allowed = ALLOWED_TRANSITIONS[current] || [];
    if (!allowed.includes(target)) {
      throw {
        status: 400,
        message: `Invalid status transition from '${currentStatus}' to '${newStatus}'. Allowed transitions from '${currentStatus}': ${allowed.join(', ') || 'none'}`
      };
    }
    return true;
  },

  updateTaskStatus(id, newStatus, currentUser) {
    const task = TaskModel.getById(id);
    if (!task) {
      throw { status: 404, message: 'Task not found' };
    }

    this.validateStatusTransition(task.status, newStatus);
    const updated = TaskModel.updateStatus(id, newStatus.toLowerCase());

    if (currentUser) {
      ActivityService.logTaskReview(currentUser, id, null, newStatus.toUpperCase());
    }

    return updated;
  },

  suggestTask({ title, description, total_points, task_type, mode, userId }) {
    if (!title || !description) {
      throw { status: 400, message: 'Title and description required' };
    }
    const taskId = `market_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    TaskModel.suggest({ taskId, title, description, totalPoints: total_points, taskType: task_type, mode, userId });

    const user = userId ? UserModel.getByIdOrUsername(userId) : null;
    ActivityService.logTaskCreate(user, { id: taskId, title, total_points, task_type });
    return taskId;
  },

  upvoteTask(taskId, userId) {
    const task = TaskModel.getById(taskId);
    if (!task) {
      return 0;
    }
    let uid = userId;
    if (!uid) {
      const unvoted = TaskModel.getUnvotedUser(taskId);
      uid = unvoted ? unvoted.id : 'u_dev';
    }
    const count = TaskModel.upvote(taskId, uid);
    return count;
  },

  removeUpvote(taskId, userId) {
    const task = TaskModel.getById(taskId);
    if (!task) {
      return 0;
    }
    const count = TaskModel.removeUpvote(taskId, userId);
    return count;
  },

  assignTask(taskId, { team_id, user_id, task_type, assigned_by }) {
    const task = TaskModel.getById(taskId);
    if (!task) {
      throw { status: 404, message: 'Task not found' };
    }

    if (team_id) {
      const team = TeamModel.getById(team_id);
      if (!team) {
        throw { status: 404, message: 'Team not found' };
      }
      TeamModel.updateTask(team_id, taskId);
    }

    const resolvedType = task_type || (team_id ? 'TEAM_TASK' : task.task_type);
    TaskModel.assign(taskId, { team_id, user_id, assigned_by, task_type: resolvedType });
  },

  submitProof(taskId, currentUser, file, proofNotes) {
    const task = TaskModel.getById(taskId);
    if (!task) {
      throw { status: 404, message: 'Task not found' };
    }

    if (!PRIVILEGED_ROLES.includes(currentUser.role)) {
      if (task.assigned_user_id && task.assigned_user_id !== currentUser.id) {
        throw { status: 403, message: 'Forbidden: you are not assigned to this task.' };
      }
      if (task.assigned_team_id && !TeamModel.checkMembership(task.assigned_team_id, currentUser.id)) {
        throw { status: 403, message: 'Forbidden: you are not a member of the assigned team.' };
      }
    }

    const proofUrl = file ? `/uploads/${file.filename}` : null;
    const subId = `sub_${Date.now()}`;
    TaskModel.createSubmission({ id: subId, taskId, userId: currentUser.id, proofUrl, proofNotes });
    ActivityService.logTaskSubmit(currentUser, taskId, subId);
    return subId;
  },

  completeTask(taskId, currentUser, submissionId) {
    const task = TaskModel.getById(taskId);
    if (!task) {
      throw { status: 404, message: 'Task not found' };
    }

    TaskModel.complete(taskId, submissionId, currentUser ? currentUser.id : null);
    const dissolved = TeamModel.tryAutoDissolve(task.assigned_team_id);
    ActivityService.logTaskReview(currentUser, taskId, submissionId, 'COMPLETED');
    return { taskId, status: 'completed', auto_dissolved: dissolved, team_dissolved: dissolved };
  }
};
