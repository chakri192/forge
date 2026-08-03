## 2026-08-01T01:05:29Z
You are worker_m1_m2 working in p:\projects\Forge\.agents\worker_m1_m2\.
Read the exploration reports at:
- p:\projects\Forge\.agents\explorer_1\analysis.md
- p:\projects\Forge\.agents\explorer_2\analysis.md
- p:\projects\Forge\.agents\explorer_3\analysis.md
- p:\projects\Forge\.agents\ORIGINAL_REQUEST.md

Your mission is to implement Milestone 1 (Stack Transition & Package/CSS/JS Refactoring) and Milestone 2 (Role Hierarchy, Backend REST API, SQLite Schema, Task Marketplace).

Tasks to perform:
1. Update `package.json` to have clean scripts, server dependencies (`better-sqlite3`, `cors`, `dotenv`, `express`, `multer`), and `supertest` in devDependencies. Zero React dependencies.
2. Update `src/server/db/database.js` to implement the full 8-table SQLite DDL schema from explorer_2's report (`users`, `student_leader_rotations`, `teams`, `team_memberships`, `tasks`, `task_upvotes`, `task_submissions`, `hall_of_fame_titles`).
3. Update `src/server/db/seed.js` to seed 5-role users (`u_dev` with DEV_STEALTH role, `u_teacher` with TEACHER role, `u_l1` & `u_l2` with STUDENT_LEADER role, Operatives with OPERATIVE role), sample marketplace tasks, upvotes, teams, and hall of fame titles. Run seed to populate database.
4. Update `src/server/index.js` to expose all REST endpoints specified in explorer_2's matrix. Implement authentication, `/api/auth/me`, `/api/tasks`, `/api/tasks/suggest`, `/api/tasks/:id/upvote`, `/api/tasks/:id/assign`, `/api/teams`, `/api/teams/:id/points/override`, `/api/teams/:id/dissolve`, `/api/hall-of-fame`, and `/api/hall-of-fame/award`.
5. Mask `DEV_STEALTH` user role in auth response so `public_role` is `'OPERATIVE'`.
6. Refactor frontend styling in `src/public/css/style.css` to use CSS custom properties (`--bg-base`, `--text-main`, `--accent-1`, `--accent-2`, `--accent-3`) for dynamic theme customization.
7. Modularize `src/public/js/` into ES modules (`services/api.js`, `services/theme.js`, `state/store.js`, `components/icons.js`, `views/`).

MANDATORY INTEGRITY WARNING: DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A Forensic Auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Run tests and builds after implementation to verify. Write your handoff report to p:\projects\Forge\.agents\worker_m1_m2\handoff.md and report back to parent.
