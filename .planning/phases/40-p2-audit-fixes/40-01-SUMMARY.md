---
phase: 40-p2-audit-fixes
plan: 01
subsystem: infra
tags: [schema-validation, gate-scripts, code-quality, dead-code-removal]

requires:
  - phase: 39-p1-audit-fixes
    provides: P1 audit fixes completed (prerequisite audit findings resolved)
provides:
  - Clean schemas with zero nullable declarations and implicit nullability documented
  - Shared extractDAs and wordCount helpers in gate-utils.js
  - Accurate gate outcome enums (no dead values)
  - severity field on gates schema for override entries
affects: [gates, hooks, schema-validation]

tech-stack:
  added: []
  patterns:
    - "Shared gate helpers in gate-utils.js (extractDAs, wordCount) instead of per-script copies"
    - "Implicit nullable pattern documented in validate.js comment"

key-files:
  created: []
  modified:
    - hooks/lib/validate.js
    - hooks/lib/schemas/state.js
    - hooks/lib/schemas/checkpoint.js
    - hooks/lib/schemas/gates.js
    - hooks/lib/schemas/questions.js
    - hooks/lib/schemas/tasks.js
    - hooks/lib/gate-checks.js
    - hooks/validate-state-write.js
    - hooks/lib/session-summary.js
    - gates/lib/gate-utils.js
    - gates/g2-structural.js
    - gates/g3-design.js
    - gates/g4-plan.js
    - gates/g5-spike.js
    - hooks/lib/denial-tracker.js

key-decisions:
  - "Implicit nullability is by design in validate.js; nullable:true was purely decorative"
  - "G4 extractDAs updated to use consolidated {id, name} object format with da.id access"

patterns-established:
  - "Gate helper consolidation: extractDAs and wordCount live in gate-utils.js, not duplicated per-script"

requirements-completed: []

duration: 4min
completed: 2026-03-18
---

# Phase 40 Plan 01: P2 Audit Fixes - Schema/Gate Cleanup Summary

**Removed 27 decorative nullable declarations from 5 schemas, consolidated extractDAs/wordCount into gate-utils.js, cleaned gate outcome enums, and fixed 2 trivial bugs**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-18T04:03:19Z
- **Completed:** 2026-03-18T04:07:25Z
- **Tasks:** 2
- **Files modified:** 15

## Accomplishments
- Removed all `nullable: true` from 5 schema files (27 fields) with implicit nullability documented in validate.js
- Added `severity` field with `[low, medium, high]` enum to gates schema for override entries
- Consolidated `extractDAs` and `wordCount` into gate-utils.js, eliminating 4 duplicate copies across gate scripts
- Cleaned VALID_GATE_OUTCOMES (removed `no-go`, `go-with-advisory`) and PASSING_OUTCOMES (removed `go-with-advisory`)
- Removed dead `formatChecks` function and dead `fs` imports from G3/G5
- Fixed HOOK-04 missing period and session-summary truthiness bug

## Task Commits

Each task was committed atomically:

1. **Task 1: Schema cleanup and enum fixes** - `4732417` (fix)
2. **Task 2: Gate helper consolidation and dead code removal** - `621e5f2` (refactor)

## Files Created/Modified
- `hooks/lib/validate.js` - Added implicit nullability documentation comment
- `hooks/lib/schemas/state.js` - Removed nullable from 7 fields
- `hooks/lib/schemas/checkpoint.js` - Removed nullable from 7 fields
- `hooks/lib/schemas/gates.js` - Removed nullable from 8 fields, added severity field, cleaned VALID_GATE_OUTCOMES
- `hooks/lib/schemas/questions.js` - Removed nullable from 2 fields
- `hooks/lib/schemas/tasks.js` - Removed nullable from 3 fields
- `hooks/lib/gate-checks.js` - Removed go-with-advisory from PASSING_OUTCOMES
- `hooks/validate-state-write.js` - Fixed missing period in HOOK-04 denial message
- `hooks/lib/session-summary.js` - Fixed truthiness check to explicit null check
- `gates/lib/gate-utils.js` - Added extractDAs, wordCount; removed formatChecks; added architectural comment
- `gates/g2-structural.js` - Removed local extractDAs/wordCount, use utils.*
- `gates/g3-design.js` - Removed local extractDAs/wordCount, removed dead fs import, use utils.*
- `gates/g4-plan.js` - Removed local extractDAs, updated M2 loop to use da.id
- `gates/g5-spike.js` - Removed local wordCount, removed dead fs import, use utils.*
- `hooks/lib/denial-tracker.js` - Added reserved-use comment to clearDenials

## Decisions Made
- Implicit nullability is by design in validate.js; nullable:true was purely decorative and never read by the validation engine
- G4 extractDAs updated to use the consolidated {id, name} object format, requiring da.id access in the M2 loop

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All 12 P2 audit findings addressed (AUD-022 through AUD-034)
- Gate scripts load cleanly with shared helpers
- Ready for 40-02 (remaining P2 findings) if applicable

## Self-Check: PASSED

All key files exist and both task commits verified.

---
*Phase: 40-p2-audit-fixes*
*Completed: 2026-03-18*
