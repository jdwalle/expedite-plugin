---
phase: 37-reference-roadmap-cleanup
plan: 01
subsystem: infra
tags: [cleanup, tech-debt, references, roadmap]

# Dependency graph
requires:
  - phase: 36-spike-g5-integration-fix
    provides: completed spike G5 flow enabling final cleanup
provides:
  - Clean reference directories with only actively-referenced files
  - Accurate ROADMAP.md checkboxes and progress table
  - Consistent gates.yml references (no stale gate_history refs)
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns: []

key-files:
  created: []
  modified:
    - skills/research/references/ref-recycle-escalation.md
    - skills/status/SKILL.md
    - .planning/ROADMAP.md

key-decisions:
  - "No decisions required -- plan executed exactly as written"

patterns-established: []

requirements-completed: []

# Metrics
duration: 2min
completed: 2026-03-17
---

# Phase 37 Plan 01: Reference & Roadmap Cleanup Summary

**Deleted 8 orphaned pre-formalization prompt templates, fixed stale gate_history references to use gates.yml, and corrected ROADMAP.md plan checkboxes and progress table formatting for all completed v3.0 phases**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-17T01:39:02Z
- **Completed:** 2026-03-17T01:41:03Z
- **Tasks:** 2
- **Files modified:** 11 (8 deleted, 3 modified)

## Accomplishments
- Deleted 8 orphaned reference files (5 research prompts, 1 research ref, 1 spike prompt, 1 design prompt) that were pre-formalization templates no longer referenced by any SKILL.md or agent definition
- Fixed ref-recycle-escalation.md to reference `.expedite/gates.yml` history array instead of stale `gate_history` field
- Fixed status SKILL.md: removed outdated v2.0 Migration comment and replaced gate_history field reference with gates.yml injection instruction
- Checked 8 plan checkboxes for completed phases 32, 34, 35, 36 in ROADMAP.md
- Fixed malformed progress table rows: added missing v3.0 milestone column, corrected plan counts

## Task Commits

Each task was committed atomically:

1. **Task 1: Delete orphaned reference files and fix stale references** - `1cbc847` (chore)
2. **Task 2: Fix ROADMAP.md plan checkboxes** - `609086b` (chore)

## Files Created/Modified
- `skills/research/references/prompt-codebase-analyst.md` - Deleted (orphaned)
- `skills/research/references/prompt-mcp-researcher.md` - Deleted (orphaned)
- `skills/research/references/prompt-research-synthesizer.md` - Deleted (orphaned)
- `skills/research/references/prompt-sufficiency-evaluator.md` - Deleted (orphaned)
- `skills/research/references/prompt-web-researcher.md` - Deleted (orphaned)
- `skills/research/references/ref-override-handling.md` - Deleted (orphaned)
- `skills/spike/references/prompt-spike-researcher.md` - Deleted (orphaned)
- `skills/design/references/prompt-design-guide.md` - Deleted (orphaned)
- `skills/research/references/ref-recycle-escalation.md` - Fixed gate_history -> gates.yml reference
- `skills/status/SKILL.md` - Removed stale migration comment, fixed gate_history reference
- `.planning/ROADMAP.md` - Checked 8 plan checkboxes, fixed progress table formatting

## Decisions Made
None - followed plan as specified.

## Deviations from Plan
None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- v3.0 milestone cleanup complete; all tech debt items (STALE-1, ORPHAN-1, roadmap checkboxes) are resolved
- No further phases planned after Phase 37

## Self-Check: PASSED

All created/modified files verified on disk. All deleted files confirmed absent. Both task commits (1cbc847, 609086b) verified in git log.

---
*Phase: 37-reference-roadmap-cleanup*
*Completed: 2026-03-17*
