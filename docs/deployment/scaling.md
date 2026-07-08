# Scaling Guide

---

## Horizontal Scaling

Agent Preflight is designed for horizontal scaling by running multiple stateless runtime instances behind a load balancer.

```
                     ┌──────────────┐
                     │  Load        │
                     │  Balancer    │
                     └──────┬───────┘
                            │
          ┌─────────────────┼─────────────────┐
          │                 │                 │
          ▼                 ▼                 ▼
   ┌────────────┐   ┌────────────┐   ┌────────────┐
   │ Runtime 1  │   │ Runtime 2  │   │ Runtime N  │
   │ (stateless)│   │ (stateless)│   │ (stateless)│
   └────────────┘   └────────────┘   └────────────┘
          │                 │                 │
          └─────────────────┼─────────────────┘
                            │
          ┌─────────────────┼─────────────────┐
          │                 │                 │
          ▼                 ▼                 ▼
   ┌────────────┐   ┌────────────┐   ┌────────────┐
   │  Redis     │   │ PostgreSQL │   │  Provider  │
   │  (Memory)  │   │  (State)   │   │   APIs     │
   └────────────┘   └────────────┘   └────────────┘
```

### Stateless Runtime

The runtime instances (`RuntimeManager`, `AgentContainer`, `TaskExecutor`) are designed to be stateless:

- Agent definitions are loaded from configuration or registry
- All persistent state lives in memory and database backends
- No local filesystem state required
- Instances can be started/stopped without data loss

### Auto-scaling

```yaml
# Kubernetes HPA
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: agent-preflight
spec:
  minReplicas: 3
  maxReplicas: 50
  metrics:
  - type: Pods
    pods:
      metric:
        name: agent_queue_depth
      target:
        type: AverageValue
        averageValue: 100
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
```

### Scaling Considerations

| Factor | Strategy |
|---|---|
| Task volume | Add more runtime instances |
| Memory usage | Scale memory stores (Redis Cluster, read replicas) |
| Provider rate limits | Distribute across API keys, use fallback providers |
| Network bandwidth | Use internal load balancing, co-locate agents |

---

## Vertical Scaling

Increase resources per instance for compute-intensive workloads:

### Resource Allocation

```json
{
  "runtime": {
    "maxConcurrency": 50,
    "agentTimeout": 120000
  },
  "container": {
    "maxInstances": 20,
    "defaultAgentTimeout": 60000
  }
}
```

### Kubernetes Resource Limits

```yaml
resources:
  requests:
    memory: "1Gi"
    cpu: "1"
  limits:
    memory: "4Gi"
    cpu: "4"
```

**When to scale vertically:**

- High-throughput agents processing many concurrent requests
- Agents handling large context windows (100K+ tokens)
- Memory-intensive operations (vector indexing, knowledge graph operations)

---

## Caching Strategies

### Response Caching

```json
{
  "modelRouter": {
    "cacheEnabled": true,
    "cacheTTL": 3600000,
    "cacheMaxSize": "1GB"
  }
}
```

Frequently requested model outputs are cached with configurable TTL. Cache keys include model name, input hash, and parameters.

### Memory Prefetching

The `MemoryManager` prefetches frequently accessed entries:

```json
{
  "memory": {
    "prefetchEnabled": true,
    "prefetchMaxEntries": 1000,
    "cacheWarmingEnabled": true
  }
}
```

### Distributed Cache (Redis)

```json
{
  "memory": {
    "backend": "redis",
    "redis": {
      "url": "redis://redis-cluster:6379",
      "keyPrefix": "preflight:",
      "clusterMode": true
    }
  }
}
```

### Cache Hierarchy

```
L1: In-process memory (nanosecond access, limited size)
  ↓
L2: Redis (millisecond access, cluster-scalable)
  ↓
L3: Database (tens of milliseconds, persistent)
```

---

## Database Scaling

### PostgreSQL

```json
{
  "database": {
    "url": "postgresql://user:pass@host:5432/preflight",
    "pool": {
      "min": 5,
      "max": 50,
      "acquireTimeoutMs": 10000
    },
    "replication": {
      "readers": ["pg-read-replica-1:5432", "pg-read-replica-2:5432"]
    }
  }
}
```

### Read Replicas

Route read queries to replicas and writes to primary:

```typescript
const db = createDatabase({
  primary: 'postgresql://primary:5432/preflight',
  replicas: [
    'postgresql://replica-1:5432/preflight',
    'postgresql://replica-2:5432/preflight',
  ],
  queryRouting: {
    read: 'replica',
    write: 'primary',
  },
});
```

### Connection Pooling

Use PgBouncer or similar for connection pooling in high-connection-count scenarios:

```yaml
# docker-compose
pgbouncer:
  image: edoburu/pgbouncer:latest
  environment:
    DATABASES: "* = host=postgres port=5432 user=preflight"
    POOL_MODE: transaction
    MAX_CLIENT_CONN: 500
    DEFAULT_POOL_SIZE: 50
```

---

## Provider Rate Limit Management

### Multi-Key Rotation

Distribute requests across multiple API keys for the same provider:

```json
{
  "providers": {
    "openai": {
      "apiKeys": [
        { "key": "sk-...1", "weight": 50 },
        { "key": "sk-...2", "weight": 30 },
        { "key": "sk-...3", "weight": 20 }
      ],
      "rateLimit": {
        "maxRequestsPerMinute": 10000,
        "strategy": "distribute"
      }
    }
  }
}
```

### Rate Limiter Configuration

```typescript
const limiter = new RateLimiter({
  algorithm: 'TOKEN_BUCKET',
  maxRequests: 500,
  windowMs: 60_000,
  burstAllowed: 50,
});
```

### Adaptive Rate Limiting

The rate limiter automatically adjusts based on provider responses:

- On `429 Too Many Requests`: Reduce rate, backoff
- On successful responses: Gradually increase rate
- On `5xx` errors: Circuit break, use fallback

---

## Load Balancing

### Client-Side Load Balancing

For SDK clients, distribute requests across available endpoints:

```typescript
const client = createClient({
  endpoints: [
    'https://preflight-us-east-1.example.com',
    'https://preflight-us-west-2.example.com',
    'https://preflight-eu-west-1.example.com',
  ],
  loadBalance: {
    strategy: 'LATENCY',  // 'ROUND_ROBIN' | 'LATENCY' | 'WEIGHTED'
    healthCheck: {
      interval: 10_000,
      path: '/health',
    },
  },
});
```

### Service Mesh (Kubernetes)

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: preflight-ingress
  annotations:
    nginx.ingress.kubernetes.io/load-balance: "least_conn"
spec:
  rules:
  - host: preflight.example.com
    http:
      paths:
      - path: /api
        pathType: Prefix
        backend:
          service:
            name: agent-preflight
            port:
              number: 8080
```

---

## Performance Tuning

### Thread Pool Configuration

```json
{
  "runtime": {
    "maxConcurrency": 100,
    "eventLoopLagThreshold": 50,
    "taskQueueSize": 10000
  }
}
```

### Memory Limits

Configure per-layer memory limits to prevent OOM:

```json
{
  "memory": {
    "layers": {
      "WORKING": { "maxEntries": 10000, "maxSize": "100MB" },
      "SESSION": { "maxEntries": 50000, "maxSize": "500MB", "ttl": 3600000 },
      "LONG_TERM": { "maxEntries": 500000, "maxSize": "5GB" },
      "SEMANTIC": { "maxEntries": 100000, "maxSize": "2GB" }
    }
  }
}
```

### Performance Benchmarks

| Configuration | Throughput | Latency (p50) | Latency (p99) |
|---|---|---|---|
| 1 instance, in-memory | 500 req/s | 45ms | 200ms |
| 3 instances, Redis | 1500 req/s | 55ms | 350ms |
| 10 instances, Redis + PG | 5000 req/s | 60ms | 500ms |
| 50 instances, cluster | 25000 req/s | 70ms | 800ms |

### Tuning Checklist

- [ ] Configure appropriate `maxConcurrency` for available CPU cores
- [ ] Set memory layer limits based on available RAM
- [ ] Enable response caching for repetitive queries
- [ ] Use Redis for distributed memory across instances
- [ ] Configure provider rate limiters to match subscription tier
- [ ] Set up HPA with meaningful metrics (queue depth, CPU, latency)
- [ ] Use connection pooling for database access
- [ ] Enable compression for large message payloads
- [ ] Configure log sampling in high-throughput environments
