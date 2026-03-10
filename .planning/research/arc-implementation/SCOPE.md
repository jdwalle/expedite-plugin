# Research Scope: arc Plugin Implementation Architecture

## Context

We are designing the implementation architecture for **arc**, a Claude Code plugin that orchestrates a 5-phase research-to-implementation lifecycle (Scope, Research, Design, Plan, Execute). The complete product design specification exists at `.planning/research/lifecycle-plugin-design/design/PRODUCT-DESIGN.md` and defines WHAT the plugin does from the user's perspective. This research is focused entirely on HOW to build it -- the file structure, skill decomposition, prompt engineering, state management, subagent orchestration, gate evaluation logic, and source routing implementation.

Two proven reference implementations exist: **research-engine** (multi-agent research with scope decomposition, category-based parallel research, readiness gating, gap research, and multi-agent design synthesis) and **GSD** (plan/execute lifecycle with state management, roadmap tracking, wave-based parallel execution, verification loops, and multi-agent orchestration). Both are production-tested Claude Code plugins that solve related problems. The primary research strategy is to study these implementations deeply, extract reusable patterns, and combine them with web research on Claude Code plugin architecture, prompt engineering, and orchestration patterns to produce a confident implementation design.

The consumer of this research is arc's Design phase, which will produce an implementation design document that can be directly planned and executed.

## Constraints

- **C-1**: Five sequential phases: Scope, Research, Design, Plan, Execute (Source: product design, D-7). Research should focus on how to implement each phase, not whether to have them.
- **C-2**: File-based state in `.arc/` directory using YAML for machine state and Markdown for human artifacts (Source: product design, decisions 8-9). No database, no API state storage.
- **C-3**: Go/Hold/Recycle three-outcome gate model with MUST/SHOULD criteria split (Source: product design, decisions 4-5). Gates are between every adjacent phase pair.
- **C-4**: Pre-planned question checklist as primary research bound (Source: product design, decision 6). Questions are defined in Scope, answered in Research, evaluated at gates.
- **C-5**: Hybrid source routing -- categorize then dispatch to 2-3 sources (Source: product design, decision 7). Deterministic type-to-source mapping.
- **C-6**: SessionStart hook for context reconstruction after `/clear` (Source: product design, decision 10). 3-5 line summary injection.
- **C-7**: Subagents for parallel research; main session for everything else (Source: product design, decision 11). No multi-agent design or execution.
- **C-8**: Single design agent for v1 (Source: product design, decision 12). Multi-agent design deferred.
- **C-9**: Reference configs only -- no bundled MCP servers (Source: product design, decision 20). Plugin ships setup docs, not servers.
- **C-10**: Plugin name "arc" with `/arc:` namespace (Source: product design, decision 21). Skills: scope, research, design, plan, execute, status.
- **C-11**: Per-question sufficiency using three criteria: coverage, corroboration, actionability (Source: product design, decision 25). SUFFICIENT / PARTIAL / INSUFFICIENT / INSUFFICIENT-SOURCE-UNAVAILABLE.
- **C-12**: Condensed subagent returns of 1,000-2,000 tokens (Source: product design, decision 28).
- **C-13**: Tiered model assignment -- fast for research subagents, primary for judgment (Source: product design, decision 29). Configurable.
- **C-14**: Single `sources.yml` file for all source configuration (Source: product design, decision 30).
- **C-15**: "Continue? (yes / pause / review)" micro-interaction between execution tasks (Source: product design, decision 24).
- **C-16**: Wave-based task ordering in Plan phase (Source: product design, decision 27). Waves, not phases, to avoid naming collision.
- **C-17**: Single lifecycle at a time per project (Source: product design, decision 23). Archive on new start.
- **C-18**: Self-improvement deferred to v2; passive `log.yml` data collection only (Source: product design, decision 19).
- **C-19**: Intent declared explicitly in Scope (product vs. engineering), not inferred (Source: product design). Flows as metadata through all phases.
- **C-20**: Product design is the primary constraint, but better implementation approaches discovered through research can be adopted (Source: user clarification 4).

## Decision Areas

### DA-1: Plugin File Structure and Skill Decomposition
**Priority:** Critical
**Depth:** Deep dive
**Design question:** How should the arc plugin be organized as a Claude Code plugin -- what is the directory layout, how are skills defined, how do skills reference shared resources (prompt templates, workflow definitions, agent definitions), and how does the plugin.json manifest declare everything?

**Evidence needed:**
- Exact Claude Code plugin directory structure conventions (plugin.json schema, skills/ directory layout, references/ subdirectories, how `${CLAUDE_PLUGIN_ROOT}` resolves)
- How research-engine organizes its 5 skills, prompt templates, and shared resources across the file tree (exact paths and cross-references)
- How GSD organizes its commands (slash commands vs. skills), workflows, agents, templates, and references across ~/.claude/commands/ and ~/.claude/get-shit-done/
- The difference between plugin skills (SKILL.md files with frontmatter) and custom slash commands (markdown files in ~/.claude/commands/) -- capabilities, limitations, tool access declarations
- How skill frontmatter (name, description, allowed-tools, agent, argument-hint) controls runtime behavior and tool availability
- Best practices for organizing prompt templates that are loaded at runtime by orchestrator skills and injected into subagent prompts

**Suggested research categories:** plugin-architecture, reference-implementation-analysis
**Dependencies:** None -- this is foundational; all other DAs build on it
**User input:** Arc should be a plugin (not slash commands). Reference implementations should be studied deeply.
**Readiness criterion:** Ready when we have a complete inventory of research-engine's and GSD's file structures, understand the plugin.json schema and skill frontmatter format, and can articulate the specific directory layout for arc with confidence that it follows Claude Code conventions.

---

### DA-2: State Machine and Lifecycle Management
**Priority:** Critical
**Depth:** Deep dive
**Design question:** How should `state.yml` be read, written, and validated across skills to implement the 5-phase lifecycle with correct phase transitions, resume-after-clear behavior, lifecycle archival, and artifact checksum tracking?

**Evidence needed:**
- How GSD implements STATE.md -- what fields it tracks, how it is read/written by different commands, how it handles resume after context loss
- How research-engine tracks research progress (per-question status, discovery counts, gap-fill rounds) across separate skill invocations
- YAML read/write patterns in Claude Code skills -- how skills parse YAML from files, update specific fields, and write back without corrupting the document
- The SessionStart hook implementation pattern -- how to register hooks in plugin.json, what context is available, how to inject summary text, and the token budget for hook output
- State validation patterns -- how to detect stale or corrupted state files, how to handle partial writes (skill interrupted mid-write), how to reconcile state.yml with actual file artifacts on disk
- Archival implementation -- how to move `.arc/` contents to `.arc/archive/[slug]/` while preserving sources.yml and marking archived state

**Suggested research categories:** plugin-architecture, reference-implementation-analysis, state-management-patterns
**Dependencies:** DA-1 (file structure determines where state lives)
**User input:** File-based state is decided. The specific state.yml schema is in the product design. Focus on implementation patterns.
**Readiness criterion:** Ready when we have concrete patterns for YAML state read/write in Claude Code, understand how both reference implementations handle state persistence across /clear boundaries, and have a validated approach for the SessionStart hook.

---

### DA-3: Gate Evaluation and Readiness Checking Implementation
**Priority:** Critical
**Depth:** Deep dive
**Design question:** How should the four readiness gates (G1-G4) be implemented -- where does gate logic live (inline in skills vs. shared module vs. dedicated skill), how are MUST/SHOULD criteria evaluated, how does the Go/Hold/Recycle decision get rendered to the user, and how does the override mechanism work?

**Evidence needed:**
- How research-engine's check-readiness skill evaluates decision areas against evidence requirements -- the exact flow from reading SCOPE.md criteria through spawning an evaluator agent to producing READINESS.md
- How GSD's verification system works -- how the verifier agent evaluates must_haves against actual codebase, the gap_found/passed/human_needed status routing, and the plan-phase --gaps loop
- Whether gates should be separate skills (/arc:gate), inline functions within phase skills, or shared reference documents that multiple skills include
- How to implement the MUST/SHOULD criteria split programmatically -- parsing criteria from state.yml/SCOPE.md, evaluating each, aggregating into Go/Hold/Recycle
- The override mechanism -- how `--override` flag on a skill invocation reads state.yml, records the override in gate_history, injects gap context into the next phase's prompt
- Recycle limit tracking -- how to count per-gate and per-question recycles from state.yml and surface escalating warnings (1st informational, 2nd suggests scope adjustment, 3rd recommends override)

**Suggested research categories:** reference-implementation-analysis, state-management-patterns, prompt-engineering
**Dependencies:** DA-2 (gates read/write state.yml), DA-4 (gates may spawn evaluator agents)
**User input:** Go/Hold/Recycle model is decided. MUST/SHOULD split is decided. Focus on implementation mechanics.
**Readiness criterion:** Ready when we have a concrete implementation pattern for gate evaluation (where the logic lives, how criteria are checked, how results are rendered), validated by studying how both reference implementations handle their equivalent quality gates.

---

### DA-4: Subagent Orchestration and Token Efficiency
**Priority:** Critical
**Depth:** Deep dive
**Design question:** How should research subagents be spawned, managed, and their results collected -- what is the exact Task() invocation pattern, how is context minimized for subagent bootstrapping, how are condensed returns enforced, and how does the tiered model assignment work?

**Evidence needed:**
- How research-engine spawns parallel web research agents -- the exact Task() call pattern, how SCOPE.md categories are mapped to agent prompts, how results are collected and fed to the synthesis agent
- How GSD spawns parallel executor agents in execute-phase -- the wave-based parallel spawning pattern, how plan content is inlined (not @-referenced), how Task() blocks until completion
- The Task tool's actual API -- parameters (prompt, subagent_type, model, description), blocking behavior, return value format, parallel invocation limits, and error handling when subagents fail
- How to enforce condensed returns (1,000-2,000 tokens) -- whether this is a prompt instruction, a Task parameter, or relies on output file conventions
- Context fork isolation patterns -- how to construct minimal subagent prompts (~5K tokens) that include only the relevant question + source config, avoiding the full ~50K conversation context
- Tiered model assignment implementation -- how to read model preferences from state.yml/config and pass them as the `model` parameter to Task(), and what model identifiers are valid (opus, sonnet, haiku, fast)

**Suggested research categories:** reference-implementation-analysis, subagent-orchestration, plugin-architecture
**Dependencies:** DA-1 (prompt templates live in the file structure), DA-5 (research subagents use source routing)
**User input:** Subagents for research, main session for everything else. Condensed returns. Tiered models. Study both reference implementations deeply.
**Readiness criterion:** Ready when we have the exact Task() invocation pattern used by both reference implementations, understand how to minimize subagent context, and have a concrete approach for model tier configuration that matches Claude Code's actual Task tool API.

---

### DA-5: Source Routing and MCP Integration
**Priority:** Important
**Depth:** Deep dive
**Design question:** How should the hybrid source routing system be implemented -- how does `sources.yml` get discovered and parsed, how are question types mapped to source capabilities, how does the source checklist UX work within a CLI skill, how are MCP server availability checks performed, and how does the fallback/circuit-breaker pattern work?

**Evidence needed:**
- How research-engine routes research to different source types (web search vs. app analysis vs. category-specific research) -- whether this is hardcoded per-step or configurable
- How Claude Code plugins detect and interact with MCP servers -- whether `.mcp.json` is directly readable, whether there's an API for checking MCP server availability, and what tools MCP servers expose
- The AskUserQuestion tool API and capabilities -- how to present the source checklist with checkable/uncheckable items, toggle behavior, and the "go to proceed" pattern described in the product design
- How to implement source-type routing in a prompt -- whether the research subagent prompt includes explicit instructions per source ("use WebSearch for market questions, use gh CLI for codebase questions") or whether routing is handled by the orchestrator
- Circuit breaker / fallback implementation within a subagent -- how to detect source failure (timeout, error), retry once, then mark degraded, all within a single research subagent's execution
- The INSUFFICIENT-SOURCE-UNAVAILABLE status -- how to distinguish "source returned nothing relevant" from "source was unreachable" in the sufficiency assessment

**Suggested research categories:** reference-implementation-analysis, source-integration, plugin-architecture
**Dependencies:** DA-4 (subagents execute source queries), DA-2 (source preferences stored in state)
**User input:** Hybrid routing is decided. Reference configs only. sources.yml schema is in the product design.
**Readiness criterion:** Ready when we understand how MCP servers are discovered and queried from within a Claude Code plugin, have a concrete implementation for the source checklist UX, and have validated the routing pattern (orchestrator-level vs. subagent-level) against the reference implementations.

---

### DA-6: Prompt Engineering for Phase Operations
**Priority:** Critical
**Depth:** Deep dive
**Design question:** How should the prompt templates for each phase's core operations be designed -- what is the optimal structure for scope questioning prompts, research subagent prompts, sufficiency assessment prompts, design synthesis prompts, plan decomposition prompts, and execution task prompts?

**Evidence needed:**
- The actual prompt templates used by research-engine (prompt-scope-decomposer.md, prompt-web-researcher.md, prompt-readiness-evaluator.md, prompt-research-synthesizer.md, prompt-decision-resolver.md, prompt-plan-validator.md, prompt-design-reviser.md, prompt-plan-synthesizer.md, prompt-confidence-auditor.md, prompt-gap-researcher.md, prompt-gap-synthesizer.md) -- their structure, role definitions, output format specifications, and quality standards
- The actual agent definitions used by GSD (gsd-executor.md, gsd-planner.md, gsd-plan-checker.md, gsd-verifier.md, gsd-phase-researcher.md) -- their XML-structured prompts, step-by-step protocols, deviation rules, and completion format specifications
- Best practices for prompt engineering in multi-agent systems -- how to write prompts that produce consistent, structured output suitable for downstream consumption by other agents
- How to design sufficiency assessment prompts that reliably evaluate coverage, corroboration, and actionability -- the three-criteria model specified in the product design
- How to structure the intent-adaptive prompts (product vs. engineering) so the same prompt template produces appropriate output for both intents based on a metadata flag
- The "Terraform plan-apply" pattern for the scope questioning -- how to structure the Round 3 question plan preview so the user sees exactly what research will be done before tokens are spent

**Suggested research categories:** reference-implementation-analysis, prompt-engineering, subagent-orchestration
**Dependencies:** DA-4 (prompts are injected into subagent Task() calls), DA-1 (prompt templates live in the file structure)
**User input:** Study both reference implementations' prompt templates deeply. The product design specifies what each phase should produce but not how the prompts should be structured.
**Readiness criterion:** Ready when we have analyzed all prompt templates from both reference implementations, identified reusable patterns (role definition, output format, quality gates, structured return formats), and have a concrete prompt architecture that covers all 5 phases plus gate evaluation.

---

### DA-7: Execute Phase Implementation
**Priority:** Important
**Depth:** Deep dive
**Design question:** How should the Execute phase implement task-by-task execution in the main session -- how does the "Continue? (yes / pause / review)" micro-interaction work within a skill, how are checkpoints written and resumed, how are acceptance criteria verified, and how does PROGRESS.md get maintained?

**Evidence needed:**
- How GSD's execute-phase orchestrator spawns subagent executors, handles wave-based parallelism, collects results, and routes by verification status (passed/gaps_found/human_needed)
- How GSD's gsd-executor agent handles the task loop -- loading plan, executing tasks sequentially, committing per-task, handling checkpoints, creating SUMMARY.md, and updating STATE.md
- How to implement the "Continue? (yes / pause / review)" interaction within a Claude Code skill -- whether this uses AskUserQuestion, freeform prompting, or a custom interaction pattern
- Checkpoint file format and resume logic -- how to write per-task checkpoints (t01-checkpoint.md) that capture enough state for a subsequent /arc:execute invocation to resume from the correct point after a /clear
- How the product design's Execute phase differs from GSD's execute-phase -- arc runs tasks sequentially in the main session (no subagent per task), while GSD spawns subagent executors per plan
- Acceptance criteria verification patterns -- how to programmatically check whether a task's acceptance criteria are met (file existence, test passing, build success) vs. criteria that require human judgment

**Suggested research categories:** reference-implementation-analysis, state-management-patterns, prompt-engineering
**Dependencies:** DA-2 (checkpoints are state management), DA-6 (execution prompts)
**User input:** Arc executes tasks in the main session, not via subagents per task. The "Continue?" micro-interaction is a key UX element. Study GSD's execution patterns but adapt for arc's simpler single-session model.
**Readiness criterion:** Ready when we understand GSD's execution orchestration deeply enough to adapt it for arc's simpler model (sequential in main session), have a concrete checkpoint/resume pattern, and know how to implement the Continue? interaction.

---

### DA-8: Research Phase Orchestration
**Priority:** Important
**Depth:** Deep dive
**Design question:** How should the Research phase orchestrate per-question evidence gathering -- how are questions dispatched to subagents, how does the per-question sufficiency assessment work, how are dynamic question discoveries handled, how is SYNTHESIS.md regenerated, and how does gap-fill mode (re-running /arc:research after a Recycle) work?

**Evidence needed:**
- How research-engine's research-topic skill orchestrates the full flow: app analysis (optional) -> parallel web researchers (one per category) -> synthesis -- including how category results are collected and fed to the synthesizer
- How research-engine's research-gaps skill implements targeted gap research: reading READINESS.md for gap descriptions, grouping related gaps, spawning targeted researchers, producing supplement-synthesis.md
- The per-question research model arc uses vs. research-engine's per-category model -- how to adapt category-based parallel research to question-based parallel research where each subagent handles one question across multiple sources
- How to implement the 60-second progress update requirement -- whether this is a polling loop, periodic subagent status reporting, or something else within Claude Code's Task tool constraints
- Gap-fill mode detection and scoping -- how /arc:research reads state.yml to detect it is in gap-fill mode (gate returned Recycle), identifies failing questions, and scopes research to only those questions
- Dynamic question discovery implementation -- how a research subagent proposes a new question, how the orchestrator presents it for user approval via AskUserQuestion, and how the approved question gets added to state.yml's question list

**Suggested research categories:** reference-implementation-analysis, subagent-orchestration, prompt-engineering
**Dependencies:** DA-4 (subagent spawning), DA-5 (source routing), DA-2 (state tracking)
**User input:** The product design's per-question model is different from research-engine's per-category model. Research should determine the best adaptation strategy — use best judgment and do additional design work if this distinction has a big overall impact on the architecture. If per-category turns out to be clearly better, recommend changing the product design accordingly.
**Readiness criterion:** Ready when we have a concrete orchestration flow for the Research phase that handles both initial research and gap-fill mode, with per-question sufficiency tracking, dynamic discovery, and synthesis regeneration -- validated against research-engine's proven patterns.

---

### DA-9: Intent-Adaptive Behavior Implementation
**Priority:** Important
**Depth:** Deep dive
**Design question:** How should the product/engineering intent adaptation be implemented across all 5 phases -- where does intent checking occur, how do prompt templates adapt based on intent, how do output artifacts change structure, and how is the connected flow (PM -> Dev handoff via HANDOFF.md) implemented?

**Evidence needed:**
- How the intent flag flows through state.yml and is consumed by each skill -- whether each skill checks intent independently from state.yml or whether it is injected as context at skill start
- How to implement intent-adaptive prompt templates -- whether to use conditional sections within a single template, separate templates per intent, or a template + overlay pattern
- How GSD's context-carrying pattern works -- how CONTEXT.md (user decisions from discuss-phase) flows through researcher, planner, and checker agents as locked constraints
- The HANDOFF.md generation logic -- how the Design skill produces both DESIGN.md and HANDOFF.md (product intent only), and how /arc:scope detects and offers to import prior design artifacts
- How Plan output adapts: wave-ordered tasks (engineering) vs. epics and stories (product) -- whether this requires different plan generation prompts or a single prompt with intent-conditioned output format
- The connected flow detection -- how /arc:scope scans .arc/design/ and .arc/archive/ for prior DESIGN.md or HANDOFF.md artifacts and offers import

**Suggested research categories:** reference-implementation-analysis, prompt-engineering, state-management-patterns
**Dependencies:** DA-2 (intent stored in state.yml), DA-6 (prompt templates adapt by intent)
**User input:** Product design specifies WHAT differs between intents (table in product design). Research should determine HOW to implement the adaptation cleanly. The product design flags this as the weakest evidence area.
**Readiness criterion:** Ready when we have a concrete pattern for intent-conditional behavior that avoids code duplication, handles the connected flow artifact detection, and produces appropriate output for both intents from shared infrastructure.

---

### DA-10: Passive Telemetry and Log Implementation
**Priority:** Nice-to-have
**Depth:** Deep dive
**Design question:** How should `log.yml` be implemented for passive data collection -- what events are logged, when are entries appended, how is the file kept small and human-readable, and how does this integrate with gate evaluation and source effectiveness tracking?

**Evidence needed:**
- How GSD tracks execution metrics -- timing, completion status, deviation counts, and how these are recorded in SUMMARY.md and STATE.md
- How research-engine tracks research progress -- question counts, sufficiency rates, gap-fill rounds, and where this data lives
- YAML append patterns in Claude Code -- how to append entries to a YAML list without reading and rewriting the entire file (or whether full-file rewrite is necessary)
- What events from the product design's log.yml specification are most critical for v2 calibration: gate outcomes, source effectiveness, timing, question plan evolution, scope-to-completion ratio
- How to keep log.yml under a reasonable size -- whether to cap at N entries, rotate by lifecycle, or use summary entries rather than per-event entries
- Whether log.yml should be committed to git (useful for team analysis) or gitignored (less noise in commits)

**Suggested research categories:** reference-implementation-analysis, state-management-patterns
**Dependencies:** DA-2 (log.yml lives alongside state.yml), DA-3 (gates write log entries)
**User input:** Self-improvement is deferred to v2. This is passive data collection only. The product design specifies what to collect but not the implementation mechanics.
**Readiness criterion:** Ready when we have a concrete append-only logging pattern for YAML in Claude Code, know which events to prioritize, and have a size management strategy.

## Research Category Mapping

| Category | Slug | Decision Areas Served | Key Questions | Priority |
|----------|------|----------------------|---------------|----------|
| Claude Code Plugin Architecture | plugin-architecture | DA-1, DA-2, DA-4, DA-5 | What are the plugin.json schema, skill frontmatter conventions, SessionStart hook API, Task tool API, AskUserQuestion capabilities, and MCP integration patterns? | Critical |
| Reference Implementation Deep Analysis | reference-implementation-analysis | DA-1, DA-2, DA-3, DA-4, DA-5, DA-6, DA-7, DA-8, DA-9, DA-10 | How do research-engine and GSD implement their core patterns -- file structure, state management, subagent orchestration, gate evaluation, prompt templates, execution, and context flow? | Critical |
| Subagent Orchestration Patterns | subagent-orchestration | DA-4, DA-6, DA-8 | What are best practices for multi-agent research orchestration -- context minimization, parallel spawning, result collection, condensed returns, and error handling? | Critical |
| Prompt Engineering for Multi-Phase Workflows | prompt-engineering | DA-3, DA-6, DA-7, DA-8, DA-9 | How should prompt templates be structured for reliable, structured output across scope questioning, research evidence gathering, sufficiency assessment, design synthesis, plan decomposition, and execution? | Critical |
| State Management and Persistence Patterns | state-management-patterns | DA-2, DA-3, DA-7, DA-9, DA-10 | What are reliable patterns for YAML-based state management in file-based systems -- read/write safety, partial update handling, checksum tracking, and resume-after-clear? | Important |
| Source Integration and MCP Patterns | source-integration | DA-5 | How do Claude Code plugins discover, configure, and interact with MCP servers -- availability checking, tool invocation, error handling, and the source checklist UX pattern? | Important |

## Success Criteria

Research is complete when every decision area has enough evidence to write a confident implementation design. Specifically:

1. **DA-1 through DA-4 (Critical)**: Each has concrete implementation patterns validated by at least one reference implementation AND supplemented by web research on Claude Code conventions. No significant "we'll figure it out during implementation" gaps.

2. **DA-5 through DA-9 (Important)**: Each has a clear implementation approach with at least one reference implementation pattern studied AND any product-design-specific adaptations (per-question vs. per-category, intent adaptation) resolved with reasonable confidence.

3. **DA-10 (Nice-to-have)**: Has a workable approach -- does not need to be fully specified.

4. **Cross-cutting**: The research resolves how patterns from the two different reference implementations (research-engine's plugin architecture + GSD's lifecycle orchestration) combine into a single coherent plugin without contradictions.

5. **Overall**: A design agent reading the research synthesis could produce an implementation design document (file structure, skill specifications, state schema, prompt template outlines, orchestration flow) without needing to re-read the reference implementations themselves.
