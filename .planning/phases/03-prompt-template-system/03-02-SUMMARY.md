---
phase: 03-prompt-template-system
plan: 02
subsystem: prompts
tags: [prompt-templates, xml-structure, intent-lens, research-synthesis, sufficiency-evaluator, scope-questioning, contract-chain]

# Dependency graph
requires:
  - phase: 01-plugin-scaffolding
    provides: skill directory structure with references/ subdirectories
provides:
  - Research synthesizer subagent template (opus model, decision-area-organized synthesis)
  - Sufficiency evaluator inline rubric (3-dimension categorical assessment with depth calibration)
  - Scope questioning inline reference (contract chain origin point with DA/question/evidence structure)
affects: [04-scope-skill, 05-research-orchestration, 06-research-quality-synthesis]

# Tech tracking
tech-stack:
  added: []
  patterns: [8-section-xml-template, intent-lens-conditionals, contract-chain-enforcement, anti-bias-quality-gate, depth-calibrated-corroboration]

key-files:
  created:
    - skills/research/references/prompt-research-synthesizer.md
    - skills/research/references/prompt-sufficiency-evaluator.md
    - skills/scope/references/prompt-scope-questioning.md
  modified: []

key-decisions:
  - "Synthesizer uses opus model for highest-capability cross-referencing and contradiction detection"
  - "Sufficiency evaluator is inline reference (no frontmatter) -- loaded by SKILL.md, not spawned as subagent"
  - "Scope questioning defines WHAT (structure, format, quality criteria) not HOW (interactive flow belongs to Phase 4)"
  - "All templates enforce contract chain at their respective positions in the lifecycle"

patterns-established:
  - "Anti-bias quality gate: 'evaluate as if this output was produced by someone else' with default-deny assumption"
  - "Depth-calibrated corroboration: Deep DAs require Strong/Adequate, Standard requires Adequate+, Light accepts Weak"
  - "Categorical sufficiency rating: COVERED / PARTIAL / NOT COVERED / UNAVAILABLE-SOURCE (not numeric scores)"
  - "Dual-target output for subagent templates: file output + condensed return (max 500 tokens)"

requirements-completed: [TMPL-01, TMPL-02, TMPL-03, TMPL-05]

# Metrics
duration: 4min
completed: 2026-03-02
---

# Phase 3 Plan 2: Synthesizer, Sufficiency Evaluator, and Scope Questioning Templates Summary

**Research synthesizer (opus), sufficiency evaluator (3-dimension rubric with depth calibration), and scope questioning guide (contract chain origin) -- all with 8-section XML and intent lens**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-02T16:29:58Z
- **Completed:** 2026-03-02T16:34:00Z
- **Tasks:** 3
- **Files modified:** 4 (3 created, 1 deleted)

## Accomplishments
- Research synthesizer subagent template with opus model, decision-area-organized output, evidence traceability matrix, cross-reference verification with corroboration ratings, and dual-target output (SYNTHESIS.md + 500-token condensed return)
- Sufficiency evaluator inline reference with 3-dimension rubric (Coverage, Corroboration, Actionability), 4 levels each, categorical mapping (COVERED/PARTIAL/NOT COVERED/UNAVAILABLE-SOURCE), and depth-calibrated corroboration thresholds
- Scope questioning inline reference defining the contract chain origin: DA structure (ID, name, depth, readiness), question structure (ID, text, priority, source hints, evidence requirements), and quality criteria for well-formed question plans

## Task Commits

Each task was committed atomically:

1. **Task 1: Create prompt-research-synthesizer.md** - `7d88c84` (feat)
2. **Task 2: Create prompt-sufficiency-evaluator.md** - `f709fb7` (feat)
3. **Task 3: Create prompt-scope-questioning.md and clean up .gitkeep** - `4d9d337` (feat)

## Files Created/Modified
- `skills/research/references/prompt-research-synthesizer.md` - Opus subagent prompt for evidence synthesis by decision area with traceability matrix
- `skills/research/references/prompt-sufficiency-evaluator.md` - Inline rubric for per-question categorical sufficiency assessment
- `skills/scope/references/prompt-scope-questioning.md` - Inline reference for structured question plan generation (contract chain origin)
- `skills/scope/references/.gitkeep` - Removed (replaced by real content)

## Decisions Made
- Synthesizer uses opus model for highest-capability cross-referencing and contradiction detection (per PRODUCT-DESIGN.md line 1097)
- Sufficiency evaluator and scope questioning are inline references (no frontmatter) -- loaded by SKILL.md, not spawned as subagents
- Scope questioning defines structure and quality criteria only; interactive flow logic deferred to Phase 4 SKILL.md
- All three templates enforce the contract chain at their respective positions: scope defines typed evidence requirements, sufficiency evaluator checks against them mechanically, synthesizer organizes evidence by decision area with traceability

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Research synthesizer template ready for Phase 5-6 SKILL.md integration (reads frontmatter for subagent_type and model)
- Sufficiency evaluator template ready for Phase 6 SKILL.md integration (loaded as inline reference for per-question assessment)
- Scope questioning template ready for Phase 4 SKILL.md integration (loaded as inline reference for question plan generation)
- Plan 03-01 (researcher templates) and 03-03 (design/plan/verifier templates) remain to complete Phase 3

## Self-Check: PASSED

All files verified present, .gitkeep confirmed removed, all 3 commit hashes confirmed in git log.

---
*Phase: 03-prompt-template-system*
*Completed: 2026-03-02*
