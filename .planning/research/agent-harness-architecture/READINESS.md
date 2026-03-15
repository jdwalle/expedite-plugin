# Readiness Assessment: Agent Harness Architecture for Expedite

## Readiness Summary

- **Evaluation round:** 3 (after initial research, round-1 readiness check, round-2 gap research on hook handler types)
- **Overall:** 9 of 9 decision areas READY, 0 NEEDS MORE, 0 INSUFFICIENT
- **Estimated additional research effort:** None required
- **Recommendation:** Proceed to design. All decision areas have sufficient evidence to produce confident design decisions.

---

## Decision Area Assessments

### DA-1: Hook Architecture for Runtime Guardrails
**Status:** READY
**Priority:** Critical
**Evidence Coverage:** 6 of 6 requirements covered

| # | Evidence Requirement | Status | Evidence Found |
|---|---------------------|--------|----------------|
| 1 | Inventory of hook types with execution semantics (blocking vs. non-blocking, return values, error handling) | COVERED | Complete 16-event inventory from official docs with blocking classification, exit code semantics (0/1/2), matcher regex system, 4 handler types. Documented in category-hook-mechanisms.md with per-event table. |
| 2 | Examples from harness repos of hooks used for gate enforcement, state validation, or behavioral guardrails (not just logging) | COVERED | 3 concrete examples: claude-code-harness TypeScript guardrail engine (R01-R09 rules, SessionStart/PostToolUse/Stop), ECC Node.js hook scripts with runtime profiles and PreToolUse validation, claude-agentic-framework hook-based quality gates after each builder agent. All go beyond logging to active enforcement. |
| 3 | Patterns for hook-based state machine enforcement | COVERED | PreToolUse-as-state-machine-guard pattern documented with JSON config and shell script examples. Intercepts Write to state.yml, validates FSM transitions, exit code 2 blocks invalid writes. Prompt hook and agent hook patterns also documented for quality evaluation. |
| 4 | Evidence on SessionStart hook stability (platform bug status, workarounds) | PARTIALLY COVERED | Three bugs (#16538, #13650, #11509) identified as historical blockers. ECC's "root fallback" pattern for graceful degradation documented. No source confirmed current bug status as of March 2026. |
| 5 | Performance and UX impact of hook-based validation (latency, error messaging, user override flow) | PARTIALLY COVERED | Qualitative latency classification (command: ~100ms, prompt: 2-5s, agent: 30-60s+). permissionDecisionReason for user feedback. Anti-pattern of over-blocking documented with ECC's runtime profiles (minimal/standard/strict) as mitigation. No quantitative benchmarks. |
| 6 | Anti-patterns: cases where hook-based enforcement backfired or was too rigid | COVERED | Over-blocking, hook scope limitations (cannot modify system prompt, cannot inject context, no inter-hook communication), once:true frontmatter-only restriction, latency compounds for frequent events. ECC runtime profiles as mitigation pattern. |

**Readiness Criterion:** Ready when we have (a) complete hook type inventory with execution semantics, (b) at least 3 real-world examples of hooks enforcing behavioral rules, and (c) a clear pattern for hook-based gate enforcement mapping to G1-G5.

**Criterion Met:** Yes. (a) Complete 16-event inventory with blocking/non-blocking, exit codes, matcher system, and 4 handler types. (b) Three enforcement examples (harness TypeScript engine, ECC hook profiles, agentic-framework per-worker gates). (c) PreToolUse-as-state-machine-guard maps directly to G1-G5 with structural gates (G1/G2/G4) via command hooks and semantic gates (G3/G5) via agent hooks.

**Overall Assessment:** The round-2 gap research definitively resolved the blocking question about handler type availability in plugins. Official Anthropic documentation confirms command, prompt, and agent hooks all work in plugin hooks.json with schema parity to project settings. The two PARTIALLY COVERED items (SessionStart bug status and hook latency benchmarks) are implementation details, not architectural blockers -- the design can proceed with SessionStart fallback patterns and qualitative latency guidance. DA-1 is READY.

---

### DA-2: State Management Architecture
**Status:** READY
**Priority:** Critical
**Evidence Coverage:** 6 of 6 requirements covered

| # | Evidence Requirement | Status | Evidence Found |
|---|---------------------|--------|----------------|
| 1 | State management patterns from 3+ harness repos (file structure, format, write patterns, recovery) | COVERED | 4+ patterns: claude-code-harness (JSON config schema, guardrail-engine-managed), ECC (hook-distributed state, no monolithic file), LangGraph (checkpoint per step, pluggable backends), CrewAI (Pydantic-validated state). Each documented with file structure and write semantics. |
| 2 | Comparison of single-file vs. multi-file vs. directory-based state | COVERED | Explicit format comparison table (YAML/JSON/Markdown/directory-based) across LLM readability, programmatic parsing, atomicity, and token efficiency. Four write patterns compared (complete rewrite, append-only, directory-based, checkpoint). |
| 3 | Event-sourced or append-only state patterns | COVERED | LangGraph checkpoint system (append-only, replay, time travel). Expedite's own log.yml is append-only. ECC content-hash-cache pattern. Comparison with complete-rewrite pattern documented with pros/cons. |
| 4 | How state is consumed (injection patterns) | COVERED | 4 consumption patterns: frontmatter injection (simple, no filtering), hook-mediated injection (selective, ECC pattern), on-demand reading, checkpoint-based injection (LangGraph). Clear mapping to expedite's current and planned approaches. |
| 5 | State schema evolution patterns | COVERED | CrewAI Pydantic validation (invalid state never persisted), claude-code-harness JSON config schema (validated at load time), expedite's own version field and reserved v2 fields. Directory-based pattern noted as inherently evolution-friendly (add new files without breaking existing). |
| 6 | LLM reliability reading different state formats | COVERED | Explicit finding: LLMs handle YAML and JSON comparably. Key differentiator is injection strategy, not format. Directory-based rated highest token efficiency. |

**Readiness Criterion:** Ready when we have (a) documented state patterns from at least 3 harnesses, (b) a clear comparison matrix on dimensions that matter, and (c) at least one pattern that demonstrably solves state-drift and resume-fragility.

**Criterion Met:** Yes -- all three. (a) 4+ patterns from harnesses/frameworks. (b) Comparison matrix across readability, atomicity, token efficiency, programmatic parsing. (c) Directory-based + hook-enforced writes addresses state drift; checkpoint-based resume addresses fragility.

**Overall Assessment:** Strong evidence base with convergent signal toward directory-based state. Aligns with expedite's already-planned ARCH-02-06 split. The cross-cutting theme that "explicit state drives resume, not heuristics" is well-supported by multiple sources. No gaps.

---

### DA-3: Agent Definition and Team Coordination
**Status:** READY
**Priority:** Critical
**Evidence Coverage:** 6 of 6 requirements covered

| # | Evidence Requirement | Status | Evidence Found |
|---|---------------------|--------|----------------|
| 1 | Agent .md file conventions from at least 4 repos (frontmatter schema, role definition, tool restrictions, context injection) | COVERED | Official Claude Code subagent schema (12+ frontmatter fields documented in table). 5 repos with agent definitions: claude-code-harness (3 typed), ECC (12 typed), claude-agentic-framework (8 typed with model tiering), wshobson/agents (112 agents across 4 tiers), claude-orchestration (built-in + ephemeral). Exceeds 4-repo minimum. |
| 2 | Team coordination mechanisms | COVERED | 5 coordination patterns: subagents (hub-and-spoke), Agent Teams (mesh with shared task lists, mailbox), swarm dispatch (agentic-framework), workflow orchestrators (wshobson), flow-based (claude-orchestration). Two primary paradigms (subagent vs. teams) with detailed tradeoffs including token cost (3-4x for teams). |
| 3 | Inter-agent communication patterns | COVERED | 5 communication mechanisms in comparison table: artifact hand-off, agent summary return, shared task list, direct messages (SendMessage), broadcast. Latency and bidirectionality documented. Critical constraint: subagents cannot communicate during execution. |
| 4 | Comparison of dispatch patterns (Task() vs. SendMessage vs. team-based) | COVERED | Subagents vs. Agent Teams comparison with cost, coordination model, and communication tradeoffs. Swarm as middle pattern. Clear recommendation that expedite's pipeline architecture fits subagent pattern. |
| 5 | Failure handling in multi-agent setups | COVERED | 4 failure handling patterns documented: subagent failure (resume in foreground), team failure (lead observes/reassigns), swarm failure (per-worker gates, Beads tracking), general pattern (write to disk early, return codes). |
| 6 | Scale patterns (fixed teams vs. dynamic dispatch) | COVERED | Range from fixed agents (harness: 3) to large registries (wshobson: 112). Dynamic dispatch via context-driven activation, ephemeral agents, and swarm sizing (3-8). |

**Readiness Criterion:** Ready when we have (a) agent .md frontmatter conventions from at least 4 repos, (b) at least 2 distinct coordination patterns with tradeoffs, and (c) evidence that coordination patterns solve specific failure modes.

**Criterion Met:** Yes -- all three. (a) 5 repos + official schema. (b) 5 coordination patterns with clear tradeoffs. (c) Each pattern addresses specific failure modes (subagent: context isolation prevents interference; teams: lead reassigns on failure; swarms: per-worker gates catch bad output).

**Overall Assessment:** Excellent evidence base. The official subagent frontmatter schema (12+ fields) provides a concrete, actionable target for formalizing expedite's agents. Clear guidance that subagents are sufficient for expedite's pipeline architecture, with Agent Teams as future option.

---

### DA-4: Worktree Isolation Strategy
**Status:** READY
**Priority:** Important
**Evidence Coverage:** 4 of 4 requirements covered

| # | Evidence Requirement | Status | Evidence Found |
|---|---------------------|--------|----------------|
| 1 | How harness repos use worktrees (which operations isolated, creation/destruction, merge-back) | COVERED | ccswarm (per-agent worktrees, core architecture), claude_code_agent_farm (20+ parallel sessions, conflict prevention), ECC (worktree support for parallelization). Full lifecycle: --worktree flag or EnterWorktree tool for creation, auto-cleanup for no-change, manual merge for changed. |
| 2 | Worktree support in Claude Code API (EnterWorktree/ExitWorktree, isolation parameter) | COVERED | --worktree CLI flag (v2.1.49+), EnterWorktree/ExitWorktree tools, isolation: "worktree" subagent frontmatter field, WorktreeCreate/WorktreeRemove hooks. EnterWorktree limitation noted (new only, no resume). |
| 3 | Failure modes (merge conflicts, agent crashes, multiple agents same worktree) | COVERED | 4 failure modes: merge conflicts (manual resolution, mitigation via file ownership), agent crashes (worktree persists, manual cleanup needed), multiple agents same files (still conflicts even with worktrees), unwanted worktree creation bug. |
| 4 | Whether worktree isolation is necessary for expedite's use case | COVERED | Selective isolation table: execute skill (high), research agents (low -- write to .expedite/evidence/, not source), planning/design (none), spike (low-medium). Clear assessment: execute skill is the single high-value consumer. |

**Readiness Criterion:** Ready when we have (a) at least 2 examples of worktree usage in harnesses with lifecycle documentation, and (b) clear assessment of whether worktree isolation addresses expedite's pain points.

**Criterion Met:** Yes -- (a) 2 primary examples (ccswarm, agent_farm) plus ECC documentation. (b) Clear, specific assessment scoping worktree value to execute skill only.

**Overall Assessment:** Adequate evidence for an Important-priority area. The research clearly scopes value (execute skill only) and provides the implementation path (isolation: "worktree" frontmatter field). Failure modes documented with mitigations. Ready for design.

---

### DA-5: Quality Gate Enforcement Mechanism
**Status:** READY
**Priority:** Critical
**Evidence Coverage:** 5 of 5 requirements covered

| # | Evidence Requirement | Status | Evidence Found |
|---|---------------------|--------|----------------|
| 1 | Examples of code-enforced quality checks in harness repos | COVERED | 3 examples: claude-code-harness TypeScript rule engine (R01-R09, deterministic, testable), ECC /quality-gate skill with hook enforcement, claude-agentic-framework 5 parallel reviewers with per-worker quality gates. |
| 2 | Patterns for structured gate evaluation beyond "LLM says it's good" | COVERED | 6 validation patterns taxonomized: structural validation, separate judge, multi-agent verification (AIME, debate, RADAR), rubric + reasoning dual-layer, hook-based gate enforcement, deterministic rule engine. Each mapped to expedite's gates. |
| 3 | Override mechanisms that are auditable and traceable | COVERED | Expedite's existing override pattern (override-context.md, severity classification, gate_history overridden: true) assessed as good. Enhancement: PostToolUse hook for append-only audit trail. ROE Gate reference monitor as extreme example. |
| 4 | Integration between gate enforcement and state management | COVERED | Gates-as-state-transition-guards: PreToolUse on Write to state.yml validates phase advancement requires gate passage. Gate results as checkpoint data (timestamp, outcome, artifacts_at_gate). Code flow example provided. |
| 5 | How harnesses handle the rubber stamp problem | COVERED | Academic evidence quantifying biases (self-preference, position, verbosity, adversarial vulnerability; ~80% human alignment). Key insight: deterministic code for structural checks eliminates rubber stamp entirely. For semantic checks: separate judge model, multi-agent debate, structured output with temperature=0, majority vote. |

**Readiness Criterion:** Ready when we have (a) at least 2 code-enforced validation patterns, (b) evidence on hook-based vs. agent-based vs. hybrid gate enforcement reliability, and (c) a concrete pattern for preventing rubber-stamp evaluation.

**Criterion Met:** Yes -- all three. (a) 3+ code-enforced patterns. (b) Clear evidence hierarchy (deterministic code > separate agent > same-model LLM). (c) Two anti-rubber-stamp patterns: deterministic code for structural gates (G1/G2/G4), dual-layer rubric+reasoning for semantic gates (G3/G5).

**Overall Assessment:** Excellent evidence base. The structural-vs-semantic gate classification is the most actionable finding -- it provides a clear design path where 3 of 5 gates can be fully code-enforced (eliminating rubber stamp) and 2 gates need the dual-layer pattern that expedite already conceptualized. Academic grounding on the rubber stamp problem quantifies the risk of the current approach.

---

### DA-6: Context and Memory Strategy
**Status:** READY
**Priority:** Important
**Evidence Coverage:** 4 of 4 requirements covered

| # | Evidence Requirement | Status | Evidence Found |
|---|---------------------|--------|----------------|
| 1 | Memory management patterns from harness repos (what persists, format, injection on resume) | COVERED | 4+ patterns: ECC (SessionStart/Stop hooks for session handoff, strategic compaction), wshobson/agents (progressive disclosure: metadata always, instructions on activation, resources on demand), Claude Code subagent persistent memory (MEMORY.md index, 3 scopes), CrewAI 4-type taxonomy. MemGPT tiered model as conceptual foundation. |
| 2 | CLAUDE.md and project memory conventions | COVERED | CLAUDE.md hierarchy (repo root, .claude/rules/*.md, InstructionsLoaded hook). Agent Teams best practice for CLAUDE.md structuring. Expedite's existing project memory (MEMORY.md) acknowledged. |
| 3 | Context budget strategies | COVERED | 5 strategies: scoped injection (ARCH-02-06), hook-mediated context loading (ECC SessionStart), progressive disclosure (wshobson), strategic compaction (ECC suggest-compact.js, pre-compact.js, AUTOCOMPACT_PCT_OVERRIDE), summarization before injection. |
| 4 | Session handoff patterns for resume after context reset | COVERED | 4 handoff patterns: checkpoint-based (LangGraph, deterministic), state file with step tracking, session summary hooks (ECC Stop/SessionStart), artifact chain verification (code-enforceable). |

**Readiness Criterion:** Ready when we have (a) memory/context patterns from at least 3 harnesses, and (b) at least one pattern addressing "resume after context reset."

**Criterion Met:** Yes -- (a) 4+ harnesses/frameworks provide patterns. (b) 3 patterns address resume after context reset (checkpoint-based, session summary hooks, step-tracking-based resume).

**Overall Assessment:** Adequate-to-strong evidence for an Important-priority area. The MemGPT tiered memory model validates the planned state splitting. The session summary hook pattern (ECC) is directly implementable. The finding that current_step exists but is not used for resume provides an immediate low-cost improvement path.

---

### DA-7: Skill-Agent Interaction Architecture
**Status:** READY
**Priority:** Important
**Evidence Coverage:** 4 of 4 requirements covered

| # | Evidence Requirement | Status | Evidence Found |
|---|---------------------|--------|----------------|
| 1 | How harness repos separate skill definitions from agent definitions | COVERED | 4 boundary patterns: thick-skill/thin-agent (expedite current), thin-skill/thick-agent (claude-code-harness: 5 verb skills, 3 typed agents, TypeScript engine), plugin-per-concern (wshobson: avg 3.4 components per plugin), persona+swarm (agentic-framework: personas for single-agent, swarms for parallel). |
| 2 | Invocation patterns (dispatch, context passing, result handling, failure handling) | COVERED | Task() dispatch with subagent_type (current). Agent tool with frontmatter-defined agents (target). Swarm dispatch with 3-8 parallel agents. Flow-based with variable capture. Context passing via prompt assembly vs. skills/memory frontmatter. |
| 3 | Supervision patterns (monitoring, intervention) | PARTIALLY COVERED | Current: no mid-execution monitoring. Agent Teams: lead observes task status, reassigns. Swarm: per-worker quality gates as passive supervision. No evidence of active mid-agent intervention in any harness -- likely a platform limitation rather than a research gap. |
| 4 | Examples of thin vs. thick skills and which is more reliable | COVERED | 4 examples with analysis. Directional evidence favoring thin-skill/thick-agent with external enforcement (claude-code-harness produces testable enforcement). Honest caveat: observational, not experimental. Expedite's thick skills at practical limits (860 lines). |

**Readiness Criterion:** Ready when we have (a) at least 3 examples of skill-agent boundary patterns, and (b) evidence on whether thick-skill or thick-agent patterns produce more reliable execution.

**Criterion Met:** Yes -- (a) 4 distinct boundary patterns. (b) Directional evidence favoring thin-skill/thick-agent with external enforcement, with appropriate caveats about observational nature.

**Overall Assessment:** Adequate evidence for an Important-priority area. The PARTIALLY COVERED supervision requirement (#3) reflects a platform limitation, not a research gap -- mid-agent intervention does not appear to be possible in Claude Code. The four boundary patterns provide enough variety for informed design. The practical pressure from 860-line skills provides additional motivation for the thin-skill direction.

---

### DA-8: Resume and Recovery Architecture
**Status:** READY
**Priority:** Critical
**Evidence Coverage:** 6 of 6 requirements covered

| # | Evidence Requirement | Status | Evidence Found |
|---|---------------------|--------|----------------|
| 1 | Resume/recovery patterns from harness repos | COVERED | 4 patterns: LangGraph checkpoint-per-step (deterministic, thread-based), ECC session summary hooks (Stop writes, SessionStart reads), CrewAI flow persistence (Pydantic-validated, pause/resume across contexts), expedite's own checkpoint.yml (execute-only, task-level). |
| 2 | Checkpoint mechanisms and granularity | COVERED | LangGraph: per-graph-node (equivalent to per-step), many checkpoints, storage cheap. ECC: per-session. Expedite: per-task within execute. Clear finding: step-level is sufficient granularity for deterministic resume. |
| 3 | Idempotency patterns | COVERED | 4 strategies: checkpoint-as-idempotency-key (LangGraph), file-existence checks (expedite current, with partial-artifact limitation), content hashing (ECC SHA-256), checkpoint+step tracking combined (inputs_hash comparison). |
| 4 | Resume disambiguation (preventing wrong resume path) | COVERED | Key finding: "systems that resume reliably do so from explicit checkpoint data, not from interpreting artifacts." LangGraph: same checkpoint always produces same resume point. Contrast with expedite's heuristic approach creating 3 documented failure modes. |
| 5 | Relationship between state management and resume reliability | COVERED | Cross-cutting theme: directory-based state enables scoped resume, hook-enforced writes prevent state drift that corrupts resume, step-level tracking enables deterministic resume when actually used for resume logic. |
| 6 | Step-level tracking patterns beyond current_step | COVERED | LangGraph: full state snapshot per node with thread_id isolation. ECC: session summary with what/where/next. Expedite's checkpoint.yml: current_task + tasks_completed + continuation_notes. Critical gap identified: expedite tracks current_step but resume logic ignores it. |

**Readiness Criterion:** Ready when we have (a) at least 2 concrete resume mechanisms, (b) evidence on what granularity of checkpointing is sufficient, and (c) a pattern that makes resume deterministic rather than heuristic.

**Criterion Met:** Yes -- all three. (a) 3+ concrete mechanisms (LangGraph checkpoints, ECC session summaries, expedite's own checkpoint.yml). (b) Step-level is sufficient (per-node in LangGraph). (c) Explicit state drives resume pattern well-established.

**Overall Assessment:** Strong evidence base. The research identifies both the exact problem (current_step tracked but not used for resume) and the exact solution pattern (make resume logic read checkpoint state directly). Generalizing expedite's existing checkpoint.yml to all skills is a concrete, appropriately scoped adoption path that does not require LangGraph-level infrastructure.

---

### DA-9: Ecosystem Discovery and Pattern Taxonomy
**Status:** READY
**Priority:** Critical
**Evidence Coverage:** 4 of 4 requirements covered

| # | Evidence Requirement | Status | Evidence Found |
|---|---------------------|--------|----------------|
| 1 | Comprehensive survey of Claude Code plugins/harnesses | COVERED | 8 harness-like repos identified and cataloged (exceeding 5-repo minimum): claude-code-harness, ECC, claude-agentic-framework, wshobson/agents, claude-orchestration, ruflo, claude_code_agent_farm, ccswarm. Each with URL, description, architecture, key mechanisms, and maturity assessment. |
| 2 | Pattern taxonomy (classify by mechanisms implemented) | COVERED | Full mechanism-by-repo matrix: 8 repos x 8 mechanisms (hooks, state mgmt, agents, teams, worktrees, quality gates, memory/context, model tiering). Clear visualization of coverage. |
| 3 | Maturity signals (stars, contributors, commit frequency, documentation) | COVERED | Maturity table with stars (ECC: 72K+), contributors (ECC: 30+), test coverage (ECC: 997 tests), documentation quality, release cadence. ECC identified as maturity leader. claude-code-harness identified as strongest code-enforcement example. |
| 4 | Convergent patterns (appearing in multiple repos independently) | COVERED | 5 convergent patterns with repo counts: model tiering (4 repos), typed agent specialization (5 repos), multi-phase workflow cycles (4 repos), hook-based lifecycle management (3 repos), quality gate integration (4 repos). 5 unique innovations also cataloged. |

**Readiness Criterion:** Ready when we have (a) at least 5 harness repos identified and cataloged, and (b) a pattern frequency matrix showing which mechanisms appear in which repos.

**Criterion Met:** Yes -- (a) 8 repos (exceeding 5-repo minimum). (b) Complete pattern frequency matrix.

**Overall Assessment:** Strong evidence base. The ecosystem survey exceeded requirements. Convergent pattern analysis (4-5 independent implementations) provides high-confidence signals. Maturity assessment enables weighting implementations during design. The finding that expedite's core pipeline is architecturally sound -- gaps are in enforcement, formalization, and state management -- provides clear design direction.

---

## Gap Summary

No decision areas require additional research. All 9 are READY.

The following knowledge gaps remain from the original synthesis but are assessed as non-blocking for design:

| # | Gap | Relevant DA | Impact Assessment |
|---|-----|-------------|-------------------|
| 1 | SessionStart hook bug status (#16538, #13650, #11509) | DA-1 | Non-blocking. ECC's "root fallback" pattern provides graceful degradation. Design can proceed with fallback assumption. Verify during implementation. |
| 2 | Quantitative hook latency benchmarks | DA-1 | Non-blocking. Qualitative guidance (command: fast, prompt: seconds, agent: tens of seconds) is sufficient for architectural decisions. Measure during implementation. |
| 3 | Frontmatter hooks `once: true` behavior | DA-1 | Non-blocking. Minor implementation detail. Test during development. |
| 4 | State file write atomicity | DA-2 | Non-blocking. The backup-before-write protocol and hook-based validation provide defense regardless. Test during implementation. |
| 5 | Real-world hook failure rates | DA-1 | Non-blocking. Start with minimal hooks, expand based on experience. ECC's runtime profiles provide the mitigation pattern. |
| 6 | Agent Teams maturity | DA-3 | Non-blocking. Recommendation is subagents (not teams) for expedite. Teams is a future option. |
| 7 | Subagent nesting limitations | DA-3 | Non-blocking. Expedite's architecture does not require nested subagent dispatch. |

---

## Research Strengths

**Strongest coverage areas:**

1. **DA-5 (Quality Gate Enforcement)**: The combination of academic evidence on rubber-stamp bias, 6-pattern validation taxonomy, 3 real-world code-enforced implementations, and the structural-vs-semantic gate classification makes this the most immediately actionable research area. The design path is clear.

2. **DA-9 (Ecosystem Discovery)**: 8 repos exceeding the 5-repo minimum, with a complete mechanism-by-repo matrix and convergent pattern analysis providing strong independent validation signals.

3. **DA-3 (Agent Definition)**: The official Claude Code subagent schema (12+ frontmatter fields) documented from primary sources, combined with 5 repo examples, provides a concrete and well-documented target for formalizing expedite's agents.

4. **DA-8 (Resume and Recovery)**: The precise diagnosis (current_step tracked but not used for resume) combined with a proven solution pattern (explicit state drives resume) and an existing codebase precedent (checkpoint.yml in execute skill) makes this exceptionally actionable.

5. **DA-2 (State Management)**: Convergent signal from 4+ independent sources toward directory-based state, aligning with expedite's planned ARCH-02-06 split, provides strong validation.

---

## Changes from Previous Rounds

### Round 1 to Round 2
- **Gap filled**: DA-1 hook handler type availability in plugins. Official Anthropic documentation confirmed command, prompt, and agent hooks all available in plugin hooks.json. This upgraded DA-1 from NEEDS MORE to READY.

### Round 2 to Round 3 (this evaluation)
- **No new gaps discovered**: Independent re-evaluation of all 9 decision areas confirms the round-2 assessment.
- **No gaps remain that block design**: The 7 remaining knowledge gaps are all implementation-level concerns (latency benchmarks, bug status, atomicity behavior) that can be verified during development.
- **Previous assessment accuracy**: The round-2 supplement-synthesis correctly assessed all 9 DAs as READY. This independent evaluation confirms that assessment.

---

## Overall Assessment

The research base is strong and sufficient to produce a confident design for the agent harness architecture. All 9 decision areas meet their readiness criteria, with evidence from 8 harness repos, 3 industry frameworks (LangGraph, CrewAI, MemGPT/Letta), academic papers (arXiv survey on LLM-as-Judge), and official Claude Code documentation. The 5 cross-cutting themes (separation of enforcement from orchestration, file-level atomicity, deterministic code over LLM judgment, explicit state drives resume, progressive complexity in coordination) provide unifying architectural principles that span the individual decision areas.

The research is strongest on quality gate enforcement (academic grounding + 6 validation patterns + clear structural-vs-semantic classification), ecosystem discovery (8 repos with convergent pattern analysis), and agent definitions (official schema + 5 repo examples). The weakest areas are worktree isolation (adequate but fewer real-world examples) and skill-agent interaction (directional evidence without controlled comparisons), but both meet their readiness criteria at their assigned priority levels (Important, not Critical).

The biggest remaining risk is not an evidence gap but a design integration challenge: combining hooks (DA-1), state splitting (DA-2), gate enforcement (DA-5), and resume determinism (DA-8) into a coherent enforcement architecture requires careful layering. The research provides the individual patterns but the synthesis across patterns is the design task, not the research task.

**Recommendation:** Proceed to design. No further research rounds needed.
