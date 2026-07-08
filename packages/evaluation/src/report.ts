import { v4 as uuidv4 } from "uuid";
import type { EvaluationMetric } from "@agent-preflight/types";
import type {
  EvalResult,
  EvalScore,
  EvalReport,
  EvalReportSummary,
  ComparisonResult,
} from "./types.js";

export class ReportGenerator {
  generateDetailedReport(result: EvalResult, title?: string): EvalReport {
    const summary = this.generateSummary(result);

    return {
      id: uuidv4(),
      title: title ?? `Evaluation Report: ${result.model}`,
      run: result,
      summary,
      detailedScores: result.aggregateScores,
      recommendations: this.generateRecommendations(result),
      generatedAt: new Date().toISOString(),
    };
  }

  generateSummary(result: EvalResult): EvalReportSummary {
    const itemScores = result.itemResults.map((r) => r.overallScore);
    const sorted = [...itemScores].sort((a, b) => a - b);

    return {
      overallScore: result.overallScore,
      passed: result.passed,
      totalItems: result.itemResults.length,
      passedItems: result.itemResults.filter((r) => r.passed).length,
      failedItems: result.itemResults.filter((r) => !r.passed).length,
      averageItemScore:
        itemScores.length > 0
          ? itemScores.reduce((a, b) => a + b, 0) / itemScores.length
          : 0,
      medianItemScore: sorted.length > 0 ? sorted[Math.floor(sorted.length / 2)] ?? 0 : 0,
      stdDevScore: this.computeStdDev(itemScores),
      totalDuration: result.duration,
      totalCost: result.cost,
      strengths: this.identifyStrengths(result.aggregateScores),
      weaknesses: this.identifyWeaknesses(result.aggregateScores),
    };
  }

  generateComparisonReport(
    comparison: ComparisonResult,
    title?: string,
  ): EvalReport {
    const allResults = Array.from(comparison.results.values());

    // Create a synthetic aggregated result from the comparison
    const bestResult = comparison.results.get(comparison.winner);
    if (!bestResult) {
      throw new Error("Comparison result missing winner data");
    }

    const summary = this.generateComparisonSummary(comparison);

    return {
      id: uuidv4(),
      title: title ?? `Comparison Report: ${comparison.agents.join(" vs ")}`,
      run: bestResult,
      summary: {
        ...summary,
        strengths: summary.strengths,
        weaknesses: summary.weaknesses,
      },
      detailedScores: bestResult.aggregateScores,
      recommendations: this.generateComparisonRecommendations(comparison),
      generatedAt: new Date().toISOString(),
    };
  }

  generateComparisonSummary(comparison: ComparisonResult): EvalReportSummary {
    const winnerResult = comparison.results.get(comparison.winner);
    if (!winnerResult) {
      throw new Error("Cannot build summary: winner not found");
    }

    return {
      overallScore: winnerResult.overallScore,
      passed: winnerResult.passed,
      totalItems: winnerResult.itemResults.length,
      passedItems: winnerResult.itemResults.filter((r) => r.passed).length,
      failedItems: winnerResult.itemResults.filter((r) => !r.passed).length,
      averageItemScore:
        winnerResult.itemResults.reduce((a, b) => a + b.overallScore, 0) /
        winnerResult.itemResults.length,
      medianItemScore: this.computeMedian(
        winnerResult.itemResults.map((r) => r.overallScore),
      ),
      stdDevScore: this.computeStdDev(
        winnerResult.itemResults.map((r) => r.overallScore),
      ),
      totalDuration: winnerResult.duration,
      totalCost: winnerResult.cost,
      strengths: [`Winner: ${comparison.winner}`],
      weaknesses: [],
    };
  }

  exportToJSON(report: EvalReport): string {
    return JSON.stringify(report, null, 2);
  }

  exportToMarkdown(report: EvalReport): string {
    const lines: string[] = [];
    const s = report.summary;

    lines.push(`# ${report.title}`);
    lines.push("");
    lines.push(`**Generated:** ${report.generatedAt}`);
    lines.push(`**Run ID:** ${report.run.runId}`);
    lines.push("");
    lines.push("## Summary");
    lines.push("");
    lines.push(`| Metric | Value |`);
    lines.push(`|--------|-------|`);
    lines.push(`| Overall Score | ${(s.overallScore * 100).toFixed(1)}% |`);
    lines.push(`| Passed | ${s.passed ? "Yes" : "No"} |`);
    lines.push(`| Threshold | ${(report.run.threshold * 100).toFixed(0)}% |`);
    lines.push(`| Items | ${s.totalItems} (${s.passedItems} passed, ${s.failedItems} failed) |`);
    lines.push(`| Duration | ${s.totalDuration.toFixed(0)}ms |`);
    lines.push(`| Cost | $${s.totalCost.toFixed(6)} |`);
    lines.push("");

    if (s.strengths.length > 0) {
      lines.push("### Strengths");
      for (const strength of s.strengths) {
        lines.push(`- ${strength}`);
      }
      lines.push("");
    }

    if (s.weaknesses.length > 0) {
      lines.push("### Weaknesses");
      for (const weakness of s.weaknesses) {
        lines.push(`- ${weakness}`);
      }
      lines.push("");
    }

    lines.push("## Detailed Scores");
    lines.push("");
    lines.push("| Metric | Score | Weight | Confidence |");
    lines.push("|--------|-------|--------|------------|");

    for (const score of report.detailedScores) {
      const confidence = score.confidence !== undefined
        ? `${(score.confidence * 100).toFixed(0)}%`
        : "N/A";
      lines.push(
        `| ${score.metric} | ${(score.value * 100).toFixed(1)}% | ${score.weight.toFixed(1)}x | ${confidence} |`,
      );
    }

    lines.push("");

    if (report.recommendations.length > 0) {
      lines.push("## Recommendations");
      for (const rec of report.recommendations) {
        lines.push(`- ${rec}`);
      }
      lines.push("");
    }

    return lines.join("\n");
  }

  exportToHTML(report: EvalReport): string {
    const md = this.exportToMarkdown(report);
    const escaped = md
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");

    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${this.escapeHtml(report.title)}</title>
<style>
body { font-family: -apple-system, BlinkMacSystemFont, sans-serif; max-width: 960px; margin: 0 auto; padding: 2rem; line-height: 1.6; }
table { border-collapse: collapse; width: 100%; margin: 1rem 0; }
th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
th { background: #f5f5f5; }
h1 { color: #333; }
.pass { color: #16a34a; font-weight: bold; }
.fail { color: #dc2626; font-weight: bold; }
</style>
</head>
<body>
<pre style="white-space: pre-wrap; font-family: inherit;">
${simple}
</pre>
</body>
</html>`;
  }

  private generateRecommendations(result: EvalResult): string[] {
    const recommendations: string[] = [];

    for (const score of result.aggregateScores) {
      if (score.value < 0.5) {
        recommendations.push(
          `Improve ${score.metric} (current: ${(score.value * 100).toFixed(1)}%)`,
        );
      } else if (score.value < 0.7) {
        recommendations.push(
          `Monitor ${score.metric} — close to threshold (${(score.value * 100).toFixed(1)}%)`,
        );
      }
    }

    const failedItems = result.itemResults.filter((r) => !r.passed);
    if (failedItems.length > 0) {
      recommendations.push(
        `Review ${failedItems.length} failed item(s) for patterns`,
      );
    }

    if (result.cost > 0.01) {
      recommendations.push(
        `Consider cost optimization — $${result.cost.toFixed(4)} total`,
      );
    }

    return recommendations;
  }

  private generateComparisonRecommendations(
    comparison: ComparisonResult,
  ): string[] {
    const recommendations: string[] = [];

    for (const [name, delta] of comparison.scoreDeltas) {
      if (delta < 0) {
        recommendations.push(
          `${name} lags behind by ${(Math.abs(delta) * 100).toFixed(1)}%`,
        );
      }
    }

    recommendations.push(`Recommended agent: ${comparison.winner}`);
    return recommendations;
  }

  private identifyStrengths(scores: EvalScore[]): string[] {
    return scores
      .filter((s) => s.value >= 0.8)
      .map((s) => `${s.metric}: ${(s.value * 100).toFixed(1)}%`);
  }

  private identifyWeaknesses(scores: EvalScore[]): string[] {
    return scores
      .filter((s) => s.value < 0.7)
      .map((s) => `${s.metric}: ${(s.value * 100).toFixed(1)}%`);
  }

  private computeMedian(values: number[]): number {
    if (values.length === 0) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted[mid] ?? 0;
  }

  private computeStdDev(values: number[]): number {
    if (values.length < 2) return 0;
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const sqDiffs = values.map((v) => (v - mean) ** 2);
    return Math.sqrt(sqDiffs.reduce((a, b) => a + b, 0) / values.length);
  }

  private escapeHtml(str: string): string {
    return str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }
}