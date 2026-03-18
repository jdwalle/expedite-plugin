# DA-10: Portability Validation

## Summary

The plugin is broadly portable. No hardcoded absolute paths exist in any runtime file. All path constructions use `process.cwd()`, `path.resolve()`, or `path.join()` with relative segments. The `node_modules/` dependency tree is self-contained with js-yaml 4.1.1 + argparse 2.0.1. Scope Step 3 initialization creates 3 of the 7 available template artifacts; the remaining 4 are intentionally deferred to point-of-use creation by later skills/hooks.

**Verdict: PASS with 0 bugs, 2 advisory risks.**

## q28: Hardcoded Paths and Environment Assumptions

**No hardcoded absolute paths, project-specific references, or environment assumptions exist in any runtime file.**

- Grepped all files in `hooks/`, `gates/`, `skills/`, `agents/`, `templates/` for `/Users/`, `/home/`, `/tmp/`, `/var/`, `/opt/`. Only one match: `hooks/benchmark-latency.js:19` uses `/tmp/test/foo.txt` as a test payload — this is a development benchmark script, not production code.
- All path constructions in runtime files use portable patterns: `process.cwd()` + `path.join()` for hooks, `path.resolve(process.argv[2])` for gates, `path.dirname(filePath)` for hook interceptors.
- Hook commands in `.claude/settings.json` use relative paths (`node hooks/validate-state-write.js`), which resolve from CWD (project root).
- Skill `.md` files use CWD-relative paths with Glob fallbacks.
- The `.planning/` directory has absolute paths, but these are development-time plan documents, not runtime files.

## q29: Dependency Self-Containment

**Yes, `require('js-yaml')` resolves correctly. The dependency tree is fully self-contained.**

- `hooks/node_modules/` contains: js-yaml 4.1.1 (sole declared dependency) and argparse 2.0.1 (transitive dependency of js-yaml).
- No native modules, no peer dependencies, no optional dependencies.
- `hooks/package.json` is a proper CommonJS package with `"private": true`.
- Hook scripts call `require('js-yaml')` which resolves via Node.js module resolution from the script's `__dirname` → `hooks/node_modules/js-yaml/`. This works regardless of CWD.
- Internal requires (`./lib/state-schema`, `./lib/fsm`, `../validate`) all use relative paths and resolve correctly from `__dirname`.
- `gates/lib/gate-utils.js` uses `require(path.join(__dirname, '../../hooks/node_modules/js-yaml'))` — a cross-directory `__dirname`-relative require. Portable as long as the `gates/` and `hooks/` directory relationship is preserved.

## q30: Initialization Sequence (Scope Step 3)

**The initialization sequence correctly creates all required artifacts with proper conditional handling.**

Step 3 trace (fires when `.expedite/state.yml` is absent):

| Sub-step | Action | Template | Target | Conditional |
|----------|--------|----------|--------|-------------|
| 1 | `mkdir -p .expedite/scope` | N/A | Directory | Always |
| 2 | Glob + read + customize + write | `state.yml.template` | `.expedite/state.yml` | Always |
| 3 | Copy sources template | `sources.yml.template` | `.expedite/sources.yml` | if not exists |
| 4 | Copy gitignore template | `gitignore.template` | `.expedite/.gitignore` | if not exists |
| 5 | Log phase transition | N/A | `.expedite/log.yml` | Always (append) |

The 4 templates not used in Step 3 (checkpoint, questions, gates, tasks) are **intentionally deferred**:
- `checkpoint.yml` — created by checkpoint pattern at every step boundary
- `questions.yml` — created by Step 9 artifact writes
- `gates.yml` — created by gate scripts via `gate-utils.appendGateResult()` (which includes `mkdir -p`)
- `tasks.yml` — created by plan skill

Partial-initialization handled correctly: `sources.yml` and `.gitignore` use "if not exists" checks.

## Bugs Found

**None.**

## Portability Risks

1. **Cross-directory require in gate-utils.js (LOW)**: `gates/lib/gate-utils.js` reaches into `../../hooks/node_modules/js-yaml` via `__dirname`. Safe for copy-based deployment but creates structural coupling. Would break if `gates/` and `hooks/` directory relationship changes.

2. **Glob template resolution could match wrong files (LOW)**: Step 3 uses unbounded `**/templates/state.yml.template` glob. Could match wrong template in a monorepo with similarly-named files. Template filenames are specific enough to make false matches unlikely.
