# Project Directory Structure

## Overview

The directory layout of Forge is designed to group code by **feature module** rather than generic file type, keeping logic predictable and self-contained.

```
Forge/
├── docs/                      # Single Source of Truth Documentation Suite
│   ├── project/               # Vision, phases, roadmap, principles, decisions, glossary
│   ├── product/               # MVP scope, features, roles, permissions, user flows
│   ├── architecture/          # High-level system, backend, frontend, database, auth
│   ├── design/                # Design system tokens, branding, UI guidelines
│   ├── development/           # Coding standards, structure, git workflow, testing
│   └── agent/                 # AI agent role context and operating instructions
├── src/                       # Application Source Code (Pending implementation)
│   ├── features/              # Feature modules (Activities, Teams, Challenges, etc.)
│   ├── shared/                # Common UI primitives, utilities, and helpers
│   └── main.js / server.js    # Entry points
└── package.json / README.md   # Project metadata & scripts
```

---

## Directory Roles & Placement Logic

- **Why `docs/` is at the root**: Ensures documentation is front-and-center and readable by humans and AI agents alike before diving into source code.
- **Why `features/` over `controllers/` or `views/`**: Feature-based folder grouping keeps code related to one domain (e.g. Teams) in one predictable folder rather than scattered across the repository.
