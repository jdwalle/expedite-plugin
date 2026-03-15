# Gap Research: Hook-Subagent Scope

**Round:** 3
**Targeted Gaps:**
- Gap A1: Do plugin PreToolUse hooks fire on subagent-initiated writes?
- Gap A1b: Override/denial interaction patterns in Claude Code plugins

**Decision Area(s):** DA-1: Hook Architecture for Runtime Guardrails

---

## What Was Already Known

- Claude Code provides 16 hook event types with 4 handler types (command, http, prompt, agent)
- PreToolUse is blocking; exit code 2 = deny; `permissionDecisionReason` provides LLM-readable feedback
- Plugin hooks.json supports command, prompt, and agent handler types (confirmed by official plugins-reference docs in round 2)
- Hook configuration format is identical across all registration locations (plugin hooks.json, project settings, user settings, skill/agent frontmatter)
- 3 harness repos (claude-code-harness, ECC, claude-agentic-framework) use hooks for enforcement
- NO source explicitly addresses whether hooks fire on subagent tool calls
- The confidence audit rated A1 as "Unknown (60%)" likelihood of being correct, CRITICAL impact
- The design's fallback if hooks do NOT fire: per-agent hooks via the `hooks` frontmatter field, or restructure so agents return results to skills which then write state

---

## Findings

### Finding 1: Architectural Analysis -- Hooks Are Registered at the Session Level, Not the Agent Level

**Evidence:** The Claude Code hook system operates at the session/environment level, not at the individual LLM-invocation level. Hooks registered in plugin hooks.json, project settings, or user settings define interception points for the Claude Code runtime -- the process that mediates ALL tool calls between the LLM (whether main agent or subagent) and the actual tool execution. The tool execution pipeline in Claude Code follows this path:

```
LLM requests tool call -> Claude Code runtime -> Hook evaluation -> Tool execution
```

This pipeline is the same regardless of whether the LLM making the request is the main session agent or a subagent. Subagents in Claude Code are not separate processes with separate hook registries -- they are LLM invocations managed by the same Claude Code runtime process. The runtime manages the tool call lifecycle for all agents within the session.

**Key reasoning:** The SubagentStart and SubagentStop hook events exist precisely because the runtime has visibility into subagent lifecycle. If the runtime tracks when subagents start and stop, it necessarily mediates their tool calls as well -- that is the mechanism by which it controls subagent execution (enforcing `maxTurns`, `disallowedTools`, `tools` allowlists, and `permissionMode`).

**Source quality:** Architectural inference from documented behavior, not direct confirmation.
**Relevance:** Strongly suggests hooks fire on subagent tool calls, but is not definitive.

### Finding 2: disallowedTools and tools Enforcement Implies Hook-Level Interception

**Evidence:** The official Claude Code subagent frontmatter schema supports both `tools` (allowlist) and `disallowedTools` (denylist) fields. When an agent definition specifies `disallowedTools: ["EnterWorktree"]`, the runtime prevents the subagent from using that tool. This enforcement must happen at the same layer where hooks are evaluated -- the tool call interception point in the runtime.

The round-1 research documented that `disallowedTools` effectively prevents agents from using specified tools (Decision 25 in the design rated HIGH confidence). If the runtime can intercept and deny tool calls from subagents based on allowlist/denylist configuration, it follows that the same interception point is where PreToolUse hooks evaluate -- meaning PreToolUse hooks would see subagent tool calls.

Furthermore, the `PermissionRequest` hook event (which fires when a permission dialog appears) is documented as supporting tool name regex matchers. Permission requests can arise from subagent tool calls (when `permissionMode` requires approval), confirming that the hook system intercepts subagent-originated events.

**Source quality:** Logical inference from documented frontmatter fields and their enforcement behavior.
**Relevance:** Strong indirect evidence that the tool call interception pipeline applies uniformly to main agent and subagent calls.

### Finding 3: Per-Agent Frontmatter Hooks Add Scope, Not Replace Global Hooks

**Evidence:** The round-2 research (Finding 4 in gap-hook-handler-types.md) documented that "Hooks use the same configuration format as settings-based hooks but are scoped to the component's lifetime." The official hooks reference describes frontmatter hooks in skills and agents as ADDITIONAL hooks that are active while the component runs, not as REPLACEMENTS for global hooks.

This is a critical distinction. If per-agent hooks in frontmatter are additive to plugin/project/user hooks, then plugin-level hooks remain active while a subagent runs. The agent's frontmatter hooks add additional interception on top of the baseline hooks. This additive model means a PreToolUse hook registered in plugins hooks.json fires on tool calls from ALL agents, not just the main session.

If hooks were NOT inherited by subagents, the `hooks` frontmatter field on agent definitions would be unnecessary -- agents would always have a clean hook environment, and there would be no need for additive hooks. The existence of per-agent hooks implies there is a baseline hook environment that agents inherit, with per-agent hooks layering on top.

**Source quality:** Inference from documented hook scoping semantics. The additive model is stated in the official hooks reference documentation (as captured in round-2 research).
**Relevance:** Strong indirect evidence supporting the hypothesis that plugin-level hooks fire on subagent tool calls.

### Finding 4: SubagentStart Hook Has Agent Type Matcher -- Implies Runtime Hook Pipeline Covers Subagents

**Evidence:** The SubagentStart hook event uses an "Agent type name" matcher (documented in category-hook-mechanisms.md). This means the hook system can identify which agent is being spawned and filter accordingly. If the runtime has this level of visibility into subagent identity at spawn time, it has the same visibility during the subagent's tool call lifecycle.

The SubagentStop hook fires "after the subagent completes" (also documented). The design proposals note that SubagentStop fires after the agent's final Write is committed. This means the runtime continues to track the subagent through its entire execution lifecycle, including tool calls and their completion.

**Source quality:** Inference from documented hook event semantics.
**Relevance:** Consistent with the model that the runtime mediates all subagent tool calls and therefore PreToolUse would fire on them.

### Finding 5: No Counter-Evidence Found

**Evidence:** Across all 8 harness repos surveyed, all official documentation captured in round-1 and round-2 research, all 3 design proposals, and all validation rounds, no source states or implies that hooks do NOT fire on subagent tool calls. The gap exists because no source explicitly confirms the behavior either -- it is simply not addressed as a topic.

The most likely explanation for this silence is that hook-on-subagent-calls is the default/expected behavior, and therefore not worth documenting as a special case. Documentation typically calls out exceptions to expected behavior, not confirmations of it.

**Source quality:** Argument from silence (weak on its own, but consistent with all other evidence).
**Relevance:** Removes one possible counter-hypothesis.

### Finding 6: Override/Denial Interaction Patterns (Gap A1b)

**Evidence for LLM response to hook denial:** The design documents contain the most detailed analysis of this pattern. The `permissionDecisionReason` field is the primary mechanism for communicating denial context to the LLM. When a PreToolUse hook returns exit code 2 with a JSON payload containing `permissionDecision: "deny"` and `permissionDecisionReason: "<human-readable explanation>"`, Claude Code surfaces this reason to the LLM.

The existing research documents three relevant interaction patterns:

1. **ECC's runtime profiles** (minimal/standard/strict): ECC implements different enforcement strictness levels, implying that hooks denying tool calls is a routine interaction pattern that the LLM handles -- the profile system exists precisely because different strictness levels affect LLM behavior, and the system is tunable rather than binary.

2. **claude-code-harness TypeScript guardrail engine**: The R01-R09 rule engine enforces constraints through hooks. The harness is actively used as a development tool, implying the LLM successfully adjusts behavior when rules block operations.

3. **PermissionRequest hook event**: This hook type exists specifically for the deny/approve interaction pattern. Plugins can auto-deny permission requests, and the LLM must adapt (e.g., choosing an alternative approach or informing the user). This is a documented, production-tested denial interaction pattern.

**What is NOT evidenced:** The specific multi-step override round-trip pattern (deny -> write override -> retry) that the expedite design invents. No surveyed source demonstrates a pattern where the LLM must write a record to one file and then retry a write to a different file after a hook denial. The denial patterns found are simpler: deny and the LLM adjusts, or deny and the user intervenes.

**Source quality:** Mixed. ECC and claude-code-harness provide production examples of hooks denying operations. The override round-trip is undemonstrated.
**Relevance:** Confirms that LLMs can handle simple denial patterns. The complex override round-trip remains unvalidated.

---

## Key Data Points

1. **Architectural inference strongly favors hooks firing on subagent tool calls.** The Claude Code runtime mediates ALL tool calls (main agent and subagent) through the same pipeline. The runtime's ability to enforce `disallowedTools`, `tools` allowlists, and `permissionMode` on subagents confirms it intercepts subagent tool calls at the same layer where hooks evaluate.

2. **Per-agent frontmatter hooks are additive, not replacements.** The official documentation describes them as "scoped to the component's lifetime" and using "the same configuration format as settings-based hooks." This additive model implies plugin-level hooks remain active during subagent execution.

3. **No counter-evidence exists.** No source states or implies that hooks skip subagent tool calls.

4. **The SubagentStart/SubagentStop events demonstrate runtime-level subagent lifecycle tracking.** The runtime tracks subagent identity (via agent type name matcher) from spawn through completion, consistent with mediating tool calls throughout.

5. **Simple denial patterns are production-tested.** ECC, claude-code-harness, and the PermissionRequest hook event all demonstrate hooks denying operations and the LLM adjusting. The override round-trip (deny -> write override record -> retry) is a design invention without ecosystem precedent.

6. **The `permissionDecisionReason` field is the LLM feedback mechanism for denials.** It provides human-readable text that Claude relays to the developer, enabling informed decisions about overrides or corrections.

---

## Gap Fill Assessment

| Gap | Status | Confidence | Notes |
|-----|--------|------------|-------|
| A1: Do plugin PreToolUse hooks fire on subagent-initiated writes? | PARTIALLY FILLED | Medium-High (revised from Unknown 60% to ~80%) | No direct confirmation found, but 4 independent lines of architectural evidence converge on YES: (1) runtime mediates all tool calls uniformly, (2) disallowedTools enforcement proves subagent tool call interception, (3) per-agent hooks are additive to global hooks (not replacements), (4) SubagentStart/Stop lifecycle tracking demonstrates full subagent visibility. No counter-evidence exists. Still requires empirical validation as first M1 task. |
| A1b: Override/denial interaction patterns | PARTIALLY FILLED | Medium | Simple denial patterns are production-tested (ECC profiles, claude-code-harness rules, PermissionRequest hook). The LLM can handle "tool call denied, adjust behavior" interactions. The complex override round-trip (deny -> write override -> retry) is undemonstrated and remains the primary implementation risk for the override mechanism (Assumption A3). |

---

## Revised Risk Assessment

The convergence of 4 architectural inference lines raises the likelihood assessment for A1 from "Unknown (60%)" to approximately 80%. The evidence is not definitive -- no source explicitly says "PreToolUse hooks fire on subagent tool calls" -- but the architectural model strongly implies it. The key reasoning:

- If hooks did NOT fire on subagent tool calls, then `disallowedTools` and `tools` enforcement on subagents would require a SEPARATE interception mechanism from hooks. This would mean Claude Code has two parallel tool call interception systems -- one for hooks and one for agent tool restrictions. This is architecturally implausible; a single interception pipeline serving both purposes is the expected design.

The recommendation from the confidence audit remains correct: **verify empirically in the first hour of M1 implementation.** The test is simple (dispatch agent that writes, check if PreToolUse hook log shows the write), takes 30 minutes, and provides definitive confirmation. But the revised likelihood assessment means this is now expected to PASS rather than being a coin flip.

The override round-trip (A3) remains the higher-risk interaction pattern. The denial itself will work; the question is whether the LLM reliably completes the multi-step override sequence (denied write -> write override record to gates.yml -> retry original state.yml write). The existing evidence covers simple "denied, adjust" patterns but not "denied, write to a different file, retry the original write" patterns.

---

## Sources

Sources are all from within the existing research base (no new external sources were accessible in this round):

1. **category-hook-mechanisms.md** -- Hook event inventory, exit code semantics, matcher patterns, handler types
2. **category-agent-team-patterns.md** -- Subagent frontmatter schema including `hooks`, `disallowedTools`, `tools` fields
3. **round-2/gap-hook-handler-types.md** -- Finding 4: frontmatter hooks are additive ("scoped to the component's lifetime")
4. **design/CONFIDENCE-AUDIT.md** -- A1 assumption definition, testing protocol, fallback designs
5. **design/PRODUCT-DESIGN.md** -- Three-layer architecture, hook registry, override mechanism, error messaging
6. **design/validation-2.md** -- Cross-proposal identification of the subagent hook-firing assumption as critical
7. **research-synthesis.md** -- DA-1 evidence summary, hook enforcement patterns from ecosystem

**Note on methodology:** WebSearch and WebFetch tools were unavailable for this research round. All findings are based on architectural reasoning from the existing research base and Claude Code documentation captured in rounds 1-2. The findings provide stronger-than-previous confidence through inference but do not constitute empirical confirmation. The M1 validation test remains essential.
