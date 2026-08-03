# Forge Phase 1 MVP Transition — E2E Test Infrastructure & Test Architecture

## Executive Summary
This document establishes the official End-to-End (E2E) testing framework, feature inventory, test architecture, runner invocation instructions, and comprehensive Tier 1–4 test breakdowns for the Forge Phase 1 MVP Transition.

---

## 1. Feature Inventory

| Feature Area | Key Functionality & Scope | Verification Target |
|---|---|---|
| **F1. Tech Stack Transition** | Conversion from React to Vanilla HTML5, CSS3, ES Modules, Node/Express, and SQLite | Static asset delivery (`/`, `/index.html`, `/css/style.css`, `/js/app.js`), CSS Tokens (`--bg-base`, `--text-main`, `--accent-1`, `--accent-2`, `--accent-3`), zero React dependencies in `package.json` |
| **F2. Core Roles & Auth** | 5 Roles: Operative (Student), Team Captain, Student Leader (max 2), Teacher (Admin), Hidden Developer (`DEV_STEALTH`) | Flexible authentication (Email, Username, Phone + Password), `public_role` mapping (`DEV_STEALTH` -> `OPERATIVE`), user profile endpoint `/api/users` |
| **F3. Task Marketplace** | Rename 'Activities' to 'Tasks', Operative task suggestions, upvoting board, Student Leader team assignment | Endpoints: `GET /api/tasks`, `POST /api/tasks/suggest`, `POST /api/tasks/:id/upvote`, `POST /api/tasks/:id/assign`, `POST /api/tasks/:id/submit` |
| **F4. Dynamic Point Distribution** | Team Captain and Student Leader point share adjustment per member (`custom_point_share`) | Endpoints: `GET /api/teams`, `POST /api/teams/redistribute-points`, database persistence and Hall of Fame weighted point calculations |
| **F5. Team Lifecycle & Auto-Dissolution** | 4-member teams auto-dissolve back into general cohort pool upon task completion/deadline | Endpoints: `POST /api/teams`, `POST /api/teams/:id/dissolve`, `POST /api/tasks/:id/complete` (auto-dissolution when team size >= 4) |
| **F6. The Hall of Fame** | Interactive marble/granite theme displaying All-Time rankings, Season 1 rankings, and Awarded Titles wall | Endpoints: `GET /api/hall-of-fame`, `POST /api/hall-of-fame/titles`, exclusion of stealth dev from rankings |
| **F7. UI Cleanliness & Stealth Rules** | Elimination of 'Operation Overthink' / 'Shadow Lead / Dev Mode', minimalist SVGs instead of emojis, inline role actions | Inspection of HTML/CSS/JS text content, SVG icon usage, role action inline visibility |

---

## 2. Test Architecture

The E2E test suite operates as an **opaque-box end-to-end framework**:

```
 ┌─────────────────────────────────────────────────────────────┐
 │                    tests/e2e/runner.js                      │
 └──────────────────────────────┬──────────────────────────────┘
                                │ Orchestrates Execution
       ┌────────────────────────┼────────────────────────┐
       ▼                        ▼                        ▼
┌──────────────┐        ┌──────────────┐        ┌──────────────┐
│  test_helpers│        │   SQLite DB  │        │Express Server│
│  (HTTP client│───────►│ (Seed Reset) │◄───────│  (Port 3999) │
└──────────────┘        └──────────────┘        └──────────────┘
       │                                                 ▲
       │                  HTTP Requests                  │
       └─────────────────────────────────────────────────┘
```

- **HTTP Client**: Uses Node.js native `fetch` to issue REST API requests and fetch static assets (`index.html`, `style.css`, `app.js`).
- **Isolation & Reproducibility**: Prior to running test suites, the runner programmatically resets the SQLite database to a known seed state (`seed.js`).
- **Opaque-Box Testing**: All assertions validate HTTP response statuses, JSON payloads, static file contents, and resulting state query responses.

---

## 3. Test Runner Invocation

To execute the full E2E test suite across Tiers 1–4:

```bash
node tests/e2e/runner.js
```

### Script Options & CLI Arguments
- `node tests/e2e/runner.js --tier=1` (Run Tier 1 only)
- `node tests/e2e/runner.js --tier=2` (Run Tier 2 only)
- `node tests/e2e/runner.js --tier=3` (Run Tier 3 only)
- `node tests/e2e/runner.js --tier=4` (Run Tier 4 only)

---

## 4. Tier Breakdown & Test Specifications

### Tier 1: Feature Coverage (>=5 test cases per feature across 7 feature areas = 35 test cases)

#### F1. Tech Stack Transition
- `T1_F1_01`: Verify GET `/` returns HTTP 200 with HTML content type.
- `T1_F1_02`: Verify `package.json` contains zero React dependencies.
- `T1_F1_03`: Verify GET `/css/style.css` contains all 5 required CSS custom property token definitions (`--bg-base`, `--text-main`, `--accent-1`, `--accent-2`, `--accent-3`).
- `T1_F1_04`: Verify GET `/js/app.js` serves valid ES Module frontend bundle.
- `T1_F1_05`: Verify static asset `/uploads` route serves uploaded proof files cleanly.

#### F2. Core Roles & Auth Hierarchy
- `T1_F2_01`: Login as Operative (`alex@forge.local`) via email.
- `T1_F2_02`: Login as Student Leader (`marcus_lead`) via username.
- `T1_F2_03`: Login as Teacher (`sarah@forge.local`) via email.
- `T1_F2_04`: Login as Hidden Developer (`aaron_dev`) via username and verify `public_role` is mapped to `OPERATIVE`.
- `T1_F2_05`: GET `/api/users` returns all cohort users with correct role metadata.

#### F3. Task Marketplace
- `T1_F3_01`: Suggest new task via POST `/api/tasks/suggest` and receive `taskId`.
- `T1_F3_02`: GET `/api/tasks` returns both `official` and `marketplace` task arrays.
- `T1_F3_03`: Upvote marketplace task via POST `/api/tasks/:id/upvote` and verify incremented count.
- `T1_F3_04`: Assign marketplace task to team via POST `/api/tasks/:id/assign` and confirm status changes to `IN_PROGRESS`.
- `T1_F3_05`: Submit task proof via POST `/api/tasks/:id/submit` and verify submission status `PENDING`.

#### F4. Dynamic Point Distribution
- `T1_F4_01`: GET `/api/teams` returns team roster and member `custom_point_share`.
- `T1_F4_02`: Post dynamic point redistribution via POST `/api/teams/redistribute-points` for team member.
- `T1_F4_03`: Verify updated `custom_point_share` persists in database query.
- `T1_F4_04`: Verify dynamic point share calculation weights member point earnings correctly.
- `T1_F4_05`: Update multiple team members' custom point shares in a single squad.

#### F5. Team Lifecycle & Auto-Dissolution
- `T1_F5_01`: Create 4-member team via POST `/api/teams`.
- `T1_F5_02`: Assign task to 4-member team and mark task `COMPLETED` via POST `/api/tasks/:id/complete`.
- `T1_F5_03`: Verify 4-member team is auto-dissolved (`is_active = 0`) upon task completion.
- `T1_F5_04`: Verify members of dissolved team are returned to general cohort pool.
- `T1_F5_05`: Explicitly dissolve team via POST `/api/teams/:id/dissolve` and confirm status update.

#### F6. The Hall of Fame
- `T1_F6_01`: GET `/api/hall-of-fame` returns `allTime`, `season1`, and `titles` sections.
- `T1_F6_02`: Verify All-Time leaderboard calculates total points weighted by `custom_point_share`.
- `T1_F6_03`: Verify Season 1 leaderboard ranks non-developer operatives correctly.
- `T1_F6_04`: Award new Hall of Fame title via POST `/api/hall-of-fame/titles`.
- `T1_F6_05`: Verify awarded title appears on Hall of Fame titles wall.

#### F7. Stealth Rules & SVG Icons
- `T1_F7_01`: Verify zero occurrences of 'Operation Overthink' in HTML, CSS, or JS files.
- `T1_F7_02`: Verify zero occurrences of 'Shadow Lead' or 'Dev Mode' in UI code.
- `T1_F7_03`: Verify SVG icons (`.svg-icon` or `<svg>`) are present in `style.css` / `app.js`.
- `T1_F7_04`: Verify hidden developer account (`DEV_STEALTH`) is completely excluded from Hall of Fame leaderboards.
- `T1_F7_05`: Verify no standalone admin control panel screen routes exist.

---

### Tier 2: Boundary & Corner Cases (>=5 test cases per feature across 7 feature areas = 35 test cases)

#### F1. Tech Stack Boundaries
- `T2_F1_01`: Request non-existent static route, verify SPA fallback to `index.html`.
- `T2_F1_02`: Pass malformed JSON payload to API, expect HTTP 400 Bad Request.
- `T2_F1_03`: Fetch static CSS with custom Headers, expect correct MIME type `text/css`.
- `T2_F1_04`: Request non-existent upload file, expect 404 response.
- `T2_F1_05`: Toggle dark/light theme attributes, verify custom variable scoping.

#### F2. Role Boundary Violations
- `T2_F2_01`: Login with invalid password, expect HTTP 401 Unauthorized.
- `T2_F2_02`: Login with non-existent user identifier, expect HTTP 401.
- `T2_F2_03`: Attempt login with empty credentials, expect HTTP 400.
- `T2_F2_04`: Verify Operative cannot assign task to non-existent team ID.
- `T2_F2_05`: Verify hidden developer account maintains `public_role: OPERATIVE` even after multiple requests.

#### F3. Empty & Edge Marketplace Cases
- `T3_F3_01`: Suggest task with empty title or description, expect HTTP 400.
- `T3_F3_02`: Upvote non-existent task ID, expect graceful handle (0 upvotes / error).
- `T3_F3_03`: Assign task without specifying `team_id`, expect handle.
- `T3_F3_04`: Retrieve marketplace tasks when zero marketplace tasks exist.
- `T3_F3_05`: Upvote task multiple times from same cohort session, verify integer increment.

#### F4. Zero & Edge Point Overrides
- `T2_F4_01`: Set `custom_point_share` to 0.0 (zero contribution), verify successful update.
- `T2_F4_02`: Attempt negative `custom_point_share` (-0.5), expect HTTP 400 validation error.
- `T2_F4_03`: Set elevated `custom_point_share` (2.5x multiplier), verify weighted calculation.
- `T2_F4_04`: Redistribute points for non-existent team/user pair.
- `T2_F4_05`: Verify member points when total task points equal 0.

#### F5. Team Lifecycle Edge Cases
- `T2_F5_01`: Complete task assigned to 3-member team (less than 4), verify team remains active (`is_active = 1`).
- `T2_F5_02`: Attempt dissolving already dissolved team (`is_active = 0`), expect idempotent success.
- `T2_F5_03`: Create team with 0 members, verify team record structure.
- `T2_F5_04`: Assign task to dissolved team, verify constraint handling.
- `T2_F5_05`: Re-assign member of dissolved team to new 4-member squad.

#### F6. Hall of Fame Edge Cases
- `T2_F6_01`: Grant title without specifying `title_name`, expect HTTP 400.
- `T2_F6_02`: Retrieve Hall of Fame when no tasks have been completed (all points 0).
- `T2_F6_03`: Award title to non-existent user ID, expect null foreign key handle.
- `T2_F6_04`: Award team-level title vs user-level title.
- `T2_F6_05`: Verify leaderboard ordering stability when two operatives have tied point totals.

#### F7. Stealth & UI Edge Cases
- `T2_F7_01`: Inspect static JS source code comments for deprecated strings.
- `T2_F7_02`: Inspect DOM element selectors for legacy class names.
- `T2_F7_03`: Verify public auth response hides internal hash/salt fields.
- `T2_F7_04`: Verify hidden developer user actions do not leak `DEV_STEALTH` role into GET `/api/users`.
- `T2_F7_05`: Verify theme toggle maintains token fallbacks when switching modes.

---

### Tier 3: Cross-Feature Combinations (15 test cases)

- `T3_01`: **Auth + Task Suggestion**: Operative logs in, suggests marketplace task, verifies task appears under marketplace list.
- `T3_02`: **Upvoting + Leader Assignment**: Multiple operatives upvote task; Student Leader assigns top task to active team.
- `T3_03`: **Captain Point Tweak + Task Completion**: Captain redistributes point share (1.5x / 0.5x); task completed; Hall of Fame reflects weighted points.
- `T3_04`: **Task Completion + Auto-Dissolution**: 4-member team completes assigned task; task marked `COMPLETED` and team automatically dissolved (`is_active = 0`).
- `T3_05`: **Team Dissolution + Cohort Pool Reassignment**: Dissolved team members returned to pool, formed into a new team, and assigned a new task.
- `T3_06`: **Stealth Dev Action + Hall Exclusion**: Hidden dev logs in, upvotes task and completes system operation, but remains excluded from Hall of Fame.
- `T3_07`: **Task Proof Submission + Leader Approval**: Captain submits file proof; task marked `PENDING_APPROVAL`; status transitions to `COMPLETED`.
- `T3_08`: **Hall of Fame Title Grant + Monument Wall**: Award title to top operative upon task completion; verify title displays on Hall of Fame wall.
- `T3_09`: **Dynamic Point Override + Zero Point Share**: Captain sets underperforming member share to 0.0; member receives 0 points upon task completion.
- `T3_10`: **Multiple Team Task Completions + Ranking Shifts**: Two teams complete tasks with different point values; Hall of Fame leaderboard dynamically re-ranks operatives.
- `T3_11`: **Flexible Login (Phone) + Task Upvote**: Operative logs in using phone number, upvotes task, and verifies session state.
- `T3_12`: **Student Leader Rotation + Task Assignment**: Second rotated Student Leader assigns task to Beta squad.
- `T3_13`: **Theme Toggle + Hall of Fame Granite Styling**: Switch theme data attribute to light/dark and verify marble/granite wrapper style integrity.
- `T3_14`: **4-Member Squad Onboarding + Auto-Dissolve**: Create 4-member squad from cohort, complete 100 PTS task, verify dissolution and point distribution.
- `T3_15`: **Stealth Dev User Creation + Login**: Register user with `DEV_STEALTH` role, log in, verify `public_role` is `OPERATIVE`.

---

### Tier 4: Real-World Application Scenarios (8 multi-step workflow test cases)

- `T4_01`: **Complete Cohort Onboarding -> Task Suggestion -> Assignment Workflow**:
  - Step 1: Register 4 new operatives into cohort pool via POST `/api/users`.
  - Step 2: Form a 4-member team "Gamma Force" via POST `/api/teams`.
  - Step 3: Operative suggests task "Build Canvas Renderer" (50 PTS).
  - Step 4: Operatives upvote task to top rank.
  - Step 5: Student Leader assigns task to "Gamma Force".
  - Step 6: Verify task status is `IN_PROGRESS` and assigned to "Gamma Force".

- `T4_02`: **Task Execution -> Dynamic Point Tweak -> Task Finish & Auto-Dissolve**:
  - Step 1: Team Captain of "Gamma Force" adjusts member shares (1.4, 1.2, 0.8, 0.6).
  - Step 2: Captain submits proof for task via POST `/api/tasks/:id/submit`.
  - Step 3: Student Leader marks task `COMPLETED` via POST `/api/tasks/:id/complete`.
  - Step 4: Verify task status is `COMPLETED`.
  - Step 5: Verify "Gamma Force" auto-dissolves (`is_active = 0`) because team size == 4.
  - Step 6: Verify all 4 members return to general cohort pool for future assignments.

- `T4_03`: **Hall of Fame Rankings Update & Title Conferral**:
  - Step 1: Query GET `/api/hall-of-fame`.
  - Step 2: Verify points for "Gamma Force" members reflect total points * custom_point_share.
  - Step 3: Award title "MVP Architect" to top performing operative.
  - Step 4: Verify title appears in Hall of Fame titles array.

- `T4_04`: **Multi-Squad Sprint Execution & Season 1 Competition**:
  - Step 1: Create two 3-member squads ("Delta" and "Epsilon").
  - Step 2: Assign 40 PTS task to Delta and 60 PTS task to Epsilon.
  - Step 3: Complete both tasks.
  - Step 4: Verify 3-member squads remain active (`is_active = 1`).
  - Step 5: Verify Season 1 leaderboard orders members of Epsilon higher than Delta.

- `T4_05`: **Stealth Rules & Security Verification Across Workflows**:
  - Step 1: Log in as Hidden Developer (`aaron_dev`).
  - Step 2: Perform task upvotes and team creations.
  - Step 3: Inspect GET `/api/users` response to ensure `public_role` is `OPERATIVE`.
  - Step 4: Inspect GET `/api/hall-of-fame` to ensure hidden developer is absent from rankings.

- `T4_06`: **Flexible Auth & Multi-Channel User Login**:
  - Step 1: Authenticate Operative 1 via email.
  - Step 2: Authenticate Student Leader 1 via username.
  - Step 3: Authenticate Operative 2 via phone number.
  - Step 4: Verify all 3 sessions retrieve valid user objects.

- `T4_07`: **End-to-End Task Lifecycle (Suggestion -> Upvote -> Assign -> Proof -> Complete -> Dissolve)**:
  - Full end-to-end trace of a marketplace item through all 6 state transitions.

- `T4_08`: **Full Platform Audit (Static Assets, CSS Tokens, Stealth Strings, REST Endpoints, Database Consistency)**:
  - Comprehensive end-to-end check validating static assets, CSS variables, stealth compliance, API endpoints, and DB schema integrity.

---

## 5. Summary Table

| Tier | Focus Area | Test Cases | Execution Status |
|---|---|---|---|
| **Tier 1** | Feature Coverage (Static, 5 Roles, Marketplace, Points, Dissolution, Hall of Fame, Stealth) | 35 | Planned |
| **Tier 2** | Boundary & Corner Cases (Auth errors, invalid IDs, zero points, 3 vs 4 members) | 35 | Planned |
| **Tier 3** | Cross-Feature Combinations (Pairwise feature interactions) | 15 | Planned |
| **Tier 4** | Real-World Application Scenarios (Full E2E multi-step workflows) | 8 | Planned |
| **Total** | **Comprehensive E2E Suite** | **93** | **Ready for Execution** |
