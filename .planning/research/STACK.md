# Stack Research: Expedite Plugin

**Research Date:** 2026-02-27
**Researcher:** Stack research agent
**Question:** What is the standard 2025/2026 stack for building a Claude Code plugin?
**Sources:** Research-engine plugin (`~/.claude/plugins/cache/local/research-engine/`), GSD framework (`~/.claude/get-shit-done/`), project research synthesis (`research-synthesis.md`), product design specification (`PRODUCT-DESIGN.md`), confidence audit (`CONFIDENCE-AUDIT.md`), readiness evaluation (`READINESS.md`)
**Consumer:** Roadmap creation (Plan phase)

---

## Executive Summary

The Expedite plugin stack is a Claude Code plugin built entirely from Markdown, YAML, JSON, and shell scripts -- no compiled code, no dependencies, no build step. Every convention is derived from two studied reference implementations (research-engine and GSD) and validated by the project's own 10-decision-area research phase. The stack is prescriptive by design: each choice below has been tested against alternatives in the research phase, and the rationale section explains why alternatives were rejected.

**Key finding:** Claude Code plugins are "prompt-as-code" systems. The SKILL.md files ARE the application logic. Prompt templates ARE the function definitions. State files ARE the database. There is no runtime, no framework, no transpilation. This simplicity is a feature, not a limitation.

---

## Plugin Structure

### Directory Layout

**Confidence: ROCK SOLID** -- Research-engine demonstrates exact pattern; official Claude Code plugin docs confirm.

```
expedite/
  .claude-plugin/
    plugin.json                  # Minimal manifest (name, version, description, author)
  hooks/
    hooks.json                   # SessionStart hook registration
  scripts/
    session-start.sh             # Shell script for SessionStart hook
  skills/
    scope/
      SKILL.md                   # Orchestration: interactive questioning, question plan
      references/
        prompt-scope-questioning.md
    research/
      SKILL.md                   # Orchestration: parallel dispatch, synthesis, sufficiency
      references/
        prompt-web-researcher.md
        prompt-codebase-analyst.md
        prompt-mcp-researcher.md
        prompt-research-synthesizer.md
        prompt-sufficiency-evaluator.md
    design/
      SKILL.md                   # Orchestration: design generation, revision cycle
      references/
        prompt-design-guide.md
    plan/
      SKILL.md                   # Orchestration: task decomposition
      references/
        prompt-plan-guide.md
    execute/
      SKILL.md                   # Orchestration: wave execution, checkpoints
      references/
        prompt-task-verifier.md
    status/
      SKILL.md                   # Context reconstruction / lifecycle overview
  templates/
    state.yml.template           # Initial state.yml schema
    sources.yml.template         # Initial sources.yml with built-in sources
    gitignore.template           # .gitignore for .expedite/ directory
```

**Why this layout:**
- `.claude-plugin/plugin.json` is the Claude Code plugin discovery mechanism. Without this exact path, the plugin is not recognized.
- Skills are auto-discovered from `skills/{name}/SKILL.md` -- no explicit skill listing needed in plugin.json. Research-engine proves this works.
- Each skill has its own `references/` subdirectory for prompt templates. This keeps templates co-located with their consuming skill.
- `templates/` at the plugin root holds initialization templates that get copied to the project's `.expedite/` directory. Neither reference implementation does this, but the design needs it for the state.yml and sources.yml initialization flow.
- `hooks/` and `scripts/` are separated because hooks.json is a JSON configuration file while session-start.sh is an executable shell script.

**What NOT to do:**
- Do NOT list skills in plugin.json. Auto-discovery handles this. Adding explicit skill listings creates a maintenance burden and potential drift.
- Do NOT use the legacy `~/.claude/commands/` pattern. GSD uses this because it predates the plugin architecture. The plugin system is the current standard.
- Do NOT put runtime state inside the plugin directory. The plugin lives in `~/.claude/plugins/cache/`, which is managed by Claude Code. Runtime state belongs in the project's `.expedite/` directory.
- Do NOT create nested subdirectories beyond what is shown. The flat skill structure (one SKILL.md + one references/ directory per skill) is the proven pattern.

### plugin.json Schema

**Confidence: ROCK SOLID** -- Research-engine uses this exact pattern; confirmed by official docs.

```json
{
  "name": "expedite",
  "version": "1.0.0",
  "description": "Research-driven development lifecycle: Scope, Research, Design, Plan, Execute",
  "author": "expedite-contributors"
}
```

**Schema fields:**
- `name` (string, required): Plugin name. Becomes the skill namespace prefix (`/expedite:`).
- `version` (string, required): Semver version string.
- `description` (string, required): One-line description. Displayed in plugin listings.
- `author` (string, required): Attribution.

**Why minimal:** Research-engine's plugin.json contains only these four fields. No additional fields are needed because skills are auto-discovered and hooks are in a separate file. The product design confidence audit rates this as ROCK SOLID evidence.

**What NOT to do:**
- Do NOT add a `skills` array. Skills are auto-discovered.
- Do NOT add a `hooks` field here. Hooks go in `hooks/hooks.json` (separate file keeps concerns clean).
- Do NOT add `dependencies`, `engines`, or npm-style fields. This is not a Node.js package.

---

## SKILL.md Format

### Frontmatter

**Confidence: HIGH** -- Research-engine demonstrates pattern; plugin architecture docs confirm fields.

SKILL.md files use YAML frontmatter delimited by `---` fences. The frontmatter controls Claude Code's runtime behavior for the skill.

```yaml
---
name: research
description: >
  Gather evidence for scope questions using parallel research agents.
  Triggers: /expedite:research, "research", "gather evidence", "investigate questions"
allowed-tools:
  - Read
  - Write
  - Bash
  - Glob
  - Grep
  - Task
  - AskUserQuestion
  - WebSearch
  - WebFetch
---
```

**Frontmatter fields:**
| Field | Type | Required | Purpose |
|-------|------|----------|---------|
| `name` | string | Yes | Skill identifier. Combined with plugin name for the `/expedite:{name}` command. |
| `description` | string | Yes | Displayed to the user. **Also used for trigger-phrase matching** -- Claude reads this to decide auto-invocation. Include natural language trigger phrases. |
| `allowed-tools` | string[] | Yes | Whitelist of tools available during skill execution. If omitted, the skill gets no tools. Use `mcp__*` wildcards for MCP server access. |
| `argument-hint` | string | No | Displayed as usage hint. Example: `"[--override]"`. Used by design, plan, and execute skills for the override flag. |

**Critical details:**
- The `description` field doubles as a trigger-phrase index. Include phrases like "research", "gather evidence", "investigate questions" to enable auto-invocation when the user types those words naturally.
- `allowed-tools` is a strict whitelist. If you need `Task` for subagent spawning, it must be listed. If you need MCP tools, use the wildcard pattern `mcp__github__*`.
- There is no `model` or `model_hint` field in SKILL.md frontmatter. Model selection happens at the prompt template level for subagents, or is controlled by the user's session settings for main-session skills.
- There is no `subagent_type` field in SKILL.md frontmatter. This field belongs in prompt template frontmatter (for files in `references/`), not in the skill itself.

**What NOT to do:**
- Do NOT omit trigger phrases from the `description`. Without them, auto-invocation will not work and the user must always use the explicit `/expedite:research` command.
- Do NOT use `allowed-tools: "*"` as a catch-all. Be explicit about which tools each skill needs. This is a security boundary.
- Do NOT put `subagent_type` or `model` in SKILL.md frontmatter. Those belong in prompt template frontmatter only.

### Content After Frontmatter

**Confidence: HIGH** -- Research-engine and plugin architecture docs confirm the `!command` syntax.

After the `---` closing fence, the SKILL.md content is the orchestration prompt. It is Markdown that Claude reads and follows as instructions. The first thing after the frontmatter should be dynamic state injection:

```markdown
---
name: scope
description: >
  Start a new expedite lifecycle or refine an existing scope.
  Triggers: /expedite:scope, "start expedite", "new project", "define scope", "begin lifecycle"
allowed-tools:
  - Read
  - Write
  - Glob
  - Bash
  - AskUserQuestion
---

Current lifecycle state:
!`cat .expedite/state.yml 2>/dev/null || echo "No active lifecycle"`

## You are the Expedite Scope orchestrator.

[... orchestration instructions follow ...]
```

**The `!command` syntax:** Lines starting with `` !` `` execute the shell command and inject its stdout into the prompt before Claude sees it. This is how every SKILL.md loads current state -- it runs `cat .expedite/state.yml` and the YAML content appears inline. The `2>/dev/null || echo "..."` pattern handles the case where the file does not exist.

**Why every SKILL.md includes this:** It is defense-in-depth. The SessionStart hook SHOULD inject state context, but has 3 known platform bugs (#16538, #13650, #11509). The `!cat` injection ensures state is always loaded regardless of hook status.

**What NOT to do:**
- Do NOT rely solely on the SessionStart hook for state context. The hook has known reliability issues.
- Do NOT use `@file.yml` syntax for state loading. The `@` prefix references files as context but does not handle missing files gracefully. The `!cat` with error fallback is more robust.
- Do NOT put the state injection at the end of the SKILL.md. Put it at the top so Claude has state context before reading the orchestration instructions.

---

## references/ Directory and Prompt Templates

### Template Location Convention

**Confidence: ROCK SOLID** -- Research-engine demonstrates exact pattern.

Each skill's `references/` directory contains Markdown prompt templates. These are loaded by the SKILL.md orchestrator at runtime and either:
1. Used as subagent prompts (passed to `Task()`) -- research skill templates
2. Used as inline reference material (loaded into the main session context) -- design, plan, execute templates

### Prompt Template Format: 8-Section XML Structure

**Confidence: STRONG** -- Convergent evidence from prompt engineering research, all 3 design proposals converged.

Every prompt template uses the same 8-section structure with XML tags:

```markdown
---
subagent_type: general-purpose
model: sonnet
---

<role>
You are a web research specialist gathering evidence for development decisions.
You have expertise in finding, evaluating, and synthesizing technical information.
</role>

<context>
Project: {{project_name}}
Intent: {{intent}}
Lifecycle: {{lifecycle_id}}

<intent_lens>
{{#if intent == "product"}}
Focus on user needs, market positioning, business viability, and measurable outcomes.
Prioritize user quotes, behavior data, market reports, and competitive analysis.
{{/if}}
{{#if intent == "engineering"}}
Focus on architecture decisions, implementation feasibility, performance characteristics, and technical trade-offs.
Prioritize production measurements, reference implementations, technical docs, and benchmarks.
{{/if}}
</intent_lens>
</context>

<constraints>
- Write all detailed findings to the designated output file
- Return ONLY a condensed summary (200-500 tokens) inline
- Do NOT spawn sub-tasks or sub-agents
- If a source is unavailable, report it clearly in <source_status> tags
</constraints>

<instructions>
1. For each assigned question, search for evidence using the provided tools.
2. Evaluate source quality: prefer official docs, peer-reviewed, and primary sources.
3. For each question, provide: direct evidence, source URLs, confidence assessment.
4. Write detailed findings to {{output_file}}.
5. Return a condensed summary of what you found.
</instructions>

<examples>
[Optional: 1-2 concrete examples of good vs. bad output]
</examples>

<output_format>
## Inline Summary (return this)
- Q{{id}}: [1-2 sentence finding summary] [COVERED/PARTIAL/NOT COVERED]
- ...

## File Output (write to {{output_file}})
[Full structured evidence per question]

<source_status>
source: "web"
status: "available"
queries_executed: N
</source_status>
</output_format>

<quality_criteria>
- Each finding must cite at least one specific source
- Distinguish between direct evidence and inference
- Report source unavailability honestly
</quality_criteria>

<input_data>
{{questions_yaml_block}}
</input_data>
```

**Why 8 sections in this order:**
1. `<role>` -- Sets behavioral frame. Anthropic docs recommend role-setting early.
2. `<context>` -- Project-specific metadata and intent lens. Includes `<intent_lens>` sub-section for conditional content.
3. `<constraints>` -- Hard boundaries. "Do NOT" rules go here. Placed before instructions per Anthropic recommendation.
4. `<instructions>` -- Step-by-step procedure. The "how to do the work" section.
5. `<examples>` -- Optional concrete demonstrations. Helps calibrate quality expectations.
6. `<output_format>` -- Exact structure of expected output. Includes `<source_status>` for error reporting.
7. `<quality_criteria>` -- Evaluation rubric the agent uses for self-assessment.
8. `<input_data>` -- Actual questions/tasks for this invocation. **Placed last** per Anthropic recommendation that instructions should precede data.

### Prompt Template Frontmatter (for subagent templates only)

**Confidence: HIGH** -- Research-engine pattern, proven in production.

Templates used as subagent prompts include YAML frontmatter with execution metadata:

```yaml
---
subagent_type: general-purpose
model: sonnet
---
```

| Field | Values | Purpose |
|-------|--------|---------|
| `subagent_type` | `"general-purpose"`, `"explore"` | Passed to `Task()`. `general-purpose` enables full tool access (including MCP). `explore` uses built-in codebase exploration. |
| `model` | `"sonnet"`, `"opus"`, `"haiku"` | Passed to `Task()`. Determines which Claude model runs the subagent. |

Templates used as **inline reference material** (design-guide, plan-guide, task-verifier, sufficiency-evaluator) have **no frontmatter** -- they are read by the SKILL.md and injected into the main session context, not spawned as subagents.

### Template Variable Convention

**Confidence: MEDIUM** -- Derived from design specification; not directly observed in reference implementations.

Templates use `{{variable}}` placeholder syntax. The SKILL.md orchestrator replaces these with dynamic values before passing to `Task()`. Variables include:

| Variable | Source | Description |
|----------|--------|-------------|
| `{{project_name}}` | state.yml | Current lifecycle project name |
| `{{intent}}` | state.yml | "product" or "engineering" |
| `{{lifecycle_id}}` | state.yml | Slug for log correlation |
| `{{questions_yaml_block}}` | state.yml + SCOPE.md | YAML block of assigned questions |
| `{{output_file}}` | Computed by orchestrator | Path to write detailed findings |
| `{{source_config}}` | sources.yml | Source configuration for this batch |

**Important:** Variable substitution is done by the SKILL.md orchestrator prompt, not by a template engine. The SKILL.md tells Claude: "Read the template from `references/prompt-web-researcher.md`, replace `{{variables}}` with the values from state, and pass the result to `Task()`." The LLM does the substitution as part of its orchestration logic.

**What NOT to do:**
- Do NOT build a template engine. The LLM handles variable substitution as part of prompt construction. Adding a real template engine would require a build step and add unnecessary complexity.
- Do NOT use `$variable` or `${variable}` syntax. These would be interpreted by the shell if the template is ever processed through Bash. `{{double_braces}}` are LLM-convention and shell-safe.
- Do NOT inline large file contents as template variables. Instead, have the SKILL.md tell the subagent to read the file directly (but note: subagents cannot use `@` references, so content must be inlined in the prompt if needed).

### Template Inventory

| Template | Location | Has Frontmatter | Model | Purpose |
|----------|----------|-----------------|-------|---------|
| prompt-scope-questioning.md | scope/references/ | No | N/A (main session) | Guide question plan generation |
| prompt-web-researcher.md | research/references/ | Yes | sonnet | Web research subagent |
| prompt-codebase-analyst.md | research/references/ | Yes | sonnet | Codebase analysis subagent |
| prompt-mcp-researcher.md | research/references/ | Yes | sonnet | MCP source research subagent |
| prompt-research-synthesizer.md | research/references/ | Yes | opus | Evidence synthesis subagent |
| prompt-sufficiency-evaluator.md | research/references/ | No | N/A (inline) | Per-question sufficiency rubric |
| prompt-design-guide.md | design/references/ | No | N/A (reference) | Design format and quality criteria |
| prompt-plan-guide.md | plan/references/ | No | N/A (reference) | Plan format and acceptance criteria |
| prompt-task-verifier.md | execute/references/ | No | N/A (inline) | Acceptance criteria verification |

---

## hooks.json Format

**Confidence: LOW** -- Design proposals disagreed on field naming. Must verify against platform at implementation time.

### Hook Configuration File

Located at `hooks/hooks.json` within the plugin directory:

```json
[
  {
    "hook_type": "SessionStart",
    "script": "${CLAUDE_PLUGIN_ROOT}/scripts/session-start.sh"
  }
]
```

**CRITICAL WARNING:** The exact field names (`hook_type`, `script`) are the design's primary choice but carry LOW confidence. Three design proposals used different naming conventions:
- Proposal 1: `hook_type` / `script`
- Proposal 2: `type` / `command`
- Proposal 3: `event` / `script`

**This must be verified against the actual Claude Code platform during implementation.** The confidence audit explicitly flags this as decision #27 with LOW confidence: "Proposals disagreed. Design acknowledges uncertainty. Must verify at implementation time."

### SessionStart Hook Script

Located at `scripts/session-start.sh`:

```bash
#!/bin/bash
# Expedite SessionStart hook -- inject lifecycle context on new sessions
# Uses plain text stdout to avoid additionalContext JSON bugs (#16538, #13650, #11509)

STATE_FILE=".expedite/state.yml"

if [ ! -f "$STATE_FILE" ]; then
  exit 0  # No active lifecycle, nothing to inject
fi

PHASE=$(grep '^phase:' "$STATE_FILE" | head -1 | sed 's/phase: *"\{0,1\}\([^"]*\)"\{0,1\}/\1/')
PROJECT=$(grep '^project_name:' "$STATE_FILE" | head -1 | sed 's/project_name: *"\{0,1\}\([^"]*\)"\{0,1\}/\1/')

case "$PHASE" in
  scope_in_progress)
    echo "Expedite lifecycle active: $PROJECT. Phase: scoping (in progress). Run /expedite:scope to continue."
    ;;
  scope_complete)
    echo "Expedite lifecycle active: $PROJECT. Phase: scope complete. Run /expedite:research."
    ;;
  # ... additional phase cases ...
  complete)
    echo "Expedite lifecycle complete: $PROJECT. Run /expedite:scope for new lifecycle."
    ;;
esac
```

**Why plain text stdout:** Three open bugs (#16538, #13650, #11509) affect the `additionalContext` JSON mechanism for hook output. Plain text stdout is a safer fallback that still injects context into the session.

**Why this is a 3-layer system:**
1. **SessionStart hook** (if working): Injects 2-3 line summary automatically on session start.
2. **Dynamic `!cat` injection** (always works): Every SKILL.md loads state.yml via `` !`cat .expedite/state.yml` ``.
3. **Manual `/expedite:status`** (always works): User can explicitly request context reconstruction.

**What NOT to do:**
- Do NOT use the `additionalContext` JSON format for hook output. It has known bugs.
- Do NOT put complex logic in the hook script. Keep it to grep/sed parsing and echo output. Complex logic belongs in the SKILL.md.
- Do NOT depend on the hook working. Always have fallbacks.

---

## State Management

### File Format: YAML

**Confidence: HIGH** -- State management patterns research validates; both reference implementations inform.

State is stored in YAML (`.expedite/state.yml`), not JSON. Here is why:

| Factor | YAML | JSON |
|--------|------|------|
| Human readability | Better -- comments, multiline strings, less punctuation | Worse -- no comments, quoting noise |
| LLM parseability | Good with constraints (max 2 nesting, quoted strings) | Better -- unambiguous syntax |
| Comment support | Yes | No |
| Git diff readability | Better -- fewer structural characters | Worse -- bracket/brace noise |
| Corruption risk | Higher -- whitespace-sensitive, implicit typing | Lower -- strict syntax |
| Decision | **Use YAML** with strict constraints | Rejected |

**Why YAML wins:** The state file is read and written by both the LLM and humans. Comments explain field semantics. Git diffs are cleaner. The corruption risks are mitigated by strict conventions (see below).

### state.yml Schema and Conventions

**Confidence: HIGH** -- Flat structure validated by state management patterns research.

```yaml
# Expedite Lifecycle State -- machine-readable, complete-rewrite on every update
version: "1"                              # Schema version for future evolution
last_modified: "2026-02-26T14:30:00Z"     # ISO 8601 UTC

# Lifecycle identity
project_name: "auth-redesign"             # Set during scope
intent: "engineering"                     # "product" | "engineering"
lifecycle_id: "auth-redesign-20260226"    # Slug for log correlation

# Current position (granular phases for crash recovery)
phase: "research_complete"
  # Valid: scope_in_progress, scope_complete,
  #   research_in_progress, research_complete, research_recycled,
  #   design_in_progress, design_complete, design_recycled,
  #   plan_in_progress, plan_complete, plan_recycled,
  #   execute_in_progress, complete, archived
current_task: null                        # Task ID during execute phase

# Imported artifacts (from connected flow)
imported_from: null                       # Path to imported HANDOFF.md/DESIGN.md
constraints:                              # Locked constraints from imported artifacts
  - "Use SwiftUI, not UIKit (LOCKED from prior design)"

# Research rounds
research_rounds: 1                        # Incremented on each /expedite:research invocation

# Questions (flat list, max 2 nesting levels)
questions:
  - id: "q01"
    text: "How should the OAuth2 flow be implemented?"
    priority: "P0"
    decision_area: "authentication"
    source_hints: ["web", "codebase"]
    status: "covered"
    source: "original"
    gap_details: null
    evidence_files: ["research/evidence-batch-01.md"]

# Gate history (flat list, append-only in state)
gate_history:
  - gate: "G2"
    timestamp: "2026-02-26T14:25:00Z"
    outcome: "go_advisory"
    must_passed: 4
    must_failed: 0
    should_passed: 2
    should_failed: 1
    notes: "1 question PARTIAL, missing corroboration"
    overridden: false

# Execution state
tasks: []
current_wave: null
```

### YAML Safety Rules (MANDATORY)

These rules come from the state management patterns research and address known LLM-YAML failure modes:

1. **Quote ALL string values.** `phase: "research_complete"`, not `phase: research_complete`. Prevents YAML implicit typing (e.g., `no` becomes boolean `false`, `1.0` becomes float).
2. **Use explicit `null` for empty fields.** `current_task: null`, not `current_task:` (which is ambiguous).
3. **Maximum 2 levels of nesting.** `questions` is level 1, `questions[].id` is level 2. No level 3. This is the hard ceiling for reliable LLM parsing. The research explicitly validated this threshold.
4. **Use YAML flow-style for simple arrays.** `source_hints: ["web", "codebase"]` instead of multi-line block style. Reduces line count.
5. **Keep under 100 lines.** Soft target. If state exceeds this, the schema is too complex.
6. **Include `version` field.** Enables future schema migration.
7. **Include `last_modified` timestamp.** Enables staleness detection.

### Read/Write Pattern: Complete-File Rewrite

**Confidence: STRONG** -- State management patterns research, both reference implementations.

```
Read state.yml entirely -> Modify in-memory representation -> Write entire file back
```

Every state update follows this pattern:

1. **Backup:** Copy `state.yml` to `state.yml.bak` before writing.
2. **Read:** Load the entire `state.yml` content.
3. **Modify:** Change the needed fields in the in-memory representation.
4. **Write:** Write the entire file back using the `Write` tool.

**What NOT to do:**
- **NEVER use partial field updates** (regex replacement, sed, or line editing on YAML). This is the #1 corruption vector. YAML's whitespace sensitivity makes partial edits extremely fragile. Always rewrite the complete file.
- **NEVER use `yq` or external YAML processors.** These are not guaranteed to be installed. The LLM reads and writes YAML natively.
- **NEVER attempt concurrent writes.** Only one skill runs at a time in Claude Code, but defend against interrupted writes with the backup.

### log.yml: Append-Only Telemetry

**Confidence: STRONG** -- Multi-document YAML + `cat >>` pattern.

```yaml
---
event: "phase_transition"
timestamp: "2026-02-26T14:00:00Z"
from: "scope_in_progress"
to: "scope_complete"
lifecycle: "auth-redesign-20260226"
---
event: "agent_complete"
timestamp: "2026-02-26T15:30:00Z"
type: "web_researcher"
batch: 1
model: "sonnet"
questions: 4
lifecycle: "auth-redesign-20260226"
```

**Format:** Multi-document YAML with `---` separators. Each entry is a standalone YAML document.

**Append pattern:** The SKILL.md instructs the LLM to use `cat >>` for appending:

```bash
cat >> .expedite/log.yml << 'EOF'
---
event: "phase_transition"
timestamp: "2026-02-26T14:00:00Z"
from: "scope_in_progress"
to: "scope_complete"
lifecycle: "auth-redesign-20260226"
EOF
```

**Why `cat >>` instead of Write tool:** The Write tool overwrites the entire file. The log is append-only by design. Using `cat >>` with a HEREDOC is the safest append mechanism. The SKILL.md includes the explicit instruction: "APPEND to .expedite/log.yml using `cat >>`. Do NOT read and rewrite the file." This directly mitigates the realistic risk of an LLM reading the entire file and rewriting it.

**log.yml is gitignored.** Decision D5: single-user workflow, telemetry data is noisy in git history.

### checkpoint.yml: Execute Phase Position

**Confidence: MEDIUM** -- GSD adapted pattern.

Single file tracking execution position during the execute phase:

```yaml
current_task: "t03"
current_wave: 2
completed: ["t01", "t02"]
skipped: []
failed: []
paused_at: null
```

Simpler than per-task checkpoint files (GSD's pattern). PROGRESS.md provides the per-task execution history as an append-only Markdown log.

---

## Subagent Orchestration

### Task() API

**Confidence: ROCK SOLID** -- Three converging sources confirm the API.

```
Task(
  prompt: "<full prompt text with template + dynamic context>",
  description: "Research batch 1: web search for questions q01, q03, q07",
  subagent_type: "general-purpose",
  model: "sonnet"
)
```

| Parameter | Required | Values | Purpose |
|-----------|----------|--------|---------|
| `prompt` | Yes | string | Full prompt text. Must be self-contained -- no `@` file references. |
| `description` | Yes | string | Brief description for tracking. Shown in Claude Code UI. |
| `subagent_type` | Yes | `"general-purpose"`, `"explore"` | `general-purpose` = full tool access (including MCP). `explore` = built-in codebase tools only. |
| `model` | No | `"sonnet"`, `"opus"`, `"haiku"`, `"fast"`, `"inherit"` | Defaults to parent session model if omitted. |

### Orchestration Pattern: Template Loading + Prompt Construction

**Confidence: HIGH** -- Research-engine's exact pattern.

The SKILL.md orchestrator follows this sequence:

1. **Read prompt template** from `references/prompt-*.md` using the Read tool.
2. **Extract frontmatter** (`subagent_type`, `model`) from the template.
3. **Replace template variables** (`{{project_name}}`, `{{questions_yaml_block}}`, etc.) with dynamic context from state.yml, SCOPE.md, sources.yml.
4. **Inline required file content.** Subagents cannot use `@` references. Any file content the subagent needs must be pasted directly into the prompt.
5. **Spawn via Task()** with the constructed prompt, frontmatter metadata, and a descriptive label.

### Concurrency Model

**Confidence: HIGH** -- Anthropic recommends 3-5 concurrent agents.

- **Maximum 3 concurrent research subagents.** Conservative end of Anthropic's 3-5 recommendation.
- **Prompt-based enforcement only.** The SKILL.md instructs: "Spawn at most 3 Task() agents simultaneously."
- **Fan-out / fan-in pattern.** All batch agents spawned, all results collected, then synthesis runs.
- **Wave-based execution for plan tasks.** Tasks grouped by wave number. Waves execute sequentially. Within a wave, tasks could theoretically be parallelized, but the execute phase runs in the main session (one task at a time).

### File-Based Output + Condensed Returns

**Confidence: STRONG** -- Research-engine demonstrates in practice.

Subagents write detailed findings to designated files and return only a brief summary (200-500 tokens) inline:

- **Detailed output:** Written to `research/evidence-batch-{N}.md` by each research subagent.
- **Inline return:** 200-500 token summary with per-question status (COVERED/PARTIAL/NOT COVERED).
- **Why:** Preserves parent session context for orchestration. Detailed evidence files are read by the synthesis agent later, not by the orchestrator.

### Model Tier Assignments

**Confidence: HIGH** -- Research-engine pattern, hardcoded in frontmatter.

| Agent Role | Model | Rationale |
|-----------|-------|-----------|
| Web researcher | sonnet | Fast, cost-effective for search-and-summarize |
| Codebase analyst | sonnet | Sufficient for code reading and analysis |
| MCP researcher | sonnet | Fast for API-based data retrieval |
| Research synthesizer | opus | Highest capability for evidence synthesis and judgment |
| Sufficiency evaluator | N/A (inline) | Runs in main session, uses session model |

**Why hardcoded:** Research-engine hardcodes model assignments in prompt template frontmatter. GSD uses a configurable profile system. For v1, hardcoded is simpler, zero-configuration, and proven. A configurable system can be added in v2 if needed.

### Hard Platform Constraints

| Constraint | Source | Impact |
|-----------|--------|--------|
| Subagents cannot spawn sub-subagents | Confirmed by 3 sources | All orchestration must be in SKILL.md, not delegated |
| AskUserQuestion not available in subagents | GitHub #12890 | All user interaction in main session only |
| MCP tools require `subagent_type: "general-purpose"` | GitHub #13254, #19964 | MCP research agents must use general-purpose, not explore |
| `@` file references do not work across Task boundaries | Platform limitation | All context must be inlined in the prompt |
| `resume` parameter for rate-limited agents | Task API feature | Used for retry after rate limits |

**What NOT to do:**
- Do NOT attempt to have subagents interact with the user. It will fail silently or timeout.
- Do NOT use `subagent_type: "explore"` for agents that need MCP tools. They will not have access.
- Do NOT rely on `@filename` references in subagent prompts. Inline all needed content.
- Do NOT attempt sub-subagent spawning. The SKILL.md is the only orchestration layer.

---

## Runtime State Directory (.expedite/)

**Confidence: HIGH** -- Split between plugin code and project state is clean.

Created at the project root during `/expedite:scope`:

```
.expedite/
  state.yml                    # Current lifecycle state (YAML, complete-rewrite)
  state.yml.bak                # Backup before last state write
  sources.yml                  # Source configuration (persists across lifecycles)
  log.yml                      # Append-only telemetry (gitignored)
  scope/
    SCOPE.md                   # Question plan, success criteria, intent declaration
  research/
    evidence-batch-{N}.md      # Per-batch evidence files from research subagents
    SYNTHESIS.md               # Evidence organized by question/decision area
    round-{N}/                 # Gap-fill round artifacts (on Recycle)
  design/
    DESIGN.md                  # RFC (engineering) or PRD (product)
    HANDOFF.md                 # Product intent only
  plan/
    PLAN.md                    # Wave-ordered tasks or epics/stories
  execute/
    PROGRESS.md                # Append-only execution log
    checkpoint.yml             # Execution position tracking
  archive/
    {slug}/                    # Archived prior lifecycles
```

**Key principles:**
- `state.yml` is the control plane (machine-readable, small). Markdown artifacts are the data plane (human-readable, detailed).
- `sources.yml` and `log.yml` persist across lifecycle archival. Everything else gets moved to `archive/{slug}/`.
- `.expedite/` is independent of any existing `.planning/` directory. They coexist without interaction.
- The `.gitignore` template (copied during init) should ignore `log.yml` and `state.yml.bak`.

---

## Naming Conventions

### Namespace and Commands

| Convention | Value | Rationale |
|-----------|-------|-----------|
| Plugin name | `expedite` | User preference (renamed from "arc") |
| Skill namespace | `/expedite:` | Standard `{plugin_name}:` convention |
| State directory | `.expedite/` | Matches plugin name |
| Plugin directory | `~/.claude/plugins/expedite/` | Standard plugin install path |

### File Naming Patterns

| Pattern | Example | Used For |
|---------|---------|----------|
| `SKILL.md` | `skills/research/SKILL.md` | Skill orchestration files (always ALLCAPS) |
| `prompt-{role}.md` | `references/prompt-web-researcher.md` | Prompt templates (kebab-case with `prompt-` prefix) |
| `{TYPE}.md` | `SCOPE.md`, `SYNTHESIS.md`, `DESIGN.md`, `PLAN.md` | Phase artifacts (ALLCAPS) |
| `evidence-batch-{N}.md` | `research/evidence-batch-01.md` | Research evidence files (zero-padded number) |
| `state.yml` | `.expedite/state.yml` | Machine state (lowercase) |
| `sources.yml` | `.expedite/sources.yml` | Source configuration (lowercase) |
| `log.yml` | `.expedite/log.yml` | Telemetry log (lowercase) |
| `checkpoint.yml` | `execute/checkpoint.yml` | Execution position (lowercase) |
| `PROGRESS.md` | `execute/PROGRESS.md` | Append-only execution log (ALLCAPS) |
| `*.template` | `templates/state.yml.template` | Initialization templates (add `.template` suffix) |

**Convention:** ALLCAPS Markdown files are human-readable artifacts that represent phase outputs. Lowercase YAML files are machine-readable state. Prompt templates use `prompt-` prefix with kebab-case role descriptions.

---

## What This Stack Does NOT Include

| Excluded | Why |
|----------|-----|
| Build step / compilation | Plugin is Markdown + YAML + JSON + shell. No transpilation needed. |
| Node.js / Python runtime | All logic is in prompts executed by the LLM. Shell scripts are minimal (< 30 lines). |
| External dependencies | No npm packages, no pip packages, no system dependencies beyond standard Unix tools (grep, sed, cat, bash). |
| Database | File-based state in YAML. Sufficient for single-user, single-lifecycle workflows. |
| Test framework | LLM prompt logic is tested through usage, not unit tests. Template syntax is validated by the LLM at runtime. |
| Configuration system | Zero configuration. Model tiers hardcoded in frontmatter. Source defaults in sources.yml.template. |
| Extended thinking | Explicitly excluded for v1. `ultrathink` enables extended thinking for the entire skill execution, not just specific sections. No evidence it improves rubric-based evaluation. v1.1 candidate. |
| Numeric scoring | Categorical sufficiency model (COVERED/PARTIAL/NOT COVERED) is proven by research-engine. Numeric scores are less stable. v1.1 candidate. |

---

## Decision Log

| # | Decision | Confidence | Rationale | Alternative Rejected | Why Rejected |
|---|----------|------------|-----------|---------------------|--------------|
| 1 | YAML for state (not JSON) | HIGH | Human-readable, comments, clean git diffs | JSON | No comments, noisy diffs, less readable |
| 2 | Plugin architecture (not legacy commands) | ROCK SOLID | Auto-discovery, frontmatter, hooks support | `~/.claude/commands/` | Legacy pattern, predates plugin system |
| 3 | 8-section XML prompt structure | STRONG | Convergent evidence from 3 proposals | Free-form Markdown | Less structured, harder to maintain consistency |
| 4 | Hardcoded model tiers | HIGH | Research-engine pattern, zero config | Configurable profiles (GSD pattern) | Unnecessary complexity for v1 |
| 5 | Complete-file rewrite (not partial updates) | STRONG | Avoids YAML corruption from partial edits | sed/regex updates | #1 corruption vector for YAML |
| 6 | `cat >>` for log.yml (not Write tool) | HIGH | True append, prevents LLM rewrite | Write tool | Write overwrites entire file |
| 7 | `!cat` dynamic injection (not @-reference) | HIGH | Handles missing files gracefully | `@state.yml` | No error handling for missing files |
| 8 | 3-layer context fallback | HIGH | SessionStart hook has 3 known bugs | Hook-only | Single point of failure |
| 9 | Categorical sufficiency (not numeric) | HIGH | Proven by research-engine, more stable | Numeric scores | Less stable, calibration-dependent |
| 10 | Max 3 concurrent subagents | HIGH | Conservative end of Anthropic guidance | 5 concurrent | Higher risk of rate limits and failures |

---

## Confidence Summary

| Rating | Count | Items |
|--------|-------|-------|
| ROCK SOLID | 4 | Plugin directory layout, plugin.json schema, Task() API, skill auto-discovery |
| HIGH | 10 | SKILL.md frontmatter, YAML state format, model tiers, prompt templates, subagent patterns, complete-file rewrite, dynamic injection, 3-layer fallback, categorical sufficiency, concurrent limit |
| MEDIUM | 3 | Template variable convention, checkpoint.yml format, sources.yml defaults |
| LOW | 1 | hooks.json field naming (must verify at implementation time) |

---

## Implementation Order Recommendation

Based on dependency analysis and confidence levels:

1. **Plugin scaffold** (ROCK SOLID confidence): plugin.json, directory structure, empty SKILL.md files. Verify auto-discovery works.
2. **hooks.json** (LOW confidence): Create and test immediately. Resolve the field-naming uncertainty before building anything that depends on it.
3. **State management** (HIGH confidence): state.yml template, read/write pattern, backup mechanism. Test with a simple skill first.
4. **Scope skill** (HIGH confidence): Most interactive, establishes the state.yml contract that all other skills depend on.
5. **Status skill** (HIGH confidence): Simple read-only skill. Validates state reading. Provides fallback for hook issues.
6. **Research skill** (MEDIUM-HIGH confidence): Most complex. 11-step orchestration. Subagent spawning. Test incrementally.
7. **Design skill** (HIGH confidence): Main session, no subagents. Depends on research output format.
8. **Plan skill** (HIGH confidence): Main session, no subagents. Depends on design output format.
9. **Execute skill** (MEDIUM confidence): Checkpoint/resume is the least-tested pattern.

---

*Research conducted from project's own evidence base: 7 research documents, 2 validation reports, 3 design proposals, and a confidence audit across 10 decision areas. Reference implementations (research-engine and GSD) were studied through the project's deep analysis phase, not accessed directly during this stack research session due to filesystem access restrictions.*
