# Feature Requirements & Breakdown

This document provides a feature breakdown for Phase 1 of **Forge**.

---

## 1. Learning Activities Module

- **Description**: Displays structured learning activities for community members.
- **Capabilities**:
  - View list of available learning activities.
  - View activity details, instructions, and objectives.
  - Submit completion evidence (file upload or URL) if `requires_proof` is set.
  - Admin toggle per activity: `requires_proof` and `requires_approval`.
  - Mark activity status (Not Started, In Progress, Pending Approval, Completed).

---

## 2. Collaborative Challenges Module

- **Description**: Facilitates group or team-based learning goals.
- **Capabilities**:
  - View active collaborative challenges.
  - Participate in a challenge with a team roster.
  - **Team Captain Submissions**: Only designated Team Captains can submit completion evidence for team challenges.
  - Track team-aggregate point contributions.

---

## 3. Team Management Module

- **Description**: Organizes ~45 community members into working groups.
- **Capabilities**:
  - View community teams and roster of team members.
  - Designated Team Captain assignment per team.
  - Join or leave teams (when self-joining is enabled by Admin).
  - Admin manual member assignment & team capacity locking.
  - **Admin One-Click Auto-Randomize**: Automatically shuffle and split cohort members evenly into $N$ teams or target team sizes.

---

## 4. Resource Repository Module

- **Description**: Central hub for sharing and uploading curated learning materials and challenge files.
- **Capabilities**:
  - Browse categorized learning resources (documentation, video links, tools, templates).
  - Upload file attachments directly via streaming Express endpoints.
  - Download resource files with role-based access.

---

## 5. Leaderboard Module

- **Description**: Gamified ranking of individual and team accomplishments.
- **Capabilities**:
  - **Tabbed Leaderboard Views**: Switch between **All-Time** rankings and **Active Sprint / Season** rankings.
  - Display individual point rankings and team point rankings.
  - Framer Motion animated list reordering upon score updates.

---

## 6. Progress Tracking & Developer Mode Module

- **Description**: Visual representation of completion status and administrative toggles.
- **Capabilities**:
  - Personal progress dashboard showing completed activities and earned badges.
  - Community overview dashboard.
  - **Super-Admin / Developer Mode Toggle**: Top navigation toggle allowing system owners to switch UI view between standard Member mode and Super-Admin mode.

---

## Out-of-Scope Feature List (Phase 1)

- AI recommendations / automated tutors
- In-app or email notifications
- Real-time community discussion feeds / forums
- Complex telemetry & analytics engines
- Hackathon brackets & judging workflows
