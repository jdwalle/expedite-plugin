# DESIGN: Real-Time Collaboration System

## Overview

This document describes the design for a real-time collaboration feature. The system needs to support multiple concurrent editors with low latency and good conflict handling. Research findings from the scope phase inform these decisions.

## Decision 1: Use CRDTs for Synchronization

### Rationale

CRDTs provide better convergence than OT at scale. Research showed that CRDT-based approaches handle concurrent edits more efficiently, which is important for our 50+ user target. Specifically, per DA-1 finding F1, Yjs converges in O(n log n) compared to OT's O(n^2).

The Yjs library also handles offline scenarios well. When users disconnect and reconnect, Yjs can merge the divergent document states (F3). This is important for mobile users who may have intermittent connectivity.

### Alternatives

We considered OT, which Google Docs uses (F6). OT requires a centralized transformation server which creates scaling challenges. We also briefly looked at a hybrid approach but decided the complexity wasn't worth it.

### Decision

Use Yjs for document synchronization.

### Assumptions

- **[High]** Documents stay under 10MB on average
- **[Medium]** Yjs tombstone GC works for long-lived documents

## Decision 2: WebSocket Transport

### Rationale

WebSocket provides good bidirectional communication. Per F2, it has 2-5ms baseline RTT which is well within our latency requirements. We can also use the same connection for both sync and presence data (F15), which simplifies the architecture.

WebTransport was considered but browser support is limited. SSE only supports one-way communication, which doesn't work for our synchronization needs.

### Decision

Use WebSocket as the primary transport protocol. The system assumes that network latency between the client and server will remain under 200ms for the sync path to function correctly within our SLA.

### Assumptions

- **[High]** Enterprise environments support WebSocket connections

## Decision 3: Conflict Visualization with Paragraph-Level Detection

### Rationale

We need users to understand when conflicts happen. Per finding F9, visual indicators reduce confusion by 60%. Paragraph-level detection adds 8-15ms latency (F8) which is acceptable.

The system uses colored cursors and change highlights to show where other users are editing. This follows the approach used by Figma (F7), which has high user satisfaction for conflict awareness.

For formatting conflicts, we use last-writer-wins. Research indicated that formatting conflicts are rare (F10), so a simple resolution strategy is adequate.

### Alternatives

Character-level detection was considered but deemed too expensive at 50+ editors. Section-level was too coarse.

### Decision

Paragraph-level detection with visual conflict indicators.

### Assumptions

- **[Medium]** Detection latency stays stable at scale

## Decision 4: Presence System

### Rationale

Users need to see where other collaborators are working. Per F13, cursor position (95% importance) and selections (78%) are the most valued presence indicators. We include both.

Presence updates are throttled to reduce bandwidth. Throttling to 10Hz reduces bandwidth by 83% per F12 with no perceptible impact on user experience. At 50 concurrent users, unthrottled updates would consume 60KB/s per client (F11), which is too much.

For handling disconnected users, we use a timeout approach. When a user's connection drops, their presence indicator is removed after a reasonable timeout period. This prevents the "ghost cursor" problem that users find annoying (F14).

### Decision

Track cursor and selection. Throttle to 10Hz. Timeout after disconnect.

### Assumptions

- **[High]** 10Hz is smooth enough for cursor display
- **[Medium]** Bandwidth is acceptable on all connection types

## Architecture Summary

| Component | Technology | Reasoning |
|-----------|------------|-----------|
| Sync | Yjs CRDT | Best convergence at scale |
| Transport | WebSocket | Low latency, bidirectional |
| Conflicts | Paragraph-level + visual | Good UX, acceptable latency |
| Presence | Cursor + selection, throttled | High-value indicators only |

## Risk Register

| Risk | Mitigation |
|------|------------|
| Yjs memory growth | Monitor and use GC |
| WebSocket blocked | Add fallback transport |
| Latency at scale | Performance test before launch |
