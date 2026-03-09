# Phase 12: Audit Tech Debt Cleanup - Research

**Researched:** 2026-03-08
**Domain:** Plugin skill code cleanup (state management, gate wiring, template hygiene, documentation)
**Confidence:** HIGH

## Summary

Phase 12 addresses 3 integration findings (INT-04, INT-05, INT-06) and 1 documentation tech debt item (FLOW-03 shares root cause with INT-04) identified in the v1.0 milestone audit. All findings are non-blocking -- the plugin is fully functional -- but they represent dead code paths, incomplete status display, and cosmetic inconsistencies that should be cleaned up before v1.0 ships.

The research investigated the exact source files, the specific code patterns involved, and the two possible fix strategies for each finding. All findings are straightforward code edits in existing SKILL.md files and reference templates. No new libraries, no architectural changes, no new files needed.

**Key discovery:** Success Criterion 4 (TELE checkbox update) is already complete -- commit 81fc0b5 updated TELE-01..05 from `[ ]` to `[x]` and corrected the coverage count. The planner should verify this is still true at plan time and skip if so.

**Primary recommendation:** Fix INT-04 using the "adjust Case B checks" approach (accept `*_in_progress` + `--override` flag + gate_history evidence) rather than writing `*_recycled` to state.yml. This avoids adding a new state transition and keeps the existing gate-loops-internally pattern intact.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| STATE-01 | state.yml persists lifecycle state with max 2 nesting levels | INT-04 fix: either remove dead `*_recycled` states from template or make them reachable. Research recommends adjusting Case B checks instead of adding new state writes. |
| GATE-04 | Recycle escalation: 1st informational, 2nd suggest, 3rd recommend override | INT-04 fix: override re-entry path must work cross-session. Currently unreachable because `*_recycled` is never written. |
| GATE-01 | Every phase transition guarded by inline gate evaluated in the producing skill | INT-05 fix: G5 gate outcome must be recorded in state.yml gate_history so status skill can display it. |
| TMPL-01 | All prompt templates follow 8-section XML structure | INT-06 fix: 4 inline reference templates have `{{placeholder}}` syntax that is never filled. Remove or convert to plain descriptions. |
| TELE-01 | log.yml in `.expedite/` directory, gitignored | Already complete (checkbox updated in commit 81fc0b5). Verify at plan time. |
| TELE-02 | Append-only via `cat >>` Bash command | Already complete (checkbox updated in commit 81fc0b5). Verify at plan time. |
| TELE-03 | Multi-document YAML format (one document per event) | Already complete (checkbox updated in commit 81fc0b5). Verify at plan time. |
| TELE-04 | Tracks phase transitions, gate outcomes, agent completions, source failures, overrides | Already complete (checkbox updated in commit 81fc0b5). Verify at plan time. |
| TELE-05 | log.yml persists across lifecycles (not archived) | Already complete (checkbox updated in commit 81fc0b5). Verify at plan time. |
</phase_requirements>

## Standard Stack

No new libraries or tools needed. This phase modifies existing Markdown skill files only.

### Core Files to Modify

| File | Purpose | Finding |
|------|---------|---------|
| `skills/design/SKILL.md` | Design skill orchestrator | INT-04: Case B checks `research_recycled` which is never written |
| `skills/plan/SKILL.md` | Plan skill orchestrator | INT-04: Case B checks `design_recycled` which is never written |
| `skills/spike/SKILL.md` | Spike skill orchestrator | INT-05: Step 7 logs G5 to log.yml but not to gate_history in state.yml |
| `skills/status/SKILL.md` | Status display | INT-04: Maps `*_recycled` phases but they are never reached |
| `skills/execute/SKILL.md` | Execute skill orchestrator | INT-04: Case C mentions `plan_recycled` |
| `templates/state.yml.template` | State schema documentation | INT-04: Documents `*_recycled` transitions that are dead code |
| `skills/scope/references/prompt-scope-questioning.md` | Inline scope questioning guide | INT-06: Contains `{{project_name}}`, `{{intent}}`, `{{user_context}}` placeholders |
| `skills/design/references/prompt-design-guide.md` | Inline design generation guide | INT-06: Contains 12 `{{placeholder}}` instances |
| `skills/plan/references/prompt-plan-guide.md` | Inline plan generation guide | INT-06: Contains 10 `{{placeholder}}` instances |
| `skills/execute/references/prompt-task-verifier.md` | Inline task verification guide | INT-06: Contains 8 `{{placeholder}}` instances |
| `.planning/REQUIREMENTS.md` | Requirements traceability | TELE checkbox update (already done in commit 81fc0b5) |

## Architecture Patterns

### Pattern 1: Override Re-Entry Fix (INT-04 + FLOW-03)

**What:** The `*_recycled` phase values (`research_recycled`, `design_recycled`, `plan_recycled`) are documented in state.yml.template as valid transitions but never written by any skill. Gates loop internally during recycle, and override proceeds to `*_complete`. This means cross-session override re-entry is dead code.

**Current behavior (within session):**
1. Gate evaluates -> Recycle outcome
2. User loops back to revision step within the same skill invocation
3. After multiple recycles, user can choose Override
4. Override proceeds to `*_complete` state
5. Session ends normally

**Broken behavior (cross-session):**
1. Gate evaluates -> Recycle outcome
2. User exits/crashes mid-recycle (session lost)
3. State.yml still shows `*_in_progress` (because `*_recycled` was never written)
4. User re-enters next session, skill sees `*_in_progress`
5. Design/Plan skills reject this in Case C (it is not `*_complete` and not `*_recycled`)
6. The user is stuck -- cannot proceed without manually editing state.yml

**Recommended fix (Option B from audit):** Adjust Case B checks in design and plan SKILL.md to accept `*_in_progress` + `--override` flag + gate_history evidence. This is cleaner than writing `*_recycled` because:
- No new state transitions needed (avoids STATE-01 complexity)
- The gate_history already contains recycle evidence
- The override-context.md file is already written during override handling
- Keeps the existing "gates loop internally" pattern intact

**Specific changes needed:**

1. **Design SKILL.md Step 1, Case B:** Change from checking `research_recycled` to checking `research_in_progress` + `--override` flag + gate_history contains a G2 recycle entry.

2. **Plan SKILL.md Step 1, Case B:** Change from checking `design_recycled` to checking `design_in_progress` + `--override` flag + gate_history contains a G3 recycle entry.

3. **Status SKILL.md:** Keep `*_recycled` in the phase mapping table -- these are still valid display values even if they are not currently written. Alternatively, remove them and simplify. Decision: keep them as documentation of the conceptual state but note they are not written to state.yml.

4. **state.yml.template:** Update transition diagram comments. Either remove `*_recycled` entries or annotate as "conceptual only -- not written to state.yml, cross-session override handled via gate_history evidence."

5. **Execute SKILL.md Case C:** The `plan_recycled` mention is an error message hint, not a check. It tells the user what to do if they see `plan_recycled`. Since `plan_recycled` is never written, this code path is unreachable, but the message is correct advice. Remove or note as dead code.

### Pattern 2: G5 Gate History Recording (INT-05)

**What:** Spike Step 7 logs G5 outcome to log.yml (telemetry) but does not append to `gate_history` in state.yml. The status skill's gate history table will never show G5.

**Why it was omitted:** The spike skill explicitly states "Do NOT update state.yml" because spike is optional and does not own lifecycle state. This was a deliberate architectural choice, not an oversight.

**Recommended fix:** Add a gate_history append to spike Step 7 after the log.yml write. The spike note about not updating state.yml was about phase transitions (e.g., not setting a `spike_complete` phase). Adding a gate_history entry is different -- it records an event, not a phase transition. Gate entries are appended by G1-G4 in their respective skills, so G5 should follow the same pattern.

**Specific change:** In spike SKILL.md Step 7, after the `cat >> .expedite/log.yml` block, add a gate_history append instruction:

```markdown
**Record gate history in state.yml** (backup-before-write):

Append to `gate_history` in state.yml:
```yaml
- gate: "G5"
  timestamp: "{ISO 8601 UTC}"
  outcome: "{go|go_advisory|recycle|override}"
  must_passed: {count}
  must_failed: {count}
  should_passed: {count}
  should_failed: {count}
  notes: "Spike phase: {slug}"
  overridden: false
```

**Also update the Step 9 NOTE** at the bottom of spike SKILL.md: Clarify that spike does not write **phase transitions** to state.yml (no `spike_complete` phase), but it DOES write gate_history entries since G5 is part of the gate chain.

### Pattern 3: Inline Template Placeholder Cleanup (INT-06)

**What:** 4 inline reference templates contain `{{placeholder}}` syntax. These templates are read as quality guides, not dispatched as subagents. The placeholders are never replaced because no code path fills them.

**Template-by-template analysis:**

1. **prompt-scope-questioning.md** (3 placeholders):
   - `{{project_name}}` in `<context>` section line 6
   - `{{intent}}` in `<context>` section line 7
   - `{{user_context}}` in `<input_data>` section line 156
   - These describe what the scope SKILL.md "would" inject if this were dispatched. Since it is read as a guide, convert to plain descriptions.

2. **prompt-design-guide.md** (12 placeholders):
   - `{{project_name}}`, `{{intent}}`, `{{scope_file}}`, `{{synthesis_file}}`, `{{decision_areas_yaml}}` in `<context>` section
   - `{{design_output_file}}`, `{{handoff_output_file}}`, `{{project_name}}`, `{{timestamp}}` in `<output_format>` section
   - `{{scope_content}}`, `{{synthesis_content}}` in `<input_data>` section
   - Design SKILL.md Step 4 reads this as a "quality reference" -- it explicitly says "NOT dispatched as a subagent."

3. **prompt-plan-guide.md** (10 placeholders):
   - `{{project_name}}`, `{{intent}}`, `{{design_file}}`, `{{scope_file}}`, `{{decision_areas_yaml}}` in `<context>` section
   - `{{plan_output_file}}`, `{{project_name}}`, `{{timestamp}}` in `<output_format>` section
   - `{{design_content}}`, `{{scope_content}}` in `<input_data>` section
   - Plan SKILL.md Step 4 reads this as a "quality reference" -- same pattern as design.

4. **prompt-task-verifier.md** (8 placeholders):
   - `{{project_name}}`, `{{intent}}`, `{{design_file}}`, `{{plan_file}}`, `{{current_task_yaml}}` in `<context>` section
   - `{{task_id}}`, `{{task_title}}` in `<output_format>` section
   - `{{task_details}}`, `{{code_changes}}` in `<input_data>` section
   - Execute SKILL.md reads this inline for verification guidance.

**Recommended fix:** Convert `<context>`, `<input_data>`, and `<output_format>` sections to use plain descriptive text instead of template placeholders. For example:
- `{{project_name}}` -> `[project name from state.yml]` or `{the current project name}`
- `{{scope_content}}` -> `[loaded by the parent skill at invocation time]`
- `{{timestamp}}` -> `[current ISO 8601 UTC timestamp]`

The `<role>`, `<downstream_consumer>`, `<instructions>`, and `<quality_gate>` sections have no placeholders and need no changes.

**Alternative approach:** Since these templates are inline guides, the `<context>` and `<input_data>` sections could be removed entirely (they would be redundant with what the parent skill already has loaded). However, keeping them with descriptive text preserves the 8-section XML structure required by TMPL-01.

**Recommendation:** Keep all 8 sections, replace `{{placeholders}}` with bracketed descriptions like `[project name]`. This preserves the TMPL-01 structure while eliminating the cosmetic issue.

### Anti-Patterns to Avoid

- **Do not add `*_recycled` state writes to skills:** This would add complexity (new transitions, new Case B checks in downstream skills) for a marginal benefit. The simpler fix is adjusting Case B to check gate_history evidence.
- **Do not remove `*_recycled` from status SKILL.md mappings entirely:** Even if they are currently unreachable, they serve as documentation of valid conceptual states. Just ensure the fix makes them reachable OR clearly documents they are conceptual.
- **Do not strip `<context>` and `<input_data>` sections from inline guides:** This would violate TMPL-01's 8-section requirement.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Gate history evidence check | Custom parsing of gate_history YAML | Pattern-match on `gate: "G2"` and `outcome: "recycle"` in gate_history entries | The gate_history array is already well-structured; each entry has `gate` and `outcome` fields |

**Key insight:** All 4 fixes are edits to existing Markdown documents. No code execution, no library installation, no new infrastructure.

## Common Pitfalls

### Pitfall 1: Breaking the Spike "No State Update" Contract

**What goes wrong:** Adding G5 gate_history to spike might encourage future developers to add more state.yml updates to spike, breaking the "spike is optional and stateless" contract.
**Why it happens:** The current note says "Do NOT update state.yml" which is overly broad.
**How to avoid:** Update the note to be precise: "Do NOT write **phase transitions** to state.yml. Spike does not have a lifecycle phase. However, G5 gate outcomes ARE recorded in gate_history since gate outcomes are events, not state transitions."
**Warning signs:** If a future change adds `spike_in_progress` or `spike_complete` as a phase, the contract is broken.

### Pitfall 2: Placeholder Replacement Scope Creep

**What goes wrong:** During INT-06 cleanup, replacing placeholders in the wrong files (subagent templates that legitimately use `{{placeholders}}`).
**Why it happens:** The project has two categories of reference templates: (a) inline guides read by the parent skill (4 files -- these have the cosmetic issue), (b) subagent prompts dispatched via Task() (these NEED placeholders filled at dispatch time).
**How to avoid:** Only modify the 4 files identified in INT-06. Do NOT touch: `prompt-web-researcher.md`, `prompt-codebase-analyst.md`, `prompt-mcp-researcher.md`, `prompt-sufficiency-evaluator.md`, `prompt-research-synthesizer.md`, `prompt-spike-researcher.md`. Those templates have their placeholders correctly filled by the dispatching skill.
**Warning signs:** If a grep for `{{` in references/ shows zero matches after cleanup, subagent templates were incorrectly modified.

### Pitfall 3: INT-04 Fix Creating Ambiguous Entry Points

**What goes wrong:** After adjusting Case B to accept `*_in_progress` + `--override`, it becomes ambiguous whether the user is (a) mid-skill and should resume, or (b) wants to override into the next skill.
**Why it happens:** `*_in_progress` means the skill was started but not finished. The `--override` flag disambiguates: without it, the user wants to resume the current skill; with it, they want to jump ahead.
**How to avoid:** The adjusted Case B must check THREE conditions together: (1) `*_in_progress` phase, (2) `--override` flag present, AND (3) gate_history contains at least one recycle entry for the relevant gate. If any condition is missing, it is NOT an override re-entry.
**Warning signs:** User can enter design phase without having gone through G2 at all (no recycle history).

### Pitfall 4: Inconsistent TELE Checkbox Verification

**What goes wrong:** Planner creates tasks to update TELE checkboxes that are already updated.
**Why it happens:** The audit reported them as `[ ]` but commit 81fc0b5 already fixed them.
**How to avoid:** The plan should include a verification step that reads REQUIREMENTS.md to confirm TELE-01..05 are already `[x]` before creating any tasks for this item. If already done, skip.
**Warning signs:** If the plan includes explicit TELE checkbox update tasks without a precondition check.

## Code Examples

### INT-04: Adjusted Case B for Design SKILL.md

Current (dead code):
```markdown
**Case B: Phase is "research_recycled" AND `--override` flag is present**
```

Recommended replacement:
```markdown
**Case B: Phase is "research_in_progress" AND `--override` flag is present AND gate_history contains at least one G2 recycle entry**

The user's research gate recycled, they exited the session, and are now re-entering with --override to proceed to design with known gaps.

1. Verify gate_history contains at least one entry where `gate: "G2"` and `outcome: "recycle"`.
   If no G2 recycle found, display error: "Override requested but no G2 recycle found in gate history. Run `/expedite:research` first." -> STOP.
2. Read `.expedite/research/override-context.md` (must exist after a G2 override/recycle). If it doesn't exist, display error: "Override requested but no override-context.md found. Run `/expedite:research` first." -> STOP.
3. Record the override entry in state.yml gate_history (backup-before-write):
   ...
```

### INT-04: Adjusted Case B for Plan SKILL.md

Same pattern as above, but checking for `design_in_progress` + G3 recycle history instead.

### INT-05: G5 Gate History Addition for Spike SKILL.md Step 7

After the existing `cat >> .expedite/log.yml` block, add:

```markdown
**Record gate history in state.yml** (backup-before-write):

1. Read `.expedite/state.yml`
2. Copy to backup: `cp .expedite/state.yml .expedite/state.yml.bak` (via Bash)
3. Append to `gate_history`:
   ```yaml
   - gate: "G5"
     timestamp: "{ISO 8601 UTC}"
     outcome: "{go|go_advisory|recycle|override}"
     must_passed: {N}
     must_failed: {N}
     should_passed: {N}
     should_failed: {N}
     notes: "Spike phase: {slug}"
     overridden: false
   ```
4. Write the entire file back to `.expedite/state.yml`
```

### INT-06: Placeholder Replacement Example

Before (prompt-scope-questioning.md):
```xml
<context>
Project: {{project_name}}
Intent: {{intent}}
Phase: Scope
```

After:
```xml
<context>
Project: [current project name from state.yml]
Intent: [current intent from state.yml]
Phase: Scope
```

Before (prompt-design-guide.md `<input_data>`):
```xml
<input_data>
{{scope_content}}
{{synthesis_content}}
</input_data>
```

After:
```xml
<input_data>
[Scope and synthesis content are loaded by the design skill at invocation time.
The skill reads SCOPE.md and SYNTHESIS.md directly -- this section documents
what data the guide expects to be available in context.]
</input_data>
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `*_recycled` state written by gates | Gates loop internally, override proceeds to `*_complete` | Phase 4-9 implementation | `*_recycled` transitions are dead code in state.yml.template |
| G5 outcome in log.yml only | G5 outcome in both log.yml and gate_history | This phase (Phase 12) | Status display shows complete G1-G5 gate chain |

## Open Questions

1. **Should `*_recycled` states be removed from state.yml.template entirely?**
   - What we know: They are never written. The fix makes them unnecessary by using `*_in_progress` + gate_history evidence.
   - What's unclear: Whether removing them from the template comments creates confusion for future developers reading the schema.
   - Recommendation: Keep them with an annotation comment: "# Note: *_recycled states are conceptual. Cross-session override re-entry uses *_in_progress + --override + gate_history evidence." This documents the design intent without claiming they are written.

2. **Should status SKILL.md keep or remove `*_recycled` phase mappings?**
   - What we know: Status has display mappings for `research_recycled`, `design_recycled`, `plan_recycled`. These phases are never actually set in state.yml.
   - What's unclear: Whether a future change might use them, or if removing them simplifies maintenance.
   - Recommendation: Keep them. They cost nothing (3 extra mapping entries) and serve as documentation. If state.yml ever does contain `*_recycled` (from a manual edit or future feature), the status display will handle it correctly.

## Sources

### Primary (HIGH confidence)
- Direct file reads: `skills/design/SKILL.md`, `skills/plan/SKILL.md`, `skills/spike/SKILL.md`, `skills/status/SKILL.md`, `skills/execute/SKILL.md`, `skills/research/SKILL.md`
- Direct file reads: `templates/state.yml.template`
- Direct file reads: All 4 inline reference templates (`prompt-scope-questioning.md`, `prompt-design-guide.md`, `prompt-plan-guide.md`, `prompt-task-verifier.md`)
- Direct file reads: `.planning/v1.0-MILESTONE-AUDIT.md` (audit findings INT-04, INT-05, INT-06, FLOW-03)
- Git history: `git show 81fc0b5` confirms TELE-01..05 checkboxes already updated

### Secondary (MEDIUM confidence)
- None needed -- all findings are from direct source file analysis.

### Tertiary (LOW confidence)
- None.

## Metadata

**Confidence breakdown:**
- INT-04 fix approach: HIGH - All affected files read and analyzed, both fix options understood, recommendation grounded in existing architectural decisions
- INT-05 fix approach: HIGH - Spike SKILL.md fully read, the "no state update" note understood in context, gate_history pattern established by G1-G4
- INT-06 fix approach: HIGH - All 4 templates read, every placeholder cataloged, distinction between inline guides and subagent templates clear
- TELE checkbox status: HIGH - Git diff confirms already done in commit 81fc0b5

**Research date:** 2026-03-08
**Valid until:** 2026-04-08 (stable -- no external dependencies)
