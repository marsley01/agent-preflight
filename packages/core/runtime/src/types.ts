import type {
  AgentId, AgentStatus, Duration, LogLevel, PluginId, ModelProvider,
  Timestamp, AgentMetadata,
  MemoryStore, SecurityContext, ACPMessage,
} from "@agent-preflight/types";

export type LogLevelOption = LogLevel;

export interface ProviderConfig {
  name: string;
  type: ModelProvider;
  apiKey?: string;
  baseUrl?: string;
  options?: Record<string, unknown>;
}

export interface PluginConfigEntry {
  id: PluginId;
  enabled: boolean;
  settings?: Record<string, unknown>;
}

export interface RuntimeConfig {
  agentTimeout: Duration;
  maxConcurrency: number;
  heartbeatInterval: Duration;
  healthCheckInterval: Duration;
  logLevel: LogLevelOption;
  plugins: PluginConfigEntry[];
  providers: ProviderConfig[];
}

export interface ResourceUsage {
  cpu: number;
  memory: number;
  network: { bytesIn: number; bytesOut: number };
  tokens: { input: number; output: number };
}

export interface AgentProcess {
  id: string;
  agentId: AgentId;
  status: AgentStatus;
  pid: number | null;
  startTime: Timestamp;
  metadata: AgentMetadata;
  resources: ResourceUsage;
}

export interface RuntimeStats {
  activeAgents: number;
  completedTasks: number;
  failedTasks: number;
  avgLatency: Duration;
  uptime: Duration;
  memoryUsage: number;
}

export interface AgentContext {
  config: RuntimeConfig;
  protocolClient: {
    send(message: ACPMessage): Promise<void>;
    receive(): AsyncIterable<ACPMessage>;
  };
  memoryManager: MemoryStore;
  securityContext: SecurityContext;
  logger: {
    trace(msg: string, ...args: unknown[]): void;
    debug(msg: string, ...args: unknown[]): void;
    info(msg: string, ...args: unknown[]): void;
    warn(msg: string, ...args: unknown[]): void;
    error(msg: string, ...args: unknown[]): void;
  };
}
