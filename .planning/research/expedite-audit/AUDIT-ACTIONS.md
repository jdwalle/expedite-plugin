# Expedite Plugin — Audit Action Plan

**Date:** 2026-03-09
**Source:** 10-DA production readiness audit (`research-synthesis.md`)

---

## 1. Executive Summary

The expedite plugin is production-ready. Across 29 spec decisions, 21 match exactly, 5 are documented intentional evolutions, 2 are intentional deferrals, and 1 is undocumented drift (sufficiency evaluator architecture). State management is the strongest area (42/42 backup-before-write coverage, clean `_recycled` elimination). The single biggest issue is a labeling oversight: `plugin.json` says `0.1.0` while the project self-identifies as v1.0 with 92/92 requirements verified.

---

## 2. Action Items — Fix Now (Blocking or High-Impact)

### FIX-1: Update plugin.json version to 1.0.0

- **Issue**: `plugin.json` says `"version": "0.1.0"` while PROJECT.md, RETROSPECTIVE.md, and MILESTONE-AUDIT.md all reference v1.0. Signals "beta" to consumers despite release-quality maturity.
- **Severity**: Inconsistency
- **Evidence**: DA-10 version discrepancy analysis; DA-9 manifest comparison
- **Recommended fix**: Change `"version": "0.1.0"` to `"version": "1.0.0"` in `plugin.json`.

### FIX-2: Add root .gitignore

- **Issue**: No root `.gitignore` exists. Five `.DS_Store` files appear in `git status`. The existing `templates/gitignore.template` only covers the `.expedite/` runtime directory.
- **Severity**: Missing feature
- **Evidence**: DA-10 .DS_Store analysis
- **Recommended fix**: Create a root `.gitignore` containing at minimum `.DS_Store` and `.planning/.DS_Store`. Consider also excluding `*.DS_Store` recursively.

### FIX-3: Document sufficiency evaluator architecture decision

- **Issue**: The sufficiency evaluator runs as a `Task()` subagent (`prompt-sufficiency-evaluator.md` with `subagent_type: general-purpose`, `model: sonnet`) despite spec Decision 10 explicitly choosing inline to avoid ~80K token overhead. This is the only silent drift with no documented rationale anywhere in `.planning/`.
- **Severity**: Inconsistency (undocumented design decision)
- **Evidence**: DA-1 Decision 10 mapping; DA-3 sufficiency evaluator analysis
- **Recommended fix**: Add an entry to PROJECT.md Key Decisions explaining the rationale: subagent keeps orchestrator context lean via `<self_contained_reads>`, trading token cost for context hygiene. The architecture itself is sound — only the documentation gap needs closing.

---

## 3. Action Items — Accept As-Is (Intentional Evolution)

### ACCEPT-1: `_recycled` state elimination

- **Divergence**: Spec defines `research_recycled`, `design_recycled`, `plan_recycled` intermediate states. Implementation uses `_in_progress` + `gate_history` recycle evidence + `--override` flag instead.
- **Verdict**: More elegant. No information loss — recycle count derivable from gate_history entries, escalation logic works from entry counts. Documented in `state.yml.template` comments (lines 18-27), PROJECT.md, and MILESTONE-AUDIT.md.

### ACCEPT-2: Spike skill + G5 gate addition

- **Divergence**: Spec has 5-phase lifecycle (Scope-Research-Design-Plan-Execute). Implementation adds optional Spike phase between Plan and Execute with structural G5 gate.
- **Verdict**: Fills a genuine gap — without it, tactical decision resolution would be conflated with code execution, violating the decision-over-task philosophy. G5's 4 MUST criteria are legitimate quality checks. Documented in PROJECT.md Key Decisions.

### ACCEPT-3: Per-phase execution model

- **Divergence**: Spec runs all tasks in wave order with single checkpoint. Implementation requires explicit `execute <phase>` invocation with per-phase artifacts at `.expedite/plan/phases/{slug}/`.
- **Verdict**: Aligns with decision-over-task philosophy — user decides when to proceed. Enables spiking phase N+1 while executing phase N. Bounded PROGRESS.md per phase.

### ACCEPT-4: Adaptive scope refinement replacing fixed Round 2

- **Divergence**: Spec defines fixed Round 2 questions. Implementation uses convergence-loop refinement with category selection (scope SKILL.md Step 5).
- **Verdict**: Richer context gathering. User chooses refinement categories via multiSelect, making it a genuine decision point.

### ACCEPT-5: Design revision no-limit

- **Divergence**: Spec says max 2 revision rounds (Decision 24). Implementation has no hard limit (design SKILL.md Step 7).
- **Verdict**: Prioritizes user agency. If the design needs a third round, blocking the user is counterproductive.

### ACCEPT-6: HANDOFF.md deferral (code exists, support deferred)

- **Divergence**: Design SKILL.md Step 6 (lines 275-328) contains complete 9-section HANDOFF.md implementation, but PROJECT.md lists it as "Out of Scope" for v1.
- **Verdict**: Conservative but reasonable. Spec noted "WEAK evidence" for Section 9. Code is ready when testing confirms quality.

### ACCEPT-7: Hooks/SessionStart deferral

- **Divergence**: Spec defines `hooks/`, `hooks.json`, `scripts/session-start.sh`. All absent.
- **Verdict**: Deferred due to 3 open Claude Code platform bugs. Two-layer fallback (dynamic injection + `/expedite:status`) covers the common cases.

### ACCEPT-8: sources.yml schema simplification

- **Divergence**: Spec uses array-of-objects format. Implementation uses map structure (`sources: web: { enabled: true, tools: [...] }`).
- **Verdict**: Map structure works and is arguably more readable. No functional regression.

### ACCEPT-9: Codebase-routed questions (scope Step 7)

- **Divergence**: Not in spec. Scope Step 7 (lines 391-453) adds questions from codebase analysis, not counted against the 15-question budget.
- **Verdict**: Richer research input. Additive, not disruptive.

### ACCEPT-10: Dynamic question discovery via freeform (not AskUserQuestion multiSelect)

- **Divergence**: Spec says `AskUserQuestion(multiSelect)` for new questions from research agents. Implementation uses freeform prompt with 4 options (Approve all/specific/none/Modify).
- **Verdict**: Presenting questions with rationale, DA references, and batch provenance in a multiSelect dialog would be cramped. Freeform is a defensible UX choice.

---

## 4. Action Items — Defer to v1.1+

### DEFER-1: HANDOFF.md official support

- **Issue**: Complete 9-section implementation exists in design SKILL.md Step 6 but is not officially supported. Product-intent users lose the PM-to-engineering handoff artifact.
- **Impact**: Medium for product-intent users, zero for engineering-intent.
- **Priority**: v1.1 (next) — code exists, needs testing and PROJECT.md status update.

### DEFER-2: Log.yml 50KB size warning in status skill

- **Issue**: Spec (line 928) defines a size warning. `skills/status/SKILL.md` does not implement it.
- **Impact**: Low. Single-user workflows unlikely to approach threshold. Multi-lifecycle users accumulate telemetry with no warning.
- **Priority**: v1.1 (next)

### DEFER-3: Artifact-based state reconstruction in status skill

- **Issue**: Spec (line 925-926) describes status skill reconciling stale state by checking artifact existence. Implementation only reads and displays `state.yml` — no reconciliation.
- **Impact**: Low. If `state.yml` becomes stale (e.g., manual edit), status cannot self-correct. User must manually fix or rely on `.bak`.
- **Priority**: v1.1 (next)

### DEFER-4: Automatic fallback to state.yml.bak on corruption

- **Issue**: Backup file is created before every write (42 instances verified) but no skill reads `.bak` for automatic recovery. It exists only as a manual recovery option.
- **Impact**: Low. Corruption is low-probability given the backup-before-write discipline. When it happens, user must manually rename `.bak`.
- **Priority**: v1.2 (later)

### DEFER-5: Codebase analyst subagent_type change to "explore"

- **Issue**: `prompt-codebase-analyst.md` uses `subagent_type: general-purpose` instead of spec's `explore`. The `explore` type has built-in codebase navigation tools that `general-purpose` lacks.
- **Impact**: Low. Codebase analyst works with `general-purpose` + `<self_contained_reads>`, but `explore` would give it purpose-built tools.
- **Priority**: v1.2 (later) — requires testing whether `explore` subagent type actually improves codebase research quality.

### DEFER-6: Design/plan alternative-surfacing for decision-over-task philosophy

- **Issue**: Design Step 7 and Plan Step 6 revision cycles are "approve what I generated" rather than "choose between alternatives." This is the weakest decision-over-task alignment in the plugin (DA-5 finding).
- **Impact**: Medium. Users review single proposals instead of choosing between design alternatives. Contrasts with spike skill, which presents alternatives with tradeoffs.
- **Priority**: v1.2 (later) — would require significant redesign (e.g., research-engine's multi-subagent design pattern with confidence auditor and decision resolver). Acceptable limitation for now given that generative phases inherently require a proposal before evaluation.

### DEFER-7: SessionStart hook

- **Issue**: No automatic context injection for natural-language requests in new sessions. Users must invoke a `/expedite:*` command or run `/expedite:status` manually.
- **Impact**: Medium. Workaround exists (2-layer fallback) but new-session UX is degraded.
- **Priority**: v2 — blocked by Claude Code platform bugs.

### DEFER-8: Connected Flow import

- **Issue**: Stub in scope Step 2. Reserved fields in `state.yml.template` (`imported_from`, `constraints`). No cross-lifecycle artifact import.
- **Impact**: Low for v1 — no users have cross-lifecycle workflows yet.
- **Priority**: v2

### DEFER-10: Split state.yml into scoped files

- **Issue**: `state.yml` serves both tracking (phase, current_task — ~15 lines) and data storage (questions[], tasks[], gate_history[] — up to 300+ lines). Every skill injects the full file via `!cat .expedite/state.yml` regardless of what it needs, paying ~2-3K tokens per invocation for data it won't use.
- **Impact**: Low now, degrades with project complexity. A 20-question, 20-task lifecycle produces a ~400-line state.yml injected into every skill call.
- **Recommended fix**: Split into `state.yml` (phase/tracking only, ~15 lines, injected everywhere), `questions.yml` (scope/research only), `tasks.yml` (plan/spike/execute only), `gate_history.yml` (gates/status only). Same backup-before-write protocol, same flat structure, scoped `!cat` injection per skill.
- **Priority**: v1.2 (later) — not urgent until real usage shows bloat causing context pressure.

### DEFER-11: Step-level tracking for user orientation

- **Issue**: Users see only `scope_in_progress` — no indication of where they are within a skill (e.g., "scope: step 5 of 9"). Resume logic infers position indirectly (if questions exist, skip to Step 6) rather than tracking explicit step completion. Getting lost mid-skill with no orientation is a real UX problem.
- **Impact**: Medium. Users lose orientation during long skills (scope has 9 steps, research has 18). After a `/clear` or session restart, there's no way to know which step was last completed without reading artifacts.
- **Recommended fix**: Add `current_step: { skill: "scope", step: 5, label: "Adaptive Refinement" }` to state.yml (or the split tracking file from DEFER-10). Update each skill to write step progress on entry to each numbered step. Status skill displays "scope: step 5 of 9 — Adaptive Refinement."
- **Priority**: v1.1 (next) — most user-facing of the gaps.

### DEFER-12: DA readiness criterion enforcement across all gates (G2-G5)

- **Issue**: Every gate checks whether DAs are structurally present (does DA-3 have a section?) but none check whether DA readiness criteria from SCOPE.md are actually satisfied. Readiness criteria are defined at G1 and never referenced again. The contract chain validates structure but not substance.
  - **G2**: Research synthesizer flags "readiness criterion: MET / NOT MET" per DA, but the gate doesn't block on unmet criteria. Checks question coverage counts, not evidence quality against specific requirements.
  - **G3**: Checks DA has a design section with evidence citations, but not that cited evidence meets the DA's specific readiness criterion (e.g., "2+ implementation examples with benchmarks").
  - **G4**: Checks tasks trace to DAs, but not that tasks address the DA's evidence gaps or trade-offs. No sizing adjustment for DA depth calibration (Deep vs Light).
  - **G5**: Checks spike steps trace to TDs/DAs, but not that spike investigation actually resolved the ambiguity that triggered the spike.
- **Impact**: Medium-High. Structural validation creates a false sense of contract chain integrity. Each gate says "DA-3 is covered" when it really means "DA-3 has a section" — not "DA-3's readiness criterion is satisfied."
- **Recommended fix**: Add a MUST criterion to each gate that validates substantive DA satisfaction:
  - **G2**: "Every DA readiness criterion from SCOPE.md marked MET in SYNTHESIS.md, or explicit user acknowledgment of unmet criteria."
  - **G3**: "Every design decision cites evidence that addresses the DA's readiness criterion, not just any evidence."
  - **G4**: "Task coverage accounts for DA depth calibration — Deep DAs get proportionally more thorough coverage."
  - **G5**: "Spike resolution directly addresses the ambiguity identified in the plan's 'needs-spike' classification."
- **Priority**: v1.1 (next) — G2 fix is small (existing synthesizer output just needs enforcement). G3-G5 require adding readiness criterion cross-references to gate evaluation logic.

### DEFER-13: External verifier agent for research reasoning soundness

- **Issue**: The sufficiency evaluator checks evidence presence via a 3-dimension rubric (coverage, corroboration, actionability) but does not verify reasoning soundness — whether conclusions follow from evidence, whether contradictions are resolved, or whether extrapolations are warranted. No GSD-style goal-backward verification exists.
- **Impact**: Medium. Rubric validation catches "did you find evidence?" but misses "does your evidence actually support your conclusion?" Subtle reasoning failures (confirmation bias, over-extrapolation from single sources) pass unchallenged.
- **Recommended fix**: Add a second verification layer: spawn an external verifier agent (like GSD's `gsd-verifier` pattern) after synthesis that checks logical soundness — does each conclusion follow from cited evidence? Are contradictions acknowledged? Are confidence levels honest? Two layers: rubric validation (existing) + reasoning validation (new).
- **Priority**: v1.2 (later) — requires new prompt template and dispatch logic. The rubric evaluator covers the most common failure mode (missing evidence) already.

### DEFER-14: Per-task atomic git commits during execute phase

- **Issue**: The execute skill has no git integration. Code changes produced during execution are uncommitted — the user must manually commit after each task or at the end. No git history maps back to individual tasks or DAs.
- **Impact**: Medium. Without per-task commits, users can't `git bisect` to find which task introduced a bug, can't cleanly revert a single task's changes, and lose the traceability link between git history and the expedite lifecycle.
- **GSD pattern (reference)**: GSD commits per-task with conventional commit format (`feat(08-02): description`), stages specific files (never `git add .`), and tracks commit hashes in state. Planning docs commit is configurable (`commit_docs` setting). Branching strategy is configurable (none/phase/milestone). No rollback — completed commits stay; resume skips completed tasks.
- **Recommended fix**: Add per-task git commit to execute skill after task verification passes. Format: `{type}(DA-{N}): {task description}`. Stage only files touched by that task. Add `commit_docs` equivalent for `.expedite/` artifacts. Make git integration optional (some users may want manual control).
- **Priority**: v1.2 (later) — execute skill works without it, but git integration would significantly improve the development workflow and traceability story.

### DEFER-9: Malformed YAML handling

- **Issue**: No explicit malformed-YAML handling in any SKILL.md. If `state.yml` contains invalid YAML, the `!cat` injection parse fails with no graceful recovery path.
- **Impact**: Low probability, medium severity when it occurs. User would need to manually fix or restore from `.bak`.
- **Priority**: Nice-to-have — combine with DEFER-4 (.bak auto-fallback) as a single resilience improvement.

---

## 5. Version Label Recommendation

**Recommendation: Update to 1.0.0.**

Reasoning:
- 92/92 self-defined requirements verified across 3 audit cycles
- 21/29 spec decisions match exactly; remaining 8 are documented evolutions/deferrals except 1 (which FIX-3 addresses)
- Zero production blockers identified across all 10 decision areas
- State management, template architecture, structural correctness, and research orchestration all rated "Excellent" or "Strong"
- The 0.1.0 label actively misleads consumers about the plugin's maturity
- The 3 "Fix Now" items are all low-effort (version bump, .gitignore, one paragraph of documentation) and don't represent functional deficiencies
