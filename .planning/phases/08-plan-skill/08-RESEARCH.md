# Phase 8: Plan Skill - Research

**Researched:** 2026-03-05
**Domain:** LLM-orchestrated implementation planning from design artifacts
**Confidence:** HIGH

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| PLAN-01 | Plan generated in main session from design artifacts | Follows design skill's inline generation pattern (DSGN-01). SKILL.md reads DESIGN.md + SCOPE.md directly, no Task() dispatch. prompt-plan-guide.md exists as quality reference. |
| PLAN-02 | Design broken into uniform-sized phases (2-5 tactical decisions, 3-8 tasks per phase); engineering uses waves, product uses epics/stories | prompt-plan-guide.md already defines both formats with intent-conditional sections. Phase sizing bounds (2-5 tactical decisions, 3-8 tasks) are new constraints not in the existing template -- SKILL.md must enforce these during generation and gate validation. |
| PLAN-03 | G4 gate validates: every DA covered by a phase, phase sizing within bounds, tactical decisions listed per phase, acceptance criteria trace to design decisions | G4 is structural (GATE-06 classifies G1 and G4 as structural). All criteria are countable/deterministic -- mirrors G1 pattern, not G3's LLM judgment. |
| PLAN-04 | PLAN.md artifact written to `.expedite/plan/PLAN.md` with phase structure including tactical decision tables | Standard artifact path per ARTF-02. Tactical decision tables are a new element not in prompt-plan-guide.md -- must be added to SKILL.md plan format. |
| PLAN-05 | Every Decision Area (DA-1 through DA-N) from scope maps to at least one implementation phase | Same contract chain enforcement as DSGN-08. SKILL.md must enumerate DAs from SCOPE.md, verify each appears in at least one phase's "Design decisions covered" list. G4 MUST criterion. |
| PLAN-06 | Each phase identifies tactical decisions classified as "resolved" (informed by strategic design) or "needs-spike" (requires investigation) | This is the novel element of the plan skill. Each implementation phase must include a tactical decision table where each decision is classified. This classification feeds directly into the spike skill (Phase 9). |
</phase_requirements>

## Summary

Phase 8 implements the plan skill -- the fourth stage in the Expedite lifecycle contract chain. The plan skill reads completed design artifacts (DESIGN.md and SCOPE.md), breaks the design into uniform-sized implementation phases, identifies tactical decisions per phase, and produces PLAN.md with intent-adaptive formatting (waves for engineering, epics/stories for product). The skill runs entirely in the main session (PLAN-01), following the established inline generation pattern from scope and design skills.

The plan skill introduces two concepts not present in earlier skills: (1) **tactical decision identification and classification** -- each implementation phase must list tactical decisions and classify them as "resolved" (the strategic design decision provides enough guidance) or "needs-spike" (the decision requires investigation before implementation), and (2) **phase sizing constraints** -- each phase must contain 2-5 tactical decisions and 3-8 tasks, enforcing uniformity. These concepts are the novel elements; everything else (state transitions, gate evaluation, override context, revision cycle) reuses established patterns.

The G4 gate is structural/deterministic (GATE-06), matching G1's pattern rather than G3's LLM-judgment model. All G4 criteria are countable: DA coverage, phase sizing bounds, tactical decision presence, acceptance criteria traceability. This simplifies the gate implementation significantly compared to G3. The prompt-plan-guide.md reference template already exists from Phase 3 and defines the wave/epic formats, but it needs augmentation with tactical decision tables and phase sizing constraints that were introduced in the requirements after the template was created.

**Primary recommendation:** Implement the plan skill as a ~10-step SKILL.md following the design skill's inline generation pattern. The prompt-plan-guide.md serves as the content quality reference. Augment the existing plan format with tactical decision tables per phase. G4 gate mirrors G1's structural approach (counting, field existence) rather than G3's LLM judgment. Include revision cycle, override context consumption (from design), and override context production (for spike/execute). Plan 1 covers Steps 1-5 (prerequisite check through plan generation), Plan 2 covers Steps 6-8+ (revision cycle, G4 gate, completion).

## Standard Stack

### Core
| Component | Location | Purpose | Why Standard |
|-----------|----------|---------|--------------|
| SKILL.md | `skills/plan/SKILL.md` | Main orchestration script | Established pattern from scope/research/design skills |
| prompt-plan-guide.md | `skills/plan/references/prompt-plan-guide.md` | Content quality reference | Already created in Phase 3 (TMPL-06) |
| state.yml | `.expedite/state.yml` | Phase tracking, gate history | Established state management from Phase 2 |

### Supporting
| Component | Location | Purpose | When to Use |
|-----------|----------|---------|-------------|
| DESIGN.md | `.expedite/design/DESIGN.md` | Design decisions to decompose | Read at plan generation start |
| SCOPE.md | `.expedite/scope/SCOPE.md` | DA definitions (for coverage validation) | Read at plan generation start |
| design/override-context.md | `.expedite/design/override-context.md` | G3 override gaps | Read if file exists -- inject gap awareness into plan |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Inline generation (main session) | Task() subagent | Subagent would lose conversation context needed for revision cycle -- user cannot revise a subagent's output interactively (same reasoning as design skill) |
| Structural G4 gate | LLM-judgment gate | G4 criteria are all countable -- LLM judgment adds overhead and bias risk for no benefit (GATE-06 classifies G4 as structural) |
| Revision cycle with freeform | No revision | Plan benefits from user feedback to adjust phase boundaries, task granularity, and tactical decision classification |

## Architecture Patterns

### Recommended Step Structure
```
Step 1:  Prerequisite Check (phase == design_complete)
Step 2:  Read Design + Scope Artifacts
Step 3:  Initialize Plan State (phase -> plan_in_progress)
Step 4:  Generate Implementation Plan (inline, using plan guide as reference)
Step 5:  Write PLAN.md
Step 6:  Revision Cycle (freeform loop until user proceeds to gate)
Step 7:  G4 Gate Evaluation (structural)
Step 8:  Gate Outcome Handling
Step 9:  Plan Completion
```

Note: 9 steps instead of 10. The design skill had separate steps for HANDOFF.md generation and revision cycle. The plan skill does not need a separate artifact generation step -- intent-adaptive formatting (waves vs epics) is handled within the plan generation step (Step 4) itself. If the plan becomes longer in implementation, a 10th step for state.yml task population could be added.

### Pattern 1: Inline Generation with Reference Template
**What:** The SKILL.md contains the full orchestration logic. prompt-plan-guide.md serves as a quality reference that the LLM reads before generating.
**When to use:** For plan generation in Step 4.
**Why this pattern:** Identical to design skill's Pattern 1. Plan requires interactive revision (user must approve phase boundaries and task assignments). Subagent dispatch would prevent this.
**How it works:**
1. SKILL.md Step 2 reads DESIGN.md and SCOPE.md
2. SKILL.md Step 4 reads prompt-plan-guide.md as a reference for structure/quality
3. The LLM generates the plan following the guide's format + the tactical decision table requirements
4. The LLM writes PLAN.md directly
5. User revises via freeform prompt, LLM rewrites

### Pattern 2: Tactical Decision Identification (NEW)
**What:** For each implementation phase, the plan must identify tactical decisions and classify each as "resolved" or "needs-spike."
**When to use:** During plan generation (Step 4) and gate validation (Step 7).
**Why this pattern:** This is the bridge between plan and spike skills. Strategic design decisions (from DESIGN.md) inform high-level direction, but implementation often requires tactical decisions the design did not fully resolve (e.g., "which specific library version to use", "how to handle the migration edge case", "what test strategy to use for this component").
**Classification rules:**
- **Resolved:** The DESIGN.md decision provides enough specificity to implement directly. The design explicitly chose an approach, library, API, or pattern. Examples: "Use PostgreSQL for storage" (DA decided this), "RFC format uses wave-ordered tasks" (design specified format).
- **Needs-spike:** The DESIGN.md decision sets direction but leaves implementation details unresolved. The design chose a general approach but the specific implementation path needs investigation. Examples: "Use caching (but which strategy?)", "Support backward compatibility (but which migration path?)", "Handle concurrent writes (but which locking mechanism?)".
**Table format per phase:**
```markdown
### Tactical Decisions
| ID | Decision | Classification | Source |
|----|----------|----------------|--------|
| TD-1 | Which caching strategy (LRU vs TTL) | needs-spike | DA-3 chose caching, strategy unresolved |
| TD-2 | Use PostgreSQL connection pooling | resolved | DA-2 decision: "Use pgBouncer for connection pooling" |
```

### Pattern 3: Phase Sizing Enforcement
**What:** Each implementation phase must contain 2-5 tactical decisions and 3-8 tasks. Phases outside these bounds trigger gate failure or advisory.
**When to use:** During plan generation (Step 4 self-check) and G4 gate (Step 7).
**Why this pattern:** Uniform sizing ensures each phase is a reasonable unit of work. Too few tasks means the phase is trivial and could be merged. Too many means it should be split. Tactical decision count correlates with complexity -- more than 5 means the phase has too much cognitive load.
**Enforcement:**
- Self-check before writing: verify all phases meet sizing bounds
- G4 gate MUST criterion: phases within bounds (fail if any phase is out of bounds)
- If a phase naturally exceeds bounds, split it into two phases with logical grouping

### Pattern 4: Intent-Adaptive Format with Same Structure
**What:** Engineering intent uses "Wave" / "Task" terminology. Product intent uses "Epic" / "Story" terminology. The underlying data structure is the same: phases containing tasks with design decision traceability and tactical decision tables.
**When to use:** Plan generation (Step 4) and PLAN.md output (Step 5).
**Why this pattern:** PLAN-02 requires the same underlying structure with intent-adaptive presentation. This means the generation logic is shared -- only the headings, terminology, and acceptance criteria format differ.
**Engineering format:**
```markdown
## Wave 1: [description]
Design decisions covered: [DA-X, DA-Y]

### Tactical Decisions
| ID | Decision | Classification | Source |
|----|----------|----------------|--------|
| TD-1 | ... | resolved/needs-spike | DA-X: ... |

### Task t01: [title]
- **Design decision:** DA-X: [brief]
- **Files:** [files to create/modify]
- **Acceptance criteria:**
  - [ ] [criterion] *(traces to DA-X decision: [brief])*
- **Estimated effort:** [hours]
- **Dependencies:** [task IDs or "none"]
```
**Product format:**
```markdown
## Epic 1: [user-facing capability]
Design decisions covered: [DA-X, DA-Y]

### Tactical Decisions
| ID | Decision | Classification | Source |
|----|----------|----------------|--------|
| TD-1 | ... | resolved/needs-spike | DA-X: ... |

### Story 1.1: [title]
**As a** [persona] **I want** [capability] **so that** [outcome]
**Design decision:** DA-X: [brief]
**Acceptance criteria:**
- Given [context], When [action], Then [outcome] *(traces to DA-X decision: [brief])*
**Priority:** P0 | P1 | P2
**Sizing:** S | M | L | XL
```

### Pattern 5: Override Context Consumption and Production
**What:** The plan skill reads design override-context.md (if it exists) and produces its own override-context.md if G4 is overridden.
**When to use:** Step 2 (reading) and Step 8 (writing on override).
**Why this pattern:** GATE-05 requires override context to flow downstream. The design skill may have been overridden (G3 override), meaning some DAs have lower-confidence decisions. The plan must account for this -- tasks tracing to overridden DAs should note the gap. If G4 itself is overridden, the plan's override-context.md flows to spike/execute.
**Reading override context:** If `.expedite/design/override-context.md` exists, read it. For each affected DA, flag tasks in the plan that trace to those DAs with an advisory note.
**Writing override context:** On G4 override, write `.expedite/plan/override-context.md` following the same pattern as design/research override files.

### Pattern 6: Structural Gate (G4 mirrors G1)
**What:** G4 is deterministic -- all criteria are countable/verifiable without LLM judgment.
**When to use:** Step 7 gate evaluation.
**Why this pattern:** GATE-06 classifies G4 as structural. The plan's quality is measurable through counting: DA coverage, phase sizing, tactical decision presence, acceptance criteria traceability. This avoids the self-grading bias risk that G3 faces.

### Anti-Patterns to Avoid
- **Dispatching plan as a subagent:** Plan generation MUST be inline (PLAN-01). Same reasoning as design -- revision cycle requires main session.
- **Using LLM judgment for G4:** G4 is structural (GATE-06). All criteria are countable. Using LLM judgment adds bias risk and complexity for zero benefit.
- **Generating tasks without design decision traceability:** Every task/story MUST cite a specific design decision. Tasks without traceability break the contract chain and fail G4.
- **Skipping tactical decision identification:** This is the primary novel element of the plan skill. Without tactical decision classification, the spike skill (Phase 9) has no input to work with.
- **Ignoring design override context:** If `.expedite/design/override-context.md` exists, the plan must read it and annotate affected tasks. Missing this breaks the GATE-05 flow-through.
- **Hardcoding DA lists:** DAs vary per lifecycle. Plan must enumerate DAs from SCOPE.md at runtime and verify each is covered.
- **Embedding plan-guide content in SKILL.md:** The plan guide is a reference file, read at runtime. Embedding it would add ~170 lines of redundant content to every invocation.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| DA enumeration | Manual DA list | Parse DAs from SCOPE.md at runtime | DA count varies per lifecycle |
| Gate outcome model | New gate framework | Mirror G1's structural model (Go/Go-advisory/Recycle/Override) | GATE-03 mandates these outcomes |
| State transitions | Custom phase management | Established backup-before-write pattern | STATE-02 mandates this |
| Override context format | Custom format | Follow existing override-context.md pattern from research/design | Consistency across phases |
| Recycle escalation messaging | Custom escalation | Adapt ref-recycle-escalation.md pattern | GATE-04 mandates consistent escalation |
| Acceptance criteria format | Custom format | Use plan-guide's traced format (parenthetical DA references) | prompt-plan-guide.md already defines this |
| Phase sizing validation | Ad-hoc checking | Structural counting (same as G1 field-existence checks) | G4 is structural, counting is deterministic |

**Key insight:** The plan skill's truly novel component is tactical decision identification and classification. Everything else (state management, gate outcomes, override handling, recycle escalation, inline generation, revision cycle) already exists in established patterns. The skill is an orchestration script connecting existing infrastructure with one new concept.

## Common Pitfalls

### Pitfall 1: Tactical Decision Granularity
**What goes wrong:** Tactical decisions are either too granular (every implementation detail becomes a tactical decision) or too coarse (important decisions are missed).
**Why it happens:** The boundary between "strategic design decision" and "tactical implementation decision" is fuzzy. A design decision like "use caching" spawns many tactical decisions (strategy, invalidation, TTL, eviction). Without clear guidance, the LLM either lists everything or collapses everything.
**How to avoid:** Provide clear criteria in the SKILL.md: a tactical decision is something that (a) is not fully resolved by the DESIGN.md decision text, (b) affects the implementation approach of at least one task, and (c) has at least two reasonable alternatives. If the DESIGN.md decision specifies the exact approach, it is resolved. If it sets direction but leaves implementation details open, it needs-spike.
**Warning signs:** Phases with 10+ tactical decisions (too granular) or phases with zero tactical decisions when the design left open questions (too coarse).

### Pitfall 2: Phase Sizing Imbalance
**What goes wrong:** Some phases have 2 tasks while others have 12, defeating the "uniform sizing" goal.
**Why it happens:** Design decisions naturally vary in implementation complexity. A simple configuration change (1 task) vs a major architectural component (10 tasks) creates imbalance.
**How to avoid:** The SKILL.md must include explicit sizing guidance: target 3-8 tasks per phase. If a design decision requires 10+ tasks, split across 2 phases with logical grouping (e.g., "Phase 3a: core implementation", "Phase 3b: edge cases and testing"). If a design decision requires only 1 task, group it with related DAs in the same phase.
**Warning signs:** G4 gate reports phases outside the 3-8 task bound.

### Pitfall 3: DA Coverage Gaps
**What goes wrong:** A Decision Area from scope is not covered by any implementation phase.
**Why it happens:** When DAs are cross-cutting (e.g., "error handling", "logging"), they may not naturally map to a single phase and get accidentally omitted.
**How to avoid:** The SKILL.md must enumerate all DAs from SCOPE.md and verify each appears in at least one phase's "Design decisions covered" list before writing PLAN.md. G4 gate MUST-criterion M1 catches this, but the self-check in Step 4 should catch it earlier.
**Warning signs:** G4 reports "Found {N}/{M} DAs covered" where N < M.

### Pitfall 4: Acceptance Criteria Without Traceability
**What goes wrong:** Acceptance criteria are written as generic quality checks ("code is clean", "tests pass") instead of tracing to specific design decisions.
**Why it happens:** The natural tendency is to write acceptance criteria about the task output rather than about the design decision the task implements.
**How to avoid:** The plan guide already mandates parenthetical traceability: `*(traces to DA-X decision: [brief])*`. The SKILL.md self-check must verify every acceptance criterion includes this format. G4 MUST criterion verifies this structurally.
**Warning signs:** Acceptance criteria lack parenthetical DA references. G4 reports "{N}/{M} criteria have traceability."

### Pitfall 5: Revision Loop Without Gate Escape
**What goes wrong:** User gets stuck in revision without being offered the gate path.
**Why it happens:** Same issue as design skill (Pitfall 2 from Phase 7 research).
**How to avoid:** Every revision prompt must include both options. Match design skill's Step 7 pattern exactly.
**Warning signs:** User says "done" or "approve" but skill asks for more revisions.

### Pitfall 6: Conflating Plan Phases with Expedite Lifecycle Phases
**What goes wrong:** PLAN.md "phases" (implementation units) are confused with the Expedite lifecycle phases (scope, research, design, plan, execute).
**Why it happens:** The word "phase" is overloaded. PLAN.md breaks the design into implementation phases/waves/epics. The Expedite lifecycle also uses "phase" for its stages.
**How to avoid:** In PLAN.md, use "Wave" (engineering) or "Epic" (product) consistently. Reserve "phase" for Expedite lifecycle stages. In the SKILL.md instructions, be explicit about which "phase" is being referenced.
**Warning signs:** PLAN.md uses "Phase 1, Phase 2" instead of "Wave 1, Wave 2" (engineering) or "Epic 1, Epic 2" (product).

## Code Examples

### Example 1: Prerequisite Check Pattern (matching design skill)
```markdown
### Step 1: Prerequisite Check

Look at the injected lifecycle state above.

**Case A: Phase is "design_complete"**
Display: "Starting plan phase..."
Proceed to Step 2.

**Case B: Phase is "design_recycled" AND `--override` flag is present**
[Override entry path -- read .expedite/design/override-context.md]

**Case C: Phase is anything else**
Display error with current phase, suggest running /expedite:design first.
If phase is "design_recycled", additionally suggest --override flag.
STOP.
```

### Example 2: Tactical Decision Table in Plan Output
```markdown
## Wave 2: Authentication Layer
Design decisions covered: DA-3, DA-5

### Tactical Decisions
| ID | Decision | Classification | Source |
|----|----------|----------------|--------|
| TD-3 | JWT vs session-based token format | resolved | DA-3 decision: "Use JWT for stateless auth" |
| TD-4 | Token refresh strategy (silent vs explicit) | needs-spike | DA-3 chose JWT but refresh approach unresolved |
| TD-5 | Rate limiting implementation | needs-spike | DA-5 mentioned rate limiting, no specific approach chosen |

### Task t04: Implement JWT issuance
- **Design decision:** DA-3: "Use JWT for stateless authentication"
- **Files:** src/auth/jwt.ts, src/auth/types.ts
- **Acceptance criteria:**
  - [ ] JWT tokens include user ID and role claims *(traces to DA-3 decision: "JWT with role-based claims")*
  - [ ] Token expiration set to 1 hour *(traces to DA-3 decision: "Short-lived tokens with refresh")*
- **Estimated effort:** 4 hours
- **Dependencies:** t01 (database schema)
```

### Example 3: G4 MUST Criteria (Structural -- mirrors G1)
```markdown
| # | Criterion | How to Check | Result |
|---|-----------|-------------|--------|
| M1 | Every DA covered by at least one phase | Count DAs in SCOPE.md, count unique DAs in all phase "Design decisions covered" lists. State: "Found {N}/{M} DAs covered" | PASS/FAIL |
| M2 | Phase sizing within bounds | For each phase: count tactical decisions (2-5) and tasks (3-8). State: "Phase {X}: {N} tactical decisions, {M} tasks" for any out-of-bounds | PASS/FAIL |
| M3 | Tactical decisions listed per phase | Each phase has a "Tactical Decisions" table with at least one entry, each classified as resolved/needs-spike. State: "{N}/{M} phases have tactical decision tables" | PASS/FAIL |
| M4 | Acceptance criteria trace to design decisions | Each acceptance criterion includes parenthetical DA reference. State: "{N}/{M} criteria have traceability" | PASS/FAIL |
| M5 | PLAN.md exists and is non-empty | File exists with substantive content. State: "PLAN.md: {line_count} lines" | PASS/FAIL |
```

### Example 4: G4 SHOULD Criteria
```markdown
| # | Criterion | How to Check | Result |
|---|-----------|-------------|--------|
| S1 | Wave/epic ordering is logical | Check that Wave 1 / Epic 1 has no external dependencies, subsequent phases build on prior ones. State reasoning. | PASS/ADVISORY |
| S2 | Effort estimates present (engineering) or sizing present (product) | Check each task/story has effort/sizing. State: "{N}/{M} tasks have estimates" | PASS/ADVISORY |
| S3 | No orphan tasks | Every task traces to at least one DA. State: "{N} tasks without DA reference" | PASS/ADVISORY |
| S4 | Override-affected DAs flagged | If design override-context.md exists, check affected DAs are noted in plan. Auto-PASS if no override. | PASS/ADVISORY |
```

### Example 5: State Transitions for Plan Phase
```yaml
# Forward-only transitions (from state.yml.template):
# design_complete -> plan_in_progress
# plan_in_progress -> plan_complete | plan_recycled
# plan_recycled -> plan_in_progress
# plan_complete -> execute_in_progress
```

### Example 6: Plan Header Format
```markdown
# {Implementation Plan | Product Plan}: {project_name}
Generated: {ISO 8601 UTC timestamp}
Intent: {Engineering | Product}
Source: DESIGN.md + SCOPE.md
Phases: {N} | Tasks: {M} | Tactical Decisions: {K} ({resolved}/{needs-spike})
```

## Prompt-Plan-Guide Gap Analysis

The existing `prompt-plan-guide.md` (created in Phase 3) defines the wave/epic formats and contract chain enforcement but is missing elements introduced by the Phase 8 requirements:

| Element | In prompt-plan-guide.md? | Action Needed |
|---------|--------------------------|---------------|
| Wave/epic format | Yes | No change needed |
| Design decision traceability | Yes | No change needed |
| Acceptance criteria with DA parenthetical | Yes | No change needed |
| Coverage verification (DA -> task) | Yes | No change needed |
| Intent-conditional sections | Yes | No change needed |
| Tactical decision tables | **No** | Add to SKILL.md format guidance (not to prompt-plan-guide.md itself) |
| Phase sizing bounds (2-5 TD, 3-8 tasks) | **No** | Add to SKILL.md self-check and G4 criteria |
| Resolved vs needs-spike classification | **No** | Add to SKILL.md tactical decision format |
| Override context consumption | **No** | Add to SKILL.md Step 2 |

**Recommendation:** Do NOT modify prompt-plan-guide.md. The tactical decision tables, sizing bounds, and override context consumption are orchestration concerns that belong in the SKILL.md, not the reference template. The plan guide focuses on content quality (format, traceability); the SKILL.md focuses on orchestration (state transitions, gate evaluation, sizing enforcement). This maintains the established separation between orchestration (SKILL.md) and content quality (reference templates).

## Revision Cycle Design

The plan revision cycle follows the design skill's pattern (Step 7) but with plan-specific considerations:

**Freeform revision prompt:**
```
Review the plan above. You can:
- **revise** -- describe changes (e.g., "move task t04 to Wave 1", "split Wave 3 into two", "reclassify TD-5 as resolved")
- **proceed** -- run G4 gate evaluation on the current plan

What would you like to do?
```

**Plan-specific revision types:**
- Reorder tasks between phases/waves/epics
- Split or merge phases
- Reclassify tactical decisions (resolved <-> needs-spike)
- Adjust phase boundaries (which DAs are in which phase)
- Add/remove tasks
- Modify acceptance criteria

**After each revision:** Summarize changes, rewrite PLAN.md, verify DA coverage still complete, re-prompt.

## Override Entry Path

Following the design skill's pattern, the plan skill should support a `--override` entry path for when the design phase was recycled (phase == `design_recycled`):

1. Check for `design_recycled` phase with `--override` flag
2. Read `.expedite/design/override-context.md` (must exist)
3. Record override entry in gate_history
4. Display warning about design gaps
5. Proceed to Step 2 with override context loaded

This is identical to the design skill's Step 1 Case B, adapted for design_recycled -> plan_in_progress.

## State Management

### state.yml Updates During Plan Phase
- Step 3: `phase: "plan_in_progress"`, `last_modified: {timestamp}`
- Step 9 (on Go/Go-advisory): `phase: "plan_complete"`, `last_modified: {timestamp}`, gate_history entry
- Step 9 (on Recycle): gate_history entry, phase stays `plan_in_progress`
- Step 9 (on Override): gate_history entry with `overridden: true`, `phase: "plan_complete"`

### What Goes in state.yml vs PLAN.md
- **state.yml:** phase, gate_history, last_modified. The `tasks` array and `current_wave` fields exist in the template but are populated by the execute skill (Phase 9), NOT by the plan skill. The plan skill produces PLAN.md as its artifact; the execute skill reads PLAN.md and populates state.yml's task-tracking fields.
- **PLAN.md:** Full plan with phases, tasks, tactical decisions, acceptance criteria, traceability.

This is consistent with the scope/research/design pattern: SCOPE.md has the full question plan, state.yml has the flat question list for tracking. DESIGN.md has the full design, state.yml has the phase name. PLAN.md has the full plan, state.yml has phase tracking.

## Open Questions

1. **Revision Round Limit**
   - What we know: Design skill has no hard limit (per user decision in Phase 7 CONTEXT.md). No explicit guidance for plan skill.
   - What's unclear: Should plan skill also have no hard limit, or use a soft limit?
   - Recommendation: Follow design skill precedent -- no hard limit. Soft expectation of 1-2 revisions. User proceeds to gate when satisfied.

2. **Tactical Decision ID Namespace**
   - What we know: Questions use q01-qNN, tasks use t01-tNN. Tactical decisions need their own IDs.
   - What's unclear: Should TDs be globally unique (TD-1 through TD-N across all phases) or phase-scoped (each phase starts at TD-1)?
   - Recommendation: Phase-scoped (Wave 1 has TD-1, TD-2; Wave 2 has TD-1, TD-2, TD-3). This parallels how tasks are scoped within waves. For cross-reference, use "Wave 2 TD-1" format. Global IDs (TD-1 through TD-15) create renumbering headaches when phases are reordered.

3. **Populating state.yml tasks Array**
   - What we know: state.yml has a `tasks` array and `current_wave` field. These are used by the execute skill for checkpoint/resume.
   - What's unclear: Should the plan skill populate these, or should execute populate them when it starts?
   - Recommendation: Execute populates them (Phase 9). The plan skill writes PLAN.md as its artifact. Execute reads PLAN.md and creates the tracking state. This keeps the plan skill focused on planning and avoids premature state population that might be invalidated by spike (Phase 9).

4. **Design Overview/Cross-Cutting in Plan**
   - What we know: DESIGN.md has cross-cutting concerns, open questions, and detailed design sections beyond per-DA decisions.
   - What's unclear: Should the plan include tasks for cross-cutting concerns that span multiple DAs?
   - Recommendation: Yes. Cross-cutting concerns from DESIGN.md should be addressed either as tasks within relevant phases or as a dedicated "cross-cutting" phase/wave. Open questions from DESIGN.md should become tactical decisions classified as "needs-spike" in the relevant phase.

## Sources

### Primary (HIGH confidence)
- Existing codebase: `skills/plan/SKILL.md` -- current stub, 27 lines
- Existing codebase: `skills/plan/references/prompt-plan-guide.md` -- 172 lines defining plan format, intent-conditional sections, quality checklist
- Existing codebase: `skills/design/SKILL.md` -- 475 lines of established orchestration patterns (prerequisite check, artifact loading, state transitions, inline generation, revision cycle, gate evaluation, override handling)
- Existing codebase: `skills/scope/SKILL.md` -- 598 lines of established orchestration patterns (inline generation, G1 structural gate, state transitions)
- Existing codebase: `templates/state.yml.template` -- state schema with plan phase transitions already defined (`plan_in_progress`, `plan_complete`, `plan_recycled`, `tasks`, `current_wave`)
- Existing codebase: `skills/research/references/ref-recycle-escalation.md` -- escalation messaging pattern for recycle outcomes
- Existing codebase: `skills/research/references/ref-override-handling.md` -- override recording and context generation pattern
- `.planning/REQUIREMENTS.md` -- PLAN-01 through PLAN-06 requirement definitions

### Secondary (MEDIUM confidence)
- `.planning/ROADMAP.md` -- Phase 8 description, success criteria, and relationship to Phase 9 (spike/execute)
- `.planning/phases/07-design-skill/07-RESEARCH.md` -- Phase 7 research establishing patterns this phase follows
- `.planning/phases/07-design-skill/07-01-PLAN.md` and `07-03-PLAN.md` -- Plan format examples from Phase 7

### Tertiary (LOW confidence)
- None -- all findings based on existing codebase and requirements

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all components already exist in the codebase; this phase wires them together with one new concept (tactical decisions)
- Architecture: HIGH -- step structure follows established patterns from scope, research, and design skills
- Pitfalls: HIGH -- pitfalls identified from direct analysis of existing skill implementations and gate patterns
- Tactical decision classification: MEDIUM -- this is the novel concept with no prior art in the codebase; the resolved/needs-spike taxonomy is reasonable but untested

**Research date:** 2026-03-05
**Valid until:** Indefinite -- this is an internal codebase analysis, not dependent on external library versions
