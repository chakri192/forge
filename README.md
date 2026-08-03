# ⚡ Forge — Private Learning Community OS

> **Forge** is a high-performance, gamified Operating System designed for private learning communities, squads, and dev collectives. Built with zero framework bloat using Node.js, Express, SQLite, and pure Vanilla JS/CSS.

---

## ✨ Features

- **🛡️ Role-Based Access Control (RBAC)**: Strict role permissions (`member`, `leader`, `teacher`, `admin`) with layered middleware enforcement and security against IDOR & privilege escalation.
- **🎯 Tasks & Challenges Engine**: Full lifecycle state machine (`draft` ➔ `active` ➔ `in_progress` ➔ `pending_review` ➔ `completed`) for managing squad tasks and competitive challenges.
- **🏆 Hall of Fame & Leaderboards**: Optimized SQL aggregation for real-time team and individual member point tracking without N+1 query bottlenecks.
- **🤝 Squad & Team Management**: Squad roster controls, point distribution overrides, and active squad state management.
- **🎨 Glassmorphism Component Library**: Framework-less UI built with pure ES Modules featuring Toast notifications, DataTables, Drawers, Modal Confirmations, User Badges, Activity Feeds, and Rich Inputs.
- **🔔 Activity & Notification System**: Live feed auditing community events and user notifications.

---

## 🛠️ Tech Stack

| Layer | Technologies |
| :--- | :--- |
| **Backend** | Node.js (ES Modules), Express.js, `better-sqlite3` |
| **Security** | JWT Authentication (`jsonwebtoken`), `bcryptjs`, `zod` schema validation, `express-rate-limit` |
| **Frontend** | Vanilla HTML5, Custom CSS Tokens (Glassmorphism), Vanilla JS Component Architecture & SPA Router |
| **Testing** | Node.js native test runner (`node --test`), `supertest`, `jsdom` |

---

## 🚀 Quick Start

### Prerequisites
- [Node.js](https://nodejs.org/) (v18+ recommended)

### 1. Installation & Setup
```bash
# Install dependencies
npm install

# Run initial database migrations and seed demo data
npm run seed
```

### 2. Running the Application
```bash
# Start the server (Default port: 3000)
npm start

# Or run in developer watch mode
npm run dev
```

> 💡 **Windows Users**: You can also double-click `start_forge.bat` or run `run.bat` for one-click initialization and startup!

---

## 🧪 Testing

Forge features a suite of automated unit, integration, RBAC matrix, and E2E tests:

```bash
# Run all test suites
npm test
```

---

## 📁 Repository Structure

```
Forge/
├── docs/                 # Product specifications, architectural guides & design assets
├── src/
│   ├── public/           # Frontend SPA (Vanilla JS, CSS Tokens, Component Library)
│   │   ├── css/          # Glassmorphism styling and custom property tokens
│   │   ├── js/           # Single Page Application router, views, & reusable components
│   │   └── assets/       # Static branding and media assets
│   └── server/           # Backend API (Express application & SQLite database)
│       ├── config/       # Environment & global configuration constants
│       ├── db/           # SQLite migrations, schema definitions, and seed scripts
│       ├── middleware/   # RBAC, auth verification, validation, rate-limiting & error handlers
│       ├── models/       # Data models & query interfaces
│       ├── routes/       # RESTful API route definitions
│       └── services/     # Core business logic layer
└── tests/                # Automated test runner suites (RBAC, API, E2E, Components)
```

---

## 📜 License

Private & Proprietary — Learning Community Operating System.
