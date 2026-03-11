# Feature Landscape

**Domain:** Claude Code plugin infrastructure hardening and quality elevation (v1.2)
**Researched:** 2026-03-11
**Confidence:** MEDIUM (WebSearch denied; all findings from codebase analysis, prior audit artifacts, and training data)

## Table Stakes

Features that must ship for v1.2 to deliver on "infrastructure hardening." Without these, the milestone label is misleading.

| Feature | Why Expected | Complexity | Dependencies | Notes |
|---------|--------------|------------|--------------|-------|
| State recovery (RESL-01 + RESL-02) | .bak exists at 42 write sites but zero read sites. Users must manually rename on corruption. Backup-before-write created the safety net; recovery closes the loop. | Low-Medium | None standalone, BUT should coordinate with state split (recovery must know which files to recover) | Every skill already does `cp state.yml state.yml.bak`. Recovery adds read-on-failure at the `!cat` injection point or early in Step 1. |
| Split state.yml (ARCH-02) | state.yml serves dual roles: tracking (~15 lines) and data storage (questions[], tasks[], gate_history[] -- up to 300+ lines). Every skill injects the full file via `!cat` regardless of what it needs, wasting 2-3K tokens per invocation. | Medium-High | Must ship BEFORE or WITH state recovery (recovery logic must know which files to recover) | Scoped `!cat` injection per skill. Audit confirmed DEFER-10 analysis is sound. |
| Skill line limit (500-line soft cap) | Research SKILL.md already hit 1233 lines and was refactored to 611 via references/ extraction. Other skills (design: ~475, execute: ~594, scope: ~500+) are approaching or at the threshold. Without a cap, skills become unreadable and blow context windows. | Low-Medium | Independent -- each skill is a self-contained extraction | Proven pattern exists: research SKILL.md 1233->611 extraction. Apply same pattern to other skills. |

## Differentiators

Features that significantly elevate quality but the plugin works fine without them. These make v1.2 a meaningful quality release.

| Feature | Value Proposition | Complexity | Dependencies | Notes |
|---------|-------------------|------------|--------------|-------|
| Per-task atomic git commits (DEVW-01) | Closes the traceability gap: scope DA -> design decision -> plan task -> code change -> **git commit**. Without this, the contract chain breaks at the last mile. Users cannot `git bisect` to a specific task, cannot revert a single task, lose DA traceability in git history. | Medium | Depends on execute skill; independent of other v1.2 features | GSD reference pattern: `feat(DA-N): task description`, stage specific files (never `git add .`), optional `commit_docs` for .expedite/ artifacts. Must be opt-out (some users want manual git control). |
| External verifier agent (QUAL-01) | Adds reasoning soundness checking that the sufficiency evaluator cannot provide. Sufficiency evaluator checks "did you find evidence?" -- verifier checks "does your evidence support your conclusion?" Catches confirmation bias, over-extrapolation, unresolved contradictions. | Medium | Depends on research skill dispatch pipeline (Task() subagent pattern); runs after synthesis, before G2 gate | New prompt template + dispatch step. Two validation layers: rubric (existing) + reasoning (new). |
| Conditional alternative-surfacing (QUAL-02) | Design and plan revision cycles are "approve what I generated" rather than "choose between alternatives." This is the weakest decision-over-task alignment in the plugin (DA-5 finding from audit). Surfacing alternatives only when genuine tradeoffs exist maintains the philosophy without creating decision fatigue. | Medium-High | Depends on design and plan skills; runs during Step 4 (design generation) and Step 7 (revision cycle) | Must be conditional -- not all DAs have genuine alternatives. Forced alternatives for clear-cut decisions waste time and introduce doubt. |
| Codebase analyst explore (ARCH-01) | The `explore` subagent type provides purpose-built codebase navigation tools that `general-purpose` lacks. Since the codebase analyst does NOT use MCP tools, the platform constraint requiring general-purpose does not apply. | Low | Independent -- single frontmatter change + testing | Risk: `explore` may restrict Bash or other tools the analyst currently uses. Needs verification before switching. |

## Anti-Features

Features to explicitly NOT build.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Unconditional alternative-surfacing | Presenting 3 alternatives for every DA regardless of evidence strength creates false equivalence and decision fatigue. When evidence clearly points one direction, forcing alternatives undermines confidence. | Surface alternatives ONLY when evidence shows genuine tradeoffs (multiple approaches with different strength profiles) or when confidence is Medium/Low. Clear-cut decisions get the current "propose + revise" flow. |
| Automatic git push after commit | Push is a team-coordination action. Auto-pushing removes the user's ability to review commits, amend messages, or squash before sharing. | Commit only. User pushes when ready. |
| state.yml.bak rotation (multiple backups) | Over-engineering for a low-probability event. One backup covers the common case (last write corrupted). Multiple backups add complexity for no real benefit in a single-user workflow. | Keep single .bak per file. If user needs older state, git history has it. |
| Mandatory git integration | Some users want manual git control, work on non-git projects, or commit in larger batches. Forcing per-task commits on everyone alienates these users. | Git commits are opt-out: enabled by default but a simple skip/disable mechanism exists. |
| Full state.yml schema migration | Splitting state.yml into multiple files does NOT require migrating existing in-flight lifecycles. Old single-file format can coexist with new split format. | Read from new split files if they exist, fall back to monolithic state.yml if it exists. One-time split on first write after upgrade. |
| Verifier agent blocking G2 gate | The reasoning verifier is advisory, not blocking. Making it a gate blocker means subjective reasoning judgments can prevent progress, which conflicts with the existing override philosophy. | Verifier findings surface as advisories in the G2 gate display. If reasoning issues are severe, the user sees them and can choose to recycle or override -- same as existing gate flow. |

## Feature Dependencies

```
Split state.yml (ARCH-02) ──→ State recovery (RESL-01/02)
  Recovery must know which files to recover. If we split first,
  recovery covers the new file layout. If we recover first, we
  must refactor recovery when we split. Ship together or split first.

Split state.yml (ARCH-02) ──→ touches ALL skills (!cat injection lines)
                           ──→ touches status skill (artifact cross-reference)
                           ──→ touches state template

Skill line limit ──── independent (each skill is self-contained extraction)

Per-task git commits (DEVW-01) ──→ execute SKILL.md Step 5d/5e
                                ──── independent of state changes

External verifier (QUAL-01) ──→ research SKILL.md (new step between synthesis and G2)
                             ──→ new prompt template in references/

Conditional alternatives (QUAL-02) ──→ design SKILL.md Step 4 + Step 7
                                    ──→ plan SKILL.md Step 3 + Step 6

Codebase analyst explore (ARCH-01) ──── independent (single frontmatter change + testing)
```

**Critical dependency chain:**
```
Split state.yml → State recovery → (all other features proceed in parallel)
```

## Detailed Feature Behaviors

### 1. State Recovery (RESL-01 + RESL-02)

**Expected UX:** User invokes any `/expedite:` command. The `!cat .expedite/state.yml` injection at the top of every SKILL.md returns malformed YAML or an empty/corrupted file. Instead of the skill crashing or producing nonsensical output, recovery kicks in automatically.

**Behavior:**
1. **Detection:** The skill's Step 1 (Prerequisite Check) reads state.yml. If the YAML parse fails (syntax error, truncated file, empty content), trigger recovery.
2. **Auto-recovery from .bak:** Read `.expedite/state.yml.bak`. If .bak is valid YAML, copy it over state.yml and display: `"Warning: state.yml was corrupted. Recovered from backup. Last known state: {phase}."`
3. **Fallback -- artifact-based reconstruction:** If .bak is also corrupt or missing, attempt reconstruction using artifact existence (same mapping as status skill STAT-02: SCOPE.md exists = at least scope_complete, SYNTHESIS.md = at least research_complete, etc.). Display: `"Warning: Both state.yml and backup corrupted. Reconstructed state from artifacts. Inferred phase: {phase}. Some tracking data (questions, gate_history) may be lost."`
4. **Unrecoverable:** If no .bak and no artifacts: `"Error: state.yml corrupted and no recovery sources available. Start a new lifecycle with /expedite:scope."`

**Where it lives:** Detection logic in every skill's Step 1 (or a shared preamble pattern referenced by each skill). Recovery logic is brief (~20-30 lines of decision tree) and can be inline or a short reference file.

**Complexity:** Low-Medium. The detection and .bak fallback are straightforward. Artifact-based reconstruction is harder but the status skill already has the artifact-to-phase mapping (Step 5 in status SKILL.md).

### 2. Split state.yml into Scoped Files (ARCH-02)

**Expected UX:** Transparent to the user. No behavioral change. Skills load faster because they inject only the state they need.

**Proposed file split:**
- **state.yml** (~15 lines): version, last_modified, project_name, intent, lifecycle_id, description, phase, current_task, current_step, current_wave, research_round. Injected by ALL skills via `!cat`.
- **questions.yml**: questions[] array. Injected by scope (writes), research (reads/writes), design (reads), status (reads).
- **tasks.yml**: tasks[] array. Injected by plan (writes), spike (reads), execute (reads/writes), status (reads).
- **gates.yml**: gate_history[] array. Injected by research (writes), design (reads/writes), plan (reads/writes), spike (reads/writes), execute (reads), status (reads).

**Protocol:** Each file uses the same backup-before-write pattern: `cp X.yml X.yml.bak` before every write. Each skill's `!cat` injection line changes from one file to the specific files it needs.

**Migration path:** New lifecycles create the split files. If a skill encounters a monolithic state.yml with questions[] inside it (old format), it splits on first access: extract questions/tasks/gates into separate files, rewrite state.yml as tracking-only.

**Where it lives:** Changes to every SKILL.md `!cat` injection line, state.yml.template split into 4 templates, scope Step 2 (lifecycle initialization) creates all 4 files.

**Complexity:** Medium-High. The split itself is mechanical, but it touches every skill file and must maintain backup-before-write discipline across 4 files instead of 1. The coordination audit (verifying no skill reads a field from the wrong file) is the real complexity.

### 3. Skill Line Limit (500-line soft cap)

**Expected UX:** No user-facing change. Skills behave identically but their SKILL.md files are shorter and more readable. Extracted content lives in references/ and is loaded at runtime.

**Behavior:**
- Identify skills exceeding ~500 lines (execute: ~594, research: ~611 post-refactor, scope: ~500+, design: ~475 but growing).
- For each over-limit skill, identify content that is reference material vs orchestration logic:
  - **Gate evaluation criteria** (MUST/SHOULD tables): extract to `references/ref-gate-criteria.md`
  - **Output format templates** (PROGRESS.md format, checkpoint.yml format): extract to `references/ref-output-formats.md`
  - **Long inline instructions** (error handling protocols, archival flow): extract to `references/ref-{topic}.md`
- SKILL.md retains step logic, flow control, state transitions, and user interaction. References contain the "what" (formats, criteria, protocols).
- Skills reference extracted content: "Read `skills/{skill}/references/ref-gate-criteria.md` for the G{N} gate criteria."

**Proven pattern:** Research SKILL.md went from 1233 to 611 lines using exactly this approach. Prompts for subagents (web researcher, codebase analyst, sufficiency evaluator, synthesizer) were extracted to `references/prompt-*.md`. The SKILL.md became a lean orchestrator. This is the established convention.

**Complexity:** Low-Medium per skill. Mechanical extraction with no behavioral change. Main risk is breaking the skill by extracting something the LLM needs in immediate context (vs reading from a file at runtime).

### 4. Per-Task Atomic Git Commits (DEVW-01)

**Expected UX:** After each task is verified in the execute loop, the skill automatically creates a git commit with a structured message tracing to the DA chain. User sees the commit message and can skip/disable.

**Behavior:**
1. After Step 5c (per-task verification) passes with VERIFIED or PARTIAL status:
2. Stage only the files modified by that task (from the task's file list in PLAN.md or SPIKE.md). Never `git add .` or `git add -A`.
3. Create commit with message format: `{type}({DA-N}): {task_description}` where type is derived from task nature (feat/fix/refactor/docs).
4. Include extended body with traceability metadata:
   ```
   Task: {task_id}
   Phase: {wave/epic N}
   DA: {DA-N}: {DA name}
   Verification: {status}
   ```
5. If verification is FAILED: do NOT auto-commit. Prompt user: `"Task {id} failed verification. Commit anyway? (yes/skip)"`
6. **Opt-out:** A flag (`--no-commit` on execute invocation, or a field in state.yml like `auto_commit: false`) disables auto-commits. User can also respond "skip" at each individual commit prompt.
7. **Commit docs:** Optionally commit .expedite/ artifact changes (checkpoint.yml, PROGRESS.md) in the same commit or a separate docs commit.

**Where it lives:** Execute SKILL.md Step 5, between 5c (verification) and 5d (checkpoint update). New sub-step 5c-git.

**Complexity:** Medium. Git operations via Bash are straightforward. Complexity is in: (a) correctly identifying which files were modified by the task (not all files changed in the session), (b) handling edge cases (untracked files, merge conflicts, dirty working tree before execute started), (c) the opt-out mechanism.

### 5. External Verifier Agent (QUAL-01)

**Expected UX:** After research synthesis completes and before G2 gate evaluation, a verifier agent reads SYNTHESIS.md and the evidence files, then produces a reasoning soundness report. The user sees the report and can act on it before the gate.

**Behavior:**
1. **Dispatch:** Task() subagent with new `prompt-reasoning-verifier.md` template. Model: opus (reasoning judgment requires highest capability). subagent_type: general-purpose (needs Read access to evidence files).
2. **What it checks:**
   - Does each conclusion follow logically from cited evidence? (logical validity)
   - Are contradictions between sources acknowledged and resolved? (contradiction handling)
   - Are confidence levels honest given the evidence strength? (calibration)
   - Are there extrapolations beyond what evidence supports? (scope creep)
   - Are single-source findings presented as well-established? (corroboration honesty)
3. **Output:** `.expedite/research/reasoning-verification.yml` with per-DA assessments:
   ```yaml
   - da: "DA-1"
     reasoning_sound: true
     issues: []
     severity: null
   - da: "DA-2"
     reasoning_sound: false
     issues: ["Conclusion extrapolates beyond single-source evidence"]
     severity: medium
   ```
4. **Integration with G2:** Verifier findings are ADVISORY, not blocking. They appear in the G2 gate display as a separate section: `"Reasoning Verification: {N} issues found across {M} DAs."` User can recycle to address issues or proceed.
5. **Condensed return:** Verifier returns a brief summary (<500 tokens, matching existing subagent pattern). Detailed findings in the file.

**Where it lives:** New step in research SKILL.md between synthesis (current Step 17) and G2 gate (current Step 14 -- note: step numbering will shift). New prompt template at `skills/research/references/prompt-reasoning-verifier.md`.

**Complexity:** Medium. Follows established Task() subagent dispatch pattern exactly. The prompt engineering is the hard part -- getting an LLM to reliably judge reasoning soundness without being either too lenient (rubber-stamping everything) or too strict (flagging every inference as unsupported).

### 6. Conditional Alternative-Surfacing (QUAL-02)

**Expected UX:** During design generation (Step 4), when the evidence for a DA shows genuine tradeoffs (multiple viable approaches with different strength/weakness profiles), the design skill presents 2-3 alternatives with tradeoff analysis and asks the user to choose. When evidence clearly favors one approach, the skill proposes it directly (current behavior preserved).

**Behavior:**
1. **Detection heuristic:** For each DA during design generation, assess whether alternatives are warranted:
   - SYNTHESIS.md shows 2+ approaches with different evidence profiles -> SURFACE alternatives
   - SYNTHESIS.md shows contradictory evidence across sources -> SURFACE alternatives
   - SYNTHESIS.md clearly favors one approach (Strong coverage, adequate+ corroboration) -> PROPOSE directly (no alternatives)
   - Evidence is insufficient (Low confidence) -> PROPOSE best-effort with explicit uncertainty (current behavior)
2. **When surfacing alternatives:**
   ```
   --- DA-3: Caching Strategy ---

   Evidence supports multiple viable approaches:

   Option A: Redis with TTL-based invalidation
   - Strengths: Performance evidence (benchmark data), production proven
   - Weaknesses: Operational complexity, additional infrastructure
   - Evidence: evidence-batch-01.md Finding 4, Finding 7

   Option B: Application-level LRU cache
   - Strengths: No infrastructure, simpler deployment
   - Weaknesses: No cross-instance sharing, memory pressure
   - Evidence: evidence-batch-02.md Finding 2

   Which approach fits your context? (A/B/other)
   ```
3. **User decides:** Their choice becomes the DA decision with the chosen evidence cited. Unchosen alternatives are recorded in the "Alternatives Considered" subsection.
4. **In revision cycle (Step 7):** When user requests revision of a DA that had alternatives surfaced, resurface the original alternatives: `"This DA was originally decided between Options A and B. Would you like to switch, or provide different feedback?"`
5. **Plan skill awareness:** When breaking design into tasks, if a DA decision had alternatives surfaced, include a note in the task context for spike/execute awareness.

**Where it lives:** Design SKILL.md Step 4 (generation) and Step 7 (revision). Plan SKILL.md Step 3 (task decomposition). Logic is inline in the design skill because it is flow control (when to ask) not content.

**Complexity:** Medium-High. The detection heuristic is the hardest part. LLMs tend to generate alternatives even when evidence is clear, so the prompt must explicitly constrain: "do NOT surface alternatives when evidence strongly and unambiguously favors one approach."

### 7. Codebase Analyst Subagent Type: explore (ARCH-01)

**Expected UX:** No user-facing change. Codebase research subagents use `explore` type instead of `general-purpose`, gaining access to built-in codebase navigation tools.

**Behavior:**
1. Change `prompt-codebase-analyst.md` frontmatter from `subagent_type: general-purpose` to `subagent_type: explore`.
2. The `explore` subagent type in Claude Code provides purpose-built codebase exploration tools (enhanced file navigation, structural analysis capabilities).
3. The codebase analyst does NOT use MCP tools, so the platform constraint (MCP requires general-purpose per GitHub #13254, #19964) does not apply.
4. The `<self_contained_reads>` section in the prompt template still applies -- the agent reads its own input files.

**Risk:** The `explore` type may restrict some tools the codebase analyst currently uses (Bash for structural analysis like `wc`, `find`; potentially WebSearch/WebFetch for documentation cross-reference). The allowed-tools in the prompt template (Glob, Grep, Read, Bash) must all be available in explore mode.

**Where it lives:** Single file change: `skills/research/references/prompt-codebase-analyst.md` frontmatter line 2.

**Complexity:** Low (the change is trivial). The testing requirement is the real work -- verifying that explore-mode codebase analysis produces equal or better evidence quality than general-purpose for the evidence types this plugin needs. A/B test with a real lifecycle would be ideal.

## MVP Recommendation

**Must ship (infrastructure hardening promise):**
1. **Split state.yml** -- addresses the largest structural debt, reduces per-invocation token waste
2. **State recovery** -- closes the loop on backup-before-write, the signature resilience feature
3. **Skill line limit** -- prevents skill files from becoming unmanageable, proven pattern exists

**Should ship (quality elevation promise):**
4. **Per-task git commits** -- highest user-visible value of the quality features, extends contract chain
5. **Codebase analyst explore** -- lowest risk, single-file change, validates a deferred assumption

**Can defer to v1.3 if scope pressure requires:**
6. **External verifier agent** -- rubric evaluator covers the common failure mode already; verifier is refinement
7. **Conditional alternative-surfacing** -- current "propose + revise" flow works; alternatives are philosophical alignment, not functional gap

## Complexity Assessment

| Feature | Lines Changed (est.) | Risk | Confidence |
|---------|---------------------|------|-----------|
| State recovery | ~50-80 (shared recovery logic + per-skill Step 1 updates) | Low | MEDIUM |
| Split state.yml | ~200-300 (all skills + templates + migration) | Medium-High (coordination audit) | MEDIUM |
| Skill line limit | ~0 net (extraction is line-neutral; moves lines, does not add) | Low (proven pattern) | HIGH |
| Per-task git commits | ~80-120 (execute SKILL.md new sub-step) | Medium (git edge cases) | MEDIUM |
| External verifier | ~150-200 (new template + research SKILL.md step) | Medium (prompt engineering quality) | LOW |
| Conditional alternatives | ~100-150 (design + plan SKILL.md modifications) | Medium-High (detection heuristic reliability) | LOW |
| Codebase explore | ~1-5 (frontmatter change) | Low (but needs A/B testing) | LOW |

---
*Research completed: 2026-03-11*
*Sources: Codebase analysis of all 7 SKILL.md files, 13 reference templates, state.yml.template, AUDIT-ACTIONS.md, v1.1-REQUIREMENTS.md, PROJECT.md, prior research artifacts*
*WebSearch was denied -- all findings derived from codebase analysis and training data knowledge*
