# Requirements: Expedite v2.0

**Defined:** 2026-03-12
**Core Value:** Developers can run a complete evidence-based lifecycle -- from scoping questions through researched design to executable plan -- without losing context, skipping steps, or making decisions without evidence.

## v2.0 Requirements

Requirements for v2.0 Agent Harness Foundation (M1-M2). Each maps to roadmap phases.

### State Management

- [x] **STATE-01**: User invokes any skill and only the state files relevant to that skill are loaded (scoped injection per consumption matrix)
- [x] **STATE-02**: User can inspect lifecycle state across 5 separate files: state.yml (~15 lines), checkpoint.yml, questions.yml, gates.yml, tasks.yml
- [x] **STATE-03**: session-summary.md is created at session end and loaded by all skill frontmatter
- [x] **STATE-04**: audit.log records override events (append-only, never loaded into LLM context)

### Hook Enforcement

- [x] **HOOK-01**: User's invalid phase transition is blocked with a specific, actionable denial message
- [x] **HOOK-02**: User's attempt to advance to a `_complete` phase is blocked until the required gate has a passing result in gates.yml
- [x] **HOOK-03**: User's checkpoint step regression is blocked (step number cannot decrease without justification)
- [x] **HOOK-04**: User's gates.yml writes are validated for structure (valid gate ID, outcome enum, override_reason when overridden)
- [x] **HOOK-05**: User's non-state Write calls pass through without interception
- [x] **HOOK-06**: All hooks are Node.js command handlers with js-yaml as the only runtime dependency
- [x] **HOOK-07**: Hook-induced latency is under 300ms p99 per state write

### Override Mechanism

- [x] **OVRD-01**: User's denied state write produces an actionable denial reason with explicit retry instructions
- [x] **OVRD-02**: User can override a gate by writing an override record to gates.yml, then retrying the state write
- [x] **OVRD-03**: gates.yml writes are not intercepted for gate passage checks (prevents override deadlock)
- [x] **OVRD-04**: After 3 denials for the same pattern, user sees a suggestion to intervene directly
- [x] **OVRD-05**: User can bypass all enforcement via `EXPEDITE_HOOKS_DISABLED=true` for debugging
- [x] **OVRD-06**: All skill preambles include an override protocol section before the LLM encounters a denial

### Resume & Recovery

- [x] **RESM-01**: User resumes a skill and lands on the correct step based on checkpoint.yml (deterministic, not heuristic)
- [x] **RESM-02**: All skills write checkpoint.yml at every step transition with skill, step, label, substep, continuation_notes
- [x] **RESM-03**: substep and continuation_notes capture mid-step context (e.g., "3 of 5 researchers dispatched")
- [x] **RESM-04**: Artifact-existence checking is secondary fallback; checkpoint.yml is the primary resume mechanism

### Session Handoff

- [x] **SESS-01**: Stop hook writes session-summary.md with phase, skill, step, accomplishments, next action
- [x] **SESS-02**: PreCompact hook backs up checkpoint.yml to checkpoint.yml.pre-compact before compaction
- [x] **SESS-03**: PreCompact hook writes session-summary.md before compaction
- [x] **SESS-04**: Each skill's frontmatter includes session-summary.md for next-session context

## Future Requirements

Deferred to v2.1+ (M3-M8 milestone after M1-M2 validation).

### Agent Formalization (M3)

- **AGNT-01**: All agent prompt templates migrated to agents/*.md with full Claude Code subagent frontmatter
- **AGNT-02**: Agent dispatch by name works with model tier and tool restrictions enforced
- **AGNT-03**: Non-execute agents have EnterWorktree in disallowedTools

### Skill Thinning (M4)

- **THIN-01**: All skills under 200 lines (down from 500-860)
- **THIN-02**: Business logic lives in agents, skills are step sequencers

### Gate Evaluation (M5/M6)

- **GATE-01**: G1, G2-structural, G4 run as deterministic Node.js scripts
- **GATE-02**: G3, G5 use dual-layer evaluation (structural rubric + reasoning verifier agent)
- **GATE-03**: External verifier agent checks research reasoning soundness

### Worktree Isolation (M7)

- **WKTR-01**: task-implementer agent runs in isolated worktree
- **WKTR-02**: Per-task atomic git commits with DA traceability

### Session Enhancement (M8)

- **SENH-01**: SessionStart hook for automatic context injection (when platform bugs fixed)

### Carried Forward from v1.2

- **QUAL-05**: Design skill surfaces competing alternatives only when evidence shows genuine tradeoffs
- **QUAL-06**: Design skill proposes single recommendation when evidence clearly favors one approach
- **MAINT-01**: Skills under 500-line soft cap via content extraction to references/

## Out of Scope

| Feature | Reason |
|---------|--------|
| Agent formalization (M3) | Future milestone -- no dependency on M1-M2 |
| Skill thinning (M4) | Future milestone -- requires M3 first |
| Gate evaluation logic (M5/M6) | Future milestone -- hooks only check existing gate results |
| Worktree isolation (M7) | Future milestone -- requires M3 first |
| SessionStart hook | 3 open Claude Code bugs (#16538, #13650, #11509) |
| Cross-lifecycle artifact import | Novel feature, needs design research |
| Agent Teams (mesh communication) | 3-4x token cost, pipeline fits hub-and-spoke |
| TypeScript for hooks | Build step overhead not justified for solo developer |
| Per-agent hooks | Plugin-level hooks sufficient initially |
| Monolithic state.yml migration tooling | Complete-rewrite semantics handle schema changes on first write |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| STATE-01 | Phase 25 | Complete |
| STATE-02 | Phase 25 | Complete |
| STATE-03 | Phase 29 | Complete |
| STATE-04 | Phase 27 | Complete |
| HOOK-01 | Phase 26 | Complete |
| HOOK-02 | Phase 26 | Complete |
| HOOK-03 | Phase 26 | Complete |
| HOOK-04 | Phase 26 | Complete |
| HOOK-05 | Phase 25 | Complete |
| HOOK-06 | Phase 25 | Complete |
| HOOK-07 | Phase 25 | Complete |
| OVRD-01 | Phase 27 | Complete |
| OVRD-02 | Phase 27 | Complete |
| OVRD-03 | Phase 27 | Complete |
| OVRD-04 | Phase 27 | Complete |
| OVRD-05 | Phase 27 | Complete |
| OVRD-06 | Phase 27 | Complete |
| RESM-01 | Phase 28 | Complete |
| RESM-02 | Phase 28 | Complete |
| RESM-03 | Phase 28 | Complete |
| RESM-04 | Phase 28 | Complete |
| SESS-01 | Phase 29 | Complete |
| SESS-02 | Phase 29 | Complete |
| SESS-03 | Phase 29 | Complete |
| SESS-04 | Phase 29 | Complete |

**Coverage:**
- v2.0 requirements: 25 total
- Mapped to phases: 25
- Unmapped: 0

---
*Requirements defined: 2026-03-12*
*Last updated: 2026-03-12 after roadmap creation*
