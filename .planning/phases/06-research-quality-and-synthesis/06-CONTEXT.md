# Phase 6: Research Quality and Synthesis - Context

**Gathered:** 2026-03-04
**Status:** Ready for planning

<domain>
## Phase Boundary

Assess research output for sufficiency against evidence requirements defined in scope, fill gaps through targeted re-research, surface dynamically discovered questions, and produce a SYNTHESIS.md artifact for downstream design consumption. This phase covers the G2 gate, gap-fill dispatch, and synthesis generation.

</domain>

<decisions>
## Implementation Decisions

### Sufficiency Evaluation Model
- UNAVAILABLE-SOURCE short-circuits to the user for a decision (consistent with Phase 5 circuit breaker pattern) — do not waste gap-fill cycles on genuinely unavailable information
- User leans toward per-question evaluation (each question assessed independently against its evidence requirements), but Claude has discretion to adjust if per-DA grouping produces better results

### G2 Gate Behavior
- User approves every recycle — each recycle pauses to show what's still missing and asks before running gap-fill
- Go-with-advisory: pause and show the user what's weak, let them decide whether to resolve gaps or proceed. If they proceed, advisory section flows into SYNTHESIS.md
- Override records severity level and injects specific gap context into downstream design prompts so the designer knows what was skipped
- Structural separation for anti-bias: evaluator agent only receives evidence files and scope — never sees dispatch logic, agent metadata, or research agent reasoning

### Gap-Fill Dispatch
- Supplements are additive (new evidence alongside originals, nothing overwritten) — gaps are typically about missing depth, not incorrect information
- Gap-fill agents batched by DA, same as first-round research dispatch
- Dynamic question discovery happens in all rounds (including gap-fill), not just first round — filling a gap can reveal unexpected areas that matter

### Contested Evidence
- SYNTHESIS.md must explicitly flag contested findings where sources disagree, presenting both sides so the designer can make informed trade-offs

### Claude's Discretion
- Rating approach: independent dimension ratings with roll-up vs holistic judgment — guided by decision-over-task philosophy and prompt reliability
- DA depth calibration: how Deep vs Light DAs set different bars for scoring
- Gap-fill agent prompting: targeted instructions with evaluator notes vs same template with narrower scope
- SYNTHESIS.md structure: by DA vs by question — optimize for downstream design quality
- Evidence traceability level in synthesis
- Advisory placement in synthesis (separate section vs inline with DA findings)

</decisions>

<specifics>
## Specific Ideas

- UNAVAILABLE-SOURCE handling should mirror the Phase 5 circuit breaker pattern — user decides how to proceed, not an automatic retry loop
- "I'm not sure on this but make the determination for what would produce the best output and research quality overall" — user trusts Claude's judgment on synthesis structure
- Additive supplements rationale: "the research agent wouldn't/shouldn't produce incorrect information, it would just lack some additional info"

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 06-research-quality-and-synthesis*
*Context gathered: 2026-03-04*
