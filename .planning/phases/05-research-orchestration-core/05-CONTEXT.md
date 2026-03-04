# Phase 5: Research Orchestration Core - Context

**Gathered:** 2026-03-04
**Status:** Ready for planning

<domain>
## Phase Boundary

Dispatch parallel research subagents that collect evidence from multiple sources (web, codebase, MCP) against the specific evidence requirements defined in SCOPE.md. This phase builds the orchestration plumbing: batching, dispatch, evidence collection, and failure handling. Quality assessment (sufficiency evaluation), G2 gate, gap-fill rounds, and synthesis artifact production belong to Phase 6.

</domain>

<decisions>
## Implementation Decisions

### Batch Formation
- No question duplication across batches — each question is assigned to one source only
- User sees and approves the batch plan before any agents are dispatched
- Sources.yml defines what sources are available; the research skill assigns sources per question based on what's needed to answer it
- User can modify source assignments in the batch review step

### Evidence Files
- No token limit on evidence file content — agents write as much as they find
- Light notification per agent completion ("Evidence for Q3, Q5 written to evidence-batch-02.md") — user reads files if curious
- Source citations are best-effort — include where available but don't fail if a source can't be cited precisely
- The synthesis (Phase 6) is the primary user-facing artifact, not individual evidence files

### Subagent Dispatch
- All batches dispatch simultaneously (fully parallel)
- Dynamic question discovery: proposed new questions are queued and presented to user after ALL agents finish, not mid-research
- Research subagents use Sonnet model tier (as specified in existing prompt template frontmatter)
- Progress updates shown as agents complete ("Batch 1 complete (web) — 2 remaining")

### Failure Handling
- Pre-validate all configured sources (especially MCP) BEFORE dispatching any agents — surface broken sources upfront so user can fix before research starts
- MCP source failures surface immediately with clear messaging about connection issues
- On any agent/source failure: surface to user with options to fix the connection, try a different source, or skip those questions
- No automated retry logic — user is in control of recovery decisions
- Failed/skipped questions tracked for Phase 6 gap-fill awareness

### Claude's Discretion
- Batch grouping algorithm (source-affinity, merge/split thresholds, or simpler topic-based grouping — whatever is intuitive)
- Evidence file directory layout and naming conventions
- Whether agent return summaries (500-token) add orchestration value or if simpler success/fail signals suffice
- UNAVAILABLE-SOURCE vs NOT COVERED distinction for skipped questions
- Multi-source routing strategy (how to assign best single source per question)

</decisions>

<specifics>
## Specific Ideas

- "The research synthesis is what mostly matters to the user" — evidence files are reference material, synthesis is the deliverable
- "If any MCPs are being used as sources and can't access what they need, this should trigger early failure" — validate before spending tokens
- User wants control over recovery: "give user option to fix connection issues themselves, retrieve info from a different source, or skip"
- Batching should be intuitive — "if this overcomplicates we don't really need to specify this and just run batches for each topic/set of topics"
- Phase 5 memory doc notes: circuit breaker should be prompt-level (three-tier instructions in agent prompts), not orchestrator logic — but user preference for user-driven recovery may simplify this to detect-and-surface

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 05-research-orchestration-core*
*Context gathered: 2026-03-04*
