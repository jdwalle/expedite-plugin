# DA-13: Skill Instruction Clarity & Ambiguity

## Summary

Reviewed all 7 SKILL.md files, 2 shared protocols, and 9 agent definitions. Identified **3 critical ambiguity clusters** that could cause state corruption, **4 protocol reference gaps**, and **7 agent dispatch issues**. The most dangerous finding is the **v2 split file confusion**: multiple skills instruct Claude to write questions/tasks to state.yml, but the v2 architecture puts them in separate files. A literal-following Claude writes to state.yml; downstream skills read from questions.yml/tasks.yml and find empty arrays.

## q38: Dangerous Ambiguities

### Critical Ambiguity #1: v2 Split File Confusion (P0)

**Affects:** scope, research, execute skills

| Skill | Step | Instruction Says | v2 Architecture Says | Impact |
|-------|------|-----------------|---------------------|--------|
| Scope | 9b | Write `questions` array to state.yml | questions.yml | Research reads questions.yml, finds empty array, proceeds with zero questions |
| Research | 9 | Update `evidence_files`, `status` on state.yml | questions.yml | Question statuses not updated in canonical location |
| Research | 12 | Update state.yml with final statuses, gap_details | questions.yml | Same as above |
| Execute | 3 | Populate `tasks` array in state.yml | tasks.yml | Execute reads injected tasks.yml, finds empty array, proceeds with zero tasks |

The frontmatter injections load the split files (`!cat .expedite/questions.yml`, `!cat .expedite/tasks.yml`), but skill body instructions say to write to state.yml. A literal-following Claude writes to state.yml; downstream reads from the injected split files find nothing.

### Critical Ambiguity #2: Worktree Merge-Back Undocumented (P0)

**Affects:** execute skill Step 5b

Execute Step 5b says "The agent result includes the worktree branch name if changes were made" but:
- The task-implementer agent's output format (`STATUS, TASK, FILES, CRITERIA, CHAIN`) contains no branch name field
- The agent's instructions never mention worktrees despite having `isolation: worktree` in frontmatter
- Code changes could be silently lost if merge-back fails due to missing branch info

### Critical Ambiguity #3: research_round Location Conflict (P1)

**Affects:** research skill, status skill

- `research_round` is defined in `questions.yml` template (`research_round: 0`)
- Research Step 3 writes it to state.yml
- Status skill reads it from state.yml injection (doesn't inject questions.yml)
- If written to questions.yml per template, status can't find it; if written to state.yml per instruction, it's in the wrong file per v2

### Additional Ambiguities by Skill

**Scope:**
- AMB-SCOPE-01 (Low): `current_step` not in state.yml schema — works due to permissive validation
- AMB-SCOPE-03 (Low): Step 3 says "set current_step" without specifying value format

**Research:**
- AMB-RES-01 (Moderate): Non-contiguous step numbering (1-5, then 9, 11-18) — could cause Claude to attempt nonexistent Step 6

**Design:**
- AMB-DES-02 (Low): Init step says "set current_step" without value — covered by global preamble

**Execute:**
- AMB-EXEC-03 (Low): `--no-commit` flag stored in undefined "execution context" — lost on compaction
- AMB-EXEC-04 (Low): Step 5d references "per-phase checkpoint.yml" without repeating path

## q39: Shared Protocol References

### ref-state-recovery.md — All 7 skills reference correctly

All skills include the recovery protocol reference at appropriate points (Step 1 preamble for active skills, Instruction 1 for status). Spike and execute use abbreviated references ("follow ref-state-recovery.md" without Glob fallback).

### Protocol Gaps

| # | Gap | Severity | Description |
|---|-----|----------|-------------|
| GAP-1 | No mid-step corruption recovery | P1 | Recovery handles missing state.yml but not corrupted state.yml (invalid YAML, missing required fields). A corrupted file stalls all skills. |
| GAP-2 | Schema denial has no recovery path | P1 | Override protocol covers FSM/gate denials but not schema validation failures. Schema denial says "State validation failed: {errors}" with no actionable instructions. |
| GAP-3 | --override without prior gate recycle | P1 | Design/plan skills verify a prior recycle exists but don't handle the case where it doesn't. |
| GAP-4 | Override context file may not exist | Low | Design Step 2 references `.expedite/research/override-context.md` with "if exists" but no explicit handling for absence. |

## q40: Agent Dispatch Specificity

### Well-Specified Dispatches (Good)

| Skill | Agent | Assessment |
|-------|-------|------------|
| research Step 15 | gate-verifier (G2) | Exact field names match agent placeholders |
| design Step 4 | design-architect | Well-specified with conditional handoff output |
| design Step 8 | gate-verifier (G3) | Exact field names |
| spike Step 5 | spike-researcher | Fields match, output path explicit |
| spike Step 8 | gate-verifier (G5) | Exact field names |

### Underspecified Dispatches (Issues)

| # | Skill | Agent | Issue | Severity |
|---|-------|-------|-------|----------|
| DISPATCH-RES-01 | research Step 5b | web/codebase-researcher | Missing `codebase_root` for codebase variant; `output_dir` vs `output_file` distinction unclear | P1 |
| DISPATCH-RES-02 | research Step 12 | sufficiency-evaluator | Agent reads `state.questions` — inherits v2 split confusion | P1 |
| DISPATCH-PLAN-01 | plan Step 4 | plan-decomposer | `output_path` vs agent's `{{output_file}}`; `plan_guide_reference` is dead context (agent has no instruction to read it) | P1 |
| DISPATCH-EXEC-01 | execute Step 5b | task-implementer | Generic "assemble task context" instead of enumerating exact placeholders (`task_id`, `task_title`, `spike_file`, etc.) | P0 |
| DISPATCH-EXEC-02 | execute Step 5b | task-implementer | Worktree branch return not in agent's documented output format | P0 |

## Critical Ambiguities (could cause state corruption)

1. **v2 split file confusion** — scope writes questions to state.yml; research updates question statuses in state.yml; execute writes tasks to state.yml. All should target their respective split files. Downstream skills read from split files and find empty data.
   - **Fix:** Update skill instructions to reference correct split files

2. **Worktree merge-back** — execute expects branch name from task-implementer but agent doesn't produce one
   - **Fix:** Document branch name in agent output format, or clarify platform-level worktree handling

3. **research_round location** — written to state.yml by instruction, defined in questions.yml by template
   - **Fix:** Standardize location and update all references

## Minor Ambiguities (suboptimal but not harmful)

1. `current_step` not in state.yml schema — redundant with checkpoint.yml
2. Research non-contiguous step numbering — renumber contiguously
3. Design/plan init steps don't specify current_step value — covered by preamble
4. `--no-commit` flag not persisted — store in checkpoint continuation_notes
5. --override without prior recycle — add explicit STOP instruction
6. plan_guide_reference is dead context — remove from dispatch or add agent read instruction
7. task-implementer context fields not enumerated — list exact placeholder names
