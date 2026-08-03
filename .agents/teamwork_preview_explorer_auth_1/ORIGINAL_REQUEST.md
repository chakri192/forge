## 2026-08-02T02:02:17Z
You are teamwork_preview_explorer_auth_1.
Your working directory is: p:\projects\Forge\.agents\teamwork_preview_explorer_auth_1\
Scope document: p:\projects\Forge\.agents\orchestrator\PROJECT.md
Original request: p:\projects\Forge\.agents\orchestrator\ORIGINAL_REQUEST.md

Task:
1. Create your working directory p:\projects\Forge\.agents\teamwork_preview_explorer_auth_1 if it doesn't exist.
2. Read ORIGINAL_REQUEST.md and PROJECT.md.
3. Investigate the backend authentication, database layer, and services:
   - Examine `src/server/services/auth.js`, `src/server/routes/auth.js`, `src/server/middleware/auth.js`, and `src/server/db/database.js`.
   - Check `package.json` for `bcrypt` / `bcryptjs` and `jsonwebtoken`.
   - Identify where plaintext passwords or `x-user-id` headers are used in server code and seed data initialization.
   - Analyze how `DEV_STEALTH` superadmin role masking works and how it should be preserved with JWT authentication.
   - Plan implementation of password hashing with bcrypt, JWT token generation on login/signup, JWT verification middleware, `POST /api/auth/change-password` endpoint, and migration of seed data.
4. Document all findings and recommended implementation strategy in `analysis.md` and write a soft handoff in `handoff.md` in your working directory.
5. Send a message to parent when done with the path to your handoff report.
