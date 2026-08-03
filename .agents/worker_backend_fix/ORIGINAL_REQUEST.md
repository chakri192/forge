## 2026-08-01T01:12:56Z
You are worker_backend_fix working in p:\projects\Forge\.agents\worker_backend_fix\.
Read challenger_1's report at p:\projects\Forge\.agents\challenger_1\handoff.md.

Fix the following 5 backend bugs in `src/server/index.js`:
1. **SQL double quote bug**: In `POST /api/teams` and `POST /api/teams/create` (around lines 392 & 409), change `"ACTIVE"` to string literal `'ACTIVE'` in SQL insert statements to fix SQLite `no such column: "ACTIVE"` error.
2. **Team auto-dissolution bug**: In task completion / approval handlers (around line 323), change `if (memberCount >= 4 || true)` to `if (memberCount >= 4)` so only 4-member teams auto-dissolve upon task completion (1, 2, and 3 member teams remain active).
3. **Upvote FK crash**: In `POST /api/tasks/:id/upvote` and `DELETE /api/tasks/:id/upvote`, add `try...catch` blocks and check if task and user exist. Return HTTP 404/400 instead of uncaught 500 SQLite foreign key crash.
4. **Point override validation bug**: In `POST /api/teams/:id/points/override` and `POST /api/teams/redistribute-points`, fix validation to check `typeof custom_point_share !== 'number' || isNaN(custom_point_share) || custom_point_share < 0 || !isFinite(custom_point_share)`.
5. **Stealth role leak bug**: In `GET /api/users` and `GET /api/teams`, ensure `role` is masked so `DEV_STEALTH` accounts return `role: 'OPERATIVE'` and `public_role: 'OPERATIVE'` in public API responses.

Verification:
Run `npm test` and `node tests/e2e/runner.js`.

MANDATORY INTEGRITY WARNING: DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task.

Write handoff report to p:\projects\Forge\.agents\worker_backend_fix\handoff.md and report back to parent.
