# Architecture Patterns

**Domain:** Claude Code plugin infrastructure hardening -- 7 features integrating into existing 5,968 LOC plugin
**Researched:** 2026-03-11
**Milestone:** v1.2 Infrastructure Hardening & Quality
**Confidence:** HIGH (all findings from direct codebase analysis of working v1.0/v1.1 implementation)

## Recommended Architecture

v1.2 introduces 7 features that span the spectrum from isolated changes (explore subagent type -- 1 file, 1 line) to structural refactors (state splitting -- touches every skill). The architecture strategy is: **centralize new infrastructure (validation, recovery, state coordination), modify skills minimally (injection patterns, new steps), and extract content to references (skill sizing).**

### Integration Map

```
FEATURE                    NEW COMPONENTS              MODIFIED COMPONENTS
-------                    ---------------             --------------------
1. State recovery          ref-state-recovery.md       Every SKILL.md (Step 1 preamble)
2. State splitting         questions.yml, tasks.yml,   Every SKILL.md (!cat injection)
                           gates.yml                   state.yml.template
                                                       status SKILL.md
3. Skill line limit        Extracted ref-*.md files    scope, design, plan, spike, execute SKILL.md
4. Git commits             ref-git-commit.md           execute SKILL.md (Step 5)
5. Verifier agent          prompt-verifier.md          research SKILL.md (Step 12-15)
6. Conditional alternatives                            design SKILL.md (Step 4, 7)
                                                       plan SKILL.md (Step 4, 6)
7. Explore subagent        (none)                      prompt-codebase-analyst.md (1 line)
```

### Component Boundaries

| Component | Responsibility | Communicates With |
|-----------|---------------|-------------------|
| `state.yml` (tracking) | Phase, current_step, lifecycle identity (~15 lines) | Every skill via !cat injection |
| `questions.yml` (new) | Question array with statuses, evidence_files | scope, research, status |
| `tasks.yml` (new) | Task array, current_wave, current_task | plan, spike, execute, status |
| `gates.yml` (new) | gate_history array | All skills with gates (research, design, plan, spike), status |
| `ref-state-recovery.md` (new) | YAML validation + .bak fallback logic | Referenced by every SKILL.md Step 1 |
| `ref-git-commit.md` (new) | Per-task atomic commit protocol | Referenced by execute SKILL.md Step 5 |
| `prompt-verifier.md` (new) | Reasoning soundness verification template | Dispatched by research SKILL.md |
| Extracted `ref-*.md` files (new) | Content moved from oversized skills | Referenced inline by parent skills |

### Data Flow

**Current (v1.1):**
```
Skill invocation -> !cat .expedite/state.yml (full ~400 line file) -> SKILL.md processes
```

**Proposed (v1.2):**
```
Skill invocation -> !cat .expedite/state.yml (tracking, ~15 lines)
                 -> !cat .expedite/questions.yml (scope/research only)
                 -> !cat .expedite/tasks.yml (plan/spike/execute only)
                 -> Step 1: validate YAML + auto-recover from .bak if malformed
                 -> SKILL.md processes
```

---

## Question 1: YAML Validation + .bak Recovery -- Centralized or Per-Skill?

**Recommendation: Centralized reference, per-skill invocation.**

### Why Not Fully Inline

Every skill currently has a Step 1 that reads state.yml and checks phase/lifecycle status. Adding YAML validation + .bak recovery logic inline to all 7 skills would mean 7 copies of identical try-parse / fallback-to-.bak / warn-user logic. This violates DRY and makes future changes to recovery behavior require 7-file edits.

### Why Not a Separate Skill

A "state-health" skill would add UX friction (users would need to run it separately) and does not match the plugin platform model where skills map to user-facing commands.

### Architecture: `ref-state-recovery.md` Reference

Create `skills/shared/ref-state-recovery.md` containing the recovery protocol. Each skill's Step 1 preamble gains 3-5 lines that reference this protocol:

```markdown
### Step 1 Preamble: State Validation

Before reading state, validate YAML integrity using the protocol in
`skills/shared/ref-state-recovery.md`:

1. Attempt to read `.expedite/state.yml`
2. If read succeeds but YAML is malformed (parse error):
   a. Read `.expedite/state.yml.bak`
   b. If .bak is valid YAML: copy .bak to state.yml, display recovery warning
   c. If .bak is also invalid: display fatal error, STOP
3. If read fails entirely (file missing):
   a. If .bak exists and is valid: restore from .bak
   b. If no .bak: this is expected for scope Step 1 (no lifecycle yet)
4. Proceed with validated state
```

**Confidence: HIGH.** This mirrors the existing pattern where `ref-recycle-escalation.md`, `ref-gapfill-dispatch.md`, and `ref-override-handling.md` are centralized references invoked by the research skill's orchestration flow. The pattern is proven in the codebase.

### Placement Decision

Use `skills/shared/ref-state-recovery.md` -- a new shared directory. Rationale: the existing `skills/research/references/` directory contains research-specific references. State recovery is cross-cutting. A `skills/shared/` directory signals "used by multiple skills" and avoids 7 copies. The SKILL.md files reference it with Glob-based path resolution (same pattern as existing `use Glob with **/ref-*.md if direct path fails`).

### State File Scope

Recovery applies to ALL state files after splitting:
- `.expedite/state.yml` -- always validated
- `.expedite/questions.yml` -- validated when skill reads it
- `.expedite/tasks.yml` -- validated when skill reads it
- `.expedite/gates.yml` -- validated when skill reads it

Each split file gets its own `.bak` (e.g., `questions.yml.bak`). The backup-before-write pattern already exists for state.yml -- extend it to all split files.

---

## Question 2: State Splitting and !cat Injection Patterns

**Recommendation: Split into 4 files with scoped injection per skill.**

### Current Problem

`state.yml` today contains both tracking data (~15 lines) and payload data (questions array, tasks array, gate_history -- up to 300+ lines). Every skill injects the full file via `!cat .expedite/state.yml` in its frontmatter block, paying 2-3K tokens for data it does not use.

### Proposed Split

| File | Contents | Size (typical) | Injected By |
|------|----------|-----------------|-------------|
| `state.yml` | version, last_modified, project_name, intent, lifecycle_id, description, phase, current_step, current_task, current_wave, research_round, imported_from, constraints | ~15 lines | All 7 skills |
| `questions.yml` | questions array (id, text, priority, DA, source_hints, evidence_requirements, status, source, gap_details, evidence_files) | 50-200 lines | scope, research, status |
| `tasks.yml` | tasks array (id, title, wave, status), current_wave, current_task | 20-100 lines | plan, spike, execute, status |
| `gates.yml` | gate_history array (gate, timestamp, outcome, must/should counts, notes, overridden) | 10-50 lines | research, design, plan, spike, status |

### Injection Pattern Changes Per Skill

**Current pattern (all skills):**
```markdown
---
name: scope
...
---

Current lifecycle state:
!`cat .expedite/state.yml 2>/dev/null || echo "No active lifecycle"`
```

**Proposed pattern (varies by skill):**

| Skill | Injections |
|-------|-----------|
| scope | `state.yml` + `questions.yml` |
| research | `state.yml` + `questions.yml` + `gates.yml` |
| design | `state.yml` + `gates.yml` |
| plan | `state.yml` + `gates.yml` |
| spike | `state.yml` + `tasks.yml` |
| execute | `state.yml` + `tasks.yml` |
| status | `state.yml` + `questions.yml` + `tasks.yml` + `gates.yml` |

**Injection syntax (per skill frontmatter block):**
```markdown
Current lifecycle state:
!`cat .expedite/state.yml 2>/dev/null || echo "No active lifecycle"`

Questions:
!`cat .expedite/questions.yml 2>/dev/null || echo "No questions defined"`
```

### Migration Path

The state.yml.template in `templates/` must be updated to produce the new structure. Scope Step 3 (Initialize Lifecycle) currently copies the template to `.expedite/state.yml` -- it must now also create `questions.yml`, `tasks.yml`, and `gates.yml` from templates (or create them empty).

**Backward compatibility:** Recommend **clean break** -- require archiving active lifecycles before v1.2. Simpler than lazy migration, and no users have active long-running lifecycles.

### Write Coordination

The backup-before-write protocol extends to each file independently:
- When writing `questions.yml`: backup to `questions.yml.bak`, then write
- When writing `tasks.yml`: backup to `tasks.yml.bak`, then write
- `state.yml` keeps its existing backup pattern

No cross-file atomic writes needed because skills typically write to only 1-2 state files per step. The split actually reduces write contention.

### Token Savings Estimate

| Scenario | v1.1 (monolithic) | v1.2 (split) | Savings |
|----------|-------------------|-------------|---------|
| scope invocation | ~400 lines | ~15 + ~150 = ~165 lines | ~60% |
| execute invocation | ~400 lines | ~15 + ~60 = ~75 lines | ~80% |
| design invocation | ~400 lines | ~15 + ~30 = ~45 lines | ~90% |

**Confidence: HIGH.** The split is straightforward -- `questions`, `tasks`, and `gate_history` are already self-contained arrays in state.yml with no cross-references.

---

## Question 3: Extracting Skill Content to references/ (500-Line Soft Cap)

**Recommendation: Extract self-contained logical blocks into references, maintain orchestration flow in SKILL.md.**

### Current Skill Sizes

| Skill | Lines | Over 500? | Extraction Candidates |
|-------|-------|-----------|----------------------|
| scope | ~880 | Yes | Step 5 (adaptive refinement ~200 lines), Step 7 (codebase analysis ~120 lines) |
| research | ~850 | Yes | Step 8-9 (prompt assembly + dispatch ~150 lines), Step 14-16 (gate eval + outcome + gap-fill ~200 lines) |
| design | ~830 | Yes | Step 4 (design generation format spec ~200 lines), Step 6 (HANDOFF.md ~120 lines) |
| plan | ~700 | Yes | Step 4 (plan generation format spec ~200 lines) |
| spike | ~600 | Yes | Step 4-5 (TD resolution + research dispatch ~150 lines) |
| execute | ~500 | At limit | Step 5 (task execution loop is core -- hard to extract) |
| status | ~170 | No | No extraction needed |

### Extraction Pattern

The Claude Code plugin pattern for maintaining orchestration flow while moving content to references is already proven in the research skill:

**Before (inline):**
```markdown
### Step 8: Assemble Prompt Templates
[150 lines of detailed prompt assembly logic]
```

**After (reference-based):**
```markdown
### Step 8: Assemble Prompt Templates
Read `skills/research/references/ref-prompt-assembly.md` for the detailed
assembly protocol. Apply it with these inputs:
- Batch plan from Step 6
- State fields: project_name, intent, research_round
- Template paths per source type
```

The key pattern: **SKILL.md retains the step heading, input/output contract, and orchestration flow. The reference file contains the detailed HOW.**

### Extraction Criteria

Extract a block when it meets ALL of:
1. Self-contained -- can be understood without reading surrounding steps
2. Does not contain orchestration routing (if/else that controls which step runs next)
3. At least 80 lines of content
4. Stable -- not expected to change frequently

Do NOT extract:
- Step 1 (prerequisite check) -- contains critical routing logic per skill
- Gate evaluation steps -- contain outcome routing (Go/Recycle/Override)
- Micro-interaction prompts -- contextual to the step flow

### Naming Convention

Extracted files go in the parent skill's `references/` directory:

```
skills/scope/references/ref-adaptive-refinement.md
skills/scope/references/ref-codebase-analysis.md
skills/design/references/ref-design-format-spec.md
skills/design/references/ref-handoff-generation.md
skills/plan/references/ref-plan-format-spec.md
```

### Impact on Step Tracking

Extracting content does NOT change step counts. The step still exists in SKILL.md -- it just delegates to a reference. The status skill's hardcoded step lookup table remains unchanged.

**Confidence: HIGH.** This is the exact pattern used when research SKILL.md was refactored from 1233 to 611 lines in Phase 5.

---

## Question 4: Git Commit Logic Placement in Execute SKILL.md

**Recommendation: Add git commit as Step 5e.5 (after PROGRESS.md append, before micro-interaction), with logic in a reference file.**

### Integration Point

The execute skill's Step 5 (Task Execution Loop) sub-step sequence:
```
5a: Display current task
5b: Implement the task
5c: Per-task verification
5d: Update checkpoint
5e: Append to PROGRESS.md
5e.5: Atomic git commit (NEW)
5f: Micro-interaction (continue/pause/review)
5g: Error handling
```

### Why This Position

- After PROGRESS.md (5e): commit message can reference the progress entry
- After verification (5c): only commit verified work (VERIFIED or PARTIAL, not FAILED)
- Before micro-interaction (5f): if user pauses, work is already committed
- Before next task: atomic per-task boundary is clean

### Reference File: `ref-git-commit.md`

Create `skills/execute/references/ref-git-commit.md` containing:

1. **Pre-commit check:** `git rev-parse --is-inside-work-tree`. If not a git repo, skip silently.
2. **Verification gate:** Only commit if task verification is VERIFIED or PARTIAL. FAILED tasks are not committed.
3. **Stage specific files:** `git add {files_modified}` -- NEVER `git add .` or `git add -A`. File list from task definition.
4. **Commit message format:**
   ```
   {type}({DA-N}): {task_title}

   Task: {task_id}
   Phase: {Wave/Epic} {N}
   Verification: {VERIFIED|PARTIAL}
   Contract: {DA-X} -> {design decision} -> {task_id}
   ```
   Where `type` is inferred: `feat` for new files, `refactor` for modifications, `fix` for bug-fix tasks, `docs` for documentation-only.
5. **Artifact commits (optional):** Separate commit for `.expedite/` artifacts: `docs(expedite): update {phase} checkpoint after {task_id}`.
6. **Commit hash tracking:** Record commit SHA in checkpoint.yml (`commit_sha` field).
7. **Skip conditions:** No-op if: not a git repo, task FAILED, no files modified, or `git_commits: false` in state.yml.

### Configuration

Add optional `git_commits` field to state.yml (tracking section):
```yaml
git_commits: true  # true | false | absent (defaults to true when .git/ exists)
```

### Step Count Impact

Does NOT add a new step number. Adds a sub-step (5e.5) within existing Step 5 loop. Execute step count remains 7.

**Confidence: HIGH.** The GSD per-task commit pattern is well-documented. The execute skill's loop structure naturally accommodates an additional sub-step.

---

## Question 5: Verifier Agent Integration with Research Flow and G2 Gate

**Recommendation: Insert verifier as a new Step 12.5 between sufficiency assessment (Step 12) and dynamic question discovery (Step 13), dispatched as Task().**

### Current Research Flow (Steps 12-15)

```
Step 12: Sufficiency Assessment (dispatch evaluator Task())
Step 13: Dynamic Question Discovery
Step 14: G2 Gate Evaluation (count-based)
Step 15: Gate Outcome Handling
```

### Proposed Flow with Verifier

```
Step 12: Sufficiency Assessment (existing -- rubric validation)
Step 12.5/13: Reasoning Soundness Verification (NEW)
Step 13/14: Dynamic Question Discovery (renumbered)
Step 14/15: G2 Gate Evaluation (MODIFIED -- incorporates verifier results)
Step 15/16: Gate Outcome Handling (renumbered)
...
```

### Why This Position

- After sufficiency (Step 12): verifier checks reasoning quality on COVERED questions only
- Before dynamic questions: verifier-identified reasoning gaps can surface alongside new questions
- Before G2 gate: verifier findings must influence gate decision

### Verifier Architecture

**Template:** `skills/research/references/prompt-verifier.md`

**Dispatch:** Task() subagent, `subagent_type: general-purpose`, `model: opus`

**Input (self-contained reads):**
- `.expedite/research/SYNTHESIS.md`
- `.expedite/research/evidence-batch-*.md`
- `.expedite/scope/SCOPE.md`
- `.expedite/research/sufficiency-results.yml`

**Output:** `.expedite/research/verification-results.yml`
```yaml
- question_id: "q01"
  reasoning_sound: true
  issues: []
- question_id: "q03"
  reasoning_sound: false
  issues:
    - type: "confirmation_bias"
      description: "Synthesis claims X but evidence only supports Y"
      severity: "high"
      suggested_action: "Re-examine evidence with contrarian lens"
```

**Checks performed:**
1. Does each conclusion follow from cited evidence?
2. Are contradictions acknowledged and resolved?
3. Are confidence levels honest?
4. Are extrapolations flagged?
5. Is confirmation bias absent?

### G2 Gate Modification

Add one SHOULD criterion:

```
S4: Reasoning soundness verified for all COVERED questions
    Check: Read verification-results.yml. Count sound/total.
    State: "{N}/{M} COVERED questions have sound reasoning"
```

SHOULD (not MUST) because: verifier is new, needs calibration, involves LLM judgment.

### Step Count Impact

Research goes from 18 to 19 steps. Status lookup table must update: `research: 19`.

**Confidence: MEDIUM.** Dispatch pattern is proven. Specific verification criteria need calibration through usage. SHOULD classification provides safe rollout.

---

## Question 6: Conditional Alternative Detection in Design/Plan Skills

**Recommendation: Add "genuine tradeoff" test to generation logic (Step 4) and surface during revision cycles (Step 7/6).**

### Genuine Tradeoff Detection Signals

A DA has a genuine tradeoff when:
1. SYNTHESIS.md explicitly notes conflicting evidence or competing approaches
2. Design decision confidence is Medium (not High = clear winner, not Low = insufficient)
3. Sufficiency evaluator found Adequate coverage from multiple approaches

### Design Skill Integration

**Step 4 modification (generation):**
After generating design, scan each DA's "Alternatives Considered." If 2+ alternatives have non-trivial evidence support, flag as "choice point." Write to `.expedite/design/choice-points.yml`.

**Step 7 modification (revision cycle):**
When presenting for review (7a), if choice points exist, append a "Choice Points" section listing DAs with genuine tradeoffs. User can change choices or proceed with defaults.

### Plan Skill Integration

**Step 4:** Detect when phase ordering has genuine alternatives (multiple valid dependency orderings).
**Step 6:** Surface ordering alternatives during review if they exist.

### Not a Separate Step

This modifies existing generation and revision logic. No new steps. No step count changes.

**Confidence: MEDIUM.** Detection heuristics are reasonable but need tuning. Risk of false positives/negatives. Advisory nature mitigates risk.

---

## Question 7: Codebase Analyst Switch to Explore Subagent Type

**Recommendation: Single-line change in prompt-codebase-analyst.md frontmatter.**

### Change

Line 2 of `skills/research/references/prompt-codebase-analyst.md`:
```yaml
# Before
subagent_type: general-purpose
# After
subagent_type: explore
```

### What Changes

The `explore` subagent type provides built-in codebase navigation tools. Currently the analyst uses `general-purpose` with manually specified tools (Grep, Read, Glob, Bash).

### What Does NOT Change

- Prompt template content, model tier, instructions, output format, dispatch logic -- all unchanged.

### Safety

- Codebase analyst does NOT use MCP tools (which require general-purpose)
- Only uses Grep, Read, Glob, Bash -- available in explore mode
- `explore` adds codebase-specific navigation capabilities

### Validation Required

Test that evidence file quality is at least equal to general-purpose output.

**Confidence: MEDIUM.** Change is trivial but platform documentation on explore capabilities is not comprehensive. Needs empirical validation.

---

## Patterns to Follow

### Pattern 1: Centralized Reference with Per-Skill Invocation

**What:** Complex logic in a reference file. SKILL.md contains 3-5 lines invoking it.
**When:** Logic used by 2+ skills or is self-contained and over 80 lines.
**Example:**
```markdown
### Step 5e.5: Atomic Git Commit
If task verification is VERIFIED or PARTIAL, apply the commit protocol from
`skills/execute/references/ref-git-commit.md` with inputs: files, DA, task_id.
```

### Pattern 2: Scoped !cat Injection

**What:** Each skill only injects the state files it needs.
**When:** After state splitting, every skill specifies exactly which files to inject.
**Example:**
```markdown
Current lifecycle state:
!`cat .expedite/state.yml 2>/dev/null || echo "No active lifecycle"`

Gate history:
!`cat .expedite/gates.yml 2>/dev/null || echo "No gate history"`
```

### Pattern 3: Backup-Before-Write for All State Files

**What:** Every state file modification follows: read -> backup (.bak) -> modify -> write entire file.
**When:** Every write to state.yml, questions.yml, tasks.yml, gates.yml.

### Pattern 4: Task() Subagent with Self-Contained Reads

**What:** Subagents read their own input files rather than receiving assembled content in the prompt.
**When:** Any new Task() subagent (verifier agent). Keeps orchestrator context lean.

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: Inline Duplication of Cross-Cutting Logic
**What:** Copying state recovery logic into all 7 SKILL.md files.
**Why bad:** 7 copies diverge over time. Bug fix requires 7 edits.
**Instead:** Centralize in reference file, invoke from each skill.

### Anti-Pattern 2: Monolithic State Injection
**What:** Injecting all state files into every skill via !cat.
**Why bad:** Wastes 2-3K tokens per invocation on irrelevant data.
**Instead:** Scope injections to what each skill actually reads.

### Anti-Pattern 3: Extracting Orchestration Logic to References
**What:** Moving if/else routing (Case A/B/C, gate outcomes) to reference files.
**Why bad:** SKILL.md becomes unreadable -- cannot follow flow without jumping between files.
**Instead:** Only extract self-contained procedural blocks. Keep all routing in SKILL.md.

### Anti-Pattern 4: Making Verifier a MUST Gate Criterion Immediately
**What:** Adding reasoning soundness as MUST on G2 from day one.
**Why bad:** New LLM-based verification needs calibration. MUST causes Recycle -> override training.
**Instead:** Start as SHOULD. Promote to MUST after 3+ lifecycles of observation.

### Anti-Pattern 5: Git Add All
**What:** Using `git add .` or `git add -A` in the commit protocol.
**Why bad:** Captures unrelated changes, .expedite/ artifacts, sensitive files.
**Instead:** Stage only specific files listed in task definition file targets.

---

## Build Order (Dependency-Aware)

```
                    State Recovery (1)
                         |
                    State Splitting (2) -----> Skill Line Limit (3)
                    /    |    \
                   /     |     \
    Explore (7)  /   Git Commits (4)  Conditional Alternatives (6)
                /        |
         Verifier (5)    |
                         |
                    [all complete]
```

| Order | Feature | Rationale |
|-------|---------|-----------|
| 1st | State Recovery | Foundation -- resilient state reads benefit all subsequent features. Smallest scope. |
| 2nd | Explore Subagent | Trivial 1-line change. Ship early, validate during subsequent lifecycles. |
| 3rd | State Splitting | Second foundation -- affects injection patterns in all skills. Must land before skill line limit to avoid merge conflicts. |
| 4th | Skill Line Limit | Depends on state splitting being complete (new !cat patterns settled). Extracts content, reduces SKILL.md sizes. |
| 5th | Git Commits | Depends on state splitting (checkpoint.yml adds commit_sha). Isolated to execute skill. |
| 6th | Verifier Agent | Depends on state splitting (gates.yml for new SHOULD criterion). Isolated to research skill. |
| 7th | Conditional Alternatives | Last -- modifies design/plan generation logic which should be stable from skill line limit. |

**Critical path:** State Recovery -> State Splitting -> Skill Line Limit.

---

## Scalability Considerations

| Concern | Current (v1.1) | After v1.2 | Notes |
|---------|----------------|-----------|-------|
| State file size | 400 lines single file | 4 files, ~15+150+60+30 lines | Same LOC but scoped injection cuts token cost 60-90% |
| Skill file size | 500-880 lines | 300-500 lines after extraction | Content moves to references, total same but SKILL.md under cap |
| Research subagents | 3 max concurrent | Still 3 max (verifier runs sequentially after evaluator) | Verifier is not parallel with researchers |
| Git history | No integration | Per-task commits | ~10s per task for git operations |
| State recovery | Manual .bak restore | Automatic detection + recovery | One-time cost on skill entry, typically no-op |

## Sources

All findings from direct codebase analysis:
- `skills/*/SKILL.md` -- all 7 skill orchestrators (5,968 LOC total)
- `skills/research/references/*` -- 8 reference files (5 prompts + 3 inline refs)
- `templates/state.yml.template` -- state schema with comments
- `.planning/research/expedite-audit/AUDIT-ACTIONS.md` -- source for all 7 features (DEFER-4/5/6/9/10/13/14)
- `.planning/milestones/v1.0-phases/03-prompt-template-system/03-RESEARCH.md` -- original explore vs general-purpose decision
- `.planning/PROJECT.md` -- constraints and key decisions
