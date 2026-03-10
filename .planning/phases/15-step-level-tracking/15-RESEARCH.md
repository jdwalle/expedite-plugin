# Phase 15: Step-Level Tracking - Research

**Researched:** 2026-03-09
**Domain:** Plugin state management / YAML schema evolution / SKILL.md orchestration patterns
**Confidence:** HIGH

## Summary

Phase 15 adds a `current_step` field to state.yml that tracks which numbered step a user is currently on within any multi-step skill. The state.yml template documents this field, every stateful skill writes it on step entry, the status skill displays it, and existing lifecycles without the field continue working.

This is an internal-to-the-plugin change with zero external dependencies. The "stack" is the existing YAML state management pattern already used throughout the plugin: backup-before-write, complete-file rewrite, flat structure (max 2 nesting levels). The implementation touches 8 files (6 SKILL.md files, state.yml.template, status SKILL.md) with a highly repetitive pattern: read state, backup, update `current_step`, write.

**Primary recommendation:** Add `current_step` as an optional object field (`skill`, `step`, `label`) to state.yml. Each skill writes it at the top of every numbered step using the existing backup-before-write pattern. The status skill reads it and displays position. Backward compatibility is achieved by treating a missing `current_step` field as absent (no display, no error).

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| STEP-01 | state.yml schema includes optional `current_step` field (`skill`, `step`, `label`) | Schema design below: 3 sub-keys, optional (null default), fits within 2-level nesting constraint |
| STEP-02 | state.yml.template documents the `current_step` field | Template update pattern: add field with YAML comment documenting sub-keys and purpose |
| STEP-03 | Scope skill writes `current_step` on entry to each of its 9 numbered steps | Step inventory: scope has 10 steps (Steps 1-10), but Step 2 is a v2 placeholder -- see note. 9 "active" steps that need tracking |
| STEP-04 | Research skill writes `current_step` on entry to each numbered step | Step inventory: research has 18 steps (Steps 1-18) |
| STEP-05 | Design skill writes `current_step` on entry to each of its 10 numbered steps | Step inventory: design has 10 steps (Steps 1-10) |
| STEP-06 | Plan skill writes `current_step` on entry to each numbered step | Step inventory: plan has 9 steps (Steps 1-9) |
| STEP-07 | Spike skill writes `current_step` on entry to each numbered step | Step inventory: spike has 9 steps (Steps 1-9) |
| STEP-08 | Execute skill writes `current_step` on entry to each numbered step | Step inventory: execute has 7 steps (Steps 1-7) |
| STEP-09 | Status skill displays current step when `current_step` field exists; gracefully omits when absent | Display pattern: "scope: step 5 of 9 -- Adaptive Refinement"; omit section entirely when null/absent |
</phase_requirements>

## Standard Stack

### Core

No external libraries. This phase uses only the existing plugin infrastructure:

| Component | Location | Purpose | Why Standard |
|-----------|----------|---------|--------------|
| state.yml | `.expedite/state.yml` | Lifecycle state persistence | Already the single source of truth for all lifecycle state |
| state.yml.template | `templates/state.yml.template` | Schema definition for new lifecycles | Already the schema source -- new field goes here |
| SKILL.md files | `skills/{name}/SKILL.md` | Skill orchestration logic | Each skill already reads/writes state.yml via backup-before-write |
| Backup-before-write pattern | All skills | Safe state mutation | Already used 20+ times across skills |

### Supporting

None. No new dependencies.

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `current_step` object in state.yml | Separate `step-tracking.yml` file | Adds file I/O complexity, breaks single-source-of-truth pattern -- rejected |
| `current_step` object with `skill`, `step`, `label` | Simple string like `"scope:5"` | String requires parsing, loses label for display, harder to extend -- rejected |
| Writing `current_step` on every step | Writing only on "important" steps | Inconsistent tracking, defeats the purpose of always knowing position -- rejected |

## Architecture Patterns

### Schema Design

The `current_step` field fits within the existing state.yml flat structure constraint (max 2 nesting levels):

```yaml
# Level 0: top-level key
# Level 1: sub-keys (skill, step, label)
# This is exactly 2 levels -- at the constraint boundary
current_step:
  skill: "scope"
  step: 5
  label: "Adaptive Refinement"
```

This is the same nesting pattern used by `gate_history` items and `questions` items (flat objects with scalar values).

### Write Pattern

Every step entry follows the same pattern. Insert at the TOP of each `### Step N:` section, before any other logic:

```
**Step tracking:** Update state.yml `current_step` using the backup-before-write pattern:
1. Read `.expedite/state.yml`
2. Copy to backup: `cp .expedite/state.yml .expedite/state.yml.bak` (via Bash)
3. Update `current_step` to `{skill: "{skill_name}", step: {N}, label: "{Step Label}"}`
4. Update `last_modified` to current timestamp
5. Write the entire file back
```

### Coalescing with Existing State Writes

CRITICAL OPTIMIZATION: Many steps ALREADY perform a backup-before-write cycle for other purposes (phase transitions, question updates, gate history). In these cases, the `current_step` update should be FOLDED INTO the existing write -- NOT performed as a separate read/backup/write cycle. This avoids doubling the I/O for steps that already touch state.yml.

Steps that already write state.yml (fold `current_step` into existing write):
- **Scope Step 3**: Initializes state.yml (fold into initialization)
- **Scope Step 4**: Writes project_name, intent, lifecycle_id (fold into that write)
- **Scope Step 5**: Writes last_modified after convergence (fold into that write)
- **Scope Step 9**: Writes questions array (fold into that write)
- **Scope Step 10**: Writes gate result + phase transition (fold into that write)
- **Research Step 3**: Writes phase transition (fold in)
- **Research Step 10**: Writes question statuses (fold in)
- **Research Step 12**: Writes evaluator results (fold in)
- **Research Step 15**: Writes gate history (fold in)
- **Research Step 18**: Writes phase transition (fold in)
- **Design Step 3**: Writes phase transition (fold in)
- **Design Step 9**: Writes gate history (fold in)
- **Design Step 10**: Writes phase transition (fold in)
- **Plan Step 3**: Writes phase transition (fold in)
- **Plan Step 8**: Writes gate history (fold in)
- **Plan Step 9**: Writes phase transition (fold in)
- **Spike Step 7**: Writes gate history (fold in)
- **Execute Step 3**: Writes phase transition + task state (fold in)
- **Execute Step 5**: Writes current_task update per task (fold in)
- **Execute Step 6**: Writes checkpoint completion (fold in)
- **Execute Step 7**: Writes lifecycle completion (fold in)

Steps that do NOT currently write state.yml (need a NEW write cycle):
- **Scope Steps 1, 2, 6, 7, 8**: No existing state write
- **Research Steps 1, 2, 4, 5, 6, 7, 8, 9, 11, 13, 14, 16, 17**: No existing state write (many of these are batch formation, dispatch, display steps)
- **Design Steps 1, 2, 4, 5, 6, 7, 8**: No existing state write
- **Plan Steps 1, 2, 4, 5, 6, 7**: No existing state write
- **Spike Steps 1, 2, 3, 4, 5, 6, 8, 9**: No existing state write
- **Execute Steps 1, 2, 4**: No existing state write

### Deciding Which Steps Get FULL Write Cycles

The requirement says "writes `current_step` on entry to each numbered step." For steps that don't already write state.yml, this means adding a new backup-before-write cycle. This is the straightforward interpretation.

HOWEVER, some steps are very brief (e.g., Scope Step 2 is a 5-line v2 placeholder that just says "proceed to Step 3"). Adding a full backup-before-write cycle to a 5-line step adds significant ceremony for no user benefit.

**Recommendation:** Write `current_step` on every step entry regardless of step size. The requirement is explicit ("every numbered step"), and consistency is more valuable than micro-optimization. A backup-before-write cycle takes ~3 lines of instruction text in each step. The total cost across all skills is manageable, and users genuinely benefit from always knowing their position.

### Step Inventory

Complete inventory of all numbered steps across all 6 stateful skills:

#### Scope (10 steps, Steps 1-10)

| Step | Label | Already Writes state.yml? |
|------|-------|--------------------------|
| 1 | Lifecycle Check | No |
| 2 | Connected Flow Import (v2) | No |
| 3 | Initialize Lifecycle | Yes (initialization) |
| 4 | Interactive Questioning (Round 1: Context) | Yes (project_name, intent) |
| 5 | Interactive Questioning (Round 2: Adaptive Refinement) | Yes (last_modified) |
| 6 | Question Plan Generation and Review | No |
| 7 | Codebase Analysis (Additive Questions) | No |
| 8 | Source Configuration | No |
| 9 | Write Artifacts | Yes (questions array) |
| 10 | Gate G1 Evaluation | Yes (gate history, phase) |

Note: REQUIREMENTS.md says "9 numbered steps" for scope but the actual SKILL.md has 10 steps. Step 2 is a v2 placeholder ("Not yet implemented"). The requirement text "each of its 9 numbered steps" likely counted only active steps. The implementation should write `current_step` on ALL 10 steps for consistency, including the placeholder Step 2.

#### Research (18 steps, Steps 1-18)

| Step | Label | Already Writes state.yml? |
|------|-------|--------------------------|
| 1 | Prerequisite Check | No |
| 2 | Read Scope Artifacts | No |
| 3 | Initialize Research State | Yes (phase transition) |
| 4 | Form Source-Affinity Batches | No |
| 5 | Validate DA Coverage | No |
| 6 | Present Batch Plan for Approval | No |
| 7 | Pre-Validate Sources | No |
| 8 | Assemble Prompt Templates | No |
| 9 | Dispatch Parallel Subagents | No |
| 10 | Collect Results and Update State | Yes (question statuses) |
| 11 | Research Completion Summary | No |
| 12 | Sufficiency Assessment | Yes (evaluator results) |
| 13 | Dynamic Question Discovery | No (conditionally adds questions) |
| 14 | G2 Gate Evaluation | No (computes only) |
| 15 | Gate Outcome Handling | Yes (gate history) |
| 16 | Gap-Fill Dispatch | No (increments research_round) |
| 17 | Synthesis Generation | No |
| 18 | Research Completion | Yes (phase transition) |

Note: Research Step 13 and Step 16 conditionally write state.yml. The `current_step` write should be at the TOP of the step, before conditional logic, so it always fires.

#### Design (10 steps, Steps 1-10)

| Step | Label | Already Writes state.yml? |
|------|-------|--------------------------|
| 1 | Prerequisite Check | No |
| 2 | Read Scope + Research Artifacts | No |
| 3 | Initialize Design State | Yes (phase transition) |
| 4 | Generate Design Document | No |
| 5 | Write DESIGN.md | No |
| 6 | Generate HANDOFF.md (Product Intent Only) | No |
| 7 | Revision Cycle | No |
| 8 | G3 Gate Evaluation | No |
| 9 | Gate Outcome Handling | Yes (gate history) |
| 10 | Design Completion | Yes (phase transition) |

#### Plan (9 steps, Steps 1-9)

| Step | Label | Already Writes state.yml? |
|------|-------|--------------------------|
| 1 | Prerequisite Check | No |
| 2 | Read Design + Scope Artifacts | No |
| 3 | Initialize Plan State | Yes (phase transition) |
| 4 | Generate Implementation Plan | No |
| 5 | Write PLAN.md | No |
| 6 | Revision Cycle | No |
| 7 | G4 Gate Evaluation | No |
| 8 | Gate Outcome Handling | Yes (gate history) |
| 9 | Plan Completion | Yes (phase transition) |

#### Spike (9 steps, Steps 1-9)

| Step | Label | Already Writes state.yml? |
|------|-------|--------------------------|
| 1 | Prerequisite Check | No |
| 2 | Parse Phase Argument | No |
| 3 | Read Plan Artifacts | No |
| 4 | Extract Phase Definition | No |
| 5 | Resolve Tactical Decisions | No |
| 6 | Generate Implementation Steps | No |
| 7 | G5 Structural Gate | Yes (gate history) |
| 8 | Write SPIKE.md | No |
| 9 | Display Summary | No |

#### Execute (7 steps, Steps 1-7)

| Step | Label | Already Writes state.yml? |
|------|-------|--------------------------|
| 1 | Prerequisite Check | No |
| 2 | Read Plan + Spike Artifacts | No |
| 3 | Initialize Execute State | Yes (phase transition, task state) |
| 4 | Determine Starting Point | No |
| 5 | Task Execution Loop | Yes (current_task per iteration) |
| 6 | Phase Completion | Yes (checkpoint completion) |
| 7 | Lifecycle Completion | Yes (phase transition) |

**Total: 63 numbered steps across 6 skills.**

### Total Step Counts Per Skill (for status display)

These are the denominators for the "step X of Y" display:

| Skill | Total Steps |
|-------|-------------|
| scope | 10 |
| research | 18 |
| design | 10 |
| plan | 9 |
| spike | 9 |
| execute | 7 |

### Clearing `current_step`

`current_step` should be set to `null` when:
1. A skill completes its final step (the gate/completion step sets it to null)
2. A lifecycle is archived (archival moves state.yml)
3. A new lifecycle is initialized (template has `current_step: null`)

Specifically:
- Scope Step 10 (G1 gate): On "go" or "go_advisory", set `current_step: null` in the same write that sets `phase: "scope_complete"`
- Research Step 18: Set `current_step: null` with `phase: "research_complete"`
- Design Step 10: Set `current_step: null` with `phase: "design_complete"`
- Plan Step 9: Set `current_step: null` with `phase: "plan_complete"`
- Spike Step 9: Set `current_step: null` (spike doesn't transition phase)
- Execute Step 7: Set `current_step: null` with `phase: "complete"`
- Execute Step 6 (non-final phase): Set `current_step: null` when phase completes but lifecycle continues

### Status Skill Display Pattern

The status skill (STEP-09) needs to display step position. Current status skill output format:

```
**Phase:** {phase} ({human-readable description})
```

Add a new line after Phase when `current_step` is present:

```
**Phase:** {phase} ({human-readable description})
**Current Step:** {skill}: step {step} of {total} -- {label}
```

When `current_step` is null or absent, omit the "Current Step" line entirely. No error, no placeholder.

The status skill needs a lookup table mapping skill name to total step count:

```
scope -> 10
research -> 18
design -> 10
plan -> 9
spike -> 9
execute -> 7
```

This is hardcoded in the status SKILL.md. If a skill's step count changes in the future, the status skill's table must be updated.

### Anti-Patterns to Avoid

- **Writing `current_step` at step END instead of step ENTRY:** The requirement says "on entry to each numbered step." Writing at the end defeats the purpose -- if a crash happens during the step, the tracking would show the PREVIOUS step.
- **Performing a separate backup-before-write cycle when the step already writes state.yml:** Double I/O with no benefit. Fold the `current_step` update into the existing write.
- **Making `current_step` required (non-null):** This breaks backward compatibility. Existing v1.0 lifecycles have no `current_step` field. Skills and status must handle null/absent gracefully.
- **Storing step count in state.yml:** Step counts are static metadata about each skill. They belong hardcoded in the status SKILL.md, not in runtime state.
- **Using `current_step` for resume routing:** The requirement does NOT ask for this. Resume logic remains as-is (artifact-based detection). `current_step` is purely for user orientation via status display. Mixing concerns would add complexity and risk.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| YAML serialization | Custom string concatenation | Existing complete-file-rewrite pattern | Already proven across 20+ state writes; handles edge cases |
| Step count tracking | Dynamic step counting from SKILL.md | Hardcoded lookup table in status skill | SKILL.md step counts are static; dynamic parsing adds fragility |
| Backward compatibility | Migration script for old state.yml files | Null-safe field access | Missing field = null = omit display; no migration needed |

**Key insight:** This feature adds a single new field using patterns already proven across the codebase. The risk is not technical complexity -- it is the sheer NUMBER of edit points (63 steps across 6 files). The plan should be structured to minimize human error through consistent templating.

## Common Pitfalls

### Pitfall 1: Forgetting to Clear current_step on Skill Completion
**What goes wrong:** After a skill completes (gate passes, phase transitions), `current_step` still shows the last step of the completed skill. Status display would say "scope: step 10 of 10" even when the user is now in research.
**Why it happens:** The completion step writes the phase transition but forgets to null out `current_step`.
**How to avoid:** Every completion/gate-pass state write that sets a new phase MUST also set `current_step: null`.
**Warning signs:** Status skill shows a step from a different skill than the current phase.

### Pitfall 2: Inconsistent Step Labels
**What goes wrong:** The label in `current_step` doesn't match the `### Step N:` heading in SKILL.md. User sees "step 5 -- Adaptive Refinement" in status but the SKILL.md heading says "Interactive Questioning (Round 2: Adaptive Refinement)".
**Why it happens:** Labels are manually typed in each step's tracking instruction. Typos or abbreviations creep in.
**How to avoid:** Use a consistent label extraction rule: the label is the text after the colon in `### Step N: {label}`. Planner should provide the exact label for each step.
**Warning signs:** Mismatch between status output and SKILL.md heading.

### Pitfall 3: Missing current_step on Resume Paths
**What goes wrong:** Resume logic (Case B in prerequisite checks) skips Step 1 and jumps to a later step. If the jump target doesn't write `current_step`, the tracking is stale.
**Why it happens:** Resume paths skip steps, so the "on entry" write for earlier steps doesn't fire.
**How to avoid:** The resume target step still writes `current_step` on entry (it must, because the instruction is at the top of the step). Verify that resume targets include step tracking.
**Warning signs:** After resume, status shows null or a stale step.

### Pitfall 4: Step Count Mismatch Between Skill and Status
**What goes wrong:** A future change adds or removes a step from a SKILL.md but doesn't update the status skill's hardcoded lookup table. Status displays "step 5 of 9" but the skill now has 10 steps.
**Why it happens:** Two files must stay in sync with no automated enforcement.
**How to avoid:** Add a comment in each SKILL.md noting the total step count (e.g., "# Total steps: 10 (update status SKILL.md if changed)"). This doesn't prevent drift but makes it visible.
**Warning signs:** Status shows "step X of Y" where X > Y.

### Pitfall 5: Scope Step 2 Counting Discrepancy
**What goes wrong:** REQUIREMENTS.md says scope has "9 numbered steps" but the actual SKILL.md has 10 (Step 2 is a v2 placeholder). If the implementation writes `current_step` for all 10 but status displays "of 9", it looks broken.
**Why it happens:** Requirements were written counting only "active" steps, excluding the placeholder.
**How to avoid:** Count ALL steps including the placeholder. The user doesn't know or care that Step 2 is a placeholder -- they just see step numbers. Use 10 as the total for scope.
**Warning signs:** Status says "step 10 of 9".

## Code Examples

### state.yml.template Addition

```yaml
# Current position within active skill (set on step entry, cleared on skill completion)
# Sub-keys: skill (string), step (integer), label (string)
# Example: {skill: "scope", step: 5, label: "Adaptive Refinement"}
current_step: null
```

Place after the `phase` and `current_task` fields, before the `imported_from` field.

### Step Entry Tracking (Standalone -- No Existing State Write)

For steps that do NOT already write state.yml, add this instruction block at the very beginning of the step:

```markdown
**Step tracking:** Update `current_step` in state.yml (backup-before-write):
1. Read `.expedite/state.yml`
2. Backup: `cp .expedite/state.yml .expedite/state.yml.bak` (via Bash)
3. Set `current_step` to `{skill: "{skill}", step: {N}, label: "{Label}"}`
4. Set `last_modified` to current timestamp
5. Write the entire file back
```

### Step Entry Tracking (Folded Into Existing State Write)

For steps that ALREADY write state.yml, add a single line to the existing "Update the in-memory representation" instructions:

```markdown
   - Set `current_step` to `{skill: "{skill}", step: {N}, label: "{Label}"}`
```

### Completion Step (Clear current_step)

For the final step of each skill (or the step that transitions phase), add to the existing write:

```markdown
   - Set `current_step` to null
```

### Status Skill Display

```markdown
3. **Parse current_step (if present).** If the injected state contains a `current_step` field that is not null:
   - Extract `skill`, `step`, and `label`
   - Look up total steps for the skill:
     - scope: 10, research: 18, design: 10, plan: 9, spike: 9, execute: 7
   - Format: `{skill}: step {step} of {total} -- {label}`
   - If the skill name is not in the lookup table, display without total: `{skill}: step {step} -- {label}`
```

Add to the display format after the Phase line:

```
**Phase:** {phase} ({human-readable description})
**Current Step:** {skill}: step {step} of {total} -- {label}
```

### Backward Compatibility

No special handling needed. The status skill checks:

```
If `current_step` is null or not present in state:
  -> Omit the "Current Step" line entirely
```

Existing v1.0 lifecycles have no `current_step` field in their state.yml. When these files are read, the field is simply absent. All skills that read state.yml already handle unknown fields gracefully (YAML parsing ignores extra fields; missing fields default to null).

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Phase-level tracking only | Phase + step-level tracking | v1.1 (this phase) | Users always know exact position within multi-step skills |

**Deprecated/outdated:**
- The `current_step: "scope:5"` string format (mentioned in memory/step-tracking-gap.md) was considered but rejected in favor of the structured object `{skill, step, label}` for display-friendliness and extensibility.

## Open Questions

1. **Should `current_step` be used for resume routing in addition to display?**
   - What we know: The memory file (step-tracking-gap.md) suggests using step tracking for "precise routing" on resume. The requirements (STEP-01 through STEP-09) only specify display.
   - What's unclear: Whether the user intends this phase to also enhance resume logic.
   - Recommendation: Implement display-only per requirements. Resume routing is a separate concern that would require changing existing resume logic in all skills. If desired, it should be a separate phase (e.g., in v1.2 RESL track).

2. **Should Scope Step 2 be included in the count?**
   - What we know: Requirements say "9 numbered steps" for scope. SKILL.md has 10 steps with Step 2 being a v2 placeholder.
   - What's unclear: Whether the user counted active steps or all steps.
   - Recommendation: Include all 10 steps. It costs nothing, maintains consistency, and avoids the confusing "step 10 of 9" scenario if Step 2 is excluded from the count but still tracked.

3. **Should Research Step 16 (Gap-Fill Dispatch) track current_step when it loops back to Step 12?**
   - What we know: Step 16 dispatches gap-fill agents, then returns to Step 12. The loop means Step 12 writes `current_step` again with its own values, overwriting Step 16's tracking.
   - What's unclear: Whether the brief "Step 16 -> Step 12" transition needs to be visible in tracking.
   - Recommendation: Yes, write `current_step` at Step 16 entry. It will be overwritten when Step 12 runs, but if a crash happens during gap-fill dispatch, the tracking correctly shows Step 16.

## Sources

### Primary (HIGH confidence)

- Direct codebase analysis: All 6 SKILL.md files read in full, step inventories compiled from actual `### Step N:` headings
- `templates/state.yml.template` read directly -- confirmed flat structure constraint and existing field patterns
- `memory/step-tracking-gap.md` read -- confirmed the original problem statement and proposed approach
- `.planning/REQUIREMENTS.md` read -- confirmed exact requirement text for STEP-01 through STEP-09

### Secondary (MEDIUM confidence)

- None needed. This is a pure internal-to-the-plugin change with no external dependencies.

### Tertiary (LOW confidence)

- None.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- no new dependencies, uses existing patterns exclusively
- Architecture: HIGH -- schema design verified against flat-structure constraint, write pattern verified against existing backup-before-write usage
- Pitfalls: HIGH -- identified from direct codebase analysis (step count discrepancies, resume paths, completion clearing)

**Research date:** 2026-03-09
**Valid until:** Indefinite -- this is pure internal analysis with no external dependency versioning concerns
