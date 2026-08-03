# Authentication & Resource Ownership Security Architecture

## Overview

Forge uses a multi-layered security architecture designed to prevent unauthorized access, role escalation, and URL parameter tampering (Insecure Direct Object Reference / IDOR).

---

## Roles & Authority Matrix

1. **`OPERATIVE`**: Standard cohort student member.
   - Access: View public dashboard, tasks, marketplace upvotes, teams, and Hall of Fame.
   - Restrictions: Cannot modify other members' data, assign tasks, approve submissions, or access admin actions.

2. **`STUDENT_LEADER`**: Student Leader (2 rotated monthly).
   - Access: Operative permissions + assign marketplace tasks, approve task submissions, adjust team point shares, create/dissolve teams.

3. **`TEACHER`**: Instructor / Admin.
   - Access: Full administrative management — user creation, student leader rotations, point overrides, title awards.

4. **`DEV_STEALTH`**: Stealth Developer Account (Owner account `u_dev`).
   - Access: Full backend execution authority behind the scenes.
   - Masking: In all API responses (`/api/users`, `/api/auth/me`, `/api/teams`), `role` is masked to `public_role = 'OPERATIVE'` so the developer appears as a normal student to all other cohort members.

---

## Strict Anti-URL Tampering & Resource Ownership Rules (IDOR Protection)

To guarantee that no user can view or alter another member's private data simply by editing URL parameters or API payloads:

### 1. Session-Derived Identity Enforcement
- Endpoints derive user identity strictly from the verified session context (`req.user.id`).
- Client-supplied URL parameter overrides (e.g. `?user_id=u_other`) are ignored for user-scoped endpoints.

### 2. Resource Ownership Validation
- When accessing task proof submissions, custom point shares, or user profiles, the backend verifies that `req.user.id === resource.owner_id`.
- If a user attempts to access a resource belonging to another member without an authorized role (`TEACHER`, `STUDENT_LEADER`, or `VANGUARD` for that team), the server returns `403 Forbidden` or `404 Not Found`.

### 3. Database Row Level Security (RLS) Alignment
- Supabase Row Level Security (RLS) policies mirror this constraint directly at the PostgreSQL layer using `auth.uid() = user_id`.
