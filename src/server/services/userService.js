import bcrypt from 'bcryptjs';
import { OWNER_ID, ADMIN_ROLES } from '../config/constants.js';
import { UserModel } from '../models/User.js';
import { sanitizeUser } from '../utils/sanitize.js';
import { ActivityService } from './activity.js';

export const UserService = {
  login(identifier, password) {
    if (!identifier || !password) {
      throw { status: 400, message: 'Identifier and password required' };
    }
    const user = UserModel.getForAuth(identifier);
    if (!user) {
      throw { status: 401, message: 'Invalid credentials' };
    }
    const isMatch = bcrypt.compareSync(password, user.password_hash);
    if (!isMatch) {
      throw { status: 401, message: 'Invalid credentials' };
    }
    return sanitizeUser(user);
  },

  signup({ name, username, email, password, role, tag }) {
    const settings = UserModel.getSystemSettings();
    if (!settings.signup_enabled) {
      throw { status: 400, message: 'Registrations are currently closed by the administrator.' };
    }
    if (settings.total_users >= settings.max_capacity) {
      throw { status: 400, message: `Community user capacity limit (${settings.max_capacity} members) has been reached.` };
    }

    if (!name || !username || !email || !password) {
      throw { status: 400, message: 'Name, username, email, and password are required.' };
    }

    const existing = UserModel.findByUsernameOrEmail(username, email);
    if (existing) {
      throw { status: 400, message: 'A user with that username or email already exists.' };
    }

    const userId = `u_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    const safeRole = (role === 'DEV_STEALTH') ? 'member' : (role || 'member');
    const userTag = tag || 'Member';
    const hashedPassword = bcrypt.hashSync(password, 10);

    UserModel.create({
      id: userId,
      name,
      username,
      email,
      password_hash: hashedPassword,
      role: safeRole,
      tag: userTag
    });

    const newUser = UserModel.getByIdOrUsername(userId);
    return sanitizeUser(newUser);
  },

  changePassword(userId, currentPassword, newPassword) {
    if (!currentPassword || !newPassword) {
      throw { status: 400, message: 'Current password and new password are required' };
    }
    const user = UserModel.getForAuth(userId);
    if (!user) {
      throw { status: 404, message: 'User not found' };
    }
    const isMatch = bcrypt.compareSync(currentPassword, user.password_hash);
    if (!isMatch) {
      throw { status: 400, message: 'Current password incorrect' };
    }
    const newHashed = bcrypt.hashSync(newPassword, 10);
    UserModel.update(userId, { password_hash: newHashed });
    return { success: true, message: 'Password updated successfully' };
  },

  getAllUsers(role) {
    const users = UserModel.getAll(role);
    return users.map(sanitizeUser);
  },

  createUser({ id, name, username, email, phone, password_hash, role, tag }) {
    if (!name || !username || !email) {
      throw { status: 400, message: 'Name, username, and email required' };
    }
    const safeRole = (role === 'DEV_STEALTH') ? 'member' : (role || 'member');
    const userId = id || `u_${Date.now()}`;

    if (userId === OWNER_ID) {
      throw { status: 403, message: 'Cannot create user with reserved owner ID' };
    }

    const rawPass = password_hash || 'pass123';
    const hashedPassword = (rawPass.startsWith('$2a$') || rawPass.startsWith('$2b$'))
      ? rawPass
      : bcrypt.hashSync(rawPass, 10);

    UserModel.create({
      id: userId,
      name,
      username,
      email,
      phone,
      password_hash: hashedPassword,
      role: safeRole,
      tag
    });

    return userId;
  },

  deleteUser(targetId) {
    if (targetId === OWNER_ID) {
      throw { status: 403, message: 'The owner account cannot be deleted.' };
    }
    UserModel.delete(targetId);
  },

  updateUserRole(targetUserId, newRole, requestingUser) {
    const VALID_ROLES = ['admin', 'teacher', 'leader', 'member'];
    if (!newRole || !VALID_ROLES.includes(newRole)) {
      throw { status: 400, message: `Invalid role. Must be one of: ${VALID_ROLES.join(', ')}` };
    }
    if (targetUserId === OWNER_ID) {
      throw { status: 403, message: 'The owner role cannot be changed.' };
    }
    const targetUser = UserModel.getByIdOrUsername(targetUserId);
    if (!targetUser) {
      throw { status: 404, message: 'User not found' };
    }
    const oldRole = targetUser.role;
    UserModel.updateUserRole(targetUserId, newRole);
    const updated = UserModel.getByIdOrUsername(targetUserId);
    ActivityService.logRoleChange(requestingUser, targetUserId, targetUser.name, oldRole, newRole);
    return sanitizeUser(updated);
  },

  updateProfile(targetId, fields, currentUser) {
    if (currentUser.id !== targetId && !ADMIN_ROLES.includes(currentUser.role)) {
      throw { status: 403, message: 'Access denied' };
    }

    const targetUser = UserModel.getByIdOrUsername(targetId);

    const { name, username, email, phone, role, tag, bio, skills, github_url, portfolio_url } = fields;
    if (targetId === OWNER_ID && role && role !== 'DEV_STEALTH') {
      throw { status: 403, message: 'The owner role cannot be changed.' };
    }

    const safeRole = (role === 'DEV_STEALTH' && targetId !== OWNER_ID) ? undefined : role;

    const updates = {};
    if (name) updates.name = name;
    if (username) updates.username = username;
    if (email) updates.email = email;
    if (phone !== undefined) updates.phone = phone;
    if (safeRole && ADMIN_ROLES.includes(currentUser.role)) updates.role = safeRole;
    if (tag !== undefined) updates.tag = tag;
    if (bio !== undefined) updates.bio = bio;
    if (skills !== undefined) updates.skills = skills;
    if (github_url !== undefined) updates.github_url = github_url;
    if (portfolio_url !== undefined) updates.portfolio_url = portfolio_url;

    if (!Object.keys(updates).length) {
      throw { status: 400, message: 'No fields to update' };
    }

    UserModel.update(targetId, updates);
    const updatedUser = UserModel.getByIdOrUsername(targetId);

    if (updates.role && targetUser && targetUser.role !== updates.role) {
      ActivityService.logRoleChange(currentUser, targetId, targetUser.name, targetUser.role, updates.role);
    }

    return sanitizeUser(updatedUser);
  },


  getSettings() {
    return UserModel.getSystemSettings();
  },

  updateSettings(settings) {
    UserModel.updateSystemSettings(settings);
    return UserModel.getSystemSettings();
  },

  getActiveLeaders() {
    return UserModel.getActiveLeaders();
  },

  rotateLeaders(leaderIds) {
    if (!Array.isArray(leaderIds) || !leaderIds.length) {
      throw { status: 400, message: 'leader_ids array required' };
    }
    UserModel.rotateLeaders(leaderIds);
    return UserModel.getActiveLeaders();
  }
};
