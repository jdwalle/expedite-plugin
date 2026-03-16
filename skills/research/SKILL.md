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
  - Agent
  - AskUserQuestion
  - WebSearch
  - WebFetch
---

Current lifecycle state:
!`cat .expedite/state.yml 2>/dev/null || echo "No active lifecycle"`

Checkpoint:
!`cat .expedite/checkpoint.yml 2>/dev/null || echo "No checkpoint"`

Questions:
!`cat .expedite/questions.yml 2>/dev/null || echo "No questions"`

Session context:
!`cat .expedite/session-summary.md 2>/dev/null`

Override protocol:
!`cat skills/shared/ref-override-protocol.md 2>/dev/null || echo "No override protocol found"`

# Research Skill

You are the Expedite research orchestrator. Dispatch parallel research agents to gather evidence for scoped questions, collect findings, assess sufficiency, and synthesize results. You are the second stage of the contract chain: scope questions flow through you to agents, and their findings flow downstream to design and planning.

**Interaction model:** Use AskUserQuestion for structured choices. Use freeform for open-ended modifications.

**After completing each step, proceed to the next step automatically.**

**Step tracking (all steps):** Before each step, update `current_step` in state.yml (backup-before-write: read, `cp state.yml state.yml.bak`, set `current_step` to `{skill: "research", step: N, label: "name"}`, set `last_modified`, write back). Write checkpoint.yml: `skill: "research", step: N, label: "name", substep: null, continuation_notes: null, inputs_hash: null, updated_at: timestamp`.

**State write timing:** State.yml and checkpoint.yml writes happen ONLY at step boundaries -- before and after agent dispatch. Agents produce artifacts on disk; the skill reads results and writes state afterward.

## Instructions

### Step 1: Prerequisite Check

**State Recovery Preamble:** If injected state shows "No active lifecycle":
1. Follow `skills/shared/ref-state-recovery.md` (Glob `**/ref-state-recovery.md` if needed).
2. Recovery succeeds: re-read state.yml, use recovered values for Case routing.
3. Recovery fails: "No recovery source found. Run /expedite:scope to start a new lifecycle." STOP.

**Case A: `phase: "scope_complete"`** -- Read SCOPE.md and state.yml. Display: `Scope: "{project_name}" ({intent}). {N} questions across {M} DAs, {K} sources enabled.` Proceed to Step 3.

**Case B: `phase: "research_in_progress"`** -- Resume. If checkpoint.skill is "research", resume from checkpoint.step. Otherwise use artifact heuristic: evidence files exist -> Step 9; batches formed -> Step 5; only initialized -> Step 4. AskUserQuestion: Continue/Start over (start over -> revert to scope_complete and STOP).

**Case C: Any other phase** -- "Research requires scope_complete phase. Current: {phase}. Run /expedite:scope first." STOP.

### Step 2: Read Scope Artifacts

Read `.expedite/scope/SCOPE.md` and `.expedite/state.yml`. Extract: project_name, intent, lifecycle_id, questions array, decision areas. Display loading summary with question count and DA breakdown.

### Step 3: Initialize Research State

Backup-before-write state.yml: set `phase: "research_in_progress"`, increment `research_round`, set current_step. Log phase transition to log.yml: `from_phase: "scope_complete", to_phase: "research_in_progress"`. Display: "Phase: research_in_progress (round {research_round})".

### Step 4: Evidence Planning

Group questions by `source_hints` into batches (web, codebase, mcp). Rules: skip `"covered"` questions; assign to first enabled source; fallback to web. Max 5 batches. Sort by priority within each. Present batch plan for approval (freeform: approve/modify/cancel). Validate DA coverage -- warn if any DA has zero batched questions. On cancel: revert to scope_complete, STOP.

*Merged steps: Original Steps 4 (Form Batches), 5 (Validate DA Coverage), 6 (Present Batch Plan).*

### Step 5: Agent Dispatch

*Merged steps: Original Steps 7 (Pre-Validate Sources), 8 (Assemble Prompts), 9 (Dispatch Agents).*

**5a. Pre-validate sources:** `mkdir -p .expedite/research`. Web/codebase always available. MCP sources: probe first tool. If unavailable, offer: fix/reroute to web/skip.

**5b. Dispatch agents in parallel.** For each batch, dispatch the appropriate agent by name via the Agent tool:
- `"web"` source -> dispatch the `web-researcher` agent
- `"codebase"` source -> dispatch the `codebase-researcher` agent

Pass assembled context: project_name, intent, research_round, output paths, questions YAML block with evidence_requirements. The agent's model, tool restrictions, and maxTurns are defined in its frontmatter at `agents/{agent-name}.md`. Max 3 concurrent agents.

**5c. Validate agent output on return:** After each agent returns, verify the expected evidence file exists at `.expedite/research/evidence-{batch_id}.md`. If the file does not exist or is empty, display: "Agent {name} did not produce expected output at {path}. Retry? (yes/skip)". If retry: re-dispatch once. If skip or second failure: mark questions as "not_covered".

Display progress as agents complete. Log agent completions and any source failures to log.yml.

### Step 9: Collect Results and Update State

*Original Step 10.* Read each agent's condensed return summary (~500 tokens). Extract per-question status from GAPS section. Collect PROPOSED_QUESTIONS into queue. Update state.yml (backup-before-write): set `evidence_files`, set preliminary `status` (covered/partial/not_covered/unavailable_source). Log agent completions.

### Step 11: Research Completion Summary

Display structured summary: batches dispatched/completed/failed, question status counts, evidence file paths, proposed question count. Write proposed questions to `.expedite/research/proposed-questions.yml` if any. Phase stays at research_in_progress.

### Step 12: Sufficiency Assessment

Dispatch the `sufficiency-evaluator` agent via the Agent tool. Pass assembled context: project_name, intent, research_round. Apply intent lens. The agent reads evidence + scope itself and writes results to `.expedite/research/sufficiency-results.yml`.

After agent returns: verify `.expedite/research/sufficiency-results.yml` exists on disk. If missing, display error: "Agent sufficiency-evaluator did not produce expected output at .expedite/research/sufficiency-results.yml. Retry? (yes/skip)". If retry: re-dispatch once. If skip or second failure: fall back to manual assessment.

Read results. Handle UNAVAILABLE-SOURCE questions (AskUserQuestion: accept gap/suggest alternative/override). Update state.yml with final statuses and gap_details. Display assessment summary table.

### Step 13: Dynamic Question Discovery

Read `.expedite/research/proposed-questions.yml`. If empty/missing, skip to Step 14. Deduplicate against existing questions (LLM semantic dedup, not string matching). Cap at 4. Present to user (freeform: approve all/specific/none/modify). Add approved questions to state.yml and SCOPE.md.

### Step 14: G2 Gate Evaluation (Dual-Layer)

**Layer 1: Structural gate** -- deterministic Node.js script. No LLM judgment.

**Invoke structural script:**
Run via Bash: `node gates/g2-structural.js "$(pwd)"`

The script reads SYNTHESIS.md, SCOPE.md, and evidence files, evaluates structural criteria, writes the result to gates.yml, and prints JSON to stdout.

**Read script output:** Parse the JSON stdout. Extract `outcome` and `failures`.

**If structural outcome is "recycle":** The semantic layer does NOT run. Display structural failures. Proceed to Step 15 with the structural recycle outcome.

**If structural outcome is "go" or "go_advisory":** Proceed to Layer 2.

**Layer 2: Semantic verification (G2-semantic)** -- gate-verifier agent dispatch.

This is a focused check: are the evidence sufficiency ratings ("strong", "adequate", "insufficient") in the readiness assessment justified by the evidence actually cited? This is NOT a full 4-dimension design evaluation -- but the gate-verifier still scores all 4 dimensions, with evidence_support being the primary discriminator for G2-semantic.

Dispatch the `gate-verifier` agent by name via the Agent tool. Pass:
- `gate_id`: "G2-semantic"
- `artifact_path`: ".expedite/research/SYNTHESIS.md"
- `scope_path`: ".expedite/scope/SCOPE.md"
- `context_paths`: ".expedite/research/sufficiency-results.yml" (if exists, else omit)
- `output_file`: ".expedite/research/g2-semantic-verification.yml"

**Validate verifier output on return:** Read `.expedite/research/g2-semantic-verification.yml`. Verify completeness:
1. File exists and is non-empty
2. All 4 dimensions present: evidence_support, internal_consistency, assumption_transparency, reasoning_completeness
3. Each dimension has numeric `score` between 1 and 5
4. Each dimension has non-empty `reasoning` text
5. `overall.outcome` is one of: "go", "go-with-advisory", "recycle"

If validation fails: "Gate-verifier produced incomplete evaluation: {missing fields}. Re-run? (yes/skip)". On re-run: re-dispatch once. On skip or second failure: fall back to structural-only result with advisory note.

**Determine combined outcome:** Use the gate-verifier's `overall.outcome` as the final gate outcome. Map: "go" -> go, "go-with-advisory" -> go_advisory, "recycle" -> recycle.

**Record semantic gate result to `.expedite/gates.yml`:**
Read existing gates.yml. Append to history array:
```yaml
history:
  - gate: "G2"
    timestamp: "{ISO 8601 UTC}"
    outcome: "{go|go_advisory|recycle}"
    evaluator: "gate-verifier"
    semantic_scores:
      evidence_support: {N}
      internal_consistency: {N}
      assumption_transparency: {N}
      reasoning_completeness: {N}
    notes: "G2-semantic: readiness assessment quality check. {verifier summary}"
    overridden: false
```

Log gate outcome (both layers) to log.yml. Display: structural pass/fail, semantic dimension scores, overall outcome.

### Step 15: Gate Outcome Handling

**Go** -> "G2 gate passed. Research sufficient for design." -> Step 17.

**Go-with-advisory** -> Show SHOULD failures. Freeform: "1. Proceed with advisory | 2. Run gap-fill." Proceed -> Step 17. Gap-fill -> treat as Recycle -> Step 16.

**Recycle** -> Read `skills/research/references/ref-recycle-escalation.md` (Glob if needed). Show gaps. User: approve gap-fill -> Step 16 / adjust+re-gate -> Step 14 / override -> write override to gates.yml per ref-override-protocol.md, then Step 17.

**Override handling:** Record override in gates.yml (outcome: "overridden", override_reason, severity). Write `.expedite/research/override-context.md`. Log override to log.yml.

### Step 16: Gap-Fill Dispatch

Filter deficient questions (partial/not_covered/pending). Increment research_round. `mkdir -p .expedite/research/round-{N}/`. Read `skills/research/references/ref-gapfill-dispatch.md` (Glob if needed). Re-batch by DA. Dispatch gap-fill agents using Step 5 pattern with narrowed question set and additive supplement output paths. After completion: return to Step 12 for re-assessment.

### Step 17: Synthesis Generation

Dispatch the `research-synthesizer` agent via the Agent tool. Pass assembled context: project_name, intent, research_round, evidence_dir, scope_file, output_file (.expedite/research/SYNTHESIS.md), timestamp. Apply intent lens. If go-with-advisory: inject advisory context. If override: inject override context.

After agent returns: verify `.expedite/research/SYNTHESIS.md` exists on disk. If missing, display error: "Agent research-synthesizer did not produce expected output at .expedite/research/SYNTHESIS.md. Retry? (yes/skip)". If present, display confirmation with file size.

### Step 18: Research Completion

Update state.yml (backup-before-write): set current_step null, phase "research_complete", last_modified.

Write completion checkpoint: `step: "complete", label: "research complete", continuation_notes: "Research complete. Next: /expedite:design"`.

Log phase transition: `from_phase: "research_in_progress", to_phase: "research_complete"`.

Display summary: project, intent, rounds, question status breakdown, artifact paths. "Next step: Run `/expedite:design` to generate a design document." STOP.
