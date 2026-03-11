# Roadmap: Expedite Plugin

## Milestones

- ✅ **v1.0 Expedite Plugin Initial Release** — Phases 1-13 (shipped 2026-03-09)
- 🚧 **v1.1 Production Polish** — Phases 14-18 (in progress)

## Phases

<details>
<summary>✅ v1.0 Expedite Plugin Initial Release (Phases 1-13) — SHIPPED 2026-03-09</summary>

- [x] Phase 1: Plugin Scaffolding (2/2 plans) — completed 2026-02-28
- [x] Phase 2: State Management and Context (2/2 plans) — completed 2026-02-28
- [x] Phase 3: Prompt Template System (3/3 plans) — completed 2026-03-02
- [x] Phase 4: Scope Skill (3/3 plans) — completed 2026-03-03
- [x] Phase 5: Research Orchestration Core (3/3 plans) — completed 2026-03-04
- [x] Phase 11: Integration Fixes (1/1 plan) — completed 2026-03-04
- [x] Phase 6: Research Quality and Synthesis (3/3 plans) — completed 2026-03-05
- [x] Phase 7: Design Skill (3/3 plans) — completed 2026-03-05
- [x] Phase 8: Plan Skill (2/2 plans) — completed 2026-03-06
- [x] Phase 9: Spike and Execute Skills (3/3 plans) — completed 2026-03-08
- [x] Phase 10: Cross-Cutting Integration (3/3 plans) — completed 2026-03-09
- [x] Phase 12: Audit Tech Debt Cleanup (2/2 plans) — completed 2026-03-09
- [x] Phase 13: Tech Debt Resolution (2/2 plans) — completed 2026-03-09

Full details: `.planning/milestones/v1.0-ROADMAP.md`

</details>

### 🚧 v1.1 Production Polish (In Progress)

**Milestone Goal:** Close audit gaps — quick fixes, UX orientation, gate integrity, and deferred feature support.

**Phase Numbering:**
- Integer phases (14, 15, ...): Planned milestone work
- Decimal phases (14.1, 14.2): Urgent insertions (marked with INSERTED)

- [x] **Phase 14: Quick Fixes** - Version label, .gitignore, and architecture decision documentation (completed 2026-03-10)
- [x] **Phase 15: Step-Level Tracking** - Users know exactly where they are within long-running skills (completed 2026-03-10)
- [x] **Phase 16: Status Improvements** - Status skill gains log size warning and artifact-based state reconstruction (completed 2026-03-10)
- [x] **Phase 17: HANDOFF.md Activation** - Product-intent users get validated HANDOFF.md generation (completed 2026-03-10)
- [x] **Phase 18: Gate Enforcement** - DA readiness criteria enforced across G2-G5 quality gates (completed 2026-03-11)

## Phase Details

### Phase 14: Quick Fixes
**Goal**: Plugin metadata and repository hygiene match a shipped v1.0 product
**Depends on**: Nothing (independent, zero-risk changes)
**Requirements**: HSKP-01, HSKP-02, HSKP-03
**Success Criteria** (what must be TRUE):
  1. Running `/expedite:status` or inspecting plugin.json shows version `1.0.0`
  2. `.DS_Store` files are gitignored and removed from the git index — `git ls-files` returns no `.DS_Store` entries
  3. PROJECT.md Key Decisions table documents the sufficiency evaluator divergence (spec chose inline, implementation chose Task() for context hygiene)
**Plans:** 1/1 plans complete

Plans:
- [ ] 14-01-PLAN.md — Verify and commit version bump, .gitignore, and sufficiency evaluator docs fix

### Phase 15: Step-Level Tracking
**Goal**: Users always know their current position within any multi-step skill
**Depends on**: Phase 14
**Requirements**: STEP-01, STEP-02, STEP-03, STEP-04, STEP-05, STEP-06, STEP-07, STEP-08, STEP-09
**Success Criteria** (what must be TRUE):
  1. state.yml contains a `current_step` field with `skill`, `step`, and `label` sub-keys that updates as users progress through any skill
  2. state.yml.template documents the `current_step` field so new lifecycles inherit the schema
  3. Every numbered step in all 6 stateful skills (scope, research, design, plan, spike, execute) writes `current_step` on entry
  4. Status skill displays current step position (e.g., "scope: step 5 of 9 — Adaptive Refinement") when `current_step` exists, and gracefully omits it when absent
  5. Existing v1.0 lifecycles without `current_step` continue to work without errors (backward compatibility)
**Plans**: 4 plans (1 wave)

Plans:
- [ ] 15-01-PLAN.md — Schema + status: add current_step to state.yml.template and step display to status skill
- [ ] 15-02-PLAN.md — Scope + research: add step tracking to scope (10 steps) and research (18 steps)
- [ ] 15-03-PLAN.md — Design + plan: add step tracking to design (10 steps) and plan (9 steps)
- [ ] 15-04-PLAN.md — Spike + execute: add step tracking to spike (9 steps) and execute (7 steps)

### Phase 16: Status Improvements
**Goal**: Status skill provides actionable diagnostics beyond basic lifecycle overview
**Depends on**: Phase 15 (benefits from step tracking data for richer output)
**Requirements**: STAT-01, STAT-02, STAT-03
**Success Criteria** (what must be TRUE):
  1. When log.yml exceeds 50KB, status skill output includes a visible warning about log size
  2. Status skill cross-references artifact files (SCOPE.md, SYNTHESIS.md, DESIGN.md, PLAN.md) against state.yml phase and reports any inconsistencies (e.g., "state says design_complete but DESIGN.md not found")
  3. Status skill remains strictly read-only — it reports discrepancies but never modifies state.yml
**Plans**: 1 plan

Plans:
- [ ] 16-01-PLAN.md — Add log size warning, artifact cross-reference, and read-only reinforcement to status skill

### Phase 17: HANDOFF.md Activation
**Goal**: Product-intent users can generate and refine a validated HANDOFF.md through the design skill
**Depends on**: Phase 15 (step tracking enriches testing), Phase 16 (status improvements stable)
**Requirements**: HAND-01, HAND-02, HAND-03, HAND-04
**Success Criteria** (what must be TRUE):
  1. A product-intent lifecycle produces a HANDOFF.md at design Step 6 that contains scope decisions, research evidence, and actionable deliverables
  2. Users can request revisions to HANDOFF.md during the design revision cycle (Step 7) and see changes applied
  3. G3 gate S4 criterion evaluates correctly when HANDOFF.md is present (passes) and when absent for product-intent (flags)
  4. PROJECT.md reflects HANDOFF.md as officially supported — removed from Out of Scope, documented as a validated feature
**Plans:** 3/3 plans complete

Plans:
- [ ] 17-01-PLAN.md — Fix design resume logic and status artifact cross-reference for HANDOFF.md support
- [ ] 17-02-PLAN.md — Update PROJECT.md to officially support HANDOFF.md
- [ ] 17-03-PLAN.md — End-to-end verification of HANDOFF.md generation, revision, and G3 gate evaluation

### Phase 18: Gate Enforcement
**Goal**: Quality gates validate DA readiness criteria so evidence gaps are caught before downstream skills consume them
**Depends on**: Phase 17 (HANDOFF.md must be validated before G3 gate changes; all other modifications stable)
**Requirements**: GATE-01, GATE-02, GATE-03, GATE-04
**Success Criteria** (what must be TRUE):
  1. G2 (research gate) validates that every DA readiness criterion is marked MET in SYNTHESIS.md — failure triggers Recycle (MUST criterion)
  2. G3 (design gate) validates that evidence citations address DA-specific readiness criteria — failure triggers Recycle (MUST criterion)
  3. G4 (plan gate) checks that task coverage accounts for DA depth calibration (Deep vs Light) — failure produces advisory (SHOULD criterion)
  4. G5 (spike gate) checks that spike resolution addresses the specific ambiguity identified — failure produces advisory (SHOULD criterion)
  5. Gates that were previously passing continue to pass — no false Recycle regressions on well-formed lifecycles
**Plans:** 2/2 plans complete

Plans:
- [x] 18-01-PLAN.md — Add M5 MUST criteria to G2 (research) and G3 (design) gates for DA readiness enforcement
- [ ] 18-02-PLAN.md — Add SHOULD criteria to G4 (plan S5) and G5 (spike S4) gates for depth and ambiguity advisories

## Progress

**Execution Order:**
Phases execute in numeric order: 14 -> 14.1 -> 15 -> 15.1 -> ... -> 18

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Plugin Scaffolding | v1.0 | 2/2 | Complete | 2026-02-28 |
| 2. State Management | v1.0 | 2/2 | Complete | 2026-02-28 |
| 3. Prompt Templates | v1.0 | 3/3 | Complete | 2026-03-02 |
| 4. Scope Skill | v1.0 | 3/3 | Complete | 2026-03-03 |
| 5. Research Core | v1.0 | 3/3 | Complete | 2026-03-04 |
| 11. Integration Fixes | v1.0 | 1/1 | Complete | 2026-03-04 |
| 6. Research Quality | v1.0 | 3/3 | Complete | 2026-03-05 |
| 7. Design Skill | v1.0 | 3/3 | Complete | 2026-03-05 |
| 8. Plan Skill | v1.0 | 2/2 | Complete | 2026-03-06 |
| 9. Spike & Execute | v1.0 | 3/3 | Complete | 2026-03-08 |
| 10. Cross-Cutting | v1.0 | 3/3 | Complete | 2026-03-09 |
| 12. Audit Cleanup | v1.0 | 2/2 | Complete | 2026-03-09 |
| 13. Tech Debt | v1.0 | 2/2 | Complete | 2026-03-09 |
| 14. Quick Fixes | 1/1 | Complete    | 2026-03-10 | - |
| 15. Step-Level Tracking | 4/4 | Complete    | 2026-03-10 | - |
| 16. Status Improvements | 1/1 | Complete    | 2026-03-10 | - |
| 17. HANDOFF.md Activation | v1.1 | Complete    | 2026-03-11 | 2026-03-10 |
| 18. Gate Enforcement | 2/2 | Complete    | 2026-03-11 | - |
