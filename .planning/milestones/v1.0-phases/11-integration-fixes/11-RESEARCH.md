# Phase 11: Integration Fixes (Gap Closure) - Research

**Researched:** 2026-03-04
**Domain:** Cross-phase integration consistency (state schema, gate outcomes, template resolution)
**Confidence:** HIGH

## Summary

Phase 11 closes three integration findings (INT-01, INT-02, INT-03) discovered during the v1.0 milestone audit. All three are concrete, well-scoped fixes to existing files with no new architecture, no new libraries, and no new design patterns. The changes touch three files: `templates/state.yml.template`, `skills/scope/SKILL.md`, and `skills/research/SKILL.md`.

INT-01 (HIGH severity) adds the `description` field to the state.yml schema and ensures scope SKILL.md Step 4 writes it after Round 1 questioning. INT-02 (MEDIUM severity) aligns the gate outcome schema comment in state.yml.template with the actual outcomes produced by scope Step 9 (`hold` and `go_advisory`). INT-03 (LOW severity) adds Glob fallback for template path resolution in research SKILL.md Step 8, matching the pattern already established in scope SKILL.md.

**Primary recommendation:** Execute all three fixes as a single plan -- they are independent, touch distinct file sections, and collectively take less than 10 minutes.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| STATE-02 | Every state.yml write uses complete-file rewrite with backup-before-write | INT-01 fix must use the existing backup-before-write pattern when adding description field write |
| STATE-04 | Phase transitions use granular sub-states | INT-01 fix ensures description field is present for resume routing logic in Step 1 Case B |
| CTX-01 | Every SKILL.md includes `!cat .expedite/state.yml` for dynamic context injection | INT-01 fix ensures the injected state.yml contains description for resume context display |
| GATE-02 | Each gate has MUST criteria (all must pass for Go) and SHOULD criteria (failures produce advisory) | INT-02 fix aligns schema comment to document `hold` (scope-specific) and `go_advisory` outcomes |
| STATE-05 | Phase transitions are forward-only | INT-02 fix ensures gate outcome values in schema match actual skill behavior for forward-only enforcement |
| RSCH-02 | Up to 3 research subagents dispatched in parallel via Task() API | INT-03 fix ensures template paths resolve correctly regardless of CWD via Glob fallback |
| TMPL-04 | 3 per-source researcher templates | INT-03 fix ensures consistent template resolution pattern across scope and research skills |
</phase_requirements>

## Standard Stack

Not applicable -- this phase modifies existing Markdown and YAML files only. No libraries, frameworks, or external dependencies involved.

## Architecture Patterns

### Pattern 1: State Schema Field Addition (INT-01)

**What:** Adding the `description` field to state.yml.template and writing it in the scope skill's state update block.

**Current state.yml.template structure (lines 7-10):**
```yaml
# Lifecycle identity
project_name: null
intent: null
lifecycle_id: null
```

**Required change:** Add `description: null` to the lifecycle identity section. This field sits alongside `project_name`, `intent`, and `lifecycle_id` as a top-level scalar -- it does NOT violate the 2-level nesting limit (STATE-01).

**Current scope SKILL.md Step 4 "After Round 1" state write block (line 196-199):**
```markdown
- Set `project_name` to the collected value
- Set `intent` to "product" or "engineering"
- Set `lifecycle_id` to `{project_name_slugified}-{YYYYMMDD}`
- Set `last_modified` to current timestamp
```

**Required change:** Add `- Set `description` to the collected value` to this list.

**Resume routing impact:** Step 1 Case B (line 47-48) already references `{description if available}` in the resume display and uses it for routing logic (line 65: "If intent and description are set but no questions, skip to Step 5"). Currently this reads from injected state.yml where description does not exist. After the fix, it will be present.

**Confidence:** HIGH -- direct file inspection confirms the gap and the fix location.

### Pattern 2: Gate Outcome Schema Alignment (INT-02)

**What:** Updating the gate_history item schema comment in state.yml.template to match actual outcomes written by scope Step 9.

**Current schema comment (state.yml.template line 56):**
```yaml
#   outcome: "go"            # go | go_advisory | recycle | override
```

**Actual outcomes written by scope Step 9:**
- `go` -- all MUST pass, all SHOULD pass
- `go_advisory` -- all MUST pass, some SHOULD fail
- `hold` -- any MUST fail (scope-specific; G2/G3 use `recycle` instead per STATE.md decision 04-03)

**Required change:** Update the comment to:
```yaml
#   outcome: "go"            # go | go_advisory | hold | recycle | override
```

This includes ALL valid outcomes across all gates: `go` and `go_advisory` (all gates), `hold` (scope G1 only), `recycle` (G2/G3), `override` (any gate with user override).

**Design decision:** The audit noted two options -- either update the schema to include `hold`, or rename scope's `hold` to `recycle`. The correct choice is to KEEP `hold` as distinct from `recycle` because they have different semantics:
- `hold` = interactive fix inline (scope is an interactive skill, user is present)
- `recycle` = re-run the producing skill (research/design are batch processes)

This semantic distinction was an intentional design decision documented in STATE.md: "Hold outcome offers inline fix unique to scope (interactive skill); G2/G3 use Recycle instead."

**Confidence:** HIGH -- exact line numbers verified, semantic rationale documented in STATE.md.

### Pattern 3: Glob Fallback for Template Paths (INT-03)

**What:** Adding Glob fallback pattern in research SKILL.md Step 8 for template path resolution, consistent with scope SKILL.md.

**Current research SKILL.md Step 8 (lines 250-252):**
```markdown
- `"web"` source -> Read `skills/research/references/prompt-web-researcher.md`
- `"codebase"` source -> Read `skills/research/references/prompt-codebase-analyst.md`
- Any MCP source -> Read `skills/research/references/prompt-mcp-researcher.md`
```

These are direct relative paths. If CWD differs from the plugin root, they fail silently.

**Scope SKILL.md established pattern (Step 3, line 128; Step 6a, line 290):**
```markdown
Use Glob to find `**/templates/state.yml.template` to resolve the plugin's installation path
```
```markdown
Read the file `skills/scope/references/prompt-scope-questioning.md`
(use Glob with `**/prompt-scope-questioning.md` if the direct path fails)
```

**Required change:** Apply the same "direct path first, Glob fallback" pattern to each template reference in research SKILL.md Step 8:
```markdown
- `"web"` source -> Read `skills/research/references/prompt-web-researcher.md`
  (use Glob with `**/prompt-web-researcher.md` if the direct path fails)
- `"codebase"` source -> Read `skills/research/references/prompt-codebase-analyst.md`
  (use Glob with `**/prompt-codebase-analyst.md` if the direct path fails)
- Any MCP source -> Read `skills/research/references/prompt-mcp-researcher.md`
  (use Glob with `**/prompt-mcp-researcher.md` if the direct path fails)
```

**Confidence:** HIGH -- pattern already established in scope skill, direct application.

### Anti-Patterns to Avoid

- **Renaming `hold` to `recycle` in scope SKILL.md:** This would lose the semantic distinction between interactive inline fix (hold) and batch re-run (recycle). The schema comment should be broadened, not the skill narrowed.
- **Adding `description` to the questions array or a nested structure:** It is a top-level lifecycle identity field, not per-question metadata. Keep it at root level alongside `project_name`.
- **Using only Glob (dropping direct path):** The direct path is faster and more predictable. Glob is the fallback, not the primary resolution strategy.

## Don't Hand-Roll

Not applicable -- all changes are direct edits to existing template/skill files. No new functionality being built.

## Common Pitfalls

### Pitfall 1: Breaking the 2-Level Nesting Limit

**What goes wrong:** Adding `description` inside a nested structure would violate STATE-01.
**Why it happens:** Temptation to group lifecycle fields into a sub-object.
**How to avoid:** Place `description: null` as a top-level field, same level as `project_name` and `intent`.
**Warning signs:** Any indentation beyond the top level for the new field.

### Pitfall 2: Inconsistent Gate Outcome Values

**What goes wrong:** Updating the schema comment but not verifying that all consumers parse the new values correctly.
**Why it happens:** Other skills may eventually read gate_history and assume only the original 4 values.
**How to avoid:** The status skill (Phase 2) uses LLM parsing of injected YAML, so it handles any string value. Phase 6+ skills are not yet implemented. The schema comment is documentation, not runtime validation -- YAML has no enum enforcement.
**Warning signs:** Any code that hard-codes gate outcome values as an enum.

### Pitfall 3: Glob Pattern Too Broad

**What goes wrong:** `**/prompt-web-researcher.md` could match files in unexpected locations if the user has similarly-named files outside the plugin.
**Why it happens:** `**` matches any depth.
**How to avoid:** This is acceptable risk -- the same pattern is already used in scope SKILL.md and has been human-tested. The file names are specific enough (prefixed with `prompt-`) to avoid false matches.
**Warning signs:** Multiple Glob matches for the same pattern.

## Code Examples

### INT-01: state.yml.template After Fix

```yaml
# Lifecycle identity
project_name: null
intent: null
lifecycle_id: null
description: null
```

### INT-01: Scope SKILL.md Step 4 After Fix

```markdown
**After Round 1: Write to state.yml**
Using the backup-before-write pattern:
1. Read `.expedite/state.yml`
2. Copy to backup: `cp .expedite/state.yml .expedite/state.yml.bak` (via Bash)
3. Update the in-memory representation:
   - Set `project_name` to the collected value
   - Set `intent` to "product" or "engineering"
   - Set `lifecycle_id` to `{project_name_slugified}-{YYYYMMDD}` (e.g., "auth-redesign-20260302")
   - Set `description` to the collected value
   - Set `last_modified` to current timestamp
4. Write the entire file back to `.expedite/state.yml`
```

### INT-02: state.yml.template Gate Schema After Fix

```yaml
#   outcome: "go"            # go | go_advisory | hold | recycle | override
```

### INT-03: Research SKILL.md Step 8 After Fix

```markdown
1. **Determine the template file** based on the batch source:
   - `"web"` source -> Read `skills/research/references/prompt-web-researcher.md`
     (use Glob with `**/prompt-web-researcher.md` if the direct path fails)
   - `"codebase"` source -> Read `skills/research/references/prompt-codebase-analyst.md`
     (use Glob with `**/prompt-codebase-analyst.md` if the direct path fails)
   - Any MCP source -> Read `skills/research/references/prompt-mcp-researcher.md`
     (use Glob with `**/prompt-mcp-researcher.md` if the direct path fails)
```

## State of the Art

Not applicable -- this phase is internal consistency fixes, not technology adoption.

## Open Questions

None. All three fixes are fully specified with exact file locations, exact content changes, and clear rationale. No external research or technology decisions needed.

## Sources

### Primary (HIGH confidence)

- `templates/state.yml.template` -- direct file inspection confirming missing `description` field and gate outcome schema comment
- `skills/scope/SKILL.md` -- direct file inspection confirming Step 4 omits description write, Step 1 Case B expects it, Step 6a/Step 3 Glob fallback pattern
- `skills/research/SKILL.md` -- direct file inspection confirming Step 8 uses direct paths without Glob fallback
- `.planning/v1.0-MILESTONE-AUDIT.md` -- integration findings INT-01, INT-02, INT-03 with severity, evidence, and fix recommendations
- `.planning/STATE.md` -- decision 04-03 documenting `hold` vs `recycle` semantic distinction

## Metadata

**Confidence breakdown:**
- Standard stack: N/A - no external dependencies
- Architecture: HIGH - all changes are to existing files with exact locations identified
- Pitfalls: HIGH - pitfalls are minor and well-understood

**Research date:** 2026-03-04
**Valid until:** Indefinite -- internal consistency fixes do not expire
