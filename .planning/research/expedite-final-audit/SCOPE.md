# Expedite Scope: Expedite Plugin Final Audit

**Date:** 2026-03-16
**Intent:** engineering
**Lifecycle ID:** expedite-plugin-final-audit-20260316

## Project Context

Pre-use validation audit of the Expedite plugin before first real-world use. The plugin implements a research-driven development lifecycle (Scope, Research, Design, Plan, Spike, Execute) through a three-layer architecture: enforcement hooks (Node.js), orchestration skills (step-sequencer markdown), and execution agents (formalized subagents). Built across 37 phases and 5 milestones (v1.0 through v3.0). The goal is to verify runtime correctness -- will the plugin function correctly when a user runs it end-to-end on a real project? Spec divergences are secondary but documented for future reconciliation.

The plugin comprises ~2,400 lines of JavaScript across hooks, gates, and lib modules; ~1,200 lines of skill instructions across 7 skills; 9 agent definitions; 7 YAML templates; and 2 design spec documents. Six backlog items are excluded from audit scope (counter-evidence search, devil's advocate pass, forced downsides section, concurrent lifecycles, end-of-milestone audit phase, git repo prerequisite check).

## Success Criteria

- Every JS file has been read line-by-line with all bugs, dead code paths, unhandled edge cases, and logic errors cataloged
- The FSM transition table is verified complete and consistent with all skill phase-transition instructions
- Every cross-resource reference (file paths, field names, enum values) resolves correctly between all components
- Every gate script produces valid gates.yml entries consumable by the enforcement hook
- Every skill's step-sequencer logic matches the checkpoint/state contracts enforced by hooks
- Every agent's frontmatter is valid and its tool/model constraints are appropriate
- Templates produce valid YAML that passes schema validation
- The plugin is portable: copying to a new project and registering hooks will work without modification
- All spec divergences from PRODUCT-DESIGN.md are documented with impact assessment

## Decision Areas

### DA-1: Hook Script Correctness (Deep)

**Readiness criterion:** Every code path in every hook JS file has been traced, all error handling is verified (fail-open vs fail-closed matches intent), all stdin/stdout/exit-code contracts match Claude Code's hook protocol, and no unhandled exceptions can crash the hook process.

| ID | Priority | Question | Sources | Evidence Requirements |
|----|----------|----------|---------|----------------------|
| q01 | P0 | Does validate-state-write.js correctly parse stdin JSON, match state file paths, lazy-load dependencies only on the state-file path, and exit with the correct code (0 for allow, 2 for deny) in all branches? | codebase | Line-by-line trace of all 280 lines showing every branch terminates with exit(0) or deny(), no path falls through without an exit, and stdin error handling is correct |
| q02 | P0 | Do all four enforcement layers in validate-state-write.js (HOOK-01 FSM, HOOK-02 gate passage, HOOK-03 checkpoint regression, HOOK-04 gate-phase) correctly implement their validation logic without false positives or false negatives? | codebase | For each layer: identify the exact condition checked, verify it matches the design spec, confirm the denial message is accurate and actionable, and verify the denial tracker integration |
| q03 | P0 | Does audit-state-change.js (PostToolUse) correctly detect state file writes, compute diffs, and append to log.yml without corrupting existing log entries? | codebase | Line-by-line trace of all 110 lines showing: stdin parsing, state file detection, diff computation, append-only write pattern, and error handling |
| q04 | P1 | Do pre-compact-save.js and session-stop.js correctly read checkpoint state, generate session summaries, and write output files without race conditions or data loss? | codebase | Line-by-line trace of both files (67 + 57 lines) showing: state reading, summary generation, file write patterns, and error recovery |
| q05 | P1 | Does benchmark-latency.js correctly measure and report hook execution times, and does it interfere with any other hook's operation? | codebase | Line-by-line trace of all 90 lines confirming: timing mechanism, output format, no side effects on state files, and correct exit behavior |

### DA-2: Finite State Machine Validity (Deep)

**Readiness criterion:** The FSM transition table in fsm.js is proven to be (a) complete (every phase has exactly one forward transition), (b) acyclic (no loops possible), (c) gate-consistent (gate requirements match gate script existence), and (d) consistent with all skill instructions that perform phase transitions.

| ID | Priority | Question | Sources | Evidence Requirements |
|----|----------|----------|---------|----------------------|
| q06 | P0 | Is the FSM transition table in fsm.js complete and acyclic -- does every valid phase have exactly one forward transition, and is it impossible to create a cycle? | codebase | Enumeration of all 13 transitions showing linear chain from not_started to archived, with proof that no backward or lateral transitions exist |
| q07 | P0 | Do the gate requirements in the FSM (G1 through G5) exactly match the gates that exist as scripts in gates/, and do the GATE_PHASE_MAP entries in gate-checks.js align with the FSM's gate assignments? | codebase | Side-by-side comparison of fsm.js TRANSITIONS gate fields, gate-checks.js GATE_PHASE_MAP, and gates/ directory contents showing 1:1:1 correspondence |
| q08 | P0 | Does every skill that writes a phase transition to state.yml (scope Step 10, research final step, design final step, plan final step, spike final step, execute final step) use a transition that exists in the FSM table? | codebase | Extraction of every phase-transition write from all 7 skill SKILL.md files, mapped to FSM table entries, with confirmation that each proposed transition is valid |

### DA-3: Schema and Validation Layer Integrity (Deep)

**Readiness criterion:** Every schema validator (state.js, checkpoint.js, gates.js, questions.js, tasks.js) accepts all valid data shapes that skills and gates produce, rejects all invalid shapes with meaningful error messages, and the validate.js field-checking engine handles all type/enum/nullable combinations correctly.

| ID | Priority | Question | Sources | Evidence Requirements |
|----|----------|----------|---------|----------------------|
| q09 | P0 | Does validate.js's validateFields function correctly handle all field specification types (type checking, nullable fields, enum validation, required fields, unknown fields) without false acceptances or false rejections? | codebase | Line-by-line trace of validate.js (88 lines) with test cases for each combination: required present/absent, nullable with null/value/missing, enum valid/invalid, type match/mismatch |
| q10 | P0 | Does each schema file (state.js, checkpoint.js, gates.js, questions.js, tasks.js) define field constraints that exactly match what skills and gates actually write to those files? | codebase | For each schema: extract all field definitions, then cross-reference against every write to that file type across all skills and gates, confirming no field is missing from the schema and no schema constraint rejects valid data |
| q11 | P1 | Does state-schema.js correctly route validation to the appropriate schema module, and are all 5 validator function names correctly mapped in STATE_FILES within validate-state-write.js? | codebase | Trace the dispatch chain: STATE_FILES map in validate-state-write.js -> state-schema.js routing -> individual schema modules, confirming all 5 entries resolve to working validator functions |

### DA-4: Gate Script Logic (Deep)

**Readiness criterion:** Every gate script (g1 through g5) correctly reads its input artifacts, evaluates all MUST/SHOULD criteria, writes valid gates.yml entries, and prints parseable JSON to stdout; gate-utils.js shared functions behave correctly across all 5 consumers.

| ID | Priority | Question | Sources | Evidence Requirements |
|----|----------|----------|---------|----------------------|
| q12 | P0 | Does each structural gate script (g1-scope.js, g2-structural.js, g4-plan.js) correctly read its upstream artifacts (SCOPE.md, evidence files, PLAN.md), evaluate all MUST and SHOULD criteria, compute the correct outcome (go/go_advisory/hold), write a valid gates.yml entry, and print parseable JSON to stdout? | codebase | Line-by-line trace of all 3 structural gates (~1,030 lines total) showing: artifact reading, each criterion evaluation, outcome computation logic, gates.yml write format, and stdout JSON format |
| q13 | P0 | Do the semantic gate scripts (g3-design.js, g5-spike.js) correctly implement the dual-layer pattern -- running structural checks AND dispatching the gate-verifier agent -- and correctly merge both layers' results into a single outcome? | codebase | Line-by-line trace of both semantic gates (~776 lines total) showing: structural check implementation, agent dispatch mechanism, result merging logic, and how structural-pass + semantic-fail or structural-fail + semantic-pass are handled |
| q14 | P1 | Does gate-utils.js provide correct shared utility functions, and do all 5 gate scripts use them consistently without any gate having a local reimplementation that diverges from the shared version? | codebase | Enumeration of all exported functions from gate-utils.js (199 lines), mapped to usage across all 5 gate scripts, confirming consistent invocation patterns and no divergent local copies |

### DA-5: Skill Step-Sequencer and Checkpoint Integrity (Standard)

**Readiness criterion:** Every skill's step sequence is internally consistent (no missing steps, no unreachable steps), all checkpoint writes match the checkpoint schema, all state writes use the backup-before-write pattern, and resume logic correctly restores from any checkpoint.

| ID | Priority | Question | Sources | Evidence Requirements |
|----|----------|----------|---------|----------------------|
| q15 | P0 | Does each skill's step-sequencer logic (scope 10 steps, research N steps, design N steps, plan N steps, spike N steps, execute N steps, status N steps) have a complete, gap-free step sequence where every step is reachable from the resume logic and no step is skipped or orphaned? | codebase | For each of the 7 skills: extract step numbers, verify sequential ordering, trace the resume preamble's routing to confirm every step is reachable, and verify the "proceed to next step automatically" instruction flow |
| q16 | P0 | Do all skills' checkpoint writes produce YAML that passes the checkpoint schema validator, and do all checkpoint fields (skill, step, label, substep, continuation_notes, inputs_hash, updated_at) contain values of the correct type? | codebase | Extraction of every checkpoint write pattern across all 7 skills, validated against checkpoint.js schema requirements, confirming type correctness for each field |
| q17 | P1 | Do all skills correctly implement the backup-before-write pattern for state.yml (read, cp to .bak, modify in-memory, write), and is there any skill that writes state.yml without creating the backup? | codebase | Search for all state.yml write instructions across all 7 skill SKILL.md files, confirming each includes the backup step or explicitly documents why it is skipped |

### DA-6: Agent Definition Correctness (Standard)

**Readiness criterion:** Every agent's frontmatter is structurally valid per Claude Code's agent specification, model assignments match the design spec's tiering (Opus for synthesis/verification, Sonnet for workers), tool restrictions prevent unauthorized operations, and prompt instructions are internally consistent.

| ID | Priority | Question | Sources | Evidence Requirements |
|----|----------|----------|---------|----------------------|
| q18 | P0 | Does every agent's frontmatter (name, description, model, tools/disallowedTools, maxTurns, memory, isolation) use valid Claude Code agent schema fields, and are there any unsupported or misspelled fields that would be silently ignored? | codebase | Extraction of all 9 agents' frontmatter fields, cross-referenced against Claude Code's agent specification, confirming all fields are recognized |
| q19 | P1 | Does model tiering across all 9 agents match the design spec's decision (Opus for synthesis/verification: research-synthesizer, gate-verifier, design-architect; Sonnet for all others), and is maxTurns appropriately sized for each agent's workload? | codebase | Table mapping each agent to its assigned model and maxTurns, compared against PRODUCT-DESIGN.md Decision #13, with assessment of whether any agent's turn budget is too low for its task |
| q20 | P1 | Does every agent that should NOT enter worktrees have EnterWorktree in its disallowedTools, and does the task-implementer agent correctly specify isolation: worktree? | codebase | Extraction of all agents' tool restrictions, confirming EnterWorktree is blocked for all non-execute agents (Decision #25) and task-implementer has worktree isolation |

### DA-7: Cross-Resource Reference Integrity (Deep)

**Readiness criterion:** Every file path, field name, enum value, and artifact name referenced by one component resolves correctly when consumed by another. No dangling references, no mismatched field names, no enum values that one component writes but another does not recognize.

| ID | Priority | Question | Sources | Evidence Requirements |
|----|----------|----------|---------|----------------------|
| q21 | P0 | Do all Glob patterns in skill SKILL.md files (e.g., `**/templates/state.yml.template`, `**/prompt-scope-questioning.md`, `**/ref-state-recovery.md`) resolve to files that actually exist in the plugin directory structure? | codebase | Enumeration of every Glob pattern across all 7 skills, mapped to actual file paths in the repository, confirming each pattern has at least one match |
| q22 | P0 | Do all field names that skills write to state files (state.yml, checkpoint.yml, questions.yml, gates.yml, tasks.yml) match the field names expected by the corresponding schema validators, and do all enum values (phase names, priority levels, status values, outcome values) used in skills match the enum constraints in schemas? | codebase | Cross-reference matrix: fields/enums written by each skill vs. fields/enums validated by each schema, with any mismatches flagged |
| q23 | P0 | Do the gate scripts' stdout JSON output formats match what the skills expect when they parse gate results, and do the gates.yml entries written by gate scripts match what the enforcement hook reads during gate passage checks? | codebase | Extraction of gate script output format (JSON to stdout + gates.yml write), compared against skill parsing logic (e.g., scope Step 10's "Parse the JSON stdout") and hook passage checking logic (gate-checks.js checkGatePassage) |
| q24 | P1 | Do all agent dispatch instructions in skills (SendMessage to agent names) use agent names that match the `name` field in agent frontmatter, and do all context variables passed to agents (e.g., {{project_name}}) have values available at dispatch time? | codebase | Mapping of every agent dispatch in all skills to the corresponding agent file's name field, plus verification that context variables referenced in agent prompts are populated by the dispatching skill |

### DA-8: Template-Schema Consistency (Standard)

**Readiness criterion:** Every template produces YAML that, when written to .expedite/, passes its corresponding schema validator without modification. Default values in templates are valid according to schema constraints.

| ID | Priority | Question | Sources | Evidence Requirements |
|----|----------|----------|---------|----------------------|
| q25 | P0 | Does each of the 7 templates (state.yml.template, checkpoint.yml.template, questions.yml.template, gates.yml.template, tasks.yml.template, sources.yml.template, gitignore.template) produce output that passes its corresponding schema validator when written as-is, and are default/null values acceptable to the validators? | codebase | For each template with a corresponding schema: parse the template as YAML, run it through the schema validator function, confirm it passes. For templates without schemas (sources, gitignore): confirm no validator exists and none is needed |

### DA-9: Hook Registration and Event Wiring (Standard)

**Readiness criterion:** The hook registration in .claude/settings.json correctly maps each hook event to its handler script, all script paths resolve from the project root, and the matcher patterns capture the correct tool calls without over- or under-matching.

| ID | Priority | Question | Sources | Evidence Requirements |
|----|----------|----------|---------|----------------------|
| q26 | P0 | Does .claude/settings.json register all 4 hook events (PreToolUse, PostToolUse, PreCompact, Stop) with correct script paths that resolve when the plugin is copied to a target project, and do the Write matchers on PreToolUse and PostToolUse correctly scope to the Write tool without matching other tools? | codebase | Extraction of all hook registrations from settings.json, verification that each `command` path resolves to an existing JS file, and confirmation that matcher patterns are correct per Claude Code hook specification |
| q27 | P1 | Is the benchmark-latency.js hook registered in settings.json, and if not, is this intentional? Does the plugin.json manifest correctly describe the plugin without missing or extraneous fields? | codebase | Check benchmark-latency.js registration status, check plugin.json against Claude Code plugin manifest spec, flag any missing fields |

### DA-10: Portability Validation (Standard)

**Readiness criterion:** The plugin can be copied to a fresh project directory and function correctly: all relative paths resolve, node_modules dependencies are present, no hardcoded absolute paths exist, and the initialization sequence (scope Step 3) creates all required directories and files.

| ID | Priority | Question | Sources | Evidence Requirements |
|----|----------|----------|---------|----------------------|
| q28 | P0 | Are there any hardcoded absolute paths, project-specific references, or environment assumptions in any JS file, skill, agent, or template that would break when the plugin is copied to a different project directory? | codebase | Grep for absolute path patterns (/Users/, /home/, hardcoded project names) across all plugin files, plus review of all relative path constructions to confirm they resolve from the expected working directory |
| q29 | P1 | Does the plugin's node_modules directory (hooks/node_modules/js-yaml) contain all required dependencies, and will `require('js-yaml')` resolve correctly when hooks run from a target project's working directory? | codebase | Verify the js-yaml dependency tree is self-contained in hooks/node_modules/, confirm no peer dependencies or native modules that require platform-specific compilation |
| q30 | P1 | Does the scope skill's initialization sequence (Step 3) correctly create all required directories and files from templates, and does it handle the case where some but not all initialization artifacts already exist? | codebase | Trace scope SKILL.md Step 3 instructions: verify mkdir, template glob/read/write for each artifact, and conditional existence checks |

### DA-11: Design Spec Divergence Documentation (Light)

**Readiness criterion:** Every intentional or accidental divergence between the implemented code and the two PRODUCT-DESIGN.md specs is documented with: what diverged, whether it matters for runtime correctness, and whether it needs reconciliation.

| ID | Priority | Question | Sources | Evidence Requirements |
|----|----------|----------|---------|----------------------|
| q31 | P1 | What are all divergences between the implemented hook architecture (settings.json registration, hook scripts, lib modules) and the Hook Architecture section of the agent-harness PRODUCT-DESIGN.md? | codebase | Side-by-side comparison of PRODUCT-DESIGN.md hook spec (registry, validation steps, error messaging, override mechanism, latency budget) against the actual implementation, with each divergence categorized as intentional-improvement, implementation-detail, or potential-bug |
| q32 | P1 | What are all divergences between the implemented state management (5 YAML files, schemas, templates) and the State Management Architecture section of the PRODUCT-DESIGN.md? | codebase | Comparison of PRODUCT-DESIGN.md state schema definitions against actual template files and schema validators, noting field additions/removals/renames and their impact |
| q33 | P2 | What are all divergences between the implemented agent definitions (9 agents) and the Agent Formalization section of the PRODUCT-DESIGN.md, including any agents that exist in the spec but not in code (or vice versa)? | codebase | Enumeration of spec-defined agents vs. implemented agents, with divergences in model assignment, tool restrictions, memory settings, and any spec agents not implemented or implemented agents not in spec |

### DA-12: Error Recovery & Resilience (Deep)

**Readiness criterion:** Every failure mode (corrupted state YAML, partial writes, interrupted sessions, missing artifacts, override scenarios) has been traced through the recovery paths documented in ref-state-recovery.md and the override protocol, confirming the plugin degrades gracefully and can be recovered without manual YAML editing.

| ID | Priority | Question | Sources | Evidence Requirements |
|----|----------|----------|---------|----------------------|
| q34 | P0 | When state.yml becomes corrupted (invalid YAML, missing required fields, unknown phase value), does the validate-state-write.js hook detect and deny the corruption, and does the state recovery procedure (ref-state-recovery.md) provide a working path to restore from the .bak file? | codebase | Trace the corruption detection path in validate-state-write.js, confirm .bak file creation timing (before every write), and verify ref-state-recovery.md instructions are mechanically correct |
| q35 | P0 | When a session is interrupted mid-skill (e.g., context window exhaustion, user abort), does the checkpoint contain enough information to resume correctly? Are there any skills where a mid-step interruption would leave state files in an inconsistent state with no recovery path? | codebase | For each skill: identify the critical write sequence (checkpoint write vs. state write vs. artifact write ordering), find any window where interruption between two writes would leave the system in a state the resume logic can't handle |
| q36 | P1 | Does the override protocol (ref-override-protocol.md) correctly bypass FSM enforcement when invoked, and does the audit trail in audit-state-change.js capture override events distinctly from normal transitions? | codebase | Trace the --override flag path through validate-state-write.js, confirm it skips FSM checks while still applying schema validation, and verify audit-state-change.js logs override-specific metadata |
| q37 | P1 | When gate scripts fail (missing artifacts, malformed input, runtime errors), do they fail-open or fail-closed, and is this behavior consistent with the design intent? Do gate script crashes prevent the lifecycle from proceeding? | codebase | For each gate script: identify all error/catch paths, determine the exit code on failure, and confirm whether the enforcement hook treats a crashed gate as "gate not passed" or ignores it |

### DA-13: Skill Instruction Clarity & Ambiguity (Standard)

**Readiness criterion:** Each SKILL.md has been reviewed for instructions that are ambiguous, contradictory, or dependent on assumptions Claude may not hold — with all ambiguities cataloged and assessed for whether they'd cause incorrect behavior versus merely suboptimal behavior.

| ID | Priority | Question | Sources | Evidence Requirements |
|----|----------|----------|---------|----------------------|
| q38 | P0 | Are there any steps in any skill where the instructions are ambiguous enough that Claude could reasonably interpret them in two different ways, where one interpretation would produce incorrect state writes, corrupt artifacts, or skip required validations? | codebase | For each of the 7 skills: read every step instruction, flag any instruction where the action (what to write, where to write, what to validate) is not explicitly specified, and assess whether the ambiguity could cause a state-corrupting misinterpretation |
| q39 | P1 | Do skill instructions correctly reference the shared protocols (ref-override-protocol.md, ref-state-recovery.md) at the right points, and are there any recovery scenarios that a skill should handle but doesn't mention? | codebase | Cross-reference each skill's error handling instructions against the recovery procedures in shared/, confirming skills reference recovery when they should and don't reference it where it's irrelevant |
| q40 | P1 | Are agent dispatch instructions in skills specific enough that Claude will pass the right context? Do any skills assume Claude "knows" something (e.g., current project name, lifecycle ID) that isn't explicitly stated in the step instructions? | codebase | For each agent dispatch: verify the skill explicitly states what context to pass (not just "pass relevant context"), and flag any dispatch where required agent inputs are not sourced from an explicit instruction |

### DA-14: Lifecycle Flow Logical Coherence (Standard)

**Readiness criterion:** The full lifecycle sequence (scope → research → design → plan → spike → execute) is logically sound: each phase's outputs are sufficient inputs for the next phase, no phase depends on information not yet produced, gates validate the right things at the right boundaries, and the overall flow produces a coherent arc from user intent to working code.

| ID | Priority | Question | Sources | Evidence Requirements |
|----|----------|----------|---------|----------------------|
| q41 | P0 | Does each phase's gate validate properties that genuinely indicate readiness for the next phase, or are any gates checking the wrong things? Specifically: does G1 (scope) ensure research has enough to work with, does G2 (research) ensure design has enough evidence, does G3 (design) ensure planning can decompose it, does G4 (plan) ensure spikes are well-scoped, does G5 (spike) ensure execution has clear tasks? | codebase | For each gate: extract the validation criteria, compare against the next phase's input requirements (what the next skill's Step 1 reads/expects), and flag any mismatch where the gate checks something the next phase doesn't need or fails to check something the next phase requires |
| q42 | P0 | Are there any information gaps in the lifecycle chain where Phase N+1 needs data that Phase N doesn't produce? For example: does the design skill assume research produced specific artifact formats? Does the plan skill assume design contains specific sections? | codebase | For each phase transition: extract the output artifacts of Phase N and the input expectations of Phase N+1, map them 1:1, and flag any expected input that has no corresponding output |
| q43 | P1 | Is the lifecycle ordering itself logical? Could any phases be reordered, and are there implicit assumptions about why scope must precede research, research must precede design, etc.? Are the "skip" paths (e.g., skipping spike when no TDs exist) correctly implemented? | codebase | Trace any skip/shortcut paths mentioned in skills or FSM, confirm the FSM supports them, and verify that skipped phases don't leave required artifacts missing for downstream phases |

## Concerns Addressed

- **Architecture:** DA-2 (FSM validity), DA-7 (cross-resource references), DA-9 (hook registration/wiring), DA-14 (lifecycle coherence)
- **Implementation:** DA-1 (hook script correctness), DA-3 (schema/validation), DA-4 (gate scripts), DA-5 (skill sequencers), DA-6 (agent definitions)
- **Resilience:** DA-12 (error recovery), DA-13 (instruction clarity)
- **Performance:** DA-1/q05 (benchmark latency hook), DA-4/q14 (gate-utils shared functions)
- **Migration/Integration:** DA-8 (template-schema consistency), DA-10 (portability), DA-11 (spec divergence)

## Source Configuration

- [x] Codebase (Grep, Read, Glob, Bash) -- primary source for all audit dimensions
- [ ] Web -- not needed for this audit
- [ ] MCP -- not configured

## Metadata

- **Question count:** 43
- **Decision area count:** 14
- **Estimated research batches:** 14 (one per DA, all codebase-sourced, parallelizable by DA)
