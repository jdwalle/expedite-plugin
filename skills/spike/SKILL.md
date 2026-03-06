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

Read the following files:

1. **`.expedite/plan/PLAN.md`** -- the implementation plan
2. **`.expedite/state.yml`** -- extract `project_name`, `intent`, `lifecycle_id`
3. **`.expedite/design/DESIGN.md`** -- design decisions for traceability
4. **If `.expedite/plan/override-context.md` exists** -- read it, note affected DAs

5. **CRITICAL (per-phase context):** If spiking Phase N where N > 1, check for prior phase artifacts:
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
5. Read the returned summary and present to user:
   ```
   Research complete for TD-{N}:
   {condensed summary from Task() return}
   ```
6. Record: resolution is the recommendation from research, rationale is the rationale from research, evidence is the output file path.

**CRITICAL: Every resolution (resolved from design, clear-cut spike resolution, user preference, or research) MUST include both the decision AND the rationale.** The rationale is required for SPIKE.md traceability and for G5 gate validation.

After all TDs resolved, display:
```
All {X} tactical decisions resolved. Generating implementation steps...
```

Proceed to Step 6.
