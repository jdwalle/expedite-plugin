# DA-6: Agent Definition Correctness

## Summary

Audited all 9 agent definitions in `/agents/` against the Claude Code subagent schema and the design spec (`PRODUCT-DESIGN.md`). The agent definitions are structurally sound. All frontmatter fields are valid, model tiering matches the spec for all 8 cataloged agents, and tool restrictions are correctly configured. Three issues found.

## q18: Frontmatter Validity — PASS

All 9 agents use only recognized Claude Code agent schema fields (name, description, model, tools, disallowedTools, maxTurns, memory, isolation). No misspelled or unsupported fields exist. One omission: `permissionMode` is absent from all agents but defaults correctly to `default`.

## q19: Model Tiering — PASS with advisory

| Agent | Model | Spec Match | maxTurns | Assessment |
|-------|-------|------------|----------|------------|
| research-synthesizer | opus | Yes | — | OK |
| design-architect | opus | Yes | — | OK |
| gate-verifier | opus | Yes | 20 | Possibly too low (see BUG-1) |
| web-researcher | sonnet | Yes | — | OK |
| codebase-researcher | sonnet | Yes | — | OK |
| plan-decomposer | sonnet | Yes | — | OK |
| spike-researcher | sonnet | Yes | — | OK |
| task-implementer | sonnet | Yes | — | OK |
| sufficiency-evaluator | sonnet | N/A (not in spec) | — | See DIVERGENCE-2 |

- **gate-verifier maxTurns: 20** is the tightest budget and may be insufficient for complex artifacts (the spec itself acknowledges this risk)

## q20: Tool Restrictions — PASS

- All 8 non-execute agents block `EnterWorktree` (7 via disallowedTools, 1 via tools allowlist)
- task-implementer correctly has `isolation: worktree` and does NOT block `EnterWorktree`
- All tool restriction lists match the design spec exactly for all 8 cataloged agents

## Bugs Found

| # | Severity | Location | Description |
|---|----------|----------|-------------|
| BUG-1 | Low-Medium | gate-verifier agent | maxTurns of 20 may be too low — has the most complex workload (read 3-5 files, evaluate 4 dimensions, produce YAML) but the lowest turn budget |
| BUG-2 | Borderline | sufficiency-evaluator agent | Has `memory: project` without spec basis — spec limits memory to research-synthesizer and gate-verifier only. Memory could introduce bias in an agent with anti-bias instructions |

## Spec Divergences Found

| # | Severity | Description |
|---|----------|-------------|
| DIVERGENCE-1 | Low | `permissionMode` absent from all 9 agents despite spec saying "MUST remain `default`" — functionally correct since platform default is `default`, but spec intended explicit declaration |
| DIVERGENCE-2 | Medium | sufficiency-evaluator is not in the design spec's 8-agent catalog — added during implementation without spec update, causing unreviewed `memory: project` assignment |
| DIVERGENCE-3 | None | design-architect correctly omits memory/isolation fields (matching spec's "none" values) — listed for completeness only |
