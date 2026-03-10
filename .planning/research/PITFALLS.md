# Pitfalls Research — v1.1 Production Polish

**Date:** 2026-03-09
**Milestone:** v1.1 — audit gap remediation
**Confidence:** HIGH

## Executive Summary

11 pitfalls identified across Critical/Moderate/Minor severity. The 3 critical pitfalls all relate to the same theme: changes that look simple on paper but have blast-radius implications across the existing 5,563 LOC codebase. Ordering from isolated → cross-cutting is the primary mitigation strategy.

## Critical Pitfalls

### P1: State Schema Migration — Defensive Field Access

**Risk:** Adding `current_step` to state.yml could break active v1.0 lifecycles if any skill assumes the field exists. State.yml uses complete-file rewrite semantics, so the field appears organically on first v1.1 write — but between v1.0 and first write, the field is absent.

**Prevention:**
- Treat `current_step` as optional everywhere — defensive reads with fallback
- Status skill: display "step: unknown" if field absent (not error)
- Resume logic: never depend on `current_step` for resume decisions — keep artifact-based inference
- No explicit migration needed — complete-rewrite will add the field on first skill invocation

**Phase:** Address in Step Tracking phase (Phase 2)

### P2: Gate Criteria Inflation — Mass Recycle Risk

**Risk:** DEFER-12 adds substantive readiness enforcement to G2-G5. If all new criteria are MUST, users will hit mass Recycle outcomes — especially G3-G5 where readiness checks require LLM judgment against specific criteria text. A gate that recycles too often trains users to use `--override`, defeating the purpose.

**Prevention:**
- Start G2 enforcement first (simplest — synthesizer already outputs MET/NOT MET per DA)
- Use SHOULD for G4/G5 criteria initially (preserves structural gate nature)
- Use semantic matching for readiness criteria (not literal string comparison)
- Test with real lifecycle before committing to MUST everywhere
- Consider: G2 = MUST (clear signal), G3 = MUST (design should cite right evidence), G4/G5 = SHOULD (structural gates gaining judgment)

**Phase:** Address in Gate Enforcement phase (Phase 5)

### P3: HANDOFF.md Activation — "Code Exists" ≠ "Code Works in Context"

**Risk:** HANDOFF.md implementation (design SKILL.md Step 6, lines 275-328) was built but never exercised through the full lifecycle. Untested integration points: revision cycle (Step 7) handling of HANDOFF.md revisions, G3 gate (S4 criterion) validation with HANDOFF.md present, downstream consumers (plan/spike/execute) encountering HANDOFF.md.

**Prevention:**
- Full end-to-end product-intent test before declaring "supported"
- Test the revision cycle with HANDOFF.md-specific revision requests
- Test G3 gate with both HANDOFF.md present and absent
- Verify plan skill handles dual artifacts (DESIGN.md + HANDOFF.md)
- Don't skip testing because "the code is already there"

**Phase:** Address in HANDOFF.md phase (Phase 4)

## Moderate Pitfalls

### P4: Step Write Granularity — Every Step vs Meaningful Transitions

**Risk:** AUDIT-ACTIONS.md says "Update each skill to write step progress on entry to each numbered step." Research SKILL.md has 18 steps — that's 18 state.yml writes per research run. Each write includes backup-before-write, so 36 file operations for step tracking alone.

**Prevention:**
- Follow the audit spec (write at every step entry) for correctness
- But monitor: if step writes cause noticeable latency in real usage, consider writing only at meaningful transitions (step groups)
- Keep writes lightweight — only update `current_step` field, don't rewrite entire state.yml structure

**Phase:** Address in Step Tracking phase (Phase 2)

### P5: Status Reconstruction — Read-Only Contract Violation

**Risk:** DEFER-3 adds artifact-based state reconstruction to the status skill. If reconstruction logic "helpfully" auto-corrects state.yml, it violates the status skill's read-only contract. Other skills assume state.yml is only modified by their own write operations.

**Prevention:**
- Status skill reports discrepancies but NEVER writes to state.yml
- Display format: "⚠ state.yml says `research_in_progress` but SYNTHESIS.md exists — state may be stale"
- User decides whether to act on the discrepancy
- Consider: add a "repair" flag (`/expedite:status --repair`) for explicit user-initiated correction in a future version

**Phase:** Address in Status Improvements phase (Phase 3)

### P6: Log.yml Size Warning Threshold

**Risk:** DEFER-2 specifies 50KB from the spec. This may be too low or too high depending on actual usage patterns. A single lifecycle with 15 research questions could produce significant log entries.

**Prevention:**
- Use 50KB as initial threshold (from spec)
- Make the warning informational, not blocking
- Don't add automatic truncation or archival — just warn

**Phase:** Address in Status Improvements phase (Phase 3)

### P7: Gate Enforcement Asymmetry — Structural vs Judgment Gates

**Risk:** G2 enforcement is a simple field check (synthesizer output says MET/NOT MET). G3-G5 require the gate evaluator (an LLM) to cross-reference 2-3 files and make judgment calls. Adding LLM judgment to structural gates (G4/G5) is philosophically inconsistent with their "structural validation" design.

**Prevention:**
- Acknowledge the asymmetry explicitly in implementation
- G2: Field check (MET/NOT MET from synthesizer) — straightforward
- G3: Evidence citation check — moderate judgment
- G4: Task coverage for DA depth — moderate judgment
- G5: Spike resolution for specific ambiguity — moderate judgment
- Start G4/G5 as SHOULD to reduce blast radius of judgment errors

**Phase:** Address in Gate Enforcement phase (Phase 5)

## Minor Pitfalls

### P8: .gitignore Late Addition

**Risk:** FIX-2 adds .gitignore after 13 phases of development. Existing .DS_Store files are already tracked by git. Simply adding .gitignore won't remove them from tracking.

**Prevention:**
- After creating .gitignore, run `git rm -r --cached .DS_Store` (and any other tracked ignored files)
- Commit the removal separately from the .gitignore addition

**Phase:** Address in Quick Fixes phase (Phase 1)

### P9: Version Bump Signaling

**Risk:** FIX-1 changes plugin.json to 1.0.0, but if any other file references `0.1.0`, inconsistency persists.

**Prevention:**
- Search entire codebase for `0.1.0` references before committing
- Update all references in a single commit

**Phase:** Address in Quick Fixes phase (Phase 1)

### P10: PROJECT.md Key Decisions Entry Wording

**Risk:** FIX-3 documents the sufficiency evaluator architecture decision. If the entry doesn't clearly explain why the spec chose inline but implementation chose Task(), future developers may see it as a mistake rather than an evolution.

**Prevention:**
- Entry should state: spec chose inline (~80K token savings), implementation chose Task() with `<self_contained_reads>` for orchestrator context hygiene, trading token cost for cleaner context. Both approaches are valid; Task() was chosen after implementation experience.

**Phase:** Address in Quick Fixes phase (Phase 1)

### P11: Backward Compatibility of State Display

**Risk:** Enhanced status skill output (step tracking display, reconstruction warnings, size warnings) may confuse users who expect the v1.0 output format.

**Prevention:**
- New information is additive — don't remove or reorganize existing output
- Warnings use established status symbols (⚠ for warnings, ✓ for healthy)
- Step display only appears when `current_step` field exists

**Phase:** Address in Status Improvements phase (Phase 3)

## Recommended Build Order

Based on pitfall analysis, from lowest to highest blast radius:

1. **Quick Fixes** (FIX-1/2/3) — isolated, zero risk, P8/P9/P10 are trivial
2. **Step Tracking** (DEFER-11) — new state field, moderate risk (P1/P4), benefits all subsequent phases
3. **Status Improvements** (DEFER-2/3) — moderate risk (P5/P6/P11), clear mitigations
4. **HANDOFF.md** (DEFER-1) — integration testing required (P3), benefits from step tracking
5. **Gate Enforcement** (DEFER-12) — widest blast radius (P2/P7), should be last

## Open Questions

1. Should `current_step` writes happen at every step entry (audit spec) or only at meaningful transitions? (P4)
2. Should G4/G5 readiness checks be SHOULD criteria (preserving structural gate nature) or MUST criteria (matching audit recommendation)? (P2/P7)

---
*Research completed: 2026-03-09*
