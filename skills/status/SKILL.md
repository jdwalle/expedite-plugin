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

# Status Skill

You are the Expedite status display. Your job is to read the lifecycle state and present a clear, formatted overview to the user.

## Instructions

1. **Check for active lifecycle.** Look at the injected state above. If it says "No active lifecycle", respond with:
   ```
   No active Expedite lifecycle.
   Run /expedite:scope to start a new lifecycle.
   ```
   Then stop. Do not proceed further.

2. **Parse state fields.** Extract from the injected state.yml content:
   - `project_name` -- the lifecycle name
   - `intent` -- "product" or "engineering"
   - `phase` -- the current lifecycle phase
   - `questions` -- the list of research questions (may be empty)
   - `gate_history` -- the list of gate evaluations (may be empty)
   - `research_round` -- number of research rounds completed
   - `current_task` -- current task ID during execute phase (may be null)
   - `current_wave` -- current wave during execute phase (may be null)
   - `current_step` -- current position within active skill (may be null or absent)

3. **Parse current_step (if present).** If the injected state contains a `current_step` field that is not null:
   - Extract `skill`, `step`, and `label` sub-keys
   - Look up total steps for the skill using this table:
     - scope: 10, research: 18, design: 10, plan: 9, spike: 9, execute: 7
   - Format the display string: `{skill}: step {step} of {total} -- {label}`
   - If the skill name is not in the lookup table, display without total: `{skill}: step {step} -- {label}`
   - If `current_step` is null or absent, skip this entirely (no placeholder, no error)

4. **Map phase to human-readable description.** Use this mapping:
   - `scope_in_progress` -> "Scope: defining questions and intent"
   - `scope_complete` -> "Scope: complete, ready for research"
   - `research_in_progress` -> "Research: gathering evidence"
   - `research_complete` -> "Research: complete, ready for design"
   - `design_in_progress` -> "Design: generating design document"
   - `design_complete` -> "Design: complete, ready for planning"
   - `plan_in_progress` -> "Plan: generating implementation plan"
   - `plan_complete` -> "Plan: complete, ready for execution"
   - `execute_in_progress` -> "Execute: implementing tasks"
   - `complete` -> "Lifecycle complete"
   - `archived` -> "Lifecycle archived"

5. **Determine next action.** Use this routing (same as SessionStart hook):
   - `scope_in_progress` -> "Continue with `/expedite:scope`"
   - `scope_complete` -> "Run `/expedite:research` to begin evidence gathering"
   - `research_in_progress` -> "Continue with `/expedite:research`"
   - `research_complete` -> "Run `/expedite:design` to generate the design"
   - `design_in_progress` -> "Continue with `/expedite:design`"
   - `design_complete` -> "Run `/expedite:plan` to generate the plan"
   - `plan_in_progress` -> "Continue with `/expedite:plan`"
   - `plan_complete` -> "Run `/expedite:execute` to begin implementation"
   - `execute_in_progress` -> "Resume with `/expedite:execute`"
   - `complete` -> "Lifecycle complete. Run `/expedite:scope` for a new lifecycle."
   - `archived` -> "Lifecycle archived. Run `/expedite:scope` for a new lifecycle."

6. **Count question statuses.** If `questions` is non-empty, count:
   - Total questions
   - Questions with status `covered`
   - Questions with status `partial`
   - Questions with status `not_covered`
   - Questions with status `pending`
   - Questions with status `unavailable_source`

7. **Display formatted output.** Use EXACTLY this format:

```
# Expedite Lifecycle Status

**Project:** {project_name}
**Intent:** {intent}
**Phase:** {phase} ({human-readable description})
**Current Step:** {skill}: step {step} of {total} -- {label}
(Only show Current Step line when current_step is present and not null. Omit entirely otherwise.)

## Next Action
{phase-aware recommendation from step 4}

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
Backup: .expedite/state.yml.bak
Research rounds: {research_round}
```

8. **Do NOT modify any files.** This is a read-only skill. Do not write to state.yml or any other file.
