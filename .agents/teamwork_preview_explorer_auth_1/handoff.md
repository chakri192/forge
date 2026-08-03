# Soft Handoff Report — Backend Authentication & Security Hardening (M1 & M2)

## 1. Observation
1. **Dependencies (`package.json`)**:
   `view_file` on `p:\projects\Forge\package.json` reveals:
   ```json
   "dependencies": {
     "better-sqlite3": "^11.8.1",
     "cors": "^2.8.5",
     "dotenv": "^16.4.7",
     "express": "^4.21.2",
     "multer": "^1.4.5-lts.1"
   }
   ```
   Neither `bcrypt` / `bcryptjs` nor `jsonwebtoken` are present in `package.json` or `node_modules`.

2. **Plaintext Passwords in Database & Seed Data**:
   - `src/server/db/seed.js` lines 23–30:
     `insertUser.run('u_dev', ..., 'devpass123', 'DEV_STEALTH', ...);`
     `insertUser.run('u_leader1', ..., 'pass123', 'STUDENT_LEADER', ...);`
     `insertUser.run('u_teacher', ..., 'adminpass', 'TEACHER', ...);`
   - `src/server/models/User.js` lines 6–9:
     `loginUser`: `WHERE (email = ? OR username = ? OR phone = ?) AND password_hash = ?`
   - `src/server/services/userService.js` lines 44 & 75: Raw `password` is saved directly to `password_hash` column on `signup()` and `createUser()`.

3. **Insecure `x-user-id` Header Authentication**:
   - `src/server/middleware/auth.js` line 6:
     `const userId = req.headers['x-user-id'] || 'u_dev';`
   - Unauthenticated requests default to `u_dev` (`DEV_STEALTH` superadmin) when no header is supplied.

4. **`DEV_STEALTH` Superadmin Role Masking**:
   - `src/server/config/constants.js` lines 1–2: `PRIVILEGED_ROLES = ['STUDENT_LEADER', 'TEACHER', 'DEV_STEALTH']`, `ADMIN_ROLES = ['TEACHER', 'DEV_STEALTH']`.
   - `src/server/utils/sanitize.js` lines 2–12: `maskRole(role)` returns `'OPERATIVE'` if `role === 'DEV_STEALTH'`, attached as `public_role` in `sanitizeUser(u)`.

5. **Missing Endpoints**:
   - `POST /api/auth/change-password` endpoint does not exist in `src/server/routes/authRoutes.js`.

---

## 2. Logic Chain
1. **Observation 1** demonstrates that `bcryptjs` and `jsonwebtoken` packages must be added to `package.json` to enable password hashing and JWT token issuance.
2. **Observation 2** shows that user passwords are stored and matched as plaintext strings in both seed initialization and live authentication. Integrating `bcrypt.compare` in `UserService.login` and `bcrypt.hash` in `UserService.signup`, `createUser`, and `seedDatabase` resolves the security flaw.
3. **Observation 3** shows that `authenticateUser` relies on `x-user-id` with a fallback to `u_dev`. Replacing this with JWT decoding (`Authorization: Bearer <token>`) ensures protected routes return 401 Unauthorized unless a valid token signed by `JWT_SECRET` is provided.
4. **Observation 4** indicates that `DEV_STEALTH` authorization depends on `req.user.role` containing `'DEV_STEALTH'`, while public payloads call `sanitizeUser(u)` to set `public_role: 'OPERATIVE'`. Decoding the JWT into `req.user` in `authenticateUser` preserves `req.user.role === 'DEV_STEALTH'` internally, ensuring superadmin capabilities in `requireTeacher` while masking public output.
5. **Observation 5** establishes the necessity of adding `POST /api/auth/change-password` to `authRoutes.js` using a `requireAuth` guard and `UserService.changePassword` logic.

---

## 3. Caveats
- **JWT Expiration & Secret**: Use `JWT_SECRET` from `process.env` with a fallback constant (`forge_jwt_secret_key_2026_dev`).
- **Synchronous vs Asynchronous Hashing in Seeds**: `bcrypt.hashSync(password, 10)` should be used in `seedDatabase()` to ensure synchronous completion during schema initialization and auto-seeding.
- **Role Masking Nuance**: The database `role` column remains `'DEV_STEALTH'`, `req.user.role` remains `'DEV_STEALTH'`, but responses return `public_role: 'OPERATIVE'` via `sanitizeUser()`.

---

## 4. Conclusion
The backend authentication architecture requires three core changes:
1. Dependencies: Add `bcryptjs` and `jsonwebtoken` to `package.json`.
2. Password Hardening: Replace plaintext database comparisons with `bcryptjs` hashing in `seed.js`, `userService.js`, and `UserModel.js`.
3. Session Security: Replace `x-user-id` header logic with JWT Bearer token generation, verification middleware, `POST /api/auth/change-password`, and full `DEV_STEALTH` preservation.

The design strategy is fully documented in `p:\projects\Forge\.agents\teamwork_preview_explorer_auth_1\analysis.md`.

---

## 5. Verification Method
1. **Dependency Verification**:
   Check `package.json` for `"bcryptjs"` and `"jsonwebtoken"`.
2. **Seed Data Verification**:
   Run `npm run seed` and query SQLite database: confirm `users` table `password_hash` column contains bcrypt hashes (`$2a$10$...`).
3. **Authentication Endpoint Verification**:
   - `POST /api/auth/login` with `{ identifier: 'aaron_dev', password: 'devpass123' }` returns `{ success: true, token, user: { role: 'DEV_STEALTH', public_role: 'OPERATIVE' } }`.
   - `GET /api/auth/me` without `Authorization` header returns HTTP 401 Unauthorized.
   - `GET /api/auth/me` with `Authorization: Bearer <token>` returns HTTP 200 `{ user: ... }`.
4. **Password Change Endpoint Verification**:
   - `POST /api/auth/change-password` with valid token and `{ currentPassword: 'devpass123', newPassword: 'newdevpass123' }` returns `{ success: true, message: 'Password updated successfully' }`.
   - Subsequening login with `'devpass123'` fails with 401, while login with `'newdevpass123'` succeeds.

---

## 6. Remaining Work (Concrete Next Steps for Implementer)
1. **Install & Declare Dependencies**:
   Add `bcryptjs` and `jsonwebtoken` to `package.json`.
2. **Create JWT Utility (`src/server/utils/jwt.js`)**:
   Implement `generateToken(user)` and `verifyToken(token)`.
3. **Update Database Seed (`src/server/db/seed.js`)**:
   Hash all seed user passwords with `bcrypt.hashSync`.
4. **Update User Model & Service (`src/server/models/User.js` & `src/server/services/userService.js`)**:
   - Add `findForAuth` query.
   - Implement `bcrypt.compare` in `login()`.
   - Implement `bcrypt.hash` in `signup()` and `createUser()`.
   - Implement `changePassword()` in `UserService`.
5. **Update Auth Middleware (`src/server/middleware/auth.js`)**:
   - Parse `Authorization: Bearer <token>`.
   - Set `req.user = null` if token is missing/invalid.
   - Implement `requireAuth` guard.
6. **Update Auth Routes (`src/server/routes/authRoutes.js`)**:
   - Return `{ success: true, token, user }` on login & signup.
   - Guard `/api/auth/me` with 401 on missing token.
   - Mount `POST /api/auth/change-password`.
