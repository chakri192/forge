# Changes Document — Backend Auth Security Refactor (Milestones 1 & 2)

## Overview
Implemented complete password hashing with `bcryptjs` and session management with JWT (`jsonwebtoken`). Fully eliminated insecure `x-user-id` header authentication while preserving internal `DEV_STEALTH` role authorization and public role masking (`public_role: 'OPERATIVE'`).

---

## Files Modified & Created

### 1. `package.json`
- Added `"bcryptjs": "^3.0.3"` and `"jsonwebtoken": "^9.0.3"` to `dependencies`.

### 2. `src/server/utils/jwt.js` (NEW)
- Created JWT utility module.
- Functions: `generateToken(user)` (signs payload `{ id, username, role }` with `JWT_SECRET` fallback `forge_jwt_secret_key_2026_dev` for 24h) and `verifyToken(token)`.

### 3. `src/server/db/seed.js`
- Imported `bcryptjs`.
- Updated user insert statements to hash passwords with `bcrypt.hashSync(password, 10)` during database initialization.

### 4. `src/server/models/User.js`
- Replaced plaintext SQL authentication query (`loginUser`) with `findForAuth` prepared statement:
  `SELECT id, name, username, email, phone, password_hash, role, tag, bio, skills, github_url, portfolio_url FROM users WHERE id = ? OR email = ? OR username = ? OR phone = ?`.
- Added `getForAuth(identifier)` method.

### 5. `src/server/services/userService.js`
- Imported `bcryptjs`.
- Updated `login(identifier, password)`: retrieves user via `getForAuth` and compares password with `bcrypt.compareSync(password, user.password_hash)`.
- Updated `signup` and `createUser`: hashes plaintext passwords with `bcrypt.hashSync` before passing to database model.
- Added `changePassword(userId, currentPassword, newPassword)`: verifies `currentPassword` with `bcrypt.compareSync`, hashes `newPassword`, and updates DB record via `UserModel.update`.

### 6. `src/server/middleware/auth.js`
- Updated `authenticateUser`: extracts JWT from `Authorization: Bearer <token>` or `req.cookies.token`.
- Eliminated `x-user-id` header fallback completely.
- Decodes token and sets `req.user` to DB user record if valid, or `null` if invalid/missing.
- Added `requireAuth` middleware returning HTTP 401 Unauthorized (`{ error: 'Unauthorized' }`) if `req.user` is null.
- Preserved `DEV_STEALTH` internal role handling (`req.user.role` is `'DEV_STEALTH'`).

### 7. `src/server/routes/authRoutes.js`
- Updated `POST /api/auth/login` and `POST /api/auth/signup` to return `{ success: true, token, user }`.
- Protected `GET /api/auth/me` with `requireAuth` middleware (returns 401 if unauthenticated).
- Added `POST /api/auth/change-password` endpoint protected by `requireAuth`.

### 8. `src/server/routes/taskRoutes.js` & `src/server/routes/userRoutes.js`
- Added defensive check for `req.user` to avoid null reference exceptions when handling unauthenticated requests.

### 9. `tests/auth.test.js`
- Updated test suite to import actual backend Express `app`.
- Added tests for bcrypt authentication, JWT generation, 401 missing token, and password change endpoint.

---

## Verification
- Seed script executed cleanly (`node src/server/db/seed.js`). All seed users now have `$2b$10$...` hashed passwords.
- Test suite executed (`npm test`) with 20/20 passing tests across all test suites.
