# DA-4: Gate Script Logic

## Summary

Audited all 5 gate scripts and shared `gate-utils.js`. All gates follow a consistent structural pattern: read artifacts, evaluate MUST/SHOULD criteria, compute outcome, append to gates.yml, print JSON to stdout, exit with correct codes. Critical finding: the dual-layer pattern (structural + semantic) is implemented at the **skill level** (SKILL.md instructions), not in the gate scripts themselves — gate scripts are structural-only (Layer 1). Found **1 bug**, **5 inconsistencies**, and **2 dead imports**.

## q12: Structural Gates (g1, g2, g4)

### G1 (g1-scope.js)
- 6 MUST checks: SCOPE.md exists, >= 3 questions, valid intent, success criteria bullets, evidence_requirements on questions, DA sections with depth/readiness
- 3 SHOULD checks
- HOLD_OUTCOME="hold"
- **Verdict: Correct. No bugs.**

### G2 (g2-structural.js)
- 5 MUST checks: SYNTHESIS.md exists, DA coverage in synthesis, >= 1 evidence file, readiness content, no INSUFFICIENT DAs
- 3 SHOULD checks
- HOLD_OUTCOME="recycle"
- Minor observation: M5 could false-positive on prose containing "insufficient" in non-status contexts
- **Verdict: Correct. No bugs.**

### G4 (g4-plan.js)
- 6 MUST checks: PLAN.md exists, DA coverage, 1-20 phases, TD references, acceptance criteria with DA refs, tasks have assigned_agent
- 5 SHOULD checks
- HOLD_OUTCOME="recycle"
- **BUG: M2 case-sensitive DA matching** (see Bugs Found)
- **Verdict: Correct except M2 case sensitivity.**

All three gates correctly read artifacts, evaluate criteria, compute outcomes, write gates.yml, print parseable JSON, and exit with correct codes.

## q13: Semantic Gates (g3, g5)

### Critical Finding: Dual-Layer Pattern Location

The dual-layer pattern is **NOT** implemented in the gate scripts. `g3-design.js` and `g5-spike.js` are structural-only evaluators (Layer 1). The dual-layer orchestration happens in skill instructions:

1. `skills/design/SKILL.md` Step 8 and `skills/spike/SKILL.md` Step 8 run the structural script via Bash, parse JSON stdout
2. If structural passes, dispatch `gate-verifier` agent (Layer 2) via Agent tool
3. Validate verifier output (4 dimensions, scores, reasoning)
4. Use verifier outcome as final result; write second gates.yml entry

Result merging: structural recycle short-circuits (Layer 2 never runs); otherwise semantic outcome overrides.

### G3 (g3-design.js)
- 5 MUST + 4 SHOULD checks. Structural only.
- Dead `fs` import.
- **Verdict: Correct.**

### G5 (g5-spike.js)
- 4 MUST + 4 SHOULD checks. Takes `<phase-slug>` arg.
- Dead `fs` import. Dead code at lines 228-230.
- **Verdict: Correct.**

The dual-layer pattern is consistently implemented across G2, G3, G5 at the skill level.

## q14: gate-utils.js Shared Functions

### Exported Functions (7)

| Function | Used By | Notes |
|----------|---------|-------|
| `readYaml` | All 5 gates | Correct |
| `readFile` | All 5 gates | Correct |
| `appendGateResult` | All 5 gates | Correct |
| `formatChecks` | **None** | Exported but never called |
| `computeOutcome` | `buildEntry` only | Internal use only |
| `buildEntry` | All 5 gates | Correct |
| `printResult` | All 5 gates | Correct |

### Local Helper Functions (not shared)

| Function | Used In | Issue |
|----------|---------|-------|
| `wordCount` | G2, G3, G5 | Duplicated identically — should be in gate-utils.js |
| `extractDAs` | G2, G3, G4 | **Divergent return type**: returns `{id, name}` objects in G2/G3 but plain strings in G4 |
| `listEvidenceFiles` | G2 only | Appropriately local |

No gate has a local reimplementation of any gate-utils function.

## Bugs Found

| # | Severity | Location | Description |
|---|----------|----------|-------------|
| BUG-1 | P1 | gates/g4-plan.js line 166 | M2 uses case-sensitive `planContent.indexOf(daId)` while G2/G3 use `content.toUpperCase().indexOf(da.id)`. Could cause false gate failures if DA casing varies between SCOPE.md and PLAN.md |

## Inconsistencies Found

| # | Severity | Description |
|---|----------|-------------|
| INC-1 | Low | `extractDAs` returns `{id, name}` objects in G2/G3 but plain strings in G4 |
| INC-2 | Low | `wordCount` duplicated identically in G2, G3, G5 — should be in gate-utils.js |
| INC-3 | Cosmetic | Dead `fs` import in G3 and G5 |
| INC-4 | Cosmetic | `formatChecks` exported from gate-utils.js but never called |
| INC-5 | Low | Dual naming of `go_advisory` (underscore, from scripts) vs `go-with-advisory` (hyphenated, from verifier) — both accepted but creates confusion about canonical form |
