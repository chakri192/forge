# User Roles & Codenames (Operation Overthink)

## Overview

Forge features custom role codenames aligned with the **Operation Overthink** community branding. All accounts for the 45-member cohort are pre-seeded or batch-imported.

---

## Role Hierarchy & Codenames

```
+-------------------------------------------------------------------+
|                           SHADOW LEAD                             |
|               (Super-Admin / Developer Mode Toggle)              |
+-------------------------------------------------------------------+
                                  |
                                  v
+-------------------------------------------------------------------+
|                       ARCHITECT / OVERSEER                        |
|                   (Teacher / Community Lead)                      |
+-------------------------------------------------------------------+
                                  |
                                  v
+-------------------------------------------------------------------+
|                            VANGUARD                               |
|                     (Team Captain Roster Role)                    |
+-------------------------------------------------------------------+
                                  |
                                  v
+-------------------------------------------------------------------+
|                            OPERATIVE                              |
|                    (Standard Cohort Member)                       |
+-------------------------------------------------------------------+
```

---

## Role Definitions & Responsibilities

### 1. Operative (Standard Cohort Member)
- **Codename**: Operative
- **Role**: Standard active learner in the 45-person community.
- **Privileges**: Access learning activities, join teams, participate in challenges, access shared resources, track personal progress, and view leaderboards.

### 2. Vanguard (Team Captain)
- **Codename**: Vanguard
- **Role**: Designated team leader assigned to guide a specific learning team roster (2 Vanguards present in the 45-member cohort).
- **Privileges**: All Operative privileges plus exclusive authority to upload evidence files and submit completion proof for **Collaborative Team Challenges** on behalf of their team.

### 3. Architect / Overseer (Teacher / Community Lead)
- **Codename**: Overseer
- **Role**: Instructor or community mentor managing learning activities and cohort progress.
- **Privileges**: Create and edit activities, set verification rules (`requires_proof`, `requires_approval`), assign Vanguards, trigger team auto-randomization, review submissions, and manage resource categories.

### 4. Shadow Lead (Super-Admin / Double Agent Mode)
- **Codename**: Shadow Lead
- **Role**: System Owner & Lead Developer.
- **Privileges**: Full platform access featuring an in-app **Developer Mode Switcher** in the top navigation bar. Allows toggling seamlessly between **Operative View** (to experience the app as a standard student) and **Shadow Lead View** (to override points, approve submissions, inspect debug logs, and trigger system actions).

---

## Batch Import & Seeding Policy

- Initial local environment seeds a minimal set of demo profiles (1 Shadow Lead, 1 Overseer, 1 Vanguard, 1 Operative).
- A batch importer script (`src/scripts/seed-cohort.js`) will import the complete 45-member cohort CSV/JSON once member form responses are collected.
