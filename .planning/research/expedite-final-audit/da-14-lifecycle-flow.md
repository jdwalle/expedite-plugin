# DA-14: Lifecycle Flow Logical Coherence

## Summary

The lifecycle sequence (scope → research → design → plan → spike → execute) is broadly sound in its information flow: each phase produces artifacts that the next phase genuinely needs. However, **3 bugs** and **2 information gaps** were found that would cause runtime failures or silent data inconsistency.

The most severe issues: (1) the FSM enforces spike as mandatory but the execute skill accepts `plan_complete` as entry, which the hook will block; (2) the execute skill writes `phase: "complete"` directly, skipping the `execute_complete` intermediate state the FSM requires; (3) the status skill completely omits spike phases from its display mappings.

## q41: Gate-to-Phase Alignment — PASS

All 5 gates check properties genuinely needed by their downstream phase:

| Gate | Validates | For Phase | Aligned |
|------|-----------|-----------|---------|
| G1 | SCOPE.md structure + questions | Research | Yes |
| G2 | SYNTHESIS.md + DA coverage + evidence | Design | Yes |
| G3 | DESIGN.md + DA coverage + evidence citations | Plan | Yes |
| G4 | PLAN.md + TD references + DA coverage | Spike | Yes |
| G5 | SPIKE.md + TD resolutions + implementation steps | Execute | Yes |

No gate checks the wrong things. All gate criteria are relevant to their downstream phase's input requirements.

## q42: Information Gap Analysis — 2 data-location gaps

All 5 phase transitions have complete artifact coverage — no phase N+1 requires data that phase N fails to produce.

**GAP-1 (P2):** Scope writes questions to `state.yml` instead of `questions.yml` (the v2 split file). G1 reads from `state.questions`. Works at runtime but architecturally inconsistent with the v2 design.

**GAP-2 (P2):** Execute writes `current_wave`, `current_task`, and `tasks` array to `state.yml` instead of `tasks.yml`. Same inconsistency — data lives in the wrong file per v2 state split architecture.

These are data-location issues, not missing-data issues. The lifecycle functions but uses the wrong files for some data.

## q43: Skip Path Correctness — BROKEN

The only skip path (skipping spike when no TDs exist) is **broken**:

1. The FSM has no `plan_complete → execute_in_progress` transition. The only valid transition from `plan_complete` is `plan_complete → spike_in_progress`.
2. The execute skill's Step 1/Step 3 accepts `plan_complete` as entry and writes `execute_in_progress` — the hook will deny this write.
3. Additionally, execute Step 7 writes `phase: "complete"` directly, skipping the FSM's required `execute_complete` intermediate phase.

## Bugs Found

| # | Severity | Location | Description |
|---|----------|----------|-------------|
| BUG-1 | P0 | fsm.js vs skills/execute/SKILL.md Step 1/3 | FSM blocks `plan_complete → execute_in_progress` (spike skip path broken). Execute skill accepts `plan_complete` as entry but hook will deny the state write. Status skill also incorrectly recommends `/expedite:execute` from `plan_complete`. |
| BUG-2 | P0 | fsm.js vs skills/execute/SKILL.md Step 7 | FSM requires `execute_in_progress → execute_complete → complete` but execute writes `phase: "complete"` directly, skipping `execute_complete`. Lifecycle cannot reach terminal state. |
| BUG-3 | P1 | skills/status/SKILL.md | Status skill missing `spike_in_progress` and `spike_complete` phases from all display mappings — phase ordering, human-readable descriptions, and next-action routing all omit spike. Users in spike phases get no status display. |

## Information Gaps Found

| # | Severity | Description |
|---|----------|-------------|
| GAP-1 | P2 | Questions written to state.yml instead of questions.yml (v2 split inconsistency) |
| GAP-2 | P2 | Execute task data written to state.yml instead of tasks.yml (v2 split inconsistency) |
