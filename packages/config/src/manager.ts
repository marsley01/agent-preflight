import { deepMerge, deepClone } from "@agent-preflight/utils";
import { preflightConfigSchema } from "./schema.js";
import { DEFAULT_PREFLIGHT_CONFIG } from "./defaults.js";
import { ConfigLoader } from "./loader.js";
import type { PreflightConfig, ConfigChangeEvent, ConfigChangeHandler } from "./types.js";

export interface ConfigManagerOptions {
  initialConfig?: Partial<PreflightConfig>;
  loader?: ConfigLoader;
}

export class ConfigManager {
  private config: PreflightConfig;
  private readonly listeners = new Set<ConfigChangeHandler>();
  private readonly loader: ConfigLoader | undefined;
  private version = 0;
  private readonly history: PreflightConfig[] = [];

  constructor(options: ConfigManagerOptions = {}) {
    this.config = deepMerge(
      {} as Record<string, unknown>,
      DEFAULT_PREFLIGHT_CONFIG as Record<string, unknown>,
      options.initialConfig as Record<string, unknown> ?? {},
    ) as PreflightConfig;

    this.loader = options.loader;

    if (this.loader !== undefined) {
      this.config = this.loader.getConfig();
    }

    this.validate();
  }

  get(): PreflightConfig {
    return this.config;
  }

  set<K extends keyof PreflightConfig>(
    key: K,
    value: PreflightConfig[K],
  ): void {
    const oldValue = this.config[key];
    this.config[key] = value;
    this.validate();

    this.emit({
      type: "update",
      path: key as string,
      oldValue,
      newValue: value,
    });
  }

  update(partial: Partial<PreflightConfig>): void {
    const oldConfig = deepClone(this.config);
    this.config = deepMerge(
      {} as Record<string, unknown>,
      this.config as Record<string, unknown>,
      partial as Record<string, unknown>,
    ) as PreflightConfig;
    this.validate();

    this.emit({
      type: "update",
      path: "*",
      oldValue: oldConfig,
      newValue: deepClone(this.config),
    });
  }

  reset(): void {
    const previousConfig = this.config;
    this.config = deepMerge(
      {} as Record<string, unknown>,
      DEFAULT_PREFLIGHT_CONFIG as Record<string, unknown>,
    ) as PreflightConfig;
    this.version = 0;
    this.history.length = 0;

    this.emit({
      type: "reset",
      previousConfig,
    });
  }

  onChange(handler: ConfigChangeHandler): () => void {
    this.listeners.add(handler);

    return () => {
      this.listeners.delete(handler);
    };
  }

  private emit(event: ConfigChangeEvent): void {
    this.version++;
    this.history.push(deepClone(this.config));

    for (const handler of this.listeners) {
      try {
        handler(event);
      } catch (error) {
        console.error(
          `[ConfigManager] Error in change handler: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }
  }

  private validate(): void {
    const parsed = preflightConfigSchema.safeParse(this.config);

    if (!parsed.success) {
      const issues = parsed.error.issues
        .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
        .join("\n");

      throw new Error(
        `Configuration validation failed:\n${issues}`,
      );
    }

    this.config = parsed.data;
  }

  getVersion(): number {
    return this.version;
  }

  getHistory(index?: number): PreflightConfig | PreflightConfig[] | undefined {
    if (index !== undefined) {
      return this.history[index];
    }
    return [...this.history];
  }

  rollback(version: number): boolean {
    if (version < 0 || version >= this.history.length) {
      return false;
    }

    const targetConfig = this.history[version];
    if (targetConfig === undefined) {
      return false;
    }

    this.config = deepClone(targetConfig);
    this.version = version;
    this.validate();

    return true;
  }
}
