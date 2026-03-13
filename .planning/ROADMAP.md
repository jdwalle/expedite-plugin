# Roadmap: Expedite Plugin

## Milestones

- ✅ **v1.0 Expedite Plugin Initial Release** -- Phases 1-13 (shipped 2026-03-09)
- ✅ **v1.1 Production Polish** -- Phases 14-18 (shipped 2026-03-11)
- ✅ **v1.2 Infrastructure Hardening & Quality** -- Phase 19 (shipped 2026-03-12)
- 🚧 **v2.0 Agent Harness Foundation** -- Phases 25-29 (in progress)

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

### v2.0 Agent Harness Foundation (In Progress)

**Milestone Goal:** Evolve from prompt-driven orchestration to code-enforced agent harness -- state splitting with hook validation, checkpoint-based deterministic resume, override mechanism with audit trail, and session handoff across session boundaries.

- [x] **Phase 25: State Splitting and Hook Infrastructure** - Split monolithic state.yml into 5 scoped files; build Node.js hook scaffolding with schema validation and non-state passthrough (completed 2026-03-13)
- [x] **Phase 26: Phase Transition Enforcement** - FSM phase transitions, gate passage requirements, checkpoint regression guards, and gates.yml structural validation (completed 2026-03-13)
- [x] **Phase 27: Override Mechanism and Audit Trail** - Deny-override-retry flow with actionable denials, override records in gates.yml, PostToolUse audit hook, escalation, and env var bypass (completed 2026-03-13)
- [x] **Phase 28: Checkpoint-Based Resume** - Generalize checkpoint.yml writes to all skills; deterministic resume from checkpoint with substep context and artifact fallback (completed 2026-03-13)
- [x] **Phase 29: Session Handoff** - Stop and PreCompact hooks write session-summary.md; frontmatter injection for next-session context; checkpoint backup before compaction (completed 2026-03-13)

## Phase Details

### Phase 25: State Splitting and Hook Infrastructure
**Goal**: Each skill loads only the state files it needs, and every state write passes through a Node.js validation hook that enforces schema correctness
**Depends on**: Nothing (foundation for all v2.0 phases)
**Requirements**: STATE-01, STATE-02, HOOK-05, HOOK-06, HOOK-07
**Success Criteria** (what must be TRUE):
  1. User invokes any skill and only the state files relevant to that skill are injected via frontmatter (per the consumption matrix: scope/research get questions.yml, execute gets tasks.yml, gate/status get gates.yml)
  2. User can inspect lifecycle state across 5 separate files in `.expedite/` (state.yml ~15 lines, checkpoint.yml, questions.yml, gates.yml, tasks.yml) instead of one monolithic file
  3. PreToolUse hook on Write is registered in .claude/settings.json, intercepts `.expedite/*.yml` writes, and performs schema validation (FSM and gate logic added in Phase 26)
  4. PostToolUse audit hook is registered and logs state changes (override-specific logic added in Phase 27)
  5. User's Write call to a non-`.expedite/` path passes through the hook without delay or interception
  6. All hook scripts are Node.js command handlers with js-yaml as the only runtime dependency (no shell scripts, no build step, no additional npm packages)
  7. Hook-induced latency is under 300ms p99 per state write (measured across first 100 writes)
**Plans**: 3 plans

Plans:
- [x] 25-01-PLAN.md -- State file schemas, validators, and 5 templates
- [ ] 25-02-PLAN.md -- PreToolUse and PostToolUse hook scripts with settings.json registration
- [ ] 25-03-PLAN.md -- Skill frontmatter scoped injection and state recovery protocol update

### Phase 26: Phase Transition Enforcement
**Goal**: Invalid lifecycle transitions are structurally impossible -- the enforcement layer blocks invalid phase advances, missing gate passages, and checkpoint regressions before they reach disk
**Depends on**: Phase 25 (hook infrastructure and state files must exist)
**Requirements**: HOOK-01, HOOK-02, HOOK-03, HOOK-04
**Success Criteria** (what must be TRUE):
  1. User's attempt to write an invalid phase transition (e.g., scope_in_progress to design_in_progress) is blocked with a specific denial message naming the invalid transition and listing valid alternatives
  2. User's attempt to advance to a `_complete` phase is blocked until gates.yml contains a passing result (go, go-with-advisory, or overridden) for the required gate
  3. User's checkpoint.yml write that decreases the step number is blocked unless the inputs_hash differs from the current checkpoint (changed inputs justify re-execution)
  4. User's gates.yml write is validated for structure: valid gate ID matching the current phase, recognized outcome enum, and override_reason present when outcome is "overridden"
**Plans**: 2 plans

Plans:
- [x] 26-01-PLAN.md -- FSM transition library, gate passage checker, VALID_PHASES update
- [x] 26-02-PLAN.md -- Integrate FSM and gate checks into validate-state-write hook

### Phase 27: Override Mechanism and Audit Trail
**Goal**: Users can deliberately bypass enforcement when justified, with every override auditable and traceable -- the system preserves user agency without silent escape hatches
**Depends on**: Phase 26 (enforcement must produce denials for the override flow to handle)
**Requirements**: OVRD-01, OVRD-02, OVRD-03, OVRD-04, OVRD-05, OVRD-06, STATE-04
**Success Criteria** (what must be TRUE):
  1. When a state write is denied, the user sees an actionable denial reason that includes explicit retry instructions ("Write an override record to gates.yml, then retry the state write")
  2. User can override a gate by writing an override record to gates.yml (with override_reason), then retrying the original state write -- the hook recognizes the override and allows the transition
  3. gates.yml writes are not intercepted for gate passage checks (only schema-validated), preventing override deadlock where writing the override itself requires passing the gate
  4. After 3 denials for the same transition pattern, the user sees a suggestion to intervene directly (edit state files manually or use EXPEDITE_HOOKS_DISABLED)
  5. User can set `EXPEDITE_HOOKS_DISABLED=true` to bypass all enforcement for debugging, and all hooks exit 0 immediately
**Plans**: 2 plans

Plans:
- [x] 27-01-PLAN.md -- Actionable denials, override deadlock prevention, denial escalation, and audit enrichment
- [x] 27-02-PLAN.md -- Skill preamble override protocol injection

### Phase 28: Checkpoint-Based Resume
**Goal**: Resuming a skill after any interruption (crash, /clear, new session) lands on the correct step deterministically from checkpoint.yml, not from artifact-existence heuristics
**Depends on**: Phase 25 (checkpoint.yml must exist and be hook-validated)
**Requirements**: RESM-01, RESM-02, RESM-03, RESM-04
**Success Criteria** (what must be TRUE):
  1. User resumes any skill and lands on the exact step recorded in checkpoint.yml (deterministic, not heuristic) -- checkpoint.skill matches the invoked skill, resume at checkpoint.step
  2. Every skill writes checkpoint.yml at every step transition with skill, step, label, substep, and continuation_notes fields
  3. Mid-step context is preserved: substep records sub-state (e.g., "waiting_for_agents") and continuation_notes records progress (e.g., "3 of 5 researchers dispatched")
  4. Artifact-existence checking is used as a secondary fallback only when checkpoint.yml is missing or its skill field does not match the invoked skill
**Plans**: 2 plans

Plans:
- [ ] 28-01-PLAN.md -- Add checkpoint.yml write protocol to all 6 skills at every step transition
- [ ] 28-02-PLAN.md -- Rewrite resume logic to use checkpoint.yml as primary mechanism with artifact fallback

### Phase 29: Session Handoff
**Goal**: Session boundaries are invisible to the user -- context from the previous session is automatically preserved and loaded, and compaction events do not lose checkpoint state
**Depends on**: Phase 25 (hook infrastructure), Phase 28 (checkpoint.yml written by all skills)
**Requirements**: SESS-01, SESS-02, SESS-03, SESS-04, STATE-03
**Success Criteria** (what must be TRUE):
  1. When a session ends, the Stop hook writes session-summary.md with current phase, skill, step, accomplishments, and recommended next action
  2. When compaction occurs, the PreCompact hook backs up checkpoint.yml to checkpoint.yml.pre-compact before compaction and writes session-summary.md
  3. User starts a new session and the skill's frontmatter includes session-summary.md, providing narrative context ("Resuming research, step 7: Dispatch web researchers. 3 of 5 dispatched.")
  4. session-summary.md is created at session end and loaded by all skill frontmatter as the primary orientation mechanism for next-session context
**Plans**: 2 plans

Plans:
- [ ] 29-01-PLAN.md -- Stop and PreCompact hook scripts with session-summary.md generation and checkpoint backup
- [ ] 29-02-PLAN.md -- Add session-summary.md frontmatter injection to all 7 skills

## Progress

**Execution Order:**
Phases execute in numeric order: 25 -> 26 -> 27 -> 28 -> 29

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
| 27. Override + Audit | v2.0 | Complete    | 2026-03-13 | 2026-03-13 |
| 28. Checkpoint Resume | 2/2 | Complete    | 2026-03-13 | - |
| 29. Session Handoff | 2/2 | Complete    | 2026-03-13 | - |
