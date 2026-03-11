# Phase 14: Quick Fixes - Research

**Researched:** 2026-03-09
**Domain:** Plugin metadata, repository hygiene, architecture documentation
**Confidence:** HIGH

## Summary

Phase 14 addresses three housekeeping items identified in the v1.0 production readiness audit (AUDIT-ACTIONS.md FIX-1, FIX-2, FIX-3). All three are zero-risk, low-effort changes with no functional impact on plugin behavior. Two of the three changes have already been partially made in the working tree but remain uncommitted.

The current working tree already contains: (1) plugin.json updated from `0.1.0` to `1.0.0` (unstaged), (2) a root `.gitignore` with `.DS_Store` (untracked), and (3) the sufficiency evaluator decision already documented in PROJECT.md Key Decisions table (committed). The planner should decide whether to commit the existing working tree changes directly or rebuild them from a clean state for audit trail clarity.

**Primary recommendation:** This phase is a single plan with 3 tasks -- one per requirement. Each task is a file edit + commit. Total effort is under 15 minutes.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| HSKP-01 | plugin.json version reads `1.0.0` (not `0.1.0`) | Working tree already has this change (unstaged). Committed version reads `0.1.0`. Single-line edit in `.claude-plugin/plugin.json`. |
| HSKP-02 | Root .gitignore excludes `.DS_Store` recursively; existing tracked `.DS_Store` files removed from git index | Working tree has `.gitignore` (untracked) containing `.DS_Store`. No `.DS_Store` files are currently tracked in git index (`git ls-files` returns zero matches). The .gitignore needs to be committed. |
| HSKP-03 | PROJECT.md Key Decisions documents sufficiency evaluator architecture (spec chose inline, implementation chose Task() for context hygiene) | Already documented in committed PROJECT.md Key Decisions table. Row reads: "Sufficiency evaluator as Task() subagent (not inline) | Spec Decision 10 chose inline (~80K token savings). Implementation dispatches via Task() with `<self_contained_reads>`, trading token cost for orchestrator context hygiene. Keeps research SKILL.md lean. | Good -- context-clean". Minor inconsistency: Validated requirements section still says "inline sufficiency assessment" which could be corrected for accuracy. |
</phase_requirements>

## Current State Analysis

### HSKP-01: plugin.json Version

**File:** `.claude-plugin/plugin.json`
**Committed state:** `"version": "0.1.0"`
**Working tree state:** `"version": "1.0.0"` (modified, unstaged)

The change is a single-line edit. The working tree already has it. The planner can either:
- Stage and commit the existing change, or
- Reset and re-apply for a clean phase execution record

**Confidence:** HIGH -- verified via `git show HEAD:.claude-plugin/plugin.json` and `git diff`.

### HSKP-02: .gitignore and .DS_Store Cleanup

**File:** `.gitignore` (root)
**Committed state:** File does not exist in git
**Working tree state:** Untracked file containing `.DS_Store`

**Tracked .DS_Store files:** ZERO. `git ls-files` returns no `.DS_Store` entries. The `git rm --cached` step mentioned in the requirement is a no-op -- there is nothing to remove.

**Current .gitignore content:**
```
.DS_Store
```

**Recommendation:** The existing `.gitignore` is minimal but sufficient for the requirement. However, for a production v1.0 plugin, consider adding a recursive pattern. A single `.DS_Store` line in root `.gitignore` already handles recursive exclusion by git's default glob behavior -- git matches `.DS_Store` at any directory depth unless the pattern starts with `/`. So the current content is correct.

**Confidence:** HIGH -- verified via `git ls-files`, `git status`, and file content inspection.

### HSKP-03: Sufficiency Evaluator Documentation

**File:** `.planning/PROJECT.md`
**Committed state:** Key Decisions table already contains the row documenting the divergence.

**Existing documentation (committed):**

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Sufficiency evaluator as Task() subagent (not inline) | Spec Decision 10 chose inline (~80K token savings). Implementation dispatches via Task() with `<self_contained_reads>`, trading token cost for orchestrator context hygiene. Keeps research SKILL.md lean. | Good -- context-clean |

**Gap found:** The Validated requirements section (line 20 of PROJECT.md) still says "inline sufficiency assessment" which is factually incorrect given the Task() implementation. The planner may want to correct this to "Task()-dispatched sufficiency assessment" for consistency, though the requirement only mandates the Key Decisions entry.

**Confidence:** HIGH -- verified via `git show HEAD:.planning/PROJECT.md`.

## Architecture Patterns

### Pattern: Atomic Housekeeping Commits

Each fix should be its own commit for clean git history:
1. `chore: bump plugin.json version to 1.0.0`
2. `chore: add root .gitignore`
3. `docs: document sufficiency evaluator architecture decision` (if any change needed)

### Pattern: Working Tree Awareness

The planner must account for the fact that changes already exist in the working tree. Options:
- **Option A (pragmatic):** Stage and commit existing changes. Fastest path. Risk: changes were made outside the phase execution flow.
- **Option B (clean):** Verify existing changes match requirements, then commit. Same result, adds verification step.

Recommendation: Option B -- verify then commit. This acknowledges pre-existing work while ensuring correctness.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| .DS_Store exclusion | Manual per-directory entries | Single `.DS_Store` line in root .gitignore | Git matches filename patterns recursively by default |
| Removing tracked files | Manual `git rm` per file | `git rm --cached` with glob | But verify first -- no .DS_Store files are currently tracked |

## Common Pitfalls

### Pitfall 1: Committing .gitignore Without Removing Tracked Files First
**What goes wrong:** Adding `.DS_Store` to `.gitignore` does not un-track already-tracked files. If `.DS_Store` files were in the index, they would persist.
**Why it happens:** Developers assume `.gitignore` retroactively removes tracked files.
**How to avoid:** Always run `git ls-files '*.DS_Store'` first. If any exist, run `git rm --cached` before committing .gitignore.
**Status for this project:** Not applicable -- no .DS_Store files are tracked. But verify at execution time.

### Pitfall 2: Assuming HSKP-03 Needs New Content
**What goes wrong:** Creating a duplicate or conflicting entry in PROJECT.md when the documentation already exists.
**Why it happens:** Not checking the committed state of PROJECT.md before planning the task.
**How to avoid:** The Key Decisions entry already exists. The task should verify it meets the requirement, not blindly add a new entry.

### Pitfall 3: Forgetting to Stage Modified Files
**What goes wrong:** Files shown as modified in `git status` (like plugin.json) have unstaged changes. Running `git commit` without `git add` first produces an empty commit.
**Why it happens:** The changes were made in a previous session and never staged.
**How to avoid:** Explicitly `git add` each file before committing.

## Verification Approach

Each requirement has a clear verification command:

| Requirement | Verification Command | Expected Output |
|-------------|---------------------|-----------------|
| HSKP-01 | `cat .claude-plugin/plugin.json \| grep version` | `"version": "1.0.0"` |
| HSKP-02a | `git ls-files .gitignore` | `.gitignore` (file is tracked) |
| HSKP-02b | `git ls-files '*.DS_Store'` | Empty output (no tracked .DS_Store) |
| HSKP-02c | `cat .gitignore` | Contains `.DS_Store` |
| HSKP-03 | `grep -A2 "Sufficiency evaluator" .planning/PROJECT.md` | Row documenting spec-vs-implementation divergence |

## Open Questions

1. **Should the Validated requirements section of PROJECT.md be corrected?**
   - What we know: Line 20 says "inline sufficiency assessment" but the implementation uses Task(). The Key Decisions table correctly documents this divergence.
   - What's unclear: Whether the Validated section's wording is considered part of the HSKP-03 requirement scope.
   - Recommendation: Fix it for consistency. Change "inline sufficiency assessment" to "Task()-dispatched sufficiency assessment" in the Validated section. This is low-risk and improves accuracy.

2. **Should existing working tree changes be committed as-is or rebuilt?**
   - What we know: plugin.json and .gitignore already have the correct content in the working tree.
   - What's unclear: Whether the planner wants execution tasks that "make the change" or "verify and commit the existing change."
   - Recommendation: Verify-and-commit approach. The changes are correct; re-making them would be theater.

3. **Should .gitignore include additional patterns beyond .DS_Store?**
   - What we know: The requirement only mandates `.DS_Store`. Other common patterns (`.env`, `node_modules/`, `*.log`) are not required.
   - What's unclear: Whether the user wants a minimal or comprehensive .gitignore.
   - Recommendation: Keep it minimal (`.DS_Store` only) per the requirement. Additional patterns can be added in future phases if needed. Note that `log.yml` is already gitignored via `.expedite/.gitignore` template, not the root .gitignore.

## Sources

### Primary (HIGH confidence)
- `.claude-plugin/plugin.json` -- direct file inspection (committed and working tree)
- `.gitignore` -- direct file inspection (working tree only, untracked)
- `.planning/PROJECT.md` -- direct file inspection (committed version via `git show`)
- `git ls-files`, `git status`, `git diff` -- verified current git state
- `.planning/research/expedite-audit/AUDIT-ACTIONS.md` -- source of FIX-1, FIX-2, FIX-3 requirements

## Metadata

**Confidence breakdown:**
- HSKP-01 (version bump): HIGH -- single-line change, already in working tree, verified
- HSKP-02 (.gitignore): HIGH -- file exists, no tracked .DS_Store to remove, verified
- HSKP-03 (architecture doc): HIGH -- documentation already exists in committed PROJECT.md, verified

**Research date:** 2026-03-09
**Valid until:** indefinite (housekeeping items, no dependency on external libraries or APIs)
