# SCOPE: Real-Time Collaboration Feature

## Project Description

Build a real-time collaboration system for a document editing application that enables multiple users to simultaneously edit shared documents with live presence indicators and conflict-free updates. The system must support 50+ concurrent editors per document with sub-200ms latency for edit propagation.

## Decision Areas

### DA-1: Data Sync Architecture

**Questions:**
1. What synchronization strategy (OT, CRDT, or hybrid) best balances latency, correctness, and implementation complexity for our document model?
2. How should the sync layer handle offline edits and reconnection without data loss?
3. What transport protocol (WebSocket, SSE, WebTransport) provides the reliability and performance needed?

**Evidence Requirements:**
- Benchmark data comparing OT vs CRDT convergence time at 50+ concurrent editors
- Latency measurements for each transport protocol under load
- Case studies from production systems using each approach at similar scale

**Research Findings:**
- F1: CRDT-based sync (specifically Yjs) converges in O(n log n) for concurrent edits, compared to O(n^2) for naive OT, per academic benchmarks (Kleppmann et al., 2019)
- F2: WebSocket provides bidirectional communication with 2-5ms baseline RTT on modern infrastructure; WebTransport adds multiplexing but has limited browser support (< 60% as of 2025)
- F3: Yjs library handles offline edits via document state vectors; reconnection merges divergent states without conflict resolution callbacks
- F4: OT requires a centralized server for transformation; CRDT allows peer-to-peer sync which simplifies horizontal scaling
- F5: At 50 concurrent editors, Yjs memory usage is approximately 2x the document size due to tombstones; OT memory is proportional to operation log size

**Readiness Criteria:**
- Sync strategy selected with evidence-based rationale covering latency, correctness, and scale
- Transport protocol chosen with latency benchmarks at target concurrency
- Offline/reconnection strategy documented with edge case handling

### DA-2: Conflict Resolution Strategy

**Questions:**
1. How should the system handle semantic conflicts (e.g., two users editing the same paragraph) beyond character-level merge?
2. What conflict visualization approach best communicates concurrent edits to users?
3. How should the system prioritize conflicting formatting changes?

**Evidence Requirements:**
- User research on conflict awareness in collaborative editors
- Analysis of conflict resolution approaches in Google Docs, Notion, and Figma
- Performance impact of conflict detection on edit latency

**Research Findings:**
- F6: Google Docs uses character-level OT with last-writer-wins for formatting conflicts; users report confusion when formatting changes "disappear" (UX research survey, n=200)
- F7: Figma uses CRDT with explicit conflict markers for overlapping edits in the same region; user satisfaction rated 4.2/5 for conflict awareness
- F8: Adding paragraph-level conflict detection increases edit processing latency by 8-15ms, within acceptable bounds for sub-200ms target
- F9: Visual conflict indicators (colored cursors + change highlights) reduce user confusion by 60% compared to silent merge (A/B test data from Notion design docs)
- F10: Formatting conflicts are rare (< 2% of concurrent edits) but cause disproportionate user frustration when they occur silently

**Readiness Criteria:**
- Semantic conflict detection scope defined (character, word, paragraph, section level)
- Conflict visualization strategy selected with user experience rationale
- Formatting conflict priority rules documented

### DA-3: User Presence System

**Questions:**
1. What presence data should be tracked and broadcast (cursor position, selection range, viewport, typing status)?
2. How should presence updates be throttled to avoid overwhelming the sync channel?
3. What happens to presence indicators when a user's connection becomes unstable?

**Evidence Requirements:**
- Performance analysis of presence update frequency vs perceived responsiveness
- Network bandwidth measurements for presence data at 50+ concurrent users
- User research on which presence indicators are most valuable

**Research Findings:**
- F11: Cursor position updates at 60Hz consume approximately 1.2KB/s per user; at 50 users this is 60KB/s inbound per client
- F12: Throttling presence to 10Hz (100ms intervals) reduces bandwidth by 83% with no perceptible lag in user studies (p < 0.01, n=50)
- F13: Users prioritize seeing cursor positions (95% importance) and selections (78%) over viewport (34%) and typing indicators (45%)
- F14: Stale presence data (connection timeout without cleanup) is the #1 reported annoyance in collaborative editors; 3-second timeout with fade-out animation rated optimal in usability testing
- F15: Presence can share the WebSocket connection with sync data using message type multiplexing; separate connections add connection management overhead with no latency benefit

**Readiness Criteria:**
- Presence data schema defined with justification for included/excluded fields
- Throttling strategy selected with bandwidth and UX impact quantified
- Connection instability handling documented with timeout and cleanup behavior
