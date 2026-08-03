import bcrypt from 'bcryptjs';
import { db } from '../../src/server/db/database.js';
import { generateToken } from '../../src/server/utils/jwt.js';

export const UserFactory = {
  create(overrides = {}, targetDb = db) {
    const timestamp = Date.now() + Math.floor(Math.random() * 100000);
    const user = {
      id: overrides.id || `u_fact_${timestamp}`,
      name: overrides.name || `Factory User ${timestamp}`,
      username: overrides.username || `fact_user_${timestamp}`,
      email: overrides.email || `fact_user_${timestamp}@forge.test`,
      phone: overrides.phone || null,
      password: overrides.password || 'pass123',
      role: overrides.role || 'member',
      tag: overrides.tag || 'Test Tag'
    };

    const password_hash = bcrypt.hashSync(user.password, 10);

    const stmt = targetDb.prepare(`
      INSERT OR REPLACE INTO users (id, name, username, email, phone, password_hash, role, tag)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(user.id, user.name, user.username, user.email, user.phone, password_hash, user.role, user.tag);
    return { ...user, password_hash };
  },

  createMember(overrides = {}, targetDb = db) {
    return this.create({ role: 'member', ...overrides }, targetDb);
  },

  createLeader(overrides = {}, targetDb = db) {
    return this.create({ role: 'leader', ...overrides }, targetDb);
  },

  createTeacher(overrides = {}, targetDb = db) {
    return this.create({ role: 'teacher', ...overrides }, targetDb);
  },

  createAdmin(overrides = {}, targetDb = db) {
    return this.create({ role: 'admin', ...overrides }, targetDb);
  },

  createStealth(overrides = {}, targetDb = db) {
    return this.create({ role: 'DEV_STEALTH', ...overrides }, targetDb);
  }
};

export const TeamFactory = {
  create(overrides = {}, targetDb = db) {
    const timestamp = Date.now() + Math.floor(Math.random() * 100000);
    let captainId = overrides.captain_id || overrides.captainId;

    if (!captainId) {
      const captain = UserFactory.createLeader({}, targetDb);
      captainId = captain.id;
    }

    const team = {
      id: overrides.id || `t_fact_${timestamp}`,
      name: overrides.name || `Factory Team ${timestamp}`,
      captain_id: captainId,
      task_id: overrides.task_id || overrides.taskId || null,
      is_active: overrides.is_active !== undefined ? overrides.is_active : 1,
      status: overrides.status || 'ACTIVE'
    };

    const stmt = targetDb.prepare(`
      INSERT OR REPLACE INTO teams (id, name, captain_id, task_id, is_active, status)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    stmt.run(team.id, team.name, team.captain_id, team.task_id, team.is_active, team.status);

    if (Array.isArray(overrides.members)) {
      const memberStmt = targetDb.prepare(`
        INSERT OR REPLACE INTO team_memberships (id, user_id, team_id, custom_point_share)
        VALUES (?, ?, ?, 1.0)
      `);
      for (const mId of overrides.members) {
        memberStmt.run(`tm_${timestamp}_${mId}`, mId, team.id);
      }
    }

    return team;
  }
};

export const TaskFactory = {
  create(overrides = {}, targetDb = db) {
    const timestamp = Date.now() + Math.floor(Math.random() * 100000);
    const task = {
      id: overrides.id || `task_fact_${timestamp}`,
      title: overrides.title || `Factory Task ${timestamp}`,
      description: overrides.description || 'Test task description',
      total_points: overrides.total_points || overrides.totalPoints || 50,
      task_type: overrides.task_type || overrides.taskType || 'TEAM_TASK',
      mode: overrides.mode || 'CHOICE',
      is_marketplace: overrides.is_marketplace !== undefined ? overrides.is_marketplace : 0,
      assigned_team_id: overrides.assigned_team_id || overrides.assignedTeamId || null,
      assigned_user_id: overrides.assigned_user_id || overrides.assignedUserId || null,
      assigned_by: overrides.assigned_by || overrides.assignedBy || null,
      requires_proof: overrides.requires_proof !== undefined ? overrides.requires_proof : 1,
      status: overrides.status || 'OPEN'
    };

    const stmt = targetDb.prepare(`
      INSERT OR REPLACE INTO tasks (id, title, description, total_points, task_type, mode, is_marketplace, assigned_team_id, assigned_user_id, assigned_by, requires_proof, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      task.id, task.title, task.description, task.total_points,
      task.task_type, task.mode, task.is_marketplace, task.assigned_team_id,
      task.assigned_user_id, task.assigned_by, task.requires_proof, task.status
    );

    return task;
  }
};

export const TaskSubmissionFactory = {
  create(overrides = {}, targetDb = db) {
    const timestamp = Date.now() + Math.floor(Math.random() * 100000);
    const submission = {
      id: overrides.id || `sub_fact_${timestamp}`,
      task_id: overrides.task_id || overrides.taskId,
      team_id: overrides.team_id || overrides.teamId || null,
      submitted_by_user_id: overrides.submitted_by_user_id || overrides.userId,
      proof_file_url: overrides.proof_file_url || null,
      proof_notes: overrides.proof_notes || 'Factory proof notes',
      status: overrides.status || 'PENDING_APPROVAL'
    };

    const stmt = targetDb.prepare(`
      INSERT OR REPLACE INTO task_submissions (id, task_id, team_id, submitted_by_user_id, proof_file_url, proof_notes, status)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(submission.id, submission.task_id, submission.team_id, submission.submitted_by_user_id, submission.proof_file_url, submission.proof_notes, submission.status);
    return submission;
  }
};

export const TaskUpvoteFactory = {
  create(overrides = {}, targetDb = db) {
    const upvote = {
      task_id: overrides.task_id || overrides.taskId,
      user_id: overrides.user_id || overrides.userId
    };

    const stmt = targetDb.prepare(`
      INSERT OR IGNORE INTO task_upvotes (task_id, user_id)
      VALUES (?, ?)
    `);

    stmt.run(upvote.task_id, upvote.user_id);
    return upvote;
  }
};

export const HallOfFameTitleFactory = {
  create(overrides = {}, targetDb = db) {
    const timestamp = Date.now() + Math.floor(Math.random() * 100000);
    const title = {
      id: overrides.id || `hof_fact_${timestamp}`,
      title_name: overrides.title_name || `Title ${timestamp}`,
      category: overrides.category || 'General',
      awarded_to_user_id: overrides.awarded_to_user_id || null,
      awarded_to_team_id: overrides.awarded_to_team_id || null
    };

    const stmt = targetDb.prepare(`
      INSERT OR REPLACE INTO hall_of_fame_titles (id, title_name, category, awarded_to_user_id, awarded_to_team_id)
      VALUES (?, ?, ?, ?, ?)
    `);

    stmt.run(title.id, title.title_name, title.category, title.awarded_to_user_id, title.awarded_to_team_id);
    return title;
  }
};

export const NotificationFactory = {
  create(overrides = {}, targetDb = db) {
    const timestamp = Date.now() + Math.floor(Math.random() * 100000);
    const notif = {
      id: overrides.id || `notif_fact_${timestamp}`,
      user_id: overrides.user_id || overrides.userId,
      title: overrides.title || 'Notification Title',
      message: overrides.message || 'Notification Body',
      type: overrides.type || 'SYSTEM',
      is_read: overrides.is_read !== undefined ? overrides.is_read : 0
    };

    const stmt = targetDb.prepare(`
      INSERT OR REPLACE INTO notifications (id, user_id, title, message, type, is_read)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    stmt.run(notif.id, notif.user_id, notif.title, notif.message, notif.type, notif.is_read);
    return notif;
  }
};

export const ActivityLogFactory = {
  create(overrides = {}, targetDb = db) {
    const timestamp = Date.now() + Math.floor(Math.random() * 100000);
    const activity = {
      id: overrides.id || `act_fact_${timestamp}`,
      user_id: overrides.user_id || overrides.userId || 'u_dev',
      action: overrides.action || 'TEST_ACTION',
      entity_type: overrides.entity_type || 'test',
      entity_id: overrides.entity_id || `e_${timestamp}`,
      details: typeof overrides.details === 'object' ? JSON.stringify(overrides.details) : (overrides.details || '{}')
    };

    const stmt = targetDb.prepare(`
      INSERT OR REPLACE INTO activity_log (id, user_id, action, entity_type, entity_id, details)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    stmt.run(activity.id, activity.user_id, activity.action, activity.entity_type, activity.entity_id, activity.details);
    return activity;
  }
};

export const AuthFactory = {
  createToken(user) {
    if (!user || !user.id) {
      throw new Error('User object with id required');
    }
    return generateToken(user);
  },

  createAuthHeaders(user) {
    const token = this.createToken(user);
    return { Authorization: `Bearer ${token}` };
  }
};
