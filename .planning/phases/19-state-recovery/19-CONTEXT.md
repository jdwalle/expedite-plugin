# Phase 19: State Recovery - Context

**Gathered:** 2026-03-11
**Status:** Ready for planning

<domain>
## Phase Boundary

Detect missing state.yml and recover lifecycle progress from existing artifacts so users never have to restart a lifecycle they've already progressed through. This is a slim recovery path — not a full backup/restore system.

**Explicitly out of scope:** .bak files, sentinel fields, backup rotation, schema validation, write-corruption detection. These were evaluated and deemed unnecessary — state writes are atomic and skills read state as raw text, making corruption a non-issue in practice.

</domain>

<decisions>
## Implementation Decisions

### Recovery trigger
- Recovery activates only when state.yml is missing entirely (not on malformed/corrupted content — that scenario doesn't realistically occur)
- Checked on any skill invocation that reads state

### Artifact reconstruction
- Scan artifacts in reverse order: PLAN.md → DESIGN.md → SYNTHESIS.md → SCOPE.md
- Latest artifact wins — first file found determines the inferred lifecycle phase
- Basic content check on each artifact: file must be non-empty and contain expected headers (not just existence check)
- Reconstructed state contains minimum fields to resume: lifecycle_phase + project_name only
- No step tracking reconstruction — completed skills already have their artifacts, the router just needs to know which skill comes next

### Recovery messaging
- Inline notice with phase only: "State recovered from artifacts (last phase: design_complete)"
- Same format regardless of which artifact was the recovery source
- Skill proceeds normally after the notice — no user confirmation required

### Unrecoverable state
- When no state.yml AND no artifacts exist: "No recovery source found. Run /expedite:scope to start a new lifecycle."
- Direct the user to start fresh — no manual repair guidance

### Claude's Discretion
- Where in the skill loading flow to perform the missing-state check
- How to extract project_name from artifacts
- Whether to log recovery events beyond the inline notice

</decisions>

<specifics>
## Specific Ideas

- The original roadmap specified .bak files, sentinel fields, and multi-tier recovery. User deliberately simplified after evaluating that state writes are atomic (Write tool does temp-file-then-rename) and skills read state as raw text (Claude naturally handles minor formatting issues). Phase should reflect this simplified scope.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 19-state-recovery*
*Context gathered: 2026-03-11*
