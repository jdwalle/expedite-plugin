# Roadmap: Expedite Plugin

## Overview

Expedite is a Claude Code plugin implementing a 5-phase research-to-implementation lifecycle (Scope, Research, Design, Plan, Execute). The build proceeds in 10 phases, starting from static plugin scaffolding and progressing through state management, prompt templates, each lifecycle skill in dependency order, and finally cross-cutting concerns. The critical bottleneck is the research skill (Phases 5-6), which has no reference implementation at its complexity level and gates all downstream work. Everything before research builds the infrastructure it depends on; everything after research consumes its output.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Plugin Scaffolding** - Static plugin files, directory structure, and auto-discovery verification
- [x] **Phase 2: State Management and Context** - state.yml schema, backup-before-write pattern, status skill, context reconstruction
- [x] **Phase 3: Prompt Template System** - All prompt templates (researcher, sufficiency, design guide) with 8-section XML structure
- [x] **Phase 4: Scope Skill** - Interactive scoping, intent detection, question plan generation, G1 gate
- [x] **Phase 5: Research Orchestration Core** - Subagent dispatch, source-affinity batching, parallel evidence collection
- [ ] **Phase 6: Research Quality and Synthesis** - Sufficiency assessment, G2 gate, gap-fill rounds, dynamic question discovery, SYNTHESIS.md
- [ ] **Phase 7: Design Skill** - Main-session design generation, RFC/PRD format, revision cycle, G3 gate
- [ ] **Phase 8: Plan Skill** - Plan generation from design artifacts, wave/epic structure, G4 gate
- [ ] **Phase 9: Execute Skill** - Wave-based task execution, checkpoint/resume, progress tracking
- [ ] **Phase 10: Cross-Cutting Integration** - Dual intent end-to-end, telemetry, archival flow, gate escalation polish

## Phase Details

### Phase 1: Plugin Scaffolding
**Goal**: Claude Code recognizes Expedite as an installed plugin and can discover all skill entry points
**Depends on**: Nothing (first phase)
**Requirements**: FOUND-01, FOUND-02, FOUND-03, FOUND-04, FOUND-05
**Success Criteria** (what must be TRUE):
  1. Running `/expedite:` in Claude Code shows all 6 skills (scope, research, design, plan, execute, status) in the autocomplete/help
  2. plugin.json is valid and contains name, version, description, author fields
  3. Each skill has a `skills/{name}/SKILL.md` file with YAML frontmatter (name, description, allowed-tools, argument-hint) and trigger phrases in the description
  4. The plugin directory at `~/.claude/plugins/expedite/` is self-contained with plugin.json, skills/, and references/ subdirectories
**Plans**: 2 plans

Plans:
- [x] 01-01-PLAN.md -- Create plugin manifest (.claude-plugin/plugin.json) and full directory structure (skills/, references/, templates/)
- [x] 01-02-PLAN.md -- Create all 6 SKILL.md files with frontmatter, trigger phrases, and stub bodies + human verification of plugin discovery

### Phase 2: State Management and Context
**Goal**: The plugin can persist, recover, and display lifecycle state across sessions and after /clear
**Depends on**: Phase 1
**Requirements**: STATE-01, STATE-02, STATE-03, STATE-04, STATE-05, STATE-06, CTX-01, CTX-02, CTX-03
**Success Criteria** (what must be TRUE):
  1. `/expedite:status` displays the current lifecycle phase, question status, gate history, and recommended next action
  2. After `/clear`, invoking any skill reconstructs context from `.expedite/state.yml` via `!cat` injection without user intervention
  3. state.yml uses max 2 nesting levels, includes a version field, and every write creates a `.bak` backup before overwriting
  4. Phase sub-states (e.g. `scope_in_progress`, `scope_complete`, `research_recycled`) are granular enough that crash recovery resumes at the correct point from phase name alone
  5. Phase transitions enforce forward-only movement -- no backward lifecycle regression
**Plans**: 2 plans (1 deferred to v2)

Plans:
- [x] 02-01-PLAN.md -- Create state.yml, gitignore, and sources.yml templates in templates/ directory (schema definition)
- ~~02-02-PLAN.md -- Create SessionStart hook~~ (deferred to v2)
- [x] 02-03-PLAN.md -- Implement full status skill orchestration logic + verify CTX-01 !cat injection across all SKILL.md files

### Phase 3: Prompt Template System
**Goal**: All prompt templates exist with correct structure so skills and subagents can reference them at invocation time
**Depends on**: Phase 1
**Requirements**: TMPL-01, TMPL-02, TMPL-03, TMPL-04, TMPL-05, TMPL-06
**Success Criteria** (what must be TRUE):
  1. All 6 templates follow the 8-section XML structure (role, context, intent_lens, downstream_consumer, instructions, output_format, quality_gate, input_data)
  2. The 3 per-source researcher templates (web-researcher.md, codebase-researcher.md, mcp-researcher.md) include model tier in frontmatter (sonnet for researchers)
  3. Templates with `<intent_lens>` sections contain conditional blocks for both product and engineering intents
  4. Sufficiency evaluator reference template and design guide reference template exist in references/ with correct structure
**Plans**: 3 plans

Plans:
- [x] 03-01-PLAN.md -- Create 3 per-source researcher templates (web-researcher, codebase-analyst, mcp-researcher) with frontmatter, 8-section XML, circuit breaker, contract chain enforcement
- [x] 03-02-PLAN.md -- Create research synthesizer (opus subagent), sufficiency evaluator (inline rubric), and scope questioning guide (inline reference)
- [x] 03-03-PLAN.md -- Create design guide, plan guide, and task verifier inline reference templates with intent-conditional formats and contract chain enforcement

### Phase 4: Scope Skill
**Goal**: Users can define a lifecycle goal, declare intent, and produce an approved question plan with evidence requirements ready for research
**Depends on**: Phase 2, Phase 3
**Requirements**: SCOPE-01, SCOPE-02, SCOPE-03, SCOPE-04, SCOPE-05, SCOPE-06, SCOPE-07, SCOPE-08, SCOPE-09, SCOPE-10, SCOPE-11, GATE-01, GATE-02, GATE-06, ARTF-01, ARTF-02
**Success Criteria** (what must be TRUE):
  1. User answers 5-8 interactive questions and the skill detects intent (product or engineering) from their responses
  2. A structured question plan with priorities (P0/P1/P2), decision areas (DA-1 through DA-N), and source hints is generated and presented for user review before any research begins
  3. Each question defines evidence requirements: what specific evidence would constitute a sufficient answer (e.g., "at least 2 implementation examples", "API documentation confirming capability", "benchmark data comparing approaches")
  4. Each DA defines a readiness criterion: how to know when enough evidence exists to make a design decision for that area
  5. Each DA has a depth calibration (Deep/Standard/Light) that sets evidence count expectations — Deep DAs need more corroborating sources than Light ones
  6. User can modify the question plan (add, remove, reprioritize questions) before approving it
  7. G1 gate passes only when all required fields are present, at least one P0 question exists, and every question has evidence requirements defined (structural/deterministic validation)
  8. SCOPE.md artifact is written to `.expedite/scope/SCOPE.md` with the full question plan, evidence requirements, readiness criteria, and intent declaration
**Plans**: 3 plans

Plans:
- [x] 04-01-PLAN.md -- Replace scope SKILL.md stub with Steps 1-5: lifecycle check, archival, initialization, Round 1 context questions, Round 2 refinement questions
- [x] 04-02-PLAN.md -- Append Steps 6-8: question plan generation (using questioning guide reference), review loop, source config display, SCOPE.md + state.yml artifact writing
- [x] 04-03-PLAN.md -- Append Step 9: G1 structural gate (6 MUST + 3 SHOULD criteria), gate history, phase transition + human verification

### Phase 5: Research Orchestration Core
**Goal**: The research skill dispatches parallel subagents that collect evidence against specific evidence requirements from scope, not just topic-level questions
**Depends on**: Phase 4
**Requirements**: RSCH-01, RSCH-02, RSCH-03, RSCH-04, RSCH-09, RSCH-14, RSCH-15
**Success Criteria** (what must be TRUE):
  1. Questions from the scope are grouped into 3-5 batches by source affinity (web, codebase, MCP) with every Decision Area covered by at least one research question
  2. Each research agent receives the evidence requirements for its batch — agents know what specific evidence they need to find, not just the topic to research (e.g., "find 2+ implementation examples" not just "research authentication")
  3. Up to 3 research subagents are dispatched in parallel via Task() API, each using the correct per-source prompt template
  4. Each subagent writes detailed findings to evidence files and returns a condensed summary (max 500 tokens)
  5. Source routing handles failures with circuit breaker logic: retry once on server failure, never retry platform failures, classify failed sources as UNAVAILABLE-SOURCE
**Plans**: 3 plans

Plans:
- [x] 05-01-PLAN.md -- Replace research SKILL.md stub with Steps 1-6: prerequisite check, scope loading, state initialization, source-affinity batch formation, DA coverage validation, batch plan approval
- [x] 05-02-PLAN.md -- Append Steps 7-11: source pre-validation, template assembly with placeholder injection, parallel subagent dispatch via Task(), result collection with state updates, completion summary with dynamic question queuing
- [x] 05-03-PLAN.md -- Coherence review of complete 11-step research SKILL.md + human verification

### Phase 11: Integration Fixes (Gap Closure)
**Goal**: Fix 3 integration findings from v1.0 audit — persist description field, align gate outcome schema, add Glob fallback for template paths
**Depends on**: Phase 4, Phase 5
**Requirements**: STATE-02, STATE-04, CTX-01, GATE-02, STATE-05, RSCH-02, TMPL-04
**Gap Closure**: Closes INT-01, INT-02, INT-03 from v1.0-MILESTONE-AUDIT.md
**Success Criteria** (what must be TRUE):
  1. `description` field exists in state.yml.template schema and scope SKILL.md Step 4 writes it to state.yml after Round 1
  2. state.yml.template gate outcome schema comment includes `hold` and `go_advisory` matching actual scope Step 9 outputs
  3. Research SKILL.md Step 8 uses Glob fallback pattern for template paths, consistent with scope SKILL.md approach
**Plans**: TBD

Plans:
- [x] 11-01-PLAN.md -- Fix 3 integration findings: description field, gate outcome schema, Glob fallback for template paths

### Phase 6: Research Quality and Synthesis
**Goal**: Research output is assessed for sufficiency against the evidence requirements defined in scope, gaps are filled through targeted re-research, and a synthesis artifact is produced for downstream consumption
**Depends on**: Phase 5
**Requirements**: RSCH-05, RSCH-06, RSCH-07, RSCH-08, RSCH-10, RSCH-11, RSCH-12, RSCH-13, RSCH-16, GATE-03, GATE-04, GATE-07
**Success Criteria** (what must be TRUE):
  1. Per-question sufficiency is assessed against the evidence requirements defined in SCOPE.md — the evaluator checks whether the specific evidence requested was found (not just general topical coverage)
  2. The categorical model (COVERED, PARTIAL, NOT COVERED, UNAVAILABLE-SOURCE) rates each question across 3 dimensions (Coverage, Corroboration, Actionability), calibrated by the DA's depth level (Deep DAs require stronger corroboration than Light ones)
  3. G2 gate evaluates research using count-based criteria (majority COVERED, all P0 at least PARTIAL) with anti-bias instructions in the evaluation prompt
  4. When G2 triggers Recycle, gap-fill mode dispatches targeted agents for PARTIAL/NOT COVERED questions only, producing additive supplement files — gap-fill agents receive the unmet evidence requirements so they know what's still missing
  5. Dynamic question discovery surfaces up to 4 new questions from subagent proposals (deduplicated via LLM judgment) for user approval
  6. SYNTHESIS.md artifact is written to `.expedite/research/SYNTHESIS.md` after gate pass, organized by Decision Area with evidence traceability (which evidence files support which DA)
**Plans**: 3 plans

Plans:
- [ ] 06-01-PLAN.md -- Append Steps 12-13: sufficiency assessment (inline evaluator with anti-bias separation) and dynamic question discovery (LLM dedup, max 4, user approval)
- [ ] 06-02-PLAN.md -- Append Steps 14-16: G2 gate evaluation (MUST/SHOULD criteria), gate outcome handling (Go/Go-with-advisory/Recycle/Override with escalation), gap-fill recycling dispatch by DA
- [ ] 06-03-PLAN.md -- Append Steps 17-18: synthesis generation (opus Task() subagent), research completion + coherence review and human verification

### Phase 7: Design Skill
**Goal**: Users receive a design document where every Decision Area has a corresponding design decision that references supporting research evidence
**Depends on**: Phase 6
**Requirements**: DSGN-01, DSGN-02, DSGN-03, DSGN-04, DSGN-05, DSGN-06, DSGN-07, DSGN-08, DSGN-09
**Success Criteria** (what must be TRUE):
  1. Design is generated in the main session (not a subagent) from research artifacts, producing RFC-style output for engineering intent and PRD-style output for product intent
  2. Every Decision Area (DA-1 through DA-N) from scope has a corresponding design decision — no DA is left without a decision
  3. Each design decision references the supporting evidence from research (which evidence files, which findings justify the decision)
  4. User can request up to 2 rounds of revision via freeform feedback before gate evaluation
  5. Product-intent lifecycles also produce a HANDOFF.md with 9-section format for engineer consumption
  6. G3 gate evaluates design quality with MUST/SHOULD criteria and anti-bias instructions — MUST include "every DA has a decision" and "decisions reference evidence"
  7. DESIGN.md artifact is written to `.expedite/design/DESIGN.md`
**Plans**: 3 plans

Plans:
- [ ] 07-01-PLAN.md -- Replace design SKILL.md stub with Steps 1-5: prerequisite check, artifact loading, state initialization, inline design generation (RFC/PRD), DESIGN.md writing
- [ ] 07-02-PLAN.md -- Append Steps 6-7: HANDOFF.md generation (product intent only, 9 sections), freeform revision cycle with change summaries
- [ ] 07-03-PLAN.md -- Append Steps 8-10: G3 gate evaluation (MUST/SHOULD criteria), gate outcome handling (Go/Go-advisory/Recycle/Override), design completion + human verification

### Phase 8: Plan Skill
**Goal**: A structured, executable plan is generated from the design where every design decision maps to tasks with acceptance criteria that trace back to those decisions
**Depends on**: Phase 7
**Requirements**: PLAN-01, PLAN-02, PLAN-03, PLAN-04, PLAN-05, PLAN-06
**Success Criteria** (what must be TRUE):
  1. Plan is generated in the main session from design artifacts, producing wave-ordered tasks for engineering intent and epics/stories for product intent
  2. Every Decision Area (DA-1 through DA-N) from scope maps to at least one plan task
  3. Every design decision has at least one corresponding task — no decision is left unimplemented
  4. Each task's acceptance criteria trace back to the design decision(s) they verify — criteria are derived from design, not invented independently
  5. G4 gate validates: plan exists, every design decision has a task, acceptance criteria cite design decisions, wave ordering/priority present (structural cross-reference)
  6. PLAN.md artifact is written to `.expedite/plan/PLAN.md`
**Plans**: TBD

Plans:
- [ ] 08-01: TBD
- [ ] 08-02: TBD

### Phase 9: Execute Skill
**Goal**: Users can execute a plan task-by-task with per-task verification that code changes actually address the design decisions they trace to
**Depends on**: Phase 8
**Requirements**: EXEC-01, EXEC-02, EXEC-03, EXEC-04, EXEC-05, EXEC-06, EXEC-07
**Success Criteria** (what must be TRUE):
  1. Tasks execute sequentially in wave order from PLAN.md with between-wave prompts at wave transitions
  2. Per-task verification confirms the code change addresses the design decision it traces to — not just that it passes a disconnected acceptance check. The contract chain (scope question → evidence → design decision → plan task → code change) is validated
  3. A checkpoint.yml file tracks execution position so that pausing and later invoking `/expedite:execute` resumes from the correct task
  4. PROGRESS.md uses append-only `cat >>` pattern (never full rewrite) to log completed task outcomes including which design decision each task satisfied
  5. Between tasks, a freeform micro-interaction prompt offers the user "yes / pause / review" options
**Plans**: TBD

Plans:
- [ ] 09-01: TBD
- [ ] 09-02: TBD

### Phase 10: Cross-Cutting Integration
**Goal**: The complete lifecycle works end-to-end with consistent intent adaptation, operational telemetry, lifecycle archival, and polished gate escalation behavior
**Depends on**: Phase 9
**Requirements**: INTNT-01, INTNT-02, INTNT-03, TELE-01, TELE-02, TELE-03, TELE-04, TELE-05, ARTF-03, GATE-05, SCOPE-06
**Success Criteria** (what must be TRUE):
  1. Intent (product/engineering) declared during scope flows through every downstream skill, producing the correct format at each phase (PRD vs RFC design, epics vs waves plan)
  2. log.yml records phase transitions, gate outcomes, agent completions, source failures, and overrides using append-only multi-document YAML format (gitignored)
  3. Completed lifecycles can be archived to `.expedite/archive/{slug}/`, preserving all artifacts
  4. Gate escalation works across the full lifecycle: 1st Recycle is informational, 2nd suggests adjustment, 3rd recommends override; Override records severity and injects gap context into downstream prompts
  5. Source configuration step in scope confirms default sources or allows editing sources.yml
**Plans**: TBD

Plans:
- [ ] 10-01: TBD
- [ ] 10-02: TBD
- [ ] 10-03: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 -> 2 -> 3 -> 4 -> 5 -> 11 -> 6 -> 7 -> 8 -> 9 -> 10
Note: Phase 11 (gap closure) executes before Phase 6 since it fixes integration issues Phase 6+ depends on.

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Plugin Scaffolding | 2/2 | Complete | 2026-02-28 |
| 2. State Management and Context | 2/2 | Complete | 2026-02-28 |
| 3. Prompt Template System | 3/3 | Complete | 2026-03-02 |
| 4. Scope Skill | 3/3 | Complete | 2026-03-03 |
| 5. Research Orchestration Core | 3/3 | Complete | 2026-03-04 |
| 11. Integration Fixes (Gap Closure) | 1/1 | Complete    | 2026-03-04 |
| 6. Research Quality and Synthesis | 1/3 | In Progress|  |
| 7. Design Skill | 0/2 | Not started | - |
| 8. Plan Skill | 0/2 | Not started | - |
| 9. Execute Skill | 0/2 | Not started | - |
| 10. Cross-Cutting Integration | 0/3 | Not started | - |
