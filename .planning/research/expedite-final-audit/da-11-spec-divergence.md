# DA-11: Design Spec Divergence Documentation

## Summary

43 divergences identified between implemented code and PRODUCT-DESIGN.md spec: **5 potential-bug**, 15 implementation-detail, 23 intentional-improvement.

Primary spec: `.planning/research/agent-harness-architecture/design/PRODUCT-DESIGN.md`

## q31: Hook Architecture Divergences

| # | Area | Spec | Implementation | Category |
|---|------|------|---------------|----------|
| H1 | Hook registry location | `hooks/hooks.json` within plugin | `.claude/settings.json` (project settings) | intentional-improvement |
| H2 | PostToolUse hook name | `audit-override.js` | `audit-state-change.js` — audits ALL state writes | intentional-improvement |
| H3 | PostToolUse scope | Audit gate overrides only | Audit ALL `.expedite/*.yml` writes | intentional-improvement |
| H4 | Hook file count | 4 hooks | 5 files (4 registered + benchmark-latency.js) | implementation-detail |
| H5 | Denial message content | "Run /expedite:gate" | Full override protocol + EXPEDITE_HOOKS_DISABLED bypass | intentional-improvement |
| H6 | Hook file path | `.claude-plugin/hooks/` | Top-level `hooks/` | implementation-detail |
| H7 | Denial escalation | Not mentioned | denial-tracker.js with ESCALATION_THRESHOLD=3 | intentional-improvement |
| H8 | state.yml required fields | project_name, lifecycle_id, phase, version all required | Only version and phase required; others nullable | **potential-bug** |
| H9 | checkpoint.yml step | Positive integer or "complete" | Also allows null (for template init) | intentional-improvement |
| H11 | gates.yml outcome enum | 4 values | 8 values: adds go_advisory, recycle, override, hold | intentional-improvement |
| H12 | gates.yml required fields | gate, timestamp, outcome, evaluator | evaluator optional; adds must/should counts | intentional-improvement |
| H13 | Override severity field | Required on override entries | Not in schema; audit hook extracts via regex | **potential-bug** |
| H14 | Gate passage outcomes | go, go-with-advisory, overridden | Also includes go_advisory (underscore variant) | intentional-improvement |
| H15 | Gate-phase validation | Wrong phase blocked | Allows both _in_progress and _complete | intentional-improvement |
| H16 | Gate history immutability | "Immutable once written" | Only new entries validated; existing can be altered | **potential-bug** |
| H17 | FSM terminal state | Ends at execute_complete | Adds execute_complete→complete→archived | intentional-improvement |
| H19 | Same-phase writes | Not discussed | Explicitly allowed | intentional-improvement |
| H20 | Emergency bypass values | EXPEDITE_HOOKS_DISABLED=true | Also accepts '1' | implementation-detail |

## q32: State Management Divergences

| # | Area | Spec | Implementation | Category |
|---|------|------|---------------|----------|
| S1 | File inventory | 7 files + evidence/ dir | Adds sources.yml and gitignore | implementation-detail |
| S3 | state.yml fields | version, lifecycle_id, project_name, phase, started_at, phase_started_at | Adds last_modified, intent, description | intentional-improvement |
| S4 | state.yml version | version: 1 | version: 2 (reflects five-file split) | implementation-detail |
| S5 | Phase enum | 12 phases | 16 phases: adds complete, archived | intentional-improvement |
| S6 | checkpoint.yml required | skill, step, label always required | requiredWhenPopulated: required only when any is non-null | intentional-improvement |
| S8 | questions.yml schema | id, text, category, status, priority, depth | id, text, priority, decision_area, evidence_requirements, status (5 values), source, gap_details, evidence_files | intentional-improvement |
| S9 | questions.yml top-level | No research_round | Adds research_round: 0 | implementation-detail |
| S10 | gates.yml entry schema | 4 outcome values | 8 outcome values; adds must/should counts | intentional-improvement |
| S11 | Semantic eval field name | semantic_evaluation | semantic_scores | implementation-detail |
| S12 | tasks.yml schema | status 4 values, phase field | status adds skipped/failed/partial; phase→wave; adds current_wave/current_task | intentional-improvement |
| S13 | Session summary | Includes "what was accomplished" | Cannot include — Stop hook lacks session history | implementation-detail |
| S15 | sources.yml | Not in spec | templates/sources.yml.template with web/codebase config | implementation-detail |

## q33: Agent Definition Divergences

| # | Area | Spec | Implementation | Category |
|---|------|------|---------------|----------|
| A1 | Agent count | 8 core + 2 optional | 9 agents: 8 core + sufficiency-evaluator. No scope-facilitator or research-planner. | intentional-improvement |
| A4 | Memory settings | memory: project for research-synthesizer and gate-verifier only | Also adds memory: project to sufficiency-evaluator | **potential-bug** |
| A5 | maxTurns | Not specified per agent | Set per agent: 20-50 | implementation-detail |
| A6 | permissionMode | "MUST remain default" | Not explicitly set (defaults to default) | implementation-detail |
| A7 | Gate evaluation location | hooks/lib/gate-checks.js | Standalone scripts in gates/ directory | intentional-improvement |
| A8 | G1 question source | "questions.yml exists with at least 3 questions" | G1 reads questions from state.yml, not questions.yml | **potential-bug** |
| A9 | G4 task count | "Total tasks at least 5" (structural) | Implemented as SHOULD (advisory, not blocking) | implementation-detail |

Model assignments and tool restrictions for all 8 spec-defined agents match exactly.

## Critical Divergences (potential-bug) — Detailed Analysis

### PB-1: state.yml required fields relaxed (H8)
**Risk: Low.** Implementation is correct for actual workflow — scope skill initializes state before collecting project_name. Spec is wrong.
**Recommendation:** Update spec only. No code change needed.

### PB-2: gates.yml severity not schema-validated (H13)
**Risk: Low.** Override mechanism works without it. Severity is cosmetic for audit trail.
**Recommendation:** Add `severity: { type: 'string', nullable: true, enum: ['low', 'medium', 'high'] }` to gates.yml schema.

### PB-3: gates.yml history immutability not enforced (H16)
**Risk: Medium.** An LLM rewriting gates.yml could silently change a previous gate result from `no-go` to `go`, bypassing gate enforcement. The hook validates only NEW entries (index >= existingCount). Entries 0 through existingCount-1 in the proposed write are not compared against the current file.
**Recommendation:** Add hash-based existing-entry comparison before the new-entry validation loop.

### PB-4: sufficiency-evaluator has undocumented persistent memory (A4)
**Risk: Low.** Same evaluation pattern as gate-verifier. But runs earlier in pipeline — stale patterns could cause systematic under/over-rating.
**Recommendation:** Remove `memory: project` or document the decision and add experimental criteria.

### PB-5: G1 reads questions from state.yml, not questions.yml (A8)
**Risk: Medium.** If scope skill writes questions only to questions.yml (per five-file split), `state.questions` is always undefined and G1's M2 (`questions.length >= 3`) always fails. Gate never passes without override. If scope duplicates questions into state.yml for compatibility, the five-file split is incomplete.
**Recommendation:** Fix G1 to read from questions.yml. Remove any state.yml question writes from scope skill.

## Reconciliation Recommendations

### Priority 1 — Fix before next lifecycle
1. **PB-5:** Fix `gates/g1-scope.js` to read from `questions.yml`
2. **PB-3:** Add hash-based existing-entry comparison in gates.yml validation

### Priority 2 — Fix during next maintenance pass
3. **PB-2:** Add severity to gates.yml schema as optional
4. **PB-4:** Remove `memory: project` from sufficiency-evaluator or document

### Priority 3 — Spec updates only
5. **PB-1:** Update spec state.yml schema: project_name/lifecycle_id optional
6. **H17:** Add complete/archived to spec FSM
7. **S8:** Update spec questions.yml schema
8. **A1:** Add sufficiency-evaluator to spec agent catalog
9. **A7:** Document gates/ directory structure
