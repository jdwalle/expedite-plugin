---
phase: 39-p1-audit-fixes
plan: 01
subsystem: lifecycle-engine
tags: [skill-instructions, state-tracking, checkpoint, status-skill, research-skill, agent-dispatch]

# Dependency graph
requires:
  - phase: 38-p0-audit-fixes
    provides: "P0 audit fixes (AUD-001 through AUD-007) establishing split-file patterns"
provides:
  - "current_step removed from state.yml across all 6 active skills"
  - "Status skill with complete 14-phase lifecycle coverage"
  - "Research steps renumbered contiguously 1-14"
  - "research_round standardized to questions.yml"
  - "Agent dispatch placeholders fully enumerated"
  - "Stateless sufficiency-evaluator"
affects: [status-skill, research-skill, execute-skill, session-summary]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "checkpoint.yml as sole step position source (replacing redundant current_step in state.yml)"
    - "questions.yml as canonical location for research_round"
    - "Explicit agent dispatch placeholder enumeration in skill instructions"

key-files:
  created: []
  modified:
    - "skills/scope/SKILL.md"
    - "skills/research/SKILL.md"
    - "skills/design/SKILL.md"
    - "skills/plan/SKILL.md"
    - "skills/spike/SKILL.md"
    - "skills/execute/SKILL.md"
    - "skills/status/SKILL.md"
    - "hooks/lib/session-summary.js"
    - "agents/sufficiency-evaluator.md"

key-decisions:
  - "Superseded decision [31-01] to preserve research step numbers for backward compatibility -- no real-world checkpoints exist"
  - "checkpoint.yml is now the sole source of step position data; state.yml no longer carries current_step"
  - "plan_complete routing in status skill changed from execute to spike (matching actual lifecycle flow)"

patterns-established:
  - "Step tracking boilerplate: backup state.yml + write checkpoint.yml (no current_step in state.yml)"
  - "Agent dispatch sections enumerate all placeholder fields with explicit source locations"

requirements-completed: [AUD-008, AUD-009, AUD-011, AUD-014, AUD-015, AUD-016, AUD-018, AUD-019, AUD-020]

# Metrics
duration: 7min
completed: 2026-03-18
---

# Phase 39 Plan 01: P1 Audit Fixes (Skill Instructions) Summary

**Remove redundant current_step from state.yml, add 3 missing lifecycle phases to status skill, renumber research steps 1-14, redirect research_round to questions.yml, add backup-before-write guards, enumerate agent dispatch placeholders, and make sufficiency-evaluator stateless**

## Performance

- **Duration:** 7 min
- **Started:** 2026-03-18T02:31:27Z
- **Completed:** 2026-03-18T02:38:47Z
- **Tasks:** 2
- **Files modified:** 9

## Accomplishments
- Removed current_step from state.yml writes across all 6 active skills (scope, research, design, plan, spike, execute) -- checkpoint.yml is now the sole step position source
- Added spike_in_progress, spike_complete, and execute_complete to status skill's phase ordering, descriptions, and routing (3 parallel structures)
- Renumbered research steps from non-contiguous (1-5,9,11-18) to contiguous (1-14) with all cross-references updated
- Redirected research_round writes from state.yml to questions.yml in both research skill and status skill
- Added backup-before-write guards to execute Steps 5d and 6, and research Step 8
- Enumerated all agent dispatch placeholder fields for task-implementer and web/codebase-researcher
- Removed memory: project from sufficiency-evaluator to prevent evaluation bias

## Task Commits

Each task was committed atomically:

1. **Task 1: Remove current_step, fix status skill, redirect research_round (AUD-008, AUD-009, AUD-011, AUD-014)** - `907db4b` (fix)
2. **Task 2: Renumber research steps, add backups, enumerate dispatches, remove memory (AUD-015, AUD-016, AUD-018, AUD-019, AUD-020)** - `5566dc0` (fix)

## Files Created/Modified
- `skills/scope/SKILL.md` - Remove current_step from step tracking boilerplate and 4 inline references
- `skills/research/SKILL.md` - Remove current_step, fix backup path (AUD-011), redirect research_round to questions.yml, renumber steps 1-14, add backup-before-write to Step 8, enumerate researcher dispatch placeholders
- `skills/design/SKILL.md` - Remove current_step from step tracking boilerplate and Steps 3, 10
- `skills/plan/SKILL.md` - Remove current_step from step tracking boilerplate and Steps 3, 9
- `skills/spike/SKILL.md` - Remove current_step from step tracking boilerplate and Step 9
- `skills/execute/SKILL.md` - Remove current_step from step tracking boilerplate and Steps 6, 7; add backup-before-write to Steps 5d, 6; enumerate task-implementer dispatch placeholders in Step 5b
- `skills/status/SKILL.md` - Add questions.yml injection; source step position from checkpoint.yml; add spike_in_progress/spike_complete/execute_complete to Steps 5, 6, 7; update research total to 14; fix plan_complete routing to spike
- `hooks/lib/session-summary.js` - Update SKILL_STEP_TOTALS research from 18 to 14
- `agents/sufficiency-evaluator.md` - Remove memory: project setting

## Decisions Made
- Superseded STATE.md decision [31-01] which preserved research step numbers for backward compatibility -- no real-world lifecycles exist yet, so no checkpoints reference old numbers
- Status skill plan_complete routing changed from "Run /expedite:execute" to "Run /expedite:spike" to match the actual lifecycle flow (plan -> spike -> execute)
- checkpoint.yml confirmed as sole source of step position data; current_step in state.yml was purely redundant with checkpoint.yml's skill/step/label fields

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed plan_complete routing in status skill Step 7**
- **Found during:** Task 1 (AUD-009 status skill changes)
- **Issue:** Status skill Step 7 routed plan_complete to "Run /expedite:execute" but the actual lifecycle flow goes plan -> spike -> execute
- **Fix:** Changed routing to "Run /expedite:spike to resolve tactical decisions"
- **Files modified:** skills/status/SKILL.md
- **Verification:** Routing now matches spike skill's entry conditions
- **Committed in:** 907db4b (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Corrected an existing routing error discovered while adding the spike phases. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All 9 AUD findings in this plan are fixed (AUD-008, AUD-009, AUD-011, AUD-014, AUD-015, AUD-016, AUD-018, AUD-019, AUD-020)
- Plan 02 (39-02) handles the remaining P1 findings (JavaScript hook/gate code changes)
- Status skill now has complete lifecycle phase coverage (14 phases)
- Research skill ready for real-world use with contiguous step numbering

---
## Self-Check: PASSED

All 9 modified files verified on disk. Both task commits (907db4b, 5566dc0) verified in git log. All 6 verification criteria passed (current_step purged, status completeness, step contiguity, session-summary total, no memory, JS syntax).

---
*Phase: 39-p1-audit-fixes*
*Completed: 2026-03-18*
