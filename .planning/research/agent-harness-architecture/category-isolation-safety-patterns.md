# Isolation & Safety Patterns Research

## Category Overview

Worktree isolation provides a safety boundary for agents that modify code, preventing concurrent agents from clobbering each other's changes. This category serves DA-4 (Worktree Isolation Strategy).

## Key Findings

### Claude Code Worktree API

#### `--worktree` CLI Flag
Introduced in Claude Code v2.1.49 (February 19, 2026). Starts Claude Code in its own git worktree:
```bash
claude --worktree          # Auto-named worktree
claude --worktree my-fix   # Named worktree
claude --worktree --tmux   # In its own tmux session
```
Each worktree gets an isolated copy of the repo. Multiple parallel sessions can work without code edits clobbering each other.

#### `EnterWorktree` Tool
Creates a new worktree within a running session. **Limitation**: Only creates new worktrees — cannot switch into an existing one. There is active discussion about adding a `ResumeWorktree` tool or parameter.

#### `ExitWorktree` Tool
Leaves an EnterWorktree session. Added to complement the entry mechanism.

#### Agent `isolation: "worktree"` Parameter
Custom subagents can be configured with worktree isolation in frontmatter:
```yaml
---
name: code-modifier
description: Modifies source code in isolation
isolation: worktree
---
```
The subagent gets its own worktree that is **automatically cleaned up** if the subagent makes no changes. If changes were made, the worktree path and branch are returned in the result.

#### `WorktreeCreate` / `WorktreeRemove` Hooks
Hook events that fire when worktrees are created or removed:
- `WorktreeCreate`: Can replace default git worktree behavior
- `WorktreeRemove`: Fires at session exit or when subagent finishes

### Real-World Worktree Usage

#### ccswarm (nwiizo)
The most worktree-focused project discovered. Multi-agent orchestration system built entirely around git worktree isolation:
- Each agent gets its own worktree
- Specialized agents collaborate through isolated workspaces
- Results merged back after completion

#### claude_code_agent_farm (Dicklesworthstone)
Runs 20+ Claude Code sessions in parallel. While not a plugin, it demonstrates the pattern of many agents working on the same repo simultaneously — worktree isolation prevents file conflicts.

#### ECC (everything-claude-code)
Documents git worktree support for parallelization and references the cascade method for test parallelization across worktrees.

#### Extending Worktrees for Database Isolation
A March 2026 blog post by Damian Galarza documents extending Claude Code worktrees beyond git to include database isolation — each worktree gets its own database schema/migration state. This addresses the limitation that git worktrees only isolate file system state, not application state.

### Failure Modes

#### Merge Conflicts
When a worktree agent completes and its changes need to merge back:
- If changes are on a separate branch, standard git merge/rebase applies
- Conflicts require manual resolution (agent cannot auto-resolve)
- **Mitigation**: Assign non-overlapping file responsibilities to different agents

#### Agent Crashes Mid-Worktree
- If an agent crashes, the worktree persists on disk
- Auto-cleanup only happens for worktrees with no changes
- Orphaned worktrees need manual cleanup (`git worktree prune`)
- `WorktreeRemove` hook fires at session exit, enabling cleanup scripts

#### Multiple Agents, Same Files
- Even with worktree isolation, two agents editing the same files create merge conflicts
- **Best practice**: Assign file ownership boundaries before spawning
- Agent Teams docs recommend: "clearly define module boundaries and file ownership in spawn prompts"

#### Unwanted Worktree Creation
Known bug: Claude Code can create worktrees without explicit request. Workaround: add `EnterWorktree` to permissions deny list.

### Selective Isolation Guidance

| Operation Type | Isolation Need | Rationale |
|---------------|---------------|-----------|
| Code modification (execute) | **High** | Modifies source code; conflicts with concurrent edits |
| Research agents (web/codebase) | **Low** | Write to `.expedite/` evidence files, not source code |
| Planning/design (main session) | **None** | Interactive, single-session work |
| Spike research | **Low-Medium** | Writes research files; may probe codebase |
| Test execution | **Medium** | May modify test fixtures; parallel test runs can conflict |

For expedite specifically:
- **Execute skill**: Highest isolation value. Only skill that modifies source code.
- **Research agents**: Write to `.expedite/evidence/` — not source code. Worktree isolation unnecessary unless agents probe codebase destructively.
- **Spike researcher**: Writes to `.expedite/plan/phases/` — low conflict risk.

### Worktree vs. Other Isolation Patterns

| Pattern | Isolation level | Overhead | Use case |
|---------|----------------|----------|----------|
| Git worktree | File system (git-tracked) | Low (hardlinks) | Code-modifying agents |
| Docker container | Full OS-level | High | Untrusted execution |
| Process isolation | Memory/CPU | Medium | Security-sensitive operations |
| Directory namespacing | Logical only | None | Non-conflicting artifact storage |

Git worktrees are the right level of isolation for Claude Code agents. They're lightweight (shared object store via hardlinks), fast to create/destroy, and integrate naturally with git-based workflows. Full container isolation is overkill for trusted agents working on the same codebase.

## Sources

- [Claude Code Worktree Setup Guide (Verdent)](https://www.verdent.ai/ko/guides/claude-code-worktree-setup-guide)
- [Boris Cherny thread on --worktree](https://www.threads.com/@boris_cherny/post/DVAAoZ3gYut/)
- [Claude Code Common Workflows (worktrees)](https://code.claude.com/docs/en/common-workflows)
- [Extending Worktrees for Database Isolation](https://www.damiangalarza.com/posts/2026-03-10-extending-claude-code-worktrees-for-true-database-isolation/)
- [EnterWorktree feature request #31969](https://github.com/anthropics/claude-code/issues/31969)
- [Git Worktree Workflow (Ultimate Guide)](https://deepwiki.com/FlorianBruniaux/claude-code-ultimate-guide/7.10-git-worktree-workflow)
- [Claude Code Worktrees: Parallel Sessions](https://claudefa.st/blog/guide/development/worktree-guide)
- [ccswarm (nwiizo)](https://github.com/nwiizo/ccswarm)
- [Claude Code Subagents docs (isolation field)](https://code.claude.com/docs/en/sub-agents)
