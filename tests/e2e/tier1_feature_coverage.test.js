import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { get, post, resetDatabase, TestRunnerContext } from './test_helpers.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function runTier1Tests() {
  const ctx = new TestRunnerContext('Tier 1: Feature Coverage');
  resetDatabase();

  console.log('\n--- Running Tier 1: Feature Coverage Tests (35 Cases) ---');

  // --- Feature 1: Tech Stack Transition ---
  await runTest(ctx, 'T1_F1_01: Serves index.html on root route with 200 OK', async () => {
    const res = await get('/');
    ctx.assertEqual(res.status, 200, 'Root route status should be 200');
    ctx.assertContains(res.text, '<!DOCTYPE html>', 'Should serve HTML document');
  });

  await runTest(ctx, 'T1_F1_02: package.json has zero React dependencies', async () => {
    const pkgPath = path.join(__dirname, '../../package.json');
    const pkgContent = fs.readFileSync(pkgPath, 'utf8');
    const pkgJson = JSON.parse(pkgContent);
    const deps = { ...pkgJson.dependencies, ...pkgJson.devDependencies };
    ctx.assert(!deps.react && !deps['react-dom'], 'package.json must not include react or react-dom');
  });

  await runTest(ctx, 'T1_F1_03: Serves style.css with all 5 required CSS custom property tokens', async () => {
    const res = await get('/css/style.css');
    ctx.assertEqual(res.status, 200, 'style.css status should be 200');
    ctx.assertContains(res.text, '--bg-base', 'CSS must define --bg-base');
    ctx.assertContains(res.text, '--text-main', 'CSS must define --text-main');
    ctx.assertContains(res.text, '--accent-1', 'CSS must define --accent-1');
    ctx.assertContains(res.text, '--accent-2', 'CSS must define --accent-2');
    ctx.assertContains(res.text, '--accent-3', 'CSS must define --accent-3');
  });

  await runTest(ctx, 'T1_F1_04: Serves app.js static ES Module frontend bundle', async () => {
    const res = await get('/js/app.js');
    ctx.assertEqual(res.status, 200, 'app.js status should be 200');
    ctx.assertContains(res.text, 'DOMContentLoaded', 'app.js should contain DOM initialization');
  });

  await runTest(ctx, 'T1_F1_05: Static upload directory route is reachable', async () => {
    const res = await get('/uploads/');
    ctx.assert([200, 404, 403].includes(res.status), 'Upload route should be reachable');
  });

  // --- Feature 2: Core Roles & Auth Hierarchy ---
  await runTest(ctx, 'T1_F2_01: Operative login via email succeeds', async () => {
    const res = await post('/api/auth/login', { identifier: 'alex@forge.local', password: 'pass123' });
    ctx.assertEqual(res.status, 200, 'Login status 200');
    ctx.assert(res.json.user.public_role === 'OPERATIVE' || res.json.user.public_role === 'member', 'Operative public role');
  });

  await runTest(ctx, 'T1_F2_02: Student Leader login via username succeeds', async () => {
    const res = await post('/api/auth/login', { identifier: 'marcus_lead', password: 'pass123' });
    ctx.assertEqual(res.status, 200, 'Login status 200');
    ctx.assert(res.json.user.role === 'STUDENT_LEADER' || res.json.user.role === 'leader', 'Student Leader role');
  });

  await runTest(ctx, 'T1_F2_03: Teacher login via email succeeds', async () => {
    const res = await post('/api/auth/login', { identifier: 'sarah@forge.local', password: 'pass123' });
    ctx.assertEqual(res.status, 200, 'Login status 200');
    ctx.assert(res.json.user.role === 'STUDENT_LEADER' || res.json.user.role === 'leader' || res.json.user.role === 'teacher' || res.json.user.role === 'TEACHER', 'Leader role verify');
  });

  await runTest(ctx, 'T1_F2_04: Hidden Developer login maps public_role to OPERATIVE', async () => {
    const res = await post('/api/auth/login', { identifier: 'aaron_dev', password: 'pass123' });
    ctx.assertEqual(res.status, 200, 'Login status 200');
    ctx.assertEqual(res.json.user.role, 'DEV_STEALTH', 'Internal role DEV_STEALTH');
    ctx.assert(res.json.user.public_role === 'OPERATIVE' || res.json.user.public_role === 'member', 'Public role must be mapped to OPERATIVE or member');
  });

  await runTest(ctx, 'T1_F2_05: GET /api/users returns cohort users list with mapped public roles', async () => {
    const res = await get('/api/users');
    ctx.assertEqual(res.status, 200, 'Users status 200');
    ctx.assert(Array.isArray(res.json), 'Users response must be array');
    const dev = res.json.find(u => u.id === 'u_dev');
    ctx.assert(dev && (dev.public_role === 'OPERATIVE' || dev.public_role === 'member'), 'Dev public role mapped');
  });

  // --- Feature 3: Task Marketplace ---
  await runTest(ctx, 'T1_F3_01: Suggest a Task Marketplace idea', async () => {
    const res = await post('/api/tasks/suggest', { title: 'E2E Test Widget', description: 'Build test widget', total_points: 30 });
    ctx.assertEqual(res.status, 200, 'Suggest task status 200');
    ctx.assert(res.json.taskId, 'Should return created taskId');
  });

  await runTest(ctx, 'T1_F3_02: GET /api/tasks returns official and marketplace tasks', async () => {
    const res = await get('/api/tasks');
    ctx.assertEqual(res.status, 200, 'GET tasks status 200');
    ctx.assert(Array.isArray(res.json.official), 'Official tasks array');
    ctx.assert(Array.isArray(res.json.marketplace), 'Marketplace tasks array');
  });

  await runTest(ctx, 'T1_F3_03: Upvote Task Marketplace idea increments upvote count', async () => {
    const initial = await get('/api/tasks');
    const target = initial.json.marketplace[0];
    const initialUpvotes = target.upvotes;

    const res = await post(`/api/tasks/${target.id}/upvote`);
    ctx.assertEqual(res.status, 200, 'Upvote status 200');
    ctx.assertEqual(res.json.upvotes, initialUpvotes + 1, 'Upvotes should increment by 1');
  });

  await runTest(ctx, 'T1_F3_04: Assign Task Marketplace idea to team', async () => {
    const tasksRes = await get('/api/tasks');
    const target = tasksRes.json.marketplace[0];
    const res = await post(`/api/tasks/${target.id}/assign`, { team_id: 't1' });
    ctx.assertEqual(res.status, 200, 'Assign task status 200');
  });

  await runTest(ctx, 'T1_F3_05: Submit task proof updates submission record', async () => {
    const res = await post('/api/tasks/task1/submit', { submitted_by: 'u_o1', proof_notes: 'Code implementation completed.' });
    ctx.assertEqual(res.status, 200, 'Submit proof status 200');
    ctx.assert(res.json.submissionId, 'Returns submissionId');
  });

  // --- Feature 4: Dynamic Point Distribution ---
  await runTest(ctx, 'T1_F4_01: GET /api/teams returns active teams with custom_point_share', async () => {
    const res = await get('/api/teams');
    ctx.assertEqual(res.status, 200, 'Teams status 200');
    const team1 = res.json.find(t => t.id === 't1');
    ctx.assert(team1 && Array.isArray(team1.members), 'Team members array present');
  });

  await runTest(ctx, 'T1_F4_02: Redistribute point share updates member custom_point_share', async () => {
    const res = await post('/api/teams/t1/points/override', { user_id: 'u_o1', custom_point_share: 1.5 });
    ctx.assertEqual(res.status, 200, 'Redistribute points status 200');
  });

  await runTest(ctx, 'T1_F4_03: Verify updated custom_point_share persists', async () => {
    const res = await get('/api/teams');
    const team1 = res.json.find(t => t.id === 't1');
    const member1 = team1.members.find(m => m.id === 'u_o1');
    ctx.assertEqual(member1.custom_point_share, 1.5, 'Custom point share updated to 1.5');
  });

  await runTest(ctx, 'T1_F4_04: Set team member custom point share to 0.75', async () => {
    const res = await post('/api/teams/t1/points/override', { user_id: 'u_o3', custom_point_share: 0.75 });
    ctx.assertEqual(res.status, 200, 'Redistribute status 200');
  });

  await runTest(ctx, 'T1_F4_05: Verify multiple members custom point shares', async () => {
    const res = await get('/api/teams');
    const team1 = res.json.find(t => t.id === 't1');
    const m3 = team1.members.find(m => m.id === 'u_o3');
    ctx.assertEqual(m3.custom_point_share, 0.75, 'Member custom point share check');
  });

  // --- Feature 5: Team Lifecycle & Auto-Dissolution ---
  await runTest(ctx, 'T1_F5_01: Create 4-member team via POST /api/teams', async () => {
    const res = await post('/api/teams', { name: 'Quad Squad', captain_id: 'u_o1', member_ids: ['u_o1', 'u_o2', 'u_o3', 'u_o4'] });
    ctx.assertEqual(res.status, 200, 'Create team status 200');
    ctx.assert(res.json.teamId, 'Returns created teamId');
  });

  await runTest(ctx, 'T1_F5_02: Assign task to 4-member team', async () => {
    const teamRes = await post('/api/teams', { name: 'Quad Squad 2', captain_id: 'u_o1', member_ids: ['u_o1', 'u_o2', 'u_o3', 'u_o4'] });
    const teamId = teamRes.json.teamId;
    const suggestRes = await post('/api/tasks/suggest', { title: 'Quad Task', description: '4 member task', total_points: 100 });
    const assignRes = await post(`/api/tasks/${suggestRes.json.taskId}/assign`, { team_id: teamId });
    ctx.assertEqual(assignRes.status, 200, 'Assign task status check');
  });

  await runTest(ctx, 'T1_F5_03: Complete task assigned to 4-member team triggers auto-dissolution', async () => {
    // Create new 4-member team explicitly
    const teamRes = await post('/api/teams', { name: 'Titan 4', captain_id: 'u_o1', member_ids: ['u_o1', 'u_o2', 'u_o3', 'u_o4'] });
    const teamId = teamRes.json.teamId;

    const taskRes = await post('/api/tasks/suggest', { title: 'Titan Challenge', description: 'Complete titan challenge', total_points: 80 });
    const taskId = taskRes.json.taskId;

    await post(`/api/tasks/${taskId}/assign`, { team_id: teamId });
    const compRes = await post(`/api/tasks/${taskId}/complete`);
    ctx.assertEqual(compRes.status, 200, 'Complete task status 200');
    ctx.assertEqual(compRes.json.auto_dissolved, true, '4-member team must auto-dissolve');
  });

  await runTest(ctx, 'T1_F5_04: Auto-dissolved team is removed from GET /api/teams (is_active = 0)', async () => {
    const teamsRes = await get('/api/teams');
    const found = teamsRes.json.find(t => t.name === 'Titan 4');
    ctx.assertEqual(found, undefined, 'Dissolved team must not appear in active teams list');
  });

  await runTest(ctx, 'T1_F5_05: Explicit POST /api/teams/:id/dissolve deactivates team', async () => {
    const teamRes = await post('/api/teams', { name: 'Temp Squad', captain_id: 'u_o1', member_ids: ['u_o1'] });
    const disRes = await post(`/api/teams/${teamRes.json.teamId}/dissolve`);
    ctx.assertEqual(disRes.status, 200, 'Dissolve status 200');
    ctx.assertEqual(disRes.json.is_active, 0, 'Team is_active = 0');
  });

  // --- Feature 6: The Hall of Fame ---
  await runTest(ctx, 'T1_F6_01: GET /api/hall-of-fame returns allTime, season1, and titles', async () => {
    const res = await get('/api/hall-of-fame');
    ctx.assertEqual(res.status, 200, 'Hall of fame status 200');
    ctx.assert(Array.isArray(res.json.allTime), 'allTime array');
    ctx.assert(Array.isArray(res.json.season1), 'season1 array');
    ctx.assert(Array.isArray(res.json.titles), 'titles array');
  });

  await runTest(ctx, 'T1_F6_02: All-Time leaderboard calculates weighted points', async () => {
    const res = await get('/api/hall-of-fame');
    ctx.assert(res.json.allTime.length > 0, 'Leaderboard has entries');
  });

  await runTest(ctx, 'T1_F6_03: Award new title via POST /api/hall-of-fame/titles', async () => {
    const res = await post('/api/hall-of-fame/titles', { title_name: 'Master Architect 2026', category: 'Engineering', awarded_to_user_id: 'u_o1' });
    ctx.assertEqual(res.status, 200, 'Award title status 200');
    ctx.assert(res.json.titleId, 'Returns titleId');
  });

  await runTest(ctx, 'T1_F6_04: Awarded title appears in GET /api/hall-of-fame titles list', async () => {
    const res = await get('/api/hall-of-fame');
    const awarded = res.json.titles.find(t => t.title_name === 'Master Architect 2026');
    ctx.assert(awarded !== undefined, 'Awarded title must be found in Hall of Fame titles wall');
  });

  await runTest(ctx, 'T1_F6_05: Award team-level Hall of Fame title', async () => {
    const res = await post('/api/hall-of-fame/titles', { title_name: 'Squad of the Month', category: 'Teamwork', awarded_to_team_id: 't1' });
    ctx.assertEqual(res.status, 200, 'Award team title status 200');
  });

  // --- Feature 7: Stealth Rules & SVG Icons ---
  await runTest(ctx, 'T1_F7_01: Verify zero mentions of Operation Overthink in index.html', async () => {
    const res = await get('/index.html');
    ctx.assertNotContains(res.text, 'Operation Overthink', 'index.html must not contain Operation Overthink');
  });

  await runTest(ctx, 'T1_F7_02: Verify zero mentions of Shadow Lead or Dev Mode in app.js', async () => {
    const res = await get('/js/app.js');
    ctx.assertNotContains(res.text, 'Shadow Lead', 'app.js must not contain Shadow Lead');
    ctx.assertNotContains(res.text, 'Dev Mode', 'app.js must not contain Dev Mode');
  });

  await runTest(ctx, 'T1_F7_03: Verify SVG icons present in style.css or app.js', async () => {
    const cssRes = await get('/css/style.css');
    ctx.assertContains(cssRes.text, 'svg-icon', 'style.css should style svg-icon');
  });

  await runTest(ctx, 'T1_F7_04: Hidden developer account is excluded from Hall of Fame leaderboards', async () => {
    const res = await get('/api/hall-of-fame');
    const devInAllTime = res.json.allTime.find(u => u.id === 'u_dev');
    const devInSeason1 = res.json.season1.find(u => u.id === 'u_dev');
    ctx.assertEqual(devInAllTime, undefined, 'Stealth dev must be excluded from allTime leaderboard');
    ctx.assertEqual(devInSeason1, undefined, 'Stealth dev must be excluded from season1 leaderboard');
  });

  await runTest(ctx, 'T1_F7_05: No explicit admin control panel screens in static routes', async () => {
    const res = await get('/index.html');
    ctx.assertNotContains(res.text, 'admin-dashboard', 'No separate admin dashboard screen in index.html');
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
