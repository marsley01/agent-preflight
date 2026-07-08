# Create Your First Agent

This guide walks through creating, configuring, registering, and running your first agent step by step.

---

## Step 1: Initialize a Project

If you haven't already, create a new project:

```bash
preflight init my-first-agent
cd my-first-agent
```

This generates:

```
my-first-agent/
├── agents/
│   └── main.ts          # Agent source file
├── preflight.json        # Configuration
├── package.json
├── .env.example
└── .gitignore
```

---

## Step 2: Understand the Agent Template

Open `agents/main.ts`. The generated template looks like this:

```typescript
import { Agent } from '@agent-preflight/core';

const agent = new Agent({
  name: 'main',
  description: 'Main agent for my-first-agent',
});

agent.on('message', async (ctx) => {
  await ctx.reply(`Hello from ${agent.name}! How can I assist you?`);
});

export default agent;
```

### Key Concepts

- **`Agent`** — The base class from `@agent-preflight/core`. Every agent is an instance of this class or a subclass.
- **`name`** — A unique identifier for the agent within the project.
- **`agent.on('message', handler)`** — Registers a message handler. The handler receives a `Context` object.
- **`ctx.reply()`** — Sends a response back to the caller.
- **`export default agent`** — Makes the agent discoverable by the runtime.

---

## Step 3: Customize Your Agent

Let's create an agent that processes user queries with context awareness:

```typescript
import { Agent } from '@agent-preflight/core';

const agent = new Agent({
  name: 'assistant',
  description: 'A helpful assistant with context awareness',
});

agent.on('message', async (ctx) => {
  const { message, context } = ctx.payload;

  // Access memory
  const history = await ctx.memory.query({
    layer: 'SESSION',
    query: 'conversation-history',
    limit: 10,
  });

  // Simulate processing
  const response = await processMessage(message, history);

  // Store to memory
  await ctx.memory.save('SESSION', `msg-${Date.now()}`, {
    role: 'user',
    content: message,
  });

  await ctx.reply(response);
});

async function processMessage(message: string, context: unknown): Promise<string> {
  return `You said: "${message}". I have context from ${JSON.stringify(context).length} bytes of history.`;
}

export default agent;
```

---

## Step 4: Configure the Agent

Edit `preflight.json` to configure runtime behavior:

```json
{
  "version": "0.1.0",
  "agent": {
    "name": "assistant",
    "version": "0.1.0",
    "description": "Context-aware assistant agent"
  },
  "runtime": {
    "provider": "openai",
    "model": "gpt-4o",
    "temperature": 0.7,
    "maxTokens": 4096,
    "timeout": 60000,
    "maxConcurrency": 5
  },
  "memory": {
    "defaultLayer": "SESSION",
    "encryptionEnabled": true
  },
  "telemetry": {
    "enabled": true,
    "level": "info"
  }
}
```

---

## Step 5: Register the Agent

Start the development runtime, which automatically discovers and registers agents:

```bash
preflight dev
```

You should see output similar to:

```
[preflight] Runtime initializing...
[preflight] Agent "assistant" registered (capabilities: 8)
[preflight] Runtime ready on port 8080
[preflight] Waiting for messages...
```

To manually register an agent without the dev server:

```bash
preflight registry register agents/assistant.ts
```

List registered agents:

```bash
preflight registry list
```

```
Agent ID       Name        Status    Capabilities
─────────────────────────────────────────────────
assistant      assistant   RUNNING   8
```

---

## Step 6: Test the Agent

### Using the CLI

```bash
preflight run agent assistant --message "Hello, world!"
```

### Using the SDK

```typescript
import { createClient } from '@agent-preflight/sdk';

const client = createClient({
  endpoint: 'http://localhost:8080',
  apiKey: process.env.PREFLIGHT_API_KEY,
});

const response = await client.agents.send('assistant', {
  message: 'Hello, world!',
});

console.log(response.data);
```

### Using curl

```bash
curl -X POST http://localhost:8080/api/agents/assistant/message \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $PREFLIGHT_API_KEY" \
  -d '{"message": "Hello, world!"}'
```

---

## Step 7: View Agent Logs and Metrics

### Logs

```bash
preflight trace agent assistant --follow
```

```
2026-07-08T10:00:00.000Z INFO  [assistant] Message received
2026-07-08T10:00:00.001Z INFO  [assistant] Processing message (length: 13)
2026-07-08T10:00:00.050Z INFO  [assistant] Memory query returned 5 entries
2026-07-08T10:00:00.100Z INFO  [assistant] Reply sent (duration: 100ms)
```

### Metrics

```bash
preflight inspect agent assistant
```

```
Agent: assistant
─────────────────────────────────────────
Status:            RUNNING
Uptime:            5m 32s
Messages handled:  47
Avg latency:       45ms
Memory usage:      12.3 MB
Tokens consumed:   12,450 input / 3,200 output

Capabilities:
  modelFamilies:     GPT4O, CLAUDE_3_5_SONNET
  maxContextLength:  128000
  streaming:         true
  functionCalling:   true
  memoryLayers:      WORKING, SESSION, LONG_TERM
```

### Health Check

```bash
preflight health
```

```
Component              Status   Latency
─────────────────────────────────────────
runtime.manager        HEALTHY   0ms
runtime.container      HEALTHY   0ms
agent:assistant        HEALTHY   2ms
```

---

## Troubleshooting

| Symptom | Likely Cause | Solution |
|---|---|---|
| `Agent not registered` | Runtime not started | Run `preflight dev` first |
| `Provider API key not configured` | Missing `.env` | Copy `.env.example` to `.env` and add your key |
| `Message handler timeout` | Handler too slow | Increase `timeout` in `preflight.json` |
| `Agent shows ERROR state` | Uncaught exception | Check logs with `preflight trace agent <name>` |
| `Cannot find module` | Dependencies not installed | Run `npm install` |
