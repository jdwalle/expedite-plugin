# Agent Harness Architecture: Revised Resolution 3 (Evidence Lens)

## Revision Summary

The most significant revision is abandoning shell scripts for hook implementation in favor of Node.js -- the validators correctly identified this as the weakest technical decision in the original proposal and internally inconsistent with the evidence lens's own principles. The second major change is bundling state splitting with the PreToolUse hook as a single migration phase (adopting Proposal 1's approach) to eliminate the unprotected window the validators flagged. The design also now includes an explicit agent registry (addressing the completeness gap), clarifies the agent location to plugin `agents/` directory as primary, and reframes agent persistent memory as a deferred experiment rather than an adopted-but-flagged choice. The core architectural positions -- evidence grounding, risk transparency, structural gate code-enforcement, checkpoint-based resume, three-layer separation -- held firm because the validators affirmed these as the proposal's strongest contributions.

---

## Validator Response Log

| # | Validator | Issue | Response | Impact |
|---|-----------|-------|----------|--------|
| 1 | V1 (Coherence) | Shell script choice is the weakest technical decision across all proposals | **Accept.** Concede fully. Node.js is adopted. The original proposal honestly rated this as WEAK evidence and then chose it anyway -- that is internally inconsistent with the evidence lens. V1 is correct. | Hook implementation language changed to Node.js throughout. |
| 2 | V1 (Coherence) | Migration ordering puts hooks after state splitting AND checkpoints -- corrupted state writes during Phase 1/2 won't be caught | **Accept.** Bundle state splitting + PreToolUse hook as Phase 1. V1 correctly identifies that split state without hook validation creates an unprotected window where the enforcement gap is real, not theoretical. | Migration phases restructured: state split + hook become Phase 1. |
| 3 | V1 (Coherence) | Agent location ambiguity: ".claude/agents/ and/or plugin agents/ directory" is a design gap | **Accept.** Plugin `agents/` directory is the primary location. Project-level `.claude/agents/` overrides take precedence per the official priority ordering. The "and/or" was lazy -- a design should specify precedence. | Agent location clarified with explicit precedence. |
| 4 | V1 (Coherence) | Per-agent memory evidence assessment is inconsistent: rated WEAK but design says "enable as experiment" -- tension with evidence-only principle | **Accept.** Reframed. Agent persistent memory is now explicitly deferred from the initial design. The original proposal tried to have it both ways (WEAK evidence + active adoption), which V1 correctly identified as an internal contradiction. If adopted later, it will be under explicit experimental criteria with validation gates. | Memory deferred; experimental criteria defined for future consideration. |
| 5 | V1 (Coherence) | Missing agent registry -- Proposal 3 does not enumerate specific agents | **Accept.** Added a complete agent registry table with names, models, tool restrictions, and isolation settings. V1 is right that a design without an agent registry is harder to assess for completeness. | Full agent registry added. |
| 6 | V2 (Research) | Shell-first hook choice is weakest-evidenced for enforcement -- inconsistent with evidence lens | **Accept.** Same as V1 #1 -- both validators independently flagged this, confirming the decision was the proposal's clearest error. | Node.js adopted. |
| 7 | V2 (Research) | G2 rated as "Structural + Light Semantic" goes beyond research synthesis -- synthesis classifies G2 checks as structural | **Modify.** V2 has a point: the READINESS.md format is structured enough that most checks are deterministic. However, "readiness assessment quality" still involves judgment about whether evidence adequacy is "sufficient" -- this is not a pure field-existence check. Revised to: G2 is primarily structural with an optional lightweight semantic check on readiness assessment quality. The semantic component is minimal and can be deferred. | G2 reclassified as "Primarily Structural" with optional light semantic component deferred until observed need. |
| 8 | V2 (Research) | "Artifact validation via PreToolUse hooks" is honestly flagged as MODERATE but this is appropriate | **Defend.** V2 acknowledges the transparency. The original design correctly flagged this as an extension of the state-guard pattern without direct precedent, marked it lower priority, and proposed validating on one artifact first. This is exactly how the evidence lens should handle MODERATE-evidence features. No change needed. | No change. |
| 9 | V2 (Research) | Proposal is the most faithful to research evidence -- evidence quality map is the single most valuable artifact | **Defend.** This validates the evidence lens's core contribution. The evidence quality map and explicit strength ratings are retained and updated to reflect the revisions (shell -> Node.js changes the rating from WEAK to MODERATE). | Evidence quality map updated. |
| 10 | V1 (Coherence) | Stop hook behavior: should write session summary only, not checkpoint | **Accept.** The original design already specified Stop hook writes session-summary.yml, not checkpoint.yml. This aligns with the validator's recommendation. Skills write checkpoints at step boundaries. Confirmed, no change needed. | Confirmed existing design position. |

---

## Adopted Elements from Other Proposals

### From Proposal 1 (Developer Experience Lens)

1. **Override flow step-by-step**: Adopted P1's explicit override flow specification (user requests override -> skill writes override record to gates.yml -> PostToolUse audit hook logs it -> skill retries state transition -> hook recognizes overridden: true -> advancement allowed). The original Proposal 3 described the mechanism but did not walk through the steps. P1's specification is verifiable against implementation.

2. **Agent memory scoping (synthesizer and verifier only)**: Adopted P1's principle that IF agent persistent memory is ever enabled, it should be limited to research-synthesizer and gate-verifier -- the two agents where cross-lifecycle learning has the clearest value. Other agents remain stateless. However, unlike P1, this design defers even this scoped adoption to a future experiment with defined validation criteria (addressing V1's inconsistency concern).

3. **Developer experience scenarios as design validation**: Adopted P1's approach of describing concrete UX moments (starting a lifecycle, hitting a gate, resuming, getting blocked, overriding) as a way to make the architecture tangible. The evidence lens adds value by noting these scenarios are design imagination, not evidence-backed predictions.

4. **State split + hooks bundled as single migration phase**: Adopted P1's Phase 1 bundling. V1 correctly identified that P3's original ordering (split first, hooks third) leaves state unprotected. Bundling eliminates this gap.

### From Proposal 2 (Sustainability & Maintainability Lens)

1. **Node.js for hook implementation with reasoning**: Adopted P2's decision and reasoning wholesale. The comparison matrix (shell: fragile, TypeScript: build step, Node.js: goldilocks) is the strongest technical argument across all proposals. Single dependency (js-yaml), cross-platform, testable, no build step.

2. **Context passing guidelines (Minimal Sufficient Context)**: Adopted P2's SHOULD include / SHOULD NOT include specification for agent dispatch prompts. This prevents context bloat and reduces agent costs -- a concrete sustainability contribution that aligns with evidence about focused prompts outperforming kitchen-sink context.

3. **Schema evolution strategy**: Adopted P2's 5-step process for adding fields and 4-step process for adding files. The key property (new concerns get new files, no migration of existing data) is the strongest argument for file-per-concern sustainability.

4. **State debugging story**: Adopted P2's framing: "State is plain YAML files. Debugging is: read the file, check the checkpoint, run the validator manually, check the error log." Four commands, no special tools. This is a concrete demonstration of why file-per-concern is operationally sustainable.

5. **Cost-benefit migration table**: Adopted P2's three-axis evaluation (Maintenance Reduction, Token Savings, Risk Mitigation) per migration phase. This provides more actionable migration prioritization than evidence ratings alone.

6. **Plugin `agents/` directory as primary location**: Adopted P2's recommendation. Agents co-locate with plugin code and are distributed together. Project-level `.claude/agents/` overrides take precedence per the official priority ordering.

---

## Revised Design

### User Decisions Applied

#### Decision 1: Three-Layer Separation (Enforcement + Orchestration + Execution)
Shapes the entire architecture. The design separates hook-based enforcement (Layer 1) from thin orchestration skills (Layer 2) from thick formalized agents (Layer 3). This aligns with claude-code-harness's three-layer pattern and is the strongest evidence-backed boundary pattern.

#### Decision 2: Dual-Layer Rubric + Reasoning for Semantic Gates
Applied to G3 (Design) and G5 (Spike) gates. Structural rubric validation is code-enforced (Layer 1). Reasoning soundness is verified by a separate agent (Layer 3). The two layers are independent -- a structural pass does not imply a reasoning pass. This matches expedite's existing Phase 24 verifier concept and is supported by the academic evidence on rubber-stamp mitigation.

#### Decision 3: Incremental Hardening Migration
The migration sequence adds hooks and state splitting to existing skills incrementally. Each phase delivers standalone value. No "big bang" rewrite. This is the conservative choice and the one with the least risk of regression.

#### Decision 4: Worktree Isolation for Execute Only
`isolation: "worktree"` added to execute agents. All other skills write to `.expedite/` directories only, where worktree isolation is unnecessary. This is the minimum adoption scoped by the evidence.

#### Constraints Honored
- C1 (Claude Code plugin API): All mechanisms use hooks, subagent frontmatter, skills, and Task() -- no external tooling required.
- C2 (Full rebuild acceptable): Incremental preferred (Decision 3) but the design does not depend on preserving any current file.
- C3 (Personal/team tool): Configuration complexity is acceptable. Hook scripts, agent definitions, and state files are power-user surfaces.
- C4 (SessionStart deferred): Design uses ECC's "root fallback" pattern. SessionStart hooks are designed but have fallback paths. No feature depends solely on SessionStart.
- C5 (Pipeline is fixed): The scope-research-design-plan-spike-execute lifecycle is unchanged. The design hardens how the pipeline executes, not what it does.

---

### Three-Layer Architecture

#### What the Research Says

The three-layer pattern (enforcement / orchestration / execution) is most clearly demonstrated by claude-code-harness [STRONG: primary source], where:
- **Layer 1 (Enforcement)**: TypeScript guardrail engine with 9 compiled rules (R01-R09), invoked via hooks. Deterministic, testable, no LLM judgment for structural checks.
- **Layer 2 (Orchestration)**: 5 thin verb skills (plan, execute, review, release, setup) that sequence work and interact with the user.
- **Layer 3 (Execution)**: 3 typed agents (worker, reviewer, scaffolder) with substantial logic.

ECC demonstrates a variant: enforcement via Node.js hook scripts, orchestration via 65+ skills, execution via 12 typed agents [MODERATE: one source with production maturity (72K+ stars, 997 tests)].

claude-agentic-framework demonstrates per-worker quality gates as enforcement, swarm commands as orchestration, and 8 typed workers as execution [MODERATE: one source].

No repo demonstrates a controlled comparison between two-layer and three-layer architectures. The evidence that three-layer is better is observational: claude-code-harness produces testable enforcement logic, and expedite's current merged approach (enforcement + orchestration in 500-860 line skills) has reached practical limits. Evidence strength for the superiority claim: MODERATE (observational, not experimental).

#### Design

**Layer 1: Enforcement (hooks + scripts)**
- Location: `hooks/hooks.json` for hook registration, `hooks/scripts/` for Node.js hook implementations. *[Revised: shell -> Node.js, per validator feedback on both V1 and V2]*
- Responsibilities: State write validation (schema, FSM transitions, gate passage), structural gate evaluation (G1, G2, G4), audit trail logging, override tracking.
- Handler types: Command hooks for all enforcement (fast, deterministic). Agent hooks only for semantic gate verification (G3, G5) as a future enhancement.
- Principle: Every enforcement check is a Node.js script that can be run and tested independently of Claude Code.

**Layer 2: Orchestration (thin skills)**
- Location: `skills/{skill}/SKILL.md` (target: 100-200 lines each, down from 500-860).
- Responsibilities: Step sequencing, user interaction, agent dispatch, context assembly. Skills describe WHAT to do at each step and delegate HOW to agents.
- Skills do not evaluate quality (that is Layer 1's job) and do not contain substantial generation logic (that is Layer 3's job).

**Layer 3: Execution (thick agents)**
- Location: Plugin `agents/` directory (primary). Project-level `.claude/agents/` overrides take precedence per the official priority ordering. *[Revised: eliminated "and/or" ambiguity, per V1 feedback]*
- Responsibilities: Artifact generation, research execution, code implementation. Agents receive assembled context, produce artifacts, and return summaries.
- Agents use the full official subagent frontmatter schema (name, description, tools, disallowedTools, model, maxTurns, memory, isolation, hooks).

#### Evidence Gaps
- No evidence on the optimal skill line count for "thin." The 100-200 line target is extrapolated from claude-code-harness's verb skills, which are shorter, but those skills orchestrate fewer steps. Evidence strength for the line-count target: WEAK (extrapolation from one source).
- Hook implementation language evidence is MODERATE: ECC uses Node.js, claude-code-harness uses TypeScript. Both favor a JavaScript runtime over shell. *[Revised: evidence rating upgraded from WEAK to MODERATE now that the design aligns with the evidence]*

---

### Hook Architecture

#### Hooks with Proven Enforcement Patterns

##### PreToolUse on Write (State Machine Guard)
**Evidence: STRONG** (claude-code-harness TypeScript engine [R01-R09], ECC PreToolUse validation, documented pattern in hooks reference with exit code 2 semantics)

This is the single highest-value hook adoption. A command hook matching `Write` intercepts all file writes, filters by path (`.expedite/state.yml` and other state files), parses the proposed content, and validates:
1. **Schema conformance**: Required fields present, types correct.
2. **FSM transition validity**: Phase transitions are forward-only through the valid sequence (scope_in_progress -> scope_complete -> research_in_progress -> ... -> execute_complete).
3. **Gate passage requirement**: Advancing to a `_complete` phase requires a corresponding gate result with `outcome: "go"` or `outcome: "go-with-advisory"` or `overridden: true` in gates.yml.
4. **Step tracking consistency**: `current_step` cannot decrease within a phase.

Exit code 2 blocks the write. `permissionDecisionReason` explains why -- with specific, actionable detail (e.g., "Cannot advance to research_in_progress: G1 gate has not passed. SCOPE.md has 2 decision areas, minimum is 3."). The skill then sees the denial and can report to the user or request an override.

*[Revised: Added detail on actionable denial messages, adopted from P1's DX scenarios]*

##### PreToolUse on Write (gates.yml Validation) *[Revised: new section addressing Critical Issue 3 from V1]*
**Evidence: MODERATE** (extension of state-guard pattern; addresses fabrication bypass identified by V1)

A second PreToolUse matcher validates writes to `.expedite/gates.yml`. This closes the gate fabrication bypass that V1 identified as Critical Issue 3: without validation on gates.yml writes, an agent could write a fabricated gate result and then advance the phase through the state.yml hook, which would accept the fake result.

The gates.yml validation hook checks:
1. Gate result has expected structure (gate ID, outcome, timestamp, evaluator)
2. The gate ID matches the current phase (cannot write a G3 result during scope phase)
3. Outcome is one of the valid values (go, no-go, go-with-advisory, overridden)
4. Override records include override_reason and severity fields

This ensures gate results can only be written with valid structure during the appropriate phase. Combined with agent tool restrictions (research agents cannot Write to `.expedite/gates.yml`), this makes gate fabrication structurally difficult.

##### PreToolUse on Write (Artifact Validation)
**Evidence: MODERATE** (claude-code-harness PostToolUse for change tracking, claude-agentic-framework per-worker quality gates)

A third PreToolUse matcher on `Write` for artifact paths (`.expedite/scope/SCOPE.md`, `.expedite/research/SYNTHESIS.md`, etc.) can validate structural requirements before the file is written. This catches obviously incomplete artifacts at creation time rather than at gate time. However, PreToolUse for artifact validation is less clearly evidenced than for state writes -- the harness repos validate state transitions, not artifact content, at the hook level. Evidence is MODERATE because the pattern is a reasonable extension of the state-guard pattern, but no surveyed repo does exactly this.

Design choice: Include artifact structural validation hooks but mark them as lower priority in the migration sequence. Validate the pattern on one artifact (SCOPE.md) before generalizing.

##### PostToolUse on Write (Audit Trail)
**Evidence: MODERATE** (ECC PostToolUse for continuous learning/logging, claude-code-harness PostToolUse for change tracking)

A non-blocking PostToolUse hook logs every state write to an append-only audit log. This creates traceability for state changes and override events. The hook parses the completed write and appends a line to `.expedite/audit.log` with timestamp, file changed, phase before/after, and actor (skill or agent).

##### Stop Hook (Session Summary)
**Evidence: MODERATE** (ECC Stop hook for session state persistence, claude-code-harness Stop hook for session summaries)

A Stop hook writes a session summary to `.expedite/session-summary.md` containing:
- Current phase and step when session ended
- What was accomplished in this session
- What should happen next (derived from checkpoint state)

This creates the "handoff document" pattern from ECC, providing context for the next session. The Stop hook is non-blocking and uses a command handler.

The Stop hook does NOT write checkpoint.yml. Skills write checkpoints at step boundaries (in-skill, during orchestration). The Stop hook lacks conversational context to determine the current step accurately -- it reads state from disk and generates a narrative summary, which is the appropriate scope for a session-end hook. *[Revised: explicit clarification that Stop hook does not write checkpoints, per V1's Critical Issue 1]*

##### SessionStart Hook (Context Loading) -- WITH FALLBACK
**Evidence: MODERATE** (ECC SessionStart with root fallback, claude-code-harness SessionStart for environment checks)

A SessionStart hook loads the previous session summary and current checkpoint state. Because of platform bugs (#16538, #13650, #11509), the design does not depend on SessionStart working. Fallback: skills load checkpoint state via frontmatter injection (`!cat .expedite/checkpoint.yml`). If SessionStart is functional, it provides richer context loading (selective, transformable). If not, frontmatter injection provides the minimum viable context.

Design choice: Implement SessionStart but design every skill's frontmatter to be self-sufficient without it. This is ECC's "root fallback" pattern. The SessionStart hook is deferred to the final migration phase so the system works without it throughout development.

##### PreCompact Hook (State Preservation)
**Evidence: MODERATE** (ECC pre-compact.js for strategic compaction management)

A PreCompact hook saves critical state before context compaction. Since compaction discards conversational context, the hook ensures the current step, phase, and next-action are written to the session summary before compaction occurs. This prevents the "lost context after compaction" failure mode.

#### Hook Implementation Language *[Revised: complete rewrite]*

**Decision: Node.js for all hook scripts.**

**Evidence: MODERATE** (ECC uses Node.js hook scripts; claude-code-harness uses TypeScript which requires Node.js runtime)

Both validators independently identified shell scripts as the weakest technical decision in the original proposal. The evidence lens demands internal consistency: rating hook language evidence as WEAK and then choosing the weakest-evidenced option was a contradiction.

Node.js is adopted because:
1. **YAML parsing reliability**: `js-yaml` is a mature, well-tested library. Shell `yq` is adequate but fragile for edge cases (multi-line strings, special characters, complex nested structures). The enforcement layer must be reliable.
2. **Cross-platform compatibility**: Node.js runs identically on macOS, Linux, and Windows. Shell scripts have platform-specific behavior.
3. **Testability**: Node.js hook scripts can be tested with Jest/Vitest, with structured input/output assertions. Shell scripts require test harnesses that are themselves fragile.
4. **No build step**: Unlike TypeScript (used by claude-code-harness), Node.js scripts run directly. For a solo developer, the build step is pure overhead.
5. **Single dependency**: `js-yaml` is the only external dependency. Install once, use across all hook scripts.

The solo-developer simplicity argument from the original proposal (favoring shell) was incorrect. Shell is simpler for trivial scripts but harder for YAML parsing and JSON processing -- exactly the operations enforcement hooks must perform.

#### Hooks That Are Deferred

| Hook | Evidence | Reason for Deferral |
|------|----------|-------------------|
| SubagentStop (Agent Output Validation) | WEAK for this use | No repo demonstrates this pattern. Skill-level verification after agent return is simpler. Future enhancement. |
| UserPromptSubmit (Input Validation) | WEAK for lifecycle enforcement | No harness repo uses it for lifecycle orchestration. |
| PermissionRequest (Auto-Approval) | MODERATE | Introduces safety risk. Permission fatigue is not yet a demonstrated problem. |

#### Known Anti-Patterns from Research

1. **Over-blocking** (ECC documentation): Hooks that fire too frequently or are too strict create frustrating UX. Mitigation: Start with the minimum set and expand based on experience. ECC's runtime profiles (`minimal|standard|strict`) are a proven mitigation but add complexity -- defer until needed.
   Evidence: MODERATE (1 source with 72K+ stars production usage)

2. **Latency compounding** (hooks reference, qualitative): Command hooks add ~100-200ms per invocation (Node.js startup + YAML parsing). For Write operations to state files (relatively infrequent -- 5-15 times per skill run), this is acceptable. Design mitigates by scoping hooks to specific paths.
   Evidence: WEAK (qualitative only, no benchmarks) *[Revised: latency estimate updated for Node.js startup]*

3. **No inter-hook communication** (hooks reference): Each hook invocation is independent. The state-guard hook cannot communicate with the audit-trail hook. Design accepts this constraint -- each hook reads state from disk independently.
   Evidence: STRONG (official documentation)

---

### State Management Architecture

#### Patterns with Convergent Evidence (3+ Sources)

##### Directory-Based State (File-Per-Concern)
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

##### YAML Format Retained
**Evidence: MODERATE** (research finding that LLMs handle YAML and JSON comparably; the differentiator is injection strategy, not format)

YAML is retained because: (1) expedite already uses YAML throughout, (2) the LLM reliability research shows no advantage to switching formats, and (3) migration cost offers no evidence-supported payoff. The key improvement is splitting, not reformatting.

#### Schema Validation on Write
**Evidence: MODERATE** (CrewAI Pydantic validation -- "invalid state never gets persisted"; claude-code-harness JSON schema validation at load time)

Two sources demonstrate write-time schema validation but using different mechanisms (Pydantic models vs. JSON Schema). For expedite, the PreToolUse hook on state writes performs the equivalent function: validating state content before it reaches disk. This is a reasonable adaptation of the pattern to Claude Code's hook architecture.

#### Schema Evolution Strategy *[Revised: adopted from P2]*

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

#### State Debugging *[Revised: adopted from P2]*

State is plain YAML files in `.expedite/`. Debugging is:
1. Read the file directly (`cat .expedite/state.yml`)
2. Check the checkpoint (`cat .expedite/checkpoint.yml`)
3. Validate manually (`node hooks/scripts/validate-state-write.js < test-input.json`)
4. Check hook errors (`cat .expedite/hook-errors.log`)

No database to query, no event log to replay, no checkpoint store to inspect. Four commands, no special tools.

#### Append-Only Audit Log
**Evidence: MODERATE** (LangGraph append-only checkpoints, expedite's own log.yml, ECC PostToolUse logging)

The append-only pattern for audit data is well-supported. The design uses it for the audit trail (`.expedite/audit.log`) but not for primary state (state.yml remains a rewrite target). This hybrid approach -- rewrite for active state, append for history -- is supported by LangGraph's architecture where checkpoints are append-only but the active state is mutable.

#### Evidence Gaps in State Design

1. **Cross-file consistency**: No source directly addresses what happens when skill A writes to `questions.yml` while skill B reads `state.yml` and the two files are temporarily inconsistent. Expedite's pipeline architecture (sequential phases) mitigates this -- only one skill is active at a time. Risk: LOW for expedite's current architecture.

2. **Backup-before-write atomicity**: No source confirms whether Claude Code's Write tool is atomic. The current backup-before-write protocol (which the design retains as defense-in-depth alongside hook validation) addresses this regardless. Evidence for Write atomicity: NONE.

---

### Agent Formalization

#### What the Official Schema Supports

**Evidence: STRONG** (official Claude Code subagent documentation, confirmed by 5 repo implementations)

The official subagent frontmatter schema provides 12+ fields. For expedite's agents, the immediately relevant fields are:

| Field | Value for Expedite | Evidence |
|-------|-------------------|----------|
| `name` | Required. Lowercase, hyphenated (e.g., `web-researcher`, `gate-verifier`) | Official docs |
| `description` | Required. When Claude should delegate -- critical for dispatch clarity | Official docs |
| `tools` | Allowlist per agent for tightly restricted agents | Official docs + 5 repos |
| `disallowedTools` | Denylist for broad-access agents minus dangerous tools | Official docs |
| `model` | Per-agent model assignment: Haiku for exploration, Sonnet for standard work, Opus for architecture/verification | Official docs + 4 repos (model tiering convergent pattern) |
| `maxTurns` | Prevent runaway agents. Set based on expected task complexity. | Official docs |
| `isolation` | `worktree` for execute agents only (User Decision 4) | Official docs + 2 repos |

#### Tool Restriction Strategy *[Revised: adopted guidance from P2]*

Use `disallowedTools` (denylist) when an agent should have broad access minus a few dangerous tools. Use `tools` (allowlist) only when an agent should be tightly restricted to a small set. Rationale: if Claude Code adds a new tool, an allowlisted agent does not get it because the list is explicit. Denylists are more maintainable for agents that need many tools.

#### Agent Registry *[Revised: new section addressing V1's completeness concern]*

| Agent | Model | Key Tool Restrictions | Isolation | Purpose |
|-------|-------|----------------------|-----------|---------|
| `web-researcher` | Sonnet | disallowedTools: [Bash, Edit] | None | Web research per question |
| `codebase-researcher` | Sonnet | disallowedTools: [Write, Edit, WebSearch] | None | Codebase analysis per question |
| `research-synthesizer` | Opus | disallowedTools: [Bash, WebSearch] | None | Synthesizes evidence across questions |
| `design-architect` | Opus | disallowedTools: [Bash, WebSearch] | None | Produces design documents |
| `plan-decomposer` | Sonnet | disallowedTools: [Bash, WebSearch] | None | Breaks design into phases |
| `spike-researcher` | Sonnet | disallowedTools: [Bash] | None | Resolves tactical decisions |
| `task-implementer` | Sonnet | Full tool access | Worktree | Implements code changes |
| `gate-verifier` | Opus | tools: [Read, Glob, Grep] | None | Semantic quality evaluation (read-only) |

**8 agents total.** This is fewer than P1 (11 agents, including scope-facilitator, research-planner, and sufficiency-evaluator that V1 questioned) and appropriately scoped:
- `scope-facilitator` is omitted because the scope skill already handles the conversation directly -- it does not need an agent to facilitate.
- `research-planner` is omitted because research question generation is embedded in the scope skill's step logic.
- `sufficiency-evaluator` is omitted because structural checks are code-enforced scripts, not LLM-based evaluation (adopting V1's recommendation).

#### Model Tiering Strategy

| Tier | Model | Agent Types | Rationale |
|------|-------|-------------|-----------|
| Premium | Opus | research-synthesizer, design-architect, gate-verifier | Tasks requiring deep reasoning, cross-referencing, and quality judgment |
| Balanced | Sonnet | web-researcher, codebase-researcher, plan-decomposer, spike-researcher, task-implementer | Tasks requiring competent execution within clear parameters |
| Fast | Haiku | (Reserved for future: quick lookups, file existence checks) | Not currently used; available for future optimization |

**Evidence: STRONG** (4 independent implementations of model tiering across surveyed repos)

#### Agent Location *[Revised: eliminated ambiguity]*

Agents live in the plugin's `agents/` directory as the primary location. This keeps agents co-located with plugin code and distributed together. Project-level overrides in `.claude/agents/` take precedence per the official priority ordering (CLI flag > project `.claude/agents/` > user `~/.claude/agents/` > plugin `agents/`).

#### Agent Persistent Memory *[Revised: deferred, per V1 inconsistency feedback]*

**Evidence: WEAK** (official docs only, no repo demonstrates for pipeline architecture)

The original proposal enabled memory for research agents "as an experiment" while rating the evidence as WEAK. V1 correctly identified this as internally inconsistent with the evidence lens. Revised position:

**Agent persistent memory is deferred from the initial design.** No agents get `memory` in their frontmatter initially.

**Future experiment criteria** (all must be met before enabling):
1. At least 3 complete lifecycles have been run with the harness
2. A specific, documented pattern of "rediscovering the same information" is observed
3. Memory is enabled for synthesizer and verifier agents only (highest-value candidates, per P1's reasoning)
4. The experiment runs for 3 additional lifecycles with memory enabled vs. 3 without, comparing synthesis/evaluation quality

This is the evidence-honest approach: the evidence is WEAK, so defer adoption until expedite-specific evidence exists.

#### Where Evidence Is Weak

- **Per-agent hooks**: The official schema supports hooks scoped to a subagent, but no surveyed repo demonstrates this pattern for quality validation. Evidence: WEAK (documented but undemonstrated).
- **Agent-level `skills` field**: Subagents can preload skills, but the interaction between a subagent's skills and the parent skill's context is not well-documented. Evidence: WEAK. Design choice: do not use the skills field initially.

---

### Quality Gate Enforcement

#### Structural vs. Semantic Classification

**Evidence: STRONG** (claude-code-harness rule engine for structural rules [R01-R09], academic rubber-stamp research [arXiv 2411.15594], 6-pattern validation taxonomy from research)

The most actionable research finding: split gates by what they check.

| Gate | Type | What It Checks | Enforcement |
|------|------|----------------|-------------|
| G1 (Scope) | Structural | SCOPE.md exists, has required sections, 3+ DAs, research categories assigned | Code-enforced (Node.js script) |
| G2 (Research) | Primarily Structural | All categories have findings, synthesis exists, readiness criteria met | Code-enforced for structure; optional light semantic check deferred *[Revised: reclassified per V2 feedback]* |
| G3 (Design) | Semantic | Design decisions are evidence-backed, internally consistent, complete | Dual-layer: structural rubric (code) + reasoning verifier (agent) |
| G4 (Plan) | Structural | Phase breakdown exists, each phase has tasks, dependency ordering valid | Code-enforced (Node.js script) |
| G5 (Spike) | Semantic | Decision quality, implementation steps are actionable, risks identified | Dual-layer: structural rubric (code) + reasoning verifier (agent) |

*[Revised: G2 reclassified from "Structural + Light Semantic" to "Primarily Structural." V2 pointed out that the READINESS.md format is sufficiently structured to be checkable deterministically (status fields, requirement coverage counts). The readiness assessment quality component involves some judgment, but this can likely be checked structurally by validating that each DA has a status field, that status values are from a defined set, and that "SUFFICIENT" status DAs have at least N evidence references. If observed need for semantic judgment on G2 arises, a light semantic check can be added later.]*

#### Anti-Rubber-Stamp Evidence Per Mechanism

##### Deterministic Code (Structural Gates)
**Evidence: STRONG** (claude-code-harness 9-rule TypeScript engine; the academic finding that "the most reliable gates are the ones that don't involve LLM judgment at all")

For G1, G2, and G4, the checks are fully deterministic: *[Revised: G2 now included in fully deterministic]*
- Does the file exist?
- Does it contain required section headers?
- Are there at least N items in a list?
- Is every required field non-empty?
- Does each DA have a status value from the valid set?

These produce identical results every time. No rubber-stamp risk. No LLM involved.

##### Dual-Layer Rubric + Reasoning (Semantic Gates)
**Evidence: MODERATE** (the pattern is independently described in the research taxonomy and matches expedite's Phase 24 design; however, no surveyed repo implements exactly this dual-layer pattern for gate enforcement)

For G3 and G5:
- **Layer 1 (Structural rubric)**: Code-enforced. Check that the design document has a decision for every DA, that each decision cites evidence, that the document has required sections. This is the "did you check all boxes?" layer.
- **Layer 2 (Reasoning verifier)**: A separate verifier agent (distinct from the producing agent, using Opus model tier) reads the artifact and evaluates reasoning soundness. This is the "are your conclusions actually supported by your evidence?" layer.

The two layers run independently. Both must pass. The structural layer runs first (fast, free). If structural fails, the semantic layer does not run. If structural passes, the semantic layer provides the deeper evaluation.

**Anti-rubber-stamp mechanisms for the reasoning verifier**:
1. **Separate agent**: The verifier is a distinct subagent, not the producing agent evaluating its own output. This reduces self-preference bias. Evidence: MODERATE (arXiv survey confirms cross-model evaluation catches errors same-model misses).
2. **Read-only tools**: The verifier has `tools: [Read, Glob, Grep]` -- it cannot fix what it evaluates, preventing "evaluate then auto-fix" shortcuts.
3. **Structured output format**: The verifier returns a structured assessment (pass/fail per criterion with specific evidence citations), not a free-form "looks good." Evidence: MODERATE (LLM-as-judge best practices recommend structured output).
4. **Explicit failure criteria**: The verifier prompt defines what failure looks like (unsupported claims, logical contradictions, missing coverage) rather than what success looks like. This counteracts the leniency bias. Evidence: WEAK (extrapolated from bias research, not directly demonstrated).

#### Gate-State Integration

**Evidence: STRONG** (PreToolUse-as-state-transition-guard pattern documented in research with code examples)

The PreToolUse hook on state writes enforces gate passage as a precondition for phase advancement:

1. Hook intercepts Write to `state.yml`
2. Parses proposed content for phase field
3. If phase is advancing to a `_complete` state, reads `gates.yml`
4. Verifies a gate result exists with `outcome: "go"` or `outcome: "go-with-advisory"` or `overridden: true` for the corresponding gate
5. If no passing gate result exists, blocks the write (exit code 2) with reason: "Gate GN has not passed. Complete gate evaluation before advancing phase."

This makes gate bypass structurally impossible unless the user explicitly overrides (which is auditable via the PostToolUse audit hook).

#### gates.yml Integrity *[Revised: new section addressing V1's Critical Issue 3]*

The PreToolUse hook on gates.yml writes (described in Hook Architecture above) ensures gate results cannot be fabricated. Combined with agent-level tool restrictions (gate-verifier is the only agent type that should produce gate evaluations, and it has read-only tools), this creates defense in depth against the fabrication bypass V1 identified.

The defense layers are:
1. **Structural**: gates.yml validation hook checks that results have valid structure and match the current phase
2. **Access control**: Agent tool restrictions prevent non-gate agents from writing to `.expedite/gates.yml`
3. **Audit**: PostToolUse hook logs all gates.yml writes to the audit trail

#### Override Flow *[Revised: adopted P1's step-by-step specification]*

1. Developer tells the skill: "Override G1, the scope is sufficient for an exploratory spike"
2. Skill writes to gates.yml: `{gate: G1, outcome: overridden, override_reason: "...", severity: low}`
3. gates.yml PreToolUse hook validates the override record structure (reason and severity present)
4. PostToolUse audit hook logs the override to audit.log
5. Skill retries the state transition -- PreToolUse hook on state.yml sees `overridden: true` and allows the write
6. Developer sees confirmation: "G1 overridden. Override logged. Advancing to research phase."

The override is auditable, traceable, and requires explicit developer intent. It is not a backdoor -- it is a documented escape hatch. This interaction between overrides and code-enforced gates is a design invention not demonstrated by any source -- it needs validation during implementation.

#### Evidence-Supported vs. Speculative Gate Designs

| Design Element | Evidence Level | Source(s) |
|----------------|---------------|-----------|
| Code-enforced structural gates | STRONG | claude-code-harness (9 rules), academic rubber-stamp evidence |
| PreToolUse as state transition guard | STRONG | 3 harness implementations, official docs |
| Separate verifier agent for semantic gates | MODERATE | arXiv survey on cross-model evaluation, expedite Phase 24 concept |
| Structured output for verifier | MODERATE | LLM-as-judge best practices (evidentlyai, Arize) |
| Gate results in gates.yml | MODERATE | Pattern documented in research, reasonable extension of checkpoint concept |
| Override audit via PostToolUse | MODERATE | ECC PostToolUse for logging, reasonable extension |
| gates.yml write validation hook | MODERATE | Extension of state-guard pattern, addresses identified fabrication bypass *[Revised: new entry]* |
| Override + code-enforced gate interaction | SPECULATIVE | No source demonstrates; design invention *[Revised: reclassified from MODERATE to SPECULATIVE for honesty]* |
| SubagentStop for automatic semantic verification | SPECULATIVE | Mechanism confirmed available in plugins, but no repo demonstrates this pattern |
| Multi-agent debate for gate evaluation | NOT ADOPTED | Evidence exists but overkill for personal tool (User Decision 2) |

---

### Resume & Recovery Architecture

#### Proven Resume Patterns

##### Checkpoint-Per-Skill (Generalized from Execute)
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

**Only skills write checkpoint.yml.** This maintains the three-layer separation (agents execute, skills orchestrate state). If agents write checkpoints, they take on orchestration responsibility, blurring the layer boundary. A misbehaving agent could write an incorrect checkpoint that causes the skill to skip steps on resume. *[Revised: explicit statement adopted from V1's Critical Issue 1 resolution]*

#### Evidence Strength for Checkpoint Granularity

**Evidence: STRONG** (LangGraph: per-graph-node, equivalent to per-step; ECC: per-session; expedite execute: per-task)

Design choice: **Step-level checkpointing** (not sub-step, not phase-level). Each skill has a defined sequence of steps. The checkpoint updates at each step transition. This is coarser than LangGraph (which checkpoints sub-steps) but finer than ECC (which checkpoints sessions).

Why step-level and not sub-step-level: Expedite's steps are themselves the atomic unit of orchestration. Within a step, the agent is doing work that may involve multiple tool calls but constitutes a single logical action. Checkpointing within a step would require the agent to checkpoint its own state, which the research does not demonstrate in any Claude Code plugin.

Why step-level and not phase-level: Phase-level checkpointing is expedite's current approach (track phase, not step). The research explicitly identifies this as the problem: "current_step is tracked but not used for resume."

#### Idempotency Strategy

**Evidence: MODERATE** (LangGraph checkpoint-as-idempotency-key, ECC content hashing, file-existence checks as fallback)

The checkpoint provides idempotency:
1. Before executing step N, check if `current_step >= N` in the checkpoint
2. If yes, the step has already completed -- skip it
3. If no, execute the step, then update the checkpoint to N
4. The `inputs_hash` field provides additional safety: if the inputs to step N have changed since the checkpoint was written (e.g., upstream artifacts were modified), re-execute even if the checkpoint says "done"

File-existence checking (expedite's current approach) is retained as a secondary verification. If the checkpoint says step 7 is complete but the expected artifact from step 7 does not exist, enter recovery mode. This catches the case where a checkpoint was written but the artifact write failed.

#### Resume Protocol

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

#### Session Summary vs. Checkpoint Distinction

The checkpoint is machine-readable state for deterministic resume. The session summary is LLM-readable narrative context for orientation. Both are needed:
- **Checkpoint** tells the system WHERE to resume (step number, skill name, substep state)
- **Session summary** tells the LLM WHY and WHAT the situation is (what happened, what was accomplished, what to do next)

This dual mechanism is not demonstrated by any single source but is a logical synthesis of complementary patterns (LangGraph for checkpoint, ECC for session summary).

#### Gaps in Resume Evidence

1. **Mid-step crash recovery**: If a crash occurs between step execution and checkpoint write, the step ran but the checkpoint does not reflect it. The secondary artifact-existence check mitigates this for steps that produce artifacts. For steps that do not produce artifacts (e.g., "ask the user a question"), the step may be re-executed. This is acceptable -- re-asking a question is safe. Evidence for more sophisticated recovery: NONE in Claude Code plugin context.

2. **Checkpoint write atomicity**: If the checkpoint write itself fails (partial write), resume state is corrupted. The backup-before-write protocol (write to temp file, rename) provides defense. Evidence for Write tool atomicity: NONE (flagged as knowledge gap in research).

3. **Agent-level checkpointing**: If a subagent is dispatched at step 7 and the session crashes while the subagent is running, the subagent's partial work may exist on disk but the orchestrator does not know about it. The `continuation_notes` field in the checkpoint can record "agent dispatched, awaiting result" but cannot record the agent's internal progress. No surveyed repo addresses this. Evidence: NONE. Design accepts this limitation -- the user may need to re-run the agent.

---

### Context & Memory Strategy

#### Evidence-Supported Context Patterns

##### Scoped Injection via State Splitting
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

**Token savings estimate**: 60-80% reduction in state injection tokens per skill invocation (from 500-2,000+ tokens growing with lifecycle to 100-400 tokens fixed per skill). *[Revised: adopted P2's concrete numbers]*

##### Context Passing for Agent Dispatch *[Revised: adopted from P2]*

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

Why minimal context matters: Every token in the dispatch prompt is billed at the agent's model tier rate. More importantly, excessive context can confuse the agent -- focused prompts outperform kitchen-sink context.

##### Session Summary Handoff
**Evidence: MODERATE** (ECC Stop/SessionStart hooks for session continuity)

The Stop hook writes a session summary. The SessionStart hook (with fallback) loads it. This creates a handoff document between sessions.

##### PreCompact State Preservation
**Evidence: MODERATE** (ECC pre-compact.js)

Before context compaction, a PreCompact hook ensures the session summary is up to date. This prevents the failure mode where compaction discards conversational context that has not been persisted to disk.

#### What Is Proven vs. Theoretical

| Pattern | Evidence Level | Status |
|---------|---------------|--------|
| Scoped injection (load only relevant files) | STRONG | Adopt in initial migration |
| Session summary handoff (Stop/SessionStart) | MODERATE | Adopt, with SessionStart fallback |
| PreCompact state preservation | MODERATE | Adopt (single source but clear value) |
| Progressive disclosure (metadata/instructions/resources tiers) | MODERATE | Not needed for expedite (skills are invoked explicitly, not context-activated) |
| Per-agent persistent memory | WEAK | Deferred *[Revised: changed from "Experiment" to "Deferred"]* |
| Strategic compaction management (suggest-compact, autocompact threshold) | MODERATE | Defer (adds complexity, expedite sessions are shorter than ECC target) |
| Continuous learning / instincts | NOT ADOPTED | Designed for general-purpose harness, not decision-support workflow |

---

### Worktree Isolation

#### Evidence from Real Implementations

**Evidence: ADEQUATE** (ccswarm: per-agent worktrees as core architecture; claude_code_agent_farm: 20+ parallel sessions with worktree isolation; official docs: `isolation: "worktree"` subagent field)

Two repos demonstrate worktree isolation in production. The official subagent schema makes adoption a single frontmatter field. The execute skill is the only expedite skill that modifies source code -- all other skills write to `.expedite/` directories where worktree isolation is unnecessary.

#### Design

Execute agents get `isolation: "worktree"` in their subagent frontmatter. When an execute agent completes, if changes were made, the worktree path and branch are returned. The user manually reviews and merges. If no changes were made (e.g., agent failed), the worktree is automatically cleaned up.

No other skill gets worktree isolation. Research agents write to `.expedite/evidence/`, spike agents write to `.expedite/plan/phases/`, and design/scope/plan agents write to `.expedite/` artifacts. None of these touch source code.

Add `EnterWorktree` to `disallowedTools` for all non-execute agents to prevent accidental worktree creation -- a specific failure mode identified in the research.

#### Known Failure Modes (with Sources)

| Failure Mode | Source | Mitigation |
|-------------|--------|------------|
| Merge conflicts | ccswarm docs, Agent Teams docs | Assign non-overlapping file responsibilities in agent prompts |
| Orphaned worktrees from crashes | Worktree guide (Verdent) | WorktreeRemove hook for cleanup; periodic `git worktree prune` |
| Multiple agents editing same files | Agent Teams docs | Execute skill dispatches one agent at a time per task (sequential, not parallel) |
| Unwanted worktree creation | Known Claude Code bug | Add EnterWorktree to disallowedTools for non-execute agents |

---

### Skill-Agent Interaction

#### Evidence-Supported Boundary Patterns

**Evidence: MODERATE** (4 boundary patterns observed across repos, directional evidence favoring thin-skill/thick-agent with external enforcement)

The research documents 4 patterns:
1. Thick skill / thin agent (expedite current) -- skills at practical limits (860 lines)
2. Thin skill / thick agent (claude-code-harness) -- enforcement separate, skills are dispatchers
3. Plugin-per-concern (wshobson) -- many small components
4. Persona + swarm (agentic-framework) -- flexible single/multi-agent switching

#### Design

Skills become step-sequencing dispatchers:
1. Read checkpoint to determine current step
2. For each step, assemble context (relevant state files, upstream artifacts)
3. Dispatch the appropriate agent with assembled context (following minimal sufficient context guidelines)
4. Record step completion to checkpoint
5. Interact with user when needed (questions, gate results, override requests)

Agents become the workers:
1. Receive assembled context (not raw state files)
2. Produce artifacts
3. Return structured summaries
4. Do not manage state (that is the skill's job via checkpoint updates)
5. Do not write to state files or checkpoint files (enforcement hook would block this for state files; convention and tool restrictions prevent it for checkpoints)

The skill does not evaluate quality (that is the hook layer's job). The agent does not manage phase transitions (that is the skill + hook layer's job together). This produces clean separation at the cost of more files (agent definitions, hook scripts) and more indirection (skill -> agent -> artifact -> hook validation).

#### Cost-Aware Dispatch *[Revised: adopted from P2]*

Before dispatching an agent, the skill should consider:
1. **Can this be done without an agent?** Simple file reads, YAML manipulation, and counting can be done by the skill itself.
2. **Does this need Opus?** Default to Sonnet. Only use Opus for synthesis, architecture, and gate evaluation.
3. **Can agents run in parallel?** If multiple independent research agents are needed, dispatch them as background tasks and collect results.

---

### Developer Experience Moments *[Revised: new section adopted from P1]*

These scenarios are design imagination, not evidence-backed predictions. They serve to make the architecture tangible and verifiable against implementation. Evidence lens note: none of these scenarios are validated by research -- they describe intended behavior, not proven behavior.

#### Starting a New Lifecycle

The developer runs `/expedite:scope`. The skill checks state.yml -- no active lifecycle. It initializes state.yml, checkpoint.yml, and begins the scope conversation. The developer sees: "Starting new expedite lifecycle. Project name?" The harness is invisible.

#### Hitting a Structural Gate

The scope skill completes and tries to advance to `scope_complete`. The PreToolUse hook fires, runs the G1 structural check:

**If G1 passes**: State advances. Developer sees: "Scope phase complete. G1 gate passed: 12 questions across all decision areas. Ready for /expedite:research."

**If G1 fails**: Write is blocked. Developer sees: "G1 structural check failed: questions.yml has 2 questions (minimum 3), DA-4 has no questions. Add questions for DA-4 to pass G1." Specific, actionable, no ambiguity.

#### Resuming After Context Reset

The developer returns after a break. The skill reads checkpoint.yml via frontmatter injection (SessionStart provides additional context if functional): "Resuming research from step 7: Dispatch web researchers. 3 of 5 dispatched. Next: dispatch DA-4 and DA-6 researchers."

The developer did not have to explain where they were. The system knew.

#### Getting Blocked by a Hook

An agent tries to write an invalid state transition (skipping research). The PreToolUse hook blocks the write. The developer sees: "Invalid phase transition: scope_in_progress cannot transition to design_in_progress. Valid transitions: scope_complete (requires G1 gate passage)."

The developer understands what happened, why, what the valid options are, and what to do next.

#### Overriding a Gate

Developer: "Override G1, the scope is sufficient for an exploratory spike."

The skill writes the override record to gates.yml, the audit hook logs it, and the state transition proceeds. Developer sees: "G1 overridden. Override logged. Advancing to research phase." Nothing is silent or hidden.

---

### Migration Sequence *[Revised: restructured per V1 feedback on bundling]*

#### Evidence-Supported Migration Patterns

**Evidence: MODERATE** (no surveyed repo documents their migration path; the incremental pattern is the user's preference and the conservative default)

The migration follows User Decision 3 (incremental hardening). Each phase delivers standalone value and can be validated before proceeding.

#### Phase 1: State Splitting + PreToolUse Hook *[Revised: bundled per V1 recommendation]*
- Split state.yml into state.yml + checkpoint.yml + questions.yml + gates.yml + tasks.yml
- Implement PreToolUse command hook (Node.js) on Write matching state files and gates.yml
- Validate FSM transitions, schema conformance, gate passage
- Add PostToolUse audit trail hook
- Update all skill frontmatter to load only relevant files
- **Value**: Immediate token savings, scoped injection, enforced state validity, audit trail
- **Risk**: MODERATE (first hook adoption + file splitting together; however, hooks without split state and split state without hooks are both less useful alone)
- **Evidence**: STRONG (convergent state splitting pattern + 3 harness hook implementations)
- **Reversible?**: Yes (can re-merge files and remove hooks)

| Maintenance Reduction | Token Savings | Risk Mitigation |
|----------------------|---------------|-----------------|
| High (smaller files, scoped reads, automated enforcement replaces manual vigilance) | High (60-80% state token reduction) | High (prevents state drift, catches invalid transitions) |

#### Phase 2: Checkpoint-Based Resume
- Generalize checkpoint.yml to all skills (not just execute)
- Update each skill's resume logic to read checkpoint directly
- Remove artifact-existence heuristics as primary resume mechanism (retain as secondary)
- **Value**: Deterministic resume, eliminates "LLM misreads state" failure mode
- **Risk**: LOW (extending existing execute-skill pattern to other skills)
- **Evidence**: STRONG (LangGraph per-step, expedite's own execute precedent)
- **Reversible?**: Yes (can revert to heuristic)

| Maintenance Reduction | Token Savings | Risk Mitigation |
|----------------------|---------------|-----------------|
| High (deterministic resume replaces fragile heuristics) | Low | High (eliminates resume failure modes) |

#### Phase 3: Structural Gate Enforcement
- Implement code-enforced validation for G1, G2, G4 (fully structural)
- Implement structural rubric for G3, G5 (the code-enforced layer of dual-layer gates)
- Gates run as Node.js scripts invocable from skills, with results written to gates.yml
- **Value**: Eliminates rubber-stamp for structural checks (3 of 5 gates fully, 2 of 5 partially)
- **Risk**: LOW (deterministic scripts; testable independently)
- **Evidence**: STRONG (claude-code-harness rule engine, academic rubber-stamp evidence)
- **Reversible?**: Yes (can revert to prompt-enforced)

| Maintenance Reduction | Token Savings | Risk Mitigation |
|----------------------|---------------|-----------------|
| Medium (gate logic is code, not prompts) | Medium (code gates cost zero tokens) | High (eliminates rubber stamp for structural criteria) |

#### Phase 4: Agent Formalization
- Move agent prompt templates from `skills/{skill}/references/prompt-*.md` to plugin `agents/` directory with full frontmatter
- Add tool restrictions, model assignments, maxTurns
- Update skill dispatch to use named agents
- **Value**: Tool isolation, model tiering, platform features
- **Risk**: MODERATE (restructuring agent dispatch; potential for broken references)
- **Evidence**: STRONG (official schema, 5 repo examples)
- **Reversible?**: Partially (frontmatter is additive)

| Maintenance Reduction | Token Savings | Risk Mitigation |
|----------------------|---------------|-----------------|
| Medium (formal agent definitions are self-documenting) | Medium (model tiering) | Medium (tool restrictions prevent misbehavior) |

#### Phase 5: Skill Thinning
- Refactor skills from 500-860 lines to 100-200 lines
- Move artifact generation logic into agent prompts
- Move quality evaluation into gate scripts (Phase 3) and verifier agents
- **Value**: Maintainable skills, clear separation of concerns
- **Risk**: MODERATE (largest refactoring; requires careful testing of each skill)
- **Evidence**: MODERATE (directional evidence from claude-code-harness)
- **Reversible?**: Difficult (structural change)

| Maintenance Reduction | Token Savings | Risk Mitigation |
|----------------------|---------------|-----------------|
| High (skills drop from 860 to 200 lines) | Low | Medium (thinner skills are easier to debug) |

#### Phase 6: Semantic Gate Verifier
- Implement verifier agent for G3 and G5 semantic gates
- Dual-layer: structural rubric (already from Phase 3) + reasoning verifier (new agent)
- **Value**: Anti-rubber-stamp for semantic quality checks
- **Risk**: MODERATE (LLM-based evaluation is inherently variable; need to calibrate)
- **Evidence**: MODERATE (pattern documented, Phase 24 concept, no repo demonstrates exact pattern)
- **Reversible?**: Yes (can revert to prompt-enforced)

| Maintenance Reduction | Token Savings | Risk Mitigation |
|----------------------|---------------|-----------------|
| Low (adds a verifier agent to maintain) | Negative (verifier costs tokens) | High (eliminates rubber stamp for semantic criteria) |

#### Phase 7: Worktree Isolation
- Add `isolation: "worktree"` to execute agents
- Add EnterWorktree to disallowedTools for non-execute agents
- Test merge-back workflow
- **Value**: Source code isolation during execute phase
- **Risk**: LOW (single frontmatter field; manual merge-back accepted)
- **Evidence**: ADEQUATE (2 repos, official docs)
- **Reversible?**: Yes (remove frontmatter field)

| Maintenance Reduction | Token Savings | Risk Mitigation |
|----------------------|---------------|-----------------|
| Low (one frontmatter field) | Zero | Medium (prevents code conflicts) |

#### Phase 8: Session Continuity
- Implement Stop hook for session summary
- Implement SessionStart hook with fallback
- Implement PreCompact hook for state preservation
- **Value**: Reliable session handoff, protection against compaction data loss
- **Risk**: MODERATE (SessionStart platform bug uncertainty)
- **Evidence**: MODERATE (ECC implementation, root fallback pattern)
- **Reversible?**: Yes (can remove hooks)

| Maintenance Reduction | Token Savings | Risk Mitigation |
|----------------------|---------------|-----------------|
| Medium (automated context preservation) | Low | Medium (prevents context loss) |

#### Risk Assessment Per Phase

| Phase | Risk | Evidence | Dependencies | Reversible? |
|-------|------|----------|-------------|-------------|
| 1. State splitting + hooks | MODERATE | STRONG | None | Yes |
| 2. Checkpoint resume | LOW | STRONG | Phase 1 (reads split files) | Yes |
| 3. Structural gates | LOW | STRONG | Phase 1 (reads gates.yml, hooks exist) | Yes |
| 4. Agent formalization | MODERATE | STRONG | None (can run independently) | Partially |
| 5. Skill thinning | MODERATE | MODERATE | Phase 4 (agents must be formalized) | Difficult |
| 6. Semantic verifier | MODERATE | MODERATE | Phase 3 (structural rubric), Phase 4 (agent format) | Yes |
| 7. Worktree isolation | LOW | ADEQUATE | Phase 4 (agent frontmatter) | Yes |
| 8. Session continuity | MODERATE | MODERATE | Phase 2 (checkpoint file) | Yes |

---

### Evidence Quality Map *[Revised: updated for design changes]*

| Design Element | Evidence Strength | Sources | Confidence | Key Risk |
|----------------|------------------|---------|------------|----------|
| PreToolUse state machine guard | STRONG | claude-code-harness, ECC, agentic-framework, official docs | HIGH | Over-blocking on edge cases |
| Directory-based state (file-per-concern) | STRONG | LangGraph, ECC, CrewAI, claude-code-harness, MemGPT | HIGH | Cross-file consistency if parallel phases ever added |
| Structural gate code enforcement | STRONG | claude-code-harness rule engine, academic rubber-stamp evidence | HIGH | Gate rules may be too rigid for edge cases |
| Checkpoint-based deterministic resume | STRONG | LangGraph, expedite execute skill, ECC session summaries | HIGH | Mid-step crash leaves ambiguous state |
| Agent formalization (subagent schema) | STRONG | Official docs, 5 repo examples | HIGH | Agent dispatch refactoring complexity |
| Model tiering (Haiku/Sonnet/Opus) | STRONG | 4 independent implementations | HIGH | Model availability/pricing changes |
| Node.js for hook enforcement | MODERATE | ECC Node.js hooks, claude-code-harness TypeScript (same runtime) | MEDIUM | Node.js startup latency (~100ms) *[Revised: upgraded from WEAK to MODERATE; changed from shell to Node.js]* |
| Three-layer architecture | MODERATE | claude-code-harness (primary), ECC (secondary) | MEDIUM | No controlled comparison with alternatives |
| Dual-layer rubric + reasoning gates | MODERATE | Research taxonomy, arXiv survey, Phase 24 concept | MEDIUM | No repo demonstrates exact pattern |
| Session summary handoff (Stop/SessionStart) | MODERATE | ECC implementation | MEDIUM | SessionStart platform bugs |
| PreCompact state preservation | MODERATE | ECC pre-compact.js | MEDIUM | Single source |
| Thin-skill/thick-agent boundary | MODERATE | claude-code-harness, observational evidence | MEDIUM | Optimal skill size unknown |
| gates.yml write validation | MODERATE | Extension of state-guard pattern | MEDIUM | No repo validates gate results at hook level *[Revised: new entry]* |
| Worktree isolation for execute | ADEQUATE | ccswarm, agent_farm, official docs | MEDIUM | Merge conflict frequency unknown |
| Artifact structural validation hooks | MODERATE | Extension of state-guard pattern | MEDIUM | No repo validates artifacts at hook level |
| Per-agent persistent memory | WEAK | Official docs only, no repo demonstrates | LOW | Feature maturity unknown |
| SubagentStop for automatic verification | SPECULATIVE | Mechanism confirmed, no demonstration | LOW | Untested pattern |
| Override + code-enforced gate interaction | SPECULATIVE | No source demonstrates *[Revised: reclassified from MODERATE to SPECULATIVE for honesty]* | LOW | Untested design invention |
| 100-200 line skill target | WEAK | Extrapolated from claude-code-harness | LOW | May be too aggressive or too lenient |

---

### Risks & Open Questions

#### Decisions with Weakest Evidence

1. **Optimal skill line count (100-200 lines)**: Extrapolated from claude-code-harness's thin verb skills, which orchestrate fewer steps than expedite's skills. The real target may be 200-300 lines for complex skills like research (9 steps). Evidence: WEAK.

2. **Override + code-enforced gate interaction**: The override-record-in-gates.yml pattern recognized by the PreToolUse hook is a design invention. No source demonstrates overrides working with code-enforced gates. This is the design's most important extrapolation and needs validation in Phase 1. Evidence: SPECULATIVE. *[Revised: moved from "areas where design extrapolates" to "weakest evidence" for proper emphasis]*

3. **SubagentStop for automatic gate evaluation**: The mechanism is confirmed available in plugin hooks, but no repo demonstrates using SubagentStop with agent hooks for quality verification. This is deferred and should be validated experimentally. Evidence: SPECULATIVE.

4. **Per-agent persistent memory**: The `memory` field is documented but undemonstrated in surveyed repos. Deferred until expedite-specific evidence justifies adoption. Evidence: WEAK.

#### Areas Where the Design Extrapolates Beyond Research

1. **Artifact validation via PreToolUse hooks**: The state-guard pattern (PreToolUse on state file writes) is well-evidenced. Extending it to artifact validation (PreToolUse on SCOPE.md writes to check structural completeness) is a reasonable extrapolation but lacks direct precedent. The design marks this as lower priority.

2. **Override compatibility with code-enforced gates**: The research documents auditable overrides (expedite's existing pattern) and code-enforced gates (claude-code-harness) separately. No source shows how overrides work with code-enforced gates. The design proposes writing override records to gates.yml that the PreToolUse hook recognizes as valid gate passage. This is architecturally sound but untested.

3. **Checkpoint + session summary as dual resume mechanism**: The research documents checkpoint-based resume (LangGraph) and session summary handoff (ECC) as separate patterns. The design combines both. This combination is not demonstrated by any source but is a logical synthesis of complementary patterns.

4. **gates.yml write validation**: Extending the PreToolUse state-guard pattern to validate gate result writes. Motivated by V1's identification of the fabrication bypass, but no repo validates gate results at the hook level. *[Revised: new entry]*

#### What Needs Validation Before Commitment

1. **Hook latency in practice**: The design assumes command hooks add acceptable latency (~100-200ms per write, including Node.js startup). Validate by implementing the PreToolUse state-guard hook (Phase 1) and measuring actual latency on representative workloads.

2. **Plugin-level hooks fire on subagent tool calls**: The design assumes that when an agent (subagent) uses the Write tool, the plugin-level PreToolUse hook still fires. This is architecturally expected (hooks are registered at the plugin level) but none of the proposals explicitly verify this. If hooks do not fire on subagent-initiated Write calls, the enforcement layer has a critical gap. **This is the single highest-risk platform assumption.** *[Revised: elevated from implicit assumption to explicit priority-1 validation item, per V2's recommendation]*

3. **SessionStart hook stability**: Three platform bugs may have been resolved. Test SessionStart in a minimal plugin before depending on it for context loading. The fallback (frontmatter injection) ensures no feature is blocked.

4. **Override + hook interaction**: Validate that the override-record-in-gates.yml pattern actually works with the PreToolUse state-guard hook. Test the full flow: user requests override -> override recorded -> phase advancement allowed.

5. **Agent formalization dispatch**: Validate that agents defined in the plugin's `agents/` directory can be dispatched by name from skills, that tool restrictions are enforced, and that model assignments work. Test with one agent before migrating all eight.

6. **PreToolUse receiving full file content in tool_input**: All proposals assume hooks receive the proposed file content (tool_input.content and tool_input.file_path) in stdin JSON. This is documented but not verified experimentally. If the stdin JSON format differs from expectations, the entire state-guard hook pattern fails.

#### Platform Assumptions That Could Be Wrong

1. **Write tool provides tool_input to PreToolUse hooks**: Documented in the hooks reference but not verified experimentally. If the input format differs, the state-guard hook cannot parse proposed state changes.

2. **Plugin hooks.json has the same semantics as project settings hooks**: The supplement-synthesis confirmed schema parity, but behavioral parity (ordering, priority, interaction with project-level hooks) is assumed, not verified.

3. **Command hooks can read from stdin and write to stdout**: The design relies on the documented pattern where hook scripts receive JSON on stdin and output JSON on stdout.

4. **Exit code 2 blocks Write operations**: The design depends on exit code 2 from PreToolUse hooks blocking the tool call. Must be verified in the plugin hook context.

5. **`disallowedTools` in subagent frontmatter is enforced**: The design uses disallowedTools to prevent research agents from using Write/Edit. If this field is advisory rather than enforced, tool isolation does not work.

6. **Plugin-level hooks fire on subagent-initiated tool calls**: If PreToolUse hooks do not fire when a subagent uses the Write tool, the entire "agents never bypass enforcement" invariant fails. This is the most critical assumption. *[Revised: elevated to explicit platform assumption]*

---

## Confidence Assessment

| Design Area | Confidence | Change from Original | Justification |
|-------------|------------|---------------------|---------------|
| Three-layer architecture | MEDIUM | No change | Observational evidence, no controlled comparison. Same as original. |
| Hook architecture | MEDIUM-HIGH | Increased | Switching to Node.js eliminates the WEAK-evidence shell choice. The hook set is now evidence-aligned. |
| State management | HIGH | No change | 4+ convergent sources. Strongest evidence area. |
| Agent formalization | HIGH | Slightly increased | Adding explicit registry and clarifying location eliminates ambiguity. |
| Quality gate enforcement | HIGH | Slightly increased | Adding gates.yml validation closes the fabrication bypass. Reclassifying G2 as primarily structural aligns with evidence. |
| Resume & recovery | HIGH | No change | STRONG evidence (LangGraph, execute-skill precedent). |
| Context & memory | MEDIUM | Slightly increased | Deferring agent memory removes the internal inconsistency. Design now matches evidence. |
| Worktree isolation | MEDIUM | No change | ADEQUATE evidence. Same as original. |
| Migration sequence | MEDIUM | Increased | Bundling state split + hooks eliminates the unprotected window. Phase ordering is now safer. |
| Override mechanism | LOW | No change (honesty improved) | Reclassified as SPECULATIVE. No source demonstrates the interaction. Same risk, more honest labeling. |

---

## Remaining Disagreements

### With Proposal 1 (Developer Experience Lens)

1. **Agent count**: P1 proposes 11 agents including scope-facilitator, research-planner, and sufficiency-evaluator. This design uses 8. The evidence does not support a specific agent count, but the additional agents in P1 blur the skill-agent boundary (scope-facilitator duplicates the scope skill's conversation role) or duplicate code-enforced functionality (sufficiency-evaluator when structural checks are deterministic scripts). Fewer agents means less maintenance surface, which the evidence lens favors.

2. **SubagentStop hook for gate verification**: P1 includes SubagentStop as a core hook for checking gate-verifier output completeness. The evidence for this pattern is SPECULATIVE (no repo demonstrates it). Skill-level verification after the agent returns is simpler and has no evidence disadvantage. The evidence lens favors the proven pattern.

3. **Agent persistent memory as a committed feature**: P1 enables memory for synthesizer and verifier with confidence. The evidence is WEAK. This design defers memory with explicit experimental criteria. The evidence lens requires that WEAK-evidence features not be committed to in the initial design.

### With Proposal 2 (Sustainability & Maintainability Lens)

1. **SessionStart exclusion**: P2 excludes SessionStart entirely ("defer indefinitely"). User Decision C4 says "deferred due to bugs" -- deferred implies eventual adoption once bugs are fixed, not permanent exclusion. The evidence lens reads C4 literally: design with fallback (which this design does), defer the hook to a late migration phase, do not exclude it from the design entirely. P2 over-interprets the risk.

2. **G2 classification**: P2 classifies G2 as fully structural. This design agrees G2 is primarily structural but acknowledges that readiness assessment quality could benefit from a light semantic check in the future. The difference is minor -- both designs code-enforce G2's structural checks. This design simply leaves the door open for a semantic component if observed need arises, while P2 closes it.

3. **Stop hook writing checkpoint.yml**: P2 originally proposed the Stop hook writing checkpoints. V1 correctly identified this as problematic (Stop hook lacks context about current step). This design specifies that only skills write checkpoints at step boundaries. The Stop hook writes session summaries only. This is a point where the evidence lens and the coherence validator agree against P2's original position.

4. **Artifact validation hooks**: P2 does not include artifact validation hooks. This design includes them as a lower-priority future enhancement. The evidence for extending the state-guard pattern to artifacts is MODERATE -- no repo demonstrates it, but the extension is architecturally sound. The sustainability lens's objection (more hooks = more maintenance) is valid but does not outweigh the potential value of catching incomplete artifacts at write time rather than at gate time.
