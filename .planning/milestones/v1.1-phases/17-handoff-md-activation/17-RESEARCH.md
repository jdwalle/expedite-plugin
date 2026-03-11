# Phase 17: HANDOFF.md Activation - Research

**Researched:** 2026-03-10
**Domain:** Design skill HANDOFF.md generation, G3 gate S4 criterion, product-intent lifecycle, PROJECT.md documentation
**Confidence:** HIGH

## Summary

Phase 17 activates an already-implemented but officially unsupported feature: HANDOFF.md generation for product-intent lifecycles. The design SKILL.md (475 lines, 10 steps) already contains complete implementation for HANDOFF.md at Step 6 (9-section generation with ~1500 word target), Step 7 (revision cycle with HANDOFF.md-aware updates), and Step 8 (G3 gate S4 criterion checking HANDOFF.md existence for product intent). The audit (AUDIT-ACTIONS.md ACCEPT-6) explicitly documented this situation: "Complete 9-section implementation exists in design SKILL.md Step 6 but is not officially supported. Product-intent users lose the PM-to-engineering handoff artifact."

The primary work for this phase is therefore NOT implementing new SKILL.md logic but rather: (1) verifying the existing implementation works end-to-end through manual testing of a product-intent lifecycle, (2) confirming the revision cycle correctly propagates changes to HANDOFF.md, (3) confirming G3 S4 evaluates correctly, and (4) updating PROJECT.md to move HANDOFF.md from Out of Scope to a validated feature. There are also minor gaps to address: the design skill's resume logic (Case B2) does not check for HANDOFF.md when determining resume point, and the status skill's artifact cross-reference does not include HANDOFF.md for product-intent lifecycles.

**Primary recommendation:** This is a verification-and-documentation phase, not a feature-building phase. The plan should focus on testing the existing HANDOFF.md flow, fixing the two identified gaps (resume logic, status artifact cross-reference), and updating PROJECT.md. Avoid rewriting existing SKILL.md logic that already works.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| HAND-01 | Design skill Step 6 HANDOFF.md generation works end-to-end for product-intent lifecycles | Implementation already exists at design SKILL.md lines 304-364. Verification requires running a product-intent lifecycle through design phase. No code changes expected unless testing reveals bugs. |
| HAND-02 | Design revision cycle (Step 7) handles HANDOFF.md-specific revision requests | Implementation exists at design SKILL.md line 408: "If product intent AND changes affect sections mirrored in HANDOFF.md...also rewrite HANDOFF.md with corresponding updates." Revision prompt at line 383 mentions HANDOFF.md for product intent. Verification required. |
| HAND-03 | G3 gate S4 criterion validates correctly with HANDOFF.md present | Implementation exists at design SKILL.md line 454: S4 checks `.expedite/design/HANDOFF.md` exists with 9 sections for product intent, auto-PASS for engineering. Verification required. |
| HAND-04 | PROJECT.md updated to reflect HANDOFF.md as officially supported (moved from Out of Scope) | PROJECT.md line 61 currently lists "HANDOFF.md generation -- deferred from v1 (LOW confidence), candidate for v1.1" under Out of Scope. Must be removed from Out of Scope and documented as a validated feature. Key Decisions table line 94 says "Defer LOW-confidence features to v2" mentioning HANDOFF.md -- needs updating. |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| SKILL.md orchestrator | N/A | Design skill instruction set containing HANDOFF.md logic | Claude Code plugin convention -- all skill logic in SKILL.md |
| Write (allowed tool) | N/A | Writing HANDOFF.md and updating PROJECT.md | Already in design skill's allowed-tools list |
| Read (allowed tool) | N/A | Reading DESIGN.md, SCOPE.md, state.yml for HANDOFF.md generation | Already in design skill's allowed-tools list |

### Supporting
No additional libraries or tools needed. All changes use existing allowed tools in existing skills.

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Manual verification of HANDOFF.md flow | Automated test harness | No test infrastructure exists for SKILL.md-level testing; manual verification is the established v1.1 pattern (Phases 14-16 all used manual verification) |

## Architecture Patterns

### Existing Design Skill Structure (Relevant Steps)
```
skills/design/SKILL.md (475 lines, 10 steps)
  Step 1: Prerequisite Check (Case A/B/B2/C routing)
  Step 2: Read Scope + Research Artifacts
  Step 3: Initialize Design State
  Step 4: Generate Design Document
  Step 5: Write DESIGN.md
  Step 6: Generate HANDOFF.md (Product Intent Only)  <-- HAND-01
  Step 7: Revision Cycle (includes HANDOFF.md updates) <-- HAND-02
  Step 8: G3 Gate Evaluation (S4 = HANDOFF.md check)  <-- HAND-03
  Step 9: Gate Outcome Handling
  Step 10: Design Completion
```

### HANDOFF.md Generation Flow (Step 6)
The existing implementation follows this flow:
1. Check `intent` from state.yml
2. If "engineering": skip entirely, display message, proceed to Step 7
3. If "product": Generate 9-section HANDOFF.md distilling DESIGN.md
4. Write to `.expedite/design/HANDOFF.md`
5. Display word count and section count
6. Validate length (HANDOFF.md should be shorter than DESIGN.md)
7. Proceed to Step 7

### HANDOFF.md 9-Section Structure
```
1. Problem Statement (100-150 words, compressed from DESIGN.md)
2. Key Decisions (DA one-liners with confidence, LOCKED constraints)
3. Scope Boundaries (50-100 words)
4. Success Metrics (bulleted list)
5. User Flows (compressed key flows)
6. Acceptance Criteria (Given/When/Then, traces to DAs)
7. Assumptions and Constraints (technical implications)
8. Suggested Engineering Questions (seed for engineering lifecycle)
9. Priority Ranking for Trade-offs (ordered guidance)
```

### Pattern: Intent-Conditional Logic
The design skill uses a consistent pattern for product-vs-engineering branching:
- Step 4: PRD format (product) vs RFC format (engineering)
- Step 6: Generate HANDOFF.md (product) vs skip (engineering)
- Step 7: Revision propagation to HANDOFF.md (product only)
- Step 8 S4: Check HANDOFF.md exists (product) vs auto-PASS (engineering)
- Step 10: List HANDOFF.md in artifacts (product only)

### Anti-Patterns to Avoid
- **Rewriting working SKILL.md logic:** Step 6, 7b, S4 already contain complete HANDOFF.md handling. Do not refactor unless a bug is found during testing.
- **Adding HANDOFF.md to MUST criteria in G3:** S4 is deliberately a SHOULD criterion (advisory, not blocking). Changing this would break the gate outcome model for product-intent lifecycles where HANDOFF.md generation fails.
- **Testing only the happy path:** Must also verify engineering-intent correctly skips HANDOFF.md generation and S4 auto-PASSes.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| HANDOFF.md generation logic | New generation code | Existing Step 6 implementation | Complete 9-section generation already exists with header template, length validation, and cross-references |
| HANDOFF.md revision propagation | New revision tracking | Existing Step 7b rule 5 | Already handles section-mirroring detection for Problem Statement, Key Decisions, Scope Boundaries, Success Metrics, User Flows |
| G3 S4 validation | New gate criterion | Existing S4 in Step 8 | Already checks `.expedite/design/HANDOFF.md` existence with 9 sections for product intent |

**Key insight:** The code already exists. The work is verification, gap-filling (resume logic, status cross-reference), and documentation. Building new HANDOFF.md logic would be duplicating existing implementation.

## Common Pitfalls

### Pitfall 1: Resume Logic Does Not Account for HANDOFF.md
**What goes wrong:** If a product-intent lifecycle crashes after Step 5 (DESIGN.md written) but before Step 6 (HANDOFF.md generation), the resume logic (Case B2) jumps to Step 7 because DESIGN.md exists. HANDOFF.md would be skipped.
**Why it happens:** Case B2 in Step 1 only checks for DESIGN.md existence: "If DESIGN.md exists: Step 5 completed. Resume at Step 7." It does not check whether HANDOFF.md should exist (product intent) and whether it does.
**How to avoid:** Update Case B2 to check: if DESIGN.md exists AND intent is "product" AND HANDOFF.md does NOT exist, resume at Step 6 instead of Step 7. Display: "Found in-progress design with DESIGN.md generated but HANDOFF.md missing. Resuming at HANDOFF.md generation..."
**Warning signs:** Product-intent lifecycle that crashes between Steps 5-6 produces no HANDOFF.md after resume.

### Pitfall 2: PROJECT.md Out of Scope Entry Contradicts Active Section
**What goes wrong:** If only the Out of Scope line is removed but the Key Decisions entry about "Defer LOW-confidence features" is not updated, PROJECT.md contains contradictory information.
**Why it happens:** HANDOFF.md is referenced in multiple places in PROJECT.md: (1) Active requirements list line 42, (2) Target features line 56, (3) Out of Scope line 61, (4) Key Decisions line 94.
**How to avoid:** Update ALL four references: (1) mark as validated in Active, (2) keep in Target features, (3) REMOVE from Out of Scope, (4) update Key Decisions rationale to reflect HANDOFF.md is now validated. Also update the Key Decisions entry text since the rationale ("HANDOFF.md, cross-lifecycle import, locked constraints have weak evidence") bundles HANDOFF.md with other still-deferred features.
**Warning signs:** Contradictory statements about HANDOFF.md in the same document.

### Pitfall 3: Status Skill Artifact Cross-Reference Missing HANDOFF.md
**What goes wrong:** After HANDOFF.md is officially supported, the status skill's artifact cross-reference (Step 5) does not check for it. A product-intent lifecycle at `design_complete` with missing HANDOFF.md would not be flagged as inconsistent.
**Why it happens:** Phase 16 research explicitly deferred adding HANDOFF.md to the cross-reference: "Do NOT include HANDOFF.md in the cross-reference for this phase. Phase 17 is the proper place to add it."
**How to avoid:** Add HANDOFF.md to the status skill's artifact cross-reference with intent-conditional logic. Since HANDOFF.md only exists for product intent, the check must also read state.yml's `intent` field. Format: for `design_complete` and later, if intent is "product", also expect `.expedite/design/HANDOFF.md`.
**Warning signs:** Status skill reports no inconsistencies when HANDOFF.md is missing from a product-intent lifecycle at design_complete or later.

### Pitfall 4: Revision Cycle Not Handling Direct HANDOFF.md Requests
**What goes wrong:** User says "revise HANDOFF.md section 8" and the revision cycle only updates DESIGN.md, not HANDOFF.md.
**Why it happens:** Step 7b rule 5 specifies HANDOFF.md updates only when "changes affect sections mirrored in HANDOFF.md (Problem Statement, Key Decisions, Scope Boundaries, Success Metrics, User Flows)." Direct HANDOFF.md-only revision requests (e.g., "change the priority ranking") may not be caught by this mirroring logic.
**How to avoid:** Verify during testing that the freeform revision prompt interpretation handles HANDOFF.md-specific requests. The existing instruction at 7b says "Parse the user's freeform feedback. Identify which DAs or sections they want changed." This should naturally cover HANDOFF.md sections, but the explicit mirroring list in rule 5 only covers 5 of 9 sections. Sections 6-9 (Acceptance Criteria, Assumptions and Constraints, Suggested Engineering Questions, Priority Ranking) are HANDOFF-only and would need direct HANDOFF.md editing, not DESIGN.md mirroring.
**Warning signs:** User requests changes to HANDOFF.md-only sections and changes are not applied.

### Pitfall 5: Engineering-Intent Lifecycle Incorrectly Affected
**What goes wrong:** Changes meant for product-intent accidentally break engineering-intent flow.
**Why it happens:** All modifications touch code paths that branch on intent. A missing intent guard on any change would affect engineering-intent lifecycles.
**How to avoid:** Every code change must be gated on `intent == "product"`. The status skill cross-reference addition must also check intent, not unconditionally expect HANDOFF.md at design_complete.
**Warning signs:** Engineering-intent lifecycle produces warnings about missing HANDOFF.md.

## Code Examples

### Resume Logic Fix (Design SKILL.md Case B2)
Current code (lines 92-94):
```markdown
2. Check for `.expedite/design/DESIGN.md`:
   - If DESIGN.md exists: Step 5 completed. Resume at Step 7 (revision cycle). Display: "Found in-progress design with DESIGN.md already generated. Resuming at revision cycle..."
   - If DESIGN.md does not exist: Resume at Step 2 (read artifacts, then generate). Display: "Found in-progress design, but no DESIGN.md yet. Resuming from artifact loading..."
```

Updated logic should be:
```markdown
2. Check for `.expedite/design/DESIGN.md`:
   - If DESIGN.md exists AND (intent is "engineering" OR `.expedite/design/HANDOFF.md` exists):
     Step 6 completed. Resume at Step 7 (revision cycle).
     Display: "Found in-progress design with DESIGN.md already generated. Resuming at revision cycle..."
   - If DESIGN.md exists AND intent is "product" AND `.expedite/design/HANDOFF.md` does NOT exist:
     Step 5 completed but Step 6 not yet done. Resume at Step 6 (HANDOFF.md generation).
     Display: "Found in-progress design with DESIGN.md generated but HANDOFF.md missing. Resuming at HANDOFF.md generation..."
   - If DESIGN.md does not exist:
     Resume at Step 2 (read artifacts, then generate).
     Display: "Found in-progress design, but no DESIGN.md yet. Resuming from artifact loading..."
```

### Status Skill Artifact Cross-Reference Update
Current Step 5 mapping (status SKILL.md):
```markdown
   2. Use this mapping to determine which artifacts SHOULD exist:
      - `scope_complete` and later: `.expedite/scope/SCOPE.md`
      - `research_complete` and later: `.expedite/research/SYNTHESIS.md`
      - `design_complete` and later: `.expedite/design/DESIGN.md`
      - `plan_complete` and later: `.expedite/plan/PLAN.md`
```

Updated mapping should add:
```markdown
      - `design_complete` and later, if intent is "product": `.expedite/design/HANDOFF.md`
```

This requires reading `intent` from the parsed state (already extracted in Step 2).

### PROJECT.md Out of Scope Update
Current Out of Scope (line 61):
```markdown
- HANDOFF.md generation -- deferred from v1 (LOW confidence), candidate for v1.1
```

Remove this line entirely. The other items (Cross-lifecycle artifact import, Locked constraints, Extended thinking, SessionStart hook, Mobile/web, Multi-user, Numeric scoring) remain.

### PROJECT.md Key Decisions Update
Current entry (line 94):
```markdown
| Defer LOW-confidence features to v2 | HANDOFF.md, cross-lifecycle import, locked constraints have weak evidence | Good -- kept scope tight |
```

Update to:
```markdown
| Defer LOW-confidence features to v2 | Cross-lifecycle import, locked constraints have weak evidence (HANDOFF.md validated in v1.1) | Good -- kept scope tight |
```

### PROJECT.md Validated Requirements Update
Current Active section (line 42):
```markdown
- [ ] HANDOFF.md official support (testing + PROJECT.md status update)
```

Update to:
```markdown
- [x] HANDOFF.md official support (testing + PROJECT.md status update) -- v1.1
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| HANDOFF.md deferred (Out of Scope) | HANDOFF.md implemented but unsupported | v1.0 (2026-03-05, Phase 7) | Code exists, not validated |
| Not validated | Validated and officially supported | v1.1 Phase 17 (this phase) | Product-intent users get full HANDOFF.md flow |
| Resume logic ignores HANDOFF.md | Resume checks HANDOFF.md for product intent | v1.1 Phase 17 (this phase) | Crash recovery between Steps 5-6 works correctly |
| Status artifact check: 4 artifacts | Status artifact check: 4 + HANDOFF.md (intent-conditional) | v1.1 Phase 17 (this phase) | Status reports missing HANDOFF.md for product-intent |

**Key insight:** This phase transitions HANDOFF.md from "implemented but unsupported" to "validated and documented." The delta is small in terms of code changes but significant for product-intent users.

## Open Questions

1. **Should HANDOFF.md revision support direct edits to HANDOFF-only sections (6-9)?**
   - What we know: Step 7b rule 5 only mirrors 5 of 9 sections (Problem Statement, Key Decisions, Scope Boundaries, Success Metrics, User Flows). Sections 6-9 (Acceptance Criteria, Assumptions and Constraints, Suggested Engineering Questions, Priority Ranking) are HANDOFF-only.
   - What's unclear: Whether the LLM naturally handles "revise HANDOFF.md section 8" through freeform parsing (7b step 1) or whether explicit instruction is needed.
   - Recommendation: Test this scenario during verification. If the LLM does not naturally handle HANDOFF-only section revision, add explicit instruction to Step 7b that recognizes HANDOFF.md-specific revision requests and applies them directly to HANDOFF.md without requiring DESIGN.md changes.

2. **Should the G3 S4 criterion check section count more rigorously?**
   - What we know: S4 says "check `.expedite/design/HANDOFF.md` exists with 9 sections." The current instruction does not specify how to count sections (by heading level, by section name matching).
   - What's unclear: Whether the LLM reliably counts 9 sections or just checks the file exists.
   - Recommendation: Accept the current instruction as-is. The LLM's natural interpretation of "exists with 9 sections" is to scan for the 9 expected headings. Adding more rigorous validation would over-engineer a SHOULD criterion.

## Sources

### Primary (HIGH confidence)
- `skills/design/SKILL.md` -- Full 475-line implementation read. Steps 6, 7, 8, 10 contain complete HANDOFF.md logic. Step 1 Case B2 contains the resume gap.
- `skills/design/references/prompt-design-guide.md` -- Design guide reference with HANDOFF.md section template (lines 94-107).
- `skills/status/SKILL.md` -- Full 167-line implementation read. Step 5 artifact cross-reference confirmed to NOT include HANDOFF.md (Phase 16 research explicitly deferred this).
- `.planning/PROJECT.md` -- Out of Scope line 61 lists HANDOFF.md as deferred. Key Decisions line 94 mentions HANDOFF.md in deferral rationale.
- `.planning/research/expedite-audit/AUDIT-ACTIONS.md` -- ACCEPT-6 documents the deferral rationale: "Complete 9-section implementation exists... but PROJECT.md lists it as Out of Scope for v1."
- `.planning/REQUIREMENTS.md` -- HAND-01 through HAND-04 definitions.
- `templates/state.yml.template` -- Full state schema with intent field.

### Secondary (MEDIUM confidence)
- None needed -- all information from primary codebase sources.

### Tertiary (LOW confidence)
- None.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - No new tools or libraries needed; all changes use existing SKILL.md patterns
- Architecture: HIGH - Existing implementation analyzed line-by-line; gaps identified from direct code comparison
- Pitfalls: HIGH - All 5 pitfalls identified from specific code analysis (resume logic gap at lines 92-94, PROJECT.md multi-reference issue from grep, status cross-reference deferral from Phase 16 research, revision mirroring limitation from line 408, intent guard requirement from branching pattern)

**Research date:** 2026-03-10
**Valid until:** 2026-04-10 (stable -- design skill and status skill conventions unlikely to change within this milestone)
