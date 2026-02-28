# Expedite Plugin: Architecture Reference

**Date:** 2026-02-27
**Source:** PRODUCT-DESIGN.md, CONFIDENCE-AUDIT.md, research-synthesis.md, SCOPE.md
**Consumer:** Roadmap planning (ROADMAP.md build-order decisions)

---

## System Overview

Expedite is a Claude Code plugin that orchestrates a 5-phase research-to-implementation lifecycle (Scope, Research, Design, Plan, Execute) plus a Status utility skill. It uses the Claude Code plugin architecture: skills auto-discovered from `skills/{name}/SKILL.md`, prompt templates in `references/` subdirectories, a SessionStart hook for context injection, and Task()-based subagents for parallel research.

The plugin has two distinct file locations:
- **Plugin code** lives at `~/.claude/plugins/expedite/` (cached by Claude Code)
- **Runtime state** lives at `.expedite/` in the project root

These two locations interact through `${CLAUDE_PLUGIN_ROOT}` (templates, prompt references) and the project working directory (state, artifacts).

---

## Component Inventory

### 1. Plugin Manifest (`plugin.json`)

**Location:** `.claude-plugin/plugin.json`
**Role:** Declares plugin identity. Minimal: name, version, description, author.
**Dependencies:** None -- this is the root identity file.
**Interactions:** Claude Code reads this to register the plugin. Skills are auto-discovered from `skills/`, not listed here.

### 2. Hook System (`hooks.json` + `session-start.sh`)

**Location:** `hooks/hooks.json`, `scripts/session-start.sh`
**Role:** Inject lifecycle context on every new session (after `/clear` or new conversation). Reads `.expedite/state.yml` via grep/sed (no yq dependency) and outputs 2-3 lines: project name, current phase, next action.
**Dependencies:** Requires state.yml to exist (created by Scope skill).
**Interactions:** Output is injected into the Claude session as system context. Three open platform bugs (#16538, #13650, #11509) make this unreliable -- two fallback layers exist.
**Platform risk:** HIGH. This is the least reliable component.

### 3. Skill Orchestrators (6 SKILL.md files)

Each skill is a SKILL.md file with YAML frontmatter (name, description, allowed-tools, argument-hint) and markdown body that instructs Claude how to orchestrate a phase. The body is the "orchestration script" -- a numbered sequence of steps Claude follows.

| Skill | Location | Session Type | Subagents? | Gate |
|-------|----------|-------------|-----------|------|
| scope | `skills/scope/SKILL.md` | Main (interactive) | No | G1 (structural) |
| research | `skills/research/SKILL.md` | Main (orchestrator) | Yes (2-5 research + 1 synthesis) | G2 (LLM judgment) |
| design | `skills/design/SKILL.md` | Main (generative) | No | G3 (LLM judgment) |
| plan | `skills/plan/SKILL.md` | Main (generative) | No | G4 (structural) |
| execute | `skills/execute/SKILL.md` | Main (implementation) | No | None (completion check) |
| status | `skills/status/SKILL.md` | Main (read-only) | No | None |

**Critical detail:** Every SKILL.md includes dynamic context injection at the top of its body:
```
!`cat .expedite/state.yml 2>/dev/null || echo "No active lifecycle"`
```
This is a defense-in-depth fallback for when the SessionStart hook fails. The `!command` syntax runs before Claude sees the skill content.

### 4. Prompt Templates (9 reference files)

**Location:** `skills/{phase}/references/prompt-*.md`
**Role:** Static prompt templates loaded by SKILL.md orchestrators. Some are used as subagent prompts (include frontmatter with `subagent_type` and `model`), others as inline reference material.

| Template | Used As | Model |
|----------|---------|-------|
| prompt-scope-questioning.md | Inline reference (main session) | N/A |
| prompt-web-researcher.md | Subagent prompt | sonnet |
| prompt-codebase-analyst.md | Subagent prompt | sonnet |
| prompt-mcp-researcher.md | Subagent prompt | sonnet |
| prompt-research-synthesizer.md | Subagent prompt | opus |
| prompt-sufficiency-evaluator.md | Inline reference | N/A |
| prompt-design-guide.md | Inline reference | N/A |
| prompt-plan-guide.md | Inline reference | N/A |
| prompt-task-verifier.md | Inline reference | N/A |

**8-section structure for all templates:**
1. `<role>` -- Agent expertise and context
2. `<context>` -- Minimal required background
3. `<intent_lens>` -- Product vs. engineering conditional guidance
4. `<downstream_consumer>` -- Who reads the output, what they need
5. `<instructions>` -- Numbered steps with tool guidance
6. `<output_format>` -- Schema-first, dual-target for subagents (file + condensed return)
7. `<quality_gate>` -- Self-check criteria before completing
8. `<input_data>` -- Actual questions/tasks (placed last per Anthropic guidance)

### 5. Configuration Templates (3 template files)

**Location:** `templates/`
**Role:** Seed files copied to `.expedite/` during first `/expedite:scope` invocation.
**Contents:**
- `state.yml.template` -- Initial state schema with version field and all phase values
- `sources.yml.template` -- Default source configuration (web + codebase enabled, MCP sources disabled with setup instructions)
- `gitignore.template` -- Entries for log.yml and state.yml.bak

### 6. State Files (runtime, project root)

**Location:** `.expedite/` at project root
**Role:** The control plane (state.yml) and data plane (Markdown artifacts) for the lifecycle.

| File | Type | Write Pattern | Persistence |
|------|------|--------------|-------------|
| state.yml | Control plane | Complete-file rewrite with backup | Per-lifecycle |
| state.yml.bak | Backup | Auto-created before each state write | Per-lifecycle |
| sources.yml | Configuration | Written once, edited by user | Across lifecycles |
| log.yml | Telemetry | Append-only (`cat >>`) | Across lifecycles (gitignored) |

**Artifact directories:**
- `scope/SCOPE.md` -- Question plan, success criteria, intent
- `research/evidence-batch-{N}.md` -- Per-batch evidence from subagents
- `research/SYNTHESIS.md` -- Evidence organized by decision area
- `research/round-{N}/` -- Gap-fill round artifacts
- `design/DESIGN.md` -- RFC (engineering) or PRD (product)
- `design/HANDOFF.md` -- Product intent only
- `plan/PLAN.md` -- Wave-ordered tasks or epics/stories
- `execute/PROGRESS.md` -- Append-only execution log
- `execute/checkpoint.yml` -- Execution position for pause/resume
- `archive/{slug}/` -- Archived prior lifecycles

### 7. Gate System (inline, not a separate component)

Gates are evaluated inline within each skill's orchestration flow. There is no separate gate skill or shared gate module. Each skill contains gate criteria tables and evaluation logic in its SKILL.md body.

| Gate | Evaluated By | Type | Criteria Count |
|------|-------------|------|---------------|
| G1 | /expedite:scope | Structural (programmatic) | 4 MUST, 3 SHOULD |
| G2 | /expedite:research | LLM judgment | 4 MUST, 3 SHOULD |
| G3 | /expedite:design | LLM judgment | 3 MUST, 4 SHOULD |
| G4 | /expedite:plan | Structural (programmatic) | 5 MUST, 3 SHOULD |

**Outcome logic:**
- All MUST pass + all SHOULD pass = **Go**
- All MUST pass + some SHOULD fail = **Go (advisory)** -- proceed with gap context injected
- Any MUST fails = **Recycle** -- return to phase, escalation on 2nd/3rd recycle
- `--override` flag bypasses recycle/hold for forward progress

---

## Data Flow

### Primary Data Flow (Happy Path)

```
User Input
    |
    v
[/expedite:scope] -- interactive conversation
    |  Reads: templates/ (seed files)
    |  Writes: .expedite/state.yml, .expedite/scope/SCOPE.md, .expedite/sources.yml
    |  Gate: G1 (structural)
    v
[/expedite:research] -- subagent orchestration
    |  Reads: state.yml, SCOPE.md, sources.yml, prompt templates
    |  Spawns: 2-5 research Task() agents (write evidence-batch-{N}.md)
    |  Spawns: 1 synthesis Task() agent (writes SYNTHESIS.md)
    |  Inline: sufficiency assessment, dynamic question discovery
    |  Writes: state.yml (question statuses), evidence files, SYNTHESIS.md
    |  Gate: G2 (LLM judgment)
    v
[/expedite:design] -- main session generation
    |  Reads: state.yml, SCOPE.md, SYNTHESIS.md, prompt-design-guide.md
    |  Writes: .expedite/design/DESIGN.md (+ HANDOFF.md for product intent)
    |  Interactive: revision cycle (max 2 rounds)
    |  Gate: G3 (LLM judgment)
    v
[/expedite:plan] -- main session generation
    |  Reads: state.yml, DESIGN.md, prompt-plan-guide.md
    |  Writes: .expedite/plan/PLAN.md, state.yml (task list)
    |  Interactive: preview and approval
    |  Gate: G4 (structural)
    v
[/expedite:execute] -- main session implementation
    |  Reads: state.yml, PLAN.md, checkpoint.yml
    |  Writes: code files, PROGRESS.md (append), checkpoint.yml, state.yml
    |  Interactive: per-task micro-interaction (yes/pause/review)
    v
Complete
```

### State Flow Between Skills

Skills communicate exclusively through the filesystem. There is no in-memory shared state, no message passing, no event system. The communication channels are:

1. **state.yml** (structured control data) -- Every skill reads state.yml first to determine current phase, questions, gate history, task progress. Every skill writes state.yml to record transitions.

2. **Markdown artifacts** (unstructured content) -- Each skill reads the prior skill's output artifact. Scope produces SCOPE.md, Research produces SYNTHESIS.md, Design produces DESIGN.md, Plan produces PLAN.md. Each artifact is self-contained.

3. **Gate context injection** -- When a gate produces Go (advisory), gap context is injected into the next phase's prompt as a `<known_gaps>` XML block. This injection is ephemeral (constructed at skill invocation time from state.yml data), not persisted as a separate file.

4. **log.yml** (append-only telemetry) -- Written by multiple skills, never read during normal operation. Read only by Status for diagnostics and by v2 calibration.

### Subagent Data Flow (Research Phase Only)

```
research SKILL.md (orchestrator, main session)
    |
    |-- Reads: prompt-web-researcher.md (template + frontmatter)
    |-- Reads: prompt-codebase-analyst.md
    |-- Reads: prompt-mcp-researcher.md
    |-- Inlines: questions, source config, intent lens, prior evidence
    |
    |-- Task(prompt, "general-purpose", sonnet) --> evidence-batch-1.md
    |-- Task(prompt, "explore", sonnet)         --> evidence-batch-2.md  } Up to 3 parallel
    |-- Task(prompt, "general-purpose", sonnet) --> evidence-batch-3.md
    |
    |-- [Orchestrator collects results, runs inline sufficiency assessment]
    |-- [Orchestrator extracts dynamic question proposals from evidence]
    |
    |-- Reads: prompt-research-synthesizer.md
    |-- Task(prompt, "general-purpose", opus)   --> SYNTHESIS.md
    |
    v
[Inline gate G2 evaluation]
```

**Key constraint:** Subagents communicate back to the orchestrator through two channels:
1. **File output** (primary) -- Each subagent writes an evidence file to `.expedite/research/`. The orchestrator reads these files after Task() returns.
2. **Condensed return** (secondary) -- Each subagent returns a ~500 token summary inline (key findings, confidence, source count, gaps, proposed questions). The orchestrator uses this for progress reporting and dynamic question extraction.

Content must be inlined into subagent prompts -- no `@`-references work across Task boundaries.

### Context Reconstruction Flow (After /clear)

```
New Session
    |
    v
[SessionStart hook] -- reads state.yml via shell, outputs 2-3 lines
    |  (may fail due to platform bugs)
    v
[User invokes /expedite:{skill}]
    |
    v
[SKILL.md dynamic injection] -- !`cat .expedite/state.yml`
    |  (always works if state.yml exists)
    v
[Skill reads state.yml, determines phase, proceeds]

Fallback if both fail:
    User runs /expedite:status manually
```

---

## Component Boundaries

### What Talks to What

```
                    Plugin Code                              Runtime State
              (~/.claude/plugins/expedite/)               (.expedite/ at project root)
    +--------------------------------------------+    +---------------------------+
    |                                            |    |                           |
    |  plugin.json  (identity)                   |    |  state.yml  (control)     |
    |                                            |    |  state.yml.bak            |
    |  hooks/hooks.json --> scripts/session-      |--->|  sources.yml              |
    |                       start.sh             |    |  log.yml                  |
    |                                            |    |                           |
    |  skills/scope/SKILL.md ----+               |    |  scope/SCOPE.md           |
    |    references/prompt-*     |               |    |                           |
    |                            |               |    |  research/evidence-*.md   |
    |  skills/research/SKILL.md--+-- read        |    |  research/SYNTHESIS.md    |
    |    references/prompt-*     |   templates   |    |  research/round-{N}/      |
    |                            |   write state |    |                           |
    |  skills/design/SKILL.md ---+-------------->|--->|  design/DESIGN.md         |
    |    references/prompt-*     |               |    |  design/HANDOFF.md        |
    |                            |               |    |                           |
    |  skills/plan/SKILL.md -----+               |    |  plan/PLAN.md             |
    |    references/prompt-*     |               |    |                           |
    |                            |               |    |  execute/PROGRESS.md      |
    |  skills/execute/SKILL.md --+               |    |  execute/checkpoint.yml   |
    |    references/prompt-*                      |    |                           |
    |                                            |    |  archive/{slug}/          |
    |  skills/status/SKILL.md (read-only)        |    |                           |
    |                                            |    |                           |
    |  templates/ (seed files, copied once)  ---->--->|  (initial copies)         |
    +--------------------------------------------+    +---------------------------+
```

**Boundary rules:**
- Skills read templates from `${CLAUDE_PLUGIN_ROOT}` and read/write state at the project root.
- Skills never modify other skills' SKILL.md files.
- Skills never read other skills' reference files directly (each skill loads only its own `references/`).
- The only shared data between skills is state.yml and the Markdown artifacts in `.expedite/`.
- Subagents (Task) only exist within the research skill's orchestration. No other skill spawns subagents.

### Trust Boundaries

- **User trust boundary:** Scope skill is the only phase with extended interactive conversation. Design and Execute have brief approval/revision interactions.
- **Subagent trust boundary:** Research subagents write to specific file paths but their output is validated by the orchestrator's sufficiency assessment before it influences gate outcomes.
- **Platform trust boundary:** SessionStart hook, dynamic `!cat` injection, and Task() API are all platform-dependent. The design includes fallbacks for known instabilities.

---

## Build Order (Dependency Graph)

The following build order respects component dependencies. Components at the same level can be built in parallel.

### Layer 0: Foundation (no dependencies)

| Component | Files | Why First |
|-----------|-------|-----------|
| plugin.json | `.claude-plugin/plugin.json` | Plugin identity. Required for Claude Code to recognize the plugin. |
| Configuration templates | `templates/state.yml.template`, `templates/sources.yml.template`, `templates/gitignore.template` | Seed files that define state schema. No logic, just content. |

**Rationale:** These are static files with no logic. They establish the plugin's identity and the schema for all subsequent state operations.

### Layer 1: State + Context (depends on Layer 0)

| Component | Files | Why Here |
|-----------|-------|----------|
| Status skill | `skills/status/SKILL.md` | Read-only skill that validates state.yml can be read and displayed. Acts as the first integration test for state management. |
| SessionStart hook | `hooks/hooks.json`, `scripts/session-start.sh` | Depends on state.yml schema from templates. Simple shell script, testable independently. |

**Rationale:** Status is the simplest skill (read-only, no subagents, no gates). Building it first validates that SKILL.md frontmatter, dynamic context injection (`!cat`), and state.yml parsing work. The hook is a small shell script that can be tested alongside.

### Layer 2: Scope (depends on Layer 1)

| Component | Files | Why Here |
|-----------|-------|----------|
| Scope skill | `skills/scope/SKILL.md`, `skills/scope/references/prompt-scope-questioning.md` | First skill that writes state. Creates `.expedite/` directory, initializes state.yml, produces SCOPE.md. Includes inline gate G1. |

**Rationale:** Scope is the entry point for every lifecycle. It depends on templates (Layer 0) and validates that state writes, backup-before-write, archival detection, and interactive questioning work. G1 is a structural gate (no LLM judgment), so it validates gate mechanics cheaply.

### Layer 3: Research (depends on Layer 2)

| Component | Files | Why Here |
|-----------|-------|----------|
| Research skill | `skills/research/SKILL.md` | The most complex skill: 11-step orchestration, subagent dispatch, synthesis, sufficiency assessment, dynamic question discovery, G2 gate. |
| Web researcher template | `skills/research/references/prompt-web-researcher.md` | Subagent prompt for web-sourced research. |
| Codebase analyst template | `skills/research/references/prompt-codebase-analyst.md` | Subagent prompt for codebase analysis. |
| MCP researcher template | `skills/research/references/prompt-mcp-researcher.md` | Subagent prompt for MCP-sourced research. |
| Synthesizer template | `skills/research/references/prompt-research-synthesizer.md` | Subagent prompt for evidence synthesis (opus). |
| Sufficiency evaluator template | `skills/research/references/prompt-sufficiency-evaluator.md` | Inline reference for per-question assessment. |

**Rationale:** Research depends on Scope's output (SCOPE.md, state.yml with questions). This is the highest-risk component -- 11-step orchestration in a single SKILL.md with no reference implementation at this complexity. It introduces subagents (Task API), source-affinity batching, condensed returns, and LLM-judged gates. This must be built and tested thoroughly before downstream skills.

**Risk note:** If the 11-step research SKILL.md proves unreliable during implementation, it should be split into sub-invocations (documented in design backlog). The build order should not change -- splitting is an internal refactoring within this layer.

### Layer 4: Design (depends on Layer 3)

| Component | Files | Why Here |
|-----------|-------|----------|
| Design skill | `skills/design/SKILL.md`, `skills/design/references/prompt-design-guide.md` | Reads SYNTHESIS.md from Research. Main-session generation with revision cycle. G3 gate (LLM judgment). Dual output format (RFC/PRD). |

**Rationale:** Design reads Research output. It is simpler than Research (no subagents, no parallel dispatch) but introduces the revision cycle interaction pattern and intent-adaptive output format.

### Layer 5: Plan + Execute (depends on Layer 4)

| Component | Files | Why Here |
|-----------|-------|----------|
| Plan skill | `skills/plan/SKILL.md`, `skills/plan/references/prompt-plan-guide.md` | Reads DESIGN.md. Generates PLAN.md with wave/task structure. G4 gate (structural). |
| Execute skill | `skills/execute/SKILL.md`, `skills/execute/references/prompt-task-verifier.md` | Reads PLAN.md. Implements tasks with checkpoint/resume. No gate (completion check). |

**Rationale:** Plan and Execute depend on Design output but not on each other (Plan produces PLAN.md, Execute consumes it). They can be built in parallel. Plan is straightforward generation. Execute introduces the pause/resume checkpoint pattern and micro-interaction loop.

### Layer 6: Cross-Cutting Concerns (can be added at any point after Layer 2)

| Component | Aspect | Can Be Added When |
|-----------|--------|-------------------|
| Dual intent (product/engineering) | Conditional template sections, PRD vs RFC format | After Layer 2 (Scope sets intent). Can retrofit into existing skills incrementally. |
| HANDOFF.md generation | Design skill addition | After Layer 4 (Design skill exists). |
| Cross-lifecycle import | Scope skill addition | After Layer 2 (Scope skill exists). LOW confidence -- may be deferred. |
| Archival flow | Scope skill addition | After Layer 2 (Scope skill exists). |
| Recycle escalation | Gate enhancement | After Layer 3 (first LLM gate exists). |
| log.yml telemetry | Append calls in every skill | After Layer 1 (state exists). Can be added incrementally. |

**Rationale:** These are features that span multiple components but don't block the core lifecycle. They can be layered in after the core skill they extend is built and tested.

---

## Build Order Summary (Dependency DAG)

```
Layer 0: plugin.json, templates/
    |
Layer 1: status skill, session-start hook
    |
Layer 2: scope skill (+ G1 gate)
    |
Layer 3: research skill (+ all 5 research templates, G2 gate)  <-- HIGHEST RISK
    |
Layer 4: design skill (+ design template, G3 gate)
    |
Layer 5: plan skill (+ G4 gate) || execute skill (parallel)
    |
Layer 6: cross-cutting (intent adaptation, HANDOFF.md, archival, telemetry)
```

**Critical path:** Layers 0-3. Research is the bottleneck. Everything downstream of Research is simpler and lower-risk. If Research works reliably, the remaining layers are incremental.

---

## Key Architectural Decisions (Build-Order Relevant)

| Decision | Implication for Build Order |
|----------|---------------------------|
| Inline gates (not separate gate skill) | Gate logic is embedded in each skill. No shared gate module to build first. Gates come "free" with each skill. |
| Subagents only in Research | Research is the only skill requiring Task() API integration. All other skills are main-session-only, which is simpler. |
| File-based inter-skill communication | No message bus or shared memory to build. Skills just read/write files. This simplifies each layer. |
| Dynamic context injection (`!cat`) in every SKILL.md | This pattern must work before any skill works. Validated at Layer 1 (Status skill). |
| Complete-file rewrite for state.yml | No incremental state updates to worry about. Every state write is total, which simplifies implementation but means state.yml schema must be stable early. |
| Categorical sufficiency (not numeric) | Proven pattern. No calibration needed. Reduces research skill complexity. |
| Hardcoded model tiers in frontmatter | No configuration system to build. Model selection is baked into prompt templates. |

---

## Confidence and Risk Summary (From Audit)

| Component | Confidence | Risk to Build Order |
|-----------|-----------|-------------------|
| Plugin structure (plugin.json, skills/, references/) | ROCK SOLID | None -- exact patterns from reference implementations |
| State.yml schema and write pattern | HIGH | Low -- well-validated patterns |
| SessionStart hook | LOW | Medium -- 3 open platform bugs, but fallbacks exist. Build it, expect it to be unreliable |
| Dynamic context injection (`!cat`) | HIGH | Low -- documented, works in reference implementations |
| Research SKILL.md 11-step orchestration | MEDIUM | HIGH -- no reference at this complexity. May need splitting |
| Task() subagent dispatch | HIGH | Low -- three converging sources validate the pattern |
| Source-affinity batching | MEDIUM | Medium -- needs testing for batch quality |
| Inline gate evaluation | HIGH | Low -- simpler than separate gate skill |
| Design revision cycle | HIGH | Low -- straightforward interaction pattern |
| Execute checkpoint/resume | MEDIUM | Medium -- adapted from GSD, needs validation |
| hooks.json field naming | LOW | Low -- trivial to fix at implementation time |
| HANDOFF.md format | MEDIUM | Low -- iteration expected, not blocking |
| Cross-lifecycle import | LOW | Low -- deferred to v2 per PROJECT.md |

---

*Generated from PRODUCT-DESIGN.md, CONFIDENCE-AUDIT.md, research-synthesis.md, and SCOPE.md analysis.*
*Last updated: 2026-02-27*
