#!/usr/bin/env node
import { Command } from 'commander';
import chalk from 'chalk';
import { createRequire } from 'module';

import { getOutput, type OutputMode } from './utils/output.js';
import { registerInitCommand } from './commands/init.js';
import { registerDoctorCommand } from './commands/doctor.js';
import { registerDeployCommand } from './commands/deploy.js';
import { registerRunCommand } from './commands/run.js';
import { registerInspectCommand } from './commands/inspect.js';
import { registerHealthCommand } from './commands/health.js';
import { registerTraceCommand } from './commands/trace.js';
import { registerMemoryCommand } from './commands/memory.js';
import { registerRegistryCommand } from './commands/registry.js';
import { registerPluginsCommand } from './commands/plugins.js';
import { registerModelsCommand } from './commands/models.js';
import { registerProvidersCommand } from './commands/providers.js';
import { registerEvaluateCommand } from './commands/evaluate.js';
import { registerBenchmarkCommand } from './commands/benchmark.js';
import { registerGenerateCommand } from './commands/generate.js';
import { registerUpgradeCommand } from './commands/upgrade.js';

const __require = createRequire(import.meta.url);

async function getPackageVersion(): Promise<string> {
  try {
    const pkg = __require('../package.json');
    return pkg.version ?? '0.1.0';
  } catch {
    return '0.1.0';
  }
}

async function main() {
  const version = await getPackageVersion();
  const output = getOutput({ mode: 'pretty' });

  const program = new Command();

  program
    .name('preflight')
    .description(chalk.cyan('Enterprise CLI for the AI Agent Operating System'))
    .version(version, '-v, --version', 'Display the version number')
    .helpOption('-h, --help', 'Display help information')
    .hook('preAction', (thisCommand) => {
      const globalOpts = thisCommand.optsWithGlobals();
      if (globalOpts.verbose) {
        output.setMode('pretty');
      }
      if (globalOpts.output) {
        output.setMode(globalOpts.output as OutputMode);
      }
    });

  program
    .option('-c, --config <path>', 'Path to configuration file')
    .option('--verbose', 'Enable verbose output')
    .option('-o, --output <mode>', 'Output mode (json, table, pretty)', 'pretty');

  registerInitCommand(program, output);
  registerDoctorCommand(program, output);
  registerDeployCommand(program, output);
  registerRunCommand(program, output);
  registerInspectCommand(program, output);
  registerHealthCommand(program, output);
  registerTraceCommand(program, output);
  registerMemoryCommand(program, output);
  registerRegistryCommand(program, output);
  registerPluginsCommand(program, output);
  registerModelsCommand(program, output);
  registerProvidersCommand(program, output);
  registerEvaluateCommand(program, output);
  registerBenchmarkCommand(program, output);
  registerGenerateCommand(program, output);
  registerUpgradeCommand(program, output);

  program.configureHelp({
    sortSubcommands: true,
    showGlobalOptions: true,
  });

  program.addHelpText(
    'after',
    `\n${chalk.gray('Learn more:')} ${chalk.cyan('https://agent-preflight.io/docs')}\n`,
  );

  program.parse(process.argv);
}

main();
