import type { AgentId, Timestamp, Duration, HealthStatus } from "@agent-preflight/types";

export interface HealthMonitorOptions {
  heartbeatTimeout: Duration;
  failureThreshold?: number;
  recoveryThreshold?: number;
  checkInterval?: Duration;
}

export interface HealthMetrics {
  uptime: Duration;
  errorRate: number;
  latency: number;
  responseRate: number;
}

interface AgentHealthState {
  consecutiveFailures: number;
  consecutiveSuccesses: number;
  lastStatus: "HEALTHY" | "UNHEALTHY" | "UNKNOWN";
  lastChecked: Timestamp;
  metricsHistory: HealthMetrics[];
}

export class HealthMonitor {
  private _options: Required<HealthMonitorOptions>;
  private _states: Map<string, AgentHealthState> = new Map();

  constructor(options: HealthMonitorOptions) {
    this._options = {
      heartbeatTimeout: options.heartbeatTimeout,
      failureThreshold: options.failureThreshold ?? 3,
      recoveryThreshold: options.recoveryThreshold ?? 2,
      checkInterval: options.checkInterval ?? 15_000,
    };
  }

  async check(
    agentId: AgentId,
    checkFn: () => Promise<HealthStatus>,
  ): Promise<HealthStatus> {
    const state = this._getOrCreateState(agentId);

    try {
      const status = await checkFn();
      state.lastChecked = new Date().toISOString();

      if (status.status === "HEALTHY") {
        state.consecutiveSuccesses++;
        state.consecutiveFailures = 0;
        state.lastStatus = "HEALTHY";
      } else {
        state.consecutiveFailures++;
        state.consecutiveSuccesses = 0;
        state.lastStatus = "UNHEALTHY";
      }

      return status;
    } catch (err) {
      state.consecutiveFailures++;
      state.consecutiveSuccesses = 0;
      state.lastStatus = "UNHEALTHY";
      state.lastChecked = new Date().toISOString();

      return {
        component: `agent:${agentId}`,
        status: "UNHEALTHY",
        message: err instanceof Error ? err.message : "Health check failed",
        lastChecked: state.lastChecked,
        latency: 0,
      };
    }
  }

  trackHeartbeat(
    agentId: AgentId,
    timestamp: Timestamp,
    healthy: boolean,
  ): void {
    const state = this._getOrCreateState(agentId);

    if (healthy) {
      state.consecutiveSuccesses++;
      state.consecutiveFailures = 0;
    } else {
      state.consecutiveFailures++;
      state.consecutiveSuccesses = 0;
    }

    state.lastChecked = timestamp;

    if (state.consecutiveSuccesses >= this._options.recoveryThreshold) {
      state.lastStatus = "HEALTHY";
    } else if (state.consecutiveFailures >= this._options.failureThreshold) {
      state.lastStatus = "UNHEALTHY";
    }
  }

  computeHealthScore(
    agentId: AgentId,
    metrics: HealthMetrics,
  ): number {
    const state = this._getOrCreateState(agentId);
    state.metricsHistory.push(metrics);

    if (state.metricsHistory.length > 100) {
      state.metricsHistory.shift();
    }

    let score = 100;

    const uptimePenalty = this._computeUptimePenalty(metrics.uptime);
    score -= uptimePenalty;

    const errorPenalty = metrics.errorRate * 50;
    score -= errorPenalty;

    const latencyPenalty = this._computeLatencyPenalty(metrics.latency);
    score -= latencyPenalty;

    const responseBonus = metrics.responseRate * 10;
    score += responseBonus;

    const consecutiveFailurePenalty = state.consecutiveFailures * 5;
    score -= consecutiveFailurePenalty;

    return Math.max(0, Math.min(100, Math.round(score)));
  }

  detectFailures(): Map<AgentId, HealthStatus> {
    const failures = new Map<AgentId, HealthStatus>();

    for (const [agentId, state] of this._states) {
      if (
        state.lastStatus === "UNHEALTHY"
        && state.consecutiveFailures >= this._options.failureThreshold
      ) {
        failures.set(agentId, {
          component: `agent:${agentId}`,
          status: "UNHEALTHY",
          message: `Agent failed ${state.consecutiveFailures} consecutive checks`,
          lastChecked: state.lastChecked,
          latency: 0,
        });
      }
    }

    return failures;
  }

  alertOnFailure(
    agentId: AgentId,
    alertFn: (status: HealthStatus) => void,
  ): void {
    const state = this._states.get(agentId);
    if (!state) return;

    if (
      state.lastStatus === "UNHEALTHY"
      && state.consecutiveFailures >= this._options.failureThreshold
    ) {
      alertFn({
        component: `agent:${agentId}`,
        status: "UNHEALTHY",
        message: `Agent ${agentId} has failed ${state.consecutiveFailures} consecutive checks`,
        lastChecked: state.lastChecked,
        latency: 0,
      });
    }
  }

  isHealthy(agentId: AgentId, lastHeartbeat: Timestamp): boolean {
    if (this.isHeartbeatExpired(agentId, lastHeartbeat)) return false;

    const state = this._states.get(agentId);
    if (!state) return true;

    return state.lastStatus !== "UNHEALTHY";
  }

  isHeartbeatExpired(_agentId: AgentId, lastHeartbeat: Timestamp): boolean {
    const elapsed = Date.now() - new Date(lastHeartbeat).getTime();
    return elapsed > this._options.heartbeatTimeout;
  }

  getState(agentId: AgentId): AgentHealthState | undefined {
    return this._states.get(agentId);
  }

  reset(agentId: AgentId): void {
    this._states.delete(agentId);
  }

  private _getOrCreateState(agentId: AgentId): AgentHealthState {
    let state = this._states.get(agentId);
    if (!state) {
      state = {
        consecutiveFailures: 0,
        consecutiveSuccesses: 0,
        lastStatus: "UNKNOWN",
        lastChecked: new Date().toISOString(),
        metricsHistory: [],
      };
      this._states.set(agentId, state);
    }
    return state;
  }

  private _computeUptimePenalty(uptime: Duration): number {
    if (uptime < 60_000) return 20;
    if (uptime < 300_000) return 10;
    if (uptime < 3_600_000) return 5;
    return 0;
  }

  private _computeLatencyPenalty(latency: number): number {
    if (latency > 10_000) return 30;
    if (latency > 5_000) return 20;
    if (latency > 1_000) return 10;
    if (latency > 500) return 5;
    return 0;
  }
}
