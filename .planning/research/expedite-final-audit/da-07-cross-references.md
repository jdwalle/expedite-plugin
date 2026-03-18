# DA-7: Cross-Resource Reference Integrity

## Summary

Verified cross-resource reference integrity across 7 skills, 5 schema validators, 5 gate scripts, gate-checks.js, and 9 agent definitions. **3 bugs** (2×P0, 1×P1) and **5 dangling/mismatched references** found.

- q21 (Glob patterns): PASS — all patterns resolve to existing files
- q22 (Field/enum cross-reference): FAIL — 2 P0 mismatches (invalid gate IDs, questions in wrong file)
- q23 (Gate output format): PARTIAL — standard gate writes match, override entries use invalid gate IDs
- q24 (Agent dispatch): PASS — all agent names and context variables match

## q21: Glob Pattern Resolution — PASS

All 15 Glob patterns across all 7 skills resolve to existing files:

| Skill | Pattern | Resolved File | Status |
|-------|---------|---------------|--------|
| scope | `**/ref-state-recovery.md` | `skills/shared/ref-state-recovery.md` | MATCH |
| scope | `**/templates/state.yml.template` | `templates/state.yml.template` | MATCH |
| scope | `**/templates/sources.yml.template` | `templates/sources.yml.template` | MATCH |
| scope | `**/templates/gitignore.template` | `templates/gitignore.template` | MATCH |
| scope | `**/prompt-scope-questioning.md` | `skills/scope/references/prompt-scope-questioning.md` | MATCH |
| research | `**/ref-recycle-escalation.md` | `skills/research/references/ref-recycle-escalation.md` | MATCH |
| research | `**/ref-gapfill-dispatch.md` | `skills/research/references/ref-gapfill-dispatch.md` | MATCH |
| design | `**/ref-state-recovery.md` | `skills/shared/ref-state-recovery.md` | MATCH |
| plan | `**/ref-state-recovery.md` | `skills/shared/ref-state-recovery.md` | MATCH |
| plan | `**/prompt-plan-guide.md` | `skills/plan/references/prompt-plan-guide.md` | MATCH |
| spike | `**/ref-state-recovery.md` | `skills/shared/ref-state-recovery.md` | MATCH |
| execute | `**/ref-state-recovery.md` | `skills/shared/ref-state-recovery.md` | MATCH |
| execute | `**/prompt-task-verifier.md` | `skills/execute/references/prompt-task-verifier.md` | MATCH |
| execute | `**/ref-git-commit.md` | `skills/execute/references/ref-git-commit.md` | MATCH |

All shell `cat` injections use `2>/dev/null` fallback — missing files produce graceful "No ..." messages.

## q22: Field/Enum Cross-Reference — FAIL (2 P0 bugs)

### State.yml: 8 fields written but NOT in schema

| Field | Written By | Should Be In |
|-------|-----------|--------------|
| `current_step` | All 6 active skills | Removed in v2; redundant with checkpoint.yml |
| `last_modified` | All 6 active skills | state.yml schema (missing) |
| `questions` (array) | scope Step 9b | questions.yml (separate file) |
| `research_round` | research Step 3 | questions.yml (has it) |
| `current_wave` | execute Step 3 | tasks.yml (has it) |
| `current_task` | execute Steps 3, 5d | tasks.yml (has it) |
| `tasks` (array) | execute Step 3 | tasks.yml (separate file) |
| `evidence_files` | research Step 9 | questions.yml item schema |

The validator's lenient unknown-field handling means these writes pass silently but are unvalidated.

### Checkpoint.yml, Questions.yml, Tasks.yml: MATCH
All fields written by skills match their respective schemas.

### Gates.yml: FAIL on override entry gate IDs (see BUG B2)

### Enum Consistency

| Enum | Schema Values | Producer Values | Match |
|------|--------------|-----------------|-------|
| Phase | 15 values | All used by FSM/skills | YES |
| Gate outcomes | 8 values | `no-go` never produced (dead) | PARTIAL |
| Question status | 5 values | scope, research | YES |
| Question priority | P0/P1/P2 | scope | YES |
| Task status | 7 values | execute | YES |
| Intent | product/engineering | All skills | YES |

### Status skill phase ordering omits 3 phases
Missing from status skill: `spike_in_progress`, `spike_complete`, `execute_complete`

## q23: Gate Output Format Consistency — PARTIAL

### Gate stdout JSON: MATCH
All 5 gate scripts use `gate-utils.printResult()` producing consistent JSON. All skills parse a valid subset of the output fields.

### gates.yml entries: MATCH for standard writes
`gate-utils.buildEntry()` + `appendGateResult()` produce entries matching the gates.yml schema.

### Override entries: FAIL
- Design skill writes `gate: "G2-design-entry"` — not in valid gate IDs
- Plan skill writes `gate: "G3-plan-entry"` — not in valid gate IDs
- Design/plan use `outcome: "override"` — not in `PASSING_OUTCOMES`
- Research uses `outcome: "overridden"` — IS in `PASSING_OUTCOMES`

### Outcome naming inconsistency
- Gate scripts produce: `go_advisory` (underscore)
- Gate-verifier agent produces: `go-with-advisory` (hyphenated)
- Both accepted by schema and PASSING_OUTCOMES (dual naming for compatibility)

## q24: Agent Dispatch Integrity — PASS

All 11 agent dispatches use names exactly matching agent frontmatter `name` fields. All context variables are populated from upstream artifacts already read before dispatch.

| Dispatching Skill | Agent Name | Match |
|-------------------|-----------|-------|
| research | web-researcher | YES |
| research | codebase-researcher | YES |
| research | sufficiency-evaluator | YES |
| research | research-synthesizer | YES |
| research | gate-verifier | YES |
| design | design-architect | YES |
| design | gate-verifier | YES |
| plan | plan-decomposer | YES |
| spike | spike-researcher | YES |
| spike | gate-verifier | YES |
| execute | task-implementer | YES |

## Bugs Found

| # | Severity | Location | Description |
|---|----------|----------|-------------|
| B1 | P0 | gates/g1-scope.js:58 | G1 reads `state.questions` but questions are architecturally in questions.yml. Works only because scope writes questions to state.yml as undocumented field. |
| B2 | P0 | skills/design/SKILL.md:60, skills/plan/SKILL.md:60 | Override entry writes use invalid gate IDs `"G2-design-entry"` and `"G3-plan-entry"` — schema validation will DENY these writes, blocking --override entry flow |
| B3 | P1 | skills/status/SKILL.md:117 | Status skill routes `plan_complete` to `/expedite:execute`, skipping spike. FSM only allows `plan_complete → spike_in_progress`. |

## Dangling References Found

| # | Severity | Description |
|---|----------|-------------|
| D1 | P1 | Status skill phase ordering omits `spike_in_progress`, `spike_complete`, `execute_complete` |
| D2 | P1 | Outcome `"override"` vs `"overridden"` inconsistency — design/plan use `"override"` (not in PASSING_OUTCOMES), research uses `"overridden"` (is in PASSING_OUTCOMES) |
| D3 | P2 | `no-go` is a dead enum value — never produced by any gate script, skill, or agent |
| D4 | P2 | 8 fields written to state.yml that belong in other files per v2 split architecture |
| D5 | P2 | Execute skill accepts `plan_complete` as entry but FSM requires spike first (dead code path) |
