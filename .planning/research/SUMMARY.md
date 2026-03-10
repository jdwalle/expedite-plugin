# Project Research Summary

**Project:** Expedite Plugin v1.1 — Production Polish
**Domain:** Claude Code plugin — internal quality and UX improvements
**Researched:** 2026-03-09
**Confidence:** HIGH

## Executive Summary

Expedite v1.1 is a production polish milestone for an already-shipped Claude Code plugin (5,563 LOC, 13 phases, v1.0 complete). The scope consists of 8 items from a production readiness audit: 3 trivial fixes, 2 medium-complexity feature enhancements (step tracking, gate enforcement), and 3 UX improvements (HANDOFF.md activation, log size warning, state reconstruction). No new technologies, external dependencies, or architectural patterns are introduced. Every change integrates into the existing SKILL.md orchestrator / state.yml / Task() subagent architecture.

The recommended approach is strict blast-radius ordering: ship isolated zero-risk fixes first, then the foundational state schema extension (step tracking), then status skill improvements that benefit from step data, then HANDOFF.md integration testing, and finally gate enforcement changes last because they touch 4 skills and introduce LLM judgment into previously structural gates. This ordering is unanimous across all four research analyses and reflects the primary risk theme: changes that look simple individually but have cross-cutting implications across the codebase.

The two key risks are gate criteria inflation (DEFER-12) and untested integration paths (DEFER-1). Gate enforcement adds substantive DA readiness checks to G2-G5, and if all are shipped as MUST criteria, users will hit excessive Recycle outcomes and learn to bypass gates with `--override`. The mitigation is graduated rollout: G2 as MUST (clear signal from synthesizer), G3 as MUST (evidence should cite right criteria), G4/G5 as SHOULD initially (structural gates gaining judgment). For HANDOFF.md, the code exists but has never been exercised through revision cycles or gate evaluation — full end-to-end testing is the only mitigation.

## Key Findings

### Recommended Stack

No stack changes required. All v1.1 features are internal improvements to existing Markdown/YAML skill files within the Claude Code plugin platform.

**Core technologies (unchanged from v1.0):**
- **SKILL.md orchestrators**: Plugin entry points per skill — proven across 13 phases
- **state.yml**: Flat YAML state with complete-file rewrite + backup-before-write — extended with one new field (`current_step`)
- **Task() subagents**: Parallel research dispatch — no new subagent types needed
- **plugin.json**: Auto-discovery manifest — version bump only

### Expected Features

**Must have (table stakes):**
- FIX-1/2/3: Version label correction, root .gitignore, architecture decision documentation
- DEFER-11: Step-level tracking in state.yml so users know their position within long skills
- DEFER-12: DA readiness criterion enforcement across G2-G5 gates (audit's top structural gap)

**Should have (differentiators):**
- DEFER-1: HANDOFF.md official support for product-intent users (code exists, needs testing)
- DEFER-2: Log.yml 50KB size warning in status skill
- DEFER-3: Artifact-based state reconstruction in status skill

**Defer (v1.2+):**
- Auto .bak fallback (DEFER-4), codebase analyst rename (DEFER-5), alternative-surfacing (DEFER-6), split state.yml (DEFER-10), external verifier (DEFER-13), per-task git commits (DEFER-14), SessionStart hook (DEFER-7), connected flow import (DEFER-8)

### Architecture Approach

All changes integrate into existing architecture without structural modifications. The primary touchpoints are: state.yml schema extension (one new `current_step` field with `skill`, `step`, `label` sub-keys), gate criterion additions in 4 SKILL.md files (research, design, plan, spike), status SKILL.md enhancements (display + warnings + reconstruction), and design SKILL.md activation of existing HANDOFF.md code (lines 275-328).

**Major integration points:**
1. **State schema** — `current_step` field added to state.yml, treated as optional everywhere for backward compatibility with active v1.0 lifecycles
2. **Gate sections** — MUST/SHOULD criteria added inline to existing gate evaluation blocks in 4 skills (not in separate files)
3. **Status skill** — Receives 3 additive enhancements (step display, log size warning, artifact reconstruction), all read-only
4. **Design skill** — No code changes; HANDOFF.md activation is testing + documentation

### Critical Pitfalls

1. **State schema migration (P1)** — Treat `current_step` as optional everywhere with defensive reads and fallbacks. Never depend on it for resume decisions; keep artifact-based inference. No explicit migration needed.
2. **Gate criteria inflation (P2)** — Start G2 enforcement first (simplest). Use SHOULD for G4/G5 initially. Test with real lifecycle before committing to MUST everywhere. A gate that recycles too often trains users to `--override`.
3. **HANDOFF.md "code exists" trap (P3)** — Full end-to-end product-intent test required. Test revision cycle, G3 gate with HANDOFF.md present/absent, and downstream consumer handling. Do not skip testing because the code is already there.
4. **Step write granularity (P4)** — Follow audit spec (write at every step entry) for correctness. Monitor for latency; if step writes cause noticeable slowdown, consider writing only at meaningful transitions.
5. **Status read-only contract (P5)** — Reconstruction reports discrepancies but NEVER writes to state.yml. User decides whether to act.

## Implications for Roadmap

Based on research, suggested 5-phase structure ordered by blast radius (isolated to cross-cutting):

### Phase 1: Quick Fixes
**Rationale:** Zero risk, zero dependencies, immediately shippable. Gets trivial items off the board.
**Delivers:** Correct version label, .gitignore, architecture decision documentation.
**Addresses:** FIX-1, FIX-2, FIX-3
**Avoids:** P8 (.gitignore late addition — must `git rm --cached` tracked .DS_Store files), P9 (version string inconsistency — search codebase for `0.1.0` references), P10 (architecture doc wording — explain spec vs implementation divergence clearly)

### Phase 2: Step-Level Tracking
**Rationale:** Foundational state schema change that benefits all subsequent phases. Step tracking data enriches status improvements (Phase 3) and HANDOFF.md testing (Phase 4). Must land before features that consume step information.
**Delivers:** `current_step` field in state.yml, step-write calls in all 7 SKILL.md files, step display in status skill.
**Addresses:** DEFER-11
**Avoids:** P1 (defensive field access — treat as optional everywhere), P4 (write granularity — follow spec, monitor for latency)

### Phase 3: Status Skill Improvements
**Rationale:** Isolated to a single read-only skill. Benefits from step tracking data (Phase 2). Low blast radius, clear mitigations.
**Delivers:** Log.yml size warning (50KB threshold), artifact-based state reconstruction with discrepancy reporting.
**Addresses:** DEFER-2, DEFER-3
**Avoids:** P5 (read-only contract — report only, never write state), P6 (threshold calibration — use 50KB from spec, informational not blocking), P11 (backward compatibility — additive output, no reorganization)

### Phase 4: HANDOFF.md Activation
**Rationale:** Code already exists (design SKILL.md Step 6, lines 275-328). This is a testing and documentation phase. Benefits from step tracking for orientation during testing. Must complete before gate enforcement changes (Phase 5) modify the design skill's G3 gate.
**Delivers:** Validated HANDOFF.md generation for product-intent users, PROJECT.md status update.
**Addresses:** DEFER-1
**Avoids:** P3 ("code exists" trap — full end-to-end testing through revision cycle, G3 gate, downstream consumers)

### Phase 5: Gate Enforcement
**Rationale:** Widest blast radius — touches 4 SKILL.md files and introduces LLM judgment to previously structural gates. Ships last so all other changes are stable. Graduated rollout (G2 first, then G3, then G4/G5 as SHOULD) is critical.
**Delivers:** DA readiness criterion enforcement across G2-G5 gates.
**Addresses:** DEFER-12
**Avoids:** P2 (mass recycle risk — G4/G5 start as SHOULD, not MUST), P7 (structural vs judgment asymmetry — acknowledge explicitly, use SHOULD to reduce blast radius)

### Phase Ordering Rationale

- **Blast radius ordering:** Isolated changes first, cross-cutting last. This is the unanimous recommendation from all 4 research files.
- **Dependency chain:** Step tracking (Phase 2) produces `current_step` data consumed by status improvements (Phase 3) and enriches HANDOFF.md testing (Phase 4).
- **Gate enforcement last:** DEFER-12 touches the most files and has the highest risk of unintended behavioral changes. All other modifications should be stable before gate logic changes.
- **Testing before enforcement:** HANDOFF.md (Phase 4) should be validated before gate enforcement (Phase 5) modifies the G3 gate that evaluates it.

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 2 (Step Tracking):** Needs analysis of each skill's step structure — research SKILL.md has 18 steps, plan/spike/execute step counts are marked "TBD from skill analysis" in architecture research.
- **Phase 5 (Gate Enforcement):** Needs careful design of readiness criterion matching logic. G3-G5 require LLM judgment for cross-reference checks — the exact criterion wording and evaluation prompts need design attention.

Phases with standard patterns (skip research-phase):
- **Phase 1 (Quick Fixes):** Trivial file changes, no design decisions.
- **Phase 3 (Status Improvements):** Isolated to one read-only skill, clear implementation patterns from architecture research.
- **Phase 4 (HANDOFF.md):** Code exists — this is testing and documentation, not implementation.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | No changes needed — existing stack fully supports v1.1 scope |
| Features | HIGH | All 8 items sourced from production readiness audit with clear definitions |
| Architecture | HIGH | All integration points map to existing code; no novel patterns |
| Pitfalls | HIGH | 11 pitfalls identified with clear mitigations; based on actual codebase analysis |

**Overall confidence:** HIGH

This is an internal polish milestone for a codebase the researchers have full access to. All recommendations derive from direct codebase analysis, not external documentation or community patterns. The v1.0 implementation history (13 phases, 92 requirements) provides strong evidence for the architectural patterns.

### Gaps to Address

- **Plan/spike/execute step counts:** Architecture research marks these as "TBD from skill analysis." Phase 2 planning must analyze these skills to determine step boundaries before implementation.
- **G4/G5 MUST vs SHOULD decision:** Open question from pitfalls research. Recommendation is to start as SHOULD, but the audit originally specified enforcement — this tension needs explicit resolution during Phase 5 planning.
- **Step write latency:** No empirical data on whether 18 state.yml writes per research run causes noticeable latency. May need measurement during Phase 2 execution and adjustment if problematic.

## Sources

### Primary (HIGH confidence)
- Expedite plugin codebase (5,563 LOC) — direct analysis of all 7 skills, state.yml schema, and plugin.json
- `.planning/research/expedite-audit/AUDIT-ACTIONS.md` — production readiness audit source for all v1.1 items
- `.planning/PROJECT.md` — project context, constraints, and key decisions

### Secondary (MEDIUM confidence)
- Claude Code plugin platform conventions — inferred from working v1.0 implementation rather than official documentation

---
*Research completed: 2026-03-09*
*Ready for roadmap: yes*
