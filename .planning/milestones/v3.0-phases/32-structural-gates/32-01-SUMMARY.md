---
phase: 32-structural-gates
plan: 01
subsystem: gates
tags: [node, js-yaml, structural-gates, deterministic-checks, gates-yml]

# Dependency graph
requires:
  - phase: 31-skill-thinning
    provides: "Gate write path redirected to gates.yml, thinned skill structure with inline gate criteria"
provides:
  - "Shared gate utilities (YAML I/O, outcome computation, result formatting)"
  - "G1 scope completeness gate script (6 MUST + 3 SHOULD criteria)"
  - "G4 plan completeness gate script (6 MUST + 5 SHOULD criteria)"
affects: [32-02-PLAN, skills/scope, skills/plan]

# Tech tracking
tech-stack:
  added: []
  patterns: ["Standalone gate scripts with structured JSON output", "Read-then-append gates.yml semantics", "Shared gate-utils library pattern"]

key-files:
  created:
    - gates/lib/gate-utils.js
    - gates/g1-scope.js
    - gates/g4-plan.js
  modified: []

key-decisions:
  - "Reused js-yaml from hooks/node_modules via path.join(__dirname) for CWD-independent require"
  - "G1 uses 'hold' as fail outcome, G4 uses 'recycle' per existing skill conventions"
  - "M5 vacuous pass when no questions exist (M2 catches count); M6 auto-pass when tasks.yml absent"

patterns-established:
  - "Gate script pattern: CLI entry with project-dir arg, MUST/SHOULD check arrays, buildEntry, appendGateResult, printResult, exit code"
  - "Actionable failure messages: name the missing file/section/field, not just criterion ID"

requirements-completed: [GATE-01, GATE-03, GATE-04]

# Metrics
duration: 4min
completed: 2026-03-16
---

# Phase 32 Plan 01: Structural Gates Summary

**Deterministic G1 (scope) and G4 (plan) gate scripts with shared gate-utils library producing structured JSON and gates.yml entries**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-16T04:00:26Z
- **Completed:** 2026-03-16T04:04:54Z
- **Tasks:** 2
- **Files created:** 3

## Accomplishments
- Built shared gate infrastructure (gate-utils.js) with YAML I/O, outcome computation, result formatting, and gates.yml append
- Created G1 scope gate checking 6 MUST + 3 SHOULD criteria with actionable failure messages
- Created G4 plan gate checking 6 MUST + 5 SHOULD criteria including DA coverage, TD references, and acceptance criteria traceability
- All scripts produce structured JSON stdout and write gates.yml entries matching existing schema

## Task Commits

Each task was committed atomically:

1. **Task 1: Create shared gate utilities and G1 scope gate script** - `aa62bfa` (feat)
2. **Task 2: Create G4 plan gate script** - `7556b62` (feat)

## Files Created/Modified
- `gates/lib/gate-utils.js` - Shared utilities: readYaml, readFile, appendGateResult, formatChecks, computeOutcome, buildEntry, printResult
- `gates/g1-scope.js` - G1 scope completeness gate: checks SCOPE.md existence, questions count, intent, success criteria, evidence requirements, DA depth/readiness
- `gates/g4-plan.js` - G4 plan completeness gate: checks PLAN.md existence, DA coverage, phase structure, TD references, acceptance criteria traceability, agent assignments

## Decisions Made
- Reused js-yaml from hooks/node_modules via `path.join(__dirname, '../../hooks/node_modules/js-yaml')` for CWD-independent require (no separate dependency installation)
- G1 uses "hold" as fail outcome per scope skill convention; G4 uses "recycle" per plan skill convention
- M5 (evidence_requirements) vacuously passes when no questions exist since M2 already catches the count issue
- M6 (agent assignments) auto-passes when tasks.yml does not exist since it is populated later by the execute skill

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Gate scripts ready for integration into scope and plan skills (32-02 plan)
- Scripts can be invoked standalone: `node gates/g1-scope.js <project-dir>` and `node gates/g4-plan.js <project-dir>`
- gates.yml schema matches existing hooks/lib/schemas/gates.js validation

---
*Phase: 32-structural-gates*
*Completed: 2026-03-16*

## Self-Check: PASSED

- All 3 created files verified on disk
- Both task commits (aa62bfa, 7556b62) verified in git log
