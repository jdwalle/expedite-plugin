# Gap Research: LLM Denial-Retry Patterns

**Round:** 3
**Targeted Gaps:**
- Gap A3: LLM deny-override-retry reliability
- Gap A3b: Hook denial UX and LLM behavior

**Decision Area(s):** DA-1, DA-5

**Research Method:** Synthesized from training data and existing project research. WebSearch/WebFetch were unavailable. Findings are labeled by confidence level accordingly.

---

## What Was Already Known

- Exit code 2 from a PreToolUse command hook blocks tool execution
- The hook can return JSON on stdout with `permissionDecision: "deny"` and `permissionDecisionReason: "<string>"` to provide LLM-readable feedback
- claude-code-harness has R01-R09 rules that can deny tool calls via this mechanism
- ECC has runtime profiles (minimal/standard/strict) to manage over-blocking
- The expedite override mechanism is a design invention: deny state write -> skill writes override record to gates.yml -> skill retries state write -> hook recognizes override and allows it
- No ecosystem precedent was found for this multi-step override round-trip in round 1 or round 2 research
- Over-blocking was identified as an anti-pattern in round 1 research (category-hook-mechanisms.md)

---

## Findings

### Finding 1: What the LLM Sees When a PreToolUse Hook Denies a Tool Call

**Confidence: HIGH** (based on official Claude Code documentation patterns and consistent behavior descriptions across multiple sources in training data)

When a PreToolUse hook returns exit code 2 with a JSON payload, the Claude Code runtime:

1. **Blocks the tool call** -- the tool (e.g., Write, Bash, Edit) is never executed
2. **Returns a structured denial message to the LLM** in the assistant/tool response slot. The LLM sees something functionally equivalent to:
   ```
   Tool use was blocked by a hook.
   Reason: <permissionDecisionReason value>
   ```
3. **The LLM retains full conversation context** -- it sees the denial as a tool result, not as a system-level interruption. The conversation continues normally with the LLM's next response.

The critical behavioral property: **the denial is surfaced as conversational content, not as a crash or reset**. The LLM can read the reason, reason about it, and decide what to do next. This is fundamentally different from, say, a network timeout or an out-of-memory error.

**Key detail:** The `permissionDecisionReason` string is the primary communication channel from the hook back to the LLM. Its content quality directly determines whether the LLM can take corrective action. A reason like `"blocked"` gives the LLM nothing to work with. A reason like `"State write denied: no override record found in gates.yml for gate G2. Write an override record first, then retry."` gives the LLM a clear action path.

### Finding 2: LLM Reliability at Interpreting Denial Feedback and Retrying

**Confidence: MEDIUM-HIGH** (based on extensive LLM tool-use behavior patterns observed across Claude, GPT-4, and agent frameworks; no controlled experiments specific to Claude Code hook denials)

LLMs (Claude in particular) are generally **reliable at interpreting structured denial feedback** and adjusting behavior, with the following characteristics:

**What works well:**
- **Clear, actionable denial reasons** produce reliable retry behavior. When the reason states exactly what the LLM should do differently, Claude follows the instruction in the vast majority of cases (estimated >90% for single-step corrections).
- **Single-step corrections** (e.g., "file path is wrong, use X instead") are highly reliable.
- **Two-step corrections** (e.g., "write file A first, then retry writing file B") are moderately reliable -- the LLM typically understands the sequence but occasionally attempts the retry before completing the prerequisite.
- **The LLM does not "forget" the denial** within the same context window. It treats the denial as information and incorporates it into subsequent reasoning.

**What degrades reliability:**
- **Ambiguous denial reasons** cause the LLM to guess at corrections, often incorrectly.
- **Repeated denials without changing conditions** (same action denied 3+ times) can cause the LLM to "give up" and either abandon the task, try a different approach that bypasses the intent of the hook, or ask the user for help. This is actually a reasonable LLM behavior -- infinite retry loops would be worse.
- **Multi-step recovery sequences** (3+ steps between denial and successful retry) have progressively lower reliability. Each additional step is a point where the LLM may deviate from the required sequence.
- **Denials that contradict skill instructions** create confusion. If the skill preamble says "write state.yml at step completion" but a hook denies that write, the LLM must reconcile conflicting instructions. Clear preamble language about the override protocol resolves this.

### Finding 3: The Deny-Override-Retry Round-Trip -- Reliability Analysis

**Confidence: MEDIUM** (novel pattern with no direct ecosystem precedent; analysis based on constituent behavior patterns that are individually well-understood)

The expedite override mechanism requires the following sequence:

```
1. Skill attempts Write to state.yml (advancing phase)
2. PreToolUse hook denies the write (exit code 2)
   -> LLM sees: "Denied: no override record in gates.yml"
3. Skill writes override record to gates.yml
4. Skill retries the Write to state.yml
5. PreToolUse hook reads gates.yml, finds override, allows the write
```

**Reliability assessment by step:**

| Step | Action | Reliability | Risk |
|------|--------|-------------|------|
| 1 | Initial write attempt | HIGH | None -- standard tool use |
| 2 | LLM reads denial reason | HIGH | Reason must be clear and actionable |
| 2->3 | LLM decides to write override | MEDIUM-HIGH | Depends on preamble training and reason clarity |
| 3 | Write override to gates.yml | HIGH | Standard tool use (assuming no hook blocks this write) |
| 3->4 | LLM remembers to retry original write | MEDIUM | This is the weakest link -- the LLM may continue to the next step instead of retrying |
| 4 | Retry write to state.yml | HIGH | Standard tool use |
| 5 | Hook allows on retry | HIGH | Deterministic code path |

**The weakest link is step 3->4**: after writing the override record, the LLM must remember to retry the *exact same state.yml write* it previously attempted. In practice, LLMs sometimes "move on" after completing an action (writing the override) rather than returning to retry a previously-failed action. This is because the override write itself feels like "progress" to the LLM.

**Mitigation strategies:**
1. **Denial reason should include the retry instruction explicitly**: `"Write override to gates.yml, then retry this exact Write to state.yml with the same content."`
2. **Skill preamble should describe the override protocol** so the LLM has two sources of truth (preamble + denial reason).
3. **The override write itself could include a "next action" field** that the LLM reads back, reinforcing the retry.
4. **Keep the round-trip to exactly 2 steps** (write override, retry). Do not add intermediate steps.

### Finding 4: Analogous Patterns in Agent Frameworks

**Confidence: MEDIUM** (patterns exist in LangChain/CrewAI/AutoGen but none implement the exact deny-override-retry mechanism)

**LangChain tool error handling:**
- LangChain's `ToolException` mechanism allows tools to return error messages that the LLM sees as conversational content (similar to hook denial reasons)
- The `handle_tool_error` parameter can be a string (static message) or a callable (dynamic message based on the error)
- When `handle_tool_error` is set, the agent reliably reads the error and adjusts behavior
- LangChain agents typically retry 2-3 times before escalating or abandoning
- The `max_iterations` parameter caps retry loops (default varies by agent type, typically 10-15)

**CrewAI tool failure:**
- CrewAI agents receive tool errors as task feedback
- The framework includes a `max_retry_limit` parameter (default: 2)
- After max retries, the agent either delegates to another agent or reports failure
- No deny-then-override pattern; retries are simple re-attempts

**AutoGen / AG2:**
- AutoGen's "teachable agents" can learn from tool failures and adjust future behavior
- The nested chat pattern allows a "critic" to review and suggest corrections before retry
- This is conceptually closest to the deny-override pattern but operates at the conversation level, not the hook level

**Key insight from frameworks:** All frameworks that handle tool failures well share two properties:
1. The error/denial message is **surfaced as conversational content** (not swallowed or logged silently)
2. The error message is **actionable** (tells the LLM what to do, not just what went wrong)

Claude Code hook denials satisfy both properties when `permissionDecisionReason` is well-crafted.

### Finding 5: Retry Loops and Escape Hatches

**Confidence: HIGH** (well-documented LLM behavior pattern)

A critical design concern for deny-retry patterns is the **infinite retry loop**: if the override mechanism fails (e.g., the override record format is wrong, or the hook has a bug), the LLM will attempt the same write, get denied, write another override, retry, get denied again, and so on.

**Observed LLM behavior in retry scenarios:**
- **Retry 1-2:** LLM follows the correction faithfully
- **Retry 3:** LLM often tries a variation (different file path, different content structure)
- **Retry 4-5:** LLM typically either asks the user for help or states it cannot complete the task
- **LLMs almost never retry the exact same failing action more than 3 times** without variation

This natural retry ceiling is actually beneficial -- it prevents infinite loops. However, it means the override mechanism must succeed within 1-2 attempts or the LLM will deviate.

**Design implication:** The hook should include a retry counter or attempt number in the denial reason. On the 3rd denial for the same tool call pattern, the reason should suggest the user intervene rather than encouraging another retry.

### Finding 6: PostToolUseFailure as Alternative Signal

**Confidence: HIGH** (documented in round 1 research, official hook event)

The `PostToolUseFailure` hook event fires after a tool call fails. While PreToolUse denial (exit code 2) prevents execution entirely, PostToolUseFailure fires when the tool was allowed but failed during execution. These are different signals:

- **PreToolUse deny (exit 2):** Tool never runs. LLM sees denial reason. Used for policy enforcement.
- **PostToolUseFailure:** Tool ran but failed. LLM sees the error. Used for error monitoring/logging.

For the override mechanism, PreToolUse is the correct interception point because the goal is to **prevent** invalid state transitions, not to detect failed ones after the fact.

However, PostToolUseFailure could serve as a **safety net**: if a state write somehow bypasses the PreToolUse hook (e.g., via a bash command writing directly to state.yml), a PostToolUseFailure or PostToolUse hook could detect the invalid state and alert.

---

## Key Data Points

1. **Denial reason visibility:** The `permissionDecisionReason` string is surfaced as conversational content to the LLM -- it reads it like any other tool response. (HIGH confidence)

2. **Single-step correction reliability:** >90% estimated success rate when the denial reason provides a clear, single corrective action. (MEDIUM-HIGH confidence, no controlled measurement)

3. **Two-step correction reliability:** ~70-85% estimated success rate for "do X, then retry Y" sequences. The gap is primarily the LLM forgetting to retry after completing the intermediate step. (MEDIUM confidence)

4. **Natural retry ceiling:** LLMs typically stop retrying after 3-5 attempts, with variations starting at attempt 3. This prevents infinite loops but means the mechanism must succeed quickly. (HIGH confidence)

5. **No ecosystem precedent:** The deny-override-retry round-trip (deny write -> write override artifact -> retry write -> hook checks artifact) has no direct precedent in Claude Code plugins, LangChain, CrewAI, or other agent frameworks. The constituent parts are well-understood but the composition is novel. (HIGH confidence in the absence of precedent)

6. **Denial reason quality is the dominant factor:** Across all patterns (hook denials, LangChain tool errors, CrewAI task failures), the actionability of the error/denial message is the single strongest predictor of successful recovery. (HIGH confidence)

---

## Gap Fill Assessment

| Gap | Status | Confidence | Notes |
|-----|--------|------------|-------|
| A3: LLM deny-override-retry reliability | PARTIALLY FILLED | Medium | No direct evidence exists because the pattern is novel. Constituent behaviors (denial interpretation, single-step correction, retry after intermediate action) are individually well-understood. The composition introduces a reliability gap at the "remember to retry" step. Mitigations identified (explicit retry instruction in denial reason, preamble training, 2-step maximum). Cannot be fully filled without empirical testing. |
| A3b: Hook denial UX and LLM behavior | FILLED | Medium-High | The denial mechanism is well-understood: exit code 2 blocks the tool, `permissionDecisionReason` surfaces as conversational content, LLM reads it and can adjust. The key design constraint is denial reason quality -- vague reasons produce poor recovery, specific actionable reasons produce reliable recovery. |

---

## Design Implications

### For the Override Mechanism

1. **The mechanism is architecturally sound but has a known weak link.** The deny->override->retry sequence relies on the LLM remembering to retry after writing the override record. This is not guaranteed. Mitigations:
   - The denial reason MUST include an explicit retry instruction: `"Write an override record to gates.yml with fields {gate, reason, timestamp}, then immediately retry writing state.yml with the same content."`
   - The skill preamble MUST describe the override protocol so the LLM has prior knowledge before encountering the first denial.
   - Keep the round-trip to exactly 2 tool calls (write override, retry write). Do not add validation steps between them.

2. **Denial reason is the critical design surface.** The `permissionDecisionReason` string is the primary communication channel. It should be:
   - Specific: name the exact file and action needed
   - Actionable: say what to do, not just what went wrong
   - Sequenced: if multiple steps required, number them
   - Complete: include all information the LLM needs without requiring it to read other files

3. **Build in a retry ceiling.** The hook should track denial count (e.g., via a temp file or environment state) and on the 3rd denial for the same pattern, change the denial reason to: `"Override mechanism has failed 3 times. Ask the user for help."` This prevents infinite loops and leverages the LLM's natural tendency to escalate.

4. **The override record in gates.yml must not itself be denied.** If a PreToolUse hook on Write also intercepts the gates.yml write, the mechanism deadlocks. The hook matcher must either:
   - Only match writes to `state.yml` (not `gates.yml`)
   - Explicitly allow writes to `gates.yml` (check file path, exit 0 for gates.yml)

5. **Consider a simpler alternative for the common case.** If most gate passages are legitimate, the deny-override pattern adds friction to the happy path. An alternative: the hook validates the gate passage itself (checks that the required artifact exists and meets criteria) and allows the write if validation passes. The override mechanism would only be needed for edge cases where the hook's validation is too strict. This shifts complexity from the LLM (multi-step recovery) to the hook (richer validation logic).

### For Preamble Design

6. **The skill preamble should include a "what to do when denied" section.** Example:
   ```
   If a Write to state.yml is denied by a hook, you will see a denial reason.
   Follow the instructions in the denial reason exactly. Typically:
   1. Write the override record to gates.yml as specified
   2. Immediately retry the same Write to state.yml
   Do not skip the retry step. Do not proceed to other work between steps 1 and 2.
   ```

7. **Preamble + denial reason alignment is critical.** If the preamble says "write override to gates.yml" but the denial reason says "write override to overrides.yml," the LLM will be confused. These must be consistent.

### For Testing

8. **This mechanism MUST be empirically tested before relying on it.** The reliability estimates in this research are directional, not measured. Recommended test protocol:
   - Set up a PreToolUse hook that denies state.yml writes without an override
   - Run the skill 10+ times and measure: (a) does the LLM write the override, (b) does it retry the state write, (c) does the retry succeed
   - Vary the denial reason wording and measure the impact
   - Test with context windows at different fullness levels (the retry-forgetting risk increases with context pressure)

---

## Sources

All findings in this document are synthesized from training data and existing project research. No live web sources were consulted (WebSearch/WebFetch were unavailable).

**Project research consulted:**
- `/Users/jaredwallenfels/Desktop/Projects/expedite-plugin/.planning/research/agent-harness-architecture/category-hook-mechanisms.md` -- Hook type inventory, exit code semantics, permissionDecisionReason, anti-patterns
- `/Users/jaredwallenfels/Desktop/Projects/expedite-plugin/.planning/research/agent-harness-architecture/round-2/gap-hook-handler-types.md` -- Handler type availability confirmation
- `/Users/jaredwallenfels/Desktop/Projects/expedite-plugin/.planning/research/agent-harness-architecture/READINESS.md` -- DA-1 and DA-5 readiness assessments
- `/Users/jaredwallenfels/Desktop/Projects/expedite-plugin/.planning/research/agent-harness-architecture/round-3/gap-hook-subagent-scope.md` -- Hook scope and subagent interaction findings

**Training data sources (not individually verifiable):**
- Claude Code official hooks documentation (code.claude.com/docs/en/hooks)
- Claude Code plugins reference (code.claude.com/docs/en/plugins-reference)
- LangChain tool error handling documentation (ToolException, handle_tool_error)
- CrewAI task failure and retry documentation
- AutoGen/AG2 nested chat and teachable agent patterns
- General LLM tool-use behavior observations across Claude, GPT-4, and open-source models
