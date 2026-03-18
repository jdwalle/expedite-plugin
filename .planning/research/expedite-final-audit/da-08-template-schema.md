# DA-8: Template-Schema Consistency

## Summary

All 7 templates were audited against their corresponding schema validators. The 5 templates with schemas (state, checkpoint, questions, gates, tasks) all produce YAML that passes validation without modification. The 2 templates without schemas (sources, gitignore) have no validators, correctly so. Zero bugs found. One minor observation about an extra field (non-blocking).

## q25: Template-Schema Validation

### Validation Engine Mechanics (validate.js)

Key behaviors that affect template compatibility:

1. **Null handling for required fields**: `obj[field] === undefined || obj[field] === null` triggers a required-field error. Templates must ensure required fields have non-null values.
2. **Null handling for type/enum checks**: When a value is `null` or `undefined`, type and enum checks are skipped entirely (early return). This means nullable fields with enum constraints (e.g., `intent`) are safe to initialize as `null`.
3. **Extra fields are ignored**: The validator does NOT reject unknown fields. It only checks fields defined in `schema.fields`. Extra fields pass silently.
4. **Empty arrays satisfy required checks**: `[]` is neither `undefined` nor `null`, so `required: ['questions']` passes when `questions: []`.

### Template 1: state.yml.template → schemas/state.js — PASS

**Parsed values**: `version: 2`, `last_modified: null`, `project_name: null`, `intent: null`, `lifecycle_id: null`, `description: null`, `phase: "scope_in_progress"`, `started_at: null`, `phase_started_at: null`

| Check | Detail | Result |
|-------|--------|--------|
| Required: `version` | Value is `2` (non-null) | PASS |
| Required: `phase` | Value is `"scope_in_progress"` (non-null) | PASS |
| Type: `version` | `typeof 2 === 'number'` | PASS |
| Type: `phase` | `typeof "scope_in_progress" === 'string'` | PASS |
| Enum: `phase` | `"scope_in_progress"` is in VALID_PHASES | PASS |
| Enum: `intent` | Value is `null`, type/enum check skipped | PASS |
| Extra field: `last_modified` | Not in schema.fields, ignored by validator | PASS (note below) |
| Custom check: `version` must be number | `typeof 2 === 'number'` is true, no error | PASS |

**Note**: `last_modified` is present in the template but absent from `schema.fields`. The validator ignores it. This is harmless — the field is used by skills at runtime but not enforced by the schema. Not a bug.

### Template 2: checkpoint.yml.template → schemas/checkpoint.js — PASS

**Parsed values**: `skill: null`, `step: null`, `label: null`, `substep: null`, `continuation_notes: null`, `inputs_hash: null`, `updated_at: null`

| Check | Detail | Result |
|-------|--------|--------|
| Required: (none) | `schema.required` is `[]` | PASS |
| requiredWhenPopulated: `skill, step, label` | All three are `null`, so `hasAnyPopulated` is `false` | PASS |
| Type checks | All values are `null`, all skipped | PASS |
| Custom step check | `obj.step` is `null`, custom validation skipped | PASS |

### Template 3: questions.yml.template → schemas/questions.js — PASS

**Parsed values**: `research_round: 0`, `questions: []`

| Check | Detail | Result |
|-------|--------|--------|
| Required: `questions` | Value is `[]` (non-null) | PASS |
| Type: `research_round` | `typeof 0 === 'number'` | PASS |
| Type: `questions` | `Array.isArray([])` | PASS |
| Array item validation | `questions.length > 0` is `false`, skipped | PASS |

### Template 4: gates.yml.template → schemas/gates.js — PASS

**Parsed values**: `history: []`

| Check | Detail | Result |
|-------|--------|--------|
| Required: `history` | Value is `[]` (non-null) | PASS |
| Type: `history` | `Array.isArray([])` | PASS |
| Array item validation | `history.length > 0` is `false`, skipped | PASS |

### Template 5: tasks.yml.template → schemas/tasks.js — PASS

**Parsed values**: `current_wave: null`, `current_task: null`, `tasks: []`

| Check | Detail | Result |
|-------|--------|--------|
| Required: `tasks` | Value is `[]` (non-null) | PASS |
| Type: `current_wave` | Value is `null`, skipped | PASS |
| Type: `current_task` | Value is `null`, skipped | PASS |
| Type: `tasks` | `Array.isArray([])` | PASS |
| Array item validation | `tasks.length > 0` is `false`, skipped | PASS |

### Template 6: sources.yml.template — No Schema (by design)

Not included in `STATE_FILES` map. Writes pass through without validation. Correct by design: `sources.yml` is a user-editable configuration file with freeform structure.

### Template 7: gitignore.template — No Schema (not YAML)

Not a YAML file. The hook only intercepts `.expedite/*.yml` writes. No schema exists or is needed.

## Bugs Found

**None.**

## Mismatches Found

**None that cause validation failures.**

### Observation (non-blocking, informational only)

**Extra field `last_modified` in state.yml.template**: The template includes `last_modified: null` but the state schema does not define `last_modified` in its `fields` object. The validator silently ignores unknown fields, so this causes no error. However, it means `last_modified` is not type-checked — a skill could write a non-string value and the hook would not catch it. Severity: negligible.
