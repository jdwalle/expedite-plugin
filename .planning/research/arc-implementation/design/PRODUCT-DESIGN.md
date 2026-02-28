# Arc Plugin: Product Design Specification

**Date:** 2026-02-27
**Status:** Final synthesis from 3 revised design proposals, 2 validation reports, and complete research base
**Consumer:** Implementation team (Plan and Execute phases)

---

## Overview

This document specifies the complete product design for **arc**, a Claude Code plugin that orchestrates a 5-phase research-to-implementation lifecycle: Scope, Research, Design, Plan, Execute. Arc transforms the pattern of "research a problem, then build a solution" into a structured, repeatable workflow with quality gates, parallel research agents, and intent-adaptive behavior for both product managers and engineers.

The design is informed by research in `.planning/research/arc-implementation/`, which includes deep analysis of two reference implementations (research-engine and GSD), Claude Code plugin architecture documentation, prompt engineering best practices, state management patterns, and subagent orchestration strategies. The research underwent two rounds of readiness evaluation with all 10 decision areas achieving READY status before design began.

**Key user decisions that shaped the design:**
- D1: Inline gates (each skill validates its own output, no separate gate skill)
- D5: log.yml is gitignored (single-user workflow, less commit noise)
- D6: Full intent adaptation in v1 including HANDOFF.md generation (user clarification: "just generating a file" -- user handles distribution manually)
- D2/D3/D4: Delegated to design agents (resolved: single templates with conditional intent lens, hardcoded model frontmatter, no extended thinking for v1)

**Design philosophy:** Arc is a developer-facing orchestration tool that trades configuration surface area for reliability. It ships with zero required configuration, uses file-based state that is human-readable and git-friendly, and provides clear recovery paths at every failure point. When evidence is ambiguous, the design chooses the simpler proven option over the more capable speculative one.

**Contract chain principle:** The lifecycle enforces an unbroken traceability chain across all five phases. Each phase's output must demonstrably trace back to its predecessor's output — no phase may invent requirements, criteria, or decisions independently of the chain:

```
Scope: question + evidence requirements + readiness criterion
  ↓  (each question maps to a decision area)
Research: find specific evidence → COVERED/NOT COVERED per requirement
  ↓  (evidence files referenced by decision area)
Design: decision per DA, references supporting evidence
  ↓  (every design decision traceable to a plan task)
Plan: task acceptance criteria trace back to design decisions
  ↓  (every acceptance criterion traceable to a design decision)
Execute: verify criteria, trace back to plan tasks and design decisions
```

G4 must verify that every design decision has at least one corresponding task and that acceptance criteria trace back to design decisions (not invented independently). Execute's per-task verification must confirm the code change actually addresses the design decision it traces to, not just that it passes a disconnected acceptance check.

---

## Decisions Register

| # | Decision | Source | Confidence | Rationale |
|---|----------|--------|------------|-----------|
| 1 | Inline gates: each skill evaluates its own output gate | User (D1) | High | User chose inline. "Producing skill evaluates its own output" is the most natural interpretation -- the skill verifies its work before declaring done. Consuming skills perform lightweight entry validation only. |
| 2 | Single template with conditional `<intent_lens>` sections | Consensus | High | All 3 proposals converged. Research-engine lens pattern is proven. Avoids structural drift from maintaining separate templates. |
| 3 | Hardcoded model tiers in prompt frontmatter | Consensus | High | All 3 proposals converged. Research-engine pattern, zero configuration, proven in production. |
| 4 | No extended thinking for v1 | Resolved | Medium | "ultrathink" enables extended thinking for the entire skill execution, not just the gate section. Since gates are inline, trivial operations would also use ET. No evidence ET improves rubric-based evaluation specifically. v1.1 candidate. |
| 5 | log.yml gitignored | User (D5) | High | Single-user workflow, less commit noise. |
| 6 | Full intent adaptation including HANDOFF.md | User (D6) | Medium | User wants it in v1. HANDOFF.md format is novel (WEAK evidence) -- marked as v1-iteration candidate. |
| 7 | Granular phase naming (`scope_in_progress`, `scope_complete`, `research_recycled`, etc.) | Consensus | High | R2/R3 converged. Makes crash recovery unambiguous. A `_complete` suffix is proof the gate passed. |
| 8 | Flat state.yml structure (max 2 nesting levels) | Resolved | High | State management patterns research explicitly recommends max 2 levels for LLM parseability. R3's flat approach validated by both validators. |
| 9 | Design and plan generation in main session (not subagents) | Resolved | High | C-7: "subagents for parallel research; main session for everything else." Design/plan are not parallel research. Main session enables revision cycle, full tool access, user model control. |
| 10 | Sufficiency evaluation inline (not subagent) | Resolved | High | Avoids ~80K token overhead. Main session already has evidence context loaded. C-7 supports. |
| 11 | Scope question generation in main session (no scope-decomposer subagent) | Resolved | High | Scope is interactive -- user is in conversation. Subagent cannot participate. R1/R2 approach is simpler. |
| 12 | Three per-source researcher templates | Resolved | High | Research-engine uses per-source templates. Source-specific instructions (tool sets, circuit breaker emphasis) are substantial enough to warrant dedicated files. |
| 13 | Source-affinity batching (hybrid per-question/per-batch) | Consensus | Medium | Group questions by source requirements into 3-5 batches. Dispatch one agent per batch. Assess sufficiency per question from combined output. Novel adaptation -- needs testing. |
| 14 | Override applies to both MUST and SHOULD failures | Resolved | Medium | Developer always retains agency. 3rd-recycle escalation recommending override makes no sense if MUST failures are non-overridable. Record severity of what was overridden. |
| 15 | "Go with advisory" as fourth gate outcome | Resolved | High | R2's refinement: all MUSTs pass, some SHOULDs fail. Developer proceeds without interruption but downstream phase is aware of gaps. |
| 16 | Categorical sufficiency model (COVERED/PARTIAL/NOT COVERED) for G2 | Resolved | High | Proven in research-engine. LLMs produce more stable categorical judgments than numeric scores. Count-based gate criteria ("majority of questions COVERED") are simpler and more reliable than numeric thresholds. |
| 17 | P0/P1/P2 priority terminology | Resolved | High | Concise, widely understood, used in product design specification. |
| 18 | Single checkpoint.yml for execute phase | Resolved | Medium | R3's approach. Simpler resume logic (one file, not directory scan). PROGRESS.md provides per-task history. |
| 19 | log.yml persists across lifecycles (not archived) | Resolved | Medium | Cross-lifecycle analysis is the primary value for v2 calibration. Archiving fragments the data. Size manageable (<500KB over 100 lifecycles). |
| 20 | `cat >>` Bash append for log.yml with "do NOT rewrite" SKILL.md instruction | Consensus | High | Directly mitigates LLM rewrite risk. R2's pattern adopted by all. |
| 21 | Dynamic context injection (`!cat .arc/state.yml`) in all SKILL.md files | Consensus | High | Defense-in-depth for SessionStart hook failure. Plugin architecture research confirms `!command` syntax. Zero-cost addition. |
| 22 | Max 3 concurrent research subagents | Consensus | High | Anthropic recommends 3-5. Conservative end for reliability. Prompt-based enforcement only. |
| 23 | Freeform prompt for micro-interaction (not AskUserQuestion) | Consensus | High | Avoids 60-second timeout. All 3 proposals converged. |
| 24 | Design revision cycle (max 2 rounds in-session) | Resolved | Medium | R2's feature. Reduces need for G3 Recycle. No reference precedent but sound DX practice. |
| 25 | Categorical sufficiency assessment (not numeric scoring) | Resolved | High | Research-engine uses COVERED/PARTIAL/NOT COVERED — proven pattern. Research on LLM-as-judge shows categorical ratings are more stable than numeric scores. Avoids calibration dependency. Numeric scoring can be added in v1.1 if categorical proves too coarse. |
| 26 | HANDOFF.md 9-section format | Resolved | Low | Sections 1-8 from supplement synthesis (MODERATE, grounded in HashiCorp PRD-to-RFC). Section 9 "Priority Ranking for Trade-offs" is a design addition (WEAK). v1-iteration candidate. |
| 27 | hooks.json field naming | Resolved | Low | Proposals disagreed (`hook_type`/`script` vs `type`/`command` vs `event`/`script`). Exact field names must be verified against the platform during implementation. Design uses `hook_type`/`script` as primary choice. |
| 28 | MCP tools require foreground subagent execution | Consensus | High | Hard platform constraint (GitHub #13254, #19964). All research subagents must use `subagent_type: "general-purpose"` for MCP access. |
| 29 | AskUserQuestion not available in subagents | Consensus | High | Hard platform constraint (GitHub #12890). All user interaction happens in the orchestrator (main session). |

---

## Plugin Architecture

### Plugin Directory Structure

The arc plugin ships as an installable directory following Claude Code plugin conventions. Skills are auto-discovered from `skills/{name}/SKILL.md`.

```
arc/
  .claude-plugin/
    plugin.json
  hooks/
    hooks.json
  scripts/
    session-start.sh
  skills/
    scope/
      SKILL.md
      references/
        prompt-scope-questioning.md
    research/
      SKILL.md
      references/
        prompt-web-researcher.md
        prompt-codebase-analyst.md
        prompt-mcp-researcher.md
        prompt-research-synthesizer.md
        prompt-sufficiency-evaluator.md
    design/
      SKILL.md
      references/
        prompt-design-guide.md
    plan/
      SKILL.md
      references/
        prompt-plan-guide.md
    execute/
      SKILL.md
      references/
        prompt-task-verifier.md
    status/
      SKILL.md
  templates/
    state.yml.template
    sources.yml.template
    gitignore.template
```

### Plugin Manifest (plugin.json)

```json
{
  "name": "arc",
  "version": "1.0.0",
  "description": "Research-driven development lifecycle: Scope, Research, Design, Plan, Execute",
  "author": "arc-contributors"
}
```

Skills are auto-discovered from `skills/{name}/SKILL.md` -- no explicit skill listing needed in plugin.json. This matches research-engine's proven minimal manifest pattern.

### Hook Configuration

**hooks/hooks.json:**
```json
[
  {
    "hook_type": "SessionStart",
    "script": "${CLAUDE_PLUGIN_ROOT}/scripts/session-start.sh"
  }
]
```

Note: Field names (`hook_type`, `script`) are chosen from plugin architecture research documentation. Proposals used different naming conventions (`type`/`command`, `event`/`script`). Exact field names must be verified against the Claude Code plugin platform during implementation.

### Skill Namespace

All skills use the `/arc:` namespace:
- `/arc:scope` -- Define lifecycle scope, intent, and research questions
- `/arc:research` -- Gather evidence via parallel subagents
- `/arc:design` -- Generate design document from research synthesis
- `/arc:plan` -- Decompose design into actionable tasks
- `/arc:execute` -- Execute plan tasks sequentially in the main session
- `/arc:status` -- Display lifecycle status and context (manual fallback for SessionStart hook)

Trigger phrases in each SKILL.md `description` field enable auto-invocation. For example, typing "research the questions" can trigger `/arc:research`.

### Runtime State Directory (.arc/)

Created at the project root during `/arc:scope`. Contains all lifecycle state and artifacts.

```
.arc/
  state.yml                    # Current lifecycle state (YAML, complete-rewrite)
  state.yml.bak                # Backup before last state write
  sources.yml                  # Source configuration (persists across lifecycles)
  log.yml                      # Append-only telemetry (persists across lifecycles, gitignored)
  scope/
    SCOPE.md                   # Question plan, success criteria, intent declaration
  research/
    evidence-batch-{N}.md      # Per-batch evidence files from research subagents
    SYNTHESIS.md               # Evidence organized by question/decision area
    round-{N}/                 # Gap-fill round artifacts (created on Recycle)
      supplement-{batch}.md    # Supplement evidence for failing questions
      supplement-synthesis.md  # Additive re-synthesis for this round
  design/
    DESIGN.md                  # Implementation design (engineering) or PRD (product)
    HANDOFF.md                 # Product intent only -- PM-to-engineering translation
  plan/
    PLAN.md                    # Wave-ordered tasks (engineering) or epics/stories (product)
  execute/
    PROGRESS.md                # Append-only execution log
    checkpoint.yml             # Single checkpoint file tracking execution position
  archive/
    {slug}/                    # Archived prior lifecycles (complete snapshot)
```

### Relationship to .planning/ Directory

Arc's `.arc/` directory is independent of any existing `.planning/` directory. Arc does not read or write `.planning/` files. The two coexist at the project root without interaction.

---

## State Management Design

### state.yml Schema

The state file is the control plane for the entire lifecycle. It tracks what phase the lifecycle is in, what questions are being researched, and what gates have been evaluated. Markdown artifacts (SCOPE.md, SYNTHESIS.md, DESIGN.md, PLAN.md) are the data plane.

```yaml
# Arc Lifecycle State -- machine-readable, complete-rewrite on every update
version: "1"                              # Schema version for future evolution
last_modified: "2026-02-26T14:30:00Z"     # ISO 8601 UTC

# Lifecycle identity
project_name: "auth-redesign"             # Set during scope
intent: "engineering"                     # "product" | "engineering"
lifecycle_id: "auth-redesign-20260226"    # Slug for log correlation

# Current position (granular phases for crash recovery)
phase: "research_complete"
  # Valid: scope_in_progress, scope_complete,
  #   research_in_progress, research_complete, research_recycled,
  #   design_in_progress, design_complete, design_recycled,
  #   plan_in_progress, plan_complete, plan_recycled,
  #   execute_in_progress, complete, archived
current_task: null                        # Task ID during execute phase

# Imported artifacts (from connected flow)
imported_from: null                       # Path to imported HANDOFF.md/DESIGN.md
constraints:                              # Locked constraints from imported artifacts
  - "Use SwiftUI, not UIKit (LOCKED from prior design)"

# Research rounds
research_rounds: 1                        # Incremented on each /arc:research invocation

# Questions (flat list, max 2 nesting levels)
questions:
  - id: "q01"
    text: "How should the OAuth2 flow be implemented?"
    priority: "P0"                        # P0 (critical), P1 (important), P2 (nice-to-have)
    decision_area: "authentication"
    source_hints: ["web", "codebase"]     # YAML flow-style array
    status: "covered"                      # pending/covered/partial/not_covered/unavailable_source
    source: "original"                    # "original" | "discovered-round-{N}"
    gap_details: null                     # Specific gap description if not sufficient
    evidence_files: ["research/evidence-batch-01.md"]

# Gate history (flat list, append-only in state)
gate_history:
  - gate: "G2"
    timestamp: "2026-02-26T14:25:00Z"
    outcome: "go_advisory"                # go / go_advisory / hold / recycle / override
    must_passed: 4
    must_failed: 0
    should_passed: 2
    should_failed: 1
    notes: "1 question PARTIAL, missing corroboration"
    overridden: false

# Execution state
tasks: []                                 # Populated by plan skill (id, title, wave, status)
current_wave: null
```

**Schema constraints:**
- Maximum 2 levels of nesting. Questions list contains flat objects. Gate history list contains flat objects. No sub-objects within question items.
- All string values quoted.
- Explicit `null` for empty fields.
- `version` field enables schema evolution.
- Target: under 100 lines for a typical lifecycle (10-15 questions). With 15+ questions the file may exceed 100 lines -- this is acceptable but should be monitored.

### Phase Transitions

```
(none) --> scope_in_progress --> scope_complete [G1 by /arc:scope]
scope_complete --> research_in_progress --> research_complete [G2 by /arc:research]
                                       --> research_recycled --> research_in_progress
research_complete --> design_in_progress --> design_complete [G3 by /arc:design]
                                        --> design_recycled --> design_in_progress
design_complete --> plan_in_progress --> plan_complete [G4 by /arc:plan]
                                    --> plan_recycled --> plan_in_progress
plan_complete --> execute_in_progress --> complete
                                     --> execute_in_progress (pause/resume cycle)
Any phase --> archived (when a new lifecycle archives the old one)
```

**Transition rules:**
- Forward transitions only (scope -> research -> design -> plan -> execute -> complete).
- Recycle sets `{phase}_recycled`; re-entry transitions to `{phase}_in_progress`.
- Override (`--override` flag) bypasses a gate's Recycle/Hold and forces forward transition.
- "Pause" is not a separate phase -- it is `execute_in_progress` with checkpoint.yml recording the pause point.
- Each `_complete` phase is proof that the output gate passed.

### State Write Pattern

Every state.yml write uses the complete-file rewrite pattern:
1. Read current state.yml.
2. Copy current state.yml to state.yml.bak (backup before write).
3. Modify the in-memory representation.
4. Write the entire file back.

This avoids partial-update corruption. The backup file enables recovery if a write is interrupted.

### SessionStart Hook

**scripts/session-start.sh:**
```bash
#!/bin/bash
# Arc SessionStart hook -- inject lifecycle context on new sessions
# Uses plain text stdout to avoid additionalContext JSON bugs (#16538, #13650, #11509)

STATE_FILE=".arc/state.yml"

if [ ! -f "$STATE_FILE" ]; then
  exit 0  # No active lifecycle -- silent exit
fi

# Extract key fields using grep (avoids yq dependency)
PHASE=$(grep '^phase:' "$STATE_FILE" | head -1 | sed 's/phase: *"\{0,1\}\([^"]*\)"\{0,1\}/\1/')
PROJECT=$(grep '^project_name:' "$STATE_FILE" | head -1 | sed 's/project_name: *"\{0,1\}\([^"]*\)"\{0,1\}/\1/')
INTENT=$(grep '^intent:' "$STATE_FILE" | head -1 | sed 's/intent: *"\{0,1\}\([^"]*\)"\{0,1\}/\1/')

echo "Arc lifecycle active: \"$PROJECT\" ($INTENT intent)"
echo "Current phase: $PHASE"

# Phase-aware next-step routing
case "$PHASE" in
  *_in_progress)
    BASE_PHASE=$(echo "$PHASE" | sed 's/_in_progress//')
    echo "Continue with /arc:$BASE_PHASE"
    ;;
  *_complete)
    case "$PHASE" in
      scope_complete) echo "Run /arc:research to begin evidence gathering" ;;
      research_complete) echo "Run /arc:design to generate the design" ;;
      design_complete) echo "Run /arc:plan to generate the plan" ;;
      plan_complete) echo "Run /arc:execute to begin implementation" ;;
    esac
    ;;
  *_recycled)
    BASE_PHASE=$(echo "$PHASE" | sed 's/_recycled//')
    echo "Re-run /arc:$BASE_PHASE to address gaps (or use --override to proceed)"
    ;;
  execute_in_progress)
    echo "Resume with /arc:execute"
    ;;
  complete)
    echo "Lifecycle complete. Run /arc:scope for new lifecycle."
    ;;
  *)
    echo "Run /arc:status for details"
    ;;
esac
```

**Platform risk:** HIGH. Three open bugs (#16538, #13650, #11509) may prevent hook output from reaching Claude. Plain text stdout is a mitigation. Two independent fallback layers exist:
1. Dynamic context injection (`!cat .arc/state.yml 2>/dev/null`) in every SKILL.md.
2. `/arc:status` as a manual context reconstruction tool.

### Dynamic Context Injection (Defense-in-Depth)

Every SKILL.md includes at the top of its content:
```markdown
Current lifecycle state:
!`cat .arc/state.yml 2>/dev/null || echo "No active lifecycle"`
```

This ensures state is loaded even if the SessionStart hook fails. The `!command` syntax is a documented Claude Code plugin feature for dynamic content injection.

### Archival

When `/arc:scope` detects an existing lifecycle:

1. Generate slug: `{project_name_slugified}-{YYYYMMDD}` (e.g., `auth-redesign-20260226`).
2. Create `.arc/archive/{slug}/`.
3. Move all `.arc/` contents EXCEPT `archive/`, `sources.yml`, and `log.yml` to `.arc/archive/{slug}/`.
4. Preserve `.arc/sources.yml` in place (source configuration persists across lifecycles).
5. Preserve `.arc/log.yml` in place (telemetry persists across lifecycles for v2 calibration).
6. Append archival event to log.yml.
7. Initialize fresh state.yml from template.

### Resume After /clear

1. SessionStart hook fires (if working): injects 2-3 line summary.
2. Any `/arc:*` skill reads state.yml via dynamic injection (`!cat .arc/state.yml`), determines current phase, proceeds.
3. If neither hook nor skill invocation: user runs `/arc:status` manually for full context.
4. Execute phase resume: reads `current_task` from state.yml, reads checkpoint.yml, displays resumption context with the "fresh agent with context" pattern -- not true state resumption but context-aware restart.

---

## Skill Specifications

### /arc:scope -- Define Lifecycle Scope

**Purpose:** Start a new arc lifecycle. Interactively define the project intent (product/engineering), research questions, decision areas, source configuration, and success criteria. This is the only phase where the developer has an extended interactive conversation with arc.

**Entry conditions:**
- No strict precondition. If an active lifecycle exists, the developer is prompted to archive it.

**SKILL.md Frontmatter:**
```yaml
---
name: scope
description: >
  Start a new arc lifecycle or refine an existing scope.
  Triggers: /arc:scope, "start arc", "new arc project", "define scope", "begin lifecycle"
allowed-tools:
  - Read
  - Write
  - Glob
  - Bash
  - AskUserQuestion
---

Current lifecycle state:
!`cat .arc/state.yml 2>/dev/null || echo "No active lifecycle"`
```

**Orchestration flow:**

1. **Lifecycle check.** Read `.arc/state.yml`. If exists with `phase != "complete"` and `phase != "archived"`: display summary, ask via freeform prompt: "An active lifecycle exists ({project_name}, phase: {phase}). Archive and start new? (yes / no)". If yes: execute archival flow. If no: exit with guidance.

2. **Connected flow artifact detection.** Scan `.arc/design/HANDOFF.md`, `.arc/design/DESIGN.md`, `.arc/archive/*/HANDOFF.md`, `.arc/archive/*/DESIGN.md`. If found: present via AskUserQuestion (header: "Import", options: ["Import as context", "Skip", "Review first"]). On import: read artifact, extract Key Decisions as locked constraints, Scope Boundaries as pre-populated scope, Suggested Engineering Questions as proposed questions. Record in state.yml: `imported_from` path and `constraints[]` list.

3. **Initialize state.** Copy state.yml.template to `.arc/state.yml` with `phase: "scope_in_progress"`. Copy sources.yml.template to `.arc/sources.yml` if not already present (preserved across lifecycles).

4. **Interactive questioning (Round 1: Context).** Ask via freeform prompts:
   - "What is the project name?"
   - "Is this a product or engineering investigation?" (freeform -- developer types naturally, orchestrator parses for intent keywords)
   - "Describe what you want to accomplish in 2-3 sentences."

5. **Interactive questioning (Round 2: Refinement).** Based on intent and description:
   - Product: "Who are the target users?", "What problem does this solve?", "What does success look like?"
   - Engineering: "What is the current architecture context?", "What are the hard constraints?", "What is the desired end state?"
   - Additional questions based on imported constraints if any.

6. **Question plan generation (Round 3: "Terraform plan-apply" preview).** Using gathered context, the main session generates 5-15 research questions grouped by decision area. Each question includes: text, priority (P0/P1/P2), source_hints, decision_area. Present as structured preview:
   ```
   --- Question Plan Preview ---
   [P0] How does X framework handle Y? (web)
   [P0] What is the current architecture of Z? (codebase)
   [P1] What do users report about W? (web, mcp:jira)
   ...
   --- 12 questions, estimated 3 research batches ---
   Proceed? (yes / modify / add questions)
   ```
   User can approve, modify, or add questions. No research tokens spent until approval.

7. **Source configuration.** Display configured sources as a checklist via freeform prompt:
   ```
   Configured sources:
     [x] Web (WebSearch, WebFetch) - always available
     [x] Codebase (Grep, Read, Glob, Bash) - always available
     [ ] GitHub (mcp__github__*) - not configured
   Use these? (yes / edit)
   ```
   If "edit": guide through source modification. Freeform prompt avoids AskUserQuestion timeout.

8. **Write artifacts.** Write `.arc/scope/SCOPE.md` with approved question plan, success criteria, intent, imported constraints. Update state.yml with questions and per-question metadata.

9. **Gate G1 evaluation (inline).** Structural check:

| Type | Criterion | Check Method |
|------|-----------|-------------|
| MUST | SCOPE.md exists and is non-empty | File existence |
| MUST | At least 3 questions defined | Count questions array |
| MUST | Intent declared (product or engineering) | Check `intent` field |
| MUST | At least one success criterion defined | Search SCOPE.md |
| SHOULD | Questions have source hints | Check each question |
| SHOULD | Questions span at least 2 decision areas | Compare decision_area values |
| SHOULD | No more than 15 questions | Count questions array |

If all MUST pass: Go -- write `phase: "scope_complete"`. If any MUST fails: Hold -- display what is missing, user can fix inline (scope is interactive). Recycle is not applicable for G1.

**Subagent invocations:** None. Scope runs entirely in the main session.

**Error handling:**

| Failure Mode | Recovery |
|-------------|----------|
| `.arc/` directory creation fails | Report filesystem error, suggest checking permissions |
| Template files missing from plugin | Report plugin installation issue |
| User abandons mid-scope (session interrupted) | state.yml at `scope_in_progress` preserves partial progress; next `/arc:scope` resumes |
| Archival fails | Warn and proceed without archiving (old lifecycle preserved) |
| Cross-lifecycle artifact not parseable | Skip import, inform user |
| AskUserQuestion timeout (60s) for import | Default to skip |

**Intent adaptation:** Product intent emphasizes user needs, market context, and Cagan's four risks (value, usability, feasibility, viability). Engineering intent emphasizes architecture decisions, implementation feasibility, and technical trade-offs.

---

### /arc:research -- Gather Evidence

**Purpose:** Execute parallel research across configured sources to gather evidence for scoped questions. Handles initial research, gap-fill after Recycle, and dynamic question discovery. This is the only phase that spawns subagents.

**Entry conditions:** `phase: scope_complete` or `phase: research_recycled`.

**SKILL.md Frontmatter:**
```yaml
---
name: research
description: >
  Gather evidence for scope questions using parallel research agents.
  Triggers: /arc:research, "research", "gather evidence", "investigate questions"
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
!`cat .arc/state.yml 2>/dev/null || echo "No active lifecycle"`
```

**Orchestration flow:**

1. **Entry validation.** Read state.yml. Verify `phase` is `scope_complete` or `research_recycled` or `research_in_progress`. If not valid: display "Scope not complete. Run `/arc:scope` first." Also verify SCOPE.md artifact exists. Set `phase: "research_in_progress"`.

2. **Detect mode.**
   - If `phase` was `scope_complete`: initial research mode. Target all questions.
   - If `phase` was `research_recycled`: gap-fill mode. Read `gate_history` for failing questions. Filter to questions with `status: not_covered` or `status: partial`. Increment `research_rounds`.
   - If `phase` was `research_in_progress` and no evidence files exist: treat as initial research (not gap-fill). This handles the edge case where all agents failed on the first attempt.

3. **Source-affinity batching.** Group target questions into batches by source requirements:
   - Batch type "web": questions with source_hints containing "web". Tools: WebSearch, WebFetch.
   - Batch type "codebase": questions with source_hints containing "codebase". Tools: Grep, Read, Glob, Bash.
   - Batch type "mcp": questions with source_hints containing MCP server names. Tools: `mcp__<server>__*`.
   - Merge batches with < 2 questions into the nearest compatible batch.
   - Split batches with > 5 questions into sub-batches (by priority: P0 questions in one batch, P1/P2 in another).
   - Target: 3-5 batches total.
   - For gap-fill mode: re-batch by decision area affinity (not original source affinity).

4. **Construct per-batch agent prompts.** For each batch:
   - Load the appropriate prompt template (`prompt-web-researcher.md`, `prompt-codebase-analyst.md`, or `prompt-mcp-researcher.md`).
   - Read frontmatter for `subagent_type` and `model`.
   - Inline into the prompt: batch questions (with priority, context, gap_details if gap-fill), output file path, intent lens, circuit breaker instructions, dynamic question discovery instructions.
   - Target prompt size: ~4-5K tokens.

5. **Dispatch research agents.** Spawn up to 3 agents simultaneously via Task():
   ```
   Task(
     prompt: <constructed batch prompt>,
     description: "Research batch {id}: {batch_type} sources for {N} questions",
     subagent_type: <from frontmatter>,
     model: <from frontmatter>
   )
   ```
   If more than 3 batches: dispatch in rounds (first 3, wait for completion, then remaining). All research subagents run in foreground (`subagent_type: "general-purpose"` for web/MCP, `subagent_type: "explore"` for codebase) -- MCP tools are only accessible in foreground subagents.

6. **Progress reporting.** After each batch agent completes: "Batch {id} ({type}) complete: {confidence} confidence, {N} sources consulted. {remaining} batches remaining."

7. **Dynamic question discovery.** Scan evidence files for proposed questions (YAML blocks after `# --- PROPOSED QUESTIONS ---` marker). Extract via regex. Deduplicate via LLM judgment (inline). If unique proposals exist (max 4): present via AskUserQuestion (multiSelect, header: "New Qs"). Approved questions added to state.yml with `status: "pending"`, `source: "discovered-round-{N}"`. If new questions added: create supplemental batch and dispatch.

8. **Sufficiency assessment (inline).** For each question, evaluate using `prompt-sufficiency-evaluator.md` as inline guidance. Assess three dimensions qualitatively, then assign a categorical rating:
   - **Coverage:** Is the question answered with specific, relevant evidence?
   - **Corroboration:** Do multiple independent sources agree?
   - **Actionability:** Can the design phase use this evidence directly?
   - Categorical rating (proven in research-engine):
     - **COVERED:** Evidence is specific, corroborated, and actionable. The design phase can use this directly.
     - **PARTIAL:** Evidence exists but has gaps — missing corroboration, only partially addresses the question, or requires significant interpretation.
     - **NOT COVERED:** No relevant evidence, or evidence is too weak/contradictory to inform design.
     - **UNAVAILABLE-SOURCE:** Source failures prevented evidence gathering (distinct from weak evidence).
   - Update each question in state.yml: status, evidence_files, gap_details.

9. **Synthesis.** Spawn synthesis agent via Task():
   ```
   Task(
     prompt: <synthesis prompt with all evidence file paths>,
     description: "Synthesize research evidence across {N} batches",
     subagent_type: "general-purpose",
     model: "opus"
   )
   ```
   Initial round: produces `.arc/research/SYNTHESIS.md` organized by decision area.
   Gap-fill round: produces `round-{N}/supplement-synthesis.md` as additive delta (reads all evidence, weights supplements higher).

10. **Gate G2 evaluation (inline).**

| Type | Criterion | Check Method |
|------|-----------|-------------|
| MUST | SYNTHESIS.md exists and is non-empty | File existence |
| MUST | All P0 questions are COVERED or PARTIAL | Status check per P0 question |
| MUST | No P0 question has UNAVAILABLE-SOURCE without alternative consulted | Status + source check |
| MUST | Majority of all questions are COVERED | Count covered / total |
| SHOULD | All questions (not just P0) are COVERED | Count |
| SHOULD | No question is NOT COVERED | Count |
| SHOULD | All decision areas have >= 1 COVERED question | Group by decision_area |

Gate outcomes:
- **Go:** All MUST pass AND all SHOULD pass. Write `phase: "research_complete"`.
- **Go (advisory):** All MUST pass, some SHOULD fail. Write `phase: "research_complete"`. Inject gap context: "The following evidence gaps were noted: [list]."
- **Recycle:** Any MUST fails. Write `phase: "research_recycled"`. Record in gate_history. Recycle escalation: 1st (informational), 2nd (suggest scope adjustment), 3rd (recommend override).

11. **Update state and display results.** Write state.yml, append to log.yml. Display per-question sufficiency table (COVERED/PARTIAL/NOT COVERED). If Go: "Research complete. Run `/arc:design`." If Recycle: display gap details and recommended actions.

**Subagent invocations:**
- 2-5 research agents (model: sonnet, ~5K token prompts)
- 1 synthesis agent (model: opus, ~15-20K token prompt)
- Token budget estimate: ~240K (research) + ~110K (synthesis) + ~30-50K (orchestrator + inline sufficiency) = ~380-400K total

**Error handling:**

| Failure Mode | Recovery |
|-------------|----------|
| Single agent failure | Note failure, continue with remaining agents. Mark affected questions NOT COVERED. |
| Rate limit | Use `resume` parameter with agent ID for continuation. |
| All agents fail | Report failure, suggest checking source config. Remain in `research_in_progress` for retry. |
| Synthesis agent failure | Evidence files remain. User can retry `/arc:research` which detects evidence and offers to skip to synthesis. |
| Sufficiency evaluator failure | Fall back to structural checks: mark COVERED if evidence file references the question, NOT COVERED otherwise. Log failure. |
| Re-entering with zero evidence files | Treat as initial research, not gap-fill. |

**Intent adaptation:** Research templates include intent lens. Product: prioritize user quotes, behavior data, market reports. Engineering: prioritize production measurements, reference implementations, technical docs.

---

### /arc:design -- Generate Design

**Purpose:** Synthesize research evidence into an implementation design (engineering: RFC) or product design (product: PRD). Optionally generates HANDOFF.md for product-to-engineering handoff. Supports in-session revision.

**Entry conditions:** `phase: research_complete` (or `--override` with `phase: research_recycled`).

**SKILL.md Frontmatter:**
```yaml
---
name: design
description: >
  Generate implementation or product design from research evidence.
  Triggers: /arc:design, "generate design", "design phase"
  Supports --override flag to proceed despite gate warnings.
allowed-tools:
  - Read
  - Write
  - Glob
  - Bash
argument-hint: "[--override]"
---

Current lifecycle state:
!`cat .arc/state.yml 2>/dev/null || echo "No active lifecycle"`
```

**Orchestration flow:**

1. **Entry validation.** Verify `phase: research_complete`. If `--override` and `phase: research_recycled`: record override in gate_history with severity, inject gap context as `<known_gaps>` section. Verify SYNTHESIS.md exists. Set `phase: "design_in_progress"`.

2. **Design generation (main session).** Load `prompt-design-guide.md` as reference guidance. The main session reads SCOPE.md, SYNTHESIS.md, supplement syntheses, constraints, gap context (if any). Intent determines output format:
   - Engineering: RFC-style (context/scope, goals/non-goals, detailed design, alternatives considered, cross-cutting concerns, implementation plan).
   - Product: PRD-style (problem statement, personas, user stories, flows, success metrics, scope boundaries).
   Write to `.arc/design/DESIGN.md`.

3. **HANDOFF.md generation (product intent only).** If `intent: product`, generate `.arc/design/HANDOFF.md` with 9 sections:
   1. Problem Statement (from DESIGN.md, compressed)
   2. Key Decisions (LOCKED -- from scope constraints and design decisions)
   3. Scope Boundaries (what is in/out)
   4. Success Metrics (observable, measurable)
   5. User Flows (compressed from DESIGN.md)
   6. Acceptance Criteria (testable Given/When/Then format)
   7. Assumptions and Constraints (technical implications of product decisions)
   8. Suggested Engineering Questions (seed questions for engineering lifecycle)
   9. Priority Ranking for Trade-offs (guidance on what to prioritize when trade-offs arise)

   Sections 1-8 are grounded in HashiCorp PRD-to-RFC translation and design handoff practices (MODERATE evidence). Section 9 is a design addition (WEAK evidence). HANDOFF.md is a v1-iteration candidate subject to format refinement.

4. **Design revision cycle.** Present design summary. Ask: "Review the design. Request changes, or proceed? (changes / proceed)". If changes requested: accept freeform feedback, revise DESIGN.md. Maximum 2 revision rounds in-session. After 2 rounds: "Design has been revised twice. Proceeding to gate evaluation."

5. **Gate G3 evaluation (inline).**

| Type | Criterion | Check Method |
|------|-----------|-------------|
| MUST | DESIGN.md exists and is non-empty | File existence |
| MUST | Design addresses all P0 questions from research | Cross-reference against SCOPE.md |
| MUST | Design includes success/acceptance criteria | LLM structural check |
| SHOULD | Design addresses all P1 questions | LLM evaluation |
| SHOULD | Scope boundaries are clearly defined | LLM judgment |
| SHOULD | Alternatives considered section present | LLM structural check |
| SHOULD | (Product intent) HANDOFF.md exists | File existence |

Go/advisory/recycle logic same as G2. Write `phase: "design_complete"` on Go.

**Subagent invocations:** None. Design runs in main session.

**Error handling:**

| Failure Mode | Recovery |
|-------------|----------|
| SYNTHESIS.md missing or empty | Inform user. Suggest re-running /arc:research. |
| Design generation produces incomplete output | Prompt user to request changes via revision cycle. |
| HANDOFF.md generation fails | DESIGN.md succeeds. Note failure. User can re-run or skip. |
| File write failure | Retry once, then display error. |

---

### /arc:plan -- Generate Implementation Plan

**Purpose:** Decompose the design into an ordered implementation plan. Engineering intent produces wave-ordered tasks with technical acceptance criteria. Product intent produces epics and user stories with Given/When/Then criteria.

**Entry conditions:** `phase: design_complete` (or `--override` with `phase: design_recycled`).

**SKILL.md Frontmatter:**
```yaml
---
name: plan
description: >
  Generate wave-ordered implementation plan from the design.
  Triggers: /arc:plan, "generate plan", "plan phase", "decompose tasks"
  Supports --override flag.
allowed-tools:
  - Read
  - Write
  - Glob
  - Bash
argument-hint: "[--override]"
---

Current lifecycle state:
!`cat .arc/state.yml 2>/dev/null || echo "No active lifecycle"`
```

**Orchestration flow:**

1. **Entry validation.** Verify `phase: design_complete`. Handle `--override` if applicable. Verify DESIGN.md exists. Set `phase: "plan_in_progress"`.

2. **Plan generation (main session).** Load `prompt-plan-guide.md` as reference. Intent determines output format:

   **Engineering intent:**
   ```
   # Implementation Plan
   ## Wave 1: [description]
   ### Task t01: [title]
   - Files: [specific files to create/modify]
   - Acceptance criteria:
     - [ ] [specific, verifiable criterion]
   - Estimated effort: [hours]
   - Dependencies: [task IDs, if any]
   ```

   **Product intent:**
   ```
   # Product Plan
   ## Epic 1: [user-facing capability]
   ### Story 1.1: [user story]
   - Acceptance criteria (Given/When/Then):
     - Given [context], When [action], Then [outcome]
   - Priority: [P0/P1/P2]
   - Sizing: [S/M/L/XL]
   ```

3. **Plan preview.** Display summary. Ask: "Proceed with this plan? (approve / edit / regenerate)". If edit: accept modifications. If regenerate: regenerate with feedback.

4. **Gate G4 evaluation (inline).**

| Type | Criterion | Check Method |
|------|-----------|-------------|
| MUST | PLAN.md exists and is non-empty | File existence |
| MUST | At least 1 task/story defined | Structural parse |
| MUST | Every task/story has acceptance criteria | Structural parse |
| MUST | (Engineering) Tasks have wave ordering | Check wave assignments |
| MUST | (Product) Stories have priority ranking | Check priority fields |
| SHOULD | All design elements have corresponding tasks/stories | Cross-reference DESIGN.md |
| SHOULD | (Engineering) Dependencies form a DAG (no cycles) | Topological analysis |
| SHOULD | Acceptance criteria are specific and testable | LLM judgment |

Write `phase: "plan_complete"` on Go.

5. **Update state.** Record task/story list in state.yml (IDs, titles, wave/epic, statuses all "pending"). Append to log.yml.

**Subagent invocations:** None. Plan runs in main session.

---

### /arc:execute -- Execute Plan

**Purpose:** Execute plan tasks sequentially in the main session with wave-based ordering. Supports pause/resume via checkpoints and the "Continue? (yes / pause / review)" micro-interaction between tasks.

**Entry conditions:** `phase: plan_complete` or `phase: execute_in_progress` (resume).

**SKILL.md Frontmatter:**
```yaml
---
name: execute
description: >
  Execute the implementation plan task by task in the current session.
  Triggers: /arc:execute, "execute", "run plan", "implement", "build it"
allowed-tools:
  - Read
  - Write
  - Edit
  - Glob
  - Grep
  - Bash
  - WebSearch
  - WebFetch
---

Current lifecycle state:
!`cat .arc/state.yml 2>/dev/null || echo "No active lifecycle"`
```

**Orchestration flow:**

1. **Entry validation.** Verify `phase: plan_complete` or `phase: execute_in_progress`. Verify PLAN.md exists. Set `phase: "execute_in_progress"`.

2. **Determine starting point.** Fresh start: first task in wave 1. Resume: read checkpoint.yml, find last completed task, advance to next pending. Display: "Resuming from task {ID}: {title}."

3. **Task execution loop.** For each task in wave order:

   a. **Display task.** Show ID, title, description, acceptance criteria, wave.

   b. **Execute task.** The main session performs implementation work -- reading files, writing code, running commands. Standard Claude Code behavior.

   c. **Verify acceptance criteria with design traceability.** For each acceptance criterion: (1) confirm which design decision it traces to, (2) verify the code change actually addresses that design decision -- not just that it passes a disconnected acceptance check. Programmatic criteria checked via Bash/Read. Judgment criteria noted as "requires human review." The contract chain (scope question → evidence → design decision → plan task → code change) must remain unbroken.

   d. **Update checkpoint.yml.**
   ```yaml
   current_task: "t03"
   current_wave: 2
   last_completed_task: "t02"
   last_completed_at: "2026-02-26T14:30:00Z"
   tasks_completed: 2
   tasks_total: 12
   status: "in_progress"
   continuation_notes: "Completed auth middleware. Next: rate limiting."
   ```

   e. **Append to PROGRESS.md.** Uses `cat >>` Bash pattern with "do NOT rewrite" instruction.
   ```
   ## t02: Implement Auth Middleware
   - Status: complete
   - Files: Sources/Auth/AuthMiddleware.swift
   - Notes: Added PKCE flow support
   - Completed: 2026-02-26T14:30:00Z
   ```

   f. **Update state.yml.** Mark task status, update current_task.

   g. **Micro-interaction (freeform prompt).**
   ```
   Task t02 complete (2/12). Continue?
   > yes / pause / review
   ```
   - **yes:** proceed to next task.
   - **pause:** write checkpoint, display "Execution paused. Resume with `/arc:execute`.", exit.
   - **review:** display PROGRESS.md summary, then re-prompt.

   Between waves: "Wave 1 complete ({M} tasks). Continue to wave 2? (yes / pause / review)"

4. **Completion.** When all tasks done: verify SCOPE.md success criteria (lightweight prompt-based check), update `phase: "complete"`, display lifecycle summary.

**Subagent invocations:** None. All execution in main session per C-7.

**Error handling:**

| Failure Mode | Recovery |
|-------------|----------|
| Task fails (build error, test failure) | Display error. Ask: "Retry / Skip / Pause?" |
| Session interrupted (/clear) | Resume from checkpoint.yml via `/arc:execute` re-invocation |
| checkpoint.yml corrupted | Attempt reconstruction from PROGRESS.md |
| All tasks in a wave fail | Pause execution, suggest reviewing plan |

---

### /arc:status -- View Lifecycle Status

**Purpose:** Display current lifecycle state, phase, progress, and recommended next action. Acts as the primary fallback for SessionStart hook context reconstruction after `/clear`.

**Entry conditions:** None (always available).

**SKILL.md Frontmatter:**
```yaml
---
name: status
description: >
  Display current lifecycle status and context summary.
  Triggers: /arc:status, "status", "where am I", "lifecycle status"
allowed-tools:
  - Read
  - Glob
  - Bash
---

Current lifecycle state:
!`cat .arc/state.yml 2>/dev/null || echo "No active lifecycle"`
```

**Orchestration flow:**

1. **Read state.** If no `.arc/state.yml`: "No active arc lifecycle. Run `/arc:scope` to start one."

2. **Display status.**
   ```
   === Arc Lifecycle Status ===
   Project: auth-redesign
   Intent: engineering
   Phase: research_complete (since 2026-02-26T14:30:00Z)

   Questions: 12 total
     - 8 covered, 3 partial, 1 not covered

   Gate G2: go_advisory (1 SHOULD gap noted)
   Recycle count: 0

   Next step: Run /arc:design to generate the design
   ```

3. **Artifact-based reconstruction.** If state.yml appears stale or inconsistent, reconcile by checking artifact existence (SCOPE.md exists -> scope started, SYNTHESIS.md -> research completed, etc.). Update state.yml if needed.

4. **Log size warning.** If log.yml exceeds 50 KB: "Note: log.yml is large ({size}). Consider archiving it."

5. **Archive listing.** If `.arc/archive/` has entries, list them.

---

## Gate Evaluation System

### G1-G4 Criteria Tables

Each gate uses MUST (all must pass for Go) and SHOULD (failures produce advisory, not block) criteria. Gates G1 and G4 are primarily structural checks. Gates G2 and G3 involve LLM judgment.

**G1: Scope-to-Research (evaluated by /arc:scope)**

| Type | Criterion | Check Method |
|------|-----------|-------------|
| MUST | SCOPE.md exists and is non-empty | File existence |
| MUST | At least 3 questions defined | Count |
| MUST | Intent declared (product or engineering) | Field check |
| MUST | At least one success criterion defined | Content search |
| SHOULD | Questions have source hints | Field check per question |
| SHOULD | Questions span >= 2 decision areas | Distinct values |
| SHOULD | No more than 15 questions | Count |

**G2: Research-to-Design (evaluated by /arc:research)**

| Type | Criterion | Check Method |
|------|-----------|-------------|
| MUST | SYNTHESIS.md exists and is non-empty | File existence |
| MUST | All P0 questions are COVERED or PARTIAL | Status check per P0 question |
| MUST | No P0 UNAVAILABLE-SOURCE without alternative consulted | Status check |
| MUST | Majority of all questions are COVERED | Count covered / total |
| SHOULD | All questions are COVERED | Count |
| SHOULD | No question is NOT COVERED | Count |
| SHOULD | All decision areas have >= 1 COVERED question | Group check |

**G3: Design-to-Plan (evaluated by /arc:design)**

| Type | Criterion | Check Method |
|------|-----------|-------------|
| MUST | DESIGN.md exists and is non-empty | File existence |
| MUST | Design addresses all P0 questions | LLM cross-reference |
| MUST | Success/acceptance criteria present | LLM structural check |
| SHOULD | All P1 questions addressed | LLM evaluation |
| SHOULD | Scope boundaries clearly defined | LLM judgment |
| SHOULD | Alternatives considered section present | LLM structural check |
| SHOULD | (Product) HANDOFF.md exists | File existence |

**G4: Plan-to-Execute (evaluated by /arc:plan)**

| Type | Criterion | Check Method |
|------|-----------|-------------|
| MUST | PLAN.md exists and is non-empty | File existence |
| MUST | At least 1 task/story defined | Structural parse |
| MUST | Every task/story has acceptance criteria | Structural parse |
| MUST | (Engineering) Tasks have wave ordering | Check wave assignments |
| MUST | (Product) Stories have priority ranking | Check priority fields |
| MUST | Every design decision has at least one corresponding task | Cross-reference DESIGN.md decisions → PLAN.md tasks |
| MUST | Acceptance criteria trace back to design decisions (not invented independently) | Cross-reference: each criterion cites a design decision |
| SHOULD | Dependencies form a DAG (no cycles) | Topological analysis |
| SHOULD | Acceptance criteria are specific and testable | LLM judgment |

### Evaluation Method

Gates G1 and G4 use primarily programmatic checks (file existence, field validation, structural parsing). G4 additionally requires cross-referencing DESIGN.md decisions against PLAN.md tasks to verify the contract chain -- this is a structural cross-reference (checking that mappings exist), not LLM judgment about quality.

Gates G2 and G3 use LLM judgment for content-quality criteria, guided by a structured evaluation prompt:

```markdown
<gate_evaluation>
Evaluate the following criteria for the {phase} -> {next_phase} transition.

<criteria>
MUST criteria (ALL must pass for Go):
1. [criterion text] -- Check: [how to verify]
...

SHOULD criteria (failures produce advisory, not block):
1. [criterion text] -- Check: [how to verify]
...
</criteria>

<evaluation_format>
For each criterion:
- Criterion: [text]
- Status: PASS | FAIL
- Evidence: [one sentence justification]

Summary:
- MUST results: [N]/[M] passed
- SHOULD results: [N]/[M] passed
- Decision: Go | Go (advisory) | Recycle
- Gap summary: [list any FAIL items]
</evaluation_format>
</gate_evaluation>
```

### Go/Hold/Recycle Logic

```
IF all MUST pass:
  IF all SHOULD pass:
    -> Go (clean)
  ELSE:
    -> Go (advisory) -- proceed, inject gap context into next phase
ELSE:
  -> Recycle -- return to current phase for rework
  Check recycle_count for this gate:
    0 (1st failure): informational message
    1 (2nd failure): suggest scope adjustment or override
    2+ (3rd+ failure): recommend override
```

### Override Mechanism

When the developer passes `--override` to a skill (e.g., `/arc:design --override`):

1. Read most recent gate failure from gate_history.
2. Record override: `overridden: true`, severity of what was overridden (MUST vs SHOULD), list of gaps acknowledged.
3. Inject gap context into next phase prompt:
   ```xml
   <known_gaps>
   The following evidence gaps exist due to gate override:
   - Q2: iOS Keychain evidence rated NOT COVERED — no specific implementation guidance found
   - Q5: Performance claims rated PARTIAL — single source, no corroboration
   Address these where possible. Make conservative assumptions for unresolved gaps.
   </known_gaps>
   ```
4. Display warning proportional to severity:
   - SHOULD override: "Proceeding with known gaps."
   - MUST override: "WARNING: Proceeding despite fundamental gaps. This may reduce output quality."
5. Update phase to next phase.

Override applies to both MUST and SHOULD failures. The developer always retains agency.

### Recycle Escalation

Track recycle count per gate in gate_history:
- **1st recycle:** Informational. "Gate G2 returned Recycle. {N} questions need more evidence. Run `/arc:research` to fill gaps."
- **2nd recycle:** Advisory. "Gate G2 has recycled twice. Consider: narrowing scope, adjusting sources, or overriding with `/arc:design --override`."
- **3rd+ recycle:** Strong recommendation. "Gate G2 has recycled 3 times. Remaining gaps may not be resolvable. Strongly recommend `/arc:design --override` to proceed."

---

## Subagent Orchestration Model

### Task() Invocation Pattern

```
Task(
  prompt: "<full prompt text with template + dynamic context>",
  description: "Research batch 1: web search for questions q01, q03, q07",
  subagent_type: "general-purpose",
  model: "sonnet"
)
```

The orchestrator SKILL.md constructs the prompt by:
1. Reading the prompt template from `references/prompt-*.md`.
2. Extracting frontmatter (`subagent_type`, `model`).
3. Replacing template variables with dynamic context (questions, source config, file paths, intent lens).
4. Inlining any required file content (SCOPE.md excerpts, prior evidence). Content must be inlined -- no @-references across Task boundaries.

### Model Tier Assignments (v1, hardcoded in frontmatter)

| Agent Role | Model | Context | Rationale |
|-----------|-------|---------|-----------|
| Web researcher | sonnet | Subagent (Task) | Fast, cost-effective for search-and-summarize |
| Codebase analyst | sonnet | Subagent (Task, explore) | Built-in codebase exploration tools |
| MCP researcher | sonnet | Subagent (Task) | MCP tools require foreground general-purpose |
| Research synthesizer | opus | Subagent (Task) | Judgment: cross-referencing, contradiction detection |
| Design generation | (inherits session) | Main session | C-7, revision cycle, user controls model |
| Plan generation | (inherits session) | Main session | C-7, full tool access |
| Sufficiency evaluator | (inherits session) | Inline | Avoids ~80K subagent overhead |
| Gate evaluator | (inherits session) | Inline | D1, C-7 |

Task() is used exclusively for research-phase operations. All other work runs in the main session.

### Concurrency Model

- Maximum 3 concurrent research subagents. Prompt instruction, not API enforcement.
- If > 3 batches: dispatch in rounds (first 3 parallel, then remaining after completion).
- Explicit parallel dispatch instruction: "Spawn these research agents simultaneously, all in parallel."
- Sequential fallback: if parallel dispatch fails (agents execute one-at-a-time), proceed sequentially with progress reporting between agents.
- All research subagents must run in foreground -- MCP tools are only accessible in foreground subagents (hard platform constraint).

### File-Based Output

| Agent | Output File | Location |
|-------|------------|----------|
| Research batch N | `evidence-batch-{N}.md` | `.arc/research/` |
| Gap-fill batch, round R | `round-{R}/supplement-{N}.md` | `.arc/research/` |
| Synthesizer | `SYNTHESIS.md` | `.arc/research/` |
| Gap-fill synthesizer | `round-{R}/supplement-synthesis.md` | `.arc/research/` |

### Condensed Returns

Each subagent prompt specifies in `<output_format>`:
```
Write detailed findings to `{output_file}`.
Return a summary (max 500 tokens):
- KEY FINDINGS: 3-5 bullet points (one line each)
- CONFIDENCE: high | medium | low
- SOURCES: count of distinct sources consulted
- GAPS: list unfulfilled requirements
- PROPOSED_QUESTIONS: max 2 new questions (optional, YAML block)
```

Target: 200-500 tokens inline return, 1,000-2,000 tokens per question in file output.

### Error Recovery

| Failure Mode | Detection | Recovery |
|-------------|-----------|----------|
| Agent produces no output file | Check file existence after Task() returns | Mark affected questions NOT COVERED, continue |
| Agent returns error | Error in Task() return | Log, spawn fresh agent with same prompt (1 retry) |
| Rate limit | Task() rate limit error | Wait, then use `resume` parameter |
| Agent exceeds condensed return budget | Inline return > 500 tokens | Orchestrator reads from file for synthesis |
| All agents fail | No evidence files produced | Report failure, remain in scope_complete, suggest retry |
| MCP agent in wrong subagent type | MCP tools inaccessible | Ensure subagent_type is "general-purpose" |

---

## Source Routing System

### sources.yml Schema

```yaml
# Arc Source Configuration
# Persists across lifecycles. Edit to add/remove sources.

sources:
  - name: "web"
    type: "builtin"
    tools: ["WebSearch", "WebFetch"]
    enabled: true
    description: "Web search and page fetching"

  - name: "codebase"
    type: "builtin"
    tools: ["Grep", "Read", "Glob", "Bash"]
    enabled: true
    description: "Local codebase analysis"

  - name: "github"
    type: "mcp"
    server: "github"
    tools: ["mcp__github__*"]
    enabled: false
    description: "GitHub issues, PRs, and repository data"
    setup_instructions: "Add github MCP server to .mcp.json"

  - name: "confluence"
    type: "mcp"
    server: "confluence"
    tools: ["mcp__confluence__*"]
    enabled: false
    description: "Confluence documentation and knowledge base"
    setup_instructions: "Add confluence MCP server to .mcp.json"

# Default source preferences by intent (soft defaults, overridable)
defaults:
  product: ["web"]
  engineering: ["web", "codebase"]
```

### Source Taxonomy

| Type | Description | Availability | Tools |
|------|-------------|-------------|-------|
| `builtin` | Always available, no configuration needed | Always | WebSearch, WebFetch, Grep, Read, Glob, Bash |
| `mcp` | Requires user MCP configuration in `.mcp.json` | Optimistic invocation; failure detected via `isError` | `mcp__<server>__*` wildcard |

No programmatic API exists to check MCP server availability. Availability is inferred from invocation success/failure.

### Source-Affinity Batching Algorithm

1. Read target questions from state.yml (all questions for initial, not_covered/partial for gap-fill).
2. For each question, read `source_hints` array.
3. Group questions by primary source hint (first element).
4. Merge groups with < 2 questions into the nearest compatible group.
5. Split groups with > 5 questions by priority (P0 in one batch, P1/P2 in another).
6. Validate: target 3-5 batches. If < 3, accept. If > 5, merge the two smallest.
7. Assign each batch to the appropriate per-source-type template.
8. For mixed-source questions (e.g., `["web", "codebase"]`): include in primary batch, instruct agent to check secondary sources if primary evidence insufficient.

### Source Selection UX

During `/arc:scope` source configuration:
```
Configured sources:
  [x] Web (WebSearch, WebFetch) - always available
  [x] Codebase (Grep, Read, Glob, Bash) - always available
  [ ] GitHub (mcp__github__*) - not configured
  [ ] Confluence (mcp__confluence__*) - not configured

Source configuration looks correct? (yes / edit)
```

Uses freeform prompt (not AskUserQuestion) to avoid the 60-second timeout. If "edit": guide through enabling/disabling sources and provide MCP setup instructions.

### Circuit Breaker (Three-Tier Failure Handling)

Embedded in each researcher subagent prompt (`<source_handling>` section):

```markdown
<source_handling>
For each assigned source tool:
1. Attempt to use the tool for your research.
2. If the tool returns an error:
   a. Server failure (timeout, connection error): retry ONCE. If second fails, stop.
   b. Platform failure (tool not found, "not available"): do NOT retry. Tool is inaccessible.
   c. No relevant results: tool works but returned nothing useful. Continue with other tools.
3. Report all source statuses:
   <source_status>
   - WebSearch: WORKING (5 queries, 12 results)
   - mcp__github__search_code: UNAVAILABLE (PLATFORM FAILURE: tool not found)
   </source_status>
</source_handling>
```

The orchestrator reads `<source_status>` blocks to classify:
- Server/platform failures -> UNAVAILABLE-SOURCE
- No relevant results -> NOT COVERED (source worked, evidence weak)

---

## Prompt Template Architecture

### 8-Section Template Structure

Every prompt template follows this structure using XML tags:

```markdown
---
subagent_type: general-purpose
model: sonnet
---

<role>
[Concrete expertise, not imagination-based. Operating context within arc's lifecycle.]
</role>

<context>
[Minimal: only what this agent needs. Project background, prior phase output, relevant state.]
</context>

<intent_lens intent="{{INTENT}}">
[Conditional focus based on product vs. engineering intent]
{{#if product}} Focus on user impact, market validation, business outcomes. {{/if}}
{{#if engineering}} Focus on implementation complexity, architectural soundness. {{/if}}
</intent_lens>

<downstream_consumer>
[Who reads this output, what they need, what to exclude]
</downstream_consumer>

<instructions>
[Numbered step-by-step. Explicit tool guidance. Clear boundaries.]
</instructions>

<output_format>
[Schema-first. Dual-target if subagent: file output + condensed return.]
</output_format>

<quality_gate>
Before completing, verify:
- [ ] [Criterion 1]
- [ ] [Criterion 2]
If any check fails, revise before completing.
</quality_gate>

<input_data>
[Actual questions/tasks for this invocation. Placed last per Anthropic recommendation.]
</input_data>
```

### Template Inventory

| Template | Location | Model | Purpose |
|----------|----------|-------|---------|
| prompt-scope-questioning.md | scope/references/ | N/A (main session) | Guide question plan generation |
| prompt-web-researcher.md | research/references/ | sonnet | Web research subagent |
| prompt-codebase-analyst.md | research/references/ | sonnet | Codebase analysis subagent |
| prompt-mcp-researcher.md | research/references/ | sonnet | MCP source research subagent |
| prompt-research-synthesizer.md | research/references/ | opus | Evidence synthesis subagent |
| prompt-sufficiency-evaluator.md | research/references/ | N/A (inline) | Per-question sufficiency rubric |
| prompt-design-guide.md | design/references/ | N/A (reference) | Design format and quality criteria |
| prompt-plan-guide.md | plan/references/ | N/A (reference) | Plan format and acceptance criteria patterns |
| prompt-task-verifier.md | execute/references/ | N/A (inline) | Acceptance criteria verification guidance |

Templates used as subagent prompts (web-researcher, codebase-analyst, mcp-researcher, synthesizer) include frontmatter with `subagent_type` and `model`. Templates used as inline guides (sufficiency-evaluator, design-guide, plan-guide, task-verifier) have no frontmatter -- they are reference material loaded by the SKILL.md.

### Intent-Adaptive Mechanism

Intent flows through templates via two mechanisms:

1. **Lens injection in `<context>` / `<intent_lens>`:** Every template includes intent-specific guidance. Product: "Focus on user needs, market positioning, business viability, and measurable outcomes." Engineering: "Focus on architecture decisions, implementation feasibility, performance characteristics, and technical trade-offs."

2. **Conditional sections in `<instructions>` and `<output_format>`:** Small conditional blocks (3-5 lines) switch based on intent. The orchestrator resolves conditions before the LLM sees the prompt.

### Token Budget Targets

| Template | Prompt Size | Agent Work | File Output | Inline Return |
|----------|-------------|-----------|-------------|---------------|
| Researcher (per batch) | ~5K | ~20-30K | ~1-3K per question | ~500 |
| Synthesizer | ~15-20K | ~50-80K | Unconstrained | ~500 |
| Sufficiency evaluator | ~2K (inline) | N/A | N/A | N/A |
| Design guide | ~3-5K (reference) | N/A | N/A | N/A |

Total research phase estimate: ~380-400K tokens (research agents + synthesis + orchestrator + inline sufficiency).

---

## Research Phase Orchestration

### Initial Research Flow

1. Read questions from state.yml (all questions with status "pending").
2. Execute source-affinity batching algorithm (described above).
3. Construct per-batch prompts from appropriate templates.
4. Dispatch up to 3 agents in parallel via Task().
5. Collect results. Report progress after each batch completes: "Batch {id} ({type}) complete."
6. Extract dynamic question proposals from evidence files.
7. Present new questions to user for approval.
8. Run per-question sufficiency assessment (inline).
9. Dispatch synthesis agent.
10. Evaluate G2 gate.
11. Update state and display results.

### Sufficiency Assessment

Per-question categorical assessment using three qualitative dimensions, following the research-engine's proven rubric pattern:

**Coverage:** Is the question answered with specific, relevant evidence?
- Strong: All aspects addressed with specific examples or data
- Adequate: Most aspects addressed, minor gaps remain
- Weak: Only superficially addressed or key aspects missing
- None: Not addressed by any evidence

**Corroboration:** Do multiple independent sources agree?
- Strong: 3+ independent sources converge
- Adequate: 2 sources agree with consistent evidence
- Weak: Single source only, or partial disagreement between sources
- None: Sources contradict or no relevant sources found

**Actionability:** Can the design phase use this evidence directly?
- Strong: Directly translates to design decisions with clear trade-offs
- Adequate: Provides direction with minor interpretation needed
- Weak: Too abstract for specific decisions
- None: Does not inform design choices

**Categorical Rating** (centralized in `prompt-sufficiency-evaluator.md`):
- **COVERED:** Coverage strong/adequate AND corroboration strong/adequate AND actionability strong/adequate. Evidence is ready for design.
- **PARTIAL:** At least one dimension is adequate+, but one or more is weak. Evidence exists but has gaps worth filling.
- **NOT COVERED:** Any dimension is "none", or multiple dimensions are weak. Evidence is insufficient for confident design.
- **UNAVAILABLE-SOURCE:** Source failures prevented evidence gathering. Distinct from weak evidence — the source was inaccessible, not unhelpful.

The evaluator assesses each dimension qualitatively, then assigns the categorical rating. No numeric scores are produced — this avoids the calibration dependency and inter-run variance issues inherent in LLM numeric scoring. The categorical model is proven in research-engine and can be upgraded to numeric scoring in v1.1 if finer granularity is needed.

### Dynamic Question Discovery

1. Each researcher prompt includes the `# --- PROPOSED QUESTIONS ---` YAML block format.
2. After all agents return, orchestrator scans evidence files for these blocks.
3. Extract via regex. Deduplicate via LLM judgment (inline in main session).
4. If unique proposals exist (max 4): present via AskUserQuestion (multiSelect, header: "New Qs").
5. Approved questions added to state.yml with `status: "pending"`, `source: "discovered-round-{N}"`.
6. If > 4 proposals, prioritize by cross-agent corroboration count.

### Gap-Fill Mode

When `/arc:research` is invoked with `phase: research_recycled`:

1. Filter to not_covered/partial questions.
2. Read gap details from gate_history.
3. Re-batch by decision area affinity (not original source affinity -- gap-fill research benefits from different grouping).
4. Spawn targeted research agents with gap-specific context injected.
5. Write to `round-{N}/supplement-{batch}.md`.
6. Re-assess sufficiency for targeted questions only.
7. Synthesize: reads all evidence (original + supplements), produces additive delta (`round-{N}/supplement-synthesis.md`).
8. Re-evaluate G2 gate.

**Edge case:** If re-entering research with zero evidence files (e.g., all agents failed on first attempt), treat as initial research, not gap-fill.

### Progress Reporting

Progress is reported after each batch completes (not on a timer). The Task tool has no callback, streaming, or progress mechanism. The relaxed requirement ("report after each batch") replaces the infeasible 60-second update from the product design. This is a platform limitation.

---

## Intent-Adaptive Behavior

### Per-Phase Differences

| Phase | Product Intent | Engineering Intent |
|-------|---------------|-------------------|
| Scope | Questions focus on user needs, market, Cagan's 4 risks (value, usability, feasibility, viability) | Questions focus on architecture, implementation, performance, prior art |
| Research | Evidence hierarchy: user quotes, behavior data, market reports | Evidence hierarchy: production measurements, reference implementations, technical docs |
| Design | Output: PRD (problem, personas, user stories, flows, metrics). Also generates HANDOFF.md. | Output: RFC (context, goals/non-goals, detailed design, alternatives, plan) |
| Plan | Output: Epics/stories with Given/When/Then criteria, T-shirt sizing, user-value axis | Output: Wave-ordered tasks with technical checklists, hour estimates, dependency axis |
| Execute | Validation focus: "built the right thing?" | Verification focus: "built it right?" |

### HANDOFF.md Specification (Product Intent Only)

Nine sections:

1. **Problem Statement:** From DESIGN.md, compressed to 1-2 paragraphs.
2. **Key Decisions (LOCKED):** From scope constraints and design decisions. These become non-negotiable constraints in an engineering lifecycle.
3. **Scope Boundaries:** What is in, what is out, what is deferred.
4. **Success Metrics:** Observable, measurable criteria.
5. **User Flows (compressed):** Key flows from DESIGN.md, reduced to step-by-step summaries.
6. **Acceptance Criteria:** Testable Given/When/Then format.
7. **Assumptions and Constraints:** Technical implications of product decisions.
8. **Suggested Engineering Questions:** Seed questions for an engineering lifecycle.
9. **Priority Ranking for Trade-offs:** Guidance on what to prioritize when trade-offs arise.

Sections 1-8: MODERATE evidence (grounded in HashiCorp PRD-to-RFC translation, Figma/Zeplin handoff practices). Section 9: WEAK evidence (design addition, no direct research precedent). The entire HANDOFF.md format is a v1-iteration candidate subject to refinement.

### Cross-Lifecycle Import

At the start of `/arc:scope`:

1. **Scan:** `.arc/design/HANDOFF.md`, `.arc/design/DESIGN.md`, `.arc/archive/*/HANDOFF.md`, `.arc/archive/*/DESIGN.md`.
2. **Present:** If found, offer via AskUserQuestion: "Import / Skip / Review first".
3. **On import:**
   - Key Decisions become LOCKED constraints in state.yml.
   - Scope Boundaries pre-populate the scope.
   - Suggested Engineering Questions become proposed questions with `status: "pending"`.
   - Record `imported_from` path in state.yml.

This enables the product-to-engineering handoff: a product lifecycle generates HANDOFF.md, the user starts an engineering lifecycle, and the scope skill detects and offers to import the prior artifact.

### Format Differences (Side-by-Side)

**Design Output:**

| Product (PRD) | Engineering (RFC) |
|---------------|-------------------|
| Problem Statement | Context and Scope |
| Personas | N/A |
| User Stories | Goals / Non-Goals |
| User Flows | Detailed Design |
| Success Metrics | Alternatives Considered |
| Scope Boundaries | Cross-cutting Concerns |
| N/A | Implementation Plan |

**Plan Output:**

| Product (Epics/Stories) | Engineering (Waves/Tasks) |
|------------------------|--------------------------|
| Organized by user-value axis | Organized by dependency axis |
| Given/When/Then criteria | Technical checklist criteria |
| T-shirt sizing (S/M/L/XL) | Hour estimates |
| Priority ranking (P0-P3) | Wave ordering |
| Sprint-sized work units | Task-sized work units |

---

## Passive Telemetry

### log.yml Schema

Multi-document YAML with `---` separators. Each entry is a standalone YAML document.

```yaml
---
event: "gate_evaluation"
timestamp: "2026-02-26T15:45:00Z"
gate: "G2"
outcome: "recycle"
must_passed: 5
must_failed: 1
should_passed: 3
should_failed: 2
lifecycle: "auth-redesign-20260226"
---
event: "agent_complete"
timestamp: "2026-02-26T15:30:00Z"
type: "web_researcher"
batch: 1
model: "sonnet"
questions: 4
lifecycle: "auth-redesign-20260226"
```

### Append Pattern

SKILL.md instruction: "APPEND to .arc/log.yml using `cat >>`. Do NOT read and rewrite the file."

```bash
cat >> .arc/log.yml << 'EOF'
---
event: "phase_transition"
timestamp: "2026-02-26T14:00:00Z"
from: "scope_in_progress"
to: "scope_complete"
lifecycle: "auth-redesign-20260226"
EOF
```

The `cat >>` pattern combined with the explicit "do NOT rewrite" instruction mitigates the realistic risk of an LLM reading and rewriting the entire file.

### Events to Log

| Event | When | Priority for v2 Calibration |
|-------|------|-----------------------------|
| phase_transition | Phase changes | HIGH |
| gate_evaluation | Gate runs (outcome, pass/fail counts) | HIGH |
| agent_complete | Subagent returns (type, batch, model, duration) | HIGH |
| source_failure | Source unavailable (type, failure classification) | MEDIUM |
| override | User overrides gate (severity, gaps acknowledged) | MEDIUM |
| lifecycle_start | /arc:scope begins | LOW |
| lifecycle_complete | All phases done | LOW |

### Size Management

- Each entry: ~100-200 bytes.
- Typical lifecycle: 20-50 events = 2-10 KB.
- Log persists across lifecycles. The `lifecycle` field enables filtering.
- Over 100 lifecycles: ~200KB-1MB. Manageable for v1.
- `/arc:status` warns at 50 KB.
- v1.1 consideration: add rotation by date or size threshold if needed.

### Gitignore (per D5)

```
.arc/log.yml
.arc/state.yml.bak
```

---

## Developer Journey

### First Invocation

A developer runs `/arc:scope` for the first time on a project:

1. No `.arc/` directory exists. The skill creates it, copies template files.
2. The developer answers 5-8 interactive questions about their project.
3. A structured question plan appears -- the developer sees exactly what will be researched and can modify it before any tokens are spent.
4. Sources are configured (usually just confirming defaults).
5. G1 passes (structural check). The developer sees "Scope complete. Run `/arc:research` to begin research."
6. Total time: 3-5 minutes of interactive conversation.

### First Complete Lifecycle

Scope (5 min) -> Research (5-15 min, mostly automated) -> Design (5-10 min, one revision) -> Plan (3-5 min, review and approve) -> Execute (varies by task count).

The developer's active involvement is concentrated in Scope (defining what to research) and Design (reviewing and revising). Research and Plan are largely automated with approval checkpoints. Execute is the main hands-on work phase.

Key experience beats:
- The "Terraform plan-apply" moment in Scope: seeing the research plan before committing tokens.
- The progress reports during Research: watching batches complete.
- The revision cycle in Design: requesting changes and seeing them incorporated.
- The micro-interaction in Execute: natural pause points with "yes / pause / review".

### Returning User (After /clear)

1. SessionStart hook (if working) shows: "Arc lifecycle active: auth-redesign. Phase: research_complete. Run /arc:design."
2. If hook fails: developer types "arc status" or runs `/arc:status` for full context.
3. Any `/arc:*` skill reads state.yml via dynamic context injection -- the developer can jump directly to the next skill.

### Cross-Lifecycle (Product-to-Engineering Handoff)

1. Product manager completes a product lifecycle. DESIGN.md and HANDOFF.md exist.
2. PM shares HANDOFF.md with engineering (manually, per user clarification).
3. Engineer starts `/arc:scope`. The skill detects HANDOFF.md and offers to import.
4. Key Decisions become locked constraints. Suggested Engineering Questions seed the question plan.
5. The engineering lifecycle proceeds with the product decisions as guardrails.

---

## Backlog

Items discussed in research but deliberately deferred from v1:

| Item | Why Deferred | When to Reconsider |
|------|-------------|-------------------|
| Extended thinking for gate evaluation | No evidence ET improves rubric-based evaluation. Whole-skill side effect wastes tokens. | If gate evaluations prove unreliable in practice. One-line change to test. |
| Configurable model profiles (GSD-style) | Hardcoded frontmatter is simpler, proven. No user demand signal. | If users request different model configurations. Clean v1.1 addition. |
| Self-improvement from log.yml data | Passive collection only for v1. Calibration requires enough data to be meaningful. | After 10+ lifecycles produce calibration data. |
| Dedicated verifier agent for execute phase | "Lightweight check" is sufficient for v1. GSD's verifier is expensive. | If acceptance criteria verification proves unreliable. |
| Per-wave micro-interaction option | Per-task is the default. May be too chatty for large plans. | After developer feedback on interaction frequency. |
| Research SKILL.md decomposition | Full 10+ step flow in one SKILL.md. No reference validates this complexity. | If Claude cannot reliably follow the orchestration. Split into sub-invocations. |
| Numeric sufficiency scoring upgrade | Categorical model is v1 default (proven). Numeric scoring (0.0-1.0 per dimension) could add granularity if categorical proves too coarse. | After 10+ lifecycles if categorical ratings feel insufficiently discriminating. |
| HANDOFF.md format refinement | Novel format, no reference precedent. | After 2-3 product lifecycles produce HANDOFF.md artifacts. User feedback. |
| Multi-agent design synthesis | C-8 specifies single design agent for v1. | If single-session design proves insufficient for complex projects. |
| 60-second progress updates during research | Platform limitation. Task tool has no progress mechanism. | If Claude Code adds Task progress callbacks. |
| Source availability API | No programmatic check exists. Optimistic invocation only. | If Claude Code adds MCP availability query. |

---

## Success Metrics

| # | Metric | Target | What It Measures | When to Check |
|---|--------|--------|-----------------|---------------|
| 1 | Lifecycle completion rate | > 60% of started lifecycles reach `complete` | Whether developers finish what they start | After 10 lifecycles |
| 2 | G2 first-pass rate | 50-70% pass on first attempt | Whether the "majority COVERED" threshold is calibrated correctly. Too high = too lenient. Too low = too strict. | After 5 lifecycles |
| 3 | Average recycles per lifecycle | < 2 total across all gates | Whether gates are blocking without adding value | After 10 lifecycles |
| 4 | Override rate | < 20% of gate evaluations | Whether gates are too strict (high override = miscalibrated) | After 10 lifecycles |
| 5 | Research phase duration | < 15 minutes for 10-15 questions | Whether subagent orchestration is performant | Every lifecycle |
| 6 | SessionStart hook success rate | > 80% of sessions | Whether the hook works despite known bugs | After 20 sessions |
| 7 | Design revision rounds used | Average < 1 (most designs accepted first try) | Whether research quality supports good first-draft design | After 5 lifecycles |
| 8 | Sufficiency rating consistency | Same evidence rated consistently across sessions | Whether the categorical model produces stable ratings | First 3 lifecycles |
| 9 | Dynamic question discovery acceptance | > 30% of proposed questions accepted | Whether subagents propose useful questions | After 5 lifecycles with discovery |
| 10 | Context reconstruction success | Developer can resume after /clear within 1 command | Whether the 3-layer fallback (hook + dynamic injection + /arc:status) works | Every /clear event |
| 11 | SKILL.md orchestration reliability | Research phase completes without manual intervention > 80% | Whether the 10+ step research SKILL.md is followable | First 5 lifecycles |
| 12 | Cross-lifecycle import usage | > 50% of eligible lifecycles import prior artifacts | Whether the connected flow feature is useful | After 3 cross-lifecycle pairs |

---

## What Is NOT Included

To prevent scope creep, the following are explicitly out of scope for this design:

- **Multi-agent design synthesis.** v1 uses a single design agent (the main session). Multi-agent design with lens-based variation is deferred.
- **Automatic model selection.** v1 hardcodes model tiers. No runtime model switching based on task complexity.
- **Team collaboration features.** Arc is a single-developer tool. No shared state, no concurrent lifecycle editing.
- **Bundled MCP servers.** Arc ships reference configs, not servers. Users configure their own MCP servers.
- **Visual UI or dashboard.** Arc is CLI-only. `/arc:status` is the status display.
- **Automatic source discovery.** Sources are configured in sources.yml. No runtime scanning for available MCP servers.
- **Code implementation patterns.** The execute phase delegates implementation to standard Claude Code behavior. Arc does not prescribe coding patterns.
- **Custom gate criteria.** Gate criteria are defined in the design, not configurable by the developer.

---

## Evidence Strength Map

This table maps every significant design decision to its evidence quality, helping the implementation team prioritize testing.

| Decision | Evidence Rating | Primary Source | Needs Testing? |
|----------|----------------|---------------|----------------|
| Plugin directory layout | STRONG | Research-engine + official docs | No |
| SKILL.md orchestrator pattern | STRONG | Research-engine | No |
| SessionStart hook mechanism | MODERATE | Plugin architecture research | YES -- 3 open bugs |
| Dynamic context injection (`!cat`) | STRONG | Plugin architecture research | No |
| state.yml flat YAML format | STRONG | State management patterns research | No |
| Complete-file rewrite + backup | STRONG | State management patterns | No |
| Inline gate evaluation (D1) | MODERATE | App analysis + user decision | No |
| MUST/SHOULD criteria split | MODERATE | Product design C-3 | No |
| Go/Hold/Recycle + Go (advisory) | STRONG | Product design C-3 + R2 refinement | No |
| Override for all failures | MODERATE | Product design escalation flow | No |
| Task() API pattern | STRONG | Three converging sources | No |
| File-based subagent output | STRONG | Research-engine | No |
| 3 per-source researcher templates | STRONG | Research-engine | No |
| Condensed returns via prompt | STRONG | All sources agree | No |
| Model tier: sonnet/opus split | STRONG | Research-engine + app analysis | No |
| Hardcoded frontmatter (D3) | STRONG | Research-engine pattern | No |
| No extended thinking (D4) | MODERATE | Conservative default | YES -- compare quality |
| Design/plan in main session | STRONG | C-7 + validator consensus | No |
| Source-affinity batching | MODERATE | App analysis + adapted fan-out | YES -- batch quality |
| Categorical sufficiency model (COVERED/PARTIAL/NOT COVERED) | STRONG | Research-engine proven pattern | No |
| Dynamic question discovery | MODERATE | Supplement synthesis | YES -- extraction reliability |
| Gap-fill re-batching | MODERATE | Research-engine adapted | No |
| 8-section prompt template | STRONG | Convergent evidence | No |
| Lens injection for intent | STRONG | Research-engine demonstrates | No |
| Intent-specific content per phase | WEAK | Supplement synthesis | YES -- iteration expected |
| PRD vs RFC format by intent | MODERATE | Industry standard | No |
| HANDOFF.md sections 1-8 | MODERATE | HashiCorp PRD-to-RFC | YES -- format validation |
| HANDOFF.md section 9 | WEAK | Design addition | YES -- is it useful? |
| Cross-lifecycle import | WEAK | Novel feature | YES -- UX and utility |
| Design revision cycle (max 2) | MODERATE | R2 proposal, good DX | No |
| Wave-based execution | STRONG | GSD proven pattern | No |
| Micro-interaction via freeform | MODERATE | Avoids timeout | No |
| Single checkpoint.yml | MODERATE | GSD adapted | YES -- resume reliability |
| Lightweight acceptance check | WEAK | Undefined specification | YES -- verify quality |
| log.yml multi-document YAML + `cat >>` | STRONG | State management + R2 | No |
| log.yml persists across lifecycles | MODERATE | R2, v2 calibration value | No |

Items marked WEAK or "YES -- needs testing" should be prioritized during implementation validation. The highest-priority testing items are **research SKILL.md orchestration reliability** (11-step flow has no reference precedent at that complexity) and **HANDOFF.md format utility** (novel format, needs real-world validation).
