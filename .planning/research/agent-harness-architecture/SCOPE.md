# Research Scope: Agent Harness Architecture for Expedite

## Context
Evolve the existing "expedite" Claude Code plugin from a prompt-driven orchestration system into a code-enforced agent harness. Expedite currently implements a complete decision-to-execution pipeline (scope -> research -> design -> plan -> spike -> execute) with 8 skills, YAML state management, prompt-enforced quality gates (G1-G5), and simple multi-agent dispatch via Task(). Everything works, but all state transitions, gate enforcement, step tracking, and resume logic is encoded in natural language instructions that the LLM interprets at runtime -- leading to state drift, gate bypass, and resume fragility.

The "agent harness" pattern has emerged in the Claude Code plugin community for plugins that go beyond simple skill packs to provide complete orchestration layers. Known exemplars include claude-code-harness (Chachamaru127) and everything-claude-code (affaan-m), but the pattern is broader. This research aims to understand the full landscape and produce a concrete adoption plan -- specific mechanisms with implementation guidance.

User context: Solo developer, personal/team tool (configuration complexity acceptable), willing to fully rebuild if justified.

## Constraints
- C1: Platform is Claude Code plugin API (skills, hooks, agents, Task(), worktrees, frontmatter conventions) (Source: technical requirement) -- All mechanisms must be implementable within Claude Code's plugin surface.
- C2: Nothing is architecturally locked -- full rebuild is acceptable if research justifies it (Source: user decision) -- Research can propose fundamental restructuring of state, gates, agent dispatch, etc.
- C3: Personal/team tool, not mass-market (Source: user decision) -- Configuration complexity and power-user patterns are acceptable.
- C4: SessionStart hook currently deferred due to 3 Claude Code platform bugs (Source: technical requirement) -- Hook designs should account for possible unavailability; research should check current platform status.
- C5: Existing lifecycle pipeline (scope->research->design->plan->spike->execute) is the workflow (Source: implicit -- it's the product) -- Research is about HOW to harden the pipeline, not WHETHER to change the stages.
- Excluded from scope: The expedite lifecycle design itself (what stages exist, what each stage does). This research is about orchestration mechanisms, not workflow design.

## Decision Areas

### DA-1: Hook Architecture for Runtime Guardrails
**Priority:** Critical
**Depth:** Deep dive
**Design question:** What hook types (PreToolUse, PostToolUse, Notification, SessionStart, Stop, SubagentStop, UserPromptSubmit, PreCompact, SessionEnd) should expedite implement, what should each hook enforce, and how should hook logic be structured (inline scripts vs. dispatched validators vs. state machine checks) to replace prompt-enforced quality gates with code-enforced guardrails?
**Evidence needed:**
- Inventory of hook types available in the Claude Code plugin API and their execution semantics (blocking vs. non-blocking, return values, error handling)
- Examples from harness repos of hooks used for gate enforcement, state validation, or behavioral guardrails (not just logging)
- Patterns for hook-based state machine enforcement: how hooks can prevent invalid phase transitions or tool use outside allowed context
- Evidence on SessionStart hook stability (has the platform bug been fixed? workarounds?)
- Performance and UX impact of hook-based validation (latency, error messaging, user override flow)
- Anti-patterns: cases where hook-based enforcement backfired or was too rigid
**Suggested research categories:** hook-mechanisms, harness-architecture-patterns
**Dependencies:** Informs DA-2 (state management must support what hooks need to read), DA-5 (gates become hook-enforced)
**User input:** "Largely unexplored" -- hooks are the user's biggest knowledge gap. They know the concept exists but have no implementation experience.
**Readiness criterion:** Ready when we have (a) a complete hook type inventory with execution semantics, (b) at least 3 real-world examples of hooks enforcing behavioral rules (not just logging), and (c) a clear pattern for hook-based gate enforcement that maps to expedite's G1-G5 gates.

### DA-2: State Management Architecture
**Priority:** Critical
**Depth:** Deep dive
**Design question:** What state management pattern should replace the current single-YAML-file approach -- considering state shape (flat vs. hierarchical vs. multi-file), persistence format (YAML vs. JSON vs. directory tree), write patterns (whole-file rewrite vs. append vs. event-sourced), and access patterns (direct file read vs. injected context vs. hook-mediated)?
**Evidence needed:**
- State management patterns used by 3+ harness repos (file structure, format, write patterns, recovery mechanisms)
- Comparison of single-file vs. multi-file vs. directory-based state (tradeoffs for LLM readability, atomicity, conflict risk, recovery)
- Event-sourced or append-only state patterns in agent systems (vs. complete-rewrite pattern)
- How state is consumed: injected into context via frontmatter? read on demand? cached in hooks?
- State schema evolution patterns: how harnesses handle adding new fields without breaking existing state
- Evidence on LLM reliability reading different state formats (YAML vs. JSON vs. structured markdown)
**Suggested research categories:** state-persistence-patterns, harness-architecture-patterns
**Dependencies:** DA-1 depends on state being queryable from hooks. DA-3 depends on state supporting multi-agent coordination.
**User input:** "YAML is all they know." User recognizes current approach has problems (drift, fragile recovery, whole-file rewrite risk) but has no visibility into alternatives.
**Readiness criterion:** Ready when we have (a) documented state patterns from at least 3 harnesses, (b) a clear comparison matrix of approaches on dimensions that matter (LLM readability, atomicity, recovery, hook compatibility), and (c) at least one pattern that demonstrably solves the state-drift and resume-fragility problems.

### DA-3: Agent Definition and Team Coordination
**Priority:** Critical
**Depth:** Deep dive
**Design question:** How should agents be formally defined (agent .md files with frontmatter? inline specs?), how should multi-agent teams be composed and coordinated (shared context? message passing? artifact hand-off?), and what coordination patterns prevent the failure modes of expedite's current inline Task() dispatch (no inter-agent communication, no shared state)?
**Evidence needed:**
- Agent .md file conventions: frontmatter schema, role definition patterns, tool restrictions, context injection from at least 4 repos
- Team coordination mechanisms: how do harnesses coordinate multiple agents working on related tasks (shared state? orchestrator pattern? event bus?)
- Inter-agent communication patterns: can agents see each other's output? share intermediate state? signal failures?
- Comparison of dispatch patterns: Task() vs. SendMessage vs. team-based coordination
- Failure handling in multi-agent setups: what happens when one agent fails, how is partial work preserved
- Scale patterns: how harnesses handle varying numbers of agents (fixed teams vs. dynamic dispatch)
**Suggested research categories:** agent-team-patterns, harness-architecture-patterns
**Dependencies:** DA-2 provides the shared state substrate. DA-7 defines how skills invoke agents.
**User input:** Current implementation is "simple dispatch -- no teams, no inter-agent communication, no shared state between agents." User knows this is limited but doesn't know what better looks like.
**Readiness criterion:** Ready when we have (a) agent .md frontmatter conventions from at least 4 repos with clear schema patterns, (b) at least 2 distinct coordination patterns documented with tradeoffs, and (c) concrete evidence that coordination patterns solve specific failure modes (not just theoretical benefits).

### DA-4: Worktree Isolation Strategy
**Priority:** Important
**Depth:** Standard
**Design question:** Should expedite use git worktrees to isolate agent work, and if so, what is the worktree lifecycle (creation, agent assignment, merge/discard, cleanup) and how does worktree state relate to lifecycle state?
**Evidence needed:**
- How harness repos use worktrees: which operations get isolated, how worktrees are created/destroyed, how results are merged back
- Worktree support in Claude Code's platform API (EnterWorktree/ExitWorktree semantics, Agent tool isolation parameter)
- Failure modes: what happens when a worktree merge conflicts, when an agent crashes mid-worktree, when multiple agents need the same worktree
- Whether worktree isolation is necessary for expedite's use case (research agents don't write code; execute agents do -- selective isolation?)
**Suggested research categories:** isolation-safety-patterns, harness-architecture-patterns
**Dependencies:** DA-3 (agents must be assigned to worktrees). DA-6 (execution phase is the primary worktree consumer).
**User input:** Mentioned as area of interest. No current implementation. User hasn't stated whether they think it's critical.
**Readiness criterion:** Ready when we have (a) at least 2 examples of worktree usage in harnesses with lifecycle documentation, and (b) a clear assessment of whether worktree isolation addresses any of expedite's stated pain points.

### DA-5: Quality Gate Enforcement Mechanism
**Priority:** Critical
**Depth:** Deep dive
**Design question:** How should expedite's G1-G5 quality gates transition from prompt-enforced inline evaluation to code-enforced validation -- what is the enforcement surface (hooks? dedicated validator agents? both?), what is the evaluation mechanism (rubric scoring? structured output parsing? dual-layer validation?), and how are gate failures and overrides handled programmatically?
**Evidence needed:**
- Examples of code-enforced quality checks in harness repos (pre-commit validation, output validation, phase transition guards)
- Patterns for structured gate evaluation: how harnesses evaluate quality criteria beyond "LLM says it's good"
- Override mechanisms that are auditable and traceable (not just a prompt flag)
- Integration between gate enforcement and state management (gates as state transition guards)
- How harnesses handle the "rubber stamp" problem -- preventing the evaluating LLM from being too lenient
**Suggested research categories:** hook-mechanisms, quality-validation-patterns
**Dependencies:** DA-1 (hooks as enforcement surface), DA-2 (state transitions as gate checkpoints), DA-3 (validator agents as gate evaluators)
**User input:** "Quality gates get ignored or rubber-stamped because they're prompt-enforced." This is a stated pain point. The user already has a dual-layer validation design concept (rubric + logical validation via external verifier agent) but hasn't implemented it.
**Readiness criterion:** Ready when we have (a) at least 2 code-enforced validation patterns from real repos, (b) evidence on whether hook-based vs. agent-based vs. hybrid gate enforcement is more reliable, and (c) a concrete pattern for preventing rubber-stamp evaluation.

### DA-6: Context and Memory Strategy
**Priority:** Important
**Depth:** Standard
**Design question:** How should expedite manage context across sessions and context resets -- what memory mechanisms (structured project memory, CLAUDE.md conventions, context injection, summarization) ensure that an LLM resuming work has the information it needs without exceeding context limits?
**Evidence needed:**
- Memory management patterns from harness repos: what gets persisted, in what format, how is it injected on resume
- CLAUDE.md and project memory conventions: what harnesses put in persistent memory vs. ephemeral context
- Context budget strategies: how harnesses handle the tradeoff between injecting enough context and staying within token limits
- Session handoff patterns: how harnesses ensure continuity when context resets mid-task
**Suggested research categories:** memory-context-patterns, harness-architecture-patterns
**Dependencies:** DA-2 (state is part of what gets restored on resume). DA-3 (agents may need different context than the orchestrator).
**User input:** Mentioned as area of interest. Current implementation has basic state recovery (artifact scanning) and project memory, but resume is "unreliable."
**Readiness criterion:** Ready when we have (a) memory/context patterns from at least 3 harnesses, and (b) at least one pattern that specifically addresses the "resume after context reset" failure mode.

### DA-7: Skill-Agent Interaction Architecture
**Priority:** Important
**Depth:** Standard
**Design question:** What is the proper boundary between skills (user-facing orchestration scripts) and agents (autonomous workers), how do skills invoke and supervise agents, and how does this interaction pattern differ from expedite's current approach where skills contain all logic and agents are just inline Task() calls?
**Evidence needed:**
- How harness repos separate skill definitions from agent definitions (file structure, responsibility boundaries)
- Invocation patterns: how skills dispatch agents, pass context, receive results, handle failures
- Supervision patterns: do skills actively monitor agents or just wait for results? can skills intervene mid-agent?
- Examples of skills that are thin orchestrators vs. skills that contain substantial logic (which pattern is more reliable?)
**Suggested research categories:** agent-team-patterns, harness-architecture-patterns
**Dependencies:** DA-3 (agent definitions), DA-1 (hooks may mediate skill-agent interaction)
**User input:** Mentioned as area of interest. Current design has skills as thick orchestrators (200-860 line .md files) with agents as thin inline dispatches.
**Readiness criterion:** Ready when we have (a) at least 3 examples of skill-agent boundary patterns, and (b) evidence on whether thick-skill or thick-agent patterns produce more reliable execution.

### DA-8: Resume and Recovery Architecture
**Priority:** Critical
**Depth:** Deep dive
**Design question:** What mechanisms ensure deterministic, reliable resume after context resets -- beyond artifact scanning, what patterns (checkpoint files, step-level state, idempotent operations, resume protocols) make it impossible for the LLM to "misread state or take wrong paths" on resume?
**Evidence needed:**
- Resume/recovery patterns from harness repos: how do they handle mid-task context resets
- Checkpoint mechanisms: granularity of checkpointing (phase-level vs. step-level vs. operation-level)
- Idempotency patterns: how harnesses ensure that re-running a step after a crash doesn't corrupt state or duplicate work
- Resume disambiguation: how harnesses prevent the LLM from choosing the wrong resume path when state is ambiguous
- Relationship between state management patterns (DA-2) and resume reliability
- Step-level tracking patterns that go beyond expedite's current current_step field
**Suggested research categories:** state-persistence-patterns, quality-validation-patterns
**Dependencies:** DA-2 (state format determines what's available for resume), DA-1 (hooks could enforce resume correctness)
**User input:** "Picking up after context reset is unreliable -- LLM misreads state or takes wrong paths." This is a stated pain point. Current system has step-level tracking (current_step) and artifact-based recovery, but it's insufficient.
**Readiness criterion:** Ready when we have (a) at least 2 concrete resume mechanisms from harness repos, (b) evidence on what granularity of checkpointing is sufficient (phase? step? sub-step?), and (c) a pattern that makes resume deterministic rather than heuristic.

### DA-9: Ecosystem Discovery and Pattern Taxonomy
**Priority:** Critical
**Depth:** Standard
**Design question:** What Claude Code plugins implement harness-like orchestration beyond the two known exemplars, what common patterns emerge across the ecosystem, and what maturity/adoption signals indicate which patterns are battle-tested vs. experimental?
**Evidence needed:**
- Comprehensive survey of Claude Code plugins/harnesses on GitHub (beyond claude-code-harness and everything-claude-code)
- Pattern taxonomy: classify discovered harnesses by which mechanisms they implement (hooks, agents, teams, worktrees, state management, etc.)
- Maturity signals: stars, contributors, commit frequency, issue activity, documentation quality
- Convergent patterns: mechanisms that appear independently in multiple harnesses (strong signal) vs. unique approaches (possibly innovative, possibly dead ends)
**Suggested research categories:** harness-architecture-patterns
**Dependencies:** Informs all other DAs -- discovery may reveal patterns not anticipated by other decision areas.
**User input:** "Cast a wide net -- search broadly for any Claude Code plugin that implements harness-like orchestration. Discovery is valuable."
**Readiness criterion:** Ready when we have (a) at least 5 harness repos identified and cataloged, and (b) a pattern frequency matrix showing which mechanisms appear in which repos.

## Research Category Mapping
| Category | Slug | Decision Areas Served | Priority |
|----------|------|-----------------------|----------|
| Hook Mechanisms | hook-mechanisms | DA-1, DA-5 | Critical |
| Harness Architecture Patterns | harness-architecture-patterns | DA-1, DA-2, DA-3, DA-4, DA-6, DA-7, DA-9 | Critical |
| State & Persistence Patterns | state-persistence-patterns | DA-2, DA-8 | Critical |
| Agent & Team Patterns | agent-team-patterns | DA-3, DA-7 | Critical |
| Isolation & Safety Patterns | isolation-safety-patterns | DA-4 | Standard |
| Quality & Validation Patterns | quality-validation-patterns | DA-5, DA-8 | Critical |
| Memory & Context Patterns | memory-context-patterns | DA-6 | Standard |

## Success Criteria
Research is complete when:
1. All 9 decision areas meet their individual readiness criteria (see above)
2. At least 5 harness repos have been identified and analyzed (DA-9 is the foundation)
3. Every Critical decision area has evidence from multiple independent sources (not just one repo's approach)
4. The evidence is concrete enough to produce an adoption plan with specific mechanisms, not just "use hooks" but "use PreToolUse hooks with this pattern for gate enforcement"
5. Known tradeoffs are documented for each major mechanism choice, enabling informed decisions during design
