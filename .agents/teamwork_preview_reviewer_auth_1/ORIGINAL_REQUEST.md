## 2026-08-02T02:19:27Z
You are teamwork_preview_reviewer_auth_1.
Your working directory is: p:\projects\Forge\.agents\teamwork_preview_reviewer_auth_1\
Scope document: p:\projects\Forge\.agents\orchestrator\PROJECT.md
Original request: p:\projects\Forge\.agents\orchestrator\ORIGINAL_REQUEST.md

Task:
1. Create your working directory p:\projects\Forge\.agents\teamwork_preview_reviewer_auth_1 if it doesn't exist.
2. Review backend changes in `src/server/`:
   - Inspect `src/server/middleware/auth.js`, `src/server/routes/authRoutes.js`, `src/server/services/userService.js`, `src/server/models/User.js`, `src/server/db/seed.js`, and `src/server/utils/jwt.js`.
   - Verify code quality, bcrypt salt round setting, JWT secret handling, 401 error response formats, and password change logic.
   - Verify 0 occurrences of `x-user-id` in `src/server/`.
3. Run test suites: `npm test` and `node tests/e2e/runner.js`.
4. Write review report in `review.md` and `handoff.md` in your working directory.
5. Send a message to parent with path to handoff report and verdict (PASS/FAIL).
