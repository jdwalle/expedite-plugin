---
phase: 28-checkpoint-based-resume
plan: 02
subsystem: state
tags: [checkpoint, resume, skill-instructions, deterministic-resume]

# Dependency graph
requires:
  - phase: 28-checkpoint-based-resume
    provides: "Checkpoint.yml writes at every step transition in all 6 skills (plan 01)"
  - phase: 27-override-mechanism-and-audit-trail
    provides: "Skill preamble frontmatter injection including checkpoint.yml injection"
provides:
  - "Deterministic checkpoint-based resume logic in all 5 skills with resume cases (scope, research, design, plan, execute)"
  - "Artifact-existence heuristics demoted to secondary fallback in all skills"
  - "Cross-reference rule (state.yml phase wins over checkpoint) preventing impossible states"
  - "Spike informational checkpoint context display"
affects: [skill-thinning, agent-harness]

# Tech tracking
tech-stack:
  added: []
  patterns: ["checkpoint-primary-artifact-fallback", "cross-reference-state-wins", "mid-step-substep-resume"]

key-files:
  modified:
    - skills/scope/SKILL.md
    - skills/research/SKILL.md
    - skills/design/SKILL.md
    - skills/plan/SKILL.md
    - skills/spike/SKILL.md
    - skills/execute/SKILL.md

key-decisions:
  - "Checkpoint-based resume is primary; artifact-existence is secondary fallback only when checkpoint missing or skill mismatches"
  - "Cross-reference rule in all skills: state.yml phase (e.g., research_complete) wins over checkpoint step"
  - "Execute skill layers top-level checkpoint (skill steps) over per-phase checkpoint (task tracking) as dual-layer resume"
  - "Spike shows checkpoint context informationally but always re-runs from phase argument"

patterns-established:
  - "Checkpoint-primary-artifact-fallback: check checkpoint.skill match first, fall back to artifact heuristic with explicit message"
  - "Cross-reference guard: always compare state.yml phase against checkpoint before resuming"
  - "Mid-step resume: substep + continuation_notes enable resuming agent dispatch, task loops mid-stride"

requirements-completed: [RESM-01, RESM-04]

# Metrics
duration: 4min
completed: 2026-03-13
---

# Phase 28 Plan 02: Resume Dispatcher Summary

**Deterministic checkpoint-based resume logic in all 5 skills with resume cases, demoting artifact-existence heuristics to secondary fallback**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-13T15:48:23Z
- **Completed:** 2026-03-13T15:52:22Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- Rewrote resume logic (Case B / Case B2) in scope, research, design, plan, and execute skills to use checkpoint.yml as primary resume mechanism
- Demoted artifact-existence heuristics to secondary fallback with explicit "Checkpoint unavailable" messaging
- Implemented cross-reference rule in all skills: state.yml phase wins over checkpoint to prevent impossible states
- Added informational checkpoint context display to spike skill
- Execute skill now layers top-level checkpoint (skill step resume) over per-phase checkpoint (task-level resume)
- Research and execute skills support mid-step resume via substep and continuation_notes fields

## Task Commits

Each task was committed atomically:

1. **Task 1: Rewrite resume logic for scope and research skills** - `30bf60c` (feat)
2. **Task 2: Rewrite resume logic for design, plan, execute, and spike skills** - `1bad45e` (feat)

## Files Created/Modified
- `skills/scope/SKILL.md` - Case B: checkpoint-based primary resume with artifact heuristic fallback
- `skills/research/SKILL.md` - Case B: checkpoint-based primary resume with mid-step agent dispatch context
- `skills/design/SKILL.md` - Case B2: checkpoint-based primary resume with DESIGN.md/HANDOFF.md fallback
- `skills/plan/SKILL.md` - Case B2: checkpoint-based primary resume with PLAN.md existence fallback
- `skills/spike/SKILL.md` - Informational checkpoint context display (spike always re-runs from scratch)
- `skills/execute/SKILL.md` - Case B: top-level checkpoint primary with per-phase checkpoint fallback

## Decisions Made
- Checkpoint-based resume is primary mechanism; artifact-existence is secondary fallback only when checkpoint is missing/null or checkpoint.skill does not match the invoked skill
- Cross-reference rule added to all 5 resume-capable skills: if state.yml says skill_complete but checkpoint says step N, state wins
- Execute skill uses dual-layer checkpoint approach: top-level for skill step resume, per-phase for task-level resume within Step 5
- Spike receives informational-only checkpoint display -- it does not change behavior since spike always re-runs from the phase argument

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All skills now have checkpoint-based resume as primary mechanism
- Phase 28 (Checkpoint-Based Resume) is fully complete: plan 01 (checkpoint writes) + plan 02 (resume dispatcher)
- Ready for next milestone work (M3-M8: agents, gates, worktrees, handoff)

## Self-Check: PASSED

All 7 files verified present. Both task commits (30bf60c, 1bad45e) verified in git log.

---
*Phase: 28-checkpoint-based-resume*
*Completed: 2026-03-13*
