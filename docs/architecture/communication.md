# Communication Architecture

## Agent Communication Protocol (ACP)

ACP is the wire protocol for all inter-agent communication in Agent Preflight. It defines message formats, handshake procedures, transport bindings, routing semantics, and security guarantees.

```
┌─────────────────────────────────────────────────────────────┐
│                     ACP Message Envelope                      │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  Header (messageType, source, target, correlationId,  │  │
│  │          flags, timestamp, ttl, priority, version)     │  │
│  ├───────────────────────────────────────────────────────┤  │
│  │  Payload (type-specific data)                         │  │
│  ├───────────────────────────────────────────────────────┤  │
│  │  Signature (optional HMAC)                            │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### Protocol Versions

ACP uses semantic versioning (`major.minor.patch`). During handshake, peers negotiate the highest mutually-supported version:

```
Client: "I support versions [1.0, 1.1, 2.0]"
Server: "I support versions [1.0, 1.1]"
Result: Negotiated version = 1.1 (highest common)
```

The `negotiateVersion` function implements the selection algorithm:

```typescript
function negotiateVersion(
  localVersions: ACPVersion[],
  remoteVersions: ACPVersion[],
): ACPVersion | null {
  const sortedLocal = [...localVersions].sort(compareVersions).reverse();
  const sortedRemote = [...remoteVersions].sort(compareVersions).reverse();
  for (const localVersion of sortedLocal) {
    if (sortedRemote.includes(localVersion)) return localVersion;
  }
  return null;
}
```

---

## Message Flow Patterns

### 1. One-Way (Fire-and-Forget)

```
Sender ──[MESSAGE_SEND]────────────────────────► Receiver
```

No acknowledgment expected. Used for notifications, events, and logging.

### 2. Request-Response (Correlated)

```
Sender ──[MESSAGE_SEND(correlationId=X)]──────► Receiver
Sender ◄──[MESSAGE_DELIVER(correlationId=X)]──── Receiver
```

The `MessageRouter.sendAndWait()` method facilitates this pattern, managing pending message state and timeout enforcement:

```typescript
const response = await router.sendAndWait(
  requestMessage,
  transport.send.bind(transport),
  30_000, // timeout
);
```

### 3. Publish-Subscribe

```
Publisher ──[EVENT_PUBLISH]──► EventBus ──[fan-out]──► Subscriber A
                                                    ──► Subscriber B
```

Agents subscribe to event types via `EventBus.subscribe()`:

```typescript
const unsubscribe = eventBus.subscribe(
  ProtocolEventType.MESSAGE_RECEIVED,
  (event) => console.log(event.data),
  { source: 'agent-1' }, // optional filter
);
```

### 4. Streaming

```
Provider ──[STREAM_INIT(id=S)]──────► Consumer
Provider ──[STREAM_CHUNK(id=S, seq=1)]──► Consumer
Provider ──[STREAM_CHUNK(id=S, seq=2)]──► Consumer
Provider ──[STREAM_COMPLETE(id=S)]──► Consumer
```

Streams support cancellation:

```
Consumer ──[STREAM_CANCEL(id=S)]──► Provider
```

---

## Transport Layer

ACP supports three transport bindings, interchangeable via the `TransportProvider` interface:

```typescript
interface TransportProvider {
  readonly isConnected: boolean;
  connect(config: TransportConfig): Promise<void>;
  disconnect(): Promise<void>;
  send<T>(message: ACPMessage<T>): Promise<void>;
  receive<T>(timeoutMs?: number): Promise<ACPMessage<T> | null>;
  onMessage<T>(handler: (message: ACPMessage<T>) => void): () => void;
  onError(handler: (error: TransportError) => void): () => void;
  onClose(handler: (code: number, reason: string) => void): () => void;
}
```

### WebSocket Transport

Persistent, bidirectional, full-duplex. Best for real-time agent communication.

- Automatic reconnection with configurable delay
- JSON message serialization
- `onopen` / `onmessage` / `onerror` / `onclose` lifecycle

```typescript
const transport = new WebSocketTransport();
await transport.connect({
  agentId: 'agent-1',
  version: '1.0',
  endpoints: { websocket: 'ws://localhost:8080/ws' },
  timeoutMs: 30_000,
  reconnectDelayMs: 5_000,
});
```

### HTTP Transport

Request-response style. Suitable for stateless agents and serverless environments.

- POST for sending messages to the endpoint
- Optional GET polling for receiving messages
- Standard HTTP headers (`Content-Type`, `X-Agent-ID`)

```typescript
const transport = new HTTPTransport();
await transport.connect({
  agentId: 'agent-1',
  version: '1.0',
  endpoints: {
    http: 'http://localhost:8080/api/messages',
    http_poll: 'http://localhost:8080/api/messages/poll',
  },
  timeoutMs: 30_000,
});
```

### InMemory Transport

Zero-config, in-process transport. Used for local development and testing.

- Linked instances via `transport.link(otherTransport)`
- No serialization overhead
- Priority-ordered message queue

```typescript
const transportA = new InMemoryTransport();
const transportB = new InMemoryTransport();
transportA.link(transportB);

await transportA.connect(config);
await transportB.connect(config);
```

### Message Queue

All transports share a priority-based `MessageQueue` for buffering:

```typescript
const queue = new MessageQueue(maxSize: 1000);
queue.enqueue(message, priority: 5);  // higher = delivered first
queue.enqueue(message, priority: 1);
const next = queue.dequeue();  // returns priority 5 message
```

---

## Routing and Delivery Guarantees

### MessageRouter

The `MessageRouter` provides pattern-based message routing with priority queuing and TTL expiry.

**Route Rules:**

```typescript
interface RouteRule {
  ruleId: string;
  matchPattern: string;   // '*', agent ID, message type, or wildcard pattern
  targetAgent: ACPAgentId;
  priority: number;       // higher = matched first
  ttl?: number;           // time-to-live in ms
  createdAt: number;
  expiresAt?: number;
}
```

**Pattern Matching:**

| Pattern | Matches |
|---|---|
| `*` | All messages |
| `agent-1` | Messages from/to `agent-1` |
| `acp:task:*` | All task-related messages |
| `agent-*` | Any agent starting with `agent-` |

### Delivery Guarantees

| Guarantee | Implementation |
|---|---|
| **At-most-once** | Fire-and-forget messages without ACK |
| **At-least-once** | Messages with retry and acknowledgment |
| **Exactly-once** | Deduplication via `correlationId` + idempotent handlers |
| **Ordered delivery** | Per-stream sequence numbers in streaming |
| **Priority ordering** | Priority queue within `MessageRouter` |
| **TTL expiry** | Automatic route and message expiry |

---

## Streaming and Chunking

The `StreamManager` handles streaming data delivery:

### Stream States

```
INITIALIZED → ACTIVE → COMPLETED
                │          │
                ▼          ▼
             PAUSED     CANCELLED
                │
                ▼
              ERROR
```

### Stream Operations

```typescript
const manager = new StreamManager();

// Create a stream
const info = manager.createStream('stream-1', 'agent-a', 'agent-b');

// Append a chunk
manager.appendChunk({
  streamId: 'stream-1',
  sequence: 1,
  data: { token: "Hello" },
  isFinal: false,
  timestamp: Date.now(),
});

// Subscribe to stream events
const unsubscribe = manager.subscribe({
  streamId: 'stream-1',
  onChunk: (chunk) => processChunk(chunk),
  onComplete: (id) => finalize(id),
  onError: (err) => handleError(err),
});

// Clean up stale streams
manager.cleanupStaleStreams(maxAgeMs: 300_000);
```

---

## Event System and Pub/Sub

The `EventBus` provides a typed pub/sub system for protocol-level events:

### Event Types

| Event | Trigger |
|---|---|
| `CONNECTED` | Transport connection established |
| `DISCONNECTED` | Transport connection lost |
| `MESSAGE_RECEIVED` | Message delivered to handler |
| `MESSAGE_SENT` | Message transmitted on transport |
| `ERROR` | Transport or protocol error |
| `HEALTH_CHECK` | Health check result |
| `AGENT_REGISTERED` | Agent joined the mesh |
| `AGENT_UNREGISTERED` | Agent left the mesh |

### Event Filtering

Subscribers can filter events by source, type, and metadata:

```typescript
eventBus.subscribe(
  ProtocolEventType.MESSAGE_RECEIVED,
  handler,
  { source: 'trusted-agent-1' }
);
```

### Event History

The `EventBus` maintains a configurable circular buffer of recent events for debugging:

```typescript
const history = eventBus.getHistory(ProtocolEventType.ERROR);
```

---

## Security and Encryption

### Message Security

ACP messages support:

- **Encryption**: Payload-level encryption using configurable algorithms (AES-256-GCM)
- **Signatures**: HMAC signatures for message integrity
- **Compression**: Payload compression for large messages

### Security Configuration

```typescript
interface ACPSecurityConfig {
  encryption?: {
    algorithm: string;    // 'aes-256-gcm'
    keyExchange: string;  // 'diffie-hellman'
    keySize: number;      // 256
  };
  auth?: {
    method: 'token' | 'certificate' | 'mutual_tls' | 'oauth';
    tokenEndpoint?: string;
  };
  permissions?: {
    defaultDeny: boolean;
    allowList: string[];
    denyList: string[];
    scope: string;
  };
}
```

### Transport Layer Security

- WebSocket: WSS (TLS) for production
- HTTP: HTTPS with mTLS support
- InMemory: No serialization, inherently secure within the process boundary

### Message Validation

Every received message is validated for:

1. **Format**: Valid JSON, required header fields present
2. **Schema**: Correct message type for payload
3. **Timeliness**: TTL not expired
4. **Authorization**: Source agent is permitted to send to target
5. **Integrity**: Signature matches if `ENCRYPTED` flag is set
