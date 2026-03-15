# Harness Architecture Patterns Research

## Category Overview

The Claude Code plugin ecosystem has rapidly evolved from simple skill packs to comprehensive orchestration layers ("harnesses"). This research catalogs the ecosystem, identifies convergent patterns, and classifies architectural approaches. This is the foundation category serving DA-1, DA-2, DA-3, DA-4, DA-6, DA-7, and DA-9.

## Ecosystem Catalog

### 1. claude-code-harness (Chachamaru127)
- **URL**: https://github.com/Chachamaru127/claude-code-harness
- **Description**: "Dedicated Development Harness — Achieving High-Quality Development Through an Autonomous Plan→Work→Review Cycle"
- **Architecture**: 3-layer (core engine, skills, hooks). TypeScript guardrail engine with 9 declarative rules (R01-R09). 5 verb skills (plan/execute/review/release/setup). 3 agents (worker/reviewer/scaffolder).
- **Key mechanisms**: Hooks (SessionStart, PostToolUse, Stop), TypeScript guardrails, structured config schema, dry-run modes, protected paths
- **Maturity**: Active development, versioned releases, v3 architecture, comprehensive docs

### 2. everything-claude-code (affaan-m)
- **URL**: https://github.com/affaan-m/everything-claude-code
- **Stars**: 72K+ | **Forks**: 9.1K | **Contributors**: 30+
- **Description**: "Agent harness performance optimization system" — Anthropic hackathon winner, evolved over 10+ months
- **Architecture**: Plugin-based with modular rules. 12 core agents, 65+ skills, 40+ commands. Hook-based automation with runtime profiles. Continuous learning system.
- **Key mechanisms**: Hooks (all 4 phases), agent delegation, instinct-based learning, model routing, quality gates, PM2 orchestration, strategic compaction
- **Maturity**: Most starred Claude Code plugin. Production-tested. v1.8.0. 997 internal tests.

### 3. claude-agentic-framework (dralgorhythm)
- **URL**: https://github.com/dralgorhythm/claude-agentic-framework
- **Description**: "A More Effective Agent Harness for Claude" — parallel agent swarms for coordinated workflows
- **Architecture**: 4-phase swarm cycle (Research → Plan → Execute → Review). 8 specialized worker types with model-tiered assignment. Personas for single-agent work. "Beads" issue tracking system.
- **Key mechanisms**: Parallel swarm dispatch (3-8 agents), adversarial multi-pass review (5 parallel reviewers), model tiering (Haiku/Sonnet/Opus), quality gates per worker, artifacts directory
- **Maturity**: Active development, documented docs/, installation script

### 4. wshobson/agents
- **URL**: https://github.com/wshobson/agents
- **Description**: "Intelligent automation and multi-agent orchestration" — 112 agents, 72 plugins, 146 skills, 79 tools
- **Architecture**: Granular plugin system (average 3.4 components per plugin). 4-tier model strategy. 16 multi-agent workflow coordinators. Progressive disclosure for skills.
- **Key mechanisms**: Plugin isolation (install only what you need), context-driven skill activation, conductor plugin for semantic revert, agent teams plugin with 7 presets
- **Maturity**: 242 commits, comprehensive docs, MIT license

### 5. claude-orchestration (mbruhler)
- **URL**: https://github.com/mbruhler/claude-orchestration
- **Description**: "Multi-agent workflow orchestration plugin" — declarative flow syntax
- **Architecture**: Flow-based orchestration with sequential (`->`), parallel (`||`), conditional (`~>`) routing. Variable capture (`:var`) and injection (`{var}`). Manual checkpoints (`@label`).
- **Key mechanisms**: Declarative .flow files, auto-generated scripts, ephemeral agents, output capture and variable passing, checkpoint gates
- **Maturity**: Novel approach, active development

### 6. ruflo (ruvnet)
- **URL**: https://github.com/ruvnet/ruflo
- **Description**: "Leading agent orchestration platform for Claude" — multi-agent swarms with self-learning
- **Architecture**: Distributed swarm intelligence, RAG integration, enterprise-grade. Self-learning neural capabilities that learn from task execution.
- **Key mechanisms**: Swarm coordination, adaptive learning, model routing, distributed consensus protocols
- **Maturity**: Active development, broad feature set

### 7. claude_code_agent_farm (Dicklesworthstone)
- **URL**: https://github.com/Dicklesworthstone/claude_code_agent_farm
- **Description**: "Orchestration framework for running 20+ Claude Code agents in parallel"
- **Architecture**: External orchestration (not a plugin). Tmux-based monitoring. Lock-based coordination.
- **Key mechanisms**: Parallel agent sessions, automated bug fixing, best-practices sweeps, real-time monitoring
- **Maturity**: Specialized use case (mass parallelism)

### 8. ccswarm (nwiizo)
- **URL**: https://github.com/nwiizo/ccswarm
- **Description**: "Multi-agent orchestration system using Claude Code with Git worktree isolation"
- **Architecture**: Git worktree per agent for true isolation. Specialized agent roles.
- **Key mechanisms**: Worktree isolation, multi-agent collaboration, specialized agents
- **Maturity**: Focused on worktree-based isolation pattern

## Pattern Taxonomy

### Mechanisms by Repo

| Mechanism | harness | ECC | agentic | wshobson | orchestration | ruflo | agent_farm | ccswarm |
|-----------|---------|-----|---------|----------|---------------|-------|------------|---------|
| Hooks | ✅ TS engine | ✅ Node.js | ✅ | — | — | — | — | — |
| State mgmt | Config schema | Hook-based | Artifacts dir | Plugin state | Flow variables | Swarm state | Lock files | Worktree |
| Agents | 3 typed | 12 typed | 8 typed | 112 typed | 3 built-in + temp | Swarm agents | External | Specialized |
| Teams | — | PM2 multi-agent | Swarm (3-8) | Agent teams | Parallel flows | Swarm | 20+ parallel | Worktree-isolated |
| Worktrees | — | Git worktree | — | — | — | — | — | ✅ Core |
| Quality gates | Rule engine | `/quality-gate` | Per-worker tests | Workflow coordinators | Checkpoints | Learning | Sweeps | — |
| Memory/context | — | Continuous learning | Personas + artifacts | Progressive disclosure | Variable capture | Self-learning | — | — |
| Model tiering | — | 4-tier routing | 3-tier (H/S/O) | 4-tier routing | — | Model routing | — | — |

## Convergent Patterns (3+ repos)

### 1. Model Tiering (4 repos)
ECC, claude-agentic-framework, wshobson/agents, and ruflo all implement tiered model assignment:
- **Fast/cheap** (Haiku): Read-only exploration, simple lookups
- **Balanced** (Sonnet): Most development work, testing, documentation
- **Premium** (Opus): Architecture decisions, complex reasoning, critical reviews

This is the strongest convergent signal — independent implementations arrived at the same 3-tier model strategy.

### 2. Typed Agent Specialization (5 repos)
All major harnesses define typed, specialized agents rather than generic workers:
- Worker types have explicit role descriptions, model assignments, and tool restrictions
- Agent definitions follow a consistent pattern: name, purpose/description, model, tools
- Specialization enables cost optimization (simple tasks → cheap models)

### 3. Multi-Phase Workflow Cycles (4 repos)
Harness, agentic-framework, wshobson, and orchestration all implement phased workflows:
- Plan → Execute → Review (harness)
- Research → Plan → Execute → Review (agentic-framework)
- Context → Spec → Implement (wshobson conductor)
- Sequential → Parallel → Conditional (orchestration flows)

### 4. Hook-Based Lifecycle Management (3 repos)
claude-code-harness, ECC, and agentic-framework use hooks for:
- Session start context loading
- Post-tool validation (tests, linting)
- Session end state persistence

### 5. Quality Gate Integration (4 repos)
Harness (TypeScript rules), ECC (`/quality-gate`), agentic-framework (per-worker tests), and orchestration (checkpoint gates) all implement quality verification, but with different enforcement mechanisms.

## Unique Innovations

### TypeScript Guardrail Engine (claude-code-harness)
Only harness compiles enforcement rules into a typed, testable TypeScript engine. All others use shell scripts, Node.js scripts, or prompt-based enforcement. This is the strongest code-enforcement pattern discovered.

### Continuous Learning / Instincts (ECC)
Only ECC implements learning from session history:
- Auto-extract patterns mid-session
- Cluster instincts into skills
- Confidence scoring for learned behaviors
- Import/export instinct sets

### Declarative Flow Syntax (claude-orchestration)
Only orchestration provides a declarative DSL for workflow definition:
- `step1 -> [task1 || task2] ~> (if passed) -> deploy`
- Variable capture and injection between steps
- Auto-generated execution scripts

### Beads Issue Tracking (claude-agentic-framework)
Lightweight issue tracking system coordinating swarm workers through git, enabling distributed task management without external tools.

### Semantic Revert (wshobson/agents conductor)
Undo work by logical unit (track, phase, task) rather than file-level git revert.

## Architecture Comparison Matrix

| Dimension | claude-code-harness | ECC | claude-agentic-framework |
|-----------|-------------------|-----|------------------------|
| **Enforcement** | TypeScript rules (code) | Hook profiles (config) | Per-worker quality gates |
| **State format** | JSON config schema | Hook-persisted context | Artifacts directory |
| **Agent dispatch** | 3 fixed agents | 12 typed + delegation rules | 8 typed + swarm dispatch |
| **Skill model** | 5 verb skills (thin) | 65+ specialized skills | 65+ context-aware skills |
| **Coordination** | Plan→Work→Review cycle | PM2 + multi-agent commands | Swarm phases (Research→Plan→Execute→Review) |
| **Context strategy** | SessionStart hooks | Continuous learning + compaction | Personas + artifacts directory |
| **Worktree usage** | None documented | Git worktree support | Not documented |

## Maturity Assessment

| Repo | Stars | Contributors | Test coverage | Documentation | Release cadence |
|------|-------|-------------|---------------|---------------|-----------------|
| ECC | 72K+ | 30+ | 997 tests | Comprehensive | Active (v1.8.0) |
| claude-code-harness | Moderate | Active | TypeScript typed | Architecture docs | Active (v3) |
| claude-agentic-framework | Growing | Active | Per-worker tests | Multi-doc | Active |
| wshobson/agents | Growing | 242 commits | — | Comprehensive /docs | Active |
| claude-orchestration | Early | Active | — | README + examples | Active |

## Sources

- [claude-code-harness](https://github.com/Chachamaru127/claude-code-harness)
- [claude-code-harness ARCHITECTURE.md](https://github.com/Chachamaru127/claude-code-harness/blob/main/docs/ARCHITECTURE.md)
- [everything-claude-code](https://github.com/affaan-m/everything-claude-code)
- [claude-agentic-framework](https://github.com/dralgorhythm/claude-agentic-framework)
- [wshobson/agents](https://github.com/wshobson/agents)
- [claude-orchestration](https://github.com/mbruhler/claude-orchestration)
- [ruflo](https://github.com/ruvnet/ruflo)
- [claude_code_agent_farm](https://github.com/Dicklesworthstone/claude_code_agent_farm)
- [ccswarm](https://github.com/nwiizo/ccswarm)
- [claude-code GitHub topics](https://github.com/topics/claude-code)
- [awesome-claude-plugins](https://github.com/Chat2AnyLLM/awesome-claude-plugins)
- [awesome-claude-code](https://github.com/jmanhype/awesome-claude-code)
- [Claude Code plugin marketplaces](https://claudemarketplaces.com/)
- [Anthropic official plugin directory](https://github.com/anthropics/claude-plugins-official)
