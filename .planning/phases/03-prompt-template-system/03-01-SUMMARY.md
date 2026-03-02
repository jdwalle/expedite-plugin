---
phase: 03-prompt-template-system
plan: 01
subsystem: prompts
tags: [prompt-templates, xml-structure, subagent, research, intent-lens, circuit-breaker]

# Dependency graph
requires:
  - phase: 01-plugin-scaffolding
    provides: "skill directory structure with references/ subdirectories"
provides:
  - "3 per-source researcher prompt templates (web, codebase, MCP) for Task() dispatch"
  - "8-section XML template structure established for all subagent prompts"
  - "Intent lens pattern with product/engineering conditional blocks"
  - "Circuit breaker source handling pattern for tool error classification"
  - "Contract chain enforcement via typed evidence requirements"
affects: [03-prompt-template-system, 05-research-orchestration, 06-quality-synthesis]

# Tech tracking
tech-stack:
  added: []
  patterns: [8-section-xml-template, intent-lens-conditionals, circuit-breaker-source-handling, dual-target-output, dynamic-question-discovery]

key-files:
  created:
    - skills/research/references/prompt-web-researcher.md
    - skills/research/references/prompt-codebase-analyst.md
    - skills/research/references/prompt-mcp-researcher.md
  modified: []

key-decisions:
  - "Used general-purpose subagent_type for all 3 researchers for consistency (avoids explore-mode tool restrictions)"
  - "Followed plan exactly -- all template content matched the specification verbatim"

patterns-established:
  - "8-section XML template: role, context, intent_lens, downstream_consumer, instructions, output_format, quality_gate, input_data"
  - "Intent lens conditionals: <if_intent_product> and <if_intent_engineering> blocks within instructions and output_format"
  - "Circuit breaker source handling: retry-once-on-server-failure, never-retry-platform-failure, report source_status"
  - "Dual-target output: file output path + condensed inline return (max 500 tokens)"
  - "Dynamic question discovery: # --- PROPOSED QUESTIONS --- YAML block format"
  - "Anti-bias quality gate: evaluate as if output produced by someone else"
  - "Contract chain: evidence requirements as typed targets, per-requirement assessment table"

requirements-completed: [TMPL-01, TMPL-02, TMPL-03, TMPL-04]

# Metrics
duration: 3min
completed: 2026-03-02
---

# Phase 03 Plan 01: Researcher Prompt Templates Summary

**3 per-source researcher subagent prompts (web/codebase/MCP) with 8-section XML structure, intent lens conditionals, circuit breaker error handling, and contract chain enforcement via typed evidence requirements**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-02T16:29:54Z
- **Completed:** 2026-03-02T16:33:22Z
- **Tasks:** 3
- **Files modified:** 4 (3 created, 1 deleted)

## Accomplishments
- Created web researcher template with WebSearch/WebFetch tool guidance and 5-8 search strategy requirement
- Created codebase analyst template with Grep/Read/Glob/Bash tool guidance and architecture analysis patterns
- Created MCP researcher template with mcp__<server>__* wildcard tool guidance and structured data extraction focus
- Removed .gitkeep placeholder from skills/research/references/
- All 3 templates share: 8-section XML structure, intent lens, circuit breaker, dynamic question discovery, dual-target output, anti-bias quality gate, contract chain enforcement

## Task Commits

Each task was committed atomically:

1. **Task 1: Create prompt-web-researcher.md** - `5cb91f6` (feat)
2. **Task 2: Create prompt-codebase-analyst.md** - `0f7135e` (feat)
3. **Task 3: Create prompt-mcp-researcher.md and clean up .gitkeep** - `50f8db6` (feat)

## Files Created/Modified
- `skills/research/references/prompt-web-researcher.md` - Web research subagent prompt with WebSearch/WebFetch tools
- `skills/research/references/prompt-codebase-analyst.md` - Codebase analysis subagent prompt with Grep/Read/Glob/Bash tools
- `skills/research/references/prompt-mcp-researcher.md` - MCP research subagent prompt with mcp__<server>__* tools
- `skills/research/references/.gitkeep` - Removed (replaced by actual template files)

## Decisions Made
- Used general-purpose subagent_type for all 3 researchers for consistency, avoiding potential explore-mode tool restrictions
- Followed plan specification verbatim for all template content -- no prose deviations

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- 3 researcher templates ready for Phase 5 (Research Orchestration) to consume via Task() dispatch
- Research SKILL.md can read frontmatter (subagent_type: general-purpose, model: sonnet) to configure subagent spawning
- {{variable}} placeholders ready for orchestrator substitution with batch-specific data
- Remaining Phase 3 plans (03-02, 03-03) will create the other 6 templates (synthesizer, sufficiency evaluator, scope questioning, design guide, plan guide, task verifier)

## Self-Check: PASSED

All created files verified on disk. All 3 task commits confirmed in git history. .gitkeep removal confirmed.

---
*Phase: 03-prompt-template-system*
*Completed: 2026-03-02*
