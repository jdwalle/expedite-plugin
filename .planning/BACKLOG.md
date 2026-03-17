# Backlog: Expedite Plugin

Future improvements not yet assigned to a milestone or phase.

## Research Quality

- [ ] **Counter-evidence search**: Add forced counter-searches to the research skill. For each key finding, require the agent to also search for limitations, alternatives, and contradicting evidence. Surfaces the "yeah but..." evidence that confirmation bias skips. Low effort — prompt change in research skill instructions, one extra search query per finding.
- [ ] **Devil's advocate pass**: After synthesis, run a second agent that reviews conclusions with the prompt "What would someone who disagrees argue? What evidence was likely ignored?" Output appended as counterpoint section. Medium effort — new agent or sufficiency evaluator enhancement.
- [ ] **Forced downsides section**: Require at least one risks/downsides subsection per DA in synthesis. If the agent can't find downsides, flag it for human review.

## Multi-Project Support

- [ ] **Concurrent lifecycles**: Support multiple ongoing projects within a single `.expedite/` directory. Currently the plugin is single-lifecycle-at-a-time — starting a new project requires archiving the old one. Improvement: namespace artifacts by project (e.g., `.expedite/projects/{project-name}/`) with state.yml, gates.yml, etc. scoped per project. Skills would accept a project selector or default to the most recent. Relates to deferred MLTU-01.

## Milestone Validation

- [ ] **End-of-milestone audit phase**: Add a dedicated validation phase at the end of each milestone that runs end-to-end integration checks across all phases in that milestone. Currently relies on the GSD `/gsd:audit-milestone` workflow — a formal expedite phase would make this part of the roadmap with defined success criteria, plans, and artifact output (integration test results, cross-phase dependency validation, regression checks).

## Execute Safety

- [ ] **Git repo prerequisite check**: Execute skill Step 1 should fail fast with a clear message ("Expedite execute requires a git repository. Initialize one with `git init`.") if the project is not inside a git work tree. Worktree isolation and auto-commits are git primitives with no graceful degradation path. A `git rev-parse --is-inside-work-tree` guard in the prerequisite check is sufficient.
