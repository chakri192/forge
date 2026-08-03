# Architectural Decision Records (ADR)

This document tracks all key technical and architectural decisions made for **Forge**, detailing the context, rationale, and consequences of each choice in beginner-friendly language.

---

## ADR 0001: Documentation-First Bootstrapping

- **Date**: 2026-07-31
- **Status**: Approved
- **Context**: The project was started without existing formal documentation or explicit technical constraints.
- **Decision**: Bootstrap a comprehensive 6-domain documentation suite (`docs/`) before creating any application code or database schemas.
- **Rationale**: Keeps documentation as the single source of truth, eliminates hidden assumptions, and enforces beginner-friendly transparency.
- **Consequences**: No feature implementation can begin until technical and product documentation is established and verified.

---

## ADR 0002: Scope Locking on Phase 1 MVP

- **Date**: 2026-07-31
- **Status**: Approved
- **Context**: The project vision specifies a learning community operating system for ~45 members, distinct from generic LMS platforms.
- **Decision**: Strictly lock Phase 1 scope to: Learning Activities, Collaborative Challenges, Teams, Resources, Leaderboards, and Progress Tracking. Mark AI, notifications, forums, analytics, and integrations as out of scope.
- **Rationale**: Prevents premature complexity and guarantees a lean, maintainable initial release.
- **Consequences**: Code implementations will contain zero stubs or integrations for future phase features.

---

## ADR 0003: Technical Stack Selection (Vanilla HTML/JS + Express Backend)

- **Date**: 2026-07-31
- **Status**: Approved
- **Context**: The platform requires clean component-driven UI animations and zero framework bloat.
- **Decision**: 
  - **Frontend**: Vanilla HTML5, CSS Custom Properties (Tokens), and ES Module JavaScript.
  - **Backend**: Node.js + Express REST API for service separation.
  - **Database**: Supabase PostgreSQL for cloud persistence with local SQLite fallback during dev.
- **Rationale**: Keeps the application lightweight, fast, and easy to maintain without framework lock-in.

---

## ADR 0004: Pre-Seeded Member Accounts & No Public Signup

- **Date**: 2026-07-31
- **Status**: Approved
- **Context**: The community consists of a fixed, known cohort of ~45 members.
- **Decision**: Disable public registration endpoints. All member accounts are pre-seeded or batch-imported.
- **Rationale**: Eliminates public access risks and simplifies onboarding.

---

## ADR 0005: Flexible Task Verification Rules

- **Date**: 2026-07-31
- **Status**: Approved
- **Context**: Tasks require flexible completion standards.
- **Decision**: Allow Student Leaders / Teachers to configure verification settings per task: `requires_proof` and `requires_approval`.
- **Rationale**: Gives instructors and leaders full flexibility.

---

## ADR 0006: Stealth Developer Role

- **Date**: 2026-07-31
- **Status**: Approved
- **Context**: System owner needs full administrative override authority without revealing dev controls on the UI.
- **Decision**: Hardcode developer authority to owner's account behind the scenes (`DEV_STEALTH`). To all other users, developer appears as a standard Operative with zero visible dev toggles or "Operation Overthink" branding.
- **Rationale**: Ensures total stealth and clean user experience.

---

## ADR 0007: 4-Member Team Lifecycle & Auto-Dissolution

- **Date**: 2026-08-01
- **Status**: Approved
- **Context**: Teams are formed for specific sprint tasks and should not become permanent isolated silos.
- **Decision**: Form 4-member teams for tasks. Upon task completion or deadline, teams automatically dissolve back into the general cohort pool.
- **Rationale**: Encourages cross-peer collaboration across different tasks.

---

## ADR 0008: Dynamic CSS Accent Color Tokens

- **Date**: 2026-08-01
- **Status**: Approved
- **Context**: Platform styling needs flexible accent color customization.
- **Decision**: Use abstract CSS tokens (`--bg-base`, `--text-main`, `--accent-1`, `--accent-2`, `--accent-3`).
- **Rationale**: Allows user settings to dynamically switch accent themes in future releases.

---

## ADR 0009: Team Captain Submission Authority

- **Date**: 2026-07-31
- **Status**: Approved
- **Context**: Team tasks require single-point submission accountability.
- **Decision**: Team Captains submit completion evidence for team tasks.
- **Rationale**: Eliminates duplicate submissions and enforces team leadership.

---

## ADR 0010: The Hall of Fame (Marble & Granite Theme)

- **Date**: 2026-08-01
- **Status**: Approved
- **Context**: Community recognition requires a high-contrast honorable layout.
- **Decision**: Replace generic leaderboards with a stone-themed **Hall of Fame** featuring All-Time rankings, Season 1 rankings, and an Awarded Titles Wall.
- **Rationale**: Maximizes engagement and prestige.

---

## ADR 0011: Minimal Initial Seeding & Batch Importer

- **Date**: 2026-07-31
- **Status**: Approved
- **Context**: Initial testing requires 2-3 accounts before full 45-member batch import.
- **Decision**: Seed 2-3 testing Operatives + 2 Student Leaders initially; provide batch importer script for cohort onboarding later.

---

## ADR 0012: Student Leader Rotation & Task Marketplace

- **Date**: 2026-08-01
- **Status**: Approved
- **Context**: Community management rotates among students; students suggest task ideas.
- **Decision**: 2 Student Leaders rotated monthly. Operatives suggest task ideas in a Task Marketplace with upvoting (`▲ Upvote`).
- **Rationale**: Empowers student initiative and peer leadership.

---

## ADR 0013: Supabase Integration & Row Level Security (RLS) Policies

- **Date**: 2026-08-01
- **Status**: Approved
- **Context**: Structured data must be stored securely in Supabase PostgreSQL with strict access rules.
- **Decision**: Integrate Supabase as the primary cloud database, backed by Row Level Security (RLS) policies.
- **Rationale**: Protects database integrity and strictly enforces role-based security at the database engine level.

---

## ADR 0014: Strict Resource Ownership & IDOR Protection (Anti-URL Tampering)

- **Date**: 2026-08-01
- **Status**: Approved
- **Context**: Users must never be able to access, view private submissions, or edit another member's private data simply by altering URL query parameters or ID fields in API calls.
- **Decision**: Enforce strict **Resource Ownership & IDOR Protection** middleware across all backend endpoints:
  - All user-specific queries automatically infer user identity from the authenticated session (`req.user.id`), completely ignoring client-supplied URL query overrides (e.g. `?user_id=...`).
  - Access to private submissions or user records is restricted strictly to the resource owner, unless an authorized role (Teacher, Student Leader, or Captain for that specific team) is actively requesting it.
  - Any unauthorized attempt to access another user's private data returns `403 Forbidden` or `404 Not Found`.
- **Rationale**: Eliminates URL tampering vulnerabilities and guarantees total privacy between cohort members.
