---
name: plan
description: >
  This skill should be used when the user wants to "generate a plan",
  "create implementation plan", "plan phase", "decompose tasks",
  "break down into tasks", or needs to decompose a design into an ordered
  implementation plan. Supports --override flag.
allowed-tools:
  - Read
  - Write
  - Glob
  - Bash
argument-hint: "[--override]"
---

Current lifecycle state:
!`cat .expedite/state.yml 2>/dev/null || echo "No active lifecycle"`

# Plan Skill

> Under development. Full orchestration in Phase 8.

**Purpose:** Decompose design into wave-ordered tasks (engineering) or epics/stories (product).

**Requires:** Completed design (`/expedite:design`).

**Next:** After plan, run `/expedite:execute`.
