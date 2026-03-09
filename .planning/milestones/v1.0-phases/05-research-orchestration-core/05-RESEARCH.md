# Phase 5: Research Orchestration Core - Research

**Researched:** 2026-03-04
**Domain:** Multi-agent orchestration, source-affinity batching, parallel dispatch, evidence collection, failure handling
**Confidence:** HIGH

## Summary

Phase 5 implements the research skill's core orchestration plumbing: reading the approved SCOPE.md and state.yml question plan, grouping questions into source-affinity batches, presenting the batch plan for user approval, pre-validating sources (especially MCP), dispatching up to 3 parallel research subagents via the Task() API, and collecting evidence files with failure tracking. Quality assessment, G2 gate, gap-fill, and synthesis belong to Phase 6.

The implementation is well-grounded in existing project artifacts. Three per-source prompt templates already exist from Phase 3 (web-researcher, codebase-analyst, mcp-researcher), each with frontmatter specifying `subagent_type: general-purpose` and `model: sonnet`. The state.yml template already defines per-question status tracking fields (`status`, `source`, `evidence_files`, `gap_details`). The sources.yml template defines the source registry with enabled/disabled flags and tool lists. The primary implementation work is writing the orchestration logic in `skills/research/SKILL.md` that ties these existing pieces together.

The user has made several decisions in CONTEXT.md that simplify the implementation compared to the original product design: no automated retry logic (user controls recovery), no question duplication across batches, pre-validation of sources before dispatch, fully parallel dispatch of all batches simultaneously, and dynamic question discovery queued until after all agents finish (not mid-research). The circuit breaker pattern from the original design is effectively replaced by a simpler detect-and-surface-to-user model.

**Primary recommendation:** Build the SKILL.md as a linear step sequence (similar to scope's 9-step pattern) that reads scope artifacts, forms batches by source affinity, gets user approval, validates sources, dispatches subagents in parallel, collects results, updates state, and surfaces any failures/discoveries for user decision.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- No question duplication across batches -- each question is assigned to one source only
- User sees and approves the batch plan before any agents are dispatched
- Sources.yml defines what sources are available; the research skill assigns sources per question based on what's needed to answer it
- User can modify source assignments in the batch review step
- No token limit on evidence file content -- agents write as much as they find
- Light notification per agent completion ("Evidence for Q3, Q5 written to evidence-batch-02.md") -- user reads files if curious
- Source citations are best-effort -- include where available but don't fail if a source can't be cited precisely
- The synthesis (Phase 6) is the primary user-facing artifact, not individual evidence files
- All batches dispatch simultaneously (fully parallel)
- Dynamic question discovery: proposed new questions are queued and presented to user after ALL agents finish, not mid-research
- Research subagents use Sonnet model tier (as specified in existing prompt template frontmatter)
- Progress updates shown as agents complete ("Batch 1 complete (web) -- 2 remaining")
- Pre-validate all configured sources (especially MCP) BEFORE dispatching any agents -- surface broken sources upfront so user can fix before research starts
- MCP source failures surface immediately with clear messaging about connection issues
- On any agent/source failure: surface to user with options to fix the connection, try a different source, or skip those questions
- No automated retry logic -- user is in control of recovery decisions
- Failed/skipped questions tracked for Phase 6 gap-fill awareness

### Claude's Discretion
- Batch grouping algorithm (source-affinity, merge/split thresholds, or simpler topic-based grouping -- whatever is intuitive)
- Evidence file directory layout and naming conventions
- Whether agent return summaries (500-token) add orchestration value or if simpler success/fail signals suffice
- UNAVAILABLE-SOURCE vs NOT COVERED distinction for skipped questions
- Multi-source routing strategy (how to assign best single source per question)

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| RSCH-01 | Questions grouped into 3-5 batches by source-affinity (web, codebase, MCP) with every DA covered by at least one research question | Source-affinity grouping pattern from research synthesis DA-8; sources.yml provides source registry; SCOPE.md provides DA-to-question mapping; state.yml `source_hints` field drives affinity grouping |
| RSCH-02 | Up to 3 research subagents dispatched in parallel via Task() API | Task() API pattern proven by both reference implementations; `prompt` + `description` + `subagent_type` required parameters; fan-out/fan-in pattern from research synthesis DA-4; user decision: fully parallel dispatch |
| RSCH-03 | Each subagent uses per-source prompt template (web-researcher.md, codebase-analyst.md, mcp-researcher.md) | All 3 templates already exist in `skills/research/references/` from Phase 3; each has frontmatter with model: sonnet, subagent_type: general-purpose; template variable placeholders ({{questions_yaml_block}}, {{output_file}}, etc.) ready for orchestrator injection |
| RSCH-04 | Each subagent writes detailed findings to evidence files and returns condensed summary (max 500 tokens) | Dual-target output pattern already specified in all 3 prompt templates; evidence file format with per-question sections, findings, requirement assessment, gaps; condensed return format (KEY FINDINGS, CONFIDENCE, SOURCES, GAPS, PROPOSED_QUESTIONS) |
| RSCH-09 | Source routing with circuit breaker: retry once on server failure, never retry platform failures, classify as UNAVAILABLE-SOURCE | User decision overrides original circuit breaker: NO automated retry -- surface failures to user with options (fix/reroute/skip); three-tier failure taxonomy (server/platform/no-results) remains in subagent prompts for classification; orchestrator surfaces classification to user for decision |
| RSCH-14 | Every DA from scope has at least one research question covering it | Structural validation at batch formation time -- read SCOPE.md DAs, cross-reference with state.yml questions by `decision_area` field, flag any uncovered DAs before proceeding |
| RSCH-15 | Research agents receive evidence requirements for their batch -- agents know what specific evidence to find, not just the topic | Evidence requirements already stored per-question in state.yml `evidence_requirements` field and in SCOPE.md; prompt templates already have `{{questions_yaml_block}}` placeholder; orchestrator constructs YAML block with id, text, priority, decision_area, evidence_requirements for each batch question |
</phase_requirements>

## Standard Stack

### Core
| Component | Location | Purpose | Why Standard |
|-----------|----------|---------|--------------|
| Task() API | Claude Code built-in | Parallel subagent dispatch | Only mechanism for spawning parallel agents; proven by both reference implementations |
| SKILL.md orchestrator | `skills/research/SKILL.md` | Step-by-step orchestration logic | Same pattern as scope skill (Phase 4); proven 9-step pattern |
| Prompt templates | `skills/research/references/prompt-*.md` | Per-source agent instructions | Already created in Phase 3; frontmatter-driven model/type selection |
| state.yml | `.expedite/state.yml` | Question status tracking, phase transitions | Established in Phase 2; per-question flat objects with status field |
| sources.yml | `.expedite/sources.yml` | Source registry with enabled/disabled flags | Established in Phase 2; persists across lifecycles |
| SCOPE.md | `.expedite/scope/SCOPE.md` | DA definitions, question plan, evidence requirements | Produced by scope skill (Phase 4); contract chain origin |

### Supporting
| Component | Purpose | When to Use |
|-----------|---------|-------------|
| AskUserQuestion | Batch plan approval, failure recovery options, dynamic question approval | Structured choices with 2-4 options |
| Freeform prompts | User modifications to batch plan | Open-ended user input |
| Bash (mkdir -p) | Creating evidence output directories | Before first dispatch |
| Read/Write tools | Loading templates, writing evidence files | Template loading, state updates |
| Glob | Finding template files by pattern | Resolving template paths |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Source-affinity batching | Topic-based batching | User decision leaves this to Claude's discretion; source-affinity preferred because it aligns with per-source prompt templates |
| Single-source-per-question | Multi-source-per-question | User decision: no question duplication across batches; simpler but may miss cross-source corroboration (addressed in Phase 6 gap-fill) |
| User-controlled failure recovery | Automated circuit breaker retry | User decision: no automated retries; user stays in control of recovery |

## Architecture Patterns

### Recommended Project Structure
```
.expedite/
  research/                    # Created by this phase
    evidence-batch-01.md       # Per-batch evidence files
    evidence-batch-02.md
    evidence-batch-03.md
  state.yml                    # Updated: phase, question statuses
  scope/
    SCOPE.md                   # Read-only input (from Phase 4)
  sources.yml                  # Read-only input (from Phase 2)

skills/
  research/
    SKILL.md                   # Orchestration logic (this phase writes body)
    references/
      prompt-web-researcher.md       # Already exists (Phase 3)
      prompt-codebase-analyst.md     # Already exists (Phase 3)
      prompt-mcp-researcher.md       # Already exists (Phase 3)
      prompt-research-synthesizer.md # Phase 6
      prompt-sufficiency-evaluator.md # Phase 6
```

### Pattern 1: Step-Sequence Orchestration (from Scope Skill)
**What:** The SKILL.md contains numbered steps that execute linearly. Each step has clear inputs, actions, and outputs. Steps that require user input pause and wait. Steps that update state use the backup-before-write pattern.
**When to use:** Any skill that orchestrates a multi-step workflow with user interaction points.
**Why proven:** Scope skill (Phase 4) uses this exact pattern with 9 steps. Human-verified to work end-to-end. The research skill follows the same pattern.

### Pattern 2: Template Loading + Prompt Construction
**What:** Read prompt template from `references/`, extract frontmatter metadata (model, subagent_type), combine static template content with dynamic context (question data, output paths, project metadata), pass assembled prompt to Task().
**When to use:** Every subagent dispatch.
**Evidence:** Research-engine demonstrates this exact pattern. All 3 prompt templates already have `{{variable}}` placeholders for dynamic injection.

### Pattern 3: Fan-Out / Fan-In Parallel Dispatch
**What:** Spawn all research agents simultaneously (fully parallel per user decision), wait for all to complete, then process results. Each agent writes to a designated file; orchestrator reads files after completion.
**When to use:** Research dispatch step.
**Evidence:** Research-engine spawns per-category agents "all in parallel." Task() calls can be issued concurrently -- the orchestrator explicitly instructs parallel dispatch. Up to 3 concurrent agents per user decision and Anthropic's recommendation.

### Pattern 4: Backup-Before-Write State Updates
**What:** (1) Read state.yml, (2) cp state.yml state.yml.bak, (3) modify in-memory, (4) write entire file. Never partial updates.
**When to use:** Every state.yml mutation (phase transition, question status updates, batch tracking).
**Evidence:** Established pattern from Phase 2, used throughout scope skill. YAML safety practices validated by state management research.

### Pattern 5: Source Pre-Validation
**What:** Before dispatching any agents, attempt a lightweight probe of each configured MCP source (e.g., a simple tool call). If it fails, surface the failure to the user immediately with recovery options. Web and codebase sources are always available and skip pre-validation.
**When to use:** After batch plan approval, before dispatch.
**Evidence:** User decision: "Pre-validate all configured sources (especially MCP) BEFORE dispatching any agents." No programmatic availability API exists for MCP servers -- must use optimistic invocation with error detection. This prevents token waste on agents that will fail.

### Anti-Patterns to Avoid
- **Automated retry without user consent:** User explicitly decided no automated retry logic. Surface failures with options, let user decide.
- **Question duplication across batches:** Each question goes to exactly one batch/source. Cross-source corroboration is a Phase 6 gap-fill concern.
- **Reading full evidence files in orchestrator context:** Evidence files can be arbitrarily large (no token limit per user decision). The orchestrator should only read the condensed return summary from each agent, not the full evidence file.
- **Presenting dynamic questions mid-research:** Per user decision, proposed new questions are queued until ALL agents finish. Never interrupt ongoing research with discovery prompts.
- **Hardcoding source assignments:** Sources should be assigned based on question `source_hints` from scope, not hardcoded in the SKILL.md. The user can modify assignments during batch review.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Template variable substitution | Custom regex replacement engine | String replacement of `{{var}}` placeholders | Simple find-replace is sufficient; templates use consistent `{{variable_name}}` syntax |
| YAML state parsing | Custom YAML parser | Claude's native YAML reading + complete-file rewrite | LLMs read YAML natively; complete-file rewrite is the established pattern |
| Source availability checking | Custom health-check system | Optimistic invocation + error detection | No MCP availability API exists; the only way to check is to try |
| Progress tracking | Custom polling loop | Natural Task() completion events + sequential processing | Task() blocks until completion; process results as they return |

**Key insight:** The orchestration logic lives entirely in the SKILL.md prompt -- there are no external scripts, libraries, or custom tools. Claude follows the step-by-step instructions, uses built-in tools (Task, Read, Write, AskUserQuestion, Bash), and the prompt templates define agent behavior. The complexity is in prompt design, not code design.

## Common Pitfalls

### Pitfall 1: Subagent Context Bloat
**What goes wrong:** Each subagent starts with ~50K tokens of overhead (global config, MCP tool descriptions). Adding too much question context pushes the effective prompt beyond useful limits.
**Why it happens:** The orchestrator inlines SCOPE.md context, all question details, and project metadata into each subagent prompt.
**How to avoid:** Keep the injected context minimal -- only the questions assigned to that batch, their evidence requirements, source hints, and essential project metadata (project_name, intent, research_round). Target ~5K tokens for the injected content. The prompt template already handles structure; the orchestrator adds only data.
**Warning signs:** Subagents producing shallow or truncated evidence; subagents ignoring later questions in their batch.

### Pitfall 2: Lost Template Placeholders
**What goes wrong:** The orchestrator fails to replace all `{{variable}}` placeholders in the prompt template before passing to Task(), resulting in agents seeing literal `{{question_text}}` in their prompts.
**Why it happens:** Templates have many placeholders (questions_yaml_block, output_file, batch_id, timestamp, project_name, intent, research_round, output_dir, codebase_root, mcp_sources). Missing any one produces a broken prompt.
**How to avoid:** After template variable substitution, verify no `{{` patterns remain in the assembled prompt. If any remain, the SKILL.md should flag the error before dispatch.
**Warning signs:** Agents asking "what questions should I research?" or producing evidence for generic topics.

### Pitfall 3: Silent MCP Failures
**What goes wrong:** An MCP source is configured in sources.yml but the MCP server is not running or misconfigured. Without pre-validation, an entire batch of questions dispatched to that source returns no evidence.
**Why it happens:** No programmatic API to check MCP availability. sources.yml says it's enabled, but the runtime environment disagrees.
**How to avoid:** Pre-validate MCP sources before dispatch (user decision). Attempt a lightweight MCP tool call. Surface failures immediately with clear messaging.
**Warning signs:** Batch evidence files containing only "UNAVAILABLE" status for all MCP tools.

### Pitfall 4: Batch Plan Lacks DA Coverage
**What goes wrong:** The batch formation algorithm assigns all questions from a DA to a single source, but that source fails or is unavailable. The entire DA has no evidence.
**Why it happens:** Source-affinity grouping may cluster DA questions by source, creating single-point-of-failure per DA.
**How to avoid:** During batch formation, verify every DA has at least one question in a viable batch (RSCH-14). If a source fails and it was the sole source for a DA, surface this to the user as a critical gap requiring rerouting.
**Warning signs:** Post-dispatch, any DA with zero evidence files.

### Pitfall 5: State Update Race Condition on Parallel Completion
**What goes wrong:** Multiple agents complete near-simultaneously, and the orchestrator attempts to update state.yml for each without re-reading between updates, potentially losing question status updates.
**Why it happens:** Task() calls complete asynchronously. If the orchestrator processes results in a loop, it might read state once and write back after all updates, missing intermediate changes.
**How to avoid:** Process agent completions sequentially even though dispatch is parallel. After each agent's results are processed, do a full backup-before-write cycle for state.yml. Since Task() blocks the orchestrator while waiting, completions are actually processed one at a time as they return.
**Warning signs:** Question statuses in state.yml not matching evidence file contents.

## Code Examples

### Batch Formation from Source Hints
```yaml
# Input: questions from state.yml
questions:
  - id: "q01"
    text: "How do competitors handle auth?"
    source_hints: ["web"]
    decision_area: "Authentication"
    evidence_requirements: "At least 2 competitor implementations documented"
  - id: "q02"
    text: "What auth patterns exist in codebase?"
    source_hints: ["codebase"]
    decision_area: "Authentication"
    evidence_requirements: "Current auth module structure with file paths"
  - id: "q03"
    text: "What do GitHub issues say about auth pain points?"
    source_hints: ["mcp"]
    decision_area: "Authentication"
    evidence_requirements: "Top 5 auth-related issues by reaction count"

# Output: batch plan presented to user
Batch 1 (web): q01 - "How do competitors handle auth?" [DA: Authentication]
Batch 2 (codebase): q02 - "What auth patterns exist in codebase?" [DA: Authentication]
Batch 3 (mcp: github): q03 - "What do GitHub issues say about auth pain points?" [DA: Authentication]
```

### Template Variable Injection
```
# Orchestrator reads template:
template = Read("skills/research/references/prompt-web-researcher.md")

# Extract frontmatter:
# subagent_type: general-purpose
# model: sonnet

# Replace placeholders:
# {{project_name}} -> state.yml project_name
# {{intent}} -> state.yml intent
# {{research_round}} -> 1 (or current round)
# {{output_dir}} -> ".expedite/research"
# {{output_file}} -> ".expedite/research/evidence-batch-01.md"
# {{batch_id}} -> "batch-01"
# {{timestamp}} -> current ISO timestamp
# {{questions_yaml_block}} -> YAML block of assigned questions with evidence requirements

# Dispatch:
Task(
  prompt: assembled_prompt,
  description: "Web research for batch-01 (q01, q04, q07)",
  subagent_type: "general-purpose"
)
# Note: model from frontmatter (sonnet) is NOT a Task() parameter in Claude Code;
# it is specified via the prompt template frontmatter which the Task runtime reads.
```

### Evidence File Naming Convention
```
.expedite/research/
  evidence-batch-01.md    # Web research batch
  evidence-batch-02.md    # Codebase analysis batch
  evidence-batch-03.md    # MCP research batch (if applicable)
```

### User-Facing Batch Plan Display
```
--- Research Batch Plan ---

Batch 1 (web) - 4 questions:
  [P0] q01: How do competitors handle auth? [DA: Authentication]
  [P1] q04: What are common auth token patterns? [DA: Authentication]
  [P1] q07: What OAuth providers have best docs? [DA: Integration]
  [P2] q10: What auth libraries are trending? [DA: Tools]

Batch 2 (codebase) - 3 questions:
  [P0] q02: What auth patterns exist in codebase? [DA: Authentication]
  [P0] q05: How are API keys currently managed? [DA: Security]
  [P1] q08: What test coverage exists for auth? [DA: Quality]

Batch 3 (mcp: github) - 2 questions:
  [P1] q03: What do GitHub issues say about auth? [DA: Authentication]
  [P2] q06: What auth PRs were recently merged? [DA: Implementation]

--- 9 questions across 5 DAs, 3 batches ---
Approve this plan? (approve / modify / cancel)
```

### Agent Completion Notification
```
Batch 1 complete (web) -- Evidence for q01, q04, q07, q10 written to evidence-batch-01.md (2 remaining)
Batch 3 complete (mcp: github) -- Evidence for q03, q06 written to evidence-batch-03.md (1 remaining)
Batch 2 complete (codebase) -- Evidence for q02, q05, q08 written to evidence-batch-02.md (0 remaining)

All research agents complete.
```

### Failure Surface Pattern
```
Source pre-validation failed:
  [FAIL] mcp: github -- Connection refused (MCP server not running)

Options:
1. Fix connection -- Start the GitHub MCP server and retry validation
2. Reroute questions -- Move q03, q06 to web search instead
3. Skip questions -- Mark q03, q06 as UNAVAILABLE-SOURCE and continue

Which would you like to do?
```

## State of the Art

| Old Approach (Original Design) | Current Approach (User Decisions) | Impact |
|-------------------------------|----------------------------------|--------|
| Automated circuit breaker retry | User-controlled recovery | Simpler orchestrator logic; user stays in control |
| Per-question subagent dispatch | Source-affinity batch dispatch | Fewer agents, better context coherence, lower token cost |
| 60-second progress polling | Completion-based notifications | Feasible with Task() API (polling was infeasible) |
| Mid-research dynamic question presentation | Post-research queue-and-present | Simpler orchestration; no mid-flight interruption |

## Open Questions

1. **Batch merge/split thresholds**
   - What we know: User left batch grouping algorithm to Claude's discretion. Source-affinity is the primary grouping axis.
   - What's unclear: If a source type has only 1 question, should it get its own batch or merge with a related batch? If a source type has 8 questions, should it split into 2 batches?
   - Recommendation: Default to one batch per enabled source type. Merge single-question sources into the most related batch (by DA affinity). Do not split large batches -- the 3-5 batch target and max 3 concurrent agents naturally constrain this. Keep it simple; the user can modify in review.

2. **Agent return summary utility**
   - What we know: Prompt templates define a 500-token condensed return format. User left it to Claude's discretion whether these add orchestration value.
   - What's unclear: Whether the orchestrator needs the structured summary (KEY FINDINGS, CONFIDENCE, SOURCES, GAPS) for anything beyond progress display.
   - Recommendation: Keep the condensed return. It provides the GAPS list needed to update question statuses without reading full evidence files. It also provides PROPOSED_QUESTIONS for dynamic discovery processing. Minimal overhead since the template already specifies the format.

3. **UNAVAILABLE-SOURCE vs NOT COVERED semantics**
   - What we know: User left this distinction to Claude's discretion. Subagent prompts already define source_status blocks with failure classification.
   - What's unclear: Whether the distinction matters for Phase 6 gap-fill routing (retry with same source vs. try different source).
   - Recommendation: Use UNAVAILABLE-SOURCE when the source itself failed (MCP down, tool errors). Use NOT COVERED when the source worked but returned no relevant evidence. This distinction directly informs gap-fill: UNAVAILABLE-SOURCE questions should be rerouted to a different source; NOT COVERED questions may need different search strategies on the same source.

4. **MCP pre-validation probe method**
   - What we know: No programmatic MCP availability API. Must use optimistic invocation.
   - What's unclear: What constitutes a "lightweight probe" for an arbitrary MCP server. Different MCP servers have different tool APIs.
   - Recommendation: For each MCP source in sources.yml, attempt to call the first tool listed in its `tools` array with minimal parameters. If the tool returns `isError: true` with a platform failure (server not connected), classify as unavailable. If it returns data or a server error, classify as available. This is imperfect but catches the most common failure mode (MCP server not running).

## Sources

### Primary (HIGH confidence)
- Existing project artifacts: `skills/research/references/prompt-web-researcher.md`, `prompt-codebase-analyst.md`, `prompt-mcp-researcher.md` -- all 3 prompt templates with complete structure, frontmatter, and placeholder syntax
- Existing project artifacts: `templates/state.yml.template`, `templates/sources.yml.template` -- state schema and source registry structure
- Existing project artifacts: `skills/scope/SKILL.md` -- proven 9-step orchestration pattern
- `.planning/research/arc-implementation/research-synthesis.md` DA-4 (Subagent Orchestration) and DA-8 (Research Phase Orchestration) -- Task() API patterns, fan-out/fan-in, source-affinity batching
- `.planning/research/arc-implementation/READINESS.md` -- all 10 DAs verified READY with converging evidence

### Secondary (MEDIUM confidence)
- `.planning/research/arc-implementation/research-synthesis.md` DA-5 (Source Routing) -- MCP integration patterns, optimistic invocation, circuit breaker prompt patterns
- Phase 5 CONTEXT.md user decisions -- locked implementation choices constraining this phase

### Tertiary (LOW confidence)
- MCP pre-validation probe method -- no established pattern; recommendation is derived from platform constraints rather than proven practice

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all components already exist in the project (templates, state schema, sources config)
- Architecture: HIGH -- step-sequence pattern proven in Phase 4 scope skill; Task() patterns proven by reference implementations
- Pitfalls: HIGH -- informed by prior research synthesis and practical experience with the project's patterns

**Research date:** 2026-03-04
**Valid until:** 2026-04-03 (stable -- all components are internal project artifacts, not external dependencies)
