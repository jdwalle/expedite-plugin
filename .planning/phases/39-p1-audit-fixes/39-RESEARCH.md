# Phase 39: P1 Audit Fixes - Research

**Researched:** 2026-03-17
**Domain:** Expedite plugin correctness and data integrity fixes (AUD-008 through AUD-021)
**Confidence:** HIGH

## Summary

This research validates the 14 P1 audit findings (AUD-008 through AUD-021) from the final audit research synthesis against the current source code, post-Phase 38 (which fixed the 7 P0 bugs AUD-001 through AUD-007). Each finding was verified by reading the exact files and lines cited in the audit.

All 14 P1 bugs are confirmed as real. The fixes span three categories: (1) skill instruction edits to SKILL.md files (AUD-008, AUD-009, AUD-011, AUD-014, AUD-015, AUD-016, AUD-018, AUD-019), (2) JavaScript hook/gate code changes (AUD-010, AUD-012, AUD-013, AUD-017, AUD-021), and (3) agent definition edits (AUD-020). Unlike Phase 38 which was almost entirely skill instruction edits with one JS change, Phase 39 has a heavier JavaScript component -- 5 of 14 bugs require hook or gate script changes.

The bugs cluster into four themes: state schema reconciliation (AUD-008, AUD-014), status skill completeness (AUD-009), hook enforcement improvements (AUD-010, AUD-012, AUD-013, AUD-017, AUD-021), and instruction clarity (AUD-011, AUD-015, AUD-016, AUD-018, AUD-019, AUD-020).

**Primary recommendation:** Fix all 14 bugs in a single plan with 3 tasks grouped by target file type: (1) skill instruction fixes, (2) JavaScript hook/gate code fixes, (3) agent definition fix. Each fix is surgical and well-defined.

## Validated Bug List

### AUD-008: State.yml schema missing 7+ fields that skills actively write

**Status: CONFIRMED**
**Confidence: HIGH**

**Evidence:** The state.yml schema (`hooks/lib/schemas/state.js` lines 23-35) defines only these fields:
```javascript
fields: {
  version: { type: 'number' },
  lifecycle_id: { type: 'string', nullable: true },
  project_name: { type: 'string', nullable: true },
  intent: { type: 'string', nullable: true, enum: ['product', 'engineering'] },
  description: { type: 'string', nullable: true },
  phase: { type: 'string', enum: VALID_PHASES },
  started_at: { type: 'string', nullable: true },
  phase_started_at: { type: 'string', nullable: true },
}
```

Skills actively write these additional fields to state.yml:
- `last_modified` -- written by every skill at every step boundary (step tracking boilerplate)
- `current_step` -- written by every skill at every step boundary (step tracking boilerplate)

After Phase 38 fixes:
- `questions` -- NO LONGER written to state.yml (fixed by AUD-003, now goes to questions.yml)
- `current_wave`, `current_task`, `tasks` -- NO LONGER written to state.yml (fixed by AUD-004, now go to tasks.yml)
- `research_round` -- still written to state.yml by research Step 3 (AUD-014 addresses this)
- `auto_commit` -- referenced in execute SKILL.md but not actively written (user-set flag, checked not written)

**Post-Phase 38 reality:** Only 3 fields remain unschematized: `last_modified`, `current_step`, and `research_round`. The Phase 38 fixes already moved questions/tasks/wave/task to split files.

**Recommended fix:**
1. Add `last_modified: { type: 'string', nullable: true }` to state.yml schema (written at every step boundary, should be validated)
2. Remove `current_step` writes from skills -- it is fully redundant with `checkpoint.yml` which already tracks skill/step/label/substep. This was the audit's own recommendation.
3. `research_round` is addressed by AUD-014 (move to questions.yml)

**Files to modify:** `hooks/lib/schemas/state.js` (add `last_modified`), multiple SKILL.md files (remove `current_step` writes from step tracking boilerplate), `skills/status/SKILL.md` (stop reading `current_step` from state.yml, use checkpoint.yml instead)

**Important:** Removing `current_step` from state.yml is a cross-cutting change affecting ALL 6 active skills (scope, research, design, plan, spike, execute) plus the status skill. This is the largest single change in Phase 39. However, every skill already writes checkpoint.yml with the same information, so `current_step` in state.yml is purely redundant. The status skill already reads checkpoint.yml (Step 3 "Parse current_step (if present)" reads the injected state but could instead read the injected checkpoint).

### AUD-009: Status skill omits spike phases and execute_complete

**Status: CONFIRMED**
**Confidence: HIGH**

**Evidence:** Status SKILL.md has three gaps:

1. **Phase ordering (Step 5, line 86):** Lists:
   ```
   scope_in_progress < scope_complete < research_in_progress < research_complete < design_in_progress < design_complete < plan_in_progress < plan_complete < execute_in_progress < complete
   ```
   Missing: `spike_in_progress`, `spike_complete`, `execute_complete`

2. **Human-readable descriptions (Step 6, lines 97-107):** Maps 11 phases but omits:
   - `spike_in_progress` -> (no mapping)
   - `spike_complete` -> (no mapping)
   - `execute_complete` -> (no mapping)

3. **Next-action routing (Step 7, lines 110-121):** Maps 11 phases but omits:
   - `spike_in_progress` -> (no routing)
   - `spike_complete` -> (no routing)
   - `execute_complete` -> (no routing)

The `session-summary.js` has `NEXT_SKILL` mapping that includes `spike_complete: 'execute'` but lacks `spike_in_progress` and `execute_complete`.

**Recommended fix:** Add all three missing phases to Steps 5, 6, and 7:
- `spike_in_progress` -> "Spike: resolving tactical decisions" / "Continue with `/expedite:spike`"
- `spike_complete` -> "Spike: complete, ready for execution" / "Run `/expedite:execute` to begin implementation"
- `execute_complete` -> "Execute: tasks complete, finalizing" / "Lifecycle completing..."

Insert into phase ordering: `... plan_complete < spike_in_progress < spike_complete < execute_in_progress < execute_complete < complete`

**Files to modify:** `skills/status/SKILL.md` (Steps 5, 6, 7)

### AUD-010: G4 case-sensitive DA matching

**Status: CONFIRMED**
**Confidence: HIGH**

**Evidence:** G4 gate script (`gates/g4-plan.js` line 166):
```javascript
var found = planContent && planContent.indexOf(daId) !== -1;
```

Compare with G2 and G3 which use case-insensitive matching (e.g., `content.toUpperCase().indexOf(da.id.toUpperCase())`). The G4 `extractDAs` function (line 54) extracts DA IDs using `match[1]` which preserves the original casing from SCOPE.md. If SCOPE.md uses "DA-1" but PLAN.md uses "da-1", the match fails.

**Recommended fix:** Normalize case:
```javascript
var found = planContent && planContent.toUpperCase().indexOf(daId.toUpperCase()) !== -1;
```

**Files to modify:** `gates/g4-plan.js` (line 166, M2 criterion)

### AUD-011: Research skill backup path uses relative path

**Status: CONFIRMED**
**Confidence: HIGH**

**Evidence:** Research SKILL.md step tracking boilerplate (line 42):
```
backup-before-write: read, `cp state.yml state.yml.bak`
```

This uses relative paths. All other skills use absolute paths like `cp .expedite/state.yml .expedite/state.yml.bak`. The relative path would create the backup in whatever the current working directory happens to be, not in the `.expedite/` directory.

**Recommended fix:** Change to `cp .expedite/state.yml .expedite/state.yml.bak` in the step tracking boilerplate.

**Files to modify:** `skills/research/SKILL.md` (line 42, step tracking boilerplate)

### AUD-012: Override detection handles only double-quoted YAML

**Status: CONFIRMED**
**Confidence: HIGH**

**Evidence:** Audit hook (`hooks/audit-state-change.js` line 63):
```javascript
if (matchedFile === 'gates.yml' && content.indexOf('outcome: "overridden"') !== -1) {
```

This only matches double-quoted YAML: `outcome: "overridden"`. It will NOT match:
- `outcome: 'overridden'` (single-quoted)
- `outcome: overridden` (unquoted)

Since YAML allows all three quoting styles, overrides using single quotes or no quotes would be logged as `state_write` instead of `override_write`, producing an inaccurate audit trail.

**Recommended fix:** Use regex or parse YAML and check field value:
```javascript
if (matchedFile === 'gates.yml' && /outcome:\s*['"]?overridden['"]?/.test(content)) {
```

Or better, parse the YAML and check:
```javascript
if (matchedFile === 'gates.yml') {
  var parsed = yaml.load(content);
  var history = parsed && Array.isArray(parsed.history) ? parsed.history : [];
  var hasOverride = history.some(function(e) { return e.outcome === 'overridden'; });
  if (hasOverride) { ... }
}
```

The YAML-parsing approach is more robust but adds a dependency on the yaml module (which is already required at line 70 for state phase lookup). The regex approach is simpler and sufficient for audit logging.

**Files to modify:** `hooks/audit-state-change.js` (line 63)

### AUD-013: HOOK-03 escalation message references state.yml instead of checkpoint.yml

**Status: CONFIRMED**
**Confidence: HIGH**

**Evidence:** `hooks/validate-state-write.js` lines 203-205:
```javascript
cpReason += '\n\nThis denial has occurred ' + cpCount + ' times. ' +
  'Consider manual intervention: edit .expedite/state.yml directly, ' +
  'or set EXPEDITE_HOOKS_DISABLED=true to bypass all enforcement.';
```

HOOK-03 is the checkpoint step regression guard. The denial is about checkpoint.yml, but the escalation message says "edit .expedite/state.yml directly". This is confusing and potentially harmful -- editing state.yml won't fix a checkpoint regression.

**Recommended fix:** Change `state.yml` to `checkpoint.yml`:
```javascript
'Consider manual intervention: edit .expedite/checkpoint.yml directly, ' +
```

**Files to modify:** `hooks/validate-state-write.js` (line 204)

### AUD-014: research_round location conflict

**Status: CONFIRMED**
**Confidence: HIGH**

**Evidence:** Three conflicting locations:
1. `templates/questions.yml.template` defines `research_round: 0` (line 5)
2. Research SKILL.md Step 3 (line 67) writes `research_round` to state.yml: `increment research_round`
3. Status SKILL.md Step 2 (line 52) reads `research_round` from injected state.yml

The questions.yml template defines `research_round` as living in questions.yml. But the research skill writes it to state.yml, and the status skill reads it from state.yml. The template is never used after initialization -- scope writes questions.yml with `research_round: 0`, but research updates it in state.yml.

**Recommended fix:** Standardize on questions.yml:
1. Research Step 3: write `research_round` to questions.yml instead of state.yml
2. Research Step 17 (Gap-Fill): increment `research_round` in questions.yml
3. Status SKILL.md: inject questions.yml in frontmatter and read `research_round` from it

**Files to modify:** `skills/research/SKILL.md` (Steps 3, 17), `skills/status/SKILL.md` (frontmatter + Step 2)

### AUD-015: Research skill non-contiguous step numbering

**Status: CONFIRMED**
**Confidence: HIGH**

**Evidence:** Research SKILL.md step headings:
```
Step 1, Step 2, Step 3, Step 4, Step 5, Step 9, Step 11, Step 12, Step 13, Step 14, Step 15, Step 16, Step 17, Step 18
```

Missing step numbers: 6, 7, 8, 10. This is because steps were merged during a prior optimization (noted in comments like "Merged steps: Original Steps 4, 5, 6" and "Original Step 10"), but the remaining steps were never renumbered.

Status SKILL.md Step 3 (line 58) reports: `research: 18` total steps. But only 14 steps actually exist. `session-summary.js` (line 11) also reports `research: 18`.

Resume to a missing step number (e.g., checkpoint says step 8) would fail silently -- the skill would look for "### Step 8" and not find it.

**Recommended fix:**
1. Renumber research steps contiguously: 1-14 instead of 1-5, 9, 11-18
2. Update status SKILL.md step total: `research: 14` (not 18)
3. Update `session-summary.js` SKILL_STEP_TOTALS: `research: 14`

**Important:** Per STATE.md decision `[31-01]`: "Research skill step numbers preserved for resume/checkpoint backward compatibility." This decision was made to avoid breaking existing checkpoints. However, no real-world lifecycles exist yet (the plugin hasn't been used), so backward compatibility is not a concern. The decision should be superseded.

**Files to modify:** `skills/research/SKILL.md` (renumber all step headings), `skills/status/SKILL.md` (Step 3 totals), `hooks/lib/session-summary.js` (SKILL_STEP_TOTALS)

### AUD-016: Missing backup-before-write in execute Steps 5d, 6, 7 and research Step 12

**Status: PARTIALLY CONFIRMED**
**Confidence: HIGH**

**Evidence after Phase 38 fixes:**

Execute SKILL.md:
- **Step 5d (line 124):** "Update per-phase checkpoint.yml ... Update tasks.yml (current_task, task status). Write top-level checkpoint with substep." -- No explicit backup-before-write for tasks.yml here. The general step tracking boilerplate at line 40 covers state.yml backup, but tasks.yml writes in 5d lack explicit backup.
- **Step 6 (lines 132-137):** "Update per-phase checkpoint ... Append phase summary to PROGRESS.md ... Update state.yml: keep execute_in_progress, clear current_step. Update tasks.yml: clear current_wave/current_task." -- No explicit backup-before-write for either state.yml or tasks.yml at this step.
- **Step 7 (lines 142-146):** Phase 38 ALREADY added "Backup-before-write state.yml" and "Backup-before-write tasks.yml" explicitly. **Step 7 is already fixed.**

Research SKILL.md:
- **Step 12 (line 99-105):** Dispatches sufficiency-evaluator, then reads results, then "Update state.yml with final statuses and gap_details." No explicit backup-before-write for this state.yml write. However, the general step tracking boilerplate at line 42 includes backup-before-write for the step tracking write that happens before Step 12. The issue is the ADDITIONAL write after the agent returns.

**Recommended fix:**
1. Execute Step 5d: Add explicit `cp .expedite/tasks.yml .expedite/tasks.yml.bak` before tasks.yml write
2. Execute Step 6: Add explicit backup-before-write for state.yml and tasks.yml writes
3. Research Step 12: Add explicit backup-before-write for the post-agent state.yml write

Step 7 is already fixed (Phase 38 added explicit backups).

**Files to modify:** `skills/execute/SKILL.md` (Steps 5d, 6), `skills/research/SKILL.md` (Step 12)

### AUD-017: Gates.yml history immutability not enforced

**Status: CONFIRMED**
**Confidence: HIGH**

**Evidence:** `hooks/validate-state-write.js` lines 227-261 (HOOK-04) validates gates.yml writes by:
1. Reading the current gates.yml from disk
2. Counting existing entries: `existingCount = currentGates.history.length`
3. Only validating NEW entries: `for (var gi = existingCount; gi < parsed.history.length; gi++)`

This means the LLM could rewrite the entire gates.yml file, changing previous gate results (e.g., changing a "recycle" to "go"), and the hook would only validate entries beyond the existing count. The existing entries are not compared against the file on disk.

**Recommended fix:** Add hash-based or content comparison of existing entries:
```javascript
// Before validating new entries, verify existing entries are unchanged
for (var ei = 0; ei < existingCount; ei++) {
  var existing = currentGates.history[ei];
  var proposed = parsed.history[ei];
  if (JSON.stringify(existing) !== JSON.stringify(proposed)) {
    deny('Gate write blocked: existing history entry at index ' + ei + ' was modified. Gate history is immutable.');
    return;
  }
}
```

**Files to modify:** `hooks/validate-state-write.js` (HOOK-04 section, after existingCount calculation)

### AUD-018: Task-implementer agent dispatch underspecified

**Status: CONFIRMED**
**Confidence: HIGH**

**Evidence:** Execute SKILL.md Step 5b (line 99):
```
Assemble task context: task definition (from SPIKE.md steps or PLAN.md criteria),
file targets, acceptance criteria, design decision reference from DESIGN.md,
execution mode (spiked/unspiked).
```

The task-implementer agent frontmatter (`agents/task-implementer.md`) uses these placeholders:
- `{{project_name}}`, `{{intent}}`, `{{task_id}}`, `{{task_title}}`, `{{execution_mode}}`
- `{{spike_file}}`, `{{plan_file}}`, `{{design_file}}`
- `{{task_definition}}`, `{{design_context}}`

The execute skill says "assemble task context" without enumerating which placeholder fields to populate or where to source each value. The agent's `<input_data>` block at the end lists `{{task_definition}}`, `{{execution_mode}}`, `{{design_context}}` which the skill should explicitly construct.

**Recommended fix:** Enumerate exact placeholder names and source locations in Step 5b:
```
Pass to agent: project_name (from state.yml), intent (from state.yml),
task_id (from current task), task_title (from current task),
execution_mode ("spiked" if SPIKE.md exists, else "unspiked"),
spike_file (".expedite/plan/phases/{slug}/SPIKE.md"),
plan_file (".expedite/plan/PLAN.md"),
design_file (".expedite/design/DESIGN.md"),
task_definition (extracted task steps or criteria),
design_context (relevant DA section from DESIGN.md)
```

**Files to modify:** `skills/execute/SKILL.md` (Step 5b)

### AUD-019: Web/codebase-researcher dispatch missing codebase_root

**Status: CONFIRMED**
**Confidence: HIGH**

**Evidence:** Research SKILL.md Step 5b (lines 82-86):
```
Pass assembled context: project_name, intent, research_round, output paths,
questions YAML block with evidence_requirements.
```

The codebase-researcher agent (`agents/codebase-researcher.md`) uses `{{codebase_root}}` and `{{output_file}}` placeholders. The web-researcher uses `{{output_dir}}` and `{{output_file}}`. The research skill says "output paths" without specifying whether to use `output_dir` or `output_file`, and does not mention `codebase_root` at all.

The codebase-researcher frontmatter context block (line 29) has:
```
Codebase root: {{codebase_root}}
```

**Recommended fix:** Enumerate exact placeholder fields in Step 5b:
```
For web-researcher: project_name, intent, research_round,
  output_file (".expedite/research/evidence-{batch_id}.md"),
  batch_id, timestamp, questions_yaml_block

For codebase-researcher: project_name, intent, research_round,
  codebase_root (project root directory path),
  output_file (".expedite/research/evidence-{batch_id}.md"),
  batch_id, timestamp, questions_yaml_block
```

**Files to modify:** `skills/research/SKILL.md` (Step 5b)

### AUD-020: sufficiency-evaluator has `memory: project` without spec basis

**Status: CONFIRMED**
**Confidence: HIGH**

**Evidence:** `agents/sufficiency-evaluator.md` line 15:
```yaml
memory: project
```

Per STATE.md decision `[30-02]`: "Sufficiency evaluator retains Task() dispatch with Phase 31 TODO comment (not yet a named agent)." There is no decision explicitly granting persistent memory to the sufficiency evaluator.

The gate-verifier and research-synthesizer are the only agents with documented spec basis for persistent memory. The sufficiency evaluator assesses evidence requirements mechanically -- persistent memory could introduce evaluation bias (remembering prior assessments could influence future ones).

**Recommended fix:** Remove `memory: project` from the sufficiency-evaluator frontmatter. The agent should start fresh each dispatch to avoid bias.

**Files to modify:** `agents/sufficiency-evaluator.md` (remove line 15)

### AUD-021: Schema denial has no recovery instructions

**Status: CONFIRMED**
**Confidence: HIGH**

**Evidence:** `hooks/validate-state-write.js` lines 93-95:
```javascript
if (!result.valid) {
  deny('State validation failed: ' + result.errors.join('; '));
  return;
}
```

Compare with FSM denials (lines 117-118) which include:
```
'To bypass enforcement entirely, set EXPEDITE_HOOKS_DISABLED=true.'
```

And gate denials (lines 141-145) which include:
```
'To override: Write gates.yml with a new history entry...'
```

Schema denials give only the error list with no actionable instructions for recovery. The LLM will see "State validation failed: phase must be one of [...]" with no guidance on how to fix the data and retry.

**Recommended fix:** Add recovery instructions:
```javascript
deny('State validation failed: ' + result.errors.join('; ') +
  '. Fix the data to match the schema and retry the write.' +
  ' To bypass enforcement entirely, set EXPEDITE_HOOKS_DISABLED=true.');
```

**Files to modify:** `hooks/validate-state-write.js` (line 94)

## Architecture Patterns

### Pattern: Surgical Edits (Same as Phase 38)

All fixes are minimal, targeted changes to specific files and lines. No structural refactoring. The pattern for each fix:
1. Read the current file
2. Locate the exact line/section referenced
3. Make the minimal change to fix the bug
4. Verify the fix is consistent with neighboring code

### Pattern: Schema Field Management

When adding fields to state.yml schema, follow the existing pattern:
```javascript
field_name: { type: 'string', nullable: true }
```

Fields with enums use: `{ type: 'string', enum: ['val1', 'val2'] }`

The validation engine (`hooks/lib/validate.js`) iterates only schema-declared fields -- unknown fields pass silently. Adding a field to the schema enables type/enum checking for it.

### Pattern: Status Skill Phase Mapping

The status skill has three parallel data structures that must stay synchronized:
1. **Phase ordering** (Step 5, line 86) -- determines artifact expectations
2. **Human-readable descriptions** (Step 6, lines 97-107) -- display text
3. **Next-action routing** (Step 7, lines 110-121) -- navigation guidance

When adding phases, ALL THREE must be updated together.

### Pattern: Step Tracking Boilerplate

Every skill has identical step tracking boilerplate that writes `current_step` to state.yml. If AUD-008 removes `current_step` from state.yml, this boilerplate must be updated in all 6 skills to either: (a) remove the `current_step` state.yml write entirely (checkpoint.yml already has the same data), or (b) keep it but add the field to the schema.

**Recommendation:** Option (a) -- remove `current_step` from state.yml writes. This eliminates redundancy and reduces unnecessary state.yml writes (which trigger hook validation). Checkpoint.yml already stores `skill`, `step`, `label`, and `substep`.

### Anti-Patterns to Avoid

- **Partial status skill updates:** Adding a phase to only one of the three parallel structures (ordering, descriptions, routing) -- all three must stay in sync.
- **Regex-only override detection:** While regex works for the audit hook (non-blocking), avoid regex for enforcement hooks where correctness matters -- parse YAML instead.
- **Modifying gate history in HOOK-04:** The immutability check should ONLY compare existing entries, never modify them. It is a read-and-compare operation.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| YAML quoting detection | String indexOf checks | YAML parse + field access | YAML has 3 quoting styles; string matching misses 2 |
| History immutability | Custom hash function | JSON.stringify comparison | Gate entries are small objects; string comparison is sufficient and deterministic |
| Step position tracking | Custom state.yml field | Existing checkpoint.yml | checkpoint.yml already has skill/step/label/substep -- current_step in state.yml is pure redundancy |

## Common Pitfalls

### Pitfall 1: Status Skill Phase Ordering Incomplete
**What goes wrong:** Adding spike phases to descriptions and routing but forgetting to add them to the phase ordering in Step 5
**Why it happens:** The ordering is in a less obvious location (inline comment in artifact cross-reference logic)
**How to avoid:** Update ALL THREE parallel structures for each added phase
**Warning signs:** Artifact cross-reference failing for spike_complete (expecting plan/PLAN.md artifacts)

### Pitfall 2: Research Step Renumbering Breaks Checkpoint References
**What goes wrong:** Renumbering steps but leaving stale step references in the skill text (e.g., "return to Step 12" when Step 12 is now Step 10)
**Why it happens:** Steps reference each other by number for loops and branching
**How to avoid:** After renumbering, search for ALL "Step N" references in the file and update them
**Warning signs:** Skill instructions that say "return to Step 12" but Step 12 doesn't exist

### Pitfall 3: current_step Removal is Cross-Cutting
**What goes wrong:** Removing current_step writes from one skill but not others
**Why it happens:** The boilerplate is identical in all 6 skills -- easy to miss one
**How to avoid:** List all 6 skills and verify each one is updated
**Warning signs:** Hook still receiving current_step in state.yml writes from unchanged skills

### Pitfall 4: Gates.yml Immutability Check Edge Cases
**What goes wrong:** The JSON.stringify comparison fails on semantically equivalent but differently formatted entries
**Why it happens:** YAML dump may produce different whitespace/ordering than original
**How to avoid:** Compare parsed objects, not raw strings. Both the existing on-disk content and the proposed content are parsed through yaml.load, so the comparison should be on the parsed JavaScript objects.
**Warning signs:** False positives blocking valid gate writes

### Pitfall 5: Status Skill Frontmatter Change for AUD-014
**What goes wrong:** Adding questions.yml injection to status frontmatter but using wrong syntax
**Why it happens:** Status skill currently does not inject questions.yml
**How to avoid:** Follow the pattern used by scope and research skills: `!cat .expedite/questions.yml 2>/dev/null || echo "No questions"`
**Warning signs:** Status skill showing `research_round: null` after fix

## Code Examples

### AUD-008 Fix: Add last_modified to state.yml schema

Current schema:
```javascript
fields: {
  version: { type: 'number' },
  lifecycle_id: { type: 'string', nullable: true },
  project_name: { type: 'string', nullable: true },
  intent: { type: 'string', nullable: true, enum: ['product', 'engineering'] },
  description: { type: 'string', nullable: true },
  phase: { type: 'string', enum: VALID_PHASES },
  started_at: { type: 'string', nullable: true },
  phase_started_at: { type: 'string', nullable: true },
}
```

Add:
```javascript
last_modified: { type: 'string', nullable: true },
```

### AUD-009 Fix: Status skill phase additions

Add to Step 6 descriptions:
```markdown
- `spike_in_progress` -> "Spike: resolving tactical decisions"
- `spike_complete` -> "Spike: complete, ready for execution"
- `execute_complete` -> "Execute: tasks complete, finalizing"
```

Add to Step 7 routing:
```markdown
- `spike_in_progress` -> "Continue with `/expedite:spike`"
- `spike_complete` -> "Run `/expedite:execute` to begin implementation"
- `execute_complete` -> "Lifecycle completing..."
```

Add to Step 5 phase ordering:
```
... plan_complete < spike_in_progress < spike_complete < execute_in_progress < execute_complete < complete
```

### AUD-013 Fix: HOOK-03 escalation message

Current (line 204):
```javascript
'Consider manual intervention: edit .expedite/state.yml directly, ' +
```

Fixed:
```javascript
'Consider manual intervention: edit .expedite/checkpoint.yml directly, ' +
```

### AUD-017 Fix: Gates.yml immutability enforcement

Insert after existingCount calculation (after line 236):
```javascript
// Verify existing entries are unchanged (immutability enforcement)
for (var ei = 0; ei < existingCount; ei++) {
  if (JSON.stringify(currentGates.history[ei]) !== JSON.stringify(parsed.history[ei])) {
    deny('Gate write blocked: existing history entry at index ' + ei +
      ' was modified. Gate history is append-only and immutable.' +
      ' To fix gate history, use the recovery procedure in ref-state-recovery.md.');
    return;
  }
}
```

### AUD-021 Fix: Schema denial recovery instructions

Current (line 94):
```javascript
deny('State validation failed: ' + result.errors.join('; '));
```

Fixed:
```javascript
deny('State validation failed: ' + result.errors.join('; ') +
  '. Fix the data to match the schema and retry the write.' +
  ' To bypass enforcement entirely, set EXPEDITE_HOOKS_DISABLED=true.');
```

## File Impact Summary

| File | Bug IDs | Change Type | Risk |
|------|---------|-------------|------|
| `skills/status/SKILL.md` | AUD-009, AUD-014, AUD-015 | Add phases, inject questions.yml, update step totals | Low |
| `skills/research/SKILL.md` | AUD-011, AUD-014, AUD-015, AUD-016, AUD-019 | Fix backup path, redirect research_round, renumber steps, add backup, enumerate dispatch | Medium (renumbering) |
| `skills/execute/SKILL.md` | AUD-016, AUD-018 | Add backup-before-write, enumerate dispatch | Low |
| `hooks/lib/schemas/state.js` | AUD-008 | Add last_modified field | Low |
| `hooks/validate-state-write.js` | AUD-013, AUD-017, AUD-021 | Fix message, add immutability check, add recovery text | Medium (new enforcement logic) |
| `hooks/audit-state-change.js` | AUD-012 | Fix override detection regex | Low |
| `gates/g4-plan.js` | AUD-010 | Case-insensitive DA matching | Low |
| `hooks/lib/session-summary.js` | AUD-015 | Update SKILL_STEP_TOTALS for research | Low |
| `agents/sufficiency-evaluator.md` | AUD-020 | Remove memory: project | Low |
| `skills/scope/SKILL.md` | AUD-008 | Remove current_step from step tracking (if doing cross-cutting removal) | Low |
| `skills/design/SKILL.md` | AUD-008 | Remove current_step from step tracking | Low |
| `skills/plan/SKILL.md` | AUD-008 | Remove current_step from step tracking | Low |
| `skills/spike/SKILL.md` | AUD-008 | Remove current_step from step tracking | Low |

**Total files modified:** ~13 (if doing current_step removal across all skills)
**JavaScript changes:** 5 files (state.js, validate-state-write.js, audit-state-change.js, g4-plan.js, session-summary.js)
**Skill instruction changes:** 6-7 files (status, research, execute, scope, design, plan, spike)
**Agent definition changes:** 1 file (sufficiency-evaluator.md)

## Dependency Analysis

### Internal Dependencies

1. **AUD-008 + AUD-014:** Both relate to state.yml field management. AUD-014 (move research_round to questions.yml) reduces the fields that AUD-008 needs to add to the schema. Do AUD-014 first to know the final field list.

2. **AUD-008 current_step removal:** Affects all 6 skill SKILL.md files and the status skill. Must be done consistently across all files.

3. **AUD-014 + AUD-009:** AUD-014 adds questions.yml injection to status skill. AUD-009 adds phase mappings. Both modify status SKILL.md. Should be in the same task.

4. **AUD-015 renumbering:** Renumbering research steps requires updating ALL step cross-references within research SKILL.md, plus the step total in status SKILL.md and session-summary.js.

### Recommended Grouping

**Task 1: Skill instruction fixes** (AUD-008, AUD-009, AUD-011, AUD-014, AUD-015, AUD-016, AUD-018, AUD-019, AUD-020)
- All SKILL.md edits and the agent definition fix
- Largest task (most files) but each individual change is small
- AUD-008 (current_step removal) is the cross-cutting part

**Task 2: JavaScript hook/gate fixes** (AUD-010, AUD-012, AUD-013, AUD-017, AUD-021)
- All JavaScript code changes
- Each is a small, surgical edit
- AUD-017 (immutability) is the most complex individual fix

**Task 3: Verification**
- Run `node -c` syntax checks on all modified JS files
- Verify research step numbering is contiguous
- Verify status skill has all 14 phases (not 11)
- Verify current_step removed from all 6 skills' step tracking boilerplate

## Open Questions

1. **AUD-008: Remove current_step or add to schema?**
   - What we know: current_step is redundant with checkpoint.yml. The audit recommends removing it.
   - Risk of removal: All 6 skills have identical step tracking boilerplate that writes it. Status skill reads it.
   - Risk of keeping: One more unvalidated field, unnecessary state.yml writes.
   - **Recommendation:** Remove it. Checkpoint.yml already has the same data. Status skill should read from checkpoint.yml instead (which it already injects). No real-world checkpoints exist yet, so backward compatibility is not a concern.

2. **AUD-015: Supersede backward compatibility decision?**
   - What we know: STATE.md decision [31-01] preserved research step numbers for backward compatibility.
   - Current reality: The plugin has never been used in a real lifecycle. No checkpoints exist that reference old step numbers.
   - **Recommendation:** Supersede the decision. Renumber steps contiguously. Note the decision override in the plan.

3. **AUD-012: Regex vs YAML parsing for override detection?**
   - What we know: The audit hook is non-blocking (always exit 0). It only affects audit trail accuracy.
   - Regex is simpler but imperfect (could false-match on quoted strings inside other fields).
   - YAML parsing is robust but adds complexity to a hook that should be fast.
   - **Recommendation:** Use regex. The audit hook is non-critical and the regex pattern `/outcome:\s*['"]?overridden['"]?/` is specific enough. The yaml module is already loaded in the override detection branch (line 70), so parsing would be feasible too, but regex is sufficient.

## Sources

### Primary (HIGH confidence)
- `hooks/lib/schemas/state.js` -- schema fields verified (lines 23-35)
- `skills/status/SKILL.md` -- phase mappings verified (Steps 5-7, lines 86-121)
- `gates/g4-plan.js` -- case-sensitive indexOf verified (line 166)
- `skills/research/SKILL.md` -- backup path verified (line 42), step numbering verified (all headings), research_round writes verified (lines 67, 185)
- `hooks/audit-state-change.js` -- override detection verified (line 63)
- `hooks/validate-state-write.js` -- HOOK-03 escalation message verified (lines 203-205), HOOK-04 immutability gap verified (lines 227-261), schema denial message verified (lines 93-95)
- `templates/questions.yml.template` -- research_round defined here (line 5)
- `skills/execute/SKILL.md` -- backup-before-write presence verified (Steps 5d, 6, 7), agent dispatch text verified (Step 5b)
- `agents/sufficiency-evaluator.md` -- memory: project verified (line 15)
- `agents/task-implementer.md` -- placeholder variables verified (context/self_contained_reads/input_data sections)
- `agents/web-researcher.md` -- placeholder variables verified (context/output_format sections)
- `agents/codebase-researcher.md` -- placeholder variables verified (context/output_format sections)
- `hooks/lib/session-summary.js` -- SKILL_STEP_TOTALS verified (line 11), NEXT_SKILL verified (lines 14-21)
- `hooks/lib/validate.js` -- validation engine behavior verified (only checks schema-declared fields)
- `gates/g1-scope.js` -- confirmed Phase 38 fix already applied (reads from questions.yml)

### Secondary (MEDIUM confidence)
- `.planning/research/expedite-final-audit/research-synthesis.md` -- audit findings used as starting hypotheses, all validated against current source code

## Metadata

**Confidence breakdown:**
- Bug validation: HIGH -- every bug verified by reading exact source files post-Phase 38
- Fix approach: HIGH -- fixes follow established patterns from Phase 38
- Dependency analysis: HIGH -- cross-cutting changes (current_step removal) clearly identified
- Step renumbering: HIGH -- step headings and cross-references enumerated

**Research date:** 2026-03-17
**Valid until:** Indefinite (fixes are to stable, versioned source files)
