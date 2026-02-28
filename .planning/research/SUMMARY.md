# Research Summary: Expedite Plugin

**Date:** 2026-02-27
**Synthesizer:** Research synthesis agent
**Sources Synthesized:**
- `.planning/research/STACK.md` -- Plugin architecture, file formats, state management, subagent patterns
- `.planning/research/FEATURES.md` -- Feature inventory (10 table stakes, 12 differentiators, 14 anti-features)
- `.planning/research/ARCHITECTURE.md` -- Component inventory, data flow, build order dependency graph
- `.planning/research/PITFALLS.md` -- 15 pitfalls with prevention strategies and phase-mapped actions

---

## Executive Summary

Expedite is a Claude Code plugin implementing a 5-phase research-to-implementation lifecycle (Scope, Research, Design, Plan, Execute). The technology stack is deliberately minimal: Markdown, YAML, JSON, and shell scripts with no build step, no runtime, and no external dependencies. Every component is either a SKILL.md orchestration file (the "application logic"), a prompt template (the "function definition"), or a YAML state file (the "database"). Two reference implementations -- research-engine and GSD -- provide high-confidence patterns for the core architecture, and the research team has spent significant time validating 10 decision areas against those references, producing convergent recommendations with clear confidence levels.

The recommended approach is a layered build from plugin scaffolding through state management, interactive scoping, research orchestration, and finally the generative phases (Design, Plan, Execute). The critical dependency is the research skill: it is the most complex component in the entire system (11-step orchestration, parallel subagents, LLM-judged quality gates) and has no direct reference implementation at its level of complexity. Everything downstream of research is simpler. The research-engine plugin provides the direct ancestor for 11 of the 22 features; GSD provides the execution and state patterns for 6 more. Seven features are novel to Expedite with no reference precedent.

The principal risks are: (1) the research SKILL.md proving too complex for reliable single-file orchestration and requiring a split into sub-invocations; (2) self-grading bias in the inline quality gates producing false confidence; (3) state.yml corruption through LLM complete-file rewrite dropping fields; and (4) the SessionStart hook failing silently due to 3 open platform bugs. All four risks have explicit, pre-planned mitigations. The hooks.json schema carries LOW confidence and must be verified against the platform as the first implementation task before any dependent code is written.

---

## Key Findings

### From STACK.md

**Core Technologies:**
- **Plugin manifest:** Minimal `plugin.json` (name, version, description, author only) -- ROCK SOLID confidence, research-engine exact pattern
- **Skill format:** SKILL.md with YAML frontmatter (name, description, allowed-tools, argument-hint) -- HIGH confidence
- **State storage:** YAML (not JSON) -- complete-file rewrite with backup-before-write, max 2 nesting levels -- STRONG confidence
- **Subagent dispatch:** `Task(prompt, description, subagent_type, model)` API -- ROCK SOLID confidence, 3 converging sources
- **Prompt templates:** 8-section XML structure (`<role>`, `<context>`, `<intent_lens>`, `<downstream_consumer>`, `<instructions>`, `<output_format>`, `<quality_gate>`, `<input_data>`) -- STRONG convergent evidence
- **Context injection:** `!cat .expedite/state.yml` dynamic shell injection in every SKILL.md -- HIGH confidence
- **Telemetry append:** `cat >>` shell append for log.yml (never Write tool) -- HIGH confidence

**Critical Version/Schema Notes:**
- Subagents require `subagent_type: "general-purpose"` for MCP tool access (not `"explore"`)
- Template variables use `{{double_braces}}` (shell-safe, LLM convention)
- Model tiers hardcoded in frontmatter: sonnet for researchers, opus for synthesis, session model for everything else
- hooks.json field naming is LOW confidence -- must verify `hook_type`/`script` vs `type`/`command` at implementation time
- YAML safety rules are mandatory: quote ALL strings, explicit `null`, max 2 nesting, flow-style arrays

### From FEATURES.md

**Table Stakes (must-have -- no viable plugin without these):**
- TS-1: Plugin file structure and auto-discovery (ROCK SOLID)
- TS-2: SKILL.md orchestrator pattern (HIGH RISK at research complexity)
- TS-3: State persistence (state.yml YAML, complete-file rewrite) (STRONG)
- TS-4: Context reconstruction -- 3-layer fallback: hook + `!cat` + manual status (MODERATE -- hook unreliable)
- TS-5: Skill namespace and invocation (`/expedite:` prefix, trigger phrases)
- TS-6: Subagent orchestration via Task() with file-based output + condensed returns
- TS-7: Prompt template system (8-section XML, frontmatter for subagent templates)
- TS-8: Phase transition model (granular sub-states, forward-only)
- TS-9: File-based artifact pipeline (SCOPE.md, SYNTHESIS.md, DESIGN.md, PLAN.md, PROGRESS.md)
- TS-10: Error recovery patterns (per-skill error tables)

**Differentiators (significant value, novel or extended from references):**
- D-1: MUST/SHOULD quality gates (G1-G4) with Go/Go-advisory/Recycle/Override outcomes
- D-2: Categorical sufficiency model (COVERED/PARTIAL/NOT COVERED) with 3-dimensional rubric
- D-3: Parallel research with source-affinity batching (max 3 concurrent agents)
- D-4: Dynamic question discovery (subagent proposals, dedup, user approval)
- D-5: Dual intent adaptation (product/engineering per-phase format switching)
- D-6: HANDOFF.md for product-to-engineering lifecycle flow (generation in v1, import deferred to v2)
- D-7: Source routing with circuit breaker (per-source templates, failure classification)
- D-8: Gap-fill research rounds (Recycle-triggered, decision-area re-batching)
- D-9: Design revision cycle (max 2 rounds before gate, reduces G3 Recycle)
- D-10: Execute phase with wave-based checkpointing (pause/resume, PROGRESS.md append)
- D-11: Passive telemetry (log.yml, append-only, gitignored, v2 calibration data)
- D-12: Scope with interactive question plan preview ("Terraform plan-apply" moment)

**Explicitly deferred to v2+:**
- Cross-lifecycle artifact import and constraint locking (D-6 import, AF-12)
- Configurable model profiles (AF-2)
- Extended thinking for gate evaluation (AF-1)
- Numeric sufficiency scoring (AF-3)
- Multi-agent design synthesis (AF-4)
- Dedicated verifier subagent in execute phase (AF-10)
- Self-improvement from telemetry (AF-9)

### From ARCHITECTURE.md

**Major Components and Responsibilities:**

| Component | Role | Risk |
|-----------|------|------|
| `plugin.json` | Plugin identity, enables skill auto-discovery | None |
| `hooks/hooks.json` + `session-start.sh` | Session context injection | HIGH (3 platform bugs) |
| 6 SKILL.md orchestrators | Phase execution, gate evaluation, user interaction | HIGH for research only |
| 9 prompt templates | Subagent prompts (4) + inline references (5) | Low |
| 3 configuration templates | Seed files for `.expedite/` initialization | None |
| `state.yml` | Lifecycle control plane (phase, questions, gates, tasks) | Medium (corruption risk) |
| Markdown artifacts | Data plane (human-readable phase outputs) | Low |
| Inline gate system (G1-G4) | Quality assurance at phase transitions | Medium (self-grading bias) |

**Key Patterns:**
- Skills communicate exclusively through the filesystem -- no in-memory shared state, no message passing
- Subagents exist only in the research phase -- all other skills are main-session-only
- Gate context injection is ephemeral -- constructed at invocation time from state.yml, not persisted as a separate file
- Plugin code in `~/.claude/plugins/expedite/` is separate from runtime state in `.expedite/` at project root

**Build Order (dependency graph from ARCHITECTURE.md):**
```
Layer 0: plugin.json, templates/                        (no dependencies)
Layer 1: status skill, session-start hook               (validates state reading)
Layer 2: scope skill + G1 gate                         (first state writer)
Layer 3: research skill + 5 templates + G2 gate        (HIGHEST RISK -- bottleneck)
Layer 4: design skill + template + G3 gate             (reads research output)
Layer 5: plan skill + G4 gate || execute skill         (parallel, depend on design)
Layer 6: cross-cutting (intent adaptation, HANDOFF.md, archival, telemetry)
```

### From PITFALLS.md

**Top 5 Pitfalls with Prevention Strategies:**

**P1 (CRITICAL): Research SKILL.md Orchestration Overload**
- Risk: 11-step single-file orchestration has no reference precedent at this complexity; Claude may skip steps, conflate operations, or loop
- Prevention: Pre-plan split points before implementation (dispatch+collect vs. assess+synthesize vs. gate); test 3 complete research cycles; split if <80% step completion across >80% of runs
- Metric: Step completion rate per run

**P2 (HIGH): Self-Grading Bias in Inline Gates**
- Risk: Producing agent evaluating its own output; G2 and G3 gates may always pass; false confidence in research and design quality
- Prevention: Anti-bias prompt instructions ("evaluate as if someone else produced this"); require per-criterion evidence quotes; track first-pass approval rate; schedule calibration review after 5 lifecycles
- Metric: First-pass gate approval rate (alert if >90%)

**P3 (HIGH): state.yml Corruption Through LLM Complete-File Rewrite**
- Risk: LLM drops fields, changes types, or reorganizes unintended sections during each complete-file rewrite; silently corrupts lifecycle tracking
- Prevention: Backup before every write; post-write validation (question count, required fields, version field); preservation instructions in every writing SKILL.md
- Metric: Backup diff for unexpected field changes

**P4 (HIGH): Context Reconstruction Failure After /clear**
- Risk: SessionStart hook has 3 open bugs; `!cat` injection depends on undocumented behavior; fallback layers not tested independently
- Prevention: All 3 layers implemented in wave-1 before any other skill; test each layer in isolation; test complete failure chain (disable hook, verify `!cat` carries sufficient context)
- Metric: Hook success rate per session

**P11 (MEDIUM): hooks.json Schema Uncertainty**
- Risk: Field naming disagreement across design proposals (`hook_type`/`script` vs `type`/`command`); wrong schema silently ignored
- Prevention: First task in wave-1; test all naming conventions; verify hook fires before building anything that depends on it
- Timeline: 30 minutes to resolve

**Additional pitfall pattern (applicable to planning):**
- P5: Subagent prompt context explosion -- budget 5K tokens per agent prompt; batch size must be reduced if exceeded
- P8: Conditional section leakage between product/engineering intent -- test both intents after each template implementation
- P13: Synthesis agent input scale -- soft cap of 15 questions per lifecycle; additive (not cumulative) synthesis for gap-fill rounds

---

## Implications for Roadmap

### Recommended Phase Structure

The architecture's build-order dependency graph maps directly to roadmap phases. The research suggests **6 phases** with a hard gate at the research skill before any downstream phases begin.

---

**Phase 1: Foundation and Verification**
- Rationale: Zero-risk static files that establish plugin identity and state schema. Hooks.json schema uncertainty must be resolved here as the first task -- it is a binary pass/fail with a 30-minute resolution window.
- Delivers: Working plugin registration, correct hooks.json schema (verified), state.yml schema contract, seed templates
- Features: TS-1 (plugin structure), TS-3 (state schema definition), TS-4 partial (hook layer only)
- Pitfalls to avoid: P11 (hooks.json schema -- verify before moving on)
- Research flag: No deep research needed -- patterns are ROCK SOLID

---

**Phase 2: Status Skill and Context Recovery**
- Rationale: Status is the simplest skill (read-only, no subagents, no gates) and validates that the full SKILL.md mechanics work before any state-writing skill is attempted. The 3-layer context fallback system must be complete and tested here -- P4 requires all 3 layers working before any phase skill is deployed.
- Delivers: Working `/expedite:status`, verified `!cat` injection, fallback chain tested end-to-end
- Features: TS-4 (all 3 context reconstruction layers), TS-5 partial (namespace/invocation mechanics)
- Pitfalls to avoid: P4 (context reconstruction -- test all 3 layers independently and as a chain)
- Research flag: No deep research needed -- patterns are HIGH confidence

---

**Phase 3: Scope Skill**
- Rationale: Scope is the lifecycle entry point and the first state-writing skill. It establishes the state.yml write pattern (backup-before-write, complete-file rewrite) that every subsequent skill inherits. G1 is a structural gate -- no LLM judgment required -- making this the cheapest gate validation possible.
- Delivers: Working `/expedite:scope`, verified state.yml write pattern, SCOPE.md artifact, G1 gate, interactive question plan preview
- Features: TS-2 (SKILL.md pattern for state-writing skill), TS-3 (write pattern), TS-8 (phase transitions), TS-9 (artifact pipeline), D-12 (scope + question plan preview), D-5 partial (intent detection)
- Pitfalls to avoid: P3 (state.yml corruption -- implement backup and post-write validation in this phase as the template for all others)
- Research flag: No deep research needed -- SKILL.md pattern is HIGH confidence; gate mechanics are proven

---

**Phase 4: Research Skill (Critical Path Bottleneck)**
- Rationale: Research is the highest-risk component. Nothing downstream (design, plan, execute) can be meaningfully built until research works reliably. The "try monolith first, split on failure" decision must be made here. Pre-planned split points are required before implementation starts (P1 prevention strategy). Source-affinity batching algorithm must be specified as pseudocode with explicit edge case handling (P6 prevention strategy).
- Delivers: Working `/expedite:research`, parallel subagent dispatch, sufficiency assessment, G2 gate, gap-fill research rounds, dynamic question discovery
- Features: TS-6 (subagent orchestration), TS-7 (all 4 subagent prompt templates + sufficiency evaluator), D-2 (sufficiency model), D-3 (parallel batching), D-4 (dynamic discovery), D-7 (source routing), D-8 (gap-fill), D-11 partial (phase telemetry events)
- Pitfalls to avoid: P1 (monolith complexity -- pre-plan split points, test 3 cycles), P2 (gate self-grading -- anti-bias instructions), P5 (prompt token budget), P6 (batching edge cases), P9 (discovery noise), P13 (synthesis input scale)
- Research flag: **Needs `/gsd:research-phase`** -- subagent orchestration complexity, batching algorithm, and gate reliability are all MEDIUM confidence and have no direct reference at this level

---

**Phase 5: Design and Plan Skills**
- Rationale: Both skills read prior phase artifacts and run in the main session without subagents. They are straightforward generation tasks with inline gates. Design introduces the revision cycle interaction pattern and dual intent format switching. Plan introduces wave/task structure. Both can be built in parallel after research is working.
- Delivers: Working `/expedite:design` and `/expedite:plan`, RFC/PRD format switching, HANDOFF.md generation, design revision cycle, wave-ordered task plan, G3 and G4 gates
- Features: TS-2 (for design/plan skill bodies), D-1 partial (G3/G4 gates), D-5 (full dual intent), D-6 (HANDOFF.md generation), D-9 (revision cycle), D-11 partial (gate telemetry events)
- Pitfalls to avoid: P2 (G3 self-grading bias), P8 (conditional section leakage -- test both intents), P15 (override abuse -- implement informed consent UX)
- Research flag: No deep research needed -- main-session generation patterns are HIGH confidence; dual intent content (PRD/RFC format) has WEAK-MODERATE evidence but is grounded in industry conventions

---

**Phase 6: Execute Skill and Cross-Cutting Concerns**
- Rationale: Execute introduces checkpoint/resume -- the least-tested pattern (MEDIUM confidence, adapted from GSD). Cross-cutting concerns (archival, telemetry, recycle escalation) can be layered in after the core skill works. Telemetry is LOW priority -- if append reliability proves problematic, defer to v1.1.
- Delivers: Working `/expedite:execute`, wave-based task execution, pause/resume checkpoint, PROGRESS.md append, archival flow, full telemetry across all skills
- Features: D-10 (execute + checkpointing), TS-10 (error recovery -- final skill to complete the table), D-11 (full telemetry), D-1 partial (G1-G4 recycle escalation UX)
- Pitfalls to avoid: P10 (recycle escalation as dead code -- implement as low-priority task, verify with data before investing), P12 (log.yml rewrite -- `cat >>` pattern, line count validation), P14 (/clear context loss during execute -- enrich checkpoint.yml notes)
- Research flag: No deep research needed -- wave execution is STRONG (GSD proven); checkpoint/resume is MEDIUM confidence and may need iteration

---

### Research Flags

| Phase | Research Needed | Reason |
|-------|----------------|--------|
| Phase 1 | No | ROCK SOLID patterns from reference implementations |
| Phase 2 | No | HIGH confidence; status skill is the simplest component |
| Phase 3 | No | HIGH confidence; scope pattern is well-validated |
| Phase 4 | **YES** | Research SKILL.md complexity (MEDIUM), batching algorithm (MODERATE), G2 gate reliability (MODERATE), synthesis input scaling -- all need deeper investigation before implementation |
| Phase 5 | No | Design/plan generation is HIGH confidence; intent content may need iteration but not blocking research |
| Phase 6 | No | Execute pattern is STRONG (GSD proven); checkpoint is MEDIUM but can iterate |

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | 4 ROCK SOLID items; 10 HIGH items; 3 MEDIUM items; 1 LOW item (hooks.json schema). Overall very high confidence. The LOW item is trivial to resolve at implementation time. |
| Features | HIGH | 10 table stakes are all HIGH-ROCK SOLID confidence. 12 differentiators range from MODERATE to STRONG. 7 novel features have no reference precedent but sound design rationale. |
| Architecture | HIGH | Component inventory is exhaustive; build order dependency graph is well-reasoned; component boundaries are clear. SessionStart hook is the only HIGH-risk component and has proven fallbacks. |
| Pitfalls | HIGH | 15 pitfalls with concrete prevention strategies. Phase-mapped action tables provide actionable pre-work. Confidence audit alignment noted for every significant risk. The pitfall research appears thorough and pessimistic in the right direction. |

**Overall Confidence: HIGH**

The research is unusually thorough for a plugin project of this scope. Two reference implementations have been deeply studied. Ten decision areas have been formally audited with confidence ratings. The 10-decision-area confidence audit (from CONFIDENCE-AUDIT.md) was read by both the stack and architecture researchers and referenced consistently. The main uncertainty concentrations are:

1. **Research SKILL.md complexity** -- No reference at this level; requires empirical validation during implementation
2. **hooks.json field naming** -- Trivially resolvable, not a real gap
3. **Dual intent content quality** -- PRD/RFC format grounded in industry conventions but not validated in LLM workflow plugin context
4. **Execute checkpoint/resume reliability** -- MEDIUM confidence, adapted from GSD; needs iteration

### Gaps to Address

| Gap | Phase | Resolution Strategy |
|-----|-------|-------------------|
| hooks.json correct field naming | Phase 1, task 1 | Test all 3 naming conventions; 30-minute resolution |
| Research SKILL.md step completion reliability | Phase 4 | Run 3 test cycles; pre-plan split points |
| G2 gate self-grading calibration | Phase 4 + post-launch | Calibration review after 5 lifecycles; track first-pass approval rate |
| Source-affinity batching edge cases | Phase 4 | Pseudocode with explicit edge case handling before implementation |
| Dual intent content quality (PRD vs RFC sections) | Phase 5 | Validate with one product + one engineering lifecycle; iterate on template content |
| Execute checkpoint/resume in complex lifecycles | Phase 6 | Enrich checkpoint.yml with continuation notes; test pause/resume cycle explicitly |

---

## Sources

Aggregated from research files (all dated 2026-02-27):

**Primary Reference Implementations:**
- Research-engine plugin (`~/.claude/plugins/cache/local/research-engine/`) -- direct ancestor for 11 features
- GSD framework (`~/.claude/get-shit-done/`) -- ancestor for 6 features (execution, state management)

**Project-Generated Evidence Base:**
- PRODUCT-DESIGN.md -- comprehensive product specification
- CONFIDENCE-AUDIT.md -- 10-decision-area confidence ratings with explicit LOW/MEDIUM/HIGH/ROCK SOLID labels
- research-synthesis.md -- cross-source synthesis of all research threads
- READINESS.md -- implementation readiness evaluation
- SCOPE.md -- question plan with 15 research questions
- PROJECT.md -- explicit feature deferral decisions (v1 vs v2)

**Platform References (cited in research):**
- Claude Code plugin architecture official documentation
- GitHub issue tracker: #16538, #13650, #11509 (SessionStart hook bugs), #12890 (AskUserQuestion subagent limitation), #13254, #19964 (MCP subagent_type requirement)
- Anthropic prompt engineering guidance (role-setting, instruction-before-data, long-document positioning)
- Anthropic concurrency guidance (3-5 concurrent subagents recommendation)

**Industry Sources:**
- HashiCorp PRD-to-RFC format (D-5, D-6 design basis)
- Marty Cagan's 4 risks framework (product intent adaptation)
