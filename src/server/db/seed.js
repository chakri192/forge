import bcrypt from 'bcryptjs';
import { db, initSchema } from './database.js';

export function seedDatabase() {
  console.log('🌱 Initializing Forge database schema & testing seed...');

  // Initialize migrations/tables FIRST
  initSchema();

  // Clear existing data safely
  db.pragma('foreign_keys = OFF');
  const tables = [
    'marketplace_suggestions', 'achievements', 'streaks', 'xp_history', 'subtasks',
    'votes', 'announcements', 'activity_log', 'notifications', 'user_badges',
    'badges', 'journal_entries', 'todos', 'calendar_events', 'forum_posts',
    'forum_threads', 'messages', 'channels', 'hall_of_fame_titles',
    'task_submissions', 'team_memberships', 'task_upvotes', 'tasks',
    'teams', 'student_leader_rotations', 'users'
  ];
  for (const table of tables) {
    db.exec(`DELETE FROM ${table};`);
  }
  db.pragma('foreign_keys = ON');

  // --- Seed Users ---
  const insertUser = db.prepare(`
    INSERT INTO users (id, name, username, email, phone, password_hash, role, tag)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  insertUser.run('u_dev', 'Aaron (Dev)', 'aaron_dev', 'aaron@forge.local', '+1000000000', bcrypt.hashSync('devpass123', 10), 'DEV_STEALTH', 'System Ops');
  insertUser.run('u_leader1', 'Sarah Jenkins', 'sarah_j', 'sarah@forge.local', '+1000000001', bcrypt.hashSync('pass123', 10), 'leader', 'Leader');
  insertUser.run('u_leader2', 'David Kim', 'david_k', 'david@forge.local', '+1000000002', bcrypt.hashSync('pass123', 10), 'leader', 'Leader');
  insertUser.run('u_teacher', 'Prof. Vance', 'prof_vance', 'vance@forge.local', '+1000000003', bcrypt.hashSync('adminpass', 10), 'teacher', 'Instructor');
  insertUser.run('u_op1', 'Alex Rivera', 'alex_r', 'alex@forge.local', '+1000000004', bcrypt.hashSync('pass123', 10), 'member', 'Code Ninja');
  insertUser.run('u_op2', 'Elena Rostova', 'elena_r', 'elena@forge.local', '+1000000005', bcrypt.hashSync('pass123', 10), 'member', 'UI Craftsman');
  insertUser.run('u_op3', 'Marcus Chen', 'marcus_c', 'marcus@forge.local', '+1000000006', bcrypt.hashSync('pass123', 10), 'member', 'Backend Pro');
  insertUser.run('u_op4', 'Chloe Bennet', 'chloe_b', 'chloe@forge.local', '+1000000007', bcrypt.hashSync('pass123', 10), 'member', 'Data Architect');

  // --- Seed Student Leader Rotations ---
  const insertRotation = db.prepare(`
    INSERT INTO student_leader_rotations (id, user_id, term_start, term_end, is_active)
    VALUES (?, ?, ?, ?, 1)
  `);
  const termStart = new Date().toISOString();
  const termEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
  insertRotation.run('slr_1', 'u_leader1', termStart, termEnd);
  insertRotation.run('slr_2', 'u_leader2', termStart, termEnd);

  // --- Seed Teams ---
  const insertTeam = db.prepare(`
    INSERT INTO teams (id, name, captain_id, is_active, status)
    VALUES (?, ?, ?, 1, 'ACTIVE')
  `);
  insertTeam.run('t_alpha', 'Alpha Squad', 'u_op1');
  insertTeam.run('t_beta', 'Beta Innovators', 'u_op3');

  // --- Seed Team Memberships ---
  const insertMembership = db.prepare(`
    INSERT INTO team_memberships (id, user_id, team_id, custom_point_share)
    VALUES (?, ?, ?, ?)
  `);
  insertMembership.run('tm_1', 'u_op1', 't_alpha', 1.0);
  insertMembership.run('tm_2', 'u_op2', 't_alpha', 1.0);
  insertMembership.run('tm_3', 'u_op3', 't_beta', 1.2);
  insertMembership.run('tm_4', 'u_op4', 't_beta', 0.8);

  // --- Seed Tasks & Challenges ---
  const insertTask = db.prepare(`
    INSERT INTO tasks (id, title, description, total_points, task_type, mode, is_marketplace, assigned_team_id, assigned_user_id, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  insertTask.run('task_1', 'Build Responsive Navigation & Token System', 'Implement CSS custom properties and responsive header layout.', 60, 'TEAM_TASK', 'TEAM', 0, 't_alpha', null, 'IN_PROGRESS');
  insertTask.run('task_2', 'Master CSS Grid Layouts & Micro-Animations', 'Create an interactive CSS Grid demonstration card with hover transitions.', 40, 'CHALLENGE', 'CHOICE', 0, null, 'u_op2', 'IN_PROGRESS');
  insertTask.run('task_market_1', 'Implement Dark Mode Marble Hall of Fame', 'Design an interactive stone-themed Leaderboard widget.', 50, 'CHALLENGE', 'CHOICE', 1, null, null, 'MARKETPLACE');

  // --- Seed Upvotes ---
  const insertUpvote = db.prepare('INSERT INTO task_upvotes (task_id, user_id) VALUES (?, ?)');
  insertUpvote.run('task_market_1', 'u_op1');
  insertUpvote.run('task_market_1', 'u_op2');
  insertUpvote.run('task_market_1', 'u_op3');

  // --- Seed Channels & Messages ---
  const insertChannel = db.prepare('INSERT INTO channels (id, name, type, team_id) VALUES (?, ?, ?, ?)');
  insertChannel.run('ch_general', 'general', 'text', null);
  insertChannel.run('ch_alpha', 'alpha-lounge', 'team', 't_alpha');

  const insertMessage = db.prepare('INSERT INTO messages (id, channel_id, user_id, content) VALUES (?, ?, ?, ?)');
  insertMessage.run('msg_1', 'ch_general', 'u_dev', 'Welcome to Forge Specification System!');
  insertMessage.run('msg_2', 'ch_alpha', 'u_op1', 'Alpha Squad reporting for duty.');

  // --- Seed Forum Threads & Posts ---
  const insertThread = db.prepare('INSERT INTO forum_threads (id, title, category, author_id) VALUES (?, ?, ?, ?)');
  insertThread.run('th_1', 'Best Practices for Database Migrations', 'Engineering', 'u_op3');

  const insertPost = db.prepare('INSERT INTO forum_posts (id, thread_id, author_id, content, is_answer) VALUES (?, ?, ?, ?, ?)');
  insertPost.run('fp_1', 'th_1', 'u_op3', 'Always use transactional SQL migrations and proper foreign key constraints.', 1);

  // --- Seed Badges & User Badges ---
  const insertBadge = db.prepare('INSERT INTO badges (id, name, description, icon, category, rarity, xp_bonus) VALUES (?, ?, ?, ?, ?, ?, ?)');
  insertBadge.run('b_first_commit', 'First Commit', 'Pushed initial code to Forge repository', '⚡', 'Engineering', 'COMMON', 50);
  insertBadge.run('b_bug_hunter', 'Bug Hunter', 'Squashed 10 critical system bugs', '🐛', 'Quality', 'RARE', 150);

  const insertUserBadge = db.prepare('INSERT INTO user_badges (id, user_id, badge_id, awarded_by) VALUES (?, ?, ?, ?)');
  insertUserBadge.run('ub_1', 'u_op1', 'b_first_commit', 'u_dev');

  // --- Seed Streaks & XP History ---
  const insertStreak = db.prepare('INSERT INTO streaks (id, user_id, current_streak, longest_streak, last_activity_date) VALUES (?, ?, ?, ?, ?)');
  insertStreak.run('str_1', 'u_op1', 5, 12, new Date().toISOString().split('T')[0]);

  const insertXp = db.prepare('INSERT INTO xp_history (id, user_id, amount, source_type, description) VALUES (?, ?, ?, ?, ?)');
  insertXp.run('xp_1', 'u_op1', 50, 'BADGE', 'Earned First Commit badge');

  // --- Seed Announcements ---
  const insertAnnouncement = db.prepare('INSERT INTO announcements (id, title, content, author_id, priority) VALUES (?, ?, ?, ?, ?)');
  insertAnnouncement.run('anc_1', 'Schema Expansion v2 Live', 'All specification database tables are now active.', 'u_teacher', 'HIGH');

  console.log('✅ Forge expanded 27-table database seed completed successfully!');
}

if (process.argv[1] && process.argv[1].endsWith('seed.js')) {
  seedDatabase();
}
