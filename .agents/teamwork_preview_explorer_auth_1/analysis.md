# Backend Authentication & Security Hardening Analysis Report

## Executive Summary
This analysis evaluates the backend authentication architecture of the Forge platform, identifying security vulnerabilities in password handling and session management. Currently, passwords are stored in plaintext across seed data, user signup, and database operations, while authentication relies on an insecure `x-user-id` header with a hardcoded fallback (`u_dev`). This report details an actionable strategy to implement `bcryptjs` password hashing, `jsonwebtoken` (JWT) session management, a `POST /api/auth/change-password` endpoint, seed data migration, and full preservation of `DEV_STEALTH` superadmin role masking.

---

## 1. Current State & Dependency Assessment

### 1.1 Dependency Inspection (`package.json`)
- **Observation**: `package.json` lists `better-sqlite3`, `cors`, `dotenv`, `express`, `multer` under `dependencies` and `supertest` under `devDependencies`.
- **Finding**: Neither `bcrypt` / `bcryptjs` nor `jsonwebtoken` are currently listed in `package.json` or installed in `node_modules`.
- **Recommendation**:
  - Install `bcryptjs` (version `^2.4.3` or latest) and `jsonwebtoken` (version `^9.0.2` or latest).
  - `bcryptjs` is preferred over native `bcrypt` because it is pure JavaScript, eliminating native build dependencies (`node-gyp`, C++ compilers) across Windows and multi-platform environments while providing an identical asynchronous and synchronous API.

### 1.2 Database & Seed Data Analysis (`src/server/db/`)
- **Schema (`src/server/db/schema.js`)**:
  - The `users` table already defines a `password_hash TEXT NOT NULL` column (lines 6–17).
  - The `role` column allows values: `'OPERATIVE'`, `'VANGUARD'`, `'STUDENT_LEADER'`, `'TEACHER'`, `'DEV_STEALTH'`.
- **Seed Data (`src/server/db/seed.js`)**:
  - All seed records populate `password_hash` with unhashed plaintext passwords:
    - `'u_dev'`: `'devpass123'` (role: `'DEV_STEALTH'`)
    - `'u_leader1'` & `'u_leader2'`: `'pass123'` (role: `'STUDENT_LEADER'`)
    - `'u_teacher'`: `'adminpass'` (role: `'TEACHER'`)
    - `'u_op1'` through `'u_op4'`: `'pass123'` (role: `'OPERATIVE'`)
- **Dynamic Seed Initialization (`src/server/app.js`)**:
  - `app.js` auto-triggers `seedDatabase()` if the database table count for tasks is 0.

### 1.3 Server Authentication & Models (`src/server/`)
- **User Model (`src/server/models/User.js`)**:
  - `loginUser` prepared query (line 6–9):
    ```sql
    SELECT id, name, username, email, phone, role, tag, bio, skills, github_url, portfolio_url FROM users
    WHERE (email = ? OR username = ? OR phone = ?) AND password_hash = ?
    ```
    Performs direct plaintext string equality between user input and `password_hash`.
  - `create` method (line 38–42): Inserts `password_hash` directly without hashing.
- **User Service (`src/server/services/userService.js`)**:
  - `login(identifier, password)` (lines 6–15): Directly invokes `UserModel.authenticate(identifier, password)`.
  - `signup(...)` (lines 17–51): Passes raw `password` directly as `password_hash` to `UserModel.create()`.
  - `createUser(...)` (lines 58–81): Passes raw `password_hash` or fallback `'pass123'` directly.
- **Auth Middleware (`src/server/middleware/auth.js`)**:
  - `authenticateUser(req, _res, next)` (lines 5–10):
    ```javascript
    const userId = req.headers['x-user-id'] || 'u_dev';
    const user = UserModel.getByIdOrUsername(userId);
    req.user = user || UserModel.getStealthUser() || { id: 'u_dev', role: 'DEV_STEALTH', name: 'Aaron' };
    next();
    ```
    If `x-user-id` header is missing, every incoming request defaults to `u_dev` with `DEV_STEALTH` role!
- **Auth Routes (`src/server/routes/authRoutes.js`)**:
  - `POST /api/auth/login`: Calls `UserService.login(identifier, password)` and returns `{ success: true, user }`. No JWT token issued.
  - `POST /api/auth/signup`: Calls `UserService.signup(req.body)` and returns `{ success: true, user }`. No JWT token issued.
  - `GET /api/auth/me`: Checks `req.user` (populated by `authenticateUser`) and returns `{ user: sanitizeUser(req.user) }`.
  - `POST /api/auth/change-password`: Endpoint is currently missing.

---

## 2. DEV_STEALTH Role Masking Preservation

### 2.1 How `DEV_STEALTH` Superadmin Role Masking Operates
- **Privilege Checking**:
  - `PRIVILEGED_ROLES = ['STUDENT_LEADER', 'TEACHER', 'DEV_STEALTH']`
  - `ADMIN_ROLES = ['TEACHER', 'DEV_STEALTH']`
  - In `src/server/middleware/auth.js`, `requireTeacher` and `requireLeaderOrTeacher` allow users with `DEV_STEALTH` role full access to all administrative and leadership endpoints.
- **Public Masking**:
  - In `src/server/utils/sanitize.js`:
    ```javascript
    export function maskRole(role) {
      return role === 'DEV_STEALTH' ? 'OPERATIVE' : role;
    }
    export function sanitizeUser(u) {
      if (!u) return null;
      const { password_hash, ...rest } = u;
      const publicRole = maskRole(u.role);
      return { ...rest, role: u.role, public_role: publicRole };
    }
    ```
  - In `src/server/models/User.js`:
    - `allUsers` and `usersByRole` queries explicitly exclude `DEV_STEALTH` (`WHERE role != 'DEV_STEALTH'`).
    - `getSystemSettings()` excludes `DEV_STEALTH` users from public community member counts.
    - Owner ID (`u_dev`) cannot be deleted, modified, or assigned custom roles via API routes.

### 2.2 JWT Preservation Strategy for `DEV_STEALTH`
- **Token Payload**:
  - Sign JWT with `{ id: user.id, username: user.username, role: user.role }`.
- **Token Verification (`authenticateUser` Middleware)**:
  - Extract JWT from `Authorization: Bearer <token>` header (or `req.cookies.token`).
  - Decode payload and fetch latest user record from database via `UserModel.getByIdOrUsername(payload.id)`.
  - Attach fresh database user object to `req.user`.
  - Because `req.user.role` is stored as `'DEV_STEALTH'` in SQLite, `req.user.role` remains `'DEV_STEALTH'`.
  - Internal authorization guards (`requireTeacher`, `verifyTeamAccess`) check `req.user.role` against `ADMIN_ROLES` and grant full superadmin rights seamlessly.
  - Public response endpoints continue to route outputs through `sanitizeUser(user)`, exposing `public_role: 'OPERATIVE'` while stripping `password_hash`.

---

## 3. Recommended Implementation Plan

### Step 1: Package Installation & Configuration
Add `bcryptjs` and `jsonwebtoken` to `package.json` dependencies:
```json
"dependencies": {
  "bcryptjs": "^2.4.3",
  "better-sqlite3": "^11.8.1",
  "cors": "^2.8.5",
  "dotenv": "^16.4.7",
  "express": "^4.21.2",
  "jsonwebtoken": "^9.0.2",
  "multer": "^1.4.5-lts.1"
}
```
Define JWT Secret constant (e.g. in `src/server/config/constants.js` or `dotenv`):
```javascript
export const JWT_SECRET = process.env.JWT_SECRET || 'forge_jwt_secret_key_2026_dev';
export const JWT_EXPIRES_IN = '7d';
```

### Step 2: JWT Helper Utilities (`src/server/utils/jwt.js`)
Create a dedicated JWT utility module:
```javascript
import jwt from 'jsonwebtoken';
import { JWT_SECRET, JWT_EXPIRES_IN } from '../config/constants.js';

export function generateToken(user) {
  return jwt.sign(
    { id: user.id, username: user.username, role: user.role },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
}

export function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (err) {
    return null;
  }
}
```

### Step 3: Password Hashing & Auth Refactoring in User Model & Service
1. **`src/server/models/User.js`**:
   - Add query to fetch user by identifier with `password_hash`:
     ```javascript
     findForAuth: db.prepare(`
       SELECT id, name, username, email, phone, password_hash, role, tag, bio, skills, github_url, portfolio_url
       FROM users
       WHERE email = ? OR username = ? OR phone = ?
     `),
     ```
   - Update `authenticate(identifier)` to fetch the user record (including `password_hash`).

2. **`src/server/services/userService.js`**:
   - Update `login(identifier, password)`:
     ```javascript
     async login(identifier, password) {
       if (!identifier || !password) {
         throw { status: 400, message: 'Identifier and password required' };
       }
       const user = UserModel.findForAuth(identifier);
       if (!user) {
         throw { status: 401, message: 'Invalid credentials' };
       }
       const isValid = await bcrypt.compare(password, user.password_hash);
       if (!isValid) {
         throw { status: 401, message: 'Invalid credentials' };
       }
       const token = generateToken(user);
       return { token, user: sanitizeUser(user) };
     }
     ```
   - Update `signup(userData)`:
     ```javascript
     async signup({ name, username, email, password, role, tag }) {
       // validation ...
       const hashedPassword = await bcrypt.hash(password, 10);
       const userId = `u_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
       const safeRole = (role === 'DEV_STEALTH') ? 'OPERATIVE' : (role || 'OPERATIVE');

       UserModel.create({
         id: userId,
         name,
         username,
         email,
         password_hash: hashedPassword,
         role: safeRole,
         tag: tag || 'Operative'
       });

       const newUser = UserModel.getByIdOrUsername(userId);
       const token = generateToken(newUser);
       return { token, user: sanitizeUser(newUser) };
     }
     ```
   - Add `changePassword(userId, currentPassword, newPassword)`:
     ```javascript
     async changePassword(userId, currentPassword, newPassword) {
       if (!currentPassword || !newPassword) {
         throw { status: 400, message: 'Current password and new password are required' };
       }
       if (newPassword.length < 6) {
         throw { status: 400, message: 'New password must be at least 6 characters long' };
       }
       const user = UserModel.findForAuth(userId);
       if (!user) {
         throw { status: 404, message: 'User not found' };
       }
       const isValid = await bcrypt.compare(currentPassword, user.password_hash);
       if (!isValid) {
         throw { status: 400, message: 'Current password is incorrect' };
       }
       const hashedNewPassword = await bcrypt.hash(newPassword, 10);
       UserModel.update(userId, { password_hash: hashedNewPassword });
       return { message: 'Password updated successfully' };
     }
     ```

### Step 4: Refactor Auth Middleware (`src/server/middleware/auth.js`)
Replace `x-user-id` header extraction and `'u_dev'` fallback with JWT Bearer verification:
```javascript
import { verifyToken } from '../utils/jwt.js';

export function authenticateUser(req, _res, next) {
  req.user = null;
  const authHeader = req.headers.authorization;
  let token = null;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7);
  } else if (req.cookies && req.cookies.token) {
    token = req.cookies.token;
  }

  if (token) {
    const decoded = verifyToken(token);
    if (decoded && decoded.id) {
      const user = UserModel.getByIdOrUsername(decoded.id);
      if (user) {
        req.user = user;
      }
    }
  }
  next();
}

export function requireAuth(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  next();
}
```

### Step 5: Express Routes & Endpoints (`src/server/routes/authRoutes.js`)
1. Update `POST /api/auth/login`:
   ```javascript
   router.post('/auth/login', async (req, res, next) => {
     try {
       const { identifier, password } = req.body;
       const result = await UserService.login(identifier, password);
       res.json({ success: true, token: result.token, user: result.user });
     } catch (err) {
       if (err.status) return res.status(err.status).json({ error: err.message });
       next(err);
     }
   });
   ```
2. Update `POST /api/auth/signup`:
   ```javascript
   router.post('/auth/signup', async (req, res, next) => {
     try {
       const result = await UserService.signup(req.body);
       res.json({ success: true, token: result.token, user: result.user });
     } catch (err) {
       if (err.status) return res.status(err.status).json({ error: err.message });
       next(err);
     }
   });
   ```
3. Update `GET /api/auth/me`:
   ```javascript
   router.get('/auth/me', (req, res) => {
     if (!req.user) return res.status(401).json({ error: 'Authentication required' });
     res.json({ user: sanitizeUser(req.user) });
   });
   ```
4. Add `POST /api/auth/change-password`:
   ```javascript
   router.post('/auth/change-password', requireAuth, async (req, res, next) => {
     try {
       const { currentPassword, newPassword } = req.body;
       const result = await UserService.changePassword(req.user.id, currentPassword, newPassword);
       res.json({ success: true, message: result.message });
     } catch (err) {
       if (err.status) return res.status(err.status).json({ error: err.message });
       next(err);
     }
   });
   ```

### Step 6: Seed Data Migration (`src/server/db/seed.js`)
Update `seedDatabase()` in `src/server/db/seed.js` to hash all seed user passwords using `bcrypt.hashSync(password, 10)`:
```javascript
import bcrypt from 'bcryptjs';

const SALT_ROUNDS = 10;
const hashPass = (plain) => bcrypt.hashSync(plain, SALT_ROUNDS);

insertUser.run('u_dev', 'Aaron (Dev)', 'aaron_dev', 'aaron@forge.local', '+1000000000', hashPass('devpass123'), 'DEV_STEALTH', 'System Ops');
insertUser.run('u_leader1', 'Sarah Jenkins', 'sarah_j', 'sarah@forge.local', '+1000000001', hashPass('pass123'), 'STUDENT_LEADER', 'Leader');
insertUser.run('u_leader2', 'David Kim', 'david_k', 'david@forge.local', '+1000000002', hashPass('pass123'), 'STUDENT_LEADER', 'Leader');
insertUser.run('u_teacher', 'Prof. Vance', 'prof_vance', 'vance@forge.local', '+1000000003', hashPass('adminpass'), 'TEACHER', 'Instructor');
insertUser.run('u_op1', 'Alex Rivera', 'alex_r', 'alex@forge.local', '+1000000004', hashPass('pass123'), 'OPERATIVE', 'Code Ninja');
insertUser.run('u_op2', 'Elena Rostova', 'elena_r', 'elena@forge.local', '+1000000005', hashPass('pass123'), 'OPERATIVE', 'UI Craftsman');
insertUser.run('u_op3', 'Marcus Chen', 'marcus_c', 'marcus@forge.local', '+1000000006', hashPass('pass123'), 'OPERATIVE', 'Backend Pro');
insertUser.run('u_op4', 'Chloe Bennet', 'chloe_b', 'chloe@forge.local', '+1000000007', hashPass('pass123'), 'OPERATIVE', 'Data Architect');
```

---

## 4. Verification Matrix

| Component | Target File | Expected Behavior | Verification Method |
|---|---|---|---|
| Dependency | `package.json` | `bcryptjs` and `jsonwebtoken` present | Inspect `package.json` |
| Seed Hashing | `src/server/db/seed.js` | Seed users inserted with valid bcrypt hashes (`$2a$...`) | Inspect SQLite database table `users` after running `npm run seed` |
| Login Token | `src/server/routes/authRoutes.js` | `POST /api/auth/login` returns `{ success: true, token, user }` | Execute supertest POST `/api/auth/login` |
| Signup Token | `src/server/routes/authRoutes.js` | `POST /api/auth/signup` hashes password and returns `{ success: true, token, user }` | Execute supertest POST `/api/auth/signup` |
| Password Change | `src/server/routes/authRoutes.js` | `POST /api/auth/change-password` requires JWT, verifies current password, updates hash | Execute supertest POST `/api/auth/change-password` with valid/invalid passwords |
| Bearer Middleware | `src/server/middleware/auth.js` | Valid Bearer token populates `req.user`; missing/invalid token results in `req.user = null` (401 on protected routes) | Execute requests without token and with invalid token |
| `DEV_STEALTH` Masking | `src/server/utils/sanitize.js` | `u_dev` receives full admin access via `role: 'DEV_STEALTH'` in `req.user`, but `public_role: 'OPERATIVE'` in responses | Verify `requireTeacher` passes for `u_dev` token while response masks role |
| Zero `x-user-id` | `src/server/middleware/auth.js` | `x-user-id` header completely ignored/removed from backend | Search `grep_search` across `src/server` for `x-user-id` (0 matches) |
