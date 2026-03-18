# DA-9: Hook Registration and Event Wiring

## Summary

All 4 hook events are correctly registered with valid script paths. The `"Write"` matcher correctly scopes to the Write tool. One significant finding: the `Edit` tool is not matched, creating a theoretical enforcement bypass for state files. Two cosmetic issues in plugin.json.

## q26: Hook Registration Completeness

### Registration Table

All 4 hook events in `.claude/settings.json`:

| Event | Matcher | Script Path | File Exists | Correct |
|-------|---------|-------------|-------------|---------|
| PreToolUse | `"Write"` | `.claude-plugin/hooks/validate-state-write.js` | Yes | Yes |
| PostToolUse | `"Write"` | `.claude-plugin/hooks/audit-state-change.js` | Yes | Yes |
| PreCompact | (none) | `.claude-plugin/hooks/pre-compact-save.js` | Yes | Yes |
| Stop | (none) | `.claude-plugin/hooks/session-stop.js` | Yes | Yes |

### Matcher Analysis

The `"Write"` matcher on PreToolUse and PostToolUse correctly matches only the Write tool. Per Claude Code hook specification, the matcher string is compared against the tool name. `"Write"` will match `Write` but not `Edit`, `Bash`, `Read`, etc.

### Finding: Edit Tool Bypass (Low Severity)

The `Edit` tool can also modify files, including `.expedite/*.yml` state files. Since the matcher is `"Write"` only, edits via the Edit tool would bypass both:
- **PreToolUse**: validate-state-write.js enforcement (FSM, gates, checkpoint, schema validation)
- **PostToolUse**: audit-state-change.js audit trail logging

**Severity: Low** — Skills use the Write tool (not Edit) for state file modifications, so this bypass is theoretical under normal operation. However, a user or Claude could manually use Edit on a state file and bypass all enforcement.

**Fix**: Add a second hook registration for the `"Edit"` matcher, or document that Edit must never be used on `.expedite/*.yml` files.

## q27: Benchmark Hook and Plugin Manifest

### benchmark-latency.js — Intentionally Unregistered

`benchmark-latency.js` exists in `.claude-plugin/hooks/` but is not registered in `settings.json`. This is correct by design — it is a standalone diagnostic utility for measuring hook execution latency, not a runtime enforcement hook. It is meant to be run manually when needed.

### plugin.json — Functional with Cosmetic Issues

| Field | Value | Issue |
|-------|-------|-------|
| `name` | `"expedite"` | Correct |
| `version` | `"1.0.0"` | Stale — project is at v3.0 |
| `description` | Lists "Scope, Research, Design, Plan, Execute" | Missing "Spike" phase |

These are cosmetic issues that don't affect runtime behavior.

## Bugs Found

| # | Severity | Location | Description |
|---|----------|----------|-------------|
| BUG-1 | Low | .claude/settings.json | Edit tool not matched — state files can be modified via Edit without hook enforcement |
| BUG-2 | Cosmetic | plugin.json | Version stale at 1.0.0 (should be 3.0.0) |
| BUG-3 | Cosmetic | plugin.json | Description missing "Spike" from lifecycle phases |

## Missing Registrations

None for runtime hooks. benchmark-latency.js is intentionally unregistered (diagnostic utility).
