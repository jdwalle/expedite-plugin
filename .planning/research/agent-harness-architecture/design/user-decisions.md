# User Decisions: Agent Harness Architecture

## Decisions

### 1. Skill-Agent Boundary: Three-Layer Separation
**Question**: How should the skill-agent boundary shift?
**Answer**: Three-layer separation — Enforcement (hooks/scripts) + Orchestration (thin skills) + Execution (thick agents with full frontmatter).
**Context**: Most aligned with ecosystem evidence. Skills become ~100-200 line dispatchers. Biggest restructuring but cleanest architecture. User accepts the scope of restructuring.

### 2. Semantic Gate Enforcement: Dual-Layer Rubric + Reasoning
**Question**: For semantic quality gates (G3: Design quality, G5: Spike quality), which anti-rubber-stamp mechanism?
**Answer**: Dual-layer rubric+reasoning — structural rubric validation (code-enforced) + reasoning soundness check (separate verifier agent).
**Context**: Matches the user's existing Phase 24 verifier design concept. Two independent checks, one deterministic. Preferred over multi-agent debate (overkill for personal tool) and separate judge model (incomplete bias coverage).

### 3. Migration Strategy: Incremental Hardening
**Question**: What migration strategy should the design assume?
**Answer**: Incremental hardening — add hooks and state splitting to existing skills one at a time. Each phase delivers standalone value.
**Context**: Lower risk, can validate patterns before committing. User prefers to see each improvement work before moving to the next. Full rebuild is acceptable but not preferred when incremental is viable.

### 4. Worktree Isolation: Yes, Execute-Only
**Question**: Should the design include worktree isolation for the execute skill?
**Answer**: Yes, execute-only — add `isolation: "worktree"` to execute agents.
**Context**: Execute is the only skill that modifies source code. Other skills write to `.expedite/` directories only. Simple adoption via frontmatter field. User understands merge-back is manual but accepts this for the isolation benefit.

## Constraints Carried Forward from SCOPE.md
- C1: Platform is Claude Code plugin API
- C2: Full rebuild acceptable if justified (but incremental preferred per Decision 3)
- C3: Personal/team tool — configuration complexity acceptable
- C4: SessionStart hook deferred due to platform bugs — design with fallback
- C5: Existing lifecycle pipeline (scope→research→design→plan→spike→execute) is fixed

## Areas Not Requiring User Input (Evidence Converges)
- **State management**: Directory-based (file-per-concern) — convergent signal from 4+ sources, aligns with planned ARCH-02-06 split
- **Agent formalization**: Official Claude Code subagent schema (12+ frontmatter fields) — clear target, low-effort adoption
- **Resume mechanism**: Generalize checkpoint.yml pattern to all skills — existing proven pattern in execute skill
- **Hook priority**: PreToolUse on state writes is highest-value adoption — research is unambiguous
- **Coordination pattern**: Subagents (hub-and-spoke) sufficient for pipeline architecture — Agent Teams deferred
- **Structural gates (G1, G2, G4)**: Code-enforced deterministic validation — no LLM judgment needed
