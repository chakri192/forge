## 2026-08-02T02:10:32Z
Task — Execute Milestone 3 (Frontend SPA Auth Updates):
1. Create your working directory p:\projects\Forge\.agents\worker_auth_frontend if it doesn't exist.
2. Read the frontend explorer handoff report at `p:\projects\Forge\.agents\teamwork_preview_explorer_auth_2\handoff.md`.
3. Refactor `src/public/js/services/api.js`:
   - Store & retrieve JWT in `localStorage` under `forge_jwt_token`.
   - Attach `Authorization: Bearer <token>` in `getHeaders()`.
   - REMOVE `x-user-id` header assignment entirely from `getHeaders()`.
   - Remove `userId` / `currentUserId` parameters and hardcoded `'u_dev'` defaults from all API methods.
   - Add `changePassword(currentPassword, newPassword)` method (`POST /api/auth/change-password`).
4. Update `loginView.js` and `signUpView.js`:
   - Save `res.token` into `localStorage.setItem('forge_jwt_token', res.token)` on successful login/signup.
5. Update `app.js`:
   - `initUserSession()` validates stored `forge_jwt_token` against `GET /api/auth/me`.
   - Remove all hardcoded `'u_dev'` fallbacks.
6. Add Logout mechanism:
   - Clear `forge_jwt_token` and `forge_user_session` from `localStorage`.
   - Reset state and redirect/render login view.
   - Connect logout button in `drawer.js` / header UI.
7. Add Password Change UI in `settingsView.js` calling `/api/auth/change-password`.
8. Scrub all remaining `x-user-id` and `'u_dev'` references from `src/public/js/`.
9. Write `changes.md` and `handoff.md` in `p:\projects\Forge\.agents\worker_auth_frontend\`.
10. Send a message to parent with summary and path to handoff report.
