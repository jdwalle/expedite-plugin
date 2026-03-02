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

# Scope Skill

You are the Expedite scope orchestrator. Your job is to guide the user through defining a lifecycle goal, declaring intent, and producing a structured question plan with evidence requirements that flows downstream through research, design, plan, and execution. You are the origin point of the contract chain: every decision area, evidence requirement, and readiness criterion defined here becomes a typed contract that the rest of the lifecycle must satisfy.

**Interaction model:** Use freeform prompts for all user interaction (display your question as output, let the user respond naturally). Do NOT use AskUserQuestion for conversational questions -- the 60-second timeout makes it unsuitable for scope's multi-turn conversation. The one exception is the v2 connected flow import decision, which is not yet implemented.

**After completing each step, proceed to the next step automatically.** Do not wait for explicit "next step" instructions from the user between steps unless the step specifically calls for user input.

## Instructions

### Step 1: Lifecycle Check

Look at the injected lifecycle state above.

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

Continue from where you left off? (yes / start over)
```

Wait for user response:
- "yes" or continue: Skip to the step that corresponds to the current progress. If questions exist, skip to Step 6. If intent and description are set but no questions, skip to Step 5. If only project_name is set, skip to Step 4.
- "start over": Execute the archival flow below, then proceed to Step 3.

**Case C: Active lifecycle with any other phase (not scope_in_progress)**
Display:

```
An active lifecycle exists: "{project_name}" (phase: {phase}).

Archive this lifecycle and start a new one? (yes / no)
```

Wait for user response:
- "yes": Execute the archival flow below, then proceed to Step 3.
- "no": Respond with "Keeping the current lifecycle. Run `/expedite:status` to see your current position." Then STOP.

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
   - All other fields keep their template defaults (null, empty arrays, etc.)

3. Copy the sources template (only if `.expedite/sources.yml` does not already exist -- it persists across lifecycles):
   - Use Glob to find `**/templates/sources.yml.template`
   - Read the template content
   - Write to `.expedite/sources.yml`

4. Copy the gitignore template (only if `.expedite/.gitignore` does not already exist):
   - Use Glob to find `**/templates/gitignore.template`
   - Read the template content
   - Write to `.expedite/.gitignore`

5. Display: "Initialized new Expedite lifecycle."

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
If the intent is ambiguous, ask: "I want to make sure I set the right context. Would you classify this as: (a) a **product** investigation (focused on user needs, market fit, business outcomes), or (b) an **engineering** investigation (focused on architecture, implementation, technical trade-offs)?"

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
   - Set `last_modified` to current timestamp
4. Write the entire file back to `.expedite/state.yml`

### Step 5: Interactive Questioning (Round 2: Refinement)

Based on the declared intent, ask 3 refinement questions via freeform prompts.

**If intent is "product":**

Display each question and wait for the response:

1. "Who are the target users or customers for this?"
2. "What specific problem does this solve for them? What pain point or need are you addressing?"
3. "What does success look like? How will you know this worked?"

**If intent is "engineering":**

Display each question and wait for the response:

1. "What is the current architecture context? (Describe the existing system or starting point.)"
2. "What are the hard constraints? (Budget, timeline, technology mandates, backward compatibility, etc.)"
3. "What is the desired end state? (What should the system look like when this is done?)"

**After Round 2: Update state.yml**
Using the backup-before-write pattern (same as Step 4):
1. Read `.expedite/state.yml`
2. Backup: `cp .expedite/state.yml .expedite/state.yml.bak` (via Bash)
3. Update `last_modified` to current timestamp
4. Write the entire file back

Note: Round 2 answers are used as context for question plan generation in Step 6 but are NOT stored as individual fields in state.yml (to keep state flat). They are held in the conversation context and will be written into SCOPE.md's "Project Context" section in Step 8.

Display: "Context collected. Now I'll generate a question plan based on everything you've shared."

Proceed to Step 6.

### Step 6: Question Plan Generation and Review

This is the most important step. The question plan defines the contract chain for the entire lifecycle.

**6a. Load the questioning guide.**
Read the file `skills/scope/references/prompt-scope-questioning.md` (use Glob with `**/prompt-scope-questioning.md` if the direct path fails). This guide defines the structure, quality criteria, and intent-specific guidance for the question plan. You MUST read it before generating the plan.

**6b. Generate the question plan.**
Using ALL collected context (project_name, intent, description, and the Round 2 refinement answers), generate a question plan following the structure defined in the questioning guide:

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
- If the user's response is ambiguous, ask for clarification: "I want to make sure I get this right. Would you like to (a) approve the plan as-is, (b) modify existing questions, or (c) add new questions?"

### Step 7: Source Configuration

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

Display: "Use these sources for research? (yes)"

Wait for user response:
- "yes" or any approval: Proceed to Step 8.
- If the user asks to edit sources: Respond with "Source editing will be available in a future update. For now, you can manually edit `.expedite/sources.yml` to add or remove MCP sources. Proceeding with current configuration."

### Step 8: Write Artifacts

Now that the user has approved the question plan and confirmed sources, write the artifacts.

**8a. Write SCOPE.md.**

Create `.expedite/scope/SCOPE.md` (create the `scope/` directory if it does not exist) with this structure:

```markdown
# Expedite Scope: {project_name}

**Created:** {current timestamp ISO 8601}
**Intent:** {product/engineering}
**Lifecycle ID:** {lifecycle_id from state.yml}

## Project Context

{User's description from Round 1, Question 3}

### Refinement Context

{Summary of Round 2 answers, organized by the questions asked}

## Success Criteria

{Extract success criteria from the user's responses. For product intent, these come from the "What does success look like?" answer. For engineering intent, these come from the "What is the desired end state?" answer. Present as a bulleted list of concrete, measurable criteria.}

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

{Checklist from Step 7, showing enabled/disabled sources}

## Metadata

- Questions: {N} across {M} DAs
- Estimated research batches: {K}
- Intent: {product/engineering}
- Created: {timestamp}
```

**8b. Update state.yml with questions.**

Using the backup-before-write pattern:
1. Read `.expedite/state.yml`
2. Backup: `cp .expedite/state.yml .expedite/state.yml.bak` (via Bash)
3. Update the in-memory representation:
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
   - Use YAML flow-style arrays for `source_hints` and `evidence_files` (e.g., `["web", "codebase"]` and `[]`) to stay within the 2-level nesting limit.
4. Write the entire file back to `.expedite/state.yml`

**IMPORTANT:** DA-level metadata (name, depth calibration, readiness criterion) lives ONLY in SCOPE.md. It does NOT go into state.yml. This respects the flat structure constraint (max 2 nesting levels). Only question-level data goes in state.yml.

Display: "Scope artifacts written. Running gate evaluation..."

Proceed to Step 9.
