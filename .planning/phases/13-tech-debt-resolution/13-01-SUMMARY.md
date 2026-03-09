---
phase: 13-tech-debt-resolution
plan: 01
subsystem: skills
tags: [crash-resume, state-machine, SKILL.md, Step-1]

# Dependency graph
requires:
  - phase: 12-audit-tech-debt-cleanup
    provides: "Override re-entry Case B pattern (--override + gate_history recycle)"
  - phase: 04-scope-skill
    provides: "Resume pattern (Case B) for scope_in_progress in scope SKILL.md Step 1"
provides:
  - "Mid-phase crash resume for research SKILL.md (research_in_progress -> decision tree resume)"
  - "Mid-phase crash resume for design SKILL.md (design_in_progress without --override -> artifact check resume)"
  - "Mid-phase crash resume for plan SKILL.md (plan_in_progress without --override -> artifact check resume)"
affects: [13-02-PLAN.md]

# Tech tracking
tech-stack:
  added: []
  patterns: ["Crash resume via artifact existence checks (no new state fields)"]

key-files:
  created: []
  modified:
    - "skills/research/SKILL.md"
    - "skills/design/SKILL.md"
    - "skills/plan/SKILL.md"

key-decisions:
  - "Research resume uses 5-branch decision tree (research_round + multiple artifact checks) due to 18-step complexity"
  - "Design/plan resume uses simpler single-artifact check (DESIGN.md/PLAN.md existence) since they have one primary artifact"
  - "Design/plan Case B2 checks gate_history for recycle evidence and offers dual options (resume vs --override) when found"
  - "No AskUserQuestion for design/plan resume (just proceed) -- matches execute pattern for simpler artifact-centric skills"
  - "Research resume uses AskUserQuestion with Continue/Start over -- matches scope pattern for complex multi-step skills"

patterns-established:
  - "Case B2 pattern: *_in_progress without --override = crash resume (discriminated from Case B override re-entry by --override flag)"
  - "Resume skips Step 3 (state transition) since state is already *_in_progress"

requirements-completed: [STATE-06]

# Metrics
duration: 2min
completed: 2026-03-09
---

# Phase 13 Plan 01: Mid-Phase Crash Resume Summary

**Crash resume logic added to research/design/plan SKILL.md Step 1 so *_in_progress re-invocation resumes at correct step instead of rejecting with misleading error**

## Performance

- **Duration:** 2min
- **Started:** 2026-03-09T16:19:28Z
- **Completed:** 2026-03-09T16:21:49Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Research SKILL.md Step 1 now handles research_in_progress with a 5-branch decision tree that determines resume step from research_round value and artifact existence (evidence files, sufficiency-results.yml, SYNTHESIS.md)
- Design SKILL.md Step 1 now handles design_in_progress (without --override) as crash resume, checking DESIGN.md existence to determine resume at Step 2 or Step 7
- Plan SKILL.md Step 1 now handles plan_in_progress (without --override) as crash resume, checking PLAN.md existence to determine resume at Step 2 or Step 6
- All existing override re-entry logic (Case B with --override + gate_history recycle) preserved unchanged

## Task Commits

Each task was committed atomically:

1. **Task 1: Add crash resume Case B to research SKILL.md Step 1** - `cf2926e` (feat)
2. **Task 2: Add crash resume Case B2 to design and plan SKILL.md Step 1** - `0b0679f` (feat)

## Files Created/Modified
- `skills/research/SKILL.md` - Added Case B (research_in_progress resume with 5-branch decision tree) and Case C (error), restructured from original 2-case to 3-case Step 1
- `skills/design/SKILL.md` - Added Case B2 (design_in_progress crash resume with DESIGN.md artifact check), updated Case C label
- `skills/plan/SKILL.md` - Added Case B2 (plan_in_progress crash resume with PLAN.md artifact check), updated Case C label

## Decisions Made
- Research resume uses AskUserQuestion with Continue/Start over (matching scope pattern) because research has 18 steps and a complex multi-round structure where restarting is a reasonable choice
- Design/plan resume proceeds directly without AskUserQuestion (matching execute pattern) because they have a single primary artifact and simpler flow
- Design/plan Case B2 checks for gate_history G2/G3 recycle evidence and offers dual options when found (resume vs suggest --override), since a user in design_in_progress after a G2 recycle might want either path

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All 3 skills now handle crash resume, bringing them into parity with scope and execute
- Ready for 13-02 (remove dead *_recycled status mappings + add Glob fallback to research inline references)

## Self-Check: PASSED

- All 3 modified files exist on disk
- Both task commits (cf2926e, 0b0679f) found in git log
- SUMMARY.md created at expected path

---
*Phase: 13-tech-debt-resolution*
*Completed: 2026-03-09*
