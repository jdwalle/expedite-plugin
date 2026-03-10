# Confidence Audit: Arc Plugin Product Design

**Audit Date:** 2026-02-27
**Auditor:** Confidence audit agent (opus)
**Document Audited:** PRODUCT-DESIGN.md (final synthesis from 3 revised design proposals, 2 validation reports)
**Supporting Evidence:** research-synthesis.md, user-decisions.md, READINESS.md

---

## Audit Summary

The arc product design is a well-grounded document with an unusually honest self-assessment -- the Evidence Strength Map at the bottom of the document largely agrees with this audit's findings, which is itself a sign of design maturity. The distribution of confidence ratings across ~40 significant decisions is approximately: 12 ROCK SOLID, 16 HIGH, 8 MEDIUM, 5 LOW, 0 SPECULATIVE. The design's foundation (plugin architecture, state management, subagent orchestration, prompt template structure) is built on directly proven patterns from two reference implementations and is ready to build as-is. The risk is concentrated in two areas: (1) the research SKILL.md orchestration flow is the most complex single-file orchestration in the design with 11 steps and no reference implementation at that complexity, and (2) the intent-adaptive features -- especially HANDOFF.md and cross-lifecycle import -- are novel features with WEAK evidence that may not survive contact with real users. The sufficiency model uses a categorical assessment (COVERED/PARTIAL/NOT COVERED) proven by research-engine, eliminating what was previously the design's biggest risk area. The single most important thing to validate before full commitment is whether the research SKILL.md orchestration reliably executes all 11 steps and whether the HANDOFF.md format proves useful to real engineers.

---

## Decision-by-Decision Ratings

### Plugin Architecture

| # | Decision | Confidence | Evidence Basis | Key Assumption | Revision Trigger |
|---|----------|------------|----------------|----------------|------------------|
| - | Plugin directory layout (skills/, references/, plugin.json) | ROCK SOLID | Research-engine demonstrates exact pattern; official plugin docs confirm | Plugin API remains stable | Claude Code plugin API breaking change |
| - | Skill auto-discovery from `skills/{name}/SKILL.md` | ROCK SOLID | Research-engine uses this; docs confirm | Auto-discovery behavior unchanged | Plugin system update changes discovery rules |
| - | `/arc:` namespace with 6 skills | HIGH | Research-engine's 5-skill pattern extended by 1 (status). Namespace convention documented | Status skill is useful enough to justify its slot | Developers never use `/arc:status` (remove it) |
| - | Trigger phrases in SKILL.md description for auto-invocation | HIGH | Plugin architecture research documents this capability | Trigger-phrase matching works reliably | Auto-invocation fires incorrectly on ambiguous input |
| 27 | hooks.json field naming (`hook_type`/`script`) | LOW | Proposals disagreed. Design acknowledges uncertainty. Must verify at implementation time | One of the three naming conventions is correct | Implementation reveals the actual schema |
| - | Minimal plugin.json (name, version, description, author only) | ROCK SOLID | Research-engine uses this exact pattern | No additional fields needed | Platform requires new mandatory fields |

### State Management

| # | Decision | Confidence | Evidence Basis | Key Assumption | Revision Trigger |
|---|----------|------------|----------------|----------------|------------------|
| 8 | Flat state.yml (max 2 nesting levels) | ROCK SOLID | State management patterns research explicitly recommends this for LLM parseability. Validated by both proposals | LLMs remain more reliable with flat YAML | Evidence that nested structures are equally parseable |
| - | Complete-file rewrite + backup-before-write | ROCK SOLID | Both reference implementations + state management patterns research | File writes are atomic enough on modern filesystems | Concurrent write corruption occurs in practice |
| 7 | Granular phase naming (`scope_in_progress`, `scope_complete`, `research_recycled`) | HIGH | R2/R3 proposals converged. Makes crash recovery unambiguous | Granularity adds value over simpler phase names | Phase names become confusing; developers misread state |
| - | state.yml under 100 lines target | HIGH | State management patterns research recommends this | 10-15 questions is the typical case | Large-scope projects routinely exceed 20+ questions |
| - | `version` field for schema evolution | HIGH | Standard practice, low cost | Schema will evolve | N/A -- this is pure upside |
| - | Per-question flat metadata in state.yml | MEDIUM | Novel schema. Neither reference implementation tracks per-question state at this granularity | Flat per-question objects remain manageable at 15+ questions | state.yml becomes unwieldy; need to split question state to a separate file |
| - | Archival flow (move to `.arc/archive/{slug}/`) | HIGH | Research-engine + GSD both have analogous patterns. Clean separation | Users want to preserve prior lifecycles | Users prefer clean deletion over archival |

### SessionStart Hook & Context Reconstruction

| # | Decision | Confidence | Evidence Basis | Key Assumption | Revision Trigger |
|---|----------|------------|----------------|----------------|------------------|
| - | SessionStart hook for context injection | MEDIUM | Plugin architecture research documents the mechanism. THREE open bugs (#16538, #13650, #11509) | Bugs will be fixed, or plain text stdout workaround succeeds | Bugs persist and workaround also fails |
| 21 | Dynamic context injection (`!cat .arc/state.yml`) in all SKILL.md files | HIGH | Plugin architecture research confirms `!command` syntax. Zero-cost defense-in-depth | `!command` execution is reliable in SKILL.md | Platform changes `!command` behavior or removes it |
| - | Three-layer fallback (hook + dynamic injection + /arc:status) | HIGH | Defense-in-depth is a sound engineering pattern. Each layer is independently verified | At least one of three layers works in any session | All three fail simultaneously (extremely unlikely) |

### Skills & Orchestration

| # | Decision | Confidence | Evidence Basis | Key Assumption | Revision Trigger |
|---|----------|------------|----------------|----------------|------------------|
| 9 | Design and plan generation in main session | ROCK SOLID | C-7 constraint. Both validators agreed. Main session enables revision cycle, full tool access | Design/plan benefit from interactivity | N/A -- this follows from a hard constraint |
| 11 | Scope question generation in main session | ROCK SOLID | Scope is interactive by nature. Subagent cannot participate in user conversation | Users want interactive scope refinement | Users prefer to dump a brief and let the agent decompose silently |
| 10 | Sufficiency evaluation inline (not subagent) | HIGH | Avoids ~80K token overhead. Main session already has evidence context | Inline evaluation is accurate enough without separate agent | Inline evaluation quality is significantly worse than dedicated subagent evaluation |
| - | 11-step research SKILL.md orchestration flow | MEDIUM | Research-engine has a simpler version. No reference implementation validates this level of complexity in a single SKILL.md | Claude can reliably follow an 11-step orchestration prompt | Claude loses track of steps, skips steps, or re-executes completed steps |
| 24 | Design revision cycle (max 2 rounds) | MEDIUM | R2 proposal. Good DX pattern. No direct reference precedent | Developers use revision. 2 rounds is sufficient | Developers ignore revision (always say "proceed") or need 3+ rounds |
| 23 | Freeform prompt for micro-interaction (not AskUserQuestion) | HIGH | Avoids 60-second timeout. All 3 proposals converged | Freeform parsing reliably detects "yes/pause/review" | Freeform responses are too ambiguous to parse reliably |

### Gate Model

| # | Decision | Confidence | Evidence Basis | Key Assumption | Revision Trigger |
|---|----------|------------|----------------|----------------|------------------|
| 1 | Inline gates (each skill validates its own output) | HIGH | User decision (D1). Evidence slightly favors this approach. Streamlined UX | Inline evaluation is as reliable as separate-agent evaluation | Inline gates are unreliable because the producing agent evaluates its own work (self-grading bias) |
| - | MUST/SHOULD criteria split | HIGH | Product design constraint C-3. Research-engine's rubric pattern provides foundation | Developers understand MUST vs SHOULD distinction intuitively | Developers are confused by advisory results |
| 15 | "Go with advisory" as fourth gate outcome | HIGH | R2 refinement. Bridges the gap between hard pass and hard fail | Developers read and act on advisory notes | Developers ignore advisory context entirely (no behavior change from clean Go) |
| 14 | Override applies to both MUST and SHOULD failures | MEDIUM | Reasonable from a developer-agency perspective. No reference precedent for gate overrides | Developers use override responsibly | Developers override everything, rendering gates pointless |
| - | Recycle escalation (1st informational, 2nd suggest adjustment, 3rd recommend override) | MEDIUM | No direct reference precedent. Sound UX escalation pattern | Progressive escalation reduces frustration | Developers override immediately without reading escalation messages |
| 16 | Categorical sufficiency model (COVERED/PARTIAL/NOT COVERED) for G2 | HIGH | Research-engine uses this exact pattern (COVERED/PARTIALLY/NOT COVERED). Proven in production. Count-based gate criteria ("majority COVERED", "all P0 COVERED or PARTIAL") | Categorical judgments are stable across LLM invocations | LLM categorical assessments prove unreliable (unlikely given research-engine precedent) |
| 25 | Categorical sufficiency assessment (not numeric scoring) | HIGH | Research-engine demonstrates qualitative rubric. LLM-as-judge research shows categorical judgments are more stable than numeric scores | Qualitative dimensions (coverage, corroboration, actionability) map cleanly to categories | Categories are too coarse to distinguish "almost ready" from "far from ready" (upgrade to numeric in v1.1 if needed) |

### Source Routing

| # | Decision | Confidence | Evidence Basis | Key Assumption | Revision Trigger |
|---|----------|------------|----------------|----------------|------------------|
| 13 | Source-affinity batching (hybrid per-question/per-batch) | MEDIUM | Novel adaptation of research-engine's per-category pattern. Synthesis recommends it | Grouping by source affinity produces better evidence than random grouping | Batch boundaries cause questions to get less attention than they would individually |
| 12 | Three per-source researcher templates | HIGH | Research-engine uses per-source templates. Source-specific instructions are substantial | Three source types (web/codebase/MCP) cover the practical space | New source types emerge that don't fit existing templates |
| - | sources.yml persists across lifecycles | HIGH | Clean separation of source config from lifecycle state | Source config rarely changes between lifecycles | Users frequently change sources per-lifecycle |
| - | MCP availability via optimistic invocation (no detection API) | HIGH | Platform constraint -- no programmatic check exists. Well-documented | Optimistic invocation + error handling is sufficient | Frequent false starts waste significant tokens on MCP failures |
| 28 | MCP tools require foreground subagent execution | ROCK SOLID | Hard platform constraint confirmed by GitHub issues #13254, #19964 | Platform behavior unchanged | Claude Code adds background MCP access |
| 29 | AskUserQuestion not available in subagents | ROCK SOLID | Hard platform constraint confirmed by GitHub issue #12890 | Platform behavior unchanged | Claude Code adds subagent AskUserQuestion |
| - | Circuit breaker (three-tier failure: server/platform/no-results) | HIGH | Round 2 gap research provides concrete prompt pattern. Grounded in standard resilience patterns | Subagents can reliably distinguish failure types | LLMs misclassify failure types; all failures treated the same |

### Prompt Templates

| # | Decision | Confidence | Evidence Basis | Key Assumption | Revision Trigger |
|---|----------|------------|----------------|----------------|------------------|
| - | 8-section XML template structure | ROCK SOLID | Convergent evidence from prompt engineering research, COSTAR framework, Anthropic blog, both reference implementations | XML tags improve prompt following | N/A -- this is among the best-evidenced decisions |
| 2 | Single template with conditional `<intent_lens>` | HIGH | All 3 proposals converged. Research-engine lens pattern is proven | Conditional sections don't confuse the LLM | Intent lens sections leak into wrong-intent context |
| 20 | `cat >>` Bash append for log.yml | HIGH | Directly mitigates realistic LLM rewrite risk. Adopted by all proposals | Bash `cat >>` is available and works reliably | Claude Code sandbox restricts `cat >>` |
| - | Dual-target output (file + condensed return) | HIGH | Research-engine proves this pattern works. All sources agree | Subagents comply with dual-target instructions | Subagents write everything to file but return verbose summaries anyway |
| 3 | Hardcoded model tiers in frontmatter | HIGH | Research-engine pattern. Zero configuration. All proposals converged | sonnet/opus split is adequate for all use cases | Cost-conscious users want haiku for some agents |
| 22 | Max 3 concurrent research subagents | HIGH | Anthropic recommends 3-5. Conservative end for reliability | 3 is sufficient for 10-15 question lifecycles | Large lifecycles with 5+ batches are too slow sequentially |

### Intent Adaptation

| # | Decision | Confidence | Evidence Basis | Key Assumption | Revision Trigger |
|---|----------|------------|----------------|----------------|------------------|
| 6 | Full intent adaptation in v1 (user decision D6) | MEDIUM | User wants it. Evidence for the feature is WEAK-MODERATE | Intent adaptation adds meaningful value over a single mode | Users overwhelmingly use engineering intent; product intent is underused |
| - | Product PRD vs. Engineering RFC output format | HIGH | Industry standard formats. Well-understood differentiation | Both formats are useful to their respective audiences | Developers find rigid format distinctions unhelpful |
| 26 | HANDOFF.md 9-section format (sections 1-8 MODERATE, section 9 WEAK) | LOW | HashiCorp PRD-to-RFC translation provides some grounding. Section 9 has no precedent | The 9-section format captures what engineers need from a PM handoff | Real PM-to-engineer handoffs require different/fewer/more sections |
| - | Cross-lifecycle artifact import | LOW | Novel feature. No reference implementation has this | Developers will use product lifecycle output to seed engineering lifecycles | The handoff UX is too rigid; users prefer manual context transfer |
| - | Locked constraints from imported Key Decisions | MEDIUM | Reasonable design. GSD carries context as locked constraints | Locked constraints are honored by downstream phases | LLM ignores "LOCKED" annotations or over-constrains design |

### Telemetry

| # | Decision | Confidence | Evidence Basis | Key Assumption | Revision Trigger |
|---|----------|------------|----------------|----------------|------------------|
| 5 | log.yml gitignored (user decision D5) | HIGH | User decision. Single-user workflow | User won't need git-tracked telemetry | N/A -- easy to change |
| 19 | log.yml persists across lifecycles | MEDIUM | Cross-lifecycle analysis is the primary v2 value. Size manageable | Log doesn't grow unwieldy | Unexpected large lifecycles create multi-MB logs |
| - | Multi-document YAML append pattern | HIGH | State management patterns research documents this. Partial writes corrupt only last document | YAML multi-document parsing works correctly | YAML parser chokes on malformed trailing document |
| - | Seven event types with priority tiers | HIGH | Three highest-value events well-identified. GSD + research-engine both demonstrate analogous patterns | These events provide sufficient data for v2 calibration | Key events are missing that would have been valuable |

---

## Strongest Decisions (Top 5)

### 1. Plugin Directory Layout and SKILL.md Orchestrator Pattern
**Confidence:** ROCK SOLID
**Decision:** Standard plugin layout with `skills/{name}/SKILL.md`, `references/` subdirectories, minimal `plugin.json`, auto-discovery.
**Why confidence is high:** Research-engine demonstrates this exact pattern in production. Official Claude Code plugin documentation confirms it. Multiple independent sources (app analysis, plugin architecture research) converge. The design is not innovating here -- it is adopting a proven pattern wholesale.
**What would have to be true for this to be wrong:** Claude Code would need to fundamentally change its plugin architecture, which would break research-engine and all other existing plugins.

### 2. Flat state.yml with Complete-File Rewrite and Backup
**Confidence:** ROCK SOLID
**Decision:** state.yml uses max 2 nesting levels, complete-file rewrite on every update, backup-before-write, version field for schema evolution.
**Why confidence is high:** State management patterns research explicitly recommends flat YAML for LLM parseability. Both reference implementations use analogous patterns. The backup-before-write pattern is standard defensive practice. Three independent evidence sources converge.
**What would have to be true for this to be wrong:** LLMs would need to become equally reliable with deeply nested YAML, or the state schema would need to exceed what flat structure can represent.

### 3. 8-Section XML Prompt Template Structure
**Confidence:** ROCK SOLID
**Decision:** Every prompt template follows role/context/intent_lens/downstream_consumer/instructions/output_format/quality_gate/input_data using XML tags.
**Why confidence is high:** This is the single most convergent finding in the research. Prompt engineering research, COSTAR framework, Anthropic's own blog, research-engine's 12 templates, and GSD's 5 agent definitions all independently validate XML-structured prompts with explicit sections. Anthropic states "prompt engineering was the primary lever for improving agent behaviors."
**What would have to be true for this to be wrong:** Structured prompts would need to perform worse than unstructured ones, contradicting Anthropic's own guidance.

### 4. Main Session for Design/Plan/Execute; Subagents Only for Research
**Confidence:** ROCK SOLID
**Decision:** Task() is used exclusively for research-phase parallel evidence gathering. Design, plan, execute, gates, and sufficiency evaluation all run in the main session.
**Why confidence is high:** This follows directly from constraint C-7 ("subagents for parallel research; main session for everything else"). Both validators agreed. Main session enables revision cycles, full tool access, user model control, and avoids the ~80K token overhead per subagent. The separation is clean and principled.
**What would have to be true for this to be wrong:** Main-session design generation would need to produce significantly worse results than subagent-based generation, which contradicts the evidence that main session has superior context and tool access.

### 5. Three-Layer Context Reconstruction Fallback
**Confidence:** HIGH
**Decision:** SessionStart hook + dynamic `!cat` injection in every SKILL.md + manual `/arc:status` provides three independent mechanisms for context restoration after `/clear`.
**Why confidence is high:** Each layer is independently verified against documentation. The defense-in-depth pattern is sound engineering practice. Even if the SessionStart hook fails (3 open bugs make this plausible), the other two layers function independently. The cost of all three layers is negligible (a single `!cat` line per SKILL.md).
**What would have to be true for this to be wrong:** All three mechanisms would need to fail simultaneously, which requires `!command` syntax to break AND the user to never manually invoke `/arc:status`.

---

## Weakest Decisions (Top 5)

### 1. Research SKILL.md 11-Step Orchestration Complexity
**Confidence:** MEDIUM
**Decision:** The `/arc:research` skill contains a single SKILL.md that orchestrates 11 sequential steps: entry validation, mode detection, source-affinity batching, prompt construction, parallel dispatch, progress reporting, dynamic question discovery, sufficiency assessment, synthesis, gate evaluation, and state update.
**Why confidence is lower:** No reference implementation has a SKILL.md this complex. Research-engine's research skill is simpler (dispatch, collect, synthesize). The backlog item "Research SKILL.md decomposition" acknowledges this risk but defers it. The concern is not that the steps are individually wrong -- they are well-specified -- but that an LLM following an 11-step prompt will reliably execute all steps in order, especially steps 7 (dynamic question discovery with regex extraction + AskUserQuestion) and step 8 (inline sufficiency assessment for every question).
**Specific test to raise confidence:** Implement the research SKILL.md and run it on 3 real research cycles. Track which steps are completed, skipped, or re-executed. Measure whether the LLM consistently follows all 11 steps.
**Validation approach:** This should be the first end-to-end test. If the LLM struggles, the backlog already identifies the mitigation: split research into sub-invocations (e.g., `/arc:research` dispatches agents, a second invocation handles synthesis + gating).
**What to do if wrong:** Split the research skill into 2-3 sub-skills (dispatch, evaluate, synthesize). This is an architectural change to the skill structure but does not affect state schema or gate logic.

### 2. HANDOFF.md 9-Section Format
**Confidence:** LOW
**Decision:** Product-intent design phase generates a HANDOFF.md with 9 specific sections: Problem Statement, Key Decisions (LOCKED), Scope Boundaries, Success Metrics, User Flows, Acceptance Criteria, Assumptions and Constraints, Suggested Engineering Questions, Priority Ranking for Trade-offs.
**Why confidence is lower:** Sections 1-8 have MODERATE evidence (grounded in HashiCorp PRD-to-RFC translation). Section 9 has WEAK evidence (no direct research precedent -- a design addition). The entire format is novel; no existing tool generates this document type. The READINESS evaluation itself flags DA-9 as "highest-iteration-risk." The core question is not whether PM-to-engineer handoffs are valuable (they clearly are), but whether these specific 9 sections capture what engineers actually need, and whether LLM-generated handoff documents are useful enough to act on.
**Specific test to raise confidence:** Generate 2-3 HANDOFF.md documents from real product lifecycles. Have an engineer review each and answer: (1) Which sections were useful? (2) What was missing? (3) Would you use the "Suggested Engineering Questions" to seed a new lifecycle?
**Validation approach:** This is a "build it and see" feature. The design correctly marks it as a v1-iteration candidate. Implement it, gather feedback, iterate on the section list.
**What to do if wrong:** Revise the section list based on user feedback. This is cheap to change -- it is just prompt content in `prompt-design-guide.md`. Worst case, remove HANDOFF.md generation entirely and let users create their own handoff format.

### 3. Cross-Lifecycle Artifact Import
**Confidence:** LOW
**Decision:** `/arc:scope` scans for prior HANDOFF.md/DESIGN.md files, presents them via AskUserQuestion, and on import extracts Key Decisions as locked constraints, Scope Boundaries as pre-populated scope, and Suggested Engineering Questions as proposed questions.
**Why confidence is lower:** This is a completely novel feature with no reference implementation precedent. The import flow makes assumptions about how users will work: (1) the PM and engineer use the same project/machine, or the PM manually copies HANDOFF.md to the engineer's project, (2) the extracted constraints and questions are actually useful as seeds, (3) the "LOCKED" constraint mechanism works (LLMs are not reliable at honoring absolute constraints in downstream phases). The user clarified that handoff is "just generating a file" with manual distribution, which simplifies the technical implementation but means the import flow depends on the user having placed the file correctly.
**Specific test to raise confidence:** Complete one full product-to-engineering lifecycle pair. Evaluate: (1) Did the import flow trigger correctly? (2) Were the locked constraints honored throughout the engineering lifecycle? (3) Were the suggested questions useful?
**Validation approach:** Build the import flow. Test with a controlled pair (run a product lifecycle on a sample project, then start an engineering lifecycle). Focus testing on constraint lock enforcement.
**What to do if wrong:** Simplify to "read prior artifact and display it as context" without automatic constraint extraction. Let the user manually choose what to carry forward. This is a graceful degradation.

### 4. Locked Constraints from HANDOFF.md Import
**Confidence:** LOW
**Decision:** Extracted Key Decisions from imported HANDOFF.md become locked constraints injected into downstream phase prompts, enforced by prompt instruction alone.
**Why confidence is lower:** LLMs are not reliable at honoring absolute constraints over multi-hour lifecycles. No programmatic enforcement exists -- only prompt-level "LOCKED" annotations. Constraint drift is likely over the course of research, design, and plan phases.
**Specific test to raise confidence:** Test with 3 known constraints across a full engineering lifecycle. Check design and plan output for compliance. If <2/3 constraints honored, the mechanism needs strengthening.
**Validation approach:** Build the import flow, test with controlled constraint set. If constraints drift, consider adding explicit constraint-check criteria in G3 and G4 gates.
**What to do if wrong:** Simplify to advisory constraints (displayed but not enforced) or add a constraint-verification step in each gate.

---

## Assumption Register

| # | Assumption | Likelihood Correct | Impact if Wrong | How to Validate |
|---|------------|-------------------|----------------|-----------------|
| A1 | Developers will complete the 5-phase flow rather than abandoning mid-lifecycle | Medium (60%) | HIGH -- abandoned lifecycles pollute `.arc/` state and reduce perceived value | Track lifecycle_start vs lifecycle_complete in log.yml. Target: >60% completion rate (metric #1 in design). If low, investigate which phase is the drop-off point. |
| A2 | The "Terraform plan-apply" preview in scope will be valued by developers | High (80%) | MEDIUM -- if ignored, tokens are wasted on unwanted research questions | Observe whether developers modify the question plan or always approve as-is. If >90% approve without changes, the preview may be unnecessary ceremony. |
| A3 | LLM categorical sufficiency assessments (COVERED/PARTIAL/NOT COVERED) are consistent across invocations | High (80%) | MEDIUM -- if categorical ratings fluctuate, gate outcomes become unpredictable. However, research-engine precedent and LLM-as-judge research both suggest categorical judgments are significantly more stable than numeric scores | Run evaluator on identical evidence 3 times. Check whether categorical ratings are consistent. Categorical assessments are expected to be stable based on research-engine experience. |
| A4 | Developers will accept gate "Recycle" outcomes and re-research rather than immediately overriding | Medium (50%) | MEDIUM -- if override rate exceeds 50%, gates are perceived as obstacles, not quality checks | Track override rate in log.yml (metric #4). If >30%, investigate whether gate criteria are too strict. |
| A5 | The 11-step research SKILL.md will be followed reliably by Claude | Medium (55%) | HIGH -- research is the core differentiating phase. If orchestration fails, arc's value proposition collapses | Run 5 research cycles. Track step completion. If <80% of steps execute correctly, split into sub-skills. |
| A6 | Source-affinity batching produces better results than random or per-question dispatch | Medium (60%) | LOW -- if batching is suboptimal, evidence quality decreases slightly but is compensated by gap-fill | Compare evidence quality from affinity-batched vs. randomly-batched research on the same question set. Likely not worth formal A/B testing for v1. |
| A7 | Developers use both product and engineering intents | Low (35%) | MEDIUM -- if engineering dominates, the entire intent-adaptive system, HANDOFF.md, and cross-lifecycle import are dead code | Track intent distribution in log.yml. If <20% of lifecycles use product intent after 20 lifecycles, simplify to engineering-only with product as a thin overlay. |
| A8 | The freeform micro-interaction ("yes / pause / review") will be parsed correctly from natural language | High (75%) | LOW -- if parsing fails, the skill can fall back to treating any response as "yes" (safest default) | Track whether users respond with unexpected text. If >10% of responses are unparseable, add explicit option numbering. |
| A9 | 3 concurrent research subagents is the right ceiling | High (80%) | LOW -- too few means slower research; too many risks platform instability | Measure research phase duration with 3 agents. If consistently <10 min, no change needed. If >15 min, test with 4-5. |
| A10 | Dynamic question discovery will surface useful questions | Medium (50%) | LOW -- if proposed questions are low-quality, users decline them and nothing breaks. The feature is purely additive. | Track discovery acceptance rate (metric #9). If <20% of proposed questions are accepted, the extraction prompt needs refinement or the feature can be removed. |
| A11 | Locked constraints from HANDOFF.md import will be honored by downstream LLM phases | Low (40%) | MEDIUM -- if constraints are violated, the cross-lifecycle handoff feature breaks trust | Test with 3 known constraints. Check design and plan output for compliance. If <2/3 constraints honored, strengthen enforcement (e.g., explicit constraint-check step in design gate). |
| A12 | SessionStart hook will work for the majority of sessions despite 3 open bugs | Medium (50%) | LOW -- two independent fallback layers exist. Even if hook never works, arc functions normally | Track hook success rate. Even 0% success is acceptable due to fallbacks, but affects polish. |

---

## Recommended Testing Priorities

Ordered by impact on the design's viability:

### 1. Research SKILL.md End-to-End Orchestration (Critical)
**What:** Run 3 complete research cycles with the 11-step SKILL.md on real-world question sets. Track which steps execute, in what order, and whether any are skipped or repeated.
**Why first:** If the orchestrator cannot reliably follow the full flow, the research phase -- arc's most complex and differentiating feature -- breaks.
**Decision criteria:** If >80% of steps execute correctly on >80% of runs: proceed as designed. If 60-80%: identify which steps fail and consider splitting. If <60%: split research into 2-3 sub-skills.

### 2. Gate Self-Grading Bias (Important)
**What:** After 3 research cycles, compare inline gate evaluation results against an independent evaluation of the same artifacts. Does the producing skill grade itself more leniently?
**Why second:** Inline gates (D1) save a skill slot and improve UX, but self-grading bias is a known risk in LLM evaluation. If the producing agent consistently passes itself, gates provide false assurance.
**Decision criteria:** If independent evaluation agrees with inline >80% of the time: no bias concern. If <70%: consider external validation for G2 and G3 (the judgment-heavy gates).

### 3. hooks.json Field Schema Verification (Quick Win)
**What:** Build a minimal test plugin with the proposed hooks.json format. Verify SessionStart hook fires. Test all three proposed naming conventions if the first doesn't work.
**Why third:** This is a binary pass/fail check. If the field names are wrong, the hook doesn't work, and we rely on fallbacks from day one.
**Decision criteria:** Whichever naming convention works, use it. Quick fix.

### 4. Freeform Intent Parsing in Scope
**What:** Test whether freeform "product or engineering?" responses are correctly parsed from varied natural language (e.g., "this is a product investigation", "engineering project", "I'm a PM researching user needs").
**Why fourth:** Misclassified intent propagates through the entire lifecycle, affecting template selection, output format, and HANDOFF.md generation.
**Decision criteria:** If parsing accuracy >90% on 20 test inputs: proceed. If <90%: switch to AskUserQuestion with explicit product/engineering options for intent declaration only.

### 5. Cross-Lifecycle Import Flow (Deferred)
**What:** Complete one full product-to-engineering lifecycle pair. Evaluate import detection, constraint extraction, and constraint enforcement.
**Why fifth:** This is a v1-iteration feature with LOW confidence. It should work in the happy path but the real test is whether users find it valuable.
**Decision criteria:** If the engineer who receives the HANDOFF.md finds >50% of the imported constraints and questions useful: keep. If not: simplify to "display prior artifact as context" without automatic extraction.

### 6. Dynamic Question Discovery Extraction Reliability (Deferred)
**What:** Check whether research subagents reliably embed the `# --- PROPOSED QUESTIONS ---` YAML block, and whether regex extraction and LLM deduplication work correctly.
**Why sixth:** This is a nice-to-have feature. If it doesn't work, it fails silently (no questions proposed) and nothing breaks.
**Decision criteria:** If >50% of research runs produce parseable proposed questions: keep. If <50%: simplify the prompt or remove the feature.

---

## Platform Risk Assessment

### Scenario 1: MCP-Heavy Researcher (5+ MCP Sources)

A developer has GitHub, Confluence, Jira, Linear, and a custom internal MCP server configured. They create a research lifecycle with 15 questions touching all 5 sources.

**Source routing pressure:** The source-affinity batching algorithm targets 3-5 batches. With 5 MCP sources + web + codebase = 7 potential source types, the batching algorithm will need to aggressively merge small batches. Questions requiring rare MCP sources (e.g., only 1 question needs Linear data) will be bundled with other MCP questions, which means the researcher agent for that batch needs `allowed-tools` access to multiple MCP servers.

**Scaling concern:** The `mcp-researcher.md` template is designed for generic MCP research. It does not contain source-specific instructions for each possible MCP server. A researcher agent dispatched with tools for 3 different MCP servers (GitHub + Jira + Linear) may struggle to use all three effectively, especially since MCP tool APIs vary significantly.

**Verdict:** Source routing DOES NOT scale gracefully past 3-4 source types. The design's 3-5 batch target works well for the common case (web + codebase + 1 MCP) but degrades for MCP-heavy configurations. **Mitigation:** For v1, this is acceptable because the user base is likely single-developer with 1-2 MCP sources. For v1.1, consider per-MCP-server template fragments that can be composed into the generic MCP researcher template.

**Design risk:** MEDIUM. The batching algorithm's merge-small-batches heuristic becomes unpredictable with many source types.

### Scenario 2: Long Research Cycle (20+ Questions, Gap-Fill Rounds)

A complex architecture investigation starts with 15 questions, discovers 5 more during research, and goes through 2 recycle rounds before passing G2.

**State management pressure:** state.yml with 20 questions and 3 gate_history entries and task metadata: approximately 150-180 lines. This exceeds the "under 100 lines" target but remains within practical YAML parsing limits. Per-question flat metadata (8 fields per question * 20 questions = 160 lines for questions alone) is the scaling bottleneck.

**Research round accumulation:** After 2 gap-fill rounds, the evidence directory contains: 3-5 initial evidence files, `round-2/supplement-*.md`, `round-3/supplement-*.md`, initial SYNTHESIS.md, `round-2/supplement-synthesis.md`, `round-3/supplement-synthesis.md`. The synthesis agent for round 3 must read ALL prior evidence plus both supplement syntheses. This is a ~50K+ token prompt.

**Sufficiency assessment at scale:** With 20 questions, inline sufficiency assessment in the main session means evaluating 20 questions sequentially. At ~500 tokens per evaluation, this is ~10K tokens of evaluation work. If evaluation is slow (30-60 seconds per question), the total assessment takes 10-20 minutes.

**Verdict:** State management HOLDS but gets bulky. Synthesis prompts grow significantly. Sufficiency assessment becomes a bottleneck. **Mitigation:** The design's gap-fill mode re-batches by decision area (not original source), which helps keep gap-fill rounds smaller. The synthesis agent uses opus (high-context model), so 50K prompts are feasible. Consider batching sufficiency assessment (evaluate 5 questions at once instead of one-by-one) if latency becomes an issue.

**Design risk:** MEDIUM-LOW. The design handles this scenario but performance will degrade. 20+ questions should be a soft warning in scope ("Consider narrowing scope to 15 questions or fewer for faster research").

### Scenario 3: Cross-Lifecycle Handoff (Product to Engineering HANDOFF.md Import)

A PM completes a product lifecycle, generating HANDOFF.md. They share the file with an engineer. The engineer places it in their project's `.arc/design/HANDOFF.md` and runs `/arc:scope`.

**Import detection:** The scope skill scans `.arc/design/HANDOFF.md` and `.arc/archive/*/HANDOFF.md`. If the engineer places the file at the expected location, detection works. If they place it elsewhere (e.g., project root, a docs folder), detection fails silently.

**Constraint extraction reliability:** The scope skill must parse HANDOFF.md's structured sections, extract "Key Decisions (LOCKED)" as constraints, and extract "Suggested Engineering Questions" as proposed questions. This requires the HANDOFF.md to follow the expected format exactly. Since the same tool (arc) generated it, format compliance is likely -- but if the PM manually edited HANDOFF.md before sharing, sections may be renamed, reordered, or reformatted.

**Lock enforcement through lifecycle:** Extracted constraints are stored in state.yml as `constraints: ["Use SwiftUI, not UIKit (LOCKED from prior design)"]`. These must survive through research, design, and plan phases. The design injects constraints into phase prompts, but there is no programmatic enforcement -- the LLM must honor the constraint through prompt instruction alone. Over a multi-hour lifecycle, constraint drift is likely.

**AskUserQuestion for import:** The import prompt uses AskUserQuestion (header: "Import", options: ["Import as context", "Skip", "Review first"]). AskUserQuestion has a 60-second timeout that returns empty strings. If the user is slow to respond, the import defaults to... nothing is specified. The error handling table mentions "AskUserQuestion timeout (60s) for import -- Default to skip" but this timeout behavior is undocumented in the import flow itself.

**Verdict:** The novel format WORKS in the happy path but is fragile to manual editing, placement errors, constraint drift, and timeout edge cases. **Mitigation:** Add a "looking for HANDOFF.md" message that tells the user where to place the file. Add a format validation step before constraint extraction. Strengthen constraint enforcement with explicit constraint-check criteria in G3 and G4.

**Design risk:** MEDIUM-HIGH. Multiple failure modes, none catastrophic individually but collectively reducing trust in the feature.

---

## Recommended Checkpoints

### Checkpoint 1: After 3 Completed Lifecycles (~Week 1-2 of Usage)

**What to check:**
- Research SKILL.md orchestration reliability (metric #11). Did all 11 steps execute on all 3 runs?
- Categorical sufficiency consistency. Are COVERED/PARTIAL/NOT COVERED ratings stable across invocations?
- G2 first-pass rate (metric #2). Are the count-based criteria ("majority COVERED") reasonable?
- Any crashes, hangs, or unexpected behavior in state management?

**Decision criteria:**
- If research SKILL.md fails on >1 of 3 runs: split into sub-skills
- If categorical ratings fluctuate on identical evidence: investigate prompt clarity (unlikely based on research-engine precedent)
- If G2 passes 100% on first try: criteria are too lenient, tighten
- If G2 passes 0% on first try: criteria are too strict, loosen

### Checkpoint 2: After 5 Completed Lifecycles (~Week 3-4)

**What to check:**
- Override rate (metric #4). Are gates adding value or just blocking?
- Design revision rounds (metric #7). Are developers revising or rubber-stamping?
- Dynamic question discovery acceptance (metric #9). Are proposed questions useful?
- SessionStart hook success rate (metric #6). Does it work at all?

**Decision criteria:**
- If override rate >30%: gates are too strict. Loosen thresholds or reduce MUST criteria.
- If revision rounds average <0.3: consider removing the revision cycle (it may be unnecessary ceremony).
- If discovery acceptance <15%: disable dynamic question discovery (it is producing noise).
- If hook success rate is 0%: remove the hook entirely and rely on the other two fallback layers.

### Checkpoint 3: After 10 Completed Lifecycles (~Month 2)

**What to check:**
- Lifecycle completion rate (metric #1). Are developers finishing what they start?
- Research phase duration (metric #5). Is it performant?
- Which phases are the drop-off points?
- Intent distribution. Is product intent being used at all?

**Decision criteria:**
- If completion rate <40%: investigate drop-off point. If scope: scope is too tedious. If research: orchestration problems. If design: design quality issues.
- If research duration consistently >20 min: consider raising the concurrency limit or simplifying the flow.
- If product intent <10% of lifecycles: deprioritize product-specific features in v1.1.

### Checkpoint 4: After First Cross-Lifecycle Pair (Whenever It Occurs)

**What to check:**
- HANDOFF.md utility: Did the engineer find it useful?
- Import flow: Did detection and extraction work?
- Constraint lock: Were LOCKED constraints honored through the engineering lifecycle?
- Section utility: Which HANDOFF.md sections were referenced?

**Decision criteria:**
- If engineer found <3 of 9 sections useful: revise the section list.
- If constraint lock failed: strengthen enforcement or abandon automatic lock in favor of advisory.
- If import flow was confusing: simplify to "display artifact, user extracts manually."

---

## Overall Confidence Statement

This is a strong design with an honest evidence base and well-calibrated self-awareness about its own weak points. The foundation -- plugin architecture, state management, subagent orchestration, prompt templates -- is built on directly proven patterns from two production reference implementations and can be built with high confidence. The design philosophy of choosing "the simpler proven option over the more capable speculative one" has served it well, and the result is a system where the majority of components have STRONG evidence backing. The adoption of the categorical sufficiency model (COVERED/PARTIAL/NOT COVERED) from research-engine eliminates what was previously the design's biggest risk area, replacing speculative numeric thresholds with a proven qualitative approach.

The concentrated risk is now in two areas: the research SKILL.md orchestration complexity and the intent-adaptive features. The research SKILL.md is the most complex single-file orchestration in the design with 11 steps and no reference implementation at that complexity. The backlog correctly identifies the mitigation (split into sub-invocations), and this should be on a short trigger -- if the first 2-3 research cycles show any step-skipping or ordering issues, split immediately rather than trying to fix the prompt. The intent-adaptive features, particularly HANDOFF.md and cross-lifecycle import, are novel enough that they should be treated as hypotheses to validate rather than specifications to implement faithfully.

The gate system now rests on a solid foundation. The categorical sufficiency model is proven by research-engine, and count-based gate criteria ("majority of questions COVERED", "all P0 questions COVERED or PARTIAL") are straightforward to evaluate and unlikely to produce inconsistent results. If finer granularity is needed later, the design's backlog correctly identifies numeric scoring as a v1.1 upgrade candidate.

Overall, I would rate this design as ready for implementation. The highest-priority validation items are research SKILL.md orchestration reliability and HANDOFF.md format utility -- both "build it and see" risks that cannot be resolved through further design work. Everything else -- the plugin structure, state management, prompt templates, gate system, source routing, execute phase, telemetry -- can be built with confidence.
