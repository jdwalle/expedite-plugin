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

**Step tracking (applies to ALL steps):** Before each step: (1) backup-before-write state.yml: read, `cp .expedite/state.yml .expedite/state.yml.bak`, set `last_modified`, write back. (2) Write checkpoint.yml: `skill: "spike", step: N, label: "step-name", substep: null, continuation_notes: null, inputs_hash: null, updated_at: timestamp`.

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

**Case A: `phase: "plan_complete"`** -- "Starting spike..." Write state.yml setting `phase: "spike_in_progress"` using backup-before-write (read state.yml, `cp .expedite/state.yml .expedite/state.yml.bak`, update phase to `spike_in_progress`, update `last_modified`, write back). This uses the existing FSM transition plan_complete -> spike_in_progress (no gate required). Proceed to Step 2.
**Case B: `phase: "execute_in_progress"`** -- "Spiking during execution..." (valid). Phase stays execute_in_progress (re-spike during execution). Proceed to Step 2.
**Case C: Any other** -- "Error: Plan not complete. Run `/expedite:plan`." STOP.

### Step 2: Parse Phase Argument

Extract phase number from user input. Flexible matching: bare number, "wave N", "epic N" (case-insensitive). If no argument: auto-select if single phase, else list available and ask. Determine slug: `wave-{N}` (engineering) or `epic-{N}` (product). Display: "Targeting phase: {slug}"

### Step 3: Read Plan Artifacts

Read: `.expedite/plan/PLAN.md`, `.expedite/state.yml`, `.expedite/design/DESIGN.md`, `.expedite/plan/override-context.md` (if exists). For Phase N > 1: read prior phase SPIKE.md and PROGRESS.md for context. Display loading summary. Error if PLAN.md missing -> STOP.

### Step 4: Extract Phase Definition

From PLAN.md, find matching wave/epic heading. Extract: heading, DA IDs covered, tactical decisions table, tasks/stories. If phase not found: list available, ask user. Classify TDs: resolved vs needs-spike. Display summary.

If this phase has 0 tactical decisions, write checkpoint with `substep: "no_tds_skipping_resolution"`, skip Step 5, and proceed directly to Step 6. The spike still adds value by reading the actual codebase and producing implementation steps with real file paths and line numbers.

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

### Step 7: Write SPIKE.md

`mkdir -p .expedite/plan/phases/{slug}/`. Check for existing SPIKE.md (prompt overwrite). Write spike output: header (phase, TD counts, G5 status), TD resolutions (classification, resolution, rationale, method, evidence), implementation steps (traces-to, files, sub-steps).

**Implementation steps heading format:** Use `#### Step N: [Title]` headings (level 4) for each implementation step. The G5 structural gate's `countImplementationSteps` function scans for bullets/numbered items under an "Implementation Steps" heading and exits when it hits a heading level <= 2. Using `###` or `####` for step headings keeps them within the scanned section. Using `##` would prematurely terminate the scan.

Verify file exists and has content.

### Step 8: G5 Gate Evaluation (Dual-Layer)

**Layer 1: Structural gate** -- deterministic Node.js script. No LLM judgment.

**Invoke structural script:**
Run via Bash: `node ${CLAUDE_PLUGIN_ROOT}/gates/g5-spike.js "$(pwd)" "{slug}"`

The script reads SPIKE.md, PLAN.md, and SCOPE.md, evaluates structural criteria (TD coverage, rationale presence, implementation steps count), writes the structural result to gates.yml, and prints JSON to stdout.

**Read script output:** Parse the JSON stdout. Extract `outcome` and `failures`.

**If structural outcome is "recycle":** The semantic layer does NOT run. Display structural failures. Handle recycle: display issues, fix -> loop to relevant step -> re-run G5. 2nd+ recycle: offer override. Override -> treat as go_advisory.

**If structural outcome is "go" or "go_advisory":** Proceed to Layer 2.

**Simple wave fast path:** If the structural outcome is "go" or "go_advisory" AND the wave has 0 TDs AND <= 2 tasks, skip Layer 2. The structural G5 result is sufficient for simple waves. Write a gates.yml entry:
```yaml
history:
  - gate: "G5"
    timestamp: "{ISO 8601 UTC}"
    outcome: "{structural outcome}"
    evaluator: "g5-structural-only"
    notes: "Spike phase: {slug}. Semantic verification skipped — wave has 0 TDs and <= 2 tasks."
    overridden: false
```
Display: "Semantic gate-verifier skipped (0 TDs, {N} task(s)). Structural G5 result: {outcome}." Proceed to Step 9.

For waves with TDs or > 2 tasks, continue to Layer 2 as normal.

**Layer 2: Semantic verification** -- gate-verifier agent dispatch.

Dispatch the `gate-verifier` agent by name via the Agent tool. Pass:
- `gate_id`: "G5"
- `artifact_path`: ".expedite/plan/phases/{slug}/SPIKE.md"
- `scope_path`: ".expedite/scope/SCOPE.md"
- `context_paths`: ".expedite/design/DESIGN.md, .expedite/plan/PLAN.md"
- `output_file`: ".expedite/plan/phases/{slug}/g5-verification.yml"

**Validate verifier output on return:** Read `.expedite/plan/phases/{slug}/g5-verification.yml`. Verify completeness:
1. File exists and is non-empty
2. All 4 dimensions present: evidence_support, internal_consistency, assumption_transparency, reasoning_completeness
3. Each dimension has numeric `score` between 1 and 5
4. Each dimension has non-empty `reasoning` text
5. `overall.outcome` is one of: "go", "go_advisory", "recycle"

If validation fails: "Gate-verifier produced incomplete evaluation: {missing fields}. Re-run? (yes/skip)". On re-run: re-dispatch once. On skip or second failure: fall back to structural-only result with advisory note.

**Determine combined outcome:** Use the gate-verifier's `overall.outcome` directly as the gate outcome ("go", "go_advisory", or "recycle").

**Record semantic gate result to `.expedite/gates.yml`:**
Read existing gates.yml. Append to history array:
```yaml
history:
  - gate: "G5"
    timestamp: "{ISO 8601 UTC}"
    outcome: "{go|go_advisory|recycle}"
    evaluator: "gate-verifier"
    semantic_scores:
      evidence_support: {N}
      internal_consistency: {N}
      assumption_transparency: {N}
      reasoning_completeness: {N}
    notes: "Spike phase: {slug}. {verifier summary}"
    overridden: false
```

Log gate outcome (both layers) to log.yml. Display: structural pass/fail summary, semantic dimension scores, overall outcome.

**On Go:** Proceed to Step 9.
**On Recycle (structural or semantic):** Display issues. Fix -> loop to relevant step -> re-run G5. 2nd+ recycle: offer override. Override -> treat as go_advisory.

### Step 9: Display Summary

Display: phase, project, G5 status, artifacts, TD breakdown (resolved-from-design / clear-cut / user / researched), step count. Write completion checkpoint. If original phase was plan_complete (Case A from Step 1): write state.yml setting `phase: "spike_complete"` using backup-before-write (read state.yml, `cp .expedite/state.yml .expedite/state.yml.bak`, update phase to `spike_complete`, update `last_modified`, write back). The spike_in_progress -> spike_complete transition requires G5 passage per the FSM; by Step 9, G5 has already been evaluated and passed (Step 8), so the hook will allow this write. "Next: `/expedite:execute {N}`." STOP.

NOTE: Spike writes spike_in_progress at Step 1 and spike_complete at Step 9 (Case A only). When re-spiking during execution (Case B), phase stays execute_in_progress.
