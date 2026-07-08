# Frequently Asked Questions

---

## Common Issues and Solutions

### Agent won't start

**Symptom:** `preflight dev` starts but agents are not registered.

**Causes and fixes:**

| Cause | Solution |
|---|---|
| Agent file not in `agents/` directory | Move agent files to `agents/` or configure `agentPath` in `preflight.json` |
| Missing default export | Ensure agent file has `export default agent;` |
| TypeScript compilation error | Run `npx tsc --noEmit` to check for errors |
| Port conflict | Change port with `preflight dev --port 8081` |
| Dependency not installed | Run `npm install` |

### Provider returns 401 Unauthorized

**Symptom:** API calls fail with authentication errors.

```bash
# Check if API key is set
echo $OPENAI_API_KEY

# Verify in .env file
cat .env | grep API_KEY

# Test directly
curl -H "Authorization: Bearer $OPENAI_API_KEY" https://api.openai.com/v1/models
```

**Solutions:**

- Ensure `.env` file exists and is populated (copy from `.env.example`)
- Verify the API key is active in the provider's dashboard
- Check for whitespace or quotes around the key value
- Restart the dev server after changing environment variables

### Memory not persisting between sessions

**Symptom:** Agent forgets context after restart.

**Causes:**

- Using `WORKING` memory layer (ephemeral by design)
- In-memory backend (data lost on restart)
- Missing `LONG_TERM` memory configuration

**Solution:**

```json
{
  "memory": {
    "defaultLayer": "LONG_TERM",
    "backend": "redis",      // or "postgres" for persistence
    "redis": {
      "url": "redis://localhost:6379"
    }
  }
}
```

### Messages not reaching target agent

**Symptom:** Agent A sends a message but Agent B never receives it.

**Debugging steps:**

```bash
# Check agent registration
preflight registry list

# Trace message flow
preflight trace message --follow

# Check routing rules
preflight inspect routing

# Verify agent health
preflight health
```

**Common causes:**

- Target agent is not running (`STOPPED` or `ERROR` state)
- Routing rules don't match the message type or target
- Network disconnect (for WebSocket/HTTP transports)
- Permission denied (cross-agent communication not allowed)

---

## Configuration Questions

### How do I use a custom LLM provider?

```json
{
  "runtime": {
    "provider": "custom",
    "model": "my-model",
    "baseUrl": "http://localhost:11434/v1",
    "apiKey": "not-needed"
  }
}
```

Or configure via environment variables:

```bash
export CUSTOM_PROVIDER_URL=http://localhost:11434/v1
export CUSTOM_MODEL_NAME=llama3
```

### How do I set up multiple providers with failover?

```json
{
  "modelRouter": {
    "routes": [
      {
        "id": "primary",
        "model": { "provider": "OPENAI", "modelName": "gpt-4o" },
        "weight": 80,
        "fallback": ["secondary"]
      },
      {
        "id": "secondary",
        "model": { "provider": "ANTHROPIC", "modelName": "claude-3-5-sonnet" },
        "weight": 20
      }
    ],
    "fallbackEnabled": true
  }
}
```

### Can I run agents in different languages?

Yes. The Agent Communication Protocol (ACP) is language-agnostic. Any process that can speak ACP over WebSocket or HTTP can participate as an agent in the mesh.

```bash
# Python agent example
preflight registry register python-agent \
  --endpoint http://localhost:9000/acp
```

### How do I configure logging?

```json
{
  "telemetry": {
    "logging": {
      "level": "debug",        // trace, debug, info, warn, error
      "format": "json",        // json or text
      "output": "stdout"       // stdout, file, or otlp endpoint
    }
  }
}
```

---

## Troubleshooting Guides

### High latency on first request (cold start)

**Cause:** The Node.js runtime and agent initialization happen on first request.

**Solutions:**

- Enable keep-alive: `preflight dev --keep-alive`
- Use a health check pinger to warm the instance
- In serverless, configure provisioned concurrency
- In Kubernetes, set `minReplicas` to maintain warm instances

### Out of memory errors

**Symptom:** Process crashes with heap OOM.

```bash
# Check memory usage
preflight inspect memory

# Monitor in real-time
preflight trace memory --follow
```

**Solutions:**

```json
{
  "memory": {
    "layers": {
      "WORKING": { "maxEntries": 5000, "maxSize": "50MB" },
      "SESSION": { "maxEntries": 10000, "maxSize": "200MB" }
    }
  }
}
```

- Reduce `maxEntries` for working and session memory
- Shorten TTL values
- Increase Node.js heap: `NODE_OPTIONS="--max-old-space-size=4096"`
- Add more instances to distribute load

### Rate limited by provider

**Symptom:** `429 Too Many Requests` errors.

**Solutions:**

```json
{
  "providers": {
    "openai": {
      "rateLimit": {
        "maxRequestsPerMinute": 500,
        "strategy": "queue"     // queue, fail, or distribute
      }
    }
  }
}
```

- Configure the rate limiter to queue requests
- Add multiple API keys for the same provider
- Use fallback routes to alternative providers
- Implement backoff in agent handlers

### Agents stuck in ERROR state

**Symptom:** Agent shows `ERROR` in health checks and won't recover.

```bash
# Inspect the agent
preflight inspect agent my-agent

# View recent errors
preflight trace agent my-agent --errors-only

# Force restart
preflight registry deregister my-agent
preflight registry register agents/my-agent.ts
```

**Common causes:**

- Unhandled exception in message handler
- Provider API permanently unavailable
- Memory layer full or corrupted
- Configuration validation failure

---

## Best Practices FAQ

### How should I structure my agents?

```
project/
├── agents/
│   ├── main.ts              # Primary orchestration agent
│   ├── researcher.ts         # Specialized research agent
│   ├── analyst.ts            # Data analysis agent
│   └── reporter.ts           # Report generation agent
├── workflows/
│   └── research-pipeline.ts  # Multi-agent workflow
├── tools/
│   └── custom-tools.ts       # Shared tool definitions
├── preflight.json            # Project configuration
└── .env                      # Environment variables
```

### What's the recommended memory strategy?

| Data Type | Recommended Layer | TTL |
|---|---|---|
| Current task context | WORKING | 5 minutes |
| Chat history | SESSION | 1 hour |
| User preferences | LONG_TERM | Indefinite |
| Document embeddings | SEMANTIC | Indefinite |
| Entity relationships | KNOWLEDGE_GRAPH | Indefinite |
| Secrets and credentials | ENCRYPTED | Indefinite |

### How do I secure my deployment?

See the [Security Guide](../security/index.md) for a comprehensive checklist.

Minimum recommended configuration:

- [ ] API key authentication enabled
- [ ] TLS for all network communication
- [ ] RBAC with least-privilege roles
- [ ] Prompt injection detection enabled
- [ ] Audit logging for security events
- [ ] Rate limiting configured
- [ ] Secrets stored in environment variables or secret manager

### When should I use Docker vs Kubernetes?

| Factor | Docker | Kubernetes |
|---|---|---|
| Team size | 1-5 developers | 5+ developers |
| Number of agents | < 10 | 10+ |
| Scaling needs | Manual | Auto-scaling |
| High availability | Single host | Multi-node cluster |
| Operational complexity | Low | High |
| Best for | Development, small deployments | Production, enterprise |

### How do I contribute to Agent Preflight?

See [CONTRIBUTING.md](../../CONTRIBUTING.md) for contribution guidelines. The project welcomes:

- Bug fixes and performance improvements
- New agent capabilities and tools
- Plugin contributions
- Documentation improvements
- Test coverage additions
