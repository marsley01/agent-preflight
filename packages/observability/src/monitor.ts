import type { Timestamp, AgentId } from "@agent-preflight/types";
import { Tracer, type SpanExporter, BatchSpanProcessor } from "./tracing.js";
import {
  MetricsRegistry,
  type Counter,
  type Gauge,
  type Histogram,
  type MetricExporter,
} from "./metrics.js";
import { ObservabilityLogger } from "./logger.js";
import { HealthRegistry } from "./health.js";
import type { AlertThreshold, ExporterConfig } from "./types.js";

export interface MonitorConfig {
  serviceName: string;
  environment?: string | undefined;
  version?: string | undefined;
  exporters?: {
    tracing?: ExporterConfig | undefined;
    metrics?: ExporterConfig | undefined;
    logging?: ExporterConfig | undefined;
  } | undefined;
  collectionIntervalMs?: number | undefined;
  alertThresholds?: AlertThreshold[] | undefined;
}

export interface SystemMetrics {
  latency: Gauge;
  cost: Counter;
  toolCalls: Counter;
  memoryUsage: Gauge;
  executionTime: Histogram;
  tokenCount: Counter;
  errorRate: Gauge;
  queueDepth: Gauge;
  activeAgents: Gauge;
}

export class Monitor {
  readonly config: MonitorConfig;
  readonly tracer: Tracer;
  readonly metrics: MetricsRegistry;
  readonly logger: ObservabilityLogger;
  readonly health: HealthRegistry;
  readonly systemMetrics: SystemMetrics;
  private alertThresholds: AlertThreshold[];
  private alertCooldowns: Map<string, Timestamp> = new Map();

  constructor(config: MonitorConfig) {
    this.config = config;
    this.alertThresholds = config.alertThresholds ?? [];

    this.tracer = new Tracer(undefined, {
      resource: {
        "service.name": config.serviceName,
        "deployment.environment": config.environment ?? "development",
        "service.version": config.version ?? "0.1.0",
      },
    });

    this.metrics = new MetricsRegistry();
    this.logger = new ObservabilityLogger(config.serviceName);
    this.health = new HealthRegistry();

    this.systemMetrics = this.createSystemMetrics();

    if (config.exporters?.tracing) {
      const exporter = this.createSpanExporter(config.exporters.tracing);
      const processor = new BatchSpanProcessor(
        exporter,
        config.exporters.tracing.batchSize ?? 64,
        config.exporters.tracing.batchInterval ?? 5000,
      );
      void processor;
    }

    if (config.exporters?.metrics) {
      const exporter = this.createMetricExporter(config.exporters.metrics);
      this.metrics.addExporter(exporter);
    }

    this.metrics.startCollection(config.collectionIntervalMs ?? 15000);

    this.registerDefaultHealthChecks();
  }

  private createSystemMetrics(): SystemMetrics {
    return {
      latency: this.metrics.createGauge("task_duration", { unit: "ms", description: "Task execution duration" }),
      cost: this.metrics.createCounter("cost_tracking", { unit: "usd", description: "Accumulated cost" }),
      toolCalls: this.metrics.createCounter("tool_calls_total", { description: "Total tool calls made" }),
      memoryUsage: this.metrics.createGauge("memory_usage", { unit: "bytes", description: "Current memory usage" }),
      executionTime: this.metrics.createHistogram("execution_time", { unit: "ms", description: "Execution time distribution" }),
      tokenCount: this.metrics.createCounter("token_count", { unit: "tokens", description: "Total tokens consumed" }),
      errorRate: this.metrics.createGauge("error_rate", { description: "Current error rate (0-1)" }),
      queueDepth: this.metrics.createGauge("queue_depth", { description: "Current queue depth" }),
      activeAgents: this.metrics.createGauge("active_agents", { description: "Number of active agents" }),
    };
  }

  recordLatency(durationMs: number, attributes?: Record<string, string>): void {
    this.systemMetrics.latency.record(durationMs, attributes);
    this.systemMetrics.executionTime.record(durationMs, attributes);
  }

  recordCost(amount: number, attributes?: Record<string, string>): void {
    this.systemMetrics.cost.add(amount, attributes);
  }

  recordToolCall(attributes?: Record<string, string>): void {
    this.systemMetrics.toolCalls.add(1, attributes);
  }

  recordMemoryUsage(bytes: number, attributes?: Record<string, string>): void {
    this.systemMetrics.memoryUsage.record(bytes, attributes);
  }

  recordTokenCount(count: number, attributes?: Record<string, string>): void {
    this.systemMetrics.tokenCount.add(count, attributes);
  }

  recordErrorRate(rate: number, attributes?: Record<string, string>): void {
    this.systemMetrics.errorRate.record(rate, attributes);
  }

  setQueueDepth(depth: number, attributes?: Record<string, string>): void {
    this.systemMetrics.queueDepth.record(depth, attributes);
  }

  setActiveAgents(count: number, attributes?: Record<string, string>): void {
    this.systemMetrics.activeAgents.record(count, attributes);
  }

  trackHallucinationScore(agentId: AgentId, score: number): void {
    this.logger.info(`Hallucination score for agent ${agentId}: ${score}`, {
      agentId,
      hallucinationScore: score,
      metric: "hallucination_score",
    });
  }

  trackConfidence(agentId: AgentId, confidence: number): void {
    this.logger.info(`Confidence for agent ${agentId}: ${confidence}`, {
      agentId,
      confidence,
      metric: "confidence",
    });
  }

  trackProviderHealth(provider: string, healthy: boolean, latencyMs: number): void {
    this.logger.info(`Provider ${provider} health: ${healthy ? "up" : "down"} (${latencyMs}ms)`, {
      provider,
      healthy,
      latencyMs,
      metric: "provider_health",
    });
  }

  trackModelHealth(model: string, healthy: boolean, errorRate: number): void {
    this.logger.info(`Model ${model} health: ${healthy ? "up" : "down"} (error rate: ${errorRate})`, {
      model,
      healthy,
      errorRate,
      metric: "model_health",
    });
  }

  calculateFailureRate(totalRequests: number, failedRequests: number): number {
    if (totalRequests === 0) return 0;
    const rate = failedRequests / totalRequests;
    this.recordErrorRate(rate);
    return rate;
  }

  setAlertThresholds(thresholds: AlertThreshold[]): void {
    this.alertThresholds = thresholds;
  }

  checkAlerts(metrics: Record<string, number>): Array<{
    threshold: AlertThreshold;
    currentValue: number;
    triggered: boolean;
  }> {
    const now = new Date().toISOString();
    return this.alertThresholds.map((threshold) => {
      const currentValue = metrics[threshold.metric];
      if (currentValue === undefined) {
        return { threshold, currentValue: 0, triggered: false };
      }

      let triggered = false;
      switch (threshold.operator) {
        case "gt": triggered = currentValue > threshold.value; break;
        case "lt": triggered = currentValue < threshold.value; break;
        case "gte": triggered = currentValue >= threshold.value; break;
        case "lte": triggered = currentValue <= threshold.value; break;
        case "eq": triggered = currentValue === threshold.value; break;
      }

      if (triggered) {
        const cooldownKey = `${threshold.metric}:${threshold.operator}:${threshold.value}`;
        const lastAlert = this.alertCooldowns.get(cooldownKey);
        if (lastAlert) {
          const cooldownEnd = new Date(lastAlert).getTime() + threshold.cooldown;
          if (Date.now() < cooldownEnd) {
            return { threshold, currentValue, triggered: false };
          }
        }
        this.alertCooldowns.set(cooldownKey, now);
        this.logger.warn(`Alert triggered: ${threshold.metric} ${threshold.operator} ${threshold.value} (current: ${currentValue})`, {
          metric: threshold.metric,
          operator: threshold.operator,
          threshold: threshold.value,
          currentValue,
        });
      }

      return { threshold, currentValue, triggered };
    });
  }

  private registerDefaultHealthChecks(): void {
    this.health.register(
      "memory",
      async () => {
        const usage = process.memoryUsage();
        this.recordMemoryUsage(usage.heapUsed);
        return {
          component: "memory",
          status: usage.heapUsed < 1_073_741_824 ? "pass" : "warn",
          message: `Heap used: ${Math.round(usage.heapUsed / 1024 / 1024)}MB`,
          lastChecked: new Date().toISOString(),
          latency: 0,
        };
      },
      { type: "liveness", timeout: 1000, interval: 30000 },
    );
  }

  private createSpanExporter(_config: ExporterConfig): SpanExporter {
    if (_config.type === "OTLP") {
      return {
        export: async (_spans) => {},
        shutdown: async () => {},
      };
    }
    return {
      export: async (spans) => {
        for (const span of spans) {
          this.logger.info(`Span: ${span.name}`, { spanId: span.spanId, traceId: span.traceId });
        }
      },
      shutdown: async () => {},
    };
  }

  private createMetricExporter(_config: ExporterConfig): MetricExporter {
    return {
      export: async (points) => {
        for (const point of points) {
          this.logger.info(`Metric: ${point.name} = ${String(point.value)}`);
        }
      },
      shutdown: async () => {},
    };
  }

  async shutdown(): Promise<void> {
    await this.tracer.shutdown();
    await this.metrics.shutdown();
    await this.logger.shutdown();
    this.health.shutdown();
  }
}
