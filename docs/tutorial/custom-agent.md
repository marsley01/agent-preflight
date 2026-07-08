# Build a Custom Agent

This tutorial demonstrates extending the base Agent class to create a custom agent with specialized capabilities, tools, and deployment configuration.

---

## Step 1: Extend the Base Agent Class

Create `agents/custom-analyst.ts`:

```typescript
import { Agent, type AgentConfig } from '@agent-preflight/core';

interface AnalystConfig extends AgentConfig {
  specialization: string;
  maxSources: number;
  confidenceThreshold: number;
}

export class CustomAnalystAgent extends Agent {
  private specialization: string;
  private maxSources: number;
  private confidenceThreshold: number;

  constructor(config: AnalystConfig) {
    super(config);

    this.specialization = config.specialization;
    this.maxSources = config.maxSources ?? 5;
    this.confidenceThreshold = config.confidenceThreshold ?? 0.7;

    // Register custom capabilities
    this.registerCapability('custom-analysis', {
      name: 'specialized-analysis',
      schema: {
        type: 'object',
        properties: {
          query: { type: 'string' },
          depth: { type: 'number', minimum: 1, maximum: 5 },
        },
        required: ['query'],
      },
    });

    // Register custom tools
    this.registerTool('validate-source', async (source: string) => {
      return this.validateSource(source);
    });

    this.registerTool('cross-reference', async (findings: unknown[]) => {
      return this.crossReference(findings);
    });
  }

  // Custom initialization hook
  async onStart(): Promise<void> {
    this.logger.info(`Analyst agent initializing (specialization: ${this.specialization})`);
    await this.loadSpecializedKnowledge();
  }

  // Custom cleanup hook
  async onStop(): Promise<void> {
    this.logger.info('Analyst agent shutting down');
    await this.flushAnalysisCache();
  }

  // Message handler with domain-specific logic
  async onMessage(ctx: MessageContext): Promise<void> {
    const { query, depth = 3 } = ctx.payload;

    // Step 1: Validate inputs
    if (!query || typeof query !== 'string') {
      await ctx.replyError('Query must be a non-empty string');
      return;
    }

    // Step 2: Check cache
    const cached = await ctx.memory.get('WORKING', `analysis:${query}`);
    if (cached) {
      await ctx.reply(cached.value);
      return;
    }

    // Step 3: Perform specialized analysis
    const sources = await this.gatherSources(query, depth);
    const validated = await this.validateSources(sources);
    const analysis = await this.analyze(validated);

    // Step 4: Apply confidence threshold
    if (analysis.confidence < this.confidenceThreshold) {
      await ctx.reply({
        status: 'low_confidence',
        message: 'Analysis confidence below threshold; consider manual review',
        analysis,
        confidence: analysis.confidence,
      });
      return;
    }

    // Step 5: Cache and respond
    await ctx.memory.save('WORKING', `analysis:${query}`, analysis, {
      ttl: 300_000, // 5 minutes
    });

    await ctx.reply({
      status: 'completed',
      specialization: this.specialization,
      analysis,
      sourcesUsed: validated.length,
      confidence: analysis.confidence,
    });
  }

  // Private custom methods
  private async loadSpecializedKnowledge(): Promise<void> {
    // Load domain-specific data into memory
  }

  private async flushAnalysisCache(): Promise<void> {
    await this.memory.clear('WORKING', this.id);
  }

  private async gatherSources(query: string, depth: number): Promise<string[]> {
    return [`source-${query}-${depth}`];
  }

  private async validateSource(source: string): Promise<boolean> {
    return source.length > 0;
  }

  private async validateSources(sources: string[]): Promise<string[]> {
    const results = await Promise.all(
      sources.map(async (s) => ({
        source: s,
        valid: await this.validateSource(s),
      }))
    );
    return results.filter((r) => r.valid).map((r) => r.source);
  }

  private async crossReference(findings: unknown[]): Promise<unknown[]> {
    return findings.filter(Boolean);
  }

  private async analyze(sources: string[]): Promise<{
    findings: unknown[];
    confidence: number;
  }> {
    return {
      findings: sources.map((s) => ({ source: s, insight: `Analysis of ${s}` })),
      confidence: 0.85,
    };
  }
}
```

---

## Step 2: Implement Required Interfaces

The base `Agent` class expects implementations of these interfaces:

```typescript
// Lifecycle hooks (all optional)
interface AgentLifecycleHooks {
  onStart?(): Promise<void>;     // Called during STARTING → RUNNING transition
  onStop?(): Promise<void>;      // Called during STOPPING → STOPPED transition
  onPause?(): Promise<void>;     // Called during PAUSING → PAUSED transition
  onResume?(): Promise<void>;    // Called during PAUSED → RUNNING transition
}

// Message handler interface
interface MessageHandler {
  onMessage(ctx: MessageContext): Promise<void>;
}

// Required export pattern
export default agent;  // or export the class for instantiation by runtime
```

---

## Step 3: Register Custom Capabilities

Capabilities are declared during agent construction and shared with the agent mesh during registration:

```typescript
// In constructor:
this.registerCapability('custom-analysis', {
  name: 'specialized-analysis',
  schema: {
    type: 'object',
    properties: {
      query: { type: 'string' },
      depth: { type: 'number', minimum: 1, maximum: 5 },
    },
    required: ['query'],
  },
});

this.registerCapability('data-validation', {
  name: 'cross-reference',
  description: 'Cross-references findings across multiple sources',
});
```

Capabilities are published to the registry and can be discovered by other agents:

```bash
preflight registry capabilities custom-analysis
```

---

## Step 4: Add Custom Tools

Tools are callable functions that agents expose for execution by other agents or by the model:

```typescript
// Registration
this.registerTool('validate-source', async (source: string) => {
  return this.validateSource(source);
});

this.registerTool('cross-reference', async (findings: unknown[]) => {
  return this.crossReference(findings);
});
```

Tools are discoverable and can be invoked via ACP:

```bash
preflight run agent custom-analyst --tool validate-source --args '{"source": "example"}'
```

```typescript
// From another agent
const result = await ctx.callTool('custom-analyst', 'cross-reference', findings);
```

### Tool Schema

Each tool has an automatically generated schema based on the function signature. You can also provide an explicit schema:

```typescript
this.registerTool('search-database', {
  handler: async (params: { query: string; limit?: number }) => {
    return database.search(params.query, params.limit ?? 10);
  },
  schema: {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'Search query' },
      limit: { type: 'number', description: 'Max results', default: 10 },
    },
    required: ['query'],
  },
});
```

---

## Step 5: Configure the Custom Agent

In `preflight.json`:

```json
{
  "agent": {
    "name": "custom-analyst",
    "version": "1.0.0",
    "description": "Specialized domain analyst",
    "customConfig": {
      "specialization": "biotechnology",
      "maxSources": 10,
      "confidenceThreshold": 0.75
    },
    "capabilities": {
      "modelFamilies": ["GPT4O", "CLAUDE_3_5_SONNET"],
      "maxContextLength": 128000,
      "functionCalling": true,
      "memoryLayers": ["WORKING", "SESSION", "LONG_TERM"],
      "custom": ["custom-analysis", "data-validation"]
    }
  }
}
```

---

## Step 6: Deploy the Agent

```bash
# Validate the agent configuration
preflight doctor

# Register with the runtime
preflight registry register agents/custom-analyst.ts

# Test the agent
preflight run agent custom-analyst \
  --capability custom-analysis \
  --input '{"query": "CRISPR advancements 2026", "depth": 4}'

# Deploy to production
preflight deploy agents/custom-analyst.ts \
  --env production \
  --replicas 3
```

---

## Complete Example

Here's a minimal custom agent that covers all the essentials:

```typescript
import { Agent } from '@agent-preflight/core';

class MinimalCustomAgent extends Agent {
  constructor() {
    super({
      name: 'minimal-custom',
      description: 'Demonstrates all extension points',
    });

    this.registerCapability('echo', {
      name: 'echo',
      schema: {
        type: 'object',
        properties: {
          message: { type: 'string' },
        },
        required: ['message'],
      },
    });

    this.registerTool('uppercase', async (text: string) => text.toUpperCase());
    this.registerTool('reverse', async (text: string) => text.split('').reverse().join(''));
  }

  async onStart() { console.log('Agent starting'); }
  async onStop() { console.log('Agent stopping'); }

  async onMessage(ctx: MessageContext) {
    const { message } = ctx.payload;
    const uppercased = await ctx.callTool(this.id, 'uppercase', message);
    await ctx.reply({ original: message, transformed: uppercased });
  }
}

export default new MinimalCustomAgent();
```
