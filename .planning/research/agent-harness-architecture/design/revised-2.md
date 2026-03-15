# Revised Design Resolution 2: Agent Harness Architecture (Sustainability & Maintainability Lens)

## Revision Summary

The core sustainability architecture held firm: three-layer separation, minimal hook set expanding only on demonstrated need, Node.js for hook scripts, file-per-concern state with YAML, and incremental migration ordered by maintenance-burden reduction. Three substantive changes were made in response to validator feedback: (1) the Stop hook no longer writes checkpoint.yml -- skills write checkpoints at step boundaries, and the Stop hook writes only a session-summary.md for session handoff; (2) G2 is reclassified from fully structural to structural + light semantic, acknowledging that readiness assessment quality involves judgment; (3) agent persistent memory is adopted selectively for synthesizer and verifier agents as a low-risk experiment (not a dependency). Additionally, the override mechanism is now fully specified, gates.yml writes are hook-protected against fabrication, and SessionStart deferral is softened from "indefinite" to "until platform bugs are confirmed fixed."

## Validator Response Log

| # | Validator | Issue | Response | Impact |
|---|-----------|-------|----------|--------|
| 1 | V1 (Coherence) | Agent memory deferred too aggressively -- synthesizer and verifier benefit from cross-lifecycle learning | **Accept.** The maintenance surface of 2 agents with `memory: project` is bounded. No feature depends on memory working. The sustainability risk is low enough to justify the experiment. | Added selective memory for 2 agents with explicit experimental framing and discard criteria. |
| 2 | V1 (Coherence) | G2 classified as fully structural -- readiness assessment quality is semantic judgment | **Accept.** Determining whether evidence is "sufficient" for a decision area requires judgment beyond field-existence checking. The sustainability cost of a lightweight semantic check on G2 is modest (one additional verifier invocation per lifecycle). | Reclassified G2 as structural + light semantic. Added verifier agent invocation for G2. |
| 3 | V1 (Coherence) | Agent definition location inconsistency -- needs explicit precedence clarification | **Accept.** The original text was vague about the plugin `agents/` directory vs. `.claude/agents/`. | Added explicit precedence statement: plugin `agents/` is primary, `.claude/agents/` project-level overrides take precedence per official priority ordering. |
| 4 | V1 (Coherence) | Stop hook as checkpoint writer is problematic -- Stop hook lacks context to determine current step accurately | **Accept.** This was a genuine design flaw. The Stop hook fires when the session ends, which may be mid-step. Writing a checkpoint at that point means either writing stale data or guessing. Skills know the current step; hooks do not. | Stop hook now writes session-summary.md only. Skills write checkpoints at step boundaries. |
| 5 | V1 (Coherence) | Missing override mechanism detail -- how does user-initiated override interact with PreToolUse hook? | **Accept.** The original design mentioned overrides but did not specify the mechanism. | Added complete override flow specification adopted from Proposal 1's step-by-step design. |
| 6 | V2 (Research) | SessionStart "defer indefinitely" overstates the risk -- C4 says "deferred," not "excluded" | **Modify.** The original stance was too aggressive. The sustainability lens correctly identifies the risk, but "defer indefinitely" is not what the user decided. The user said "deferred due to platform bugs" -- implying eventual adoption. However, the design should not invest effort in a fallback pattern for an unreliable hook when frontmatter injection already covers the use case. | Changed from "defer indefinitely" to "defer until platform bugs confirmed fixed." Frontmatter injection remains the primary mechanism. No fallback pattern is pre-built -- SessionStart is added as a simple enhancement once reliable. |
| 7 | V2 (Research) | Claim that "agent hooks for gate evaluation would add 30-60 seconds to every state write" is misleading -- SubagentStop fires on agent completion, not every Write | **Accept.** The original framing conflated PreToolUse agent hooks (which would fire on writes) with SubagentStop agent hooks (which fire on agent completion). The latency concern for SubagentStop is valid but the "every state write" framing was inaccurate. | Corrected the risk description. SubagentStop remains deferred, but the reasoning is now accurate: it adds complexity (a hook that must validate verifier output completeness) when the skill can perform the same check after the agent returns. |
| 8 | V2 (Research) | Proposal 2's "agents never write state" constraint is stronger than the user decision requires | **Defend.** The user asked for three-layer separation. The strongest maintenance property of three-layer separation is that agents produce artifacts and skills manage state. If agents write state, they take on orchestration responsibility, creating a debugging problem: "which layer wrote this state?" The constraint is an interpretation of the user decision, but it is the most maintainable interpretation. The alternative (agents can write state, but hooks validate it) requires the hook to distinguish skill-initiated from agent-initiated writes -- adding enforcement complexity without clear benefit. | No change. This remains a design invariant. |
| 9 | V1 (Coherence) | gates.yml integrity is unprotected -- fabricated gate results bypass enforcement | **Accept.** This was a genuine gap across all proposals. The entire value of code-enforced gates is undermined if an agent can write a fake gate result. | Added PreToolUse validation for gates.yml writes. Gate results must match the expected gate for the current phase and must contain valid structural fields. |

## Adopted Elements from Other Proposals

| Element | Source | Why Adopted | Sustainability Impact |
|---------|--------|-------------|----------------------|
| Override flow step-by-step | Proposal 1 | The original design mentioned overrides but did not specify the mechanism. P1's step-by-step flow (write override to gates.yml, hook recognizes `overridden: true`, audit trail created) is concrete and verifiable. | Low -- adds ~10 lines to the PreToolUse hook's gate-checking logic and a field to gates.yml schema. |
| Agent memory scoped to synthesizer and verifier | Proposal 1 | P1's argument that synthesizer and verifier benefit from cross-lifecycle learning while ephemeral agents should not accumulate stale context is sound. The maintenance surface is bounded to 2 agents. | Low -- `memory: project` is a single frontmatter field per agent. The MEMORY.md files are developer-inspectable and deletable. |
| `EnterWorktree` in `disallowedTools` for non-execute agents | Proposal 3 | A specific failure mode (accidental worktree creation by non-execute agents) that is cheaply prevented. One line per agent definition. | Negligible -- one entry in a denylist. |
| Evidence quality map concept | Proposal 3 | The risk section now includes explicit evidence-strength ratings per design element. This does not change the design but improves the transparency of which decisions rest on strong vs. weak foundations. | No implementation cost -- documentation improvement only. |
| Checkpoint vs. session summary as dual mechanism | Proposal 3 | The distinction between checkpoint (machine-readable resume state, written by skills at step boundaries) and session summary (LLM-readable orientation narrative, written by Stop hook) is cleaner than the original design's single checkpoint mechanism. | Slightly increases the Stop hook's responsibility (it now writes a markdown file instead of a YAML file) but makes the boundary clearer. |

---

## Revised Design

## Design Summary

*[Revised: Clarified Stop hook role, G2 classification, agent memory stance, override mechanism, gates.yml protection.]*

The expedite agent harness architecture is a three-layer system -- Enforcement, Orchestration, Execution -- that replaces prompt-enforced behavioral rules with deterministic code enforcement where possible and cost-controlled LLM evaluation where necessary. The sustainability lens drives three overarching tradeoffs: (1) prefer command hooks over agent hooks at every opportunity, because a 100ms script that never hallucinates will always be cheaper and more reliable than a 30-second LLM call that might rubber-stamp; (2) prefer file-per-concern state over any event-sourced or checkpoint-snapshot system, because the simplest state design that solves the token waste and resume problems is the one with the lowest maintenance burden; (3) prefer incremental migration over architectural leaps, because each hardening step must deliver standalone value and be independently reversible. The result is an architecture with the fewest moving parts that still achieves deterministic gate enforcement, reliable resume, scoped context injection, and execute-phase isolation.

---

## User Decisions Applied

| # | Decision | How It Shaped the Design |
|---|----------|--------------------------|
| 1 | **Three-layer separation** (Enforcement + Orchestration + Execution) | The entire architecture is organized around these three layers, with explicit boundaries and information flow contracts between them. Skills shrink to ~100-200 line dispatchers, agents grow to carry full frontmatter, and enforcement moves entirely into hooks and scripts. |
| 2 | **Dual-layer rubric + reasoning for semantic gates** | G3 and G5 use a two-pass evaluation: structural rubric (code-enforced, deterministic) followed by reasoning soundness check (separate verifier agent). Multi-agent debate was excluded as overkill for a personal tool. |
| 3 | **Incremental hardening migration** | The migration sequence is ordered so each phase delivers standalone value. No phase depends on a future phase to be useful. Each phase can be validated before the next begins. |
| 4 | **Worktree isolation for execute-only** | Only execute-skill agents get `isolation: "worktree"`. All other skills write to `.expedite/` directories only, where conflict risk is negligible. Non-execute agents include `EnterWorktree` in `disallowedTools` to prevent accidental worktree creation. |

**Constraints carried forward:**
- C1: All mechanisms must work within Claude Code's plugin API surface
- C2: Full rebuild acceptable, but incremental preferred (per Decision 3)
- C3: Personal/team tool -- configuration complexity is acceptable
- C4: SessionStart hook deferred until platform bugs confirmed fixed; frontmatter injection is the primary context-loading mechanism
- C5: The lifecycle pipeline (scope -> research -> design -> plan -> spike -> execute) is fixed

---

## Agent-Resolved Contested Areas

### CA-1: How Many Hooks Are Actually Needed?

**Question**: The research documents 16 hook event types. How many should expedite register?

**Resolution**: Start with 3 hook events, expand to 5 maximum.

**Minimal viable set (Phase 1):**
1. `PreToolUse` (matcher: `Write`) -- state transition guard, schema validation, gate passage enforcement, gates.yml write protection
2. `Stop` -- session summary persistence for session handoff
3. `PreCompact` -- save critical state before context compaction

*[Revised: Stop hook purpose changed from "checkpoint persistence" to "session summary persistence." Checkpoint writes moved to skills at step boundaries.]*

**Extended set (Phase 2, only if justified by observed failures):**
4. `SubagentStop` -- gate evaluation trigger after agent completion
5. `PostToolUse` (matcher: `Write`) -- audit trail for state changes and gate overrides

**Reasoning**: Every hook is maintenance surface area. Each hook script must be written, tested, and kept compatible with Claude Code API updates. The research shows ECC uses hooks at "all 4 lifecycle phases" but ECC is a general-purpose harness serving all projects -- expedite is a single-purpose pipeline with a fixed workflow. Three hooks cover the critical enforcement points: preventing invalid state writes and gate fabrication (PreToolUse), recording session context for handoff (Stop), and protecting state during compaction (PreCompact). The cost of maintaining 3 hook scripts is low. The cost of maintaining 10+ is not proportional to the benefit.

**Evidence**: claude-code-harness uses only 3 hook events (SessionStart, PostToolUse, Stop) and achieves comprehensive enforcement through those three plus its TypeScript engine. This demonstrates that a small hook surface with a capable enforcement engine behind it is sufficient.

### CA-2: State Format -- YAML vs JSON for Split State Files

**Question**: The research shows LLMs handle YAML and JSON comparably. Which format for the split state files?

**Resolution**: Keep YAML for all state files.

**Reasoning**: Expedite already uses YAML throughout (state.yml, SCOPE.md frontmatter). Switching to JSON adds a format transition cost with no demonstrated benefit. The research finding is that "the differentiator is injection strategy, not format." YAML is marginally more human-readable for manual debugging (a real activity for a personal tool). The hook scripts will use a YAML parser (js-yaml for Node.js) -- one dependency, one parser, one format. Introducing JSON would mean either mixing formats (confusion) or migrating all existing YAML (pointless churn).

**Evidence**: Research synthesis explicitly states "LLMs handle YAML and JSON comparably." No source found any reliability difference. The only advantage JSON has -- native parsing in JavaScript -- is offset by YAML's advantage in human readability and consistency with the existing codebase.

### CA-3: Hook Implementation Language

**Question**: Hook scripts can be shell scripts, Node.js, or any executable. Which language?

**Resolution**: Node.js (JavaScript) for all hook scripts.

**Reasoning**: Shell scripts are fastest (~100ms) but fragile across platforms and hard to test. TypeScript (like claude-code-harness) requires a build step that adds maintenance burden -- every change requires compilation. Node.js scripts execute directly, work cross-platform, can parse YAML/JSON natively with a single dependency (js-yaml), are testable with standard frameworks (Jest/Vitest), and run fast enough (Node.js startup is ~50-100ms, total hook execution ~100-200ms). The sustainability lens strongly favors "runs without a build step" over "maximum type safety."

**Evidence**: ECC uses Node.js hook scripts for cross-platform reliability. claude-code-harness uses TypeScript but requires compilation. For a personal tool where the maintainer is also the user, the build step is pure overhead.

### CA-4: Checkpoint Granularity

**Question**: LangGraph checkpoints at every graph node. Should expedite checkpoint at every step, or at coarser granularity?

**Resolution**: Checkpoint at step boundaries only (not sub-step), using a single `checkpoint.yml` per skill invocation.

**Reasoning**: LangGraph's per-node checkpointing makes sense for a general-purpose framework where the execution graph is dynamic. Expedite's skills have fixed, numbered steps (scope has 9, design has 10). Checkpointing at step boundaries is sufficient for deterministic resume -- the research confirms "step-level is sufficient granularity" and LangGraph's per-node maps to per-step. Sub-step checkpointing (e.g., within a convergence loop) adds file I/O overhead and checkpoint management complexity without proportional resume improvement. If a crash occurs mid-step, re-running that step from the beginning is acceptable -- steps are designed to be independently executable.

**Evidence**: LangGraph documents per-node checkpointing as sufficient. Expedite's existing execute-skill checkpoint.yml works at task-level granularity (equivalent to per-step) and is described as "the most sophisticated resume mechanism in expedite's codebase." Generalizing this proven pattern is lower-risk than inventing a new one.

### CA-5: Agent Memory -- Enable or Defer?

*[Revised: Changed from blanket deferral to selective enablement for 2 agents.]*

**Question**: Claude Code supports per-agent persistent memory. Should expedite agents use it?

**Resolution**: Enable `memory: project` for the research-synthesizer and gate-verifier agents only. All other agents remain stateless. No feature depends on memory working correctly.

**Reasoning**: The sustainability concern about adding state surfaces is valid, but the maintenance surface of 2 agents with project-scoped memory is bounded and manageable. The synthesizer benefits from learning which evidence patterns are most useful across lifecycles. The verifier benefits from learning common failure patterns. Both are long-lived roles that process similar artifact types across lifecycles -- exactly the pattern where persistent memory has the highest expected value. Individual research agents, implementers, and other ephemeral agents should not accumulate stale context. The key sustainability constraint is: memory is an experiment, not a dependency. If the MEMORY.md files drift or become unhelpful, the developer can delete them and the system continues to function identically.

**Experimental criteria for retention**: After 3 lifecycles, check whether the synthesizer and verifier MEMORY.md files contain content that the developer considers valuable. If yes, retain. If the files contain generic platitudes or stale context, remove memory from those agents.

**Evidence**: Evidence for agent persistent memory improving pipeline architectures is WEAK (official docs only, no repo demonstrates the pattern for pipeline agents). This is an evidence-weak adoption explicitly justified by low cost and bounded risk, not by strong evidence.

### CA-6: SessionStart Hook -- Use or Skip?

*[Revised: Softened from "exclude entirely" to "defer until bugs confirmed fixed."]*

**Question**: Three platform bugs historically blocked SessionStart. Should the design include it?

**Resolution**: Defer SessionStart until platform bugs are confirmed fixed. Use frontmatter injection as the primary context-loading mechanism and the Stop hook for session handoff via session-summary.md. Do not pre-build a fallback pattern.

**Reasoning**: The original design said "defer indefinitely," which overstated the position. Constraint C4 says "deferred due to bugs" -- deferred implies eventual adoption, not permanent exclusion. The revised stance: frontmatter injection is the primary mechanism. It works reliably, requires no platform-dependent hooks, and is already proven in the current codebase. When SessionStart bugs are confirmed fixed in a Claude Code release, adding a SessionStart hook is a small, low-risk enhancement: load checkpoint.yml, report resume status, orient the session. No complex fallback pattern is needed because frontmatter injection already provides the baseline functionality.

**Evidence**: Research explicitly flags SessionStart bug status as a knowledge gap. The sustainability lens says: do not invest design effort in fallback patterns for unreliable mechanisms when a reliable alternative already exists. Unlike the original framing, this does not say "never adopt SessionStart" -- it says "adopt it when it is reliable, and do not build workarounds in the meantime."

---

## Three-Layer Architecture

### Layer 1: Enforcement (hooks + scripts)

**Responsibility**: Prevent invalid state transitions, enforce gate passage, protect gate results from fabrication, validate schema, maintain audit trail. This layer answers: "Is this action allowed right now?"

*[Revised: Added gates.yml write protection to enforcement responsibilities.]*

**What lives here**:
- `hooks/hooks.json` -- hook event registrations (3-5 hooks)
- `hooks/validate-state-write.js` -- PreToolUse handler for Write interception (state files AND gates.yml)
- `hooks/persist-session-summary.js` -- Stop handler for session summary writes
- `hooks/pre-compact-save.js` -- PreCompact handler for state preservation
- `hooks/lib/state-schema.js` -- YAML schema definitions and validators
- `hooks/lib/fsm.js` -- finite state machine transition rules
- `hooks/lib/gate-checks.js` -- structural gate evaluation functions

*[Revised: Renamed persist-checkpoint.js to persist-session-summary.js. Added gate-checks.js.]*

**Information flow**: Hooks receive tool input via stdin JSON, read state files from `.expedite/` for context, and return allow/deny decisions via exit codes. Hooks never modify state directly -- they only gate whether state modification is permitted.

**Maintenance burden**: Low. The FSM transitions are a simple lookup table (current_phase + target_phase -> allowed?). Schema validators are declarative. The hooks themselves are thin dispatchers to the lib functions. When a new skill is added, only the FSM transition table needs updating. When a gate criterion changes, only the schema validator or gate-check function needs updating. No build step required.

**Token cost**: Zero. Command hooks execute outside the LLM context. They consume no tokens. This is the strongest argument for code-enforced gates -- every check moved from prompt to hook saves tokens on every invocation.

### Layer 2: Orchestration (thin skills)

**Responsibility**: User-facing workflow coordination. Sequence steps, dispatch agents, assemble context, handle user interaction, write checkpoints at step boundaries. This layer answers: "What should happen next?"

*[Revised: Explicitly noted that skills write checkpoints.]*

**What lives here**:
- `skills/{name}/SKILL.md` -- step sequencer (~100-200 lines each, down from 500-860)
- Frontmatter with scoped state injection (only load relevant state files)
- Step definitions: what to do, which agent to dispatch, what context to pass
- User interaction points (questions, confirmations, overrides)
- Recovery preamble reading checkpoint state for resume
- Checkpoint writes at each step boundary

**Information flow**: Skills read state files via frontmatter injection (scoped). Skills dispatch agents via the Agent tool. Skills write state transitions (which the enforcement layer validates). Skills read agent results from artifacts. Skills write checkpoint.yml at step boundaries to record progress for resume.

**Maintenance burden**: Low. Skills become declarative step sequences. The logic that currently lives in skills (validation, gate evaluation, state management) moves to the enforcement layer and agents. Adding a step means adding a step entry and possibly an agent definition. The 500-line soft cap becomes naturally achievable.

**Token cost**: Moderate. Skills are loaded into context when invoked. At 100-200 lines, each skill costs ~1,000-2,000 tokens. Scoped state injection reduces the state injection cost from "everything" to "only what this skill needs" -- estimated 50-70% reduction in state tokens.

### Layer 3: Execution (thick agents)

**Responsibility**: Perform specialized work. Research, synthesize, evaluate, generate artifacts. This layer answers: "How should this specific task be done?"

**What lives here**:
- `agents/{name}.md` -- formal agent definitions with full frontmatter (plugin's `agents/` directory)
- Agent body contains the detailed instructions, rubrics, and output format specifications that currently live in `skills/{name}/references/prompt-*.md`
- Agent frontmatter specifies model tier, tool restrictions, memory (for select agents), and isolation (for execute agents)

*[Revised: Clarified agent location as plugin's agents/ directory. Added memory and isolation to frontmatter mentions.]*

**Agent location precedence**: Plugin-provided agents live in the plugin's `agents/` directory and are loaded via the plugin API. Project-level overrides in `.claude/agents/` take precedence per the official priority ordering (CLI flag > project `.claude/agents/` > user `~/.claude/agents/` > plugin `agents/`). For expedite, the plugin directory is the primary location -- agents are distributed with the plugin.

**Information flow**: Agents receive context from the orchestrating skill's dispatch prompt (assembled from state files and prior artifacts). Agents write results to artifact files. Agents return a summary to the orchestrating skill. Agents have no direct access to state files for writing -- they produce artifacts, and the skill updates state.

**Maintenance burden**: Moderate. Agents are the largest files in the system (replacing the current prompt templates). However, each agent is self-contained and independently modifiable. Changes to one agent cannot break another. The formal frontmatter schema provides structure. The main maintenance cost is keeping agent instructions aligned with gate criteria -- when gate criteria change, agent output instructions must also change.

**Token cost**: Variable by model tier. Haiku agents (~exploration) cost ~10x less per token than Opus agents (~synthesis, verification). The model tiering strategy ensures expensive models are used only where judgment quality matters.

### Inter-Layer Information Flow

```
User
  |
  v
[Orchestration: SKILL.md]
  |-- reads --> .expedite/state.yml, .expedite/checkpoint.yml (via frontmatter)
  |-- dispatches --> [Execution: agent.md] --> writes artifacts
  |-- writes checkpoint --> .expedite/checkpoint.yml (at step boundaries)
  |-- writes state --> [Enforcement: hooks] --> allow/deny
  |
  v
Artifacts on disk
```

*[Revised: Added checkpoint write to flow diagram.]*

**Critical constraint**: Information flows downward (orchestration dispatches execution) and is gated at write time (enforcement validates orchestration's state writes). Agents never write state directly. Hooks never dispatch agents. Skills write checkpoints at step boundaries (not hooks). This unidirectional flow is the key maintenance property -- debugging means "follow the write."

---

## Hook Architecture

### Hook Event Set

| Hook Event | Handler | Script | Fires When | Purpose |
|------------|---------|--------|------------|---------|
| `PreToolUse` | command | `validate-state-write.js` | Any Write to `.expedite/` files | State transition guard, schema validation, gates.yml write protection |
| `Stop` | command | `persist-session-summary.js` | Skill/session ends | Write session-summary.md for session handoff |
| `PreCompact` | command | `pre-compact-save.js` | Before context compaction | Preserve critical state |

*[Revised: Stop handler renamed and purpose changed. PreToolUse now includes gates.yml protection.]*

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

The Write matcher intercepts ALL Write tool calls. The script itself inspects `tool_input.file_path` and only performs validation when the target is an `.expedite/` state file or gates.yml. Non-state writes pass through immediately (exit code 0). This is simpler than attempting regex-based path matching in the matcher, which is designed for tool names, not file paths.

### What Each Hook Enforces

**PreToolUse (validate-state-write.js)**:

*[Revised: Added gates.yml validation logic at step 5.]*

1. Parse stdin JSON for `tool_input.file_path` and `tool_input.content`
2. If path is not an `.expedite/*.yml` state file, exit 0 (allow)
3. If path is `state.yml`:
   - Parse proposed YAML content
   - Validate schema (required fields, valid values)
   - Check phase transition against FSM (is current -> proposed a valid transition?)
   - If transitioning to a `_complete` phase, verify gate passage exists in `gates.yml`
   - If gate result shows `overridden: true`, allow transition (override is a valid passage type)
   - Exit 0 (allow) or exit 2 (deny with `permissionDecisionReason`)
4. If path is `checkpoint.yml`, `questions.yml`, or `tasks.yml`:
   - Validate schema for that specific file type
   - Exit 0 or exit 2
5. If path is `gates.yml`:
   - Parse proposed content
   - Validate schema (each entry must have gate, timestamp, outcome)
   - Verify that the gate being written matches the expected gate for the current phase (read `state.yml` to determine current phase)
   - Verify that gate result fields are structurally valid (outcome is a valid enum value, gate name is a valid G1-G5 identifier)
   - Exit 0 or exit 2

**Stop (persist-session-summary.js)**:

*[Revised: Completely changed from checkpoint writer to session summary writer.]*

1. Read current `.expedite/state.yml` to determine active skill and phase
2. Read current `.expedite/checkpoint.yml` if it exists
3. Write `.expedite/session-summary.md` containing:
   - Current phase and skill
   - Current step (from checkpoint, if available)
   - What was accomplished this session (from checkpoint's continuation_notes)
   - What should happen next (from step + state)
4. This file provides LLM-readable orientation for the next session. It is a narrative summary, not machine-readable resume state. Resume is handled deterministically by checkpoint.yml (written by skills).

**PreCompact (pre-compact-save.js)**:
1. Read `.expedite/checkpoint.yml` and `.expedite/state.yml`
2. Write a compact summary to `.expedite/compact-context.md` containing:
   - Current phase and step
   - What was accomplished (from checkpoint)
   - What should happen next (from step + state)
3. This file is referenced by skill frontmatter for post-compaction resume

### Override Mechanism

*[Revised: Added complete override specification, adopted from Proposal 1.]*

When a hook blocks a state write (e.g., phase transition without gate passage), the developer has two paths:

1. **Address the issue**: Run the required gate, complete the missing step, or fix the validation error. This is the expected path.
2. **Override**: The developer explicitly tells the skill to override the gate (e.g., "override G1, reason: scope is sufficient for this exploratory spike"). The skill:
   a. Writes a gate entry to `gates.yml` with `outcome: overridden`, `reason: <user's reason>`, and `timestamp`
   b. The PreToolUse hook validates the gates.yml write (schema check, gate-phase match check)
   c. The skill retries the state write -- the PreToolUse hook allows transitions when an `overridden` outcome exists for the required gate
   d. If PostToolUse is enabled (Phase 2 hook), it logs the override to an append-only audit trail

Overrides are never silent. They produce gate_history records in gates.yml with explicit reasons. The developer can always trace why a phase was advanced. Override records are immutable once written -- they cannot be removed or modified by agents.

### Latency Budget

| Hook | Expected Latency | Acceptable? |
|------|-----------------|-------------|
| PreToolUse (state write) | 100-200ms (Node.js YAML parse + validate) | Yes -- Write calls are infrequent (a few per skill run) |
| Stop | 100-200ms | Yes -- fires once at session/skill end |
| PreCompact | 100-200ms | Yes -- fires rarely (auto-compaction or manual) |

All hooks are command type, meaning no LLM calls, no network calls, no build step. Total latency overhead per skill invocation: ~300-600ms across all hook firings. This is imperceptible relative to the minutes-to-hours of a skill's execution.

### Failure Modes and Graceful Degradation

| Failure | Impact | Mitigation |
|---------|--------|------------|
| Hook script crashes (exit 1) | Non-blocking -- logged, execution continues | Log error to `.expedite/hook-errors.log`. Script should catch exceptions and exit 1, not crash silently. |
| Hook blocks valid write (false positive) | Blocks skill progress | `permissionDecisionReason` explains why. User can check the reason, fix the issue, or -- as a last resort -- temporarily disable the hook via plugin settings. |
| Hook allows invalid write (false negative) | State corruption | Mitigated by schema validation being strict by default. FSM transitions are exhaustively enumerated, so false negatives only occur if the FSM table itself is wrong. |
| Hook script missing/not found | Non-blocking error | Claude Code logs the error. Skill continues without enforcement. This is the fallback for development/debugging. |

### Long-Term Maintenance

Hook scripts are the most maintenance-sensitive component because they interact with Claude Code's undocumented stdin JSON format. Mitigations:

1. **Minimal parsing**: Extract only the fields needed (`tool_input.file_path`, `tool_input.content`). Do not depend on the full stdin schema.
2. **Version pinning**: Document the Claude Code version each hook was tested against. If the stdin format changes, the hook script fails loudly (schema validation error on input), not silently (incorrect behavior).
3. **Test suite**: Each hook script should have unit tests with sample stdin JSON. Tests run outside Claude Code, making them fast and reliable.
4. **Single dependency**: Only `js-yaml` for YAML parsing. No framework, no build toolchain.

### Platform Assumption: Hooks Fire on Subagent Writes

*[Revised: Added explicit flag for the highest-risk platform assumption.]*

The enforcement architecture assumes that plugin-level PreToolUse hooks fire when a subagent (not just the main skill) uses the Write tool. This is architecturally expected (hooks are registered at the plugin level and should intercept all tool calls in the session), but has not been explicitly verified. If this assumption is wrong, the "agents never bypass enforcement" invariant has a critical gap. This assumption must be verified early in implementation (M2) before committing to the enforcement architecture.

---

## State Management Architecture

### File-Per-Concern Structure

| File | Contents | Size Estimate | Injected By |
|------|----------|---------------|-------------|
| `.expedite/state.yml` | Core identity: lifecycle_id, project_name, current_phase, current_skill, started_at | ~15 lines | All skills (frontmatter) |
| `.expedite/checkpoint.yml` | Resume data: skill, step, label, timestamp, artifacts_present, continuation_notes | ~20 lines | Resume preamble in all skills |
| `.expedite/questions.yml` | Research questions: list of {id, text, category, status} | Variable (20-80 lines) | Scope, research skills only |
| `.expedite/gates.yml` | Gate history: list of {gate, timestamp, outcome, reason, details} | Variable (20-50 lines) | Gate evaluation scripts, status skill |
| `.expedite/tasks.yml` | Execute tasks: list of {id, title, status, phase, assigned_agent} | Variable (20-100 lines) | Plan, spike, execute skills only |
| `.expedite/session-summary.md` | LLM-readable session handoff narrative | ~10-20 lines | Stop hook writes, skills read via frontmatter |
| `.expedite/compact-context.md` | Compact summary for post-compaction orientation | ~10-15 lines | PreCompact hook writes, skills read via frontmatter |
| `.expedite/log.yml` | Append-only telemetry (existing) | Growing | Status skill (read-only) |

*[Revised: Added session-summary.md and compact-context.md to file structure. Added "reason" to gates.yml fields for override support.]*

### Write Patterns

**state.yml**: Complete-file rewrite (the current pattern), but now validated by the PreToolUse hook before every write. The hook validates schema and FSM transitions. The file is small (~15 lines) so complete rewrite is efficient and atomic.

**checkpoint.yml**: Complete-file rewrite at step boundaries. Written by skills at explicit checkpoint points within step logic. Small file, infrequent writes.

*[Revised: Checkpoint writes are by skills only, not by the Stop hook.]*

**questions.yml, tasks.yml**: Complete-file rewrite by the owning skill. Each file is owned by a small number of skills, reducing conflict risk. The PreToolUse hook validates schema on write.

**gates.yml**: Complete-file rewrite by the gate skill or by skills recording override decisions. The PreToolUse hook validates schema, gate-phase consistency, and outcome enum values.

*[Revised: gates.yml is now hook-validated.]*

**session-summary.md**: Written by the Stop hook. Overwritten each session. Not validated by the PreToolUse hook (it is a markdown file, not a YAML state file).

**log.yml**: Append-only (existing pattern). Not validated by hooks -- it is an audit trail, not control state.

### Validation

Each file type has a schema definition in `hooks/lib/state-schema.js`:

- **state.yml schema**: required fields (lifecycle_id, current_phase), valid phase values (enum), valid phase transitions (FSM adjacency matrix)
- **checkpoint.yml schema**: required fields (skill, step, timestamp), step must be a positive integer or the string "complete", skill must be a known skill name
- **questions.yml schema**: each entry must have id, text, status (enum: open, answered, deferred)
- **gates.yml schema**: each entry must have gate (enum: G1-G5), timestamp, outcome (enum: go, no-go, go-with-advisory, overridden); if outcome is "overridden", a reason field is required
- **tasks.yml schema**: each entry must have id, title, status (enum: pending, in_progress, complete, blocked)

*[Revised: gates.yml schema now includes "overridden" as a valid outcome and requires a reason field for overrides.]*

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
| gate | state.yml, gates.yml, checkpoint.yml | gates.yml |
| status | state.yml, gates.yml, checkpoint.yml, log.yml | (read-only) |

*[Revised: Added gate skill to consumption table.]*

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
  - EnterWorktree
maxTurns: 30
---

[Agent instructions, rubrics, output format -- content currently in prompt-web-researcher.md]
```

*[Revised: Added EnterWorktree to disallowedTools example.]*

### Agent Location

*[Revised: Added explicit location and precedence specification.]*

Plugin-provided agents live in the plugin's `agents/` directory. They are loaded via the plugin API and distributed as part of the plugin package. Project-level overrides in `.claude/agents/` take precedence per the official priority ordering:

1. CLI flag (highest priority)
2. Project `.claude/agents/`
3. User `~/.claude/agents/`
4. Plugin `agents/` (lowest priority)

For expedite, the plugin directory is the primary location. Project-level overrides are a power-user escape hatch, not the expected path.

### Minimal Viable Agent Schema

**Required fields** (every agent must have):
- `name`: unique identifier, lowercase-hyphenated
- `description`: when to delegate to this agent (used for dispatch clarity, not auto-delegation)
- `model`: explicit model tier assignment

**Recommended fields** (include when the default is wrong):
- `tools` or `disallowedTools`: tool restrictions for safety (e.g., research agents should not have Bash; non-execute agents should include EnterWorktree in disallowedTools)
- `maxTurns`: prevent runaway agents

**Selective fields** (use for specific agents only):
- `memory: project`: for research-synthesizer and gate-verifier only (see CA-5)
- `isolation: worktree`: for execute agents only (see User Decision 4)

*[Revised: Changed "Deferred fields" to "Selective fields" for memory and isolation, reflecting adoption.]*

**Deferred fields** (do not use initially):
- `hooks`: per-agent hooks (redundant with plugin-level hooks initially)
- `skills`: subagent skill loading (not needed for expedite's dispatch pattern)
- `mcpServers`: MCP server restrictions (not relevant currently)
- `background`: all agents currently run in foreground (blocking)

**Why minimal**: Every frontmatter field is a maintenance surface. If an agent has `tools: [Read, Write, Glob, Grep, WebSearch, WebFetch]` and Claude Code adds a new tool, the agent does not get it because the allowlist is explicit. The `disallowedTools` pattern (deny what is dangerous, inherit everything else) is more maintainable than explicit allowlists for agents that need many tools. Use `tools` (allowlist) only when an agent should be tightly restricted to a small set of tools. Use `disallowedTools` (denylist) when an agent should have broad access minus a few dangerous ones.

### Agent Registry

*[Revised: Added complete agent registry table.]*

| Agent | Model | Key Tools | Memory | Isolation | Role |
|-------|-------|-----------|--------|-----------|------|
| web-researcher | Sonnet | WebSearch, WebFetch, Read, Write | none | none | Research a question via web sources |
| codebase-analyst | Sonnet | Read, Glob, Grep, Write | none | none | Analyze codebase for a specific question |
| mcp-researcher | Sonnet | MCP tools, Read, Write | none | none | Research via MCP server tools |
| spike-researcher | Sonnet | Read, Write, Glob, Grep, Bash | none | none | Research for spike decisions (may need to run code) |
| research-synthesizer | Opus | Read, Write, Glob | project | none | Synthesize research evidence into structured synthesis |
| gate-verifier | Opus | Read, Glob, Grep | project | none | Evaluate reasoning soundness in artifacts |
| design-guide | Opus | Read, Write, Glob | none | none | Guide design decisions based on evidence |
| plan-guide | Opus | Read, Write | none | none | Break design into uniform implementation phases |
| task-executor | Sonnet | Read, Write, Edit, Bash, Glob, Grep | none | worktree | Execute a single implementation task |
| task-verifier | Sonnet | Read, Glob, Grep, Bash | none | none | Verify task implementation meets acceptance criteria |

### Model Tiering

| Tier | Model | Cost Multiplier | Use Case | Agents |
|------|-------|-----------------|----------|--------|
| Fast | Haiku | 1x (baseline) | Read-only exploration, simple lookups | (none currently, future codebase-explorer) |
| Balanced | Sonnet | ~3x | Research, implementation, standard reviews | web-researcher, codebase-analyst, mcp-researcher, spike-researcher, task-executor, task-verifier |
| Premium | Opus | ~15x | Synthesis, architecture decisions, semantic verification | research-synthesizer, gate-verifier, design-guide, plan-guide |

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

*[Revised: G2 reclassified from fully structural to structural + light semantic.]*

| Gate | Type | What It Checks | Enforcement Mechanism |
|------|------|----------------|----------------------|
| G1 (Scope) | Structural | SCOPE.md exists, has required sections, 3+ questions | Code-enforced (PreToolUse hook or standalone script) |
| G2 (Research) | Structural + Light Semantic | Research synthesis exists, all questions addressed, evidence quality ratings, readiness assessment quality | Structural: code-enforced. Semantic: lightweight verifier agent check on readiness assessment quality. |
| G3 (Design) | Semantic + Structural | Design covers all DAs, decisions are evidence-backed, reasoning is sound | Dual-layer: structural (code) + reasoning (verifier agent) |
| G4 (Plan) | Structural | Plan exists, phases cover all design decisions, tasks are uniform-sized | Code-enforced |
| G5 (Spike) | Semantic + Structural | Spike resolves all decisions, implementation steps are concrete, evidence supports approach | Dual-layer: structural (code) + reasoning (verifier agent) |

### Structural Gates (G1, G4): Code-Enforced

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

**Structural check examples for G4**:
- Plan file exists
- Every design decision maps to at least one plan phase
- Each phase has defined steps
- Task count per phase is within bounds (not too few, not too many)

**Token cost per structural gate**: Zero. These are Node.js functions reading files from disk. No LLM calls.

### G2 (Research): Structural + Light Semantic

*[Revised: New section for G2's reclassified gate type.]*

**Structural layer (code-enforced)**:
- Research synthesis file exists
- Each category file referenced in SCOPE.md exists
- Each decision area has an "Evidence Found" assessment
- No decision area has status "INSUFFICIENT"
- READINESS.md exists with all required sections

**Semantic layer (lightweight verifier)**:
- The gate-verifier agent performs a focused check on the readiness assessment quality: Are the evidence sufficiency judgments (strong/adequate/weak/insufficient per decision area) defensible given the evidence actually cited?
- This is a lighter check than G3/G5's full reasoning evaluation. The verifier reads the READINESS assessment and the evidence files, and evaluates whether the sufficiency ratings match the evidence depth. The check is "does 'adequate' evidence actually exist?" not "is the overall research approach sound?"

**Cost**: One verifier agent invocation (~3,000-8,000 tokens, shorter than G3/G5 because the check is narrower). Fires once per lifecycle (at the research-to-design gate).

**Why this is semantic**: Determining whether evidence is "strong" vs. "adequate" vs. "insufficient" for a decision area involves judgment. The structural layer can check that a sufficiency rating exists; only a semantic check can evaluate whether the rating is defensible. The sustainability cost is one additional verifier invocation per lifecycle -- modest and proportional to the value.

### Semantic Gates (G3, G5): Dual-Layer Evaluation

**Layer 1 -- Structural rubric (code-enforced)**:
Same pattern as structural gates. Check that the artifact has the required sections, that every decision area has a decision, that evidence references exist. This catches "did you check all the boxes?" failures.

**Layer 2 -- Reasoning soundness (verifier agent)**:
The gate-verifier agent reads the artifact and evaluates reasoning quality:
- Are conclusions supported by cited evidence?
- Are tradeoffs acknowledged?
- Are there logical gaps or unsupported assertions?

The verifier agent uses Opus model tier (premium) because reasoning evaluation is the highest-judgment task in the system. The verifier runs after the structural layer passes -- no point evaluating reasoning on an artifact that is structurally incomplete.

**Cost analysis for semantic gates**:
- Layer 1 (structural): 0 tokens (code-enforced)
- Layer 2 (verifier agent): ~5,000-15,000 tokens per invocation (Opus reading artifact + evaluation prompt + structured output)
- Total per semantic gate: ~5,000-15,000 tokens
- Semantic gates fire twice per lifecycle (G3 after design, G5 after spike), plus one lightweight check at G2
- Total semantic gate cost per lifecycle: ~13,000-38,000 tokens

*[Revised: Updated total to include G2's lightweight semantic check.]*

This is modest relative to the total lifecycle token spend (typically 100,000+ tokens across all skills and agents).

### False Positive/Negative Handling

**Structural gate false positives** (blocks valid work): The gate criteria are wrong. Fix the criteria in `gate-checks.js`. This is a code change, testable, and immediately effective.

**Structural gate false negatives** (allows invalid work): The criteria are too lenient. Discovered during downstream work ("the plan has gaps because the design was incomplete"). Fix by adding stricter criteria.

**Semantic gate false positives**: The verifier agent rejects sound reasoning. The override mechanism applies: user tells the skill to override, the skill writes an override entry to gates.yml with the user's reason, and the phase transition is allowed. The override is recorded and traceable.

**Semantic gate false negatives** (rubber stamp): Mitigated by the dual-layer design -- the structural layer catches omissions even if the reasoning layer is too lenient. Further mitigated by using a different model tier for verification (Opus verifier evaluating Sonnet-produced artifacts reduces self-preference bias). Additionally, the gate-verifier's persistent memory (project scope) allows it to learn common failure patterns over time, improving catch rates across lifecycles.

*[Revised: Added note about verifier memory improving catch rates.]*

### Gate Maintenance

Adding a new gate criterion:
1. Add the check to the relevant function in `gate-checks.js`
2. Add a test case
3. Deploy

Modifying gate criteria:
1. Change the function
2. Update tests
3. Deploy

No prompt engineering required for structural gates. For semantic gates, the verifier agent's evaluation prompt must be updated if the quality criteria change -- this is the one prompt-sensitive part of the gate system.

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

*[Revised: Skills write checkpoints. Stop hook writes session summary, not checkpoint.]*

1. **Skill start**: Read `checkpoint.yml`. If `skill` matches the current skill and `step > 0`, resume from that step.
2. **Step completion**: Skill writes updated `checkpoint.yml` with new step number, label, and artifacts.
3. **Skill completion**: Skill writes final checkpoint with `step: complete` and all artifacts listed.
4. **Session end**: Stop hook writes `session-summary.md` -- a narrative description of session state for the next session's orientation. This is distinct from checkpoint.yml: the session summary is for LLM orientation; the checkpoint is for deterministic resume.

### Session Summary vs. Checkpoint

*[Revised: New section clarifying the dual mechanism.]*

| | checkpoint.yml | session-summary.md |
|---|---|---|
| **Purpose** | Deterministic resume | LLM orientation |
| **Format** | Machine-readable YAML | LLM-readable markdown |
| **Written by** | Skills (at step boundaries) | Stop hook (at session end) |
| **Read by** | Skill resume preamble (parsed) | Skill frontmatter injection (consumed by LLM) |
| **Content** | Skill name, step number, artifacts list | Narrative: what happened, what is next |
| **Accuracy** | Always accurate (written at step boundary) | Best-effort (based on state at session end) |

### Resume Determinism

The resume protocol is deterministic because it reads explicit state, not heuristics:

1. Read `checkpoint.yml` -- know exactly which skill and step
2. Read `state.yml` -- know the current phase
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
- One file (`session-summary.md`) written by the Stop hook (no validation needed)
- One schema definition (~20 lines of JavaScript)
- Step-boundary write calls in each skill (one line per step: "Write checkpoint")
- Stop hook logic (~30 lines of JavaScript for session summary)

Total maintenance surface: ~100 lines of code across all components. This is proportional to the value (deterministic resume across all 7 skills).

---

## Context & Memory Strategy

### Scoped Injection Design

Each skill's frontmatter loads only the state files it needs:

```yaml
---
!cat .expedite/state.yml 2>/dev/null || echo "No active lifecycle"
!cat .expedite/checkpoint.yml 2>/dev/null || echo "No checkpoint"
!cat .expedite/session-summary.md 2>/dev/null || echo "No session summary"
---
```

*[Revised: Added session-summary.md to base frontmatter injection.]*

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
| Session summary | 50-100 | Every invocation |
| Agent instructions (on dispatch) | 2,000-5,000 | Per agent |
| Artifact reading (on-demand) | Variable | As needed |

**Total per-invocation context overhead**: ~1,150-2,500 tokens (down from ~1,500-4,000+ with monolithic state).

### What to Preserve vs. Regenerate

**Always preserve** (checkpoint, state files, session summary):
- Current phase and step
- Gate history (immutable record)
- Research questions and their status
- Task list and task status
- Session narrative (what happened, what is next)

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

Non-execute agents include `EnterWorktree` in their `disallowedTools`:

*[Revised: Added EnterWorktree prevention for non-execute agents.]*

```yaml
disallowedTools:
  - Bash  # (where appropriate)
  - EnterWorktree
```

This prevents accidental worktree creation by non-execute agents, a known Claude Code behavior where the LLM may attempt worktree creation unprompted.

### Failure Handling

| Failure | Handling |
|---------|----------|
| Agent completes with no changes | Auto-cleanup (built-in Claude Code behavior) |
| Agent completes with changes | Worktree path and branch returned to skill. Skill instructs user to review and merge. |
| Agent crashes mid-worktree | Worktree persists. `WorktreeRemove` hook at session exit can log orphaned worktrees. Manual cleanup via `git worktree prune`. |
| Merge conflicts | Standard git merge/rebase. Not automated -- user resolves. Conflict risk is mitigated by task design (each task targets specific files). |

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
6. Update: checkpoint.yml to reflect step completion
7. Update: state.yml if this is a phase transition (validated by enforcement hook)
```

*[Revised: Separated checkpoint update (step 6) from state update (step 7) for clarity.]*

The skill is a dispatcher, not a doer. The skill's logic is: "which agent to call, with what context, and what to do with the result." The agent's logic is: "how to accomplish the task."

### Context Passing (Minimal Sufficient Context)

The dispatch prompt should include:
- **The specific task**: What the agent should accomplish (1-3 sentences)
- **Input artifact paths**: Where to read source material (paths, not content -- the agent reads it)
- **Output artifact path**: Where to write results
- **Output format**: What the result should look like (section structure, YAML schema, etc.)
- **Scope boundaries**: What is in-scope and out-of-scope for this agent

The dispatch prompt should NOT include:
- Full state file contents (the agent does not need lifecycle state)
- Other agents' outputs (unless explicitly relevant)
- Skill step sequence (the agent does not need to know the overall workflow)
- Gate criteria (the agent produces work; the gate evaluates it separately)

**Why minimal context matters**: Every token in the dispatch prompt is billed at the agent's model tier rate. A Sonnet agent with a 5,000-token prompt costs ~5x what a 1,000-token prompt costs. More importantly, excessive context can confuse the agent -- the research on context window utilization shows that LLMs perform better with focused prompts than with kitchen-sink context.

### Cost-Aware Dispatch

Before dispatching an agent, the skill should consider:
1. **Can this be done without an agent?** Simple file reads, YAML manipulation, and counting can be done by the skill itself (which is already running in the user's session).
2. **Does this need Opus?** Default to Sonnet. Only use Opus for synthesis, architecture, and gate evaluation.
3. **Can agents run in parallel?** If multiple independent research agents are needed, dispatch them as background tasks and collect results. This uses more tokens (parallel context windows) but reduces wall-clock time.

---

## Migration Sequence

### Priority Order (by maintenance-burden reduction)

*[Revised: M1+M2 bundled as a single phase. Stop hook in M9 writes session summary, not checkpoint.]*

| Phase | What | Standalone Value | Dependencies | Estimated Effort |
|-------|------|-----------------|--------------|-----------------|
| M1+M2 | **State splitting + PreToolUse hook** (state.yml -> five files + hook validation + gates.yml protection) | Reduces token waste immediately. Prevents invalid state transitions. Protects gate results from fabrication. | None | Medium -- file splitting + frontmatter updates + hook script + schema definitions + FSM table |
| M3 | **Checkpoint-based resume** | Deterministic resume for all skills. Eliminates heuristic failure modes. | M1+M2 (checkpoint.yml must exist and be validated) | Medium -- checkpoint writes in each skill + resume preamble |
| M4 | **Agent formalization** (prompt-*.md -> agents/*.md with frontmatter) | Tool restrictions prevent agent misbehavior. Model tiering reduces cost. | None (can be done independently) | Medium -- file restructuring + frontmatter authoring |
| M5 | **Skill thinning** (move logic from SKILL.md to agents) | Skills drop to ~100-200 lines. Maintainability improves. | M4 (agents must be formalized first) | Large -- requires rewriting each skill |
| M6 | **Structural gate code-enforcement** (G1, G4) | Eliminates rubber stamp for 2 of 5 gates. | M1+M2 (hooks must exist) | Medium -- gate check functions |
| M7 | **Semantic gate dual-layer** (G2 light, G3, G5) | Eliminates rubber stamp for remaining 3 gates. | M6 (structural layer first) | Medium -- verifier agent + integration |
| M8 | **Worktree isolation for execute** | Code modification safety. | M4 (execute agents must be formalized) | Small -- frontmatter field |
| M9 | **Stop and PreCompact hooks** | Session handoff narrative and context preservation across compaction. | M1+M2 (state files must exist) | Small -- two additional hook scripts |

### Cost-Benefit of Each Phase

| Phase | Maintenance Reduction | Token Savings | Risk Mitigation |
|-------|----------------------|---------------|-----------------|
| M1+M2 | High (smaller files, scoped reads, automated enforcement) | High (60-80% state token reduction) | High (prevents state drift, gate fabrication) |
| M3 | High (deterministic resume replaces fragile heuristics) | Low | High (eliminates resume failure modes) |
| M4 | Medium (formal agent definitions are self-documenting) | Medium (model tiering) | Medium (tool restrictions prevent misbehavior) |
| M5 | High (skills drop from 860 to 200 lines) | Low | Medium (thinner skills are easier to debug) |
| M6 | Medium (gate logic is code, not prompts) | Medium (code gates cost zero tokens) | High (eliminates rubber stamp for structural gates) |
| M7 | Low (adds a verifier agent to maintain) | Negative (verifier costs tokens) | High (eliminates rubber stamp for remaining gates) |
| M8 | Low (one frontmatter field) | Zero | Medium (prevents code conflicts) |
| M9 | Medium (automated session handoff and context preservation) | Low | Medium (prevents context loss across sessions and compaction) |

### Recommended Start: M1+M2 as a bundle

*[Revised: Explicitly bundled M1+M2 as a single phase, per V1's recommendation and P1's approach.]*

State splitting (M1) and PreToolUse hook (M2) are bundled as the first migration phase. The reasoning: state splitting without hook validation creates an unprotected window where corrupted state files would not be caught. Hooks without split state files have nothing granular to validate. Together, they deliver: reduced token waste, enforced state validity, protected gate results, and the foundation for everything else.

**Reversibility**: Each component within the bundle is reversible independently. State files can be merged back. The hook can be disabled via plugin settings. Neither requires the other to function (M1 without M2 still reduces tokens; M2 without M1 still validates writes), but deploying both together avoids the unprotected window.

---

## Risks & Open Questions

### What Adds Complexity Without Proportional Value?

1. **Agent hooks for gate evaluation**: Using `type: "agent"` hooks for semantic gate evaluation would add latency and complexity. SubagentStop fires on agent completion (not on every write, as the original design incorrectly implied), but the skill can perform the same completeness check after the agent returns. The dual-layer design (structural code-check + explicit verifier agent dispatch) achieves the same result with controllable timing and simpler debugging.

*[Revised: Corrected the latency characterization. SubagentStop fires on agent completion, not on every state write.]*

2. **TypeScript compilation for hook scripts**: Adds a build step that must run before hooks work. Node.js scripts run directly. The type safety benefit does not justify the maintenance cost for a solo developer.

3. **Event-sourced state or checkpoint snapshots**: More sophisticated than file-per-concern but adds a replay mechanism, a snapshot store, and versioning logic. The debugging story goes from "cat the file" to "replay the event log" -- a significant complexity increase with no proportional reliability improvement for expedite's sequential pipeline.

### What Might Become a Maintenance Burden?

1. **Hook stdin JSON format**: Claude Code's hook input format is not formally versioned. If the JSON structure changes in a Claude Code update, hook scripts may break. Mitigation: minimal parsing (extract only needed fields), version documentation, loud failure on unexpected input.

2. **Schema definitions in JavaScript**: As expedite evolves, the schema definitions in `state-schema.js` must stay synchronized with what skills actually write. If a skill writes a new field that the schema does not expect, the hook blocks it. Mitigation: schema validation in "warn" mode during development (exit 1 instead of exit 2 for unknown fields), strict mode in production.

3. **Gate check functions**: As lifecycle requirements evolve, the structural gate criteria must be updated. If gate criteria drift from actual quality requirements, they create false positives (blocking valid work) or false negatives (allowing invalid work). Mitigation: gate criteria review as part of the lifecycle design process, not an afterthought.

4. **Skill-agent prompt alignment**: When agents are formalized with detailed instructions, changes to output format expectations require updating both the agent definition and the consuming skill's parsing logic. Mitigation: use stable, documented output formats (YAML with defined schemas) and change them infrequently.

5. **Agent memory drift**: The research-synthesizer and gate-verifier MEMORY.md files could accumulate stale or misleading content over many lifecycles. Mitigation: explicit experimental criteria (review after 3 lifecycles), developer can delete memory files at any time without affecting system function.

*[Revised: Added agent memory drift as a maintenance concern.]*

### What Platform Changes Could Break This Design?

1. **Hook API changes**: If Claude Code changes hook event names, stdin format, or exit code semantics, all hook scripts need updating. Likelihood: Low (hooks are a stable API surface). Impact: High (enforcement layer stops working). Mitigation: version pinning documentation, minimal stdin parsing.

2. **Subagent frontmatter changes**: If the agent definition format changes (fields renamed, semantics altered), agent definitions need updating. Likelihood: Low (format is recent and documented). Impact: Medium (agents need updating). Mitigation: use only well-documented fields.

3. **Write tool behavior changes**: If the Write tool changes how it passes content to hooks (e.g., streaming instead of complete content), the PreToolUse hook's content parsing breaks. Likelihood: Very low. Impact: High. Mitigation: no good mitigation -- this is a foundational dependency.

4. **Plugin hooks.json deprecation**: If Claude Code changes how plugins register hooks, the registration mechanism needs updating but the hook scripts themselves remain valid. Likelihood: Low. Impact: Low (registration is a single JSON file).

5. **Hooks not firing on subagent writes**: If plugin-level hooks do not intercept subagent tool calls, the enforcement architecture has a critical gap. Likelihood: Unknown (not verified). Impact: Critical. Mitigation: verify this assumption in M1+M2 before committing to the enforcement architecture.

*[Revised: Added subagent hook-firing as an explicit platform risk.]*

### What Should Be Deferred vs. Built Now?

**Build now (M1+M2, M3)**:
- State splitting + PreToolUse hook + checkpoint-based resume
- These solve the three stated pain points (token waste, state drift, resume fragility)
- Each delivers standalone value
- Foundation for everything else

**Build soon (M4-M6)**:
- Agent formalization, skill thinning, structural gate enforcement
- High value but more effort
- Depends on M1+M2+M3 foundation

**Build later (M7-M9)**:
- Semantic gate dual-layer, worktree isolation, session handoff hooks
- Important but not urgent
- Can be added incrementally without disrupting earlier phases

**Defer until conditions met**:
- Agent Teams (3-4x token cost, pipeline architecture does not need mesh communication)
- Continuous learning/instincts (expedite's skills are hand-crafted, not learned)
- Declarative flow syntax (expedite's pipeline is fixed, not ad-hoc)
- SessionStart hook (until platform bugs are confirmed fixed in a Claude Code release)

*[Revised: Changed "defer indefinitely" to "defer until conditions met." SessionStart deferral has a clear trigger (bug fixes confirmed).]*

### Evidence Strength per Design Element

*[Revised: Added evidence quality ratings, inspired by Proposal 3's evidence map.]*

| Design Element | Evidence Strength | Sources | Key Risk |
|---------------|-------------------|---------|----------|
| Three-layer architecture | MODERATE | claude-code-harness, ECC, claude-agentic-framework | Observational, not experimental comparison |
| PreToolUse state guard | STRONG | 3 harness implementations, official docs | Hook stdin format undocumented |
| Five-file state split | STRONG | 4+ convergent sources | Cross-file consistency unvalidated |
| YAML format retention | MODERATE | Research synthesis | No risk -- maintaining status quo |
| Node.js for hooks | MODERATE | ECC, claude-code-harness (TypeScript) | Single dependency (js-yaml) |
| Checkpoint-based resume | STRONG | LangGraph, expedite execute skill | Mid-step crash leaves ambiguous state |
| Structural gates (G1, G4) code-enforced | STRONG | claude-code-harness rule engine, academic research | Gate criteria may drift from actual needs |
| G2 structural + light semantic | MODERATE | Research synthesis gate classification | Readiness assessment judgment boundary unclear |
| G3, G5 dual-layer | MODERATE | Phase 24 concept, research taxonomy | Verifier rubber-stamp risk |
| Agent formalization (subagent schema) | STRONG | Official docs, 5 repo examples | Frontmatter format changes |
| Agent persistent memory (selective) | WEAK | Official docs only | No repo demonstrates pipeline benefit |
| Worktree isolation (execute only) | ADEQUATE | 2 repos, official docs | Merge-back friction unknown |
| Override mechanism | NONE (design invention) | No source demonstrates | Untested interaction with hook validation |
| gates.yml write protection | NONE (design invention) | No source demonstrates | Adds hook complexity |
| SessionStart deferral | N/A (absence decision) | 3 platform bugs (unverified status) | May miss context-loading improvement |

---

## Confidence Assessment

| Design Area | Confidence | Change from Original | Justification |
|-------------|------------|---------------------|---------------|
| Three-layer architecture | High | No change | All proposals converge. User decision. Well-evidenced. |
| Hook set (3 core, 2 extended) | High | No change | Conservative approach validated by both validators. |
| Node.js for hooks | High | No change | Both validators agreed this was the strongest decision. |
| State file split (5 files) | High | No change | All proposals converge. Strong evidence. |
| Checkpoint by skills, not hooks | High | Changed from original | V1 correctly identified the Stop-hook-writes-checkpoint flaw. Skills have the context; hooks do not. |
| Session summary via Stop hook | High | New (replaces checkpoint role) | Clean separation: machine-readable resume (checkpoint.yml) vs. LLM-readable orientation (session-summary.md). |
| G2 classification | Medium-High | Changed from fully structural | V1 and V2 correctly identified that readiness assessment quality involves judgment. Cost is modest (one extra verifier call). |
| Agent memory (selective) | Medium | Changed from full deferral | Low-risk experiment. Bounded to 2 agents. No dependency. Explicit discard criteria. |
| Override mechanism | Medium | Changed from unspecified to fully specified | Design invention with no evidence backing, but the interaction with PreToolUse is logically sound. Needs validation during M6. |
| gates.yml protection | Medium | New | Design invention. Addresses a real gap (gate fabrication bypass). Adds ~20 lines to PreToolUse hook. |
| SessionStart deferral | Medium-High | Softened from "indefinite" to "until bugs fixed" | Better aligned with user decision C4. No pre-built fallback pattern (simpler). |
| Migration bundling (M1+M2) | High | Changed from separate to bundled | V1 correctly identified the unprotected window. Bundling is the safer approach. |

## Remaining Disagreements

### With Proposal 1

1. **Hook count**: P1 proposes 6 hooks from the start. This design starts with 3 and expands to 5 maximum. The sustainability lens maintains that each hook is maintenance surface area and should be justified by observed need, not anticipated need. SubagentStop and SessionStart are the two hooks this design defers; P1 includes both. The disagreement is philosophical: P1 optimizes for completeness, this design optimizes for minimalism.

2. **Agent count**: P1 lists 11 agents including scope-facilitator and research-planner. This design has 10 agents and does not include scope-facilitator (the scope skill already handles conversation) or a separate research-planner (research planning is embedded in skill logic). More agents means more maintenance surface with diminishing returns.

### With Proposal 3

1. **Hook implementation language**: P3 chose shell + yq, honestly labeled as WEAK evidence. This design chose Node.js. The disagreement is clear-cut: shell YAML parsing is fragile, yq is a dependency that does not eliminate the fragility, and the enforcement layer must be reliable. P3's evidence lens should have led to Node.js (MODERATE evidence) over shell (WEAK evidence). The evidence lens and the sustainability lens agree here; P3's choice is inconsistent with its own methodology.

2. **Migration ordering**: P3 puts hooks (Phase 3) after state splitting (Phase 1) and checkpoints (Phase 2). This design bundles state splitting + hooks as Phase 1. The disagreement: P3 creates an unprotected window where state files exist without validation. This design eliminates that window by bundling.

### With Both Proposals

1. **SessionStart fallback pattern**: Both P1 and P3 design a fallback pattern for SessionStart (ECC's root fallback). This design does not pre-build a fallback. The reasoning: frontmatter injection already provides the baseline functionality. Building a fallback pattern for SessionStart adds code that must be maintained even if SessionStart is never adopted. When SessionStart becomes reliable, adding it is a simple enhancement -- no fallback needed because frontmatter injection is the permanent primary mechanism, and SessionStart is an additive improvement on top of it.
