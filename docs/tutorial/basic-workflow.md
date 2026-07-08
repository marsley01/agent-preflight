# Basic Workflow Tutorial

This tutorial walks through creating a multi-agent workflow that processes a research request by delegating subtasks to specialized agents and aggregating their results.

---

## Prerequisites

- An initialized Agent Preflight project (see [Quick Start](../quickstart/index.md))
- Two or more agents defined in `agents/`

---

## Step 1: Define Your Agents

Create three specialized agents:

**`agents/researcher.ts`:**

```typescript
import { Agent } from '@agent-preflight/core';

export const researcher = new Agent({
  name: 'researcher',
  description: 'Gathers and summarizes information from provided sources',
  capabilities: ['web-search', 'summarization'],
});
```

**`agents/analyst.ts`:**

```typescript
import { Agent } from '@agent-preflight/core';

export const analyst = new Agent({
  name: 'analyst',
  description: 'Analyzes data and generates structured insights',
  capabilities: ['data-analysis', 'pattern-recognition'],
});
```

**`agents/reporter.ts`:**

```typescript
import { Agent } from '@agent-preflight/core';

export const reporter = new Agent({
  name: 'reporter',
  description: 'Formats findings into a polished report',
  capabilities: ['report-generation', 'formatting'],
});
```

---

## Step 2: Create the Workflow

Create `workflows/research.workflow.ts`:

```typescript
import { Workflow } from '@agent-preflight/core';

const researchWorkflow = new Workflow({
  name: 'research-pipeline',
  description: 'Multi-stage research: gather → analyze → report',

  steps: [
    {
      id: 'gather',
      name: 'Gather Information',
      agentId: 'researcher',
      input: {
        prompt: 'Research {{topic}} and provide key findings',
        context: { topic: '{{input.topic}}' },
      },
      timeout: 60_000,
    },

    {
      id: 'analyze',
      name: 'Analyze Findings',
      agentId: 'analyst',
      dependsOn: ['gather'],
      input: {
        prompt: 'Analyze these findings and identify patterns: {{steps.gather.output}}',
      },
      timeout: 30_000,
    },

    {
      id: 'report',
      name: 'Generate Report',
      agentId: 'reporter',
      dependsOn: ['analyze'],
      input: {
        prompt: 'Create a structured report from this analysis: {{steps.analyze.output}}',
      },
      timeout: 30_000,
    },
  ],

  timeout: 180_000,
});

export default researchWorkflow;
```

### Key Concepts

- **`id`** — Unique step identifier used for dependency references.
- **`agentId`** — Which agent executes this step.
- **`dependsOn`** — Array of step IDs that must complete before this step runs.
- **`input.prompt`** — The message sent to the agent. Supports template variables.
- **`{{input.*}}`** — References the workflow's input parameters.
- **`{{steps.<id>.output}}`** — References another step's output.

---

## Step 3: Register the Workflow

Add the workflow to your project configuration in `preflight.json`:

```json
{
  "workflows": {
    "research-pipeline": {
      "path": "./workflows/research.workflow.ts",
      "enabled": true
    }
  }
}
```

---

## Step 4: Run the Workflow

### Interactive REPL

```bash
preflight dev
```

In the REPL:

```
> workflow run research-pipeline {"topic": "quantum computing advancements in 2026"}
```

### CLI

```bash
preflight run workflow research-pipeline \
  --input '{"topic": "quantum computing advancements in 2026"}'
```

### SDK

```typescript
import { createClient } from '@agent-preflight/sdk';

const client = createClient({
  endpoint: 'http://localhost:8080',
  apiKey: process.env.PREFLIGHT_API_KEY,
});

const execution = await client.workflows.run('research-pipeline', {
  topic: 'quantum computing advancements in 2026',
});
```

---

## Step 5: Monitor Execution

Track workflow progress in real-time:

```bash
preflight trace workflow research-pipeline --follow
```

```
[10:00:00] Workflow "research-pipeline" started
[10:00:00] Step "gather" → agent "researcher" (RUNNING)
[10:00:45] Step "gather" → agent "researcher" (COMPLETED) — 45s
[10:00:45] Step "analyze" → agent "analyst" (RUNNING)
[10:01:15] Step "analyze" → agent "analyst" (COMPLETED) — 30s
[10:01:15] Step "report" → agent "reporter" (RUNNING)
[10:01:40] Step "report" → agent "reporter" (COMPLETED) — 25s
[10:01:40] Workflow "research-pipeline" completed — 100s
```

View step details:

```bash
preflight inspect workflow research-pipeline
```

```
Workflow: research-pipeline
──────────────────────────────────────────────────
Status:     COMPLETED
Duration:   100s
Steps:      3 completed, 0 failed, 0 skipped

Step History:
  gather    researcher    COMPLETED   45s   1.2K tokens
  analyze   analyst       COMPLETED   30s   3.4K tokens
  report    reporter      COMPLETED   25s   2.1K tokens
```

---

## Step 6: Analyze Results

Retrieve the final output:

```bash
preflight inspect workflow research-pipeline --output report
```

Access individual step results:

```bash
preflight inspect workflow research-pipeline --step gather
```

```json
{
  "stepId": "gather",
  "status": "COMPLETED",
  "duration": 45000,
  "output": {
    "text": "Key findings in quantum computing (2026):\n1. ...\n2. ...",
    "tokens": { "input": 500, "output": 1200 }
  }
}
```

---

## Workflow Template Reference

Workflow steps support these configurations:

```typescript
interface WorkflowStep {
  id: string;
  name: string;
  agentId: AgentId;
  input: TaskInput;
  dependsOn?: string[];       // Steps that must complete first
  timeout?: Duration;          // Per-step timeout (default: global)
  retryPolicy?: {
    maxRetries: number;
    baseDelay: Duration;
  };
  conditions?: {
    runIf?: string;            // Expression evaluated against context
    skipIf?: string;           // Expression evaluated against context
  };
}
```

### Conditional Steps

```typescript
{
  id: 'deep-dive',
  agentId: 'researcher',
  dependsOn: ['gather'],
  conditions: {
    runIf: 'steps.gather.output.relevance > 0.8',
  },
  input: {
    prompt: 'Perform deep research on the most promising finding',
  },
}
```

### Parallel Execution

Steps without dependency relationships execute in parallel:

```typescript
{
  steps: [
    { id: 'a', agentId: 'agent-a', dependsOn: [] },     // runs immediately
    { id: 'b', agentId: 'agent-b', dependsOn: [] },     // runs in parallel with a
    { id: 'c', agentId: 'agent-c', dependsOn: ['a', 'b'] },  // waits for a and b
  ],
}
```
