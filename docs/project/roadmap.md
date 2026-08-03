# Forge — Versioned Roadmap

> **Versioning**: `0.XX-alpha` → `0.50-alpha` (first user test release) → `0.5X-beta` → `1.0-release`
>
> **Deadline**: Version **0.50-alpha** by **Aug 1, 2026 (tomorrow night)**.

---

## Phase: Alpha (0.01 → 0.50)

Building core features. No external users. Internal testing only.

---

### 0.01-alpha — Foundation ✅ DONE

> *Server skeleton, database schema, dev tooling*

- [x] Express server with CORS, JSON parsing, static file serving
- [x] SQLite database with `better-sqlite3` — 8-table schema
- [x] Seed script with test data (users, teams, tasks, memberships)
- [x] Package.json scripts (`start`, `dev`, `seed`, `test`)
- [x] `.gitignore`, project structure, documentation scaffold

---

### 0.02-alpha — Authentication & RBAC ✅ DONE

> *Login, user identity, role-based access control*

- [x] Login endpoint (`POST /api/auth/login`) — email, username, or phone + password
- [x] Current user profile (`GET /api/auth/me`)
- [x] Role system: OPERATIVE, STUDENT_LEADER, TEACHER, DEV_STEALTH
- [x] `authenticateUser` middleware (global, every request)
- [x] `requireLeaderOrTeacher` middleware
- [x] `requireTeacher` middleware
- [x] `requireRole()` factory for flexible role gating

---

### 0.03-alpha — Security Hardening ✅ DONE

> *IDOR protection, privilege escalation prevention, owner lockdown*

- [x] Anti-IDOR: `verifyTeamAccess()` middleware — team membership verification
- [x] Anti-IDOR: Task submission ownership checks (assigned user or team member)
- [x] Privilege escalation prevention — cannot assign `DEV_STEALTH` via API
- [x] File upload path traversal protection (filename sanitization + extension whitelist)
- [x] File size limit (10MB)
- [x] Hardcoded `OWNER_ID` — cannot be deleted, role-changed, or impersonated via API
- [x] DEV_STEALTH completely invisible in all public endpoints (user lists, team members, leaderboards)
- [x] Owner immune to student leader rotation role overwrites
- [x] `DELETE /api/users/:id` and `PATCH /api/users/:id` with owner guards

---

### 0.04-alpha — Tasks & Challenges API ✅ DONE

> *Core task lifecycle, marketplace suggestions, task/challenge distinction*

- [x] `GET /api/tasks` — returns `{ teamTasks, challenges, marketplace }` (three separate lists)
- [x] **Tasks** (`TEAM_TASK`): Assigned to teams by leaders/teachers
- [x] **Challenges** (`CHALLENGE`): Open for solo/team/choice participation
- [x] `POST /api/tasks/suggest` — marketplace suggestions with `task_type` and `mode`
- [x] `POST /api/tasks/:id/upvote` and `DELETE /api/tasks/:id/upvote`
- [x] `POST /api/tasks/:id/assign` — promotes marketplace ideas to official (RBAC enforced)
- [x] `POST /api/tasks/:id/submit` — proof upload with IDOR verification
- [x] `POST /api/tasks/:id/approve` and `/complete` — shared handler, auto-dissolution

---

### 0.05-alpha — Teams & Point System API ✅ DONE

> *Team CRUD, dynamic point redistribution, auto-dissolution*

- [x] `GET /api/teams` — active teams with members and task info
- [x] `POST /api/teams` / `POST /api/teams/create` — team creation (RBAC)
- [x] `POST /api/teams/:id/points/override` — per-member point share adjustment
- [x] `POST /api/teams/redistribute-points` — alternative redistribution endpoint
- [x] `POST /api/teams/:id/dissolve` — manual dissolution (RBAC)
- [x] Auto-dissolution on task completion (teams >= 4 members)
- [x] Student Leader rotation (`POST /api/student-leaders/rotate`)

---

### 0.06-alpha — Code Quality & Performance ✅ DONE

> *Refactoring pass, test suite, query optimization*

- [x] Eliminated N+1 leaderboard query → single-pass SQL with Map lookup
- [x] Removed all duplicate route handlers (DRY shared functions)
- [x] Prepared statements for hot-path queries (avoid re-parsing)
- [x] Database transaction wrapping for multi-step operations
- [x] 16/16 test suite passing (unit + e2e tier1-4)
- [x] Consistent error handling middleware

---

### 0.07-alpha — Frontend Shell & State ✅ DONE

> *Vanilla JS SPA, client state management, theme system*

- [x] `index.html` — SPA shell with Inter font, nav tabs, theme toggle
- [x] `store.js` — reactive state store (subscribe/notify pattern)
- [x] `api.js` — centralized fetch service for all endpoints
- [x] `theme.js` — light/dark theme toggle with `data-theme` attribute
- [x] `style.css` — CSS custom properties design system
- [x] Update frontend views to use new `{ teamTasks, challenges, marketplace }` API shape
- [x] Separate "Tasks" and "Challenges" tabs/sections in the UI

---

### 0.08-alpha — Frontend: Dashboard View ✅ DONE

> *Landing page after login with summary cards*

- [x] Welcome card with user name/tag & context role badge
- [x] Active task count + sprint completion progress
- [x] Team status card (current team, captain, members)
- [x] Quick stats: total tasks registered, squad assignment
- [x] Recent cohort activity feed

---

### 0.09-alpha — Frontend: Tasks & Challenges View ✅ DONE

> *Full tasks UI with create, assign, submit, approve flows*

- [x] Team Tasks list with status badges (OPEN, IN_PROGRESS, PENDING_APPROVAL, COMPLETED)
- [x] Challenges list — separate section with mode indicator (SOLO/TEAM/CHOICE)
- [x] Task Marketplace section with upvote buttons and real-time vote counts
- [x] "Suggest Marketplace Idea" modal form (with task_type & mode)
- [x] Proof submission modal form (file upload + deliverable notes)
- [x] Leader/Teacher "Approve & Complete Task" inline buttons

---

### 0.10-alpha — Frontend: Teams View ✅ DONE

> *Team management UI with point redistribution*

- [x] Active teams grid displaying member rosters & captain badge
- [x] Custom point redistribution weight share per member (100%, 150%, 50%)
- [x] "Create Squad" modal form (leader/teacher)
- [x] Dissolve team action (with confirmation)
- [x] Unassigned cohort pool indicator

---

### 0.11-alpha — Login Page & Auth Flow

> *Proper login screen replacing dev-mode auto-auth*

- [ ] Login page with email/username/phone + password inputs
- [ ] Session persistence (localStorage token or cookie)
- [ ] Logout functionality
- [ ] Auth-gated routing — redirect to login if unauthenticated
- [ ] Role-aware UI — show/hide admin actions based on `public_role`

---

### 0.12-alpha — Student Leader Rotation UI

> *Teacher-only controls for rotating leadership*

- [ ] Current active leaders display
- [ ] "Rotate Leaders" form — select new leaders from student pool
- [ ] Term duration display (start/end dates)
- [ ] Rotation history log

---

### 0.13-alpha — Create User / Onboarding UI

> *Teacher-only user creation and cohort management*

- [ ] "Add Student" form (name, username, email, role, tag)
- [ ] User list management view (edit, deactivate)
- [ ] Bulk invite / CSV import (stretch)

---

### 0.14-alpha — Task Assignment Workflow

> *Leader assigns marketplace tasks → official tasks*

- [ ] "Assign" button on marketplace tasks
- [ ] Team/User selector dropdown
- [ ] Task type selector (TEAM_TASK vs CHALLENGE)
- [ ] Confirmation + notification

---

### 0.15-alpha — Proof Review & Approval Workflow

> *Leader/Teacher reviews submitted proof*

- [ ] Pending submissions queue
- [ ] Proof viewer (image/PDF preview, notes)
- [ ] Approve / Reject actions with feedback
- [ ] Points auto-distributed on approval

---

### 0.16-alpha — Notifications & Activity Feed

> *In-app notification system*

- [ ] Notification bell with unread count
- [ ] Notification types: task assigned, proof reviewed, team dissolved, new marketplace suggestion
- [ ] Backend: notifications table + API endpoints
- [ ] Mark as read / dismiss

---

### 0.17-alpha — Profile & Settings Page

> *User self-service*

- [ ] View own profile (name, tag, role, points)
- [ ] Edit tag/badge
- [ ] Change password
- [ ] Theme preference persistence

---

### 0.18-alpha — Design System Polish Pass

> *Apply final Stitch-generated UI designs to all pages*

- [ ] Integrate Stitch MCP-generated HTML/CSS for each page
- [ ] Color palette tokens (Main, Accent-1, Accent-2, Accent-3)
- [ ] Typography scale finalization
- [ ] Component library consistency check (buttons, cards, forms, modals)
- [ ] Responsive breakpoints (mobile, tablet, desktop)

---

### 0.19-alpha — Animations & Micro-Interactions

> *Polish pass for feel and engagement*

- [ ] Page transition animations
- [ ] Card hover effects
- [ ] Button press feedback
- [ ] Loading skeletons
- [ ] Toast notifications (success/error)
- [ ] Upvote animation

---

### 0.20-alpha — Error Handling & Edge Cases

> *Graceful failures everywhere*

- [ ] Frontend: API error toasts with retry
- [ ] Frontend: Empty states for all lists (no tasks, no teams, etc.)
- [ ] Backend: Input validation tightening (string lengths, SQL injection edge cases)
- [ ] Backend: Rate limiting on auth endpoints
- [ ] 404 page

---

### 0.21–0.30-alpha — Reserved for Feature Additions

> *User-requested features will be slotted here*

- [ ] 0.21: _(available)_
- [ ] 0.22: _(available)_
- [ ] 0.23: _(available)_
- [ ] 0.24: _(available)_
- [ ] 0.25: _(available)_
- [ ] 0.26: _(available)_
- [ ] 0.27: _(available)_
- [ ] 0.28: _(available)_
- [ ] 0.29: _(available)_
- [ ] 0.30: _(available)_

---

### 0.31–0.40-alpha — Reserved for Feature Additions

> *More feature slots as needed*

- [ ] 0.31–0.40: _(available — 10 slots)_

---

### 0.41-alpha — Integration Testing Pass

> *End-to-end testing of all flows*

- [ ] Full user journey tests: signup → login → view tasks → join team → submit proof → get points
- [ ] Role-specific journey tests (Operative, Leader, Teacher)
- [ ] Security regression tests (IDOR, privilege escalation, path traversal)
- [ ] Performance benchmarks (leaderboard query, concurrent users)

---

### 0.42-alpha — Bug Fixes from Internal Testing

> *Fix everything found in 0.41*

- [ ] _(populated after 0.41 testing)_

---

### 0.43–0.49-alpha — Final Polish & Stabilization

> *Last tweaks before alpha release*

- [ ] 0.43: Accessibility pass (keyboard nav, screen readers, contrast)
- [ ] 0.44: Mobile responsiveness final check
- [ ] 0.45: Performance optimization (lazy loading, caching)
- [ ] 0.46: Documentation update (README, setup guide)
- [ ] 0.47: Deployment config (environment variables, production build)
- [ ] 0.48: Seed data review — realistic test accounts for user testing
- [ ] 0.49: Final smoke test

---

## 0.50-alpha — FIRST USER TESTING RELEASE

> **Target: Aug 1, 2026 (tomorrow night)**
>
> Alpha testers get access. Core features working. Known rough edges acceptable.

**Release checklist:**
- [ ] All features from 0.01–0.20 complete and tested
- [ ] Login flow working
- [ ] Tasks + Challenges fully functional
- [ ] Teams + Point redistribution working
- [ ] UI polished with Stitch designs applied
- [ ] No critical security vulnerabilities
- [ ] Deployed to test environment

---

## Phase: Beta (0.51 → 1.0)

Bug fixes and polish based on alpha tester feedback. Most features already implemented.

---

### 0.51–0.60-beta — Alpha Feedback Round 1

> *Fix issues reported by alpha testers*

- [ ] UI/UX pain points
- [ ] Workflow confusion fixes
- [ ] Missing validation / error messages
- [ ] Mobile layout issues

---

### 0.61–0.70-beta — Hall of Fame & Deferred Features

> *Features deferred from alpha*

- [ ] Hall of Fame — Marble/Granite theme leaderboard
- [ ] Dual rankings (All-Time + Season)
- [ ] Titles & Awards wall
- [ ] Action-based color palette system
- [ ] Any other deferred features

---

### 0.71–0.80-beta — Alpha Feedback Round 2

> *Second wave of tester feedback*

- [ ] _(populated from feedback)_

---

### 0.81–0.90-beta — Supabase Migration

> *Move from SQLite to Supabase PostgreSQL for production*

- [ ] Schema migration scripts
- [ ] Row-level security policies
- [ ] Auth migration (Supabase Auth or custom)
- [ ] Data migration tooling
- [ ] Connection pooling / edge functions

---

### 0.91–0.99-beta — Release Candidate

> *Final stabilization*

- [ ] Security audit
- [ ] Performance audit
- [ ] Cross-browser testing
- [ ] Final documentation
- [ ] Deployment pipeline

---

## 1.0-release — Full Launch

> All features complete. Production-ready. Supabase backend. Stable.

---

## Version Log

| Version | Status | Date | Summary |
|---------|--------|------|---------|
| 0.01-alpha | ✅ Done | Jul 31, 2026 | Server foundation, DB schema, seed |
| 0.02-alpha | ✅ Done | Jul 31, 2026 | Auth, RBAC middleware |
| 0.03-alpha | ✅ Done | Jul 31, 2026 | Security hardening, IDOR, owner protection |
| 0.04-alpha | ✅ Done | Jul 31, 2026 | Tasks & Challenges API |
| 0.05-alpha | ✅ Done | Jul 31, 2026 | Teams & Point System API |
| 0.06-alpha | ✅ Done | Aug 1, 2026 | Code quality refactor, N+1 fix, tests green |
| 0.07-alpha | ✅ Done | Aug 1, 2026 | Frontend shell & state |
| 0.08-alpha | ✅ Done | Aug 1, 2026 | Dashboard glassmorphism view |
| 0.09-alpha | ✅ Done | Aug 1, 2026 | Tasks & Challenges view with marketplace upvoting |
| 0.10-alpha | ✅ Done | Aug 1, 2026 | Teams view with member point weight share controls |
| 0.50-alpha | ✅ RELEASED | Aug 1, 2026 | First User Testing Release (Alpha Stage) |
