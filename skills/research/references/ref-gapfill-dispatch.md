# Gap-Fill Dispatch Details

Read by the research orchestrator when entering Step 16 (user approved gap-fill after G2 Recycle).

---

## Re-Batch by Decision Area

Group deficient questions by `decision_area` — this differs from first-round source-affinity batching. DA-based batching ensures gap-fill agents have full context for all gaps within a single decision area.

Each DA becomes one batch. Within each batch, include:
- `batch_id`: sequential identifier (e.g., "batch-gap-01", "batch-gap-02")
- `decision_area`: the DA name
- `questions`: array of question objects, each containing:
  - `id`: question ID
  - `text`: question text
  - `priority`: P0, P1, or P2
  - `decision_area`: DA name
  - `evidence_requirements`: full evidence requirements string from SCOPE.md
  - `gap_details`: the evaluator's gap description from state.yml
  - `existing_evidence_files`: list of evidence file paths already collected (so agents avoid duplication)

Display the gap-fill batch plan:
```
--- Gap-Fill Batch Plan ---

Batch gap-01 (DA: {decision_area}) - {N} questions:
  [{priority}] {id}: {text}
    Gap: {gap_details summary}
  ...

--- {total_questions} questions across {total_batches} DA batches ---
```

---

## Dispatch Modifications to Phase 5 Pipeline

Use the SAME dispatch pipeline as Steps 7-11, with these modifications:

1. **Narrowed question set:** Only deficient questions, not the full question plan.

2. **DA-based batches:** Use the batches above instead of source-affinity batches.

3. **Gap context injection:** Add a `<gap_context>` block to the template's input_data section:
   ```
   <gap_context>
   The following questions have been previously researched but evidence gaps remain.
   Focus on finding the SPECIFIC missing evidence described in each gap_details field.
   Do NOT duplicate existing findings -- read the existing evidence files first.

   {For each question:}
   Question: {question_id} - {question_text}
   Current status: {status}
   Gap details: {gap_details}
   Existing evidence: {existing_evidence_files}
   </gap_context>
   ```

4. **Output path:** Evidence files written to `.expedite/research/round-{research_round}/supplement-{DA-slug}.md` where `{DA-slug}` is the DA name lowercased with spaces replaced by hyphens. These are **additive** — originals never overwritten.

5. **Parallel dispatch:** Same 3-agent max concurrency as first-round dispatch.

6. **Template assembly:** Use the same per-source templates (web-researcher, codebase-analyst, mcp-researcher). Fill the same placeholders as Step 8. Add the gap_context injection after the questions_yaml_block.

7. **Source selection:** For each DA batch, determine the source based on gap_details recommendations. If gap_details suggests specific sources, use those. Otherwise, default to web search. The source determines which template to use.

---

## After Gap-Fill Completes

1. **Dynamic question discovery:** Collect any `PROPOSED_QUESTIONS` from gap-fill agent summaries and append to `.expedite/research/proposed-questions.yml`.

2. **Update evidence_files in state.yml:** For each question that received gap-fill evidence, append the new supplement file paths to the question's `evidence_files` array using the backup-before-write pattern.

3. **Display gap-fill summary:**
   ```
   --- Gap-Fill Complete (Round {research_round}) ---

   Supplement files produced: {count}
   Decision Areas covered: {count}
   Files:
     {list each supplement file path}
   ```

4. **Return to Step 12** to re-assess sufficiency with the new evidence.

**Loop structure:** Step 12 → 13 → 14 → 15 → 16 → back to Step 12. Continues until G2 passes or user overrides.
