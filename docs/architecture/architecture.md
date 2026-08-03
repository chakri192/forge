# High-Level Architecture Overview

## Structural Strategy

Forge follows a **modular, decoupled architecture** designed to be clear, maintainable, and beginner-friendly.

```
+-------------------------------------------------------------------+
|                        PRESENTATION LAYER                         |
|                 (UI Components & User Views)                       |
+-------------------------------------------------------------------+
                                  |
                                  v
+-------------------------------------------------------------------+
|                       BUSINESS LOGIC LAYER                        |
|        (Services: Activities, Challenges, Teams, Leaderboards)    |
+-------------------------------------------------------------------+
                                  |
                                  v
+-------------------------------------------------------------------+
|                         DATA ACCESS LAYER                         |
|                 (Persistence & Database Adapters)                 |
+-------------------------------------------------------------------+
```

---

## Key Architectural Rules

1. **Feature-Based Grouping**: Code modules are organized around domain features (e.g., `features/activities`, `features/teams`, `features/leaderboards`) rather than technical file types.
2. **Unidirectional Dependency Flow**: Presentation components depend on logic services; logic services depend on data access modules. Presentation components NEVER query the database directly.
3. **No Circular Dependencies**: Feature modules must remain isolated. Shared utilities live in common packages.
4. **Beginner-Friendly Abstractions**: Every layer must be explicit and readable without excessive indirect abstraction layers.

---

## Pending Technical Decisions

- *Pending clarification*: Core stack selection (Node.js/Express, Python/FastAPI, Next.js, or Vite + REST backend).
- *Pending clarification*: Hosting and deployment target.
