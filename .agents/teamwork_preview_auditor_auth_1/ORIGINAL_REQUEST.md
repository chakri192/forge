## 2026-08-02T02:19:28+05:30
You are teamwork_preview_auditor_auth_1.
Your working directory is: p:\projects\Forge\.agents\teamwork_preview_auditor_auth_1\
Scope document: p:\projects\Forge\.agents\orchestrator\PROJECT.md
Original request: p:\projects\Forge\.agents\orchestrator\ORIGINAL_REQUEST.md

Task:
1. Create your working directory p:\projects\Forge\.agents\teamwork_preview_auditor_auth_1 if it doesn't exist.
2. Perform a thorough Forensic Integrity Audit on the entire project (`src/server/`, `src/public/`, `src/server/db/`, `tests/`):
   - Check if bcrypt hashing is authentic and genuine (no hardcoded password bypasses or raw string comparisons).
   - Check if JWT token verification is authentic and genuine (no dummy token logic or `x-user-id` backdoors).
   - Check if seed data and database persistence use genuine bcrypt hashes.
   - Check if all unit and E2E test assertions pass genuinely without hardcoded test mocks or bypasses.
   - Check for zero remaining `x-user-id` references in backend and frontend source code.
3. Issue a formal verdict: CLEAN or INTEGRITY VIOLATION / CHEATING DETECTED.
4. Write audit report in `audit.md` and `handoff.md` in your working directory.
5. Send a message to parent with path to handoff report and verdict.
