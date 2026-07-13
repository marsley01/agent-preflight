#!/usr/bin/env node

/**
 * Agent Preflight CLI — pre-deploy security scanner for vibe coders.
 *
 * Usage:
 *   preflight scan [dir] [options]
 *
 * @packageDocumentation
 */

import { Command } from 'commander';
import { runScan } from './scan';

const program = new Command();

program
  .name('preflight')
  .description('Pre-deploy checklist CLI for vibe coders')
  .version('0.1.0');

program
  .command('scan [dir]')
  .description('Scan a project for common pre-deploy issues')
  .option('--json', 'Output results as JSON')
  .option('--strict', 'Exit with code 1 if any checks fail')
  .option('--only <category>', 'Run only one category: security|auth|payments|database|api|web|graphql|realtime|vulnerabilities')
  .action(async (dir: string = '.', options) => {
    await runScan(dir, options);
  });

program.parse();
