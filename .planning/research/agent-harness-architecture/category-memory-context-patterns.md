# Memory & Context Patterns Research

## Category Overview

Context management across sessions and context resets determines whether an LLM agent can reliably resume work. The challenge: inject enough context for continuity without exceeding token limits. This category serves DA-6 (Context and Memory Strategy).

## Key Findings

### Memory Tiers (MemGPT / Letta Model)

MemGPT established the foundational tiered memory architecture for LLM agents, drawing from OS virtual memory concepts:

| Tier | Analogy | Always in context? | Access pattern |
|------|---------|-------------------|----------------|
| Core memory | RAM | Yes | Always available, compressed essentials |
| Recall memory | Indexed disk | No | Semantic search over past interactions |
| Archival memory | Cold storage | No | Long-term storage, moved in/out as needed |

**Key insight**: Not all state belongs in the context window. The tiering decision — what's always loaded vs. on-demand — directly addresses token waste.

**Letta V1 evolution** (February 2026): Introduced "Context Repositories" — programmatic context management with git-based versioning. Moves from the original MemGPT self-edit pattern to structured context management.

### Claude Code Context Mechanisms

#### Frontmatter Injection (`!command`)
Skills can run shell commands in frontmatter that inject output into the system prompt:
```yaml
---
!cat .expedite/state.yml 2>/dev/null || echo "No active lifecycle"
---
```
Runs at skill load time. Simple but no filtering — full file content loaded.

#### SessionStart Hooks
Load context programmatically when a session begins:
- Can read multiple files selectively
- Can transform/summarize before injection
- ECC pattern: Node.js script with graceful fallback

#### PreCompact Hooks
Fire before context compaction. Can:
- Save critical state before compaction discards context
- Inject "save these facts" instructions
- ECC implements `pre-compact.js` and `suggest-compact.js` for strategic compaction management

#### Subagent Persistent Memory (New)
Claude Code now supports per-subagent persistent memory:
```yaml
---
name: my-agent
memory: user  # or project, local
---
```
- Three scopes: `user` (global), `project` (committable), `local` (gitignored)
- Stored in `~/.claude/agent-memory/<name>/` (user) or `.claude/agent-memory/<name>/` (project)
- `MEMORY.md` index (first 200 lines) loaded into subagent context automatically
- Subagent manages its own memory files across conversations

**Relevance to expedite**: Research agents could maintain memory of patterns, conventions, and past findings across lifecycles.

#### CLAUDE.md Conventions
CLAUDE.md files are loaded at session start and provide persistent project context:
- `CLAUDE.md` in repo root: project-wide context (build commands, architecture, conventions)
- `.claude/rules/*.md`: Rule files loaded into context
- `InstructionsLoaded` hook fires when these files are loaded

**Best practice from Agent Teams**: Structure CLAUDE.md with clear module boundaries, verification commands, and operational guidance. This reduces per-agent exploration costs.

### Context Budget Strategies

#### Problem Statement
Expedite injects full `state.yml` (which grows with questions and gate history) into every skill, regardless of what that skill needs. This wastes tokens and can push against context limits.

#### Strategy 1: Scoped Injection (Planned for expedite)
Split state into separate files, each skill loads only what it needs:
- `state.yml` (~15 lines): Core identity and phase
- `questions.yml`: Research questions (only for research/scope skills)
- `gates.yml`: Gate history (only for gate-evaluating skills)
- `tasks.yml`: Execution tasks (only for execute skill)

This is expedite's planned ARCH-02 through ARCH-06. The harness research validates this approach — it's consistent with the MemGPT tiering principle.

#### Strategy 2: Hook-Mediated Context Loading
SessionStart hooks can:
1. Read current phase from state
2. Determine which context is relevant
3. Inject only what's needed for the current phase
4. Provide a "context map" showing what other context exists (without loading it)

ECC does this with its SessionStart script — loads persisted context selectively based on session type.

#### Strategy 3: Progressive Disclosure (wshobson/agents)
Skills follow a three-tier activation:
1. **Metadata** (always loaded): Name, description, trigger conditions
2. **Instructions** (loaded when activated): Full skill content
3. **Resources/examples** (loaded on demand): Reference material

This prevents loading 65+ skills into context when only 2-3 are relevant.

#### Strategy 4: Strategic Compaction (ECC)
ECC implements "strategic compaction" with explicit skills:
- `suggest-compact.js`: Monitors context usage, suggests when to compact
- `pre-compact.js`: Saves critical state before compaction
- Manual compaction control through `/checkpoint` command
- `CLAUDE_AUTOCOMPACT_PCT_OVERRIDE` environment variable controls auto-compaction threshold

#### Strategy 5: Summarization Before Injection
Instead of injecting full artifacts, inject summaries:
- "3 key decisions from DESIGN.md: [summary]"
- "Current research status: 12/15 questions answered, 3 gaps remaining"
- The LLM can then read the full artifact on demand if it needs detail

### Session Handoff Patterns

#### Problem Statement
When context resets mid-task (compaction, session restart, context window exhaustion), the LLM needs to reconstruct its understanding. Current heuristic approach (artifact existence checking) is fragile.

#### Pattern 1: Checkpoint-Based Handoff (LangGraph)
Save full state at checkpoints. On resume, load the checkpoint:
- Deterministic: same checkpoint → same resume point
- No interpretation needed — the checkpoint IS the state
- Thread ID maps to the checkpoint

#### Pattern 2: State File with Step Tracking
Write the current step to a persistent file:
```yaml
current_step:
  skill: research
  step: 7
  label: "Dispatch web researchers"
  substep: "waiting_for_agents"
```
On resume, read the step file and jump directly to that step.

**Current gap in expedite**: `current_step` exists but resume logic doesn't use it. Fixing this would immediately improve resume reliability.

#### Pattern 3: Session Summary Hooks (ECC)
Stop hooks write a session summary before context clears:
- What was accomplished this session
- What's the current state
- What should happen next

SessionStart hooks read the previous session's summary to restore context. This creates a handoff document between sessions.

#### Pattern 4: Artifact Chain Verification
Verify that the expected artifact chain exists and is consistent:
1. Read state.yml for current phase
2. Verify all upstream artifacts exist (e.g., if `design_complete`, verify SCOPE.md + SYNTHESIS.md + DESIGN.md all exist)
3. Spot-check consistency (e.g., DESIGN.md references DAs from SCOPE.md)
4. If verification fails, enter recovery mode

This is a code-enforceable version of expedite's current heuristic approach.

### CrewAI Memory Comparison

CrewAI provides four memory types:
1. **Short-term** (ChromaDB + RAG): Session-scoped, semantic similarity retrieval
2. **Long-term** (SQLite): Cross-session persistence of learned patterns
3. **Entity** (RAG-based): Knowledge about specific entities (people, projects, concepts)
4. **Contextual**: Orchestration layer combining the other three

**Limitation**: CrewAI doesn't scope memory per user — context can bleed between users. Mem0 integration fixes this with `user_id` filtering.

**Relevance to expedite**: The 4-type taxonomy is useful conceptually:
- Short-term ≈ current session context (frontmatter injection)
- Long-term ≈ project memory (MEMORY.md)
- Entity ≈ lifecycle-specific knowledge (state.yml, artifacts)
- Contextual ≈ the skill's awareness of what to load

### AutoGen State Patterns

AutoGen (Microsoft) uses a state save/load pattern:
- Agents can serialize and deserialize state
- State is maintained across conversation turns
- GroupChat coordinator manages multi-agent state
- Each agent maintains its own message history

Less relevant to Claude Code's architecture (which uses file-based state), but the principle of per-agent state isolation is applicable.

## Sources

- [MemGPT Research](https://research.memgpt.ai/)
- [MemGPT Paper (arXiv 2310.08560)](https://arxiv.org/abs/2310.08560)
- [Intro to Letta / MemGPT (Letta Docs)](https://docs.letta.com/concepts/memgpt/)
- [Agent Memory (Letta blog)](https://www.letta.com/blog/agent-memory)
- [Letta V1 Agent Loop](https://www.letta.com/blog/letta-v1-agent)
- [CrewAI Memory Docs](https://docs.crewai.com/en/concepts/memory)
- [Deep Dive into CrewAI Memory Systems](https://sparkco.ai/blog/deep-dive-into-crewai-memory-systems)
- [AI Agent Memory Comparison](https://dev.to/foxgem/ai-agent-memory-a-comparative-analysis-of-langgraph-crewai-and-autogen-31dp)
- [Evaluating Memory in AI Agent Frameworks](https://www.gocodeo.com/post/evaluating-memory-and-state-handling-in-leading-ai-agent-frameworks)
- [Claude Code Subagents (persistent memory)](https://code.claude.com/docs/en/sub-agents)
- [Claude Code Hooks reference](https://code.claude.com/docs/en/hooks)
- [wshobson/agents (progressive disclosure)](https://github.com/wshobson/agents)
- [everything-claude-code (strategic compaction)](https://github.com/affaan-m/everything-claude-code)
