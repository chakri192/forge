# Project: Forge JWT & Bcrypt Authentication Refactor

## Architecture
- **Authentication**: `bcryptjs` password hashing, `jsonwebtoken` (JWT) session management.
- **Backend**: Express.js REST API (`src/server/`).
- **Database**: SQLite (`src/server/db/database.js`).
- **Frontend**: Vanilla JS SPA (`src/public/js/`).

## Milestones

| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| 1 | Password Hashing & DB Migration | Integrate bcrypt password hashing, update auth service, migrate seed data to hashed passwords | None | DONE |
| 2 | JWT Auth & Password Change | Implement JWT issuance on login/signup, JWT middleware, remove `x-user-id`, preserve `DEV_STEALTH`, add `POST /api/auth/change-password` | M1 | DONE |
| 3 | Frontend SPA Updates | Update `api.js` and login UI to store & send JWT, eliminate `x-user-id` in client | M2 | DONE |
| 4 | Test Suite & Verification | Update `tests/` to use JWT tokens, run full test suite, verify zero `x-user-id` & zero plaintext passwords | M3 | IN_PROGRESS |
| 5 | Review, Challenge & Audit | Dual Reviewers, Challengers, and Forensic Auditor verification gate | M4 | PLANNED |

## Interface Contracts

### Authentication Endpoints
- `POST /api/auth/signup` — `{ username, email, password, role }` -> `{ success: true, token, user }`
- `POST /api/auth/login` — `{ identifier, password }` -> `{ success: true, token, user }`
- `POST /api/auth/change-password` — `Authorization: Bearer <token>`, `{ currentPassword, newPassword }` -> `{ success: true, message }`
- `GET /api/auth/me` — `Authorization: Bearer <token>` -> `{ user }`

### Middleware Protection
- Header: `Authorization: Bearer <JWT_TOKEN>` (or `req.cookies.token`).
- Unauthorized request (missing/invalid token) -> HTTP 401 Unauthorized (`{ error: 'Unauthorized' }`).
- `DEV_STEALTH` role masking preserved for superadmin users.

## Code Layout
- `src/server/services/auth.js` / `userService.js` — Password hashing, token generation, user authentication logic.
- `src/server/middleware/auth.js` — JWT verification middleware & `requireAuth` guard.
- `src/server/routes/authRoutes.js` — Login, signup, password change API routes.
- `src/server/db/seed.js` — SQLite database initialization and hashed seed data.
- `src/public/js/services/api.js` — Client API service handling HTTP requests and JWT storage.
- `tests/` — Automated test suite (unit and E2E runner).
