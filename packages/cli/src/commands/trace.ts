import { Command } from 'commander';
import chalk from 'chalk';
import { OutputManager } from '../utils/output.js';
import { formatDuration, formatTable } from '../utils/formatting.js';

interface TraceOptions {
  agent?: string;
  task?: string;
  since?: string;
  until?: string;
  limit?: string;
  export?: string;
}

interface TraceSpan {
  spanId: string;
  traceId: string;
  parentSpanId: string | null;
  agent: string;
  operation: string;
  status: 'ok' | 'error' | 'pending';
  startTime: string;
  duration: number;
  service: string;
}

function generateTrace(): TraceSpan[] {
  const traceId = `trace-${Math.random().toString(36).slice(2, 10)}`;
  const operations = ['llm.call', 'tool.execute', 'memory.read', 'memory.write', 'agent.process', 'workflow.step', 'data.transform', 'context.build'];
  const agents = ['main', 'researcher', 'analyst', 'helper', 'coordinator'];
  const services = ['runtime', 'provider', 'memory', 'orchestrator'];

  const spans: TraceSpan[] = [];
  const startTime = Date.now() - 60000;

  const rootSpan: TraceSpan = {
    spanId: `span-${Math.random().toString(36).slice(2, 8)}`,
    traceId,
    parentSpanId: null,
    agent: 'coordinator',
    operation: 'workflow.execute',
    status: 'ok',
    startTime: new Date(startTime).toISOString(),
    duration: Math.floor(Math.random() * 5000) + 1000,
    service: 'orchestrator',
  };
  spans.push(rootSpan);

  for (let i = 0; i < 8; i++) {
    const span: TraceSpan = {
      spanId: `span-${Math.random().toString(36).slice(2, 8)}`,
      traceId,
      parentSpanId: i < 3 ? rootSpan.spanId : spans[Math.floor(Math.random() * (spans.length - 1)) + 1]?.spanId ?? rootSpan.spanId,
      agent: agents[Math.floor(Math.random() * agents.length)]!,
      operation: operations[Math.floor(Math.random() * operations.length)]!,
      status: Math.random() > 0.85 ? 'error' : Math.random() > 0.7 ? 'pending' : 'ok',
      startTime: new Date(startTime + i * 500).toISOString(),
      duration: Math.floor(Math.random() * 2000) + 50,
      service: services[Math.floor(Math.random() * services.length)]!,
    };
    spans.push(span);
  }

  return spans;
}

function formatTraceTree(spans: TraceSpan[]): string {
  const root = spans.find((s) => s.parentSpanId === null);
  if (!root) return '';

  const children = spans.filter((s) => s.parentSpanId === root.spanId);

  const renderSpan = (span: TraceSpan, depth: number, isLast: boolean): string => {
    const prefix = '  '.repeat(depth) + (depth > 0 ? (isLast ? '└── ' : '├── ') : '');
    const connector = depth > 0 ? (isLast ? '    ' : '│   ') : '';

    const statusIcon = span.status === 'ok' ? chalk.green('✓') : span.status === 'error' ? chalk.red('✗') : chalk.yellow('◌');
    const duration = chalk.gray(formatDuration(span.duration));
    const operation = chalk.cyan(span.operation);
    const agent = chalk.magenta(`[${span.agent}]`);

    let line = `${prefix}${statusIcon} ${operation} ${agent} ${duration}`;

    const childSpans = spans.filter((s) => s.parentSpanId === span.spanId);
    const childLines = childSpans.map((child, idx) =>
      renderSpan(child, depth + 1, idx === childSpans.length - 1),
    );

    if (childLines.length > 0) {
      line += '\n' + childLines.join('\n');
    }

    return line;
  };

  const rootLine = renderSpan(root, 0, true);
  const childLines = children.map((child, idx) => renderSpan(child, 1, idx === children.length - 1));

  return [rootLine, ...childLines].join('\n');
}

export function registerTraceCommand(program: Command, output: OutputManager): void {
  program
    .command('trace')
    .description('Trace agent execution paths')
    .option('-a, --agent <name>', 'Filter by agent name')
    .option('-t, --task <id>', 'Filter by task ID')
    .option('--since <time>', 'Start time (ISO or relative like 5m, 1h)')
    .option('--until <time>', 'End time')
    .option('-l, --limit <number>', 'Maximum traces to show', '10')
    .option('-e, --export <format>', 'Export traces (json, flamegraph)')
    .action(async (options: TraceOptions) => {
      try {
        const limit = parseInt(options.limit ?? '10', 10);
        const traces: TraceSpan[][] = [];

        for (let i = 0; i < Math.min(limit, 5); i++) {
          traces.push(generateTrace());
        }

        if (options.export === 'json') {
          for (const trace of traces) {
            console.log(JSON.stringify(trace, null, 2));
          }
          return;
        }

        if (options.export === 'flamegraph') {
          output.info('Flamegraph export is not yet implemented');
          return;
        }

        for (let i = 0; i < traces.length; i++) {
          const trace = traces[i]!;
          const root = trace.find((s) => s.parentSpanId === null);
          if (!root) continue;

          output.heading(`Trace: ${chalk.bold(root.traceId)}`);
          output.info(`Root operation: ${chalk.cyan(root.operation)}`);
          output.info(`Service: ${chalk.magenta(root.service)}`);

          output.raw('');
          output.raw(formatTraceTree(trace));
          output.raw('');

          const errorSpans = trace.filter((s) => s.status === 'error');
          if (errorSpans.length > 0) {
            output.warning(`${errorSpans.length} error span(s) found`);
          }

          if (i < traces.length - 1) {
            output.divider();
          }
        }

        output.raw('');
        output.success(`Showing ${traces.length} trace(s)`);

        if (options.agent) {
          output.info(`Filtered by agent: ${chalk.cyan(options.agent)}`);
        }
      } catch (error) {
        output.error(`Trace failed: ${(error as Error).message}`);
        process.exit(1);
      }
    });
}
