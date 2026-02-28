# Feature Map: Expedite Plugin

**Date:** 2026-02-27
**Dimension:** Features
**Consumer:** Requirements definition (next milestone)
**Sources:** PRODUCT-DESIGN.md, research-synthesis.md, CONFIDENCE-AUDIT.md, READINESS.md, PROJECT.md

---

## Feature Categories

Features are organized into three categories:
- **Table stakes** -- Must have or the plugin does not work. These are foundational capabilities proven by both reference implementations (research-engine and GSD).
- **Differentiators** -- Competitive advantage or novel value. These go beyond what either reference implementation delivers individually.
- **Anti-features** -- Things to deliberately NOT build. Explicit boundaries to prevent scope creep.

---

## Table Stakes Features

These are features without which Expedite cannot function as a Claude Code workflow plugin. Both reference implementations (research-engine, GSD) demonstrate these patterns. Omitting any of them would make the plugin non-viable.

### TS-1: Plugin File Structure and Auto-Discovery

**What it does:** Plugin ships as a directory with `plugin.json`, `skills/{name}/SKILL.md`, `references/` subdirectories, and `hooks/hooks.json`. Claude Code auto-discovers skills from the directory structure.

**Reference precedent:**
- Research-engine: Exact pattern -- `.claude-plugin/plugin.json` (name, version, description, author), skills auto-discovered from `skills/{phase-name}/SKILL.md`, `references/` per skill.
- GSD: Similar directory-based structure with skill orchestration files.

**Complexity:** Low. Well-understood, ROCK SOLID confidence. Copy the pattern.

**Dependencies:** None. This is the foundation everything else sits on.

---

### TS-2: SKILL.md Orchestrator Pattern

**What it does:** Each skill has a SKILL.md file that acts as the orchestrator -- it contains the system prompt, frontmatter (name, description, allowed-tools, argument-hint), and step-by-step instructions that Claude follows to execute the skill.

**Reference precedent:**
- Research-engine: 5 skills, each with SKILL.md orchestrators. The research SKILL.md contains multi-step orchestration instructions.
- GSD: Similar orchestrator-level SKILL.md files that coordinate agent behavior.

**Complexity:** Medium. The pattern is proven, but Expedite's research SKILL.md has an 11-step orchestration flow -- the highest-risk component in the entire design. No reference validates a single SKILL.md at that complexity level. If Claude cannot reliably follow it, the backup plan is splitting into sub-skills.

**Dependencies:** TS-1 (plugin structure)

---

### TS-3: State Persistence (state.yml)

**What it does:** YAML-based state file tracks lifecycle position (phase, questions, gate history, task list). Complete-file rewrite on every update with backup-before-write (`state.yml.bak`). Flat structure (max 2 nesting levels) for LLM parseability.

**Reference precedent:**
- Research-engine: YAML state management with complete-file rewrites.
- GSD: YAML state files with similar rewrite patterns.
- State management patterns research explicitly recommends max 2 nesting levels.

**Complexity:** Low. STRONG evidence, well-understood pattern.

**Dependencies:** TS-1 (plugin structure)

---

### TS-4: Context Reconstruction (Three-Layer Fallback)

**What it does:** After `/clear` or session loss, the plugin reconstructs context through three layers:
1. **SessionStart hook** -- `hooks.json` triggers `session-start.sh` to inject a 3-5 line summary into the session.
2. **Dynamic `!cat` injection** -- Every SKILL.md includes `!cat .arc/state.yml` which reads state when the skill is invoked.
3. **Manual `/expedite:status`** -- Developer explicitly requests context via the status skill.

**Reference precedent:**
- Research-engine: Uses SessionStart hook for context injection.
- GSD: Uses similar hook-based and file-based context recovery mechanisms.

**Complexity:** Medium. The SessionStart hook has 3 open bugs (#16538, #13650, #11509). The three-layer fallback is the mitigation strategy. Layer 2 (`!cat` injection) is zero-cost defense-in-depth.

**Dependencies:** TS-1, TS-3 (state must exist to reconstruct it)

---

### TS-5: Skill Namespace and Invocation

**What it does:** Six skills under `/expedite:` namespace: scope, research, design, plan, execute, status. Trigger phrases in SKILL.md description enable auto-invocation (e.g., typing "research the questions" triggers `/expedite:research`).

**Reference precedent:**
- Research-engine: 5-skill namespace pattern (Expedite extends by 1 with status).
- GSD: Similar namespace-based skill invocation.

**Complexity:** Low. HIGH confidence. Standard plugin convention.

**Dependencies:** TS-1, TS-2

---

### TS-6: Subagent Orchestration via Task()

**What it does:** Research phase dispatches parallel subagents using `Task()` API. Each subagent gets a constructed prompt (template + dynamic context), writes detailed findings to a file, and returns a condensed summary (max 500 tokens).

**Reference precedent:**
- Research-engine: Per-source researcher subagents with file-based output and condensed returns. This is the direct ancestor of Expedite's research orchestration.
- GSD: Subagent dispatch patterns with Task() API usage.

**Complexity:** Medium. The `Task()` API is STRONG evidence. The constraint that subagents cannot spawn sub-subagents is well-understood. MCP tools require `subagent_type: "general-purpose"` (hard platform constraint).

**Dependencies:** TS-2 (SKILL.md orchestrator dispatches agents), TS-3 (state tracks questions and results)

---

### TS-7: Prompt Template System (8-Section XML)

**What it does:** Every prompt template follows an 8-section XML structure: `<role>`, `<context>`, `<intent_lens>`, `<downstream_consumer>`, `<instructions>`, `<output_format>`, `<quality_gate>`, `<input_data>`. Templates live in `references/` subdirectories per skill.

**Reference precedent:**
- Research-engine: Per-source prompt templates with structured sections and frontmatter (subagent_type, model). The `<intent_lens>` conditional pattern is proven here.
- GSD: Structured prompt templates with XML-tagged sections.

**Complexity:** Low. STRONG convergent evidence from all sources.

**Dependencies:** TS-1 (directory structure), TS-6 (templates used as subagent prompts)

---

### TS-8: Phase Transition Model

**What it does:** Five sequential phases (Scope, Research, Design, Plan, Execute) with granular sub-states (`scope_in_progress`, `scope_complete`, `research_recycled`, etc.). Forward-only transitions. `_complete` suffix proves the gate passed. Crash recovery is unambiguous from the phase name alone.

**Reference precedent:**
- Research-engine: Phase-based workflow with transitions.
- GSD: Wave-based execution with clear phase boundaries.

**Complexity:** Low. HIGH confidence. Granular naming is a consensus improvement from all three design proposals.

**Dependencies:** TS-3 (state tracks current phase)

---

### TS-9: File-Based Artifact Pipeline

**What it does:** Each phase produces Markdown artifacts in `.expedite/` subdirectories: `scope/SCOPE.md`, `research/SYNTHESIS.md`, `design/DESIGN.md`, `plan/PLAN.md`, `execute/PROGRESS.md`. Artifacts are human-readable, git-friendly, and serve as both the record and the input for the next phase.

**Reference precedent:**
- Research-engine: File-based evidence output per batch, synthesis documents.
- GSD: Markdown artifacts for planning and execution tracking.

**Complexity:** Low. STRONG evidence. Natural for file-based workflows.

**Dependencies:** TS-1 (directory structure), TS-3 (state references artifact paths)

---

### TS-10: Error Recovery Patterns

**What it does:** Every skill has defined error handling: file write failures get one retry, missing prerequisite artifacts get informative messages, session interrupts resume from checkpoints, corrupted state reconstructs from artifact existence.

**Reference precedent:**
- Research-engine: Error recovery for agent failures and source unavailability.
- GSD: Checkpoint-based resume, progress tracking.

**Complexity:** Low per pattern, Medium in aggregate (every skill needs its own error table).

**Dependencies:** TS-3, TS-4, TS-9

---

## Differentiators

These features go beyond what either reference implementation delivers individually. They represent novel value or significant adaptation of proven patterns into new territory.

### D-1: Quality Gates (G1-G4) with MUST/SHOULD Criteria

**What it does:** Inline gate evaluation at each phase transition. Each gate has a table of MUST criteria (all must pass for Go) and SHOULD criteria (failures produce advisory, not block). Four outcomes: Go, Go-with-advisory, Recycle, Override. Recycle escalation (1st informational, 2nd suggest adjustment, 3rd recommend override). Override records severity and injects gap context downstream.

**Reference precedent:**
- Research-engine: Has quality evaluation for sufficiency, but not the full MUST/SHOULD gate model with escalating recycles and override tracking.
- GSD: No equivalent structured gate system.
- This is a significant extension of both references.

**Complexity:** Medium. The MUST/SHOULD split is MODERATE evidence (from product design constraints). Go-with-advisory is a design refinement (R2 proposal). Override tracking and gap injection downstream is novel composition. Gates G1 and G4 are structural (deterministic). Gates G2 and G3 require LLM judgment.

**Dependencies:** TS-2 (inline in SKILL.md), TS-3 (gate_history in state.yml), TS-8 (phase transitions gated)

---

### D-2: Categorical Sufficiency Model (COVERED / PARTIAL / NOT COVERED)

**What it does:** Per-question sufficiency assessment across three qualitative dimensions (Coverage, Corroboration, Actionability), each rated Strong/Adequate/Weak/None. The dimensional ratings map to a categorical outcome: COVERED, PARTIAL, NOT COVERED, or UNAVAILABLE-SOURCE. No numeric scores -- categorical judgments are more stable in LLM evaluation.

**Reference precedent:**
- Research-engine: This is the direct ancestor. Research-engine uses the categorical sufficiency pattern in production. Expedite adapts it with the three-dimensional rubric.
- GSD: No sufficiency model.

**Complexity:** Medium. The categorical model is STRONG evidence (proven by research-engine). The three-dimensional rubric (Coverage/Corroboration/Actionability) is an adaptation that needs validation. The gate criteria ("majority of questions COVERED") are simpler and more reliable than numeric thresholds.

**Dependencies:** D-1 (sufficiency feeds G2 gate), TS-6 (evaluator runs inline after subagent results)

---

### D-3: Parallel Research with Source-Affinity Batching

**What it does:** Questions are grouped by primary source type (web, codebase, MCP) into 3-5 batches. Up to 3 agents dispatch in parallel. Source-affinity means each batch uses the right per-source template and tools. Mixed-source questions go to their primary batch with instructions to check secondary sources.

**Reference precedent:**
- Research-engine: Per-source researcher templates and parallel dispatch. The source-affinity grouping is adapted from this.
- GSD: Has subagent parallelism but not source-affinity batching.
- The batching algorithm (merge small groups, split large groups by priority) is a novel adaptation.

**Complexity:** Medium-High. MODERATE evidence for the batching algorithm. The algorithm itself (7-step grouping) needs testing for batch quality. Max 3 concurrent agents is conservative (Anthropic recommends 3-5). Sequential fallback if parallel dispatch fails.

**Dependencies:** TS-6 (Task() dispatch), TS-7 (per-source templates), D-7 (source routing)

---

### D-4: Dynamic Question Discovery

**What it does:** Research subagents can propose new questions they encounter during evidence gathering. After all agents return, the orchestrator scans evidence files for `# --- PROPOSED QUESTIONS ---` YAML blocks, deduplicates via LLM judgment, and presents max 4 to the user for approval. Approved questions enter state with `source: "discovered-round-{N}"`.

**Reference precedent:**
- Research-engine: No dynamic question discovery (questions are static).
- GSD: No equivalent.
- This is a novel feature unique to Expedite.

**Complexity:** Medium. MODERATE evidence from supplement synthesis. The extraction-via-regex and deduplication-via-LLM pipeline needs testing for reliability.

**Dependencies:** TS-6 (subagents produce proposals), D-2 (new questions need sufficiency assessment), TS-3 (state tracks question source)

---

### D-5: Dual Intent Adaptation (Product / Engineering)

**What it does:** Intent (product or engineering) declared during scope shapes every subsequent phase. Product intent produces PRD-style design, epics/stories plans, and HANDOFF.md. Engineering intent produces RFC-style design, wave-ordered tasks, and technical checklists. Intent flows through templates via `<intent_lens>` conditional sections and conditional output formats.

**Reference precedent:**
- Research-engine: Uses `<intent_lens>` for conditional template sections (proven pattern for the injection mechanism).
- GSD: No dual-intent support.
- The full per-phase intent adaptation across 5 phases is novel to Expedite.

**Complexity:** High. The intent injection mechanism is STRONG (from research-engine). But the per-phase content differences (what a PRD vs RFC looks like, epics vs waves) are WEAK to MODERATE evidence -- grounded in industry conventions (HashiCorp PRD-to-RFC, Cagan's 4 risks) but not validated in an LLM workflow plugin context.

**Dependencies:** TS-7 (templates carry intent lens), TS-3 (state tracks intent), D-1 (gates have intent-specific criteria)

---

### D-6: HANDOFF.md for Product-to-Engineering Flow

**What it does:** Product-intent design phase generates a 9-section HANDOFF.md that translates product decisions into engineering-consumable constraints. An engineering lifecycle can import HANDOFF.md to pre-populate scope, lock key decisions as constraints, and seed the question plan.

**Reference precedent:**
- Research-engine: No handoff mechanism.
- GSD: No cross-lifecycle artifact flow.
- Novel feature. Sections 1-8 are MODERATE evidence (HashiCorp PRD-to-RFC). Section 9 (Priority Ranking for Trade-offs) is WEAK evidence (design addition).

**Complexity:** High. The format is novel and needs real-world validation. Cross-lifecycle import has LOW confidence -- it requires detecting prior artifacts, offering import, and locking constraints (LLM enforcement is unreliable). PROJECT.md notes this is deferred to v2.

**Dependencies:** D-5 (product intent generates HANDOFF.md), TS-9 (artifact pipeline)

**Note:** Cross-lifecycle import and locked constraints are deferred to v2 per PROJECT.md. HANDOFF.md generation itself remains in v1 scope.

---

### D-7: Source Routing with Circuit Breaker

**What it does:** `sources.yml` configures available data sources (web, codebase, MCP servers). Source taxonomy (builtin vs MCP) determines availability. Each researcher subagent includes a three-tier circuit breaker: retry once on server failure, never retry platform failures, report all source statuses. The orchestrator classifies failures as UNAVAILABLE-SOURCE vs NOT COVERED.

**Reference precedent:**
- Research-engine: Per-source researcher templates with source-specific tool sets.
- GSD: No source routing or circuit breaker.
- The circuit breaker pattern and UNAVAILABLE-SOURCE classification are Expedite adaptations.

**Complexity:** Medium. Per-source templates are STRONG (from research-engine). Circuit breaker is MODERATE. MCP availability detection is optimistic-invocation only (no API exists to check availability).

**Dependencies:** TS-6 (subagents use source tools), TS-7 (per-source templates)

---

### D-8: Gap-Fill Research Rounds

**What it does:** When G2 gate returns Recycle, `/expedite:research` re-enters in gap-fill mode: filters to PARTIAL/NOT COVERED questions, re-batches by decision area (not original source affinity), spawns targeted agents with gap-specific context, produces `round-{N}/supplement-*.md`, and generates an additive supplement-synthesis. The gate is then re-evaluated.

**Reference precedent:**
- Research-engine: Has gap-fill research with supplement documents and additive synthesis. Expedite adapts the pattern.
- GSD: No gap-fill mechanism.

**Complexity:** Medium. MODERATE evidence from research-engine adaptation. Re-batching by decision area (instead of source affinity) is a novel optimization.

**Dependencies:** D-1 (Recycle gate outcome triggers gap-fill), D-2 (sufficiency identifies gaps), D-3 (batching algorithm adapts for gap-fill)

---

### D-9: Design Revision Cycle

**What it does:** After design generation, the developer can request up to 2 rounds of changes before gate evaluation. Freeform feedback is accepted, DESIGN.md is revised in-session. After 2 rounds, proceeds to gate automatically. Reduces need for G3 Recycle.

**Reference precedent:**
- Research-engine: No design revision cycle.
- GSD: No equivalent.
- Novel feature (R2 proposal). No reference precedent but sound developer experience practice.

**Complexity:** Low-Medium. MODERATE evidence. The interaction pattern is straightforward (freeform prompt, revise file, re-prompt). The max-2-rounds limit prevents infinite loops.

**Dependencies:** D-1 (revision cycle precedes gate evaluation), TS-9 (DESIGN.md artifact)

---

### D-10: Execute Phase with Wave-Based Checkpointing

**What it does:** Tasks execute sequentially in wave order. Single `checkpoint.yml` tracks execution position. `PROGRESS.md` uses append-only `cat >>` pattern. Micro-interaction between tasks: "yes / pause / review". Pause writes checkpoint for later resume via `/expedite:execute`. Between-wave prompts for wave transitions.

**Reference precedent:**
- GSD: Wave-based execution ordering, checkpoint-based resume. Expedite adapts the pattern.
- Research-engine: No execution phase.

**Complexity:** Medium. Wave-based execution is STRONG (GSD proven). Single checkpoint.yml is MODERATE (simpler than directory scan). Acceptance criteria verification is WEAK (specification is under-defined -- "lightweight prompt-based check").

**Dependencies:** TS-3 (state tracks tasks and current_task), TS-9 (PROGRESS.md artifact)

---

### D-11: Passive Telemetry (log.yml)

**What it does:** Multi-document YAML log, append-only via `cat >>` with explicit "do NOT rewrite" instruction. Tracks phase transitions, gate outcomes, agent completions, source failures, overrides. Persists across lifecycles (not archived) for future v2 calibration analysis. Gitignored per user decision D5.

**Reference precedent:**
- Research-engine: No structured telemetry.
- GSD: No structured telemetry log.
- Novel feature for the plugin domain.

**Complexity:** Low. The append pattern is STRONG (mitigates LLM rewrite risk). Individual events are ~100-200 bytes. Size manageable over 100+ lifecycles. The value is latent -- data collection for v2 calibration.

**Dependencies:** TS-1 (file in `.expedite/`), TS-8 (events correlate to phase transitions)

---

### D-12: Scope Phase with Interactive Question Plan

**What it does:** Developer answers 5-8 interactive questions. Intent (product/engineering) is detected. A structured question plan with priorities (P0/P1/P2), decision areas, and source hints is generated and presented for review before any research tokens are spent. The developer sees exactly what will be researched and can modify the plan. Source configuration (confirm defaults or edit) happens here.

**Reference precedent:**
- Research-engine: Has scope/question definition but not the interactive "Terraform plan-apply" preview moment.
- GSD: Has interactive scoping but not question-plan preview.
- The preview-before-commit pattern is an Expedite innovation.

**Complexity:** Medium. Interactive questioning is straightforward. The question plan preview is novel but low-risk (it is just a display step). Uses freeform prompt (not AskUserQuestion) to avoid 60-second timeout.

**Dependencies:** TS-2 (SKILL.md orchestration), TS-3 (state stores questions), D-5 (intent detection)

---

## Anti-Features

These are things Expedite deliberately does NOT build. Each exclusion has a rationale. Including them would add complexity without proven value or would conflict with design constraints.

### AF-1: Extended Thinking for Gate Evaluation

**Why not:** The `ultrathink` directive enables extended thinking for the entire skill execution, not just the gate section. Since gates are inline, trivial operations would also use extended thinking. No evidence that extended thinking improves rubric-based evaluation specifically. v1.1 candidate if gate evaluations prove unreliable. One-line change to test.

---

### AF-2: Configurable Model Profiles

**Why not:** Hardcoded model tiers in prompt frontmatter (sonnet for researchers, opus for synthesizer, session model for everything else). Research-engine uses this exact pattern. Zero configuration. No user demand signal for model configurability. v1.1 candidate if users request it.

---

### AF-3: Numeric Sufficiency Scoring

**Why not:** Categorical model (COVERED/PARTIAL/NOT COVERED) is proven by research-engine. LLMs produce more stable categorical judgments than numeric scores (0.0-1.0). Numeric scoring introduces calibration dependency and inter-run variance. v1.1 candidate if categorical proves too coarse after 10+ lifecycles.

---

### AF-4: Multi-Agent Design Synthesis

**Why not:** Constraint C-8 specifies single design agent for v1. Design runs in main session where the developer can interact, revise, and control the model. Multi-agent design with lens-based variation is architecturally possible but unproven and adds coordination complexity.

---

### AF-5: Bundled MCP Servers

**Why not:** Constraint C-9: reference configs only. Expedite ships `sources.yml` with setup instructions for MCP servers (GitHub, Confluence, etc.). Users configure their own servers in `.mcp.json`. Bundling servers adds maintenance burden, version conflicts, and security concerns.

---

### AF-6: Custom Gate Criteria

**Why not:** Gate criteria are defined in the design specification, not configurable by the developer. Configuration adds surface area that must be tested and documented. The MUST/SHOULD criteria are calibrated by the design team. v2 candidate if developers need project-specific gates.

---

### AF-7: Visual UI or Dashboard

**Why not:** Expedite is CLI-only. `/expedite:status` is the status display. The target user is a developer in Claude Code's terminal environment. A visual dashboard would require a separate technology stack and delivery mechanism with no clear value over the status skill.

---

### AF-8: Automatic Source Discovery

**Why not:** Sources are configured in `sources.yml`. No runtime scanning for available MCP servers. No programmatic API exists to check MCP server availability (hard platform limitation). Optimistic invocation with circuit breaker is the fallback.

---

### AF-9: Self-Improvement from Telemetry (v1)

**Why not:** Passive collection only. Calibration (adjusting gate thresholds, model assignments, batching strategies from log data) requires enough data to be meaningful. v2 feature after 10+ lifecycles produce calibration data.

---

### AF-10: Dedicated Verifier Agent for Execute Phase

**Why not:** "Lightweight check" (file existence, test runs, structural checks) is sufficient for v1. A dedicated verifier subagent (as GSD uses) adds ~80K token overhead per task. Judgment criteria are noted as "requires human review." v2 candidate if acceptance criteria verification proves unreliable.

---

### AF-11: AskUserQuestion for Micro-Interactions

**Why not:** AskUserQuestion has a 60-second timeout (hard platform constraint). All three design proposals converged on freeform prompt instead. AskUserQuestion is also unavailable in subagents (GitHub #12890). The only exception is dynamic question discovery which uses AskUserQuestion for multiSelect (one-shot approval, not conversation).

---

### AF-12: Cross-Lifecycle Artifact Import (v1)

**Why not:** LOW confidence, novel feature with no reference precedent. Locked constraints from imported artifacts depend on LLM enforcement which is unreliable. Deferred to v2 per PROJECT.md. HANDOFF.md generation stays in v1; the import/constraint-locking mechanism does not.

---

### AF-13: Mobile/Web UI

**Why not:** Pure CLI plugin. Single-developer workflow in Claude Code terminal. No user persona requires mobile or web access.

---

### AF-14: Multi-User Collaboration

**Why not:** Single-developer workflow. No shared state, no concurrent lifecycle editing. The state model (single `state.yml`, single `.expedite/` directory) does not support concurrent access. Team coordination happens outside the tool.

---

## Feature Dependency Map

```
TS-1 (Plugin Structure)
  |
  +-- TS-2 (SKILL.md Orchestrators)
  |     |
  |     +-- TS-5 (Namespace/Invocation)
  |     +-- TS-6 (Subagent Orchestration)
  |     |     |
  |     |     +-- D-3 (Parallel Research / Source-Affinity Batching)
  |     |     +-- D-4 (Dynamic Question Discovery)
  |     |     +-- D-8 (Gap-Fill Research Rounds)
  |     |
  |     +-- TS-7 (Prompt Templates)
  |     |     |
  |     |     +-- D-5 (Dual Intent Adaptation)
  |     |     +-- D-7 (Source Routing / Circuit Breaker)
  |     |
  |     +-- D-12 (Scope / Interactive Question Plan)
  |     +-- D-9 (Design Revision Cycle)
  |     +-- D-10 (Execute / Wave Checkpointing)
  |
  +-- TS-3 (State Persistence)
  |     |
  |     +-- TS-4 (Context Reconstruction)
  |     +-- TS-8 (Phase Transitions)
  |     +-- D-1 (Quality Gates)
  |           |
  |           +-- D-2 (Sufficiency Model)
  |           +-- D-8 (Gap-Fill triggers on Recycle)
  |
  +-- TS-9 (Artifact Pipeline)
  |     |
  |     +-- D-6 (HANDOFF.md)
  |     +-- D-11 (Passive Telemetry)
  |
  +-- TS-10 (Error Recovery)
```

---

## Complexity Summary

| ID | Feature | Complexity | Confidence | Needs Testing? |
|----|---------|-----------|------------|---------------|
| TS-1 | Plugin Structure | Low | ROCK SOLID | No |
| TS-2 | SKILL.md Orchestrators | Medium | ROCK SOLID (pattern), HIGH RISK (research SKILL.md complexity) | YES -- 11-step research orchestration |
| TS-3 | State Persistence | Low | STRONG | No |
| TS-4 | Context Reconstruction | Medium | MODERATE (hook bugs) | YES -- SessionStart hook reliability |
| TS-5 | Namespace/Invocation | Low | HIGH | No |
| TS-6 | Subagent Orchestration | Medium | STRONG | No |
| TS-7 | Prompt Templates | Low | STRONG | No |
| TS-8 | Phase Transitions | Low | HIGH | No |
| TS-9 | Artifact Pipeline | Low | STRONG | No |
| TS-10 | Error Recovery | Medium | MIXED | Varies by skill |
| D-1 | Quality Gates | Medium | MODERATE | YES -- LLM gate judgment reliability |
| D-2 | Sufficiency Model | Medium | STRONG (pattern), MODERATE (3-dim rubric) | YES -- rubric stability |
| D-3 | Parallel Research Batching | Medium-High | MODERATE | YES -- batch quality |
| D-4 | Dynamic Question Discovery | Medium | MODERATE | YES -- extraction reliability |
| D-5 | Dual Intent Adaptation | High | WEAK-MODERATE (content), STRONG (mechanism) | YES -- per-phase content quality |
| D-6 | HANDOFF.md | High | MODERATE (sections 1-8), WEAK (section 9), LOW (import) | YES -- format utility |
| D-7 | Source Routing / Circuit Breaker | Medium | STRONG (templates), MODERATE (circuit breaker) | No |
| D-8 | Gap-Fill Research | Medium | MODERATE | No |
| D-9 | Design Revision Cycle | Low-Medium | MODERATE | No |
| D-10 | Execute / Checkpointing | Medium | STRONG (waves), WEAK (acceptance checks) | YES -- resume reliability |
| D-11 | Passive Telemetry | Low | STRONG | No |
| D-12 | Scope / Question Plan | Medium | HIGH | No |

---

## Reference Implementation Feature Mapping

### Research-Engine Features (Direct Ancestor)

| Feature | In Research-Engine | In Expedite | Adaptation |
|---------|-------------------|-------------|------------|
| Plugin directory structure | Yes | TS-1 | Direct copy |
| SKILL.md orchestration | Yes (5 skills) | TS-2 (6 skills) | Extended with status skill |
| Per-source researcher templates | Yes | TS-7, D-7 | Direct adoption |
| Categorical sufficiency (COVERED/PARTIAL/NOT COVERED) | Yes (proven) | D-2 | Extended with 3-dimensional rubric |
| File-based subagent output | Yes | TS-6 | Direct copy |
| Condensed returns via prompt | Yes | TS-6 | Direct copy |
| Hardcoded model tiers in frontmatter | Yes | TS-7 | Direct copy |
| Intent lens injection | Yes | D-5 | Extended to full per-phase adaptation |
| Gap-fill research rounds | Yes | D-8 | Adapted with decision-area re-batching |
| Minimal plugin.json | Yes | TS-1 | Direct copy |
| Source-specific tool sets | Yes | D-7 | Extended with circuit breaker |

### GSD Features

| Feature | In GSD | In Expedite | Adaptation |
|---------|--------|-------------|------------|
| Wave-based execution ordering | Yes | D-10 | Direct adoption |
| Checkpoint-based resume | Yes | D-10 | Simplified to single checkpoint.yml |
| Subagent dispatch with Task() | Yes | TS-6 | Pattern adopted, research-specific |
| State management (YAML) | Yes | TS-3 | Adapted with flat 2-level constraint |
| Interactive scoping | Yes | D-12 | Extended with question plan preview |
| Progress tracking | Yes | D-10 | Adapted as PROGRESS.md append-only |

### Features Novel to Expedite (Not in Either Reference)

| Feature | Why Novel |
|---------|-----------|
| D-1: MUST/SHOULD quality gates with escalating recycles | Neither reference has structured gate criteria with override tracking |
| D-4: Dynamic question discovery | Neither reference discovers questions during research |
| D-5: Full per-phase dual intent (product/engineering) | Research-engine has lens injection but not full format switching |
| D-6: HANDOFF.md cross-lifecycle artifact | No reference has cross-lifecycle artifact flow |
| D-9: Design revision cycle | Neither reference has in-session revision before gate |
| D-11: Passive telemetry for v2 calibration | Neither reference collects structured telemetry |
| D-12: Question plan preview ("Terraform plan-apply" moment) | Neither reference shows the research plan before committing |

---

*Last updated: 2026-02-27*
