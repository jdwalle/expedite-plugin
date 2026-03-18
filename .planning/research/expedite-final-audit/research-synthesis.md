# Expedite Plugin Final Audit: Research Synthesis

**Date:** 2026-03-16
**Scope:** 15-agent parallel audit of the Expedite plugin prior to first real-world use
**Audited:** ~2,400 lines of JavaScript, ~1,200 lines of skill instructions, 9 agent definitions, 7 YAML templates, 2 design specs

---

## 1. Executive Summary

The Expedite plugin's architecture is fundamentally sound. The FSM is complete and acyclic, hook exit-code contracts are correct, template-schema pairs validate cleanly, all file references resolve, and the agent dispatch wiring is intact. The plugin will work for a standard lifecycle that does not skip phases or use the `--override` entry path.

Seven findings demand attention before first use:

1. **The execute skill has two FSM-blocking bugs.** It writes `phase: "complete"` directly from `execute_in_progress`, skipping the required `execute_complete` intermediate state. It also accepts `plan_complete` as a valid entry phase, but the FSM requires spike phases first. Both writes will be denied at runtime by the hook. A lifecycle cannot reach its terminal state. (DA-02, DA-05, DA-07, DA-14)

2. **The v2 state-split migration is incomplete.** Skills instruct Claude to write questions and tasks to `state.yml`, but the v2 architecture moved them to `questions.yml` and `tasks.yml`. G1 reads questions from `state.yml`. Downstream skills inject the split files via frontmatter and find empty arrays. This affects scope, research, execute, and G1. (DA-03, DA-05, DA-07, DA-11, DA-13, DA-14)

3. **The `--override` entry path is broken.** Design and plan skills write invalid gate IDs (`"G2-design-entry"`, `"G3-plan-entry"`) and use `outcome: "override"` instead of the recognized `"overridden"`. Schema validation will deny these writes. (DA-02, DA-07, DA-11, DA-12)

4. **The worktree merge-back for the execute skill is undocumented.** The task-implementer agent has `isolation: worktree` but its output format contains no branch name field, and the skill instructions do not explain how to merge completed work back. Interrupted sessions orphan worktree branches with no recovery path. (DA-12, DA-13)

5. **The state.yml schema is missing 7+ fields** that skills actively write (`last_modified`, `current_step`, `questions`, `research_round`, `current_wave`, `current_task`, `auto_commit`). The validator silently passes unknown fields, so these writes are never type-checked or enum-validated. (DA-03, DA-07)

6. **G1 and G4 gates are 100% structural** with no semantic evaluation of decision quality. All other gates (G2, G3, G5) dispatch the gate-verifier agent for semantic assessment. G1 and G4 can pass artifacts that are structurally complete but substantively empty. (DA-04, DA-15)

7. **The status skill omits spike phases entirely** from its display mappings, phase ordering, and next-action routing. Users in spike phases get no status display and broken navigation. (DA-07, DA-14)

---

## 2. Consolidated Bug List

Bugs from all 15 DAs have been deduplicated. Where multiple DAs independently identified the same issue, the canonical entry lists all sources.

### P0 (Runtime-Blocking)

| ID | Description | Affected Files | Identified By | Recommended Fix |
|----|-------------|----------------|---------------|-----------------|
| AUD-001 | Execute skill writes `phase: "complete"` directly from `execute_in_progress`, skipping FSM-required `execute_complete` intermediate state. Hook will deny. Lifecycle cannot reach terminal state. | `skills/execute/SKILL.md` Step 7, `hooks/lib/fsm.js` | DA-02, DA-05, DA-07, DA-14 | Add Step 6.5: write `phase: "execute_complete"`, then Step 7: write `phase: "complete"` |
| AUD-002 | Execute skill accepts `plan_complete` as valid entry phase and writes `execute_in_progress`. FSM requires `plan_complete -> spike_in_progress` first. Hook will deny. | `skills/execute/SKILL.md` Steps 1/3, `hooks/lib/fsm.js` | DA-02, DA-07, DA-14 | Remove `plan_complete` from execute's accepted entry phases. If spike-skip is desired, add FSM transition `plan_complete -> execute_in_progress` with appropriate gate. |
| AUD-003 | Scope Step 9b writes `questions` array to `state.yml`. G1 reads `state.questions`. Research injects `questions.yml` via frontmatter and finds empty array. Questions never reach their canonical v2 location. | `skills/scope/SKILL.md` Step 9b, `gates/g1-scope.js`, `skills/research/SKILL.md` frontmatter | DA-03, DA-05, DA-07, DA-11, DA-13, DA-14 | Update scope Step 9b to write questions to `questions.yml`. Update G1 to read from `questions.yml`. |
| AUD-004 | Execute Step 3 writes `tasks` array to `state.yml`. Execute frontmatter injects `tasks.yml` and finds empty array. Tasks never reach their canonical v2 location. | `skills/execute/SKILL.md` Step 3, `templates/tasks.yml.template` | DA-03, DA-07, DA-13, DA-14 | Update execute Step 3 to write tasks to `tasks.yml`. |
| AUD-005 | Design and plan `--override` entry paths write invalid gate IDs (`"G2-design-entry"`, `"G3-plan-entry"`) not in schema enum. Also use `outcome: "override"` instead of `"overridden"` (not in `PASSING_OUTCOMES`). Schema validation and gate passage checks will deny. | `skills/design/SKILL.md`:60, `skills/plan/SKILL.md`:60, `hooks/lib/schemas/gates.js` | DA-02, DA-07, DA-11, DA-12 | Use valid gate IDs (`"G1"`, `"G2"`, etc.) and `outcome: "overridden"`. |
| AUD-006 | Execute skill missing completion checkpoint write at lifecycle end. Leaves stale task-level checkpoint data (`step: 5, substep: "executing_task_T3"`) in `checkpoint.yml` after lifecycle completion. | `skills/execute/SKILL.md` Step 7 | DA-05 | Add checkpoint write `{skill: "execute", step: "complete", label: "lifecycle_complete"}` at end of Step 7. |
| AUD-007 | Worktree merge-back is undocumented. `task-implementer` has `isolation: worktree` but its output format (`STATUS, TASK, FILES, CRITERIA, CHAIN`) contains no branch name. Skill instructions do not specify merge procedure. Completed work could be silently lost. | `agents/task-implementer.md`, `skills/execute/SKILL.md` Step 5b | DA-12, DA-13 | Add branch name to task-implementer output format. Add explicit merge-back instructions to execute Step 5b. Store branch name in checkpoint for interrupted-session recovery. |

### P1 (Correctness / Data Integrity)

| ID | Description | Affected Files | Identified By | Recommended Fix |
|----|-------------|----------------|---------------|-----------------|
| AUD-008 | State.yml schema missing 7+ fields that skills actively write (`last_modified`, `current_step`, `questions`, `research_round`, `current_wave`, `current_task`, `auto_commit`). No type-checking or enum-validation on these fields. | `hooks/lib/schemas/state.js` | DA-03, DA-07 | Either add fields to schema, or (for fields that belong in split files) remove the writes from skills. `current_step` is redundant with `checkpoint.yml` and should be removed from skill writes. |
| AUD-009 | Status skill omits `spike_in_progress`, `spike_complete`, and `execute_complete` from phase ordering, human-readable descriptions, and next-action routing. Users in spike phases get no status display. | `skills/status/SKILL.md` | DA-02, DA-07, DA-14 | Add all three phases to status skill's display mappings and next-action routing. |
| AUD-010 | G4 gate uses case-sensitive `planContent.indexOf(daId)` for DA matching, while G2/G3 use `content.toUpperCase().indexOf(da.id)`. Could cause false gate failures if DA casing varies between SCOPE.md and PLAN.md. | `gates/g4-plan.js`:166 | DA-04 | Normalize case: `planContent.toUpperCase().indexOf(daId.toUpperCase())`. |
| AUD-011 | Research skill uses relative path in backup cp command: `cp state.yml state.yml.bak` instead of `cp .expedite/state.yml .expedite/state.yml.bak`. Backup created in wrong directory. | `skills/research/SKILL.md`:42 | DA-05 | Fix path to `.expedite/state.yml`. |
| AUD-012 | Override detection in audit hook uses `indexOf('outcome: "overridden"')` which only matches double-quoted YAML. Single-quoted or unquoted variants are logged as `state_write` instead of `override_write`. | `hooks/audit-state-change.js`:63 | DA-01, DA-12 | Use regex or parse YAML and check the field value. |
| AUD-013 | HOOK-03 escalation message says "edit state.yml" but should say "edit checkpoint.yml" (checkpoint regression is about checkpoint, not state). | `hooks/validate-state-write.js`:204 | DA-01 | Change message to reference `checkpoint.yml`. |
| AUD-014 | `research_round` location conflict: defined in `questions.yml` template (`research_round: 0`), but research Step 3 writes it to `state.yml`. Status skill reads from `state.yml` injection and does not inject `questions.yml`. | `skills/research/SKILL.md`, `templates/questions.yml.template`, `skills/status/SKILL.md` | DA-13 | Standardize: write to `questions.yml` and inject `questions.yml` in status skill. |
| AUD-015 | Research skill non-contiguous step numbering (steps 6, 7, 8, 10 missing). Status skill reports 18 total research steps but only 14 exist. Resume to a missing step number could fail silently. | `skills/research/SKILL.md`, `skills/status/SKILL.md` | DA-05, DA-13 | Renumber research steps contiguously. Update status skill step total. |
| AUD-016 | Execute Steps 5d, 6, and 7 write `state.yml` without explicit backup-before-write instructions. Research Step 12 also missing backup. | `skills/execute/SKILL.md`, `skills/research/SKILL.md` | DA-05 | Add explicit `cp .expedite/state.yml .expedite/state.yml.bak` before each write. |
| AUD-017 | Gates.yml history immutability not enforced. Hook validates only new entries (index >= existingCount). An LLM rewriting the file could silently alter previous gate results. | `hooks/validate-state-write.js` | DA-11 | Add hash-based comparison of existing entries against current file before validating new entries. |
| AUD-018 | Agent dispatch for task-implementer uses generic "assemble task context" instead of enumerating exact placeholder fields (`task_id`, `task_title`, `spike_file`, etc.). Insufficient for reliable context passing. | `skills/execute/SKILL.md` Step 5b | DA-13 | Enumerate exact placeholder names and source locations. |
| AUD-019 | Agent dispatch for web/codebase-researcher missing `codebase_root` for codebase variant; `output_dir` vs `output_file` distinction unclear. | `skills/research/SKILL.md` Step 5b | DA-13 | Specify `codebase_root` and clarify output path contract. |
| AUD-020 | `sufficiency-evaluator` agent has `memory: project` without spec basis. Spec limits persistent memory to `research-synthesizer` and `gate-verifier` only. Persistent memory could introduce evaluation bias. | `agents/sufficiency-evaluator.md` | DA-06, DA-11 | Remove `memory: project` or document the decision with bias-mitigation criteria. |
| AUD-021 | Schema denial (schema validation failure) has no recovery path. Override protocol covers FSM/gate denials but not schema failures. Message says "State validation failed: {errors}" with no actionable instructions. | `hooks/validate-state-write.js`, `skills/shared/ref-override-protocol.md` | DA-13 | Add recovery instructions to schema denial messages (fix the data and retry). |

### P2 (Quality / Consistency)

| ID | Description | Affected Files | Identified By | Recommended Fix |
|----|-------------|----------------|---------------|-----------------|
| AUD-022 | `nullable: true` property in schemas is decorative (never read by validation engine). All fields are implicitly nullable because null values skip type/enum checks. | `hooks/lib/validate.js`, all schema files | DA-03 | Either implement nullable checking or remove the property and document implicit nullability. |
| AUD-023 | Gates.yml schema missing `severity` field written by override protocol. | `hooks/lib/schemas/gates.js` | DA-03, DA-11 | Add `severity: { type: 'string', nullable: true, enum: ['low', 'medium', 'high'] }`. |
| AUD-024 | Missing period in HOOK-04 denial message between phase value and bypass instructions. | `hooks/validate-state-write.js`:250-251 | DA-01 | Add period. |
| AUD-025 | `session-summary.js` truthiness check `if (answer)` misses falsy valid answers (`0`, `""`, `false`). | `hooks/lib/session-summary.js`:116 | DA-01 | Change to `if (answer != null)`. |
| AUD-026 | `SKILL_STEP_TOTALS.scope` is 10 but scope skill may have 9 steps. | `hooks/lib/session-summary.js`:11 | DA-01 | Verify actual step count and correct. |
| AUD-027 | `extractDAs` helper returns `{id, name}` objects in G2/G3 but plain strings in G4. Divergent return types for same logical function. | `gates/g2-structural.js`, `gates/g3-design.js`, `gates/g4-plan.js` | DA-04 | Consolidate into `gate-utils.js` with consistent return type. |
| AUD-028 | `wordCount` helper duplicated identically in G2, G3, G5. | `gates/g2-structural.js`, `gates/g3-design.js`, `gates/g5-spike.js` | DA-04 | Move to `gate-utils.js`. |
| AUD-029 | Dual naming: `go_advisory` (underscore, from gate scripts) vs `go-with-advisory` (hyphenated, from gate-verifier agent). Both accepted but creates confusion about canonical form. | `gates/lib/gate-utils.js`, `agents/gate-verifier.md`, `hooks/lib/schemas/gates.js` | DA-04, DA-07 | Pick one canonical form and update all producers. |
| AUD-030 | `no-go` is a dead enum value in gates.yml schema — never produced by any gate script, skill, or agent. | `hooks/lib/schemas/gates.js` | DA-07 | Remove from enum or document when it would be produced. |
| AUD-031 | `formatChecks` exported from `gate-utils.js` but never called. `clearDenials` exported from `denial-tracker.js` but never called. | `gates/lib/gate-utils.js`, `hooks/lib/denial-tracker.js` | DA-01, DA-04 | Remove or document intended future use. |
| AUD-032 | Dead `fs` import in G3 and G5 gate scripts. | `gates/g3-design.js`, `gates/g5-spike.js` | DA-04 | Remove unused imports. |
| AUD-033 | `plugin.json` version stale at 1.0.0 (project is v3.0). Description missing "Spike" from lifecycle phases. | `plugin.json` | DA-09 | Update version and description. |
| AUD-034 | Gate scripts write `gates.yml` via `fs.writeFileSync` (Bash invocation), bypassing PreToolUse schema validation and PostToolUse audit logging. Skill-written semantic gate results DO go through hooks (asymmetry). | `gates/lib/gate-utils.js`:61 | DA-12 | Accept as architectural constraint or route writes through the skill. |
| AUD-035 | Edit tool not matched by hook registration. State files could be modified via Edit without FSM/gate/schema enforcement. | `.claude/settings.json` | DA-09 | Add `"Edit"` matcher registration or document that Edit must never target `.expedite/*.yml`. |
| AUD-036 | Recovery procedure writes `gates.yml` as `history: []`, discarding all previous gate passage records. | `skills/shared/ref-state-recovery.md` | DA-12 | Accept (recovery is a last resort) or reconstruct gate history from `log.yml`. |

---

## 3. Cross-Cutting Themes

### Theme 1: v2 State-Split Migration Incompleteness

**Identified by:** DA-03, DA-05, DA-07, DA-11, DA-13, DA-14

The v2 architecture split state into 5 files (`state.yml`, `checkpoint.yml`, `questions.yml`, `gates.yml`, `tasks.yml`). Templates and schemas exist for all 5 files. However, skill instructions were not fully updated to target the split files:

- **Scope** writes questions to `state.yml` instead of `questions.yml`
- **Research** updates question statuses/evidence_files in `state.yml` instead of `questions.yml`
- **Execute** writes tasks, `current_wave`, `current_task` to `state.yml` instead of `tasks.yml`
- **G1** reads questions from `state.yml` instead of `questions.yml`
- **Research** writes `research_round` to `state.yml`; template defines it in `questions.yml`
- **State schema** is missing 7+ fields because they belong in split files but are written to state.yml
- Skills write `current_step` to `state.yml` (redundant with `checkpoint.yml`)

The validator's permissive design (silently passes unknown fields) masks the problem at the schema layer but does not prevent downstream read failures when skills inject split files via frontmatter and find empty data.

**Impact:** Runtime data loss in research (empty questions) and execute (empty tasks) unless the entire split migration is reconciled.

### Theme 2: Override / Entry Path Breakage

**Identified by:** DA-02, DA-07, DA-11, DA-12

The `--override` entry path (entering a skill from a non-standard phase) is broken in three ways:

1. **Invalid gate IDs**: Design writes `"G2-design-entry"`, plan writes `"G3-plan-entry"` — neither is in the gates.yml schema enum. Schema validation denies.
2. **Wrong outcome value**: Design and plan use `outcome: "override"` instead of `"overridden"`. Not in `PASSING_OUTCOMES`. Gate passage check fails.
3. **FSM-invalid transitions**: The transitions attempted (e.g., `research_in_progress -> design_in_progress`) require intermediate phases. FSM denies.

Additionally, the research skill's "start over" backward transition (`research_in_progress -> scope_complete`) is blocked by the FSM's forward-only constraint.

**Impact:** The `--override` entry path is completely non-functional. Any attempt to skip phases or enter a skill from a non-standard state will be denied by hooks.

### Theme 3: Structural-Only Gate Validation at G1 and G4

**Identified by:** DA-04, DA-15

G2, G3, and G5 implement a dual-layer validation pattern: structural checks (gate script) followed by semantic evaluation (gate-verifier agent assessing evidence support, internal consistency, assumption transparency, reasoning completeness). G1 and G4 are 100% structural with no semantic layer.

- **G1 (Scope)**: Cannot assess whether decision areas are well-chosen, evidence requirements are genuinely checkable, or questions target decisions rather than tasks. A scope with structurally complete but substantively empty decision areas passes G1.
- **G4 (Plan)**: Cannot assess whether acceptance criteria genuinely derive from design decisions or task decomposition is logical. Checks for DA string proximity as a weak proxy.

**Impact:** The first and fourth quality gates in the lifecycle have no defense against superficial compliance. This weakens the "decision over steps" philosophy at two critical junctures.

### Theme 4: Execute Skill Structural Defects

**Identified by:** DA-02, DA-05, DA-07, DA-12, DA-13, DA-14

The execute skill has the highest concentration of bugs across the entire plugin:

- FSM-invalid terminal transition (AUD-001)
- FSM-invalid entry from `plan_complete` (AUD-002)
- Tasks written to wrong file (AUD-004)
- Missing completion checkpoint (AUD-006)
- Undocumented worktree merge-back (AUD-007)
- Missing backup-before-write at Steps 5d, 6, 7 (AUD-016)
- Underspecified agent dispatch (AUD-018)

This skill was likely the last to be fully implemented and received less iteration than earlier skills.

### Theme 5: Permissive Validation Engine

**Identified by:** DA-03, DA-08, DA-12

The validation engine (`validate.js`) iterates schema-declared fields only, silently passing any field not in the schema. Combined with the state.yml schema's 7+ missing fields, a significant portion of the most-written state file is unvalidated. The `nullable: true` property is decorative (never checked by the engine). Gate history immutability is not enforced (existing entries can be silently altered).

**Impact:** Schema validation provides a false sense of security. Corruptions that produce valid YAML with correct types for declared fields will pass undetected.

---

## 4. Component Health Scorecard

| Component | Bugs (P0/P1/P2) | Total | Health |
|-----------|-----------------|-------|--------|
| **Hooks** (validate-state-write, audit, pre-compact, session-stop, benchmark) | 0 / 3 / 2 | 5 | Good. Core enforcement logic is correct. Issues are in messages, edge-case detection, and the Edit-tool gap. |
| **FSM** (fsm.js, gate-checks.js) | 2 / 0 / 0 | 2 | Good internally. The FSM itself is complete, acyclic, and gate-consistent. All issues are in consumers (skills) writing invalid transitions. |
| **Schemas** (validate.js, state.js, checkpoint.js, gates.js, questions.js, tasks.js) | 0 / 2 / 2 | 4 | Fair. Engine is correct but overly permissive. Major coverage gap in state.yml. |
| **Gates** (g1-g5, gate-utils.js) | 0 / 1 / 4 | 5 | Good. All gates produce correct structural evaluations. Issues are code quality (duplication, dead imports) and one case-sensitivity bug. |
| **Skills** (scope, research, design, plan, spike, execute, status) | 5 / 6 / 0 | 11 | Fair. Execute is the weakest. The v2 split migration incompleteness affects scope, research, and execute. |
| **Agents** (9 definitions) | 1 / 1 / 0 | 2 | Good. All frontmatter is valid. Model tiering matches spec. One undocumented agent (sufficiency-evaluator), one worktree output gap. |
| **Templates** (7 files) | 0 / 0 / 0 | 0 | Excellent. All templates pass their corresponding schema validators without modification. |

---

## 5. Risk Assessment

### Will break during first real-world use

| Risk | Scenario | Certainty |
|------|----------|-----------|
| Execute terminal transition blocked | User reaches execute Step 7, writes `phase: "complete"`, hook denies. Lifecycle stuck at `execute_in_progress` forever. | **Certain** — FSM has no `execute_in_progress -> complete` transition. |
| Empty questions in research | Scope writes questions to `state.yml`. Research injects `questions.yml` via frontmatter, finds `questions: []`. Research proceeds with zero questions or errors. | **Certain** if scope writes only to `state.yml`. **Uncertain** if Claude also writes to `questions.yml` due to the template's existence. |
| Empty tasks in execute | Same pattern: plan populates tasks in `state.yml`, execute injects `tasks.yml`, finds `tasks: []`. | **Certain** if plan writes only to `state.yml`. |
| `--override` entry blocked | User tries `/expedite:design --override`, skill writes invalid gate entry, hook denies. | **Certain** — gate ID and outcome are both invalid. |

### Will likely cause issues during first use

| Risk | Scenario | Likelihood |
|------|----------|------------|
| Spike skip broken | No TDs after plan, user tries to skip spike. Execute accepts `plan_complete` but hook denies. User must run spike even with nothing to spike. | **High** if any lifecycle has no TDs. |
| Status display broken for spike | User runs `/expedite:status` during spike phase. Gets no phase-specific display or next-action guidance. | **High** if spike phase is reached. |
| Stale checkpoint after completion | Lifecycle completes but checkpoint.yml still shows last task. Confusing on inspection but not blocking. | **Certain** but non-blocking. |

### Suboptimal but unlikely to block

| Risk | Scenario | Impact |
|------|----------|--------|
| G1/G4 pass weak artifacts | Structurally valid but substantively weak scope/plan passes gates. Quality issues surface later. | Quality degradation, not runtime failure. |
| Override detection misclassified | Single-quoted YAML override logged as `state_write`. Audit trail inaccurate but lifecycle unaffected. | Audit accuracy only. |
| Gate history tampered | LLM rewrites gates.yml, changing previous gate result. Hook does not detect. | Low probability; LLM would need a reason to rewrite historical entries. |

---

## 6. Prioritized Fix Roadmap

### Must Fix Before First Use (Runtime-Blocking)

These bugs will cause hook denials or empty data during a standard lifecycle run.

| Priority | Bug ID | Fix |
|----------|--------|-----|
| 1 | AUD-001 | Execute Step 7: add intermediate write of `phase: "execute_complete"` before writing `phase: "complete"`. |
| 2 | AUD-002 | Execute Steps 1/3: remove `plan_complete` from accepted entry phases. Decide whether spike-skip is a supported path; if so, add FSM transition. |
| 3 | AUD-003 | Scope Step 9b: write questions to `.expedite/questions.yml` instead of `state.yml`. Update G1 to read from `questions.yml`. |
| 4 | AUD-004 | Execute Step 3: write tasks to `.expedite/tasks.yml` instead of `state.yml`. |
| 5 | AUD-006 | Execute Step 7: add completion checkpoint write. |
| 6 | AUD-007 | Document worktree merge-back in execute Step 5b. Add branch name to task-implementer output format. |

### Should Fix Before First Use (Correctness / Resilience)

These bugs will not block a lifecycle but will cause incorrect behavior, confusing messages, or data integrity issues.

| Priority | Bug ID | Fix |
|----------|--------|-----|
| 7 | AUD-005 | Fix `--override` entry paths: use valid gate IDs and `outcome: "overridden"`. |
| 8 | AUD-009 | Add spike phases and `execute_complete` to status skill. |
| 9 | AUD-008 | Reconcile state.yml schema: add `last_modified`, remove skill writes of fields that belong in split files (`current_step`, `questions`, `research_round`, `current_wave`, `current_task`). |
| 10 | AUD-014 | Standardize `research_round` location (write to `questions.yml`, inject in status). |
| 11 | AUD-011 | Fix research skill backup path to `.expedite/state.yml`. |
| 12 | AUD-015 | Renumber research steps contiguously. Update status skill totals. |
| 13 | AUD-013 | Fix HOOK-03 escalation message to reference `checkpoint.yml`. |
| 14 | AUD-010 | Fix G4 case-sensitive DA matching. |
| 15 | AUD-016 | Add explicit backup-before-write to execute Steps 5d, 6, 7 and research Step 12. |
| 16 | AUD-018, AUD-019 | Enumerate exact placeholder fields in agent dispatch instructions for task-implementer and web/codebase-researcher. |

### Fix During First Maintenance Pass (Quality Improvements)

| Priority | Bug ID | Fix |
|----------|--------|-----|
| 17 | AUD-012 | Fix override detection to handle all YAML quoting styles. |
| 18 | AUD-017 | Add hash-based existing-entry comparison for gates.yml immutability. |
| 19 | AUD-022 | Implement or remove `nullable: true` property in schemas. |
| 20 | AUD-023 | Add `severity` field to gates.yml schema. |
| 21 | AUD-021 | Add recovery instructions to schema denial messages. |
| 22 | AUD-025 | Fix truthiness check in session-summary.js. |
| 23 | AUD-020 | Remove `memory: project` from sufficiency-evaluator or document. |
| 24 | AUD-035 | Add `"Edit"` matcher to hook registration or document restriction. |
| 25 | AUD-027, AUD-028 | Consolidate duplicated helpers (`extractDAs`, `wordCount`) into gate-utils.js. |
| 26 | AUD-029 | Standardize `go_advisory` vs `go-with-advisory` naming. |
| 27 | AUD-024, AUD-026, AUD-030, AUD-031, AUD-032, AUD-033 | Cosmetic fixes: punctuation, step counts, dead code/imports, plugin.json metadata. |

---

## 7. Decision Area Readiness

| DA | Area | Verdict |
|----|------|---------|
| DA-01 | Hook Script Correctness | **PASS WITH ISSUES** — All exit-code contracts correct. 5 minor bugs (truthiness check, override detection, message text). No unhandled crashes. |
| DA-02 | FSM Validity | **PASS WITH ISSUES** — FSM itself is complete, acyclic, gate-consistent. Execute skill writes 2 invalid transitions. |
| DA-03 | Schema Validation | **PASS WITH ISSUES** — Validation engine is correct. State.yml schema missing 7+ fields. Nullable property decorative. |
| DA-04 | Gate Logic | **PASS WITH ISSUES** — All 5 gates structurally correct. G4 case-sensitivity bug. Code duplication across gates. |
| DA-05 | Skill Sequencer | **PASS WITH ISSUES** — All step sequences reachable. Execute missing completion checkpoint. Research non-contiguous numbering. v2 split gaps. |
| DA-06 | Agent Definitions | **PASS** — All frontmatter valid. Model tiering matches spec. Tool restrictions correct. Minor: sufficiency-evaluator memory setting. |
| DA-07 | Cross-References | **PASS WITH ISSUES** — All Glob patterns resolve. All agent dispatches match. Override entry gate IDs and status skill phase mappings broken. |
| DA-08 | Template-Schema | **PASS** — All 7 templates produce valid output. Zero bugs. |
| DA-09 | Hook Registration | **PASS WITH ISSUES** — All 4 events registered with correct paths. Edit tool not matched (theoretical bypass). Plugin.json cosmetic issues. |
| DA-10 | Portability | **PASS** — No hardcoded paths. Dependencies self-contained. Initialization sequence correct. |
| DA-11 | Spec Divergence | **PASS WITH ISSUES** — 43 divergences documented. 5 potential-bugs, most are intentional improvements. G1 question source and override severity are the concerns. |
| DA-12 | Error Recovery | **PASS WITH ISSUES** — Recovery procedure mechanically correct. Backup-before-write not enforced. Worktree branch orphan scenario unrecoverable. Gate scripts bypass hooks. |
| DA-13 | Skill Clarity | **FAIL** — v2 split file confusion is a P0 ambiguity affecting 3 skills. Worktree merge-back undocumented. Multiple underspecified agent dispatches. |
| DA-14 | Lifecycle Flow | **PASS WITH ISSUES** — Information flow is logically sound. Execute FSM bugs block terminal state. Spike skip path broken. |
| DA-15 | Decision Philosophy | **PASS WITH ISSUES** — Philosophy strongly embedded in design/plan/spike. G1 and G4 have no semantic evaluation. Research is a long mechanical zone by design. |

**Summary: 1 FAIL, 11 PASS WITH ISSUES, 3 PASS.**
