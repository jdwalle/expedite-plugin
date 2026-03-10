# Research Scope: Expedite Plugin Production Readiness Audit

## Context

Comprehensive audit of the **expedite** Claude Code plugin (formerly "arc") — a 5-phase research-to-implementation lifecycle tool (Scope, Research, Design, Plan, Spike, Execute) with 7 skills, 13 prompt templates, and ~5,500 lines of code. The plugin was built from a detailed PRODUCT-DESIGN.md specification over 13 implementation phases.

The audit compares implementation against spec, evaluates structural/logical correctness, assesses alignment with the "decision-over-task" philosophy, and compares against the research-engine plugin it was inspired by. The goal is a complete assessment of production readiness with actionable recommendations.

**Audit type:** Post-implementation engineering review (v1.0 shipped)
**Reference spec:** `.planning/research/arc-implementation/design/PRODUCT-DESIGN.md`
**Philosophy doc:** Decision-over-task pattern v2 (in ColorSudoku project memory)
**Comparison baseline:** research-engine plugin (`~/.claude/plugins/cache/local/research-engine/0.1.0/`)

## Constraints

Non-negotiable decisions and explicit exclusions. These are NOT researched — they're accepted as given.

- **Plugin is already built (v1.0 shipped):** This is a post-implementation audit, not a design exercise. We assess, not redesign. (Source: project state)
- **PRODUCT-DESIGN.md is the reference spec:** All fidelity comparisons are against this document. (Source: user decision)
- **Decision-over-task pattern is the philosophical foundation:** The pattern document defines expected behavior. (Source: user decision)
- **Research-engine is the comparison baseline:** Pattern adoption and divergence measured against this plugin. (Source: user decision)
- **Every divergence is evaluated on merits:** No divergence is assumed to be good or bad — each is assessed individually. (Source: user decision)
- **Renamed from arc to expedite:** `.expedite/` namespace, `/expedite:*` commands. (Source: project history)

## Decision Areas

### DA-1: Design Fidelity — Spec-vs-Implementation Delta Analysis

**Priority:** Critical
**Depth:** Deep dive
**Design question:** What was specified in PRODUCT-DESIGN.md vs what was actually built, and for each divergence, is it a productive evolution or a regression?

**Evidence needed:**
- Line-by-line comparison of PRODUCT-DESIGN.md's 29 decisions register entries against actual implementation in SKILL.md files, templates, and state schema
- Catalog of every structural element specified but not implemented (hooks/, scripts/, `_recycled` states, Connected Flow import, external verifier agent)
- Catalog of every structural element implemented but not specified (spike skill + G5 gate, codebase-routed questions in scope Step 7, per-phase execution model)
- For each divergence: classification as intentional evolution (with rationale documented in .planning/ milestones) vs silent drift (no documented rationale)

**Suggested research categories:** spec-delta-analysis, implementation-inventory
**Dependencies:** None (foundational DA — informs all others)
**User input:** "Flag and evaluate each divergence — don't assume they're all good"
**Readiness criterion:** Every element in PRODUCT-DESIGN.md sections "Plugin Architecture," "State Management Design," "Skill Specifications," and "Gate Evaluation System" mapped to implementation status (present/absent/modified) with evidence citations.

### DA-2: State Management Correctness

**Priority:** Critical
**Depth:** Deep dive
**Design question:** Is the state management system structurally sound — do phase transitions, override/recycle patterns, crash recovery, and the backup-before-write protocol work correctly across all skills, and does the step-level tracking gap create real risk?

**Evidence needed:**
- Map of every phase transition path actually encoded across all 7 SKILL.md files vs the spec's phase transition diagram
- Analysis of the `_recycled` state elimination: does the `_in_progress` + gate_history override pattern correctly preserve all information the `_recycled` states would have conveyed?
- Count of backup-before-write implementations across all skills — verify every state.yml write follows the read/backup/modify/write protocol
- Assessment of the step-level tracking gap (memory flag): what happens when scope is interrupted at Step 5 vs Step 8? Can the skill reliably resume?
- Analysis of state.yml template vs spec schema — field presence, naming, comments, default values
- `research_round` vs `research_rounds` naming (spec uses plural, template uses singular)

**Suggested research categories:** state-management-audit, crash-recovery-analysis
**Dependencies:** DA-1
**User input:** Extra attention requested on state management
**Readiness criterion:** Every phase transition in the codebase traced to a spec-defined or intentionally-added path; every state.yml write verified to use backup-before-write; step-level tracking gap assessed for severity (blocking vs tolerable).

### DA-3: Research Orchestration Quality

**Priority:** Critical
**Depth:** Deep dive
**Design question:** Does the research orchestration pipeline (batching, dispatch, collection, sufficiency assessment, synthesis, gap-fill) faithfully implement the spec's design, and are the prompt templates sufficient to produce reliable agent output?

**Evidence needed:**
- Source-affinity batching algorithm comparison: spec algorithm (8 steps) vs SKILL.md implementation
- Sufficiency evaluator architecture: spec says inline (Decision 10, ~80K token savings), implementation dispatches as Task() subagent. Evaluate whether this divergence is productive
- Synthesis agent dispatch: verify template placeholder coverage, model tier (opus per spec), output targeting
- Dynamic question discovery: spec says AskUserQuestion (multiSelect), implementation uses freeform prompt. Evaluate
- Gap-fill dispatch: verify ref-gapfill-dispatch.md implementation against spec's gap-fill mode description
- Evidence file naming convention: spec uses `evidence-batch-{N}.md`, implementation may differ
- Agent concurrency: verify 3-agent max enforcement pattern
- Circuit breaker implementation in researcher templates vs spec's three-tier failure handling

**Suggested research categories:** research-pipeline-audit, agent-orchestration-analysis
**Dependencies:** DA-1, DA-6
**User input:** Extra attention requested on research orchestration
**Readiness criterion:** Every step in research SKILL.md verified against spec; sufficiency evaluator architecture divergence classified as productive or regressive; all research templates verified to contain 8-section structure, correct frontmatter, and complete placeholder sets.

### DA-4: Spike/Execute Architecture Assessment

**Priority:** Critical
**Depth:** Deep dive
**Design question:** Was the Plan-to-Spike-to-Execute architecture (the major design divergence from spec's Plan-to-Execute) a good addition, and is the per-phase execution model structurally sound?

**Evidence needed:**
- Spec's Plan-to-Execute flow vs implementation's Plan-to-Spike-to-Execute flow: structural comparison
- The spike skill's tactical decision classification system (resolved vs needs-spike): does it add genuine decision-making value or mechanical busywork?
- G5 gate (not in spec): does it add quality assurance or bureaucratic overhead?
- Per-phase execution model (not in spec): evaluate whether `execute <phase>` improves or complicates UX
- Spiked vs unspiked execution paths: is the dual-path logic clean?
- Spike nudge pattern: evaluate whether the non-blocking suggestion is appropriately calibrated
- Execute's per-task verification via prompt-task-verifier.md: compare against spec's design traceability requirement
- Contract chain extension: does the TD→DA tracing through spike add value?

**Suggested research categories:** spike-architecture-analysis, execution-model-audit
**Dependencies:** DA-1, DA-5
**User input:** Extra attention requested on spike/execute flow; "The plan→spike→execute architecture was a major design divergence"
**Readiness criterion:** Clear verdict on whether spike/execute architecture is a productive evolution with specific reasoning; per-phase execution model assessed for correctness and UX impact; G5 gate evaluated against gate system design principles.

### DA-5: Decision-Over-Task Philosophy Alignment

**Priority:** Critical
**Depth:** Deep dive
**Design question:** Does the plugin actually enforce the decision-over-task philosophy during user interaction — surfacing decisions for the user to make rather than automating steps — and is the contract chain unbroken from scope through execution?

**Evidence needed:**
- Behavioral analysis of each skill's interaction points: does the user face decisions (choose between alternatives) or confirmations (approve/reject pre-made choices)?
- Scope skill: does adaptive refinement genuinely surface decisions or just collect information? Are AskUserQuestion calls presenting real alternatives?
- Research skill: does sufficiency assessment surface evidence quality decisions to the user, or auto-classify and present results?
- Design skill: does the revision cycle present design alternatives, or just "approve what I generated"?
- Plan skill: does tactical decision classification surface implementation decisions, or is it mechanical?
- Spike skill: is the "clear-cut vs genuinely ambiguous" judgment calibrated to surface real decisions?
- Execute skill: does the micro-interaction (yes/pause/review) represent meaningful decision points?
- Contract chain integrity: trace from a hypothetical DA through all phases — does every link hold?
- Gate system: do gates enforce decision quality or just structural completeness?
- Override mechanism: does it preserve user agency or undermine the philosophy?

**Suggested research categories:** philosophy-alignment-analysis, interaction-point-audit, contract-chain-tracing
**Dependencies:** DA-1, DA-4
**User input:** "Deep — behavioral: Does the plugin actually surface decisions over steps during user interaction? Does it prevent the task-oriented anti-pattern?"
**Readiness criterion:** Every user-facing interaction point in all 7 skills classified as decision-surfacing or confirmation-seeking; contract chain traced through at least one complete hypothetical lifecycle; verdict on whether the plugin enforces or merely suggests the philosophy.

### DA-6: Prompt Template Architecture Quality

**Priority:** Important
**Depth:** Standard
**Design question:** Are the 13 prompt templates and reference files well-structured, internally consistent, and sufficient to guide agents and inline operations effectively?

**Evidence needed:**
- Template count verification: spec lists 9 templates, implementation has 13 files. Identify the 4 additions
- 8-section structure compliance for each template
- Frontmatter correctness: subagent_type and model assignments match spec's model tier table
- Placeholder completeness: for each template with `{{placeholders}}`, verify dispatching SKILL.md fills all
- Intent lens implementation: verify conditional blocks present and meaningful
- Condensed return format: verify subagent templates specify ~500 token return format
- Token budget alignment against spec targets

**Suggested research categories:** template-architecture-audit
**Dependencies:** DA-3, DA-4
**User input:** No specific concerns
**Readiness criterion:** All 13 templates verified against 8-section structure; all placeholders mapped to filling code; model/subagent_type assignments verified against spec.

### DA-7: Research-Engine Comparison

**Priority:** Important
**Depth:** Standard
**Design question:** Which patterns from the research-engine reference implementation were adopted, adapted, or diverged from — and are the divergences justified?

**Evidence needed:**
- Pattern adoption catalog: file-based subagent output, per-source templates, categorical sufficiency model, lens injection, condensed returns, model tier assignments, Task() invocation pattern
- Pattern adaptation catalog: source-affinity batching, gap-fill re-batching, dynamic question discovery
- Pattern divergence catalog: sufficiency evaluator inline vs subagent, multi-step SKILL.md orchestration, gate system design
- Novel additions not from research-engine: spike skill, tactical decision classification, per-phase execution, contract chain enforcement
- Plugin architecture comparison: manifest structure, skill auto-discovery, hook system, dynamic context injection
- Comparative assessment: where expedite improves vs regresses

**Suggested research categories:** research-engine-comparison, pattern-analysis
**Dependencies:** DA-1, DA-3
**User input:** "Detailed comparison — map each pattern to its expedite equivalent and evaluate"
**Readiness criterion:** At least 10 research-engine patterns identified and classified; novel additions assessed for gap-filling value; at least 2 areas where research-engine patterns could improve expedite identified (if any).

### DA-8: Error Handling and Resilience

**Priority:** Important
**Depth:** Standard
**Design question:** Does the plugin handle failure modes gracefully — agent failures, file system errors, state corruption, and mid-session interruptions?

**Evidence needed:**
- Error handling table comparison: spec defines tables per skill; verify implementation covers each mode
- Agent failure recovery in research skill: single agent, all agents, synthesis, sufficiency evaluator
- Template resolution failures: what happens when Glob fails to find a prompt template?
- State corruption recovery: malformed state.yml, state.yml.bak recovery, status skill reconstruction
- Mid-session interruption recovery: verify each skill's resume logic
- Checkpoint reconstruction fallback in execute skill
- Log.yml corruption: no recovery mechanism visible — assess risk
- File write failures: verify retry-once-then-display pattern

**Suggested research categories:** error-handling-audit, resilience-analysis
**Dependencies:** DA-2, DA-3
**User input:** Extra attention requested on state management (covers crash recovery)
**Readiness criterion:** Every error handling scenario from spec verified as implemented or documented as missing; at least 3 edge cases not in spec identified; resume logic verified for all 5 content skills.

### DA-9: Structural Correctness — Plugin Architecture

**Priority:** Important
**Depth:** Standard
**Design question:** Is the plugin structurally correct — manifest, skill organization, namespace, and file layout conform to conventions and spec?

**Evidence needed:**
- Plugin manifest comparison: spec (`"arc"`, `"1.0.0"`, `"arc-contributors"`) vs implementation (`"expedite"`, `"0.1.0"`, author object)
- Missing structural elements: `hooks/` and `scripts/` directories absent — confirm deliberate deferral
- Namespace migration: verify no stale `/arc:` references in any SKILL.md or template
- Skill count: spec 6 vs implementation 7 (spike added) — verify clean integration
- Directory structure consistency: `skills/{name}/SKILL.md` and `references/` pattern
- SKILL.md frontmatter: all 7 skills have correct fields
- Dynamic context injection: all 7 SKILL.md files include `!cat .expedite/state.yml`
- Template directory: all 3 template files present

**Suggested research categories:** structural-audit, namespace-verification
**Dependencies:** None
**User input:** No specific concerns
**Readiness criterion:** Every structural element from spec verified; namespace migration verified complete; all 7 skills verified for frontmatter correctness.

### DA-10: Production Readiness — Missing Features and Rough Edges

**Priority:** Important
**Depth:** Standard
**Design question:** What features, polish items, or structural issues would block or impair real-world use, and what is the gap between v0.1.0 and v1.0.0?

**Evidence needed:**
- Version number discrepancy: plugin.json says 0.1.0, project identifies as v1.0 — labeling oversight or signal?
- Deferred features from spec: which are v1.0 requirements vs genuine v1.1 items? (extended thinking, configurable model profiles, dedicated verifier agent)
- SessionStart hook absence: impact on UX with two-layer fallback instead of three
- Connected Flow import: deferred to v2 — does this block any promised v1 functionality?
- HANDOFF.md generation: verify implementation against spec's 9-section format
- Source editing stub in scope: "will be available in a future update" — impact assessment
- Task population timing: plan says "Do NOT populate tasks array", execute populates — verify handoff
- Log.yml size management: verify 50KB warning check in status skill
- `.DS_Store` files in git status: signals .gitignore gaps

**Suggested research categories:** production-readiness-audit, deferred-feature-analysis
**Dependencies:** DA-1, DA-8, DA-9
**User input:** No specific concerns beyond wanting overall readiness assessment
**Readiness criterion:** Comprehensive list of production blockers vs cosmetic issues vs v1.1 items; clear recommendation on v1.0.0 label; every deferred feature classified by user impact (high/medium/low).

## Research Category Mapping

| Category | Slug | Decision Areas Served | Priority |
|----------|------|----------------------|----------|
| Spec Delta Analysis | spec-delta-analysis | DA-1 | Critical |
| Implementation Inventory | implementation-inventory | DA-1 | Critical |
| State Management Audit | state-management-audit | DA-2 | Critical |
| Crash Recovery Analysis | crash-recovery-analysis | DA-2, DA-8 | Critical |
| Research Pipeline Audit | research-pipeline-audit | DA-3 | Critical |
| Agent Orchestration Analysis | agent-orchestration-analysis | DA-3, DA-8 | Critical |
| Spike Architecture Analysis | spike-architecture-analysis | DA-4 | Critical |
| Execution Model Audit | execution-model-audit | DA-4 | Critical |
| Philosophy Alignment Analysis | philosophy-alignment-analysis | DA-5 | Critical |
| Interaction Point Audit | interaction-point-audit | DA-5 | Critical |
| Contract Chain Tracing | contract-chain-tracing | DA-5 | Critical |
| Template Architecture Audit | template-architecture-audit | DA-6 | Important |
| Research-Engine Comparison | research-engine-comparison | DA-7 | Important |
| Pattern Analysis | pattern-analysis | DA-7 | Important |
| Error Handling Audit | error-handling-audit | DA-8 | Important |
| Resilience Analysis | resilience-analysis | DA-8 | Important |
| Structural Audit | structural-audit | DA-9 | Important |
| Namespace Verification | namespace-verification | DA-9 | Important |
| Production Readiness Audit | production-readiness-audit | DA-10 | Important |
| Deferred Feature Analysis | deferred-feature-analysis | DA-10 | Important |

## Success Criteria

Research is complete when:

1. **Every element in PRODUCT-DESIGN.md** (29 decisions, 6 skill specs, 4 gate tables, state schema, template inventory, subagent model) is mapped to implementation status with evidence
2. **Every design divergence** is classified as productive evolution or regression with specific reasoning
3. **The decision-over-task contract chain** is traced end-to-end through at least one hypothetical lifecycle
4. **Every user-facing interaction point** is classified as decision-surfacing or confirmation-seeking
5. **At least 10 research-engine patterns** are identified and compared
6. **Every error handling scenario** from the spec is verified as implemented or documented as missing
7. **A clear verdict** is produced on whether the plugin warrants a v1.0.0 label
8. **Actionable recommendations** are provided (what to fix, what to accept, what to defer)
