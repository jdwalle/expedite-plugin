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

**Step tracking:** Update `current_step` in state.yml (backup-before-write):
1. Read `.expedite/state.yml`
2. Backup: `cp .expedite/state.yml .expedite/state.yml.bak` (via Bash)
3. Set `current_step` to `{skill: "plan", step: 1, label: "Prerequisite Check"}`
4. Set `last_modified` to current timestamp
5. Write the entire file back

Look at the injected lifecycle state above.

**Case A: Phase is "design_complete"**

Display: "Starting plan phase..."

Proceed to Step 2.

**Case B: Phase is "design_in_progress" AND `--override` flag is present AND gate_history contains at least one G3 recycle entry**

The user's design gate recycled, they exited the session, and are now re-entering with --override to proceed to plan with known gaps.

1. Verify gate_history contains at least one entry where `gate: "G3"` and `outcome: "recycle"`.
   If no G3 recycle found, display error: "Override requested but no G3 recycle found in gate history. Run `/expedite:design` first." -> STOP.
2. Read `.expedite/design/override-context.md` (must exist after a G3 override/recycle). If it doesn't exist, display error: "Override requested but no override-context.md found. Run `/expedite:design` first." -> STOP.
3. Record the override entry in state.yml gate_history (backup-before-write):
   ```yaml
   - gate: "G3-plan-entry"
     timestamp: "{ISO 8601 UTC}"
     outcome: "override"
     notes: "Entered plan via --override with design_in_progress phase and G3 recycle evidence"
     overridden: true
   ```
4. Display:
   ```
   Starting plan phase with --override...

   WARNING: Design gate (G3) was not passed. Override context will be injected.
   Tasks tracing to overridden DAs will be annotated with advisory notes.
   ```

Proceed to Step 2. (Step 2 already reads override-context.md if it exists and flags affected DAs.)

**Case B2: Phase is "plan_in_progress" AND `--override` flag is NOT present**

This is a resume scenario. The plan skill was running when the session ended.

1. First, check gate_history for G3 recycle entries (entries where `gate: "G3"` and `outcome: "recycle"`).

   **If G3 recycle evidence IS found:** The plan was in progress after an override entry, and the user may want either crash resume or override re-entry. Display:
   ```
   Found in-progress plan for "{project_name}".

   It appears your design gate (G3) was recycled in a prior session.
   You can resume the plan revision, or use --override to proceed with known gaps.

   Options:
   1. Resume plan from where you left off
   2. Re-enter with --override: `/expedite:plan --override`
   ```
   Wait for user response. If they choose resume, continue with the artifact check below. If they indicate --override, display: "Please re-invoke with the --override flag: `/expedite:plan --override`" then STOP.

   **If NO G3 recycle evidence:** This is a pure crash resume. Continue with the artifact check below.

2. Check for `.expedite/plan/PLAN.md`:
   - If PLAN.md exists: Step 5 completed. Resume at Step 6 (revision cycle). Display: "Found in-progress plan with PLAN.md already generated. Resuming at revision cycle..."
   - If PLAN.md does not exist: Resume at Step 2 (read artifacts, then generate). Display: "Found in-progress plan, but no PLAN.md yet. Resuming from artifact loading..."

3. Display:
```
Found in-progress plan for "{project_name}".

Plan document: {exists/not yet generated}
Resume point: Step {2 or 6}
```

4. Proceed directly to the resume step. Do NOT re-run Step 3 (state transition) since state is already plan_in_progress.

**Case C: Phase is anything else (not "design_complete", not matching Case B or B2 conditions)**

Display:
```
Error: Design is not complete. Run `/expedite:design` to generate a design before starting plan.

Current phase: {phase}
```
Then STOP. Do not proceed to any other step.

### Step 2: Read Design + Scope Artifacts

**Step tracking:** Update `current_step` in state.yml (backup-before-write):
1. Read `.expedite/state.yml`
2. Backup: `cp .expedite/state.yml .expedite/state.yml.bak` (via Bash)
3. Set `current_step` to `{skill: "plan", step: 2, label: "Read Design + Scope Artifacts"}`
4. Set `last_modified` to current timestamp
5. Write the entire file back

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
   - Set `current_step` to `{skill: "plan", step: 3, label: "Initialize Plan State"}`
   - Set `last_modified` to current ISO 8601 UTC timestamp
4. Write the entire file back to `.expedite/state.yml`

5. Log phase transition:
   ```bash
   cat >> .expedite/log.yml << 'LOG_EOF'
   ---
   event: phase_transition
   timestamp: "{ISO 8601 UTC}"
   lifecycle_id: "{lifecycle_id}"
   from_phase: "design_complete"
   to_phase: "plan_in_progress"
   LOG_EOF
   ```

Create the plan output directory:
```bash
mkdir -p .expedite/plan/
```

Display: "Plan phase initialized. Generating implementation plan..."

### Step 4: Generate Implementation Plan

**Step tracking:** Update `current_step` in state.yml (backup-before-write):
1. Read `.expedite/state.yml`
2. Backup: `cp .expedite/state.yml .expedite/state.yml.bak` (via Bash)
3. Set `current_step` to `{skill: "plan", step: 4, label: "Generate Implementation Plan"}`
4. Set `last_modified` to current timestamp
5. Write the entire file back

This is inline generation in the main session — the plan is generated here, not dispatched to a subagent. Read `skills/plan/references/prompt-plan-guide.md` as a quality reference (use Glob with `**/prompt-plan-guide.md` if the direct path fails). The plan guide defines the required sections, quality criteria, and contract chain enforcement — but is NOT dispatched as a subagent. Its instructions guide the inline generation.

Generate the implementation plan following the correct format for the declared intent. The format is determined by the `intent` field from state.yml.

**If intent is "engineering"** — Wave-ordered format:

For each wave:
- Wave heading: `## Wave {N}: {description}`
- Design decisions covered: list DA IDs
- Tactical Decisions table:

```markdown
### Tactical Decisions
| ID | Decision | Classification | Source |
|----|----------|----------------|--------|
| TD-1 | {specific tactical decision} | resolved/needs-spike | DA-X: {brief source} |
```

- Tasks (t01, t02, etc.) with:
  - **Design decision:** DA reference
  - **Files:** specific files to create or modify
  - **Acceptance criteria:** with parenthetical DA traceability `*(traces to DA-X decision: {brief})*`
  - **Estimated effort:** hours (2-8 hours per task; larger tasks should be split)
  - **Dependencies:** task IDs, or "none"

Key rules from prompt-plan-guide.md:
- Tasks within a wave can execute independently (no intra-wave dependencies)
- Cross-wave dependencies explicitly listed (task IDs)
- Wave 1 has zero external dependencies
- Every design decision must appear in at least one task's "Design decision" field
- Every acceptance criterion must cite the design decision it traces to (in parenthetical)

**If intent is "product"** — Epic/Story format:

For each epic:
- Epic heading: `## Epic {N}: {user-facing capability}`
- Design decisions covered: list DA IDs
- Tactical Decisions table (same format as engineering):

```markdown
### Tactical Decisions
| ID | Decision | Classification | Source |
|----|----------|----------------|--------|
| TD-1 | {specific tactical decision} | resolved/needs-spike | DA-X: {brief source} |
```

- Stories (1.1, 1.2, etc.) with:
  - **As a** [persona] **I want** [capability] **so that** [outcome]
  - **Design decision:** DA reference
  - **Acceptance criteria:** in Given/When/Then format with parenthetical DA traceability `*(traces to DA-X decision: {brief})*`
  - **Priority:** P0 | P1 | P2
  - **Sizing:** S | M | L | XL

**Tactical Decision Classification:**

A tactical decision is something that: (a) is not fully resolved by the DESIGN.md decision text, (b) affects the implementation approach of at least one task, and (c) has at least two reasonable alternatives. Apply these criteria to classify each tactical decision:

- **Resolved:** The DESIGN.md decision provides enough specificity to implement directly. The design explicitly chose an approach, library, API, or pattern. No further investigation needed. Examples: "Use PostgreSQL for storage" (DA decided this), "RFC format uses wave-ordered tasks" (design specified format).
- **Needs-spike:** The DESIGN.md decision sets direction but leaves implementation details unresolved. There are at least two reasonable alternative approaches not fully resolved by the design. The spike skill will investigate these before execution. Examples: "Use caching (but which strategy — LRU vs TTL?)", "Support backward compatibility (but which migration path?)", "Handle concurrent writes (but which locking mechanism?)".

TD IDs are phase-scoped: each wave/epic starts at TD-1. For cross-reference, use "Wave 2 TD-1" or "Epic 2 TD-1" format. This avoids renumbering headaches when phases are reordered.

**Phase Sizing Enforcement:**

Each phase MUST contain 2-5 tactical decisions and 3-8 tasks/stories. This ensures uniform sizing across phases:
- If a design decision requires 10+ tasks, split across 2 phases with logical grouping (e.g., "Wave 3a: core implementation", "Wave 3b: edge cases and testing")
- If a design decision requires only 1 task, group it with related DAs in the same phase
- Self-check sizing before proceeding to Step 5

**Cross-cutting concerns:** Open questions from DESIGN.md's "Open Questions" section should become tactical decisions classified as "needs-spike" in the relevant phase. Cross-cutting concerns from DESIGN.md (error handling, logging, security, performance, testing strategy) should be addressed as tasks within relevant phases or as a dedicated cross-cutting wave/epic.

**Override-affected DAs:** If design override-context.md exists (loaded in Step 2), tasks tracing to overridden DAs must include an advisory note: "Advisory: This DA was affected by a G3 override. Evidence gaps noted in override-context.md."

**Contract chain enforcement (both intents):**
- Every DA from SCOPE.md MUST map to at least one phase's "Design decisions covered" list
- Every task/story MUST cite a specific design decision (not generic)
- Every acceptance criterion MUST include parenthetical DA traceability
- If evidence is insufficient for a DA (from override context), annotate tasks with advisory note

**Self-check before writing:** Before proceeding to Step 5, verify the generated content against these criteria:
- [ ] Every DA from SCOPE.md has at least one phase covering it (count DAs in scope vs unique DAs in plan)
- [ ] Every phase has 2-5 tactical decisions and 3-8 tasks
- [ ] Every tactical decision is classified as resolved or needs-spike
- [ ] Every task/story cites a specific design decision
- [ ] Every acceptance criterion includes parenthetical DA reference
- [ ] Wave/epic ordering is logical (Wave 1/Epic 1 has no external dependencies)
- [ ] Override-affected DAs (if any) are annotated

If any check fails, revise the content before writing to disk. Do NOT write a plan that fails self-check.

### Step 5: Write PLAN.md

**Step tracking:** Update `current_step` in state.yml (backup-before-write):
1. Read `.expedite/state.yml`
2. Backup: `cp .expedite/state.yml .expedite/state.yml.bak` (via Bash)
3. Set `current_step` to `{skill: "plan", step: 5, label: "Write PLAN.md"}`
4. Set `last_modified` to current timestamp
5. Write the entire file back

Write the generated plan to `.expedite/plan/PLAN.md`.

Document header (both formats):
```markdown
# {Implementation Plan | Product Plan}: {project_name}
Generated: {ISO 8601 UTC timestamp}
Intent: {Engineering | Product}
Source: DESIGN.md + SCOPE.md
Phases: {N} | Tasks: {M} | Tactical Decisions: {K} ({resolved}/{needs-spike})
```

Summary footer (engineering):
```
--- {N} tasks across {M} waves ---
Design decisions covered: {count}/{total}
Total estimated effort: {hours}
Acceptance criteria: {count} total, all traced to design decisions
Tactical decisions: {resolved} resolved, {needs-spike} needs-spike
```

Summary footer (product):
```
--- {N} stories across {M} epics ---
Design decisions covered: {count}/{total}
Acceptance criteria: {count} total, all traced to design decisions
Tactical decisions: {resolved} resolved, {needs-spike} needs-spike
```

After writing, display plan summary:
```
--- Plan Summary ---

Project: {project_name}
Intent: {intent}
{Waves | Epics}: {count}
{Tasks | Stories}: {count}
DA coverage: {covered}/{total}
Tactical decisions: {resolved} resolved, {needs-spike} needs-spike
{If engineering:} Estimated effort: {hours} hours
```

If DA coverage is not complete (covered < total), display WARNING with the list of missing DAs.

**Post-write verification:** After writing PLAN.md, read it back and verify:
1. File exists and is non-empty
2. Header contains correct project_name, intent, timestamp
3. Count wave/epic sections and compare to expected
4. Count tasks/stories
5. Verify each phase has a Tactical Decisions table
6. Verify phase sizing (2-5 TDs, 3-8 tasks per phase)
7. Count DA coverage (unique DAs in all "Design decisions covered" lists vs SCOPE.md DA count)

If verification fails on any check, display the specific failure and fix the content before re-writing. Do NOT proceed to Step 6 with a malformed PLAN.md.

### Step 6: Revision Cycle

**Step tracking:** Update `current_step` in state.yml (backup-before-write):
1. Read `.expedite/state.yml`
2. Backup: `cp .expedite/state.yml .expedite/state.yml.bak` (via Bash)
3. Set `current_step` to `{skill: "plan", step: 6, label: "Revision Cycle"}`
4. Set `last_modified` to current timestamp
5. Write the entire file back

Present the plan to the user for review. This is a freeform revision loop with no hard round limit -- the user keeps revising until satisfied, then proceeds to gate evaluation.

**6a: Present plan for review.** Display:

```
--- Plan Review ---

The implementation plan has been written to .expedite/plan/PLAN.md

Review the plan above. You can:
- **revise** -- describe changes (e.g., "move task t04 to Wave 1", "split Wave 3 into two", "reclassify TD-5 as resolved")
- **proceed** -- run G4 gate evaluation on the current plan

What would you like to do?
```

Wait for user input.

**6b: On "revise" (user provides feedback):**

1. Parse freeform feedback. Identify which phases, tasks, or tactical decisions they want changed.
2. Apply changes to the in-memory plan.
3. Summarize changes before rewriting:

```
Changes applied:
- Wave/Epic {N}: {brief description of change}
- {additional changes}
```

4. Rewrite `.expedite/plan/PLAN.md` with updated content.
5. Re-validate: verify DA coverage still complete (every DA from SCOPE.md in at least one phase). If any DA accidentally removed, display warning and restore.
6. Re-validate: verify phase sizing still within bounds (2-5 TDs, 3-8 tasks). If any phase out of bounds, display warning.
7. Return to 6a.

**6c: On "proceed":**

Display: "Proceeding to G4 gate evaluation..."

Proceed to Step 7.

**Key behaviors** (identical to design skill):
- No round counter. No "you have N revisions remaining" messaging.
- Every iteration presents both "revise" and "proceed" options.
- "looks good", "done", "approved", "no changes", "yes", "lgtm" = proceed
- "skip" or "skip to gate" = proceed
- Ambiguous feedback: ask for clarification rather than guessing.

Plan-specific revision types:
- Reorder tasks between waves/epics
- Split or merge phases
- Reclassify tactical decisions (resolved <-> needs-spike)
- Adjust phase boundaries (which DAs in which phase)
- Add/remove tasks or stories
- Modify acceptance criteria

### Step 7: G4 Gate Evaluation

**Step tracking:** Update `current_step` in state.yml (backup-before-write):
1. Read `.expedite/state.yml`
2. Backup: `cp .expedite/state.yml .expedite/state.yml.bak` (via Bash)
3. Set `current_step` to `{skill: "plan", step: 7, label: "G4 Gate Evaluation"}`
4. Set `last_modified` to current timestamp
5. Write the entire file back

Read `.expedite/plan/PLAN.md` and `.expedite/scope/SCOPE.md` (for DA reference).

This is a **structural gate** -- all checks are deterministic (counts, field existence, string matching). Do NOT apply LLM judgment. For each criterion, state the specific evidence from the artifacts.

**MUST criteria (all must pass for Go):**

| # | Criterion | How to Check | Result |
|---|-----------|-------------|--------|
| M1 | Every DA covered by at least one phase | Count DAs in SCOPE.md, count unique DAs in all "Design decisions covered" lists in PLAN.md. State: "Found {N}/{M} DAs covered" | PASS/FAIL |
| M2 | Phase sizing within bounds | For each phase: count tactical decisions (expect 2-5) and tasks/stories (expect 3-8). State: "Phase {X}: {N} tactical decisions, {M} tasks" for any out-of-bounds phase | PASS/FAIL |
| M3 | Tactical decisions listed per phase | Each phase has a "Tactical Decisions" table with at least one entry, each classified as resolved or needs-spike. State: "{N}/{M} phases have tactical decision tables" | PASS/FAIL |
| M4 | Acceptance criteria trace to design decisions | Each acceptance criterion includes parenthetical DA reference matching `*(traces to DA-*`. State: "{N}/{M} criteria have traceability" | PASS/FAIL |
| M5 | PLAN.md exists and is non-empty | File exists with substantive content (not just headers). State: "PLAN.md: {line_count} lines" | PASS/FAIL |

**SHOULD criteria (failures produce advisory, do not block):**

| # | Criterion | How to Check | Result |
|---|-----------|-------------|--------|
| S1 | Wave/epic ordering is logical | Check that Wave 1 / Epic 1 has no external dependencies, subsequent phases build on prior ones. State reasoning. | PASS/ADVISORY |
| S2 | Effort estimates present (engineering) or sizing present (product) | Check each task/story has effort/sizing field. State: "{N}/{M} tasks have estimates" | PASS/ADVISORY |
| S3 | No orphan tasks | Every task/story traces to at least one DA via "Design decision" field. State: "{N} tasks without DA reference" | PASS/ADVISORY |
| S4 | Override-affected DAs flagged | If `.expedite/design/override-context.md` exists, check affected DAs are annotated in plan. Auto-PASS if no override context file exists. | PASS/ADVISORY |
| S5 | Task coverage reflects DA depth calibration | Read SCOPE.md DA depth levels (Deep/Standard/Light). For each depth level, count how many tasks or acceptance criteria cover DAs at that level. Check that no Deep DA has fewer tasks or acceptance criteria than any Light DA. State: "Deep DAs: {DA-list with task counts}. Light DAs: {DA-list with task counts}. Depth-proportional: {yes|advisory}" | PASS/ADVISORY |

Note: S5 uses task count as a heuristic for implementation depth. A Deep DA with fewer tasks than a Light DA is suspicious but may be valid (e.g., one complex task vs many simple ones). The advisory acknowledges this: "This may be intentional if the Deep DA's tasks are individually complex."

Display gate results:

```
--- G4 Gate Evaluation ---
(Structural evaluation -- deterministic criteria)

MUST Criteria:
  M1: {PASS|FAIL} -- {evidence}
  M2: {PASS|FAIL} -- {evidence}
  M3: {PASS|FAIL} -- {evidence}
  M4: {PASS|FAIL} -- {evidence}
  M5: {PASS|FAIL} -- {evidence}

SHOULD Criteria:
  S1: {PASS|ADVISORY} -- {evidence}
  S2: {PASS|ADVISORY} -- {evidence}
  S3: {PASS|ADVISORY} -- {evidence}
  S4: {PASS|ADVISORY} -- {evidence}
  S5: {PASS|ADVISORY} -- {evidence}

Gate Outcome: {Go | Go-with-advisory | Recycle}
```

**Gate outcomes:**
- **Go**: All MUST pass AND all SHOULD pass
- **Go-with-advisory**: All MUST pass, one or more SHOULD failures
- **Recycle**: Any MUST criterion fails
- **Override**: Only when user explicitly requests (not auto-determined)

**Log gate outcome to telemetry** (after evaluation, before outcome routing):
```bash
cat >> .expedite/log.yml << 'LOG_EOF'
---
event: gate_outcome
timestamp: "{ISO 8601 UTC}"
lifecycle_id: "{lifecycle_id}"
gate: "G4"
outcome: "{go|go_advisory|recycle|override}"
must_passed: {N}
must_failed: {N}
should_passed: {N}
should_failed: {N}
LOG_EOF
```

Proceed to Step 8.

### Step 8: Gate Outcome Handling

**8a: Record gate history.** Append to `gate_history` in state.yml (backup-before-write). In the same write, also set `current_step` to `{skill: "plan", step: 8, label: "Gate Outcome Handling"}`:

```yaml
- gate: "G4"
  timestamp: "{ISO 8601 UTC}"
  outcome: "{go|go_advisory|recycle|override}"
  must_passed: {count}
  must_failed: {count}
  should_passed: {count}
  should_failed: {count}
  notes: "{brief summary}"
  overridden: false
```

**8b: Route by outcome:**

**Go** -- Display "G4 gate passed. Plan is ready for execution." Proceed to Step 9.

**Go-with-advisory** -- Show which SHOULD criteria failed. Present via freeform prompt: "1. Proceed with advisory | 2. Revise to address advisories". If proceed, proceed to Step 9. If revise, return to Step 6 (revision cycle).

**Recycle** -- Count previous G4 recycle outcomes in gate_history (entries where `gate` = `"G4"` AND `outcome` = `"recycle"`).

- **1st Recycle (recycle_count == 0):** Informational tone. Display which MUST criteria failed with specific evidence. Offer via freeform prompt: "1. Revise (fix the issues above) | 2. Override (proceed with documented gaps)". If revise, return to Step 6 with gate feedback visible. If override, proceed to 8c.

- **2nd Recycle (recycle_count == 1):** Suggest adjustment. Display: "This is the second G4 recycle. Consider whether the plan structure needs adjustment." Show persistently failing criteria. Offer: "1. Revise | 2. Override (recommended if same criteria keep failing)". If revise, return to Step 6. If override, proceed to 8c.

- **3rd+ Recycle (recycle_count >= 2):** Recommend override. Display: "This is recycle #{recycle_count + 1}. Recommend overriding the gate. Remaining issues may require scope adjustment rather than plan revision." Offer: "1. Override (recommended) | 2. One more attempt (not recommended)". If override, proceed to 8c. If attempt, return to Step 6.

**8c: Override handling.**

1. Update gate_history entry: set `overridden` to `true`, update `outcome` to `"override"`.
2. Determine severity: low (0 MUST failures -- user-initiated), medium (1 MUST failure), high (2+ MUST failures).
3. Write `.expedite/plan/override-context.md`:

```markdown
# G4 Override Context

Timestamp: {ISO 8601 UTC}
Severity: {low|medium|high}
Recycle count: {N}

## Overridden Issues

{For each failed MUST criterion:}
- {criterion_id}: {criterion description}
  Evidence: {what the gate found}
  Impact: {which phases/DAs are affected}

## Spike/Execute Phase Advisory

The following plan quality issues were overridden. The spike and execute
phases should account for these gaps.
{List affected criteria and recommendations}
```

4. Log override event:
   ```bash
   cat >> .expedite/log.yml << 'LOG_EOF'
   ---
   event: override
   timestamp: "{ISO 8601 UTC}"
   lifecycle_id: "{lifecycle_id}"
   gate: "G4"
   severity: "{low|medium|high}"
   must_failed: {N}
   affected_das: ["{affected DA names}"]
   LOG_EOF
   ```

5. Proceed to Step 9.

### Step 9: Plan Completion

Update state.yml (backup-before-write): set `current_step` to null, set `phase` to `"plan_complete"`, update `last_modified`.

**Log phase transition:**
```bash
cat >> .expedite/log.yml << 'LOG_EOF'
---
event: phase_transition
timestamp: "{ISO 8601 UTC}"
lifecycle_id: "{lifecycle_id}"
from_phase: "plan_in_progress"
to_phase: "plan_complete"
LOG_EOF
```

NOTE: Do NOT populate the `tasks` array or `current_wave` field in state.yml. These fields exist in the schema but are populated by the execute skill, not the plan skill. The plan skill produces PLAN.md as its artifact; the execute skill reads PLAN.md and creates task-tracking state.

Display plan completion summary:

```
## Plan Complete

Project: {project_name}
Intent: {intent}

### Artifacts Produced
- Plan: .expedite/plan/PLAN.md
{If override:} - Override context: .expedite/plan/override-context.md

### Gate Results
G4 outcome: {outcome}
MUST: {passed}/{total} | SHOULD: {passed}/{total}
{If advisory:} Advisories: {list SHOULD failures}
{If override:} Override severity: {severity}

### Plan Summary
{intent == engineering: Waves | intent == product: Epics}: {count}
Tasks: {count}
Tactical decisions: {resolved} resolved, {needs-spike} needs-spike

### Contract Chain
Scope -> Research -> Design -> Plan (complete)
Decision Areas: {N} planned | Design decisions traced: {count}

### Next Step
Run `/expedite:spike <phase>` to investigate tactical decisions, or `/expedite:execute <phase>` to begin implementation.
```
