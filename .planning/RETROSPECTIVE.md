# Project Retrospective

*A living document updated after each milestone. Lessons feed forward into future planning.*

## Milestone: v1.0 — Expedite Plugin Initial Release

**Shipped:** 2026-03-09
**Phases:** 13 | **Plans:** 32

### What Was Built
- Complete 5-phase research-to-implementation lifecycle plugin (Scope, Research, Design, Plan, Execute + Status)
- Parallel research orchestration with source-affinity batching and 3 concurrent Task() subagents
- 5 quality gates (G1-G5) with MUST/SHOULD criteria, recycle escalation, override handling
- Dual intent support: engineering (RFC/waves) and product (PRD/epics) from single workflow
- Crash-resilient state management with backup-before-write and mid-phase resume across all skills
- 9 prompt templates (3 researcher, 1 synthesizer, 1 sufficiency evaluator, 1 questioning guide, 1 design guide, 1 plan guide, 1 task verifier) plus 3 inline references

### What Worked
- Plan-first approach: verbatim plan specifications meant execution was mostly copy-paste with minor judgment calls
- Splitting research into two phases (Core + Quality) reduced complexity risk — highest-risk component never blocked progress
- Three audit cycles (pre-gap-closure, post-Phase 12, post-Phase 13) caught and resolved all integration issues before shipping
- SKILL.md-as-orchestrator pattern (refactored in Phase 6) kept skills maintainable — heavy prompts moved to references/
- Human verification checkpoints at phase boundaries caught issues early (13 issues found in Phase 9 review alone)

### What Was Inefficient
- Phase 11 inserted mid-sequence for gap closure — could have been caught earlier with integration testing during Phases 4-5
- SUMMARY.md files lack one_liner frontmatter field — makes automated accomplishment extraction impossible
- Phase numbering gap (no Phase 11 originally, then 11 inserted, then 12-13 added) — confusing execution order
- 3 separate audit cycles needed when 1 comprehensive audit after Phase 10 might have sufficed

### Patterns Established
- Backup-before-write for all state mutations (state.yml.bak)
- Glob fallback parenthetical for all file reads in skills
- 8-section XML template structure for all prompts
- Case B override via *_in_progress + gate_history (not *_recycled phases)
- Freeform micro-interaction instead of AskUserQuestion for revision cycles
- Inline gates evaluated by producing skill (not separate gate skill)

### Key Lessons
1. Research skill complexity is manageable at 18 steps when split across 2 phases — no need to sub-skill further
2. Audit-before-ship workflow (audit → gap-closure phases → re-audit) is effective but front-loading integration checks would reduce cycles
3. Decision-over-task philosophy works well for prompt-based plugins — most "code" is orchestration prose, not executable logic
4. Plugin platform constraints (AskUserQuestion timeout, MCP foreground-only, SessionStart bugs) should be documented early and designed around, not discovered mid-build

### Cost Observations
- Model mix: 100% opus (quality profile throughout)
- Average plan duration: 2.3 minutes
- Total execution time: ~1.2 hours across 32 plans
- Notable: Later phases (10, 12, 13) executed faster despite complexity — established patterns reduced decision overhead

---

## Milestone: v1.1 — Production Polish

**Shipped:** 2026-03-11
**Phases:** 5 | **Plans:** 11

### What Was Built
- Step-level tracking across all 6 stateful skills — users always know their position within long-running workflows
- Status diagnostics: log size warning (50KB threshold) and artifact cross-reference for inconsistency detection
- HANDOFF.md activation — product-intent lifecycles get validated generation, revision cycle, and G3 gate evaluation
- DA readiness enforcement across G2-G5 gates — MUST criteria on evidence gates, SHOULD criteria on structural gates
- Plugin metadata polish: version 1.0.0, .gitignore, architecture decision documentation

### What Worked
- Blast-radius ordering (isolated changes first, cross-cutting last) meant no phase blocked another — clean sequential execution
- 2-day turnaround for 11 plans — established patterns from v1.0 made execution nearly mechanical
- Milestone audit before completion caught stale checkboxes and identified the 3 human-verification items cleanly
- MUST vs SHOULD distinction for gate criteria avoided over-enforcement while still catching real gaps

### What Was Inefficient
- SUMMARY.md files still lack one_liner frontmatter — same extraction problem as v1.0 (pattern not fixed between milestones)
- Stale checkboxes in REQUIREMENTS.md and PROJECT.md accumulated across phases — should update tracking docs as part of each phase execution, not defer to audit
- 3 partial requirements (HAND-01/02/03) could only be verified by human runtime testing — static verifier can't exercise SKILL.md orchestration logic

### Patterns Established
- current_step schema (skill/step/label) for tracking position within multi-step skills
- Hardcoded step-count lookup table in status skill (simpler than dynamic parsing)
- Conditional output sections in status (omit entire section when no issues)
- Dual-path revision propagation: mirrored sections sync both docs, HANDOFF-only sections edited independently
- SHOULD criteria for judgment-adjacent gate checks (advisory, not blocking)

### Key Lessons
1. Tracking doc maintenance should happen per-phase, not deferred to audit — stale checkboxes create noise
2. Static verification has a ceiling — orchestration logic that depends on LLM behavior needs human runtime testing
3. Production polish milestones are fast when the foundation is solid — 2 days vs 11 days for the same codebase
4. MUST vs SHOULD gate distinction is the right pattern — prevents over-enforcement while maintaining quality floors

### Cost Observations
- Model mix: 100% opus (quality profile throughout)
- Average plan duration: 1.9 minutes
- Total execution time: ~15 minutes across 11 plans
- Notable: Fastest milestone yet — all plans under 3 minutes. Established v1.0 patterns eliminated decision overhead entirely.

---

## Cross-Milestone Trends

### Process Evolution

| Milestone | Phases | Plans | Timeline | Key Change |
|-----------|--------|-------|----------|------------|
| v1.0 | 13 | 32 | 11 days | Initial build with 3 audit cycles |
| v1.1 | 5 | 11 | 2 days | Production polish — patterns from v1.0 made execution mechanical |

### Top Lessons (Verified Across Milestones)

1. Plan-first with verbatim specifications enables fast, accurate execution (v1.0, v1.1)
2. Human verification checkpoints at phase boundaries catch issues subagents miss (v1.0, v1.1)
3. Audit-before-ship ensures zero-gap releases (v1.0, v1.1)
4. Tracking doc maintenance should happen per-phase, not deferred — stale checkboxes are noise (v1.0 inefficiency, v1.1 confirmed)
5. Established patterns compound — v1.1 was 7x faster per plan than v1.0 initial phases
