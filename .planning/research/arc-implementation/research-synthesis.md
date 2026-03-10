# Research Synthesis: Arc Implementation Architecture

**Synthesis Date:** 2026-02-26
**Sources Synthesized:** 7 research documents (SCOPE.md, app-analysis.md, 5 category research files)
**Consumer:** Design phase agent

---

## Executive Summary

1. **The plugin architecture foundation is well-understood and ready for design.** Claude Code's plugin system (skills, hooks, Task tool, AskUserQuestion) is stable and thoroughly documented. Both reference implementations demonstrate proven patterns that arc can adopt directly. The critical constraint -- subagents cannot spawn sub-subagents -- shapes the entire orchestration model but is well-understood.

2. **The per-question vs. per-category research dispatch is the single most consequential design decision.** Research-engine dispatches one agent per category (broad scope, few agents). Arc's product design specifies per-question dispatch (narrow scope, potentially many agents). All evidence points toward a hybrid: group questions by source affinity into 3-5 batches, dispatch one agent per batch, then assess sufficiency per question from combined output. This preserves per-question tracking while staying within practical concurrency limits.

3. **State management has strong patterns but the SessionStart hook carries significant platform risk.** YAML-based state with complete-file rewrites, backup-before-write, and artifact-based reconstruction is well-supported by both reference implementations and broader research. However, the SessionStart hook -- arc's primary context reconstruction mechanism after /clear -- has three open bugs (#16538, #13650, #11509) affecting plugin-defined hooks. This requires a robust fallback strategy.

4. **Prompt engineering is the primary quality lever, not model selection or tool design.** Anthropic's own multi-agent research system confirmed this empirically. Research-engine's 4-section prompt template (Role, Instructions, Output Format, Quality Standards) combined with GSD's quality gate checklist and downstream consumer awareness creates a proven prompt architecture. The 8-section template structure identified by web research (role, context, downstream consumer, instructions, output format, examples, quality gate, input data) provides a comprehensive framework.

5. **Several product design decisions face thin evidence and may need iteration.** Intent-adaptive behavior (DA-9) has the weakest evidence -- neither reference implementation has anything similar. The sufficiency judgment model (three-criteria per-question assessment) is entirely new with no reference precedent. The source checklist UX must be adapted to fit AskUserQuestion's 4-option-per-question constraint. These areas have medium-to-low implementation confidence and should be designed for easy iteration.

---

## Per-Decision-Area Synthesis

### DA-1: Plugin File Structure and Skill Decomposition

**Converging Evidence:**

All sources agree on the fundamental structure. Research-engine demonstrates the exact pattern arc needs: a `.claude-plugin/plugin.json` manifest (minimal -- name, version, description, author) with skills auto-discovered from `skills/{phase-name}/SKILL.md` + `references/` subdirectories for prompt templates. Web research (category-plugin-architecture) confirms this is the official recommended structure and that custom paths in plugin.json supplement defaults rather than replacing them.

Both the app analysis and the plugin architecture research confirm that `${CLAUDE_PLUGIN_ROOT}` resolves to the plugin installation directory (cached at `~/.claude/plugins/cache/`), and all file references within skills must use this variable rather than absolute paths. The namespacing convention (`arc:scope`, `arc:research`, etc.) is confirmed by official documentation.

GSD demonstrates an alternative structure (custom commands in `~/.claude/commands/gsd/` referencing workflows in `~/.claude/get-shit-done/`) but this predates the plugin architecture. Both the app analysis and the reference implementation analysis agree that arc should use the plugin architecture, not the legacy commands pattern.

**Key Patterns:**

- **Minimal plugin.json + auto-discovery**: Research-engine's pattern where `plugin.json` contains only metadata and skills are auto-discovered from the `skills/` directory. (per app-analysis DA-1, category-plugin-architecture Section 1)
- **Skill directory with references/**: Each skill has `SKILL.md` (orchestration logic) + `references/prompt-*.md` (static prompt templates). The SKILL.md loads and combines templates with dynamic context at runtime. (per app-analysis DA-1, DA-6)
- **Prompt template frontmatter**: Research-engine uses YAML frontmatter in prompt templates (`subagent_type`, `model`) that the SKILL.md orchestrator reads and passes to Task(). (per app-analysis DA-4)
- **Trigger-phrase descriptions**: The `description` field in SKILL.md frontmatter lists trigger phrases for intent-based routing. Claude uses this for auto-invocation decisions. (per app-analysis DA-1, category-plugin-architecture Section 2)
- **Dynamic context injection**: The `` !`command` `` syntax in SKILL.md runs shell commands before the skill content reaches Claude, enabling dynamic state injection. (per category-plugin-architecture Section 2.5)

**Tensions & Open Questions:**

- **Hook registration location**: The app analysis notes that research-engine has no hooks. Arc needs a SessionStart hook, which can be registered in `hooks/hooks.json` at the plugin root or inline in `plugin.json` via the `hooks` field. The plugin architecture research documents both options but does not indicate which is preferred. Research-engine provides no precedent.
- **Shared templates directory**: The app analysis recommends a `templates/` directory at the plugin root for configuration templates (`sources.yml.template`, `state.yml.template`). This is not a standard Claude Code plugin convention but is a reasonable addition. Neither reference implementation stores runtime state templates in the plugin directory (research-engine's state is implicit; GSD's templates are in its custom directory).
- **Runtime state location split**: Arc's plugin code lives in the plugin cache directory, but runtime state lives in `.arc/` at the project root. This split is unique -- research-engine puts research artifacts in the project's `.planning/` directory, and GSD puts state in `.planning/`. The split is architecturally clean but means skills must navigate between `${CLAUDE_PLUGIN_ROOT}` (for templates) and the project root (for state).

**Implementation Confidence:** HIGH
The plugin file structure is the most well-understood decision area. Research-engine provides a near-complete template. Web research confirms the conventions. The only uncertainty is around hooks registration, which is documented if untested in the reference implementations.

**Concrete Layout Evidence:**

Based on research-engine's observed layout, web research on plugin conventions, and arc's specific requirements, the evidence points toward this structure:

```
arc/
  .claude-plugin/
    plugin.json              # name: "arc", version, description, author
  hooks/
    hooks.json               # SessionStart hook registration
  scripts/
    session-start.sh         # Shell script for SessionStart hook
  skills/
    scope/
      SKILL.md               # Orchestration: interactive questioning, question plan
      references/
        prompt-scope-decomposer.md
    research/
      SKILL.md               # Orchestration: parallel dispatch, synthesis, sufficiency
      references/
        prompt-web-researcher.md
        prompt-codebase-analyst.md
        prompt-mcp-researcher.md
        prompt-research-synthesizer.md
        prompt-sufficiency-evaluator.md
    design/
      SKILL.md               # Orchestration: design generation
      references/
        prompt-design-generator.md
    plan/
      SKILL.md               # Orchestration: task decomposition
      references/
        prompt-plan-generator.md
    execute/
      SKILL.md               # Orchestration: wave execution, checkpoints
      references/
        prompt-task-executor.md    (if using subagent execution)
    status/
      SKILL.md               # Context reconstruction / lifecycle overview
  templates/
    state.yml.template       # Initial state.yml schema
    sources.yml.template     # Initial sources.yml with built-in sources
```

Runtime state directory (at project root):
```
.arc/
  state.yml                  # Current lifecycle state (YAML)
  sources.yml                # Source configuration (YAML)
  log.yml                    # Append-only telemetry log (multi-document YAML)
  scope/
    SCOPE.md                 # Question plan, success criteria, intent
  research/
    evidence-batch-{id}.md   # Per-batch evidence files
    SYNTHESIS.md             # Organized by question/decision area
  design/
    DESIGN.md                # Implementation or product design
    HANDOFF.md               # Product intent only
  plan/
    PLAN.md                  # Wave-ordered tasks with acceptance criteria
  execute/
    PROGRESS.md              # Append-only execution log
    t{NN}-checkpoint.md      # Per-task checkpoint files
  archive/
    {slug}/                  # Archived prior lifecycles
```

**Critical Constraints:**
- C-10: Plugin name "arc" with `/arc:` namespace
- C-2: State in `.arc/` directory (not inside the plugin directory)
- 6 skills required: scope, research, design, plan, execute, status

---

### DA-2: State Machine and Lifecycle Management

**Converging Evidence:**

All sources agree that explicit state management (GSD's pattern) is superior to implicit file-existence checking (research-engine's pattern) for a multi-phase lifecycle with gates, overrides, and resume behavior. The state management patterns research validates this further: a dual-file architecture (`state.yml` for current snapshot + `log.yml` for append-only history) with complete-file rewrites is the recommended approach.

Three independent sources converge on the "read state first" pattern: GSD reads STATE.md at the start of every workflow, the state management patterns research recommends reading the entire state file at session start, and the app analysis recommends this pattern for arc. All sources also agree that state should be reconstructable from filesystem artifacts as a defense-in-depth measure.

The state management patterns research introduces important YAML safety practices not found in either reference implementation: quote all string values to avoid implicit typing, use explicit `null` for empty fields, keep maximum 2 levels of nesting for LLM parseability, and always rewrite the complete file rather than attempting partial field updates.

**Key Patterns:**

- **Complete-file rewrite**: Always write the entire state.yml content, never attempt partial field updates via regex or line editing. This avoids YAML syntax corruption. (per category-state-management-patterns, YAML Read/Write Safety)
- **Backup-before-write**: Copy `state.yml` to `state.yml.bak` before each write. (per category-state-management-patterns Finding 2)
- **Artifact-based reconstruction**: Design so that if `state.yml` is missing or corrupt, the current lifecycle position can be inferred from the presence/absence of phase artifacts. Research-engine demonstrates this inherently; GSD's `/gsd:health --repair` does this explicitly. (per app-analysis DA-2, category-state-management-patterns Finding 3)
- **Flat YAML schema**: Maximum 2 levels of nesting. All string values quoted. Explicit `null` for empty fields. `last_modified` timestamp for staleness detection. `version` field for schema evolution. Keep under 100 lines. (per category-state-management-patterns Finding 4)
- **SessionStart context reconstruction layering**: CLAUDE.md (permanent) -> state.yml (current position) -> plan files (task details) -> git log (recent activity). Each layer adds detail; session start reads only what is needed. (per category-state-management-patterns, Context Reconstruction)
- **Transition validation via prompt**: Encode valid state transitions in the skill's system prompt or a config file. The LLM validates transitions before writing state changes. (per category-state-management-patterns, State Machine Patterns)

**Tensions & Open Questions:**

- **SessionStart hook reliability**: The plugin architecture research identifies three open bugs (#16538, #13650, #11509) specifically affecting plugin-defined SessionStart hooks. The `hookSpecificOutput.additionalContext` mechanism may not work reliably for plugins. The app analysis recommends using plain text stdout as a fallback, and the plugin architecture research recommends having a fallback mechanism (e.g., the status skill that manually reads state). This is the highest-risk item in DA-2.
- **YAML write mechanism**: The plugin architecture research (Section 6.1) documents two approaches: Claude's native ability to read/write files using Read/Write tools, or Bash-based `yq`/Python for programmatic manipulation. The state management research recommends complete-file rewrites (which aligns with the Read+Write approach). There is no consensus on whether `yq` should be a dependency.
- **Accumulated context**: GSD's STATE.md includes accumulated context (decisions, blockers, todos) alongside machine state. The product design specifies `state.yml` for machine state and Markdown for human artifacts. Whether decisions and blockers should live in `state.yml` or a separate file is not resolved.

**Implementation Confidence:** MEDIUM-HIGH
The state management patterns are well-understood. The primary risk is the SessionStart hook bug, which requires a fallback design. The state.yml schema from the product design is well-structured for LLM parseability. The archival pattern (move `.arc/` to `.arc/archive/[slug]/`) is straightforward but untested in either reference implementation.

**Critical Constraints:**
- C-2: File-based state in `.arc/` using YAML for machine state, Markdown for human artifacts
- C-6: SessionStart hook for context reconstruction after `/clear` -- 3-5 line summary injection
- C-17: Single lifecycle at a time per project. Archive on new start.

---

### DA-3: Gate Evaluation and Readiness Checking Implementation

**Converging Evidence:**

Two distinct gate patterns emerge from the reference implementations, and both inform arc's design. Research-engine uses a single evaluator agent that reads all relevant artifacts and produces a structured evaluation document (READINESS.md). GSD uses goal-backward verification with three outcomes (passed/gaps_found/human_needed). Both patterns share a common structure: read artifacts, evaluate against criteria, produce structured output, present to user.

All sources agree that gate evaluation should be cheap and fast. The app analysis notes that gates should be "2-3 minutes, single agent." The prompt engineering research supports this by emphasizing that evaluation prompts (judge prompts) require different design than generative prompts -- they need explicit rubrics, structured assessment output, and separation of evaluation from recommendation.

The state management patterns research provides the infrastructure for gate history tracking: append gate evaluation entries to `log.yml` and record the current gate status in `state.yml`. The app analysis recommends storing all gate evaluations in `state.yml` under `gate_history`.

**Key Patterns:**

- **Single evaluator agent**: Research-engine's pattern of spawning one opus-model agent that reads all relevant artifacts and produces a comprehensive evaluation. The agent uses a structured rubric (COVERED / PARTIALLY COVERED / NOT COVERED per evidence requirement). (per app-analysis DA-3)
- **Goal-backward derivation**: GSD's verification approach starts from the desired outcome, derives what must be true (truths, artifacts, wiring), and verifies each. This is more rigorous than forward checking. (per app-analysis DA-3)
- **Structured evaluation output**: Both references produce evaluation output as structured documents with tables, status columns, and gap descriptions. The prompt engineering research reinforces this: "Use structured output for assessment. Force the evaluation into a table or checklist format to prevent vague narrative assessment." (per category-prompt-engineering, Sufficiency & Quality Assessment)
- **Gap-to-research pipeline**: Research-engine's READINESS.md Gap Summary table feeds directly into the research-gaps skill. This pattern directly maps to arc's Recycle flow: gate produces gap descriptions, next research run targets only those gaps. (per app-analysis DA-3)
- **Recycle escalation**: Product design specifies escalating warnings at 1st, 2nd, and 3rd recycles. Neither reference implements this, but the state management patterns provide the infrastructure (recycle counts in state.yml).

**Tensions & Open Questions:**

- **Gate location: inline vs. separate skill**: The app analysis recommends implementing gates as skill-internal logic (each skill checks its input gate before proceeding). The reference implementation analysis notes that research-engine's check-readiness is a separate skill. Arc's product design does not specify whether gates are separate skills or inline. A separate gate skill (/arc:gate) would be more testable and transparent; inline gates would be more streamlined. The evidence slightly favors inline (the app analysis recommends it, and it reduces the number of skill invocations).
- **Determinism of LLM-based judgment**: The app analysis flags that "sufficiency judgment reliability has WEAK evidence" (product design Evidence Gap Register item 2). The prompt engineering research notes that "assigning a role does not automatically guarantee deep factual grounding" and "LLMs can hallucinate confidently within a role." Gate evaluation is inherently probabilistic, and the product design's target of "60-80% first-pass approval rate" acknowledges this.
- **Simple vs. agent-based gates**: The app analysis suggests G1 and G4 could be simple file-existence checks (no agent needed), while G2 and G3 require evaluator agents. This is a pragmatic optimization but creates two different gate implementation patterns within the same system.

**Implementation Confidence:** MEDIUM
The gate structure (MUST/SHOULD criteria, Go/Hold/Recycle outcomes) is clear from the product design. The implementation patterns from both reference implementations are applicable. The uncertainty is in the sufficiency judgment reliability -- how well will LLM-based evaluation actually distinguish between sufficient and insufficient research at the per-question level? This can only be resolved through testing.

**Critical Constraints:**
- C-3: Go/Hold/Recycle three-outcome model with MUST/SHOULD criteria split
- C-11: Per-question sufficiency using coverage, corroboration, actionability
- Override mechanism with gap context injection into next phase

---

### DA-4: Subagent Orchestration and Token Efficiency

**Converging Evidence:**

This is the strongest-evidence decision area. All sources converge on a consistent picture of the Task tool API and its constraints. The subagent orchestration research provides the definitive API specification: `prompt` (required), `description` (required), `subagent_type` (required), and optionally `model`. The critical constraint -- subagents cannot spawn sub-subagents -- is confirmed by all three relevant sources (app analysis, subagent orchestration, plugin architecture).

All sources agree on the file-based output pattern for token efficiency: subagents write detailed findings to designated files and return only a brief summary (200-500 tokens) inline to preserve parent context. Research-engine demonstrates this in practice (each category agent writes to `category-{slug}.md`), and the subagent orchestration research recommends it explicitly as the pattern for arc.

The model tiering pattern is consistent across sources: research/web-search agents use Sonnet (fast, cheaper), synthesis/judgment agents use Opus (most capable), codebase exploration uses Haiku via the built-in Explore type. GSD's model profile system (quality/balanced/budget profiles mapping agent types to models) is the most mature implementation of this concept.

**Key Patterns:**

- **Template loading + prompt construction**: Read prompt template, extract frontmatter metadata, combine static template with dynamic context (file contents inlined), spawn via Task(). This is research-engine's exact pattern and is proven. (per app-analysis DA-4)
- **File-based output + condensed returns**: Subagents write detailed output to files, return 200-500 token summaries inline. The parent reads files only when synthesizing. This preserves parent context for orchestration. (per category-subagent-orchestration, Result Collection; per app-analysis DA-4)
- **Fan-out / fan-in for parallel research**: All research agents spawned simultaneously (or batched by concurrency limit), all results collected, then synthesis agent reads all output files. (per category-subagent-orchestration, Concurrency)
- **Wave-based execution**: Plans grouped by wave number, waves execute sequentially, tasks within waves execute in parallel. GSD demonstrates this thoroughly. (per app-analysis DA-7, category-reference-implementation-analysis)
- **Concurrency limiting via prompt instruction**: No built-in enforcement mechanism in Claude Code. The orchestrator skill's prompt must instruct: "Spawn no more than N agents at a time." Anthropic recommends 3-5 concurrent agents. (per category-subagent-orchestration, Concurrency Limiting)
- **Fresh agent for failures**: When a subagent fails, spawn a fresh agent rather than trying to resume. Use `resume` parameter only for rate limit recovery. (per category-subagent-orchestration, Error Handling)

**Tensions & Open Questions:**

- **Content inlining cost**: The subagent orchestration research warns that each subagent subprocess reinjects global configuration on every turn, and MCP tool descriptions alone can consume 10-20K tokens. A fresh subagent turn can consume ~50K tokens before doing any actual work. This means arc must minimize subagent count and keep prompts focused (~5K tokens target). The research and app analysis agree on this but neither provides a concrete strategy for managing it when arc might need 5-10 research subagents.
- **Parallel dispatch semantics**: The subagent orchestration research notes that "without explicit rules, Claude defaults to conservative sequential execution." The orchestrator must explicitly instruct parallel dispatch. Research-engine does this with "spawn one agent PER CATEGORY, all in parallel." Whether Claude Code honors this instruction reliably for 5+ simultaneous Task() calls is not fully tested in the evidence.
- **Background vs. foreground execution**: The plugin architecture research clarifies that `run_in_background` is NOT a Task tool parameter but a runtime decision. The subagent orchestration research lists it as a parameter. This is a discrepancy; the plugin architecture research (based on official docs) is likely more accurate. Background subagents have limitations (AskUserQuestion calls fail, pre-approved permissions only).

**Implementation Confidence:** HIGH
The Task tool API, subagent types, constraints, and patterns are well-documented from multiple independent sources. The file-based output pattern, condensed returns, and model tiering are proven by reference implementations and validated by web research. The only uncertainties are around concurrent dispatch reliability and the exact token overhead per subagent.

**Critical Constraints:**
- C-7: Subagents for parallel research; main session for everything else
- C-12: Condensed subagent returns of 1,000-2,000 tokens
- C-13: Tiered model assignment -- fast for research subagents, primary for judgment
- Subagents cannot spawn sub-subagents (hard platform constraint)
- Content must be inlined into Task() prompts (@-references do not cross Task boundaries)

---

### DA-5: Source Routing and MCP Integration

**Converging Evidence:**

All sources agree that source routing should happen at the orchestrator level, not within individual subagents. Anthropic's own multi-agent research system, the LangChain router pattern, and research-engine's mode-based approach all confirm this. The orchestrator determines which sources each research question needs and injects source-specific instructions into subagent prompts.

The MCP integration picture is clear: MCP tools follow the `mcp__<server>__<tool>` naming convention, skills can declare `allowed-tools` with wildcards (e.g., `mcp__github__*`), and there is no programmatic API for checking MCP server availability from within a skill. Availability must be inferred from tool invocation failures (the `isError` flag on tool results).

The AskUserQuestion tool provides a multi-select mechanism sufficient for source selection, but with constraints: maximum 4 options per question, 60-second timeout, no toggle/checkbox UI. The source checklist UX from the product design must be simplified to fit these constraints.

**Key Patterns:**

- **Orchestrator-level routing**: The research skill reads the question list and source configuration, determines which sources each question needs, and constructs per-subagent prompts with explicit tool usage instructions. (per category-source-integration, Source Routing Patterns; per app-analysis DA-5)
- **sources.yml as a higher-level mapping**: Not a replacement for `.mcp.json` but a mapping of source types to tools, availability status, and routing preferences. The user's MCP configuration remains in `.mcp.json`; arc's `sources.yml` references servers by name. (per category-source-integration)
- **Optimistic invocation + graceful degradation**: Attempt to use tools; if `isError: true`, mark source as unavailable and fall back. Record failure in subagent return for INSUFFICIENT-SOURCE-UNAVAILABLE status. (per category-source-integration, Availability & Health Checking)
- **Prompt-level circuit breaker**: "If a tool fails twice, stop attempting that tool and report it as unavailable. Continue researching with remaining tools." (per category-source-integration, Fallback & Circuit Breaking)
- **Two built-in sources always available**: Web (WebSearch + WebFetch) and Codebase (Grep, Read, Glob, Bash) require no MCP configuration. MCP sources are user-configured extensions. (per app-analysis DA-5, category-source-integration)

**Tensions & Open Questions:**

- **AskUserQuestion limitations vs. product design UX**: The product design specifies a source checklist with checkable/uncheckable items and "go to proceed." AskUserQuestion supports `multiSelect: true` with 2-4 options per question, plus automatic "Other" option. If arc supports more than 4 source types, it must use multiple questions (up to 4 questions x 4 options = 16 sources) or group related sources. The "go to proceed" must be a separate follow-up prompt, not part of the question UI. (per category-plugin-architecture Section 5, category-source-integration)
- **No pre-check for MCP availability**: The product design implies `mcp_ping` availability checking, but the source integration research confirms no such API exists within plugins. Arc must use optimistic invocation. This affects the source checklist UX -- arc cannot mark sources as unavailable before the user proceeds.
- **Per-question vs. per-source subagent dispatch**: Should each subagent handle one question across multiple sources, or one source across multiple questions? Research-engine uses per-category (one source type per agent). The app analysis recommends grouping questions by source affinity. The subagent orchestration research supports the fan-out/fan-in pattern but does not resolve this specific question. The evidence slightly favors per-source-group dispatch (one agent gets a batch of questions that all use web search, another gets questions that need codebase analysis).

**Implementation Confidence:** MEDIUM
The MCP integration patterns are well-documented. The routing pattern is clear (orchestrator-level). The primary uncertainties are around the AskUserQuestion UX limitations, the lack of pre-check availability, and the optimal question-to-source dispatch strategy. The product design acknowledges source configuration complexity as a risk (Evidence Gap Register item 7).

**Critical Constraints:**
- C-5: Hybrid source routing -- categorize then dispatch to 2-3 sources
- C-9: Reference configs only -- no bundled MCP servers
- C-14: Single `sources.yml` file for all source configuration
- No MCP server availability API within plugins

---

### DA-6: Prompt Engineering for Phase Operations

**Converging Evidence:**

This is one of the strongest-evidence areas. Anthropic's own multi-agent research system provides the foundational insight: "prompt engineering was the primary lever for improving agent behaviors -- more impactful than model selection or tool design." The prompt engineering research and both reference implementations converge on a consistent prompt template architecture.

Research-engine demonstrates a proven 4-section structure (Role, Instructions, Output Format, Quality Standards). GSD adds XML-structured sections (`<planning_context>`, `<downstream_consumer>`, `<quality_gate>`) with quality gate checklists. The prompt engineering research synthesizes these into an 8-section template (role, context, downstream consumer, instructions, output format, examples, quality gate, input data) that captures all observed best practices.

Four components are identified as essential for every subagent prompt: (1) a concrete objective, (2) clear task boundaries, (3) the right output format, and (4) tool and source guidance. Without these, subagents produce inconsistent, overlapping results.

**Key Patterns:**

- **8-section prompt template structure**: role -> context -> downstream_consumer -> instructions -> output_format -> examples -> quality_gate -> input_data. Long documents at the top, queries and instructions at the end (improves response quality by up to 30%). (per category-prompt-engineering, Synthesis)
- **XML tags for structured compartments**: Claude is fine-tuned to recognize XML tags. Use them for labeled sections that prevent instructions, context, examples, and format expectations from contaminating each other. (per category-prompt-engineering, Key Finding 3)
- **Schema-first output design**: Define the exact output structure before writing the prompt body. Include the schema in the prompt itself. Force structured formats (tables, checklists) rather than narrative prose. (per category-prompt-engineering, Structured Output Patterns)
- **Downstream consumer specification**: Explicitly state who reads the output and what they need. Agents produce better output when they know their audience. Research-engine's plan validator prompt demonstrates this: "The synthesizer agent will read your output -- make it actionable, not just evaluative." (per app-analysis DA-6, category-prompt-engineering)
- **Quality gate checklist before completion**: A pre-completion verification list that the agent must evaluate before finalizing. GSD's pattern: "Before returning PLANNING COMPLETE: [ ] PLAN.md files created... [ ] Each plan has valid frontmatter..." (per app-analysis DA-6, category-prompt-engineering)
- **Lens differentiation**: A single template that produces different output based on injected metadata. Research-engine's design-from-research uses 3 parallel agents with the same template but different lens assignments (Player Experience, Business Value, Evidence). (per app-analysis DA-6)
- **Condensed returns via output format**: Explicit token/word budget in the output format section. "Return your findings in exactly this format, keeping total output under 1,500 tokens." (per category-prompt-engineering, Token Efficiency; per category-subagent-orchestration, Condensed Returns)

**Concrete Template Structure Evidence:**

Synthesizing research-engine's 4-section structure, GSD's XML-structured sections, and the prompt engineering research's 8-section recommendation, the evidence converges on this template architecture for arc's subagent prompts:

```markdown
---
subagent_type: general-purpose
model: sonnet
---

<role>
You are a [specific expertise]. Your task is to [concrete objective].
You are operating within arc's research phase.
</role>

<context>
[Project background, prior phase output, relevant state]
[Kept minimal -- only what this agent needs for its specific task]
</context>

<downstream_consumer>
Your output will be consumed by the [next agent/phase].
They need: [specific list of what the consumer needs]
They do NOT need: [what to exclude -- reasoning process, raw data, caveats]
</downstream_consumer>

<instructions>
1. [Step-by-step numbered instructions]
2. [Explicit tool usage guidance: "Use WebSearch for..."]
3. [Clear boundaries: "Do NOT investigate..."]
</instructions>

<output_format>
Write detailed findings to `{output_file_path}`.
Return a summary to the parent conversation (max 500 tokens):
- 3-5 key findings (one line each)
- Confidence: [high/medium/low]
- Sources consulted: [count]
- Evidence gaps: [list any unfulfilled requirements]
</output_format>

<quality_gate>
Before completing, verify:
- [ ] All assigned questions have evidence
- [ ] Every claim has a cited source
- [ ] Output follows the specified format exactly
- [ ] Findings are actionable, not abstract
If any check fails, revise before completing.
</quality_gate>

<input_data>
[The actual questions/tasks for this specific invocation]
[Placed at the end per Anthropic's recommendation for optimal response quality]
</input_data>
```

This structure is consistent with Anthropic's 4-section recommendation (instructions, context, task, output format) while adding the multi-agent-specific sections (downstream consumer, quality gate) that both reference implementations and the prompt engineering research have shown to be essential.

**Tensions & Open Questions:**

- **Examples in prompts (few-shot)**: The prompt engineering research recommends 3-5 examples in `<example>` tags for consistent output. Neither reference implementation includes examples in its prompt templates (both rely on detailed format specifications instead). Whether examples are worth the token cost within a subagent prompt (where every token counts) is unresolved.
- **Extended thinking / ultrathink**: The plugin architecture research notes that including "ultrathink" anywhere in skill content enables extended thinking. The prompt engineering research discusses extended thinking as a Claude-specific feature for multi-step reasoning. Whether arc's evaluation prompts (gate assessment, sufficiency judgment) should use extended thinking is an open design question -- it could improve judgment quality but adds token cost.
- **Prompt templates are not user-editable in v1**: The product design specifies this (line 1307). This simplifies the design but limits customization. If prompts need adjustment after initial deployment, a version bump is required.

**Implementation Confidence:** HIGH
The prompt template structure is well-validated from multiple sources. Research-engine provides 12 concrete templates to reference, and the prompt engineering research provides a theoretical framework that validates and extends these patterns. The design agent has more than enough evidence to specify prompt templates for all 5 phases plus gate evaluation.

**Critical Constraints:**
- Prompts must be self-contained (no @-references across Task boundaries)
- Research subagent prompts target ~5K tokens (to stay within token budget)
- Output format must enforce 1,000-2,000 token condensed returns (C-12)
- Intent-adaptive behavior via lens injection, not separate templates (DA-9)

---

### DA-7: Execute Phase Implementation

**Converging Evidence:**

GSD provides the primary and most detailed reference for execution patterns. Its wave-based execution model (group plans by wave number, execute waves sequentially, plans within waves in parallel) is validated by the subagent orchestration research's coverage of wave-based execution patterns and the academic AdaptOrch framework. The app analysis provides a thorough mapping of GSD's execute-phase to arc's simpler model.

The critical adaptation: arc executes tasks sequentially in the main session (C-7), not via subagent executors. This is a fundamental simplification from GSD's pattern. GSD spawns `gsd-executor` subagents; arc runs tasks directly. This means the "Continue? (yes/pause/review)" micro-interaction can be implemented as a freeform prompt between tasks (or between waves), not as a checkpoint system.

The checkpoint/resume pattern is well-supported: GSD uses marker files (`.continue-here-*`) with state inlining for fresh agent continuation, and the state management research provides LangGraph's checkpointer pattern as an alternative model. Both agree on the key insight: resume is not "pick up where you left off" but "spawn a fresh session with enough context to continue."

**Key Patterns:**

- **Wave-based task ordering**: Group tasks by wave, execute waves sequentially. Within a wave, tasks are independent and can execute in parallel (if using subagents) or sequentially (in main session). (per app-analysis DA-7, category-reference-implementation-analysis)
- **Checkpoint as state snapshot**: Checkpoint captures phase, plan, task index, last commit SHA, and continuation notes. A fresh session reads the checkpoint and continues from the recorded position. Not true "resume" but "fresh start with context." (per category-state-management-patterns, Checkpoint & Resume; per app-analysis DA-7)
- **Per-task completion markers**: GSD uses SUMMARY.md per plan. Arc can use per-task checkpoint files (`t{NN}-checkpoint.md`). The state management research supports embedding checkpoint data directly in state.yml for simplicity. (per app-analysis DA-7, category-state-management-patterns)
- **Micro-interaction between waves**: After each wave completes, display aggregate stats and prompt the user. This is arc-specific (not in either reference). The plugin architecture research confirms AskUserQuestion could be used, but freeform prompting may be simpler for a yes/pause/review choice. (per app-analysis DA-7)
- **PROGRESS.md as append-only execution log**: Track completed tasks, current status, and any deviations. Similar to GSD's STATE.md performance metrics but simpler. (per app-analysis DA-7)

**Tensions & Open Questions:**

- **Main session execution vs. subagent execution**: Arc's product design specifies main session execution (C-7). GSD spawns subagent executors. The main session approach is simpler but loses the isolation benefit of subagents (a failed task does not corrupt the orchestrator's context). The app analysis acknowledges this trade-off but recommends following the product design.
- **Task() agents cannot be paused**: If a user says "pause" mid-wave (in a subagent model), the orchestrator must save state and exit cleanly. In arc's main session model, pausing is simpler -- the session just stops, and the next `/arc:execute` invocation reads checkpoints. But context is lost.
- **Completion verification depth**: The product design specifies verification against SCOPE.md success criteria. GSD's goal-backward verification is thorough but expensive (separate verifier agent). The app analysis recommends a "lightweight check" for v1. What constitutes "lightweight" is undefined.

**Implementation Confidence:** MEDIUM-HIGH
GSD provides a comprehensive execution pattern. The adaptation to arc's simpler model (main session, sequential) is straightforward. The micro-interaction UX is new but implementable. The primary uncertainty is around how well the checkpoint/resume pattern works in practice when the main session (not a subagent) is interrupted.

**Critical Constraints:**
- C-15: "Continue? (yes / pause / review)" micro-interaction between execution tasks
- C-16: Wave-based task ordering in Plan phase
- C-7: Main session execution, not subagent per task
- Checkpoint files must enable resume from any interruption point

---

### DA-8: Research Phase Orchestration

**Converging Evidence:**

Research-engine provides the proven orchestration flow: scope-driven research with parallel fan-out, file-based result collection, and synthesis. Its three-step pipeline (optional app analysis -> parallel web research -> synthesis) is the foundational pattern. The gap-fill mode (research-gaps skill reading READINESS.md, grouping related gaps, spawning targeted researchers) provides a direct model for arc's Recycle flow.

All sources agree that synthesis should organize findings by decision area (or question), not by source. Research-engine's synthesizer demonstrates this: it reads all category outputs and reorganizes by theme, identifying agreements, contradictions, and gaps. The prompt engineering research reinforces that downstream consumer awareness is critical for synthesis quality.

The per-question vs. per-category dispatch is the central tension (see Tensions below). The app analysis recommends a hybrid: group questions by source affinity into 3-5 batches, dispatch one agent per batch, then assess sufficiency per question. The subagent orchestration research supports this as a fan-out/fan-in pattern with concurrency limiting.

**Key Patterns:**

- **Three-step pipeline**: (1) Codebase analysis (optional, Explore agent), (2) Parallel research (one agent per batch), (3) Synthesis (single agent reading all outputs). (per app-analysis DA-8)
- **Source-affinity grouping**: Group questions that need similar sources into batches. Each batch gets one research agent with all the batch's questions and the appropriate source tools. (per app-analysis DA-8)
- **Gap-fill targeting**: Read gate evaluation output, identify failing questions, group related gaps, spawn targeted researchers for only those gaps. Supplements do not replace prior research. (per app-analysis DA-8, research-engine's research-gaps skill)
- **Sufficiency assessment per question**: After research agents return, assess each question against three criteria (coverage, corroboration, actionability). This is arc-specific and has no reference precedent. (per product design C-11)
- **Dynamic question discovery**: Research agents can propose up to 2 new questions. The orchestrator presents these for user approval via AskUserQuestion, then adds approved questions to state.yml. (per app-analysis DA-8)
- **60-second progress updates**: The product design requires periodic progress reporting during research. Neither reference implements this. The subagent orchestration research suggests this could be polling-based (orchestrator checks file system for agent output files) but notes there is no built-in progress reporting mechanism in the Task tool.

**Tensions & Open Questions:**

- **Per-question vs. per-category vs. per-source-batch**: This is the most important unresolved question. Research-engine dispatches per-category (broad scope, ~6 agents, proven). The product design specifies per-question (narrow scope, potentially many agents). The app analysis recommends per-source-batch as a hybrid. The SCOPE.md (DA-8) explicitly asks the design phase to resolve this, noting "use best judgment and do additional design work if this distinction has a big overall impact on the architecture." Evidence slightly favors source-batch grouping for practical reasons (fewer agents, better context coherence), but per-question tracking must still occur at the assessment level.
- **Synthesis input scale**: If there are 10+ questions with 2+ source types each, the synthesizer might need to read 20+ evidence files. The subagent orchestration research warns that "each subagent result consumes parent context." Condensed returns (1,000-2,000 tokens per question) help, but the total synthesis input could still be 15-20K tokens. Research-engine's synthesizer handles this by reading all files, but it typically has only 5-6 categories.
- **Progress reporting**: The 60-second progress update requirement has no implementation pattern from any source. Task tool subagents do not emit progress updates. The only feasible approach within Claude Code's current architecture is for the orchestrator to check for completed output files periodically, but the orchestrator is blocked while waiting for Task() calls to complete (unless using background execution). This requirement may need to be relaxed or implemented as "report after each batch completes" rather than true 60-second intervals.

**Implementation Confidence:** MEDIUM
The orchestration flow is well-understood from research-engine. The adaptation to per-question tracking adds complexity but is manageable. The gap-fill mode has a direct reference precedent. The uncertainties are around the dispatch strategy (per-question vs. per-batch), synthesis scale management, and the progress update requirement.

**Critical Constraints:**
- C-4: Pre-planned question checklist as primary research bound
- C-7: Subagents for parallel research
- C-11: Per-question sufficiency with three criteria
- C-12: Condensed returns of 1,000-2,000 tokens
- Maximum 3 concurrent research agents (product design default)

---

### DA-9: Intent-Adaptive Behavior Implementation

**Converging Evidence:**

This is the weakest-evidence decision area. Neither reference implementation has intent-adaptive behavior. Research-engine is inherently product-focused (produces product design specs). GSD is inherently engineering-focused (produces code-level plans). Neither has a mechanism to switch between the two.

The prompt engineering research provides the strongest applicable pattern: intent-adaptive templates using variable injection (a `<lens>` section with intent metadata that instructions reference). The approach is: keep the same workflow structure across both intents, vary the focus, framing, vocabulary, and output format based on an intent flag. This is validated by the COSTAR framework and LangChain's PromptTemplate pattern.

The app analysis notes that research-engine's mode selection (Web+App / Web only / App only) is the closest pattern to intent-adaptive behavior -- a user selection that changes the execution path. Arc can generalize this: intent is set during scope and stored in state.yml, then each skill reads it and selects the appropriate prompt variant or lens parameters.

**Key Patterns:**

- **Intent as state.yml metadata**: Set during scope phase, stored as a single field (`intent: product | engineering`). All downstream skills read this field. (per app-analysis DA-9)
- **Variable injection / lens pattern**: The core prompt template remains static; a variable section injects the intent lens. Instructions contain conditional sections: "If intent is 'product': focus on user impact... If intent is 'engineering': focus on implementation complexity..." (per category-prompt-engineering, Intent-Adaptive Templates)
- **Source defaults by intent**: Product intent defaults to [web, confluence, jira]. Engineering intent defaults to [web, codebase, github]. These are soft defaults overridable by the user. (per app-analysis DA-9)
- **Intent affects focus, not structure**: The same 5 phases apply regardless of intent. What changes is emphasis, vocabulary, technical depth, and output format. The prompt engineering research confirms: "The intent flag should affect focus and framing, not workflow structure." (per category-prompt-engineering, Intent-Adaptive Templates)

**Tensions & Open Questions:**

- **Separate templates vs. single template with conditionals**: The app analysis recommends "intent-specific prompt template variants" (e.g., `prompt-design-product.md` vs. `prompt-design-engineering.md`). The prompt engineering research recommends "variable injection" (single template with conditional sections). Both approaches work; the trade-off is maintainability (separate templates duplicate structure) vs. complexity (conditionals add prompt length). Neither reference implementation provides a tested pattern.
- **Connected flow (PM -> Dev handoff)**: HANDOFF.md generation and artifact import across lifecycles is entirely new. No reference implementation demonstrates cross-lifecycle artifact transfer. The app analysis recommends a "simple transformation of DESIGN.md" but the mechanics of detecting prior artifacts in `.arc/design/` or `.arc/archive/` are unspecified.
- **Plan output format**: Product intent produces "epics and stories"; engineering intent produces "wave-ordered tasks with code-level acceptance criteria." These are fundamentally different document structures, not just different vocabulary. This may require separate plan generation prompts rather than a simple lens switch.
- **Weak evidence acknowledgment**: The product design itself flags intent adaptation as having the weakest evidence (SPECULATION FLAG). The app analysis echoes this: "the specific content differences have WEAK evidence. Implementation should make adaptations configurable/overridable."

**Implementation Confidence:** LOW-MEDIUM
The mechanism for intent-adaptive behavior is clear (lens injection or separate templates). The challenge is in the content: what specifically changes for product vs. engineering across all 5 phases. The product design provides a table of differences, but these are speculative and untested. The design phase should treat intent adaptation as the most iterative part of the design.

**Critical Constraints:**
- C-19: Intent declared explicitly in Scope, not inferred
- Intent flows as metadata through all phases
- Adaptations are soft defaults, overridable by user
- Product design acknowledges this as weakest evidence area

---

### DA-10: Passive Telemetry and Log Implementation

**Converging Evidence:**

Neither reference implementation has telemetry, but both provide useful patterns. GSD's SUMMARY.md metadata (duration, key-decisions, patterns-established) and velocity tracking in STATE.md demonstrate what execution data looks like. The state management patterns research provides the implementation mechanism: multi-document YAML with `---` separators for an append-only log.

All sources agree that the telemetry should be lightweight, append-only, and not surfaced to users in v1. The state management patterns research recommends separating the event log (`log.yml`, append-only for audit) from the state file (`state.yml`, read-write for current status). Per-phase log rotation keeps file sizes manageable.

**Key Patterns:**

- **Multi-document YAML for append-only logs**: Each log entry is a standalone YAML document separated by `---`. New entries are appended without modifying existing content. Partial writes only corrupt the last document; all previous documents remain valid. (per category-state-management-patterns, Append-Only Logs)
- **Per-phase rotation**: Archive log files when a phase completes (e.g., `.arc/log-research.yml`, `.arc/log-design.yml`). This bounds file size and keeps active logs small. (per category-state-management-patterns, Log Rotation)
- **Natural checkpoint boundaries for logging**: Record events at skill invocation start/end, gate evaluation, agent completion, and phase transition. Do not add instrumentation inside subagent prompts. (per app-analysis DA-10)
- **Three highest-value data points**: Gate outcomes (inform gate calibration), phase durations (inform effort estimation), source effectiveness (inform source routing). These are the most impactful for v2 improvements. (per app-analysis DA-10)

**Tensions & Open Questions:**

- **Git commit or gitignore**: The state management research does not resolve whether `log.yml` should be committed to git (useful for team analysis) or gitignored (less noise in commits). The product design does not specify. For a single-user development workflow, gitignoring is simpler; for team environments, committing provides visibility.
- **YAML append mechanics**: Appending to a YAML list requires reading the whole file and rewriting. The multi-document format (entries separated by `---`) avoids this by allowing true append operations. However, LLM-based writing still involves reading the file, understanding its format, and appending correctly. The risk of an LLM accidentally overwriting instead of appending is non-trivial.
- **Size management**: The product design specifies "a few KB per lifecycle run." With multi-document YAML, each entry might be 100-200 bytes, allowing hundreds of entries before reaching "a few KB." This should be sufficient for a typical lifecycle.

**Implementation Confidence:** MEDIUM
The append-only log pattern is well-understood from the state management research. The YAML multi-document format is the right approach. The uncertainty is mainly around the practical mechanics of LLM-driven appends (risk of overwrites) and whether the log data will actually be useful for v2 calibration.

**Critical Constraints:**
- C-18: Self-improvement deferred to v2; passive data collection only
- Log must be small (few KB per lifecycle run)
- Never surfaced to users in v1

---

## Cross-Category Insights

### How Research-Engine Patterns and GSD Patterns Combine for Arc

The two reference implementations solve complementary problems. Research-engine provides the research orchestration model (scope decomposition, parallel research dispatch, synthesis, readiness gating, gap-fill). GSD provides the execution lifecycle model (state management, wave-based execution, checkpoint/resume, verification, context flow). Arc needs both, and the research reveals how they compose without contradiction:

**Layer 1 -- Plugin Infrastructure (from research-engine)**

Research-engine demonstrates the exact plugin layout arc needs. Skills auto-discovered from `skills/{name}/SKILL.md` with prompt templates in `references/` subdirectories. Minimal `plugin.json` manifest. The `${CLAUDE_PLUGIN_ROOT}` variable for stable file references. The SKILL.md-as-orchestrator pattern where the skill file reads templates, assembles dynamic context, and invokes Task(). This layer is directly adoptable.

GSD's alternative (custom commands in `~/.claude/commands/gsd/` referencing workflows in `~/.claude/get-shit-done/`) predates the plugin architecture and should not be used as the structural model. However, GSD's organizational concepts (separating workflows, templates, references, and commands) inform how arc organizes content within the plugin layout.

**Layer 2 -- State Management (from GSD, extended)**

GSD provides the explicit state model arc needs: a centralized state file read at the start of every operation, updated at every significant checkpoint, containing lifecycle position, accumulated context, and performance metrics. Research-engine's implicit file-existence state model is elegant but insufficient for arc's requirements (gate history, override recording, per-question tracking, recycle counting).

Arc extends GSD's pattern in three ways: (1) YAML instead of Markdown for machine-parseable state, (2) per-question status tracking within the state file, (3) a separate append-only log file for telemetry. The state management patterns research provides the theoretical foundation for these extensions (dual-file architecture, YAML safety practices, corruption resilience).

**Layer 3 -- Research Orchestration (from research-engine, adapted)**

Research-engine's three-step pipeline (optional codebase analysis -> parallel web research -> synthesis) is the core orchestration model. Arc adapts it in three ways: (1) questions replace categories as the dispatch unit (with source-affinity batching as the bridging mechanism), (2) per-question sufficiency assessment replaces per-decision-area readiness evaluation, (3) source routing adds tool-specific configuration to each subagent prompt.

The gap-fill flow maps directly: research-engine's research-gaps skill reads READINESS.md, groups related gaps, spawns targeted researchers, and produces supplementary evidence. Arc's Recycle flow does the same with state.yml's failing questions.

**Layer 4 -- Gate Evaluation (combined)**

Gates combine research-engine's evaluator agent pattern with GSD's verification methodology. For simple gates (G1, G4), file-existence checks suffice (research-engine's implicit model). For complex gates (G2, G3), a single evaluator agent reads artifacts and produces structured assessment (research-engine's check-readiness pattern). The evaluation methodology borrows from GSD's goal-backward derivation (start from desired outcome, verify each prerequisite). Arc adds the MUST/SHOULD criteria split and Go/Hold/Recycle outcomes.

**Layer 5 -- Execution (from GSD, simplified)**

GSD's wave-based execution with subagent executors simplifies for arc's main-session model. The wave ordering, dependency validation, and checkpoint patterns transfer directly. What changes is the execution mechanism: arc runs tasks in the main session rather than spawning subagent executors. The "Continue? (yes/pause/review)" micro-interaction is new but replaces GSD's automatic checkpoint handling.

**Layer 6 -- Prompt Templates (combined and extended)**

Research-engine provides 12 concrete prompt templates with a proven 4-section structure (Role, Instructions, Output Format, Quality Standards). GSD adds XML-structured context sections (`<planning_context>`, `<downstream_consumer>`, `<quality_gate>`) and quality gate checklists. The prompt engineering research extends both with additional sections (examples, input data placement, token budgets) and validates the approach with Anthropic's first-party engineering blog post.

There are no fundamental contradictions between the two reference implementations. They solve different problems at different lifecycle stages, and their patterns compose cleanly into the layered architecture described above.

### Per-Question vs. Per-Category Research Dispatch Resolution

The evidence strongly suggests a hybrid approach. Pure per-question dispatch (one agent per question) creates too many agents (if there are 10+ questions, that is 10+ subagent invocations with ~50K token overhead each). Pure per-category dispatch (research-engine's model) does not support per-question sufficiency tracking.

The recommended resolution: **source-affinity batching**. Group questions by their source requirements into 3-5 batches. Each batch gets one research agent with all the batch's questions and the appropriate source tools. The agent researches all questions in its batch and writes per-question evidence files. The orchestrator then assesses sufficiency per question from the combined evidence.

This approach:
- Stays within the 3-5 concurrent agent recommendation from Anthropic
- Preserves per-question sufficiency tracking (assessment happens after dispatch, not during)
- Minimizes total subagent invocations (and token cost)
- Allows source-specific tool configuration per agent
- Maps cleanly to research-engine's fan-out/fan-in pattern

The concrete flow would be:

```
1. Read questions from state.yml (each has source_hints, priority, status)
2. Group questions into 3-5 batches by source affinity:
   - Batch A: questions needing web search (WebSearch, WebFetch)
   - Batch B: questions needing codebase analysis (Explore agent)
   - Batch C: questions needing external API (MCP tools)
   - (merge small batches; split oversized batches)
3. For each batch, construct agent prompt:
   - Source-specific prompt template (prompt-web-researcher.md, etc.)
   - All questions in the batch (with priority and context)
   - Explicit tool usage instructions
   - Output format: one evidence section per question
4. Spawn up to 3 agents in parallel (respecting concurrency limit)
5. Collect results: each agent writes to batch-{id}.md
6. Assess sufficiency per question from combined evidence
7. If any question is INSUFFICIENT, enter gap-fill mode (target only failing questions)
```

### Plugin Architecture + State Management Integration Patterns

The plugin's skills read and write state in `.arc/` at the project root, while the plugin's code lives in `${CLAUDE_PLUGIN_ROOT}` (the plugin cache). This split requires a clear contract:

1. **Skills reference templates via `${CLAUDE_PLUGIN_ROOT}`**: Prompt templates, configuration templates, and reference documentation live in the plugin. Skills use paths like `${CLAUDE_PLUGIN_ROOT}/skills/research/references/prompt-web-researcher.md` to load templates.
2. **Skills read/write state via project root**: `state.yml`, `sources.yml`, `log.yml`, phase artifacts (`.arc/scope/`, `.arc/research/`, `.arc/design/`, `.arc/plan/`, `.arc/execute/`), and checkpoints live in `.arc/`.
3. **SessionStart hook bridges the gap**: The hook reads `.arc/state.yml` from the project root and injects a context summary into the session, regardless of where the plugin code lives. The hook script must handle the case where `.arc/` does not exist (no active lifecycle) gracefully.
4. **State.yml is always the entry point**: Every skill starts by reading `.arc/state.yml` to understand lifecycle position. This is the "read state first" pattern from GSD, universally applied.
5. **Template initialization on first use**: When a user runs `/arc:scope` for the first time, the skill creates `.arc/` and initializes `state.yml` and `sources.yml` from templates in `${CLAUDE_PLUGIN_ROOT}/templates/`. Subsequent skills never re-initialize.

The dynamic context injection feature of SKILL.md (the `` !`command` `` syntax) provides an elegant mechanism for this bridge. A skill can use:
```
Current lifecycle state:
!`cat .arc/state.yml 2>/dev/null || echo "No active lifecycle"`
```
This runs before the skill content reaches Claude, embedding the current state directly into the skill prompt without requiring an explicit Read tool call.

### Prompt Engineering Patterns That Apply Across All Phases

Several prompt engineering patterns are universally applicable across all 5 phases and gate evaluations:

1. **Role definition with expertise domains**: Every agent prompt starts with a clear role statement specifying expertise, not personality. "You are a senior research analyst specializing in..." rather than "You are a helpful, thorough researcher." Research shows direct specification outperforms imagination-based framing. (per category-prompt-engineering, Role Framing)

2. **Downstream consumer specification**: Every agent prompt states who reads its output and what they need. This is validated by Anthropic's own multi-agent research system, research-engine's plan validator template ("The synthesizer agent will read your output -- make it actionable, not just evaluative"), and the prompt engineering research's general finding that agents produce better output when they know their audience. (per app-analysis DA-6, category-prompt-engineering)

3. **Quality gate checklist before completion**: Every agent prompt ends with a pre-completion verification list. The agent must evaluate the checklist before returning. GSD's pattern: "Before returning PLANNING COMPLETE: [ ] PLAN.md files created... [ ] Each plan has valid frontmatter..." The prompt engineering research validates this with multiple references to self-verification patterns (CoVe, multi-candidate verification). (per app-analysis DA-6, category-prompt-engineering)

4. **Schema-first output format**: The output structure is defined first, then instructions are crafted to produce it. Tables and checklists preferred over narrative prose for parseable output. Include the exact schema in the prompt itself. Structured formats are inherently more token-efficient than prose while preserving all information needed by downstream consumers. (per category-prompt-engineering, Structured Output Patterns)

5. **Condensed returns with dual targets**: Research agents include explicit token budgets in output format sections. The budget should specify both the inline return to the parent (200-500 tokens, summary only) and the file output (1,000-2,000 tokens, detailed evidence). This dual-target pattern preserves parent context while providing sufficient detail for synthesis. (per category-subagent-orchestration, Condensed Returns)

6. **XML tags for structural compartments**: Use `<role>`, `<context>`, `<instructions>`, `<output_format>`, `<quality_gate>`, `<input_data>` to create labeled sections. Claude is specifically fine-tuned to recognize XML structure. This prevents instructions from leaking into context interpretation and vice versa. (per category-prompt-engineering, Key Finding 3)

7. **Context as a curated view, not a raw dump**: Each agent receives only the information relevant to its specific task. Overloading agents with full system context degrades performance. For research subagents, this means: inline only the specific questions, source configuration, and relevant prior evidence -- not the entire state.yml or conversation history. (per category-prompt-engineering, Pattern 4; per category-subagent-orchestration, Context Minimization)

8. **Validation gates between agent handoffs**: A bad output early in a chain cascades through all subsequent steps. The prompt engineering research identifies this as the "error cascade" anti-pattern. Mitigation: every agent handoff should include a quality check. In arc, the gate system serves this purpose between phases. Within the research phase, the sufficiency assessment serves as an intra-phase quality check between research and synthesis.

### The Orchestrator Reads, Agent Writes Pattern

Both reference implementations follow a consistent data flow pattern that should be universal in arc:

1. The SKILL.md orchestrator reads all input files (state.yml, prior phase artifacts, prompt templates)
2. The orchestrator constructs agent prompts by combining static templates with dynamic context
3. Agents are spawned via Task() with the constructed prompts
4. Agents write their output to designated files (e.g., `evidence-batch-1.md`, `SYNTHESIS.md`)
5. Agents return a brief summary inline to the orchestrator
6. The orchestrator reads output files when needed for the next step (synthesis, gate evaluation)
7. The orchestrator updates state.yml to reflect progress

The orchestrator never writes phase artifacts directly (except state/progress tracking). Agents never read state.yml directly (the orchestrator inlines relevant state into their prompts). This separation keeps the data flow unidirectional and prevents agents from making conflicting state updates.

### Error Handling Across the Lifecycle

The subagent orchestration research identifies 14 failure modes from the MAST taxonomy (Multi-Agent System Failure Taxonomy, NeurIPS 2025) clustered into three categories. The most relevant to arc are:

**Specification failures** (agents disobeying task specifications, failing to adhere to role specifications): Mitigated by the prompt engineering patterns above -- clear role definitions, explicit output formats, quality gate checklists. The prompt engineering research notes that "agents cannot read between lines, infer context, or ask clarifying questions during execution. Every ambiguity becomes a decision point where agents explore all possible interpretations."

**Inter-agent misalignment** (breakdown in critical information flow, conversational resets): Mitigated by the file-based output pattern and condensed returns. Each agent writes to a designated file; the orchestrator reads files rather than relying on inline returns that could be truncated or malformed.

**Termination failures** (premature termination, incomplete outcomes): Mitigated by the quality gate checklist pattern and the orchestrator's post-completion validation. The subagent orchestration research recommends timeout wrapping (10-minute default) to prevent hung subagents from blocking the workflow.

Claude Code-specific failure modes relevant to arc:
- **Subagent hang**: Agent stops producing output. No built-in timeout or recovery. The orchestrator's prompt should include timeout expectations.
- **Rate limit exhaustion**: Multiple parallel subagents can trigger API rate limits. The `resume` parameter with agent ID allows continuation after rate limits clear.
- **Permission denial**: Background subagents auto-deny unpre-approved permissions. For arc, research subagents should use foreground execution to ensure permission prompts pass through.
- **Context exhaustion**: Subagent hits token limit and auto-compacts. For research agents with large output, this should be rare if prompts stay under 5K tokens.

The recommended error handling pattern for arc's research phase:
1. Spawn research agents with timeout expectations in the prompt
2. If an agent fails, note the failure and continue with remaining agents
3. Synthesize from available results (graceful degradation)
4. Mark failing questions as INSUFFICIENT or INSUFFICIENT-SOURCE-UNAVAILABLE based on the failure type
5. The gate evaluation will catch insufficient research and trigger Recycle if needed

### Token Budget Estimation

Based on evidence from the subagent orchestration research and the plugin architecture research, the estimated token budgets for arc's key operations are:

| Operation | Overhead | Prompt | Agent Work | Return | Total Est. |
|-----------|----------|--------|------------|--------|-----------|
| Research subagent (Sonnet) | ~50K | ~5K | ~20-30K | ~1-2K | ~75-85K |
| Synthesis agent (Opus) | ~50K | ~15-20K | ~30-40K | ~5K | ~100-115K |
| Gate evaluator (Opus) | ~50K | ~10K | ~15-20K | ~3K | ~78-83K |
| Scope decomposer (Opus) | ~50K | ~5K | ~20K | ~5K | ~80K |
| Design agent (Opus) | ~50K | ~20K | ~40-50K | ~10K | ~120-130K |

For a typical research phase with 3 research subagents + 1 synthesis agent + 1 gate evaluator:
- Research: 3 x ~80K = ~240K tokens
- Synthesis: ~110K tokens
- Gate: ~80K tokens
- Orchestrator context: ~30-50K tokens
- **Estimated total: ~460-480K tokens for the research phase**

This is approximately 10-15x more expensive than a single-chat research interaction, which aligns with Anthropic's published figure of "~15x more tokens for multi-agent vs. single-chat" (per category-source-integration, citing Anthropic's multi-agent research system blog post).

These estimates are rough. Actual costs depend on the number of questions, source complexity, and how much the agents need to search. The design phase should treat these as order-of-magnitude guidance, not precise predictions.

### The "Fresh Agent with Context" Resume Pattern

Both reference implementations and the state management research converge on this critical insight: resume after interruption is not "pick up where you left off" (impossible with stateless LLMs) but "spawn a fresh session with enough context to continue." The checkpoint contains enough context for a new session to understand what was done, what is next, and any intermediate results needed.

This pattern has specific implications for arc:
- Checkpoint files must be self-contained (not dependent on conversation context that was lost)
- State.yml must capture enough position information that a fresh skill invocation can determine exactly where to resume
- The SessionStart hook's primary value is automating this "read checkpoint, present resumption context" flow
- If the hook fails, `/arc:status` provides the same information manually

---

## Tensions & Contradictions

### 1. Product Design's Per-Question Model vs. Reference Implementation's Per-Category Model

The product design (C-4, C-11) specifies per-question research dispatch and per-question sufficiency assessment. Research-engine dispatches per-category and evaluates per-decision-area. The SCOPE.md (DA-8) explicitly acknowledges this tension: "If per-category turns out to be clearly better, recommend changing the product design accordingly."

**Analysis**: Per-category is clearly better for dispatch efficiency (fewer agents, less token overhead). Per-question is clearly better for sufficiency tracking (more granular, supports gap-fill targeting). The hybrid source-affinity batching approach resolves the dispatch side while preserving per-question tracking. The design phase should formalize this hybrid rather than strictly following either the product design's pure per-question model or research-engine's pure per-category model.

**Specific evidence for the hybrid**:
- Anthropic recommends 3-5 concurrent agents (per category-subagent-orchestration). With 10+ questions, per-question dispatch would exceed this.
- Research-engine's per-category agents successfully handle broad research topics with 4-6 questions each per category. Each agent can handle multiple questions within its domain.
- The subagent orchestration research notes each subagent consumes ~50K tokens of overhead. Minimizing agent count has a direct, measurable cost benefit.
- The product design's per-question sufficiency assessment (coverage, corroboration, actionability) can be applied to per-question evidence regardless of how that evidence was gathered (per-question or per-batch).

### 2. SessionStart Hook Bugs vs. Context Reconstruction Requirement

The product design (C-6) depends on SessionStart hooks for context reconstruction. The plugin architecture research identifies three open bugs that may prevent this from working reliably. Research-engine has no hooks at all; GSD does not use plugin hooks (it uses custom commands that manually read state).

**Analysis**: This is a real risk, not a theoretical concern. The three bugs are:
- **#16538**: Plugin-defined SessionStart hooks may not surface `hookSpecificOutput.additionalContext` to Claude. Open status.
- **#13650**: SessionStart hook stdout silently dropped despite valid JSON output. Open status.
- **#11509**: SessionStart hooks never execute for local file-based marketplace plugins. Open status.

The fallback strategy is critical: arc's `/arc:status` skill should be designed to work as a manual context reconstruction mechanism (user invokes it after `/clear` if the hook fails). The SessionStart hook is the preferred path, but the status skill is the safety net. Design both from the start.

Additionally, the plugin architecture research notes that using plain text stdout (not structured JSON) may work even when the `additionalContext` JSON mechanism fails. The hook script can output a plain text summary of lifecycle state, and Claude will receive it as context. This should be the primary implementation approach, with structured JSON as the secondary approach.

### 3. AskUserQuestion Constraints vs. Product Design UX

The product design specifies a rich source checklist UX with checkable/uncheckable items, toggle behavior, and "go to proceed." AskUserQuestion supports only 1-4 questions with 2-4 options each, no toggle UI, no custom TUI components (feature request #17462 is open but not implemented).

**Analysis**: The product design's source checklist UX must be simplified. Use `multiSelect: true` for source selection with up to 4 options per question. If more than 4 sources are needed, use multiple questions (up to 4 questions x 4 options = 16 sources) or group related sources. The "go to proceed" becomes a separate freeform confirmation prompt after the selection questions, not part of the AskUserQuestion call itself. This is a genuine capability gap in the platform, not a design error.

The 60-second timeout on AskUserQuestion also affects the scope phase's interactive questioning rounds. If users need more than 60 seconds to answer a complex scope question, the timeout will expire. This may require using freeform text prompts for complex questions rather than AskUserQuestion's structured format.

### 4. Subagent Background Execution Discrepancy

The subagent orchestration research lists `run_in_background` as a Task tool parameter. The plugin architecture research (based on official docs) says it is NOT a Task tool parameter but a runtime decision. GSD's config has `parallel: true/false` but the enforcement mechanism is through prompt instructions.

**Analysis**: The plugin architecture research is more likely correct (based on primary Anthropic documentation -- the hooks reference explicitly lists the Task tool parameters as `prompt`, `description`, `subagent_type`, and optionally `model`). The subagent orchestration research cites secondary sources that may conflate the Task tool's parameters with agent definition frontmatter fields (where `background: true` IS a valid field).

For arc's research orchestration, the orchestrator skill should instruct Claude to spawn research agents in parallel via its prompt instructions (e.g., "Spawn these three research agents simultaneously, all in parallel"). Research-engine demonstrates this pattern successfully: "Spawn one agent PER CATEGORY from SCOPE.md's Research Category Mapping table, all in parallel." Whether Claude actually dispatches them simultaneously depends on its runtime interpretation, but the instruction establishes the intent.

### 5. Condensed Returns: Prompt Enforcement vs. API Enforcement

The product design (C-12) specifies 1,000-2,000 token condensed returns. The subagent orchestration research confirms there is no built-in parameter to enforce output length. The prompt engineering research recommends explicit format instructions with token budgets.

**Analysis**: Prompt enforcement is the only option. All sources agree on this. The recommended pattern is:
1. Instruct the agent to write detailed findings to a designated file
2. Instruct the agent to return only a brief summary inline
3. Specify the exact summary structure and length: "Return a summary of no more than 1,500 tokens to the parent conversation with: 3-5 key findings (one line each), confidence level, number of sources found, and unfulfilled evidence requirements."
4. Include the token budget in the `<output_format>` section of the prompt

This works in practice -- research-engine's agents follow output format instructions reliably. But it is not guaranteed. The design should account for agents occasionally exceeding the budget by having the orchestrator's synthesis step read from output files (not from inline returns) as the primary data source.

### 6. GSD's Markdown State vs. Arc's YAML State

GSD uses Markdown for STATE.md (human-readable, section-based, incrementally updated). Arc's product design specifies YAML for state.yml (machine-parseable, key-value pairs, complete rewrites). Neither reference implementation uses YAML for state.

**Analysis**: The product design's choice of YAML is deliberate and well-motivated: "YAML for machine state, Markdown for human artifacts." The state management patterns research validates this, noting that YAML's explicit typing, flat structure, and key-value format are more reliably parsed by LLMs than Markdown's implicit section structure. GSD's Markdown state works because GSD's LLM agents are sophisticated enough to navigate free-form text, but a more structured format reduces parsing errors. The trade-off is that YAML is less natural for accumulated context (decisions, blockers) -- these may be better suited to a separate Markdown file or as quoted strings within YAML.

### 7. Research-Engine's Implicit State vs. Product Design's Explicit State

Research-engine has no state file and no state machine. It infers lifecycle position from artifact existence. The product design specifies explicit state management via state.yml with detailed per-question tracking.

**Analysis**: These are not contradictory -- they represent different points on the complexity spectrum. Research-engine can afford implicit state because its lifecycle is simpler (5 skills, no per-question tracking, no gate history, no recycle counting). Arc's lifecycle requires explicit state because it has more state to track. However, research-engine's implicit approach should be preserved as a defense-in-depth fallback: if state.yml is missing or corrupt, the system should be able to infer approximate position from artifact existence.

The state management patterns research supports this dual approach: "State should be reconstructable from artifacts (defense in depth)." GSD's `/gsd:health --repair` command demonstrates the concrete implementation -- it creates a timestamped backup of the current state file, then regenerates it from the filesystem.

---

## Knowledge Gaps

### Gap 1: Sufficiency Judgment Reliability
- **What is missing**: No empirical data on how reliably an LLM can assess per-question sufficiency using the three-criteria model (coverage, corroboration, actionability). Neither reference implementation uses this exact model. Research-engine uses broader per-decision-area evaluation with a simpler rubric (COVERED / PARTIALLY COVERED / NOT COVERED per evidence requirement). The prompt engineering research provides LLM-as-judge patterns but does not test them specifically against research sufficiency.
- **Impact on implementation confidence**: Medium-high. If sufficiency judgments are unreliable, gates will be either too lenient (passing insufficient research) or too strict (recycling unnecessarily). The target 60-80% first-pass approval rate may not be achievable. This directly affects the user experience of the Research -> Design transition.
- **Blocking or resolvable during implementation**: Resolvable during implementation. The gate evaluation prompt is the most critical prompt to get right, and it can be tuned iteratively based on observed behavior. The prompt engineering research recommends: (1) explicit rubric with scoring framework, (2) structured output format for assessment, (3) separation of evaluation from recommendation, and (4) Chain-of-Verification for self-checking. These techniques can improve judgment quality.
- **Suggested approach**: Start with a generous threshold (err on the side of passing) and tighten based on observed quality of downstream design outputs. Log gate outcomes in log.yml for calibration data.

### Gap 2: SessionStart Hook Reliability for Plugins
- **What is missing**: No confirmed working example of a plugin-defined SessionStart hook that successfully injects `additionalContext` into Claude's context. Three open bugs (#16538, #13650, #11509) suggest this may not work. The plugin architecture research notes that additional bug #27145 reports `CLAUDE_PLUGIN_ROOT` env variable not being set for SessionStart hooks.
- **Impact on implementation confidence**: High. Context reconstruction after `/clear` is a core product requirement (C-6). If the hook does not work, users must manually invoke `/arc:status` every time they clear context, which degrades the user experience significantly.
- **Blocking or resolvable during implementation**: Resolvable, but requires a fallback design from the start. The fallback (`/arc:status` as manual context reconstruction) must be a first-class citizen, not an afterthought. If the hook works, it provides seamless UX. If not, the status skill provides equivalent functionality with one extra user action.
- **Suggested approach**: Test the SessionStart hook early using `claude --plugin-dir`. Try plain text stdout (not structured JSON) first, as this may bypass the `additionalContext` bug. If neither works, design the `/arc:status` skill to be invokable both manually and via Claude's auto-invocation (based on skill description matching).

### Gap 3: Practical Token Cost of Research Orchestration
- **What is missing**: No concrete data on the total token cost of arc's research phase. The subagent orchestration research cites ~50K tokens per subagent turn for overhead (MCP tool descriptions, global configuration). With 3-5 research subagents plus a synthesis agent, the research phase could consume 200K-350K tokens before producing any useful output.
- **Impact on implementation confidence**: Medium. Token cost affects practical usability, user satisfaction, and operating cost. Anthropic's multi-agent research system uses ~15x more tokens than single-chat interactions, which is a useful baseline but may not apply directly to arc's lighter research tasks.
- **Blocking or resolvable during implementation**: Resolvable through implementation-time optimization. Key mitigations: (1) keep subagent prompts under 5K tokens, (2) use Sonnet for research agents (cheaper than Opus), (3) limit concurrent agents to 3, (4) restrict subagent tools to only what is needed (fewer tools = fewer tool description tokens), (5) file-based output pattern (agents write to files, return brief summaries to preserve parent context).
- **Suggested approach**: Measure token consumption during initial testing. If research phase costs exceed acceptable thresholds, reduce batch count (fewer, larger batches with more questions each) or switch to sequential research with a single agent handling all questions.

### Gap 4: Progress Update Mechanism During Research
- **What is missing**: The product design requires 60-second progress updates during research. No source provides a mechanism for this within Claude Code's Task tool. Foreground subagents block the main conversation; background subagents do not report progress. There is no polling mechanism, no event stream, and no callback from within a running Task() invocation.
- **Impact on implementation confidence**: Low-medium. Progress updates are a UX improvement, not a functional requirement. Users can wait for research to complete. The research phase typically takes 5-15 minutes; lack of progress updates during this time is noticeable but not blocking.
- **Blocking or resolvable during implementation**: Resolvable by relaxing the requirement. The 60-second interval is not achievable with current platform capabilities.
- **Suggested approach**: Implement "report after each batch completes" rather than true 60-second intervals. The orchestrator can report: "Batch 1 (web research) complete. Batch 2 (codebase analysis) in progress. Batch 3 (MCP sources) queued." This provides meaningful progress indication at natural batch boundaries.

### Gap 5: Cross-Lifecycle Artifact Detection (Connected Flow)
- **What is missing**: No reference implementation demonstrates detecting prior lifecycle artifacts (DESIGN.md, HANDOFF.md) and offering to import them into a new lifecycle. The connected flow (product intent lifecycle produces HANDOFF.md, engineering intent lifecycle imports it) is entirely new. The mechanics of scanning `.arc/design/` and `.arc/archive/` for prior artifacts, presenting them to the user, and incorporating selected artifacts as context for the new lifecycle are unspecified.
- **Impact on implementation confidence**: Low. This is a v1 nice-to-have, not a core requirement. The basic mechanism (file existence checking + AskUserQuestion for import confirmation) is straightforward.
- **Blocking or resolvable during implementation**: Resolvable. The scope skill can scan known artifact locations and offer import via AskUserQuestion. The imported artifact content becomes context for the scope phase's question generation.
- **Suggested approach**: Implement as a simple scan at the start of `/arc:scope`. If `.arc/design/DESIGN.md`, `.arc/design/HANDOFF.md`, or `.arc/archive/*/DESIGN.md` exists, present options to the user: "Found prior design artifacts. Import as context for this lifecycle? [Yes / No / Review first]"

### Gap 6: Concurrent Dispatch Reliability
- **What is missing**: No confirmed data on how reliably Claude Code dispatches 3-5 simultaneous Task() calls when instructed to do so by an orchestrator prompt. The subagent orchestration research notes that "without explicit rules, Claude defaults to conservative sequential execution." Research-engine's "all in parallel" instruction appears to work based on code inspection, but there are no published benchmarks or reliability statistics.
- **Impact on implementation confidence**: Medium. If parallel dispatch is unreliable, research will take 3-5x longer (sequential agent execution instead of parallel). This directly affects the time-to-results for the research phase and overall user experience.
- **Blocking or resolvable during implementation**: Resolvable through testing and prompt optimization. If parallel dispatch proves unreliable, the design can fall back to sequential batch execution without changing the overall architecture.
- **Suggested approach**: Test with explicit parallel dispatch instructions during implementation. Use research-engine's proven phrasing as a starting point: "Spawn one agent PER BATCH, all in parallel." If this does not reliably trigger parallel execution, try alternative phrasings or batch size adjustments.

### Gap 7: Model Tier Configuration Mechanism
- **What is missing**: The exact mechanism for configuring model tiers at the arc level. GSD uses a model profile system in config.json (quality/balanced/budget profiles mapping agent types to models). Research-engine uses frontmatter in prompt templates (hardcoded `model: opus` per template). The Task tool accepts a `model` parameter with values like "sonnet", "opus", "haiku", "inherit". How to make this configurable (not hardcoded) in a plugin context is not fully specified.
- **Impact on implementation confidence**: Low-medium. Model tiering is a cost optimization, not a functional requirement. Hardcoding models in prompt frontmatter (research-engine's approach) works for v1. Making it configurable (GSD's approach) is better for user flexibility.
- **Blocking or resolvable during implementation**: Resolvable. Either approach works. The design phase should decide whether to use GSD's profile system (more flexible) or research-engine's frontmatter system (simpler).
- **Suggested approach**: Start with research-engine's frontmatter approach for v1. Add profile-based configuration as a v2 enhancement if user demand warrants it.

---

## Source Quality Assessment

### Strongest Evidence (High Confidence -- Design Can Proceed Directly)

**DA-1 (Plugin File Structure)**: Multiple independent sources (official Anthropic docs, research-engine inspection, GSD inspection, web research) converge on the same plugin structure conventions. Research-engine provides a near-complete template that can be adapted with minimal uncertainty. The plugin.json schema, skill frontmatter format, and `${CLAUDE_PLUGIN_ROOT}` variable behavior are all confirmed by primary documentation. Confidence: **very high**.

**DA-4 (Subagent Orchestration)**: Three independent research categories (app analysis, subagent orchestration, plugin architecture) provide consistent information about the Task tool API, constraints, and patterns. Anthropic's own multi-agent research system (published engineering blog post) validates the orchestrator-worker pattern at scale. The critical constraint (no nested subagents) is confirmed by all sources. The file-based output pattern and condensed returns are demonstrated by research-engine in production. Confidence: **very high**.

**DA-6 (Prompt Engineering)**: Anthropic's published engineering blog post on their multi-agent research system provides first-party validation that "prompt engineering was the primary lever for improving agent behaviors." This is supplemented by 12 concrete prompt templates from research-engine (inspected locally), GSD's XML-structured prompts with quality gates, and extensive academic/practitioner literature from the prompt engineering research category. The 8-section template structure synthesized from all sources provides a concrete, validated framework. Confidence: **very high**.

### Moderate Evidence (Design Can Proceed with Noted Uncertainties)

**DA-2 (State Management)**: GSD provides a proven pattern for centralized state management (read-first, update-at-checkpoints). The state management patterns research provides theoretical depth from infrastructure-as-code tools (Terraform, Pulumi), LLM workflow frameworks (LangGraph), and general software engineering patterns. YAML-specific safety practices are well-documented. The SessionStart hook bugs introduce genuine uncertainty for the context reconstruction mechanism, but the state management model itself is well-understood. Confidence: **high** for state model, **medium** for hook-based reconstruction.

**DA-3 (Gate Evaluation)**: Research-engine's check-readiness skill provides a concrete implementation of a single-agent evaluator producing structured evaluation output. GSD's goal-backward verification provides a complementary methodology. Neither implements arc's specific MUST/SHOULD criteria split, three-outcome model, or per-question sufficiency assessment. The prompt engineering research provides LLM-as-judge patterns and rubric-based evaluation techniques that apply to gate implementation. Confidence: **medium-high** for gate structure/mechanics, **medium** for sufficiency judgment reliability.

**DA-7 (Execute Phase)**: GSD provides the most comprehensive execution pattern in the evidence base: wave-based ordering, dependency validation, subagent executor spawning, checkpoint handling, and SUMMARY.md completion markers. Arc's adaptation to main-session execution is a simplification (removing subagent executors), which should be straightforward. The micro-interaction UX ("Continue? yes/pause/review") is new but implementable via freeform prompting. Confidence: **medium-high**.

**DA-8 (Research Orchestration)**: Research-engine provides a proven orchestration pipeline (codebase analysis -> parallel web research -> synthesis). The gap-fill flow (research-gaps skill) maps directly to arc's Recycle mechanism. The adaptation from per-category to per-question dispatch is the significant change. The hybrid source-affinity batching approach is a synthesis recommendation (not a tested pattern) but is logically consistent with both research-engine's proven patterns and the subagent orchestration research's fan-out/fan-in model. Confidence: **medium**.

**DA-5 (Source Routing)**: MCP integration patterns are well-documented by official Anthropic docs and the source integration research. The `mcp__<server>__<tool>` naming convention, wildcard allowed-tools declarations, and error handling via `isError` flag are all confirmed. The gap is in MCP server availability pre-checking (no API exists) and the AskUserQuestion limitations for source selection UX. The routing logic itself (orchestrator-level, not subagent-level) is validated by both Anthropic's research system and research-engine's approach. Confidence: **medium**.

### Weakest Evidence (Design Should Treat as Iterative/Experimental)

**DA-9 (Intent-Adaptive Behavior)**: No reference implementation demonstrates anything similar to intent-adaptive behavior. Research-engine is product-focused by default; GSD is engineering-focused by default; neither switches between modes. The prompt engineering research provides the mechanism (variable injection / lens pattern, conditional XML sections) but not the content (what specifically should change for product vs. engineering across scope, research, design, plan, and execute phases). The product design itself acknowledges this as the weakest evidence area with a SPECULATION FLAG. The design phase should treat intent adaptation as the most experimental part of the design, with easy iteration built in. Confidence: **low-medium**.

**DA-10 (Passive Telemetry)**: Neither reference implementation has telemetry. GSD has performance metrics in STATE.md and metadata in SUMMARY.md, which provides a model for what execution data looks like, but not a logging mechanism. The multi-document YAML append pattern from the state management research is well-supported theoretically but untested in the specific context of LLM-driven append-only logging. The risk of accidental overwrites (LLM rewrites the file instead of appending) is non-trivial and has no mitigation pattern in the evidence. Value delivery depends entirely on v2 calibration work that is deferred. Confidence: **medium** (pattern is sound, practical reliability and value are uncertain).

### Research Asymmetry Note

GSD has extensive public documentation: a GitHub repository with 1,400+ stars, DeepWiki analysis covering architecture and internals, The New Stack articles, a community course on ccforeveryone.com, and numerous community discussions. Research-engine has minimal to no public presence -- no npm package, no public GitHub repository, and no community documentation were found via web search. All evidence about research-engine comes from local codebase inspection at `/Users/jaredwallenfels/.claude/plugins/cache/local/research-engine/0.1.0/`.

This asymmetry means:
- **GSD patterns** are externally validated by community adoption and public code review. Multiple independent observers have analyzed and documented the same patterns.
- **Research-engine patterns** are validated only by direct code inspection (the app analysis document). They are likely reliable (the code works in practice for this project), but there is no external corroboration.
- **Web research categories** primarily found GSD-related material and general Claude Code patterns. Research-engine-specific patterns could not be corroborated via web search.

Both are valuable as evidence sources. For patterns where both references agree (plugin structure, template loading, subagent spawning), confidence is highest. For patterns where only one reference provides evidence, the design phase should note which reference and assess accordingly.

### Archival and Lifecycle Management Patterns

The product design specifies single lifecycle at a time per project (C-17) with archival on new start. The state management patterns research provides relevant patterns from Terraform (S3 versioning with lifecycle rules) and general software engineering (event sourcing with snapshot compaction). For arc's file-based context:

**Archival flow**: When a user starts a new lifecycle via `/arc:scope` while an existing lifecycle exists in `.arc/`:
1. Generate a slug from the existing lifecycle's project name and timestamp
2. Move the entire `.arc/` contents to `.arc/archive/{slug}/`
3. Preserve `sources.yml` at `.arc/sources.yml` (not moved to archive -- source config persists across lifecycles)
4. Initialize fresh `state.yml` for the new lifecycle
5. The archived lifecycle is read-only and serves as a reference (e.g., for connected flow artifact detection)

Neither reference implementation demonstrates this exact pattern. Research-engine does not have archival (each research topic creates its own directory structure). GSD archives completed phases within a lifecycle but does not archive entire lifecycles. Git history provides an additional safety net -- even if archive files are accidentally modified, the original state is recoverable from git.

**Per-phase archival within a lifecycle**: The state management patterns research recommends archiving completed phase data to keep the active state file small. Each archived phase directory should be self-contained with a SUMMARY.md and no forward references to state.yml. This is not explicitly required by the product design but is a good practice for long-running lifecycles.

### Evidence Coverage Summary

| Decision Area | App Analysis | Reference Impl. | Plugin Arch. | Subagent Orch. | Prompt Eng. | State Mgmt. | Source Integ. | Overall |
|--------------|:----------:|:----------:|:----------:|:----------:|:----------:|:----------:|:----------:|:----------:|
| DA-1 | Deep | Deep | Deep | - | - | - | - | Very High |
| DA-2 | Deep | Moderate | Moderate | - | - | Deep | - | High |
| DA-3 | Deep | Moderate | - | - | Moderate | Moderate | - | Medium-High |
| DA-4 | Deep | Moderate | Deep | Deep | - | - | - | Very High |
| DA-5 | Moderate | Shallow | Moderate | - | - | - | Deep | Medium |
| DA-6 | Deep | Moderate | - | Moderate | Deep | - | - | Very High |
| DA-7 | Deep | Deep | - | - | Moderate | Moderate | - | Medium-High |
| DA-8 | Deep | Moderate | - | Moderate | - | - | - | Medium |
| DA-9 | Moderate | None | - | - | Moderate | Shallow | - | Low-Medium |
| DA-10 | Moderate | Shallow | - | - | - | Moderate | - | Medium |
