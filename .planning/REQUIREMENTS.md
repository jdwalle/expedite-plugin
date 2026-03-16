# Requirements: Expedite v3.0

**Defined:** 2026-03-15
**Core Value:** Developers can run a complete evidence-based lifecycle — from scoping questions through researched design to executable plan — without losing context, skipping steps, or making decisions without evidence.

## v3.0 Requirements

Requirements for v3.0 Agent Harness Completion (M3-M7). Each maps to roadmap phases.

### Agent Formalization

- [ ] **AGNT-01**: Each agent exists as `agents/{name}.md` with frontmatter (model, description, tools/disallowedTools, maxTurns, system prompt)
- [ ] **AGNT-02**: Skills dispatch agents by name via the Agent tool and receive structured results
- [ ] **AGNT-03**: All non-execute agents include EnterWorktree in disallowedTools
- [ ] **AGNT-04**: 8 core agents created: web-researcher, codebase-researcher, research-synthesizer, design-architect, plan-decomposer, spike-researcher, task-implementer, gate-verifier
- [ ] **AGNT-05**: Premium-tier agents (research-synthesizer, design-architect, gate-verifier) use Opus model
- [ ] **AGNT-06**: Balanced-tier agents (web-researcher, codebase-researcher, plan-decomposer, spike-researcher, task-implementer) use Sonnet model
- [ ] **AGNT-07**: research-synthesizer and gate-verifier have `memory: project` in frontmatter
- [ ] **AGNT-08**: Tool restriction test confirms dispatched agent cannot use a restricted tool

### Skill Thinning

- [ ] **THIN-01**: All skills refactored to step-sequencer + agent-dispatcher pattern (under 200 lines, adjust to 400 if scope skill needs it)
- [ ] **THIN-02**: Business logic lives in agents; skills retain step sequencing, state writes, checkpoint writes, agent dispatch, result validation
- [ ] **THIN-03**: Gate results written to `.expedite/gates.yml` (fixes INT-01/FLOW-01 integration debt)
- [ ] **THIN-04**: Gated phase transitions work end-to-end without override workaround or EXPEDITE_HOOKS_DISABLED
- [ ] **THIN-05**: Skills validate agent output on return (artifact exists, basic structure check)
- [ ] **THIN-06**: Skills write state/checkpoint after agent completion, never during agent execution

### Gate Enforcement

- [ ] **GATE-01**: G1 (Scope) runs as deterministic Node.js script checking SCOPE.md existence, required sections (problem, goals, constraints, decision areas), minimum word counts
- [ ] **GATE-02**: G2-structural runs as deterministic Node.js script checking synthesis file existence, category files referenced in SCOPE.md, DA synthesis sections, READINESS.md with per-DA status (no DA has status "INSUFFICIENT")
- [ ] **GATE-03**: G4 (Plan) runs as deterministic Node.js script checking PLAN.md existence, phased breakdown, tasks with assigned agents, dependency chain
- [ ] **GATE-04**: Gate scripts write structured results to gates.yml with specific, actionable failure messages
- [ ] **GATE-05**: Each structural gate runs as part of skill completion flow — skill invokes gate script, script writes gates.yml, PreToolUse hook checks on phase transition
- [ ] **GATE-06**: G3 (Design) uses dual-layer evaluation — structural check then semantic verification via gate-verifier agent
- [ ] **GATE-07**: G5 (Spike) uses dual-layer evaluation — structural check then semantic verification via gate-verifier agent
- [ ] **GATE-08**: G2-semantic — verifier checks whether evidence sufficiency ratings are justified by cited evidence
- [ ] **GATE-09**: gate-verifier uses per-dimension scoring (evidence_support, internal_consistency, assumption_transparency, reasoning_completeness) with chain-of-thought evaluation
- [ ] **GATE-10**: Structural layer runs first; semantic layer only runs if structural passes
- [ ] **GATE-11**: Gate skill validates evaluation completeness after verifier returns (all dimensions scored, reasoning provided, valid outcome enum)
- [ ] **GATE-12**: Pre-build validation tests gate-verifier on 5-6 artifacts spanning quality range before committing to dual-layer system

### Worktree Isolation

- [ ] **WKTR-01**: task-implementer agent gets `isolation: worktree` in frontmatter
- [ ] **WKTR-02**: Sequential merge from worktree to main branch after task completion
- [ ] **WKTR-03**: Single-task worktree test verifies clean merge-back

### Developer Workflow

- [ ] **DEVW-01**: Execute skill creates an atomic git commit after each verified task
- [ ] **DEVW-02**: Commit message follows conventional format: `{type}(DA-{N}): {task_description}`
- [ ] **DEVW-03**: Only files explicitly modified by the task are staged (never `git add .` or `git add -A`)
- [ ] **DEVW-04**: User can opt out of auto-commits (per-invocation flag or per-lifecycle setting)
- [ ] **DEVW-05**: Failed task verification does not auto-commit; user is prompted with options
- [ ] **DEVW-06**: Git errors (merge conflicts, dirty worktree) pause execution with instructions, not auto-resolve

## Future Requirements

Deferred beyond v3.0.

### Deferred (from PRODUCT-DESIGN.md)

- **TEAM-01**: Agent Teams with mesh communication (3-4x token cost, pipeline fits hub-and-spoke)
- **EVAL-01**: Fine-tuned evaluator models for gate verification
- **ANLZ-01**: Cross-lifecycle analytics dashboard
- **MLTU-01**: Multi-user support
- **SENH-01**: SessionStart hook for automatic context injection (blocked by 3 Claude Code platform bugs)

### Carried Forward from v1.2

- **QUAL-05**: Design skill surfaces competing alternatives only when evidence shows genuine tradeoffs
- **QUAL-06**: Design skill proposes single recommendation when evidence clearly favors one approach

## Out of Scope

| Feature | Reason |
|---------|--------|
| Agent Teams (mesh communication) | 3-4x token cost; pipeline fits hub-and-spoke pattern |
| Fine-tuned evaluator models | Requires training pipeline; structured rubrics capture 75-80% of benefit |
| Cross-lifecycle analytics dashboard | Novel feature, needs design research |
| Multi-user support | Single-developer workflow |
| SessionStart hook | 3 open Claude Code bugs (#16538, #13650, #11509) |
| Lifecycle pipeline changes | Decision 5, ROCK SOLID — scope/research/design/plan/spike/execute is fixed |
| Per-agent hooks (hook frontmatter) | A1 confirmed: plugin-level hooks fire on subagent writes, per-agent hooks unnecessary |
| TypeScript for hooks/gates | Build step overhead not justified for solo developer |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| AGNT-01 | Phase 30 | Pending |
| AGNT-02 | Phase 30 | Pending |
| AGNT-03 | Phase 30 | Pending |
| AGNT-04 | Phase 30 | Pending |
| AGNT-05 | Phase 30 | Pending |
| AGNT-06 | Phase 30 | Pending |
| AGNT-07 | Phase 30 | Pending |
| AGNT-08 | Phase 30 | Pending |
| THIN-01 | Phase 31 | Pending |
| THIN-02 | Phase 31 | Pending |
| THIN-03 | Phase 31 | Pending |
| THIN-04 | Phase 31 | Pending |
| THIN-05 | Phase 31 | Pending |
| THIN-06 | Phase 31 | Pending |
| GATE-01 | Phase 32 | Pending |
| GATE-02 | Phase 32 | Pending |
| GATE-03 | Phase 32 | Pending |
| GATE-04 | Phase 32 | Pending |
| GATE-05 | Phase 32 | Pending |
| GATE-06 | Phase 34 | Pending |
| GATE-07 | Phase 34 | Pending |
| GATE-08 | Phase 34 | Pending |
| GATE-09 | Phase 34 | Pending |
| GATE-10 | Phase 34 | Pending |
| GATE-11 | Phase 34 | Pending |
| GATE-12 | Phase 33 | Pending |
| WKTR-01 | Phase 35 | Pending |
| WKTR-02 | Phase 35 | Pending |
| WKTR-03 | Phase 35 | Pending |
| DEVW-01 | Phase 35 | Pending |
| DEVW-02 | Phase 35 | Pending |
| DEVW-03 | Phase 35 | Pending |
| DEVW-04 | Phase 35 | Pending |
| DEVW-05 | Phase 35 | Pending |
| DEVW-06 | Phase 35 | Pending |

**Coverage:**
- v3.0 requirements: 35 total
- Mapped to phases: 35
- Unmapped: 0 ✓

---
*Requirements defined: 2026-03-15*
*Last updated: 2026-03-15 after roadmap creation*
