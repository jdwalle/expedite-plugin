# DA-2: Finite State Machine Validity

## Summary

The FSM is structurally sound (complete, acyclic, gate-consistent) but **2 medium-severity bugs** exist in the execute skill's phase transitions that will cause runtime hook denials. Additionally, 5 lower-severity inconsistencies were found.

## q06: FSM Completeness and Acyclicity — PASS

The FSM in `hooks/lib/fsm.js` defines a strict linear chain of 14 phases from `not_started` to `archived`. Each phase has exactly one forward transition. The terminal state `archived` has no outgoing transition (correct by design). The graph is acyclic — every `to` value references a later phase in the chain, and `validateTransition()` structurally prevents backward/lateral transitions.

**Full transition chain:**
```
not_started → scope_in_progress → scope_complete → research_in_progress → research_complete → design_in_progress → design_complete → plan_in_progress → plan_complete → spike_in_progress → spike_complete → execute_in_progress → execute_complete → complete → archived
```

Each phase has exactly one forward transition. No backward or lateral transitions exist. Proof: every `to` field in the TRANSITIONS map points to the next phase in the linear chain, and `validateTransition(from, to)` only allows transitions where `from` matches a key and `to` matches that key's `to` value.

## q07: Gate Consistency — PASS

All 5 gates (G1-G5) have perfect 1:1:1 correspondence across three locations:

| Gate | fsm.js (guards transition) | gate-checks.js GATE_PHASE_MAP | gates/ script |
|------|---------------------------|-------------------------------|---------------|
| G1 | scope_in_progress → scope_complete | `['scope_in_progress', 'scope_complete']` | g1-scope.js |
| G2 | research_in_progress → research_complete | `['research_in_progress', 'research_complete']` | g2-structural.js |
| G3 | design_in_progress → design_complete | `['design_in_progress', 'design_complete']` | g3-design.js |
| G4 | plan_in_progress → plan_complete | `['plan_in_progress', 'plan_complete']` | g4-plan.js |
| G5 | spike_in_progress → spike_complete | `['spike_in_progress', 'spike_complete']` | g5-spike.js |

No orphaned scripts, no missing scripts, no mismatched IDs.

## q08: Skill Phase Transitions — 2 BUGS FOUND

### BUG-1 (Medium): Execute skill writes invalid terminal transition
`skills/execute/SKILL.md` Step 7 writes `phase: "complete"` directly from `execute_in_progress`. The FSM requires the intermediate step `execute_in_progress → execute_complete → complete`. The hook will **block this at runtime**.

### BUG-2 (Medium): Execute skill accepts invalid entry phase
`skills/execute/SKILL.md` Step 1/3 accepts `plan_complete` as a valid entry and writes `execute_in_progress`. The FSM requires `plan_complete → spike_in_progress` first. The hook will **block this at runtime**.

## Inconsistencies Found

1. **INCONSISTENCY-1 (Low)**: `--override` entry paths in design and plan skills attempt FSM-skipping transitions that the hook will block without override flag
2. **INCONSISTENCY-2 (Low)**: Research skill's "start over" backward transition (`research_in_progress → scope_complete`) will be blocked by the FSM's forward-only constraint
3. **INCONSISTENCY-3 (Info)**: `execute_complete` is a dead state — defined in FSM but never written by any skill (the execute skill jumps directly to `complete`)
4. **INCONSISTENCY-4 (Info)**: Status skill's phase ordering omits `spike_in_progress`, `spike_complete`, `execute_complete`, and `archived`
5. **INCONSISTENCY-5 (Info)**: G2 script named `g2-structural.js` instead of `g2-research.js` (convention deviation, not a bug)

## Bugs Found

| # | Severity | Location | Description |
|---|----------|----------|-------------|
| BUG-1 | Medium | skills/execute/SKILL.md Step 7 | Writes `phase: "complete"` skipping `execute_complete` — FSM will deny |
| BUG-2 | Medium | skills/execute/SKILL.md Step 1/3 | Accepts `plan_complete` entry — FSM requires spike phases first |
