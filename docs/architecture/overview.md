# System Architecture

Agent Preflight is an enterprise-grade AI Agent Operating System that orchestrates, secures, and manages autonomous AI agents across distributed environments. It provides a unified runtime for agent lifecycle management, inter-agent communication, memory systems, security controls, and model routing.

---

## High-Level Architecture

The system follows a layered architecture with four primary planes:

```
    ┌─────────────────────────────────────────────────────────────┐
    │                        CONTROL PLANE                        │
    │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌────────────┐  │
    │  │ Runtime  │  │  Agent   │  │  Task    │  │  Workflow  │  │
    │  │ Manager  │  │ Registry │  │ Executor │  │ Orchestr.  │  │
    │  └──────────┘  └──────────┘  └──────────┘  └────────────┘  │
    └─────────────────────────────────────────────────────────────┘
                               │
    ┌─────────────────────────────────────────────────────────────┐
    │                    COMMUNICATION PLANE                       │
    │  ┌──────────────┐  ┌──────────┐  ┌──────────┐  ┌────────┐  │
    │  │    ACP       │  │  Event   │  │  Stream  │  │  Msg   │  │
    │  │  Protocol    │  │   Bus    │  │ Manager  │  │ Router │  │
    │  └──────────────┘  └──────────┘  └──────────┘  └────────┘  │
    └─────────────────────────────────────────────────────────────┘
                               │
    ┌─────────────────────────────────────────────────────────────┐
    │                       DATA PLANE                             │
    │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌────────────┐  │
    │  │ Working  │  │ Session  │  │Long-Term │  │  Vector /  │  │
    │  │ Memory   │  │ Memory   │  │ Memory   │  │ Knowledge  │  │
    │  └──────────┘  └──────────┘  └──────────┘  └────────────┘  │
    └─────────────────────────────────────────────────────────────┘
                               │
    ┌─────────────────────────────────────────────────────────────┐
    │                     SECURITY PLANE                           │
    │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌────────────┐  │
    │  │   Auth   │  │ RBAC/    │  │ Sandbox  │  │  Audit /   │  │
    │  │          │  │ ABAC     │  │          │  │ Encryption │  │
    │  └──────────┘  └──────────┘  └──────────┘  └────────────┘  │
    └─────────────────────────────────────────────────────────────┘
```

### Control Plane
Orchestrates agent lifecycles, task scheduling, workflow execution, and health monitoring. The `RuntimeManager` is the central coordinator, managing agent registration, task dispatching, and system health.

### Communication Plane
Implements the Agent Communication Protocol (ACP) for message passing, event pub/sub, streaming, and routing between agents. Supports WebSocket, HTTP, and in-memory transport bindings.

### Data Plane
Provides a multi-layer memory architecture including working memory, session memory, long-term storage, semantic search, vector indexes, and knowledge graphs.

### Security Plane
Delivers authentication, authorization (RBAC/ABAC), policy enforcement, sandboxed execution, encryption, audit logging, and threat detection.

---

## System Context Diagram

```
                         ┌─────────────────────┐
                         │   External LLM API   │
                         │  (OpenAI, Anthropic, │
                         │   Google, etc.)      │
                         └──────────┬──────────┘
                                    │
                         ┌──────────▼──────────┐
                         │    Model Router      │
                         │  (Provider Abstraction)│
                         └──────────┬──────────┘
                                    │
    ┌──────────┐           ┌──────────▼──────────┐          ┌──────────┐
    │  User /  │◄─────────►│   Agent Preflight    │◄────────►│  DevOps  │
    │  Client  │   REST/WS  │       System         │  K8s/Docker│  Tools   │
    └──────────┘           └──────────┬──────────┘          └──────────┘
                                      │
                         ┌────────────▼────────────┐
                         │   External Integrations  │
                         │   (Databases, Queues,    │
                         │    Monitoring, Secrets)  │
                         └─────────────────────────┘
```

---

## Core Components

| Component | Package | Responsibility |
|---|---|---|
| `RuntimeManager` | `@agent-preflight/runtime` | Initialization, lifecycle coordination, health checks |
| `AgentContainer` | `@agent-preflight/runtime` | Agent instance pool, resource tracking |
| `TaskExecutor` | `@agent-preflight/runtime` | Task execution with retry, timeout, resource tracking |
| `AgentLifecycle` | `@agent-preflight/runtime` | State machine (STOPPED→STARTING→RUNNING→...) |
| `MessageRouter` | `@agent-preflight/protocol` | Route messages by pattern, priority queuing |
| `StreamManager` | `@agent-preflight/protocol` | Streaming data with chunked delivery |
| `EventBus` | `@agent-preflight/protocol` | Pub/sub event distribution |
| `MemoryManager` | `@agent-preflight/memory` | Multi-layer memory orchestration |
| `RBACManager` | `@agent-preflight/security` | Role-based access control |
| `ABACEngine` | `@agent-preflight/security` | Attribute-based access control |
| `PolicyEngine` | `@agent-preflight/security` | Policy evaluation and enforcement |
| `Authenticator` | `@agent-preflight/security` | Auth (API keys, JWT, OAuth, sessions) |
| `EncryptionService` | `@agent-preflight/security` | Encryption at rest and in transit |
| `AuditLogger` | `@agent-preflight/security` | Immutable audit trail |
| `InjectionDetector` | `@agent-preflight/security` | Prompt injection detection |
| `SandboxManager` | `@agent-preflight/security` | Execution sandboxing |
| `RateLimiter` | `@agent-preflight/security` | Rate limiting (token bucket, sliding window) |

---

## Data Flow Patterns

### Task Execution Flow

```
Client → RuntimeManager → AgentContainer → TaskExecutor → AgentLifecycle → LLM Provider
                                          │
                                    ┌─────▼──────┐
                                    │  Memory     │
                                    │  Manager    │
                                    └─────┬──────┘
                                          │
                                    ┌─────▼──────┐
                                    │  Security   │
                                    │  Plane      │
                                    └────────────┘
```

1. Client submits a task via CLI or SDK
2. `RuntimeManager` validates and queues the task
3. `AgentContainer` selects the best-fit agent instance
4. `TaskExecutor` runs the task with retry and timeout logic
5. Agent execution queries memory and security layers as needed
6. Result flows back through the chain

### Inter-Agent Communication Flow

```
Agent A → ACP Protocol → Transport (WS/HTTP/InMem) → MessageRouter → Agent B
           │                                                    │
           ▼                                                    ▼
      EventBus                                              StreamManager
```

1. Agent A constructs an ACP message with header and payload
2. Transport layer serializes and sends via the configured binding
3. `MessageRouter` matches routing rules and delivers to target
4. Agent B receives and processes the message
5. Response is correlated via `correlationId`

---

## Deployment Models

### Local Development

```
┌─────────────────────────────────┐
│         Local Machine            │
│  ┌──────────┐  ┌──────────────┐  │
│  │  CLI      │  │  Runtime     │  │
│  │  (prefl.) │  │  (in-process)│  │
│  └──────────┘  └──────────────┘  │
└─────────────────────────────────┘
```

Ideal for development and testing. Runs entirely in-process with in-memory transport and storage.

### Docker

```
┌─────────────────────────────────────────────┐
│              Docker Host                      │
│  ┌────────────┐  ┌────────────┐             │
│  │  preflight │  │  preflight │  ...         │
│  │  agent:1   │  │  agent:2   │             │
│  └────────────┘  └────────────┘             │
│  ┌──────────────────────────────────────┐   │
│  │  shared-memory / redis / postgres    │   │
│  └──────────────────────────────────────┘   │
└─────────────────────────────────────────────┘
```

### Kubernetes

```
┌──────────────────────────────────────────────┐
│            Kubernetes Cluster                  │
│                                                │
│  ┌─────────────┐   ┌──────────────────────┐  │
│  │  preflight-  │   │  Agent Preflight     │  │
│  │  operator    │   │  API / Controller    │  │
│  └─────────────┘   └──────────────────────┘  │
│                                                │
│  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐  │
│  │Agent 1 │ │Agent 2 │ │Agent 3 │ │  ...   │  │
│  │(Pod)   │ │(Pod)   │ │(Pod)   │ │(Pod)   │  │
│  └────────┘ └────────┘ └────────┘ └────────┘  │
│                                                │
│  ┌──────────────────────────────────────────┐  │
│  │  ConfigMap │ Secrets │ PVC │ HPA │ SVC   │  │
│  └──────────────────────────────────────────┘  │
└──────────────────────────────────────────────────┘
```

### Cloud (AWS / GCP / Azure)

- **AWS**: ECS Fargate or EKS for orchestration, ElastiCache for memory, DynamoDB/Aurora for state
- **GCP**: Cloud Run or GKE, Memorystore, Cloud SQL, Pub/Sub for event bus
- **Azure**: Container Instances or AKS, Redis Cache, Cosmos DB

### Serverless

```
┌────────────────────────────────────────┐
│         Serverless Platform             │
│                                         │
│  API Gateway → Lambda → Agent Runtime  │
│       │                                 │
│       ▼                                 │
│  DynamoDB / S3 / ElastiCache            │
│                                         │
│  CloudWatch / X-Ray for observability   │
└────────────────────────────────────────┘
```

Best for event-driven workloads with variable traffic patterns. Agents are invoked on-demand via HTTP triggers, queues, or event subscriptions.

### Edge

```
┌──────────────────────────────────────────┐
│          Edge Network (Cloudflare,       │
│          Fastly, Fly.io)                  │
│                                           │
│  Edge Worker → Lightweight Agent Runtime │
│       │                                   │
│       ▼                                   │
│  Edge KV / Durable Objects / D1           │
└──────────────────────────────────────────┘
```

Suitable for low-latency, geographically distributed agent deployments.

---

## Package Architecture

```
@agent-preflight/types          — Core type definitions (no deps)
@agent-preflight/utils          — Shared utilities
@agent-preflight/protocol       — ACP implementation
@agent-preflight/security       — Security and compliance
@agent-preflight/memory         — Multi-layer memory system
@agent-preflight/runtime        — Agent lifecycle and task execution
@agent-preflight/providers      — LLM provider abstraction
@agent-preflight/config         — Configuration management
@agent-preflight/observability  — Telemetry, metrics, tracing
@agent-preflight/evaluation     — Evaluation framework
@agent-preflight/cli            — Command-line interface
```

### Dependency Graph

```
                         @agent-preflight/types
                               │
                    ┌──────────┼──────────┐
                    │          │          │
              @agent-     @agent-    @agent-
              preflight   preflight  preflight
              /utils      /protocol  /security
                    │          │          │
                    └──────────┼──────────┘
                               │
                    ┌──────────┼──────────┐
                    │          │          │
              @agent-     @agent-    @agent-
              preflight   preflight  preflight
              /memory     /runtime   /providers
                    │          │
                    └──────────┼──────────┐
                               │          │
                         @agent-    @agent-
                         preflight  preflight
                         /config    /observability
                               │
                         @agent-preflight
                         /evaluation
                               │
                         @agent-preflight
                         /cli
```

---

## Design Principles

### 1. Protocol-First Communication
All inter-agent communication uses the Agent Communication Protocol (ACP) — a typed, versioned, and secure message protocol. Agents never depend on implementation details of other agents.

### 2. Defense in Depth
Security is layered: authentication, authorization (RBAC + ABAC), sandboxing, encryption (at rest and in transit), audit logging, and threat detection form multiple independent barriers.

### 3. Memory Tiering
Data is stored in the most appropriate memory layer based on access patterns, TTL, and semantic characteristics. The `MemoryManager` auto-routes queries across layers for optimal performance.

### 4. Stateless Runtime
The runtime manager and agent containers are designed to be stateless. All persistent state lives in the memory and security planes, enabling horizontal scaling without coordination.

### 5. Provider Abstraction
LLM providers are abstracted behind a common interface. The model router selects optimal providers based on cost, latency, capability, and availability — with automatic failover.

### 6. Observable by Default
Every component emits structured telemetry (traces, metrics, logs). The observability system operates with minimal overhead and configurable sampling.

### 7. Fail-Closed Security
All access is denied by default. Policies must explicitly grant permissions. The sandbox defaults to restricted mode. Encryption is enabled by default for sensitive data paths.

### 8. Evolutionary Architecture
The system is designed for incremental adoption. You can start with local in-memory operation and progressively add Docker, Kubernetes, cloud, or edge deployments without changing agent code.

---

## Key Decisions

| Decision | Rationale |
|---|---|
| TypeScript monorepo with pnpm workspaces | Type safety across the entire codebase, shared types, efficient dependency management |
| Turborepo for build orchestration | Parallel builds, caching, dependency graph awareness |
| ACP as wire protocol | Language-agnostic, versioned, extensible — agents can be implemented in any language |
| In-memory default transport | Zero-config local development; swap transports without code changes |
| ABAC + RBAC dual model | RBAC for simple role management, ABAC for fine-grained attribute-based policies |
| Priority queue message routing | Critical tasks are never starved by lower-priority traffic |
| Pull-based health checks | Each component reports health independently; no single point of failure |
