## 2026-08-02T02:05:52Z
Task — Execute Milestone 1 & Milestone 2 (Backend Auth Security Refactor):
1. Create your working directory p:\projects\Forge\.agents\worker_auth_backend if it doesn't exist.
2. Read the backend explorer handoff report at `p:\projects\Forge\.agents\teamwork_preview_explorer_auth_1\handoff.md`.
3. Add `bcryptjs` and `jsonwebtoken` to `package.json` dependencies and run `npm install`.
4. Create JWT helper in `src/server/utils/jwt.js` (or in auth service) using `JWT_SECRET` (with fallback constant).
5. Update `src/server/db/seed.js` to hash all seed user passwords using `bcrypt.hashSync`.
6. Update `src/server/models/User.js` and `src/server/services/userService.js`:
   - Hash passwords on user creation/signup.
   - Compare password hashes with bcrypt on login.
   - Implement `changePassword` service method.
7. Update `src/server/middleware/auth.js`:
   - Extract JWT from `Authorization: Bearer <token>` or cookies.
   - ELIMINATE `x-user-id` header support entirely.
   - Attach user payload to `req.user` if valid JWT, else `req.user = null`.
   - `requireAuth` middleware must return HTTP 401 Unauthorized if `req.user` is null/invalid.
   - Preserve `DEV_STEALTH` role masking behavior: `req.user.role` remains `'DEV_STEALTH'` internally for authorization checks, while responses use `sanitizeUser(user)` (setting `public_role: 'OPERATIVE'`).
8. Update `src/server/routes/authRoutes.js`:
   - Return `{ success: true, token, user }` on login & signup.
   - Protect `GET /api/auth/me` with `requireAuth` (returns 401 if missing token).
   - Implement `POST /api/auth/change-password` endpoint.
9. Execute database seed (`npm run seed` or `node src/server/db/seed.js`) and test running the server.
10. Write `changes.md` and a handoff report `handoff.md` in `p:\projects\Forge\.agents\worker_auth_backend\`.
11. Send a message to parent with build/test results and path to your handoff report.
