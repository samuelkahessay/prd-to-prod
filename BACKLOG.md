# Backlog

## Inbox

- 2026-03-21 [bug] Factory celebration fires on provisioning complete, should fire on target repo pipeline complete
- 2026-03-21 [bug] OAuth grant TTL too short (10 min, should be 30-60 min for real users)
- 2026-03-21 [bug] Skip /finalize for already-ready sessions (400 error flash before provisioning)
- 2026-03-21 [infra] Scaffold golden file (expected-tree.txt) is fragile — consider automating regeneration
- 2026-03-21 [feature] Build route redesign: gate order should be access code -> BYOK -> chat
- 2026-03-21 [feature] Credential persistence for returning users (don't re-enter Copilot token)
- 2026-03-21 [infra] File upstream gh-aw issues (#040, #041, #042, #043)
- 2026-03-21 [feature] Private repos as a user configuration option (currently public for free Actions minutes)
- 2026-03-22 [upstream] gh-aw CLI should expose more info on run status for workflows — `gh run view` only shows status/conclusion, no step-level detail or agent output. File as gh-aw upstream issue.
- 2026-03-23 [upstream] gh-aw safe-outputs prompt says "exactly one safe-output tool" even when workflow config allows multiple calls (max: 20). Causes ~50% decomposer no-ops. **Filed: github/gh-aw#22364**
- 2026-03-23 [infra] Auto-dispatch guard blocks new issue dispatches when stale repo-assist runs (from issue_comment events) are still in_progress. Causes semi-autonomous gap — need to either shorten comment-triggered run lifetime or make the guard smarter.
- 2026-03-23 [infra] Pull old gh-aw upstream findings from T9 Samsung SSD — previous findings data may be on external drive, not in current repo.

## Issued

## Done
