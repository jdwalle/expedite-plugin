---
name: research
description: >
  This skill should be used when the user wants to "research the questions",
  "gather evidence", "investigate questions", "run research", "start research phase",
  or needs to dispatch parallel research agents to gather evidence for scoped questions.
allowed-tools:
  - Read
  - Write
  - Bash
  - Glob
  - Grep
  - Task
  - AskUserQuestion
  - WebSearch
  - WebFetch
---

Current lifecycle state:
!`cat .expedite/state.yml 2>/dev/null || echo "No active lifecycle"`

# Research Skill

> Under development. Core orchestration in Phase 5, quality/synthesis in Phase 6.

**Purpose:** Dispatch parallel subagents to gather evidence for scoped questions.

**Requires:** Completed scope (`/expedite:scope`).

**Next:** After research, run `/expedite:design`.
