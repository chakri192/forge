import { AnnouncementModel } from '../models/Announcement.js';
import { UserModel } from '../models/User.js';
import { hasRole, normalizeRole } from '../middleware/rbac.js';
import { ActivityService } from './activity.js';
import { NotificationService } from './notification.js';
import { publish } from './sse.js';

function canManage(user, announcement) {
  return announcement.author_id === user.id || hasRole(user, ['admin']);
}

export const AnnouncementService = {
  list(user) {
    return AnnouncementModel.getVisible({
      role: normalizeRole(user.role),
      userId: user.id,
      includeAll: hasRole(user, ['admin'])
    });
  },

  create(user, { title, content, priority = 'NORMAL', target_role = null, expires_at = null }) {
    const announcement = AnnouncementModel.create({
      title,
      content,
      authorId: user.id,
      priority,
      targetRole: target_role,
      expiresAt: expires_at
    });

    const recipients = UserModel.getAll()
      .filter((u) => u.id !== user.id)
      .filter((u) => !target_role || normalizeRole(u.role) === target_role);

    if (recipients.length) {
      NotificationService.notifyAnnouncement({
        userIds: recipients.map((u) => u.id),
        title: `Announcement: ${announcement.title}`,
        message: announcement.content.slice(0, 140)
      });
      publish(
        recipients.map((u) => u.id),
        {
          type: 'notification',
          notification: {
            title: `Announcement: ${announcement.title}`,
            message: announcement.content.slice(0, 140),
            link: '#announcements'
          }
        }
      );
    }

    ActivityService.logActivity({
      userId: user.id,
      action: 'ANNOUNCEMENT_CREATE',
      entityType: 'ANNOUNCEMENT',
      entityId: announcement.id,
      details: { description: `${user.name} published announcement "${announcement.title}"` }
    });

    return announcement;
  },

  update(user, id, fields) {
    const announcement = AnnouncementModel.getById(id);
    if (!announcement) {
      throw { status: 404, message: 'Announcement not found' };
    }
    if (!canManage(user, announcement)) {
      throw { status: 403, message: 'Only the author or an admin can edit this announcement' };
    }
    return AnnouncementModel.update(id, fields);
  },

  remove(user, id) {
    const announcement = AnnouncementModel.getById(id);
    if (!announcement) {
      throw { status: 404, message: 'Announcement not found' };
    }
    if (!canManage(user, announcement)) {
      throw { status: 403, message: 'Only the author or an admin can delete this announcement' };
    }
    AnnouncementModel.delete(id);
    return { success: true, id };
  }
};
