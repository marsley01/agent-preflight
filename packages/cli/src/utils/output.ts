import chalk from 'chalk';
import { formatJSON, formatTable, formatStatus, type TableColumn, type StatusType } from './formatting.js';

export type OutputMode = 'json' | 'table' | 'pretty';

export interface OutputOptions {
  mode?: OutputMode;
  quiet?: boolean;
}

const icons = {
  success: chalk.green('✔'),
  error: chalk.red('✖'),
  warning: chalk.yellow('⚠'),
  info: chalk.blue('ℹ'),
  debug: chalk.gray('◆'),
};

export class OutputManager {
  private mode: OutputMode;
  private quiet: boolean;

  constructor(options: OutputOptions = {}) {
    this.mode = options.mode ?? 'pretty';
    this.quiet = options.quiet ?? false;
  }

  setMode(mode: OutputMode): void {
    this.mode = mode;
  }

  setQuiet(quiet: boolean): void {
    this.quiet = quiet;
  }

  log(message: string): void {
    if (!this.quiet) {
      console.log(message);
    }
  }

  info(message: string): void {
    if (!this.quiet) {
      console.log(`${icons.info} ${chalk.blue(message)}`);
    }
  }

  success(message: string): void {
    if (!this.quiet) {
      console.log(`${icons.success} ${chalk.green(message)}`);
    }
  }

  warning(message: string): void {
    if (!this.quiet) {
      console.log(`${icons.warning} ${chalk.yellow(message)}`);
    }
  }

  error(message: string): void {
    console.error(`${icons.error} ${chalk.red(message)}`);
  }

  debug(message: string): void {
    if (!this.quiet) {
      console.log(`${icons.debug} ${chalk.gray(message)}`);
    }
  }

  raw(message: string): void {
    console.log(message);
  }

  table(columns: TableColumn[], rows: Record<string, unknown>[], options?: { head?: string[] }): void {
    switch (this.mode) {
      case 'json':
        console.log(formatJSON(rows));
        break;
      case 'table':
      case 'pretty':
      default:
        console.log(formatTable(columns, rows, options));
        break;
    }
  }

  object(data: Record<string, unknown>, title?: string): void {
    if (this.mode === 'json') {
      console.log(formatJSON(data));
      return;
    }

    if (title) {
      console.log(chalk.bold(`\n${title}`));
    }

    const maxKeyLen = Math.max(...Object.keys(data).map((k) => k.length));
    for (const [key, value] of Object.entries(data)) {
      const paddedKey = key.padEnd(maxKeyLen);
      const formattedValue = formatValueForDisplay(value);
      console.log(`  ${chalk.cyan(paddedKey)} : ${formattedValue}`);
    }
  }

  statusTable(rows: { name: string; status: StatusType; message?: string }[]): void {
    if (this.mode === 'json') {
      console.log(formatJSON(rows));
      return;
    }

    const table = formatTable(
      [
        { key: 'name', label: 'Component' },
        { key: 'status', label: 'Status', format: (v) => formatStatus(v as StatusType) },
        { key: 'message', label: 'Message' },
      ],
      rows as unknown as Record<string, unknown>[],
    );
    console.log(table);
  }

  divider(): void {
    if (this.mode !== 'json' && !this.quiet) {
      console.log(chalk.gray('─'.repeat(56)));
    }
  }

  heading(text: string): void {
    if (this.mode !== 'json' && !this.quiet) {
      console.log(`\n${chalk.bold.cyan(text)}`);
      console.log(chalk.gray('─'.repeat(text.length)));
    }
  }

  result(data: unknown): void {
    if (this.mode === 'json') {
      console.log(formatJSON(data));
    } else {
      console.log(data);
    }
  }

  getMode(): OutputMode {
    return this.mode;
  }
}

function formatValueForDisplay(value: unknown): string {
  if (value === null || value === undefined) return chalk.dim('—');
  if (typeof value === 'boolean') return value ? chalk.green('true') : chalk.red('false');
  if (typeof value === 'number') return chalk.yellow(String(value));
  if (Array.isArray(value)) {
    if (value.length === 0) return chalk.dim('[]');
    return value.map((v) => String(v)).join(', ');
  }
  if (typeof value === 'object') return chalk.dim(JSON.stringify(value));
  return String(value);
}

let _outputInstance: OutputManager | null = null;

export function getOutput(options?: OutputOptions): OutputManager {
  if (!_outputInstance || options) {
    _outputInstance = new OutputManager(options);
  }
  return _outputInstance;
}
