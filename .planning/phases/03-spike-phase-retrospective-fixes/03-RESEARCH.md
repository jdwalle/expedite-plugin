# Phase 3: Spike Phase Retrospective Fixes - Research

**Researched:** 2026-03-18
**Domain:** Gate script regex fixes, SKILL.md prompt engineering, spike skill control flow
**Confidence:** HIGH

## Summary

Phase 3 applies the same retrospective fix pattern established in Phases 1-2: gate scripts with regex/logic bugs that caused wasted recycle cycles during first real-world use, paired with SKILL.md formatting guidance to prevent recurrence. All three requirements target existing files with well-understood behavior, and the codebase already contains analogous fixes from Phase 2 that serve as exact templates.

The three fixes are independent of each other and touch different code regions. Requirement 1 (G5 heading fix) is a direct analog of Phase 2's G1 M6 fix -- same pattern, different gate. Requirements 2 and 3 are SKILL.md-only changes to the spike skill's control flow, adding conditional skip logic rather than modifying any gate script.

**Primary recommendation:** All three fixes can be executed in a single plan with 2 tasks (one for the gate script + SKILL.md formatting, one for the two SKILL.md control flow changes). Task separation follows the file boundary: g5-spike.js changes are coupled with SKILL.md Step 7 formatting guidance (same fix pattern as Phase 2), while the 0-TD fast path and semantic skip are both SKILL.md control flow additions.

## Standard Stack

### Core

No new libraries. All changes are to existing files using established patterns.

| File | Purpose | Phase 2 Analog |
|------|---------|----------------|
| `gates/g5-spike.js` | Structural gate for spike output | `gates/g1-scope.js` (M6 fix) |
| `skills/spike/SKILL.md` | Spike skill instructions | `skills/scope/SKILL.md` (Step 9 format guidance) |
| `gates/lib/gate-utils.js` | Shared gate utilities | No changes needed |

### Coding Style

ES5-compatible JavaScript (var, not const/let). This was an explicit decision from Phase 1 (STATE.md: "Keep ES5-compatible style in g2-structural.js to match existing codebase"). All gate scripts follow this convention.

## Architecture Patterns

### Pattern 1: Gate Regex Loosening (from Phase 2)

**What:** When a gate's heading regex is too strict, causing false recycle/hold on correctly-structured content.
**When:** Gate logic breaks on valid heading variants that Claude naturally produces.
**Fix pattern (two-part):**
1. Loosen the gate script's break/match condition to accept the heading variants Claude actually produces
2. Add explicit formatting guidance in the corresponding SKILL.md step that writes the artifact, specifying the exact heading format the gate expects

**Phase 2 example (G1 M6):** Primary regex preserved, fallback added. SKILL.md Step 9 got format spec `### DA-N: [Name] (Depth: [Deep|Standard|Light])`.

**Phase 3 application (G5 M4 `countImplementationSteps`):** The break condition on line 109 (`headingLevel[1].length <= 3`) exits when it encounters `### Step N:` headings. Change to `<= 2` so `###` and `####` headings within the implementation section are treated as step sub-headings, not section terminators. Add heading format guidance to SKILL.md Step 7.

### Pattern 2: Conditional Step Skipping in Skills

**What:** Adding conditional logic to skip skill steps when preconditions make them unnecessary.
**When:** A step's core purpose does not apply (e.g., "resolve tactical decisions" when there are no tactical decisions).
**Implementation:**
- Add a conditional check at the end of the preceding step
- Write checkpoint with skip-indicator substep
- Reference the skip in the step being skipped (defensive, in case someone reads linearly)

### Pattern 3: Conditional Gate Layer Skipping

**What:** Skipping the semantic gate-verifier layer when structural validation is sufficient.
**When:** Wave complexity is below a threshold where semantic verification adds proportional value.
**Implementation:**
- After structural gate passes, evaluate complexity heuristic
- If simple (0 TDs AND <= 2 tasks), use structural result directly
- Write gates.yml entry with distinct evaluator name to maintain audit trail
- Preserve the full dual-layer path for complex waves

### Anti-Patterns to Avoid

- **Modifying gate-utils.js for gate-specific logic:** Gate-utils provides generic helpers. Gate-specific break conditions stay in the gate script itself.
- **Removing the dual-layer gate entirely:** The semantic layer has value for complex spikes. The skip is conditional, not unconditional.
- **Changing Step numbering:** Steps 1-9 are referenced throughout the codebase (checkpoint writes, state transitions). Changing step numbers would require cascading updates. The fast path skips Step 5, it does not renumber steps.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Gate YAML writing | Custom YAML serialization | `gate-utils.appendGateResult()` | Already handles read-then-append, directory creation, proper serialization |
| Gate outcome computation | Manual pass/fail counting | `gate-utils.buildEntry()` | Computes outcome from MUST/SHOULD results consistently |

## Common Pitfalls

### Pitfall 1: Off-by-one in heading level comparison

**What goes wrong:** Changing `<= 3` to `< 3` instead of `<= 2` (same result but less clear), or changing to `<= 1` (too aggressive, would only break on `#` headings).
**Why it happens:** The heading level comparison is subtle. `#` = 1, `##` = 2, `###` = 3, `####` = 4.
**How to avoid:** The requirement is: break only on headings level 1 or 2 (document title and major sections). Steps at level 3 or 4 should be counted, not used as terminators. So the condition is `headingLevel[1].length <= 2`.
**Warning signs:** After the fix, `### Step 1: ...` inside the implementation section should NOT trigger the break, and `## Some Other Section` SHOULD trigger the break.

### Pitfall 2: Counting sub-bullets as steps

**What goes wrong:** The `countImplementationSteps` function at line 114 counts ALL bullets/numbered items in the implementation section, including sub-bullets of steps. If steps have nested lists, the count will be inflated.
**Why it matters:** M4 requires at least 3 steps. Over-counting is a false positive (passes when it should fail), which is less harmful than under-counting but still worth noting.
**How to avoid:** This is pre-existing behavior and not in scope for this phase. The heading level fix is the only change needed in `countImplementationSteps`. Do not refactor the bullet counting logic.

### Pitfall 3: SKILL.md Step 8 gates.yml entry format mismatch

**What goes wrong:** When skipping the semantic layer, writing a gates.yml entry that doesn't match the expected schema for semantic entries.
**Why it happens:** The structural gate already writes its own entry via `gate-utils.appendGateResult()`. The semantic entry is written by the skill (Step 8 in SKILL.md). If skipping semantic, no second entry should be written -- the structural entry is the final result.
**How to avoid:** The skip logic should NOT write a second gates.yml entry. The structural gate script already wrote one with `evaluator: "g5-structural-script"`. The skip note should be added to the display output, not to gates.yml. However, per the requirement: "Write the gates.yml entry with `evaluator: 'g5-structural-only'`" -- this means the skill SHOULD write a lightweight entry marking the semantic skip. Use the existing YAML write pattern from Step 8's semantic entry block, but with simplified fields.

### Pitfall 4: Step 4 TD extraction depends on PLAN.md format

**What goes wrong:** The 0-TD fast path check in Step 4 relies on correctly extracting tactical decisions from PLAN.md. If the extraction logic in Step 4 misidentifies TDs, the fast path triggers incorrectly.
**Why it matters:** False positive (skipping Step 5 when there ARE TDs) would produce a spike with unresolved decisions.
**How to avoid:** Step 4 already says "Classify TDs: resolved vs needs-spike. Display summary." The fast path should check after this classification: if the total TD count (resolved + needs-spike) is 0, then skip. The display summary provides a human-visible confirmation before the skip occurs.

## Code Examples

### Exact fix for `countImplementationSteps` break condition

```javascript
// File: gates/g5-spike.js, line 109
// CURRENT (buggy):
if (headingLevel && headingLevel[1].length <= 3) {
  break;
}

// FIXED:
if (headingLevel && headingLevel[1].length <= 2) {
  break;
}
```

This single-line change means:
- `# Title` (level 1): breaks (correct)
- `## Section` (level 2): breaks (correct)
- `### Step 1: ...` (level 3): does NOT break, continues scanning (fixed)
- `#### Sub-step` (level 4): does NOT break, continues scanning (already correct)

### SKILL.md Step 7 formatting guidance addition

Current Step 7 text (line 101-103):
```markdown
### Step 7: Write SPIKE.md

`mkdir -p .expedite/plan/phases/{slug}/`. Check for existing SPIKE.md (prompt overwrite). Write spike output: header (phase, TD counts, G5 status), TD resolutions (classification, resolution, rationale, method, evidence), implementation steps (traces-to, files, sub-steps). Verify file exists and has content.
```

Add after "implementation steps (traces-to, files, sub-steps)":
```
**Implementation steps heading format:** Use `#### Step N: [Title]` headings (level 4) for each implementation step. The G5 structural gate's `countImplementationSteps` function scans for bullets/numbered items under an "Implementation Steps" heading and exits when it hits a heading level <= 2. Using `###` or `####` for step headings keeps them within the scanned section. Using `##` would prematurely terminate the scan.
```

### Step 4 fast path addition

Add at the end of Step 4, after "Display summary.":
```
If this phase has 0 tactical decisions, write checkpoint with `substep: "no_tds_skipping_resolution"`, skip Step 5, and proceed directly to Step 6. The spike still adds value by reading the actual codebase and producing implementation steps with real file paths and line numbers.
```

### Step 8 semantic skip heuristic

Add after "If structural outcome is 'go' or 'go_advisory': Proceed to Layer 2.":
```
**Simple wave fast path:** If the structural outcome is "go" or "go_advisory" AND the wave has 0 TDs AND <= 2 tasks, skip Layer 2. The structural G5 result is sufficient for simple waves. Write a gates.yml entry:
```yaml
history:
  - gate: "G5"
    timestamp: "{ISO 8601 UTC}"
    outcome: "{structural outcome}"
    evaluator: "g5-structural-only"
    notes: "Spike phase: {slug}. Semantic verification skipped — wave has 0 TDs and <= 2 tasks."
    overridden: false
```
Display: "Semantic gate-verifier skipped (0 TDs, {N} task(s)). Structural G5 result: {outcome}." Proceed to Step 9.

For waves with TDs or > 2 tasks, continue to Layer 2 as normal.
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| G5 breaks on `### Step` headings | Break only on `## ` and `# ` | Phase 3 (this fix) | Eliminates false M4 failures |
| Always run full TD resolution | Skip Step 5 for 0-TD waves | Phase 3 (this fix) | Faster spike for simple waves |
| Always run semantic gate-verifier | Skip semantic for 0-TD, <=2 task waves | Phase 3 (this fix) | Saves ~110 seconds per simple spike |

## Open Questions

1. **Should the `countImplementationSteps` function also count `### Step N:` headings as steps (not just bullets)?**
   - What we know: Currently it counts ONLY bullets/numbered items (`/^\s*(?:\d+[.)]\s+|-\s+|\*\s+)\S/`). Step headings themselves are not counted as steps.
   - What's unclear: If SPIKE.md uses `### Step 1: Title` with no bullets under it, that step would not be counted toward the M4 minimum of 3.
   - Recommendation: Out of scope for this phase. The formatting guidance tells Claude to use bullet/numbered sub-steps under each step heading, which satisfies the counter. The heading level fix is sufficient.

2. **Should the semantic skip threshold be configurable?**
   - What we know: The requirement specifies 0 TDs AND <= 2 tasks as the heuristic.
   - What's unclear: Whether this threshold will need tuning as more waves are spiked.
   - Recommendation: Hard-code for now. The threshold is embedded in SKILL.md prose, so changing it later is a simple text edit -- no gate script changes needed.

## Sources

### Primary (HIGH confidence)
- `gates/g5-spike.js` lines 92-120 -- direct source code analysis of the `countImplementationSteps` bug
- `gates/g1-scope.js` lines 130-198 -- Phase 2 analog fix pattern for M6 DA heading regex
- `gates/g4-plan.js` lines 319-346 -- Phase 2 analog fix pattern for S3 orphan task scoping
- `skills/spike/SKILL.md` lines 72-167 -- current Steps 4-9 source text
- `.planning/phases/02-plan-phase-retrospective-fixes/02-02-PLAN.md` -- Phase 2 plan showing exact fix pattern

### Secondary (MEDIUM confidence)
- `.planning/ROADMAP.md` Phase 3 requirements -- requirement text copied verbatim

## Metadata

**Confidence breakdown:**
- G5 heading fix: HIGH -- direct source code analysis, exact analog in Phase 2 G1 fix
- 0-TD fast path: HIGH -- SKILL.md-only change, straightforward conditional skip
- Semantic skip: HIGH -- SKILL.md-only change, clear heuristic, existing gates.yml write pattern to follow
- Overall architecture: HIGH -- all three fixes are isolated, well-scoped, and follow established patterns

**Research date:** 2026-03-18
**Valid until:** Indefinite (fixing bugs in stable, shipped code)
