# Phase 4: Scope Skill - Research

**Researched:** 2026-03-02
**Domain:** Interactive scoping skill implementation for Claude Code plugin (SKILL.md orchestration logic, state initialization, question plan generation, G1 gate evaluation)
**Confidence:** HIGH

## Summary

Phase 4 transforms the existing scope SKILL.md stub into a fully functional interactive orchestration skill. This is the first phase that implements RUNTIME BEHAVIOR -- all prior phases created static files (plugin manifest, state templates, prompt templates). The scope skill is the entry point for the entire Expedite lifecycle and the origin of the contract chain described in the decision-over-task pattern: every decision area, evidence requirement, and readiness criterion defined here flows downstream through research, design, plan, and execution as typed contracts.

The implementation has three distinct concerns: (1) the interactive conversation flow that collects user context and intent through freeform prompts, (2) the question plan generation logic that uses the existing `prompt-scope-questioning.md` inline reference to produce structured output, and (3) the G1 structural gate that validates completeness before transitioning to `scope_complete`. All three concerns execute in the main session -- no subagents. The skill must also handle lifecycle initialization (creating `.expedite/` directory structure, copying templates, initializing state.yml) and the edge case of an existing lifecycle (archive-and-restart flow).

A critical design constraint is that most user interaction uses freeform prompts (not AskUserQuestion) due to the 60-second timeout limitation. The one exception is the cross-lifecycle import decision (IMPORT-01 through IMPORT-04), which is a v2 feature but the skill stub should be architecturally aware of it. Source configuration (SCOPE-06) is assigned to Phase 10 per the requirements traceability matrix, so this phase implements a simplified version or defers it.

**Primary recommendation:** Implement the scope SKILL.md as a 9-step orchestration flow matching PRODUCT-DESIGN.md section 4.1 ("/arc:scope"), with all steps adapted from the "arc" namespace to the "expedite" namespace and `.arc/` to `.expedite/`. The skill body is pure Markdown instructions that guide the main session LLM through the flow -- no external scripts, no build tools. The `prompt-scope-questioning.md` reference (already created in Phase 3) provides the WHAT (structure, quality criteria); Phase 4 provides the HOW (interactive flow, state management, gate evaluation).

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| SCOPE-01 | User answers 5-8 interactive questions to define the lifecycle goal and context | PRODUCT-DESIGN.md steps 4-5: Round 1 (3 context questions) + Round 2 (3 intent-specific refinement questions) = 6 questions minimum. Freeform prompts avoid AskUserQuestion timeout. Pattern: display question as output, user responds naturally. |
| SCOPE-02 | Intent (product or engineering) detected via freeform prompt parsing | PRODUCT-DESIGN.md step 4 bullet 2: user types naturally, orchestrator parses for intent keywords. Implementation: SKILL.md instructs the LLM to parse the response for product/engineering indicators and confirm interpretation. |
| SCOPE-03 | Structured question plan generated with priorities (P0/P1/P2), decision areas (DA-1 through DA-N), and source hints | PRODUCT-DESIGN.md step 6 + prompt-scope-questioning.md: the inline reference defines the complete question structure (DA with depth/readiness, questions with priority/source_hints/evidence_requirements). The SKILL.md orchestrates generation using this reference. |
| SCOPE-04 | Question plan presented for user review before any research tokens are spent ("Terraform plan-apply" preview) | PRODUCT-DESIGN.md step 6: the "--- Question Plan Preview ---" format is specified exactly. User sees the plan and chooses: yes / modify / add questions. No research tokens spent until approval. |
| SCOPE-05 | User can modify question plan (add, remove, reprioritize) before approval | PRODUCT-DESIGN.md step 6: "User can approve, modify, or add questions." Implementation: freeform prompt loop -- user describes changes, LLM applies them, re-presents the plan. Loop until "yes." |
| SCOPE-06 | Source configuration step: confirm default sources or edit sources.yml | Traceability matrix assigns to Phase 10. However, PRODUCT-DESIGN.md step 7 defines a source confirmation step. Research finding: implement a SIMPLIFIED read-only display of current sources (from sources.yml.template defaults) with "Use these? (yes)" confirmation. Full edit capability deferred to Phase 10. |
| SCOPE-07 | G1 gate validates scope completeness (structural gate -- all required fields present, at least 1 P0 question, every question has evidence requirements) | PRODUCT-DESIGN.md step 9: 6 MUST criteria + 3 SHOULD criteria, all deterministic/structural. Gate is inline (evaluated by the same LLM session). G1 has only Go and Hold outcomes (no Recycle for scope). |
| SCOPE-08 | SCOPE.md artifact written to `.expedite/scope/SCOPE.md` with full question plan, evidence requirements, readiness criteria, and metadata | PRODUCT-DESIGN.md step 8: write artifact after user approval. SCOPE.md is the data-plane document; state.yml is the control-plane document. Both updated simultaneously. |
| SCOPE-09 | Each question/DA defines evidence requirements -- what specific evidence would constitute a sufficient answer | prompt-scope-questioning.md instructions section: evidence requirements must be "concrete and checkable" with good/bad examples. Contract chain origin: these requirements become typed targets for research agents. |
| SCOPE-10 | Each DA defines a readiness criterion -- how to know when enough evidence exists to make a design decision | prompt-scope-questioning.md DA structure: "A concrete statement of what evidence is needed to make a design decision for this DA. Must be checkable." |
| SCOPE-11 | Each DA has a depth calibration (Deep/Standard/Light) that sets evidence count expectations for research | prompt-scope-questioning.md DA structure: Deep (2+ corroborating sources), Standard (at least 2 for key requirements), Light (single credible source). |
| GATE-01 | Every phase transition guarded by inline gate (G1-G4) evaluated in the producing skill | PRODUCT-DESIGN.md decision #1: "Producing skill evaluates its own output." For Phase 4, this means G1 is evaluated inside the scope SKILL.md before writing `scope_complete`. |
| GATE-02 | Each gate has MUST criteria (all must pass for Go) and SHOULD criteria (failures produce advisory) | PRODUCT-DESIGN.md step 9: G1 has 6 MUST and 3 SHOULD. All MUST pass = Go. Any MUST fail = Hold. SHOULD failures produce advisory notes. |
| GATE-06 | G1 is structural (deterministic); G2 and G3 require LLM judgment; G4 is structural | G1 checks are all deterministic: file existence, count checks, field presence. No LLM judgment needed for G1 MUST criteria. |
| ARTF-01 | Each phase produces Markdown artifacts in `.expedite/` subdirectories | Scope produces `.expedite/scope/SCOPE.md`. The SKILL.md must create the `scope/` subdirectory if it does not exist. |
| ARTF-02 | Artifact paths: scope/SCOPE.md, research/SYNTHESIS.md, design/DESIGN.md, plan/PLAN.md, execute/PROGRESS.md | Scope's artifact path is `.expedite/scope/SCOPE.md`. This is the canonical location referenced by all downstream phases. |
</phase_requirements>

## Standard Stack

### Core

This phase creates and modifies Markdown and YAML files using the tools already available to the skill. No external libraries, frameworks, or build tools are needed.

| Component | Format | Purpose | Why Standard |
|-----------|--------|---------|--------------|
| SKILL.md orchestration | Markdown with YAML frontmatter | Skill body containing the 9-step interactive flow | Claude Code plugin architecture standard. The LLM reads SKILL.md body as instructions and executes them. Proven in the status skill (Phase 2). |
| prompt-scope-questioning.md | Markdown inline reference (no frontmatter) | Loaded by SKILL.md to guide question plan generation | Already created in Phase 3. Defines WHAT (structure, quality). SKILL.md provides HOW (interactive flow). |
| state.yml | YAML with 2-level max nesting | Control plane -- tracks phase, questions, gate history | Template created in Phase 2. Schema defined in PRODUCT-DESIGN.md. Backup-before-write pattern established. |
| SCOPE.md | Markdown | Data plane -- human-readable question plan artifact | Specified in PRODUCT-DESIGN.md step 8. Read by research SKILL.md in Phase 5. |
| sources.yml | YAML | Source configuration (read-only in Phase 4) | Template created in Phase 2. Full edit deferred to Phase 10. |
| Freeform prompts | Natural language output | User interaction mechanism | Decision #23: freeform prompt avoids AskUserQuestion 60-second timeout. All 3 design proposals converged. |

### Supporting

| Pattern | Purpose | When to Use |
|---------|---------|-------------|
| `!cat .expedite/state.yml` | Dynamic context injection | Already in SKILL.md frontmatter (Phase 1). Loads state on skill invocation. |
| Backup-before-write | State safety | Every state.yml write: read, cp to .bak, modify in-memory, write entire file. Established in Phase 2. |
| `{{double_braces}}` | Template variable placeholders | In prompt-scope-questioning.md for dynamic content (project_name, intent, user_context). Resolved by LLM during orchestration. |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Freeform prompts for all interaction | AskUserQuestion for structured choices | 60-second timeout makes AskUserQuestion unsuitable for scope's conversational flow. Exception: import decisions (v2) can use AskUserQuestion because they are discrete choices. |
| Single monolithic SKILL.md | Split into SKILL.md + separate orchestration script | SKILL.md is the orchestration script. No external dependencies. The LLM follows Markdown instructions. Splitting adds complexity with no benefit. |
| LLM generates question plan from scratch | Use prompt-scope-questioning.md as reference | Already decided in Phase 3. The reference provides structure and quality criteria. The LLM uses it as a guide, not a rigid template. |

## Architecture Patterns

### Recommended Project Structure

No new directories are created in the plugin itself. Phase 4 modifies one existing file:

```
skills/
  scope/
    SKILL.md                              # MODIFIED: stub -> full orchestration logic
    references/
      prompt-scope-questioning.md         # EXISTS: created in Phase 3 (no changes)
```

At runtime, the skill creates the user's project directory:

```
.expedite/                                # CREATED by scope skill
  state.yml                               # CREATED from template
  state.yml.bak                           # CREATED on first state write
  sources.yml                             # CREATED from template (if not exists)
  .gitignore                              # CREATED from template
  scope/
    SCOPE.md                              # CREATED after question plan approval
```

### Pattern 1: SKILL.md as Orchestration Script

**What:** The SKILL.md body is a numbered sequence of instructions that the main session LLM executes step by step. Each step describes WHAT to do (check state, ask the user, generate content, write files) and HOW to do it (which tools, what format, what conditions). The LLM reads these instructions and follows them as a procedure.

**When to use:** For all skills that run in the main session (scope, design, plan, execute, status).

**Implementation pattern:**
```markdown
---
name: scope
description: >
  [trigger phrases]
allowed-tools:
  - Read
  - Write
  - Glob
  - Bash
  - AskUserQuestion
argument-hint: "[project-description]"
---

Current lifecycle state:
!`cat .expedite/state.yml 2>/dev/null || echo "No active lifecycle"`

# Scope Skill

[Role statement and purpose]

## Instructions

### Step 1: [Name]
[Detailed instructions for what to do]
[Conditions and branching logic]
[Tool usage guidance]

### Step 2: [Name]
...
```

**Source:** Status SKILL.md (Phase 2) establishes this pattern. PRODUCT-DESIGN.md step-by-step orchestration flow validates the approach.

### Pattern 2: Freeform Prompt Interaction Loop

**What:** The skill displays a question or prompt as output text, then the user responds naturally in their next message. The LLM parses the response and either proceeds or asks follow-up. This avoids AskUserQuestion's 60-second timeout.

**When to use:** For all multi-turn user interactions in scope (context questions, intent detection, plan review/modification).

**Implementation:**
```markdown
### Step 4: Interactive Questioning (Round 1)

Ask the user the following questions. Present each question as a clear prompt and wait for the user's response before proceeding to the next question.

**Question 1:** "What is the project name?"
- Store the response as the `project_name`

**Question 2:** "Is this a product or engineering investigation?"
- The user will respond naturally (not necessarily "product" or "engineering")
- Parse their response for intent indicators:
  - Product indicators: "product", "PM", "PRD", "users", "market", "customer"
  - Engineering indicators: "engineering", "technical", "architecture", "implementation", "refactor"
- If unclear, confirm: "I interpreted this as [product/engineering] intent. Is that correct?"
- Store as `intent`

**Question 3:** "Describe what you want to accomplish in 2-3 sentences."
- Store as `description`
```

**Source:** PRODUCT-DESIGN.md decision #23 (freeform prompt). Status skill demonstrates the LLM-follows-instructions pattern.

### Pattern 3: Question Plan Review Loop

**What:** After generating the question plan, present it in the specified preview format and enter a review loop: the user can approve ("yes"), request modifications ("modify" + description of changes), or add questions ("add" + new question descriptions). The LLM applies changes and re-presents until approved.

**When to use:** PRODUCT-DESIGN.md step 6, the "Terraform plan-apply" preview.

**Implementation:**
```markdown
### Step 6: Question Plan Generation and Review

1. Using the collected context (project_name, intent, description, refinement answers),
   generate a question plan following the structure defined in the
   `references/prompt-scope-questioning.md` guide.

2. Present the plan in this exact format:
   ```
   --- Question Plan Preview ---

   DA-1: [Name] ([Depth])
   Readiness: [criterion]
     [P0] q01: [question] ([sources])
       Evidence needed: [requirements]
   ...
   --- [N] questions across [M] DAs, estimated [K] research batches ---
   Proceed? (yes / modify / add questions)
   ```

3. Wait for user response:
   - "yes" or approval: proceed to Step 7
   - "modify" + changes: apply modifications, re-present plan, loop
   - "add" + questions: add to plan, re-present, loop
   - If user response is ambiguous, ask for clarification
```

**Source:** PRODUCT-DESIGN.md step 6.

### Pattern 4: State Initialization from Templates

**What:** On first invocation (no `.expedite/` directory), the skill creates the directory structure and copies template files from the plugin's `templates/` directory. The skill uses `Bash` to create directories and `Read`/`Write` to copy template contents.

**When to use:** PRODUCT-DESIGN.md step 3.

**Implementation:**
```markdown
### Step 3: Initialize Lifecycle

If no active lifecycle exists (or user chose to archive the old one):

1. Create `.expedite/` directory if it does not exist:
   ```bash
   mkdir -p .expedite/scope
   ```

2. Read the state template from the plugin:
   - Use Glob to find `**/templates/state.yml.template` (resolves plugin path)
   - Read the template content
   - Set initial values: phase="scope_in_progress", last_modified=current timestamp
   - Write to `.expedite/state.yml`

3. Copy sources.yml template (only if `.expedite/sources.yml` does not already exist):
   - Read `**/templates/sources.yml.template`
   - Write to `.expedite/sources.yml`

4. Copy gitignore template:
   - Read `**/templates/gitignore.template`
   - Write to `.expedite/.gitignore`
```

**Source:** PRODUCT-DESIGN.md step 3. Templates created in Phase 2.

### Pattern 5: Inline Structural Gate (G1)

**What:** After writing SCOPE.md and updating state.yml, the skill evaluates G1 criteria by reading the artifacts it just wrote. All criteria are structural (file existence, field counts, field presence) -- no LLM judgment needed. The gate is evaluated inline (same LLM session, not a subagent).

**When to use:** PRODUCT-DESIGN.md step 9.

**Implementation:**
```markdown
### Step 9: Gate G1 Evaluation

Evaluate each criterion against the artifacts just written:

**MUST criteria (all must pass for Go):**
1. `.expedite/scope/SCOPE.md` exists and is non-empty -- check file
2. At least 3 questions defined -- count questions in state.yml
3. Intent declared (product or engineering) -- check `intent` field in state.yml
4. At least one success criterion defined -- search SCOPE.md for success criteria section
5. Every question has evidence_requirements defined -- check each question in state.yml
6. Every DA has a readiness criterion and depth calibration -- check SCOPE.md DA metadata

**SHOULD criteria (failures produce advisory):**
1. Questions have source_hints -- check each question
2. Questions span at least 2 decision areas -- count unique decision_area values
3. No more than 15 questions -- count questions

**Gate outcome:**
- All MUST pass -> Go: write phase="scope_complete" to state.yml, record G1 in gate_history
- Any MUST fail -> Hold: display which criteria failed, offer to fix inline
  (Scope is interactive, so the user can fix issues immediately and re-evaluate)
- Record gate result in state.yml gate_history array
```

**Source:** PRODUCT-DESIGN.md step 9. GATE-01, GATE-02, GATE-06 requirements.

### Anti-Patterns to Avoid

- **Using AskUserQuestion for conversational questions:** The 60-second timeout will interrupt the scope's multi-turn conversation. Use freeform prompts. Only use AskUserQuestion for discrete structured choices (like the v2 import decision).
- **Generating the question plan without the inline reference:** The `prompt-scope-questioning.md` reference defines quality criteria (evidence requirements must be checkable, not vague). The SKILL.md MUST instruct the LLM to read and follow this reference when generating the plan.
- **Writing SCOPE.md before user approval:** The "Terraform plan-apply" pattern means no artifacts are written until the user explicitly approves. The review loop must complete before Step 8.
- **Storing DA-level metadata in state.yml:** The design spec explicitly says "DA-level metadata (readiness criterion, depth) lives in SCOPE.md (not state.yml, to respect the flat structure constraint)." Only question-level data goes in state.yml.
- **Making G1 use LLM judgment:** G1 is structural/deterministic (GATE-06). All checks are counts, field existence, and string matching. Do not introduce subjective evaluation.
- **Hardcoding the plugin path:** Use `Glob` with patterns like `**/templates/state.yml.template` to dynamically resolve the plugin's location. The plugin could be installed at different paths.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Question plan structure | A custom schema definition | prompt-scope-questioning.md inline reference | Already created in Phase 3. Defines DA structure, question structure, quality criteria, intent-specific guidance. |
| State initialization | A setup script or CLI tool | SKILL.md instructions using Read/Write/Bash | The LLM follows instructions to create directories and copy templates. No external dependencies. |
| Intent detection | A keyword classifier or NLP model | LLM parsing with confirmation | The LLM naturally understands intent from freeform text. Decision #23 validates this approach. |
| YAML manipulation | A YAML parsing library | Complete-file rewrite pattern | State.yml is small (<100 lines). The LLM reads it, modifies the in-memory representation, writes the entire file. Backup-before-write provides safety. Pattern established in Phase 2. |
| Gate evaluation | A separate gate skill or script | Inline structural checks in the SKILL.md | Decision #1: inline gates. G1's criteria are simple counts and field checks that the LLM can evaluate directly. |
| Template variable resolution | A template engine (Handlebars, Mustache) | LLM-based substitution | The LLM reads `{{project_name}}` and substitutes the actual value. No build step. Pattern established in Phase 3 research. |

**Key insight:** The scope skill is a set of instructions for the LLM to follow. The "runtime" is Claude reading the SKILL.md body and executing the steps. There is no compiled code, no scripts, no external dependencies. The skill's sophistication comes from the QUALITY of the instructions, not from the COMPLEXITY of the tooling.

## Common Pitfalls

### Pitfall 1: Context Loss Between Scope Steps

**What goes wrong:** The scope skill has 9 steps spread across multiple user interactions. If the user's responses are long or the conversation grows, earlier context (project name, intent, description) may be pushed out of the LLM's effective attention window.
**Why it happens:** Claude Code skills run in a single conversation. The skill instructions plus all user responses accumulate in the context. For a complex scoping session, this could reach 10-20K tokens.
**How to avoid:** After collecting Round 1 and Round 2 answers, write a structured summary to state.yml immediately (step 3 initializes state, steps 4-5 update it progressively). Before generating the question plan (step 6), re-read state.yml to have all collected context in a compact form. The dynamic context injection (`!cat .expedite/state.yml`) provides the foundation.
**Warning signs:** Generated question plan does not reflect user's stated intent or description. Questions are generic rather than specific to the project.

### Pitfall 2: Question Plan Quality Degradation

**What goes wrong:** The LLM generates a question plan with vague evidence requirements ("research the topic thoroughly"), uncheckable readiness criteria ("enough evidence"), or priorities that do not match the project's actual needs.
**Why it happens:** The LLM defaults to generic patterns without specific quality enforcement. The prompt-scope-questioning.md reference may not be loaded or followed closely enough.
**How to avoid:** The SKILL.md MUST explicitly instruct the LLM to: (1) read the `references/prompt-scope-questioning.md` guide before generating the plan, (2) self-check against the quality criteria in the reference's `<quality_gate>` section, (3) re-examine each evidence requirement against the "GOOD/BAD" examples in the reference. The self-check should happen BEFORE presenting to the user, not after.
**Warning signs:** Evidence requirements use words like "thorough", "sufficient", "comprehensive" without concrete criteria. Readiness criteria are not checkable.

### Pitfall 3: G1 Gate Always Passes

**What goes wrong:** The gate evaluation is perfunctory -- the LLM checks its own output and declares all criteria met without genuine evaluation.
**Why it happens:** Self-grading bias (the agent evaluating its own output is biased toward approval). Identified as Pitfall P2 in Phase 3 research.
**How to avoid:** G1 is structural, so most checks are objective (count questions, check field existence). Include explicit instructions: "Read state.yml and SCOPE.md. For each MUST criterion, state the specific evidence (e.g., 'Found 7 questions in state.yml, meets minimum of 3'). If any criterion fails, STOP and report the failure." The structural nature of G1 makes this less risky than G2/G3 (which require judgment), but the instruction should still require per-criterion evidence.
**Warning signs:** Gate evaluation output is a single line ("All criteria pass") without per-criterion evidence.

### Pitfall 4: Scope Resume After Interruption

**What goes wrong:** User's session is interrupted mid-scope (after some questions answered but before plan approval). On re-invocation, the skill starts over from scratch, losing collected context.
**Why it happens:** The skill checks `phase: "scope_in_progress"` but does not have explicit resume logic.
**How to avoid:** The SKILL.md should include resume detection: if state.yml exists with `phase: "scope_in_progress"` AND `project_name` is set, display a summary of what has been collected and ask "Continue from where you left off? (yes / start over)". The progressive state writing (after each round of questions) provides the resume data.
**Warning signs:** User re-invokes scope and has to re-answer all questions. State.yml has partial data that gets overwritten.

### Pitfall 5: Namespace Confusion (arc vs expedite)

**What goes wrong:** The SKILL.md references `.arc/` paths, `/arc:` commands, or "arc" terminology instead of `.expedite/` and `/expedite:`.
**Why it happens:** PRODUCT-DESIGN.md uses the "arc" namespace throughout. The implementation renamed to "expedite". Copy-paste from design spec without translation.
**How to avoid:** The plan must explicitly call out EVERY instance where "arc" is used in the design spec and map it to "expedite". Systematic search-and-replace during implementation: `.arc/` -> `.expedite/`, `/arc:` -> `/expedite:`, "arc" -> "expedite" in user-facing text. The existing Phase 1-3 implementations already use "expedite" consistently.
**Warning signs:** SKILL.md contains mixed references to both "arc" and "expedite".

## Code Examples

### Example 1: Scope SKILL.md Frontmatter and Context Injection

```yaml
---
name: scope
description: >
  This skill should be used when the user wants to "start a new project lifecycle",
  "define project scope", "scope out research questions", "begin expedite",
  "new expedite project", "what should we research", or needs to decompose a
  high-level goal into structured decision areas with evidence requirements
  before beginning research.
allowed-tools:
  - Read
  - Write
  - Glob
  - Bash
  - AskUserQuestion
argument-hint: "[project-description]"
---

Current lifecycle state:
!`cat .expedite/state.yml 2>/dev/null || echo "No active lifecycle"`
```

This frontmatter is ALREADY CORRECT in the existing stub (Phase 1). Phase 4 does not modify the frontmatter -- only the body below it.

**Source:** Existing `skills/scope/SKILL.md` (Phase 1 output)

### Example 2: State.yml After Scope Completion

```yaml
version: "1"
last_modified: "2026-03-02T15:30:00Z"

project_name: "auth-redesign"
intent: "engineering"
lifecycle_id: "auth-redesign-20260302"

phase: "scope_complete"
current_task: null

imported_from: null
constraints: []

research_rounds: 0

questions:
  - id: "q01"
    text: "How does OAuth2 PKCE flow work in mobile apps?"
    priority: "P0"
    decision_area: "authentication"
    source_hints: ["web", "codebase"]
    evidence_requirements: "2+ implementation examples with security analysis, API docs confirming token refresh"
    status: "pending"
    source: "original"
    gap_details: null
    evidence_files: []
  - id: "q02"
    text: "What is the current auth middleware architecture?"
    priority: "P0"
    decision_area: "authentication"
    source_hints: ["codebase"]
    evidence_requirements: "Code path walkthrough of current auth flow, middleware chain diagram"
    status: "pending"
    source: "original"
    gap_details: null
    evidence_files: []

gate_history:
  - gate: "G1"
    timestamp: "2026-03-02T15:30:00Z"
    outcome: "go"
    must_passed: 6
    must_failed: 0
    should_passed: 3
    should_failed: 0
    notes: null
    overridden: false

tasks: []
current_wave: null
```

**Source:** state.yml.template schema (Phase 2) + PRODUCT-DESIGN.md state schema

### Example 3: SCOPE.md Artifact Structure

```markdown
# Expedite Scope: [Project Name]

**Created:** [timestamp]
**Intent:** [product/engineering]
**Lifecycle ID:** [slug]

## Project Context

[User's description from Round 1-2 questioning]

## Success Criteria

- [Criterion 1]
- [Criterion 2]

## Decision Areas

### DA-1: [Name] (Deep)
**Readiness criterion:** [Concrete, checkable statement]

| ID | Priority | Question | Sources | Evidence Requirements |
|----|----------|----------|---------|----------------------|
| q01 | P0 | [question text] | web, codebase | [specific requirements] |
| q02 | P0 | [question text] | codebase | [specific requirements] |

### DA-2: [Name] (Standard)
**Readiness criterion:** [Concrete, checkable statement]

| ID | Priority | Question | Sources | Evidence Requirements |
|----|----------|----------|---------|----------------------|
| q03 | P1 | [question text] | web | [specific requirements] |

## Source Configuration

- [x] Web (WebSearch, WebFetch) - always available
- [x] Codebase (Grep, Read, Glob, Bash) - always available

## Metadata

- Questions: [N] across [M] DAs
- Estimated research batches: [K]
- Gate G1: [outcome] at [timestamp]
```

**Source:** PRODUCT-DESIGN.md step 8 + prompt-scope-questioning.md output format

### Example 4: G1 Gate History Entry

```yaml
gate_history:
  - gate: "G1"
    timestamp: "2026-03-02T15:30:00Z"
    outcome: "go"
    must_passed: 6
    must_failed: 0
    should_passed: 2
    should_failed: 1
    notes: "SHOULD: questions only span 1 decision area (advisory)"
    overridden: false
```

When SHOULD criteria fail, the `notes` field records what failed. The outcome is still "go" (all MUSTs passed). The "go_advisory" outcome applies when MUSTs pass but SHOULDs fail -- this maps to GATE-02.

**Source:** state.yml.template gate_history schema + PRODUCT-DESIGN.md decision #15

### Example 5: Lifecycle ID Generation

```
lifecycle_id: "{project_name_slugified}-{YYYYMMDD}"

Examples:
  "Auth Redesign" -> "auth-redesign-20260302"
  "My Cool Project" -> "my-cool-project-20260302"
```

The lifecycle_id is used for log correlation and archival slug generation. Generated by lowercasing, replacing spaces/special chars with hyphens, appending date.

**Source:** PRODUCT-DESIGN.md archival section (slug generation)

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| AskUserQuestion for all interaction | Freeform prompts for conversational flow | Design decision #23 | Avoids 60-second timeout. More natural conversation. |
| Separate gate skill | Inline gates in producing skill | Design decision #1 | Simpler. No inter-skill coordination overhead. |
| Numeric sufficiency scoring | Categorical assessment (for G2/G3; G1 is structural) | Research-engine pattern, design decision #25 | More stable LLM judgments. Not directly relevant to G1 but sets pattern for later gates. |
| Multi-agent scope decomposition | Main session scope (no subagents) | Design decision #11 | Scope is interactive. Subagent cannot participate in conversation. |

**Deprecated/outdated:**
- Prefilled responses: No longer supported with Claude 4.6 models. SKILL.md should not rely on prefill patterns.
- `@` file references across skill boundaries: Do not work. All content must be explicitly read and inlined.

## Open Questions

1. **SCOPE-06 implementation depth in Phase 4 vs Phase 10**
   - What we know: The requirements traceability matrix assigns SCOPE-06 to Phase 10. PRODUCT-DESIGN.md step 7 defines a source configuration step within the scope flow.
   - What's unclear: Should Phase 4 implement a read-only source display (show current sources.yml, ask "Use these?") or completely defer source configuration to Phase 10?
   - Recommendation: Implement a simplified read-only display in Phase 4 (read sources.yml, display as checklist, accept "yes" or note "editing available in a future update"). This satisfies the flow described in PRODUCT-DESIGN.md without implementing the full edit capability. The planner should decide the exact boundary.

2. **Archival flow complexity**
   - What we know: PRODUCT-DESIGN.md step 1 defines an archival flow when an existing lifecycle is detected. This involves moving files to `.expedite/archive/{slug}/`, preserving sources.yml and log.yml.
   - What's unclear: How complex should the archival implementation be in Phase 4? Full archival (move files, create archive directory) or minimal (warn and ask user to manually clean up)?
   - Recommendation: Implement full archival as specified. The file operations are straightforward (mkdir, mv via Bash). Deferring creates a worse UX where users must manually manage old lifecycles. The planner should include this as a distinct task.

3. **Resume-after-interruption UX**
   - What we know: PRODUCT-DESIGN.md error handling table says "state.yml at `scope_in_progress` preserves partial progress; next `/arc:scope` resumes."
   - What's unclear: The exact UX for resume. How much context is preserved? Does the user see what was already answered?
   - Recommendation: On resume, display: "Found an in-progress scope for [project_name]. Context collected so far: [summary of what is in state.yml]." Then ask "Continue from here? (yes / start over)". If "yes", skip to the next unanswered step. Progressive state writes (after each round of questions) enable this.

4. **Cross-lifecycle import (v2 feature) -- how much to stub**
   - What we know: PRODUCT-DESIGN.md step 2 defines connected flow artifact detection (scanning for HANDOFF.md/DESIGN.md). IMPORT-01 through IMPORT-04 are v2 requirements. The state.yml template already has reserved `imported_from` and `constraints` fields.
   - What's unclear: Should Phase 4 include any import detection logic, or completely skip step 2?
   - Recommendation: Include a comment in the SKILL.md at step 2's location: "# Step 2: Connected flow import (v2 -- not yet implemented). Proceed to Step 3." This preserves the step numbering and makes the v2 integration point obvious. Do not implement any scanning or import logic.

## Sources

### Primary (HIGH confidence)
- PRODUCT-DESIGN.md `/arc:scope` section (lines 390-500) -- Authoritative specification for all 9 orchestration steps, G1 gate criteria, error handling, intent adaptation
- prompt-scope-questioning.md (`skills/scope/references/`) -- Already-implemented inline reference defining question plan structure, DA format, evidence requirement quality criteria
- state.yml.template (`templates/`) -- Already-implemented state schema with question item schema, gate history schema
- Decision-Over-Task Pattern v2 (`memory/decision-over-task-pattern-v2.md`) -- Philosophical foundation: evidence requirements as typed contracts, contract chain principle, decision-over-task reasoning
- Status SKILL.md (`skills/status/SKILL.md`) -- Existing implementation demonstrating the SKILL.md-as-orchestration-script pattern, dynamic context injection, LLM-based state parsing

### Secondary (MEDIUM confidence)
- PRODUCT-DESIGN.md decisions register (lines 44-74) -- Design decisions #1 (inline gates), #11 (main session scope), #23 (freeform prompts), #29 (AskUserQuestion constraints)
- PRODUCT-DESIGN.md state management section (lines 200-385) -- State write pattern, phase transitions, archival flow
- Phase 3 RESEARCH.md -- Established patterns for template usage, contract chain enforcement, anti-patterns
- REQUIREMENTS.md traceability matrix -- SCOPE-06 assigned to Phase 10 (source configuration edit), all other SCOPE-* to Phase 4

### Tertiary (LOW confidence)
- None. All findings are backed by primary or secondary sources from the project's own design documentation.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- No external libraries. SKILL.md orchestration pattern is proven by status skill (Phase 2). All templates exist from Phases 1-3.
- Architecture: HIGH -- PRODUCT-DESIGN.md specifies the 9-step flow precisely. The inline reference pattern (Phase 3) and state management pattern (Phase 2) are both validated.
- Pitfalls: HIGH -- Context loss, quality degradation, self-grading bias, resume handling, and namespace confusion are all directly derived from Phase 3 research pitfalls and PRODUCT-DESIGN.md error handling section.
- Gate evaluation: HIGH -- G1 criteria are fully specified and structural (no judgment). Implementation is inline checks per GATE-01, GATE-02, GATE-06.

**Research date:** 2026-03-02
**Valid until:** 2026-04-02 (stable domain -- design is locked, implementation patterns are established by prior phases)
