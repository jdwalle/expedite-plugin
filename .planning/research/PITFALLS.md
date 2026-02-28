# Pitfalls: Expedite Plugin Development

**Research Date:** 2026-02-27
**Domain:** Claude Code plugin with multi-phase lifecycle orchestration, subagent dispatch, state management, and quality gates
**Downstream Consumer:** Roadmap and planning phases -- each pitfall informs phase sequencing, risk mitigation, and testing priorities

---

## P1: Research SKILL.md Orchestration Overload -- The 11-Step Monolith

**Category:** SKILL.md orchestration complexity
**Severity:** CRITICAL -- this is the single highest-risk component in the design
**Phase Impact:** Execute (implementation), but must be addressed during Plan (architecture)

**The Pitfall:** The research SKILL.md contains an 11-step sequential orchestration flow (entry validation, mode detection, source-affinity batching, prompt construction, parallel dispatch, progress reporting, dynamic question discovery, sufficiency assessment, synthesis, gate evaluation, state update) in a single markdown file. No reference implementation has a SKILL.md this complex. Research-engine's equivalent is simpler (dispatch, collect, synthesize). The confidence audit rates this MEDIUM and calls it "the most complex single-file orchestration in the design." When Claude executes a long multi-step prompt, it commonly: skips middle steps, re-executes early steps, conflates similar steps (e.g., sufficiency assessment and gate evaluation), or loses track of which step it is on.

**Warning Signs:**
- During initial testing, the research skill completes steps 1-5 (dispatch) but skips step 7 (dynamic question discovery) or step 8 (inline sufficiency assessment)
- Claude starts re-batching questions after already dispatching agents (re-executing step 3)
- The sufficiency assessment and gate evaluation merge into a single undifferentiated block rather than distinct operations
- Steps that require distinct actions (regex extraction in step 7, per-question categorical evaluation in step 8) are replaced with vague narrative summaries

**Prevention Strategy:**
1. **Plan phase:** Structure the research skill implementation as a "try monolith first, split on failure" sequence. Define the split points in advance: dispatch+collect (sub-skill 1), assess+synthesize (sub-skill 2), gate (sub-skill 3). Document these as pre-planned fallback, not reactive debugging.
2. **Execute phase:** After implementing the monolithic SKILL.md, run 3 end-to-end research cycles before moving on. Track which of the 11 steps execute, which are skipped, and which are conflated. Use the confidence audit's decision criteria: >80% step completion across >80% of runs = keep monolith; 60-80% = split into 2 sub-skills; <60% = split into 3.
3. **Prompt engineering:** Number every step explicitly ("STEP 7 OF 11: Dynamic Question Discovery"). Include step-completion markers that force Claude to acknowledge each step ("After completing step 7, write: 'STEP 7 COMPLETE: [N] proposed questions found.'"). Place the hardest steps (7 and 8) in prominent positions, not buried in the middle.

**What the Confidence Audit Says:** "If the LLM struggles, the backlog already identifies the mitigation: split research into sub-invocations (e.g., `/expedite:research` dispatches agents, a second invocation handles synthesis + gating)." This mitigation should be architecturally pre-planned, not discovered during debugging.

---

## P2: Self-Grading Bias in Inline Gates

**Category:** Gate design
**Severity:** HIGH -- undermines the entire quality assurance system if undetected
**Phase Impact:** Execute (testing priority #2 per confidence audit)

**The Pitfall:** The design uses inline gates where each skill evaluates its own output (user decision D1). The producing agent grades its own work. LLMs exhibit a well-documented self-grading bias: the same agent that produced content will systematically rate it more favorably than an independent evaluator would. This is especially dangerous for G2 (research sufficiency) and G3 (design quality), which require LLM judgment rather than structural checks. If gates always pass on first attempt, they provide false assurance and the developer loses trust in the quality system.

**Warning Signs:**
- G2 or G3 passes on first attempt for every lifecycle (100% first-pass rate when the design targets 60-80%)
- MUST criteria involving LLM judgment (e.g., "Design addresses all P0 questions") always evaluate as PASS with thin justification
- Gate evaluation output is perfunctory ("All criteria met") rather than containing substantive per-criterion evidence
- Developers start ignoring gate output because it never surfaces actionable findings

**Prevention Strategy:**
1. **Plan phase:** Include a "gate calibration" task after the first 3 complete lifecycles. Compare inline gate results against an independent evaluation of the same artifacts (run the gate evaluation prompt on a fresh Claude session without the production context).
2. **Execute phase:** Implement the gate evaluation prompt with explicit anti-bias instructions: "Evaluate as if this output was produced by someone else. Your default assumption should be that criteria are NOT met until you find specific evidence otherwise." Force the evaluation to produce per-criterion evidence strings, not just PASS/FAIL.
3. **Structural defense:** G1 and G4 are primarily structural checks (file existence, field validation) and are immune to self-grading bias. Ensure these gates remain structural. For G2 and G3, require the evaluation to quote specific passages from artifacts as evidence for each PASS judgment. Vague justifications ("the design is comprehensive") should not count.
4. **Monitoring:** Track first-pass gate approval rate in log.yml. If it exceeds 90% after 5 lifecycles, gates are too lenient -- either criteria are too weak or self-grading bias is at work.

---

## P3: State.yml Corruption Through LLM Complete-File Rewrite

**Category:** State management
**Severity:** HIGH -- data loss, lifecycle corruption
**Phase Impact:** Execute (implement early with defensive patterns)

**The Pitfall:** The design specifies complete-file rewrite for every state.yml update. The LLM reads the current state, modifies it in-memory, and writes the entire file back. This is the correct approach (partial updates risk YAML syntax corruption), but it introduces a different failure mode: the LLM may silently drop fields, re-format arrays, change quoting, modify values it was not asked to change, or collapse multi-line structures into single lines. Every write is an opportunity for drift. With 15+ questions each having 8 metadata fields, a single rewrite that drops one question's `evidence_files` field can silently corrupt research tracking.

**Warning Signs:**
- Questions disappear from state.yml after a skill writes other fields
- Field values change type (string becomes unquoted, `null` becomes empty string, array becomes string)
- `version` or `lifecycle_id` fields change unexpectedly
- state.yml line count changes significantly when only one field should have been updated
- backup diff (state.yml vs state.yml.bak) shows changes to fields that the current operation should not have touched

**Prevention Strategy:**
1. **Execute phase (early):** Implement and test the backup-before-write pattern from the very first skill. Before any state.yml write, copy to state.yml.bak. After every write, validate the output: count questions, verify all expected fields exist, check that the `version` field is unchanged.
2. **Prompt engineering:** In every SKILL.md that writes state, include explicit preservation instructions: "When updating state.yml, preserve ALL existing fields exactly as they are. Only modify the specific fields listed below. Do NOT reformat, re-quote, or reorganize other fields." Include a post-write verification step: "After writing state.yml, read it back and verify: (a) question count matches expected, (b) all fields are present, (c) version field is unchanged."
3. **Schema validation (lightweight):** After each write, run a structural check: count questions, verify required fields (id, text, priority, status) exist for each question, verify phase is a valid value from the enumeration. This can be a Bash one-liner with grep/wc or a simple YAML parse.
4. **Template anchoring:** Include the state.yml schema as a comment block at the top of the file, so the LLM has the schema visible when rewriting. This reduces the chance of field omission.

---

## P4: Context Reconstruction Failure After /clear

**Category:** Context reconstruction
**Severity:** HIGH -- workflow continuity depends on this
**Phase Impact:** Execute (implement all three layers in the first wave)

**The Pitfall:** Context reconstruction after `/clear` depends on three independent layers: (1) SessionStart hook, (2) dynamic `!cat` injection in SKILL.md, (3) manual `/expedite:status`. The design correctly treats this as defense-in-depth. The pitfall is building and testing only one layer during initial development, discovering the others are needed only when the first fails, and implementing them reactively without testing the fallback chain. Three specific risks:

- **SessionStart hook has 3 open bugs** (#16538, #13650, #11509). The hook may silently fail to inject context. If the only layer tested during development is the hook, all post-/clear usage breaks when those bugs manifest.
- **Dynamic `!cat` injection** depends on undocumented behavior of the `!command` syntax in SKILL.md. If Claude Code changes how `!command` is processed, this layer fails silently (the command is ignored, not errored).
- **`/expedite:status`** is the most reliable layer (it is just reading files) but is also the only one requiring explicit user action. If developers do not know to run it, they lose context.

**Warning Signs:**
- After `/clear`, Claude does not know which lifecycle phase is active
- Claude asks "What would you like to do?" instead of offering phase-aware guidance
- The SessionStart hook output appears in some sessions but not others (intermittent bug manifestation)
- Developers report confusion after resuming interrupted sessions

**Prevention Strategy:**
1. **Plan phase:** Sequence context reconstruction as a wave-1 task. All three layers must be implemented before any other skill is considered functional.
2. **Execute phase:** Test each layer independently. Verify: (a) hook output appears on fresh session start with active lifecycle, (b) `!cat` output is visible in SKILL.md content when invoked, (c) `/expedite:status` correctly reconstructs state from artifacts. Test the complete failure chain: disable hook (rename hooks.json), clear session, invoke a skill -- does `!cat` provide sufficient context?
3. **Documentation:** The first line of any user-facing output should reference `/expedite:status` as the recovery command. Build muscle memory early.

---

## P5: Subagent Prompt Context Explosion

**Category:** Subagent reliability
**Severity:** MEDIUM-HIGH -- degrades research quality and increases cost
**Phase Impact:** Execute (prompt template implementation)

**The Pitfall:** Each research subagent starts with ~50K tokens of overhead (global configuration, MCP tool descriptions, system prompt). The design targets ~5K token prompts for research agents. But the prompt must inline: the batch of questions (with full text, priority, context, gap_details), source configuration, output file path, intent lens, circuit breaker instructions, dynamic question discovery instructions, and the output format specification. For a batch of 5 questions with gap details and MCP source config, the inlined prompt easily exceeds 5K tokens. When the total per-agent context (overhead + prompt) approaches model limits, the agent produces lower-quality output, truncates evidence, or ignores later questions in the batch.

**Warning Signs:**
- Research agents consistently ignore the last 1-2 questions in a batch
- Evidence quality degrades for questions that appear later in the prompt
- Dynamic question discovery instructions are ignored (they are typically at the end of the prompt)
- Agent returns are significantly longer than the 1,000-2,000 token target (agent ignores condensed return instructions buried in a long prompt)

**Prevention Strategy:**
1. **Plan phase:** Budget token counts for each prompt template. Calculate: base template tokens + per-question tokens + per-source-config tokens. If a batch of 5 questions exceeds 5K tokens, reduce batch size to 3-4.
2. **Execute phase:** During prompt template implementation, measure actual token counts for realistic prompts. Use a reference lifecycle (10 questions, 3 sources) and calculate per-batch prompts. Adjust batch sizing if prompts exceed budget.
3. **Prompt architecture:** Place the highest-priority content (questions, output format) at the beginning and end of the prompt. Place lower-priority content (dynamic question discovery, circuit breaker details) in the middle. This follows Anthropic's "long documents at the top, queries at the end" guidance.
4. **Fallback:** If prompts consistently exceed budget, simplify: remove dynamic question discovery from subagent prompts (handle it in orchestrator via post-hoc evidence analysis instead) or move circuit breaker logic to a simpler "if tool fails, note it and move on" instruction.

---

## P6: Source-Affinity Batching Algorithm Edge Cases

**Category:** SKILL.md orchestration complexity
**Severity:** MEDIUM -- affects research quality but does not break the system
**Phase Impact:** Execute (research skill implementation)

**The Pitfall:** Source-affinity batching is a novel algorithm with no reference implementation. Research-engine dispatches per-category (simple, proven). The expedite design groups questions by source requirements into 3-5 batches, merges small batches (<2 questions), and splits large batches (>5 questions). The algorithm has several edge cases:

- **Cross-source questions:** A question with `source_hints: ["web", "codebase", "mcp:github"]` belongs to all three batch types. Does it go in the first matching batch? All matching batches (duplicated)? The largest batch?
- **MCP-heavy configurations:** With 5+ MCP sources, questions may fragment into many small batches that then get aggressively merged, producing batches where the agent has tools for 3 different MCP servers but no guidance for any specific one.
- **Gap-fill re-batching:** The design says gap-fill mode re-batches by "decision area affinity" instead of original source affinity. But a question's decision area has no inherent relationship to the best source type for finding the missing evidence.
- **Empty batches:** After filtering for gap-fill (only NOT COVERED and PARTIAL questions), a batch type may have zero questions, leaving unused agent slots.

**Warning Signs:**
- Questions appear in multiple batch prompts (duplicated research effort)
- A batch contains questions requiring tools that the assigned agent does not have
- Batching produces more than 5 batches (exceeding the 3-concurrent-agent limit, adding latency)
- Gap-fill research re-investigates already-COVERED questions

**Prevention Strategy:**
1. **Plan phase:** Specify the batching algorithm as pseudocode with explicit handling for each edge case: cross-source assignment, small-batch merging, large-batch splitting, gap-fill re-batching.
2. **Execute phase:** Test batching with three scenarios: (a) simple case (10 questions, 2 sources), (b) cross-source case (questions with 2-3 source hints each), (c) MCP-heavy case (questions targeting 3+ MCP servers). Verify batch count is 3-5, no question is orphaned, and each batch has clear tool assignments.
3. **Simplicity fallback:** If the algorithm proves too fragile, fall back to research-engine's simpler per-source-type batching (one web batch, one codebase batch, one MCP batch) regardless of question count per batch. Simpler is more reliable.

---

## P7: Freeform Micro-Interaction Parsing Ambiguity

**Category:** Prompt template design
**Severity:** MEDIUM -- affects UX and flow control, not data integrity
**Phase Impact:** Execute (skill implementation across all interactive phases)

**The Pitfall:** The design uses freeform prompts instead of AskUserQuestion for most user interactions (to avoid the 60-second timeout). Interactions like "yes / pause / review", "changes / proceed", "yes / modify / add questions" require the LLM to parse natural language responses into one of a small set of actions. Users do not type the exact expected keywords. They type "looks good", "let me think", "can you change the third question", "hold on", "go ahead", "sure", "nah let me revise it", etc. If parsing fails, the skill takes the wrong action (e.g., interprets "let me think" as "yes" and proceeds).

**Warning Signs:**
- The skill proceeds when the user intended to pause
- Ambiguous responses like "maybe" or "I need to think about it" cause the skill to halt with an unclear prompt
- The skill asks the user to clarify repeatedly, creating friction
- Users learn they must type exact keywords, complaining that the interaction feels rigid

**Prevention Strategy:**
1. **Execute phase (prompt engineering):** Design freeform parsing prompts that are maximally generous. Map broad categories: "yes/proceed/go/continue/looks good/approved/ship it/sure/ok" -> proceed. "pause/stop/wait/hold on/let me think" -> pause. Anything that mentions specific changes -> change request. The catch-all default should be the safest action (proceed for non-destructive interactions, pause for destructive ones).
2. **Explicit display:** Always display the exact options with clear labels: "Continue? Type 'yes' to proceed, 'pause' to save and stop, or 'review' to see progress." This nudges users toward parseable responses.
3. **Fallback parsing:** If the response does not clearly match any category, echo back the interpretation: "I understood that as 'proceed'. Is that correct?" This adds one round-trip but prevents misinterpretation.
4. **Confidence audit alignment:** The confidence audit rates freeform parsing at assumption A8 (75% likelihood correct, LOW impact if wrong) and recommends falling back to "treat any response as 'yes'" if >10% are unparseable. This is a reasonable degradation.

---

## P8: Prompt Template Conditional Section Leakage

**Category:** Prompt template design
**Severity:** MEDIUM -- produces incorrect output format, confuses downstream consumers
**Phase Impact:** Execute (prompt template implementation)

**The Pitfall:** The design uses single templates with conditional `<intent_lens>` sections for product/engineering adaptation. A single `prompt-design-guide.md` contains both product-specific instructions ("produce a PRD with personas, user stories, flows") and engineering-specific instructions ("produce an RFC with context, goals, detailed design"). The LLM must respect the active intent and ignore the inactive conditional section. In practice, content from the inactive section leaks: an engineering lifecycle produces a design that includes "Personas" alongside "Detailed Design," or a product lifecycle includes "Alternatives Considered" (an RFC convention). The leakage is subtle -- the output looks reasonable but confuses downstream phases that expect a specific format.

**Warning Signs:**
- Engineering DESIGN.md includes product-specific sections (personas, user stories, success metrics in Given/When/Then format)
- Product PRD includes engineering-specific sections (alternatives considered, cross-cutting concerns, implementation plan)
- Plan output mixes epic/story format with wave/task format
- HANDOFF.md is generated for engineering-intent lifecycles (should be product-only)

**Prevention Strategy:**
1. **Execute phase (prompt template design):** Use strong XML delimiters for conditional sections: `<if_intent_product>...</if_intent_product>` and `<if_intent_engineering>...</if_intent_engineering>`. Include explicit instruction: "You are in {intent} mode. IGNORE all content within `<if_intent_{other}>` tags. Do NOT include any section or vocabulary from the inactive intent."
2. **Structural guard:** In the output format section, list the EXACT sections expected for the current intent. For engineering: "Your output MUST contain these sections and ONLY these sections: Context, Goals, Non-Goals, Detailed Design, Alternatives Considered, Cross-Cutting Concerns." For product: "Your output MUST contain these sections and ONLY these sections: Problem Statement, Personas, User Stories, Flows, Success Metrics, Scope Boundaries."
3. **Testing:** Run one product lifecycle and one engineering lifecycle during initial testing. Verify output contains only intent-appropriate sections. This is a quick sanity check but catches the most common leakage.
4. **Fallback:** If leakage persists despite prompt engineering, split into separate templates (prompt-design-product.md, prompt-design-engineering.md). The confidence audit notes this as a viable fallback: "Separate templates avoid the leakage risk at the cost of duplication."

---

## P9: Dynamic Question Discovery as Noise Generator

**Category:** SKILL.md orchestration complexity
**Severity:** MEDIUM-LOW -- additive feature, fails gracefully
**Phase Impact:** Execute (research skill implementation)

**The Pitfall:** Research subagents are instructed to propose new questions via a `# --- PROPOSED QUESTIONS ---` YAML block. The orchestrator extracts these via regex, deduplicates via LLM judgment, and presents up to 4 via AskUserQuestion. The risks:

- **Low-quality proposals:** Subagents propose questions that are variants of existing questions, too broad ("What are best practices for X?"), or off-topic. The deduplication step catches exact duplicates but not semantic duplicates.
- **Regex extraction fragility:** If the subagent formats the YAML block slightly differently (different indentation, missing markers, using a different header), extraction fails silently and no questions are proposed.
- **Scope creep:** Each accepted question adds research work. If 3 new questions are accepted per round, and there are 2 research rounds, the lifecycle grows from 10 to 16 questions, pushing state.yml past the 100-line target and extending research duration.

**Warning Signs:**
- Proposed questions are variants of existing ones ("How should we implement auth?" when "How should the OAuth2 flow be implemented?" already exists)
- Zero questions are ever proposed (extraction is broken)
- Developers always accept all proposed questions (not curating)
- Lifecycle scope grows significantly through discovery, extending research time

**Prevention Strategy:**
1. **Execute phase:** Treat dynamic question discovery as a non-critical feature. Implement it, but do not block on it. If regex extraction fails in testing, simplify the marker format or remove the feature entirely.
2. **Prompt engineering:** In the researcher prompt, constrain proposals: "Propose at most 2 questions that are NOT covered by any existing question. Each proposed question must address a specific gap you discovered during research, not a general topic." Include an anti-duplication instruction: "Do NOT propose questions that are rephrased versions of existing questions."
3. **Hard cap:** The design already caps at 4 presented questions. Add a per-lifecycle cap of 5 discovered questions total across all rounds to prevent unbounded scope growth.
4. **Confidence audit alignment:** The audit rates this at assumption A10 (50% likelihood proposals are useful, LOW impact if wrong) and recommends disabling if acceptance rate <20%. This is the right approach -- treat it as an experiment.

---

## P10: Recycle Escalation as Dead Code

**Category:** Gate design
**Severity:** MEDIUM-LOW -- affects developer experience, not system integrity
**Phase Impact:** Execute (gate evaluation implementation)

**The Pitfall:** The design specifies recycle escalation: 1st recycle is informational, 2nd suggests scope adjustment, 3rd recommends override. This is a well-designed UX pattern with no reference precedent. The pitfall is that it may never trigger because: (a) developers override on the first recycle (assumption A4 estimates 50% chance developers accept recycle outcomes), (b) gap-fill research successfully resolves issues on the first recycle, or (c) gates are too lenient (self-grading bias, P2) and never produce recycle outcomes. If the escalation path is never exercised, it is dead code that adds complexity to gate logic and state tracking without providing value.

**Warning Signs:**
- After 10 lifecycles, no gate has reached recycle count 2
- Override rate exceeds 50% (developers bypass rather than iterate)
- Recycle escalation messages are never seen by users

**Prevention Strategy:**
1. **Plan phase:** Implement recycle escalation as a low-priority task. The core gate logic (Go/Recycle/Override) must work first. Escalation messaging can be added after the gate system is stable.
2. **Execute phase:** Track recycle counts in log.yml from the start. After 5 lifecycles, check whether any gate reached count 2+. If not, defer escalation UX work.
3. **Simplification:** If escalation proves to be dead code, simplify to: 1st recycle = informational + "you can override with --override." Remove the progressive messaging. This reduces prompt complexity in gate evaluation.

---

## P11: hooks.json Schema Uncertainty

**Category:** Plugin infrastructure
**Severity:** MEDIUM -- binary pass/fail, quick to resolve
**Phase Impact:** Execute (wave 1, first task -- verify before building anything else)

**The Pitfall:** The design uses `hook_type`/`script` as field names in hooks.json, but the three design proposals disagreed on naming (`hook_type`/`script` vs `type`/`command` vs `event`/`script`). The confidence audit rates this LOW. If the field names are wrong, the SessionStart hook silently fails to register. Since the hook is not the only context reconstruction layer, this failure is recoverable but wastes debugging time if not caught immediately.

**Warning Signs:**
- SessionStart hook never fires on any session
- No error message (wrong schema is silently ignored, not errored)
- Context reconstruction relies entirely on `!cat` injection and `/expedite:status`

**Prevention Strategy:**
1. **Execute phase (wave 1, task 1):** Build a minimal test plugin with hooks.json and verify the hook fires. Test all three naming conventions if the first does not work. This is the confidence audit's testing priority #3 ("Quick Win") and should take less than 30 minutes.
2. **Implementation:** Once the correct schema is verified, document the working field names in a comment within hooks.json itself for future reference.

---

## P12: log.yml Append Replaced by LLM Full Rewrite

**Category:** State management
**Severity:** MEDIUM -- data loss in telemetry, not in critical state
**Phase Impact:** Execute (telemetry implementation)

**The Pitfall:** The design uses `cat >>` Bash append for log.yml to prevent accidental LLM rewrite. But LLMs have a strong tendency to read a file, modify it, and write the entire contents back. If any skill invocation reads log.yml and then writes it (instead of appending), all prior telemetry entries may be lost or corrupted. The design includes a "do NOT rewrite" instruction in SKILL.md, but prompt-level constraints are not 100% reliable over long sessions.

**Warning Signs:**
- log.yml contains fewer entries than expected for the number of lifecycle events
- Entries from earlier phases disappear after later phases run
- log.yml file size decreases after a skill invocation

**Prevention Strategy:**
1. **Execute phase:** Implement the `cat >>` pattern as a Bash command within the SKILL.md instructions. Make the append operation a specific, copy-pasteable code block: `cat >> .expedite/log.yml << 'EOF'\n---\nevent: ...\nEOF`. This is harder for the LLM to "improve" by rewriting.
2. **Defensive check:** After each append, verify log.yml line count is >= the previous count. If it decreased, restore from backup or log a warning.
3. **Low priority:** Telemetry is a nice-to-have feature. If append reliability proves problematic, defer log.yml to v1.1. The core lifecycle works without it.

---

## P13: Synthesis Agent Input Scale Beyond Token Window

**Category:** Subagent reliability
**Severity:** MEDIUM -- affects research quality in large lifecycles
**Phase Impact:** Execute (research skill implementation)

**The Pitfall:** The synthesis agent reads all evidence files and produces SYNTHESIS.md organized by decision area. For a typical lifecycle (10 questions, 3 batches), input is manageable (~15-20K tokens). But for a complex lifecycle (20 questions, 5 batches, 2 gap-fill rounds), the synthesis agent must read: 5 initial evidence files + round-2 supplement files + round-3 supplement files + initial SYNTHESIS.md + round-2 supplement-synthesis.md. Total input can exceed 50K tokens. The agent uses opus (high-context model), but prompt quality degrades as input length increases -- the synthesis becomes less organized, misses cross-references, or drops evidence from later-read files.

**Warning Signs:**
- SYNTHESIS.md does not reference evidence from later batches
- Questions from later batches have thinner synthesis sections
- Gap-fill supplement syntheses repeat findings already in the initial synthesis
- The synthesis agent's condensed return mentions only findings from the first 2-3 evidence files

**Prevention Strategy:**
1. **Plan phase:** Set a soft ceiling of 15 questions per lifecycle, enforced in scope (G1 SHOULD criterion: "No more than 15 questions"). This keeps evidence volume manageable.
2. **Execute phase:** For gap-fill rounds, implement additive synthesis (the design specifies this): the supplement synthesis reads ONLY the new evidence + the existing SYNTHESIS.md summary, not all raw evidence. This bounds input growth.
3. **Monitoring:** Track synthesis agent prompt size. If it exceeds 40K tokens, log a warning and consider whether the lifecycle should be narrowed.

---

## P14: Execute Phase -- /clear Loses Implementation Context

**Category:** Context reconstruction
**Severity:** MEDIUM -- affects execution continuity, not data integrity
**Phase Impact:** Execute (execute skill implementation)

**The Pitfall:** During the execute phase, Claude is actively modifying code -- it has context about file structures, variable names, architecture decisions, and in-progress changes. A `/clear` destroys all this context. The checkpoint.yml and PROGRESS.md provide state recovery (which task to resume from), but they do not capture the rich implementation context (why a particular approach was chosen, what alternatives were tried, what the current code structure looks like). The "fresh agent with context" pattern means resumption often leads to: repeated exploration of already-understood code, different architectural choices than the previous session, or re-implementation of partially completed work.

**Warning Signs:**
- After resume, Claude re-reads files it already modified in the previous session
- Resumed implementation takes a different approach than the interrupted session
- Partially completed tasks are restarted from scratch rather than continued
- Developer has to re-explain decisions that were already made

**Prevention Strategy:**
1. **Execute phase:** Enrich checkpoint.yml with implementation context: not just "current_task: t03" but also "continuation_notes: Completed auth middleware using PKCE approach. Files modified: Sources/Auth/AuthMiddleware.swift, Sources/Auth/PKCEFlow.swift. Next step within t03: wire up the token refresh endpoint." The design already includes `continuation_notes` -- ensure it is populated with sufficient detail.
2. **Prompt engineering:** In the execute SKILL.md, include a checkpoint-writing instruction: "When updating checkpoint.yml, include a 2-3 sentence summary of the approach taken, files modified, and the specific next action. This will be read by a fresh session that has no prior context."
3. **Git as context:** After each task completion, the committed code provides context. The resume flow should read the git log for recent commits as supplementary context: "Recent commits: [list]. These provide context for the current implementation approach."

---

## P15: Overriding Gates Renders the Entire Quality System Meaningless

**Category:** Gate design
**Severity:** MEDIUM -- affects long-term value proposition, not immediate functionality
**Phase Impact:** Plan (design the override mechanism carefully)

**The Pitfall:** The design allows overriding both MUST and SHOULD failures (decision #14). The intent is developer agency -- developers should never be blocked by their own tool. But the override mechanism has no friction beyond `--override`. If override becomes the default response to any gate friction, gates degrade into speed bumps rather than quality checks. The confidence audit estimates 50% probability that developers accept recycle outcomes (assumption A4) and recommends investigating if override rate exceeds 30%.

**Warning Signs:**
- Override rate exceeds 30% of gate evaluations
- Developers use `--override` preemptively (before seeing gate results)
- Gate evaluation output is not read -- developers go straight to override
- Design quality or research completeness degrades in overridden lifecycles

**Prevention Strategy:**
1. **Plan phase:** Ensure override requires the developer to see the gate evaluation results before the override takes effect. The override records severity in gate_history, which means the developer sees "You are overriding 2 MUST failures: [list]. This gap context will be injected into the next phase." This provides informed consent.
2. **Execute phase:** Inject overridden gap context prominently into the next phase's prompt: "WARNING: The following quality criteria were overridden: [list]. Address these gaps if possible during this phase." This makes overrides visible and actionable, not silent bypasses.
3. **Monitoring:** Track override rate in log.yml. If it exceeds 30% after 10 lifecycles, investigate: are gate criteria too strict? Is the override too easy? Are developers not reading gate output?

---

## Summary: Phase Mapping

| Pitfall | Plan Phase Action | Execute Phase Action | Post-Launch Monitoring |
|---------|-------------------|----------------------|----------------------|
| P1: 11-Step Monolith | Pre-plan split points | Test 3 cycles, split if <80% | Step completion tracking |
| P2: Self-Grading Bias | Schedule calibration task | Anti-bias prompt instructions | First-pass approval rate |
| P3: State.yml Corruption | -- | Backup + validation on every write | Backup diff monitoring |
| P4: Context Reconstruction | Wave-1 priority | Test all 3 layers independently | Hook success rate |
| P5: Prompt Context Explosion | Token budget per template | Measure actual token counts | Agent quality per batch position |
| P6: Batching Edge Cases | Pseudocode with edge cases | Test 3 scenarios | Batch count distribution |
| P7: Freeform Parsing | -- | Generous parsing + display hints | Unparseable response rate |
| P8: Conditional Leakage | -- | Test both intents, check sections | Section audit per intent |
| P9: Dynamic Discovery Noise | Non-critical feature flag | Constrain proposals, hard cap | Discovery acceptance rate |
| P10: Recycle Dead Code | Low-priority task | Track recycle counts | Max recycle depth reached |
| P11: hooks.json Schema | -- | Verify first, build second | Hook fire rate |
| P12: log.yml Rewrite | -- | `cat >>` pattern, verify line count | File size changes |
| P13: Synthesis Input Scale | 15-question soft cap | Additive synthesis for gap-fill | Synthesis prompt token count |
| P14: Execute /clear Context | -- | Enrich checkpoint.yml notes | Resume quality observation |
| P15: Override Abuse | Informed consent UX | Prominent gap injection | Override rate |
