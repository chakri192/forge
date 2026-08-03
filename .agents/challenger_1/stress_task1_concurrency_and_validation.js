import http from 'http';
import { db, initSchema } from '../../src/server/db/database.js';
import { startServer, stopServer } from '../../src/server/index.js';

const PORT = 4001;
const BASE_URL = `http://localhost:${PORT}`;

async function request(method, path, body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const reqHeaders = {
      'Content-Type': 'application/json',
      ...headers
    };
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
    if (body) {
      req.write(JSON.stringify(body));
    }
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
      ('u_o4', 'Taylor Op', 'taylor_op', 'taylor@forge.local', 'pass123', 'OPERATIVE')
  `).run();

  db.prepare(`
    INSERT INTO tasks (id, title, description, total_points, is_marketplace, status)
    VALUES 
      ('task1', 'Official Task 1', 'Desc', 50, 0, 'IN_PROGRESS'),
      ('m_task1', 'Marketplace Task 1', 'Desc', 20, 1, 'MARKETPLACE')
  `).run();

  db.prepare(`
    INSERT INTO teams (id, name, captain_id, is_active, status)
    VALUES ('t1', 'Team Alpha', 'u_o1', 1, 'ACTIVE')
  `).run();

  db.prepare(`
    INSERT INTO team_memberships (id, user_id, team_id, custom_point_share)
    VALUES 
      ('tm1', 'u_o1', 't1', 1.0),
      ('tm2', 'u_o2', 't1', 1.0)
  `).run();
}

async function runTests() {
  console.log('--- STARTING STRESS TASK 1 TESTS ---');
  await startServer(PORT);
  const results = [];

  try {
    // Test 1.1: Concurrent Upvoting from 50 requests (5 distinct users x 10 requests each)
    resetDb();
    console.log('\n[1.1] Testing Concurrent Upvoting across 5 distinct users (50 parallel requests)...');
    const users = ['u_o1', 'u_o2', 'u_o3', 'u_o4', 'u_l1'];
    const upvotePromises = [];
    for (let i = 0; i < 50; i++) {
      const u = users[i % users.length];
      upvotePromises.push(request('POST', '/api/tasks/m_task1/upvote', { user_id: u }));
    }
    const upvoteRes = await Promise.all(upvotePromises);
    const finalUpvoteCount = db.prepare('SELECT COUNT(*) as count FROM task_upvotes WHERE task_id = ?').get('m_task1').count;
    const upvoteSuccess = finalUpvoteCount === 5 && upvoteRes.every(r => r.status === 200);
    results.push({
      test: '1.1 Concurrent Upvoting (50 reqs, 5 users)',
      passed: upvoteSuccess,
      details: `Expected upvotes: 5, Actual upvotes in DB: ${finalUpvoteCount}, HTTP 200s: ${upvoteRes.filter(r => r.status === 200).length}/50`
    });

    // Test 1.2: Duplicate Upvote Prevention (Same user upvoting 20 times concurrently)
    resetDb();
    console.log('\n[1.2] Testing Duplicate Upvote Prevention (20 parallel requests from same user)...');
    const dupPromises = [];
    for (let i = 0; i < 20; i++) {
      dupPromises.push(request('POST', '/api/tasks/m_task1/upvote', { user_id: 'u_o1' }));
    }
    await Promise.all(dupPromises);
    const dupCount = db.prepare('SELECT COUNT(*) as count FROM task_upvotes WHERE task_id = ? AND user_id = ?').get('m_task1', 'u_o1').count;
    results.push({
      test: '1.2 Duplicate Upvote Prevention',
      passed: dupCount === 1,
      details: `Upvotes for u_o1: ${dupCount} (Expected: 1)`
    });

    // Test 1.3: Invalid Point Override Weights
    resetDb();
    console.log('\n[1.3] Testing Invalid Point Override Weights...');
    
    // 1.3a Negative weight
    const negRes = await request('POST', '/api/teams/t1/points/override', { user_id: 'u_o1', custom_point_share: -5 });
    
    // 1.3b String weight "invalid"
    const strRes = await request('POST', '/api/teams/t1/points/override', { user_id: 'u_o1', custom_point_share: "invalid" });
    
    // 1.3c Zero total team weight check
    await request('POST', '/api/teams/t1/points/override', { user_id: 'u_o1', custom_point_share: 0 });
    await request('POST', '/api/teams/t1/points/override', { user_id: 'u_o2', custom_point_share: 0 });
    const hofRes = await request('GET', '/api/hall-of-fame');
    
    results.push({
      test: '1.3a Negative Weight Rejection (-5)',
      passed: negRes.status === 400,
      details: `Status: ${negRes.status}, Response: ${JSON.stringify(negRes.data)}`
    });

    results.push({
      test: '1.3b Invalid String Weight Rejection ("invalid")',
      passed: strRes.status === 400,
      details: `Status: ${strRes.status}, Response: ${JSON.stringify(strRes.data)}`
    });

    results.push({
      test: '1.3c Zero Team Weight Handling in Leaderboard',
      passed: hofRes.status === 200 && Array.isArray(hofRes.data?.allTime) && !hofRes.data.allTime.some(u => Number.isNaN(u.points)),
      details: `Leaderboard HTTP: ${hofRes.status}, Points NaN check passed`
    });

    // Test 1.4: Non-Existent User/Team/Task IDs
    resetDb();
    console.log('\n[1.4] Testing Non-Existent Resource IDs...');
    
    // 1.4a Upvote non-existent task
    const nonTaskUpvote = await request('POST', '/api/tasks/NON_EXISTENT_TASK/upvote', { user_id: 'u_o1' });
    
    // 1.4b Upvote with non-existent user
    const nonUserUpvote = await request('POST', '/api/tasks/m_task1/upvote', { user_id: 'NON_EXISTENT_USER' });
    
    // 1.4c Point override for non-existent team
    const nonTeamOverride = await request('POST', '/api/teams/NON_EXISTENT_TEAM/points/override', { user_id: 'u_o1', custom_point_share: 1.5 });

    // 1.4d Assign task to non-existent team
    const nonTeamAssign = await request('POST', '/api/tasks/m_task1/assign', { team_id: 'NON_EXISTENT_TEAM' });

    // 1.4e Complete non-existent task
    const nonTaskComplete = await request('POST', '/api/tasks/NON_EXISTENT_TASK/complete');

    results.push({
      test: '1.4a Upvote Non-Existent Task',
      passed: nonTaskUpvote.status === 404 || nonTaskUpvote.status === 400,
      details: `Status: ${nonTaskUpvote.status}, Error text: ${nonTaskUpvote.text.slice(0, 100)}`
    });

    results.push({
      test: '1.4b Upvote with Non-Existent User',
      passed: nonUserUpvote.status === 404 || nonUserUpvote.status === 400,
      details: `Status: ${nonUserUpvote.status}, Error text: ${nonUserUpvote.text.slice(0, 100)}`
    });

    results.push({
      test: '1.4c Point Override Non-Existent Team',
      passed: nonTeamOverride.status === 404,
      details: `Status: ${nonTeamOverride.status}, Data: ${JSON.stringify(nonTeamOverride.data)}`
    });

    results.push({
      test: '1.4d Assign Task Non-Existent Team',
      passed: nonTeamAssign.status === 404,
      details: `Status: ${nonTeamAssign.status}, Data: ${JSON.stringify(nonTeamAssign.data)}`
    });

    results.push({
      test: '1.4e Complete Non-Existent Task',
      passed: nonTaskComplete.status === 404,
      details: `Status: ${nonTaskComplete.status}, Data: ${JSON.stringify(nonTaskComplete.data)}`
    });

    // Test 1.5: Authentication Edge Cases
    resetDb();
    console.log('\n[1.5] Testing Authentication Edge Cases...');

    const emptyAuth = await request('POST', '/api/auth/login', {});
    const invalidPass = await request('POST', '/api/auth/login', { identifier: 'alex_op', password: 'wrongpassword' });
    const sqlInjAuth = await request('POST', '/api/auth/login', { identifier: "' OR '1'='1", password: "' OR '1'='1" });
    const phoneAuth = await request('POST', '/api/auth/login', { identifier: '9990001111', password: 'pass123' });
    const nonExistentProfile = await request('GET', '/api/auth/me?user_id=NON_EXISTENT_USER');

    results.push({
      test: '1.5a Empty Auth Credentials Rejection',
      passed: emptyAuth.status === 400,
      details: `Status: ${emptyAuth.status}`
    });

    results.push({
      test: '1.5b Invalid Password Rejection',
      passed: invalidPass.status === 401,
      details: `Status: ${invalidPass.status}`
    });

    results.push({
      test: '1.5c SQL Injection Auth Safety',
      passed: sqlInjAuth.status === 401,
      details: `Status: ${sqlInjAuth.status}`
    });

    results.push({
      test: '1.5d Non-Existent Profile Request',
      passed: nonExistentProfile.status === 404,
      details: `Status: ${nonExistentProfile.status}`
    });

  } finally {
    stopServer();
  }

  console.log('\n--- STRESS TASK 1 SUMMARY RESULTS ---');
  results.forEach(r => {
    console.log(`[${r.passed ? 'PASS' : 'FAIL'}] ${r.test}`);
    console.log(`       Details: ${r.details}`);
  });
}

runTests();
