# Phase 40: P2 Audit Fixes - Research

**Researched:** 2026-03-18
**Domain:** Expedite plugin quality/consistency fixes (AUD-022 through AUD-036)
**Confidence:** HIGH

## Summary

This research validates the 15 P2 audit findings (AUD-022 through AUD-036) from the final audit research synthesis against the current source code, post-Phase 39 (which fixed all P1 bugs AUD-008 through AUD-021). Each finding was verified by reading the exact files cited in the audit. The P2 findings are quality and consistency improvements -- none are runtime-blocking or data-integrity issues.

All 15 P2 findings were validated. Two findings (AUD-034, AUD-036) are documented-and-accepted items rather than code fixes. The remaining 13 require code changes. The fixes cluster into four groups: (1) schema cleanup (AUD-022, AUD-023, AUD-030), (2) dead code removal (AUD-031, AUD-032), (3) code quality improvements (AUD-025, AUD-027, AUD-028, AUD-029), and (4) cosmetic/metadata fixes (AUD-024, AUD-026, AUD-033, AUD-035). All changes are small, surgical edits with no structural risk.

One finding deserves special attention: AUD-029 (go_advisory vs go-with-advisory standardization) touches the most files but each change is mechanical. The canonical form should be `go_advisory` (underscore) since that is what all gate scripts and skills already produce; only the gate-verifier agent and PASSING_OUTCOMES array use the hyphenated form.

**Primary recommendation:** Fix all 13 actionable bugs in two plans: (1) JavaScript hook/gate/schema code changes, (2) metadata and documentation fixes. AUD-034 and AUD-036 are accepted as-is with brief documentation.

## Validated Bug List

### AUD-022: `nullable: true` is decorative in schemas

**Status: CONFIRMED**
**Confidence: HIGH**

**Evidence:** The validation engine (`hooks/lib/validate.js` lines 46-71) iterates `schema.fields` and for each field checks the value. At line 51:
```javascript
if (value === undefined || value === null) {
  return;
}
```

When a value is `null` or `undefined`, the validator returns immediately without checking type or enum. The `nullable: true` property is declared on 20+ schema fields across all 5 schema files but is never read by the validation engine. All fields are implicitly nullable.

**Current count of `nullable: true` declarations:**
- `hooks/lib/schemas/state.js`: 7 fields (lifecycle_id, project_name, intent, description, started_at, phase_started_at, last_modified)
- `hooks/lib/schemas/checkpoint.js`: 7 fields (skill, step, label, substep, continuation_notes, inputs_hash, updated_at)
- `hooks/lib/schemas/gates.js`: 8 fields (evaluator, override_reason, must_passed, must_failed, should_passed, should_failed, notes, overridden, structural_checks, semantic_scores)
- `hooks/lib/schemas/questions.js`: 2 fields (research_round, gap_details)
- `hooks/lib/schemas/tasks.js`: 3 fields (current_wave, current_task, wave, assigned_agent)

**Recommended fix:** Remove `nullable: true` from all schema field definitions and add a code comment in `validate.js` documenting the implicit nullability behavior:
```javascript
// All fields are implicitly nullable: null/undefined values skip type/enum checks.
// Only non-null values are validated against type and enum constraints.
```

This is cleaner than implementing nullable checking, which would require a schema-wide audit of which fields legitimately need null values.

**Files to modify:** `hooks/lib/validate.js` (add comment), `hooks/lib/schemas/state.js`, `hooks/lib/schemas/checkpoint.js`, `hooks/lib/schemas/gates.js`, `hooks/lib/schemas/questions.js`, `hooks/lib/schemas/tasks.js` (remove `nullable: true` from all fields)

### AUD-023: Gates.yml schema missing `severity` field

**Status: CONFIRMED**
**Confidence: HIGH**

**Evidence:** The override protocol (referenced in `hooks/validate-state-write.js` lines 144-147) instructs users to write gate entries with a `severity` field:
```
'{gate: "G1", timestamp: "<ISO 8601>", outcome: "overridden", override_reason: "<your justification>", severity: "<low|medium|high>"}'
```

The `hooks/lib/schemas/gates.js` itemSchema (lines 28-42) does not include a `severity` field. Since the validation engine passes unknown fields silently, the write succeeds but the severity value is never type-checked or enum-validated. A user could write `severity: "banana"` and it would pass validation.

**Recommended fix:** Add `severity` to the gates.yml itemSchema:
```javascript
severity: { type: 'string', enum: ['low', 'medium', 'high'] },
```

Note: Do NOT make this a required field -- it only appears on override entries.

**Files to modify:** `hooks/lib/schemas/gates.js` (add severity to itemSchema.fields)

### AUD-024: Missing period in HOOK-04 denial message

**Status: CONFIRMED**
**Confidence: HIGH**

**Evidence:** `hooks/validate-state-write.js` lines 271-272:
```javascript
var gpReason = 'Gate write blocked: ' + phaseCheck.error + '. Current phase: ' + stateObj.phase +
  ' To bypass enforcement entirely, set EXPEDITE_HOOKS_DISABLED=true.';
```

After `stateObj.phase` there is no period before "To bypass". The message reads: "Current phase: design_in_progress To bypass enforcement..." -- missing the period separator.

**Recommended fix:** Add period after phase value:
```javascript
var gpReason = 'Gate write blocked: ' + phaseCheck.error + '. Current phase: ' + stateObj.phase +
  '. To bypass enforcement entirely, set EXPEDITE_HOOKS_DISABLED=true.';
```

**Files to modify:** `hooks/validate-state-write.js` (line 272)

### AUD-025: Truthiness check in session-summary.js misses falsy valid answers

**Status: CONFIRMED**
**Confidence: HIGH**

**Evidence:** `hooks/lib/session-summary.js` lines 115-116:
```javascript
for (var i = 0; i < questions.questions.length; i++) {
  if (questions.questions[i].answer) {
    answeredQ++;
  }
}
```

The `if (answer)` check will treat `0`, `""`, and `false` as unanswered. While these are unlikely answer values in the Expedite lifecycle (answers are typically prose strings), the check should be correct. An empty string `""` is a plausible edge case if a user provides a blank answer that gets stored.

**Recommended fix:** Change to explicit null check:
```javascript
if (questions.questions[i].answer != null) {
```

This uses loose equality to catch both `null` and `undefined` while accepting `0`, `""`, and `false` as valid answers.

**Files to modify:** `hooks/lib/session-summary.js` (line 116)

### AUD-026: SKILL_STEP_TOTALS.scope may be wrong

**Status: CONFIRMED -- value is correct but audit's concern was valid to raise**
**Confidence: HIGH**

**Evidence:** `hooks/lib/session-summary.js` line 11:
```javascript
var SKILL_STEP_TOTALS = {
  scope: 10, research: 14, design: 10, plan: 9, spike: 9, execute: 7
};
```

Scope skill (`skills/scope/SKILL.md`) has exactly 10 step headings:
```
Step 1, Step 2, Step 3, Step 4, Step 5, Step 6, Step 7, Step 8, Step 9, Step 10
```

**The value `scope: 10` is correct.** The audit's concern was whether the count matched reality. It does. However, Phase 39 already updated `research: 14` (was 18), confirming the pattern of verifying these totals is worthwhile.

**Recommended action:** No code change needed. Mark as validated-correct.

### AUD-027: `extractDAs` helper has divergent return types across gates

**Status: CONFIRMED**
**Confidence: HIGH**

**Evidence:**
- G2 (`gates/g2-structural.js` lines 50-63): `extractDAs` returns `[{id: string, name: string|null}]`
- G3 (`gates/g3-design.js` lines 48-62): `extractDAs` returns `[{id: string, name: string|null}]`
- G4 (`gates/g4-plan.js` lines 49-60): `extractDAs` returns `[string]` (plain strings: `das.push(match[1])`)

G2 and G3 use `da.id` for matching. G4 uses `daId` directly as a string. This is a code quality issue -- the same logical function should return the same type.

**Recommended fix:** Consolidate all three `extractDAs` implementations into `gates/lib/gate-utils.js` with a consistent return type `[{id: string, name: string|null}]`. Update G4 to use `.id` when referencing DA identifiers.

Also: G2 and G3 have identical implementations (same regex, same return structure). This is pure duplication.

**Files to modify:** `gates/lib/gate-utils.js` (add `extractDAs`), `gates/g2-structural.js` (remove local, import from utils), `gates/g3-design.js` (remove local, import from utils), `gates/g4-plan.js` (remove local, import from utils, update callers to use `.id`)

### AUD-028: `wordCount` helper duplicated in G2, G3, G5

**Status: CONFIRMED**
**Confidence: HIGH**

**Evidence:**
- G2 (`gates/g2-structural.js` lines 79-82): identical `wordCount` function
- G3 (`gates/g3-design.js` lines 150-153): identical `wordCount` function
- G5 (`gates/g5-spike.js` lines 93-96): identical `wordCount` function

All three are byte-for-byte identical:
```javascript
function wordCount(text) {
  if (!text) return 0;
  return text.trim().split(/\s+/).filter(function (w) { return w.length > 0; }).length;
}
```

**Recommended fix:** Move to `gates/lib/gate-utils.js` and import from there. Remove local definitions from G2, G3, G5.

**Files to modify:** `gates/lib/gate-utils.js` (add `wordCount`), `gates/g2-structural.js` (remove local, import), `gates/g3-design.js` (remove local, import), `gates/g5-spike.js` (remove local, import)

### AUD-029: `go_advisory` vs `go-with-advisory` dual naming

**Status: CONFIRMED**
**Confidence: HIGH**

**Evidence from current code:**

**Underscore form (`go_advisory`) -- used by:**
- `gates/lib/gate-utils.js` line 107: `outcome = 'go_advisory'` (this is where ALL gate scripts get their outcome)
- All 5 gate scripts via `computeOutcome` -> `buildEntry`
- All skills in gate result writes: `outcome: "{go|go_advisory|recycle}"`
- `gates/lib/gate-utils.js` comments (lines 23, 27, 25, etc.)
- Skills: scope, design, plan, spike, research (gate handling sections)

**Hyphenated form (`go-with-advisory`) -- used by:**
- `agents/gate-verifier.md` line 133: `outcome: "{go | go-with-advisory | recycle}"`
- `hooks/lib/gate-checks.js` line 20: `PASSING_OUTCOMES` array includes both forms
- `hooks/lib/schemas/gates.js` line 12: `VALID_GATE_OUTCOMES` array includes both forms
- `templates/gates.yml.template` line 4: comment mentions `go-with-advisory`
- Skills' semantic gate sections: "Map verifier outcomes: go-with-advisory -> go_advisory"

**Analysis:** The gate-verifier agent produces `go-with-advisory` (hyphenated). Skills explicitly map this to `go_advisory` (underscore) when writing to gates.yml. The PASSING_OUTCOMES array accepts both. The canonical form for gates.yml entries is `go_advisory` (underscore).

**Recommended fix:** Standardize on `go_advisory` (underscore) everywhere:
1. Update `agents/gate-verifier.md` output format: change `go-with-advisory` to `go_advisory`
2. Remove `'go-with-advisory'` from `VALID_GATE_OUTCOMES` in `hooks/lib/schemas/gates.js`
3. Remove `'go-with-advisory'` from `PASSING_OUTCOMES` in `hooks/lib/gate-checks.js`
4. Update `templates/gates.yml.template` comment
5. Remove mapping instructions from skills (design, research, spike): "go-with-advisory -> go_advisory" becomes unnecessary

**Rationale:** `go_advisory` is what gate scripts produce via `computeOutcome`. It is what skills write to gates.yml. Changing the gate-verifier output to match is simpler than changing all gate scripts and skills. The underscore form is also more consistent with YAML conventions (no quotes needed).

**Files to modify:** `agents/gate-verifier.md`, `hooks/lib/schemas/gates.js`, `hooks/lib/gate-checks.js`, `templates/gates.yml.template`, `skills/design/SKILL.md`, `skills/research/SKILL.md`, `skills/spike/SKILL.md`

### AUD-030: `no-go` is a dead enum value

**Status: CONFIRMED**
**Confidence: HIGH**

**Evidence:** `hooks/lib/schemas/gates.js` line 11: `'no-go'` is in `VALID_GATE_OUTCOMES`. Grep of entire project for `'no-go'` or `"no-go"` in hooks/gates/skills directories shows it only appears in this enum definition. No gate script, skill, or agent ever produces `no-go`.

Gate outcome logic in `gate-utils.js` `computeOutcome`:
- MUST fail -> `holdOutcome` (either `'hold'` or `'recycle'`)
- SHOULD fail -> `'go_advisory'`
- All pass -> `'go'`

There is no code path that produces `'no-go'`.

**Recommended fix:** Remove `'no-go'` from `VALID_GATE_OUTCOMES` in `hooks/lib/schemas/gates.js`.

**Files to modify:** `hooks/lib/schemas/gates.js`

### AUD-031: Dead exports (`formatChecks`, `clearDenials`)

**Status: CONFIRMED**
**Confidence: HIGH**

**Evidence:**
- `formatChecks` in `gates/lib/gate-utils.js` line 69-77: defined and exported (line 195) but never called by any consumer. All gate scripts use `printResult` instead, which was added later and superseded `formatChecks`.
- `clearDenials` in `hooks/lib/denial-tracker.js` line 52-64: defined and exported (line 68) but never called. It was designed for clearing denial counts after a successful write, but no consumer ever calls it.

**Recommended fix:** Remove both functions and their exports. They are dead code with no callers. If needed in the future, they can be re-added.

**Alternative:** Keep them with a `// Reserved for future use` comment. This is acceptable for `clearDenials` (which has a clear use case: resetting denial counts after override success) but less justified for `formatChecks` (fully superseded by `printResult`).

**Recommendation:** Remove `formatChecks` entirely (superseded). Keep `clearDenials` with a comment (has legitimate future use for override flow).

**Files to modify:** `gates/lib/gate-utils.js` (remove `formatChecks` function and export), `hooks/lib/denial-tracker.js` (add comment to `clearDenials` documenting intended use)

### AUD-032: Dead `fs` import in G3 and G5

**Status: CONFIRMED**
**Confidence: HIGH**

**Evidence:**
- `gates/g3-design.js` line 4: `var fs = require('fs');` -- `fs` is never referenced anywhere in the file body. All file reads go through `utils.readFile` and `utils.readYaml`.
- `gates/g5-spike.js` line 4: `var fs = require('fs');` -- `fs` is never referenced anywhere in the file body. Same pattern.
- `gates/g2-structural.js` line 4: `var fs = require('fs');` -- this one IS used at line 69: `fs.readdirSync(dir)` in the `listEvidenceFiles` helper. Do NOT remove.

**Recommended fix:** Remove `var fs = require('fs');` from G3 and G5. Keep it in G2.

**Files to modify:** `gates/g3-design.js` (remove line 4), `gates/g5-spike.js` (remove line 4)

### AUD-033: plugin.json version and description stale

**Status: CONFIRMED**
**Confidence: HIGH**

**Evidence:** `.claude-plugin/plugin.json`:
```json
{
  "name": "expedite",
  "version": "1.0.0",
  "description": "Research-driven development lifecycle: Scope, Research, Design, Plan, Execute"
}
```

The project is currently at v3.1 (per STATE.md). The description omits "Spike" from the lifecycle phases -- the full lifecycle is Scope, Research, Design, Plan, Spike, Execute.

**Recommended fix:**
```json
{
  "name": "expedite",
  "version": "3.1.0",
  "description": "Research-driven development lifecycle: Scope, Research, Design, Plan, Spike, Execute"
}
```

**Files to modify:** `.claude-plugin/plugin.json`

### AUD-034: Gate scripts write gates.yml bypassing hooks

**Status: CONFIRMED -- Accept as architectural constraint**
**Confidence: HIGH**

**Evidence:** `gates/lib/gate-utils.js` line 61: `fs.writeFileSync(gatesYmlPath, output, 'utf8')`. Gate scripts run as Bash-invoked Node.js processes (e.g., `node gates/g2-structural.js .`). They write directly to the filesystem, which means the PreToolUse `Write` matcher does not fire -- only Claude's Write tool calls trigger hooks.

This is by design: gate scripts are deterministic validators that produce well-formed output. Routing their writes through the skill (which would trigger hooks) would create a circular dependency -- the hook would validate the gate result being written, which was produced by the gate script.

**Recommended action:** Accept as-is. Document the architectural asymmetry in a brief code comment in `gate-utils.js`.

**Files to modify:** `gates/lib/gate-utils.js` (add explanatory comment only)

### AUD-035: Edit tool not matched by hook registration

**Status: CONFIRMED**
**Confidence: HIGH**

**Evidence:** `.claude/settings.json` registers hooks only for `Write`:
```json
"PreToolUse": [{"matcher": "Write", ...}],
"PostToolUse": [{"matcher": "Write", ...}]
```

The `Edit` tool can modify files (including `.expedite/*.yml` state files) without triggering FSM, gate, or schema validation hooks. A Claude session could use `Edit` to change `state.yml` content and bypass all enforcement.

**Risk assessment:** LOW in practice. Skills instruct Claude to use the Write tool for state file updates (complete-rewrite semantics per the state file write pattern). The Edit tool is designed for partial file modifications and is not referenced in any skill instruction for state file writes. However, an LLM could conceivably use Edit instead of Write.

**Recommended fix:** Add `"Edit"` matcher to both PreToolUse and PostToolUse hook registrations:
```json
"PreToolUse": [
  {"matcher": "Write", "hooks": [...]},
  {"matcher": "Edit", "hooks": [...]}
],
"PostToolUse": [
  {"matcher": "Write", "hooks": [...]},
  {"matcher": "Edit", "hooks": [...]}
]
```

**Implementation note:** The existing `validate-state-write.js` hook reads `input.tool_input.file_path` and `input.tool_input.content`. The Edit tool input has `file_path` but provides `old_string` and `new_string` instead of `content`. The hook would need to either:
(a) Apply the edit and validate the result -- complex, requires reading the file and applying the edit
(b) Simply deny all Edit calls targeting `.expedite/*.yml` files -- simpler, prevents Edit from being used on state files at all

Option (b) is recommended: add a lightweight check that denies any Edit targeting `.expedite/*.yml` files with a message directing the user to use Write instead. This can be a separate small hook or an early check in the existing hook.

**Files to modify:** `.claude/settings.json` (add Edit matcher), create `hooks/deny-state-edit.js` (new small hook) OR modify `hooks/validate-state-write.js` to handle Edit tool input

### AUD-036: Recovery procedure discards gate history

**Status: CONFIRMED -- Accept as last-resort behavior**
**Confidence: HIGH**

**Evidence:** `skills/shared/ref-state-recovery.md` line 141-143:
```yaml
history: []
```

Recovery writes an empty gates.yml, discarding all previous gate passage records. This is by design -- recovery is a last resort when state.yml is missing. Gate history cannot be reliably reconstructed from artifacts alone (gate timestamps, scores, and evaluator names are not present in skill artifacts).

**Recommended action:** Accept as-is. The recovery procedure clearly states it is for cases where state.yml is missing entirely. Gate history loss is an acceptable tradeoff for regaining a functional lifecycle. Add a brief comment in the recovery file noting that gate history is intentionally not reconstructed.

**Files to modify:** `skills/shared/ref-state-recovery.md` (add clarifying comment only)

## Architecture Patterns

### Pattern: Shared Gate Utilities

When consolidating duplicated helpers into `gate-utils.js`, follow the existing pattern:
1. Functions at module scope with `var` declarations
2. JSDoc comments with `@param` and `@returns`
3. Export via `module.exports` object at the bottom
4. Use CommonJS `require` (no ES modules)

The existing exports pattern in `gate-utils.js`:
```javascript
module.exports = {
  readYaml: readYaml,
  readFile: readFile,
  appendGateResult: appendGateResult,
  // ... etc
};
```

### Pattern: Schema Field Definitions

When modifying schema fields, follow the existing pattern:
```javascript
field_name: { type: 'string', enum: ['val1', 'val2'] },
```

For optional fields that should NOT be required (like `severity` on override entries), add to `fields` but NOT to `required`.

### Pattern: Hook Denial Messages

All denial messages should follow the established pattern (post-Phase 39):
```
[What was blocked]: [specific error]. [Recovery instructions]. To bypass enforcement entirely, set EXPEDITE_HOOKS_DISABLED=true.
```

### Anti-Patterns to Avoid

- **Partial go_advisory standardization:** Must update ALL producers and consumers -- gate-verifier agent, gate-checks.js, gates.js schema, template comment, and skill mapping instructions. Missing any one creates a new inconsistency.
- **Removing clearDenials without documenting why:** It has a clear future use (clearing denial counts after override success). If removing, document the decision. Better to keep with a comment.
- **Adding Edit hook with content validation:** The Edit tool provides `old_string`/`new_string`, not full `content`. Don't try to reconstruct and validate -- just deny Edit on state files entirely.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| DA extraction from markdown | Per-gate local function | Shared `extractDAs` in gate-utils.js | 3 copies diverged in return type; shared function prevents future divergence |
| Word counting | Per-gate local function | Shared `wordCount` in gate-utils.js | 3 identical copies; DRY principle |
| Edit tool state protection | Full content reconstruction + validation | Simple deny-all for Edit on state files | Edit provides patches not full content; reconstruction is error-prone |

## Common Pitfalls

### Pitfall 1: go_advisory Standardization Scope
**What goes wrong:** Changing the gate-verifier output but forgetting to remove the mapping logic in skills, leaving dead code
**Why it happens:** Three skills (design, research, spike) have explicit "Map verifier outcomes: go-with-advisory -> go_advisory" instructions
**How to avoid:** After changing gate-verifier to produce `go_advisory`, grep for `go-with-advisory` in skills/ and remove/simplify the mapping
**Warning signs:** Skills still containing "Map: go-with-advisory -> go_advisory" instructions that reference a form the verifier no longer produces

### Pitfall 2: extractDAs Consolidation Breaking G4
**What goes wrong:** Moving extractDAs to gate-utils.js with the G2/G3 return type `[{id, name}]` but forgetting to update G4 callers that use plain string access
**Why it happens:** G4 does `das.push(match[1])` and later `planContent.toUpperCase().indexOf(daId.toUpperCase())`. After consolidation, `daId` becomes `{id, name}` object and `.toUpperCase()` fails
**How to avoid:** Update G4 to use `daId.id.toUpperCase()` after consolidation
**Warning signs:** G4 gate script throwing TypeError on `.toUpperCase()` of an object

### Pitfall 3: Removing nullable Without Checking Required Fields
**What goes wrong:** Removing `nullable: true` might suggest fields should never be null, but many optional fields are legitimately null
**Why it happens:** Developers see "nullable removed" and think they need to always provide values
**How to avoid:** Add the clarifying comment to validate.js: "All fields are implicitly nullable"
**Warning signs:** Skills failing because they think they must provide non-null values for optional fields

### Pitfall 4: Edit Hook Blocking Legitimate Non-State Edits
**What goes wrong:** An overly broad Edit hook blocks edits to non-state files
**Why it happens:** Hook checks `file_path` but uses too broad a pattern
**How to avoid:** Only match files ending with `/.expedite/{name}.yml` where name is one of the 5 state files -- identical to the existing Write hook pattern
**Warning signs:** Edits to skill files, agent files, or planning documents being blocked

## Code Examples

### AUD-022 Fix: Remove nullable and add comment

In `hooks/lib/validate.js`, add after line 4:
```javascript
// All fields are implicitly nullable: null/undefined values skip type/enum checks.
// Schemas define type and enum constraints that apply only to non-null values.
```

In each schema file, remove `, nullable: true` from all field definitions. Example before/after for state.js:
```javascript
// Before
lifecycle_id: { type: 'string', nullable: true },

// After
lifecycle_id: { type: 'string' },
```

### AUD-023 Fix: Add severity to gates schema

In `hooks/lib/schemas/gates.js`, add to `itemSchema.fields`:
```javascript
severity: { type: 'string', enum: ['low', 'medium', 'high'] },
```

### AUD-027/028 Fix: Consolidate helpers into gate-utils.js

Add to `gates/lib/gate-utils.js`:
```javascript
/**
 * Extract DA identifiers and names from a SCOPE.md-format document.
 * @param {string} content - Markdown content with DA headings
 * @returns {Array<{id: string, name: string|null}>} Extracted DA objects
 */
function extractDAs(content) {
  if (!content) return [];
  var das = [];
  var lines = content.split('\n');
  for (var i = 0; i < lines.length; i++) {
    var match = lines[i].match(/^#{1,4}\s+.*?(DA-\d+)(?:\s*[:\-]\s*(.+))?/i);
    if (match) {
      das.push({
        id: match[1].toUpperCase(),
        name: match[2] ? match[2].trim() : null,
      });
    }
  }
  return das;
}

/**
 * Count words in a string.
 * @param {string} text - Text to count words in
 * @returns {number} Word count
 */
function wordCount(text) {
  if (!text) return 0;
  return text.trim().split(/\s+/).filter(function (w) { return w.length > 0; }).length;
}
```

In G4, update DA access pattern:
```javascript
// Before (G4 current code)
var daId = das[dIdx];
var found = planContent && planContent.toUpperCase().indexOf(daId.toUpperCase()) !== -1;

// After (using consolidated extractDAs)
var da = das[dIdx];
var found = planContent && planContent.toUpperCase().indexOf(da.id.toUpperCase()) !== -1;
```

### AUD-029 Fix: Standardize on go_advisory

In `agents/gate-verifier.md`, change output format:
```markdown
<!-- Before -->
outcome: "{go | go-with-advisory | recycle}"

<!-- After -->
outcome: "{go | go_advisory | recycle}"
```

In `hooks/lib/gate-checks.js`:
```javascript
// Before
var PASSING_OUTCOMES = ['go', 'go-with-advisory', 'go_advisory', 'overridden'];

// After
var PASSING_OUTCOMES = ['go', 'go_advisory', 'overridden'];
```

In `hooks/lib/schemas/gates.js`:
```javascript
// Before
var VALID_GATE_OUTCOMES = [
  'go',
  'no-go',         // Also remove per AUD-030
  'go-with-advisory',
  'go_advisory',
  // ...
];

// After
var VALID_GATE_OUTCOMES = [
  'go',
  'go_advisory',
  // ...
];
```

### AUD-035 Fix: Deny Edit on state files

New hook `hooks/deny-state-edit.js`:
```javascript
#!/usr/bin/env node
'use strict';

if (process.env.EXPEDITE_HOOKS_DISABLED === 'true' || process.env.EXPEDITE_HOOKS_DISABLED === '1') {
  process.exit(0);
}

var STATE_FILE_NAMES = ['state.yml', 'checkpoint.yml', 'questions.yml', 'gates.yml', 'tasks.yml'];

var chunks = [];
process.stdin.on('data', function (chunk) { chunks.push(chunk); });
process.stdin.on('end', function () {
  try {
    var input = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    var filePath = input.tool_input && input.tool_input.file_path;
    if (!filePath) { process.exit(0); }

    for (var i = 0; i < STATE_FILE_NAMES.length; i++) {
      if (filePath.endsWith('/.expedite/' + STATE_FILE_NAMES[i])) {
        process.stdout.write(JSON.stringify({
          permissionDecision: 'deny',
          permissionDecisionReason: 'State files (.expedite/*.yml) must be written with the Write tool, not Edit. ' +
            'Use complete-rewrite semantics: read the current file, modify in memory, write the entire file.' +
            ' To bypass enforcement entirely, set EXPEDITE_HOOKS_DISABLED=true.',
        }));
        process.exit(2);
      }
    }
    process.exit(0);
  } catch (err) {
    process.exit(0);
  }
});
process.stdin.on('error', function () { process.exit(0); });
```

## File Impact Summary

| File | Bug IDs | Change Type | Risk |
|------|---------|-------------|------|
| `hooks/lib/validate.js` | AUD-022 | Add comment | None |
| `hooks/lib/schemas/state.js` | AUD-022 | Remove nullable | None |
| `hooks/lib/schemas/checkpoint.js` | AUD-022 | Remove nullable | None |
| `hooks/lib/schemas/gates.js` | AUD-022, AUD-023, AUD-029, AUD-030 | Remove nullable, add severity, remove no-go and go-with-advisory | Low |
| `hooks/lib/schemas/questions.js` | AUD-022 | Remove nullable | None |
| `hooks/lib/schemas/tasks.js` | AUD-022 | Remove nullable | None |
| `hooks/validate-state-write.js` | AUD-024 | Add period | None |
| `hooks/lib/session-summary.js` | AUD-025 | Fix truthiness check | None |
| `hooks/lib/gate-checks.js` | AUD-029 | Remove go-with-advisory from PASSING_OUTCOMES | Low |
| `gates/lib/gate-utils.js` | AUD-027, AUD-028, AUD-031, AUD-034 | Add extractDAs + wordCount, remove formatChecks, add comment | Low |
| `gates/g2-structural.js` | AUD-027, AUD-028 | Remove local extractDAs + wordCount, import from utils | Low |
| `gates/g3-design.js` | AUD-027, AUD-028, AUD-032 | Remove local extractDAs + wordCount, remove fs import, import from utils | Low |
| `gates/g4-plan.js` | AUD-027 | Remove local extractDAs, import from utils, update callers | Low |
| `gates/g5-spike.js` | AUD-028, AUD-032 | Remove local wordCount, remove fs import, import from utils | Low |
| `.claude-plugin/plugin.json` | AUD-033 | Update version + description | None |
| `.claude/settings.json` | AUD-035 | Add Edit matcher | Low |
| `hooks/deny-state-edit.js` | AUD-035 | New file | Low |
| `agents/gate-verifier.md` | AUD-029 | Change go-with-advisory to go_advisory | Low |
| `templates/gates.yml.template` | AUD-029 | Update comment | None |
| `skills/design/SKILL.md` | AUD-029 | Remove go-with-advisory mapping | None |
| `skills/research/SKILL.md` | AUD-029 | Remove go-with-advisory mapping | None |
| `skills/spike/SKILL.md` | AUD-029 | Remove go-with-advisory mapping | None |
| `skills/shared/ref-state-recovery.md` | AUD-036 | Add comment | None |
| `hooks/lib/denial-tracker.js` | AUD-031 | Add comment to clearDenials | None |

**Total files modified:** ~24
**New files:** 1 (`hooks/deny-state-edit.js`)
**JavaScript changes:** 12 files
**Skill/agent instruction changes:** 5 files
**Config/metadata changes:** 3 files
**Documentation changes:** 1 file

## Dependency Analysis

### Internal Dependencies

1. **AUD-022 + AUD-023 + AUD-030:** All modify `hooks/lib/schemas/gates.js`. Should be done in the same edit to avoid conflicts.

2. **AUD-027 + AUD-028 + AUD-031:** All modify `gates/lib/gate-utils.js`. Adding extractDAs and wordCount while removing formatChecks should be a single edit.

3. **AUD-029 + AUD-030:** Both modify `VALID_GATE_OUTCOMES` in `hooks/lib/schemas/gates.js`. Remove both `no-go` and `go-with-advisory` in the same edit.

4. **AUD-029 touches many files:** Gate-verifier agent, gate-checks.js, gates.js schema, template, and 3 skills. This is the most cross-cutting change.

5. **AUD-027 + AUD-032:** G3 changes overlap -- remove local extractDAs, remove local wordCount, AND remove dead fs import. Single edit.

### Recommended Grouping

**Plan 1: JavaScript/Schema Fixes** (AUD-022, AUD-023, AUD-024, AUD-025, AUD-027, AUD-028, AUD-029, AUD-030, AUD-031, AUD-032, AUD-035)
- Task 1: Schema cleanup + hook fixes (AUD-022, AUD-023, AUD-024, AUD-025, AUD-030)
- Task 2: Gate helper consolidation + dead code removal (AUD-027, AUD-028, AUD-031, AUD-032)
- Task 3: go_advisory standardization + Edit hook (AUD-029, AUD-035)

**Plan 2: Metadata + Documentation** (AUD-033, AUD-034, AUD-036)
- Task 1: plugin.json update (AUD-033)
- Task 2: Documentation-only fixes (AUD-034 comment, AUD-036 comment)

## Disposition Summary

| AUD | Status | Action | Complexity |
|-----|--------|--------|------------|
| AUD-022 | CONFIRMED | Remove nullable, add comment | Low (6 files, mechanical) |
| AUD-023 | CONFIRMED | Add severity field | Trivial (1 line) |
| AUD-024 | CONFIRMED | Add period | Trivial (1 char) |
| AUD-025 | CONFIRMED | Fix truthiness check | Trivial (1 line) |
| AUD-026 | CONFIRMED CORRECT | No action needed | None |
| AUD-027 | CONFIRMED | Consolidate extractDAs | Medium (4 files) |
| AUD-028 | CONFIRMED | Consolidate wordCount | Low (4 files) |
| AUD-029 | CONFIRMED | Standardize go_advisory | Medium (7+ files) |
| AUD-030 | CONFIRMED | Remove dead enum | Trivial (1 line) |
| AUD-031 | CONFIRMED | Remove formatChecks, comment clearDenials | Low (2 files) |
| AUD-032 | CONFIRMED | Remove dead imports | Trivial (2 lines) |
| AUD-033 | CONFIRMED | Update plugin.json | Trivial (2 fields) |
| AUD-034 | CONFIRMED | Accept + comment | None (comment only) |
| AUD-035 | CONFIRMED | Add Edit hook | Low (new file + config) |
| AUD-036 | CONFIRMED | Accept + comment | None (comment only) |

## Open Questions

1. **AUD-031: Remove or keep clearDenials?**
   - What we know: Never called, but has a clear future use case (clearing denial counts after successful override)
   - What's unclear: Whether the override flow will ever need it
   - **Recommendation:** Keep with a `// Reserved: called by override flow when denial pattern resolves` comment. It is 12 lines of code and removing it only to re-add later is wasteful.

2. **AUD-035: Separate hook or extend existing hook?**
   - What we know: The Edit tool provides different input structure (old_string/new_string vs content)
   - What's unclear: Whether the existing validate-state-write.js can handle both tool types
   - **Recommendation:** Create a separate lightweight `deny-state-edit.js` hook. It is simpler, avoids modifying the well-tested validation hook, and the behavior is different (deny-all vs validate-and-allow).

3. **AUD-029: Should override outcome also be renamed?**
   - What we know: `VALID_GATE_OUTCOMES` includes both `'override'` and `'overridden'`. The `'override'` value is also potentially dead.
   - What's unclear: Whether any producer uses `'override'` (vs `'overridden'`)
   - **Recommendation:** Out of scope for this phase. Focus on `go-with-advisory` -> `go_advisory` only. The `override`/`overridden` question can be audited separately.

## Sources

### Primary (HIGH confidence)
- `hooks/lib/validate.js` -- nullable handling verified (lines 50-52)
- `hooks/lib/schemas/gates.js` -- VALID_GATE_OUTCOMES and field definitions verified
- `hooks/validate-state-write.js` -- denial messages verified (lines 271-272)
- `hooks/lib/session-summary.js` -- truthiness check verified (line 116), SKILL_STEP_TOTALS verified (line 11)
- `gates/g2-structural.js` -- extractDAs return type verified (lines 50-63), wordCount verified (lines 79-82), fs usage verified (line 69)
- `gates/g3-design.js` -- extractDAs verified (lines 48-62), wordCount verified (lines 150-153), fs NOT used (grep confirmed)
- `gates/g4-plan.js` -- extractDAs returns strings verified (lines 49-60)
- `gates/g5-spike.js` -- wordCount verified (lines 93-96), fs NOT used (grep confirmed)
- `gates/lib/gate-utils.js` -- formatChecks never called (grep verified), computeOutcome produces go_advisory (line 107)
- `hooks/lib/denial-tracker.js` -- clearDenials never called (grep verified)
- `hooks/lib/gate-checks.js` -- PASSING_OUTCOMES includes both forms (line 20)
- `.claude-plugin/plugin.json` -- version 1.0.0 confirmed, description missing Spike
- `.claude/settings.json` -- only Write matcher confirmed (no Edit)
- `agents/gate-verifier.md` -- produces go-with-advisory (line 133)
- `skills/scope/SKILL.md` -- 10 step headings confirmed (Step 1 through Step 10)
- `skills/shared/ref-state-recovery.md` -- empty gates.yml verified (line 142)

## Metadata

**Confidence breakdown:**
- Bug validation: HIGH -- every bug verified by reading exact source files post-Phase 39
- Fix approach: HIGH -- all fixes are mechanical, following established patterns
- Dependency analysis: HIGH -- file overlaps clearly mapped, groupings avoid conflicts

**Research date:** 2026-03-18
**Valid until:** Indefinite (fixes are to stable, versioned source files)
