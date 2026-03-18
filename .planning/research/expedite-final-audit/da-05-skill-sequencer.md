# DA-5: Skill Step-Sequencer and Checkpoint Integrity

## Summary

All 7 skills' step sequences are reachable from resume logic. Checkpoint writes are schema-compliant. However, **2 bugs** and **6 gaps** were found, including a P0 (execute skill missing completion checkpoint) and a significant state-split migration oversight.

## q15: Step Sequence Completeness

| Skill | Steps | Contiguous | Resume Routing | Verdict |
|-------|-------|------------|----------------|---------|
| Scope | 1-10 | Yes | All reachable | PASS |
| Research | 1-5, 9, 11-14 | **No** (6,7,8,10 missing) | Missing steps unreachable | PARTIAL PASS |
| Design | 1-10 | Yes | All reachable | PASS |
| Plan | 1-8 | Yes | All reachable | PASS |
| Spike | 1-7 | Yes | All reachable | PASS |
| Execute | 1-7 | Yes | All reachable | PASS |
| Status | N/A | N/A | N/A | N/A (read-only) |

**GAP-1 (Medium):** Research skill has non-contiguous step numbering (steps 6,7,8,10 missing). Status skill reports "18" total steps but only 14 exist. Resume to a missing step number would fail silently or route to wrong step.

## q16: Checkpoint Schema Compliance

All checkpoint writes produce YAML that passes the checkpoint schema validator. Fields `skill`, `step`, `label`, `substep`, `continuation_notes`, `inputs_hash`, `updated_at` all contain values of the correct type across all skills.

**BUG-1 (P0): Execute skill does not write completion checkpoint at lifecycle end.** Every other lifecycle-advancing skill writes a completion checkpoint with `step: "complete"` at its final step, but execute's Step 7 only updates state.yml. This leaves stale task-level checkpoint data (e.g., `step: 5, substep: "executing_task_T3"`) in checkpoint.yml after lifecycle completion.

**GAP-2 (Low):** Design, plan, and spike completion checkpoints say "Write completion checkpoint" without explicit YAML templates. Scope and research include explicit templates. The instruction is unambiguous enough that Claude should produce valid output, but explicit templates would be safer.

## q17: Backup-Before-Write Pattern

| Skill | State Writes | All Have Backup | Issues |
|-------|-------------|-----------------|--------|
| Scope | Steps 3, 4, 9b, 10 | Yes | None |
| Research | Steps 1, 2, 12 | Mostly | Step 12 missing explicit backup |
| Design | Steps 1, 10 | Yes | None |
| Plan | Steps 1, 8 | Yes | None |
| Spike | Steps 1, 7 | Yes | Fully explicit |
| Execute | Steps 1, 5d, 6, 7 | Partially | Steps 5d, 6, 7 missing explicit backup |
| Status | None | N/A | Read-only skill |

**BUG-2 (P1):** Research skill uses relative path in backup cp command: `cp state.yml state.yml.bak` instead of `cp .expedite/state.yml .expedite/state.yml.bak` — inconsistent with all 5 other skills.

**GAP-5 (Low-Medium):** Execute Steps 5d, 6, and 7 write state.yml without explicit backup-before-write instructions.

**GAP-6 (Low-Medium):** Research Step 12 writes state.yml without explicit backup-before-write.

## Bugs Found

| # | Severity | Location | Description |
|---|----------|----------|-------------|
| BUG-1 | P0 | skills/execute/SKILL.md Step 7 | Missing completion checkpoint write — leaves stale checkpoint data after lifecycle completion |
| BUG-2 | P1 | skills/research/SKILL.md line 42 | Relative path in backup cp command (`cp state.yml state.yml.bak` instead of full `.expedite/` path) |

## Gaps Found

| # | Severity | Description |
|---|----------|-------------|
| GAP-1 | Medium | Research skill non-contiguous step numbering (6,7,8,10 missing); status skill reports wrong total |
| GAP-2 | Low | Design, plan, spike completion checkpoints lack explicit YAML templates |
| GAP-3 | High | Scope Step 9b writes `questions` array to state.yml, but v2 state split moved questions to `questions.yml`. State schema doesn't define `questions` field — migration oversight |
| GAP-4 | Medium | All 6 non-status skills write `current_step` to state.yml, but v2 state schema doesn't define this field (removed per state-recovery docs). Redundant with checkpoint.yml |
| GAP-5 | Low-Medium | Execute Steps 5d, 6, 7 write state.yml without explicit backup-before-write |
| GAP-6 | Low-Medium | Research Step 12 writes state.yml without explicit backup-before-write |
