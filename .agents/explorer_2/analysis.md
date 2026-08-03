# Forge Phase 1 MVP — Backend Architecture & Requirements Analysis

## Executive Summary

This report provides a comprehensive architectural and requirements analysis for the backend of **Forge Phase 1 MVP**. Forge is an operating system for a private learning community (~45 members) transitioning from a legacy codebase to a **Vanilla HTML/CSS/JS frontend** served statically by a **Node.js / Express REST API** with **SQLite (`better-sqlite3`)** persistence.

This document details:
1. Current Express server structure, middleware, static asset serving, and routing analysis.
2. Complete target SQLite database schema (DDL), relationships, and seed strategies.
3. Specifications for the 5-Role Hierarchy and strict stealth security requirements.
4. Functional & API design for the Task Marketplace (upvoting & assignment).
5. Dynamic Point Distribution formulas and 4-member Team Lifecycle (auto-dissolution).
6. Hall of Fame ranking calculation engines (All-Time, Season 1) and awarded titles.
7. Complete REST API contract specification matrix.

---

## 1. Current Express Server Architecture Analysis

### 1.1 File & Directory Layout
The backend resides under `src/server/`:
- **`src/server/index.js`**: Primary Express application entry point.
- **`src/server/db/database.js`**: `better-sqlite3` database connection setup, WAL mode configuration, and schema initialization logic.
- **`src/server/db/seed.js`**: Database reset and initial testing seed script.
- **`src/server/db/forge.db`**: SQLite database file.

### 1.2 Server Setup & Middleware
- **Module System**: ES Modules (`"type": "module"` in `package.json`).
- **Middleware**:
  - `cors()`: Cross-Origin Resource Sharing enabled.
  - `express.json()`: JSON request body parsing.
  - `express.static(publicDir)`: Serves static HTML/JS/CSS assets from `src/public`.
  - `express.static(uploadsDir)`: Serves file uploads from root `uploads/` directory.
  - `multer`: Handles file upload storage to `uploads/` for task proof submissions.
- **Routing**: SPA support via catch-all fallback route (`app.get('*', ...)` serving `src/public/index.html`).

### 1.3 Gaps & Required Improvements
1. **Authentication State**: Missing `/api/auth/me` endpoint to verify current user session.
2. **Authorization Middleware**: Missing middleware (`requireAuth`, `requireRole`) to validate user identity and role permissions before executing sensitive operations (upvoting, task assignment, point overrides, team dissolution, title awarding).
3. **Upvoting Table**: Currently, upvoting increments a simple integer counter `upvotes = upvotes + 1` directly on the `tasks` table. It does not track *who* upvoted, allowing duplicate votes per user. A dedicated `task_upvotes` junction table is required.
4. **Individual Task Assignment**: Current `tasks` table only supports `assigned_team_id`. Must support assignment to individual Operatives (`assigned_user_id`) as well.
5. **Student Leader Rotation**: Missing tracking and endpoints for the monthly rotation of 2 Student Leaders.
6. **Team Auto-Dissolution**: Missing backend lifecycle trigger for dissolving 4-member teams upon task completion or deadline expiry.

---

## 2. SQLite Database Schema & Access Logic Analysis

### 2.1 Engine & Configuration
- **Database Engine**: `better-sqlite3` v11.8.1 (synchronous, high-performance C++ binding).
- **Pragmas**: `db.pragma('journal_mode = WAL');` and `db.pragma('foreign_keys = ON');`.
- **Database File**: `src/server/db/forge.db`.

### 2.2 Complete Target DDL Schema

```sql
-- 1. Users Table
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  username TEXT UNIQUE NOT NULL,
  email TEXT UNIQUE NOT NULL,
  phone TEXT UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'OPERATIVE', -- OPERATIVE, CAPTAIN, STUDENT_LEADER, TEACHER, DEV_STEALTH
  tag TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 2. Student Leader Monthly Rotations Table
CREATE TABLE IF NOT EXISTS student_leader_rotations (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  term_start DATETIME NOT NULL,
  term_end DATETIME NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);

-- 3. Teams Table
CREATE TABLE IF NOT EXISTS teams (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  captain_id TEXT,
  task_id TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'ACTIVE', -- ACTIVE, DISSOLVED
  dissolved_at DATETIME,
  dissolution_reason TEXT, -- 'TASK_COMPLETED', 'DEADLINE_EXPIRED', 'MANUAL'
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (captain_id) REFERENCES users (id) ON DELETE SET NULL,
  FOREIGN KEY (task_id) REFERENCES tasks (id) ON DELETE SET NULL
);

-- 4. Team Memberships Table
CREATE TABLE IF NOT EXISTS team_memberships (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  team_id TEXT NOT NULL,
  custom_point_share REAL NOT NULL DEFAULT 1.0,
  joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
  FOREIGN KEY (team_id) REFERENCES teams (id) ON DELETE CASCADE,
  UNIQUE(user_id, team_id)
);

-- 5. Tasks Table (Renamed from Activities)
CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  total_points INTEGER NOT NULL DEFAULT 10,
  is_marketplace INTEGER NOT NULL DEFAULT 0,
  assigned_team_id TEXT,
  assigned_user_id TEXT,
  assigned_by TEXT,
  requires_proof INTEGER NOT NULL DEFAULT 0,
  due_date DATETIME,
  status TEXT NOT NULL DEFAULT 'AVAILABLE', -- MARKETPLACE, AVAILABLE, IN_PROGRESS, PENDING_APPROVAL, COMPLETED, DISSOLVED_EXPIRED
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (assigned_team_id) REFERENCES teams (id) ON DELETE SET NULL,
  FOREIGN KEY (assigned_user_id) REFERENCES users (id) ON DELETE SET NULL,
  FOREIGN KEY (assigned_by) REFERENCES users (id) ON DELETE SET NULL
);

-- 6. Task Upvotes Junction Table (Prevents duplicate upvoting)
CREATE TABLE IF NOT EXISTS task_upvotes (
  task_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (task_id, user_id),
  FOREIGN KEY (task_id) REFERENCES tasks (id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);

-- 7. Task Submissions Table
CREATE TABLE IF NOT EXISTS task_submissions (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL,
  submitted_by TEXT NOT NULL,
  proof_url TEXT,
  proof_notes TEXT,
  status TEXT NOT NULL DEFAULT 'PENDING', -- PENDING, APPROVED, REJECTED
  reviewed_by TEXT,
  reviewed_at DATETIME,
  submitted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (task_id) REFERENCES tasks (id) ON DELETE CASCADE,
  FOREIGN KEY (submitted_by) REFERENCES users (id) ON DELETE CASCADE,
  FOREIGN KEY (reviewed_by) REFERENCES users (id) ON DELETE SET NULL
);

-- 8. Hall of Fame Awarded Titles Table
CREATE TABLE IF NOT EXISTS hall_of_fame_titles (
  id TEXT PRIMARY KEY,
  title_name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'Academics', -- Academics, Coding, Design, Leadership, Collaboration
  awarded_to_user_id TEXT,
  awarded_to_team_id TEXT,
  season TEXT NOT NULL DEFAULT 'Season 1',
  awarded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (awarded_to_user_id) REFERENCES users (id) ON DELETE SET NULL,
  FOREIGN KEY (awarded_to_team_id) REFERENCES teams (id) ON DELETE SET NULL
);
```

---

## 3. Requirements for 5-Role Hierarchy & Stealth Security Model

### 3.1 Role Hierarchy Matrix

| Role Code | Title | Responsibilities & Scope | Selection / Rotation | Client Payload Masking |
| :--- | :--- | :--- | :--- | :--- |
| `OPERATIVE` | Operative | Standard student cohort member (~40 members). View tasks, join/participate in teams, suggest marketplace tasks, upvote tasks. | Default role | Exposed as `OPERATIVE` |
| `CAPTAIN` | Team Captain | Leader of a specific 4-member team. Submits proof of task completion on behalf of team; can adjust member point shares. | Selected per task/team | Exposed as `CAPTAIN` |
| `STUDENT_LEADER` | Student Leader | Selected student leader (exactly 2 active at any time). Assigns marketplace tasks to teams/individuals, manages point overrides. | Rotated monthly (2 active) | Exposed as `STUDENT_LEADER` |
| `TEACHER` | Teacher / Admin | Instructor/Admin. Full system authority: creates official tasks, approves proof submissions, awards Hall of Fame titles, triggers leader rotations. | Fixed administrative account | Exposed as `TEACHER` |
| `DEV_STEALTH` | Hidden Developer | Hardcoded developer account (`u_dev` / `aaron_dev`). Performs system ops. Completely invisible on UI. | Fixed system account | Masked to `public_role: 'OPERATIVE'` |

### 3.2 Stealth Security Rules
1. **Scrub Legacy Terminology**: Absolutely zero occurrence of `"Operation Overthink"`, `"Shadow Lead"`, or `"Dev Mode Toggle"` across codebase, API responses, UI components, and static text.
2. **Hidden Developer Masking**:
   - The developer account (`id: 'u_dev'`, `username: 'aaron_dev'`) has DB role `DEV_STEALTH`.
   - When authenticating (`/api/auth/login` or `/api/auth/me`), the API returns `{ ...user, role: 'DEV_STEALTH', public_role: 'OPERATIVE' }`.
   - Front-end displays the user as a normal `OPERATIVE`.
   - On the backend, `DEV_STEALTH` bypasses all permission checks to allow system-level maintenance operations.
3. **No Explicit Admin Control Panels**:
   - Admin actions (task approval, leader assignment, point overrides, title awarding) must be rendered **inline** directly on task, team, or leaderboard cards depending on the authenticated user's role.
4. **SVG Icon Standard**: All legacy emoji icons (`🏛️`, `🏆`, `▲`, etc.) are prohibited in UI code. Minimalist SVGs must be used throughout.

---

## 4. Task Marketplace Requirements Analysis

### 4.1 Concept & Terminology
- Core entity renamed from **"Learning Activities" / "Activities"** to **"Tasks"**.
- Tasks exist in two primary modes:
  1. **Official Tasks** (`is_marketplace = 0`): Created by Teachers, directly available for assignment or pickup.
  2. **Marketplace Tasks** (`is_marketplace = 1`): Suggested by Operatives/Members, open for community upvoting.

### 4.2 Lifecycle & State Machine
```
[Operative Suggests Task] 
          │
          ▼
   (MARKETPLACE)  ◄── Upvoted by Operatives (tracked in task_upvotes)
          │
          │  Assigned by Student Leader to Team or Individual
          ▼
    (IN_PROGRESS)
          │
          │  Proof Submitted by Captain or Assigned Operative
          ▼
 (PENDING_APPROVAL)
          │
          ├─────────────────────────┐
          │ (Teacher Approves)      │ (Teacher Rejects)
          ▼                         ▼
     (COMPLETED)               (IN_PROGRESS)
```

### 4.3 Key Endpoints & Business Logic
1. **`POST /api/tasks/suggest`**: Any authenticated user can submit a title, description, and proposed point value. Sets `is_marketplace = 1`, `status = 'MARKETPLACE'`.
2. **`POST /api/tasks/:id/upvote`**: Inserts row into `task_upvotes`. If user already upvoted, returns `400 Already Upvoted` or toggles vote down (`DELETE /api/tasks/:id/upvote`).
3. **`POST /api/tasks/:id/assign`**: Accessible by **Student Leaders** and **Teachers**. Accepts `team_id` OR `user_id`.
   - Updates task: `is_marketplace = 0`, `assigned_team_id` / `assigned_user_id`, `status = 'IN_PROGRESS'`.
   - If assigned to a team, links task to team.

---

## 5. Dynamic Point Distribution & Team Lifecycle Analysis

### 5.1 Dynamic Point Distribution Model
When a team completes a task worth $P_{total}$ points, individual member scores are calculated based on their custom contribution weight $W_i$ (`custom_point_share`):

$$\text{Points Earned}_i = P_{total} \times \left( \frac{W_i}{\sum_{j=1}^{N} W_j} \right)$$

#### Example Calculation:
- Task Total Points ($P_{total}$) = 100 PTS.
- 4 Team Members with weights:
  - Captain: $W_1 = 1.2$
  - Member A: $W_2 = 1.0$
  - Member B: $W_3 = 1.0$
  - Member C: $W_4 = 0.8$
- Sum of weights $\sum W = 1.2 + 1.0 + 1.0 + 0.8 = 4.0$.
- Points Awarded:
  - Captain: $100 \times (1.2 / 4.0) = 30$ PTS.
  - Member A: $100 \times (1.0 / 4.0) = 25$ PTS.
  - Member B: $100 \times (1.0 / 4.0) = 25$ PTS.
  - Member C: $100 \times (0.8 / 4.0) = 20$ PTS.

#### Point Override Permissions & Endpoint:
- **`POST /api/teams/:id/points/override`**: Team Captains (for their own team) and Student Leaders / Teachers (for any team) can adjust `custom_point_share` values for team members prior to task approval.

### 5.2 Team Lifecycle & 4-Member Auto-Dissolution
- **Rule**: Teams in Forge are lightweight, task-oriented squads of up to 4 members formed for specific tasks.
- **Auto-Dissolution Triggers**:
  1. **Task Completion**: When a Teacher approves the task submission (`status = 'COMPLETED'`).
  2. **Deadline Expiration**: When the task `due_date` passes without completion.
- **Dissolution Execution (`POST /api/teams/:id/dissolve`)**:
  - Updates `teams.is_active = 0`, `teams.status = 'DISSOLVED'`, `dissolved_at = CURRENT_TIMESTAMP`, `dissolution_reason = 'TASK_COMPLETED' | 'DEADLINE_EXPIRED'`.
  - Removes active team memberships or marks team inactive.
  - All 4 members return to the unassigned cohort pool for future team matching.

---

## 6. Hall of Fame Requirements Analysis

### 6.1 Theme & Design Guidelines
- Interactive **Marble & Granite** aesthetic:
  - Base background: Polished dark slate/granite `#121418` with subtle marble vein patterns (`#1a1e24`).
  - Text & Accents: Chiselled metallic silver/gold highlights (`#e2e8f0`, `#ffd700`, `#c0c0c0`).
  - Clean typography and **SVG trophy/pinnacle icons** (no emoji icons).

### 6.2 Data Aggregation Logic

#### 1. All-Time Leaderboard Query:
Calculates cumulative points across all tasks ever completed:
```sql
SELECT 
  u.id, 
  u.name, 
  u.tag, 
  u.role,
  COALESCE(SUM(
    ROUND(t.total_points * (tm.custom_point_share / (
      SELECT SUM(sub_tm.custom_point_share) 
      FROM team_memberships sub_tm 
      WHERE sub_tm.team_id = t.assigned_team_id
    )))
  ), 0) as total_points
FROM users u
LEFT JOIN team_memberships tm ON u.id = tm.user_id
LEFT JOIN tasks t ON tm.team_id = t.assigned_team_id AND t.status = 'COMPLETED'
WHERE u.role != 'DEV_STEALTH'
GROUP BY u.id
ORDER BY total_points DESC;
```

#### 2. Season 1 Leaderboard Query:
Calculates points earned specifically during Season 1:
```sql
SELECT 
  u.id, 
  u.name, 
  u.tag,
  COALESCE(SUM(
    ROUND(t.total_points * (tm.custom_point_share / (
      SELECT SUM(sub_tm.custom_point_share) 
      FROM team_memberships sub_tm 
      WHERE sub_tm.team_id = t.assigned_team_id
    )))
  ), 0) as season_points
FROM users u
LEFT JOIN team_memberships tm ON u.id = tm.user_id
LEFT JOIN tasks t ON tm.team_id = t.assigned_team_id AND t.status = 'COMPLETED'
WHERE u.role != 'DEV_STEALTH'
GROUP BY u.id
ORDER BY season_points DESC;
```

#### 3. Awarded Titles Wall Query:
Retrieves earned honors (e.g. *Best Developer*, *Coding Champion*, *Master UI Craftsperson*, *Top Squad Sprint 01*):
```sql
SELECT 
  h.id, 
  h.title_name, 
  h.category, 
  h.season, 
  h.awarded_at,
  u.name as user_name, 
  tm.name as team_name
FROM hall_of_fame_titles h
LEFT JOIN users u ON h.awarded_to_user_id = u.id
LEFT JOIN teams tm ON h.awarded_to_team_id = tm.id
ORDER BY h.awarded_at DESC;
```

---

## 7. Complete REST API Specification Matrix

| Endpoint | Method | Required Roles | Description | Request Body / Params | Response Payload |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `/api/auth/login` | `POST` | Public | Flexible Auth (Email/Username/Phone + Password) | `{ identifier, password }` | `{ success: true, user: { id, name, username, email, role, public_role, tag } }` |
| `/api/auth/me` | `GET` | Authenticated | Retrieve current user profile & role | None (Session/Header) | `{ user: { id, name, username, role, public_role, tag } }` |
| `/api/users` | `GET` | Authenticated | List all cohort members | `?role=OPERATIVE` | `[{ id, name, username, role, tag }]` |
| `/api/student-leaders` | `GET` | Authenticated | Get current 2 active rotated Student Leaders | None | `[{ id, user_id, name, term_start, term_end }]` |
| `/api/student-leaders/rotate` | `POST` | `TEACHER`, `DEV_STEALTH` | Rotate active Student Leaders | `{ leader_ids: [id1, id2] }` | `{ success: true, active_leaders: [...] }` |
| `/api/tasks` | `GET` | Public | List official & marketplace tasks | `?status=AVAILABLE` | `{ official: [...], marketplace: [...] }` |
| `/api/tasks/suggest` | `POST` | Authenticated | Suggest a Marketplace Task | `{ title, description, total_points }` | `{ success: true, taskId }` |
| `/api/tasks/:id/upvote` | `POST` | Authenticated | Upvote a Marketplace Task | `{ user_id }` | `{ success: true, upvotes: N }` |
| `/api/tasks/:id/upvote` | `DELETE` | Authenticated | Remove Upvote from Task | `{ user_id }` | `{ success: true, upvotes: N }` |
| `/api/tasks/:id/assign` | `POST` | `STUDENT_LEADER`, `TEACHER`, `DEV_STEALTH` | Assign Task to Team or Individual | `{ team_id?, user_id? }` | `{ success: true }` |
| `/api/tasks/:id/submit` | `POST` | `CAPTAIN`, `OPERATIVE`, `TEACHER`, `DEV_STEALTH` | Submit Task Proof (Multipart Form) | `proof_file`, `submitted_by`, `proof_notes` | `{ success: true, submissionId }` |
| `/api/tasks/:id/approve` | `POST` | `TEACHER`, `DEV_STEALTH` | Approve Task Submission & Trigger Auto-Dissolve | `{ submission_id }` | `{ success: true, team_dissolved: true }` |
| `/api/teams` | `GET` | Public | List active teams with rosters & point shares | None | `[{ id, name, captain_name, members: [...] }]` |
| `/api/teams/create` | `POST` | `STUDENT_LEADER`, `TEACHER`, `DEV_STEALTH` | Create a 4-member squad for a task | `{ name, captain_id, member_ids: [], task_id? }` | `{ success: true, teamId }` |
| `/api/teams/:id/points/override` | `POST` | `CAPTAIN`, `STUDENT_LEADER`, `TEACHER`, `DEV_STEALTH` | Adjust custom point share for team member | `{ user_id, custom_point_share }` | `{ success: true }` |
| `/api/teams/:id/dissolve` | `POST` | `STUDENT_LEADER`, `TEACHER`, `DEV_STEALTH` | Manually dissolve team back to pool | `{ reason }` | `{ success: true }` |
| `/api/hall-of-fame` | `GET` | Public | Get Hall of Fame rankings & awarded titles | None | `{ allTime: [...], season1: [...], titles: [...] }` |
| `/api/hall-of-fame/award` | `POST` | `TEACHER`, `DEV_STEALTH` | Award title to user or team | `{ title_name, category, user_id?, team_id?, season }` | `{ success: true, titleId }` |

---

## 8. Summary of Implementation Recommendations for Implementer

1. **Database Script (`src/server/db/database.js`)**:
   - Update `initSchema()` with the complete DDL schema provided in Section 2.2.
   - Ensure foreign key constraints are enabled on startup.

2. **Seeding Script (`src/server/db/seed.js`)**:
   - Reset and populate 5 seed users: `u_dev` (DEV_STEALTH), `u_teacher` (TEACHER), `u_l1` & `u_l2` (STUDENT_LEADER), `u_o1` & `u_o2` (CAPTAIN/OPERATIVE).
   - Seed sample marketplace tasks, official tasks, teams, upvotes, and Hall of Fame titles.

3. **Express Router & Middleware (`src/server/index.js`)**:
   - Implement authorization helper middleware checking request headers/user context.
   - Wire up all REST endpoints listed in Section 7.
   - Implement the team auto-dissolution helper function called upon task approval (`/api/tasks/:id/approve`).

4. **Frontend Integration (`src/public/js/app.js` & `index.html`)**:
   - Serve clean Vanilla JS ES Modules.
   - Render inline action controls based on `user.role` / `user.public_role`.
   - Use SVG icons exclusively (no emoji icons).
   - Apply Marble & Granite CSS variables for Hall of Fame view.
