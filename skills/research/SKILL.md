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

5. Log phase transition:
   ```bash
   cat >> .expedite/log.yml << 'LOG_EOF'
   ---
   event: phase_transition
   timestamp: "{ISO 8601 UTC}"
   lifecycle_id: "{lifecycle_id}"
   from_phase: "scope_complete"
   to_phase: "research_in_progress"
   LOG_EOF
   ```

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

**Log source failure** (after detecting unavailable source, before presenting options):
```bash
cat >> .expedite/log.yml << 'LOG_EOF'
---
event: source_failure
timestamp: "{ISO 8601 UTC}"
lifecycle_id: "{lifecycle_id}"
source: "{source name}"
error: "{error description}"
action: "{rerouted_to_web|skipped|circuit_breaker}"
affected_questions: ["{affected question IDs}"]
LOG_EOF
```
Note: Log the event when the failure is detected. Update the `action` field after the user chooses how to handle it (reroute/skip/fix). If the user fixes and the source becomes available, the source_failure event already logged is still valid (it records the initial failure).

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

**Log source failure** on agent dispatch failure:
```bash
cat >> .expedite/log.yml << 'LOG_EOF'
---
event: source_failure
timestamp: "{ISO 8601 UTC}"
lifecycle_id: "{lifecycle_id}"
source: "{source name}"
error: "{error description}"
action: "{rerouted_to_web|skipped|circuit_breaker}"
affected_questions: ["{affected question IDs}"]
LOG_EOF
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

4. **Log agent completion** for each completed batch:
   ```bash
   cat >> .expedite/log.yml << 'LOG_EOF'
   ---
   event: agent_completion
   timestamp: "{ISO 8601 UTC}"
   lifecycle_id: "{lifecycle_id}"
   agent_type: "{web-researcher|codebase-analyst|mcp-researcher}"
   batch_id: "{batch_id}"
   questions: ["{question IDs in this batch}"]
   status: "{complete|failed}"
   LOG_EOF
   ```

5. **Collect all PROPOSED_QUESTIONS** from all agents into a single queue. Do NOT present these to the user yet -- per user decision, dynamic question proposals are queued until all agents finish and are surfaced during Phase 6 sufficiency assessment.

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
Research evidence collected.
- Review evidence files in .expedite/research/ if desired
- Proceeding to sufficiency assessment...
```

**Phase transition:** Do NOT transition phase to `"research_complete"`. That is Step 18's responsibility after the G2 gate passes and synthesis is generated. The phase stays at `"research_in_progress"` -- this correctly reflects that evidence has been collected but not yet assessed for sufficiency.

Proceed to Step 12.

### Step 12: Sufficiency Assessment

Dispatch the sufficiency evaluator as a Task() subagent. The evaluator reads all evidence files and scope artifacts in its own fresh context — keeping evidence content out of the orchestrator's context.

Read the evaluator template from `skills/research/references/prompt-sufficiency-evaluator.md` (use Glob with `**/prompt-sufficiency-evaluator.md` if the direct path fails). This template HAS frontmatter (`subagent_type: general-purpose`, `model: sonnet`) — it runs as a Task() subagent.

Fill the following placeholders in the template:
- `{{project_name}}` — from state.yml `project_name`
- `{{intent}}` — from state.yml `intent`

Apply the conditional blocks based on intent:
- If intent is "product": keep `<if_intent_product>` blocks, remove `<if_intent_engineering>` blocks
- If intent is "engineering": keep `<if_intent_engineering>` blocks, remove `<if_intent_product>` blocks

Dispatch via Task(). The subagent will read evidence files + scope itself (per its `<self_contained_reads>` instructions) and write results to `.expedite/research/sufficiency-results.yml`.

**After the subagent completes**, read `.expedite/research/sufficiency-results.yml`. If the file is missing, display an error and offer to re-dispatch.

**UNAVAILABLE-SOURCE short-circuit:** Check for any questions rated UNAVAILABLE-SOURCE. For each, surface immediately to the user using AskUserQuestion:

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

Handling: "Accept gap" keeps UNAVAILABLE-SOURCE status (flows to SYNTHESIS.md advisory). "Suggest alternative source" asks user for details via freeform, updates `source_hints` in state.yml (backup-before-write). "Override and proceed" treats question as resolved for gate purposes.

**Update state.yml** with the evaluator's results using the backup-before-write pattern. For each question, set `status` to the evaluator's categorical rating in lowercase (`covered`, `partial`, `not_covered`, or `unavailable_source`) and set `gap_details` to `null` if COVERED or to the evaluator's gap description otherwise. These are FINAL statuses replacing Phase 5's preliminary statuses.

**Display assessment summary:**

```
--- Sufficiency Assessment Summary ---

| Question | Priority | DA | Status | Coverage | Corroboration | Actionability |
|----------|----------|----|--------|----------|---------------|---------------|
| {q_id}   | {P0/P1/P2} | {DA name} | {status} | {dim} | {dim} | {dim} |
...

Summary: COVERED: {count} | PARTIAL: {count} | NOT COVERED: {count} | UNAVAILABLE-SOURCE: {count}
```

If ALL COVERED: "All questions sufficiently covered. Proceeding to G2 gate."
If gaps exist: "Gaps identified. G2 gate will determine next action."

Proceed to Step 13.

### Step 13: Dynamic Question Discovery

Surface new questions discovered by research agents during evidence gathering. Proposals are deduplicated via LLM judgment (not string matching), capped at 4, and presented to the user for approval.

Read `.expedite/research/proposed-questions.yml`. If the file does not exist or is empty, display "No new questions discovered by research agents." and skip to Step 14.

If proposed questions exist (each with `text`, `proposed_by`, `related_da`), deduplicate them:

1. **Against existing questions in state.yml:** Discard if semantically equivalent to an existing question (same underlying information need, regardless of wording). Note: "Duplicate of {existing_question_id}".
2. **Cross-dedup within proposals:** If two proposals are semantically equivalent, keep the more specific one.

This is **inline LLM semantic deduplication** — not string matching, not a subagent. Display dedup results: "{N} proposals received, {M} duplicates removed, {K} unique remaining."

**Cap at 4:** If more than 4 unique proposals remain, prioritize by: P0-related DAs first, then gap-relevance (PARTIAL/NOT COVERED questions), then specificity. Keep top 4.

**Present to user** via freeform prompt (not AskUserQuestion — too complex for multi-choice):

```
--- Discovered Questions ---

The following questions were discovered by research agents.
Select which to add to the question plan:

1. "{question_text}"
   Proposed by: {batch_id} ({source_type}) | Related DA: {related_da}
...

Options: Approve all | Approve specific (e.g., "1,3") | Approve none | Modify
```

**For each approved question:** Assign next sequential `question_id`, set `priority` to P1 (user can override), set `status` to `"pending"`, set `source` to `"discovered-round-{research_round}"`. Add to state.yml's `questions` array (backup-before-write) and to SCOPE.md's question plan in the appropriate DA section.

Display discovery summary: questions proposed, duplicates removed, presented, approved.

Proceed to Step 14.

### Step 14: G2 Gate Evaluation

Count-based gate evaluation from state.yml question statuses (set in Step 12). No LLM judgment — pure counting.

Compute counts: `total_questions`, `covered_count`, `partial_count`, `not_covered_count`, `unavailable_count`, `p0_questions`, `p0_not_covered`, `unresolved_unavailable`.

**MUST criteria (all must pass for Go):**
- M1: Every question assessed (covered + partial + not_covered + unavailable = total)
- M2: Majority COVERED (covered_count > total / 2)
- M3: All P0 questions COVERED or PARTIAL (p0_not_covered == 0)
- M4: No unresolved UNAVAILABLE-SOURCE (unresolved_unavailable == 0)

**SHOULD criteria (failures produce advisory, not block):**
- S1: All questions COVERED (covered_count == total)
- S2: No PARTIAL ratings remain (partial_count == 0)
- S3: All evidence requirements MET (no PARTIALLY MET in evaluator output)

**Gate outcomes:**
- **Go**: All MUST pass AND all SHOULD pass
- **Go-with-advisory**: All MUST pass, SHOULD failures exist
- **Recycle**: Any MUST criterion fails
- **Override**: Only when user explicitly requests it (not auto-determined)

Display gate results (MUST and SHOULD with pass/fail + evidence for each), then outcome.

**Log gate outcome to telemetry** (after evaluation, before outcome routing):
```bash
cat >> .expedite/log.yml << 'LOG_EOF'
---
event: gate_outcome
timestamp: "{ISO 8601 UTC}"
lifecycle_id: "{lifecycle_id}"
gate: "G2"
outcome: "{go|go_advisory|recycle|override}"
must_passed: {N}
must_failed: {N}
should_passed: {N}
should_failed: {N}
LOG_EOF
```

Proceed to Step 15.

### Step 15: Gate Outcome Handling

**15a: Record gate history.** Append to `gate_history` in state.yml (backup-before-write):

```yaml
- gate: "G2"
  timestamp: "{ISO 8601 UTC}"
  outcome: "{go|go_advisory|recycle|override}"
  must_passed: {count}
  must_failed: {count}
  should_passed: {count}
  should_failed: {count}
  notes: "{brief summary}"
  overridden: false
```

**15b: Route by outcome:**

**Go** → Display "G2 gate passed. Research is sufficient for design." → Proceed to Step 17.

**Go-with-advisory** → Show user which SHOULD criteria failed and which questions have weak areas. Present via freeform prompt: "1. Proceed with advisory (weak areas documented in SYNTHESIS.md) | 2. Run gap-fill to strengthen." If proceed → record advisory data for synthesizer, proceed to Step 17. If gap-fill → treat as Recycle, proceed to Step 16.

**Recycle** → Read `skills/research/references/ref-recycle-escalation.md` for escalation messaging appropriate to the current recycle count (GATE-04). Show gap details for each deficient question. Wait for user decision:
- **Approve gap-fill** → Proceed to Step 16.
- **Adjust** → User reprioritizes or accepts gaps. Update state.yml (backup-before-write), then re-run Step 14.
- **Override** → Proceed to 15c.

**15c: Override handling.** Read `skills/research/references/ref-override-handling.md` and follow its instructions: record override in gate_history, determine severity, write `.expedite/research/override-context.md`.

**Log override event:**
```bash
cat >> .expedite/log.yml << 'LOG_EOF'
---
event: override
timestamp: "{ISO 8601 UTC}"
lifecycle_id: "{lifecycle_id}"
gate: "G2"
severity: "{low|medium|high}"
must_failed: {N}
affected_das: ["{affected DA names}"]
LOG_EOF
```

Then proceed to Step 17.

### Step 16: Gap-Fill Dispatch

Filter deficient questions from state.yml: include `"partial"` or `"not_covered"` status + any newly discovered `"pending"` questions from Step 13. Exclude UNAVAILABLE-SOURCE (handled in Step 12) and user-accepted gaps.

Display: "Gap-fill targets: {count} questions (Partial: {N}, Not covered: {N}, Pending: {N})"

Read `skills/research/references/ref-gapfill-dispatch.md` for detailed batch structure and dispatch modifications.

Increment `research_round` in state.yml (backup-before-write). Create output directory: `mkdir -p .expedite/research/round-{research_round}/`.

Re-batch deficient questions by Decision Area (not source affinity). Dispatch gap-fill agents using the Phase 5 pipeline (Steps 7-11) with the modifications described in the reference file: narrowed question set, DA-based batches, gap_context injection, additive supplement output paths, same 3-agent max concurrency.

After gap-fill completes: collect proposed questions, update evidence_files in state.yml, display summary. **Return to Step 12** to re-assess sufficiency with new evidence.

### Step 17: Synthesis Generation

Read the synthesizer template from `skills/research/references/prompt-research-synthesizer.md` (use Glob with `**/prompt-research-synthesizer.md` if the direct path fails). This template HAS frontmatter (`model: opus`, `subagent_type: general-purpose`) — it runs as a Task() subagent.

Fill template placeholders: `{{project_name}}`, `{{intent}}`, `{{research_round}}` from state.yml. `{{evidence_dir}}` = ".expedite/research". `{{scope_file}}` = ".expedite/scope/SCOPE.md". `{{output_file}}` = ".expedite/research/SYNTHESIS.md". `{{timestamp}}` = current ISO 8601 UTC. The subagent reads evidence files and scope itself (per its `<self_contained_reads>` instructions) — do NOT read or assemble evidence content into the prompt.

Apply intent lens (keep matching `<if_intent_*>` blocks, remove other).

**If Go-with-advisory:** Inject `<advisory_context>` before `<input_data>` — list failed SHOULD criteria and PARTIAL question details. Instruct synthesizer to include a `## Advisory` section in SYNTHESIS.md.

**If override-context.md exists:** Read it and inject as `<override_context>` — instruct synthesizer to prominently flag overridden gaps in DA sections and a `## Override Advisory` section.

Dispatch via Task(). After completion, verify `.expedite/research/SYNTHESIS.md` exists. If missing, offer re-dispatch via AskUserQuestion. If present, display confirmation with file size.

Proceed to Step 18.

### Step 18: Research Completion

Update state.yml to mark research complete (backup-before-write): set `phase` to `"research_complete"`, update `last_modified`.

**Log phase transition:**
```bash
cat >> .expedite/log.yml << 'LOG_EOF'
---
event: phase_transition
timestamp: "{ISO 8601 UTC}"
lifecycle_id: "{lifecycle_id}"
from_phase: "research_in_progress"
to_phase: "research_complete"
LOG_EOF
```

Display research completion summary:

```
## Research Complete

Project: {project_name}
Intent: {intent}
Research rounds: {research_round}

### Evidence Summary
Total questions: {count}
  COVERED: {count} | PARTIAL: {count} (advisory) | NOT COVERED: {count} (advisory/overridden) | UNAVAILABLE-SOURCE: {count} (accepted)

### Artifacts Produced
- Scope: .expedite/scope/SCOPE.md
- Evidence: .expedite/research/evidence-batch-*.md
{If gap-fill rounds:} Supplements: .expedite/research/round-{N}/supplement-*.md
- Synthesis: .expedite/research/SYNTHESIS.md
{If override:} Override context: .expedite/research/override-context.md

### Next Step
Run `/expedite:design` to generate a design document from the research synthesis.
```
