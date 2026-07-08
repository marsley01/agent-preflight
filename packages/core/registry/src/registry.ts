import { v4 as uuidv4 } from "uuid";
import type {
  AgentId, AgentConfig, AgentInfo, AgentStatus, AgentCapabilities,
  Timestamp, Duration, ModelProvider,
} from "@agent-preflight/types";
import type {
  AgentRegistration, RegistryQuery, RegistryStats, RegistrationResult,
  AgentVersionRecord, HeartbeatRecord,
} from "./types.js";
import { HealthMonitor } from "./health.js";
import { CapabilityMatcher } from "./capabilities.js";

export interface RegistryOptions {
  heartbeatTimeout: Duration;
  healthDecayInterval: Duration;
  maxVersionsPerAgent: number;
  enableAutoDeregister: boolean;
}

export class AgentRegistry {
  private _agents: Map<string, AgentRegistration> = new Map();
  private _versions: Map<string, AgentVersionRecord[]> = new Map();
  private _heartbeats: Map<string, HeartbeatRecord> = new Map();
  private _capabilityIndices: Map<string, AgentCapabilities> = new Map();
  private _options: Required<RegistryOptions>;
  private _healthMonitor: HealthMonitor;
  private _capabilityMatcher: CapabilityMatcher;
  private _startTime: Timestamp;
  private _decayTimer: ReturnType<typeof setInterval> | null = null;

  constructor(options?: Partial<RegistryOptions>) {
    this._options = {
      heartbeatTimeout: options?.heartbeatTimeout ?? 60_000,
      healthDecayInterval: options?.healthDecayInterval ?? 30_000,
      maxVersionsPerAgent: options?.maxVersionsPerAgent ?? 10,
      enableAutoDeregister: options?.enableAutoDeregister ?? true,
    };
    this._healthMonitor = new HealthMonitor({
      heartbeatTimeout: this._options.heartbeatTimeout,
    });
    this._capabilityMatcher = new CapabilityMatcher();
    this._startTime = new Date().toISOString();

    if (this._options.enableAutoDeregister) {
      this._startHealthDecay();
    }
  }

  async register(
    agentId: AgentId,
    config: AgentConfig,
  ): Promise<RegistrationResult> {
    try {
      if (this._agents.has(agentId)) {
        const existing = this._agents.get(agentId)!;
        const reg: AgentRegistration = {
          ...existing,
          agent: config,
          registeredAt: new Date().toISOString(),
          lastHeartbeat: new Date().toISOString(),
        };
        this._agents.set(agentId, reg);
        this._trackVersion(agentId, config);
        this._capabilityIndices.set(agentId, config.capabilities);
        return { success: true, agentId, registryId: reg.registryId };
      }

      const registryId = uuidv4();
      const now = new Date().toISOString();
      const registration: AgentRegistration = {
        agent: config,
        registryId,
        registeredAt: now,
        lastHeartbeat: now,
        healthScore: 100,
        trustScore: 50,
      };

      this._agents.set(agentId, registration);
      this._trackVersion(agentId, config);
      this._capabilityIndices.set(agentId, config.capabilities);

      return { success: true, agentId, registryId };
    } catch (err) {
      return {
        success: false,
        error: {
          code: "REGISTRATION_FAILED",
          message: err instanceof Error ? err.message : "Unknown error",
        },
      };
    }
  }

  async deregister(agentId: AgentId): Promise<RegistrationResult> {
    const agent = this._agents.get(agentId);
    if (!agent) {
      return {
        success: false,
        error: { code: "AGENT_NOT_FOUND", message: `Agent ${agentId} not found in registry` },
      };
    }

    this._agents.delete(agentId);
    this._capabilityIndices.delete(agentId);
    this._heartbeats.delete(agentId);

    return { success: true, agentId, registryId: agent.registryId };
  }

  async update(
    agentId: AgentId,
    updates: Partial<AgentConfig>,
  ): Promise<RegistrationResult> {
    const existing = this._agents.get(agentId);
    if (!existing) {
      return {
        success: false,
        error: { code: "AGENT_NOT_FOUND", message: `Agent ${agentId} not found` },
      };
    }

    const merged: AgentConfig = {
      ...existing.agent,
      ...updates,
      metadata: { ...existing.agent.metadata, ...updates.metadata },
      capabilities: { ...existing.agent.capabilities, ...updates.capabilities },
    };

    existing.agent = merged;
    if (updates.capabilities) {
      this._capabilityIndices.set(agentId, merged.capabilities);
    }

    return { success: true, agentId, registryId: existing.registryId };
  }

  get(agentId: AgentId): AgentRegistration | undefined {
    return this._agents.get(agentId);
  }

  getInfo(agentId: AgentId): AgentInfo | undefined {
    const reg = this._agents.get(agentId);
    if (!reg) return undefined;

    const lastHeartbeat = this._heartbeats.get(agentId);
    const healthy = this._healthMonitor.isHealthy(agentId, reg.lastHeartbeat);

    return {
      id: reg.agent.id,
      name: reg.agent.metadata.name ?? reg.agent.id,
      description: reg.agent.metadata.description ?? "",
      version: reg.agent.metadata.version ?? "0.0.0",
      status: reg.agent.status,
      capabilities: reg.agent.capabilities,
      metadata: reg.agent.metadata,
      healthy,
      lastSeen: lastHeartbeat?.timestamp ?? reg.lastHeartbeat,
    };
  }

  query(query: RegistryQuery): AgentInfo[] {
    let results = Array.from(this._agents.values());

    if (query.status) {
      const statuses = Array.isArray(query.status) ? query.status : [query.status];
      results = results.filter((r) => statuses.includes(r.agent.status));
    }

    if (query.capability) {
      const required = Array.isArray(query.capability) ? query.capability : [query.capability];
      results = results.filter((r) => {
        const caps = r.agent.capabilities;
        return required.every((c: string) =>
          caps.modelFamilies.some((f: string) => f.toLowerCase().includes(c.toLowerCase()))
          || caps.custom.some((cu: string) => cu.toLowerCase().includes(c.toLowerCase()))
          || caps.plugins.some((p: string) => p.toLowerCase().includes(c.toLowerCase())),
        );
      });
    }

    if (query.provider) {
      const providers = Array.isArray(query.provider) ? query.provider : [query.provider];
      results = results.filter((r) => {
        const agentProvider = r.agent.metadata.custom?.["provider"] as ModelProvider | undefined;
        return agentProvider ? providers.includes(agentProvider) : false;
      });
    }

    if (query.minHealth !== undefined) {
      results = results.filter((r) => r.healthScore >= (query.minHealth ?? 0));
    }

    if (query.tags && query.tags.length > 0) {
      results = results.filter((r) => {
        const tags = r.agent.metadata.tags ?? [];
        return query.tags!.some((t) => tags.includes(t));
      });
    }

    if (query.owner) {
      results = results.filter((r) => r.agent.metadata.owner === query.owner);
    }

    return results.map((r) => {
      const hb = this._heartbeats.get(r.agent.id);
      const healthy = this._healthMonitor.isHealthy(r.agent.id, r.lastHeartbeat);
      return {
        id: r.agent.id,
        name: r.agent.metadata.name ?? r.agent.id,
        description: r.agent.metadata.description ?? "",
        version: r.agent.metadata.version ?? "0.0.0",
        status: r.agent.status,
        capabilities: r.agent.capabilities,
        metadata: r.agent.metadata,
        healthy,
        lastSeen: hb?.timestamp ?? r.lastHeartbeat,
      };
    });
  }

  list(): AgentRegistration[] {
    return Array.from(this._agents.values());
  }

  getStats(): RegistryStats {
    const byStatus: Partial<Record<AgentStatus, number>> = {};
    const byProvider: Partial<Record<ModelProvider, number>> = {};
    const byCapability: Record<string, number> = {};
    let totalHealth = 0;

    for (const reg of this._agents.values()) {
      byStatus[reg.agent.status] = (byStatus[reg.agent.status] ?? 0) + 1;
      totalHealth += reg.healthScore;

      for (const family of reg.agent.capabilities.modelFamilies) {
        byCapability[family] = (byCapability[family] ?? 0) + 1;
      }
      for (const custom of reg.agent.capabilities.custom) {
        byCapability[custom] = (byCapability[custom] ?? 0) + 1;
      }
    }

    const count = this._agents.size;
    return {
      totalAgents: count,
      byStatus,
      byProvider,
      byCapability,
      avgHealth: count > 0 ? totalHealth / count : 0,
      uptime: Date.now() - new Date(this._startTime).getTime(),
    };
  }

  processHeartbeat(
    agentId: AgentId,
    status: AgentStatus,
    load: number,
    uptime: Duration,
    healthy: boolean,
  ): void {
    const reg = this._agents.get(agentId);
    if (!reg) return;

    const now = new Date().toISOString();
    reg.lastHeartbeat = now;
    if (status) reg.agent.status = status;

    const record: HeartbeatRecord = {
      agentId, timestamp: now, status, load, uptime, healthy,
    };
    this._heartbeats.set(agentId, record);

    const score = this._healthMonitor.computeHealthScore(agentId, {
      uptime,
      errorRate: status === "ERROR" ? 1 : 0,
      latency: load,
      responseRate: healthy ? 1 : 0,
    });
    reg.healthScore = score;
    reg.trustScore = Math.min(100, reg.trustScore + (healthy ? 0.5 : -2));
  }

  getVersions(agentId: AgentId): AgentVersionRecord[] {
    return this._versions.get(agentId) ?? [];
  }

  findAgentsByCapability(required: string[]): AgentInfo[] {
    const candidates = Array.from(this._agents.values()).map((r) => ({
      agentId: r.agent.id,
      capabilities: r.agent.capabilities,
    }));

    const matches = this._capabilityMatcher.match(candidates, required);
    const agentIds = new Set(matches.map((m) => m.agentId));

    return Array.from(this._agents.values())
      .filter((r) => agentIds.has(r.agent.id))
      .map((r) => this.getInfo(r.agent.id)!)
      .filter((info): info is AgentInfo => info !== undefined);
  }

  findBestAgentForCapability(required: string[]): AgentInfo | undefined {
    const candidates = Array.from(this._agents.values()).map((r) => ({
      agentId: r.agent.id,
      capabilities: r.agent.capabilities,
    }));

    const best = this._capabilityMatcher.findBestMatch(candidates, required);
    if (!best) return undefined;
    return this.getInfo(best.agentId);
  }

  detectUnhealthyAgents(): AgentId[] {
    const unhealthy: AgentId[] = [];
    for (const [agentId, reg] of this._agents) {
      const expired = this._healthMonitor.isHeartbeatExpired(agentId, reg.lastHeartbeat);
      if (expired || reg.healthScore < 20) {
        unhealthy.push(agentId);
      }
    }
    return unhealthy;
  }

  async shutdown(): Promise<void> {
    if (this._decayTimer) {
      clearInterval(this._decayTimer);
      this._decayTimer = null;
    }
    this._agents.clear();
    this._versions.clear();
    this._heartbeats.clear();
    this._capabilityIndices.clear();
  }

  private _trackVersion(agentId: AgentId, config: AgentConfig): void {
    const version = config.metadata.version ?? "0.0.0";
    const existing = this._versions.get(agentId) ?? [];

    const record: AgentVersionRecord = {
      agentId,
      version,
      registeredAt: new Date().toISOString(),
      config,
      healthy: true,
    };

    existing.push(record);
    if (existing.length > this._options.maxVersionsPerAgent) {
      existing.shift();
    }
    this._versions.set(agentId, existing);
  }

  private _startHealthDecay(): void {
    this._decayTimer = setInterval(() => {
      for (const [agentId, reg] of this._agents) {
        const expired = this._healthMonitor.isHeartbeatExpired(agentId, reg.lastHeartbeat);
        if (expired) {
          reg.healthScore = Math.max(0, reg.healthScore - 5);
          reg.trustScore = Math.max(0, reg.trustScore - 2);

          if (reg.healthScore <= 0) {
            void this.deregister(agentId);
          }
        }
      }
    }, this._options.healthDecayInterval);
    this._decayTimer.unref();
  }
}
