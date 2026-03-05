# Override Handling

Read by the research orchestrator when the user explicitly chooses to override the G2 gate.

---

## Record Override

Update the gate_history entry for the current evaluation: set `overridden: true` and update `outcome` to `"override"`.

## Determine Severity

Based on how many MUST criteria failed:
- **low**: 0 MUST failures (override from Go-with-advisory or user-initiated)
- **medium**: 1 MUST failure
- **high**: 2+ MUST failures

## Write Override Context

Write `.expedite/research/override-context.md`:

```markdown
# G2 Override Context

Timestamp: {ISO 8601 UTC}
Severity: {low|medium|high}
Recycle count: {N}

## Overridden Gaps

{For each NOT COVERED/PARTIAL question:}
- {question_id}: {question_text}
  Status: {status}
  Missing: {gap_details}
  Impact: {which DA is affected}

## Design Phase Advisory

The following decision areas have insufficient evidence. Design decisions
for these areas should be flagged as lower confidence.
{List affected DAs with their deficient question counts}
```

## Phase Transition

The phase stays at `"research_in_progress"` — synthesis (Step 17) will transition to `"research_complete"` upon completion.

Proceed to Step 17.
