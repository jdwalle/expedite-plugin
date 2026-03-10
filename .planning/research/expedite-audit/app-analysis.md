# Expedite Plugin Production Readiness Audit

**Date:** 2026-03-09
**Auditor:** App Analysis Agent
**Scope:** 10 decision areas defined in `.planning/research/expedite-audit/SCOPE.md`
**Reference spec:** `.planning/research/arc-implementation/design/PRODUCT-DESIGN.md`
**Comparison baseline:** `~/.claude/plugins/cache/local/research-engine/0.1.0/`

---

## DA-1: Design Fidelity -- Spec-vs-Implementation Delta

### Decisions Register Mapping (29 Entries)

| # | Decision | Spec Status | Implementation Status | Verdict |
|---|----------|-------------|----------------------|---------|
| 1 | Inline gates | High confidence | Implemented -- all 5 gates (G1-G5) inline in producing skills | Match |
| 2 | Single template with conditional intent lens | High confidence | Implemented -- `<if_intent_product>` / `<if_intent_engineering>` blocks in all 6 subagent/guide templates | Match |
| 3 | Hardcoded model tiers in frontmatter | High confidence | Implemented -- `model: sonnet` or `model: opus` in all 6 frontmatter-bearing templates | Match |
| 4 | No extended thinking for v1 | Medium confidence | Implemented -- no extended thinking references anywhere | Match |
| 5 | log.yml gitignored | High confidence | Implemented -- `templates/gitignore.template` line 5: `log.yml` | Match |
| 6 | Full intent adaptation + HANDOFF.md | Medium confidence | **Partial** -- intent adaptation implemented; HANDOFF.md deferred. PROJECT.md lists it as "Out of Scope" | Intentional evolution |
| 7 | Granular phase naming | High confidence | **Modified** -- `_recycled` states eliminated; `_in_progress` + gate_history + `--override` pattern used instead | Intentional evolution |
| 8 | Flat state.yml (max 2 nesting levels) | High confidence | Implemented -- `templates/state.yml.template` has max 2 levels | Match |
| 9 | Design/plan in main session | High confidence | Implemented -- design SKILL.md Step 4 says "inline generation in the main session" | Match |
| 10 | Sufficiency evaluation inline | High confidence | **Diverged** -- sufficiency evaluator runs as Task() subagent (`model: sonnet`, `subagent_type: general-purpose`). Template has frontmatter at `prompt-sufficiency-evaluator.md` lines 1-4 | Silent drift (see DA-3) |
| 11 | Scope questioning in main session | High confidence | Implemented -- scope SKILL.md runs entirely in main session | Match |
| 12 | Three per-source researcher templates | High confidence | Implemented -- `prompt-web-researcher.md`, `prompt-codebase-analyst.md`, `prompt-mcp-researcher.md` | Match |
| 13 | Source-affinity batching | Medium confidence | Implemented -- research SKILL.md Step 4 defines assignment rules | Match |
| 14 | Override applies to MUST and SHOULD | Medium confidence | Implemented -- `ref-override-handling.md` and all gate outcome sections support override | Match |
| 15 | Go-with-advisory as fourth outcome | High confidence | Implemented -- all gate sections define Go, Go-with-advisory, Recycle, Override | Match |
| 16 | Categorical sufficiency (COVERED/PARTIAL/NOT COVERED) | High confidence | Implemented -- `prompt-sufficiency-evaluator.md` lines 81-86 | Match |
| 17 | P0/P1/P2 priority | High confidence | Implemented -- scope SKILL.md Step 6, all question schemas | Match |
| 18 | Single checkpoint.yml | Medium confidence | **Modified** -- per-phase checkpoint.yml at `.expedite/plan/phases/{slug}/checkpoint.yml` | Intentional evolution |
| 19 | log.yml persists across lifecycles | Medium confidence | Implemented -- archival flow excludes log.yml | Match |
| 20 | `cat >>` for log.yml | High confidence | Implemented -- all SKILL.md files use `cat >> .expedite/log.yml` pattern | Match |
| 21 | Dynamic context injection | High confidence | Implemented -- all 7 SKILL.md files: `!cat .expedite/state.yml 2>/dev/null` | Match |
| 22 | Max 3 concurrent research subagents | High confidence | Implemented -- research SKILL.md Step 9: "Maximum 3 concurrent agents" | Match |
| 23 | Freeform prompt for micro-interaction | High confidence | Implemented -- execute SKILL.md Step 5f: "yes / pause / review" | Match |
| 24 | Design revision cycle (max 2 rounds) | Medium confidence | **Modified** -- no hard round limit. design SKILL.md Step 7: "freeform revision loop with no hard round limit" | Intentional evolution |
| 25 | Categorical sufficiency (not numeric) | High confidence | Implemented | Match |
| 26 | HANDOFF.md 9-section format | Low confidence | **Deferred** -- design SKILL.md Step 6 has full 9-section format but HANDOFF.md generation is listed as deferred in PROJECT.md | Intentional evolution |
| 27 | hooks.json field naming | Low confidence | **Not implemented** -- no `hooks/` directory exists | Intentional deferral |
| 28 | MCP tools require foreground | High confidence | Implemented -- all research templates use `subagent_type: general-purpose` | Match |
| 29 | AskUserQuestion not in subagents | High confidence | Implemented -- no subagent template includes AskUserQuestion | Match |

**Summary:** 21 matches, 5 intentional evolutions (documented), 1 silent drift (Decision 10), 2 intentional deferrals.

### Elements Specified but Not Implemented

| Element | Spec Location | Status | Rationale Source |
|---------|--------------|--------|-----------------|
| `hooks/` directory | Spec line 87-88 | Absent | PROJECT.md "Out of Scope": "SessionStart hook -- deferred to v2 due to 3 open Claude Code bugs" |
| `scripts/session-start.sh` | Spec lines 304-351 | Absent | Same as above |
| `_recycled` phase states | Spec line 217-221 (`research_recycled`, `design_recycled`, `plan_recycled`) | Eliminated | `state.yml.template` lines 18-27 explicitly document: "Note: research_recycled is conceptual. Cross-session override re-entry uses research_in_progress + --override + gate_history G2 recycle evidence." Also documented in PROJECT.md Key Decisions and `.planning/milestones/v1.0-MILESTONE-AUDIT.md` (INT-04, FLOW-03). |
| Connected Flow import | Spec lines 1447-1457 | Stub only | scope SKILL.md Step 2: "> **Not yet implemented.** Connected flow artifact detection... is a v2 feature". state.yml.template reserves `imported_from` and `constraints` fields. |
| External verifier agent | Spec Decision 10 says inline but memory says "external agent" | Neither inline (per spec) nor external (per memory) -- dispatched as Task() subagent | No documented rationale for subagent dispatch vs inline (see DA-3) |
| `sources.yml` array-of-objects schema | Spec lines 1159-1191 | Simplified to map structure | Template uses `sources: web: { enabled: true, tools: [...] }` instead of array format |
| Spec `"arc"` name and `"1.0.0"` version | Spec lines 127-133 | `"expedite"`, `"0.1.0"` | PROJECT.md documents rename. Version addressed in DA-10. |

### Elements Implemented but Not Specified

| Element | Location | Purpose | Rationale Source |
|---------|----------|---------|-----------------|
| Spike skill + G5 gate | `skills/spike/SKILL.md` (472 lines) | Per-phase tactical decision resolution before execution | PROJECT.md Key Decisions: "Spike as separate skill (not inline in execute) -- Per-phase granularity, optional usage, G5 gate boundary" |
| Codebase-routed questions (scope Step 7) | `skills/scope/SKILL.md` lines 391-453 | Additive questions from codebase analysis, not counted against 15-question budget | No explicit rationale document found -- appears to be an implementation-phase enhancement |
| Per-phase execution model | `skills/execute/SKILL.md` | `execute <phase>` operates on one wave/epic at a time with per-phase artifacts at `.expedite/plan/phases/{slug}/` | PROJECT.md: "Per-phase artifacts at .expedite/plan/phases/{slug}/ -- User decision -- collocate spike/execute outputs per phase" |
| `description` field in state.yml | `templates/state.yml.template` line 11 | Stores user's project description | Not in spec schema (spec lines 206-260). Practical addition. |
| `argument-hint` frontmatter field | All SKILL.md files | Hints for CLI argument parsing | Not in spec SKILL.md frontmatter examples. Plugin platform feature adoption. |
| `prompt-spike-researcher.md` | `skills/spike/references/` | Template for spike-focused research subagent | Follows from spike skill addition. |
| Adaptive refinement convergence loop (scope Step 5) | `skills/scope/SKILL.md` lines 214-296 | Replaces spec's fixed Round 2 questions with dynamic category-based refinement | Memory note: "Step 5 was redesigned from static Round 2 questions to adaptive refinement with convergence loop" |
| No hard revision limit (design Step 7) | `skills/design/SKILL.md` lines 330-379 | Spec says max 2 rounds; implementation has no limit | No explicit rationale document, but appears to prioritize user agency |

### Divergence Classification Summary

- **Intentional evolution (documented):** `_recycled` elimination, HANDOFF.md deferral, hooks deferral, Connected Flow deferral, spike skill addition, per-phase execution, adaptive refinement, per-phase checkpoint.
- **Silent drift (no documented rationale):** Sufficiency evaluator as Task() subagent (Decision 10 contradiction), codebase-routed questions addition, design revision no-limit change, sources.yml schema simplification.

---

## DA-2: State Management Correctness

### Phase Transition Map

**Spec-defined transitions (line 271-282):**
```
(none) -> scope_in_progress -> scope_complete [G1]
scope_complete -> research_in_progress -> research_complete [G2]
                                       -> research_recycled -> research_in_progress
research_complete -> design_in_progress -> design_complete [G3]
                                        -> design_recycled -> design_in_progress
design_complete -> plan_in_progress -> plan_complete [G4]
                                    -> plan_recycled -> plan_in_progress
plan_complete -> execute_in_progress -> complete
Any -> archived
```

**Implementation-actual transitions (from all 7 SKILL.md files):**
```
(none) -> scope_in_progress -> scope_complete [G1]
scope_complete -> research_in_progress -> research_complete [G2]
                                       -> [stays research_in_progress on recycle; no research_recycled]
research_complete -> design_in_progress -> design_complete [G3]
research_in_progress + --override + G2 recycle evidence -> design_in_progress
                                        -> [stays design_in_progress on recycle; no design_recycled]
design_complete -> plan_in_progress -> plan_complete [G4]
design_in_progress + --override + G3 recycle evidence -> plan_in_progress
                                    -> [stays plan_in_progress on recycle; no plan_recycled]
plan_complete -> execute_in_progress -> complete
execute_in_progress -> [stays execute_in_progress between phases]
Any -> archived
```

**Analysis:** The implementation eliminates all `*_recycled` intermediate states. Instead, the `_in_progress` state plus gate_history evidence achieves the same information. This is cleaner -- it avoids a state that exists only as a brief waypoint before re-entering `_in_progress`. The state.yml.template documents this explicitly in comments (lines 18-27).

**Verdict:** Intentional evolution. Well-documented in `state.yml.template`, `PROJECT.md`, and `v1.0-MILESTONE-AUDIT.md`.

### `_recycled` State Elimination Analysis

The `_in_progress` + gate_history override pattern preserves all information:

1. **"Has this phase been recycled?"** -- gate_history entries with `outcome: "recycle"` for the relevant gate answer this. Example: research SKILL.md Step 15 reads `ref-recycle-escalation.md` which counts prior G2 recycle entries.

2. **"How many times has it recycled?"** -- Count of gate_history entries with matching gate and outcome. All escalation logic (1st/2nd/3rd recycle messaging) works from these counts.

3. **"Can the user override?"** -- The `--override` flag on the next skill's invocation checks for prior recycle evidence in gate_history. design SKILL.md Case B (line 39-62) demonstrates this pattern.

**Verdict:** No information loss. Pattern is more elegant than dedicated `_recycled` phases.

### Backup-Before-Write Implementation Count

| Skill | backup-before-write references | Locations |
|-------|-------------------------------|-----------|
| scope | 8 | Steps 4, 5, 9 (questions write), 10 (gate history) |
| research | 15 | Steps 3, 10, 12, 15 (gate history), 16 (gap-fill round increment), 18 |
| design | 5 | Steps 3, 9 (gate history), 10 |
| plan | 5 | Steps 3, 8 (gate history), 9 |
| spike | 2 | Step 7 (gate history write) |
| execute | 6 | Steps 3, 5d (checkpoint + state), 6d, 7a |
| status | 1 | Reference only (displays backup path) |

**Total:** 42 backup-before-write references across 7 skills (excluding the 1 in ref-gapfill-dispatch.md). Every state.yml write operation in the codebase includes the read-backup-modify-write pattern. No state.yml write was found without a backup step.

**Verdict:** PASS. Complete coverage.

### Step-Level Tracking Gap

The state.yml tracks only phase-level progress (e.g., `scope_in_progress`), not which step within a skill was last completed. This means:

**Scenario -- scope interrupted at Step 5 vs Step 8:**
- At Step 5 (adaptive refinement): state.yml has `project_name`, `intent`, and `description` set (written in Step 4). Scope SKILL.md Step 1 Case B detects resume and can infer progress from which fields are populated: "If questions exist, skip to Step 6. If intent and description are set but no questions, skip to Step 5."
- At Step 8 (source configuration): state.yml has `project_name`, `intent`, `description`, and `questions` array populated (written in Step 9b). Resume would detect questions exist and skip to Step 6, requiring the user to re-approve the question plan. Steps 7-8 work would be lost but is lightweight.

**For research skill:** Step 1 Case B implements a 5-level artifact-existence decision tree (lines 50-55) to determine resume point, checking: research_round, evidence files existence, sufficiency-results.yml existence, SYNTHESIS.md existence.

**For design/plan skills:** Case B2 checks for DESIGN.md/PLAN.md existence to determine whether to resume at artifact loading or revision cycle.

**Assessment:** The step-level tracking gap is partially mitigated by artifact-existence inference in scope, research, design, and plan. The mitigation is sufficient for most interruption scenarios but imperfect -- Step 5 adaptive refinement context (the category discussions) lives only in conversation context and cannot be reconstructed from artifacts. This is the most vulnerable point.

**Verdict:** Tolerable risk. The most common interruption points (between steps that produce artifacts) are handled. The mid-conversation gap in Step 5 is real but low-probability and low-impact (user re-answers a few questions).

### state.yml Template vs Spec Schema

| Field | Spec | Template | Status |
|-------|------|----------|--------|
| `version` | `"1"` | `"1"` | Match |
| `last_modified` | ISO 8601 | `null` (populated at runtime) | Match |
| `project_name` | present | present | Match |
| `intent` | `"product" \| "engineering"` | `null` | Match |
| `lifecycle_id` | slug format | `null` | Match |
| `description` | **NOT in spec** | present (line 11) | **Addition** |
| `phase` | granular phases | `"scope_in_progress"` | Match |
| `current_task` | present | present | Match |
| `imported_from` | present | present (reserved for v2) | Match |
| `constraints` | array | `[]` | Match |
| `research_rounds` (spec) vs `research_round` (template) | `research_rounds: 1` | `research_round: 0` | **Naming discrepancy + initial value difference** |
| `questions` | array with schema | `[]` with schema in comments | Match |
| `gate_history` | array with schema | `[]` with schema in comments | Match |
| `tasks` | array | `[]` | Match |
| `current_wave` | present | present | Match |

**Key discrepancies:**
1. **`research_rounds` vs `research_round`**: Spec (line 230) uses plural `research_rounds: 1`. Template (line 39) uses singular `research_round: 0`. All SKILL.md files use singular `research_round`. The spec's initial value is 1; the template's is 0 (incremented to 1 in research Step 3). The implementation's approach (start at 0, increment on entry) is arguably cleaner than the spec's (start at 1).
2. **`description` field**: Not in spec schema. Added during implementation for storing user's project description. Practical addition.

**Verdict:** Minor discrepancies, both defensible.

---

## DA-3: Research Orchestration Quality

### Source-Affinity Batching: Spec vs Implementation

**Spec algorithm (8 steps, lines 1203-1211):**
1. Read target questions
2. Read source_hints
3. Group by primary source hint (first element)
4. Merge groups with < 2 questions
5. Split groups with > 5 questions by priority
6. Validate 3-5 batches target
7. Assign to templates
8. Mixed-source handling

**Implementation (research SKILL.md Steps 4-6):**
1. Skip already-COVERED questions (Step 4 rule 1)
2. Read source_hints from state.yml (Step 4 rule 2)
3. Single-source: assign to that batch (rule 3)
4. Multi-source: assign to FIRST enabled source (rule 4)
5. Empty/disabled hints: fallback to web (rule 5)
6. Maximum 5 batches (constraint)
7. Sort by priority within batch
8. User review with modify/approve/cancel (Step 6)

**Delta analysis:** Implementation closely follows spec. Key differences:
- Spec says "merge groups with < 2 questions into nearest compatible group"; implementation does not explicitly state a merge threshold but limits to max 5 batches.
- Spec says "split groups with > 5 questions by priority"; implementation sorts by priority but does not explicitly describe splitting.
- Implementation adds Step 5 (DA coverage validation) which spec does not have as a distinct step.
- Implementation adds Step 6 (user approval of batch plan) which spec mentions in the `/arc:scope` source config but not as a separate research step.

**Verdict:** Faithful implementation with minor structural improvements. The user-approval step is a meaningful UX addition.

### Sufficiency Evaluator Architecture Divergence

**Spec Decision 10 (line 54):** "Sufficiency evaluation inline (not subagent) -- Avoids ~80K token overhead. Main session already has evidence context loaded."

**Spec model tier table (line 1100-1101):** "Sufficiency evaluator | (inherits session) | Inline | Avoids ~80K subagent overhead"

**Spec template inventory (line 1313):** "prompt-sufficiency-evaluator.md | research/references/ | N/A (inline) | Per-question sufficiency rubric"

**Implementation:** `prompt-sufficiency-evaluator.md` has frontmatter `subagent_type: general-purpose` and `model: sonnet` (lines 1-4). Research SKILL.md Step 12 dispatches it as a Task() subagent: "Dispatch the sufficiency evaluator as a Task() subagent."

**This is a direct contradiction of Decision 10.** The spec explicitly chose inline to avoid ~80K token overhead and because the main session "already has evidence context loaded." The implementation dispatches it as a separate subagent.

**However**, the implementation's `<self_contained_reads>` section (evaluator template lines 33-50) instructs the subagent to read evidence files itself. This means evidence is NOT loaded in the orchestrator's context, which actually _supports_ the subagent approach: the orchestrator stays lean while the evaluator reads all evidence files in its own fresh context.

**Assessment:** This is a productive evolution despite contradicting the spec. The spec assumed evidence would be loaded in the orchestrator context; the implementation chose to keep evidence out of the orchestrator and let a dedicated subagent read it. This avoids context bloat in the orchestrator. However, it does incur the ~80K token overhead the spec tried to avoid.

**Rationale documented?** No explicit rationale found in `.planning/` milestone docs. This is **silent drift** -- the change was made during implementation without documenting why Decision 10 was overridden.

### Synthesis Agent Dispatch

**Spec (lines 582-593):** `model: "opus"`, `subagent_type: "general-purpose"`, output to `.arc/research/SYNTHESIS.md`.

**Implementation:** `prompt-research-synthesizer.md` frontmatter: `model: opus`, `subagent_type: general-purpose`. Research SKILL.md Step 17 dispatches with placeholders: `{{project_name}}`, `{{intent}}`, `{{research_round}}`, `{{evidence_dir}}`, `{{scope_file}}`, `{{output_file}}`, `{{timestamp}}`. Uses `<self_contained_reads>` for evidence file reading.

**Verdict:** Match. Model tier, subagent type, output location all align with spec.

### Dynamic Question Discovery

**Spec (line 569, 1388-1395):** "present via AskUserQuestion (multiSelect, header: 'New Qs')"

**Implementation (research SKILL.md Step 13, lines 563-595):** "Present to user via freeform prompt (not AskUserQuestion -- too complex for multi-choice)". Uses `Options: Approve all | Approve specific | Approve none | Modify`.

**Assessment:** The spec says AskUserQuestion with multiSelect. The implementation says freeform because the interaction is "too complex for multi-choice." This is defensible -- presenting 4 proposed questions with rationale, DA references, and batch provenance in a multiSelect dialog would be cramped.

**Verdict:** Minor divergence, defensible.

### Evidence File Naming

**Spec (line 176):** `evidence-batch-{N}.md`

**Implementation (research SKILL.md Step 8, line 343):** `evidence-{batch_id}.md` where batch_id is e.g., `batch-01`. This produces `evidence-batch-01.md`.

**Verdict:** Effective match (the batch_id includes "batch-" prefix).

### Agent Concurrency

**Spec (line 1107):** "Maximum 3 concurrent research subagents."

**Implementation (research SKILL.md Step 9, line 379):** "Maximum 3 concurrent agents. If more than 3 batches exist, dispatch the first 3 and queue remaining batches."

**Verdict:** Match.

### Circuit Breaker Implementation

**Spec (lines 1228-1246):** Three-tier: server failure (retry once), platform failure (no retry), no relevant results (continue). `<source_handling>` and `<source_status>` blocks.

**Implementation:** All three researcher templates include identical `<source_handling>` sections with the three-tier pattern, `<source_status>` blocks with per-tool status reporting, and specific tool-failure guidance.

**Verdict:** Match. Faithfully implemented across all 3 researcher templates.

---

## DA-4: Spike/Execute Architecture Assessment

### Spec vs Implementation Flow Comparison

**Spec flow:** Scope -> Research -> Design -> Plan -> Execute
**Implementation flow:** Scope -> Research -> Design -> Plan -> [Spike (optional)] -> Execute

The spike skill is NOT in the spec. It was added during implementation as a separate skill with its own prompt template (`prompt-spike-researcher.md`) and structural gate (G5).

### Spike Skill Value Assessment

**What spike does (SKILL.md 9 steps):**
1. Parses phase argument (wave/epic number)
2. Reads plan + design artifacts
3. Extracts phase definition with tactical decisions
4. Classifies each TD as "clear-cut" (resolves directly) or "genuinely ambiguous" (asks user)
5. For ambiguous TDs: presents alternatives, lets user choose or dispatch focused research
6. Generates ordered implementation steps from resolved TDs
7. G5 structural gate validates output
8. Writes SPIKE.md with resolved decisions + implementation steps
9. Displays summary

**Assessment:** Spike fills a genuine gap between plan and execute. The plan skill identifies tactical decisions as "resolved" or "needs-spike", but doesn't resolve the "needs-spike" ones. Without spike, execute would need to make these decisions inline during implementation, conflating decision-making with code-writing. Spike enforces the decision-over-task philosophy by ensuring all decisions are made before implementation begins.

**G5 gate value:** G5 is structural (like G1, G4) -- it checks completeness rather than quality. Its 4 MUST criteria (every needs-spike TD resolved, every step has traceability, every resolution has rationale, step count in bounds) are legitimate quality checks. It adds quality assurance without significant overhead.

**Verdict:** Productive evolution. The spike skill is well-designed and fills a real gap.

### Per-Phase Execution Model

**Spec:** Execute runs all tasks in wave order. Single `checkpoint.yml`, single `PROGRESS.md`.

**Implementation:** Execute operates on ONE phase at a time. Per-phase artifacts at `.expedite/plan/phases/{slug}/`. User explicitly invokes each phase: `/expedite:execute 1`, then `/expedite:execute 2`.

**Assessment:**
- **Advantages:** Cleaner scope per invocation. Natural pause points between phases. Enables spiking phase N+1 while executing phase N. Per-phase PROGRESS.md files don't grow unbounded.
- **Disadvantages:** User must manually invoke each phase. No automatic chaining. If user forgets which phase to run next, must check status.

The execute SKILL.md Step 6d handles this by listing remaining phases and recommending next steps. The spike nudge (Step 2, EXEC-02) warns if a phase has unresolved tactical decisions.

**Verdict:** Good UX trade-off. Explicit phase invocation aligns with the decision-over-task philosophy -- the user decides when to proceed to the next phase.

### Spiked vs Unspiked Execution Paths

Execute SKILL.md Step 2 determines mode:
- **If SPIKE.md exists:** Spiked mode -- follow SPIKE.md implementation steps
- **If no SPIKE.md:** Unspiked mode -- follow PLAN.md tasks directly

Step 5a displays different formats for each mode. Step 5e appends different PROGRESS.md entries. The dual-path logic is clean with clear branching points and no crossover confusion.

**Verdict:** Clean implementation.

### Spike Nudge Pattern

Execute SKILL.md Step 2 (lines 98-110): If unspiked AND phase has "needs-spike" TDs, display informational nudge. The nudge is non-blocking -- "This is informational only -- do NOT block execution."

**Assessment:** Appropriately calibrated. The user is informed but not forced. This respects user agency while surfacing relevant information.

### Contract Chain Extension (TD -> DA Tracing)

Spike extends the contract chain: `Scope DA -> Design Decision -> Plan Task -> Tactical Decision -> Spike Resolution -> Implementation Step -> Code Change`.

SPIKE.md includes traceability per step: `**Traces to:** TD-{N} -> DA-{X} ({description})`. Execute's PROGRESS.md includes full chain in spiked mode: `Contract chain: {DA-X} -> {TD-N} -> {spike step} -> {task ID} -> {files}`.

**Verdict:** Adds genuine traceability value.

---

## DA-5: Decision-Over-Task Philosophy Alignment

### Per-Skill Interaction Point Analysis

| Skill | Interaction Points | Type | Assessment |
|-------|-------------------|------|------------|
| **Scope** | Step 1 (resume/archive), Step 4 (project info), Step 5 (refinement categories -- multiSelect), Step 5b (per-category questions with options), Step 5d (confirm understanding), Step 6e (approve/modify/add plan), Step 7d (approve codebase questions), Step 8 (source config) | Mix of decisions and information collection | Steps 5 and 6 are strong decision points -- user chooses categories, approves alternatives, shapes the plan |
| **Research** | Step 1 (resume), Step 5 (DA coverage gap), Step 6 (batch plan approval), Step 7 (source failure handling), Step 12 (unavailable-source short-circuit), Step 13 (dynamic question approval), Step 15 (recycle/adjust/override) | Mostly decisions | Step 6 (batch approval) and Step 15 (recycle handling) are genuine decision points with alternatives |
| **Design** | Step 1 (resume/override), Step 7 (revision cycle -- freeform), Step 9 (recycle escalation) | Mix | Step 7 revision cycle: "revise" or "proceed" -- this is approval/rejection, not alternative selection. The design is generated by the LLM and presented for approval. This leans toward "approve what I generated" |
| **Plan** | Step 1 (resume/override), Step 6 (revision cycle), Step 8 (recycle escalation) | Same pattern as design | Same assessment as design -- plan is generated and presented for approval |
| **Spike** | Step 5 (ambiguous TD resolution -- freeform with alternatives), Step 5 "research" option | Strong decision points | Spike's ambiguous TD handling is the strongest decision-surfacing interaction in the plugin. It presents alternatives with tradeoffs and asks the user to choose. |
| **Execute** | Step 5f (yes/pause/review micro-interaction) | Confirmation | This is a continue/pause decision, not a meaningful design/implementation decision |
| **Status** | None (read-only) | N/A | N/A |

### Philosophy Alignment Assessment

**Strengths:**
- Scope Step 5 (adaptive refinement) genuinely surfaces decisions through category selection and per-category questioning with recommended options
- Scope Step 6 (question plan preview) is a strong "terraform plan-apply" pattern -- user reviews proposed actions before committing
- Spike Step 5 (ambiguous TD resolution) is the strongest decision-over-task implementation -- presents real alternatives with evidence-grounded tradeoffs
- Gate system enforces structural completeness at every phase boundary, preventing skipped decisions

**Weaknesses:**
- Design Step 7: The revision cycle is "approve what I generated" rather than "choose between alternatives." The user can request changes but doesn't see multiple design proposals for each DA. This is a task-completion interaction (review output) not a decision-surfacing interaction (choose between options).
- Plan Step 6: Same pattern as design -- LLM generates plan, user approves/revises.
- Execute Step 5f: The micro-interaction (yes/pause/review) is procedural -- it doesn't surface meaningful decisions about what to build or how.

**Contract Chain Trace (Hypothetical Lifecycle):**

1. **Scope:** User describes "auth redesign." DA-1: Authentication Strategy created with depth: Deep, readiness criterion: "2+ implementation examples comparing PKCE vs implicit flow." Question q01: "How should the OAuth2 flow be implemented?" with evidence requirements: "At least 2 implementation examples with security analysis."

2. **Research:** q01 batched to web research. Agent finds 3 implementation examples. Sufficiency evaluator rates COVERED (Strong coverage, Adequate corroboration, Strong actionability).

3. **Design:** DA-1 decision section: "Use PKCE flow based on evidence-batch-01.md Findings 1-3. Alternatives: implicit flow (rejected due to security concerns from Finding 2), device flow (not applicable per Finding 3)." Confidence: High.

4. **Plan:** Wave 1 covers DA-1. Task t01: "Implement PKCE OAuth2 flow." Design decision: DA-1. Acceptance criteria: "PKCE challenge/verifier pair generated per RFC 7636 *(traces to DA-1 decision: use PKCE flow)*." TD-1: "Which PKCE library to use -- resolved (design chose native implementation over library)."

5. **Spike:** TD-1 resolved from design. Implementation step: "Step 1: Implement PKCE challenge generation. Traces to: TD-1 -> DA-1 (Authentication Strategy)."

6. **Execute:** Task t01 executed. Verifier checks: criterion passes AND aligns with DA-1 design decision. Contract chain: DA-1 -> TD-1 -> Spike Step 1 -> t01 -> auth/pkce.ts.

**Chain integrity:** Each link holds. Evidence requirements flow from scope through research to design. Design decisions flow through plan to execute. Traceability annotations (`traces to DA-X`) are enforced by gate criteria.

### Gate System Assessment

Gates enforce **structural completeness** rather than **decision quality**:
- G1: SCOPE.md exists, questions defined, intent declared, evidence requirements present (structural)
- G2: Majority COVERED, all P0 at least PARTIAL (count-based structural)
- G3: Every DA has decision, every decision references evidence, correct format (structural + content check)
- G4: Every DA covered, phase sizing, acceptance criteria trace to decisions (structural)
- G5: Every TD resolved, traceability links present, rationale recorded (structural)

This is appropriate for the plugin architecture -- LLM-based quality judgments are unreliable, while structural checks are deterministic.

### Override Mechanism

The override preserves user agency completely. The user can override any gate at any recycle count. The escalation pattern (informational -> suggest adjustment -> recommend override) provides graduated guidance without blocking. Override records are persisted in gate_history and propagated downstream as advisory context.

**Verdict:** The plugin **enforces** the decision-over-task philosophy at the scope and spike phases where it matters most (defining what to research, resolving tactical decisions). At the design and plan phases, it **suggests** the philosophy through revision cycles but doesn't enforce alternative-surfacing. This is a reasonable trade-off given that design/plan generation is inherently generative (the LLM must propose something before the user can evaluate it).

---

## DA-6: Prompt Template Architecture Quality

### Template Count

**Spec (lines 1306-1317):** 9 templates listed.
**Implementation:** 13 files in `skills/*/references/`:

| # | File | Spec Counterpart | Status |
|---|------|-----------------|--------|
| 1 | `prompt-scope-questioning.md` | Listed in spec | Match |
| 2 | `prompt-web-researcher.md` | Listed in spec | Match |
| 3 | `prompt-codebase-analyst.md` | Listed in spec | Match |
| 4 | `prompt-mcp-researcher.md` | Listed in spec | Match |
| 5 | `prompt-research-synthesizer.md` | Listed in spec | Match |
| 6 | `prompt-sufficiency-evaluator.md` | Listed in spec (but as inline, not subagent) | Modified |
| 7 | `prompt-design-guide.md` | Listed in spec | Match |
| 8 | `prompt-plan-guide.md` | Listed in spec | Match |
| 9 | `prompt-task-verifier.md` | Listed in spec | Match |
| 10 | `ref-recycle-escalation.md` | **Not in spec** | Addition |
| 11 | `ref-gapfill-dispatch.md` | **Not in spec** | Addition |
| 12 | `ref-override-handling.md` | **Not in spec** | Addition |
| 13 | `prompt-spike-researcher.md` | **Not in spec** (spike not in spec) | Addition |

The 4 additions: 3 inline reference files (`ref-*`) extracted from what would have been inline SKILL.md content, and 1 new subagent template for the spike skill's focused research.

### 8-Section Structure Compliance

**Spec structure (lines 1257-1302):** `<role>`, `<context>`, `<intent_lens>`, `<downstream_consumer>`, `<instructions>`, `<output_format>`, `<quality_gate>`, `<input_data>`.

| Template | role | context | intent_lens | downstream_consumer | instructions | output_format | quality_gate | input_data | Compliant? |
|----------|------|---------|-------------|--------------------|--------------|--------------|--------------| -----------|------------|
| prompt-web-researcher.md | Yes | Yes | Yes (inside context) | Yes | Yes | Yes | Yes | Yes | Yes |
| prompt-codebase-analyst.md | Yes | Yes | Yes (inside context) | Yes | Yes | Yes | Yes | Yes | Yes |
| prompt-mcp-researcher.md | Yes | Yes | Yes (inside context) | Yes | Yes | Yes | Yes | Yes | Yes |
| prompt-research-synthesizer.md | Yes | Yes | Yes (inside context) | Yes | Yes | Yes | Yes | Comment only* | Yes |
| prompt-sufficiency-evaluator.md | Yes | Yes | Yes (inside context) | Yes | Yes | Yes | Yes | N/A** | Yes |
| prompt-scope-questioning.md | Yes | Yes | Yes (inside context) | Yes | Yes | Yes | Yes | Yes | Yes |
| prompt-design-guide.md | Yes | Yes | Yes (inside context) | Yes | Yes | Yes | Yes | Yes | Yes |
| prompt-plan-guide.md | Yes | Yes | Yes (inside context) | Yes | Yes | Yes | Yes | Yes | Yes |
| prompt-task-verifier.md | Yes | Yes | Yes (inside context) | Yes | Yes | Yes | Yes | Yes | Yes |
| prompt-spike-researcher.md | Yes | Yes | Yes (inside context) | Yes | Yes | Yes | Yes | Yes | Yes |

\* Synthesizer has a comment `<!-- No input_data block -- this subagent reads all files itself via <self_contained_reads> -->` which is appropriate.
\** Sufficiency evaluator uses `<self_contained_reads>` instead of `<input_data>` -- it reads files itself.

**Verdict:** All 10 prompt/guide templates comply with the 8-section structure (or have documented justification for structural variation). The 3 `ref-*` files are reference documents, not templates, so the 8-section structure does not apply to them.

### Frontmatter Correctness

| Template | subagent_type | model | Spec Match? |
|----------|--------------|-------|-------------|
| prompt-web-researcher.md | general-purpose | sonnet | Yes |
| prompt-codebase-analyst.md | general-purpose | sonnet | **Partial** -- spec says `subagent_type: "explore"` for codebase (line 565). Implementation uses `general-purpose`. |
| prompt-mcp-researcher.md | general-purpose | sonnet | Yes |
| prompt-research-synthesizer.md | general-purpose | opus | Yes |
| prompt-sufficiency-evaluator.md | general-purpose | sonnet | **Diverged** -- spec says inline (no frontmatter). Implementation has frontmatter as a Task() subagent. |
| prompt-spike-researcher.md | general-purpose | sonnet | N/A (not in spec) |
| prompt-scope-questioning.md | No frontmatter | N/A | Yes (inline guide) |
| prompt-design-guide.md | No frontmatter | N/A | Yes (reference) |
| prompt-plan-guide.md | No frontmatter | N/A | Yes (reference) |
| prompt-task-verifier.md | No frontmatter | N/A | Yes (inline) |

**Key discrepancies:**
1. Codebase analyst uses `general-purpose` instead of spec's `explore`. The spec says "codebase analyst: subagent_type 'explore'" (line 565), but the platform constraint note says "All research subagents must use `subagent_type: 'general-purpose'` for MCP access" (Decision 28). Since codebase analyst doesn't need MCP, `explore` would be valid. Using `general-purpose` is conservative but wastes the explore subagent type's built-in codebase tools.
2. Sufficiency evaluator frontmatter -- addressed in DA-3.

### Placeholder Completeness

Checked all templates for `{{placeholder}}` patterns against dispatching SKILL.md code:

**prompt-web-researcher.md placeholders:** `{{project_name}}`, `{{intent}}`, `{{research_round}}`, `{{output_dir}}`, `{{output_file}}`, `{{batch_id}}`, `{{timestamp}}`, `{{questions_yaml_block}}`. All filled by research SKILL.md Step 8 (lines 339-349).

**prompt-codebase-analyst.md:** Same as web-researcher plus `{{codebase_root}}`. Filled in Step 8 line 347.

**prompt-mcp-researcher.md:** Same as web-researcher plus `{{mcp_sources}}`. Filled in Step 8 line 348.

**prompt-research-synthesizer.md:** `{{project_name}}`, `{{intent}}`, `{{research_round}}`, `{{evidence_dir}}`, `{{scope_file}}`, `{{output_file}}`, `{{timestamp}}`. Filled in Step 17 line 703.

**prompt-sufficiency-evaluator.md:** `{{project_name}}`, `{{intent}}`. Filled in Step 12 lines 512-513.

**prompt-spike-researcher.md:** `{{project_name}}`, `{{intent}}`, `{{tactical_decision}}`, `{{alternatives}}`, `{{da_reference}}`, `{{output_path}}`. Filled in spike SKILL.md Step 5.

**Verdict:** All placeholders have corresponding filling code in the dispatching SKILL.md. Research SKILL.md Step 8 includes a verification step (lines 350-354): scan for remaining `{{` patterns after replacement, excluding code-block examples.

### Intent Lens Implementation

All 10 templates include `<if_intent_product>` and `<if_intent_engineering>` conditional blocks. These contain substantive differences:
- Product: user quotes, behavior data, market reports, user value, Given/When/Then
- Engineering: benchmarks, reference implementations, architecture, technical trade-offs, wave ordering

Research SKILL.md Steps 12 and 17 explicitly state "Apply the conditional blocks based on intent."

**Verdict:** Meaningful intent differentiation. Not cosmetic.

### Condensed Return Format

All 6 subagent templates (3 researchers + synthesizer + sufficiency evaluator + spike researcher) specify condensed return formats:
- Researchers: "max 500 tokens" with KEY FINDINGS, CONFIDENCE, SOURCES, GAPS, PROPOSED_QUESTIONS
- Synthesizer: "max 500 tokens" with KEY FINDINGS, DA READINESS, CONFIDENCE, GAPS, CONTRADICTIONS
- Spike researcher: "max 300 tokens" with RECOMMENDATION, RATIONALE, CONFIDENCE, EVIDENCE

Research SKILL.md Step 10 explicitly says "Read the agent's condensed return summary (the ~500 token summary returned by Task(), NOT the full evidence file). This avoids context bloat."

**Verdict:** Complete implementation of condensed return pattern.

---

## DA-7: Research-Engine Comparison

### Research-Engine Structure

The research-engine plugin at `~/.claude/plugins/cache/local/research-engine/0.1.0/` has:
- **plugin.json:** `"name": "research-engine"`, `"version": "0.2.0"`
- **5 skills:** `define-scope`, `research-topic`, `research-gaps`, `check-readiness`, `design-from-research`
- **Multiple reference templates per skill** (e.g., design-from-research has 5 references)

### Pattern Adoption Catalog

| Pattern | Research-Engine | Expedite | Status |
|---------|----------------|----------|--------|
| File-based subagent output | Evidence files written to `.planning/research/` | Evidence files written to `.expedite/research/` | Adopted |
| Per-source templates | Multiple templates per skill | 3 researcher templates (web, codebase, MCP) | Adopted |
| Categorical sufficiency model | COVERED/PARTIAL/NOT COVERED | Same model with same categories | Adopted |
| Lens injection | Intent-based conditional sections | `<if_intent_product>/<if_intent_engineering>` blocks | Adopted |
| Condensed returns | Summary returns from subagents | ~500 token return spec in all templates | Adopted |
| Model tier assignments | Frontmatter-based model specification | Same pattern (sonnet for researchers, opus for synthesis) | Adopted |
| Task() invocation pattern | Task() for parallel research | Same pattern with identical parameters | Adopted |
| SKILL.md as orchestrator | Multi-step SKILL.md with inline instructions | Same but significantly more detailed (707 lines scope vs RE's ~300) | Adopted + enhanced |
| Readiness gating | Separate `check-readiness` skill with rubric | Inline G2 gate with same categorical rubric | Adapted |
| Scope decomposition | Separate `define-scope` skill | `/expedite:scope` skill with enhanced interactive flow | Adopted + enhanced |

### Pattern Adaptation Catalog

| Pattern | Research-Engine Approach | Expedite Adaptation | Assessment |
|---------|------------------------|---------------------|------------|
| Source-affinity batching | Groups questions by category | Groups by source type (web/codebase/MCP) | Improvement -- enables per-source tool specialization |
| Gap-fill re-batching | Separate `research-gaps` skill | Re-batch by DA affinity within research skill (Step 16) | Integration improvement -- no separate skill needed |
| Dynamic question discovery | Not present | Agents propose questions, orchestrator deduplicates and presents for approval | Novel addition |
| Evidence requirements per question | Scope has decision areas but no per-question typed requirements | Each question has specific, checkable evidence requirements | Significant improvement -- typed contracts |
| Depth calibration per DA | Not present | Deep/Standard/Light affects corroboration expectations | Novel quality layer |

### Pattern Divergence Catalog

| Pattern | Research-Engine | Expedite | Assessment |
|---------|----------------|----------|------------|
| Sufficiency evaluation | Separate `check-readiness` skill (subagent, opus) | Inline evaluator dispatched as Task() subagent (sonnet) | Different architecture, similar function. RE uses opus; expedite uses sonnet. |
| Multi-step SKILL.md | Moderate-length SKILL.md files (~300 lines) | Verbose SKILL.md files (500-750 lines) | Expedite's verbosity reduces ambiguity but increases prompt size |
| Gate system | Single readiness gate between research and design | 5 gates (G1-G5) with MUST/SHOULD criteria, escalation, override | Significant expansion |
| Design skill | `design-from-research` with 5 subagent templates (confidence auditor, decision resolver, design reviser, plan synthesizer, plan validator) | Single inline design generation in main session | Simplification -- fewer moving parts, but loses specialized subagent judgment |
| State management | File-based (research-synthesis.md, READINESS.md) but no formal state.yml | Formal state.yml with phase tracking, gate_history, questions array | Major enhancement |

### Novel Additions (Not from Research-Engine)

1. **Spike skill** -- Entirely new concept: pre-execution tactical decision resolution
2. **Tactical decision classification** -- Categorizing plan decisions as resolved/needs-spike
3. **Per-phase execution model** -- Explicit per-phase invocation with collocated artifacts
4. **Contract chain enforcement** -- End-to-end traceability with parenthetical annotations
5. **Override mechanism** -- `--override` flag with severity classification and downstream propagation
6. **Adaptive scope refinement** -- Convergence-loop questioning instead of fixed rounds
7. **Codebase-routed questions** -- Additive questions from codebase analysis
8. **Backup-before-write** -- Crash-recovery state management pattern
9. **Multi-document log.yml** -- Append-only telemetry
10. **Archival flow** -- Lifecycle archival with preservation of persistent files

### Comparative Assessment

**Where expedite improves:**
1. State management is dramatically better -- formal phase tracking, backup-before-write, crash resume
2. Contract chain traceability is novel and valuable -- no equivalent in research-engine
3. Evidence requirements as typed contracts (not just topics) enable mechanical sufficiency checking
4. Gate system with escalation provides structured quality enforcement
5. Dual-intent support (product/engineering) is more integrated than research-engine's mode selection

**Where research-engine patterns could improve expedite:**
1. Research-engine's `design-from-research` uses multiple specialized subagents (confidence auditor, decision resolver) which could produce higher-quality design decisions than expedite's single inline generation
2. Research-engine's separate `check-readiness` skill allows the readiness evaluation to be run independently at any time, while expedite's G2 gate is embedded in the research skill flow

---

## DA-8: Error Handling and Resilience

### Error Handling Table Coverage

| Skill | Spec Error Table | Implementation Coverage | Gaps |
|-------|-----------------|------------------------|------|
| Scope | 6 failure modes | All 6 covered in SKILL.md | None |
| Research | 6 failure modes | All covered across Steps 1, 7, 9, 12, 17 | None |
| Design | 4 failure modes | All covered in Steps 1, 2, 5 | None |
| Plan | Spec does not have explicit error table | Mirrors design's error patterns | N/A |
| Execute | 4 failure modes | All covered in Steps 1, 4c, 5g | None |
| Status | No error table in spec | Handles missing state.yml gracefully | N/A |
| Spike | Not in spec | Step 3 handles missing PLAN.md; Step 8 handles existing SPIKE.md | N/A |

### Agent Failure Recovery (Research Skill)

| Failure Mode | Recovery Implementation | Location |
|-------------|------------------------|----------|
| Single agent failure | Surface to user with retry/skip options | Step 9, lines 387-414 |
| All agents fail | "Report failure, suggest checking source config. Remain in research_in_progress for retry" | Covered by Step 1 Case B resume logic |
| Synthesis agent failure | "verify SYNTHESIS.md exists. If missing, offer re-dispatch via AskUserQuestion" | Step 17 |
| Sufficiency evaluator failure | "If the file is missing, display an error and offer to re-dispatch" | Step 12 |

**Verdict:** All four agent failure modes have explicit recovery paths.

### Template Resolution Failures

All SKILL.md files that read prompt templates include Glob fallback parentheticals: "use Glob with `**/prompt-*.md` if the direct path fails". This was addressed in Phase 13 tech debt closure (TD-3 in MILESTONE-AUDIT.md).

Scope SKILL.md Step 3 (line 159): "If any template file cannot be found via Glob, display: 'Error: Could not find Expedite plugin templates.' Then STOP."

**Verdict:** Covered.

### State Corruption Recovery

1. **Malformed state.yml:** Status skill reads state.yml via `!cat` injection. If the YAML is malformed, the parse would fail. No explicit malformed-YAML handling exists in any SKILL.md. The backup file (state.yml.bak) could be used for recovery, but no skill explicitly falls back to the backup.

2. **state.yml.bak recovery:** The backup file is created before every write but no skill explicitly reads it for recovery. It exists as a manual recovery option (status skill displays its path).

3. **Status skill reconstruction:** Spec (line 925-926) mentions "artifact-based reconstruction" where status reconciles stale state by checking artifact existence. Implementation (status SKILL.md) does NOT include this feature -- it only reads and displays state.yml, with no artifact-based reconciliation.

**Gaps identified:**
- No automatic fallback to state.yml.bak on malformed state.yml
- No artifact-based state reconstruction in status skill (spec feature missing)

### Mid-Session Interruption Recovery

| Skill | Resume Logic | Quality |
|-------|-------------|---------|
| Scope | Step 1 Case B -- checks project_name, questions count to infer progress point | Good |
| Research | Step 1 Case B -- 5-level artifact decision tree for resume point | Excellent |
| Design | Step 1 Case B2 -- checks DESIGN.md existence for resume point | Good |
| Plan | Step 1 Case B2 -- checks PLAN.md existence for resume point | Good |
| Execute | Step 1 Case B -- reads checkpoint.yml for resume | Excellent |
| Spike | No explicit resume -- operates within plan_complete/execute_in_progress | Acceptable (spike is short-lived) |

### Checkpoint Reconstruction Fallback

Execute SKILL.md Step 4c (lines 208-225): If checkpoint.yml is missing but PROGRESS.md exists, parse PROGRESS.md for last completed task ID, reconstruct checkpoint. This is well-implemented.

### Log.yml Corruption

No recovery mechanism exists for log.yml corruption. Since log.yml uses `cat >>` append-only writes, partial writes could leave malformed YAML. The multi-document format (with `---` separators) provides some resilience -- a malformed entry doesn't invalidate the entire file. However, no SKILL.md attempts to parse or validate log.yml before appending.

**Risk assessment:** Low. log.yml is telemetry data, not control flow. Corruption does not affect lifecycle operation.

### Log.yml Size Warning

**Spec (line 928):** "If log.yml exceeds 50 KB: 'Note: log.yml is large ({size}).'"
**Implementation:** Status SKILL.md does NOT include a log.yml size check. This is a missing feature.

### File Write Failures

Scope SKILL.md Step 1 archival flow (line 109): "If any move command fails, warn the user but proceed." Execute SKILL.md Step 7 archival flow (line 560): "If any move command fails, warn but proceed."

No explicit "retry-once-then-display" pattern exists for general file writes. The spec mentions this pattern in the design error handling table, but implementation relies on standard filesystem behavior.

---

## DA-9: Structural Correctness

### Plugin Manifest Comparison

| Field | Spec | Implementation | Delta |
|-------|------|---------------|-------|
| name | `"arc"` | `"expedite"` | **Intentional rename** |
| version | `"1.0.0"` | `"0.1.0"` | **Version discrepancy** (see DA-10) |
| description | Same text | Same text | Match |
| author | `"arc-contributors"` | `{ "name": "Jared Wallenfels" }` | Different format + value |

### Missing Structural Elements

| Element | Spec | Status | Documented? |
|---------|------|--------|-------------|
| `hooks/` directory | Specified | Absent | Yes -- PROJECT.md "Out of Scope": SessionStart hook deferred to v2 |
| `hooks/hooks.json` | Specified | Absent | Same as above |
| `scripts/` directory | Specified | Absent | Same as above |
| `scripts/session-start.sh` | Specified | Absent | Same as above |

### Namespace Migration

Checked all skills and templates for stale `/arc:` references:
- **Grep result:** 0 matches for `/arc:` in `skills/` directory
- All SKILL.md files use `/expedite:` namespace
- All dynamic context injection uses `.expedite/state.yml`
- All artifact paths use `.expedite/` prefix

**Verdict:** Namespace migration is complete. Zero stale references.

### Skill Count

**Spec:** 6 skills (scope, research, design, plan, execute, status)
**Implementation:** 7 skills (scope, research, design, plan, spike, execute, status)

The spike skill is cleanly integrated:
- Has its own `skills/spike/SKILL.md` (472 lines) and `references/prompt-spike-researcher.md`
- Does not interfere with existing skill flows
- Has proper frontmatter, dynamic context injection, and argument-hint
- G5 gate outcomes recorded in gate_history alongside G1-G4

### Directory Structure Consistency

All 7 skills follow the `skills/{name}/SKILL.md` + `references/` pattern:
```
skills/scope/SKILL.md + references/prompt-scope-questioning.md
skills/research/SKILL.md + references/ (8 files: 5 prompts + 3 refs)
skills/design/SKILL.md + references/prompt-design-guide.md
skills/plan/SKILL.md + references/prompt-plan-guide.md
skills/spike/SKILL.md + references/prompt-spike-researcher.md
skills/execute/SKILL.md + references/prompt-task-verifier.md
skills/status/SKILL.md (no references/ -- read-only skill)
```

### SKILL.md Frontmatter Correctness

| Skill | name | description | allowed-tools | argument-hint | Correct? |
|-------|------|-------------|---------------|---------------|----------|
| scope | scope | Trigger phrases present | Read, Write, Glob, Bash, AskUserQuestion | `[project-description]` | Yes |
| research | research | Trigger phrases present | Read, Write, Bash, Glob, Grep, Task, AskUserQuestion, WebSearch, WebFetch | None | Yes |
| design | design | Trigger phrases present, --override noted | Read, Write, Glob, Bash | `[--override]` | Yes |
| plan | plan | Trigger phrases present, --override noted | Read, Write, Glob, Bash | `[--override]` | Yes |
| spike | spike | Trigger phrases present | Read, Write, Glob, Bash, Task, WebSearch, WebFetch | `<phase-number>` | Yes |
| execute | execute | Trigger phrases present | Read, Write, Edit, Glob, Grep, Bash, WebSearch, WebFetch | None | Yes |
| status | status | Trigger phrases present | Read, Glob, Bash | None | Yes |

Note: Research and spike skills include `Task` tool (for subagent dispatch). Execute includes `Edit` (for code changes) and `Grep` (for code search). These tool sets are appropriate for each skill's function.

### Dynamic Context Injection

All 7 SKILL.md files include the dynamic context injection pattern:
```
Current lifecycle state:
!`cat .expedite/state.yml 2>/dev/null || echo "No active lifecycle"`
```

Verified by reading each file's first ~20 lines. Line numbers: scope:18-19, research:20-21, design:17-18, plan:16-17, spike:17-18, execute:19-20, status:14-15.

### Template Directory Completeness

`templates/` contains all 3 required files:
- `state.yml.template` (71 lines)
- `sources.yml.template` (14 lines)
- `gitignore.template` (8 lines)

**Verdict:** Structurally correct. All elements present or documented as intentionally deferred.

---

## DA-10: Production Readiness

### Version Discrepancy

**plugin.json:** `"version": "0.1.0"`
**PROJECT.md:** References "v1.0" throughout, "Shipped v1.0 with 5,563 LOC"
**RETROSPECTIVE.md:** "Milestone: v1.0"
**MILESTONE-AUDIT.md:** Frontmatter `milestone: v1.0`, scores 92/92 requirements

The project considers itself v1.0, but plugin.json says 0.1.0. This is a labeling oversight. The implementation maturity (92/92 requirements, 3 audit cycles, 13 phases) supports a v1.0 label. The 0.1.0 version signals "beta" to consumers despite the project's self-assessment of release quality.

**Recommendation:** Update plugin.json to `"1.0.0"` to match project documentation.

### Deferred Features Classification

| Feature | Spec Status | Actual Status | User Impact | Classification |
|---------|------------|---------------|-------------|----------------|
| HANDOFF.md generation | Decision 6 (Medium confidence) | Code exists in design SKILL.md Step 6 but listed as deferred in PROJECT.md | Medium -- product-intent users lose PM-to-engineering handoff | v1.1 candidate |
| Extended thinking for gates | Decision 4 (no evidence it helps) | Not implemented, documented in PROJECT.md | Low -- gates work without it | v1.1 candidate |
| Configurable model profiles | Implicit in spec (hardcoded is v1) | Not implemented | Low -- hardcoded tiers are appropriate | v2 candidate |
| SessionStart hook | Decision 27 (bugs exist) | Deferred with 2-layer fallback (dynamic injection + /expedite:status) | Medium -- users must manually invoke status or skill | v2 (blocked by bugs) |
| Connected Flow import | Spec lines 1447-1457 | Stub in scope Step 2, reserved fields in state.yml | Low for v1 -- no cross-lifecycle workflows yet | v2 candidate |
| External verifier agent | Memory note | Not implemented | Low -- sufficiency evaluator as subagent serves the function | v1.1 candidate |
| Numeric sufficiency scoring | Decision 25 (categorical preferred) | Not implemented | Low -- categorical works well | v2 if needed |

### SessionStart Hook Absence Impact

The three-layer fallback design is:
1. SessionStart hook (absent)
2. Dynamic `!cat .expedite/state.yml` injection in every SKILL.md (present)
3. `/expedite:status` manual invocation (present)

With the hook absent, the two remaining layers provide:
- **Layer 2 (dynamic injection):** Fires automatically when any `/expedite:*` skill is invoked. This covers the common case (user invokes a skill).
- **Layer 3 (manual status):** Covers the case where user starts a new session and doesn't know what skill to invoke.

**Gap:** If a user starts a new session and types a natural-language request (not a `/expedite:*` command), there is no automatic context injection. The user must either invoke a skill or run `/expedite:status`.

**Impact assessment:** Medium. Workaround exists and is documented.

### HANDOFF.md Generation

Design SKILL.md Step 6 (lines 275-328) contains the complete 9-section HANDOFF.md implementation:
1. Problem Statement
2. Key Decisions (LOCKED)
3. Scope Boundaries
4. Success Metrics
5. User Flows
6. Acceptance Criteria
7. Assumptions and Constraints
8. Suggested Engineering Questions
9. Priority Ranking for Trade-offs

The code is written and ready. PROJECT.md lists it as "Out of Scope" for v1 despite the implementation being present. This appears to be a conservative decision -- the feature is implemented but not officially supported.

**Assessment:** The code exists and appears functional. The deferral may be overly cautious given that the implementation is complete. However, the spec noted "WEAK evidence" for Section 9, so testing before official support is reasonable.

### Source Editing Stub

Scope SKILL.md Step 8 (line 488): "Source editing will be available in a future update."

This means users cannot add/remove MCP sources through the interactive flow. They must manually edit `.expedite/sources.yml`. This is acceptable for v1 since MCP sources require external setup (`.mcp.json` configuration) anyway.

### Task Population Timing

Plan SKILL.md Step 9 (lines 538-539): "NOTE: Do NOT populate the `tasks` array or `current_wave` field in state.yml. These fields exist in the schema but are populated by the execute skill."

Execute SKILL.md Step 3 (lines 136-137): "Populate `tasks` array: enumerate tasks/stories from THIS PHASE ONLY."

This is a deliberate handoff: plan produces PLAN.md as artifact, execute reads PLAN.md and creates task-tracking state. This avoids the plan skill writing per-phase task data to state.yml before the phase is selected.

**Verdict:** Clean handoff design.

### Log.yml Size Management

Status SKILL.md does NOT include the 50KB warning specified in the spec (line 928). This is a missing feature.

**Risk:** Low for v1. The spec estimates <500KB over 100 lifecycles, and single-user workflows are unlikely to approach this.

### .DS_Store Files

Git status shows:
```
?? .DS_Store
?? .planning/.DS_Store
?? skills/.DS_Store
?? skills/research/.DS_Store
?? skills/spike/.DS_Store
```

There is no root `.gitignore` file. The `.expedite/.gitignore` (from `gitignore.template`) only covers the runtime directory. The project root has no `.gitignore` to exclude `.DS_Store`, `.planning/`, or other non-essential files.

**Recommendation:** Add a root `.gitignore` with `.DS_Store` entries.

---

## Production Readiness Summary

### Overall Assessment

The expedite plugin is a comprehensive, well-structured implementation that closely follows its reference specification. Across 29 spec decisions, 21 match exactly, 5 are intentional evolutions with documented rationale, 2 are intentional deferrals, and only 1 represents undocumented drift (sufficiency evaluator architecture).

### Verdict by Category

| Category | Verdict | Confidence |
|----------|---------|------------|
| Design fidelity | Strong -- 21/29 decisions match, 7 intentional divergences, 1 silent drift | High |
| State management | Excellent -- backup-before-write universal, phase transitions correct, `_recycled` elimination clean | High |
| Research orchestration | Strong -- batching, dispatch, synthesis, gap-fill all faithful to spec | High |
| Spike/execute architecture | Productive evolution -- spike fills real gap, per-phase model is clean | High |
| Decision-over-task philosophy | Good -- strongest at scope and spike, weaker at design/plan (approval vs alternatives) | Medium |
| Prompt template architecture | Excellent -- 8-section compliance, complete placeholders, meaningful intent lens | High |
| Research-engine comparison | Strong adoption -- all major patterns adopted, 10+ novel additions | High |
| Error handling | Good -- all spec error modes covered; gaps in state corruption recovery and log.yml size | Medium |
| Structural correctness | Excellent -- clean namespace, consistent patterns, complete directory structure | High |
| Production readiness | Good -- version label mismatch, minor missing features, no blockers | High |

### Production Blockers

None. The plugin has zero blocking issues for production use.

### Cosmetic / Low-Impact Issues

1. **plugin.json version 0.1.0 should be 1.0.0** -- labeling mismatch
2. **No root .gitignore** -- .DS_Store files in git status
3. **Missing log.yml 50KB size warning** in status skill
4. **Missing artifact-based state reconstruction** in status skill
5. **No automatic fallback to state.yml.bak** on corruption
6. **Codebase analyst uses general-purpose instead of explore** subagent type

### Recommended Actions

**Before v1.0.0 label (low effort):**
1. Update `plugin.json` version to `"1.0.0"`
2. Add root `.gitignore` with `.DS_Store` entries
3. Document the sufficiency evaluator architecture decision (Task() subagent vs inline) in PROJECT.md Key Decisions

**v1.1 candidates:**
1. HANDOFF.md generation -- code exists, needs testing and official support
2. Log.yml 50KB size warning in status skill
3. Artifact-based state reconstruction in status skill
4. Codebase analyst subagent_type change to "explore"

**v2 candidates:**
1. SessionStart hook (blocked by platform bugs)
2. Connected Flow import
3. Extended thinking for gates (if evidence emerges)

### v1.0.0 Label Recommendation

**Recommended: YES.** The plugin meets all 92 self-defined requirements, has undergone 3 audit cycles with zero remaining gaps, implements the complete lifecycle with crash resilience, and has no production blockers. The 0.1.0 version understates the maturity. Update to 1.0.0.

### Divergence Impact Summary

| Divergence | Type | Impact | Verdict |
|------------|------|--------|---------|
| `_recycled` elimination | Intentional evolution | Positive -- cleaner state model | Keep |
| Sufficiency evaluator as subagent | Silent drift | Neutral-positive -- keeps orchestrator lean | Keep but document |
| Spike skill addition | Intentional evolution | Positive -- fills decision gap | Keep |
| Per-phase execution | Intentional evolution | Positive -- cleaner UX | Keep |
| Adaptive scope refinement | Enhancement | Positive -- better context gathering | Keep |
| Design revision no-limit | Enhancement | Positive -- user agency | Keep |
| HANDOFF.md deferral | Intentional deferral | Neutral -- code exists when ready | Accept |
| Hooks deferral | Intentional deferral | Acceptable -- fallbacks in place | Accept |
| sources.yml schema simplification | Silent drift | Neutral -- map structure works | Accept |
| Codebase-routed questions | Enhancement | Positive -- richer research input | Keep |
