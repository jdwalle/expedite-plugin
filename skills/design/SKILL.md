---
name: design
description: >
  This skill should be used when the user wants to "generate a design",
  "create design document", "design phase", "write RFC", "write PRD",
  or needs to synthesize research evidence into an implementation or product design.
  Supports --override flag to proceed despite gate warnings.
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

# Design Skill

You are the Expedite design orchestrator. Synthesize research evidence into actionable design decisions via agent dispatch. Third stage of the contract chain: scope -> research -> design -> plan.

**Interaction model:** Freeform for revision feedback. AskUserQuestion for structured choices only.

**After completing each step, proceed to the next step automatically.**

**Step tracking (applies to ALL steps):** Before each step, update `current_step` in state.yml using backup-before-write: read state.yml, `cp .expedite/state.yml .expedite/state.yml.bak`, set `current_step` to `{skill: "design", step: N, label: "step-name"}`, set `last_modified`, write back.

**Checkpoint pattern (applies to ALL steps):** After step tracking, write `.expedite/checkpoint.yml`:
```yaml
skill: "design"
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

**Case A: `phase: "research_complete"`** -- "Starting design phase..." Proceed to Step 2.

**Case B: `phase: "research_in_progress"` AND `--override` AND gates.yml has G2 recycle** -- Verify G2 recycle in gates.yml (read `.expedite/gates.yml`, check history for gate: "G2", outcome: "recycle"). Read override-context.md. Record override in gates.yml (append: gate "G2-design-entry", outcome "override"). Display override warning. Proceed to Step 2.

**Case B2: `phase: "design_in_progress"` (no --override)** -- Resume. Check gates.yml for G2 recycle evidence. Checkpoint-based resume: if checkpoint.skill is "design", jump to checkpoint.step. Artifact fallback: DESIGN.md exists -> Step 7; no DESIGN.md -> Step 2. Do NOT re-run Step 3.

**Case C: Any other phase** -- "Error: Research not complete. Run `/expedite:research`." STOP.

### Step 2: Read Scope + Research Artifacts

Read: `.expedite/scope/SCOPE.md` (DAs, depth, readiness), `.expedite/research/SYNTHESIS.md` (findings), `.expedite/state.yml` (project_name, intent, lifecycle_id), `.expedite/research/override-context.md` (if exists). Display loading summary. Verify all DAs from SCOPE.md appear in SYNTHESIS.md. Error if SCOPE.md or SYNTHESIS.md missing -> STOP.

### Step 3: Initialize Design State

Backup-before-write state.yml: set `phase: "design_in_progress"`, current_step, last_modified. Log phase transition to log.yml. `mkdir -p .expedite/design/`. Display: "Design phase initialized."

### Step 4: Generate Design Document (Agent Dispatch)

Assemble context for the design-architect agent:
- project_name, intent from state.yml
- scope_file: `.expedite/scope/SCOPE.md`
- synthesis_file: `.expedite/research/SYNTHESIS.md`
- override_context: `.expedite/research/override-context.md` (if exists)
- output_path: `.expedite/design/DESIGN.md`

Dispatch the `design-architect` agent by name via the Agent tool. Pass the assembled context prompt with all placeholder values filled.

**Validate agent output on return:** Read `.expedite/design/DESIGN.md`. Verify:
1. File exists and is non-empty
2. Contains DA sections (count `### DA-` headings vs SCOPE.md DA count)
3. Header contains correct project_name and intent

If validation fails: display specific error. "Agent design-architect did not produce valid DESIGN.md. Retry? (yes/abort)". On retry: re-dispatch once. On abort or second failure: STOP.

### Step 5: Post-Generation Verification

Read back DESIGN.md. Verify: each DA section has Decision, Evidence, Trade-offs, Confidence subsections. Count matches SCOPE.md. If DA count mismatch, display warning: "WARNING: {N} DAs not addressed." If any subsections missing, display and offer agent re-dispatch.

### Step 6: Generate HANDOFF.md (Product Intent Only)

If intent is "engineering": skip. "No HANDOFF.md needed." -> Step 7.

If intent is "product": Generate HANDOFF.md as distillation of DESIGN.md. 9 sections (Problem Statement, Key Decisions, Scope Boundaries, Success Metrics, User Flows, Acceptance Criteria, Assumptions/Constraints, Suggested Engineering Questions, Priority Ranking). Each 100-200 words, cross-references DESIGN.md. Write to `.expedite/design/HANDOFF.md`. Validate HANDOFF.md shorter than DESIGN.md.

### Step 7: Revision Cycle

Present design for review. Freeform loop:
- **revise** -- parse feedback, apply changes, rewrite DESIGN.md (and HANDOFF.md if product intent sections affected). Re-validate DA coverage. Return to review prompt.
- **proceed** / "looks good" / "lgtm" / "yes" -- proceed to Step 8.

### Step 8: G3 Gate Evaluation

Read DESIGN.md and SCOPE.md. Evaluate with anti-bias: "Evaluate as if someone else produced this."

**MUST criteria:** M1: every DA has design decision. M2: every decision references evidence. M3: correct format for intent (PRD/RFC). M4: DESIGN.md exists, non-empty. M5: evidence citations address DA readiness criteria.

**SHOULD criteria:** S1: trade-offs per DA. S2: confidence levels per DA. S3: open questions genuine. S4: HANDOFF.md exists (product only; auto-PASS for engineering).

Outcomes: Go (all pass), Go-with-advisory (MUST pass, SHOULD fail), Recycle (any MUST fail). Log to log.yml.

**Record gate result to `.expedite/gates.yml`:**
Read existing gates.yml (if any). Append to history array:
```yaml
history:
  - gate: "G3"
    timestamp: "{ISO 8601 UTC}"
    outcome: "{go|go_advisory|recycle|override}"
    evaluator: "design-skill"
    must_passed: {N}
    must_failed: {N}
    should_passed: {N}
    should_failed: {N}
    notes: "{summary or null}"
    overridden: false
```
If gates.yml does not exist, create it. If it exists, read first and APPEND to history (preserving prior entries). Gate results are recorded ONLY in gates.yml (not state.yml).

### Step 9: Gate Outcome Handling

**Go** -- "G3 passed." -> Step 10.

**Go-with-advisory** -- Show SHOULD failures. "1. Proceed | 2. Revise". Proceed -> Step 10. Revise -> Step 7.

**Recycle** -- Escalation by count (1st: informational, 2nd: suggest adjustment, 3rd+: recommend override). Revise -> Step 7. Override -> record in gates.yml (overridden: true), write `.expedite/design/override-context.md` with severity and affected DAs, log override -> Step 10.

### Step 10: Design Completion

Update state.yml: `phase: "design_complete"`, current_step null. Write completion checkpoint. Log phase transition. Display summary: project, intent, artifacts produced, gate results, contract chain status. "Next: `/expedite:plan`." STOP.
