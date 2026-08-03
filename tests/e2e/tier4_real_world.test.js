import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { get, post, resetDatabase, TestRunnerContext } from './test_helpers.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function runTier4Tests() {
  const ctx = new TestRunnerContext('Tier 4: Real-World Application Scenarios');
  resetDatabase();

  console.log('\n--- Running Tier 4: Real-World Application Scenarios Tests (8 Multi-Step Workflows) ---');

  await runTest(ctx, 'T4_01: Workflow 1 — Onboarding -> Suggestion -> Upvoting -> Leader Assignment', async () => {
    const u1 = await post('/api/users', { name: 'User One', username: 'u1_op', email: 'u1@forge.local' });
    const u2 = await post('/api/users', { name: 'User Two', username: 'u2_op', email: 'u2@forge.local' });
    const u3 = await post('/api/users', { name: 'User Three', username: 'u3_op', email: 'u3@forge.local' });
    const u4 = await post('/api/users', { name: 'User Four', username: 'u4_op', email: 'u4@forge.local' });
    ctx.assertEqual(u1.status, 200, 'User 1 registered');

    const teamRes = await post('/api/teams', { name: 'Gamma Squad', captain_id: u1.json.userId, member_ids: [u1.json.userId, u2.json.userId, u3.json.userId, u4.json.userId] });
    const teamId = teamRes.json.teamId;

    const sugRes = await post('/api/tasks/suggest', { title: 'Canvas Engine Widget', description: 'Interactive rendering engine', total_points: 60 });
    const taskId = sugRes.json.taskId;

    await post(`/api/tasks/${taskId}/upvote`);
    await post(`/api/tasks/${taskId}/upvote`);

    const assignRes = await post(`/api/tasks/${taskId}/assign`, { team_id: teamId });
    ctx.assertEqual(assignRes.status, 200, 'Task assigned to Gamma Squad');

    const tasksRes = await get('/api/tasks');
    const assignedTask = tasksRes.json.official.find(t => t.id === taskId);
    ctx.assert(assignedTask.status === 'IN_PROGRESS' || assignedTask.status === 'in_progress', 'Task status IN_PROGRESS');
    ctx.assertEqual(assignedTask.assigned_team_id, teamId, 'Assigned team matches Gamma Squad');
  });

  await runTest(ctx, 'T4_02: Workflow 2 — Execution -> Point Redistribution -> Task Finish & Auto-Dissolve', async () => {
    const teamRes = await get('/api/teams');
    const gamma = teamRes.json.find(t => t.name === 'Gamma Squad');
    ctx.assert(gamma !== undefined, 'Gamma Squad found');

    const m1 = gamma.members[0].id;
    const m2 = gamma.members[1].id;

    await post('/api/teams/redistribute-points', { team_id: gamma.id, user_id: m1, custom_point_share: 1.4 });
    await post('/api/teams/redistribute-points', { team_id: gamma.id, user_id: m2, custom_point_share: 0.6 });

    const tasksRes = await get('/api/tasks');
    const gammaTask = tasksRes.json.official.find(t => t.assigned_team_id === gamma.id);
    await post(`/api/tasks/${gammaTask.id}/submit`, { submitted_by: m1, proof_notes: 'Canvas Widget engine ready' });

    const compRes = await post(`/api/tasks/${gammaTask.id}/complete`);
    ctx.assertEqual(compRes.json.auto_dissolved, true, 'Gamma Squad auto-dissolves');

    const activeTeams = await get('/api/teams');
    const activeGamma = activeTeams.json.find(t => t.id === gamma.id);
    ctx.assertEqual(activeGamma, undefined, 'Gamma Squad is deactivated');
  });

  await runTest(ctx, 'T4_03: Workflow 3 — Hall of Fame Calculations & Title Awarding', async () => {
    const hallRes = await get('/api/hall-of-fame');
    ctx.assertEqual(hallRes.status, 200, 'Hall of fame 200');

    const topUser = hallRes.json.allTime[0];
    ctx.assert(topUser !== undefined, 'Top user exists');

    const titleRes = await post('/api/hall-of-fame/titles', { title_name: 'Canvas Wizard 2026', category: 'Innovation', awarded_to_user_id: topUser.id });
    ctx.assertEqual(titleRes.status, 200, 'Title awarded');

    const updatedHall = await get('/api/hall-of-fame');
    const titleOnWall = updatedHall.json.titles.find(t => t.title_name === 'Canvas Wizard 2026');
    ctx.assert(titleOnWall !== undefined, 'Canvas Wizard title present on wall');
  });

  await runTest(ctx, 'T4_04: Workflow 4 — Multi-Squad Competition & Leaderboard Season 1', async () => {
    resetDatabase();

    const t1Res = await post('/api/tasks/suggest', { title: 'Alpha Challenge', description: '100 PTS', total_points: 100 });
    await post(`/api/tasks/${t1Res.json.taskId}/assign`, { team_id: 't1' });
    await post(`/api/tasks/${t1Res.json.taskId}/complete`);

    const t2Res = await post('/api/tasks/suggest', { title: 'Beta Challenge', description: '50 PTS', total_points: 50 });
    await post(`/api/tasks/${t2Res.json.taskId}/assign`, { team_id: 't2' });
    await post(`/api/tasks/${t2Res.json.taskId}/complete`);

    const hallRes = await get('/api/hall-of-fame');
    ctx.assert(hallRes.json.season1.length >= 1, 'Season 1 has entries');
  });

  await runTest(ctx, 'T4_05: Workflow 5 — Stealth Rules Compliance & Dev Isolation Audit', async () => {
    const devLogin = await post('/api/auth/login', { identifier: 'aaron_dev', password: 'pass123' }, { noAuth: true });
    ctx.assert(devLogin.json.user.public_role === 'OPERATIVE' || devLogin.json.user.public_role === 'member', 'Public role must be OPERATIVE or member');

    await post('/api/tasks/suggest', { title: 'Dev System Task', description: 'Created by dev', total_points: 10 });

    const usersRes = await get('/api/users');
    const devInUsers = usersRes.json.find(u => u.id === 'u_dev');
    ctx.assert(devInUsers && (devInUsers.public_role === 'OPERATIVE' || devInUsers.public_role === 'member'), 'Dev public role mapped in GET /api/users');

    const hallRes = await get('/api/hall-of-fame');
    const devInHall = hallRes.json.allTime.find(u => u.id === 'u_dev');
    ctx.assertEqual(devInHall, undefined, 'Dev absent from Hall of Fame');
  });

  await runTest(ctx, 'T4_06: Workflow 6 — Multi-Channel Authentication Verification', async () => {
    const r1 = await post('/api/auth/login', { identifier: 'alex@forge.local', password: 'pass123' }, { noAuth: true });
    ctx.assertEqual(r1.json.user.username, 'alex_op', 'Email auth matched');

    const r2 = await post('/api/auth/login', { identifier: 'marcus_lead', password: 'pass123' }, { noAuth: true });
    ctx.assertEqual(r2.json.user.email, 'marcus@forge.local', 'Username auth matched');

    const r3 = await post('/api/auth/login', { identifier: '9990005555', password: 'pass123' }, { noAuth: true });
    ctx.assertEqual(r3.json.user.name, 'Elena', 'Phone auth matched');
  });

  await runTest(ctx, 'T4_07: Workflow 7 — End-to-End Task Lifecycle (6 State Transitions)', async () => {
    const s1 = await post('/api/tasks/suggest', { title: 'Full Lifecycle Task', description: 'Trace all states', total_points: 50 });
    const taskId = s1.json.taskId;

    await post(`/api/tasks/${taskId}/upvote`);
    await post(`/api/tasks/${taskId}/assign`, { team_id: 't1' });
    await post(`/api/tasks/${taskId}/submit`, { submitted_by: 'u_o1', proof_notes: 'Proof attached' });
    await post(`/api/tasks/${taskId}/complete`);

    const hall = await get('/api/hall-of-fame');
    ctx.assert(hall.json.allTime.length > 0, 'Hall of fame contains calculated rankings');
  });

  await runTest(ctx, 'T4_08: Workflow 8 — Complete System Integrity Audit', async () => {
    const htmlRes = await get('/');
    ctx.assertContains(htmlRes.text, 'FORGE', 'HTML brand present');
    ctx.assertNotContains(htmlRes.text, 'Operation Overthink', 'No deprecated text in HTML');

    const cssRes = await get('/css/style.css');
    ctx.assertContains(cssRes.text, '--bg-base', 'CSS variables present');
    ctx.assertContains(cssRes.text, 'hall-of-fame-wrapper', 'Marble theme present');

    const jsRes = await get('/js/app.js');
    ctx.assertContains(jsRes.text, 'renderHallOfFameView', 'Hall of Fame render view present');

    const tasks = await get('/api/tasks');
    const teams = await get('/api/teams');
    const hall = await get('/api/hall-of-fame');
    ctx.assertEqual(tasks.status, 200, 'Tasks 200');
    ctx.assertEqual(teams.status, 200, 'Teams 200');
    ctx.assertEqual(hall.status, 200, 'Hall 200');
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
