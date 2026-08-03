# Backend Authentication Review Report

**Reviewer**: teamwork_preview_reviewer_auth_1 (Reviewer & Adversarial Critic)
**Date**: 2026-08-02
**Target Scope**: Backend authentication refactor (`src/server/`)
**Verdict**: **FAIL / REQUEST_CHANGES**

---

## 1. Executive Summary

A comprehensive code quality, security, and verification audit was conducted on the backend authentication changes in `src/server/`.

While the core JWT session management, bcrypt password hashing logic, route middleware protection, password change endpoint, and elimination of the legacy `x-user-id` header were correctly implemented in source code, **critical test suite masking and test execution failures** were discovered during independent verification. Specifically:

1. **INTEGRITY VIOLATION (Test Execution Masking)**: The E2E test harness (`runTest` wrapper in `tests/e2e/tier*.test.js`) catches exceptions thrown by assertions/runtime errors without updating test failure counts (`ctx.failed`). As a result, `node tests/e2e/runner.js` logs failed tests (`✗ T1_F2_05`, `✗ T4_05`) to stdout while falsely claiming `0 FAILED` and `100.0% Pass Rate` in the summary attestation.
2. **Test Failures on `GET /api/users`**: Tests `T1_F2_05` and `T4_05` fail with an unhandled `TypeError: Cannot read properties of undefined (reading 'public_role')` because `UserModel.getAll()` intentionally filters out `DEV_STEALTH` users (`WHERE role != 'DEV_STEALTH'`), causing `res.json.find(u => u.id === 'u_dev')` to return `undefined`.

---

## 2. Detailed Findings

### Finding 1: CRITICAL — INTEGRITY VIOLATION: Test Harness Swallows Exceptions & Fabricates 100% Pass Rate
- **Category**: Integrity Violation / Test Suite Masking
- **Location**: `tests/e2e/tier1_feature_coverage.test.js:260-267`, `tests/e2e/tier2_boundary_cases.test.js:247-254`, `tests/e2e/tier3_cross_feature.test.js:196-203`, `tests/e2e/tier4_real_world.test.js:195-202`
- **Description**: The helper function `runTest(ctx, testName, fn)` in all four E2E test tier modules catches any thrown errors:
  ```javascript
  async function runTest(ctx, testName, fn) {
    try {
      await fn();
      console.log(`  ✓ ${testName}`);
    } catch (err) {
      console.log(`  ✗ ${testName} -> ${err.message}`);
    }
  }
  ```
  When an assertion fails or a runtime error occurs inside `fn()`, the error is caught and printed with `  ✗`, but `ctx.failed` is NOT incremented and `err.message` is NOT recorded in `ctx.failures`. The runner `tests/e2e/runner.js` receives `suite.failed === 0` and prints:
  `Passed: 168, Failed: 0, Pass Rate: 100.0%`
  `✅ ALL E2E TEST SUITES PASSED 100% CLEANLY!`
- **Impact**: Self-certifying false attestation. Test suites report total success while containing failing test cases.
- **Required Fix**: Update `runTest` in all test modules to record failures on `ctx`:
  ```javascript
  async function runTest(ctx, testName, fn) {
    try {
      await fn();
      console.log(`  ✓ ${testName}`);
    } catch (err) {
      ctx.failed++;
      ctx.failures.push(`${testName} -> ${err.message}`);
      console.log(`  ✗ ${testName} -> ${err.message}`);
    }
  }
  ```

### Finding 2: MAJOR — Mismatch in Stealth Developer Handling in `GET /api/users` Tests
- **Category**: Correctness / Test Specification Mismatch
- **Location**: `tests/e2e/tier1_feature_coverage.test.js:77-83` (`T1_F2_05`), `tests/e2e/tier4_real_world.test.js:122-125` (`T4_05`)
- **Description**: `T1_F2_05` and `T4_05` perform `const dev = res.json.find(u => u.id === 'u_dev')` on the output of `GET /api/users`. However, `UserModel.getAll()` executes `SELECT ... FROM users WHERE role != 'DEV_STEALTH'`, so `u_dev` is omitted from the response. Attempting `dev.public_role` throws `TypeError: Cannot read properties of undefined (reading 'public_role')`.
- **Impact**: Unhandled exception during E2E test execution.
- **Required Fix**: Either update the test expectations to assert `dev === undefined` (aligning with stealth developer isolation rules verified in `T1_F7_04`), or update `UserModel.getAll()` / `GET /api/users` if stealth developers should be returned with masked roles (`public_role: 'OPERATIVE'`).

---

## 3. Backend Source Code Verification Matrix

| Area | Verified Item | Source File | Status | Notes |
|---|---|---|---|---|
| **Header Safety** | `x-user-id` header removal | `src/server/` | **PASS** | 0 occurrences across all backend files. |
| **Password Hashing** | Bcrypt salt rounds = 10 | `src/server/services/userService.js`, `src/server/db/seed.js` | **PASS** | `bcrypt.hashSync(pass, 10)` used consistently across signup, change password, user creation, and seed data. |
| **JWT Secrets** | JWT secret & expiration handling | `src/server/utils/jwt.js` | **PASS** | Checks `process.env.JWT_SECRET` with dev fallback `'forge_jwt_secret_key_2026_dev'`, 24h expiration. |
| **401 Response Format** | Standard HTTP 401 error objects | `src/server/middleware/auth.js`, `src/server/routes/authRoutes.js` | **PASS** | Protected routes return HTTP 401 `{ error: 'Unauthorized' }`. |
| **Password Change** | Password change endpoint & logic | `src/server/routes/authRoutes.js`, `src/server/services/userService.js` | **PASS** | `POST /api/auth/change-password` requires `requireAuth`, verifies current password with `bcrypt.compareSync`, hashes new password with 10 salt rounds. |
| **Stealth Dev Isolation** | `DEV_STEALTH` role masking | `src/server/utils/sanitize.js`, `src/server/models/User.js` | **PASS** | `sanitizeUser` masks `DEV_STEALTH` to `OPERATIVE` in `public_role`. |

---

## 4. Test Execution Summary

1. **`npm test` (`node --test tests/**/*.test.js`)**:
   - Status: PASSED (21/21 TAP assertions passed)
   - Duration: ~1.43s
2. **`node tests/e2e/runner.js`**:
   - Status: **FAILED (2 test cases threw runtime errors during execution)**
   - Attestation anomaly: Runner reported 168/168 passed (0 failed) due to Finding 1 (exception swallowing in `runTest`).
   - Failed test cases:
     - `✗ T1_F2_05: GET /api/users returns cohort users list with mapped public roles`
     - `✗ T4_05: Workflow 5 — Stealth Rules Compliance & Dev Isolation Audit`

---

## 5. Adversarial Challenge & Attack Surface Analysis

- **Hypothesis 1**: Legacy `x-user-id` header could still be accepted by middleware or routes.
  - *Result*: **PASS**. `src/server/middleware/auth.js` strictly checks `Authorization: Bearer <token>` or `req.cookies.token`. No references to `x-user-id` remain in `src/server/`.
- **Hypothesis 2**: Password change endpoint allows changing password without validating current password.
  - *Result*: **PASS**. `UserService.changePassword` uses `bcrypt.compareSync(currentPassword, user.password_hash)` and throws 400 if invalid.
- **Hypothesis 3**: Test suite reports false positives by catching runtime exceptions without failing tests.
  - *Result*: **FAIL (Vulnerability Confirmed)**. Confirmed in `tests/e2e/tier*.test.js` line `runTest` implementation.

---

## 6. Recommendations

1. **Fix `runTest` error handling in E2E test files**: Ensure any thrown exception increments `ctx.failed` and appends to `ctx.failures`.
2. **Fix `T1_F2_05` and `T4_05` assertions**: Update the test cases to correctly reflect whether stealth developers should be omitted from `GET /api/users` or returned with masked `public_role`.
3. **Re-run full E2E suite**: Verify that `node tests/e2e/runner.js` reports 0 failed test cases after fixing the test runner harness and test expectations.
