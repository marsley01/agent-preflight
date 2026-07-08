# Example: Customer Support Agent System

This example demonstrates a customer support system with ticket triage, knowledge base lookup, escalation routing, and response generation.

---

## Overview

A multi-agent customer support system with four specialized agents:

1. **Triage Agent** — Classifies incoming tickets and determines priority
2. **Knowledge Agent** — Searches knowledge base for relevant solutions
3. **Response Agent** — Generates personalized customer responses
4. **Escalation Agent** — Routes complex issues to human agents

```
Customer Ticket
     │
     ▼
┌──────────────┐
│   Triage     │ ──► Classify issue
│   Agent      │ ──► Set priority
└──────┬───────┘    ──► Route to appropriate path
       │
       ├──────────────────────────┐
       │                          │
       ▼                          ▼
┌──────────────┐          ┌──────────────┐
│  Knowledge   │          │  Escalation  │
│  Agent       │          │  Agent       │
│  (KB search) │          │  (human      │
└──────┬───────┘          │   handoff)   │
       │                  └──────────────┘
       ▼
┌──────────────┐
│  Response    │
│  Agent       │ ──► Customer reply
└──────────────┘
```

---

## Agent Definitions

### Triage Agent

```typescript
// agents/triage.ts
import { Agent } from '@agent-preflight/core';

const SUPPORT_CATEGORIES = [
  { pattern: /login|password|auth|mfa|2fa/i, category: 'authentication', priority: 'high' },
  { pattern: /payment|billing|invoice|refund|charge/i, category: 'billing', priority: 'high' },
  { pattern: /bug|error|crash|broken|not working/i, category: 'technical', priority: 'medium' },
  { pattern: /feature|request|suggestion|idea/i, category: 'feature-request', priority: 'low' },
  { pattern: /how to|guide|tutorial|documentation/i, category: 'how-to', priority: 'low' },
];

export const triageAgent = new Agent({
  name: 'triage',
  description: 'Classifies and prioritizes support tickets',
});

triageAgent.on('message', async (ctx) => {
  const { subject, message, customerId, ticketId } = ctx.payload;
  const fullText = `${subject} ${message}`;

  const matches = SUPPORT_CATEGORIES
    .filter(({ pattern }) => pattern.test(fullText))
    .map(({ category, priority }) => ({ category, priority }));

  const primary = matches[0] ?? { category: 'general', priority: 'medium' };

  await ctx.reply({
    ticketId,
    customerId,
    category: primary.category,
    priority: primary.priority,
    requiresEscalation: primary.category === 'billing' || primary.priority === 'high',
    sentiment: 'neutral',
    suggestedTeam: primary.category,
    originalRequest: { subject, message },
  });
});
```

### Knowledge Agent

```typescript
// agents/knowledge.ts
import { Agent } from '@agent-preflight/core';

export const knowledgeAgent = new Agent({
  name: 'knowledge',
  description: 'Searches knowledge base for solutions',
});

knowledgeAgent.registerTool('search-kb', async (query: string) => {
  // KB search implementation
  return [
    {
      id: 'KB-001',
      title: 'Resetting your password',
      content: 'To reset your password, visit the login page and click "Forgot Password"...',
      relevance: 0.95,
    },
  ];
});

knowledgeAgent.on('message', async (ctx) => {
  const { category, originalRequest } = ctx.payload;
  const query = `${category}: ${originalRequest.subject} ${originalRequest.message}`;

  const results = await ctx.callTool('search-kb', query);
  const topResult = results[0];

  await ctx.reply({
    query,
    foundSolution: !!topResult && topResult.relevance > 0.7,
    topResult: topResult ?? null,
    allResults: results.slice(0, 3),
    confidence: topResult?.relevance ?? 0,
  });
});
```

### Response Agent

```typescript
// agents/response.ts
import { Agent } from '@agent-preflight/core';

export const responseAgent = new Agent({
  name: 'response',
  description: 'Generates customer support responses',
});

responseAgent.on('message', async (ctx) => {
  const { ticketId, customerId, category, priority, originalRequest, kbResult } = ctx.payload;

  let response: string;

  if (kbResult?.foundSolution) {
    response = `Thank you for reaching out. Regarding your question about "${originalRequest.subject}", here's how to resolve this:\n\n${kbResult.topResult.content}\n\nIf you need further assistance, please let us know.`;
  } else {
    response = `Thank you for contacting support. We've received your ticket (${ticketId}) regarding "${originalRequest.subject}". Our team is reviewing it and will get back to you within ${priority === 'high' ? '2 hours' : '24 hours'}.`;
  }

  await ctx.reply({
    ticketId,
    customerId,
    response,
    responseType: kbResult?.foundSolution ? 'solution' : 'acknowledgment',
    requiresFollowUp: !kbResult?.foundSolution,
    sentAt: new Date().toISOString(),
  });
});
```

### Escalation Agent

```typescript
// agents/escalation.ts
import { Agent } from '@agent-preflight/core';

export const escalationAgent = new Agent({
  name: 'escalation',
  description: 'Routes complex issues to human agents',
});

escalationAgent.registerTool('notify-team', async (params: {
  channel: string;
  message: string;
  priority: string;
}) => {
  // Slack/Teams notification implementation
  console.log(`[${params.priority.toUpperCase()}] ${params.channel}: ${params.message}`);
  return { notified: true };
});

escalationAgent.on('message', async (ctx) => {
  const { ticketId, customerId, category, priority, originalRequest } = ctx.payload;

  const escalation = {
    ticketId,
    customerId,
    category,
    priority,
    assignedTeam: category,
    summary: `Ticket #${ticketId}: ${originalRequest.subject}`,
    requiresImmediateAttention: priority === 'high',
    suggestedHandler: category === 'billing' ? 'billing-team' : 'support-team',
  };

  await ctx.callTool('notify-team', {
    channel: `#support-${category}`,
    message: `Ticket #${ticketId} escalated (${priority}): ${originalRequest.subject}`,
    priority,
  });

  await ctx.reply(escalation);
});
```

---

## Workflow Definition

```typescript
// workflows/support-pipeline.ts
import { Workflow } from '@agent-preflight/core';

const supportWorkflow = new Workflow({
  name: 'customer-support',
  description: 'Automated customer support ticket processing',
  timeout: 120_000,

  steps: [
    {
      id: 'triage',
      agentId: 'triage',
      input: {
        subject: '{{input.subject}}',
        message: '{{input.message}}',
        customerId: '{{input.customerId}}',
        ticketId: '{{input.ticketId}}',
      },
      timeout: 10_000,
    },
    {
      id: 'knowledge-search',
      agentId: 'knowledge',
      dependsOn: ['triage'],
      input: {
        category: '{{steps.triage.output.category}}',
        originalRequest: '{{steps.triage.output.originalRequest}}',
      },
      timeout: 15_000,
    },
    {
      id: 'escalate-if-needed',
      agentId: 'escalation',
      dependsOn: ['triage'],
      runIf: 'steps.triage.output.requiresEscalation == true',
      input: {
        ticketId: '{{input.ticketId}}',
        customerId: '{{input.customerId}}',
        category: '{{steps.triage.output.category}}',
        priority: '{{steps.triage.output.priority}}',
        originalRequest: '{{steps.triage.output.originalRequest}}',
      },
      timeout: 10_000,
    },
    {
      id: 'generate-response',
      agentId: 'response',
      dependsOn: ['knowledge-search'],
      input: {
        ticketId: '{{input.ticketId}}',
        customerId: '{{input.customerId}}',
        category: '{{steps.triage.output.category}}',
        priority: '{{steps.triage.output.priority}}',
        originalRequest: '{{steps.triage.output.originalRequest}}',
        kbResult: '{{steps.knowledge-search.output}}',
      },
      timeout: 20_000,
    },
  ],
});

export default supportWorkflow;
```

---

## Usage

```bash
# Process a customer support ticket
preflight run workflow customer-support \
  --input '{
    "ticketId": "TKT-12345",
    "customerId": "CUST-6789",
    "subject": "Cannot log into my account",
    "message": "I keep getting an invalid password error even after reset"
  }'

# View the full workflow results
preflight inspect workflow customer-support --last
```

### SDK Integration

```typescript
import { createClient } from '@agent-preflight/sdk';

const client = createClient({
  endpoint: 'http://localhost:8080',
  apiKey: process.env.PREFLIGHT_API_KEY,
});

// Webhook handler for incoming tickets
app.post('/webhook/support-ticket', async (req, res) => {
  const { id, subject, description, customer_email } = req.body;

  const result = await client.workflows.run('customer-support', {
    ticketId: id,
    customerId: customer_email,
    subject,
    message: description,
  });

  if (result.data.status === 'COMPLETED') {
    const response = result.data.steps['generate-response'].output;
    await sendEmail(customer_email, response.response);
  }

  res.json({ received: true, ticketId: id });
});
```

### Response Example

```json
{
  "ticketId": "TKT-12345",
  "response": "Thank you for reaching out. Regarding your question about 'Cannot log into my account', here's how to resolve this:\n\nTo reset your password, visit the login page and click 'Forgot Password'...\n\nIf you need further assistance, please let us know.",
  "responseType": "solution",
  "requiresFollowUp": false,
  "sentAt": "2026-07-08T10:00:00.000Z"
}
```

---

## Key Concepts Demonstrated

| Concept | Implementation |
|---|---|
| **Conditional branching** | `escalate-if-needed` step only runs when `requiresEscalation` is true |
| **Tool calling** | Knowledge agent uses `search-kb` tool; escalation agent uses `notify-team` |
| **Parallel execution** | `knowledge-search` and `escalate-if-needed` run in parallel |
| **Data routing** | Triage output feeds knowledge search; knowledge feeds response generation |
| **External integration** | Escalation agent sends notifications via Slack/Teams channel |
| **Priority-based SLA** | Response times differ based on priority (2h vs 24h) |
