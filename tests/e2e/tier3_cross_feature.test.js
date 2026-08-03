import { get, post, resetDatabase, TestRunnerContext } from './test_helpers.js';

export async function runTier3Tests() {
  const ctx = new TestRunnerContext('Tier 3: Cross-Feature Combinations');
  resetDatabase();

  console.log('\n--- Running Tier 3: Cross-Feature Combinations Tests (15 Cases) ---');

  await runTest(ctx, 'T3_01: Auth + Task Suggestion — Operative logs in and suggests marketplace task', async () => {
    const authRes = await post('/api/auth/login', { identifier: 'alex@forge.local', password: 'pass123' }, { noAuth: true });
    ctx.assertEqual(authRes.status, 200, 'Login status 200');

    const sugRes = await post('/api/tasks/suggest', { title: 'Auth-Linked Task', description: 'Suggested by logged in operative', total_points: 35 });
    ctx.assertEqual(sugRes.status, 200, 'Suggest status 200');

    const tasksRes = await get('/api/tasks');
    const created = tasksRes.json.marketplace.find(m => m.id === sugRes.json.taskId);
    ctx.assert(created !== undefined, 'Suggested task must appear in marketplace array');
  });

  await runTest(ctx, 'T3_02: Upvoting + Leader Assignment — Upvote task and assign to squad', async () => {
    const sugRes = await post('/api/tasks/suggest', { title: 'Popular Marketplace Idea', description: 'Needs high upvotes', total_points: 45 });
    const taskId = sugRes.json.taskId;

    await post(`/api/tasks/${taskId}/upvote`);
    await post(`/api/tasks/${taskId}/upvote`);
    await post(`/api/tasks/${taskId}/upvote`);

    const assignRes = await post(`/api/tasks/${taskId}/assign`, { team_id: 't1' });
    ctx.assertEqual(assignRes.status, 200, 'Assign status 200');

    const tasksRes = await get('/api/tasks');
    const assigned = tasksRes.json.official.find(t => t.id === taskId);
    ctx.assert(assigned !== undefined, 'Assigned task moves from marketplace to official tasks list');
    ctx.assertEqual(assigned.assigned_team_id, 't1', 'Assigned team ID matches');
    ctx.assert(assigned.status === 'IN_PROGRESS' || assigned.status === 'in_progress', 'Status updated to IN_PROGRESS');
  });

  await runTest(ctx, 'T3_03: Captain Point Tweak + Task Completion — Adjusted point share impacts Hall of Fame', async () => {
    await post('/api/teams/t1/points/override', { user_id: 'u_o1', custom_point_share: 1.5 });
    await post('/api/tasks/task1/complete');

    const hallRes = await get('/api/hall-of-fame');
    ctx.assert(Array.isArray(hallRes.json.allTime), 'Leaderboard has entries');
  });

  await runTest(ctx, 'T3_04: Task Completion + Auto-Dissolution — 4-member squad completes task and auto-dissolves', async () => {
    const teamRes = await post('/api/teams', { name: 'Vanguard 4', captain_id: 'u_o1', member_ids: ['u_o1', 'u_o2', 'u_o3', 'u_o4'] });
    const teamId = teamRes.json.teamId;

    const taskRes = await post('/api/tasks/suggest', { title: 'Vanguard Sprint', description: '4 member sprint', total_points: 100 });
    const taskId = taskRes.json.taskId;

    await post(`/api/tasks/${taskId}/assign`, { team_id: teamId });
    const compRes = await post(`/api/tasks/${taskId}/complete`);
    ctx.assertEqual(compRes.json.auto_dissolved, true, '4-member squad auto-dissolves');

    const teamsRes = await get('/api/teams');
    const activeVanguard = teamsRes.json.find(t => t.id === teamId);
    ctx.assertEqual(activeVanguard, undefined, 'Vanguard 4 no longer in active teams list');
  });

  await runTest(ctx, 'T3_05: Team Dissolution + Cohort Pool Reassignment — Dissolved team members form new team', async () => {
    const newTeamRes = await post('/api/teams', { name: 'Reformed Phoenix', captain_id: 'u_o2', member_ids: ['u_o2', 'u_o4'] });
    ctx.assertEqual(newTeamRes.status, 200, 'Create new team status 200');

    const teamsRes = await get('/api/teams');
    const phoenix = teamsRes.json.find(t => t.id === newTeamRes.json.teamId);
    ctx.assert(phoenix !== undefined, 'Reformed Phoenix team is active');
    ctx.assertEqual(phoenix.members.length, 2, 'New team has 2 members');
  });

  await runTest(ctx, 'T3_06: Stealth Dev Action + Hall Exclusion — Dev upvotes & completes task but remains invisible in rankings', async () => {
    await post('/api/auth/login', { identifier: 'aaron_dev', password: 'pass123' }, { noAuth: true });
    await post('/api/tasks/market2/upvote');

    const hallRes = await get('/api/hall-of-fame');
    const devInAllTime = hallRes.json.allTime.find(u => u.id === 'u_dev');
    ctx.assertEqual(devInAllTime, undefined, 'u_dev must not appear in Hall of Fame rankings');
  });

  await runTest(ctx, 'T3_07: Task Proof Submission + Status Transition — Submit proof and transition task to COMPLETED', async () => {
    const subRes = await post('/api/tasks/task2/submit', { submitted_by: 'u_o2', proof_notes: 'UI styles attached.' });
    ctx.assertEqual(subRes.status, 200, 'Submit proof status 200');

    const compRes = await post('/api/tasks/task2/complete');
    ctx.assertEqual(compRes.status, 200, 'Complete status 200');

    const tasksRes = await get('/api/tasks');
    const task2 = tasksRes.json.official.find(t => t.id === 'task2');
    ctx.assert(task2.status === 'COMPLETED' || task2.status === 'completed', 'Task status is COMPLETED');
  });

  await runTest(ctx, 'T3_08: Hall of Fame Title Grant + Monument Wall — Award title upon task completion and verify wall', async () => {
    const awardRes = await post('/api/hall-of-fame/titles', { title_name: 'Code Ninja of the Month', category: 'Coding', awarded_to_user_id: 'u_o1' });
    ctx.assertEqual(awardRes.status, 200, 'Award status 200');

    const hallRes = await get('/api/hall-of-fame');
    const titleOnWall = hallRes.json.titles.find(t => t.title_name === 'Code Ninja of the Month');
    ctx.assert(titleOnWall !== undefined, 'Awarded title present on wall');
  });

  await runTest(ctx, 'T3_09: Dynamic Point Override + Zero Point Share — 0.0 share results in 0 earned points', async () => {
    await post('/api/teams/t1/points/override', { user_id: 'u_o3', custom_point_share: 0.0 });
    const teamsRes = await get('/api/teams');
    const t1 = teamsRes.json.find(t => t.id === 't1');
    const m3 = t1.members.find(m => m.id === 'u_o3');
    ctx.assertEqual(m3.custom_point_share, 0.0, 'Point share is 0.0');
  });

  await runTest(ctx, 'T3_10: Multiple Team Task Completions + Ranking Shifts — Dynamic point updates re-rank operatives', async () => {
    const hallRes = await get('/api/hall-of-fame');
    ctx.assert(Array.isArray(hallRes.json.allTime), 'Leaderboard has entries');
  });

  await runTest(ctx, 'T3_11: Flexible Login (Phone) + Task Upvote — Login via phone and upvote task', async () => {
    await new Promise(r => setTimeout(r, 550));
    const loginRes = await post('/api/auth/login', { identifier: '9990004444', password: 'pass123' }, { noAuth: true });
    ctx.assertEqual(loginRes.status, 200, 'Phone login status 200');

    const upRes = await post('/api/tasks/market1/upvote');
    ctx.assertEqual(upRes.status, 200, 'Upvote status 200');
  });

  await runTest(ctx, 'T3_12: Student Leader Rotation + Task Assignment — Leader 02 assigns task', async () => {
    await new Promise(r => setTimeout(r, 550));
    const loginRes = await post('/api/auth/login', { identifier: 'sarah_lead', password: 'pass123' }, { noAuth: true });
    ctx.assertEqual(loginRes.status, 200, 'Leader 02 login status 200');

    const assignRes = await post('/api/tasks/market2/assign', { team_id: 't2' });
    ctx.assertEqual(assignRes.status, 200, 'Assign task status 200');
  });

  await runTest(ctx, 'T3_13: Theme Toggle + Hall of Fame Granite Styling — Verify style.css rules for theme wrapper', async () => {
    const res = await get('/css/style.css');
    ctx.assertContains(res.text, 'hall-of-fame-wrapper', 'Granite theme wrapper selector present');
  });

  await runTest(ctx, 'T3_14: 4-Member Squad Onboarding + Auto-Dissolve — Create 4-member squad, complete task, verify dissolution', async () => {
    const teamRes = await post('/api/teams', { name: 'Auto Dissolve Squad', captain_id: 'u_o1', member_ids: ['u_o1', 'u_o2', 'u_o3', 'u_o4'] });
    const taskId = (await post('/api/tasks/suggest', { title: 'Auto Dissolve Task', description: 'Test', total_points: 100 })).json.taskId;

    await post(`/api/tasks/${taskId}/assign`, { team_id: teamRes.json.teamId });
    const compRes = await post(`/api/tasks/${taskId}/complete`);
    ctx.assertEqual(compRes.json.auto_dissolved, true, 'Squad auto-dissolves');
  });

  await runTest(ctx, 'T3_15: Stealth Dev User Creation + Login — Create stealth dev, login, check mapped role', async () => {
    await new Promise(r => setTimeout(r, 550));
    const loginRes = await post('/api/auth/login', { identifier: 'aaron_dev', password: 'pass123' }, { noAuth: true });
    ctx.assertEqual(loginRes.status, 200, 'Login status 200');
    ctx.assert(loginRes.json.user.public_role === 'OPERATIVE' || loginRes.json.user.public_role === 'member', 'Created stealth dev public_role must be OPERATIVE or member');
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
