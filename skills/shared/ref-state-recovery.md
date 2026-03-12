# State Recovery Protocol

Read by any skill's Step 1 preamble when the `!cat .expedite/state.yml` injection returned "No active lifecycle" (state.yml file is missing).

---

## When to Use

This protocol is invoked when a skill detects that state.yml is missing. The injection at the top of every skill runs `cat .expedite/state.yml 2>/dev/null || echo "No active lifecycle"`. If the result is "No active lifecycle", the skill's Step 1 preamble checks for recovery artifacts before proceeding.

## Recovery Steps

### 1. Scan for Artifacts

Scan for lifecycle artifacts in **reverse lifecycle order** (first valid match wins):

1. `.expedite/plan/PLAN.md`
2. `.expedite/design/DESIGN.md`
3. `.expedite/research/SYNTHESIS.md`
4. `.expedite/scope/SCOPE.md`

Use the Read tool to attempt reading each file in this order. Stop at the first file that exists AND passes content validation (Step 2).

### 2. Content Validation

For each artifact found, validate that it is non-empty AND contains the expected header. If validation fails, skip it and check the next artifact in scan order.

| Artifact | Expected Header (first line) | Validation Rule |
|----------|------------------------------|-----------------|
| PLAN.md | `# Implementation Plan: ...` or `# Product Plan: ...` | First line contains "Plan:" |
| DESIGN.md | `# Technical Design: ...` or `# Product Design: ...` | First line contains "Design:" |
| SYNTHESIS.md | `# Research Synthesis` | First line is "# Research Synthesis" |
| SCOPE.md | `# Expedite Scope: ...` | First line contains "Expedite Scope:" |

A file that exists but is empty, or exists but does not contain the expected header, is treated as invalid. Move to the next artifact in the scan order.

### 3. If a Valid Artifact Is Found -- Reconstruct State

Perform these steps in order:

**a. Extract project_name from the artifact header** (see Project Name Extraction below).

**b. Map the artifact to a lifecycle phase:**

| Artifact | Inferred Phase |
|----------|---------------|
| PLAN.md | `plan_complete` |
| DESIGN.md | `design_complete` |
| SYNTHESIS.md | `research_complete` |
| SCOPE.md | `scope_complete` |

**Important:** Always infer `_complete` phases, never `_in_progress`. If a skill was in progress when state.yml was lost, the partial work may be incomplete. Setting `_complete` lets the user decide whether to re-run the skill.

**c. Extract intent if available (discretionary):**
- From SCOPE.md: look for a line matching `Intent: {product|engineering}` and extract the value.
- From SYNTHESIS.md: look for a line matching `Intent: {product|engineering}` and extract the value.
- From DESIGN.md or PLAN.md: intent is not directly available in the header. Set to null.

**d. Extract lifecycle_id if available (discretionary):**
- From SCOPE.md: look for a line matching `Lifecycle ID: {value}` and extract the value.
- From other artifacts: lifecycle_id is not reliably available. Set to null.

**e. Write minimal state.yml** using the Reconstructed state.yml Template below.

**f. Display inline notice:**
```
State recovered from artifacts (last phase: {phase})
```
Where `{phase}` is the inferred phase from step (b) (e.g., `design_complete`).

**g. Log recovery event** to `.expedite/log.yml` if the log file exists. Use the Recovery Event Logging format below. If `.expedite/log.yml` does not exist, skip logging silently.

### 4. If No Valid Artifact Found -- Unrecoverable

Display:
```
No recovery source found. Run /expedite:scope to start a new lifecycle.
```
Then **STOP**. Do not proceed with any skill steps.

---

## Reconstructed state.yml Template

Write this exact structure to `.expedite/state.yml`, filling in the placeholders:

```yaml
# Expedite Lifecycle State
# Machine-readable. Complete-rewrite on every update.
# WRITE PATTERN: (1) read current, (2) cp state.yml state.yml.bak, (3) modify in-memory, (4) write entire file
# RECOVERED: state reconstructed from artifacts on {ISO 8601 UTC timestamp}
version: "1"
last_modified: "{ISO 8601 UTC timestamp}"

# Lifecycle identity
project_name: "{extracted from artifact}"
intent: {extracted value or null}
lifecycle_id: {extracted value or null}
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

**Fields explanation:**
- `project_name`: Extracted from the artifact header (see Project Name Extraction).
- `intent`: Extracted from SCOPE.md or SYNTHESIS.md when available, otherwise null.
- `lifecycle_id`: Extracted from SCOPE.md when available, otherwise null.
- `phase`: The inferred `_complete` phase from the artifact-to-phase mapping.
- `research_round`: Defaults to 0. Not reconstructed. Safe because the research skill checks artifact existence, not round number, to determine resume point.
- `questions`, `gate_history`, `tasks`: Empty arrays. Not reconstructed. Skills re-read artifacts as needed (SCOPE.md for questions, PLAN.md for tasks).

---

## Project Name Extraction

Extract the project name from the first valid artifact found during the scan:

| Artifact | Header Pattern | Extraction Rule |
|----------|---------------|-----------------|
| PLAN.md | `# Implementation Plan: {name}` or `# Product Plan: {name}` | Text after `: ` on line 1 |
| DESIGN.md | `# Technical Design: {name}` or `# Product Design: {name}` | Text after `: ` on line 1 |
| SYNTHESIS.md | `Project: {name}` (line 2) | Text after `Project: ` on line 2 |
| SCOPE.md | `# Expedite Scope: {name}` | Text after `Scope: ` on line 1 |

If extraction fails (unexpected format), use `"Unknown Project"` as the fallback project name.

---

## Recovery Event Logging

If `.expedite/log.yml` exists, append this entry:

```yaml
---
event: state_recovery
timestamp: "{ISO 8601 UTC}"
lifecycle_id: null
recovery_source: "{PLAN.md | DESIGN.md | SYNTHESIS.md | SCOPE.md}"
recovered_phase: "{inferred phase}"
recovered_project_name: "{extracted name}"
```

If `.expedite/log.yml` does not exist, skip logging. Do not create the log file.

---

## Post-Recovery Instructions

After writing state.yml and displaying the notice:

1. **Re-read** `.expedite/state.yml` to get the recovered state values.
2. **Use the recovered values** (not the original "No active lifecycle" injection) for all subsequent routing decisions in the skill's Step 1 case logic.
3. The skill proceeds normally from this point -- no user confirmation required.
