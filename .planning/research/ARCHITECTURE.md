# Architecture Research — v1.1 Production Polish

**Date:** 2026-03-09
**Milestone:** v1.1 — audit gap remediation
**Confidence:** HIGH

## Executive Summary

All v1.1 features integrate into the existing plugin architecture without structural changes. The main architectural touchpoints are: (1) state.yml schema extension for step tracking, (2) gate criterion additions in 4 SKILL.md files, (3) status SKILL.md enhancements, and (4) design SKILL.md activation of existing HANDOFF.md code.

## Integration Architecture

### DEFER-11: Step-Level Tracking

**Schema change — state.yml:**
```yaml
current_step:
  skill: "scope"
  step: 5
  label: "Adaptive Refinement"
```

**Write pattern:** Each skill writes `current_step` on entry to each numbered step, using the existing backup-before-write pattern (42 instances already follow this). The field is treated as optional — v1.0 state files without it simply show no step information.

**Skills modified (7):**
- scope/SKILL.md — 9 steps
- research/SKILL.md — 18 steps (most steps, highest benefit)
- design/SKILL.md — 10 steps
- plan/SKILL.md — steps TBD from skill analysis
- spike/SKILL.md — steps TBD from skill analysis
- execute/SKILL.md — steps TBD from skill analysis
- status/SKILL.md — display only (reads current_step, renders "scope: step 5 of 9 — Adaptive Refinement")

**Resume logic impact:** Existing resume logic infers position from artifact presence (e.g., "if questions exist, skip to Step 6"). Step tracking is additive — resume logic stays artifact-based, step tracking provides orientation display. No resume logic changes needed.

### DEFER-12: DA Readiness Enforcement

**Gate-by-gate integration:**

| Gate | Skill | Current Check | New Check | Complexity |
|------|-------|--------------|-----------|-----------|
| G2 | research/SKILL.md | Question coverage counts | Every DA readiness criterion MET in SYNTHESIS.md | Low — synthesizer already outputs MET/NOT MET |
| G3 | design/SKILL.md | DA has section with evidence | Evidence addresses DA's specific readiness criterion | Medium — cross-reference SCOPE.md criteria |
| G4 | plan/SKILL.md | Tasks trace to DAs | Task coverage accounts for DA depth calibration | Medium — Deep vs Light DAs |
| G5 | spike/SKILL.md | Steps trace to TDs/DAs | Spike resolves the specific ambiguity identified | Medium — cross-reference plan's needs-spike |

**Implementation pattern:** Add a MUST criterion to each gate's evaluation section. The criterion references readiness criteria from `.expedite/SCOPE.md` (already generated during scope phase, available via `!cat`).

**Critical design choice:** G2 enforcement is a simple field check (synthesizer output). G3-G5 require LLM judgment to assess whether evidence "addresses" a criterion — this is philosophically consistent with these being LLM-evaluated gates (they already use judgment for MUST/SHOULD evaluation). No structural gate type change.

**Rollout strategy (from pitfalls research):** Start G2 (easiest, highest confidence), then G3, then G4/G5. Consider starting G4/G5 as SHOULD criteria rather than MUST to avoid over-triggering recycle.

### DEFER-1: HANDOFF.md Official Support

**Current state:** Complete 9-section implementation exists at design/SKILL.md Step 6 (lines 275-328). Generates HANDOFF.md with: Executive Summary, Problem Statement, User Research, Requirements, Design Decisions, Technical Architecture, Implementation Roadmap, Success Metrics, Open Questions.

**Activation scope:**
1. End-to-end product-intent testing through the design revision cycle (Step 7) and G3 gate (S4 criterion)
2. Update PROJECT.md: move from "Out of Scope" to "Validated" (or "Active" pending test results)
3. Verify downstream consumers (plan/spike/execute) can read HANDOFF.md
4. Test gate evaluation with HANDOFF.md present

**No code additions** — the implementation is complete. This is a testing + documentation phase.

### DEFER-2: Log.yml Size Warning

**Integration point:** status/SKILL.md, in the telemetry display section.

**Implementation:** Before rendering log.yml telemetry, check file size. If > 50KB, emit warning:
```
⚠ log.yml is [X]KB — consider archiving older entries
```

**Isolated change** — no other skills or state affected.

### DEFER-3: Artifact-Based State Reconstruction

**Integration point:** status/SKILL.md, after reading state.yml.

**Artifact-to-phase mapping:**
| Artifact | Implies Phase |
|----------|-------------|
| `.expedite/SCOPE.md` exists | scope_complete (at minimum) |
| `.expedite/SYNTHESIS.md` exists | research_complete |
| `.expedite/DESIGN.md` or `.expedite/HANDOFF.md` exists | design_complete |
| `.expedite/PLAN.md` exists | plan_complete |
| `.expedite/plan/phases/*/SPIKE.md` exists | spike_complete (for that phase) |

**Behavior:** Compare artifact-implied phase against state.yml `phase` field. If inconsistent, display warning with suggested correction. **Status skill remains read-only** — it reports discrepancies but does not modify state.yml.

### FIX-1/2/3: Quick Fixes

| Fix | File | Change |
|-----|------|--------|
| FIX-1 | `.claude-plugin/plugin.json` | `"version": "0.1.0"` → `"version": "1.0.0"` |
| FIX-2 | `.gitignore` (new root file) | `.DS_Store`, `**/.DS_Store` |
| FIX-3 | `.planning/PROJECT.md` | New Key Decisions row for sufficiency evaluator architecture |

## Suggested Build Order

| Phase | Items | Rationale |
|-------|-------|-----------|
| 1 | FIX-1, FIX-2, FIX-3 | Zero risk, independent, ship immediately |
| 2 | DEFER-11 (step tracking) | Foundation for orientation; benefits DEFER-3 and DEFER-1 testing |
| 3 | DEFER-2, DEFER-3 (status improvements) | Isolated to status skill; DEFER-3 benefits from step data |
| 4 | DEFER-1 (HANDOFF.md) | Integration testing; benefits from step tracking during testing |
| 5 | DEFER-12 (gate enforcement) | Widest blast radius; ship last after all other changes stable |

## Anti-Patterns to Avoid

- **State proliferation:** Don't add per-step data beyond `current_step` — avoid tracking step history, step timing, or step outcomes in state.yml
- **Gate criteria in external files:** Keep gate criteria inline in SKILL.md gate sections — don't create separate gate-criteria files
- **Status writing state:** Status skill must remain read-only — reconstruction reports discrepancies, never auto-fixes
- **Per-step telemetry:** Don't log every step transition to log.yml — only log phase transitions and gate outcomes as today

---
*Research completed: 2026-03-09*
