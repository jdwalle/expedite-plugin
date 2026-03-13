# Override Protocol

When you attempt to write a state file (.expedite/*.yml) and the write is **denied by a hook**, follow the instructions in the denial reason exactly.

## Gate Override Flow

When a state transition is denied because a gate has not passed:

1. **Read the denial reason carefully.** It names the gate (e.g., G1) and provides the override record format.
2. **Write an override record to gates.yml.** Add a new entry to the history array:
   ```yaml
   history:
     # ... existing entries ...
     - gate: "G1"
       timestamp: "2026-01-01T00:00:00Z"
       outcome: "overridden"
       override_reason: "User requested: <justification>"
       severity: "low"  # low, medium, or high
   ```
3. **Immediately retry the exact same Write to state.yml** that was denied. Do NOT proceed to other work between steps 2 and 3. The hook will recognize the override and allow the write.

## Important Rules

- **Do not skip the retry step.** After writing the override record, you MUST retry the state.yml write immediately.
- **Override records bypass gate-phase validation.** You can write an override for any gate regardless of current phase.
- **FSM transitions cannot be overridden via gates.yml.** If the denial is about an invalid phase transition (not a missing gate), the only bypass is `EXPEDITE_HOOKS_DISABLED=true`.
- **After 3 failed attempts**, the denial message will suggest manual intervention. Follow those instructions.

## Emergency Bypass

If enforcement is preventing all progress, the user can set:
```
EXPEDITE_HOOKS_DISABLED=true
```
This disables all hooks. Use only for debugging.
