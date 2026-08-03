# Coding Standards & Best Practices

## Overview

These coding standards apply across the entire Forge codebase. They prioritize readability, maintainability, and beginner-friendly clarity.

---

## General Rules

1. **Meaningful Naming**: Use explicit, descriptive names for variables, functions, and files (e.g., `calculateLeaderboardScore()` instead of `calc()`).
2. **Beginner-Friendly Comments**: Write clear inline comments explaining *why* complex decisions were made, not just *what* the syntax is doing.
3. **No Dead Code**: Remove unused imports, commented-out test blocks, and abandoned variables.
4. **Error Handling**: Explicitly handle errors and present user-friendly error messages instead of swallowing exceptions.

---

## File & Module Rules

- **One Concern Per File**: Keep files focused. Avoid massive 1,000-line multi-purpose files.
- **Group by Feature**: Place related logic, UI, and types within feature module directories.
- **Explicit Exports**: Avoid default exports when named exports provide clearer refactoring paths.
