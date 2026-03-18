# DA-1: Hook Script Correctness

**Files audited**: 14 files (5 hook entry points, 7 library modules, 2 schema-support files), ~900 lines of application code.

**Overall verdict**: The hook architecture is sound. All exit-code contracts match Claude Code's protocol. No unhandled exceptions can crash any hook process. Found **5 bugs** and **1 dead code path**.

## Summary

| Question | Verdict | Bugs |
|----------|---------|------|
| q01: validate-state-write.js parsing/exits | PASS | 0 |
| q02: Four enforcement layers | PASS | 2 minor |
| q03: audit-state-change.js | PASS | 1 |
| q04: pre-compact-save.js + session-stop.js | PASS | 2 |
| q05: benchmark-latency.js | PASS | 0 |

## q01: validate-state-write.js Parsing and Exit Codes — PASS

All branches terminate with either `process.exit(0)` (allow) or `deny()` which calls `process.exit(2)`. stdin is correctly accumulated via chunks and parsed on `'end'`. Empty/malformed stdin falls to the top-level catch and exits 0 (fail-open). Dependencies are lazy-loaded only on the state-file path (HOOK-07 latency optimization confirmed).

## q02: Four Enforcement Layers — PASS (with 2 minor bugs)

- **HOOK-01 (FSM)**: Correctly validates phase transitions against a strict linear FSM. Same-phase writes pass through. `archived` has no outbound transitions. Denial tracker pattern: `fsm:{from}:{to}`.
- **HOOK-02 (Gate passage)**: Correctly requires gate passage for `*_in_progress → *_complete` transitions. Override instructions are actionable. Handles missing `gates.yml`.
- **HOOK-03 (Checkpoint regression)**: Correctly blocks step regression when `inputs_hash` unchanged. Allows regression when inputs change. **Bug #2**: Escalation message incorrectly references `state.yml` instead of `checkpoint.yml`.
- **HOOK-04 (Gate-phase)**: Correctly validates gate entries against current phase. Override entries (`outcome: 'overridden'`) bypass validation (OVRD-03 deadlock prevention). **Bug #3**: Missing period in denial message.

## q03: audit-state-change.js — PASS (with 1 bug)

Append-only using `fs.appendFileSync`. Never blocks (always exits 0). YAML document separators (`---\n`) prevent entry corruption. **Bug #1**: Override detection uses `indexOf('outcome: "overridden"')` which only matches double-quoted YAML — single-quoted or unquoted variants would be logged as regular `state_write` instead of `override_write`.

## q04: pre-compact-save.js and session-stop.js — PASS

Both correctly drain stdin (avoiding broken pipe), check for active lifecycle via `state.yml` existence, and delegate to shared `session-summary.js`. pre-compact-save.js additionally backs up `checkpoint.yml`. TOCTOU race in `accessSync`+`copyFileSync` is theoretical only (single-threaded, Claude paused).

## q05: benchmark-latency.js — PASS

Standalone tool (not registered in settings.json). Uses `process.hrtime.bigint()` for nanosecond precision. Spawns isolated child processes. No side effects on state files. Exit 0 on pass, exit 1 on fail.

## Bugs Found

| # | Severity | Location | Description |
|---|----------|----------|-------------|
| BUG-1 | P0 | hooks/lib/session-summary.js:116 | `if (answer)` truthiness check misses falsy valid answers (e.g., `0`, `""`, `false`). Should be `if (answer != null)` |
| BUG-2 | P1 | hooks/audit-state-change.js:63 | Override detection `indexOf('outcome: "overridden"')` only matches double-quoted YAML — single-quoted or unquoted variants logged as regular `state_write` instead of `override_write` |
| BUG-3 | P1 | hooks/validate-state-write.js:204 | HOOK-03 escalation message says "edit state.yml" but should say "edit checkpoint.yml" |
| BUG-4 | P2 | hooks/validate-state-write.js:250-251 | Missing period between phase value and bypass instructions in HOOK-04 denial message |
| BUG-5 | P2 | hooks/lib/session-summary.js:11 | `SKILL_STEP_TOTALS.scope` is 10 but scope skill may have 9 steps |

## Dead Code / Unreachable Paths

- `return` statements after `deny()` calls — defensive, harmless
- `clearDenials()` in denial-tracker.js — exported but never called by any consumer
