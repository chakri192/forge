# Soft Handoff Report — Test Suite & Project-wide x-user-id Exploration

## 1. Observation

### 1.1 Project Structure & Dependency Setup (`package.json`)
- `package.json` specifies `"type": "module"` with Node.js native test command `"test": "node --test tests/**/*.test.js"`.
- `package.json` contains dependencies: `better-sqlite3`, `cors`, `dotenv`, `express`, `multer`, and devDependency `supertest`.
- `jsonwebtoken` and `bcryptjs` are currently NOT declared in `package.json`.

### 1.2 Inventory of `x-user-id` References
- `src/server/middleware/auth.js:6`:
  ```js
  const userId = req.headers['x-user-id'] || 'u_dev';
  ```
- `src/public/js/services/api.js:8`:
  ```js
  headers['x-user-id'] = userId;
  ```
- `tests/auth.test.js:36`:
  ```js
  const userId = req.headers['x-user-id'] || req.query.user_id || 'u_dev';
  ```
- `tests/auth.test.js:99`:
  ```js
  .set('x-user-id', 'u_dev');
  ```

### 1.3 Inventory of Plaintext Password References
- `src/server/db/seed.js:19`: Seeds users with plaintext passwords (e.g. `'pass123'`).
- `src/server/models/User.js:8`: Direct SQL query `WHERE (email = ? OR username = ? OR phone = ?) AND password_hash = ?`.
- `src/server/services/userService.js:44,75`: Inserts/creates users with unhashed `password_hash`.
- `tests/e2e/test_helpers.js:35-42`: `resetDatabase()` seeds users directly with `'pass123'`.
- `tests/auth.test.js:16,27`: Inline user setup and SQL query with unhashed password string `'pass123'`.
- `tests/tasks.test.js:12`: Inline user setup with unhashed password string `'pass123'`.

### 1.4 Test Suite Execution Results
- `node --test tests/auth.test.js tests/hallOfFame.test.js tests/static.test.js tests/tasks.test.js tests/teams.test.js`:
  - Result: 14/14 tests PASSED (5 suites, 0 failures).
- `node tests/e2e/runner.js`:
  - Result: 168/168 test assertions PASSED across Tiers 1-4 (Tier 1: 63, Tier 2: 46, Tier 3: 33, Tier 4: 26).

---

## 2. Logic Chain

1. **Premise 1**: Moving from `x-user-id` header authentication to JWT token authentication requires protected routes to validate `Authorization: Bearer <token>` and return `401 Unauthorized` when missing or invalid.
2. **Premise 2**: Current tests (both unit and E2E) pass because `src/server/middleware/auth.js` defaults missing `x-user-id` headers to `u_dev` (`DEV_STEALTH` superadmin).
3. **Premise 3**: Once JWT authentication middleware is enforced, unauthenticated requests in existing unit and E2E tests will fail with `401 Unauthorized` unless test helpers log in to acquire a JWT token and include `Authorization: Bearer <token>` on protected endpoints.
4. **Premise 4**: Password hashing with bcrypt will cause direct SQL checks (`password_hash = ?`) and raw string insertions in `resetDatabase()` to fail credential verification unless seed passwords in test setup are hashed with `bcrypt.hashSync('pass123', 10)`.
5. **Conclusion**: Test suite refactoring requires:
   - Adding `jsonwebtoken` and `bcryptjs` to dependencies.
   - Updating `tests/e2e/test_helpers.js` to hash seed passwords and provide `getAuthToken()` and token-aware `get()` / `post()` helpers.
   - Updating `tests/auth.test.js` to test JWT token generation, JWT verification, password change endpoint, and assert 401 Unauthorized for missing tokens / `x-user-id` headers.
   - Updating E2E tier tests to pass JWT tokens for protected route calls.

---

## 3. Caveats

- **Scope Limit**: Read-only exploration. No source or test files were edited.
- **Backend Implementation Dependency**: Test suite refactoring relies on backend M1 (bcrypt hashing) and M2 (JWT middleware & endpoints) implementation details.
- **Inline Express Mocking in Unit Tests**: `tests/auth.test.js`, `tests/tasks.test.js`, and `tests/teams.test.js` recreate inline Express applications in test setup rather than importing `src/server/app.js`. Care must be taken when refactoring unit tests so inline routes reflect the actual JWT middleware behavior of `src/server/`.

---

## 4. Conclusion

The test suite is fully functional with 14 unit test cases and 168 E2E test assertions currently passing under `x-user-id` fallback logic. Refactoring strategy is fully designed and documented in `analysis.md`. Implementing JWT authentication and password hashing will require updating `tests/e2e/test_helpers.js` with pre-computed bcrypt hashes and token helpers, refactoring `tests/auth.test.js` to cover JWT token flow & password change, and eliminating all remaining `x-user-id` and plaintext password checks.

---

## 5. Verification Method

To independently verify findings and baseline test execution:

1. **Run Unit Tests**:
   ```powershell
   node --test tests/auth.test.js tests/hallOfFame.test.js tests/static.test.js tests/tasks.test.js tests/teams.test.js
   ```
   *Expected Output*: 14 passed, 0 failed.

2. **Run E2E Test Suite**:
   ```powershell
   node tests/e2e/runner.js
   ```
   *Expected Output*: 168 passed, 0 failed across Tiers 1-4.

3. **Verify `x-user-id` Locations**:
   Search `src/` and `tests/` for `x-user-id`:
   - `src/server/middleware/auth.js:6`
   - `src/public/js/services/api.js:8`
   - `tests/auth.test.js:36,99`

4. **Verify Analysis Document**:
   Read `p:\projects\Forge\.agents\teamwork_preview_explorer_auth_3\analysis.md`.

---

## 6. Remaining Work (Soft Handoff Next Steps)

- **Next Step 1**: Install `jsonwebtoken` and `bcryptjs` dependencies in `package.json`.
- **Next Step 2**: Implement M1 (Bcrypt Hashing & DB Migration) and M2 (JWT Middleware & Routes).
- **Next Step 3**: Execute test refactoring blueprint outlined in `analysis.md`:
  - Refactor `tests/e2e/test_helpers.js` with `bcrypt.hashSync()` and `getAuthToken()`.
  - Refactor `tests/auth.test.js` to assert JWT token issuance, JWT middleware verification, password change endpoint, and 401 Unauthorized for legacy `x-user-id` header.
  - Update E2E tier tests (`tier1` to `tier4`) to pass JWT authorization tokens.
- **Next Step 4**: Re-run `node --test tests/*.test.js` and `node tests/e2e/runner.js` to verify 100% pass rate.
