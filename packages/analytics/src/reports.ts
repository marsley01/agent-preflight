import type { AnalyticsEvent, AnalyticsReport, TimeRange, AggregatedMetric, Dimension, ReportFilter } from "./types.js";
import { AggregationFunction } from "./types.js";
import { MetricsAggregator } from "./aggregator.js";

export interface ReportTemplate {
  id: string;
  name: string;
  description: string;
  metrics: Array<{
    field: string;
    function: AggregationFunction;
    label: string;
  }>;
  dimensions: Dimension[];
  filters: ReportFilter[];
  format: "json" | "csv" | "html";
}

export class ReportGenerator {
  private aggregator: MetricsAggregator;
  private templates: Map<string, ReportTemplate> = new Map();
  private scheduledJobs: Map<string, ReturnType<typeof setInterval>> = new Map();

  constructor(aggregator?: MetricsAggregator | undefined) {
    this.aggregator = aggregator ?? new MetricsAggregator();
    this.registerDefaultTemplates();
  }

  registerTemplate(template: ReportTemplate): void {
    this.templates.set(template.id, template);
  }

  getTemplate(id: string): ReportTemplate | undefined {
    return this.templates.get(id);
  }

  listTemplates(): ReportTemplate[] {
    return Array.from(this.templates.values());
  }

  generateReport(
    events: AnalyticsEvent[],
    templateId: string,
    timeRange: TimeRange,
    options?: Partial<{ format: "json" | "csv" | "html" }> | undefined,
  ): AnalyticsReport {
    const template = this.templates.get(templateId);
    if (!template) {
      throw new Error(`Report template "${templateId}" not found`);
    }

    const metrics: AggregatedMetric[] = [];
    for (const metricDef of template.metrics) {
      const result = this.aggregator.aggregate(events, metricDef.field, metricDef.function, timeRange, {
        dimensions: template.dimensions,
        filters: template.filters,
      });
      metrics.push(...result);
    }

    return {
      id: `report-${Date.now()}`,
      name: template.name,
      dateRange: timeRange,
      metrics,
      dimensions: template.dimensions,
      filters: template.filters,
      groupings: [],
      generatedAt: new Date().toISOString(),
      format: options?.format ?? template.format,
    };
  }

  generatePeriodicReport(
    events: AnalyticsEvent[],
    templateId: string,
    period: "daily" | "weekly" | "monthly",
  ): AnalyticsReport {
    const now = new Date();
    let start: Date;

    switch (period) {
      case "daily":
        start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
        break;
      case "weekly":
        start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case "monthly":
        start = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
        break;
    }

    const timeRange: TimeRange = {
      start: start.toISOString(),
      end: now.toISOString(),
    };

    return this.generateReport(events, templateId, timeRange);
  }

  exportAsJSON(report: AnalyticsReport): string {
    return JSON.stringify(report, null, 2);
  }

  exportAsCSV(report: AnalyticsReport): string {
    const headers = ["name", "function", "value", "unit", "timestamp"];
    if (report.dimensions.length > 0) {
      headers.push(...report.dimensions.map((d) => d.name));
    }

    const rows = report.metrics.map((m) => {
      const row = [
        m.name,
        m.function,
        String(m.value),
        m.unit ?? "",
        m.timestamp,
      ];
      if (report.dimensions.length > 0) {
        for (const dim of report.dimensions) {
          row.push(m.dimensions?.[dim.name] ?? "");
        }
      }
      return row;
    });

    const csvLines = [headers.join(",")];
    for (const row of rows) {
      csvLines.push(row.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","));
    }

    return csvLines.join("\n");
  }

  exportAsHTML(report: AnalyticsReport): string {
    const metricsHtml = report.metrics.map((m) => {
      const dims = m.dimensions
        ? Object.entries(m.dimensions).map(([k, v]) => `<span class="dimension">${k}: ${v}</span>`).join(" ")
        : "";
      return `<tr>
        <td>${m.name}</td>
        <td>${m.function}</td>
        <td>${m.value.toFixed(4)}</td>
        <td>${m.unit ?? "-"}</td>
        <td>${new Date(m.timestamp).toLocaleString()}</td>
        <td>${dims}</td>
      </tr>`;
    }).join("\n");

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${report.name}</title>
  <style>
    body { font-family: system-ui, sans-serif; margin: 2rem; color: #333; }
    h1 { color: #1a1a2e; border-bottom: 2px solid #e0e0e0; padding-bottom: 0.5rem; }
    .meta { color: #666; margin-bottom: 1.5rem; }
    table { width: 100%; border-collapse: collapse; }
    th, td { padding: 0.5rem 1rem; text-align: left; border-bottom: 1px solid #e0e0e0; }
    th { background: #f5f5f5; font-weight: 600; }
    .dimension { display: inline-block; background: #e3f2fd; padding: 0.1rem 0.4rem; border-radius: 3px; margin: 0.1rem; font-size: 0.85rem; }
    .summary { background: #f9f9f9; padding: 1rem; border-radius: 8px; margin-bottom: 2rem; }
  </style>
</head>
<body>
  <h1>${report.name}</h1>
  <div class="meta">
    <p>Generated: ${new Date(report.generatedAt).toLocaleString()}</p>
    <p>Period: ${report.dateRange.start ? new Date(report.dateRange.start).toLocaleString() : "N/A"} - ${report.dateRange.end ? new Date(report.dateRange.end).toLocaleString() : "N/A"}</p>
    <p>Metrics: ${report.metrics.length}</p>
  </div>
  <table>
    <thead>
      <tr><th>Metric</th><th>Function</th><th>Value</th><th>Unit</th><th>Timestamp</th><th>Dimensions</th></tr>
    </thead>
    <tbody>
      ${metricsHtml}
    </tbody>
  </table>
</body>
</html>`;
  }

  scheduleReport(
    templateId: string,
    period: "daily" | "weekly" | "monthly",
    handler: (report: AnalyticsReport) => void,
  ): string {
    const jobId = `scheduled-${templateId}-${period}-${Date.now()}`;
    const intervalMs = period === "daily" ? 86_400_000 : period === "weekly" ? 604_800_000 : 2_592_000_000;

    const intervalId = setInterval(() => {
      handler({
        id: `report-${Date.now()}`,
        name: `Scheduled ${period} report`,
        dateRange: {
          start: new Date(Date.now() - intervalMs).toISOString(),
          end: new Date().toISOString(),
        },
        metrics: [],
        dimensions: [],
        filters: [],
        groupings: [],
        generatedAt: new Date().toISOString(),
      });
    }, intervalMs);

    this.scheduledJobs.set(jobId, intervalId);
    return jobId;
  }

  cancelSchedule(jobId: string): boolean {
    const intervalId = this.scheduledJobs.get(jobId);
    if (intervalId) {
      clearInterval(intervalId);
      this.scheduledJobs.delete(jobId);
      return true;
    }
    return false;
  }

  shutdown(): void {
    for (const [, intervalId] of this.scheduledJobs) {
      clearInterval(intervalId);
    }
    this.scheduledJobs.clear();
  }

  private registerDefaultTemplates(): void {
    this.registerTemplate({
      id: "daily-summary",
      name: "Daily Summary",
      description: "High-level daily system summary",
      metrics: [
        { field: "latency", function: AggregationFunction.AVG, label: "Average Latency" },
        { field: "latency", function: AggregationFunction.PERCENTILE_95, label: "P95 Latency" },
        { field: "cost", function: AggregationFunction.SUM, label: "Total Cost" },
        { field: "count", function: AggregationFunction.COUNT, label: "Total Events" },
      ],
      dimensions: [],
      filters: [],
      format: "html",
    });

    this.registerTemplate({
      id: "cost-analysis",
      name: "Cost Analysis",
      description: "Detailed cost breakdown by provider, model, and agent",
      metrics: [
        { field: "cost", function: AggregationFunction.SUM, label: "Cost" },
        { field: "count", function: AggregationFunction.COUNT, label: "Requests" },
      ],
      dimensions: [
        { name: "provider" },
        { name: "model" },
        { name: "agent" },
      ],
      filters: [],
      format: "json",
    });

    this.registerTemplate({
      id: "performance-report",
      name: "Performance Report",
      description: "Latency and error rate analysis",
      metrics: [
        { field: "latency", function: AggregationFunction.AVG, label: "Average Latency" },
        { field: "latency", function: AggregationFunction.PERCENTILE_95, label: "P95 Latency" },
        { field: "latency", function: AggregationFunction.PERCENTILE_99, label: "P99 Latency" },
        { field: "error", function: AggregationFunction.COUNT, label: "Error Count" },
      ],
      dimensions: [
        { name: "agent" },
        { name: "provider" },
      ],
      filters: [],
      format: "html",
    });

    this.registerTemplate({
      id: "agent-activity",
      name: "Agent Activity",
      description: "Agent-level task and performance metrics",
      metrics: [
        { field: "count", function: AggregationFunction.COUNT, label: "Task Count" },
        { field: "latency", function: AggregationFunction.AVG, label: "Average Latency" },
        { field: "cost", function: AggregationFunction.SUM, label: "Total Cost" },
      ],
      dimensions: [
        { name: "agent" },
      ],
      filters: [],
      format: "csv",
    });
  }
}
