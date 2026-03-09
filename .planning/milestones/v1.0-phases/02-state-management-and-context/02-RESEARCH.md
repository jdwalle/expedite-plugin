# Phase 2: State Management and Context - Research

**Researched:** 2026-02-28
**Domain:** YAML state persistence, context reconstruction, lifecycle state machines
**Confidence:** HIGH

## Summary

Phase 2 implements the state management backbone that every subsequent phase depends on. The core deliverables are: (1) a state.yml file in `.expedite/` that tracks lifecycle position with granular sub-states, (2) a backup-before-write pattern for crash safety, (3) the `/expedite:status` skill that renders a human-readable lifecycle overview, and (4) context reconstruction after `/clear` via the `!cat .expedite/state.yml` injection already present in all SKILL.md files from Phase 1.

The technical domain is well-understood. The state schema is fully specified in the PRODUCT-DESIGN.md with exact field names, valid phase values, and nesting constraints. The `!cat` dynamic injection syntax is a documented Claude Code plugin feature confirmed by the official plugin-dev documentation and already wired into all 6 SKILL.md stubs. The hooks.json format for SessionStart is now resolved (LOW confidence from Phase 1 is now HIGH) -- the plugin-dev hook-development skill documents the exact schema: `hooks/hooks.json` with `{"hooks": {"SessionStart": [...]}}` wrapper format. The backup-before-write and complete-file-rewrite patterns are standard defensive practices with no library dependencies.

**Primary recommendation:** Implement state.yml schema directly from the PRODUCT-DESIGN.md specification, using Bash `cp` for backup and the Write tool for complete-file rewrite. Build the status skill as a read-only SKILL.md that parses state.yml and renders formatted output. Defer SessionStart hook to a separate plan within this phase since it has platform risk (3 open bugs) and the two other context layers (`!cat` injection + `/expedite:status`) provide full coverage independently.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| STATE-01 | state.yml persists lifecycle state with max 2 nesting levels in `.expedite/` directory | PRODUCT-DESIGN.md provides exact schema with `questions` and `gate_history` as the only nested structures (lists of flat objects). Max 2 levels confirmed as ROCK SOLID confidence in CONFIDENCE-AUDIT.md. |
| STATE-02 | Every state.yml write uses complete-file rewrite with backup-before-write (state.yml.bak) | PRODUCT-DESIGN.md specifies 4-step write pattern: read, copy to .bak, modify in-memory, write entire file. Standard defensive pattern requiring only `cp` and Write tool. |
| STATE-03 | state.yml includes version field for schema evolution | Schema starts at `version: "1"`. Field is top-level, string-typed. Enables future schema migration without breaking existing state files. |
| STATE-04 | Phase transitions use granular sub-states (`scope_in_progress`, `scope_complete`, `research_recycled`, etc.) | PRODUCT-DESIGN.md enumerates all valid phase values: `scope_in_progress`, `scope_complete`, `research_in_progress`, `research_complete`, `research_recycled`, `design_in_progress`, `design_complete`, `design_recycled`, `plan_in_progress`, `plan_complete`, `plan_recycled`, `execute_in_progress`, `complete`, `archived`. Confidence: HIGH per CONFIDENCE-AUDIT.md. |
| STATE-05 | Phase transitions are forward-only -- no backward movement through lifecycle | PRODUCT-DESIGN.md specifies forward-only transitions. The only apparent "backward" movement is recycle (`{phase}_recycled` -> `{phase}_in_progress`), which is a controlled re-entry, not regression. Transition validation is enforcement logic in each skill. |
| STATE-06 | Crash recovery is unambiguous from phase name alone (sub-state determines resume point) | Each sub-state maps to exactly one resume action: `*_in_progress` means "continue current phase", `*_complete` means "run next phase", `*_recycled` means "re-run current phase with gap-fill". No ambiguity exists. |
| CTX-01 | Every SKILL.md includes `!cat .expedite/state.yml` for dynamic context injection on invocation | Already implemented in Phase 1. All 6 SKILL.md files contain `!cat .expedite/state.yml 2>/dev/null \|\| echo "No active lifecycle"`. Phase 2 creates the state.yml file that this injection reads. |
| CTX-02 | `/expedite:status` displays full lifecycle overview (current phase, question status, gate history, next action) | Status skill stub exists from Phase 1. Phase 2 replaces the stub body with parsing logic that reads state.yml and renders formatted output. The skill already has `Read`, `Glob`, `Bash` in allowed-tools. |
| CTX-03 | Context reconstruction works after `/clear` via `!cat` injection + manual status (two-layer fallback) | Layer 1: `!cat` injection in SKILL.md fires automatically on any `/expedite:*` invocation. Layer 2: `/expedite:status` can be invoked manually. Both are independent of SessionStart hook. A third layer (SessionStart hook) is bonus but not required for CTX-03. |
</phase_requirements>

## Standard Stack

### Core

| Component | Version | Purpose | Why Standard |
|-----------|---------|---------|--------------|
| YAML (state.yml) | N/A | Lifecycle state persistence | LLM-parseable, human-readable, no dependencies. PRODUCT-DESIGN.md specifies flat YAML with max 2 nesting levels. |
| `cp` (Bash) | System | Backup-before-write | Zero-dependency file copy for .bak creation. Standard Unix utility. |
| Write tool | Claude Code | Complete-file rewrite | Platform tool for atomic file writes. Used instead of append to prevent partial-update corruption. |
| `!cat` syntax | Claude Code | Dynamic context injection in SKILL.md | Documented plugin feature -- executes shell command and injects stdout into skill context at invocation time. |
| hooks/hooks.json | Claude Code | SessionStart hook configuration | Plugin hook format with `{"hooks": {"SessionStart": [...]}}` wrapper. Confirmed by plugin-dev hook-development skill. |

### Supporting

| Component | Purpose | When to Use |
|-----------|---------|-------------|
| `grep` + `sed` (Bash) | Parse state.yml fields in hook script | SessionStart hook extracts phase, project_name, intent from state.yml without requiring yq |
| `${CLAUDE_PLUGIN_ROOT}` | Portable path reference in hooks | Reference hook scripts relative to plugin root |
| `$CLAUDE_PROJECT_DIR` | Project root in hook scripts | Locate `.expedite/state.yml` relative to project |
| templates/ directory | state.yml.template, gitignore.template | Initialized during `/expedite:scope` (Phase 4), but template files created now |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| YAML state.yml | JSON state file | YAML is more LLM-parseable and human-readable. JSON requires quoting all keys. Design explicitly chose YAML. |
| Complete-file rewrite | Append-only pattern | Append works for logs but not for mutable state where fields change. Complete rewrite is the correct pattern for state.yml. |
| `grep`/`sed` in hook | `yq` YAML parser | yq is a dependency that may not be installed. grep/sed is zero-dependency and sufficient for flat YAML. Design explicitly avoids yq. |
| Manual `cp` for backup | Versioned state files | Versioned files (state.v1.yml, state.v2.yml) accumulate. Single .bak is simpler and sufficient for single-write recovery. |

**Installation:**
No package installation required. All components are built-in Claude Code features or standard Unix utilities.

## Architecture Patterns

### Recommended File Structure

```
.expedite/                     # Created by /expedite:scope (Phase 4)
  state.yml                    # Current lifecycle state (complete-rewrite)
  state.yml.bak                # Backup before last state write
  sources.yml                  # Source configuration (Phase 10)
  log.yml                      # Append-only telemetry (Phase 10, gitignored)
  scope/                       # Phase 4 artifacts
  research/                    # Phase 5-6 artifacts
  design/                      # Phase 7 artifacts
  plan/                        # Phase 8 artifacts
  execute/                     # Phase 9 artifacts
  archive/                     # Archived prior lifecycles (Phase 10)

hooks/                         # Plugin hook configuration
  hooks.json                   # SessionStart hook definition
scripts/                       # Plugin hook scripts
  session-start.sh             # SessionStart hook implementation
templates/                     # State/config templates
  state.yml.template           # Initial state.yml content
  gitignore.template           # .gitignore for .expedite/ directory
```

### Pattern 1: Complete-File Rewrite with Backup

**What:** Every state.yml modification follows a 4-step protocol: read current, backup to .bak, modify in-memory, write entire file.
**When to use:** Every time any skill needs to update state.yml.
**Example:**

```bash
# Step 1: Read current state (done by the skill reading state.yml)
# Step 2: Backup before write
cp .expedite/state.yml .expedite/state.yml.bak

# Step 3: Modify in-memory (done by skill logic)
# Step 4: Write entire file back (using Write tool)
```

Source: PRODUCT-DESIGN.md "State Write Pattern" section

**Key details:**
- The Write tool performs a complete file overwrite, not a patch
- The `cp` command is executed via Bash tool before the Write
- If the write is interrupted, state.yml.bak contains the pre-write state
- Skills should ALWAYS backup before writing, even for trivial updates

### Pattern 2: Phase State Machine (Forward-Only)

**What:** The `phase` field in state.yml is a finite state machine with forward-only transitions.
**When to use:** Every phase transition in every skill.
**Transition diagram:**

```
(none) --> scope_in_progress --> scope_complete [G1]
scope_complete --> research_in_progress --> research_complete [G2]
                                       --> research_recycled --> research_in_progress
research_complete --> design_in_progress --> design_complete [G3]
                                        --> design_recycled --> design_in_progress
design_complete --> plan_in_progress --> plan_complete [G4]
                                    --> plan_recycled --> plan_in_progress
plan_complete --> execute_in_progress --> complete
Any phase --> archived
```

Source: PRODUCT-DESIGN.md "Phase Transitions" section

**Transition validation rules:**
- Forward transitions only (scope -> research -> design -> plan -> execute -> complete)
- Recycle sets `{phase}_recycled`; re-entry transitions to `{phase}_in_progress`
- Override (`--override` flag) bypasses a gate's Recycle/Hold and forces forward transition
- "Pause" is not a phase -- it is `execute_in_progress` with checkpoint.yml
- Each `_complete` phase is proof that the output gate passed

### Pattern 3: Dynamic Context Injection

**What:** Every SKILL.md includes `!cat .expedite/state.yml 2>/dev/null || echo "No active lifecycle"` at the top of its body.
**When to use:** Already implemented in all 6 SKILL.md files.
**How it works:**

```markdown
Current lifecycle state:
!`cat .expedite/state.yml 2>/dev/null || echo "No active lifecycle"`
```

When any `/expedite:*` skill is invoked, Claude Code executes the `cat` command and injects the stdout into the skill's context. This means the LLM receives the full state.yml content at the start of every skill invocation, enabling context-aware behavior without any explicit "load state" step.

Source: plugin-dev plugin-features-reference.md, PRODUCT-DESIGN.md Decision 21

**Key details:**
- The `2>/dev/null` suppresses errors when `.expedite/` does not exist (no active lifecycle)
- The `|| echo "No active lifecycle"` provides a human-readable fallback
- This is the primary context reconstruction mechanism after `/clear`
- The `!command` syntax is executed by Claude Code at skill load time, before the LLM processes the skill body

### Pattern 4: SessionStart Hook

**What:** A hook script that fires on session start, reads state.yml, and outputs a 2-3 line context summary.
**When to use:** Every new Claude Code session or after restart.
**Example hooks/hooks.json:**

```json
{
  "hooks": {
    "SessionStart": [
      {
        "matcher": "*",
        "hooks": [
          {
            "type": "command",
            "command": "bash ${CLAUDE_PLUGIN_ROOT}/scripts/session-start.sh",
            "timeout": 10
          }
        ]
      }
    ]
  }
}
```

Source: plugin-dev hook-development SKILL.md, PRODUCT-DESIGN.md "SessionStart Hook" section

**Key details:**
- Uses plain text stdout (not JSON additionalContext) to avoid bugs #16538, #13650, #11509
- Hook script reads phase, project_name, intent from state.yml using grep
- Uses case statement for phase-aware next-step routing
- Script exits 0 silently if no `.expedite/state.yml` exists
- This is the THIRD fallback layer -- not required for CTX-03 (which only requires two layers)
- Platform risk: MEDIUM. Three open bugs may prevent hook output from reaching Claude

### Pattern 5: Status Skill Display Format

**What:** `/expedite:status` reads state.yml and renders a formatted lifecycle overview.
**When to use:** Manual context reconstruction, lifecycle overview.
**Output should include:**

```
Expedite Lifecycle: "auth-redesign" (engineering intent)
Phase: research_complete
Next: Run /expedite:design to generate the design

Questions: 8 total (6 covered, 1 partial, 1 not covered)
Gates: G1 go (scope), G2 go_advisory (research)

Recommended action: /expedite:design
```

Source: PRODUCT-DESIGN.md, CTX-02 requirement

### Anti-Patterns to Avoid

- **Partial-update writes:** Never use `sed -i` or line-level editing on state.yml. Always read the full file, modify in memory, write the complete file back. Partial updates risk corruption.
- **Nested YAML deeper than 2 levels:** Questions list contains flat objects. Gate history list contains flat objects. No sub-objects within items. If you find yourself nesting deeper, the schema is wrong.
- **Backward phase transitions:** No skill should ever set `phase` to a value that precedes the current phase in the state machine. The only exception is recycle (`*_recycled` -> `*_in_progress`), which is a controlled re-entry pattern.
- **Appending to state.yml:** State.yml is complete-rewrite, not append. Only log.yml uses append.
- **Using `yq` or external YAML parsers in hook scripts:** The hook script must work on any machine without dependencies. Use `grep` and `sed` only.
- **Trusting SessionStart hook will work:** Three open bugs (#16538, #13650, #11509). Always assume the hook may not fire and rely on `!cat` injection as the primary mechanism.
- **Omitting the .bak backup step:** Even for "trivial" state changes, ALWAYS create the backup. The cost is one `cp` command; the benefit is crash recovery.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| YAML parsing in Bash | Custom awk/sed YAML parser | Simple `grep '^field:'` for flat top-level fields | Full YAML parsing in Bash is fragile. Flat schema means grep works for all top-level fields. |
| State file locking | File lock mechanism (flock) | Complete-file rewrite + .bak | Single-user workflow (explicit out-of-scope for multi-user). Locking adds complexity for no benefit. |
| Schema migration engine | Version-aware migration system | Manual `version` field check | v1 only needs `version: "1"`. Migration is a v2 concern. The field exists for future use. |
| Context reconstruction framework | Custom state deserialization | `!cat` injection + status skill | Platform's `!cat` syntax handles injection. The LLM parses YAML natively. No custom code needed. |
| Phase transition engine | Centralized state machine library | Per-skill transition validation | Each skill knows its valid transitions. A centralized engine would need to be loaded by every skill, adding context overhead. |

**Key insight:** Phase 2's power comes from the simplicity of its patterns. State.yml is flat YAML that the LLM reads directly via `!cat`. The backup is a `cp` command. The write is a Write tool call. The status display is SKILL.md markdown that reads a file. There is no custom runtime, no library, no build step. The entire state management system is files and shell commands.

## Common Pitfalls

### Pitfall 1: State.yml Growing Beyond 100 Lines

**What goes wrong:** With 15+ questions, each having 8 fields, state.yml exceeds the 100-line soft target.
**Why it happens:** Per-question metadata (id, text, priority, decision_area, source_hints, status, source, gap_details, evidence_files) is verbose.
**How to avoid:** This is a known scaling pressure documented in CONFIDENCE-AUDIT.md. The 100-line target is soft, not hard. For v1, accept that large-scope projects may produce 150-180 line state files. Monitor but do not prematurely optimize.
**Warning signs:** State.yml exceeding 200 lines. At that point, consider splitting question state to a separate file (v2 concern).

### Pitfall 2: Hook Script Failing Silently

**What goes wrong:** SessionStart hook does not produce output, and the user has no context.
**Why it happens:** Three open bugs (#16538, #13650, #11509) may prevent hook stdout from reaching Claude.
**How to avoid:** Never rely solely on the hook. The `!cat` injection in SKILL.md is the primary mechanism. The hook is a bonus third layer.
**Warning signs:** After restarting Claude Code, no "Expedite lifecycle active" message appears. This is expected behavior if bugs are active -- the fallback layers handle it.

### Pitfall 3: Forgetting to Rename arc to expedite

**What goes wrong:** Hook scripts, templates, or state references use `.arc/` instead of `.expedite/`.
**Why it happens:** PRODUCT-DESIGN.md uses "arc" throughout. Copy-pasting without renaming.
**How to avoid:** Search all new files for "arc" before committing. Use "expedite" for: state directory (`.expedite/`), namespace (`/expedite:`), all user-facing text.
**Warning signs:** References to `.arc/` or `/arc:` in any file.

### Pitfall 4: Allowing Backward Phase Transitions

**What goes wrong:** A skill sets `phase` to a value that is "earlier" than the current phase (e.g., going from `design_in_progress` back to `research_in_progress`).
**Why it happens:** Confusion between recycle (controlled re-entry within current phase) and regression (jumping back to a prior phase).
**How to avoid:** Each skill should validate that its target phase is reachable from the current phase per the state machine. Recycle only goes `*_recycled` -> `*_in_progress` for the SAME phase.
**Warning signs:** Phase field showing a value from an earlier lifecycle stage than what was previously recorded.

### Pitfall 5: Incomplete State Schema

**What goes wrong:** Missing fields in state.yml cause downstream skills to fail when they expect certain data.
**Why it happens:** State.yml is created during `/expedite:scope` (Phase 4) but the schema is defined now. If the schema is incomplete, Phase 4 creates an incomplete file.
**How to avoid:** The template (state.yml.template) must include ALL fields from the PRODUCT-DESIGN.md schema, even those that start as `null` or empty.
**Warning signs:** Skills encountering "field not found" when reading state.yml.

### Pitfall 6: hooks.json Format Confusion

**What goes wrong:** Using the settings format (direct event keys at top level) instead of the plugin format (wrapped in `{"hooks": {...}}`).
**Why it happens:** Two different JSON formats exist for hook configuration -- one for plugins (`hooks/hooks.json` with wrapper) and one for user settings (`.claude/settings.json` without wrapper).
**How to avoid:** Plugin hooks.json MUST use the wrapper format: `{"hooks": {"SessionStart": [...]}}`. Optionally include a `"description"` field at top level.
**Warning signs:** Hooks not loading at plugin startup. Use `claude --debug` to diagnose.

## Code Examples

Verified patterns from official sources and design specification:

### state.yml Template

```yaml
# Expedite Lifecycle State -- machine-readable, complete-rewrite on every update
version: "1"
last_modified: "2026-02-28T00:00:00Z"

# Lifecycle identity
project_name: null
intent: null
lifecycle_id: null

# Current position (granular phases for crash recovery)
phase: "scope_in_progress"
current_task: null

# Research rounds
research_rounds: 0

# Questions (flat list, max 2 nesting levels)
questions: []

# Gate history (flat list, append-only in state)
gate_history: []

# Execution state
tasks: []
current_wave: null
```

Source: PRODUCT-DESIGN.md state.yml schema, adapted for expedite naming

### Backup-Before-Write Pattern

```bash
# In any skill that modifies state.yml:
# Step 1: Backup current state
cp .expedite/state.yml .expedite/state.yml.bak 2>/dev/null || true

# Step 2: Write new state (via Write tool -- complete file overwrite)
# The skill constructs the full YAML content and writes it
```

Source: PRODUCT-DESIGN.md "State Write Pattern"

### SessionStart Hook Script (scripts/session-start.sh)

```bash
#!/bin/bash
# Expedite SessionStart hook -- inject lifecycle context on new sessions
# Uses plain text stdout to avoid additionalContext JSON bugs

STATE_FILE="$CLAUDE_PROJECT_DIR/.expedite/state.yml"

if [ ! -f "$STATE_FILE" ]; then
  exit 0  # No active lifecycle -- silent exit
fi

# Extract key fields using grep (avoids yq dependency)
PHASE=$(grep '^phase:' "$STATE_FILE" | head -1 | sed 's/phase: *"\{0,1\}\([^"]*\)"\{0,1\}/\1/')
PROJECT=$(grep '^project_name:' "$STATE_FILE" | head -1 | sed 's/project_name: *"\{0,1\}\([^"]*\)"\{0,1\}/\1/')
INTENT=$(grep '^intent:' "$STATE_FILE" | head -1 | sed 's/intent: *"\{0,1\}\([^"]*\)"\{0,1\}/\1/')

echo "Expedite lifecycle active: \"$PROJECT\" ($INTENT intent)"
echo "Current phase: $PHASE"

# Phase-aware next-step routing
case "$PHASE" in
  *_in_progress)
    BASE_PHASE=$(echo "$PHASE" | sed 's/_in_progress//')
    echo "Continue with /expedite:$BASE_PHASE"
    ;;
  *_complete)
    case "$PHASE" in
      scope_complete) echo "Run /expedite:research to begin evidence gathering" ;;
      research_complete) echo "Run /expedite:design to generate the design" ;;
      design_complete) echo "Run /expedite:plan to generate the plan" ;;
      plan_complete) echo "Run /expedite:execute to begin implementation" ;;
    esac
    ;;
  *_recycled)
    BASE_PHASE=$(echo "$PHASE" | sed 's/_recycled//')
    echo "Re-run /expedite:$BASE_PHASE to address gaps (or use --override to proceed)"
    ;;
  execute_in_progress)
    echo "Resume with /expedite:execute"
    ;;
  complete)
    echo "Lifecycle complete. Run /expedite:scope for new lifecycle."
    ;;
  *)
    echo "Run /expedite:status for details"
    ;;
esac
```

Source: PRODUCT-DESIGN.md "SessionStart Hook", adapted for expedite naming and $CLAUDE_PROJECT_DIR

### hooks/hooks.json

```json
{
  "description": "Expedite lifecycle context injection on session start",
  "hooks": {
    "SessionStart": [
      {
        "matcher": "*",
        "hooks": [
          {
            "type": "command",
            "command": "bash ${CLAUDE_PLUGIN_ROOT}/scripts/session-start.sh",
            "timeout": 10
          }
        ]
      }
    ]
  }
}
```

Source: plugin-dev hook-development SKILL.md "Plugin hooks.json Format" section

### Phase Transition Validation (Conceptual)

```
# Valid forward transitions map
# Each key can transition to the listed values:

VALID_TRANSITIONS = {
  null:                    [scope_in_progress],
  scope_in_progress:       [scope_complete],
  scope_complete:          [research_in_progress],
  research_in_progress:    [research_complete, research_recycled],
  research_recycled:       [research_in_progress],
  research_complete:       [design_in_progress],
  design_in_progress:      [design_complete, design_recycled],
  design_recycled:         [design_in_progress],
  design_complete:         [plan_in_progress],
  plan_in_progress:        [plan_complete, plan_recycled],
  plan_recycled:           [plan_in_progress],
  plan_complete:           [execute_in_progress],
  execute_in_progress:     [complete],
  *:                       [archived],
}

# Each skill validates: target_phase in VALID_TRANSITIONS[current_phase]
# If not valid, the transition is rejected.
```

Source: PRODUCT-DESIGN.md "Phase Transitions" section, formalized as lookup

### Status Skill Output Template

```markdown
# Expedite Lifecycle Status

**Project:** {project_name}
**Intent:** {intent}
**Phase:** {phase} ({human-readable description})

## Next Action
{phase-aware recommendation}

## Questions ({total} total)
| Status | Count |
|--------|-------|
| Covered | {n} |
| Partial | {n} |
| Not Covered | {n} |
| Pending | {n} |

## Gate History
| Gate | Outcome | Timestamp |
|------|---------|-----------|
| {gate} | {outcome} | {timestamp} |

## Recovery Info
State file: .expedite/state.yml
Backup: .expedite/state.yml.bak
```

Source: CTX-02 requirement, PRODUCT-DESIGN.md status skill specification

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| hooks.json field naming unknown | `{"hooks": {"SessionStart": [...]}}` wrapper format confirmed | Phase 2 research | Resolves LOW confidence blocker from Phase 1. Hook implementation can proceed. |
| Context injection as optional bonus | `!cat` in SKILL.md as PRIMARY context mechanism | PRODUCT-DESIGN.md design | SessionStart hook is defense-in-depth, not the primary layer. Simplifies Phase 2 since `!cat` already works from Phase 1. |
| GSD uses Markdown-based state (STATE.md) | Expedite uses pure YAML state (state.yml) | Design decision | YAML is more machine-parseable. GSD's pattern of regex-extracting fields from Markdown is fragile. Expedite's flat YAML is directly parseable by both LLMs and shell tools. |

**Deprecated/outdated:**
- PRODUCT-DESIGN.md references "arc" throughout -- rename to "expedite" in all implementation
- Decision 27 (hooks.json field naming) was LOW confidence in Phase 1 but is now RESOLVED: the plugin-dev hook-development skill documents the exact schema
- The `imported_from` and `constraints` fields in the state schema are for cross-lifecycle import (v2 feature, IMPORT-01 through IMPORT-04) -- include them in template for forward compatibility but leave as null/empty

## Open Questions

1. **Should state.yml.template include v2 fields (imported_from, constraints)?**
   - What we know: These fields support cross-lifecycle import, which is deferred to v2. Including them in the template adds 2 lines and costs nothing.
   - What's unclear: Whether including unused fields causes confusion or whether omitting them causes a schema break in v2.
   - Recommendation: Include them with null/empty values and a YAML comment marking them as "reserved for v2". This preserves forward compatibility and the `version: "1"` schema is complete from day one.

2. **How should the status skill handle missing state.yml?**
   - What we know: `!cat` injection already handles this with `|| echo "No active lifecycle"`. The status skill needs equivalent graceful handling.
   - What's unclear: Whether to display a helpful "get started" message or just "no lifecycle active".
   - Recommendation: Display "No active Expedite lifecycle. Run `/expedite:scope` to start." This is actionable and guides the user.

3. **Should the .expedite/ directory be created in Phase 2 or deferred to Phase 4 (scope skill)?**
   - What we know: State.yml is first created when `/expedite:scope` runs (Phase 4). Phase 2 creates the template and the schema, not the runtime directory.
   - What's unclear: Whether Phase 2 verification requires a test state.yml to exist.
   - Recommendation: Phase 2 creates templates and hooks but does NOT create `.expedite/` directory. That directory is created by `/expedite:scope` at runtime (Phase 4). Phase 2 verification can test the status skill and hook script with a manually-created test state.yml that is removed after verification.

## Sources

### Primary (HIGH confidence)
- **PRODUCT-DESIGN.md** (`.planning/research/arc-implementation/design/PRODUCT-DESIGN.md`) - Complete state.yml schema, phase transitions, write patterns, SessionStart hook, context injection strategy. Lines 183-368.
- **CONFIDENCE-AUDIT.md** (`.planning/research/arc-implementation/design/CONFIDENCE-AUDIT.md`) - Confidence ratings for state management decisions: flat YAML (ROCK SOLID), complete-file rewrite (ROCK SOLID), granular phase naming (HIGH), under 100 lines (HIGH), context fallback (HIGH).
- **plugin-dev hook-development SKILL.md** (`~/.claude/plugins/cache/claude-plugins-official/plugin-dev/55b58ec6e564/skills/hook-development/SKILL.md`) - Definitive hooks.json format for plugins: `{"hooks": {"SessionStart": [...]}}` wrapper with `type: "command"`, `command`, `timeout` fields.
- **plugin-dev plugin-features-reference.md** (`~/.claude/plugins/cache/claude-plugins-official/plugin-dev/55b58ec6e564/skills/command-development/references/plugin-features-reference.md`) - `!command` syntax for dynamic context injection in SKILL.md and command files.

### Secondary (MEDIUM confidence)
- **GSD state.cjs** (`~/.claude/get-shit-done/bin/lib/state.cjs`) - Reference implementation of state management in a similar tool. Uses Markdown with YAML frontmatter (different pattern from Expedite's pure YAML). Confirms complete-file-rewrite pattern and field-extraction approach.
- **plugin-dev hook patterns** (`~/.claude/plugins/cache/claude-plugins-official/plugin-dev/55b58ec6e564/skills/hook-development/references/patterns.md`) - SessionStart hook patterns with `$CLAUDE_PROJECT_DIR` and `$CLAUDE_ENV_FILE` usage.

### Tertiary (LOW confidence)
- None. All findings verified against multiple primary sources.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All components are documented platform features or standard Unix utilities. No libraries, no dependencies.
- Architecture: HIGH - State schema is fully specified in PRODUCT-DESIGN.md and rated ROCK SOLID/HIGH by independent confidence audit. Phase transitions are enumerated. Context injection syntax is documented.
- Pitfalls: HIGH - All pitfalls derived from CONFIDENCE-AUDIT.md scaling analysis, known platform bugs (numbered), and Phase 1 experience with arc-to-expedite renaming.

**Research date:** 2026-02-28
**Valid until:** 2026-03-28 (stable domain -- state management patterns and plugin conventions unlikely to change)
