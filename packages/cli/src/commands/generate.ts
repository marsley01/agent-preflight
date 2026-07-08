import { Command } from 'commander';
import chalk from 'chalk';
import { writeFile, mkdir } from 'fs/promises';
import { join, resolve } from 'path';
import { OutputManager } from '../utils/output.js';
import { formatSpinner } from '../utils/formatting.js';

const AGENT_TEMPLATE = (name: string) => `import { Agent } from '@agent-preflight/core';

const agent = new Agent({
  name: '${name}',
  description: 'Agent: ${name}',
  model: 'gpt-4o',
  temperature: 0.7,
  maxTokens: 4096,
});

agent.on('message', async (ctx) => {
  const { message } = ctx.payload;
  const response = await ctx.llm.generate(message);
  await ctx.reply(response);
});

export default agent;
`;

const AGENT_TEST_TEMPLATE = (name: string) => `import { describe, it, expect } from 'vitest';
import agent from './${name}.js';

describe('${name}', () => {
  it('should be configured correctly', () => {
    expect(agent.name).toBe('${name}');
    expect(agent.description).toBeDefined();
  });
});
`;

const WORKFLOW_TEMPLATE = (name: string) => `import { Workflow } from '@agent-preflight/core';

export const workflow = new Workflow({
  name: '${name}',
  description: 'Workflow: ${name}',
  steps: [
    { name: 'step-1', agent: 'main', action: 'process' },
    { name: 'step-2', agent: 'helper', action: 'transform', dependsOn: ['step-1'] },
    { name: 'step-3', agent: 'output', action: 'finalize', dependsOn: ['step-2'] },
  ],
  onError: 'abort',
  maxRetries: 3,
});
`;

const WORKFLOW_TEST_TEMPLATE = (name: string) => `import { describe, it, expect } from 'vitest';
import { workflow } from './${name}.js';

describe('Workflow: ${name}', () => {
  it('should have defined steps', () => {
    expect(workflow.steps.length).toBeGreaterThan(0);
  });
});
`;

const PLUGIN_MANIFEST = (name: string) => `{
  "name": "@agent-preflight/plugin-${name}",
  "version": "0.1.0",
  "description": "Plugin: ${name}",
  "main": "./src/index.ts",
  "agent-preflight": {
    "plugin": true,
    "apiVersion": "0.1.0"
  }
}
`;

const PLUGIN_SRC_TEMPLATE = (name: string) => `import { Plugin } from '@agent-preflight/core';

const plugin = new Plugin({
  name: '${name}',
  version: '0.1.0',
  description: 'Plugin: ${name}',
  hooks: {
    'agent:beforeMessage': async (ctx) => {
      console.log(\`[Plugin:${name}] Before message handler\`);
      return ctx;
    },
    'agent:afterMessage': async (ctx) => {
      console.log(\`[Plugin:${name}] After message handler\`);
      return ctx;
    },
  },
});

export default plugin;
`;

const GENERATORS = {
  agent: {
    description: 'scaffold a new agent',
    files: (name: string) => ({
      [`agents/${name}.ts`]: AGENT_TEMPLATE(name),
      [`agents/${name}.test.ts`]: AGENT_TEST_TEMPLATE(name),
    }),
  },
  workflow: {
    description: 'create a new workflow',
    files: (name: string) => ({
      [`workflows/${name}.ts`]: WORKFLOW_TEMPLATE(name),
      [`workflows/${name}.test.ts`]: WORKFLOW_TEST_TEMPLATE(name),
    }),
  },
  plugin: {
    description: 'create a new plugin',
    files: (name: string) => ({
      [`plugins/${name}/package.json`]: PLUGIN_MANIFEST(name),
      [`plugins/${name}/src/index.ts`]: PLUGIN_SRC_TEMPLATE(name),
    }),
  },
} as const;

type GenerateType = keyof typeof GENERATORS;

export function registerGenerateCommand(program: Command, output: OutputManager): void {
  const generateCmd = program
    .command('generate')
    .description('Generate agents, workflows, and plugins from templates')
    .alias('gen');

  for (const [type, config] of Object.entries(GENERATORS)) {
    generateCmd
      .command(`${type} <name>`)
      .description(config.description)
      .option('-f, --force', 'Overwrite existing files')
      .action(async (name: string, options: { force?: boolean }) => {
        try {
          const t = type as GenerateType;
          const generator = GENERATORS[t];
          const files = generator.files(name);
          const targetDir = process.cwd();

          output.heading(`Generating ${t}: ${chalk.bold(name)}`);

          await formatSpinner(`Creating ${t} files...`, async () => {
            for (const [filePath, content] of Object.entries(files)) {
              const fullPath = resolve(targetDir, filePath);
              await mkdir(fullPath.split('\\').slice(0, -1).join('\\'), { recursive: true });
              await writeFile(fullPath, content, 'utf-8');
            }
          });

          output.success(`${t.charAt(0).toUpperCase() + t.slice(1)} "${name}" created successfully`);
          output.info(`Location: ${chalk.cyan(targetDir)}`);

          output.raw('');
          output.raw(chalk.bold('Generated files:'));
          for (const filePath of Object.keys(files)) {
            output.raw(`  ${chalk.green('+')} ${filePath}`);
          }
        } catch (error) {
          output.error(`Generation failed: ${(error as Error).message}`);
          process.exit(1);
        }
      });
  }
}
