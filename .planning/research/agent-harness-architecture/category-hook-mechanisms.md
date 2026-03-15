# Hook Mechanisms Research

## Category Overview

Hooks are the primary code-enforcement surface in Claude Code plugins. They intercept lifecycle events and execute shell commands, HTTP endpoints, LLM prompts, or agent-based validators. For expedite, hooks represent the path from prompt-enforced gates to programmatic guardrails. This category serves DA-1 (Hook Architecture) and DA-5 (Quality Gate Enforcement).

## Key Findings

### Hook Type Inventory (Official Documentation)

Claude Code provides **16 hook event types** as of March 2026:

| Event | When it fires | Matcher support | Blocking? |
|-------|--------------|-----------------|-----------|
| `SessionStart` | Session begins or resumes | `startup`, `resume`, `clear`, `compact` | No |
| `UserPromptSubmit` | User submits a prompt | No matcher | Yes (can modify/block) |
| `PreToolUse` | Before any tool call | Tool name regex | Yes (can deny) |
| `PermissionRequest` | Permission dialog appears | Tool name regex | Yes (can auto-approve/deny) |
| `PostToolUse` | After tool call succeeds | Tool name regex | No (informational) |
| `PostToolUseFailure` | After tool call fails | Tool name regex | No (informational) |
| `Notification` | Claude sends notification | Notification type | No |
| `SubagentStart` | Subagent spawned | Agent type name | No |
| `SubagentStop` | Subagent finishes | Agent type name | No |
| `Stop` | Claude finishes responding | No matcher | No |
| `TeammateIdle` | Agent team member goes idle | No matcher | No |
| `TaskCompleted` | Task marked complete | No matcher | No |
| `InstructionsLoaded` | CLAUDE.md or rules loaded | No matcher | No |
| `ConfigChange` | Config file changes | Config source | No |
| `WorktreeCreate` | Worktree being created | No matcher | Can replace default behavior |
| `WorktreeRemove` | Worktree being removed | No matcher | No |
| `PreCompact` | Before context compaction | `manual`, `auto` | No |
| `SessionEnd` | Session terminates | Exit reason | No |

### Four Hook Handler Types

1. **Command hooks** (`type: "command"`): Run a shell command. Input via stdin as JSON. Output via exit code + stdout JSON.
2. **HTTP hooks** (`type: "http"`): POST JSON to a URL. Response body is the decision. Non-2xx responses are non-blocking errors.
3. **Prompt hooks** (`type: "prompt"`): Single-turn LLM evaluation. Returns yes/no decision as JSON. Good for context-aware validation.
4. **Agent hooks** (`type: "agent"`): Spawn a subagent with tools (Read, Grep, Glob) to verify conditions. Most powerful but slowest.

### Exit Code Semantics (Command Hooks)

| Exit code | Effect |
|-----------|--------|
| 0 | Allow (no action) |
| 1 | Non-blocking error (logged, continues) |
| 2 | **Blocking**: For PreToolUse, denies the tool call. For UserPromptSubmit, blocks the prompt. For PermissionRequest, denies permission. |

For PreToolUse specifically, hooks can return JSON on stdout with `permissionDecision: "deny"` and `permissionDecisionReason` to provide feedback to Claude.

### Hook Configuration Locations

| Location | Scope |
|----------|-------|
| `~/.claude/settings.json` | All projects (user-wide) |
| `.claude/settings.json` | Single project (committable) |
| `.claude/settings.local.json` | Single project (gitignored) |
| Plugin `hooks/hooks.json` | When plugin enabled |
| Skill/agent frontmatter | While component active |

### Matcher Pattern System

Matchers are regex strings filtering when hooks fire. Tool events match on `tool_name` (e.g., `"Bash"`, `"Edit|Write"`, `"mcp__.*"`). Omitting matcher or using `"*"` matches all occurrences. This enables granular targeting: intercept only Write calls to state files, only Bash commands matching certain patterns, etc.

## Real-World Examples

### claude-code-harness (Chachamaru127)

Uses a **TypeScript guardrail engine** with 9 declarative rules (R01-R09), compiled and type-checked. Hooks defined in `hooks.json`:
- **SessionStart**: Environment checks, context loading
- **PostToolUse**: Automated testing and change tracking after tool execution
- **Stop**: Session summaries

The harness implements a 3-layer architecture with hooks as "thin shims" that call into the TypeScript guardrail engine. This separates the enforcement logic (TypeScript, testable) from the hook wiring (JSON configuration).

### everything-claude-code (affaan-m)

Hook-based automation with runtime profiles:
- **`ECC_HOOK_PROFILE=minimal|standard|strict`**: Controls hook strictness at runtime
- **`ECC_DISABLED_HOOKS="hook-id-1,hook-id-2"`**: Disable specific hooks
- **SessionStart**: Load persisted context with root fallback for graceful degradation
- **PreToolUse**: Validate tool usage, check constraints
- **PostToolUse**: Log actions, extract learnings (continuous learning pattern)
- **Stop**: Save session state, suggest compaction, cleanup

Hook implementations are Node.js scripts (`session-start.js`, `session-end.js`, `pre-compact.js`, `evaluate-session.js`) for cross-platform reliability, replacing fragile inline commands.

### claude-agentic-framework (dralgorhythm)

Uses hooks in the swarm execution phase:
- Quality gates run after each builder agent (tests, linting, type checks, builds)
- Hook-based verification before commit/push
- Multiple review passes with adversarial reviewers

## Gate Enforcement Patterns

### Pattern 1: PreToolUse as State Machine Guard

A `PreToolUse` hook matching `Write` can intercept writes to state files, parse the proposed content, and validate:
- Phase transitions are forward-only (valid FSM transitions)
- Required fields are present
- Schema conforms to expected structure

```json
{
  "hooks": {
    "PreToolUse": [{
      "matcher": "Write",
      "hooks": [{
        "type": "command",
        "command": ".claude/hooks/validate-state-write.sh"
      }]
    }]
  }
}
```

The script reads `tool_input.file_path` and `tool_input.content` from stdin JSON, and if the target is `state.yml`, validates the phase transition. Exit code 2 blocks invalid transitions.

### Pattern 2: Prompt-Based Quality Evaluation

Prompt hooks enable LLM-as-judge validation at hook level:

```json
{
  "type": "prompt",
  "prompt": "Evaluate whether this tool output meets quality criteria..."
}
```

The prompt hook returns a yes/no decision. This is lighter than spawning a full agent but still uses LLM judgment.

### Pattern 3: Agent-Based Deep Verification

Agent hooks spawn a subagent with tool access to verify conditions:

```json
{
  "type": "agent",
  "prompt": "Verify that the DESIGN.md covers all decision areas...",
  "timeout": 60
}
```

The agent can Read files, Grep for patterns, and make an informed decision. This is the most powerful pattern for quality gates but adds latency.

### Pattern 4: PostToolUse for Audit Trail

`PostToolUse` hooks can log every state change, creating an append-only audit trail:
- Track which tool modified which file
- Record the before/after diff
- Timestamp all state transitions

This creates the traceability expedite's override mechanism needs.

## Anti-Patterns and Limitations

### Over-blocking
Hooks that are too strict can create frustrating UX. The `permissionDecisionReason` field helps by explaining why a tool call was blocked, but excessive false positives degrade trust.

### Latency
Each hook adds latency to the tool execution path. Command hooks are fastest (shell script). Prompt hooks add ~2-5 seconds (LLM call). Agent hooks can take 30-60+ seconds. For frequently-firing events like PostToolUse, latency matters.

### SessionStart Bugs
Three Claude Code platform bugs (#16538, #13650, #11509) affected SessionStart reliability. Everything-claude-code addresses this with a "root fallback" pattern for graceful degradation. Status as of March 2026: need to verify if these are resolved.

### Hook Scope Limitations
- Hooks cannot modify the LLM's system prompt at runtime
- Hooks cannot inject context into the conversation (only block/allow)
- SubagentStop hooks fire after the subagent completes; they cannot intervene mid-execution
- `once: true` parameter only works in skill/agent frontmatter hooks, not project settings

### No Inter-Hook Communication
Each hook invocation is independent. Hooks cannot share state with each other during a single event resolution. If multiple hooks fire on the same event, they run sequentially and each gets the original input.

## Sources

- [Hooks reference - Claude Code Docs](https://code.claude.com/docs/en/hooks)
- [Claude Code plugin hooks guide](https://www.gend.co/blog/configure-claude-code-hooks-automation)
- [Claude Code Hooks Complete Guide (Feb 2026)](https://smartscope.blog/en/generative-ai/claude/claude-code-hooks-guide/)
- [claude-code-hooks-mastery (disler)](https://github.com/disler/claude-code-hooks-mastery)
- [Hooks in Claude Code (eesel.ai)](https://www.eesel.ai/blog/hooks-in-claude-code)
- [Claude Code Hooks: All 12+ Lifecycle Events](https://claudefa.st/blog/tools/hooks/hooks-guide)
- [claude-code-harness (Chachamaru127)](https://github.com/Chachamaru127/claude-code-harness)
- [everything-claude-code (affaan-m)](https://github.com/affaan-m/everything-claude-code)
- [claude-code-harness ARCHITECTURE.md](https://github.com/Chachamaru127/claude-code-harness/blob/main/docs/ARCHITECTURE.md)
