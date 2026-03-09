# Phase 10: Cross-Cutting Integration - Research

**Researched:** 2026-03-08
**Domain:** Lifecycle-wide integration: intent adaptation, telemetry, archival, gate escalation, scope enhancements
**Confidence:** HIGH

## Summary

Phase 10 addresses six cross-cutting concerns that span the entire Expedite lifecycle: (1) making intent (product/engineering) flow consistently from declaration in scope through every downstream skill, (2) operational telemetry via append-only log.yml, (3) lifecycle archival to `.expedite/archive/{slug}/`, (4) polishing gate escalation with override severity tracking and gap context injection, (5) source configuration during scope, and (6) additive codebase-routed questions in scope.

The good news is that the existing codebase already has substantial partial implementations for most of these requirements. Intent is already declared in scope (Step 4) and stored in state.yml. Design, plan, and execute skills already branch on intent for format selection (PRD vs RFC, epics vs waves). The archival flow already exists in scope Step 1 Case B/C. Source configuration already exists as scope Step 7. The gap is making these features complete, consistent, and wired end-to-end.

**Primary recommendation:** Treat this phase as integration and polish work, not greenfield development. Each requirement maps to specific, localized edits in existing skill files and templates. The riskiest work is SCOPE-12 (codebase-routed questions), which introduces a new step with codebase analysis and question generation -- the only genuinely new capability in this phase.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| INTNT-01 | Intent (product/engineering) declared during scope, stored in state.yml, flows through entire lifecycle | Intent is already declared (scope Step 4) and stored in state.yml. Each downstream skill already reads intent. Gap is ensuring every skill uses it consistently for format/terminology adaptation. See "Intent Flow Architecture" section. |
| INTNT-02 | Product intent: PRD-style design, epics/stories plan, HANDOFF.md generation | Design skill already generates PRD format for product intent (Step 4). Plan skill already generates epics/stories (Step 4). HANDOFF.md generation exists (Step 6). Need verification that all conditional blocks work correctly end-to-end. |
| INTNT-03 | Engineering intent: RFC-style design, wave-ordered tasks, technical checklists | Design skill already generates RFC format (Step 4). Plan skill already generates wave-ordered tasks (Step 4). Need verification that all conditional blocks work correctly. |
| TELE-01 | log.yml in `.expedite/` directory, gitignored | gitignore.template already includes `log.yml`. Need to add log initialization and append logic to skills. |
| TELE-02 | Append-only via `cat >>` Bash command (never Write tool rewrite) | Pattern already established by PROGRESS.md in execute skill. Same `cat >>` pattern applies. |
| TELE-03 | Multi-document YAML format (one document per event) | YAML multi-document format uses `---` separators. Each event is a standalone YAML document appended via `cat >>`. |
| TELE-04 | Tracks phase transitions, gate outcomes, agent completions, source failures, overrides | Five event types need telemetry hooks inserted into existing skill code at specific points. See "Telemetry Architecture" section. |
| TELE-05 | log.yml persists across lifecycles (not archived) | Archival flow in scope Step 1 already excludes log.yml from archive moves. This is already implemented. |
| ARTF-03 | Archival flow moves completed lifecycle to `.expedite/archive/{slug}/` | Archival flow already exists in scope SKILL.md Step 1. Current archival is triggered by "start over" during scope. ARTF-03 needs a dedicated archival command or a post-completion archival path. |
| GATE-05 | Override records severity and injects gap context into downstream phase prompts | Override handling already exists in research (ref-override-handling.md) and design (Step 9c). Override-context.md files are already consumed by downstream skills. Gap: not all gates consistently write override-context.md with severity. Need to verify plan gate override also injects context. |
| SCOPE-06 | Source configuration step in scope confirms default sources or allows editing sources.yml | Already implemented as scope Step 7. This requirement is already marked "Complete" in REQUIREMENTS.md traceability but appears in Phase 10 list. May need verification only. |
| SCOPE-12 | Scope Step 7 generates additive codebase-routed questions per DA -- not counted against question budget | New capability. Requires inserting a new step between current Step 6 (question plan review) and current Step 7 (source configuration). This step analyzes the codebase using Grep/Glob/Read to find existing patterns relevant to each DA, then generates additive questions. |
</phase_requirements>

## Architecture Patterns

### Requirement Grouping by Implementation Strategy

The 12 requirements fall into four implementation strategies:

**Group A: Verification and polish of existing behavior (low risk)**
- INTNT-01, INTNT-02, INTNT-03: Intent already flows; verify and fix any gaps
- SCOPE-06: Already implemented; verify only
- GATE-05: Override handling mostly exists; ensure consistency across all gates

**Group B: New append-only telemetry system (medium risk)**
- TELE-01 through TELE-05: New log.yml system, but pattern (cat >>) already proven in execute skill

**Group C: Archival formalization (low risk)**
- ARTF-03: Archival flow exists in scope; needs a formal post-completion path

**Group D: New codebase analysis capability (higher risk)**
- SCOPE-12: Entirely new step with codebase analysis and question generation

### Intent Flow Architecture

**Current state (already implemented):**

| Skill | How Intent Is Used | Where In Code |
|-------|-------------------|---------------|
| Scope | Declared in Step 4, stored as `intent` in state.yml | scope SKILL.md Step 4 Question 2 |
| Scope | Intent-specific question plan guidance (product: Cagan risks; engineering: concerns) | prompt-scope-questioning.md `<intent_lens>` |
| Research | Intent passed to sufficiency evaluator and synthesizer templates | research SKILL.md Steps 12, 17 |
| Design | Format selection: PRD vs RFC based on intent | design SKILL.md Step 4, prompt-design-guide.md |
| Design | HANDOFF.md generated for product intent only | design SKILL.md Step 6 |
| Plan | Format selection: epics/stories vs waves/tasks | plan SKILL.md Step 4, prompt-plan-guide.md |
| Spike | Slug format: epic-N vs wave-N | spike SKILL.md Step 2 |
| Execute | Slug format: epic-N vs wave-N, display format | execute SKILL.md Step 2 |
| Status | Phase descriptions use intent-neutral language | status SKILL.md Step 3 |

**What's missing for INTNT-01/02/03 completeness:**

1. **Scope SKILL.md Step 5 (adaptive refinement):** Background checklist already branches on intent. Verified present.
2. **Research SKILL.md:** Intent is passed through but not used for differentiated research behavior (this is correct -- research gathers evidence regardless of intent).
3. **Execute SKILL.md Step 5e:** PROGRESS.md entries use "Wave" for engineering and "Wave" for both -- should use "Epic" for product intent.
4. **All completion summaries:** Each skill's completion display should use intent-appropriate terminology (Wave vs Epic, tasks vs stories).

**Assessment:** Intent flow is 90%+ implemented. The remaining work is terminology consistency in display messages and progress entries. This is polish, not architecture.

### Telemetry Architecture

**Event schema (multi-document YAML):**

```yaml
---
event: phase_transition
timestamp: "2026-03-08T12:00:00Z"
lifecycle_id: "auth-redesign-20260308"
from_phase: scope_complete
to_phase: research_in_progress
```

```yaml
---
event: gate_outcome
timestamp: "2026-03-08T12:30:00Z"
lifecycle_id: "auth-redesign-20260308"
gate: G2
outcome: go_advisory
must_passed: 4
must_failed: 0
should_passed: 2
should_failed: 1
```

```yaml
---
event: agent_completion
timestamp: "2026-03-08T12:15:00Z"
lifecycle_id: "auth-redesign-20260308"
agent_type: web-researcher
batch_id: batch-01
questions: ["q01", "q02"]
status: complete
```

```yaml
---
event: source_failure
timestamp: "2026-03-08T12:10:00Z"
lifecycle_id: "auth-redesign-20260308"
source: github
error: "Connection refused"
action: rerouted_to_web
affected_questions: ["q05"]
```

```yaml
---
event: override
timestamp: "2026-03-08T13:00:00Z"
lifecycle_id: "auth-redesign-20260308"
gate: G2
severity: medium
must_failed: 1
affected_das: ["DA-3"]
```

**Five event types mapped to insertion points:**

| Event Type | Skill(s) | Insertion Point |
|------------|----------|-----------------|
| phase_transition | All skills with phase writes | Every state.yml update that changes `phase` field |
| gate_outcome | scope (G1), research (G2), design (G3), plan (G4), spike (G5) | After gate evaluation, before outcome handling |
| agent_completion | research (batch agents, sufficiency evaluator, synthesizer), spike (research agents) | After Task() returns |
| source_failure | research (Step 7 pre-validation, Step 9 dispatch failure) | On source validation failure or agent failure |
| override | research (Step 15c), design (Step 9c), plan (Step 8c) | Override handling blocks |

**Append pattern (matching PROGRESS.md precedent):**

```bash
cat >> .expedite/log.yml << 'LOG_EOF'
---
event: phase_transition
timestamp: "{ISO 8601 UTC}"
lifecycle_id: "{lifecycle_id}"
from_phase: "{old_phase}"
to_phase: "{new_phase}"
LOG_EOF
```

**Initialization:** log.yml does NOT need initialization -- `cat >>` creates the file if it does not exist. The gitignore.template already excludes it. No template needed.

**Persistence across lifecycles (TELE-05):** The archival flow in scope Step 1 already excludes `log.yml` from the archive move (line 104 of scope SKILL.md: `if [ "$base" != "log.yml" ]`). This is already correctly implemented.

### Archival Architecture

**Current state:** Archival flow exists in scope SKILL.md Step 1 (Cases B and C). When a user starts a new scope while an existing lifecycle exists, they can choose to archive it. The flow:
1. Generate slug from project_name + date
2. `mkdir -p .expedite/archive/{slug}`
3. Move all `.expedite/*` except archive/, sources.yml, log.yml, .gitignore

**What ARTF-03 requires additionally:**
A way to archive a COMPLETED lifecycle (phase: "complete") without starting a new one. Currently, the only path to archival is through scope Step 1 (which starts a new lifecycle). Options:

1. **Add archival to execute Step 7 (lifecycle completion):** After lifecycle completes, offer to archive. This is the natural trigger.
2. **Add a dedicated `/expedite:archive` command or integrate into status skill.** This would require a new skill or modifying an existing one.

**Recommended approach:** Add archival prompting to execute Step 7 (lifecycle completion). After the completion summary, prompt: "Archive this completed lifecycle? (yes / no)". If yes, run the same archival flow from scope Step 1 but without starting a new lifecycle.

The archival flow logic should also be documented as a reusable pattern since it appears in two places (scope Step 1 and execute Step 7). However, since skills are independent SKILL.md files without shared code, the pattern must be duplicated (consistent with the existing architecture where each skill is self-contained).

### Gate Escalation Architecture (GATE-05)

**Current state of override handling across gates:**

| Gate | Override Context File | Severity Tracking | Gap Injection Downstream |
|------|----------------------|-------------------|--------------------------|
| G1 (scope) | N/A (uses "hold" not "recycle") | N/A | N/A |
| G2 (research) | `.expedite/research/override-context.md` | Yes (ref-override-handling.md) | Design reads it (Step 2) |
| G3 (design) | `.expedite/design/override-context.md` | Yes (design Step 9c) | Plan reads it (Step 2) |
| G4 (plan) | `.expedite/plan/override-context.md` | Yes (plan Step 8c) | Execute/spike read it (Step 2/3) |
| G5 (spike) | No override-context.md | Override treated as go-with-advisory | No downstream injection |

**What GATE-05 requires:** "Override records severity and injects gap context into downstream prompts."

**Gap analysis:**
1. G2 override: COMPLETE -- ref-override-handling.md handles severity, design reads override-context.md
2. G3 override: COMPLETE -- design Step 9c writes override-context.md with severity, plan reads it
3. G4 override: COMPLETE -- plan Step 8c writes override-context.md with severity, execute/spike read it
4. G5 override: PARTIAL -- spike treats override as go-with-advisory in output. Since execute reads SPIKE.md which contains the advisory, gap context does flow. However, no override-context.md file is written.

**Recycle escalation (GATE-04 related):**
Research already has ref-recycle-escalation.md. Design and plan skills already implement 3-tier escalation inline (1st informational, 2nd suggest adjustment, 3rd recommend override). The pattern is consistent.

**Assessment:** GATE-05 is 90% implemented. The remaining work is:
- Verify G5 spike override writes advisory context that execute can consume
- Ensure override-context.md format is consistent across all gates
- Verify that "injects gap context into downstream prompts" means the downstream skill actually uses the override context when loaded (already true for design, plan, and execute based on code review)

### Scope Codebase-Routed Questions (SCOPE-12)

**This is the only genuinely new capability in Phase 10.**

**Requirement:** "Scope Step 7 generates additive codebase-routed questions per DA -- not counted against question budget, as many as needed to understand existing codebase patterns relevant to each decision area"

**Current step numbering in scope SKILL.md:**
- Step 6: Question plan generation and review
- Step 7: Source configuration (SCOPE-06)
- Step 8: Write artifacts
- Step 9: G1 Gate

**Implementation approach:**

Insert a NEW Step 7 between current Step 6 and current Step 7. Renumber current Step 7 to Step 8, Step 8 to Step 9, Step 9 to Step 10.

**New Step 7: Codebase Analysis and Additive Questions**

Process for each DA:
1. Analyze the DA's name and the user's project description to determine what codebase patterns are relevant
2. Use Grep/Glob/Read to scan the user's codebase for existing patterns related to the DA
3. Generate DA-specific codebase questions based on what was found (or not found)
4. These questions are additive: they do not count against the 15-question budget
5. These questions have `source_hints: ["codebase"]` automatically
6. Present to user for review (approve all / approve specific / skip)

**Question characteristics:**
- Always routed to codebase researcher
- Not counted against the 15-question budget from Step 6
- As many as needed per DA (no cap)
- Focused on understanding existing patterns that affect the DA's design decisions
- Marked distinctly in state.yml (e.g., `source: "codebase-routed"`)

**Example codebase-routed questions:**
- For DA "Authentication": "What authentication patterns exist in the current codebase? (Check middleware, session handling, token validation)"
- For DA "API Design": "What existing API routes and conventions are used? (Check route definitions, middleware chain, response format patterns)"
- For DA "Data Model": "What ORM/database patterns and schema definitions exist? (Check models, migrations, query builders)"

**Risk factors:**
- Codebase may be empty or irrelevant (new project) -- need graceful handling
- Codebase may be very large -- need focused scanning, not exhaustive
- Question quality depends on LLM's ability to map DA topics to codebase search patterns

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| YAML multi-document append | Custom YAML writer | `cat >>` with heredoc + `---` separator | YAML multi-document format is just `---` delimited. `cat >>` is atomic enough for single-user CLI. Proven pattern from execute PROGRESS.md. |
| Codebase pattern detection | Complex AST parsing | Grep/Glob with strategic patterns | AST parsing is out of scope and unnecessary. Pattern-based search (file names, import patterns, directory structure) gives sufficient signal for question generation. |
| Intent-based branching | Complex conditional system | Simple if/else on `intent` field | Already the pattern everywhere in the codebase. Two values: "product" or "engineering". |
| Override context format | Different format per gate | Standardized override-context.md template | Already converged across G2, G3, G4. Same structure: severity, overridden issues, downstream advisory. |

**Key insight:** Every capability in Phase 10 has an existing pattern to follow. Telemetry follows the PROGRESS.md append pattern. Archival follows the scope Step 1 archival flow. Gate escalation follows the research ref-recycle-escalation.md pattern. Intent branching follows the `<if_intent_*>` conditional block pattern. The only genuinely novel work is SCOPE-12's codebase analysis.

## Common Pitfalls

### Pitfall 1: Step Renumbering Cascade
**What goes wrong:** Inserting a new step in scope SKILL.md (for SCOPE-12) requires renumbering Steps 7-9 to Steps 8-10. Any internal cross-references to step numbers ("Proceed to Step 8") break silently.
**Why it happens:** Steps reference each other by number throughout SKILL.md.
**How to avoid:** After renumbering, search for ALL "Step 7", "Step 8", "Step 9" references in scope SKILL.md and update them. Also check the Step 6 review loop which says "Proceed to Step 7" on approval.
**Warning signs:** User follows skill instructions but gets routed to wrong step.

### Pitfall 2: Telemetry in Wrong Sequence
**What goes wrong:** Logging the phase transition BEFORE actually updating state.yml, causing the log entry to have the wrong `from_phase` or the state.yml write to fail after logging.
**Why it happens:** Telemetry insertion points need to be AFTER successful state updates, not before.
**How to avoid:** Place telemetry appends AFTER the state.yml write succeeds, not before. If the state.yml write fails, no telemetry entry should be written for that transition.
**Warning signs:** log.yml shows transitions that didn't actually happen in state.yml.

### Pitfall 3: Codebase Questions on Empty Projects
**What goes wrong:** SCOPE-12 tries to analyze codebase for a greenfield project with no existing code, produces zero questions or irrelevant questions.
**Why it happens:** The codebase may be empty, or may not yet have patterns relevant to the DAs.
**How to avoid:** Include explicit handling: "If no relevant codebase patterns found for this DA, skip codebase questions for it." Display: "No existing codebase patterns detected for DA-{N}. Skipping codebase questions."
**Warning signs:** Empty or nonsensical codebase questions presented to user.

### Pitfall 4: Archival of Active Lifecycle
**What goes wrong:** User archives a lifecycle that's in progress (not "complete"), losing work.
**Why it happens:** The archival flow in scope Step 1 already handles this (it archives any phase), but the new execute Step 7 archival should only apply to completed lifecycles.
**How to avoid:** Only offer archival in execute Step 7 when `phase: "complete"`. The scope Step 1 archival path (archive-and-start-new) already handles the in-progress case correctly.
**Warning signs:** User loses in-progress lifecycle state unexpectedly.

### Pitfall 5: log.yml Growing Without Bound
**What goes wrong:** log.yml persists across lifecycles and is never trimmed, growing indefinitely.
**Why it happens:** TELE-05 specifies persistence across lifecycles by design.
**How to avoid:** This is by design for v1 -- passive collection only. The file is gitignored, so it does not affect repository size. Future v2 could add rotation. No action needed for v1 beyond documenting the intentional design choice.
**Warning signs:** None for v1 (single-user CLI, file size is negligible for lifecycle event logs).

### Pitfall 6: Duplicate Telemetry Events
**What goes wrong:** A gate evaluation logs an event, then the outcome handler also logs the same event type.
**Why it happens:** The gate evaluation and outcome handling are separate steps, and telemetry hooks could be placed in both.
**How to avoid:** Log gate_outcome events at exactly ONE point: after gate evaluation, before outcome routing. Do not log again in the outcome handler. For overrides, log a SEPARATE "override" event type -- do not modify the gate_outcome event.
**Warning signs:** log.yml shows two gate_outcome entries for the same gate evaluation.

## Code Examples

### Telemetry Append Pattern
```bash
# Source: Modeled on execute SKILL.md PROGRESS.md append pattern
cat >> .expedite/log.yml << 'LOG_EOF'
---
event: phase_transition
timestamp: "{ISO 8601 UTC}"
lifecycle_id: "{lifecycle_id}"
from_phase: "{old_phase}"
to_phase: "{new_phase}"
LOG_EOF
```

### Codebase-Routed Question Generation (SCOPE-12)
```markdown
# Pattern for new Step 7 in scope SKILL.md

### Step 7: Codebase Analysis (Additive Questions)

For each Decision Area in the approved question plan:

1. Determine relevant codebase search patterns based on DA name and project context.
2. Use Grep, Glob, and Read to scan the project codebase for existing patterns:
   - Directory structure (Glob for relevant directories)
   - File patterns (Glob for relevant file types)
   - Code patterns (Grep for imports, function signatures, configuration)
3. Generate codebase-routed questions based on findings. Each question:
   - Is specific to patterns found (or notably absent) in the codebase
   - Has `source_hints: ["codebase"]`
   - Is NOT counted against the 15-question budget
   - Focuses on "how does the existing code handle X" rather than general knowledge
4. If no relevant patterns found for a DA, skip that DA with a note.

Present all codebase-routed questions to the user:
```
--- Codebase-Routed Questions ---

DA-1: {Name}
  [CB] qCB01: {question about existing pattern} (codebase)
    Evidence needed: {specific codebase evidence}
  [CB] qCB02: {question about existing pattern} (codebase)
    Evidence needed: {specific codebase evidence}

DA-3: {Name}
  [CB] qCB03: {question about existing pattern} (codebase)
    Evidence needed: {specific codebase evidence}

DA-2: {Name}
  (No relevant codebase patterns detected)

--- {N} codebase questions across {M} DAs ---
Approve? (yes / modify / skip)
```

If approved, add to state.yml questions array with `source: "codebase-routed"`.
```

### Archival Flow in Execute Step 7
```markdown
# Pattern for archival option after lifecycle completion

**After lifecycle completion summary display:**

Use AskUserQuestion:
```
header: "Archive"
question: "Archive this completed lifecycle?"
options:
  - label: "Yes, archive"
    description: "Move lifecycle artifacts to .expedite/archive/{slug}/"
  - label: "No, keep active"
    description: "Keep artifacts in .expedite/ for reference"
multiSelect: false
```

If "Yes, archive":
1. Generate slug: {project_name_slugified}-{YYYYMMDD}
2. mkdir -p .expedite/archive/{slug}
3. Move all .expedite/* to archive EXCEPT: archive/, sources.yml, log.yml, .gitignore
4. Update state.yml phase to "archived"
5. Display: "Lifecycle archived to .expedite/archive/{slug}/"

If "No, keep active":
Display: "Lifecycle artifacts preserved. Run /expedite:scope to start a new lifecycle."
```

### Override Context File Format (Standardized)
```markdown
# G{N} Override Context

Timestamp: {ISO 8601 UTC}
Severity: {low|medium|high}
Recycle count: {N}

## Overridden Issues

- {criterion_id}: {criterion description}
  Evidence: {what the gate found}
  Impact: {which DAs/phases are affected}

## {Next Phase} Advisory

The following quality issues were overridden. The {next phase} phase should
account for these gaps when creating {artifacts}.
{List affected criteria and recommendations}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| No telemetry | Append-only log.yml | Phase 10 (this phase) | Enables future calibration from lifecycle data |
| Archival only on new-scope start | Archival available on lifecycle completion | Phase 10 (this phase) | Cleaner lifecycle management |
| Source config as placeholder | Source config confirms/edits sources.yml | Phase 4 (already done) | SCOPE-06 already implemented |
| No codebase analysis during scope | Codebase-routed questions per DA | Phase 10 (this phase) | Better evidence from existing code patterns |

## Open Questions

1. **Codebase question ID format**
   - What we know: Regular questions use q01-q15 sequential IDs. Codebase-routed questions need distinct IDs.
   - What's unclear: Should they use qCB01, qCB02 format? Or continue the sequential numbering (q16, q17)?
   - Recommendation: Use sequential numbering continuing from the last approved question (q16, q17, etc.) to keep the ID space simple. Mark them with `source: "codebase-routed"` in state.yml to distinguish them.

2. **Scope SKILL.md step numbering approach**
   - What we know: Inserting Step 7 (codebase analysis) before current Step 7 (source config) requires renumbering Steps 7-9 to Steps 8-10.
   - What's unclear: Whether to renumber or use Step 6b/7a approach.
   - Recommendation: Renumber cleanly to Steps 7-10. The skill file is a single document maintained by the planner; renumbering is straightforward with search-and-replace.

3. **Telemetry event volume per lifecycle**
   - What we know: A typical lifecycle has: 1 scope + 1 research + 1 design + 1 plan + N execute phases. Each produces 1-2 phase transitions + 1 gate evaluation. Research adds agent completions (3-5 per round).
   - What's unclear: Exact volume, but estimate 20-40 events per lifecycle.
   - Recommendation: No concern for v1. Even 100+ lifecycles would produce a manageable log.yml file.

4. **Execute SKILL.md tool list for telemetry**
   - What we know: Execute skill uses `cat >>` for PROGRESS.md appends via Bash. Same pattern works for log.yml.
   - What's unclear: Execute SKILL.md does not have AskUserQuestion in its tool list. Archival prompt needs either freeform prompt or AskUserQuestion.
   - Recommendation: Execute already uses freeform prompts for micro-interactions. Use freeform prompt for archival question too ("Archive this lifecycle? yes/no"). No tool list change needed.

## Sources

### Primary (HIGH confidence)
- **Codebase analysis** -- All 7 SKILL.md files read in full, all 10 reference prompt templates read, all 3 template files read, state.yml template analyzed, gitignore.template analyzed
- **REQUIREMENTS.md** -- All 12 phase requirements verified against existing implementations
- **STATE.md** -- Project history and decisions from Phases 1-9 reviewed

### Secondary (MEDIUM confidence)
- None needed -- this phase is entirely about the project's own internal architecture

### Tertiary (LOW confidence)
- None

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- No external libraries. This is all SKILL.md prose and YAML patterns.
- Architecture: HIGH -- Every pattern needed already exists in the codebase. Codebase analysis confirmed existing implementations for all 12 requirements.
- Pitfalls: HIGH -- Pitfalls identified from direct analysis of the actual code (step numbering references, telemetry sequencing, etc.)

**Research date:** 2026-03-08
**Valid until:** No expiry -- this research is about the project's own internal architecture, not external dependencies.
