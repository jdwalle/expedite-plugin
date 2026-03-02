# Phase 3: Prompt Template System - Research

**Researched:** 2026-03-02
**Domain:** Prompt template architecture for Claude Code plugin subagents and inline references
**Confidence:** HIGH

## Summary

Phase 3 creates 9 static prompt template files across 5 skill `references/` directories. This is a FILE-CREATION phase with no orchestration logic, no state management, and no runtime behavior. The templates define how researcher agents, the sufficiency evaluator, the design guide, the plan guide, the scope questioning guide, and the task verifier behave -- including how they adapt to product vs. engineering intent via conditional `<intent_lens>` sections.

The 8-section XML structure is well-validated by converging evidence from three design proposals, two reference implementations (research-engine and GSD), and current Anthropic prompt engineering guidance. The key structural principle -- "instructions precede data, role first, input last" -- is confirmed by official Anthropic documentation (2026). The contract chain principle from the product design must be enforced at every template boundary: researchers receive typed evidence requirements (not vague topics), the sufficiency evaluator checks against those requirements mechanically, the synthesizer organizes by theme and flags gaps honestly, the design guide requires evidence traceability for every decision, the plan guide requires acceptance criteria to trace back to design decisions, and the task verifier confirms code changes address the design decision they trace to.

There are two categories of templates: (1) **subagent prompts** with YAML frontmatter (`subagent_type`, `model`) used by the research SKILL.md to spawn Task() agents, and (2) **inline/reference templates** with NO frontmatter loaded by their respective SKILL.md into the main session context. The distinction is critical -- frontmatter is how the orchestrator knows what model and subagent type to use.

**Primary recommendation:** Create all 9 templates following the 8-section XML structure from PRODUCT-DESIGN.md, with strict separation between subagent templates (frontmatter) and inline references (no frontmatter). Use `{{double_braces}}` for template variables. Enforce the contract chain at every template boundary through mandatory output sections and cross-reference requirements.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Templates live in skill-level `references/` directories, co-located with the skill that consumes them
- Naming convention: `prompt-{purpose}.md`
- Subagent templates include YAML frontmatter with `subagent_type` and `model`
- Inline/reference templates have NO frontmatter -- they are reference material loaded by SKILL.md
- Template inventory is fixed at 9 templates across 5 skill directories (see inventory table below)
- 8-Section XML Structure: role, context, intent_lens, downstream_consumer, instructions, output_format, quality_gate, input_data
- Intent Lens Mechanism: every template includes `<intent_lens>` with conditional product/engineering guidance; conditional sections in `<instructions>` and `<output_format>` (3-5 lines each) switch on intent; orchestrator resolves conditions before the LLM sees the prompt
- Token Budget Targets: ~5K per researcher prompt, ~15-20K synthesizer, ~2K sufficiency evaluator, ~3-5K design guide
- Decision-Over-Task Contract Chain: templates MUST enforce the unbroken chain (decision area -> evidence requirement -> research finding -> design decision -> task acceptance criteria -> verified code change) with specific enforcement points per template
- Supporting prompt-level patterns: mandatory output sections, numeric minimums over vague instructions, cross-referencing as mandatory for claims, contrarian perspective seeking, honest gap flagging

### Claude's Discretion
- Exact prose and wording within each template section
- Specific tool lists per researcher type (informed by what tools are available)
- Precise formatting of output schemas
- How template variables/placeholders are denoted (e.g., `{{VAR}}` vs `{VAR}`)

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope. All template content decisions are within Phase 3 boundary.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| TMPL-01 | All prompt templates follow 8-section XML structure: role, context, intent_lens, downstream_consumer, instructions, output_format, quality_gate, input_data | PRODUCT-DESIGN.md lines 1256-1302 define the canonical structure. Anthropic docs confirm XML tag structuring, role-first ordering, and data-last placement. STACK.md validates as STRONG convergent evidence. |
| TMPL-02 | Templates use conditional `<intent_lens>` sections for product vs engineering adaptation | PRODUCT-DESIGN.md lines 1320-1326 define the dual mechanism (lens injection + conditional sections). Research-engine proves the `<intent_lens>` pattern. Pitfall P8 (conditional section leakage) provides prevention strategies. |
| TMPL-03 | Model tiers hardcoded in frontmatter: sonnet for researchers, opus for synthesis | PRODUCT-DESIGN.md lines 1090-1101 specify tier assignments. Decision #3 in design register. Research-engine exact pattern, ROCK SOLID confidence. |
| TMPL-04 | 3 per-source researcher templates: web-researcher.md, codebase-researcher.md, mcp-researcher.md | PRODUCT-DESIGN.md lines 1306-1311 inventory. Decision #12 in design register. Research-engine demonstrates per-source templates with source-specific tool sets. |
| TMPL-05 | Sufficiency evaluator reference template for inline assessment | PRODUCT-DESIGN.md lines 1357-1385 define the 3-dimension categorical rubric (Coverage, Corroboration, Actionability). Lines 571-580 define the evidence-requirement-based assessment. Inline, no frontmatter. |
| TMPL-06 | Design guide reference template with intent-conditional sections | PRODUCT-DESIGN.md lines 659-698 define design generation flow. Engineering = RFC, Product = PRD. Contract chain: every DA must have a decision referencing evidence. |
</phase_requirements>

## Standard Stack

### Core

This phase creates static Markdown files only. No libraries, frameworks, or build tools are needed.

| Component | Format | Purpose | Why Standard |
|-----------|--------|---------|--------------|
| Markdown + XML tags | `.md` files | Template content with XML-tagged sections | Anthropic docs confirm XML tags as Claude's "secret weapon" for context isolation; proven in research-engine |
| YAML frontmatter | `---` fences | Subagent metadata (subagent_type, model) | Research-engine exact pattern; Claude Code plugin architecture standard |
| `{{double_braces}}` | Variable syntax | Template placeholders for dynamic content | Shell-safe, LLM convention; STACK.md MEDIUM confidence but design-mandated |

### Supporting

| Pattern | Purpose | When to Use |
|---------|---------|-------------|
| `<if_intent_product>` / `<if_intent_engineering>` | Conditional intent sections | Inside `<instructions>` and `<output_format>` where behavior differs by intent |
| `<source_handling>` / `<source_status>` | Circuit breaker reporting | In all 3 researcher templates for error classification |
| `# --- PROPOSED QUESTIONS ---` | Dynamic question discovery marker | In researcher templates for new question proposals |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `{{double_braces}}` | `{single_braces}` or `$variable` | Single braces conflict with YAML/JSON; `$variable` would be interpreted by shell. Double braces are shell-safe. |
| Single template with conditionals | Separate per-intent templates | Avoids leakage risk but doubles file count and creates drift. Design chose single + conditionals. |
| XML section tags | Markdown headers | XML creates semantic boundaries Claude interprets structurally; Markdown is ambiguous for nested sections. |

## Architecture Patterns

### Recommended Project Structure

```
skills/
  scope/
    references/
      prompt-scope-questioning.md        # Inline reference (no frontmatter)
  research/
    references/
      prompt-web-researcher.md           # Subagent prompt (sonnet)
      prompt-codebase-analyst.md         # Subagent prompt (sonnet)
      prompt-mcp-researcher.md           # Subagent prompt (sonnet)
      prompt-research-synthesizer.md     # Subagent prompt (opus)
      prompt-sufficiency-evaluator.md    # Inline reference (no frontmatter)
  design/
    references/
      prompt-design-guide.md             # Inline reference (no frontmatter)
  plan/
    references/
      prompt-plan-guide.md              # Inline reference (no frontmatter)
  execute/
    references/
      prompt-task-verifier.md           # Inline reference (no frontmatter)
```

### Pattern 1: Subagent Prompt Template (with frontmatter)

**What:** Templates used as prompts for Task()-spawned subagents. Include YAML frontmatter with `subagent_type` and `model`.

**When to use:** For the 4 research subagent templates (web-researcher, codebase-analyst, mcp-researcher, research-synthesizer).

**Structure:**
```markdown
---
subagent_type: general-purpose
model: sonnet
---

<role>
[Concrete expertise. Operating context within the lifecycle.]
</role>

<context>
Project: {{project_name}}
Intent: {{intent}}
Phase: Research

<intent_lens>
<if_intent_product>
Focus on user needs, market positioning, business viability, and measurable outcomes.
Prioritize user quotes, behavior data, market reports, and competitive analysis.
</if_intent_product>
<if_intent_engineering>
Focus on architecture decisions, implementation feasibility, performance characteristics, and technical trade-offs.
Prioritize production measurements, reference implementations, technical docs, and benchmarks.
</if_intent_engineering>
</intent_lens>
</context>

<downstream_consumer>
[Who reads this output and what they need from it.]
</downstream_consumer>

<instructions>
[Numbered steps with explicit tool guidance.]
</instructions>

<output_format>
[Schema-first. Dual-target: file output path + condensed inline return (max 500 tokens).]
</output_format>

<quality_gate>
Before completing, verify:
- [ ] [Criterion 1]
- [ ] [Criterion 2]
If any check fails, revise before completing.
</quality_gate>

<input_data>
{{questions_yaml_block}}
</input_data>
```

**Source:** PRODUCT-DESIGN.md lines 1256-1302; STACK.md "Prompt Template Format" section

### Pattern 2: Inline Reference Template (no frontmatter)

**What:** Templates loaded as reference material into the main session context. No frontmatter because they are not spawned as subagents.

**When to use:** For sufficiency-evaluator, design-guide, plan-guide, task-verifier, and scope-questioning templates.

**Structure:**
```markdown
<role>
[Evaluation/guidance expertise.]
</role>

<context>
[What the main session agent needs to know when using this reference.]
</context>

<intent_lens>
[Product vs engineering conditional guidance.]
</intent_lens>

<downstream_consumer>
[Who benefits from this evaluation/guidance.]
</downstream_consumer>

<instructions>
[How to apply this reference material.]
</instructions>

<output_format>
[Expected assessment or output structure.]
</output_format>

<quality_gate>
[Self-check criteria.]
</quality_gate>

<input_data>
[Placeholder for dynamic content injected by SKILL.md orchestrator.]
</input_data>
```

### Pattern 3: Intent Conditional Sections

**What:** Small blocks (3-5 lines) within `<instructions>` and `<output_format>` that switch behavior based on product vs. engineering intent. The orchestrator resolves these before the LLM sees the prompt.

**When to use:** In every template where behavior differs by intent.

**Implementation:**
```markdown
<instructions>
...
5. Evaluate evidence quality:
<if_intent_product>
   - Prioritize user quotes, behavior data, market reports
   - Weight user-facing impact over technical depth
   - Flag missing user validation data
</if_intent_product>
<if_intent_engineering>
   - Prioritize production measurements, reference implementations, benchmarks
   - Weight architectural soundness over user impact
   - Flag missing performance data
</if_intent_engineering>
...
</instructions>
```

**Source:** PRODUCT-DESIGN.md lines 1320-1326; Pitfall P8 prevention strategy

### Pattern 4: Contract Chain Enforcement

**What:** Each template includes explicit instructions that enforce the unbroken decision-evidence-design-task chain.

**When to use:** In every template. The specific enforcement varies by template role.

**Implementation per template:**

| Template | Chain Enforcement |
|----------|------------------|
| Researcher templates | Receive evidence requirements as targets. Must produce evidence checkable against requirements. Output must tag which requirements each finding addresses. |
| Sufficiency evaluator | Checks each requirement mechanically against evidence. Categorical assessments (COVERED/PARTIAL/NOT COVERED). No vibes-based evaluation. |
| Synthesizer | Organizes by theme not source. Must flag gaps honestly. Claims require cross-reference verification. |
| Design guide | Design decisions must reference which evidence supports them. No decision without traceable evidence basis. |
| Plan guide | Task acceptance criteria trace back to design decisions. Criteria derived from decisions, not invented independently. |
| Task verifier | Verifies code changes address the design decision they trace to, not just pass a disconnected check. |
| Scope questioning | Questions map to decision areas. Each question has evidence requirements. |

### Anti-Patterns to Avoid

- **No frontmatter on inline templates:** Adding frontmatter to design-guide, plan-guide, sufficiency-evaluator, task-verifier, or scope-questioning would confuse the SKILL.md orchestrator into trying to spawn them as subagents
- **Vague instructions ("research thoroughly"):** Use numeric minimums instead ("5-8 distinct searches", "at least 2 corroborating sources for Deep DAs")
- **Intent leakage between conditionals:** Use explicit `<if_intent_product>` / `<if_intent_engineering>` XML delimiters with a clear instruction to IGNORE the inactive intent section (Pitfall P8 prevention)
- **Exceeding token budgets:** Researcher templates must stay under ~5K tokens. If the base template + per-question inlining exceeds this, reduce batch size (Pitfall P5)
- **Missing `<input_data>` section:** Every template must end with `<input_data>` per Anthropic's recommendation that instructions precede data
- **Output format without dual targets:** Subagent templates must specify BOTH the file output path AND the condensed inline return format (~500 tokens)

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Template variable substitution | A real template engine (Handlebars, Mustache, etc.) | LLM-based substitution in SKILL.md orchestrator | Plugin is prompt-as-code -- the LLM replaces `{{variables}}` as part of orchestration logic. No build step, no dependencies. |
| Intent resolution | Runtime conditional logic | Orchestrator resolves `<if_intent_*>` blocks before passing to LLM | The SKILL.md reads intent from state.yml and strips the inactive conditional blocks before constructing the final prompt |
| Sufficiency scoring | Numeric scoring system | Categorical rubric (COVERED/PARTIAL/NOT COVERED) | Proven in research-engine. LLMs produce more stable categorical judgments than numeric scores. Avoids calibration dependency. |
| Output validation | JSON schema validation | Self-check `<quality_gate>` section | Templates are checked by the producing agent. Structural validation happens in the consuming SKILL.md orchestrator. |

**Key insight:** Templates are static files that contain prompt instructions. All dynamic behavior (variable substitution, intent resolution, batch construction) happens in the SKILL.md orchestrator at invocation time, not in the template itself.

## Common Pitfalls

### Pitfall 1: Conditional Section Leakage (P8)
**What goes wrong:** Content from the inactive intent section leaks into output. An engineering lifecycle produces a design with "Personas" or a product lifecycle includes "Alternatives Considered."
**Why it happens:** The LLM reads both conditional blocks and does not fully ignore the inactive one.
**How to avoid:** Use explicit XML delimiters (`<if_intent_product>` / `<if_intent_engineering>`). Include instruction: "You are in {{intent}} mode. IGNORE all content within the inactive intent tags." List EXACT expected output sections for each intent in `<output_format>`.
**Warning signs:** Output contains sections from the wrong intent format.

### Pitfall 2: Prompt Context Explosion (P5)
**What goes wrong:** Research agent prompts exceed ~5K tokens when batch questions, source config, gap details, and evidence requirements are all inlined.
**Why it happens:** The base template + per-question content grows with batch size.
**How to avoid:** Keep base template lean. Budget: ~2K base template + ~600 per question = ~5K for 5 questions. If exceeded, reduce batch size to 3-4. Place highest-priority content (questions, output format) at beginning and end.
**Warning signs:** Agents ignore later questions in a batch; dynamic question discovery instructions are skipped.

### Pitfall 3: Missing Contract Chain Traceability
**What goes wrong:** Templates produce output that cannot be mechanically traced back to upstream requirements.
**Why it happens:** Instructions say "research the topic" instead of "find evidence for these specific requirements."
**How to avoid:** Every researcher instruction must reference evidence requirements by ID. Sufficiency evaluator must assess against typed requirements, not general coverage. Design guide must require evidence citations per decision. Plan guide must require design decision citations per acceptance criterion.
**Warning signs:** Downstream phases invent criteria not traceable to any upstream decision area.

### Pitfall 4: Subagent vs Inline Template Confusion
**What goes wrong:** A template with frontmatter is used as inline reference, or an inline template is passed to Task() without frontmatter.
**Why it happens:** Unclear convention about which templates get frontmatter.
**How to avoid:** Strict rule: only the 4 research subagent templates + 1 synthesizer template have frontmatter. The remaining 4 templates (scope-questioning, sufficiency-evaluator, design-guide, plan-guide, task-verifier) NEVER have frontmatter.
**Warning signs:** SKILL.md tries to read `subagent_type` from a template that has none; or a template is spawned as a Task() agent when it should be loaded inline.

### Pitfall 5: Self-Grading Bias in Quality Gate Sections (P2)
**What goes wrong:** The `<quality_gate>` section is perfunctory and always "passes."
**Why it happens:** The agent evaluating its own output is biased toward approval.
**How to avoid:** Include anti-bias instructions in `<quality_gate>`: "Evaluate as if this output was produced by someone else. Your default assumption should be that criteria are NOT met until you find specific evidence." Require per-criterion evidence strings, not just PASS/FAIL.
**Warning signs:** Quality gate always passes on first attempt with thin justification.

## Code Examples

### Example 1: Researcher Template Frontmatter

```yaml
---
subagent_type: general-purpose
model: sonnet
---
```

Use `general-purpose` for web and MCP researchers (needs full tool access including MCP). Use `general-purpose` for codebase analyst too (the design initially considered `explore` but MCP tools require general-purpose -- per GitHub #13254, #19964). All researchers use sonnet.

**Source:** PRODUCT-DESIGN.md lines 1090-1101, STACK.md "Prompt Template Frontmatter"

### Example 2: Synthesizer Template Frontmatter

```yaml
---
subagent_type: general-purpose
model: opus
---
```

The synthesizer uses opus for highest-capability judgment (cross-referencing, contradiction detection). Must be `general-purpose` for file access.

**Source:** PRODUCT-DESIGN.md line 1097

### Example 3: Sufficiency Evaluator Rubric Structure

```markdown
<instructions>
For each question, assess against the evidence requirements defined in scope:

1. **Coverage:** Does the evidence meet the specific evidence requirements?
   - Strong: All requirements addressed with specific examples or data
   - Adequate: Most requirements addressed, minor gaps remain
   - Weak: Only superficially addressed or key requirements missing
   - None: Not addressed by any evidence

2. **Corroboration:** Do multiple independent sources agree?
   - Strong: 3+ independent sources converge
   - Adequate: 2 sources agree with consistent evidence
   - Weak: Single source only, or partial disagreement
   - None: Sources contradict or no relevant sources found
   (Calibrate by DA depth: Deep DAs require Strong/Adequate; Light DAs accept Adequate/Weak)

3. **Actionability:** Can the design phase use this evidence directly?
   - Strong: Directly translates to design decisions with clear trade-offs
   - Adequate: Provides direction with minor interpretation needed
   - Weak: Too abstract for specific decisions
   - None: Does not inform design choices

4. **Categorical Rating:**
   - COVERED: Coverage strong/adequate AND corroboration strong/adequate AND actionability strong/adequate
   - PARTIAL: At least one dimension adequate+, but one or more is weak
   - NOT COVERED: Any dimension is "none", or multiple are weak
   - UNAVAILABLE-SOURCE: Source failures prevented evidence gathering (distinct from weak evidence)
</instructions>
```

**Source:** PRODUCT-DESIGN.md lines 1357-1385

### Example 4: Circuit Breaker Source Handling Block

```markdown
<source_handling>
For each assigned source tool:
1. Attempt to use the tool for your research.
2. If the tool returns an error:
   a. Server failure (timeout, connection error): retry ONCE. If second fails, stop.
   b. Platform failure (tool not found, "not available"): do NOT retry. Tool is inaccessible.
   c. No relevant results: tool works but returned nothing useful. Continue with other tools.
3. Report all source statuses:
<source_status>
- WebSearch: WORKING (5 queries, 12 results)
- mcp__github__search_code: UNAVAILABLE (PLATFORM FAILURE: tool not found)
</source_status>
</source_handling>
```

**Source:** PRODUCT-DESIGN.md lines 1228-1251

### Example 5: Dynamic Question Discovery Block

```markdown
If during your research you discover important questions that are NOT covered by any existing question,
propose at most 2 new questions using this exact format at the end of your evidence file:

# --- PROPOSED QUESTIONS ---
- text: "What is the latency impact of approach X?"
  priority: "P1"
  decision_area: "performance"
  source_hints: ["web", "codebase"]
  evidence_requirements: "Benchmark data comparing approach X vs alternatives"
  rationale: "Discovered during research that latency varies significantly by implementation"
```

**Source:** PRODUCT-DESIGN.md lines 1387-1394

### Example 6: Condensed Return Format for Subagents

```markdown
<output_format>
Write detailed findings to {{output_file}}.

Return a summary (max 500 tokens):
- KEY FINDINGS: 3-5 bullet points (one line each)
- CONFIDENCE: high | medium | low
- SOURCES: count of distinct sources consulted
- GAPS: list unfulfilled evidence requirements (by requirement ID)
- PROPOSED_QUESTIONS: max 2 new questions (optional, YAML block)
</output_format>
```

**Source:** PRODUCT-DESIGN.md lines 1122-1135

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Free-form prompt instructions | Structured XML sections with semantic boundaries | 2024-2025 | Claude interprets XML tags structurally, leading to dramatically better reasoning on complex tasks (Anthropic docs) |
| Numeric sufficiency scoring (0.0-1.0) | Categorical assessment (COVERED/PARTIAL/NOT COVERED) | Proven by research-engine | More stable LLM judgments; avoids calibration dependency; simpler gate criteria |
| Separate templates per intent | Single template with conditional intent lens | Research-engine pattern | Avoids structural drift; conditionals are 3-5 lines each, manageable |
| Data interspersed with instructions | Instructions first, data last (`<input_data>` at end) | Anthropic best practices (confirmed 2025-2026) | Queries at end can improve response quality by up to 30% with complex inputs |

**Deprecated/outdated:**
- Prefilled responses: No longer supported starting with Claude 4.6 models. Templates should not rely on prefill patterns.
- `@` file references in subagent prompts: Do not work across Task boundaries. All content must be inlined.

## Template Inventory Detail

### Template 1: prompt-scope-questioning.md
**Location:** `skills/scope/references/`
**Type:** Inline reference (no frontmatter)
**Token budget:** ~3-5K
**Purpose:** Guide the main session agent through interactive question plan generation. Provides the structure for how to decompose a user's goal into decision areas, questions, evidence requirements, readiness criteria, and depth calibrations.
**Contract chain role:** Origin point. Defines decision areas with evidence requirements that flow through the entire lifecycle.
**Intent adaptation:** Product intent emphasizes user needs, market context, Cagan's 4 risks. Engineering intent emphasizes architecture, implementation, performance, prior art.

### Templates 2-4: prompt-web-researcher.md, prompt-codebase-analyst.md, prompt-mcp-researcher.md
**Location:** `skills/research/references/`
**Type:** Subagent prompt (frontmatter: `subagent_type: general-purpose`, `model: sonnet`)
**Token budget:** ~5K per prompt (base ~2K + ~600 per question for batch of 5)
**Purpose:** Per-source research agents that gather evidence for batched questions.
**Key differences between the three:**
- **Web researcher:** Tools = WebSearch, WebFetch. Emphasizes web search strategies, source quality evaluation, URL citation.
- **Codebase analyst:** Tools = Grep, Read, Glob, Bash. Emphasizes code exploration patterns, architecture analysis, implementation discovery.
- **MCP researcher:** Tools = `mcp__<server>__*` (wildcards). Emphasizes MCP tool invocation, structured data extraction, API result parsing.
**Contract chain role:** Receive evidence requirements as typed targets. Must produce evidence checkable against requirements.
**Shared features:** All include circuit breaker `<source_handling>`, dynamic question discovery marker, condensed return format, intent lens.

### Template 5: prompt-research-synthesizer.md
**Location:** `skills/research/references/`
**Type:** Subagent prompt (frontmatter: `subagent_type: general-purpose`, `model: opus`)
**Token budget:** ~15-20K (reads all evidence files)
**Purpose:** Synthesize evidence across all research batches into SYNTHESIS.md organized by decision area.
**Contract chain role:** Organizes by theme not source. Must flag gaps honestly. Claims require cross-reference verification. Maps evidence to decision areas and evidence requirements.
**Intent adaptation:** Product: organize around user outcomes and market findings. Engineering: organize around technical feasibility and architecture decisions.

### Template 6: prompt-sufficiency-evaluator.md
**Location:** `skills/research/references/`
**Type:** Inline reference (no frontmatter)
**Token budget:** ~2K
**Purpose:** Per-question sufficiency rubric applied inline by the research SKILL.md orchestrator.
**Contract chain role:** Checks evidence against the evidence requirements defined in scope. Categorical assessment, not numeric. No vibes-based evaluation.
**Key content:** 3-dimension rubric (Coverage, Corroboration, Actionability) with 4 levels each. Categorical mapping to COVERED/PARTIAL/NOT COVERED/UNAVAILABLE-SOURCE. Depth calibration (Deep DAs require stronger corroboration than Light ones).

### Template 7: prompt-design-guide.md
**Location:** `skills/design/references/`
**Type:** Inline reference (no frontmatter)
**Token budget:** ~3-5K
**Purpose:** Guide main-session design generation with quality criteria and format specification.
**Contract chain role:** Every DA from scope MUST have a corresponding design decision. Each decision MUST reference supporting evidence. No decision without traceable evidence basis.
**Intent adaptation:** Engineering = RFC format (context, goals/non-goals, detailed design, alternatives, cross-cutting concerns). Product = PRD format (problem statement, personas, user stories, flows, success metrics, scope boundaries). Lists EXACT expected sections per intent.

### Template 8: prompt-plan-guide.md
**Location:** `skills/plan/references/`
**Type:** Inline reference (no frontmatter)
**Token budget:** ~3-5K
**Purpose:** Guide main-session plan generation with format and acceptance criteria patterns.
**Contract chain role:** Task acceptance criteria trace back to design decisions. Criteria derived from decisions, not invented independently. Every design decision must map to at least one task.
**Intent adaptation:** Engineering = wave-ordered tasks with technical checklists, hour estimates, dependency axis. Product = epics/stories with Given/When/Then criteria, T-shirt sizing, user-value axis.

### Template 9: prompt-task-verifier.md
**Location:** `skills/execute/references/`
**Type:** Inline reference (no frontmatter)
**Token budget:** ~2-3K
**Purpose:** Guide per-task acceptance criteria verification during execution.
**Contract chain role:** Verifies code changes address the design decision they trace to, not just pass a disconnected check. Confirms the contract chain (scope question -> evidence -> design decision -> plan task -> code change) remains unbroken.
**Intent adaptation:** Engineering = technical verification (tests pass, files modified correctly, architecture constraints met). Product = user-facing verification (user flow works, acceptance criteria met, metrics instrumented).

## Open Questions

1. **Exact tool lists per researcher type**
   - What we know: Web researcher uses WebSearch/WebFetch. Codebase analyst uses Grep/Read/Glob/Bash. MCP researcher uses `mcp__<server>__*` wildcards.
   - What's unclear: Whether codebase analyst should use `subagent_type: "explore"` (built-in codebase exploration) or `"general-purpose"`. The design initially mentioned explore for codebase but later noted MCP tools require general-purpose. Since the codebase analyst does NOT use MCP tools, "explore" could be valid.
   - Recommendation: Use `general-purpose` for all three researcher types for consistency. The design doc line 565 mentions explore for codebase but the overall guidance favors general-purpose. Use **general-purpose uniformly** to avoid subtle bugs where a codebase analyst needs a tool not available in explore mode. This is a discretion area per CONTEXT.md.

2. **Orchestrator-side conditional resolution mechanism**
   - What we know: The orchestrator "resolves conditions before the LLM sees the prompt" (CONTEXT.md). Templates use conditional blocks like `<if_intent_product>`.
   - What's unclear: The exact mechanism for resolving conditionals is an orchestration concern (Phase 5+), not a template concern. Phase 3 just needs to place the conditionals correctly.
   - Recommendation: Templates should use clear, parseable conditional markers (e.g., `<if_intent_product>` / `<if_intent_engineering>`) that the future orchestrator can strip/select. The planner should document the chosen marker syntax clearly so Phases 4-5 can implement resolution.

3. **Scope questioning template depth**
   - What we know: It guides interactive questioning for question plan generation. The main session reads it as a reference.
   - What's unclear: How detailed this template should be vs. how much is in the SKILL.md orchestration logic (Phase 4).
   - Recommendation: The template should cover the WHAT (question plan structure, DA format, evidence requirement format, depth calibration definitions) and the intent-specific focus areas. The HOW (interactive flow, freeform prompt mechanics) belongs in the Phase 4 SKILL.md. Keep the template focused on format and quality criteria, not orchestration steps.

## Sources

### Primary (HIGH confidence)
- PRODUCT-DESIGN.md (`.planning/research/arc-implementation/design/PRODUCT-DESIGN.md`) -- Authoritative template architecture specification, lines 1254-1337 (template structure, inventory, intent mechanism, token budgets), lines 1357-1385 (sufficiency rubric), lines 1228-1251 (circuit breaker), lines 1122-1135 (condensed returns)
- STACK.md (`.planning/research/STACK.md`) -- Stack research validating 8-section XML structure as STRONG convergent evidence, template inventory, frontmatter conventions, variable syntax
- ARCHITECTURE.md (`.planning/research/ARCHITECTURE.md`) -- Component inventory confirming 9 templates, build order, component boundaries
- Anthropic Prompt Engineering Best Practices (https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/use-xml-tags) -- Confirmed: XML tags for semantic boundaries, role-setting early, long documents at top with queries at end, consistent descriptive tag names
- Anthropic Prompt Templates Guide (https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/prompt-templates-and-variables) -- Confirmed: `{{double_brackets}}` convention for template variables

### Secondary (MEDIUM confidence)
- FEATURES.md (`.planning/research/FEATURES.md`) -- TS-7 feature entry (prompt template system rated STRONG convergent evidence, LOW complexity)
- PITFALLS.md (`.planning/research/PITFALLS.md`) -- P5 (prompt context explosion), P8 (conditional section leakage), P2 (self-grading bias) -- all directly applicable to template design
- SUMMARY.md (`.planning/research/SUMMARY.md`) -- Synthesis confirming template confidence levels and research-engine ancestry

### Tertiary (LOW confidence)
- None. All findings are backed by primary or secondary sources.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- 8-section XML structure validated by PRODUCT-DESIGN.md, STACK.md, and Anthropic docs
- Architecture: HIGH -- Template inventory, directory placement, frontmatter conventions are precisely specified in the design
- Pitfalls: HIGH -- P5, P8, P2 directly researched with concrete prevention strategies from PITFALLS.md
- Contract chain enforcement: HIGH -- Exhaustively specified per-template in CONTEXT.md decisions and PRODUCT-DESIGN.md

**Research date:** 2026-03-02
**Valid until:** 2026-04-02 (stable domain -- template structure is design-locked, unlikely to change)
