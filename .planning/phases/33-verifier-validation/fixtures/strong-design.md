# DESIGN: Real-Time Collaboration System

## Design Overview

This design document specifies the architecture for a real-time collaboration system supporting 50+ concurrent editors per document with sub-200ms edit propagation latency. All design decisions trace to evidence gathered during the research phase and documented in the scope (DA-1, DA-2, DA-3).

## Decision 1: CRDT-Based Synchronization with Yjs

### Evidence Basis

Per DA-1 research finding F1, CRDT-based sync using Yjs converges in O(n log n) for concurrent edits, compared to O(n^2) for naive OT. At our target of 50+ concurrent editors, this difference is operationally significant: OT transformation costs grow quadratically with editor count, while CRDT costs grow near-linearly.

Per finding F4, CRDTs allow peer-to-peer sync, eliminating the centralized transformation server that OT requires. This simplifies horizontal scaling because each editor instance can independently merge operations without server coordination.

Per finding F3, Yjs handles offline edits through document state vectors. When a disconnected editor reconnects, Yjs merges divergent states automatically without requiring conflict resolution callbacks. This directly addresses DA-1 question 2 (offline edits and reconnection).

### Trade-offs Considered

**CRDT memory overhead:** Finding F5 indicates Yjs memory usage is approximately 2x the document size due to tombstones. For our average document size of 500KB, this means ~1MB memory per document instance. At 50 editors, the server holds one canonical document copy (1MB) while clients each hold their own (1MB each). This is acceptable for documents under 10MB but would require tombstone garbage collection for very large documents.

**Alternative: Operational Transformation (OT):** OT has a longer production track record (Google Docs uses OT per F6). However, OT's centralized transformation server creates a single point of failure and a scaling bottleneck. The O(n^2) transformation cost at 50+ editors would require careful operation batching. We rejected OT because the scaling characteristics do not match our concurrency requirements.

**Alternative: Hybrid OT+CRDT:** A hybrid approach could use OT for small groups and CRDT for large groups. However, maintaining two sync paths increases implementation complexity significantly without clear benefit, since CRDT handles small groups efficiently as well.

### Decision

**Use Yjs CRDT library for document synchronization.** Rationale: best convergence performance at target concurrency (F1), built-in offline support (F3), no centralized transformation bottleneck (F4).

### Assumptions

- **[High confidence]** Average document size stays under 10MB. Based on current document analytics showing 95th percentile at 2MB.
- **[Medium confidence]** Yjs tombstone garbage collection (available since v13.6) is sufficient for long-lived documents. Needs monitoring in production.
- **[Low confidence]** Browser memory limits will not be hit at 2x document size. This depends on device capabilities of our user base, which skews toward modern laptops but includes some mobile devices.

## Decision 2: WebSocket Transport with Fallback

### Evidence Basis

Per finding F2, WebSocket provides bidirectional communication with 2-5ms baseline RTT. This is well within our sub-200ms latency target even after accounting for processing overhead.

Per finding F2, WebTransport adds multiplexing benefits but has limited browser support (< 60% as of 2025). Since our application targets broad browser compatibility (supporting last 2 versions of Chrome, Firefox, Safari, and Edge), WebTransport would require a fallback path regardless.

Per finding F15, presence data can share the WebSocket connection with sync data using message type multiplexing. A single connection simplifies connection lifecycle management and avoids the overhead of maintaining separate connections.

### Trade-offs Considered

**WebTransport multiplexing:** WebTransport's native stream multiplexing would allow independent flow control for sync vs presence data, preventing a large sync payload from blocking presence updates. However, at our message sizes (sync operations are typically < 1KB, presence updates < 100B), head-of-line blocking on WebSocket is negligible. The multiplexing benefit does not justify the browser compatibility cost.

**Server-Sent Events (SSE):** SSE provides server-to-client push but requires a separate channel for client-to-server messages. This half-duplex model adds architectural complexity for bidirectional sync without performance benefits.

### Decision

**Use WebSocket as primary transport with HTTP long-polling as fallback.** Rationale: broad browser support, sufficient performance (F2), single connection for both sync and presence (F15).

### Assumptions

- **[High confidence]** Enterprise firewalls and proxies support WebSocket. This is standard in 2025; our customer base has confirmed WebSocket compatibility.
- **[Medium confidence]** HTTP long-polling fallback will maintain sub-500ms (degraded but functional) latency. This is a graceful degradation, not the primary path.

## Decision 3: Paragraph-Level Conflict Detection with Visual Indicators

### Evidence Basis

Per finding F8, paragraph-level conflict detection adds 8-15ms to edit processing latency. Combined with our WebSocket RTT of 2-5ms (F2) and CRDT merge time (dependent on document size, but sub-50ms for typical documents per F1), the total round-trip stays well under the 200ms target.

Per finding F9, visual conflict indicators (colored cursors + change highlights) reduce user confusion by 60% compared to silent merge. This directly addresses DA-2 question 2 (conflict visualization).

Per finding F6, Google Docs' approach of silent last-writer-wins for formatting causes user confusion. Per finding F7, Figma's explicit conflict markers achieve 4.2/5 user satisfaction for conflict awareness. We follow the Figma model of making conflicts visible.

### Trade-offs Considered

**Character-level detection:** More granular but adds processing overhead proportional to edit frequency. At 50 concurrent editors making frequent character-level edits, the detection cost could approach our latency budget. Paragraph-level detection provides a practical balance.

**Section-level detection:** Coarser granularity would reduce processing cost but miss meaningful conflicts within long paragraphs. Users expect to see when someone is editing the same paragraph, not just the same section.

**Silent merge (Google Docs model):** Simplest to implement but causes user confusion (F6). We reject this because conflict awareness is a core UX requirement per DA-2.

### Decision

**Paragraph-level conflict detection with colored cursor indicators and change highlights.** Rationale: acceptable latency impact (F8), significant UX improvement (F9), follows proven Figma model (F7).

### Formatting Conflict Resolution

Per finding F10, formatting conflicts are rare (< 2% of concurrent edits) but cause disproportionate frustration. We apply last-writer-wins for formatting within a paragraph, with a 500ms visual indicator showing the formatting change was overridden. This addresses DA-2 question 3.

### Assumptions

- **[High confidence]** Paragraph boundaries are unambiguous in our document model (we use block-level elements).
- **[Medium confidence]** 8-15ms conflict detection overhead (F8) remains stable at 50+ concurrent editors. May need performance profiling at scale.
- **[Low confidence]** Users will understand the conflict visualization without onboarding. May need a brief tooltip or first-use tutorial.

## Decision 4: Throttled Presence with Cursor and Selection

### Evidence Basis

Per finding F13, users prioritize cursor positions (95% importance) and selections (78%) over viewport (34%) and typing indicators (45%). We include cursor position and active selection in presence data, exclude viewport, and include a simple typing indicator (boolean) as a low-cost addition.

Per finding F12, throttling presence updates to 10Hz (100ms intervals) reduces bandwidth by 83% with no perceptible lag in user studies. At 50 users, unthrottled 60Hz presence (F11) would consume 60KB/s inbound per client; at 10Hz this drops to approximately 10KB/s, well within typical connection budgets.

Per finding F14, stale presence data with 3-second timeout and fade-out animation is rated optimal in usability testing. We implement a 3-second heartbeat timeout: if no presence update arrives within 3 seconds, the user's cursor fades and their entry is removed from the active collaborators list after 10 seconds.

### Trade-offs Considered

**Higher throttle rate (30Hz):** Would provide smoother cursor movement rendering but at 3x the bandwidth cost. The user study in F12 found no perceptible difference between 10Hz and 30Hz for cursor tracking, so the additional bandwidth is not justified.

**Include viewport data:** Would enable "follow user" feature where one user can watch another's viewport. While useful, this is a premium feature that can be added later without architectural changes. Excluding it now reduces presence payload size by approximately 40%.

**Separate presence connection:** Per finding F15, sharing the WebSocket connection with multiplexed message types is preferable to a separate connection. We implement presence as a distinct message type on the shared WebSocket.

### Decision

**Track cursor position, active selection, and typing indicator. Throttle to 10Hz. Share WebSocket connection. 3-second heartbeat timeout with fade-out animation.** Rationale: includes high-value presence data (F13), optimal throttle rate (F12), proven timeout behavior (F14), efficient connection reuse (F15).

### Assumptions

- **[High confidence]** 10Hz update rate is sufficient for smooth cursor rendering with interpolation.
- **[Medium confidence]** 10KB/s per client presence bandwidth is acceptable for all connection types. Some mobile connections may struggle with 50-user rooms.
- **[Low confidence]** 3-second timeout is appropriate for all network conditions. Users on high-latency connections (satellite, congested mobile) may appear to disconnect frequently. May need adaptive timeout.

## Architecture Summary

| Component | Technology | Key Evidence |
|-----------|------------|-------------|
| Sync engine | Yjs CRDT | F1, F3, F4 |
| Transport | WebSocket + HTTP fallback | F2, F15 |
| Conflict detection | Paragraph-level with visual indicators | F7, F8, F9 |
| Presence | Cursor + selection, 10Hz throttle, 3s timeout | F12, F13, F14 |

## Risk Register

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Yjs tombstone memory growth on long-lived docs | Medium | Medium | Monitor memory; implement GC schedule per Yjs v13.6 docs |
| WebSocket blocked by enterprise proxy | Low | High | HTTP long-polling fallback with graceful degradation |
| Paragraph conflict detection latency at scale | Low | Medium | Performance profiling at 100 editors; consider word-level fallback |
| Mobile bandwidth constraints for presence | Medium | Low | Adaptive throttle rate based on connection quality |
