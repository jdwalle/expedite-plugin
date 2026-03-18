# Phase 41: AUD-029 Go-Advisory Naming Cleanup - Research

**Researched:** 2026-03-17
**Domain:** Documentation string replacement in Markdown files
**Confidence:** HIGH

## Summary

Phase 41 closes the remaining gap in AUD-029: five occurrences of the hyphenated/title-cased string `Go-with-advisory` survive in two production Markdown files (`agents/gate-verifier.md` and `skills/plan/SKILL.md`). These were missed by Phase 40's case-sensitive grep verification, which only caught lowercase `go-with-advisory`. The audit integration checker identified the mismatch by comparing what `gate-utils.computeOutcome` actually emits (`go_advisory`, underscore form) against how the plan skill's G4 routing branch names outcomes (`Go-with-advisory`, hyphenated).

The fix is purely mechanical: five targeted string replacements across two files. No logic, no schema, no JS code is involved. Three replacements are in prose/checklist sections of `gate-verifier.md` (low severity — they describe the outcome label to a human evaluator), and two replacements are in the G4 gate routing section of `skills/plan/SKILL.md` (medium severity — these are outcome routing branch names that a language model reads and pattern-matches against the JSON output from `g4-plan.js`).

The canonical form established in Phase 40 is `go_advisory` (lowercase, underscore). The output format block in `gate-verifier.md` (line 133) already uses `go_advisory` correctly — only the prose descriptions lag behind. Gate-utils, gate-checks.js, and all other skills already use `go_advisory` exclusively. This phase brings gate-verifier prose and plan skill G4 routing into alignment with the rest of the codebase.

**Primary recommendation:** Replace all 5 `Go-with-advisory` occurrences with `go_advisory` using the Edit tool, verifying with a case-insensitive grep after each file.

## Current State: Exact Target Strings

All occurrences verified by direct file read (HIGH confidence — read the files themselves, not search output).

### File 1: `agents/gate-verifier.md` (3 occurrences)

| Line | Current string | Replacement | Context |
|------|---------------|-------------|---------|
| 91 | `Your overall outcome (Go/Go-with-advisory/Recycle) must be definitive` | `Your overall outcome (go/go_advisory/recycle) must be definitive` | Anti-bias protocol instruction |
| 157 | `The overall outcome follows the score thresholds (Go: all 4+, Go-with-advisory: all 3+, Recycle: any below 3)` | `The overall outcome follows the score thresholds (go: all 4+, go_advisory: all 3+, recycle: any below 3)` | Quality self-check checklist |
| 160 | `You did not hedge the outcome -- it is a definitive Go, Go-with-advisory, or Recycle` | `You did not hedge the outcome -- it is a definitive go, go_advisory, or recycle` | Quality self-check checklist |

Note: Line 133 (`outcome: "{go | go_advisory | recycle}"`) is already correct — do NOT change it.

### File 2: `skills/plan/SKILL.md` (2 occurrences)

| Line | Current string | Replacement | Context |
|------|---------------|-------------|---------|
| 117 | `**Outcomes:** Go, Go-with-advisory, Recycle -- same routing as Step 8.` | `**Outcomes:** go, go_advisory, recycle -- same routing as Step 8.` | G4 script output description |
| 123 | `**Go-with-advisory** -- Show SHOULD failures.` | `**go_advisory** -- Show SHOULD failures.` | G4 outcome branch routing |

## Architecture Patterns

### Canonical Form Decision

The canonical form is `go_advisory` (all lowercase, underscore separator). This was established in Phase 40 decision [40-02]: "Gate-verifier produces go_advisory directly; skills no longer map from go-with-advisory."

The authoritative source is `gates/lib/gate-utils.js`, which sets the string at line 96:
```
outcome = 'go_advisory';
```

All downstream consumers — `gate-checks.js`, skills, and the gate-verifier's own output format — must use this exact string.

### Why This Matters for plan/SKILL.md Line 123

The plan skill's Step 8 routing reads the `outcome` field from the JSON printed by `g4-plan.js`. The plan skill is interpreted by Claude, which pattern-matches the instruction text against the actual `outcome` value. When the instruction says `**Go-with-advisory**` but the script emits `go_advisory`, the branch will not match unless Claude happens to recognize the equivalence. Replacing with `**go_advisory**` ensures exact match routing.

### Edit Pattern

Use the Edit tool with exact string matching. Each replacement is a single-line change. No regex or multi-line replacement required.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Finding all occurrences | Shell script or grep loop | Direct file read + Edit tool | Files are small (163 lines, 132 lines); direct read confirmed exact line numbers |
| Verifying zero remaining | Inline string counting | `grep -i "go-with-advisory"` after each file | Phase 40's mistake was case-sensitive grep; use `-i` flag explicitly |

## Common Pitfalls

### Pitfall 1: Missing Capitalized Variants
**What goes wrong:** Phase 40 ran `grep -i "go-with-advisory"` (lowercase base) — but the audit shows the issue was actually capitalized `Go-with-advisory` being missed. The `-i` flag should have caught it... however the Phase 40 SUMMARY.md says "returns zero results" while the audit found 5 live instances. This contradiction suggests the verification was run in the wrong directory or before the edit.
**Why it happens:** The grep target was correct but was either not run or run on a stale version.
**How to avoid:** Run verification grep after the Edit tool writes to disk, not before or during.
**Warning signs:** Grep reporting zero results but the audit later finding occurrences.

### Pitfall 2: Over-Replacing (Changing the Correct Line 133)
**What goes wrong:** Line 133 of `gate-verifier.md` reads `outcome: "{go | go_advisory | recycle}"` — this is already correct and must not be changed.
**Why it happens:** Bulk search-and-replace would catch the adjacent `go_advisory` and might corrupt it.
**How to avoid:** Use Edit tool with exact line content matching. Only replace the 5 specific lines identified above.

### Pitfall 3: Inconsistent Case in Replacement
**What goes wrong:** Replacing `Go-with-advisory` with `Go_advisory` (keeping capital G) instead of `go_advisory` (all lowercase).
**Why it happens:** Following the capitalized pattern of the surrounding text ("Go", "Recycle").
**How to avoid:** The canonical form from `gate-utils.js` is `go_advisory` — all lowercase. Apply this even when adjacent terms ("Go", "Recycle") are capitalized in the prose.

## Code Examples

### Verification Command (run after each file edit)
```bash
# Case-insensitive search — must return zero matches in production files
grep -in "go-with-advisory" agents/gate-verifier.md skills/plan/SKILL.md
```

### Confirming gate-utils.js canonical form
```bash
grep -n "go_advisory" gates/lib/gate-utils.js
# Expected: line 96: outcome = 'go_advisory';
```

### Full production-directory sweep (final verification)
```bash
grep -rni "go-with-advisory" agents/ skills/ gates/ hooks/ templates/ 2>/dev/null
# Expected: zero matches
```

## State of the Art

| Old Form | Canonical Form | When Changed | Impact |
|----------|---------------|--------------|--------|
| `Go-with-advisory` | `go_advisory` | Phase 40 (partial) | Prose and routing labels not yet updated |
| `go-with-advisory` | `go_advisory` | Phase 40 (complete) | Lowercase hyphenated form fully eliminated |

**Already correct (do not touch):**
- `gate-verifier.md` line 133: `outcome: "{go | go_advisory | recycle}"` — output format block
- All other skills (scope, research, design, spike, execute, status) — zero occurrences of either bad form
- `gates/lib/gate-utils.js` line 96 — emits `go_advisory`
- `gates/gate-checks.js` PASSING_OUTCOMES — uses `go_advisory` only
- `gate-verifier.md` frontmatter description (line 7) — already uses `go_advisory`

## Open Questions

None. The 5 target strings are verified by direct file read at known line numbers. The replacements are unambiguous.

## Sources

### Primary (HIGH confidence)
- Direct file read: `agents/gate-verifier.md` — lines 91, 133, 157, 160 read verbatim
- Direct file read: `skills/plan/SKILL.md` — lines 117, 123 read verbatim
- Direct file read: `gates/lib/gate-utils.js` — `computeOutcome` function at line 96 confirmed
- Direct file read: `.planning/v3.1-MILESTONE-AUDIT.md` — AUD-029 gap detail section confirmed all 5 locations

### Secondary (MEDIUM confidence)
- `.planning/STATE.md` decision [40-02]: "Gate-verifier produces go_advisory directly; skills no longer map from go-with-advisory"
- `.planning/phases/40-p2-audit-fixes/40-02-SUMMARY.md` — explains what Phase 40 fixed and what it missed

## Metadata

**Confidence breakdown:**
- Target strings: HIGH — verified by direct file read at exact line numbers
- Replacements: HIGH — canonical form confirmed from gate-utils.js source
- Scope: HIGH — grep sweep confirmed only 5 occurrences in production files

**Research date:** 2026-03-17
**Valid until:** N/A — this is a one-time cleanup with a deterministic completion state
