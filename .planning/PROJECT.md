# Expedite

## What This Is

Expedite is a Claude Code plugin that orchestrates a 5-phase research-to-implementation lifecycle: Scope, Research, Design, Plan, Execute. It turns "research a problem, then build a solution" into a structured, repeatable workflow with 5 quality gates, parallel research agents, crash-resilient state management, and dual-intent support for both product managers and engineers. The plugin lives at `~/.claude/plugins/expedite/` and is invoked via `/expedite:` commands.

## Core Value

Developers can run a complete evidence-based lifecycle — from scoping questions through researched design to executable plan — without losing context, skipping steps, or making decisions without evidence.

## Requirements

### Validated

- ✓ Plugin structure (plugin.json, skills/, references/) following Claude Code conventions — v1.0
- ✓ 6 skills under `/expedite:` namespace: scope, research, design, plan, execute, status — v1.0
- ✓ Flat state.yml (max 2 nesting levels) with complete-file rewrite + backup-before-write — v1.0
- ✓ 9 prompt templates with 8-section XML structure in references/ — v1.0
- ✓ Scope skill: interactive question generation, intent detection, question plan preview, codebase analysis — v1.0
- ✓ Research skill: source-affinity batching, parallel Task() subagents, dynamic question discovery, Task()-dispatched sufficiency assessment — v1.0
- ✓ Design skill: main-session generation, freeform revision cycle, dual output format (PRD vs RFC) — v1.0
- ✓ Plan skill: main-session plan generation with tactical decision identification — v1.0
- ✓ Spike skill: per-phase tactical decision resolution with optional focused research — v1.0
- ✓ Execute skill: guided implementation with checkpoint/resume and per-task verification — v1.0
- ✓ Status skill: context reconstruction via !cat injection, lifecycle overview — v1.0
- ✓ Inline gates (G1-G5) with MUST/SHOULD criteria, categorical sufficiency model — v1.0
- ✓ Dynamic `!cat` injection for context reconstruction after /clear — v1.0
- ✓ log.yml telemetry (gitignored, multi-document YAML append) — v1.0
- ✓ Source routing with 3 researcher templates (web, codebase, MCP) — v1.0
- ✓ Dual intent adaptation (product/engineering) with conditional template sections — v1.0
- ✓ Gate outcomes: Go, Go-with-advisory, Recycle, Override with escalation — v1.0
- ✓ Archival flow (move completed lifecycle to `.expedite/archive/{slug}/`) — v1.0
- ✓ Mid-phase crash resume for all stateful skills — v1.0

### Active

<!-- v1.1 scope — from AUDIT-ACTIONS.md -->

- [ ] Update plugin.json version to 1.0.0
- [ ] Add root .gitignore
- [ ] Document sufficiency evaluator architecture decision
- [ ] HANDOFF.md official support (testing + PROJECT.md status update)
- [ ] Log.yml 50KB size warning in status skill
- [ ] Artifact-based state reconstruction in status skill
- [ ] Step-level tracking for user orientation within skills
- [ ] DA readiness criterion enforcement across G2-G5 gates

## Current Milestone: v1.1 Production Polish

**Goal:** Close audit gaps — quick fixes, UX orientation, gate integrity, and deferred feature support.

**Target features:**
- Quick fixes: version label, .gitignore, architecture doc (FIX-1/2/3)
- Step-level tracking so users know where they are within long skills (DEFER-11)
- DA readiness criterion enforcement across all quality gates (DEFER-12)
- HANDOFF.md official support for product-intent users (DEFER-1)
- Status skill improvements: log.yml size warning + state reconstruction (DEFER-2/3)

### Out of Scope

- HANDOFF.md generation — deferred from v1 (LOW confidence), candidate for v1.1
- Cross-lifecycle artifact import — novel feature, needs design research
- Locked constraints from imported artifacts — LLM enforcement unreliable
- Extended thinking for gates — excluded in v1, candidate for v1.1
- SessionStart hook — deferred to v2 due to 3 open Claude Code bugs (#16538, #13650, #11509)
- Mobile/web UI — pure CLI plugin
- Multi-user collaboration — single-developer workflow
- Numeric scoring for sufficiency — categorical model working well, revisit if coarse

## Context

Shipped v1.0 with 5,563 LOC across Markdown, YAML, and JSON.
Plugin source: 7 skill directories + 10 prompt templates + 3 inline references + state templates.
Tech stack: Claude Code plugin platform (SKILL.md orchestrators, Task() subagents, plugin.json auto-discovery).
92 requirements satisfied across 13 implementation phases in 11 days.
3 audit cycles ensured zero gaps, zero tech debt remaining.

## Constraints

- **Plugin platform**: Must follow Claude Code plugin conventions (auto-discovery, SKILL.md orchestrators, plugin.json)
- **No subagents for interactive phases**: Design, plan, execute run in main session (constraint C-7 from design)
- **Subagents only for parallel research**: Task() used exclusively for research evidence gathering
- **Max 3 concurrent research subagents**: Conservative ceiling per Anthropic guidance
- **AskUserQuestion not in subagents**: Hard platform constraint (GitHub #12890)
- **MCP tools require foreground execution**: Hard platform constraint (GitHub #13254, #19964)
- **SessionStart hook bugs**: 3 open bugs (#16538, #13650, #11509) — fallback layers required
- **State size**: state.yml under 100 lines target (soft limit)

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Rename arc → expedite | User preference for project naming | ✓ Good — clean namespace |
| Defer LOW-confidence features to v2 | HANDOFF.md, cross-lifecycle import, locked constraints have weak evidence | ✓ Good — kept scope tight |
| Keep dual intent in v1 | Product + engineering modes retained despite HANDOFF.md deferral | ✓ Good — both paths work |
| Inline gates (not separate gate skill) | User decision D1 — streamlined UX, each skill validates own output | ✓ Good — cohesive skills |
| log.yml gitignored | User decision D5 — single-user workflow, less commit noise | ✓ Good — clean repos |
| Categorical sufficiency (not numeric) | Proven by research-engine, more stable than numeric scores | ✓ Good — clear thresholds |
| Hardcoded model tiers in frontmatter | Research-engine pattern, zero configuration | ✓ Good — no config burden |
| Freeform micro-interaction (not AskUserQuestion) | Avoids 60-second timeout, all 3 design proposals converged | ✓ Good — no timeouts |
| Research SKILL.md as lean orchestrator | Refactored from 1233→611 lines by moving prompts to references/ | ✓ Good — maintainable |
| Spike as separate skill (not inline in execute) | Per-phase granularity, optional usage, G5 gate boundary | ✓ Good — clean separation |
| Per-phase artifacts at .expedite/plan/phases/{slug}/ | User decision — collocate spike/execute outputs per phase | ✓ Good — organized |
| Case B override via *_in_progress + gate_history | Simpler than *_recycled phase tracking, uses existing state | ✓ Good — reliable |
| Sufficiency evaluator as Task() subagent (not inline) | Spec Decision 10 chose inline (~80K token savings). Implementation dispatches via Task() with `<self_contained_reads>`, trading token cost for orchestrator context hygiene. Keeps research SKILL.md lean. | ✓ Good — context-clean |

---
*Last updated: 2026-03-09 after v1.1 milestone start*
