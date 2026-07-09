import type { ScanReport } from "./types";

export function generateMarkdownReport(report: ScanReport): string {
  const lines: string[] = [];
  lines.push(`# Preflight Scan Report: ${report.projectName}`);
  lines.push(`**Date:** ${report.timestamp}`);
  lines.push(`**Overall Score:** ${report.overallScore}/100`);
  lines.push(`**Duration:** ${report.durationMs}ms`);
  lines.push(`**Total Findings:** ${report.totalFindings}`);
  lines.push("");
  lines.push("## Summary");
  lines.push(report.summary);
  lines.push("");
  lines.push("## Category Scores");
  lines.push("");
  lines.push("| Category | Score | Severity | Critical | High | Medium | Low |");
  lines.push("|---|---|---|---|---|---|---|");
  for (const cat of report.categories) {
    lines.push(`| ${cat.label} | ${cat.score}/100 | ${cat.severity} | ${cat.criticalCount} | ${cat.highCount} | ${cat.mediumCount} | ${cat.lowCount} |`);
  }
  lines.push("");
  lines.push("## Project Detection");
  lines.push("");
  lines.push(`- **Language:** ${report.detection.language}`);
  if (report.detection.frontend) lines.push(`- **Frontend:** ${report.detection.frontend}`);
  if (report.detection.backend) lines.push(`- **Backend:** ${report.detection.backend}`);
  if (report.detection.packageManager) lines.push(`- **Package Manager:** ${report.detection.packageManager}`);
  if (report.detection.aiFramework) lines.push(`- **AI Framework:** ${report.detection.aiFramework}`);
  if (report.detection.database) lines.push(`- **Database:** ${report.detection.database}`);
  if (report.detection.deploymentTarget) lines.push(`- **Deployment:** ${report.detection.deploymentTarget}`);
  if (report.detection.cloudProvider) lines.push(`- **Cloud:** ${report.detection.cloudProvider}`);
  if (report.detection.ciPlatform) lines.push(`- **CI/CD:** ${report.detection.ciPlatform}`);
  lines.push("");
  lines.push("## Findings");
  for (const result of report.scannerResults) {
    if (result.findings.length === 0) continue;
    lines.push(`### ${result.scanner}`);
    lines.push("");
    lines.push(`Duration: ${result.durationMs}ms`);
    lines.push("");
    for (const finding of result.findings) {
      const badge = finding.severity === "critical" ? "!!" : finding.severity === "high" ? "!!" : finding.severity === "medium" ? "!" : "i";
      lines.push(`#### [${badge}] [${finding.severity.toUpperCase()}] ${finding.title}`);
      lines.push("");
      lines.push(finding.description);
      lines.push("");
      if (finding.file) lines.push(`- **File:** ${finding.file}${finding.line ? `:${finding.line}` : ""}`);
      lines.push(`- **Risk:** ${finding.risk || "unknown"}`);
      lines.push(`- **Effort:** ${finding.effort || "unknown"}`);
      lines.push(`- **Suggestion:** ${finding.suggestion}`);
      if (finding.references) {
        for (const ref of finding.references) {
          lines.push(`- **Reference:** ${ref}`);
        }
      }
      lines.push("");
    }
  }
  return lines.join("\n");
}

export function generateSARIF(report: ScanReport): string {
  const results: any[] = [];
  for (const result of report.scannerResults) {
    for (const finding of result.findings) {
      results.push({
        ruleId: finding.id,
        level: finding.severity === "critical" || finding.severity === "high" ? "error" : finding.severity === "medium" ? "warning" : "note",
        message: { text: `${finding.title}: ${finding.description}` },
        locations: finding.file ? [{
          physicalLocation: {
            artifactLocation: { uri: finding.file },
            region: finding.line ? { startLine: finding.line } : undefined,
          },
        }] : [],
        properties: {
          severity: finding.severity,
          risk: finding.risk,
          effort: finding.effort,
          category: result.category,
          suggestion: finding.suggestion,
        },
      });
    }
  }
  return JSON.stringify({
    version: "2.1.0",
    $schema: "https://raw.githubusercontent.com/oasis-tcs/sarif-spec/master/Documentation/GloballyUniqueIdentifiers/README.md",
    runs: [{
      tool: {
        driver: {
          name: "Agent Preflight",
          version: "0.1.0",
          informationUri: "https://github.com/marsley01/agent-preflight",
        },
      },
      results,
    }],
  }, null, 2);
}

export function generateJSON(report: ScanReport): string {
  return JSON.stringify(report, null, 2);
}