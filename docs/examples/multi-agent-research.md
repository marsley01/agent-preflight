# Example: Multi-Agent Research Workflow

This example demonstrates a coordinated research pipeline where specialized agents collaborate to produce comprehensive research reports.

---

## Overview

Three specialized agents work together:

1. **Researcher** — Gathers and summarizes information from multiple sources
2. **Analyst** — Identifies patterns, trends, and insights
3. **Reporter** — Synthesizes findings into a structured report

```
User Request
     │
     ▼
┌──────────┐
│Research  │ ──► Source A
│ Agent    │ ──► Source B
│          │ ──► Source C
└────┬─────┘
     │ key findings
     ▼
┌──────────┐
│ Analyst  │ ──► Pattern identification
│ Agent    │ ──► Insight generation
│          │ ──► Confidence scoring
└────┬─────┘
     │ analysis
     ▼
┌──────────┐
│ Reporter │ ──► Structured report
│ Agent    │ ──► Executive summary
│          │ ──► Citation formatting
└────┬─────┘
     │ final report
     ▼
   Output
```

---

## Agent Definitions

### Researcher Agent

```typescript
// agents/researcher.ts
import { Agent } from '@agent-preflight/core';

export const researcher = new Agent({
  name: 'researcher',
  description: 'Multi-source research agent',
  capabilities: {
    custom: ['web-search', 'document-analysis', 'fact-extraction'],
  },
});

researcher.registerTool('search-web', async (query: string) => {
  // Web search implementation
  return [{ title: '...', snippet: '...', url: '...' }];
});

researcher.registerTool('extract-key-points', async (text: string) => {
  // Key point extraction logic
  return { points: [], summary: '' };
});

researcher.on('message', async (ctx) => {
  const { topic, depth = 3 } = ctx.payload;

  // Phase 1: Gather sources
  const sources = [];
  for (let i = 0; i < depth; i++) {
    const results = await ctx.callTool('search-web', `${topic} ${'detailed '.repeat(i)}`);
    sources.push(...results);
  }

  // Phase 2: Extract key findings
  const findings = [];
  for (const source of sources.slice(0, 10)) {
    const extracted = await ctx.callTool('extract-key-points', source.snippet);
    findings.push({ source: source.url, ...extracted });
  }

  await ctx.reply({
    topic,
    sourcesConsulted: sources.length,
    findings,
    summary: `Researched ${topic} across ${sources.length} sources`,
    researchTimestamp: new Date().toISOString(),
  });
});
```

### Analyst Agent

```typescript
// agents/analyst.ts
import { Agent } from '@agent-preflight/core';

export const analyst = new Agent({
  name: 'analyst',
  description: 'Research analyst for pattern identification',
});

analyst.on('message', async (ctx) => {
  const { findings, topic } = ctx.payload;

  const analysis = {
    topic,
    patterns: [
      {
        pattern: 'Emerging Trend',
        confidence: 0.85,
        evidence: ['...', '...'],
      },
    ],
    insights: [
      {
        insight: 'Key insight about the topic',
        impact: 'high',
        supportingData: ['...'],
      },
    ],
    crossReferences: [],
    confidence: 0.78,
    methodology: 'Pattern matching across sources',
  };

  await ctx.reply(analysis);
});
```

### Reporter Agent

```typescript
// agents/reporter.ts
import { Agent } from '@agent-preflight/core';

export const reporter = new Agent({
  name: 'reporter',
  description: 'Research report generator',
});

reporter.on('message', async (ctx) => {
  const { topic, analysis, summary } = ctx.payload;

  const report = {
    title: `Research Report: ${topic}`,
    generatedAt: new Date().toISOString(),
    executiveSummary: summary,
    methodology: analysis.methodology,
    keyFindings: analysis.insights.map((i: { insight: string }) => i.insight),
    detailedAnalysis: analysis.patterns,
    conclusions: [],
    confidenceScore: analysis.confidence,
    limitations: [],
    nextSteps: [],
    references: [],
  };

  await ctx.reply(report);
});
```

---

## Workflow Definition

```typescript
// workflows/research.workflow.ts
import { Workflow } from '@agent-preflight/core';

const researchWorkflow = new Workflow({
  name: 'deep-research',
  description: 'Multi-agent deep research pipeline',
  timeout: 300_000, // 5 minutes

  steps: [
    {
      id: 'gather',
      agentId: 'researcher',
      input: {
        topic: '{{input.topic}}',
        depth: '{{input.depth}}',
      },
      timeout: 120_000,
    },
    {
      id: 'analyze',
      agentId: 'analyst',
      dependsOn: ['gather'],
      input: {
        topic: '{{input.topic}}',
        findings: '{{steps.gather.output.findings}}',
      },
      timeout: 60_000,
    },
    {
      id: 'report',
      agentId: 'reporter',
      dependsOn: ['analyze'],
      input: {
        topic: '{{input.topic}}',
        analysis: '{{steps.analyze.output}}',
        summary: '{{steps.gather.output.summary}}',
      },
      timeout: 60_000,
    },
  ],
});

export default researchWorkflow;
```

---

## Usage

```bash
# Run the research workflow
preflight run workflow deep-research \
  --input '{"topic": "quantum computing breakthroughs 2026", "depth": 3}'

# Monitor progress
preflight trace workflow --follow

# Get the final report
preflight inspect workflow --last
```

### Output

```json
{
  "title": "Research Report: Quantum computing breakthroughs 2026",
  "executiveSummary": "Researched quantum computing across 24 sources",
  "keyFindings": [
    "Error correction milestones achieved",
    "New qubit stability record set",
    "Commercial quantum advantage demonstrated"
  ],
  "confidenceScore": 0.82,
  "sourcesConsulted": 24,
  "duration": 145000
}
```

---

## Key Concepts Demonstrated

| Concept | Implementation |
|---|---|
| **Tool registration** | `registerTool()` on the researcher agent for search and extraction |
| **Cross-agent data flow** | `dependsOn` in workflow steps; `{{steps.<id>.output}}` references |
| **Specialized capabilities** | Each agent has a focused role with custom capabilities |
| **Structured output** | Agents return typed objects, not raw text |
| **Timeouts** | Per-step timeouts prevent one slow step from blocking the workflow |
