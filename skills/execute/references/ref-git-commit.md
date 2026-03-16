# Git Commit Protocol

Per-task atomic git commits after verification. Read by execute skill at Step 5c-git.

## Opt-Out Check

Before any git operation, check whether auto-commits are disabled:
1. Read state.yml -- if `auto_commit: false` is set, skip all git operations for this task. Log "Auto-commit disabled, skipping git commit" and return to Step 5d.
2. Check if `--no-commit` was passed in the execute invocation (parsed in Step 3, stored as `no_commit: true` in execution context). If so, skip.
3. If neither opt-out is active, proceed with git commit.

## Verification Gate

Only commit if the task verification status from Step 5c is VERIFIED or PARTIAL:
- **VERIFIED:** Proceed to staging and commit.
- **PARTIAL:** Proceed to staging and commit (partial work is still valuable to preserve).
- **FAILED:** Do NOT auto-commit. Display: "Task {task_id} failed verification. Options: commit-anyway / skip / pause". Wait for user response.
  - commit-anyway: proceed to staging and commit (user accepts risk)
  - skip: skip git commit for this task, continue to Step 5d
  - pause: save checkpoint with substep `commit_failed_{task_id}`, STOP
- **NEEDS REVIEW:** Same behavior as FAILED -- do not auto-commit, prompt user.

## Selective Staging

Stage ONLY the files listed in the task definition (from PLAN.md task file list or SPIKE.md implementation steps). Never use bulk-add commands (mass staging is prohibited).

For each file in the task's file list:
```bash
git add {file_path}
```

If a `git add` fails (file not found, permission error): display the error and prompt: "Git staging failed for {file_path}. Options: skip-file / skip-commit / pause". Do NOT proceed to commit with partial staging unless user confirms.

After staging, verify something was staged:
```bash
git diff --cached --stat
```
If nothing staged (all files unmodified): log "No changes to commit for task {task_id}" and skip commit.

## Commit Message Format

Format: `{type}(DA-{N}): {task_description}`

**Type derivation** from task nature:
- `feat` -- new functionality, new files, new capabilities
- `fix` -- bug fixes, corrections to existing behavior
- `refactor` -- restructuring without behavior change
- `test` -- test additions or modifications
- `docs` -- documentation-only changes

If task traces to multiple DAs, use the primary DA (first listed).

**Extended body** (via heredoc for multi-line):
```bash
git commit -m "$(cat <<'EOF'
{type}(DA-{N}): {task_description}

Task: {task_id}
Phase: {phase_slug}
DA: DA-{N}: {DA_name}
Verification: {status}
EOF
)"
```

**Track commit hash:** After successful commit, capture:
```bash
git rev-parse --short HEAD
```
Include the commit hash in the PROGRESS.md append (Step 5e) for traceability.

## Git Error Handling

If `git commit` fails for any reason (no staged changes after filtering, hook failure, lock file):
- Display the full git error output
- Display: "Git commit failed for task {task_id}. Options: retry / skip / pause"
- Do NOT attempt auto-resolution (no `git reset`, no force flags, no stash)
- retry: re-run the git add + git commit sequence
- skip: skip commit, continue to Step 5d
- pause: save checkpoint with substep `git_error_{task_id}`, STOP
