# Expedite

## What This Is

Expedite is a Claude Code plugin that orchestrates a 5-phase research-to-implementation lifecycle: Scope, Research, Design, Plan, Execute. It turns "research a problem, then build a solution" into a structured, repeatable workflow with 5 quality gates (3 structural + 2 dual-layer semantic), 8 formalized agents with model tiering, thinned step-sequencer skills dispatching agents by name, crash-resilient state management, dual-intent support for both product managers and engineers, step-level progress tracking, DA readiness enforcement across all gates, a code-enforced agent harness with FSM-validated state transitions, checkpoint-based deterministic resume, session handoff, worktree-isolated task execution, and per-task atomic git commits. The plugin lives at `~/.claude/plugins/expedite/` and is invoked via `/expedite:` commands.

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
- ✓ State recovery: auto-detect missing/corrupted state.yml and recover from artifacts — v1.2
- ✓ State splitting: 5 scoped files (state.yml, checkpoint.yml, questions.yml, gates.yml, tasks.yml) with per-skill injection — v2.0
- ✓ PreToolUse hook enforcement: FSM phase transitions, schema validation, gate passage requirements — v2.0
- ✓ PostToolUse audit hook: append-only override and state change trail — v2.0
- ✓ PreCompact hook: checkpoint backup + session summary before compaction — v2.0
- ✓ Stop hook: session summary persistence for session handoff — v2.0
- ✓ Override mechanism: deny → write override to gates.yml → retry state write — v2.0
- ✓ Checkpoint-based deterministic resume for all skills — v2.0
- ✓ Session handoff via session-summary.md across session boundaries — v2.0
- ✓ Agent formalization — 8 agents in `agents/*.md` with frontmatter (model, tools, maxTurns, system prompt) — v3.0
- ✓ Model tiering — Opus for synthesizer/architect/verifier, Sonnet for all others — v3.0
- ✓ Per-agent memory — research-synthesizer and gate-verifier get `memory: project` — v3.0
- ✓ Skill thinning — all skills refactored to step-sequencer + agent-dispatcher (100-255 lines) — v3.0
- ✓ Gate write path redirect — skills write gate results to `.expedite/gates.yml` (fixed INT-01/FLOW-01) — v3.0
- ✓ Structural gate enforcement — G1, G2-structural, G4 as Node.js scripts writing to gates.yml — v3.0
- ✓ Semantic gate dual-layer — G3, G5 + G2-semantic via gate-verifier agent with anti-rubber-stamp measures — v3.0
- ✓ Worktree isolation — task-implementer runs in isolated git worktree with merge-back — v3.0
- ✓ Per-task git workflow — atomic commits, conventional format, selective staging, opt-out, failed-task handling, git error pausing — v3.0

### Active

(None — planning next milestone)

### Out of Scope

- Cross-lifecycle artifact import — novel feature, needs design research
- Locked constraints from imported artifacts — LLM enforcement unreliable
- SessionStart hook — deferred due to 3 open Claude Code bugs (#16538, #13650, #11509)
- Mobile/web UI — pure CLI plugin
- Multi-user collaboration — single-developer workflow
- Numeric scoring for sufficiency — categorical model working well
- TypeScript for hooks — build step overhead not justified for solo developer
- Agent Teams (mesh communication) — 3-4x token cost; pipeline fits hub-and-spoke
- Fine-tuned evaluator models — structured rubrics capture 75-80% of benefit

## Context

Shipped v3.0 with agent harness completion (Phases 30-37). 5 milestones complete: v1.0 (13 phases), v1.1 (5 phases), v1.2 (1 phase), v2.0 (5 phases), v3.0 (8 phases).
Plugin source: 7 skill directories + 8 agent definitions + 5 gate scripts + 10 prompt templates + 3 inline references + state templates + 6 hook scripts + 7 hook library modules.
Tech stack: Claude Code plugin platform (SKILL.md step-sequencers, Agent() dispatch by name, plugin.json auto-discovery) + Node.js hooks/gates (js-yaml).
Total: 32 phases, 71 plans, 179 requirements across 5 milestones.
Codebase: ~20,010 LOC (JS/MD/JSON/YML plugin source).
Hook latency: p99 ~21ms (well under 300ms target).
7 tech debt items carried forward (live runtime tests pending, schema naming mismatch).

## Constraints

- **Plugin platform**: Must follow Claude Code plugin conventions (auto-discovery, SKILL.md orchestrators, plugin.json)
- **No subagents for interactive phases**: Design, plan, execute run in main session (constraint C-7 from design)
- **Subagents only for parallel research**: Task() used exclusively for research evidence gathering
- **Max 3 concurrent research subagents**: Conservative ceiling per Anthropic guidance
- **AskUserQuestion not in subagents**: Hard platform constraint (GitHub #12890)
- **MCP tools require foreground execution**: Hard platform constraint (GitHub #13254, #19964)
- **SessionStart hook bugs**: 3 open bugs (#16538, #13650, #11509) — fallback layers required
- **State size**: state.yml under 15 lines (split format), scoped files loaded per consumption matrix

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
| Archive v1.2 with Phase 19 only | Phases 20-24 subsumed by agent harness architecture — broader scope, same goals | ✓ Good — avoids redundant work |
| Three-layer architecture (Enforcement + Orchestration + Execution) | All 3 design proposals converge. 4+ harness implementations validate pattern. | ✓ Good — enforcement layer shipped, orchestration layer (skills) working |
| Node.js for all hook scripts (js-yaml, no build step) | Cross-platform, testable, reliable YAML parsing. Shell YAML parsing too fragile for enforcement. | ✓ Good — 6 hooks, p99 21ms, zero build complexity |
| Two-milestone agent harness approach | M1-M2 first (foundation + validation), M3-M8 only after empirical validation of A1/A2/A3 | ✓ Good — A1 confirmed, A2 validated (21ms), A3 estimated 70-85% |
| 5-file state split | Consumption matrix drives per-skill injection, reduces context load | ✓ Good — skills load only what they need |
| Hooks fail-open on unexpected errors | Avoid blocking development workflow; enforcement is additive safety | ✓ Good — no workflow disruption |
| Checkpoint-primary, artifact-fallback resume | Deterministic from checkpoint.yml; heuristic fallback only when checkpoint missing | ✓ Good — reliable resume in all 6 skills |
| Override deadlock prevention | gates.yml writes bypass gate-passage checks; only schema-validated | ✓ Good — override flow never self-blocks |
| Shared reference injection pattern | skills/shared/ref-*.md files injected via !cat in skill preambles | ✓ Good — DRY protocol injection |
| Step-sequencer + agent-dispatcher skill pattern | Skills are thin orchestrators (100-255 lines); agents own business logic | ✓ Good — maintainable, testable |
| Gate-verifier pre-build validation before dual-layer commitment | Tested 5 artifacts across quality range; GO decision confirmed | ✓ Good — evidence_support most discriminating dimension |
| Structural-first, semantic-second gate evaluation | Structural recycle blocks semantic dispatch (saves tokens) | ✓ Good — fast feedback on structural issues |
| 4-dimension semantic scoring (evidence, consistency, assumptions, completeness) | Anti-rubber-stamp: chain-of-thought reasoning required per dimension | ✓ Good — weak artifacts correctly recycled |
| Worktree isolation only for task-implementer | All other agents have EnterWorktree in disallowedTools | ✓ Good — minimal blast radius |
| Git commit protocol in reference file (not inline) | Keeps execute skill under 200 lines | ✓ Good — separation of concerns |
| Merge conflicts pause (never auto-resolve) | Destructive auto-resolution too risky for user code | ✓ Good — safe default |
| Spike writes own phase transitions | spike_in_progress/spike_complete enables G5 gate and clean handoff to execute | ✓ Good — fixed BREAK-1/2/3 |

---
*Last updated: 2026-03-17 after v3.0 milestone*
