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
  - Task
  - WebSearch
  - WebFetch
argument-hint: "<phase-number>"
---

Current lifecycle state:
!`cat .expedite/state.yml 2>/dev/null || echo "No active lifecycle"`

# Spike Skill

You are the Expedite spike orchestrator. Your job is to resolve tactical decisions identified during planning and produce detailed implementation steps with full traceability. Spike is interactive: you exercise judgment about which tactical decisions are clear-cut (resolve directly) and which are genuinely ambiguous (ask the user). A G5 structural gate validates your output before finalizing. You operate on ONE phase at a time -- each spike invocation resolves one phase's tactical decisions only.

**Interaction model:** Use freeform prompts for user interaction. Do NOT use AskUserQuestion.

**After completing each step, proceed to the next step automatically.** Do not wait for explicit "next step" instructions from the user between steps unless the step specifically calls for user input.

## Instructions

### Step 1: Prerequisite Check

**Step tracking:** Update `current_step` in state.yml (backup-before-write):
1. Read `.expedite/state.yml`
2. Backup: `cp .expedite/state.yml .expedite/state.yml.bak` (via Bash)
3. Set `current_step` to `{skill: "spike", step: 1, label: "Prerequisite Check"}`
4. Set `last_modified` to current timestamp
5. Write the entire file back

Look at the injected lifecycle state above.

**Case A: Phase is "plan_complete"**

Display: "Starting spike..."

Proceed to Step 2.

**Case B: Phase is "execute_in_progress"**

Display: "Spiking during execution..." (Valid: user may spike Phase 2 while executing Phase 1.)

Proceed to Step 2.

**Case C: Phase is anything else**

Display:
```
Error: Plan is not complete. Run `/expedite:plan` to generate an implementation plan before spiking.

Current phase: {phase}
```

Then STOP. Do not proceed to any other step.

### Step 2: Parse Phase Argument

**Step tracking:** Update `current_step` in state.yml (backup-before-write):
1. Read `.expedite/state.yml`
2. Backup: `cp .expedite/state.yml .expedite/state.yml.bak` (via Bash)
3. Set `current_step` to `{skill: "spike", step: 2, label: "Parse Phase Argument"}`
4. Set `last_modified` to current timestamp
5. Write the entire file back

Extract the phase number from user input. Support flexible matching:

- Bare number: "1", "2", "3"
- "wave N" or "Wave N" (engineering intent)
- "epic N" or "Epic N" (product intent)
- Case-insensitive matching: "WAVE 1", "Wave 1", "wave 1" all match

If no argument provided:
1. Read `.expedite/plan/PLAN.md` to count available phases
2. If only one phase exists, auto-select it and display: "Auto-selected the only phase: {phase heading}"
3. If multiple phases exist, display available phases and ask user to choose:
   ```
   Multiple phases available:
   1. {Wave/Epic 1 heading}
   2. {Wave/Epic 2 heading}
   ...

   Which phase would you like to spike?
   ```
   Wait for user input.

Store the extracted phase number. Determine the slug based on intent from state.yml:
- Engineering intent: `wave-{N}` (e.g., `wave-1`, `wave-2`)
- Product intent: `epic-{N}` (e.g., `epic-1`, `epic-2`)

Display: "Targeting phase: {slug}"

### Step 3: Read Plan Artifacts

**Step tracking:** Update `current_step` in state.yml (backup-before-write):
1. Read `.expedite/state.yml`
2. Backup: `cp .expedite/state.yml .expedite/state.yml.bak` (via Bash)
3. Set `current_step` to `{skill: "spike", step: 3, label: "Read Plan Artifacts"}`
4. Set `last_modified` to current timestamp
5. Write the entire file back

Read the following files:

1. **`.expedite/plan/PLAN.md`** -- the implementation plan
2. **`.expedite/state.yml`** -- extract `project_name`, `intent`, `lifecycle_id`
3. **`.expedite/design/DESIGN.md`** -- design decisions for traceability
4. **If `.expedite/plan/override-context.md` exists** -- read it, note affected DAs

5. **CRITICAL (per-phase context):** If spiking Phase N where N > 1, check for prior phase artifacts. Derive the prior-phase slug from intent: `wave-{N-1}` for engineering intent, `epic-{N-1}` for product intent (using the same intent-based slug rule as Step 2).
   - Read `.expedite/plan/phases/{prior-slug}/SPIKE.md` if it exists -- understand what was resolved in the previous phase
   - Read `.expedite/plan/phases/{prior-slug}/PROGRESS.md` if it exists -- understand what was already implemented
   - This enables Phase 2's spike to build on Phase 1's completed work as context

Display artifact loading summary:
```
--- Spike Context Loaded ---

Project: {project_name}
Intent: {intent}
Phase being spiked: {slug}
{If prior phase context found:} Prior phase context: {prior-slug} (SPIKE.md and/or PROGRESS.md loaded)
{If override context exists:} Override advisory: tasks tracing to overridden DAs will be noted
```

**Error handling:** If PLAN.md cannot be read, display:
```
Error: PLAN.md not found. Run `/expedite:plan` to generate an implementation plan.
```
Then STOP. Do not proceed.

### Step 4: Extract Phase Definition

**Step tracking:** Update `current_step` in state.yml (backup-before-write):
1. Read `.expedite/state.yml`
2. Backup: `cp .expedite/state.yml .expedite/state.yml.bak` (via Bash)
3. Set `current_step` to `{skill: "spike", step: 4, label: "Extract Phase Definition"}`
4. Set `last_modified` to current timestamp
5. Write the entire file back

From PLAN.md, find the matching wave/epic heading by number (e.g., "## Wave 2:" or "## Epic 2:").

Extract:
- Phase heading and description
- Design decisions covered (DA IDs)
- Tactical Decisions table (all TDs with classification)
- All tasks/stories in the phase (IDs, titles, design decision references, acceptance criteria)

If the requested phase is not found in PLAN.md, display available phases and ask user to clarify:
```
Phase {N} not found in PLAN.md. Available phases:
1. {Wave/Epic 1 heading}
2. {Wave/Epic 2 heading}
...

Which phase did you mean?
```
Wait for user input. STOP if still ambiguous.

Classify tactical decisions:
- **resolved:** list them, note "No investigation needed"
- **needs-spike:** these are the focus of Step 5

Display summary:
```
Phase {N}: {description}
  {X} tactical decisions ({Y} resolved, {Z} needs-spike)
  {W} tasks
```

### Step 5: Resolve Tactical Decisions

**Step tracking:** Update `current_step` in state.yml (backup-before-write):
1. Read `.expedite/state.yml`
2. Backup: `cp .expedite/state.yml .expedite/state.yml.bak` (via Bash)
3. Set `current_step` to `{skill: "spike", step: 5, label: "Resolve Tactical Decisions"}`
4. Set `last_modified` to current timestamp
5. Write the entire file back

For each tactical decision in the phase:

**If resolved:** Display:
```
TD-{N}: {description}
  Resolved (from design decision DA-{X}: {brief}).
  No investigation needed.
```
Record the resolution and rationale. The rationale is: "Resolved by strategic design decision DA-{X}: {brief description of the design decision}."

**If needs-spike:** Exercise judgment about whether the decision is **clear-cut** or **genuinely ambiguous**:

**Clear-cut indicators** (resolve directly without asking user):
- One alternative is clearly superior given the design context (e.g., the design already chose a framework, and one option aligns with it)
- The tactical decision has a standard/conventional answer in the project's tech stack
- Available context from DESIGN.md, prior SPIKE.md, or override-context.md provides sufficient information to decide confidently

**Genuinely ambiguous indicators** (ask user via freeform prompt):
- Competing alternatives with similar tradeoffs (no clear winner)
- Missing context that only the user/developer would have (team preferences, organizational constraints, existing codebase patterns not visible)
- The decision involves subjective trade-offs (performance vs readability, flexibility vs simplicity)
- User preference is the deciding factor

**For clear-cut needs-spike TDs** (spike resolves directly):

Generate a resolution based on available design context. Display:
```
TD-{N}: {description}
  Resolution: {recommended approach}
  Rationale: {reasoning from design decisions and context}
```
Record the decision and rationale.

**For genuinely ambiguous needs-spike TDs** (ask user):

Present the ambiguity and ask via freeform prompt:
```
TD-{N}: {description}
  Alternatives: {list from PLAN.md}
  DA reference: DA-{X}: {brief}

  This is genuinely ambiguous because: {why -- e.g., "both approaches have similar performance characteristics and the choice depends on your team's familiarity"}

  What's your preference? (Or type "research" to dispatch focused investigation)
```

Wait for user input.

If user provides a preference: record it as the resolution with their reasoning as the rationale.

If user says **research**:
1. Read `skills/spike/references/prompt-spike-researcher.md` (use Glob with `**/prompt-spike-researcher.md` if the direct path fails)
2. Fill placeholders: `{{project_name}}`, `{{intent}}`, `{{tactical_decision}}`, `{{alternatives}}`, `{{da_reference}}`, `{{output_path}}` (output to `.expedite/plan/phases/{slug}/spike-research-td-{N}.md`)
3. Create the output directory: `mkdir -p .expedite/plan/phases/{slug}/`
4. Dispatch via Task() with the filled prompt:
   ```
   Task(
     prompt: {assembled_prompt},
     description: "Spike research: TD-{N} -- {tactical_decision}",
     subagent_type: "general-purpose"
   )
   ```
5. Log agent completion:
   ```bash
   cat >> .expedite/log.yml << 'LOG_EOF'
   ---
   event: agent_completion
   timestamp: "{ISO 8601 UTC}"
   lifecycle_id: "{lifecycle_id}"
   agent_type: "spike-researcher"
   batch_id: "spike-td-{N}"
   questions: ["{TD description}"]
   status: "{complete|failed}"
   LOG_EOF
   ```
6. Read the returned summary and present to user for confirmation:
   ```
   Research complete for TD-{N}:
   {condensed summary from Task() return}

   Accept this recommendation? (yes / override with your own decision)
   ```
6. Wait for user input:
   - If **yes** / **accept**: Record: resolution is the recommendation from research, rationale is the rationale from research, evidence is the output file path.
   - If user provides an **override**: Record user's decision as the resolution, rationale is "User override after reviewing research (see {output_file_path})", evidence is the output file path.

**CRITICAL: Every resolution (resolved from design, clear-cut spike resolution, user preference, or research) MUST include both the decision AND the rationale.** The rationale is required for SPIKE.md traceability and for G5 gate validation.

After all TDs resolved, display:
```
All {X} tactical decisions resolved. Generating implementation steps...
```

Proceed to Step 6.

### Step 6: Generate Implementation Steps

**Step tracking:** Update `current_step` in state.yml (backup-before-write):
1. Read `.expedite/state.yml`
2. Backup: `cp .expedite/state.yml .expedite/state.yml.bak` (via Bash)
3. Set `current_step` to `{skill: "spike", step: 6, label: "Generate Implementation Steps"}`
4. Set `last_modified` to current timestamp
5. Write the entire file back

Generate ordered implementation steps based on:
- The resolved tactical decisions (from Step 5)
- The tasks/stories from the phase definition (from Step 4)
- The design decisions from DESIGN.md
- If prior phase context was loaded (Step 3): account for what was already built

For each implementation step:
- **Step number and title**
- **Traces to:** TD-{N} -> DA-{X} ({DA description})
- **Files:** specific files to create or modify (derived from task definitions in PLAN.md)
- **What to do:** numbered sub-steps with specific implementation guidance, informed by the resolved tactical decisions

Implementation steps should follow the task order from PLAN.md but may be reordered if a resolved tactical decision changes the optimal sequence. Each step must have at least one traceability link (TD -> DA).

If a task in the phase traces to multiple tactical decisions, create one implementation step per task (consolidating the TD references), not one step per TD. The goal is that implementation steps correspond to concrete units of work.

**Self-check before proceeding:**
- [ ] Every resolved tactical decision maps to at least one implementation step
- [ ] Every task from the phase definition is covered by at least one implementation step
- [ ] Every step has a Traces-to link (TD -> DA)
- [ ] File lists are specific (not generic descriptions like "relevant files")

If any check fails, revise the implementation steps before proceeding. Do NOT proceed to the G5 gate with incomplete steps.

### Step 7: G5 Structural Gate

Validate the spike output structurally before writing SPIKE.md. G5 is a structural gate (like G1 and G4) -- deterministic checks, not LLM judgment.

**MUST criteria (all must pass for Go):**

| # | Criterion | How to Check |
|---|-----------|-------------|
| M1 | Every "needs-spike" TD resolved | Count needs-spike TDs from Step 4. Count resolved TDs from Step 5. All needs-spike TDs must have a resolution. State: "Resolved {N}/{M} needs-spike TDs" |
| M2 | Every implementation step traces to a TD or DA | Check each step's "Traces to" field. No step should lack a traceability link. State: "{N}/{M} steps have traceability" |
| M3 | Every resolved TD has a recorded rationale | Check each TD resolution from Step 5. Every resolution must include both a decision and a rationale (not just a decision). State: "{N}/{M} resolutions have rationale" |
| M4 | Step count within phase sizing bounds | Count implementation steps. Expect 3-8 steps (matching plan skill phase sizing bounds for uniform phases). State: "{N} implementation steps (bounds: 3-8)" |

**SHOULD criteria (failures produce advisory, not blockers):**

| # | Criterion | How to Check |
|---|-----------|-------------|
| S1 | Implementation steps add spike-specific guidance | Check that steps tracing to already-resolved TDs (from design) include implementation guidance beyond what was in PLAN.md. State reasoning. |
| S2 | Full task coverage | Every task/story from the phase definition is covered by at least one implementation step. State: "{N}/{M} tasks covered" |
| S3 | File lists are specific paths | Each implementation step's Files field contains specific file paths (not generic descriptions like "relevant files" or "various config files"). State: "{N}/{M} steps have specific file paths" |

**Log gate outcome to telemetry** (after evaluation, before outcome routing):
```bash
cat >> .expedite/log.yml << 'LOG_EOF'
---
event: gate_outcome
timestamp: "{ISO 8601 UTC}"
lifecycle_id: "{lifecycle_id}"
gate: "G5"
outcome: "{go|go_advisory|recycle|override}"
must_passed: {N}
must_failed: {N}
should_passed: {N}
should_failed: {N}
LOG_EOF
```

**Record gate history in state.yml** (backup-before-write):

1. Read `.expedite/state.yml`
2. Copy to backup: `cp .expedite/state.yml .expedite/state.yml.bak` (via Bash)
3. Set `current_step` to `{skill: "spike", step: 7, label: "G5 Structural Gate"}`
4. Append to `gate_history`:
   ```yaml
   - gate: "G5"
     timestamp: "{ISO 8601 UTC}"
     outcome: "{go|go_advisory|recycle|override}"
     must_passed: {N}
     must_failed: {N}
     should_passed: {N}
     should_failed: {N}
     notes: "Spike phase: {slug}"
     overridden: false
   ```
5. Write the entire file back to `.expedite/state.yml`

If the user overrides G5 (recycle with user override), also log:
```bash
cat >> .expedite/log.yml << 'LOG_EOF'
---
event: override
timestamp: "{ISO 8601 UTC}"
lifecycle_id: "{lifecycle_id}"
gate: "G5"
severity: "low"
must_failed: {N}
affected_das: ["{affected DA names from TDs}"]
LOG_EOF
```

**Gate evaluation:**

Run through each MUST criterion. If ALL pass:
- If all SHOULD also pass: **Go** -- display:
  ```
  G5: Go. Spike output validated.
  ```
  Proceed to Step 8.
- If any SHOULD fails: **Go-with-advisory** -- display:
  ```
  G5: Go with advisory.
  ```
  List the SHOULD failures as advisories. Proceed to Step 8.

If ANY MUST fails: **Recycle** -- display:
```
G5: Recycle. Structural issues found:
```
List the failing MUST criteria with specific details (which TD is unresolved, which step is orphaned, which resolution lacks rationale, or step count out of bounds).

**On Recycle:**
- Display the issues clearly
- Track the recycle count (increment each time G5 recycles)
- **If this is the 2nd or later recycle:** Display an override option:
  ```
  G5 has recycled {N} times. Override options:
  - "fix" -- attempt fixes again (loop back to relevant step)
  - "override" -- accept current state with advisory and proceed to write SPIKE.md
  ```
  If user says "override": treat as **Go-with-advisory**, noting the unresolved MUST failures as advisories. Proceed to Step 8.
- Go back to the relevant step to fix:
  - Missing TD resolution -> return to Step 5 for the specific TD
  - Orphan step (no traceability) -> return to Step 6 to add traceability or remove orphan
  - Missing rationale -> return to Step 5 to add rationale
  - Step count out of bounds -> return to Step 6 to merge or split steps
- After fixes, re-run G5 gate (loop back to Step 7)

### Step 8: Write SPIKE.md

**Step tracking:** Update `current_step` in state.yml (backup-before-write):
1. Read `.expedite/state.yml`
2. Backup: `cp .expedite/state.yml .expedite/state.yml.bak` (via Bash)
3. Set `current_step` to `{skill: "spike", step: 8, label: "Write SPIKE.md"}`
4. Set `last_modified` to current timestamp
5. Write the entire file back

Create the output directory:

```bash
mkdir -p .expedite/plan/phases/{slug}/
```

**Check for existing SPIKE.md:** If `.expedite/plan/phases/{slug}/SPIKE.md` already exists, prompt the user:
```
Existing SPIKE.md found for this phase. Overwrite? (yes / no)
```
If **no**: STOP. Display "Spike cancelled. Existing SPIKE.md preserved."
If **yes**: Proceed with overwrite.

Write to `.expedite/plan/phases/{slug}/SPIKE.md` with this format:

```markdown
# Spike: {Wave/Epic} {N} - {description}
Generated: {ISO 8601 UTC timestamp}
Source: PLAN.md {Wave/Epic} {N}
Tactical Decisions: {count} ({resolved_from_design} resolved from design, {resolved_via_spike} resolved via spike)
G5 Gate: {Go | Go-with-advisory}

## Tactical Decisions Resolved

### TD-{N}: {description}
**Classification:** {resolved (from PLAN.md) | was needs-spike, now resolved}
**Resolution:** {the resolution}
**Rationale:** {rationale}
{If was needs-spike:}
**Resolution method:** {Spike judgment (clear-cut) | User decision (ambiguous) | Focused research}
{If researched:} **Evidence:** {path to spike-research-td-N.md}

{... repeat for each TD}

## Implementation Steps

### Step {N}: {title}
**Traces to:** TD-{N} -> DA-{X} ({description})
**Files:** {file list}
**What to do:**
1. {specific sub-step}
2. {specific sub-step}
...

{... repeat for each step}
```

After writing, verify the file exists and has substantive content:
1. Read the file back
2. Check it is non-empty (not just headers)
3. Count sections: should have at least one TD section and at least one implementation step section

If verification fails, display the issue and re-write.

### Step 9: Display Summary

**Step tracking:** Update `current_step` in state.yml (backup-before-write):
1. Read `.expedite/state.yml`
2. Backup: `cp .expedite/state.yml .expedite/state.yml.bak` (via Bash)
3. Set `current_step` to `{skill: "spike", step: 9, label: "Display Summary"}`
4. Set `last_modified` to current timestamp
5. Write the entire file back

Display the spike completion summary:

```
## Spike Complete

Phase: {Wave/Epic} {N} - {description}
Project: {project_name}

### G5 Gate
- Status: {Go | Go-with-advisory}
{If Go-with-advisory:}
- Advisories:
  {list each advisory}

### Artifacts Produced
- Spike: .expedite/plan/phases/{slug}/SPIKE.md
{If any research dispatched:}
- Research evidence:
  {list each spike-research-td-N.md file path}

### Tactical Decisions
- {count} total: {resolved_from_design} resolved from design, {resolved_via_spike} resolved via spike
  - {count_clear_cut} resolved by spike judgment (clear-cut)
  - {count_user} resolved by user input (ambiguous)
  - {count_researched} resolved via focused research

### Implementation Steps
- {count} steps planned
- Contract chain: Scope DA -> Design Decision -> Plan Task -> Spike Step (complete)

### Next Step
Run `/expedite:execute {phase_number}` to begin implementation of this phase.
```

**Clear step tracking:** Update state.yml to clear `current_step` (backup-before-write):
1. Read `.expedite/state.yml`
2. Backup: `cp .expedite/state.yml .expedite/state.yml.bak` (via Bash)
3. Set `current_step` to null
4. Set `last_modified` to current timestamp
5. Write the entire file back

NOTE: Do NOT write **phase transitions** to state.yml. Spike does not have a lifecycle phase (no `spike_in_progress` or `spike_complete`) -- it operates within `plan_complete` or `execute_in_progress`. The output file (SPIKE.md) is the only indicator of spike completion. This is deliberate: spike is optional and phase-scoped, so lifecycle-level state tracking would add unnecessary complexity. However, G5 gate outcomes ARE recorded in gate_history (Step 7) since gate outcomes are events, not phase transitions, and the status skill needs them for the complete G1-G5 gate chain display.
