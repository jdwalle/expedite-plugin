---
phase: 18-gate-enforcement
plan: 02
subsystem: quality-gates
tags: [gate-enforcement, SHOULD-criteria, depth-calibration, ambiguity-resolution, G4, G5]

# Dependency graph
requires:
  - phase: 18-gate-enforcement
    provides: "G2/G3 MUST criteria from plan 01 (if executed), research establishing MUST vs SHOULD distinction"
provides:
  - "G4 gate S5: depth calibration task coverage check (SHOULD)"
  - "G5 gate S4: ambiguity resolution specificity check (SHOULD)"
affects: [plan-skill, spike-skill, gate-enforcement]

# Tech tracking
tech-stack:
  added: []
  patterns: ["SHOULD criteria for judgment-adjacent checks on structural gates"]

key-files:
  created: []
  modified:
    - skills/plan/SKILL.md
    - skills/spike/SKILL.md

key-decisions:
  - "S5 uses task count as heuristic for depth -- advisory-only to avoid punishing valid plan structures"
  - "S4 tolerates brief rationale for clear-cut TDs -- only flags when rationale omits the specific ambiguity"

patterns-established:
  - "SHOULD criteria for gate checks that involve moderate judgment on otherwise structural gates"
  - "Clarifying notes after SHOULD criteria tables to prevent over-penalization"

requirements-completed: [GATE-03, GATE-04]

# Metrics
duration: 2min
completed: 2026-03-11
---

# Phase 18 Plan 02: G4/G5 SHOULD Criteria Summary

**G4 S5 depth calibration check and G5 S4 ambiguity resolution check added as SHOULD (advisory-only) criteria to preserve structural gate nature**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-11T04:43:27Z
- **Completed:** 2026-03-11T04:45:01Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Added S5 to G4 gate (plan/SKILL.md): checks that Deep DAs are not covered by fewer tasks than Light DAs, using SCOPE.md depth calibration
- Added S4 to G5 gate (spike/SKILL.md): checks that spike resolution rationale addresses the specific ambiguity described in each needs-spike TD
- Both criteria are SHOULD (advisory-only), preserving the structural nature of G4 and G5 gates
- Added clarifying notes to both gates to prevent over-penalization (heuristic limitation for S5, clear-cut TD tolerance for S4)

## Task Commits

Each task was committed atomically:

1. **Task 1: Add S5 depth calibration criterion to G4 gate** - `b5a5ff0` (feat)
2. **Task 2: Add S4 ambiguity resolution criterion to G5 gate** - `f963ca9` (feat)

## Files Created/Modified
- `skills/plan/SKILL.md` - Added S5 row to SHOULD criteria table, clarifying note, and S5 display format line in G4 gate section
- `skills/spike/SKILL.md` - Added S4 row to SHOULD criteria table (3-column format) and clarifying note in G5 gate section

## Decisions Made
- S5 uses "no Deep DA has fewer tasks than any Light DA" as the check (simple comparison, not numeric thresholds), consistent with research recommendation
- S4 explicitly allows brief rationale for clear-cut TDs, only flagging when rationale does not mention the ambiguity at all, consistent with research pitfall P5 guidance

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- G4 gate now has 5 MUST + 5 SHOULD criteria (M1-M5, S1-S5)
- G5 gate now has 4 MUST + 4 SHOULD criteria (M1-M4, S1-S4)
- All existing criteria, gate outcome routing, telemetry logging, and gate history recording are unchanged
- Phase 18 gate enforcement criteria are fully implemented across G4 and G5

## Self-Check: PASSED

All files verified present. All commits verified in git log. Content verification confirmed correct criteria counts (plan: 5M+5S, spike: 4M+4S).

---
*Phase: 18-gate-enforcement*
*Completed: 2026-03-11*
