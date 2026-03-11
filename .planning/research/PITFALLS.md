# Domain Pitfalls — v1.2 Infrastructure Hardening & Quality

**Domain:** Claude Code plugin infrastructure hardening (state recovery, state splitting, skill sizing, git commits, verifier agent, explore subagent, conditional alternatives)
**Researched:** 2026-03-11
**Milestone:** v1.2 — Infrastructure Hardening & Quality
**Overall Confidence:** HIGH (derived from codebase analysis of 5,968 LOC across 7 skills, 42 backup-before-write instances, and 7 `!cat state.yml` injection points)

## Executive Summary

21 pitfalls identified across Critical (6), Moderate (8), and Minor (7) severity. The critical pitfalls cluster around two themes: (1) state splitting breaks the `!cat state.yml` injection contract that every skill depends on, and (2) the verifier agent creates a second judgment layer that can conflict with the existing sufficiency evaluator. Unlike v1.1 pitfalls which were mostly about additive features, v1.2 pitfalls involve restructuring load-bearing infrastructure -- state.yml is read by every skill on every invocation, and the backup-before-write pattern appears 42 times across the codebase. Changes to either must be surgical.

---

## Critical Pitfalls

### P1: State Splitting Breaks !cat Injection Contract

**What goes wrong:** Every skill begins with `!cat .expedite/state.yml 2>/dev/null || echo "No active lifecycle"` -- a single-file injection that Claude Code evaluates at SKILL.md load time. Splitting state.yml into scoped files (e.g., `state-core.yml`, `state-research.yml`, `state-execute.yml`) means this injection only captures partial state. Skills that need cross-scope data (status needs everything, execute needs core + task state, research resume needs core + question state) will make decisions on incomplete context.

**Why it happens:** The `!cat` injection is a pre-execution contract -- it runs before the skill's instructions execute. There is no conditional logic possible at injection time. You cannot write `!cat .expedite/state-core.yml && !cat .expedite/state-research.yml` conditionally based on which skill is loading, because the injection path is hardcoded in each SKILL.md header.

**Consequences:** Skills resume incorrectly (research skill sees no questions, execute skill sees no tasks), phase routing fails (skill thinks "No active lifecycle" because it read the wrong file), and the status skill cannot display a complete picture.

**Prevention:**
- Keep a single `state.yml` as the injection target, even if internal storage splits. The file read by `!cat` must always contain enough context for any skill to route correctly (project_name, intent, phase, current_step at minimum).
- If splitting storage, use a "manifest" pattern: `state.yml` remains the single source of truth for routing fields, and scoped files hold detail data (questions array, tasks array, gate_history). Skills read the scoped files explicitly in their Step 1 after injection provides routing context.
- Audit all 7 `!cat` injection points before splitting. Each must still produce valid routing after the split.
- Test every skill's Case A/B/C routing logic against the split state to verify no path depends on fields that moved to scoped files.

**Detection:** After splitting, invoke each skill and check that the injected state in the first few lines of Claude's context contains the fields that skill's Step 1 routing depends on.

**Phase:** Must be addressed as the FIRST concern in the state splitting phase. The injection contract is the load-bearing foundation.

---

### P2: State Splitting Migration — Data Loss During Transition

**What goes wrong:** A user has an active lifecycle at any phase (e.g., `research_in_progress` with 12 questions, evidence files, and gap details). The v1.2 code expects split state files. The first skill invocation after upgrading reads the old monolithic state.yml, does not find the split files, and either errors or reinitializes -- losing the questions array, gate_history, task statuses, and evidence_files paths.

**Why it happens:** The complete-file rewrite pattern means every write replaces the entire file. If the new code writes to `state-research.yml` but the old `state.yml` still contains the questions array, the questions exist in limbo -- not in the new file (never migrated) and potentially overwritten in the old file (next write to state.yml omits them because the new code doesn't put them there).

**Consequences:** Active lifecycles become unrecoverable. Users must restart from scope. Research evidence files still exist on disk but the state tracking that maps questions to evidence files is lost.

**Prevention:**
- Implement a migration check at skill entry: if state.yml exists AND scoped files do not, perform one-time migration before proceeding.
- Migration must be atomic: read old state.yml, write all scoped files, then write new state.yml (with fields removed) ONLY after scoped files are confirmed written.
- The .bak file becomes critical during migration -- backup the monolithic state.yml BEFORE starting migration so a failed migration can be rolled back.
- Add a `state_version` field to state.yml. v1.1 has no version field (implicit v1). v1.2 writes `state_version: 2`. Skills check this field first: if absent or 1, run migration. If 2, proceed normally.
- Never assume the split has happened. Every read of a scoped file must handle "file not found" by falling back to the monolithic state.yml.

**Detection:** Test with a state.yml from every possible phase (scope_in_progress through complete) and verify migration preserves all fields.

**Phase:** Must be the second concern in the state splitting phase, immediately after P1.

---

### P3: Verifier Agent Disagrees with Sufficiency Evaluator

**What goes wrong:** The existing sufficiency evaluator (prompt-sufficiency-evaluator.md) rates a question as COVERED based on its rubric (coverage + corroboration + actionability). The new verifier agent, checking reasoning soundness, determines that the evidence supporting the COVERED rating has flawed reasoning (e.g., circular logic, false equivalence, misattributed sources). The two outputs contradict: evaluator says "pass", verifier says "fail". The gate cannot reconcile.

**Why it happens:** The sufficiency evaluator is a "type checker" -- it mechanically checks whether evidence requirements are met. The verifier is a "logic checker" -- it evaluates whether the reasoning connecting evidence to conclusions is sound. These are orthogonal dimensions. Evidence can meet all typed requirements (COVERED) while being logically unsound (verifier FAIL), or vice versa.

**Consequences:** If the verifier can override the evaluator, questions that passed sufficiency get recycled, confusing users who see "COVERED" alongside "verification failed". If the verifier cannot override, it becomes advisory-only and users ignore it. Either way, trust in the gate system erodes.

**Prevention:**
- Define clear authority hierarchy: the sufficiency evaluator owns the COVERED/PARTIAL/NOT COVERED rating. The verifier produces an independent `reasoning_soundness` assessment (SOUND/WEAK/FLAWED) that is ADVISORY, not blocking.
- Display both assessments side by side in the G2 gate output, but only the evaluator's rating controls the Go/Recycle decision.
- If the verifier flags FLAWED reasoning on a COVERED question, surface it as a Go-with-advisory outcome (not Recycle), with the advisory flowing to the design phase as a confidence note.
- Never let the verifier modify the evaluator's output file (sufficiency-results.yml). Verifier writes to its own output file (e.g., `verification-results.yml`).
- The verifier should receive the evaluator's output as READ-ONLY input, not as something to edit.

**Detection:** Test with evidence that is technically sufficient but logically weak. Verify the system produces a Go-with-advisory, not a deadlock or silent override.

**Phase:** Address when implementing the verifier agent. The authority hierarchy must be designed before coding.

---

### P4: Verifier Agent Creates Infinite Recycle Loops

**What goes wrong:** The verifier flags reasoning issues. Gap-fill re-researches the questions. The new evidence has different reasoning issues. The verifier flags again. The cycle repeats: research -> evaluate -> verify -> recycle -> gap-fill -> research -> evaluate -> verify -> recycle. The existing recycle escalation (ref-recycle-escalation.md) only counts G2 recycles from the evaluator, not from the verifier, so the 3rd-recycle override recommendation never triggers.

**Why it happens:** Reasoning soundness is subjective. Each re-research produces different evidence with different reasoning, and an LLM verifier may find different issues each time. Unlike the evaluator's rubric (which converges -- more evidence = higher coverage), reasoning assessment does not converge because the verifier evaluates a fresh reasoning chain each time.

**Consequences:** Users get stuck in an endless loop. Token costs compound. User trust collapses -- they learn to always override.

**Prevention:**
- Cap verifier influence: the verifier can flag issues on the FIRST assessment only. On subsequent rounds (research_round > 1), the verifier runs but its output is purely advisory (no ability to trigger recycle).
- Alternatively, count verifier-triggered recycles in the same counter as evaluator recycles. The ref-recycle-escalation.md 3rd-recycle recommendation then covers both sources.
- Add a `max_verification_recycles` parameter (default: 1). After one verifier-triggered advisory, subsequent verifier runs annotate but do not influence gate outcomes.
- The verifier should NEVER have the power to independently trigger a Recycle. Only the evaluator gates. The verifier annotates.

**Detection:** Simulate a lifecycle where evidence is always "technically sufficient but reasoning is weak" and verify the system escapes within 3 rounds.

**Phase:** Address alongside P3 in the verifier agent phase. Loop prevention must be designed upfront.

---

### P5: Git Commits During Execute Stage Wrong Files

**What goes wrong:** Per-task atomic git commits during execute (the new feature) stage `.expedite/` state files alongside implementation code. The commit includes state.yml changes, checkpoint.yml updates, PROGRESS.md appends, and log.yml entries mixed with the actual code changes. This pollutes git history with infrastructure noise, and worse, if someone reverts a bad commit, they also revert state tracking -- breaking lifecycle resume.

**Why it happens:** The execute skill's task loop (Step 5) interleaves implementation (5b) with state updates (5d, 5e). A naive `git add -A && git commit` after each task captures everything modified since the last commit, including all state writes that happened during that task.

**Consequences:** Git history is unreadable (every commit has state.yml changes). Reverting a bad implementation commit also reverts the checkpoint, causing the execute skill to re-execute already-completed tasks. Cherry-picking across branches becomes impossible because state files conflict.

**Prevention:**
- Git commits must ONLY stage implementation files. Explicitly `git add` only the files listed in the task's "Files modified" output -- NEVER use `git add -A` or `git add .`.
- Add `.expedite/` to a staging exclusion pattern. Before each commit, verify no `.expedite/` paths are staged: `git diff --cached --name-only | grep '^\.expedite/'` should return empty.
- The commit message should include DA traceability (e.g., "DA-3/t04: implement caching layer") but the committed files should be pure implementation.
- State files (.expedite/) are already gitignored by the project's .gitignore -- but verify this. If `.expedite/` is NOT in .gitignore, the git commit feature becomes dangerous.

**Detection:** After implementing the first git commit, run `git show --stat HEAD` and verify no `.expedite/` paths appear.

**Phase:** Address in the git commits phase. The staging exclusion must be the first thing implemented, before the commit logic.

---

### P6: Git Commits in Wrong Working Directory

**What goes wrong:** The execute skill runs `git commit` but the user's project root is not the same as the git repository root. Claude Code's working directory may be a subdirectory of the repo, or the project may have nested git repos (monorepo with submodules). The commit happens in the wrong repo, or fails silently because `git` operates on whatever `.git/` directory is nearest in the parent chain.

**Why it happens:** The execute skill uses Bash for file operations and assumes the cwd is the project root. But Claude Code sessions can have their cwd set to any directory. The `!cat .expedite/state.yml` injection uses a relative path, which already implicitly assumes cwd is the project root -- but git operations are more sensitive because `git` traverses parent directories to find `.git/`.

**Consequences:** Commits land in the wrong repository. Or commits fail and the execute skill's error handling (Step 5g) treats it as a task failure rather than a git configuration issue, potentially triggering skip/retry logic for what is actually an environment problem.

**Prevention:**
- Before the first git commit in a lifecycle, validate the git context: run `git rev-parse --show-toplevel` and compare it to the expected project root (derive from `.expedite/` location). If they differ, warn the user and abort git commit functionality for this session.
- Store the validated git root in state.yml (e.g., `git_root: "/path/to/repo"`) and use absolute paths for all git operations: `git -C "$git_root" add ...`.
- If `git rev-parse --git-dir` fails (not a git repo), disable git commit functionality with a clear message rather than failing mid-task.

**Detection:** Test execute with cwd set to a subdirectory of the project. Verify git operations either use the correct root or produce a clear error.

**Phase:** Address as validation logic in the git commits phase, before implementing commit logic.

---

## Moderate Pitfalls

### P7: Skill Extraction Breaks Step Numbering References

**What goes wrong:** The 500-line soft cap requires extracting content from large skills into references/. The research skill (611 lines) and design skill (475 lines, close to cap) have step numbers hardcoded in multiple places: the status skill's lookup table (`scope: 10, research: 18, design: 10, plan: 9, spike: 9, execute: 7`), resume logic that references specific step numbers ("Resume at Step 12"), and step tracking labels. If extraction changes the step count or renumbers steps, every cross-reference breaks.

**Why it happens:** Extraction moves content to references/ files, but step numbering is embedded in the SKILL.md flow. If you extract Steps 7-11 (dispatch pipeline) into a reference, the remaining steps in SKILL.md renumber. But the resume logic in Step 1 Case B says "resume at Step 12" -- that step no longer exists at position 12.

**Consequences:** Resume logic routes to wrong steps. Status skill displays incorrect step counts. Step tracking labels no longer match the actual step being executed.

**Prevention:**
- Extraction must NOT change step numbering. Extract content WITHIN a step (e.g., Step 8's template assembly details move to a reference, but Step 8 still exists as Step 8 and references the extracted content).
- The pattern already exists in research SKILL.md: Steps 7-11 are the dispatch pipeline, but ref-gapfill-dispatch.md is a reference read BY Step 16, not a replacement for steps. Follow this pattern.
- After extraction, verify: (a) step count is unchanged, (b) status skill lookup table is still correct, (c) all "resume at Step N" references still point to the right step.
- Extract procedural detail (how to do X), not structural flow (when to do X). The SKILL.md retains the step sequence; references hold the detailed instructions.

**Detection:** After any extraction, run `/expedite:status` mid-skill and verify the step display matches reality. Also test resume from each possible crash point.

**Phase:** Address in the skill line limit phase. Establish the extraction pattern before touching any skill.

---

### P8: Skill Extraction Breaks !cat Injection Ordering

**What goes wrong:** Skills have a specific load order: frontmatter -> `!cat` injection -> instructions. If extraction introduces additional `!cat` or file-read directives in the SKILL.md body (e.g., "Read the extracted reference before proceeding"), the LLM processes them in document order. But `!cat` in the frontmatter area is processed by Claude Code's plugin loader, while Read tool calls in the body are processed during execution. Mixing these creates ordering confusion where the LLM sees stale state from injection but then reads fresh state from a tool call.

**Why it happens:** The `!cat state.yml` injection captures state at SKILL.md load time (before any instructions execute). If an extracted reference needs current state, it must use a Read tool call, which captures state at execution time. If state changed between load and execution (e.g., another session modified state.yml), the two snapshots differ.

**Consequences:** The skill sees one phase in the injected state and a different phase when it reads the reference's required files. Routing decisions made on injected state may be invalid by the time the extracted reference's instructions execute.

**Prevention:**
- Extracted references should NEVER depend on state.yml content. They receive their context from the SKILL.md orchestrator (which read the injected state and passes relevant fields as context).
- This is already the pattern used by prompt-sufficiency-evaluator.md: it receives `{{project_name}}` and `{{intent}}` as template placeholders, not by reading state.yml itself.
- If a reference needs state data, the SKILL.md must read state.yml (via tool call, getting fresh data) and inject the relevant fields into the reference's context.
- Never add a second `!cat` injection to any SKILL.md -- only one injection point per skill.

**Detection:** Review each extracted reference for any direct state.yml reads. Flag as violations.

**Phase:** Address in the skill line limit phase, as a constraint on the extraction pattern.

---

### P9: State Recovery Restores Stale .bak

**What goes wrong:** The backup-before-write pattern creates `.expedite/state.yml.bak` before every write. But the .bak is always one write behind. If state.yml is corrupted during a write (partial write, disk full, Claude Code crash mid-write), the .bak is the state from BEFORE the write that corrupted -- which could be multiple steps behind the actual progress. Restoring from .bak loses the most recent step's progress.

**Why it happens:** The backup cycle is: read state.yml -> copy to .bak -> modify in memory -> write state.yml. If the write fails, .bak has the pre-modification state. But "one step behind" may mean losing significant progress: a research sufficiency assessment (Step 12 writes all question statuses), a batch of TD resolutions (Step 5 writes each resolution), or the entire gate_history update.

**Consequences:** Recovery from .bak loses the last operation. For most steps this is minor (re-execute one step). But for steps that perform bulk updates (research Step 10 updates all question statuses, execute Step 5d updates task status + checkpoint), recovery can lose substantial progress.

**Prevention:**
- Accept that .bak recovery loses the last write. Document this as expected behavior, not a bug.
- For bulk-update steps (research Step 10, execute Step 5d), consider writing a "pending changes" file before the bulk update, then applying changes, then deleting the pending file. Recovery can check for pending changes and re-apply them.
- Do NOT try to make .bak always current -- that defeats the purpose (if you update .bak after write, then .bak and state.yml are identical, and corruption to one likely corrupts both).
- The recovery feature should report what was lost: "Recovered from backup. Last known state: {phase}, step: {step}. You may need to re-run the current step."

**Detection:** Simulate a crash at each bulk-update step and verify recovery reports what was lost.

**Phase:** Address in the state recovery phase.

---

### P10: State Recovery When .bak Is Also Corrupted

**What goes wrong:** Both state.yml and state.yml.bak are corrupted or missing. The backup-before-write copies state.yml to .bak BEFORE modifying -- but if state.yml was already corrupted (from a prior failed write that was not detected), the .bak inherits the corruption. Two-file corruption leaves no valid state to recover from.

**Why it happens:** The .bak is a copy of state.yml, not an independent checkpoint. If state.yml is silently corrupted (valid YAML but wrong data, or truncated but still parseable), the .bak gets the bad data. Subsequent writes propagate the corruption: bad state.yml -> bad .bak -> skill writes to state.yml (now based on bad data) -> bad .bak again.

**Consequences:** Recovery produces garbage state. The lifecycle appears to be in a random phase with missing or wrong data.

**Prevention:**
- Add YAML validation on every state.yml read: parse the YAML, check that required fields exist (project_name, intent, phase), and validate phase is a known value. If validation fails, try .bak. If .bak also fails validation, fall through to artifact-based reconstruction.
- Artifact-based reconstruction: infer the phase from what files exist on disk. This is the same logic the status skill already uses for artifact cross-referencing (Step 5). Promote this to a shared utility pattern.
- The reconstruction priority: state.yml (if valid) -> state.yml.bak (if valid) -> artifact inference (SCOPE.md exists = at least scope_complete, SYNTHESIS.md exists = at least research_complete, etc.).
- Log the reconstruction event to log.yml so users know recovery happened.

**Detection:** Delete both state.yml and state.yml.bak, then invoke `/expedite:status`. It should reconstruct from artifacts rather than erroring.

**Phase:** Address in the state recovery phase, as the fallback layer below .bak recovery.

---

### P11: Partial YAML Writes Create Unparseable State

**What goes wrong:** Claude Code crashes mid-write. The Write tool produces a partially written state.yml -- valid YAML syntax up to the crash point, then truncated. YAML parsers may accept the partial content (everything up to the truncation is valid syntax), producing a state object with missing fields rather than an error.

**Why it happens:** YAML is a streaming format -- a truncated YAML document can be syntactically valid. If `questions:` array is being written and the write stops after 3 of 8 questions, the YAML parser sees 3 questions and no error. The state appears valid but is incomplete.

**Consequences:** Skills see a state with fewer questions than expected. Research dispatches fewer batches. Execute sees fewer tasks. The damage is silent because no error is thrown.

**Prevention:**
- Add a checksum or sentinel field at the END of state.yml: `_checksum: "{field_count}"` where field_count is the number of top-level fields. If the read state has fewer fields than the checksum claims, the write was truncated.
- Simpler alternative: add `_write_complete: true` as the last field in every write. If this field is absent after a read, the write was truncated -- fall back to .bak.
- The `_write_complete` pattern is low-cost (one extra line per write) and catches all truncation scenarios.

**Detection:** Manually truncate a state.yml file and verify the recovery logic detects the truncation rather than silently using partial data.

**Phase:** Address in the state recovery phase, as part of the validation layer.

---

### P12: Explore Subagent Loses Orchestration Context

**What goes wrong:** Switching the codebase analyst from `general-purpose` to `explore` subagent type changes the tool access and context model. The `explore` type is designed for open-ended codebase exploration, but the research skill's dispatch pipeline (Steps 8-9) assembles prompts with specific template placeholders and expects structured output (evidence files with specific format). If `explore` subagents behave differently from `general-purpose` (different tool access, different return format, different context limits), the collection step (Step 10) fails to parse the output.

**Why it happens:** The prompt-codebase-analyst.md template was designed for `general-purpose` subagents. Its `<output_format>` section specifies an exact Markdown structure with `## Findings for {question_id}` headings, evidence strength ratings, and a condensed return summary under 500 tokens. If `explore` subagents have different capabilities or behavioral tendencies, the template may need adaptation.

**Consequences:** Evidence files are malformed or missing expected sections. The sufficiency evaluator cannot parse them (it expects specific format). Research assessment produces garbage ratings.

**Prevention:**
- Before changing the subagent_type in the template frontmatter, test the `explore` type with the existing prompt template. Verify the output format is preserved.
- If `explore` behaves differently, adapt the template -- do not assume prompt compatibility across subagent types.
- The change is in ONE file (prompt-codebase-analyst.md frontmatter line 2: `subagent_type: general-purpose` -> `subagent_type: explore`). Make this change, test with a real research dispatch, and verify the evidence file format.
- Keep the `general-purpose` version as a fallback: if `explore` produces malformed output, revert the one-line change.

**Detection:** Dispatch a codebase analyst batch with `explore` type and verify the evidence file matches the expected format. Check that the sufficiency evaluator can parse it.

**Phase:** Address in the explore subagent phase. This is a low-risk, isolated change IF tested.

---

### P13: Conditional Alternatives Trigger on Clear-Cut Decisions

**What goes wrong:** The conditional alternative-surfacing feature presents competing options during design/plan when "genuine tradeoffs exist." But the LLM evaluating whether tradeoffs are "genuine" has no objective threshold. It surfaces alternatives for decisions where the evidence overwhelmingly favors one approach, creating noise and decision fatigue for the user. Every DA gets "Alternatives Considered" treatment even when one option is clearly dominant.

**Why it happens:** The design skill already has an "Alternatives Considered" section for each DA (line 219 of SKILL.md: `**Alternatives Considered:** Other approaches evaluated with evidence for/against each`). The new feature would make this dynamic -- surfacing alternatives as interactive choices rather than static documentation. But the trigger condition ("genuine tradeoffs") is inherently subjective. An LLM biased toward helpfulness will over-surface alternatives to seem thorough.

**Consequences:** Users are asked to choose between options when the research already clearly favors one. This slows down the design phase, adds unnecessary decision points, and undermines confidence in the evidence-based approach (if the evidence is clear, why am I being asked to choose?).

**Prevention:**
- Define a concrete trigger: alternatives are surfaced ONLY when the evidence dimension "corroboration" is Weak or when multiple sources explicitly disagree. This is checkable from the sufficiency evaluator's output -- not a new LLM judgment.
- Suppress alternative surfacing when corroboration is Strong or Adequate AND coverage is Strong. In these cases, the evidence has already settled the question.
- The default should be NOT surfacing alternatives. The feature activates for edge cases, not as the normal flow.
- Use the existing evidence quality signals rather than adding a new LLM judgment layer.

**Detection:** Run a design phase where all DAs have Strong corroboration. Verify that zero alternative prompts are surfaced.

**Phase:** Address in the conditional alternatives phase. The trigger condition must be defined before implementation.

---

### P14: Conditional Alternatives Fail to Trigger on Genuine Tradeoffs

**What goes wrong:** The flip side of P13: the feature does NOT trigger when there are genuine tradeoffs. A DA has Adequate corroboration but the evidence genuinely supports two different approaches (e.g., "use Redis" vs "use DynamoDB" with different strengths). The feature does not surface this as a choice because the corroboration threshold is met.

**Why it happens:** If the trigger is purely based on corroboration level (per P13 prevention), it misses the case where evidence is corroborated but points in different directions. Two sources can agree that both Redis and DynamoDB are valid, giving Adequate corroboration, while the actual decision remains genuinely ambiguous.

**Consequences:** The design skill auto-selects one approach without user input on a decision that warranted discussion. Users only discover the unconsidered alternative during execution, causing late-stage redesign.

**Prevention:**
- Add a second trigger: evidence contradiction. If the synthesis flagged conflicting findings for a DA (SYNTHESIS.md "Contradictions" section), surface alternatives regardless of corroboration level.
- The two triggers work together: (a) Weak corroboration -> surface alternatives because evidence is thin, (b) contradictions present -> surface alternatives because evidence disagrees.
- This maps directly to existing synthesis output -- no new LLM judgment needed.
- Present the contradicting evidence to the user: "Sources disagree on DA-3: Source A favors approach X (reasons), Source B favors approach Y (reasons). Which direction?"

**Detection:** Run a design phase where one DA has contradicting evidence in SYNTHESIS.md. Verify the alternative prompt is surfaced for that DA.

**Phase:** Address alongside P13 in the conditional alternatives phase.

---

## Minor Pitfalls

### P15: Git Commits Create Merge Conflicts Mid-Execute

**What goes wrong:** Per-task atomic commits create a series of small commits during execute. If another branch is being developed concurrently (separate lifecycle or manual work), the execute skill's commits create merge conflict potential at every task boundary. Pausing execution, switching branches, and resuming creates a divergent history that requires manual reconciliation.

**Why it happens:** The execute skill is designed for single-branch, linear execution. Git commits add branching complexity that the execute skill's error handling (Step 5g: retry/skip/pause) is not equipped to handle. A merge conflict is not a "task failure" -- it is a git state issue that requires different resolution.

**Consequences:** Execute skill hits a git error it cannot classify. The user sees "retry / skip / pause" but none of these resolve a merge conflict. The skill gets stuck.

**Prevention:**
- Git commit errors should be classified separately from task execution errors. Add a git-specific error handler: if `git commit` returns non-zero, check if it is a merge/rebase conflict (`git status` shows "both modified"). If so, display git-specific guidance rather than retry/skip/pause.
- Consider: execute on a feature branch. Before first commit, create or switch to `expedite/{lifecycle_id}` branch. This isolates execute commits from other work.
- The simplest mitigation: do not auto-commit. Instead, stage and display the commit command for the user to run. This makes git integration advisory rather than automated. Given the complexity of git error handling, advisory mode may be more robust for v1.2.

**Detection:** Start execute, make a conflicting change on the same branch in another terminal, and verify the git error is handled gracefully.

**Phase:** Address in the git commits phase. Decide between auto-commit and advisory-commit early.

---

### P16: Git Commits Expose Sensitive Files

**What goes wrong:** Per-task commits might stage files that contain secrets, API keys, or credentials if a task creates or modifies such files. The task verifier (prompt-task-verifier.md) checks acceptance criteria and design alignment, not security hygiene. A commit could include `.env` files, hardcoded tokens, or credential files that the implementation created.

**Why it happens:** The task verifier's scope is "does this task satisfy its acceptance criteria and align with the design decision?" Security review is not part of the verification rubric.

**Consequences:** Secrets committed to git history. Even if caught and reverted, secrets persist in git reflog and may be pushed to remote.

**Prevention:**
- Before each commit, run a file-type check on staged files: reject any file matching common sensitive patterns (`.env`, `*.key`, `*.pem`, `credentials.*`, `*secret*`).
- Respect the project's `.gitignore` -- verify it covers sensitive patterns before enabling git commits.
- The staging exclusion from P5 (exclude `.expedite/`) should be extended to exclude known sensitive patterns.

**Detection:** Create a test task that generates a `.env` file and verify the git commit flow rejects it.

**Phase:** Address in the git commits phase, as part of the staging validation.

---

### P17: Verifier Agent Context Bloat

**What goes wrong:** The verifier agent needs to read: sufficiency-results.yml (evaluator output), all evidence files (to check reasoning), SCOPE.md (for evidence requirements), and potentially SYNTHESIS.md (for cross-reference). For a lifecycle with 15 questions and 5 evidence files, this could be 30K-50K tokens of input -- exceeding practical context limits for a subagent and increasing latency and cost.

**Why it happens:** Reasoning verification requires seeing both the evidence and the claims made about it. Unlike the sufficiency evaluator (which already reads all evidence), the verifier must ALSO read the evaluator's conclusions to check whether the reasoning from evidence to conclusion is sound. This is strictly more context than the evaluator uses.

**Consequences:** Verifier times out or produces shallow analysis due to context pressure. Verification quality degrades with lifecycle complexity.

**Prevention:**
- Scope the verifier to check only PARTIAL and NOT COVERED questions, not COVERED ones. The highest-value verification targets are questions where the evaluator found gaps -- these are where reasoning errors most impact the lifecycle.
- Alternatively, send questions to the verifier one at a time (per-question verification) rather than all at once. This keeps context manageable but increases dispatch count.
- Set a hard token budget for the verifier. If total evidence exceeds the budget, prioritize P0 questions.
- Use `<self_contained_reads>` pattern (like the evaluator) so the verifier reads files itself rather than having them injected -- this lets Claude Code manage context more efficiently.

**Detection:** Run verification on a lifecycle with 15+ questions and monitor token usage and response quality.

**Phase:** Address in the verifier agent phase, as a design constraint.

---

### P18: Race Conditions Between Scoped State Files

**What goes wrong:** After state splitting, two rapid skill invocations (e.g., user runs `/expedite:status` immediately after `/expedite:research`) could read and write different scoped files concurrently. The status skill reads state-core.yml while the research skill writes state-research.yml AND state-core.yml (to update phase). If the status skill's read of state-core.yml happens between research's read and write, status displays stale data. Worse, if status somehow writes (violating its read-only contract), it could overwrite research's changes.

**Why it happens:** Claude Code sessions are single-threaded within a conversation, but users can open multiple conversations or use `/clear` between rapid invocations. The backup-before-write pattern does not provide locking -- it is a "last writer wins" model.

**Consequences:** State data inconsistency between files. One scoped file reflects a newer state than another. Skills that read multiple scoped files may see contradictory states.

**Prevention:**
- This is largely a theoretical concern in Claude Code's single-user model. Two skills cannot run simultaneously in the same conversation. The risk is only from multiple conversations operating on the same `.expedite/` directory.
- Mitigate with a lightweight lock: write a `.expedite/.lock` file with a timestamp before modifying state. Check for the lock before writing. If the lock is older than 60 seconds, assume it is stale and override.
- Simpler: accept eventual consistency. Document that running two skills in parallel conversations on the same lifecycle is unsupported. The status skill is already read-only, so the primary risk is theoretical.
- The backup-before-write pattern already handles the common case (one skill, one conversation). Do not over-engineer for edge cases.

**Detection:** This is hard to test. The mitigation is documentation, not code.

**Phase:** Address in the state splitting phase, as a documented limitation.

---

### P19: Skill Extraction Loses Context for Task() Subagents

**What goes wrong:** When extracting content from skills into references/, the extracted content may include context that Task() subagents need. If a reference file is assembled into a subagent prompt (like the research templates), extraction that restructures the content could break the `{{placeholder}}` replacement pipeline (Step 8) or the subagent's expected context.

**Why it happens:** The template assembly pipeline (research Step 8) reads reference files, replaces placeholders, and dispatches. If extraction moves content that contains `{{placeholders}}` into a different file structure, the assembly step may not find or replace all placeholders, triggering the "unreplaced placeholder" error (Step 8 instruction 5).

**Consequences:** Research dispatch fails with template assembly errors. The error message is clear ("unreplaced placeholder found") but the cause is non-obvious if the developer does not connect it to the extraction.

**Prevention:**
- Never extract reference files that serve as subagent prompt templates (prompt-*.md files in references/). These are already extracted content -- they are the TARGET of extraction, not candidates for further extraction.
- Extraction applies to SKILL.md orchestrator content, not to reference files. SKILL.md has procedural instructions; references have prompt templates. Do not confuse the two.
- If SKILL.md content references a template file path (e.g., `Read skills/research/references/prompt-web-researcher.md`), ensure the path reference survives extraction.

**Detection:** After extraction, run a full research dispatch and verify template assembly succeeds.

**Phase:** Address in the skill line limit phase, as a constraint.

---

### P20: Git Commit Messages Lack Sufficient DA Traceability

**What goes wrong:** Per-task commits should include DA traceability for audit purposes (a v1.2 goal). But the commit message generation relies on the LLM correctly extracting the DA-X reference from the task definition and including it in the commit message. If the LLM produces generic messages ("implement task t04") instead of traced messages ("DA-3/t04: add caching layer"), the traceability value is lost.

**Why it happens:** Commit message generation is prompt-instructed, not template-enforced. The LLM has latitude in how it formats the message. Without a strict template, the format will drift.

**Consequences:** Git history loses DA traceability. The "per-task atomic git commits with DA traceability" requirement is only half-met (atomic but not traced).

**Prevention:**
- Use a commit message template, not freeform generation. Template: `{DA-X}/{task_id}: {task_title}` for the first line, with optional body for details.
- The execute skill constructs the message programmatically from the task definition, not via LLM generation. The DA reference is already available in the task data structure.
- Validate the commit message before committing: check that it matches the pattern `DA-\d+/t\d+:`.

**Detection:** After implementing git commits, check the last 5 commits with `git log --oneline` and verify DA references are present.

**Phase:** Address in the git commits phase.

---

### P21: Recovery Logic Conflicts with Active Skill Execution

**What goes wrong:** The state recovery feature detects malformed state.yml and auto-recovers from .bak. But if recovery triggers DURING an active skill's execution (e.g., a skill reads state.yml, gets garbage, and triggers recovery before continuing), the recovery overwrites state.yml with .bak data -- which may not include changes from earlier steps in the SAME skill invocation.

**Why it happens:** Skills perform multiple state.yml writes per invocation (one per step for step tracking, plus operational writes). If an early write succeeds but a later read triggers recovery, the .bak contains the state from before the skill started, not from between steps.

**Consequences:** Recovery mid-skill resets progress for the current skill invocation. The skill continues executing but now has stale state -- step tracking shows Step 1 when the skill is actually on Step 5.

**Prevention:**
- Recovery should ONLY trigger at skill entry (Step 1), never mid-skill. If a mid-skill read returns malformed YAML, treat it as an error (display error, STOP), not as a recovery trigger.
- The distinction is: Step 1 recovery is "last session crashed, let me restore state." Mid-skill recovery is "something went wrong right now, stopping is safer than guessing."
- Add a `_in_skill: true` flag to state.yml at skill entry, clear it at skill completion. If recovery sees `_in_skill: true` in the .bak, it knows the .bak is from a mid-skill state and adds a warning.

**Detection:** Corrupt state.yml mid-skill (between steps) and verify the skill stops rather than silently recovering and continuing.

**Phase:** Address in the state recovery phase.

---

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Severity | Mitigation |
|-------------|---------------|----------|------------|
| State Recovery | P9: .bak is one write behind; P10: both files corrupted; P11: partial writes look valid | Critical + Moderate | Validate on read, sentinel field, artifact-based fallback |
| State Splitting | P1: !cat injection breaks; P2: migration data loss; P18: race conditions | Critical + Minor | Keep routing fields in single file, version field, document limitations |
| Skill Line Limit | P7: step renumbering; P8: injection ordering; P19: subagent templates | Moderate + Minor | Extract within steps not across them, never extract prompt templates |
| Git Commits | P5: wrong files staged; P6: wrong directory; P15: merge conflicts; P16: sensitive files; P20: message format | Critical + Minor | Explicit file staging, directory validation, advisory mode fallback |
| Verifier Agent | P3: disagrees with evaluator; P4: infinite loops; P17: context bloat | Critical + Minor | Verifier is advisory only, cap recycle influence, scope to non-COVERED |
| Conditional Alternatives | P13: over-triggers; P14: under-triggers | Moderate | Use evidence signals (corroboration + contradictions), not new LLM judgment |
| Explore Subagent | P12: format mismatch | Moderate | Test with existing template before deploying |

## Recommended Build Order

Based on pitfall dependency analysis:

1. **State Recovery** (P9/P10/P11/P21) -- Foundation layer. Every subsequent feature benefits from recovery if things go wrong. Low blast radius (additive, does not change existing write paths).
2. **Explore Subagent** (P12) -- One-line change with testing. Isolated, lowest risk. Quick win.
3. **Conditional Alternatives** (P13/P14) -- Moderate risk, contained to design/plan skills. Uses existing evidence signals.
4. **Skill Line Limit** (P7/P8/P19) -- Moderate risk, requires careful extraction pattern. Better to do before state splitting (smaller skills are easier to audit for !cat contract).
5. **State Splitting** (P1/P2/P18) -- High blast radius, touches every skill. Requires all skills to be in final form (post-extraction) before splitting.
6. **Verifier Agent** (P3/P4/P17) -- New agent infrastructure. Benefits from stable state management (needs to read state reliably). Authority hierarchy must be designed upfront.
7. **Git Commits** (P5/P6/P15/P16/P20) -- Highest interaction complexity. Benefits from all other infrastructure being stable. Consider advisory mode for v1.2, auto-commit for v1.3.

## Integration Pitfalls (Cross-Feature)

### I1: State Recovery + State Splitting Interaction
If state recovery is implemented before state splitting, recovery logic targets monolithic state.yml. When state splitting lands, recovery must be updated to handle scoped files. Build recovery with extensibility in mind -- recovery should validate whatever file structure exists, not assume monolithic.

### I2: Verifier Agent + Conditional Alternatives Interaction
If the verifier flags reasoning issues on a DA, and conditional alternatives surfaces choices for the same DA, the user sees two different signals about the same decision area. Coordinate: if the verifier flagged a DA, the alternatives feature should incorporate the verifier's concern into the presented options.

### I3: Git Commits + Skill Extraction Interaction
If skill extraction changes file paths (references/ structure), and git commits are configured to commit implementation files only, ensure the git staging exclusion list is updated to reflect any new paths that should be excluded.

## Open Questions

1. Should git commits be auto-commit or advisory-commit for v1.2? (P15 suggests advisory is safer)
2. Should the verifier agent be a Task() subagent (like the evaluator) or a separate skill? The memory note says "external agent like GSD's gsd-verifier pattern" which implies Task().
3. Should state splitting happen in v1.2 at all? It has the highest blast radius (P1/P2) and the current monolithic state.yml is under the 100-line soft limit. The motivation may not justify the risk.
4. How should the `_write_complete` sentinel (P11) interact with the existing backup-before-write pattern? It adds one more field to every write, increasing the 42 write sites to 42 writes + 42 sentinel updates.

---
*Research completed: 2026-03-11*
*Source: Codebase analysis of 7 skills, 13 reference files, 42 backup-before-write instances, 7 !cat injection points*
*Confidence: HIGH -- all pitfalls derived from direct codebase patterns, not hypothetical concerns*
