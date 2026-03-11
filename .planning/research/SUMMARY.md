# Project Research Summary

**Project:** Expedite Plugin v1.2 — Infrastructure Hardening & Quality
**Domain:** Claude Code plugin infrastructure hardening (state resilience, state splitting, skill sizing, git commits, research verification, alternative surfacing)
**Researched:** 2026-03-11
**Confidence:** MEDIUM (codebase analysis is HIGH confidence; external documentation for explore subagent type unavailable — WebSearch denied during research)

## Executive Summary

Expedite v1.2 is a structural hardening release for a Claude Code plugin that orchestrates a 7-skill software development lifecycle (scope -> research -> design -> plan -> spike -> execute). The milestone delivers on two promises: infrastructure hardening (state resilience, state splitting, skill sizing) and quality elevation (git traceability, reasoning verification, conditional alternatives). Research confirms all 7 features are implementable within the existing platform — no external dependencies, no new runtimes, no new tools — using only pattern extensions to the proven Markdown/YAML architecture. The critical dependency chain is: state recovery must land before state splitting, and state splitting must stabilize before skill line limit extraction.

The recommended build order, derived from pitfall analysis across 21 identified pitfalls, is: State Recovery first (foundation, additive-only), then Explore Subagent (trivial isolated change), then State Splitting (high blast radius, must land after recovery provides a safety net), then Skill Line Limit (skills should be in final form before splitting), then Git Commits and Verifier Agent, and finally Conditional Alternatives (design/plan generation logic is last to be modified). The biggest execution risks are state splitting (touches all 7 skills via the `!cat` injection contract) and the verifier agent (dual-evaluation authority must be designed upfront to prevent infinite recycle loops). Both are solvable with known patterns from the existing codebase.

The one open question that could affect scope: whether state splitting belongs in v1.2 at all. The current monolithic state.yml is operationally functional; the problem is per-invocation token waste. The split has the highest blast radius of any feature — two of the six critical pitfalls (P1: injection contract breakage, P2: migration data loss) are exclusively attributable to it. If scope pressure appears during execution, state splitting is the feature most worth deferring.

---

## Key Findings

### Recommended Stack

Expedite v1.2 introduces zero new external dependencies. The "stack" is the Claude Code plugin platform itself: SKILL.md orchestrators, Task() subagent dispatch, YAML state files, Markdown reference templates, and Bash tool access. This is both a constraint (no npm packages, no database, no server) and a strength (no new failure modes, no additional maintenance surface).

**Core technologies:**
- **SKILL.md orchestrators** — skill definitions executing in Claude Code's plugin runtime — the only viable orchestration mechanism on this platform
- **YAML state files** (flat, max 2 nesting levels, complete-file rewrite semantics) — state persistence via backup-before-write pattern already universal at 42 write sites
- **Markdown reference files in `references/`** — proven extraction target; research SKILL.md went from 1233 to 611 lines using this pattern
- **Task() subagent API** (prompt, description, subagent_type, model) — proven for parallel research dispatch; verifier agent uses same mechanism
- **Bash tool** (already in execute's allowed-tools) — git integration point; no new tooling needed

**Stack additions for v1.2 (pattern changes, not technology changes):**
- `ref-state-recovery.md` in `skills/shared/` — centralized recovery protocol, invoked by each skill's Step 1
- `questions.yml`, `tasks.yml`, `gates.yml` — scoped state arrays split from monolithic state.yml, same YAML patterns and backup-before-write discipline
- `prompt-research-verifier.md` — new template following the 8-section XML structure used by existing 9 templates
- `subagent_type: explore` in codebase analyst frontmatter — LOW confidence, requires a validation spike before committing

### Expected Features

**Must have (infrastructure hardening promise):**
- **State recovery (RESL-01/02)** — backup-before-write exists at 42 sites with zero read sites; adding recovery closes the loop on resilience. Without it, the "backup" feature is theater.
- **State splitting (ARCH-02)** — monolithic `!cat state.yml` wastes 2-3K tokens per invocation on data skills don't use; 60-90% token savings per skill invocation after split
- **Skill line limit (500-line soft cap)** — 6 of 7 skills exceed the limit; proven extraction pattern eliminates the concern

**Should have (quality elevation promise):**
- **Per-task atomic git commits (DEVW-01)** — closes the contract traceability chain at the last mile (scope DA -> design decision -> plan task -> git commit); highest user-visible value of the quality features
- **Codebase analyst explore subagent (ARCH-01)** — single-line change; lowest risk; validates a deferred assumption from v1.0 Phase 3

**Can defer to v1.3 if scope pressure requires:**
- **External verifier agent (QUAL-01)** — existing rubric evaluator covers the common failure mode; verifier adds reasoning soundness checking (refinement, not gap). The sufficiency evaluator already implements Layer 1 (rubric validation); verifier is Layer 2 (reasoning validation).
- **Conditional alternative-surfacing (QUAL-02)** — current propose-and-revise flow works; alternatives are philosophical alignment improvement, not a functional gap

**Anti-features to avoid:**
- Unconditional alternative surfacing — creates decision fatigue when evidence is already clear
- Auto git push — removes user control over when to share commits
- Making verifier a MUST gate criterion from day one — needs calibration; blocking gate causes override-training behavior
- Mandatory git integration — some users want manual commit control

### Architecture Approach

The architecture strategy: centralize new infrastructure (recovery, state coordination) in shared reference files, modify skills minimally (injection pattern changes, new sub-steps), and extract content to per-skill `references/` directories. State splitting follows the manifest pattern: `state.yml` remains the single `!cat` injection target containing all routing fields, while scoped files (`questions.yml`, `tasks.yml`, `gates.yml`) hold array data and are read explicitly by skills that need them.

**Major components:**
1. **`state.yml` (tracking)** — phase, current_step, lifecycle identity (~15 lines); injected by all 7 skills via `!cat`; manifest for routing decisions
2. **`questions.yml`, `tasks.yml`, `gates.yml` (new)** — scoped array data; injected only by skills that need them; each with its own `.bak`
3. **`skills/shared/ref-state-recovery.md` (new)** — centralized YAML validation + .bak fallback protocol; referenced by all 7 skills' Step 1
4. **`skills/execute/references/ref-git-commit.md` (new)** — per-task commit protocol at sub-step 5e.5; handles staging, commit message template, skip conditions
5. **`skills/research/references/prompt-research-verifier.md` (new)** — reasoning soundness verification template; dispatched as Task() after synthesis (Step 12.5); advisory-only for G2 gate
6. **Extracted `ref-*.md` files (new, per skill)** — self-contained content moved from oversized skills; SKILL.md retains step structure, references hold the detailed HOW

**Key patterns to follow:**
- Centralized reference with per-skill invocation (DRY for cross-cutting logic like recovery)
- Scoped `!cat` injection (each skill specifies exactly which state files to load)
- Backup-before-write extended to all scoped files (not just state.yml)
- Task() subagent with self-contained reads (verifier reads its own inputs, keeps orchestrator context lean)
- Extract within steps, not across steps (step numbering and status skill lookup table must remain unchanged)

### Critical Pitfalls

1. **State splitting breaks `!cat` injection contract (P1, Critical)** — every skill opens with `!cat .expedite/state.yml`; splitting must keep all routing fields in a single file. Prevention: manifest pattern — `state.yml` retains phase, current_step, lifecycle_id, and all fields needed for Case A/B/C routing; scoped files hold array data only. Audit all 7 injection points before any splitting begins.

2. **State splitting causes data loss during migration (P2, Critical)** — active lifecycles have questions/tasks/gates embedded in monolithic state.yml; new code that writes only to scoped files orphans existing arrays. Prevention: `state_version: 2` field; one-time migration check at skill entry; backup monolithic state.yml before migration; never assume the split has happened.

3. **Verifier agent creates infinite recycle loops (P4, Critical)** — reasoning soundness assessment does not converge like rubric coverage does; repeated re-research can produce new issues each round. Prevention: verifier is NEVER a gate blocker; on research_round > 1, verifier output is annotation-only; count verifier recycles in the same escalation counter as evaluator recycles.

4. **Git commits stage wrong files (P5, Critical)** — naive `git add -A` captures `.expedite/` state files alongside implementation code; reverting a bad commit also reverts lifecycle state. Prevention: explicit per-task staging using only the task's "Files modified" list; validate no `.expedite/` paths in staged files before every commit.

5. **Verifier authority conflict with sufficiency evaluator (P3, Critical)** — if verifier can override evaluator's COVERED rating, gate trust erodes; if it cannot, it gets ignored. Prevention: define authority hierarchy before implementation — sufficiency evaluator owns Go/Recycle; verifier produces advisory `reasoning_soundness` in a separate output file; both appear in G2 gate display.

6. **Partial YAML writes produce silently incomplete state (P11, Moderate)** — truncated YAML can be syntactically valid, producing missing-field state without error. Prevention: add `_write_complete: true` as the last field in every write; if absent after read, fall back to .bak.

---

## Implications for Roadmap

Based on combined research, suggested phase structure (7 features across 6 implementation phases):

### Phase 1: State Recovery
**Rationale:** Foundation layer. Every subsequent feature benefits from automatic corruption recovery. Additive-only — does not change any existing write paths or injection contracts. Smallest scope, highest safety return. If anything goes wrong during later high-risk phases, recovery is already in place.
**Delivers:** YAML validation at every skill entry, .bak auto-restore, artifact-based reconstruction fallback, `_write_complete` sentinel
**Addresses:** Table stakes features RESL-01/02; pitfalls P9 (.bak one write behind), P10 (both files corrupted), P11 (partial writes), P21 (mid-skill recovery)
**Avoids:** Mid-skill recovery triggering (P21 — recovery is Step 1 only; mid-skill read errors become STOP, not auto-recover)

### Phase 2: Explore Subagent Validation
**Rationale:** One-line change with empirical testing. Isolated to a single file. No interaction with any other feature. Ship and validate early so any unexpected tool availability issues are discovered before higher-complexity features land.
**Delivers:** Codebase analyst switched to `explore` subagent type; validated that evidence quality is preserved or improved
**Addresses:** SHOULD feature ARCH-01
**Avoids:** P12 (format mismatch from subagent type change) — test with existing prompt template before deploying; revert via one-line change if Write tool is unavailable in explore mode
**Research flag:** Needs empirical validation via a spike task — spawn a test `explore`-type Task() and verify Write, Read, Glob, Grep, Bash are all available. If Write is unavailable, the feature must be abandoned entirely.

### Phase 3: State Splitting
**Rationale:** High blast radius — touches all 7 skills' `!cat` injection lines, all 4 template files, and the status skill's cross-referencing logic. Must land after recovery (Phase 1) provides a safety net. Must land before skill line limit extraction so extraction does not have to account for both content changes and injection pattern changes in the same files simultaneously.
**Delivers:** Scoped `!cat` injection (60-90% token savings per skill invocation), `questions.yml`, `tasks.yml`, `gates.yml` split from monolithic state.yml, migration logic for active lifecycles
**Addresses:** Table stakes feature ARCH-02; pitfalls P1, P2
**Avoids:** P1 (injection contract) — manifest pattern keeps all routing fields in state.yml; P2 (migration data loss) — state_version field + one-time migration at skill entry; P18 (race conditions) — documented limitation, not mitigated in code

### Phase 4: Skill Line Limit
**Rationale:** All 6 over-limit skills should be in final post-splitting form before extraction. The injection pattern changes from Phase 3 settle the baseline each skill file will be measured against. Extraction is a proven pattern with no behavioral changes.
**Delivers:** All 7 skills under 500-line soft cap via references/ extraction; SKILL.md becomes a lean orchestrator for each skill
**Addresses:** Table stakes feature (skill sizing); pitfalls P7, P8, P19
**Avoids:** P7 (step renumbering) — extract within steps (content moves to reference, step heading stays in SKILL.md); P8 (injection ordering) — extracted references never read state.yml directly; P19 (subagent templates) — never extract prompt-*.md files, which are already references

### Phase 5: Per-Task Git Commits
**Rationale:** Isolated to execute SKILL.md (new sub-step 5e.5). Benefits from stable state management (Phase 3 settled) for commit_sha tracking in checkpoint.yml. Highest user-visible value of the quality features; extends the DA traceability chain from code to git history.
**Delivers:** Atomic git commits after each verified task, `{type}(DA-N): task_description` format, specific file staging only, opt-out mechanism, directory validation before first commit
**Addresses:** SHOULD feature DEVW-01; pitfalls P5, P6, P15, P16, P20
**Avoids:** P5 (wrong files staged) — explicit file list from task definition only; P6 (wrong directory) — `git rev-parse --show-toplevel` validation before first commit; P15 (merge conflicts) — classify git errors separately from task errors; P16 (sensitive files) — reject `.env`, `*.key`, `*.pem` patterns
**Open decision to resolve during planning:** Auto-commit vs advisory-commit for v1.2. PITFALLS.md (P15) suggests advisory mode (display commit command, user runs it) may be more robust given git error handling complexity in the execute loop.

### Phase 6: Verifier Agent + Conditional Alternatives
**Rationale:** Both features modify research and design/plan skills respectively, which should be stable post-extraction (Phase 4). Grouped because both are advisory-quality features that require careful authority boundary definition before implementation. Verifier adds reasoning layer to research flow; conditional alternatives adds choice layer to design generation.
**Delivers:** Research reasoning soundness verification (Task() subagent, advisory G2 SHOULD criterion S4), conditional alternative surfacing in design/plan when SYNTHESIS.md shows genuine tradeoffs (weak corroboration OR contradicting sources)
**Addresses:** DEFER features QUAL-01 and QUAL-02; pitfalls P3, P4, P13, P14, P17
**Avoids:** P3 (authority conflict) — verifier writes to `verification-results.yml` only, advisory; P4 (infinite loops) — verifier is annotation-only on round 2+; P13/P14 (over/under-trigger) — use evidence signals (corroboration level + contradictions from SYNTHESIS.md) as trigger, not new LLM judgment

### Phase Ordering Rationale

The ordering follows three dependency chains identified across all 4 research files:
- **State Recovery before State Splitting** — recovery logic differs between monolithic and split formats; implement once against the final format, not twice
- **State Splitting before Skill Line Limit** — skills should be in their final post-splitting form (settled injection patterns) before content is extracted; avoids double-editing each skill file
- **All infrastructure before quality features** — verifier and alternatives rely on stable state reads and settled skill sizes from Phases 1-4

The PITFALLS.md recommended build order (State Recovery, Explore, State Splitting, Skill Line Limit, Git Commits, Verifier, Alternatives) maps directly to these 6 phases, with Explore compressed into Phase 2 (trivial, isolated) and Verifier + Alternatives grouped into Phase 6 (both advisory-quality modifications to generation logic that share a design concern: authority boundaries and trigger conditions).

### Research Flags

Phases needing deeper research during planning:
- **Phase 2 (Explore Subagent):** `explore` subagent type tool set is unverified. External documentation was unavailable (WebSearch denied). Needs a validation spike: spawn a test `explore`-type Task() and verify Write tool access (codebase analyst must write evidence files to disk). If Write is unavailable, abandon the feature.
- **Phase 5 (Git Commits):** Advisory vs auto-commit decision needs resolution before implementation. Also needs verification that `.expedite/` is in the project's `.gitignore` — if not, P5 (wrong files staged) becomes a blocking pre-commit concern.
- **Phase 6 (Verifier Agent):** Prompt engineering quality for reasoning soundness assessment cannot be validated without running real lifecycles. The template needs iteration. Start with SHOULD classification in G2, observe calibration over 3+ lifecycles, then consider promoting to MUST.

Phases with standard patterns (research-phase can be skipped):
- **Phase 1 (State Recovery):** Pattern is additive to proven backup-before-write. No architectural novelty. Implementation instructions fully specified in ARCHITECTURE.md Q1.
- **Phase 3 (State Splitting):** Split structure and injection patterns fully specified in ARCHITECTURE.md Q2. Execution risk is high but design is complete.
- **Phase 4 (Skill Line Limit):** Identical pattern to the research SKILL.md refactor (1233 to 611 lines). Extraction rules fully specified in ARCHITECTURE.md Q3.

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All findings from direct codebase analysis of 5,968 LOC; no external dependencies to verify |
| Features | MEDIUM | Feature specs derived from codebase + prior audit artifacts (DEFER analysis); WebSearch unavailable for external validation of explore subagent type |
| Architecture | HIGH | All patterns derived from working v1.0/v1.1 implementation; injection contract, backup-before-write, and extraction pattern all verified in codebase |
| Pitfalls | HIGH | 21 pitfalls derived from direct codebase analysis (42 backup-before-write instances, 7 !cat injection points, step numbering logic); not hypothetical concerns |

**Overall confidence:** MEDIUM-HIGH (architecture and pitfalls are HIGH; stack/features are MEDIUM due to inaccessible external documentation for explore subagent type)

### Gaps to Address

- **Explore subagent tool set:** Exact capabilities of `explore` type are unknown. Training data suggests codebase navigation tools, but Write access (required for evidence files) is unverified. Validate empirically via a spike in Phase 2 planning before committing to the change.
- **State splitting necessity:** PITFALLS.md open question — does state splitting belong in v1.2? Current monolithic state.yml is under YAML complexity limits; the motivation is token waste per invocation. Confirm this is a v1.2 commitment before planning Phase 3 in detail. If deferred, Phase 4 (skill sizing) becomes Phase 3 and the roadmap simplifies significantly.
- **Advisory vs auto-commit for git integration:** Open decision in both FEATURES.md and PITFALLS.md. P15 (merge conflict handling) suggests advisory mode is more robust for v1.2. Resolve during Phase 5 planning before implementation begins — this affects the implementation approach substantially.
- **Verifier prompt engineering quality:** Cannot be validated without real lifecycle runs. Start with SHOULD classification, observe calibration over 3+ lifecycles before any promotion to MUST gate criterion. Design the prompt with this iteration expectation built in.

---

## Sources

### Primary (HIGH confidence — direct codebase analysis)
- `skills/*/SKILL.md` — all 7 skill orchestrators, 5,968 LOC total
- `skills/research/references/*` — 8 reference files (5 prompt templates + 3 inline refs)
- `templates/state.yml.template` — state schema with field comments
- `.planning/research/expedite-audit/AUDIT-ACTIONS.md` — source for all 7 features (DEFER-4/5/6/9/10/13/14 analysis)

### Secondary (MEDIUM confidence — prior research artifacts)
- `memory/phase5-verifier-design.md` — verifier agent two-layer design decision (rubric + reasoning)
- `memory/plan-spike-execute-architecture.md` — Plan/Spike/Execute architecture
- `.planning/milestones/v1.0-phases/03-prompt-template-system/03-RESEARCH.md` — original explore vs general-purpose decision (conservative choice; reason to revisit in v1.2)
- `.planning/research/arc-implementation/design/PRODUCT-DESIGN.md` — original explore subagent type specification (line 565)
- `.planning/PROJECT.md` — constraints and key design decisions

### Tertiary (LOW confidence — training data, requires validation)
- Claude Code plugin platform documentation on `explore` subagent type capabilities — web research unavailable; training data suggests built-in codebase tools but exact tool set (especially Write access) is unverified

---
*Research completed: 2026-03-11*
*Ready for roadmap: yes*
