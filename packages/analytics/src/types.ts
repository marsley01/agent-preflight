import type { Timestamp, Duration, AgentId, LogLevel } from "@agent-preflight/types";

export interface AnalyticsEvent {
  id: string;
  name: AnalyticsEventType;
  properties: Record<string, unknown>;
  timestamp: Timestamp;
  userId?: string | undefined;
  sessionId?: string | undefined;
  correlationId?: string | undefined;
  agentId?: AgentId | undefined;
  taskId?: string | undefined;
  severity?: LogLevel | undefined;
}

export type AnalyticsEventType =
  | "agent_started"
  | "agent_completed"
  | "agent_failed"
  | "task_delegated"
  | "task_completed"
  | "task_failed"
  | "tool_called"
  | "model_request"
  | "model_response"
  | "memory_access"
  | "security_event"
  | "error_occurred"
  | "workflow_started"
  | "workflow_completed"
  | "cost_recorded"
  | "custom";

export interface AnalyticsReport {
  id: string;
  name: string;
  dateRange: TimeRange;
  metrics: AggregatedMetric[];
  dimensions: Dimension[];
  filters: ReportFilter[];
  groupings: string[];
  generatedAt: Timestamp;
  format?: "json" | "csv" | "html" | undefined;
}

export interface AnalyticsDashboard {
  id: string;
  name: string;
  widgets: DashboardWidget[];
  layout: DashboardLayout;
  refresh: Duration;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export type DashboardWidgetType = "metric" | "chart" | "table" | "list" | "status";

export interface DashboardWidget {
  id: string;
  type: DashboardWidgetType;
  title: string;
  metric?: string | undefined;
  chartType?: "line" | "bar" | "pie" | "area" | "scatter" | undefined;
  dimensions?: Dimension[] | undefined;
  filters?: Record<string, unknown> | undefined;
  config: Record<string, unknown>;
}

export interface DashboardLayout {
  columns: number;
  widgets: Array<{
    widgetId: string;
    x: number;
    y: number;
    w: number;
    h: number;
  }>;
}

export enum TimeRangePreset {
  PRESET_24H = "24h",
  PRESET_7D = "7d",
  PRESET_30D = "30d",
  PRESET_90D = "90d",
}

export interface TimeRange {
  preset?: TimeRangePreset | undefined;
  start?: Timestamp | undefined;
  end?: Timestamp | undefined;
  custom?: boolean | undefined;
}

export enum AggregationFunction {
  SUM = "SUM",
  AVG = "AVG",
  MIN = "MIN",
  MAX = "MAX",
  COUNT = "COUNT",
  PERCENTILE_50 = "P50",
  PERCENTILE_95 = "P95",
  PERCENTILE_99 = "P99",
}

export interface Dimension {
  name: string;
  value?: string | undefined;
  values?: string[] | undefined;
}

export type DimensionName = "agent" | "provider" | "model" | "taskType" | "status" | "user";

export interface ReportFilter {
  field: string;
  operator: "eq" | "neq" | "gt" | "gte" | "lt" | "lte" | "in" | "contains" | "exists";
  value: unknown;
}

export interface AggregatedMetric {
  name: string;
  function: AggregationFunction;
  value: number;
  unit?: string | undefined;
  dimensions?: Record<string, string> | undefined;
  timestamp: Timestamp;
}

export interface TimeBucket {
  start: Timestamp;
  end: Timestamp;
  metrics: AggregatedMetric[];
}

export type BucketSize = "1m" | "5m" | "15m" | "1h" | "1d";
