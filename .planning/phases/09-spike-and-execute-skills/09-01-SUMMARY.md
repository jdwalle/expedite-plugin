---
phase: 09-spike-and-execute-skills
plan: 01
subsystem: orchestration
tags: [spike, tactical-decisions, G5-gate, Task-dispatch, traceability]

# Dependency graph
requires:
  - phase: 08-plan-skill
    provides: Plan SKILL.md pattern (9-step orchestration, G4 gate, revision cycle)
  - phase: 03-prompt-templates
    provides: 8-section XML prompt structure for subagent dispatch
provides:
  - Spike skill (skills/spike/SKILL.md) -- 9-step orchestration script with G5 structural gate
  - Spike research prompt template (skills/spike/references/prompt-spike-researcher.md) for Task() dispatch
  - /expedite:spike command auto-discoverable in Claude Code
affects: [09-spike-and-execute-skills, execute-skill]

# Tech tracking
tech-stack:
  added: []
  patterns: [judgment-based-resolution, G5-structural-gate, per-phase-spike-output]

key-files:
  created:
    - skills/spike/SKILL.md
    - skills/spike/references/prompt-spike-researcher.md
  modified: []

key-decisions:
  - "G5 gate added to spike (deviation from SPIKE-04 research which said no gate) -- plan frontmatter specifies SPIKE-06 G5 structural gate requirement"
  - "Spike exercises judgment: clear-cut TDs resolved directly, genuinely ambiguous TDs prompt user via freeform interaction"
  - "Spike research dispatched via Task() with focused prompt-spike-researcher.md (narrow scope: one TD, 200-400 words, specific recommendation)"
  - "No state.yml phase transition -- spike operates within plan_complete or execute_in_progress, output file is the only indicator"
  - "Prior-phase context loaded when spiking Phase N > 1 (SPIKE.md and PROGRESS.md from prior phase)"

patterns-established:
  - "Judgment-based resolution: LLM exercises judgment about clear-cut vs genuinely ambiguous decisions instead of mechanical binary classification"
  - "G5 structural gate: 4 MUST criteria (all TDs resolved, all steps trace, all have rationale, step count 3-8) + 3 SHOULD criteria with Recycle loop"
  - "Per-phase spike output: SPIKE.md written to .expedite/plan/phases/{slug}/ directory with per-phase tactical decision resolution"

requirements-completed: [SPIKE-01, SPIKE-02, SPIKE-03, SPIKE-04, SPIKE-05, SPIKE-06]

# Metrics
duration: 4min
completed: 2026-03-06
---

# Phase 09 Plan 01: Spike Skill Summary

**9-step spike skill with judgment-based TD resolution, G5 structural gate, and focused research Task() dispatch for per-phase tactical decision investigation**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-06T22:27:10Z
- **Completed:** 2026-03-06T22:31:22Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Created spike skill as 7th Expedite skill, auto-discoverable via /expedite:spike
- Implemented 9-step orchestration script (392 lines) with G5 structural gate validation
- Created focused research prompt template (103 lines) for Task() dispatch on individual tactical decisions
- Spike exercises judgment: resolves clear-cut TDs directly, asks user for genuinely ambiguous TDs, supports optional research via Task() subagent

## Task Commits

Each task was committed atomically:

1. **Task 1: Create spike skill directory, SKILL.md with Steps 1-5, and prompt-spike-researcher.md** - `6ebd07b` (feat)
2. **Task 2: Append Steps 6-9 to spike SKILL.md (implementation steps, G5 gate, SPIKE.md writing, summary)** - `8e5a57b` (feat)

## Files Created/Modified
- `skills/spike/SKILL.md` - 9-step spike orchestration script (392 lines) with G5 structural gate
- `skills/spike/references/prompt-spike-researcher.md` - Focused research prompt for single tactical decision investigation via Task() dispatch (103 lines)

## Decisions Made
- G5 gate implements 4 MUST criteria (all needs-spike TDs resolved, all steps trace to TD/DA, all resolutions have rationale, step count 3-8) and 3 SHOULD criteria -- mirrors G4 pattern from plan skill
- Spike research uses sonnet model (consistent with TMPL-03 research agent model tier) via general-purpose subagent type
- Prompt-spike-researcher.md follows 7-section XML structure (role, context, downstream_consumer, instructions, output_format, quality_gate, input_data) consistent with Phase 3 templates
- Prior-phase context loading is unconditional for N > 1 phases -- spike reads prior SPIKE.md and PROGRESS.md if they exist

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Spike skill is complete and auto-discoverable as /expedite:spike in Claude Code
- Ready for Plan 02 (execute skill core pipeline) and Plan 03 (execute checkpoint/progress/completion)
- Execute skill will check for SPIKE.md existence and follow its implementation steps when available (EXEC-01)

## Self-Check: PASSED

- FOUND: skills/spike/SKILL.md
- FOUND: skills/spike/references/prompt-spike-researcher.md
- FOUND: 09-01-SUMMARY.md
- FOUND: 6ebd07b (Task 1 commit)
- FOUND: 8e5a57b (Task 2 commit)

---
*Phase: 09-spike-and-execute-skills*
*Completed: 2026-03-06*
