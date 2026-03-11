# Phase 16: Status Improvements - Research

**Researched:** 2026-03-10
**Domain:** Status skill diagnostics (SKILL.md orchestrator, YAML state parsing, filesystem artifact checking)
**Confidence:** HIGH

## Summary

Phase 16 adds two diagnostic capabilities to the status skill and reinforces its read-only constraint. The status skill (`skills/status/SKILL.md`) is currently 121 lines with 8 numbered instructions. It uses `!cat` injection to load `state.yml` and presents a formatted lifecycle overview. The skill already handles `current_step` display (added in Phase 15 via STEP-09).

The two new features are: (1) a log.yml file size check with a 50KB threshold warning, and (2) artifact cross-referencing that compares expected artifacts against the current `phase` in state.yml and reports inconsistencies. Both features are purely additive -- they add new numbered steps to the existing SKILL.md without modifying existing logic. The read-only constraint (STAT-03) is already enforced by the skill's `allowed-tools` list (Read, Glob, Bash -- no Write) and its explicit Step 8 instruction. The new steps must maintain this guarantee.

**Primary recommendation:** Add two new steps to status SKILL.md between the current step-display logic (Step 3) and phase mapping (Step 4). Use `Bash` with `wc -c` for file size checking and `Read`/`Glob` for artifact existence checks. Keep all logic within the single SKILL.md file -- no references directory needed.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| STAT-01 | Status skill warns when log.yml exceeds 50KB | File size check using Bash `wc -c` on `.expedite/log.yml`; 50KB = 51200 bytes threshold; warning added to output format |
| STAT-02 | Status skill cross-references artifact existence against state.yml phase and flags inconsistencies | Phase-to-artifact mapping table; Glob/Read existence checks for SCOPE.md, SYNTHESIS.md, DESIGN.md, PLAN.md; inconsistency reporting format |
| STAT-03 | Status skill remains read-only -- reports discrepancies but never writes state.yml | Already enforced by allowed-tools (no Write tool); new steps must use only Read, Glob, Bash for checks; explicit "do NOT modify" instruction reinforced |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| SKILL.md orchestrator | N/A | Status skill instruction set | Claude Code plugin convention -- all skill logic in SKILL.md |
| Bash (allowed tool) | N/A | File size measurement via `wc -c` | Only reliable way to get byte-level file size from SKILL.md |
| Read (allowed tool) | N/A | Artifact existence checking | Can attempt to read files; errors indicate absence |
| Glob (allowed tool) | N/A | Artifact path discovery | Pattern matching for artifact files |

### Supporting
No additional libraries needed. Everything uses existing allowed tools.

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Bash `wc -c` for size | Bash `stat -f%z` (macOS) / `stat -c%s` (Linux) | `wc -c` is cross-platform; `stat` flags differ between macOS/Linux |
| Glob for artifact check | Bash `test -f` | Both work; Glob is the idiomatic Claude Code tool for file existence |

## Architecture Patterns

### Current Status SKILL.md Structure
```
skills/status/SKILL.md (121 lines)
  Frontmatter (name, description, allowed-tools)
  !cat injection of state.yml
  Step 1: Check for active lifecycle
  Step 2: Parse state fields
  Step 3: Parse current_step (Phase 15 addition)
  Step 4: Map phase to human-readable description
  Step 5: Determine next action
  Step 6: Count question statuses
  Step 7: Display formatted output
  Step 8: Do NOT modify any files (read-only guard)
```

### Modified Structure (after Phase 16)
```
skills/status/SKILL.md (~185 lines estimated)
  Frontmatter (unchanged)
  !cat injection (unchanged)
  Step 1: Check for active lifecycle (unchanged)
  Step 2: Parse state fields (unchanged)
  Step 3: Parse current_step (unchanged)
  Step 4: Log size check (NEW - STAT-01)
  Step 5: Artifact cross-reference (NEW - STAT-02)
  Step 6: Map phase to human-readable description (renumbered from 4)
  Step 7: Determine next action (renumbered from 5)
  Step 8: Count question statuses (renumbered from 6)
  Step 9: Display formatted output (renumbered from 7, with new sections)
  Step 10: Do NOT modify any files (renumbered from 8, STAT-03 reinforced)
```

### Pattern: Phase-to-Expected-Artifacts Mapping

The core logic for STAT-02. Each phase implies which artifacts SHOULD exist:

| Phase Value | Expected Artifacts |
|-------------|-------------------|
| `scope_in_progress` | (none required yet) |
| `scope_complete` | `.expedite/scope/SCOPE.md` |
| `research_in_progress` | `.expedite/scope/SCOPE.md` |
| `research_complete` | `.expedite/scope/SCOPE.md`, `.expedite/research/SYNTHESIS.md` |
| `design_in_progress` | `.expedite/scope/SCOPE.md`, `.expedite/research/SYNTHESIS.md` |
| `design_complete` | `.expedite/scope/SCOPE.md`, `.expedite/research/SYNTHESIS.md`, `.expedite/design/DESIGN.md` |
| `plan_in_progress` | `.expedite/scope/SCOPE.md`, `.expedite/research/SYNTHESIS.md`, `.expedite/design/DESIGN.md` |
| `plan_complete` | `.expedite/scope/SCOPE.md`, `.expedite/research/SYNTHESIS.md`, `.expedite/design/DESIGN.md`, `.expedite/plan/PLAN.md` |
| `execute_in_progress` | `.expedite/scope/SCOPE.md`, `.expedite/research/SYNTHESIS.md`, `.expedite/design/DESIGN.md`, `.expedite/plan/PLAN.md` |
| `complete` | `.expedite/scope/SCOPE.md`, `.expedite/research/SYNTHESIS.md`, `.expedite/design/DESIGN.md`, `.expedite/plan/PLAN.md` |
| `archived` | (skip check -- artifacts moved to archive/) |

**Key insight:** The mapping is cumulative. Each later phase adds to the prior phase's expected artifacts. `scope_in_progress` expects nothing (artifacts are being created). Once a phase is `*_complete` or later, its artifact SHOULD exist.

### Pattern: Inconsistency Reporting

Two categories of inconsistencies:

1. **Missing artifact:** "State says `design_complete` but `.expedite/design/DESIGN.md` not found"
2. **Unexpected state:** This is NOT in scope -- we do not check for artifacts that exist ahead of the current phase. Extra artifacts are harmless (e.g., from a prior lifecycle run).

Only category 1 matters for STAT-02. Report as warnings, never errors, since the status skill cannot and should not fix them.

### Anti-Patterns to Avoid
- **Writing state.yml from status skill:** The allowed-tools list deliberately excludes Write. New steps must not attempt state modification even for "fixing" inconsistencies.
- **Blocking on missing log.yml:** log.yml may not exist yet (fresh lifecycle). Handle gracefully -- no warning if file absent.
- **Checking artifact CONTENT quality:** STAT-02 checks existence only, not whether DESIGN.md is well-formed. Content quality is the gates' job.
- **Hardcoding paths without using the .expedite/ prefix:** All artifact paths are relative to `.expedite/` -- the lifecycle directory.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| File size measurement | Custom byte counting | Bash `wc -c .expedite/log.yml` | Cross-platform, reliable, handles missing file with error |
| File existence check | Complex Bash scripts | Glob pattern or Read with error handling | Claude Code tools handle errors gracefully |

**Key insight:** Both new features are simple filesystem checks. No complex logic, no state management, no external dependencies. The implementation is straightforward SKILL.md instruction additions.

## Common Pitfalls

### Pitfall 1: log.yml Not Existing
**What goes wrong:** Checking size of a file that does not exist causes an error
**Why it happens:** log.yml is created on first event (phase transition), not on lifecycle init. A lifecycle that was just initialized but has not had any events will not have log.yml.
**How to avoid:** Check existence first. If `.expedite/log.yml` does not exist, skip the size check entirely (no warning needed -- file does not exist).
**Warning signs:** Error output when running status on a fresh lifecycle

### Pitfall 2: Renumbering Breaks Existing Steps
**What goes wrong:** Inserting new steps in the middle changes step numbers, potentially confusing the LLM executing the skill
**Why it happens:** Steps 4-8 become Steps 6-10 after inserting two new steps
**How to avoid:** Renumber cleanly and update all internal step references. The output format template (Step 7 becomes Step 9) must be updated to include the new diagnostic sections.
**Warning signs:** Step references in the instructions pointing to wrong step numbers

### Pitfall 3: Phase Mapping Incomplete
**What goes wrong:** Missing a phase value from the mapping table causes artifact checks to skip silently
**Why it happens:** The state.yml phase field has 11 possible values (including archived)
**How to avoid:** Include ALL phase values in the mapping. Use `archived` as a special case that skips the check entirely. Include a fallback for unrecognized phases.
**Warning signs:** No artifact checks running for certain phases

### Pitfall 4: Log Size Warning Displayed Incorrectly
**What goes wrong:** Warning appears in wrong section of output or breaks the formatted display
**Why it happens:** The status skill has a specific output format (Step 7/9). New warnings must integrate cleanly.
**How to avoid:** Add a `## Diagnostics` section to the output format template, placed after Recovery Info. Warnings only appear if there are actual issues to report.
**Warning signs:** Messy or inconsistent status output

### Pitfall 5: Byte vs KB Confusion
**What goes wrong:** Using wrong units -- 50KB = 51200 bytes, not 50000
**Why it happens:** KB can mean 1000 (SI) or 1024 (binary)
**How to avoid:** Use 51200 bytes (50 * 1024) as the threshold. The requirement says "50KB" which in filesystem context conventionally means 50 * 1024 = 51200 bytes.
**Warning signs:** Warning triggering at wrong threshold

## Code Examples

### Log Size Check (Step 4 - NEW)
```markdown
### Step 4: Log Size Check

Check if `.expedite/log.yml` exists and exceeds 50KB (51200 bytes).

1. Run via Bash: `wc -c < .expedite/log.yml 2>/dev/null`
2. If the command fails (file does not exist), skip this step entirely.
3. If the byte count exceeds 51200, store a warning:
   "log.yml is {size_kb}KB — consider archiving the current lifecycle to reset it"
4. This warning will be displayed in the Diagnostics section of the output (Step 9).
```

### Artifact Cross-Reference (Step 5 - NEW)
```markdown
### Step 5: Artifact Cross-Reference

Cross-reference expected artifact files against the current phase from state.yml.

1. Read the `phase` value from the parsed state (Step 2).
2. Use this mapping to determine which artifacts SHOULD exist:
   - `scope_complete` and later: `.expedite/scope/SCOPE.md`
   - `research_complete` and later: `.expedite/research/SYNTHESIS.md`
   - `design_complete` and later: `.expedite/design/DESIGN.md`
   - `plan_complete` and later: `.expedite/plan/PLAN.md`
   - `scope_in_progress`: no artifacts expected yet
   - `archived`: skip check entirely (artifacts moved to archive/)

   "Later" means any phase that comes AFTER in the lifecycle sequence.
   The full phase ordering is:
   scope_in_progress < scope_complete < research_in_progress < research_complete < design_in_progress < design_complete < plan_in_progress < plan_complete < execute_in_progress < complete

3. For each expected artifact, check existence using Glob or Read.
4. Collect any missing artifacts as inconsistencies:
   - Format: "State says {phase} but {artifact_path} not found"
5. These inconsistencies will be displayed in the Diagnostics section (Step 9).
6. If phase is `scope_in_progress` or `archived`, or if no inconsistencies found, store nothing.

**Do NOT attempt to fix inconsistencies.** This is a read-only diagnostic.
```

### Output Format Addition (Diagnostics Section)
```markdown
## Diagnostics
{Only display this section if there are warnings or inconsistencies to report.
 If no issues found, omit this section entirely.}

**Warnings:**
- {log size warning, if applicable}

**Artifact Inconsistencies:**
- {inconsistency message, if applicable}
- {additional inconsistency messages}

(Status is read-only. Run the relevant skill to fix inconsistencies.)
```

### Read-Only Reinforcement (Step 10)
```markdown
### Step 10: Read-Only Constraint

Do NOT modify any files. This is a read-only skill. Do not write to state.yml,
log.yml, or any other file. If inconsistencies are found in Step 5, REPORT them
in the output — do not attempt to fix them.
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Status with basic lifecycle overview only | Status with step tracking display | Phase 15 (2026-03-10) | Users see current position within skills |
| No diagnostics in status | Log size + artifact cross-reference | Phase 16 (this phase) | Proactive issue detection |

**No deprecated patterns.** The status skill is being extended, not refactored.

## Open Questions

1. **Should the 50KB threshold be configurable?**
   - What we know: The requirement specifies 50KB as a fixed threshold
   - What's unclear: Whether different projects might want different thresholds
   - Recommendation: Hardcode 50KB per the requirement. Configuration can be added later if needed. Matches the project's pattern of hardcoding values (step counts in status skill, model tiers in frontmatter).

2. **Should HANDOFF.md be included in artifact cross-reference?**
   - What we know: HANDOFF.md is only produced for product-intent lifecycles (design Step 6). It is not yet officially supported (Phase 17).
   - What's unclear: Whether to include it now or wait for Phase 17
   - Recommendation: Do NOT include HANDOFF.md in the cross-reference for this phase. Phase 17 (HANDOFF.md Activation) is the proper place to add it. Including it now would create false warnings for engineering-intent lifecycles and for product-intent lifecycles before HANDOFF.md is officially validated.

3. **Phase ordering: "in_progress" phases and artifact expectations**
   - What we know: `research_in_progress` means research is underway but SYNTHESIS.md may not exist yet. The expectation should be based on what the PRIOR completed phase guarantees.
   - What's unclear: Should `research_in_progress` expect SCOPE.md? Yes -- scope_complete happened before research started.
   - Recommendation: `*_in_progress` phases expect artifacts from ALL prior completed phases. `research_in_progress` expects SCOPE.md (from scope_complete). `design_in_progress` expects SCOPE.md + SYNTHESIS.md. This is the correct interpretation since phase transitions are forward-only.

## Sources

### Primary (HIGH confidence)
- `skills/status/SKILL.md` -- Full current implementation read (121 lines, 8 steps)
- `templates/state.yml.template` -- All phase values and field schema
- `skills/scope/SKILL.md` -- Artifact output paths (SCOPE.md at `.expedite/scope/SCOPE.md`)
- `skills/research/SKILL.md` -- Artifact output paths (SYNTHESIS.md at `.expedite/research/SYNTHESIS.md`)
- `skills/design/SKILL.md` -- Artifact output paths (DESIGN.md at `.expedite/design/DESIGN.md`, HANDOFF.md at `.expedite/design/HANDOFF.md`)
- `skills/plan/SKILL.md` -- Artifact output paths (PLAN.md at `.expedite/plan/PLAN.md`)
- `templates/gitignore.template` -- log.yml is gitignored, persists across lifecycles
- `.planning/REQUIREMENTS.md` -- STAT-01, STAT-02, STAT-03 definitions

### Secondary (MEDIUM confidence)
- None needed -- all information from primary codebase sources

### Tertiary (LOW confidence)
- None

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All tools already available in status skill's allowed-tools list
- Architecture: HIGH - Additive changes to a well-understood 121-line file; clear phase-to-artifact mapping derived from reading all 6 skill files
- Pitfalls: HIGH - All pitfalls identified from direct code analysis (log.yml creation timing from scope skill Step 3, renumbering from current step structure, phase values from state.yml template)

**Research date:** 2026-03-10
**Valid until:** 2026-04-10 (stable -- the status skill and artifact conventions are unlikely to change)
