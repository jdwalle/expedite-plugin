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

Check the `research_round` field in state.yml.

- If `research_round` is 0: This is the initial research run. Display: "Starting research phase..."
- If `research_round` is greater than 0: This is a re-entry (gap-fill round from Phase 6). Display: "Resuming research (round {research_round + 1})... This is a gap-fill round -- only pending/partial questions will be researched."

Proceed to Step 2.

### Step 2: Read Scope Artifacts

Read the following files:

1. **`.expedite/scope/SCOPE.md`** -- Extract the full question plan with Decision Areas, questions, priorities, evidence requirements, source hints, depth calibration, and readiness criteria.
2. **`.expedite/state.yml`** -- Extract the `questions` array with current statuses, plus `project_name`, `intent`, `lifecycle_id`, and `research_round`.
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
   - Increment `research_round` by 1
   - Set `last_modified` to current timestamp (ISO 8601 UTC)
4. Write the entire file back to `.expedite/state.yml`

Display: "Phase: research_in_progress (round {research_round})"

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
- If "Cancel and modify scope": Transition phase back to "scope_complete" using backup-before-write pattern, decrement `research_round` by 1, display "Research cancelled. Run `/expedite:scope` to modify your question plan." Then STOP.

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
  4. Decrement `research_round` by 1
  5. Set `last_modified` to current timestamp
  6. Write the entire file back
  Display: "Research cancelled. Run `/expedite:scope` to modify your question plan." Then STOP.

**Evidence requirements flow-through:** When constructing the batch data structures, ALWAYS include the full `evidence_requirements` string for each question. This is critical -- research agents must receive typed evidence targets (e.g., "At least 2 implementation examples with benchmarks"), not just the question text. This ensures agents know what specific evidence to find, satisfying the contract chain from scope through research.

### Step 7: Pre-Validate Sources

Create the output directory for evidence files:
```bash
mkdir -p .expedite/research
```

For each unique source in the approved batch plan, validate availability:

- **If source is "web":** SKIP validation. Web is always available via WebSearch/WebFetch.
- **If source is "codebase":** SKIP validation. Codebase tools (Grep, Read, Glob, Bash) are always available.
- **If source is an MCP source** (any key other than "web" or "codebase" in sources.yml):
  - Attempt a lightweight probe: call the first tool listed in that source's `tools` array from sources.yml with minimal parameters.
  - If the tool call returns successfully or returns a server error (data accessible but query issue): mark source as **AVAILABLE**.
  - If the tool call fails with a platform/connection error: mark source as **UNAVAILABLE**.

**If any MCP source is UNAVAILABLE**, display clear messaging:

```
Source pre-validation failed:
  [FAIL] mcp: {source_name} -- {error_description}

Options:
1. Fix connection -- Resolve the issue and retry validation
2. Reroute questions -- Move {affected_question_ids} to web search instead
3. Skip questions -- Mark {affected_question_ids} as UNAVAILABLE-SOURCE and continue

Which would you like to do?
```

**Handling user responses:**

- **If user chooses "fix":** Re-validate the source. Loop until available or user picks another option.
- **If user chooses "reroute":** Move affected questions to the web batch. Re-display the updated batch plan for confirmation using the Step 6 format.
- **If user chooses "skip":** Update those questions' `status` to `"unavailable_source"` in state.yml using the backup-before-write pattern (read, backup, modify, write). Remove them from the batch plan and continue.

**If ALL sources validate** (or user resolved all failures): Display "All sources validated. Preparing agents..." and proceed to Step 8.

### Step 8: Assemble Prompt Templates

For each batch in the approved plan, assemble the full prompt that will be sent to the research subagent:

1. **Determine the template file** based on the batch source:
   - `"web"` source -> Read `skills/research/references/prompt-web-researcher.md`
     (use Glob with `**/prompt-web-researcher.md` if the direct path fails)
   - `"codebase"` source -> Read `skills/research/references/prompt-codebase-analyst.md`
     (use Glob with `**/prompt-codebase-analyst.md` if the direct path fails)
   - Any MCP source -> Read `skills/research/references/prompt-mcp-researcher.md`
     (use Glob with `**/prompt-mcp-researcher.md` if the direct path fails)

2. **Extract frontmatter metadata** from the template. Each template has YAML frontmatter with:
   - `subagent_type`: the type of subagent (e.g., "general-purpose")
   - `model`: the model tier (e.g., "sonnet")

3. **Construct the `{{questions_yaml_block}}`** -- a YAML block containing, for each question in the batch:
   ```yaml
   - id: "{id}"
     text: "{text}"
     priority: "{priority}"
     decision_area: "{decision_area}"
     evidence_requirements: "{evidence_requirements}"
   ```

4. **Replace ALL template placeholders** in the prompt body:
   - `{{project_name}}` -> from state.yml `project_name`
   - `{{intent}}` -> from state.yml `intent`
   - `{{research_round}}` -> from state.yml `research_round`
   - `{{output_dir}}` -> `".expedite/research"`
   - `{{output_file}}` -> `".expedite/research/evidence-{batch_id}.md"` (e.g., `evidence-batch-01.md`)
   - `{{batch_id}}` -> the batch identifier (e.g., `"batch-01"`)
   - `{{timestamp}}` -> current ISO 8601 UTC timestamp
   - `{{questions_yaml_block}}` -> the constructed YAML block from step 3
   - `{{codebase_root}}` -> current working directory (for codebase-analyst template ONLY)
   - `{{mcp_sources}}` -> YAML block of the MCP source config from sources.yml (for mcp-researcher template ONLY)

5. **CRITICAL: After replacement, verify no `{{` patterns remain in the assembled prompt.** Scan the assembled string for any remaining `{{` occurrences, **excluding** `{{` patterns inside triple-backtick code blocks (these are format examples for the agent, e.g., `{{question_id}}`, `{{question_text}}`, `{{evidence_requirements}}` in the output_format section). If any non-code-block placeholder was not replaced, display error:
   ```
   Template assembly failed: unreplaced placeholder found in {template_file}. Aborting dispatch.
   ```
   Then STOP. Do not proceed to dispatch.

Store each assembled prompt with its batch metadata:
- `batch_id`: the batch identifier
- `source`: the source name
- `question_ids`: list of question IDs in this batch
- `subagent_type`: from template frontmatter
- `assembled_prompt`: the fully-resolved prompt string

Proceed to Step 9.

### Step 9: Dispatch Parallel Subagents

Display: "Dispatching {N} research agents in parallel..."

For each batch, issue a Task() call **simultaneously** (all dispatched in parallel):

```
Task(
  prompt: {assembled_prompt},
  description: "Research {source} batch ({batch_id}): {comma-separated question ids}",
  subagent_type: "general-purpose"
)
```

**Concurrency limit:** Maximum 3 concurrent agents. If more than 3 batches exist, dispatch the first 3 and queue remaining batches. After any agent completes, dispatch the next queued batch immediately.

**Progress notifications:** As each agent completes, display a progress notification:

```
Batch {N} complete ({source}) -- Evidence for {question_ids} written to evidence-{batch_id}.md ({remaining} remaining)
```

**Failure handling:** If an agent fails (Task() returns error or agent reports critical failure), surface the failure to user with options:

```
Agent failure in Batch {N} ({source}):
  Error: {error_description}

Options:
1. Retry -- Dispatch this batch again
2. Skip -- Mark questions {question_ids} as failed and continue
```

- **If user retries:** Re-dispatch the same Task() with the same assembled prompt. Maximum 1 retry per batch -- if the retry also fails, only the "Skip" option remains.
- **If user skips:** Mark those questions as `"not_covered"` in state.yml using the backup-before-write pattern (read, backup, modify, write).

Continue until all batches are complete or user has addressed all failures. Then proceed to Step 10.

### Step 10: Collect Results and Update State

After ALL agents have completed (or been skipped/failed), collect and process results:

For each completed batch:

1. **Read the agent's condensed return summary** (the ~500 token summary returned by Task(), NOT the full evidence file). This avoids context bloat -- the detailed findings are already written to the evidence files on disk.

2. **Extract per-question results** from the summary:
   - Per-question status: Did the agent find evidence meeting the requirements? Infer from the GAPS section of the return summary.
   - `PROPOSED_QUESTIONS`: Any new questions the agent discovered during research.
   - `CONFIDENCE` level: high, medium, or low.

3. **Update state.yml for each question in the batch** using the backup-before-write pattern (read, backup, modify, write for EACH update cycle):
   - Set `evidence_files` to include the evidence file path (e.g., `[".expedite/research/evidence-batch-01.md"]`)
   - Set `status` based on agent findings:
     - If agent found evidence meeting requirements -> `"covered"` (preliminary -- Phase 6 sufficiency evaluator makes final determination)
     - If agent found partial evidence -> `"partial"`
     - If agent found no relevant evidence -> `"not_covered"`
     - If source was unavailable -> `"unavailable_source"`
   - **Note:** These are PRELIMINARY statuses. The Phase 6 sufficiency evaluator will make the final assessment using the full evidence files and the typed rubric. Do not treat these statuses as final.

4. **Collect all PROPOSED_QUESTIONS** from all agents into a single queue. Do NOT present these to the user yet -- per user decision, dynamic question proposals are queued until all agents finish and are surfaced during Phase 6 sufficiency assessment.

Proceed to Step 11.

### Step 11: Research Completion Summary

Display a structured completion summary:

```
--- Research Complete (Round {research_round}) ---

Results:
  Batches dispatched: {N}
  Batches completed: {M}
  Batches failed/skipped: {F}

Question Status:
  Covered (preliminary): {count}
  Partial: {count}
  Not Covered: {count}
  Unavailable Source: {count}

Evidence files:
  {list each evidence file path, one per line}

{If proposed_questions > 0:}
Dynamic Questions Discovered: {count} new questions proposed by agents
(These will be presented for your approval in Phase 6 sufficiency assessment)
```

**If there are proposed questions**, write them to `.expedite/research/proposed-questions.yml` as a YAML list:

```yaml
# Proposed questions discovered during research round {N}
# Phase 6 will present these for user approval
proposed_questions:
  - text: "{question text}"
    proposed_by: "{batch_id}"
    related_da: "{decision_area if identifiable}"
```

**Display next step guidance:**

```
Research evidence collected. Next steps:
- Review evidence files in .expedite/research/ if desired
- Run `/expedite:research` again when Phase 6 is implemented for sufficiency assessment and synthesis
- Current status: research_in_progress (Phase 6 will transition to research_complete after G2 gate)
```

**Phase transition:** Do NOT transition phase to `"research_complete"`. That is Phase 6's responsibility after the G2 gate passes. The phase stays at `"research_in_progress"` -- this correctly reflects that evidence has been collected but not yet assessed for sufficiency.

Display "Proceed to Step 12" (placeholder for Phase 6 continuation: sufficiency assessment, G2 gate, gap-fill, synthesis).
