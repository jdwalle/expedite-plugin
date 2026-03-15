# Quality & Validation Patterns Research

## Category Overview

Quality validation in LLM agent systems faces a fundamental challenge: the evaluating LLM may be biased toward its own output ("rubber stamp" problem). This category explores code-enforced, multi-agent, and hybrid validation patterns. Serves DA-5 (Quality Gate Enforcement) and DA-8 (Resume and Recovery).

## Key Findings

### The "Rubber Stamp" Problem — Evidence

Academic research confirms multiple biases in LLM-as-judge evaluation:

**Self-preference bias**: LLMs assign higher scores to outputs more "familiar" to their own generation policy, as measured by lower perplexity. An LLM judge favors arguments from agents of the same model family (Source: arXiv 2411.15594, Survey on LLM-as-a-Judge).

**Position bias**: In pairwise judging, simply swapping presentation order can shift accuracy by 10%+ (Source: evidentlyai.com LLM-as-judge guide).

**Verbosity bias**: Longer responses receive higher scores regardless of quality.

**Adversarial vulnerability**: Even nonsense responses can trick evaluators into high rankings if presented in persuasive style.

**Domain blindness**: Judges lacking domain knowledge miss important errors in specialized fields.

**Key finding**: Single-model self-evaluation is the weakest validation pattern. LLM judges align with human preferences ~80% of the time but require bias mitigation (Source: multiple studies cross-referenced in arXiv survey).

### Validation Pattern Taxonomy

#### Pattern 1: Structural Validation (Code-Enforced)

Validate output structure without LLM judgment:
- File exists? Has required sections? Meets minimum length?
- JSON/YAML schema validation (Pydantic, JSON Schema)
- Regex pattern matching for required elements
- Count-based checks (e.g., "at least 3 questions", "every DA has a decision")

**Enforcement surface**: PreToolUse hooks (validate before Write), PostToolUse hooks (validate after creation), standalone scripts.

**Expedite mapping**: G1 (Scope) and G4 (Plan) gates are primarily structural — "SCOPE.md exists", "3+ questions", "DA coverage". These can be fully code-enforced.

#### Pattern 2: Separate Judge (Different Model)

Use a different LLM to evaluate output, reducing self-preference bias:
- Producer uses Sonnet → Judge uses Opus (or vice versa)
- Cross-model evaluation reduces same-model bias
- Can use a specialized judge prompt optimized for evaluation

**Evidence**: Multi-LLM evaluator frameworks show that using different models as judges catches errors that same-model evaluation misses. The diversity of "reasoning strategies" across models is the key benefit.

#### Pattern 3: Multi-Agent Verification

Multiple agents evaluate from different perspectives:

**AIME framework**: Concatenates independent evaluations (syntax, logic, correctness, readability, efficiency, redundancy) — each agent focuses on one dimension. Approximates optimal evaluation policy.

**Multi-Agent Judge with Debate**: Critic, defender, and judge roles simulate adversarial reasoning. Smaller models (Qwen3-14B) can approximate GPT-4o reasoning depth through structured debate.

**RADAR**: Role-specialized decomposition — security auditor, vulnerability detector, counterargument critic, holistic arbiter — with multi-round debate and distributional prior updates to mitigate bias.

**claude-agentic-framework**: `/swarm-review` spawns 5 parallel reviewers examining security, performance, architecture, test coverage, and code quality. Multiple passes refine until clean.

#### Pattern 4: Rubric + Reasoning Dual-Layer

Separate structural rubric validation from reasoning soundness:
- **Layer 1 (Rubric)**: Code-enforced structural checks (Pattern 1)
- **Layer 2 (Reasoning)**: Separate agent evaluates logical soundness

This is the pattern expedite already conceptualized (Phase 24 verifier design):
- Rubric validation: sufficiency evaluator checks coverage metrics
- Logical validation: verifier agent checks reasoning quality

**Evidence supports this**: Rubric validation catches "did you check all boxes?" while reasoning validation catches "are your conclusions actually supported by your evidence?"

#### Pattern 5: Hook-Based Gate Enforcement

Use Claude Code hooks as the enforcement surface:

**PreToolUse hook on Write**: Before state.yml is written, validate:
- Phase transition is valid (FSM check)
- Required gate passed before phase advancement
- Gate results recorded in state

**PostToolUse hook on Write**: After artifact is created, validate:
- Structural requirements met
- Required sections present
- Schema validation passes

**Prompt hook for quality evaluation**:
```json
{
  "type": "prompt",
  "prompt": "Evaluate whether this design document covers all decision areas with evidence-backed decisions. Return yes/no with reasoning."
}
```

**Agent hook for deep verification**:
```json
{
  "type": "agent",
  "prompt": "Read DESIGN.md and SCOPE.md. Verify every decision area has a decision with evidence references. Report any gaps.",
  "timeout": 60
}
```

#### Pattern 6: Deterministic Rule Engine

claude-code-harness's TypeScript guardrail engine (9 rules, R01-R09):
- Rules compiled and type-checked at build time
- Deterministic evaluation — same input always produces same result
- No LLM judgment involved for structural rules
- Testable with standard unit testing frameworks

**Key insight**: The most reliable gates are the ones that don't involve LLM judgment at all. Structural validation through deterministic code eliminates the rubber stamp problem entirely.

### Gate-State Integration Patterns

#### Gates as State Transition Guards
Phase transitions in state should only advance when a gate passes:
```
scope_in_progress → [G1 passes] → scope_complete
research_in_progress → [G2 passes] → research_complete
```

A PreToolUse hook on Write to state.yml can enforce:
1. Parse proposed state.yml content
2. Check if phase is changing
3. If advancing to `_complete`, verify gate result exists in gate_history with `outcome: "go"` or `outcome: "go-with-advisory"`
4. Block write if gate hasn't passed

#### Gate Results as Checkpoint Data
Store gate results with enough context for deterministic resume:
```yaml
gate_history:
  - gate: G1
    timestamp: 2026-03-11T10:30:00Z
    outcome: go
    must_passed: 6
    must_failed: 0
    # Resume-relevant: what artifacts existed when gate passed
    artifacts_at_gate: [SCOPE.md]
```

On resume after a passed gate, the system can verify artifacts still exist and haven't been corrupted.

### Override and Audit Patterns

#### Auditable Override (expedite's existing design)
Expedite already has a good override pattern:
- Overrides produce `override-context.md` artifact
- Severity classification
- Affected DAs documented
- `overridden: true` in gate_history

**Enhancement opportunity**: A PostToolUse hook that fires when gate_history is updated with `overridden: true` could:
- Log to an append-only audit trail
- Notify the user (Notification hook)
- Record override context in a separate, immutable file

#### ROE Gate (Reference Monitor Pattern)
ROE Gate (roegate.io) implements:
- Cryptographic action signing
- Isolated judge LLM (separate from producing LLM)
- Deterministic rule engine

This is overkill for expedite but demonstrates the principle: enforcement should be architecturally separate from production.

### Idempotency of Gate Evaluation

Re-running a gate should produce consistent results. Strategies:
1. **Cache gate results**: If gate input hasn't changed (hash check), return cached result
2. **Structural gates are naturally idempotent**: Same artifact → same structural evaluation
3. **LLM-based gates are NOT idempotent**: Different runs may produce different scores. Mitigate with:
   - Higher temperature = 0 for evaluation prompts
   - Structured output format (force yes/no with evidence list)
   - Multiple runs with majority vote

## Sources

- [Survey on LLM-as-a-Judge (arXiv 2411.15594)](https://arxiv.org/abs/2411.15594)
- [Agent-as-a-Judge for LLMs (arXiv 2508.02994)](https://arxiv.org/html/2508.02994v1)
- [LLM-as-a-Judge complete guide (evidentlyai)](https://www.evidentlyai.com/llm-guide/llm-as-a-judge)
- [LLM-as-a-Judge practical guide (labelyourdata)](https://labelyourdata.com/articles/llm-as-a-judge)
- [LLM as a Judge primer (Arize)](https://arize.com/llm-as-a-judge/)
- [Using LLMs for Evaluation (Cameron Wolfe)](https://cameronrwolfe.substack.com/p/llm-as-a-judge)
- [Multi-Agent Debate for Safety Evaluation (arXiv 2511.06396)](https://arxiv.org/pdf/2511.06396)
- [Auditing Multi-Agent Reasoning Trees (arXiv 2602.09341)](https://arxiv.org/pdf/2602.09341)
- [LLM-as-Judge Best Practices (Monte Carlo Data)](https://www.montecarlodata.com/blog-llm-as-judge/)
- [Multi-LLM Evaluator Framework (Emergent Mind)](https://www.emergentmind.com/topics/multi-llm-evaluator-framework)
- [ROE Gate](https://roegate.io)
- [claude-code-harness guardrail engine](https://github.com/Chachamaru127/claude-code-harness)
- [Claude Code Hooks reference (prompt/agent hooks)](https://code.claude.com/docs/en/hooks)
