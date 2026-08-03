# Soft Handoff Report — Frontend SPA Authentication & API Handling

## 1. Observation
- **Header Usage**: `src/public/js/services/api.js` lines 5–11 defines `getHeaders(userId = null, customHeaders = {})` which attaches `headers['x-user-id'] = userId;`.
- **API Methods**: All 18 export functions in `src/public/js/services/api.js` accept a `userId` / `currentUserId` parameter defaulting to `null` or `'u_dev'`.
- **Hardcoded `'u_dev'` References**: Found 18 instances across `app.js` (lines 58, 68), `api.js` (lines 41, 47, 58, 75), `challengesView.js` (lines 155, 172), `devDashboardView.js` (lines 122, 123, 183, 197, 217, 233), `tasksView.js` (line 168), and `teamsView.js` (lines 53, 132).
- **Login / Signup Credential Submission**:
  - `src/public/js/views/loginView.js` lines 68–69 & 97–98 calls `loginUser(identifier, password)` and stores `localStorage.setItem('forge_user_session', JSON.stringify(res.user));`. The returned `res.token` is ignored.
  - `src/public/js/views/signUpView.js` line 122 calls `registerUser(...)` and stores `localStorage.setItem('forge_user_session', JSON.stringify(res.user));`. The returned `res.token` is ignored.
- **Logout Action**: Zero occurrences of `logout` or token wiping mechanisms in `src/public/js/` or `index.html`.

## 2. Logic Chain
1. **Fact**: `api.js` attaches `x-user-id` header to all outgoing HTTP requests using caller-supplied or default `'u_dev'` parameters.
2. **Fact**: Backend authentication refactor (Milestones 1 & 2) eliminates `x-user-id` support on Express API routes and requires `Authorization: Bearer <JWT_TOKEN>`.
3. **Inference**: Keeping `x-user-id` in `api.js` will cause all protected requests to fail with HTTP 401 Unauthorized once M2 is merged.
4. **Fact**: `loginView.js` and `signUpView.js` receive `{ token, user }` from `/api/auth/login` and `/api/auth/signup`, but only save `res.user` to `localStorage`.
5. **Inference**: To authenticate API requests, `api.js` must store `res.token` in `localStorage` (`forge_jwt_token`) and attach `Authorization: Bearer <token>` in `getHeaders()`.
6. **Inference**: `initUserSession()` in `app.js` must validate the saved token against `GET /api/auth/me` instead of falling back to `fetchCurrentUser('u_dev')`.
7. **Inference**: Logout requires clearing both `forge_jwt_token` and `forge_user_session` from `localStorage`, resetting `store.setState({ currentUser: null })`, and updating the sidebar drawer UI.

## 3. Caveats
- Read-only investigation: No source code files in `src/` were modified during this investigation.
- Dependency on Backend M2: Frontend JWT authorization testing relies on Milestone 2 backend implementation (`POST /api/auth/login`, `POST /api/auth/signup`, `POST /api/auth/change-password`, and JWT middleware on `/api/auth/me`).

## 4. Conclusion
The frontend SPA (`src/public/js/`) requires the following structural updates for Milestone 3:
1. Refactor `api.js` to store/retrieve JWT tokens from `localStorage` (`forge_jwt_token`), attach `Authorization: Bearer <token>`, and remove `x-user-id` and all `userId` parameter pass-throughs.
2. Update `loginView.js` and `signUpView.js` to persist `res.token` into `localStorage`.
3. Update `app.js` to validate JWT session via `/api/auth/me` on startup and eliminate all `'u_dev'` fallbacks.
4. Add Logout functionality to `drawer.js` / `index.html` to clear local tokens/session and reset state.
5. Add Password Change UI in `settingsView.js` calling `POST /api/auth/change-password`.

## 5. Verification Method
1. Inspect `src/public/js/services/api.js` after M3 changes: Confirm `x-user-id` is absent and `Authorization: Bearer` is attached.
2. Run `grep_search` across `src/public/js/` for `x-user-id` and `u_dev`: Confirm 0 occurrences remain.
3. Perform browser test / automated endpoint test:
   - Login with valid credentials, inspect `localStorage.getItem('forge_jwt_token')`.
   - Verify protected routes (e.g. `/api/tasks`) receive `Authorization: Bearer <token>` header.
   - Click Logout: Verify `forge_jwt_token` and `forge_user_session` are cleared and state resets to unauthenticated.

## Remaining Work (Soft Handoff)
- Milestone 3 Implementation: Apply recommended code diffs to `src/public/js/services/api.js`, `app.js`, `loginView.js`, `signUpView.js`, `settingsView.js`, `devDashboardView.js`, `drawer.js`, and `index.html`.
- Run frontend/API integration verification once backend M2 JWT endpoints are operational.
