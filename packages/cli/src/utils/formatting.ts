import chalk from 'chalk';
import Table from 'cli-table3';
import ora from 'ora';

export type StatusType = 'success' | 'error' | 'warning' | 'info' | 'pending' | 'running';

export interface TableColumn {
  key: string;
  label: string;
  format?: (value: unknown) => string;
}

export function formatTable(columns: TableColumn[], rows: Record<string, unknown>[], options: { head?: string[]; style?: Record<string, unknown> } = {}): string {
  const head = options.head ?? columns.map((c) => c.label);
  const table = new Table({
    head: head.map((h) => chalk.bold(h)),
    style: {
      head: [],
      border: ['gray'],
      ...options.style,
    },
  });

  for (const row of rows) {
    const values = columns.map((col) => {
      const value = row[col.key];
      return col.format ? col.format(value) : formatValue(value);
    });
    table.push(values);
  }

  return table.toString();
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return chalk.dim('—');
  if (typeof value === 'boolean') return value ? chalk.green('✓') : chalk.red('✗');
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

export function formatJSON(data: unknown): string {
  return JSON.stringify(data, null, 2);
}

export function formatStatus(status: StatusType): string {
  const icons: Record<StatusType, string> = {
    success: chalk.green('●'),
    error: chalk.red('●'),
    warning: chalk.yellow('●'),
    info: chalk.blue('●'),
    pending: chalk.gray('○'),
    running: chalk.cyan('◌'),
  };

  const labels: Record<StatusType, string> = {
    success: chalk.green('Healthy'),
    error: chalk.red('Error'),
    warning: chalk.yellow('Warning'),
    info: chalk.blue('Info'),
    pending: chalk.gray('Pending'),
    running: chalk.cyan('Running'),
  };

  return `${icons[status]} ${labels[status]}`;
}

export function formatDuration(ms: number): string {
  if (ms < 1) return `${(ms * 1000).toFixed(2)}μs`;
  if (ms < 1000) return `${ms.toFixed(2)}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(2)}s`;
  const minutes = Math.floor(ms / 60000);
  const seconds = ((ms % 60000) / 1000).toFixed(1);
  return `${minutes}m ${seconds}s`;
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const val = bytes / Math.pow(1024, i);
  return `${val.toFixed(i === 0 ? 0 : 2)} ${units[i]!}`;
}

export function formatPercentage(value: number, total: number): string {
  if (total === 0) return chalk.dim('0.0%');
  const pct = (value / total) * 100;
  const formatted = pct.toFixed(1);
  if (pct >= 90) return chalk.green(`${formatted}%`);
  if (pct >= 50) return chalk.yellow(`${formatted}%`);
  return chalk.red(`${formatted}%`);
}

export async function formatSpinner<T>(message: string, fn: () => Promise<T>): Promise<T> {
  const spinner = ora({ text: message, spinner: 'dots' }).start();
  try {
    const result = await fn();
    spinner.succeed();
    return result;
  } catch (error) {
    spinner.fail();
    throw error;
  }
}

export function colorizeDiff(value: number, higherIsBetter: boolean): string {
  const isGood = higherIsBetter ? value > 0 : value < 0;
  const prefix = value > 0 ? '+' : '';
  const formatted = `${prefix}${value.toFixed(2)}`;
  return isGood ? chalk.green(formatted) : chalk.red(formatted);
}
