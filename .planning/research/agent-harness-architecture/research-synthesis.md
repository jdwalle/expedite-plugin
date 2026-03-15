# Research Synthesis: Agent Harness Architecture for Expedite

## Executive Summary

- **Hooks are the foundational enforcement surface** and 3 of 8 surveyed harnesses use them for lifecycle management. Claude Code provides 16 hook event types with 4 handler types (command, HTTP, prompt, agent), giving expedite a rich programmatic enforcement surface that it currently does not use at all.
- **The strongest code-enforcement pattern is deterministic rule engines** (not LLM-based evaluation). claude-code-harness's TypeScript guardrail engine with 9 compiled rules is the most reliable gate enforcement pattern discovered — it eliminates the rubber stamp problem entirely for structural checks.
- **Directory-based state (file-per-concern) is the convergent pattern** for state management in agent systems. It provides file-level atomicity, scoped injection (only load what you need), and parallel-safe writes — directly addressing expedite's token waste and monolithic state problems.
- **Subagent hub-and-spoke is sufficient for expedite's coordination needs**; Agent Teams (mesh communication) exists but at 3-4x token cost and is designed for collaborative work, not expedite's artifact-pipeline pattern. The more important upgrade is formalizing agent definitions with the official frontmatter schema.
- **Resume reliability requires using step-level tracking for actual resume logic**, not just display. Expedite already tracks `current_step` but resume logic ignores it in favor of artifact-existence heuristics. LangGraph's checkpoint-per-step pattern demonstrates that deterministic resume from explicit state is the proven approach.
- **Model tiering is the strongest convergent signal** across the ecosystem — 4 of 8 repos independently arrived at the same 3-tier model strategy (Haiku/Sonnet/Opus). Expedite already partially implements this (Sonnet for workers, Opus for synthesizer).
- **Worktree isolation has narrow but clear value** for expedite: the execute skill is the only skill that modifies source code, making it the single high-value worktree consumer.

---

## Findings by Decision Area

### DA-1: Hook Architecture for Runtime Guardrails

**Evidence summary**: Claude Code provides 16 hook event types with 4 handler types. The most enforcement-relevant hooks are PreToolUse (blocking — can deny tool calls), UserPromptSubmit (blocking — can modify/block prompts), and PostToolUse (non-blocking audit). Command hooks are fastest (shell scripts), prompt hooks add 2-5 seconds (LLM call), and agent hooks take 30-60+ seconds. Exit code 2 from command hooks blocks tool execution. Matchers use regex on tool names, enabling precise targeting (e.g., intercept only Write calls to state files).

**Key patterns from ecosystem**:
- claude-code-harness: TypeScript guardrail engine called from hooks as "thin shims." 3-layer architecture separates hook wiring (JSON config) from enforcement logic (TypeScript, testable). Uses SessionStart, PostToolUse, Stop.
- ECC: Node.js hook scripts with runtime profiles (`ECC_HOOK_PROFILE=minimal|standard|strict`). Hooks at all 4 lifecycle phases. Continuous learning via PostToolUse.
- claude-agentic-framework: Hook-based quality gates after each builder agent (tests, linting, type checks).

**App analysis gap assessment**: Expedite has zero hooks. No hook registrations in plugin.json. No TypeScript/JavaScript/shell scripts. The entire enforcement layer must be built from scratch. SessionStart hook is deferred due to 3 platform bugs (#16538, #13650, #11509) — ECC addresses this with a "root fallback" pattern.

**Evidence quality**: **Strong**. Official documentation provides complete hook type inventory with execution semantics. Three real-world examples demonstrate hooks enforcing behavioral rules (not just logging). The PreToolUse-as-state-machine-guard pattern maps directly to expedite's G1-G5 gates.

---

### DA-2: State Management Architecture

**Evidence summary**: Four write patterns identified: complete rewrite (expedite's current), append-only/event-sourced, directory-based/file-per-concern, and checkpoint snapshots. LLMs handle YAML and JSON comparably — the differentiator is injection strategy, not format. Three state consumption patterns: frontmatter injection (simple, no filtering), hook-mediated injection (selective, transformable), and on-demand reading (token-efficient, LLM-dependent).

**Key patterns from ecosystem**:
- claude-code-harness: JSON config schema, validated at load time. State managed through guardrail engine, not a separate file.
- ECC: Distributed state across hook-managed artifacts. No monolithic state file. SessionStart loads, Stop persists.
- LangGraph: Checkpoint per step with thread-based isolation. Pluggable backends. Deterministic resume from checkpoint.
- CrewAI: Pydantic-validated state — invalid state never gets persisted.

**App analysis gap assessment**: Expedite uses a single monolithic state.yml with complete-file rewrite. State grows with questions and gate history, wasting tokens. Planned split (ARCH-02 through ARCH-06) into state.yml (~15 lines), questions.yml, tasks.yml, gates.yml aligns with the directory-based pattern. The backup-before-write protocol is a manual transaction mechanism that could be replaced by hook-based validation.

**Evidence quality**: **Strong**. Multiple independent sources (LangGraph, CrewAI, 3 harness repos) provide concrete state patterns. The comparison matrix covers dimensions that matter (LLM readability, atomicity, recovery, hook compatibility). The directory-based pattern demonstrably solves token waste and parallel-write safety.

---

### DA-3: Agent Definition and Team Coordination

**Evidence summary**: Claude Code's official subagent format uses Markdown files with YAML frontmatter supporting 12+ fields (name, description, tools, disallowedTools, model, permissionMode, maxTurns, skills, mcpServers, hooks, memory, isolation). Storage locations have priority ordering: CLI flag > project `.claude/agents/` > user `~/.claude/agents/` > plugin `agents/` directory. Two coordination paradigms exist: subagents (hub-and-spoke, no inter-agent communication) and Agent Teams (mesh communication with shared task lists and mailbox system, 3-4x token cost).

**Key patterns from ecosystem**:
- claude-code-harness: 3 typed agents tightly coupled to Plan-Work-Review cycle.
- ECC: 12 typed agents with explicit specializations and model assignments.
- claude-agentic-framework: 8 worker types with model tiering (Haiku for exploration, Sonnet for implementation, Opus for architecture).
- wshobson/agents: 112 agents across 4 model tiers with plugin-per-concern isolation.
- claude-orchestration: Declarative flow syntax with ephemeral agents and variable capture.

**App analysis gap assessment**: Expedite's 6 agents are prompt templates in `skills/{skill}/references/prompt-*.md` with minimal frontmatter (subagent_type, model). No standalone agent .md files, no formal agent registry, no tool restrictions per agent, no persistent memory. The official subagent format offers significantly richer capabilities (tool allowlists, hooks, isolation, memory) that expedite does not use. Inter-agent communication is artifact-only (file hand-off), which is the weakest coordination pattern but may be sufficient for expedite's pipeline architecture.

**Evidence quality**: **Strong**. Official subagent documentation provides complete frontmatter schema. 5 repos demonstrate agent definitions with clear conventions. Two distinct coordination patterns (subagent vs. teams) documented with tradeoffs. Evidence connects coordination patterns to specific failure modes.

---

### DA-4: Worktree Isolation Strategy

**Evidence summary**: Claude Code supports worktrees through `--worktree` CLI flag (v2.1.49+), `EnterWorktree`/`ExitWorktree` tools, and the `isolation: "worktree"` frontmatter field for subagents. Worktree-isolated subagents get automatic cleanup if no changes were made; if changes exist, the worktree path and branch are returned. `WorktreeCreate`/`WorktreeRemove` hooks enable custom lifecycle management. Failure modes include merge conflicts (requiring manual resolution), orphaned worktrees from crashes, and concurrent edits to same files.

**Key patterns from ecosystem**:
- ccswarm: Built entirely around worktree isolation. Each agent gets its own worktree.
- claude_code_agent_farm: 20+ parallel sessions, worktrees prevent file conflicts.
- ECC: Documents worktree support for parallelization.
- Extending beyond git: Database isolation per worktree (Damian Galarza, March 2026).

**App analysis gap assessment**: Expedite has zero worktree usage. Only the execute skill modifies source code — this is the single high-value worktree consumer. Research agents write to `.expedite/evidence/` (not source code), making worktree isolation unnecessary for them. Spike researcher writes to `.expedite/plan/phases/` with low conflict risk.

**Evidence quality**: **Adequate**. Two examples of worktree usage in harnesses (ccswarm, agent_farm). Clear assessment that worktree isolation addresses expedite's execute-phase isolation need but is low-value for other phases. The `isolation: "worktree"` subagent field makes adoption straightforward.

---

### DA-5: Quality Gate Enforcement Mechanism

**Evidence summary**: Six validation patterns identified, ranging from fully deterministic (structural validation, rule engines) to fully LLM-dependent (separate judge, multi-agent verification). Academic research confirms the rubber stamp problem: LLMs exhibit self-preference bias, position bias, verbosity bias, and adversarial vulnerability. Single-model self-evaluation aligns with human preferences only ~80% of the time.

**Key patterns from ecosystem**:
- claude-code-harness: TypeScript rule engine (R01-R09). Deterministic, testable, no LLM judgment for structural rules.
- ECC: `/quality-gate` skill. Hook-based enforcement.
- claude-agentic-framework: 5 parallel reviewers (security, performance, architecture, tests, quality) with multiple passes.
- AIME framework: Concatenated independent evaluations across dimensions.
- Multi-Agent Judge with Debate: Critic/defender/judge roles enable smaller models to approximate larger model reasoning depth.

**App analysis gap assessment**: Expedite's G1-G5 gates are all prompt-enforced. Gates G1 (Scope) and G4 (Plan) are primarily structural — they check artifact existence, counts, and coverage. These can be fully code-enforced with no LLM judgment. Gates G3 (Design) and G5 (Spike) have LLM-judgment components that require the rubric + reasoning dual-layer pattern. The existing dual-layer verifier concept (Phase 24) aligns with the research evidence. The PreToolUse-hook-as-state-transition-guard pattern can prevent phase advancement without gate passage.

**Evidence quality**: **Strong**. Multiple code-enforced validation patterns from real repos. Clear evidence that hook-based structural validation is more reliable than LLM-based evaluation. Concrete pattern (PreToolUse on Write to state.yml) for preventing gate bypass. Academic evidence quantifying the rubber stamp problem.

---

### DA-6: Context and Memory Strategy

**Evidence summary**: The MemGPT tiered memory model (core/recall/archival) is the conceptual foundation: not all state belongs in context. Claude Code provides 5 context mechanisms: frontmatter injection, SessionStart hooks, PreCompact hooks, subagent persistent memory (new), and CLAUDE.md conventions. Context budget strategies include scoped injection, hook-mediated loading, progressive disclosure, strategic compaction, and summarization.

**Key patterns from ecosystem**:
- ECC: Strategic compaction with `suggest-compact.js` and `pre-compact.js`. SessionStart/Stop hooks for session handoff.
- wshobson/agents: Progressive disclosure (metadata always loaded, instructions on activation, resources on demand).
- Claude Code subagent memory: Per-agent persistent memory with MEMORY.md index (200 lines) auto-loaded.
- CrewAI: 4-type memory taxonomy (short-term, long-term, entity, contextual).

**App analysis gap assessment**: Expedite injects full state.yml via frontmatter at every skill invocation — no filtering. Planned state splitting (ARCH-02 through ARCH-06) addresses the scoped injection need. No PreCompact handling exists — context can be lost during compaction without preservation. Subagent persistent memory is unused — research agents could maintain learning across lifecycles. The session handoff pattern (Stop hook saves summary, SessionStart hook loads it) would directly address the "resume after context reset" failure mode.

**Evidence quality**: **Adequate**. Memory/context patterns from 4+ harnesses. Multiple patterns address the resume-after-context-reset failure mode (session summary hooks, checkpoint-based handoff, step tracking). The MemGPT tiering principle validates expedite's planned state splitting.

---

### DA-7: Skill-Agent Interaction Architecture

**Evidence summary**: Four skill-agent boundary patterns identified across the ecosystem. The key architectural question is where orchestration logic lives (thick skill vs. thick agent vs. external engine).

**Key patterns from ecosystem**:
- claude-code-harness: **Thin skill / thick agent**. 5 verb skills as orchestrators. 3 typed agents with substantial logic. TypeScript engine handles enforcement separately. Clear separation of concerns.
- wshobson/agents: **Plugin-per-concern**. Average 3.4 components per plugin. Context-driven skill activation. Minimal token overhead.
- claude-agentic-framework: **Persona + swarm**. Personas for single-agent, swarms for parallel multi-agent. 65+ context-aware skills.
- expedite (current): **Thick skill / thin agent**. Skills are 500-860 lines containing all logic. Agents are simple prompt templates.

**App analysis gap assessment**: Expedite's thick-skill pattern has reached practical limits (860 lines for research). The planned 500-line soft cap (MAINT-01 through MAINT-04) requires decomposition. Moving enforcement logic out of skills into hooks/engines would reduce skill size. Formalizing agents with the official subagent schema (tool restrictions, hooks, memory) would enable thicker agents. The harness pattern suggests enforcement (hooks/engine) + orchestration (skills) + execution (agents) as three distinct layers.

**Evidence quality**: **Adequate**. Three distinct skill-agent boundary patterns documented with tradeoffs. Evidence suggests that the thin-skill/thick-agent pattern with external enforcement produces more reliable execution because enforcement is testable and deterministic. However, no controlled comparison exists — this is pattern observation, not experimental evidence.

---

### DA-8: Resume and Recovery Architecture

**Evidence summary**: Resume reliability depends on the granularity and determinism of checkpoint data. Four resume patterns: checkpoint-based (LangGraph — deterministic, per-step), step-tracking with state file, session summary hooks (ECC), and artifact chain verification. Idempotency strategies include checkpoint-as-idempotency-key (LangGraph), file-existence checks (expedite current), content hashing (ECC), and checkpoint+hash combined.

**Key patterns from ecosystem**:
- LangGraph: Checkpoint per graph node execution. Thread-based isolation. Deterministic resume — same checkpoint always produces same resume point. This is the gold standard.
- CrewAI: Pydantic-validated state with persistence backends. Flows can pause and resume across execution contexts.
- ECC: Stop hooks write session summary. SessionStart hooks read it. Creates a "handoff document" between sessions.
- expedite (execute only): checkpoint.yml with current_task, tasks_completed, status, continuation_notes. The most sophisticated resume mechanism in expedite's codebase but limited to one skill.

**App analysis gap assessment**: Expedite's core resume problem is that `current_step` is tracked but not used for resume. Resume logic uses artifact-existence heuristics instead. This creates three failure modes: (1) partial artifacts confuse the heuristic, (2) the LLM may interpret state differently on resume, and (3) mid-step crashes leave ambiguous state. Generalizing the execute skill's checkpoint.yml pattern to all skills, combined with making resume logic read `current_step` directly, would address the stated pain points without requiring LangGraph-level infrastructure.

**Evidence quality**: **Strong**. Two concrete resume mechanisms (LangGraph checkpoints, ECC session summaries). Clear evidence that step-level checkpointing is sufficient granularity — LangGraph uses per-node (equivalent to per-step), not sub-step. The pattern for deterministic resume (explicit state, not heuristic interpretation) is well-established.

---

### DA-9: Ecosystem Discovery and Pattern Taxonomy

**Evidence summary**: 8 harness-like repos identified and cataloged, exceeding the 5-repo minimum. Pattern frequency analysis reveals strong convergent signals (model tiering in 4 repos, typed agent specialization in 5, multi-phase workflow cycles in 4, hook-based lifecycle in 3, quality gate integration in 4). Unique innovations include TypeScript guardrail engines, continuous learning/instincts, declarative flow syntax, and semantic revert.

**Key patterns from ecosystem**: See the pattern frequency matrix in the harness architecture patterns document. The strongest convergent signals (independently developed by 3+ repos) are:
1. Model tiering (4 repos)
2. Typed agent specialization (5 repos)
3. Multi-phase workflow cycles (4 repos)
4. Hook-based lifecycle management (3 repos)
5. Quality gate integration (4 repos)

**App analysis gap assessment**: Expedite already implements multi-phase workflow cycles and typed agent specialization. It partially implements model tiering (2 tiers: Sonnet/Opus). It does not implement hooks, deterministic quality gates, or formal agent definitions. The ecosystem shows that expedite's core pipeline architecture is sound — the gaps are in enforcement, formalization, and state management.

**Evidence quality**: **Strong**. 8 repos identified. Pattern frequency matrix shows which mechanisms appear across repos. Maturity signals documented (stars, contributors, test coverage, documentation quality). ECC is the clear maturity leader (72K+ stars, 997 tests, v1.8.0).

---

## Cross-Cutting Themes

### Theme 1: Separation of Enforcement from Orchestration
The strongest architectural signal across the ecosystem is that enforcement logic (state validation, gate checking, permission control) should be architecturally separate from orchestration logic (step sequencing, user interaction, agent dispatch). claude-code-harness achieves this with a TypeScript engine. ECC achieves it with hook scripts. claude-agentic-framework achieves it with per-worker quality gates. Expedite currently merges enforcement and orchestration into the same SKILL.md files.

### Theme 2: File-Level Atomicity Over Monolithic State
Every mature harness avoids monolithic state files. Whether through JSON config schemas (harness), hook-distributed state (ECC), artifacts directories (agentic-framework), or flow variables (orchestration), the pattern is consistent: separate concerns into separate files/locations. This enables scoped injection, parallel-safe writes, and concern-specific recovery.

### Theme 3: Deterministic Code Over LLM Judgment for Structural Checks
Structural validation (does the file exist? does it have required sections? is the count above threshold?) should be code-enforced, not LLM-evaluated. LLM judgment should be reserved for semantic quality (is the reasoning sound? is the evidence convincing?). This two-layer approach appears in multiple forms across the ecosystem.

### Theme 4: Explicit State Drives Resume, Not Heuristics
Systems that resume reliably do so from explicit checkpoint data, not from interpreting artifacts. LangGraph's per-step checkpoints, ECC's session summaries, and expedite's own checkpoint.yml (execute-only) all encode "where I am and what to do next" explicitly. Artifact-existence heuristics are a fallback, not a primary resume mechanism.

### Theme 5: Progressive Complexity in Agent Coordination
The ecosystem shows a clear progression: subagents (simple, cheap) → swarms (parallel, moderate cost) → Agent Teams (collaborative, expensive). Most harnesses use the simpler patterns. Agent Teams are designed for genuinely collaborative work (cross-layer features, architectural debate), not for pipeline-style artifact hand-off. Expedite's pipeline architecture fits the subagent pattern well.

---

## Tensions and Contradictions

### Hook Power vs. Hook Latency
PreToolUse hooks provide the strongest enforcement surface (blocking, can deny tool calls), but every hook adds latency to the tool execution path. Command hooks are fast (~100ms) but limited to shell scripting. Prompt hooks are context-aware but add 2-5 seconds. Agent hooks are powerful but add 30-60+ seconds. For frequently-firing hooks (every Write call), latency compounds. The tension is between enforcement completeness and user experience.

### Thick Agent vs. Thin Agent
claude-code-harness advocates thin skills / thick agents (enforcement in a separate engine). wshobson/agents advocates plugin-per-concern (many small components). Expedite's current thick-skill pattern works but has reached size limits. The research does not provide a definitive answer on which boundary pattern is more reliable — only pattern observations. The "right" boundary likely depends on the enforcement architecture choice.

### Monolithic State Simplicity vs. Distributed State Correctness
Complete-file rewrite is simple and deterministic (no merge logic). Directory-based state is more correct (scoped injection, parallel-safe) but introduces cross-file consistency challenges. If skill A writes to `questions.yml` while skill B reads `state.yml`, the two files could be temporarily inconsistent. Hooks can mediate this, but it adds architectural complexity.

### SessionStart Hook Value vs. Platform Bugs
SessionStart is the most natural enforcement point for context loading, state verification, and session handoff. Three platform bugs (#16538, #13650, #11509) have historically prevented reliable use. ECC's "root fallback" pattern provides graceful degradation, but the core question — are these bugs now fixed? — remains unverified by this research.

### Subagent Simplicity vs. Agent Team Capability
Subagents cannot communicate during execution — coordination is artifact-only. Agent Teams enable real-time collaboration but at 3-4x token cost. For expedite's pipeline architecture (each phase produces artifacts consumed by the next), subagents are likely sufficient. But for future capabilities (e.g., parallel research agents that discover overlapping findings and need to coordinate), Agent Teams might become necessary. The tension is between current sufficiency and future flexibility.

### Code-Enforced Gates vs. Flexibility
Deterministic code-enforced gates (TypeScript rule engines, schema validators) eliminate the rubber stamp problem but are rigid. If a gate rule is wrong, it blocks legitimate work with no recourse except changing code. Prompt-enforced gates are susceptible to rubber-stamping but are flexible. The expedite override mechanism (user-initiated, auditable) mitigates this tension but needs to work with code-enforced gates too.

---

## Relevance to Expedite

### What Matters Most for This Plugin

**1. PreToolUse hook on state writes is the single highest-value adoption.** It would immediately prevent invalid phase transitions (the stated "state drift" pain point), enforce gate passage before phase advancement (the "gate bypass" pain point), and validate state schema on every write. This is a command hook (fast, deterministic) that reads the proposed Write content, checks phase transition validity, and blocks if invalid.

**2. Generalizing checkpoint.yml to all skills addresses resume fragility.** Expedite already has the pattern (execute skill). Extending it to scope, research, design, plan, and spike — with resume logic that reads the checkpoint directly instead of interpreting artifact existence — would make resume deterministic.

**3. State splitting (already planned as ARCH-02 through ARCH-06) aligns with ecosystem consensus.** The file-per-concern pattern is validated by multiple independent harnesses. Implementing the planned split would reduce token waste and enable scoped injection.

**4. Formalizing agents with the official subagent schema is low-effort, high-value.** Moving from prompt templates in `references/` to `.claude/agents/` with full frontmatter (tool restrictions, model, memory, hooks) would enable tool isolation, persistent agent memory, and per-agent hooks — without changing the dispatch pattern.

**5. Structural gates (G1, G2, G4) can be code-enforced today.** These gates check artifact existence, counts, and coverage — all implementable as deterministic scripts. This eliminates the rubber stamp problem for 3 of 5 gates. Semantic gates (G3, G5) still need the dual-layer pattern (structural + reasoning).

### What Matters Less for This Plugin

**Agent Teams**: Expedite's pipeline architecture (each phase produces artifacts consumed by the next) is well-served by subagents. Agent Teams' 3-4x token cost and collaborative features are designed for a different coordination pattern.

**Continuous learning / instincts**: ECC's learning system is powerful but designed for a general-purpose harness that improves over time. Expedite's skills are hand-crafted decision-support workflows — learning is less relevant than enforcement.

**Declarative flow syntax**: claude-orchestration's flow DSL is elegant but solves a different problem (ad-hoc workflow composition). Expedite's pipeline is fixed and well-defined.

**Enterprise-grade distributed systems**: ruflo's distributed consensus protocols and RAG integration are overkill for a personal/team tool.

---

## Knowledge Gaps

1. **SessionStart hook bug status**: Three bugs (#16538, #13650, #11509) blocked SessionStart. No source confirmed whether these are resolved as of March 2026. This matters because SessionStart is the natural point for context loading, state verification, and session handoff.

2. **Hook handler type availability in plugins**: The research documents 4 handler types (command, HTTP, prompt, agent) but doesn't clarify whether all 4 are available in plugin-registered hooks (via `hooks/hooks.json`) vs. only in project settings. This affects whether expedite can use prompt/agent hooks from its plugin.

3. **Performance data for hook latency**: No source provided quantitative latency measurements for hook execution. "Command hooks are fastest" and "agent hooks take 30-60+ seconds" are qualitative claims without benchmarks.

4. **Frontmatter hooks `once: true` behavior**: Documentation states this parameter only works in skill/agent frontmatter hooks, not project settings. The interaction between plugin-registered hooks and skill-level hooks needs clarification.

5. **State file write atomicity**: No source addresses whether Claude Code's Write tool is atomic (all-or-nothing) or whether a crash mid-write could produce a corrupted file. This matters for the backup-before-write protocol.

6. **Real-world hook failure rates**: No source documents how often hooks produce false positives/negatives in practice. The anti-pattern of "over-blocking" is mentioned but not quantified.

7. **Agent Teams maturity**: Agent Teams is documented as requiring Opus 4.6+ and v2.1.32+. No evidence on production reliability, edge cases, or failure modes beyond the official documentation.

8. **Subagent nesting limitations**: Documentation says subagents cannot spawn other subagents. It's unclear whether this is a platform constraint or a configurable limit, and whether it affects expedite's potential orchestrator-agent architecture.

---

## Source Quality Assessment

### Overall Confidence: **High for Core Mechanisms, Moderate for Edge Cases**

**Strongest evidence areas**:
- Hook type inventory and execution semantics (official documentation + multiple tutorials + real implementations)
- Agent definition conventions (official documentation + 5 repo examples)
- State management patterns (3 harness repos + 2 industry frameworks: LangGraph, CrewAI)
- Rubber stamp problem (academic research: arXiv survey + multiple empirical studies)
- Ecosystem catalog (8 repos identified and analyzed)

**Moderate evidence areas**:
- Worktree isolation (2 repos + official documentation, but limited real-world failure mode data)
- Memory/context strategies (conceptual frameworks from MemGPT/CrewAI + 2 harness implementations)
- Skill-agent boundary patterns (4 patterns observed but no comparative effectiveness data)

**Weakest evidence areas**:
- Hook performance characteristics (qualitative only, no benchmarks)
- SessionStart bug status (stale information, needs live verification)
- Agent Teams reliability (new feature, limited production data)
- Long-term maintenance burden of different architectural patterns (no longitudinal data)

**Source diversity**: Research draws from official Claude Code documentation, 8 GitHub repositories, 3 industry frameworks (LangGraph, CrewAI, MemGPT/Letta), academic papers (arXiv survey on LLM-as-Judge), multiple tutorial/blog sources, and the expedite codebase itself. No single source dominates the findings. The convergent patterns (appearing in 3+ independent repos) represent the strongest signals.
