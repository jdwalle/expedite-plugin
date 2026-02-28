---
name: status
description: >
  This skill should be used when the user wants to "check lifecycle status",
  "where am I", "show status", "lifecycle status", "what phase am I on",
  or needs to see the current lifecycle state, phase, progress, and recommended next action.
allowed-tools:
  - Read
  - Glob
  - Bash
---

Current lifecycle state:
!`cat .expedite/state.yml 2>/dev/null || echo "No active lifecycle"`

# Status Skill

> Under development. Full orchestration in Phase 2.

**Purpose:** Display current lifecycle phase, question status, gate history, and next action.

**Requires:** An active lifecycle (any phase).
