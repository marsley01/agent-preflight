import type { AgentId, AgentConfig } from "@agent-preflight/types";
import { AgentRegistry } from "./registry.js";
import type { RegistrationResult } from "./types.js";

export interface DiscoveryOptions {
  discoveryInterval: Duration;
  autoRegister: boolean;
  localDiscoveryEnabled: boolean;
  remoteDiscoveryEnabled: boolean;
  protocolBroadcastEnabled: boolean;
}

export interface DiscoveredAgent {
  agentId: AgentId;
  config: AgentConfig;
  source: "local" | "remote" | "protocol";
  discoveredAt: Timestamp;
}

type Duration = number;
type Timestamp = string;

export class DiscoveryService {
  private _registry: AgentRegistry;
  private _options: Required<DiscoveryOptions>;
  private _discovered: Map<string, DiscoveredAgent> = new Map();
  private _localInterval: ReturnType<typeof setInterval> | null = null;
  private _remoteInterval: ReturnType<typeof setInterval> | null = null;

  constructor(
    registry: AgentRegistry,
    options?: Partial<DiscoveryOptions>,
  ) {
    this._registry = registry;
    this._options = {
      discoveryInterval: options?.discoveryInterval ?? 60_000,
      autoRegister: options?.autoRegister ?? true,
      localDiscoveryEnabled: options?.localDiscoveryEnabled ?? true,
      remoteDiscoveryEnabled: options?.remoteDiscoveryEnabled ?? false,
      protocolBroadcastEnabled: options?.protocolBroadcastEnabled ?? false,
    };
  }

  async start(): Promise<void> {
    if (this._options.localDiscoveryEnabled) {
      await this.discoverLocalAgents();
      this._localInterval = setInterval(
        () => { void this.discoverLocalAgents(); },
        this._options.discoveryInterval,
      );
      this._localInterval!.unref();
    }

    if (this._options.remoteDiscoveryEnabled) {
      await this.discoverRemoteAgents();
      this._remoteInterval = setInterval(
        () => { void this.discoverRemoteAgents(); },
        this._options.discoveryInterval,
      );
      this._remoteInterval!.unref();
    }

    if (this._options.protocolBroadcastEnabled) {
      await this.discoverByProtocol();
    }
  }

  async stop(): Promise<void> {
    if (this._localInterval) {
      clearInterval(this._localInterval);
      this._localInterval = null;
    }
    if (this._remoteInterval) {
      clearInterval(this._remoteInterval);
      this._remoteInterval = null;
    }
  }

  async discoverLocalAgents(): Promise<DiscoveredAgent[]> {
    const localAgents = this._discoverFromRuntime();
    const results: DiscoveredAgent[] = [];

    for (const agent of localAgents) {
      const key = `${agent.agentId}:local`;
      this._discovered.set(key, agent);
      results.push(agent);

      if (this._options.autoRegister) {
        const existing = this._registry.get(agent.agentId);
        if (!existing) {
          await this._registry.register(agent.agentId, agent.config);
        }
      }
    }

    return results;
  }

  async discoverRemoteAgents(): Promise<DiscoveredAgent[]> {
    const remoteAgents = await this._discoverFromRegistryAPI();
    const results: DiscoveredAgent[] = [];

    for (const agent of remoteAgents) {
      const key = `${agent.agentId}:remote`;
      this._discovered.set(key, agent);
      results.push(agent);

      if (this._options.autoRegister) {
        const existing = this._registry.get(agent.agentId);
        if (!existing) {
          await this._registry.register(agent.agentId, agent.config);
        }
      }
    }

    return results;
  }

  async discoverByProtocol(): Promise<DiscoveredAgent[]> {
    const broadcastAgents = await this._discoverViaACPBroadcast();
    const results: DiscoveredAgent[] = [];

    for (const agent of broadcastAgents) {
      const key = `${agent.agentId}:protocol`;
      this._discovered.set(key, agent);
      results.push(agent);

      if (this._options.autoRegister) {
        const existing = this._registry.get(agent.agentId);
        if (!existing) {
          await this._registry.register(agent.agentId, agent.config);
        }
      }
    }

    return results;
  }

  getDiscoveredAgents(source?: "local" | "remote" | "protocol"): DiscoveredAgent[] {
    const all = Array.from(this._discovered.values());
    if (source) return all.filter((a) => a.source === source);
    return all;
  }

  async registerAllDiscovered(): Promise<RegistrationResult[]> {
    const results: RegistrationResult[] = [];
    for (const agent of this._discovered.values()) {
      const existing = this._registry.get(agent.agentId);
      if (!existing) {
        const result = await this._registry.register(agent.agentId, agent.config);
        results.push(result);
      }
    }
    return results;
  }

  clearDiscovered(): void {
    this._discovered.clear();
  }

  private _discoverFromRuntime(): DiscoveredAgent[] {
    const agents: DiscoveredAgent[] = [];
    const now = new Date().toISOString();

    try {
      const pid = process.pid;
      agents.push({
        agentId: `runtime-self-${pid}`,
        config: {
          id: `runtime-self-${pid}`,
          status: "IDLE",
          metadata: {
            name: `Runtime Process ${pid}`,
            description: "Auto-discovered local runtime agent",
            version: "0.1.0",
            tags: ["local", "runtime", "auto-discovered"],
            owner: "system",
            createdAt: now,
            updatedAt: now,
          },
          capabilities: {
            modelFamilies: [],
            maxContextLength: 4096,
            supportedMessageTypes: ["HEARTBEAT", "HEALTH_CHECK", "ACK"],
            streaming: false,
            functionCalling: false,
            memoryLayers: [],
            plugins: [],
            custom: ["runtime:local"],
          },
          dependencies: [],
          maxConcurrency: 10,
          maxQueueSize: 100,
          timeout: 30_000,
          retryPolicy: {
            maxRetries: 3,
            baseDelay: 1000,
            maxDelay: 30000,
            backoffFactor: 2,
          },
        },
        source: "local",
        discoveredAt: now,
      });
    } catch {
      return [];
    }

    return agents;
  }

  private async _discoverFromRegistryAPI(): Promise<DiscoveredAgent[]> {
    const now = new Date().toISOString();
    const remoteAgents: DiscoveredAgent[] = [];

    try {
      const existing = this._registry.list();
      for (const reg of existing) {
        remoteAgents.push({
          agentId: reg.agent.id,
          config: reg.agent,
          source: "remote",
          discoveredAt: now,
        });
      }
    } catch {
      return [];
    }

    return remoteAgents;
  }

  private async _discoverViaACPBroadcast(): Promise<DiscoveredAgent[]> {
    const now = new Date().toISOString();
    const broadcastAgents: DiscoveredAgent[] = [];

    try {
      const local = this._discoverFromRuntime();
      for (const agent of local) {
        broadcastAgents.push({
          ...agent,
          source: "protocol",
          discoveredAt: now,
        });
      }
    } catch {
      return [];
    }

    return broadcastAgents;
  }
}
