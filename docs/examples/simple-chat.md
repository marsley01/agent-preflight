# Example: Simple Chat Agent

This example demonstrates a conversational chat agent with session memory, streaming responses, and configurable system prompts.

---

## Overview

A single-agent chatbot that maintains conversation history, supports streaming responses, and can be configured with custom system prompts.

## Agent Code

```typescript
// agents/chat.ts
import { Agent } from '@agent-preflight/core';

const chatAgent = new Agent({
  name: 'chatbot',
  description: 'Conversational AI assistant with memory',
  capabilities: {
    modelFamilies: ['GPT4O', 'CLAUDE_3_5_SONNET'],
    streaming: true,
    functionCalling: true,
    memoryLayers: ['WORKING', 'SESSION'],
    custom: ['conversation'],
  },
  systemPrompt: `You are a helpful, friendly assistant.
You respond conversationally and naturally.
You remember context from the current conversation.
Keep responses concise but complete.`,
  memory: {
    sessionTtl: 3_600_000, // 1 hour
    maxHistoryLength: 50,
  },
});

chatAgent.on('message', async (ctx) => {
  const { message, sessionId } = ctx.payload;

  // Load conversation history from session memory
  const history = await ctx.memory.query({
    layer: 'SESSION',
    key: `conversation:${sessionId}`,
  });

  // Build messages array with history
  const messages = [
    { role: 'system', content: ctx.agent.systemPrompt },
    ...(history?.messages ?? []),
    { role: 'user', content: message },
  ];

  // Generate response (streaming if client supports it)
  if (ctx.flags?.stream) {
    const stream = await ctx.llm.stream(messages);
    for await (const chunk of stream) {
      await ctx.stream(chunk);
    }
    await ctx.streamEnd();
  } else {
    const response = await ctx.llm.generate(messages);
    await ctx.reply(response);
  }

  // Save updated history to session memory
  await ctx.memory.save('SESSION', `conversation:${sessionId}`, {
    messages: [
      ...(history?.messages ?? []),
      { role: 'user', content: message },
      { role: 'assistant', content: response?.text ?? '' },
    ].slice(-50), // Keep last 50 messages
  });
});

export default chatAgent;
```

## Usage

```bash
# Start the agent
preflight dev

# Send a message
preflight run agent chatbot \
  --message "What is the capital of France?" \
  --session "session-123"

# Follow-up message (uses same session)
preflight run agent chatbot \
  --message "What about its population?" \
  --session "session-123"
```

### Streaming Response

```bash
preflight run agent chatbot \
  --message "Tell me a story" \
  --stream
```

### SDK Usage

```typescript
import { createClient } from '@agent-preflight/sdk';

const client = createClient({
  endpoint: 'http://localhost:8080',
  apiKey: process.env.PREFLIGHT_API_KEY,
});

// Non-streaming
const response = await client.agents.send('chatbot', {
  message: 'Hello!',
  sessionId: 'session-abc',
});

// Streaming
const stream = client.agents.stream('chatbot', {
  message: 'Tell me a story',
  sessionId: 'session-abc',
});

for await (const chunk of stream) {
  process.stdout.write(chunk.data);
}
```

## Configuration

```json
{
  "agent": {
    "name": "chatbot",
    "description": "Conversational AI assistant",
    "systemPrompt": "You are a helpful, friendly assistant.",
    "model": "gpt-4o",
    "temperature": 0.8,
    "maxTokens": 2048
  },
  "memory": {
    "layers": {
      "SESSION": {
        "ttl": 3600000,
        "maxEntries": 10000
      }
    }
  }
}
```
