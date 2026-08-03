# Handoff Report — challenger_2

## 1. Observation

### Test Execution Commands & Results
- **Empirical Test Harness 1 (Point Distribution Math)**:
  - Command: `node .agents/challenger_2/verify_point_formula.js`
  - Output summary: Raw floating-point calculation $P_{member} = P_{total} \times \frac{W_i}{\sum W}$ is mathematically exact when $\sum W > 0$. However, per-user `Math.round()` in `src/server/index.js:74` causes point conservation discrepancies:
    - 100 PTS split 3 ways equally ($W = [1.0, 1.0, 1.0]$): exact $33.3333$ per member $\rightarrow$ `Math.round` $= 33 \rightarrow$ total sum = 99 PTS (-1 PT loss).
    - 50 PTS split 3 ways equally ($W = [1.0, 1.0, 1.0]$): exact $16.6667$ per member $\rightarrow$ `Math.round` $= 17 \rightarrow$ total sum = 51 PTS (+1 PT inflation).
    - 25 PTS split 7 ways equally ($W = 1.0$ each): exact $3.5714$ per member $\rightarrow$ `Math.round` $= 4 \rightarrow$ total sum = 28 PTS (+3 PTS inflation).
    - $W = [2.0, 1.5, 0.5, 0.0]$ for 100 PTS: exact $[50.0, 37.5, 12.5, 0.0] \rightarrow$ `Math.round` $= [50, 38, 13, 0] \rightarrow$ total sum = 101 PTS (+1 PT inflation).

- **Empirical Test Harness 2 (Hall of Fame Engines)**:
  - Command: `node .agents/challenger_2/verify_hof_engine.js`
  - Output summary: `allTime` and `season1` leaderboards returned by `GET /api/hall-of-fame` (`src/server/index.js:471-484`) are 100% IDENTICAL objects. `getHallOfFameLeaderboard()` (`src/server/index.js:42-88`) contains zero season or date-filtering logic.
  - `DEV_STEALTH` users (`role = 'DEV_STEALTH'`) are properly excluded from leaderboards (`WHERE role != 'DEV_STEALTH'`).
  - Tied ranks sort purely on `b.points - a.points` (`src/server/index.js:87`) without a deterministic secondary sort key (e.g. username or ID).

- **E2E Test Suite Execution Across All 4 Tiers**:
  - `node tests/e2e/runner.js --tier=1`: 56 PASSED, 2 FAILED (Pass Rate: 96.6%).
  - `node tests/e2e/runner.js --tier=2`: 38 PASSED, 3 FAILED (Pass Rate: 92.7%).
  - `node tests/e2e/runner.js --tier=3`: 23 PASSED, 3 FAILED (Pass Rate: 88.5%).
  - `node tests/e2e/runner.js --tier=4`: 22 PASSED, 1 FAILED (Pass Rate: 95.7%).

- **Key Verbatim Errors Observed**:
  1. `SqliteError: no such column: "ACTIVE"` at `src/server/index.js:392:6` (`db.prepare('INSERT INTO teams (id, name, captain_id, task_id, is_active, status) VALUES (?, ?, ?, ?, 1, "ACTIVE")')`).
  2. `SqliteError: FOREIGN KEY constraint failed` at `src/server/index.js:244:85` when upvoting non-existent task ID.
  3. `Assertion Failed: 2-member team should NOT auto-dissolve (Expected: false, Got: true)` in `tests/e2e/tier2_boundary_cases.test.js:145`.
  4. `SqliteError: table tasks has no column named upvotes` at `tests/e2e/test_helpers.js:59:25`.

---

## 2. Logic Chain

1. **Dynamic Point Distribution Math**:
   - The exact formula math $P_{member} = P_{total} \times \frac{W_i}{\sum W}$ is implemented in SQL/JS as `tt.total_points * (tt.custom_point_share / tt.total_team_weight)`.
   - Observation shows raw float sums equal $P_{total}$ exactly for all valid weights.
   - However, rounding is applied per-user at the end: `totalPoints = Math.round(teamPoints + indivPoints)`.
   - Because each user's score is rounded independently, the sum of points awarded to members of a team diverges from $P_{total}$ whenever member fractional shares have non-zero decimal components.

2. **Hall of Fame Season 1 vs All-Time Engine**:
   - Inspection of `src/server/index.js:471-474` reveals:
     `const allTime = getHallOfFameLeaderboard();`
     `const season1 = getHallOfFameLeaderboard();`
   - `getHallOfFameLeaderboard()` queries `tasks WHERE status = 'COMPLETED'` without filtering by `created_at` or `season`.
   - Therefore, `season1` and `allTime` produce identical leaderboard arrays under all conditions. `season1` is an un-implemented stub duplicate.

3. **Adversarial & Test Harness Vulnerabilities**:
   - **Unit Test Mocking Shortcut**: `tests/teams.test.js`, `tests/hallOfFame.test.js`, `tests/tasks.test.js`, and `tests/auth.test.js` instantiate inline Express servers in `before()` and re-define endpoint handlers rather than calling `src/server/index.js`. Consequently, unit tests passed completely despite critical runtime bugs in `src/server/index.js`.
   - **Runner False Pass Masking**: `tests/e2e/runner.js` caught uncaught runner exceptions in a `try...catch` block without registering failures. When `test_helpers.js` crashed on schema mismatch, the runner printed `Total Test Cases Executed: 0, Passed: 0, Failed: 0, ✅ ALL E2E TEST SUITES PASSED 100% CLEANLY!` and exited with status 0.
   - **Unconditional Team Dissolution**: `src/server/index.js:323` contains `if (memberCount >= 4 || true)` and lines 346-351 unconditionally set `is_active = 0` for any assigned team on task completion, violating the 4-member auto-dissolution rule.

---

## 3. Caveats
- No modifications were made to production server code (`src/server/index.js`) in accordance with review-only instructions.
- `tests/e2e/test_helpers.js` and `tests/e2e/runner.js` were updated solely to correct schema column mismatches (`tasks.upvotes`) and unhandled exception reporting so the E2E test suite could execute.
- Performance / stress load testing under thousands of concurrent task completions was out of scope.

---

## 4. Conclusion
- **Dynamic Point Distribution Formula Math**: Raw formula math is accurate, but per-user rounding creates non-conserved point distribution (+3 to -1 point variance per task).
- **Hall of Fame Engines**: `season1` is a stub duplicate of `allTime`. Stealth developer filtering works as intended (`WHERE role != 'DEV_STEALTH'`). Tie-breaking lacks deterministic secondary keys.
- **E2E Test Runner**: All 4 tiers execute with pass rates between 88.5% and 96.6%, surfacing real bugs in team creation SQL syntax, upvote FK constraints, and team auto-dissolution.
- **Adversarial Audit**: Unit tests isolate themselves from actual server code via mock routes, masking backend bugs.

---

## 5. Verification Method

To independently verify these findings, execute the following commands in `p:\projects\Forge`:

1. **Verify Point Distribution Math & Rounding Variance**:
   ```powershell
   node .agents/challenger_2/verify_point_formula.js
   ```
   Inspect console output for scenarios 4, 5, 6, and 8 showing point discrepancy vs $P_{total}$.

2. **Verify Hall of Fame Engine Identity & Stealth Isolation**:
   ```powershell
   node .agents/challenger_2/verify_hof_engine.js
   ```
   Confirm `allTime` and `season1` output arrays are 100% identical and `u_dev` is excluded.

3. **Run All 4 E2E Test Suite Tiers**:
   ```powershell
   node tests/e2e/runner.js --tier=1
   node tests/e2e/runner.js --tier=2
   node tests/e2e/runner.js --tier=3
   node tests/e2e/runner.js --tier=4
   ```
