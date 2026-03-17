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

## Milestone: v1.2 — Infrastructure Hardening & Quality

**Shipped:** 2026-03-12
**Phases:** 1 | **Plans:** 2

### What Was Built
- State recovery: automatic detection and recovery of missing/corrupted state.yml from lifecycle artifacts

### What Worked
- Tight scope (1 phase, 2 plans) — shipped in a single session
- Recovery protocol validates against all artifact types, not just state.yml
- Decision to subsume phases 20-24 into v2.0 agent harness avoided redundant work

### What Was Inefficient
- 28 requirements scoped for 6 phases but only 1 phase shipped — rest carried forward to v2.0
- Milestone audit revealed heavy requirement debt from subsumed phases

### Patterns Established
- Milestone can ship with subset of scoped phases when remaining work is subsumed by broader effort
- Recovery protocol: detect corruption → scan artifacts → rebuild state → log recovery

### Key Lessons
1. Scope resets are healthy — subsuming 5 phases into a better-researched v2.0 architecture was correct
2. Recovery protocols need all-file coverage from day one — state corruption affects the whole workflow

### Cost Observations
- Model mix: 100% opus
- Total execution time: ~8 minutes across 2 plans
- Notable: Smallest milestone — focused on a single resilience capability

---

## Milestone: v2.0 — Agent Harness Foundation

**Shipped:** 2026-03-13
**Phases:** 5 | **Plans:** 11

### What Was Built
- 5-file state split (state.yml, checkpoint.yml, questions.yml, gates.yml, tasks.yml) with schema validators and per-skill frontmatter injection
- PreToolUse hook: FSM transition enforcement, gate passage checking, checkpoint regression guard, structural validation
- Override mechanism: actionable denials with retry instructions, deadlock prevention, escalation after 3 denials, enriched audit trail
- Checkpoint-based deterministic resume in all 6 skills with mid-step substep context
- Session handoff: Stop + PreCompact hooks persist session-summary.md; all lifecycle skills inject session context

### What Worked
- Extensive pre-work research (8+ harness implementations analyzed, 3 design proposals synthesized) made execution decisions nearly pre-made
- A1 assumption empirically validated before any code written — no wasted effort on wrong hook architecture
- Layered enforcement approach (schema → FSM → gate → checkpoint → gate-phase) allows each concern to be tested independently
- Fail-open design for hooks — enforcement is additive safety, never blocks development workflow
- 1-day execution for 5 phases / 11 plans — fastest milestone relative to complexity

### What Was Inefficient
- ROADMAP.md checkboxes not updated during execution — 6 plans showed unchecked despite having SUMMARY.md files
- SUMMARY.md files still lack one_liner frontmatter — third consecutive milestone with this known gap
- Gate write path disconnect (skills→state.yml vs hooks→gates.yml) is a known integration gap that prevents normal gated transitions — override workaround needed
- VALID_GATE_OUTCOMES schema missing 3 outcomes used by skills — will block M4 if not fixed first

### Patterns Established
- Non-state passthrough: hooks check file path before any YAML parsing for latency optimization
- Shared reference injection: skills/shared/ref-*.md files injected via !cat in skill preambles
- Checkpoint-at-every-step-boundary: skills write checkpoint.yml before and after every step transition
- Cross-reference rule: state.yml phase always wins over checkpoint step (prevents impossible states)
- Denial tracker with escalation: per-pattern JSON tracking with threshold-based suggestions

### Key Lessons
1. Validating architectural assumptions before coding (A1 hook behavior test) eliminates the biggest risk class — do this for every infrastructure milestone
2. Fail-open hooks are the right default for developer tools — enforcement should help, never block
3. Integration gaps between skill write patterns and hook read patterns must be resolved in the same milestone — deferring creates workaround debt
4. 1-day milestone execution is achievable when research and design are thorough — the investment compounds
5. ROADMAP.md checkbox maintenance is still falling through — needs automation or per-plan commit hook

### Cost Observations
- Model mix: 100% opus (quality profile throughout)
- Average plan duration: 3.4 minutes
- Total execution time: ~37 minutes across 11 plans
- Notable: Most architecturally complex milestone yet, but research investment made execution fast. Phase 28-01 was the outlier at 11min (6 skills to instrument).

---

## Milestone: v3.0 — Agent Harness Completion

**Shipped:** 2026-03-17
**Phases:** 8 | **Plans:** 15

### What Was Built
- 8 formalized agents (web-researcher, codebase-researcher, research-synthesizer, design-architect, plan-decomposer, spike-researcher, task-implementer, gate-verifier) with model tiering (3 Opus, 5 Sonnet)
- All 6 skills thinned to step-sequencer + agent-dispatcher pattern (100-255 lines each)
- 3 structural gate scripts (G1 scope, G2 research, G4 plan) as deterministic Node.js checks
- Dual-layer semantic gates (G3 design, G5 spike, G2-semantic) with gate-verifier agent and 4-dimension scoring
- Worktree isolation for task-implementer with merge-back and per-task atomic git commits
- Gap closure: spike G5 integration flow fixed, orphaned files removed, stale references corrected

### What Worked
- Gate-verifier pre-build validation (Phase 33) confirmed GO before committing to dual-layer — no wasted work on unproven approach
- Step-sequencer pattern made skill thinning mechanical — each skill followed the same extract-dispatch-validate template
- Milestone audit identified 9 findings; 2 gap-closure phases (36, 37) resolved all 9 — clean re-audit with only tech debt remaining
- Shared gate-utils.js library meant G2/G3/G4/G5 scripts were fast to write after G1 established the pattern
- 2-day execution for 8 phases — fastest per-phase rate yet (3.75 plans/day)

### What Was Inefficient
- SUMMARY.md files still lack one_liner frontmatter — fourth consecutive milestone with this gap (automated extraction impossible)
- Phase 33 planned for 2 plans but only needed 1 — validation was simpler than expected
- 3 integration breaks (BREAK-1/2/3) in spike flow discovered by audit, not during execution — spike should have been tested end-to-end in Phase 34
- 7 tech debt items require live human testing (plugin not in enabledPlugins) — structural verification accepted as proxy, but runtime behavior unconfirmed
- `semantic_scores` vs `semantic_evaluation` naming mismatch in gates.yml schema — data writes succeed but bypass validation

### Patterns Established
- Step-sequencer + agent-dispatcher: skills sequence steps and dispatch agents; agents own generative work
- Dual-layer gate evaluation: structural script first (fast, deterministic), semantic verifier only if structural passes
- Gate-utils shared library: YAML I/O, outcome computation, result formatting reused across all 5 gate scripts
- Agent output validation on return: verify artifact exists on disk before state update
- Reference file extraction: heavy protocols (git commit, recycle escalation) moved to ref-*.md files

### Key Lessons
1. Pre-build validation gates (Phase 33 GO/NO-GO) should be standard for any component with uncertain effectiveness — eliminates risk of building on unproven assumptions
2. Audit → gap-closure → re-audit is now a validated 3-step pattern — 3 milestones in a row used it successfully
3. Spike flow integration should be tested during the spike phase, not deferred to end-of-milestone audit — integration breaks are expensive to discover late
4. Structural verification is a good proxy but has a ceiling — 7 items require human runtime testing that structural analysis cannot provide
5. Shared utility libraries (gate-utils.js) for patterns used across 5+ scripts are worth the upfront cost — subsequent scripts wrote in half the time

### Cost Observations
- Model mix: 100% opus (quality profile throughout)
- Average plan duration: ~3.5 minutes
- Total execution time: ~53 minutes across 15 plans
- Notable: Most gate/agent infrastructure delivered per minute of any milestone. Phase 35 (worktree) had the fastest plan at 1 minute.

---

## Cross-Milestone Trends

### Process Evolution

| Milestone | Phases | Plans | Timeline | Key Change |
|-----------|--------|-------|----------|------------|
| v1.0 | 13 | 32 | 11 days | Initial build with 3 audit cycles |
| v1.1 | 5 | 11 | 2 days | Production polish — patterns from v1.0 made execution mechanical |
| v1.2 | 1 | 2 | 1 day | Scoped down — 5 phases subsumed by v2.0 architecture |
| v2.0 | 5 | 11 | 1 day | Infrastructure milestone — extensive pre-research made execution fast |
| v3.0 | 8 | 15 | 2 days | Agent harness completion — pre-build validation + shared utilities made execution fast |

### Top Lessons (Verified Across Milestones)

1. Plan-first with verbatim specifications enables fast, accurate execution (v1.0, v1.1, v2.0, v3.0)
2. Human verification checkpoints at phase boundaries catch issues subagents miss (v1.0, v1.1)
3. Audit-before-ship ensures zero-gap releases (v1.0, v1.1, v1.2, v2.0, v3.0)
4. Tracking doc maintenance should happen per-phase, not deferred — stale checkboxes are noise (v1.0, v1.1, v2.0, v3.0 — still unfixed)
5. Established patterns compound — later milestones execute faster despite increasing complexity (v1.0→v1.1→v2.0→v3.0)
6. Validate architectural assumptions before coding — eliminates biggest risk class (v2.0 A1 test, v3.0 verifier validation)
7. Thorough research investment pays back in execution speed — v2.0 and v3.0 both shipped fast despite high complexity
8. Pre-build validation gates (GO/NO-GO) should precede any uncertain component commitment (v3.0 Phase 33)
9. Shared utility libraries pay off when 3+ consumers exist — gate-utils.js halved subsequent gate script dev time (v3.0)
