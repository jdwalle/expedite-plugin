# Requirements: Expedite v1.2

**Defined:** 2026-03-11
**Core Value:** Developers can run a complete evidence-based lifecycle — from scoping questions through researched design to executable plan — without losing context, skipping steps, or making decisions without evidence.

## v1.2 Requirements

Requirements for v1.2 Infrastructure Hardening & Quality. Each maps to roadmap phases.

### Resilience

- [x] **RESL-01**: User's corrupted state.yml is automatically detected and recovered from .bak on any skill invocation
- [x] **RESL-02**: User sees a warning message identifying what was recovered and the last known phase after auto-recovery
- [x] **RESL-03**: User's state is reconstructed from artifacts (SCOPE.md, SYNTHESIS.md, DESIGN.md, PLAN.md) when both state.yml and .bak are corrupted
- [x] **RESL-04**: User sees an unrecoverable error with clear instructions when no recovery source exists
- [ ] **RESL-05**: Every state file write includes a `_write_complete` sentinel as the last field, and reads validate its presence _(deferred — write atomicity handled by Claude Code platform)_

### Architecture

- [ ] **ARCH-01**: Codebase analyst subagent uses `explore` type instead of `general-purpose`, validated via empirical spike
- [ ] **ARCH-02**: State is split into scoped files: state.yml (tracking ~15 lines), questions.yml, tasks.yml, gates.yml
- [ ] **ARCH-03**: Each skill's `!cat` injection loads only the specific state files it needs (scoped injection)
- [ ] **ARCH-04**: Each scoped state file uses the same backup-before-write protocol (.bak copy before every write)
- [ ] **ARCH-05**: Active lifecycles with monolithic state.yml are migrated to split format on first access without data loss
- [ ] **ARCH-06**: State recovery (RESL-01) works correctly with the split file layout

### Quality

- [ ] **QUAL-01**: External verifier agent checks reasoning soundness of research synthesis (logical validity, contradiction handling, confidence calibration)
- [ ] **QUAL-02**: Verifier findings are advisory in G2 gate display, not blocking (SHOULD criterion, not MUST)
- [ ] **QUAL-03**: Verifier produces per-DA assessments in `reasoning-verification.yml` with severity ratings
- [ ] **QUAL-04**: Verifier is annotation-only on research round 2+ to prevent infinite recycle loops
- [ ] **QUAL-05**: Design skill surfaces competing alternatives with tradeoff analysis when SYNTHESIS.md evidence shows genuine tradeoffs (2+ viable approaches, no dominant option)
- [ ] **QUAL-06**: Design skill proposes a single recommendation directly when evidence clearly favors one approach
- [ ] **QUAL-07**: Plan skill notes alternative-considered DAs in task decomposition for context

### Developer Workflow

- [ ] **DEVW-01**: Execute skill creates an atomic git commit after each verified task
- [ ] **DEVW-02**: Commit message follows conventional format: `{type}(DA-{N}): {task_description}`
- [ ] **DEVW-03**: Only files explicitly modified by the task are staged (never `git add .` or `git add -A`)
- [ ] **DEVW-04**: User can opt out of auto-commits (per-invocation flag or per-lifecycle setting)
- [ ] **DEVW-05**: Failed task verification does not auto-commit; user is prompted with options
- [ ] **DEVW-06**: Git errors (merge conflicts, dirty worktree) pause execution with instructions, not auto-resolve

### Maintainability

- [ ] **MAINT-01**: All skills exceeding 500 lines have self-contained content blocks extracted to `references/ref-*.md`
- [ ] **MAINT-02**: Extracted content is loaded on-demand via Read tool reference, not injected at skill load time
- [ ] **MAINT-03**: Step numbering and status skill lookup table remain unchanged after extraction
- [ ] **MAINT-04**: Step 1 (prerequisite check) and state transition logic remain inline in every skill

## Future Requirements

Deferred to v1.3+.

### Resilience (v1.3)

- **RESL-06**: Mid-skill state corruption is detected and recovered (currently only Step 1 checks)

### Architecture (v2)

- **ARCH-07**: SessionStart hook for automatic context injection (blocked by 3 Claude Code platform bugs)
- **ARCH-08**: Connected Flow import — cross-lifecycle artifact import with locked constraints

### Quality (v1.3)

- **QUAL-08**: Verifier promoted from SHOULD to MUST gate criterion after calibration over 3+ lifecycles

## Out of Scope

| Feature | Reason |
|---------|--------|
| Auto git push | Removes user control over when to share commits; push is a team-coordination action |
| state.yml.bak rotation (multiple backups) | Over-engineering; single .bak covers common case; git history covers older states |
| Unconditional alternative surfacing | Creates decision fatigue when evidence is clear; anti-feature per FEATURES.md |
| Mandatory git integration | Some users want manual commit control; must be opt-out |
| Verifier as MUST gate blocker (v1.2) | Needs calibration over real lifecycles before promotion; SHOULD prevents override-training |
| Full state schema migration tooling | Complete-rewrite semantics mean schema changes apply on first write; migration is one-time |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| RESL-01 | Phase 19 | Complete |
| RESL-02 | Phase 19 | Complete |
| RESL-03 | Phase 19 | Complete |
| RESL-04 | Phase 19 | Complete |
| RESL-05 | — | Deferred |
| ARCH-01 | Phase 20 | Pending |
| ARCH-02 | Phase 21 | Pending |
| ARCH-03 | Phase 21 | Pending |
| ARCH-04 | Phase 21 | Pending |
| ARCH-05 | Phase 21 | Pending |
| ARCH-06 | Phase 21 | Pending |
| QUAL-01 | Phase 24 | Pending |
| QUAL-02 | Phase 24 | Pending |
| QUAL-03 | Phase 24 | Pending |
| QUAL-04 | Phase 24 | Pending |
| QUAL-05 | Phase 24 | Pending |
| QUAL-06 | Phase 24 | Pending |
| QUAL-07 | Phase 24 | Pending |
| DEVW-01 | Phase 23 | Pending |
| DEVW-02 | Phase 23 | Pending |
| DEVW-03 | Phase 23 | Pending |
| DEVW-04 | Phase 23 | Pending |
| DEVW-05 | Phase 23 | Pending |
| DEVW-06 | Phase 23 | Pending |
| MAINT-01 | Phase 22 | Pending |
| MAINT-02 | Phase 22 | Pending |
| MAINT-03 | Phase 22 | Pending |
| MAINT-04 | Phase 22 | Pending |

**Coverage:**
- v1.2 requirements: 28 total
- Mapped to phases: 28
- Unmapped: 0

---
*Requirements defined: 2026-03-11*
*Last updated: 2026-03-11 after roadmap creation*
