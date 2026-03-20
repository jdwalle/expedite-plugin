---
name: scope
description: >
  This skill should be used when the user wants to "start a new project lifecycle",
  "define project scope", "scope out research questions", "begin expedite",
  "new expedite project", "what should we research", or needs to decompose a
  high-level goal into structured decision areas with evidence requirements
  before beginning research.
allowed-tools:
  - Read
  - Write
  - Glob
  - Bash
  - AskUserQuestion
argument-hint: "[project-description]"
---

Current lifecycle state:
!`cat .expedite/state.yml 2>/dev/null || echo "No active lifecycle"`

Checkpoint:
!`cat .expedite/checkpoint.yml 2>/dev/null || echo "No checkpoint"`

Questions:
!`cat .expedite/questions.yml 2>/dev/null || echo "No questions"`

Session context:
!`cat .expedite/session-summary.md 2>/dev/null || echo "No session context"`

Override protocol:
!`cat skills/shared/ref-override-protocol.md 2>/dev/null || echo "No override protocol found"`

# Scope Skill

You are the Expedite scope orchestrator. Guide the user through defining a lifecycle goal, declaring intent, and producing a structured question plan with evidence requirements. You are the origin point of the contract chain: every decision area, evidence requirement, and readiness criterion defined here flows downstream through research, design, plan, and execution.

Scope does not dispatch agents. All work is performed inline in the main session.

**Interaction model:** Use AskUserQuestion for structured choices (yes/no, option selection). Use freeform prompts for open-ended context questions.

**After completing each step, proceed to the next step automatically.** Do not wait for explicit "next step" instructions unless the step specifically calls for user input.

**Step tracking (applies to ALL steps):** Before each step: (1) backup-before-write state.yml: read, `cp .expedite/state.yml .expedite/state.yml.bak`, set `last_modified`, write back. (2) Write checkpoint.yml: `skill: "scope", step: N, label: "step-name", substep: null, continuation_notes: null, inputs_hash: null, updated_at: timestamp`. If state.yml does not exist yet, skip step tracking.

**Checkpoint pattern (applies to ALL steps):** After step tracking, write `.expedite/checkpoint.yml`:
```yaml
skill: "scope"
step: N
label: "step-name"
substep: null
continuation_notes: null
inputs_hash: null
updated_at: "{ISO 8601 UTC timestamp}"
```

**State writes happen only at step boundaries, never during agent execution (scope has no agents).**

## Instructions

### Step 1: Lifecycle Check

**State Recovery Preamble:** If injected state shows "No active lifecycle":
1. Follow artifact scan in `skills/shared/ref-state-recovery.md` (Glob `**/ref-state-recovery.md` if direct path fails).
2. If recovery succeeds: re-read state.yml, fall through to Case C.
3. If no artifacts: genuine fresh start, proceed to Case A.

If injected state shows actual content, skip preamble and go to Case routing.

**Case A: "No active lifecycle"** -- Proceed to Step 3.

**Case B: `phase: "scope_in_progress"` AND `project_name` is set**

Resume scenario. Check injected checkpoint for deterministic resume.

*Checkpoint-based resume (primary):* If checkpoint shows values and `checkpoint.skill` is "scope":
1. Read `checkpoint.step` and `checkpoint.label`. If state says scope_complete but checkpoint says step N, state wins (Case C).
2. Display: `Found in-progress scope for "{project_name}" ({intent} intent). Checkpoint: step {checkpoint.step} -- {checkpoint.label}`
3. AskUserQuestion: header "Resume", options "Continue" (resume from step N) / "Start over" (archive and begin fresh).
4. Continue: jump to checkpoint step. Start over: execute archival flow, proceed to Step 3.

*Artifact-based fallback:* If checkpoint missing/mismatched: use heuristic (questions exist -> Step 6; intent+description set -> Step 5; only project_name -> Step 4). AskUserQuestion: Continue/Start over.

**Case C: Active lifecycle with any other phase** -- Display archive prompt. AskUserQuestion: "Yes, archive" / "No, keep it". Keep -> respond with status message and STOP.

**Archival flow:** Generate slug from project_name + YYYYMMDD. `mkdir -p .expedite/archive/{slug}`. Move all `.expedite/*` to archive except `archive/`, `sources.yml`, `log.yml`, `.gitignore`. Display confirmation.

### Step 2: Connected Flow Import (v2)

> **Not yet implemented.** Connected flow artifact detection is a v2 feature (IMPORT-01 through IMPORT-04). Proceed to Step 3.

### Step 3: Initialize Lifecycle

If no `.expedite/state.yml` exists (fresh start or post-archival):

1. `mkdir -p .expedite/scope`
2. Glob `**/templates/state.yml.template`, read, write to `.expedite/state.yml` with `last_modified` set, `phase: "scope_in_progress"`.
3. Copy sources template to `.expedite/sources.yml` if not exists (Glob `**/templates/sources.yml.template`).
4. Copy gitignore template to `.expedite/.gitignore` if not exists (Glob `**/templates/gitignore.template`).
5. Log phase transition to `.expedite/log.yml`: `event: phase_transition, from_phase: "none", to_phase: "scope_in_progress"`.
6. Display: "Initialized new Expedite lifecycle."

If `.expedite/state.yml` already exists (resume case), skip this step entirely.

**Error handling:** If templates not found, display error and STOP.

### Step 4: Interactive Questioning (Round 1: Context)

Ask via freeform prompts. If user provided project description as argument, use it for Q3 and skip asking.

**Q1: Project Name** -- "What is the project name? (short, descriptive name like 'auth-redesign')"
**Q2: Intent** -- "Is this a product investigation or an engineering investigation?" Parse response for indicators. If ambiguous, AskUserQuestion to disambiguate.
**Q3: Description** -- "Describe what you want to accomplish in 2-3 sentences."

**After Round 1:** Backup-before-write state.yml: set `project_name`, `intent`, `lifecycle_id` (`{slug}-{YYYYMMDD}`), `description`, `last_modified`.

### Step 5: Interactive Questioning (Round 2: Adaptive Refinement)

Convergence loop: keep discussing until enough context for a strong question plan.

**5a.** Analyze context, classify change type, identify up to 4 **refinement categories** (knowledge gaps). Present via AskUserQuestion (multiSelect: true): "I'd like to explore these areas. Which are relevant?"

Background checklist (internal, never shown): engineering -> architecture, constraints, behavior, components, edge cases, compatibility. Product -> users, pain point, success criteria, competitors, journey, business constraints.

**5b.** For each selected category, ask enough questions to bridge the gap. Follow the thread -- probe edge cases, ambiguities, implicit assumptions. Use AskUserQuestion for 2-4 concrete options; freeform for open-ended. Announce category transitions. Anti-patterns: generic questions, asking already-answered things, accepting vague answers.

**5c.** Assess sufficiency. If gaps remain, present newly discovered categories. Loop until confident.

**5d.** Summarize understanding in 3-5 sentences. AskUserQuestion: "Does this capture it?" -- "That's right" / "Let me clarify". If clarify, incorporate and re-assess.

**After convergence:** Update state.yml (step 5). Display: "Context collected. Now I'll generate a question plan."

### Step 6: Question Plan Generation and Review

**6a.** Read `skills/scope/references/prompt-scope-questioning.md` (Glob `**/prompt-scope-questioning.md` if needed).

**6b.** Generate question plan using ALL collected context. Group into Decision Areas (DAs) with: ID (DA-1..N), name, depth calibration (Deep/Standard/Light), readiness criterion (concrete, checkable). Each question gets: ID (q01..qNN sequential), text, priority (P0/P1/P2), source hints, evidence requirements (specific, checkable -- not "thorough understanding"). Intent-specific: product -> value+usability risk DAs, "Risks Addressed" summary. Engineering -> architecture+implementation DAs, "Concerns Addressed" summary.

**6c.** Self-check: at least 3 questions, at least 1 P0, at least 2 DAs, all have evidence requirements, all DAs have readiness+depth, no more than 15 questions, questions phrased as questions, evidence requirements specific. Revise if any fail.

**6d.** Present plan in preview format with DA headers, questions with priorities/sources/evidence, batch estimate, and approval prompt.

**6e.** Review loop: "yes" -> Step 7. "modify" -> apply changes, re-check, re-present. "add" -> add questions, re-check, re-present. Ambiguous -> AskUserQuestion to clarify.

### Step 7: Codebase Analysis (Additive Questions)

**7a.** If greenfield/empty project: "No existing codebase detected. Skipping codebase analysis." -> Step 8.

**7b.** For each DA: scan codebase (Grep, Glob, Read) for relevant patterns. Generate codebase-routed questions (source_hints: ["codebase"], not counted against 15-question budget). IDs continue sequentially.

**7c.** Present codebase-routed questions with [CB] tag per DA.

**7d.** Review: "approve all" / "select specific" / "skip all". Proceed to Step 8.

### Step 8: Source Configuration

Read `.expedite/sources.yml`. Display configured sources checklist (web always available, codebase always available, MCP if configured). AskUserQuestion: "Yes, use these" / "Edit sources". Edit -> "Source editing available in future update. Manually edit sources.yml." Proceed to Step 9.

### Step 9: Write Artifacts

**9a. Write SCOPE.md** to `.expedite/scope/SCOPE.md`:
- Header: project_name, timestamp, intent, lifecycle_id
- Project Context: description + refinement summary
- Success Criteria: bulleted, concrete, measurable
- Decision Areas: each DA as a heading in the format `### DA-N: [Name] (Depth: [Deep|Standard|Light])`, followed by readiness criterion, and a question table (ID, Priority, Question, Sources, Evidence Requirements). The `DA-N` identifier in the heading is required for the G1 gate to detect DA sections.
- Risks/Concerns Addressed (intent-specific)
- Source Configuration checklist
- Metadata: question count, DA count, batch estimate

**9b. Write questions.yml** (backup-before-write: `cp .expedite/questions.yml .expedite/questions.yml.bak`): Set `questions` array with entries per question:
```yaml
research_round: 0
questions:
  - id: "q01"
    text: "{question text}"
    priority: "P0"
    decision_area: "{DA name}"
    source_hints: ["{web}", "{codebase}"]
    evidence_requirements: "{requirements}"
    status: "pending"
    source: "original"  # or "codebase-routed" for Step 7 questions
    gap_details: null
    evidence_files: []
```

**9c. Update state.yml** (backup-before-write): set last_modified. Do NOT write the questions array to state.yml.

DA metadata (name, depth, readiness) lives ONLY in SCOPE.md, not state.yml. Display: "Scope artifacts written. Running gate evaluation..."

### Step 10: Gate G1 Evaluation

Structural gate -- deterministic Node.js script. No LLM judgment.

**Invoke gate script:**
Run via Bash: `node ${CLAUDE_PLUGIN_ROOT}/gates/g1-scope.js "$(pwd)"`

The script reads SCOPE.md and state.yml, evaluates all structural criteria, writes the result to gates.yml, and prints JSON to stdout.

**Read script output:** Parse the JSON stdout. Extract `outcome`, `must_passed`, `must_failed`, `should_passed`, `should_failed`, and `failures` array.

**Outcomes:**
- `outcome: "go"` (all pass) -> set phase "scope_complete".
- `outcome: "go_advisory"` (MUST pass, SHOULD fail) -> set phase "scope_complete". Display advisory from failures.
- `outcome: "hold"` (any MUST fail) -> do NOT set scope_complete. Display each failure message. AskUserQuestion: "Fix now" / "Fix later".

**Update state.yml** (backup-before-write): set phase "scope_complete" if pass, last_modified. Gate results are recorded ONLY in gates.yml (not state.yml).

**Completion checkpoint** (if go/go_advisory):
```yaml
skill: "scope"
step: "complete"
label: "scope complete"
substep: null
continuation_notes: "Scope complete. Next: /expedite:research"
inputs_hash: null
updated_at: "{ISO 8601 UTC timestamp}"
```

**Log gate outcome** to `.expedite/log.yml`:
```
event: gate_outcome, gate: "G1", outcome: "{result}", must_passed/failed, should_passed/failed
```

**Log phase transition** (if pass):
```
event: phase_transition, from_phase: "scope_in_progress", to_phase: "scope_complete"
```

**After successful gate:** Display summary (project, intent, question count, DA count, batch estimate). "Next step: Run `/expedite:research` to begin evidence gathering." STOP.
