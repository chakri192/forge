import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const testDbPath = path.join(__dirname, 'test_points.db');

if (fs.existsSync(testDbPath)) {
  fs.unlinkSync(testDbPath);
}

const db = new Database(testDbPath);

db.exec(`
  CREATE TABLE users (id TEXT PRIMARY KEY, name TEXT, role TEXT);
  CREATE TABLE teams (id TEXT PRIMARY KEY, name TEXT);
  CREATE TABLE team_memberships (id TEXT PRIMARY KEY, user_id TEXT, team_id TEXT, custom_point_share REAL);
  CREATE TABLE tasks (id TEXT PRIMARY KEY, title TEXT, total_points INTEGER, assigned_team_id TEXT, assigned_user_id TEXT, status TEXT);
`);

console.log('====================================================');
console.log('🧪 EMPIRICAL TEST HARNESS 1: DYNAMIC POINT FORMULA');
console.log('====================================================\n');

function runTestScenario(scenarioName, teamSize, weights, taskPoints) {
  // Clear tables
  db.exec('DELETE FROM users; DELETE FROM teams; DELETE FROM team_memberships; DELETE FROM tasks;');

  const teamId = 't_test';
  db.prepare('INSERT INTO teams VALUES (?, ?)').run(teamId, 'Test Team');
  db.prepare('INSERT INTO tasks VALUES (?, ?, ?, ?, ?, ?)').run('tk_1', 'Test Task', taskPoints, teamId, null, 'COMPLETED');

  const members = [];
  for (let i = 0; i < teamSize; i++) {
    const userId = `u_${i+1}`;
    const weight = weights[i];
    db.prepare('INSERT INTO users VALUES (?, ?, ?)').run(userId, `User ${i+1}`, 'OPERATIVE');
    db.prepare('INSERT INTO team_memberships VALUES (?, ?, ?, ?)').run(`tm_${i+1}`, userId, teamId, weight);
    members.push({ userId, weight });
  }

  // Execute formula as implemented in server/index.js
  const results = [];
  let sumRounded = 0;
  let sumExact = 0;

  for (const m of members) {
    const teamTasks = db.prepare(`
      SELECT t.total_points, tm.custom_point_share, tm.team_id,
        (SELECT SUM(sub_tm.custom_point_share) FROM team_memberships sub_tm WHERE sub_tm.team_id = tm.team_id) as total_team_weight
      FROM team_memberships tm
      JOIN tasks t ON tm.team_id = t.assigned_team_id
      WHERE tm.user_id = ? AND t.status = 'COMPLETED'
    `).all(m.userId);

    let teamPointsExact = 0;
    for (const tt of teamTasks) {
      if (tt.total_team_weight > 0) {
        teamPointsExact += (tt.total_points * (tt.custom_point_share / tt.total_team_weight));
      }
    }

    const roundedPoints = Math.round(teamPointsExact);
    sumExact += teamPointsExact;
    sumRounded += roundedPoints;

    const theoreticalWeightSum = weights.reduce((a, b) => a + b, 0);
    const theoreticalExact = theoreticalWeightSum > 0 ? taskPoints * (m.weight / theoreticalWeightSum) : 0;

    results.push({
      userId: m.userId,
      weight: m.weight,
      exactCalculated: teamPointsExact,
      theoreticalExact: theoreticalExact,
      roundedCalculated: roundedPoints,
      mathMatch: Math.abs(teamPointsExact - theoreticalExact) < 1e-9
    });
  }

  const pointDiscrepancy = sumRounded - taskPoints;

  console.log(`Scenario: ${scenarioName}`);
  console.log(`  Task Points (P_total): ${taskPoints}`);
  console.log(`  Team Size: ${teamSize}`);
  console.log(`  Weights: [${weights.join(', ')}] (Sum: ${weights.reduce((a, b) => a + b, 0)})`);
  console.log(`  Exact Sum Across Team: ${sumExact.toFixed(4)} (Expected: ${taskPoints})`);
  console.log(`  Rounded Sum Across Team: ${sumRounded} (Discrepancy vs P_total: ${pointDiscrepancy > 0 ? '+' + pointDiscrepancy : pointDiscrepancy})`);
  results.forEach(r => {
    console.log(`    - ${r.userId} (W=${r.weight}): Exact=${r.exactCalculated.toFixed(4)}, Rounded=${r.roundedCalculated}, Math Match=${r.mathMatch ? 'PASS' : 'FAIL'}`);
  });
  console.log('----------------------------------------------------\n');

  return { scenarioName, taskPoints, teamSize, sumExact, sumRounded, pointDiscrepancy, results };
}

const summaryLogs = [];
summaryLogs.push(runTestScenario('1. Monopole Team (Size = 1, W = 1.0)', 1, [1.0], 50));
summaryLogs.push(runTestScenario('2. Equal Duo (Size = 2, W = [1.0, 1.0])', 2, [1.0, 1.0], 50));
summaryLogs.push(runTestScenario('3. Custom Trio (Size = 3, W = [1.2, 0.8, 1.0])', 3, [1.2, 0.8, 1.0], 100));
summaryLogs.push(runTestScenario('4. Zero Weight Member (Size = 4, W = [2.0, 1.5, 0.5, 0.0])', 4, [2.0, 1.5, 0.5, 0.0], 100));
summaryLogs.push(runTestScenario('5. Rounding Loss Test (Size = 3, 100 PTS split equally)', 3, [1.0, 1.0, 1.0], 100));
summaryLogs.push(runTestScenario('6. Rounding Inflation Test (Size = 3, 50 PTS split equally)', 3, [1.0, 1.0, 1.0], 50));
summaryLogs.push(runTestScenario('7. Rounding Loss Test 2 (Size = 3, 10 PTS split equally)', 3, [1.0, 1.0, 1.0], 10));
summaryLogs.push(runTestScenario('8. Prime Split (Size = 7, 25 PTS split equally)', 7, [1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0], 25));
summaryLogs.push(runTestScenario('9. Zero Total Weight (Size = 3, W = [0, 0, 0])', 3, [0, 0, 0], 50));
summaryLogs.push(runTestScenario('10. Large Team (Size = 10, custom linear weights)', 10, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 550));

db.close();
if (fs.existsSync(testDbPath)) {
  fs.unlinkSync(testDbPath);
}

console.log('✅ Harness 1 complete.');
