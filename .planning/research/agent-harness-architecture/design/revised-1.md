# Agent Harness Architecture — Revised Resolution 1 (Developer Experience Lens)

## Revision Summary

The revised design makes five substantive changes in response to validator feedback: (1) hook implementation language changed from shell to Node.js, conceding Proposal 2's stronger reasoning; (2) the `sufficiency-evaluator` agent removed and its structural checks moved to code-enforced scripts, eliminating the contradiction of using an LLM for deterministic validation; (3) checkpoint.yml writers restricted to skills only, maintaining clean three-layer separation; (4) the SubagentStop hook deferred from initial design to a future enhancement, with gate verifier completeness checking moved into the gate skill; (5) checkpoint regression rules relaxed to allow re-execution when inputs change, not only during recovery. The DX vision -- explanatory denials, transparent overrides, seamless resume, invisible enforcement -- held firm throughout because no validator challenged the DX principles, only specific mechanism choices.

---

## Validator Response Log

| # | Validator | Issue | Response | Impact |
|---|-----------|-------|----------|--------|
| 1 | V1 (Coherence) | SubagentStop hook for gate verification is under-specified — "complete" is not defined programmatically, and 30-60s latency for completeness checking is expensive when the skill could check output after the agent returns | **Accept.** The SubagentStop hook was a premature optimization. The gate skill can validate verifier output completeness after the agent returns — simpler, cheaper, and eliminates a speculative hook type. SubagentStop is deferred to a future enhancement. | Removed Hook 6. Gate skill validates verifier output inline. Hook count reduced from 6 to 5 (and SessionStart deferred to 4 initial). |
| 2 | V1 (Coherence) | Shell script vs. Node.js ambiguity — hook scripts named `.sh` but text mentions YAML parsing that is fragile in shell | **Accept.** Proposal 2's Node.js reasoning is convincing: cross-platform, testable, no build step, fast enough, single YAML dependency (`js-yaml`). Shell YAML parsing is too fragile for an enforcement layer that must be reliable. All hook scripts changed to `.js`. | All hook file references updated. Implementation language unified as Node.js. |
| 3 | V1 (Coherence) | `sufficiency-evaluator` agent is unnecessary — structural rubric evaluation is code-enforced (deterministic scripts), so having an LLM-based structural evaluator contradicts code-enforcement principle | **Accept.** This was an internal contradiction. Structural checks are deterministic — they belong in scripts, not in an LLM agent. The sufficiency-evaluator is removed. Only the gate-verifier agent remains for the semantic evaluation layer. | Agent count reduced from 11 to 10. Agent registry updated. |
| 4 | V1 (Coherence) | Agent count is high (11 agents) — consider whether scope-facilitator and research-planner need to be separate agents vs. skill-level logic | **Modify.** The validator's concern about maintenance surface is valid, but the DX lens justifies these agents. scope-facilitator needs a distinct conversational style (Socratic questioning, not execution). research-planner needs to reason about question quality and coverage independently. Collapsing them into skills would re-bloat skills beyond 200 lines. However, removing sufficiency-evaluator (issue #3) reduces the count to 10, which is more reasonable. | Agent count reduced from 11 to 10 (sufficiency-evaluator removed). scope-facilitator and research-planner retained with justification. |
| 5 | V1 (Coherence) | Checkpoint regression detection rule is too rigid — requiring `substep: recovery` for step regression creates semantic overload; should allow regression when inputs_hash differs | **Accept.** The validator is right that legitimate re-execution (after upstream changes) should not require the `recovery` substep label. Changing the regression rule to: allow step decrease when `inputs_hash` differs from the checkpoint's recorded hash. This is more semantically accurate — "inputs changed, so re-execution is justified." | Checkpoint validation rule updated. Regression allowed when inputs_hash differs. |
| 6 | V1 (Coherence) | checkpoint.yml is "written by both skills and agents" — contradicts the "agents do not write state" principle | **Accept.** This was an inconsistency in the original design. Only skills should write checkpoint.yml to maintain the three-layer separation. Agents produce artifacts and return summaries; skills interpret results and update the checkpoint. | checkpoint.yml write pattern corrected. Only skills write checkpoints. |
| 7 | V1 (Coherence) | gates.yml integrity is unprotected — no PreToolUse validation on gates.yml writes; a fabricated gate result would bypass enforcement | **Accept.** This is a genuine security gap. Adding PreToolUse validation for gates.yml writes closes the fabrication bypass. The hook validates that gate results have the expected structure and match the current phase. | PreToolUse hook scope expanded to include gates.yml validation. |
| 8 | V2 (Research) | Override mechanism (writing `overridden: true` to gates.yml, recognized by hook) should be acknowledged as a design invention, not an evidenced pattern | **Accept.** The override + code-enforced gate interaction is not demonstrated by any surveyed source. It is a reasonable design extrapolation but should be flagged as such. | Override mechanism section now explicitly labels this as a design invention requiring implementation validation. |
| 9 | V2 (Research) | Agent persistent memory for synthesizer and verifier is presented as a clear design choice, but evidence is WEAK (official docs only) — should be framed as experiment | **Modify.** The DX value of inspectable, editable agent memory is genuine. But the validator is right that the evidence base is thin. Reframing as "experimental adoption" — enabled but with explicit criteria for evaluating whether memory improves output quality. No feature depends on memory working. | Memory framing changed from "design choice" to "experimental adoption with evaluation criteria." |
| 10 | V2 (Research) | Stop hook writing checkpoint.yml is problematic — Stop hook lacks context to determine current step accurately | **Accept.** (This was raised about Proposal 2's design, but applies to the Stop hook checkpoint backup in my design too.) The Stop hook should write session-summary.md only. Skills write checkpoints at step boundaries. The PreCompact hook ensures the checkpoint is flushed before compaction. | Stop hook responsibility clarified: session-summary.md only, not checkpoint.yml. |
| 11 | V2 (Research) | DX scenarios ("Developer Experience Moments") are design imagination, not evidence — should be recognized as such | **Accept.** The DX scenarios are valuable design thinking but are not research-backed. They remain in the design as DX vision but are now labeled as design-originated, not evidence-derived. | DX Moments section retains scenarios with explicit framing as design imagination. |
| 12 | V1 (Coherence) | P1 bundles hooks + state split as Increment 1, which is the largest individual increment — more granular approaches may be preferable | **Defend.** State splitting without hook validation creates an unprotected window where corrupted state writes are uncaught. The hook needs split state files to validate against, and split state files need hook protection. Bundling them ensures no period of unprotected split state. The increment is medium-sized, not large — it is one hook script + file restructuring + frontmatter updates. | Increment 1 bundling retained with stronger justification. |

---

## Adopted Elements from Other Proposals

**From Proposal 2 (Sustainability Lens):**

1. **Node.js for all hook scripts** — Adopted Proposal 2's implementation language decision and reasoning. The comparison matrix (shell: fragile, TypeScript: build step, Node.js: goldilocks) is convincing. The single `js-yaml` dependency provides reliable YAML parsing without a build step. *[Applied to: Hook Architecture section]*

2. **Maintenance burden analysis per layer** — Adopted the practice of documenting maintenance cost alongside each architectural layer and each migration phase. The "what adds complexity without proportional value" framing is useful for keeping the design lean. *[Applied to: Three-Layer Architecture section, Migration Sequence section]*

3. **Schema evolution strategy** — Adopted the 5-step process for adding fields (add with default, make optional, produce, consume, optionally require) and the 4-step process for adding files. This is the most practical evolution guidance across all proposals. *[Applied to: State Management section]*

4. **Context passing guidelines (SHOULD include / SHOULD NOT include)** — Adopted the explicit dispatch context boundaries. "Pass artifact paths, not content. Pass task description, not workflow sequence. Do not pass gate criteria to the producing agent." This prevents context bloat in agent prompts. *[Applied to: Skill-Agent Interaction section]*

5. **State debugging story** — Adopted the "4 commands, no special tools" framing: cat the file, check the checkpoint, run the validator manually, check the error log. This makes the architecture tangible for maintenance. *[Applied to: State Management section]*

6. **`disallowedTools` vs. `tools` guidance** — Adopted the principle: use denylist (`disallowedTools`) for agents needing broad access minus dangerous tools; use allowlist (`tools`) only for tightly restricted agents. This is more maintainable as new tools are added to Claude Code. *[Applied to: Agent Formalization section]*

7. **Cost-benefit migration table format** — Adopted the three-axis evaluation (Maintenance Reduction, Token Savings, Risk Mitigation) for each migration phase. *[Applied to: Migration Sequence section]*

**From Proposal 3 (Evidence Lens):**

1. **Evidence strength ratings on key design choices** — Adopted the practice of labeling evidence strength (STRONG/MODERATE/WEAK/SPECULATIVE) on design choices where the evidence base varies significantly. The DX lens does not need the exhaustive evidence map, but calibrating confidence on contested decisions prevents overconfident claims. *[Applied selectively to contested areas]*

2. **Distinction between checkpoint (machine-readable) and session summary (LLM-readable)** — Adopted Proposal 3's clearest articulation: "The checkpoint tells the system WHERE to resume; the summary tells the LLM WHY and WHAT the situation is." Both are needed; they serve different consumers. *[Applied to: Resume & Recovery section]*

3. **`EnterWorktree` in `disallowedTools` for non-execute agents** — Adopted as a defensive measure to prevent accidental worktree creation by research or design agents. *[Applied to: Worktree Isolation section]*

4. **Per-phase reversibility assessment** — Adopted the explicit "Reversible?" column in the migration table. This gives the developer confidence that each increment can be walked back if it causes problems. *[Applied to: Migration Sequence section]*

5. **Platform assumptions catalog** — Adopted the practice of listing foundational platform assumptions that need early validation: hook stdin format, hooks firing on subagent writes, exit code 2 semantics in plugin context, disallowedTools enforcement. *[Applied to: Risks & Open Questions section]*

---

## Revised Design

### Design Summary

*[Revised: incorporates validator feedback on mechanism choices while preserving DX principles]*

The expedite agent harness is a three-layer architecture that separates enforcement (hooks and Node.js scripts), orchestration (thin skills), and execution (thick agents with full frontmatter) to transform the plugin from a prompt-driven system into a code-enforced one. The DX lens drove three defining tradeoffs: (1) structural gates are fully deterministic rather than LLM-evaluated, giving the developer certainty that "pass" means the artifact objectively meets criteria; (2) resume is checkpoint-driven rather than heuristic, so the developer never wonders "did it pick up where it left off or start something new?"; and (3) hooks provide explanatory denial messages rather than silent blocking, so when the harness intervenes the developer understands why and what to do next. The architecture preserves expedite's existing lifecycle pipeline while hardening every seam where prompt-enforcement currently fails — state transitions, gate evaluation, resume logic, and agent boundaries.

---

### User Decisions Applied

#### Decision 1: Three-Layer Separation (Enforcement + Orchestration + Execution)
Applied as the foundational architecture. Skills become 100-200 line dispatchers (orchestration). Agents become thick workers with full Claude Code frontmatter (execution). Hooks and Node.js scripts form the enforcement layer that neither skills nor agents can bypass. Every design section below respects this boundary.

#### Decision 2: Dual-Layer Rubric + Reasoning for Semantic Gates
Applied to G3 (Design quality) and G5 (Spike quality). Layer 1 is a code-enforced structural rubric (section counts, DA coverage, evidence references). Layer 2 is a separate verifier agent that evaluates reasoning soundness. This preserves the Phase 24 verifier design concept while anchoring it in the harness architecture.

#### Decision 3: Incremental Hardening (Not Full Rebuild)
Applied to the migration sequence. Each increment delivers standalone value and validates patterns before the next increment depends on them. The ordering follows dependency chains while maximizing early wins. Hooks and state splitting are bundled as Increment 1 because split state without hook protection creates an unvalidated window.

#### Decision 4: Worktree Isolation for Execute Only
Applied narrowly. Only execute-skill agents get `isolation: "worktree"` in their frontmatter. Research, design, plan, and spike agents write to `.expedite/` directories only and do not need filesystem isolation. Non-execute agents include `EnterWorktree` in `disallowedTools` to prevent accidental worktree creation.

#### Constraints Honored
- **C1 (Claude Code plugin API)**: All mechanisms use hooks, skills, agents, frontmatter, and Task() — no external services or custom runtimes.
- **C2 (Full rebuild acceptable)**: The three-layer separation is a significant restructuring, but delivered incrementally per Decision 3.
- **C3 (Personal/team tool)**: Configuration complexity is acceptable. Hook scripts, Node.js validators, and multi-file state are power-user patterns appropriate for this audience.
- **C4 (SessionStart deferred)**: *[Revised: aligned with C4 wording]* SessionStart is designed with a fallback pattern (ECC's root fallback) but deferred from the initial hook set. If SessionStart proves reliable, it can be added as a low-risk enhancement. The system works fully without it via frontmatter injection.
- **C5 (Pipeline is fixed)**: The lifecycle stages (scope, research, design, plan, spike, execute) are unchanged. The harness hardens the pipeline's seams, not its stages.

---

### Agent-Resolved Contested Areas

#### Contested Area 1: Hook Handler Types for Gate Enforcement

**Resolution**: Command hooks for all structural gates (G1, G2-structural, G4) and state transition enforcement. The gate skill dispatches the gate-verifier agent explicitly for semantic gates (G3, G5) and validates the verifier's output completeness inline after the agent returns. No agent hooks (SubagentStop) for gate enforcement in the initial design.

*[Revised: SubagentStop hook removed per V1 feedback. Gate verifier completeness checking moved from hook to skill.]*

**Reasoning**: The DX lens prioritizes speed and predictability. Command hooks execute in approximately 100-200ms and produce deterministic results — the developer never waits for an LLM call to validate a state write. For semantic gates, the gate skill explicitly dispatches the gate-verifier agent, waits for its return, and then checks whether the evaluation is complete (all rubric dimensions scored, reasoning provided). This is simpler than a SubagentStop hook, avoids a speculative hook pattern (evidence: SPECULATIVE per Proposal 3's evidence map), and keeps the completeness check in the orchestration layer where it belongs.

#### Contested Area 2: State File Granularity

**Resolution**: Five state files in `.expedite/`:

| File | Contents | Typical Size | Loaded By |
|------|----------|-------------|-----------|
| `state.yml` | Phase, lifecycle identity, version, timestamps | ~15 lines | All skills (frontmatter) |
| `checkpoint.yml` | Current step, substep, continuation notes, inputs hash | ~10-20 lines | All skills (frontmatter) |
| `questions.yml` | Research questions, refinement history | Variable (grows) | Scope, research skills |
| `gates.yml` | Gate history, override records | Variable (grows) | Gate evaluation hooks, status skill |
| `tasks.yml` | Execution task list, completion tracking | Variable | Execute skill |

**Reasoning**: Unchanged from original — the five-file split maps cleanly to five distinct concerns, each skill loads only what it needs, and the critical split of checkpoint.yml from state.yml separates high-frequency step writes from low-frequency phase transitions.

**Evidence**: STRONG (4+ convergent sources for directory-based state).

#### Contested Area 3: SessionStart Hook Usage Despite Platform Bugs

*[Revised: aligned more closely with constraint C4 wording ("deferred") and Proposal 2's conservative stance]*

**Resolution**: Design with SessionStart as a future enhancement, not a primary mechanism. The initial hook set excludes SessionStart. Context loading uses frontmatter injection (`!cat` commands in SKILL.md) as the primary mechanism. If SessionStart bugs are confirmed fixed during implementation, adding the hook is a low-risk enhancement that provides slightly more elegant context loading (status before the developer types anything vs. status on first skill invocation).

**Reasoning**: The DX lens values reliability over elegance. Frontmatter injection provides functionally equivalent context loading — the developer sees the same information, just triggered by skill invocation rather than session start. The DX difference is minor (seeing status 2 seconds earlier), while the reliability risk of depending on a buggy hook is significant. The conservative path is to ship without SessionStart and add it later if the platform stabilizes.

**Evidence**: Three platform bugs (#16538, #13650, #11509) historically blocked SessionStart. ECC's root fallback pattern exists precisely because SessionStart is unreliable. Evidence strength for SessionStart reliability: WEAK (unverified bug status).

#### Contested Area 4: Agent Persistent Memory Usage

*[Revised: reframed from "design choice" to "experimental adoption" per V2 feedback]*

**Resolution**: Experimental adoption for the research-synthesizer and gate-verifier agents. Other agents remain stateless. No feature depends on memory working. Explicit evaluation criteria defined for judging whether memory improves output quality.

**Reasoning**: The DX lens asks "what memory would the developer find valuable if they could see it?" The synthesizer learning which evidence patterns are most useful across lifecycles is valuable. The verifier learning common failure patterns is valuable. Individual research agents are ephemeral (different questions each lifecycle), so persistent memory would accumulate stale context. The developer should trust that stateless agents start fresh and that stateful agents accumulate useful judgment.

**Evidence**: WEAK (official docs only, no repo demonstrates per-agent persistent memory in a pipeline architecture). This is an experiment, not an evidenced adoption. Evaluation criteria:
- After 3 lifecycles with memory enabled, inspect MEMORY.md for accuracy and relevance
- Compare synthesis/gate evaluation quality between lifecycles 1 and 3
- If memory content is noisy or counterproductive, clear it or disable the feature
- The developer can always inspect and edit agent memory files

#### Contested Area 5: PreCompact Hook Strategy

**Resolution**: A PreCompact command hook (Node.js) ensures the current checkpoint is flushed and writes a one-paragraph session summary to `.expedite/session-summary.md`. The summary includes: current skill, current step, what was accomplished this session, and what should happen next.

**Reasoning**: Unchanged — the DX lens treats context loss as the highest-anxiety moment for the developer. The PreCompact hook ensures that even if compaction discards most of the conversation, the checkpoint file and session summary persist on disk.

---

### Three-Layer Architecture

#### Layer 1: Enforcement (Hooks + Node.js Scripts)

*[Revised: shell scripts changed to Node.js per V1/V2 feedback; maintenance burden analysis added per P2 adoption]*

**Responsibility**: Prevent invalid operations. Hooks and Node.js scripts form a hard boundary that neither skills nor agents can bypass. This layer answers the question "is this operation allowed?" with deterministic yes/no decisions.

**What lives here**:
- `hooks/hooks.json` — Hook event registrations
- `hooks/validate-state-write.js` — PreToolUse command hook for state.yml and checkpoint.yml writes (FSM and schema validation)
- `hooks/validate-gate-write.js` — PreToolUse command hook for gates.yml writes (gate result integrity)
- `hooks/pre-compact-save.js` — PreCompact command hook (checkpoint flush + session summary)
- `hooks/session-stop.js` — Stop command hook (session summary persistence)
- `hooks/audit-override.js` — PostToolUse command hook (append-only audit trail for gate overrides)
- `hooks/lib/state-schema.js` — YAML schema definitions and validators
- `hooks/lib/fsm.js` — Finite state machine transition rules
- `hooks/lib/gate-checks.js` — Structural gate validation functions (G1, G2-structural, G4)

**Maintenance burden**: Low. The FSM transitions are a simple lookup table. Schema validators are declarative JavaScript functions (~20-40 lines each). The hooks themselves are thin dispatchers to the lib functions. Single dependency: `js-yaml` for YAML parsing. No build step required. When a new skill is added, only the FSM transition table needs updating. When a gate criterion changes, only the relevant function in `gate-checks.js` needs updating.

**Token cost**: Zero. Command hooks execute outside the LLM context. Every check moved from prompt to hook saves tokens on every invocation.

**Developer experience**: This layer is invisible when things are working. The developer never thinks about hooks during normal operation. When enforcement intervenes, the developer sees a clear denial message: "State write blocked: cannot transition from scope_in_progress to research_in_progress without G1 gate passage. Run /expedite:gate to evaluate." The developer always knows what to do next.

#### Layer 2: Orchestration (Thin Skills)

**Responsibility**: Manage the developer conversation, determine what to do next, dispatch agents, and present results. Skills are the user-facing surface.

**What lives here**:
- `skills/scope/SKILL.md` (~150 lines) — Scope orchestrator
- `skills/research/SKILL.md` (~150 lines) — Research orchestrator
- `skills/design/SKILL.md` (~150 lines) — Design orchestrator
- `skills/plan/SKILL.md` (~100 lines) — Plan orchestrator
- `skills/spike/SKILL.md` (~100 lines) — Spike orchestrator
- `skills/execute/SKILL.md` (~100 lines) — Execute orchestrator
- `skills/status/SKILL.md` (~80 lines) — Status display
- `skills/gate/SKILL.md` (~80 lines) — Gate evaluation trigger

**Maintenance burden**: Low. Skills become declarative step sequences. Logic that currently lives in skills (validation, gate evaluation, state management) moves to the enforcement layer and agents. Adding a step means adding a step entry and possibly an agent definition.

**Token cost**: Moderate. At 100-200 lines, each skill costs ~1,000-2,000 tokens. Scoped state injection reduces state injection cost by an estimated 60-80% compared to monolithic state loading.

**Developer experience**: The developer interacts only with skills. `/expedite:scope`, `/expedite:research`, etc. Skills are short enough that a developer reading SKILL.md can understand the entire orchestration flow in one screen. Skills do not contain business logic — they read checkpoint, determine which step to resume, and dispatch the appropriate agent. The developer's mental model is: "skills route, agents work."

#### Layer 3: Execution (Thick Agents)

**Responsibility**: Do the actual work. Agents are autonomous workers with rich frontmatter.

*[Revised: sufficiency-evaluator removed per V1 feedback; agent count reduced from 11 to 10]*

**What lives here**:
- `agents/scope-facilitator.md` — Conducts scope conversation
- `agents/research-planner.md` — Generates research questions
- `agents/web-researcher.md` — Executes web research
- `agents/codebase-researcher.md` — Executes codebase research
- `agents/research-synthesizer.md` — Synthesizes evidence (memory: project, experimental)
- `agents/design-architect.md` — Produces design documents
- `agents/plan-decomposer.md` — Breaks designs into phases
- `agents/spike-researcher.md` — Resolves tactical decisions
- `agents/task-implementer.md` — Implements code changes (isolation: worktree)
- `agents/gate-verifier.md` — Semantic quality evaluation (memory: project, experimental)

**Maintenance burden**: Moderate. Agents are the largest files in the system (replacing current prompt templates). However, each agent is self-contained and independently modifiable. Changes to one agent cannot break another. The formal frontmatter schema provides structure.

**Developer experience**: Agents are like team members — the developer knows they exist and what they specialize in, but does not micro-manage them. When an agent runs, the developer sees progress. When an agent finishes, the skill presents results. If the developer wants to understand what an agent does, they can read a single agent .md file — it is self-contained.

#### Information Flow Between Layers

*[Revised: corrected to show skills (not agents) writing state, per V1 Critical Issue 1]*

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

The key architectural invariant: **Agents never bypass enforcement, and agents never write state directly.** Agents produce artifacts. Skills update state after processing agent results. Every Write to a state file passes through the PreToolUse hook regardless of which skill initiated it. This is structural — it is impossible for an agent to write invalid state because agents do not write state at all, and skills cannot write invalid state because the hook intercepts the tool call before execution.

**Critical platform assumption** (from Proposal 3's risk catalog): Plugin-level PreToolUse hooks must fire on subagent-initiated Write calls. If they do not, the enforcement layer has a gap for agent-originated artifact writes. This assumption must be verified early in implementation.

---

### Hook Architecture

#### Hook Registry

*[Revised: SubagentStop removed, SessionStart deferred, shell scripts changed to Node.js, gates.yml validation added]*

All hooks registered in `hooks/hooks.json` within the plugin:

| Hook Event | Handler Type | Matcher | Purpose | Blocking? |
|-----------|-------------|---------|---------|-----------|
| `PreToolUse` | command | `Write` | Validate state.yml, checkpoint.yml, and gates.yml writes | Yes (exit 2 denies) |
| `PostToolUse` | command | `Write` | Audit trail for gate overrides | No |
| `PreCompact` | command | — | Flush checkpoint + write session summary before compaction | No |
| `Stop` | command | — | Write session summary for next session handoff | No |

**Deferred hooks** (add when justified by observed need or platform stabilization):
- `SessionStart` — Context loading on session resume. Deferred per C4 until platform bugs confirmed fixed.
- `SubagentStop` — Agent output validation. Deferred as speculative (no repo demonstrates this pattern).

#### Hook 1: PreToolUse on Write (State Transition Guard + Gate Integrity)

*[Revised: expanded to validate gates.yml per V1 Critical Issue 3; implementation language changed to Node.js]*

**What it enforces**: Every Write call targeting `.expedite/state.yml`, `.expedite/checkpoint.yml`, or `.expedite/gates.yml` passes through a Node.js validator script.

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
4. If the step number is decreasing (regression): allow if `inputs_hash` differs from the current checkpoint's hash (indicating changed inputs justify re-execution); deny otherwise

*[Revised: regression rule relaxed per V1 issue #5 — inputs_hash change replaces recovery substep requirement]*

**For gates.yml writes**:
1. Parse the proposed YAML content
2. Validate that gate entries have the expected structure (gate identifier, timestamp, outcome, evaluator)
3. Validate that the gate identifier matches a valid gate for the current phase
4. Validate that the `outcome` field uses a recognized value (go, no-go, go-with-advisory, overridden)
5. If `overridden: true`, validate that `override_reason` is present (overrides must have reasons)

*[Revised: added gates.yml validation per V1 Critical Issue 3 — closes the fabrication bypass]*

**Non-state file writes**: If the path is not an `.expedite/*.yml` state file, exit 0 immediately (allow). Non-state writes pass through without validation.

**Developer experience when blocked**: The developer sees Claude report something like: "I tried to advance the lifecycle to research_in_progress, but the state write was blocked. The enforcement hook says: 'Cannot transition from scope_in_progress to research_in_progress — G1 gate has not passed. Current gate status: no G1 entry in gates.yml. Run /expedite:gate to evaluate scope completeness.' Let me help you run the gate evaluation instead."

The developer never sees a raw exit code or cryptic error. The `permissionDecisionReason` field provides human-readable guidance that Claude relays naturally.

#### Hook 2: PostToolUse on Write (Override Audit)

**What it does**: After any Write to `.expedite/gates.yml`, the script checks whether the latest entry has `overridden: true`. If so, it appends to `.expedite/audit.log`:
```
[2026-03-12T14:30:00Z] GATE OVERRIDE: G1 overridden by user. Reason: "Scope is sufficient for exploratory spike." Severity: low. Affected DAs: none.
```

**Developer experience**: The developer never sees this hook fire. It is purely for traceability. If the developer later wonders "did I override any gates?", they can check `audit.log`. The audit trail is append-only — it cannot be edited or truncated by agents.

#### Hook 3: PreCompact (Checkpoint Preservation)

**What it does**: Before context compaction, the Node.js script:
1. Reads the current `.expedite/checkpoint.yml`
2. If it exists, copies it to `.expedite/checkpoint.yml.pre-compact` as a backup
3. Writes a one-paragraph session summary to `.expedite/session-summary.md` containing the current skill, step, and what was being done

**Developer experience**: Context compaction happens silently. The developer may notice the conversation seems shorter, but their progress is preserved. If the LLM needs to resume after compaction, it reads checkpoint.yml and session-summary.md and continues seamlessly.

#### Hook 4: Stop (Session Summary)

*[Revised: clarified that Stop writes session-summary.md only, not checkpoint.yml, per V2 recommendation]*

**What it does**: When Claude finishes responding and the session may end:
1. Reads current state.yml and checkpoint.yml from disk
2. Writes `.expedite/session-summary.md` with: what happened this session, current state, and recommended next action
3. This summary is consumed by frontmatter injection on the next session (and by SessionStart if that hook is added later)

The Stop hook does NOT write or update checkpoint.yml. Checkpoints are written by skills at step boundaries — the Stop hook lacks conversational context to determine the current step accurately.

**Developer experience**: Invisible. The developer starts a new session and sees the context loaded via skill frontmatter as if they never left.

#### Latency and UX Impact

| Hook | Expected Latency | Frequency | UX Impact |
|------|-----------------|-----------|-----------|
| PreToolUse (state/checkpoint/gates) | ~100-200ms | Every state/checkpoint/gates write (5-15 per skill run) | Imperceptible |
| PostToolUse (audit) | ~50ms | Only on gate override writes (rare) | None |
| PreCompact | ~100-200ms | 0-2 times per long session | None (pre-compaction moment) |
| Stop | ~100-200ms | Once per session end | None (post-response) |

Total hook-induced latency during normal operation: less than 1-2 seconds per skill run, spread across 5-15 state writes. The developer does not perceive any lag from enforcement hooks.

#### Override Mechanism

*[Revised: explicitly labeled as a design invention, not an evidenced pattern, per V2 feedback]*

When a hook blocks a state write, the developer has two paths:

1. **Address the issue**: Run the required gate, complete the missing step, or fix the validation error. This is the expected path.
2. **Override**: The developer explicitly tells the skill to override the gate (e.g., "override G1, reason: scope is sufficient for this exploratory spike"). The skill:
   a. Writes `overridden: true` to gates.yml with the reason and severity
   b. The PreToolUse hook on gates.yml validates the override structure (reason must be present)
   c. The PostToolUse audit hook logs the override to audit.log
   d. Skill retries the state write — the PreToolUse hook on state.yml allows transitions when `overridden: true` exists for the required gate

**Design invention note**: The override + code-enforced gate interaction (writing an override record to gates.yml that the PreToolUse hook recognizes) is not demonstrated by any surveyed source. It is a reasonable design extrapolation but must be validated during the structural gate implementation phase. If the interaction proves problematic, an alternative is a separate override file or an environment-variable-based bypass.

Overrides are never silent. They produce artifacts (override-context.md), audit entries, and gate_history records. The developer can always trace why a phase was advanced.

---

### State Management Architecture

#### File-Per-Concern Structure

```
.expedite/
+-- state.yml           # Lifecycle identity and phase (core memory — always loaded)
+-- checkpoint.yml      # Step-level tracking and resume data (core memory — always loaded)
+-- questions.yml       # Research questions and refinement history (loaded by scope/research)
+-- gates.yml           # Gate evaluation history and overrides (loaded by gate/status, hook-validated)
+-- tasks.yml           # Execution task list and completion tracking (loaded by execute)
+-- session-summary.md  # Last session's handoff notes (loaded by frontmatter)
+-- audit.log           # Append-only override audit trail (never loaded into context)
+-- evidence/           # Research artifacts (loaded on demand by agents)
```

#### state.yml (~15 lines, always loaded)

```yaml
version: 1
lifecycle_id: "lifecycle-2026-03-12-myproject"
project_name: "MyProject"
phase: "research_in_progress"
started_at: "2026-03-12T10:00:00Z"
phase_started_at: "2026-03-12T11:30:00Z"
```

This file changes only on phase transitions (roughly 6 times per lifecycle). It is small enough to inject into every skill via frontmatter without token concern.

#### checkpoint.yml (~10-20 lines, always loaded)

*[Revised: clarified that only skills write this file, per V1 Critical Issue 1]*

```yaml
skill: research
step: 7
label: "Dispatch web researchers"
substep: "waiting_for_agents"
continuation_notes: "3 of 5 web researchers dispatched. Remaining: DA-4 worktree patterns, DA-6 memory strategies."
inputs_hash: "a3f2b1..."
updated_at: "2026-03-12T12:45:00Z"
```

This file changes on every step transition. It is the primary resume mechanism. The `inputs_hash` field enables idempotency checks — if the inputs to a step haven't changed since the checkpoint was written, the step can be safely skipped. **Written only by skills at step boundaries, never by agents or hooks.**

#### questions.yml (variable size, loaded by scope and research skills)

Contains the research questions generated during scope, along with refinement history. Only loaded by skills that need it, keeping token usage proportional to relevance.

#### gates.yml (variable size, loaded by gate and status skills, hook-validated)

*[Revised: now hook-validated to prevent fabricated gate results]*

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

#### tasks.yml (variable size, loaded by execute skill only)

Contains the phased task list and per-task completion status. Only loaded by the execute skill.

#### Write Patterns and Validation

*[Revised: checkpoint.yml restricted to skill-only writes; gates.yml now hook-validated]*

**state.yml**: Written only by skills (not agents). Every write passes through the PreToolUse hook which validates FSM transitions. Writes are whole-file rewrites.

**checkpoint.yml**: Written only by skills at step boundaries (not by agents, not by hooks). Every write passes through the PreToolUse hook which validates schema and step regression rules. Writes are whole-file rewrites.

**gates.yml**: Written by gate skill and gate evaluation scripts. Every write passes through the PreToolUse hook which validates gate result structure and phase consistency. This prevents agents from fabricating gate results.

**questions.yml, tasks.yml**: Written by skills and agents. No hook validation on these files — their structure is enforced by the producing skill/agent's instructions. These files grow during the lifecycle but are loaded only by the skills that need them.

**audit.log**: Append-only, written only by the PostToolUse audit hook. Never loaded into LLM context.

#### State Consumption Patterns

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

#### State Schema and Evolution

*[Revised: adopted P2's schema evolution strategy]*

**Version field**: `state.yml` includes a `version: 1` field. If the schema changes, the validation hook can apply migration logic.

**Schema evolution process (adding a field)**:
1. Add the field to the schema in `state-schema.js` with a default value
2. Make the field optional in validation (backward compatible)
3. Skills that produce the field start writing it
4. Skills that consume the field start reading it
5. After all skills are updated, optionally make the field required

**Schema evolution process (adding a state file)**:
1. Create the schema definition
2. Add the file path to the PreToolUse hook's known-state-files list
3. Add frontmatter injection to consuming skills
4. Deploy

Neither operation requires changing existing state files or migrating data. New concerns get new files.

#### Token Cost of State Injection

*[Adopted from P2]*

| State Config | Estimated Tokens per Skill Invocation |
|--------------|---------------------------------------|
| Current (full state.yml, growing) | 500-2,000+ tokens (grows with lifecycle) |
| Proposed (scoped injection) | 100-400 tokens (fixed per skill, does not grow) |

**Savings**: 60-80% reduction in state injection tokens.

#### State Debugging

*[Adopted from P2]*

State is plain YAML files in `.expedite/`. Debugging is:
1. Read the file directly (`cat .expedite/state.yml`)
2. Check the checkpoint (`cat .expedite/checkpoint.yml`)
3. Validate manually (`node hooks/validate-state-write.js < test-input.json`)
4. Check hook errors (`cat .expedite/hook-errors.log`)

No database to query, no event log to replay, no checkpoint store to inspect. Four commands, no special tools.

---

### Agent Formalization

#### Agent Definition Format

*[Revised: agents located in plugin's `agents/` directory per P2 recommendation; disallowedTools guidance adopted from P2]*

Every agent is a Markdown file in the plugin's `agents/` directory with YAML frontmatter following the official Claude Code subagent schema:

```yaml
---
name: web-researcher
description: "Executes web research for a single research question, producing structured evidence files."
model: sonnet
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

Project-level overrides in `.claude/agents/` take precedence per the official priority ordering (CLI flag > project `.claude/agents/` > user `~/.claude/agents/` > plugin `agents/`).

#### Key Frontmatter Fields and Their Purpose

| Field | Purpose | DX Impact |
|-------|---------|-----------|
| `name` | Unique identifier, used in dispatch | Developer can reference agents by name |
| `description` | When Claude should delegate to this agent | Enables dispatch clarity |
| `model` | Cost/capability tiering | Developer controls spend per agent type |
| `tools` | Tool allowlist (use for tightly restricted agents) | Prevents agents from doing unintended operations |
| `disallowedTools` | Tool denylist (use for broadly capable agents) | Safety net; more maintainable as new tools are added |
| `maxTurns` | Execution cap | Prevents runaway agents; developer knows worst-case duration |
| `permissionMode` | Permission handling | Reduces permission prompts for trusted operations |
| `memory` | Persistent memory scope (experimental) | Agents that learn across lifecycles |
| `isolation` | Worktree isolation | Code-modifying agents get filesystem isolation |

*[Revised: adopted P2's disallowedTools vs. tools guidance]* Use `disallowedTools` (denylist) for agents that need broad access minus a few dangerous tools. Use `tools` (allowlist) only for tightly restricted agents that should have a small, specific tool set. This is more maintainable because new tools added to Claude Code are automatically available to denylist agents.

#### Agent Registry

*[Revised: sufficiency-evaluator removed, agent count reduced to 10, located in plugin agents/ directory]*

```
agents/
+-- scope-facilitator.md       # Sonnet — Conducts scope conversation
+-- research-planner.md        # Sonnet — Generates research questions
+-- web-researcher.md          # Sonnet — Web research per question
+-- codebase-researcher.md     # Sonnet — Codebase analysis per question
+-- research-synthesizer.md    # Opus  — Synthesizes evidence (memory: project, experimental)
+-- design-architect.md        # Opus  — Produces design documents
+-- plan-decomposer.md         # Sonnet — Breaks design into phases
+-- spike-researcher.md        # Sonnet — Resolves tactical decisions
+-- task-implementer.md        # Sonnet — Implements code (isolation: worktree)
+-- gate-verifier.md           # Opus  — Semantic quality evaluation (memory: project, experimental)
```

#### Tool Restrictions Per Agent Type

*[Revised: uses disallowedTools pattern for broadly-capable agents, tools pattern for restricted agents]*

| Agent | Restriction Type | Restricted/Allowed Tools | Rationale |
|-------|-----------------|--------------------------|-----------|
| web-researcher | disallowedTools | Bash, Edit, EnterWorktree | Needs web access and file writing; no code execution or worktrees |
| codebase-researcher | disallowedTools | Write, Edit, WebSearch, WebFetch, EnterWorktree | Read-only codebase exploration; no modification |
| research-synthesizer | disallowedTools | Bash, WebSearch, WebFetch, EnterWorktree | Reads evidence, writes synthesis; no code execution or web access |
| design-architect | disallowedTools | Bash, WebSearch, WebFetch, EnterWorktree | Reads synthesis, writes design; no code execution |
| task-implementer | disallowedTools | WebSearch, WebFetch | Full code modification; isolated via worktree |
| gate-verifier | tools (allowlist) | Read, Glob, Grep | Read-only evaluation; cannot modify artifacts being evaluated |
| plan-decomposer | disallowedTools | Bash, WebSearch, WebFetch, EnterWorktree | Reads design, writes plan; no code execution |

**DX rationale**: Tool restrictions build developer trust. The developer knows that only the task-implementer can modify source code, and it runs in an isolated worktree. The gate-verifier uses an explicit allowlist (tools) because it must be strictly read-only — it evaluates artifacts and must never modify them.

#### Model Tiering Strategy

| Tier | Model | Agent Types | Rationale |
|------|-------|-------------|-----------|
| Premium | Opus | research-synthesizer, design-architect, gate-verifier | Tasks requiring deep reasoning, cross-referencing, and quality judgment |
| Balanced | Sonnet | web-researcher, codebase-researcher, plan-decomposer, spike-researcher, task-implementer, scope-facilitator, research-planner | Tasks requiring competent execution within clear parameters |
| Fast | Haiku | (Reserved for future: quick lookups, file existence checks) | Not currently used; available for future optimization |

**Cost optimization rule** (from P2): An agent should use Sonnet unless there is a specific reason it needs Opus. The default is the balanced tier. Upgrading to Opus requires justification (e.g., "this agent's output directly passes a quality gate" or "this agent synthesizes across multiple evidence sources").

#### Per-Agent Memory

*[Revised: framed as experimental per V2 feedback]*

**gate-verifier** agent:
- `memory: project` (experimental) — May learn common failure patterns across gate evaluations. Its MEMORY.md would accumulate notes like "Design documents for data-heavy projects often miss DA-2 state evolution considerations."
- Evaluation criteria: inspect MEMORY.md after 3 lifecycles for accuracy and relevance.

**research-synthesizer** agent:
- `memory: project` (experimental) — May learn synthesis patterns. Its MEMORY.md would accumulate notes about which evidence structures produce the most useful syntheses.
- Evaluation criteria: compare synthesis quality between lifecycles 1 and 3.

**task-implementer** agent:
- `isolation: worktree` — Gets its own worktree for code modifications.
- No persistent memory (each implementation task is independent).

All other agents: no persistent memory, no isolation.

---

### Quality Gate Enforcement

#### Gate Classification

| Gate | Phase Transition | Type | Enforcement |
|------|-----------------|------|-------------|
| G1 | scope_complete | Structural | Code-enforced (deterministic script) |
| G2 | research_complete | Structural + Light Semantic | Code-enforced structural checks + verifier agent for readiness assessment quality |
| G3 | design_complete | Semantic (primary) | Code-enforced structural rubric + verifier agent for reasoning soundness |
| G4 | plan_complete | Structural | Code-enforced (deterministic script) |
| G5 | spike_complete | Semantic (primary) | Code-enforced structural rubric + verifier agent for reasoning soundness |

*[Revised: G2 classification adjusted to Structural + Light Semantic, aligning with V1's recommendation and Proposal 3's analysis. Determining whether evidence is "sufficient" for a decision area requires judgment, not just field-existence checking.]*

#### Structural Gates (G1, G4): Deterministic Validation

**G1 (Scope Completeness)**:
The gate skill invokes the structural check script which validates:
- SCOPE.md exists and is not empty
- questions.yml exists with at least 3 questions
- Every decision area referenced in SCOPE.md has at least one question in questions.yml
- All questions have `priority` and `depth` fields

**G4 (Plan Completeness)**:
- PLAN.md exists with phase decomposition
- Each phase has: title, description, scope, success criteria, and estimated effort
- Phase count is between 2 and 20 (sanity bounds)
- Total tasks across phases is at least 5

These checks are Node.js functions operating on file contents. They produce the same result every time for the same inputs. No LLM judgment involved. Token cost: zero.

**Developer experience with structural gates**: The developer runs `/expedite:gate` or tries to advance the phase. If structural checks fail, they see a specific, actionable message: "G1 structural check failed: questions.yml has 2 questions, minimum is 3. DA-3 has no questions. Add questions for DA-3 to pass G1." There is no ambiguity — the developer knows exactly what to fix.

#### G2 (Research): Structural + Light Semantic

*[Revised: reclassified from original design to explicitly include a light semantic component]*

**Structural component** (code-enforced):
- research-synthesis.md exists
- All category files referenced in SCOPE.md exist
- Each decision area has a corresponding section in the synthesis
- READINESS.md exists with per-DA status

**Light semantic component** (verifier agent):
- Readiness assessment quality: are the evidence sufficiency ratings ("strong", "adequate", "insufficient") justified by the evidence actually cited?
- This is a lightweight evaluation — the verifier reads the readiness assessment and checks whether the evidence density supports the claimed sufficiency level

The semantic component is lighter than G3/G5 because it checks a single dimension (evidence-sufficiency rating accuracy) rather than multi-dimensional reasoning quality.

#### Semantic Gates (G3, G5): Dual-Layer Evaluation

**Layer 1 — Structural Rubric (Code-Enforced)**:
For G3 (Design):
- DESIGN.md exists with all required sections
- Every decision area from SCOPE.md has a corresponding section
- Each decision section references evidence (contains at least one citation or evidence file reference)
- Word count per section exceeds minimum threshold (e.g., 100 words)

For G5 (Spike):
- Each spike output file exists for every phase that required spiking
- Each spike file contains: decision, rationale, implementation steps, and validation criteria
- Implementation steps count is at least 3

**Layer 2 — Reasoning Verification (Verifier Agent)**:

*[Revised: completeness checking moved from SubagentStop hook to gate skill inline check]*

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

After the gate-verifier agent returns, the gate skill validates evaluation completeness:
- All rubric dimensions scored
- Reasoning notes provided for each dimension
- Overall outcome is one of the recognized values
- If incomplete (e.g., verifier hit maxTurns before finishing), the gate skill reports the incomplete evaluation and offers to re-run

**Anti-rubber-stamp measures**:
1. The verifier agent is a separate agent from the producer (role separation as bias mitigation).
2. The verifier has read-only tool access — it cannot fix what it evaluates.
3. The verifier's experimental persistent memory may accumulate failure patterns, making it more critical over time.
4. The structural rubric layer catches "checked all boxes but boxes are empty" failures independently.
5. The structured output format forces per-dimension scoring, preventing a single "looks good" judgment.

**Developer experience with semantic gates**: The developer runs `/expedite:gate`. First, structural checks run instantly (sub-second). If structural checks fail, the developer gets immediate feedback without waiting for the verifier. If structural checks pass, the verifier agent runs (30-60 seconds). The developer sees progress. When the verifier finishes, the developer sees a per-dimension breakdown. If the gate passes with advisory, the developer sees what could be improved but is not blocked. If the gate fails, the developer sees specific dimensions that need work.

#### Gate-State Integration

Gates are state transition guards. The PreToolUse hook on state.yml enforces:
1. Parse proposed state.yml to detect phase transition
2. If transitioning to `X_complete`, read gates.yml
3. Check for a gate entry matching the required gate (G1 for scope_complete, G2 for research_complete, etc.)
4. Entry must have `outcome: "go"` or `outcome: "go-with-advisory"` or `overridden: true`
5. If no qualifying entry exists, deny the write with: "Cannot advance to {phase} — {gate} has not passed"

This makes gate bypass structurally impossible. Even if the skill's instructions are ignored (prompt-enforcement failure), the hook prevents the state write. The enforcement is in code, not in prompts.

#### Override Flow

1. Developer tells the skill: "Override G1, the scope is sufficient for an exploratory spike"
2. Skill writes to gates.yml: `{gate: G1, outcome: overridden, override_reason: "...", severity: low}`
3. PreToolUse hook on gates.yml validates the override structure (reason present, valid gate ID)
4. PostToolUse audit hook logs the override to audit.log
5. Skill retries the state transition — PreToolUse hook on state.yml sees `overridden: true` and allows the write
6. Developer sees confirmation: "G1 overridden. Override logged. Advancing to research phase."

**Design invention note**: This interaction pattern (override record in gates.yml recognized by PreToolUse hook on state.yml) is not demonstrated by any surveyed source. Validate during structural gate implementation.

---

### Resume & Recovery Architecture

#### Generalized Checkpoint Mechanism

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

*[Revised: adopted P3's distinction]* The checkpoint is machine-readable state for deterministic resume — it tells the system WHERE to resume. The session summary (session-summary.md) is LLM-readable narrative context — it tells the LLM WHY and WHAT the situation is. Both are needed; they serve different consumers.

#### Step-Level Tracking and Deterministic Resume

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

This is deterministic. The same checkpoint always produces the same resume point.

#### Session Handoff Pattern

When a session ends (Stop hook) or compaction occurs (PreCompact hook):
1. Current checkpoint.yml is preserved (it is already on disk, written by the skill at the last step boundary)
2. `.expedite/session-summary.md` is written with: what happened, current state, what to do next

When a new session starts (via skill frontmatter injection):
1. checkpoint.yml is loaded — the system knows the exact step
2. session-summary.md is loaded — the system has narrative context
3. The skill reports: "Resuming research, step 7 of 12: Dispatch web researchers. 3 of 5 dispatched."

#### Idempotency Guarantees

**Step re-execution safety**: If a step was partially completed when the session ended, re-running it should not duplicate work or corrupt state:

- **Artifact-producing steps**: Check if the artifact exists and matches the inputs_hash. If yes, skip. If no, re-produce.
- **Agent-dispatching steps**: Check which agents have produced output files. Dispatch only the remaining agents. continuation_notes records which were already dispatched.
- **State-modifying steps**: The PreToolUse hook ensures idempotent state writes — writing the same valid state twice is harmless.

**The inputs_hash field**: Before executing a step, the skill hashes the step's inputs. If the hash matches the checkpoint's inputs_hash, the step was already completed with these inputs. If the hash differs (inputs changed), the step should be re-executed. *[This also enables the revised regression rule: step regression is allowed when inputs_hash differs.]*

#### Developer Experience on Resume

*[These scenarios are design imagination that makes the architecture tangible. They are not evidence-derived but represent the DX vision.]*

**Moment 1 — Opening a session with active work**:
The developer opens Claude Code. The first skill invocation loads state via frontmatter. They see:
```
Expedite lifecycle active: MyProject
Phase: research_in_progress
Last checkpoint: research/step 7 -- "Dispatch web researchers"
3 of 5 researchers dispatched. 2 remaining.
Recommended action: Run /expedite:research to continue.
```

**Moment 2 — Resuming after compaction**:
The conversation was long and auto-compacted. checkpoint.yml and session-summary.md are on disk. The skill reads them and says:
```
Resuming from checkpoint. Research step 7: dispatching remaining 2 web researchers.
Previous session notes: "3 of 5 dispatched. Remaining: DA-4, DA-6."
Continuing from where we left off.
```

**Moment 3 — Resuming after a crash (mid-step)**:
Checkpoint.yml still shows step 7 with substep "dispatching." On resume, the skill checks agent outputs:
```
Resuming research step 7. Checking agent outputs...
Found: DA-1, DA-2, DA-3 completed. DA-4 and DA-6 pending.
Dispatching researchers for DA-4 and DA-6.
```

---

### Context & Memory Strategy

#### Scoped Injection

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

#### PreCompact Handling

The PreCompact hook writes:
1. `checkpoint.yml` backup (ensures it is current)
2. `session-summary.md` with a narrative handoff note

After compaction, the conversation loses history but state files persist. The next tool call or prompt that references expedite triggers the skill to re-read state from disk.

#### Agent Persistent Memory (Experimental)

*[Revised: framed as experimental with evaluation criteria per V2 feedback]*

**research-synthesizer** (`memory: project`):
- MEMORY.md would accumulate synthesis patterns across lifecycles.
- The developer can inspect `.claude/agent-memory/research-synthesizer/MEMORY.md`.
- Evaluation: after 3 lifecycles, assess whether accumulated patterns improved synthesis quality.

**gate-verifier** (`memory: project`):
- MEMORY.md would accumulate evaluation patterns across lifecycles.
- The developer can inspect and edit this memory — they can correct the verifier's learned heuristics.
- Evaluation: after 3 lifecycles, assess whether accumulated patterns improved gate evaluation accuracy.

**DX rationale**: Making agent memory inspectable and editable gives the developer control over the system's learned behavior. If the verifier becomes too strict, edit its MEMORY.md. If the synthesizer has accumulated stale patterns, clear it. The system may improve over time but remains under developer control.

#### Session Summary (with Frontmatter Fallback)

*[Revised: frontmatter is the primary mechanism; SessionStart is a future enhancement]*

**Primary path**:
1. Stop hook writes session-summary.md at session end
2. Each skill's frontmatter includes: `!cat .expedite/session-summary.md 2>/dev/null`
3. When the developer invokes any skill, they see the session summary as part of the skill's context
4. The skill reads checkpoint.yml for deterministic resume regardless

**Future enhancement path (SessionStart)**:
1. If SessionStart is added later, it reads session-summary.md and outputs status before the developer types anything
2. This provides slightly earlier context delivery but is functionally equivalent

The developer experience is functionally identical in both paths. The summary and checkpoint are on disk either way.

---

### Worktree Isolation

#### Execute-Skill Worktree Design

*[Revised: added EnterWorktree to disallowedTools for non-execute agents per P3]*

Only the task-implementer agent gets worktree isolation:

```yaml
# agents/task-implementer.md
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
# Example: agents/web-researcher.md
---
name: web-researcher
disallowedTools:
  - Bash
  - Edit
  - EnterWorktree
---
```

#### Isolation Configuration

When the execute skill dispatches a task-implementer agent:
1. Claude Code automatically creates a worktree for the agent
2. The agent works in isolation — no interference with the main branch
3. If the agent makes no changes: worktree is auto-cleaned
4. If the agent makes changes: worktree path and branch are returned to the execute skill

#### Merge-Back Flow

After a task-implementer completes:
1. Execute skill receives the worktree branch name and path
2. Execute skill presents the changes to the developer: "Task 3 complete. Changes on branch `expedite/task-3`. Files modified: src/foo.ts, tests/foo.test.ts. Ready to merge?"
3. Developer reviews (can inspect diff) and confirms
4. Execute skill merges the branch (or the developer merges manually)
5. If merge conflicts exist, the skill reports them and pauses for developer resolution

#### Failure Handling

**Agent crash mid-worktree**: The worktree persists on disk. On resume, the execute skill detects the orphaned worktree and asks: "Found incomplete worktree for task 3. Resume implementation, or discard and restart?"

**Merge conflict**: The execute skill does not auto-resolve conflicts. It reports the conflicting files and pauses. The developer resolves conflicts manually.

**Multiple tasks**: Each task gets its own worktree. The merge-back happens sequentially to avoid cascading conflicts.

---

### Skill-Agent Interaction

#### Dispatch Pattern

Skills dispatch agents via the standard Claude Code Agent tool, referencing agents by name:

```
1. Skill reads checkpoint.yml to determine current step
2. Skill assembles context for the agent: relevant artifacts, task description, output expectations
3. Skill invokes agent by name via Agent tool
4. Agent executes with its own frontmatter (model, tools, maxTurns)
5. Agent produces artifacts and returns summary
6. Skill processes results: updates checkpoint, presents to developer
```

#### Context Passing

*[Revised: adopted P2's minimal sufficient context guidelines]*

The dispatch prompt **SHOULD include**:
- **The specific task**: What the agent should accomplish (1-3 sentences)
- **Input artifact paths**: Where to read source material (paths, not content — the agent reads it)
- **Output artifact path**: Where to write results
- **Output format**: What the result should look like (section structure, YAML schema, etc.)
- **Scope boundaries**: What is in-scope and out-of-scope for this agent

The dispatch prompt **SHOULD NOT include**:
- Full state file contents (the agent does not need lifecycle state)
- Other agents' outputs (unless explicitly relevant to this task)
- Skill step sequence (the agent does not need to know the overall workflow)
- Gate criteria (the agent produces work; the gate evaluates it separately)

**Why minimal context matters**: Every token in the dispatch prompt is billed at the agent's model tier rate. Excessive context can also confuse the agent — focused prompts produce better results.

#### Result Handling

When an agent returns:
1. Skill reads the agent's summary message
2. Skill verifies the expected artifact(s) exist on disk (file-existence check)
3. Skill updates checkpoint.yml with the completed step
4. Skill presents results to the developer

#### Failure Handling

When an agent fails:
1. Skill detects the failure from the agent's return
2. Skill reports to the developer with specific details
3. Skill offers options: "Retry with more turns? Continue with partial evidence? Skip this question?"
4. Skill does NOT automatically retry — the developer decides

**DX rationale**: Automatic retry can waste tokens and time if the failure is systemic. By surfacing the failure with options, the developer maintains control.

---

### Migration Sequence

*[Revised: added cost-benefit table from P2, reversibility column from P3, and stronger justification for Increment 1 bundling]*

#### Increment 1: Hook Infrastructure + State Splitting
**What**: Create hooks/hooks.json with PreToolUse on Write for state.yml and checkpoint.yml validation. Split state.yml into state.yml + checkpoint.yml. Update existing skill frontmatter to load the new files. Implement in Node.js with `js-yaml` dependency.

**Why bundled**: State splitting without hook validation creates an unprotected window where corrupted state writes are uncaught. The hook needs split state files to validate against. Bundling ensures no period of unprotected split state.

**Standalone value**: State drift prevention. Invalid state transitions become impossible. Token waste reduced via scoped injection.

| Axis | Assessment |
|------|------------|
| Maintenance Reduction | High (smaller files, scoped reads, automated enforcement) |
| Token Savings | High (60-80% state injection reduction) |
| Risk Mitigation | High (prevents state drift) |
| Estimated Effort | Medium (hook script + YAML restructuring + frontmatter updates) |
| Reversible? | Yes (can re-merge files, remove hook) |

#### Increment 2: Generalized Checkpoint + Resume
**What**: Implement checkpoint.yml writes in all 6 skills. Update resume logic to read checkpoint.yml directly instead of artifact-existence heuristics.

**Standalone value**: Deterministic resume for all skills.

| Axis | Assessment |
|------|------------|
| Maintenance Reduction | High (deterministic resume replaces fragile heuristics) |
| Token Savings | Low |
| Risk Mitigation | High (eliminates resume failure modes) |
| Estimated Effort | Medium (checkpoint writes in each skill + resume preamble logic) |
| Reversible? | Yes (can revert to heuristic) |

#### Increment 3: Agent Formalization
**What**: Move agent definitions from `skills/{skill}/references/prompt-*.md` to `agents/*.md` with full frontmatter. Skills become thin dispatchers.

**Standalone value**: Agents have bounded capabilities. Model costs are optimized.

| Axis | Assessment |
|------|------------|
| Maintenance Reduction | Medium (formal agent definitions are self-documenting) |
| Token Savings | Medium (model tiering reduces cost) |
| Risk Mitigation | Medium (tool restrictions prevent agent misbehavior) |
| Estimated Effort | Medium-large (restructuring 10 agents, rewriting skills from thick to thin) |
| Reversible? | Partially (frontmatter is additive; skill thinning is structural) |

#### Increment 4: Structural Gate Enforcement
**What**: Implement deterministic gate checks (G1, G2-structural, G4) as Node.js functions. Split remaining state files (questions.yml, gates.yml, tasks.yml). Add PreToolUse validation for gates.yml writes.

**Standalone value**: 3 of 5 gates become impossible to bypass or rubber-stamp. Gate result integrity is protected.

| Axis | Assessment |
|------|------------|
| Maintenance Reduction | Medium (gate logic is code, not prompts) |
| Token Savings | Medium (code gates cost zero tokens) |
| Risk Mitigation | High (eliminates rubber stamp for 60% of gates, closes fabrication bypass) |
| Estimated Effort | Medium (Node.js gate check functions) |
| Reversible? | Yes (can revert to prompt-enforced) |

#### Increment 5: Semantic Gate Enforcement
**What**: Create gate-verifier agent. Implement the dual-layer evaluation flow for G3 and G5. Gate skill validates verifier completeness inline.

**Standalone value**: G3 and G5 gates get rigorous, bias-mitigated evaluation.

| Axis | Assessment |
|------|------------|
| Maintenance Reduction | Low (adds a verifier agent to maintain) |
| Token Savings | Negative (verifier costs ~5,000-15,000 tokens per invocation) |
| Risk Mitigation | High (eliminates rubber stamp for remaining gates) |
| Estimated Effort | Medium (one new agent, evaluation prompt engineering, structured output format) |
| Reversible? | Yes (can revert to prompt-enforced) |

#### Increment 6: Context Management + Session Handoff
**What**: Implement PreCompact hook, Stop hook session summaries. Add experimental persistent memory to research-synthesizer and gate-verifier agents.

**Standalone value**: Context compaction and session transitions become seamless. Agent memory begins experimental accumulation.

| Axis | Assessment |
|------|------------|
| Maintenance Reduction | Medium (automated context preservation) |
| Token Savings | Low |
| Risk Mitigation | Medium (prevents context loss) |
| Estimated Effort | Small-medium (hook scripts for compaction/session lifecycle, memory configuration) |
| Reversible? | Yes (can remove hooks, disable memory) |

#### Increment 7: Worktree Isolation for Execute
**What**: Add `isolation: worktree` to task-implementer agent. Add `EnterWorktree` to `disallowedTools` for all non-execute agents. Implement merge-back flow.

**Standalone value**: Code modifications happen in isolation.

| Axis | Assessment |
|------|------------|
| Maintenance Reduction | Low (one frontmatter field) |
| Token Savings | Zero |
| Risk Mitigation | Medium (prevents code conflicts) |
| Estimated Effort | Small (frontmatter field + merge-back orchestration) |
| Reversible? | Yes (remove frontmatter field) |

#### Dependency Chain

```
Increment 1 (Hooks + State Split)
    +-- Increment 2 (Checkpoint + Resume)
    |       +-- Increment 6 (Context + Session Handoff)
    +-- Increment 3 (Agent Formalization)
    |       +-- Increment 5 (Semantic Gates)
    |       +-- Increment 7 (Worktree Isolation)
    +-- Increment 4 (Structural Gates)
            +-- Increment 5 (Semantic Gates)
```

Increments 2, 3, and 4 can proceed in parallel after Increment 1. Increment 5 requires both 3 and 4. Increments 6 and 7 have simpler dependency chains.

---

### Developer Experience Moments

*[These scenarios are design imagination — they represent the DX vision the architecture aims to deliver, not evidence-derived predictions. They make the architecture tangible and verifiable against real usage.]*

#### Starting a New Lifecycle

The developer runs `/expedite:scope`. The skill checks state.yml — no active lifecycle. It initializes state.yml and checkpoint.yml and begins the scope conversation. The harness is invisible — the developer is having a conversation, not configuring a system.

#### Hitting a Quality Gate

The developer finishes scope and the skill tries to advance to `scope_complete`. The PreToolUse hook fires:

**If G1 passes**: Structural checks run sub-second. "G1 passed: 12 questions across all decision areas. Ready for /expedite:research."

**If G1 fails**: "G1 structural check failed: questions.yml has 2 questions (minimum 3), DA-4 has no questions." The developer sees specific gaps and can address them.

#### Resuming After Context Reset

The developer returns after a break. The first skill invocation loads state via frontmatter:

"Expedite lifecycle active: MyProject. Phase: research_in_progress. Checkpoint: research/step 7 — Dispatch web researchers. 3 of 5 dispatched."

The developer types `/expedite:research`. The skill reads checkpoint.yml, skips steps 1-6, and resumes at step 7. It checks which researcher outputs exist, identifies pending ones, and dispatches only those.

#### Getting Blocked by a Hook

An agent or skill tries to write an invalid state transition. The PreToolUse hook blocks the write. Claude reports: "I tried to advance to the design phase, but the state write was blocked. The enforcement system says: 'Invalid phase transition: scope_in_progress cannot transition to design_in_progress. Valid transitions from scope_in_progress are: scope_complete (requires G1 gate passage).' We need to complete scope first."

The developer understands: what happened, why, what the valid options are, and what to do next.

#### Overriding a Gate

The developer decides the scope is good enough for an exploratory spike:

Developer: "Override G1 and G2, I want to jump to spike."

Skill writes overrides to gates.yml (validated by PreToolUse hook for structure), audit hook logs them, state transitions proceed with override flags recognized. Developer sees: "Gates overridden. Phase transitions completed with overrides logged. Note: skipped phases will not have artifacts."

Nothing was silent or hidden.

---

### Risks & Open Questions

#### Risk 1: Hook Implementation Complexity (High Confidence in Mitigation)
*[Revised: risk recharacterized after changing from shell to Node.js]*
The PreToolUse hook validates YAML content using Node.js with `js-yaml`. This is more robust than the original shell script approach. The single dependency is mature and well-tested.

**Mitigation**: Comprehensive test suite for the validation script covering all valid phase transitions and edge cases. Run tests on every hook script change.

#### Risk 2: Checkpoint Write Frequency vs. Performance (Moderate Confidence)
Writing checkpoint.yml on every step transition (5-15 times per skill run) adds file I/O. Each write also triggers the PreToolUse hook for validation (~100-200ms). Total overhead: 0.5-3 seconds per skill run.

**What testing would validate**: Measure actual write + hook latency across 100 checkpoint writes.

#### Risk 3: Agent Formalization Transition Period (High Confidence in Risk)
Moving from thick skills to thin skills + thick agents is significant restructuring. During transition, some skills will be in old pattern and some in new.

**Mitigation**: Increment 3 should be executed skill-by-skill, with each skill fully transitioned and tested before starting the next.

#### Risk 4: Persistent Agent Memory Quality (Low Confidence)
*[Revised: explicitly experimental]*
Memory quality depends on what the agent chooses to remember. If the agent accumulates noisy or incorrect patterns, memory degrades quality.

**Mitigation**: Explicit evaluation criteria after 3 lifecycles. Developer can always inspect, edit, or clear agent memory files.

#### Risk 5: Hook False Positives Blocking Legitimate Work (Moderate Confidence)
If the PreToolUse validation script has bugs, it could block valid state writes. Code-enforcement is strict by default.

**Mitigation**: Include a `EXPEDITE_HOOKS_DISABLED=true` environment variable for emergency bypass. This is distinct from gate overrides — it disables enforcement entirely for debugging only.

#### Risk 6: gates.yml Integrity Under Override Flows (Low Confidence)
*[Revised: new risk identified from V1 Critical Issue 3]*
The gates.yml PreToolUse validation is a design invention. If the validation logic is too strict, it could block legitimate gate results. If too lenient, it does not effectively prevent fabrication.

**What testing would validate**: Run the full gate evaluation flow (structural check -> semantic evaluation -> result write) and the full override flow (override request -> override write -> state advancement) against the PreToolUse hook. Validate both pass without false positives.

#### Platform Assumptions Requiring Early Validation

*[Adopted from P3's risk catalog]*

1. **Write tool provides `tool_input` to PreToolUse hooks**: The design assumes hooks receive proposed file content and path in stdin JSON. If the format differs, the state-guard hook cannot function. Verify in implementation Phase 1.

2. **Plugin-level hooks fire on subagent tool calls**: If PreToolUse hooks do not fire when a subagent uses Write, the "agents never bypass enforcement" invariant has a critical gap. This is the single highest-risk platform assumption. Verify before committing to the architecture.

3. **Exit code 2 blocks Write operations in plugin hooks**: The design depends on exit code 2 from PreToolUse hooks blocking the tool call. Verify in plugin hook context (not just project hook context).

4. **`disallowedTools` in subagent frontmatter is enforced**: If this field is advisory rather than enforced, tool isolation does not work. Verify with a test agent.

5. **Plugin hooks.json has the same semantics as project settings hooks**: Schema parity is confirmed, but behavioral parity (ordering, priority) is assumed. Verify during implementation.

#### Open Question 1: Where Should Hook Scripts Live?
The design places them in `hooks/` within the plugin. Plugin hooks apply whenever the plugin is enabled; project hooks apply regardless of plugins. For expedite, plugin hooks are more appropriate (the enforcement is part of the tool, not the project).

#### Open Question 2: Optimal maxTurns Per Agent Type
The design specifies maxTurns per agent but these values are estimates. Calibration from real usage is needed.

---

## Confidence Assessment

| Design Area | Confidence | Change from Original | Justification |
|-------------|------------|---------------------|---------------|
| Three-layer architecture | High | No change | All proposals converge. STRONG evidence. |
| PreToolUse state guard | High | Expanded (gates.yml added) | STRONG evidence. Gate integrity gap closed. |
| Five-file state split | High | No change | STRONG evidence. Convergent pattern. |
| Checkpoint-based resume | High | Clarified (skills-only writers) | STRONG evidence. Layer separation improved. |
| Structural gates (G1, G4) | High | No change | STRONG evidence. Deterministic enforcement. |
| Semantic gates (G3, G5) | Medium-High | Improved (inline completeness check) | MODERATE evidence. Removed speculative SubagentStop. |
| G2 classification | Medium-High | Changed (structural + light semantic) | Readiness assessment quality genuinely requires judgment. |
| Hook implementation (Node.js) | High | Changed from shell | Validator critique was correct. P2's reasoning is stronger. |
| Agent count (10) | Medium | Reduced from 11 | sufficiency-evaluator removed as contradictory. |
| Agent persistent memory | Low-Medium | Reframed as experimental | WEAK evidence. Honest about evidence base. |
| Override mechanism | Medium | Labeled as design invention | No evidence base. Must be validated in implementation. |
| Migration bundling (hooks + state split) | Medium-High | Defended | Unprotected split state is a genuine risk. |
| SessionStart | Medium | Deferred from initial set | Aligned with C4. Frontmatter is functionally equivalent. |
| Worktree isolation | Medium | Enhanced (EnterWorktree denylist) | ADEQUATE evidence. Defensive measure adopted from P3. |

---

## Remaining Disagreements

### With Proposal 2 (Sustainability Lens)

1. **Agent persistent memory**: Proposal 2 defers entirely. I adopt selective experimental memory for 2 agents. The DX value of inspectable, editable memory that accumulates judgment patterns is genuine, and the maintenance cost is bounded (2 agents, explicit evaluation criteria, developer can always clear). The sustainability concern about "a second state surface" is valid but manageable at this scale.

2. **G2 gate classification**: Proposal 2 classifies G2 as fully structural. I classify G2 as structural + light semantic because determining whether evidence is "sufficient" for a decision area involves judgment that a field-existence check cannot capture. The readiness assessment says "strong" or "adequate" — is that rating accurate? A lightweight verifier check adds meaningful quality assurance at modest cost.

3. **Stop hook writing checkpoints**: Proposal 2 has the Stop hook write/update checkpoint.yml. I have skills write checkpoints at step boundaries and the Stop hook write session-summary.md only. The Stop hook lacks conversational context to determine the current step accurately — it would have to guess based on disk state, which is the kind of heuristic the checkpoint system is designed to replace.

4. **scope-facilitator and research-planner as separate agents**: Proposal 2 considers these as potential skill-level logic. I retain them as agents because they have distinct conversational/reasoning styles that would bloat skills beyond the 200-line target if inlined. The 10-agent count is manageable.

### With Proposal 3 (Evidence Lens)

1. **Hook implementation language**: Proposal 3 chooses shell + `yq` despite honestly labeling it as WEAK evidence. I adopt Node.js, agreeing with Proposal 2 and Proposal 3's own evidence assessment. An enforcement layer should not use the weakest-evidenced implementation option.

2. **Agent persistent memory approach**: Proposal 3 says "experiment with research agents." I experiment with synthesizer and verifier instead. Research agents are ephemeral (different questions each lifecycle) so persistent memory accumulates stale context. The synthesizer and verifier operate across lifecycles with consistent roles, making them better candidates for learning.

3. **Migration sequencing**: Proposal 3 puts hooks after state splitting AND checkpoints (Phase 3). I bundle hooks with state splitting as Phase 1. Hooks are the enforcement mechanism — without them, state splitting has no validation. A corrupted state write during the unprotected window would not be caught.
