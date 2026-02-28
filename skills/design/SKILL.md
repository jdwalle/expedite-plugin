---
name: design
description: >
  This skill should be used when the user wants to "generate a design",
  "create design document", "design phase", "write RFC", "write PRD",
  or needs to synthesize research evidence into an implementation or product design.
  Supports --override flag to proceed despite gate warnings.
allowed-tools:
  - Read
  - Write
  - Glob
  - Bash
argument-hint: "[--override]"
---

Current lifecycle state:
!`cat .expedite/state.yml 2>/dev/null || echo "No active lifecycle"`

# Design Skill

> Under development. Full orchestration in Phase 7.

**Purpose:** Generate RFC (engineering) or PRD (product) design from research evidence.

**Requires:** Completed research (`/expedite:research`).

**Next:** After design, run `/expedite:plan`.
