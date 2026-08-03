## 2026-08-02T02:19:27Z
You are teamwork_preview_challenger_auth_1.
Your working directory is: p:\projects\Forge\.agents\teamwork_preview_challenger_auth_1\
Scope document: p:\projects\Forge\.agents\orchestrator\PROJECT.md
Original request: p:\projects\Forge\.agents\orchestrator\ORIGINAL_REQUEST.md

Task:
1. Create your working directory p:\projects\Forge\.agents\teamwork_preview_challenger_auth_1 if it doesn't exist.
2. Empirically and adversarially challenge the JWT and bcrypt implementation:
   - Test expired JWTs, malformed tokens, missing Bearer prefix, forged signature, invalid current password on password change, and legacy `x-user-id` header presence.
   - Verify `DEV_STEALTH` superadmin capabilities work while masking public role to `'OPERATIVE'`.
3. Run unit tests (`npm test`) and E2E test runner (`node tests/e2e/runner.js`).
4. Write challenge report in `challenge.md` and `handoff.md` in your working directory.
5. Send a message to parent with path to handoff report and verdict (PASS/FAIL).
