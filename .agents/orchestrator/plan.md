# Plan — Forge JWT & Bcrypt Authentication Refactor

## Executive Roadmap

1. **Phase 1: Exploration & Codebase Audit**
   - Spawn Explorers (`teamwork_preview_explorer`) to inspect current backend authentication (`src/server/routes/auth.js`, `src/server/middleware/auth.js`), database layer (`src/server/db/database.js`), services (`src/server/services/auth.js`), frontend API client (`src/public/js/services/api.js`), and test suite (`tests/`).

2. **Phase 2: Milestone Execution (Implementation Track)**
   - **Milestone 1: Password Hashing & Database Migration (R1)**
     - Integrate `bcrypt` / `bcryptjs` hashing for user passwords.
     - Update password verification and hash generation in `src/server/services/auth.js` and `src/server/db/database.js`.
     - Migrate seed data and database setup script so no plaintext passwords exist in `forge.db` or seed files.
   - **Milestone 2: JWT Authentication, Route Protection & Password Change Endpoint (R2 & R3)**
     - Integrate `jsonwebtoken` for token signing and verification.
     - Issue JWTs on successful `/api/auth/login` and `/api/auth/signup`.
     - Update `src/server/middleware/auth.js` to validate `Authorization: Bearer <token>` or `httpOnly` cookie.
     - Completely eliminate `x-user-id` header authentication from all server routes and middleware.
     - Preserve `DEV_STEALTH` role masking behavior for superadmin capabilities.
     - Implement `POST /api/auth/change-password` requiring JWT authentication and current password verification.
   - **Milestone 3: Frontend SPA Updates (R4)**
     - Update `src/public/js/services/api.js` to store JWT (in localStorage / sessionStorage) and attach `Authorization: Bearer <token>` header to all API calls.
     - Update login, signup, and user session handling UI components.
     - Remove all instances of `x-user-id` header from frontend codebase.
   - **Milestone 4: Test Suite Refactoring & Verification (R4 & Acceptance Criteria)**
     - Refactor test helpers and API call functions in `tests/` to authenticate using JWT tokens.
     - Verify zero remaining `x-user-id` header usage across the entire repo.
     - Verify zero plaintext passwords in database / seed files.

3. **Phase 3: Verification & Forensic Integrity Audit**
   - Spawn 2 Reviewers (`teamwork_preview_reviewer`) to verify code quality and interface compliance.
   - Spawn 2 Challengers (`teamwork_preview_challenger`) to stress-test token expiration, invalid tokens, missing headers, password change edge cases, and `DEV_STEALTH` capabilities.
   - Spawn 1 Forensic Auditor (`teamwork_preview_auditor`) for mandatory integrity verification (static analysis, execution tracing, no dummy/facade implementations).

4. **Phase 4: Final Acceptance & Sentinel Report**
   - Confirm all acceptance criteria pass.
   - Report final completion to parent (Sentinel).
