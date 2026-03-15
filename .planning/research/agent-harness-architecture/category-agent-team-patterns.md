# Agent & Team Patterns Research

## Category Overview

Agent definition conventions and team coordination patterns determine how work gets distributed, how agents communicate, and how failures are handled. This category serves DA-3 (Agent Definition and Team Coordination) and DA-7 (Skill-Agent Interaction Architecture).

## Key Findings

### Agent Definition Conventions

#### Official Claude Code Subagent Format

Subagents are Markdown files with YAML frontmatter. The official schema (from Claude Code docs):

| Field | Required | Description |
|-------|----------|-------------|
| `name` | Yes | Unique identifier (lowercase, hyphens) |
| `description` | Yes | When Claude should delegate (critical for auto-delegation) |
| `tools` | No | Allowlist of tools. Inherits all if omitted |
| `disallowedTools` | No | Denylist removed from inherited/specified tools |
| `model` | No | `sonnet`, `opus`, `haiku`, or `inherit` (default: inherit) |
| `permissionMode` | No | `default`, `acceptEdits`, `dontAsk`, `bypassPermissions`, `plan` |
| `maxTurns` | No | Maximum agentic turns before stop |
| `skills` | No | Skills to preload into subagent context |
| `mcpServers` | No | MCP servers available to this subagent |
| `hooks` | No | Lifecycle hooks scoped to this subagent |
| `memory` | No | Persistent memory scope: `user`, `project`, `local` |
| `background` | No | Always run as background task (default: false) |
| `isolation` | No | `worktree` for git worktree isolation |

**Storage locations** (priority order):
1. `--agents` CLI flag (session only, highest priority)
2. `.claude/agents/` (project-level, committable)
3. `~/.claude/agents/` (user-level, all projects)
4. Plugin `agents/` directory (lowest priority)

#### Built-in Subagent Types

| Agent | Model | Tools | Purpose |
|-------|-------|-------|---------|
| Explore | Haiku | Read-only | Fast codebase search (3 thoroughness levels) |
| Plan | Inherit | Read-only | Research for plan mode |
| general-purpose | Inherit | All | Complex multi-step tasks |
| Bash | Inherit | Terminal | Shell command execution |

#### Agent Definitions Across Repos

**claude-code-harness**: 3 typed agents (worker, reviewer, scaffolder). Part of the TypeScript guardrail engine. Agents are tightly coupled to the Plan→Work→Review cycle.

**ECC**: 12 core agents with explicit specializations (planner, architect, tdd-guide, code-reviewer, security-reviewer, build-error-resolver, e2e-runner, refactor-cleaner, doc-updater, go-reviewer, go-build-resolver, python-reviewer, database-reviewer). Each has defined purpose and model assignment.

**claude-agentic-framework**: 8 worker types with model tiering:
- worker-explorer (Haiku) — fast search
- worker-builder (Sonnet) — implementation
- worker-reviewer (Sonnet) — code review
- worker-tester (Sonnet) — test generation
- worker-researcher (Sonnet) — web research
- worker-architect (Opus) — architecture decisions
- worker-security (Sonnet) — vulnerability analysis
- worker-refactor (Sonnet) — cleanup

**wshobson/agents**: 112 agents across 4 model tiers:
- Tier 1 (Opus): 42 agents for critical work
- Tier 2 (Inherit): 42 agents for complex tasks
- Tier 3 (Sonnet): 51 agents for support tasks
- Tier 4 (Haiku): 18 agents for fast operations

### Team Coordination Patterns

#### Pattern 1: Subagents (Hub-and-Spoke)

The default Claude Code pattern. Main session spawns subagents via the Agent tool. Each subagent:
- Gets its own context window with custom system prompt
- Cannot see other subagents' output during execution
- Cannot spawn other subagents (no nesting)
- Returns results to the main session (summary + artifacts)
- Can run in foreground (blocking) or background (concurrent)

**Coordination**: Orchestrator skill collects results sequentially after parallel dispatch. No inter-agent communication. Artifact-based data flow.

**Best for**: Focused parallel tasks, context isolation, cost control.

#### Pattern 2: Agent Teams (Mesh Communication)

Claude Code's experimental Agent Teams feature (v2.1.32+, Opus 4.6+):
- **Team Lead**: Primary session manages coordination
- **Teammates**: Independent Claude instances with own context windows
- **Shared Task List**: Central work queue visible to all agents (pending → in_progress → completed with dependencies)
- **Mailbox System**: Direct messaging between teammates without routing through lead
- **Cost**: 3-4x tokens of single session for 3-teammate team

**Communication channels**:
- Shared task list updates (all observe)
- Direct messages to individual teammates
- Broadcast messages to all (use sparingly — token scaling)
- Idle notifications when awaiting coordination

**Teammate lifecycle**: Teammates claim tasks from shared list rather than receiving direct assignments. Self-coordination reduces lead overhead.

**Best for**: Complex collaborative work, cross-layer features, debate-driven architecture.

#### Pattern 3: Swarm Dispatch (claude-agentic-framework)

Specialized swarm orchestration:
- `/swarm-plan` launches 3-6 explorer agents in parallel
- `/swarm-execute` distributes work across up to 8 builders
- `/swarm-review` spins up 5 parallel reviewers (security, performance, architecture, tests, quality)
- "Beads" system tracks tasks through git

**Model optimization**: Exploration → Haiku (cheap), Implementation → Sonnet (balanced), Architecture → Opus (premium).

#### Pattern 4: Workflow Orchestrators (wshobson/agents)

16 multi-agent workflow coordinators sequence 7+ agents:
- `backend-architect → database-architect → frontend-developer → test-automator → security-auditor → deployment-engineer → observability-engineer`
- Agent teams plugin with 7 presets: review, debug, feature, fullstack, research, security, migration
- Conductor plugin: Context → Spec → Implement with semantic revert

#### Pattern 5: Flow-Based Orchestration (claude-orchestration)

Declarative workflow definition:
```
step1 -> [task1 || task2 || task3] ~> (if passed) -> deploy @review -> release
```
- Variable capture (`:var`) passes data between steps
- Checkpoint gates (`@label`) require human approval
- Ephemeral agents created and cleaned automatically

### Inter-Agent Communication

| Mechanism | Availability | Latency | Bidirectional |
|-----------|-------------|---------|---------------|
| Artifact hand-off (files) | All patterns | Low | No |
| Agent summary return | Subagents | Low | No |
| Shared task list | Agent Teams | Medium | Yes (via tasks) |
| Direct messages (SendMessage) | Agent Teams | Medium | Yes |
| Broadcast | Agent Teams | High (token scaling) | One-to-many |

**Critical constraint**: Subagents cannot communicate with each other during execution. The only inter-agent data flow for subagents is through the filesystem (write files, read files).

### Skill-Agent Boundary Patterns

#### Thick Skill / Thin Agent (expedite's current pattern)
- Skills: 500-860 lines, contain all orchestration logic, state management, user interaction
- Agents: Prompt templates, receive fully assembled prompt, write results, return summary
- **Pro**: Skills are self-contained, easy to understand
- **Con**: Skills grow unwieldy, hard to test, hard to extract reusable patterns

#### Thin Skill / Thick Agent (claude-code-harness pattern)
- Skills: 5 verb skills (plan, execute, review, release, setup) as thin orchestrators
- Agents: 3 typed agents (worker, reviewer, scaffolder) with substantial logic
- TypeScript guardrail engine handles enforcement separately
- **Pro**: Separation of concerns, testable enforcement logic
- **Con**: More moving parts, agent definitions are complex

#### Plugin-Per-Concern (wshobson/agents pattern)
- Average 3.4 components per plugin
- Skills activate based on context (progressive disclosure)
- Agents bundled within plugins with clear responsibility boundaries
- **Pro**: Install only what you need, minimal token overhead
- **Con**: Many small files, discovery complexity

#### Persona + Swarm (claude-agentic-framework pattern)
- Personas for single-agent work (e.g., `/architect`, `/qa-engineer`)
- Swarms for parallel multi-agent phases
- Skills auto-suggested based on context (65+ skills)
- **Pro**: Flexible single/multi-agent switching, cost-optimized
- **Con**: Complex workflow orchestration

### Failure Handling

**Subagent failure**: If a background subagent fails due to missing permissions, it can be resumed in foreground to retry with interactive prompts. The agent ID is preserved for resumption.

**Team failure**: Teammates failing does not crash the team lead. The lead can observe task status and reassign work. Teammates should be terminated before lead cleanup.

**Swarm failure**: claude-agentic-framework runs quality gates per worker — if a worker's output fails tests/linting, it's flagged for review. Partial work is preserved in the Beads system.

**General pattern**: Write results to disk early and often. If an agent crashes, its partial artifacts on disk can be used for recovery. Return codes and summary messages help the orchestrator handle failures gracefully.

## Sources

- [Claude Code Subagents Documentation](https://code.claude.com/docs/en/sub-agents)
- [Claude Code Agent Teams Guide](https://claudefa.st/blog/guide/agents/agent-teams)
- [How I Built a Plugin for Claude Code Agent Teams](https://dev.to/_b6eedfa0c44fb8af59ed9/how-i-built-a-plugin-and-service-for-claude-code-agent-teams-1cn6)
- [Claude Code Agent Teams (Cobus Greyling)](https://cobusgreyling.medium.com/claude-code-agent-teams-ca3ec5f2d26a)
- [Claude Code Agent Teams Guide 2026](https://claudefa.st/blog/guide/agents/agent-teams)
- [Swarm Orchestration Skill (gist)](https://gist.github.com/kieranklaassen/4f2aba89594a4aea4ad64d753984b2ea)
- [wshobson/agents](https://github.com/wshobson/agents)
- [claude-agentic-framework](https://github.com/dralgorhythm/claude-agentic-framework)
- [claude-orchestration](https://github.com/mbruhler/claude-orchestration)
- [claude-code-harness](https://github.com/Chachamaru127/claude-code-harness)
- [everything-claude-code](https://github.com/affaan-m/everything-claude-code)
