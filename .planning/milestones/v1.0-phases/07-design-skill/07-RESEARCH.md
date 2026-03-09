# Phase 7: Design Skill - Research

**Researched:** 2026-03-05
**Domain:** LLM-orchestrated design document generation from research evidence
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Each Decision Area section includes: the decision, rationale (trade-offs considered), and supporting evidence references — approximately 200-400 words per DA
- This applies to both RFC (engineering) and PRD (product) formats
- After each revision, summarize what changed before writing the updated file ("Changed DA-3: switched from X to Y. Updated DA-5: added Z consideration.")
- No hard limit on revision rounds — the "up to 2 rounds" requirement is a soft expectation, not a gate. User keeps revising until satisfied, then proceeds to G3 evaluation
- Do not artificially cut the user off from making additional changes
- HANDOFF.md is a distillation that references DESIGN.md for deeper rationale and evidence — not a standalone document
- Engineers reading HANDOFF.md can follow links to DESIGN.md for full context

### Claude's Discretion
- Evidence reference format (inline citations vs evidence tables vs hybrid) — pick what fits the content
- Whether to include a high-level summary/overview section before per-DA decisions
- RFC vs PRD structural template — whether they share structure with different tone, or use fundamentally different layouts
- Revision feedback method — full-document freeform vs section-by-section review
- Skip-to-gate behavior when user approves with no changes
- HANDOFF.md 9-section format — Claude designs appropriate sections for engineer consumption
- HANDOFF.md audience targeting (individual engineer vs team lead)
- Whether HANDOFF.md includes implementation suggestions where research supports them
- G3 gate runner — spawned verifier agent vs inline evaluation
- G3 gate failure handling — auto-fix vs user-prompted
- G3 outcome categories — mirror G2 (Go/Go-with-advisory/Recycle/Override) vs simpler model
- G3 anti-bias approach — explicit bias checklist vs general objectivity instruction

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| DSGN-01 | Design generated in main session (not subagent) from research artifacts | Design runs inline in SKILL.md orchestration — reads SCOPE.md + SYNTHESIS.md directly, no Task() dispatch. Pattern matches scope skill's inline generation (Step 6) rather than research's subagent dispatch. |
| DSGN-02 | Engineering intent produces RFC-style DESIGN.md; product intent produces PRD-style DESIGN.md | Template already exists at `skills/design/references/prompt-design-guide.md` with intent-conditional sections. SKILL.md applies the correct `<if_intent_*>` blocks based on state.yml `intent`. |
| DSGN-03 | Revision cycle: user can request up to 2 rounds of changes before gate evaluation | Per user decision: no hard limit on revision rounds. Soft expectation of ~2. Freeform revision loop with change summary before rewriting. |
| DSGN-04 | Freeform feedback accepted during revision (not AskUserQuestion) | Revision uses freeform prompts (consistent with scope Step 5 adaptive refinement pattern). User types feedback, LLM summarizes changes, rewrites DESIGN.md. |
| DSGN-05 | Product-intent design generates HANDOFF.md with 9-section format for engineer consumption | HANDOFF.md is a distillation referencing DESIGN.md. 9-section format already defined in prompt-design-guide.md. Written to `.expedite/design/HANDOFF.md`. |
| DSGN-06 | G3 gate evaluates design quality with MUST/SHOULD criteria — MUST include "every DA has a decision" and "decisions reference evidence" | G3 mirrors G2 gate outcome model (Go/Go-with-advisory/Recycle/Override). MUST criteria are structural (DA coverage, evidence citations). Anti-bias via explicit checklist. |
| DSGN-07 | DESIGN.md artifact written to `.expedite/design/DESIGN.md` | Standard artifact path per ARTF-02. Directory created in initialization step. |
| DSGN-08 | Every DA from scope has a corresponding design decision — no DA is left without a decision | MUST criterion in G3 gate. SKILL.md must enumerate DAs from SCOPE.md and verify 1:1 mapping in DESIGN.md. |
| DSGN-09 | Each design decision references the supporting evidence from research (which evidence files, which findings justify the decision) | MUST criterion in G3 gate. Evidence citations traced through SYNTHESIS.md back to evidence files. |
</phase_requirements>

## Summary

Phase 7 implements the design skill — the third stage in the Expedite lifecycle contract chain. The design skill reads completed research artifacts (SCOPE.md and SYNTHESIS.md), generates a design document (RFC for engineering intent, PRD for product intent), supports user revision, evaluates quality through the G3 gate, and produces DESIGN.md (plus HANDOFF.md for product intent).

Unlike the research skill which dispatches parallel subagents, the design skill runs entirely in the main session. This is a deliberate architectural choice: design generation requires the LLM to hold the full context of scope + synthesis simultaneously and make coherent cross-DA decisions. The prompt-design-guide.md reference template already exists from Phase 3 and defines the complete document structure, intent-conditional sections, and inline quality checklist.

The primary implementation challenge is orchestrating a multi-step flow (prerequisite check, artifact loading, design generation, revision cycle, gate evaluation, artifact writing) within a single SKILL.md file while maintaining the established patterns from scope and research skills. The design guide template serves as a reference for content quality, but the SKILL.md must orchestrate the full lifecycle including state transitions, revision loops, and gate evaluation.

**Primary recommendation:** Implement the design skill as a ~10-step SKILL.md following the scope skill's inline generation pattern. The prompt-design-guide.md serves as the content quality reference but is NOT dispatched as a subagent — its instructions are embedded directly in the SKILL.md steps. G3 gate mirrors G2's four-outcome model with structural MUST criteria and advisory SHOULD criteria.

## Standard Stack

### Core
| Component | Location | Purpose | Why Standard |
|-----------|----------|---------|--------------|
| SKILL.md | `skills/design/SKILL.md` | Main orchestration script | Established pattern from scope/research skills |
| prompt-design-guide.md | `skills/design/references/prompt-design-guide.md` | Content quality reference | Already created in Phase 3 (TMPL-06) |
| state.yml | `.expedite/state.yml` | Phase tracking, gate history | Established state management from Phase 2 |

### Supporting
| Component | Location | Purpose | When to Use |
|-----------|----------|---------|-------------|
| SCOPE.md | `.expedite/scope/SCOPE.md` | DA definitions, evidence requirements | Read at design generation start |
| SYNTHESIS.md | `.expedite/research/SYNTHESIS.md` | Evidence organized by DA | Read at design generation start |
| override-context.md | `.expedite/research/override-context.md` | G2 override gaps | Read if file exists — inject gap awareness |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Inline generation (main session) | Task() subagent | Subagent would lose conversation context needed for revision loop — user cannot revise a subagent's output interactively |
| Freeform revision | AskUserQuestion structured review | AskUserQuestion limits feedback to predefined options — design feedback is inherently freeform ("change DA-3 to use approach B instead") |
| Full G2-style 4-outcome gate | Simple pass/fail gate | 4-outcome model (Go/Go-advisory/Recycle/Override) matches existing GATE-03 and GATE-04 patterns; simpler model would break consistency |

## Architecture Patterns

### Recommended Step Structure
```
Step 1:  Prerequisite Check (phase == research_complete)
Step 2:  Read Scope + Synthesis Artifacts
Step 3:  Initialize Design State (phase -> design_in_progress)
Step 4:  Generate Design Document (inline, using design guide as reference)
Step 5:  Write DESIGN.md
Step 6:  Write HANDOFF.md (product intent only)
Step 7:  Revision Cycle (freeform loop until user proceeds to gate)
Step 8:  G3 Gate Evaluation
Step 9:  Gate Outcome Handling
Step 10: Design Completion
```

### Pattern 1: Inline Generation with Reference Template
**What:** The SKILL.md contains the full orchestration logic. The prompt-design-guide.md serves as a quality reference that the LLM reads before generating, but is not dispatched as a subagent.
**When to use:** When the generation requires interactive revision (user must be able to give feedback and see changes in the same session).
**Why this pattern:** The scope skill uses this exact pattern — Step 6 reads the questioning guide as a reference, then generates inline. The research skill uses Task() subagents because researchers are independent and don't need user interaction. Design needs revision, so it must be inline.
**How it works:**
1. SKILL.md Step 2 reads SCOPE.md and SYNTHESIS.md
2. SKILL.md Step 4 reads prompt-design-guide.md as a reference for structure/quality
3. The LLM generates the design document following the guide's format requirements
4. The LLM writes DESIGN.md directly (not via subagent)
5. User revises via freeform prompt, LLM rewrites

### Pattern 2: Revision Loop with Change Summary
**What:** After each revision, the LLM summarizes what changed before writing the updated file. No round limit enforced — user decides when to proceed.
**When to use:** For the revision cycle in Step 7.
**Why this pattern:** Per user decision, revisions are soft-limited not hard-limited. The change summary creates an audit trail and confirms the LLM understood the feedback before rewriting.
**How it works:**
```
User gives freeform feedback -> LLM summarizes changes -> LLM rewrites DESIGN.md -> Display summary -> Prompt for more feedback or gate
```
Example change summary:
```
Changes applied:
- DA-3: Switched from REST API to GraphQL based on your feedback about batched queries
- DA-5: Added caching consideration per your note about latency requirements
- Updated trade-offs in DA-3 to reflect new approach
```

### Pattern 3: G3 Gate with Anti-Bias Checklist
**What:** G3 gate uses explicit anti-bias instructions matching the GATE-07 requirement. MUST criteria are structural (countable, deterministic). SHOULD criteria involve quality judgment with anti-bias framing.
**When to use:** Step 8 gate evaluation.
**Why this pattern:** G2 and G3 both require LLM judgment (GATE-06). The anti-bias approach from GATE-07 ("evaluate as if someone else produced this") is already present in prompt-design-guide.md's quality_gate section. G3 extends this with an explicit checklist format.

### Pattern 4: Override Context Flow-Through
**What:** If the research phase produced an override-context.md (G2 was overridden), the design skill reads it and injects awareness into both the generation and the gate evaluation.
**When to use:** Step 2 artifact loading.
**Why this pattern:** The existing override-context.md format (from ref-override-handling.md) includes affected DAs and severity. Design decisions for those DAs should be flagged with lower confidence. This satisfies GATE-05's requirement that override context flows to downstream phases.

### Anti-Patterns to Avoid
- **Dispatching design as a subagent:** Design generation MUST be inline (DSGN-01). Subagent dispatch would prevent the revision cycle from working — user cannot interactively revise a subagent's output.
- **Hard-coding 2 revision rounds:** Per user decision, there is no hard limit. The "up to 2 rounds" in DSGN-03 is a soft expectation. The skill should prompt for "revise or proceed to gate" without counting rounds.
- **Generating HANDOFF.md as standalone:** Per user decision, HANDOFF.md is a distillation that references DESIGN.md. It should not duplicate full rationale — it should point readers to DESIGN.md sections.
- **Running G3 gate before writing artifacts:** Gate must evaluate the written files, not in-memory content. Write DESIGN.md first, then run gate on the artifact.
- **Skipping override-context.md check:** If it exists, it MUST influence design generation and gate evaluation. Missing this breaks the contract chain.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| DA enumeration | Manual DA list in SKILL.md | Parse DAs from SCOPE.md at runtime | DA count varies per lifecycle — hardcoding breaks |
| Evidence citation format | Custom citation system | Follow SYNTHESIS.md's existing `evidence-batch-XX.md Finding N` pattern | Consistency with upstream; design guide already uses this |
| Gate outcome model | New gate framework | Mirror G2's 4-outcome model (Go/Go-advisory/Recycle/Override) | GATE-03 mandates these outcomes; ref-recycle-escalation.md and ref-override-handling.md already exist |
| State transitions | Custom phase management | Use established backup-before-write pattern from scope/research | STATE-02 mandates this pattern |

**Key insight:** The design skill's "novel" components are minimal. Most infrastructure (state management, gate outcomes, override handling, recycle escalation) already exists. The skill is primarily an orchestration script that connects existing pieces.

## Common Pitfalls

### Pitfall 1: Context Window Pressure
**What goes wrong:** Loading SCOPE.md + SYNTHESIS.md + DESIGN.md (for revision) + design guide reference can consume significant context, especially for lifecycles with many DAs and extensive evidence.
**Why it happens:** Design is the first skill that must hold multiple large artifacts simultaneously in the main session (not offloaded to subagents).
**How to avoid:** The SKILL.md should read artifacts efficiently: read SCOPE.md for DA list and readiness criteria (not full question details), read SYNTHESIS.md for per-DA findings (the relevant sections), and read the design guide once before generation. During revision, only re-read the section being revised, not the entire artifact stack.
**Warning signs:** If the design guide template is embedded verbatim into SKILL.md (instead of read as a reference), it will add ~200 lines of redundant content to every invocation.

### Pitfall 2: Revision Loop Without Gate Escape
**What goes wrong:** User gets stuck in infinite revision without being offered the gate evaluation path.
**Why it happens:** The revision prompt doesn't clearly offer "proceed to gate" as an option alongside "revise more."
**How to avoid:** Every revision prompt must include both options: "Describe changes you'd like, or say 'proceed' to run the G3 gate evaluation." Match scope skill Step 6e's review loop pattern.
**Warning signs:** User says "done" or "looks good" but the skill asks for more revisions instead of proceeding to gate.

### Pitfall 3: G3 Gate Self-Grading Bias
**What goes wrong:** The same LLM that generated the design evaluates its own quality, producing inflated pass rates.
**Why it happens:** LLMs tend to evaluate their own output favorably. This is a known issue flagged in GATE-07.
**How to avoid:** G3 evaluation must use explicit anti-bias instructions: "Evaluate as if someone else produced this." Use an explicit checklist where each criterion requires specific evidence from the artifact (not just "yes/no"). Match the pattern from scope's G1 gate (Step 9) where per-criterion evidence is required. Consider spawning a verifier agent for G3 (Claude's discretion item).
**Warning signs:** G3 always passes on first attempt; SHOULD criteria never fail; gate output lacks specific artifact evidence.

### Pitfall 4: HANDOFF.md Duplication
**What goes wrong:** HANDOFF.md becomes a full copy of DESIGN.md instead of a distillation.
**Why it happens:** The 9-section format is comprehensive, and without explicit constraints, the LLM tends to reproduce full content.
**How to avoid:** Per user decision, HANDOFF.md is a distillation that references DESIGN.md. Each section should be concise and include explicit cross-references like "See DESIGN.md Section X for full rationale." Enforce a word budget per section (e.g., 100-200 words each, ~1500 words total vs DESIGN.md's ~2000-4000 words).
**Warning signs:** HANDOFF.md is longer than DESIGN.md; HANDOFF.md doesn't reference DESIGN.md anywhere.

### Pitfall 5: Missing DA in Design
**What goes wrong:** A decision area from scope is accidentally omitted from the design document.
**Why it happens:** When generating a large document, it is easy to lose track of which DAs have been addressed, especially when DAs have similar themes.
**How to avoid:** Before writing DESIGN.md, the skill must enumerate all DAs from SCOPE.md and create a tracking list. After generation, G3 gate MUST-criterion M1 explicitly counts DAs in scope vs DAs with sections in DESIGN.md.
**Warning signs:** DESIGN.md has fewer "### DA-N" sections than SCOPE.md has decision areas.

## Code Examples

### Example 1: Prerequisite Check Pattern (from scope/research skills)
```yaml
# Step 1: Check phase prerequisite
# Look at injected lifecycle state above
# Case A: Phase is NOT "research_complete" -> Error + STOP
# Case B: Phase IS "research_complete" -> Proceed
```
This matches research skill's Step 1 pattern exactly — check for required predecessor phase.

### Example 2: Revision Loop Pattern
```
# After presenting DESIGN.md to user:

Review the design document above. You can:
- **revise** — describe changes you'd like (e.g., "change DA-3 to use approach B")
- **proceed** — run G3 gate evaluation on the current design

# On "revise": apply changes, summarize, rewrite, re-prompt
# On "proceed": move to G3 gate evaluation
```

### Example 3: G3 MUST Criteria (Structural)
```
| # | Criterion | How to Check | Result |
|---|-----------|-------------|--------|
| M1 | Every DA has a design decision | Count DAs in SCOPE.md, count DA sections in DESIGN.md. State: "Found {N}/{M} DAs covered" | PASS/FAIL |
| M2 | Every decision references evidence | For each DA section, check for evidence citations (evidence file references or SYNTHESIS.md finding references). State: "{N}/{M} decisions cite evidence" | PASS/FAIL |
| M3 | Correct format for intent | Check document structure matches PRD (product) or RFC (engineering) required sections from design guide | PASS/FAIL |
| M4 | DESIGN.md exists and is non-empty | File check | PASS/FAIL |
```

### Example 4: G3 SHOULD Criteria (Quality with Anti-Bias)
```
| # | Criterion | How to Check | Result |
|---|-----------|-------------|--------|
| S1 | Trade-offs articulated for each DA | Check each DA section has a trade-offs subsection with substantive content (not just "we chose X") | PASS/ADVISORY |
| S2 | Open questions section is genuine | Check open questions are genuine uncertainties, not manufactured padding | PASS/ADVISORY |
| S3 | Confidence levels assigned per DA | Each DA decision has High/Medium/Low confidence | PASS/ADVISORY |
| S4 | HANDOFF.md exists (product only) | If intent == product, check HANDOFF.md exists with all 9 sections | PASS/ADVISORY |
```

### Example 5: State Transitions for Design Phase
```yaml
# Forward-only transitions (from state.yml.template):
# research_complete -> design_in_progress
# design_in_progress -> design_complete | design_recycled
# design_recycled -> design_in_progress
# design_complete -> plan_in_progress
```

## Discretion Recommendations

The following are recommendations for areas marked as "Claude's Discretion" in CONTEXT.md.

### Evidence Reference Format
**Recommendation: Hybrid approach.** Use inline citations within the decision text (e.g., "Based on evidence-batch-01.md Finding 3, ...") for the primary supporting evidence, plus an evidence summary table at the end of each DA section listing all referenced files. This gives readability (inline) plus traceability (table).

### High-Level Summary Section
**Recommendation: Yes, include a summary.** Add a 3-5 sentence overview before the per-DA decisions. This mirrors SYNTHESIS.md's Executive Summary pattern and helps readers quickly understand the design direction before diving into details.

### RFC vs PRD Structural Template
**Recommendation: Fundamentally different layouts.** The prompt-design-guide.md already defines distinct section lists for each intent. They share the "Design Decisions by DA" core pattern but differ in framing sections. Maintain this — forcing a shared structure would compromise each format's purpose.

### Revision Feedback Method
**Recommendation: Full-document freeform.** User provides open-ended feedback referencing any part of the document (e.g., "change DA-3 to use approach B, and strengthen the caching rationale in DA-5"). This matches the established freeform pattern from scope Step 5 and is simpler than section-by-section review which would require navigation UI.

### Skip-to-Gate Behavior
**Recommendation: Offer skip.** After presenting the design, if the user says "looks good" or "proceed," skip directly to G3 gate without forcing a revision round. The prompt should make this explicit: "revise or proceed."

### HANDOFF.md 9-Section Format
**Recommendation: Use the existing 9 sections from prompt-design-guide.md.** These are already well-defined: Problem Statement, Key Decisions, Scope Boundaries, Success Metrics, User Flows, Acceptance Criteria, Assumptions and Constraints, Suggested Engineering Questions, Priority Ranking for Trade-offs. Target individual engineers as the audience (they are the consumers of a product-to-engineering handoff).

### HANDOFF.md Implementation Suggestions
**Recommendation: Include when evidence supports them.** If SYNTHESIS.md contains specific implementation patterns, libraries, or technical approaches, HANDOFF.md should surface these in the "Suggested Engineering Questions" and "Assumptions and Constraints" sections. Keep them as suggestions, not mandates.

### G3 Gate Runner
**Recommendation: Inline evaluation (not spawned verifier).** Rationale: G3 is structurally simpler than G2. G2 requires reading evidence files across multiple batches — a fresh context is valuable. G3 evaluates a single document (DESIGN.md) against a checklist. The anti-bias instructions in the gate prompt ("evaluate as if someone else produced this") plus the requirement for per-criterion evidence mitigate self-grading bias. Spawning a verifier adds latency and context-switching overhead for limited benefit. If self-grading bias proves problematic in practice, this can be upgraded to a spawned verifier in a future phase.

### G3 Gate Failure Handling
**Recommendation: User-prompted.** On Recycle, show the user which criteria failed and offer options (fix now / override). Do not auto-fix because design decisions require user judgment — the LLM should not unilaterally change a design decision to pass a gate.

### G3 Outcome Categories
**Recommendation: Mirror G2 (Go/Go-with-advisory/Recycle/Override).** This maintains consistency with GATE-03 (four outcomes) and allows reuse of ref-recycle-escalation.md and ref-override-handling.md patterns. The escalation messaging should be adapted for design context (e.g., "design decisions may need evidence" instead of "questions need evidence").

### G3 Anti-Bias Approach
**Recommendation: Explicit bias checklist.** Each MUST and SHOULD criterion requires the evaluator to state specific evidence from the artifact. Pattern: "Criterion: Every DA has a decision. Evidence: Found 5/5 DA sections in DESIGN.md (DA-1 through DA-5)." This matches scope G1's pattern (Step 9) where per-criterion evidence is required. The general instruction "evaluate as if someone else produced this" supplements but does not replace the structural evidence requirement.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Subagent generation | Inline generation | User decision (Phase 7 CONTEXT.md) | DSGN-01 mandates main session generation; enables revision cycle |
| Hard 2-round limit | Soft limit, user-driven | User decision (Phase 7 CONTEXT.md) | No artificial cutoff; user proceeds to gate when satisfied |
| Standalone HANDOFF.md | Distillation referencing DESIGN.md | User decision (Phase 7 CONTEXT.md) | Reduces duplication; engineers follow links for full context |

## Open Questions

1. **G3 Recycle Reference File**
   - What we know: ref-recycle-escalation.md and ref-override-handling.md exist for G2. G3 needs similar escalation messaging.
   - What's unclear: Should G3 reuse the same reference files with design-specific language, or have separate G3-specific reference files?
   - Recommendation: Reuse the existing reference files. The escalation logic (1st informational, 2nd suggest adjustment, 3rd recommend override) is gate-agnostic. The SKILL.md can adapt the messaging context (e.g., "decision areas" instead of "questions") inline.

2. **Design Document Length Guidance**
   - What we know: User locked 200-400 words per DA. For a lifecycle with 5-7 DAs, the Design Decisions section alone would be 1000-2800 words. Adding framing sections (Problem Statement, Goals, etc.) pushes the total to 2000-4000+ words.
   - What's unclear: Is there an upper bound where the document becomes unwieldy for the plan phase to consume?
   - Recommendation: No explicit length cap. The per-DA word budget (200-400) naturally constrains length. If a lifecycle has many DAs (10+), the SKILL.md should surface this to the user during generation as an advisory.

3. **Override Context Propagation to Plan Phase**
   - What we know: GATE-05 requires override context to inject gap awareness into downstream phases. Design reads G2's override-context.md. If G3 is also overridden, should a G3 override-context.md also be produced for the plan phase?
   - What's unclear: The exact mechanism for propagating G3 override context downstream.
   - Recommendation: Yes — write `.expedite/design/override-context.md` on G3 override, following the same format as the research override-context.md. The plan skill (Phase 8) should check for both override files.

## Sources

### Primary (HIGH confidence)
- Existing codebase: `skills/scope/SKILL.md` — 598 lines of established orchestration patterns (prerequisite check, state transitions, revision loops, gate evaluation)
- Existing codebase: `skills/research/SKILL.md` — 612 lines of established orchestration patterns (subagent dispatch, gate evaluation, recycle/override handling)
- Existing codebase: `skills/design/references/prompt-design-guide.md` — 222 lines defining complete design document structure, intent-conditional sections, quality checklist
- Existing codebase: `templates/state.yml.template` — state schema with design phase transitions already defined
- Existing codebase: `skills/research/references/ref-recycle-escalation.md` — escalation messaging pattern
- Existing codebase: `skills/research/references/ref-override-handling.md` — override recording and context generation pattern
- Existing codebase: `skills/research/references/prompt-research-synthesizer.md` — SYNTHESIS.md output format (design skill's input)

### Secondary (MEDIUM confidence)
- `.planning/REQUIREMENTS.md` — DSGN-01 through DSGN-09 requirement definitions
- `.planning/phases/07-design-skill/07-CONTEXT.md` — User decisions from discuss-phase

### Tertiary (LOW confidence)
- None — all findings are based on the existing codebase and user decisions

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all components already exist in the codebase; this phase wires them together
- Architecture: HIGH — step structure follows established patterns from scope and research skills
- Pitfalls: HIGH — pitfalls identified from direct analysis of existing skill implementations and gate patterns

**Research date:** 2026-03-05
**Valid until:** Indefinite — this is an internal codebase analysis, not dependent on external library versions
