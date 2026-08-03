# Frontend Architecture

## Overview

The Forge frontend provides a responsive, component-driven web interface for community members to interact with activities, challenges, teams, resources, and leaderboards.

---

## Technical Specifications

- **Framework**: React 18+ (built with Vite for lightning-fast HMR and bundling).
- **Animation Engine**: **Framer Motion** (`framer-motion`) for smooth layout transitions, micro-interactions, floating cards, progress bar fills, and Reactor Bytes UI animation integration.
- **Styling Strategy**: Vanilla CSS Modules with CSS Custom Properties (Design Tokens) defined in `src/styles/theme.css`.
- **State Management**: Lightweight React Context / Custom Hooks per feature module (`src/features/*/hooks`).

---

## Architectural Guidelines

1. **Separation of UI & Logic**: UI components render props and capture events. Data fetching (using standard `fetch` API) lives in dedicated service hooks (`src/features/*/services`).
2. **Component Reusability**: Common UI elements (Buttons, Cards, Badges, Modals, Progress Indicators) live in `src/shared/components/`.
3. **Responsive & Mobile Ready**: Designed to work seamlessly across desktop, tablet, and mobile screens for all community members.
