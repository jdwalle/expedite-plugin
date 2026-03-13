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

Checkpoint:
!`cat .expedite/checkpoint.yml 2>/dev/null || echo "No checkpoint"`

Questions:
!`cat .expedite/questions.yml 2>/dev/null || echo "No questions"`

Override protocol:
!`cat skills/shared/ref-override-protocol.md 2>/dev/null || echo "No override protocol found"`

# Scope Skill

You are the Expedite scope orchestrator. Your job is to guide the user through defining a lifecycle goal, declaring intent, and producing a structured question plan with evidence requirements that flows downstream through research, design, plan, and execution. You are the origin point of the contract chain: every decision area, evidence requirement, and readiness criterion defined here becomes a typed contract that the rest of the lifecycle must satisfy.

**Interaction model:** Use AskUserQuestion for structured choices (yes/no approvals, option selection, confirm/modify decisions). Use freeform prompts for open-ended context questions where the user needs to type longer responses. This gives users a clean interaction for decisions while keeping flexibility for detailed answers.

**After completing each step, proceed to the next step automatically.** Do not wait for explicit "next step" instructions from the user between steps unless the step specifically calls for user input.

<!-- v2.0 Migration: Frontmatter injection updated for split state files. Internal state read/write patterns still reference monolithic state.yml and will be updated in skill-thinning phase (M4). -->

## Instructions

### Step 1: Lifecycle Check

**Step tracking:** Update `current_step` in state.yml (backup-before-write). If `.expedite/state.yml` does not exist yet, skip step tracking (lifecycle not initialized).
1. Read `.expedite/state.yml`
2. Backup: `cp .expedite/state.yml .expedite/state.yml.bak` (via Bash)
3. Set `current_step` to `{skill: "scope", step: 1, label: "Lifecycle Check"}`
4. Set `last_modified` to current timestamp
5. Write the entire file back

**State Recovery Preamble**

Look at the injected lifecycle state above. If the injection shows "No active lifecycle" (meaning state.yml is missing):

1. Check whether recovery artifacts exist: Follow the artifact scan in `skills/shared/ref-state-recovery.md` (use Glob with `**/ref-state-recovery.md` if the direct path fails).
2. If recovery succeeds (artifacts found and state.yml reconstructed): Re-read `.expedite/state.yml` to get the recovered state values. The recovered state will have a phase like `scope_complete` or later -- fall through to **Case C** below (active lifecycle with phase other than scope_in_progress).
3. If no artifacts found: This is a genuine fresh start. Proceed to **Case A** below.

If the injection shows actual state content (not "No active lifecycle"), skip this preamble entirely and proceed to the Case routing below.

**Case A: "No active lifecycle"**
Proceed directly to Step 3.

**Case B: Active lifecycle with `phase: "scope_in_progress"` AND `project_name` is set (not null)**
This is a resume scenario. Display:

```
Found an in-progress scope for "{project_name}" ({intent} intent).

Context collected so far:
- Project: {project_name}
- Intent: {intent}
- Description: {description if available}
- Questions defined: {count of questions array}

Continue from where you left off?
```

Use AskUserQuestion:
```
header: "Resume"
question: "Continue from where you left off?"
options:
  - label: "Continue"
    description: "Pick up from the last completed step"
  - label: "Start over"
    description: "Archive this lifecycle and begin fresh"
multiSelect: false
```

- Continue: Skip to the step that corresponds to the current progress. If questions exist, skip to Step 6. If intent and description are set but no questions, skip to Step 5. If only project_name is set, skip to Step 4.
- Start over: Execute the archival flow below, then proceed to Step 3.

**Case C: Active lifecycle with any other phase (not scope_in_progress)**
Display:

```
An active lifecycle exists: "{project_name}" (phase: {phase}).

Archive this lifecycle and start a new one?
```

Use AskUserQuestion:
```
header: "Archive"
question: "Archive this lifecycle and start a new one?"
options:
  - label: "Yes, archive"
    description: "Archive current lifecycle and start fresh"
  - label: "No, keep it"
    description: "Keep the current lifecycle as-is"
multiSelect: false
```

- Yes, archive: Execute the archival flow below, then proceed to Step 3.
- No, keep it: Respond with "Keeping the current lifecycle. Run `/expedite:status` to see your current position." Then STOP.

**Archival flow** (when user chooses to archive):

1. Generate a slug from the project_name: lowercase, replace spaces and special characters with hyphens, append the date in YYYYMMDD format. Example: "Auth Redesign" becomes "auth-redesign-20260302".
2. Create the archive directory:
   ```bash
   mkdir -p .expedite/archive/{slug}
   ```
3. Move all contents of `.expedite/` to the archive directory EXCEPT: `archive/` itself, `sources.yml`, `log.yml`. Use Bash to move files:
   ```bash
   # Move state and artifacts to archive (preserve sources.yml, log.yml, archive/)
   for item in .expedite/*; do
     base=$(basename "$item")
     if [ "$base" != "archive" ] && [ "$base" != "sources.yml" ] && [ "$base" != "log.yml" ] && [ "$base" != ".gitignore" ]; then
       mv "$item" ".expedite/archive/{slug}/"
     fi
   done
   ```
4. If any move command fails, warn the user but proceed: "Warning: Could not archive some files. Proceeding with new lifecycle."
5. Display: "Archived previous lifecycle to `.expedite/archive/{slug}/`."

### Step 2: Connected Flow Import (v2)

**Step tracking:** Update `current_step` in state.yml (backup-before-write). If `.expedite/state.yml` does not exist yet, skip step tracking (lifecycle not initialized).
1. Read `.expedite/state.yml`
2. Backup: `cp .expedite/state.yml .expedite/state.yml.bak` (via Bash)
3. Set `current_step` to `{skill: "scope", step: 2, label: "Connected Flow Import (v2)"}`
4. Set `last_modified` to current timestamp
5. Write the entire file back

> **Not yet implemented.** Connected flow artifact detection (scanning for HANDOFF.md/DESIGN.md from prior lifecycles) is a v2 feature (IMPORT-01 through IMPORT-04). The state.yml template has reserved `imported_from` and `constraints` fields for this.

Proceed to Step 3.

### Step 3: Initialize Lifecycle

If no `.expedite/state.yml` exists (fresh start or post-archival):

1. Create the directory structure:
   ```bash
   mkdir -p .expedite/scope
   ```

2. Find and copy the state template from the plugin:
   - Use Glob to find `**/templates/state.yml.template` to resolve the plugin's installation path
   - Read the template content
   - Write it to `.expedite/state.yml` with these initial values set:
     - `last_modified`: current timestamp in ISO 8601 UTC format
     - `phase`: `"scope_in_progress"` (should already be this in template)
     - `current_step` to `{skill: "scope", step: 3, label: "Initialize Lifecycle"}`
   - All other fields keep their template defaults (null, empty arrays, etc.)

3. Copy the sources template (only if `.expedite/sources.yml` does not already exist -- it persists across lifecycles):
   - Use Glob to find `**/templates/sources.yml.template`
   - Read the template content
   - Write to `.expedite/sources.yml`

4. Copy the gitignore template (only if `.expedite/.gitignore` does not already exist):
   - Use Glob to find `**/templates/gitignore.template`
   - Read the template content
   - Write to `.expedite/.gitignore`

5. Log phase transition:
   ```bash
   cat >> .expedite/log.yml << 'LOG_EOF'
   ---
   event: phase_transition
   timestamp: "{ISO 8601 UTC}"
   lifecycle_id: "{lifecycle_id}"
   from_phase: "none"
   to_phase: "scope_in_progress"
   LOG_EOF
   ```

6. Display: "Initialized new Expedite lifecycle."

**Error handling:** If any template file cannot be found via Glob, display: "Error: Could not find Expedite plugin templates. Verify the plugin is installed at ~/.claude/plugins/expedite/." Then STOP.

If `.expedite/state.yml` already exists (resume case), skip this step entirely.

### Step 4: Interactive Questioning (Round 1: Context)

Ask the user the following questions via freeform prompts. Present each question clearly and wait for the user's response before proceeding to the next.

If the user provided a project description as an argument when invoking the skill (via the argument-hint), use that as the answer to Question 3 and skip asking it. Still ask Questions 1 and 2.

**Question 1: Project Name**
Display: "What is the project name? (A short, descriptive name like 'auth-redesign' or 'mobile-checkout')"

Store the response as `project_name`.

**Question 2: Intent**
Display: "Is this a product investigation or an engineering investigation?"

The user will respond naturally (not necessarily the exact word "product" or "engineering"). Parse their response for intent indicators:
- **Product indicators:** "product", "PM", "PRD", "users", "market", "customer", "business", "feature", "UX"
- **Engineering indicators:** "engineering", "technical", "architecture", "implementation", "refactor", "migration", "performance", "infrastructure", "API"

If the intent is clear from the response, confirm: "I'll treat this as a **{product/engineering}** investigation."
If the intent is ambiguous, use AskUserQuestion to disambiguate:

```
header: "Intent"
question: "I want to make sure I set the right context. Which best describes this investigation?"
options:
  - label: "Product"
    description: "Focused on user needs, market fit, business outcomes"
  - label: "Engineering"
    description: "Focused on architecture, implementation, technical trade-offs"
multiSelect: false
```

Store as `intent` ("product" or "engineering").

**Question 3: Description**
Display: "Describe what you want to accomplish in 2-3 sentences. What is the high-level goal?"

Store the response as `description`.

**After Round 1: Write to state.yml**
Using the backup-before-write pattern:
1. Read `.expedite/state.yml`
2. Copy to backup: `cp .expedite/state.yml .expedite/state.yml.bak` (via Bash)
3. Update the in-memory representation:
   - Set `project_name` to the collected value
   - Set `intent` to "product" or "engineering"
   - Set `lifecycle_id` to `{project_name_slugified}-{YYYYMMDD}` (e.g., "auth-redesign-20260302")
   - Set `description` to the collected value
   - Set `current_step` to `{skill: "scope", step: 4, label: "Interactive Questioning (Round 1: Context)"}`
   - Set `last_modified` to current timestamp
4. Write the entire file back to `.expedite/state.yml`

### Step 5: Interactive Questioning (Round 2: Adaptive Refinement)

This step uses a convergence loop: keep discussing until you have enough context to generate a strong question plan, then stop. No fixed number of rounds — the conversation length adapts to the complexity of what the user described.

**5a. Analyze context and identify refinement categories.**

Review everything collected so far (description from invocation argument or Round 1, project name, intent). Classify what TYPE of change this is (new feature, refactor, migration, integration, UI change, architecture change, etc.).

Based on your analysis, identify **refinement categories** — specific areas where you need more context from the user before you can generate a good question plan. These categories must be tailored to what the user described, not pulled from a fixed list. Each category represents a knowledge gap that, if left unfilled, would produce a weaker question plan. Present up to 4 categories per AskUserQuestion call (tool constraint). If you identify more than 4 gaps, present the most impactful ones first — additional categories can be surfaced in subsequent iterations via the sufficiency check (5c).

**Background checklist** (use internally to identify category candidates — never present this list directly to the user):
- For engineering intent: current architecture, hard constraints, desired behavior, affected components, edge cases, backward compatibility concerns
- For product intent: target users, problem/pain point, success criteria, competitive context, user journey, business constraints

Present the categories to the user using AskUserQuestion (multiSelect: true) so they can confirm which areas need discussion:

```
header: "Context gaps"
question: "I'd like to explore these areas before generating research questions. Which are relevant?"
options:
  - label: "{Category 1 name}"
    description: "{Why this matters — 1 sentence tied to what they described}"
  - label: "{Category 2 name}"
    description: "..."
  ...
multiSelect: true
```

If the user deselects a category, skip it. If they add context via "Other", incorporate it as a new category.

**5b. Discuss each selected category.**

For each selected category, ask enough questions to bridge the knowledge gap for that area. This could be 1 question for a straightforward category or 3-4 for a complex one. Stop when you have enough context for that category — don't pad with unnecessary questions.

Within each category, follow the thread — when an answer raises an edge case, ambiguity, or implicit assumption, probe it right then rather than saving it for later. The goal is to leave each category fully understood, including its edge cases.

Rules for questioning within each category:
- If a question has 2-4 concrete options, use AskUserQuestion with those options. Mark your recommended option with "(Recommended)".
- If a question is open-ended and needs the user's own explanation, ask via freeform prompt.
- Each answer should inform whether a follow-up is needed within that category. Don't pre-plan all questions — react to what the user says.
- When moving to a new category, announce it: "Now let's talk about {Category name}."

Examples of good adaptive questions:
- "You mentioned backward compatibility. Should the old behavior remain the default, or should the new behavior be the default with an option to revert?" → AskUserQuestion with options
- "Should this preference persist across sessions?" → AskUserQuestion: "Persist across sessions (Recommended)" / "Reset each session" / "Configurable"
- "Describe how the current system handles this flow today." → Freeform (needs detailed answer)
- "When both inputs are required, should the user be forced into a specific order, or should either order work?" → AskUserQuestion with options

Anti-patterns (do NOT do these):
- Generic questions regardless of context ("What is the desired end state?", "What are the hard constraints?")
- Asking about things the user already explained in their description or previous answers
- Accepting vague answers without probing for specifics
- Walking through a checklist instead of following the user's thread

**5c. Assess sufficiency and iterate if needed.**

After all selected categories are covered, assess whether you have enough context to generate a strong question plan. Check internally:
- Can you identify concrete decision areas from what the user described?
- Do you understand the key behaviors, not just the high-level goal?
- Are there remaining ambiguities, edge cases, or implicit assumptions that would weaken the question plan?

**If sufficient:** Proceed to 5d.

**If gaps remain:** Present newly discovered categories or specific questions to the user. Use AskUserQuestion or freeform as appropriate. This is not a separate "round" — it's a natural continuation: "A couple more things came up from our discussion..."

This loop repeats until you're confident the context is strong enough. For simple features this may require zero additional questions. For complex features it may require another full category discussion.

**5d. Confirm understanding.**

Summarize what you now understand in 3-5 sentences. Ask via AskUserQuestion: "Does this capture it, or is there anything I'm missing?" with options "That's right" / "Let me clarify". If they clarify, incorporate the new context — then re-assess sufficiency (5c) before re-confirming.

**After convergence: Update state.yml**
Using the backup-before-write pattern (same as Step 4):
1. Read `.expedite/state.yml`
2. Backup: `cp .expedite/state.yml .expedite/state.yml.bak` (via Bash)
3. Update the in-memory representation:
   - Set `current_step` to `{skill: "scope", step: 5, label: "Interactive Questioning (Round 2: Adaptive Refinement)"}`
   - Set `last_modified` to current timestamp
4. Write the entire file back

Note: Refinement answers are used as context for question plan generation in Step 6 but are NOT stored as individual fields in state.yml (to keep state flat). They are held in the conversation context and will be written into SCOPE.md's "Project Context" section in Step 9.

Display: "Context collected. Now I'll generate a question plan based on everything you've shared."

Proceed to Step 6.

### Step 6: Question Plan Generation and Review

**Step tracking:** Update `current_step` in state.yml (backup-before-write):
1. Read `.expedite/state.yml`
2. Backup: `cp .expedite/state.yml .expedite/state.yml.bak` (via Bash)
3. Set `current_step` to `{skill: "scope", step: 6, label: "Question Plan Generation and Review"}`
4. Set `last_modified` to current timestamp
5. Write the entire file back

This is the most important step. The question plan defines the contract chain for the entire lifecycle.

**6a. Load the questioning guide.**
Read the file `skills/scope/references/prompt-scope-questioning.md` (use Glob with `**/prompt-scope-questioning.md` if the direct path fails). This guide defines the structure, quality criteria, and intent-specific guidance for the question plan. You MUST read it before generating the plan.

**6b. Generate the question plan.**
Using ALL collected context (project_name, intent, description, and the refinement category discussions from Step 5), generate a question plan following the structure defined in the questioning guide:

- Group questions into **Decision Areas (DAs)**. Each DA gets:
  - An ID: DA-1, DA-2, ... DA-N
  - A descriptive name
  - A **depth calibration**: Deep (high-stakes, hard to reverse -- requires 2+ corroborating sources per evidence requirement) | Standard (moderate reversibility -- requires at least 2 sources for key requirements) | Light (low-stakes, easily reversible -- single credible source acceptable)
  - A **readiness criterion**: A concrete, checkable statement of what evidence is needed to make a design decision for this DA. NOT "enough evidence" -- instead something like "at least 2 implementation examples with benchmarks comparing approaches"

- Within each DA, define **questions**. Each question gets:
  - An ID: q01, q02, ... qNN (sequential across ALL DAs)
  - The question text (phrased as a question, not a task)
  - A priority: P0 (blocking -- design cannot proceed without), P1 (important -- quality degrades without), P2 (supplementary)
  - Source hints: which sources are most likely to have the answer (web, codebase, mcp)
  - **Evidence requirements**: What SPECIFIC evidence would constitute a sufficient answer. These must be concrete and checkable:
    - GOOD: "At least 2 implementation examples with performance benchmarks"
    - GOOD: "API documentation confirming capability X with code samples"
    - BAD: "Thorough understanding of the topic" (uncheckable)
    - BAD: "Sufficient evidence" (circular)
    - BAD: "Research the approach" (task, not requirement)

Intent-specific guidance:
- **Product intent:** Include at least 1 DA addressing value risk and 1 addressing usability risk. P0 questions should include user validation evidence requirements. After the plan, include a "Risks Addressed" summary mapping DAs/questions to Cagan's four risks (value, usability, feasibility, viability).
- **Engineering intent:** Include at least 1 DA addressing architecture and 1 addressing implementation. P0 questions should include feasibility evidence requirements. After the plan, include a "Concerns Addressed" summary mapping DAs/questions to engineering concerns (architecture, implementation, performance, migration/integration).

**6c. Self-check before presenting.**
Before presenting the plan to the user, verify it against the quality criteria from the questioning guide:
- [ ] At least 3 questions total (usually 5-15)
- [ ] At least 1 P0 question exists
- [ ] At least 2 decision areas exist
- [ ] Every question has evidence requirements (no blanks)
- [ ] Every DA has a readiness criterion (concrete, checkable)
- [ ] Every DA has a depth calibration
- [ ] No more than 15 questions
- [ ] Questions are phrased as questions, not tasks
- [ ] Evidence requirements are specific and checkable

If any check fails, revise the plan before presenting. Do NOT present a plan that fails self-check.

**6d. Present the plan.**
Display the plan in this exact format:

```
--- Question Plan Preview ---

DA-1: [Name] ([Depth])
Readiness: [concrete readiness criterion]
  [P0] q01: [question text] ([source hints])
    Evidence needed: [specific evidence requirements]
  [P1] q02: [question text] ([source hints])
    Evidence needed: [specific evidence requirements]

DA-2: [Name] ([Depth])
Readiness: [concrete readiness criterion]
  [P0] q03: [question text] ([source hints])
    Evidence needed: [specific evidence requirements]
  ...

--- [N] questions across [M] DAs, estimated [K] research batches ---
Proceed? (yes / modify / add questions)
```

Estimate research batches by counting how many distinct source-type groups the questions split into (typically 2-3 batches for web, codebase, and MCP).

If product intent, also display the "Risks Addressed" summary after the plan.
If engineering intent, also display the "Concerns Addressed" summary after the plan.

**6e. Review loop.**
Wait for user response:
- **"yes"** or approval: Proceed to Step 7.
- **"modify"** + description of changes: Apply the requested modifications to the plan (add/remove/reprioritize questions, change DAs, adjust evidence requirements). Re-run the self-check (6c). Re-present the updated plan (6d). Loop until approved.
- **"add"** + new question descriptions: Add the new questions to the appropriate DAs (or create new DAs if needed). Assign IDs sequentially. Re-run self-check (6c). Re-present (6d). Loop until approved.
- If the user's response is ambiguous, use AskUserQuestion to clarify:
  ```
  header: "Plan action"
  question: "What would you like to do with the question plan?"
  options:
    - label: "Approve as-is"
      description: "Accept the plan and proceed to source configuration"
    - label: "Modify questions"
      description: "Change existing questions, DAs, or evidence requirements"
    - label: "Add questions"
      description: "Add new questions to existing or new decision areas"
  multiSelect: false
  ```

### Step 7: Codebase Analysis (Additive Questions)

**Step tracking:** Update `current_step` in state.yml (backup-before-write):
1. Read `.expedite/state.yml`
2. Backup: `cp .expedite/state.yml .expedite/state.yml.bak` (via Bash)
3. Set `current_step` to `{skill: "scope", step: 7, label: "Codebase Analysis (Additive Questions)"}`
4. Set `last_modified` to current timestamp
5. Write the entire file back

This step generates additive codebase-routed questions that help the research phase understand existing patterns in the user's codebase. These questions are NOT counted against the 15-question budget and have no cap -- generate as many as needed per DA.

**7a. Determine relevance.**

If the user described this as a greenfield project with no existing codebase (no project directory, or the project directory is empty/contains only scaffolding), skip this step entirely:

Display: "No existing codebase detected. Skipping codebase analysis."

Proceed to Step 8.

**7b. Analyze codebase per DA.**

For each Decision Area in the approved question plan:

1. Determine relevant codebase search patterns based on the DA name and the user's project description.
2. Use Grep, Glob, and Read to scan the project codebase for existing patterns:
   - Directory structure (Glob for relevant directories)
   - File patterns (Glob for relevant file types)
   - Code patterns (Grep for imports, function signatures, configuration, conventions)
3. Generate codebase-routed questions based on findings. Each question:
   - Is specific to patterns found (or notably absent) in the codebase
   - Has `source_hints: ["codebase"]` (always codebase-only)
   - Is NOT counted against the 15-question budget
   - Focuses on "how does the existing code handle X" rather than general knowledge
   - Gets an evidence requirement like any other question (concrete and checkable)
4. If no relevant patterns found for a DA, skip that DA with a note.

Assign IDs continuing sequentially from the last approved question ID. If the approved plan has questions q01-q12, codebase-routed questions start at q13.

**7c. Present codebase-routed questions.**

Display all generated codebase-routed questions:

```
--- Codebase-Routed Questions ---

DA-1: {Name}
  [CB] q{N}: {question about existing pattern} (codebase)
    Evidence needed: {specific codebase evidence}
  [CB] q{N+1}: {question about existing pattern} (codebase)
    Evidence needed: {specific codebase evidence}

DA-3: {Name}
  [CB] q{N+2}: {question about existing pattern} (codebase)
    Evidence needed: {specific codebase evidence}

DA-2: {Name}
  (No relevant codebase patterns detected)

--- {N} codebase questions across {M} DAs ---
Approve? (approve all / select specific / skip all)
```

**7d. Review.**

Wait for user response:
- **"approve all"** or **"yes"**: Accept all codebase-routed questions. Proceed to Step 8.
- **"select specific"** or **"modify"**: User indicates which questions to keep. Remove unselected ones. Proceed to Step 8.
- **"skip all"** or **"skip"**: Discard all codebase-routed questions. Proceed to Step 8.

Note: Codebase-routed questions will be written to state.yml alongside the original questions in Step 9 (Write Artifacts). They use `source: "codebase-routed"` to distinguish them from original questions.

### Step 8: Source Configuration

**Step tracking:** Update `current_step` in state.yml (backup-before-write):
1. Read `.expedite/state.yml`
2. Backup: `cp .expedite/state.yml .expedite/state.yml.bak` (via Bash)
3. Set `current_step` to `{skill: "scope", step: 8, label: "Source Configuration"}`
4. Set `last_modified` to current timestamp
5. Write the entire file back

Read `.expedite/sources.yml` and display the configured sources as a checklist:

```
Configured sources:
  [x] Web (WebSearch, WebFetch) - always available
  [x] Codebase (Grep, Read, Glob, Bash) - always available
```

If sources.yml contains additional MCP sources that are enabled, also show them:
```
  [x] GitHub (mcp__github__*) - configured
```

If MCP sources are listed but not enabled (commented out), show them as unchecked:
```
  [ ] GitHub (mcp__github__*) - not configured
```

Use AskUserQuestion:
```
header: "Sources"
question: "Use these sources for research?"
options:
  - label: "Yes, use these"
    description: "Proceed with the configured sources"
  - label: "Edit sources"
    description: "Modify source configuration before proceeding"
multiSelect: false
```

- Yes, use these: Proceed to Step 9.
- If the user asks to edit sources: Respond with "Source editing will be available in a future update. For now, you can manually edit `.expedite/sources.yml` to add or remove MCP sources. Proceeding with current configuration."

### Step 9: Write Artifacts

Now that the user has approved the question plan and confirmed sources, write the artifacts.

**9a. Write SCOPE.md.**

Create `.expedite/scope/SCOPE.md` (create the `scope/` directory if it does not exist) with this structure:

```markdown
# Expedite Scope: {project_name}

**Created:** {current timestamp ISO 8601}
**Intent:** {product/engineering}
**Lifecycle ID:** {lifecycle_id from state.yml}

## Project Context

{User's description (from invocation argument or Round 1)}

### Refinement Context

{Summary of refinement category discussions and user decisions from Step 5, organized by category}

## Success Criteria

{Extract success criteria from the user's responses. For product intent, these come from answers about user outcomes and problem validation. For engineering intent, synthesize from the user's description, refinement category answers, and any clarifications about desired behavior. Present as a bulleted list of concrete, measurable criteria.}

## Decision Areas

### DA-1: {Name} ({Depth})
**Readiness criterion:** {concrete, checkable statement}

| ID | Priority | Question | Sources | Evidence Requirements |
|----|----------|----------|---------|----------------------|
| q01 | P0 | {question text} | {web, codebase} | {specific requirements} |
| q02 | P1 | {question text} | {codebase} | {specific requirements} |

### DA-2: {Name} ({Depth})
**Readiness criterion:** {concrete, checkable statement}

| ID | Priority | Question | Sources | Evidence Requirements |
|----|----------|----------|---------|----------------------|
| q03 | P0 | {question text} | {web} | {specific requirements} |

{Repeat for all DAs}

## {Risks Addressed / Concerns Addressed}

{For product intent: map DAs/questions to Cagan's four risks}
{For engineering intent: map DAs/questions to engineering concerns}

## Source Configuration

{Checklist from Step 8, showing enabled/disabled sources}

## Metadata

- Questions: {N} across {M} DAs
- Estimated research batches: {K}
- Intent: {product/engineering}
- Created: {timestamp}
```

**9b. Update state.yml with questions.**

Using the backup-before-write pattern:
1. Read `.expedite/state.yml`
2. Backup: `cp .expedite/state.yml .expedite/state.yml.bak` (via Bash)
3. Update the in-memory representation:
   - Set `current_step` to `{skill: "scope", step: 9, label: "Write Artifacts"}`
   - Set `last_modified` to current timestamp
   - Set `questions` array with one entry per question from the approved plan. Each question entry:
     ```yaml
     - id: "q01"
       text: "{question text}"
       priority: "P0"
       decision_area: "{DA name}"
       source_hints: ["{web}", "{codebase}"]
       evidence_requirements: "{specific requirements}"
       status: "pending"
       source: "original"
       gap_details: null
       evidence_files: []
     ```
     ```yaml
     # For codebase-routed questions from Step 7:
     # - source: "codebase-routed"
     # - source_hints: ["codebase"]
     # Include these in the same questions array alongside original questions.
     ```
   - Use YAML flow-style arrays for `source_hints` and `evidence_files` (e.g., `["web", "codebase"]` and `[]`) to stay within the 2-level nesting limit.
4. Write the entire file back to `.expedite/state.yml`

**IMPORTANT:** DA-level metadata (name, depth calibration, readiness criterion) lives ONLY in SCOPE.md. It does NOT go into state.yml. This respects the flat structure constraint (max 2 nesting levels). Only question-level data goes in state.yml.

Display: "Scope artifacts written. Running gate evaluation..."

Proceed to Step 10.

### Step 10: Gate G1 Evaluation

Evaluate the G1 gate. This is a **structural gate** -- all checks are deterministic (counts, field existence, string matching). Do NOT apply LLM judgment. For each criterion, state the specific evidence from the artifacts.

**Read the artifacts for evaluation:**
1. Read `.expedite/scope/SCOPE.md`
2. Read `.expedite/state.yml`

**Evaluate MUST criteria (all must pass for Go):**

| # | Criterion | How to Check | Result |
|---|-----------|-------------|--------|
| M1 | SCOPE.md exists and is non-empty | Check that `.expedite/scope/SCOPE.md` exists and has content | PASS/FAIL |
| M2 | At least 3 questions defined | Count entries in state.yml `questions` array. State the count: "Found {N} questions" | PASS/FAIL |
| M3 | Intent declared (product or engineering) | Check `intent` field in state.yml is "product" or "engineering", not null | PASS/FAIL |
| M4 | At least one success criterion defined | Check SCOPE.md "Success Criteria" section has at least one bullet point | PASS/FAIL |
| M5 | Every question has evidence_requirements defined | Check each question in state.yml has a non-null, non-empty `evidence_requirements` field. State: "Checked {N} questions, all have evidence_requirements" or "{N} missing" | PASS/FAIL |
| M6 | Every DA has a readiness criterion and depth calibration | Check SCOPE.md "Decision Areas" section: each DA heading includes a depth (Deep/Standard/Light) and has a "Readiness criterion:" line | PASS/FAIL |

**Evaluate SHOULD criteria (failures produce advisory, do not block):**

| # | Criterion | How to Check | Result |
|---|-----------|-------------|--------|
| S1 | Questions have source_hints | Check each question in state.yml has non-empty `source_hints`. State: "{N}/{M} questions have source_hints" | PASS/ADVISORY |
| S2 | Questions span at least 2 decision areas | Count unique `decision_area` values in state.yml questions. State: "Found {N} distinct DAs" | PASS/ADVISORY |
| S3 | No more than 15 questions | Count questions array. State: "Found {N} questions" | PASS/ADVISORY |

**Determine gate outcome:**

- **All MUST pass + All SHOULD pass → "go"**
  Write `phase: "scope_complete"` to state.yml.
  Display: "Gate G1: **PASS** -- All criteria met. Scope is complete."

- **All MUST pass + Some SHOULD fail → "go_advisory"**
  Write `phase: "scope_complete"` to state.yml.
  Display: "Gate G1: **PASS with advisory** -- All required criteria met. Advisory notes: {list which SHOULD criteria failed and why}."

- **Any MUST fail → "hold"**
  Do NOT write `phase: "scope_complete"`.
  Display: "Gate G1: **HOLD** -- {N} required criteria failed:"
  List each failed MUST criterion with what specifically is missing.
  Then use AskUserQuestion:
  ```
  header: "Gate hold"
  question: "Would you like to fix these issues now?"
  options:
    - label: "Fix now"
      description: "Resolve the failing criteria inline"
    - label: "Fix later"
      description: "Exit and run /expedite:scope again when ready"
  multiSelect: false
  ```
  - Fix now: Guide the user through fixing each issue (e.g., add missing evidence requirements, add a success criterion). After fixes, re-run the gate evaluation from the beginning of Step 10.
  - Fix later: Display: "Scope is incomplete. Run `/expedite:scope` again when ready to continue." Then STOP.

**Record gate result in state.yml:**

Using the backup-before-write pattern:
1. Read `.expedite/state.yml`
2. Backup: `cp .expedite/state.yml .expedite/state.yml.bak` (via Bash)
3. Update:
   - Set `current_step` to `{skill: "scope", step: 10, label: "Gate G1 Evaluation"}`
   - If outcome is "go" or "go_advisory": set `phase: "scope_complete"` and set `current_step` to null
   - Set `last_modified` to current timestamp
   - Append to `gate_history` array:
     ```yaml
     - gate: "G1"
       timestamp: "{current timestamp ISO 8601}"
       outcome: "{go/go_advisory/hold}"
       must_passed: {count of passed MUST criteria}
       must_failed: {count of failed MUST criteria}
       should_passed: {count of passed SHOULD criteria}
       should_failed: {count of failed SHOULD criteria}
       notes: {null if all pass, or description of SHOULD failures for go_advisory, or MUST failures for hold}
       overridden: false
     ```
4. Write the entire file back to `.expedite/state.yml`

**Log gate outcome to telemetry** (after state.yml write, regardless of outcome):
```bash
cat >> .expedite/log.yml << 'LOG_EOF'
---
event: gate_outcome
timestamp: "{ISO 8601 UTC}"
lifecycle_id: "{lifecycle_id}"
gate: "G1"
outcome: "{go|go_advisory|hold}"
must_passed: {N}
must_failed: {N}
should_passed: {N}
should_failed: {N}
LOG_EOF
```

**If gate passed (go or go_advisory), also log phase transition:**
```bash
cat >> .expedite/log.yml << 'LOG_EOF'
---
event: phase_transition
timestamp: "{ISO 8601 UTC}"
lifecycle_id: "{lifecycle_id}"
from_phase: "scope_in_progress"
to_phase: "scope_complete"
LOG_EOF
```

**After successful gate (go or go_advisory):**

Display:
```
Scope complete! Here is a summary:

Project: {project_name}
Intent: {intent}
Questions: {N} across {M} decision areas
Estimated research batches: {K}

Next step: Run `/expedite:research` to begin evidence gathering.
```

STOP. Do not proceed to any other step.
