---
name: execute
description: >
  This skill should be used when the user wants to "execute the plan",
  "run the plan", "implement", "build it", "start building",
  or needs to execute implementation plan tasks sequentially in the current session.
allowed-tools:
  - Read
  - Write
  - Edit
  - Glob
  - Grep
  - Bash
  - WebSearch
  - WebFetch
---

Current lifecycle state:
!`cat .expedite/state.yml 2>/dev/null || echo "No active lifecycle"`

# Execute Skill

> Under development. Full orchestration in Phase 9.

**Purpose:** Execute plan tasks sequentially with checkpoint/resume support.

**Requires:** Completed plan (`/expedite:plan`).

**Next:** Lifecycle complete after execution.
