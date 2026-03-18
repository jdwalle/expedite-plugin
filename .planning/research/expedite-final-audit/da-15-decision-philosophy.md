# DA-15: Decision-Over-Steps Philosophy Persistence

## Summary

The "decision over steps" philosophy is deeply embedded through the **contract chain principle** — an unbroken traceability chain: Scope (decision areas + evidence requirements) → Research (evidence mapped to DAs) → Design (decisions per DA citing evidence) → Plan (tasks tracing to design decisions) → Execute (verification against design decisions).

However, the philosophy manifests unevenly. **Design, plan, spike, and execute** are strongly decision-oriented. **Scope** is moderate. **Research** is deliberately task-focused (evidence-gathering, not decision-making). **G1 and G4 gates are 100% structural** with no semantic evaluation of decision quality.

## q44: Skill Instruction Framing

| Skill | Decision Language | Output Framing | Mechanical Risk | Overall |
|-------|-------------------|----------------|-----------------|---------|
| Scope | Moderate — creates DAs but frames work as "interactive questioning" | Mixed (DAs + questions) | Steps 3,7,8 | **Moderate** |
| Research | Weak by design — agents explicitly told NOT to make decisions | Artifacts only | Steps 4,5,9,11,17 (nearly all) | **Weak** |
| Design | Strong — "design decisions" with evidence, trade-offs, confidence | Decisions with evidence | Steps 2,3,5,6 | **Strong** |
| Plan | Strong — tasks derived from decisions, TDs as first-class concept | Tasks from decisions + TDs | Steps 2,3,5 | **Strong** |
| Spike | Strong — entirely about resolving decisions with rationale | Resolved decisions | Steps 2,3,4 | **Strong** |
| Execute | Moderate — task-oriented but preserves chain through verification | Implementation + verification | Steps 2,3,4,5b,5d-f,6,7 | **Moderate** |
| Status | N/A — read-only display | N/A | N/A | **N/A** |

### Key Observations

- **Scope** uses "Decision Areas" as first-class concepts with evidence requirements typed as contracts. The prompt-scope-questioning reference explicitly states "Evidence requirements name DECISIONS (choices between alternatives), not STEPS (things to do)." But Step 5's adaptive refinement loop is framed as information gathering, not decision-making.

- **Research** is deliberately decision-free: web-researcher ("You do NOT make recommendations"), sufficiency-evaluator ("You do NOT make design decisions"), research-synthesizer ("You do NOT make design decisions"). This is architecturally correct but creates the longest mechanical stretch in the lifecycle.

- **Design** is the heart of the philosophy: every DA section requires Decision, Evidence, Trade-offs, and Confidence subsections. "No design decision may be invented without evidence basis."

- **Plan** introduces tactical decisions (TDs) — decisions deferred to implementation time. "Acceptance criteria are DERIVED from design decisions, NOT invented independently."

- **Execute** verification checks design decision alignment (YES/PARTIAL/NO) per criterion, with contract chain trace: Scope DA → Evidence → Design Decision → Task → Code Change.

## q45: Decision Artifact Flow Between Phases

### Flow Assessment

| Transition | Decision Artifacts | How Next Phase Uses Them | Assessment |
|-----------|-------------------|-------------------------|------------|
| Scope → Research | DAs with depth, readiness criteria, evidence requirements (typed contracts) | Evidence requirements become research agent targets; DA depth drives sufficiency thresholds | **STRONG** |
| Research → Design | SYNTHESIS.md (evidence by DA, contradictions, gaps), sufficiency ratings, DA readiness | Design-architect makes decisions per DA citing specific evidence; gaps acknowledged as Low confidence | **STRONG** |
| Design → Plan | DESIGN.md (per-DA decisions with evidence/trade-offs/confidence), open questions | Tasks derived from design decisions; open questions become tasks; TDs identified for deferred decisions | **STRONG** |
| Plan → Spike | PLAN.md (tasks with DA traceability, TD inventory per phase) | TDs classified and resolved; clear-cut resolved from design context; ambiguous go to user/researcher | **STRONG** |
| Spike → Execute | SPIKE.md (resolved TDs with rationale, implementation steps with traceability) | Task-implementer follows steps; verification checks design decision alignment end-to-end | **STRONG** |

### One Gap

The Research → Design transition is the only one where the upstream phase explicitly abstains from decisions. Research produces evidence but leaves all decision-making to design. This is architecturally correct but means the longest phase has no decision pressure. The design-architect agent forcefully reactivates decision-making mode, but an explicit "shift from evidence mode to decision mode" transition prompt would strengthen this.

## q46: Gate Validation — Structural vs Decision Quality

| Gate | Structural Criteria | Decision-Quality Criteria | Ratio | Semantic Layer |
|------|-------------------|--------------------------|-------|----------------|
| G1 (Scope) | 9 | 0 | **100% structural** | **None** |
| G2 (Research) | 8 | 4 (via gate-verifier) | 67% / 33% | Yes |
| G3 (Design) | 9 | 4 (via gate-verifier) | 69% / 31% | Yes |
| G4 (Plan) | 11 | 0 | **100% structural** | **None** |
| G5 (Spike) | 8 | 4 (via gate-verifier) | 67% / 33% | Yes |

### Critical Finding

**G1 and G4 are 100% structural with no semantic evaluation.** G1 cannot assess whether decision areas are well-chosen or evidence requirements are genuinely checkable. G4 cannot assess whether task decomposition follows logically from design decisions or acceptance criteria genuinely derive from them (it only checks for DA string proximity).

The gate-verifier agent's 4-dimension rubric (evidence_support, internal_consistency, assumption_transparency, reasoning_completeness) provides genuine decision-quality assessment on G2/G3/G5 but is absent from G1 and G4.

### "Quasi-Decision" Structural Proxies

Several gates use structural heuristics as weak proxies for decision quality:
- G3 M3: Checks for citation patterns (F1, evidence-*.md) but not citation validity
- G4 M5: Checks for DA strings near acceptance criteria but not whether criteria derive from the decision
- G5 M3: Checks for "rationale/reason/because" keywords — catches trivial rationale as easily as substantive

## q47: Philosophy Risk Points

### CRITICAL

**Risk 1 (HIGH): G1 gate validates only structure, not decision quality**
- G1 lets poor decisions through if fields are non-empty. Vague evidence requirements like "thorough understanding" pass G1 but make sufficiency evaluation meaningless downstream. The scope gate is the first quality boundary — if it fails, the contract chain degrades from the origin.

**Risk 2 (HIGH): G4 gate validates only structure, not decision quality**
- G4 checks DA string proximity to acceptance criteria as a proxy for derivation. Claude can satisfy this with superficial compliance — mentioning DA-1 without actually tracing from the design decision. Plan is the bridge from decisions to execution.

### HIGH

**Risk 3 (MEDIUM): Research phase is a mechanical zone by design**
- Research agents spend 12+ steps in purely mechanical mode. While architecturally correct, this creates a long stretch without decision pressure. An LLM operating mechanically for 12+ steps may carry that posture into design.

**Risk 4 (MEDIUM): Scope Step 5 adaptive refinement lacks decision framing**
- Step 5 is framed as "bridge knowledge gaps" rather than "identify critical decisions." The prompt-scope-questioning reference partially compensates, but Step 5's own instructions don't use decision language.

### MEDIUM

**Risk 5 (LOW): Templates are purely structural scaffolds**
- All 6 templates have null fields with no decision-prompting content. Missed opportunity to reinforce the philosophy at initialization.

**Risk 6 (LOW-MEDIUM): Agent prompts lack explicit "decision over steps" framing**
- No agent prompt references the philosophy by name. Design-architect and spike-researcher are naturally decision-oriented, but research agents and sufficiency-evaluator could benefit from explicit framing.

**Risk 7 (MEDIUM): Structural gate "quasi-decision" checks are weak proxies**
- Citation pattern matching, DA string proximity, and keyword rationale checks can be satisfied with superficial compliance.

**Risk 8 (LOW): No decision-quality prompts in micro-interaction loops**
- Design/plan/execute revision cycles ask "proceed / revise / pause" without prompting users to evaluate decision quality specifically.

## Recommendations for Strengthening the Philosophy

### Priority 1: Add semantic layer to G1 and G4

**G1 (Scope):** Dispatch gate-verifier to assess: Are DAs well-differentiated? Are readiness criteria genuinely checkable? Are evidence requirements specific enough? Do questions target decisions, not tasks?

**G4 (Plan):** Dispatch gate-verifier to assess: Do acceptance criteria genuinely derive from cited design decisions? Is task decomposition logical? Are TDs identified for genuinely ambiguous choices?

### Priority 2: Add decision-framing language to scope Step 5

Reframe from "bridge knowledge gaps" to "identify and define the decisions this lifecycle needs to make." Add: "For each refinement category, ask: What decision will we need to make here? What evidence would change that decision?"

### Priority 3: Add transition prompts at phase boundaries

At each completion message:
- Scope → Research: "Research will gather evidence to inform these decisions: [list DAs]."
- Research → Design: "You now have evidence for [N] DAs. Design will make explicit decisions grounded in this evidence."
- Design → Plan: "The design contains [N] decisions. Plan will decompose each into executable tasks with traceability."
- Plan → Spike/Execute: "The plan identifies [N] tactical decisions that need resolution."

### Priority 4: Add decision-prompting comments to templates

- `questions.yml.template`: `# Each question should target a DECISION between alternatives, not a task`
- `state.yml.template`: `# The lifecycle tracks decisions, not tasks`

### Priority 5: Strengthen sufficiency evaluator's decision framing

Reframe from "mechanically check requirements" to "assess whether the evidence base enables confident decision-making." Add dimension: "Does the evidence present enough alternatives and trade-offs for informed design decisions?"
