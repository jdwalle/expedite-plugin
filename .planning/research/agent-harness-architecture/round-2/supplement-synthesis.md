### Supplement Synthesis: Round 2

**Date:** 2026-03-11
**Gaps Targeted:** 1
**Gaps Filled:** 1
**Gaps Partially Filled:** 0
**Gaps Still Open:** 0

### New Evidence by Decision Area

#### DA-1: Hook Architecture for Runtime Guardrails

**Gap Status Before This Round:** NEEDS MORE — unknown whether prompt and agent hook handler types are available in plugin-registered hooks (hooks/hooks.json) vs. only project-level settings.

**New Evidence:**
- Official Anthropic plugins-reference explicitly lists `command`, `prompt`, and `agent` as valid hook handler types for plugin hooks.json (Finding 1)
- Hook reference documents handler type restrictions per-event-type, not per-registration-location — 8 events support all types, 10 events support command-only (Finding 2)
- Plugins guide confirms schema parity: hooks.json in plugins uses the same format as settings-based hooks (Finding 3)
- Skill/agent frontmatter hooks also support all handler types, providing a second registration path from plugins (Finding 4)
- `http` handler type is NOT listed in the plugins-reference (only command/prompt/agent), creating minor ambiguity — but http is not needed for expedite's design

**Gap Resolution:**

| Gap | Before | After | Key Evidence |
|-----|--------|-------|-------------|
| Hook handler type availability in plugins | Open (Critical) | Filled (High confidence) | Official plugins-reference explicitly lists prompt and agent as valid. No location-based restrictions in hook reference. Schema parity confirmed between plugin hooks.json and project settings. |

**Assessment:** DA-1 is now READY. The remaining knowledge gaps from round 1 (SessionStart bug status, hook latency benchmarks, frontmatter `once: true` behavior) are non-critical — they affect implementation details, not architectural decisions. The core question blocking design (can expedite register prompt/agent hooks from its plugin?) is definitively answered: yes.

### Gaps Still Open

None from this round. The 7 other knowledge gaps from the original synthesis (SessionStart bug status, hook latency benchmarks, frontmatter `once: true`, state file write atomicity, real-world hook failure rates, Agent Teams maturity, subagent nesting limits) remain open but were already assessed as non-blocking for design.

### Contradictions & Nuances

**HTTP hook ambiguity:** The plugins-reference lists only 3 handler types (command, prompt, agent) while the general hooks reference lists 4 (adding http). The plugins-reference troubleshooting section says valid types are "command, prompt, or agent" — omitting http. This could be a documentation omission or a genuine restriction. Not a blocker for expedite (no http hooks planned), but worth noting if HTTP-based handlers are ever considered.

### Integration Notes

This finding closes Knowledge Gap #2 from the original synthesis ("Hook handler type availability in plugins"). It strengthens the DA-1 evidence quality from "Strong with one operational gap" to "Strong" and upgrades DA-1 readiness from NEEDS MORE to READY. The design implications are:

- **G3/G5 semantic gates** can use `Stop` or `SubagentStop` hooks with `type: "agent"` directly from the plugin's hooks.json — no project-level configuration required
- **All 5 gates (G1-G5)** can be fully enforced from plugin-registered hooks, keeping the entire enforcement layer self-contained within the expedite plugin
- **Event-type restrictions are the binding constraint**, not registration location: semantic gate hooks should target the 8 events that support all handler types (Stop and SubagentStop are the relevant ones for post-execution quality evaluation)

With this gap filled, all 9 decision areas are READY. No further gap research rounds are needed before proceeding to design.
