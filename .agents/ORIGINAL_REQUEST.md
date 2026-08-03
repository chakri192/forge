# Original User Request

## Initial Request — 2026-08-01T01:02:29+05:30

# Teamwork Project Prompt — Forge Phase 1 MVP Transition

Build the Forge web platform using Vanilla HTML, CSS, and JavaScript with Node.js/Express and SQLite.

Working directory: p:\projects\Forge

## Requirements

### R1. Technology Stack Transition (React -> Vanilla HTML/JS/CSS)
- Convert frontend from React components to standard Vanilla HTML5, CSS3, and ES Module JavaScript.
- Maintain Express REST backend with SQLite persistence.
- Implement CSS Custom Properties using abstract token names (--bg-base, --text-main, --accent-1, --accent-2, --accent-3) supporting dynamic light/dark mode accent customization.

### R2. Core Feature & Role Hierarchy Overhaul
- Role Hierarchy: Operative (Student), Team Captain, Student Leader (2 rotated monthly), Teacher (Admin), and Hidden Developer (hardcoded to developer account, completely invisible on UI, performing actions as system-level operations).
- Tasks & Marketplace: Rename 'Activities' to 'Tasks'. Allow Operatives to suggest tasks in a Task Marketplace with upvoting. Student Leaders assign top-voted tasks to teams or individuals.
- Dynamic Point Distribution: Team Captains and Student Leaders can adjust point distribution per team member if work contribution was unequal.
- Team Lifecycle: 4-member teams auto-dissolve back into the general cohort pool upon task completion/deadline.
- The Hall of Fame: Replace simple leaderboard with an interactive marble/granite themed Hall of Fame, displaying All-Time rankings, Season 1 rankings, and awarded titles (e.g. Best Developer, Coding Champion).

### R3. UI Cleanliness & Stealth Rules
- Remove all visible mentions of 'Operation Overthink' and 'Shadow Lead / Dev Mode' from the user interface.
- Replace all emoji icons with clean, minimalist SVGs.
- Enforce strict role-based access without explicit admin control panel screens (admin actions performed inline on task/team pages).

## Acceptance Criteria

### Verification & Quality Bar
- [ ] Frontend builds cleanly with zero React dependencies in package.json.
- [ ] SQLite database schema supports Task Marketplace upvotes, dynamic point overrides, team captain assignments, and Hall of Fame titles.
- [ ] Express server exposes REST endpoints for all MVP features.
- [ ] No visible 'Operation Overthink' text or emoji icons present on the UI.
- [ ] 
## Follow-up — 2026-08-01T20:31:00Z

Replace the insecure `x-user-id` header authentication mechanism with a robust, standard authentication system using bcrypt password hashing and JSON Web Tokens (JWT) for session management.

Working directory: `p:\projects\Forge`
Integrity mode: development

## Requirements

### R1. Password Hashing & Database Migration
- Integrate password hashing (`bcrypt` or `argon2`) for user passwords.
- Update `password_hash` handling in `src/server/services/auth.js` and `src/server/db/database.js`.
- Migrate any plain-text seed data in the database setup so that no plaintext passwords exist in `forge.db` or seed scripts.

### R2. JWT Authentication & Session Management
- Implement JSON Web Tokens (JWT) for session management.
- Issue tokens upon successful login/signup in `src/server/routes/auth.js`.
- Protect routes by validating JWT via middleware in `src/server/middleware/auth.js` (accepting `Authorization: Bearer <token>` or `httpOnly` cookie).
- Completely eliminate the `x-user-id` header authentication mechanism across all server routes and middleware.

### R3. Preserved Capabilities & Password Change Endpoint
- Preserve the `DEV_STEALTH` role masking behavior for superadmin capabilities.
- Implement a password change API endpoint (`POST /api/auth/change-password` or equivalent) requiring valid JWT authentication and current password verification.

### R4. Frontend SPA Updates
- Update `src/public/js/services/api.js` and login/signup UI components to securely store the JWT (e.g. localStorage/sessionStorage/cookies) and send it with all authenticated requests.
- Remove all instances of `x-user-id` header usage from frontend services.

## Acceptance Criteria

### Security & Authentication
- [ ] No plaintext passwords remain in the database (`forge.db`) or seed initialization files.
- [ ] The `x-user-id` header is completely removed from the backend; requesting protected endpoints without a valid JWT returns HTTP 401 Unauthorized.
- [ ] User login and signup successfully issue valid JWT tokens.
- [ ] A password change endpoint is implemented and protected by JWT authentication.

### Functionality & Tests
- [ ] The `DEV_STEALTH` role masking mechanism continues to work properly for superadmin users.
- [ ] Frontend app updates store the JWT upon login and automatically include it in subsequent API requests.
- [ ] All automated tests in `tests/` pass with updated token-based authentication.
