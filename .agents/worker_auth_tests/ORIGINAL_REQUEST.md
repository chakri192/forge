## 2026-08-02T02:15:11Z

Task — Execute Milestone 4 (Test Suite Refactoring & Verification):
1. Create your working directory p:\projects\Forge\.agents\worker_auth_tests if it doesn't exist.
2. Read the test explorer handoff report at `p:\projects\Forge\.agents\teamwork_preview_explorer_auth_3\handoff.md`.
3. Update `tests/e2e/test_helpers.js`:
   - Seed user passwords with bcrypt hashes (`bcrypt.hashSync('pass123', 10)`).
   - Implement `getAuthToken()` or `loginAndGetToken()` helper.
   - Update request helpers (`get`, `post`, etc.) to attach `Authorization: Bearer <token>`.
4. Update `tests/auth.test.js`:
   - Add tests for JWT token issuance on `/api/auth/login` and `/api/auth/signup`.
   - Add tests for `GET /api/auth/me` with JWT Bearer token vs missing token (401 Unauthorized).
   - Add tests for `POST /api/auth/change-password` endpoint.
   - Assert that sending legacy `x-user-id` header returns 401 Unauthorized.
5. Update E2E tier tests (`tier1`, `tier2`, `tier3`, `tier4`) to authenticate requests using JWT tokens.
6. Verify repo-wide:
   - Run `grep_search` across `src/` and `tests/` for `x-user-id`: confirm 0 matches.
   - Run unit tests (`npm test` / `node --test tests/*.test.js`).
   - Run E2E test runner (`node tests/e2e/runner.js`).
7. Write `changes.md` and `handoff.md` in `p:\projects\Forge\.agents\worker_auth_tests\`.
8. Send a message to parent with test run outputs and path to handoff report.
