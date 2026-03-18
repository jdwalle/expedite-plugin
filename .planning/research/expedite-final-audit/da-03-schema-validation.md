# DA-3: Schema and Validation Layer Integrity

## Summary

The validation engine (`validate.js`) is functionally correct for all standard type/enum/required combinations. However, **significant schema coverage gaps** exist: state.yml's schema is missing 7+ fields that skills actively write, and the `nullable: true` property is decorative (never read by the engine). The dispatch chain is fully correct.

## q09: validate.js Field Validation Engine — CORRECT with design observations

The `validateFields` function at `hooks/lib/validate.js` is **functionally correct** for all standard type/enum/required/nullable combinations. Line-by-line trace confirms:
- Required field checking works (null and undefined both rejected)
- `requiredWhenPopulated` correctly enforces all-or-nothing for checkpoint.yml
- Type checking handles multi-type (`['number', 'string']`), arrays, objects correctly
- Enum validation uses exact match via `indexOf`

### Test Cases

| Scenario | Input | Expected | Actual | Result |
|----------|-------|----------|--------|--------|
| Required present | `{version: 2}` | Pass | Pass | CORRECT |
| Required absent | `{version: undefined}` | Fail | Fail | CORRECT |
| Required null | `{version: null}` | Fail | Fail | CORRECT |
| Nullable with null | `{intent: null}` | Pass (skip) | Pass (skip) | CORRECT |
| Nullable with value | `{intent: "engineering"}` | Check type/enum | Check type/enum | CORRECT |
| Enum valid | `{phase: "scope_in_progress"}` | Pass | Pass | CORRECT |
| Enum invalid | `{phase: "bogus"}` | Fail | Fail | CORRECT |
| Type match | `{version: 2}` (number) | Pass | Pass | CORRECT |
| Type mismatch | `{version: "two"}` (string) | Fail | Fail | CORRECT |

### Design Observations

1. **No unknown-field rejection.** The engine iterates `schema.fields` keys, not `obj` keys. Any field in the data not declared in the schema passes silently with zero validation. This is why the missing-field bugs below are impactful.
2. **`nullable: true` is decorative.** The engine never reads this property. All fields are implicitly nullable because null/undefined values are unconditionally skipped at the type/enum check stage. The property exists in schemas for documentation purposes only.

## q10: Schema-Write Cross-Reference — SIGNIFICANT GAPS

### checkpoint.yml — COMPLETE MATCH
All 7 fields (`skill`, `step`, `label`, `substep`, `continuation_notes`, `inputs_hash`, `updated_at`) match between schema and skill writes.

### state.yml — MISSING 7+ FIELDS
Skills write the following fields that are **not in the state schema**:
- `last_modified` — written by every skill at every step
- `current_step` — written by skills to track progress
- `questions` — research question data written to state.yml
- `research_round` — research round counter
- `current_wave` — execute skill wave tracking
- `current_task` — execute skill task tracking
- `auto_commit` — execute skill commit flag

All silently accepted (because the validator only checks declared fields) but **never type-checked or enum-validated**.

### questions.yml — SCHEMA EXISTS BUT RARELY EXERCISED
The questions.yml schema is well-designed but validates a file that starts empty. The actual question data is written to state.yml (where it has no schema protection). The schema would work correctly if questions were written to questions.yml, but the skill architecture routes question data through state.yml instead.

### gates.yml — MOSTLY COMPLETE
Good coverage except the `severity` field (written by the override protocol) is missing from the schema's array item field definitions.

### tasks.yml — LIKELY COMPLETE
Schema matches if the execute skill writes to tasks.yml (SKILL.md wording is somewhat ambiguous about the exact target file).

## q11: Dispatch Chain — FULLY CORRECT

```
STATE_FILES map (validate-state-write.js)
  → state-schema.js routing (filename match)
    → individual schema module (state.js / checkpoint.js / gates.js / questions.js / tasks.js)
      → validate.js validateFields()
```

All 5 entries resolve to working validator functions. Path matching uses `path.basename()` correctly. Dynamic dispatch via `getValidator(filename)` returns the right function for each state file. Return value contracts (array of error strings) are consistent across all schema modules.

## Bugs Found

| # | Severity | Location | Description |
|---|----------|----------|-------------|
| BUG-1 | P1 | hooks/lib/schemas/state.js | Schema missing 7+ fields that skills actively write (`last_modified`, `current_step`, `questions`, `research_round`, `current_wave`, `current_task`, `auto_commit`) — no type/enum validation on these fields |
| BUG-2 | P2 | hooks/lib/schemas/gates.js | Schema missing `severity` field written by override protocol |
| BUG-3 | P2 | hooks/lib/validate.js | `nullable: true` property never read by validation engine — decorative only |
| BUG-4 | P1 | Architecture | Question data written to state.yml instead of questions.yml — questions.yml schema exists but is rarely exercised on real data |

## Schema Gaps Found

The core issue is that the validator's design (only check declared fields, silently pass unknown fields) means schema completeness is critical for enforcement value. With 7+ undeclared fields in the most-written file (state.yml), a significant portion of state writes are unvalidated.
