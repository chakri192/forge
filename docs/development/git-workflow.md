# Git Workflow & Commit Standards

## Branching Strategy

- `main`: Production-ready, verified code matching the active phase documentation.
- `feature/<feature-name>`: Short-lived branches for developing individual MVP capabilities (e.g., `feature/teams-module`, `feature/leaderboard-ui`).

---

## Commit Message Guidelines

Commit messages must be clear, concise, and explain the motivation behind changes:

```
<type>(<scope>): <short summary>

[optional description explaining motivation]
```

### Allowed Types
- `docs`: Documentation updates or additions in `docs/`.
- `feat`: Implementation of a Phase 1 MVP feature.
- `fix`: Bug fix in an existing feature.
- `refactor`: Code improvements that do not change functionality.
- `test`: Adding or updating test cases.
