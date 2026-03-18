# Phase 38: P0 Audit Fixes - Research

**Researched:** 2026-03-17
**Domain:** Expedite plugin runtime bug fixes (AUD-001 through AUD-007)
**Confidence:** HIGH

## Summary

This research validates the 7 P0 audit findings from the final audit research synthesis against the actual source code. Each finding was verified by reading the exact files and lines cited. All 7 bugs are confirmed as real, though AUD-005 has a nuance: the gates.yml schema already includes `"override"` in `VALID_GATE_OUTCOMES`, so the outcome value is technically accepted by schema validation -- but it is NOT in `PASSING_OUTCOMES`, meaning gate passage checks will still fail. Additionally, AUD-003 has a partial nuance: the scope skill's frontmatter already injects `questions.yml`, but Step 9b writes questions to `state.yml`, not `questions.yml`.

All fixes are to SKILL.md instruction files and one agent definition file (`task-implementer.md`). No JavaScript hook or gate code changes are needed for AUD-001 through AUD-007. The FSM already has the correct `execute_in_progress -> execute_complete -> complete` chain; the bug is entirely in the skill instructions telling Claude to skip the intermediate state.

**Primary recommendation:** Fix all 7 bugs in skill instructions, keeping changes minimal and surgical -- each fix is a small text edit to a SKILL.md or agent .md file. No structural refactoring needed.

## Validated Bug List

### AUD-001: Execute writes `phase: "complete"` directly, skipping `execute_complete`

**Status: CONFIRMED**
**Confidence: HIGH**

**Evidence:** Execute SKILL.md Step 7 (line 138) says:
```
Update state.yml: `phase: "complete"`, clear current_step/task/wave/tasks.
```

The FSM (`hooks/lib/fsm.js` lines 19-20) defines:
```javascript
'execute_in_progress': { to: 'execute_complete', gate: null },
'execute_complete':    { to: 'complete',          gate: null },
```

The skill writes `phase: "complete"` directly from `execute_in_progress`, but the FSM requires `execute_in_progress -> execute_complete -> complete`. The hook WILL deny this write. The lifecycle gets permanently stuck.

**Fix:** In Step 7 of execute SKILL.md, add an intermediate state write:
1. First write `phase: "execute_complete"` to state.yml (backup-before-write)
2. Then write `phase: "complete"` to state.yml (backup-before-write)

Both transitions are ungated (gate: null) in the FSM, so no gate passage is needed.

**Files to modify:** `skills/execute/SKILL.md` (Step 7)

### AUD-002: Execute accepts `plan_complete` as entry, but FSM requires spike first

**Status: CONFIRMED**
**Confidence: HIGH**

**Evidence:** Execute SKILL.md Step 1 (line 61) says:
```
**Case A: `phase: "plan_complete"` or `phase: "spike_complete"`** -- Fresh start.
```

Step 3 (line 79) says:
```
set `phase: "execute_in_progress"` (only if currently plan_complete or spike_complete)
```

The FSM (`hooks/lib/fsm.js` line 16) defines:
```javascript
'plan_complete': { to: 'spike_in_progress', gate: null },
```

The only valid transition from `plan_complete` is to `spike_in_progress`. Writing `execute_in_progress` from `plan_complete` will be denied by the FSM hook.

The spike skill handles this correctly -- its Step 1 Case A accepts `plan_complete` and writes `spike_in_progress`, and Step 9 writes `spike_complete`. There is no FSM transition for `plan_complete -> execute_in_progress`.

**Decision needed:** Should spike-skip be a supported path? The audit recommends deciding this. Based on the architecture:
- The spike skill already handles "no TDs" gracefully (Step 4 extracts TDs, Step 5 resolves them, if none -> fast path through)
- Adding an FSM transition `plan_complete -> execute_in_progress` would bypass the G5 gate, which validates spike quality
- The simpler fix is to remove `plan_complete` from execute's accepted phases and require spike to always run

**Recommended fix:** Remove `plan_complete` from execute Step 1 Case A and Step 3. Execute should only accept `spike_complete`. If there are no TDs, the spike skill runs quickly and produces a minimal SPIKE.md.

**Files to modify:** `skills/execute/SKILL.md` (Steps 1 and 3)

### AUD-003: Scope writes questions to `state.yml` instead of `questions.yml`

**Status: CONFIRMED**
**Confidence: HIGH**

**Evidence:** Scope SKILL.md Step 9b (lines 169-183) instructs writing a `questions` array to state.yml:
```
**9b. Update state.yml** (backup-before-write): set current_step to step 9, last_modified. Set `questions` array with entries per question:
```

But the v2 architecture uses `questions.yml` as the canonical location. The template (`templates/questions.yml.template`) defines:
```yaml
research_round: 0
questions: []
```

The research skill's frontmatter (line 25) already injects `questions.yml`:
```
Questions:
!`cat .expedite/questions.yml 2>/dev/null || echo "No questions"`
```

G1 gate (`gates/g1-scope.js` lines 57-58) reads questions from state.yml:
```javascript
var questions = (state && Array.isArray(state.questions)) ? state.questions : [];
```

So there are TWO problems:
1. Scope writes questions to state.yml (wrong target)
2. G1 reads questions from state.yml (wrong source)

If scope writes to questions.yml, G1 must also read from questions.yml.

The state.yml template has NO `questions` field -- it contains only: version, last_modified, project_name, intent, lifecycle_id, description, phase, started_at, phase_started_at. The schema would silently pass the unknown `questions` field, but downstream consumers reading from `questions.yml` would find nothing.

**Fix (two parts):**
1. Scope SKILL.md Step 9b: change "Update state.yml" to "Write questions.yml" for the questions array. State.yml should only get `current_step` and `last_modified` updates.
2. G1 gate script (`gates/g1-scope.js`): change to read questions from questions.yml instead of state.yml.

**Files to modify:** `skills/scope/SKILL.md` (Step 9b), `gates/g1-scope.js` (M2 and M5 criteria, S1 and S2 criteria)

**Important note:** This is the ONE bug that requires a JavaScript code change (g1-scope.js), not just skill instruction edits.

### AUD-004: Execute writes tasks to `state.yml` instead of `tasks.yml`

**Status: CONFIRMED**
**Confidence: HIGH**

**Evidence:** Execute SKILL.md Step 3 (line 79) says:
```
set `phase: "execute_in_progress"` (only if currently plan_complete or spike_complete), `current_wave`, `current_task` (first task), populate `tasks` array for THIS PHASE ONLY
```

But the v2 architecture uses `tasks.yml` as the canonical location. The template (`templates/tasks.yml.template`) defines:
```yaml
current_wave: null
current_task: null
tasks: []
```

Execute's own frontmatter (line 24) already injects tasks.yml:
```
Tasks:
!`cat .expedite/tasks.yml 2>/dev/null || echo "No tasks"`
```

So the execute skill injects `tasks.yml` at the top (which starts empty) but then writes tasks to `state.yml` in Step 3. The injected tasks.yml context would show empty data.

**Fix:** In Step 3, write `current_wave`, `current_task`, and `tasks` array to `tasks.yml` instead of `state.yml`. Only `phase` and `last_modified` should go to state.yml.

Also in Steps 5d, 6, and any other places that update `current_task` or task statuses -- those writes should target `tasks.yml`.

**Files to modify:** `skills/execute/SKILL.md` (Steps 3, 5d, 6, 7)

### AUD-005: Override entry paths use invalid gate IDs and wrong outcome

**Status: CONFIRMED**
**Confidence: HIGH**

**Evidence:** Design SKILL.md Step 1 Case B (line 60):
```
Record override in gates.yml (append: gate "G2-design-entry", outcome "override").
```

Plan SKILL.md Step 1 Case B (line 60):
```
Record override in gates.yml (append: gate "G3-plan-entry", outcome "override").
```

The gates.yml schema (`hooks/lib/schemas/gates.js` line 7):
```javascript
var VALID_GATE_IDS = ['G1', 'G2', 'G3', 'G4', 'G5'];
```

`"G2-design-entry"` and `"G3-plan-entry"` are not in the enum. Schema validation will deny the write.

For the outcome: `"override"` is actually in `VALID_GATE_OUTCOMES` (line 16 of gates.js), so schema validation would accept it. However, `PASSING_OUTCOMES` in gate-checks.js (line 20) is:
```javascript
var PASSING_OUTCOMES = ['go', 'go-with-advisory', 'go_advisory', 'overridden'];
```

`"override"` is NOT in `PASSING_OUTCOMES`, so even if the schema let it through, the gate passage check would not recognize it as a passing result. The correct value is `"overridden"`.

Also, the override protocol (`skills/shared/ref-override-protocol.md`) explicitly shows the correct pattern:
```yaml
outcome: "overridden"
override_reason: "User requested: <justification>"
```

**Fix:** In both design SKILL.md and plan SKILL.md:
1. Change gate IDs to valid ones: `"G2"` for design override, `"G3"` for plan override
2. Change outcome from `"override"` to `"overridden"`
3. Add `override_reason` field (required when outcome is "overridden" per schema validation at line 52 of gates.js)

**Files to modify:** `skills/design/SKILL.md` (Step 1 Case B), `skills/plan/SKILL.md` (Step 1 Case B)

### AUD-006: Execute missing completion checkpoint at lifecycle end

**Status: CONFIRMED**
**Confidence: HIGH**

**Evidence:** Execute SKILL.md Step 7 (lines 137-142) handles lifecycle completion:
```
Update state.yml: `phase: "complete"`, clear current_step/task/wave/tasks. Log phase transition.
Append lifecycle complete to PROGRESS.md via Bash.
```

There is no checkpoint write in Step 7. Compare with other skills' completion steps:
- Scope Step 10 writes: `step: "complete", label: "scope complete", continuation_notes: "Next: /expedite:research"`
- Research Step 18 writes: `step: "complete", label: "research complete", continuation_notes: "Next: /expedite:design"`
- Design Step 10 writes completion checkpoint
- Spike Step 9 writes completion checkpoint

Execute Step 7 is the only completion step that omits the checkpoint write. This means `checkpoint.yml` retains stale data from the last task execution (e.g., `step: 5, substep: "executing_task_T3"`) after the lifecycle is complete.

**Fix:** Add checkpoint write to Step 7:
```yaml
skill: "execute"
step: "complete"
label: "lifecycle_complete"
substep: null
continuation_notes: "Lifecycle complete. Run /expedite:scope for new lifecycle."
inputs_hash: null
updated_at: "{timestamp}"
```

**Files to modify:** `skills/execute/SKILL.md` (Step 7)

### AUD-007: Worktree merge-back undocumented, no branch name in output

**Status: CONFIRMED WITH NUANCE**
**Confidence: HIGH**

**Evidence:** The task-implementer agent (`agents/task-implementer.md`) has `isolation: worktree` in frontmatter (line 14). Its output format (lines 134-141) is:
```
- STATUS: VERIFIED | PARTIAL | FAILED | NEEDS REVIEW
- TASK: [task ID] - [title]
- FILES: [list of files created/modified]
- CRITERIA: [N/M passed]
- CHAIN: intact | broken at [stage]
```

No branch name field exists in this output.

**HOWEVER**, the execute SKILL.md Step 5b (lines 99-106) DOES contain merge-back instructions:
```
**After agent returns -- worktree merge-back:**
- The agent result includes the worktree branch name if changes were made.
- If changes were made: merge the worktree branch back...
```

So the SKILL.md *assumes* the agent returns a branch name, but the agent's output format does not include one. The skill has merge-back instructions, contradicting the audit's claim that "Skill instructions do not specify merge procedure." The audit was partially wrong -- the skill DOES document merge-back (lines 99-106), but the agent output format lacks the branch name needed to execute that procedure.

**Fix:**
1. Add `BRANCH: [worktree branch name]` to task-implementer output format (after CHAIN line)
2. Optionally: add branch name to checkpoint storage for interrupted-session recovery (as the audit suggests)

**Files to modify:** `agents/task-implementer.md` (output_format section)

## Architecture Patterns

### Pattern: Surgical Skill Instruction Edits

All 7 fixes are text edits to Markdown skill instruction files, with ONE exception (AUD-003 also requires a JavaScript change to g1-scope.js). The pattern for each fix:

1. Read the current SKILL.md
2. Locate the exact step/line referenced
3. Make the minimal change to fix the bug
4. Verify the fix is consistent with the FSM, schemas, and hook enforcement

### Pattern: State File Targeting

The v2 architecture splits state across 5 files:
- `state.yml` -- identity + phase only (project_name, intent, lifecycle_id, description, phase)
- `checkpoint.yml` -- resume position
- `questions.yml` -- research questions + statuses
- `tasks.yml` -- execution tasks + statuses
- `gates.yml` -- gate passage history

Fixes for AUD-003 and AUD-004 must redirect writes to the correct split file. The key principle: skills should only write identity/phase fields to `state.yml`. Domain data goes to the appropriate split file.

### Pattern: FSM Compliance

The FSM in `hooks/lib/fsm.js` is the single source of truth for valid transitions. Skills must write phases that match FSM-defined transitions. For AUD-001, the FSM requires two writes (execute_in_progress -> execute_complete, then execute_complete -> complete). For AUD-002, the FSM has no plan_complete -> execute_in_progress path.

### Anti-Patterns to Avoid
- **Modifying the FSM to match broken skills:** The FSM is correct. Skills must be fixed to match it.
- **Adding new gate IDs to accommodate override entry:** Use existing valid gate IDs (G1-G5) for override records.
- **Changing schema enums to accept invalid values:** The schema is correct. Skill instructions must use valid values.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Gate ID validation | Custom validation in skills | Existing schema enum `VALID_GATE_IDS` | Schema already enforces; just use valid IDs |
| FSM transition checking | Skip-ahead logic in skills | Existing FSM transition table | FSM is acyclic and complete; follow it |
| Question file reading | Custom state.yml parsing for questions | `questions.yml` direct read + existing yaml parser | v2 split architecture already defines canonical locations |

## Common Pitfalls

### Pitfall 1: Forgetting the Backup-Before-Write Pattern
**What goes wrong:** Fixing a state write target without including the backup pattern
**Why it happens:** The fix focuses on changing "write to state.yml" to "write to questions.yml" and omits `cp .expedite/questions.yml .expedite/questions.yml.bak`
**How to avoid:** Every state file write in skills follows: read -> backup -> modify -> write. The fix must preserve this pattern for the new target file.
**Warning signs:** Missing `cp` command in the instruction text

### Pitfall 2: Incomplete Question Data Redirect (AUD-003)
**What goes wrong:** Moving the questions array write to questions.yml but leaving status/evidence_files updates pointing to state.yml elsewhere in the lifecycle
**Why it happens:** Research skill also updates question statuses and evidence_files -- those writes may still target state.yml
**How to avoid:** The research skill already injects questions.yml via frontmatter and appears to write question updates there. Verify that ALL downstream question writes target questions.yml, not just the initial scope write.
**Warning signs:** Check research SKILL.md Steps 9, 12 for question status update targets

### Pitfall 3: Incomplete Task Data Redirect (AUD-004)
**What goes wrong:** Moving tasks array to tasks.yml in Step 3 but leaving current_task/current_wave/task status updates in state.yml at Steps 5d, 6, 7
**Why it happens:** Multiple steps reference task-related state updates
**How to avoid:** Search execute SKILL.md for ALL mentions of `current_task`, `current_wave`, `tasks` and ensure they target tasks.yml
**Warning signs:** Any execute step that says "Update state.yml: ... current_task ..."

### Pitfall 4: G1 Gate Script Read Path Change (AUD-003)
**What goes wrong:** G1 reads questions from state.yml. After fixing scope to write to questions.yml, G1 finds no questions and fails M2 (minimum 3 questions)
**Why it happens:** AUD-003 has two parts: the skill write AND the gate read
**How to avoid:** Fix both in the same plan task -- never deploy the skill fix without the gate fix
**Warning signs:** G1 always returning "hold" after the fix

### Pitfall 5: Execute Step 7 Phase Write Order (AUD-001)
**What goes wrong:** Writing execute_complete and complete in the wrong order, or forgetting backup-before-write for one of them
**Why it happens:** Two sequential state writes in one step is unusual
**How to avoid:** The fix must clearly sequence: (1) backup + write execute_complete, (2) log transition, (3) backup + write complete, (4) log transition
**Warning signs:** Hook denial on the second write

## Code Examples

### AUD-001 Fix: Execute Step 7 Intermediate State

Current Step 7 text:
```markdown
### Step 7: Lifecycle Completion

Update state.yml: `phase: "complete"`, clear current_step/task/wave/tasks.
```

Fixed Step 7 text should include:
```markdown
### Step 7: Lifecycle Completion

Backup-before-write state.yml: set `phase: "execute_complete"`, clear current_step/task/wave.
Log phase transition: from "execute_in_progress" to "execute_complete".

Backup-before-write state.yml: set `phase: "complete"`, clear tasks.
Log phase transition: from "execute_complete" to "complete".
```

### AUD-003 Fix: G1 Gate Script questions.yml Read

Current G1 code (lines 57-58):
```javascript
var questions = (state && Array.isArray(state.questions)) ? state.questions : [];
```

Fixed code:
```javascript
var questionsPath = path.join(projectDir, '.expedite', 'questions.yml');
var questionsData = utils.readYaml(questionsPath);
var questions = (questionsData && Array.isArray(questionsData.questions)) ? questionsData.questions : [];
```

### AUD-005 Fix: Override Entry Gate Write

Current design SKILL.md (line 60):
```markdown
Record override in gates.yml (append: gate "G2-design-entry", outcome "override").
```

Fixed:
```markdown
Record override in gates.yml (append: gate "G2", outcome "overridden", override_reason "User-initiated --override entry from research_in_progress").
```

### AUD-007 Fix: Task-Implementer Branch Output

Current condensed return format:
```markdown
- STATUS: VERIFIED | PARTIAL | FAILED | NEEDS REVIEW
- TASK: [task ID] - [title]
- FILES: [list of files created/modified]
- CRITERIA: [N/M passed]
- CHAIN: intact | broken at [stage]
```

Fixed:
```markdown
- STATUS: VERIFIED | PARTIAL | FAILED | NEEDS REVIEW
- TASK: [task ID] - [title]
- FILES: [list of files created/modified]
- CRITERIA: [N/M passed]
- CHAIN: intact | broken at [stage]
- BRANCH: [worktree branch name, or "none" if no changes made]
```

## File Impact Summary

| File | Bugs | Change Type | Risk |
|------|------|-------------|------|
| `skills/execute/SKILL.md` | AUD-001, AUD-002, AUD-004, AUD-006 | Skill instruction edits | Medium (4 bugs, most fixes) |
| `skills/scope/SKILL.md` | AUD-003 | Redirect question write target | Low |
| `gates/g1-scope.js` | AUD-003 | Read questions from questions.yml | Low (simple path change) |
| `skills/design/SKILL.md` | AUD-005 | Fix gate ID and outcome | Low |
| `skills/plan/SKILL.md` | AUD-005 | Fix gate ID and outcome | Low |
| `agents/task-implementer.md` | AUD-007 | Add BRANCH to output format | Low |

**Total files modified:** 6
**JavaScript changes:** 1 file (g1-scope.js)
**Skill instruction changes:** 4 files
**Agent definition changes:** 1 file

## Dependency Order

The fixes are largely independent, but there is one dependency:

1. **AUD-003 scope + G1 must be fixed together.** If scope writes to questions.yml but G1 still reads from state.yml, G1 will always fail M2. These two changes must be in the same plan task or sequential tasks within the same plan.

2. All other fixes (AUD-001, AUD-002, AUD-004, AUD-005, AUD-006, AUD-007) are independent and can be done in any order.

**Recommended grouping for planning:**
- Group 1 (Execute skill fixes): AUD-001, AUD-002, AUD-004, AUD-006 -- all in execute SKILL.md
- Group 2 (State split fixes): AUD-003 (scope SKILL.md + g1-scope.js)
- Group 3 (Override fixes): AUD-005 (design + plan SKILL.md)
- Group 4 (Agent output fix): AUD-007 (task-implementer.md)

## Open Questions

1. **AUD-002 spike-skip decision**
   - What we know: FSM has no plan_complete -> execute_in_progress transition. Spike skill handles zero-TD phases gracefully.
   - What's unclear: Whether the project owner wants spike-skip as a future feature
   - Recommendation: Remove plan_complete from execute's accepted phases. If spike-skip is wanted later, it can be added as a separate feature with proper FSM transition and gate handling. Fixing the bug now by simply removing the invalid path is the safe choice.

2. **AUD-004 task write locations in Steps 5d, 6, 7**
   - What we know: Step 3 writes tasks to state.yml (confirmed wrong). Steps 5d, 6, 7 also reference task-related updates in state.yml.
   - What's unclear: Exactly which fields in 5d/6/7 should go to tasks.yml vs state.yml
   - Recommendation: During planning, itemize every field written in Steps 3, 5d, 6, 7 and assign each to the correct target file. Rule of thumb: `current_task`, `current_wave`, `tasks` -> tasks.yml. `phase`, `last_modified` -> state.yml. `current_step` -> state.yml (redundant with checkpoint.yml but existing convention).

## Sources

### Primary (HIGH confidence)
- `skills/execute/SKILL.md` -- direct source code read, all line references verified
- `hooks/lib/fsm.js` -- FSM transition table read and confirmed
- `skills/scope/SKILL.md` -- Step 9b question write logic confirmed
- `gates/g1-scope.js` -- question read source confirmed as state.yml
- `hooks/lib/schemas/gates.js` -- VALID_GATE_IDS and VALID_GATE_OUTCOMES confirmed
- `hooks/lib/gate-checks.js` -- PASSING_OUTCOMES confirmed
- `skills/design/SKILL.md` -- override entry path confirmed
- `skills/plan/SKILL.md` -- override entry path confirmed
- `agents/task-implementer.md` -- output format confirmed (no BRANCH field)
- `templates/questions.yml.template` -- canonical v2 question location confirmed
- `templates/tasks.yml.template` -- canonical v2 task location confirmed
- `templates/state.yml.template` -- confirms state.yml has no questions/tasks fields
- `skills/research/SKILL.md` -- confirms frontmatter injects questions.yml
- `skills/spike/SKILL.md` -- confirms spike handles plan_complete -> spike_in_progress correctly
- `skills/shared/ref-override-protocol.md` -- confirms correct override pattern (outcome: "overridden")

### Secondary (MEDIUM confidence)
- `.planning/research/expedite-final-audit/research-synthesis.md` -- audit findings used as starting hypotheses, all validated against source

## Metadata

**Confidence breakdown:**
- Bug validation: HIGH -- every bug verified by reading exact source files and cross-referencing FSM/schema/gate code
- Fix approach: HIGH -- fixes are straightforward instruction edits following established patterns
- Dependency analysis: HIGH -- only one true dependency (AUD-003 scope+G1 coupling) identified and verified

**Research date:** 2026-03-17
**Valid until:** Indefinite (fixes are to stable, versioned source files)
