---
phase: 03-prompt-template-system
plan: 03
subsystem: prompt-templates
tags: [design-guide, plan-guide, task-verifier, contract-chain, intent-lens, xml-templates]

# Dependency graph
requires:
  - phase: 03-prompt-template-system (plans 01-02)
    provides: Upstream templates (scope, researcher, sufficiency, synthesizer) establishing 8-section XML pattern
provides:
  - prompt-design-guide.md inline reference for design skill (Phase 7)
  - prompt-plan-guide.md inline reference for plan skill (Phase 8)
  - prompt-task-verifier.md inline reference for execute skill (Phase 9)
  - Complete downstream contract chain enforcement (design -> plan -> execute)
affects: [04-lifecycle-gates, 07-design-skill, 08-plan-skill, 09-execute-skill]

# Tech tracking
tech-stack:
  added: []
  patterns: [8-section XML template structure, intent-conditional sections, contract chain enforcement, anti-bias quality gate]

key-files:
  created:
    - skills/design/references/prompt-design-guide.md
    - skills/plan/references/prompt-plan-guide.md
    - skills/execute/references/prompt-task-verifier.md
  modified: []

key-decisions:
  - "All 3 downstream templates use same 8-section XML structure as upstream templates for consistency"
  - "Design guide enforces PRD format for product intent and RFC format for engineering intent with exact required sections"
  - "Plan guide enforces wave-ordered tasks for engineering and epics/stories for product with design decision traceability"
  - "Task verifier checks design decision alignment (not just criterion pass/fail) with 4-level status"

patterns-established:
  - "Contract chain enforcement: every DA -> design decision -> plan task -> verified code change"
  - "Anti-bias quality gate: 'evaluate as if someone else produced this' in every template"
  - "Intent-conditional sections: <if_intent_product> and <if_intent_engineering> blocks"
  - "Downstream consumer documentation: each template declares who consumes its output and why format matters"

requirements-completed: [TMPL-01, TMPL-02, TMPL-06]

# Metrics
duration: 4min
completed: 2026-03-02
---

# Phase 03 Plan 03: Downstream Consumer Templates Summary

**3 downstream templates (design guide, plan guide, task verifier) with 8-section XML structure, intent-conditional PRD/RFC formats, and end-to-end contract chain enforcement from scope through code verification**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-02T16:29:59Z
- **Completed:** 2026-03-02T16:34:27Z
- **Tasks:** 3
- **Files modified:** 6 (3 created, 3 .gitkeep removed)

## Accomplishments
- Design guide template with PRD (product) and RFC (engineering) format specifications, HANDOFF.md 9-section format for product intent, and evidence traceability requirements
- Plan guide template with wave-ordered tasks (engineering) and epics/stories (product) formats, acceptance criteria tracing to design decisions
- Task verifier template with design decision alignment checking, full contract chain validation (scope -> evidence -> design -> task -> code), and disconnected check detection

## Task Commits

Each task was committed atomically:

1. **Task 1: Create prompt-design-guide.md** - `1bb8a57` (feat)
2. **Task 2: Create prompt-plan-guide.md** - `fc4ff31` (feat)
3. **Task 3: Create prompt-task-verifier.md** - `02173f3` (feat)

## Files Created/Modified
- `skills/design/references/prompt-design-guide.md` - Inline reference guide for design generation (221 lines, PRD/RFC formats, HANDOFF.md spec)
- `skills/plan/references/prompt-plan-guide.md` - Inline reference guide for plan generation (171 lines, wave/epic formats, acceptance criteria tracing)
- `skills/execute/references/prompt-task-verifier.md` - Inline reference guide for per-task verification (133 lines, alignment checking, contract chain validation)
- `skills/design/references/.gitkeep` - Removed (replaced by design guide)
- `skills/plan/references/.gitkeep` - Removed (replaced by plan guide)
- `skills/execute/references/.gitkeep` - Removed (replaced by task verifier)

## Decisions Made
None - followed plan as specified. All 3 templates created with exact content from plan.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- All 9 prompt templates are now in place across the 3 plans of Phase 03
- Upstream templates (plans 01-02): scope questioning, researcher, sufficiency evaluator, synthesizer, codebase analyst, source evaluator
- Downstream templates (plan 03): design guide, plan guide, task verifier
- Phase 04 (Lifecycle Gates) can proceed with gate definitions that reference these templates
- Phases 7-9 (Design, Plan, Execute skills) will load these as inline references via SKILL.md

## Self-Check: PASSED

All 3 template files verified on disk. All 3 task commits verified in git log. No missing artifacts.

---
*Phase: 03-prompt-template-system*
*Completed: 2026-03-02*
