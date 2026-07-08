# Quick Start

This guide walks you through installing Agent Preflight, creating your first agent, and running a basic workflow. You should be operational in under 5 minutes.

---

## Prerequisites

- **Node.js** 20.0.0 or later
- **pnpm** 11.10.0 or later (or npm, yarn)
- A terminal with basic command-line literacy

---

## Installation

Install the CLI globally:

```bash
npm install -g @agent-preflight/cli
# or
pnpm add -g @agent-preflight/cli
```

Verify the installation:

```bash
preflight --version
```

---

## Initialize a Project

Create a new Agent Preflight project:

```bash
preflight init my-first-agent
```

This creates a project with the following structure:

```
my-first-agent/
├── preflight.json          # Project configuration
├── package.json            # Node.js package manifest
├── agents/
│   └── main.ts             # Your first agent
├── .env.example            # Environment variable template
└── .gitignore
```

The CLI will prompt you for a project name and template. Choose `starter` for a basic multi-agent setup.

---

## Create Your First Agent

Open `agents/main.ts`:

```typescript
import { Agent } from '@agent-preflight/core';

const agent = new Agent({
  name: 'main',
  description: 'My first agent',
});

agent.on('message', async (ctx) => {
  await ctx.reply(`Hello from ${agent.name}! You said: ${ctx.payload.message}`);
});

export default agent;
```

---

## Configure Providers

Add your LLM provider API key to `.env`:

```bash
OPENAI_API_KEY=sk-...
# or
ANTHROPIC_API_KEY=sk-ant-...
```

Configure the runtime in `preflight.json`:

```json
{
  "runtime": {
    "provider": "openai",
    "model": "gpt-4o",
    "temperature": 0.7,
    "maxTokens": 4096
  }
}
```

---

## Run Your First Workflow

Start the development server:

```bash
preflight dev
```

This starts the runtime, registers your agent, and opens an interactive REPL where you can send messages.

In another terminal, send a test message:

```bash
preflight run agent main --message "Hello, world!"
```

Expected output:

```
Agent main responded: Hello from main! You said: Hello, world!
```

---

## Check System Health

```bash
preflight health
```

Output:

```
Component              Status   Latency
─────────────────────────────────────────
runtime.manager        HEALTHY   0ms
runtime.container      HEALTHY   0ms
agent:main             HEALTHY   1ms
```

---

## Next Steps

| Topic | Guide |
|---|---|
| Installation details | [Installation Guide](./installation.md) |
| Create your first agent | [First Agent Tutorial](./first-agent.md) |
| Build a multi-agent workflow | [Basic Workflow Tutorial](../tutorial/basic-workflow.md) |
| Build a custom agent | [Custom Agent Tutorial](../tutorial/custom-agent.md) |
| Agent concepts | [Agent Architecture](../architecture/agents.md) |
| Communication protocol | [ACP Protocol](../protocol/index.md) |
| Security configuration | [Security Guide](../security/index.md) |
| Deployment | [Deployment Guide](../deployment/index.md) |
