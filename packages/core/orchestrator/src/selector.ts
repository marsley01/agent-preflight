import type {
  AgentId,
  Duration,
  AgentCapabilities,
  AgentInfo,
  AgentStatus,
  Timestamp,
} from "@agent-preflight/types";
import type {
  AgentSelectorStrategy,
  AgentSelectionCriteria,
  AgentScore,
} from "./types.js";
import { AgentSelectionError } from "./errors.js";

export interface AgentSelectorOptions {
  strategy: AgentSelectorStrategy;
  preferredAgentId?: AgentId | undefined;
  weights?: Partial<Record<"capability" | "cost" | "latency" | "load" | "reliability", number>>;
}

interface AgentRuntimeInfo {
  agentId: AgentId;
  name: string;
  capabilities: string[];
  status: AgentStatus;
  currentLoad: number;
  maxConcurrency: number;
  avgLatency: Duration;
  costPerTask: number;
  successRate: number;
  lastSeen: Timestamp;
  modelFamilies: string[];
  supportsStreaming: boolean;
  supportsFunctionCalling: boolean;
}

export class AgentSelector {
  private readonly strategy: AgentSelectorStrategy;
  private readonly preferredAgentId?: AgentId;
  private readonly weights: Required<NonNullable<AgentSelectorOptions["weights"]>>;
  private roundRobinIndex = 0;

  constructor(options: AgentSelectorOptions) {
    this.strategy = options.strategy;
    this.preferredAgentId = options.preferredAgentId;
    this.weights = {
      capability: options.weights?.capability ?? 0.35,
      cost: options.weights?.cost ?? 0.15,
      latency: options.weights?.latency ?? 0.15,
      load: options.weights?.load ?? 0.2,
      reliability: options.weights?.reliability ?? 0.15,
    };
  }

  selectAgent(
    agents: AgentRuntimeInfo[],
    criteria: AgentSelectionCriteria,
  ): AgentRuntimeInfo {
    if (agents.length === 0) {
      throw new AgentSelectionError("No agents available for selection");
    }

    const filtered = this.filterByCriteria(agents, criteria);
    if (filtered.length === 0) {
      throw new AgentSelectionError(
        `No agents match the selection criteria: ${JSON.stringify(criteria)}`,
      );
    }

    switch (this.strategy) {
      case "ROUND_ROBIN":
        return this.roundRobin(filtered);
      case "LEAST_BUSY":
        return this.leastBusy(filtered);
      case "FASTEST":
        return this.fastest(filtered);
      case "CHEAPEST":
        return this.cheapest(filtered);
      case "MOST_CAPABLE":
        return this.mostCapable(filtered, criteria);
      case "PREFERRED":
        return this.preferred(filtered, criteria);
      default:
        return this.weightedScore(filtered, criteria);
    }
  }

  rankAgents(
    agents: AgentRuntimeInfo[],
    criteria: AgentSelectionCriteria,
  ): AgentScore[] {
    const filtered = this.filterByCriteria(agents, criteria);
    return filtered.map((agent) => this.scoreAgent(agent, criteria));
  }

  setStrategy(strategy: AgentSelectorStrategy): void {
    this.strategy = strategy;
  }

  // ----- private -----

  private filterByCriteria(
    agents: AgentRuntimeInfo[],
    criteria: AgentSelectionCriteria,
  ): AgentRuntimeInfo[] {
    return agents.filter((a) => {
      if (a.status !== "IDLE" && a.status !== "BUSY") return false;

      if (criteria.excludeAgentIds?.includes(a.agentId)) return false;

      if (criteria.requiredCapabilities.length > 0) {
        const hasAll = criteria.requiredCapabilities.every((req) =>
          a.capabilities.some(
            (cap) => cap.toUpperCase() === req.toUpperCase(),
          ),
        );
        if (!hasAll) return false;
      }

      if (criteria.maxCost != null && a.costPerTask > criteria.maxCost) {
        return false;
      }

      if (criteria.maxLatency != null && a.avgLatency > criteria.maxLatency) {
        return false;
      }

      if (criteria.requireStreaming && !a.supportsStreaming) return false;

      if (criteria.requireFunctionCalling && !a.supportsFunctionCalling) {
        return false;
      }

      if (criteria.modelFamilies && criteria.modelFamilies.length > 0) {
        const hasModelFamily = criteria.modelFamilies.some((m) =>
          a.modelFamilies.includes(m),
        );
        if (!hasModelFamily) return false;
      }

      if (a.currentLoad >= a.maxConcurrency) return false;

      return true;
    });
  }

  private roundRobin(agents: AgentRuntimeInfo[]): AgentRuntimeInfo {
    const idx = this.roundRobinIndex % agents.length;
    this.roundRobinIndex = (this.roundRobinIndex + 1) % agents.length;
    return agents[idx]!;
  }

  private leastBusy(agents: AgentRuntimeInfo[]): AgentRuntimeInfo {
    return agents.reduce((best, agent) => {
      const bestLoad = best.currentLoad / best.maxConcurrency;
      const agentLoad = agent.currentLoad / agent.maxConcurrency;
      return agentLoad < bestLoad ? agent : best;
    });
  }

  private fastest(agents: AgentRuntimeInfo[]): AgentRuntimeInfo {
    return agents.reduce((best, agent) =>
      agent.avgLatency < best.avgLatency ? agent : best,
    );
  }

  private cheapest(agents: AgentRuntimeInfo[]): AgentRuntimeInfo {
    return agents.reduce((best, agent) =>
      agent.costPerTask < best.costPerTask ? agent : best,
    );
  }

  private mostCapable(
    agents: AgentRuntimeInfo[],
    criteria: AgentSelectionCriteria,
  ): AgentRuntimeInfo {
    return agents.reduce((best, agent) => {
      const bestScore = this.countCapabilityOverlap(
        best,
        criteria.requiredCapabilities,
      );
      const agentScore = this.countCapabilityOverlap(
        agent,
        criteria.requiredCapabilities,
      );
      return agentScore > bestScore ? agent : best;
    });
  }

  private preferred(
    agents: AgentRuntimeInfo[],
    criteria: AgentSelectionCriteria,
  ): AgentRuntimeInfo {
    const preferredId = criteria.preferredAgentId ?? this.preferredAgentId;
    if (preferredId) {
      const preferred = agents.find((a) => a.agentId === preferredId);
      if (preferred) return preferred;
    }
    return this.weightedScore(agents, criteria);
  }

  private weightedScore(
    agents: AgentRuntimeInfo[],
    criteria: AgentSelectionCriteria,
  ): AgentRuntimeInfo {
    const scored = agents.map((agent) => this.scoreAgent(agent, criteria));
    scored.sort((a, b) => b.score - a.score);
    return agents.find((a) => a.agentId === scored[0]!.agentId)!;
  }

  private scoreAgent(
    agent: AgentRuntimeInfo,
    criteria: AgentSelectionCriteria,
  ): AgentScore {
    const breakdown: Record<string, number> = {};

    const capabilityScore =
      criteria.requiredCapabilities.length > 0
        ? this.countCapabilityOverlap(agent, criteria.requiredCapabilities) /
          criteria.requiredCapabilities.length
        : 0.7;
    breakdown.capability = capabilityScore;

    const costScore = Math.max(0, 1 - agent.costPerTask / 100);
    breakdown.cost = costScore;

    const maxLatency = criteria.maxLatency ?? 60000;
    const latencyScore = Math.max(0, 1 - agent.avgLatency / maxLatency);
    breakdown.latency = latencyScore;

    const loadScore = 1 - agent.currentLoad / agent.maxConcurrency;
    breakdown.load = loadScore;

    const reliabilityScore = agent.successRate;
    breakdown.reliability = reliabilityScore;

    const totalScore =
      (capabilityScore * this.weights.capability) +
      (costScore * this.weights.cost) +
      (latencyScore * this.weights.latency) +
      (loadScore * this.weights.load) +
      (reliabilityScore * this.weights.reliability);

    return {
      agentId: agent.agentId,
      score: totalScore,
      breakdown,
      reasoning: `capability=${capabilityScore.toFixed(2)}, cost=${costScore.toFixed(2)}, latency=${latencyScore.toFixed(2)}, load=${loadScore.toFixed(2)}, reliability=${reliabilityScore.toFixed(2)}`,
    };
  }

  private countCapabilityOverlap(
    agent: AgentRuntimeInfo,
    required: string[],
  ): number {
    return required.filter((req) =>
      agent.capabilities.some((cap) => cap.toUpperCase() === req.toUpperCase()),
    ).length;
  }
}
