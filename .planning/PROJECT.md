# Expedite

## What This Is

Expedite is a Claude Code plugin that orchestrates a 5-phase research-to-implementation lifecycle: Scope, Research, Design, Plan, Execute. It transforms the pattern of "research a problem, then build a solution" into a structured, repeatable workflow with quality gates, parallel research agents, and dual-intent support for both product managers and engineers. The plugin lives at `~/.claude/plugins/expedite/` and is invoked via `/expedite:` commands.

## Core Value

Developers can run a complete evidence-based lifecycle — from scoping questions through researched design to executable plan — without losing context, skipping steps, or making decisions without evidence.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] Plugin structure (plugin.json, skills/, references/, hooks.json) following Claude Code conventions
- [ ] 6 skills under `/expedite:` namespace: scope, research, design, plan, execute, status
- [ ] Flat state.yml (max 2 nesting levels) with complete-file rewrite + backup-before-write
- [ ] 8-section XML prompt templates in references/
- [ ] Scope skill: interactive question generation, intent detection (product/engineering), question plan preview
- [ ] Research skill: source-affinity batching, parallel Task() subagents, dynamic question discovery, inline sufficiency assessment
- [ ] Design skill: main-session generation, revision cycle (max 2 rounds), dual output format (PRD vs RFC)
- [ ] Plan skill: main-session plan generation from design artifacts
- [ ] Execute skill: guided implementation from plan
- [ ] Status skill: context reconstruction, lifecycle overview
- [ ] Inline gates (G1-G5) with MUST/SHOULD criteria, categorical sufficiency model (COVERED/PARTIAL/NOT COVERED)
- [ ] SessionStart hook + dynamic `!cat` injection for context reconstruction
- [ ] Three-layer context fallback (hook + `!cat` in SKILL.md + manual `/expedite:status`)
- [ ] log.yml telemetry (gitignored, multi-document YAML append)
- [ ] Source routing with three researcher templates (web, codebase, MCP)
- [ ] Dual intent adaptation (product/engineering) with conditional template sections
- [ ] Gate outcomes: Go, Go-with-advisory, Recycle, Override
- [ ] Recycle escalation (1st informational, 2nd suggest adjustment, 3rd recommend override)
- [ ] Archival flow (move to `.expedite/archive/{slug}/`)

### Out of Scope

- HANDOFF.md generation — LOW confidence, deferred to v2
- Cross-lifecycle artifact import — LOW confidence, novel feature with no reference precedent
- Locked constraints from imported artifacts — LOW confidence, LLM enforcement unreliable
- Extended thinking — explicitly excluded in design (no v1 use)
- Mobile/web UI — pure CLI plugin
- Multi-user collaboration — single-developer workflow
- Numeric scoring for sufficiency — categorical model proven by research-engine, numeric is v1.1 candidate

## Context

**Source of truth documents:**
- `.planning/research/arc-implementation/design/PRODUCT-DESIGN.md` — complete design specification (references "arc" — rename to "expedite" during implementation)
- `.planning/research/arc-implementation/design/CONFIDENCE-AUDIT.md` — confidence ratings and testing priorities

**Reference implementations to study:**
- `~/.claude/plugins/cache/local/research-engine/` — research-engine plugin (expedite's direct ancestor). Patterns to adopt: sufficiency model, per-source templates, plugin structure, state management
- GSD (`~/.claude/get-shit-done/`) — state management patterns, subagent orchestration, prompt templates

**Key design facts:**
- The design went through 3 revised proposals, 2 validation reports, 2 readiness evaluations across 10 decision areas
- Confidence distribution: ~12 ROCK SOLID, ~16 HIGH, ~8 MEDIUM, ~5 LOW (LOW items deferred)
- Research SKILL.md 11-step orchestration is the highest-risk component — if unreliable, split into sub-skills
- Categorical sufficiency (COVERED/PARTIAL/NOT COVERED) is a proven pattern from research-engine

**Naming:**
- Design docs reference "arc" throughout — rename to "expedite" during implementation
- Namespace: `/expedite:` (not `/arc:`)
- State directory: `.expedite/` (not `.arc/`)
- Plugin directory: `~/.claude/plugins/expedite/`

## Constraints

- **Plugin platform**: Must follow Claude Code plugin conventions (auto-discovery, SKILL.md orchestrators, plugin.json)
- **No subagents for interactive phases**: Design, plan, execute run in main session (constraint C-7 from design)
- **Subagents only for parallel research**: Task() used exclusively for research evidence gathering
- **Max 3 concurrent research subagents**: Conservative ceiling per Anthropic guidance
- **AskUserQuestion not in subagents**: Hard platform constraint (GitHub #12890)
- **MCP tools require foreground execution**: Hard platform constraint (GitHub #13254, #19964)
- **SessionStart hook bugs**: 3 open bugs (#16538, #13650, #11509) — fallback layers required
- **Output format**: Self-contained plugin directory with all files (plugin.json, skills/, references/, hooks.json, etc.)
- **State size**: state.yml under 100 lines target (soft limit)

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Rename arc → expedite | User preference for project naming | — Pending |
| Defer LOW-confidence features to v2 | HANDOFF.md, cross-lifecycle import, locked constraints have weak evidence | — Pending |
| Keep dual intent in v1 | Product + engineering modes retained despite HANDOFF.md deferral | — Pending |
| Inline gates (not separate gate skill) | User decision D1 — streamlined UX, each skill validates own output | — Pending |
| log.yml gitignored | User decision D5 — single-user workflow, less commit noise | — Pending |
| Categorical sufficiency (not numeric) | Proven by research-engine, more stable than numeric scores | — Pending |
| Hardcoded model tiers in frontmatter | Research-engine pattern, zero configuration | — Pending |
| Freeform micro-interaction (not AskUserQuestion) | Avoids 60-second timeout, all 3 design proposals converged | — Pending |

---
*Last updated: 2026-02-27 after initialization*
