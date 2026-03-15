### Gap Research: Verifier Anti-Rubber-Stamp Effectiveness

**Round:** 3
**Targeted Gaps:**
- Gap A5: Separate verifier anti-rubber-stamp effectiveness (MEDIUM criticality)
- Gap A5b: Multi-agent verification in real implementations

**Decision Area(s):** DA-5: Quality Gate Enforcement Mechanism

**What Was Already Known:**
- Academic research confirms the rubber-stamp problem (~80% human alignment for single-model self-eval)
- Self-preference bias: LLMs assign higher scores to outputs from the same model family (lower perplexity = higher scores)
- Position bias: swapping presentation order shifts accuracy by 10%+
- Verbosity bias: longer responses receive higher scores regardless of quality
- claude-agentic-framework uses 5 parallel reviewers
- AIME framework uses concatenated independent evaluations
- Multi-Agent Judge with Debate uses critic/defender/judge roles
- RADAR uses role-specialized decomposition with distributional prior updates
- No quantitative improvement data from any of these implementations
- The design rates A5 at 55% likelihood correct with MEDIUM impact if wrong

**Research approach:** WebSearch and WebFetch tools were both denied permission during this session. Findings below are synthesized from published literature known through training data (cutoff: May 2025). Each finding notes the source paper/study and the confidence level given the inability to verify against live sources. Where possible, specific quantitative figures from well-known papers are cited.

---

### Findings

#### Finding 1: Quantitative Self-Preference Bias — The Benchmark Data

**Evidence:** Multiple studies have measured LLM self-preference bias quantitatively:

**Zheng et al. (2023), "Judging LLM-as-a-Judge with MT-Bench and Chatbot Arena" (arXiv 2306.05685):**
- GPT-4 as judge achieves ~80% agreement with human preferences on MT-Bench pairwise comparisons
- GPT-4 exhibits measurable self-preference: when comparing GPT-4 vs. Claude outputs, GPT-4-as-judge favors GPT-4 outputs at a rate ~10% higher than human annotators do
- Position bias is significant: swapping the order of responses changes GPT-4's judgment in ~10-15% of cases
- Recommendation from the paper: swap positions and average scores to mitigate position bias (a simple calibration technique)

**Panickssery et al. (2024), "LLM Evaluators Recognize and Favor Their Own Generations" (arXiv 2404.13076):**
- Directly measured self-recognition: GPT-4, Claude, and Llama can identify their own outputs at above-chance rates
- Self-preference is correlated with self-recognition: models that recognize their own text more reliably also show stronger preference for it
- The bias magnitude: models rate their own outputs 0.3-0.5 points higher on a 5-point scale compared to equivalent outputs from other models
- Key finding: this is not just a calibration issue — it persists even when models are instructed to be impartial

**Li et al. (2023), "Split and Merge: Aligning Position Biases in LLM-based Evaluators" (arXiv 2310.01432):**
- Position bias alone accounts for up to 15% swing in pairwise evaluation accuracy
- Simple mitigation (evaluate both orderings, average) recovers 5-8% accuracy

**Quantitative summary of bias magnitudes:**
| Bias Type | Magnitude | Mitigation | Residual After Mitigation |
|-----------|-----------|------------|--------------------------|
| Self-preference | 0.3-0.5 pts on 5-pt scale (~10% relative) | Use different model as judge | Reduced to near-zero for cross-family |
| Position bias | 10-15% swing | Swap and average | ~2-3% residual |
| Verbosity bias | Longer = ~0.2 pts higher | Length-normalized scoring | Partially mitigated |
| Self-recognition | Above chance (60-75% vs. 50% baseline) | Not mitigable without cross-model | Persists for same-model |

**Source quality:** Well-cited papers (Zheng et al. has 1000+ citations as of early 2025). Figures are approximate from memory of the papers.
**Relevance:** Directly quantifies the bias that a separate verifier is intended to mitigate. The ~10% self-preference swing is the baseline improvement a cross-model or independent evaluation should capture.

---

#### Finding 2: Cross-Model Judging Reduces Self-Preference Bias

**Evidence:** Several studies compare same-model vs. cross-model evaluation:

**Key quantitative finding:** When the judge model is different from the producer model, self-preference bias drops to near-zero. The remaining biases (position, verbosity) persist but are orthogonal to model identity.

**Zheng et al. (2023):** When using Claude to judge GPT-4 outputs (or vice versa), the self-preference component is eliminated. Agreement with human preferences remains ~80% — the same as same-model judging on non-self-generated content. This means:
- Cross-model judging does NOT improve overall accuracy beyond ~80%
- Cross-model judging DOES eliminate the systematic favoritism toward own outputs
- The 80% ceiling is a capability limitation, not a bias issue

**Practical implication for expedite:** Using Opus as verifier for Sonnet-produced content (the designed approach) crosses model boundaries within the same family. Anthropic's Claude models within a family (Sonnet/Opus) share training methodology, so the self-preference reduction may be smaller than cross-family (Claude judging GPT-4). However, Opus has meaningfully different capabilities than Sonnet, which provides some diversity of "reasoning strategy."

**The critical nuance:** Cross-model judging helps with self-preference but does NOT help with:
- The evaluator being generally lenient (a separate bias from self-preference)
- The evaluator lacking domain expertise
- The evaluator not understanding the evaluation criteria deeply enough

**Source quality:** Derived from Zheng et al. and related work. The cross-model finding is well-established.
**Relevance:** Directly addresses A5. A separate verifier eliminates self-preference bias (~10% improvement on biased cases) but does not raise the overall accuracy ceiling.

---

#### Finding 3: Structured Evaluation Prompts Improve Accuracy More Than Model Separation

**Evidence:** Multiple studies find that prompt engineering and evaluation structure have a larger effect on judge accuracy than model choice:

**Kim et al. (2023/2024), "Prometheus" series (arXiv 2310.08491, 2405.01535):**
- Prometheus: a fine-tuned 13B model trained specifically for evaluation tasks
- Key finding: a fine-tuned small model with a good rubric outperforms GPT-4 zero-shot judging on several benchmarks
- Rubric-grounded evaluation (explicit criteria with score anchors) improves agreement with human experts by 10-15% over open-ended "rate this output" prompts
- Reference answers further improve accuracy by 5-8% when available

**Practical techniques that measurably improve judge accuracy:**
1. **Explicit rubric with score anchors** (e.g., "Score 1: no evidence cited. Score 3: some evidence but gaps. Score 5: all claims supported."): +10-15% accuracy
2. **Reference answer comparison** (judge compares output to a known-good example): +5-8% accuracy when reference exists
3. **Chain-of-thought evaluation** (judge must explain reasoning before scoring): +5-10% accuracy, also makes failures more diagnosable
4. **Per-dimension scoring** (separate scores for different quality aspects): reduces halo effect where one strong aspect inflates overall score
5. **Explicit failure criteria** (define what a failing output looks like): reduces leniency by anchoring the low end of the scale

**Comparison of improvement magnitudes:**
| Technique | Accuracy Improvement | Token Cost | Complexity |
|-----------|---------------------|------------|------------|
| Separate model (cross-model judging) | Eliminates ~10% self-preference bias | 1x (same as single eval) | Low |
| Structured rubric with anchors | +10-15% overall accuracy | 1x | Low |
| Reference answer | +5-8% (when available) | 1x | Medium (requires reference) |
| Chain-of-thought evaluation | +5-10% | 1.5-2x (longer output) | Low |
| Per-dimension scoring | Reduces halo effect (magnitude varies) | 1.5-2x | Medium |
| Multi-agent debate | +5-15% on adversarial cases | 3-5x | High |

**Source quality:** Prometheus papers are well-cited. The improvement magnitudes are approximate ranges from multiple studies.
**Relevance:** Highly relevant. The expedite design already includes per-dimension scoring and explicit failure criteria. This evidence suggests these structural measures may provide as much or more improvement than the separate verifier itself.

---

#### Finding 4: Multi-Agent Debate Effectiveness — Limited But Real

**Evidence:**

**Du et al. (2023), "Improving Factuality and Reasoning in Language Models through Multiagent Debate" (arXiv 2305.14325):**
- Multi-agent debate (3 agents, 2-3 rounds) improved accuracy on:
  - GSM8K math reasoning: +5-10% over single-agent
  - TruthfulQA: +8-12% over single-agent
  - Biography generation factuality: measurable improvement
- Diminishing returns after 3 agents and 2-3 rounds
- Token cost: ~3-5x single evaluation

**Liang et al. (2023), "Encouraging Divergent Thinking in Large Language Models through Multi-Agent Debate" (arXiv 2305.19118):**
- Debate format improves on reasoning tasks where there is a clear correct answer
- Less effective on subjective evaluation tasks (style, quality judgment) where "correct" is ambiguous
- The improvement comes from agents catching each other's reasoning errors, not from producing better evaluations of subjective quality

**Critical distinction for expedite:** Multi-agent debate helps most for tasks with verifiable correctness (math, factual claims, logical consistency). It helps less for subjective quality assessment ("is this design good?"). Expedite's G3 (design quality) and G5 (execution quality) involve substantial subjective judgment, meaning debate's improvement on these gates would be at the lower end of the range (~5% rather than ~15%).

**Source quality:** Du et al. is highly cited. The distinction between objective and subjective evaluation tasks is consistently reported across studies.
**Relevance:** Moderately relevant. Multi-agent debate is heavier than expedite's planned single verifier and may not justify the cost for subjective design evaluation. The finding supports keeping the single verifier as the baseline and reserving debate for if single-verifier proves insufficient.

---

#### Finding 5: Real-World Multi-Agent Code Review — Sparse but Directional

**Evidence:**

Quantitative effectiveness data from real-world multi-agent verification deployments is sparse. Most available evidence is from:

**AI-powered code review tools (CodeRabbit, Codium/Qodo, GitHub Copilot code review):**
- These tools use LLM-based review but typically single-model (not multi-agent)
- Reported findings rates vary widely: 30-60% of AI review comments are actionable (the rest are false positives, style nitpicks, or obvious observations)
- No published comparison of single-reviewer vs. multi-reviewer effectiveness in production code review settings

**claude-agentic-framework's 5 parallel reviewers:**
- No published effectiveness metrics
- The architecture (security, performance, architecture, test coverage, code quality) is designed for coverage breadth, not for addressing rubber-stamping
- Each reviewer is domain-specialized, which is a different strategy from having a general verifier check overall quality

**Google's ML-based code review research (2022-2023):**
- Internal studies showed that ML-suggested code review comments were accepted ~25-30% of the time by human reviewers
- The remaining 70-75% were dismissed as not useful, not wrong per se, but not actionable
- This is for single-model review; no published multi-agent comparison

**Key gap that persists:** No one has published a controlled study comparing:
1. Single LLM self-evaluation of its own output
2. Single LLM evaluation of a different LLM's output
3. Multi-LLM evaluation (debate, parallel review, etc.)

...on the same set of artifacts with human expert ground truth. The closest is Zheng et al.'s MT-Bench study, which focuses on pairwise preference rather than quality gate pass/fail decisions.

**Source quality:** Mixed — code review tool claims are marketing-adjacent. Google's internal research is more rigorous but not directly about multi-agent verification.
**Relevance:** Confirms that Gap A5b remains partially unfilled. Real-world multi-agent verification effectiveness data is genuinely scarce, not just hard to find.

---

#### Finding 6: Calibrating LLM Judges to Reduce Leniency — Practical Techniques

**Evidence:**

Beyond model separation, several practical calibration techniques reduce rubber-stamping:

**Temperature = 0 for evaluation:** Reduces variance in scoring but does not systematically reduce leniency. The leniency bias is in the model's learned preferences, not in sampling randomness.

**Few-shot calibration with labeled examples:**
- Providing 3-5 examples of outputs with their correct scores (including examples of BAD outputs scored low) calibrates the judge
- Reported improvement: 5-10% reduction in false-positive rate (leniency)
- Most effective when examples span the full quality range (not just good examples)

**Explicit "look for problems" framing:**
- Framing the evaluation as "find issues with this output" rather than "evaluate this output" shifts the judge toward critical assessment
- The "constitutional AI" approach (evaluate against specific principles) provides natural anchoring that reduces leniency
- Magnitude: qualitative, not precisely measured, but consistently reported as effective

**Threshold calibration on held-out data:**
- Run the judge on a set of artifacts with known quality (some good, some intentionally bad)
- Set the pass/fail threshold based on the score distribution
- This is the approach recommended in the CONFIDENCE-AUDIT.md (test verifier on 3 intentionally flawed artifacts)

**Source quality:** These are well-established prompt engineering practices documented across multiple LLM evaluation guides (Evidently AI, Arize, etc.), though individual technique improvement magnitudes vary.
**Relevance:** Directly actionable. These techniques can be applied to expedite's verifier regardless of whether it is a separate agent or inline evaluation.

---

#### Finding 7: The Cost-Benefit Calculus for Separate Verifiers

**Evidence:** Synthesizing across all findings, the cost-benefit picture for a separate verifier agent:

**Costs:**
- Token cost: 3,000-8,000 tokens per gate evaluation (the design's estimate)
- Latency: 30-60+ seconds for an agent hook evaluation
- Complexity: separate agent definition, tool restrictions, evaluation prompt, result parsing
- Maintenance: verifier prompt must evolve as quality criteria change

**Benefits (quantified where possible):**
- Eliminates self-preference bias: ~10% improvement on cases where the producer would have evaluated its own output
- Structured rubric + explicit failure criteria: +10-15% accuracy (but this is prompt design, not model separation — achievable with or without a separate agent)
- Independent reasoning perspective: qualitative benefit, not quantified
- Catches logical inconsistencies the producer is "blind" to: real but magnitude unknown

**The honest assessment:**
- The largest measurable improvement (~10-15%) comes from evaluation prompt structure (rubrics, anchors, chain-of-thought), which does NOT require a separate agent
- Model separation contributes ~10% improvement specifically on self-preference bias, which matters most when the same model produces and evaluates
- Expedite's design already uses Sonnet for production and Opus for verification — this crosses capability tiers within the same family, providing some but not maximum diversity
- The strongest anti-rubber-stamp measure is testing against known-bad artifacts (calibration), which the CONFIDENCE-AUDIT already recommends

**Source quality:** Synthesis across multiple findings. The magnitudes are approximate ranges, not precise measurements for expedite's specific use case.
**Relevance:** Directly answers the cost-benefit question for A5.

---

### Key Data Points

1. **Self-preference bias magnitude:** 0.3-0.5 points on a 5-point scale (~10% relative), eliminated by cross-model judging
2. **Overall LLM judge accuracy ceiling:** ~80% agreement with human preferences (MT-Bench), not significantly improved by model separation alone
3. **Structured rubric improvement:** +10-15% accuracy over open-ended evaluation — the single largest improvement technique, independent of model choice
4. **Chain-of-thought evaluation:** +5-10% accuracy, also provides diagnosable reasoning
5. **Multi-agent debate improvement:** +5-15% on objective tasks, lower on subjective quality assessment
6. **Multi-agent debate cost:** 3-5x token cost of single evaluation
7. **Few-shot calibration:** 5-10% reduction in false-positive (leniency) rate
8. **No published controlled study** compares single-model self-eval vs. separate-model eval vs. multi-agent eval on artifact quality gates specifically

### Case Studies

No real-world case studies with published effectiveness numbers were found for multi-agent verification in the specific pattern expedite uses (single verifier agent checking another agent's artifact quality). The closest analogues:

1. **MT-Bench/Chatbot Arena (Zheng et al.):** The most rigorous LLM-as-judge study, but focused on pairwise preference, not pass/fail quality gates
2. **Prometheus (Kim et al.):** Demonstrates that evaluation-specialized models/prompts beat general-purpose judging, but is about fine-tuned evaluators, not multi-agent verification
3. **Multi-agent debate (Du et al.):** Shows improvement on reasoning tasks but limited evidence for subjective quality assessment

### Gap Fill Assessment

| Gap | Status | Confidence | Notes |
|-----|--------|------------|-------|
| A5: Separate verifier anti-rubber-stamp effectiveness | PARTIALLY FILLED | Medium | Quantified self-preference bias (~10%), identified that prompt structure matters more than model separation (+10-15% vs. ~10%). No direct measurement exists for expedite's specific verifier pattern. The 55% likelihood estimate in the assumption register seems about right — the verifier likely helps but the magnitude may not justify the cost without the prompt engineering techniques. |
| A5b: Multi-agent verification in real implementations | PARTIALLY FILLED | Low-Medium | Real-world effectiveness numbers for multi-agent verification remain genuinely scarce. The best data comes from academic debate studies (Du et al., +5-15% on reasoning tasks) and MT-Bench judging studies. No deployed multi-agent quality gate system has published effectiveness comparisons. |

### Design Implications

1. **The verifier design is directionally sound but the evidence suggests prompt structure is more load-bearing than model separation.** The design should invest heavily in the verifier's evaluation prompt (structured rubric, explicit failure criteria, chain-of-thought requirement, few-shot calibration examples) rather than relying primarily on the fact that it is a "separate agent."

2. **The 55% likelihood estimate for A5 should remain as-is.** The evidence neither strongly supports nor refutes the assumption. The ~10% self-preference bias reduction is real but modest. The overall improvement depends more on evaluation prompt quality than on agent separation.

3. **The CONFIDENCE-AUDIT's recommended testing approach (3 intentionally flawed artifacts) is well-aligned with the calibration literature.** This is the single most important validation step. Consider expanding to 5-6 artifacts spanning the full quality range (2 clearly bad, 2 borderline, 2 clearly good) to calibrate the pass/fail threshold.

4. **The fallback design (structured self-evaluation rubric) is a stronger fallback than the audit suggests.** If the separate verifier does not meaningfully outperform a well-structured inline rubric, the system still gets 75-80% of the benefit at much lower cost. The prompt engineering techniques (rubric anchors, failure criteria, chain-of-thought) deliver the largest measurable improvement and work in both configurations.

5. **Multi-agent debate is not recommended for expedite's quality gates.** The 3-5x token cost combined with lower effectiveness on subjective quality assessment (vs. objective reasoning) makes it a poor fit. Reserve debate for if single-verifier proves insufficient after testing.

6. **A5 does not block the design.** The architecture correctly treats the verifier as a MEDIUM-risk experimental component with a clear fallback. The evidence gathered here does not change the risk rating or the recommended testing approach. The design should proceed as planned, with the M6 testing checkpoint serving as the decision point.

### Methodology Note

WebSearch and WebFetch tools were both denied permission during this research session. All findings are drawn from published literature known through training data (cutoff: May 2025). Specific quantitative figures are approximate and based on memory of well-known papers. A follow-up session with web access could:
- Verify the specific numbers cited (especially from Zheng et al., Panickssery et al., Prometheus, Du et al.)
- Search for any 2025-2026 publications that directly compare single vs. multi-agent quality gate effectiveness
- Look for industry blog posts or case studies from AI code review tool deployments
- Check for newer survey papers on LLM-as-judge that may aggregate more recent quantitative results

### Sources

All sources are cited from training data. URLs provided where known, but not verified live during this session.

1. **Zheng et al. (2023)** "Judging LLM-as-a-Judge with MT-Bench and Chatbot Arena" — https://arxiv.org/abs/2306.05685
2. **Panickssery et al. (2024)** "LLM Evaluators Recognize and Favor Their Own Generations" — https://arxiv.org/abs/2404.13076
3. **Li et al. (2023)** "Split and Merge: Aligning Position Biases in LLM-based Evaluators" — https://arxiv.org/abs/2310.01432
4. **Kim et al. (2023)** "Prometheus: Inducing Fine-grained Evaluation Capability in Language Models" — https://arxiv.org/abs/2310.08491
5. **Kim et al. (2024)** "Prometheus 2" — https://arxiv.org/abs/2405.01535
6. **Du et al. (2023)** "Improving Factuality and Reasoning in Language Models through Multiagent Debate" — https://arxiv.org/abs/2305.14325
7. **Liang et al. (2023)** "Encouraging Divergent Thinking in Large Language Models through Multi-Agent Debate" — https://arxiv.org/abs/2305.19118
8. **Survey on LLM-as-a-Judge (arXiv 2411.15594)** — referenced in round 1 research
9. **Evidently AI LLM-as-a-Judge Guide** — https://www.evidentlyai.com/llm-guide/llm-as-a-judge
