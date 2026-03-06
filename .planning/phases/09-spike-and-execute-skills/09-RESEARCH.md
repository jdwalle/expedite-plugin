# Phase 9: Spike and Execute Skills - Research

**Researched:** 2026-03-06
**Domain:** LLM-orchestrated tactical decision resolution (spike) and plan execution with checkpoint/resume (execute)
**Confidence:** HIGH

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| SPIKE-01 | Spike reads phase definition from PLAN.md and plans detailed implementation steps with traceability (step -> tactical decision -> strategic DA) | Spike SKILL.md reads PLAN.md, extracts the specified wave/epic, resolves its tactical decisions, and produces a SPIKE.md with implementation steps. Traceability is the core contract chain extension: each step traces to a TD, each TD traces to a DA. |
| SPIKE-02 | For unresolved tactical decisions, spike optionally spawns focused research in a separate context to resolve them before step planning | Spike can dispatch a Task() subagent for focused research on a specific tactical decision (e.g., "which caching strategy?"). This is optional -- the user chooses whether to research or resolve inline. Uses the same Task() pattern as the research skill. |
| SPIKE-03 | SPIKE.md artifact written to `.expedite/plan/phases/{phase}/SPIKE.md` with tactical decisions resolved and implementation steps planned | Standard artifact pattern. Directory is per-phase within the plan directory. SPIKE.md includes resolved tactical decisions + ordered implementation steps. |
| SPIKE-04 | Spike is not gated -- no revision cycles or quality gates; user reviews output before execution | Spike is lightweight and deliberate -- no G5 gate, no revision loop. The user reads SPIKE.md and runs execute. If unhappy, re-runs spike. |
| SPIKE-05 | Spike is optional -- execute can proceed without it but nudges if unresolved tactical decisions detected | Execute checks for SPIKE.md existence. If missing AND phase has needs-spike tactical decisions, display a non-blocking nudge. Execute proceeds either way. |
| EXEC-01 | Execute reads SPIKE.md (if exists) and follows planned implementation steps; if no SPIKE.md, execute plans and implements in one pass | Execute has two modes: spiked (follow SPIKE.md steps) and unspiked (read PLAN.md task, plan inline, implement). Both modes produce the same outputs (checkpoint, PROGRESS.md entries, verification). |
| EXEC-02 | If no SPIKE.md and phase has unresolved tactical decisions, nudge user to run `/expedite:spike` first (non-blocking suggestion) | Entry validation checks for SPIKE.md + scans PLAN.md tactical decision tables for needs-spike items. Nudge is informational, not blocking. |
| EXEC-03 | Single checkpoint.yml tracks execution position for pause/resume | checkpoint.yml at `.expedite/execute/checkpoint.yml` with fields: current_task, current_wave, last_completed_task, last_completed_at, tasks_completed, tasks_total, status, continuation_notes. Design decision #18 (MEDIUM confidence). |
| EXEC-04 | PROGRESS.md uses append-only `cat >>` pattern (never rewrite) | Follows the `cat >>` Bash append pattern established for log.yml (decision #20). PROGRESS.md at `.expedite/execute/PROGRESS.md`. SKILL.md must include explicit "do NOT rewrite" instruction. |
| EXEC-05 | Micro-interaction between tasks: freeform "yes / pause / review" prompt | Design decision #23: freeform prompt avoids AskUserQuestion 60-second timeout. Three options: yes (continue), pause (checkpoint + exit), review (show PROGRESS.md summary). |
| EXEC-06 | Per-task verification confirms code change addresses the design decision it traces to (contract chain validated end-to-end) | prompt-task-verifier.md already exists (133 lines, created Phase 3). Verifier checks: criterion pass/fail + design decision alignment (YES/PARTIAL/NO) + contract chain trace. Status: VERIFIED/PARTIAL/FAILED/NEEDS REVIEW. |
</phase_requirements>

## Summary

Phase 9 implements two skills -- spike and execute -- that complete the Expedite lifecycle. The spike skill is an optional intermediate step between plan and execute that resolves tactical decisions identified during planning and produces detailed implementation steps with full traceability. The execute skill is the final lifecycle stage that implements plan tasks sequentially with checkpoint/resume, per-task verification, and append-only progress logging.

The spike skill is architecturally novel for Expedite: it is a NEW 7th skill (not one of the original 6 from FOUND-04). It needs a new `skills/spike/` directory with SKILL.md and references/. The spike is deliberately lightweight -- no quality gate, no revision cycle, no state.yml phase tracking beyond `execute_in_progress`. It reads a specific phase from PLAN.md, optionally researches unresolved tactical decisions via Task() subagent dispatch, and writes SPIKE.md to a per-phase directory. The spike skill takes a `<phase>` argument (e.g., `/expedite:spike wave-1` or `/expedite:spike 1`).

The execute skill replaces its 29-line stub with a full orchestration script. It follows the established inline generation pattern (main session, not subagent) and introduces two concepts new to the codebase: (1) checkpoint.yml for pause/resume across sessions, and (2) append-only PROGRESS.md via `cat >>` Bash pattern. The execute skill reads SPIKE.md when available, falling back to inline planning from PLAN.md tasks. Per-task verification uses the prompt-task-verifier.md reference (already created in Phase 3, 133 lines) to validate the contract chain end-to-end. The micro-interaction ("yes / pause / review") uses freeform prompts per design decision #23.

**Primary recommendation:** Implement as 3 plans: Plan 1 creates the spike skill (new directory + SKILL.md), Plan 2 implements execute SKILL.md core pipeline (entry validation through task execution loop), Plan 3 implements execute checkpoint/resume, verification, PROGRESS.md, and completion. This mirrors the 2-plan split used for plan skill (pipeline + gate/completion) but adds a third plan for the entirely new spike skill.

## Standard Stack

### Core
| Component | Location | Purpose | Why Standard |
|-----------|----------|---------|--------------|
| spike SKILL.md | `skills/spike/SKILL.md` | Spike orchestration script (NEW) | Follows established SKILL.md pattern from scope/research/design/plan |
| execute SKILL.md | `skills/execute/SKILL.md` | Execute orchestration script (replace stub) | Established pattern; 29-line stub exists |
| prompt-task-verifier.md | `skills/execute/references/prompt-task-verifier.md` | Per-task verification reference | Already created in Phase 3 (133 lines) |
| state.yml | `.expedite/state.yml` | Phase tracking, gate history | Established state management from Phase 2 |
| checkpoint.yml | `.expedite/execute/checkpoint.yml` | Execution position tracking | Design decision #18 |
| PROGRESS.md | `.expedite/execute/PROGRESS.md` | Append-only execution log | ARTF-02 specified path |
| SPIKE.md | `.expedite/plan/phases/{phase}/SPIKE.md` | Per-phase spike output | SPIKE-03 specified path |

### Supporting
| Component | Location | Purpose | When to Use |
|-----------|----------|---------|-------------|
| PLAN.md | `.expedite/plan/PLAN.md` | Source of tasks and tactical decisions | Read by both spike and execute |
| DESIGN.md | `.expedite/design/DESIGN.md` | Design decisions for verification | Read during per-task verification |
| SCOPE.md | `.expedite/scope/SCOPE.md` | DA definitions for contract chain | Read during verification |
| plan/override-context.md | `.expedite/plan/override-context.md` | G4 override gaps | Read by spike/execute if exists |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Separate spike skill | Spike as part of execute | Separate skill allows optional invocation via `/expedite:spike`; merging would complicate execute's already complex flow |
| Per-phase SPIKE.md | Single SPIKE.md | Per-phase allows spiking individual phases independently; single file would require re-spiking everything when one phase changes |
| checkpoint.yml | State tracking in state.yml | checkpoint.yml keeps execution details separate from lifecycle state; avoids bloating state.yml with task-level tracking (design decision #18) |
| `cat >>` for PROGRESS.md | Write tool rewrite | `cat >>` via Bash prevents accidental rewrite by LLM (design decision #20); Write tool could silently truncate prior entries |

## Architecture Patterns

### Recommended Step Structure -- Spike Skill
```
Step 1:  Prerequisite Check (phase == plan_complete or execute_in_progress)
Step 2:  Parse Phase Argument (extract wave/epic number from user input)
Step 3:  Read Plan Artifacts (PLAN.md, state.yml, optional override-context.md)
Step 4:  Extract Phase Definition (specific wave/epic + tactical decisions)
Step 5:  Resolve Tactical Decisions (inline or optional Task() research)
Step 6:  Generate Implementation Steps (with traceability)
Step 7:  Write SPIKE.md
Step 8:  Display Summary
```

### Recommended Step Structure -- Execute Skill
```
Step 1:   Prerequisite Check (phase == plan_complete or execute_in_progress)
Step 2:   Read Plan + Spike Artifacts (PLAN.md, SPIKE.md if exists, DESIGN.md, SCOPE.md)
Step 3:   Initialize Execute State (phase -> execute_in_progress, checkpoint setup)
Step 4:   Determine Starting Point (fresh start or resume from checkpoint)
Step 5:   Task Execution Loop (display -> implement -> verify -> checkpoint -> progress -> micro-interaction)
Step 6:   Wave/Epic Transition (between-wave prompt)
Step 7:   Execution Completion (phase -> complete, lifecycle summary)
```

### Pattern 1: Spike as Lightweight Investigation Skill
**What:** Spike reads a specific plan phase, resolves its tactical decisions (inline or via research), and writes ordered implementation steps. No gate, no revision cycle.
**When to use:** Before executing a phase with needs-spike tactical decisions.
**Why this pattern:** Spike is conceptually distinct from execute -- it is investigation, not implementation. Keeping it separate lets users spike one phase while deferring others. The no-gate design reflects that spike output is consumed by the same user who requested it, not by a downstream automated phase.
**How it works:**
1. User runs `/expedite:spike wave-2` (or `spike 2`, `spike Wave 2`)
2. Spike reads Wave 2 from PLAN.md, identifies its tactical decisions
3. For each needs-spike TD: resolve inline (if sufficient context) or offer to research via Task()
4. Generate ordered implementation steps, each tracing to a TD and DA
5. Write `.expedite/plan/phases/wave-2/SPIKE.md`
6. User reviews, then runs `/expedite:execute wave-2`

### Pattern 2: Phase-Scoped Execution
**What:** Execute operates on a single phase (wave/epic) at a time, not the entire plan.
**When to use:** Every execution invocation.
**Why this pattern:** The execute skill takes a `<phase>` argument just like spike. This enables: (1) spiking and executing individual phases independently, (2) pausing between phases naturally, (3) keeping checkpoint.yml scoped to one phase at a time. If no phase argument is provided, execute starts from the first unexecuted phase.
**Interaction with plan-level progress:** state.yml tracks which phases are complete. Execute updates `current_wave` and the `tasks` array (which the plan skill deliberately left unpopulated -- see decision "08-02: Plan completion does NOT populate tasks or current_wave").

### Pattern 3: Dual-Mode Execute (Spiked vs Unspiked)
**What:** Execute checks for SPIKE.md in the phase directory. If present, follows its ordered steps. If absent, reads the PLAN.md tasks directly and plans/implements in one pass.
**When to use:** Execute entry (Step 2).
**Why this pattern:** SPIKE-05 makes spike optional. Execute must work in both modes. The spiked path provides more granular steps with resolved tactical decisions. The unspiked path treats each PLAN.md task as a self-contained unit.
**Spiked mode:**
- Read SPIKE.md implementation steps
- Execute each step in order
- Each step already has resolved tactical decisions and implementation guidance
**Unspiked mode:**
- Read PLAN.md tasks for the current wave/epic
- For each task: display it, implement it, verify it
- Tactical decisions classified as "resolved" are used directly
- If needs-spike TDs exist: display non-blocking nudge (EXEC-02)

### Pattern 4: Checkpoint/Resume
**What:** checkpoint.yml records execution position. On resume, execute reads checkpoint and advances to the next pending task.
**When to use:** After every task completion and on pause.
**Why this pattern:** Design decision #18. Sessions may be interrupted (/clear, timeout, crash). checkpoint.yml provides unambiguous resume point. PROGRESS.md provides history backup if checkpoint.yml is corrupted.
**Schema:**
```yaml
current_task: "t03"
current_wave: 2
last_completed_task: "t02"
last_completed_at: "2026-02-26T14:30:00Z"
tasks_completed: 2
tasks_total: 12
status: "in_progress"  # in_progress | paused | complete
continuation_notes: "Completed auth middleware. Next: rate limiting."
```
**Resume logic:**
1. Read checkpoint.yml
2. Find last_completed_task
3. Identify next task in wave order
4. Display: "Resuming from task {ID}: {title}."
5. Continue the task execution loop

### Pattern 5: Append-Only Progress Logging
**What:** PROGRESS.md is written exclusively via `cat >>` Bash command. Never rewritten via Write tool.
**When to use:** After each task completion verification.
**Why this pattern:** Design decision #20. LLMs naturally want to rewrite files. `cat >>` via Bash is immune to this because it is a different tool. The SKILL.md must include explicit "do NOT use Write tool for PROGRESS.md" instruction.
**Append format:**
```markdown
## {task_id}: {task_title}
- Status: {complete|partial|failed|needs_review}
- Wave: {wave_number}
- Design decision: {DA-X}: {brief}
- Files modified: {list}
- Verification: {VERIFIED|PARTIAL|FAILED|NEEDS REVIEW}
- Completed: {ISO 8601 UTC timestamp}
```
**Critical instruction in SKILL.md:**
```
Use `cat >>` via Bash to append to PROGRESS.md. NEVER use the Write tool to modify
PROGRESS.md -- Write overwrites the entire file, destroying prior entries.
```

### Pattern 6: Per-Task Verification with Contract Chain
**What:** After each task's implementation, verify that the code changes actually address the design decision the task traces to. Not just "does this work?" but "does this implement what the design decided?"
**When to use:** After task implementation, before checkpoint update.
**Why this pattern:** This is the final link in the contract chain: scope question -> evidence -> design decision -> plan task -> code change. prompt-task-verifier.md (133 lines, Phase 3) provides the verification template as an inline reference.
**How it works:**
1. Read the task definition (acceptance criteria, DA reference)
2. Read the referenced design decision from DESIGN.md
3. For each acceptance criterion: check pass/fail AND design decision alignment (YES/PARTIAL/NO)
4. Check for disconnected criteria (pass but don't implement the design decision)
5. Produce verification status: VERIFIED / PARTIAL / FAILED / NEEDS REVIEW
6. Verification output feeds into PROGRESS.md append and micro-interaction display

### Pattern 7: Spike Research via Task() Subagent
**What:** When spike encounters a needs-spike tactical decision that cannot be resolved inline, it can optionally dispatch a focused research Task() to investigate.
**When to use:** Step 5 of spike skill, when the user opts for research.
**Why this pattern:** SPIKE-02 requires focused research in a separate context. This reuses the Task() dispatch pattern from the research skill but with a much narrower scope: one tactical decision, one focused question, one evidence file.
**How it works:**
1. Spike identifies a needs-spike TD (e.g., "Which caching strategy: LRU vs TTL?")
2. Presents options: "Resolve inline (use your judgment) | Research (dispatch focused investigation)"
3. If research: construct a focused prompt with the specific question, dispatch via Task()
4. Task() agent investigates and returns findings
5. Spike incorporates findings into the resolved tactical decision

### Anti-Patterns to Avoid
- **Gating the spike:** SPIKE-04 explicitly says no gate. Do not add G5, do not add revision cycle. Spike is lightweight and user-reviewed.
- **Making spike mandatory:** SPIKE-05 and EXEC-01/EXEC-02 make spike optional. Execute must work without spike.
- **Rewriting PROGRESS.md with Write tool:** EXEC-04 mandates `cat >>`. The Write tool would destroy prior entries.
- **Blocking execute on missing spike:** EXEC-02 says nudge, not block. The suggestion is non-blocking.
- **Tracking spike state in state.yml:** There is no `spike_in_progress` or `spike_complete` phase. Spike runs within the plan_complete or execute_in_progress phase. Its output (SPIKE.md file existence) is the only indicator.
- **Global task tracking in state.yml:** The plan skill deliberately did NOT populate tasks or current_wave (decision 08-02). Execute populates these when it starts, not before.
- **Using AskUserQuestion for micro-interaction:** Decision #23 mandates freeform prompts (avoids 60-second timeout).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Task verification | Custom acceptance checking | prompt-task-verifier.md (Phase 3, 133 lines) | Already built with contract chain alignment checks, intent-conditional sections |
| State transitions | Custom phase management | Established backup-before-write pattern | STATE-02 mandates this |
| Append-only file writes | Custom append logic | `cat >>` via Bash tool | Decision #20; LLM-proof append mechanism |
| Micro-interaction prompt | AskUserQuestion | Freeform prompt pattern | Decision #23; avoids 60-second timeout |
| Research dispatch | Custom investigation pattern | Task() API with focused prompt | Same pattern as research skill Step 9 |
| Recycle escalation | Custom messaging | ref-recycle-escalation.md pattern | Not applicable (no gates in spike/execute) but execute error handling follows similar escalation |
| Checkpoint schema | Invent new format | Design decision #18 schema (see Pattern 4 above) | Already specified in product design |

**Key insight:** The spike skill is entirely new but follows established SKILL.md patterns. The execute skill's novel elements are checkpoint/resume and append-only progress logging -- everything else (state transitions, verification reference, freeform interaction) already exists. The prompt-task-verifier.md is the most valuable pre-built component, avoiding the need to design verification logic from scratch.

## Common Pitfalls

### Pitfall 1: Spike Phase Argument Parsing
**What goes wrong:** The spike skill cannot reliably parse which phase the user wants to spike. Users may say "wave 2", "Wave 2", "w2", "2", "epic 1", "E1", etc.
**Why it happens:** Phase names in PLAN.md are full headings (e.g., "## Wave 2: Authentication Layer") but user input is abbreviated.
**How to avoid:** Implement flexible matching: extract the number from the user's input, then find the matching wave/epic heading in PLAN.md by number. Support both "wave N" / "epic N" and bare "N" forms. If ambiguous, display available phases and ask the user to clarify.
**Warning signs:** Spike fails to find the requested phase in PLAN.md.

### Pitfall 2: SPIKE.md Path Convention Confusion
**What goes wrong:** SPIKE.md is written to the wrong location, or execute cannot find it.
**Why it happens:** SPIKE-03 specifies `.expedite/plan/phases/{phase}/SPIKE.md` but the `{phase}` slug format is not defined. Is it "wave-1", "Wave 1", "1", "wave-1-auth-layer"?
**How to avoid:** Use a normalized slug: lowercase, hyphenated, number-prefixed. For engineering: `wave-1`, `wave-2`. For product: `epic-1`, `epic-2`. Both spike (writing) and execute (reading) must use the same slug convention.
**Warning signs:** Execute cannot find SPIKE.md because it looks in the wrong directory.

### Pitfall 3: Checkpoint/State.yml Divergence
**What goes wrong:** checkpoint.yml says one thing (task t05 in progress) but state.yml says another (current_task: t03). On resume, the skill does not know which to trust.
**Why it happens:** Two files tracking related state can drift if one is updated but not the other (crash between writes, LLM skipping one update).
**How to avoid:** checkpoint.yml is the source of truth for execution position. state.yml's current_task and current_wave are convenience mirrors. On resume, always read checkpoint.yml first. If checkpoint.yml is missing or corrupted, fall back to PROGRESS.md reconstruction (design error handling table).
**Warning signs:** Resume displays wrong task or re-executes a completed task.

### Pitfall 4: PROGRESS.md Write Tool Rewrite
**What goes wrong:** The LLM uses the Write tool to "update" PROGRESS.md, silently destroying all prior entries.
**Why it happens:** The Write tool is the default file-writing mechanism. LLMs naturally reach for it. The `cat >>` Bash pattern is counterintuitive.
**How to avoid:** SKILL.md must include an explicit, prominent instruction: "NEVER use Write tool for PROGRESS.md. Use `cat >>` via Bash." Place this instruction near the progress logging step, not buried in a preamble.
**Warning signs:** PROGRESS.md contains only the most recent task entry.

### Pitfall 5: Spike Research Scope Creep
**What goes wrong:** A spike research Task() for one tactical decision expands into a full research round covering multiple questions.
**Why it happens:** Research agents are designed (from Phase 5) to be thorough. A focused question like "LRU vs TTL caching?" can lead the agent to investigate caching architectures broadly.
**How to avoid:** The spike research prompt must be tightly scoped: one tactical decision, one focused question, strict output constraints (200-400 words, specific recommendation with rationale). Do not reuse the full web-researcher.md template -- write a focused spike-researcher prompt.
**Warning signs:** Spike research Task() takes >2 minutes or produces >1000 words.

### Pitfall 6: Execute Without Phase Argument
**What goes wrong:** User runs `/expedite:execute` without specifying a phase. Execute does not know where to start.
**Why it happens:** The product design describes execute as phase-scoped but the original stub does not mention phase arguments.
**How to avoid:** If no phase argument: check checkpoint.yml for resume. If no checkpoint: start from Wave 1 / Epic 1 (first phase in PLAN.md). Display which phase is being executed. This matches the product design's "Fresh start: first task in wave 1."
**Warning signs:** Execute starts from an unexpected phase.

### Pitfall 7: Verification Status vs Task Completion
**What goes wrong:** A task is marked complete even when verification status is PARTIAL or FAILED. Or verification blocks all progress.
**Why it happens:** The relationship between verification status and task completion is unclear. Should FAILED verification block the next task?
**How to avoid:** Verification is informational, not blocking. PARTIAL and NEEDS REVIEW are logged but do not prevent progression. FAILED is surfaced prominently in the micro-interaction: "Task t02 verification: FAILED. Contract chain broken at [stage]. Continue? (yes / pause / review)". The user decides whether to proceed, fix, or pause. This matches the override philosophy: developer always retains agency.
**Warning signs:** Tasks stuck in a loop because verification fails, or verification failures silently ignored.

## Code Examples

### Example 1: Spike SKILL.md Frontmatter
```yaml
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
```

Note: Task tool is included because SPIKE-02 requires optional research dispatch. WebSearch/WebFetch included for research subagent tool access.

### Example 2: SPIKE.md Output Format
```markdown
# Spike: Wave 2 - Authentication Layer
Generated: {ISO 8601 UTC timestamp}
Source: PLAN.md Wave 2
Tactical Decisions: 3 (all resolved)

## Tactical Decisions Resolved

### TD-1: JWT vs session-based token format
**Classification:** resolved (from PLAN.md)
**Resolution:** Use JWT (design decision DA-3 specifies this)
**No investigation needed.**

### TD-2: Token refresh strategy (silent vs explicit)
**Classification:** was needs-spike, now resolved
**Investigation:** Focused research dispatched
**Resolution:** Use silent refresh with sliding window
**Rationale:** [summary of research findings]
**Evidence:** .expedite/plan/phases/wave-2/spike-research-td-2.md

### TD-3: Rate limiting implementation
**Classification:** was needs-spike, now resolved
**Resolution:** Use token bucket algorithm with Redis backend
**Rationale:** Resolved inline -- token bucket is standard for API rate limiting, Redis is already in the stack per DA-5.

## Implementation Steps

### Step 1: JWT token issuance module
**Traces to:** TD-1 -> DA-3 (Stateless authentication)
**Files:** src/auth/jwt.ts, src/auth/types.ts
**What to do:**
1. Create JWT signing utility with configurable secret and expiration
2. Include user ID and role claims in payload
3. Set expiration to 1 hour (DA-3 decision)

### Step 2: Silent refresh middleware
**Traces to:** TD-2 -> DA-3 (Stateless authentication)
**Files:** src/middleware/refresh.ts
**What to do:**
1. Implement sliding window check on each request
2. If token expires within 10 minutes, issue new token in response header
3. Client reads X-Refreshed-Token header

### Step 3: Rate limiting layer
**Traces to:** TD-3 -> DA-5 (API protection)
**Files:** src/middleware/rate-limit.ts, src/config/limits.ts
**What to do:**
1. Implement token bucket algorithm
2. Configure per-endpoint limits in limits.ts
3. Return 429 with Retry-After header on limit breach
```

### Example 3: Execute Prerequisite Check Pattern
```markdown
### Step 1: Prerequisite Check

Look at the injected lifecycle state above.

**Case A: Phase is "plan_complete"**
This is a fresh execution start. Display: "Starting execution..."
Proceed to Step 2.

**Case B: Phase is "execute_in_progress"**
This is a resume scenario.
1. Check for `.expedite/execute/checkpoint.yml`
2. If checkpoint exists: display "Resuming execution from checkpoint..."
3. If no checkpoint: display "Execution in progress but no checkpoint found. Starting from beginning of current wave."
Proceed to Step 2.

**Case C: Phase is anything else**
Display error with current phase, suggest running preceding skills.
STOP.
```

### Example 4: Micro-Interaction Pattern
```markdown
After task verification, display:

Task {task_id} complete ({completed}/{total}).
Verification: {VERIFIED|PARTIAL|FAILED|NEEDS REVIEW}
{If FAILED: "Contract chain broken at: {stage}"}

Continue?
> yes / pause / review

- **yes** or **continue**: proceed to next task
- **pause**: write checkpoint, display "Execution paused at task {task_id}. Resume with `/expedite:execute`.", STOP.
- **review**: display PROGRESS.md contents, then re-prompt
- Natural language equivalents: "next", "go", "keep going" = yes; "stop", "wait", "hold" = pause
```

### Example 5: PROGRESS.md Append via Bash
```markdown
After verification, append to PROGRESS.md using Bash (NEVER Write tool):

bash: |
  cat >> .expedite/execute/PROGRESS.md << 'PROGRESS_EOF'

  ## t02: Implement Auth Middleware
  - Status: complete
  - Wave: 1
  - Design decision: DA-3: Stateless JWT authentication
  - Files modified: src/auth/jwt.ts, src/middleware/auth.ts
  - Verification: VERIFIED
  - Contract chain: DA-3 -> evidence-batch-01.md Finding 3 -> JWT decision -> t02 -> jwt.ts
  - Completed: 2026-03-06T15:30:00Z
  PROGRESS_EOF
```

### Example 6: checkpoint.yml Schema
```yaml
# Execute checkpoint -- tracks position for pause/resume
current_task: "t03"
current_wave: 2
last_completed_task: "t02"
last_completed_at: "2026-03-06T14:30:00Z"
tasks_completed: 2
tasks_total: 12
status: "in_progress"   # in_progress | paused | complete
continuation_notes: "Completed auth middleware. Next: rate limiting."
```

### Example 7: State.yml Transitions for Execute Phase
```yaml
# Forward-only transitions:
# plan_complete -> execute_in_progress
# execute_in_progress -> complete
# execute_in_progress -> execute_in_progress (pause/resume -- same phase, checkpoint changes)
# Note: There is NO execute_recycled phase. Execute does not have a gate.
# Note: There is NO spike_in_progress phase. Spike operates within plan_complete.
```

## Spike Skill Architectural Decisions

### Spike is a New 7th Skill
The original FOUND-04 specifies 6 skills: scope, research, design, plan, execute, status. Spike was introduced during requirements/roadmap creation alongside the tactical decision concept (PLAN-06). It requires a new `skills/spike/` directory with SKILL.md. Since Claude Code auto-discovers skills from `skills/{name}/SKILL.md`, the spike skill will be automatically available as `/expedite:spike` after creation.

### Spike Has No State.yml Phase
There is no `spike_in_progress` or `spike_complete` phase in the state.yml transition diagram. Spike runs within the `plan_complete` phase (or `execute_in_progress` if re-spiking during execution). Its output is a file (SPIKE.md), not a state transition. This is deliberate: spike is optional and phase-scoped, so lifecycle-level state tracking would add unnecessary complexity.

### Spike Research is Task() Dispatch (Not Inline)
SPIKE-02 says "separate context." This maps to Task() subagent dispatch. The spike research agent should be a focused, lightweight investigator -- not a reuse of the full web-researcher.md template. A dedicated `prompt-spike-researcher.md` reference in `skills/spike/references/` would keep the scope narrow.

### SPIKE.md Per-Phase Directory Structure
SPIKE-03 specifies `.expedite/plan/phases/{phase}/SPIKE.md`. This creates a per-phase directory structure under plan/:
```
.expedite/
  plan/
    PLAN.md
    phases/
      wave-1/
        SPIKE.md
        spike-research-td-2.md  (optional research evidence)
      wave-2/
        SPIKE.md
```

Slug convention: `wave-{N}` for engineering, `epic-{N}` for product. Both spike (writing) and execute (reading) must agree on the slug.

## Execute Skill Architectural Decisions

### Execute Populates state.yml Task Tracking
The plan skill deliberately left `tasks` array and `current_wave` empty (decision 08-02). Execute Step 3 reads PLAN.md, enumerates all tasks, and populates these fields:
```yaml
current_wave: 1
current_task: "t01"
tasks:
  - id: "t01"
    title: "Create database schema"
    wave: 1
    status: "pending"    # pending | in_progress | complete | failed | skipped
  - id: "t02"
    title: "Implement auth middleware"
    wave: 1
    status: "pending"
```

### Execute Uses Two Tracking Files
- **checkpoint.yml:** Current position, counts, continuation notes. Updated after every task. Source of truth for resume.
- **PROGRESS.md:** Append-only history log. Each entry includes verification status, files modified, contract chain trace. Backup source for checkpoint reconstruction.

### Execute Error Handling
The product design specifies error recovery:
| Failure Mode | Recovery |
|-------------|----------|
| Task fails (build error, test failure) | Display error. Ask: "Retry / Skip / Pause?" |
| Session interrupted (/clear) | Resume from checkpoint.yml via `/expedite:execute` re-invocation |
| checkpoint.yml corrupted | Attempt reconstruction from PROGRESS.md |
| All tasks in a wave fail | Pause execution, suggest reviewing plan |

### Execute Completion
When all tasks are complete:
1. Set `phase: "complete"` in state.yml
2. Set checkpoint.yml `status: "complete"`
3. Display lifecycle completion summary with contract chain statistics
4. Suggest `/expedite:scope` for a new lifecycle

## Plan Decomposition Recommendation

Based on the scope and complexity, three plans are recommended:

### Plan 1: Spike Skill (NEW)
- Create `skills/spike/` directory with SKILL.md and references/
- Create `skills/spike/references/prompt-spike-researcher.md` (focused research prompt)
- Implement all 8 spike steps in SKILL.md
- Requirements: SPIKE-01, SPIKE-02, SPIKE-03, SPIKE-04, SPIKE-05
- Estimated: ~200-300 lines SKILL.md + ~60-80 lines prompt template

### Plan 2: Execute Skill Core Pipeline
- Replace execute SKILL.md stub with Steps 1-5 (prerequisite through task execution loop)
- Implement dual-mode execution (spiked vs unspiked)
- Implement per-task verification using prompt-task-verifier.md reference
- Requirements: EXEC-01, EXEC-02, EXEC-06
- Estimated: ~250-350 lines SKILL.md

### Plan 3: Execute Checkpoint, Progress, and Completion
- Implement checkpoint.yml creation and update pattern
- Implement PROGRESS.md append-only logging via `cat >>` Bash
- Implement micro-interaction prompt (yes / pause / review)
- Implement resume from checkpoint logic
- Implement execution completion (phase -> complete)
- Wave transition prompts
- Error handling (retry / skip / pause)
- Requirements: EXEC-03, EXEC-04, EXEC-05
- Estimated: adds ~150-250 lines to SKILL.md (total SKILL.md: ~400-600 lines)

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| No spike phase | Plan -> Spike -> Execute architecture | Requirements/roadmap creation (2026-02-27) | Tactical decisions resolved before execution, not during |
| Execute works on full plan | Phase-scoped execution | Requirements update | Users can spike and execute individual phases |
| Write tool for all files | `cat >>` Bash for append-only files | Design decision #20 | Prevents LLM from accidentally rewriting PROGRESS.md |
| AskUserQuestion for interaction | Freeform prompt | Design decision #23 | Avoids 60-second timeout constraint |

## Open Questions

1. **Phase Argument Syntax for Spike/Execute**
   - What we know: Both skills take a `<phase>` argument. PLAN.md uses "## Wave N:" headings.
   - What's unclear: Exact parsing rules. Should "spike 2" spike Wave 2? What about "spike wave-2"? "spike Wave 2: Auth Layer"?
   - Recommendation: Accept numeric input (spike 2 -> Wave 2), "wave N" or "epic N" format, and bare numbers. If ambiguous, list available phases and prompt.

2. **Spike Interaction with Execute Resume**
   - What we know: A user may spike Wave 2 while in the middle of executing Wave 1. The phase would still be execute_in_progress.
   - What's unclear: Should spike be callable during execute_in_progress? Or only during plan_complete?
   - Recommendation: Allow spike during both plan_complete and execute_in_progress. Spike does not change the lifecycle phase -- it just produces a file. This supports the workflow: execute Wave 1, pause, spike Wave 2, resume execute into Wave 2.

3. **Spike Research Agent Model Tier**
   - What we know: Research agents use sonnet (TMPL-03). Spike research is more focused and simpler.
   - What's unclear: Should spike research also use sonnet, or is a lighter model sufficient?
   - Recommendation: Use sonnet for consistency. The focused scope means the cost difference is negligible, and sonnet is proven reliable for research tasks.

4. **Execute Phase Completion vs Lifecycle Completion**
   - What we know: The product design says execute completion sets `phase: "complete"`. But this is lifecycle-level completion.
   - What's unclear: If the user only executes Wave 1 out of 3, is the lifecycle complete? Should there be a per-phase completion tracking?
   - Recommendation: Phase completion is per-wave tracking in checkpoint.yml and state.yml tasks array. Lifecycle completion (`phase: "complete"`) only occurs when ALL waves/epics are complete. Use checkpoint.yml to track which waves are done.

## Sources

### Primary (HIGH confidence)
- Existing codebase: `skills/plan/SKILL.md` -- 482 lines, full plan skill orchestration with tactical decision tables and G4 gate
- Existing codebase: `skills/execute/SKILL.md` -- 29-line stub, confirms execute skill exists but needs full implementation
- Existing codebase: `skills/execute/references/prompt-task-verifier.md` -- 133 lines, complete per-task verification template with contract chain checks
- Existing codebase: `skills/design/SKILL.md` -- 476 lines, established inline generation + revision cycle + gate pattern
- Existing codebase: `skills/research/SKILL.md` -- 397 lines, established Task() dispatch pattern for parallel subagents
- Existing codebase: `templates/state.yml.template` -- state schema with execute phase fields (current_task, current_wave, tasks array)
- `.planning/REQUIREMENTS.md` -- SPIKE-01 through SPIKE-05, EXEC-01 through EXEC-06 requirement definitions
- `.planning/ROADMAP.md` -- Phase 9 description, success criteria, and dependencies
- `.planning/research/arc-implementation/design/PRODUCT-DESIGN.md` -- /arc:execute specification with checkpoint.yml schema, micro-interaction design, error handling table, PROGRESS.md format

### Secondary (MEDIUM confidence)
- `.planning/phases/08-plan-skill/08-RESEARCH.md` -- Phase 8 research establishing tactical decision patterns this phase consumes
- `.planning/STATE.md` -- Accumulated context decisions including Plan->Spike->Execute architecture

### Tertiary (LOW confidence)
- Design decision #18 (checkpoint.yml): Confidence rated MEDIUM in the product design. Resume reliability needs testing.
- Spike research via Task(): Novel application of Task() API for focused single-question investigation (not precedented in the research skill's batch model).

## Metadata

**Confidence breakdown:**
- Spike architecture: HIGH -- follows established SKILL.md patterns; requirements are clear and unambiguous
- Execute core pipeline: HIGH -- product design provides detailed specification; task verifier already built
- Checkpoint/resume: MEDIUM -- design decision #18 rated MEDIUM confidence; no reference implementation in this codebase
- Append-only PROGRESS.md: HIGH -- `cat >>` Bash pattern is proven (design decision #20, adopted from research-engine)
- Spike research dispatch: MEDIUM -- novel focused application of Task() API; needs scope control

**Research date:** 2026-03-06
**Valid until:** Indefinite -- internal codebase analysis, not dependent on external library versions
