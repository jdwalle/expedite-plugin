---
name: plan
description: >
  This skill should be used when the user wants to "generate a plan",
  "create implementation plan", "plan phase", "decompose tasks",
  "break down into tasks", or needs to decompose a design into an ordered
  implementation plan. Supports --override flag.
allowed-tools:
  - Read
  - Write
  - Glob
  - Bash
  - Agent
argument-hint: "[--override]"
---

Current lifecycle state:
!`cat .expedite/state.yml 2>/dev/null || echo "No active lifecycle"`

Checkpoint:
!`cat .expedite/checkpoint.yml 2>/dev/null || echo "No checkpoint"`

Session context:
!`cat .expedite/session-summary.md 2>/dev/null || echo "No session context"`

Override protocol:
!`cat skills/shared/ref-override-protocol.md 2>/dev/null || echo "No override protocol found"`

# Plan Skill

You are the Expedite plan orchestrator. Decompose design decisions into executable implementation phases with tactical decision identification via agent dispatch. Fourth stage of the contract chain: scope -> research -> design -> plan.

**Interaction model:** Freeform for revision feedback. AskUserQuestion for structured choices only.

**After completing each step, proceed to the next step automatically.**

**Step tracking (applies to ALL steps):** Before each step: (1) backup-before-write state.yml: read, `cp .expedite/state.yml .expedite/state.yml.bak`, set `last_modified`, write back. (2) Write checkpoint.yml: `skill: "plan", step: N, label: "step-name", substep: null, continuation_notes: null, inputs_hash: null, updated_at: timestamp`.

**Checkpoint pattern (applies to ALL steps):** After step tracking, write `.expedite/checkpoint.yml`:
```yaml
skill: "plan"
step: N
label: "step-name"
substep: null
continuation_notes: null
inputs_hash: null
updated_at: "{ISO 8601 UTC timestamp}"
```

**State writes happen only at step boundaries, never during agent execution.**

## Instructions

### Step 1: Prerequisite Check

**State Recovery Preamble:** If injected state shows "No active lifecycle": follow `skills/shared/ref-state-recovery.md` (Glob `**/ref-state-recovery.md` if needed). Recovery succeeds -> re-read state.yml, use for Case routing. Recovery fails -> "No recovery source found. Run /expedite:scope." STOP.

**Case A: `phase: "design_complete"`** -- "Starting plan phase..." Proceed to Step 2.

**Case B: `phase: "design_in_progress"` AND `--override` AND gates.yml has G3 recycle** -- Verify G3 recycle in gates.yml (read `.expedite/gates.yml`, check history for gate: "G3", outcome: "recycle"). Read override-context.md. Record override in gates.yml (append: gate "G3", outcome "overridden", override_reason "User-initiated --override entry from design_in_progress"). Display override warning. Proceed to Step 2.

**Case B2: `phase: "plan_in_progress"` (no --override)** -- Resume. Check gates.yml for G3 recycle evidence. Checkpoint-based resume: if checkpoint.skill is "plan", jump to checkpoint.step. Artifact fallback: PLAN.md exists -> Step 6; no PLAN.md -> Step 2. Do NOT re-run Step 3.

**Case C: Any other phase** -- "Error: Design not complete. Run `/expedite:design`." STOP.

### Step 2: Read Design + Scope Artifacts

Read: `.expedite/design/DESIGN.md` (per-DA decisions, confidence, open questions), `.expedite/scope/SCOPE.md` (DAs, depth, readiness), `.expedite/state.yml` (project_name, intent, lifecycle_id), `.expedite/design/override-context.md` (if exists). Display loading summary. Build DA coverage checklist (full/partial/missing). Error if DESIGN.md or SCOPE.md missing -> STOP.

### Step 3: Initialize Plan State

Backup-before-write state.yml: set `phase: "plan_in_progress"`, last_modified. Log phase transition to log.yml. `mkdir -p .expedite/plan/`. Display: "Plan phase initialized."

### Step 4: Generate Implementation Plan (Agent Dispatch)

Assemble context for the plan-decomposer agent:
- project_name, intent from state.yml
- design_file: `.expedite/design/DESIGN.md`
- scope_file: `.expedite/scope/SCOPE.md`
- override_context: `.expedite/design/override-context.md` (if exists)
- output_path: `.expedite/plan/PLAN.md`
- plan_guide_reference: `skills/plan/references/prompt-plan-guide.md` (for agent to read)

Dispatch the `plan-decomposer` agent by name via the Agent tool. Pass the assembled context prompt with all placeholder values filled.

**Validate agent output on return:** Read `.expedite/plan/PLAN.md`. Verify:
1. File exists and is non-empty
2. Contains wave/epic sections matching intent
3. Contains tactical decision tables
4. Header contains correct project_name and intent

If validation fails: display specific error. "Agent plan-decomposer did not produce valid PLAN.md. Retry? (yes/abort)". On retry: re-dispatch once. On abort or second failure: STOP.

### Step 5: Post-Generation Verification

Read back PLAN.md. Verify: DA coverage (every DA from SCOPE.md in at least one phase), phase sizing (2-5 TDs, 3-8 tasks per phase), acceptance criteria have DA traceability. Display plan summary: wave/epic count, task count, TD breakdown. If DA coverage incomplete, display warning.

### Step 6: Revision Cycle

Present plan for review. Freeform loop:
- **revise** -- parse feedback, apply changes, rewrite PLAN.md. Re-validate DA coverage and phase sizing. Return to review prompt.
- **proceed** / "looks good" / "lgtm" / "yes" -- proceed to Step 7.

Plan-specific revisions: reorder tasks, split/merge phases, reclassify TDs, adjust boundaries, add/remove tasks, modify acceptance criteria.

### Step 7: G4 Gate Evaluation

Structural gate -- deterministic Node.js script. No LLM judgment.

**Invoke gate script:**
Run via Bash: `node ${CLAUDE_PLUGIN_ROOT}/gates/g4-plan.js "$(pwd)"`

The script reads PLAN.md and SCOPE.md, evaluates structural criteria, writes the result to gates.yml, and prints JSON to stdout.

**Read script output:** Parse the JSON stdout. Extract `outcome` and `failures`.

**Outcomes:** go, go_advisory, recycle -- same routing as Step 8. Log to log.yml.

### Step 8: Gate Outcome Handling

**Go** -- "G4 passed." -> Step 9.

**go_advisory** -- Show SHOULD failures. "1. Proceed | 2. Revise". Proceed -> Step 9. Revise -> Step 6.

**Recycle** -- Escalation by count (1st: informational, 2nd: suggest adjustment, 3rd+: recommend override). Revise -> Step 6. Override -> record in gates.yml (overridden: true), write `.expedite/plan/override-context.md` with severity and affected phases/DAs, log override -> Step 9.

### Step 9: Plan Completion

Update state.yml: `phase: "plan_complete"`, last_modified. Write completion checkpoint. Log phase transition. Do NOT populate tasks array or current_wave (execute skill does that).

Display summary: project, intent, artifacts, gate results, plan stats (waves/epics, tasks, TDs), contract chain. "Next: `/expedite:spike <phase>` to resolve tactical decisions before execution." STOP.
