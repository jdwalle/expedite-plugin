# Agent Harness Architecture: Resolution 3 (Evidence Lens)

## Design Summary

This design proposes evolving expedite from a prompt-enforced orchestration system into a code-enforced agent harness, using only mechanisms with strong evidence backing from 8 surveyed harness repositories, 3 industry frameworks (LangGraph, CrewAI, MemGPT/Letta), and academic research on LLM-as-judge bias. The evidence lens shapes every choice toward proven patterns: directory-based state (4+ convergent sources), PreToolUse command hooks for state machine enforcement (3 independent implementations), deterministic rule-based structural gates (strongest anti-rubber-stamp evidence), and generalized checkpoint-per-skill resume (proven in LangGraph and expedite's own execute skill). Where evidence is thin -- notably on hook latency quantification, SessionStart bug status, and mid-agent supervision -- the design chooses the conservative option and flags the gap explicitly. The overall evidence base is strong for the core architectural patterns (hooks, state splitting, structural gates, checkpoint resume) and adequate for secondary concerns (worktree isolation, skill-agent boundary, memory strategy).

---

## User Decisions Applied

### Decision 1: Three-Layer Separation (Enforcement + Orchestration + Execution)
Shapes the entire architecture. The design separates hook-based enforcement (Layer 1) from thin orchestration skills (Layer 2) from thick formalized agents (Layer 3). This aligns with claude-code-harness's three-layer pattern and is the strongest evidence-backed boundary pattern.

### Decision 2: Dual-Layer Rubric + Reasoning for Semantic Gates
Applied to G3 (Design) and G5 (Spike) gates. Structural rubric validation is code-enforced (Layer 1). Reasoning soundness is verified by a separate agent (Layer 3). The two layers are independent -- a structural pass does not imply a reasoning pass. This matches expedite's existing Phase 24 verifier concept and is supported by the academic evidence on rubber-stamp mitigation.

### Decision 3: Incremental Hardening Migration
The migration sequence adds hooks and state splitting to existing skills one at a time. Each increment delivers standalone value. No "big bang" rewrite. This is the conservative choice and the one with the least risk of regression.

### Decision 4: Worktree Isolation for Execute Only
`isolation: "worktree"` added to execute agents. All other skills write to `.expedite/` directories only, where worktree isolation is unnecessary. This is the minimum adoption scoped by the evidence.

### Constraints Honored
- C1 (Claude Code plugin API): All mechanisms use hooks, subagent frontmatter, skills, and Task() -- no external tooling required.
- C2 (Full rebuild acceptable): Incremental preferred (Decision 3) but the design does not depend on preserving any current file.
- C3 (Personal/team tool): Configuration complexity is acceptable. Hook scripts, agent definitions, and state files are power-user surfaces.
- C4 (SessionStart deferred): Design uses ECC's "root fallback" pattern. SessionStart hooks are designed but have fallback paths. No feature depends solely on SessionStart.
- C5 (Pipeline is fixed): The scope-research-design-plan-spike-execute lifecycle is unchanged. The design hardens how the pipeline executes, not what it does.

---

## Agent-Resolved Contested Areas

No contested areas were deferred to agents in the user-decisions document. All four decision areas received explicit user answers. The "Areas Not Requiring User Input" were marked as evidence-convergent and are adopted as stated:

- **State management**: Directory-based (file-per-concern). Evidence: STRONG (4+ sources -- LangGraph, ECC, CrewAI, claude-code-harness).
- **Agent formalization**: Official Claude Code subagent schema. Evidence: STRONG (official docs + 5 repo examples).
- **Resume mechanism**: Generalized checkpoint.yml. Evidence: STRONG (LangGraph per-step checkpoints + expedite's own execute-skill precedent).
- **Hook priority**: PreToolUse on state writes. Evidence: STRONG (3 harness implementations + official documentation).
- **Coordination pattern**: Subagents (hub-and-spoke). Evidence: STRONG (pipeline architecture maps directly; Agent Teams 3-4x cost for a pattern expedite does not need).
- **Structural gates**: Code-enforced deterministic validation. Evidence: STRONG (claude-code-harness rule engine + academic rubber-stamp research).

---

## Three-Layer Architecture

### What the Research Says

The three-layer pattern (enforcement / orchestration / execution) is most clearly demonstrated by claude-code-harness [STRONG: primary source], where:
- **Layer 1 (Enforcement)**: TypeScript guardrail engine with 9 compiled rules (R01-R09), invoked via hooks. Deterministic, testable, no LLM judgment for structural checks.
- **Layer 2 (Orchestration)**: 5 thin verb skills (plan, execute, review, release, setup) that sequence work and interact with the user.
- **Layer 3 (Execution)**: 3 typed agents (worker, reviewer, scaffolder) with substantial logic.

ECC demonstrates a variant: enforcement via Node.js hook scripts, orchestration via 65+ skills, execution via 12 typed agents [MODERATE: one source with production maturity (72K+ stars, 997 tests)].

claude-agentic-framework demonstrates per-worker quality gates as enforcement, swarm commands as orchestration, and 8 typed workers as execution [MODERATE: one source].

No repo demonstrates a controlled comparison between two-layer and three-layer architectures. The evidence that three-layer is better is observational: claude-code-harness produces testable enforcement logic, and expedite's current merged approach (enforcement + orchestration in 500-860 line skills) has reached practical limits. Evidence strength for the superiority claim: MODERATE (observational, not experimental).

### Design

**Layer 1: Enforcement (hooks + scripts)**
- Location: `hooks/hooks.json` for hook registration, `hooks/scripts/` for command hook implementations.
- Responsibilities: State write validation (schema, FSM transitions, gate passage), structural gate evaluation (G1, G2, G4), audit trail logging, override tracking.
- Handler types: Command hooks for all enforcement (fast, deterministic). Agent hooks only for semantic gate verification (G3, G5).
- Principle: Every enforcement check is a script that can be run and tested independently of Claude Code.

**Layer 2: Orchestration (thin skills)**
- Location: `skills/{skill}/SKILL.md` (target: 100-200 lines each, down from 500-860).
- Responsibilities: Step sequencing, user interaction, agent dispatch, context assembly. Skills describe WHAT to do at each step and delegate HOW to agents.
- Skills do not evaluate quality (that is Layer 1's job) and do not contain substantial generation logic (that is Layer 3's job).

**Layer 3: Execution (thick agents)**
- Location: `.claude/agents/` and/or plugin `agents/` directory.
- Responsibilities: Artifact generation, research execution, code implementation. Agents receive assembled context, produce artifacts, and return summaries.
- Agents use the full official subagent frontmatter schema (name, description, tools, disallowedTools, model, maxTurns, memory, isolation, hooks).

### Evidence Gaps
- No evidence on the optimal skill line count for "thin." The 100-200 line target is extrapolated from claude-code-harness's verb skills, which are shorter, but those skills orchestrate fewer steps. Evidence strength for the line-count target: WEAK (extrapolation from one source).
- No evidence on whether enforcement scripts should be shell (bash/zsh) or a compiled language (TypeScript/Node.js). Claude-code-harness uses TypeScript; ECC uses Node.js. Both are more robust than raw shell. Evidence strength: MODERATE (2 sources favor Node.js/TypeScript over shell).

### Design Choice: Start with Shell, Migrate to Node.js If Needed
Shell scripts are simpler for a solo developer to write and debug. The enforcement logic (YAML parsing, field checking, FSM validation) is straightforward enough for shell + `yq` or `jq`. If enforcement complexity grows, migrate to Node.js. This is the conservative incremental choice.

Evidence for this choice: WEAK (no source directly compares shell vs. Node.js for hook scripts; this is a pragmatic judgment). Risk: Shell parsing of YAML is fragile for edge cases. Mitigation: Use `yq` (a mature YAML processor) for all YAML operations in hook scripts.

---

## Hook Architecture

### Hooks with Proven Enforcement Patterns

#### PreToolUse on Write (State Machine Guard)
**Evidence: STRONG** (claude-code-harness TypeScript engine [R01-R09], ECC PreToolUse validation, documented pattern in hooks reference with exit code 2 semantics)

This is the single highest-value hook adoption. A command hook matching `Write` intercepts all file writes, filters by path (`.expedite/state.yml` and other state files), parses the proposed content, and validates:
1. **Schema conformance**: Required fields present, types correct.
2. **FSM transition validity**: Phase transitions are forward-only through the valid sequence (scope_in_progress -> scope_complete -> research_in_progress -> ... -> execute_complete).
3. **Gate passage requirement**: Advancing to a `_complete` phase requires a corresponding gate result with `outcome: "go"` or `outcome: "go-with-advisory"` in the gate history.
4. **Step tracking consistency**: `current_step` cannot decrease within a phase.

Exit code 2 blocks the write. `permissionDecisionReason` explains why. The skill then sees the denial and can report to the user or request an override.

#### PreToolUse on Write (Artifact Validation)
**Evidence: MODERATE** (claude-code-harness PostToolUse for change tracking, claude-agentic-framework per-worker quality gates)

A second PreToolUse matcher on `Write` for artifact paths (`.expedite/scope/SCOPE.md`, `.expedite/research/SYNTHESIS.md`, etc.) can validate structural requirements before the file is written. This catches obviously incomplete artifacts at creation time rather than at gate time. However, PreToolUse for artifact validation is less clearly evidenced than for state writes -- the harness repos validate state transitions, not artifact content, at the hook level. Evidence is MODERATE because the pattern is a reasonable extension of the state-guard pattern, but no surveyed repo does exactly this.

Design choice: Include artifact structural validation hooks but mark them as lower priority in the migration sequence. Validate the pattern on one artifact (SCOPE.md) before generalizing.

#### PostToolUse on Write (Audit Trail)
**Evidence: MODERATE** (ECC PostToolUse for continuous learning/logging, claude-code-harness PostToolUse for change tracking)

A non-blocking PostToolUse hook logs every state write to an append-only audit log. This creates traceability for state changes and override events. The hook parses the completed write and appends a line to `.expedite/audit.log` with timestamp, file changed, phase before/after, and actor (skill or agent).

#### Stop Hook (Session Summary)
**Evidence: MODERATE** (ECC Stop hook for session state persistence, claude-code-harness Stop hook for session summaries)

A Stop hook writes a session summary to `.expedite/session-summary.yml` containing:
- Current phase and step when session ended
- What was accomplished in this session
- What should happen next (derived from checkpoint state)

This creates the "handoff document" pattern from ECC, providing context for the next session. The Stop hook is non-blocking and uses a command handler.

#### SessionStart Hook (Context Loading) -- WITH FALLBACK
**Evidence: MODERATE** (ECC SessionStart with root fallback, claude-code-harness SessionStart for environment checks)

A SessionStart hook loads the previous session summary and current checkpoint state. Because of platform bugs (#16538, #13650, #11509), the design does not depend on SessionStart working. Fallback: skills load checkpoint state via frontmatter injection (`!cat .expedite/checkpoint.yml`). If SessionStart is functional, it provides richer context loading (selective, transformable). If not, frontmatter injection provides the minimum viable context.

Design choice: Implement SessionStart but design every skill's frontmatter to be self-sufficient without it. This is ECC's "root fallback" pattern.

#### PreCompact Hook (State Preservation)
**Evidence: MODERATE** (ECC pre-compact.js for strategic compaction management)

A PreCompact hook saves critical state before context compaction. Since compaction discards conversational context, the hook ensures the current step, phase, and next-action are written to the checkpoint file before compaction occurs. This prevents the "lost context after compaction" failure mode.

### Hooks That Are Speculative for This Use Case

#### UserPromptSubmit (Input Validation)
**Evidence: WEAK for expedite's use case** (documented in hooks reference as blocking, no harness repo uses it for lifecycle enforcement)

Could validate that user input matches expected format at certain steps (e.g., ensuring the user provides a yes/no answer during gate evaluation). However, no surveyed repo uses UserPromptSubmit for this purpose. The evidence supports its existence and blocking capability but not its value for lifecycle orchestration. Defer adoption.

#### PermissionRequest (Auto-Approval)
**Evidence: MODERATE** (documented in hooks reference, ECC uses runtime profiles)

Could auto-approve tool permissions for agents operating within expected boundaries. However, this introduces safety risk -- auto-approving destructive operations is the primary concern. For a personal tool where the user is present, prompt-based permission is acceptable. Defer adoption unless permission fatigue becomes a real problem.

#### SubagentStop (Agent Output Validation)
**Evidence: WEAK for this specific use** (documented in hooks reference, no surveyed repo uses SubagentStop for artifact validation)

Could validate agent output quality when a subagent completes. However, the supplement-synthesis confirmed that SubagentStop supports agent hook handlers, making it a candidate for semantic gate evaluation. The evidence is that the mechanism works, but no repo has demonstrated this specific pattern.

Design choice: Use SubagentStop with agent hooks for G3/G5 semantic verification as a future enhancement. For the initial migration, semantic gates run as explicit steps within the skill orchestration rather than as hooks. This is the more conservative path.

### Known Anti-Patterns from Research

1. **Over-blocking** (ECC documentation): Hooks that fire too frequently or are too strict create frustrating UX. Mitigation: Start with the minimum set (PreToolUse on state writes) and expand based on experience. ECC's runtime profiles (`minimal|standard|strict`) are a proven mitigation but add complexity -- defer until needed.
   Evidence: MODERATE (1 source with 72K+ stars production usage)

2. **Latency compounding** (hooks reference, qualitative): Command hooks add ~100ms per invocation. For Write operations (relatively infrequent), this is acceptable. For PostToolUse on every tool call, it would compound. Design mitigates by scoping hooks to specific paths.
   Evidence: WEAK (qualitative only, no benchmarks)

3. **No inter-hook communication** (hooks reference): Each hook invocation is independent. The state-guard hook cannot communicate with the audit-trail hook. Design accepts this constraint -- each hook reads state from disk independently.
   Evidence: STRONG (official documentation)

---

## State Management Architecture

### Patterns with Convergent Evidence (3+ Sources)

#### Directory-Based State (File-Per-Concern)
**Evidence: STRONG** (LangGraph checkpoint files, ECC hook-distributed state, CrewAI flow persistence, claude-code-harness config schema, MemGPT tiered memory)

The convergent signal across the ecosystem is unambiguous: separate concerns into separate files. Every mature system avoids monolithic state. The specific split for expedite:

| File | Contents | Consumers | Approx. Size |
|------|----------|-----------|-------------|
| `state.yml` | Phase, lifecycle ID, project name, version | All skills, hooks | ~15 lines |
| `checkpoint.yml` | Current skill, step, substep, continuation notes | Resume logic, hooks | ~20 lines |
| `questions.yml` | Research questions, categories, convergence data | Scope, research skills | Variable |
| `gates.yml` | Gate history (outcomes, timestamps, artifacts) | Gate evaluation, hooks | Variable |
| `tasks.yml` | Execution tasks, assignments, completion status | Execute skill | Variable |

This split aligns with expedite's planned ARCH-02 through ARCH-06 and is validated by the MemGPT tiering principle (not all state belongs in context).

**Why not stay with monolithic state.yml?** The research identifies three concrete problems: (1) token waste from injecting irrelevant state (the execute skill does not need research questions), (2) concurrent write risk when multiple agents could modify state (directory-based provides file-level atomicity), and (3) growing file size as gate history and questions accumulate. All three are documented in the research synthesis.

#### YAML Format Retained
**Evidence: MODERATE** (research finding that LLMs handle YAML and JSON comparably; the differentiator is injection strategy, not format)

YAML is retained because: (1) expedite already uses YAML throughout, (2) the LLM reliability research shows no advantage to switching formats, and (3) migration cost offers no evidence-supported payoff. The key improvement is splitting, not reformatting.

### Patterns with Single-Source Evidence

#### Schema Validation on Write
**Evidence: MODERATE** (CrewAI Pydantic validation -- "invalid state never gets persisted"; claude-code-harness JSON schema validation at load time)

Two sources demonstrate write-time schema validation but using different mechanisms (Pydantic models vs. JSON Schema). For expedite, the PreToolUse hook on state writes performs the equivalent function: validating state content before it reaches disk. This is a reasonable adaptation of the pattern to Claude Code's hook architecture.

#### Append-Only Audit Log
**Evidence: MODERATE** (LangGraph append-only checkpoints, expedite's own log.yml, ECC PostToolUse logging)

The append-only pattern for audit data is well-supported. The design uses it for the audit trail (`.expedite/audit.log`) but not for primary state (state.yml remains a rewrite target). This hybrid approach -- rewrite for active state, append for history -- is supported by LangGraph's architecture where checkpoints are append-only but the active state is mutable.

### Evidence Gaps in State Design

1. **Cross-file consistency**: No source directly addresses what happens when skill A writes to `questions.yml` while skill B reads `state.yml` and the two files are temporarily inconsistent. Expedite's pipeline architecture (sequential phases) mitigates this -- only one skill is active at a time. Parallel agents within a skill write to different files (agent output goes to artifacts, not state). Risk: LOW for expedite's current architecture, but a real concern if parallel phase execution were ever added.

2. **YAML parsing in shell hooks**: No source benchmarks `yq` reliability for YAML validation in hook scripts. The design assumes `yq` is reliable for the simple schemas involved (flat key-value, short arrays). Risk: LOW (yq is a mature tool) but untested in this specific context.

3. **Backup-before-write atomicity**: No source confirms whether Claude Code's Write tool is atomic. The current backup-before-write protocol (which the design retains as defense-in-depth alongside hook validation) addresses this regardless. Evidence for Write atomicity: NONE.

---

## Agent Formalization

### What the Official Schema Supports

**Evidence: STRONG** (official Claude Code subagent documentation, confirmed by 5 repo implementations)

The official subagent frontmatter schema provides 12+ fields. For expedite's agents, the immediately relevant fields are:

| Field | Value for Expedite | Evidence |
|-------|-------------------|----------|
| `name` | Required. Lowercase, hyphenated (e.g., `scope-researcher`, `design-verifier`) | Official docs |
| `description` | Required. When Claude should delegate -- critical for auto-delegation | Official docs |
| `tools` | Allowlist per agent (e.g., research agents get Read/Grep/Glob/WebSearch; execute agents get Read/Write/Edit/Bash) | Official docs + 5 repos |
| `disallowedTools` | Denylist for dangerous tools (e.g., research agents disallow Write/Edit to prevent accidental source code modification) | Official docs |
| `model` | Per-agent model assignment: Haiku for exploration, Sonnet for standard work, Opus for architecture/verification | Official docs + 4 repos (model tiering convergent pattern) |
| `maxTurns` | Prevent runaway agents. Set based on expected task complexity. | Official docs |
| `memory` | `project` scope for agents that should learn across lifecycles (research agents) | Official docs |
| `isolation` | `worktree` for execute agents only (User Decision 4) | Official docs + 2 repos |
| `hooks` | Per-agent hooks for output validation (future enhancement) | Official docs |

### What Repo Implementations Demonstrate

**Evidence: STRONG** (5 repos with agent definitions)

The repos demonstrate several agent definition conventions:

1. **Model tiering is universal**: 4 of 8 repos independently implement 3-tier model assignment (Haiku/Sonnet/Opus). Expedite currently uses 2 tiers (Sonnet/Opus). Adding Haiku for fast exploration agents (codebase search during scope/research) is well-supported.

2. **Tool restrictions are common**: wshobson (112 agents), claude-agentic-framework (8 workers), and claude-code-harness (3 agents) all restrict tools per agent type. The principle: agents should only have tools they need. Research agents do not need Write. Execute agents do not need WebSearch.

3. **Agent count varies widely**: From 3 (harness) to 112 (wshobson). The evidence does not suggest an optimal count. Expedite's current 6 agent types (scope researcher, web researcher, codebase researcher, design synthesizer, spike researcher, task executor) are reasonable. Adding a verifier agent type for semantic gates increases this to 7.

### Agent Formalization Design

Expedite's agents move from prompt templates in `skills/{skill}/references/prompt-*.md` to formal subagent definitions in the plugin's `agents/` directory. Each agent gets a `.md` file with:

1. Full YAML frontmatter (name, description, model, tools, disallowedTools, maxTurns, memory, isolation)
2. System prompt (the current prompt template content)
3. Context injection via frontmatter commands (relevant state files, checkpoint)

The skill dispatches agents by name rather than by assembling prompts inline. This is a structural change (file location and format) that enables platform features (tool restriction, memory, isolation) without changing the agent's actual behavior.

### Where Evidence Is Weak

- **Per-agent hooks**: The official schema supports hooks scoped to a subagent, but no surveyed repo demonstrates this pattern for quality validation. Evidence: WEAK (documented but undemonstrated).
- **Agent persistent memory**: The `memory` field is documented but none of the 8 surveyed repos use per-agent persistent memory. Evidence: WEAK (official docs only). Design choice: enable memory for research agents as an experiment but do not make any feature depend on it working.
- **Agent-level `skills` field**: Subagents can preload skills, but the interaction between a subagent's skills and the parent skill's context is not well-documented. Evidence: WEAK. Design choice: do not use the skills field initially.

---

## Quality Gate Enforcement

### Structural vs. Semantic Classification

**Evidence: STRONG** (claude-code-harness rule engine for structural rules [R01-R09], academic rubber-stamp research [arXiv 2411.15594], 6-pattern validation taxonomy from research)

The most actionable research finding: split gates by what they check.

| Gate | Type | What It Checks | Enforcement |
|------|------|----------------|-------------|
| G1 (Scope) | Structural | SCOPE.md exists, has required sections, 3+ DAs, research categories assigned | Code-enforced (command hook or script) |
| G2 (Research) | Structural + Light Semantic | All categories have findings, synthesis exists, readiness criteria met | Code-enforced for structure; verifier agent for readiness assessment quality |
| G3 (Design) | Semantic | Design decisions are evidence-backed, internally consistent, complete | Dual-layer: structural rubric (code) + reasoning verifier (agent) |
| G4 (Plan) | Structural | Phase breakdown exists, each phase has tasks, dependency ordering valid | Code-enforced (command hook or script) |
| G5 (Spike) | Semantic | Decision quality, implementation steps are actionable, risks identified | Dual-layer: structural rubric (code) + reasoning verifier (agent) |

### Anti-Rubber-Stamp Evidence Per Mechanism

#### Deterministic Code (Structural Gates)
**Evidence: STRONG** (claude-code-harness 9-rule TypeScript engine; the academic finding that "the most reliable gates are the ones that don't involve LLM judgment at all")

For G1 and G4, the checks are fully deterministic:
- Does the file exist? (`test -f`)
- Does it contain required section headers? (`grep`)
- Are there at least N items in a list? (`yq '.decision_areas | length'`)
- Is every required field non-empty? (`yq`)

These produce identical results every time. No rubber-stamp risk. No LLM involved.

G2 is partially structural (file counts, section existence) and partially semantic (are the readiness assessments sound?). The structural portion is code-enforced. The semantic portion goes through the verifier.

#### Dual-Layer Rubric + Reasoning (Semantic Gates)
**Evidence: MODERATE** (the pattern is independently described in the research taxonomy and matches expedite's Phase 24 design; however, no surveyed repo implements exactly this dual-layer pattern for gate enforcement)

For G3 and G5:
- **Layer 1 (Structural rubric)**: Code-enforced. Check that the design document has a decision for every DA, that each decision cites evidence, that the document has required sections. This is the "did you check all boxes?" layer.
- **Layer 2 (Reasoning verifier)**: A separate verifier agent (distinct from the producing agent, potentially a different model) reads the artifact and evaluates reasoning soundness. This is the "are your conclusions actually supported by your evidence?" layer.

The two layers run independently. Both must pass. The structural layer runs first (fast, cheap). If structural fails, the semantic layer does not run. If structural passes, the semantic layer provides the deeper evaluation.

**Anti-rubber-stamp mechanisms for the reasoning verifier**:
1. **Separate agent**: The verifier is a distinct subagent, not the producing agent evaluating its own output. This reduces self-preference bias. Evidence: MODERATE (arXiv survey confirms cross-model evaluation catches errors same-model misses).
2. **Structured output format**: The verifier returns a structured assessment (pass/fail per criterion with specific evidence citations), not a free-form "looks good." This constrains evaluation to specific checkable claims. Evidence: MODERATE (LLM-as-judge best practices recommend structured output).
3. **Explicit failure criteria**: The verifier prompt defines what failure looks like (unsupported claims, logical contradictions, missing coverage) rather than what success looks like. This counteracts the leniency bias. Evidence: WEAK (extrapolated from bias research, not directly demonstrated).

### Gate-State Integration

**Evidence: STRONG** (PreToolUse-as-state-transition-guard pattern documented in research with code examples)

The PreToolUse hook on state writes enforces gate passage as a precondition for phase advancement:

1. Hook intercepts Write to `state.yml`
2. Parses proposed content for phase field
3. If phase is advancing to a `_complete` state, reads `gates.yml`
4. Verifies a gate result exists with `outcome: "go"` or `outcome: "go-with-advisory"` for the corresponding gate
5. If no passing gate result exists, blocks the write (exit code 2) with reason: "Gate GN has not passed. Complete gate evaluation before advancing phase."

This makes gate bypass structurally impossible unless the user explicitly overrides (which is auditable via the existing override mechanism and the PostToolUse audit hook).

### Override Mechanism

**Evidence: MODERATE** (expedite's existing override-context.md pattern assessed as good in the research; PostToolUse hook for audit trail is a reasonable extension)

The existing override mechanism (override-context.md, severity classification, gate_history `overridden: true`) is retained. Enhancement: the PostToolUse hook logs overrides to the append-only audit trail with the full override context. This makes overrides traceable across sessions.

Design choice: Overrides must also work with code-enforced gates. When a user initiates an override, the skill writes a structured override record to `gates.yml` with `overridden: true` and the override context. The PreToolUse hook on state writes recognizes `overridden: true` as a valid gate passage and allows the phase advancement. This ensures the enforcement layer does not trap the user -- overrides are auditable but not prevented.

### Evidence-Supported vs. Speculative Gate Designs

| Design Element | Evidence Level | Source(s) |
|----------------|---------------|-----------|
| Code-enforced structural gates | STRONG | claude-code-harness (9 rules), academic rubber-stamp evidence |
| PreToolUse as state transition guard | STRONG | 3 harness implementations, official docs |
| Separate verifier agent for semantic gates | MODERATE | arXiv survey on cross-model evaluation, expedite Phase 24 concept |
| Structured output for verifier | MODERATE | LLM-as-judge best practices (evidentlyai, Arize) |
| Gate results in checkpoint data | MODERATE | Pattern documented in research, reasonable extension of checkpoint concept |
| Override audit via PostToolUse | MODERATE | ECC PostToolUse for logging, reasonable extension |
| SubagentStop hook for automatic semantic verification | SPECULATIVE | Mechanism confirmed available in plugins, but no repo demonstrates this pattern |
| Multi-agent debate for gate evaluation | NOT ADOPTED | Evidence exists (RADAR, multi-agent judge) but overkill for personal tool (User Decision 2) |

---

## Resume & Recovery Architecture

### Proven Resume Patterns

#### Checkpoint-Per-Skill (Generalized from Execute)
**Evidence: STRONG** (LangGraph per-node checkpoints [deterministic resume], expedite's own checkpoint.yml in execute skill [working implementation], ECC session summaries [handoff pattern])

Every skill gets a checkpoint file at `.expedite/checkpoint.yml` containing:

```yaml
current_skill: research
current_step: 7
step_label: "Dispatch web researchers"
substep: "waiting_for_agents"
continuation_notes: "3 of 5 web researchers dispatched. Agents 1-3 returned results. Agents 4-5 pending."
last_updated: 2026-03-12T14:30:00Z
inputs_hash: "abc123"  # Hash of inputs to current step for idempotency
```

Resume logic reads the checkpoint directly and jumps to `current_step`. No artifact-existence heuristics. No LLM interpretation of state. The checkpoint IS the resume state.

This is the exact pattern LangGraph uses (same checkpoint -> same resume point) adapted to expedite's file-based architecture. The adaptation is straightforward because expedite already has the pattern working in the execute skill.

### Evidence Strength for Checkpoint Granularity

**Evidence: STRONG** (LangGraph: per-graph-node, equivalent to per-step; ECC: per-session; expedite execute: per-task)

LangGraph checkpoints at every graph node execution (sub-step level). ECC checkpoints at session boundaries (coarse). Expedite's execute skill checkpoints at task level (medium granularity).

Design choice: **Step-level checkpointing** (not sub-step, not phase-level). Each skill has a defined sequence of steps. The checkpoint updates at each step transition. This is coarser than LangGraph (which checkpoints sub-steps) but finer than ECC (which checkpoints sessions).

Why step-level and not sub-step-level: Expedite's steps are themselves the atomic unit of orchestration. Within a step, the agent is doing work that may involve multiple tool calls but constitutes a single logical action. Checkpointing within a step would require the agent to checkpoint its own state, which the research does not demonstrate in any Claude Code plugin. Step-level checkpointing is the granularity that can be managed by the orchestration layer (skills) without requiring agent-level cooperation.

Why step-level and not phase-level: Phase-level checkpointing is expedite's current approach (track phase, not step). The research explicitly identifies this as the problem: "current_step is tracked but not used for resume." Phase-level resume forces the LLM to re-derive where it is within a phase, which is the heuristic approach that fails.

### Idempotency Strategy

**Evidence: MODERATE** (LangGraph checkpoint-as-idempotency-key, ECC content hashing, file-existence checks as fallback)

The checkpoint provides idempotency:
1. Before executing step N, check if `current_step >= N` in the checkpoint
2. If yes, the step has already completed -- skip it
3. If no, execute the step, then update the checkpoint to N
4. The `inputs_hash` field provides additional safety: if the inputs to step N have changed since the checkpoint was written (e.g., upstream artifacts were modified), re-execute even if the checkpoint says "done"

File-existence checking (expedite's current approach) is retained as a secondary verification. If the checkpoint says step 7 is complete but the expected artifact from step 7 does not exist, enter recovery mode. This catches the case where a checkpoint was written but the artifact write failed.

### Resume Protocol

On skill invocation (or context reset mid-skill):

1. Read `.expedite/checkpoint.yml`
2. If checkpoint exists and `current_skill` matches the invoked skill:
   a. Read `current_step` and `step_label`
   b. Verify artifacts expected from completed steps exist (secondary check)
   c. Report to user: "Resuming [skill] from step [N]: [label]"
   d. Jump to step N (if substep exists, provide continuation_notes as context)
3. If checkpoint exists but `current_skill` does not match:
   a. The previous skill completed or was abandoned
   b. Read `state.yml` to determine current phase
   c. Start the invoked skill from step 1
4. If no checkpoint exists:
   a. Start from step 1

### Gaps in Resume Evidence

1. **Mid-step crash recovery**: If a crash occurs between step execution and checkpoint write, the step ran but the checkpoint does not reflect it. The secondary artifact-existence check mitigates this for steps that produce artifacts. For steps that do not produce artifacts (e.g., "ask the user a question"), the step may be re-executed. This is acceptable -- re-asking a question is safe. Evidence for more sophisticated recovery: NONE in Claude Code plugin context.

2. **Checkpoint write atomicity**: If the checkpoint write itself fails (partial write), resume state is corrupted. The backup-before-write protocol (write to temp file, rename) provides defense. Evidence for Write tool atomicity: NONE (flagged as knowledge gap in research).

3. **Agent-level checkpointing**: If a subagent is dispatched at step 7 and the session crashes while the subagent is running, the subagent's partial work may exist on disk but the orchestrator does not know about it. The `continuation_notes` field in the checkpoint can record "agent dispatched, awaiting result" but cannot record the agent's internal progress. No surveyed repo addresses this. Evidence: NONE. Design accepts this limitation -- the user may need to re-run the agent.

---

## Context & Memory Strategy

### Evidence-Supported Context Patterns

#### Scoped Injection via State Splitting
**Evidence: STRONG** (MemGPT tiered memory principle, ECC hook-mediated loading, wshobson progressive disclosure, expedite's planned ARCH-02-06)

Each skill loads only the state files it needs via frontmatter injection:

| Skill | Loads |
|-------|-------|
| Scope | state.yml, checkpoint.yml |
| Research | state.yml, checkpoint.yml, questions.yml |
| Design | state.yml, checkpoint.yml |
| Plan | state.yml, checkpoint.yml |
| Spike | state.yml, checkpoint.yml |
| Execute | state.yml, checkpoint.yml, tasks.yml |
| Status | state.yml, checkpoint.yml, gates.yml |
| Override | state.yml, checkpoint.yml, gates.yml |

This eliminates token waste from loading irrelevant state (e.g., execute skill loading 30+ research questions). The MemGPT tiering principle (not all state belongs in context) directly validates this approach.

#### Session Summary Handoff
**Evidence: MODERATE** (ECC Stop/SessionStart hooks for session continuity)

The Stop hook writes a session summary. The SessionStart hook (with fallback) loads it. This creates a handoff document between sessions that provides the LLM with immediate orientation: what happened, where we are, what to do next.

The session summary is separate from the checkpoint. The checkpoint is machine-readable state for deterministic resume. The session summary is LLM-readable narrative context for orientation. Both are needed -- the checkpoint tells the system WHERE to resume, the summary tells the LLM WHY and WHAT the situation is.

#### PreCompact State Preservation
**Evidence: MODERATE** (ECC pre-compact.js)

Before context compaction, a PreCompact hook ensures the checkpoint and session summary are up to date. This prevents the failure mode where compaction discards conversational context that has not been persisted to disk.

### What Is Proven vs. Theoretical

| Pattern | Evidence Level | Status |
|---------|---------------|--------|
| Scoped injection (load only relevant files) | STRONG | Adopt in initial migration |
| Session summary handoff (Stop/SessionStart) | MODERATE | Adopt, with SessionStart fallback |
| PreCompact state preservation | MODERATE | Adopt (single source but clear value) |
| Progressive disclosure (metadata/instructions/resources tiers) | MODERATE | Not needed for expedite (skills are invoked explicitly, not context-activated) |
| Per-agent persistent memory | WEAK | Experiment with research agents; do not depend on it |
| Strategic compaction management (suggest-compact, autocompact threshold) | MODERATE | Defer (adds complexity, expedite sessions are shorter than ECC target) |
| Continuous learning / instincts | NOT ADOPTED | Designed for general-purpose harness, not decision-support workflow |

---

## Worktree Isolation

### Evidence from Real Implementations

**Evidence: ADEQUATE** (ccswarm: per-agent worktrees as core architecture; claude_code_agent_farm: 20+ parallel sessions with worktree isolation; official docs: `isolation: "worktree"` subagent field)

Two repos demonstrate worktree isolation in production. The official subagent schema makes adoption a single frontmatter field. The execute skill is the only expedite skill that modifies source code -- all other skills write to `.expedite/` directories where worktree isolation is unnecessary.

### Design

Execute agents get `isolation: "worktree"` in their subagent frontmatter. When an execute agent completes, if changes were made, the worktree path and branch are returned. The user manually reviews and merges. If no changes were made (e.g., agent failed), the worktree is automatically cleaned up.

No other skill gets worktree isolation. Research agents write to `.expedite/evidence/`, spike agents write to `.expedite/plan/phases/`, and design/scope/plan agents write to `.expedite/` artifacts. None of these touch source code.

### Known Failure Modes (with Sources)

| Failure Mode | Source | Mitigation |
|-------------|--------|------------|
| Merge conflicts | ccswarm docs, Agent Teams docs | Assign non-overlapping file responsibilities in agent prompts |
| Orphaned worktrees from crashes | Worktree guide (Verdent) | WorktreeRemove hook for cleanup; periodic `git worktree prune` |
| Multiple agents editing same files | Agent Teams docs | Execute skill dispatches one agent at a time per task (sequential, not parallel) |
| Unwanted worktree creation | Known Claude Code bug | Add EnterWorktree to disallowedTools for non-execute agents |

### Evidence Gap

No source documents the frequency of merge conflicts in practice or the effort required for manual merge-back. The design accepts manual merge as acceptable for a personal tool (User Decision 4) but the actual friction is unknown. Risk: LOW (execute agents work on specific, bounded tasks with clear file targets).

---

## Skill-Agent Interaction

### Evidence-Supported Boundary Patterns

**Evidence: MODERATE** (4 boundary patterns observed across repos, directional evidence favoring thin-skill/thick-agent with external enforcement)

The research documents 4 patterns:
1. Thick skill / thin agent (expedite current) -- skills at practical limits (860 lines)
2. Thin skill / thick agent (claude-code-harness) -- enforcement separate, skills are dispatchers
3. Plugin-per-concern (wshobson) -- many small components
4. Persona + swarm (agentic-framework) -- flexible single/multi-agent switching

### Confidence Level for Thin-Skill/Thick-Agent

**Evidence: MODERATE** (observational, not experimental; one primary source -- claude-code-harness)

The evidence supporting thin-skill/thick-agent is directional, not definitive:
- claude-code-harness demonstrates the pattern with clear separation of concerns
- expedite's thick skills have reached practical limits (860 lines for research)
- No controlled comparison exists between thick-skill and thin-skill approaches

The design adopts thin-skill/thick-agent because: (1) it aligns with the three-layer architecture (User Decision 1), (2) it resolves the practical problem of 860-line skills, and (3) the enforcement layer (hooks) takes over responsibility that currently bloats skills. But the evidence is that this pattern WORKS in claude-code-harness, not that it is BETTER than alternatives in a controlled sense.

### Design

Skills become step-sequencing dispatchers:
1. Read checkpoint to determine current step
2. For each step, assemble context (relevant state files, upstream artifacts)
3. Dispatch the appropriate agent with assembled context
4. Record step completion to checkpoint
5. Interact with user when needed (questions, gate results, override requests)

Agents become the workers:
1. Receive assembled context (not raw state files)
2. Produce artifacts
3. Return structured summaries
4. Do not manage state (that is the skill's job via checkpoint updates)

The skill does not evaluate quality (that is the hook layer's job). The agent does not manage phase transitions (that is the skill + hook layer's job together). This produces clean separation at the cost of more files (agent definitions, hook scripts) and more indirection (skill -> agent -> artifact -> hook validation).

---

## Migration Sequence

### Evidence-Supported Migration Patterns

**Evidence: MODERATE** (no surveyed repo documents their migration path from "before" to "after"; the incremental pattern is the user's preference and the conservative default)

The migration follows the user's Decision 3 (incremental hardening). Each phase delivers standalone value and can be validated before proceeding.

### Phase 1: State Splitting
- Split state.yml into state.yml + checkpoint.yml + questions.yml + gates.yml + tasks.yml
- Update all skill frontmatter to load only relevant files
- Update all Write operations to target the correct file
- **Value**: Immediate token savings, scoped injection, foundation for hook enforcement
- **Risk**: LOW (file splitting is mechanical; no new mechanisms)
- **Evidence**: STRONG (convergent pattern, planned as ARCH-02-06)

### Phase 2: Checkpoint-Based Resume
- Generalize checkpoint.yml to all skills (not just execute)
- Update each skill's resume logic to read checkpoint directly
- Remove artifact-existence heuristics as primary resume mechanism (retain as secondary)
- **Value**: Deterministic resume, eliminates "LLM misreads state" failure mode
- **Risk**: LOW (extending existing execute-skill pattern to other skills)
- **Evidence**: STRONG (LangGraph per-step, expedite's own execute precedent)

### Phase 3: State Write Enforcement Hook
- Implement PreToolUse command hook on Write matching state files
- Validate FSM transitions, schema conformance, gate passage
- Add PostToolUse audit trail hook
- **Value**: Makes invalid phase transitions structurally impossible, creates audit trail
- **Risk**: MODERATE (first hook adoption; potential for over-blocking; need to handle edge cases)
- **Evidence**: STRONG for the pattern (3 harnesses), WEAK for latency impact

### Phase 4: Structural Gate Enforcement
- Implement code-enforced validation for G1, G4 (fully structural)
- Implement structural rubric for G2, G3, G5 (the code-enforced layer)
- Gates run as scripts invocable from skills, with results written to gates.yml
- **Value**: Eliminates rubber-stamp for structural checks (3 of 5 gates)
- **Risk**: LOW (deterministic scripts; testable independently)
- **Evidence**: STRONG (claude-code-harness rule engine, academic rubber-stamp evidence)

### Phase 5: Agent Formalization
- Move agent prompt templates from `skills/{skill}/references/prompt-*.md` to `agents/` with full frontmatter
- Add tool restrictions, model assignments, maxTurns
- Update skill dispatch to use named agents
- **Value**: Tool isolation, model tiering, platform features (memory, hooks)
- **Risk**: MODERATE (restructuring agent dispatch; potential for broken references)
- **Evidence**: STRONG (official schema, 5 repo examples)

### Phase 6: Skill Thinning
- Refactor skills from 500-860 lines to 100-200 lines
- Move artifact generation logic into agent prompts
- Move quality evaluation into gate scripts (Phase 4) and verifier agents
- **Value**: Maintainable skills, clear separation of concerns
- **Risk**: MODERATE (largest refactoring; requires careful testing of each skill)
- **Evidence**: MODERATE (directional evidence from claude-code-harness)

### Phase 7: Semantic Gate Verifier
- Implement verifier agent for G3 and G5 semantic gates
- Dual-layer: structural rubric (already from Phase 4) + reasoning verifier (new agent)
- **Value**: Anti-rubber-stamp for semantic quality checks
- **Risk**: MODERATE (LLM-based evaluation is inherently variable; need to calibrate)
- **Evidence**: MODERATE (pattern documented, Phase 24 concept, no repo demonstrates exact pattern)

### Phase 8: Worktree Isolation
- Add `isolation: "worktree"` to execute agents
- Add EnterWorktree to disallowedTools for non-execute agents
- Test merge-back workflow
- **Value**: Source code isolation during execute phase
- **Risk**: LOW (single frontmatter field; manual merge-back accepted)
- **Evidence**: ADEQUATE (2 repos, official docs)

### Phase 9: Session Continuity
- Implement Stop hook for session summary
- Implement SessionStart hook with fallback
- Implement PreCompact hook for state preservation
- **Value**: Reliable session handoff, protection against compaction data loss
- **Risk**: MODERATE (SessionStart platform bug uncertainty)
- **Evidence**: MODERATE (ECC implementation, root fallback pattern)

### Risk Assessment Per Increment

| Phase | Risk | Evidence | Dependencies | Reversible? |
|-------|------|----------|-------------|-------------|
| 1. State splitting | LOW | STRONG | None | Yes (can re-merge files) |
| 2. Checkpoint resume | LOW | STRONG | Phase 1 (reads split files) | Yes (can revert to heuristic) |
| 3. State write hook | MODERATE | STRONG | Phase 1 (validates split state) | Yes (can remove hook) |
| 4. Structural gates | LOW | STRONG | Phase 1 (reads gates.yml) | Yes (can revert to prompt-enforced) |
| 5. Agent formalization | MODERATE | STRONG | None (can run independently) | Partially (frontmatter is additive) |
| 6. Skill thinning | MODERATE | MODERATE | Phase 5 (agents must be formalized) | Difficult (structural change) |
| 7. Semantic verifier | MODERATE | MODERATE | Phase 4 (structural rubric), Phase 5 (agent format) | Yes (can revert to prompt-enforced) |
| 8. Worktree isolation | LOW | ADEQUATE | Phase 5 (agent frontmatter) | Yes (remove frontmatter field) |
| 9. Session continuity | MODERATE | MODERATE | Phase 2 (checkpoint file) | Yes (can remove hooks) |

---

## Evidence Quality Map

| Design Element | Evidence Strength | Sources | Confidence | Key Risk |
|----------------|------------------|---------|------------|----------|
| PreToolUse state machine guard | STRONG | claude-code-harness, ECC, agentic-framework, official docs | HIGH | Over-blocking on edge cases |
| Directory-based state (file-per-concern) | STRONG | LangGraph, ECC, CrewAI, claude-code-harness, MemGPT | HIGH | Cross-file consistency if parallel phases ever added |
| Structural gate code enforcement | STRONG | claude-code-harness rule engine, academic rubber-stamp evidence | HIGH | Gate rules may be too rigid for edge cases |
| Checkpoint-based deterministic resume | STRONG | LangGraph, expedite execute skill, ECC session summaries | HIGH | Mid-step crash leaves ambiguous state |
| Agent formalization (subagent schema) | STRONG | Official docs, 5 repo examples | HIGH | Agent dispatch refactoring complexity |
| Model tiering (Haiku/Sonnet/Opus) | STRONG | 4 independent implementations | HIGH | Model availability/pricing changes |
| Three-layer architecture | MODERATE | claude-code-harness (primary), ECC (secondary) | MEDIUM | No controlled comparison with alternatives |
| Dual-layer rubric + reasoning gates | MODERATE | Research taxonomy, arXiv survey, Phase 24 concept | MEDIUM | No repo demonstrates exact pattern |
| Session summary handoff (Stop/SessionStart) | MODERATE | ECC implementation | MEDIUM | SessionStart platform bugs |
| PreCompact state preservation | MODERATE | ECC pre-compact.js | MEDIUM | Single source |
| Thin-skill/thick-agent boundary | MODERATE | claude-code-harness, observational evidence | MEDIUM | Optimal skill size unknown |
| Shell scripts for hook enforcement | WEAK | Pragmatic choice, no direct comparison | LOW | YAML parsing fragility in shell |
| Worktree isolation for execute | ADEQUATE | ccswarm, agent_farm, official docs | MEDIUM | Merge conflict frequency unknown |
| Per-agent persistent memory | WEAK | Official docs only, no repo demonstrates | LOW | Feature maturity unknown |
| SubagentStop for automatic verification | SPECULATIVE | Mechanism confirmed, no demonstration | LOW | Untested pattern |
| 100-200 line skill target | WEAK | Extrapolated from claude-code-harness | LOW | May be too aggressive or too lenient |
| Artifact structural validation hooks | MODERATE | Extension of state-guard pattern | MEDIUM | No repo validates artifacts at hook level |

---

## Risks & Open Questions

### Decisions with Weakest Evidence

1. **Shell vs. Node.js for hook scripts**: No source directly compares these options. The design chooses shell for simplicity but acknowledges YAML parsing in shell is fragile. If enforcement logic grows beyond simple field checks, migration to Node.js is recommended. Evidence: WEAK.

2. **Optimal skill line count (100-200 lines)**: Extrapolated from claude-code-harness's thin verb skills, which orchestrate fewer steps than expedite's skills. The real target may be 200-300 lines for complex skills like research (9 steps). Evidence: WEAK.

3. **SubagentStop for automatic gate evaluation**: The mechanism is confirmed available in plugin hooks, but no repo demonstrates using SubagentStop with agent hooks for quality verification. This is deferred to Phase 9+ and should be validated experimentally. Evidence: SPECULATIVE.

4. **Per-agent persistent memory**: The `memory` field is documented but undemonstrated in the surveyed repos. Enabling it for research agents is low-risk experimentation but no feature should depend on it. Evidence: WEAK.

### Areas Where the Design Extrapolates Beyond Research

1. **Artifact validation via PreToolUse hooks**: The state-guard pattern (PreToolUse on state file writes) is well-evidenced. Extending it to artifact validation (PreToolUse on SCOPE.md writes to check structural completeness) is a reasonable extrapolation but lacks direct precedent. The design marks this as lower priority.

2. **Override compatibility with code-enforced gates**: The research documents auditable overrides (expedite's existing pattern) and code-enforced gates (claude-code-harness) separately. No source shows how overrides work with code-enforced gates. The design proposes writing override records to gates.yml that the PreToolUse hook recognizes as valid gate passage. This is architecturally sound but untested.

3. **Checkpoint + session summary as dual resume mechanism**: The research documents checkpoint-based resume (LangGraph) and session summary handoff (ECC) as separate patterns. The design combines both (checkpoint for deterministic state, summary for LLM orientation). This combination is not demonstrated by any source but is a logical synthesis of complementary patterns.

### What Needs Validation Before Commitment

1. **Hook latency in practice**: The design assumes command hooks add acceptable latency (~100ms per write). This is a qualitative claim without benchmarks. Validate by implementing the PreToolUse state-guard hook (Phase 3) and measuring actual latency on representative workloads.

2. **`yq` reliability for YAML validation in hooks**: The design depends on `yq` for parsing YAML in shell hook scripts. Validate by writing the state-guard script and testing with edge cases (empty files, malformed YAML, very large state files).

3. **SessionStart hook stability**: Three platform bugs may have been resolved. Test SessionStart in a minimal plugin before depending on it for context loading. The fallback (frontmatter injection) ensures no feature is blocked.

4. **Override + hook interaction**: Validate that the override-record-in-gates.yml pattern actually works with the PreToolUse state-guard hook. Test the full flow: user requests override -> override recorded -> phase advancement allowed.

5. **Agent formalization dispatch**: Validate that agents defined in the plugin's `agents/` directory can be dispatched by name from skills, that tool restrictions are enforced, and that model assignments work. Test with one agent before migrating all six.

### Platform Assumptions That Could Be Wrong

1. **Write tool provides tool_input to PreToolUse hooks**: The design assumes PreToolUse hooks receive the proposed file content (tool_input.content) and file path (tool_input.file_path) in stdin JSON. This is documented in the hooks reference but not verified experimentally. If the input format differs, the state-guard hook cannot parse proposed state changes.

2. **Plugin hooks.json has the same semantics as project settings hooks**: The supplement-synthesis confirmed schema parity, but behavioral parity (ordering, priority, interaction with project-level hooks) is assumed, not verified.

3. **Command hooks can read from stdin and write to stdout**: The design relies on the documented pattern where hook scripts receive JSON on stdin and output JSON on stdout. If stdin is not available or stdout is not parsed, the hooks cannot function.

4. **Exit code 2 blocks Write operations**: The design depends on exit code 2 from PreToolUse hooks blocking the tool call. This is the documented behavior for command hooks but must be verified in the plugin hook context.

5. **`disallowedTools` in subagent frontmatter is enforced**: The design uses disallowedTools to prevent research agents from using Write/Edit. If this field is advisory rather than enforced, tool isolation does not work.
