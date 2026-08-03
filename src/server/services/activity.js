import { ActivityModel } from '../models/Activity.js';

export const ActivityService = {
  logActivity({ userId, action, entityType, entityId, details }) {
    if (!action || !entityType) {
      throw new Error('action and entityType are required for activity logging');
    }
    return ActivityModel.create({
      userId: userId || null,
      action,
      entityType,
      entityId: entityId || null,
      details: details || null
    });
  },

  logLogin(user) {
    if (!user) return null;
    return this.logActivity({
      userId: user.id,
      action: 'LOGIN',
      entityType: 'user',
      entityId: user.id,
      details: {
        description: `${user.name} logged into the platform`,
        username: user.username,
        role: user.role
      }
    });
  },

  logTaskCreate(user, task) {
    return this.logActivity({
      userId: user ? user.id : null,
      action: 'TASK_CREATE',
      entityType: 'task',
      entityId: task.id || task.taskId,
      details: {
        description: `${user ? user.name : 'Someone'} created task "${task.title || 'Untitled'}"`,
        title: task.title,
        task_type: task.task_type || task.taskType,
        total_points: task.total_points || task.totalPoints
      }
    });
  },

  logTaskSubmit(user, taskId, submissionId) {
    return this.logActivity({
      userId: user ? user.id : null,
      action: 'TASK_SUBMIT',
      entityType: 'task',
      entityId: taskId,
      details: {
        description: `${user ? user.name : 'A member'} submitted proof for task`,
        submission_id: submissionId
      }
    });
  },

  logTaskReview(user, taskId, submissionId, status = 'COMPLETED') {
    return this.logActivity({
      userId: user ? user.id : null,
      action: 'TASK_REVIEW',
      entityType: 'task',
      entityId: taskId,
      details: {
        description: `${user ? user.name : 'An admin'} reviewed and approved task`,
        submission_id: submissionId,
        status
      }
    });
  },

  logTeamChange(user, actionType, team) {
    let actionDesc = 'updated team';
    if (actionType === 'TEAM_CREATE') actionDesc = `created team "${team.name || 'New Team'}"`;
    else if (actionType === 'TEAM_DISSOLVE') actionDesc = `dissolved team "${team.name || team.id}"`;
    else if (actionType === 'TEAM_OVERRIDE') actionDesc = `overrode point shares for team`;

    return this.logActivity({
      userId: user ? user.id : null,
      action: actionType || 'TEAM_CHANGE',
      entityType: 'team',
      entityId: team.id || team.teamId,
      details: {
        description: `${user ? user.name : 'Admin'} ${actionDesc}`,
        team_name: team.name,
        reason: team.reason
      }
    });
  },

  logRoleChange(user, targetUserId, targetUserName, oldRole, newRole) {
    return this.logActivity({
      userId: user ? user.id : null,
      action: 'ROLE_CHANGE',
      entityType: 'user',
      entityId: targetUserId,
      details: {
        description: `${user ? user.name : 'Admin'} changed role of ${targetUserName || targetUserId} from ${oldRole || 'unknown'} to ${newRole}`,
        target_user_id: targetUserId,
        old_role: oldRole,
        new_role: newRole
      }
    });
  },

  getGlobalActivity({ type, userId, startDate, endDate, limit = 50, offset = 0 } = {}) {
    const activities = ActivityModel.getAll({ type, userId, startDate, endDate, limit, offset });
    const total = ActivityModel.count({ type, userId, startDate, endDate });
    return {
      activities,
      total,
      limit: parseInt(limit, 10) || 50,
      offset: parseInt(offset, 10) || 0
    };
  },

  getUserActivity(userId, { type, startDate, endDate, limit = 50, offset = 0 } = {}) {
    if (!userId) {
      throw { status: 400, message: 'User ID required' };
    }
    const activities = ActivityModel.getByUserId(userId, { type, startDate, endDate, limit, offset });
    const total = ActivityModel.count({ type, userId, startDate, endDate });
    return {
      activities,
      total,
      limit: parseInt(limit, 10) || 50,
      offset: parseInt(offset, 10) || 0
    };
  }
};
