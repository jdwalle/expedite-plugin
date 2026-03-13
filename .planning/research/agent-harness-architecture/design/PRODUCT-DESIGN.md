# Agent Harness Architecture: Product Design

## Overview

This document defines the complete architecture for evolving the expedite Claude Code plugin from a prompt-driven orchestration system into a code-enforced agent harness. It covers nine design domains: the three-layer architecture, hook enforcement, state management, agent formalization, quality gate enforcement, resume and recovery, context and memory, worktree isolation, and skill-agent interaction. It also specifies the incremental migration sequence, developer experience design, and items deliberately deferred.

The architecture was informed by extensive research across 8+ Claude Code plugin harnesses, academic literature on LLM evaluation bias, and analysis of expedite's existing codebase. The research evidence base is documented in `.planning/research/agent-harness-architecture/` and includes harness architecture patterns, hook mechanisms, state persistence patterns, agent team patterns, quality validation patterns, and memory/context patterns. Three independent design proposals (DX lens, Sustainability lens, Evidence lens) were produced, revised against two rounds of validation, and synthesized into this final design.

Five user decisions shaped the design: (1) three-layer separation as the foundational architecture, (2) dual-layer rubric + reasoning for semantic gate enforcement, (3) incremental hardening as the migration strategy, (4) worktree isolation scoped exclusively to the execute skill, and (5) the existing lifecycle pipeline (scope, research, design, plan, spike, execute) is fixed and unchanged.

The design philosophy: This is a personal-tool harness that makes invalid state transitions structurally impossible, makes quality gate bypass auditable and deliberate, and makes resume after context resets deterministic rather than heuristic. It achieves this through the fewest moving parts that solve the three stated pain points (state drift, gate rubber-stamping, resume fragility), using code enforcement where checks are deterministic and LLM judgment only where quality is genuinely semantic.

---

## Decisions Register

| # | Decision | Source | Confidence | Rationale |
|---|----------|--------|------------|-----------|
| 1 | Three-layer architecture: Enforcement + Orchestration + Execution | User | High | User decision. All 3 proposals converge. Observational evidence from claude-code-harness, ECC, claude-agentic-framework. |
| 2 | Dual-layer rubric + reasoning for semantic gates (G3, G5) | User | High | User decision. Matches Phase 24 verifier concept. Academic rubber-stamp evidence supports independent evaluation layers. |
| 3 | Incremental hardening migration, not full rebuild | User | High | User decision. Each increment delivers standalone value. Lower risk than big-bang rewrite. |
| 4 | Worktree isolation for execute skill only | User | High | User decision. Execute is the only skill modifying source code. Other skills write to `.expedite/` directories only. |
| 5 | Lifecycle pipeline is fixed (scope-research-design-plan-spike-execute) | User | High | User constraint C5. The harness hardens how the pipeline executes, not what stages exist. |
| 6 | PreToolUse command hook on Write as the primary enforcement mechanism | Consensus | High | All 3 proposals converge. STRONG evidence from 3 harness implementations and official docs. Single highest-value adoption. |
| 7 | Five-file state split: state.yml, checkpoint.yml, questions.yml, gates.yml, tasks.yml | Consensus | High | All 3 proposals converge on the same files and contents. STRONG evidence from 4+ convergent sources for directory-based state. |
| 8 | YAML format retained for all state files | Consensus | High | All 3 proposals agree. Research finding: "the differentiator is injection strategy, not format." No benefit to switching to JSON. |
| 9 | Structural gates (G1, G4) are fully code-enforced, deterministic | Consensus | High | All 3 proposals agree. STRONG evidence from claude-code-harness rule engine and academic rubber-stamp research. |
| 10 | Checkpoint-based deterministic resume generalized to all skills | Consensus | High | All 3 proposals agree. STRONG evidence from LangGraph and expedite's own execute-skill precedent. |
| 11 | Step-level checkpoint granularity (not sub-step, not phase-level) | Consensus | High | All 3 proposals agree. LangGraph per-node maps to per-step. Sub-step adds complexity without proportional benefit. |
| 12 | Subagent hub-and-spoke coordination (not Agent Teams) | Consensus | High | All 3 proposals agree. Pipeline architecture fits hub-and-spoke. Agent Teams deferred (3-4x token cost, collaborative features unnecessary). |
| 13 | Model tiering: Sonnet default, Opus for synthesis/verification | Consensus | High | All 3 proposals agree. STRONG convergent signal from 4 independent implementations. |
| 14 | Override mechanism preserves user agency with audit trail | Consensus | Medium | All 3 proposals agree on the principle. The specific mechanism (override record in gates.yml recognized by PreToolUse hook) is a design invention requiring implementation validation. |
| 15 | Node.js for all hook scripts | Resolved | High | P2 proposed, P1 and P3 conceded after validation. Cross-platform, testable, no build step, reliable YAML parsing via js-yaml. Shell YAML parsing is too fragile for enforcement. |
| 16 | Start with 4 hooks: PreToolUse, PostToolUse, PreCompact, Stop | Resolved | High | P2's minimal-first approach, expanded to include PostToolUse for audit trail (low cost, high traceability). SessionStart and SubagentStop deferred. |
| 17 | SessionStart hook deferred until platform bugs confirmed fixed | Resolved | Medium-High | User constraint C4. Frontmatter injection is the primary context-loading mechanism. SessionStart is a future low-risk enhancement, not a dependency. |
| 18 | Agent persistent memory: experimental for synthesizer and verifier only | Resolved | Low-Medium | Evidence is WEAK (official docs only). Selective enablement for 2 highest-value agents. No feature depends on memory. Explicit evaluation criteria after 3 lifecycles. |
| 19 | G2 (Research) classified as structural + light semantic | Resolved | Medium-High | P1 and P3 agree; P2 conceded. Readiness assessment quality ("sufficient" vs. "inadequate" evidence) involves judgment beyond field-existence checking. Lightweight verifier check adds modest cost. |
| 20 | Bundle state split + PreToolUse hook as first migration phase | Resolved | High | P1 proposed, P3 conceded. State splitting without hook validation creates an unprotected window for corrupted writes. The two are co-dependent in practice. |
| 21 | Only skills write checkpoint.yml (not agents, not hooks) | Resolved | High | P1 and P3 proposed; P2 conceded. Maintains three-layer separation. The Stop hook lacks context to determine current step. Agents writing checkpoints would blur the execution/orchestration boundary. |
| 22 | Stop hook writes session-summary.md only | Resolved | High | P1 and P3 proposed; P2 conceded. The checkpoint (machine-readable resume state) and session summary (LLM-readable orientation) serve different consumers and should be written by different actors. |
| 23 | gates.yml writes are hook-validated to prevent fabrication | Resolved | Medium | Identified by Validation 1 as Critical Issue 3. Without validation, an agent could write a fake gate result and bypass enforcement. PreToolUse validation closes this gap. Design invention. |
| 24 | Agents live in the plugin's `agents/` directory | Resolved | High | P2 proposed. Agents co-locate with plugin code and are distributed together. Project-level `.claude/agents/` overrides take precedence per official priority ordering. |
| 25 | `EnterWorktree` in disallowedTools for all non-execute agents | Resolved | High | P3 proposed. Prevents accidental worktree creation, a known Claude Code behavior. One denylist entry per agent, negligible maintenance cost. |
| 26 | Use disallowedTools (denylist) for broad-access agents, tools (allowlist) for restricted agents | Resolved | High | P2 proposed. More maintainable as Claude Code adds new tools -- denylist agents automatically get new capabilities. Allowlist only for tightly restricted agents like gate-verifier. |
| 27 | 8-10 formalized agents (not 11+) | Resolved | Medium | P3 proposed 8, P1 proposed 10 (with scope-facilitator and research-planner). The exact count depends on whether scope and research planning warrant distinct agents or remain skill-level logic. Both approaches are viable. |
| 28 | Artifact validation hooks deferred to future increment | Resolved | Medium | P3 proposed as lower priority. Extending PreToolUse to validate artifact structure (SCOPE.md, SYNTHESIS.md) is architecturally sound but no repo demonstrates it. Validate the pattern on one artifact first. |

---

## Three-Layer Architecture

### Layer 1: Enforcement (Hooks + Scripts)

The enforcement layer prevents invalid operations. It is a hard boundary that neither skills nor agents can bypass. Hooks and Node.js scripts answer one question: "Is this operation allowed right now?"

**What lives here:**
- `hooks/hooks.json` -- Hook event registrations (4 hooks initially)
- `hooks/validate-state-write.js` -- PreToolUse command hook for state.yml, checkpoint.yml, and gates.yml writes (FSM transitions, schema validation, gate passage enforcement)
- `hooks/audit-override.js` -- PostToolUse command hook (append-only audit trail for gate overrides and state changes)
- `hooks/pre-compact-save.js` -- PreCompact command hook (checkpoint backup + session summary before compaction)
- `hooks/session-stop.js` -- Stop command hook (session summary persistence for session handoff)
- `hooks/lib/state-schema.js` -- YAML schema definitions and validators
- `hooks/lib/fsm.js` -- Finite state machine transition rules (lookup table)
- `hooks/lib/gate-checks.js` -- Structural gate validation functions (G1, G2-structural, G4)

**How the developer experiences it:** This layer is invisible during normal operation. The developer never thinks about hooks. When enforcement intervenes, a clear denial message appears: "State write blocked: cannot transition from scope_in_progress to research_in_progress without G1 gate passage. Run /expedite:gate to evaluate." The developer always knows what happened, why, and what to do next.

**Maintenance burden:** Low. The FSM is a lookup table. Schema validators are declarative JavaScript functions (20-40 lines each). Hooks are thin dispatchers to lib functions. Single dependency: js-yaml. No build step. When a new skill is added, only the FSM table needs updating. When a gate criterion changes, only the relevant function in gate-checks.js needs updating.

**Token cost:** Zero. Command hooks execute outside the LLM context. Every check moved from prompt to hook saves tokens on every invocation.

### Layer 2: Orchestration (Thin Skills)

The orchestration layer manages the developer conversation, determines what to do next, dispatches agents, and presents results. Skills are the user-facing surface. They answer: "What should happen next?"

**What lives here:**
- `skills/{name}/SKILL.md` -- Step sequencer (target: 100-200 lines each, down from 500-860)
- Frontmatter with scoped state injection (only loads relevant state files)
- Step definitions: what to do, which agent to dispatch, what context to pass
- User interaction points (questions, confirmations, override requests)
- Recovery preamble that reads checkpoint state for resume
- Checkpoint writes at each step boundary

**How the developer experiences it:** The developer interacts only with skills via `/expedite:scope`, `/expedite:research`, etc. Skills are short enough to understand in one reading. Skills do not contain business logic -- they read checkpoint, determine the resume point, and dispatch the appropriate agent. The developer's mental model is: "skills route, agents work."

**Maintenance burden:** Low. Skills become declarative step sequences. Logic currently in skills (validation, gate evaluation, state management) moves to the enforcement layer and agents. The 500-line soft cap becomes naturally achievable.

**Token cost:** Moderate. At 100-200 lines, each skill costs approximately 1,000-2,000 tokens. Scoped state injection reduces state injection cost by an estimated 60-80% compared to monolithic state loading.

### Layer 3: Execution (Thick Agents)

The execution layer does the actual work. Agents are autonomous workers with rich frontmatter. They answer: "How should this specific task be done?"

**What lives here:**
- `agents/{name}.md` -- Formal agent definitions with full Claude Code subagent frontmatter
- Agent body contains detailed instructions, rubrics, and output format specifications (content currently in `skills/{skill}/references/prompt-*.md`)
- Agent frontmatter specifies model tier, tool restrictions, memory (for select agents), and isolation (for execute agents)

**How the developer experiences it:** Agents are like team members. The developer knows they exist and what they specialize in but does not micro-manage them. When an agent runs, the developer sees progress. When an agent finishes, the skill presents results. Each agent's definition is self-contained and independently readable.

**Maintenance burden:** Moderate. Agents are the largest files in the system, replacing current prompt templates. However, each agent is self-contained and independently modifiable. Changes to one agent cannot break another. The formal frontmatter schema provides structure.

### Information Flow Between Layers

```
Developer -> Skill (Layer 2) -> reads checkpoint.yml -> dispatches Agent (Layer 3)
                                                             |
                                                      Agent produces artifacts
                                                             |
                                                      Agent returns summary to skill
                                                             |
                                                      Skill writes to state files
                                                             |
                                                   Hook (Layer 1) validates the write
                                                       |              |
                                                    ALLOW           DENY + reason
                                                       |              |
                                               Write succeeds    Skill sees denial,
                                                                 adjusts and retries
```

**Key architectural invariant:** Agents never bypass enforcement, and agents never write state directly. Agents produce artifacts. Skills update state after processing agent results. Every Write to a state file passes through the PreToolUse hook regardless of which skill initiated it. This is structural -- agents cannot write invalid state because agents do not write state at all, and skills cannot write invalid state because the hook intercepts the tool call before execution.

### Layer Boundaries

- Enforcement NEVER dispatches agents. It only allows or denies writes.
- Enforcement NEVER modifies state. It only gates whether modification is permitted.
- Orchestration NEVER evaluates quality. That is enforcement's job (structural gates) or execution's job (semantic verification via the gate-verifier agent).
- Execution NEVER writes to state files (state.yml, checkpoint.yml, gates.yml). Agents produce artifacts; skills manage state.
- Execution NEVER manages phase transitions. That is orchestration + enforcement together.

**Critical platform assumption — CONFIRMED (2026-03-12):** PreToolUse hooks fire on subagent-initiated Write calls. This was empirically validated by deploying a PreToolUse hook (in project settings) that logged Write interceptions, then dispatching a test subagent that wrote a file. The hook intercepted the subagent's write. The "agents never bypass enforcement" invariant holds.

**Implementation note:** During validation, hooks registered in plugin `hooks/hooks.json` did NOT load because the expedite plugin is not in `enabledPlugins`. Hooks in `.claude/settings.json` (project settings) loaded and fired correctly. For M1, register hooks in BOTH locations (project settings and plugin hooks.json). Project settings provide immediate enforcement; plugin hooks.json ensures enforcement survives plugin registration. Once the plugin is formally registered in `enabledPlugins`, remove the project settings hooks and validate that plugin-level hooks fire correctly on their own.

Evidence trail: round-3 architectural inference (60%→80%), official Claude Code docs (→90%), empirical test (→100%).

---

## Hook Architecture

### Hook Registry

All hooks are registered in `hooks/hooks.json` within the plugin. All use the command handler type (Node.js scripts, no LLM calls, no network calls, no build step).

| Hook Event | Handler Type | Matcher | Purpose | Blocking? |
|-----------|-------------|---------|---------|-----------|
| PreToolUse | command | `Write` | Validate state.yml, checkpoint.yml, and gates.yml writes (FSM, schema, gate passage) | Yes (exit 2 denies) |
| PostToolUse | command | `Write` | Audit trail for gate overrides and state changes | No |
| PreCompact | command | -- | Flush checkpoint backup + write session summary before compaction | No |
| Stop | command | -- | Write session summary for next session handoff | No |

**Deferred hooks** (add when justified by observed need or platform stabilization):
- `SessionStart` -- Context loading on session resume. Deferred per constraint C4 until platform bugs (#16538, #13650, #11509) are confirmed fixed. When reliable, adding SessionStart is a small enhancement: load checkpoint.yml, report resume status, orient the session. No fallback pattern is pre-built because frontmatter injection already provides functionally equivalent context loading.
- `SubagentStop` -- Agent output validation. Deferred because no repo demonstrates this pattern. Skill-level verification after agent return is simpler and has no evidence disadvantage.

### State Write Validation (PreToolUse on Write)

The Write matcher intercepts ALL Write tool calls. The script inspects `tool_input.file_path` and performs validation only when the target is an `.expedite/` state file. Non-state writes pass through immediately (exit 0).

**For state.yml writes:**
1. Parse the proposed YAML content from stdin JSON (`tool_input.content`)
2. Read the current state.yml from disk for comparison
3. Validate required fields are present (project_name, lifecycle_id, phase, version)
4. Validate the phase transition against the FSM allowed-transitions table:
   - `not_started` may transition to `scope_in_progress`
   - `scope_in_progress` may transition to `scope_complete` (requires G1 passage in gates.yml)
   - `scope_complete` may transition to `research_in_progress`
   - (and so on for all lifecycle phases)
5. If transitioning to a `_complete` phase, read gates.yml and verify a passing gate result exists
6. If gate result shows `overridden: true`, allow transition (override is a valid passage type)
7. If invalid: exit 2 with JSON `{"permissionDecision": "deny", "permissionDecisionReason": "..."}`
8. If valid: exit 0

**For checkpoint.yml writes:**
1. Parse the proposed YAML content
2. Validate that `skill`, `step`, and `label` fields are present
3. Validate that `step` is a positive integer or the string "complete"
4. If the step number is decreasing (regression): allow if `inputs_hash` differs from the current checkpoint's recorded hash (indicating changed inputs justify re-execution); deny otherwise

**For gates.yml writes:**
1. Parse the proposed YAML content
2. Validate that gate entries have the expected structure (gate identifier, timestamp, outcome, evaluator)
3. Validate that the gate identifier matches a valid gate for the current phase (cannot write a G3 result during scope phase)
4. Validate that the `outcome` field uses a recognized value (go, no-go, go-with-advisory, overridden)
5. If outcome is "overridden", validate that `override_reason` is present

**For questions.yml and tasks.yml:** Validate schema on write (required fields present, valid enum values). These files are not as tightly controlled as state.yml and gates.yml but benefit from structural validation.

### Phase Transition Guards

Phase transitions are enforced by the PreToolUse hook's FSM validation. The FSM is a lookup table of valid transitions:

| From Phase | To Phase | Required Gate |
|-----------|---------|---------------|
| not_started | scope_in_progress | -- |
| scope_in_progress | scope_complete | G1 |
| scope_complete | research_in_progress | -- |
| research_in_progress | research_complete | G2 |
| research_complete | design_in_progress | -- |
| design_in_progress | design_complete | G3 |
| design_complete | plan_in_progress | -- |
| plan_in_progress | plan_complete | G4 |
| plan_complete | spike_in_progress | -- |
| spike_in_progress | spike_complete | G5 |
| spike_complete | execute_in_progress | -- |
| execute_in_progress | execute_complete | -- |

Any transition not in this table is denied. The gate column indicates which gate must have a passing result in gates.yml before the transition is allowed.

### Gate Enforcement Integration

When the PreToolUse hook detects a phase transition to a `_complete` state:
1. It reads gates.yml from disk
2. It checks for a gate entry matching the required gate for this transition
3. The entry must have `outcome: "go"` or `outcome: "go-with-advisory"` or `outcome: "overridden"`
4. If no qualifying entry exists, the write is denied with a specific message: "Cannot advance to {phase} -- {gate} has not passed. Complete gate evaluation before advancing."

This makes gate bypass structurally impossible. Even if skill instructions are ignored (prompt-enforcement failure), the hook prevents the state write.

### Error Messaging

When a hook blocks an operation, the developer sees a human-readable explanation relayed by Claude through the `permissionDecisionReason` field. Examples:

- "State write blocked: cannot transition from scope_in_progress to research_in_progress -- G1 gate has not passed. Current gate status: no G1 entry in gates.yml. Run /expedite:gate to evaluate scope completeness."
- "Checkpoint write blocked: step regression from 7 to 5 is not allowed when inputs_hash has not changed. If inputs have changed, re-compute the hash."
- "Gate write blocked: cannot write a G3 result during scope phase. Current phase: scope_in_progress."

The developer never sees raw exit codes or cryptic errors. The denial is specific, actionable, and explains what to do next.

### Override Mechanism

**Design invention note:** The override + code-enforced gate interaction (writing an override record to gates.yml that the PreToolUse hook recognizes) is not demonstrated by any surveyed source. It is a reasonable design extrapolation that must be validated during the structural gate implementation phase.

When a hook blocks a state write, the developer has two paths:

1. **Address the issue:** Run the required gate, complete the missing step, or fix the validation error. This is the expected path.
2. **Override:** The developer explicitly tells the skill to override the gate (e.g., "override G1, reason: scope is sufficient for this exploratory spike"). The flow:
   a. Skill writes a gate entry to gates.yml with `outcome: overridden`, `override_reason: <user's reason>`, `severity: <low/medium/high>`, and `timestamp`
   b. The PreToolUse hook on gates.yml validates the override structure (reason must be present, valid gate ID, valid severity)
   c. The PostToolUse audit hook logs the override to `.expedite/audit.log` (append-only)
   d. Skill retries the state write -- the PreToolUse hook on state.yml sees the overridden gate entry and allows the transition

Overrides are never silent. They produce gate_history records in gates.yml, audit entries in audit.log, and explicit confirmation to the developer. The developer can always trace why a phase was advanced.

**Emergency bypass:** If the hook itself is buggy (blocking valid writes), the developer can temporarily disable enforcement via plugin settings or an environment variable (`EXPEDITE_HOOKS_DISABLED=true`). This is distinct from gate overrides -- it disables enforcement entirely for debugging only.

### Latency Budget

| Hook | Expected Latency | Frequency | UX Impact |
|------|-----------------|-----------|-----------|
| PreToolUse (state/checkpoint/gates) | ~100-200ms | Every state/checkpoint/gates write (5-15 per skill run) | Imperceptible |
| PostToolUse (audit) | ~50ms | Only on gate override writes (rare) | None |
| PreCompact | ~100-200ms | 0-2 times per long session | None (pre-compaction moment) |
| Stop | ~100-200ms | Once per session end | None (post-response) |

Total hook-induced latency during normal operation: less than 1-2 seconds per skill run, spread across 5-15 state writes. All hooks are command type (Node.js startup + YAML parsing), no LLM calls. The developer does not perceive lag from enforcement.

**Latency evidence quality:** WEAK (qualitative only, no benchmarks). Hook latency should be measured during Phase 1 implementation to validate these estimates.

### SessionStart Fallback

SessionStart is deferred per constraint C4. The system handles its unavailability through frontmatter injection as the primary context-loading mechanism:

- Each skill's frontmatter includes `!cat .expedite/state.yml`, `!cat .expedite/checkpoint.yml`, and `!cat .expedite/session-summary.md` (plus skill-specific state files)
- When the developer invokes any skill, state is loaded immediately via frontmatter
- The DX difference between frontmatter injection and SessionStart is minor: the developer sees context on first skill invocation rather than at session open (a 2-second timing difference)

When SessionStart bugs are confirmed fixed, adding the hook is a small, low-risk enhancement that provides slightly more elegant context loading. No fallback pattern is pre-built because frontmatter injection is the permanent primary mechanism.

---

## State Management Architecture

### File Structure

```
.expedite/
+-- state.yml           # Lifecycle identity and phase (core -- always loaded)
+-- checkpoint.yml      # Step-level tracking and resume data (core -- always loaded)
+-- questions.yml       # Research questions and refinement history (loaded by scope/research)
+-- gates.yml           # Gate evaluation history and overrides (loaded by gate/status, hook-validated)
+-- tasks.yml           # Execution task list and completion tracking (loaded by execute)
+-- session-summary.md  # Last session's handoff notes (loaded by frontmatter)
+-- audit.log           # Append-only override audit trail (never loaded into LLM context)
+-- evidence/           # Research artifacts (loaded on demand by agents)
```

### State Schema

**state.yml** (~15 lines, always loaded):
```yaml
version: 1
lifecycle_id: "lifecycle-2026-03-12-myproject"
project_name: "MyProject"
phase: "research_in_progress"
started_at: "2026-03-12T10:00:00Z"
phase_started_at: "2026-03-12T11:30:00Z"
```
- `version`: Schema version for migration logic
- `lifecycle_id`: Unique identifier for this lifecycle instance
- `project_name`: Human-readable project name
- `phase`: Current lifecycle phase (valid values defined by FSM)
- `started_at`, `phase_started_at`: Timestamps for lifecycle and current phase

This file changes only on phase transitions (roughly 6 times per lifecycle). Small enough to inject into every skill.

**checkpoint.yml** (~10-20 lines, always loaded):
```yaml
skill: research
step: 7
label: "Dispatch web researchers"
substep: "waiting_for_agents"
continuation_notes: "3 of 5 web researchers dispatched. Remaining: DA-4, DA-6."
inputs_hash: "sha256:a3f2b1c..."
updated_at: "2026-03-12T12:45:00Z"
```
- `skill`: Which skill wrote this checkpoint
- `step`: Current step number (positive integer or "complete")
- `label`: Human-readable step description
- `substep`: Optional sub-state within a step
- `continuation_notes`: Context for mid-step recovery
- `inputs_hash`: Hash of step inputs for idempotency
- `updated_at`: Timestamp of last checkpoint write

This file changes on every step transition. It is the primary resume mechanism. **Written only by skills at step boundaries, never by agents or hooks.**

**questions.yml** (variable size, loaded by scope and research skills):
Each entry has: `id`, `text`, `category`, `status` (enum: open, answered, deferred), `priority`, `depth`. Contains research questions generated during scope and their refinement history.

**gates.yml** (variable size, loaded by gate and status skills, hook-validated):
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
    semantic_evaluation:
      verifier_agent: "gate-verifier"
      reasoning_score: 0.85
      advisory: "DA-2 evidence is adequate but not strong"
    evaluator: "dual-layer"
```
Each entry must have: `gate` (enum: G1-G5), `timestamp`, `outcome` (enum: go, no-go, go-with-advisory, overridden). If outcome is "overridden", `override_reason` is required.

**tasks.yml** (variable size, loaded by execute skill only):
Each entry has: `id`, `title`, `status` (enum: pending, in_progress, complete, blocked), `phase`, `assigned_agent`. Contains the phased execution task list.

**session-summary.md** (~10-20 lines):
LLM-readable narrative written by the Stop hook at session end. Contains: current phase and skill, current step, what was accomplished this session, recommended next action. This is distinct from checkpoint.yml: the session summary is for LLM orientation; the checkpoint is for deterministic resume.

**audit.log** (append-only, never loaded into LLM context):
Written by the PostToolUse audit hook. Records override events and significant state changes with timestamps. The developer can review this file for traceability.

### Write Patterns

| File | Written By | Hook Validated | Pattern |
|------|-----------|---------------|---------|
| state.yml | Skills only | Yes (FSM, schema, gate passage) | Complete-file rewrite |
| checkpoint.yml | Skills at step boundaries only | Yes (schema, step regression) | Complete-file rewrite |
| gates.yml | Gate skill, gate evaluation scripts | Yes (structure, phase-gate match, outcome enum) | Complete-file rewrite |
| questions.yml | Scope and research skills | Yes (schema) | Complete-file rewrite |
| tasks.yml | Plan and execute skills | Yes (schema) | Complete-file rewrite |
| session-summary.md | Stop hook | No (markdown, not YAML) | Overwrite each session |
| audit.log | PostToolUse audit hook | No (append-only trail) | Append |

### Consumption Patterns

| Consumer | state.yml | checkpoint.yml | questions.yml | gates.yml | tasks.yml | session-summary.md |
|----------|-----------|---------------|---------------|-----------|-----------|-------------------|
| All skills | Frontmatter | Frontmatter | -- | -- | -- | Frontmatter |
| Scope skill | Frontmatter | Frontmatter | Frontmatter | -- | -- | Frontmatter |
| Research skill | Frontmatter | Frontmatter | Frontmatter | -- | -- | Frontmatter |
| Design skill | Frontmatter | Frontmatter | Frontmatter | -- | -- | Frontmatter |
| Plan skill | Frontmatter | Frontmatter | Frontmatter | -- | -- | Frontmatter |
| Spike skill | Frontmatter | Frontmatter | Frontmatter | -- | -- | Frontmatter |
| Execute skill | Frontmatter | Frontmatter | -- | -- | Frontmatter | Frontmatter |
| Gate skill | Frontmatter | Frontmatter | -- | Frontmatter | -- | -- |
| Status skill | Frontmatter | Frontmatter | On-demand | Frontmatter | On-demand | -- |
| PreToolUse hook | Reads from disk | Reads from disk | -- | Reads from disk | -- | -- |

Each skill's frontmatter injects only the files in its row. This is the scoped injection pattern that eliminates token waste.

### Schema Evolution

**Adding a field to a state file:**
1. Add the field to the schema in `state-schema.js` with a default value
2. Make the field optional in validation (backward compatible)
3. Skills that produce the field start writing it
4. Skills that consume the field start reading it
5. After all skills are updated, optionally make the field required

**Adding a new state file:**
1. Create the schema definition
2. Add the file path to the PreToolUse hook's known-state-files list
3. Add frontmatter injection to consuming skills
4. Deploy

Neither operation requires changing existing state files or migrating data. New concerns get new files.

### Token Budget

| State Config | Estimated Tokens per Skill Invocation |
|--------------|---------------------------------------|
| Current (full state.yml, growing) | 500-2,000+ tokens (grows with lifecycle) |
| Proposed (scoped injection) | 100-400 tokens (fixed per skill, does not grow) |

Savings: 60-80% reduction in state injection tokens. Over a full lifecycle (6+ skill invocations, many with multiple steps), this compounds to thousands of saved tokens.

### State Debugging

State is plain YAML files in `.expedite/`. Debugging is:
1. Read the file directly (`cat .expedite/state.yml`)
2. Check the checkpoint (`cat .expedite/checkpoint.yml`)
3. Validate manually (`node hooks/validate-state-write.js < test-input.json`)
4. Check hook errors (`cat .expedite/hook-errors.log`)

No database to query, no event log to replay, no checkpoint store to inspect. Four commands, no special tools.

---

## Agent Formalization

### Agent Definition Format

Every agent is a Markdown file in the plugin's `agents/` directory with YAML frontmatter following the official Claude Code subagent schema:

```yaml
---
name: web-researcher
description: "Researches a specific question using web search. Produces structured evidence in YAML format."
model: sonnet
disallowedTools:
  - Bash
  - Edit
  - EnterWorktree
maxTurns: 30
permissionMode: acceptEdits
---

# Web Researcher Agent

[Agent instructions, rubrics, output format -- content currently in prompt-web-researcher.md]
```

**Required fields** (every agent must have):
- `name`: unique identifier, lowercase-hyphenated
- `description`: when to delegate to this agent (used for dispatch clarity)
- `model`: explicit model tier assignment

**Recommended fields** (include when the default is wrong):
- `tools` or `disallowedTools`: tool restrictions for safety
- `maxTurns`: prevent runaway agents

**Selective fields** (use for specific agents only):
- `memory: project`: for research-synthesizer and gate-verifier only (experimental)
- `isolation: worktree`: for execute agents only

**Required constraint:**
- `permissionMode`: MUST remain `default` for all agents. Never use `bypassPermissions` — it disables all safety prompts including filesystem and destructive operation checks. The default mode is the primary defense against agents performing destructive actions outside the project scope.

**Deferred fields** (do not use initially):
- `hooks`: per-agent hooks (redundant with plugin-level hooks initially)
- `skills`: subagent skill loading (not needed for expedite's dispatch pattern)
- `mcpServers`: MCP server restrictions (not relevant currently)

### Agent Catalog

| Agent | Model | Restriction Type | Key Restrictions | Memory | Isolation | Role |
|-------|-------|-----------------|-----------------|--------|-----------|------|
| web-researcher | Sonnet | disallowedTools | Bash, Edit, EnterWorktree | none | none | Web research per question |
| codebase-researcher | Sonnet | disallowedTools | Write, Edit, WebSearch, WebFetch, EnterWorktree | none | none | Codebase analysis per question |
| research-synthesizer | Opus | disallowedTools | Bash, WebSearch, WebFetch, EnterWorktree | project (experimental) | none | Synthesize evidence across questions |
| design-architect | Opus | disallowedTools | Bash, WebSearch, WebFetch, EnterWorktree | none | none | Produce design documents |
| plan-decomposer | Sonnet | disallowedTools | Bash, WebSearch, WebFetch, EnterWorktree | none | none | Break design into phases |
| spike-researcher | Sonnet | disallowedTools | Bash, EnterWorktree | none | none | Resolve tactical decisions |
| task-implementer | Sonnet | disallowedTools | WebSearch, WebFetch | none | worktree | Implement code changes |
| gate-verifier | Opus | tools (allowlist) | Read, Glob, Grep | project (experimental) | none | Semantic quality evaluation (read-only) |

Additional agents that may be warranted (design-time decision):
- `scope-facilitator` (Sonnet) -- Conducts scope conversation with Socratic questioning style. Justified if the scope skill's conversational logic would push it beyond 200 lines.
- `research-planner` (Sonnet) -- Generates research questions. Justified if question generation logic is complex enough to warrant a dedicated agent rather than skill-level logic.

The exact agent count (8-10) is a design-time decision based on whether scope facilitation and research planning require distinct agents or can remain as skill-level logic. Both approaches maintain clean layer separation.

### Model Tiering Strategy

| Tier | Model | Agents | Rationale |
|------|-------|--------|-----------|
| Premium | Opus | research-synthesizer, design-architect, gate-verifier | Tasks requiring deep reasoning, cross-referencing, and quality judgment |
| Balanced | Sonnet | web-researcher, codebase-researcher, plan-decomposer, spike-researcher, task-implementer | Tasks requiring competent execution within clear parameters |
| Fast | Haiku | (Reserved for future: quick lookups, file existence checks) | Not currently used; available for future optimization |

**Cost optimization rule:** An agent should use Sonnet unless there is a specific reason it needs Opus. The default is the balanced tier. Upgrading to Opus requires justification (e.g., "this agent's output directly passes a quality gate" or "this agent synthesizes across multiple evidence sources").

### Per-Agent Hooks and Memory

**Agent persistent memory** is an experimental adoption for two agents:

- **research-synthesizer** (`memory: project`): May learn which evidence patterns are most useful across lifecycles. Its MEMORY.md would accumulate synthesis notes. The developer can inspect `.claude/agent-memory/research-synthesizer/MEMORY.md`.
- **gate-verifier** (`memory: project`): May learn common failure patterns across gate evaluations. The developer can inspect and edit this memory to correct the verifier's learned heuristics.

**Experimental criteria for retention:** After 3 lifecycles with memory enabled, inspect MEMORY.md for accuracy and relevance. Compare synthesis/gate evaluation quality between lifecycles 1 and 3. If memory content is noisy, stale, or counterproductive, clear it or disable the feature. No feature depends on memory working -- the system functions identically without it.

**Evidence:** WEAK (official docs only, no repo demonstrates per-agent persistent memory in a pipeline architecture). This is a low-cost, bounded experiment, not an evidenced adoption.

**Per-agent hooks:** Deferred. Plugin-level hooks provide sufficient enforcement initially. Per-agent hooks (scoped to individual subagents) can be added later if specific agents need custom enforcement. The official Claude Code sub-agents docs confirm that per-agent frontmatter hooks "only run while that specific subagent is active and are cleaned up when it finishes" — they are additive to plugin-level hooks, not replacements. Plugin-level enforcement remains active while subagents run. This additive model also strengthens the fallback design: if plugin-level hooks somehow did not fire on subagent writes, per-agent hooks would layer enforcement on top of whatever baseline exists.

### Agent Lifecycle

1. **Dispatch:** Skill invokes agent via the Agent tool, passing the agent name and a context-assembled prompt
2. **Execution:** Agent runs with its frontmatter-specified model, tools, and turn limit
3. **Completion:** Agent writes artifacts to disk, returns summary to the skill
4. **Cleanup:** No cleanup needed for non-worktree agents. For worktree agents (execute only), auto-cleanup handles no-change worktrees; changed worktrees return path and branch for merge

No inter-agent communication during execution. All coordination is through artifacts on disk, mediated by the orchestrating skill. This is simpler to maintain and debug than any message-passing system.

---

## Quality Gate Enforcement

### Gate Inventory

| Gate | Phase Transition | Type | What It Checks | Enforcement |
|------|-----------------|------|----------------|-------------|
| G1 (Scope) | scope_complete | Structural | SCOPE.md exists, has required sections, 3+ decision areas, research categories assigned | Code-enforced (deterministic Node.js script) |
| G2 (Research) | research_complete | Structural + Light Semantic | Research synthesis exists, all categories have findings, readiness criteria met, readiness assessment quality defensible | Structural: code-enforced. Semantic: lightweight verifier agent check on readiness assessment quality. |
| G3 (Design) | design_complete | Semantic | Design covers all DAs, decisions are evidence-backed, internally consistent, reasoning is sound | Dual-layer: structural rubric (code) + reasoning verifier (separate agent) |
| G4 (Plan) | plan_complete | Structural | Plan exists, phases cover all design decisions, tasks are uniform-sized, dependency ordering valid | Code-enforced (deterministic Node.js script) |
| G5 (Spike) | spike_complete | Semantic | Spike resolves all decisions, implementation steps are actionable, evidence supports approach | Dual-layer: structural rubric (code) + reasoning verifier (separate agent) |

### Structural Gates (G1, G2-structural, G4): Deterministic Validation

Structural gate checks are Node.js functions in `hooks/lib/gate-checks.js`. Each gate function:
1. Reads the relevant artifact(s) from disk
2. Checks structural requirements (file exists, required sections present, counts meet thresholds)
3. Returns `{passed: boolean, checks: [{criterion, passed, detail}]}`

**G1 (Scope Completeness):**
- SCOPE.md exists and is not empty
- SCOPE.md contains required sections (Context, Constraints, Decision Areas, Success Criteria)
- questions.yml exists with at least 3 questions
- Every decision area referenced in SCOPE.md has at least one question in questions.yml
- All questions have `priority` and `depth` fields

**G4 (Plan Completeness):**
- Plan file exists with phase decomposition
- Each phase has: title, description, scope, success criteria, and estimated effort
- Phase count is between 2 and 20 (sanity bounds)
- Every design decision maps to at least one plan phase
- Total tasks across phases is at least 5

These checks produce identical results every time for the same inputs. No LLM judgment involved. Token cost: zero.

**Developer experience with structural gates:** The developer runs `/expedite:gate` or the skill attempts a phase transition. If structural checks fail, a specific, actionable message appears instantly: "G1 structural check failed: questions.yml has 2 questions (minimum 3). DA-4 has no questions. Add questions for DA-4 to pass G1." There is no ambiguity -- the developer knows exactly what to fix.

### Semantic Gates (G3, G5): Dual-Layer Evaluation

**Layer 1 -- Structural rubric (code-enforced):**

For G3 (Design):
- DESIGN.md exists with all required sections
- Every decision area from SCOPE.md has a corresponding section
- Each decision section references evidence (at least one citation or evidence file reference)
- Word count per section exceeds minimum threshold

For G5 (Spike):
- Each spike output file exists for every phase that required spiking
- Each spike file contains: decision, rationale, implementation steps, and validation criteria
- Implementation steps count is at least 3

**Layer 2 -- Reasoning verification (verifier agent):**

The gate skill dispatches the gate-verifier agent (Opus, read-only tools, experimental persistent memory) with:
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

The two layers run independently. Both must pass. The structural layer runs first (fast, free). If structural fails, the semantic layer does not run. If structural passes, the semantic layer provides the deeper evaluation.

After the verifier agent returns, the gate skill validates evaluation completeness inline:
- All rubric dimensions scored
- Reasoning notes provided for each dimension
- Overall outcome is one of the recognized values
- If incomplete (e.g., verifier hit maxTurns before finishing), the gate skill reports the incomplete evaluation and offers to re-run

### G2 (Research): Structural + Light Semantic

G2 has a lighter semantic component than G3/G5:

**Structural component (code-enforced):**
- Research synthesis file exists
- All category files referenced in SCOPE.md exist
- Each decision area has a corresponding section in the synthesis
- READINESS.md exists with per-DA status fields
- No decision area has status "INSUFFICIENT"

**Light semantic component (verifier agent):**
- Readiness assessment quality: are the evidence sufficiency ratings ("strong", "adequate", "insufficient") justified by the evidence actually cited?
- This is a focused check on one dimension (evidence-sufficiency rating accuracy), not a full reasoning evaluation

Cost: one verifier agent invocation (~3,000-8,000 tokens, shorter than G3/G5). Fires once per lifecycle at the research-to-design gate. This is modest relative to total lifecycle token spend.

### Gate-State Integration

Gates are state transition guards. The PreToolUse hook on state.yml enforces:
1. Detects phase transition in proposed content
2. Maps phase to required gate (scope_complete requires G1, research_complete requires G2, etc.)
3. Reads gates.yml for a passing gate result
4. If found: allow. If not found: deny with specific reason.

This coupling is deterministic and self-contained. The hook reads from gates.yml (written by gate evaluation) and validates against state.yml (the write it is intercepting). No LLM judgment in the loop.

### Override Mechanism

When a gate fails and the developer wants to proceed anyway:
1. Developer tells the skill: "Override G1, the scope is sufficient for an exploratory spike"
2. Skill writes to gates.yml: `{gate: G1, outcome: overridden, override_reason: "...", severity: low, timestamp: "..."}`
3. PreToolUse hook on gates.yml validates the override record structure (reason and severity present, valid gate ID)
4. PostToolUse audit hook logs the override to audit.log
5. Skill retries the state transition -- PreToolUse hook on state.yml sees `overridden: true` and allows the write
6. Developer sees confirmation: "G1 overridden. Override logged. Advancing to research phase."

The override is auditable, traceable, and requires explicit developer intent. It is not a backdoor but a documented escape hatch. Override records are immutable once written -- they cannot be removed or modified by agents.

**Denial reason quality is the critical design surface.** Round-3 research (gap-denial-retry-patterns.md) found that the `permissionDecisionReason` string is the dominant factor in LLM recovery reliability. Single-step corrections succeed >90% of the time when the reason is specific and actionable. The two-step override round-trip (write override, retry state write) has a known weak link: the LLM may "move on" after writing the override record instead of retrying the original state write (~70-85% estimated reliability). Three mitigations are required: (1) the denial reason must include an explicit retry instruction ("Write an override record to gates.yml, then immediately retry writing state.yml with the same content"), (2) the skill preamble must describe the override protocol before the LLM encounters a denial, and (3) the hook should include a retry counter and suggest user intervention after the 3rd denial for the same pattern.

### Anti-Rubber-Stamp Measures

1. **Structural gates eliminate the problem entirely:** Code-enforced checks (G1, G2-structural, G4) produce identical results every time. No LLM involvement, no rubber-stamp risk.
2. **Separate verifier agent:** The gate-verifier is a distinct subagent from the producing agent, reducing self-preference bias. Cross-model evaluation (Opus verifying Sonnet output) catches errors same-model misses. Round-3 research (gap-verifier-effectiveness.md) quantifies this: self-preference bias is ~0.3-0.5 points on a 5-point scale (~10% relative), and cross-model judging eliminates it. However, model separation alone does not raise the overall accuracy ceiling beyond ~80% agreement with human preferences (Zheng et al., 2023).
3. **Read-only tools for verifier:** The gate-verifier uses `tools: [Read, Glob, Grep]` -- it cannot fix what it evaluates, preventing "evaluate then auto-fix" shortcuts.
4. **Structured output format:** The verifier returns per-dimension scoring with evidence citations, not a single "looks good" judgment. This forces systematic evaluation. Round-3 evidence: structured rubric with score anchors improves judge accuracy by +10-15% over open-ended evaluation -- the single largest measurable improvement, independent of model choice (Prometheus, Kim et al. 2023/2024). This measure is at least as impactful as model separation.
5. **Explicit failure criteria:** The verifier prompt defines what failure looks like (unsupported claims, logical contradictions, missing coverage) rather than what success looks like, counteracting leniency bias. Evidence for this measure: MODERATE (round-3 research confirms "look for problems" framing and constitutional-AI-style anchoring reduce leniency; few-shot calibration with labeled examples including known-bad artifacts reduces false-positive rate by 5-10%).
6. **Chain-of-thought evaluation:** The verifier must explain reasoning before scoring, adding +5-10% accuracy and making failures diagnosable. (Added per round-3 evidence.)
6. **Structural layer catches empty compliance:** Even if the reasoning layer is too lenient, the structural rubric catches "checked all boxes but boxes are empty" failures independently.

---

## Resume & Recovery Architecture

### Checkpoint Mechanism

Every skill writes to `.expedite/checkpoint.yml` on every step transition. The checkpoint contains enough information for deterministic resume:

```yaml
skill: research
step: 7
label: "Dispatch web researchers"
substep: "waiting_for_agents"
continuation_notes: >
  3 of 5 web researchers dispatched successfully.
  Remaining questions: DA-4 (worktree patterns), DA-6 (memory strategies).
  Next: dispatch remaining 2 researchers, then wait for all 5 to complete.
inputs_hash: "sha256:a3f2b1c..."
updated_at: "2026-03-12T12:45:00Z"
```

**The checkpoint tells the system WHERE to resume.** The session summary (session-summary.md) tells the LLM WHY and WHAT the situation is. Both are needed; they serve different consumers.

### Step-Level Tracking

**Current problem:** Expedite tracks `current_step` but resume logic uses artifact-existence heuristics instead. This creates three failure modes: (1) partial artifacts confuse the heuristic, (2) the LLM interprets state differently on resume, (3) mid-step crashes leave ambiguous state.

**Solution:** Resume logic reads checkpoint.yml directly and jumps to the recorded step. The skill's orchestration logic becomes:

1. Read checkpoint.yml
2. If checkpoint.skill matches this skill:
   a. Resume at checkpoint.step (not step 1)
   b. Use continuation_notes for context on what happened before the interruption
3. If checkpoint.skill does not match (or no checkpoint):
   a. Start at step 1

This is deterministic. The same checkpoint always produces the same resume point.

### Resume Flow

On skill invocation (or context reset mid-skill):

1. Read `.expedite/checkpoint.yml` (via frontmatter injection, already in context)
2. Read `.expedite/state.yml` (via frontmatter injection, already in context)
3. If checkpoint exists and `skill` matches the invoked skill:
   a. Read `step` and `label`
   b. Verify artifacts expected from completed steps exist (secondary check)
   c. Report to developer: "Resuming [skill] from step [N]: [label]"
   d. Jump to step N. If substep exists, use continuation_notes as context.
4. Cross-reference: if checkpoint says "research, step 7" but state says "research_complete", the state wins (the skill finished after the checkpoint was written)
5. If checkpoint does not match or no checkpoint: start from step 1

### Session Handoff

When a session ends (Stop hook) or compaction occurs (PreCompact hook):
1. Current checkpoint.yml is preserved (it is already on disk, written by the skill at the last step boundary)
2. `.expedite/session-summary.md` is written with: what happened this session, current state, recommended next action

When a new session starts (via skill frontmatter injection):
1. checkpoint.yml is loaded -- the system knows the exact step
2. session-summary.md is loaded -- the system has narrative context
3. The skill reports: "Resuming research, step 7 of 12: Dispatch web researchers. 3 of 5 dispatched."

### Idempotency

Step re-execution safety is maintained through three mechanisms:

- **Inputs hash:** Before executing step N, the skill hashes the step's inputs. If the hash matches the checkpoint's `inputs_hash`, the step was already completed with these inputs -- skip it. If the hash differs (inputs changed), re-execute even if checkpoint says "done." This also enables the revised regression rule: step regression is allowed when inputs_hash differs.
- **Artifact-producing steps:** Check if the artifact exists. If yes and inputs_hash matches, skip. If no, re-produce.
- **Agent-dispatching steps:** Check which agents have produced output files. Dispatch only the remaining agents. continuation_notes records which were already dispatched.
- **State-modifying steps:** The PreToolUse hook ensures idempotent state writes -- writing the same valid state twice is harmless.

### Failure Recovery

**Corrupted state.yml:** The PreToolUse hook prevents writing invalid state, so corruption should not occur during normal operation. If it occurs anyway (manual editing, disk error):
1. The hook rejects the next write attempt, explaining the schema violation
2. The developer reads the error and manually fixes state.yml
3. Normal operation resumes

**Corrupted checkpoint.yml:** If the checkpoint file is unreadable or has invalid schema:
1. The skill falls back to artifact-existence checking (the current heuristic) as a degraded mode
2. The skill logs a warning: "Checkpoint corrupted, using artifact heuristic for resume"
3. This is explicitly a fallback, not the primary mechanism

**Missing state files:** Skills detect absence via frontmatter injection (empty output). The recovery preamble handles missing files: "state not found, starting from beginning" or "run /expedite:status to diagnose."

**Mid-step crash:** If a crash occurs between step execution and checkpoint write, the step ran but checkpoint does not reflect it. The secondary artifact-existence check mitigates this for artifact-producing steps. For steps that do not produce artifacts (e.g., "ask the user a question"), re-execution is safe. This is an acceptable limitation.

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
!cat .expedite/session-summary.md 2>/dev/null
---
```

```yaml
# execute/SKILL.md frontmatter
---
!cat .expedite/state.yml 2>/dev/null || echo "No active lifecycle"
!cat .expedite/checkpoint.yml 2>/dev/null || echo "No checkpoint"
!cat .expedite/tasks.yml 2>/dev/null || echo "No task list"
!cat .expedite/session-summary.md 2>/dev/null
---
```

The design skill never loads questions.yml. The scope skill never loads tasks.yml. Each skill's context is proportional to its needs.

**Token budget per invocation:**

| Context Component | Estimated Tokens | Frequency |
|-------------------|-----------------|-----------|
| Skill body (SKILL.md) | 1,000-2,000 | Every invocation |
| State injection (scoped) | 100-400 | Every invocation |
| Session summary | 50-100 | Every invocation |
| Agent instructions (on dispatch) | 2,000-5,000 | Per agent |
| Artifact reading (on-demand) | Variable | As needed |

Total per-invocation context overhead: approximately 1,150-2,500 tokens (down from 1,500-4,000+ with monolithic state).

### PreCompact Handling

The PreCompact hook fires before context compaction and writes `.expedite/session-summary.md` (or updates it):

```markdown
# Session Summary
- Phase: research_in_progress
- Skill: research, Step 7 of 10
- Last action: Dispatched 3 web researchers for DA-1, DA-2, DA-3
- Next action: Dispatch remaining 2 web researchers for DA-4, DA-5
- Critical state: questions.yml has 15 questions, 8 answered
```

It also backs up checkpoint.yml to `checkpoint.yml.pre-compact`. After compaction, the conversation loses history but state files persist. The next tool call or prompt that references expedite triggers the skill to re-read state from disk.

### Agent Persistent Memory

Two agents receive experimental persistent memory:

**research-synthesizer** (`memory: project`):
- MEMORY.md accumulates synthesis patterns across lifecycles
- Developer can inspect `.claude/agent-memory/research-synthesizer/MEMORY.md`
- Evaluation: after 3 lifecycles, assess whether accumulated patterns improved synthesis quality

**gate-verifier** (`memory: project`):
- MEMORY.md accumulates evaluation patterns across lifecycles
- Developer can inspect and edit this memory to correct learned heuristics
- Evaluation: after 3 lifecycles, assess whether accumulated patterns improved gate evaluation accuracy

All other agents remain stateless. Ephemeral agents (web-researcher, codebase-researcher) should not accumulate persistent context because they handle different questions each lifecycle, and accumulated context would become stale.

### Session Summary

**Primary path (frontmatter injection):**
1. Stop hook writes session-summary.md at session end
2. Each skill's frontmatter includes: `!cat .expedite/session-summary.md 2>/dev/null`
3. When the developer invokes any skill, they see the session summary as part of context
4. The skill reads checkpoint.yml for deterministic resume regardless

**Future enhancement path (SessionStart):**
1. If SessionStart is added later, it reads session-summary.md and outputs status before the developer types anything
2. This provides slightly earlier context delivery but is functionally equivalent

---

## Worktree Isolation

### When Worktrees Are Used

Worktrees are used exclusively during the execute skill, for agents that modify source code. No other skill gets worktree isolation.

- **Execute agents (task-implementer):** Write source code, modify existing files, run tests. These operations create real conflict risk. Worktree isolation prevents interference with the main branch.
- **All other agents:** Write to `.expedite/` directories (evidence files, research notes, plan documents). These are namespaced by lifecycle and have no conflict risk. Worktree isolation would add complexity without benefit.

### Isolation Configuration

The task-implementer agent includes `isolation: "worktree"` in its frontmatter:

```yaml
---
name: task-implementer
description: "Implements code changes for a single task from the execution plan."
model: sonnet
isolation: worktree
disallowedTools:
  - WebSearch
  - WebFetch
maxTurns: 50
permissionMode: acceptEdits
---
```

All non-execute agents include `EnterWorktree` in their `disallowedTools` to prevent accidental worktree creation:

```yaml
disallowedTools:
  - EnterWorktree
  # ... other restrictions
```

When the execute skill dispatches a task-implementer:
1. Claude Code automatically creates a worktree for the agent
2. The agent works in isolation -- no interference with the main branch
3. If the agent makes no changes: worktree is auto-cleaned (built-in Claude Code behavior)
4. If the agent makes changes: worktree path and branch are returned to the execute skill

### Merge-Back Flow

After a task-implementer completes with changes:
1. Execute skill receives the worktree branch name and path
2. Execute skill presents the changes to the developer: "Task 3 complete. Changes on branch `expedite/task-3`. Files modified: src/foo.ts, tests/foo.test.ts. Ready to merge?"
3. Developer reviews (can inspect diff) and confirms
4. Execute skill merges the branch (or the developer merges manually)
5. If merge conflicts exist, the skill reports them and pauses for developer resolution

Multiple tasks each get their own worktree. The merge-back happens sequentially to avoid cascading conflicts.

### Failure Handling

| Failure | Handling |
|---------|----------|
| Agent completes with no changes | Auto-cleanup (built-in Claude Code behavior) |
| Agent completes with changes | Worktree path and branch returned to skill. Developer reviews and merges. |
| Agent crashes mid-worktree | Worktree persists on disk. On resume, execute skill detects orphaned worktree and asks: "Found incomplete worktree for task 3. Resume implementation, or discard and restart?" |
| Merge conflicts | Not automated. Skill reports conflicting files and pauses. Developer resolves manually. Conflict risk is mitigated by task design (each task targets specific files). |
| Accidental worktree creation by non-execute agent | Prevented by EnterWorktree in disallowedTools. |

---

## Skill-Agent Interaction

### Dispatch Pattern

Skills dispatch agents via the standard Claude Code Agent tool, referencing agents by name:

1. Skill reads checkpoint.yml to determine current step (already in context from frontmatter)
2. Skill assembles context for the agent: task description, relevant artifact paths, output expectations
3. Skill invokes agent by name via Agent tool
4. Agent executes with its own frontmatter (model, tools, maxTurns)
5. Agent produces artifacts on disk and returns summary to skill
6. Skill verifies expected artifacts exist (file-existence check)
7. Skill updates checkpoint.yml with completed step
8. Skill updates state.yml if this is a phase transition (validated by enforcement hook)

The skill is a dispatcher, not a doer. The skill's logic is: "which agent to call, with what context, and what to do with the result." The agent's logic is: "how to accomplish the task."

### Context Passing

The dispatch prompt **SHOULD include:**
- **The specific task:** What the agent should accomplish (1-3 sentences)
- **Input artifact paths:** Where to read source material (paths, not content -- the agent reads it)
- **Output artifact path:** Where to write results
- **Output format:** What the result should look like (section structure, YAML schema, etc.)
- **Scope boundaries:** What is in-scope and out-of-scope for this agent

The dispatch prompt **SHOULD NOT include:**
- Full state file contents (the agent does not need lifecycle state)
- Other agents' outputs (unless explicitly relevant to this task)
- Skill step sequence (the agent does not need to know the overall workflow)
- Gate criteria (the agent produces work; the gate evaluates it separately)

Every token in the dispatch prompt is billed at the agent's model tier rate. Excessive context can also confuse the agent -- focused prompts produce better results than kitchen-sink context.

### Result Handling

When an agent returns:
1. Skill reads the agent's summary message
2. Skill verifies the expected artifact(s) exist on disk
3. Skill updates checkpoint.yml with the completed step
4. Skill presents results to the developer

### Failure Handling

When an agent fails:
1. Skill detects the failure from the agent's return (missing artifacts, error summary)
2. Skill reports to the developer with specific details
3. Skill offers options: "Retry with more turns? Continue with partial evidence? Skip this question?"
4. Skill does NOT automatically retry -- the developer decides

**Cost-aware dispatch:** Before dispatching an agent, the skill should consider:
1. Can this be done without an agent? Simple file reads, YAML manipulation, and counting can be done by the skill itself.
2. Does this need Opus? Default to Sonnet. Only use Opus for synthesis, architecture, and gate evaluation.
3. Can agents run in parallel? If multiple independent research agents are needed, dispatch them as background tasks and collect results.

---

## Migration Sequence

### Phase Ordering

| Phase | What | Standalone Value | Dependencies | Effort | Reversible? |
|-------|------|-----------------|-------------|--------|-------------|
| M1 | State splitting + PreToolUse hook + gates.yml protection | Token waste reduction, enforced state validity, gate fabrication prevention | None | Medium | Yes |
| M2 | Checkpoint-based resume | Deterministic resume for all skills, eliminates heuristic failure modes | M1 (checkpoint.yml must exist and be validated) | Medium | Yes |
| M3 | Agent formalization | Tool restrictions prevent misbehavior, model tiering reduces cost | None (independent) | Medium | Partially |
| M4 | Skill thinning | Skills drop to 100-200 lines, clear separation of concerns | M3 (agents must be formalized first) | Large | Difficult |
| M5 | Structural gate enforcement (G1, G2-structural, G4) | Eliminates rubber stamp for 3 of 5 gates | M1 (hooks must exist, gates.yml validated) | Medium | Yes |
| M6 | Semantic gate dual-layer (G2-semantic, G3, G5) | Eliminates rubber stamp for remaining gates | M5 (structural layer first), M3 (agent format) | Medium | Yes |
| M7 | Worktree isolation for execute | Source code isolation during execute phase | M3 (execute agents must be formalized) | Small | Yes |
| M8 | Stop and PreCompact hooks + session handoff | Session handoff narrative, context preservation across compaction | M1 (state files must exist) | Small | Yes |

### Per-Phase Value

| Phase | Maintenance Reduction | Token Savings | Risk Mitigation |
|-------|----------------------|---------------|-----------------|
| M1 | High (smaller files, scoped reads, automated enforcement) | High (60-80% state token reduction) | High (prevents state drift, gate fabrication) |
| M2 | High (deterministic resume replaces fragile heuristics) | Low | High (eliminates resume failure modes) |
| M3 | Medium (formal agent definitions are self-documenting) | Medium (model tiering) | Medium (tool restrictions prevent misbehavior) |
| M4 | High (skills drop from 860 to 200 lines) | Low | Medium (thinner skills are easier to debug) |
| M5 | Medium (gate logic is code, not prompts) | Medium (code gates cost zero tokens) | High (eliminates rubber stamp for structural criteria) |
| M6 | Low (adds verifier agent to maintain) | Negative (verifier costs tokens) | High (eliminates rubber stamp for semantic criteria) |
| M7 | Low (one frontmatter field) | Zero | Medium (prevents code conflicts) |
| M8 | Medium (automated session handoff and context preservation) | Low | Medium (prevents context loss) |

### Validation Criteria

Before advancing to the next phase, verify:

**M1:** State files are split, frontmatter is scoped, PreToolUse hook intercepts Write calls to `.expedite/*.yml`, invalid phase transitions are denied with human-readable reasons, gates.yml writes are validated.

**M2:** All 6+ skills write checkpoint.yml at step boundaries. Resume from checkpoint produces the correct step. Artifact-existence heuristic is secondary, not primary.

**M3:** All agent prompt templates are migrated to `agents/*.md` with full frontmatter. Agent dispatch by name works. Tool restrictions are enforced (verify with a test).

**M4:** All skills are under 200 lines. Each skill is a step sequencer that dispatches agents. Business logic lives in agents, not skills.

**M5:** G1, G2-structural, and G4 run as deterministic Node.js scripts. Structural gate failure produces specific, actionable messages. Gate results are written to gates.yml.

**M6:** Gate-verifier agent is created. G3 and G5 use dual-layer evaluation. Structural layer runs first; semantic layer runs only if structural passes. Verifier output is validated for completeness by the gate skill.

**M7:** task-implementer agent has `isolation: worktree`. Non-execute agents have EnterWorktree in disallowedTools. Merge-back flow works for a single task.

**M8:** Stop hook writes session-summary.md. PreCompact hook backs up checkpoint and writes session summary. Session handoff works across session boundaries.

### Dependency Chain

```
M1 (State Split + Hooks)
    +-- M2 (Checkpoint Resume)
    |       +-- M8 (Session Handoff Hooks)
    +-- M3 (Agent Formalization) -- can run in parallel with M2
    |       +-- M4 (Skill Thinning)
    |       +-- M6 (Semantic Gates)
    |       +-- M7 (Worktree Isolation)
    +-- M5 (Structural Gates) -- can run in parallel with M2 and M3
            +-- M6 (Semantic Gates)
```

M2, M3, and M5 can proceed in parallel after M1. M6 requires both M3 and M5. M4 requires M3. M7 requires M3. M8 requires M2.

---

## Developer Experience

### Starting a New Lifecycle

The developer runs `/expedite:scope`. The skill checks state.yml -- no active lifecycle. It initializes state.yml and checkpoint.yml and begins the scope conversation. The harness is invisible -- the developer is having a conversation, not configuring a system.

### Hitting a Quality Gate

The scope skill completes and tries to advance to `scope_complete`. The PreToolUse hook fires and runs the G1 structural check:

**If G1 passes:** State advances. The developer sees: "Scope phase complete. G1 gate passed: 12 questions across all decision areas. Ready for /expedite:research."

**If G1 fails:** The write is blocked. The developer sees: "G1 structural check failed: questions.yml has 2 questions (minimum 3). DA-4 has no questions. Add questions for DA-4 to pass G1." Specific, actionable, no ambiguity.

### Resuming After Context Reset

The developer returns after a break. The first skill invocation loads state via frontmatter: "Expedite lifecycle active: MyProject. Phase: research_in_progress. Checkpoint: research/step 7 -- Dispatch web researchers. 3 of 5 dispatched."

The developer types `/expedite:research`. The skill reads checkpoint.yml, skips steps 1-6, and resumes at step 7. It checks which researcher outputs exist, identifies pending ones, and dispatches only those.

The developer did not have to explain where they were. The system knew.

### Getting Blocked by a Hook

An agent or skill tries to write an invalid state transition (e.g., skipping from scope to design). The PreToolUse hook blocks the write. Claude reports: "I tried to advance to the design phase, but the state write was blocked. The enforcement system says: 'Invalid phase transition: scope_in_progress cannot transition to design_in_progress. Valid transitions from scope_in_progress are: scope_complete (requires G1 gate passage).' We need to complete scope first."

The developer understands what happened, why, what the valid options are, and what to do next.

### Overriding a Gate

Developer: "Override G1, the scope is sufficient for an exploratory spike."

The skill writes the override record to gates.yml (validated for structure by PreToolUse hook), the PostToolUse audit hook logs it, and the state transition proceeds. The developer sees: "G1 overridden. Override logged. Advancing to research phase." Nothing was silent or hidden.

**Note:** These scenarios are design imagination that makes the architecture tangible and verifiable against implementation. They are not evidence-derived predictions.

---

## Backlog

Items discussed in research but deliberately deferred:

| Item | Why Deferred | When to Reconsider |
|------|-------------|-------------------|
| **Agent Teams (mesh communication)** | 3-4x token cost. Designed for collaborative work (cross-layer features, architectural debate), not pipeline-style artifact handoff. Expedite's pipeline architecture fits the simpler subagent hub-and-spoke pattern. | When a genuine need for inter-agent communication during execution is identified -- e.g., parallel research agents discovering overlapping findings that need coordination. |
| **SessionStart hook** | Three platform bugs (#16538, #13650, #11509) historically blocked reliable use. Frontmatter injection provides functionally equivalent context loading. | When Claude Code confirms the bugs are fixed in a release. Adding SessionStart is then a small, low-risk enhancement. |
| **SubagentStop hook** | No repo demonstrates using SubagentStop for quality verification. Skill-level verification after agent return is simpler and has no evidence disadvantage. | When observed failures suggest that agents are producing incomplete work that the skill does not catch, and a hook-level check would be more reliable. |
| **Artifact validation hooks (PreToolUse on SCOPE.md, SYNTHESIS.md, etc.)** | Architecturally sound extension of the state-guard pattern, but no repo demonstrates it. Lower priority than state and gate validation. | After structural gates are implemented (M5). Validate the pattern on one artifact (SCOPE.md) first. If it catches meaningful issues at write time, generalize. |
| **Continuous learning / instincts (ECC pattern)** | Designed for general-purpose harnesses that improve over time. Expedite's skills are hand-crafted decision-support workflows where enforcement is more valuable than learning. | If agent persistent memory (the current experiment) proves valuable, learning patterns may warrant expansion. |
| **Declarative flow syntax** | Solves ad-hoc workflow composition. Expedite's pipeline is fixed and well-defined. The SKILL.md format is sufficient. | If the pipeline becomes configurable (e.g., user-defined stage ordering), a flow syntax may become relevant. |
| **Per-agent hooks** | Plugin-level hooks provide sufficient enforcement initially. Per-agent hooks add maintenance surface without demonstrated need. | When specific agents need custom enforcement behavior that cannot be achieved with plugin-level hooks. |
| **Haiku model tier agents** | No current agents warrant the fast tier. Available for future optimization. | When quick, cheap lookups or file-existence checks are needed frequently enough to justify a dedicated agent. |
| **TypeScript for hook scripts** | Build step adds maintenance overhead without proportional benefit for a solo developer. Node.js runs directly with identical runtime capabilities. | If the hook codebase grows large enough that type safety prevents more bugs than the build step creates friction. |

---

## Success Metrics

| Metric | Target | What It Measures | When to Check |
|--------|--------|-----------------|---------------|
| Resume success rate | >95% correct step on resume | Whether checkpoint-based resume produces the right step without manual correction | After M2, on every lifecycle |
| Gate bypass rate (unintended) | 0 unintended bypasses | Whether the PreToolUse hook prevents all invalid phase transitions | After M1, on every lifecycle |
| Gate override rate | <20% of gate encounters | Whether gates are calibrated correctly (too many overrides = criteria too strict) | After M5, on every lifecycle |
| State drift incidents | 0 per lifecycle | Whether invalid state ever reaches disk | After M1, on every lifecycle |
| Hook false positive rate | <5% of state writes blocked incorrectly | Whether hook validation is too strict | After M1, during first 3 lifecycles |
| Skill line count | All skills under 200 lines | Whether skill thinning achieves the target | After M4 |
| State injection tokens | <400 tokens per invocation | Whether scoped injection achieves target savings | After M1 |
| Hook latency per write | <300ms | Whether command hooks add acceptable latency | After M1, measure on first 100 writes |
| Agent memory value | Developer finds MEMORY.md content useful after 3 lifecycles | Whether persistent memory improves output quality | After 3 lifecycles with memory enabled |
| Verifier rubber-stamp rate | <10% of semantic gate evaluations pass trivially | Whether the dual-layer gate catches real quality issues | After M6, track over 5+ lifecycles |
