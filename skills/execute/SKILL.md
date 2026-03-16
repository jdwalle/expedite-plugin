---
name: execute
description: >
  This skill should be used when the user wants to "execute the plan",
  "run the plan", "implement", "build it", "start building",
  or needs to execute implementation plan tasks sequentially via agent dispatch.
allowed-tools:
  - Read
  - Write
  - Edit
  - Glob
  - Grep
  - Bash
  - Agent
---

Current lifecycle state:
!`cat .expedite/state.yml 2>/dev/null || echo "No active lifecycle"`

Checkpoint:
!`cat .expedite/checkpoint.yml 2>/dev/null || echo "No checkpoint"`

Tasks:
!`cat .expedite/tasks.yml 2>/dev/null || echo "No tasks"`

Session context:
!`cat .expedite/session-summary.md 2>/dev/null`

Override protocol:
!`cat skills/shared/ref-override-protocol.md 2>/dev/null || echo "No override protocol found"`

# Execute Skill

You are the Expedite execute orchestrator. Dispatch task-implementer agents for each task, verify results against design decisions, and maintain the contract chain. Operates on ONE PHASE at a time. Agent writes to project source files; skill writes to state/checkpoint/progress only after agent returns.

**Interaction model:** Freeform prompts for micro-interactions (yes/pause/review) and error recovery (retry/skip/pause). Do NOT use AskUserQuestion.

**After completing each step, proceed to the next step automatically.**

**Step tracking (applies to ALL steps):** Before each step, update `current_step` in state.yml using backup-before-write: read state.yml, `cp .expedite/state.yml .expedite/state.yml.bak`, set `current_step` to `{skill: "execute", step: N, label: "step-name"}`, set `last_modified`, write back.

**Checkpoint pattern (applies to ALL steps):** After step tracking, write `.expedite/checkpoint.yml`:
```yaml
skill: "execute"
step: N
label: "step-name"
substep: null
continuation_notes: null
inputs_hash: null
updated_at: "{ISO 8601 UTC timestamp}"
```

**State writes happen only at step boundaries and after agent returns, never during agent execution.**

## Instructions

### Step 1: Prerequisite Check

**State Recovery Preamble:** If "No active lifecycle": follow `skills/shared/ref-state-recovery.md`. Recovery fails -> "Run /expedite:scope." STOP.

**Case A: `phase: "plan_complete"`** -- Fresh start. "Starting execution..." Proceed to Step 2.

**Case B: `phase: "execute_in_progress"`** -- Resume. Parse phase argument. Checkpoint-based resume: if checkpoint.skill is "execute" and substep starts with "executing_task_", resume at Step 5 for that task. Otherwise resume at checkpoint.step. Also read per-phase checkpoint at `.expedite/plan/phases/{slug}/checkpoint.yml` for task-level context. Proceed to Step 2 to load artifacts, then skip Step 3.

**Case C: Any other** -- "Error: Plan not complete. Run `/expedite:plan`." STOP.

### Step 2: Read Plan + Spike Artifacts

Parse phase argument (flexible: bare number, "wave N", "epic N"). Determine slug.

Read: `.expedite/plan/PLAN.md` (extract target phase), `.expedite/plan/phases/{slug}/SPIKE.md` (if exists -> spiked mode; else -> unspiked mode), `.expedite/design/DESIGN.md`, `.expedite/scope/SCOPE.md`, `.expedite/state.yml`, `.expedite/plan/override-context.md` (if exists). For Phase N > 1: read prior PROGRESS.md.

**Spike nudge:** If unspiked AND phase has "needs-spike" TDs: "Note: {N} unresolved TD(s). Consider `/expedite:spike {N}` first. Proceeding..."

Display loading summary: project, intent, phase, mode, task count.

### Step 3: Initialize Execute State

Backup-before-write state.yml: set `phase: "execute_in_progress"` (only if currently plan_complete), `current_wave`, `current_task` (first task), populate `tasks` array for THIS PHASE ONLY (id, title, wave, status: "pending"), last_modified.

Log phase transition (only if phase changed). `mkdir -p .expedite/plan/phases/{slug}/`. Create per-phase checkpoint.yml. Write PROGRESS.md header via `cat >` (create-only; all subsequent writes use `cat >>` append via Bash).

### Step 4: Determine Starting Point

**Fresh start (from Step 3):** first task -> Step 5.
**Resume from checkpoint:** read per-phase checkpoint, extract current_task and tasks_completed, verify wave matches. Display resume context.
**Checkpoint reconstruction:** if checkpoint missing but PROGRESS.md exists, parse last completed task, derive next task, create new checkpoint.

### Step 5: Task Execution Loop

For each task from starting point:

**5a: Display task.** Spiked: TD -> DA chain, files, implementation steps from SPIKE.md. Unspiked: DA reference, files, acceptance criteria from PLAN.md.

**5b: Dispatch task-implementer agent (worktree-isolated).** Assemble task context: task definition (from SPIKE.md steps or PLAN.md criteria), file targets, acceptance criteria, design decision reference from DESIGN.md, execution mode (spiked/unspiked).

Dispatch the `task-implementer` agent by name via the Agent tool. The agent runs in an isolated git worktree (configured via `isolation: worktree` in agent frontmatter).

**After agent returns -- worktree merge-back:**
- The agent result includes the worktree branch name if changes were made.
- If changes were made: merge the worktree branch back to the current branch via Bash:
  ```bash
  git merge {worktree_branch} --no-edit
  ```
  If the merge fails (conflict or error): do NOT auto-resolve. Display the error message and instructions: "Worktree merge conflict. Resolve manually, then type 'continue' to proceed or 'pause' to save checkpoint." Save checkpoint with substep `merge_conflict_{task_id}`. STOP and wait for user.
- If no changes were made (worktree auto-cleaned): note "No changes from task-implementer" and proceed to verification.

**Validate agent output on return:** After successful merge (or no-change), check that files listed in task definition were modified (use Glob/stat). If expected files not modified: flag as potential failure, proceed to verification.

**5c: Per-task verification (inline, not agent).** Read `skills/execute/references/prompt-task-verifier.md` (Glob if needed). Apply inline: check each acceptance criterion pass/fail AND design decision alignment (YES/PARTIAL/NO). Check for disconnected criteria. Status: VERIFIED | PARTIAL | FAILED | NEEDS REVIEW.

**5d: Update state.** Update per-phase checkpoint.yml (current_task, last_completed, tasks_completed). Update state.yml (current_task, task status). Write top-level checkpoint with substep.

**5e: Append to PROGRESS.md via Bash** (`cat >>`, NEVER Write tool). Record: task ID, status, TD/DA chain, files modified, verification result, contract chain, timestamp.

**5f: Micro-interaction.** Last task: skip prompt -> Step 6. Otherwise: "Continue? > yes / pause / review". yes -> next task. pause -> save checkpoint, STOP. review -> display PROGRESS.md, re-prompt.

**5g: Error handling.** On failure: display error. "retry / skip / pause". retry -> re-dispatch agent. skip -> mark skipped. pause -> save, STOP.

### Step 6: Phase Completion

Update per-phase checkpoint (status: "complete"). Append phase summary to PROGRESS.md via Bash. Display: task counts (verified/partial/failed/skipped), artifact paths, contract chain.

**If more phases remain:** Display remaining phases and next step suggestions. Update state.yml: keep execute_in_progress, clear current_step/wave/task. STOP.

**If final phase:** Proceed to Step 7.

### Step 7: Lifecycle Completion

Update state.yml: `phase: "complete"`, clear current_step/task/wave/tasks. Log phase transition. Append lifecycle complete to PROGRESS.md via Bash.

Display: project, intent, per-phase tallies (from each PROGRESS.md), artifacts, contract chain summary, lifecycle status.

**Offer archival:** "Archive? (yes/no)". Yes: generate slug, `mkdir -p .expedite/archive/{slug}`, move all except archive/, sources.yml, log.yml, .gitignore. No: "Artifacts preserved. Run `/expedite:scope` for new lifecycle." STOP.
