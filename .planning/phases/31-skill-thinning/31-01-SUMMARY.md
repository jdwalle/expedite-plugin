---
phase: 31-skill-thinning
plan: 01
subsystem: skills
tags: [step-sequencer, skill-thinning, gates-yml, agent-dispatch, scope, research]

# Dependency graph
requires:
  - phase: 30-agent-formalization/01
    provides: "8 agent definition files with frontmatter for dispatch"
  - phase: 30-agent-formalization/02
    provides: "Skills wired to dispatch agents by name via Agent tool"
provides:
  - "Thinned scope skill (255 lines) as step sequencer with G1 gate writing to gates.yml"
  - "Thinned research skill (170 lines) as step sequencer + agent dispatcher with G2 gate writing to gates.yml"
  - "Established skill-thinning pattern replicable for remaining skills in Plan 02"
  - "Fixed INT-01: gate write path now goes to gates.yml (not state.yml gate_history)"
affects: [31-02-remaining-skill-thinning, 31-03-integration-verification, 33-gate-verifier-validation]

# Tech tracking
tech-stack:
  added: []
  patterns: [step-sequencer-skill-pattern, compressed-step-tracking-reference, gate-result-to-gates-yml, agent-output-validation-on-return]

key-files:
  created: []
  modified:
    - skills/scope/SKILL.md
    - skills/research/SKILL.md

key-decisions:
  - "Compressed step-tracking and checkpoint boilerplate to a single shared reference at top of skill, eliminating ~100 lines per skill"
  - "Gate results written to .expedite/gates.yml with append semantics (read existing, append new entry to history array)"
  - "Research skill consolidated 18 steps to ~10 steps while preserving original step numbers for checkpoint/resume compatibility"
  - "Agent output validation added after every dispatch: verify expected artifact exists on disk before updating state"
  - "Sufficiency evaluator retains Task() dispatch with Phase 31 TODO comment (not yet a named agent)"

patterns-established:
  - "Step-sequencer pattern: shared step-tracking/checkpoint reference at top, compressed step bodies, agent dispatch by name"
  - "Gate write pattern: skills write to gates.yml (not state.yml), read-then-append to preserve history"
  - "Agent output validation: after dispatch return, verify artifact exists on disk before state update"
  - "Step number preservation: merged steps keep original numbers for resume/checkpoint compatibility"

requirements-completed: [THIN-01, THIN-02, THIN-03, THIN-04, THIN-05, THIN-06]

# Metrics
duration: 4min
completed: 2026-03-16
---

# Phase 31 Plan 01: Skill Thinning Summary

**Scope (911->255 lines) and research (1157->170 lines) skills refactored to step-sequencer pattern with G1/G2 gate results redirected to gates.yml, fixing INT-01 integration debt**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-16T01:29:24Z
- **Completed:** 2026-03-16T01:33:35Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Reduced scope skill from 911 to 255 lines (72% reduction) while retaining all 10 steps as step sequencer
- Reduced research skill from 1157 to 170 lines (85% reduction) with agent dispatch by name via Agent tool
- Redirected G1 and G2 gate result writes from state.yml gate_history to .expedite/gates.yml, fixing the INT-01 integration debt that blocked gated phase transitions
- Added agent output validation after every dispatch in research skill (THIN-05)
- Established replicable thinning pattern for remaining skills in Plan 02

## Task Commits

Each task was committed atomically:

1. **Task 1: Thin scope skill and redirect G1 gate writes** - `31013fd` (feat)
2. **Task 2: Thin research skill, redirect G2 gate writes, validate agent dispatch** - `e1859bc` (feat)

## Files Created/Modified
- `skills/scope/SKILL.md` - Thinned scope step sequencer (255 lines, was 911)
- `skills/research/SKILL.md` - Thinned research step sequencer + agent dispatcher (170 lines, was 1157)

## Decisions Made
- Compressed step-tracking and checkpoint boilerplate to a single shared reference pattern at top of each skill file, saving ~100 lines per skill
- Research skill consolidated from 18 steps to ~10 functional steps while preserving original step numbers (4, 5, 9, 11, 12, 13, 14, 15, 16, 17, 18) for checkpoint/resume backward compatibility
- Gate results use read-then-append semantics on gates.yml to preserve G1 entry when G2 is added later
- Sufficiency evaluator kept on Task() dispatch (not yet a named agent) per Phase 30 decision -- Phase 31 TODO comment preserved

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Skill-thinning pattern established and verified on the two most complex skills (scope and research)
- Pattern can be replicated for design, plan, spike, and execute skills in Plan 02
- gates.yml write path is fixed for G1 and G2; remaining gates (G3-G5) will follow same pattern when their skills are thinned
- INT-01 blocker resolved: gated transitions will work without EXPEDITE_HOOKS_DISABLED once skills write to gates.yml

## Self-Check: PASSED

All files verified present (skills/scope/SKILL.md, skills/research/SKILL.md, 31-01-SUMMARY.md). Both task commits (31013fd, e1859bc) verified in git log.

---
*Phase: 31-skill-thinning*
*Completed: 2026-03-16*
