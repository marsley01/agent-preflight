#!/usr/bin/env node
import { Command } from "commander";
import pc from "picocolors";
import { scanProject } from "@agent-preflight/scanner";
import { badgeCommand } from "./commands/badge";

const program = new Command();

program
  .name("preflight")
  .description("Agent Preflight – Production readiness scanner")
  .version("0.1.0");

program
  .command("check")
  .description("Run a complete production readiness scan")
  .argument("[path]", "Project path to scan", ".")
  .action(async (path: string) => {
    console.log(pc.bold("\nAgent Preflight — Production Readiness Scan\n"));
    console.log(pc.dim(`Scanning ${path}...\n`));

    try {
      const report = await scanProject(path);

      console.log(`  ${pc.green("✓")} Project: ${pc.bold(report.projectName)}`);
      console.log(`  ${pc.green("✓")} Overall Score: ${pc.bold(String(report.overallScore))}/100`);
      console.log(`  ${pc.green("✓")} Findings: ${report.totalFindings}`);
      console.log(`  ${pc.green("✓")} Duration: ${report.durationMs}ms\n`);

      for (const cat of report.categories) {
        const color = cat.severity === "critical" ? pc.red : cat.severity === "high" ? pc.yellow : cat.severity === "medium" ? pc.cyan : pc.green;
        console.log(`  ${color(`${cat.label}: ${cat.score}/100`)}  (${cat.findingCount} findings)`);
      }

      const critical = report.criticalCount;
      const high = report.highCount;
      if (critical > 0 || high > 0) {
        console.log(pc.red(`\n  ⚠ ${critical} critical, ${high} high severity issues found\n`));
      } else {
        console.log(pc.green("\n  ✅ No critical or high severity issues\n"));
      }
    } catch (err) {
      console.error(pc.red("Scan failed:"), err);
      process.exit(1);
    }
  });

program.addCommand(badgeCommand());

program.parse(process.argv);