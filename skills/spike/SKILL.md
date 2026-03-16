---
name: spike
description: >
  This skill should be used when the user wants to "spike a phase",
  "investigate tactical decisions", "plan implementation steps",
  "resolve tactical decisions", or needs to investigate and plan
  detailed implementation for a specific plan phase before execution.
allowed-tools:
  - Read
  - Write
  - Glob
  - Bash
  - Agent
argument-hint: "<phase-number>"
---

Current lifecycle state:
!`cat .expedite/state.yml 2>/dev/null || echo "No active lifecycle"`

Checkpoint:
!`cat .expedite/checkpoint.yml 2>/dev/null || echo "No checkpoint"`

Session context:
!`cat .expedite/session-summary.md 2>/dev/null`

Override protocol:
!`cat skills/shared/ref-override-protocol.md 2>/dev/null || echo "No override protocol found"`

# Spike Skill

You are the Expedite spike orchestrator. Resolve tactical decisions for ONE plan phase, producing detailed implementation steps with full traceability. Interactive: exercise judgment on clear-cut vs ambiguous TDs. Dispatch spike-researcher agent for research requests. G5 validates output.

**Interaction model:** Freeform prompts only. Do NOT use AskUserQuestion.

**After completing each step, proceed to the next step automatically.**

**Step tracking (applies to ALL steps):** Before each step, update `current_step` in state.yml using backup-before-write: read state.yml, `cp .expedite/state.yml .expedite/state.yml.bak`, set `current_step` to `{skill: "spike", step: N, label: "step-name"}`, set `last_modified`, write back.

**Checkpoint pattern (applies to ALL steps):** After step tracking, write `.expedite/checkpoint.yml`:
```yaml
skill: "spike"
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

**State Recovery Preamble:** If "No active lifecycle": follow `skills/shared/ref-state-recovery.md`. Recovery fails -> "Run /expedite:scope." STOP.

If checkpoint shows `skill: "spike"`: display informational resume context (spike always re-runs from phase argument).

**Case A: `phase: "plan_complete"`** -- "Starting spike..." Proceed to Step 2.
**Case B: `phase: "execute_in_progress"`** -- "Spiking during execution..." (valid). Proceed to Step 2.
**Case C: Any other** -- "Error: Plan not complete. Run `/expedite:plan`." STOP.

### Step 2: Parse Phase Argument

Extract phase number from user input. Flexible matching: bare number, "wave N", "epic N" (case-insensitive). If no argument: auto-select if single phase, else list available and ask. Determine slug: `wave-{N}` (engineering) or `epic-{N}` (product). Display: "Targeting phase: {slug}"

### Step 3: Read Plan Artifacts

Read: `.expedite/plan/PLAN.md`, `.expedite/state.yml`, `.expedite/design/DESIGN.md`, `.expedite/plan/override-context.md` (if exists). For Phase N > 1: read prior phase SPIKE.md and PROGRESS.md for context. Display loading summary. Error if PLAN.md missing -> STOP.

### Step 4: Extract Phase Definition

From PLAN.md, find matching wave/epic heading. Extract: heading, DA IDs covered, tactical decisions table, tasks/stories. If phase not found: list available, ask user. Classify TDs: resolved vs needs-spike. Display summary.

### Step 5: Resolve Tactical Decisions

Update checkpoint substep as each TD resolves: `substep: "resolving_td_{N}"`.

For each TD in the phase:

**If resolved (from design):** Display resolution and DA source. Record with rationale.

**If needs-spike:** Assess clear-cut vs genuinely ambiguous:

- **Clear-cut** (one alternative clearly superior, standard answer, sufficient context): resolve directly with rationale referencing design context.
- **Genuinely ambiguous** (competing tradeoffs, missing user context, subjective): present to user via freeform. Options: provide preference, or type "research".

**If user says "research":** `mkdir -p .expedite/plan/phases/{slug}/`. Dispatch the `spike-researcher` agent by name via the Agent tool. Pass: project_name, intent, tactical_decision, alternatives, da_reference. Output path: `.expedite/plan/phases/{slug}/spike-research-td-{N}.md`.

**Validate agent output on return:** Verify spike-research-td-{N}.md exists and is non-empty. If missing: "Agent spike-researcher did not produce output. Retry? (yes/skip)". On retry: re-dispatch once. On skip: mark as user-decided.

Present research result. "Accept recommendation? (yes / override with your own)". Record resolution with rationale and evidence file path.

After all TDs: "All {X} tactical decisions resolved. Generating implementation steps..."

### Step 6: Generate Implementation Steps

Generate ordered steps using resolved TDs, phase tasks, and design decisions. Each step has: number/title, traces-to (TD -> DA), files, numbered sub-steps. Self-check: every TD maps to a step, every task covered, all have traceability, file lists are specific paths.

### Step 7: G5 Structural Gate

Deterministic checks, no LLM judgment.

**MUST:** M1: every needs-spike TD resolved. M2: every step traces to TD or DA. M3: every resolution has rationale. M4: step count 3-8.

**SHOULD:** S1: steps add spike-specific guidance. S2: full task coverage. S3: file lists are specific paths. S4: resolutions address specific ambiguity.

Log to log.yml.

**Record gate result to `.expedite/gates.yml`:**
Read existing gates.yml (if any). Append to history array:
```yaml
history:
  - gate: "G5"
    timestamp: "{ISO 8601 UTC}"
    outcome: "{go|go_advisory|recycle|override}"
    evaluator: "spike-skill"
    must_passed: {N}
    must_failed: {N}
    should_passed: {N}
    should_failed: {N}
    notes: "Spike phase: {slug}"
    overridden: false
```
If gates.yml does not exist, create it. If it exists, read first and APPEND to history (preserving prior entries). Gate results are recorded ONLY in gates.yml (not state.yml).

**On Recycle:** Display issues. Fix -> loop to relevant step -> re-run G5. 2nd+ recycle: offer override. Override -> treat as go-with-advisory.

### Step 8: Write SPIKE.md

`mkdir -p .expedite/plan/phases/{slug}/`. Check for existing SPIKE.md (prompt overwrite). Write spike output: header (phase, TD counts, G5 status), TD resolutions (classification, resolution, rationale, method, evidence), implementation steps (traces-to, files, sub-steps). Verify file exists and has content.

### Step 9: Display Summary

Display: phase, project, G5 status, artifacts, TD breakdown (resolved-from-design / clear-cut / user / researched), step count. Clear current_step to null. Write completion checkpoint. "Next: `/expedite:execute {N}`." STOP.

NOTE: Spike does NOT write phase transitions (no spike_in_progress/spike_complete phases). It operates within plan_complete or execute_in_progress. Gate outcomes are recorded in gates.yml.
