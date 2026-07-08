# Model Routing Concepts

---

## Intelligent Model Routing

The model router selects the optimal LLM provider and model for each request based on capability requirements, cost constraints, latency targets, and provider availability.

```
                        ┌──────────────────┐
                        │   Task Request    │
                        │  (capabilities,   │
                        │   budget, latency)│
                        └────────┬─────────┘
                                 │
                    ┌────────────▼────────────┐
                    │      Model Router        │
                    │                          │
                    │  ┌────────────────────┐  │
                    │  │ Selection Strategy  │  │
                    │  │ (capability_match,  │  │
                    │  │  lowest_cost,       │  │
                    │  │  fastest, round_    │  │
                    │  │  robin, manual)     │  │
                    │  └────────────────────┘  │
                    │                          │
                    │  ┌────────────────────┐  │
                    │  │   Route Table       │  │
                    │  │  (weighted routes,  │  │
                    │  │   fallback chains)  │  │
                    │  └────────────────────┘  │
                    └────────┬─────────────────┘
                             │
              ┌──────────────┼──────────────┐
              │              │              │
              ▼              ▼              ▼
        ┌──────────┐  ┌──────────┐  ┌──────────┐
        │ OpenAI   │  │ Anthropic│  │ Google   │
        │ GPT-4o   │  │ Claude 3 │  │ Gemini   │
        └──────────┘  └──────────┘  └──────────┘
```

---

## Routing Strategies

### Capability Match

Selects the model whose capabilities best match the task requirements:

```typescript
router.setStrategy('CAPABILITY_MATCH');

// Task requires: reasoning + coding + long context
// Routes evaluated:
//   GPT-4o:     reasoning, coding, vision, long context → MATCH
//   Claude 3.5: reasoning, coding, vision, long context → MATCH
//   Gemini:     reasoning, long context → PARTIAL MATCH
//   GPT-4o Mini: coding → WEAK MATCH
```

### Lowest Cost

Selects the cheapest route that meets minimum capability requirements:

```typescript
router.setStrategy('LOWEST_COST');

// Routes sorted by cost:
//   GPT-4o Mini: $0.15/M tokens → selected
//   Claude 3 Haiku: $0.25/M tokens
//   Gemini Flash: $0.35/M tokens
//   GPT-4o: $2.50/M tokens
```

### Fastest

Selects the route with the lowest historical latency:

```typescript
router.setStrategy('FASTEST');

// Routes sorted by p50 latency:
//   Groq Llama: 200ms → selected
//   GPT-4o Mini: 400ms
//   Claude 3 Haiku: 600ms
//   Gemini Flash: 800ms
```

### Round Robin

Distributes requests evenly across all eligible routes for load balancing:

```typescript
router.setStrategy('ROUND_ROBIN');

// Request 1 → OpenAI GPT-4o
// Request 2 → Anthropic Claude 3
// Request 3 → Google Gemini
// Request 4 → OpenAI GPT-4o (cycle repeats)
```

### Manual

Explicit route selection by the caller:

```typescript
router.setStrategy('MANUAL');

// Client specifies route directly
const response = await client.models.invoke({
  model: 'claude-3.5-sonnet',
  prompt: '...',
}, {
  routeId: 'anthropic-fast',
});
```

---

## Provider Abstraction

All LLM providers are abstracted behind a common `ModelConfig`:

```typescript
interface ModelConfig {
  provider: ModelProvider;   // 'OPENAI' | 'ANTHROPIC' | 'GOOGLE' | 'OLLAMA' | ...
  family: ModelFamily;       // 'GPT4O' | 'CLAUDE_3_5_SONNET' | 'GEMINI_PRO' | ...
  modelName: string;         // Provider-specific model name
  capabilities: ModelCapability[];  // reasoning, coding, vision, function_calling, etc.
  maxTokens: number;
  temperature: number;
  topP: number;
  apiKey?: string;           // Provider credential
  baseUrl?: string;          // Custom endpoint (for Ollama, proxies, etc.)
  timeout: Duration;
  retryConfig: { maxRetries: number; baseDelay: Duration };
}
```

### Route Configuration

```json
{
  "routes": [
    {
      "id": "openai-fast",
      "name": "OpenAI GPT-4o Mini",
      "model": {
        "provider": "OPENAI",
        "family": "GPT4O_MINI",
        "modelName": "gpt-4o-mini",
        "capabilities": ["CODING", "FUNCTION_CALLING", "FAST", "CHEAP"],
        "maxTokens": 16384,
        "temperature": 0.7,
        "timeout": 30000
      },
      "weight": 50,           // proportional selection weight
      "costPerToken": 0.00000015,
      "costPerRequest": 0.00015,
      "fallback": ["anthropic-fast", "google-fast"]
    },
    {
      "id": "anthropic-power",
      "name": "Anthropic Claude 3.5 Sonnet",
      "model": {
        "provider": "ANTHROPIC",
        "family": "CLAUDE_3_5_SONNET",
        "modelName": "claude-3-5-sonnet-20241022",
        "capabilities": ["REASONING", "CODING", "LONG_CONTEXT", "VISION"],
        "maxTokens": 200000,
        "temperature": 0.7,
        "timeout": 60000
      },
      "weight": 30,
      "costPerToken": 0.000003,
      "costPerRequest": 0.003,
      "fallback": ["openai-fast", "google-power"]
    }
  ]
}
```

---

## Cost Optimization

### Cost Tracking

Each route tracks per-token and per-request costs:

```typescript
interface ModelRoute {
  costPerToken: number;    // USD per token
  costPerRequest: number;  // USD per request
}
```

The router accumulates cost metrics for observability and budgeting.

### Optimization Strategies

1. **Capability-based filtering**: Expensive models are only used when their advanced capabilities are required
2. **Prompt compression**: Reduce token count before routing to lower-cost models
3. **Cache-first**: Frequently requested outputs are served from cache (configurable TTL)
4. **Batch routing**: Multiple requests to the same low-cost model are batched

```typescript
interface ModelRouterConfig {
  cacheEnabled: boolean;
  cacheTTL: Duration;          // default: 1 hour
}
```

### Budget Controls

```typescript
// Per-agent budget
await client.agents.configure('agent-42', {
  budget: {
    maxCostPerRequest: 0.01,    // $0.01 max per request
    maxCostPerHour: 1.00,       // $1.00 max per hour
    maxTokensPerDay: 1_000_000, // 1M tokens per day
  },
});
```

---

## Latency Optimization

### Strategy Selection

The router tracks per-route latency metrics:

```typescript
// Historical p50/p95/p99 latency per route
const routeStats = await router.getRouteStats();
// {
//   'openai-fast': { p50: 400, p95: 1200, p99: 3000, samples: 15000 },
//   'anthropic-power': { p50: 600, p95: 2000, p99: 5000, samples: 8000 },
// }
```

### Streaming Optimization

For streaming-capable routes, the router prefers providers with lower time-to-first-token (TTFT):

```
Route         TTFT          Tokens/sec
────────────────────────────────────────
Groq Llama    150ms          450 t/s
GPT-4o Mini   300ms          200 t/s
Claude 3      500ms          150 t/s
```

### Connection Pooling

The provider layer maintains persistent connections and connection pools to minimize handshake overhead.

---

## Failover and Fallback

### Route-Level Fallback

Each route can specify a fallback chain:

```typescript
{
  id: "primary-route",
  model: { provider: "OPENAI" },
  fallback: [
    "secondary-route",     // First fallback
    "tertiary-route",      // Second fallback
  ],
}
```

### Health-Based Routing

The router monitors provider health and automatically bypasses degraded providers:

```typescript
// When OpenAI returns 5xx errors for 30 seconds:
// Router marks route degraded, uses fallback
// Periodic health checks restore when provider recovers
```

### Graceful Degradation

```typescript
router.onDegraded((route, reason) => {
  console.warn(`Route ${route.id} degraded: ${reason}`);
  // Optionally trigger alerts
});
```

### Circuit Breaker

The router implements circuit breaker pattern for providers with elevated error rates:

| State | Behavior |
|---|---|
| **CLOSED** | Normal operation |
| **OPEN** | Requests immediately fail (or use fallback) after threshold exceeded |
| **HALF_OPEN** | Probe requests allowed; if successful, reset to CLOSED |

### Rate Limit Management

The `RateLimiter` handles provider rate limits with:

- **Token bucket** algorithm for smooth rate enforcement
- **Queue-and-retry** with exponential backoff when limits are hit
- **Adaptive rate limiting** that adjusts to provider responses
- **Per-provider** and **per-API-key** rate limit tracking

```typescript
const limiter = new RateLimiter({
  algorithm: 'TOKEN_BUCKET',
  maxRequests: 500,       // 500 requests
  windowMs: 60_000,       // per 60 seconds
  burstAllowed: 50,       // allow bursts of 50 over the limit
});
```
