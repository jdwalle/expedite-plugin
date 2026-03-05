---
phase: 07-design-skill
plan: 01
subsystem: design
tags: [rfc, prd, design-generation, contract-chain, evidence-based]

# Dependency graph
requires:
  - phase: 03-prompt-templates
    provides: prompt-design-guide.md reference template
  - phase: 06-research-quality-synthesis
    provides: SYNTHESIS.md artifact format consumed by design skill
provides:
  - Design SKILL.md Steps 1-5 (prerequisite, artifact loading, state init, generation, writing)
  - RFC format for engineering intent with 8 required sections
  - PRD format for product intent with 9 required sections
  - Per-DA design decisions with evidence citations, alternatives, trade-offs, confidence
affects: [07-02, 07-03, 08-plan-skill]

# Tech tracking
tech-stack:
  added: []
  patterns: [inline-generation-with-reference-template, evidence-citation-pattern, self-check-before-write]

key-files:
  created: []
  modified: [skills/design/SKILL.md]

key-decisions:
  - "Design generation is inline (not subagent) -- matches scope skill pattern, enables revision cycle"
  - "Both RFC and PRD formats include Design Overview section before per-DA decisions"
  - "Self-check before writing enforces quality gate criteria inline"
  - "Post-write verification reads back DESIGN.md to validate DA coverage"
  - "PRD format expanded to match RFC detail level (full per-DA structure with all 5 fields)"

patterns-established:
  - "Inline generation with reference template: read prompt-design-guide.md as quality reference, generate in main session"
  - "Evidence citation pattern: inline citations referencing evidence-batch-XX.md Finding N"
  - "Self-check before write: verify content against quality criteria before disk write"

requirements-completed: [DSGN-01, DSGN-02, DSGN-07, DSGN-08, DSGN-09]

# Metrics
duration: 4min
completed: 2026-03-05
---

# Phase 7 Plan 01: Design Skill Core Pipeline Summary

**Design SKILL.md Steps 1-5 with prerequisite check, artifact loading, inline RFC/PRD generation with per-DA evidence-backed decisions, and DESIGN.md artifact writing**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-05T20:42:45Z
- **Completed:** 2026-03-05T20:46:25Z
- **Tasks:** 2
- **Files modified:** 1

## Accomplishments
- Replaced design SKILL.md stub with full Steps 1-5 orchestration (201 lines)
- Step 1 prerequisite check blocks on non-research_complete phase
- Step 2 reads SCOPE.md, SYNTHESIS.md, state.yml, and optional override-context.md with DA cross-referencing
- Step 3 transitions state to design_in_progress with backup-before-write pattern
- Step 4 generates RFC (engineering) or PRD (product) format inline with per-DA design decisions citing evidence
- Step 5 writes DESIGN.md with DA count validation and post-write verification

## Task Commits

Each task was committed atomically:

1. **Task 1: Replace design SKILL.md stub with Steps 1-3** - `05a04bd` (feat)
2. **Task 2: Append Steps 4-5 (design generation and DESIGN.md writing)** - `d75ddce` (feat)

## Files Created/Modified
- `skills/design/SKILL.md` - Design skill orchestration with Steps 1-5 (prerequisite check, artifact loading, state init, design generation, DESIGN.md writing)

## Decisions Made
- Design generation is inline (not subagent) -- matches scope skill pattern, enables revision cycle (DSGN-01)
- Both RFC and PRD formats include a Design Overview section before per-DA decisions (user discretion recommendation from research)
- Self-check before writing enforces quality gate criteria inline -- prevents malformed DESIGN.md from being written
- Post-write verification reads back DESIGN.md to validate DA coverage and required subsections
- PRD format expanded to match RFC detail level with full per-DA structure (Decision, Evidence basis, Alternatives Considered, Trade-offs, Confidence)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Expanded PRD per-DA structure to match RFC detail**
- **Found during:** Task 2 (Step 4 generation)
- **Issue:** Initial PRD per-DA structure had abbreviated fields (Decision, Evidence basis, Trade-offs, Confidence) vs RFC's full 5-field structure. This would create inconsistency in downstream plan consumption.
- **Fix:** Expanded PRD per-DA fields to include all 5 fields matching RFC: Decision, Evidence basis, Alternatives Considered, Trade-offs, Confidence
- **Files modified:** skills/design/SKILL.md
- **Verification:** Both formats now have identical per-DA field structure
- **Committed in:** d75ddce (Task 2 commit)

**2. [Rule 2 - Missing Critical] Added self-check before write and post-write verification**
- **Found during:** Task 2 (Step 4-5 generation)
- **Issue:** Plan specified contract chain enforcement but no explicit quality check mechanism before writing. Design guide has a quality_gate section that should be enforced inline.
- **Fix:** Added self-check checklist before Step 5 (8 criteria from design guide) and post-write verification after Step 5 (4 structural checks)
- **Files modified:** skills/design/SKILL.md
- **Verification:** Both check sections present with explicit criteria
- **Committed in:** d75ddce (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (2 missing critical)
**Impact on plan:** Both additions strengthen contract chain enforcement and format consistency. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Steps 1-5 complete and ready for Plans 07-02 (HANDOFF.md + revision cycle) and 07-03 (G3 gate)
- Design guide reference template already exists from Phase 3
- State transitions for design phase defined in state.yml.template

---
*Phase: 07-design-skill*
*Completed: 2026-03-05*
