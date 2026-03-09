---
phase: 04-scope-skill
plan: 02
subsystem: scope
tags: [skill, orchestration, question-plan, evidence-requirements, decision-areas, review-loop, scope-artifact]

# Dependency graph
requires:
  - phase: 04-scope-skill
    plan: 01
    provides: "Scope SKILL.md Steps 1-5: lifecycle check, initialization, Round 1 + Round 2 interactive questioning"
  - phase: 03-prompt-templates
    provides: "prompt-scope-questioning.md reference with quality criteria and intent-specific guidance"
provides:
  - "Scope SKILL.md Steps 6-8: question plan generation, source config, artifact writing"
  - "Contract chain: typed evidence requirements per question flowing to research, sufficiency evaluation, and design"
  - "SCOPE.md artifact template with DA metadata (depth, readiness) and question tables"
  - "state.yml questions array update pattern with backup-before-write"
affects: [04-03-PLAN, research-skill, sufficiency-evaluator, design-skill]

# Tech tracking
tech-stack:
  added: []
  patterns: [terraform-plan-apply-review-loop, contract-chain-evidence-requirements, data-plane-control-plane-split, self-check-before-present]

key-files:
  created: []
  modified:
    - skills/scope/SKILL.md

key-decisions:
  - "Followed plan specification verbatim -- all content for Steps 6-8 matched the plan exactly"
  - "DA-level metadata (depth, readiness) lives only in SCOPE.md (data plane), not state.yml (control plane) -- flat structure constraint"
  - "Evidence requirements enforced as concrete and checkable with GOOD/BAD examples inline"
  - "Review loop uses freeform prompts with modify/add/approve flows"

patterns-established:
  - "Terraform plan-apply: generate plan, present preview, user approves/modifies, then apply (write artifacts)"
  - "Self-check-before-present: verify against quality criteria before showing to user"
  - "Data-plane/control-plane split: SCOPE.md has rich human-readable content, state.yml has flat machine-readable data"
  - "Intent-specific branching: product shows Risks Addressed, engineering shows Concerns Addressed"

requirements-completed: [SCOPE-03, SCOPE-04, SCOPE-05, SCOPE-06, SCOPE-08, SCOPE-09, SCOPE-10, SCOPE-11, ARTF-01, ARTF-02]

# Metrics
duration: 2min
completed: 2026-03-02
---

# Phase 4 Plan 02: Scope SKILL.md Steps 6-8 Summary

**Question plan generation with Terraform plan-apply review loop, typed evidence requirements per question, DA depth calibration, and SCOPE.md/state.yml artifact writing**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-02T17:48:18Z
- **Completed:** 2026-03-02T17:49:58Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments
- Appended Steps 6-8 to scope SKILL.md (199 lines added) completing the question plan generation and artifact writing flow
- Step 6 implements full question plan lifecycle: load reference guide, generate plan with DAs/depth/readiness/evidence requirements, self-check, present in exact preview format, review loop (approve/modify/add)
- Step 7 provides simplified read-only source configuration display from sources.yml
- Step 8 writes both SCOPE.md (data plane with rich DA metadata) and state.yml (control plane with flat question-level data) using backup-before-write pattern
- Evidence requirements enforced as concrete and checkable with inline GOOD/BAD examples

## Task Commits

Each task was committed atomically:

1. **Task 1: Append Steps 6-8 to scope SKILL.md** - `d910d12` (feat)

## Files Created/Modified
- `skills/scope/SKILL.md` - Scope skill now has Steps 1-8: complete orchestration from lifecycle check through artifact writing

## Decisions Made
- Followed plan exactly as specified -- all content matched the plan verbatim
- No deviations needed -- the plan content was precise and complete

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- SKILL.md now has Steps 1-8 in place, ending at "Proceed to Step 9"
- Ready for 04-03-PLAN.md to append Step 9 (G1 sufficiency gate evaluation)
- The contract chain is established: every question has typed evidence requirements that downstream research agents will receive as targets

## Self-Check: PASSED

All files and commits verified:
- skills/scope/SKILL.md: FOUND
- 04-02-SUMMARY.md: FOUND
- Commit d910d12: FOUND

---
*Phase: 04-scope-skill*
*Completed: 2026-03-02*
