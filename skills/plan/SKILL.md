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
!`cat .expedite/session-summary.md 2>/dev/null`

Override protocol:
!`cat skills/shared/ref-override-protocol.md 2>/dev/null || echo "No override protocol found"`

# Plan Skill

You are the Expedite plan orchestrator. Decompose design decisions into executable implementation phases with tactical decision identification via agent dispatch. Fourth stage of the contract chain: scope -> research -> design -> plan.

**Interaction model:** Freeform for revision feedback. AskUserQuestion for structured choices only.

**After completing each step, proceed to the next step automatically.**

**Step tracking (applies to ALL steps):** Before each step, update `current_step` in state.yml using backup-before-write: read state.yml, `cp .expedite/state.yml .expedite/state.yml.bak`, set `current_step` to `{skill: "plan", step: N, label: "step-name"}`, set `last_modified`, write back.

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

**Case B: `phase: "design_in_progress"` AND `--override` AND gates.yml has G3 recycle** -- Verify G3 recycle in gates.yml (read `.expedite/gates.yml`, check history for gate: "G3", outcome: "recycle"). Read override-context.md. Record override in gates.yml (append: gate "G3-plan-entry", outcome "override"). Display override warning. Proceed to Step 2.

**Case B2: `phase: "plan_in_progress"` (no --override)** -- Resume. Check gates.yml for G3 recycle evidence. Checkpoint-based resume: if checkpoint.skill is "plan", jump to checkpoint.step. Artifact fallback: PLAN.md exists -> Step 6; no PLAN.md -> Step 2. Do NOT re-run Step 3.

**Case C: Any other phase** -- "Error: Design not complete. Run `/expedite:design`." STOP.

### Step 2: Read Design + Scope Artifacts

Read: `.expedite/design/DESIGN.md` (per-DA decisions, confidence, open questions), `.expedite/scope/SCOPE.md` (DAs, depth, readiness), `.expedite/state.yml` (project_name, intent, lifecycle_id), `.expedite/design/override-context.md` (if exists). Display loading summary. Build DA coverage checklist (full/partial/missing). Error if DESIGN.md or SCOPE.md missing -> STOP.

### Step 3: Initialize Plan State

Backup-before-write state.yml: set `phase: "plan_in_progress"`, current_step, last_modified. Log phase transition to log.yml. `mkdir -p .expedite/plan/`. Display: "Plan phase initialized."

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

Read PLAN.md and SCOPE.md. Structural gate -- deterministic checks, no LLM judgment.

**MUST criteria:** M1: every DA covered by at least one phase. M2: phase sizing within bounds (2-5 TDs, 3-8 tasks). M3: tactical decisions listed per phase (each classified). M4: acceptance criteria trace to design decisions (parenthetical DA ref). M5: PLAN.md exists, non-empty.

**SHOULD criteria:** S1: logical wave/epic ordering. S2: effort/sizing present. S3: no orphan tasks. S4: override-affected DAs flagged (auto-PASS if no override). S5: task coverage reflects DA depth calibration.

Outcomes: Go (all pass), Go-with-advisory (MUST pass, SHOULD fail), Recycle (any MUST fail). Log to log.yml.

**Record gate result to `.expedite/gates.yml`:**
Read existing gates.yml (if any). Append to history array:
```yaml
history:
  - gate: "G4"
    timestamp: "{ISO 8601 UTC}"
    outcome: "{go|go_advisory|recycle|override}"
    evaluator: "plan-skill"
    must_passed: {N}
    must_failed: {N}
    should_passed: {N}
    should_failed: {N}
    notes: "{summary or null}"
    overridden: false
```
If gates.yml does not exist, create it. If it exists, read first and APPEND to history (preserving prior entries). Gate results are recorded ONLY in gates.yml (not state.yml).

### Step 8: Gate Outcome Handling

**Go** -- "G4 passed." -> Step 9.

**Go-with-advisory** -- Show SHOULD failures. "1. Proceed | 2. Revise". Proceed -> Step 9. Revise -> Step 6.

**Recycle** -- Escalation by count (1st: informational, 2nd: suggest adjustment, 3rd+: recommend override). Revise -> Step 6. Override -> record in gates.yml (overridden: true), write `.expedite/plan/override-context.md` with severity and affected phases/DAs, log override -> Step 9.

### Step 9: Plan Completion

Update state.yml: `phase: "plan_complete"`, current_step null. Write completion checkpoint. Log phase transition. Do NOT populate tasks array or current_wave (execute skill does that).

Display summary: project, intent, artifacts, gate results, plan stats (waves/epics, tasks, TDs), contract chain. "Next: `/expedite:spike <phase>` or `/expedite:execute <phase>`." STOP.
