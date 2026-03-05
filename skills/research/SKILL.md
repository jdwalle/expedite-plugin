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

Display "Proceed to Step 12" and continue automatically.

### Step 12: Sufficiency Assessment

Evaluate whether the collected evidence meets the specific evidence requirements defined during scope. This step invokes the sufficiency evaluator as an inline reference (not a subagent) with strict structural separation: the evaluator only receives evidence files and scope artifacts -- never dispatch metadata, agent reasoning, or Phase 5 preliminary statuses.

#### 12a: Input Assembly for Evaluator

Read the following files to assemble the evaluator input:

1. **`.expedite/scope/SCOPE.md`** -- Extract for each question:
   - Evidence requirements (typed requirements from the question plan)
   - DA depth calibration (Deep / Standard / Light) for each Decision Area
   - Readiness criteria

2. **`.expedite/state.yml`** -- Extract:
   - `project_name` and `intent` (for evaluator placeholders)
   - `questions` array with each question's `evidence_files` paths

3. **Evidence files** -- For each question, read the full content of every file listed in that question's `evidence_files` array in state.yml. If gap-fill rounds have occurred (research_round > 1), also read `round-{N}/supplement-*.md` files from `.expedite/research/` by scanning for matching supplement files using Glob with `.expedite/research/round-*/supplement-*.md`.

4. **Assemble the `{{questions_with_evidence}}` placeholder block.** For each question, include:
   - `question_id`: the question ID (e.g., "q01")
   - `question_text`: the full question text
   - `decision_area`: the DA name
   - `da_depth`: the DA depth calibration from SCOPE.md (Deep / Standard / Light)
   - `evidence_requirements`: the typed evidence requirements from SCOPE.md
   - Full evidence content from the relevant evidence files (paste the entire content, not summaries)

**Anti-bias structural separation (GATE-07):** Do NOT include any of the following in the evaluator input:
- Dispatch metadata (batch IDs, source assignments, agent configuration)
- Agent reasoning or agent-reported statuses
- Phase 5 preliminary question statuses
- Batch configuration or source validation results

Only evidence files and scope artifacts are passed to the evaluator. This ensures the evaluator assesses evidence quality independently, without anchoring to prior judgments.

#### 12b: Invoke Sufficiency Evaluator (Inline Reference)

Read the evaluator template from `skills/research/references/prompt-sufficiency-evaluator.md`. If the direct path fails, use Glob with `**/prompt-sufficiency-evaluator.md` to locate it.

This is an **inline reference** -- the template has no frontmatter, no `subagent_type`, and is NOT dispatched via Task(). The orchestrator fills placeholders and applies the evaluation logic directly in the main session.

Fill the following placeholders in the template:
- `{{project_name}}` -- from state.yml `project_name`
- `{{intent}}` -- from state.yml `intent`
- `{{questions_with_evidence}}` -- from the assembled block in 12a

Apply the conditional blocks based on intent:
- If intent is "product": apply the `<if_intent_product>` blocks and remove `<if_intent_engineering>` blocks
- If intent is "engineering": apply the `<if_intent_engineering>` blocks and remove `<if_intent_product>` blocks

Execute the evaluation following the template's instructions exactly:
1. Assess each question individually across the 3 dimensions (Coverage, Corroboration, Actionability)
2. Apply DA depth calibration for corroboration thresholds:
   - **Deep DAs:** Require Strong or Adequate corroboration. Single-source evidence is insufficient.
   - **Standard DAs:** Require at least Adequate corroboration. Single-source acceptable only from authoritative primary sources.
   - **Light DAs:** Accept Adequate or Weak corroboration. Single-source acceptable from credible sources.
3. Assign categorical rating per the template's rules (COVERED, PARTIAL, NOT COVERED, UNAVAILABLE-SOURCE)
4. Write gap details for every non-COVERED question

Perform the evaluator's quality gate (anti-bias self-check) before finalizing: re-read each rating and verify it passes all checklist items in the template's `<quality_gate>` section. If any check fails, revise the assessment before proceeding.

#### 12c: UNAVAILABLE-SOURCE Short-Circuit

After completing the evaluation, check for any questions rated UNAVAILABLE-SOURCE.

For each UNAVAILABLE-SOURCE question, surface it immediately to the user using AskUserQuestion:

```
header: "Source Unavailable: {question_id}"
question: "Question '{question_text}' was rated UNAVAILABLE-SOURCE — the source was inaccessible, not just unhelpful. How would you like to handle this?"
options:
  - label: "Accept gap"
    description: "Acknowledge this gap — it will appear as an advisory in SYNTHESIS.md"
  - label: "Suggest alternative source"
    description: "Provide a different source to try for this question"
  - label: "Override and proceed"
    description: "Proceed as if this question is not needed"
multiSelect: false
```

**Handling responses:**

- **"Accept gap":** Record the user's decision. The question keeps its UNAVAILABLE-SOURCE status and will flow into the SYNTHESIS.md advisory section documenting the known gap.

- **"Suggest alternative source":** Ask the user for the alternative source details using a freeform prompt. Update the question's `source_hints` in state.yml using the backup-before-write pattern (read, backup, modify, write). Do NOT re-run sufficiency assessment now -- the question will be handled in gap-fill if G2 triggers Recycle.

- **"Override and proceed":** Record the override decision. The question is treated as resolved for gate purposes.

This mirrors the Phase 5 circuit breaker pattern -- the user decides how to handle source failures, not automated retry.

#### 12d: Update state.yml with Evaluator Results

Update state.yml with the final sufficiency ratings using the backup-before-write pattern:

1. Read `.expedite/state.yml`
2. Copy to backup: `cp .expedite/state.yml .expedite/state.yml.bak` (via Bash)
3. For each question in state.yml, update:
   - `status`: Set to the evaluator's categorical rating in lowercase (`covered`, `partial`, `not_covered`, or `unavailable_source`)
   - `gap_details`: Set to `null` if COVERED, otherwise set to the evaluator's gap description (which evidence requirements remain unmet, what type of evidence would satisfy them, which sources might have this evidence)
4. Write the entire file back to `.expedite/state.yml`

These are **FINAL statuses** replacing Phase 5's preliminary statuses. The sufficiency evaluator has now made the definitive assessment using the full evidence files and the typed rubric from scope.

#### 12e: Display Assessment Summary

Display a structured summary of the sufficiency assessment:

```
--- Sufficiency Assessment Summary ---

| Question | Priority | DA | Status | Coverage | Corroboration | Actionability |
|----------|----------|----|--------|----------|---------------|---------------|
| {q_id}   | {P0/P1/P2} | {DA name} | {COVERED/PARTIAL/NOT COVERED/UNAVAILABLE-SOURCE} | {Strong/Adequate/Weak/None} | {Strong/Adequate/Weak/None} | {Strong/Adequate/Weak/None} |
...

Summary:
  COVERED: {count}
  PARTIAL: {count}
  NOT COVERED: {count}
  UNAVAILABLE-SOURCE: {count}
```

Based on results:
- If ALL questions are COVERED: Display "All questions sufficiently covered. Proceeding to G2 gate."
- If gaps exist (any PARTIAL, NOT COVERED, or unresolved UNAVAILABLE-SOURCE): Display "Gaps identified. G2 gate will determine next action."

Proceed to Step 13.

### Step 13: Dynamic Question Discovery

Surface new questions discovered by research agents during evidence gathering. Agents may propose questions they encountered while investigating the assigned questions. These proposals are deduplicated via LLM judgment (not string matching), capped at 4, and presented to the user for approval before being added to the question plan.

#### 13a: Read Proposed Questions

Read `.expedite/research/proposed-questions.yml`. If the file does not exist or is empty (no `proposed_questions` list, or the list is empty), display:

```
No new questions discovered by research agents.
```

Then skip to Step 14.

If the file exists and contains proposed questions, parse the `proposed_questions` list. Each entry has:
- `text`: the proposed question text
- `proposed_by`: which batch proposed it (e.g., "batch-01")
- `related_da`: the Decision Area the question relates to (if identifiable by the agent)

Display: "Found {N} proposed questions from research agents. Deduplicating..."

#### 13b: Deduplicate via LLM Judgment

For each proposed question, compare semantically against two sets:

1. **All existing questions in state.yml** (the current question plan). For each existing question, determine whether the proposed question is asking essentially the same thing, even if worded differently. Focus on the underlying information need, not surface-level phrasing.

2. **All other proposed questions** (cross-deduplication within the proposals themselves). If two proposals are semantically equivalent, keep the one with better rationale or greater specificity.

This is **LLM-based semantic deduplication** performed inline in the main session -- not string matching, not regex, not a subagent. The orchestrator uses its own judgment to determine semantic equivalence.

**Deduplication rules:**
- If a proposed question is semantically equivalent to an existing question in state.yml: discard it with a note "Duplicate of {existing_question_id}: {existing_question_text}"
- If a proposed question is semantically equivalent to another proposed question: keep the one with better rationale or greater specificity, discard the other with a note explaining the merge
- "Semantically equivalent" means the questions seek the same underlying information, even if they use different terminology, scope, or framing

Display the deduplication results:
```
Deduplication results:
  {N} proposals received
  {M} duplicates removed:
    - "{discarded_text}" -- duplicate of {reason}
  {K} unique proposals remaining
```

#### 13c: Cap and Prioritize

After deduplication, if more than 4 unique proposals remain, select the top 4 using these prioritization criteria (in order):

1. **P0-related proposals first:** Proposals related to Decision Areas that contain P0 questions get priority
2. **Gap-relevance:** Proposals related to questions identified as PARTIAL or NOT COVERED in Step 12 get priority (these could help fill gaps in a future gap-fill round)
3. **Specificity:** More specific, actionable questions are preferred over broad or exploratory ones

If 4 or fewer unique proposals remain after dedup, keep all of them.

Display: "{K} unique proposals after deduplication (max 4 presented)."

#### 13d: Present to User for Approval

Present each proposed question to the user with its full context:

```
--- Discovered Questions ---

The following questions were discovered by research agents during evidence gathering.
Select which to add to the question plan:

1. "{question_text}"
   Proposed by: {batch_id} ({source_type})
   Related DA: {related_da}

2. "{question_text}"
   Proposed by: {batch_id} ({source_type})
   Related DA: {related_da}

...

Options:
- Approve all -- Add all questions to the question plan
- Approve specific -- Enter numbers to approve (e.g., "1,3")
- Approve none -- Skip all proposed questions
- Modify -- Change a question's text or DA before approving
```

This is a **freeform prompt** (not AskUserQuestion) because the interaction is too complex for a simple multi-choice: users may want to approve a subset, modify text, or reassign DAs.

**Handling responses:**

- **"Approve all":** Add all presented questions to the plan.
- **"Approve specific" (e.g., "1,3"):** Add only the selected questions.
- **"Approve none":** Skip all questions. Display "No discovered questions added."
- **"Modify":** Ask the user which question to modify and what changes to make. Apply the modification, then re-present the updated list for approval. Loop until the user approves or declines.

**For each approved question:**
1. Assign a `question_id` continuing the existing sequence (e.g., if the last question is q08, new questions start at q09)
2. Set `priority` to P1 (suggest to user -- they can override during approval)
3. Set `status` to `"pending"`
4. Set `source` to `"discovered-round-{research_round}"`
5. Add the question to state.yml's `questions` array using the backup-before-write pattern (read, backup, modify, write)
6. Add the question to SCOPE.md's question plan, appended to the appropriate Decision Area section

#### 13e: Display Discovery Summary

Display a structured summary:

```
--- Dynamic Question Discovery Summary ---

Questions proposed by agents: {total_proposed}
Duplicates removed: {duplicates_removed}
Presented to user: {presented_count}
Approved by user: {approved_count}
```

If questions were approved:
```
Approved questions added to question plan:
  {q_id}: "{question_text}" [DA: {related_da}] [Priority: {priority}]
  ...

These questions will be included in gap-fill research if the G2 gate triggers a Recycle.
```

If no questions were approved (either none proposed or user declined all):
```
No new questions added to the question plan.
```

Proceed to Step 14.

### Step 14: G2 Gate Evaluation

Evaluate whether the collected evidence meets the quality threshold required to proceed to synthesis. The G2 gate uses count-based MUST criteria (structural checks) and SHOULD criteria (quality aspirations), following the same pattern as the G1 gate in scope SKILL.md Step 9.

#### 14a: Compute Gate Criteria from Evaluator Output

Count from state.yml question statuses (set in Step 12):

- `total_questions`: count of all questions in the `questions` array
- `covered_count`: count where `status` = `"covered"`
- `partial_count`: count where `status` = `"partial"`
- `not_covered_count`: count where `status` = `"not_covered"`
- `unavailable_count`: count where `status` = `"unavailable_source"`
- `p0_questions`: subset of questions where `priority` = `"P0"`
- `p0_not_covered`: P0 questions where `status` = `"not_covered"`
- `unresolved_unavailable`: UNAVAILABLE-SOURCE questions where the user has NOT yet decided (should be 0 after Step 12c)

All counts are derived from the current state.yml -- no LLM judgment involved in counting.

#### 14b: Evaluate MUST Criteria

Following the G1 gate pattern from scope SKILL.md Step 9, evaluate each MUST criterion. All must pass for a Go outcome:

```
MUST criteria (all must pass for Go):
M1: Every question has been assessed (covered + partial + not_covered + unavailable = total)
M2: Majority of questions rated COVERED (covered_count > total / 2)
M3: All P0 questions rated COVERED or PARTIAL (p0_not_covered == 0)
M4: No UNAVAILABLE-SOURCE questions remain unresolved (unresolved_unavailable == 0)
```

For each MUST criterion, record pass/fail with evidence. Example format:
- "M1: PASS -- 10/10 questions assessed (7 covered + 2 partial + 1 not_covered = 10)"
- "M2: PASS -- 7/10 covered (70% > 50%)"
- "M3: PASS -- 3/3 P0 questions are COVERED or PARTIAL (0 P0 not_covered)"
- "M4: PASS -- 0 unresolved UNAVAILABLE-SOURCE questions"

#### 14c: Evaluate SHOULD Criteria

Evaluate each SHOULD criterion. Failures produce advisory notes but do not block the gate:

```
SHOULD criteria (failures produce advisory, not block):
S1: All questions rated COVERED (covered_count == total)
S2: No PARTIAL ratings remain (partial_count == 0)
S3: All evidence requirements MET (no PARTIALLY MET in evaluator output)
```

For each SHOULD criterion, record pass/fail with evidence. Example format:
- "S1: FAIL -- 7/10 covered (3 not fully covered)"
- "S2: FAIL -- 2 questions still PARTIAL"
- "S3: PASS -- all evidence requirements fully MET"

#### 14d: Determine Gate Outcome

Based on the MUST and SHOULD evaluations, determine the gate outcome:

- **Go**: All MUST criteria pass AND all SHOULD criteria pass. Research quality is fully sufficient.
- **Go-with-advisory**: All MUST criteria pass, but one or more SHOULD criteria fail. Research is sufficient but has known weak areas that will be documented as advisory in SYNTHESIS.md.
- **Recycle**: Any MUST criterion fails (except M4, which was handled in Step 12c via the UNAVAILABLE-SOURCE short-circuit). Gap-fill research is needed.
- **Override**: Only available when the user explicitly requests it. This is NOT auto-determined by the gate -- only the user can choose to override a failing gate. Override allows proceeding despite MUST failures, with all gaps documented.

#### 14e: Display Gate Result

Show gate evaluation results in the same format as G1:

```
## G2 Gate Evaluation

MUST Criteria:
  M1: {PASS|FAIL} -- {evidence}
  M2: {PASS|FAIL} -- {evidence}
  M3: {PASS|FAIL} -- {evidence}
  M4: {PASS|FAIL} -- {evidence}

SHOULD Criteria:
  S1: {PASS|FAIL} -- {evidence}
  S2: {PASS|FAIL} -- {evidence}
  S3: {PASS|FAIL} -- {evidence}

Outcome: {Go | Go-with-advisory | Recycle}
```

Proceed to Step 15 for outcome handling.
