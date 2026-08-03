# Test Suite, Dependencies & Auth Migration Analysis

## Executive Summary
This document provides a comprehensive investigation of the Forge test suite, project dependencies, and project-wide references to the deprecated `x-user-id` header authentication mechanism and plaintext password handling. It outlines a detailed, actionable strategy for refactoring tests to support bcrypt password hashing, JSON Web Token (JWT) session management, and `Authorization: Bearer <token>` headers across all unit and end-to-end (E2E) test cases.

---

## 1. Package Dependencies & Scripts Audit (`package.json`)

### 1.1 Existing Configuration
- **Module Format**: ES Modules (`"type": "module"`).
- **Test Scripts**:
  - Unit / Route Tests: `node --test tests/**/*.test.js` (uses Node.js native test runner).
  - E2E Test Runner: `node tests/e2e/runner.js` (executes 4 tiers of test suites on custom port `3999`).
- **Installed Dependencies**:
  - `better-sqlite3` (`^11.8.1`)
  - `cors` (`^2.8.5`)
  - `dotenv` (`^16.4.7`)
  - `express` (`^4.21.2`)
  - `multer` (`^1.4.5-lts.1`)
  - `supertest` (`^7.0.0` - devDependency)

### 1.2 Missing Required Dependencies
To support JWT authentication and password hashing across server and tests, the following packages must be added to `package.json`:
1. `jsonwebtoken` (e.g. `^9.0.2`): For signing and verifying JWT tokens.
2. `bcryptjs` (e.g. `^2.4.3`): For pure JavaScript bcrypt password hashing without native C++ compilation overhead.

---

## 2. Project-Wide `x-user-id` & Plaintext Password Inventory

### 2.1 `x-user-id` References
- **`src/server/middleware/auth.js`** (Line 6):
  ```js
  const userId = req.headers['x-user-id'] || 'u_dev';
  ```
  *Impact*: Currently falls back to `u_dev` if no header is supplied, allowing unauthenticated API requests to succeed as superadmin `u_dev`.
- **`src/public/js/services/api.js`** (Line 8):
  ```js
  headers['x-user-id'] = userId;
  ```
  *Impact*: Frontend sends user ID in header instead of JWT.
- **`tests/auth.test.js`** (Line 36 & Line 99):
  ```js
  const userId = req.headers['x-user-id'] || req.query.user_id || 'u_dev';
  .set('x-user-id', 'u_dev');
  ```
  *Impact*: Unit test inspects and sends `x-user-id`.

### 2.2 Plaintext Password References
- **`src/server/db/seed.js`** (Line 19): Seeded users inserted with plaintext passwords (`'pass123'`).
- **`src/server/models/User.js`** (Lines 8 & 27):
  ```sql
  WHERE (email = ? OR username = ? OR phone = ?) AND password_hash = ?
  ```
  *Impact*: Direct string comparison of plaintext password against `password_hash` column.
- **`src/server/services/userService.js`** (Lines 44 & 75): Sets `password_hash` to unhashed password string.
- **`tests/e2e/test_helpers.js`** (Lines 35-42): `resetDatabase()` seeds 8 test users with `'pass123'` directly into SQLite.
- **`tests/auth.test.js`** (Lines 16 & 27): Inserts `'pass123'` and checks `password_hash = ?`.
- **`tests/tasks.test.js`** (Line 12): Inserts test operative with `'pass123'`.

---

## 3. Test Suite Inventory & Structure

### 3.1 Unit / Endpoint Integration Tests (`tests/*.test.js`)
Executed via `node --test tests/*.test.js` (14 test cases across 5 suites):

| File | Endpoints Tested | Current Auth Pattern | Refactoring Required |
|------|------------------|----------------------|----------------------|
| `tests/auth.test.js` | `/api/auth/login`, `/api/auth/me`, `/api/auth/signup`, `/api/dev/settings` | Supertest `.set('x-user-id', 'u_dev')`, inline plaintext SQL check | Test JWT generation on login/signup, JWT verification on `/api/auth/me`, test `/api/auth/change-password`, assert 401 when missing/invalid token or using `x-user-id` header |
| `tests/hallOfFame.test.js` | `/api/hall-of-fame`, `/api/hall-of-fame/award` | Public endpoint, no header | Update DB seed/user setup if user references are involved |
| `tests/static.test.js` | `/`, `/css/style.css` | Public static files | No auth refactoring required |
| `tests/tasks.test.js` | `/api/tasks`, `/api/tasks/suggest`, `/api/tasks/:id/upvote` | Body payload `user_id` | Update test user creation with hashed password; update endpoints to accept JWT auth |
| `tests/teams.test.js` | `/api/teams`, `/api/teams/:id/points/override`, `/api/teams/:id/dissolve` | Body payload `user_id` | Update endpoints to accept JWT auth |

### 3.2 End-to-End (E2E) Test Suite (`tests/e2e/`)
Executed via `node tests/e2e/runner.js` (168 assertions across 4 tiers):

| Suite | File | Test Cases | Auth Usage | Refactoring Scope |
|-------|------|------------|------------|-------------------|
| Tier 1 | `tier1_feature_coverage.test.js` | 35 | Login tests (`/api/auth/login`), unauthenticated GET/POST requests | Attach `Authorization: Bearer <token>` header to protected requests |
| Tier 2 | `tier2_boundary_cases.test.js` | 35 | Login edge cases, negative tests | Test 401 Unauthorized for missing JWT, invalid JWT, and deprecated `x-user-id` |
| Tier 3 | `tier3_cross_feature.test.js` | 15 | Login + action workflows | Login to acquire token, pass token in `get`/`post` helpers |
| Tier 4 | `tier4_real_world.test.js` | 8 | Multi-step end-to-end user workflows | Login to acquire tokens for different user roles (`u_dev`, `u_teacher`, `u_l1`, `u_o1`) |

---

## 4. Test Refactoring Design & Implementation Strategy

### 4.1 E2E Helper Enhancements (`tests/e2e/test_helpers.js`)

#### 1. Synchronous Bcrypt Hashing for DB Reset
To prevent asynchronous overhead inside `resetDatabase()`, calculate a pre-computed bcrypt hash for the default password `'pass123'`:
```js
import bcrypt from 'bcryptjs';

// Pre-computed hash for default test password 'pass123'
const TEST_PASSWORD_HASH = bcrypt.hashSync('pass123', 10);
```
In `resetDatabase()`, pass `TEST_PASSWORD_HASH` when inserting seeded users (`u_dev`, `u_teacher`, `u_l1`, `u_l2`, `u_o1`..`u_o4`).

#### 2. Token Management & Authenticated Fetch Helpers
Expand `test_helpers.js` to manage authentication state:
```js
const tokenCache = new Map();

/**
 * Authenticate user and return JWT token
 */
export async function getAuthToken(identifier = 'aaron_dev', password = 'pass123') {
  const cacheKey = `${identifier}:${password}`;
  if (tokenCache.has(cacheKey)) return tokenCache.get(cacheKey);

  const res = await post('/api/auth/login', { identifier, password });
  if (res.status === 200 && res.json && res.json.token) {
    tokenCache.set(cacheKey, res.json.token);
    return res.json.token;
  }
  throw new Error(`Failed to obtain JWT token for ${identifier}`);
}

export function clearTokenCache() {
  tokenCache.clear();
}
```

Update `get()` and `post()` to support headers and optional JWT tokens:
```js
export async function get(endpoint, options = {}) {
  const headers = { ...(options.headers || {}) };
  if (options.token) {
    headers['Authorization'] = `Bearer ${options.token}`;
  }
  const res = await fetch(`${BASE_URL}${endpoint}`, { headers });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch (_) {}
  return { status: res.status, headers: res.headers, text, json };
}

export async function post(endpoint, body = {}, options = {}) {
  const headers = { 
    'Content-Type': 'application/json',
    ...(options.headers || {}) 
  };
  if (options.token) {
    headers['Authorization'] = `Bearer ${options.token}`;
  }
  const res = await fetch(`${BASE_URL}${endpoint}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body)
  });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch (_) {}
  return { status: res.status, headers: res.headers, text, json };
}
```

### 4.2 Unit Test Refactoring (`tests/auth.test.js`)
Update `tests/auth.test.js` to explicitly test JWT issuance and verification:
1. **Login Test**: Assert that `/api/auth/login` returns `{ success: true, token, user }`.
2. **Signup Test**: Assert that `/api/auth/signup` returns `{ success: true, token, user }` and hashes password.
3. **Protected Me Endpoint**: Send `Authorization: Bearer <token>` in supertest request (`.set('Authorization', `Bearer ${token}`)`). Verify status 200 and sanitized user profile.
4. **Password Change Endpoint Test**: Test `POST /api/auth/change-password`:
   - Valid JWT + correct `currentPassword` -> 200 OK & password updated.
   - Valid JWT + wrong `currentPassword` -> 400 Bad Request / 401 Unauthorized.
   - Missing JWT -> 401 Unauthorized.
5. **Security & Removal Verification**:
   - Request protected route without token -> HTTP 401 Unauthorized.
   - Request protected route with `x-user-id: u_dev` header -> HTTP 401 Unauthorized.

### 4.3 E2E Test Suite Migration (`tests/e2e/tier1` to `tier4`)
- For protected endpoints in E2E tests, fetch token via `await getAuthToken('aaron_dev', 'pass123')` and pass `{ token }` option to `get()` / `post()`.
- Add explicit boundary tests in Tier 2 to verify:
  - Missing token -> 401 Unauthorized.
  - Malformed token -> 401 Unauthorized.
  - Legacy `x-user-id` header -> ignored or 401 Unauthorized.

---

## 5. Summary Checklist for Implementation Team

- [ ] Add `jsonwebtoken` and `bcryptjs` to `package.json` dependencies.
- [ ] Refactor `tests/e2e/test_helpers.js`:
  - Hash seed user passwords using `bcrypt.hashSync('pass123', 10)`.
  - Add `getAuthToken()` helper and token caching.
  - Support `options.token` / `options.headers` in `get()` and `post()`.
- [ ] Refactor `tests/auth.test.js`:
  - Assert JWT token in login and signup responses.
  - Use `Authorization: Bearer <token>` header instead of `x-user-id`.
  - Add tests for `POST /api/auth/change-password`.
  - Assert 401 Unauthorized for requests with missing token or `x-user-id` header.
- [ ] Update E2E Tier test files (`tier1` - `tier4`) to include JWT tokens for protected calls.
- [ ] Run full test suites (`node --test tests/*.test.js` and `node tests/e2e/runner.js`) and confirm 100% pass rate.
- [ ] Audit repository with `grep_search`: zero occurrences of `x-user-id` and zero unhashed password checks.
