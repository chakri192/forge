import { NotificationModel } from '../models/Notification.js';

export const NotificationService = {
  createNotification({ userId, title, message, type = 'INFO', link = null }) {
    if (!userId || !title || !message) {
      throw { status: 400, message: 'userId, title, and message are required' };
    }
    return NotificationModel.create({ userId, title, message, type, link });
  },

  createBulkNotifications(notifications) {
    if (!Array.isArray(notifications) || !notifications.length) {
      throw { status: 400, message: 'notifications array is required' };
    }
    return NotificationModel.createBulk(notifications);
  },

  getUserNotifications(userId, { limit = 20, offset = 0, unreadOnly = false } = {}) {
    if (!userId) {
      throw { status: 400, message: 'User ID is required' };
    }
    const parsedLimit = parseInt(limit, 10) || 20;
    const parsedOffset = parseInt(offset, 10) || 0;
    const isUnread = unreadOnly === 'true' || unreadOnly === true;

    return NotificationModel.getByUserId(userId, {
      limit: parsedLimit,
      offset: parsedOffset,
      unreadOnly: isUnread
    });
  },

  markAsRead(notificationId, userId) {
    if (!notificationId || !userId) {
      throw { status: 400, message: 'notificationId and userId required' };
    }
    const success = NotificationModel.markAsRead(notificationId, userId);
    if (!success) {
      throw { status: 404, message: 'Notification not found or unauthorized' };
    }
    return { success: true, id: notificationId };
  },

  markAllAsRead(userId) {
    if (!userId) {
      throw { status: 400, message: 'User ID is required' };
    }
    const updatedCount = NotificationModel.markAllAsRead(userId);
    return { success: true, updatedCount };
  },

  getUnreadCount(userId) {
    if (!userId) {
      throw { status: 400, message: 'User ID is required' };
    }
    const count = NotificationModel.getUnreadCount(userId);
    return { count };
  },

  // Event Helper Generators for Application Events
  notifyAssignment({ userId, taskTitle, taskId }) {
    return this.createNotification({
      userId,
      title: 'New Task Assignment',
      message: `You have been assigned to task "${taskTitle}".`,
      type: 'ASSIGNMENT',
      link: `#tasks`
    });
  },

  notifyReview({ userId, taskTitle, reviewerName }) {
    return this.createNotification({
      userId,
      title: 'Task Review Submitted',
      message: `${reviewerName} reviewed your submission for "${taskTitle}".`,
      type: 'REVIEW',
      link: `#tasks`
    });
  },

  notifyMention({ userId, mentionedBy, threadTitle, link }) {
    return this.createNotification({
      userId,
      title: 'You were mentioned',
      message: `${mentionedBy} mentioned you in "${threadTitle}".`,
      type: 'MENTION',
      link: link || '#halloffame'
    });
  },

  notifyDeadline({ userId, taskTitle, dueDate }) {
    return this.createNotification({
      userId,
      title: 'Upcoming Task Deadline',
      message: `Task "${taskTitle}" is due on ${dueDate}.`,
      type: 'DEADLINE',
      link: `#tasks`
    });
  },

  notifyAnnouncement({ userIds, title, message }) {
    if (!Array.isArray(userIds) || !userIds.length) return false;
    const notifications = userIds.map(userId => ({
      userId,
      title: title || 'System Announcement',
      message,
      type: 'ANNOUNCEMENT',
      link: '#dashboard'
    }));
    return this.createBulkNotifications(notifications);
  }
};
