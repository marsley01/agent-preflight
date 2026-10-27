#!/usr/bin/env node

/**
 * Agent Preflight CLI — pre-deploy security scanner for vibe coders.
 *
 * Usage:
 *   preflight scan [dir] [options]
 *   preflight categories
 *
 * @packageDocumentation
 */

import { Command, Option } from 'commander';
import { runScan, toolVersion } from './scan.js';
import { CATEGORIES } from './checks/index.js';

const program = new Command();

program
  .name('preflight')
  .description('Pre-deploy checklist CLI for vibe coders')
  .version(toolVersion());

program
  .command('scan [dir]')
  .description('Scan a project for common pre-deploy issues')
  .addOption(new Option('-f, --format <format>', 'Output format').choices(['pretty', 'json', 'markdown', 'sarif']).default('pretty'))
  .option('--json', 'Shorthand for --format json')
  .option('-o, --output <file>', 'Write the report to a file instead of stdout')
  .option('--strict', 'Exit with code 1 if any check fails')
  .addOption(new Option('--fail-on <severity>', 'Exit with code 1 if any finding is at or above this severity').choices(['critical', 'high', 'medium', 'low']))
  .option('--only <categories>', `Comma-separated categories to run: ${CATEGORIES.map((c) => c.id).join('|')}`)
  .option('--offline', 'Skip network lookups (dependency vulnerability advisories)')
  .option('-v, --verbose', 'Show code snippets for each finding')
  .action(async (dir: string = '.', options) => {
    await runScan(dir, options);
  });

program
  .command('categories')
  .description('List available check categories')
  .action(() => {
    for (const c of CATEGORIES) console.log(`${c.id.padEnd(16)} ${c.name}`);
  });

program.parseAsync();
