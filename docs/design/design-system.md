# Design System & UI Tokens

## Overview

The Forge Design System ensures visual consistency, modern glassmorphism aesthetics, fluid Framer Motion animations, and ease of maintenance across all UI screens.

---

## Design Tokens (CSS Variables Baseline)

```css
:root {
  /* Color Palette - Modern Slate/Cyan Accent Baseline */
  --bg-primary: #0b0f19;
  --bg-secondary: #111827;
  --bg-card: rgba(30, 41, 59, 0.7);
  --bg-card-hover: rgba(51, 65, 85, 0.8);
  
  --border-card: rgba(255, 255, 255, 0.1);
  --border-glow: rgba(56, 189, 248, 0.4);
  
  --text-primary: #f8fafc;
  --text-secondary: #94a3b8;
  --text-muted: #64748b;
  
  --accent-primary: #38bdf8;
  --accent-hover: #0284c7;
  --accent-success: #22c55e;
  --accent-warning: #f59e0b;
  
  /* Typography */
  --font-family: 'Inter', system-ui, -apple-system, sans-serif;
  --font-size-sm: 0.875rem;
  --font-size-base: 1rem;
  --font-size-lg: 1.25rem;
  --font-size-xl: 1.5rem;
  --font-size-2xl: 2rem;
  
  /* Spacing */
  --space-xs: 0.25rem;
  --space-sm: 0.5rem;
  --space-md: 1rem;
  --space-lg: 1.5rem;
  --space-xl: 2rem;
  
  /* Borders & Glassmorphism */
  --radius-sm: 6px;
  --radius-md: 10px;
  --radius-lg: 16px;
  --backdrop-blur: blur(12px);
  --shadow-card: 0 8px 32px 0 rgba(0, 0, 0, 0.37);
}
```

---

## Animation Guidelines (Framer Motion)

- **Hover Effects**: Scale `1.02` with slight `$Y`-axis lift (`translateY(-2px)`) and border glow transition.
- **Page Transitions**: Smooth fade-in (`opacity: 0 -> 1`) and subtle slide-up (`y: 10 -> 0`).
- **Leaderboard Ranks**: Animated list reordering using Framer Motion `layout` prop.
- **Progress Bars**: Smooth fill animations using `spring` physics.
