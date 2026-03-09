# Phase 1: Plugin Scaffolding - Research

**Researched:** 2026-02-27
**Domain:** Claude Code plugin architecture and auto-discovery
**Confidence:** HIGH

## Summary

Phase 1 creates the static plugin directory structure so Claude Code recognizes Expedite as an installed plugin and auto-discovers all 6 skills. This is a well-understood domain: the Claude Code plugin platform uses convention-based auto-discovery from a fixed directory layout (`/.claude-plugin/plugin.json` manifest + `skills/{name}/SKILL.md` files). Two reference implementations (research-engine and official plugin-dev) confirm the exact patterns.

The work is entirely file creation -- no code, no dependencies, no runtime logic. The SKILL.md files created in this phase are stubs: they contain valid YAML frontmatter (name, description, allowed-tools, argument-hint) and trigger phrases, but the orchestration body is placeholder text. Full skill implementation happens in later phases (Phase 2 for status, Phase 4 for scope, etc.).

**Primary recommendation:** Mirror the research-engine plugin structure exactly (`.claude-plugin/plugin.json` + `skills/{name}/SKILL.md`), rename "arc" to "expedite" throughout, and create stub SKILL.md files with frontmatter derived from the PRODUCT-DESIGN.md specification. Include the `references/` subdirectories per skill as empty directories (or with placeholder READMEs), and the `templates/` directory at plugin root for state.yml.template and related files. Do NOT create hooks, scripts, or MCP config in this phase.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| FOUND-01 | Plugin installs as self-contained directory at `~/.claude/plugins/expedite/` with plugin.json, skills/, references/ | Plugin structure conventions fully documented in plugin-dev plugin-structure skill. research-engine confirms the pattern. Note: "references/" in the requirement refers to per-skill `references/` subdirectories, not a top-level directory. The design also specifies a top-level `templates/` directory. |
| FOUND-02 | Claude Code auto-discovers all 6 skills from `skills/{name}/SKILL.md` directory structure | Auto-discovery is convention-based: Claude Code scans `skills/` for subdirectories containing `SKILL.md`. Confirmed by plugin-dev skill-development docs and research-engine implementation. |
| FOUND-03 | Plugin.json contains minimal fields: name, version, description, author | Manifest spec fully documented. `name` is the only required field; version, description, author are recommended. research-engine and official plugins confirm this pattern. Manifest lives at `.claude-plugin/plugin.json`. |
| FOUND-04 | All skills invocable via `/expedite:` namespace (scope, research, design, plan, execute, status) | Namespace is derived from plugin name in plugin.json. Skills appear as `/expedite:scope`, `/expedite:research`, etc. Each needs a `skills/{name}/SKILL.md` file. |
| FOUND-05 | Trigger phrases in SKILL.md description enable auto-invocation for each skill | SKILL.md description field must use third-person format with specific trigger phrases. Confirmed by skill-development docs and all reference SKILL.md files examined. |
</phase_requirements>

## Standard Stack

### Core

| Component | Version | Purpose | Why Standard |
|-----------|---------|---------|--------------|
| Claude Code plugin platform | Current | Plugin hosting, auto-discovery, skill invocation | The target platform -- no alternative |
| `.claude-plugin/plugin.json` | N/A | Plugin manifest (identity, metadata) | Required by platform for plugin recognition |
| `skills/{name}/SKILL.md` | N/A | Skill entry points with YAML frontmatter | Required by platform for skill auto-discovery |
| YAML frontmatter | N/A | Skill metadata (name, description, allowed-tools, argument-hint) | Platform convention for all commands/skills/agents |

### Supporting

| Component | Purpose | When to Use |
|-----------|---------|-------------|
| `${CLAUDE_PLUGIN_ROOT}` | Portable path reference in skill content | Any time a skill needs to reference plugin-internal files |
| `references/` per skill | Supplemental docs loaded on-demand | When skills reference prompt templates or guides |
| `templates/` at plugin root | State/config templates | For state.yml.template, sources.yml.template, gitignore.template |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Skills (SKILL.md) | Commands (commands/*.md) | Commands are simpler but lack auto-invocation via description triggers. Skills are the correct choice for Expedite's workflow orchestration. |
| Per-skill references/ | Top-level references/ | Design spec and research-engine both use per-skill references/. Keeps skill directories self-contained. |

**Installation:**
No package installation required. This phase creates only static Markdown and JSON files.

## Architecture Patterns

### Recommended Plugin Structure

```
expedite/
  .claude-plugin/
    plugin.json
  skills/
    scope/
      SKILL.md
      references/           # Empty now; populated in Phase 4
    research/
      SKILL.md
      references/           # Empty now; populated in Phases 5-6
    design/
      SKILL.md
      references/           # Empty now; populated in Phase 7
    plan/
      SKILL.md
      references/           # Empty now; populated in Phase 8
    execute/
      SKILL.md
      references/           # Empty now; populated in Phase 9
    status/
      SKILL.md
  templates/                # Empty now; populated in Phase 2
```

### Pattern 1: Minimal Manifest

**What:** plugin.json with only essential metadata fields.
**When to use:** All plugins should start minimal. Only add fields when needed.
**Example:**

```json
{
  "name": "expedite",
  "version": "0.1.0",
  "description": "Research-driven development lifecycle: Scope, Research, Design, Plan, Execute",
  "author": {
    "name": "Jared Wallenfels"
  }
}
```

Source: research-engine plugin.json and plugin-dev manifest-reference.md

**Key details:**
- `name` MUST be kebab-case, unique across installed plugins, start with letter
- `name` validation regex: `/^[a-z][a-z0-9]*(-[a-z0-9]+)*$/`
- `version` follows semver (MAJOR.MINOR.PATCH). Start at `0.1.0` for initial development
- `description` should be 50-200 characters, active voice, focus on what not how
- `author` can be string or object. Object format (`{name, email, url}`) is preferred
- No `commands`, `agents`, `hooks`, or `mcpServers` fields needed yet. Default auto-discovery handles skills/

### Pattern 2: SKILL.md with Trigger Phrases

**What:** Each SKILL.md has YAML frontmatter with a description containing specific trigger phrases in quotes.
**When to use:** Every skill needs this for auto-invocation.
**Example:**

```yaml
---
name: scope
description: >
  This skill should be used when the user wants to "start a new project lifecycle",
  "define scope", "scope out research questions", "begin expedite", "new expedite project",
  or needs to decompose a high-level goal into structured decision areas with evidence
  requirements before beginning research.
allowed-tools:
  - Read
  - Write
  - Glob
  - Bash
  - AskUserQuestion
argument-hint: "[project-description]"
---
```

Source: plugin-dev skill-development SKILL.md, research-engine SKILL.md files, PRODUCT-DESIGN.md

**Key details:**
- `name` field MUST match the directory name (e.g., `scope` in `skills/scope/`)
- `description` MUST use third person ("This skill should be used when...")
- Trigger phrases in double quotes enable auto-invocation
- `allowed-tools` restricts what tools the skill can use
- `argument-hint` documents expected arguments for autocomplete
- `version` field is optional in frontmatter (used by some official plugins, not by research-engine)
- Description should be specific enough to trigger on the right queries but not so broad it triggers on unrelated ones

### Pattern 3: Dynamic Context Injection in Skill Body

**What:** Every SKILL.md body starts with `!cat` command to inject runtime state.
**When to use:** All skills except scope (which initializes state).
**Example:**

```markdown
Current lifecycle state:
!`cat .expedite/state.yml 2>/dev/null || echo "No active lifecycle"`
```

Source: PRODUCT-DESIGN.md Decision 21

**Note for Phase 1:** Include this injection line in all SKILL.md stubs. It is inert until Phase 2 creates state.yml, but having it from the start means no SKILL.md edits are needed later for this feature.

### Pattern 4: Stub SKILL.md Body

**What:** Phase 1 creates SKILL.md files with valid frontmatter but placeholder body content.
**When to use:** This phase only -- later phases replace the body.
**Example:**

```markdown
---
name: scope
description: >
  [trigger phrases]
allowed-tools: [tool list]
---

Current lifecycle state:
!`cat .expedite/state.yml 2>/dev/null || echo "No active lifecycle"`

# Scope Skill

> This skill is under development. Full orchestration will be implemented in Phase 4.

**Purpose:** Start a new expedite lifecycle. Interactively define the project intent,
research questions, and success criteria.

**Entry conditions:** None (first phase of lifecycle).

**Next step:** After scope is complete, run `/expedite:research`.
```

### Anti-Patterns to Avoid

- **Nesting components inside `.claude-plugin/`:** Commands, skills, agents, hooks MUST be at the plugin root level, NOT inside `.claude-plugin/`. Only `plugin.json` goes inside `.claude-plugin/`.
- **Using `plugin.json` instead of `.claude-plugin/plugin.json`:** The manifest MUST be at `.claude-plugin/plugin.json`. Placing it at the root will not be discovered.
- **Putting full orchestration logic in Phase 1 SKILL.md files:** This phase creates stubs only. Full implementation comes in later phases. Trying to write complete orchestration now creates merge conflicts later.
- **Creating hooks.json in Phase 1:** The design mentions hooks for SessionStart, but the hook field naming is LOW confidence (Decision 27). Hooks should be deferred to Phase 2 where state management is implemented.
- **Using "arc" naming anywhere:** The design doc uses "arc" throughout but the project has been renamed to "expedite". All references must use "expedite" (namespace: `/expedite:`, directory: `.expedite/`, plugin name: `expedite`).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Plugin discovery | Custom registration system | Convention-based auto-discovery (`skills/{name}/SKILL.md`) | Platform handles discovery automatically. Any custom system would be ignored. |
| Skill namespacing | Manual namespace configuration | Plugin name from plugin.json | `/expedite:scope` namespace is automatic from `"name": "expedite"` in manifest. |
| Trigger phrase matching | Custom trigger logic | SKILL.md `description` field with quoted phrases | Platform's built-in matching handles auto-invocation. |

**Key insight:** Phase 1 is pure platform convention adherence. There is zero custom logic -- only files in the right places with the right format.

## Common Pitfalls

### Pitfall 1: plugin.json Location

**What goes wrong:** Placing plugin.json at the plugin root instead of `.claude-plugin/plugin.json`.
**Why it happens:** Intuitive to put the manifest at root. Many other ecosystems (npm, cargo) do this.
**How to avoid:** Always use `.claude-plugin/plugin.json`. The `.claude-plugin/` directory is the platform's convention.
**Warning signs:** Plugin not recognized by Claude Code after installation.

### Pitfall 2: SKILL.md Missing from Subdirectory

**What goes wrong:** Creating a `skills/scope/README.md` instead of `skills/scope/SKILL.md`, or placing SKILL.md directly in `skills/` instead of a subdirectory.
**Why it happens:** Confusing the skill directory convention with the command file convention.
**How to avoid:** Every skill MUST be in `skills/{name}/SKILL.md` -- exactly this path structure.
**Warning signs:** Skill not showing up in `/expedite:` autocomplete.

### Pitfall 3: Description Not Triggering Auto-Invocation

**What goes wrong:** Vague description like "Provides scope management" causes the skill to never auto-trigger.
**Why it happens:** Descriptions need specific trigger phrases in quotes.
**How to avoid:** Use the pattern: `This skill should be used when the user asks to "phrase 1", "phrase 2", ...`
**Warning signs:** User types natural language that should trigger the skill but it does not activate.

### Pitfall 4: Arc-to-Expedite Renaming Incomplete

**What goes wrong:** Mixed references to "arc" and "expedite" in files.
**Why it happens:** The design document uses "arc" throughout. Easy to copy-paste without renaming.
**How to avoid:** Search all created files for "arc" before committing. Use "expedite" for: plugin name, namespace, state directory (`.expedite/`), all user-facing text.
**Warning signs:** `/arc:scope` appearing instead of `/expedite:scope`.

### Pitfall 5: Over-Engineering Stub SKILL.md Files

**What goes wrong:** Writing full orchestration logic in Phase 1 stubs, which then conflicts with Phase 4-9 implementations.
**Why it happens:** Desire to be thorough. Design doc has complete orchestration specs.
**How to avoid:** Keep stubs minimal: frontmatter + context injection + purpose statement + placeholder note. Full orchestration is the job of later phases.
**Warning signs:** SKILL.md files exceeding 50 lines in Phase 1.

### Pitfall 6: Wrong YAML Frontmatter Format for allowed-tools

**What goes wrong:** Using incorrect YAML syntax for the tools list.
**Why it happens:** Multiple valid YAML formats (string, array, flow sequence).
**How to avoid:** Use the array format consistently:
```yaml
allowed-tools:
  - Read
  - Write
  - Bash
```
**Warning signs:** Tools not available when skill is invoked.

## Code Examples

Verified patterns from official sources and reference implementations:

### Plugin Manifest (plugin.json)

```json
{
  "name": "expedite",
  "version": "0.1.0",
  "description": "Research-driven development lifecycle: Scope, Research, Design, Plan, Execute",
  "author": {
    "name": "Jared Wallenfels"
  }
}
```

Source: research-engine `.claude-plugin/plugin.json`, plugin-dev manifest-reference.md

### Scope Skill Frontmatter

```yaml
---
name: scope
description: >
  This skill should be used when the user wants to "start a new project lifecycle",
  "define project scope", "scope out research questions", "begin expedite",
  "new expedite project", "what should we research", or needs to decompose a
  high-level goal into structured decision areas with evidence requirements
  before beginning research.
allowed-tools:
  - Read
  - Write
  - Glob
  - Bash
  - AskUserQuestion
argument-hint: "[project-description]"
---
```

Source: PRODUCT-DESIGN.md scope skill spec, adapted from research-engine define-scope SKILL.md

### Research Skill Frontmatter

```yaml
---
name: research
description: >
  This skill should be used when the user wants to "research the questions",
  "gather evidence", "investigate questions", "run research", "start research phase",
  or needs to dispatch parallel research agents to gather evidence for scoped questions.
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

Source: PRODUCT-DESIGN.md research skill spec, adapted from research-engine research-topic SKILL.md

### Design Skill Frontmatter

```yaml
---
name: design
description: >
  This skill should be used when the user wants to "generate a design",
  "create design document", "design phase", "write RFC", "write PRD",
  or needs to synthesize research evidence into an implementation or product design.
  Supports --override flag to proceed despite gate warnings.
allowed-tools:
  - Read
  - Write
  - Glob
  - Bash
argument-hint: "[--override]"
---
```

Source: PRODUCT-DESIGN.md design skill spec

### Plan Skill Frontmatter

```yaml
---
name: plan
description: >
  This skill should be used when the user wants to "generate a plan",
  "create implementation plan", "plan phase", "decompose tasks",
  "break down into tasks", or needs to decompose a design into an ordered
  implementation plan. Supports --override flag.
allowed-tools:
  - Read
  - Write
  - Glob
  - Bash
argument-hint: "[--override]"
---
```

Source: PRODUCT-DESIGN.md plan skill spec

### Execute Skill Frontmatter

```yaml
---
name: execute
description: >
  This skill should be used when the user wants to "execute the plan",
  "run the plan", "implement", "build it", "start building",
  or needs to execute implementation plan tasks sequentially in the current session.
allowed-tools:
  - Read
  - Write
  - Edit
  - Glob
  - Grep
  - Bash
  - WebSearch
  - WebFetch
---
```

Source: PRODUCT-DESIGN.md execute skill spec

### Status Skill Frontmatter

```yaml
---
name: status
description: >
  This skill should be used when the user wants to "check lifecycle status",
  "where am I", "show status", "lifecycle status", "what phase am I on",
  or needs to see the current lifecycle state, phase, progress, and recommended next action.
allowed-tools:
  - Read
  - Glob
  - Bash
---
```

Source: PRODUCT-DESIGN.md status skill spec

### Dynamic Context Injection (all skills)

```markdown
Current lifecycle state:
!`cat .expedite/state.yml 2>/dev/null || echo "No active lifecycle"`
```

Source: PRODUCT-DESIGN.md Decision 21

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| plugin.json at root | `.claude-plugin/plugin.json` in subdirectory | Current convention | Plugin not recognized if placed at root |
| Manual skill registration in manifest | Auto-discovery from `skills/{name}/SKILL.md` | Current convention | No manifest changes needed when adding skills |
| Generic descriptions | Trigger-phrase descriptions with quoted phrases | Current best practice | Enables auto-invocation, improves discoverability |

**Deprecated/outdated:**
- The design doc references "arc" throughout -- this has been renamed to "expedite"
- Decision 27 (hooks.json field naming) is LOW confidence and should NOT be implemented in this phase

## Open Questions

1. **Installation method for local development**
   - What we know: research-engine uses a local marketplace (`~/.claude/plugins/local-marketplace/`) with a `marketplace.json` pointing to plugin source. Plugins are installed to `~/.claude/plugins/cache/local/{name}/{version}/`.
   - What's unclear: Whether to develop in-place at the project directory and symlink, or to copy files to the cache location during development. The `--plugin-dir` flag for `cc` (Claude Code CLI) allows testing from any directory.
   - Recommendation: Develop in the project repo (`~/Desktop/Projects/expedite-plugin/`). Set up the directory structure so it can be tested with `cc --plugin-dir .` or symlinked into the local marketplace. The project repo IS the plugin source -- it should have `.claude-plugin/plugin.json` and `skills/` at its root.

2. **Whether the `references/` mentioned in FOUND-01 means per-skill or top-level**
   - What we know: The design doc specifies per-skill `references/` directories (e.g., `skills/research/references/prompt-web-researcher.md`). The research-engine plugin also uses per-skill references. No reference plugin has a top-level `references/` directory.
   - What's unclear: FOUND-01 says "plugin.json, skills/, references/" suggesting a top-level references/. But the design structure shows no top-level references/.
   - Recommendation: Create per-skill `references/` subdirectories (matching design and reference implementations). The FOUND-01 "references/" likely refers to the per-skill directories collectively. If verification is desired, the success criteria in the roadmap ("self-contained with plugin.json, skills/, and references/ subdirectories") could mean each skill is self-contained with its own references/.

3. **Whether to include `templates/` directory in Phase 1**
   - What we know: The design specifies `templates/` at the plugin root containing `state.yml.template`, `sources.yml.template`, `gitignore.template`. These are used by Phase 2 (state management).
   - What's unclear: Whether to create the directory now (empty or with placeholders) or defer entirely.
   - Recommendation: Create the `templates/` directory with placeholder files in Phase 1. This makes the plugin directory structure complete from day one and avoids a structural change in Phase 2. The templates themselves are simple -- they can be written now with content or as empty placeholders.

## Sources

### Primary (HIGH confidence)
- **plugin-dev plugin** (`~/.claude/plugins/cache/claude-plugins-official/plugin-dev/55b58ec6e564/`) - Plugin structure reference, manifest reference, frontmatter reference, skill development guide. Official Anthropic documentation.
- **research-engine plugin** (`~/.claude/plugins/cache/local/research-engine/0.1.0/`) - Direct ancestor of Expedite. Proven plugin structure with 5 skills, per-skill references, minimal manifest.
- **PRODUCT-DESIGN.md** (`.planning/research/arc-implementation/design/PRODUCT-DESIGN.md`) - Complete design specification with all 6 skill frontmatters, directory structure, and decisions register.

### Secondary (MEDIUM confidence)
- **feature-dev, code-review plugins** (`~/.claude/plugins/cache/claude-plugins-official/`) - Official Anthropic plugins confirming minimal manifest pattern (name + description + author, no version).
- **installed_plugins.json** (`~/.claude/plugins/installed_plugins.json`) - Shows how plugins are registered and tracked.

### Tertiary (LOW confidence)
- None. All findings verified against multiple primary sources.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Plugin architecture is well-documented with multiple reference implementations
- Architecture: HIGH - Directory structure is convention-based with zero ambiguity from official docs
- Pitfalls: HIGH - All pitfalls derived from actual documentation and reference implementation inspection

**Research date:** 2026-02-27
**Valid until:** 2026-03-27 (stable domain -- plugin conventions unlikely to change rapidly)
