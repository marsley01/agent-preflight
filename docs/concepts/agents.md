# Agent Concepts

---

## Agent Identity and Registration

Every agent in the system has a unique identity defined by:

```typescript
interface AgentConfig {
  id: AgentId;                         // UUID v7 recommended
  status: AgentStatus;
  metadata: AgentMetadata;             // name, description, version, tags
  capabilities: AgentCapabilities;     // modelFamilies, memoryLayers, plugins, custom
  dependencies: AgentDependency[];     // required and optional agent dependencies
  maxConcurrency: number;
  maxQueueSize: number;
  timeout: Duration;
  retryPolicy: {
    maxRetries: number;
    baseDelay: Duration;
    maxDelay: Duration;
    backoffFactor: number;
  };
}
```

### Registration Flow

```
Agent Start → Register with Runtime → Publish to Registry → Announce to Mesh
                                                                  │
                                                                  ▼
                                                         Discoverable by Peers
```

1. Agent starts and transitions to `STARTING` state
2. `RuntimeManager.registerAgent()` stores the agent in `AgentContainer`
3. Agent broadcasts `REGISTER` message via ACP to announce presence
4. Other agents can discover via `CAPABILITY_DISCOVERY` messages or registry queries

### Agent Info (Public View)

```typescript
interface AgentInfo {
  id: AgentId;
  name: string;
  description: string;
  version: Version;
  status: AgentStatus;
  capabilities: AgentCapabilities;
  metadata: AgentMetadata;
  healthy: boolean;
  lastSeen: Timestamp;
}
```

---

## Capabilities and Discovery

Capabilities are the functional building blocks an agent exposes:

```typescript
interface AgentCapabilities {
  modelFamilies: ModelFamily[];          // Which LLM families this agent can use
  maxContextLength: number;              // Maximum context window in tokens
  supportedMessageTypes: ACPMessageType[]; // Which ACP messages this agent handles
  streaming: boolean;                    // Supports streaming responses
  functionCalling: boolean;              // Supports tool/function calling
  memoryLayers: MemoryLayer[];           // Which memory layers are available
  plugins: PluginId[];                   // Loaded plugins
  custom: string[];                      // Custom capability identifiers
}
```

### Discovery Flow

```
Agent A ──[CAPABILITY_DISCOVERY(query=["web-search"])]──► Registry
Agent A ◄──[ROUTE_RESPONSE(matches=[agent-b, agent-c])]── Registry
```

Through the `MessageRouter`, agents can discover peers by:

- **Agent ID**: Direct lookup
- **Capability**: Find agents with specific capabilities
- **Model family**: Find agents using specific LLMs
- **Custom**: Arbitrary custom capability matching

---

## Agent States and Lifecycle

The `AgentLifecycle` class implements a deterministic state machine:

```
                    ┌─────────┐
                    │ STOPPED │
                    └────┬────┘
                    ┌────┴─────┐
                    │ STARTING │
                    └────┬─────┘
                    ┌────┴─────┐
             ┌──────┤ RUNNING  ├──────┐
             │      └────┬─────┘      │
             ▼           ▼            ▼
        ┌────────┐ ┌──────────┐ ┌────────┐
        │PAUSING │ │ STOPPING │ │ ERROR  │
        └───┬────┘ └───┬──────┘ └───┬────┘
            ▼          ▼            ▼
        ┌───────┐ ┌─────────┐ ┌───────┐
        │PAUSED │ │ STOPPED │ │STOPPED│
        └───┬───┘ └─────────┘ └───────┘
            │
            └──►...resume() returns to STARTING
```

Each transition is validated against a transition table:

```typescript
const VALID_TRANSITIONS: Record<LifecycleState, LifecycleState[]> = {
  STOPPED:  ["STARTING"],
  STARTING: ["RUNNING", "ERROR"],
  RUNNING:  ["PAUSING", "STOPPING", "ERROR"],
  PAUSING:  ["PAUSED", "ERROR"],
  PAUSED:   ["STARTING", "STOPPING"],
  STOPPING: ["STOPPED", "ERROR"],
  ERROR:    ["STOPPING", "STARTING"],
};
```

### Health Monitoring

Each running agent runs periodic health checks:

- Default interval: 15 seconds
- Reports `HEALTHY`, `DEGRADED`, or `UNHEALTHY` status
- Health status is exposed via the runtime's health endpoint
- Unhealthy agents can trigger automatic restart policies

### Resource Tracking

Agents track resource usage during execution:

```typescript
interface ResourceUsage {
  cpu: number;
  memory: number;
  network: { bytesIn: number; bytesOut: number };
  tokens: { input: number; output: number };
}
```

---

## Communication Patterns

Agents communicate through the Agent Communication Protocol (ACP) using these patterns:

### 1. Direct Messaging

```
Agent A → ACPMessage(target: "agent-b") → MessageRouter → Agent B
```

Used for task delegation, status updates, and targeted queries.

### 2. Broadcast

```
Agent A → ACPMessage(target: undefined) → MessageRouter → All Matching Agents
```

Used for announcements, capability updates, and discovery.

### 3. Request-Reply (Correlated)

```
Agent A → { correlationId: "req-123" } → Agent B
Agent A ← { correlationId: "req-123" } ← Agent B
```

The `MessageRouter.sendAndWait()` method manages pending requests with timeouts.

### 4. Publish-Subscribe

```
Publisher → EventBus.publish(event) → Subscriber A
                                      → Subscriber B
```

The `EventBus` supports typed events with filtering by source, type, and metadata.

### 5. Streaming

```
Sender → STREAM_INIT → STREAM_CHUNK(n) → ... → STREAM_COMPLETE
```

Managed by `StreamManager` with support for cancellation and backpressure.

---

## Agent Permissions and Security

Each agent carries a `SecurityContext`:

```typescript
interface SecurityContext {
  userId?: string;
  agentId?: AgentId;
  roles: Role[];                     // e.g., ["agent", "viewer"]
  permissions: Permission[];         // e.g., ["memory:read", "task:write"]
  policies: PolicyDocument[];        // ABAC policies
  encryptedClaims?: string;          // Encrypted identity claims
}
```

### Default Agent Permissions

The built-in `agent` role grants:

| Permission | Description |
|---|---|
| `task:read` | View assigned and available tasks |
| `task:write` | Create and update tasks |
| `memory:read` | Read from permitted memory layers |
| `memory:write` | Write to permitted memory layers |
| `model:read` | Access configured LLM models |

### Cross-Agent Memory Access

Controlled by `MemoryAccessControl`:

```typescript
interface MemoryAccessControl {
  principalId: string;               // Agent or user ID
  permission: 'NONE' | 'READ' | 'WRITE' | 'ADMIN';
  tagFilters?: string[];             // Restrict by tags
  expiresAt?: Timestamp;
}
```

By default, agents can only access their own memory. Cross-agent access requires explicit ACL configuration.

---

## Agent Memory and Context

Each agent has a `MemoryManager` instance that provides:

- **Working memory**: Ephemeral, task-scoped data (TTL: minutes)
- **Session memory**: Per-session state (TTL: hours)
- **Long-term memory**: Persistent knowledge (TTL: indefinite)
- **Semantic memory**: Embedding-based similarity search
- **Knowledge graph**: Structured entity-relationship storage

### Context Object

The `AgentContext` passed to every message handler:

```typescript
interface AgentContext {
  config: RuntimeConfig;
  protocolClient: {
    send(message: ACPMessage): Promise<void>;
    receive(): AsyncIterable<ACPMessage>;
  };
  memoryManager: MemoryStore;
  securityContext: SecurityContext;
  logger: {
    trace(msg: string, ...args: unknown[]): void;
    debug(msg: string, ...args: unknown[]): void;
    info(msg: string, ...args: unknown[]): void;
    warn(msg: string, ...args: unknown[]): void;
    error(msg: string, ...args: unknown[]): void;
  };
}
```
