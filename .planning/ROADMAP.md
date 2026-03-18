# Roadmap: Expedite Plugin

## Milestones

- ✅ **v1.0 Expedite Plugin Initial Release** -- Phases 1-13 (shipped 2026-03-09)
- ✅ **v1.1 Production Polish** -- Phases 14-18 (shipped 2026-03-11)
- ✅ **v1.2 Infrastructure Hardening & Quality** -- Phase 19 (shipped 2026-03-12)
- ✅ **v2.0 Agent Harness Foundation** -- Phases 25-29 (shipped 2026-03-13)
- ✅ **v3.0 Agent Harness Completion** -- Phases 30-37 (shipped 2026-03-17)
- 🚧 **v3.1 Audit Bug Fixes** -- Phases 38-40 (in progress)

## Phases

<details>
<summary>✅ v1.0 Expedite Plugin Initial Release (Phases 1-13) -- SHIPPED 2026-03-09</summary>

- [x] Phase 1: Plugin Scaffolding (2/2 plans) -- completed 2026-02-28
- [x] Phase 2: State Management and Context (2/2 plans) -- completed 2026-02-28
- [x] Phase 3: Prompt Template System (3/3 plans) -- completed 2026-03-02
- [x] Phase 4: Scope Skill (3/3 plans) -- completed 2026-03-03
- [x] Phase 5: Research Orchestration Core (3/3 plans) -- completed 2026-03-04
- [x] Phase 11: Integration Fixes (1/1 plan) -- completed 2026-03-04
- [x] Phase 6: Research Quality and Synthesis (3/3 plans) -- completed 2026-03-05
- [x] Phase 7: Design Skill (3/3 plans) -- completed 2026-03-05
- [x] Phase 8: Plan Skill (2/2 plans) -- completed 2026-03-06
- [x] Phase 9: Spike and Execute Skills (3/3 plans) -- completed 2026-03-08
- [x] Phase 10: Cross-Cutting Integration (3/3 plans) -- completed 2026-03-09
- [x] Phase 12: Audit Tech Debt Cleanup (2/2 plans) -- completed 2026-03-09
- [x] Phase 13: Tech Debt Resolution (2/2 plans) -- completed 2026-03-09

Full details: `.planning/milestones/v1.0-ROADMAP.md`

</details>

<details>
<summary>✅ v1.1 Production Polish (Phases 14-18) -- SHIPPED 2026-03-11</summary>

- [x] Phase 14: Quick Fixes (1/1 plan) -- completed 2026-03-10
- [x] Phase 15: Step-Level Tracking (4/4 plans) -- completed 2026-03-10
- [x] Phase 16: Status Improvements (1/1 plan) -- completed 2026-03-10
- [x] Phase 17: HANDOFF.md Activation (3/3 plans) -- completed 2026-03-10
- [x] Phase 18: Gate Enforcement (2/2 plans) -- completed 2026-03-11

Full details: `.planning/milestones/v1.1-ROADMAP.md`

</details>

<details>
<summary>✅ v1.2 Infrastructure Hardening & Quality (Phase 19) -- SHIPPED 2026-03-12</summary>

- [x] Phase 19: State Recovery (2/2 plans) -- completed 2026-03-12

Phases 20-24 subsumed by v2.0 Agent Harness Architecture.
Full details: `.planning/milestones/v1.2-ROADMAP.md`

</details>

<details>
<summary>✅ v2.0 Agent Harness Foundation (Phases 25-29) -- SHIPPED 2026-03-13</summary>

- [x] Phase 25: State Splitting and Hook Infrastructure (3/3 plans) -- completed 2026-03-13
- [x] Phase 26: Phase Transition Enforcement (2/2 plans) -- completed 2026-03-13
- [x] Phase 27: Override Mechanism and Audit Trail (2/2 plans) -- completed 2026-03-13
- [x] Phase 28: Checkpoint-Based Resume (2/2 plans) -- completed 2026-03-13
- [x] Phase 29: Session Handoff (2/2 plans) -- completed 2026-03-13

Full details: `.planning/milestones/v2.0-ROADMAP.md`

</details>

<details>
<summary>✅ v3.0 Agent Harness Completion (Phases 30-37) -- SHIPPED 2026-03-17</summary>

- [x] Phase 30: Agent Formalization (2/2 plans) -- completed 2026-03-16
- [x] Phase 31: Skill Thinning (3/3 plans) -- completed 2026-03-16
- [x] Phase 32: Structural Gates (2/2 plans) -- completed 2026-03-16
- [x] Phase 33: Verifier Validation (1/1 plan) -- completed 2026-03-16
- [x] Phase 34: Semantic Gates (3/3 plans) -- completed 2026-03-16
- [x] Phase 35: Worktree and Git Workflow (2/2 plans) -- completed 2026-03-16
- [x] Phase 36: Spike G5 Integration Fix (1/1 plan) -- completed 2026-03-17
- [x] Phase 37: Reference & Roadmap Cleanup (1/1 plan) -- completed 2026-03-17

Full details: `.planning/milestones/v3.0-ROADMAP.md`

</details>

### 🚧 v3.1 Audit Bug Fixes (In Progress)

**Milestone Goal:** Validate and fix all bugs identified by the 15-agent final audit, making the plugin functional for first real-world use.

- [x] **Phase 38: P0 Audit Fixes** - Validate and fix 7 runtime-blocking bugs (FSM transitions, v2 state-split, worktree merge-back) (1 plan) (completed 2026-03-18)
- [ ] **Phase 39: P1 Audit Fixes** - Validate and fix 14 correctness bugs (override paths, status skill, schema gaps, backup paths) (2 plans)
- [ ] **Phase 40: P2 Audit Fixes** - Validate and fix 15 quality bugs (dead code, naming consistency, schema cleanup, cosmetic) (1 plan)

## Phase Details

### Phase 38: P0 Audit Fixes
**Goal**: All 7 runtime-blocking bugs (AUD-001 through AUD-007) validated against source code and fixed, making a standard lifecycle completable end-to-end
**Depends on**: Phase 37
**Audit Source**: `.planning/research/expedite-final-audit/research-synthesis.md`
**Research Task**: For each AUD finding (001-007), read the cited file and line. Confirm the bug exists as described, note if the audit was wrong or the code has changed, and record the exact current code that needs fixing. Output: validated bug list with confirmed/rejected status and exact code snippets.
**Success Criteria** (what must be TRUE):
  1. Execute skill writes `execute_complete` before `complete` (AUD-001 confirmed and fixed)
  2. Execute skill entry phases match FSM — spike-skip path explicitly decided (AUD-002 confirmed and fixed)
  3. Scope writes questions to `questions.yml`; G1 reads from `questions.yml` (AUD-003 confirmed and fixed)
  4. Execute writes tasks to `tasks.yml` (AUD-004 confirmed and fixed)
  5. Override entry paths use valid gate IDs and `outcome: "overridden"` (AUD-005 confirmed and fixed)
  6. Execute writes completion checkpoint at lifecycle end (AUD-006 confirmed and fixed)
  7. Worktree merge-back documented with branch name in task-implementer output (AUD-007 confirmed and fixed)
**Plans**: 1 plan
Plans:
- [ ] 38-01-PLAN.md — Fix 7 P0 runtime-blocking bugs (FSM, state-split, override, worktree)

### Phase 39: P1 Audit Fixes
**Goal**: All 14 correctness bugs (AUD-008 through AUD-021) validated and fixed — state schema reconciled, status skill complete, backup paths correct, agent dispatch specified
**Depends on**: Phase 38
**Audit Source**: `.planning/research/expedite-final-audit/research-synthesis.md`
**Research Task**: For each AUD finding (008-021), read the cited file and line. Confirm the bug exists as described, note if the audit was wrong or the code has changed, and record the exact current code that needs fixing. Output: validated bug list with confirmed/rejected status and exact code snippets.
**Success Criteria** (what must be TRUE):
  1. State.yml schema covers all written fields; fields belonging in split files removed from skill writes (AUD-008)
  2. Status skill displays spike phases and execute_complete with correct next-action routing (AUD-009)
  3. G4 DA matching is case-insensitive (AUD-010)
  4. Research backup path uses `.expedite/state.yml` (AUD-011)
  5. Override detection handles all YAML quoting styles (AUD-012)
  6. HOOK-03 escalation references checkpoint.yml (AUD-013)
  7. research_round standardized to questions.yml (AUD-014)
  8. Research steps renumbered contiguously; status totals updated (AUD-015)
  9. Backup-before-write added to execute Steps 5d/6/7 and research Step 12 (AUD-016)
  10. Gates.yml history immutability enforced (AUD-017)
  11. Agent dispatch placeholders enumerated for task-implementer and researchers (AUD-018, AUD-019)
  12. sufficiency-evaluator memory setting resolved (AUD-020)
  13. Schema denial recovery instructions added (AUD-021)
**Plans**: 2 plans
Plans:
- [ ] 39-01-PLAN.md — Fix 9 skill/agent instruction bugs (current_step removal, status phases, research renumbering, dispatches)
- [ ] 39-02-PLAN.md — Fix 5 JavaScript hook/gate bugs (DA matching, override detection, immutability, schema)

### Phase 40: P2 Audit Fixes
**Goal**: All 15 quality bugs (AUD-022 through AUD-036) validated and fixed — dead code removed, naming standardized, schema properties cleaned up, cosmetic issues resolved
**Depends on**: Phase 39
**Audit Source**: `.planning/research/expedite-final-audit/research-synthesis.md`
**Research Task**: For each AUD finding (022-036), read the cited file and line. Confirm the bug exists as described, note if the audit was wrong or the code has changed, and record the exact current code that needs fixing. Output: validated bug list with confirmed/rejected status and exact code snippets.
**Success Criteria** (what must be TRUE):
  1. `nullable` property either implemented or removed from schemas (AUD-022)
  2. Gates.yml schema includes `severity` field (AUD-023)
  3. Cosmetic message fixes applied (AUD-024)
  4. Truthiness check fixed in session-summary.js (AUD-025)
  5. Step count constants verified and corrected (AUD-026)
  6. `extractDAs` and `wordCount` consolidated into gate-utils.js (AUD-027, AUD-028)
  7. `go_advisory` vs `go-with-advisory` standardized (AUD-029)
  8. Dead enum values, exports, and imports removed (AUD-030, AUD-031, AUD-032)
  9. plugin.json version and description updated (AUD-033)
  10. Edit tool hook gap addressed (AUD-035)
**Plans**: 1 plan

## Progress

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
| 14. Quick Fixes | v1.1 | 1/1 | Complete | 2026-03-10 |
| 15. Step-Level Tracking | v1.1 | 4/4 | Complete | 2026-03-10 |
| 16. Status Improvements | v1.1 | 1/1 | Complete | 2026-03-10 |
| 17. HANDOFF.md Activation | v1.1 | 3/3 | Complete | 2026-03-10 |
| 18. Gate Enforcement | v1.1 | 2/2 | Complete | 2026-03-11 |
| 19. State Recovery | v1.2 | 2/2 | Complete | 2026-03-12 |
| 25. State Splitting + Hooks | v2.0 | 3/3 | Complete | 2026-03-13 |
| 26. Phase Transition Enforcement | v2.0 | 2/2 | Complete | 2026-03-13 |
| 27. Override + Audit | v2.0 | 2/2 | Complete | 2026-03-13 |
| 28. Checkpoint Resume | v2.0 | 2/2 | Complete | 2026-03-13 |
| 29. Session Handoff | v2.0 | 2/2 | Complete | 2026-03-13 |
| 30. Agent Formalization | v3.0 | 2/2 | Complete | 2026-03-16 |
| 31. Skill Thinning | v3.0 | 3/3 | Complete | 2026-03-16 |
| 32. Structural Gates | v3.0 | 2/2 | Complete | 2026-03-16 |
| 33. Verifier Validation | v3.0 | 1/1 | Complete | 2026-03-16 |
| 34. Semantic Gates | v3.0 | 3/3 | Complete | 2026-03-16 |
| 35. Worktree and Git Workflow | v3.0 | 2/2 | Complete | 2026-03-16 |
| 36. Spike G5 Integration Fix | v3.0 | 1/1 | Complete | 2026-03-17 |
| 37. Reference & Roadmap Cleanup | v3.0 | 1/1 | Complete | 2026-03-17 |
| 38. P0 Audit Fixes | 1/1 | Complete    | 2026-03-18 | - |
| 39. P1 Audit Fixes | 1/2 | In Progress|  | - |
| 40. P2 Audit Fixes | v3.1 | 0/1 | Not started | - |
