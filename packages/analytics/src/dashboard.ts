import type { Duration, Timestamp } from "@agent-preflight/types";
import type {
  AnalyticsEvent,
  AnalyticsDashboard,
  DashboardWidget,
  DashboardLayout,
  TimeRange,
} from "./types.js";
import { InsightsEngine, type CostAnalysis } from "./insights.js";
import { MetricsAggregator } from "./aggregator.js";

export interface DashboardOverview {
  totalAgents: number;
  activeAgents: number;
  totalTasks: number;
  completedTasks: number;
  failedTasks: number;
  averageLatency: number;
  totalCost: number;
  errorRate: number;
  uptime: number;
  lastUpdated: Timestamp;
}

export interface AgentMetricsSummary {
  agentId: string;
  taskCount: number;
  successRate: number;
  averageLatency: number;
  totalCost: number;
  lastActive: Timestamp;
}

export interface ProviderMetricsSummary {
  provider: string;
  requestCount: number;
  averageLatency: number;
  errorRate: number;
  totalCost: number;
}

export interface CostBreakdown {
  total: number;
  byProvider: Array<{ name: string; cost: number; percentage: number }>;
  byAgent: Array<{ name: string; cost: number; percentage: number }>;
  byModel: Array<{ name: string; cost: number; percentage: number }>;
  byTaskType: Array<{ name: string; cost: number; percentage: number }>;
  projected: number;
}

export interface LatencyAnalysis {
  average: number;
  p50: number;
  p95: number;
  p99: number;
  max: number;
  min: number;
  distribution: Array<{ range: string; count: number; percentage: number }>;
}

export interface ErrorAnalysis {
  totalErrors: number;
  errorRate: number;
  byType: Array<{ type: string; count: number; percentage: number }>;
  byAgent: Array<{ agent: string; count: number; percentage: number }>;
  commonErrors: Array<{ message: string; count: number }>;
}

export interface TimelineEntry {
  timestamp: Timestamp;
  type: string;
  summary: string;
  agentId?: string | undefined;
  taskId?: string | undefined;
  duration?: number | undefined;
}

export class DashboardDataProvider {
  private insights: InsightsEngine;

  constructor(insights?: InsightsEngine | undefined) {
    this.insights = insights ?? new InsightsEngine(new MetricsAggregator());
  }

  getOverview(events: AnalyticsEvent[], timeRange: TimeRange): DashboardOverview {
    const filtered = this.filterByTimeRange(events, timeRange);

    const agentEvents = filtered.filter((e) => e.agentId);
    const uniqueAgents = new Set(agentEvents.map((e) => e.agentId));
    const activeAgents = new Set(
      agentEvents
        .filter((e) => e.name === "agent_started" || Date.now() - new Date(e.timestamp).getTime() < 300_000)
        .map((e) => e.agentId),
    );

    const tasks = filtered.filter((e) => e.taskId);
    const completedTasks = tasks.filter((e) => e.name === "task_completed");
    const failedTasks = tasks.filter((e) => e.name === "task_failed");

    const latencies = filtered
      .filter((e) => e.properties["latency"] !== undefined)
      .map((e) => e.properties["latency"] as number);
    const avgLatency = latencies.length > 0 ? latencies.reduce((a, b) => a + b, 0) / latencies.length : 0;

    const costs = filtered
      .filter((e) => e.properties["cost"] !== undefined)
      .reduce((sum, e) => sum + (e.properties["cost"] as number), 0);

    const errors = filtered.filter((e) => e.name === "error_occurred" || e.severity === "ERROR");

    return {
      totalAgents: uniqueAgents.size,
      activeAgents: activeAgents.size,
      totalTasks: tasks.length,
      completedTasks: completedTasks.length,
      failedTasks: failedTasks.length,
      averageLatency: avgLatency,
      totalCost: costs,
      errorRate: filtered.length > 0 ? errors.length / filtered.length : 0,
      uptime: 100,
      lastUpdated: new Date().toISOString(),
    };
  }

  getAgentMetrics(events: AnalyticsEvent[], timeRange: TimeRange): AgentMetricsSummary[] {
    const filtered = this.filterByTimeRange(events, timeRange);
    const byAgent = new Map<string, AnalyticsEvent[]>();

    for (const event of filtered) {
      if (!event.agentId) continue;
      const existing = byAgent.get(event.agentId) ?? [];
      existing.push(event);
      byAgent.set(event.agentId, existing);
    }

    return Array.from(byAgent.entries()).map(([agentId, agentEvents]) => {
      const tasks = agentEvents.filter((e) => e.taskId);
      const completed = agentEvents.filter((e) => e.name === "task_completed");
      const latencies = agentEvents
        .filter((e) => e.properties["latency"] !== undefined)
        .map((e) => e.properties["latency"] as number);
      const costs = agentEvents
        .filter((e) => e.properties["cost"] !== undefined)
        .reduce((sum, e) => sum + (e.properties["cost"] as number), 0);

      const sortedByTime = [...agentEvents].sort(
        (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
      );

      return {
        agentId,
        taskCount: tasks.length,
        successRate: tasks.length > 0 ? completed.length / tasks.length : 1,
        averageLatency: latencies.length > 0 ? latencies.reduce((a, b) => a + b, 0) / latencies.length : 0,
        totalCost: costs,
        lastActive: sortedByTime[0]?.timestamp ?? new Date().toISOString(),
      };
    });
  }

  getProviderMetrics(events: AnalyticsEvent[], timeRange: TimeRange): ProviderMetricsSummary[] {
    const filtered = this.filterByTimeRange(events, timeRange);
    const byProvider = new Map<string, AnalyticsEvent[]>();

    for (const event of filtered) {
      const provider = event.properties["provider"] as string | undefined;
      if (!provider) continue;
      const existing = byProvider.get(provider) ?? [];
      existing.push(event);
      byProvider.set(provider, existing);
    }

    return Array.from(byProvider.entries()).map(([provider, providerEvents]) => {
      const latencies = providerEvents
        .filter((e) => e.properties["latency"] !== undefined)
        .map((e) => e.properties["latency"] as number);
      const errors = providerEvents.filter((e) => e.name === "error_occurred" || e.severity === "ERROR");
      const costs = providerEvents
        .filter((e) => e.properties["cost"] !== undefined)
        .reduce((sum, e) => sum + (e.properties["cost"] as number), 0);

      return {
        provider,
        requestCount: providerEvents.length,
        averageLatency: latencies.length > 0 ? latencies.reduce((a, b) => a + b, 0) / latencies.length : 0,
        errorRate: providerEvents.length > 0 ? errors.length / providerEvents.length : 0,
        totalCost: costs,
      };
    });
  }

  getCostBreakdown(events: AnalyticsEvent[], timeRange: TimeRange): CostBreakdown {
    const analysis: CostAnalysis = this.insights.costAnalysis(events, timeRange);

    const toArray = (map: Record<string, number>): Array<{ name: string; cost: number; percentage: number }> => {
      const entries = Object.entries(map).sort((a, b) => b[1] - a[1]);
      const total = analysis.total || 1;
      return entries.map(([name, cost]) => ({
        name,
        cost,
        percentage: (cost / total) * 100,
      }));
    };

    return {
      total: analysis.total,
      byProvider: toArray(analysis.byProvider),
      byAgent: toArray(analysis.byAgent),
      byModel: toArray(analysis.byModel),
      byTaskType: toArray(analysis.byTaskType),
      projected: analysis.projected,
    };
  }

  getLatencyAnalysis(events: AnalyticsEvent[], timeRange: TimeRange): LatencyAnalysis {
    const filtered = this.filterByTimeRange(events, timeRange);
    const latencies = filtered
      .filter((e) => e.properties["latency"] !== undefined)
      .map((e) => e.properties["latency"] as number)
      .sort((a, b) => a - b);

    if (latencies.length === 0) {
      return {
        average: 0, p50: 0, p95: 0, p99: 0, max: 0, min: 0,
        distribution: [],
      };
    }

    const p50Idx = Math.ceil(0.50 * latencies.length) - 1;
    const p95Idx = Math.ceil(0.95 * latencies.length) - 1;
    const p99Idx = Math.ceil(0.99 * latencies.length) - 1;

    const ranges = [
      { label: "0-100ms", min: 0, max: 100 },
      { label: "100-500ms", min: 100, max: 500 },
      { label: "500ms-1s", min: 500, max: 1000 },
      { label: "1-5s", min: 1000, max: 5000 },
      { label: "5-10s", min: 5000, max: 10000 },
      { label: "10s+", min: 10000, max: Infinity },
    ];

    const distribution = ranges.map((r) => {
      const count = latencies.filter((l) => l >= r.min && l < r.max).length;
      return {
        range: r.label,
        count,
        percentage: (count / latencies.length) * 100,
      };
    });

    return {
      average: latencies.reduce((a, b) => a + b, 0) / latencies.length,
      p50: latencies[Math.max(0, p50Idx)]!,
      p95: latencies[Math.max(0, p95Idx)]!,
      p99: latencies[Math.max(0, p99Idx)]!,
      max: latencies[latencies.length - 1]!,
      min: latencies[0]!,
      distribution,
    };
  }

  getErrorAnalysis(events: AnalyticsEvent[], timeRange: TimeRange): ErrorAnalysis {
    const filtered = this.filterByTimeRange(events, timeRange);
    const errors = filtered.filter((e) => e.name === "error_occurred" || e.severity === "ERROR");

    const byType = new Map<string, number>();
    const byAgent = new Map<string, number>();
    const messages = new Map<string, number>();

    for (const error of errors) {
      const type = error.properties["errorType"] as string ?? error.name;
      byType.set(type, (byType.get(type) ?? 0) + 1);

      if (error.agentId) {
        byAgent.set(error.agentId, (byAgent.get(error.agentId) ?? 0) + 1);
      }

      const message = error.properties["message"] as string ?? "Unknown error";
      messages.set(message, (messages.get(message) ?? 0) + 1);
    }

    const total = errors.length || 1;

    return {
      totalErrors: errors.length,
      errorRate: filtered.length > 0 ? errors.length / filtered.length : 0,
      byType: Array.from(byType.entries())
        .sort((a, b) => b[1] - a[1])
        .map(([type, count]) => ({ type, count, percentage: (count / total) * 100 })),
      byAgent: Array.from(byAgent.entries())
        .sort((a, b) => b[1] - a[1])
        .map(([agent, count]) => ({ agent, count, percentage: (count / total) * 100 })),
      commonErrors: Array.from(messages.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([message, count]) => ({ message, count })),
    };
  }

  getTimeline(events: AnalyticsEvent[], timeRange: TimeRange, limit: number = 100): TimelineEntry[] {
    const filtered = this.filterByTimeRange(events, timeRange);
    const sorted = [...filtered]
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, limit);

    return sorted.map((event) => ({
      timestamp: event.timestamp,
      type: event.name,
      summary: this.eventToSummary(event),
      agentId: event.agentId,
      taskId: event.taskId,
      duration: event.properties["duration"] as number | undefined,
    }));
  }

  createDashboard(
    id: string,
    name: string,
    widgets: DashboardWidget[],
    layout?: Partial<DashboardLayout> | undefined,
    refresh: Duration = 30000,
  ): AnalyticsDashboard {
    const resolvedLayout: DashboardLayout = layout?.columns
      ? {
          columns: layout.columns,
          widgets: layout.widgets ?? [],
        }
      : {
          columns: 3,
          widgets: widgets.map((w, i) => ({
            widgetId: w.id,
            x: i % 3,
            y: Math.floor(i / 3),
            w: 1,
            h: 1,
          })),
        };

    return {
      id,
      name,
      widgets,
      layout: resolvedLayout,
      refresh,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }

  private filterByTimeRange(events: AnalyticsEvent[], timeRange: TimeRange): AnalyticsEvent[] {
    const start = timeRange.start ? new Date(timeRange.start).getTime() : 0;
    const end = timeRange.end ? new Date(timeRange.end).getTime() : Date.now();
    return events.filter((e) => {
      const t = new Date(e.timestamp).getTime();
      return t >= start && t <= end;
    });
  }

  private eventToSummary(event: AnalyticsEvent): string {
    switch (event.name) {
      case "agent_started": return `Agent ${event.agentId ?? "unknown"} started`;
      case "agent_completed": return `Agent ${event.agentId ?? "unknown"} completed`;
      case "agent_failed": return `Agent ${event.agentId ?? "unknown"} failed`;
      case "task_delegated": return `Task ${event.taskId ?? "unknown"} delegated`;
      case "task_completed": return `Task ${event.taskId ?? "unknown"} completed`;
      case "task_failed": return `Task ${event.taskId ?? "unknown"} failed`;
      case "tool_called": return `Tool called: ${String(event.properties["tool"] ?? "unknown")}`;
      case "model_request": return `Model request: ${String(event.properties["model"] ?? "unknown")}`;
      case "model_response": return `Model response received`;
      case "error_occurred": return `Error: ${String(event.properties["message"] ?? "Unknown error")}`;
      default: return `Event: ${event.name}`;
    }
  }
}
