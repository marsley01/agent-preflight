import type { Timestamp } from "@agent-preflight/types";
import type { AnalyticsEvent, AnalyticsEventType, TimeRange } from "./types.js";
import { AggregationFunction } from "./types.js";
import { MetricsAggregator } from "./aggregator.js";

export interface AnomalyResult {
  metric: string;
  currentValue: number;
  expectedValue: number;
  deviation: number;
  severity: "low" | "medium" | "high";
  timestamp: Timestamp;
  dimensions?: Record<string, string> | undefined;
}

export interface TrendResult {
  metric: string;
  direction: "up" | "down" | "stable";
  magnitude: number;
  percentage: number;
  period: { start: Timestamp; end: Timestamp };
  confidence: number;
}

export interface RecommendationResult {
  id: string;
  type: "cost" | "performance" | "reliability" | "security" | "efficiency";
  title: string;
  description: string;
  impact: "low" | "medium" | "high";
  effort: "low" | "medium" | "high";
  metrics: string[];
}

export interface CostAnalysis {
  total: number;
  byProvider: Record<string, number>;
  byModel: Record<string, number>;
  byAgent: Record<string, number>;
  byTaskType: Record<string, number>;
  timeRange: TimeRange;
  projected: number;
}

export interface PerformanceAnalysis {
  averageLatency: number;
  p95Latency: number;
  p99Latency: number;
  throughput: number;
  errorRate: number;
  bottlenecks: string[];
  recommendations: string[];
}

export interface UsagePattern {
  pattern: string;
  frequency: number;
  percentage: number;
  agents: string[];
  taskTypes: string[];
  timeDistribution: Record<string, number>;
}

export class InsightsEngine {
  private aggregator: MetricsAggregator;

  constructor(aggregator?: MetricsAggregator | undefined) {
    this.aggregator = aggregator ?? new MetricsAggregator();
  }

  detectAnomalies(
    events: AnalyticsEvent[],
    metricField: string,
    timeRange: TimeRange,
    sensitivity: number = 2.0,
  ): AnomalyResult[] {
    const metrics = this.aggregator.aggregate(events, metricField, AggregationFunction.AVG, timeRange, {
      bucketSize: "1h",
    });

    if (metrics.length < 4) return [];

    const values = metrics.map((m) => m.value);
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const stdDev = Math.sqrt(values.reduce((sq, v) => sq + (v - mean) ** 2, 0) / values.length);
    const threshold = stdDev * sensitivity;

    return metrics
      .filter((m) => Math.abs(m.value - mean) > threshold)
      .map((m) => ({
        metric: metricField,
        currentValue: m.value,
        expectedValue: mean,
        deviation: m.value - mean,
        severity: (Math.abs(m.value - mean) / stdDev) > 3 ? "high" : (Math.abs(m.value - mean) / stdDev) > 2 ? "medium" : "low",
        timestamp: m.timestamp,
        dimensions: m.dimensions,
      }));
  }

  identifyTrends(
    events: AnalyticsEvent[],
    metricField: string,
    timeRange: TimeRange,
  ): TrendResult[] {
    const timeBuckets = this.aggregator.timeBuckets(events, metricField, AggregationFunction.AVG, "1h", timeRange);

    if (timeBuckets.length < 3) return [];

    const values = timeBuckets.map((b) => b.metrics[0]?.value ?? 0);
    const mid = Math.floor(values.length / 2);
    const firstHalf = values.slice(0, mid);
    const secondHalf = values.slice(mid);

    const firstAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;

    const diff = secondAvg - firstAvg;
    const magnitude = Math.abs(diff);
    const percentage = firstAvg !== 0 ? (diff / firstAvg) * 100 : 0;

    let direction: "up" | "down" | "stable";
    if (Math.abs(percentage) < 5) {
      direction = "stable";
    } else {
      direction = diff > 0 ? "up" : "down";
    }

    const confidence = Math.min(Math.abs(percentage) / 100, 1);

    return [{
      metric: metricField,
      direction,
      magnitude,
      percentage,
      period: {
        start: timeBuckets[0]!.start,
        end: timeBuckets[timeBuckets.length - 1]!.end,
      },
      confidence,
    }];
  }

  generateRecommendations(
    events: AnalyticsEvent[],
    options?: Partial<{
      costThreshold: number;
      latencyThreshold: number;
      errorRateThreshold: number;
    }> | undefined,
  ): RecommendationResult[] {
    const recommendations: RecommendationResult[] = [];

    const costEvents = events.filter((e) => e.name === "cost_recorded" || e.properties["cost"] !== undefined);
    if (costEvents.length > 0) {
      const totalCost = costEvents.reduce((sum, e) => sum + (e.properties["cost"] as number ?? 0), 0);
      if (totalCost > (options?.costThreshold ?? 100)) {
        recommendations.push({
          id: `cost-${Date.now()}`,
          type: "cost",
          title: "High cost detected",
          description: `Total cost of $${totalCost.toFixed(2)} exceeds threshold. Consider switching to cost-optimized models.`,
          impact: "high",
          effort: "medium",
          metrics: ["cost_tracking"],
        });
      }
    }

    const latencyEvents = events.filter((e) => e.properties["latency"] !== undefined);
    if (latencyEvents.length > 0) {
      const latencies = latencyEvents.map((e) => e.properties["latency"] as number);
      const avgLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length;
      if (avgLatency > (options?.latencyThreshold ?? 5000)) {
        recommendations.push({
          id: `perf-${Date.now()}`,
          type: "performance",
          title: "High average latency",
          description: `Average latency of ${avgLatency.toFixed(0)}ms. Consider model optimization or caching.`,
          impact: "high",
          effort: "medium",
          metrics: ["latency"],
        });
      }
    }

    const errorEvents = events.filter((e) => e.name === "error_occurred" || e.severity === "ERROR");
    const errorRate = events.length > 0 ? errorEvents.length / events.length : 0;
    if (errorRate > (options?.errorRateThreshold ?? 0.05)) {
      recommendations.push({
        id: `reliability-${Date.now()}`,
        type: "reliability",
        title: "Elevated error rate",
        description: `Error rate of ${(errorRate * 100).toFixed(1)}% exceeds threshold. Review error logs for patterns.`,
        impact: "high",
        effort: "medium",
        metrics: ["error_rate"],
      });
    }

    return recommendations;
  }

  costAnalysis(
    events: AnalyticsEvent[],
    timeRange: TimeRange,
  ): CostAnalysis {
    const costEvents = events.filter((e) => e.properties["cost"] !== undefined);

    const byProvider: Record<string, number> = {};
    const byModel: Record<string, number> = {};
    const byAgent: Record<string, number> = {};
    const byTaskType: Record<string, number> = {};

    let total = 0;

    for (const event of costEvents) {
      const cost = event.properties["cost"] as number;
      total += cost;

      const provider = event.properties["provider"] as string;
      const model = event.properties["model"] as string;
      const agent = event.agentId;
      const taskType = event.properties["taskType"] as string;

      if (provider) byProvider[provider] = (byProvider[provider] ?? 0) + cost;
      if (model) byModel[model] = (byModel[model] ?? 0) + cost;
      if (agent) byAgent[agent] = (byAgent[agent] ?? 0) + cost;
      if (taskType) byTaskType[taskType] = (byTaskType[taskType] ?? 0) + cost;
    }

    return {
      total,
      byProvider,
      byModel,
      byAgent,
      byTaskType,
      timeRange,
      projected: total * 30,
    };
  }

  performanceAnalysis(
    events: AnalyticsEvent[],
  ): PerformanceAnalysis {
    const latencyEvents = events.filter((e) => e.properties["latency"] !== undefined);
    const latencies = latencyEvents.map((e) => e.properties["latency"] as number).sort((a, b) => a - b);

    const totalEvents = events.length;
    const errorEvents = events.filter((e) => e.severity === "ERROR" || e.name === "error_occurred");

    const avgLatency = latencies.length > 0 ? latencies.reduce((a, b) => a + b, 0) / latencies.length : 0;
    const p95Idx = Math.ceil(0.95 * latencies.length) - 1;
    const p99Idx = Math.ceil(0.99 * latencies.length) - 1;

    const bottlenecks: string[] = [];
    if (avgLatency > 2000) bottlenecks.push("High average latency across model calls");
    if (errorEvents.length / Math.max(totalEvents, 1) > 0.05) bottlenecks.push("Elevated error rate");

    return {
      averageLatency: avgLatency,
      p95Latency: latencies[Math.max(0, p95Idx)] ?? 0,
      p99Latency: latencies[Math.max(0, p99Idx)] ?? 0,
      throughput: totalEvents,
      errorRate: totalEvents > 0 ? errorEvents.length / totalEvents : 0,
      bottlenecks,
      recommendations: bottlenecks.map((b) => `Address: ${b}`),
    };
  }

  usagePatterns(events: AnalyticsEvent[]): UsagePattern[] {
    const patterns: UsagePattern[] = [];

    const eventTypes = new Map<AnalyticsEventType, AnalyticsEvent[]>();
    for (const event of events) {
      const existing = eventTypes.get(event.name) ?? [];
      existing.push(event);
      eventTypes.set(event.name, existing);
    }

    for (const [eventType, typeEvents] of eventTypes) {
      const agents = new Set<string>();
      const taskTypes = new Set<string>();
      const hourDistribution: Record<string, number> = {};

      for (const event of typeEvents) {
        if (event.agentId) agents.add(event.agentId);
        if (event.properties["taskType"]) taskTypes.add(event.properties["taskType"] as string);

        const hour = new Date(event.timestamp).getHours().toString();
        hourDistribution[hour] = (hourDistribution[hour] ?? 0) + 1;
      }

      patterns.push({
        pattern: `Event type: ${eventType}`,
        frequency: typeEvents.length,
        percentage: (typeEvents.length / events.length) * 100,
        agents: Array.from(agents),
        taskTypes: Array.from(taskTypes),
        timeDistribution: hourDistribution,
      });
    }

    return patterns.sort((a, b) => b.frequency - a.frequency);
  }
}
