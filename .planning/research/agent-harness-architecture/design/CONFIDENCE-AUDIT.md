# Confidence Audit: Agent Harness Architecture

## Audit Summary

The agent harness architecture is an ambitious, well-researched design with a strong core and a few load-bearing assumptions that have zero production validation. The confidence distribution skews positive: roughly 60% of decisions are HIGH or ROCK SOLID (state splitting, structural gates, checkpoint resume, subagent coordination), 30% are MEDIUM (override mechanism, skill thinning targets, hook latency estimates), and 10% are LOW or SPECULATIVE (agent persistent memory, verifier anti-rubber-stamp effectiveness, PreToolUse firing on subagent writes). The former highest-risk item — PreToolUse hooks firing on subagent writes — has been **empirically confirmed** (2026-03-12). A project-level PreToolUse hook intercepted a subagent's Write call. Note: plugin-level hooks (`hooks/hooks.json`) did not load because the plugin is not in `enabledPlugins`; M1 should register hooks in both project settings and plugin hooks.json, then validate plugin-level hooks independently once registered. The strongest foundation is the state split + checkpoint resume + structural gates cluster, which rests on convergent evidence from 4+ independent systems and expedite's own proven checkpoint.yml pattern.

---

## Decision-by-Decision Ratings

### Architecture (Three-Layer Separation)

| # | Decision | Confidence | Evidence Basis | Key Assumption | Revision Trigger |
|---|----------|-----------|---------------|----------------|-----------------|
| 1 | Three-layer separation: Enforcement + Orchestration + Execution | HIGH | User decision. All 3 design proposals converge. claude-code-harness implements a comparable 3-layer pattern. | Skills can actually be thinned to 100-200 lines while retaining orchestration capability. | Skills cannot be reduced below 300+ lines without losing critical orchestration logic that does not fit cleanly into hooks or agents. |
| 5 | Lifecycle pipeline is fixed (scope-research-design-plan-spike-execute) | ROCK SOLID | User constraint. The harness hardens execution, not stage structure. | None -- this is a constraint, not a hypothesis. | User changes their mind about the pipeline. |

### Hooks

| # | Decision | Confidence | Evidence Basis | Key Assumption | Revision Trigger |
|---|----------|-----------|---------------|----------------|-----------------|
| 6 | PreToolUse command hook on Write as primary enforcement | HIGH | All 3 proposals converge. 3 harness implementations. Official docs confirm exit code 2 = deny. Round-3 architectural inference + official Claude Code docs (sub-agents, permissions pages) raise A1 likelihood to ~90%. Official docs show PreToolUse in subagent frontmatter, state subagents "inherit the permission context," and describe hooks as part of the tool call pipeline without main/subagent distinction. | Plugin PreToolUse hooks fire on subagent-initiated writes. Now rated ~90% likely — near-confirmed by official docs, awaiting empirical verification. | Hooks do NOT fire on subagent writes. This would require moving enforcement to agent-level hooks (per-agent hooks are additive per official docs) or restructuring the dispatch pattern. |
| 15 | Node.js for all hook scripts | HIGH | Cross-platform, testable, no build step. js-yaml for reliable YAML parsing. Shell YAML parsing is fragile. | Node.js startup time is acceptable for blocking hooks (~100-200ms). | Node.js cold start exceeds 500ms, creating perceptible lag on every state write. |
| 16 | Start with 4 hooks: PreToolUse, PostToolUse, PreCompact, Stop | HIGH | Minimal-first approach. Each hook has a clear, non-overlapping purpose. P2 proposed, P1/P3 conceded. | 4 hooks are sufficient to enforce all critical invariants. SessionStart not needed. | A critical enforcement scenario (e.g., session-start state corruption) is discovered that cannot be handled by the existing 4 hooks. |
| 17 | SessionStart deferred until platform bugs fixed | MEDIUM-HIGH | User constraint C4. 3 platform bugs documented. ECC "root fallback" exists. | Frontmatter injection is functionally equivalent to SessionStart for context loading. | Frontmatter injection proves insufficient for scenarios where state must be checked before ANY user interaction (e.g., detecting stale lifecycle before the user invokes a skill). |

### State Management

| # | Decision | Confidence | Evidence Basis | Key Assumption | Revision Trigger |
|---|----------|-----------|---------------|----------------|-----------------|
| 7 | Five-file state split: state.yml, checkpoint.yml, questions.yml, gates.yml, tasks.yml | ROCK SOLID | All 3 proposals converge on the same files. 4+ convergent sources for directory-based state. Aligns with planned ARCH-02-06. | The five files cover all state concerns without needing additional files during first implementation. | A state concern emerges that does not fit cleanly into any of the 5 files (unlikely -- the design includes audit.log and session-summary.md for ancillary needs). |
| 8 | YAML format retained for all state files | HIGH | All 3 proposals agree. Research finding: "the differentiator is injection strategy, not format." | LLMs continue to handle YAML comparably to JSON. No performance cliff with YAML. | A Claude Code update introduces YAML parsing bugs or JSON-specific optimizations that create a meaningful reliability gap. |
| 20 | Bundle state split + PreToolUse hook as first migration phase | ROCK SOLID | P1 proposed, P3 conceded. State splitting without hook validation creates an unprotected window. The two are co-dependent. | Both can be implemented in a single coherent phase without excessive scope. | The implementation scope of M1 proves too large to ship as one increment, forcing further decomposition. |

### Agents

| # | Decision | Confidence | Evidence Basis | Key Assumption | Revision Trigger |
|---|----------|-----------|---------------|----------------|-----------------|
| 12 | Subagent hub-and-spoke (not Agent Teams) | ROCK SOLID | All 3 proposals agree. Pipeline architecture fits hub-and-spoke. Agent Teams deferred (3-4x token cost). 5 repos demonstrate subagent patterns. | Expedite's pipeline never needs inter-agent communication during execution. | A genuine need for real-time coordination between agents emerges (e.g., parallel researchers discovering contradictory evidence that must be reconciled before synthesis). |
| 13 | Model tiering: Sonnet default, Opus for synthesis/verification | HIGH | All 3 proposals agree. 4 independent implementations use 3-tier model strategies. | Sonnet is capable enough for research, planning, and implementation tasks. Opus is not needed for "competent execution within clear parameters." | Sonnet quality degrades on complex research tasks, producing evidence that Opus agents routinely correct. |
| 18 | Agent persistent memory for synthesizer and verifier only | LOW-MEDIUM | Official docs only. No repo demonstrates per-agent persistent memory in a pipeline architecture. Explicitly labeled "experimental." | Persistent memory accumulates useful patterns rather than noise. MEMORY.md does not grow stale or misleading. | After 3 lifecycles, MEMORY.md content is noisy, stale, or degrades output quality. |
| 24 | Agents live in plugin `agents/` directory | HIGH | P2 proposed. Co-location with plugin code. Official priority ordering documented. | Plugin `agents/` directory is recognized and loaded by Claude Code. | Claude Code changes agent loading precedence or stops scanning plugin directories. |
| 25 | EnterWorktree in disallowedTools for all non-execute agents | HIGH | P3 proposed. Prevents known Claude Code behavior of accidental worktree creation. Negligible maintenance. | disallowedTools effectively prevents the Agent tool from creating worktrees. | Claude Code introduces a new worktree creation mechanism not covered by the EnterWorktree deny. |
| 26 | disallowedTools (denylist) for broad agents, tools (allowlist) for restricted | HIGH | P2 proposed. More maintainable as Claude Code adds tools. Allowlist only for gate-verifier. | Claude Code does not add dangerous tools that would slip through a denylist. | A newly added Claude Code tool poses risks for research/planning agents and is not on the denylist. |
| 27 | 8-10 formalized agents | MEDIUM | P3 proposed 8, P1 proposed 10. The exact count depends on scope/research agent needs. | The right granularity can be determined at design time without experimentation. | Agent boundaries are wrong -- some agents try to do too much, others are too thin to justify overhead. |

### Gates

| # | Decision | Confidence | Evidence Basis | Key Assumption | Revision Trigger |
|---|----------|-----------|---------------|----------------|-----------------|
| 9 | Structural gates (G1, G4) fully code-enforced | ROCK SOLID | All 3 proposals agree. claude-code-harness rule engine (R01-R09). Academic rubber-stamp evidence. | Scope and plan quality can be meaningfully assessed by structural checks (file existence, section presence, counts). | Structural checks pass but artifacts are substantively poor -- structural gates become a rubber stamp of a different kind (checking form, not substance). |
| 2 | Dual-layer rubric + reasoning for semantic gates (G3, G5) | HIGH | User decision. Matches Phase 24 verifier concept. Academic bias evidence supports independent layers. Round-3: structured rubric with score anchors (+10-15% accuracy) is at least as impactful as model separation (~10% self-preference reduction). Prompt engineering is the larger lever. | A separate verifier agent is meaningfully less susceptible to rubber-stamping than the producing agent. The rubric structure may matter more than agent separation. | The verifier agent exhibits the same leniency bias as self-evaluation, making the second layer pure token cost without quality improvement. |
| 19 | G2 classified as structural + light semantic | MEDIUM-HIGH | P1 and P3 agree, P2 conceded. Readiness assessment quality involves judgment. | Lightweight verifier check on evidence sufficiency ratings is enough -- G2 does not need full dual-layer treatment like G3/G5. | Readiness assessment ratings are frequently inaccurate despite structural checks passing, meaning G2's semantic component is too light. |
| 23 | gates.yml writes are hook-validated to prevent fabrication | MEDIUM | Identified by Validation 1 as critical issue. Design invention without ecosystem precedent. | An agent or skill could realistically attempt to write a fake gate result. The PreToolUse hook can detect fabrication by validating structure and phase-gate match. | The validation logic is too restrictive (false positives on legitimate gate writes) or too permissive (does not actually catch fabrication attempts). |

### Resume & Recovery

| # | Decision | Confidence | Evidence Basis | Key Assumption | Revision Trigger |
|---|----------|-----------|---------------|----------------|-----------------|
| 10 | Checkpoint-based deterministic resume generalized to all skills | ROCK SOLID | All 3 proposals agree. LangGraph per-node checkpoints. Expedite's own execute-skill checkpoint.yml. | Every skill can be decomposed into discrete steps with clean boundaries where checkpoints can be written. | Some skills have steps that are inherently non-discrete (e.g., iterative refinement loops) where a single checkpoint cannot capture state. |
| 11 | Step-level checkpoint granularity | HIGH | All 3 proposals agree. LangGraph per-node = per-step. Sub-step adds complexity without proportional benefit. | Step boundaries are granular enough for useful resume. Mid-step crashes are rare and tolerable. | Frequent mid-step crashes (e.g., during long agent dispatches) make step-level too coarse, and substep/continuation_notes are insufficient. |
| 21 | Only skills write checkpoint.yml (not agents, not hooks) | HIGH | P1/P3 proposed, P2 conceded. Maintains three-layer separation. Stop hook lacks step context. | Skills always complete the checkpoint write before yielding control. No race condition between skill and hook. | A timing issue causes the Stop hook to fire before the skill writes its final checkpoint, losing the latest state. |
| 22 | Stop hook writes session-summary.md only | HIGH | P1/P3 proposed, P2 conceded. Checkpoint (machine state) and summary (LLM orientation) serve different consumers. | The Stop hook has sufficient context to write a useful session summary even though it does not have the skill's step-level understanding. | Stop hook summaries are too generic to be useful for LLM orientation, making them dead weight in context. |

### Context & Memory

| # | Decision | Confidence | Evidence Basis | Key Assumption | Revision Trigger |
|---|----------|-----------|---------------|----------------|-----------------|
| -- | Scoped frontmatter injection per skill | HIGH | Derived from directory-based state pattern. Consumption matrix specifies per-skill file loading. | Frontmatter `!cat` commands reliably load files and gracefully handle missing files. | Frontmatter injection hits a size limit, timing issue, or reliability problem with `!cat` on missing files. |
| -- | PreCompact backs up checkpoint + writes session summary | MEDIUM | ECC demonstrates strategic compaction patterns. No direct precedent for this exact PreCompact behavior. | PreCompact fires reliably and with enough context to produce a useful summary. The hook has access to read the checkpoint file from disk. | PreCompact fires too late (after context is already lost) or the hook does not have filesystem access to read state. |

### Worktrees

| # | Decision | Confidence | Evidence Basis | Key Assumption | Revision Trigger |
|---|----------|-----------|---------------|----------------|-----------------|
| 4 | Worktree isolation for execute skill only | ROCK SOLID | User decision. Execute is the only skill modifying source code. 2 harness examples (ccswarm, agent_farm). `isolation: "worktree"` frontmatter field. | Other skills will never need to modify source code. | A future skill (e.g., refactoring) modifies source code and needs worktree isolation. |
| -- | Sequential merge-back, manual conflict resolution | MEDIUM | Design invention. Task design mitigates conflicts (each task targets specific files). | Tasks rarely produce merge conflicts because they target different files. | Tasks frequently conflict (e.g., shared utility files, config files, test helpers), making manual resolution a bottleneck. |

### Migration

| # | Decision | Confidence | Evidence Basis | Key Assumption | Revision Trigger |
|---|----------|-----------|---------------|----------------|-----------------|
| 3 | Incremental hardening, not full rebuild | HIGH | User decision. Each increment delivers standalone value. Lower risk. | Increments can be delivered independently without creating inconsistent intermediate states. | Intermediate states between migration phases create more confusion than a clean rebuild would. |
| -- | M1-M8 ordering with dependency chain | HIGH | Logical dependency analysis. M1 is foundational. M2/M3/M5 parallelize. M6 requires M3+M5. | The dependency analysis is correct and no hidden coupling exists between "independent" phases. | M3 (agent formalization) and M2 (checkpoint resume) turn out to be coupled -- agent dispatch changes affect how checkpoints are written. |
| 14 | Override mechanism (gates.yml override record recognized by PreToolUse hook) | MEDIUM | All 3 proposals agree on the principle. The specific mechanism is a design invention. No ecosystem precedent. Round-3 evidence: single-step denial recovery is >90% reliable, but the two-step override round-trip has a known weak link at ~70-85% (LLM forgetting to retry after writing override). | The round-trip (skill writes override to gates.yml, hook validates, skill retries state write, hook recognizes override) works reliably. Mitigable via denial reason quality and preamble training. | The two-write sequence is fragile -- the LLM fails to retry after the initial denial, or the hook's override recognition logic has edge cases. Round-3 identifies the "remember to retry" step as the specific weak link. |

---

## Strongest Decisions (Top 5)

### 1. Five-file state split (Decision 7) -- ROCK SOLID
The directory-based state pattern has convergent evidence from 4+ independent sources (LangGraph, CrewAI, ECC, claude-code-harness). All 3 design proposals converged on the same 5 files with the same contents. Expedite's own planned ARCH-02-06 split was already heading in this direction. The token savings (60-80%) are structural, not speculative. **For this to be wrong:** LLMs would need to handle monolithic state dramatically better than split state, or the 5-file boundary would need to be fundamentally wrong (the wrong concerns in the wrong files). Neither is plausible given the evidence.

### 2. Checkpoint-based deterministic resume (Decision 10) -- ROCK SOLID
LangGraph's per-node checkpoints are the gold standard for deterministic resume. Expedite already has a working checkpoint.yml in the execute skill. The research precisely diagnoses the current problem (current_step tracked but not used for resume) and the solution (read checkpoint directly). **For this to be wrong:** Skills would need to have fundamentally non-checkpointable state -- iterative loops or interactive conversations that cannot be captured at step boundaries. The design addresses this with substep and continuation_notes, but those are untested extensions.

### 3. Structural gates fully code-enforced (Decision 9) -- ROCK SOLID
The evidence that deterministic code eliminates rubber-stamping is both theoretically sound and empirically demonstrated (claude-code-harness R01-R09 rules). Academic research quantifies the rubber-stamp problem (~80% human alignment for single-model self-evaluation). Moving 3 of 5 gates to deterministic code is a clear, high-confidence improvement. **For this to be wrong:** Structural checks would need to be meaningless -- passing form checks while content is poor. This is a real but bounded risk, as structural gates are not the only quality mechanism.

### 4. Subagent hub-and-spoke coordination (Decision 12) -- ROCK SOLID
Expedite's pipeline architecture (each phase produces artifacts consumed by the next) is a textbook fit for hub-and-spoke. Agent Teams add 3-4x token cost for collaborative features that pipeline architectures do not need. 5 repos demonstrate subagent patterns. **For this to be wrong:** The pipeline would need to evolve into a genuinely collaborative workflow where agents must communicate during execution. The design explicitly defers Agent Teams for this scenario.

### 5. PreToolUse command hook on Write (Decision 6) -- HIGH
3 harness implementations use hooks for enforcement. Official docs confirm the mechanism (exit code 2 = deny, matcher regex, JSON response). All 3 proposals converge. The subagent hook-firing assumption (A1) has been raised to ~90% through round-3 architectural inference AND official Claude Code documentation showing PreToolUse hooks on subagent tool calls and permission context inheritance. **For this to be wrong:** The specific combination of plugin-registered hook + subagent-initiated tool call would need to behave differently from the documented patterns. This is now expected to pass as a confirmation step in M1.

---

## Weakest Decisions (Top 5)

### 1. Plugin PreToolUse hooks fire on subagent-initiated writes -- MEDIUM (revised from SPECULATIVE → LOW-MEDIUM → MEDIUM)
**The decision:** The "agents never bypass enforcement" invariant depends on plugin-level hooks intercepting writes made by subagents, not just the orchestrating skill.
**Why confidence has risen significantly:** Three layers of evidence now converge:
- **Official Claude Code documentation** (code.claude.com/docs/en/sub-agents): Shows PreToolUse hooks defined in subagent frontmatter that fire on subagent tool calls. States "subagents inherit the permission context from the main conversation." Per-agent hooks "only run while that specific subagent is active" — scoping language confirming the additive model.
- **Official permissions documentation** (code.claude.com/docs/en/permissions): "When Claude Code makes a tool call, PreToolUse hooks run before the permission system" — no distinction between main agent and subagent tool calls.
- **Round-3 architectural inference** (gap-hook-subagent-scope.md): Four converging lines — unified tool call pipeline, disallowedTools enforcement proves interception, additive hook model, SubagentStart/Stop lifecycle tracking.
- **No counter-evidence** exists across official docs, 8+ harness repos, and 3 rounds of gap research. Likelihood revised from ~60% → ~80% → ~90%.
**Why confidence remains below HIGH:** No source explicitly says "plugin-level PreToolUse hooks fire on subagent tool calls" in those exact words. The official docs show frontmatter-level PreToolUse on subagents and describe permission inheritance, but the specific combination (plugin-registered hook + subagent-initiated tool call) is inferred, not demonstrated. Empirical confirmation remains the final step.
**Testing to validate:** Dispatch a subagent that writes to a known file. Have a PreToolUse hook that logs intercepted writes. Check whether the subagent's write appears in the log. This test is now expected to PASS as a confirmation of documented behavior.
**Suggested validation approach:** Build a minimal test plugin with one hook and one agent in the first hour of M1.
**Fallback design:** If hooks do NOT fire on subagent writes, move enforcement to per-agent hooks (using the `hooks` frontmatter field — official docs confirm these fire on subagent tool calls) or restructure so agents return results to skills which then write state.

### 2. Override mechanism round-trip reliability -- MEDIUM
**The decision:** When a gate blocks, the skill writes an override record to gates.yml, the hook validates it, then the skill retries the state.yml write and the hook recognizes the override.
**Why confidence is lower:** This is a design invention with no ecosystem precedent. Round-3 research (gap-denial-retry-patterns.md) partially fills this gap: simple denial patterns are production-tested (>90% single-step correction reliability), but the two-step override round-trip has a specific weak link at step 3→4 -- after writing the override record, the LLM may "move on" instead of retrying the original state write (~70-85% estimated reliability). The denial itself works; the "remember to retry" step is the vulnerability.
**Key mitigations from round-3:** (1) Denial reason must include explicit retry instruction, (2) skill preamble must describe the override protocol before the first denial is encountered, (3) hook should track denial count and suggest user intervention after the 3rd denial for the same pattern. The denial reason string is the critical design surface -- vague reasons produce poor recovery, specific actionable reasons produce reliable recovery.
**Testing to validate:** Manually trigger the full override round-trip in a test scenario. Measure: Does the LLM correctly interpret the denial? Does it write a valid override? Does it retry the state write? Vary the denial reason wording and measure impact. Test at different context window fullness levels.
**Suggested validation approach:** Build the override flow during M1 and test with 5+ manual override scenarios before committing to the pattern.
**Fallback design:** Simplify to a single-write override: the skill writes to state.yml with an inline override field that the hook recognizes, eliminating the two-file round-trip. Alternatively, have the hook itself validate gate passage (check artifact existence and criteria) and allow the write directly when validation passes, reserving the override mechanism only for edge cases where hook validation is too strict.

### 3. Agent persistent memory value (Decision 18) -- LOW-MEDIUM
**The decision:** research-synthesizer and gate-verifier get `memory: project` for cross-lifecycle learning.
**Why confidence is lower:** Evidence is WEAK (official docs only). No repo demonstrates per-agent persistent memory in a pipeline architecture. The design itself labels this "experimental" and provides explicit criteria for retention (evaluate after 3 lifecycles). The risk is not failure but wasted effort -- memory may accumulate noise that degrades rather than improves output.
**Testing to validate:** Run 3 lifecycles with memory enabled. Inspect MEMORY.md for accuracy, relevance, and signal-to-noise ratio. Compare synthesis/gate quality across lifecycles.
**Suggested validation approach:** The design already specifies this. Just follow through.
**Fallback design:** Disable memory. The system functions identically without it.

### 4. Verifier agent anti-rubber-stamp effectiveness -- MEDIUM
**The decision:** A separate gate-verifier agent (Opus, read-only tools) evaluates semantic quality independently from the producing agent, with structured per-dimension scoring and explicit failure criteria.
**Why confidence is lower:** Round-3 research (gap-verifier-effectiveness.md) quantifies the picture: self-preference bias is ~0.3-0.5 points on a 5-point scale (~10% relative), eliminated by cross-model judging (Zheng et al. 2023, Panickssery et al. 2024). However, the overall LLM judge accuracy ceiling is ~80% agreement with human preferences, not raised by model separation alone. Structured rubric with score anchors provides +10-15% accuracy improvement -- at least as impactful as model separation and achievable with or without a separate agent. Chain-of-thought evaluation adds +5-10%. Few-shot calibration with known-bad examples reduces leniency by 5-10%. Multi-agent debate adds +5-15% on objective tasks but less on subjective quality assessment (expedite's gates are partially subjective), at 3-5x token cost. The 55% likelihood estimate remains appropriate -- the verifier helps but prompt engineering carries more weight.
**Testing to validate:** Run the verifier on known-bad artifacts (intentionally weak designs). Measure: Does it catch the intentional issues? Compare verifier scores against the developer's own assessment.
**Suggested validation approach:** Before building the full dual-layer system (M6), create 5-6 artifacts spanning the full quality range (2 clearly bad, 2 borderline, 2 clearly good) to calibrate the pass/fail threshold and measure verifier accuracy. This is more informative than the original 3-artifact proposal. If the verifier does not meaningfully outperform a well-structured inline rubric, the fallback still captures 75-80% of the benefit at lower cost.
**Fallback design:** Replace the separate verifier agent with a structured self-evaluation rubric that the producing skill runs inline. Round-3 evidence suggests this fallback is stronger than previously assessed -- the prompt engineering techniques (rubric anchors, explicit failure criteria, chain-of-thought, few-shot calibration) deliver the largest measurable improvements and work in both configurations. Reserve the separate verifier for high-stakes gates only (G3 design quality).

### 5. Skill thinning to 100-200 lines (implied by Decision 1) -- MEDIUM
**The decision:** Skills shrink from 500-860 lines to 100-200 lines by moving business logic to agents and enforcement to hooks.
**Why confidence is lower:** The 100-200 line target is a design aspiration, not evidence-derived. claude-code-harness has thin skills, but its skills solve simpler problems than expedite's (5 verb skills vs. 6 multi-step lifecycle skills). Expedite's scope skill has 9 steps with conversational logic, adaptive refinement, and convergence loops. Moving ALL of this to agents while keeping the skill as a "dispatcher" may require the agent to handle complex interactive conversations that subagents are not designed for (subagents run and return, they do not hold multi-turn conversations with the user).
**Testing to validate:** Attempt to thin one skill (the simplest one, not scope) to 200 lines. Measure: Does it work? What logic could not be moved? What is the actual line count?
**Suggested validation approach:** During M4, thin the plan skill first (likely the simplest). If it lands at 200-300 lines rather than 100-200, adjust the target upward. The architecture survives at 300 lines per skill.
**Fallback design:** Accept 200-400 line skills as the realistic range. The three-layer architecture still works -- skills are just thicker dispatchers.

---

## Assumption Register

| # | Assumption | Likelihood Correct | Impact if Wrong | How to Validate |
|---|-----------|-------------------|----------------|----------------|
| A1 | Plugin PreToolUse hooks fire on subagent-initiated Write calls | **CONFIRMED (2026-03-12).** Empirically validated via project-level hook. Plugin-level hooks not yet tested (plugin not in `enabledPlugins`). Register in both locations during M1; validate plugin hooks independently once registered. | CRITICAL -- breaks the enforcement invariant. **Risk resolved.** | ~~Test in first hour of M1.~~ Done. Remaining: validate plugin-level hooks fire after adding plugin to `enabledPlugins`. |
| A2 | Node.js cold start is <200ms for blocking hooks | Likely (85%) | MEDIUM -- perceptible lag on every state write. 5-15 writes per skill run = 1-3 seconds of hook latency. | Measure actual hook latency during M1 on first 100 writes. |
| A3 | LLMs reliably handle the deny-override-retry sequence | Plausible (65%) — round-3 gap-denial-retry-patterns.md partially fills: single-step denial recovery >90%, but two-step override round-trip ~70-85% due to "forget to retry" weak link. Mitigable via denial reason quality and preamble training. | HIGH -- override mechanism fails in practice. Developer must manually intervene to complete overrides. The "remember to retry" step is the specific vulnerability. | Test 5+ override scenarios during M1. Vary denial reason wording. Test at different context fullness levels. Build retry counter into hook (suggest user intervention after 3rd denial). |
| A4 | Frontmatter `!cat` commands reliably load files and handle missing files | Likely (80%) | MEDIUM -- state injection fails silently or noisily, breaking context loading for all skills. | Already in use (verify existing behavior is reliable). |
| A5 | A separate Opus verifier is meaningfully less susceptible to rubber-stamping than inline evaluation | Plausible (55%) — round-3 gap-verifier-effectiveness.md quantifies: model separation eliminates ~10% self-preference bias, but structured rubric (+10-15%) and chain-of-thought (+5-10%) are larger accuracy levers. The verifier helps, but prompt engineering carries more weight. | MEDIUM -- dual-layer gates cost tokens without proportional quality improvement over a single-layer rubric. Fallback (structured inline rubric) is stronger than previously assessed. | Test verifier on 5-6 artifacts spanning full quality range (2 bad, 2 borderline, 2 good) before M6. Compare verifier accuracy against well-structured inline rubric to measure the marginal value of agent separation. |
| A6 | Stop hook has sufficient context to write a useful session summary | Likely (75%) | LOW -- session summaries are generic/useless, adding context noise. checkpoint.yml still works for resume. | Inspect first 5 session summaries for usefulness. |
| A7 | The 5-file split covers all state concerns without needing additional files | Very likely (90%) | LOW -- add a 6th file. Schema evolution strategy handles this gracefully. | Monitor during first 2 lifecycles post-M1. |
| A8 | Skills can be decomposed into discrete steps with clean checkpoint boundaries | Likely (80%) | MEDIUM -- some skills have iterative/conversational flows that resist step decomposition. checkpoint.yml substep + continuation_notes may be insufficient. | Test on scope skill (most conversational, hardest to decompose). |
| A9 | Structural gates (checking form) are a meaningful proxy for quality | Likely (75%) | LOW-MEDIUM -- structurally valid artifacts may still be substantively poor. But structural gates are not the only quality mechanism. | Track how often structurally passing artifacts require significant rework in the next phase. |
| A10 | Execute task worktrees rarely produce merge conflicts | Likely (70%) | LOW -- manual conflict resolution is a fallback, not a crisis. Task design mitigates by targeting specific files. | Track conflict frequency across first 5 execute phases. |
| A11 | Subagent nesting limitation (agents cannot spawn agents) does not affect expedite | Very likely (90%) | LOW -- expedite's design has skills dispatch agents, not agents dispatch agents. | Verify the constraint exists and document it. |
| A12 | Agent persistent memory does not accumulate noise that degrades output | Unknown (50%) | LOW -- memory is experimental. Disabling it has zero impact on system function. | Inspect MEMORY.md after 3 lifecycles per design criteria. |
| A13 | The incremental migration phases (M1-M8) do not create problematic intermediate states | Likely (75%) | MEDIUM -- intermediate states where some enforcement exists but not all could create confusion. | Evaluate system coherence after each migration phase. |

---

## Recommended Testing Priorities

### 1. PreToolUse hook fires on subagent writes — CONFIRMED (2026-03-12)
**Result:** PASSED. A project-level PreToolUse hook intercepted a subagent's Write call to `/tmp/subagent-wrote-this.txt`.
**Remaining:** Plugin-level hooks (`hooks/hooks.json`) did not load because the plugin is not in `enabledPlugins`. During M1, register hooks in both project settings and plugin hooks.json. After adding the plugin to `enabledPlugins`, remove project settings hooks and verify plugin hooks fire independently.
**Test setup documented in:** `memory/a1-validation-result.md`

### 2. Override round-trip works end-to-end (HIGH, test during M1)
**What to test:** The full deny-override-retry sequence: PreToolUse denies a state write, the skill writes an override to gates.yml, the skill retries the state write, PreToolUse recognizes the override and allows it.
**What you are looking for:** The LLM (a) correctly interprets the denial message, (b) writes a structurally valid override, (c) retries the original write without needing developer intervention. Round-3 identifies step (c) as the specific weak link (~70-85% reliability) -- the LLM may "move on" after writing the override instead of retrying.
**Key test variables (from round-3):** Vary the denial reason wording (vague vs. specific with explicit retry instruction). Test at different context window fullness levels (retry-forgetting risk increases under context pressure). Verify that the gates.yml write is not itself denied by the PreToolUse hook (would create a deadlock).
**Confirms:** Override mechanism works as designed. Proceed.
**Triggers redesign:** LLM fails to complete the round-trip >30% of the time. Simplify to single-write override, command-based override, or have the hook itself validate gate passage and allow directly.
**Minimum viable test:** Manual test with one gate and one override scenario. 1 hour.

### 3. Hook latency is acceptable (MEDIUM, measure during M1)
**What to test:** End-to-end latency of PreToolUse command hooks (Node.js startup + YAML parsing + validation + response).
**What you are looking for:** p50 < 200ms, p99 < 500ms.
**Confirms:** Latency estimates in design are accurate. No perceptible lag.
**Triggers redesign:** p50 > 500ms. Consider caching, lighter validation, or moving some checks out of the critical path.
**Minimum viable test:** Log timestamps in hook scripts for 50+ writes. 15 minutes of instrumentation.

### 4. Verifier agent catches known-bad artifacts (MEDIUM, test before M6)
**What to test:** Dispatch gate-verifier on 5-6 artifacts spanning the full quality range (2 clearly bad, 2 borderline, 2 clearly good). This expanded range (revised from 3 per round-3 calibration literature) tests both sensitivity (catching bad) and specificity (passing good).
**What you are looking for:** Verifier correctly identifies flaws in bad artifacts, flags concerns in borderline artifacts, and passes good artifacts. Compare against a well-structured inline rubric (same prompt, no separate agent) to measure the marginal value of agent separation vs. prompt engineering alone.
**Confirms:** Dual-layer semantic gates add real value beyond what a structured inline rubric achieves. Proceed with M6.
**Triggers redesign:** Verifier does not meaningfully outperform inline rubric, or misses most flaws, or produces generic "looks good" evaluations. Fall back to structured inline rubric (round-3 evidence suggests this captures 75-80% of the benefit at lower cost) or invest in prompt engineering (rubric anchors, few-shot calibration, chain-of-thought) before committing to agent separation.
**Minimum viable test:** Create 5-6 artifacts, dispatch verifier, evaluate results, compare against inline rubric baseline. 3 hours.

### 5. Scope skill can be thinned to <200 lines (MEDIUM, test during M4)
**What to test:** Attempt to thin the scope skill by moving conversational logic, refinement loops, and question generation to agents. Measure the resulting line count.
**What you are looking for:** Skill lands at or below 200 lines while maintaining the full user experience.
**Confirms:** 100-200 line target is realistic. Three-layer separation works for complex interactive skills.
**Triggers redesign:** Skill cannot go below 350 lines without breaking the conversation flow. Adjust target to 200-400 lines and accept thicker dispatchers.
**Minimum viable test:** Thin one simpler skill (plan) first as a proof of concept. 1 day.

### 6. PreCompact hook fires with filesystem access (LOW-MEDIUM, test during M8)
**What to test:** Does the PreCompact hook have read access to checkpoint.yml and write access to session-summary.md?
**What you are looking for:** Hook successfully reads state from disk and writes the summary file.
**Confirms:** PreCompact-based context preservation works.
**Triggers redesign:** Hook lacks filesystem access or fires too late. Move summary writing into skill logic triggered by a compaction signal.
**Minimum viable test:** One PreCompact hook that reads and writes a file. 30 minutes.

### 7. Session summary usefulness (LOW, evaluate after M8)
**What to test:** Are Stop hook session summaries useful for LLM orientation on the next session?
**What you are looking for:** The LLM correctly identifies phase, step, and next action from the summary without reading checkpoint.yml.
**Confirms:** Session summaries add value as a context mechanism.
**Triggers redesign:** Summaries are too generic. Either improve the Stop hook's context or remove session-summary.md from frontmatter injection (checkpoint.yml is sufficient).
**Minimum viable test:** Inspect 5 session summaries across 2 lifecycles. 30 minutes.

---

## Architecture Stress Test

### Scenario 1: Happy Path -- Full Lifecycle Without Interruption

**Walkthrough:** Developer runs scope (steps 1-9), each step writes checkpoint.yml. Scope completes, skill writes state.yml transition to scope_complete. PreToolUse fires, checks G1 in gates.yml, finds passing result, allows transition. Developer runs research. Research agents (web-researcher, codebase-researcher) dispatch as subagents, write evidence to .expedite/evidence/. Research-synthesizer aggregates. G2 gate evaluates (structural + light semantic). Process continues through design (G3 dual-layer), plan (G4 structural), spike (G5 dual-layer), execute (worktree isolation).

**Assessment:** The happy path flows cleanly. Each layer has a clear responsibility. State transitions are validated. Gates fire at the right boundaries. The checkpoint trail is complete. No architectural issues in the happy path.

**Potential friction points:**
- The first lifecycle will be slow as the developer learns the override mechanism and gate feedback messages.
- Model tiering decisions may need adjustment -- if Sonnet research agents produce weak evidence, the developer will need to promote them to Opus or adjust prompts.
- Worktree merge-back during execute is the only manual step that could surprise the developer.

**Verdict:** The architecture handles the happy path well. This is expected -- happy paths are rarely where architectures fail.

### Scenario 2: Context Reset Mid-Skill (Research, Step 7)

**Walkthrough:** Developer is running research. 3 of 5 web researchers have been dispatched. Context resets (session ends, compaction, crash).

**Recovery sequence:**
1. Stop hook fires (if clean session end) and writes session-summary.md.
2. Developer returns. Invokes `/expedite:research`.
3. Skill frontmatter loads state.yml (phase: research_in_progress), checkpoint.yml (skill: research, step: 7, substep: waiting_for_agents, continuation_notes: "3 of 5 dispatched, remaining: DA-4, DA-6"), and session-summary.md.
4. Skill reads checkpoint, determines resume at step 7.
5. Skill checks which researcher output files exist (secondary artifact check).
6. Skill dispatches remaining 2 researchers only.

**Assessment:** This is the design's strongest recovery scenario. The checkpoint has the exact step, substep, and continuation notes. The skill knows which agents remain. Resume is deterministic.

**Potential issues:**
- If a researcher was dispatched but crashed before writing its output, the skill will re-dispatch it (correct behavior -- idempotent).
- If the context reset happened DURING a researcher's execution (not between dispatches), the checkpoint still says step 7 with "3 dispatched." The subagent may have written partial output. The skill needs to detect partial artifacts (file exists but is incomplete). The design mentions artifact-existence checks but does not specify partial-artifact detection. **This is a gap:** mid-agent crashes leave ambiguous artifacts. The continuation_notes field can help, but the skill must be written to handle partial outputs.
- If the Stop hook does NOT fire (crash, not clean exit), session-summary.md is stale. checkpoint.yml is still accurate (written at last step boundary). The skill can still resume correctly from checkpoint alone -- session-summary.md is supplementary, not essential.

**Verdict:** Resume works for the common case (clean session end, between-step interruption). The edge case of mid-agent crashes with partial artifacts is acknowledged but not fully resolved. The design's fallback to artifact-existence heuristics provides degraded-mode handling, which is acceptable.

### Scenario 3: Gate Failure With Override

**Walkthrough:** G3 (Design quality) rejects the design. Developer overrides.

**Detailed flow:**
1. Design skill completes. Skill writes state.yml with phase: design_complete.
2. PreToolUse hook fires. Reads state.yml transition: design_in_progress -> design_complete. Required gate: G3. Reads gates.yml -- G3 entry exists with outcome: no-go.
3. Hook denies write (exit 2). Reason: "G3 gate has not passed. G3 result: no-go."
4. Claude relays denial to developer with the reason.
5. Developer: "Override G3, the design is sufficient for this project's complexity level."
6. Skill writes to gates.yml: {gate: G3, outcome: overridden, override_reason: "...", severity: medium, timestamp: "..."}.
7. PreToolUse hook on gates.yml validates structure: override_reason present, valid gate ID, valid severity. Allows write.
8. PostToolUse audit hook logs the override to audit.log.
9. Skill retries writing state.yml with phase: design_complete.
10. PreToolUse hook fires again. Reads gates.yml -- G3 entry now has outcome: overridden. Allows transition.
11. State advances. Developer sees: "G3 overridden. Override logged. Design phase complete."

**Assessment:** The audit trail is complete: gates.yml has the override record with reason and severity, audit.log has the timestamp. State advances correctly. The flow is logically sound.

**Potential issues:**
- **Step 4-5 is the critical moment.** The LLM must correctly interpret the denial, understand the developer wants to override, and write the correct override structure to gates.yml. If the LLM writes an invalid override (missing reason, wrong gate ID), the gates.yml PreToolUse hook catches it -- but then we are in a deny-deny loop where the developer may lose patience. The skill instructions need to include the exact override format as a template.
- **Step 9 requires the LLM to retry the exact same write.** After processing the denial, override, and audit, the LLM must remember to retry the state.yml write. In a long conversation, this retry may be lost. The skill should explicitly instruct: "After writing the override, immediately retry the state transition."
- **The gates.yml file now has TWO G3 entries** (the original no-go and the override). The PreToolUse hook must read the LATEST entry, not the first. The design does not specify how the hook selects the relevant entry from the history array. It should be the most recent entry for the required gate.

**Verdict:** The flow works but has LLM-reliability risks at steps 4-5 (interpreting denial correctly) and step 9 (remembering to retry). The gates.yml history-reading logic needs a clear specification for selecting the most recent entry. These are implementation-level fixes, not architectural problems.

---

## Recommended Checkpoints

### After M1 (State Split + PreToolUse Hook)

**Pause and evaluate:**
- Does the PreToolUse hook fire on ALL Write calls to .expedite/ state files, including subagent-initiated writes? (A1)
- What is the actual hook latency? (A2)
- Does the override round-trip work? (A3)
- Are there false positives (valid writes incorrectly blocked)? Track the rate.
- Does the five-file split feel right, or is a 6th file needed? (A7)

**Decision criteria:**
- Continue if: hook fires on subagent writes, latency < 300ms p99, override works >70% of the time, false positive rate < 10%.
- Adjust if: latency is high (optimize Node.js startup or cache parsed state), override reliability is low (simplify mechanism), false positives are frequent (loosen validation).
- Stop and redesign if: hooks do not fire on subagent writes. This invalidates the architecture.

### After M2 (Checkpoint Resume)

**Pause and evaluate:**
- Does resume from checkpoint produce the correct step for all 6 skills?
- Does the substep + continuation_notes mechanism handle mid-step context well enough?
- Is step-level granularity sufficient, or are there steps where finer granularity would help?

**Decision criteria:**
- Continue if: resume success rate > 90% across 2+ lifecycles.
- Adjust if: specific skills have low resume accuracy -- investigate those skills' step decomposition.
- Redesign if: resume is fundamentally unreliable -- investigate whether the checkpoint is stale or the skill is not reading it correctly.

### After M3 + M4 (Agent Formalization + Skill Thinning)

**Pause and evaluate:**
- What are the actual skill line counts after thinning?
- Do agents with tool restrictions behave correctly? Any unexpected denials?
- Is the dispatch pattern clear and maintainable?
- Do agents produce artifacts of comparable quality to the previous prompt-template approach?

**Decision criteria:**
- Continue if: most skills < 300 lines, agent quality is comparable or better, tool restrictions work.
- Adjust if: skills are 300-500 lines (acceptable, adjust target), or agent quality is lower (improve agent instructions).
- Redesign if: the three-layer separation creates more confusion than it solves -- skills and agents have unclear responsibilities.

### After M5 + M6 (Structural + Semantic Gates)

**Pause and evaluate:**
- Do structural gates (G1, G4) catch real issues? Or do they pass everything?
- Does the verifier agent provide actionable feedback on semantic gates (G3, G5)?
- What is the gate override rate? (Target: < 20%)
- What is the verifier rubber-stamp rate? (Target: < 10% trivial passes)

**Decision criteria:**
- Continue if: structural gates catch at least some issues, verifier provides actionable feedback, override rate < 30%.
- Adjust if: override rate > 30% (criteria too strict -- loosen thresholds), verifier is too lenient (improve prompt or add debate pattern).
- Redesign if: gates provide no useful signal -- all pass trivially or all fail and require override. Re-examine what "quality" means for each gate.

### After M7 + M8 (Worktree + Session Handoff) -- Full Architecture

**Pause and evaluate:**
- Run a complete lifecycle with the full architecture.
- Measure total token cost vs. pre-architecture baseline.
- Measure total developer time vs. pre-architecture baseline.
- Assess: does the architecture make the developer's life easier or harder?

**Decision criteria:**
- Continue refining if: the architecture clearly prevents the three pain points (state drift, gate bypass, resume fragility) and does not significantly increase developer friction.
- Simplify if: the architecture adds friction that outweighs its benefits. Identify which layers add the most friction and simplify or remove them.

---

## Overall Confidence Statement

This is a well-grounded architecture with one critical unknown, several testable hypotheses, and a solid evidence base for its core mechanisms. The five-file state split, checkpoint-based resume, structural gate enforcement, and subagent coordination are all HIGH or ROCK SOLID confidence -- they rest on convergent evidence from multiple independent systems and, in the case of checkpoint resume, on expedite's own proven pattern. These core mechanisms should be built as designed.

The former highest risk — PreToolUse hooks firing on subagent writes (A1) — has been **empirically confirmed** (2026-03-12). The enforcement invariant holds. The remaining hook concern is operational: plugin-level hooks require the plugin to be in `enabledPlugins`; during M1, register hooks in project settings as the primary enforcement path and plugin hooks.json as the target state.

The primary remaining risk cluster is LLM reliability in the enforcement interaction loop, specifically the override round-trip (A3). Round-3 research identified the specific weak link: after writing an override record, the LLM may fail to retry the original state write (~70-85% estimated reliability for two-step recovery). This is mitigable through denial reason quality, preamble training, and a retry counter, but the override mechanism remains a design invention without ecosystem precedent. Build it with the round-3 mitigations, test it thoroughly, and have a simpler fallback ready.

The weakest evidence areas -- agent persistent memory and verifier anti-rubber-stamp effectiveness -- are both explicitly experimental in the design and have clear evaluation criteria. Neither is load-bearing. If they fail, the system works without them. Round-3 research on A5 quantifies the picture: model separation eliminates ~10% self-preference bias, but structured prompt engineering (rubric anchors +10-15%, chain-of-thought +5-10%, few-shot calibration 5-10%) is the larger accuracy lever. The fallback of a well-structured inline rubric is stronger than previously assessed.

The recommended approach: Build M1 with aggressive testing of assumptions A1-A3 in the first day. If those hold, the architecture has a strong foundation. Proceed through M2-M5 with the checkpoint evaluations described above. Defer M6 (semantic gates) until the verifier is tested against intentionally flawed artifacts. Ship M7-M8 as low-risk enhancements. The incremental migration strategy is the design's strongest risk mitigation -- each phase delivers standalone value, and failures at any phase are contained.
