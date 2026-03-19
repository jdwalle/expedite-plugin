---
phase: 01-research-phase-retrospective-fixes
verified: 2026-03-18T00:00:00Z
status: passed
score: 6/6 must-haves verified
re_verification: false
---

# Phase 01: Research Phase Retrospective Fixes Verification Report

**Phase Goal:** Fix 5 issues from first real-world research phase use: recursive evidence file counting in G2 gate, web researcher codebase guardrails, source routing priority in research skill, corroboration exception for direct code reads, and write-early pattern for web researcher.
**Verified:** 2026-03-18
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | G2 gate counts evidence files in subdirectories (e.g., round-2/) not just the research root | VERIFIED | `listEvidenceFiles` at lines 52-79 of gates/g2-structural.js uses `readdirSync(dir, { withFileTypes: true })`, calls `entry.isDirectory()` to recurse, and includes a Node <10.10 fallback. M3 and S2 detail messages explicitly say "including subdirectories". |
| 2 | Web researcher agent prioritizes web sources and only uses codebase tools for supplemental context, not primary research | VERIFIED | `<guardrails>` block at lines 44-50 of agents/web-researcher.md, placed inside `<instructions>` before numbered instruction 1. Block states "Your PRIMARY information sources are WebSearch and WebFetch" and permits Read/Grep/Glob only as "quick spot-checks". `disallowedTools` unchanged (Bash, Edit, EnterWorktree only). |
| 3 | Web researcher writes a skeleton evidence file after first batch of findings to prevent total output loss on turn limit | VERIFIED | Instruction 5 at line 69 of agents/web-researcher.md: "Write early, append often." Specifies writing a skeleton with "[RESEARCH IN PROGRESS]" markers after first question's findings or 3-5 significant findings, and rewriting incrementally. Instructions renumbered 1-9. |
| 4 | Questions with source_hints containing "codebase" route to the codebase batch, not the web batch | VERIFIED | Step 4 of skills/research/SKILL.md (line 73): "Route by source_hints priority: if `"codebase"` is in source_hints, assign to codebase batch." Old ambiguous "assign to first enabled source" wording is absent (grep confirms no match). |
| 5 | Web batch only receives questions where web is the sole or primary source hint | VERIFIED | Step 4 routing rule makes web the final else-branch: "Else assign to web batch." Fallback for missing source_hints also routes to web. codebase and mcp are checked first. |
| 6 | Direct source code reads (reading the actual function/class) count as strong single-source evidence that does not require corroboration | VERIFIED | "Direct source code exception" paragraph at line 87 of agents/sufficiency-evaluator.md: rates a single direct code read as Adequate corroboration regardless of DA depth. Quality gate checklist at line 153 also references the exception. |

**Score:** 6/6 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `gates/g2-structural.js` | Recursive evidence file counting in listEvidenceFiles | VERIFIED | 340 lines; `listEvidenceFiles` at lines 52-79 uses `withFileTypes: true` and recursive directory walk. Syntax check passes. |
| `agents/web-researcher.md` | Prompt guardrails prioritizing web research + write-early pattern | VERIFIED | 186 lines; `<guardrails>` block at lines 44-50; write-early instruction at line 69; disallowedTools unchanged. |
| `skills/research/SKILL.md` | Corrected source routing logic in Step 4 | VERIFIED | Step 4 (lines 71-76) has explicit priority routing codebase > mcp > web. Old ambiguous wording absent. |
| `agents/sufficiency-evaluator.md` | Source code read exception for corroboration requirement | VERIFIED | Exception paragraph at line 87 in instruction 4; quality gate updated at line 153. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `gates/g2-structural.js` | `.expedite/research/` subdirectories | recursive directory scan with `withFileTypes` | VERIFIED | `readdirSync(dir, { withFileTypes: true })` + `isDirectory()` recursion at lines 54-67; subdirectory paths prepended at line 61 (`entry.name + '/' + subFiles[j]`) |
| `agents/web-researcher.md` | guardrails block | prompt instructions before numbered list | VERIFIED | `<guardrails>` block placed immediately inside `<instructions>`, before item 1, at lines 44-50 |
| `skills/research/SKILL.md` | codebase batch routing | source_hints priority check in Step 4 | VERIFIED | Explicit if/else chain in Step 4: codebase checked first, mcp second, web as fallback |
| `agents/sufficiency-evaluator.md` | corroboration dimension | exception paragraph in instruction 4 | VERIFIED | Paragraph appended after calibration note at line 87; quality gate item updated at line 153 to reference the exception |

### Requirements Coverage

No requirement IDs declared for this phase (bug-fix phase). No REQUIREMENTS.md cross-reference needed.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| None | — | — | — | — |

No TODO/FIXME/placeholder patterns found in modified files. No stub implementations. All four modified files contain substantive, working changes.

### Human Verification Required

No human verification required. All five bug fixes are verifiable programmatically through static analysis:
- Recursive scan logic is explicit in the source code.
- Guardrails block text is present and correctly placed.
- Write-early instruction is present and numbered correctly.
- Routing priority is explicit in Step 4 prose.
- Corroboration exception is present with correct Adequate rating specified.

### Commit Verification

All commits from summaries confirmed present in git log:

| Commit | Task | Status |
|--------|------|--------|
| `0740e9c` | Fix G2 gate recursive evidence file counting | FOUND |
| `f7591af` | Add web researcher guardrails and write-early pattern | FOUND |
| `b9407f1` | Fix source routing priority in research skill Step 4 | FOUND |
| `b1a8fbf` | Add corroboration exception for direct source code reads | FOUND |

### Gaps Summary

No gaps. All 6 observable truths verified. All 4 modified artifacts substantive and wired. All 4 commits present. Phase goal fully achieved.

---

_Verified: 2026-03-18_
_Verifier: Claude (gsd-verifier)_
