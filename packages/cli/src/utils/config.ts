import Conf from 'conf';
import { homedir } from 'os';
import { resolve } from 'path';

export interface CliConfig {
  lastChecked?: string;
  defaultTarget?: string;
  defaultNamespace?: string;
  preferredOutput?: 'json' | 'table' | 'pretty';
  telemetryEnabled?: boolean;
  providerPreferences?: Record<string, string>;
  recentProjects?: string[];
}

const schema = {
  lastChecked: { type: 'string' as const },
  defaultTarget: { type: 'string' as const },
  defaultNamespace: { type: 'string' as const },
  preferredOutput: { type: 'string' as const, enum: ['json', 'table', 'pretty'] },
  telemetryEnabled: { type: 'boolean' as const },
  providerPreferences: { type: 'object' as const },
  recentProjects: { type: 'array' as const },
};

export class ConfigManager {
  private store: Conf<CliConfig>;

  constructor() {
    this.store = new Conf<CliConfig>({
      projectName: 'agent-preflight',
      schema,
      defaults: {
        preferredOutput: 'pretty',
        telemetryEnabled: true,
        recentProjects: [],
      },
    });
  }

  get<K extends keyof CliConfig>(key: K): CliConfig[K] | undefined {
    return this.store.get(key);
  }

  set<K extends keyof CliConfig>(key: K, value: CliConfig[K]): void {
    this.store.set(key, value);
  }

  delete(key: keyof CliConfig): void {
    this.store.delete(key);
  }

  clear(): void {
    this.store.clear();
  }

  getConfigDir(): string {
    return resolve(homedir(), '.config', 'agent-preflight');
  }

  addRecentProject(path: string): void {
    const projects = this.store.get('recentProjects') ?? [];
    const filtered = projects.filter((p) => p !== path);
    filtered.unshift(path);
    this.store.set('recentProjects', filtered.slice(0, 10));
  }

  getRecentProjects(): string[] {
    return this.store.get('recentProjects') ?? [];
  }

  getAll(): CliConfig {
    return this.store.store;
  }
}

let _instance: ConfigManager | null = null;

export function getConfig(): ConfigManager {
  if (!_instance) {
    _instance = new ConfigManager();
  }
  return _instance;
}
