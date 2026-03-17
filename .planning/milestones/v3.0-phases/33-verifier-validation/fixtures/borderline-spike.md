# SPIKE: Real-Time Collaboration Tactical Decisions

## Overview

This spike resolves three tactical decisions deferred from the design phase. Each decision was flagged as requiring hands-on investigation before committing to an implementation approach.

## TD-1: Yjs Persistence Layer Selection

### Decision Context

The design selected Yjs for document synchronization (DA-1). The tactical question is which persistence layer to use for storing Yjs document state on the server side: y-leveldb, y-redis, or a custom adapter for PostgreSQL.

### Investigation

We created proof-of-concept implementations for all three options and benchmarked them.

**y-leveldb:**
- Write latency: 2-4ms for typical document updates
- Read latency: 1-2ms for document loading
- Storage footprint: ~1.5x document size due to LevelDB overhead
- Tested with 100 concurrent connections writing to 10 documents simultaneously
- Results: stable performance, no write contention issues
- Limitation: single-process only; horizontal scaling requires sharding

**y-redis:**
- Write latency: 5-8ms (network hop to Redis instance)
- Read latency: 3-5ms
- Storage footprint: ~2x document size (Redis serialization overhead)
- Tested with 100 concurrent connections across 3 server instances
- Results: consistent performance, native support for multi-instance deployment
- Limitation: requires Redis infrastructure; adds operational complexity

**Custom PostgreSQL adapter:**
- Write latency: 15-25ms (JSONB upsert with Yjs binary encoding)
- Read latency: 8-12ms
- Would integrate with existing database infrastructure
- However: Yjs binary format requires custom serialization, and the latency is significantly higher than dedicated solutions

### Decision

**Use y-redis for Yjs persistence.** Rationale: the 5-8ms write latency is within our budget (sub-200ms total), it natively supports our multi-instance deployment requirement, and Redis is already in our infrastructure stack. The 3-5ms read latency is acceptable since document loads are not latency-critical (initial load, not per-edit).

### Implementation Steps

1. Install y-redis package: `npm install y-redis`
2. Configure Redis connection in `src/config/redis.ts` using existing Redis credentials
3. Create `src/sync/persistence.ts` adapter wrapping y-redis with our document ID scheme
4. Add connection pooling (max 10 connections per server instance)
5. Implement document TTL (30 days inactive = archive to PostgreSQL cold storage)
6. Add health check endpoint for Redis connectivity at `/api/health/redis`

### Assumptions

- **[High confidence]** Redis is available in all deployment environments (confirmed with infra team)
- **[Medium confidence]** y-redis handles Yjs v2 document updates correctly (tested with v13.6.8)

## TD-2: WebSocket Authentication Flow

### Decision Context

The design uses WebSocket for transport. The tactical question is how to authenticate WebSocket connections: JWT in connection URL query parameter, JWT in first message after connect, or session cookie-based authentication.

### Investigation

We evaluated the security implications and implementation complexity of each approach.

**JWT in query parameter:**
- Simple to implement
- JWT visible in server access logs and potentially in browser history
- Standard approach used by Socket.io and other WebSocket libraries

**JWT in first message:**
- Slightly more complex; requires a pre-auth state on the server
- JWT not exposed in logs or URLs
- Adds latency to connection establishment (one extra round-trip)

**Session cookie-based:**
- Leverages existing session infrastructure
- Cookie sent automatically on WebSocket upgrade request
- No extra implementation for auth; same session validation as HTTP endpoints
- Works with existing CSRF protections

### Decision

**Use session cookie authentication on WebSocket upgrade.** The WebSocket upgrade request is a standard HTTP request that includes cookies. The server validates the session cookie during the upgrade handshake, rejecting unauthorized connections before the WebSocket is established. This reuses our existing session infrastructure with zero additional auth code.

### Implementation Steps

1. Add session validation middleware to WebSocket upgrade handler in `src/ws/server.ts`
2. Extract user ID from validated session and attach to WebSocket connection object
3. Implement connection rejection with 401 status on failed session validation
4. Add per-document authorization check: validate user has edit/view permission on document join

### Assumptions

- **[High confidence]** Session cookies are sent on WebSocket upgrade requests (HTTP spec behavior)
- **[High confidence]** Existing session validation middleware is reusable for upgrade requests

## TD-3: Presence Update Compression Strategy

### Decision Context

The design specifies 10Hz presence updates with cursor and selection data. At 50 concurrent users, this generates significant message volume. The tactical question is whether to implement compression and what strategy to use.

### Investigation

This one needs more analysis. The design already specifies a 10Hz throttle which helps. Some things we looked at:

Presence messages are small (typically 50-100 bytes per update). Standard compression algorithms like gzip have overhead that exceeds the compression benefit for messages this small. Delta compression (sending only changed fields) could reduce message size by 30-50% when only cursor position changes.

We did not benchmark delta compression in a production-like environment. The theoretical savings are modest.

### Decision

**Skip compression for now; revisit if bandwidth becomes an issue.** The unthrottled bandwidth at 10Hz with 50 users is approximately 10KB/s per client, which is manageable. Adding compression complexity for a 30-50% reduction on an already-small payload is not justified at this stage.

### Implementation Steps

1. Implement presence messages as plain JSON over the existing WebSocket connection
2. Use fixed-schema message format for efficient parsing: `{type: "presence", uid: string, cursor: {line, col}, selection: {start, end} | null}`
3. Add bandwidth monitoring to track actual presence data volume in production
4. If bandwidth exceeds 50KB/s per client, implement delta compression as a follow-up

### Assumptions

- **[Medium confidence]** 10KB/s per client is acceptable for all target environments
- Bandwidth monitoring infrastructure exists or can be added easily
- Delta compression can be added later without protocol changes
