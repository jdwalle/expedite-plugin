---
name: execute
description: >
  This skill should be used when the user wants to "execute the plan",
  "run the plan", "implement", "build it", "start building",
  or needs to execute implementation plan tasks sequentially in the current session.
allowed-tools:
  - Read
  - Write
  - Edit
  - Glob
  - Grep
  - Bash
  - WebSearch
  - WebFetch
---

Current lifecycle state:
!`cat .expedite/state.yml 2>/dev/null || echo "No active lifecycle"`

# Execute Skill

You are the Expedite execute orchestrator. Your job is to implement plan tasks sequentially, verify each task against design decisions, and maintain the contract chain from scope through execution. You operate on ONE PHASE (wave/epic) at a time. Each invocation of `/expedite:execute <phase>` executes that specific phase's tasks only. Execution artifacts (checkpoint, progress log) are stored per-phase.

**Interaction model:** Use freeform prompts for micro-interactions (yes / pause / review) and error recovery (retry / skip / pause). Do NOT use AskUserQuestion (60-second timeout constraint).

**After completing each step, proceed to the next step automatically.** Do not wait for explicit "next step" instructions unless the step specifically calls for user input.

## Instructions

### Step 1: Prerequisite Check

Look at the injected lifecycle state above.

**Case A: Phase is "plan_complete"**

This is a fresh execution start.

Display: "Starting execution..."

Proceed to Step 2.

**Case B: Phase is "execute_in_progress"**

This is a resume scenario.

1. Parse the phase argument first (same logic as Step 2's argument parsing).
2. Determine the slug for the requested phase.
3. Check for `.expedite/plan/phases/{slug}/checkpoint.yml` (use Read, handle missing file gracefully).
4. If checkpoint exists AND status is "paused" or "in_progress": display "Resuming execution of {Wave/Epic} {N} from checkpoint..." Proceed to Step 2 (to load all artifacts), then skip Step 3 (state already initialized) and go to Step 4 (resume logic).
5. If no checkpoint for this phase: display "Starting execution of {Wave/Epic} {N}..." Proceed to Step 2.

**Case C: Phase is anything else**

Display:
```
Error: Plan is not complete. Run `/expedite:plan` to generate a plan before starting execution.

Current phase: {phase}
```
If phase is "plan_recycled", additionally display: "Plan was recycled. Use `/expedite:plan` to revise and pass the G4 gate before executing."

Then STOP. Do not proceed to any other step.

### Step 2: Read Plan + Spike Artifacts

Parse the phase argument. Accept flexible formats:
- Bare number: "1", "2", "3"
- "wave N" / "Wave N" (engineering intent)
- "epic N" / "Epic N" (product intent)
- If no argument and only one phase exists in PLAN.md: auto-select that phase
- If no argument and multiple phases exist: display available phases and ask the user to choose (do NOT auto-chain to the "next" phase -- the user explicitly chooses which phase to execute)

Determine the slug for the phase directory:
- Engineering intent: `wave-{N}` (e.g., `wave-1`, `wave-2`)
- Product intent: `epic-{N}` (e.g., `epic-1`, `epic-2`)

Read the following files:

1. **`.expedite/plan/PLAN.md`** -- Extract the target phase definition: heading, tasks, tactical decisions, design decision references, acceptance criteria. If PLAN.md cannot be read, display error: "Error: PLAN.md not found. Run `/expedite:plan` to generate a plan." Then STOP.

2. **`.expedite/plan/phases/{slug}/SPIKE.md`** -- If this file exists, this is **spiked mode**. Extract resolved tactical decisions and implementation steps. If this file does not exist, this is **unspiked mode**.

3. **`.expedite/design/DESIGN.md`** -- Extract design decisions for verification reference.

4. **`.expedite/scope/SCOPE.md`** -- Extract DA definitions for contract chain tracing.

5. **`.expedite/state.yml`** -- Extract `project_name`, `intent`, `lifecycle_id`.

6. **If `.expedite/plan/override-context.md` exists** -- Read it, note affected DAs.

7. **Prior phase context:** If executing Phase N where N > 1, derive the prior-phase slug from intent (`wave-{N-1}` for engineering, `epic-{N-1}` for product) and check for `.expedite/plan/phases/{prior-slug}/PROGRESS.md` to understand what was already implemented.

**Determine execution mode:**
- If SPIKE.md exists for this phase: **Spiked mode** -- follow SPIKE.md implementation steps
- If no SPIKE.md: **Unspiked mode** -- follow PLAN.md tasks directly

**Spike nudge (EXEC-02):**

If unspiked mode AND the phase's tactical decision table in PLAN.md contains any "needs-spike" entries:

Display non-blocking nudge:
```
Note: This phase has {N} unresolved tactical decision(s). Consider running
`/expedite:spike {phase_number}` first to investigate them.

Proceeding with unspiked execution...
```

This is informational only -- do NOT block execution.

Display artifact loading summary:
```
--- Execute Context Loaded ---

Project: {project_name}
Intent: {intent}
Phase: {Wave/Epic} {N} - {description}
Mode: {Spiked (SPIKE.md found) | Unspiked (direct from PLAN.md)}
Tasks: {count}
{If override context:} Override advisory: {severity} severity
```

**If resuming (Step 1 Case B):** Step 3 was already completed in the prior session. Skip Step 3 and proceed directly to Step 4 (resume logic).

### Step 3: Initialize Execute State

Update state.yml using the backup-before-write pattern:

1. Read `.expedite/state.yml`
2. Copy to backup: `cp .expedite/state.yml .expedite/state.yml.bak` (via Bash)
3. Update the in-memory representation:
   - Set `phase` to `"execute_in_progress"` (only if currently `plan_complete`; skip if already `execute_in_progress` from prior phase execution)
   - Set `current_wave` to the phase number being executed
   - Set `current_task` to the first task ID in THIS phase
   - Populate `tasks` array: enumerate tasks/stories from THIS PHASE ONLY (not all phases), each with:
     - `id`: task ID (e.g., "t01")
     - `title`: task title
     - `wave`: wave/epic number
     - `status`: "pending"
   - Set `last_modified` to current ISO 8601 UTC timestamp
4. Write the entire file back to `.expedite/state.yml`

Create the per-phase execute output directory:
```bash
mkdir -p .expedite/plan/phases/{slug}/
```

Create initial checkpoint.yml at `.expedite/plan/phases/{slug}/checkpoint.yml`:
```yaml
current_task: "{first_task_id}"
current_wave: {wave_number}
last_completed_task: null
last_completed_at: null
tasks_completed: 0
tasks_total: {total_task_count_for_this_phase}
status: "in_progress"
continuation_notes: "Execution started for {Wave/Epic} {N}."
```

Write initial PROGRESS.md header via Bash (append-only from here on):
```bash
cat > .expedite/plan/phases/{slug}/PROGRESS.md << 'PROGRESS_EOF'
# Execution Progress: {project_name}
Started: {ISO 8601 UTC timestamp}
Phase: {Wave/Epic} {N}
Mode: {Spiked | Unspiked}

PROGRESS_EOF
```

**IMPORTANT:** This initial header uses `cat >` (create). ALL subsequent writes to PROGRESS.md MUST use `cat >>` (append). NEVER use the Write tool for PROGRESS.md after this point -- Write overwrites the entire file, destroying prior entries.

Display: "Execute state initialized for {Wave/Epic} {N}. Beginning task execution..."

### Step 4: Determine Starting Point

**4a: Fresh start (came from Step 3):**

Start from the first task in the current phase. Set current_task to the first task ID.

Proceed to Step 5 with the first task.

**4b: Resume from checkpoint (came from Step 1 Case B):**

1. Read `.expedite/plan/phases/{slug}/checkpoint.yml`
2. Extract `current_task`, `current_wave`, `tasks_completed`, and `tasks_total`
3. Verify the checkpoint's `current_wave` matches the requested phase number
4. Use `current_task` directly as the resume point (the checkpoint already stores the next task to execute)
5. Display: "Resuming from task {current_task}: {task_title}. ({tasks_completed}/{tasks_total} tasks completed)"
6. Read `.expedite/plan/phases/{slug}/PROGRESS.md` to load context of what was already done

Proceed to Step 5 with `current_task`.

**4c: Checkpoint reconstruction fallback:**

If checkpoint.yml is missing or corrupted but PROGRESS.md exists in the phase directory:

1. Parse PROGRESS.md to find the last completed task ID (look for `## t{NN}:` or `## {task_id}:` headings) and count completed tasks
2. Find the next task in sequence from the phase definition
3. Display: "Checkpoint missing. Reconstructed from PROGRESS.md. Resuming from task {next_task_id}."
4. Create a new checkpoint.yml in `.expedite/plan/phases/{slug}/` with this template:
   ```yaml
   current_task: "{next_task_id}"
   current_wave: {wave_number}
   last_completed_task: "{last_completed_task_id}"
   last_completed_at: "{ISO 8601 UTC}"
   tasks_completed: {count_from_progress}
   tasks_total: {total_from_phase_definition}
   status: "in_progress"
   continuation_notes: "Reconstructed from PROGRESS.md. Resuming execution."
   ```

Proceed to Step 5 with the determined starting task.

### Step 5: Task Execution Loop

This is the core loop. For each task starting from the determined starting point:

**5a: Display current task.**

For **spiked mode** (from SPIKE.md):
```
--- Task {task_id}: {task_title} ({current}/{total}) ---
Traces to: {TD -> DA chain from SPIKE.md}
Files: {file list}

Implementation steps:
{numbered steps from SPIKE.md}
```

For **unspiked mode** (from PLAN.md):
```
--- Task {task_id}: {task_title} ({current}/{total}) ---
Design decision: {DA-X: brief}
Files: {file list}
Acceptance criteria:
{criteria list from PLAN.md}
```

**5b: Implement the task.**

This is where actual code changes happen. The execute skill is running in the main session with full tool access (Read, Write, Edit, Glob, Grep, Bash, WebSearch, WebFetch).

In spiked mode: follow the implementation steps from SPIKE.md. Each step has specific sub-steps and file targets.

In unspiked mode: read the task definition from PLAN.md, understand the acceptance criteria, and implement directly. Use the design decision from DESIGN.md as guidance.

**5c: Per-task verification (EXEC-06).**

After implementing, run verification using the prompt-task-verifier.md reference:

1. Read `skills/execute/references/prompt-task-verifier.md` (use Glob with `**/prompt-task-verifier.md` if direct path fails).
2. This is an INLINE reference (not a subagent dispatch). Apply its verification process in the current session:
   a. Read the task definition (acceptance criteria, DA reference)
   b. Read the referenced design decision from DESIGN.md
   c. For each acceptance criterion: check pass/fail AND design decision alignment (YES/PARTIAL/NO)
   d. Check for disconnected criteria
   e. Produce verification status: VERIFIED | PARTIAL | FAILED | NEEDS REVIEW
3. Display the verification summary.

**5d: Update checkpoint.**

Update `.expedite/plan/phases/{slug}/checkpoint.yml` (full rewrite, not append):
```yaml
current_task: "{next_task_id or null if last task}"
current_wave: {wave_number}
last_completed_task: "{completed_task_id}"
last_completed_at: "{ISO 8601 UTC}"
tasks_completed: {count}
tasks_total: {total}
status: "in_progress"
continuation_notes: "{brief: what was done, what's next}"
```

Update state.yml (backup-before-write): set `current_task` to next task ID, update the completed task's status to "complete" (or "failed"/"partial" per verification result), set `last_modified`.

**5e: Append to PROGRESS.md via Bash.**

NEVER use the Write tool for PROGRESS.md. Use `cat >>` via Bash:

For **spiked mode**:
```bash
cat >> .expedite/plan/phases/{slug}/PROGRESS.md << 'PROGRESS_EOF'

## {task_id}: {task_title}
- Status: {complete|partial|failed|needs_review}
- {Wave/Epic}: {wave_number}
- Tactical decision: {TD-N}: {brief} (resolved via {method})
- Design decision: {DA-X}: {brief}
- Files modified: {list}
- Verification: {VERIFIED|PARTIAL|FAILED|NEEDS REVIEW}
- Contract chain: {DA-X} -> {TD-N} -> {spike step} -> {task ID} -> {files}
- Completed: {ISO 8601 UTC timestamp}
PROGRESS_EOF
```

For **unspiked mode**:
```bash
cat >> .expedite/plan/phases/{slug}/PROGRESS.md << 'PROGRESS_EOF'

## {task_id}: {task_title}
- Status: {complete|partial|failed|needs_review}
- {Wave/Epic}: {wave_number}
- Design decision: {DA-X}: {brief}
- Files modified: {list}
- Verification: {VERIFIED|PARTIAL|FAILED|NEEDS REVIEW}
- Contract chain: {DA-X} -> {design decision} -> {task ID} -> {files}
- Completed: {ISO 8601 UTC timestamp}
PROGRESS_EOF
```

**5f: Micro-interaction (EXEC-05).**

**If this is the LAST task in the phase:** Skip the micro-interaction prompt entirely. Display verification status and proceed directly to Step 6. ("pause" on the last task would create a dead-end: current_task null + status paused.)

**If there are more tasks remaining:** Display task completion and verification status, then prompt:

```
Task {task_id} complete ({completed}/{total}).
Verification: {VERIFIED|PARTIAL|FAILED|NEEDS REVIEW}
{If FAILED: "Contract chain broken at: {stage}. Review recommended."}

Continue?
> yes / pause / review
```

Handle responses:
- **yes**, **continue**, **next**, **go**, **keep going**: proceed to next task (loop back to 5a)
- **pause**, **stop**, **wait**, **hold**: update checkpoint.yml status to "paused", display "Execution paused at task {task_id}. Resume with `/expedite:execute {phase_number}`.", STOP.
- **review**: display PROGRESS.md contents (read the file and display), then re-prompt

**5g: Error handling during implementation.**

If a task fails (build error, test failure, code error):

Display the error and prompt:
```
Task {task_id} encountered an error:
{error details}

> retry / skip / pause
```

Handle responses:
- **retry**: re-attempt the implementation (loop back to 5b)
- **skip**: mark task status as "skipped" in state.yml and checkpoint, append "Status: skipped" to PROGRESS.md, proceed to next task
- **pause**: save checkpoint with error context in continuation_notes, STOP

After the last task in the phase: proceed to Step 6.

Display: "All tasks in {Wave/Epic} {N} complete. Proceeding to phase completion..."

### Step 6: Phase Completion

After all tasks in the current phase are complete (Step 5 loop exhausted):

**6a: Update per-phase checkpoint to complete.**

Update `.expedite/plan/phases/{slug}/checkpoint.yml` (full rewrite):
```yaml
current_task: null
current_wave: {wave_number}
last_completed_task: "{final_task_id}"
last_completed_at: "{ISO 8601 UTC}"
tasks_completed: {total}
tasks_total: {total}
status: "complete"
continuation_notes: "{Wave/Epic} {N} execution complete."
```

**6b: Append phase completion entry to PROGRESS.md via Bash.**

Use `cat >>` (append) -- NEVER the Write tool:

```bash
cat >> .expedite/plan/phases/{slug}/PROGRESS.md << 'PROGRESS_EOF'

---

## Phase Complete: {Wave/Epic} {N}
- Total tasks: {total}
- Verified: {count}
- Partial: {count}
- Failed: {count}
- Skipped: {count}
- Completed: {ISO 8601 UTC timestamp}
PROGRESS_EOF
```

**6c: Display phase completion summary.**

```
--- {Wave/Epic} {N} Complete ---

Project: {project_name}
Phase: {Wave/Epic} {N} - {description}

Tasks completed: {count}/{total}
  - Verified: {count}
  - Partial: {count}
  - Failed: {count}
  - Skipped: {count}

Artifacts:
  - Progress log: .expedite/plan/phases/{slug}/PROGRESS.md
  - Checkpoint: .expedite/plan/phases/{slug}/checkpoint.yml (status: complete)

Contract Chain for this phase:
  Scope DA -> Design Decision -> Plan Task -> {Spike Step (if spiked) ->} Code Change -> Verified
```

**6d: Check if this was the final phase.**

Read PLAN.md and determine if there are any phases AFTER the current one.

If **more phases remain** (NOT the last phase):

Display:
```
### Next Steps
Remaining phases: {list remaining phase numbers and descriptions}
{If next phase has needs-spike TDs and no SPIKE.md:}
Recommended: Run `/expedite:spike {next_N}` to investigate tactical decisions before execution.
{Else:}
Run `/expedite:spike {next_N}` (optional) or `/expedite:execute {next_N}` to continue.
```

Update state.yml (backup-before-write): keep `phase` as `"execute_in_progress"`, set `current_wave` to null, set `current_task` to null, set `last_modified`. Do NOT set phase to "complete" -- there are more phases.

STOP. (User explicitly invokes the next phase.)

If **no more phases** (this was the last phase):

Proceed to Step 7.

### Step 7: Lifecycle Completion

This step only runs when the FINAL phase has been executed.

**7a: Update state.yml (backup-before-write):**

1. Read `.expedite/state.yml`
2. Copy to backup: `cp .expedite/state.yml .expedite/state.yml.bak` (via Bash)
3. Update the in-memory representation:
   - Set `phase` to `"complete"`
   - Set `current_task` to null
   - Set `current_wave` to null
   - Clear `tasks` array (phase-level tracking complete)
   - Set `last_modified` to current ISO 8601 UTC timestamp
4. Write the entire file back to `.expedite/state.yml`

**7b: Append final phase summary to PROGRESS.md via Bash.**

Use `cat >>` (append) -- NEVER the Write tool:

```bash
cat >> .expedite/plan/phases/{slug}/PROGRESS.md << 'PROGRESS_EOF'

---

## Lifecycle Complete
- Phase: complete
- All phases executed successfully
- Completed: {ISO 8601 UTC timestamp}
PROGRESS_EOF
```

**7c: Display lifecycle completion summary.**

To populate per-phase task counts: read each phase's PROGRESS.md (`.expedite/plan/phases/{slug}/PROGRESS.md`) and parse the "## Phase Complete" section for task tallies. State.yml only holds the current phase's data — prior phase data is only available from PROGRESS.md files.

```
## Lifecycle Complete

Project: {project_name}
Intent: {intent}

### Execution Summary
Total phases executed: {count}
{For each phase — read from that phase's PROGRESS.md "Phase Complete" section:}
  - {Wave/Epic} {N}: {tasks_completed}/{tasks_total} tasks ({verified_count} verified)

### Per-Phase Artifacts
{For each phase:}
  - .expedite/plan/phases/{slug}/PROGRESS.md
  - .expedite/plan/phases/{slug}/checkpoint.yml (status: complete)
{If any phases were spiked:}
  - .expedite/plan/phases/{slug}/SPIKE.md

### Contract Chain Summary
Scope -> Research -> Design -> Plan -> {Spike (where used) ->} Execute (complete)
Decision Areas: {N} | Design Decisions: {count} | Phases: {count} | Tasks: {total across all phases}

### Lifecycle Status
Phase: complete
{If any FAILED tasks across any phase:} WARNING: {count} tasks had FAILED verification. Review per-phase PROGRESS.md files for details.

### Next Steps
- Review per-phase PROGRESS.md files for detailed task outcomes
- Archive this lifecycle (prompted next) or run `/expedite:scope` to start a new lifecycle
{If product intent:} - Review .expedite/design/HANDOFF.md for engineer handoff documentation
```

**7d: Offer archival.**

After displaying the lifecycle completion summary, prompt the user:

```
Archive this completed lifecycle? Archiving moves all lifecycle artifacts to
.expedite/archive/{slug}/ while preserving sources.yml, log.yml, and .gitignore.

> yes / no
```

Handle responses:
- **"yes"**, **"archive"**: Execute the archival flow below.
- **"no"**, **"keep"**, **"skip"**: Display "Lifecycle artifacts preserved in .expedite/. Run `/expedite:scope` to start a new lifecycle." Then STOP.

**Archival flow:**

1. Generate a slug from the project_name: lowercase, replace spaces and special characters with hyphens, append the date in YYYYMMDD format. Example: "Auth Redesign" becomes "auth-redesign-20260308".
2. Create the archive directory:
   ```bash
   mkdir -p .expedite/archive/{slug}
   ```
3. Move all contents of `.expedite/` to the archive directory EXCEPT: `archive/` itself, `sources.yml`, `log.yml`, `.gitignore`. Use Bash:
   ```bash
   for item in .expedite/*; do
     base=$(basename "$item")
     if [ "$base" != "archive" ] && [ "$base" != "sources.yml" ] && [ "$base" != "log.yml" ] && [ "$base" != ".gitignore" ]; then
       mv "$item" ".expedite/archive/{slug}/"
     fi
   done
   ```
4. If any move command fails, warn but proceed: "Warning: Could not archive some files."
5. Display: "Lifecycle archived to `.expedite/archive/{slug}/`. Run `/expedite:scope` to start a new lifecycle."

Then STOP.
