# Phase 3: Prompt Template System - Context

**Gathered:** 2026-03-02
**Status:** Ready for planning

<domain>
## Phase Boundary

Create all prompt templates that skills and subagents reference at invocation time. Templates define how researcher agents, the sufficiency evaluator, the design guide, and other components behave -- including how they adapt to product vs. engineering intent. This phase produces FILES only (no orchestration logic, no state management, no skill wiring).

Scope: 9 template files across 5 skill reference directories, each following the 8-section XML structure specified in PRODUCT-DESIGN.md.

</domain>

<decisions>
## Implementation Decisions

### File Organization (from PRODUCT-DESIGN.md)
- Templates live in skill-level `references/` directories, co-located with the skill that consumes them
- Naming convention: `prompt-{purpose}.md`
- Subagent templates include YAML frontmatter with `subagent_type` and `model`
- Inline/reference templates have NO frontmatter -- they are reference material loaded by SKILL.md

### Template Inventory (from PRODUCT-DESIGN.md)
| Template | Location | Model | Type |
|----------|----------|-------|------|
| prompt-scope-questioning.md | scope/references/ | N/A | Main session reference |
| prompt-web-researcher.md | research/references/ | sonnet | Subagent prompt |
| prompt-codebase-analyst.md | research/references/ | sonnet | Subagent prompt |
| prompt-mcp-researcher.md | research/references/ | sonnet | Subagent prompt |
| prompt-research-synthesizer.md | research/references/ | opus | Subagent prompt |
| prompt-sufficiency-evaluator.md | research/references/ | N/A | Inline rubric |
| prompt-design-guide.md | design/references/ | N/A | Reference guide |
| prompt-plan-guide.md | plan/references/ | N/A | Reference guide |
| prompt-task-verifier.md | execute/references/ | N/A | Reference guide |

### 8-Section XML Structure (from PRODUCT-DESIGN.md)
Every template follows this structure:
1. `<role>` -- Concrete expertise, operating context within lifecycle
2. `<context>` -- Minimal: only what this agent needs
3. `<intent_lens>` -- Conditional product vs engineering focus
4. `<downstream_consumer>` -- Who reads output, what they need
5. `<instructions>` -- Numbered step-by-step with explicit tool guidance
6. `<output_format>` -- Schema-first, dual-target for subagents (file + return)
7. `<quality_gate>` -- Checklist self-verification before completing
8. `<input_data>` -- Actual questions/tasks, placed last per Anthropic recommendation

### Intent Lens Mechanism (from PRODUCT-DESIGN.md)
- Every template includes `<intent_lens>` with conditional product/engineering guidance
- Product: user needs, market validation, business outcomes, user quotes, behavior data
- Engineering: architecture decisions, implementation feasibility, performance, technical trade-offs
- Conditional sections in `<instructions>` and `<output_format>` (3-5 lines each) switch on intent
- Orchestrator resolves conditions before the LLM sees the prompt

### Token Budget Targets (from PRODUCT-DESIGN.md)
| Template | Prompt Size | Agent Work | File Output | Inline Return |
|----------|-------------|-----------|-------------|---------------|
| Researcher (per batch) | ~5K | ~20-30K | ~1-3K per question | ~500 |
| Synthesizer | ~15-20K | ~50-80K | Unconstrained | ~500 |
| Sufficiency evaluator | ~2K (inline) | N/A | N/A | N/A |
| Design guide | ~3-5K (reference) | N/A | N/A | N/A |

### Decision-Over-Task Contract Chain (user-mandated pattern)
Templates MUST enforce the contract chain principle throughout:

**Unbroken chain:** decision area -> evidence requirement -> research finding -> design decision -> task acceptance criteria -> verified code change

Specific enforcement points in templates:
- **Researcher templates**: Receive specific evidence requirements as targets, not vague topics. Must produce evidence that is checkable against requirements (COVERED / PARTIALLY COVERED / NOT COVERED)
- **Sufficiency evaluator**: Checks each requirement mechanically against evidence. Categorical assessments, not numeric scores. No vibes-based evaluation.
- **Synthesizer template**: Organizes by theme not source. Must flag gaps honestly. Claims require cross-reference verification.
- **Design guide**: Design decisions must reference which evidence supports them. No decision without traceable evidence basis.
- **Plan guide**: Task acceptance criteria trace back to design decisions. Criteria derived from decisions, not invented independently.
- **Task verifier**: Verifies code changes address the design decision they trace to, not just pass a disconnected check.

Supporting prompt-level patterns to enforce in ALL templates:
- Mandatory output sections (not "write what you think is important")
- Numeric minimums over vague instructions ("5-8 distinct searches" not "research thoroughly")
- Cross-referencing as mandatory for claims
- Contrarian perspective seeking (explicitly required)
- Honest gap flagging at every stage

### Claude's Discretion
- Exact prose and wording within each template section
- Specific tool lists per researcher type (informed by what tools are available)
- Precise formatting of output schemas
- How template variables/placeholders are denoted (e.g., `{{VAR}}` vs `{VAR}`)

</decisions>

<specifics>
## Specific Ideas

- The decision-over-task pattern doc (decision-over-task-pattern-v2.md) is the philosophical foundation for the entire plugin. Every template should embody this pattern -- decisions surface before work, evidence requirements are typed contracts, each stage stays in its lane.
- "Name DECISIONS (choices between alternatives), not STEPS (things to do)" -- this principle applies directly to how researcher instructions are framed and how the sufficiency evaluator assesses completeness.
- Separation of concerns: researchers find evidence (don't recommend), synthesizer integrates (doesn't decide), design decides (references evidence). Templates must enforce these boundaries.
- PRODUCT-DESIGN.md sections 1254-1337 contain the authoritative template architecture specification.

</specifics>

<deferred>
## Deferred Ideas

None -- discussion stayed within phase scope. All template content decisions are within Phase 3 boundary.

</deferred>

---

*Phase: 03-prompt-template-system*
*Context gathered: 2026-03-02*
