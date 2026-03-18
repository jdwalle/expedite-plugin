# DA-12: Error Recovery & Resilience

## Summary

The plugin has a multi-layered error recovery architecture: PreToolUse validation hooks, backup-before-write patterns (instructional only), artifact-based state recovery, and gate override protocols. **6 bugs** and **2 unrecoverable scenarios** found. Key findings: .bak files are not mechanically enforced, gate scripts bypass the PreToolUse hook when writing gates.yml, and the execute skill's worktree branch name is not persisted.

## q34: Corruption Detection and Recovery

### What IS Detected
- Syntactically invalid YAML (parse errors)
- Missing required fields (version, phase for state.yml; history for gates.yml; etc.)
- Invalid field types and enum values
- Illegal FSM transitions
- Step regression in checkpoint.yml (HOOK-03)

### What IS NOT Detected
- Semantically valid but factually wrong data (e.g., project_name changed to wrong value)
- Field values valid per schema but inconsistent with artifacts on disk
- Corruption that produces valid YAML with correct types/enums

### .bak File Creation — NOT Mechanically Enforced

The backup-before-write pattern (`cp .expedite/state.yml .expedite/state.yml.bak`) is **instructional only** — it appears in every skill's step tracking section but no hook or automated process creates the .bak file. If the LLM skips the `cp` command, no backup exists.

Critically, the recovery procedure (`ref-state-recovery.md`) does **not use .bak files** — it relies on artifact scanning (PLAN.md > DESIGN.md > SYNTHESIS.md > SCOPE.md in reverse lifecycle order). The .bak file is a documented safety mechanism that may not exist when needed and is not part of the actual recovery path.

### Recovery Procedure — Mechanically Correct

The ref-state-recovery.md procedure is verified correct:
1. Triggered when `cat .expedite/state.yml` returns "No active lifecycle"
2. Artifact scan in reverse lifecycle order — first valid match wins
3. Content validation checks expected headers per artifact type
4. Always infers `_complete` phases (never `_in_progress`)
5. Reconstructs all 5 state files (state.yml, checkpoint.yml, questions.yml, gates.yml, tasks.yml)
6. Unrecoverable case correctly handled: "No recovery source found → /expedite:scope"

## q35: Interrupted Session Recovery

### Per-Skill Vulnerability Windows

| Skill | Highest-Risk Step | Severity | Recoverable? |
|-------|-------------------|----------|-------------|
| Scope | Step 9 (write artifacts) | Low | Yes — re-extract from SCOPE.md |
| Research | Step 5 (agent dispatch) | Medium | Yes — gap-fill handles missing evidence |
| Research | Step 15 (G2 dual-layer gate) | Low | Yes — re-run gate, duplicate entry harmless |
| Design | Step 4 (agent dispatch) | Low | Yes — artifact fallback |
| Plan | Step 4 (agent dispatch) | Low | Yes — artifact fallback |
| Spike | Step 5 (resolve TDs) | Low | Yes — spike re-runs from argument (loses user choices) |
| Execute | Step 5b (post-agent, pre-merge) | **Medium** | **Partial** — worktree branch orphaned (see U2) |
| Execute | Step 5d-5e (state vs PROGRESS.md) | Medium | Mostly — risk of duplicate task execution |

### Execute Step 5 — Highest Risk

The per-task write sequence: agent dispatch (5b) → verification (5c) → git commit (5c-git) → state update (5d) → PROGRESS.md append (5e) → micro-interaction (5f).

**Window 1 (post-agent, pre-merge):** Agent completed in worktree but merge hasn't run. Worktree branch name not stored in any state file. On resume, new agent dispatch creates NEW branch; original is orphaned.

**Window 2 (post-merge, pre-state-update):** Source files changed but state not updated. On resume, task appears not started — re-dispatch could produce duplicates for additive tasks.

**Window 3 (post-state-update, pre-PROGRESS.md):** State says complete but PROGRESS.md doesn't record it. If checkpoint lost and fallback to PROGRESS.md reconstruction, task appears incomplete.

### Session Interruption Safety Mechanisms
- **PreCompact hook**: Backs up checkpoint.yml to .pre-compact, writes session-summary.md
- **Stop hook**: Writes session-summary.md with phase/skill/step/next-action
- **Artifact-based resume fallback**: Every skill has both checkpoint-based (primary) and artifact-based heuristic (secondary) resume
- **Gate idempotency**: Re-running gates appends new entry; checkGatePassage uses last entry

## q36: Override Protocol

### Override Flow — Mechanically Correct

The override mechanism works entirely through gates.yml records, not through a hook flag:

1. Gate denies phase transition (missing gate passage)
2. Denial message includes override record format
3. User/skill writes override entry: `{gate: "G1", outcome: "overridden", override_reason: "..."}`
4. Hook validates override entry: schema passes, OVRD-03 bypasses gate-phase validation for `outcome === 'overridden'`
5. Retry original state write — hook checks gate passage, finds `"overridden"` in PASSING_OUTCOMES, allows

### What Override Does NOT Bypass
- YAML parse validation — still runs
- Schema validation — still runs
- FSM transition validation — still runs
- Checkpoint regression (HOOK-03) — unaffected

### Audit Trail — Correctly Distinguished

Override events use `event: override_write` (vs `event: state_write` for normal writes) with additional metadata: gate ID, override_reason, severity, current_phase.

### --override Entry Path Issues

The `--override` entry path (e.g., `/expedite:design --override` from `research_in_progress`) has multiple issues:
- Writes invalid gate IDs (`"G2-design-entry"`) — blocked by schema (see DA-07 B2)
- Uses `outcome: "override"` instead of `"overridden"` — not in PASSING_OUTCOMES
- Attempts FSM-invalid transitions (e.g., `research_in_progress → design_in_progress`) without intermediate step

## q37: Gate Failure Behavior

### Fail-Closed vs Fail-Open Summary

| Component | Behavior | Rationale |
|-----------|----------|-----------|
| Gate scripts (missing artifacts) | **Fail-closed** | MUST criteria fail → hold/recycle |
| Gate scripts (unhandled exceptions) | **Fail-closed** | Node crashes with exit 1, no JSON output |
| validate-state-write.js (unexpected errors) | **Fail-open** | Broken hook should not permanently block all writes |
| validate-state-write.js (stdin errors) | **Fail-open** | Same rationale |
| Gate-phase validation (state.yml unreadable) | **Fail-open** | May not exist in new lifecycle |

This design is consistent and well-reasoned: enforcement hooks fail-open (avoid bricking the system), gate evaluations fail-closed (prevent quality bypass).

### Gate Script Error Handling

- **No try/catch around main()** in any of the 5 gate scripts
- **File read errors handled**: gate-utils readFile/readYaml have try/catch returning null
- **File write errors NOT handled**: appendGateResult uses fs.writeFileSync without try/catch
- **YAML parse errors in appendGateResult handled**: malformed gates.yml starts fresh

### Gate Scripts Bypass PreToolUse Hook (B6)

Gate scripts write to gates.yml via `fs.writeFileSync` (Node.js process invoked via Bash), not via Claude Write tool. This bypasses:
- PreToolUse validation (no schema validation, no gate-phase validation)
- PostToolUse audit (no audit.log entry)

Skill-written semantic gate results DO go through hooks (asymmetry in dual-layer gates).

## Bugs Found

| # | Severity | Location | Description |
|---|----------|----------|-------------|
| B1 | Low | All skills + template | .bak file creation not mechanically enforced — purely instructional. Recovery procedure doesn't use .bak files anyway. |
| B2 | Low | ref-state-recovery.md | Recovery writes `gates.yml` as `history: []`, discarding all previous gate passage records |
| B3 | Low | ref-state-recovery.md | Questions/tasks reconstruction from artifacts is LLM-dependent, may silently produce empty arrays |
| B4 | Medium | execute SKILL.md Steps 5d-5e | State/PROGRESS.md write ordering gap — if interrupted between state update and PROGRESS.md append, reconstruction path misses the task |
| B5 | Low | audit-state-change.js:63 | Override detection uses fragile `indexOf('outcome: "overridden"')` — only matches double-quoted YAML |
| B6 | Low | gates/lib/gate-utils.js:61 | Gate scripts bypass PreToolUse hook when writing gates.yml — no schema validation or audit logging |

## Unrecoverable Scenarios Found

### U1: Simultaneous Corruption of state.yml AND All Artifacts

If state.yml AND all four recovery artifacts (PLAN.md, DESIGN.md, SYNTHESIS.md, SCOPE.md) are deleted/corrupted, lifecycle must restart from scratch. **Likelihood: Very low** — requires corruption across four subdirectories simultaneously.

**Mitigations:** Git history, .gitignore allowing state file tracking, intermediate artifacts still on disk.

### U2: Execute Skill Worktree Branch Orphaned After Interrupted Session

If session interrupted after task-implementer completes in worktree but before merge-back, the worktree branch name is NOT stored in any state file. On resume, new agent creates new branch; original is orphaned with completed work.

**Likelihood: Low** — requires interruption in specific window between agent return and merge.

**Recommendation:** Store worktree branch name in per-phase checkpoint immediately after agent dispatch. On resume, check if stored branch exists and attempt merge before re-dispatching.
