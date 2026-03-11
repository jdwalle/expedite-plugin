# Phase 18: Gate Enforcement - Research

**Researched:** 2026-03-10
**Domain:** Quality gate DA readiness enforcement in Expedite plugin SKILL.md files (research, design, plan, spike)
**Confidence:** HIGH

## Summary

Phase 18 adds DA readiness criterion enforcement to four existing quality gates (G2-G5). The existing gate infrastructure is mature: G1-G5 already have MUST/SHOULD criteria tables, outcome routing (Go/Go-with-advisory/Recycle/Override), telemetry logging, and gate_history recording. The change is adding new criteria rows to existing tables, not building new gate infrastructure.

The key architectural insight is that the four gates have asymmetric enforcement patterns. G2 is a simple field check (SYNTHESIS.md already outputs `Readiness status: [MET / NOT MET]` per DA, but G2's criteria currently ignore it). G3 requires cross-referencing DESIGN.md evidence citations against SCOPE.md readiness criteria (LLM judgment, consistent with G3's existing nature). G4 and G5 require moderate LLM judgment against structural gates that are currently deterministic. The roadmap already resolves the MUST vs SHOULD tension: G2 and G3 are MUST criteria (failure triggers Recycle), G4 and G5 are SHOULD criteria (failure produces advisory). This matches the pitfalls research recommendation (P2/P7) and avoids mass Recycle risk.

All four changes are isolated to specific SKILL.md gate sections. No state.yml schema changes, no new files, no new reference templates. The synthesizer already produces per-DA readiness assessments. The sufficiency evaluator already tracks per-question evidence requirements. The contract chain (SCOPE.md readiness criteria -> SYNTHESIS.md readiness status -> DESIGN.md evidence citations -> PLAN.md task coverage -> SPIKE.md resolution specificity) already exists in the data; the gates just do not enforce it yet.

**Primary recommendation:** Add one new criterion row to each of G2, G3, G4, and G5 gate evaluation tables, with G2/G3 as MUST and G4/G5 as SHOULD. Implement in order G2 -> G3 -> G4 -> G5 (increasing complexity). Each is a self-contained SKILL.md edit.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| GATE-01 | G2 (research) validates every DA readiness criterion marked MET in SYNTHESIS.md -- MUST criterion | SYNTHESIS.md already outputs `Readiness status: [MET / NOT MET]` per DA (synthesizer prompt line 110). G2 gate (research SKILL.md lines 669-717) currently has 4 MUST + 3 SHOULD criteria -- none check readiness status. Add M5: count DA readiness statuses in SYNTHESIS.md, require all MET. |
| GATE-02 | G3 (design) validates evidence citations address DA-specific readiness criteria -- MUST criterion | G3 gate (design SKILL.md lines 435-508) currently has M2 "every decision references evidence" but does not check that citations address the *readiness criteria* from SCOPE.md. Add M5: for each DA, cross-reference SCOPE.md readiness criterion against the evidence cited in DESIGN.md's DA section. LLM judgment required (consistent with G3's existing evaluation style). |
| GATE-03 | G4 (plan) validates task coverage accounts for DA depth calibration (Deep vs Light) -- SHOULD criterion | G4 gate (plan SKILL.md lines 415-489) is currently a structural gate with 5 MUST + 4 SHOULD. DA depth calibration (Deep/Standard/Light) from SCOPE.md is not currently referenced. Add S5: check that Deep DAs have proportionally more tasks/acceptance criteria than Light DAs. SHOULD criterion to avoid false Recycle on structural gate. |
| GATE-04 | G5 (spike) validates spike resolution addresses the specific ambiguity identified -- SHOULD criterion | G5 gate (spike SKILL.md lines 316-419) currently checks TD resolution completeness and rationale presence but does not verify the resolution *addresses the specific ambiguity*. Add S4: for each needs-spike TD, check the resolution rationale explains how it resolves the ambiguity from the TD description. SHOULD criterion to preserve structural gate nature. |
</phase_requirements>

## Standard Stack

### Core
| Component | Location | Purpose | Why Standard |
|-----------|----------|---------|--------------|
| research/SKILL.md | skills/research/SKILL.md (40,100 bytes) | Contains G2 gate at Step 14, lines 669-717 | Gate criteria are inline in SKILL.md per architecture anti-pattern guidance |
| design/SKILL.md | skills/design/SKILL.md (31,307 bytes) | Contains G3 gate at Step 8, lines 435-508 | Same pattern |
| plan/SKILL.md | skills/plan/SKILL.md (27,608 bytes) | Contains G4 gate at Step 7, lines 415-489 | Same pattern |
| spike/SKILL.md | skills/spike/SKILL.md (21,641 bytes) | Contains G5 gate at Step 7, lines 316-419 | Same pattern |

### Supporting
| Component | Location | Purpose | When Referenced |
|-----------|----------|---------|----------------|
| SCOPE.md | .expedite/scope/SCOPE.md | DA readiness criteria and depth calibration source of truth | G2 needs readiness criteria, G3 needs readiness criteria, G4 needs depth calibration |
| SYNTHESIS.md | .expedite/research/SYNTHESIS.md | Per-DA readiness status (MET/NOT MET) | G2 reads this for M5 check |
| DESIGN.md | .expedite/design/DESIGN.md | Per-DA evidence citations | G3 reads this (already does) |
| PLAN.md | .expedite/plan/PLAN.md | Task/story coverage per DA | G4 reads this (already does) |
| prompt-research-synthesizer.md | skills/research/references/ | Defines SYNTHESIS.md output format including readiness status | Confirms readiness status is already produced |
| prompt-sufficiency-evaluator.md | skills/research/references/ | Defines sufficiency evaluation including DA depth calibration | Confirms depth calibration is already used upstream |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Inline criteria in SKILL.md | External gate-criteria files | Architecture anti-pattern (ARCHITECTURE.md line 112: "Keep gate criteria inline in SKILL.md gate sections -- don't create separate gate-criteria files") |
| G4/G5 as MUST criteria | Stronger enforcement | Mass Recycle risk (Pitfall P2). Structural gates gaining judgment checks should start as SHOULD to validate before promoting |
| Literal string matching for readiness | More deterministic | Readiness criteria are natural language ("at least 2 implementation examples with benchmarks"). Semantic matching is required. G3 already uses LLM judgment. |

## Architecture Patterns

### Current Gate Criterion Table Pattern
Every gate follows the same structure. New criteria are added as rows to existing tables.

```markdown
**MUST criteria (all must pass for Go):**

| # | Criterion | How to Check | Result |
|---|-----------|-------------|--------|
| M1 | {description} | {procedure} | PASS/FAIL |
| M2 | {description} | {procedure} | PASS/FAIL |
...
| M{N} | {NEW CRITERION} | {procedure} | PASS/FAIL |

**SHOULD criteria (failures produce advisory, not block):**

| # | Criterion | How to Check | Result |
|---|-----------|-------------|--------|
| S1 | {description} | {procedure} | PASS/ADVISORY |
...
| S{N} | {NEW CRITERION} | {procedure} | PASS/ADVISORY |
```

### Gate Display Pattern
All gates use the same display format. New criteria appear in the output.

```
--- G{N} Gate Evaluation ---

MUST Criteria:
  M1: {PASS|FAIL} -- {evidence}
  ...
  M{N}: {PASS|FAIL} -- {evidence}   <-- new row appears here

SHOULD Criteria:
  S1: {PASS|ADVISORY} -- {evidence}
  ...
  S{N}: {PASS|ADVISORY} -- {evidence}   <-- or here for SHOULD

Gate Outcome: {Go | Go-with-advisory | Recycle}
```

### GATE-01: G2 New Criterion Pattern (Count-Based)
G2 is a count-based gate. The new criterion follows the same count-based pattern.

```markdown
| M5 | Every DA readiness criterion MET in SYNTHESIS.md | Read SYNTHESIS.md, find each "## Decision Area" section's "Readiness status:" line. Count MET vs NOT MET. State: "{N}/{M} DA readiness criteria MET" | PASS/FAIL |
```

**How to check procedure:**
1. Read SYNTHESIS.md (already loaded for synthesis in Step 17)
2. For each `## Decision Area:` section, extract the `Readiness status:` line
3. Count how many say "MET" vs "NOT MET"
4. PASS if all MET, FAIL if any NOT MET
5. State: "Found {N}/{M} DA readiness criteria MET. {List NOT MET DAs if any}"

This is deterministic -- no LLM judgment needed. The synthesizer (prompt-research-synthesizer.md) already evaluates readiness against the specific criteria from SCOPE.md and writes the status.

### GATE-02: G3 New Criterion Pattern (LLM Judgment)
G3 already uses LLM judgment ("evaluate as if someone else produced this design"). The new criterion extends the existing evaluation.

```markdown
| M5 | Evidence citations address DA readiness criteria | For each DA, read its readiness criterion from SCOPE.md. Check that the evidence cited in DESIGN.md's DA section addresses what the readiness criterion requires. State: "{N}/{M} DAs have evidence addressing readiness criteria" | PASS/FAIL |
```

**How to check procedure:**
1. Read SCOPE.md (already loaded in Step 2) -- extract each DA's readiness criterion text
2. Read DESIGN.md (already loaded for gate evaluation) -- for each DA section, identify the evidence citations
3. For each DA: does the cited evidence address what the readiness criterion asks for? Example: if readiness criterion says "at least 2 implementation examples with benchmarks comparing approaches" and the design cites evidence-batch-01.md Finding 3 which covers implementation examples with benchmarks, that is a PASS for this DA
4. PASS if all DAs have evidence addressing their readiness criteria
5. FAIL if any DA cites evidence that does not address its readiness criterion, or cites no evidence at all
6. State: "{N}/{M} DAs have evidence addressing readiness criteria. Gaps: {list DAs where citations miss readiness criterion}"

**Important nuance:** This is NOT checking whether the readiness criterion is MET (that is G2's job). This checks whether the design's *evidence citations* address the right readiness criteria -- i.e., the design used the right evidence to make its decision, not unrelated evidence.

### GATE-03: G4 New Criterion Pattern (Structural + Judgment)
G4 is currently purely structural. Adding S5 as SHOULD preserves the structural nature while introducing depth awareness.

```markdown
| S5 | Task coverage reflects DA depth calibration | Read SCOPE.md for DA depth levels (Deep/Standard/Light). For Deep DAs, verify proportionally more tasks or acceptance criteria than Light DAs. State: "Deep DAs: {list with task counts}. Light DAs: {list with task counts}. Depth-proportional: {yes|no}" | PASS/ADVISORY |
```

**How to check procedure:**
1. Read SCOPE.md (already loaded in Step 2) -- extract each DA's depth calibration
2. Read PLAN.md (already loaded for gate evaluation) -- count tasks per DA and acceptance criteria per DA
3. Group by depth: Deep DAs vs Standard DAs vs Light DAs
4. Check: Deep DAs should NOT have fewer tasks than Light DAs. A Deep DA with 1 task while a Light DA has 3 tasks is suspicious.
5. PASS if depth ordering is respected or no contradictions found
6. ADVISORY if any Deep DA has fewer tasks/criteria than a Light DA
7. State the per-DA breakdown with depth levels and task counts

**Important:** This is advisory-only (SHOULD). It surfaces a concern but does not block. The plan may have valid reasons for a Deep DA having fewer tasks (e.g., one large complex task vs many small ones).

### GATE-04: G5 New Criterion Pattern (Semantic Check)
G5 is currently structural. Adding S4 as SHOULD adds a semantic check while preserving the structural foundation.

```markdown
| S4 | Spike resolution addresses the specific ambiguity | For each needs-spike TD, check the resolution rationale explains how it resolves the ambiguity identified in the TD description (from PLAN.md). A resolution that picks an option without explaining why the ambiguity is resolved is insufficient. State: "{N}/{M} spike resolutions address their specific ambiguity" | PASS/ADVISORY |
```

**How to check procedure:**
1. For each needs-spike TD (loaded in Step 4 from PLAN.md)
2. Read the TD description (which includes the specific ambiguity, e.g., "which caching strategy -- LRU vs TTL?")
3. Read the resolution from Step 5 (decision + rationale)
4. Check: does the rationale explain why the chosen approach resolves the ambiguity? A rationale of "chose LRU" alone is insufficient. A rationale of "chose LRU because the access pattern is temporal with hot keys, making LRU's recency bias optimal" addresses the ambiguity.
5. PASS if all resolutions address their ambiguity
6. ADVISORY if any resolution lacks specificity about the ambiguity
7. State which TDs have strong vs weak ambiguity resolution

### File Locations for All Edits
```
skills/
  research/SKILL.md    -- G2 gate: add M5 to MUST criteria table (~line 686)
  design/SKILL.md      -- G3 gate: add M5 to MUST criteria table (~line 455)
  plan/SKILL.md        -- G4 gate: add S5 to SHOULD criteria table (~line 445)
  spike/SKILL.md       -- G5 gate: add S4 to SHOULD criteria table (~line 335)
```

### Anti-Patterns to Avoid
- **Gate criteria in external files:** Architecture anti-pattern. All criteria stay inline in SKILL.md.
- **All-MUST enforcement:** P2 pitfall. G4/G5 start as SHOULD. Promote to MUST only after real-lifecycle validation.
- **Literal string matching for readiness criteria:** Readiness criteria are natural language. Use semantic assessment consistent with each gate's evaluation style.
- **Changing gate evaluation style:** G2 is count-based, G4/G5 are structural. Do not convert structural gates to LLM-judgment gates. New SHOULD criteria use moderate judgment consistent with existing SHOULD criteria (G4 S1 "wave ordering is logical" already uses judgment).
- **Breaking existing passing gates:** The new criteria must not cause currently-passing lifecycles to fail. Regression testing against well-formed artifacts is required (success criterion 5).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| DA readiness status parsing | Custom SYNTHESIS.md parser | String pattern matching on "Readiness status: MET" / "Readiness status: NOT MET" | Synthesizer outputs a fixed format per prompt-research-synthesizer.md line 110. Simple pattern match. |
| Gate outcome routing | New outcome types | Existing Go/Go-with-advisory/Recycle/Override | All four new criteria fit the existing outcome model. MUST failures -> Recycle. SHOULD failures -> advisory. |
| Gate history recording | New schema | Existing gate_history schema | must_passed/must_failed/should_passed/should_failed counts naturally include new criteria |
| Telemetry logging | New log events | Existing gate_outcome event format | Counts update naturally |

**Key insight:** The gate infrastructure is already complete. Every gate has criteria tables, display format, outcome routing, history recording, and telemetry. Adding criteria is like adding a new test to a test suite -- the framework handles everything.

## Common Pitfalls

### Pitfall 1: Mass Recycle from Over-Enforcement (P2)
**What goes wrong:** All new criteria as MUST causes well-formed lifecycles to recycle at G4/G5 due to LLM judgment variability.
**Why it happens:** Structural gates (G4/G5) have deterministic criteria. Adding judgment-based MUST criteria changes their reliability characteristics.
**How to avoid:** G4/G5 new criteria are SHOULD (advisory only). G2/G3 are MUST because G2 is count-based and G3 already uses judgment.
**Warning signs:** Multiple G4/G5 recycles on the same lifecycle; users reaching for --override frequently.

### Pitfall 2: SYNTHESIS.md Readiness Status Missing
**What goes wrong:** G2 M5 fails to find "Readiness status:" lines in SYNTHESIS.md because the synthesizer did not produce them.
**Why it happens:** The synthesizer prompt (line 110) specifies `Readiness status: [MET / NOT MET]` but the actual subagent output may vary in formatting.
**How to avoid:** Make the G2 M5 check case-insensitive and flexible about whitespace. Look for "Readiness status:" or "Readiness Status:" followed by "MET" or "NOT MET". If the line is missing for a DA, treat it as NOT MET and state why.
**Warning signs:** G2 failing M5 on lifecycles where all questions are COVERED.

### Pitfall 3: G3 M5 Conflating "Has Evidence" with "Evidence Addresses Readiness"
**What goes wrong:** G3 M5 passes because the DA section has evidence citations, but the citations do not address the readiness criterion.
**Why it happens:** Existing M2 already checks "every decision references evidence." M5 must go deeper: does the evidence address what the readiness criterion specifically asks for?
**How to avoid:** M5 instructions must explicitly distinguish from M2: "M2 checks evidence citations exist. M5 checks that the cited evidence addresses the specific readiness criterion from SCOPE.md." The evaluation should cross-reference SCOPE.md readiness text against the evidence described in DESIGN.md.
**Warning signs:** M2 passes but the design cites irrelevant evidence for a DA (e.g., readiness asks for "benchmark data" but evidence cited is API documentation).

### Pitfall 4: G4 S5 Punishing Valid Plan Structures
**What goes wrong:** G4 S5 flags advisory because a Deep DA has fewer tasks than a Light DA, but the plan is valid (one complex task vs many simple ones).
**Why it happens:** Task count is an imperfect proxy for implementation depth.
**How to avoid:** S5 is SHOULD (advisory), not MUST. The advisory message should acknowledge that task count is a heuristic: "Deep DA-2 has 1 task while Light DA-4 has 3 tasks. This may be intentional if DA-2's task is complex. Verify task coverage is proportional to DA importance."
**Warning signs:** Every plan gets a S5 advisory regardless of structure quality.

### Pitfall 5: G5 S4 Over-Penalizing Clear-Cut Resolutions
**What goes wrong:** G5 S4 flags advisory for clear-cut TDs where the resolution rationale is brief because the answer was obvious.
**Why it happens:** Clear-cut TDs (resolved directly by spike without user input or research) naturally have shorter rationales.
**How to avoid:** S4 should differentiate between needs-spike TDs that went through research vs clear-cut resolution. A clear-cut resolution that briefly explains the obvious choice is adequate. Only flag if the rationale does not mention the ambiguity at all.
**Warning signs:** Every spike gets S4 advisories on clear-cut TDs.

### Pitfall 6: Regression on Well-Formed Lifecycles
**What goes wrong:** Existing lifecycles that passed all gates now fail G2/G3 after the new MUST criteria are added.
**Why it happens:** The new criteria are stricter than what was previously enforced.
**How to avoid:** Success criterion 5 explicitly requires "gates that were previously passing continue to pass." The new G2 M5 should be satisfied by any lifecycle where the synthesizer produced readiness statuses (it always does per the prompt). The new G3 M5 should be satisfied by any lifecycle where evidence citations exist and are relevant (which M2 already enforces at a surface level). Verify by mentally tracing through a well-formed lifecycle.
**Warning signs:** Need to validate that synthesizer ALWAYS produces readiness status lines and that well-formed designs always cite readiness-relevant evidence.

## Code Examples

### G2 M5 Criterion Row (research/SKILL.md)
```markdown
| M5 | Every DA readiness criterion MET in SYNTHESIS.md | Read SYNTHESIS.md "## Decision Area" sections. For each DA, find "Readiness status:" line. Count MET vs NOT MET. State: "{N}/{M} DA readiness criteria MET. {NOT MET list if any}" | PASS/FAIL |
```

### G2 M5 Display Line
```
  M5: {PASS|FAIL} -- {N}/{M} DA readiness criteria MET{. NOT MET: DA-2, DA-5 if any}
```

### G3 M5 Criterion Row (design/SKILL.md)
```markdown
| M5 | Evidence citations address DA readiness criteria | For each DA, read readiness criterion from SCOPE.md. Check DESIGN.md DA section's evidence citations address that criterion (not just any evidence, but evidence relevant to the readiness criterion). State: "{N}/{M} DAs cite evidence addressing their readiness criteria" | PASS/FAIL |
```

### G3 M5 Display Line
```
  M5: {PASS|FAIL} -- {N}/{M} DAs cite evidence addressing their readiness criteria{. Gaps: DA-3 readiness criterion asks for benchmarks but citations only reference API docs}
```

### G4 S5 Criterion Row (plan/SKILL.md)
```markdown
| S5 | Task coverage reflects DA depth calibration | Read SCOPE.md DA depth levels (Deep/Standard/Light). Check that Deep DAs are not covered by fewer tasks or acceptance criteria than Light DAs. State: "Deep DAs: {DA-list with task counts}. Light DAs: {DA-list with task counts}. Depth-proportional: {yes|advisory}" | PASS/ADVISORY |
```

### G4 S5 Display Line
```
  S5: {PASS|ADVISORY} -- Deep DAs: DA-1 (3 tasks), DA-3 (2 tasks). Light DAs: DA-4 (1 task). Depth-proportional: yes
```

### G5 S4 Criterion Row (spike/SKILL.md)
```markdown
| S4 | Spike resolution addresses specific ambiguity | For each needs-spike TD, check the resolution rationale explains how it resolves the ambiguity described in the TD (from PLAN.md). A decision without ambiguity-specific reasoning is insufficient. State: "{N}/{M} spike resolutions address their specific ambiguity" | PASS/ADVISORY |
```

### G5 S4 Display Line
```
  S4: {PASS|ADVISORY} -- {N}/{M} spike resolutions address their specific ambiguity{. TD-2 resolution picks an option without explaining why the ambiguity is resolved}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| No DA readiness enforcement | Question-level sufficiency only (G2 M1-M4) | v1.0 | Gates check question coverage but not whether DA readiness criteria are actually MET |
| No readiness-to-evidence traceability | Evidence citations exist (G3 M2) | v1.0 | G3 checks citations exist but not whether they address readiness criteria |
| No depth calibration in plan gate | Task count checks (G4 M2) | v1.0 | G4 checks phase sizing but not whether sizing is proportional to DA depth |
| No ambiguity resolution check | Rationale presence (G5 M3) | v1.0 | G5 checks rationale exists but not whether it addresses the specific ambiguity |

**Upgrade path:** Each gate gains one new criterion. Existing criteria remain unchanged. The new criteria close the gap between "evidence exists" and "evidence addresses what was asked for."

## Open Questions

1. **SYNTHESIS.md format consistency**
   - What we know: prompt-research-synthesizer.md line 110 specifies `Readiness status: [MET / NOT MET]` per DA section
   - What's unclear: Whether real synthesizer output always follows this exact format (capitalization, spacing)
   - Recommendation: Make G2 M5 parsing flexible (case-insensitive, whitespace-tolerant). If readiness status line is absent for a DA, treat as NOT MET with an explanation.

2. **G3 M5 evaluation depth**
   - What we know: G3 already uses LLM judgment. M5 adds readiness criterion cross-referencing.
   - What's unclear: How verbose the evaluation should be for each DA (brief vs detailed justification)
   - Recommendation: Follow G3's existing pattern -- state evidence for each DA briefly (one sentence per DA). Example: "DA-1: readiness asks for implementation examples, evidence-batch-01.md Finding 3 provides 3 examples -- PASS"

3. **G4 S5 heuristic calibration**
   - What we know: Deep DAs should have more coverage than Light DAs
   - What's unclear: What "proportionally more" means numerically (2x? 1.5x? any difference?)
   - Recommendation: Do not use numeric thresholds. Use the simpler check: "no Deep DA should have fewer tasks than any Light DA." This avoids arbitrary multipliers and catches the obvious mismatches.

## Sources

### Primary (HIGH confidence)
- **research/SKILL.md** lines 669-760 -- Current G2 gate evaluation (Step 14) and outcome handling (Step 15)
- **design/SKILL.md** lines 435-508 -- Current G3 gate evaluation (Step 8)
- **plan/SKILL.md** lines 415-489 -- Current G4 gate evaluation (Step 7)
- **spike/SKILL.md** lines 316-419 -- Current G5 gate evaluation (Step 7)
- **prompt-research-synthesizer.md** line 110 -- SYNTHESIS.md readiness status format
- **prompt-sufficiency-evaluator.md** lines 57-73 -- DA depth calibration in sufficiency assessment
- **scope/SKILL.md** lines 333-337, 558-567 -- DA readiness criteria and depth calibration definitions
- **.planning/research/ARCHITECTURE.md** lines 36-51 -- DEFER-12 integration architecture
- **.planning/research/PITFALLS.md** lines 25-34, 87-99 -- P2 and P7 pitfall analysis
- **ROADMAP.md** lines 107-116 -- Phase 18 success criteria with MUST/SHOULD resolution
- **STATE.md** line 75 -- G4/G5 MUST vs SHOULD tension documented and resolved

### Secondary (MEDIUM confidence)
- **templates/state.yml.template** lines 59-70 -- gate_history schema (confirms no schema changes needed)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- All four SKILL.md files and their gate sections thoroughly read and understood
- Architecture: HIGH -- Gate criterion table pattern is well-established across 5 existing gates with consistent structure
- Pitfalls: HIGH -- Prior pitfall research (P2, P7) directly addresses this phase; roadmap already resolved MUST vs SHOULD

**Research date:** 2026-03-10
**Valid until:** 2026-04-10 (stable -- gate infrastructure is mature, no upstream changes expected)
