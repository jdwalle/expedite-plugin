# Roadmap: Expedite Plugin

## Milestones

- ✅ **v1.0 Expedite Plugin Initial Release** — Phases 1-13 (shipped 2026-03-09)
- ✅ **v1.1 Production Polish** — Phases 14-18 (shipped 2026-03-11)
- 🚧 **v1.2 Infrastructure Hardening & Quality** — Phases 19-24 (in progress)

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

<details>
<summary>✅ v1.1 Production Polish (Phases 14-18) — SHIPPED 2026-03-11</summary>

- [x] Phase 14: Quick Fixes (1/1 plan) — completed 2026-03-10
- [x] Phase 15: Step-Level Tracking (4/4 plans) — completed 2026-03-10
- [x] Phase 16: Status Improvements (1/1 plan) — completed 2026-03-10
- [x] Phase 17: HANDOFF.md Activation (3/3 plans) — completed 2026-03-10
- [x] Phase 18: Gate Enforcement (2/2 plans) — completed 2026-03-11

Full details: `.planning/milestones/v1.1-ROADMAP.md`

</details>

### 🚧 v1.2 Infrastructure Hardening & Quality (In Progress)

**Milestone Goal:** Harden plugin infrastructure (state resilience, state splitting, skill sizing) and elevate quality gates (research verifier, conditional alternatives, git traceability).

- [ ] **Phase 19: State Recovery** - Missing state.yml is automatically detected and recovered from lifecycle artifacts
- [ ] **Phase 20: Explore Subagent Validation** - Codebase analyst subagent uses explore type, validated empirically
- [ ] **Phase 21: State Splitting** - Monolithic state.yml split into scoped files with full migration and coordination
- [ ] **Phase 22: Skill Line Limit** - All skills under 500-line soft cap via content extraction to references/
- [ ] **Phase 23: Per-Task Git Commits** - Execute skill creates atomic, traceable git commits after each verified task
- [ ] **Phase 24: Verifier Agent and Conditional Alternatives** - Research reasoning verification and evidence-driven alternative surfacing in design/plan

## Phase Details

### Phase 19: State Recovery
**Goal**: Users never lose lifecycle progress when state.yml goes missing -- automatic recovery from existing artifacts
**Depends on**: Nothing (foundation for all subsequent phases)
**Requirements**: RESL-01, RESL-02, RESL-03, RESL-04, RESL-05
**Success Criteria** (what must be TRUE):
  1. User invokes any skill with missing state.yml and the skill proceeds normally after auto-recovering from artifacts (PLAN.md, DESIGN.md, SYNTHESIS.md, SCOPE.md)
  2. User sees an inline notice after recovery identifying the last known lifecycle phase
  3. Recovery scans artifacts in reverse lifecycle order and reconstructs minimal state (phase + project_name)
  4. User sees a clear unrecoverable error with instructions when no recovery source exists (no state.yml, no artifacts)
  5. RESL-05 (sentinel field) is explicitly deferred -- write atomicity is handled by the Claude Code platform
**Plans**: 2 plans

Plans:
- [ ] 19-01-PLAN.md — Create recovery protocol reference file and update status skill
- [ ] 19-02-PLAN.md — Wire recovery preambles into all 7 skills

### Phase 20: Explore Subagent Validation
**Goal**: Codebase analyst research subagents use the more appropriate explore type instead of general-purpose
**Depends on**: Phase 19 (recovery safety net before any behavioral changes)
**Requirements**: ARCH-01
**Success Criteria** (what must be TRUE):
  1. User runs a research lifecycle with codebase analysis questions and the codebase analyst subagent dispatches as explore type
  2. Evidence quality from explore-type subagents is equal to or better than general-purpose (validated via empirical spike comparing outputs)
**Plans**: TBD

Plans:
- [ ] 20-01: TBD

### Phase 21: State Splitting
**Goal**: State data is split into scoped files so each skill loads only the state it needs, reducing per-invocation token waste by 60-90%
**Depends on**: Phase 19 (recovery must handle split file layout; ARCH-06 depends on RESL-01)
**Requirements**: ARCH-02, ARCH-03, ARCH-04, ARCH-05, ARCH-06
**Success Criteria** (what must be TRUE):
  1. State is persisted across four scoped files (state.yml ~15 lines for tracking/routing, questions.yml, tasks.yml, gates.yml) instead of one monolithic file
  2. Each skill's `!cat` injection loads only the specific state files it needs (not all four)
  3. Each scoped state file has its own .bak copy created before every write
  4. User with an active lifecycle on monolithic state.yml invokes any skill and the state is migrated to split format without data loss
  5. State recovery (Phase 19) detects corruption and auto-recovers correctly across all split state files
**Plans**: TBD

Plans:
- [ ] 21-01: TBD
- [ ] 21-02: TBD
- [ ] 21-03: TBD

### Phase 22: Skill Line Limit
**Goal**: All skills are under 500 lines with self-contained content blocks extracted to references/, making skills maintainable lean orchestrators
**Depends on**: Phase 21 (skills should be in final post-splitting form before extraction)
**Requirements**: MAINT-01, MAINT-02, MAINT-03, MAINT-04
**Success Criteria** (what must be TRUE):
  1. All skills exceeding 500 lines have content blocks extracted to `references/ref-*.md` files and are under the soft cap
  2. Extracted content is loaded on-demand via Read tool reference at the step that needs it, not injected at skill load time
  3. Step numbering in every skill and the status skill lookup table are unchanged after extraction
  4. Step 1 (prerequisite check) and all state transition logic remain inline in every skill (not extracted)
**Plans**: TBD

Plans:
- [ ] 22-01: TBD
- [ ] 22-02: TBD

### Phase 23: Per-Task Git Commits
**Goal**: Each verified task in execute produces an atomic, traceable git commit that extends the DA traceability chain to version control
**Depends on**: Phase 21 (stable state management for commit tracking in checkpoint.yml)
**Requirements**: DEVW-01, DEVW-02, DEVW-03, DEVW-04, DEVW-05, DEVW-06
**Success Criteria** (what must be TRUE):
  1. User completes a task during execute and an atomic git commit is created automatically with only that task's modified files staged
  2. Commit messages follow conventional format `{type}(DA-{N}): {task_description}` linking each commit to its decision area
  3. User can opt out of auto-commits via per-invocation flag or per-lifecycle setting and no commits are created
  4. When task verification fails, no commit is created and user is prompted with options (retry, skip, manual fix)
  5. Git errors (merge conflicts, dirty worktree, missing repo) pause execution with clear instructions instead of auto-resolving
**Plans**: TBD

Plans:
- [ ] 23-01: TBD
- [ ] 23-02: TBD

### Phase 24: Verifier Agent and Conditional Alternatives
**Goal**: Research quality is elevated with reasoning soundness verification, and design/plan skills surface competing alternatives only when evidence shows genuine tradeoffs
**Depends on**: Phase 22 (skills in final extracted form before modifying generation logic)
**Requirements**: QUAL-01, QUAL-02, QUAL-03, QUAL-04, QUAL-05, QUAL-06, QUAL-07
**Success Criteria** (what must be TRUE):
  1. After research synthesis, an external verifier agent checks reasoning soundness and produces per-DA assessments in `reasoning-verification.yml` with severity ratings
  2. Verifier findings appear as advisory SHOULD criterion in G2 gate display (not blocking; user can proceed with Go despite verifier concerns)
  3. On research round 2+, verifier output is annotation-only and does not trigger recycle (preventing infinite loops)
  4. When SYNTHESIS.md evidence shows genuine tradeoffs (2+ viable approaches, no dominant option), design skill surfaces competing alternatives with tradeoff analysis
  5. When evidence clearly favors one approach, design skill proposes a single recommendation directly without forced alternative presentation
**Plans**: TBD

Plans:
- [ ] 24-01: TBD
- [ ] 24-02: TBD
- [ ] 24-03: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 19 → 20 → 21 → 22 → 23 → 24

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
| 19. State Recovery | 1/2 | In Progress|  | - |
| 20. Explore Subagent | v1.2 | 0/TBD | Not started | - |
| 21. State Splitting | v1.2 | 0/TBD | Not started | - |
| 22. Skill Line Limit | v1.2 | 0/TBD | Not started | - |
| 23. Git Commits | v1.2 | 0/TBD | Not started | - |
| 24. Verifier & Alternatives | v1.2 | 0/TBD | Not started | - |
