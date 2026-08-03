import { db, initSchema } from './database.js';

export function verifySchema() {
  console.log('🔍 Running Database Schema Verification...');
  initSchema();

  const expectedTables = [
    'users',
    'student_leader_rotations',
    'teams',
    'tasks',
    'task_upvotes',
    'team_memberships',
    'task_submissions',
    'hall_of_fame_titles',
    'system_settings',
    'schema_migrations',
    'channels',
    'messages',
    'forum_threads',
    'forum_posts',
    'calendar_events',
    'todos',
    'journal_entries',
    'badges',
    'user_badges',
    'notifications',
    'activity_log',
    'announcements',
    'votes',
    'subtasks',
    'xp_history',
    'streaks',
    'achievements',
    'marketplace_suggestions'
  ];

  const actualTables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")
    .all()
    .map(row => row.name);

  console.log(`Found ${actualTables.length} tables in database.`);

  const missingTables = expectedTables.filter(table => !actualTables.includes(table));
  if (missingTables.length > 0) {
    console.error('❌ Missing tables:', missingTables);
    throw new Error(`Schema verification failed. Missing ${missingTables.length} tables.`);
  }

  // Verify migrations applied
  const migrations = db.prepare('SELECT name, applied_at FROM schema_migrations').all();
  console.log('Applied Migrations:', migrations);
  if (migrations.length < 3) {
    throw new Error(`Expected at least 3 migrations, found ${migrations.length}`);
  }

  // Verify tasks table columns
  const taskColumns = db.prepare("PRAGMA table_info(tasks)").all().map(c => c.name);
  const requiredTaskColumns = ['instructions', 'resources', 'deadline', 'difficulty', 'xp_reward', 'badge_reward', 'proof_requirements'];
  const missingTaskCols = requiredTaskColumns.filter(col => !taskColumns.includes(col));
  if (missingTaskCols.length > 0) {
    throw new Error(`Tasks table is missing required columns: ${missingTaskCols.join(', ')}`);
  }

  // Verify foreign key integrity
  const fkErrors = db.prepare('PRAGMA foreign_key_check').all();
  if (fkErrors.length > 0) {
    console.error('❌ Foreign key integrity errors found:', fkErrors);
    throw new Error('Foreign key integrity check failed.');
  }

  // Count indexes
  const indexes = db.prepare("SELECT name FROM sqlite_master WHERE type='index' AND name NOT LIKE 'sqlite_%'").all();
  console.log(`Found ${indexes.length} indexes in database.`);

  console.log('✅ ALL DATABASE SCHEMA CHECKS PASSED SUCCESSFULLY!');
}

if (process.argv[1] && process.argv[1].endsWith('verify_schema.js')) {
  verifySchema();
}
