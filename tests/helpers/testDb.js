import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';
import { db, initSchema } from '../../src/server/db/database.js';

process.env.NODE_ENV = 'test';

export function resetTestDb(targetDb = db) {
  targetDb.pragma('foreign_keys = OFF');

  const tables = [
    'marketplace_suggestions', 'achievements', 'streaks', 'xp_history', 'subtasks',
    'votes', 'announcements', 'activity_log', 'notifications', 'user_badges',
    'badges', 'journal_entries', 'todos', 'calendar_events', 'forum_posts',
    'forum_threads', 'messages', 'channels', 'hall_of_fame_titles',
    'task_submissions', 'team_memberships', 'task_upvotes', 'tasks',
    'teams', 'student_leader_rotations', 'users'
  ];

  for (const table of tables) {
    try {
      targetDb.exec(`DELETE FROM ${table};`);
    } catch (_) {}
  }

  targetDb.pragma('foreign_keys = ON');

  initSchema();
  seedBaselineData(targetDb);
}

export function seedBaselineData(targetDb = db) {
  const hashedPass = bcrypt.hashSync('pass123', 10);

  // Insert Default System Accounts
  const insertUser = targetDb.prepare(`
    INSERT OR REPLACE INTO users (id, name, username, email, phone, password_hash, role, tag)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  insertUser.run('u_dev', 'Aaron Dev', 'aaron_dev', 'aaron@forge.local', '+1000000000', hashedPass, 'DEV_STEALTH', 'System Ops');
  insertUser.run('u_teacher', 'Prof. Vance', 'teacher_vance', 'vance@forge.local', '+1000000003', hashedPass, 'teacher', 'Instructor');
  insertUser.run('u_leader1', 'Sarah Leader', 'sarah_lead', 'sarah@forge.local', '+1000000001', hashedPass, 'leader', 'Leader');
  insertUser.run('u_member1', 'Alex Member', 'alex_member', 'alex@forge.local', '+1000000004', hashedPass, 'member', 'Member');
}

export function createInMemoryDb() {
  const memDb = new Database(':memory:');
  memDb.pragma('foreign_keys = ON');
  initSchema();
  seedBaselineData(memDb);
  return memDb;
}
