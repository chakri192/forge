# Database Architecture & Supabase Integration

## Overview

Forge uses **Supabase (PostgreSQL)** as its primary cloud database for all structured domain data (Users, Student Leader Rotations, Tasks, Task Marketplace Upvotes, Teams, Team Memberships, Task Submissions, and Hall of Fame Titles).

---

## Supabase Schema & Row Level Security (RLS) Policies

### 1. `users` Table
- **Columns**: `id`, `name`, `username`, `email`, `phone`, `password_hash`, `role`, `tag`, `created_at`
- **RLS Policies**:
  - `SELECT`: Enabled for authenticated cohort members.
  - `INSERT` / `UPDATE` / `DELETE`: Restricted to `TEACHER` and system service key.

### 2. `student_leader_rotations` Table
- **Columns**: `id`, `user_id`, `term_start`, `term_end`, `is_active`, `created_at`
- **RLS Policies**:
  - `SELECT`: Enabled for all authenticated users.
  - `INSERT` / `UPDATE`: Restricted to `TEACHER`.

### 3. `tasks` Table
- **Columns**: `id`, `title`, `description`, `total_points`, `is_marketplace`, `assigned_team_id`, `assigned_user_id`, `assigned_by`, `requires_proof`, `due_date`, `status`, `created_at`
- **RLS Policies**:
  - `SELECT`: Publicly accessible to cohort members.
  - `INSERT` (Marketplace): Allowed for `OPERATIVE` (where `is_marketplace = 1`).
  - `UPDATE` (Assign/Approve): Restricted to `STUDENT_LEADER` and `TEACHER`.

### 4. `task_upvotes` Table
- **Columns**: `task_id`, `user_id`, `created_at` (Primary Key: `task_id`, `user_id`)
- **RLS Policies**:
  - `SELECT`: Publicly accessible.
  - `INSERT` / `DELETE`: Authenticated user can only insert/delete rows matching their own `auth.uid() = user_id`.

### 5. `teams` & `team_memberships` Tables
- **Columns (`teams`)**: `id`, `name`, `captain_id`, `task_id`, `is_active`, `status`, `dissolved_at`, `dissolution_reason`, `created_at`
- **Columns (`team_memberships`)**: `id`, `user_id`, `team_id`, `custom_point_share`, `joined_at`
- **RLS Policies**:
  - `SELECT`: Publicly accessible.
  - `UPDATE` (`custom_point_share`): Restricted to designated `captain_id` or active `STUDENT_LEADER`.

### 6. `hall_of_fame_titles` Table
- **Columns**: `id`, `title_name`, `category`, `awarded_to_user_id`, `awarded_to_team_id`, `season`, `awarded_at`
- **RLS Policies**:
  - `SELECT`: Publicly accessible to all cohort members.
  - `INSERT`: Restricted to `TEACHER` or system service key.

---

## Local Development Fallback

For offline or local environment execution, SQLite (`forge.db`) provides an exact 1-to-1 table schema reflection of the Supabase database.
