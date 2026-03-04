# Phase 6: Research Quality and Synthesis - Research

**Researched:** 2026-03-04
**Domain:** Sufficiency evaluation, gate logic, gap-fill orchestration, research synthesis, dynamic question discovery
**Confidence:** HIGH

## Summary

Phase 6 continues the research SKILL.md from where Phase 5 left off (after Step 11), adding the sufficiency assessment, G2 gate, gap-fill recycling loop, dynamic question surfacing, and SYNTHESIS.md generation. The implementation is heavily grounded in existing artifacts: the sufficiency evaluator template (`prompt-sufficiency-evaluator.md`) already defines the 3-dimension categorical rubric with DA depth calibration, and the research synthesizer template (`prompt-research-synthesizer.md`) already specifies the SYNTHESIS.md output format with evidence traceability. The primary work is writing the orchestration steps in SKILL.md that wire these templates into the lifecycle flow.

The architecture follows a clear pipeline: (1) invoke the sufficiency evaluator as an inline reference (not a subagent) to assess each question against its typed evidence requirements, (2) surface dynamic questions from proposed-questions.yml for user approval, (3) run the G2 gate with count-based MUST/SHOULD criteria, (4) if Recycle, pause for user approval then dispatch gap-fill agents for PARTIAL/NOT COVERED questions only, (5) after gate pass, invoke the synthesizer subagent (opus model) to produce SYNTHESIS.md, (6) transition phase to research_complete.

The user's CONTEXT.md decisions constrain key design choices: UNAVAILABLE-SOURCE short-circuits to the user (no gap-fill retry), user approves every recycle, go-with-advisory flows into SYNTHESIS.md, and evaluator agent receives structural separation (evidence + scope only, no dispatch metadata). Claude has discretion on rating approach (independent dimensions with roll-up vs holistic), gap-fill agent prompting strategy, synthesis organization, and advisory placement.

**Primary recommendation:** Add Steps 12-18 to the existing research SKILL.md, following the same linear step pattern established in Steps 1-11 (Phase 5). The sufficiency evaluator runs inline (not as a subagent) since it is a reference template. The synthesizer runs as a Task() subagent since it has frontmatter specifying `model: opus`. Gap-fill recycling re-enters via the existing Phase 5 dispatch pipeline (Steps 4-11) after re-batching by DA.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- UNAVAILABLE-SOURCE short-circuits to the user for a decision (consistent with Phase 5 circuit breaker pattern) -- do not waste gap-fill cycles on genuinely unavailable information
- User leans toward per-question evaluation (each question assessed independently against its evidence requirements), but Claude has discretion to adjust if per-DA grouping produces better results
- User approves every recycle -- each recycle pauses to show what's still missing and asks before running gap-fill
- Go-with-advisory: pause and show the user what's weak, let them decide whether to resolve gaps or proceed. If they proceed, advisory section flows into SYNTHESIS.md
- Override records severity level and injects specific gap context into downstream design prompts so the designer knows what was skipped
- Structural separation for anti-bias: evaluator agent only receives evidence files and scope -- never sees dispatch logic, agent metadata, or research agent reasoning
- Supplements are additive (new evidence alongside originals, nothing overwritten) -- gaps are typically about missing depth, not incorrect information
- Gap-fill agents batched by DA, same as first-round research dispatch
- Dynamic question discovery happens in all rounds (including gap-fill), not just first round -- filling a gap can reveal unexpected areas that matter
- SYNTHESIS.md must explicitly flag contested findings where sources disagree, presenting both sides so the designer can make informed trade-offs

### Claude's Discretion
- Rating approach: independent dimension ratings with roll-up vs holistic judgment -- guided by decision-over-task philosophy and prompt reliability
- DA depth calibration: how Deep vs Light DAs set different bars for scoring
- Gap-fill agent prompting: targeted instructions with evaluator notes vs same template with narrower scope
- SYNTHESIS.md structure: by DA vs by question -- optimize for downstream design quality
- Evidence traceability level in synthesis
- Advisory placement in synthesis (separate section vs inline with DA findings)

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| RSCH-05 | Per-question sufficiency assessed using categorical model: COVERED, PARTIAL, NOT COVERED, UNAVAILABLE-SOURCE | Sufficiency evaluator template already defines the categorical model with per-question YAML output format; evaluator runs inline as reference template (no frontmatter subagent_type); question status values already defined in state.yml schema |
| RSCH-06 | Sufficiency evaluated across 3 dimensions: Coverage, Corroboration, Actionability (each rated Strong/Adequate/Weak/None) | Evaluator template already specifies all 3 dimensions with 4-level ratings and DA depth calibration rules for corroboration thresholds; roll-up logic maps dimension ratings to categorical status |
| RSCH-07 | Dynamic question discovery: subagents propose new questions via `# --- PROPOSED QUESTIONS ---` YAML block | Web researcher template already defines the PROPOSED_QUESTIONS format; Phase 5 Step 10 collects proposals to proposed-questions.yml; Phase 6 needs to deduplicate via LLM judgment and present max 4 to user |
| RSCH-08 | Discovered questions deduplicated via LLM judgment, max 4 presented to user for approval | Deduplication is LLM-based (not string matching) -- orchestrator compares proposed questions against existing question plan semantically; user approval via AskUserQuestion with multi-select |
| RSCH-10 | G2 gate evaluates research sufficiency using count-based criteria (majority COVERED, all P0 COVERED or PARTIAL) | Gate follows GATE-01/GATE-02 pattern from Phase 4 G1: MUST criteria (count-based, deterministic from evaluator output) and SHOULD criteria (advisory); G2 adds LLM judgment (GATE-06) via the sufficiency evaluator |
| RSCH-11 | Recycle triggers gap-fill mode: filters to PARTIAL/NOT COVERED questions, re-batches by decision area | Gap-fill re-batches by DA (user decision) rather than source affinity; uses same dispatch pipeline (Steps 4-11) but with filtered question set; user approves each recycle before dispatch |
| RSCH-12 | Gap-fill agents produce `round-{N}/supplement-*.md` with additive supplement-synthesis | Supplement files are additive (user decision) -- new evidence files alongside originals; naming convention `round-{N}/supplement-{DA}.md`; gap-fill agents receive evaluator's gap_details as additional context |
| RSCH-13 | SYNTHESIS.md artifact written to `.expedite/research/SYNTHESIS.md` after gate pass | Synthesizer template already defines full SYNTHESIS.md format with DA-organized structure, evidence traceability matrix, and cross-cutting findings; runs as opus-model subagent via Task() |
| RSCH-16 | Sufficiency evaluator assesses evidence against the evidence requirements defined in scope (not just general topical coverage) | Evaluator template instructions explicitly require checking evidence against typed requirements (MET/PARTIALLY MET/UNMET per requirement); anti-bias instructions prevent topical-coverage-only assessment |
| GATE-03 | Four gate outcomes: Go, Go-with-advisory, Recycle, Override | G2 gate implements all 4 outcomes; Go-with-advisory pauses for user decision (proceed with advisory in SYNTHESIS.md or fix gaps); Override records severity + injects gap context into downstream prompts |
| GATE-04 | Recycle escalation: 1st informational, 2nd suggest adjustment, 3rd recommend override | Recycle count tracked in state.yml gate_history; escalation messaging changes at each level; 3rd recycle strongly recommends override to prevent infinite loops |
| GATE-07 | Anti-bias instructions in G2/G3 prompts ("evaluate as if someone else produced this") | Evaluator template already contains anti-bias instructions; structural separation ensures evaluator only sees evidence + scope (never dispatch metadata); additional anti-bias instruction in G2 gate prompt |
</phase_requirements>

## Standard Stack

### Core

No external libraries. Phase 6 is implemented entirely within the research SKILL.md using the existing prompt template reference pattern and Task() API.

| Component | Location | Purpose | Why Standard |
|-----------|----------|---------|--------------|
| Sufficiency evaluator | `skills/research/references/prompt-sufficiency-evaluator.md` | Inline reference template for per-question assessment | Already built in Phase 3; no frontmatter (inline, not subagent) |
| Research synthesizer | `skills/research/references/prompt-research-synthesizer.md` | Task() subagent for SYNTHESIS.md generation | Already built in Phase 3; frontmatter: `model: opus`, `subagent_type: general-purpose` |
| State.yml | `.expedite/state.yml` | Per-question status tracking with gate_history | Already defined in Phase 2; question schema includes status, gap_details, evidence_files |
| SCOPE.md | `.expedite/scope/SCOPE.md` | DA depth calibration, evidence requirements, readiness criteria | Already produced by Phase 4 scope skill |

### Supporting

| Component | Purpose | When Used |
|-----------|---------|-----------|
| proposed-questions.yml | Stores dynamically discovered questions from research agents | Read during dynamic question discovery step; written by Phase 5 Step 10 |
| gate_history in state.yml | Tracks G2 outcomes and recycle count for escalation logic | Written after each G2 evaluation; read to determine escalation level |
| round-{N}/supplement-*.md | Additive gap-fill evidence files | Written by gap-fill agents during recycle; read by synthesizer |

## Architecture Patterns

### Pattern 1: Continuing the Step Sequence

Phase 6 adds Steps 12-18 to the existing 11-step research SKILL.md. This follows the established pattern from Phase 4 (scope skill has 9 steps) and Phase 5 (research skill Steps 1-11). Each step has clear entry/exit conditions and proceeds automatically unless user input is required.

**Step sequence for Phase 6:**
- Step 12: Sufficiency Assessment (invoke evaluator inline)
- Step 13: Dynamic Question Discovery (deduplicate, present to user, add approved questions)
- Step 14: G2 Gate Evaluation (count-based criteria from evaluator output)
- Step 15: Gate Outcome Handling (Go / Go-with-advisory / Recycle / Override)
- Step 16: Gap-Fill Dispatch (if Recycle -- re-batch by DA, loop back through Steps 4-11)
- Step 17: Synthesis Generation (invoke synthesizer subagent after gate pass)
- Step 18: Research Completion (transition phase, display summary)

### Pattern 2: Inline Reference vs Subagent Dispatch

The sufficiency evaluator template has NO frontmatter (no `subagent_type`, no `model`). This means it is used as an inline reference -- the orchestrator reads the template, fills placeholders, and applies the evaluation logic directly in the main session. This is consistent with how the scope questioning template works (Phase 3 decision: "Sufficiency evaluator and scope questioning are inline references (no frontmatter) -- not subagents").

The synthesizer template HAS frontmatter (`model: opus`, `subagent_type: general-purpose`). This means it runs as a Task() subagent, dispatched the same way as research agents.

**Why this matters for implementation:** The evaluator's output (per-question YAML ratings) is available immediately in the orchestrator's context for G2 gate logic. No Task() dispatch needed. The synthesizer's output is a large markdown file written to disk by the subagent.

### Pattern 3: Gap-Fill Recycling Loop

When G2 triggers Recycle, the orchestrator:
1. Pauses and shows the user what is still missing (from evaluator gap_details)
2. Gets user approval to proceed with gap-fill
3. Filters questions to PARTIAL/NOT COVERED only
4. Re-batches by Decision Area (user decision -- different from first-round source-affinity batching)
5. Dispatches gap-fill agents through the existing Phase 5 pipeline (Steps 4-11)
6. Gap-fill agents write to `round-{N}/supplement-{DA}.md` (additive, not overwriting)
7. After gap-fill completes, runs sufficiency evaluation again (Step 12) to re-assess
8. Loops until G2 passes or user overrides

**Critical detail:** Gap-fill agents must receive the evaluator's gap_details for their questions so they know what evidence is still missing. This is injected into the same prompt templates used for first-round research, but with narrower question scope and additional context about what was already found.

### Pattern 4: UNAVAILABLE-SOURCE Short-Circuit

UNAVAILABLE-SOURCE questions bypass gap-fill entirely. When the evaluator rates a question as UNAVAILABLE-SOURCE, the orchestrator surfaces this to the user immediately with options:
- Accept and note the gap (flows into SYNTHESIS.md advisory)
- Suggest alternative source
- Override and proceed

This mirrors the Phase 5 circuit breaker pattern where the user decides how to handle source failures rather than automated retry.

### Pattern 5: Go-with-Advisory Flow

When G2 produces Go-with-advisory:
1. Pause and show the user which questions have SHOULD failures (weak areas)
2. User decides: resolve gaps (enters gap-fill) or proceed (advisory flows to synthesis)
3. If proceeding: advisory data is passed to the synthesizer template so SYNTHESIS.md includes an advisory section documenting known weaknesses
4. Override context (if any) is also passed through to downstream design prompts

### Anti-Patterns to Avoid

- **Self-grading bias:** The evaluator must NOT see the dispatch logic, agent metadata, or research agent reasoning -- only evidence files and scope. This structural separation is a locked user decision.
- **Infinite recycle loops:** Recycle escalation (GATE-04) prevents unbounded cycling: 1st informational, 2nd suggests adjustment, 3rd recommends override.
- **Overwriting evidence:** Gap-fill supplements are always additive. Never modify or overwrite original evidence files.
- **Treating preliminary statuses as final:** Phase 5 sets preliminary question statuses. Phase 6 sufficiency evaluator makes the final determination using the full evidence files and typed rubric.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Sufficiency rubric | Custom scoring logic | Existing evaluator template with 3-dimension categorical model | Template already defines dimension ratings, DA depth calibration, roll-up rules, and anti-bias instructions |
| SYNTHESIS.md structure | Custom synthesis format | Existing synthesizer template output format | Template already defines DA-organized structure with evidence traceability matrix, contradictions, and gaps |
| Gate criteria | Ad-hoc pass/fail logic | Count-based MUST/SHOULD criteria pattern from G1 | G1 (Phase 4) established the gate evaluation pattern; G2 follows same structure with different criteria |
| Dynamic question dedup | String matching or regex | LLM judgment (semantic comparison) | Questions can be semantically identical with different wording; string matching produces false negatives |
| Recycle escalation | Manual tracking | state.yml gate_history array with recycle count | gate_history already tracks outcomes with timestamps; count G2 recycle entries to determine escalation level |

**Key insight:** Both the evaluator and synthesizer templates were purpose-built in Phase 3 specifically for Phase 6 consumption. The orchestration code wires them together -- it does not reinvent their logic.

## Common Pitfalls

### Pitfall 1: Evaluator Context Contamination
**What goes wrong:** Evaluator sees dispatch metadata, agent reasoning, or Phase 5 preliminary statuses, biasing its assessment toward confirming what was already assumed.
**Why it happens:** Easy to pass too much context to the evaluator "for completeness."
**How to avoid:** Strict structural separation -- evaluator receives ONLY evidence files and scope artifacts. Strip all Phase 5 metadata from the input.
**Warning signs:** Evaluator ratings suspiciously align with Phase 5 preliminary statuses.

### Pitfall 2: Gap-Fill Without User Approval
**What goes wrong:** Automatic gap-fill dispatch burns tokens on research the user might not need.
**Why it happens:** Temptation to automate the recycle loop for efficiency.
**How to avoid:** Locked user decision: every recycle pauses to show what is missing and asks before running gap-fill.
**Warning signs:** Gap-fill dispatching without a user confirmation step.

### Pitfall 3: Dynamic Question Explosion
**What goes wrong:** Too many proposed questions overwhelm the user or dilute research focus.
**Why it happens:** Each research agent can propose up to 2 questions; with 3-5 agents per round across multiple rounds, proposals accumulate.
**How to avoid:** Cap at 4 new questions per presentation (RSCH-08). Deduplicate across all proposals and against existing questions using LLM judgment. Present once, not per-round.
**Warning signs:** More than 4 new questions being presented, or duplicate questions appearing.

### Pitfall 4: Supplement File Naming Collisions
**What goes wrong:** Gap-fill evidence files overwrite each other or original evidence.
**Why it happens:** Reusing the same naming convention for gap-fill as for first-round.
**How to avoid:** Gap-fill writes to `round-{N}/supplement-{DA}.md` directory structure, completely separate from first-round `evidence-batch-*.md` files.
**Warning signs:** Evidence files being modified rather than new files appearing.

### Pitfall 5: Synthesizer Missing Gap-Fill Evidence
**What goes wrong:** SYNTHESIS.md only incorporates first-round evidence, missing supplement files from gap-fill rounds.
**Why it happens:** Synthesizer receives a hardcoded list of evidence files from round 1 instead of scanning the full evidence directory.
**How to avoid:** Synthesizer template already handles this -- it reads "every file in the evidence directory." Pass the full directory path, not individual file paths. Ensure round-{N}/ subdirectories are included.
**Warning signs:** SYNTHESIS.md does not reference any supplement files after gap-fill rounds.

### Pitfall 6: Override Without Downstream Context Injection
**What goes wrong:** User overrides G2 gate but downstream design phase does not know what was skipped, leading to uninformed design decisions.
**Why it happens:** Override handling only records the outcome in gate_history but does not propagate gap context.
**How to avoid:** Override must record severity level AND inject specific gap context that flows to the design skill prompt. Store override context in state.yml or a dedicated file that the design skill reads.
**Warning signs:** Design decisions being made without awareness of overridden research gaps.

## Code Examples

### Evaluator Input Assembly

The sufficiency evaluator is an inline reference. The orchestrator reads the template, fills placeholders, and applies the assessment logic. Key placeholder assembly:

```
{{questions_with_evidence}} should contain, for each question:
- question_id, question_text, decision_area, da_depth (from SCOPE.md)
- evidence_requirements (from SCOPE.md)
- Full evidence content from the relevant evidence files
- Source status blocks from evidence files
```

The orchestrator must read each evidence file, extract the sections relevant to each question, and bundle them with the question's metadata from SCOPE.md. DA depth comes from SCOPE.md (not state.yml -- DA-level metadata lives only in SCOPE.md per Phase 4 decision).

### G2 Gate MUST/SHOULD Criteria

Following the G1 pattern from Phase 4 (Step 9 of scope SKILL.md):

```
MUST criteria (all must pass for Go):
M1: Every question has been assessed (count assessed == count total)
M2: Majority of questions rated COVERED (covered_count > total / 2)
M3: All P0 questions rated COVERED or PARTIAL (no P0 at NOT_COVERED)
M4: No UNAVAILABLE-SOURCE questions remain unresolved (user has decided on each)

SHOULD criteria (failures produce advisory, not block):
S1: All questions rated COVERED (100% coverage)
S2: No PARTIAL ratings remain
S3: All evidence requirements MET (no PARTIALLY MET)
```

### Gap-Fill Agent Context Injection

Gap-fill agents receive the same prompt template as first-round agents but with additional context:

```
Additional context injected for gap-fill:
- The specific gap_details from the evaluator (which requirements are unmet)
- The existing evidence file path (so agents can read what was already found)
- Instructions to produce ONLY supplement evidence (not duplicate existing findings)
- Output path: .expedite/research/round-{N}/supplement-{DA}.md
```

### Dynamic Question Deduplication

LLM-based deduplication compares each proposed question against the existing question plan:

```
For each proposed question:
1. Compare semantically against all existing questions in state.yml
2. Compare against all other proposed questions (cross-dedup)
3. If semantically equivalent to an existing question: discard
4. If semantically equivalent to another proposal: keep the one with better rationale
5. After dedup, take top 4 by priority (P0 first)
6. Present to user via AskUserQuestion with multi-select
```

### State Transitions

```
Phase 5 leaves state at: research_in_progress
Phase 6 flow:
  research_in_progress -> (sufficiency + G2 gate)
    G2 Go -> research_complete (via synthesis step)
    G2 Go-with-advisory -> (user decides) -> research_complete or gap-fill
    G2 Recycle -> research_recycled -> (gap-fill) -> research_in_progress -> (re-assess)
    G2 Override -> research_complete (with override context)
```

### Synthesizer Invocation

The synthesizer runs as a Task() subagent (has frontmatter):

```
1. Read prompt-research-synthesizer.md template
2. Fill placeholders:
   - {{project_name}}, {{intent}} from state.yml
   - {{research_round}} from state.yml
   - {{evidence_dir}} = ".expedite/research"
   - {{scope_file}} = ".expedite/scope/SCOPE.md"
   - {{output_file}} = ".expedite/research/SYNTHESIS.md"
   - {{timestamp}} = current ISO 8601 UTC
   - {{decision_areas_yaml}} = YAML block of all DAs from SCOPE.md
   - {{evidence_files_list}} = list of all evidence files (including round-N supplements)
   - {{scope_content}} = full SCOPE.md content
3. Dispatch via Task():
   Task(
     prompt: {assembled_prompt},
     description: "Research synthesis: produce SYNTHESIS.md",
     subagent_type: "general-purpose"
   )
4. Verify SYNTHESIS.md was written to .expedite/research/SYNTHESIS.md
```

### Advisory Injection into SYNTHESIS.md

When Go-with-advisory, the synthesizer needs additional context about what is weak:

```
Additional input for advisory case:
- List of SHOULD criteria that failed
- Per-question details for PARTIAL ratings
- User's decision to proceed despite gaps
- These flow into a "## Advisory" section in SYNTHESIS.md
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Numeric scoring (0.0-1.0) | Categorical model (COVERED/PARTIAL/NOT COVERED/UNAVAILABLE-SOURCE) | Design phase | Categorical avoids false precision; numeric scoring deferred to ADV-03 (v2) |
| Source-affinity batching for gap-fill | DA-based batching for gap-fill | CONTEXT.md decision | Gap-fill groups by decision area to focus on completing DA evidence, not by source type |
| Automated retry on recycle | User-approved recycle with escalation | CONTEXT.md decision | User controls token spend; escalation prevents infinite loops |
| Inline self-evaluation for G2 | Structurally separated evaluator | CONTEXT.md decision | Anti-bias: evaluator only sees evidence + scope, never dispatch metadata |

## Open Questions

1. **Advisory placement in SYNTHESIS.md**
   - What we know: Advisory content must flow into SYNTHESIS.md when user proceeds despite weak areas.
   - What is unclear: Whether advisory should be a separate top-level section or inline within each DA's findings.
   - Recommendation: Use a separate `## Advisory` section at the end of SYNTHESIS.md. This keeps the main DA sections clean for the design phase and makes advisory items easy to locate. The design skill prompt can reference this section explicitly.

2. **Gap-fill agent prompting strategy**
   - What we know: Gap-fill agents need the evaluator's gap_details to know what evidence is missing.
   - What is unclear: Whether to inject gap_details as additional context into the same prompt templates or to create a separate gap-fill prompt variant.
   - Recommendation: Use the same prompt templates with additional context injection. This avoids maintaining separate templates and ensures gap-fill agents produce evidence in the same format. Inject gap_details as a new `<gap_context>` block in the input_data section.

3. **Override context storage location**
   - What we know: Override must record severity and inject gap context into downstream design prompts.
   - What is unclear: Whether to store override context in state.yml (keeping all state in one place) or in a separate file.
   - Recommendation: Store minimal override metadata in gate_history (severity, overridden: true) and write detailed gap context to `.expedite/research/override-context.md`. The design skill prompt can read this file if it exists. This respects state.yml's 2-level nesting limit while providing rich override context.

4. **Recycle state transition detail**
   - What we know: state.yml has `research_recycled` as a valid phase transition from `research_in_progress`.
   - What is unclear: Whether gap-fill re-entry goes through `research_recycled -> research_in_progress` or stays at `research_in_progress` throughout.
   - Recommendation: Transition to `research_recycled` when G2 triggers Recycle (records the event), then back to `research_in_progress` when gap-fill dispatch begins. This gives the status skill accurate state reporting and enables crash recovery to distinguish "gap-fill pending user approval" from "gap-fill in progress."

5. **Evidence file discovery for synthesizer**
   - What we know: The synthesizer template says "read every file in the evidence directory."
   - What is unclear: Whether to pass a flat list of evidence file paths or let the synthesizer glob the directory. With round-{N}/ subdirectories, the directory structure is no longer flat.
   - Recommendation: Pass both: an explicit list of all evidence file paths (including round-N supplements) AND the evidence directory path. The list ensures nothing is missed; the directory path enables the synthesizer to verify completeness.

## Sources

### Primary (HIGH confidence)
- `skills/research/references/prompt-sufficiency-evaluator.md` -- Full evaluator template with 3-dimension rubric, DA depth calibration, categorical rating rules, anti-bias instructions, and per-question output format
- `skills/research/references/prompt-research-synthesizer.md` -- Full synthesizer template with SYNTHESIS.md output format, evidence traceability matrix, and quality gate
- `skills/research/SKILL.md` -- Existing 11-step research orchestration (Phase 5) establishing patterns for Phase 6 continuation
- `templates/state.yml.template` -- State schema with question status values, gate_history schema, and phase transition comments
- `skills/scope/SKILL.md` -- G1 gate pattern (Step 9) establishing MUST/SHOULD criteria structure for G2

### Secondary (MEDIUM confidence)
- `skills/research/references/prompt-web-researcher.md` -- PROPOSED_QUESTIONS format and condensed return format used by gap-fill agents
- `.planning/phases/05-research-orchestration-core/05-RESEARCH.md` -- Phase 5 research establishing the orchestration pattern being extended

### Tertiary (LOW confidence)
- None -- all findings grounded in existing project artifacts

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- All components already exist as templates from Phase 3 and state schemas from Phase 2
- Architecture: HIGH -- Follows established step-sequence pattern from Phases 4-5; evaluator/synthesizer templates define input/output contracts
- Pitfalls: HIGH -- Pitfalls derived from user decisions (anti-bias separation, user-approved recycles, additive supplements) and known edge cases in multi-round orchestration

**Research date:** 2026-03-04
**Valid until:** 2026-04-04 (stable -- all components are internal project artifacts, not external dependencies)
