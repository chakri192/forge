# Backend Architecture

## Overview

The Forge backend handles business logic execution, data persistence, REST API endpoint delivery, and static asset / file upload handling.

---

## Technical Specifications

- **Runtime & Language**: Node.js (JavaScript / ES Modules).
- **Framework**: Express.js.
- **API Structure**: Modular REST API routes organized by feature (`/api/auth`, `/api/activities`, `/api/challenges`, `/api/teams`, `/api/resources`, `/api/leaderboard`).
- **File Handling**: Streamlined file upload/download middleware (Multer / native disk streams) for community resource attachments and activity proof files.

---

## Core Modules Strategy

Backend responsibilities are split into feature modules:
- `features/auth`: User authentication, session cookies / tokens, password hashing.
- `features/activities`: CRUD operations and completion state for learning activities.
- `features/challenges`: Collaborative team challenges and score tracking.
- `features/teams`: Team formation, member rosters, and invitations.
- `features/resources`: File upload metadata, category filtering, and download links.
- `features/leaderboards`: Score aggregation and ranking calculations.
