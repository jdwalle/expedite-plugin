---
name: design
description: >
  This skill should be used when the user wants to "generate a design",
  "create design document", "design phase", "write RFC", "write PRD",
  or needs to synthesize research evidence into an implementation or product design.
  Supports --override flag to proceed despite gate warnings.
allowed-tools:
  - Read
  - Write
  - Glob
  - Bash
argument-hint: "[--override]"
---

Current lifecycle state:
!`cat .expedite/state.yml 2>/dev/null || echo "No active lifecycle"`

# Design Skill

You are the Expedite design orchestrator. Your job is to generate a design document that translates research evidence into actionable design decisions. You are the third stage of the contract chain: every decision area and evidence finding from research flows through you to create design decisions that the plan skill must implement. Every design decision must reference the evidence that justifies it — no decision without evidence.

**Interaction model:** Use freeform prompts for revision feedback (design feedback is inherently open-ended — "change DA-3 to use approach B instead"). Use AskUserQuestion only for structured choices (override approval, proceed-to-gate confirmation).

**After completing each step, proceed to the next step automatically.** Do not wait for explicit "next step" instructions from the user between steps unless the step specifically calls for user input.

## Instructions

### Step 1: Prerequisite Check

**Step tracking:** Update `current_step` in state.yml (backup-before-write):
1. Read `.expedite/state.yml`
2. Backup: `cp .expedite/state.yml .expedite/state.yml.bak` (via Bash)
3. Set `current_step` to `{skill: "design", step: 1, label: "Prerequisite Check"}`
4. Set `last_modified` to current timestamp
5. Write the entire file back

Look at the injected lifecycle state above.

**Case A: Phase is "research_complete"**

Display: "Starting design phase..."

Proceed to Step 2.

**Case B: Phase is "research_in_progress" AND `--override` flag is present AND gate_history contains at least one G2 recycle entry**

The user's research gate recycled, they exited the session, and are now re-entering with --override to proceed to design with known gaps.

1. Verify gate_history contains at least one entry where `gate: "G2"` and `outcome: "recycle"`.
   If no G2 recycle found, display error: "Override requested but no G2 recycle found in gate history. Run `/expedite:research` first." -> STOP.
2. Read `.expedite/research/override-context.md` (must exist after a G2 override/recycle). If it doesn't exist, display error: "Override requested but no override-context.md found. Run `/expedite:research` first." -> STOP.
3. Record the override entry in state.yml gate_history (backup-before-write):
   ```yaml
   - gate: "G2-design-entry"
     timestamp: "{ISO 8601 UTC}"
     outcome: "override"
     notes: "Entered design via --override with research_in_progress phase and G2 recycle evidence"
     overridden: true
   ```
4. Display:
   ```
   Starting design phase with --override...

   WARNING: Research gate (G2) was not passed. Override context will be injected.
   Affected DAs will be flagged with Low confidence in the design document.
   ```

Proceed to Step 2. (Step 2 already reads override-context.md if it exists and flags affected DAs.)

**Case B2: Phase is "design_in_progress" AND `--override` flag is NOT present**

This is a resume scenario. The design skill was running when the session ended.

1. First, check gate_history for G2 recycle entries (entries where `gate: "G2"` and `outcome: "recycle"`).

   **If G2 recycle evidence IS found:** The design was in progress after an override entry, and the user may want either crash resume or override re-entry. Display:
   ```
   Found in-progress design for "{project_name}".

   It appears your research gate (G2) was recycled in a prior session.
   You can resume the design revision, or use --override to proceed with known gaps.

   Options:
   1. Resume design from where you left off
   2. Re-enter with --override: `/expedite:design --override`
   ```
   Wait for user response. If they choose resume, continue with the artifact check below. If they indicate --override, display: "Please re-invoke with the --override flag: `/expedite:design --override`" then STOP.

   **If NO G2 recycle evidence:** This is a pure crash resume. Continue with the artifact check below.

2. Check for `.expedite/design/DESIGN.md`:
   - If DESIGN.md exists: Step 5 completed. Resume at Step 7 (revision cycle). Display: "Found in-progress design with DESIGN.md already generated. Resuming at revision cycle..."
   - If DESIGN.md does not exist: Resume at Step 2 (read artifacts, then generate). Display: "Found in-progress design, but no DESIGN.md yet. Resuming from artifact loading..."

3. Display:
```
Found in-progress design for "{project_name}".

Design document: {exists/not yet generated}
Resume point: Step {2 or 7}
```

4. Proceed directly to the resume step. Do NOT re-run Step 3 (state transition) since state is already design_in_progress.

**Case C: Phase is anything else (not "research_complete", not matching Case B or B2 conditions)**

Display:
```
Error: Research is not complete. Run `/expedite:research` to gather evidence before starting design.

Current phase: {phase}
```
Then STOP. Do not proceed to any other step.

### Step 2: Read Scope + Research Artifacts

**Step tracking:** Update `current_step` in state.yml (backup-before-write):
1. Read `.expedite/state.yml`
2. Backup: `cp .expedite/state.yml .expedite/state.yml.bak` (via Bash)
3. Set `current_step` to `{skill: "design", step: 2, label: "Read Scope + Research Artifacts"}`
4. Set `last_modified` to current timestamp
5. Write the entire file back

Read the following files:

1. **`.expedite/scope/SCOPE.md`** — Extract the full list of Decision Areas (DA-1 through DA-N) with their names, depth calibration (Deep/Standard/Light), evidence requirements, and readiness criteria.
2. **`.expedite/research/SYNTHESIS.md`** — Extract per-DA findings: key findings, trade-offs, contradictions, gaps, evidence file references.
3. **`.expedite/state.yml`** — Extract `project_name`, `intent`, `lifecycle_id`, `questions` array (for status reference).
4. **If `.expedite/research/override-context.md` exists** — Read it. Extract affected DAs and severity. These DAs need lower-confidence flagging in the design document.

Display artifact loading summary:
```
--- Design Context Loaded ---

Project: {project_name}
Intent: {intent}
Decision Areas: {count} (DA-1 through DA-{N})
{If override context exists:} Override advisory: {severity} severity — {count} affected DAs
```

Verify all DAs from SCOPE.md appear in SYNTHESIS.md. If any DA is missing from synthesis, note it — the design must still address it with an explicit "insufficient evidence" flag and Low confidence.

**Error handling:** If SCOPE.md or SYNTHESIS.md cannot be read, display:
```
Error: Required file missing: {filename}. Run `/expedite:research` to complete the research phase.
```
Then STOP. Do not proceed.

**DA cross-reference:** Build a list of all DA IDs and names from SCOPE.md. For each DA, check that SYNTHESIS.md contains a corresponding section with findings. Track:
- DAs with full synthesis coverage (findings + evidence references)
- DAs with partial synthesis coverage (findings but gaps noted)
- DAs missing from synthesis entirely (will need "insufficient evidence" treatment in design)

### Step 3: Initialize Design State

Update state.yml using the backup-before-write pattern:

1. Read `.expedite/state.yml`
2. Copy to backup: `cp .expedite/state.yml .expedite/state.yml.bak` (via Bash)
3. Update the in-memory representation:
   - Set `phase` to `"design_in_progress"`
   - Set `current_step` to `{skill: "design", step: 3, label: "Initialize Design State"}`
   - Set `last_modified` to current ISO 8601 UTC timestamp
4. Write the entire file back to `.expedite/state.yml`

5. Log phase transition:
   ```bash
   cat >> .expedite/log.yml << 'LOG_EOF'
   ---
   event: phase_transition
   timestamp: "{ISO 8601 UTC}"
   lifecycle_id: "{lifecycle_id}"
   from_phase: "{research_complete|research_in_progress}"
   to_phase: "design_in_progress"
   LOG_EOF
   ```

Create the design output directory:
```bash
mkdir -p .expedite/design/
```

Display: "Design phase initialized. Generating design document..."

### Step 4: Generate Design Document

**Step tracking:** Update `current_step` in state.yml (backup-before-write):
1. Read `.expedite/state.yml`
2. Backup: `cp .expedite/state.yml .expedite/state.yml.bak` (via Bash)
3. Set `current_step` to `{skill: "design", step: 4, label: "Generate Design Document"}`
4. Set `last_modified` to current timestamp
5. Write the entire file back

This is inline generation in the main session — the design document is generated here, not dispatched to a subagent. Read `skills/design/references/prompt-design-guide.md` as a quality reference (use Glob with `**/prompt-design-guide.md` if the direct path fails). The design guide defines the required sections, quality criteria, and contract chain enforcement — but is NOT dispatched as a subagent. Its instructions guide the inline generation.

Generate the design document following the correct format for the declared intent. Both formats include a Design Overview section (3-5 sentences) summarizing the overall direction before diving into per-DA decisions. This mirrors SYNTHESIS.md's Executive Summary pattern and helps readers quickly understand the design direction.

The design document must be comprehensive enough to serve as the input for the plan phase, which creates implementation tasks traced to each design decision.

Format selection is automatic based on the `intent` field in state.yml:

**If intent is "engineering"** — RFC format with these sections in order:
1. **Context and Scope** — What is being designed and why? The problem statement with technical context.
2. **Goals and Non-Goals** — What this design achieves and explicitly does not attempt.
3. **Design Overview** — A high-level summary (3-5 sentences) of the overall design direction before per-DA decisions.
4. **Design Decisions by DA** — For EACH DA from SCOPE.md (DA-1 through DA-N):
   - **Decision:** The specific architectural or implementation choice
   - **Evidence:** Citations to SYNTHESIS.md findings and evidence files (e.g., "evidence-batch-01.md Finding 3")
   - **Alternatives Considered:** Other approaches evaluated with evidence for/against each
   - **Trade-offs:** What we gain and what we sacrifice
   - **Confidence:** High/Medium/Low based on evidence quality. If DA was in override-context.md, mark as Low with note "affected by G2 override"
   Target: 200-400 words per DA
5. **Detailed Design** — Implementation specifics: data models, API contracts, component interactions.
6. **Cross-Cutting Concerns** — Error handling, logging, security, performance, testing strategy.
7. **Migration/Compatibility** — How this integrates with existing systems (if applicable).
8. **Open Questions** — Unresolved items that the plan phase should account for.

**If intent is "product"** — PRD format with these sections in order:
1. **Problem Statement** — What user problem are we solving? Grounded in research evidence (user quotes, behavior data, market analysis from evidence files).
2. **Personas** — Who are the target users? Based on user research evidence, not assumptions. Include behavioral traits and needs from evidence.
3. **User Stories** — What do users need to do? In Given/When/Then or "As a... I want... So that..." format. Each story should trace to a DA.
4. **User Flows** — How do users accomplish their goals? Step-by-step flows with decision points. Reference evidence for flow choices.
5. **Design Overview** — A high-level summary (3-5 sentences) of the overall design direction before per-DA decisions.
6. **Design Decisions by DA** — For EACH DA from SCOPE.md (DA-1 through DA-N):
   - **Decision:** What we decided — the specific product choice
   - **Evidence basis:** Citations to SYNTHESIS.md findings and evidence files (e.g., "evidence-batch-01.md Finding 3")
   - **Alternatives Considered:** Other approaches evaluated with evidence for/against each
   - **Trade-offs:** What we gain and what we sacrifice with this decision
   - **Confidence:** High/Medium/Low based on evidence quality. If DA was in override-context.md, mark as Low with note "affected by G2 override"
   Target: 200-400 words per DA
7. **Success Metrics** — How do we measure success? Observable, measurable metrics tied to evidence. Each metric should be connected to at least one DA.
8. **Scope Boundaries** — What is in scope and out of scope for this design. Reference DAs to clarify boundaries.
9. **Open Questions** — Unresolved items that the plan phase should account for. Include questions arising from evidence gaps or conflicting findings.

**Contract chain enforcement (both intents):**
- Every DA from SCOPE.md MUST have a corresponding `### DA-N: {Name}` section
- Each decision MUST cite specific evidence files and findings from SYNTHESIS.md — not just "research showed that..."
- If evidence is insufficient for a DA, acknowledge the gap explicitly, state what additional evidence would change the decision, and mark confidence as Low
- Where evidence conflicts, present both perspectives and state which was chosen and why

**Evidence citation pattern:** Use inline citations within the decision text (e.g., "Based on evidence-batch-01.md Finding 3, the recommended approach is...") for primary supporting evidence. For each DA section, all referenced evidence files and specific findings should be traceable back to SYNTHESIS.md.

**Self-check before writing:** Before proceeding to Step 5, verify the generated content against these criteria:
- [ ] Every DA from SCOPE.md has a corresponding design decision section (count DAs in scope vs decisions in design)
- [ ] Every design decision cites specific evidence (not vague references)
- [ ] No design decision exists without evidence basis (insufficient evidence is explicitly flagged with Low confidence)
- [ ] The document follows the correct format for the declared intent (PRD for product, RFC for engineering)
- [ ] All required sections are present (no missing sections from the format above)
- [ ] Trade-offs are articulated for each decision (not just "we chose X")
- [ ] Open questions section captures genuine uncertainties (not manufactured)
- [ ] Confidence levels assigned per DA (High/Medium/Low)

If any check fails, revise the content before writing to disk. Do NOT write a design document that fails self-check.

**Handling known gaps from synthesis:** If SYNTHESIS.md flags gaps or insufficient evidence for a DA:
- Acknowledge the gap explicitly in the design decision section
- State the best-effort decision with rationale given available evidence
- State what additional evidence would change or strengthen the decision
- Mark confidence as Low or Medium accordingly
- If override-context.md exists and affects this DA, add note: "This DA was affected by a G2 gate override. Evidence gaps acknowledged."

### Step 5: Write DESIGN.md

**Step tracking:** Update `current_step` in state.yml (backup-before-write):
1. Read `.expedite/state.yml`
2. Backup: `cp .expedite/state.yml .expedite/state.yml.bak` (via Bash)
3. Set `current_step` to `{skill: "design", step: 5, label: "Write DESIGN.md"}`
4. Set `last_modified` to current timestamp
5. Write the entire file back

Write the generated design document to `.expedite/design/DESIGN.md`.

Document header (both formats):
```markdown
# {Technical Design | Product Design}: {project_name}
Generated: {ISO 8601 UTC timestamp}
Intent: {Engineering | Product}
Source: SCOPE.md + SYNTHESIS.md
```

After writing, display:
```
Design document written to .expedite/design/DESIGN.md

--- Design Summary ---
Project: {project_name}
Intent: {intent}
Decision Areas covered: {N}/{M} (should be N/N if all DAs addressed)
Format: {RFC | PRD}
{If override context:} Override-affected DAs flagged with Low confidence: {list}
```

If the count of DAs in DESIGN.md does not match the count from SCOPE.md, display a warning: "WARNING: {missing_count} Decision Areas not addressed in design. Missing: {list}. These must be added before G3 gate."

**Post-write verification:** After writing DESIGN.md, read it back and verify:
1. The file exists and is non-empty
2. The header contains the correct project_name, intent, and timestamp
3. Count `### DA-` sections in the written file and compare to SCOPE.md DA count
4. Verify each DA section contains the required subsections (Decision, Evidence, Trade-offs, Confidence)

If post-write verification fails on any check, display the specific failure and attempt to fix the content before re-writing. Do not proceed to the next step with a malformed DESIGN.md.

### Step 6: Generate HANDOFF.md (Product Intent Only)

**Step tracking:** Update `current_step` in state.yml (backup-before-write):
1. Read `.expedite/state.yml`
2. Backup: `cp .expedite/state.yml .expedite/state.yml.bak` (via Bash)
3. Set `current_step` to `{skill: "design", step: 6, label: "Generate HANDOFF.md (Product Intent Only)"}`
4. Set `last_modified` to current timestamp
5. Write the entire file back

Check the `intent` value from state.yml (loaded in Step 2).

**If intent is "engineering":** Skip this step entirely. Display: "Engineering intent — no HANDOFF.md needed. Proceeding to revision cycle." Then proceed to Step 7.

**If intent is "product":** Generate HANDOFF.md as a distillation of DESIGN.md. HANDOFF.md references DESIGN.md for deeper rationale — it is NOT a standalone document. Engineers reading HANDOFF.md can follow cross-references to DESIGN.md for full context and evidence.

**Audience:** Individual engineers who will implement the design decisions.

**HANDOFF.md has 9 sections (100-200 words each, ~1500 words total):**

1. **Problem Statement** — Compressed from DESIGN.md Problem Statement section. 100-150 words. End with: "See DESIGN.md § Problem Statement for full evidence basis."

2. **Key Decisions** — List each DA's decision as a one-liner with confidence level. These are LOCKED constraints from the design. Format: `DA-N: {decision summary} (Confidence: {High/Medium/Low})`. End with: "See DESIGN.md § Design Decisions for rationale and evidence."

3. **Scope Boundaries** — In/out of scope, compressed from DESIGN.md. 50-100 words.

4. **Success Metrics** — Observable, measurable metrics from DESIGN.md. Bulleted list.

5. **User Flows** — Compressed from DESIGN.md User Flows. Key flows only, not exhaustive.

6. **Acceptance Criteria** — Testable Given/When/Then format derived from design decisions. Each criterion traces to a DA.

7. **Assumptions and Constraints** — Technical implications of product decisions. Include any implementation suggestions where research evidence supports them.

8. **Suggested Engineering Questions** — Seed questions for an engineering lifecycle if one follows. Derived from Open Questions in DESIGN.md plus any gaps flagged during design.

9. **Priority Ranking for Trade-offs** — Guidance on what to prioritize when trade-offs arise during implementation. Ordered list.

Each section should include explicit cross-references to DESIGN.md sections (e.g., "See DESIGN.md § Design Decisions by DA for full rationale").

**Document header:**
```markdown
# Product Handoff: {project_name}
Generated: {ISO 8601 UTC timestamp}
Intent: Product → Engineering Handoff
Source: DESIGN.md
Full design: .expedite/design/DESIGN.md
```

Write to `.expedite/design/HANDOFF.md`.

**Post-generation display:**
```
HANDOFF.md written to .expedite/design/HANDOFF.md ({word_count} words, 9 sections)
```

**Length validation:** If HANDOFF.md is longer than DESIGN.md, display warning:
```
WARNING: HANDOFF.md ({handoff_words} words) is longer than DESIGN.md ({design_words} words). HANDOFF.md should be a concise distillation. Consider trimming.
```

Proceed to Step 7.

### Step 7: Revision Cycle

**Step tracking:** Update `current_step` in state.yml (backup-before-write):
1. Read `.expedite/state.yml`
2. Backup: `cp .expedite/state.yml .expedite/state.yml.bak` (via Bash)
3. Set `current_step` to `{skill: "design", step: 7, label: "Revision Cycle"}`
4. Set `last_modified` to current timestamp
5. Write the entire file back

Present the design document to the user for review. This is a freeform revision loop with no hard round limit — the user keeps revising until satisfied, then proceeds to gate evaluation.

**7a: Present design for review.** Display:

```
--- Design Review ---

The design document has been written to .expedite/design/DESIGN.md
{If product intent:} HANDOFF.md has been written to .expedite/design/HANDOFF.md

Review the design document above. You can:
- **revise** — describe changes you'd like (e.g., "change DA-3 to use approach B", "strengthen the caching rationale in DA-5")
- **proceed** — run G3 gate evaluation on the current design

What would you like to do?
```

Wait for user input.

**7b: On "revise" (user provides feedback):**

1. Parse the user's freeform feedback. Identify which DAs or sections they want changed.
2. Apply the changes to the in-memory design document.
3. **Summarize changes before rewriting.** Display a change summary:

```
Changes applied:
- DA-{N}: {brief description of change}
- DA-{M}: {brief description of change}
- {Section}: {brief description of change}
```

4. Rewrite `.expedite/design/DESIGN.md` with the updated content.
5. If product intent AND changes affect sections mirrored in HANDOFF.md (Problem Statement, Key Decisions, Scope Boundaries, Success Metrics, User Flows), also rewrite `.expedite/design/HANDOFF.md` with corresponding updates.
6. Re-validate DA coverage: verify every DA from SCOPE.md still has a section in the updated DESIGN.md. If any DA section was accidentally removed during revision, display warning and restore it.
7. Return to 7a — present the revision prompt again.

**7c: On "proceed" (user wants gate evaluation):**

Display: "Proceeding to G3 gate evaluation..."

Proceed to Step 8.

**Key behaviors:**
- No round counter displayed. No "you have N revisions remaining" messaging.
- Every iteration of the loop presents both "revise" and "proceed" options.
- Interpret "looks good", "done", "approved", "no changes", "yes", "lgtm" as "proceed" — do NOT ask for more revisions when the user signals satisfaction.
- Interpret "skip" or "skip to gate" as "proceed".
- If user feedback is ambiguous (cannot determine which DAs or sections to change), ask for clarification rather than guessing.

### Step 8: G3 Gate Evaluation

**Step tracking:** Update `current_step` in state.yml (backup-before-write):
1. Read `.expedite/state.yml`
2. Backup: `cp .expedite/state.yml .expedite/state.yml.bak` (via Bash)
3. Set `current_step` to `{skill: "design", step: 8, label: "G3 Gate Evaluation"}`
4. Set `last_modified` to current timestamp
5. Write the entire file back

Read `.expedite/design/DESIGN.md` and `.expedite/scope/SCOPE.md` (for DA reference).

Evaluate the design document with explicit anti-bias instructions: **"Evaluate as if someone else produced this design. For each criterion, state the specific evidence from the artifact that supports your pass/fail determination."**

**MUST criteria (all must pass for Go):**

| # | Criterion | How to Check | Result |
|---|-----------|-------------|--------|
| M1 | Every DA has a design decision | Count DAs in SCOPE.md, count `### DA-` sections in DESIGN.md. State: "Found {N}/{M} DAs covered" | PASS/FAIL |
| M2 | Every decision references evidence | For each DA section, check for evidence citations (evidence file references or SYNTHESIS.md finding references). State: "{N}/{M} decisions cite evidence" | PASS/FAIL |
| M3 | Correct format for intent | Check document structure matches PRD (product) or RFC (engineering) required sections from design guide. State: "Found {N}/{M} required sections" | PASS/FAIL |
| M4 | DESIGN.md exists and is non-empty | File exists and has substantive content (not just headers). State: "DESIGN.md: {line_count} lines" | PASS/FAIL |

**SHOULD criteria (failures produce advisory, not block):**

| # | Criterion | How to Check | Result |
|---|-----------|-------------|--------|
| S1 | Trade-offs articulated for each DA | Check each DA section has trade-offs content (not just "we chose X"). State: "{N}/{M} DAs have trade-offs" | PASS/ADVISORY |
| S2 | Confidence levels assigned per DA | Each DA decision has High/Medium/Low confidence. State: "{N}/{M} DAs have confidence" | PASS/ADVISORY |
| S3 | Open questions section is genuine | Check Open Questions contains genuine uncertainties (not manufactured padding). Use LLM judgment. | PASS/ADVISORY |
| S4 | HANDOFF.md exists (product intent only) | If intent == product, check `.expedite/design/HANDOFF.md` exists with 9 sections. If engineering, auto-PASS. | PASS/ADVISORY |

Display gate results:
```
--- G3 Gate Evaluation ---
(Evaluated as if produced by someone else)

MUST Criteria:
  M1: {PASS|FAIL} — {evidence}
  M2: {PASS|FAIL} — {evidence}
  M3: {PASS|FAIL} — {evidence}
  M4: {PASS|FAIL} — {evidence}

SHOULD Criteria:
  S1: {PASS|ADVISORY} — {evidence}
  S2: {PASS|ADVISORY} — {evidence}
  S3: {PASS|ADVISORY} — {evidence}
  S4: {PASS|ADVISORY} — {evidence}

Gate Outcome: {Go | Go-with-advisory | Recycle}
```

**Gate outcomes:**
- **Go**: All MUST pass AND all SHOULD pass
- **Go-with-advisory**: All MUST pass, one or more SHOULD failures
- **Recycle**: Any MUST criterion fails
- **Override**: Only when user explicitly requests it (not auto-determined)

**Log gate outcome to telemetry** (after evaluation, before outcome routing):
```bash
cat >> .expedite/log.yml << 'LOG_EOF'
---
event: gate_outcome
timestamp: "{ISO 8601 UTC}"
lifecycle_id: "{lifecycle_id}"
gate: "G3"
outcome: "{go|go_advisory|recycle|override}"
must_passed: {N}
must_failed: {N}
should_passed: {N}
should_failed: {N}
LOG_EOF
```

Proceed to Step 9.

### Step 9: Gate Outcome Handling

**9a: Record gate history.** Append to `gate_history` in state.yml (backup-before-write). In the same write, also set `current_step` to `{skill: "design", step: 9, label: "Gate Outcome Handling"}`:

```yaml
- gate: "G3"
  timestamp: "{ISO 8601 UTC}"
  outcome: "{go|go_advisory|recycle|override}"
  must_passed: {count}
  must_failed: {count}
  should_passed: {count}
  should_failed: {count}
  notes: "{brief summary}"
  overridden: false
```

**9b: Route by outcome:**

**Go** — Display "G3 gate passed. Design is ready for planning." Proceed to Step 10.

**Go-with-advisory** — Show user which SHOULD criteria failed. Display: "Design passed with advisories. These will be noted in the plan phase." Present via freeform prompt: "1. Proceed with advisory | 2. Revise to address advisories". If proceed, proceed to Step 10. If revise, return to Step 7 (revision cycle).

**Recycle** — Count previous G3 recycle outcomes in gate_history (entries where `gate` = `"G3"` AND `outcome` = `"recycle"`).

- **1st Recycle (recycle_count == 0):** Informational tone. Display which MUST criteria failed with specific evidence. Offer via freeform prompt: "1. Revise (fix the issues above) | 2. Override (proceed with documented gaps)". If revise, return to Step 7 with the gate feedback visible. If override, proceed to 9c.

- **2nd Recycle (recycle_count == 1):** Suggest adjustment. Display: "This is the second G3 recycle. Consider whether the design scope needs adjustment." Show persistently failing criteria. Offer: "1. Revise | 2. Override (recommended if same criteria keep failing)". If revise, return to Step 7. If override, proceed to 9c.

- **3rd+ Recycle (recycle_count >= 2):** Recommend override. Display: "This is recycle #{recycle_count + 1}. Recommend overriding the gate. Remaining issues may require scope adjustment rather than design revision." Offer: "1. Override (recommended) | 2. One more attempt (not recommended)". If override, proceed to 9c. If attempt, return to Step 7.

**9c: Override handling.**

1. Update gate_history entry: set `overridden: true`, update `outcome` to `"override"`.
2. Determine severity based on MUST failures: low (0 MUST failures — user-initiated override), medium (1 MUST failure), high (2+ MUST failures).
3. Write `.expedite/design/override-context.md`:

```markdown
# G3 Override Context

Timestamp: {ISO 8601 UTC}
Severity: {low|medium|high}
Recycle count: {N}

## Overridden Issues

{For each failed MUST criterion:}
- {criterion_id}: {criterion description}
  Evidence: {what the gate found}
  Impact: {which DAs are affected}

## Plan Phase Advisory

The following design quality issues were overridden. The plan phase should
account for these gaps when creating tasks.
{List affected criteria and recommendations}
```

4. Log override event:
   ```bash
   cat >> .expedite/log.yml << 'LOG_EOF'
   ---
   event: override
   timestamp: "{ISO 8601 UTC}"
   lifecycle_id: "{lifecycle_id}"
   gate: "G3"
   severity: "{low|medium|high}"
   must_failed: {N}
   affected_das: ["{affected DA names}"]
   LOG_EOF
   ```

5. Proceed to Step 10.

### Step 10: Design Completion

Update state.yml (backup-before-write): set `phase` to `"design_complete"`, set `current_step` to null, update `last_modified`.

**Log phase transition:**
```bash
cat >> .expedite/log.yml << 'LOG_EOF'
---
event: phase_transition
timestamp: "{ISO 8601 UTC}"
lifecycle_id: "{lifecycle_id}"
from_phase: "design_in_progress"
to_phase: "design_complete"
LOG_EOF
```

Display design completion summary:

```
## Design Complete

Project: {project_name}
Intent: {intent}

### Artifacts Produced
- Design: .expedite/design/DESIGN.md
{If product intent:} - Handoff: .expedite/design/HANDOFF.md
{If override:} - Override context: .expedite/design/override-context.md

### Gate Results
G3 outcome: {outcome}
MUST: {passed}/{total} | SHOULD: {passed}/{total}
{If advisory:} Advisories: {list SHOULD failures}
{If override:} Override severity: {severity}

### Contract Chain
Scope -> Research -> Design (complete)
Decision Areas: {N} designed | Evidence citations: {count}

### Next Step
Run `/expedite:plan` to generate an implementation plan from the design.
```
