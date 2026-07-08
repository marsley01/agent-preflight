// =============================================================================
// Agent Preflight — Core Types
// =============================================================================
// Single source of truth for the AI Agent Operating System type system.
// All packages import from here; no circular dependencies allowed.
// =============================================================================

// -----------------------------------------------------------------------------
// Common
// -----------------------------------------------------------------------------

/** RFC 3339 / ISO 8601 timestamp string (e.g. "2026-07-08T12:00:00Z"). */
export type Timestamp = string;

/** Duration expressed in milliseconds. */
export type Duration = number;

/** Size in bytes. */
export type Bytes = number;

/** Value between 0 and 100 inclusive. */
export type Percentage = number;

/** Semantic version string (e.g. "1.2.3", "1.2.3-alpha.1"). */
export type Version = string;

/** Strict semver with major.minor.patch. */
export type SemVer = `${number}.${number}.${number}`;

/** Discriminated result type — mirrors Rust's Result<T, E>. */
export type Result<T, E = ErrorDetail> =
  | { success: true; value: T }
  | { success: false; error: E };

/** Generic paginated response envelope. */
export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
    hasNext: boolean;
    hasPrevious: boolean;
  };
}

/** Generic API response envelope. */
export interface ApiResponse<T> {
  success: boolean;
  data?: T | undefined;
  error?: APIError | undefined;
  meta?: Record<string, unknown> | undefined;
  timestamp: Timestamp;
  requestId: string;
}

/** Machine-readable error code (e.g. "AGENT_NOT_FOUND", "RATE_LIMITED"). */
export type ErrorCode = string;

/** Structured error detail for programmatic handling. */
export interface ErrorDetail {
  code: ErrorCode;
  message: string;
  details?: unknown | undefined;
  stack?: string | undefined;
  cause?: ErrorDetail | undefined;
}

/** Context propagated across service boundaries. */
export interface RequestContext {
  requestId: string;
  traceId: string;
  spanId: string;
  agentId?: AgentId | undefined;
  userId?: string | undefined;
  startTime: Timestamp;
  auth?: SecurityContext | undefined;
  metadata?: Record<string, unknown> | undefined;
}

/** Standard log severity levels. */
export type LogLevel =
  | "TRACE"
  | "DEBUG"
  | "INFO"
  | "WARN"
  | "ERROR"
  | "FATAL";

/** Runtime environment identifier. */
export type Environment =
  | "development"
  | "staging"
  | "production"
  | "test"
  | "local";

// -----------------------------------------------------------------------------
// Agent
// -----------------------------------------------------------------------------

/** Unique agent identifier (UUID v7 recommended). */
export type AgentId = string;

/** Lifecycle status of an agent instance. */
export type AgentStatus =
  | "IDLE"
  | "BUSY"
  | "ERROR"
  | "TERMINATED"
  | "PAUSED";

/** Arbitrary key-value metadata attached to an agent. */
export interface AgentMetadata {
  name?: string | undefined;
  description?: string | undefined;
  version?: Version | undefined;
  tags?: string[] | undefined;
  owner?: string | undefined;
  createdAt?: Timestamp | undefined;
  updatedAt?: Timestamp | undefined;
  custom?: Record<string, unknown> | undefined;
}

/** Persistent configuration for an agent. */
export interface AgentConfig {
  id: AgentId;
  status: AgentStatus;
  metadata: AgentMetadata;
  capabilities: AgentCapabilities;
  dependencies: AgentDependency[];
  maxConcurrency: number;
  maxQueueSize: number;
  timeout: Duration;
  retryPolicy: {
    maxRetries: number;
    baseDelay: Duration;
    maxDelay: Duration;
    backoffFactor: number;
  };
}

/** Publicly visible agent information for discovery. */
export interface AgentInfo {
  id: AgentId;
  name: string;
  description: string;
  version: Version;
  status: AgentStatus;
  capabilities: AgentCapabilities;
  metadata: AgentMetadata;
  healthy: boolean;
  lastSeen: Timestamp;
}

/** Declared capabilities an agent exposes to the mesh. */
export interface AgentCapabilities {
  modelFamilies: ModelFamily[];
  maxContextLength: number;
  supportedMessageTypes: ACPMessageType[];
  streaming: boolean;
  functionCalling: boolean;
  memoryLayers: MemoryLayer[];
  plugins: PluginId[];
  custom: string[];
}

/** Dependency on another agent or external service. */
export interface AgentDependency {
  agentId: AgentId;
  required: boolean;
  version?: SemVer | undefined;
  config?: Record<string, unknown> | undefined;
}

/** Payload for registering an agent with the registry. */
export interface AgentRegistration {
  agent: AgentConfig;
  healthEndpoint?: string | undefined;
  authToken?: string | undefined;
  ttl?: Duration | undefined;
}

// -----------------------------------------------------------------------------
// Agent Communication Protocol (ACP)
// -----------------------------------------------------------------------------

/** Supported ACP protocol version. */
export type ACPVersion = "1.0" | "1.1" | "latest";

/** Discriminated message types in the ACP. */
export type ACPMessageType =
  | "HANDSHAKE"
  | "HEARTBEAT"
  | "TASK_DELEGATE"
  | "TASK_RESPONSE"
  | "TASK_CANCEL"
  | "TASK_STATUS"
  | "CAPABILITY_DISCOVERY"
  | "REGISTER"
  | "EVENT_PUBLISH"
  | "EVENT_SUBSCRIBE"
  | "MEMORY_ACCESS"
  | "STREAM_CHUNK"
  | "STREAM_END"
  | "ERROR"
  | "ACK"
  | "HEALTH_CHECK";

/** Metadata header attached to every ACP message. */
export interface ACPHeader {
  protocol: ACPVersion;
  messageId: string;
  correlationId?: string | undefined;
  senderId: AgentId;
  targetId?: AgentId | undefined;
  timestamp: Timestamp;
  ttl: Duration;
  signature?: string | undefined;
  traceId: string;
  spanId: string;
}

/** Generic discriminated ACP message envelope. */
export type ACPMessage =
  | ACPHandshake
  | ACPHeartbeat
  | ACPTaskDelegate
  | ACPTaskResponse
  | ACPTaskCancel
  | ACPTaskStatus
  | ACPCapabilityDiscovery
  | ACPRegister
  | ACPEventPublish
  | ACPEventSubscribe
  | ACPMemoryAccess
  | ACPStreamChunk
  | ACPHealthCheck
  | ACPError;

/** ACP handshake — establishes a connection between two agents. */
export interface ACPHandshake {
  type: "HANDSHAKE";
  header: ACPHeader;
  payload: {
    protocolVersion: ACPVersion;
    agentInfo: AgentInfo;
    capabilities: AgentCapabilities;
    supportedEncodings: string[];
  };
}

/** Periodic heartbeat to signal liveness. */
export interface ACPHeartbeat {
  type: "HEARTBEAT";
  header: ACPHeader;
  payload: {
    status: AgentStatus;
    load: number;
    uptime: Duration;
    healthy: boolean;
  };
}

/** Delegate a task from one agent to another. */
export interface ACPTaskDelegate {
  type: "TASK_DELEGATE";
  header: ACPHeader;
  payload: {
    taskId: TaskId;
    taskType: TaskType;
    input: TaskInput;
    priority: TaskPriority;
    timeout: Duration;
    context?: TaskContext | undefined;
  };
}

/** Response to a delegated task. */
export interface ACPTaskResponse {
  type: "TASK_RESPONSE";
  header: ACPHeader;
  payload: {
    taskId: TaskId;
    status: TaskStatus;
    output?: TaskOutput | undefined;
    error?: ErrorDetail | undefined;
    metrics?: Record<string, number> | undefined;
  };
}

/** Request to cancel a previously delegated task. */
export interface ACPTaskCancel {
  type: "TASK_CANCEL";
  header: ACPHeader;
  payload: {
    taskId: TaskId;
    reason?: string | undefined;
    force: boolean;
  };
}

/** Status update for an in-flight task. */
export interface ACPTaskStatus {
  type: "TASK_STATUS";
  header: ACPHeader;
  payload: {
    taskId: TaskId;
    status: TaskStatus;
    progress?: Percentage | undefined;
    message?: string | undefined;
    eta?: Duration | undefined;
  };
}

/** Discover capabilities of a remote agent. */
export interface ACPCapabilityDiscovery {
  type: "CAPABILITY_DISCOVERY";
  header: ACPHeader;
  payload: {
    query?: string[] | undefined;
  };
}

/** Register an agent with the mesh. */
export interface ACPRegister {
  type: "REGISTER";
  header: ACPHeader;
  payload: AgentRegistration;
}

/** Publish an event to the mesh event bus. */
export interface ACPEventPublish {
  type: "EVENT_PUBLISH";
  header: ACPHeader;
  payload: {
    event: Event;
  };
}

/** Subscribe to events on the mesh event bus. */
export interface ACPEventSubscribe {
  type: "EVENT_SUBSCRIBE";
  header: ACPHeader;
  payload: {
    subscription: EventSubscription;
  };
}

/** Read or write to a remote agent's memory. */
export interface ACPMemoryAccess {
  type: "MEMORY_ACCESS";
  header: ACPHeader;
  payload: {
    operation: "READ" | "WRITE" | "DELETE" | "QUERY";
    layer: MemoryLayer;
    key?: string | undefined;
    value?: unknown | undefined;
    query?: MemoryQuery | undefined;
  };
}

/** Streaming chunk of a partial response. */
export interface ACPStreamChunk {
  type: "STREAM_CHUNK";
  header: ACPHeader;
  payload: {
    streamId: string;
    sequence: number;
    data: string;
    final: boolean;
  };
}

/** Health check request / response. */
export interface ACPHealthCheck {
  type: "HEALTH_CHECK";
  header: ACPHeader;
  payload: {
    checks: string[];
    verbose: boolean;
  };
}

/** Error response for any ACP message. */
export interface ACPError {
  type: "ERROR";
  header: ACPHeader;
  payload: ErrorDetail;
}

// -----------------------------------------------------------------------------
// Model
// -----------------------------------------------------------------------------

/** Supported model providers. */
export type ModelProvider =
  | "OPENAI"
  | "ANTHROPIC"
  | "GOOGLE"
  | "META"
  | "MISTRAL"
  | "DEEPSEEK"
  | "QWEN"
  | "OPENROUTER"
  | "TOGETHER"
  | "GROQ"
  | "AZURE"
  | "OLLAMA"
  | "CUSTOM";

/** Logical model family grouping. */
export type ModelFamily =
  | "GPT4"
  | "GPT4O"
  | "GPT4O_MINI"
  | "CLAUDE_3_5_SONNET"
  | "CLAUDE_3_5_HAIKU"
  | "CLAUDE_3_OPUS"
  | "GEMINI_PRO"
  | "GEMINI_FLASH"
  | "LLAMA"
  | "MISTRAL_LARGE"
  | "DEEPSEEK_CHAT"
  | "QWEN_PLUS"
  | "CUSTOM";

/** Qualitative capability flags a model may support. */
export type ModelCapability =
  | "REASONING"
  | "CODING"
  | "VISION"
  | "FUNCTION_CALLING"
  | "LONG_CONTEXT"
  | "FAST"
  | "CHEAP"
  | "MULTIMODAL"
  | "EMBEDDING";

/** Full model configuration including provider credentials. */
export interface ModelConfig {
  provider: ModelProvider;
  family: ModelFamily;
  modelName: string;
  version?: Version | undefined;
  capabilities: ModelCapability[];
  maxTokens: number;
  maxInputTokens: number;
  maxOutputTokens: number;
  temperature: number;
  topP: number;
  topK?: number | undefined;
  frequencyPenalty?: number | undefined;
  presencePenalty?: number | undefined;
  stopSequences?: string[] | undefined;
  apiKey?: string | undefined;
  baseUrl?: string | undefined;
  organizationId?: string | undefined;
  deploymentId?: string | undefined;
  timeout: Duration;
  retryConfig: {
    maxRetries: number;
    baseDelay: Duration;
  };
}

/** Route configuration that maps a logical request to a model endpoint. */
export interface ModelRoute {
  id: string;
  name: string;
  model: ModelConfig;
  weight: number;
  fallback?: ModelRoute[] | undefined;
  conditions?: Record<string, unknown> | undefined;
  costPerToken: number;
  costPerRequest: number;
}

/** Configuration for the model router that selects the best model for a task. */
export interface ModelRouterConfig {
  defaultRoute: string;
  routes: ModelRoute[];
  selectionStrategy: "ROUND_ROBIN" | "LOWEST_COST" | "FASTEST" | "CAPABILITY_MATCH" | "MANUAL";
  fallbackEnabled: boolean;
  cacheEnabled: boolean;
  cacheTTL: Duration;
  rateLimit: RateLimitConfig;
}

// -----------------------------------------------------------------------------
// Task
// -----------------------------------------------------------------------------

/** Unique task identifier. */
export type TaskId = string;

/** Execution priority for task scheduling. */
export type TaskPriority = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

/** Lifecycle status of a task. */
export type TaskStatus =
  | "PENDING"
  | "QUEUED"
  | "RUNNING"
  | "PAUSED"
  | "COMPLETED"
  | "FAILED"
  | "CANCELLED"
  | "TIMEOUT";

/** Discriminated task type categorisation. */
export type TaskType =
  | "INFERENCE"
  | "CODE_GENERATION"
  | "CODE_REVIEW"
  | "TESTING"
  | "ANALYSIS"
  | "TRANSFORMATION"
  | "SEARCH"
  | "MEMORY_OPERATION"
  | "TOOL_EXECUTION"
  | "CUSTOM";

/** Arbitrary input data for a task. */
export interface TaskInput {
  prompt?: string | undefined;
  messages?: { role: string; content: string }[] | undefined;
  context?: Record<string, unknown> | undefined;
  attachments?: { name: string; mimeType: string; content: string }[] | undefined;
  parameters?: Record<string, unknown> | undefined;
}

/** Arbitrary output data from a task. */
export interface TaskOutput {
  text?: string | undefined;
  data?: unknown | undefined;
  attachments?: { name: string; mimeType: string; content: string }[] | undefined;
  metrics?: Record<string, number> | undefined;
}

/** Complete configuration for executing a task. */
export interface TaskConfig {
  id: TaskId;
  type: TaskType;
  priority: TaskPriority;
  timeout: Duration;
  maxRetries: number;
  ttl: Duration;
  allowParallel: boolean;
  allowStreaming: boolean;
  requiredCapabilities: string[];
  routingHints?: ModelCapability[] | undefined;
  context?: TaskContext | undefined;
}

/** A fully resolved task ready for execution. */
export interface Task extends TaskConfig {
  status: TaskStatus;
  input: TaskInput;
  output?: TaskOutput | undefined;
  error?: ErrorDetail | undefined;
  progress?: Percentage | undefined;
  assignedAgent?: AgentId | undefined;
  parentTaskId?: TaskId | undefined;
  subtaskIds: TaskId[];
  createdAt: Timestamp;
  startedAt?: Timestamp | undefined;
  completedAt?: Timestamp | undefined;
  updatedAt: Timestamp;
}

/** Result of a completed task. */
export interface TaskResult {
  taskId: TaskId;
  status: TaskStatus;
  output?: TaskOutput | undefined;
  error?: ErrorDetail | undefined;
  duration: Duration;
  tokenUsage?: {
    input: number;
    output: number;
    total: number;
  } | undefined;
  cost?: number | undefined;
  agentId?: AgentId | undefined;
}

/** Contextual data attached to a task for traceability. */
export interface TaskContext {
  traceId: string;
  spanId: string;
  sourceAgentId?: AgentId | undefined;
  targetAgentId?: AgentId | undefined;
  workflowId?: string | undefined;
  userId?: string | undefined;
  sessionId?: string | undefined;
  metadata?: Record<string, unknown> | undefined;
}

// -----------------------------------------------------------------------------
// Memory
// -----------------------------------------------------------------------------

/** Logical memory layer / tier. */
export type MemoryLayer =
  | "WORKING"
  | "SESSION"
  | "LONG_TERM"
  | "SEMANTIC"
  | "KNOWLEDGE_GRAPH"
  | "VECTOR"
  | "PROJECT"
  | "USER"
  | "SHARED"
  | "ENCRYPTED";

/** A single entry persisted in a memory store. */
export interface MemoryEntry {
  id: string;
  key: string;
  value: unknown;
  layer: MemoryLayer;
  agentId: AgentId;
  userId?: string | undefined;
  sessionId?: string | undefined;
  embedding?: number[] | undefined;
  metadata?: Record<string, unknown> | undefined;
  ttl?: Duration | undefined;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  expiresAt?: Timestamp | undefined;
}

/** Query parameters for searching memory entries. */
export interface MemoryQuery {
  key?: string | undefined;
  keys?: string[] | undefined;
  layer?: MemoryLayer | undefined;
  agentId?: AgentId | undefined;
  userId?: string | undefined;
  sessionId?: string | undefined;
  query?: string | undefined;
  embedding?: number[] | undefined;
  limit: number;
  offset: number;
  minScore?: number | undefined;
  filters?: Record<string, unknown> | undefined;
}

/** Result of a memory query operation. */
export interface MemoryResult {
  entries: MemoryEntry[];
  total: number;
  query: MemoryQuery;
  duration: Duration;
}

/** Configuration for a memory store backend. */
export interface MemoryConfig {
  defaultLayer: MemoryLayer;
  maxEntriesPerAgent: number;
  maxEntrySize: Bytes;
  ttl: Record<MemoryLayer, Duration>;
  vectorDimension?: number | undefined;
  similarityMetric: "cosine" | "euclidean" | "dotProduct";
  encryptionEnabled: boolean;
  encryptionKey?: string | undefined;
}

/** Abstract interface for a memory storage backend. */
export interface MemoryStore {
  read(layer: MemoryLayer, key: string): Promise<MemoryEntry | null>;
  write(entry: MemoryEntry): Promise<void>;
  delete(layer: MemoryLayer, key: string): Promise<boolean>;
  query(query: MemoryQuery): Promise<MemoryResult>;
  clear(layer: MemoryLayer, agentId: AgentId): Promise<number>;
  health(): Promise<HealthStatus>;
}

// -----------------------------------------------------------------------------
// Security
// -----------------------------------------------------------------------------

/** Fine-grained permission string (e.g. "agent:read", "task:write"). */
export type Permission = string;

/** Named role that aggregates permissions. */
export type Role = string;

/** Access-control policy definition. */
export type Policy = string;

/** Effect of a policy statement. */
export type PolicyEffect = "ALLOW" | "DENY";

/** A single statement within a policy document. */
export interface PolicyStatement {
  sid?: string | undefined;
  effect: PolicyEffect;
  actions: Permission[];
  resources: string[];
  conditions?: Record<string, unknown> | undefined;
}

/** A complete policy document composed of statements. */
export interface PolicyDocument {
  id: string;
  version: SemVer;
  statements: PolicyStatement[];
  metadata?: Record<string, unknown> | undefined;
}

/** Security context attached to a request or session. */
export interface SecurityContext {
  userId?: string | undefined;
  agentId?: AgentId | undefined;
  roles: Role[];
  permissions: Permission[];
  policies: PolicyDocument[];
  encryptedClaims?: string | undefined;
}

/** Authentication token (JWT or opaque). */
export interface AuthToken {
  value: string;
  type: "Bearer" | "Basic" | "API_KEY";
  issuedAt: Timestamp;
  expiresAt: Timestamp;
  claims: Record<string, unknown>;
}

/** API key credentials. */
export interface APIKey {
  id: string;
  name: string;
  key: string;
  prefix: string;
  permissions: Permission[];
  rateLimit: RateLimitConfig;
  expiresAt?: Timestamp | undefined;
  createdAt: Timestamp;
}

/** Encrypted secret value. */
export interface Secret {
  id: string;
  name: string;
  encryptedValue: string;
  algorithm: string;
  version: number;
  tags: string[];
  createdAt: Timestamp;
  updatedAt: Timestamp;
  expiresAt?: Timestamp | undefined;
}

/** Single audit log entry for security events. */
export interface AuditLogEntry {
  id: string;
  timestamp: Timestamp;
  eventType: SecurityEventType;
  actorId: string;
  actorType: "USER" | "AGENT" | "SYSTEM";
  resourceType: string;
  resourceId: string;
  action: string;
  result: "SUCCESS" | "FAILURE" | "DENIED";
  context: RequestContext;
  details?: Record<string, unknown> | undefined;
}

/** Security-relevant event payload. */
export interface SecurityEvent {
  id: string;
  type: SecurityEventType;
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  timestamp: Timestamp;
  source: string;
  message: string;
  context: RequestContext;
  details?: Record<string, unknown> | undefined;
}

/** Types of security events the system tracks. */
export type SecurityEventType =
  | "AUTH_SUCCESS"
  | "AUTH_FAILURE"
  | "AUTH_TOKEN_REFRESH"
  | "ACCESS_DENIED"
  | "ROLE_CHANGE"
  | "PERMISSION_CHANGE"
  | "API_KEY_CREATED"
  | "API_KEY_REVOKED"
  | "SECRET_ACCESSED"
  | "SECRET_ROTATED"
  | "RATE_LIMIT_EXCEEDED"
  | "SANDBOX_VIOLATION"
  | "MALICIOUS_INPUT_DETECTED"
  | "CONFIG_CHANGE"
  | "EXFILTRATION_ATTEMPT";

/** Sandbox isolation configuration. */
export interface SandboxConfig {
  enabled: boolean;
  runtime: "NONE" | "VM2" | "DENO" | "CONTAINER" | "WEB_WORKER";
  memoryLimit: Bytes;
  cpuLimit: number;
  networkAccess: boolean;
  allowedDomains: string[];
  allowedModules: string[];
  timeout: Duration;
  tempDirSize: Bytes;
  readOnlyFilesystem: boolean;
}

/** Rate limiting configuration. */
export interface RateLimitConfig {
  enabled: boolean;
  maxRequests: number;
  windowMs: Duration;
  strategy: "TOKEN_BUCKET" | "FIXED_WINDOW" | "SLIDING_WINDOW" | "ADAPTIVE";
  burstAllowed: number;
  penaltyMs?: Duration | undefined;
}

// -----------------------------------------------------------------------------
// Evaluation
// -----------------------------------------------------------------------------

/** Named evaluation metric. */
export type EvaluationMetric =
  | "ACCURACY"
  | "COMPLETENESS"
  | "REASONING"
  | "CITATION_QUALITY"
  | "TOOL_USAGE"
  | "EFFICIENCY"
  | "LATENCY"
  | "SAFETY"
  | "HALLUCINATION_RISK"
  | "CONFIDENCE";

/** Score for a single evaluation metric. */
export interface EvaluationScore {
  metric: EvaluationMetric;
  value: number;
  weight: number;
  confidence?: number | undefined;
  rationale?: string | undefined;
  metadata?: Record<string, unknown> | undefined;
}

/** Complete evaluation result for a run. */
export interface EvaluationResult {
  runId: string;
  taskId: TaskId;
  agentId: AgentId;
  scores: EvaluationScore[];
  overallScore: number;
  passed: boolean;
  threshold: number;
  duration: Duration;
  timestamp: Timestamp;
}

/** Configuration for an evaluation framework. */
export interface EvaluationConfig {
  metrics: { metric: EvaluationMetric; weight: number; threshold: number }[];
  overallThreshold: number;
  parallelEvaluations: boolean;
  autoFailFast: boolean;
  storeResults: boolean;
  notifyOnFailure: boolean;
}

 /** A single evaluation run. */
export interface EvaluationRun {
  id: string;
  config: EvaluationConfig;
  tasks: TaskId[];
  status: "PENDING" | "RUNNING" | "COMPLETED" | "FAILED";
  results: EvaluationResult[];
  startedAt: Timestamp;
  completedAt?: Timestamp | undefined;
}

// -----------------------------------------------------------------------------
// Observability
// -----------------------------------------------------------------------------

/** A single span within a distributed trace. */
export interface Span {
  spanId: string;
  traceId: string;
  parentSpanId?: string | undefined;
  name: string;
  kind: "INTERNAL" | "CLIENT" | "SERVER" | "PRODUCER" | "CONSUMER";
  status: "UNSET" | "OK" | "ERROR";
  startTime: Timestamp;
  endTime?: Timestamp | undefined;
  duration?: Duration | undefined;
  attributes: Record<string, unknown>;
  events: { name: string; timestamp: Timestamp; attributes?: Record<string, unknown> }[];
  links: { traceId: string; spanId: string; attributes?: Record<string, unknown> }[];
  resource: Record<string, unknown>;
}

/** A distributed trace comprising multiple spans. */
export interface Trace {
  traceId: string;
  rootSpanId: string;
  spans: Span[];
  startTime: Timestamp;
  endTime?: Timestamp | undefined;
  duration?: Duration | undefined;
  status: "OK" | "ERROR" | "UNSET";
  attributes: Record<string, unknown>;
}

/** Metric type classification. */
export type MetricType = "COUNTER" | "GAUGE" | "HISTOGRAM";

 /** A single metric data point. */
export interface Metric {
  name: string;
  type: MetricType;
  value: MetricValue;
  unit?: string | undefined;
  tags?: Record<string, string> | undefined;
  timestamp: Timestamp;
  resource?: Record<string, unknown> | undefined;
}

/** Union of possible metric value shapes. */
export type MetricValue =
  | { kind: "scalar"; value: number }
  | { kind: "distribution"; count: number; sum: number; min: number; max: number; buckets: { le: number; count: number }[] }
  | { kind: "count"; value: number; rate?: number | undefined };

/** Generic telemetry event payload. */
export interface TelemetryEvent {
  id: string;
  name: string;
  timestamp: Timestamp;
  severity: LogLevel;
  attributes: Record<string, unknown>;
  resource: Record<string, unknown>;
  traceId?: string | undefined;
  spanId?: string | undefined;
}

/** Telemetry collection configuration. */
export interface TelemetryConfig {
  enabled: boolean;
  samplingRate: number;
  batchSize: number;
  batchInterval: Duration;
  endpoint?: string | undefined;
  headers?: Record<string, string> | undefined;
  attributes?: Record<string, unknown> | undefined;
}

/** Aggregate observability configuration. */
export interface ObservabilityConfig {
  tracing: TelemetryConfig & {
    exporter: "CONSOLE" | "OTLP" | "ZIPKIN" | "JAEGER" | "NONE";
  };
  metrics: TelemetryConfig & {
    exporter: "CONSOLE" | "OTLP" | "PROMETHEUS" | "DATADOG" | "NONE";
  };
  logging: TelemetryConfig & {
    level: LogLevel;
    format: "TEXT" | "JSON" | "STRUCTURED";
  };
}

/** Health status of a component. */
export interface HealthStatus {
  component: string;
  status: "HEALTHY" | "DEGRADED" | "UNHEALTHY" | "UNKNOWN";
  message?: string | undefined;
  lastChecked: Timestamp;
  latency: Duration;
  details?: Record<string, unknown> | undefined;
}

/** Result of a health check. */
export interface HealthCheck {
  overall: "HEALTHY" | "DEGRADED" | "UNHEALTHY";
  checks: HealthStatus[];
  timestamp: Timestamp;
  duration: Duration;
}

// -----------------------------------------------------------------------------
// Plugin
// -----------------------------------------------------------------------------

/** Unique plugin identifier. */
export type PluginId = string;

/** Plugin type classification. */
export type PluginType =
  | "INTEGRATION"
  | "PROVIDER"
  | "MEMORY"
  | "SECURITY"
  | "EVALUATION"
  | "OBSERVABILITY"
  | "UI"
  | "TOOL";

/** Manifest describing a plugin's identity and requirements. */
export interface PluginManifest {
  id: PluginId;
  name: string;
  version: SemVer;
  type: PluginType;
  description: string;
  author: string;
  license: string;
  entryPoint: string;
  dependencies: { pluginId: PluginId; version: SemVer }[];
  optionalDependencies: { pluginId: PluginId; version: SemVer }[];
  permissions: Permission[];
  capabilities: string[];
  homepage?: string | undefined;
  repository?: string | undefined;
  documentation?: string | undefined;
}

/** Runtime configuration for a loaded plugin. */
export interface PluginConfig {
  manifest: PluginManifest;
  enabled: boolean;
  settings: Record<string, unknown>;
  environment: Record<string, string>;
  timeout: Duration;
  maxMemory: Bytes;
}

 /** A loaded and instantiated plugin. */
export interface PluginInstance {
  config: PluginConfig;
  instance: unknown;
  initialized: boolean;
  startedAt: Timestamp;
}

 /** Global plugin registry. */
export interface PluginRegistry {
  plugins: Map<PluginId, PluginInstance>;
  load(manifest: PluginManifest): Promise<PluginInstance>;
  unload(pluginId: PluginId): Promise<void>;
  get(pluginId: PluginId): PluginInstance | undefined;
  list(type?: PluginType | undefined): PluginInstance[];
  health(): Promise<HealthStatus>;
}

// -----------------------------------------------------------------------------
// Orchestration
// -----------------------------------------------------------------------------

/** Top-level orchestrator configuration. */
export interface AgentOrchestratorConfig {
  maxConcurrentAgents: number;
  defaultTimeout: Duration;
  retryPolicy: {
    maxRetries: number;
    baseDelay: Duration;
    maxDelay: Duration;
    backoffFactor: number;
  };
  schedulingStrategy: "FIFO" | "PRIORITY" | "ROUND_ROBIN" | "WORK_STEALING" | "LOAD_BALANCED";
  planner: PlannerConfig;
  scheduler: SchedulerConfig;
  coordinator: CoordinatorConfig;
}

/** Planner configuration. */
export interface PlannerConfig {
  enabled: boolean;
  strategy: "SEQUENTIAL" | "PARALLEL" | "DEPENDENCY_GRAPH" | "DYNAMIC";
  maxPlanningDepth: number;
  timeout: Duration;
}

/** Scheduler configuration. */
export interface SchedulerConfig {
  maxQueueSize: number;
  pollingInterval: Duration;
  preemptionEnabled: boolean;
  priorityLevels: TaskPriority[];
}

 /** Coordinator configuration. */
export interface CoordinatorConfig {
  protocol: "DIRECT" | "MESH" | "BROKERED";
  heartbeatInterval: Duration;
  healthCheckInterval: Duration;
  failureDetectionTimeout: Duration;
  autoReconnect: boolean;
}

 /** A workflow definition composed of steps. */
export interface WorkflowDefinition {
  id: string;
  name: string;
  version: SemVer;
  description: string;
  steps: WorkflowStep[];
  timeout: Duration;
  tags: string[];
  metadata?: Record<string, unknown> | undefined;
}

/** A single step within a workflow. */
export interface WorkflowStep {
  id: string;
  name: string;
  agentId: AgentId;
  input: TaskInput;
  dependsOn: string[];
  timeout: Duration;
  retryPolicy?: {
    maxRetries: number;
    baseDelay: Duration;
  } | undefined;
  conditions?: {
    runIf?: string | undefined;
    skipIf?: string | undefined;
  } | undefined;
}

/** Runtime state of a workflow execution. */
export interface WorkflowExecution {
  id: string;
  definition: WorkflowDefinition;
  status: WorkflowStatus;
  currentStepId: string | undefined;
  stepResults: Map<string, TaskResult>;
  context: TaskContext;
  startedAt: Timestamp;
  completedAt?: Timestamp | undefined;
  error?: ErrorDetail | undefined;
}

/** Workflow execution lifecycle status. */
export type WorkflowStatus =
  | "PENDING"
  | "RUNNING"
  | "PAUSED"
  | "COMPLETED"
  | "FAILED"
  | "CANCELLED"
  | "TIMEOUT";

/** Directed graph of agents representing mesh topology. */
export interface AgentGraph {
  nodes: AgentNode[];
  edges: AgentEdge[];
  metadata?: Record<string, unknown> | undefined;
}

/** A single node (agent) in the agent graph. */
export interface AgentNode {
  id: AgentId;
  name: string;
  status: AgentStatus;
  capabilities: AgentCapabilities;
  metadata: AgentMetadata;
  position?: { x: number; y: number } | undefined;
}

/** A directed edge between two agent nodes. */
export interface AgentEdge {
  source: AgentId;
  target: AgentId;
  weight: number;
  label?: string | undefined;
  protocol: ACPMessageType[];
  metadata?: Record<string, unknown> | undefined;
}

// -----------------------------------------------------------------------------
// Event
// -----------------------------------------------------------------------------

/** Unique event identifier. */
export type EventId = string;

/** Discriminated event type string. */
export type EventType =
  | "AGENT_REGISTERED"
  | "AGENT_DEREGISTERED"
  | "AGENT_STATUS_CHANGE"
  | "TASK_CREATED"
  | "TASK_COMPLETED"
  | "TASK_FAILED"
  | "TASK_CANCELLED"
  | "WORKFLOW_STARTED"
  | "WORKFLOW_COMPLETED"
  | "WORKFLOW_FAILED"
  | "MESSAGE_SENT"
  | "MESSAGE_RECEIVED"
  | "MEMORY_UPDATED"
  | "MEMORY_DELETED"
  | "SECURITY_EVENT"
  | "EVALUATION_COMPLETED"
  | "ERROR_OCCURRED"
  | "SYSTEM_EVENT"
  | "CUSTOM";

/** A domain event published on the event bus. */
export interface Event {
  id: EventId;
  type: EventType;
  source: string;
  subject?: string | undefined;
  data: unknown;
  timestamp: Timestamp;
  correlationId?: string | undefined;
  causationId?: string | undefined;
  context: RequestContext;
  metadata?: Record<string, unknown> | undefined;
}

/** Handler function for processing events. */
export type EventHandler = (event: Event) => Promise<void>;

/** In-memory or distributed event bus interface. */
export interface EventBus {
  publish(event: Event): Promise<void>;
  subscribe(subscription: EventSubscription): Promise<void>;
  unsubscribe(subscriptionId: string): Promise<void>;
  health(): Promise<HealthStatus>;
}

/** Event subscription configuration. */
export interface EventSubscription {
  id: string;
  eventTypes: EventType[];
  handler: EventHandler;
  filter?: ((event: Event) => boolean) | undefined;
  maxRetries?: number | undefined;
  timeout?: Duration | undefined;
}

/** Publisher configuration for emitting events. */
export interface EventPublisher {
  publish(event: Omit<Event, "id" | "timestamp" | "context">): Promise<EventId>;
  health(): Promise<HealthStatus>;
}

// -----------------------------------------------------------------------------
// SDK
// -----------------------------------------------------------------------------

/** Top-level SDK client exposing all agent operations. */
export interface SDKClient {
  config: SDKConfig;
  agents: SDKProvider<AgentId, AgentInfo>;
  tasks: SDKProvider<TaskId, Task>;
  memory: {
    read(layer: MemoryLayer, key: string): Promise<MemoryEntry | null>;
    write(entry: Omit<MemoryEntry, "id" | "createdAt" | "updatedAt">): Promise<MemoryEntry>;
    query(query: MemoryQuery): Promise<MemoryResult>;
    delete(layer: MemoryLayer, key: string): Promise<boolean>;
  };
  events: {
    publish(event: Omit<Event, "id" | "timestamp">): Promise<EventId>;
    subscribe(subscription: EventSubscription): Promise<void>;
  };
  models: {
    invoke(config: ModelConfig, input: TaskInput): Promise<TaskOutput>;
    stream(config: ModelConfig, input: TaskInput): AsyncIterable<SDKStreamChunk>;
  };
  health(): Promise<HealthStatus>;
}

/** SDK client configuration. */
export interface SDKConfig {
  endpoint: string;
  apiKey: string;
  timeout: Duration;
  retryPolicy: {
    maxRetries: number;
    baseDelay: Duration;
  };
  headers?: Record<string, string> | undefined;
  websocketUrl?: string | undefined;
}

/** Typed SDK response envelope. */
export interface SDKResponse<T> {
  success: boolean;
  data?: T | undefined;
  error?: SDKError | undefined;
  requestId: string;
  timestamp: Timestamp;
}

 /** Streaming chunk from the SDK. */
export interface SDKStreamChunk {
  streamId: string;
  sequence: number;
  data: unknown;
  final: boolean;
  error?: SDKError | undefined;
}

/** Subscription handle for real-time updates. */
export interface SDKSubscription {
  id: string;
  eventType: EventType;
  unsubscribe(): Promise<void>;
}

/** Generic provider interface for CRUD-like SDK operations. */
export interface SDKProvider<TId extends string, TEntity> {
  get(id: TId): Promise<SDKResponse<TEntity>>;
  list(filter?: Record<string, unknown>): Promise<SDKResponse<TEntity[]>>;
  create(data: Partial<TEntity>): Promise<SDKResponse<TEntity>>;
  update(id: TId, data: Partial<TEntity>): Promise<SDKResponse<TEntity>>;
  delete(id: TId): Promise<SDKResponse<void>>;
}

/** Standardized SDK error. */
export interface SDKError {
  code: ErrorCode;
  message: string;
  statusCode: number;
  details?: unknown | undefined;
  retryable: boolean;
}

// -----------------------------------------------------------------------------
// API
// -----------------------------------------------------------------------------

/** Generic API request envelope. */
export interface APIRequest {
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE" | "OPTIONS" | "HEAD";
  path: string;
  headers: Record<string, string>;
  query: Record<string, string | string[] | undefined>;
  body?: unknown | undefined;
  params: Record<string, string>;
  context: RequestContext;
}

 /** Generic API response envelope. */
export interface APIResponse<T = unknown> {
  statusCode: number;
  headers: Record<string, string>;
  body: T;
  timestamp: Timestamp;
}

/** Standardized API error body. */
export interface APIError {
  code: ErrorCode;
  message: string;
  details?: unknown | undefined;
  stack?: string | undefined;
  statusCode: number;
}

/** API endpoint descriptor. */
export interface APIEndpoint {
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE" | "OPTIONS" | "HEAD";
  path: string;
  summary: string;
  description?: string | undefined;
  operationId: string;
  tags: string[];
  deprecated: boolean;
  rateLimit?: RateLimitConfig | undefined;
  auth?: AuthConfig | undefined;
}

/** API route binding. */
export interface APIRoute {
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE" | "OPTIONS" | "HEAD";
  path: string;
  handler: (req: APIRequest) => Promise<APIResponse>;
  middleware?: APIMiddleware[] | undefined;
}

/** API middleware function. */
export type APIMiddleware = (req: APIRequest, next: () => Promise<APIResponse>) => Promise<APIResponse>;

/** Gateway-level API configuration. */
export interface APIGatewayConfig {
  port: number;
  host: string;
  cors: CORSConfig;
  auth: AuthConfig;
  rateLimit: RateLimitPolicy;
  bodyLimit: Bytes;
  timeout: Duration;
  compression: boolean;
  trustProxy: boolean;
  routes: APIRoute[];
}

/** Rate limiting policy for the API gateway. */
export interface RateLimitPolicy {
  enabled: boolean;
  global: RateLimitConfig;
  perRoute: Record<string, RateLimitConfig>;
  perUser: RateLimitConfig;
  perAgent: RateLimitConfig;
}

/** CORS configuration. */
export interface CORSConfig {
  enabled: boolean;
  origins: string[];
  methods: string[];
  allowedHeaders: string[];
  exposedHeaders: string[];
  credentials: boolean;
  maxAge: Duration;
}

/** Authentication configuration. */
export interface AuthConfig {
  enabled: boolean;
  provider: "JWT" | "API_KEY" | "OAUTH2" | "BASIC" | "NONE";
  jwksUrl?: string | undefined;
  issuer?: string | undefined;
  audience?: string | undefined;
  secret?: string | undefined;
  apiKeyHeader?: string | undefined;
  tokenExpiry: Duration;
  refreshTokenExpiry: Duration;
}

// -----------------------------------------------------------------------------
// Deployment
// -----------------------------------------------------------------------------

/** Valid deployment target platforms. */
export type DeploymentTarget =
  | "LOCAL"
  | "DOCKER"
  | "KUBERNETES"
  | "CLOUD"
  | "SERVERLESS"
  | "EDGE";

/** Complete deployment configuration for a target environment. */
export interface DeploymentConfig {
  id: string;
  target: DeploymentTarget;
  environment: EnvironmentConfig;
  container?: ContainerConfig | undefined;
  orchestrator?: OrchestratorConfig | undefined;
  version: SemVer;
  replicas: number;
  resources: {
    cpu: string;
    memory: string;
    disk: string;
    gpu?: string | undefined;
  };
  env: Record<string, string>;
  secrets: Record<string, string>;
  ports: { name: string; port: number; protocol: "TCP" | "UDP" }[];
  healthCheck: {
    path: string;
    interval: Duration;
    timeout: Duration;
    healthyThreshold: number;
    unhealthyThreshold: number;
  };
  labels: Record<string, string>;
  annotations: Record<string, string>;
}

/** Deployment lifecycle status. */
export type DeploymentStatus =
  | "PENDING"
  | "DEPLOYING"
  | "RUNNING"
  | "DEGRADED"
  | "FAILED"
  | "ROLLING_BACK"
  | "STOPPED"
  | "TERMINATED";

/** Per-environment configuration. */
export interface EnvironmentConfig {
  name: Environment;
  target: DeploymentTarget;
  variables: Record<string, string>;
  secrets: Record<string, string>;
  features: Record<string, boolean>;
}

/** Container runtime configuration. */
export interface ContainerConfig {
  image: string;
  tag: string;
  registry: string;
  pullPolicy: "Always" | "IfNotPresent" | "Never";
  entrypoint?: string[] | undefined;
  command?: string[] | undefined;
  workingDir?: string | undefined;
  volumes: { name: string; path: string; readOnly: boolean }[];
  network: {
    mode: "BRIDGE" | "HOST" | "NONE";
    ports: number[];
  };
}

/** External orchestrator (e.g. Kubernetes) configuration. */
export interface OrchestratorConfig {
  type: "KUBERNETES" | "NOMAD" | "DOCKER_SWARM" | "NONE";
  namespace?: string | undefined;
  serviceAccount?: string | undefined;
  ingress?: {
    enabled: boolean;
    host: string;
    tls: boolean;
    annotations: Record<string, string>;
  } | undefined;
  scaling: {
    minReplicas: number;
    maxReplicas: number;
    targetCpuUtilization: number;
    targetMemoryUtilization: number;
  };
}
