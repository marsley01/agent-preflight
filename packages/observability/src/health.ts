import type { Duration, Timestamp } from "@agent-preflight/types";
import {
  type HealthCheckResult,
  type HealthCheckType,
  type HealthCheckConfig,
} from "./types.js";

export interface HealthCheckFunction {
  (): Promise<HealthCheckResult>;
}

interface RegisteredCheck {
  name: string;
  check: HealthCheckFunction;
  config: HealthCheckConfig;
  lastResult: HealthCheckResult | null;
  lastRun: Timestamp | null;
}

export class HealthRegistry {
  private checks: Map<string, RegisteredCheck> = new Map();
  private intervalIds: Map<string, ReturnType<typeof setInterval>> = new Map();

  register(
    name: string,
    check: HealthCheckFunction,
    config: Partial<HealthCheckConfig> = {},
  ): void {
    const resolvedConfig: HealthCheckConfig = {
      type: config.type ?? "liveness",
      timeout: config.timeout ?? 5000,
      interval: config.interval,
    };

    const registered: RegisteredCheck = {
      name,
      check,
      config: resolvedConfig,
      lastResult: null,
      lastRun: null,
    };

    this.checks.set(name, registered);

    if (resolvedConfig.interval && resolvedConfig.interval > 0) {
      this.startInterval(name, resolvedConfig.interval);
    }
  }

  unregister(name: string): void {
    this.stopInterval(name);
    this.checks.delete(name);
  }

  async runCheck(name: string): Promise<HealthCheckResult> {
    const registered = this.checks.get(name);
    if (!registered) {
      return {
        component: name,
        status: "fail",
        message: "No health check registered with this name",
        lastChecked: new Date().toISOString(),
        latency: 0,
      };
    }

    const start = performance.now();
    try {
      const timeoutPromise = new Promise<HealthCheckResult>((_, reject) => {
        setTimeout(() => reject(new Error("Health check timed out")), registered.config.timeout);
      });

      const result = await Promise.race([registered.check(), timeoutPromise]);
      registered.lastResult = result;
      registered.lastRun = result.lastChecked;
      return result;
    } catch (err) {
      const result: HealthCheckResult = {
        component: name,
        status: "fail",
        message: err instanceof Error ? err.message : "Health check threw",
        lastChecked: new Date().toISOString(),
        latency: performance.now() - start,
      };
      registered.lastResult = result;
      registered.lastRun = result.lastChecked;
      return result;
    }
  }

  async runAll(type?: HealthCheckType): Promise<HealthCheckResult[]> {
    const results: HealthCheckResult[] = [];
    for (const [name] of this.checks) {
      if (type && this.checks.get(name)?.config.type !== type) continue;
      const result = await this.runCheck(name);
      results.push(result);
    }
    return results;
  }

  async getAggregateHealth(type?: HealthCheckType): Promise<{
    status: "pass" | "warn" | "fail";
    results: HealthCheckResult[];
  }> {
    const results = await this.runAll(type);
    const hasFail = results.some((r) => r.status === "fail");
    const hasWarn = results.some((r) => r.status === "warn");

    const status = hasFail ? "fail" : hasWarn ? "warn" : "pass";
    return { status, results };
  }

  getLastResult(name: string): HealthCheckResult | null {
    return this.checks.get(name)?.lastResult ?? null;
  }

  generateStatusPage(): {
    healthy: boolean;
    summary: string;
    checks: HealthCheckResult[];
    timestamp: Timestamp;
  } {
    const results: HealthCheckResult[] = [];
    for (const [name] of this.checks) {
      const last = this.getLastResult(name);
      if (last) results.push(last);
    }
    const hasFail = results.some((r) => r.status === "fail");
    const healthyCount = results.filter((r) => r.status === "pass").length;
    return {
      healthy: !hasFail,
      summary: `${healthyCount}/${results.length} components healthy`,
      checks: results,
      timestamp: new Date().toISOString(),
    };
  }

  private startInterval(name: string, intervalMs: Duration): void {
    this.stopInterval(name);
    const id = setInterval(() => {
      void this.runCheck(name);
    }, intervalMs);
    this.intervalIds.set(name, id);
  }

  private stopInterval(name: string): void {
    const id = this.intervalIds.get(name);
    if (id) {
      clearInterval(id);
      this.intervalIds.delete(name);
    }
  }

  shutdown(): void {
    for (const [name] of this.intervalIds) {
      this.stopInterval(name);
    }
    this.checks.clear();
  }
}
