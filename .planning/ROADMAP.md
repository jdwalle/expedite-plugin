# Roadmap: Expedite Plugin

## Milestones

- ✅ **v1.0 Expedite Plugin Initial Release** -- Phases 1-13 (shipped 2026-03-09)
- ✅ **v1.1 Production Polish** -- Phases 14-18 (shipped 2026-03-11)
- ✅ **v1.2 Infrastructure Hardening & Quality** -- Phase 19 (shipped 2026-03-12)
- ✅ **v2.0 Agent Harness Foundation** -- Phases 25-29 (shipped 2026-03-13)
- 🚧 **v3.0 Agent Harness Completion** -- Phases 30-35 (in progress)

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

### 🚧 v3.0 Agent Harness Completion (In Progress)

**Milestone Goal:** Complete the agent harness on the validated M1-M2 foundation — formalizing agents, thinning skills, enforcing structural gates as Node.js scripts, adding dual-layer semantic gate verification, and enabling worktree isolation with per-task atomic git commits.

- [x] **Phase 30: Agent Formalization** - Create 8 core agents with frontmatter, model tiering, and memory config (completed 2026-03-16)
- [ ] **Phase 31: Skill Thinning** - Refactor all skills to step-sequencer + agent-dispatcher; fix gate write path
- [ ] **Phase 32: Structural Gates** - G1, G2-structural, G4 as deterministic Node.js gate scripts writing to gates.yml
- [ ] **Phase 33: Verifier Validation** - Pre-build test of gate-verifier across quality range before semantic gate commitment
- [ ] **Phase 34: Semantic Gates** - G3, G5, G2-semantic via dual-layer gate-verifier with anti-rubber-stamp measures
- [ ] **Phase 35: Worktree and Git Workflow** - Worktree isolation for task-implementer and per-task atomic git commits

## Phase Details

### Phase 30: Agent Formalization
**Goal**: All 8 core agents exist as formalized `agents/*.md` files with correct frontmatter — model tier, tool restrictions, maxTurns, memory config, and system prompt — enabling skills to dispatch agents by name
**Depends on**: Phase 29 (v2.0 complete)
**Requirements**: AGNT-01, AGNT-02, AGNT-03, AGNT-04, AGNT-05, AGNT-06, AGNT-07, AGNT-08
**Success Criteria** (what must be TRUE):
  1. All 8 agent files exist at `agents/{name}.md` with valid frontmatter (model, description, tools/disallowedTools, maxTurns, system prompt)
  2. Running a skill that dispatches an agent by name succeeds without requiring manual wiring
  3. A dispatched agent cannot use a tool listed in its `disallowedTools` (tool restriction test passes)
  4. research-synthesizer, design-architect, gate-verifier frontmatter shows `model: claude-opus-*`; all others show `model: claude-sonnet-*`
  5. research-synthesizer and gate-verifier frontmatter includes `memory: project`
**Plans**: 2 plans

Plans:
- [x] 30-01: Create 8 agent definition files with frontmatter (model tiering, tool restrictions, memory config, system prompts)
- [x] 30-02: Update skills to dispatch agents by name via Agent tool; validate tool restriction behavior

### Phase 31: Skill Thinning
**Goal**: All skills refactored to the step-sequencer + agent-dispatcher pattern (under 200 lines each, up to 400 for scope), gate results written to `.expedite/gates.yml` fixing the INT-01/FLOW-01 integration debt, and gated phase transitions work end-to-end without override workaround
**Depends on**: Phase 30
**Requirements**: THIN-01, THIN-02, THIN-03, THIN-04, THIN-05, THIN-06
**Success Criteria** (what must be TRUE):
  1. Every skill file is under 200 lines (scope under 400); business logic lives in dispatched agents
  2. Running a complete lifecycle writes gate results to `.expedite/gates.yml` — not to `state.yml.gate_history`
  3. A gated phase transition (e.g., scope→research) works without requiring EXPEDITE_HOOKS_DISABLED or manual override
  4. After an agent completes, the skill writes state and checkpoint without any write occurring during agent execution
  5. Skills validate agent output on return — missing artifact or malformed structure surfaces an error, not silent continuation
**Plans**: TBD

Plans:
- [ ] 31-01: Refactor scope and research skills to step-sequencer + agent-dispatcher; redirect gate writes
- [ ] 31-02: Refactor design, plan, spike, execute skills to step-sequencer + agent-dispatcher
- [ ] 31-03: End-to-end integration test: full lifecycle with gate write path and phase transition validation

### Phase 32: Structural Gates
**Goal**: G1 (Scope), G2-structural (Research), and G4 (Plan) run as deterministic Node.js scripts that write structured results with actionable failure messages to `gates.yml`, and each script runs as part of the skill completion flow
**Depends on**: Phase 31
**Requirements**: GATE-01, GATE-02, GATE-03, GATE-04, GATE-05
**Success Criteria** (what must be TRUE):
  1. Running `node gates/g1-scope.js` checks SCOPE.md existence, required sections, and minimum word counts — writing pass/fail with specific failure messages to `gates.yml`
  2. Running `node gates/g2-structural.js` checks synthesis file existence, category files, DA synthesis sections, and READINESS.md per-DA status — blocking if any DA is "INSUFFICIENT"
  3. Running `node gates/g4-plan.js` checks PLAN.md existence, phased breakdown, agent assignments, and dependency chain
  4. Completing a skill (scope, research, plan) automatically invokes its gate script before the PreToolUse hook checks phase transition
  5. A gate failure produces a message that tells the user exactly which section or field is missing — not just "gate failed"
**Plans**: TBD

Plans:
- [ ] 32-01: Implement G1 (scope) and G4 (plan) gate scripts
- [ ] 32-02: Implement G2-structural gate script; wire all three into skill completion flow

### Phase 33: Verifier Validation
**Goal**: The gate-verifier agent is validated against 5-6 artifacts spanning a quality range before the dual-layer semantic gate system is built, confirming it can distinguish good from weak work and will not rubber-stamp everything
**Depends on**: Phase 30
**Requirements**: GATE-12
**Success Criteria** (what must be TRUE):
  1. gate-verifier is run against at least 5 artifacts of varying quality (strong, adequate, weak, borderline, fabricated)
  2. Verifier outcomes align with expected quality judgments — weak artifacts receive Recycle, strong artifacts receive Go
  3. Validation result is documented with a go/no-go decision: proceed with dual-layer or fall back to inline rubric
**Plans**: TBD

Plans:
- [ ] 33-01: Design and execute gate-verifier pre-build validation across quality range; document outcome

### Phase 34: Semantic Gates
**Goal**: G3 (Design), G5 (Spike), and G2-semantic (Research sufficiency) use dual-layer evaluation — structural check first, then semantic verification via gate-verifier agent with per-dimension scoring and completeness validation
**Depends on**: Phase 32, Phase 33
**Requirements**: GATE-06, GATE-07, GATE-08, GATE-09, GATE-10, GATE-11
**Success Criteria** (what must be TRUE):
  1. G3 and G5 run a structural pass first; the gate-verifier agent is only invoked if structural passes
  2. G2-semantic verifier checks whether research sufficiency ratings are actually justified by the cited evidence (not just declared)
  3. gate-verifier scores each evaluation across four dimensions: evidence_support, internal_consistency, assumption_transparency, reasoning_completeness — with chain-of-thought reasoning visible
  4. After gate-verifier returns, the invoking skill validates that all dimensions are scored, reasoning is present, and outcome is a valid enum value — surfacing an error if not
  5. A well-evidenced design document receives Go; a design with unsupported claims receives Recycle with specific dimension failures named
**Plans**: TBD

Plans:
- [ ] 34-01: Implement G3 (design) dual-layer gate with gate-verifier integration
- [ ] 34-02: Implement G5 (spike) dual-layer gate and G2-semantic verifier integration
- [ ] 34-03: End-to-end semantic gate validation across all three gates

### Phase 35: Worktree and Git Workflow
**Goal**: The task-implementer agent runs in worktree isolation with sequential merge-back, and the execute skill creates atomic conventional-format git commits after each verified task — with opt-out, failed-task protection, and git error pausing
**Depends on**: Phase 30
**Requirements**: WKTR-01, WKTR-02, WKTR-03, DEVW-01, DEVW-02, DEVW-03, DEVW-04, DEVW-05, DEVW-06
**Success Criteria** (what must be TRUE):
  1. task-implementer agent frontmatter includes `isolation: worktree`; a single-task run creates a worktree, implements, and merges back cleanly
  2. After each verified task, execute skill creates a git commit with message format `{type}(DA-{N}): {task_description}` — only staging files explicitly modified by that task
  3. User can set an opt-out flag (per-invocation or per-lifecycle) to skip auto-commits; commits do not appear when opted out
  4. A task that fails verification does not auto-commit; the execute skill prompts the user with recovery options
  5. A git error (merge conflict, dirty worktree) pauses execution and shows instructions — the skill does not attempt auto-resolution
**Plans**: TBD

Plans:
- [ ] 35-01: Add worktree isolation to task-implementer; implement and test single-task worktree merge-back
- [ ] 35-02: Implement per-task git commit flow in execute skill (conventional format, selective staging, opt-out, error handling)

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
| 30. Agent Formalization | v3.0 | Complete    | 2026-03-16 | 2026-03-16 |
| 31. Skill Thinning | 1/3 | In Progress|  | - |
| 32. Structural Gates | v3.0 | 0/2 | Not started | - |
| 33. Verifier Validation | v3.0 | 0/1 | Not started | - |
| 34. Semantic Gates | v3.0 | 0/3 | Not started | - |
| 35. Worktree and Git Workflow | v3.0 | 0/2 | Not started | - |
