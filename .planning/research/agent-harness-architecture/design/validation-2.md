# Validation 2: Research Alignment & User Intent

## Validation Summary

All three proposals demonstrate strong fidelity to the research evidence base. The core architectural decisions -- three-layer separation, PreToolUse state machine guards, directory-based state, checkpoint-based deterministic resume, structural/semantic gate classification -- are well-supported by convergent evidence from multiple independent sources. No proposal fabricates evidence or makes claims that contradict the research synthesis. The proposals diverge meaningfully on secondary decisions (SessionStart adoption, agent persistent memory, hook implementation language, hook count) where the research provides adequate-to-weak evidence, and these divergences are legitimate design-lens differences rather than evidence misrepresentations.

User intent is honored in both letter and spirit across all three proposals, with minor variations in how aggressively each interprets the user's preferences. The strongest user intent compliance is in Decision 4 (worktree isolation scoped to execute only), which all three proposals implement identically. The area requiring the most scrutiny is Decision 3 (incremental hardening), where the proposals differ in migration sequencing but all respect the "each increment delivers standalone value" principle.

**Overall assessment**: The research base is honestly represented. The synthesizer can work from these proposals with confidence that the evidence claims are trustworthy. The key task for the synthesizer is resolving the secondary divergences (SessionStart, memory, hook language, hook count) where each proposal's lens leads to a defensible but different conclusion.

---

## Proposal 1 Assessment (Developer Experience Lens)

### Research Alignment

**Strengths**:
- Correctly identifies PreToolUse on state writes as the "single highest-value adoption" -- this matches the research synthesis verbatim.
- The five-file state split (state.yml, checkpoint.yml, questions.yml, gates.yml, tasks.yml) is well-grounded in the directory-based convergent pattern from 4+ sources. The rationale for separating checkpoint.yml from state.yml (different write frequencies) is a sound design inference from the file-per-concern principle, even though no source makes this exact argument.
- The G1/G2/G4 structural vs. G3/G5 semantic gate classification directly maps to the research synthesis's "structural-vs-semantic gate classification" finding. Evidence citations (claude-code-harness rule engine, arXiv rubber-stamp research) are accurate.
- Checkpoint-based resume correctly cites LangGraph per-step checkpoints and expedite's own execute-skill precedent as evidence.
- Agent formalization correctly references the official Claude Code subagent schema (12+ fields) and 5 repo examples.

**Concerns**:
- The SubagentStop hook for gate-verifier completeness checking is labeled as a design choice but the research synthesis flags this as speculative: "no surveyed repo uses SubagentStop for artifact validation." Proposal 1 does use it for completeness checking (not evaluation), which is a narrower claim, but it should be more explicit that this is an extrapolation, not an evidenced pattern.
- The proposal claims the override mechanism (writing `overridden: true` to gates.yml, recognized by PreToolUse hook) will work, but the research synthesis does not demonstrate this interaction pattern. The proposal does not flag this as beyond-research. This is a design invention, not a research finding.
- Agent persistent memory for research-synthesizer and gate-verifier is presented as a clear design choice, but READINESS.md rates agent persistent memory evidence as WEAK (official docs only, no repo demonstrates). Proposal 1 should be more cautious in its framing, noting that this is an experiment rather than an evidenced adoption.

### User Intent Fidelity

- **Three-layer separation**: Genuinely clean. The proposal defines clear responsibilities for each layer and the information flow diagram shows unidirectional flow (orchestration dispatches execution, enforcement gates writes). Skills at 100-200 lines are dispatchers. Agents carry full frontmatter. Hooks are structural barriers. This is three layers in substance, not just name.
- **Dual-layer gates**: Properly implements TWO independent layers. Structural rubric is code-enforced. Reasoning verifier is a separate agent. Both must pass. The layers are genuinely independent -- structural failing prevents semantic from running (an efficiency optimization, not a dependency).
- **Incremental hardening**: Seven increments with a clear dependency chain. Each increment has stated standalone value. The dependency chain is transparent. However, the ordering (hooks + state split first, then checkpoint + resume, then agents, then structural gates, then semantic gates, then context, then worktrees) front-loads the most foundational changes, which means the first increment is medium-effort rather than small. The user's preference for "see each improvement work before moving to the next" is respected.
- **Execute-only worktrees**: Properly scoped. Only task-implementer gets `isolation: worktree`. No scope creep.
- **Personal/team tool**: Configuration complexity (hook scripts, multi-file state, agent definitions) is appropriate for a solo developer who is the tool's own user.

### Evidence Honesty

- The proposal does not explicitly label evidence strength per decision (unlike Proposal 3). It presents design choices with evidence citations but without STRONG/MODERATE/WEAK/SPECULATIVE classifications. This makes it harder to distinguish research-backed choices from design-lens inferences. The claims are accurate, but the confidence gradient is implicit rather than explicit.
- The DX-framing ("developer experience moments" section) is valuable design work but is entirely speculative -- no research covers how developers experience agent harness enforcement. This is appropriate for a DX-lens proposal but should be recognized as design imagination, not evidence.

### Best Elements

- The information flow diagram is the clearest architectural visualization across all three proposals.
- The "Developer Experience Moments" section (starting a lifecycle, hitting a gate, resuming, getting blocked, overriding) is excellent design thinking that makes the architecture tangible.
- The `permissionDecisionReason` field usage for human-readable denial messages is a specific DX insight that the other proposals mention but do not develop as thoroughly.
- The distinction between state.yml (low write frequency, phase transitions) and checkpoint.yml (high write frequency, step transitions) is a well-reasoned design inference.

---

## Proposal 2 Assessment (Sustainability & Maintainability Lens)

### Research Alignment

**Strengths**:
- Correctly applies the "fewest moving parts" principle throughout. The decision to start with 3 hooks (PreToolUse, Stop, PreCompact) rather than 6 is justified by the observation that claude-code-harness achieves comprehensive enforcement with only 3 hook events. This is an accurate reading of the evidence.
- The YAML format retention is well-grounded: the research finding that "the differentiator is injection strategy, not format" is cited correctly, and the argument that switching formats adds migration cost with no demonstrated benefit is sound.
- The Node.js choice for hook scripts is supported by ECC's Node.js hook scripts and the argument against TypeScript build steps. The proposal correctly notes that claude-code-harness uses TypeScript (requiring compilation), while ECC uses Node.js (running directly).
- The decision to defer agent persistent memory is honest about the evidence: "No source demonstrates that agent persistent memory improves reliability for pipeline-style architectures." This is an accurate reading of READINESS.md, which rates agent memory evidence as WEAK.
- The checkpoint granularity decision (step-level, not sub-step) correctly cites LangGraph per-node as equivalent to per-step and expedite's existing execute-skill checkpoint as precedent.

**Concerns**:
- The decision to exclude SessionStart entirely (not just defer with fallback, but exclude from initial design) is more conservative than the research supports. The research says SessionStart bugs are a knowledge gap, not a confirmed blocker. ECC's root fallback pattern exists specifically to handle the uncertainty. Proposal 2 treats the uncertainty as a reason to avoid rather than a reason to build with fallback. This is a valid sustainability judgment but overstates the risk relative to the evidence.
- The claim that "agent hooks for gate evaluation would add 30-60 seconds of latency to every state write" is misleading. Agent hooks fire on the matched event, not on every Write. The design uses SubagentStop (not PreToolUse) for agent hooks in the other proposals -- SubagentStop fires when an agent completes, not on every Write. This appears to conflate two different hook patterns.
- The deferred list ("defer indefinitely: SessionStart, agent persistent memory") is more aggressive than the user's constraint C4 suggests. C4 says "SessionStart hook deferred due to 3 Claude Code platform bugs" -- but deferred implies eventual adoption once bugs are fixed, not indefinite avoidance. The sustainability lens may be over-indexing on risk aversion here.

### User Intent Fidelity

- **Three-layer separation**: Clean. The proposal defines explicit information flow contracts and the "critical constraint" (information flows downward, enforcement gates writes, agents never write state directly) is a strong architectural invariant. However, Proposal 2 states "agents have no direct access to state files for writing -- they produce artifacts, and the skill updates state." This is a stronger constraint than the user decision requires. The user asked for three-layer separation, not for agents to be unable to write state. This restriction may be beneficial for sustainability but it is an interpretation, not a direct user requirement.
- **Dual-layer gates**: Properly implemented. Structural rubric is code-enforced. Verifier agent provides reasoning evaluation. Both layers are independent. The cost analysis (5,000-15,000 tokens per semantic gate invocation, ~10,000-30,000 per lifecycle) is a useful sustainability-lens contribution.
- **Incremental hardening**: Nine migration phases (M1-M9), ordered by maintenance-burden reduction rather than by dependency chain or value delivery. The "recommended start: M1 + M2 as a bundle" is practical but slightly contradicts the "each increment stands alone" principle -- bundling two phases means neither is truly standalone. However, M1 and M2 are independently valuable, so the bundling is for efficiency rather than dependency.
- **Execute-only worktrees**: Properly scoped. Identical to the other proposals.
- **Personal/team tool**: The sustainability lens appropriately constrains complexity. The "do not add state surfaces unless you have a demonstrated need" principle is well-aligned with the solo-developer context.

### Evidence Honesty

- The proposal does not use explicit evidence-strength labels but is consistently conservative in claims. When it cites evidence, the citations are accurate. When it defers a feature, it explains why the evidence is insufficient. This implicit conservatism is honest but less transparent than Proposal 3's explicit labeling.
- The "what adds complexity without proportional value" section is excellent sustainability analysis but some items overstate the risk (SessionStart, agent hooks for gate evaluation) relative to the research evidence.

### Best Elements

- The "minimal viable agent schema" design (required vs. recommended vs. deferred fields) is the most practical agent formalization approach. The `disallowedTools` vs. `tools` guidance (use denylist for broad access minus dangerous tools, use allowlist for tightly restricted agents) is a valuable maintenance insight.
- The schema evolution strategy (add field with default, make optional, skills produce it, skills consume it, optionally make required) is the most detailed evolution path across all three proposals.
- The state debugging section ("cat the file, run the validator, check hook errors") makes the architecture tangible for maintenance.
- The cost-benefit matrix per migration phase (maintenance reduction, token savings, risk mitigation) is the strongest migration justification.
- The token budget management analysis provides concrete numbers for the state injection improvement (60-80% reduction).

---

## Proposal 3 Assessment (Evidence Lens)

### Research Alignment

**Strengths**:
- This proposal is the most faithful to the research evidence. Every major design choice includes explicit evidence-strength labels (STRONG, MODERATE, WEAK, SPECULATIVE, NONE) with specific source citations. This is the gold standard for research alignment transparency.
- The "Evidence Quality Map" table at the end is an exceptional contribution -- it maps every design element to its evidence strength, sources, confidence level, and key risk. No other proposal provides this level of traceability.
- The "What the Research Says" framing before each design section clearly separates evidence from interpretation. For example, the three-layer architecture section explicitly states: "No repo demonstrates a controlled comparison between two-layer and three-layer architectures. The evidence that three-layer is better is observational." This honesty about evidence limitations is exactly what the research synthesis calls for.
- The "Evidence-Supported vs. Speculative Gate Designs" table distinguishes between six evidence levels for gate-related design elements, correctly flagging "SubagentStop hook for automatic semantic verification" as SPECULATIVE. This is the only proposal that explicitly uses the word "speculative" for this design element.
- The "Where Evidence Is Weak" subsection in agent formalization correctly identifies per-agent hooks, agent persistent memory, and the agent-level `skills` field as weakly evidenced features.
- The explicit acknowledgment that thin-skill/thick-agent evidence is "observational, not experimental" and that the 100-200 line target is "extrapolated from one source" is commendably honest.

**Concerns**:
- The shell-first hook implementation choice (shell + `yq`, migrate to Node.js if needed) is the weakest design decision in this proposal AND the proposal honestly labels it as WEAK evidence. However, the proposal proceeds with this choice despite flagging it as weak, which is unusual for an evidence-lens approach. The acknowledged risk ("YAML parsing fragility in shell") is non-trivial for an enforcement layer that must be reliable. The other two proposals both choose Node.js/JavaScript, which has MODERATE evidence support (2 sources).
- The proposal rates G2 (Research) as "Structural + Light Semantic" with verifier agent involvement. This goes beyond what the research synthesis suggests for G2. The synthesis classifies G2's readiness assessment as structural (checking that readiness criteria are met), not semantic. Adding a verifier agent for G2 is a design extrapolation. However, the "readiness assessment quality" component does involve judgment about whether evidence is adequate, so the classification is defensible.
- The "Artifact validation via PreToolUse hooks" section is honestly flagged as MODERATE evidence ("reasonable extension of the state-guard pattern, but no surveyed repo does exactly this"). This is appropriate transparency.

### User Intent Fidelity

- **Three-layer separation**: Clean, with explicit evidence backing per layer. The proposal is the only one to note that the evidence for three-layer superiority is MODERATE (observational) rather than STRONG. This does not undermine the user's decision but contextualizes it honestly.
- **Dual-layer gates**: Properly implemented with the most detailed anti-rubber-stamp mechanism documentation. The three anti-rubber-stamp measures for the reasoning verifier (separate agent, structured output, explicit failure criteria) are individually cited with evidence levels. The proposal correctly notes that "explicit failure criteria" as an anti-rubber-stamp measure is WEAK evidence (extrapolated from bias research).
- **Incremental hardening**: Nine phases, with the most transparent risk assessment. Each phase has evidence level, dependencies, and reversibility documented. The sequencing (state splitting first, then checkpoint resume, then state write hook, then structural gates, then agent formalization, then skill thinning, then semantic verifier, then worktrees, then session continuity) prioritizes the evidence-strongest changes first.
- **Execute-only worktrees**: Properly scoped. Adds the detail of putting `EnterWorktree` in `disallowedTools` for non-execute agents to prevent accidental worktree creation -- a specific failure mode from the research.
- **Personal/team tool**: The evidence lens naturally avoids over-engineering by deferring weakly-evidenced features.

### Evidence Honesty

- This is the most evidence-honest proposal. Every design element is graded on evidence strength with specific source citations. Speculative elements are labeled as speculative. Knowledge gaps from the synthesis are explicitly acknowledged. The "Platform Assumptions That Could Be Wrong" section lists five foundational assumptions that could invalidate design elements -- no other proposal is this candid about platform risk.
- The "Gaps in Resume Evidence" section identifies three specific gaps (mid-step crash recovery, checkpoint write atomicity, agent-level checkpointing) with evidence assessments of NONE for each. This matches the knowledge gaps in the research synthesis.
- The evidence quality map makes it trivially easy for the synthesizer to identify which design elements rest on strong vs. weak evidence.

### Best Elements

- The evidence quality map is the single most valuable artifact for the synthesizer across all three proposals.
- The "What the Research Says" / "Design" / "Evidence Gaps" structure per section provides the clearest separation of evidence from interpretation.
- The explicit labeling of the shell-first hook choice as WEAK evidence, despite proceeding with it, demonstrates intellectual honesty -- the proposal acknowledges the tradeoff rather than hiding it.
- The "Areas Where the Design Extrapolates Beyond Research" section explicitly identifies three design inventions (artifact validation hooks, override + code-enforced gate interaction, checkpoint + session summary as dual mechanism) that no source demonstrates. This is the only proposal that systematically catalogs its own extrapolations.
- The platform assumptions section is essential risk documentation that the synthesizer should incorporate.

---

## Cross-Proposal Comparison

### Where All Three Agree (Strong Design Signal)

These areas have convergent agreement across all three proposals AND strong research evidence. The synthesizer should adopt these with high confidence:

1. **PreToolUse command hook on Write for state machine enforcement**: All three implement this as the highest-priority hook. Evidence: STRONG (3 harness implementations, official docs). This is the single most important design element.

2. **Five-file state split**: All three split state into the same five files (state.yml, checkpoint.yml, questions.yml, gates.yml, tasks.yml). The file names and contents are nearly identical across proposals. Evidence: STRONG (4+ convergent sources for directory-based state).

3. **G1/G4 as fully structural, code-enforced gates**: All three agree that G1 (Scope) and G4 (Plan) are deterministic structural checks with no LLM involvement. Evidence: STRONG (claude-code-harness rule engine, academic rubber-stamp research).

4. **G3/G5 as dual-layer (structural + verifier agent) semantic gates**: All three implement the same two-layer pattern with the same ordering (structural first, semantic second). Evidence: MODERATE (research taxonomy + Phase 24 concept, no repo demonstrates exact pattern).

5. **Checkpoint-based deterministic resume generalizing execute-skill pattern**: All three generalize checkpoint.yml to all skills with step-level granularity. Evidence: STRONG (LangGraph, expedite's own execute-skill precedent).

6. **Step-level checkpoint granularity (not sub-step)**: All three agree that checkpointing at step boundaries is sufficient, citing LangGraph per-node as equivalent to per-step. Evidence: STRONG.

7. **Worktree isolation for execute-only via `isolation: "worktree"` frontmatter**: All three implement this identically. Evidence: ADEQUATE (2 repos, official docs).

8. **Thin-skill/thick-agent boundary with enforcement in hooks**: All three adopt this pattern, with skills at 100-200 lines and agents carrying full frontmatter. Evidence: MODERATE (observational, not experimental).

9. **Model tiering with Sonnet default and Opus for synthesis/verification**: All three implement the same three-tier model strategy. Evidence: STRONG (4 independent implementations).

10. **YAML format retained for all state files**: All three keep YAML, citing the research finding that format is not the differentiator. Evidence: MODERATE.

### Where They Diverge (Research Ambiguity for Synthesizer to Resolve)

1. **SessionStart hook adoption**:
   - Proposal 1: Design with SessionStart, implement root fallback pattern. Uses it.
   - Proposal 2: Exclude entirely. Defer indefinitely.
   - Proposal 3: Design with SessionStart, implement fallback. Uses it but does not depend on it.
   - Research position: Knowledge gap (bug status unverified), non-blocking for design. ECC root fallback pattern exists.
   - Recommendation: Proposals 1 and 3 are closer to the research position. The research does not say "avoid SessionStart" -- it says "design with fallback." Proposal 2 over-interprets the risk.

2. **Agent persistent memory**:
   - Proposal 1: Enable for research-synthesizer and gate-verifier. Other agents stateless.
   - Proposal 2: Defer entirely. No agents get persistent memory.
   - Proposal 3: Experiment with research agents. Do not depend on it.
   - Research position: Evidence is WEAK (official docs only, no repo demonstrates). No source shows pipeline-architecture agents benefiting from persistent memory.
   - Recommendation: Proposal 3's framing (experiment, do not depend) is most evidence-appropriate. Proposal 1's confident enablement overstates the evidence. Proposal 2's full deferral is defensible.

3. **Hook implementation language**:
   - Proposal 1: Shell scripts (validate-state-write.sh, etc.)
   - Proposal 2: Node.js (validate-state-write.js, etc.)
   - Proposal 3: Shell + yq first, migrate to Node.js if needed.
   - Research position: ECC uses Node.js. claude-code-harness uses TypeScript. No source directly compares shell vs. Node.js for hook scripts.
   - Recommendation: Node.js (Proposal 2) is the most defensible choice. Two sources use it or similar. Shell YAML parsing (Proposals 1 and 3) introduces fragility that the enforcement layer should not have. The sustainability argument against TypeScript (build step) is sound.

4. **Hook count**:
   - Proposal 1: 6 hooks (PreToolUse, PostToolUse, PreCompact, SessionStart, Stop, SubagentStop).
   - Proposal 2: 3 hooks initially (PreToolUse, Stop, PreCompact), expand to 5 maximum.
   - Proposal 3: 6 hooks with evidence ratings per hook.
   - Research position: claude-code-harness uses 3 hooks. ECC uses hooks at all 4 lifecycle phases. Anti-pattern of over-blocking is documented.
   - Recommendation: Proposal 2's minimal-first approach is most aligned with the incremental hardening user decision. Start with 3, expand based on observed need.

5. **G2 (Research) gate classification**:
   - Proposal 1: Structural + Semantic (command hook + verifier agent)
   - Proposal 2: Structural only (code-enforced)
   - Proposal 3: Structural + Light Semantic (code-enforced for structure, verifier for readiness assessment quality)
   - Research position: The synthesis describes G2 checks as structural (file counts, section existence, per-DA evidence coverage). Readiness assessment is a judgment call about evidence sufficiency.
   - Recommendation: Proposal 2's fully-structural G2 is the most conservative and evidence-aligned interpretation. The readiness assessment quality check involves some judgment, but the READINESS.md format is sufficiently structured to be checkable deterministically (status fields, requirement coverage counts). If any semantic component exists, it should be minimal.

6. **Where agents live (file location)**:
   - Proposal 1: `.claude/agents/` directory
   - Proposal 2: Plugin's `agents/` directory
   - Proposal 3: `.claude/agents/` and/or plugin `agents/` directory
   - Research position: Official docs show priority ordering (CLI flag > project `.claude/agents/` > user `~/.claude/agents/` > plugin `agents/`). Both locations work.
   - Recommendation: The plugin's `agents/` directory (Proposal 2) keeps agents co-located with the plugin code and distributed together. `.claude/agents/` (Proposal 1) is the project-level location. For a plugin, the plugin `agents/` directory is the more natural choice per the official priority ordering.

7. **Migration sequencing**:
   - Proposal 1: Hooks + state split first, then checkpoint + resume, then agents, then structural gates, then semantic gates, then context, then worktrees (7 increments).
   - Proposal 2: State splitting first, then PreToolUse hook, then checkpoint resume, then agent formalization, then skill thinning, then structural gates, then semantic gates, then worktrees, then additional hooks (9 phases).
   - Proposal 3: State splitting first, then checkpoint resume, then state write hook, then structural gates, then agent formalization, then skill thinning, then semantic verifier, then worktrees, then session continuity (9 phases).
   - Research position: No evidence on optimal ordering. User prefers incremental.
   - Recommendation: All three orderings are valid. The key constraint is dependency chains. Proposal 2's ordering (state split before hooks) is arguably better because hooks need split state files to validate against. Proposal 1 bundles state split with hooks, which is efficient but larger as a single increment.

### Which Proposal Most Faithfully Represents the Research

**Proposal 3** is the most faithful to the research evidence. Its explicit evidence-strength labeling, systematic identification of extrapolations, and honest acknowledgment of evidence gaps make it the most trustworthy source for understanding what the research actually supports versus what is design inference. The evidence quality map alone makes it invaluable for the synthesizer.

However, Proposal 3's design choices are not always the best ones. The shell-first hook implementation is the weakest individual design decision across all three proposals (despite being honestly labeled as WEAK). Proposal 2 makes better practical decisions on several secondary topics (Node.js for hooks, minimal hook count, deferred memory) by applying the sustainability lens to the same evidence.

**For the synthesizer**: Use Proposal 3's evidence map as the truth source for what the research supports. Use Proposal 1's DX vision for how the architecture should feel. Use Proposal 2's practical decisions for how to keep it maintainable.

---

## Evidence Gaps That Affect Design

### Gaps Acknowledged by All Three Proposals

1. **SessionStart hook bug status**: All three note this gap. Impact: Determines whether SessionStart is a primary or fallback context-loading mechanism. Resolution: Test during implementation.

2. **Hook latency benchmarks**: All three use qualitative estimates (~100ms for command hooks). No quantitative data exists. Impact: If command hooks are slower than estimated, the PreToolUse-on-every-Write pattern may cause perceptible lag. Resolution: Measure during Phase 3 / M2.

3. **Checkpoint write atomicity**: None of the proposals can confirm whether Claude Code's Write tool is atomic. Impact: Partial checkpoint writes could corrupt resume state. All three proposals retain backup-before-write as defense-in-depth.

4. **Override + code-enforced gate interaction**: No source demonstrates overrides working with code-enforced gates. All three proposals propose the same solution (override record in gates.yml recognized by PreToolUse hook) but this is an untested design invention. Resolution: Validate during structural gate implementation.

### Gaps NOT Acknowledged by All Proposals

1. **Agent dispatching by name from plugins**: Proposals assume agents in the plugin's `agents/` directory can be dispatched by name. The research confirms agents are resolved from plugin directories but the dispatch-by-name mechanism from within a skill has not been explicitly verified. Only Proposal 3 lists this as a platform assumption that could be wrong.

2. **PreToolUse receiving full file content in tool_input**: All proposals assume hooks receive the proposed file content. Only Proposal 3 explicitly flags this as an assumption that needs verification. If the stdin JSON format differs from expectations, the entire state-guard hook pattern fails.

3. **Hook firing on agent-initiated writes**: The proposals assume that when an agent (subagent) uses the Write tool, the plugin-level PreToolUse hook still fires. This is architecturally expected (hooks are registered at the plugin level) but none of the proposals explicitly verify this. If hooks do not fire on subagent tool calls, the enforcement layer has a critical gap.

---

## User Intent Check

### Decision 1 (Three-Layer Separation): Honored in Spirit

All three proposals achieve genuine three-layer separation. The boundaries are clean: enforcement in hooks/scripts, orchestration in thin skills, execution in thick agents. The information flow is unidirectional (orchestration dispatches execution, enforcement gates writes). This is not three layers in name only -- each layer has distinct responsibilities, distinct file locations, and distinct modification patterns.

One nuance: the user accepted "the scope of restructuring" for three-layer separation. All three proposals acknowledge this is significant work (especially skill thinning). The incremental migration approach ensures the restructuring happens gradually, which honors the user's acceptance of scope while managing risk.

### Decision 2 (Dual-Layer Gates): Honored in Spirit

All three proposals implement TWO genuinely independent evaluation layers. The structural rubric is code-enforced (deterministic, no LLM). The reasoning verifier is a separate agent (different role, potentially different model). Both must pass independently. The user's existing Phase 24 verifier design concept is preserved and anchored in the harness architecture.

The user explicitly rejected multi-agent debate as "overkill for personal tool." All three proposals respect this -- none propose debate-style gate evaluation. The user's preference for two independent checks (not three or more) is honored.

### Decision 3 (Incremental Hardening): Honored in Spirit

All three proposals define increments that deliver standalone value. No increment secretly depends on future increments to be useful. The user's preference to "see each improvement work before moving to the next" is structurally supported by the dependency chains.

Minor concern: Proposal 1 bundles hooks and state splitting into a single increment ("Hook Infrastructure + State Splitting"), which is the largest individual increment across all three proposals. This is still incremental (one step at a time) but it is a larger step than the user might expect. Proposals 2 and 3 separate state splitting from hook implementation, which is more granular.

### Decision 4 (Execute-Only Worktrees): Honored in Spirit

All three proposals implement worktree isolation exclusively for execute-skill agents. No scope creep. Research agents, design agents, and all other agents write to `.expedite/` directories and do not get worktree isolation. The user's acceptance of manual merge-back is reflected in all three designs.

Proposal 3 adds a valuable detail: putting `EnterWorktree` in `disallowedTools` for non-execute agents to prevent accidental worktree creation. This is a defensive measure that strengthens the "execute-only" boundary.

### Constraint C3 (Personal/Team Tool): Honored

All three proposals accept configuration complexity (hook scripts, multi-file state, agent definitions, YAML schemas) as appropriate for a solo developer. None propose simplifications that would compromise capability. None propose enterprise-grade complexity (RAG integration, distributed consensus, event sourcing) that would be inappropriate.

### Combined Direction

The combined direction across all three proposals aligns with what the user wants: a hardened pipeline that prevents the three stated pain points (state drift, gate bypass, resume fragility) through code enforcement rather than prompt enforcement. The user is getting a system where invalid state transitions are structurally impossible, where quality gates cannot be rubber-stamped for structural criteria, and where resume is deterministic rather than heuristic. The system remains a personal tool with power-user configuration complexity, not a mass-market product with simplicity constraints.

---

## Critical Issues

### Issues That MUST Be Corrected

**None.** No proposal fabricates evidence, violates user intent, or makes claims contradicted by the research. The proposals are honest and well-grounded.

### Issues That SHOULD Be Addressed

1. **Proposal 1 should acknowledge override + code-enforced gate interaction as a design invention, not an evidenced pattern.** The override flow (write override record to gates.yml, PreToolUse recognizes it) is proposed by all three but evidenced by none. Proposal 1 presents it as part of the natural flow without flagging the evidence gap.

2. **Proposal 2 should soften the SessionStart "defer indefinitely" stance.** The research supports "design with fallback" (which Proposals 1 and 3 do), not "exclude entirely." The user's Constraint C4 says "SessionStart deferred due to bugs" -- deferred implies eventual adoption, not permanent exclusion. Proposal 2 conflates deferral with avoidance.

3. **Proposal 3 should reconsider the shell-first hook implementation.** The proposal honestly labels this as WEAK evidence but still adopts it. For an enforcement layer that must be reliable, choosing the weakest-evidenced implementation language is inconsistent with the evidence lens. Node.js (MODERATE evidence from ECC) is more appropriate.

4. **All proposals should verify the assumption that plugin-level hooks fire on subagent tool calls.** If PreToolUse hooks do not fire when a subagent uses the Write tool, the enforcement layer has a critical gap that undermines the entire "agents never bypass enforcement" invariant. This is the single most important platform assumption to verify early in implementation.

---

## Recommendations for Synthesizer

### Use Proposal 3's Evidence Map as the Foundation

The evidence quality map in Proposal 3 is the most rigorous assessment of what the research actually supports. Start from this map. When Proposals 1 and 2 make claims that exceed Proposal 3's evidence ratings, treat the higher claim with skepticism unless the evidence is re-verified.

### Adopt Design Choices Where All Three Agree

The 10 convergence points listed above (PreToolUse state guard, five-file state split, G1/G4 structural gates, G3/G5 dual-layer gates, checkpoint resume, step-level granularity, execute-only worktrees, thin-skill/thick-agent, model tiering, YAML retained) represent the strongest design signal. Adopt all 10 in the final design.

### For Divergence Points, Apply This Resolution Framework

For each divergence point, ask:
1. What does the research actually say? (Use Proposal 3's evidence rating.)
2. What does the user intent require? (Use user-decisions.md.)
3. Among the valid options, which is most conservative and maintainable? (Use Proposal 2's sustainability lens.)
4. Does the chosen option degrade developer experience? (Use Proposal 1's DX vision as a check.)

Applying this framework to the six key divergences:

| Divergence | Recommended Resolution | Rationale |
|-----------|----------------------|-----------|
| SessionStart | Design with fallback (Proposals 1/3) | Research supports fallback, not avoidance. User decision C4 says "deferred," not "excluded." |
| Agent memory | Experiment, do not depend (Proposal 3) | Evidence is WEAK. Proposal 1 overcommits. Proposal 2 is defensible but misses low-risk learning. |
| Hook language | Node.js (Proposal 2) | Two sources support it. Shell YAML parsing is too fragile for enforcement. |
| Hook count | Start with 3, expand to 5-6 (Proposal 2 approach) | Matches incremental hardening intent. Avoids over-blocking anti-pattern. |
| G2 classification | Primarily structural (Proposal 2) with optional light semantic check | Most research-aligned. Readiness criteria are largely checkable deterministically. |
| Agent location | Plugin `agents/` directory (Proposal 2) | More natural for plugin distribution. Co-located with plugin code. |

### Preserve Proposal 1's DX Vision in the Final Design

Proposal 1's "Developer Experience Moments" section should influence the final design's tone, even though the specific scenarios are design imagination rather than evidence. The key DX principles to carry forward:

- Denial messages should be human-readable and actionable (not just "denied")
- Resume should be reported to the developer before they ask ("resuming step 7 of 12")
- Overrides should be transparent (never silent)
- Hooks should be invisible when things are working

### Include Proposal 3's Risk Catalog

Proposal 3's "Platform Assumptions That Could Be Wrong" and "Areas Where the Design Extrapolates Beyond Research" sections are essential risk documentation. The final design should include a risk register that catalogs:
- Assumptions that need verification before implementation
- Design elements that extrapolate beyond research (with explicit labels)
- Evidence-weak decisions that may need revision after Phase 1 validation

### Flag the Hook-on-Subagent-Write Question for Immediate Investigation

Before committing to the "agents never bypass enforcement" invariant, verify that plugin-level PreToolUse hooks fire on subagent-initiated Write calls. If they do not, the enforcement architecture needs a fundamentally different approach for agent-originated state writes. This is the single highest-risk platform assumption across all three proposals.
