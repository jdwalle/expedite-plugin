# Design Resolution 2: Agent Harness Architecture (Sustainability & Maintainability Lens)

## Design Summary

The expedite agent harness architecture is a three-layer system — Enforcement, Orchestration, Execution — that replaces prompt-enforced behavioral rules with deterministic code enforcement where possible and cost-controlled LLM evaluation where necessary. The sustainability lens drove three overarching tradeoffs: (1) prefer command hooks over agent hooks at every opportunity, because a 100ms shell script that never hallucinates will always be cheaper and more reliable than a 30-second LLM call that might rubber-stamp; (2) prefer file-per-concern state over any event-sourced or checkpoint-snapshot system, because the simplest state design that solves the token waste and resume problems is the one with the lowest maintenance burden; (3) prefer incremental migration over architectural leaps, because each hardening step must deliver standalone value and be independently reversible. The result is an architecture with the fewest moving parts that still achieves deterministic gate enforcement, reliable resume, scoped context injection, and execute-phase isolation.

---

## User Decisions Applied

| # | Decision | How It Shaped the Design |
|---|----------|--------------------------|
| 1 | **Three-layer separation** (Enforcement + Orchestration + Execution) | The entire architecture is organized around these three layers, with explicit boundaries and information flow contracts between them. Skills shrink to ~100-200 line dispatchers, agents grow to carry full frontmatter, and enforcement moves entirely into hooks and scripts. |
| 2 | **Dual-layer rubric + reasoning for semantic gates** | G3 and G5 use a two-pass evaluation: structural rubric (code-enforced, deterministic) followed by reasoning soundness check (separate verifier agent). Multi-agent debate was excluded as overkill for a personal tool. |
| 3 | **Incremental hardening migration** | The migration sequence is ordered so each phase delivers standalone value. No phase depends on a future phase to be useful. Each phase can be validated before the next begins. |
| 4 | **Worktree isolation for execute-only** | Only execute-skill agents get `isolation: "worktree"`. All other skills write to `.expedite/` directories only, where conflict risk is negligible. |

**Constraints carried forward:**
- C1: All mechanisms must work within Claude Code's plugin API surface
- C2: Full rebuild acceptable, but incremental preferred (per Decision 3)
- C3: Personal/team tool — configuration complexity is acceptable
- C4: SessionStart hook deferred; design includes fallback
- C5: The lifecycle pipeline (scope -> research -> design -> plan -> spike -> execute) is fixed

---

## Agent-Resolved Contested Areas

### CA-1: How Many Hooks Are Actually Needed?

**Question**: The research documents 16 hook event types. How many should expedite register?

**Resolution**: Start with 3 hook events, expand to 5 maximum.

**Minimal viable set (Phase 1):**
1. `PreToolUse` (matcher: `Write`) — state transition guard and schema validation
2. `Stop` — checkpoint persistence after skill completion
3. `PreCompact` — save critical state before context compaction

**Extended set (Phase 2, only if justified by observed failures):**
4. `SubagentStop` — gate evaluation trigger after agent completion
5. `PostToolUse` (matcher: `Write`) — audit trail for state changes

**Reasoning**: Every hook is maintenance surface area. Each hook script must be written, tested, and kept compatible with Claude Code API updates. The research shows ECC uses hooks at "all 4 lifecycle phases" but ECC is a general-purpose harness serving all projects — expedite is a single-purpose pipeline with a fixed workflow. Three hooks cover the critical enforcement points: preventing invalid state writes (PreToolUse), recording progress for resume (Stop), and protecting state during compaction (PreCompact). The cost of maintaining 3 hook scripts is low. The cost of maintaining 10+ is not proportional to the benefit.

**Evidence**: claude-code-harness uses only 3 hook events (SessionStart, PostToolUse, Stop) and achieves comprehensive enforcement through those three plus its TypeScript engine. This demonstrates that a small hook surface with a capable enforcement engine behind it is sufficient.

### CA-2: State Format — YAML vs JSON for Split State Files

**Question**: The research shows LLMs handle YAML and JSON comparably. Which format for the split state files?

**Resolution**: Keep YAML for all state files.

**Reasoning**: Expedite already uses YAML throughout (state.yml, SCOPE.md frontmatter). Switching to JSON adds a format transition cost with no demonstrated benefit. The research finding is that "the differentiator is injection strategy, not format." YAML is marginally more human-readable for manual debugging (a real activity for a personal tool). The hook scripts will use a YAML parser (js-yaml for Node.js) — one dependency, one parser, one format. Introducing JSON would mean either mixing formats (confusion) or migrating all existing YAML (pointless churn).

**Evidence**: Research synthesis explicitly states "LLMs handle YAML and JSON comparably." No source found any reliability difference. The only advantage JSON has — native parsing in JavaScript — is offset by YAML's advantage in human readability and consistency with the existing codebase.

### CA-3: Hook Implementation Language

**Question**: Hook scripts can be shell scripts, Node.js, or any executable. Which language?

**Resolution**: Node.js (JavaScript) for all hook scripts.

**Reasoning**: Shell scripts are fastest (~100ms) but fragile across platforms and hard to test. TypeScript (like claude-code-harness) requires a build step that adds maintenance burden — every change requires compilation. Node.js scripts execute directly, work cross-platform, can parse YAML/JSON natively with a single dependency (js-yaml), are testable with standard frameworks (Jest/Vitest), and run fast enough (Node.js startup is ~50-100ms, total hook execution ~100-200ms). The sustainability lens strongly favors "runs without a build step" over "maximum type safety."

**Evidence**: ECC uses Node.js hook scripts for cross-platform reliability. claude-code-harness uses TypeScript but requires compilation. For a personal tool where the maintainer is also the user, the build step is pure overhead.

### CA-4: Checkpoint Granularity

**Question**: LangGraph checkpoints at every graph node. Should expedite checkpoint at every step, or at coarser granularity?

**Resolution**: Checkpoint at step boundaries only (not sub-step), using a single `checkpoint.yml` per skill invocation.

**Reasoning**: LangGraph's per-node checkpointing makes sense for a general-purpose framework where the execution graph is dynamic. Expedite's skills have fixed, numbered steps (scope has 9, design has 10). Checkpointing at step boundaries is sufficient for deterministic resume — the research confirms "step-level is sufficient granularity" and LangGraph's per-node maps to per-step. Sub-step checkpointing (e.g., within a convergence loop) adds file I/O overhead and checkpoint management complexity without proportional resume improvement. If a crash occurs mid-step, re-running that step from the beginning is acceptable — steps are designed to be independently executable.

**Evidence**: LangGraph documents per-node checkpointing as sufficient. Expedite's existing execute-skill checkpoint.yml works at task-level granularity (equivalent to per-step) and is described as "the most sophisticated resume mechanism in expedite's codebase." Generalizing this proven pattern is lower-risk than inventing a new one.

### CA-5: Agent Memory — Enable or Defer?

**Question**: Claude Code supports per-agent persistent memory. Should expedite agents use it?

**Resolution**: Defer. Do not enable agent persistent memory in the initial harness design.

**Reasoning**: Agent persistent memory (MEMORY.md per agent) is a powerful feature, but it introduces a new state surface that must be maintained, debugged, and kept consistent with the checkpoint system. For expedite's pipeline architecture, each agent invocation is stateless by design — the agent receives its context from the skill's prompt assembly and writes results to artifacts. Adding persistent memory would create a second source of truth that could diverge from the checkpoint/state files. The sustainability lens says: do not add state surfaces unless you have a demonstrated need. If research agents later demonstrate a pattern of "rediscovering the same codebase patterns" across lifecycles, persistent memory becomes justified — but that need has not been observed.

**Evidence**: No source demonstrates that agent persistent memory improves reliability for pipeline-style architectures. The wshobson/agents repo uses it for 112 agents with diverse cross-project roles — a fundamentally different use case than expedite's project-scoped lifecycle agents.

### CA-6: SessionStart Hook — Use or Skip?

**Question**: Three platform bugs historically blocked SessionStart. Should the design include it?

**Resolution**: Exclude SessionStart from the initial design. Use the Stop hook for session handoff and frontmatter for context loading.

**Reasoning**: SessionStart is the natural point for context loading, but three unverified bugs make it unreliable. ECC's "root fallback" pattern is a workaround, not a solution — it adds complexity specifically to handle a platform limitation. Frontmatter `!cat` injection already loads state at skill invocation time, and the Stop hook can write session summaries for the next session. These two mechanisms together cover the SessionStart use case without depending on a potentially buggy hook event. If/when SessionStart bugs are confirmed fixed, adding it is a simple, low-risk enhancement.

**Evidence**: Research explicitly flags SessionStart bug status as a knowledge gap. ECC's root fallback pattern exists specifically because SessionStart is unreliable. The sustainability lens says: do not build on unreliable foundations.

---

## Three-Layer Architecture

### Layer 1: Enforcement (hooks + scripts)

**Responsibility**: Prevent invalid state transitions, enforce gate passage, validate schema, maintain audit trail. This layer answers: "Is this action allowed right now?"

**What lives here**:
- `hooks/hooks.json` — hook event registrations (3-5 hooks)
- `hooks/validate-state-write.js` — PreToolUse handler for Write interception
- `hooks/persist-checkpoint.js` — Stop handler for checkpoint writes
- `hooks/pre-compact-save.js` — PreCompact handler for state preservation
- `hooks/lib/state-schema.js` — YAML schema definitions and validators
- `hooks/lib/fsm.js` — finite state machine transition rules

**Information flow**: Hooks receive tool input via stdin JSON, read state files from `.expedite/` for context, and return allow/deny decisions via exit codes. Hooks never modify state directly — they only gate whether state modification is permitted.

**Maintenance burden**: Low. The FSM transitions are a simple lookup table (current_phase + target_phase -> allowed?). Schema validators are declarative. The hooks themselves are thin dispatchers to the lib functions. When a new skill is added, only the FSM transition table needs updating. When a gate criterion changes, only the schema validator needs updating. No build step required.

**Token cost**: Zero. Command hooks execute outside the LLM context. They consume no tokens. This is the strongest argument for code-enforced gates — every check moved from prompt to hook saves tokens on every invocation.

### Layer 2: Orchestration (thin skills)

**Responsibility**: User-facing workflow coordination. Sequence steps, dispatch agents, assemble context, handle user interaction. This layer answers: "What should happen next?"

**What lives here**:
- `skills/{name}/SKILL.md` — step sequencer (~100-200 lines each, down from 500-860)
- Frontmatter with scoped state injection (only load relevant state files)
- Step definitions: what to do, which agent to dispatch, what context to pass
- User interaction points (questions, confirmations, overrides)
- Recovery preamble reading checkpoint state for resume

**Information flow**: Skills read state files via frontmatter injection (scoped). Skills dispatch agents via the Agent tool. Skills write state transitions (which the enforcement layer validates). Skills read agent results from artifacts.

**Maintenance burden**: Low. Skills become declarative step sequences. The logic that currently lives in skills (validation, gate evaluation, state management) moves to the enforcement layer and agents. Adding a step means adding a step entry and possibly an agent definition. The 500-line soft cap becomes naturally achievable.

**Token cost**: Moderate. Skills are loaded into context when invoked. At 100-200 lines, each skill costs ~1,000-2,000 tokens. Scoped state injection reduces the state injection cost from "everything" to "only what this skill needs" — estimated 50-70% reduction in state tokens.

### Layer 3: Execution (thick agents)

**Responsibility**: Perform specialized work. Research, synthesize, evaluate, generate artifacts. This layer answers: "How should this specific task be done?"

**What lives here**:
- `agents/{name}.md` — formal agent definitions with full frontmatter
- Agent body contains the detailed instructions, rubrics, and output format specifications that currently live in `skills/{name}/references/prompt-*.md`
- Agent frontmatter specifies model tier, tool restrictions, and hooks

**Information flow**: Agents receive context from the orchestrating skill's dispatch prompt (assembled from state files and prior artifacts). Agents write results to artifact files. Agents return a summary to the orchestrating skill. Agents have no direct access to state files for writing — they produce artifacts, and the skill updates state.

**Maintenance burden**: Moderate. Agents are the largest files in the system (replacing the current prompt templates). However, each agent is self-contained and independently modifiable. Changes to one agent cannot break another. The formal frontmatter schema provides structure. The main maintenance cost is keeping agent instructions aligned with gate criteria — when gate criteria change, agent output instructions must also change.

**Token cost**: Variable by model tier. Haiku agents (~exploration) cost ~10x less per token than Opus agents (~synthesis, verification). The model tiering strategy ensures expensive models are used only where judgment quality matters.

### Inter-Layer Information Flow

```
User
  |
  v
[Orchestration: SKILL.md]
  |-- reads --> .expedite/state.yml, .expedite/checkpoint.yml (via frontmatter)
  |-- dispatches --> [Execution: agent.md] --> writes artifacts
  |-- writes state --> [Enforcement: hooks] --> allow/deny
  |
  v
Artifacts on disk
```

**Critical constraint**: Information flows downward (orchestration dispatches execution) and is gated at write time (enforcement validates orchestration's state writes). Agents never write state directly. Hooks never dispatch agents. This unidirectional flow is the key maintenance property — debugging means "follow the write."

---

## Hook Architecture

### Hook Event Set

| Hook Event | Handler | Script | Fires When | Purpose |
|------------|---------|--------|------------|---------|
| `PreToolUse` | command | `validate-state-write.js` | Any Write to `.expedite/` files | State transition guard, schema validation |
| `Stop` | command | `persist-checkpoint.js` | Skill/session ends | Write checkpoint for resume |
| `PreCompact` | command | `pre-compact-save.js` | Before context compaction | Preserve critical state |

**Matcher configuration for PreToolUse**:
```json
{
  "hooks": {
    "PreToolUse": [{
      "matcher": "Write",
      "hooks": [{
        "type": "command",
        "command": "node hooks/validate-state-write.js"
      }]
    }]
  }
}
```

The Write matcher intercepts ALL Write tool calls. The script itself inspects `tool_input.file_path` and only performs validation when the target is an `.expedite/` state file. Non-state writes pass through immediately (exit code 0). This is simpler than attempting regex-based path matching in the matcher, which is designed for tool names, not file paths.

### What Each Hook Enforces

**PreToolUse (validate-state-write.js)**:
1. Parse stdin JSON for `tool_input.file_path` and `tool_input.content`
2. If path is not an `.expedite/*.yml` state file, exit 0 (allow)
3. If path is `state.yml`:
   - Parse proposed YAML content
   - Validate schema (required fields, valid values)
   - Check phase transition against FSM (is current -> proposed a valid transition?)
   - If transitioning to a `_complete` phase, verify gate passage exists in `gates.yml`
   - Exit 0 (allow) or exit 2 (deny with `permissionDecisionReason`)
4. If path is `checkpoint.yml`, `questions.yml`, `tasks.yml`, or `gates.yml`:
   - Validate schema for that specific file type
   - Exit 0 or exit 2

**Stop (persist-checkpoint.js)**:
1. Read current `.expedite/state.yml` to determine active skill and phase
2. Read current `.expedite/checkpoint.yml` if it exists
3. Write/update checkpoint with: `{skill, step, label, timestamp, artifacts_present}`
4. This ensures a checkpoint always exists after any skill completes or a session ends

**PreCompact (pre-compact-save.js)**:
1. Read `.expedite/checkpoint.yml` and `.expedite/state.yml`
2. Write a compact summary to `.expedite/compact-context.md` containing:
   - Current phase and step
   - What was accomplished (from checkpoint)
   - What should happen next (from step + state)
3. This file is referenced by skill frontmatter for post-compaction resume

### Latency Budget

| Hook | Expected Latency | Acceptable? |
|------|-----------------|-------------|
| PreToolUse (state write) | 100-200ms (Node.js YAML parse + validate) | Yes — Write calls are infrequent (a few per skill run) |
| Stop | 100-200ms | Yes — fires once at session/skill end |
| PreCompact | 100-200ms | Yes — fires rarely (auto-compaction or manual) |

All hooks are command type, meaning no LLM calls, no network calls, no build step. Total latency overhead per skill invocation: ~300-600ms across all hook firings. This is imperceptible relative to the minutes-to-hours of a skill's execution.

### Failure Modes and Graceful Degradation

| Failure | Impact | Mitigation |
|---------|--------|------------|
| Hook script crashes (exit 1) | Non-blocking — logged, execution continues | Log error to `.expedite/hook-errors.log`. Script should catch exceptions and exit 1, not crash silently. |
| Hook blocks valid write (false positive) | Blocks skill progress | `permissionDecisionReason` explains why. User can check the reason, fix the issue, or — as a last resort — temporarily disable the hook via plugin settings. |
| Hook allows invalid write (false negative) | State corruption | Mitigated by schema validation being strict by default. FSM transitions are exhaustively enumerated, so false negatives only occur if the FSM table itself is wrong. |
| Hook script missing/not found | Non-blocking error | Claude Code logs the error. Skill continues without enforcement. This is the fallback for development/debugging. |

### Long-Term Maintenance

Hook scripts are the most maintenance-sensitive component because they interact with Claude Code's undocumented stdin JSON format. Mitigations:

1. **Minimal parsing**: Extract only the fields needed (`tool_input.file_path`, `tool_input.content`). Do not depend on the full stdin schema.
2. **Version pinning**: Document the Claude Code version each hook was tested against. If the stdin format changes, the hook script fails loudly (schema validation error on input), not silently (incorrect behavior).
3. **Test suite**: Each hook script should have unit tests with sample stdin JSON. Tests run outside Claude Code, making them fast and reliable.
4. **Single dependency**: Only `js-yaml` for YAML parsing. No framework, no build toolchain.

---

## State Management Architecture

### File-Per-Concern Structure

| File | Contents | Size Estimate | Injected By |
|------|----------|---------------|-------------|
| `.expedite/state.yml` | Core identity: lifecycle_id, project_name, current_phase, current_skill, started_at | ~15 lines | All skills (frontmatter) |
| `.expedite/checkpoint.yml` | Resume data: skill, step, label, timestamp, artifacts_present, continuation_notes | ~20 lines | Resume preamble in all skills |
| `.expedite/questions.yml` | Research questions: list of {id, text, category, status} | Variable (20-80 lines) | Scope, research skills only |
| `.expedite/gates.yml` | Gate history: list of {gate, timestamp, outcome, details} | Variable (20-50 lines) | Gate evaluation hooks, status skill |
| `.expedite/tasks.yml` | Execute tasks: list of {id, title, status, phase, assigned_agent} | Variable (20-100 lines) | Plan, spike, execute skills only |
| `.expedite/log.yml` | Append-only telemetry (existing) | Growing | Status skill (read-only) |

### Write Patterns

**state.yml**: Complete-file rewrite (the current pattern), but now validated by the PreToolUse hook before every write. The hook validates schema and FSM transitions. The file is small (~15 lines) so complete rewrite is efficient and atomic.

**checkpoint.yml**: Complete-file rewrite at step boundaries. Written by the Stop hook and by skills at explicit checkpoint points. Small file, infrequent writes.

**questions.yml, gates.yml, tasks.yml**: Complete-file rewrite by the owning skill. Each file is owned by a small number of skills, reducing conflict risk. The PreToolUse hook validates schema on write.

**log.yml**: Append-only (existing pattern). Not validated by hooks — it is an audit trail, not control state.

### Validation

Each file type has a schema definition in `hooks/lib/state-schema.js`:

- **state.yml schema**: required fields (lifecycle_id, current_phase), valid phase values (enum), valid phase transitions (FSM adjacency matrix)
- **checkpoint.yml schema**: required fields (skill, step, timestamp), step must be a positive integer or the string "complete", skill must be a known skill name
- **questions.yml schema**: each entry must have id, text, status (enum: open, answered, deferred)
- **gates.yml schema**: each entry must have gate (enum: G1-G5), timestamp, outcome (enum: go, no-go, go-with-advisory, overridden)
- **tasks.yml schema**: each entry must have id, title, status (enum: pending, in_progress, complete, blocked)

Schemas are simple validation functions, not JSON Schema or Pydantic. Why: JSON Schema requires a validator library dependency. Pydantic requires Python. Simple `function validate(parsed) -> {valid, errors}` is the smallest surface area. Each schema is 20-40 lines of JavaScript.

### State Consumption Patterns

| Skill | Reads | Writes |
|-------|-------|--------|
| scope | state.yml, checkpoint.yml | state.yml, questions.yml, checkpoint.yml |
| research | state.yml, questions.yml, checkpoint.yml | state.yml, questions.yml, checkpoint.yml |
| design | state.yml, questions.yml, checkpoint.yml | state.yml, checkpoint.yml |
| plan | state.yml, checkpoint.yml | state.yml, tasks.yml, checkpoint.yml |
| spike | state.yml, tasks.yml, checkpoint.yml | state.yml, tasks.yml, checkpoint.yml |
| execute | state.yml, tasks.yml, checkpoint.yml | state.yml, tasks.yml, checkpoint.yml |
| status | state.yml, gates.yml, checkpoint.yml, log.yml | (read-only) |

Each skill's frontmatter injects only the files in its "Reads" column. This is the scoped injection pattern that eliminates token waste.

### Schema Evolution Strategy

Adding a new field to a state file:
1. Add the field to the schema in `state-schema.js` with a default value
2. Make the field optional in validation (backward compatible)
3. Skills that produce the field start writing it
4. Skills that consume the field start reading it
5. After all skills are updated, optionally make the field required

Adding a new state file:
1. Create the schema definition
2. Add the file path to the PreToolUse hook's known-state-files list
3. Add frontmatter injection to consuming skills
4. Deploy

Neither operation requires changing existing state files or migrating data. This is the key evolution property of file-per-concern: new concerns get new files.

### Token Cost of State Injection

| State Config | Estimated Tokens per Skill Invocation |
|--------------|---------------------------------------|
| Current (full state.yml, growing) | 500-2,000+ tokens (grows with lifecycle) |
| Proposed (scoped injection) | 100-400 tokens (fixed per skill, does not grow) |

**Savings**: 60-80% reduction in state injection tokens. Over a full lifecycle (6+ skill invocations, many with multiple steps), this compounds to thousands of saved tokens.

### State Debugging

State is plain YAML files in `.expedite/`. Debugging is:
1. Read the file directly (`cat .expedite/state.yml`)
2. Check the checkpoint (`cat .expedite/checkpoint.yml`)
3. Validate manually (`node hooks/validate-state-write.js < test-input.json`)
4. Check hook errors (`cat .expedite/hook-errors.log`)

No database to query, no event log to replay, no checkpoint store to inspect. This is the strongest sustainability argument for file-per-concern over more sophisticated patterns.

---

## Agent Formalization

### Agent Definition Format

Each agent becomes a standalone `.md` file in the plugin's `agents/` directory with full Claude Code subagent frontmatter:

```yaml
---
name: web-researcher
description: "Researches a specific question using web search. Produces structured evidence in YAML format."
model: sonnet
tools:
  - WebSearch
  - WebFetch
  - Read
  - Write
  - Glob
disallowedTools:
  - Bash
  - Edit
maxTurns: 30
---

[Agent instructions, rubrics, output format — content currently in prompt-web-researcher.md]
```

### Minimal Viable Agent Schema

**Required fields** (every agent must have):
- `name`: unique identifier, lowercase-hyphenated
- `description`: when to delegate to this agent (used for dispatch clarity, not auto-delegation)
- `model`: explicit model tier assignment

**Recommended fields** (include when the default is wrong):
- `tools` or `disallowedTools`: tool restrictions for safety (e.g., research agents should not have Bash)
- `maxTurns`: prevent runaway agents

**Deferred fields** (do not use initially):
- `memory`: per-agent persistent memory (see CA-5 — deferred)
- `hooks`: per-agent hooks (redundant with plugin-level hooks initially)
- `isolation`: only for execute agents (`isolation: "worktree"`)
- `skills`: subagent skill loading (not needed for expedite's dispatch pattern)
- `mcpServers`: MCP server restrictions (not relevant currently)
- `background`: all agents currently run in foreground (blocking)

**Why minimal**: Every frontmatter field is a maintenance surface. If an agent has `tools: [Read, Write, Glob, Grep, WebSearch, WebFetch]` and Claude Code adds a new tool, the agent does not get it because the allowlist is explicit. The `disallowedTools` pattern (deny what is dangerous, inherit everything else) is more maintainable than explicit allowlists for agents that need many tools. Use `tools` (allowlist) only when an agent should be tightly restricted to a small set of tools. Use `disallowedTools` (denylist) when an agent should have broad access minus a few dangerous ones.

### Model Tiering

| Tier | Model | Cost Multiplier | Use Case | Agents |
|------|-------|-----------------|----------|--------|
| Fast | Haiku | 1x (baseline) | Read-only exploration, simple lookups | (none currently, future codebase-explorer) |
| Balanced | Sonnet | ~3x | Research, implementation, standard reviews | web-researcher, codebase-analyst, mcp-researcher, spike-researcher, task-verifier |
| Premium | Opus | ~15x | Synthesis, architecture decisions, semantic verification | research-synthesizer, sufficiency-evaluator, design-guide, plan-guide |

**When to use which tier**:
- **Haiku**: The agent needs to find information, not judge it. Read-only tools. Output is factual, not evaluative.
- **Sonnet**: The agent produces artifacts that will be reviewed by a gate or synthesizer. Quality matters but not at the "final judgment" level.
- **Opus**: The agent makes decisions that directly affect lifecycle outcomes. Synthesis, gate evaluation, architectural judgment.

**Cost optimization rule**: An agent should use Sonnet unless there is a specific reason it needs Opus. The default is the balanced tier. Upgrading to Opus requires justification (e.g., "this agent's output directly passes a quality gate").

### Agent Lifecycle

1. **Dispatch**: Skill invokes agent via the Agent tool, passing the agent name and a context-assembled prompt
2. **Execution**: Agent runs with its frontmatter-specified model, tools, and turn limit
3. **Completion**: Agent writes artifacts to disk, returns summary to the skill
4. **Cleanup**: No cleanup needed for non-worktree agents. For worktree agents (execute only), auto-cleanup handles no-change worktrees; changed worktrees return path and branch for merge.

**No inter-agent communication**: Agents do not see each other's work during execution. All coordination is through artifacts on disk, mediated by the orchestrating skill. This is simpler to maintain and debug than any message-passing system.

---

## Quality Gate Enforcement

### Gate Classification

| Gate | Type | What It Checks | Enforcement Mechanism |
|------|------|----------------|----------------------|
| G1 (Scope) | Structural | SCOPE.md exists, has required sections, 3+ questions | Code-enforced (PreToolUse hook or standalone script) |
| G2 (Research) | Structural | Research synthesis exists, all questions addressed, evidence quality ratings | Code-enforced |
| G3 (Design) | Semantic + Structural | Design covers all DAs, decisions are evidence-backed, reasoning is sound | Dual-layer: structural (code) + reasoning (verifier agent) |
| G4 (Plan) | Structural | Plan exists, phases cover all design decisions, tasks are uniform-sized | Code-enforced |
| G5 (Spike) | Semantic + Structural | Spike resolves all decisions, implementation steps are concrete, evidence supports approach | Dual-layer: structural (code) + reasoning (verifier agent) |

### Structural Gates (G1, G2, G4): Code-Enforced

Structural gate checks are implemented as JavaScript functions in `hooks/lib/gate-checks.js`. Each gate has a function that:

1. Reads the relevant artifact(s) from disk
2. Checks structural requirements (file exists, required sections present, counts meet thresholds)
3. Returns `{passed: boolean, checks: [{criterion, passed, detail}]}`

**When gate checks run**: At the moment the skill attempts to write a phase transition to state.yml, the PreToolUse hook calls the relevant gate check function. If the gate fails, the write is denied.

**Structural check examples for G1**:
- SCOPE.md exists at expected path
- SCOPE.md contains all required sections (Context, Constraints, Decision Areas, Success Criteria)
- At least 3 decision areas defined
- Each decision area has priority, depth, evidence requirements

**Structural check examples for G2**:
- Research synthesis file exists
- Each category file referenced in SCOPE.md exists
- Each decision area has an "Evidence Found" assessment
- No decision area has status "INSUFFICIENT"

**Structural check examples for G4**:
- Plan file exists
- Every design decision maps to at least one plan phase
- Each phase has defined steps
- Task count per phase is within bounds (not too few, not too many)

**Token cost per structural gate**: Zero. These are Node.js functions reading files from disk. No LLM calls.

### Semantic Gates (G3, G5): Dual-Layer Evaluation

**Layer 1 — Structural rubric (code-enforced)**:
Same pattern as structural gates. Check that the artifact has the required sections, that every decision area has a decision, that evidence references exist. This catches "did you check all the boxes?" failures.

**Layer 2 — Reasoning soundness (verifier agent)**:
A separate agent (the existing sufficiency-evaluator concept, evolved) reads the artifact and evaluates reasoning quality:
- Are conclusions supported by cited evidence?
- Are tradeoffs acknowledged?
- Are there logical gaps or unsupported assertions?

The verifier agent uses Opus model tier (premium) because reasoning evaluation is the highest-judgment task in the system. The verifier runs after the structural layer passes — no point evaluating reasoning on an artifact that is structurally incomplete.

**Cost analysis for semantic gates**:
- Layer 1 (structural): 0 tokens (code-enforced)
- Layer 2 (verifier agent): ~5,000-15,000 tokens per invocation (Opus reading artifact + evaluation prompt + structured output)
- Total per semantic gate: ~5,000-15,000 tokens
- Semantic gates fire twice per lifecycle (G3 after design, G5 after spike)
- Total semantic gate cost per lifecycle: ~10,000-30,000 tokens

This is modest relative to the total lifecycle token spend (typically 100,000+ tokens across all skills and agents).

### False Positive/Negative Handling

**Structural gate false positives** (blocks valid work): The gate criteria are wrong. Fix the criteria in `gate-checks.js`. This is a code change, testable, and immediately effective.

**Structural gate false negatives** (allows invalid work): The criteria are too lenient. Discovered during downstream work ("the plan has gaps because the design was incomplete"). Fix by adding stricter criteria.

**Semantic gate false positives**: The verifier agent rejects sound reasoning. The existing override mechanism applies: user produces `override-context.md` documenting why the override is justified. The override is recorded in `gates.yml` with `outcome: overridden`.

**Semantic gate false negatives** (rubber stamp): Mitigated by the dual-layer design — the structural layer catches omissions even if the reasoning layer is too lenient. Further mitigated by using a different model tier for verification (Opus verifier evaluating Sonnet-produced artifacts reduces self-preference bias).

### Gate Maintenance

Adding a new gate criterion:
1. Add the check to the relevant function in `gate-checks.js`
2. Add a test case
3. Deploy

Modifying gate criteria:
1. Change the function
2. Update tests
3. Deploy

No prompt engineering required for structural gates. For semantic gates, the verifier agent's evaluation prompt must be updated if the quality criteria change — this is the one prompt-sensitive part of the gate system.

---

## Resume & Recovery Architecture

### Checkpoint Mechanism

Each skill writes a checkpoint at step boundaries:

```yaml
# .expedite/checkpoint.yml
skill: research
step: 7
label: "Dispatch web researchers"
timestamp: 2026-03-11T10:30:00Z
substep: null
artifacts_present:
  - .expedite/research/SCOPE.md
  - .expedite/research/category-hooks.md
continuation_notes: "3 of 5 web researchers dispatched. 2 remaining: DA-4, DA-5."
```

### Checkpoint Lifecycle

1. **Skill start**: Read `checkpoint.yml`. If `skill` matches the current skill and `step > 0`, resume from that step.
2. **Step completion**: Write updated `checkpoint.yml` with new step number, label, and artifacts.
3. **Skill completion**: Write final checkpoint with `step: complete` and all artifacts listed.
4. **Stop hook**: If no explicit checkpoint was written during the session, the Stop hook writes one based on the best available information (current state.yml phase).

### Resume Determinism

The resume protocol is deterministic because it reads explicit state, not heuristics:

1. Read `checkpoint.yml` — know exactly which skill and step
2. Read `state.yml` — know the current phase
3. Cross-reference: if checkpoint says `research, step 7` but state says `research_complete`, the state wins (the skill finished after the checkpoint was written)
4. If checkpoint says `research, step 7` and state says `research_in_progress`, resume from step 7

**No artifact-existence heuristics**: The checkpoint explicitly says where the skill left off. The skill's resume preamble reads the checkpoint and jumps to the indicated step. This eliminates the three failure modes identified in the research: (1) partial artifacts confusing heuristics, (2) LLM interpreting state differently on resume, (3) mid-step crashes leaving ambiguous state.

### Recovery from Corrupted State

**Corrupted state.yml**: The PreToolUse hook prevents writing invalid state, so corruption should not occur during normal operation. If it occurs anyway (manual editing, disk error):
1. The hook rejects the next write attempt, explaining the schema violation
2. The user reads the error, manually fixes `state.yml`
3. Normal operation resumes

**Corrupted checkpoint.yml**: If the checkpoint file is unreadable or has invalid schema:
1. The skill falls back to artifact-existence checking (the current heuristic) as a degraded mode
2. The skill logs a warning: "Checkpoint corrupted, using artifact heuristic for resume"
3. This is explicitly a fallback, not the primary mechanism

**Missing state files**: If any `.expedite/` file is missing:
1. Skills that need it detect the absence via frontmatter injection (empty output)
2. The skill's recovery preamble handles the missing-file case (typically: "state not found, starting from beginning" or "run /expedite:status to diagnose")

### Maintenance Cost of Checkpoint System

The checkpoint system adds:
- One file (`checkpoint.yml`) to maintain and validate
- One schema definition (~20 lines of JavaScript)
- Step-boundary write calls in each skill (one line per step: "Write checkpoint")
- Stop hook logic (~30 lines of JavaScript)

Total maintenance surface: ~100 lines of code across all components. This is proportional to the value (deterministic resume across all 7 skills).

---

## Context & Memory Strategy

### Scoped Injection Design

Each skill's frontmatter loads only the state files it needs:

```yaml
---
!cat .expedite/state.yml 2>/dev/null || echo "No active lifecycle"
!cat .expedite/checkpoint.yml 2>/dev/null || echo "No checkpoint"
---
```

Research skill adds:
```yaml
!cat .expedite/questions.yml 2>/dev/null || echo "No questions"
```

Execute skill adds:
```yaml
!cat .expedite/tasks.yml 2>/dev/null || echo "No tasks"
```

Status skill adds:
```yaml
!cat .expedite/gates.yml 2>/dev/null || echo "No gate history"
```

### Token Budget Management

| Context Component | Estimated Tokens | Frequency |
|-------------------|-----------------|-----------|
| Skill body (SKILL.md) | 1,000-2,000 | Every invocation |
| State injection (scoped) | 100-400 | Every invocation |
| Agent instructions (on dispatch) | 2,000-5,000 | Per agent |
| Artifact reading (on-demand) | Variable | As needed |

**Total per-invocation context overhead**: ~1,100-2,400 tokens (down from ~1,500-4,000+ with monolithic state).

### What to Preserve vs. Regenerate

**Always preserve** (checkpoint, state files):
- Current phase and step
- Gate history (immutable record)
- Research questions and their status
- Task list and task status

**Regenerate on demand** (artifacts):
- Research synthesis (read from disk when needed)
- Design document (read from disk when needed)
- Plan document (read from disk when needed)
- Evidence files (read from disk when needed)

Artifacts are large (1,000-10,000+ tokens each). Loading them all into context is wasteful. Skills should instruct agents to read specific artifacts as needed, rather than injecting them via frontmatter.

### PreCompact Handling

The `pre-compact-save.js` hook fires before context compaction and writes `.expedite/compact-context.md`:

```markdown
# Compact Context Summary
- Phase: research_in_progress
- Skill: research, Step 7 of 10
- Last action: Dispatched 3 web researchers for DA-1, DA-2, DA-3
- Next action: Dispatch remaining 2 web researchers for DA-4, DA-5
- Critical state: questions.yml has 15 questions, 8 answered
```

This file is referenced in skill frontmatter:
```yaml
!cat .expedite/compact-context.md 2>/dev/null
```

After compaction, the LLM sees this summary and can orient itself without reading the full conversation history. This costs ~100 tokens and saves the LLM from guessing its context.

---

## Worktree Isolation

### When Worktrees Are Worth the Complexity

Worktrees are worth it only when agents modify source code in ways that could conflict with other concurrent work. In expedite's architecture, this is exactly one case: the execute skill's task-executing agents.

**Execute agents**: Write source code, modify existing files, run tests. These operations create real conflict risk if another agent is modifying the same files. Worktree isolation prevents this.

**All other agents**: Write to `.expedite/` directories (evidence files, research notes, plan documents). These are namespaced by lifecycle and have no conflict risk. Worktree isolation would add complexity without benefit.

### Agent Configuration

Execute agents include `isolation: "worktree"` in their frontmatter:

```yaml
---
name: task-executor
description: "Executes a single implementation task in an isolated worktree."
model: sonnet
isolation: worktree
maxTurns: 50
disallowedTools:
  - WebSearch
  - WebFetch
---
```

### Failure Handling

| Failure | Handling |
|---------|----------|
| Agent completes with no changes | Auto-cleanup (built-in Claude Code behavior) |
| Agent completes with changes | Worktree path and branch returned to skill. Skill instructs user to review and merge. |
| Agent crashes mid-worktree | Worktree persists. `WorktreeRemove` hook at session exit can log orphaned worktrees. Manual cleanup via `git worktree prune`. |
| Merge conflicts | Standard git merge/rebase. Not automated — user resolves. Conflict risk is mitigated by task design (each task targets specific files). |

### Cleanup Strategy

1. **Automatic**: No-change worktrees auto-cleanup (Claude Code built-in)
2. **Guided**: Changed worktrees return branch info; skill output tells the user how to merge
3. **Manual fallback**: `git worktree list` and `git worktree prune` for orphaned worktrees
4. **No automated merge**: Merging agent work back to main is a human decision. Automating this would add complexity and risk (merge conflicts, test failures) that is not justified for a personal tool.

---

## Skill-Agent Interaction

### Dispatch Pattern

Skills dispatch agents using the Agent tool, passing a context-assembled prompt:

```
1. Read state and checkpoint (frontmatter, already in context)
2. Read any additional artifacts needed for this agent's task
3. Assemble the dispatch prompt: task description + relevant context + output expectations
4. Invoke: Agent tool with agent name + assembled prompt
5. Receive: Agent summary + artifacts written to disk
6. Update: state and checkpoint to reflect completion
```

The skill is a dispatcher, not a doer. The skill's logic is: "which agent to call, with what context, and what to do with the result." The agent's logic is: "how to accomplish the task."

### Context Passing (Minimal Sufficient Context)

The dispatch prompt should include:
- **The specific task**: What the agent should accomplish (1-3 sentences)
- **Input artifact paths**: Where to read source material (paths, not content — the agent reads it)
- **Output artifact path**: Where to write results
- **Output format**: What the result should look like (section structure, YAML schema, etc.)
- **Scope boundaries**: What is in-scope and out-of-scope for this agent

The dispatch prompt should NOT include:
- Full state file contents (the agent does not need lifecycle state)
- Other agents' outputs (unless explicitly relevant)
- Skill step sequence (the agent does not need to know the overall workflow)
- Gate criteria (the agent produces work; the gate evaluates it separately)

**Why minimal context matters**: Every token in the dispatch prompt is billed at the agent's model tier rate. A Sonnet agent with a 5,000-token prompt costs ~5x what a 1,000-token prompt costs. More importantly, excessive context can confuse the agent — the research on context window utilization shows that LLMs perform better with focused prompts than with kitchen-sink context.

### Cost-Aware Dispatch

Before dispatching an agent, the skill should consider:
1. **Can this be done without an agent?** Simple file reads, YAML manipulation, and counting can be done by the skill itself (which is already running in the user's session).
2. **Does this need Opus?** Default to Sonnet. Only use Opus for synthesis, architecture, and gate evaluation.
3. **Can agents run in parallel?** If multiple independent research agents are needed, dispatch them as background tasks and collect results. This uses more tokens (parallel context windows) but reduces wall-clock time.

---

## Migration Sequence

### Priority Order (by maintenance-burden reduction)

| Phase | What | Standalone Value | Dependencies | Estimated Effort |
|-------|------|-----------------|--------------|-----------------|
| M1 | **State splitting** (state.yml -> state.yml + checkpoint.yml + questions.yml + gates.yml + tasks.yml) | Reduces token waste immediately. Enables scoped injection. | None | Small — file splitting + frontmatter updates |
| M2 | **PreToolUse hook for state validation** | Prevents invalid state transitions. Catches state drift immediately. | M1 (needs to know which files to validate) | Medium — hook script + schema definitions + FSM table |
| M3 | **Checkpoint-based resume** | Deterministic resume for all skills. Eliminates heuristic failure modes. | M1 (checkpoint.yml must exist) | Medium — checkpoint writes in each skill + resume preamble |
| M4 | **Agent formalization** (prompt-*.md -> agents/*.md with frontmatter) | Tool restrictions prevent agent misbehavior. Model tiering reduces cost. | None (can be done independently) | Medium — file restructuring + frontmatter authoring |
| M5 | **Skill thinning** (move logic from SKILL.md to agents) | Skills drop to ~100-200 lines. Maintainability improves. | M4 (agents must be formalized first) | Large — requires rewriting each skill |
| M6 | **Structural gate code-enforcement** (G1, G2, G4) | Eliminates rubber stamp for 3 of 5 gates. | M2 (hooks must exist) | Medium — gate check functions |
| M7 | **Semantic gate dual-layer** (G3, G5) | Eliminates rubber stamp for remaining 2 gates. | M6 (structural layer first) | Medium — verifier agent + integration |
| M8 | **Worktree isolation for execute** | Code modification safety. | M4 (execute agents must be formalized) | Small — frontmatter field |
| M9 | **PreCompact and Stop hooks** | Context preservation across compaction and sessions. | M1, M3 (state files and checkpoint must exist) | Small — two additional hook scripts |

### Cost-Benefit of Each Phase

| Phase | Maintenance Reduction | Token Savings | Risk Mitigation |
|-------|----------------------|---------------|-----------------|
| M1 | High (smaller files, scoped reads) | High (60-80% state token reduction) | Medium (reduces state corruption surface) |
| M2 | High (automated enforcement replaces manual vigilance) | Zero (hooks are free) | High (prevents state drift) |
| M3 | High (deterministic resume replaces fragile heuristics) | Low | High (eliminates resume failure modes) |
| M4 | Medium (formal agent definitions are self-documenting) | Medium (model tiering) | Medium (tool restrictions prevent misbehavior) |
| M5 | High (skills drop from 860 to 200 lines) | Low | Medium (thinner skills are easier to debug) |
| M6 | Medium (gate logic is code, not prompts) | Medium (code gates cost zero tokens) | High (eliminates rubber stamp for 60% of gates) |
| M7 | Low (adds a verifier agent to maintain) | Negative (verifier costs tokens) | High (eliminates rubber stamp for remaining gates) |
| M8 | Low (one frontmatter field) | Zero | Medium (prevents code conflicts) |
| M9 | Medium (automated context preservation) | Low | Medium (prevents context loss) |

### Recommended Start: M1 + M2 as a bundle

M1 (state splitting) and M2 (PreToolUse hook) are the highest-value, lowest-risk combination. M1 enables M2, and together they deliver: reduced token waste, enforced state validity, and the foundation for everything else. Both are independently valuable — M1 without M2 still reduces tokens; M2 without M1 still validates writes. But together, they create the state management foundation the entire harness rests on.

---

## Risks & Open Questions

### What Adds Complexity Without Proportional Value?

1. **Agent persistent memory**: Adds a second state surface (per-agent MEMORY.md) alongside the checkpoint system. The pipeline architecture does not need cross-invocation agent learning. Deferred (see CA-5).

2. **SessionStart hook**: Depends on unverified bug fixes. Frontmatter + Stop hook covers the use case. Adds a reliability-sensitive component on an unstable foundation. Excluded (see CA-6).

3. **Agent hooks for gate evaluation**: Using `type: "agent"` hooks for semantic gate evaluation would add 30-60 seconds of latency to every state write. The dual-layer design (structural code-check + explicit verifier agent dispatch) achieves the same result with controllable timing. Agent hooks are powerful but their latency makes them unsuitable as Write interceptors.

4. **TypeScript compilation for hook scripts**: Adds a build step that must run before hooks work. Node.js scripts run directly. The type safety benefit does not justify the maintenance cost for a solo developer.

### What Might Become a Maintenance Burden?

1. **Hook stdin JSON format**: Claude Code's hook input format is not formally versioned. If the JSON structure changes in a Claude Code update, hook scripts may break. Mitigation: minimal parsing (extract only needed fields), version documentation, loud failure on unexpected input.

2. **Schema definitions in JavaScript**: As expedite evolves, the schema definitions in `state-schema.js` must stay synchronized with what skills actually write. If a skill writes a new field that the schema does not expect, the hook blocks it. Mitigation: schema validation in "warn" mode during development (exit 1 instead of exit 2 for unknown fields), strict mode in production.

3. **Gate check functions**: As lifecycle requirements evolve, the structural gate criteria must be updated. If gate criteria drift from actual quality requirements, they create false positives (blocking valid work) or false negatives (allowing invalid work). Mitigation: gate criteria review as part of the lifecycle design process, not an afterthought.

4. **Skill-agent prompt alignment**: When agents are formalized with detailed instructions, changes to output format expectations require updating both the agent definition and the consuming skill's parsing logic. Mitigation: use stable, documented output formats (YAML with defined schemas) and change them infrequently.

### What Platform Changes Could Break This Design?

1. **Hook API changes**: If Claude Code changes hook event names, stdin format, or exit code semantics, all hook scripts need updating. Likelihood: Low (hooks are a stable API surface). Impact: High (enforcement layer stops working). Mitigation: version pinning documentation, minimal stdin parsing.

2. **Subagent frontmatter changes**: If the agent definition format changes (fields renamed, semantics altered), agent definitions need updating. Likelihood: Low (format is recent and documented). Impact: Medium (agents need updating). Mitigation: use only well-documented fields.

3. **Write tool behavior changes**: If the Write tool changes how it passes content to hooks (e.g., streaming instead of complete content), the PreToolUse hook's content parsing breaks. Likelihood: Very low. Impact: High. Mitigation: no good mitigation — this is a foundational dependency.

4. **Plugin hooks.json deprecation**: If Claude Code changes how plugins register hooks, the registration mechanism needs updating but the hook scripts themselves remain valid. Likelihood: Low. Impact: Low (registration is a single JSON file).

### What Should Be Deferred vs. Built Now?

**Build now (M1-M3)**:
- State splitting, PreToolUse hook, checkpoint-based resume
- These solve the three stated pain points (token waste, state drift, resume fragility)
- Each delivers standalone value
- Foundation for everything else

**Build soon (M4-M6)**:
- Agent formalization, skill thinning, structural gate enforcement
- High value but more effort
- Depends on M1-M3 foundation

**Build later (M7-M9)**:
- Semantic gate dual-layer, worktree isolation, additional hooks
- Important but not urgent
- Can be added incrementally without disrupting earlier phases

**Defer indefinitely**:
- Agent Teams (3-4x token cost, pipeline architecture does not need mesh communication)
- Continuous learning/instincts (expedite's skills are hand-crafted, not learned)
- Declarative flow syntax (expedite's pipeline is fixed, not ad-hoc)
- SessionStart hook (until platform bugs are confirmed fixed)
- Agent persistent memory (until cross-invocation learning need is demonstrated)
