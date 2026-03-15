# Agent Harness Architecture — Resolution 1 (Developer Experience Lens)

## Design Summary

The expedite agent harness is a three-layer architecture that separates enforcement (hooks and scripts), orchestration (thin skills), and execution (thick agents with full frontmatter) to transform the plugin from a prompt-driven system into a code-enforced one. The DX lens drove three defining tradeoffs: (1) structural gates are fully deterministic rather than LLM-evaluated, giving the developer certainty that "pass" means the artifact objectively meets criteria; (2) resume is checkpoint-driven rather than heuristic, so the developer never wonders "did it pick up where it left off or start something new?"; and (3) hooks provide explanatory denial messages rather than silent blocking, so when the harness intervenes the developer understands why and what to do next. The architecture preserves expedite's existing lifecycle pipeline while hardening every seam where prompt-enforcement currently fails — state transitions, gate evaluation, resume logic, and agent boundaries.

---

## User Decisions Applied

### Decision 1: Three-Layer Separation (Enforcement + Orchestration + Execution)
Applied as the foundational architecture. Skills become 100-200 line dispatchers (orchestration). Agents become thick workers with full Claude Code frontmatter (execution). Hooks and shell scripts form the enforcement layer that neither skills nor agents can bypass. Every design section below respects this boundary.

### Decision 2: Dual-Layer Rubric + Reasoning for Semantic Gates
Applied to G3 (Design quality) and G5 (Spike quality). Layer 1 is a code-enforced structural rubric (section counts, DA coverage, evidence references). Layer 2 is a separate verifier agent that evaluates reasoning soundness. This preserves the Phase 24 verifier design concept while anchoring it in the harness architecture.

### Decision 3: Incremental Hardening (Not Full Rebuild)
Applied to the migration sequence. Each increment delivers standalone value and validates patterns before the next increment depends on them. The ordering (hooks first, then state splitting, then agent formalization, then gates, then resume, then worktrees) follows dependency chains while maximizing early wins.

### Decision 4: Worktree Isolation for Execute Only
Applied narrowly. Only execute-skill agents get `isolation: "worktree"` in their frontmatter. Research, design, plan, and spike agents write to `.expedite/` directories only and do not need filesystem isolation.

### Constraints Honored
- **C1 (Claude Code plugin API)**: All mechanisms use hooks, skills, agents, frontmatter, and Task() — no external services or custom runtimes.
- **C2 (Full rebuild acceptable)**: The three-layer separation is a significant restructuring, but delivered incrementally per Decision 3.
- **C3 (Personal/team tool)**: Configuration complexity is acceptable. Hook scripts, shell validators, and multi-file state are power-user patterns appropriate for this audience.
- **C4 (SessionStart deferred)**: The design uses SessionStart with a fallback pattern (ECC's root fallback). If SessionStart is unreliable, the system degrades to frontmatter injection and on-demand reads. No design component hard-depends on SessionStart.
- **C5 (Pipeline is fixed)**: The lifecycle stages (scope, research, design, plan, spike, execute) are unchanged. The harness hardens the pipeline's seams, not its stages.

---

## Agent-Resolved Contested Areas

### Contested Area 1: Hook Handler Types for Gate Enforcement

**Question**: Which hook handler type (command, prompt, agent) should enforce each gate class?

**Resolution**: Command hooks for all structural gates (G1, G2, G4) and state transition enforcement. Agent hooks for semantic gates (G3, G5) via the SubagentStop event. No prompt hooks for gate enforcement.

**Reasoning**: The DX lens prioritizes speed and predictability. Command hooks execute in approximately 100ms and produce deterministic results — the developer never waits for an LLM call to validate a state write. For semantic gates, prompt hooks (2-5 seconds) would feel snappy but lack the tool access needed for thorough verification (reading the artifact, cross-referencing SCOPE.md). Agent hooks (30-60 seconds) are slower but the gate evaluation itself already takes significant time, so the marginal latency is absorbed. The developer expects a gate check to take a moment; they do not expect a state write to lag.

**Evidence**: Research synthesis confirms command hooks are fastest and deterministic. The supplement synthesis confirms all three handler types (command, prompt, agent) are available in plugin hooks.json. The quality validation patterns research shows that structural validation through deterministic code eliminates the rubber stamp problem entirely, while semantic evaluation requires tool access to read and cross-reference artifacts.

### Contested Area 2: State File Granularity

**Question**: How many files should state be split into, and what belongs in each?

**Resolution**: Five state files in `.expedite/`:

| File | Contents | Typical Size | Loaded By |
|------|----------|-------------|-----------|
| `state.yml` | Phase, lifecycle identity, version, timestamps | ~15 lines | All skills (frontmatter) |
| `checkpoint.yml` | Current step, substep, continuation notes, inputs hash | ~10-20 lines | All skills (frontmatter) |
| `questions.yml` | Research questions, refinement history | Variable (grows) | Scope, research skills |
| `gates.yml` | Gate history, override records | Variable (grows) | Gate evaluation hooks, status skill |
| `tasks.yml` | Execution task list, completion tracking | Variable | Execute skill |

**Reasoning**: The DX lens optimizes for "the developer should never wonder what happened." Five files map cleanly to five distinct concerns, and each skill loads only what it needs. The critical split is separating `checkpoint.yml` from `state.yml` — checkpoint data changes on every step transition (high write frequency) while lifecycle state changes only on phase transitions (low write frequency). Combining them would mean every step-level checkpoint update loads all lifecycle metadata into the Write context.

**Evidence**: Directory-based state is the convergent pattern across 4+ harnesses (research synthesis). LangGraph checkpoints and ECC's hook-distributed state both validate the file-per-concern approach. The planned ARCH-02 through ARCH-06 split already anticipated this direction; this resolution specifies `checkpoint.yml` as a new addition generalizing the execute skill's existing checkpoint pattern to all skills.

### Contested Area 3: SessionStart Hook Usage Despite Platform Bugs

**Question**: Should the design rely on SessionStart hooks, design around them, or defer them entirely?

**Resolution**: Design with SessionStart as the primary context-loading mechanism, but implement a root fallback pattern so every SessionStart behavior degrades gracefully to frontmatter injection or on-demand reads. No feature should break if SessionStart does not fire.

**Reasoning**: The DX lens values reliability over capability. If SessionStart works, the developer gets seamless context restoration on resume — the system loads checkpoint.yml, determines where they left off, and reports status without the developer asking. If SessionStart is buggy, they get the same behavior triggered by the skill's frontmatter injection (slightly less elegant, but functionally equivalent). The developer never notices the difference because the outcomes are identical; only the trigger changes.

**Evidence**: Three platform bugs (#16538, #13650, #11509) historically blocked SessionStart. ECC's root fallback pattern (documented in category-hook-mechanisms.md) provides the graceful degradation model. The READINESS assessment classified SessionStart bug status as "non-blocking for design" precisely because the fallback pattern exists.

### Contested Area 4: Agent Persistent Memory Usage

**Question**: Should expedite agents use Claude Code's per-agent persistent memory feature?

**Resolution**: Yes, but only for the research synthesizer agent and the verifier agent. Other agents (researchers, implementers) remain stateless.

**Reasoning**: The DX lens asks "what memory would the developer find valuable if they could see it?" The synthesizer learning which evidence patterns are most useful across lifecycles is valuable — it produces better syntheses over time. The verifier learning common failure patterns is valuable — it catches issues faster. Individual research agents are ephemeral by nature (different questions each lifecycle), so persistent memory would accumulate stale context and confuse the developer if they inspected it. The developer should trust that stateless agents start fresh and that stateful agents accumulate useful judgment.

**Evidence**: Claude Code subagent persistent memory (3 scopes: user, project, local) is documented in the agent-team-patterns and memory-context-patterns research. The `memory: project` scope makes agent memory committable and inspectable — aligning with the DX value of transparency. The 200-line MEMORY.md auto-loading keeps memory injection lightweight.

### Contested Area 5: PreCompact Hook Strategy

**Question**: What should happen when context compaction occurs mid-skill?

**Resolution**: A PreCompact command hook saves the current checkpoint to `checkpoint.yml` and writes a one-paragraph session summary to `.expedite/session-summary.md`. The summary includes: current skill, current step, what was accomplished this session, and what should happen next.

**Reasoning**: The DX lens treats context loss as the highest-anxiety moment for the developer. "Did the system lose my progress?" is the question they ask. The PreCompact hook ensures that even if compaction discards most of the conversation, the checkpoint file and session summary persist on disk. When the session continues post-compaction, the skill's frontmatter injection loads checkpoint.yml and the LLM knows exactly where to resume. The developer sees continuity, not confusion.

**Evidence**: ECC's `pre-compact.js` and `suggest-compact.js` demonstrate strategic compaction management. The session summary pattern from ECC's Stop/SessionStart hooks provides the model for what to persist. LangGraph's checkpoint-per-step pattern validates that saving state before potential loss is the proven approach.

---

## Three-Layer Architecture

### Layer 1: Enforcement (Hooks + Scripts)

**Responsibility**: Prevent invalid operations. Hooks and shell scripts form a hard boundary that neither skills nor agents can bypass. This layer answers the question "is this operation allowed?" with deterministic yes/no decisions.

**What lives here**:
- `hooks/hooks.json` — Hook event registrations
- `hooks/validate-state-write.sh` — PreToolUse command hook for state.yml writes (FSM validation)
- `hooks/validate-checkpoint-write.sh` — PreToolUse command hook for checkpoint.yml writes (schema validation)
- `hooks/pre-compact-save.sh` — PreCompact command hook (checkpoint + session summary persistence)
- `hooks/session-start.sh` — SessionStart command hook (context loading with fallback)
- `hooks/audit-override.sh` — PostToolUse command hook (append-only audit trail for gate overrides)

**Developer experience**: This layer is invisible when things are working. The developer never thinks about hooks during normal operation. When enforcement intervenes, the developer sees a clear denial message: "State write blocked: cannot transition from scope_in_progress to research_in_progress without G1 gate passage. Run /expedite:gate to evaluate." The developer always knows what to do next.

### Layer 2: Orchestration (Thin Skills)

**Responsibility**: Manage the developer conversation, determine what to do next, dispatch agents, and present results. Skills are the user-facing surface — they receive commands, interpret intent, read state, and invoke the right agent for the work.

**What lives here**:
- `skills/scope/SKILL.md` (~150 lines) — Scope orchestrator
- `skills/research/SKILL.md` (~150 lines) — Research orchestrator
- `skills/design/SKILL.md` (~150 lines) — Design orchestrator
- `skills/plan/SKILL.md` (~100 lines) — Plan orchestrator
- `skills/spike/SKILL.md` (~100 lines) — Spike orchestrator
- `skills/execute/SKILL.md` (~100 lines) — Execute orchestrator
- `skills/status/SKILL.md` (~80 lines) — Status display
- `skills/gate/SKILL.md` (~80 lines) — Gate evaluation trigger

**Developer experience**: The developer interacts only with skills. `/expedite:scope`, `/expedite:research`, etc. Skills are short enough that a developer reading SKILL.md can understand the entire orchestration flow in one screen. Skills do not contain business logic — they read checkpoint, determine which step to resume, and dispatch the appropriate agent. The developer's mental model is: "skills route, agents work."

### Layer 3: Execution (Thick Agents)

**Responsibility**: Do the actual work. Agents are autonomous workers with rich frontmatter (tool restrictions, model assignment, memory, hooks). Each agent receives a focused prompt with assembled context and produces artifacts.

**What lives here**:
- `.claude/agents/scope-facilitator.md` — Conducts scope conversation
- `.claude/agents/research-planner.md` — Generates research questions
- `.claude/agents/web-researcher.md` — Executes web research
- `.claude/agents/codebase-researcher.md` — Executes codebase research
- `.claude/agents/research-synthesizer.md` — Synthesizes evidence (with persistent memory)
- `.claude/agents/design-architect.md` — Produces design documents
- `.claude/agents/plan-decomposer.md` — Breaks designs into phases
- `.claude/agents/spike-researcher.md` — Resolves tactical decisions
- `.claude/agents/task-implementer.md` — Implements code changes (worktree-isolated)
- `.claude/agents/gate-verifier.md` — Semantic quality evaluation (with persistent memory)

**Developer experience**: Agents are like team members — the developer knows they exist and what they specialize in, but does not micro-manage them. When an agent runs, the developer sees progress indicators. When an agent finishes, the skill presents results. If the developer wants to understand what an agent does, they can read a single agent .md file — it's self-contained with clear purpose, tool restrictions, and model assignment.

### Information Flow Between Layers

```
Developer → Skill (Layer 2) → reads checkpoint.yml → dispatches Agent (Layer 3)
                                                            ↓
                                                     Agent produces artifacts
                                                            ↓
                                                     Agent writes to state files
                                                            ↓
                                              Hook (Layer 1) validates the write
                                                      ↓              ↓
                                                   ALLOW           DENY + reason
                                                      ↓              ↓
                                              Write succeeds    Agent sees denial,
                                                                adjusts and retries
```

The key architectural invariant: **Agents never bypass enforcement.** Every Write to a state file passes through the PreToolUse hook regardless of which agent or skill initiated it. This is structural — it's impossible for an agent to write invalid state because the hook intercepts the tool call before execution.

---

## Hook Architecture

### Hook Registry

All hooks registered in `hooks/hooks.json` within the plugin:

| Hook Event | Handler Type | Matcher | Purpose | Blocking? |
|-----------|-------------|---------|---------|-----------|
| `PreToolUse` | command | `Write` | Validate state.yml and checkpoint.yml writes | Yes (exit 2 denies) |
| `PostToolUse` | command | `Write` | Audit trail for gate overrides | No |
| `PreCompact` | command | — | Save checkpoint + session summary before compaction | No |
| `SessionStart` | command | `startup\|resume` | Load context, report resume status | No |
| `Stop` | command | — | Write session summary for next session handoff | No |
| `SubagentStop` | agent | `gate-verifier` | Semantic gate evaluation after verifier completes | No |

### Hook 1: PreToolUse on Write (State Transition Guard)

**What it enforces**: Every Write call targeting `.expedite/state.yml` or `.expedite/checkpoint.yml` passes through a shell script validator.

**For state.yml writes**:
1. Parse the proposed YAML content from stdin JSON (`tool_input.content`)
2. Read the current state.yml from disk
3. Validate the phase transition against an allowed-transitions table:
   - `not_started` may transition to `scope_in_progress`
   - `scope_in_progress` may transition to `scope_complete` (requires G1 passage in gates.yml)
   - `scope_complete` may transition to `research_in_progress`
   - (and so on for all lifecycle phases)
4. Validate required fields are present (project_name, lifecycle_id, phase, version)
5. If invalid: exit 2 with JSON `{"permissionDecision": "deny", "permissionDecisionReason": "..."}`
6. If valid: exit 0

**For checkpoint.yml writes**:
1. Parse the proposed YAML content
2. Validate that `skill`, `step`, and `label` fields are present
3. Validate that `step` is a positive integer
4. If the step number is decreasing (regression), deny unless `substep` is `recovery`
5. If valid: exit 0

**Developer experience when blocked**: The developer sees Claude report something like: "I tried to advance the lifecycle to research_in_progress, but the state write was blocked. The enforcement hook says: 'Cannot transition from scope_in_progress to research_in_progress — G1 gate has not passed. Current gate status: no G1 entry in gates.yml. Run /expedite:gate to evaluate scope completeness.' Let me help you run the gate evaluation instead."

The developer never sees a raw exit code or cryptic error. The `permissionDecisionReason` field provides human-readable guidance that Claude relays naturally.

### Hook 2: PostToolUse on Write (Override Audit)

**What it does**: After any Write to `.expedite/gates.yml`, the script checks whether the latest entry has `overridden: true`. If so, it appends to `.expedite/audit.log`:
```
[2026-03-12T14:30:00Z] GATE OVERRIDE: G1 overridden by user. Reason: "Scope is sufficient for exploratory spike." Severity: low. Affected DAs: none.
```

**Developer experience**: The developer never sees this hook fire. It is purely for traceability. If the developer later wonders "did I override any gates?", they can check `audit.log`. The audit trail is append-only — it cannot be edited or truncated by agents.

### Hook 3: PreCompact (Checkpoint Preservation)

**What it does**: Before context compaction, the script:
1. Reads the current `.expedite/checkpoint.yml`
2. If it exists, copies it to `.expedite/checkpoint.yml.pre-compact` as a backup
3. Writes a one-paragraph session summary to `.expedite/session-summary.md` containing the current skill, step, and what was being done

**Developer experience**: Context compaction happens silently. The developer may notice the conversation seems shorter, but their progress is preserved. If the LLM needs to resume after compaction, it reads checkpoint.yml and session-summary.md and continues seamlessly. The developer's trust in the system is maintained because nothing is lost.

### Hook 4: SessionStart (Context Loading)

**What it does**: On session startup or resume, the script:
1. Checks if `.expedite/state.yml` exists (active lifecycle detection)
2. If yes, reads state.yml and checkpoint.yml
3. Outputs a brief status summary to stdout: "Expedite lifecycle active: project_name=MyProject, phase=research_in_progress, last_step=research/7 (Dispatch web researchers)"
4. If no active lifecycle: outputs nothing (silent)

**Fallback**: If SessionStart does not fire (platform bugs), the same information is loaded via frontmatter `!cat` commands in each skill's SKILL.md. The developer gets identical information — the only difference is the trigger mechanism.

**Developer experience**: When opening a session with an active lifecycle, the developer immediately sees where they left off — before typing anything. This is the most confidence-building DX moment: "The system knows where I am."

### Hook 5: Stop (Session Summary)

**What it does**: When Claude finishes responding and the session may end:
1. Reads current checkpoint.yml
2. Writes `.expedite/session-summary.md` with: what happened this session, current state, and recommended next action
3. This summary is consumed by SessionStart on the next session

**Developer experience**: Invisible. The developer starts a new session and sees the context loaded as if they never left.

### Hook 6: SubagentStop on gate-verifier (Semantic Gate Trigger)

**What it does**: After the gate-verifier agent completes, this agent hook:
1. Reads the verifier's output (structured evaluation result)
2. Validates that the verifier produced a complete evaluation (all rubric dimensions scored, reasoning provided)
3. Does NOT re-evaluate — it checks evaluation completeness, not correctness

This hook catches incomplete verifier runs (e.g., verifier hit maxTurns before finishing). It does not override the verifier's judgment.

**Developer experience**: If the verifier produced an incomplete evaluation, the developer sees: "The gate evaluation was incomplete (missing reasoning for DA-3 coverage). Re-running the verifier to get a complete assessment." If the evaluation was complete, the developer sees the gate result directly.

### Latency and UX Impact

| Hook | Expected Latency | Frequency | UX Impact |
|------|-----------------|-----------|-----------|
| PreToolUse (state) | ~100ms | Every state/checkpoint write (5-15 per skill run) | Imperceptible |
| PostToolUse (audit) | ~50ms | Only on gate override writes (rare) | None |
| PreCompact | ~100ms | 0-2 times per long session | None (pre-compaction moment) |
| SessionStart | ~200ms | Once per session start | Adds minimal delay to session start |
| Stop | ~100ms | Once per session end | None (post-response) |
| SubagentStop (verifier) | 30-60s | Once per gate evaluation | Absorbed into gate evaluation time |

Total hook-induced latency during normal operation: less than 1 second per skill run, spread across 5-15 state writes. The developer does not perceive any lag from enforcement hooks.

### Override Mechanism

When a hook blocks a state write, the developer has two paths:

1. **Address the issue**: Run the required gate, complete the missing step, or fix the validation error. This is the expected path.
2. **Override**: The developer explicitly tells the skill to override the gate (e.g., "override G1, reason: scope is sufficient for this exploratory spike"). The skill:
   a. Writes `overridden: true` to gates.yml with the reason and severity
   b. The PostToolUse audit hook logs the override
   c. Retries the state write — the PreToolUse hook allows transitions when `overridden: true` exists for the required gate

Overrides are never silent. They produce artifacts (override-context.md), audit entries, and gate_history records. The developer can always trace why a phase was advanced.

---

## State Management Architecture

### File-Per-Concern Structure

```
.expedite/
├── state.yml           # Lifecycle identity and phase (core memory — always loaded)
├── checkpoint.yml      # Step-level tracking and resume data (core memory — always loaded)
├── questions.yml       # Research questions and refinement history (loaded by scope/research)
├── gates.yml           # Gate evaluation history and overrides (loaded by gate/status)
├── tasks.yml           # Execution task list and completion tracking (loaded by execute)
├── session-summary.md  # Last session's handoff notes (loaded by SessionStart)
├── audit.log           # Append-only override audit trail (never loaded into context)
└── evidence/           # Research artifacts (loaded on demand by agents)
```

### state.yml (~15 lines, always loaded)

```yaml
version: 1
lifecycle_id: "lifecycle-2026-03-12-myproject"
project_name: "MyProject"
phase: "research_in_progress"
started_at: "2026-03-12T10:00:00Z"
phase_started_at: "2026-03-12T11:30:00Z"
```

This file changes only on phase transitions (roughly 6 times per lifecycle). It is small enough to inject into every skill via frontmatter without token concern.

### checkpoint.yml (~10-20 lines, always loaded)

```yaml
skill: research
step: 7
label: "Dispatch web researchers"
substep: "waiting_for_agents"
continuation_notes: "3 of 5 web researchers dispatched. Remaining: DA-4 worktree patterns, DA-6 memory strategies."
inputs_hash: "a3f2b1..."
updated_at: "2026-03-12T12:45:00Z"
```

This file changes on every step transition. It is the primary resume mechanism. The `inputs_hash` field enables idempotency checks — if the inputs to a step haven't changed since the checkpoint was written, the step can be safely re-run.

### questions.yml (variable size, loaded by scope and research skills)

Contains the research questions generated during scope, along with refinement history. Only loaded by skills that need it, keeping token usage proportional to relevance.

### gates.yml (variable size, loaded by gate and status skills)

```yaml
history:
  - gate: G1
    timestamp: "2026-03-12T11:00:00Z"
    outcome: "go"
    structural_checks:
      scope_md_exists: true
      questions_count: 12
      das_covered: 5
    evaluator: "command-hook"
  - gate: G2
    timestamp: "2026-03-12T14:00:00Z"
    outcome: "go-with-advisory"
    structural_checks:
      synthesis_exists: true
      categories_count: 4
      evidence_per_da: {DA-1: 6, DA-2: 4, DA-3: 5}
    semantic_evaluation:
      verifier_agent: "gate-verifier"
      reasoning_score: 0.85
      advisory: "DA-2 evidence is adequate but not strong"
    evaluator: "dual-layer"
```

### tasks.yml (variable size, loaded by execute skill only)

Contains the phased task list and per-task completion status. Only loaded by the execute skill, keeping it out of context during earlier lifecycle phases.

### Write Patterns and Validation

**state.yml**: Written only by skills (not agents) via the orchestration layer. Every write passes through the PreToolUse hook which validates FSM transitions. Writes are whole-file rewrites (file is small enough that this is safe and simple).

**checkpoint.yml**: Written by both skills and agents on step transitions. Every write passes through the PreToolUse hook which validates schema. Writes are whole-file rewrites (file is small enough). The `inputs_hash` field provides an idempotency check.

**questions.yml, gates.yml, tasks.yml**: Written by skills and agents. No hook validation on these files — their structure is enforced by the producing skill/agent's instructions. These files grow during the lifecycle but are loaded only by the skills that need them.

**audit.log**: Append-only, written only by the PostToolUse audit hook. Never loaded into LLM context. Exists purely for developer inspection.

### State Consumption Patterns

| Consumer | state.yml | checkpoint.yml | questions.yml | gates.yml | tasks.yml |
|----------|-----------|---------------|---------------|-----------|-----------|
| All skills | Frontmatter | Frontmatter | — | — | — |
| Scope skill | Frontmatter | Frontmatter | Frontmatter | — | — |
| Research skill | Frontmatter | Frontmatter | Frontmatter | — | — |
| Design skill | Frontmatter | Frontmatter | — | — | — |
| Execute skill | Frontmatter | Frontmatter | — | — | Frontmatter |
| Gate skill | Frontmatter | Frontmatter | — | Frontmatter | — |
| Status skill | Frontmatter | Frontmatter | On-demand | Frontmatter | On-demand |
| PreToolUse hook | Reads from disk | Reads from disk | — | Reads from disk | — |
| SessionStart hook | Reads from disk | Reads from disk | — | — | — |

### State Schema and Evolution

**Version field**: `state.yml` includes a `version: 1` field. If the schema changes in a future version, the validation hook can apply migration logic (e.g., add missing fields with defaults) before validation. This avoids breaking existing lifecycles when the harness is updated.

**Directory-based evolution**: Adding a new state concern (e.g., `metrics.yml` for lifecycle telemetry) requires only creating the file and updating the relevant skill's frontmatter injection. No existing files change. This is inherently more evolution-friendly than a monolithic file where every schema change risks corrupting existing state.

---

## Agent Formalization

### Agent Definition Format

Every agent is a Markdown file in `.claude/agents/` with YAML frontmatter following the official Claude Code subagent schema:

```yaml
---
name: web-researcher
description: "Executes web research for a single research question, producing structured evidence files."
model: sonnet
tools:
  - WebSearch
  - WebFetch
  - Read
  - Write
  - Glob
  - Grep
disallowedTools:
  - Bash
  - Edit
  - EnterWorktree
maxTurns: 30
permissionMode: acceptEdits
---

# Web Researcher Agent

[Agent instructions, context about the research question, output format requirements...]
```

### Key Frontmatter Fields and Their Purpose

| Field | Purpose | DX Impact |
|-------|---------|-----------|
| `name` | Unique identifier, used in hook matchers and dispatch | Developer can reference agents by name |
| `description` | When Claude should delegate to this agent | Enables automatic delegation |
| `model` | Cost/capability tiering | Developer controls spend per agent type |
| `tools` | Tool allowlist | Prevents agents from doing unintended operations |
| `disallowedTools` | Tool denylist | Safety net for inherited tool sets |
| `maxTurns` | Execution cap | Prevents runaway agents; developer knows worst-case duration |
| `permissionMode` | Permission handling | Reduces permission prompts for trusted operations |
| `memory` | Persistent memory scope | Agents that learn across lifecycles |
| `isolation` | Worktree isolation | Code-modifying agents get filesystem isolation |
| `hooks` | Per-agent lifecycle hooks | Agent-specific enforcement |

### Agent Registry

```
.claude/agents/
├── scope-facilitator.md       # Sonnet — Conducts scope conversation
├── research-planner.md        # Sonnet — Generates research questions
├── web-researcher.md          # Sonnet — Web research per question
├── codebase-researcher.md     # Sonnet — Codebase analysis per question
├── research-synthesizer.md    # Opus  — Synthesizes evidence (memory: project)
├── design-architect.md        # Opus  — Produces design documents
├── plan-decomposer.md         # Sonnet — Breaks design into phases
├── spike-researcher.md        # Sonnet — Resolves tactical decisions
├── task-implementer.md        # Sonnet — Implements code (isolation: worktree)
├── gate-verifier.md           # Opus  — Semantic quality evaluation (memory: project)
└── sufficiency-evaluator.md   # Sonnet — Structural rubric evaluation
```

### Tool Restrictions Per Agent Type

| Agent | Allowed Tools | Rationale |
|-------|--------------|-----------|
| web-researcher | WebSearch, WebFetch, Read, Write, Glob, Grep | Needs web access and file writing for evidence; no code execution |
| codebase-researcher | Read, Glob, Grep, Bash (read-only patterns) | Needs codebase exploration; no web access, no file modification of source |
| research-synthesizer | Read, Write, Glob, Grep | Reads evidence, writes synthesis; no web access, no code execution |
| design-architect | Read, Write, Glob, Grep | Reads synthesis, writes design; no code execution |
| task-implementer | Read, Write, Edit, Bash, Glob, Grep | Full code modification capabilities; isolated via worktree |
| gate-verifier | Read, Glob, Grep | Read-only evaluation; cannot modify artifacts being evaluated |
| sufficiency-evaluator | Read, Glob, Grep | Read-only structural checks; cannot modify anything |

**DX rationale**: Tool restrictions serve two purposes. First, they prevent accidents — a research agent cannot accidentally edit source code. Second, they build developer trust — the developer knows that only the task-implementer can modify source code, and it runs in an isolated worktree. When something goes wrong, the blast radius is bounded and predictable.

### Model Tiering Strategy

| Tier | Model | Agent Types | Rationale |
|------|-------|-------------|-----------|
| Premium | Opus | research-synthesizer, design-architect, gate-verifier | Tasks requiring deep reasoning, cross-referencing, and quality judgment |
| Balanced | Sonnet | web-researcher, codebase-researcher, plan-decomposer, spike-researcher, task-implementer, scope-facilitator, sufficiency-evaluator, research-planner | Tasks requiring competent execution within clear parameters |
| Fast | Haiku | (Reserved for future: quick lookups, file existence checks) | Not currently used; available for future optimization |

**DX rationale**: The developer pays Opus prices only for the work that benefits from Opus capabilities. Research synthesis and design architecture require connecting disparate evidence into coherent arguments — this is where Opus excels. Individual research, implementation, and planning are well-defined tasks where Sonnet performs comparably at lower cost.

### Per-Agent Hooks and Memory

**gate-verifier** agent:
- `memory: project` — Learns common failure patterns across gate evaluations. Its MEMORY.md accumulates notes like "Design documents for data-heavy projects often miss DA-2 state evolution considerations."
- No per-agent hooks beyond the SubagentStop hook registered at plugin level.

**research-synthesizer** agent:
- `memory: project` — Learns synthesis patterns. Its MEMORY.md accumulates notes about which evidence structures produce the most useful syntheses.

**task-implementer** agent:
- `isolation: worktree` — Gets its own worktree for code modifications.
- No persistent memory (each implementation task is independent).

All other agents: no persistent memory, no isolation, no per-agent hooks.

---

## Quality Gate Enforcement

### Gate Classification

| Gate | Phase Transition | Type | Enforcement |
|------|-----------------|------|-------------|
| G1 | scope_complete | Structural | Command hook (deterministic) |
| G2 | research_complete | Structural + Semantic | Command hook + Verifier agent |
| G3 | design_complete | Semantic (primary) | Command hook (structural checks) + Verifier agent (reasoning) |
| G4 | plan_complete | Structural | Command hook (deterministic) |
| G5 | spike_complete | Semantic (primary) | Command hook (structural checks) + Verifier agent (reasoning) |

### Structural Gates (G1, G2-structural, G4): Deterministic Validation

**G1 (Scope Completeness)**:
The PreToolUse hook on state.yml, when it detects a transition to `scope_complete`, triggers structural checks:
- SCOPE.md exists and is not empty
- questions.yml exists with at least 3 questions
- Every decision area referenced in SCOPE.md has at least one question in questions.yml
- All questions have `priority` and `depth` fields

These checks are shell script logic operating on file contents. They produce the same result every time for the same inputs. No LLM judgment involved.

**G4 (Plan Completeness)**:
- PLAN.md exists with phase decomposition
- Each phase has: title, description, scope, success criteria, and estimated effort
- Phase count is between 2 and 20 (sanity bounds)
- Total tasks across phases is at least 5

**G2 structural component**:
- research-synthesis.md exists
- All category files referenced in SCOPE.md exist
- Each decision area in SCOPE.md has a corresponding section in the synthesis
- READINESS.md exists with per-DA status

**Developer experience with structural gates**: The developer runs `/expedite:gate` or tries to advance the phase. If structural checks fail, they see a specific, actionable message: "G1 structural check failed: questions.yml has 2 questions, minimum is 3. DA-3 has no questions. Add questions for DA-3 to pass G1." There is no ambiguity — the developer knows exactly what to fix.

### Semantic Gates (G3, G5): Dual-Layer Evaluation

**Layer 1 — Structural Rubric (Code-Enforced)**:
For G3 (Design):
- DESIGN.md exists with all required sections (per design skill's output format)
- Every decision area from SCOPE.md has a corresponding section in DESIGN.md
- Each decision section references evidence (contains at least one citation or evidence file reference)
- Word count per section exceeds minimum threshold (e.g., 100 words — a section with only a title is not a decision)

For G5 (Spike):
- Each spike output file exists for every phase that required spiking
- Each spike file contains: decision, rationale, implementation steps, and validation criteria
- Implementation steps count is at least 3

**Layer 2 — Reasoning Verification (Verifier Agent)**:
The gate-verifier agent (Opus, read-only tools, persistent memory) receives:
- The artifact under evaluation (DESIGN.md or spike output)
- The upstream inputs (SCOPE.md, research synthesis)
- A structured evaluation prompt asking:
  1. Are the decisions logically supported by the evidence cited?
  2. Are there contradictions between decisions?
  3. Are there unstated assumptions that should be made explicit?
  4. Does the reasoning flow from evidence to conclusion without gaps?

The verifier produces a structured evaluation:
```yaml
overall: go | go-with-advisory | no-go
dimensions:
  evidence_support: {score: 0.9, notes: "..."}
  internal_consistency: {score: 1.0, notes: "..."}
  assumption_transparency: {score: 0.7, notes: "Missing assumption about X"}
  reasoning_completeness: {score: 0.85, notes: "..."}
advisory: "Assumption about X should be documented"
```

**Anti-rubber-stamp measures**:
1. The verifier agent uses Opus (different model or same model class as the producer, but with dedicated evaluation instructions — the separation of producer and evaluator roles is the key bias mitigation).
2. The verifier has read-only tool access — it cannot fix what it evaluates, preventing "evaluate then auto-fix" shortcuts.
3. The verifier's persistent memory accumulates failure patterns, making it more critical over time rather than more lenient.
4. The structural rubric layer catches "checked all boxes but boxes are empty" failures independently of the verifier's judgment.
5. The structured output format forces the verifier to score each dimension independently, preventing a single "looks good" judgment.

**Developer experience with semantic gates**: The developer runs `/expedite:gate`. First, structural checks run instantly (sub-second). If structural checks fail, the developer gets immediate feedback without waiting for the verifier. If structural checks pass, the verifier agent runs (30-60 seconds). The developer sees progress: "Running semantic evaluation... checking evidence support... checking internal consistency..." When the verifier finishes, the developer sees a per-dimension breakdown with scores and notes. If the gate passes with advisory, the developer sees what could be improved but is not blocked. If the gate fails, the developer sees specific dimensions that need work.

### Gate-State Integration

Gates are state transition guards. The PreToolUse hook on state.yml enforces:

1. Parse proposed state.yml to detect phase transition
2. If transitioning to `X_complete`, read gates.yml
3. Check for a gate entry matching the required gate (G1 for scope_complete, G2 for research_complete, etc.)
4. Entry must have `outcome: "go"` or `outcome: "go-with-advisory"` or `overridden: true`
5. If no qualifying entry exists, deny the write with: "Cannot advance to {phase} — {gate} has not passed"

This makes gate bypass structurally impossible. Even if the skill's instructions are ignored (prompt-enforcement failure), the hook prevents the state write. The enforcement is in code, not in prompts.

### Override Flow

1. Developer tells the skill: "Override G1, the scope is sufficient for an exploratory spike"
2. Skill writes to gates.yml: `{gate: G1, outcome: overridden, override_reason: "...", severity: low}`
3. PostToolUse audit hook logs the override to audit.log
4. Skill retries the state transition — PreToolUse hook sees `overridden: true` and allows the write
5. Developer sees confirmation: "G1 overridden. Override logged. Advancing to research phase."

The override is auditable, traceable, and requires explicit developer intent. It is not a backdoor — it is a documented escape hatch.

---

## Resume & Recovery Architecture

### Generalized Checkpoint Mechanism

Every skill writes to `.expedite/checkpoint.yml` on every step transition. The checkpoint contains enough information for deterministic resume:

```yaml
skill: research
step: 7
label: "Dispatch web researchers"
substep: "dispatching"
continuation_notes: >
  3 of 5 web researchers dispatched successfully.
  Remaining questions: DA-4 (worktree patterns), DA-6 (memory strategies).
  Next: dispatch remaining 2 researchers, then wait for all 5 to complete.
inputs_hash: "sha256:a3f2b1c..."
updated_at: "2026-03-12T12:45:00Z"
```

### Step-Level Tracking and Deterministic Resume

**Current problem**: Expedite tracks `current_step` but resume logic uses artifact-existence heuristics instead. This creates three failure modes: partial artifacts confuse the heuristic, the LLM interprets state differently on resume, and mid-step crashes leave ambiguous state.

**Solution**: Resume logic reads checkpoint.yml directly and jumps to the recorded step. The skill's orchestration logic becomes:

```
1. Read checkpoint.yml
2. If checkpoint.skill matches this skill:
   a. Resume at checkpoint.step (not step 1)
   b. Use continuation_notes for context on what happened before the interruption
3. If checkpoint.skill does not match (or no checkpoint):
   a. Start at step 1
```

This is deterministic. The same checkpoint always produces the same resume point. No heuristic interpretation required.

### Session Handoff Pattern

When a session ends (Stop hook) or compaction occurs (PreCompact hook):
1. Current checkpoint.yml is preserved (it's already on disk)
2. `.expedite/session-summary.md` is written with: what happened, current state, what to do next

When a new session starts (SessionStart hook or skill frontmatter):
1. checkpoint.yml is loaded — the system knows the exact step
2. session-summary.md is loaded — the system has narrative context
3. The skill reports: "Resuming research, step 7 of 12: Dispatch web researchers. 3 of 5 dispatched."

### Idempotency Guarantees

**Step re-execution safety**: If a step was partially completed when the session ended, re-running it should not duplicate work or corrupt state. Strategies per step type:

- **Artifact-producing steps** (e.g., "write synthesis"): Check if the artifact exists and matches the inputs_hash. If yes, skip. If no (partial or missing), re-produce.
- **Agent-dispatching steps** (e.g., "dispatch researchers"): Check which agents have produced output files. Dispatch only the remaining agents. continuation_notes records which were already dispatched.
- **State-modifying steps** (e.g., "advance phase"): The PreToolUse hook ensures idempotent state writes — writing the same valid state twice is harmless.

**The inputs_hash field**: Before executing a step, the skill hashes the step's inputs (e.g., the research questions for a research dispatch step). If the hash matches the checkpoint's inputs_hash, the step was already completed with these inputs. If the hash differs (inputs changed), the step should be re-executed.

### Developer Experience on Resume

**Moment 1 — Opening a session with active work**:
The developer opens Claude Code. SessionStart fires (or the first skill's frontmatter loads state). They see:
```
Expedite lifecycle active: MyProject
Phase: research_in_progress
Last checkpoint: research/step 7 — "Dispatch web researchers"
3 of 5 researchers dispatched. 2 remaining.
Recommended action: Run /expedite:research to continue.
```

The developer knows exactly where they are, what happened, and what to do next. No guessing, no "let me check what state we're in."

**Moment 2 — Resuming after compaction**:
The conversation was long and auto-compacted. The LLM lost most of the conversation history. But checkpoint.yml and session-summary.md are on disk. The skill reads them and says:
```
Resuming from checkpoint. Research step 7: dispatching remaining 2 web researchers.
Previous session notes: "3 of 5 dispatched. Remaining: DA-4, DA-6."
Continuing from where we left off.
```

**Moment 3 — Resuming after a crash (mid-step)**:
The LLM stopped mid-step (network error, token limit, etc.). Checkpoint.yml still shows step 7 with substep "dispatching." On resume, the skill checks agent outputs and says:
```
Resuming research step 7. Checking agent outputs...
Found: DA-1, DA-2, DA-3 completed. DA-4 and DA-6 pending.
Dispatching researchers for DA-4 and DA-6.
```

The developer sees recovery, not confusion. The system handles the partial state gracefully because it checks actual outputs against expected outputs, using the checkpoint as the guide for what to expect.

---

## Context & Memory Strategy

### Scoped Injection

Every skill's SKILL.md frontmatter injects only the state files relevant to that skill:

```yaml
# scope/SKILL.md frontmatter
---
!cat .expedite/state.yml 2>/dev/null || echo "No active lifecycle"
!cat .expedite/checkpoint.yml 2>/dev/null || echo "No checkpoint"
!cat .expedite/questions.yml 2>/dev/null || echo "No questions yet"
---
```

```yaml
# execute/SKILL.md frontmatter
---
!cat .expedite/state.yml 2>/dev/null || echo "No active lifecycle"
!cat .expedite/checkpoint.yml 2>/dev/null || echo "No checkpoint"
!cat .expedite/tasks.yml 2>/dev/null || echo "No task list"
---
```

The design skill never loads questions.yml. The scope skill never loads tasks.yml. Each skill's context is proportional to its needs.

### PreCompact Handling

The PreCompact hook writes:
1. `checkpoint.yml` backup (already on disk, but ensures it is current)
2. `session-summary.md` with a narrative handoff note

After compaction, the conversation loses history but state files persist. The next tool call or prompt that references expedite triggers the skill to re-read state from disk.

### Agent Persistent Memory

**research-synthesizer** (`memory: project`):
- MEMORY.md accumulates patterns: "Evidence from academic sources tends to be stronger than blog posts for validation patterns." "Cross-referencing 3+ independent implementations provides high confidence."
- This memory is loaded at the start of every synthesis task, making the synthesizer incrementally better across lifecycles.
- The developer can inspect `.claude/agent-memory/research-synthesizer/MEMORY.md` to see what the synthesizer has learned.

**gate-verifier** (`memory: project`):
- MEMORY.md accumulates evaluation patterns: "Design documents that cite only one source per decision often have weak evidence support." "Plans with phases larger than 15 tasks tend to have coverage gaps."
- This memory is loaded at the start of every gate evaluation, making the verifier incrementally more critical.
- The developer can inspect and edit this memory — they can correct the verifier's learned heuristics if they disagree.

**DX rationale**: Making agent memory inspectable and editable gives the developer control over the system's learned behavior. If the verifier becomes too strict because of a learned pattern, the developer can edit its MEMORY.md. If the synthesizer has accumulated stale patterns from a different project type, the developer can clear it. The system improves over time but remains under developer control.

### Session Summary Hooks (with SessionStart Fallback)

**Primary path (SessionStart available)**:
1. Stop hook writes session-summary.md
2. SessionStart hook reads session-summary.md and outputs status
3. Developer sees status before typing anything

**Fallback path (SessionStart unavailable)**:
1. Stop hook still writes session-summary.md
2. Each skill's frontmatter includes: `!cat .expedite/session-summary.md 2>/dev/null`
3. When the developer invokes any skill, they see the session summary as part of the skill's context
4. The skill reads checkpoint.yml for deterministic resume regardless of SessionStart

The developer experience is identical in both paths. The summary and checkpoint are on disk either way. The only difference is whether the status appears before or after the developer types a command.

---

## Worktree Isolation

### Execute-Skill Worktree Design

Only the task-implementer agent gets worktree isolation:

```yaml
# .claude/agents/task-implementer.md
---
name: task-implementer
description: "Implements code changes for a single task from the execution plan."
model: sonnet
isolation: worktree
tools:
  - Read
  - Write
  - Edit
  - Bash
  - Glob
  - Grep
maxTurns: 50
permissionMode: acceptEdits
---
```

### Isolation Configuration

When the execute skill dispatches a task-implementer agent:
1. Claude Code automatically creates a worktree for the agent
2. The agent works in isolation — no interference with the main branch
3. If the agent makes no changes: worktree is auto-cleaned
4. If the agent makes changes: worktree path and branch are returned to the execute skill

### Merge-Back Flow

After a task-implementer completes:
1. Execute skill receives the worktree branch name and path
2. Execute skill presents the changes to the developer: "Task 3 complete. Changes on branch `expedite/task-3`. Files modified: src/foo.ts, tests/foo.test.ts. Ready to merge?"
3. Developer reviews (can inspect diff) and confirms
4. Execute skill merges the branch (or the developer merges manually)
5. If merge conflicts exist, the skill reports them and pauses for developer resolution

### Failure Handling

**Agent crash mid-worktree**: The worktree persists on disk. The developer can inspect the partial work in the worktree branch. On resume, the execute skill detects the orphaned worktree and asks: "Found incomplete worktree for task 3. Resume implementation, or discard and restart?"

**Merge conflict**: The execute skill does not auto-resolve conflicts. It reports the conflicting files and pauses. The developer resolves conflicts manually (using their preferred merge tool) and then tells the skill to continue.

**Multiple tasks**: Each task gets its own worktree, so multiple task-implementer agents can run concurrently without interference. The merge-back happens sequentially to avoid cascading conflicts.

---

## Skill-Agent Interaction

### Dispatch Pattern

Skills dispatch agents via the standard Claude Code Agent tool, referencing agents by name:

```
[Skill reads checkpoint.yml to determine current step]
[Skill assembles context for the agent: relevant state, upstream artifacts, task description]
[Skill invokes agent: "Use the web-researcher agent to research DA-4 worktree patterns"]
[Agent executes in its own context with tool restrictions and model assignment from frontmatter]
[Agent produces artifacts and returns summary]
[Skill processes results: updates checkpoint, presents to developer]
```

### Context Passing

Skills pass context to agents through the invocation prompt, not through shared state:
- **Specific task**: "Research question: What worktree isolation patterns exist in the Claude Code ecosystem?"
- **Output location**: "Write evidence to .expedite/evidence/DA-4-worktree-patterns.md"
- **Upstream context**: "The SCOPE.md decision area is: [excerpt]. Focus on: [specific focus]."

This explicit context passing means agents are self-contained. An agent does not need to read state.yml to understand its job — the invoking skill has already extracted the relevant information.

### Result Handling

When an agent returns:
1. Skill reads the agent's summary message
2. Skill verifies the expected artifact(s) exist on disk (file-existence check)
3. Skill updates checkpoint.yml with the completed step
4. Skill presents results to the developer: "Web researcher completed DA-4. Evidence file: .expedite/evidence/DA-4-worktree-patterns.md. 6 sources found."

### Failure Handling

When an agent fails (hits maxTurns, crashes, produces incomplete output):
1. Skill detects the failure from the agent's return (error message, missing artifacts, or maxTurns notification)
2. Skill reports to the developer: "Web researcher for DA-4 did not complete. MaxTurns (30) reached. Partial evidence file exists with 3 of 6 expected sources."
3. Skill offers options: "Retry with more turns? Continue with partial evidence? Skip this question?"
4. Skill does NOT automatically retry — the developer decides

**DX rationale**: Automatic retry can waste tokens and time if the failure is systemic (wrong question, unreachable sources). By surfacing the failure with options, the developer maintains control. If the developer wants automatic retries, they can say so — but the default is informed human judgment.

---

## Migration Sequence

### Increment 1: Hook Infrastructure + State Splitting
**What**: Create hooks/hooks.json with PreToolUse on Write for state.yml validation. Split state.yml into state.yml + checkpoint.yml. Update existing skill frontmatter to load the new files.

**Why first**: This is the foundation. Every subsequent increment depends on hooks existing and state being split. Delivers immediate value: invalid state transitions become impossible.

**Standalone value**: State drift prevention. The developer can no longer accidentally advance phases without gate passage.

**Estimated effort**: Small — shell script for validation, YAML restructuring, frontmatter updates.

### Increment 2: Generalized Checkpoint + Resume
**What**: Implement checkpoint.yml writes in all 6 skills (not just execute). Update resume logic in every skill to read checkpoint.yml directly instead of using artifact-existence heuristics.

**Why second**: Depends on checkpoint.yml existing (Increment 1). Delivers the second-highest-value improvement: deterministic resume.

**Standalone value**: Resume after context reset becomes reliable. The developer trusts the system to pick up where it left off.

**Estimated effort**: Medium — each skill needs checkpoint write logic and resume-from-checkpoint logic.

### Increment 3: Agent Formalization
**What**: Move agent definitions from `skills/{skill}/references/prompt-*.md` to `.claude/agents/*.md` with full frontmatter (tools, model, maxTurns, permissionMode). Skills become thin dispatchers that invoke named agents.

**Why third**: Depends on state splitting (agents need to know which files to read). Does not depend on resume (agents are invoked fresh each time). Delivers tool isolation and model tiering.

**Standalone value**: Agents have bounded capabilities. The developer knows which tools each agent can use. Model costs are optimized.

**Estimated effort**: Medium-large — restructuring 6-10 agents, rewriting skills from thick to thin.

### Increment 4: Structural Gate Enforcement
**What**: Implement deterministic gate checks (G1, G2-structural, G4) in the PreToolUse hook. Split questions.yml, gates.yml, tasks.yml out of state.yml (completing the full state split).

**Why fourth**: Depends on hooks (Increment 1) and state splitting (Increment 1). Benefits from agent formalization (Increment 3) because gate checks reference agent-produced artifacts.

**Standalone value**: 3 of 5 gates become impossible to bypass or rubber-stamp. The developer has certainty that "G1 passed" means specific structural criteria were met.

**Estimated effort**: Medium — shell script logic for each gate's structural checks.

### Increment 5: Semantic Gate Enforcement
**What**: Create gate-verifier and sufficiency-evaluator agents. Implement the dual-layer evaluation flow. Add SubagentStop hook for verifier completeness checking.

**Why fifth**: Depends on agent formalization (Increment 3) and structural gates (Increment 4). The dual-layer pattern layers semantic evaluation on top of already-working structural gates.

**Standalone value**: G3 and G5 gates get rigorous, bias-mitigated evaluation. The developer trusts that design and spike quality has been independently verified.

**Estimated effort**: Medium — two new agents, evaluation prompt engineering, structured output format.

### Increment 6: Context Management + Session Handoff
**What**: Implement PreCompact hook, Stop hook session summaries, SessionStart hook (with fallback). Add persistent memory to research-synthesizer and gate-verifier agents.

**Why sixth**: Depends on checkpoint being reliable (Increment 2) and agents being formalized (Increment 3). This increment polishes the resume and context experience.

**Standalone value**: Context compaction and session transitions become seamless. Agent memory accumulates useful patterns over time.

**Estimated effort**: Small-medium — hook scripts for compaction/session lifecycle, memory configuration in agent frontmatter.

### Increment 7: Worktree Isolation for Execute
**What**: Add `isolation: worktree` to task-implementer agent. Implement merge-back flow in execute skill. Add failure handling for orphaned worktrees.

**Why last**: Depends on agent formalization (Increment 3). Lowest priority because it only affects the execute skill, and execute already works (just without isolation). This increment adds safety, not new capability.

**Standalone value**: Code modifications happen in isolation. The developer can review changes before they touch the main branch.

**Estimated effort**: Small — frontmatter field addition, merge-back orchestration in execute skill.

### Dependency Chain

```
Increment 1 (Hooks + State Split)
    ├── Increment 2 (Checkpoint + Resume)
    │       └── Increment 6 (Context + Session Handoff)
    ├── Increment 3 (Agent Formalization)
    │       ├── Increment 5 (Semantic Gates)
    │       └── Increment 7 (Worktree Isolation)
    └── Increment 4 (Structural Gates)
            └── Increment 5 (Semantic Gates)
```

---

## Developer Experience Moments

### Starting a New Lifecycle

The developer runs `/expedite:scope`. The skill checks state.yml — no active lifecycle. It initializes:
1. Creates `.expedite/state.yml` with `phase: scope_in_progress`
2. Creates `.expedite/checkpoint.yml` with `skill: scope, step: 1, label: "Project context gathering"`
3. Begins the scope conversation

The developer sees: "Starting new expedite lifecycle. Project name?" The harness is invisible — the developer is having a conversation, not configuring a system.

### Hitting a Quality Gate

The developer finishes scope and the skill tries to advance to `scope_complete`. The PreToolUse hook fires:

**If G1 not yet evaluated**: "Cannot advance — G1 gate check required. Running structural validation..."
- Hook reads SCOPE.md and questions.yml
- "G1 structural check: SCOPE.md exists (pass), 12 questions (pass, minimum 3), all DAs covered (pass). G1 passed."
- State advances to scope_complete
- Developer sees: "Scope phase complete. G1 gate passed: 12 questions across all decision areas. Ready for /expedite:research."

**If G1 fails**: "G1 structural check failed: questions.yml has 2 questions (minimum 3), DA-4 has no questions."
- Developer sees specific gaps and can address them
- No ambiguity, no judgment call — concrete criteria not met

### Resuming After Context Reset

The developer returns after a break (new session). SessionStart fires:

"Expedite lifecycle active: MyProject. Phase: research_in_progress. Checkpoint: research/step 7 — Dispatch web researchers. 3 of 5 dispatched. Previous session: completed DA-1, DA-2, DA-3 research. Next: dispatch DA-4 and DA-6 researchers."

The developer types `/expedite:research`. The skill reads checkpoint.yml, skips steps 1-6, and resumes at step 7. It checks which researcher outputs exist, identifies DA-4 and DA-6 as pending, and dispatches only those two.

The developer did not have to explain where they were. The system knew.

### Getting Blocked by a Hook

The developer (or an agent) tries to write an invalid state transition — jumping from scope_in_progress directly to design_in_progress (skipping research).

The PreToolUse hook blocks the write. Claude reports: "I tried to advance to the design phase, but the state write was blocked. The enforcement system says: 'Invalid phase transition: scope_in_progress cannot transition to design_in_progress. Valid transitions from scope_in_progress are: scope_complete (requires G1 gate passage).' We need to complete scope first. Would you like to continue the scope conversation?"

The developer understands:
1. What happened (write was blocked)
2. Why (invalid transition)
3. What the valid options are (complete scope first)
4. What to do next (continue scope)

### Overriding a Gate

The developer decides the scope is good enough and wants to skip the full research phase for a quick exploratory spike.

Developer: "Override G1 and G2, I want to jump to spike. This is an exploratory spike, not a production build."

Skill:
1. Writes G1 override to gates.yml with reason and severity
2. PostToolUse audit hook logs the override
3. Writes G2 override to gates.yml with reason and severity
4. PostToolUse audit hook logs the override
5. Advances state through scope_complete, research_complete, design_complete, plan_complete
6. Each state transition includes the override flag recognized by the PreToolUse hook
7. "Gates overridden. 4 phase transitions completed with overrides logged. Now in spike phase. Note: skipped phases will not have artifacts — spike will work with scope-only context. Ready for /expedite:spike."

The developer sees that overrides happened, what was skipped, and what the implications are. Nothing was silent or hidden.

---

## Risks & Open Questions

### Risk 1: Shell Script Validation Complexity (Moderate Confidence)
The PreToolUse hook validates YAML content using a shell script. Parsing YAML in bash is fragile — edge cases in YAML formatting (multi-line strings, special characters) could cause false positives or false negatives. The script would ideally use a proper YAML parser (e.g., `python -c 'import yaml; ...'` or `node -e 'const yaml = require("js-yaml"); ...'`).

**What testing would validate**: Run the validation script against 20+ real state.yml files from existing lifecycles, including edge cases (empty fields, multi-line values, unicode characters). Measure false positive and false negative rates.

**Mitigation**: Use Node.js scripts (like ECC does) rather than pure bash for YAML-parsing hooks. Node.js is available in all environments where Claude Code runs and has reliable YAML parsing libraries.

### Risk 2: SubagentStop Hook Timing for Gate Evaluation (Low Confidence)
The SubagentStop hook fires after the gate-verifier agent completes. The design assumes this hook can read the verifier's output artifacts (written to disk during execution). If there is a race condition where the hook fires before the agent's final Write is committed to disk, the hook could see stale data.

**What testing would validate**: Create a test agent that writes a file as its last action. Register a SubagentStop hook that reads that file. Verify the hook consistently sees the final file content across 50+ runs.

**Mitigation**: If SubagentStop timing is unreliable, move the verifier completeness check into the gate skill itself (read verifier output after SubagentStop, validate completeness inline). This loses the hook-based enforcement but achieves the same outcome.

### Risk 3: Checkpoint Write Frequency vs. Performance (Moderate Confidence)
Writing checkpoint.yml on every step transition (5-15 times per skill run) adds file I/O. Each write also triggers the PreToolUse hook for validation (~100ms). Total overhead: 0.5-1.5 seconds per skill run. This is likely acceptable but has not been measured.

**What testing would validate**: Measure actual write + hook latency across 100 checkpoint writes. If latency exceeds 200ms per write, consider batching or reducing checkpoint frequency.

### Risk 4: Agent Formalization Transition Period (High Confidence in Risk)
Moving from thick skills (500-860 lines) to thin skills (100-200 lines) + thick agents is a significant restructuring. During the transition, some skills will be in the old pattern and some in the new pattern. If a developer hits a bug during this mixed state, debugging requires understanding both patterns.

**Mitigation**: Increment 3 (agent formalization) should be executed skill-by-skill, with each skill fully transitioned and tested before starting the next. The status skill (simplest, no agents) should not be transitioned — it remains a thin standalone skill.

### Risk 5: Persistent Agent Memory Quality (Low Confidence)
The design gives persistent memory to research-synthesizer and gate-verifier agents. The quality of accumulated memory depends on what the agent chooses to remember. If the agent accumulates noisy or incorrect patterns, memory degrades quality instead of improving it.

**What testing would validate**: Run 5 lifecycles with memory enabled. After each lifecycle, inspect MEMORY.md for accuracy and relevance. Compare synthesis and gate evaluation quality with and without memory across matched lifecycle types.

**Mitigation**: The developer can always inspect and edit agent memory files. A simple "reset memory" action (delete MEMORY.md) provides a clean start if memory becomes counterproductive.

### Risk 6: Hook False Positives Blocking Legitimate Work (Moderate Confidence)
If the PreToolUse validation script has bugs, it could block valid state writes. Unlike prompt-enforcement (which is lenient by default), code-enforcement is strict by default. A bug in the hook affects every state write, not just some.

**What testing would validate**: Build a comprehensive test suite for the validation script covering all valid phase transitions, edge cases, and known-good state.yml files from past lifecycles. Run the test suite on every hook script change.

**Mitigation**: Include a "hook bypass" environment variable (e.g., `EXPEDITE_HOOKS_DISABLED=true`) for emergency use. This is distinct from gate overrides — it disables the enforcement layer entirely, like ECC's runtime profiles. It should only be used for debugging, not normal operation.

### Open Question 1: Where Should Hook Scripts Live?
The design places them in `hooks/` within the plugin. An alternative is `.claude/hooks/` within the project. Plugin hooks apply whenever the plugin is enabled; project hooks apply to the project regardless of plugins. For expedite, plugin hooks are more appropriate (the enforcement is part of the tool, not the project), but this should be validated by testing hook loading behavior.

### Open Question 2: Should gates.yml Be Hook-Validated?
Currently, only state.yml and checkpoint.yml have PreToolUse validation hooks. gates.yml is written by the gate skill without hook validation. If an agent corrupts gates.yml (e.g., writes `outcome: go` without actually running the gate), the state transition hook would see a passing gate that never occurred. Adding a hook on gates.yml writes would close this gap but adds another hook to maintain.

### Open Question 3: Optimal maxTurns Per Agent Type
The design specifies maxTurns per agent (e.g., 30 for web-researcher, 50 for task-implementer) but these values are estimates. Too low and agents are cut off mid-work. Too high and runaway agents waste tokens. These values need calibration from real usage.
