# Technology Stack

**Project:** Expedite v1.2 -- Infrastructure Hardening & Quality
**Researched:** 2026-03-11
**Overall confidence:** MEDIUM (web research tools unavailable; findings based on codebase analysis, prior research artifacts, and training data)

## Recommended Stack

### Core Platform (Unchanged)

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Claude Code Plugin Platform | current | Orchestration runtime | Only viable platform; SKILL.md orchestrators, Task() subagents, plugin.json auto-discovery |
| SKILL.md orchestrators | N/A | Skill definitions | Existing convention; all 7 skills use this pattern |
| YAML (state.yml) | 1.2 spec | Lifecycle state persistence | Flat YAML, max 2 nesting levels, complete-file rewrite + backup-before-write |
| Markdown (references/) | N/A | Prompt templates, inline references | 8-section XML structure proven across 9+ templates |
| Task() subagent API | current | Parallel research dispatch | `prompt`, `description`, `subagent_type` (required), `model` (optional) |

### Stack Additions for v1.2

No new external dependencies. All 7 features are implemented through Markdown/YAML pattern changes within the existing Claude Code plugin platform. The "stack" for this plugin is the platform itself -- there are no npm packages, no build tools, no runtime dependencies.

| Addition | Purpose | Why This Approach |
|----------|---------|-------------------|
| YAML error detection pattern | State recovery | Claude's YAML parser (used by `!cat` injection) produces parse errors that can be caught by reading the file and checking for well-formedness before operating on it |
| `explore` subagent type | Codebase analyst improvement | Built-in codebase navigation tools vs. generic `general-purpose` which requires explicit tool enumeration in the prompt |
| `references/` content extraction | Skill sizing | Existing proven pattern (research SKILL.md went from 1233 to 611 lines using this approach) |
| Git commands via Bash tool | Per-task commits | Execute skill already has Bash in allowed-tools; git is available in the shell environment |
| New prompt template | External verifier | Same pattern as existing 9 templates (frontmatter + 8-section XML structure) |

## Feature-by-Feature Stack Analysis

### Feature 1: State Recovery (YAML Error Detection + .bak Fallback)

**What's needed:** Detect malformed/corrupted state.yml and auto-recover from .bak.

**Current state:** Every SKILL.md uses `!cat .expedite/state.yml 2>/dev/null || echo "No active lifecycle"` for dynamic injection. If state.yml contains invalid YAML, this injection succeeds (cat doesn't validate YAML) but the LLM receives malformed content that may produce unpredictable behavior. The `.bak` file exists (42 backup-before-write instances verified) but no skill reads it for recovery.

**Stack approach -- no new tools needed:**

```
Detection strategy (in each SKILL.md Step 1):
1. Read .expedite/state.yml via Read tool
2. Attempt to parse key fields (phase, project_name, current_step)
3. If ANY required field is missing/malformed OR file is empty/truncated:
   a. Read .expedite/state.yml.bak
   b. If .bak parses correctly: copy .bak to state.yml, log recovery event, continue
   c. If .bak also malformed: display error with manual recovery instructions, STOP
```

**Why this works without external YAML parsers:** Claude's LLM parsing handles YAML natively. The detection is not a programmatic YAML.parse() call -- it's the LLM reading the file content and recognizing whether it contains valid YAML with expected fields. This is how every skill already operates: read state.yml, extract fields, modify, write back. The only addition is an explicit "is this valid?" check before proceeding.

**What NOT to add:**
- No js-yaml or yaml npm package -- the plugin has no Node.js runtime; skills are pure Markdown
- No separate validation script -- adding a scripts/ directory introduces complexity the platform doesn't support well (SessionStart hook bugs)
- No schema validation library -- LLM-based field checking is sufficient for flat YAML with max 2 nesting levels

**Confidence:** HIGH. The backup-before-write pattern is already universal. Adding recovery logic is a Markdown instruction change, not a technology change.

### Feature 2: State Splitting

**What's needed:** Split state.yml into scoped files to reduce context injection overhead.

**Current state:** state.yml serves both tracking (~15 lines: phase, current_step, current_task) and data storage (questions[], tasks[], gate_history[] -- up to 300+ lines). Every skill injects the full file via `!cat .expedite/state.yml`.

**Proposed split (from DEFER-10 analysis):**

| File | Contents | Injected By | Lines |
|------|----------|-------------|-------|
| `state.yml` | phase, current_step, current_task, current_wave, version, last_modified, project_name, intent, lifecycle_id, description, research_round, imported_from, constraints | All skills (via `!cat`) | ~20 |
| `questions.yml` | questions[] array | scope, research, status | variable |
| `tasks.yml` | tasks[] array | plan, spike, execute, status | variable |
| `gates.yml` | gate_history[] array | all gate-evaluating skills, status | variable |

**Stack impact:**
- Same backup-before-write protocol per file (read, cp .bak, modify, write)
- Same flat YAML structure (max 2 nesting levels)
- `!cat` injection in SKILL.md frontmatter changes from one file to scoped files
- Status skill reads all files; other skills read only what they need
- Templates directory needs updated template files

**Why not a single monolith:** A 400-line state.yml injected into every skill call costs ~2-3K tokens per invocation. With 7 skills, multiple steps per skill, and backup-before-write patterns, this compounds. The split saves context tokens for skills that don't need questions[] or tasks[].

**Why not a database:** Overkill. The plugin has no runtime, no server, no persistent process. Files are the only persistence mechanism available in the Claude Code plugin platform.

**Confidence:** HIGH. The split is a file organization change using identical YAML patterns already proven across 18 months of state.yml usage.

### Feature 3: Skill Line Limit (500-Line Soft Cap)

**What's needed:** Keep SKILL.md files under 500 lines by extracting content to references/.

**Current line counts (measured):**

| Skill | Lines | Status |
|-------|-------|--------|
| research | 851 | OVER -- highest priority for extraction |
| scope | 748 | OVER |
| design | 628 | OVER |
| plan | 617 | OVER |
| execute | 593 | OVER |
| spike | 539 | OVER (marginal) |
| status | 167 | Under -- no action needed |

**Proven extraction pattern:** Research SKILL.md was previously refactored from 1233 to 611 lines by moving prompt templates to references/. The pattern is:

1. Identify self-contained content blocks (gate evaluation logic, resume logic, prompt assembly instructions)
2. Move block to `skills/{skill}/references/ref-{name}.md`
3. Replace inline content with: "Read `skills/{skill}/references/ref-{name}.md` (use Glob with `**/ref-{name}.md` if the direct path fails)"
4. Reference file is loaded on-demand by the LLM, not injected at skill load time

**What can be extracted:**

| Skill | Extractable Content | Est. Savings |
|-------|-------------------|-------------|
| research | G2 gate evaluation (Steps 14-15), gap-fill dispatch (Step 16) already partially extracted | ~50-100 lines |
| scope | Question generation logic, convergence loop protocol | ~100-150 lines |
| design | G3 gate evaluation, revision cycle protocol | ~80-120 lines |
| plan | G4 gate evaluation, phase sizing rules | ~80-100 lines |
| execute | Verification protocol, archival flow | ~80-100 lines |
| spike | G5 gate evaluation, research dispatch | ~50-80 lines |

**What NOT to extract:**
- Step 1 (prerequisite check) -- must be inline for immediate crash-recovery routing
- State transition logic -- tightly coupled to step flow
- User interaction prompts -- context-dependent, lose meaning when separated

**Why 500 lines:** Claude Code processes SKILL.md files as context for the orchestrating LLM. Longer files mean more tokens consumed before the skill starts doing work. The 500-line soft cap balances thoroughness with context efficiency. Hard enforcement is impractical (some skills genuinely need more inline content for crash recovery).

**Confidence:** HIGH. The extraction pattern is proven by the research SKILL.md refactor (1233 to 611). The references/ convention is already established.

### Feature 4: Explore Subagent Type for Codebase Analyst

**What's needed:** Switch codebase analyst from `subagent_type: "general-purpose"` to `"explore"`.

**Current state:** All 3 researcher templates use `subagent_type: general-purpose`. The original product design specified `explore` for codebase analyst (line 565), but v1.0 used `general-purpose` uniformly "to avoid subtle bugs where a codebase analyst needs a tool not available in explore mode" (Phase 3 research decision).

**What `explore` type provides (from original research synthesis):**
- Built-in codebase navigation tools optimized for file exploration
- Purpose-built for reading, searching, and analyzing code
- Does NOT have access to WebSearch, WebFetch, or MCP tools (which codebase analyst does not need)
- Does NOT have access to Write or Edit tools (which codebase analyst should not need -- it only reads and reports)

**What `general-purpose` provides that `explore` does not:**
- WebSearch, WebFetch (codebase analyst doesn't use these)
- Write, Edit (codebase analyst shouldn't use these -- it writes evidence files, but explore may still support Write for output)
- MCP tool access (codebase analyst explicitly doesn't need this -- per Decision 28, only web/MCP researchers need it)

**Stack change:** One line in `skills/research/references/prompt-codebase-analyst.md`:
```yaml
# Before
subagent_type: general-purpose
# After
subagent_type: explore
```

**Risk assessment:** LOW confidence on exact `explore` type tool set. The original v1.0 research noted uncertainty about which tools are available in explore mode. The Phase 3 decision was conservative ("use general-purpose uniformly"). The v1.2 implementation should validate via a test dispatch: spawn an explore-type Task() with a simple codebase question and verify it can use Read, Glob, Grep, and Bash. If any are missing, stay on general-purpose.

**Critical concern -- Write tool access:** The codebase analyst must write evidence files (e.g., `evidence-batch-01.md`). If `explore` type does not include Write access, the agent cannot produce output files. This is the primary risk. Mitigation: test before committing to the change. Fallback: stay on `general-purpose` if Write is unavailable in explore mode.

**What NOT to change:**
- Web researcher stays `general-purpose` (needs WebSearch, WebFetch)
- MCP researcher stays `general-purpose` (needs MCP tool access)
- Sufficiency evaluator stays `general-purpose` (needs Read for evidence files)
- Synthesizer stays `general-purpose` (needs Read for evidence files)

**Confidence:** LOW. Training data suggests explore type has built-in codebase tools but the exact tool set is unverified with current documentation. Web research tools were unavailable during this research session. **This feature needs a validation spike before implementation** -- spawn a test explore-type Task() and verify tool availability (especially Write).

### Feature 5: Per-Task Git Commits in Execute

**What's needed:** After each task passes verification, create an atomic git commit with DA traceability.

**Stack approach -- git via Bash tool (already in execute's allowed-tools):**

```bash
# After task verification passes:
git add {specific files touched by this task}
git commit -m "{type}({DA-N}): {task description}"
```

**Commit format (adapted from GSD pattern per DEFER-14 analysis):**
- Type: `feat`, `fix`, `refactor`, `test`, `docs` (conventional commits)
- Scope: `DA-{N}` (decision area that the task traces to)
- Description: task title from PLAN.md or SPIKE.md
- Example: `feat(DA-3): implement PKCE OAuth2 flow`

**Configuration:**
- Git integration should be **optional** -- some users want manual commit control
- Add `git_commits: true|false` to a config mechanism (or hardcode as opt-in)
- Stage only specific files touched by the task (NEVER `git add .` or `git add -A`)
- Track commit hashes in checkpoint.yml for traceability

**What NOT to add:**
- No branching strategy -- users manage their own branches; the plugin just commits
- No git rollback -- completed commits stay; resume skips completed tasks (GSD pattern)
- No `git push` -- dangerous in a plugin context; user pushes manually
- No git hooks or pre-commit validation -- beyond plugin scope
- No `.expedite/` artifact commits by default -- these are lifecycle state, not project code. Consider a `commit_docs` option for users who want `.expedite/` tracked

**Platform constraints:**
- Bash tool is already in execute SKILL.md's `allowed-tools` list
- git commands execute in the user's shell environment with their git config
- No git credential management needed -- uses system git
- Error handling: git failures (dirty worktree, merge conflicts) should pause execution with instructions, not auto-resolve

**Confidence:** HIGH. Git via Bash is well-understood. The GSD pattern (DEFER-14 analysis) provides a proven commit format and staging strategy.

### Feature 6: External Verifier Agent for Research Reasoning

**What's needed:** A second verification layer after synthesis that checks logical soundness -- not just "did you find evidence?" but "does your evidence actually support your conclusion?"

**Stack approach -- new prompt template following existing pattern:**

| Component | Details |
|-----------|---------|
| Template file | `skills/research/references/prompt-research-verifier.md` |
| Subagent type | `general-purpose` (needs Read for evidence files and SYNTHESIS.md) |
| Model | `opus` (judgment task requires highest capability) |
| Dispatch point | Research SKILL.md, between Step 17 (synthesis) and Step 18 (completion) |
| Input | SYNTHESIS.md + evidence files + SCOPE.md (self-contained reads) |
| Output | `.expedite/research/verification-results.yml` |

**Two-layer verification architecture (from memory/phase5-verifier-design.md):**

| Layer | What It Checks | Who Does It | Status |
|-------|---------------|-------------|--------|
| Layer 1: Rubric validation | Evidence meets typed requirements | Existing sufficiency evaluator (Step 12) | Already implemented |
| Layer 2: Logical validation | Reasoning soundness, contradiction resolution | NEW verifier agent | To be added |

**Layer 2 checks (from design decision):**
1. Does the evidence actually answer the question, or is it tangential?
2. Is the reasoning sound? Do findings logically support conclusions?
3. Are there contradictions between sources that aren't addressed?
4. Does the flow of evidence make sense end-to-end?
5. Would a skeptical reviewer accept these findings?

**Template structure (follows existing 8-section XML pattern):**
```markdown
---
subagent_type: general-purpose
model: opus
---

<role>...</role>
<context>...</context>
<downstream_consumer>...</downstream_consumer>
<instructions>...</instructions>
<output_format>...</output_format>
<quality_gate>...</quality_gate>
<input_data>...</input_data>
```

**Integration with G2 gate:** The verifier results feed into G2 gate evaluation. Add a new SHOULD criterion: "Verifier reports no critical reasoning flaws." A SHOULD (not MUST) because reasoning assessment involves LLM judgment -- making it MUST would risk false positive recycles.

**What NOT to add:**
- No separate verifier skill -- this is a subagent within the research skill's flow
- No complex output format -- structured YAML results matching sufficiency-results.yml pattern
- No additional gate -- integrates into existing G2

**Confidence:** MEDIUM. The pattern (Task() subagent with prompt template) is proven by the sufficiency evaluator. The verifier's effectiveness depends on prompt engineering quality, which needs iteration.

### Feature 7: Conditional Alternative-Surfacing

**What's needed:** Present competing design/plan options to users only when genuine tradeoffs exist, not as a blanket "here are 3 options for everything."

**Stack approach -- prompt engineering change, no new tools:**

This is a prompt engineering enhancement to the design guide and plan guide reference files, not a new technology. The existing revision cycle in design (Step 7) and plan (Step 6) already supports user-driven iteration. The change is:

1. **Design guide (`prompt-design-guide.md`):** Add instructions for the LLM to identify Decision Areas where evidence supports multiple viable approaches with genuine tradeoffs. When detected, present alternatives with tradeoff analysis instead of a single recommendation.

2. **Detection criteria for "genuine tradeoff":**
   - Evidence supports 2+ approaches
   - No approach dominates across all evaluation dimensions
   - The choice depends on priorities (performance vs. simplicity, flexibility vs. correctness)

3. **When NOT to surface alternatives:**
   - Evidence clearly favors one approach
   - Only one viable option exists
   - The choice is purely tactical (implementation detail, not design decision)

**What NOT to add:**
- No multi-subagent design pattern (research-engine's "confidence auditor and decision resolver") -- this was considered in DEFER-6 but rejected as over-engineering. The LLM generating the design can detect tradeoffs inline.
- No new prompt templates -- modifications to existing design-guide.md and plan-guide.md
- No new subagent types -- design and plan run in main session (constraint C-7)
- No forced alternatives -- the key word is "conditional." Only surface when genuine.

**Confidence:** MEDIUM. The prompt engineering approach is sound, but the LLM's ability to reliably distinguish "genuine tradeoff" from "I can think of alternatives" needs testing. Risk of over-surfacing alternatives (noise) or under-surfacing (missing real tradeoffs).

## Alternatives Considered

| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| YAML parsing | LLM-native parsing | js-yaml npm package | No Node.js runtime in plugin; LLM handles YAML natively |
| State storage | Split YAML files | SQLite / JSON | YAML is the established convention; JSON loses readability; SQLite is overkill |
| Git integration | Direct Bash commands | libgit2 / simple-git | No Node.js runtime; Bash git is available in shell environment |
| Verifier dispatch | Task() subagent | Inline LLM evaluation | Self-grading bias; fresh context eliminates anchoring to evidence the evaluator produced |
| Skill sizing | references/ extraction | Multiple SKILL.md files per skill | Plugin platform expects one SKILL.md per skill directory |
| Alternative surfacing | Prompt engineering | Multi-subagent debate | Over-engineering; single-session LLM can detect tradeoffs |

## What NOT to Add

These were considered and explicitly rejected:

| Technology | Why NOT |
|------------|---------|
| npm packages (js-yaml, simple-git, etc.) | Plugin has no Node.js runtime; skills are pure Markdown executed by Claude |
| Configuration files (yaml, json, toml) | Hardcoded patterns work; adding config introduces parse/validate complexity |
| Database (SQLite, LevelDB) | State is ~20 lines of tracking data; files are sufficient |
| Custom scripts in scripts/ directory | SessionStart hook bugs make scripts unreliable; all logic lives in SKILL.md |
| Schema validation (JSON Schema, Zod) | LLM-based field checking is sufficient for flat YAML |
| Pre-commit hooks | Beyond plugin scope; user manages their own git workflow |
| Migration tooling | Complete-rewrite semantics mean schema changes apply on first write |
| New skill directories | All features fit within existing 7 skills |

## Integration Considerations

### Cross-Feature Dependencies

```
State splitting (F2) should happen BEFORE state recovery (F1)
  Reason: Recovery logic differs per split file (state.yml vs questions.yml)

Skill sizing (F3) should happen AFTER verifier (F6) and git commits (F5)
  Reason: New content added to skills needs to be measured before extraction

Explore subagent (F4) is independent -- can happen anytime
  Reason: Single-line frontmatter change + validation test

Alternative surfacing (F7) is independent -- can happen anytime
  Reason: Prompt engineering changes to existing reference files
```

### Files Modified Per Feature

| Feature | Primary Files | Secondary Files |
|---------|--------------|-----------------|
| F1: State recovery | All 7 SKILL.md Step 1 sections | templates/state.yml.template |
| F2: State splitting | All 7 SKILL.md `!cat` injections, templates/ | status SKILL.md (reads all files) |
| F3: Skill sizing | All skills over 500 lines + new references/ files | None |
| F4: Explore subagent | prompt-codebase-analyst.md (1 line) | research SKILL.md Step 8 (if dispatch logic changes) |
| F5: Git commits | execute SKILL.md Step 5 | checkpoint.yml schema |
| F6: External verifier | NEW prompt-research-verifier.md, research SKILL.md (new step) | G2 gate criteria |
| F7: Alt surfacing | prompt-design-guide.md, prompt-plan-guide.md | None |

## Sources

- Codebase analysis: All 7 SKILL.md files, 9 prompt templates, state.yml.template, plugin.json
- Prior research: `.planning/research/expedite-audit/AUDIT-ACTIONS.md` (DEFER-4/5/6/9/10/13/14 analysis)
- Design decisions: `memory/phase5-verifier-design.md`, `memory/plan-spike-execute-architecture.md`
- Original spec: `.planning/research/arc-implementation/design/PRODUCT-DESIGN.md` (explore subagent type, line 565)
- v1.0 implementation decisions: `.planning/milestones/v1.0-phases/03-prompt-template-system/03-RESEARCH.md` (explore vs general-purpose analysis)
- GSD patterns: DEFER-14 git commit format reference (conventional commits, specific file staging)
- Confidence note: WebSearch, WebFetch, and Brave Search were all unavailable during this research session. Findings about the `explore` subagent type's exact tool set rely on training data and prior project research, not current documentation verification.

---
*Research completed: 2026-03-11*
