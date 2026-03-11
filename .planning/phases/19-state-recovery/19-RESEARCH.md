# Phase 19: State Recovery - Research

**Researched:** 2026-03-11
**Domain:** Expedite plugin state file recovery from artifacts when state.yml is missing
**Confidence:** HIGH

## Summary

Phase 19 implements a slim recovery path that detects when `.expedite/state.yml` is missing entirely and reconstructs minimal state from existing lifecycle artifacts (PLAN.md, DESIGN.md, SYNTHESIS.md, SCOPE.md). This is NOT a corruption-detection or backup system -- the user deliberately scoped this down from the original roadmap's .bak/sentinel design after evaluating that Claude Code's Write tool performs atomic writes (temp-file-then-rename) and skills read state as raw text, making corruption a non-issue in practice.

The implementation touches every skill's Step 1 preamble (7 skills total) but the actual recovery logic lives in a single centralized reference file. The existing architecture already has a proven pattern for this: centralized references invoked by per-skill preambles (see `ref-gapfill-dispatch.md`, `ref-override-handling.md`). The recovery itself is straightforward: scan artifacts in reverse lifecycle order, infer the phase from the latest artifact found, extract project_name from the artifact header, write a minimal state.yml, and let the skill proceed.

**Primary recommendation:** Create `skills/shared/ref-state-recovery.md` with the recovery protocol, add a 5-line preamble to each skill's Step 1 that invokes it when the `!cat` injection returns "No active lifecycle" despite artifacts existing.

<user_constraints>

## User Constraints (from CONTEXT.md)

### Locked Decisions

**Recovery trigger:**
- Recovery activates only when state.yml is missing entirely (not on malformed/corrupted content -- that scenario doesn't realistically occur)
- Checked on any skill invocation that reads state

**Artifact reconstruction:**
- Scan artifacts in reverse order: PLAN.md -> DESIGN.md -> SYNTHESIS.md -> SCOPE.md
- Latest artifact wins -- first file found determines the inferred lifecycle phase
- Basic content check on each artifact: file must be non-empty and contain expected headers (not just existence check)
- Reconstructed state contains minimum fields to resume: lifecycle_phase + project_name only
- No step tracking reconstruction -- completed skills already have their artifacts, the router just needs to know which skill comes next

**Recovery messaging:**
- Inline notice with phase only: "State recovered from artifacts (last phase: design_complete)"
- Same format regardless of which artifact was the recovery source
- Skill proceeds normally after the notice -- no user confirmation required

**Unrecoverable state:**
- When no state.yml AND no artifacts exist: "No recovery source found. Run /expedite:scope to start a new lifecycle."
- Direct the user to start fresh -- no manual repair guidance

### Claude's Discretion

- Where in the skill loading flow to perform the missing-state check
- How to extract project_name from artifacts
- Whether to log recovery events beyond the inline notice

### Deferred Ideas (OUT OF SCOPE)

None -- discussion stayed within phase scope

**Explicitly out of scope (from CONTEXT.md phase boundary):** .bak files, sentinel fields, backup rotation, schema validation, write-corruption detection.

</user_constraints>

<phase_requirements>

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| RESL-01 | User's corrupted state.yml is automatically detected and recovered from .bak on any skill invocation | CONTEXT.md redefines: recovery triggers on MISSING state.yml only (not corruption). Recovery from artifacts, not .bak. Covered by artifact reconstruction logic. |
| RESL-02 | User sees a warning message identifying what was recovered and the last known phase after auto-recovery | Covered by inline notice: "State recovered from artifacts (last phase: {phase})" |
| RESL-03 | User's state is reconstructed from artifacts (SCOPE.md, SYNTHESIS.md, DESIGN.md, PLAN.md) when both state.yml and .bak are corrupted | CONTEXT.md redefines: artifact reconstruction is the PRIMARY (and only) recovery path. Scan reverse order PLAN.md -> DESIGN.md -> SYNTHESIS.md -> SCOPE.md. |
| RESL-04 | User sees an unrecoverable error with clear instructions when no recovery source exists | Covered by: "No recovery source found. Run /expedite:scope to start a new lifecycle." |
| RESL-05 | Every state file write includes a `_write_complete` sentinel as the last field, and reads validate its presence | CONTEXT.md explicitly defers: sentinel fields are OUT OF SCOPE. Write atomicity handled by Claude Code platform. |

</phase_requirements>

## Standard Stack

### Core

This phase modifies existing Markdown skill files and creates one new reference file. No new libraries or tools.

| Component | Type | Purpose | Why Standard |
|-----------|------|---------|--------------|
| SKILL.md (x7) | Existing | Step 1 preamble modification in every skill | All skills share the `!cat` injection + Step 1 prerequisite pattern |
| `skills/shared/ref-state-recovery.md` | New reference | Centralized recovery protocol | Matches proven pattern from `ref-gapfill-dispatch.md`, `ref-override-handling.md` |
| `templates/state.yml.template` | Reference | State schema for reconstructed file | Recovery writes a minimal state.yml using the same schema |

### Supporting

| Component | Type | Purpose | When to Use |
|-----------|------|---------|-------------|
| `skills/status/SKILL.md` | Existing | Recovery Info section already shows backup info | Update to reflect new recovery model (no .bak) |
| `.expedite/log.yml` | Existing | Telemetry logging | Log recovery events (Claude's discretion -- recommended) |

## Architecture Patterns

### Recommended Project Structure

```
skills/
  shared/                        # NEW: cross-cutting references
    ref-state-recovery.md        # Recovery protocol
  scope/SKILL.md                 # Step 1 preamble gains recovery hook
  research/SKILL.md              # Step 1 preamble gains recovery hook
  design/SKILL.md                # Step 1 preamble gains recovery hook
  plan/SKILL.md                  # Step 1 preamble gains recovery hook
  spike/SKILL.md                 # Step 1 preamble gains recovery hook
  execute/SKILL.md               # Step 1 preamble gains recovery hook
  status/SKILL.md                # Step 1 gains recovery hook + display update
```

### Pattern 1: Centralized Reference with Per-Skill Invocation

**What:** Recovery logic lives in `skills/shared/ref-state-recovery.md`. Each skill's Step 1 adds a 5-line preamble that invokes it.

**When to use:** Always -- this is the established pattern for cross-cutting concerns in this codebase.

**Example (Step 1 preamble addition for non-scope skills):**

```markdown
### Step 1 Preamble: State Recovery

Look at the injected lifecycle state above.

If the injection returned "No active lifecycle" (state.yml is missing), check whether
recovery artifacts exist by following the protocol in `skills/shared/ref-state-recovery.md`.
- If recovery succeeds: proceed with the recovered state (the protocol writes state.yml)
- If recovery fails (no artifacts): display "No recovery source found. Run /expedite:scope
  to start a new lifecycle." Then STOP.
```

**Confidence: HIGH.** Directly mirrors `ref-gapfill-dispatch.md` and `ref-override-handling.md` patterns.

### Pattern 2: Artifact-to-Phase Mapping (Recovery Logic)

**What:** Map artifact existence to lifecycle phase for reconstruction.

**When to use:** Inside `ref-state-recovery.md` when determining which phase to reconstruct.

**Mapping (scan in this order -- first match wins):**

| Artifact Path | Inferred Phase | Rationale |
|--------------|----------------|-----------|
| `.expedite/plan/PLAN.md` | `plan_complete` | Plan exists = plan skill completed successfully |
| `.expedite/design/DESIGN.md` | `design_complete` | Design exists = design skill completed |
| `.expedite/research/SYNTHESIS.md` | `research_complete` | Synthesis exists = research completed |
| `.expedite/scope/SCOPE.md` | `scope_complete` | Scope exists = scope completed |
| None found | Unrecoverable | No artifacts to reconstruct from |

**Note on `_in_progress` phases:** Recovery always infers `_complete` phases, not `_in_progress`. Rationale: if a skill was in progress when state.yml was lost, the partial work may be incomplete. Setting `_complete` lets the user decide whether to re-run the skill (which has its own resume logic for `_complete` -> `_in_progress` transitions). The skill's Step 1 Case routing handles the `_complete` state correctly in all cases.

**Important exception:** `execute_in_progress` and `complete` cannot be inferred from artifacts alone because the execute skill uses checkpoint files, not a single artifact. If PLAN.md exists, we infer `plan_complete` -- the user can then re-enter execute normally.

### Pattern 3: Project Name Extraction from Artifact Headers

**What:** Extract `project_name` from the first artifact found during recovery.

**When to use:** Inside `ref-state-recovery.md` after identifying the recovery artifact.

**Header patterns per artifact:**

| Artifact | Header Pattern | Extraction |
|----------|---------------|------------|
| PLAN.md | `# {Implementation Plan \| Product Plan}: {project_name}` | Text after `: ` on line 1 |
| DESIGN.md | `# {Technical Design \| Product Design}: {project_name}` | Text after `: ` on line 1 |
| SYNTHESIS.md | `Project: {project_name}` (line 2) | Text after `Project: ` on line 2 |
| SCOPE.md | `# Expedite Scope: {project_name}` | Text after `Scope: ` on line 1 |

**Content validation (from CONTEXT.md):** Each artifact must be non-empty AND contain expected headers. Specifically:
- PLAN.md: contains `# ` heading with `Plan:` in it
- DESIGN.md: contains `# ` heading with `Design:` in it
- SYNTHESIS.md: contains `# Research Synthesis` heading
- SCOPE.md: contains `# Expedite Scope:` heading

If a file exists but fails content validation, skip it and check the next artifact in the scan order. This handles edge cases like empty files or partially written artifacts from a crash during write.

### Pattern 4: Minimal State Reconstruction

**What:** Write a state.yml with only the fields needed for the skill router to work.

**Example reconstructed state.yml:**

```yaml
# Expedite Lifecycle State
# Machine-readable. Complete-rewrite on every update.
# WRITE PATTERN: (1) read current, (2) cp state.yml state.yml.bak, (3) modify in-memory, (4) write entire file
# RECOVERED: state reconstructed from artifacts on {ISO 8601 timestamp}
version: "1"
last_modified: "{ISO 8601 timestamp}"

# Lifecycle identity
project_name: "{extracted from artifact}"
intent: null
lifecycle_id: null
description: null

# Current position
phase: "{inferred phase}"
current_task: null
current_step: null

# Reserved for v2
imported_from: null
constraints: []

# Research tracking
research_round: 0

# Questions -- not reconstructed (SCOPE.md has the canonical copy)
questions: []

# Gate history -- not reconstructed
gate_history: []

# Execution state -- not reconstructed
tasks: []
current_wave: null
```

**Key decisions in this pattern:**
- `intent` is set to null: it CAN be extracted from SCOPE.md or SYNTHESIS.md (both contain `Intent: {product/engineering}`), but the CONTEXT.md says "minimum fields to resume: lifecycle_phase + project_name only". Intent extraction is discretionary -- recommend doing it since it is trivially available from the same artifacts and some skills use it for routing (design produces PRD vs RFC based on intent).
- `questions`, `gate_history`, `tasks` are empty: these arrays would require parsing complex nested YAML from multiple files. The CONTEXT.md explicitly says "No step tracking reconstruction." Skills that need questions can re-read SCOPE.md. Skills that need tasks can re-read PLAN.md.
- `research_round` defaults to 0: not reconstructed. This is safe because the research skill's resume logic checks artifact existence, not round number, to determine resume point.

### Anti-Patterns to Avoid

- **Attempting to reconstruct the full state.yml from artifacts:** The whole point of the simplified design is that most state fields are derivable from artifacts at runtime. Only `phase` and `project_name` are needed for the router.
- **Adding recovery logic inline to all 7 skills:** Copy-paste across 7 files creates maintenance burden. Use the centralized reference pattern.
- **Making recovery interactive (asking user to confirm):** CONTEXT.md explicitly says "Skill proceeds normally after the notice -- no user confirmation required."
- **Checking for corruption/malformed YAML:** CONTEXT.md explicitly scopes this out. Only check for MISSING state.yml.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| YAML parsing/validation | Custom YAML parser in Markdown | Claude's native YAML understanding | Skills read state as raw text -- Claude naturally handles YAML. No programmatic parsing needed. |
| Backup/restore system | .bak rotation, sentinel fields | Artifact reconstruction | CONTEXT.md explicitly defers .bak files. Artifacts are the truth source. |
| Atomic writes | Write-ahead log, temp files | Claude Code's Write tool | Platform already handles atomicity (temp-file-then-rename). |
| State schema migration | Migration tooling | Complete-rewrite semantics | Each state write is a complete file rewrite. Schema changes apply on first write. |

**Key insight:** This is a Claude Code plugin where "code" is Markdown instructions for an LLM. Recovery logic is prose instructions, not programmatic code. The "implementation" is natural language instructions that tell Claude how to check for missing state and reconstruct it.

## Common Pitfalls

### Pitfall 1: Scope Skill Has Different Recovery Semantics

**What goes wrong:** Applying the same recovery preamble to scope that you apply to other skills. Scope is the ONLY skill where "No active lifecycle" is a VALID starting state (user wants to create a new lifecycle). For all other skills, "No active lifecycle" means either recovery or error.

**Why it happens:** All 7 skills share the same `!cat .expedite/state.yml 2>/dev/null || echo "No active lifecycle"` injection pattern, but scope's Case A is "proceed to Step 3" (initialize new lifecycle) while every other skill's Case C is "error: run scope first."

**How to avoid:** The recovery preamble for scope must be different:
- If "No active lifecycle" AND artifacts exist: recover state, THEN fall through to scope's existing Case C logic (which asks about archiving an existing lifecycle)
- If "No active lifecycle" AND no artifacts: skip recovery, let scope proceed to Case A (fresh start)

For all other skills:
- If "No active lifecycle" AND artifacts exist: recover state, THEN re-evaluate the injected state against the skill's Case A/B/C routing
- If "No active lifecycle" AND no artifacts: display unrecoverable error, STOP

**Warning signs:** Scope skill entering an infinite loop (recovers state, then immediately tries to archive it, then starts fresh, which clears state again).

### Pitfall 2: Recovery Writes State But Skill Already Read "No active lifecycle"

**What goes wrong:** The `!cat` injection happens at skill load time (before any instructions run). Recovery writes state.yml, but the injected context in the skill's prompt still says "No active lifecycle." The skill's Step 1 routing then uses the stale injected value.

**Why it happens:** The `!cat` injection is evaluated once when the skill loads. Claude reads the Markdown instructions including the injected text. If recovery writes state.yml during Step 1, the injected text at the top of the prompt is still "No active lifecycle."

**How to avoid:** After recovery writes state.yml, the recovery protocol must explicitly instruct: "Re-read `.expedite/state.yml` to get the recovered state values. Use these values (not the original injection) for all subsequent routing decisions." This is critical -- the preamble must override the stale injection.

**Warning signs:** Skills displaying "Error: Scope is not complete" immediately after supposedly successful recovery.

### Pitfall 3: Artifact Exists But Is From a Different Lifecycle

**What goes wrong:** User archived a lifecycle, started a new one, state.yml gets lost. Recovery finds SCOPE.md from the archived lifecycle... except archival moves files to `.expedite/archive/{slug}/`. BUT: what if the user partially completed scope for a NEW lifecycle (wrote SCOPE.md) and then state.yml was lost? The artifacts in `.expedite/scope/SCOPE.md` are from the current lifecycle -- this is fine.

**Why it happens:** Archival moves artifacts to `archive/` -- only current-lifecycle artifacts remain in the standard paths. This is actually handled correctly by the existing design.

**How to avoid:** Only scan the standard artifact paths (`.expedite/scope/SCOPE.md`, `.expedite/research/SYNTHESIS.md`, etc.). NEVER scan `archive/`. This is the correct behavior and is implicitly handled by the artifact paths.

### Pitfall 4: Recovery During State Splitting (Phase 21 Forward Compatibility)

**What goes wrong:** Phase 21 (State Splitting) will change state.yml to a minimal tracking file and move questions/tasks/gates to separate files. Recovery must still work after splitting.

**Why it happens:** ARCH-06 explicitly requires "State recovery works correctly with the split file layout."

**How to avoid:** Design recovery to reconstruct ONLY `state.yml` (the tracking file). This is already the plan since CONTEXT.md says "minimum fields: lifecycle_phase + project_name." The reconstructed state.yml already matches what the post-splitting tracking file will look like (~15 lines of routing data). No questions/tasks/gates are reconstructed, so splitting does not affect recovery logic.

**Warning signs:** None in Phase 19 -- but Phase 21 must verify ARCH-06 against the recovery protocol.

## Code Examples

### Example 1: Recovery Reference File Structure

```markdown
# State Recovery Protocol

## When to Use

This protocol is invoked by a skill's Step 1 preamble when `!cat .expedite/state.yml`
returns "No active lifecycle" (file missing).

## Recovery Steps

1. **Scan for artifacts** in reverse lifecycle order:
   - Read `.expedite/plan/PLAN.md`
   - Read `.expedite/design/DESIGN.md`
   - Read `.expedite/research/SYNTHESIS.md`
   - Read `.expedite/scope/SCOPE.md`

2. **For the first file that exists**, validate content:
   - File must be non-empty
   - File must contain expected header:
     - PLAN.md: first line contains "Plan:" (e.g., "# Implementation Plan: ...")
     - DESIGN.md: first line contains "Design:" (e.g., "# Technical Design: ...")
     - SYNTHESIS.md: first line is "# Research Synthesis"
     - SCOPE.md: first line contains "Expedite Scope:" (e.g., "# Expedite Scope: ...")

3. **If a valid artifact is found:**
   a. Extract project_name from the artifact header
   b. Map artifact to phase:
      - PLAN.md -> "plan_complete"
      - DESIGN.md -> "design_complete"
      - SYNTHESIS.md -> "research_complete"
      - SCOPE.md -> "scope_complete"
   c. Write minimal state.yml (see template below)
   d. Display: "State recovered from artifacts (last phase: {phase})"
   e. Log to .expedite/log.yml (if it exists)

4. **If no valid artifact found:**
   - Display: "No recovery source found. Run /expedite:scope to start a new lifecycle."
   - STOP.

## Reconstructed state.yml Template
[... minimal template as documented above ...]
```

### Example 2: Step 1 Preamble for Non-Scope Skills

```markdown
### Step 1: Prerequisite Check

**Step 1 Preamble: State Recovery**

Look at the injected lifecycle state above.

If the injection returned "No active lifecycle" (state.yml is missing), attempt recovery:
1. Follow the recovery protocol in `skills/shared/ref-state-recovery.md` (use Glob
   with `**/ref-state-recovery.md` if direct path fails).
2. If recovery succeeds: Read the newly written `.expedite/state.yml` and use its
   values for all routing below (ignore the original "No active lifecycle" injection).
3. If recovery fails (no artifacts): display "No recovery source found. Run
   /expedite:scope to start a new lifecycle." Then STOP.

**Step tracking:** [... existing step tracking instructions ...]
```

### Example 3: Step 1 Preamble for Scope Skill (Different Behavior)

```markdown
### Step 1: Lifecycle Check

**Step 1 Preamble: State Recovery**

Look at the injected lifecycle state above.

If the injection returned "No active lifecycle" (state.yml is missing), check for artifacts:
1. Follow the artifact scan in `skills/shared/ref-state-recovery.md`.
2. If recovery succeeds (artifacts found): Read the newly written `.expedite/state.yml`.
   The recovered state has a phase like "scope_complete" or later -- fall through to
   **Case C** below (active lifecycle exists with phase != scope_in_progress).
3. If no artifacts found: This is a genuine fresh start. Proceed to **Case A** below.

[... existing Case A, B, C logic unchanged ...]
```

### Example 4: Recovery Event Logging

```yaml
---
event: state_recovery
timestamp: "{ISO 8601 UTC}"
lifecycle_id: null
recovery_source: "{PLAN.md | DESIGN.md | SYNTHESIS.md | SCOPE.md}"
recovered_phase: "{inferred phase}"
recovered_project_name: "{extracted name}"
```

## State of the Art

| Old Approach (original roadmap) | Current Approach (CONTEXT.md) | When Changed | Impact |
|--------------------------------|-------------------------------|--------------|--------|
| .bak file fallback on corruption | Artifact reconstruction on missing file | 2026-03-11 (discuss-phase) | Eliminates .bak dependency, sentinel fields, corruption detection |
| `_write_complete` sentinel field | No sentinel | 2026-03-11 (discuss-phase) | Eliminates read-time validation overhead |
| Multi-tier recovery (.bak first, then artifacts) | Single-tier (artifacts only) | 2026-03-11 (discuss-phase) | Simpler logic, single recovery path |
| Full state reconstruction | Minimal reconstruction (phase + project_name) | 2026-03-11 (discuss-phase) | Skills re-read artifacts as needed rather than depending on state.yml |

**Deprecated/outdated from original roadmap:**
- RESL-01's ".bak" recovery path: replaced by artifact reconstruction
- RESL-05's sentinel field: explicitly out of scope
- Success criteria 1 and 5 from roadmap: superseded by CONTEXT.md decisions

## Open Questions

1. **Should `intent` be extracted during recovery?**
   - What we know: CONTEXT.md says "minimum fields: lifecycle_phase + project_name only." However, `intent` is trivially available from SCOPE.md (`Intent: {product/engineering}`) and SYNTHESIS.md (`Intent: {intent}`). The design skill uses intent to produce PRD vs RFC format, and the plan skill uses it for Epics vs Waves.
   - What's unclear: Whether "minimum fields" is a hard constraint or just saying "don't try to reconstruct everything."
   - Recommendation: Extract `intent` when available from the same artifact that provides project_name. It costs nothing extra and prevents skills from breaking when they expect intent to be non-null. Flag this as a discretion area in the plan.

2. **Should recovery attempt to extract `lifecycle_id` too?**
   - What we know: `lifecycle_id` is `{project_name_slugified}-{YYYYMMDD}`. SCOPE.md contains `Lifecycle ID: {lifecycle_id}`. Other artifacts reference it.
   - What's unclear: Whether skills break without it. It is used for log.yml entries and archival slug generation.
   - Recommendation: Extract if present in the recovery artifact (SCOPE.md always has it). Low effort, prevents downstream issues.

3. **How should status skill display recovery information after this change?**
   - What we know: Status skill currently shows "Backup: .expedite/state.yml.bak" in Recovery Info section. With .bak out of scope, this section needs updating.
   - Recommendation: Change Recovery Info to show "Recovery: artifact-based (PLAN.md > DESIGN.md > SYNTHESIS.md > SCOPE.md)" or simply remove the .bak reference.

## Sources

### Primary (HIGH confidence)

All findings derive from direct codebase analysis of the existing plugin:
- `skills/*/SKILL.md` -- all 7 skill files, analyzed for Step 1 patterns, `!cat` injection, and phase routing
- `templates/state.yml.template` -- state schema definition
- `skills/research/references/prompt-research-synthesizer.md` -- SYNTHESIS.md header format
- `skills/scope/SKILL.md` lines 538-590 -- SCOPE.md header format
- `skills/design/SKILL.md` lines 279-283 -- DESIGN.md header format
- `skills/plan/SKILL.md` lines 296-300 -- PLAN.md header format
- `skills/status/SKILL.md` lines 57-77 -- artifact cross-reference mapping (reused for recovery)
- `.planning/phases/19-state-recovery/19-CONTEXT.md` -- user decisions constraining scope
- `.planning/research/ARCHITECTURE.md` -- v1.2 architecture patterns including state recovery design

### Secondary (MEDIUM confidence)

- `.planning/REQUIREMENTS.md` -- RESL-01 through RESL-05 formal requirements (note: CONTEXT.md redefines their implementation)
- `.planning/ROADMAP.md` -- original phase description with success criteria (superseded by CONTEXT.md)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- no new technology, modification of existing Markdown files using proven patterns
- Architecture: HIGH -- centralized reference pattern is established (3 existing references in research skill). Artifact-to-phase mapping reuses status skill's existing cross-reference logic.
- Pitfalls: HIGH -- identified from direct analysis of how `!cat` injection, Step 1 routing, and scope's unique semantics interact

**Research date:** 2026-03-11
**Valid until:** Stable -- this research covers existing codebase patterns that change only with explicit phase work (Phase 21 state splitting is the next relevant change)
