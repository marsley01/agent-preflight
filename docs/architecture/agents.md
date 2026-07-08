# Agent Architecture

## What is an Agent?

In Agent Preflight, an **agent** is an autonomous computational entity that communicates via the Agent Communication Protocol (ACP), maintains its own memory context, operates within a security boundary, and executes tasks against LLM providers or custom tooling.

Agents are the fundamental unit of work. Every task delegation, message exchange, and workflow step involves one or more agents.

```
┌──────────────────────────────────────────────────────┐
│                     Agent                             │
│                                                        │
│  ┌────────────┐  ┌────────────┐  ┌────────────────┐  │
│  │  Identity   │  │ Lifecycle  │  │  Communication  │  │
│  │  & Metadata │  │  State     │  │  (ACP Client)  │  │
│  └────────────┘  └────────────┘  └────────────────┘  │
│                                                        │
│  ┌────────────┐  ┌────────────┐  ┌────────────────┐  │
│  │  Memory     │  │  Security  │  │  Capabilities   │  │
│  │  Context    │  │  Context   │  │  & Tools        │  │
│  └────────────┘  └────────────┘  └────────────────┘  │
└──────────────────────────────────────────────────────┘
```

---

## Agent Lifecycle

Every agent progresses through a well-defined lifecycle managed by `AgentLifecycle`:

```
                          ┌─────────┐
                          │ STOPPED │
                          └────┬────┘
                               │ start()
                               ▼
                          ┌──────────┐
                    ┌────►│ STARTING │
                    │     └────┬─────┘
                    │          │ success
                    │          ▼
                    │     ┌──────────┐
                    │     │ RUNNING  │◄──────────────┐
                    │     └────┬─────┘               │
                    │          │                     │
                    │    ┌─────┴─────┐              │
                    │    │           │              │
                    │    ▼           ▼              │
                    │ ┌────────┐ ┌────────┐        │
                    │ │PAUSING │ │STOPPING│        │
                    │ └───┬────┘ └───┬────┘        │
                    │     │          │              │
                    │     ▼          ▼              │
                    │ ┌───────┐ ┌─────────┐        │
                    │ │PAUSED │ │ STOPPED │        │
                    │ └───┬───┘ └─────────┘        │
                    │     │ resume()                │
                    │     └─────────────────────────┘
                    │
                    │     ┌───────┐
                    └─────┤ ERROR │
                          └───────┘
```

### Lifecycle States

| State | Description |
|---|---|
| `STOPPED` | Initial state. Agent is defined but not running. |
| `STARTING` | Agent is initializing resources, registering capabilities, connecting to the mesh. |
| `RUNNING` | Agent is operational and can receive/process messages. |
| `PAUSING` | Graceful suspension in progress — completing current tasks, refusing new ones. |
| `PAUSED` | Agent is suspended. Can be resumed to `STARTING` or stopped. |
| `STOPPING` | Graceful shutdown — cleaning up resources, flushing memory, closing connections. |
| `ERROR` | Unrecoverable error occurred. Agent can be restarted or stopped from here. |

Transition validation is enforced by `VALID_TRANSITIONS` in the lifecycle state machine. Invalid transitions throw `AgentLifecycleError`.

---

## Agent Types

### 1. Stateless Worker Agent
Executes a single task and returns. No persistent memory. Ideal for transformations, validations, and simple lookups.

### 2. Stateful Service Agent
Maintains session and long-term memory. Used for conversational agents, research assistants, and multi-turn workflows.

### 3. Orchestrator Agent
Coordinates other agents. Delegates subtasks, aggregates results, manages workflow state. Has broad visibility across the agent mesh.

### 4. Gateway Agent
Sits at the boundary of the agent mesh. Handles authentication, rate limiting, protocol translation, and routing to internal agents.

### 5. Tool Agent
Wraps external tools, APIs, or data sources. Exposes capabilities as callable functions. Typically stateless with minimal memory.

### 6. Evaluation Agent
Runs evaluations on other agents' outputs. Measures accuracy, safety, completeness, and other metrics. Used in CI/CD pipelines.

---

## Agent Configuration

Agents are configured via `AgentConfig`:

```typescript
interface AgentConfig {
  id: AgentId;
  status: AgentStatus;
  metadata: AgentMetadata;
  capabilities: AgentCapabilities;
  dependencies: AgentDependency[];
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

Example `preflight.json`:

```json
{
  "agent": {
    "name": "research-assistant",
    "version": "1.0.0",
    "description": "Multi-source research agent",
    "capabilities": {
      "modelFamilies": ["GPT4O", "CLAUDE_3_5_SONNET"],
      "maxContextLength": 128000,
      "streaming": true,
      "functionCalling": true,
      "memoryLayers": ["WORKING", "SESSION", "LONG_TERM"],
      "custom": ["web-search", "document-analysis"]
    },
    "maxConcurrency": 5,
    "timeout": 120000,
    "retryPolicy": {
      "maxRetries": 3,
      "baseDelay": 1000,
      "maxDelay": 30000,
      "backoffFactor": 2
    }
  }
}
```

---

## Agent Communication Patterns

### Direct Addressing
Messages are sent to a specific agent by ID. The router matches the `target` field in the message header.

```
Agent A ──[TASK_DELEGATE]──► Agent B
```

### Broadcast
Messages with no target are delivered to all agents matching routing rules.

```
Agent A ──[EVENT_PUBLISH]──► All Subscribers
```

### Request-Reply
A sender sends a message with a `correlationId` and waits for a correlated response. Used by `sendAndWait` in the `MessageRouter`.

```
Agent A ──[TASK_DELEGATE(id=123)]──► Agent B
Agent A ◄──[TASK_RESPONSE(corr=123)]── Agent B
```

### Publish-Subscribe
Agents subscribe to event types. Publishers emit events to the `EventBus`, which fans out to all matching subscribers.

```
Agent A ──[EVENT_PUBLISH(event="task.completed")]──► EventBus
EventBus ──[fan-out]──► Agent B (subscribed)
                     ──► Agent C (subscribed)
```

### Streaming
Long-running responses are delivered as a sequence of chunks over a stream channel.

```
Provider ──[STREAM_INIT]──► Agent
Provider ──[STREAM_CHUNK(seq=1)]──► Agent
Provider ──[STREAM_CHUNK(seq=2)]──► Agent
Provider ──[STREAM_COMPLETE]──► Agent
```

---

## Memory Architecture Per Agent

Each agent has access to a layered memory system managed by `MemoryManager`:

```
                    ┌──────────────────────┐
                    │    MemoryManager      │
                    │  (Auto-Routing Layer)  │
                    └──────────┬───────────┘
                               │
         ┌─────────────────────┼─────────────────────┐
         │          │          │          │          │
         ▼          ▼          ▼          ▼          ▼
   ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌──────────┐
   │ WORKING │ │ SESSION │ │LONG-TERM│ │ SEMANTIC │ │KNOWLEDGE │
   │  (vol.) │ │  (TTL)  │ │(persist)│ │(vectors) │ │  GRAPH   │
   └─────────┘ └─────────┘ └─────────┘ └─────────┘ └──────────┘
```

| Layer | Scope | TTL | Use Case |
|---|---|---|---|
| `WORKING` | In-memory | Minutes | Current task context, scratch data |
| `SESSION` | Per-session | Hours | Conversation history, session state |
| `LONG_TERM` | Persistent | Indefinite | Learned preferences, aggregated knowledge |
| `SEMANTIC` | Embedding-based | Indefinite | Similarity search, RAG |
| `KNOWLEDGE_GRAPH` | Entity-relation | Indefinite | Structured relationships, facts |

### Memory Operations

```typescript
// Save to the best-matching layer
await memoryManager.autoSave('user-preferences', { theme: 'dark' });

// Cross-layer search with ranked results
const results = await memoryManager.query({
  query: 'user preferences',
  limit: 10,
});

// Direct layer access
await memoryManager.save('WORKING', 'scratchpad', data, { ttl: 300_000 });
```

---

## Security Context Per Agent

Every agent operates within a `SecurityContext` that defines its permissions and identity:

```typescript
interface SecurityContext {
  userId?: string;
  agentId?: AgentId;
  roles: Role[];
  permissions: Permission[];
  policies: PolicyDocument[];
  encryptedClaims?: string;
}
```

### Default Agent Roles

| Role | Permissions |
|---|---|
| `admin` | `*:*` — unrestricted access |
| `agent` | `task:read`, `task:write`, `memory:read`, `memory:write`, `model:read` |
| `viewer` | Read-only access to agents, tasks, memory, models |

### Isolation Model

- **Process isolation**: Each agent lifecycle runs with a dedicated `AgentLifecycle` instance
- **Memory isolation**: Memory entries are tagged with `agentId`; cross-agent access requires explicit `MemoryAccessControl`
- **Execution sandbox**: Custom tool execution can be sandboxed with `SandboxManager` (resource limits, network rules, filesystem rules)
- **Message filtering**: The `MessageRouter` applies permission checks before delivering messages
- **Rate limiting**: Per-agent rate limits prevent resource starvation

### Sandbox Configuration

```typescript
const sandbox = new SandboxManager({
  mode: 'restricted',
  limits: {
    cpuMs: 10_000,
    memoryBytes: 512 * 1024 * 1024,
    maxChildProcesses: 0,
  },
  networkEnabled: false,
  filesystemWritesEnabled: false,
});
```

The `SandboxManager.checkExecution()` method validates every execution against configured policies before allowing it to proceed.
