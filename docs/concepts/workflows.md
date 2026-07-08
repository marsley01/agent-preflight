# Workflow Concepts

---

## Workflow Definition

A workflow is a directed acyclic graph (DAG) of steps executed by agents. Workflows define the orchestration logic for multi-step, multi-agent processes.

```typescript
interface WorkflowDefinition {
  id: string;
  name: string;
  version: SemVer;
  description: string;
  steps: WorkflowStep[];
  timeout: Duration;         // Global workflow timeout
  tags: string[];
  metadata?: Record<string, unknown>;
}
```

### Example Workflow

```typescript
const workflow = new Workflow({
  name: 'content-pipeline',
  steps: [
    { id: 'research', agentId: 'researcher' },
    { id: 'draft', agentId: 'writer', dependsOn: ['research'] },
    { id: 'review', agentId: 'editor', dependsOn: ['draft'] },
    { id: 'publish', agentId: 'publisher', dependsOn: ['review'] },
  ],
});
```

---

## Step Types

### Task Step

The most common step. Delegates work to a single agent.

```typescript
{
  id: 'fetch-data',
  name: 'Fetch Data',
  agentId: 'data-collector',
  input: { prompt: 'Collect data for {{input.date}}' },
  timeout: 30_000,
}
```

### Decision Step

Branches workflow execution based on a condition.

```typescript
{
  id: 'check-quality',
  type: 'decision',
  conditions: [
    { if: 'steps.analyze.output.quality > 0.8', then: ['approve'] },
    { if: 'steps.analyze.output.quality > 0.5', then: ['revise'] },
    { else: ['reject'] },
  ],
}
```

### Parallel Step

Executes multiple sub-steps concurrently.

```typescript
{
  id: 'parallel-research',
  type: 'parallel',
  branches: [
    { steps: [{ id: 'source-a', agentId: 'researcher-1' }] },
    { steps: [{ id: 'source-b', agentId: 'researcher-2' }] },
    { steps: [{ id: 'source-c', agentId: 'researcher-3' }] },
  ],
  next: ['merge-findings'],
}
```

### Subworkflow Step

Nests another workflow definition as a step.

```typescript
{
  id: 'validate',
  type: 'subworkflow',
  workflow: 'validation-pipeline',
  input: { data: '{{steps.collect.output}}' },
}
```

### Condition Step

Evaluates an expression and stores the result for use by other steps.

```typescript
{
  id: 'evaluate-relevance',
  type: 'condition',
  expression: 'len(steps.search.output.results) > 0',
  outputVariable: 'hasResults',
}
```

### Loop Step

Iterates over a collection, executing child steps for each item.

```typescript
{
  id: 'process-items',
  type: 'loop',
  items: '{{steps.fetch.output.items}}',
  step: {
    id: 'process-item',
    agentId: 'item-processor',
    input: { item: '{{loop.item}}' },
  },
}
```

### Wait Step

Pauses execution for a specified duration or until a condition is met.

```typescript
{
  id: 'wait-for-approval',
  type: 'wait',
  until: '{{external.approvalReceived}}',
  timeout: 3600_000,  // 1 hour max wait
  pollingInterval: 10_000,
}
```

---

## Execution Model

### Step Dependency Resolution

The workflow engine resolves the step DAG topologically:

1. Start with all steps that have zero dependencies
2. Execute those steps (potentially in parallel)
3. When a step completes, check if its dependents now have all prerequisites satisfied
4. Execute newly-unblocked steps
5. Repeat until all steps complete or an error occurs

```
research ──► draft ──► review ──► publish
    │                    │
    └──► illustrations ──┘
```

### State Transitions

```
PENDING → QUEUED → RUNNING → COMPLETED
                      │          │
                      ▼          ▼
                   FAILED     CANCELLED
```

### Data Flow Between Steps

Step outputs are available to downstream steps via the `steps` context variable:

- `{{steps.<id>.output}}` — The full output object
- `{{steps.<id>.output.text}}` — Text output
- `{{steps.<id>.status}}` — Step execution status
- `{{steps.<id>.duration}}` — Step execution time in ms

---

## Error Handling and Retries

### Per-Step Retry Policy

```typescript
{
  id: 'unreliable-service',
  agentId: 'web-scraper',
  retryPolicy: {
    maxRetries: 3,
    baseDelay: 1_000,     // Start with 1s
    maxDelay: 30_000,     // Cap at 30s
    backoffFactor: 2,     // Exponential: 1s → 2s → 4s → 8s
  },
}
```

### Global Workflow Error Handling

```typescript
const workflow = new Workflow({
  name: 'critical-pipeline',
  onError: 'rollback',   // Options: 'fail', 'skip', 'rollback', 'notify'
  onStepFailure: {
    action: 'retry',      // 'retry', 'skip', 'abort', 'fallback'
    maxRetries: 2,
    fallbackStep: 'use-cached-data',
  },
});
```

| Error Action | Description |
|---|---|
| `fail` | Immediately fail the entire workflow (default) |
| `skip` | Mark the failed step as skipped and continue |
| `retry` | Retry with exponential backoff |
| `rollback` | Execute rollback steps in reverse order |
| `notify` | Send notification and pause workflow |

---

## Human-in-the-Loop

Workflows can pause and wait for human input:

```typescript
{
  id: 'human-approval',
  type: 'wait',
  humanInput: {
    type: 'approval',     // 'approval', 'choice', 'text'
    message: 'Review the generated content and approve for publishing',
    assignee: ['reviewer@example.com'],
    timeout: 86400_000,   // 24 hours
    notification: {
      channel: 'email',
      template: 'approval-request',
    },
  },
}
```

The workflow emits a `HUMAN_INPUT_REQUIRED` event and pauses execution until the human responds via the API or CLI.

```bash
preflight workflow approve <workflow-id> --step human-approval
preflight workflow reject <workflow-id> --step human-approval --reason "Needs revision"
```

---

## Workflow Templates

Templates provide reusable workflow patterns with parameterization:

```typescript
// templates/review-pipeline.ts
export const reviewPipelineTemplate = {
  name: 'code-review-pipeline',
  parameters: {
    repository: { type: 'string', required: true },
    prNumber: { type: 'number', required: true },
    depth: { type: 'string', enum: ['quick', 'full'], default: 'full' },
  },
  build: (params: Record<string, unknown>) => ({
    steps: [
      {
        id: 'fetch',
        agentId: 'code-fetcher',
        input: { repo: params.repository, pr: params.prNumber },
      },
      {
        id: 'analyze',
        agentId: 'code-analyst',
        dependsOn: ['fetch'],
        input: { code: '{{steps.fetch.output}}', depth: params.depth },
      },
      {
        id: 'report',
        agentId: 'reporter',
        dependsOn: ['analyze'],
        input: { analysis: '{{steps.analyze.output}}' },
      },
    ],
  }),
};
```

### Built-in Templates

| Template | Description |
|---|---|
| `blank` | Empty workflow with no steps |
| `starter` | Two-step research → report pattern |
| `multi-agent` | Three-agent coordination workflow |
| `chatbot` | Single-agent conversational flow |
| `tool-use` | Agent with tool-calling capabilities |

Templates are instantiated during `preflight init`:

```bash
preflight init my-project --template multi-agent
```
