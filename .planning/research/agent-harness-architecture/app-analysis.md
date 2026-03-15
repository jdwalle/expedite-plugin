# App Analysis: Agent Harness Architecture for Expedite

## Current State

### DA-1: Hook Architecture

**What exists today:** Expedite uses **zero hooks**. There are no PreToolUse, PostToolUse, SessionStart, Notification, Stop, or any other hook implementations anywhere in the codebase. The `.claude-plugin/plugin.json` contains only name, version, description, and author fields -- no hook registrations.

**Current enforcement surface:** All behavioral guardrails are implemented as natural language instructions within SKILL.md files. The only code-adjacent enforcement mechanism is the `!cat .expedite/state.yml 2>/dev/null || echo "No active lifecycle"` frontmatter injection, which runs a shell command at skill load time to inject state into the prompt context. This is not a hook -- it is a frontmatter convention.

**Relevant files:**
- `.claude-plugin/plugin.json` -- Plugin registration, no hooks defined
- Every SKILL.md file begins with the `!cat` injection pattern in its frontmatter block

**Infrastructure gap:** The plugin has no hook infrastructure whatsoever. Any hook-based enforcement would be built from scratch. The REQUIREMENTS.md explicitly notes `ARCH-07: SessionStart hook for automatic context injection (blocked by 3 Claude Code platform bugs)` as deferred to v2, with specific bug references (#16538, #13650, #11509).

### DA-2: State Management

**What exists today:** A single monolithic `state.yml` file at `.expedite/state.yml` with complete-file rewrite semantics and a backup-before-write protocol.

**State schema** (from `templates/state.yml.template`):
- `version: "1"` -- schema version
- `last_modified` -- ISO 8601 timestamp
- Identity fields: `project_name`, `intent`, `lifecycle_id`, `description`
- Position tracking: `phase` (forward-only enum), `current_task`, `current_step` (skill/step/label triple)
- Reserved v2 fields: `imported_from`, `constraints`
- Research tracking: `research_round`
- `questions[]` -- flat list, each with id/text/priority/decision_area/source_hints/evidence_requirements/status/source/gap_details/evidence_files
- `gate_history[]` -- flat list, each with gate/timestamp/outcome/must_passed/must_failed/should_passed/should_failed/notes/overridden
- Execution: `tasks[]`, `current_wave`

**Write pattern** (enforced via prompt instructions in every skill):
1. Read current state.yml
2. `cp .expedite/state.yml .expedite/state.yml.bak` (via Bash)
3. Modify in-memory representation
4. Write entire file back

**Design constraints:**
- Max 2 nesting levels (flat structure constraint documented in SKILL.md)
- YAML flow-style arrays for source_hints and evidence_files
- Complete-file rewrite on every update (not append, not patch)
- DA-level metadata (name, depth, readiness) lives ONLY in SCOPE.md, NOT in state.yml

**Additional state files:**
- `.expedite/sources.yml` -- Source configuration (web, codebase, MCP). Persists across lifecycles.
- `.expedite/log.yml` -- Telemetry log, append-only multi-document YAML (gitignored)
- `.expedite/plan/phases/{slug}/checkpoint.yml` -- Per-phase execution checkpoint (current_task, tasks_completed, status, continuation_notes)

**Known problems** (from REQUIREMENTS.md and project context):
- ARCH-02 through ARCH-06 (all pending) address splitting state.yml into scoped files: state.yml (~15 lines), questions.yml, tasks.yml, gates.yml
- State file grows with questions and gate history, wasting tokens when injected into skills that don't need all fields
- Recovery is artifact-based (PLAN.md > DESIGN.md > SYNTHESIS.md > SCOPE.md scan in reverse lifecycle order)

**Relevant files:**
- `templates/state.yml.template` -- State schema template
- `templates/sources.yml.template` -- Source config template
- `skills/shared/ref-state-recovery.md` -- Recovery protocol
- Every SKILL.md -- Contains backup-before-write instructions at every step

### DA-3: Agent Definition and Coordination

**What exists today:** Agents are defined as prompt templates in `skills/{skill}/references/prompt-*.md` files. There are no standalone agent .md files, no agent frontmatter schema, and no formal agent registry.

**Agent templates (dispatched via Task()):**
1. `prompt-web-researcher.md` -- frontmatter: `subagent_type: general-purpose, model: sonnet`
2. `prompt-codebase-analyst.md` -- frontmatter: `subagent_type: general-purpose, model: sonnet`
3. `prompt-mcp-researcher.md` -- frontmatter: `subagent_type: general-purpose, model: sonnet`
4. `prompt-sufficiency-evaluator.md` -- frontmatter: `subagent_type: general-purpose, model: sonnet`
5. `prompt-research-synthesizer.md` -- frontmatter: `subagent_type: general-purpose, model: opus`
6. `prompt-spike-researcher.md` -- frontmatter: `subagent_type: general-purpose, model: sonnet`

**Dispatch pattern:** The research SKILL.md (the orchestrator) reads the template, replaces `{{placeholders}}`, and dispatches via `Task(prompt, description, subagent_type)`. Maximum 3 concurrent agents.

**Coordination model:** None. Agents:
- Cannot see each other's output during execution
- Cannot share intermediate state
- Cannot signal failures to each other
- Write their results to disk (evidence files) and return a condensed 500-token summary
- Are coordinated entirely by the orchestrating skill, which collects results serially after all dispatches complete

**Inter-agent data flow:** Artifact hand-off only. The research synthesizer reads ALL evidence files itself (via `<self_contained_reads>` instructions). The sufficiency evaluator reads evidence files AND scope artifacts itself. There is no message-passing or shared state.

**Inline references (not dispatched as agents):**
1. `prompt-scope-questioning.md` -- Quality reference for question plan generation
2. `prompt-design-guide.md` -- Quality reference for design document generation
3. `prompt-plan-guide.md` -- Quality reference for plan generation
4. `prompt-task-verifier.md` -- Inline verification process (runs in main session)

### DA-4: Worktree Isolation

**What exists today:** Zero worktree usage. There are no `EnterWorktree` or `ExitWorktree` calls anywhere. No skill references worktrees. The `allowed-tools` frontmatter in skill files does not include worktree tools.

**Operations that might benefit from isolation:**
- Research agents (write evidence files but don't modify source code)
- Execute skill (modifies actual source code -- highest isolation value)
- Spike researcher (writes spike research files)

**Current isolation model:** All agents and the main session operate on the same filesystem. The execute skill creates per-phase directories (`.expedite/plan/phases/{slug}/`) for artifacts but does not isolate code changes.

### DA-5: Quality Gate Enforcement

**What exists today:** Five quality gates (G1-G5), all implemented as natural language evaluation instructions within their respective SKILL.md files. Gates are "inline" -- evaluated by the producing skill, not by a separate gate skill or hook.

**Gate inventory:**

| Gate | Skill | Type | MUST Criteria | SHOULD Criteria |
|------|-------|------|---------------|-----------------|
| G1 | Scope (Step 10) | Structural | 6 (SCOPE.md exists, 3+ questions, intent declared, success criteria, evidence requirements, DA readiness) | 3 (source hints, 2+ DAs, max 15 questions) |
| G2 | Research (Step 14) | Count-based | 5 (all assessed, majority covered, P0 covered/partial, no unresolved unavailable, all DA readiness MET) | 3 (all covered, no partial, all evidence MET) |
| G3 | Design (Step 8) | LLM judgment + structural | 5 (every DA has decision, evidence references, correct format, non-empty, readiness criteria addressed) | 4 (trade-offs, confidence levels, genuine open questions, HANDOFF.md for product) |
| G4 | Plan (Step 7) | Structural | 5 (DA coverage, phase sizing, TDs per phase, acceptance criteria traceability, non-empty) | 5 (ordering, estimates/sizing, no orphans, override flags, depth proportionality) |
| G5 | Spike (Step 7) | Structural | 4 (all needs-spike resolved, traceability, rationale recorded, step count bounds) | 4 (spike-specific guidance, task coverage, specific file paths, ambiguity addressed) |

**Gate outcome states:** Go, Go-with-advisory, Recycle, Override (user-initiated only)

**Enforcement mechanism:** All prompt-based. The skill's Step N instructions say "evaluate these criteria" and "if any MUST fails, do X." Anti-bias instructions exist for G3 ("evaluate as if someone else produced this design") but are still prompt-enforced.

**Recycle escalation:** Progressively escalating tone (1st: informational, 2nd: suggest adjustment, 3rd+: recommend override). Documented in `ref-recycle-escalation.md`.

**Override handling:** Documented in `ref-override-handling.md`. Overrides produce an `override-context.md` artifact with severity classification and affected DAs. Gate history records `overridden: true`.

**Known problems (from REQUIREMENTS.md):**
- QUAL-01 through QUAL-04: External verifier agent for research reasoning soundness (pending Phase 24)
- The "rubber stamp" problem is acknowledged -- prompt-enforced gates are susceptible to the evaluating LLM being too lenient

### DA-6: Context and Memory

**What exists today:**

**Session context injection:** The `!cat .expedite/state.yml` frontmatter injection runs on every skill invocation, providing the LLM with current lifecycle state. This is the primary cross-session context mechanism.

**Project memory:** Referenced in `.claude/settings.local.json` -- the user has a project-level memory file at `~/.claude/projects/.../memory/MEMORY.md`. This contains critical design decisions and project context that persists across conversations.

**Artifact-based context:** Skills read upstream artifacts directly:
- Research reads SCOPE.md + sources.yml + state.yml
- Design reads SCOPE.md + SYNTHESIS.md + state.yml
- Plan reads DESIGN.md + SCOPE.md + state.yml
- Spike reads PLAN.md + DESIGN.md + state.yml
- Execute reads PLAN.md + SPIKE.md + DESIGN.md + SCOPE.md + state.yml

**Resume strategy:** Each skill's Step 1 has a Case B handler for `{phase}_in_progress` that reads artifact existence to determine resume point. For example, research skill checks: evidence files exist? sufficiency-results.yml exists? SYNTHESIS.md exists? Each triggers a different resume step.

**State recovery (new in v1.2):** `skills/shared/ref-state-recovery.md` defines artifact-based state reconstruction when state.yml is missing entirely. Scans artifacts in reverse lifecycle order, extracts project_name and phase, writes minimal state.yml.

**Step-level tracking:** `current_step` field in state.yml tracks `{skill, step, label}` for within-skill positioning. Added in v1.1 (Phase 15).

**Context budget:** No explicit context budget management. Skills inject all of state.yml regardless of what they need. REQUIREMENTS.md ARCH-02/03 address this with scoped injection (each skill loads only needed state files).

### DA-7: Skill-Agent Interaction

**What exists today:** Skills are **thick orchestrators** -- they contain all step logic, state management, gate evaluation, user interaction, and agent dispatch instructions. Agents are **thin workers** -- they receive a fully assembled prompt, execute a focused task, write results to disk, and return a condensed summary.

**Skill sizes:**
- `scope/SKILL.md` -- 757 lines (10 steps)
- `research/SKILL.md` -- 860 lines (18 steps)
- `design/SKILL.md` -- 637 lines (10 steps)
- `plan/SKILL.md` -- 626 lines (9 steps)
- `spike/SKILL.md` -- 548 lines (9 steps)
- `execute/SKILL.md` -- 602 lines (7 steps)
- `status/SKILL.md` -- 174 lines (read-only)

**Agent dispatch surface:** Only research and spike skills dispatch agents via Task(). Design, plan, and execute run entirely in the main session. This is a deliberate design decision (PROJECT.md: "No subagents for interactive phases").

**Supervision model:** Skills dispatch agents and wait for completion. No mid-execution monitoring, no progress callbacks, no intervention capability. The only feedback loop is the returned summary and the written evidence file.

### DA-8: Resume and Recovery

**What exists today:**

**Phase-level resume:** Every skill's Step 1 checks the `phase` field in state.yml. If phase is `{skill}_in_progress`, the skill enters Case B resume logic that checks artifact existence to determine the resume step.

**Step-level tracking:** `current_step` in state.yml records `{skill, step, label}` -- but resume logic does NOT use this field. Resume is determined by artifact existence (e.g., "does DESIGN.md exist?"), not by the last step number. The `current_step` field is used by the status skill for display only.

**Per-phase checkpoints (execute only):** `.expedite/plan/phases/{slug}/checkpoint.yml` stores `current_task`, `tasks_completed`, `tasks_total`, `status`, `continuation_notes`. The execute skill reads this on resume to determine which task to continue from.

**Checkpoint reconstruction:** If checkpoint.yml is missing but PROGRESS.md exists, the execute skill parses PROGRESS.md headings to reconstruct the checkpoint.

**State recovery:** `ref-state-recovery.md` handles the extreme case where state.yml itself is missing. Scans for artifacts in reverse lifecycle order, validates content, reconstructs minimal state with `_complete` phase (never `_in_progress`).

**Known problems:**
- Resume is heuristic, not deterministic -- the LLM interprets artifact existence to choose a resume path
- `current_step` is not used for resume, creating a gap between tracking and recovery
- Idempotency is not guaranteed -- re-running a step could duplicate work
- Mid-step crashes leave partial artifacts that confuse the resume heuristic

### DA-9: Ecosystem Discovery

**What exists today:** The codebase follows these patterns that may be common in the ecosystem:

**Patterns already in use:**
- SKILL.md as orchestrator markdown files with YAML frontmatter
- `!cat` shell injection in frontmatter for runtime context
- `allowed-tools` frontmatter for tool restrictions per skill
- `argument-hint` frontmatter for skill arguments
- `references/` subdirectory per skill for auxiliary content
- Task() for subagent dispatch with `subagent_type` and `description`
- Prompt templates with frontmatter metadata (model tier, subagent type)
- YAML state files with backup-before-write protocol
- `.claude-plugin/plugin.json` for plugin registration

**Patterns explicitly referenced as harness-like:**
- The SCOPE.md mentions "claude-code-harness (Chachamaru127)" and "everything-claude-code (affaan-m)" as known exemplars
- The research topic describes the "agent harness pattern" as having "emerged in the Claude Code plugin community"

## Architecture Considerations

### How the Current Architecture Supports Moving to a Harness Model

**Strengths:**
1. **Clean skill/agent separation already exists.** Skills are orchestrators, agents are workers. This maps naturally to a harness where skills become thinner wrappers around a code-enforced state machine and agents become formally defined entities.

2. **State schema is well-defined.** The state.yml template has a clear schema with typed fields, forward-only phase transitions, and documented valid states. This is a strong foundation for a state machine implementation.

3. **Gate criteria are explicit and documented.** Every gate has numbered MUST and SHOULD criteria with specific checking instructions. These could be mechanically translated into code-enforced validators.

4. **Artifact-based data flow is clean.** Each phase produces artifacts consumed by the next phase. This artifact chain could become the backbone of a harness's data flow model.

5. **Phase transition rules are documented.** The state.yml template comments list all valid phase transitions (forward-only), which is the core of a state machine definition.

### How the Current Architecture Constrains a Harness Model

**Constraints:**
1. **Everything is prompt-enforced.** Every state transition, gate evaluation, step tracking update, error handling path, and resume decision is encoded in natural language. Moving to code enforcement requires extracting these rules into a separate enforcement layer.

2. **No programmatic enforcement surface.** There are no hooks, no scripts, no TypeScript/JavaScript files. The entire plugin is Markdown and YAML. A harness needs at least some executable code (hooks, validators, state machine logic).

3. **Skills are monolithic orchestration scripts.** Each SKILL.md contains 500-860 lines of interleaved state management, user interaction, agent dispatch, and business logic. Extracting harness-enforceable concerns requires significant decomposition.

4. **State is injected as raw text.** The `!cat state.yml` injection provides the full file content as unstructured text that the LLM must parse. A harness would benefit from structured state injection (specific fields, not the whole file).

5. **Resume logic is heuristic.** The artifact-existence-based resume approach works but is fragile. A harness would need deterministic resume from checkpoint state, not heuristic interpretation.

## Existing Patterns

### Patterns That Map to Harness Conventions

| Current Pattern | Harness Equivalent | Notes |
|----------------|-------------------|-------|
| SKILL.md with frontmatter | Skill definition files | Standard Claude Code convention |
| `allowed-tools` frontmatter | Tool restrictions per skill | Already enforced by platform |
| `!cat` shell injection | Context injection / state subscription | Could become hook-mediated |
| prompt-*.md with frontmatter | Agent definition files | Could gain richer frontmatter schema |
| Task() dispatch | Agent dispatch API | Could gain coordination layer |
| state.yml phase field | State machine current state | Could become code-enforced FSM |
| backup-before-write | Transaction protocol | Could become platform-managed |
| Gate MUST/SHOULD criteria | Validation rules | Could become code-enforced checks |
| `log.yml` append | Event log / audit trail | Could become structured event bus |
| `checkpoint.yml` | Agent checkpoint protocol | Execute skill only; could generalize |

### Conventions Established

1. **Frontmatter conventions:** Skills use `name`, `description`, `allowed-tools`, `argument-hint`. Agent templates use `subagent_type`, `model`. These are consistent and could be extended.

2. **File organization:** `skills/{name}/SKILL.md` + `skills/{name}/references/` + `templates/`. This maps to a harness directory structure.

3. **Artifact naming:** SCOPE.md, SYNTHESIS.md, DESIGN.md, PLAN.md, SPIKE.md, PROGRESS.md. Consistent uppercase naming for lifecycle artifacts.

4. **Phase directory structure:** `.expedite/plan/phases/{slug}/` for per-phase artifacts. Could become a general pattern for all phases.

## Gaps and Needs

### Critical Gaps

1. **No executable code layer.** The plugin has zero TypeScript, JavaScript, Python, or shell scripts. A harness requires executable hooks, validators, or state machine logic. The entire enforcement layer must be created from scratch.

2. **No hook infrastructure.** Not a single hook is registered or implemented. The plugin.json has no hooks section. This is the foundational gap for code-enforced guardrails.

3. **No formal agent registry.** Agents are prompt templates discovered by Glob at dispatch time. A harness needs a registry of agent definitions with capabilities, tool permissions, and coordination metadata.

4. **No inter-agent communication.** Agents write files and return summaries. There is no shared context, message passing, or event signaling between agents.

5. **No state machine enforcement.** Phase transitions are described in comments (`# Valid phases (forward-only transitions)`) but not enforced by anything other than prompt instructions. An LLM could write an invalid phase transition and nothing would prevent it.

6. **No structured output validation.** When agents return results or skills write state, there is no schema validation. A harness needs to validate that state writes conform to schema and agent outputs conform to expected structure.

### Important Gaps

7. **No idempotency guarantees.** Steps that write state or artifacts can be re-run, potentially duplicating data (e.g., appending duplicate log entries, re-adding questions to state.yml).

8. **No context budget management.** Skills inject full state.yml regardless of what they need. No mechanism exists to scope context injection to what a specific skill or agent requires.

9. **No worktree isolation.** Code-modifying operations (execute skill) run in the main worktree with no isolation.

10. **No structured error recovery.** Error handling is described in prompt instructions ("if any move command fails, warn the user but proceed"). A harness would need programmatic error recovery with retry logic and rollback.

## Technical Constraints

1. **Platform constraint -- SessionStart hook bugs.** Three open Claude Code bugs (#16538, #13650, #11509) prevent reliable SessionStart hook usage. Any hook architecture must either work without SessionStart or have fallback behavior.

2. **Platform constraint -- AskUserQuestion timeout.** The 60-second timeout on AskUserQuestion prevents its use in long-running or complex interaction patterns. This is why execute and revision cycles use freeform prompts.

3. **Platform constraint -- MCP foreground only.** MCP tools require foreground execution (GitHub #13254, #19964). Subagents cannot reliably use MCP tools.

4. **Platform constraint -- subagent communication.** Task() dispatched agents cannot communicate with each other or with the parent session during execution. They can only write to disk and return a summary.

5. **Skill size limitation.** Skills are already 500-860 lines. MAINT-01 through MAINT-04 (pending Phase 22) establish a 500-line soft cap. Any harness architecture must keep skill orchestration logic lean.

6. **YAML as state format.** The entire state system uses YAML. While this is LLM-readable, it is not natively parseable by hooks (which would need JSON or a scripting language). Any hook that reads state would need YAML parsing.

7. **No build step.** The plugin has no package.json, no build tooling, no dependency management. Adding TypeScript hooks would require introducing a build pipeline.

## Recommendations

### High-Level Technical Recommendations

1. **Start with hooks for state machine enforcement (DA-1 + DA-2 + DA-5).** The highest-value harness capability is preventing invalid state transitions. A PreToolUse hook that intercepts Write calls to state.yml and validates phase transitions against a whitelist would immediately address state drift, gate bypass, and resume fragility -- the three stated pain points.

2. **Formalize agent definitions before building coordination (DA-3 + DA-7).** Before adding inter-agent communication or team patterns, extract the 6 existing prompt templates into formal agent definition files with richer frontmatter (tool permissions, context requirements, output schema, coordination metadata).

3. **Generalize the checkpoint pattern before tackling resume (DA-8).** The execute skill's checkpoint.yml pattern is the most sophisticated resume mechanism in the codebase. Generalize it to all skills (not just execute) before introducing more complex resume patterns.

4. **Investigate worktree isolation selectively (DA-4).** The execute skill is the only skill that modifies source code. Worktree isolation for execute would provide the highest value with the narrowest blast radius.

5. **Address context budget as part of state splitting (DA-6).** The pending Phase 21 (State Splitting) already plans to split state.yml into scoped files with per-skill injection. The harness architecture should build on this planned work.

6. **Treat ecosystem discovery as the research foundation (DA-9).** The codebase shows a sophisticated system built in isolation without reference to community patterns. Understanding ecosystem convergence will prevent reinventing existing solutions.
