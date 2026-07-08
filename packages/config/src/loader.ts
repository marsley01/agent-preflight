import { readFileSync, existsSync, watchFile } from "node:fs";
import { resolve, extname } from "node:path";
import { deepMerge } from "@agent-preflight/utils";
import { preflightConfigSchema } from "./schema.js";
import { loadEnvConfig } from "./env.js";
import { DEFAULT_PREFLIGHT_CONFIG } from "./defaults.js";
import type { PreflightConfig, ConfigChangeHandler } from "./types.js";

export interface ConfigLoaderOptions {
  configPath?: string;
  watch?: boolean;
  envOverrides?: boolean;
  onChange?: ConfigChangeHandler;
}

export class ConfigLoader {
  private currentConfig: PreflightConfig;
  private readonly options: Required<ConfigLoaderOptions>;
  private watcherTimer: ReturnType<typeof setInterval> | undefined;

  constructor(options: ConfigLoaderOptions = {}) {
    this.options = {
      configPath: options.configPath ?? this.discoverConfigFile(),
      watch: options.watch ?? false,
      envOverrides: options.envOverrides ?? true,
      onChange: options.onChange ?? (() => {}),
    };

    this.currentConfig = DEFAULT_PREFLIGHT_CONFIG;
  }

  load(): PreflightConfig {
    let config: PreflightConfig = DEFAULT_PREFLIGHT_CONFIG;

    const fileConfig = this.loadFileConfig();

    if (fileConfig !== null) {
      config = deepMerge(
        config as Record<string, unknown>,
        fileConfig as Record<string, unknown>,
      ) as PreflightConfig;
    }

    if (this.options.envOverrides) {
      const envConfig = loadEnvConfig();
      config = deepMerge(
        config as Record<string, unknown>,
        envConfig as Record<string, unknown>,
      ) as PreflightConfig;
    }

    const parsed = preflightConfigSchema.safeParse(config);

    if (!parsed.success) {
      const issues = parsed.error.issues
        .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
        .join("\n");

      throw new Error(
        `Configuration validation failed:\n${issues}`,
      );
    }

    this.currentConfig = parsed.data;

    if (this.options.watch) {
      this.startWatching();
    }

    return this.currentConfig;
  }

  private loadFileConfig(): Record<string, unknown> | null {
    const configPath = this.options.configPath;

    if (configPath === "") {
      return null;
    }

    if (!existsSync(configPath)) {
      return null;
    }

    const ext = extname(configPath).toLowerCase();
    const content = readFileSync(configPath, "utf-8");

    try {
      switch (ext) {
        case ".json":
        case ".jsonc": {
          const parsed = JSON.parse(content) as Record<string, unknown>;
          return parsed;
        }
        case ".js":
        case ".cjs": {
          // eslint-disable-next-line @typescript-eslint/no-require-imports
          const mod = require(resolve(configPath));
          return mod.default ?? mod;
        }
        default:
          throw new Error(`Unsupported config file format: ${ext}`);
      }
    } catch (error) {
      throw new Error(
        `Failed to load config file ${configPath}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  private discoverConfigFile(): string {
    const candidates = [
      "preflight.json",
      "preflight.jsonc",
      "preflight.config.js",
      "preflight.config.ts",
    ];

    for (const candidate of candidates) {
      const fullPath = resolve(process.cwd(), candidate);
      if (existsSync(fullPath)) {
        return fullPath;
      }
    }

    return "";
  }

  private startWatching(): void {
    const configPath = this.options.configPath;

    if (configPath === "") {
      return;
    }

    if (!existsSync(configPath)) {
      return;
    }

    try {
      watchFile(configPath, { interval: 2000 }, () => {
        try {
          const newConfig = this.load();

          this.options.onChange({
            type: "hotReload",
            source: configPath,
            config: newConfig,
          });
        } catch (error) {
          console.error(
            `[ConfigLoader] Failed to reload config: ${error instanceof Error ? error.message : String(error)}`,
          );
        }
      });
    } catch {
      // Fallback polling approach
      this.watcherTimer = setInterval(() => {
        this.checkForChanges();
      }, 5000);
    }
  }

  private checkForChanges(): void {
    const configPath = this.options.configPath;

    if (configPath === "") {
      return;
    }

    try {
      const stats = existsSync(configPath)
        ? undefined
        : undefined;

      if (stats !== undefined) {
        this.options.onChange({
          type: "hotReload",
          source: configPath,
          config: this.currentConfig,
        });
      }
    } catch {
      // Ignore errors during polling check
    }
  }

  getConfig(): PreflightConfig {
    return this.currentConfig;
  }

  stopWatching(): void {
    if (this.watcherTimer !== undefined) {
      clearInterval(this.watcherTimer);
      this.watcherTimer = undefined;
    }
  }
}
