# Stack Research — v1.1 Production Polish

**Date:** 2026-03-09
**Milestone:** v1.1 — audit gap remediation
**Confidence:** HIGH

## Executive Summary

No new stack additions required. All v1.1 features are internal improvements to existing Markdown/YAML skill files within the Claude Code plugin platform. The existing stack (SKILL.md orchestrators, state.yml, prompt templates, Task() subagents) fully supports every item in scope.

## Existing Stack (No Changes Needed)

| Layer | Technology | Status |
|-------|-----------|--------|
| Orchestration | SKILL.md files (Claude Code plugin) | Unchanged |
| State | state.yml (flat YAML, max 2 nesting) | Extended (new field) |
| Templates | 8-section XML prompt templates in references/ | Unchanged |
| Subagents | Task() with subagent_type/model frontmatter | Unchanged |
| Interaction | AskUserQuestion (main session only) | Unchanged |
| Manifest | plugin.json (auto-discovery) | Version bump only |
| Telemetry | log.yml (gitignored, multi-doc YAML append) | Unchanged |

## Changes by Feature

### FIX-1/2/3: Quick Fixes
- **plugin.json**: Version string change `0.1.0` → `1.0.0`
- **Root .gitignore**: New file (standard git feature)
- **PROJECT.md**: New Key Decisions entry (documentation only)

### DEFER-11: Step-Level Tracking
- **state.yml schema**: Add `current_step` field (`skill`, `step`, `label` sub-keys)
- **All 7 SKILL.md files**: Add step-write calls at each numbered step entry
- **status SKILL.md**: Add step display to lifecycle overview
- **No new dependencies** — uses existing complete-file rewrite + backup-before-write pattern

### DEFER-12: DA Readiness Enforcement
- **G2-G5 gate sections in SKILL.md files**: Add MUST/SHOULD criteria referencing readiness criteria from SCOPE.md
- **Research SKILL.md (G2)**: Simplest — synthesizer already outputs MET/NOT MET per DA
- **Design SKILL.md (G3)**: Cross-reference evidence citations against DA readiness criteria
- **Plan SKILL.md (G4)**: Task coverage adjusted for DA depth calibration
- **Spike SKILL.md (G5)**: Spike resolution validates against identified ambiguity
- **No new tools or subagents** — all within existing gate evaluation logic

### DEFER-1: HANDOFF.md Official Support
- **Design SKILL.md Step 6**: Code already exists (lines 275-328), 9-section implementation
- **PROJECT.md**: Status update from "Out of Scope" to "Active"
- **No code additions** — testing, verification, and documentation updates only

### DEFER-2: Log.yml Size Warning
- **status SKILL.md**: Add file-size check before displaying telemetry
- **No new dependencies** — standard file size check

### DEFER-3: Artifact-Based State Reconstruction
- **status SKILL.md**: Add artifact existence checks (SCOPE.md, SYNTHESIS.md, DESIGN.md, PLAN.md)
- **Compare artifact presence against state.yml phase** — flag inconsistencies
- **No state writes** — status skill remains read-only; reports discrepancies for user action

## What NOT to Add

- **No migration tooling** — state.yml complete-rewrite semantics mean new fields appear organically on first v1.1 write
- **No external libraries** — everything is Markdown/YAML manipulation within Claude Code's existing capabilities
- **No new prompt templates** — all changes fit within existing SKILL.md gate sections
- **No new subagent types** — Task() already covers all parallel work needs
- **No configuration files** — hardcoded patterns continue to work

## Integration Points

| Feature | Touches | Integration Complexity |
|---------|---------|----------------------|
| Step tracking | All 7 skills + state.yml schema | Medium (repetitive but wide) |
| Gate enforcement | 4 skills (research, design, plan, spike) | Medium (cross-file reference) |
| HANDOFF.md | Design skill + PROJECT.md | Low (code exists) |
| Status improvements | Status skill only | Low (isolated) |
| Quick fixes | plugin.json, .gitignore, PROJECT.md | Trivial |

---
*Research completed: 2026-03-09*
