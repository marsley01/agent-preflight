# Agent Communication Protocol (ACP)

---

## Overview and Motivation

The Agent Communication Protocol (ACP) is the wire protocol that defines how agents discover each other, establish connections, exchange messages, stream data, and coordinate work across the agent mesh.

ACP is designed to be:

- **Language-agnostic**: Agents can be implemented in any language
- **Versioned**: Backward-compatible protocol evolution via semantic versioning
- **Secure**: Optional encryption, signing, and permission enforcement
- **Extensible**: Custom message types and capability negotiation
- **Transport-independent**: Works over WebSocket, HTTP, or in-memory channels

### Design Goals

| Goal | Approach |
|---|---|
| Decoupled agents | Message-based communication; no shared state |
| Runtime heterogeneity | Language-agnostic protocol with JSON serialization |
| Secure by default | Encryption, signing, permission checks on every message |
| Graceful evolution | Capability negotiation, version compatibility |
| Observable | Every message is traceable with correlation IDs |

---

## Protocol Versions

ACP uses semantic versioning (`MAJOR.MINOR.PATCH`):

- **MAJOR**: Incompatible protocol changes (new handshake, breaking message format changes)
- **MINOR**: Backward-compatible additions (new message types, optional fields)
- **PATCH**: Backward-compatible bug fixes

Current version: `1.0.0`

### Version Negotiation Flow

```
Client → HANDSHAKE_INIT { supportedVersions: ["1.0", "1.1", "2.0"] }
Server → HANDSHAKE_ACK { accepted: true, version: "1.1" }
Client → HANDSHAKE_NEGOTIATE { selectedVersion: "1.1", commonCapabilities: [...] }
Server → HANDSHAKE_COMPLETE { sessionId: "...", negotiatedVersion: "1.1" }
```

The highest version mutually supported by both peers is selected:

```typescript
function negotiateVersion(
  local: ACPVersion[],
  remote: ACPVersion[],
): ACPVersion | null {
  const sorted = [...local].sort(compareVersions).reverse();
  for (const v of sorted) {
    if (remote.includes(v)) return v;
  }
  return null;
}
```

---

## Handshake Flow

The complete handshake sequence:

```
CONNECTION ESTABLISHED (transport-level)
         │
         ▼
  ┌─────────────────┐
  │ HANDSHAKE_INIT  │──────► version, capabilities, agentId
  └────────┬────────┘
           │
           ▼
  ┌─────────────────┐
  │  HANDSHAKE_ACK  │◄────── accepted/rejected, version, sessionId
  └────────┬────────┘
           │ (if rejected → HANDSHAKE_ERROR)
           ▼
  ┌─────────────────────┐
  │ HANDSHAKE_NEGOTIATE │──────► selectedVersion, commonCapabilities
  └────────┬────────────┘
           │
           ▼
  ┌───────────────────┐
  │ HANDSHAKE_COMPLETE │◄────── sessionId, negotiatedVersion
  └────────┬──────────┘
           │
           ▼
  ┌────────────────┐
  │  MESSAGE FLOW  │
  └────────────────┘
```

### Handshake States

```
INITIATED → AWAITING_ACK → AWAITING_VERSION → AWAITING_CAPABILITIES
    → NEGOTIATING → ESTABLISHED
    → FAILED (at any point on error)
```

### Authentication During Handshake

```typescript
interface ACPAuthConfig {
  method: 'token' | 'certificate' | 'mutual_tls' | 'oauth';
  tokenEndpoint?: string;
  certificatePath?: string;
}
```

During `HANDSHAKE_INIT`, the client includes its authentication credentials. The server validates them before sending `HANDSHAKE_ACK`.

---

## Message Types and Formats

### Message Envelope

Every ACP message has a standard envelope:

```typescript
interface ACPMessage<T = unknown> {
  header: ACPMessageHeader;
  payload: T;
  signature?: string;     // Optional HMAC signature
}

interface ACPMessageHeader {
  messageType: ACPMessageType;
  messageId: string;       // UUID v4
  source: ACPAgentId;      // Sender agent ID
  target?: ACPAgentId;     // Optional recipient
  correlationId?: string;  // For request-response correlation
  sessionId?: string;      // Established during handshake
  flags: ACPMessageFlag[]; // SYNC, ASYNC, STREAM, PRIORITY, ENCRYPTED, COMPRESSED
  timestamp: number;       // Unix epoch milliseconds
  ttl?: number;            // Message TTL in milliseconds
  priority?: number;       // 0=lowest, 10=highest
  version: ACPVersion;     // Protocol version
}
```

### Message Categories

| Category | Types |
|---|---|
| **Handshake** | `HANDSHAKE_INIT`, `HANDSHAKE_ACK`, `HANDSHAKE_CAPABILITIES`, `HANDSHAKE_VERSION`, `HANDSHAKE_NEGOTIATE`, `HANDSHAKE_COMPLETE`, `HANDSHAKE_ERROR` |
| **Messaging** | `MESSAGE_SEND`, `MESSAGE_DELIVER`, `MESSAGE_ACK`, `MESSAGE_ERROR` |
| **Streaming** | `STREAM_INIT`, `STREAM_CHUNK`, `STREAM_COMPLETE`, `STREAM_CANCEL`, `STREAM_ERROR` |
| **Routing** | `ROUTE_ANNOUNCE`, `ROUTE_REMOVE`, `ROUTE_QUERY`, `ROUTE_RESPONSE` |
| **Events** | `EVENT_PUBLISH`, `EVENT_SUBSCRIBE`, `EVENT_UNSUBSCRIBE` |
| **Control** | `HEARTBEAT`, `HEALTH_CHECK`, `HEALTH_STATUS`, `ERROR`, `CANCEL` |

### Message Flags

| Flag | Meaning |
|---|---|
| `SYNC` | Sender expects a correlated response |
| `ASYNC` | Fire-and-forget; no response expected |
| `STREAM` | Message is part of a stream |
| `PRIORITY` | Message should be prioritized in queuing |
| `ENCRYPTED` | Payload is encrypted |
| `COMPRESSED` | Payload is compressed |

---

## Transport Bindings

### WebSocket Transport

Persistent, bidirectional connection with automatic reconnection.

```
Agent A ──[WebSocket]──► Agent B
    │                         │
    ├── connect(endpoint)     ├── onopen
    ├── send(message)         ├── onmessage
    ├── disconnect()          ├── onclose
    └── reconnect(delay)      └── onerror
```

### HTTP Transport

Stateless request-response with optional polling for incoming messages.

```
Agent A ──POST /messages──► HTTP Server
Agent A ◄─── 200 OK ──────── HTTP Server
Agent A ──GET /messages/poll──► HTTP Server (polling)
```

### InMemory Transport

In-process message passing without serialization. Used for local development and testing.

```
Agent A ──link()──► Agent B
```

### Transport Configuration

```typescript
interface TransportConfig {
  agentId: string;
  version: ACPVersion;
  timeoutMs: number;
  maxRetries: number;
  maxQueueSize: number;
  heartbeatIntervalMs: number;
  reconnectDelayMs: number;
  endpoints?: Record<string, string>;
}
```

---

## Routing and Delivery Guarantees

### Message Routing

The `MessageRouter` matches messages to agents using pattern-based rules:

```typescript
interface RouteRule {
  ruleId: string;
  matchPattern: string;    // '*', agent ID, message type, or wildcard
  targetAgent: ACPAgentId;
  priority: number;
  ttl?: number;
  createdAt: number;
  expiresAt?: number;
}
```

### Delivery Semantics

| Mode | Guarantee | Mechanism |
|---|---|---|
| Best-effort | At-most-once | Fire-and-forget (`ASYNC` flag) |
| Reliable | At-least-once | ACK + retry with backoff |
| Transactional | Exactly-once | Idempotency keys + deduplication |
| Ordered | Per-stream order | Sequence numbers in stream chunks |

### Priority Queuing

Messages with the `PRIORITY` flag enter a priority queue:

```typescript
queue.enqueue(message, priority);  // Higher priority delivered first
queue.dequeue();                   // Returns highest-priority message
```

---

## Security Considerations

### Channel Security

- **WebSocket**: Use `wss://` in production
- **HTTP**: Use `https://` with TLS 1.3
- **mTLS**: Mutual certificate authentication for agent-to-agent

### Message Security

- **Encryption**: Payload encryption with AES-256-GCM when `ENCRYPTED` flag is set
- **Signing**: HMAC signature in the `signature` field for integrity
- **Compression**: Optional payload compression with `COMPRESSED` flag

### Permission Enforcement

```typescript
interface ACPPermissionsConfig {
  defaultDeny: boolean;        // Fail-closed
  allowList: string[];         // Explicitly allowed message types
  denyList: string[];          // Explicitly denied message types
  scope: string;               // Permission scope
}
```

---

## Error Handling

### Error Codes

```typescript
enum ACPErrorCode {
  HANDSHAKE_FAILED = 'HANDSHAKE_FAILED',
  HANDSHAKE_TIMEOUT = 'HANDSHAKE_TIMEOUT',
  VERSION_MISMATCH = 'VERSION_MISMATCH',
  TRANSPORT_DISCONNECTED = 'TRANSPORT_DISCONNECTED',
  TRANSPORT_TIMEOUT = 'TRANSPORT_TIMEOUT',
  TRANSPORT_UNAVAILABLE = 'TRANSPORT_UNAVAILABLE',
  TARGET_UNREACHABLE = 'TARGET_UNREACHABLE',
  MESSAGE_INVALID = 'MESSAGE_INVALID',
  MESSAGE_QUEUE_FULL = 'MESSAGE_QUEUE_FULL',
  MESSAGE_TIMEOUT = 'MESSAGE_TIMEOUT',
  ROUTE_NOT_FOUND = 'ROUTE_NOT_FOUND',
  STREAM_NOT_FOUND = 'STREAM_NOT_FOUND',
  STREAM_ALREADY_EXISTS = 'STREAM_ALREADY_EXISTS',
  STREAM_CANCELLED = 'STREAM_CANCELLED',
}
```

### Retry Logic

```typescript
interface ACPRetryConfig {
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
  backoffFactor: number;    // Exponential: delay = baseDelay * factor^attempt
  retryOnCodes?: string[];  // Which errors to retry (default: all retryable)
}
```

---

## Extensibility

### Custom Message Types

Protocol extensions can define custom message types within the `acp:ext:` namespace:

```
acp:ext:my-plugin:action
```

Custom types are negotiated during capability discovery:

```typescript
// Agent declares support for custom extension
capabilities: ['ext:my-plugin', 'ext:another-plugin']

// Router handles custom type
router.addRoute({
  matchPattern: 'acp:ext:my-plugin:*',
  targetAgent: 'my-plugin-handler',
  priority: 100,
});
```

### Capability Discovery

Agents discover each other's capabilities during handshake:

```typescript
interface ACPCapability {
  Handshake = 'handshake',
  Auth = 'auth',
  CapabilityDiscovery = 'capability_discovery',
  AgentRegistry = 'agent_registry',
  TaskDelegation = 'task_delegation',
  Streaming = 'streaming',
  MemorySharing = 'memory_sharing',
  EventPubSub = 'event_pubsub',
  Retry = 'retry',
  Heartbeat = 'heartbeat',
  HealthCheck = 'health_check',
  VersionNegotiation = 'version_negotiation',
  Encryption = 'encryption',
  Permissions = 'permissions',
  Routing = 'routing',
  Priorities = 'priorities',
  Cancellation = 'cancellation',
  Timeouts = 'timeouts',
  Observability = 'observability',
  Tracing = 'tracing',
  Metrics = 'metrics',
}
```

Custom capabilities are negotiated and enabled only if both peers support them.
