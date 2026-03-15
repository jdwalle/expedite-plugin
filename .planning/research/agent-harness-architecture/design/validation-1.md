# Validation 1: Design Coherence & Completeness

## Validation Summary

All three proposals are architecturally sound and ready for synthesis. They demonstrate strong convergence on foundational decisions (three-layer separation, PreToolUse state guards, directory-based state, checkpoint-based resume, structural gate code-enforcement) while diverging on secondary choices that are resolvable. No proposal contains a design-breaking flaw. There are three critical issues that the synthesizer must resolve, six moderate concerns, and several best-of-breed elements to combine. The proposals are ready for synthesis -- no further design iteration is needed on individual proposals.

**Overall quality ranking** (for synthesis prioritization, not proposal elimination):
1. Proposal 2 (Sustainability) -- most internally consistent, most cautious about maintenance burden, fewest unresolved assumptions
2. Proposal 1 (DX) -- most thorough on developer-facing scenarios, best hook specification detail, but makes choices (agent memory, SubagentStop) without sufficient mitigation planning
3. Proposal 3 (Evidence) -- most rigorous about evidence grounding, best risk documentation, but shell script choice is the weakest technical decision across all proposals

---

## Proposal 1 Assessment (Developer Experience Lens)

### Strengths

1. **Best hook specification detail**: Six hooks with complete event/handler/matcher/purpose/blocking tables. The per-hook latency table with frequency estimates is actionable for implementation. The override flow is specified step-by-step with concrete UX scenarios.

2. **Best developer experience scenarios**: The "Developer Experience Moments" section (starting a lifecycle, hitting a gate, resuming after reset, getting blocked, overriding) walks through the complete DX surface. This is the only proposal that demonstrates what the user actually sees in each scenario, making the design verifiable against real usage.

3. **Strongest agent memory design**: The choice to give `memory: project` to research-synthesizer and gate-verifier (and only those two) is well-reasoned. The argument that ephemeral research agents should not accumulate stale context is sound. The developer-inspectable and developer-editable memory is a good DX choice.

4. **Best gate-state integration detail**: The gates.yml schema with structural_checks and semantic_evaluation sub-objects is the most complete specification. The G2 gate classification as "Structural + Semantic" (with a structural component for file/section existence and a semantic component for readiness assessment quality) is a nuance that Proposals 2 and 3 handle differently.

5. **Complete dependency chain visualization**: The migration dependency tree diagram clearly shows which increments can run in parallel and which have sequential dependencies.

### Weaknesses

1. **SubagentStop hook for gate verification is under-specified**: Proposal 1 registers a SubagentStop agent hook on `gate-verifier` to check evaluation completeness. But the hook's behavior specification is vague -- "validates that the verifier produced a complete evaluation" without defining what "complete" means programmatically. More importantly, using an agent hook (30-60 second latency) for completeness checking is expensive when a simpler approach (the skill checking the output file after the agent returns) would suffice.
   - **Suggested fix**: Drop the SubagentStop agent hook. Have the gate skill itself validate verifier output completeness after the agent returns. This matches Proposal 2's more conservative hook set.

2. **Shell script vs. Node.js ambiguity**: The hook scripts are named `.sh` (validate-state-write.sh, pre-compact-save.sh) but the text mentions YAML parsing and JSON processing that is fragile in shell. Proposal 2 explicitly chose Node.js with clear reasoning. Proposal 1 should align.
   - **Suggested fix**: Use Node.js for all hook scripts, as Proposal 2 recommends.

3. **`sufficiency-evaluator` agent is unnecessary**: The agent registry lists both `gate-verifier` (Opus, semantic quality evaluation) and `sufficiency-evaluator` (Sonnet, structural rubric evaluation). But structural rubric evaluation is code-enforced (deterministic scripts) per the gate classification. Having an LLM-based "structural evaluator" contradicts the principle of code-enforcing structural gates.
   - **Suggested fix**: Remove sufficiency-evaluator. Structural checks are code-enforced scripts. Only gate-verifier is needed for the semantic layer.

4. **Agent count is high (11 agents)**: More agents than the other proposals, including scope-facilitator, research-planner, sufficiency-evaluator, and separate codebase-researcher. While this is not wrong, each agent is a maintenance surface. The DX lens should consider whether the developer maintaining 11 agent definitions is sustainable.
   - **Suggested fix**: Consider whether scope-facilitator (the scope skill already handles conversation) and research-planner (currently embedded in research skill logic) need to be separate agents vs. skill-level logic.

5. **Checkpoint regression detection rule is too rigid**: "If the step number is decreasing (regression), deny unless substep is 'recovery'" -- but legitimate re-execution of a step (after an override, after upstream artifact changes) would require setting substep to 'recovery' even when nothing is being recovered. The semantic overload of the substep field is confusing.
   - **Suggested fix**: Allow step regression when inputs_hash differs (indicating changed inputs), not only when substep is 'recovery'.

### Best Elements to Keep
- Developer experience scenarios (Section "Developer Experience Moments")
- Per-hook latency and frequency table
- Override flow with audit trail
- Agent memory scoped to synthesizer and verifier only
- Migration dependency chain visualization
- gates.yml schema with typed structural_checks and semantic_evaluation

---

## Proposal 2 Assessment (Sustainability & Maintainability Lens)

### Strengths

1. **Most internally consistent**: Every design choice is evaluated against maintenance burden. The "What Adds Complexity Without Proportional Value" section provides clear reasoning for every exclusion (agent memory, SessionStart, agent hooks for gates, TypeScript compilation). No decision contradicts another.

2. **Best hook implementation language decision**: The Node.js choice with explicit reasoning (cross-platform, testable, no build step, fast enough, single YAML dependency) is the strongest technical decision across all proposals. The comparison matrix (shell: fragile, TypeScript: build step, Node.js: goldilocks) is clear.

3. **Best maintenance burden analysis**: Every layer and every migration phase includes explicit maintenance cost assessment. The token cost tables (current vs. proposed state injection) provide concrete savings estimates. The "Cost-Benefit of Each Phase" migration table with Maintenance Reduction, Token Savings, and Risk Mitigation columns is the most comprehensive.

4. **Strongest state debugging story**: "State is plain YAML files. Debugging is: cat the file, check the checkpoint, run the validator manually, check the error log." Four steps, no tools beyond standard CLI. This is the strongest argument for file-per-concern over more complex state management.

5. **Best agent dispatch context specification**: The "Context Passing (Minimal Sufficient Context)" section with explicit SHOULD include / SHOULD NOT include lists prevents context bloat in agent dispatch prompts. The cost-aware dispatch section ("Can this be done without an agent?") is practical.

6. **Most conservative SessionStart approach**: Excluding SessionStart entirely (rather than including it with a fallback) is the safer choice given three unverified platform bugs. The reasoning -- "do not build on unreliable foundations" -- aligns with the sustainability lens.

### Weaknesses

1. **Agent memory deferred too aggressively**: The argument that agent persistent memory "introduces a new state surface that must be maintained" is valid, but the counter-argument (Proposal 1) that synthesizer and verifier agents benefit from cross-lifecycle learning is also valid. Blanket deferral may miss a low-cost opportunity.
   - **Suggested fix**: Adopt Proposal 1's selective approach -- memory for synthesizer and verifier only, deferred for all others. This limits the maintenance surface to 2 agents while capturing the highest-value learning.

2. **G2 classified as fully structural**: Proposal 2 classifies G2 (Research) as purely structural ("Research synthesis exists, all questions addressed, evidence quality ratings"). But the READINESS assessment's quality is semantic -- determining whether evidence is "strong" vs. "adequate" vs. "insufficient" requires LLM judgment, not just field-existence checking. Proposals 1 and 3 handle this more carefully (G2 is structural + light semantic).
   - **Suggested fix**: Classify G2 as structural + semantic (like Proposals 1 and 3). The structural layer checks file existence and section coverage. A lightweight semantic check validates readiness assessment quality.

3. **Agent definition location inconsistency**: The text says agents go in "the plugin's `agents/` directory" but the official subagent schema prioritizes `.claude/agents/` for project-level agents. For a plugin, agents should be in the plugin's agents directory, but this needs explicit clarification about precedence and discoverability.
   - **Suggested fix**: Specify that plugin-provided agents live in the plugin's `agents/` directory (loaded via plugin API), and that project-level overrides in `.claude/agents/` take precedence per the official priority ordering.

4. **Stop hook as checkpoint writer is problematic**: The design has the Stop hook writing/updating checkpoint.yml. But the Stop hook fires when the session ends or when Claude stops responding -- it does not have access to the conversation context to determine the current step accurately. The hook reads state.yml and checkpoint.yml from disk, but if the skill was in the middle of a step and had not yet written the checkpoint, the Stop hook would either write stale data or have to guess.
   - **Suggested fix**: Skills write checkpoints at step boundaries (in-skill, not in hooks). The Stop hook should write/update session-summary.md only, not checkpoint.yml. The PreCompact hook should ensure the checkpoint is flushed to disk before compaction.

5. **Missing override mechanism detail**: The override flow is mentioned but not specified step-by-step. How does the user-initiated override interact with the PreToolUse hook? Proposal 1 spells this out explicitly (write override to gates.yml, hook recognizes overridden: true). Proposal 2 says overrides work but does not show the mechanism.
   - **Suggested fix**: Adopt Proposal 1's override flow specification.

### Best Elements to Keep
- Node.js as hook implementation language with reasoning
- Maintenance burden analysis per layer and per migration phase
- Minimal hook set (3 core, 2 extended) with "only add if justified by observed failures"
- Cost-benefit migration table (Maintenance Reduction / Token Savings / Risk Mitigation)
- State debugging story
- Context passing guidelines for agent dispatch
- Schema evolution strategy (5-step process for adding fields, 4-step for adding files)

---

## Proposal 3 Assessment (Evidence Lens)

### Strengths

1. **Best evidence grounding**: Every design choice includes an evidence strength rating (STRONG/MODERATE/WEAK/SPECULATIVE/NONE) with specific source citations. The "Evidence Quality Map" table at the end maps all 16 design elements to their evidence strength, sources, confidence level, and key risk. This is the most rigorous assessment of design confidence.

2. **Best risk and gap documentation**: The "Risks & Open Questions" section is the most thorough, with specific subsections for "Decisions with Weakest Evidence," "Areas Where the Design Extrapolates Beyond Research," "What Needs Validation Before Commitment," and "Platform Assumptions That Could Be Wrong." This transparency is valuable for the synthesizer and implementer.

3. **Best gate evidence taxonomy**: The "Anti-Rubber-Stamp Evidence Per Mechanism" section maps each anti-rubber-stamp mechanism to its evidence level and source. The distinction between STRONG evidence for deterministic code enforcement and SPECULATIVE evidence for SubagentStop automatic verification is precisely the kind of calibration the final design needs.

4. **Most conservative migration ordering**: State splitting first (Phase 1), then checkpoint resume (Phase 2), then hooks (Phase 3), then gates (Phase 4), then agents (Phase 5), then skill thinning (Phase 6), then semantic verifier (Phase 7), then worktree (Phase 8), then session continuity (Phase 9). This is the most granular decomposition with the most explicit risk/evidence ratings per phase. Each phase has an explicit "Reversible?" column.

5. **Honest about evidence gaps**: The "Evidence Gaps in State Design" section (cross-file consistency, YAML parsing in shell, backup-before-write atomicity) and the resume "Gaps in Resume Evidence" section (mid-step crash, checkpoint write atomicity, agent-level checkpointing) are the most transparent about what the design does not know.

6. **Best artifact validation design**: Proposal 3 uniquely proposes PreToolUse hooks for artifact validation (not just state validation) -- checking structural requirements of SCOPE.md, SYNTHESIS.md, etc. at write time. This catches incomplete artifacts at creation rather than at gate time. Appropriately marked as "lower priority" and "MODERATE evidence."

### Weaknesses

1. **Shell script choice is the weakest decision across all proposals**: "Start with Shell, Migrate to Node.js If Needed" is explicitly labeled as WEAK evidence. The rationale ("Shell scripts are simpler for a solo developer") is contradicted by the same proposal's own acknowledgment that "Shell parsing of YAML is fragile for edge cases." The mitigation ("Use yq") adds a dependency without eliminating the fragility. Both Proposals 1 and 2 use Node.js or acknowledge its superiority.
   - **Suggested fix**: Adopt Proposal 2's Node.js decision. Shell is not simpler for YAML parsing and JSON processing -- it is harder and more fragile. The solo developer argument does not hold when the developer will be writing YAML parsing logic regardless.

2. **Migration ordering puts hooks after state splitting AND checkpoints**: Phase 3 (hooks) depends on Phase 1 (state splitting) in Proposal 3's ordering. But hooks are the enforcement mechanism -- without them, state splitting and checkpoint writes have no validation. A corrupted state.yml write during Phase 1 or Phase 2 (before hooks exist) would not be caught.
   - **Suggested fix**: Bundle state splitting and the PreToolUse hook as a single first phase (as Proposal 1 does). Hooks are not useful without split state, and split state is not safe without hooks.

3. **Agent location ambiguity**: ".claude/agents/ and/or plugin agents/ directory" -- this "and/or" is a design gap. The precedence ordering matters. If agents are in both locations, which takes priority? The official docs specify priority ordering (CLI flag > project .claude/agents/ > user ~/.claude/agents/ > plugin agents/). The design should pick one location.
   - **Suggested fix**: Use the plugin's agents/ directory as the primary location (plugin-provided defaults). Note that project-level overrides in .claude/agents/ take precedence per the official ordering.

4. **Per-agent persistent memory evidence assessment is inconsistent**: The Evidence Quality Map rates per-agent memory as WEAK (official docs only, no repo demonstrates). But the design says "enable memory for research agents as an experiment." This is a stronger commitment than "WEAK evidence" typically justifies in a design that claims to use "only mechanisms with strong evidence backing." There is an internal tension between the evidence lens and the actual design choice.
   - **Suggested fix**: Either defer memory entirely (matching the evidence lens) or explicitly label it as an exception to the evidence-only principle with clear experimental criteria.

5. **Missing agent registry**: Unlike Proposals 1 and 2, Proposal 3 does not list a complete agent registry (which agents exist, their models, their tool restrictions). The formalization section describes the schema and principles but does not enumerate the specific agents. This makes it harder to assess completeness.
   - **Suggested fix**: Add an explicit agent registry table (name, model, key tools, isolation) as Proposals 1 and 2 provide.

### Best Elements to Keep
- Evidence strength ratings on every design choice
- Evidence Quality Map (16 design elements with strength/sources/confidence/risk)
- Risk documentation structure (weak evidence, extrapolations, validation needs, platform assumptions)
- Artifact validation hooks (PreToolUse on artifact writes, lower priority)
- Per-phase reversibility column in migration table
- Distinction between checkpoint (machine-readable resume state) and session summary (LLM-readable orientation context)
- Known anti-patterns section with evidence ratings

---

## Cross-Proposal Comparison

### Points of Agreement (Strongest Design Choices)

These are decisions where all three proposals converge independently, providing the highest confidence:

1. **Three-layer architecture (Enforcement / Orchestration / Execution)**: All three adopt it as the foundational structure. Skills shrink to 100-200 line dispatchers, agents get full frontmatter, hooks provide enforcement. No proposal deviates.

2. **PreToolUse command hook on Write as the primary enforcement mechanism**: All three specify this as the highest-value hook adoption. All three describe the same pattern: intercept Write, filter by .expedite/ state file paths, validate FSM transitions and schema, exit 2 to deny with permissionDecisionReason.

3. **Five-file state split** (state.yml, checkpoint.yml, questions.yml, gates.yml, tasks.yml): All three converge on the same file breakdown with the same contents. Minor differences in naming (compact-context.md vs. session-summary.md) do not affect the architecture.

4. **YAML format retained**: All three agree that switching state format from YAML to JSON provides no benefit. The key improvement is splitting, not reformatting.

5. **Structural gates (G1, G4) fully code-enforced**: All three agree these gates check artifact existence, section counts, and field completeness -- all deterministic. No LLM judgment needed.

6. **Semantic gates (G3, G5) get dual-layer enforcement**: All three implement User Decision 2 -- structural rubric (code-enforced) + reasoning verification (separate agent).

7. **Checkpoint-based deterministic resume**: All three generalize the execute skill's checkpoint.yml pattern to all skills. All three make resume logic read the checkpoint directly instead of using artifact-existence heuristics. All three identify this as addressing the core "current_step tracked but not used" problem.

8. **Worktree isolation scoped to execute agents only**: All three add `isolation: "worktree"` to execute agents and no others.

9. **Subagent coordination (not Agent Teams)**: All three agree that expedite's pipeline architecture fits the subagent hub-and-spoke pattern. Agent Teams is deferred.

10. **Override mechanism preserves user agency**: All three maintain the override path (user requests override, override recorded in gates.yml, audit trail created, phase advancement allowed). No proposal makes gates un-overridable.

### Points of Disagreement (Need Resolution)

1. **Hook implementation language**:
   - P1: Shell scripts (`.sh` filenames) with implicit Node.js usage for YAML parsing
   - P2: Node.js explicitly, with clear reasoning against shell and TypeScript
   - P3: Shell scripts + yq, with migration path to Node.js
   - **Resolution**: Adopt P2's Node.js decision. The reasoning is strongest, and P1's actual YAML parsing needs Node.js anyway. Shell + yq is the weakest choice.

2. **Number of hooks**:
   - P1: 6 hooks (PreToolUse, PostToolUse, PreCompact, SessionStart, Stop, SubagentStop)
   - P2: 3 core hooks (PreToolUse, Stop, PreCompact), 2 extended (SubagentStop, PostToolUse)
   - P3: 6 hooks (PreToolUse x2, PostToolUse, Stop, SessionStart, PreCompact) with evidence ratings
   - **Resolution**: Start with P2's minimal set (3 core). Add PostToolUse for audit trail in the same phase (low cost, high traceability value). SubagentStop and SessionStart are deferred. This gives 4 hooks.

3. **SessionStart hook inclusion**:
   - P1: Include with fallback
   - P2: Exclude entirely
   - P3: Include with fallback
   - **Resolution**: P2's exclusion is the safest given three unverified platform bugs. Design the fallback (frontmatter injection) as the primary mechanism. Add SessionStart later if bugs are confirmed fixed. This is the conservative incremental approach that all proposals claim to follow.

4. **Agent persistent memory**:
   - P1: Yes, for synthesizer and verifier only
   - P2: Defer entirely
   - P3: Experiment with research agents, do not depend on it
   - **Resolution**: P1's selective approach (synthesizer and verifier only) is the best balance. The maintenance surface is limited to 2 agents. The developer can inspect and edit memory. No feature depends on memory working. This is a low-risk, high-potential-value experiment.

5. **G2 gate classification**:
   - P1: Structural + Semantic (readiness assessment quality needs LLM judgment)
   - P2: Fully structural
   - P3: Structural + Light Semantic (readiness criteria quality check)
   - **Resolution**: P1 and P3 are correct. Determining whether evidence is "sufficient" for a decision area inherently requires judgment. G2 should be classified as structural + light semantic.

6. **Migration phase ordering and bundling**:
   - P1: 7 increments, hooks + state split bundled as Increment 1
   - P2: 9 phases, state split first (M1), hooks second (M2)
   - P3: 9 phases, state split first, checkpoints second, hooks third
   - **Resolution**: P1's bundling of hooks + state split is correct. State splitting without hook validation creates an unprotected window. The two should be a single migration phase.

7. **Stop hook behavior**:
   - P1: Writes session-summary.md
   - P2: Writes/updates checkpoint.yml
   - P3: Writes session-summary.yml
   - **Resolution**: Skills write checkpoints at step boundaries (in-skill). The Stop hook writes session-summary.md only (session handoff narrative). This avoids the problem P2 creates where the Stop hook must guess the current step.

### Best-of-Breed Elements from Each Proposal

| Element | Source | Why It Is Best |
|---------|--------|---------------|
| Developer experience scenarios | P1 | Only proposal that walks through concrete UX moments |
| Node.js for hooks with reasoning | P2 | Strongest technical argument, addresses fragility concerns |
| Evidence quality map | P3 | Calibrates design confidence per element |
| Per-hook latency/frequency table | P1 | Actionable for implementation prioritization |
| Maintenance burden analysis per layer | P2 | Quantifies the sustainability argument |
| Risk documentation structure | P3 | Most transparent about unknowns |
| Migration cost-benefit table | P2 | Three-axis evaluation (maintenance, tokens, risk) |
| Agent memory scoped to 2 agents | P1 | Best balance of value and maintenance |
| Artifact validation hooks | P3 | Unique design element with appropriate priority caveat |
| Override flow step-by-step | P1 | Most specific, verifiable against implementation |
| State debugging story | P2 | "4 commands, no special tools" |
| Checkpoint vs. session summary distinction | P3 | Clearest articulation of machine-readable vs. LLM-readable |

---

## Integration Sanity Check

### Hook --> State: How hooks read and validate state on writes

All three proposals specify the same pattern: PreToolUse command hook intercepts Write to .expedite/ state files, parses stdin JSON for tool_input.file_path and tool_input.content, reads current state from disk for comparison, validates proposed content against schema and FSM rules, and exits 0 (allow) or 2 (deny with reason).

**Integration holds.** The hook has everything it needs: proposed content (stdin), current state (disk read), validation rules (embedded in script). The hook does not need LLM context, conversational history, or inter-hook communication.

**One concern**: The hook must read gates.yml from disk to check gate passage before allowing phase advancement. If gates.yml is being written concurrently by another process (unlikely in expedite's sequential architecture, but theoretically possible during a gate evaluation that writes to gates.yml and then immediately writes to state.yml), there could be a read-after-write race. All proposals assume sequential execution, which is correct for expedite's pipeline. This is a non-issue for current architecture but should be noted as a constraint.

### Gate --> State: How gate passage updates state to allow phase advancement

The flow across all proposals:
1. Gate evaluation runs (structural checks + optional semantic verification)
2. Gate result is written to gates.yml (outcome: go/no-go/go-with-advisory/overridden)
3. Skill attempts to write phase advancement to state.yml
4. PreToolUse hook on state.yml reads gates.yml, finds passing gate result, allows the write

**Integration holds.** The gate-state coupling is through gates.yml as a shared artifact. The temporal ordering is correct: gate result must exist before phase advancement is attempted. The hook enforces this ordering deterministically.

**One concern**: Gates.yml is not hook-validated in P2 (only state.yml and checkpoint.yml have PreToolUse hooks). P1 raises this as Open Question 2. If an agent writes a fabricated gate result to gates.yml, the state transition hook would accept it. Mitigation: gate results should only be written by the gate skill or enforcement scripts, not by arbitrary agents. Agent tool restrictions (disallowedTools for Write to specific paths) could enforce this, but none of the proposals specify path-level write restrictions beyond the hook-validated state files.

**Suggested fix for synthesizer**: Gate evaluation scripts (not agents, not skills) should be the only writers to gates.yml. The PreToolUse hook on Write to gates.yml should validate that the write is coming from a gate evaluation context (e.g., the content includes expected gate result fields, the current phase matches the expected gate). This closes the fabrication gap.

### Resume --> Checkpoint: How resume logic reads checkpoint to determine next action

All three proposals specify the same deterministic resume protocol:
1. Skill reads checkpoint.yml from frontmatter injection
2. If checkpoint.skill matches current skill and step > 0, resume from that step
3. If checkpoint.skill does not match or no checkpoint, start from step 1
4. continuation_notes provide context for mid-step recovery
5. inputs_hash enables idempotency checking

**Integration holds.** The resume mechanism is self-contained: checkpoint.yml on disk is the single source of truth, read via frontmatter injection, interpreted by the skill's resume preamble. No hook, no LLM interpretation, no heuristic.

**One concern** (identified by P3): Mid-step crash leaves the checkpoint showing the previous step as complete, but the current step partially executed. The secondary artifact-existence check (retained as fallback in all proposals) addresses this for artifact-producing steps. For non-artifact steps (e.g., "ask user a question"), re-execution is safe. This is an acceptable limitation across all proposals.

### Skill --> Agent: How thin skills dispatch to thick agents with appropriate context

All three proposals specify:
1. Skill reads state and checkpoint from frontmatter
2. Skill determines which step to execute (from checkpoint)
3. Skill assembles context: task description + input artifact paths + output expectations
4. Skill invokes agent by name via Agent tool
5. Agent executes with its own frontmatter (model, tools, maxTurns)
6. Agent writes artifacts to disk, returns summary
7. Skill processes result, updates checkpoint

**Integration holds.** The dispatch pattern is clean: skill assembles, agent executes, skill records. P2's "minimal sufficient context" guidelines (what to include, what not to include) provide the best specification for context assembly.

**One concern**: None of the proposals specify how skills reference agents by name. The Agent tool in Claude Code accepts agent names that correspond to .md files in the agents directory. If an agent file is renamed or missing, the dispatch fails. All proposals list agent registries, but none specify how the skill references the agent (string literal? variable? config?). This is an implementation detail, not a design flaw, but the synthesizer should specify the dispatch mechanism.

### Agent --> State: How agent output updates state files

All three proposals agree on a key constraint: **agents do not write state directly.** Agents produce artifacts. Skills update state after processing agent results. The enforcement hook validates the state write.

P2 states this most explicitly: "Agents never write state directly -- they produce artifacts, and the skill updates state." P1's information flow diagram shows the same pattern. P3 specifies "agents... do not manage state (that is the skill's job via checkpoint updates)."

**Integration holds.** The unidirectional flow (agent -> artifacts -> skill reads artifacts -> skill writes state -> hook validates) prevents agents from corrupting state.

**One concern**: P1's checkpoint.yml schema says "Written by both skills and agents on step transitions." This contradicts the "agents do not write state" principle stated in the architecture sections of all proposals. If agents write checkpoint.yml, they bypass the skill's orchestration logic.
- **Suggested fix**: Only skills write checkpoint.yml. Agents produce artifacts and return summaries. Skills interpret the results and update the checkpoint. This maintains the clean unidirectional flow.

### Hook --> Gate: How hooks enforce gate passage before phase transitions

The PreToolUse hook on state.yml checks for gate passage before allowing _complete phase transitions:
1. Hook detects phase transition in proposed state.yml content
2. Hook maps phase to required gate (scope_complete -> G1, research_complete -> G2, etc.)
3. Hook reads gates.yml for a passing gate result
4. If found: allow. If not found: deny with reason.

**Integration holds.** The hook-gate coupling is deterministic and self-contained. The hook reads from gates.yml (written by gate evaluation) and validates against state.yml (the write it is intercepting). No LLM judgment in the loop.

---

## Critical Issues

These are design problems that MUST be fixed in the final design. Each is a blocker for coherent synthesis.

### Critical Issue 1: Who writes checkpoint.yml -- skills only, or skills and agents?

P1 states checkpoint.yml is "Written by both skills and agents on step transitions." P2 says the Stop hook writes checkpoint.yml. P1 and P3 say skills write checkpoints at step boundaries. This inconsistency must be resolved.

**The correct answer**: Only skills write checkpoint.yml. This maintains the three-layer separation (agents execute, skills orchestrate state). If agents write checkpoints, they take on orchestration responsibility, blurring the layer boundary. The Stop hook should NOT write checkpoints (it lacks context about the current step); it should write session-summary.md for session handoff.

**Impact if not fixed**: The enforcement layer (hooks) cannot distinguish skill-initiated checkpoint writes from agent-initiated checkpoint writes. If agents write checkpoints, a misbehaving agent could write an incorrect checkpoint that causes the skill to skip steps on resume.

### Critical Issue 2: Hook implementation language must be uniform

P1 uses shell scripts, P2 uses Node.js, P3 uses shell + yq. This is a fork in the implementation path that affects every hook script.

**The correct answer**: Node.js (P2's decision). The reasoning is clear: YAML parsing is required, shell YAML parsing is fragile, yq adds a dependency without full reliability, TypeScript adds a build step, Node.js is the goldilocks option. All three proposals need YAML parsing in hooks -- Node.js is the only option that all proposals' requirements converge on.

**Impact if not fixed**: If the synthesized design says "shell" but implementation discovers shell YAML parsing is inadequate, the entire enforcement layer needs rewriting.

### Critical Issue 3: gates.yml integrity is unprotected

None of the proposals validate writes to gates.yml via hooks. If an agent (or the LLM responding as a skill) writes a fabricated gate result to gates.yml, the PreToolUse hook on state.yml will accept it as valid gate passage and allow phase advancement.

**The correct answer**: Either (a) add PreToolUse validation for gates.yml writes (ensuring gate results have the expected structure, are produced by a known gate evaluation path, and match the current phase), or (b) add gates.yml to the agent disallowedTools write paths (agents cannot write to gates.yml, only gate evaluation scripts can).

**Impact if not fixed**: The code-enforced gate system has a bypass: write a fake gate result, then advance the phase. This undermines the entire value proposition of code-enforced gates. The effort to fabricate a gate result is low (one Write call), making this a realistic bypass path for a creative LLM.

---

## Recommendations for Synthesizer

### Architecture Decisions (take directly)
1. **Three-layer architecture**: All proposals agree. Adopt as stated.
2. **Five-file state split**: All proposals agree on the same files. Adopt state.yml, checkpoint.yml, questions.yml, gates.yml, tasks.yml.
3. **YAML format**: All proposals agree. Retain YAML.
4. **PreToolUse on Write as primary enforcement**: All proposals agree. Adopt as stated.
5. **Subagent coordination**: All proposals agree. Hub-and-spoke, no Agent Teams.
6. **Worktree isolation for execute only**: All proposals agree. Adopt as stated.

### Contested Decisions (resolve using these recommendations)
1. **Hook language**: Node.js (P2). Include P2's reasoning in the final design.
2. **Hook count**: Start with 4 (PreToolUse, PostToolUse for audit, Stop for session summary, PreCompact). Defer SessionStart and SubagentStop.
3. **SessionStart**: Exclude (P2). Design frontmatter injection as primary, SessionStart as future enhancement.
4. **Agent memory**: Selective (P1) -- synthesizer and verifier only. Include P1's reasoning about ephemeral vs. stateful agents.
5. **G2 classification**: Structural + light semantic (P1/P3). Not fully structural (P2).
6. **Migration bundling**: Bundle state split + PreToolUse hook as Phase 1 (P1). Do not split them.
7. **Stop hook behavior**: Session summary only, not checkpoint writes. Skills write checkpoints at step boundaries.
8. **Checkpoint writers**: Skills only, not agents. Maintain three-layer separation.
9. **gates.yml protection**: Add PreToolUse validation for gates.yml writes. Close the fabrication bypass.

### Structural Recommendations
1. **Use P1's developer experience scenarios** in the final design to make the architecture concrete and verifiable.
2. **Use P2's maintenance burden analysis** to justify every moving part.
3. **Use P3's evidence quality map** to calibrate confidence in each design element.
4. **Use P1's override flow** as the canonical override specification.
5. **Use P2's context passing guidelines** for agent dispatch.
6. **Use P3's risk documentation structure** for the final design's risks section.
7. **Use P2's schema evolution strategy** for state file versioning.

### Elements to Exclude from Final Design
1. **sufficiency-evaluator agent** (P1) -- structural checks are code-enforced, not agent-enforced
2. **Shell scripts for hooks** (P1, P3) -- Node.js is the clear winner
3. **SubagentStop hook** (P1, P3) -- deferred; skill-level verification is simpler
4. **SessionStart hook** (P1, P3) -- deferred until platform bugs confirmed fixed
5. **Artifact validation hooks** (P3) -- interesting but lower priority; add in a future increment
6. **Agent Teams** -- all proposals agree this is deferred
7. **Stop hook writing checkpoints** (P2) -- problematic; skills write checkpoints at step boundaries
