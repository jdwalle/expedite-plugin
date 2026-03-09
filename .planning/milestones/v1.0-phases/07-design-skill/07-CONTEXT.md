# Phase 7: Design Skill - Context

**Gathered:** 2026-03-05
**Status:** Ready for planning

<domain>
## Phase Boundary

Generate a design document (RFC for engineering intent, PRD for product intent) from completed research evidence. Every Decision Area from scope gets a corresponding design decision referencing supporting evidence. Product-intent lifecycles also produce a HANDOFF.md for engineer consumption. User can revise, then G3 gate evaluates quality.

</domain>

<decisions>
## Implementation Decisions

### Design document depth
- Each Decision Area section includes: the decision, rationale (trade-offs considered), and supporting evidence references — approximately 200-400 words per DA
- This applies to both RFC (engineering) and PRD (product) formats

### Revision cycle
- After each revision, summarize what changed before writing the updated file ("Changed DA-3: switched from X to Y. Updated DA-5: added Z consideration.")
- No hard limit on revision rounds — the "up to 2 rounds" requirement is a soft expectation, not a gate. User keeps revising until satisfied, then proceeds to G3 evaluation
- Do not artificially cut the user off from making additional changes

### HANDOFF.md relationship
- HANDOFF.md is a distillation that references DESIGN.md for deeper rationale and evidence — not a standalone document
- Engineers reading HANDOFF.md can follow links to DESIGN.md for full context

### Claude's Discretion
- Evidence reference format (inline citations vs evidence tables vs hybrid) — pick what fits the content
- Whether to include a high-level summary/overview section before per-DA decisions
- RFC vs PRD structural template — whether they share structure with different tone, or use fundamentally different layouts
- Revision feedback method — full-document freeform vs section-by-section review
- Skip-to-gate behavior when user approves with no changes
- HANDOFF.md 9-section format — Claude designs appropriate sections for engineer consumption
- HANDOFF.md audience targeting (individual engineer vs team lead)
- Whether HANDOFF.md includes implementation suggestions where research supports them
- G3 gate runner — spawned verifier agent vs inline evaluation
- G3 gate failure handling — auto-fix vs user-prompted
- G3 outcome categories — mirror G2 (Go/Go-with-advisory/Recycle/Override) vs simpler model
- G3 anti-bias approach — explicit bias checklist vs general objectivity instruction

</decisions>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 07-design-skill*
*Context gathered: 2026-03-05*
