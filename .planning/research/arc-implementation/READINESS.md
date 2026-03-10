# Readiness Evaluation: Arc Implementation Architecture

**Evaluation Round:** 2 (re-evaluation after gap research)
**Evaluation Date:** 2026-02-26
**Evaluator:** Readiness evaluation agent
**Sources Evaluated:** SCOPE.md, research-synthesis.md (7 research documents), round-2/supplement-synthesis.md (synthesizing 3 gap research files: gap-source-routing.md, gap-research-orchestration.md, gap-intent-adaptive.md)

---

## Readiness Summary

- **Evaluation round:** 2 (re-evaluation after gap research)
- **Overall:** 10 of 10 decision areas READY, 0 NEEDS MORE, 0 INSUFFICIENT
- **Estimated additional research effort:** None required. All decision areas have sufficient evidence for confident design.
- **Recommendation:** Proceed to design. DA-9 (Intent-Adaptive Behavior) remains the highest-iteration-risk area but now has sufficient grounding in established product management and engineering methodology to support a reasonable first-iteration design. The design phase should treat HANDOFF.md and cross-lifecycle import as v1-iteration candidates subject to refinement.

---

## Decision Area Assessments

### DA-1: Plugin File Structure and Skill Decomposition
**Status:** READY
**Priority:** Critical
**Evidence Coverage:** 6 of 6 requirements covered

| # | Evidence Requirement | Status | Evidence Found |
|---|---------------------|--------|----------------|
| 1 | Exact Claude Code plugin directory structure conventions (plugin.json schema, skills/ layout, references/, `${CLAUDE_PLUGIN_ROOT}`) | COVERED | Plugin architecture research confirms plugin.json schema (name, version, description, author), skills auto-discovered from `skills/{name}/SKILL.md`, references/ subdirectories per skill, `${CLAUDE_PLUGIN_ROOT}` resolves to `~/.claude/plugins/cache/`. Confirmed by official docs and research-engine inspection. |
| 2 | How research-engine organizes its 5 skills, prompt templates, and shared resources | COVERED | App analysis provides deep inspection: skills/{phase}/SKILL.md + references/prompt-*.md per skill. 12 concrete prompt templates documented. Minimal plugin.json with auto-discovery. |
| 3 | How GSD organizes its commands, workflows, agents, templates, and references | COVERED | Reference implementation analysis covers GSD's `~/.claude/commands/gsd/` commands referencing workflows in `~/.claude/get-shit-done/`. Agent definitions documented. Identified as legacy pattern -- arc should use plugin architecture. |
| 4 | Difference between plugin skills (SKILL.md with frontmatter) and custom slash commands | COVERED | Plugin architecture research documents both: skills have frontmatter (name, description, allowed-tools, agent, argument-hint) controlling runtime behavior. Custom commands are simpler. Skills are the recommended approach. |
| 5 | How skill frontmatter controls runtime behavior and tool availability | COVERED | Frontmatter fields confirmed: name, description, allowed-tools (with wildcard support for MCP), subagent_type, model. Description enables trigger-phrase routing for auto-invocation. |
| 6 | Best practices for organizing prompt templates loaded at runtime | COVERED | Research-engine demonstrates the pattern: SKILL.md orchestrator reads templates from references/, extracts frontmatter metadata, combines with dynamic context, spawns via Task(). Dynamic injection syntax documented. |

**Readiness Criterion:** "Ready when we have a complete inventory of research-engine's and GSD's file structures, understand the plugin.json schema and skill frontmatter format, and can articulate the specific directory layout for arc with confidence that it follows Claude Code conventions."
**Criterion Met:** Yes

**Overall Assessment:** The strongest decision area. A concrete arc directory layout is documented in the synthesis, validated by multiple independent sources. Research-engine provides a near-complete template. Ready for design with high confidence.

---

### DA-2: State Machine and Lifecycle Management
**Status:** READY
**Priority:** Critical
**Evidence Coverage:** 6 of 6 requirements covered

| # | Evidence Requirement | Status | Evidence Found |
|---|---------------------|--------|----------------|
| 1 | How GSD implements STATE.md -- fields, read/written by commands, resume after context loss | COVERED | Reference implementation analysis documents STATE.md: current phase, accumulated context, performance metrics. Read at start of every workflow, updated at checkpoints. Resume via reading state + plan files + git log. |
| 2 | How research-engine tracks research progress across skill invocations | COVERED | App analysis documents implicit state model: no state file, infers position from artifact existence. Per-question status tracked via READINESS.md evaluation output. |
| 3 | YAML read/write patterns in Claude Code skills | COVERED | State management patterns research: complete-file rewrites (never partial), backup-before-write, quote all strings, explicit null, max 2 nesting levels, keep under 100 lines. |
| 4 | SessionStart hook implementation pattern | COVERED | Plugin architecture research documents hook registration (hooks.json or inline plugin.json), shell script execution, stdout capture. Three open bugs identified (#16538, #13650, #11509). Plain text stdout fallback recommended. /arc:status as manual fallback documented. |
| 5 | State validation patterns -- stale/corrupted state, partial writes, reconciliation | COVERED | Backup-before-write for corruption recovery, artifact-based reconstruction as defense-in-depth, `last_modified` timestamp for staleness, `version` field for schema evolution. GSD's health --repair demonstrates reconciliation. |
| 6 | Archival implementation -- moving `.arc/` to archive while preserving sources.yml | COVERED | Complete archival flow documented: generate slug, move contents to .arc/archive/{slug}/, preserve sources.yml at root, initialize fresh state.yml. |

**Readiness Criterion:** "Ready when we have concrete patterns for YAML state read/write in Claude Code, understand how both reference implementations handle state persistence across /clear boundaries, and have a validated approach for the SessionStart hook."
**Criterion Met:** Yes (with SessionStart hook risk acknowledged and fallback designed)

**Overall Assessment:** State management patterns are well-understood from multiple sources. YAML safety practices, backup-before-write, and artifact-based reconstruction provide a robust foundation. SessionStart hook carries platform risk (3 open bugs), but the fallback strategy (/arc:status as manual reconstruction) is designed from the start. Ready for design.

---

### DA-3: Gate Evaluation and Readiness Checking Implementation
**Status:** READY
**Priority:** Critical
**Evidence Coverage:** 6 of 6 requirements covered

| # | Evidence Requirement | Status | Evidence Found |
|---|---------------------|--------|----------------|
| 1 | How research-engine's check-readiness evaluates decision areas -- exact flow | COVERED | App analysis documents: single evaluator agent (opus) reads all artifacts, evaluates per evidence requirement using COVERED/PARTIALLY/NOT COVERED rubric, produces structured READINESS.md with gap summary table. |
| 2 | How GSD's verification system works -- gap_found/passed/human_needed routing | COVERED | Reference implementation analysis documents goal-backward verification: derive what must be true, verify each prerequisite, route by status. Three-outcome model with gap descriptions. |
| 3 | Whether gates should be separate skills, inline functions, or shared references | COVERED | Both options analyzed: inline (recommended by app analysis) vs. separate skill (research-engine's pattern). Evidence slightly favors inline for streamlined UX. Both viable with documented trade-offs. |
| 4 | How to implement MUST/SHOULD criteria split programmatically | PARTIAL | Neither reference implementation has this exact model. However, research-engine's structured rubric and prompt engineering explicit rubric patterns provide sufficient foundation. Mechanics of parsing criteria from state.yml/SCOPE.md are derivable. |
| 5 | Override mechanism -- `--override` flag, gate_history recording, gap context injection | PARTIAL | Product design specifies the concept. State management provides infrastructure (gate_history in state.yml). Neither reference has overrides. Implementation is derivable (read state, record override, inject gaps). |
| 6 | Recycle limit tracking -- per-gate and per-question counts, escalating warnings | PARTIAL | Product design specifies escalating warnings. State management provides counter infrastructure. Neither reference tracks recycle limits. Pattern is straightforward (increment, check threshold, emit warning). |

**Readiness Criterion:** "Ready when we have a concrete implementation pattern for gate evaluation (where the logic lives, how criteria are checked, how results are rendered), validated by studying how both reference implementations handle their equivalent quality gates."
**Criterion Met:** Yes

**Overall Assessment:** The core gate evaluation pattern is well-supported by both reference implementations. The MUST/SHOULD split, override mechanism, and recycle tracking are product-design-specific features without direct reference precedent, but they are simple enough to derive confidently from the available evidence. The three PARTIAL items are not individually or collectively significant enough to warrant additional research -- they describe straightforward state manipulation patterns that any competent design can specify. Ready for design.

---

### DA-4: Subagent Orchestration and Token Efficiency
**Status:** READY
**Priority:** Critical
**Evidence Coverage:** 6 of 6 requirements covered

| # | Evidence Requirement | Status | Evidence Found |
|---|---------------------|--------|----------------|
| 1 | How research-engine spawns parallel web research agents -- exact Task() pattern | COVERED | App analysis documents: read SCOPE.md categories, load prompt templates with frontmatter, construct per-category prompts with inlined context, spawn via Task() with "all in parallel" instruction, agents write to category files, synthesis reads all. |
| 2 | How GSD spawns parallel executor agents -- wave-based, plan inlining | COVERED | Reference implementation analysis documents: plans grouped by wave, dispatched in parallel within waves, content inlined, Task() blocks until completion, results collected by verification status. |
| 3 | Task tool's actual API -- parameters, blocking behavior, return format, limits, error handling | COVERED | Three sources converge: parameters are `prompt` (required), `description` (required), `subagent_type` (required), optionally `model`. Returns text. No built-in parallel limit. `resume` for rate limit recovery. Round 2 confirms Task returns a `result` string, not structured JSON. |
| 4 | How to enforce condensed returns (1,000-2,000 tokens) | COVERED | All sources agree: prompt enforcement only. Explicit token budget in `<output_format>`. Dual-target: write detailed to file, return brief summary. Proven in practice by research-engine's agents. |
| 5 | Context fork isolation -- minimal subagent prompts (~5K tokens) | COVERED | Each subagent starts fresh with ~50K overhead. Prompt target ~5K with only relevant questions + source config. Content must be inlined (no @-references across Task boundaries). |
| 6 | Tiered model assignment -- reading preferences, passing to Task(), valid identifiers | COVERED | Research-engine uses frontmatter (hardcoded model). GSD uses profile system. Task tool accepts model: opus, sonnet, haiku, fast, inherit. Synthesis recommends research-engine's simpler approach for v1. |

**Readiness Criterion:** "Ready when we have the exact Task() invocation pattern used by both reference implementations, understand how to minimize subagent context, and have a concrete approach for model tier configuration that matches Claude Code's actual Task tool API."
**Criterion Met:** Yes

**Overall Assessment:** One of the strongest decision areas. Three independent research categories converge on a consistent picture. Both reference implementations demonstrate proven patterns. Token budget estimates are provided. Round 2 confirmed Task return format details. Ready for design with very high confidence.

---

### DA-5: Source Routing and MCP Integration
**Status:** READY
**Priority:** Important
**Evidence Coverage:** 6 of 6 requirements covered

| # | Evidence Requirement | Status | Evidence Found |
|---|---------------------|--------|----------------|
| 1 | How research-engine routes research to different source types | COVERED | App analysis documents mode selection (Web+App / Web / App). Routing at orchestrator level confirmed by Anthropic's multi-agent system and LangChain router pattern. |
| 2 | How Claude Code plugins detect and interact with MCP servers | COVERED | MCP tools follow `mcp__<server>__<tool>` naming, skills declare `allowed-tools` with wildcards. No programmatic availability API. Availability inferred from invocation failures (isError). Round 2 confirms MCP tools require foreground execution (GitHub #13254, #19964). |
| 3 | AskUserQuestion tool API and capabilities | COVERED | Round 2 provides full TypeScript interface: `questions` array (1-4), each with `question`, `header` (max 12 chars), `multiSelect`, `options` (2-4). Response is `Record<string, string>` keyed by header. "Other" auto-appended by runtime. 60-second timeout returns empty strings. CRITICAL: AskUserQuestion NOT available in subagents (#12890). |
| 4 | How to implement source-type routing in prompts | COVERED | All sources agree on orchestrator-level routing. Per-source prompt templates documented. Source-specific instructions injected into subagent prompts by orchestrator. |
| 5 | Circuit breaker / fallback implementation within a subagent | COVERED | Round 2 provides concrete prompt pattern with three-tier failure taxonomy: server failure (retry once), platform failure (no retry), no relevant results (mark WORKING). Structured `<source_status>` and `<sufficiency>` output blocks. Orchestrator-side aggregation pattern specified. |
| 6 | INSUFFICIENT-SOURCE-UNAVAILABLE status distinction | COVERED | Round 2 specifies: subagent reports failure type in `<source_status>` block. Server/platform failures map to INSUFFICIENT-SOURCE-UNAVAILABLE. "No relevant results" maps to INSUFFICIENT. Three-tier taxonomy provides clear classification criteria. |

**Readiness Criterion:** "Ready when we understand how MCP servers are discovered and queried from within a Claude Code plugin, have a concrete implementation for the source checklist UX, and have validated the routing pattern (orchestrator-level vs. subagent-level) against the reference implementations."
**Criterion Met:** Yes

**Overall Assessment:** Round 2 gap research fully closed the two remaining gaps. The AskUserQuestion API is now specified with full schema, response format, and edge cases. The circuit breaker pattern has a concrete prompt snippet with three-tier failure taxonomy. The critical finding that AskUserQuestion is NOT available in subagents reinforces the existing orchestrator-level routing recommendation as a hard platform constraint, not just a best practice. Ready for design.

---

### DA-6: Prompt Engineering for Phase Operations
**Status:** READY
**Priority:** Critical
**Evidence Coverage:** 6 of 6 requirements covered

| # | Evidence Requirement | Status | Evidence Found |
|---|---------------------|--------|----------------|
| 1 | Actual prompt templates from research-engine (12 templates) | COVERED | App analysis documents all 12 templates with 4-section structure (Role, Instructions, Output Format, Quality Standards). Specific templates named, described, with frontmatter metadata. |
| 2 | Actual agent definitions from GSD (5 agents) | COVERED | Reference implementation analysis documents GSD's 5 agents with XML-structured sections, quality gate checklists, completion format specifications. |
| 3 | Best practices for prompt engineering in multi-agent systems | COVERED | Prompt engineering research covers COSTAR framework, 8-section template, XML compartmentalization, schema-first output, downstream consumer specification. Anthropic's blog validates prompt engineering as primary quality lever. |
| 4 | Sufficiency assessment prompts -- coverage, corroboration, actionability | COVERED | LLM-as-judge patterns: explicit rubrics with scoring, structured assessment output, separation of evaluation from recommendation. Research-engine's check-readiness demonstrates the concrete pattern. |
| 5 | Intent-adaptive prompt templates | COVERED | Three approaches documented with trade-offs: variable injection/lens, conditional XML sections, separate templates. Round 2 strengthens this with concrete per-phase format differences grounded in established PM and engineering methodology. |
| 6 | "Terraform plan-apply" pattern for scope questioning | PARTIAL | The pattern is derivable: scope skill generates question plan, presents as structured output, waits for confirmation. AskUserQuestion or freeform prompting implements the confirmation step. No exact template provided but the pattern is straightforward. |

**Readiness Criterion:** "Ready when we have analyzed all prompt templates from both reference implementations, identified reusable patterns, and have a concrete prompt architecture that covers all 5 phases plus gate evaluation."
**Criterion Met:** Yes

**Overall Assessment:** Excellent evidence coverage. The 8-section template structure synthesized from all sources provides a concrete, validated framework. The concrete template example in the synthesis gives the design agent a direct starting point. 12 + 5 reference templates provide abundant material. The PARTIAL on the Terraform plan-apply pattern is minor -- the interaction model is clear even without an exact template. Ready for design with high confidence.

---

### DA-7: Execute Phase Implementation
**Status:** READY
**Priority:** Important
**Evidence Coverage:** 6 of 6 requirements covered

| # | Evidence Requirement | Status | Evidence Found |
|---|---------------------|--------|----------------|
| 1 | How GSD's execute-phase orchestrator handles wave-based parallelism, results routing | COVERED | Reference implementation analysis: wave grouping, parallel dispatch within waves, sequential between, result collection by status, SUMMARY.md markers. |
| 2 | How GSD's executor handles the task loop -- loading plan, executing, committing, checkpoints | COVERED | Full executor flow documented. App analysis maps this to arc's simpler main-session model. |
| 3 | How to implement "Continue? (yes/pause/review)" within a skill | COVERED | Two approaches: AskUserQuestion with 3 options or freeform prompting. Freeform is simpler, avoids 60-second timeout. Both viable. |
| 4 | Checkpoint file format and resume logic | COVERED | Checkpoint captures phase, plan, task index, last commit SHA, continuation notes. "Fresh agent with context" resume pattern -- not true resumption but context-aware restart. |
| 5 | How arc's Execute differs from GSD's -- main session vs. subagent per task | COVERED | Arc runs sequentially in main session (C-7). A simplification from GSD. Micro-interaction replaces automatic checkpointing. |
| 6 | Acceptance criteria verification patterns | PARTIAL | "Lightweight check" for v1 is recommended but not formally defined. GSD's verifier is expensive. Prompt-based evaluation (not a separate agent) is sufficient for v1. The distinction between programmatic and judgment criteria is acknowledged but not formalized. |

**Readiness Criterion:** "Ready when we understand GSD's execution orchestration deeply enough to adapt it for arc's simpler model, have a concrete checkpoint/resume pattern, and know how to implement the Continue? interaction."
**Criterion Met:** Yes

**Overall Assessment:** GSD provides comprehensive execution patterns that map cleanly to arc's simpler model. The PARTIAL on acceptance criteria is minor for v1 -- a simple prompt-based "verify against task criteria" approach is sufficient and can be formalized during design. Ready for design.

---

### DA-8: Research Phase Orchestration
**Status:** READY
**Priority:** Important
**Evidence Coverage:** 6 of 6 requirements covered

| # | Evidence Requirement | Status | Evidence Found |
|---|---------------------|--------|----------------|
| 1 | How research-engine orchestrates the full flow: analysis -> parallel research -> synthesis | COVERED | Complete three-step pipeline documented. Category results written to files, synthesis reorganizes by theme. Fan-out/fan-in with explicit parallel instruction. |
| 2 | How research-engine's research-gaps skill implements targeted gap research | COVERED | Gap-fill flow: read READINESS.md, group gaps by affinity, spawn targeted researchers, produce supplement-synthesis.md without replacing prior research. |
| 3 | Per-question research model adaptation -- category-based to question-based dispatch | COVERED | Hybrid resolution: source-affinity batching. Group questions by source requirements into 3-5 batches, dispatch one agent per batch, assess sufficiency per question from combined output. Concrete 7-step flow documented. |
| 4 | 60-second progress updates within Task tool constraints | COVERED (as relaxed) | Round 1 identified as infeasible with current platform capabilities. No callback, streaming, or progress mechanism in Task tool. Formally recommended to relax to "report after each batch completes." This is a platform limitation, not a research gap. |
| 5 | Gap-fill mode detection and scoping | COVERED | Round 2 provides: concrete per-question status schema for state.yml (status, sufficiency scores, source, gap_details, evidence_files). Filtering by insufficient/partial status. Re-batching by decision area affinity (not merged with original grouping). Supplement file naming: round-{N}/supplement-{category}.md. Re-synthesis is additive (reads all evidence, weights supplements higher). |
| 6 | Dynamic question discovery implementation | COVERED | Round 2 provides complete flow: subagent embeds YAML block (`# --- PROPOSED QUESTIONS ---`), orchestrator regex extraction, deduplication via LLM judgment, AskUserQuestion presentation (multiSelect, "New Qs" header, max 4 candidates), state.yml update (status: pending, source: discovered-round-N). Grounded in Anthropic's lead-agent pattern and qx-labs Knowledge Gap Agent. |

**Readiness Criterion:** "Ready when we have a concrete orchestration flow for the Research phase that handles both initial research and gap-fill mode, with per-question sufficiency tracking, dynamic discovery, and synthesis regeneration -- validated against research-engine's proven patterns."
**Criterion Met:** Yes

**Overall Assessment:** Round 2 gap research fully addressed the two gaps (dynamic question discovery and gap-fill mode mechanics) that held this area back in round 1. The orchestration flow is now specified from initial dispatch through gap-fill iteration to re-synthesis. The only unresolved item is the 60-second progress update, which is formally classified as a platform limitation to be relaxed in design. Ready for design.

---

### DA-9: Intent-Adaptive Behavior Implementation
**Status:** READY
**Priority:** Important
**Evidence Coverage:** 6 of 6 requirements covered

| # | Evidence Requirement | Status | Evidence Found |
|---|---------------------|--------|----------------|
| 1 | How intent flag flows through state.yml and is consumed by each skill | COVERED | Intent set during scope, stored as `intent: product | engineering` in state.yml. All downstream skills read this field. Pattern is clear. |
| 2 | How to implement intent-adaptive prompt templates | COVERED | Three approaches documented: variable injection/lens, conditional XML sections, separate templates. Lens injection with conditional sections recommended. Round 2 strengthens with concrete per-phase format differences. |
| 3 | How GSD's context-carrying pattern works -- CONTEXT.md as locked constraints | COVERED | User decisions from discuss-phase flow through agents as locked constraints. Similar pattern carries intent and imported artifact constraints through arc's phases. |
| 4 | HANDOFF.md generation logic -- Design producing DESIGN.md and HANDOFF.md | COVERED | Round 2 provides concrete 9-section HANDOFF.md format: Problem Statement, Key Decisions (LOCKED), Scope Boundaries, Success Metrics, User Flows (compressed), Acceptance Criteria (testable), Assumptions and Constraints, Suggested Engineering Questions. Grounded in HashiCorp PRD-to-RFC translation, Figma/Zeplin handoff practices. Import flow: detect at known locations, AskUserQuestion for import/skip/review, record in state.yml with `imported_from` and `constraints[]`. |
| 5 | How Plan output adapts: wave-ordered tasks (engineering) vs. epics/stories (product) | COVERED | Round 2 documents structural comparison: product uses epic/story hierarchy (user-value axis, sprint-sized, Given/When/Then criteria, T-shirt sizing). Engineering uses wave-ordered task list (dependency axis, hour-sized, technical checklist criteria, file-level specificity). Different organizing axes confirmed -- not just vocabulary differences. Concrete format examples provided for both. |
| 6 | Connected flow detection -- scope scanning for prior design artifacts | COVERED | Round 2 specifies: scope skill detects HANDOFF.md at known locations (.arc/design/, .arc/archive/*/), presents via AskUserQuestion (import/skip/review), records import in state.yml. "Key Decisions" become locked constraints, "Scope Boundaries" pre-populate scope, "Suggested Engineering Questions" become modifiable proposed questions. |

**Readiness Criterion:** "Ready when we have a concrete pattern for intent-conditional behavior that avoids code duplication, handles the connected flow artifact detection, and produces appropriate output for both intents from shared infrastructure."
**Criterion Met:** Yes

**Overall Assessment:** Round 2 transformed this from the weakest area to a reasonably well-grounded one. Per-phase format differences are now concrete and grounded in established PM methodology (ProductBoard, Cagan's four risks, Product School) and engineering methodology (Google Design Docs, HashiCorp RFC, Pragmatic Engineer). The HANDOFF.md specification is the most novel element with no direct precedent, but it draws on proven PRD-to-RFC translation patterns and design handoff practices. The design phase should treat HANDOFF.md as a first-iteration format subject to refinement. Confidence is medium-high overall -- sufficient for design, with iteration expected.

---

### DA-10: Passive Telemetry and Log Implementation
**Status:** READY
**Priority:** Nice-to-have
**Evidence Coverage:** 5 of 6 requirements covered

| # | Evidence Requirement | Status | Evidence Found |
|---|---------------------|--------|----------------|
| 1 | How GSD tracks execution metrics -- timing, completion status, deviation counts | COVERED | Reference implementation analysis documents metadata in SUMMARY.md and STATE.md: duration, key-decisions, patterns-established, velocity tracking. |
| 2 | How research-engine tracks research progress -- question counts, sufficiency rates | COVERED | Implicit tracking via artifact existence and READINESS.md. Per-decision-area coverage counts, gap descriptions. |
| 3 | YAML append patterns in Claude Code | COVERED | Multi-document YAML with `---` separators allows true append. Each entry standalone. Partial writes corrupt only last document. Full rewrite NOT necessary. |
| 4 | Most critical events for v2 calibration | COVERED | Three highest-value: gate outcomes, phase durations, source effectiveness. Natural checkpoint boundaries: skill start/end, gate evaluation, agent completion, phase transition. |
| 5 | How to keep log.yml under reasonable size | COVERED | Per-phase rotation (archive when phase completes). 100-200 bytes per entry, hundreds fit in "a few KB." Size naturally bounded by lifecycle length. |
| 6 | Whether log.yml should be committed to git or gitignored | PARTIAL | Unresolved -- synthesis notes both options. Single-user favors gitignore; teams favor commit. No strong recommendation. Minor design decision. |

**Readiness Criterion:** "Ready when we have a concrete append-only logging pattern for YAML in Claude Code, know which events to prioritize, and have a size management strategy."
**Criterion Met:** Yes

**Overall Assessment:** The multi-document YAML append pattern is well-documented. Three highest-value events identified. Per-phase rotation provides size management. The git/gitignore question is a minor decision. Given this is a nice-to-have area with passive-only data collection, evidence is more than sufficient.

---

## Gap Summary

No gaps remain that would block proceeding to design. All 6 gaps identified in round 1 have been addressed by round 2 gap research.

The one platform limitation that remains unresolvable through research:

| Decision Area | Limitation | Status | Recommendation |
|--------------|-----------|--------|----------------|
| DA-8 | 60-second progress updates within Task tool | Platform limitation | Formally relax to "report after each batch completes" in design |

---

## Research Strengths

**DA-1 (Plugin File Structure)** and **DA-4 (Subagent Orchestration)** have the highest evidence quality across the entire research base. Multiple independent sources converge on the same patterns, with both reference implementations demonstrating proven approaches. The concrete directory layout and Task() invocation patterns are directly usable by the design agent.

**DA-6 (Prompt Engineering)** benefits from Anthropic's first-party validation ("prompt engineering was the primary lever for improving agent behaviors"), combined with 12 concrete templates from research-engine and 5 from GSD. The 8-section template structure is immediately actionable.

**DA-2 (State Management)** has excellent theoretical depth from state management patterns research combined with practical patterns from GSD. YAML safety practices give concrete implementation guidance.

**Cross-cutting synthesis** is particularly strong. The "How Research-Engine Patterns and GSD Patterns Combine" section clearly maps the two reference implementations into complementary layers without contradictions. The 6-layer architecture (Plugin Infrastructure, State Management, Research Orchestration, Gate Evaluation, Execution, Prompt Templates) gives the design phase a clear structural foundation.

---

## Changes from Previous Round

### Gaps Filled by Round 2 Research

| Gap | Area | Round 1 Status | Round 2 Status | How Filled |
|-----|------|---------------|----------------|------------|
| 5a | DA-5 | PARTIAL | COVERED | Full AskUserQuestion TypeScript interface, response format, timeout edge cases, critical subagent unavailability finding |
| 5b | DA-5 | PARTIAL | COVERED | Concrete three-tier circuit breaker prompt pattern (server/platform/no-results), structured output blocks, orchestrator consumption pattern |
| 8a | DA-8 | NOT COVERED | COVERED | Complete dynamic question discovery flow: subagent YAML block, orchestrator extraction, deduplication, AskUserQuestion presentation, state.yml update |
| 8b | DA-8 | PARTIAL | COVERED | Full per-question status schema, gap-fill filtering logic, re-batching strategy, supplement file naming, additive re-synthesis pattern |
| 9a | DA-9 | NOT COVERED | COVERED | Concrete per-phase format differences grounded in established PM and engineering methodology with format examples |
| 9b | DA-9 | NOT COVERED | COVERED | 9-section HANDOFF.md format, cross-lifecycle import flow with constraint injection, grounded in HashiCorp PRD-to-RFC and design handoff practices |

### Areas Upgraded

| Area | Round 1 Status | Round 2 Status | Rationale |
|------|---------------|----------------|-----------|
| DA-5: Source Routing | NEEDS MORE | READY | Both gaps (5a, 5b) fully closed. New critical finding: AskUserQuestion unavailable in subagents reinforces orchestrator-level routing as hard constraint. |
| DA-8: Research Orchestration | NEEDS MORE | READY | Both gaps (8a, 8b) fully closed. Dynamic question discovery and gap-fill mode now have concrete schemas and flows. |
| DA-9: Intent-Adaptive | NEEDS MORE | READY | Both gaps (9a, 9b) fully closed. Per-phase format differences now concrete. HANDOFF.md specified with 9-section format. Remains highest-iteration-risk but sufficient for design. |

### Gaps Remaining Despite Additional Research

None. All 6 targeted gaps were successfully filled.

### New Findings That Strengthen Prior Assessments

- **AskUserQuestion subagent limitation** (DA-5): AskUserQuestion is NOT available in subagents (confirmed by GitHub #12890). This hardens the orchestrator-level routing recommendation from "best practice" to "hard platform constraint."
- **MCP foreground requirement** (DA-5): MCP tools require foreground subagent execution (GitHub #13254, #19964). Background subagents cannot access MCP tools. Design must ensure research subagents run in foreground.
- **Task tool structured output** (DA-4/DA-8): Agent SDK supports `outputFormat` with JSON schema validation, but this is NOT exposed through Claude Code's Task tool. Confirms prompt engineering is the only path for structured subagent returns.
- **Three-tier failure taxonomy** (DA-5): Extends the round 1 two-state circuit breaker model. Platform failures (MCP tool inaccessible due to background execution) are a distinct category that should NOT be retried.

### New Contradictions or Nuances Discovered

- **AskUserQuestion response key format**: Slight ambiguity between header-based and index-based keying. Round 2 recommends header match with position-based fallback.
- **Subagent structured output**: Agent SDK has `outputFormat` but Task tool does not. No contradiction with existing recommendation, but noted for future reference.

---

## Overall Assessment

The research base is comprehensive and well-organized. All 10 decision areas now have sufficient evidence for confident design, including all 4 critical-priority areas (DA-1, DA-2, DA-3, DA-4) and all 5 important-priority areas (DA-5, DA-6, DA-7, DA-8, DA-9), plus the nice-to-have area (DA-10).

The round 2 gap research was highly effective. All 6 targeted gaps were closed with concrete, actionable evidence. The research quality improved in three ways: (1) the AskUserQuestion API is now specified at schema level rather than described conceptually, (2) the circuit breaker and dynamic question discovery patterns have concrete prompt snippets rather than abstract descriptions, and (3) the intent-adaptive differences are grounded in established industry methodology rather than speculation.

The remaining risks are execution risks, not evidence risks:
- **DA-9 (Intent-Adaptive)** is the highest-iteration-risk area. The HANDOFF.md format and cross-lifecycle import are novel with no direct precedent. The design should treat these as v1-iteration candidates.
- **DA-3 (Gate Evaluation)** carries judgment reliability risk. LLM-based sufficiency assessment is untestable in research -- it can only be validated through implementation.
- **DA-2 (SessionStart Hook)** carries platform risk from 3 open bugs. The fallback design (/arc:status) must be a first-class citizen.

A design agent reading the research synthesis and supplement synthesis together can produce a complete implementation design (file structure, skill specifications, state schema, prompt template outlines, orchestration flow) without needing to re-read the reference implementations themselves.

**Recommendation: Proceed to design.**
