# Phase 13: Tech Debt Resolution - Research

**Researched:** 2026-03-08
**Domain:** SKILL.md instruction editing (Markdown), state machine resume logic, path resolution patterns
**Confidence:** HIGH

## Summary

Phase 13 addresses three tech debt items identified in the v1.0 milestone audit. All three are localized edits to existing SKILL.md files and inline reference files -- no new files, no new libraries, no architectural changes. The changes are well-constrained because the correct patterns already exist elsewhere in the codebase and need to be replicated.

**TD-1 (Mid-phase crash resume):** Research, design, and plan skills reject `*_in_progress` re-invocation, telling the user to run the previous skill. Scope and execute already handle resume correctly. The fix is adding a resume case to each skill's Step 1 that detects `*_in_progress` state and determines which step to resume from. **TD-2 (Dead status mappings):** Status SKILL.md maps 6 `*_recycled` phases that are never written to state.yml. Phase 12 intentionally retained these as "documentation value" but the Phase 13 roadmap explicitly calls for their removal. **TD-3 (Glob fallback):** Three research inline reference files are read with direct paths only, while all 10 prompt templates use the `(use Glob with ... if the direct path fails)` parenthetical pattern.

**Primary recommendation:** Structure as 3 small plans -- one per tech debt item. TD-1 is the most complex (3 SKILL.md files, each needing resume logic). TD-2 and TD-3 are trivial (line removals and parenthetical additions).

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| STATE-06 | Crash recovery is unambiguous from phase name alone (sub-state determines resume point) | TD-1 fix: research/design/plan skills will resume at correct step when re-invoked during `*_in_progress`, matching scope/execute behavior |
</phase_requirements>

## Standard Stack

No new libraries or tools. This phase modifies existing Markdown instruction files only.

### Core
| File Type | Purpose | Tool |
|-----------|---------|------|
| SKILL.md | Skill orchestration instructions (Markdown) | Write/Edit |
| ref-*.md | Inline reference files (Markdown) | Write/Edit |

### Established Patterns (to replicate)
| Pattern | Source of Truth | Replicate To |
|---------|-----------------|-------------|
| Resume from `*_in_progress` | `skills/scope/SKILL.md` Step 1 Case B | `skills/research/SKILL.md`, `skills/design/SKILL.md`, `skills/plan/SKILL.md` |
| Resume from `execute_in_progress` | `skills/execute/SKILL.md` Step 1 Case B | (reference only -- different pattern, checkpoint-based) |
| Glob fallback parenthetical | All `prompt-*` references in SKILL.md files | 3 `ref-*` references in `skills/research/SKILL.md` |

## Architecture Patterns

### TD-1: Mid-Phase Crash Resume Logic

**The problem:** When a user's session crashes or they exit mid-skill (during `research_in_progress`, `design_in_progress`, or `plan_in_progress`), re-invoking the same skill hits the error case because Step 1 only accepts the prior phase as a valid entry point. For example, research Step 1 Case A rejects anything that isn't `scope_complete`, so `research_in_progress` triggers the error message "Run `/expedite:scope`" -- which is misleading.

**The scope resume pattern (model to follow):**
Scope SKILL.md Step 1 Case B handles `scope_in_progress` by:
1. Detecting the in-progress state
2. Inspecting what data exists (project_name, intent, questions)
3. Determining which step to resume from based on progress indicators
4. Asking the user whether to continue or start over

**The execute resume pattern (reference):**
Execute SKILL.md Step 1 Case B handles `execute_in_progress` by:
1. Detecting the in-progress state
2. Checking for checkpoint.yml to find position
3. Resuming from that position

**Research skill resume logic (new Case B for `research_in_progress`):**
Research has 18 steps. The key resume indicators in state.yml:
- `research_round`: If 0, crashed before Step 3 (state initialization). If >= 1, Step 3 completed.
- Evidence files exist in `.expedite/research/`: If evidence files exist, Steps 8-10 partially completed.
- `.expedite/research/sufficiency-results.yml` exists: Step 12 completed.
- `.expedite/research/SYNTHESIS.md` exists: Step 17 completed.
- Question `status` values in state.yml: `pending` = not yet researched, `covered`/`partial`/`not_covered` = evidence collected.

Resume decision tree for research:
- `research_round == 0`: Crashed before Step 3 initialized state. Resume at Step 2 (read scope artifacts) and continue normally.
- `research_round >= 1` AND no evidence files: Crashed during Steps 4-9 (batching/dispatch). Resume at Step 4 (re-form batches).
- `research_round >= 1` AND evidence files exist AND no `sufficiency-results.yml`: Crashed during Steps 10-11 (collection) or before Step 12 (assessment). Resume at Step 12 (re-assess with available evidence).
- `research_round >= 1` AND `sufficiency-results.yml` exists AND no `SYNTHESIS.md`: Crashed during Steps 13-17 (gate/synthesis). Resume at Step 14 (re-run gate).
- `research_round >= 1` AND `SYNTHESIS.md` exists: Crashed during Step 18 (completion). Resume at Step 18 (finalize state).

**Design skill resume logic (new Case for `design_in_progress`):**
Design has 10 steps. Resume indicators:
- `.expedite/design/DESIGN.md` exists: Step 5 completed. Resume at Step 7 (revision cycle).
- No DESIGN.md: Resume at Step 2 (read artifacts, then generate).
- Note: Must also handle the existing Case B (override re-entry), which already checks for `design_in_progress`. The new resume case should be a separate condition or merged carefully.

**CRITICAL DESIGN CONSIDERATION for design/plan:** Both design and plan skills already have a Case B that handles `*_in_progress + --override + gate_history recycle evidence`. The new crash resume case is DIFFERENT -- it handles `*_in_progress` WITHOUT `--override` (genuine crash resume, not override re-entry). The existing Case B must remain intact. The new resume case should be added as a new condition that checks `*_in_progress` WITHOUT `--override`.

Recommended Case structure after the fix:
- Case A: Expected prior phase (normal entry) -- unchanged
- Case B: `*_in_progress` + `--override` + gate_history recycle (override re-entry) -- unchanged
- Case B2 (NEW): `*_in_progress` WITHOUT `--override` (crash resume)
- Case C: Everything else (error) -- updated to exclude B2

**Plan skill resume logic (new Case for `plan_in_progress`):**
Plan has 9 steps. Resume indicators:
- `.expedite/plan/PLAN.md` exists: Step 5 completed. Resume at Step 6 (revision cycle).
- No PLAN.md: Resume at Step 2 (read artifacts, then generate).
- Same Case B / B2 concern as design.

### TD-2: Remove Dead `*_recycled` Status Mappings

**Current state:** Status SKILL.md contains 6 entries (3 display mappings + 3 action mappings) for `research_recycled`, `design_recycled`, `plan_recycled`. These phases are never written to state.yml by any skill. Phase 12 decision 12-01 explicitly states "Status SKILL.md *_recycled mappings retained unchanged for documentation value."

**Phase 13 roadmap explicitly overrides this:** Success criterion 2 states "Status SKILL.md no longer maps `*_recycled` phases that are never written to state.yml." The 6 lines (status SKILL.md lines 44, 47, 50, 60, 63, 66) must be removed.

**Impact:** Zero functional impact. These lines can never be triggered since no skill writes these phase values.

### TD-3: Glob Fallback Parenthetical for Research Inline References

**Current state:** Research SKILL.md references 3 inline reference files with direct paths only:
- Line 621: `Read skills/research/references/ref-recycle-escalation.md`
- Line 626: `Read skills/research/references/ref-override-handling.md`
- Line 650: `Read skills/research/references/ref-gapfill-dispatch.md`

**Established pattern (from same file and other SKILL.md files):**
```
Read `skills/research/references/prompt-web-researcher.md`
  (use Glob with `**/prompt-web-researcher.md` if the direct path fails)
```

**Fix:** Add the Glob fallback parenthetical to each of the 3 references:
- `(use Glob with **/ref-recycle-escalation.md if the direct path fails)`
- `(use Glob with **/ref-override-handling.md if the direct path fails)`
- `(use Glob with **/ref-gapfill-dispatch.md if the direct path fails)`

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Resume step detection | Custom state tracking fields | Artifact existence checks on disk | state.yml already has research_round + question statuses; artifact files provide additional progress signals without adding schema fields |
| New phase states | Adding `*_resuming` or `*_recovering` states | Reuse existing `*_in_progress` state | STATE-05 requires forward-only transitions; resume is not a new state, it is re-entry into the same state |

## Common Pitfalls

### Pitfall 1: Breaking the Existing Override Re-entry (Case B)
**What goes wrong:** When adding crash resume logic for `*_in_progress`, the implementer accidentally merges it with or replaces the existing Case B (override re-entry with `--override` flag).
**Why it happens:** Both cases trigger on the same `*_in_progress` phase value.
**How to avoid:** Make the `--override` flag the discriminator. Case B (existing): `*_in_progress` + `--override` present + gate_history recycle evidence. New case: `*_in_progress` + `--override` NOT present. Test both paths in verification.
**Warning signs:** `--override` flag no longer mentioned in the case conditions.

### Pitfall 2: Research Resume is More Complex Than Design/Plan
**What goes wrong:** Applying the same simple resume logic (check for artifact existence) to research as to design/plan.
**Why it happens:** Design and plan have a single primary artifact (DESIGN.md / PLAN.md) that clearly marks progress. Research has 18 steps with multiple intermediate artifacts and a multi-round structure.
**How to avoid:** Research resume needs a decision tree based on multiple indicators (research_round, evidence files, sufficiency-results.yml, SYNTHESIS.md). Design/plan can use simpler artifact-exists checks.
**Warning signs:** Research resume always restarts from Step 2 regardless of progress.

### Pitfall 3: State Transition Already Happened
**What goes wrong:** Resume logic attempts to transition state to `*_in_progress` (Step 3 in each skill), but the state is ALREADY `*_in_progress` (that is why we are resuming).
**How to avoid:** Resume case must SKIP the state transition step (Step 3 in research/design/plan). The state is already correct. Only need to read artifacts and determine resume point.
**Warning signs:** Backup-before-write overwrites state.yml with no actual change, or worse, resets fields like `research_round`.

### Pitfall 4: Phase 12 Decision Conflict on Status Mappings
**What goes wrong:** Implementer reads the Phase 12 decision ("retained unchanged for documentation value") and hesitates to remove the mappings.
**Why it happens:** There is a real conflict between Phase 12 decision (retain) and Phase 13 requirement (remove).
**How to avoid:** Phase 13 roadmap success criterion 2 is explicit: "Status SKILL.md no longer maps `*_recycled` phases." The roadmap takes precedence over Phase 12's decision -- this is exactly what tech debt resolution means.

## Code Examples

### Pattern: Scope Resume (Case B) -- Model to Follow

From `skills/scope/SKILL.md` Step 1 (lines 38-66):

```markdown
**Case B: Active lifecycle with `phase: "scope_in_progress"` AND `project_name` is set (not null)**
This is a resume scenario. Display:

```
Found an in-progress scope for "{project_name}" ({intent} intent).

Context collected so far:
- Project: {project_name}
- Intent: {intent}
- Description: {description if available}
- Questions defined: {count of questions array}

Continue from where you left off?
```

Use AskUserQuestion:
- Continue: Skip to the step that corresponds to the current progress.
  If questions exist, skip to Step 6.
  If intent and description are set but no questions, skip to Step 5.
  If only project_name is set, skip to Step 4.
- Start over: Execute the archival flow below, then proceed to Step 3.
```

### Pattern: Glob Fallback Parenthetical

From `skills/research/SKILL.md` (existing prompt template references):

```markdown
Read `skills/research/references/prompt-web-researcher.md`
  (use Glob with `**/prompt-web-researcher.md` if the direct path fails)
```

Apply same pattern to ref-* files:

```markdown
Read `skills/research/references/ref-recycle-escalation.md` (use Glob with `**/ref-recycle-escalation.md` if the direct path fails)
```

### Pattern: Execute Resume (Case B) -- Reference for Checkpoint-Based Resume

From `skills/execute/SKILL.md` Step 1 (lines 43-51):

```markdown
**Case B: Phase is "execute_in_progress"**

This is a resume scenario.

1. Parse the phase argument first (same logic as Step 2's argument parsing).
2. Determine the slug for the requested phase.
3. Check for `.expedite/plan/phases/{slug}/checkpoint.yml`
4. If checkpoint exists AND status is "paused" or "in_progress":
   display "Resuming execution..." Proceed to Step 2, skip Step 3, go to Step 4.
5. If no checkpoint: display "Starting execution..." Proceed to Step 2.
```

## State of the Art

| Old Approach (Phase 12) | Current Approach (Phase 13) | When Changed | Impact |
|--------------------------|---------------------------|--------------|--------|
| Status SKILL.md retains *_recycled for documentation | Remove *_recycled mappings entirely | Phase 13 | Cleaner status display, no dead code |
| Research/design/plan reject *_in_progress re-invocation | Handle *_in_progress as resume | Phase 13 | Crash recovery works for all 6 skills |

## Open Questions

1. **Should research resume offer "start over" like scope does?**
   - What we know: Scope offers Continue/Start Over via AskUserQuestion. Execute does not offer "start over" -- it just resumes.
   - What's unclear: Which pattern is better for research/design/plan.
   - Recommendation: Offer Continue/Start Over for research (complex multi-step, user may want to restart). For design/plan (simpler, artifact-centric), just resume without asking -- consistent with execute.

2. **Should the resume logic use AskUserQuestion or freeform prompt?**
   - What we know: Research uses AskUserQuestion for structured choices and freeform for open-ended. Design/plan use freeform for everything except override approval.
   - Recommendation: Use AskUserQuestion for resume (it is a structured binary choice: continue/start over), matching scope's pattern.

3. **Plan count for this phase**
   - What we know: 3 distinct tech debt items, varying complexity.
   - Recommendation: 2 plans. Plan 1: TD-1 (crash resume for research/design/plan -- largest, touches 3 files). Plan 2: TD-2 + TD-3 (status mapping removal + Glob fallback -- both trivial, touch 2 files total).

## Exact File Change Map

### TD-1: Mid-Phase Crash Resume (3 files)

| File | Current Behavior | Required Change |
|------|-----------------|-----------------|
| `skills/research/SKILL.md` Step 1 | Case A rejects all non-`scope_complete` | Add resume case for `research_in_progress` with decision tree |
| `skills/design/SKILL.md` Step 1 | Case B handles override only; Case C rejects `design_in_progress` without `--override` | Add resume case for `design_in_progress` without `--override` |
| `skills/plan/SKILL.md` Step 1 | Case B handles override only; Case C rejects `plan_in_progress` without `--override` | Add resume case for `plan_in_progress` without `--override` |

### TD-2: Remove Dead Status Mappings (1 file)

| File | Lines | Change |
|------|-------|--------|
| `skills/status/SKILL.md` | 44, 47, 50 | Remove 3 `*_recycled` display mapping lines |
| `skills/status/SKILL.md` | 60, 63, 66 | Remove 3 `*_recycled` action mapping lines |

### TD-3: Glob Fallback (1 file)

| File | Lines | Change |
|------|-------|--------|
| `skills/research/SKILL.md` | 621 | Add `(use Glob with **/ref-recycle-escalation.md if the direct path fails)` |
| `skills/research/SKILL.md` | 626 | Add `(use Glob with **/ref-override-handling.md if the direct path fails)` |
| `skills/research/SKILL.md` | 650 | Add `(use Glob with **/ref-gapfill-dispatch.md if the direct path fails)` |

## Sources

### Primary (HIGH confidence)
- `skills/scope/SKILL.md` Step 1 -- resume pattern (Case B) for scope_in_progress
- `skills/execute/SKILL.md` Step 1 -- resume pattern (Case B) for execute_in_progress
- `skills/research/SKILL.md` -- current Step 1 logic, all 18 steps, artifact paths
- `skills/design/SKILL.md` -- current Step 1 logic (Cases A/B/C), all 10 steps
- `skills/plan/SKILL.md` -- current Step 1 logic (Cases A/B/C), all 9 steps
- `skills/status/SKILL.md` -- current *_recycled mappings (lines 44, 47, 50, 60, 63, 66)
- `.planning/v1.0-MILESTONE-AUDIT.md` -- tech debt items TD-1, TD-2, TD-3
- `.planning/ROADMAP.md` Phase 13 -- success criteria
- `.planning/phases/12-audit-tech-debt-cleanup/12-01-PLAN.md` -- Phase 12 decisions on *_recycled handling

## Metadata

**Confidence breakdown:**
- TD-1 (crash resume): HIGH -- both correct patterns (scope, execute) are in the codebase; research/design/plan SKILL.md files fully analyzed for resume indicators
- TD-2 (status mappings): HIGH -- exact lines identified, zero functional impact
- TD-3 (Glob fallback): HIGH -- exact pattern exists 10 times in codebase, 3 instances need it added

**Research date:** 2026-03-08
**Valid until:** Indefinite (internal codebase patterns, no external dependencies)
