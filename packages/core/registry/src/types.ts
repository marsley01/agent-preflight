import type {
  AgentId, AgentConfig, AgentStatus, Timestamp, Duration, ModelProvider, Version, ErrorDetail,
} from "@agent-preflight/types";

export interface AgentRegistration {
  agent: AgentConfig;
  registryId: string;
  registeredAt: Timestamp;
  lastHeartbeat: Timestamp;
  healthScore: number;
  trustScore: number;
}

export interface RegistryQuery {
  status?: AgentStatus | AgentStatus[] | undefined;
  capability?: string | string[] | undefined;
  provider?: ModelProvider | ModelProvider[] | undefined;
  model?: string | undefined;
  minHealth?: number | undefined;
  tags?: string[] | undefined;
  owner?: string | undefined;
}

export interface RegistryStats {
  totalAgents: number;
  byStatus: Partial<Record<AgentStatus, number>>;
  byProvider: Partial<Record<ModelProvider, number>>;
  byCapability: Record<string, number>;
  avgHealth: number;
  uptime: Duration;
}

export interface RegistrationResult {
  success: boolean;
  agentId?: AgentId | undefined;
  registryId?: string | undefined;
  error?: ErrorDetail | undefined;
}

export interface AgentVersionRecord {
  agentId: AgentId;
  version: Version;
  registeredAt: Timestamp;
  config: AgentConfig;
  healthy: boolean;
}

export interface HeartbeatRecord {
  agentId: AgentId;
  timestamp: Timestamp;
  status: AgentStatus;
  load: number;
  uptime: Duration;
  healthy: boolean;
}
