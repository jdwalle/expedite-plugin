# Features Research — v1.1 Production Polish

**Date:** 2026-03-09
**Milestone:** v1.1 — audit gap remediation
**Confidence:** HIGH

## Executive Summary

v1.1 scope contains 8 items from the production readiness audit: 3 quick fixes, 3 UX/quality improvements, and 2 feature enhancements. All are internal improvements to an existing, fully-functional plugin. No new user-facing workflows — everything enhances existing workflows.

## Feature Landscape

### Table Stakes (Must Ship)

| ID | Feature | Description | Complexity | Files Touched |
|----|---------|-------------|-----------|---------------|
| FIX-1 | Version label | plugin.json `0.1.0` → `1.0.0` | Trivial | 1 |
| FIX-2 | Root .gitignore | Exclude .DS_Store recursively | Trivial | 1 (new) |
| FIX-3 | Architecture doc | Document sufficiency evaluator Task() decision | Trivial | 1 |
| DEFER-11 | Step-level tracking | `current_step` in state.yml, all skills write step on entry | Medium | 8+ (all skills + state schema) |
| DEFER-12 | DA readiness enforcement | G2-G5 gates validate substantive DA satisfaction, not just structural presence | Medium-High | 4 skills (gate sections) |

### Differentiators (Significant Value-Add)

| ID | Feature | Description | Complexity | Files Touched |
|----|---------|-------------|-----------|---------------|
| DEFER-1 | HANDOFF.md support | Activate existing code, test end-to-end for product-intent users | Medium | Design SKILL.md + PROJECT.md |
| DEFER-2 | Log.yml size warning | Status skill warns when log.yml exceeds 50KB | Low | Status SKILL.md |
| DEFER-3 | State reconstruction | Status skill cross-references artifacts against state.yml phase | Medium | Status SKILL.md |

### Anti-Features (Explicitly Excluded)

| Feature | Reason for Exclusion |
|---------|---------------------|
| Auto .bak fallback (DEFER-4) | Deferred to v1.2 — low probability event |
| Codebase analyst → explore (DEFER-5) | Deferred to v1.2 — needs testing |
| Alternative-surfacing (DEFER-6) | Deferred to v1.2 — significant redesign |
| Split state.yml (DEFER-10) | Deferred to v1.2 — not urgent until real bloat |
| External verifier (DEFER-13) | Deferred to v1.2 — rubric evaluator sufficient for now |
| Per-task git commits (DEFER-14) | Deferred to v1.2 — execute works without it |
| SessionStart hook (DEFER-7) | Deferred to v2 — platform bugs block |
| Connected Flow import (DEFER-8) | Deferred to v2 — no cross-lifecycle users yet |

## Dependencies

```
FIX-1/2/3 ─── (independent, no deps)

DEFER-11 (step tracking) ─── prerequisite for ──→ DEFER-3 (state reconstruction benefits from step data)
                                                  DEFER-1 (HANDOFF testing benefits from step orientation)

DEFER-12 (gate enforcement) ─── depends on ──→ understanding of existing gate structure
                               independent of other DEFER items

DEFER-2 (log.yml warning) ─── independent

DEFER-3 (state reconstruction) ─── soft dep on DEFER-11 (richer state to reconstruct)
```

## Critical Path

1. **Quick fixes** (FIX-1/2/3) — zero risk, ship immediately
2. **Step tracking** (DEFER-11) — enables orientation for all subsequent work
3. **Status improvements** (DEFER-2/3) — benefits from step tracking data
4. **HANDOFF.md** (DEFER-1) — integration testing, benefits from step orientation
5. **Gate enforcement** (DEFER-12) — widest blast radius, cross-references multiple files, ship last

## Complexity Assessment

| Feature | Lines Changed (est.) | Risk | Confidence |
|---------|---------------------|------|-----------|
| FIX-1/2/3 | ~10 | None | HIGH |
| DEFER-11 | ~150-200 | Medium (touches all skills) | HIGH |
| DEFER-12 | ~100-150 | Medium-High (gate logic is critical path) | MEDIUM |
| DEFER-1 | ~30-50 | Medium (end-to-end testing needed) | HIGH |
| DEFER-2 | ~10-20 | Low | HIGH |
| DEFER-3 | ~40-60 | Medium (artifact mapping logic) | HIGH |

---
*Research completed: 2026-03-09*
