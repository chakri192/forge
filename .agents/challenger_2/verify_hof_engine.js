import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const testDbPath = path.join(__dirname, 'test_hof.db');

if (fs.existsSync(testDbPath)) {
  fs.unlinkSync(testDbPath);
}

const db = new Database(testDbPath);

db.exec(`
  CREATE TABLE users (
    id TEXT PRIMARY KEY, name TEXT, username TEXT, email TEXT, phone TEXT, role TEXT, tag TEXT
  );
  CREATE TABLE teams (id TEXT PRIMARY KEY, name TEXT);
  CREATE TABLE team_memberships (
    id TEXT PRIMARY KEY, user_id TEXT, team_id TEXT, custom_point_share REAL
  );
  CREATE TABLE tasks (
    id TEXT PRIMARY KEY, title TEXT, total_points INTEGER, assigned_team_id TEXT, assigned_user_id TEXT, status TEXT, created_at DATETIME
  );
  CREATE TABLE hall_of_fame_titles (
    id TEXT PRIMARY KEY, title_name TEXT, category TEXT, awarded_to_user_id TEXT, awarded_to_team_id TEXT, season TEXT, awarded_at DATETIME
  );
`);

console.log('====================================================');
console.log('🧪 EMPIRICAL TEST HARNESS 2: HALL OF FAME ENGINES');
console.log('====================================================\n');

// Seed test users: 3 Operatives, 1 Stealth Dev
db.prepare('INSERT INTO users VALUES (?, ?, ?, ?, ?, ?, ?)').run('u_op1', 'Alice', 'alice_op', 'alice@forge.local', '111', 'OPERATIVE', 'Ninja');
db.prepare('INSERT INTO users VALUES (?, ?, ?, ?, ?, ?, ?)').run('u_op2', 'Bob', 'bob_op', 'bob@forge.local', '222', 'OPERATIVE', 'Wizard');
db.prepare('INSERT INTO users VALUES (?, ?, ?, ?, ?, ?, ?)').run('u_op3', 'Charlie', 'charlie_op', 'charlie@forge.local', '333', 'OPERATIVE', 'Guru');
db.prepare('INSERT INTO users VALUES (?, ?, ?, ?, ?, ?, ?)').run('u_dev', 'Shadow Dev', 'shadow_dev', 'dev@forge.local', '000', 'DEV_STEALTH', 'Creator');

// Seed Team
db.prepare('INSERT INTO teams VALUES (?, ?)').run('t_alpha', 'Alpha Squad');
db.prepare('INSERT INTO team_memberships VALUES (?, ?, ?, ?)').run('tm_1', 'u_op1', 't_alpha', 1.0);
db.prepare('INSERT INTO team_memberships VALUES (?, ?, ?, ?)').run('tm_2', 'u_op2', 't_alpha', 1.0);
db.prepare('INSERT INTO team_memberships VALUES (?, ?, ?, ?)').run('tm_3', 'u_dev', 't_alpha', 1.0);

// Seed Tasks: Season 1 vs Season 2 (dated)
db.prepare('INSERT INTO tasks VALUES (?, ?, ?, ?, ?, ?, ?)').run('task_s1_1', 'Season 1 Team Task', 60, 't_alpha', null, 'COMPLETED', '2026-01-15 10:00:00');
db.prepare('INSERT INTO tasks VALUES (?, ?, ?, ?, ?, ?, ?)').run('task_s1_2', 'Season 1 Indiv Task Bob', 40, null, 'u_op2', 'COMPLETED', '2026-01-20 10:00:00');
db.prepare('INSERT INTO tasks VALUES (?, ?, ?, ?, ?, ?, ?)').run('task_s2_1', 'Season 2 Team Task', 100, 't_alpha', null, 'COMPLETED', '2026-07-15 10:00:00');

// Seed HOF Titles with different seasons
db.prepare('INSERT INTO hall_of_fame_titles VALUES (?, ?, ?, ?, ?, ?, ?)').run('title_1', 'Season 1 Champion', 'Academics', 'u_op1', null, 'Season 1', '2026-02-01');
db.prepare('INSERT INTO hall_of_fame_titles VALUES (?, ?, ?, ?, ?, ?, ?)').run('title_2', 'All-Time Legend', 'Leadership', 'u_op2', null, 'All-Time', '2026-07-01');

// Run server getHallOfFameLeaderboard code snippet
function getHallOfFameLeaderboard() {
  const users = db.prepare(`
    SELECT id, name, username, email, phone, role, tag 
    FROM users 
    WHERE role != 'DEV_STEALTH'
  `).all();

  const leaderboard = users.map(user => {
    // Team completed tasks points
    const teamTasks = db.prepare(`
      SELECT t.total_points, tm.custom_point_share, tm.team_id,
        (SELECT SUM(sub_tm.custom_point_share) FROM team_memberships sub_tm WHERE sub_tm.team_id = tm.team_id) as total_team_weight
      FROM team_memberships tm
      JOIN tasks t ON tm.team_id = t.assigned_team_id
      WHERE tm.user_id = ? AND t.status = 'COMPLETED'
    `).all(user.id);

    let teamPoints = 0;
    for (const tt of teamTasks) {
      if (tt.total_team_weight > 0) {
        teamPoints += (tt.total_points * (tt.custom_point_share / tt.total_team_weight));
      }
    }

    // Individual completed tasks points
    const indivTasks = db.prepare(`
      SELECT SUM(total_points) as total
      FROM tasks
      WHERE assigned_user_id = ? AND status = 'COMPLETED'
    `).get(user.id);

    const indivPoints = (indivTasks && indivTasks.total) ? indivTasks.total : 0;
    const totalPoints = Math.round(teamPoints + indivPoints);

    return {
      id: user.id,
      name: user.name,
      username: user.username,
      tag: user.tag,
      role: user.role === 'DEV_STEALTH' ? 'OPERATIVE' : user.role,
      public_role: user.role === 'DEV_STEALTH' ? 'OPERATIVE' : user.role,
      points: totalPoints
    };
  });

  return leaderboard.sort((a, b) => b.points - a.points);
}

// 1. Test allTime vs season1 identity
const allTime = getHallOfFameLeaderboard();
const season1 = getHallOfFameLeaderboard();

console.log('1. Leaderboard Equality Check (allTime vs season1):');
console.log(`   allTime length: ${allTime.length}, season1 length: ${season1.length}`);
const isEqualContent = JSON.stringify(allTime) === JSON.stringify(season1);
console.log(`   Are allTime and season1 return objects EXACTLY IDENTICAL? ${isEqualContent ? 'YES (Defect confirmed: season1 does not filter by season)' : 'NO'}`);
console.log('   allTime:', JSON.stringify(allTime));
console.log('   season1:', JSON.stringify(season1));
console.log('----------------------------------------------------\n');

// 2. Test Stealth Dev Exclusion
console.log('2. Stealth Developer Exclusion Check:');
const devInAllTime = allTime.find(u => u.id === 'u_dev');
console.log(`   Is u_dev excluded from leaderboard? ${devInAllTime === undefined ? 'PASS (Excluded)' : 'FAIL (Included)'}`);
console.log('----------------------------------------------------\n');

// 3. Test Tie-breaking order
console.log('3. Tie-Breaking Order Analysis:');
db.exec('DELETE FROM tasks;');
// Alice and Bob both complete 50pt tasks
db.prepare('INSERT INTO tasks VALUES (?, ?, ?, ?, ?, ?, ?)').run('t_alice', 'Alice Task', 50, null, 'u_op1', 'COMPLETED', '2026-01-01');
db.prepare('INSERT INTO tasks VALUES (?, ?, ?, ?, ?, ?, ?)').run('t_bob', 'Bob Task', 50, null, 'u_op2', 'COMPLETED', '2026-01-01');

const tiedLeaderboard = getHallOfFameLeaderboard();
console.log('   Tied Leaderboard Results:');
tiedLeaderboard.forEach((u, idx) => console.log(`   Rank ${idx + 1}: ${u.name} (${u.id}) - ${u.points} PTS`));
console.log('   Note: Sort uses b.points - a.points without secondary tiebreaker key.');
console.log('----------------------------------------------------\n');

// 4. Test HOF Titles query
console.log('4. Hall of Fame Titles Grant Audit:');
const titles = db.prepare(`
  SELECT h.*, u.name as user_name, tm.name as team_name 
  FROM hall_of_fame_titles h 
  LEFT JOIN users u ON h.awarded_to_user_id = u.id 
  LEFT JOIN teams tm ON h.awarded_to_team_id = tm.id 
  ORDER BY h.awarded_at DESC
`).all();
console.log('   Retrieved HOF Titles:');
titles.forEach(t => console.log(`   - Title: "${t.title_name}" | Category: ${t.category} | Season: ${t.season} | Awarded To User: ${t.user_name || 'N/A'} | Awarded To Team: ${t.team_name || 'N/A'}`));

db.close();
if (fs.existsSync(testDbPath)) {
  fs.unlinkSync(testDbPath);
}

console.log('\n✅ Harness 2 complete.');
