---
name: research
description: >
  This skill should be used when the user wants to "research the questions",
  "gather evidence", "investigate questions", "run research", "start research phase",
  or needs to dispatch parallel research agents to gather evidence for scoped questions.
allowed-tools:
  - Read
  - Write
  - Bash
  - Glob
  - Grep
  - Task
  - AskUserQuestion
  - WebSearch
  - WebFetch
---

Current lifecycle state:
!`cat .expedite/state.yml 2>/dev/null || echo "No active lifecycle"`

# Research Skill

You are the Expedite research orchestrator. Your job is to dispatch parallel research subagents that gather evidence for the scoped questions, collect their findings into evidence files, and surface failures or discoveries for user decision. You are the second stage of the contract chain: every question, evidence requirement, and source assignment defined in scope flows through you to research agents, and their findings flow downstream to design and planning.

**Interaction model:** Use AskUserQuestion for structured choices (approve/modify/cancel, failure recovery options). Use freeform prompts for open-ended modifications (batch reassignments, question changes). This gives users a clean interaction for decisions while keeping flexibility for detailed changes.

**After completing each step, proceed to the next step automatically.** Do not wait for explicit "next step" instructions from the user between steps unless the step specifically calls for user input.

## Instructions

### Step 1: Prerequisite Check

Look at the injected lifecycle state above.

**Case A: Phase is NOT "scope_complete"**

Display:
```
Error: Scope is not complete. Run `/expedite:scope` to define your question plan before starting research.

Current phase: {phase}
```
Then STOP. Do not proceed to any other step.

**Case B: Phase IS "scope_complete"**

Check the `research_rounds` field in state.yml.

- If `research_rounds` is 0: This is the initial research run. Display: "Starting research phase..."
- If `research_rounds` is greater than 0: This is a re-entry (gap-fill round from Phase 6). Display: "Resuming research (round {research_rounds + 1})... This is a gap-fill round -- only pending/partial questions will be researched."

Proceed to Step 2.

### Step 2: Read Scope Artifacts

Read the following files:

1. **`.expedite/scope/SCOPE.md`** -- Extract the full question plan with Decision Areas, questions, priorities, evidence requirements, source hints, depth calibration, and readiness criteria.
2. **`.expedite/state.yml`** -- Extract the `questions` array with current statuses, plus `project_name`, `intent`, `lifecycle_id`, and `research_rounds`.
3. **`.expedite/sources.yml`** -- Extract enabled sources and their tool lists.

**Error handling:** If any of these files are missing or cannot be read, display:
```
Error: Required file missing: {filename}. Run `/expedite:scope` to generate scope artifacts.
```
Then STOP. Do not proceed.

After loading all three files, display a summary:
```
Loaded scope artifacts:
  {N} questions across {M} Decision Areas
  {K} sources enabled: {comma-separated list of enabled source names}
```

Proceed to Step 3.

### Step 3: Initialize Research State

Transition state.yml phase from "scope_complete" to "research_in_progress" using the backup-before-write pattern:

1. Read `.expedite/state.yml`
2. Copy to backup: `cp .expedite/state.yml .expedite/state.yml.bak` (via Bash)
3. Update the in-memory representation:
   - Set `phase` to `"research_in_progress"`
   - Increment `research_rounds` by 1
   - Set `last_modified` to current timestamp (ISO 8601 UTC)
4. Write the entire file back to `.expedite/state.yml`

Display: "Phase: research_in_progress (round {research_rounds})"

Proceed to Step 4.

### Step 4: Form Source-Affinity Batches

Group questions into batches by their primary source affinity. Each question is assigned to exactly one batch -- no question duplication across batches.

**Assignment rules (apply in order for each question):**

1. If the question's `status` is already `"covered"` (from a prior gap-fill round), SKIP it entirely. Do not include it in any batch.
2. Look at the question's `source_hints` array from state.yml.
3. If `source_hints` contains exactly one source AND that source is enabled in sources.yml, assign to that source's batch.
4. If `source_hints` contains multiple sources, assign to the FIRST enabled source in the hints list. The user can reassign during review (Step 6).
5. If `source_hints` is empty or contains only disabled sources, assign to the `"web"` batch as fallback (web is always available).

**Batch construction:**

Create one batch object per enabled source type that has questions assigned to it. Each batch contains:
- `batch_id`: sequential identifier (e.g., "batch-01", "batch-02")
- `source`: the source name (e.g., "web", "codebase", "github")
- `source_tools`: the tool list from sources.yml for this source
- `questions`: array of question objects, each containing:
  - `id`: question ID (e.g., "q01")
  - `text`: question text
  - `priority`: P0, P1, or P2
  - `decision_area`: DA name
  - `evidence_requirements`: full evidence requirements string (CRITICAL -- research agents must receive typed evidence targets, not just question text)
  - `source_hints`: original source hints for reference

**Constraints:**
- Target one batch per enabled source type. If only 1 question maps to a source, it still gets its own batch (user can merge in review).
- Maximum 5 batches total. If more than 5 source types have questions, merge the smallest batches into related ones.
- Sort questions within each batch by priority (P0 first, then P1, then P2).

Proceed to Step 5.

### Step 5: Validate DA Coverage

Verify that every Decision Area from the question plan has at least one question assigned to a research batch (not skipped).

1. Extract all unique `decision_area` values from the questions in state.yml.
2. For each DA, check whether at least one question with that DA value exists in any batch.
3. If any DA has ZERO questions in batches, display a warning:

```
WARNING: Decision Area '{DA name}' has no questions assigned to research batches.
This DA will have no evidence for design decisions.
```

4. If warnings were displayed, use AskUserQuestion:
```
header: "DA Coverage Gap"
question: "Some Decision Areas have no research questions. How would you like to proceed?"
options:
  - label: "Continue anyway"
    description: "Proceed with research -- these DAs will have no evidence"
  - label: "Cancel and modify scope"
    description: "Return to /expedite:scope to add questions for uncovered DAs"
multiSelect: false
```

- If "Continue anyway": Proceed to Step 6.
- If "Cancel and modify scope": Transition phase back to "scope_complete" using backup-before-write pattern, decrement `research_rounds` by 1, display "Research cancelled. Run `/expedite:scope` to modify your question plan." Then STOP.

5. If all DAs are covered, proceed to Step 6 without prompting.

### Step 6: Present Batch Plan for Approval

Display the batch plan in this exact format:

```
--- Research Batch Plan ---

Batch 1 ({source_name}) - {N} questions:
  [P0] {id}: {text} [DA: {decision_area}]
  [P1] {id}: {text} [DA: {decision_area}]
  ...

Batch 2 ({source_name}) - {N} questions:
  [P0] {id}: {text} [DA: {decision_area}]
  ...

--- {total_questions} questions across {total_DAs} DAs, {total_batches} batches ---
```

After displaying the batch plan, present the user with a freeform prompt:

```
Review the batch plan above. You can:
- **approve** -- dispatch research agents with this plan
- **modify** -- describe changes (e.g., 'move q03 to web batch', 'merge batches 2 and 3')
- **cancel** -- abort research and return to scope
```

**Handling user responses:**

- **"approve"** (or clear approval): Display "Batch plan approved. Proceeding to source validation..." and continue to Step 7 (next plan).

- **"modify"** (with description of changes): Apply the requested changes to the batch data structures. Valid modifications include:
  - Moving a question to a different batch (e.g., "move q03 to web batch")
  - Merging two batches (e.g., "merge batches 2 and 3")
  - Splitting a batch (e.g., "split the web batch into two")
  - Changing source assignment (e.g., "use codebase for q05 instead of web")
  After applying changes, re-display the updated batch plan in the same format and re-prompt. Loop until approved or cancelled.

- **"cancel"**: Transition phase back to "scope_complete" using the backup-before-write pattern:
  1. Read `.expedite/state.yml`
  2. Copy to backup: `cp .expedite/state.yml .expedite/state.yml.bak` (via Bash)
  3. Set `phase` to `"scope_complete"`
  4. Decrement `research_rounds` by 1
  5. Set `last_modified` to current timestamp
  6. Write the entire file back
  Display: "Research cancelled. Run `/expedite:scope` to modify your question plan." Then STOP.

**Evidence requirements flow-through:** When constructing the batch data structures, ALWAYS include the full `evidence_requirements` string for each question. This is critical -- research agents must receive typed evidence targets (e.g., "At least 2 implementation examples with benchmarks"), not just the question text. This ensures agents know what specific evidence to find, satisfying the contract chain from scope through research.
