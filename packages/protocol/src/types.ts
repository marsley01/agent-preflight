export type ACPVersion = string;

export enum ACPCapability {
  Handshake = 'handshake',
  Auth = 'auth',
  CapabilityDiscovery = 'capability_discovery',
  AgentRegistry = 'agent_registry',
  TaskDelegation = 'task_delegation',
  Streaming = 'streaming',
  MemorySharing = 'memory_sharing',
  EventPubSub = 'event_pubsub',
  Retry = 'retry',
  Heartbeat = 'heartbeat',
  HealthCheck = 'health_check',
  VersionNegotiation = 'version_negotiation',
  Encryption = 'encryption',
  Permissions = 'permissions',
  Routing = 'routing',
  Priorities = 'priorities',
  Cancellation = 'cancellation',
  Timeouts = 'timeouts',
  Observability = 'observability',
  Tracing = 'tracing',
  Metrics = 'metrics',
}

export enum ACPMessageFlag {
  SYNC = 'SYNC',
  ASYNC = 'ASYNC',
  STREAM = 'STREAM',
  PRIORITY = 'PRIORITY',
  ENCRYPTED = 'ENCRYPTED',
  COMPRESSED = 'COMPRESSED',
}

export enum ACPMessageType {
  // Handshake messages
  HANDSHAKE_INIT = 'acp:handshake:init',
  HANDSHAKE_ACK = 'acp:handshake:ack',
  HANDSHAKE_CAPABILITIES = 'acp:handshake:capabilities',
  HANDSHAKE_VERSION = 'acp:handshake:version',
  HANDSHAKE_NEGOTIATE = 'acp:handshake:negotiate',
  HANDSHAKE_COMPLETE = 'acp:handshake:complete',
  HANDSHAKE_ERROR = 'acp:handshake:error',

  // Message types
  MESSAGE_SEND = 'acp:message:send',
  MESSAGE_DELIVER = 'acp:message:deliver',
  MESSAGE_ACK = 'acp:message:ack',
  MESSAGE_ERROR = 'acp:message:error',

  // Stream messages
  STREAM_INIT = 'acp:stream:init',
  STREAM_CHUNK = 'acp:stream:chunk',
  STREAM_COMPLETE = 'acp:stream:complete',
  STREAM_CANCEL = 'acp:stream:cancel',
  STREAM_ERROR = 'acp:stream:error',

  // Routing messages
  ROUTE_ANNOUNCE = 'acp:route:announce',
  ROUTE_REMOVE = 'acp:route:remove',
  ROUTE_QUERY = 'acp:route:query',
  ROUTE_RESPONSE = 'acp:route:response',

  // Event messages
  EVENT_PUBLISH = 'acp:event:publish',
  EVENT_SUBSCRIBE = 'acp:event:subscribe',
  EVENT_UNSUBSCRIBE = 'acp:event:unsubscribe',

  // Control messages
  HEARTBEAT = 'acp:heartbeat',
  HEALTH_CHECK = 'acp:health:check',
  HEALTH_STATUS = 'acp:health:status',
  ERROR = 'acp:error',
  CANCEL = 'acp:cancel',
}

export type ACPAgentId = string;

export type ACPCorrelationId = string;

export type ACPSessionId = string;

export interface ACPMessageHeader {
  messageType: ACPMessageType;
  messageId: string;
  source: ACPAgentId;
  target?: ACPAgentId;
  correlationId?: ACPCorrelationId;
  sessionId?: ACPSessionId;
  flags: ACPMessageFlag[];
  timestamp: number;
  ttl?: number;
  priority?: number;
  version: ACPVersion;
}

export interface ACPMessage<T = unknown> {
  header: ACPMessageHeader;
  payload: T;
  signature?: string;
}

export interface ACPHandshakeInitPayload {
  version: ACPVersion;
  supportedVersions: ACPVersion[];
  capabilities: ACPCapability[];
  agentId: ACPAgentId;
  metadata?: Record<string, unknown>;
}

export interface ACPHandshakeAckPayload {
  accepted: boolean;
  version: ACPVersion;
  sessionId: ACPSessionId;
  serverCapabilities: ACPCapability[];
  reason?: string;
}

export interface ACPHandshakeCapabilitiesPayload {
  capabilities: ACPCapability[];
  version: ACPVersion;
}

export interface ACPHandshakeVersionPayload {
  proposedVersion: ACPVersion;
  supportedVersions: ACPVersion[];
}

export interface ACPHandshakeNegotiatePayload {
  selectedVersion: ACPVersion;
  commonCapabilities: ACPCapability[];
  sessionId: ACPSessionId;
}

export interface ACPHandshakeCompletePayload {
  sessionId: ACPSessionId;
  establishedAt: number;
  negotiatedVersion: ACPVersion;
  activeCapabilities: ACPCapability[];
}

export interface ACPHandshakeErrorPayload {
  code: string;
  message: string;
  suggestedVersions?: ACPVersion[];
  retryable: boolean;
}

export interface ACPRoutingRule {
  ruleId: string;
  matchPattern: string;
  targetAgent: ACPAgentId;
  priority: number;
  ttl?: number;
  createdAt: number;
  metadata?: Record<string, unknown>;
}

export interface ACPPriorityQueue {
  queueId: string;
  priority: number;
  messages: ACPMessage[];
  maxSize: number;
  createdAt: number;
}

export interface ACPTimeout {
  timeoutId: string;
  messageId: string;
  durationMs: number;
  deadline: number;
  onTimeout: () => void;
}

export interface ACPRetryConfig {
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
  backoffFactor: number;
  retryOnCodes?: string[];
}

export interface ACPEncryptionConfig {
  algorithm: string;
  keyExchange: string;
  keySize: number;
}

export interface ACPAuthConfig {
  method: 'token' | 'certificate' | 'mutual_tls' | 'oauth';
  tokenEndpoint?: string;
  certificatePath?: string;
}

export interface ACPPermissionsConfig {
  defaultDeny: boolean;
  allowList: string[];
  denyList: string[];
  scope: string;
}

export interface ACPSecurityConfig {
  encryption?: ACPEncryptionConfig;
  auth?: ACPAuthConfig;
  permissions?: ACPPermissionsConfig;
}

export interface ACPTracingConfig {
  enabled: boolean;
  samplingRate: number;
  exporterEndpoint?: string;
  propagationFormat: 'w3c_tracecontext' | 'b3' | 'jaeger';
}

export interface ACPMetricsConfig {
  enabled: boolean;
  exportIntervalMs: number;
  metricsEndpoint?: string;
  includedMetrics: string[];
}

export interface ACPLoggingConfig {
  level: 'debug' | 'info' | 'warn' | 'error';
  format: 'json' | 'text';
  output?: string;
}

export interface ACPObservabilityConfig {
  tracing?: ACPTracingConfig;
  metrics?: ACPMetricsConfig;
  logging?: ACPLoggingConfig;
}

export interface ACPVersionRange {
  min: ACPVersion;
  max: ACPVersion;
}

export function isValidVersion(version: string): version is ACPVersion {
  const semverRegex = /^\d+\.\d+\.\d+$/;
  return semverRegex.test(version);
}

export function compareVersions(a: ACPVersion, b: ACPVersion): number {
  const aParts = a.split('.').map(Number);
  const bParts = b.split('.').map(Number);

  for (let i = 0; i < 3; i++) {
    const aPart = aParts[i] ?? 0;
    const bPart = bParts[i] ?? 0;
    if (aPart > bPart) return 1;
    if (aPart < bPart) return -1;
  }

  return 0;
}

export function isVersionInRange(version: ACPVersion, range: ACPVersionRange): boolean {
  return compareVersions(version, range.min) >= 0 && compareVersions(version, range.max) <= 0;
}
