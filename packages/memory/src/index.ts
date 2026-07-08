// =============================================================================
// Agent Preflight — Memory Package
// =============================================================================
// Multi-layer memory system for the AI Agent Operating System.
//
// Layers:
//   WORKING      —  Shortest-lived, active task context (seconds–minutes)
//   SESSION      —  Medium-lived, per-session conversation history
//   LONG_TERM    —  Persistent learned patterns and user knowledge
//   SEMANTIC     —  Embedding-based meaning retrieval and concept clustering
//   VECTOR       —  High-dimensional ANN search at scale
//   KNOWLEDGE_GRAPH — Structured entity-relationship knowledge representation
//   ENCRYPTED    —  Transparent AES-256-GCM encryption wrapper
//   SHARED       —  Cross-agent memory with ACL-based access control
// =============================================================================

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------
export type {
  MemoryEntryMeta,
  MemoryQuery,
  MemorySearchResult,
  MemorySearchResponse,
  MemoryStats,
  MemoryLayerConfig,
  MemoryPermission,
  MemoryAccessControl,
  GraphEntity,
  GraphRelationship,
  Triple,
  VectorIndexConfig,
  VectorEntry,
  VectorSearchResult,
  MemoryEventType,
  MemoryEvent,
  ConsolidationStrategy,
} from './types.js';

// -----------------------------------------------------------------------------
// Store
// -----------------------------------------------------------------------------
export {
  InMemoryMemoryStore,
} from './store.js';
export type {
  MemoryStore,
  SaveOptions,
  OptimizeResult,
} from './store.js';

// -----------------------------------------------------------------------------
// Working Memory
// -----------------------------------------------------------------------------
export { WorkingMemory } from './working.js';
export type { WorkingMemoryConfig } from './working.js';

// -----------------------------------------------------------------------------
// Session Memory
// -----------------------------------------------------------------------------
export { SessionMemory } from './session.js';
export type {
  SessionMemoryConfig,
  Session,
} from './session.js';

// -----------------------------------------------------------------------------
// Long-Term Memory
// -----------------------------------------------------------------------------
export { LongTermMemory } from './longterm.js';
export type {
  LongTermMemoryConfig,
  ConsolidationResult,
} from './longterm.js';

// -----------------------------------------------------------------------------
// Semantic Memory
// -----------------------------------------------------------------------------
export { SemanticMemory } from './semantic.js';
export type {
  SemanticMemoryConfig,
  ConceptCluster,
  SemanticRelationship,
} from './semantic.js';

// -----------------------------------------------------------------------------
// Vector Memory
// -----------------------------------------------------------------------------
export { VectorMemory } from './vector.js';
export type {
  VectorMemoryConfig,
  EmbeddingProvider,
} from './vector.js';

// -----------------------------------------------------------------------------
// Knowledge Graph
// -----------------------------------------------------------------------------
export { KnowledgeGraph } from './knowledge.js';
export type {
  KnowledgeGraphConfig,
  TraversalResult,
  GraphQuery,
  GraphQueryResult,
} from './knowledge.js';

// -----------------------------------------------------------------------------
// Memory Manager
// -----------------------------------------------------------------------------
export { MemoryManager } from './manager.js';
export type {
  MemoryManagerConfig,
  AllLayerConfigs,
  MemoryUsageReport,
  MemoryManagerConsolidationResult,
} from './manager.js';

// -----------------------------------------------------------------------------
// Encrypted Memory
// -----------------------------------------------------------------------------
export { EncryptedMemory } from './encrypted.js';
export type { EncryptedMemoryConfig } from './encrypted.js';

// -----------------------------------------------------------------------------
// Shared Memory
// -----------------------------------------------------------------------------
export { SharedMemory } from './shared.js';
export type { SharedMemoryConfig } from './shared.js';
