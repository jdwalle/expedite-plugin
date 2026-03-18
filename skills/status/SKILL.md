---
name: status
description: >
  This skill should be used when the user wants to "check lifecycle status",
  "where am I", "show status", "lifecycle status", "what phase am I on",
  or needs to see the current lifecycle state, phase, progress, and recommended next action.
allowed-tools:
  - Read
  - Glob
  - Bash
---

Current lifecycle state:
!`cat .expedite/state.yml 2>/dev/null || echo "No active lifecycle"`

Checkpoint:
!`cat .expedite/checkpoint.yml 2>/dev/null || echo "No checkpoint"`

Gates:
!`cat .expedite/gates.yml 2>/dev/null || echo "No gates"`

Questions:
!`cat .expedite/questions.yml 2>/dev/null || echo "No questions"`

Override protocol:
!`cat skills/shared/ref-override-protocol.md 2>/dev/null || echo "No override protocol found"`

# Status Skill

You are the Expedite status display. Your job is to read the lifecycle state and present a clear, formatted overview to the user.

## Instructions

1. **Check for active lifecycle.** Look at the injected state above. If it says "No active lifecycle" (state.yml is missing):

   a. Attempt recovery: Follow the protocol in `skills/shared/ref-state-recovery.md` (use Glob with `**/ref-state-recovery.md` if the direct path fails).
   b. If recovery succeeds: Re-read `.expedite/state.yml` and use the recovered state values for all subsequent steps. Continue to instruction 2.
   c. If recovery fails (no artifacts found): Respond with:
      ```
      No active Expedite lifecycle.
      Run /expedite:scope to start a new lifecycle.
      ```
      Then stop. Do not proceed further.

   If the injected state contains actual lifecycle content (not "No active lifecycle"), proceed to instruction 2.

2. **Parse state fields.** Extract from the injected state.yml content:
   - `project_name` -- the lifecycle name
   - `intent` -- "product" or "engineering"
   - `phase` -- the current lifecycle phase
   - `questions` -- the list of research questions (may be empty)
   - Read gate evaluations from the injected gates.yml content above (the "Gates:" section). Extract the `history` array entries with `gate`, `outcome`, and `timestamp` fields.
   - `research_round` -- read from the injected questions.yml content above (the "Questions:" section), not from state.yml
   - `current_task` -- current task ID during execute phase (may be null)
   - `current_wave` -- current wave during execute phase (may be null)

3. **Parse current step from checkpoint (if present).** Read the injected checkpoint.yml content above (the "Checkpoint:" section). If it contains actual checkpoint data (not "No checkpoint") and `skill` is not null:
   - Extract `skill`, `step`, and `label` fields from checkpoint.yml
   - Look up total steps for the skill using this table:
     - scope: 10, research: 14, design: 10, plan: 9, spike: 9, execute: 7
   - Format the display string: `{skill}: step {step} of {total} -- {label}`
   - If the skill name is not in the lookup table, display without total: `{skill}: step {step} -- {label}`
   - If checkpoint is missing, empty, or skill is null, skip this entirely (no placeholder, no error)

4. **Log Size Check.** Check if `.expedite/log.yml` exists and exceeds 50KB (51200 bytes).

   1. Run via Bash: `wc -c < .expedite/log.yml 2>/dev/null`
   2. If the command fails (file does not exist), skip this step entirely -- no warning needed.
   3. If the byte count exceeds 51200, store a warning:
      "log.yml is {size_kb}KB -- consider archiving the current lifecycle to reset it"
      Where {size_kb} is the byte count divided by 1024, rounded to nearest integer.
   4. This warning will be displayed in the Diagnostics section of the output (Step 9).

5. **Artifact Cross-Reference.** Cross-reference expected artifact files against the current phase from state.yml.

   1. Read the `phase` value from the parsed state (Step 2).
   2. Use this mapping to determine which artifacts SHOULD exist:
      - `scope_complete` and later: `.expedite/scope/SCOPE.md`
      - `research_complete` and later: `.expedite/research/SYNTHESIS.md`
      - `design_complete` and later: `.expedite/design/DESIGN.md`
      - `design_complete` and later, if intent is "product": `.expedite/design/HANDOFF.md`
      - `plan_complete` and later: `.expedite/plan/PLAN.md`
      - `scope_in_progress`: no artifacts expected yet
      - `archived`: skip check entirely (artifacts may have been moved to archive/)

      "Later" means any phase that comes AFTER in the lifecycle sequence.
      The full phase ordering is:
      scope_in_progress < scope_complete < research_in_progress < research_complete < design_in_progress < design_complete < plan_in_progress < plan_complete < spike_in_progress < spike_complete < execute_in_progress < execute_complete < complete

   3. For each expected artifact, check existence using Glob or Read. Note: the HANDOFF.md check is conditional on the `intent` field parsed in Step 2 -- only expect HANDOFF.md when intent is "product". Do not flag missing HANDOFF.md for engineering-intent lifecycles.
   4. Collect any missing artifacts as inconsistencies:
      - Format: "State says {phase} but {artifact_path} not found"
   5. These inconsistencies will be displayed in the Diagnostics section (Step 9).
   6. If phase is `scope_in_progress` or `archived`, or if no inconsistencies found, store nothing.

   **Do NOT attempt to fix inconsistencies.** This is a read-only diagnostic.

6. **Map phase to human-readable description.** Use this mapping:
   - `scope_in_progress` -> "Scope: defining questions and intent"
   - `scope_complete` -> "Scope: complete, ready for research"
   - `research_in_progress` -> "Research: gathering evidence"
   - `research_complete` -> "Research: complete, ready for design"
   - `design_in_progress` -> "Design: generating design document"
   - `design_complete` -> "Design: complete, ready for planning"
   - `plan_in_progress` -> "Plan: generating implementation plan"
   - `plan_complete` -> "Plan: complete, ready for execution"
   - `spike_in_progress` -> "Spike: resolving tactical decisions"
   - `spike_complete` -> "Spike: complete, ready for execution"
   - `execute_in_progress` -> "Execute: implementing tasks"
   - `execute_complete` -> "Execute: tasks complete, finalizing"
   - `complete` -> "Lifecycle complete"
   - `archived` -> "Lifecycle archived"

7. **Determine next action.** Use this routing (same as SessionStart hook):
   - `scope_in_progress` -> "Continue with `/expedite:scope`"
   - `scope_complete` -> "Run `/expedite:research` to begin evidence gathering"
   - `research_in_progress` -> "Continue with `/expedite:research`"
   - `research_complete` -> "Run `/expedite:design` to generate the design"
   - `design_in_progress` -> "Continue with `/expedite:design`"
   - `design_complete` -> "Run `/expedite:plan` to generate the plan"
   - `plan_in_progress` -> "Continue with `/expedite:plan`"
   - `plan_complete` -> "Run `/expedite:spike` to resolve tactical decisions"
   - `spike_in_progress` -> "Continue with `/expedite:spike`"
   - `spike_complete` -> "Run `/expedite:execute` to begin implementation"
   - `execute_in_progress` -> "Resume with `/expedite:execute`"
   - `execute_complete` -> "Lifecycle completing..."
   - `complete` -> "Lifecycle complete. Run `/expedite:scope` for a new lifecycle."
   - `archived` -> "Lifecycle archived. Run `/expedite:scope` for a new lifecycle."

8. **Count question statuses.** If `questions` is non-empty, count:
   - Total questions
   - Questions with status `covered`
   - Questions with status `partial`
   - Questions with status `not_covered`
   - Questions with status `pending`
   - Questions with status `unavailable_source`

9. **Display formatted output.** Use EXACTLY this format:

```
# Expedite Lifecycle Status

**Project:** {project_name}
**Intent:** {intent}
**Phase:** {phase} ({human-readable description from Step 6})
**Current Step:** {skill}: step {step} of {total} -- {label}
(Only show Current Step line when checkpoint data is present per Step 3. Omit entirely otherwise.)

## Next Action
{phase-aware recommendation from Step 7}

## Questions ({total} total)
| Status | Count |
|--------|-------|
| Covered | {n} |
| Partial | {n} |
| Not Covered | {n} |
| Pending | {n} |
| Unavailable Source | {n} |

(Only show rows with count > 0. If no questions exist, display "No questions defined yet.")

## Gate History
| Gate | Outcome | Timestamp |
|------|---------|-----------|
| {gate} | {outcome} | {timestamp} |

(If no gate history, display "No gates evaluated yet.")

## Recovery Info
State file: .expedite/state.yml
Recovery: artifact-based (PLAN.md > DESIGN.md > SYNTHESIS.md > SCOPE.md)
Research rounds: {research_round}

## Diagnostics
{Only display this section if there are warnings or inconsistencies from Steps 4-5.
 If no issues found, omit this section entirely.}

**Warnings:**
- {log size warning from Step 4, if applicable}

**Artifact Inconsistencies:**
- {inconsistency message from Step 5, if applicable}

(Status is read-only. Run the relevant skill to fix inconsistencies.)
```

Within the Diagnostics section, only include the **Warnings** sub-heading if there is a log size warning. Only include the **Artifact Inconsistencies** sub-heading if there are inconsistencies. If both exist, show both.

10. **Read-Only Constraint.** Do NOT modify any files. This is a read-only skill. Do not write to state.yml, log.yml, or any other file. If inconsistencies are found in Step 5, REPORT them in the output -- do not attempt to fix them.
