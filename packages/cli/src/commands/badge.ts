import { Command } from "commander";
import pc from "picocolors";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { scanProject, generateOverallBadgeSVG, generateMultiBadgeSVG } from "@agent-preflight/scanner";

export function badgeCommand(): Command {
  const cmd = new Command("badge")
    .description("Generate project health badges")
    .argument("[path]", "Project path", ".")
    .option("--svg", "Export SVG file")
    .option("--markdown", "Print markdown for README")
    .option("--multi", "Generate multi-badge (all categories)")
    .option("--output <dir>", "Output directory", ".")
    .action(async (path: string, opts: { svg?: boolean; markdown?: boolean; multi?: boolean; output?: string }) => {
      try {
        const report = await scanProject(path);

        if (opts.multi) {
          const svg = generateMultiBadgeSVG(report);
          if (opts.svg) {
            const outPath = join(opts.output || ".", "preflight-badge.svg");
            await writeFile(outPath, svg, "utf-8");
            console.log(pc.green(`✓ Badge saved to ${outPath}`));
          } else {
            console.log(svg);
          }
        } else {
          const svg = generateOverallBadgeSVG(report);
          if (opts.svg) {
            const outPath = join(opts.output || ".", "preflight-badge.svg");
            await writeFile(outPath, svg, "utf-8");
            console.log(pc.green(`✓ Badge saved to ${outPath}`));
          } else {
            console.log(svg);
          }
        }

        if (opts.markdown) {
          const md = `![Agent Preflight](https://badge.agentpreflight.dev/project/${report.projectName})`;
          console.log("\n" + pc.cyan("README Markdown:"));
          console.log(md);
        }

        if (!opts.svg && !opts.markdown) {
          console.log(pc.dim("Use --svg to save, --markdown for README embed, or --multi for all categories"));
        }
      } catch (err) {
        console.error(pc.red("Badge generation failed:"), err);
        process.exit(1);
      }
    });

  return cmd;
}