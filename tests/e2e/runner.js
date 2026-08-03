import { startServer, stopServer } from '../../src/server/index.js';
import { resetDatabase, TEST_PORT } from './test_helpers.js';
import { runTier1Tests } from './tier1_feature_coverage.test.js';
import { runTier2Tests } from './tier2_boundary_cases.test.js';
import { runTier3Tests } from './tier3_cross_feature.test.js';
import { runTier4Tests } from './tier4_real_world.test.js';

async function runAllE2ETests() {
  console.log('=================================================================');
  console.log('⚡ FORGE PHASE 1 MVP TRANSITION — E2E TEST SUITE RUNNER');
  console.log('=================================================================\n');

  const startTime = Date.now();

  // 1. Launch dynamic test server on port 3999
  console.log(`[INFO] Starting Express test server on http://localhost:${TEST_PORT}...`);
  await startServer(TEST_PORT);

  // 2. Determine target tiers from command line arguments
  const args = process.argv.slice(2);
  let targetTier = null;
  args.forEach(arg => {
    if (arg.startsWith('--tier=')) {
      targetTier = parseInt(arg.split('=')[1], 10);
    }
  });

  const suites = [];

  try {
    if (!targetTier || targetTier === 1) {
      suites.push(await runTier1Tests());
    }
    if (!targetTier || targetTier === 2) {
      suites.push(await runTier2Tests());
    }
    if (!targetTier || targetTier === 3) {
      suites.push(await runTier3Tests());
    }
    if (!targetTier || targetTier === 4) {
      suites.push(await runTier4Tests());
    }
  } catch (err) {
    console.error('[ERROR] Critical test runner exception:', err);
    try { stopServer(); } catch (_) {}
    process.exit(1);
  } finally {
    // 3. Gracefully stop test server
    console.log('\n[INFO] Stopping Express test server...');
    stopServer();
  }

  const durationMs = Date.now() - startTime;

  // 4. Summarize Test Results
  let totalPassed = 0;
  let totalFailed = 0;
  const allFailures = [];

  console.log('\n=================================================================');
  console.log('📊 E2E TEST SUITE EXECUTION SUMMARY');
  console.log('=================================================================');

  suites.forEach(suite => {
    totalPassed += suite.passed;
    totalFailed += suite.failed;
    console.log(`- ${suite.name}: ${suite.passed} PASSED, ${suite.failed} FAILED`);
    if (suite.failures.length > 0) {
      allFailures.push({ name: suite.name, failures: suite.failures });
    }
  });

  const totalTests = totalPassed + totalFailed;
  const passRate = totalTests > 0 ? ((totalPassed / totalTests) * 100).toFixed(1) : 0;

  console.log('-----------------------------------------------------------------');
  console.log(`Total Test Cases Executed: ${totalTests}`);
  console.log(`Passed: ${totalPassed}`);
  console.log(`Failed: ${totalFailed}`);
  console.log(`Pass Rate: ${passRate}%`);
  console.log(`Execution Time: ${(durationMs / 1000).toFixed(2)} seconds`);
  console.log('=================================================================\n');

  if (totalTests > 0 && totalFailed === 0) {
    console.log('✅ ALL E2E TEST SUITES PASSED 100% CLEANLY!');
    process.exit(0);
  } else {
    console.error('❌ E2E TEST SUITE FAILED — Breakdown of failures:');
    allFailures.forEach(f => {
      console.error(`\nSuite: ${f.name}`);
      f.failures.forEach(msg => console.error(`  - ${msg}`));
    });
    process.exit(1);
  }
}

runAllE2ETests();
