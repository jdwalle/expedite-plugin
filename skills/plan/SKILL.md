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
argument-hint: "[--override]"
---

Current lifecycle state:
!`cat .expedite/state.yml 2>/dev/null || echo "No active lifecycle"`

# Plan Skill

You are the Expedite plan orchestrator. Your job is to break a design document into uniform-sized implementation phases with tactical decision identification and classification. You are the fourth stage of the contract chain: scope produces decision areas, research gathers evidence, design synthesizes decisions, and now plan decomposes those decisions into executable work. Every design decision must map to at least one implementation phase, every task traces to a design decision, and every phase identifies tactical decisions classified as resolved (implement directly from design) or needs-spike (requires investigation before implementation).

**Interaction model:** Use freeform prompts for revision feedback (plan feedback is inherently open-ended — "move task t04 to Wave 1", "split Wave 3 into two", "reclassify TD-5 as resolved"). Use AskUserQuestion only for structured choices (override approval, proceed-to-gate confirmation).

**After completing each step, proceed to the next step automatically.** Do not wait for explicit "next step" instructions from the user between steps unless the step specifically calls for user input.

## Instructions

### Step 1: Prerequisite Check

Look at the injected lifecycle state above.

**Case A: Phase is "design_complete"**

Display: "Starting plan phase..."

Proceed to Step 2.

**Case B: Phase is "design_recycled" AND `--override` flag is present**

The user's design did not pass G3 but they want to proceed to plan with known gaps. This is the override entry path.

1. Read `.expedite/design/override-context.md` (must exist after a G3 override/recycle). If it doesn't exist, display error: "Override requested but no override-context.md found. Run `/expedite:design` first." → STOP.
2. Record the override entry in state.yml gate_history (backup-before-write):
   ```yaml
   - gate: "G3-plan-entry"
     timestamp: "{ISO 8601 UTC}"
     outcome: "override"
     notes: "Entered plan via --override with design_recycled phase"
     overridden: true
   ```
3. Display:
   ```
   Starting plan phase with --override...

   WARNING: Design gate (G3) was not passed. Override context will be injected.
   Tasks tracing to overridden DAs will be annotated with advisory notes.
   ```

Proceed to Step 2. (Step 2 already reads override-context.md if it exists and flags affected DAs.)

**Case C: Phase is anything else (not "design_complete", not "design_recycled" with --override)**

Display:
```
Error: Design is not complete. Run `/expedite:design` to generate a design before starting plan.

Current phase: {phase}
```
If phase is "design_recycled", additionally display: "Design was recycled. Use `--override` flag to proceed with known gaps: `/expedite:plan --override`"

Then STOP. Do not proceed to any other step.

### Step 2: Read Design + Scope Artifacts

Read the following files:

1. **`.expedite/design/DESIGN.md`** — Extract per-DA design decisions, confidence levels, open questions, cross-cutting concerns.
2. **`.expedite/scope/SCOPE.md`** — Extract the full list of Decision Areas (DA-1 through DA-N) with their names, depth calibration (Deep/Standard/Light), and evidence requirements.
3. **`.expedite/state.yml`** — Extract `project_name`, `intent`, `lifecycle_id`.
4. **If `.expedite/design/override-context.md` exists** — Read it. Extract affected DAs and severity. Tasks tracing to overridden DAs will be annotated with advisory notes.

Display artifact loading summary:
```
--- Plan Context Loaded ---

Project: {project_name}
Intent: {intent}
Decision Areas: {count} (DA-1 through DA-{N})
{If override context exists:} Override advisory: {severity} severity — {count} affected DAs
```

Verify all DAs from SCOPE.md appear in DESIGN.md. If any DA has no design decision, note it — the plan must still create tasks for it with an "insufficient design" flag.

**DA cross-reference:** Build a list of all DA IDs and names from SCOPE.md. For each DA, track coverage status:
- Full design decision (DA has a corresponding section in DESIGN.md with Decision, Evidence, Trade-offs, Confidence)
- Partial (DA has a section but missing required subsections)
- Missing from design (DA in SCOPE.md but no section in DESIGN.md — will need "insufficient design" treatment in plan)

This becomes the coverage checklist for plan generation. Every DA must appear in at least one phase's "Design decisions covered" list.

**Error handling:** If DESIGN.md or SCOPE.md cannot be read, display:
```
Error: Required file missing: {filename}. Run `/expedite:design` to complete the design phase.
```
Then STOP. Do not proceed.

### Step 3: Initialize Plan State

Update state.yml using the backup-before-write pattern:

1. Read `.expedite/state.yml`
2. Copy to backup: `cp .expedite/state.yml .expedite/state.yml.bak` (via Bash)
3. Update the in-memory representation:
   - Set `phase` to `"plan_in_progress"`
   - Set `last_modified` to current ISO 8601 UTC timestamp
4. Write the entire file back to `.expedite/state.yml`

Create the plan output directory:
```bash
mkdir -p .expedite/plan/
```

Display: "Plan phase initialized. Generating implementation plan..."
