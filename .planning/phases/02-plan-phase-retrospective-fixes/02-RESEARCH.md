# Phase 02: Plan Phase Retrospective Fixes - Research

**Researched:** 2026-03-19
**Domain:** Gate scripts (Node.js ES5), agent prompts (Markdown), skill definitions (Markdown)
**Confidence:** HIGH

## Summary

This phase addresses four bugs discovered during the first real-world plan phase. All four are localized fixes to existing files with clear reproduction paths and well-defined acceptance criteria. Three files are affected: `agents/plan-decomposer.md` (requirements 1 and 4), `gates/g4-plan.js` (requirement 2), and `gates/g1-scope.js` plus `skills/scope/SKILL.md` (requirement 3).

The fixes split naturally into two groups: (A) plan-decomposer prompt improvements (requirements 1 and 4, both modifying the same file), and (B) gate logic corrections (requirements 2 and 3, modifying different gate files). Group A is pure prompt editing with no code execution risk. Group B involves modifying JavaScript gate logic where incorrect changes could break gate evaluation for all future lifecycle runs.

**Primary recommendation:** Split into two plans -- one for plan-decomposer prompt fixes (low risk, both touch the same file), one for gate logic fixes (moderate risk, require careful regex/logic changes and syntax verification).

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Node.js | >= 10.10 | Gate script runtime | Already in use for all gates |
| js-yaml | (bundled) | YAML parsing in gate-utils | Already in use via `hooks/node_modules/js-yaml` |

### Codebase Conventions

| Convention | Detail | Source |
|------------|--------|--------|
| ES5 style | `var` (not `const`/`let`), `function` (not arrow), `.indexOf` (not `.includes`) | All gate files, confirmed Phase 01 decision |
| Gate utils | Shared helpers in `gates/lib/gate-utils.js` -- `readFile`, `readYaml`, `buildEntry`, `appendGateResult`, `printResult`, `extractDAs` | Direct code read |
| Agent prompts | Markdown with YAML frontmatter, XML-style blocks (`<role>`, `<instructions>`, etc.) | `agents/plan-decomposer.md` |
| Skill files | Markdown with YAML frontmatter, step-numbered instructions, `!` shell injection for dynamic context | `skills/scope/SKILL.md` |

## Architecture Patterns

### File Locations

```
agents/
├── plan-decomposer.md    # Req 1, 4: prompt additions
gates/
├── g1-scope.js           # Req 3a: M6 regex fix
├── g4-plan.js            # Req 2: S3 false positive fix
├── lib/
│   └── gate-utils.js     # Shared utilities (no changes needed)
skills/
└── scope/
    └── SKILL.md           # Req 3b: Step 9 formatting guidance
```

### Pattern: Gate Check Structure

Each gate check follows this pattern (from `g4-plan.js` and `g1-scope.js`):

```javascript
// 1. Compute result
var checkPassed = /* boolean expression */;

// 2. Push to results array
mustResults.push({     // or shouldResults for SHOULD checks
  criterion: 'M1',    // ID like M1, M2, S1, S2
  passed: checkPassed,
  detail: checkPassed
    ? 'Success message'
    : 'Failure message with diagnostic info',
});
```

MUST failures produce `hold` (G1) or `recycle` (G4). SHOULD failures produce `go_advisory`.

### Pattern: Phase 01 Fix Plans

Phase 01 plans provide the template for this phase's plans:
- Frontmatter: `phase`, `plan`, `type: execute`, `wave`, `depends_on`, `files_modified`, `autonomous: true`, `must_haves` with `truths`, `artifacts`, and `key_links`
- `<objective>` block: purpose statement + output description
- `<context>` block: `@`-references to files the executor reads
- `<tasks>` block: each task has `type="auto"`, `<name>`, `<files>`, `<action>` (detailed step-by-step), `<verify>`, `<done>`
- `<verification>` block: numbered checks to run after all tasks
- `<success_criteria>` block: bulleted criteria

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Phase section extraction | New parsing logic | Reuse `extractPhases()` already in g4-plan.js (lines 49-93) | Already handles Phase/Wave/Epic headings, tested in production |
| Line-by-line markdown scanning | Complex state machine | Simple regex + section slicing | Gate scripts use straightforward line iteration, not AST parsing |

## Common Pitfalls

### Pitfall 1: Breaking Gate Exit Codes

**What goes wrong:** Modifying gate logic can inadvertently change the outcome computation (go/go_advisory/hold/recycle), causing gates to pass when they should fail or vice versa.
**Why it happens:** MUST vs SHOULD distinction determines exit behavior. Moving a check from MUST to SHOULD (or vice versa) changes gate severity.
**How to avoid:** For S3 fix, keep it as a SHOULD check pushing to `shouldResults`. For M6 fix, keep it as a MUST check pushing to `mustResults`. Run `node -c gates/g4-plan.js` and `node -c gates/g1-scope.js` after edits.
**Warning signs:** Gate outcome changes for well-formed inputs.

### Pitfall 2: S3 Over-Restriction

**What goes wrong:** The S3 fix could be too aggressive in ignoring content, missing actual orphan tasks.
**Why it happens:** If the fix skips ALL content before the first phase heading, legitimate orphan tasks above phase sections would also be missed.
**How to avoid:** The requirement explicitly says to only scan within phase sections. Since phase sections are where tasks belong by definition, scanning only within them is correct. The `extractPhases` function already handles this -- reuse it to get per-phase content, then only check task bullets within those sections.
**Warning signs:** Orphan tasks above or between phase sections go undetected.

### Pitfall 3: M6 Regex Loosening Goes Too Far

**What goes wrong:** Making the DA heading regex too permissive could match non-DA sections, causing false passes.
**Why it happens:** If the regex matches any heading containing common words, non-DA sections could be treated as DA sections.
**How to avoid:** The current regex `(/^#{1,4}\s+.*(?:DA-\d+|Decision\s+Area)/i)` is the heading detector. The actual depth/readiness check happens on section CONTENT (lines 154-155: `/depth/i` and `/readiness/i`). The real fix per the requirement is: (a) ensure the heading regex catches common DA heading variants, and (b) add formatting guidance so Claude writes the heading in a format that the regex reliably catches. Since the SKILL.md already says "Decision Areas: each DA with depth...", the simplest approach is to specify the exact heading format (include DA-N in heading) and keep the regex focused.
**Warning signs:** Non-DA headings matching the regex.

### Pitfall 4: Prompt Changes in Wrong Location

**What goes wrong:** Adding G4 format requirements to the wrong section of `plan-decomposer.md` (e.g., in `<quality_gate>` instead of `<instructions>` or `<output_format>`).
**Why it happens:** The agent has multiple sections. Format requirements belong where they'll influence generation, not just verification.
**How to avoid:** Add TD-N format requirements in the `<instructions>` section (step 3, format rules) where the agent reads them during plan generation. Also add to `<quality_gate>` so the agent self-checks. The `<downstream_consumer>` section should mention G4's M4 check so the agent understands WHY.

## Code Examples

### Requirement 1: G4 Format Requirements for Plan-Decomposer

The G4 M4 check (g4-plan.js lines 179-211) validates:

```javascript
// What G4 M4 actually checks:
var tdMatches = planContent.match(/TD-\d+/gi);
// Falls back to:
var hasTacticalText = /tactical\s+decision/i.test(planContent);
```

The plan-decomposer needs to know this. Add to the `<instructions>` section after step 2 (mapping design decisions to tasks) and before step 3 (generate the plan):

Additions needed:
1. In `<instructions>`, after step 2: explain that design decisions with multiple viable approaches should be surfaced as tactical decisions (TDs) with IDs
2. In the format templates (both product and engineering), add a "Tactical Decisions" table requirement
3. In `<quality_gate>`, add a TD checklist item
4. In `<downstream_consumer>`, note that G4 M4 checks for TD-N patterns

### Requirement 2: S3 False Positive Fix

Current S3 (lines 319-355) scans ALL lines. Fix: only scan content within phase sections.

The `phases` array (computed on line 114) already contains per-phase content. Simplest fix:

```javascript
// S3: No orphan tasks (all task bullets are under a phase heading)
// Only scan content within phase sections -- bullets in metadata,
// coverage tables, or tactical decision tables before the first
// phase heading are not orphan tasks.
var s3Passed = true;
var s3Detail = '';
if (planContent) {
  var totalTasksInPhases = 0;
  for (var s3p = 0; s3p < phases.length; s3p++) {
    totalTasksInPhases += phases[s3p].tasks.length;
  }
  var allTaskCount = countAllTasks(planContent);
  var orphanCount = allTaskCount - totalTasksInPhases;
  // countAllTasks already only counts within phase sections,
  // so orphanCount should always be 0
  // ...
```

Wait -- `countAllTasks` (lines 96-111) already only counts within phase sections (`inPhase` flag). So the issue is specifically in the S3 check's own scanning logic (lines 319-355) which does NOT reuse `countAllTasks` or `extractPhases`. The fix should replace S3's inline scanning with logic that uses the already-parsed phases or with the same `inPhaseSection` tracking that `countAllTasks` uses.

Actually, looking more carefully at the S3 logic: it sets `inPhaseSection = true` on phase headings (line 328) but then sets it to `false` on ANY `## ` heading that isn't a phase heading (line 332). This means sub-headings within phases like `### Task t01: ...` at h3 level pass through fine (the reset only triggers on h1/h2), but any `## Summary` or `## Tactical Decisions` heading before phases sets `inPhaseSection = false`.

The real bug: `inPhaseSection` starts as `false`, so ALL bullets before the first phase heading are flagged as orphans. Additionally, `## ` headings within phase content (like subsections) reset `inPhaseSection` to false.

**Best fix:** Replace the S3 inline logic to only scan within phase section content. Use the `phases` variable already computed at line 114.

```javascript
// S3: Only check for task-like bullets outside phase sections
var s3Passed = true;
var s3Detail = '';
if (planContent) {
  // Build set of all lines that belong to phase sections
  var allLines = planContent.split('\n');
  var phaseLinesSet = {};
  var inPhase = false;
  for (var pl = 0; pl < allLines.length; pl++) {
    if (/^#{1,4}\s+(?:Phase|Wave|Epic)\s+\d+/i.test(allLines[pl])) {
      inPhase = true;
      phaseLinesSet[pl] = true;
      continue;
    }
    // A new top-level heading (h1 or h2) that isn't a phase heading ends the phase section
    if (inPhase && /^#{1,2}\s+/.test(allLines[pl]) && !/^#{1,4}\s+(?:Phase|Wave|Epic)\s+\d+/i.test(allLines[pl])) {
      inPhase = false;
    }
    if (inPhase) {
      phaseLinesSet[pl] = true;
    }
  }
  // Count task-like bullets NOT in any phase section
  var orphanCount = 0;
  for (var ol = 0; ol < allLines.length; ol++) {
    if (!phaseLinesSet[ol] && /^\s*(?:[-*]|\d+[.)]\s)\s*\S/.test(allLines[ol])) {
      // Don't flag short bullets (metadata)
      if (allLines[ol].trim().length > 10) {
        orphanCount++;
      }
    }
  }
  // ...
}
```

Actually, the simplest and most correct fix per the requirement is: **only scan within phase sections**. Since `extractPhases` already parses content between phase headings, just check that all tasks found by `countAllTasks` match the tasks in `extractPhases`. Or even simpler: skip S3 scanning of non-phase content entirely. The check becomes vacuously true for content outside phase sections -- we just don't care about bullets in metadata/tables.

The cleanest approach: replace the S3 inline scan with reuse of the `phases` array. Since `phases[i].tasks` already contains bullets within phase sections, and `countAllTasks` counts the same thing, the check can just verify these match. But actually, the intent of S3 is "no orphan tasks outside phase sections" -- if we only scan phase sections, we never find orphans. That makes S3 meaningless.

**Correct interpretation:** S3's purpose is to catch accidentally-placed tasks outside phase sections. The bug is that it's too aggressive about what constitutes "outside." The fix should NOT count bullets that appear before the first phase heading (metadata area) or after the last phase section as orphans. The simplest approach: track whether we've seen the first phase heading and the last phase heading, and only flag orphans between phase sections (not before the first or after the last).

Actually re-reading the requirement: "restrict the S3 check to only scan content within phase sections (between `## Phase N` headings), excluding top-level metadata sections... The check should not flag bullets in sections that precede the first phase heading or follow the last phase section."

So the fix is: S3 should ONLY look for task bullets WITHIN phase sections and verify they're properly organized. Since all bullets within phase sections are by definition not orphans, this means S3 only needs to scan the region from the first phase heading to the end of the last phase section, and within that region flag bullets that fall between phase sections (in the gaps). This makes much more sense.

### Requirement 3: G1 M6 Fix

Current M6 code (g1-scope.js lines 130-183):

```javascript
// Find DA headings
if (/^#{1,4}\s+.*(?:DA-\d+|Decision\s+Area)/i.test(daLines[d])) {
  daHeadings.push({ line: d, text: daLines[d] });
}
// Then for each DA section, check:
var hasDepth = /depth/i.test(section);
var hasReadiness = /readiness/i.test(section);
```

The section content check is already flexible (just looks for words "depth" and "readiness" anywhere in the section). The heading detector is the potential issue -- it requires "DA-N" or "Decision Area" in the heading text. If Claude writes headings without those markers, no DA sections are detected, and M6 fails with "No Decision Area headings found."

**Fix part (a):** Loosen the heading regex. The requirement says "accept common heading variants." Options:
- Add matching for headings that contain depth/readiness annotations directly (since those are DA-specific content)
- Use a two-pass approach: first check for DA-N/Decision Area headings, then if none found, look for headings that contain depth/readiness patterns (indicating they're DA sections even without the DA-N label)

**Fix part (b):** In `skills/scope/SKILL.md` Step 9, add explicit heading format like:
```markdown
### DA-1: [Name] (Depth: [Deep|Standard|Light])
```
This ensures Claude writes the DA-N in the heading so the regex matches reliably.

### Requirement 4: Agent Effort Estimates

Simple prompt addition to `agents/plan-decomposer.md`. The current line 131 says:
```
- Effort estimates are in the 2-8 hour range (larger tasks should be split)
```

This needs updating to reflect agent execution time. Also add general guidance in the `<instructions>` section.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| No TD format in agent prompt | G4 M4 checks for TD-N but agent doesn't know | v3.0 (Phase 34) | Plans missing TD references, M4 failure |
| S3 scans all lines | S3 should scope to phase sections only | This fix | False positives on every plan with coverage tables |
| M6 requires specific DA heading format | M6 should accept variants + SKILL.md should guide format | This fix | Two hold cycles on correct SCOPE.md |
| Human-calibrated effort (2-8 hours) | Agent-calibrated effort (15min-2hr) | This fix | 3-5x overestimate on agent-executed tasks |

## Open Questions

1. **S3 "between phases" orphans**
   - What we know: The requirement says scan only within phase sections. But orphan bullets between phases (in the gap between one phase section ending and the next starting) would also be missed.
   - What's unclear: Should bullets between phase sections (but after the first phase heading) be flagged?
   - Recommendation: Follow the requirement literally -- only scan within phase sections. Bullets between phases are rare and likely formatting artifacts, not real orphans. The check's purpose is to catch task content that's obviously misplaced, not to enforce perfect Markdown structure.

2. **M6 heading regex scope**
   - What we know: Current regex requires DA-N or "Decision Area" in heading. Scope SKILL.md doesn't specify exact format.
   - What's unclear: How many heading variants exist in the wild?
   - Recommendation: Apply both fixes. (a) Loosen regex to also match headings followed by depth/readiness content. (b) Add explicit format guidance. The belt-and-suspenders approach prevents future recurrence.

## Sources

### Primary (HIGH confidence)
- `gates/g4-plan.js` - Direct code read of S3 check (lines 319-355) and M4 check (lines 179-211)
- `gates/g1-scope.js` - Direct code read of M6 check (lines 130-183)
- `agents/plan-decomposer.md` - Direct code read of full agent prompt (190 lines)
- `skills/scope/SKILL.md` - Direct code read of Step 9 artifact writing (lines 158-188)
- `gates/lib/gate-utils.js` - Direct code read of shared utilities (220 lines)

### Secondary (HIGH confidence)
- `.planning/phases/01-research-phase-retrospective-fixes/01-01-PLAN.md` - Plan template pattern
- `.planning/phases/01-research-phase-retrospective-fixes/01-02-PLAN.md` - Plan template pattern

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - all files read directly, ES5 convention confirmed
- Architecture: HIGH - all four fix locations identified with line numbers
- Pitfalls: HIGH - failure modes identified from direct code analysis

**Research date:** 2026-03-19
**Valid until:** 2026-04-19 (stable codebase, no external dependencies)
