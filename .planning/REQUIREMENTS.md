# Requirements: Expedite Plugin

**Defined:** 2026-02-27
**Core Value:** Developers can run a complete evidence-based lifecycle — from scoping questions through researched design to executable plan — without losing context, skipping steps, or making decisions without evidence.

## v1 Requirements

Requirements for initial release. Each maps to roadmap phases.

### Plugin Foundation

- [ ] **FOUND-01**: Plugin installs as self-contained directory at `~/.claude/plugins/expedite/` with plugin.json, skills/, references/
- [ ] **FOUND-02**: Claude Code auto-discovers all 6 skills from `skills/{name}/SKILL.md` directory structure
- [ ] **FOUND-03**: Plugin.json contains minimal fields: name, version, description, author
- [ ] **FOUND-04**: All skills invocable via `/expedite:` namespace (scope, research, design, plan, execute, status)
- [ ] **FOUND-05**: Trigger phrases in SKILL.md description enable auto-invocation for each skill

### State Management

- [ ] **STATE-01**: state.yml persists lifecycle state with max 2 nesting levels in `.expedite/` directory
- [ ] **STATE-02**: Every state.yml write uses complete-file rewrite with backup-before-write (state.yml.bak)
- [ ] **STATE-03**: state.yml includes version field for schema evolution
- [ ] **STATE-04**: Phase transitions use granular sub-states (`scope_in_progress`, `scope_complete`, `research_recycled`, etc.)
- [ ] **STATE-05**: Phase transitions are forward-only — no backward movement through lifecycle
- [ ] **STATE-06**: Crash recovery is unambiguous from phase name alone (sub-state determines resume point)

### Context Reconstruction

- [ ] **CTX-01**: Every SKILL.md includes `!cat .expedite/state.yml` for dynamic context injection on invocation
- [ ] **CTX-02**: `/expedite:status` displays full lifecycle overview (current phase, question status, gate history, next action)
- [ ] **CTX-03**: Context reconstruction works after `/clear` via `!cat` injection + manual status (two-layer fallback)

### Scope Skill

- [ ] **SCOPE-01**: User answers 5-8 interactive questions to define the lifecycle goal and context
- [ ] **SCOPE-02**: Intent (product or engineering) detected via freeform prompt parsing
- [ ] **SCOPE-03**: Structured question plan generated with priorities (P0/P1/P2), decision areas (DA-1 through DA-N), and source hints
- [ ] **SCOPE-04**: Question plan presented for user review before any research tokens are spent ("Terraform plan-apply" preview)
- [ ] **SCOPE-05**: User can modify question plan (add, remove, reprioritize) before approval
- [ ] **SCOPE-06**: Source configuration step: confirm default sources or edit sources.yml
- [ ] **SCOPE-07**: G1 gate validates scope completeness (structural gate — all required fields present, at least 1 P0 question)
- [ ] **SCOPE-08**: SCOPE.md artifact written to `.expedite/scope/SCOPE.md` with full question plan and metadata

### Research Skill

- [ ] **RSCH-01**: Questions grouped into 3-5 batches by source-affinity (web, codebase, MCP)
- [ ] **RSCH-02**: Up to 3 research subagents dispatched in parallel via Task() API
- [ ] **RSCH-03**: Each subagent uses per-source prompt template (web-researcher.md, codebase-researcher.md, mcp-researcher.md)
- [ ] **RSCH-04**: Subagents write detailed findings to evidence files and return condensed summary (max 500 tokens)
- [ ] **RSCH-05**: Per-question sufficiency assessed using categorical model: COVERED, PARTIAL, NOT COVERED, UNAVAILABLE-SOURCE
- [ ] **RSCH-06**: Sufficiency evaluated across 3 dimensions: Coverage, Corroboration, Actionability (each rated Strong/Adequate/Weak/None)
- [ ] **RSCH-07**: Dynamic question discovery: subagents propose new questions via `# --- PROPOSED QUESTIONS ---` YAML block
- [ ] **RSCH-08**: Discovered questions deduplicated via LLM judgment, max 4 presented to user for approval
- [ ] **RSCH-09**: Source routing with circuit breaker: retry once on server failure, never retry platform failures, classify as UNAVAILABLE-SOURCE
- [ ] **RSCH-10**: G2 gate evaluates research sufficiency using count-based criteria (majority COVERED, all P0 COVERED or PARTIAL)
- [ ] **RSCH-11**: Recycle triggers gap-fill mode: filters to PARTIAL/NOT COVERED questions, re-batches by decision area
- [ ] **RSCH-12**: Gap-fill agents produce `round-{N}/supplement-*.md` with additive supplement-synthesis
- [ ] **RSCH-13**: SYNTHESIS.md artifact written to `.expedite/research/SYNTHESIS.md` after gate pass
- [ ] **RSCH-14**: Every Decision Area (DA-1 through DA-N) from scope has at least one research question covering it

### Design Skill

- [ ] **DSGN-01**: Design generated in main session (not subagent) from research artifacts
- [ ] **DSGN-02**: Engineering intent produces RFC-style DESIGN.md; product intent produces PRD-style DESIGN.md
- [ ] **DSGN-03**: Revision cycle: user can request up to 2 rounds of changes before gate evaluation
- [ ] **DSGN-04**: Freeform feedback accepted during revision (not AskUserQuestion)
- [ ] **DSGN-05**: Product-intent design generates HANDOFF.md with 9-section format for engineer consumption
- [ ] **DSGN-06**: G3 gate evaluates design quality with MUST/SHOULD criteria
- [ ] **DSGN-07**: DESIGN.md artifact written to `.expedite/design/DESIGN.md`

### Plan Skill

- [ ] **PLAN-01**: Plan generated in main session from design artifacts
- [ ] **PLAN-02**: Engineering intent produces wave-ordered task structure; product intent produces epics/stories structure
- [ ] **PLAN-03**: G4 gate validates plan completeness and feasibility
- [ ] **PLAN-04**: PLAN.md artifact written to `.expedite/plan/PLAN.md`
- [ ] **PLAN-05**: Every Decision Area (DA-1 through DA-N) from scope maps to at least one plan phase/task

### Execute Skill

- [ ] **EXEC-01**: Tasks execute sequentially in wave order from PLAN.md
- [ ] **EXEC-02**: Single checkpoint.yml tracks execution position for pause/resume
- [ ] **EXEC-03**: PROGRESS.md uses append-only `cat >>` pattern (never rewrite)
- [ ] **EXEC-04**: Micro-interaction between tasks: freeform "yes / pause / review" prompt
- [ ] **EXEC-05**: Pause writes checkpoint; `/expedite:execute` resumes from checkpoint
- [ ] **EXEC-06**: Between-wave prompts for wave transitions

### Quality Gates

- [ ] **GATE-01**: Every phase transition guarded by inline gate (G1-G4) evaluated in the producing skill
- [ ] **GATE-02**: Each gate has MUST criteria (all must pass for Go) and SHOULD criteria (failures produce advisory)
- [ ] **GATE-03**: Four gate outcomes: Go, Go-with-advisory, Recycle, Override
- [ ] **GATE-04**: Recycle escalation: 1st informational, 2nd suggest adjustment, 3rd recommend override
- [ ] **GATE-05**: Override records severity and injects gap context into downstream phase prompts
- [ ] **GATE-06**: G1 is structural (deterministic); G2 and G3 require LLM judgment; G4 is structural
- [ ] **GATE-07**: Anti-bias instructions in G2/G3 prompts ("evaluate as if someone else produced this")

### Prompt Templates

- [ ] **TMPL-01**: All prompt templates follow 8-section XML structure: role, context, intent_lens, downstream_consumer, instructions, output_format, quality_gate, input_data
- [ ] **TMPL-02**: Templates use conditional `<intent_lens>` sections for product vs engineering adaptation
- [ ] **TMPL-03**: Model tiers hardcoded in frontmatter: sonnet for researchers, opus for synthesis
- [ ] **TMPL-04**: 3 per-source researcher templates: web-researcher.md, codebase-researcher.md, mcp-researcher.md
- [ ] **TMPL-05**: Sufficiency evaluator reference template for inline assessment
- [ ] **TMPL-06**: Design guide reference template with intent-conditional sections

### Dual Intent

- [ ] **INTNT-01**: Intent (product/engineering) declared during scope, stored in state.yml, flows through entire lifecycle
- [ ] **INTNT-02**: Product intent: PRD-style design, epics/stories plan, HANDOFF.md generation
- [ ] **INTNT-03**: Engineering intent: RFC-style design, wave-ordered tasks, technical checklists

### Telemetry

- [ ] **TELE-01**: log.yml in `.expedite/` directory, gitignored
- [ ] **TELE-02**: Append-only via `cat >>` Bash command (never Write tool rewrite)
- [ ] **TELE-03**: Multi-document YAML format (one document per event)
- [ ] **TELE-04**: Tracks phase transitions, gate outcomes, agent completions, source failures, overrides
- [ ] **TELE-05**: log.yml persists across lifecycles (not archived)

### Artifact Pipeline

- [ ] **ARTF-01**: Each phase produces Markdown artifacts in `.expedite/` subdirectories
- [ ] **ARTF-02**: Artifact paths: scope/SCOPE.md, research/SYNTHESIS.md, design/DESIGN.md, plan/PLAN.md, execute/PROGRESS.md
- [ ] **ARTF-03**: Archival flow moves completed lifecycle to `.expedite/archive/{slug}/`

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Error Recovery

- **ERR-01**: Per-skill error tables with defined recovery actions
- **ERR-02**: File write failure retry (one retry, then informative error)
- **ERR-03**: Missing prerequisite artifact detection with informative messages
- **ERR-04**: Corrupted state reconstruction from artifact existence

### SessionStart Hook

- **HOOK-01**: hooks.json + session-start.sh injects 3-5 line context summary on session start
- **HOOK-02**: Hook verified against all naming convention candidates (hook_type/script vs type/command)
- **HOOK-03**: Three-layer fallback (hook + !cat + status) with independent testing of each layer

### Cross-Lifecycle Import

- **IMPORT-01**: `/expedite:scope` detects prior HANDOFF.md/DESIGN.md artifacts
- **IMPORT-02**: Import presents options via AskUserQuestion: Import as context, Skip, Review first
- **IMPORT-03**: Extracted Key Decisions become locked constraints in downstream prompts
- **IMPORT-04**: Suggested Engineering Questions pre-populate question plan

### Advanced Features

- **ADV-01**: Extended thinking for gate evaluation (one-line frontmatter change)
- **ADV-02**: Configurable model profiles (user selects sonnet/opus/haiku per agent type)
- **ADV-03**: Numeric sufficiency scoring upgrade (0.0-1.0 scale if categorical proves too coarse)
- **ADV-04**: Dedicated verifier subagent for execute phase acceptance criteria

## Out of Scope

| Feature | Reason |
|---------|--------|
| Multi-agent design synthesis | Constraint C-8: single design agent for v1, multi-agent adds coordination complexity |
| Bundled MCP servers | Constraint C-9: reference configs only, users configure own servers |
| Custom gate criteria | Adds untested surface area; MUST/SHOULD criteria calibrated by design |
| Visual UI or dashboard | CLI-only plugin; `/expedite:status` is the status display |
| Automatic source discovery | No API to check MCP availability; optimistic invocation with circuit breaker instead |
| Self-improvement from telemetry | Passive collection only in v1; calibration requires 10+ lifecycles of data |
| AskUserQuestion for micro-interactions | 60-second timeout constraint; freeform prompt instead |
| Mobile/web UI | Single-developer CLI workflow |
| Multi-user collaboration | Single state.yml, no concurrent access support |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| FOUND-01 | Phase 1 | Pending |
| FOUND-02 | Phase 1 | Pending |
| FOUND-03 | Phase 1 | Pending |
| FOUND-04 | Phase 1 | Pending |
| FOUND-05 | Phase 1 | Pending |
| STATE-01 | Phase 2 | Pending |
| STATE-02 | Phase 2 | Pending |
| STATE-03 | Phase 2 | Pending |
| STATE-04 | Phase 2 | Pending |
| STATE-05 | Phase 2 | Pending |
| STATE-06 | Phase 2 | Pending |
| CTX-01 | Phase 2 | Pending |
| CTX-02 | Phase 2 | Pending |
| CTX-03 | Phase 2 | Pending |
| TMPL-01 | Phase 3 | Pending |
| TMPL-02 | Phase 3 | Pending |
| TMPL-03 | Phase 3 | Pending |
| TMPL-04 | Phase 3 | Pending |
| TMPL-05 | Phase 3 | Pending |
| TMPL-06 | Phase 3 | Pending |
| SCOPE-01 | Phase 4 | Pending |
| SCOPE-02 | Phase 4 | Pending |
| SCOPE-03 | Phase 4 | Pending |
| SCOPE-04 | Phase 4 | Pending |
| SCOPE-05 | Phase 4 | Pending |
| SCOPE-06 | Phase 10 | Pending |
| SCOPE-07 | Phase 4 | Pending |
| SCOPE-08 | Phase 4 | Pending |
| GATE-01 | Phase 4 | Pending |
| GATE-02 | Phase 4 | Pending |
| GATE-03 | Phase 6 | Pending |
| GATE-04 | Phase 10 | Pending |
| GATE-05 | Phase 10 | Pending |
| GATE-06 | Phase 4 | Pending |
| GATE-07 | Phase 6 | Pending |
| ARTF-01 | Phase 4 | Pending |
| ARTF-02 | Phase 4 | Pending |
| ARTF-03 | Phase 10 | Pending |
| RSCH-01 | Phase 5 | Pending |
| RSCH-02 | Phase 5 | Pending |
| RSCH-03 | Phase 5 | Pending |
| RSCH-04 | Phase 5 | Pending |
| RSCH-05 | Phase 6 | Pending |
| RSCH-06 | Phase 6 | Pending |
| RSCH-07 | Phase 6 | Pending |
| RSCH-08 | Phase 6 | Pending |
| RSCH-09 | Phase 5 | Pending |
| RSCH-10 | Phase 6 | Pending |
| RSCH-11 | Phase 6 | Pending |
| RSCH-12 | Phase 6 | Pending |
| RSCH-13 | Phase 6 | Pending |
| RSCH-14 | Phase 5 | Pending |
| DSGN-01 | Phase 7 | Pending |
| DSGN-02 | Phase 7 | Pending |
| DSGN-03 | Phase 7 | Pending |
| DSGN-04 | Phase 7 | Pending |
| DSGN-05 | Phase 7 | Pending |
| DSGN-06 | Phase 7 | Pending |
| DSGN-07 | Phase 7 | Pending |
| PLAN-01 | Phase 8 | Pending |
| PLAN-02 | Phase 8 | Pending |
| PLAN-03 | Phase 8 | Pending |
| PLAN-04 | Phase 8 | Pending |
| PLAN-05 | Phase 8 | Pending |
| EXEC-01 | Phase 9 | Pending |
| EXEC-02 | Phase 9 | Pending |
| EXEC-03 | Phase 9 | Pending |
| EXEC-04 | Phase 9 | Pending |
| EXEC-05 | Phase 9 | Pending |
| EXEC-06 | Phase 9 | Pending |
| INTNT-01 | Phase 10 | Pending |
| INTNT-02 | Phase 10 | Pending |
| INTNT-03 | Phase 10 | Pending |
| TELE-01 | Phase 10 | Pending |
| TELE-02 | Phase 10 | Pending |
| TELE-03 | Phase 10 | Pending |
| TELE-04 | Phase 10 | Pending |
| TELE-05 | Phase 10 | Pending |

**Coverage:**
- v1 requirements: 78 total
- Mapped to phases: 78
- Unmapped: 0

---
*Requirements defined: 2026-02-27*
*Last updated: 2026-02-27 after roadmap creation*
