# Expedite

## What This Is

Expedite is a Claude Code plugin that orchestrates a 5-phase research-to-implementation lifecycle: Scope, Research, Design, Plan, Execute. It turns "research a problem, then build a solution" into a structured, repeatable workflow with 5 quality gates, parallel research agents, crash-resilient state management, dual-intent support for both product managers and engineers, step-level progress tracking, and DA readiness enforcement across all gates. The plugin lives at `~/.claude/plugins/expedite/` and is invoked via `/expedite:` commands.

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
- ✓ Plugin metadata: version 1.0.0, .gitignore, architecture decision documentation — v1.1
- ✓ Step-level tracking across all 6 stateful skills with status display — v1.1
- ✓ Status diagnostics: log size warning (50KB) and artifact cross-reference — v1.1
- ✓ HANDOFF.md generation, revision, and G3 gate validation for product-intent — v1.1
- ✓ DA readiness enforcement: G2/G3 MUST criteria, G4/G5 SHOULD criteria — v1.1

### Active

<!-- Current scope for v1.2 — Infrastructure Hardening & Quality -->

- [ ] State recovery: detect malformed/corrupted state.yml and auto-recover from .bak
- [ ] Codebase analyst subagent type: switch from general-purpose to explore
- [ ] Conditional alternative-surfacing: present competing options only when genuine tradeoffs exist
- [ ] Split state.yml into scoped files with full coordination audit
- [ ] External verifier agent for research reasoning soundness
- [ ] Per-task atomic git commits during execute with DA traceability
- [ ] Skill line limit: soft 500-line cap with content extraction to references/

### Out of Scope

- Cross-lifecycle artifact import — novel feature, needs design research
- Locked constraints from imported artifacts — LLM enforcement unreliable
- SessionStart hook — deferred due to 3 open Claude Code bugs (#16538, #13650, #11509)
- Mobile/web UI — pure CLI plugin
- Multi-user collaboration — single-developer workflow
- Numeric scoring for sufficiency — categorical model working well

## Current Milestone: v1.2 Infrastructure Hardening & Quality

**Goal:** Harden plugin infrastructure (state resilience, state splitting, skill sizing) and elevate quality gates (research verifier, conditional alternatives, git traceability).

**Target features:**
- State recovery (malformed YAML + auto .bak fallback)
- Codebase analyst → explore subagent type
- Conditional alternative-surfacing in design/plan
- Split state.yml into scoped files
- External verifier agent for research reasoning
- Per-task atomic git commits in execute
- Skill line limit (500-line soft cap)

## Context

Shipped v1.1 with 5,968 LOC across Markdown, YAML, and JSON.
Plugin source: 7 skill directories + 10 prompt templates + 3 inline references + state templates.
Tech stack: Claude Code plugin platform (SKILL.md orchestrators, Task() subagents, plugin.json auto-discovery).
v1.0: 92 requirements satisfied across 13 phases in 11 days.
v1.1: 23 requirements satisfied across 5 phases in 2 days. Production polish — step tracking, status diagnostics, HANDOFF.md activation, gate enforcement.
Total: 18 phases, 43 plans, 115 requirements across 2 milestones.

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
| Defer LOW-confidence features to v2 | Cross-lifecycle import, locked constraints have weak evidence (HANDOFF.md validated in v1.1) | ✓ Good — kept scope tight |
| Keep dual intent in v1 | Product + engineering modes retained (HANDOFF.md now validated in v1.1) | ✓ Good — both paths work |
| Inline gates (not separate gate skill) | User decision D1 — streamlined UX, each skill validates own output | ✓ Good — cohesive skills |
| log.yml gitignored | User decision D5 — single-user workflow, less commit noise | ✓ Good — clean repos |
| Categorical sufficiency (not numeric) | Proven by research-engine, more stable than numeric scores | ✓ Good — clear thresholds |
| Hardcoded model tiers in frontmatter | Research-engine pattern, zero configuration | ✓ Good — no config burden |
| Freeform micro-interaction (not AskUserQuestion) | Avoids 60-second timeout, all 3 design proposals converged | ✓ Good — no timeouts |
| Research SKILL.md as lean orchestrator | Refactored from 1233→611 lines by moving prompts to references/ | ✓ Good — maintainable |
| Spike as separate skill (not inline in execute) | Per-phase granularity, optional usage, G5 gate boundary | ✓ Good — clean separation |
| Per-phase artifacts at .expedite/plan/phases/{slug}/ | User decision — collocate spike/execute outputs per phase | ✓ Good — organized |
| Case B override via *_in_progress + gate_history | Simpler than *_recycled phase tracking, uses existing state | ✓ Good — reliable |
| Sufficiency evaluator as Task() subagent (not inline) | Spec chose inline (~80K token savings). Implementation dispatches via Task() for context hygiene. | ✓ Good — context-clean |
| Hardcoded step counts in status lookup table | Dynamic parsing too fragile; update table when skill steps change | ✓ Good — reliable |
| G2/G3 DA criteria as MUST, G4/G5 as SHOULD | Research recommended SHOULD for judgment-adjacent checks to avoid mass Recycle | ✓ Good — balanced enforcement |
| Step 7b dual-path revision propagation | Mirrored sections sync from DESIGN.md, HANDOFF-only sections edited directly | ✓ Good — correct semantics |
| Three-branch Case B2 resume logic | Engineering/HANDOFF→Step 7, product/no HANDOFF→Step 6, no DESIGN.md→Step 2 | ✓ Good — covers all paths |

---
*Last updated: 2026-03-11 after v1.2 milestone started*
