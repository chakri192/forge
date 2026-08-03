# User Flows

This document details key step-by-step user journeys within **Forge** for Phase 1.

---

## 1. Member Login Flow

```
[ Member Visits Forge ] -> [ Enters Assigned Credentials ] -> [ Server Validates Session ] -> [ Redirects to Main Dashboard ]
```

1. Member opens the Forge web app.
2. Member enters their pre-assigned email and password.
3. Upon authentication, an HTTP-only session cookie is set and the member lands on the primary community dashboard.

---

## 2. Activity Completion & Progress Tracking Flow

```
[ Browse Activities ] -> [ Select Activity ] -> [ Complete Task ] -> [ Click 'Mark Complete' ] -> [ System Updates Progress & Leaderboard ]
```

1. Member browses the Learning Activities list.
2. Member selects an activity to review instructions and attached resource links.
3. Member completes the work and clicks "Mark Complete".
4. System records completion status and updates leaderboard rankings.

---

## 3. Resource Access & Attachment Upload Flow

```
[ Open Resource Repository ] -> [ Filter by Category / Feature ] -> [ Download Material or Upload Evidence File ]
```

1. Member navigates to Resources section.
2. Member filters materials by category (e.g. documentation, tools, challenge attachments).
3. Member downloads files or uploads completed challenge attachments directly via Express file streaming.
