# Memory Concepts

---

## Memory Layers Overview

Agent Preflight implements a multi-layer memory architecture through the `MemoryManager`. Each layer is optimized for different access patterns, durability requirements, and data types.

```
                    ┌─────────────────────────────────────┐
                    │           MemoryManager              │
                    │  (Orchestration, Auto-Routing,       │
                    │   Cross-Layer Search, Consolidation) │
                    └──────────┬──────────────────────────┘
                               │
    ┌──────────────┬───────────┼───────────┬──────────────┐
    │              │           │           │              │
    ▼              ▼           ▼           ▼              ▼
┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌──────────┐
│ WORKING │  │ SESSION │  │LONG-TERM│  │SEMANTIC │  │KNOWLEDGE │
│         │  │         │  │         │  │(Vector) │  │  GRAPH   │
└─────────┘  └─────────┘  └─────────┘  └─────────┘  └──────────┘
```

### Layer Characteristics

| Layer | Persistence | TTL Default | Access Speed | Use Case |
|---|---|---|---|---|
| **WORKING** | In-memory | 5 minutes | Nanosecond | Task context, scratch data, intermediate results |
| **SESSION** | In-memory | 1 hour | Microsecond | Conversation history, per-session state |
| **LONG_TERM** | Persistent | Indefinite | Millisecond | Learned knowledge, preferences, aggregated data |
| **SEMANTIC** | Persistent | Indefinite | Millisecond | Similarity search, RAG, embedding-based retrieval |
| **KNOWLEDGE_GRAPH** | Persistent | Indefinite | Millisecond | Structured entity relationships, facts |

---

## When to Use Each Layer

### WORKING Memory

Use for data that is only relevant during the current task execution:

```typescript
// Cache intermediate computation results
await memory.save('WORKING', 'temp-parse-result', parsedData, {
  ttl: 300_000, // 5 minutes
});

// Track task progress
await memory.save('WORKING', 'task:123:progress', { pct: 75 });
```

**Best for:** Temporary caches, intermediate results, scratch buffers, task-local state.

### SESSION Memory

Use for data that persists across multiple interactions within a session:

```typescript
// Store conversation context
await memory.save('SESSION', `conversation:${sessionId}`, messages, {
  sessionId: sessionId,
  ttl: 3_600_000, // 1 hour
});

// Track session-level preferences
await memory.save('SESSION', `${sessionId}:prefs`, { language: 'fr' });
```

**Best for:** Chat history, session preferences, authentication state, multi-turn context.

### LONG_TERM Memory

Use for persistent knowledge that should survive restarts:

```typescript
// Store learned user preferences
await memory.save('LONG_TERM', `user:${userId}:prefs`, preferences);

// Cache expensive computations
await memory.save('LONG_TERM', `analysis:${hash}`, results, {
  tags: ['analysis', 'expensive'],
});
```

**Best for:** User profiles, learned patterns, aggregated statistics, cached results.

### SEMANTIC Memory (Vector)

Use for similarity-based retrieval and RAG (Retrieval-Augmented Generation):

```typescript
// Store with embedding for similarity search
await memory.save('SEMANTIC', `doc:${id}`, document, {
  embedding: await generateEmbedding(document.text),
});

// Query by semantic similarity
const results = await memory.query({
  layer: 'SEMANTIC',
  embedding: queryEmbedding,
  limit: 10,
  relevance: 0.7,  // minimum similarity threshold
});
```

**Best for:** Document retrieval, RAG pipelines, semantic caching, deduplication.

### KNOWLEDGE_GRAPH Memory

Use for structured entity-relationship data:

```typescript
// Store entities and relationships
await memory.save('KNOWLEDGE_GRAPH', `entity:${id}`, {
  type: 'Person',
  properties: { name: 'Alice', role: 'Researcher' },
  relationships: [
    { predicate: 'WORKS_FOR', object: 'org:acme-corp' },
    { predicate: 'AUTHORED', object: 'doc:paper-2026' },
  ],
});

// Query by relationship
const results = await memory.query({
  layer: 'KNOWLEDGE_GRAPH',
  query: 'FIND Person WORKS_FOR org:acme-corp',
});
```

**Best for:** Entity resolution, relationship mapping, organizational charts, knowledge base management.

---

## Memory Lifecycle

### Entry Lifecycle

```
Created → Active → Expired/Evicted → Deleted
  │          │
  ▼          ▼
Updated   Consolidated
(extends  (merged into
 TTL)     higher layer)
```

### TTL and Expiry

Each memory entry has a configurable TTL:

```typescript
interface MemoryEntryMeta {
  id: string;
  layer: MemoryLayer;
  agentId: AgentId;
  timestamp: Timestamp;
  ttl: Duration | null;    // null = permanent
  priority: number;         // 0-100, used for eviction
  tags: string[];
  encrypted: boolean;
  size: Bytes;
  checksum: string | null;
}
```

Entries are automatically evicted when:
- TTL expires (`expiresAt` timestamp is reached)
- Layer reaches `maxEntries` or `maxSize` (lowest-priority entries evicted first)
- `MemoryManager.optimize()` is called

### Consolidation

The `MemoryManager` runs periodic consolidation to:

- Summarize and compress old working memory into long-term storage
- Aggregate frequently accessed entries
- Purge expired entries
- Rebuild vector indexes

```typescript
// Default: runs every 60 seconds
// Manual trigger:
await memoryManager.consolidateAll();
```

---

## Cross-Agent Memory Sharing

Memory access across agents is controlled by `MemoryAccessControl`:

```typescript
interface MemoryAccessControl {
  principalId: string;
  permission: 'NONE' | 'READ' | 'WRITE' | 'ADMIN';
  tagFilters?: string[];
  expiresAt?: Timestamp;
}
```

### Sharing Configuration

```typescript
// Agent A grants Agent B read access to tagged entries
await memoryManager.grantAccess('agent-b', {
  permission: 'READ',
  tagFilters: ['public', 'shared'],
});

// Agent B reads shared data
const data = await memoryManager.query({
  agentId: 'agent-a',
  tags: ['public'],
});
```

### Shared Memory Layer

The shared memory layer (`SHARED`) is visible to all agents with appropriate permissions:

```typescript
await memory.save('SHARED', 'global-config', config, {
  tags: ['config', 'global'],
  accessControl: [{ principalId: '*', permission: 'READ' }],
});
```

---

## Memory Security and Encryption

### Encryption at Rest

Sensitive data can be encrypted at the entry level:

```typescript
await memory.save('LONG_TERM', 'credentials', secrets, {
  encrypt: true,
});

// Or configure per-layer encryption
const encryptedLayer = new EncryptedMemory(config);
```

The `EncryptionService` handles:

- AES-256-GCM encryption for entry values
- Per-entry encryption keys with key rotation
- Automatic decryption on read (for authorized agents)

### Access Audit

All memory access events are logged:

```typescript
// Memory events emitted for observability
type MemoryEventType =
  | 'ENTRY_CREATED'
  | 'ENTRY_UPDATED'
  | 'ENTRY_DELETED'
  | 'ENTRY_EXPIRED'
  | 'LAYER_CLEARED'
  | 'CONSOLIDATION_RUN'
  | 'INDEX_REBUILT'
  | 'ERROR';
```

---

## Performance Considerations

### Cache Warming

The `MemoryManager` can preload frequently accessed entries:

```typescript
{
  prefetchEnabled: true,
  prefetchMaxEntries: 100,
  cacheWarmingEnabled: true,
}
```

### Query Optimization

- **Cross-layer search** automatically routes queries to the most relevant layers
- **Result deduplication** prevents duplicate entries across layers
- **Score boosting** prioritizes results from faster/relevant layers
- **Pagination** via `limit` and `offset`

```typescript
interface MemoryQuery {
  layer?: MemoryLayer;
  agentId?: AgentId;
  sessionId?: string;
  tags?: string[];
  timeRange?: { start?: Timestamp; end?: Timestamp };
  query?: string;              // full-text search
  embedding?: number[];        // semantic search
  relevance?: number;          // minimum score 0-1
  limit: number;
  offset: number;
}
```

### Layer Configuration

Each layer can be independently tuned:

```typescript
interface MemoryLayerConfig {
  maxSize: Bytes;         // Storage limit
  ttl: Duration | null;   // Default TTL
  maxEntries: number;     // Entry limit
  encryption: boolean;    // At-rest encryption
  persistence: boolean;   // Disk/database persistence
  compression?: boolean;  // Value compression
}
```

### Monitoring

```typescript
const stats = await memoryManager.stats();
// {
//   totalEntries: 15234,
//   totalSize: 52428800,   // 50 MB
//   byLayer: {
//     WORKING: { entries: 234, size: 1048576 },
//     LONG_TERM: { entries: 15000, size: 51380224 },
//   },
//   hitRate: 94.5,
//   hits: 45000,
//   misses: 2600,
// }
```
