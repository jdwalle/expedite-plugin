# Expedite

A [Claude Code](https://docs.anthropic.com/en/docs/claude-code) plugin that replaces gut-feel development with an evidence-based lifecycle. Every design choice traces to a research finding. Every implementation step traces to a design decision. You get an auditable chain from *why* to *what* to *how*.

## How It Works

Expedite guides you through six phases, each with a quality gate that must pass before you move on:

```
Scope ──G1──▶ Research ──G2──▶ Design ──G3──▶ Plan ──G4──▶ Spike ──G5──▶ Execute
```

1. **Scope** — Break your goal into decision areas and research questions with evidence requirements
2. **Research** — Agents fan out in parallel to gather evidence from the web, your codebase, and MCP sources
3. **Design** — Synthesize research into a design document (RFC or PRD) where every decision traces back to evidence
4. **Plan** — Decompose the design into sized, ordered phases with tactical decisions identified
5. **Spike** — Resolve tactical decisions and produce implementation steps with real file paths and line numbers
6. **Execute** — Agents follow the spike blueprint to write the code, with per-task atomic commits

## Usage

Navigate to any project directory and run the commands in order:

```bash
# Start a new lifecycle
/expedite:scope

# Gather evidence for your scoped questions
/expedite:research

# Generate a design from research findings
/expedite:design

# Break the design into an implementation plan
/expedite:plan

# Resolve tactical decisions for a phase
/expedite:spike 1

# Execute the plan
/expedite:execute

# Check where you are at any point
/expedite:status
```

Each command picks up where the last one left off. State is stored in `.expedite/` inside your project directory.

## What Each Phase Does

### Scope (`/expedite:scope`)

Interactive session where you describe your goal. Expedite asks adaptive follow-up questions, then produces a structured question plan organized into Decision Areas (DAs), each with depth calibration (Deep/Standard/Light), readiness criteria, and evidence requirements.

**Produces:** `.expedite/scope/SCOPE.md`, `.expedite/questions.yml`

### Research (`/expedite:research`)

Dispatches parallel research agents — web researchers search the internet, codebase researchers scan your code — to gather evidence for each scoped question. A sufficiency evaluator checks whether evidence meets the requirements. If gaps remain, targeted gap-fill research runs automatically.

**Produces:** `.expedite/research/evidence/`, `.expedite/research/SYNTHESIS.md`

### Design (`/expedite:design`)

A design architect agent reads all research evidence and produces a design document. Engineering projects get an RFC; product projects get a PRD. Every design decision traces back to specific evidence. A semantic gate verifier checks for evidence support, internal consistency, transparent assumptions, and reasoning completeness.

**Produces:** `.expedite/design/DESIGN.md`

### Plan (`/expedite:plan`)

A plan decomposer agent breaks the design into uniform-sized phases (waves for engineering, epics for product). Each phase lists tasks with effort estimates calibrated for agent execution. Tactical decisions that need resolution before coding are flagged for the spike phase.

**Produces:** `.expedite/plan/PLAN.md`

### Spike (`/expedite:spike <phase-number>`)

Resolves tactical decisions for one phase. Clear-cut decisions are resolved inline; genuinely ambiguous ones are presented to you. Optional research agents can investigate alternatives. Produces ordered implementation steps with specific file paths, line numbers, and sub-steps.

**Produces:** `.expedite/plan/phases/<slug>/SPIKE.md`

### Execute (`/expedite:execute`)

Dispatches a task implementer agent for each task in the spiked phase. The agent works in an isolated git worktree, implements the code, verifies against acceptance criteria, and creates an atomic commit. You review and approve each task's changes.

**Produces:** Code changes with atomic git commits per task

## Quality Gates

Every phase transition is guarded by a quality gate:

| Gate | Phase | What It Checks |
|------|-------|----------------|
| G1 | Scope | Decision areas have depth/readiness, questions have evidence requirements, minimum coverage |
| G2 | Research | Evidence exists for each DA, sufficiency scores meet thresholds, synthesis covers scope |
| G3 | Design | Decisions trace to evidence, DA coverage complete, assumptions transparent |
| G4 | Plan | Tasks trace to design decisions, phase sizing uniform, tactical decisions identified |
| G5 | Spike | TD resolutions have rationale, implementation steps cover all tasks, traceability intact |

Gates use a dual-layer architecture:
- **Layer 1 (Structural):** Deterministic Node.js scripts that check document structure, coverage, and formatting
- **Layer 2 (Semantic):** An LLM-based gate verifier that evaluates reasoning quality across four dimensions

Gate outcomes:
- **Go** — All checks pass, proceed to next phase
- **Go Advisory** — Structural pass with minor semantic notes, proceed with awareness
- **Recycle** — Issues found, fix and re-run the gate

## Agents

Expedite uses 9 specialized agents:

| Agent | Role | Model |
|-------|------|-------|
| **web-researcher** | Searches the web for evidence | Sonnet |
| **codebase-researcher** | Scans project code for patterns and evidence | Sonnet |
| **sufficiency-evaluator** | Assesses whether evidence meets requirements | Sonnet |
| **research-synthesizer** | Integrates evidence into coherent synthesis | Opus |
| **design-architect** | Generates design documents from evidence | Opus |
| **gate-verifier** | Semantic quality evaluation for gates | Opus |
| **plan-decomposer** | Breaks design into implementation phases | Sonnet |
| **spike-researcher** | Investigates tactical decision alternatives | Sonnet |
| **task-implementer** | Implements code changes in isolated worktrees | Sonnet |

## State Management

All lifecycle state lives in `.expedite/` inside your project:

```
.expedite/
├── state.yml          # Current phase, project metadata
├── checkpoint.yml     # Resume point (skill, step, substep)
├── gates.yml          # Gate outcomes and override history
├── questions.yml      # Research questions and status
├── sources.yml        # Configured research sources
├── log.yml            # Event log (transitions, gates, overrides)
├── audit.log          # Append-only state change audit trail
├── session-summary.md # Context for resuming across sessions
├── scope/
│   └── SCOPE.md
├── research/
│   ├── SYNTHESIS.md
│   └── evidence/
├── design/
│   └── DESIGN.md
└── plan/
    ├── PLAN.md
    └── phases/
        └── wave-1/
            └── SPIKE.md
```

### Hooks

Plugin hooks enforce state integrity automatically:

- **PreToolUse (Write):** Validates state file schemas before writes are allowed
- **PreToolUse (Edit):** Blocks direct edits to state files (must use Write for validation)
- **PostToolUse (Write):** Logs all state changes to an append-only audit trail
- **PreCompact:** Saves checkpoint and session summary before context compaction
- **Stop:** Writes session summary at session end for resume context

### Resuming Work

Expedite handles session boundaries automatically. When you return to a project:

1. Run any `/expedite:` command — it detects the current phase and offers to resume
2. Or run `/expedite:status` to see where you left off and what to do next

The checkpoint system tracks progress at the step level within each skill, so you resume exactly where you stopped.

### Overrides

If a gate blocks progress and you disagree with the assessment, each skill supports an override protocol. Overrides are logged to `gates.yml` with full audit trail — the chain of evidence is preserved even when you choose to proceed despite warnings.

## Requirements

- [Claude Code](https://docs.anthropic.com/en/docs/claude-code) CLI
- Node.js (for gate scripts and hooks)

### Optional

- **WebSearch** tool access — Required for web research. Without it (e.g., on AWS Bedrock), the web-researcher agent will return UNAVAILABLE status and research falls back to codebase-only evidence.
- **MCP servers** — If configured in your project, research agents can query them as additional evidence sources.

## Adding to `.gitignore`

The `.expedite/` directory contains project-specific lifecycle state. Add it to your project's `.gitignore`:

```
.expedite/
```
