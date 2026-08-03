import http from 'http';
import { db, initSchema } from '../../src/server/db/database.js';
import { startServer, stopServer } from '../../src/server/index.js';

const PORT = 4003;
const BASE_URL = `http://localhost:${PORT}`;

async function request(method, path, body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const reqHeaders = { 'Content-Type': 'application/json', ...headers };
    const req = http.request(url, { method, headers: reqHeaders }, (res) => {
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
      ('u_dev', 'Aaron Stealth Dev', 'aaron_dev', 'aaron@forge.local', 'pass123', 'DEV_STEALTH'),
      ('u_teacher', 'Prof Vance', 'teacher_vance', 'teacher@forge.local', 'pass123', 'TEACHER'),
      ('u_o1', 'Alex Op', 'alex_op', 'alex@forge.local', 'pass123', 'OPERATIVE'),
      ('u_o2', 'Elena Op', 'elena_op', 'elena@forge.local', 'pass123', 'OPERATIVE')
  `).run();

  // Give u_dev 1,000 points via individual completed tasks
  db.prepare(`
    INSERT INTO tasks (id, title, description, total_points, assigned_user_id, status)
    VALUES 
      ('task_dev1', 'Stealth Master Task 1', 'Desc', 500, 'u_dev', 'COMPLETED'),
      ('task_dev2', 'Stealth Master Task 2', 'Desc', 500, 'u_dev', 'COMPLETED'),
      ('task_o1', 'Alex Task', 'Desc', 100, 'u_o1', 'COMPLETED')
  `).run();
}

async function runTests() {
  console.log('--- STARTING STRESS TASK 4 (STEALTH LEADERBOARD EXCLUSION) TESTS ---');
  await startServer(PORT);
  const results = [];

  try {
    resetDb();

    // 4.1: Concurrent Leaderboard Requests (100 parallel requests) under High-Point DEV_STEALTH load
    console.log('\n[4.1] Testing 100 parallel GET /api/hall-of-fame requests with high-scoring DEV_STEALTH user...');
    const promises = [];
    for (let i = 0; i < 100; i++) {
      promises.push(request('GET', '/api/hall-of-fame'));
    }
    const responses = await Promise.all(promises);

    let stealthExposedInLeaderboard = false;
    let validResponses = 0;

    responses.forEach(res => {
      if (res.status === 200 && res.data) {
        validResponses++;
        const allTime = res.data.allTime || [];
        const season1 = res.data.season1 || [];
        if (allTime.some(u => u.id === 'u_dev' || u.role === 'DEV_STEALTH') ||
            season1.some(u => u.id === 'u_dev' || u.role === 'DEV_STEALTH')) {
          stealthExposedInLeaderboard = true;
        }
      }
    });

    results.push({
      test: '4.1 DEV_STEALTH Excluded from Leaderboard under Concurrent Load (100 reqs)',
      passed: !stealthExposedInLeaderboard && validResponses === 100,
      details: `Valid 200 OK responses: ${validResponses}/100, DEV_STEALTH leaked in leaderboard: ${stealthExposedInLeaderboard}`
    });

    // 4.2: Inspect Role Leakage in GET /api/users
    console.log('\n[4.2] Inspecting GET /api/users for role leakage...');
    const usersRes = await request('GET', '/api/users');
    const devUserInUsersApi = usersRes.data.find(u => u.id === 'u_dev');
    
    // Check if raw role 'DEV_STEALTH' is leaked in the user object
    const roleLeakedInUsersApi = devUserInUsersApi && devUserInUsersApi.role === 'DEV_STEALTH';

    results.push({
      test: '4.2 GET /api/users Stealth Privacy Protection',
      passed: !roleLeakedInUsersApi,
      details: `public_role: ${devUserInUsersApi?.public_role}, raw role property: ${devUserInUsersApi?.role} (Leaked: ${roleLeakedInUsersApi})`
    });

    // 4.3: Inspect Role Leakage in GET /api/teams
    console.log('\n[4.3] Inspecting GET /api/teams for role leakage...');
    db.prepare("INSERT INTO teams (id, name, captain_id, is_active, status) VALUES ('t_stealth', 'Stealth Squad', 'u_dev', 1, 'ACTIVE')").run();
    db.prepare("INSERT INTO team_memberships (id, user_id, team_id, custom_point_share) VALUES ('tm_dev', 'u_dev', 't_stealth', 1.0)").run();
    
    const teamsRes = await request('GET', '/api/teams');
    const stealthTeam = teamsRes.data.find(t => t.id === 't_stealth');
    const devMemberInTeam = stealthTeam?.members.find(m => m.id === 'u_dev');
    const roleLeakedInTeamsApi = devMemberInTeam && devMemberInTeam.role === 'DEV_STEALTH';

    results.push({
      test: '4.3 GET /api/teams Stealth Privacy Protection',
      passed: !roleLeakedInTeamsApi,
      details: `public_role: ${devMemberInTeam?.public_role}, raw role property: ${devMemberInTeam?.role} (Leaked: ${roleLeakedInTeamsApi})`
    });

    // 4.4: Hall of Fame Titles Wall Exclusion / Anonymization
    console.log('\n[4.4] Inspecting Hall of Fame Titles Wall for DEV_STEALTH award...');
    await request('POST', '/api/hall-of-fame/award', {
      title_name: 'Stealth Ninja Award',
      category: 'Innovation',
      awarded_to_user_id: 'u_dev'
    });
    const hofRes = await request('GET', '/api/hall-of-fame');
    const stealthTitle = hofRes.data?.titles?.find(t => t.title_name === 'Stealth Ninja Award');

    results.push({
      test: '4.4 Hall of Fame Titles Wall DEV_STEALTH Exposure Check',
      passed: stealthTitle && stealthTitle.user_name === 'Aaron Stealth Dev', // Title wall exhibits user name
      details: `Title awarded to: ${stealthTitle?.user_name} (User ID: ${stealthTitle?.awarded_to_user_id})`
    });

  } finally {
    stopServer();
  }

  console.log('\n--- STRESS TASK 4 SUMMARY RESULTS ---');
  results.forEach(r => {
    console.log(`[${r.passed ? 'PASS' : 'FAIL'}] ${r.test}`);
    console.log(`       Details: ${r.details}`);
  });
}

runTests();
