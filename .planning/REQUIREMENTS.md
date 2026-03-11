# Requirements: Expedite Plugin

**Defined:** 2026-03-09
**Core Value:** Developers can run a complete evidence-based lifecycle — from scoping questions through researched design to executable plan — without losing context, skipping steps, or making decisions without evidence.

## v1.1 Requirements

Requirements for v1.1 Production Polish. Each maps to roadmap phases.

### Housekeeping

- [x] **HSKP-01**: plugin.json version reads `1.0.0` (not `0.1.0`)
- [x] **HSKP-02**: Root .gitignore excludes `.DS_Store` recursively; existing tracked `.DS_Store` files removed from git index
- [x] **HSKP-03**: PROJECT.md Key Decisions documents sufficiency evaluator architecture (spec chose inline, implementation chose Task() for context hygiene)

### Step Tracking

- [x] **STEP-01**: state.yml schema includes optional `current_step` field (`skill`, `step`, `label`)
- [x] **STEP-02**: state.yml.template documents the `current_step` field
- [ ] **STEP-03**: Scope skill writes `current_step` on entry to each of its 9 numbered steps
- [ ] **STEP-04**: Research skill writes `current_step` on entry to each numbered step
- [ ] **STEP-05**: Design skill writes `current_step` on entry to each of its 10 numbered steps
- [ ] **STEP-06**: Plan skill writes `current_step` on entry to each numbered step
- [ ] **STEP-07**: Spike skill writes `current_step` on entry to each numbered step
- [ ] **STEP-08**: Execute skill writes `current_step` on entry to each numbered step
- [x] **STEP-09**: Status skill displays current step ("scope: step 5 of 9 — Adaptive Refinement") when `current_step` field exists; gracefully omits when absent

### Status Improvements

- [x] **STAT-01**: Status skill warns when log.yml exceeds 50KB
- [x] **STAT-02**: Status skill cross-references artifact existence (SCOPE.md, SYNTHESIS.md, DESIGN.md, PLAN.md) against state.yml phase and flags inconsistencies
- [x] **STAT-03**: Status skill remains read-only — reconstruction reports discrepancies but never writes state.yml

### HANDOFF.md Support

- [x] **HAND-01**: Design skill Step 6 HANDOFF.md generation works end-to-end for product-intent lifecycles
- [x] **HAND-02**: Design revision cycle (Step 7) handles HANDOFF.md-specific revision requests
- [x] **HAND-03**: G3 gate S4 criterion validates correctly with HANDOFF.md present
- [x] **HAND-04**: PROJECT.md updated to reflect HANDOFF.md as officially supported (moved from Out of Scope)

### Gate Enforcement

- [x] **GATE-01**: G2 (research) validates every DA readiness criterion marked MET in SYNTHESIS.md — MUST criterion
- [x] **GATE-02**: G3 (design) validates evidence citations address DA-specific readiness criteria — MUST criterion
- [ ] **GATE-03**: G4 (plan) validates task coverage accounts for DA depth calibration (Deep vs Light) — SHOULD criterion
- [ ] **GATE-04**: G5 (spike) validates spike resolution addresses the specific ambiguity identified — SHOULD criterion

## Future Requirements

Deferred to v1.2 or later. Tracked but not in current roadmap.

### Resilience

- **RESL-01**: Automatic fallback to state.yml.bak on corruption detection
- **RESL-02**: Malformed YAML handling with graceful recovery path

### Architecture

- **ARCH-01**: Codebase analyst subagent_type changed from general-purpose to explore
- **ARCH-02**: Split state.yml into scoped files (tracking vs data storage)

### Quality

- **QUAL-01**: External verifier agent for research reasoning soundness
- **QUAL-02**: Design/plan alternative-surfacing for decision-over-task philosophy

### Developer Workflow

- **DEVW-01**: Per-task atomic git commits during execute phase

## Out of Scope

| Feature | Reason |
|---------|--------|
| SessionStart hook (DEFER-7) | 3 open Claude Code platform bugs (#16538, #13650, #11509) |
| Connected Flow import (DEFER-8) | No cross-lifecycle users yet; needs design research |
| Mobile/web UI | Pure CLI plugin |
| Multi-user collaboration | Single-developer workflow |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| HSKP-01 | 14 | Complete |
| HSKP-02 | 14 | Complete |
| HSKP-03 | 14 | Complete |
| STEP-01 | 15 | Complete |
| STEP-02 | 15 | Complete |
| STEP-03 | 15 | Pending |
| STEP-04 | 15 | Pending |
| STEP-05 | 15 | Pending |
| STEP-06 | 15 | Pending |
| STEP-07 | 15 | Pending |
| STEP-08 | 15 | Pending |
| STEP-09 | 15 | Complete |
| STAT-01 | 16 | Complete |
| STAT-02 | 16 | Complete |
| STAT-03 | 16 | Complete |
| HAND-01 | 17 | Complete |
| HAND-02 | 17 | Complete |
| HAND-03 | 17 | Complete |
| HAND-04 | 17 | Complete |
| GATE-01 | 18 | Complete |
| GATE-02 | 18 | Complete |
| GATE-03 | 18 | Pending |
| GATE-04 | 18 | Pending |

**Coverage:**
- v1.1 requirements: 23 total
- Mapped to phases: 23
- Unmapped: 0

---
*Requirements defined: 2026-03-09*
*Last updated: 2026-03-09 after traceability mapping*
