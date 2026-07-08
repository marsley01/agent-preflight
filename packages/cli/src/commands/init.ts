import { Command } from 'commander';
import chalk from 'chalk';
import { createRequire } from 'module';
import { readFile, writeFile, mkdir, access } from 'fs/promises';
import { join, resolve, basename } from 'path';
import { existsSync } from 'fs';
import inquirer from 'inquirer';
import { OutputManager } from '../utils/output.js';
import { formatSpinner } from '../utils/formatting.js';

const __require = createRequire(import.meta.url);

interface InitOptions {
  template?: string;
  name?: string;
  path?: string;
  yes?: boolean;
}

const TEMPLATES = ['blank', 'starter', 'multi-agent', 'workflow', 'chatbot', 'tool-use'] as const;

function makeDirStructure(base: string, structure: Record<string, string | null>) {
  return Promise.all(
    Object.entries(structure).map(async ([file, content]) => {
      const fullPath = join(base, file);
      const dir = file.includes('/') ? join(base, file.split('/').slice(0, -1).join('/')) : base;
      await mkdir(dir, { recursive: true });
      if (content !== null) {
        await writeFile(fullPath, content, 'utf-8');
      }
      return fullPath;
    }),
  );
}

function getTemplateFiles(template: string, projectName: string) {
  const pkg = {
    name: projectName,
    version: '0.1.0',
    private: true,
    type: 'module',
    scripts: {
      dev: 'preflight dev',
      build: 'preflight build',
      start: 'preflight run agent main',
    },
    dependencies: {
      '@agent-preflight/core': 'latest',
      '@agent-preflight/runtime': 'latest',
    },
  };

  const config = {
    version: '0.1.0',
    agent: {
      name: projectName,
      version: '0.1.0',
      description: `Agent ${projectName}`,
    },
    runtime: {
      provider: 'openai',
      model: 'gpt-4o',
      temperature: 0.7,
      maxTokens: 4096,
    },
    telemetry: {
      enabled: true,
      level: 'info',
    },
  };

  const base = {
    'package.json': JSON.stringify(pkg, null, 2),
    'preflight.json': JSON.stringify(config, null, 2),
    'agents/main.ts': `import { Agent } from '@agent-preflight/core';

const agent = new Agent({
  name: 'main',
  description: 'Main agent for ${projectName}',
});

agent.on('message', async (ctx) => {
  await ctx.reply(\`Hello from \${agent.name}! How can I assist you?\`);
});

export default agent;
`,
    '.env.example': `# Provider API Keys
OPENAI_API_KEY=
ANTHROPIC_API_KEY=
# Preflight Configuration
PREFLIGHT_LOG_LEVEL=info
`,
    '.gitignore': `node_modules/
dist/
.env
*.log
.turbo
`,
  };

  const templates: Record<string, Record<string, string | null>> = {
    blank: base,
    starter: {
      ...base,
      'agents/helper.ts': `import { Agent } from '@agent-preflight/core';

export const helper = new Agent({
  name: 'helper',
  description: 'Utility helper agent',
});

helper.on('message', async (ctx) => {
  const { message } = ctx.payload;
  ctx.reply(\`Processing: \${message}\`);
});
`,
      'workflows/main.workflow.ts': `import { Workflow } from '@agent-preflight/core';

const workflow = new Workflow({
  name: 'main-workflow',
  steps: [
    { agent: 'main', action: 'process' },
    { agent: 'helper', action: 'enrich' },
  ],
});

export default workflow;
`,
    },
    'multi-agent': {
      ...base,
      'agents/researcher.ts': `import { Agent } from '@agent-preflight/core';

export const researcher = new Agent({
  name: 'researcher',
  description: 'Research and gather information',
  capabilities: ['web-search', 'data-collection'],
});
`,
      'agents/analyst.ts': `import { Agent } from '@agent-preflight/core';

export const analyst = new Agent({
  name: 'analyst',
  description: 'Analyze data and generate insights',
  capabilities: ['data-analysis', 'reporting'],
});
`,
      'agents/coordinator.ts': `import { Agent } from '@agent-preflight/core';
import { researcher } from './researcher.js';
import { analyst } from './analyst.js';

const coordinator = new Agent({
  name: 'coordinator',
  description: 'Coordinates research and analysis',
  agents: [researcher, analyst],
});

export default coordinator;
`,
    },
    workflow: {
      ...base,
      'workflows/pipeline.ts': `import { Workflow, Step } from '@agent-preflight/core';

const pipeline = new Workflow({
  name: 'data-pipeline',
  steps: [
    { name: 'ingest', agent: 'collector', timeout: 30000 },
    { name: 'transform', agent: 'processor', dependsOn: ['ingest'] },
    { name: 'load', agent: 'writer', dependsOn: ['transform'] },
  ],
  onError: 'rollback',
});

export default pipeline;
`,
    },
    chatbot: {
      ...base,
      'agents/chat.ts': `import { Agent } from '@agent-preflight/core';

const chat = new Agent({
  name: 'chatbot',
  description: 'Conversational AI assistant',
  model: 'gpt-4o',
  systemPrompt: 'You are a helpful assistant.',
  memory: { type: 'conversation', ttl: 3600 },
});

chat.on('message', async (ctx) => {
  const response = await ctx.llm.generate(ctx.messages);
  await ctx.reply(response);
});

export default chat;
`,
    },
    'tool-use': {
      ...base,
      'tools/calculator.ts': `import { Tool } from '@agent-preflight/core';

export const calculator = new Tool({
  name: 'calculator',
  description: 'Perform mathematical calculations',
  parameters: {
    expression: { type: 'string', description: 'Math expression' },
  },
  handler: async ({ expression }) => {
    return String(eval(expression));
  },
});
`,
      'agents/tool-agent.ts': `import { Agent } from '@agent-preflight/core';
import { calculator } from '../tools/calculator.js';

const agent = new Agent({
  name: 'tool-agent',
  description: 'Agent with tool-use capabilities',
  tools: [calculator],
});

export default agent;
`,
    },
  };

  return templates[template] ?? base;
}

export function registerInitCommand(program: Command, output: OutputManager): void {
  program
    .command('init')
    .description('Initialize a new Agent Preflight project')
    .argument('[path]', 'Project directory path')
    .option('-t, --template <template>', `Project template (${TEMPLATES.join(', ')})`)
    .option('-n, --name <name>', 'Project name')
    .option('-y, --yes', 'Skip prompts and use defaults')
    .action(async (projectPath: string | undefined, options: InitOptions) => {
      try {
        const targetDir = projectPath ? resolve(process.cwd(), projectPath) : process.cwd();
        const dirName = basename(targetDir);

        let answers: Record<string, string | boolean> = {};
        if (!options.yes) {
          answers = await inquirer.prompt([
            {
              type: 'input',
              name: 'projectName',
              message: 'Project name:',
              default: options.name ?? dirName,
              validate: (v: string) => v.trim().length > 0 || 'Project name is required',
            },
            {
              type: 'list',
              name: 'template',
              message: 'Select a template:',
              choices: TEMPLATES.map((t) => ({ name: t.charAt(0).toUpperCase() + t.slice(1).replace('-', ' '), value: t })),
              default: 'starter',
              when: () => !options.template,
            },
            {
              type: 'confirm',
              name: 'createDir',
              message: `Create project in ${targetDir}?`,
              default: true,
            },
          ]);
        }

        const projectName = options.name ?? (answers.projectName as string) ?? dirName;
        const template = options.template ?? (answers.template as string) ?? 'starter';
        const shouldCreate = options.yes || (answers.createDir as boolean);

        if (!shouldCreate) {
          output.error('Initialisation cancelled');
          process.exit(1);
        }

        if (existsSync(targetDir) && (await readdirSafe(targetDir)).length > 0) {
          if (!options.yes) {
            const { overwrite } = await inquirer.prompt([
              {
                type: 'confirm',
                name: 'overwrite',
                message: 'Directory is not empty. Continue?',
                default: false,
              },
            ]);
            if (!overwrite) {
              output.error('Initialisation cancelled');
              process.exit(1);
            }
          }
        }

        await formatSpinner('Creating project structure...', async () => {
          const files = getTemplateFiles(template, projectName);
          await makeDirStructure(targetDir, files);
        });

        output.success(`Project ${chalk.bold(projectName)} created successfully`);
        output.info(`Template: ${chalk.cyan(template)}`);
        output.info(`Location: ${chalk.cyan(targetDir)}`);

        output.raw(`
${chalk.bold('Next steps:')}
  ${chalk.cyan('cd')} ${targetDir}
  ${chalk.cyan('preflight dev')}
        `);
      } catch (error) {
        output.error(`Failed to initialize project: ${(error as Error).message}`);
        process.exit(1);
      }
    });
}

async function readdirSafe(dir: string): Promise<string[]> {
  try {
    const { readdir } = await import('fs/promises');
    return await readdir(dir);
  } catch {
    return [];
  }
}
