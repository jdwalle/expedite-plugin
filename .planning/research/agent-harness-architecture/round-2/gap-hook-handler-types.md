### Gap Research: Hook Handler Type Availability in Plugin Hooks

**Round:** 2
**Targeted Gaps:**
- Gap 1: Whether prompt and agent hook handler types are available in plugin-registered hooks (hooks/hooks.json) vs. only project-level settings

**Decision Area(s):** DA-1: Hook Architecture for Runtime Guardrails

**What Was Already Known:**
- Claude Code provides 16 hook event types with 4 handler types: command, HTTP, prompt, agent
- Handler types were documented in round 1 research but availability by registration location was not confirmed
- The round 1 research noted all 4 handler types but did not distinguish whether all 4 work from every registration location (user settings, project settings, plugin hooks.json, skill/agent frontmatter)

### Findings

#### Finding 1: Official Docs Confirm All 4 Handler Types Available in Plugin hooks.json

**Evidence:** The official Claude Code Plugins Reference page (https://code.claude.com/docs/en/plugins-reference) explicitly lists 3 handler types under the "Hook types" section for plugins:

> **Hook types:**
> - `command`: Execute shell commands or scripts
> - `prompt`: Evaluate a prompt with an LLM (uses `$ARGUMENTS` placeholder for context)
> - `agent`: Run an agentic verifier with tools for complex verification tasks

Note that `http` is not listed in the plugin reference, but `command`, `prompt`, and `agent` are all explicitly listed as valid handler types for plugin hooks.

The plugin reference also includes a hook troubleshooting section that says:
> "Confirm the hook type is valid: `command`, `prompt`, or `agent`"

This lists the same 3 types without `http`, suggesting `http` may not be supported in plugin hooks (or is simply less commonly documented there).

**Source quality:** Primary (official Anthropic documentation, code.claude.com/docs/en/plugins-reference)
**Relevance:** Directly answers the gap question. This is definitive.

#### Finding 2: No Handler Type Restrictions by Registration Location in Hook Reference

**Evidence:** The official Hooks Reference page (https://code.claude.com/docs/en/hooks) documents hook handler types and hook locations as separate concepts with no cross-referencing restrictions. The "Hook locations" table lists 6 registration locations including "Plugin hooks/hooks.json" without any handler type caveats. The "Hook handler fields" section describes all 4 types (command, http, prompt, agent) without mentioning location-based restrictions.

The only restrictions documented are **per event type**, not per registration location:
- 8 events support all 4 handler types (command, http, prompt, agent): PreToolUse, PostToolUse, PostToolUseFailure, PermissionRequest, UserPromptSubmit, Stop, SubagentStop, TaskCompleted
- 10 events support only `type: "command"`: SessionStart, SessionEnd, ConfigChange, InstructionsLoaded, Notification, PreCompact, SubagentStart, TeammateIdle, WorktreeCreate, WorktreeRemove

**Source quality:** Primary (official Anthropic documentation, code.claude.com/docs/en/hooks)
**Relevance:** The absence of location-based restrictions, combined with explicit listing of prompt/agent as valid plugin hook types, strongly confirms these types work in plugin hooks.

#### Finding 3: Hook Configuration Format Is Identical Across Locations

**Evidence:** The official Plugins creation guide (https://code.claude.com/docs/en/plugins) states in the migration section:

> "Copy the `hooks` object from your `.claude/settings.json` or `settings.local.json`, since the format is the same."

This confirms that the hook configuration schema -- including handler type -- is identical between project settings and plugin hooks.json. There is no schema difference that would restrict handler types by registration location.

**Source quality:** Primary (official Anthropic documentation)
**Relevance:** Confirms schema parity between registration locations.

#### Finding 4: Skill/Agent Frontmatter Hooks Also Support All Handler Types

**Evidence:** The hooks reference documents "Hooks in skills and agents" using frontmatter with the note: "Hooks use the same configuration format as settings-based hooks but are scoped to the component's lifetime." Since plugin-bundled skills can define frontmatter hooks, this gives plugins a second path to register prompt/agent hooks even if hooks.json didn't support them (which it does).

**Source quality:** Primary (official Anthropic documentation)
**Relevance:** Provides a fallback registration path and confirms format universality.

#### Finding 5: ECC and claude-code-harness hooks.json Files Not Accessible

**Evidence:** Could not access the hooks.json files from these repositories -- GitHub search requires authentication, and `gh` CLI is not available in this environment. The round 1 research documented that both repos use command hooks (SessionStart, PostToolUse, Stop, PreToolUse) but did not note whether they use prompt or agent handler types.

**Source quality:** N/A (unable to verify)
**Relevance:** Would have provided real-world examples but is not needed given the official documentation is definitive.

### Key Data Points

1. **Prompt hooks in plugins: CONFIRMED.** Official plugins-reference explicitly lists `prompt` as a valid hook type for plugins.
2. **Agent hooks in plugins: CONFIRMED.** Official plugins-reference explicitly lists `agent` as a valid hook type for plugins.
3. **HTTP hooks in plugins: AMBIGUOUS.** Not listed in the plugins-reference hook types, but also not explicitly excluded. The hook reference docs list `http` without location restrictions. The plugins-reference troubleshooting says valid types are "command, prompt, or agent" (omitting http). This may be an omission or a genuine restriction.
4. **Handler type restrictions are per-event, not per-location.** The only documented restriction is that 10 of 16 events only support `type: "command"` hooks. The 8 events that support all types do so regardless of registration location.
5. **Schema parity confirmed.** The hooks.json format in plugins uses the same schema as settings-based hooks.

### Case Studies

No real-world examples of plugins using prompt or agent hook handler types were found. This is likely because:
- Prompt and agent hooks are relatively new features
- Most open-source Claude Code plugins/harnesses predate these handler types
- The ECC and claude-code-harness repos (the most sophisticated examples) were not accessible for verification

However, the official documentation is unambiguous that these types are supported in plugin hooks.

### Gap Fill Assessment

| Gap | Status | Confidence | Notes |
|-----|--------|------------|-------|
| Hook handler type availability in plugins | FILLED | High | Official Anthropic plugins-reference explicitly lists prompt and agent as valid handler types for plugin hooks. Hook reference shows no location-based restrictions. Schema parity confirmed. The only restrictions are per-event-type (8 events support all types, 10 events support command-only). |

### Design Implications for DA-1

This finding means expedite CAN register prompt and agent hooks directly in its plugin `hooks/hooks.json` for semantic gate enforcement (G3, G5). Specifically:

- **G3 (design quality gate)** can use a `Stop` or `SubagentStop` hook with `type: "agent"` to spawn a verifier that reads the design artifact and evaluates against rubric criteria
- **G5 (execution quality gate)** can use the same pattern
- **No need for project-level hook configuration** -- the plugin's hooks.json is sufficient
- **Event-type restriction to note**: If semantic gates need to fire on SessionStart, SubagentStart, Notification, TeammateIdle, ConfigChange, PreCompact, or WorktreeCreate/Remove, only command hooks are available. But these events are not relevant for G3/G5 gate enforcement, which targets Stop and SubagentStop.
- **HTTP hooks in plugins**: Uncertain. If expedite ever needs HTTP-based hook handlers from the plugin, this should be verified separately. For current design (command + prompt + agent), this is not a blocker.

### Sources

1. **Claude Code Hooks Reference** - https://code.claude.com/docs/en/hooks
   - Primary source for hook event types, handler types, event-handler compatibility matrix, hook locations table, and configuration schema
2. **Claude Code Plugins Reference** - https://code.claude.com/docs/en/plugins-reference
   - Primary source confirming prompt and agent as valid hook types in plugin hooks, plugin hooks.json schema, troubleshooting guidance
3. **Claude Code Plugins Guide** - https://code.claude.com/docs/en/plugins
   - Confirms schema parity between settings-based hooks and plugin hooks.json (migration section)
