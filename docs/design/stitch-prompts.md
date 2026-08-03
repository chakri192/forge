# UI Screens Catalog & Master Stitch MCP Generation Prompts

This document serves as the master prompt blueprint for generating, editing, and updating all web pages for **Forge**.

> [!IMPORTANT]
> **HTML Workflow Instructions**:
> 1. Use the Stitch MCP prompts below to generate the initial HTML/CSS versions of each screen.
> 2. Save the raw generated HTML files into `P:\projects\Forge\docs\design\initial\`.
> 3. We will copy the exact generated HTML files to `src/public/` for API integration and ES module JS wiring.
> 4. Whenever UI changes or new direct edits are made to the pages in `initial/`, the prompts in this document will be updated to remain in 100% sync.

---

## Global Design System & Abstract Color Accent Tokens

```markdown
GLOBAL DESIGN SYSTEM PROMPT:
Design a clean, minimalist, modern web interface for 'Forge' - a private learning community platform.

Design Principles:
1. Aesthetic: Minimalist, spacious, clean layout with subtle 1px translucent borders. No emojis anywhere on the UI; use clean, elegant minimalist SVG icons. NO visible 'Operation Overthink' or 'Shadow Lead / Dev Mode' text anywhere.
2. Micro-Animations: Smooth CSS/JS transitions (hover lifts, spring progress fills, card highlights). Keep animations subtle and elegant.
3. Typography: Clean sans-serif ('Inter'), crisp line-height, bold section headings.
4. Top Navigation Bar: Includes brand title 'FORGE', navigation tabs (Dashboard, Tasks & Marketplace, Teams, Hall of Fame), and user profile badge.

Abstract Color Accent Tokens (Dynamic Accent Customization):
- Light Mode Palette:
  --bg-base: #f3f8f2 (Soft Sage White Canvas)
  --text-main: #191919 (Deep Obsidian Text)
  --accent-1: #ff8484 (Warm Coral Accent)
  --accent-2: #2374ab (Royal Slate Blue Accent)
- Dark Mode Palette:
  --bg-base: #333333 (Charcoal Canvas)
  --text-main: #ffffff (Pure White Text)
  --accent-1: #666a86 (Muted Slate Accent)
  --accent-2: #95b8d1 (Soft Ice Blue Accent)
  --accent-3: #e8ddb5 (Warm Cream Gold Accent)
```

---

## Master Screen Prompts Catalog

### Screen 1: Cohort Overview Dashboard (`/`)

- **Purpose**: Primary overview displaying active sprint progress, current team assignment card, recent tasks summary, and user profile header.
- **Key UI Elements**: Sprint 01 progress bar (60% complete), active team summary card, 3 assigned task cards with point badges, clean navigation bar, theme toggle button.

#### Light Mode Stitch Prompt
```text
A minimalist, ultra-clean Light Mode web dashboard for 'Forge'. Background soft sage white (#f3f8f2) with deep obsidian text (#191919). Top header features crisp text title 'FORGE', navigation tabs (Dashboard, Tasks & Marketplace, Teams, Hall of Fame), user profile card with user tag ('Code Ninja'), and a minimalist theme toggle button. Main section displays a progress card 'Active Sprint 01: Core Platform Launch' with a royal slate blue (#2374ab) progress bar (60% complete), 3 active task cards with warm coral (#ff8484) point badges, and a right-sidebar summary widget showing active team roster. Clean line borders (rgba(25,25,25,0.12)), subtle drop shadows, and clean SVG icons. NO emojis anywhere.
```

#### Dark Mode Stitch Prompt
```text
A sleek, modern Dark Mode web dashboard for 'Forge'. Deep charcoal canvas (#333333) with clean pure white text (#ffffff). Top header with crisp text title 'FORGE', navigation tabs (Dashboard, Tasks & Marketplace, Teams, Hall of Fame), and user tag badge ('Code Ninja'). Hero banner displays 'Active Sprint 01: Core Platform Launch' with a soft ice blue (#95b8d1) progress bar. 3 dark glass cards below display assigned tasks with muted slate (#666a86) point badges and interactive 'Submit Task Proof' buttons. Right sidebar features a dark team status card with warm cream gold (#e8ddb5) accent highlights. Clean line borders (rgba(255,255,255,0.12)), hover lift transitions, and minimalist typography. NO emojis.
```

---

### Screen 2: Tasks & Task Marketplace Page (`/tasks`)

- **Purpose**: Dual-section page featuring official assigned tasks and a student Task Marketplace where members suggest task ideas and upvote suggestions.
- **Key UI Elements**: Tab switcher ('Official Tasks' vs 'Task Marketplace'), task cards with point values, upvote button with counter (`▲ Upvote (14)`), proof upload modal trigger, '+ Suggest Marketplace Task' button.

#### Light Mode Stitch Prompt
```text
A clean Light Mode tasks page for 'Forge' on soft sage background (#f3f8f2). Header displays title 'Tasks & Marketplace' with a primary button '+ Suggest Marketplace Task' in royal slate blue (#2374ab). Section 1 shows 'Official Assigned Tasks' in a 3-column grid of white cards (#ffffff) displaying task title, point badge ('50 PTS' in #2374ab), status badge ('IN_PROGRESS' in #ff8484), and a 'Submit Task Proof' button. Section 2 shows 'Task Marketplace (Student Upvote Board)' displaying student-suggested task cards with a warm coral (#ff8484) upvote button with count ('▲ Upvote (14)'). Minimalist white containers, clean SVG icons, crisp typography. NO emojis.
```

#### Dark Mode Stitch Prompt
```text
A modern Dark Mode tasks and marketplace page for 'Forge'. Dark charcoal canvas (#333333) with dark card containers (rgba(20,20,20,0.75)). Header displays title 'Tasks & Marketplace' with an ice blue (#95b8d1) button '+ Suggest Marketplace Task'. Official tasks grid displays task cards with muted slate (#666a86) point tags and submission controls. Task Marketplace section features student idea cards with warm cream gold (#e8ddb5) upvote counters ('▲ Upvote (14)'). Clean SVG icons, translucent borders, and hover lift transitions. NO emojis.
```

---

### Screen 3: Teams & Captain Management Page (`/teams`)

- **Purpose**: Roster view of active 4-member teams, assigned Team Captain badges, dynamic point percentage share controls, and auto-dissolution status.
- **Key UI Elements**: Team cards (e.g. 'Alpha Squad', 'Beta Innovators'), Team Captain badge (`Captain: Alex`), member roster list with percentage point shares (`120% Share`, `80% Share`), team task assignment badge.

#### Light Mode Stitch Prompt
```text
A clean Light Mode team management page for 'Forge'. Header displays 'Community Teams & Captains'. Grid of 4-member team cards (e.g. 'Alpha Squad', 'Beta Innovators'). Each team card displays team name, Team Captain badge in royal slate blue (#2374ab), assigned task title tag, and a vertical roster list of 4 members. Member list displays member name, user tag ('Code Ninja'), and a point share badge ('120% Share' in #ff8484). Minimalist sage white containers (#f3f8f2), dark text (#191919), and clean SVG icons. NO emojis.
```

#### Dark Mode Stitch Prompt
```text
A sleek Dark Mode team roster layout for 'Forge'. Dark charcoal canvas (#333333) featuring dark team card containers. Team headers highlight Team Captains with soft ice blue (#95b8d1) badges. Member list displays individual task contribution percentages ('120% Share' in warm cream gold #e8ddb5) and point share controls. Muted slate (#666a86) borders, clean line dividers, and minimalist design. NO emojis.
```

---

### Screen 4: The Hall of Fame Page (`/hall-of-fame`)

- **Purpose**: High-contrast realistic marble and granite themed honor hall with dual sideboards (All-Time Leaderboard & Season 1 Leaderboard) and a central Awarded Titles Wall.
- **Key UI Elements**: Realistic marble/granite texture background, left sideboard ('All-Time Leaderboard'), right sideboard ('Season 1 Leaderboard'), central monument wall displaying gold-engraved title plaques (*Best Developer 2026*, *Master UI Craftsperson*, *Top Squad Sprint 01*).

#### Light Mode Stitch Prompt
```text
A high-contrast, realistic Light Marble and Granite themed 'Hall of Fame' page for 'Forge'. Polished white marble texture background with subtle grey vein textures. Top header displays 'The Hall of Fame' with subtitle 'Honoring Academic Excellence, Coding Mastery & Community Titles'. Central monument wall displays glowing golden-engraved title plaques: 'Best Developer 2026', 'Master UI Craftsperson', 'Top Squad Sprint 01'. Left sideboard features an 'All-Time Leaderboard' ranking table. Right sideboard features a 'Season 1 Leaderboard' ranking table. Gold (#e8ddb5) and royal slate blue (#2374ab) accents, realistic polished stone borders, and noble serif/sans-serif title typography. NO emojis.
```

#### Dark Mode Stitch Prompt
```text
A dramatic, high-contrast Dark Granite and Black Marble themed 'Hall of Fame' page for 'Forge'. Deep dark granite stone texture background with silver and gold vein highlights. Top header displays 'The Hall of Fame'. Central monument wall features illuminated dark stone plaques showcasing awarded titles: 'Best Developer 2026', 'Master UI Craftsperson', 'Top Squad Sprint 01'. Left sideboard displays 'All-Time Leaderboard' with soft ice blue rank numbers (#95b8d1). Right sideboard displays 'Season 1 Leaderboard' with warm cream gold rank numbers (#e8ddb5). High contrast, realistic stone texture reflections, and noble typography. NO emojis.
```
