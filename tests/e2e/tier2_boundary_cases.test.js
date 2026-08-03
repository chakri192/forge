import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { get, post, resetDatabase, getAuthToken, TestRunnerContext } from './test_helpers.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function runTier2Tests() {
  const ctx = new TestRunnerContext('Tier 2: Boundary & Corner Cases');
  resetDatabase();
  await new Promise(r => setTimeout(r, 2100));

  console.log('\n--- Running Tier 2: Boundary & Corner Cases Tests (35 Cases) ---');

  // --- Feature 1: Tech Stack Boundaries ---
  await runTest(ctx, 'T2_F1_01: Unknown route falls back to index.html with 200 OK', async () => {
    const res = await get('/unknown/page/path');
    ctx.assertEqual(res.status, 200, 'Fallback status 200');
    ctx.assertContains(res.text, '<!DOCTYPE html>', 'Fallback document HTML');
  });

  await runTest(ctx, 'T2_F1_02: Empty request body to login returns 400 Bad Request', async () => {
    const res = await post('/api/auth/login', {}, { noAuth: true });
    ctx.assertEqual(res.status, 400, 'Empty body login should return 400');
  });

  await runTest(ctx, 'T2_F1_03: Requesting CSS static asset returns text/css header', async () => {
    const res = await get('/css/style.css');
    const contentType = res.headers.get('content-type') || '';
    ctx.assertContains(contentType, 'text/css', 'CSS Content-Type header');
  });

  await runTest(ctx, 'T2_F1_04: Requesting non-existent upload file returns 404', async () => {
    const res = await get('/uploads/nonexistent_file_9999.png');
    ctx.assertEqual(res.status, 404, 'Nonexistent upload 404');
  });

  await runTest(ctx, 'T2_F1_05: Verify dark mode attribute selector in style.css', async () => {
    const res = await get('/css/style.css');
    ctx.assertContains(res.text, '[data-theme="dark"]', 'Dark mode attribute selector present');
  });

  // --- Feature 2: Role Boundary Violations ---
  await runTest(ctx, 'T2_F2_01: Login with invalid password returns 401 Unauthorized', async () => {
    await new Promise(r => setTimeout(r, 550));
    const res = await post('/api/auth/login', { identifier: 'alex@forge.local', password: 'wrongpassword' }, { noAuth: true });
    ctx.assertEqual(res.status, 401, 'Wrong password status 401');
  });

  await runTest(ctx, 'T2_F2_02: Login with non-existent email returns 401 Unauthorized', async () => {
    await new Promise(r => setTimeout(r, 550));
    const res = await post('/api/auth/login', { identifier: 'nonexistent@forge.local', password: 'pass123' }, { noAuth: true });
    ctx.assertEqual(res.status, 401, 'Nonexistent user status 401');
  });

  await runTest(ctx, 'T2_F2_03: Login with missing identifier returns 400 Bad Request', async () => {
    await new Promise(r => setTimeout(r, 550));
    const res = await post('/api/auth/login', { password: 'pass123' }, { noAuth: true });
    ctx.assertEqual(res.status, 400, 'Missing identifier 400');
  });

  await runTest(ctx, 'T2_F2_04: Login with missing password returns 400 Bad Request', async () => {
    await new Promise(r => setTimeout(r, 550));
    const res = await post('/api/auth/login', { identifier: 'alex_op' }, { noAuth: true });
    ctx.assertEqual(res.status, 400, 'Missing password 400');
  });

  await runTest(ctx, 'T2_F2_05: Stealth developer public_role remains OPERATIVE/member under repeated logins', async () => {
    // Wait for rate limit window reset if needed
    await new Promise(r => setTimeout(r, 2100));
    const res1 = await post('/api/auth/login', { identifier: 'aaron_dev', password: 'pass123' }, { noAuth: true });
    const res2 = await post('/api/auth/login', { identifier: 'aaron@forge.local', password: 'pass123' }, { noAuth: true });
    ctx.assert(res1.json && res1.json.user && (res1.json.user.public_role === 'OPERATIVE' || res1.json.user.public_role === 'member'), 'First login public role');
    ctx.assert(res2.json && res2.json.user && (res2.json.user.public_role === 'OPERATIVE' || res2.json.user.public_role === 'member'), 'Second login public role');
  });

  // --- Feature 3: Empty & Edge Marketplace Cases ---
  await runTest(ctx, 'T2_F3_01: Task suggestion with missing title returns 400 Bad Request', async () => {
    const res = await post('/api/tasks/suggest', { description: 'Missing title' });
    ctx.assertEqual(res.status, 400, 'Missing title 400');
  });

  await runTest(ctx, 'T2_F3_02: Task suggestion with missing description returns 400 Bad Request', async () => {
    const res = await post('/api/tasks/suggest', { title: 'Missing description' });
    ctx.assertEqual(res.status, 400, 'Missing description 400');
  });

  await runTest(ctx, 'T2_F3_03: Upvote non-existent task ID handles gracefully', async () => {
    const res = await post('/api/tasks/nonexistent_task_999/upvote');
    ctx.assertEqual(res.status, 200, 'Upvote status 200');
    ctx.assertEqual(res.json.upvotes, 0, 'Non-existent task returns 0 upvotes');
  });

  await runTest(ctx, 'T2_F3_04: Multiple upvotes increment sequentially', async () => {
    const res1 = await post('/api/tasks/market1/upvote', {}, { token: getAuthToken('u_o1') });
    const res2 = await post('/api/tasks/market1/upvote', {}, { token: getAuthToken('u_o4') });
    ctx.assertEqual(res2.json.upvotes, res1.json.upvotes + 1, 'Sequential upvotes increment by 1');
  });

  await runTest(ctx, 'T2_F3_05: Suggest marketplace task defaults total_points to 20 if omitted', async () => {
    const res = await post('/api/tasks/suggest', { title: 'Default Points Task', description: 'Testing default points' });
    ctx.assertEqual(res.status, 200, 'Suggest status 200');
    const tasksRes = await get('/api/tasks');
    const created = tasksRes.json.marketplace.find(m => m.id === res.json.taskId);
    ctx.assertEqual(created.total_points, 20, 'Default points should be 20');
  });

  // --- Feature 4: Zero & Edge Point Overrides ---
  await runTest(ctx, 'T2_F4_01: Set custom_point_share to 0.0 (zero points allocation)', async () => {
    const res = await post('/api/teams/t1/points/override', { user_id: 'u_o1', custom_point_share: 0.0 });
    ctx.assertEqual(res.status, 200, 'Zero point share status 200');
    const teamsRes = await get('/api/teams');
    const t1 = teamsRes.json.find(t => t.id === 't1');
    const m1 = t1.members.find(m => m.id === 'u_o1');
    ctx.assertEqual(m1.custom_point_share, 0.0, 'Point share set to 0.0');
  });

  await runTest(ctx, 'T2_F4_02: Negative custom_point_share returns 400 Bad Request', async () => {
    const res = await post('/api/teams/t1/points/override', { user_id: 'u_o1', custom_point_share: -0.5 });
    ctx.assertEqual(res.status, 400, 'Negative point share 400');
  });

  await runTest(ctx, 'T2_F4_03: Set custom_point_share to elevated 2.5 multiplier', async () => {
    const res = await post('/api/teams/t1/points/override', { user_id: 'u_o1', custom_point_share: 2.5 });
    ctx.assertEqual(res.status, 200, 'Elevated share status 200');
    const teamsRes = await get('/api/teams');
    const t1 = teamsRes.json.find(t => t.id === 't1');
    const m1 = t1.members.find(m => m.id === 'u_o1');
    ctx.assertEqual(m1.custom_point_share, 2.5, 'Point share elevated to 2.5');
  });

  await runTest(ctx, 'T2_F4_04: Redistribute point share for non-existent team/user pair handles gracefully', async () => {
    const res = await post('/api/teams/t_nonexistent/points/override', { user_id: 'u_nonexistent', custom_point_share: 1.0 });
    ctx.assert([200, 400, 404].includes(res.status), 'Nonexistent team point override status handle');
  });

  await runTest(ctx, 'T2_F4_05: Missing custom_point_share field returns 400 Bad Request', async () => {
    const res = await post('/api/teams/t1/points/override', { user_id: 'u_o1' });
    ctx.assertEqual(res.status, 400, 'Missing point share 400');
  });

  // --- Feature 5: Team Lifecycle Edge Cases ---
  await runTest(ctx, 'T2_F5_01: Complete task assigned to 2-member team does NOT auto-dissolve team', async () => {
    const taskRes = await post('/api/tasks/suggest', { title: 'Duo Task', description: '2 member task', total_points: 50 });
    const taskId = taskRes.json.taskId;
    await post(`/api/tasks/${taskId}/assign`, { team_id: 't1' });

    const compRes = await post(`/api/tasks/${taskId}/complete`);
    ctx.assertEqual(compRes.status, 200, 'Complete task status 200');
    ctx.assertEqual(compRes.json.auto_dissolved, false, '2-member team should NOT auto-dissolve');

    const teamsRes = await get('/api/teams');
    const t1 = teamsRes.json.find(t => t.id === 't1');
    ctx.assert(t1 !== undefined, '2-member team t1 must remain active');
  });

  await runTest(ctx, 'T2_F5_02: Create team without name returns 400 Bad Request', async () => {
    const res = await post('/api/teams', { captain_id: 'u_o1' });
    ctx.assertEqual(res.status, 400, 'Missing team name 400');
  });

  await runTest(ctx, 'T2_F5_03: Dissolve already dissolved team is idempotent', async () => {
    const teamRes = await post('/api/teams', { name: 'Idempotent Squad', captain_id: 'u_o1' });
    const teamId = teamRes.json.teamId;

    const dis1 = await post(`/api/teams/${teamId}/dissolve`);
    const dis2 = await post(`/api/teams/${teamId}/dissolve`);
    ctx.assertEqual(dis1.status, 200, 'First dissolve 200');
    ctx.assertEqual(dis2.status, 200, 'Second dissolve 200');
  });

  await runTest(ctx, 'T2_F5_04: Complete non-existent task ID returns 404 Not Found', async () => {
    const res = await post('/api/tasks/nonexistent_task_9999/complete');
    ctx.assertEqual(res.status, 404, 'Non-existent task complete 404');
  });

  await runTest(ctx, 'T2_F5_05: Team with exactly 4 members auto-dissolves upon completion', async () => {
    const teamRes = await post('/api/teams', { name: 'Exact 4 Squad', captain_id: 'u_o1', member_ids: ['u_o1', 'u_o2', 'u_o3', 'u_o4'] });
    const teamId = teamRes.json.teamId;

    const taskRes = await post('/api/tasks/suggest', { title: 'Exact 4 Task', description: 'Testing exact 4 members', total_points: 60 });
    const taskId = taskRes.json.taskId;

    await post(`/api/tasks/${taskId}/assign`, { team_id: teamId });
    const compRes = await post(`/api/tasks/${taskId}/complete`);
    ctx.assertEqual(compRes.json.auto_dissolved, true, 'Exactly 4 member team auto-dissolves');
  });

  // --- Feature 6: Hall of Fame Edge Cases ---
  await runTest(ctx, 'T2_F6_01: Award title with missing title_name returns 400 Bad Request', async () => {
    const res = await post('/api/hall-of-fame/titles', { category: 'Design' });
    ctx.assertEqual(res.status, 400, 'Missing title_name 400');
  });

  await runTest(ctx, 'T2_F6_02: Award title defaults category to Academics if omitted', async () => {
    const res = await post('/api/hall-of-fame/titles', { title_name: 'Default Category Title' });
    ctx.assertEqual(res.status, 200, 'Award status 200');
    const hallRes = await get('/api/hall-of-fame');
    const title = hallRes.json.titles.find(t => t.id === res.json.titleId);
    ctx.assertEqual(title.category, 'Academics', 'Default category Academics');
  });

  await runTest(ctx, 'T2_F6_03: Award title with null user and team ID handles gracefully', async () => {
    const res = await post('/api/hall-of-fame/titles', { title_name: 'Community Award' });
    ctx.assertEqual(res.status, 200, 'Status 200');
  });

  await runTest(ctx, 'T2_F6_04: Hall of Fame leaderboards maintain array structure when zero scores completed', async () => {
    const res = await get('/api/hall-of-fame');
    ctx.assert(Array.isArray(res.json.allTime), 'allTime array structure');
    ctx.assert(Array.isArray(res.json.season1), 'season1 array structure');
  });

  await runTest(ctx, 'T2_F6_05: Multiple titles can be awarded to same user', async () => {
    await post('/api/hall-of-fame/titles', { title_name: 'Title 1', awarded_to_user_id: 'u_o2' });
    await post('/api/hall-of-fame/titles', { title_name: 'Title 2', awarded_to_user_id: 'u_o2' });
    const hallRes = await get('/api/hall-of-fame');
    const userTitles = hallRes.json.titles.filter(t => t.awarded_to_user_id === 'u_o2');
    ctx.assert(userTitles.length >= 2, 'User has multiple titles');
  });

  // --- Feature 7: Stealth & UI Edge Cases ---
  await runTest(ctx, 'T2_F7_01: HTML document does not contain legacy Operation Overthink text in comments or body', async () => {
    const res = await get('/index.html');
    ctx.assertNotContains(res.text.toLowerCase(), 'operation overthink', 'No case-insensitive operation overthink');
  });

  await runTest(ctx, 'T2_F7_02: CSS document does not contain legacy Operation Overthink text', async () => {
    const res = await get('/css/style.css');
    ctx.assertNotContains(res.text.toLowerCase(), 'operation overthink', 'No operation overthink in css');
  });

  await runTest(ctx, 'T2_F7_03: JS document does not contain legacy Operation Overthink text', async () => {
    const res = await get('/js/app.js');
    ctx.assertNotContains(res.text.toLowerCase(), 'operation overthink', 'No operation overthink in js');
  });

  await runTest(ctx, 'T2_F7_04: Users endpoint omits password_hash from public payload', async () => {
    const res = await get('/api/users');
    const u1 = res.json[0];
    ctx.assertEqual(u1.password_hash, undefined, 'password_hash must be omitted from public users list');
  });

  await runTest(ctx, 'T2_F7_05: Auth login response omits password_hash from user object', async () => {
    const res = await post('/api/auth/login', { identifier: 'alex@forge.local', password: 'pass123' }, { noAuth: true });
    ctx.assertEqual(res.json.user.password_hash, undefined, 'password_hash must be omitted from auth login user object');
  });

  return ctx;
}

async function runTest(ctx, testName, fn) {
  try {
    await fn();
    console.log(`  ✓ ${testName}`);
  } catch (err) {
    console.log(`  ✗ ${testName} -> ${err.message}`);
  }
}
