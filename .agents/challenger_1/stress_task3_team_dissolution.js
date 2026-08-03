import http from 'http';
import { db, initSchema } from '../../src/server/db/database.js';
import { startServer, stopServer } from '../../src/server/index.js';

const PORT = 4002;
const BASE_URL = `http://localhost:${PORT}`;

async function request(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const req = http.request(url, { method, headers: { 'Content-Type': 'application/json' } }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        let json = null;
        try { json = JSON.parse(data); } catch (_) {}
        resolve({ status: res.statusCode, data: json, text: data });
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

function resetDb() {
  db.pragma('foreign_keys = OFF');
  db.exec(`
    DROP TABLE IF EXISTS hall_of_fame_titles;
    DROP TABLE IF EXISTS task_submissions;
    DROP TABLE IF EXISTS task_upvotes;
    DROP TABLE IF EXISTS team_memberships;
    DROP TABLE IF EXISTS teams;
    DROP TABLE IF EXISTS tasks;
    DROP TABLE IF EXISTS student_leader_rotations;
    DROP TABLE IF EXISTS users;
  `);
  db.pragma('foreign_keys = ON');

  initSchema();

  db.prepare(`
    INSERT INTO users (id, name, username, email, password_hash, role)
    VALUES 
      ('u_dev', 'Aaron Dev', 'aaron_dev', 'aaron@forge.local', 'pass123', 'DEV_STEALTH'),
      ('u_teacher', 'Prof Vance', 'teacher_vance', 'teacher@forge.local', 'pass123', 'TEACHER'),
      ('u_l1', 'Marcus Lead', 'marcus_lead', 'marcus@forge.local', 'pass123', 'STUDENT_LEADER'),
      ('u_o1', 'Alex Op', 'alex_op', 'alex@forge.local', 'pass123', 'OPERATIVE'),
      ('u_o2', 'Elena Op', 'elena_op', 'elena@forge.local', 'pass123', 'OPERATIVE'),
      ('u_o3', 'Jordan Op', 'jordan_op', 'jordan@forge.local', 'pass123', 'OPERATIVE'),
      ('u_o4', 'Taylor Op', 'taylor_op', 'taylor@forge.local', 'pass123', 'OPERATIVE'),
      ('u_o5', 'Sam Op', 'sam_op', 'sam@forge.local', 'pass123', 'OPERATIVE')
  `).run();
}

async function runTests() {
  console.log('--- STARTING STRESS TASK 3 (TEAM DISSOLUTION) TESTS ---');
  await startServer(PORT);
  const results = [];

  try {
    // 3.0: Test POST /api/teams endpoint robustness
    resetDb();
    console.log('\n[3.0] Testing POST /api/teams API endpoint creation...');
    const apiCreateRes = await request('POST', '/api/teams', {
      name: 'API Squad',
      captain_id: 'u_o1',
      member_ids: ['u_o1', 'u_o2']
    });

    results.push({
      test: '3.0 POST /api/teams Endpoint Execution',
      passed: apiCreateRes.status === 200,
      details: `Status: ${apiCreateRes.status}, Error/Response text: ${apiCreateRes.text.slice(0, 150)}`
    });

    // Helper to insert team directly into DB for testing downstream dissolution behavior
    function insertTestTeam(id, name, captainId, memberIds) {
      db.prepare("INSERT INTO teams (id, name, captain_id, is_active, status) VALUES (?, ?, ?, 1, 'ACTIVE')").run(id, name, captainId);
      const insertMem = db.prepare("INSERT INTO team_memberships (id, user_id, team_id, custom_point_share) VALUES (?, ?, ?, 1.0)");
      memberIds.forEach((uid, idx) => {
        insertMem.run(`tm_${id}_${idx}`, uid, id);
      });
    }

    // 3.1: 4-Member Team Auto-Dissolution upon Task Completion
    resetDb();
    console.log('\n[3.1] Testing 4-member team auto-dissolution upon task completion...');
    
    // Create 4-member team in DB
    const teamId4 = 't_quad';
    insertTestTeam(teamId4, 'Quad Squad', 'u_o1', ['u_o1', 'u_o2', 'u_o3', 'u_o4']);

    // Create & assign task to 4-member team
    db.prepare(`
      INSERT INTO tasks (id, title, description, total_points, is_marketplace, assigned_team_id, status)
      VALUES ('t_quad_task', 'Quad Task', 'Complete quad project', 100, 0, ?, 'IN_PROGRESS')
    `).run(teamId4);
    db.prepare('UPDATE teams SET task_id = ? WHERE id = ?').run('t_quad_task', teamId4);

    // Complete/Approve task
    const completeRes4 = await request('POST', '/api/tasks/t_quad_task/complete');

    // Query DB for team status
    const teamDb4 = db.prepare('SELECT * FROM teams WHERE id = ?').get(teamId4);
    const activeTeams = await request('GET', '/api/teams');

    const pass4MemberAutoDissolve = 
      completeRes4.status === 200 &&
      teamDb4.is_active === 0 &&
      teamDb4.status === 'DISSOLVED' &&
      teamDb4.dissolution_reason === 'TASK_COMPLETED' &&
      !activeTeams.data.some(t => t.id === teamId4);

    results.push({
      test: '3.1 4-Member Team Auto-Dissolution on Task Complete',
      passed: pass4MemberAutoDissolve,
      details: `API Auto-Dissolved Flag: ${completeRes4.data?.auto_dissolved}, DB is_active: ${teamDb4?.is_active}, status: ${teamDb4?.status}, Listed in active teams: ${activeTeams.data.some(t => t.id === teamId4)}`
    });

    // 3.2: Explicit Team Dissolution via POST /api/teams/:id/dissolve
    resetDb();
    console.log('\n[3.2] Testing Explicit Team Dissolution via API...');
    const teamIdExp = 't_exp';
    insertTestTeam(teamIdExp, 'Explicit Squad', 'u_o1', ['u_o1', 'u_o2', 'u_o3', 'u_o4']);

    const dissolveRes = await request('POST', `/api/teams/${teamIdExp}/dissolve`, { reason: 'MANUAL_EXPLICIT_TEST' });
    const teamDbExp = db.prepare('SELECT * FROM teams WHERE id = ?').get(teamIdExp);
    const activeTeamsExp = await request('GET', '/api/teams');

    const passExplicitDissolve = 
      dissolveRes.status === 200 &&
      teamDbExp.is_active === 0 &&
      teamDbExp.status === 'DISSOLVED' &&
      teamDbExp.dissolution_reason === 'MANUAL_EXPLICIT_TEST' &&
      !activeTeamsExp.data.some(t => t.id === teamIdExp);

    results.push({
      test: '3.2 Explicit Team Dissolution API',
      passed: passExplicitDissolve,
      details: `API status: ${dissolveRes.status}, DB is_active: ${teamDbExp?.is_active}, reason: ${teamDbExp?.dissolution_reason}`
    });

    // 3.3: Corner Case — 2-Member Team Auto-Dissolution Check
    resetDb();
    console.log('\n[3.3] Checking 2-Member Team Auto-Dissolution behavior on Task Complete...');
    const teamId2 = 't_duo';
    insertTestTeam(teamId2, 'Duo Squad', 'u_o1', ['u_o1', 'u_o2']);

    db.prepare(`
      INSERT INTO tasks (id, title, description, total_points, is_marketplace, assigned_team_id, status)
      VALUES ('t_duo_task', 'Duo Task', 'Complete duo project', 50, 0, ?, 'IN_PROGRESS')
    `).run(teamId2);
    db.prepare('UPDATE teams SET task_id = ? WHERE id = ?').run('t_duo_task', teamId2);

    const completeRes2 = await request('POST', '/api/tasks/t_duo_task/complete');
    const teamDb2 = db.prepare('SELECT * FROM teams WHERE id = ?').get(teamId2);

    // If requirement says 4-member teams auto-dissolve, does the implementation erroneously dissolve 2-member teams too?
    results.push({
      test: '3.3 2-Member Team Auto-Dissolution Check (Should stay active)',
      passed: teamDb2.is_active === 1,
      details: `DB is_active: ${teamDb2.is_active}, status: ${teamDb2.status}. Hardcoded line 323: 'if (memberCount >= 4 || true)' causes 2-member teams to auto-dissolve as well!`
    });

    // 3.4: Cohort Pool Verification (Users from dissolved teams are unassigned from active teams)
    resetDb();
    console.log('\n[3.4] Verifying cohort pool unassigned status after dissolution...');
    const teamIdPool = 't_pool';
    insertTestTeam(teamIdPool, 'Pool Squad', 'u_o1', ['u_o1', 'u_o2', 'u_o3', 'u_o4']);
    await request('POST', `/api/teams/${teamIdPool}/dissolve`);

    // Check if u_o1, u_o2, u_o3, u_o4 belong to any active team
    const usersInActiveTeams = db.prepare(`
      SELECT DISTINCT tm.user_id 
      FROM team_memberships tm 
      JOIN teams t ON tm.team_id = t.id 
      WHERE t.is_active = 1
    `).all().map(r => r.user_id);

    const membersFreed = ['u_o1', 'u_o2', 'u_o3', 'u_o4'].every(uid => !usersInActiveTeams.includes(uid));

    results.push({
      test: '3.4 Users Returned to General Cohort Pool after Dissolution',
      passed: membersFreed,
      details: `Members in active teams count: ${usersInActiveTeams.length}, All 4 members unassigned: ${membersFreed}`
    });

  } finally {
    stopServer();
  }

  console.log('\n--- STRESS TASK 3 SUMMARY RESULTS ---');
  results.forEach(r => {
    console.log(`[${r.passed ? 'PASS' : 'FAIL'}] ${r.test}`);
    console.log(`       Details: ${r.details}`);
  });
}

runTests();
