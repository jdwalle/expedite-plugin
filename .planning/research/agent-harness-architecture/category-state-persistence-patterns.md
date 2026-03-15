# State & Persistence Patterns Research

## Category Overview

State management is the backbone of any agent harness. How state is stored, updated, consumed, and recovered determines whether an agent system is reliable or fragile. This category serves DA-2 (State Management Architecture) and DA-8 (Resume and Recovery Architecture).

## Key Findings

### State Format Comparison

| Format | LLM readability | Programmatic parsing | Atomicity | Token efficiency |
|--------|----------------|---------------------|-----------|-----------------|
| YAML | High (human-like) | Requires parser (js-yaml, PyYAML) | Whole-file rewrite | Medium (verbose) |
| JSON | Medium (nested brackets) | Native in most languages | Whole-file rewrite | Medium |
| Structured Markdown | High (section headers) | Regex/pattern-based | Section-level updates possible | Low (most verbose) |
| Directory-based | High (file-per-concern) | File system operations | File-level atomicity | High (only load what you need) |

**Evidence on LLM reliability**: LLMs handle YAML and JSON comparably for reading. The key differentiator is not format but **injection strategy** — how much state gets loaded into context and whether it's relevant to the current task.

### Write Pattern Comparison

#### Complete Rewrite (expedite's current pattern)
- Read entire file → modify in memory → write entire file back
- **Pros**: Simple, deterministic, no merge logic
- **Cons**: Race conditions if multiple writers, entire file in context for every update, easy to corrupt with partial writes
- **Used by**: Most simple Claude Code plugins, expedite

#### Append-Only / Event-Sourced
- New events appended to a log; current state derived from replay
- **Pros**: Full audit trail, no data loss, concurrent-writer safe
- **Cons**: Growing log (compaction needed), replay cost, LLM may struggle with long event streams
- **Used by**: expedite's log.yml (telemetry), LangGraph checkpoints

#### Directory-Based / File-Per-Concern
- Separate files for separate state concerns (e.g., `phase.yml`, `questions.yml`, `gates.yml`)
- **Pros**: Atomic per-concern updates, only load what you need, parallel safe for different concerns
- **Cons**: More files to manage, cross-file consistency requires coordination
- **Used by**: LangGraph (checkpoint per thread), Claude Code plugin state (separate settings files)

#### Checkpoint Snapshots
- Periodic full-state snapshots at defined checkpoints
- **Pros**: Deterministic resume points, rollback capability
- **Cons**: Snapshot frequency tradeoff (too frequent = overhead, too infrequent = lost work)
- **Used by**: LangGraph (every step), expedite (execute-only checkpoint.yml)

### State Consumption Patterns

#### Frontmatter Injection (Claude Code convention)
```yaml
---
!cat .expedite/state.yml 2>/dev/null || echo "No active lifecycle"
---
```
State injected at skill load time. The LLM sees the full content in its system prompt. Simple but no filtering — everything loads.

#### Hook-Mediated Injection (ECC pattern)
SessionStart hooks load context selectively. Stop hooks persist context. This allows:
- Conditional loading (only load relevant context)
- Transformation before injection (summarize, filter)
- Graceful degradation if files missing

#### On-Demand Reading (most skills)
Skills use Read tool to access state files when needed, rather than pre-loading everything. More token-efficient but relies on the LLM knowing what to read.

#### Checkpoint-Based Injection (LangGraph pattern)
State injected from the most recent checkpoint. Thread ID determines which checkpoint to load. This is the most structured pattern but requires a checkpointing system.

## Resume and Checkpoint Patterns

### LangGraph Checkpointing (Industry Reference)

LangGraph provides the most mature agent checkpoint system:

- **Checkpoint per step**: Every node execution saves a full state snapshot
- **Thread-based isolation**: `thread_id` partitions state for independent workflows
- **Pluggable backends**: InMemorySaver (dev), SQLiteSaver (local), PostgresSaver (production), DynamoDBSaver (AWS)
- **Time travel**: Replay from any historical checkpoint
- **Resume**: Load checkpoint by thread_id, continue from last state

**Key insight**: LangGraph checkpoints are **deterministic** — given the same checkpoint, the agent always resumes from the same point. This eliminates the "heuristic resume" problem where the LLM must interpret state to determine where it is.

**Checkpoint granularity**: LangGraph checkpoints at every graph node execution. This is fine-grained (sub-step level) and creates a lot of checkpoints, but storage is cheap and deterministic resume is the payoff.

### CrewAI Flow State Persistence

CrewAI's Flow system uses Pydantic-validated state:
- State persists across method executions within a flow
- FlowPersistence backend stores state with required `id` field
- State can be dict or Pydantic model (validation at write time)
- Flows can be paused and resumed across execution contexts

**Key insight**: Pydantic validation at write time prevents state corruption. Invalid state never gets persisted.

### MemGPT / Letta Tiered Memory

MemGPT introduced the OS-inspired tiered memory model:
- **Core memory** (always in context): Compressed essential facts, like RAM
- **Recall memory** (searchable): Semantic search over past interactions, like indexed disk
- **Archival memory** (long-term): Important info moved in/out of context as needed

**Key insight**: Not all state belongs in context. The tiering decision (what's always-loaded vs. on-demand) directly addresses expedite's token waste problem.

### Claude Code Subagent Persistent Memory (New)

Claude Code now supports per-subagent persistent memory:
- Three scopes: `user` (global), `project` (committable), `local` (gitignored)
- Memory stored in dedicated directories (e.g., `~/.claude/agent-memory/<name>/`)
- MEMORY.md index (first 200 lines) loaded into subagent context
- Subagent manages its own memory files across sessions

This is directly relevant to expedite — agents could maintain their own learning across invocations.

## Idempotency Strategies

### LangGraph Approach
Checkpoints make re-execution safe: if you resume from checkpoint N, step N+1 runs again but produces the same state transition. The checkpoint acts as an idempotency key.

### File-Based Idempotency
Check for output artifact existence before producing:
- "If DESIGN.md already exists, skip generation" (expedite's current pattern)
- **Limitation**: Partial artifacts confuse this check (file exists but is incomplete)

### Content-Hashing
ECC's `content-hash-cache-pattern` skill uses SHA-256 hashing:
- Hash inputs before processing
- Skip processing if output for that hash already exists
- Guarantees idempotency for deterministic transformations

### Checkpoint + Step Tracking
Combine step-level tracking with checkpoint data:
- Record `{step_number, inputs_hash, outputs_hash}` at each checkpoint
- On resume, compare current inputs_hash with checkpoint
- If inputs match, skip; if inputs changed, re-execute

## Case Studies

### claude-code-harness State Model
Uses a JSON config schema (`claude-code-harness.config.schema.json`) for structured, validated configuration:
- Schema-validated at load time
- Dry-run modes for testing
- Protected path restrictions
- Rule-based enforcement (R01-R09)

State is primarily the **development workflow state** (plan, current task, review status) managed through the guardrail engine, not a separate state file.

### ECC State Model
State managed through **hook lifecycle**:
- SessionStart loads previous session context
- PostToolUse updates tracking (learnings, patterns)
- Stop persists session state for next session
- Cross-session state stored via hook scripts (Node.js)

No single monolithic state file — state is distributed across hook-managed artifacts.

### expedite Current State Model (from app analysis)
Single `state.yml` with complete-file rewrite:
- All state in one file (phase, questions, gates, tasks)
- Injected fully via frontmatter at every skill invocation
- Backup-before-write protocol
- Growing file wastes tokens
- Planned split into scoped files (ARCH-02 through ARCH-06)

## Sources

- [LangGraph Persistence Docs](https://docs.langchain.com/oss/python/langgraph/persistence)
- [Mastering LangGraph Checkpointing (2025)](https://sparkco.ai/blog/mastering-langgraph-checkpointing-best-practices-for-2025)
- [Build durable AI agents with LangGraph and DynamoDB (AWS)](https://aws.amazon.com/blogs/database/build-durable-ai-agents-with-langgraph-and-amazon-dynamodb/)
- [LangGraph Checkpoint-Based State Replay](https://dev.to/sreeni5018/debugging-non-deterministic-llm-agents-implementing-checkpoint-based-state-replay-with-langgraph-5171)
- [Production Multi-Agent System with LangGraph](https://markaicode.com/langgraph-production-agent/)
- [CrewAI Memory Docs](https://docs.crewai.com/en/concepts/memory)
- [Deep Dive into CrewAI Memory Systems](https://sparkco.ai/blog/deep-dive-into-crewai-memory-systems)
- [CrewAI State Management (DeepWiki)](https://deepwiki.com/crewAIInc/crewAI/3.3-state-management)
- [AI Agent Memory Comparison: LangGraph, CrewAI, AutoGen](https://dev.to/foxgem/ai-agent-memory-a-comparative-analysis-of-langgraph-crewai-and-autogen-31dp)
- [MemGPT research](https://research.memgpt.ai/)
- [Letta V1 Agent Loop](https://www.letta.com/blog/letta-v1-agent)
- [Agent Memory (Letta blog)](https://www.letta.com/blog/agent-memory)
- [claude-code-harness config schema](https://github.com/Chachamaru127/claude-code-harness/blob/main/claude-code-harness.config.schema.json)
