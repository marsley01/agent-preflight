import type { PreflightConfig } from "./types.js";

export function formatAsJSON(
  config: PreflightConfig,
  pretty = true,
): string {
  return pretty
    ? JSON.stringify(config, null, 2)
    : JSON.stringify(config);
}

export function formatAsEnv(config: PreflightConfig): string {
  const lines: string[] = [];

  function flatten(obj: Record<string, unknown>, prefix = ""): void {
    for (const [key, value] of Object.entries(obj)) {
      const envKey = `PREF_${prefix}${key}`
        .replace(/([A-Z])/g, "_$1")
        .toUpperCase();

      if (
        typeof value === "object" &&
        value !== null &&
        !Array.isArray(value)
      ) {
        flatten(value as Record<string, unknown>, `${envKey}_`);
      } else if (Array.isArray(value) && value.every((v) => typeof v === "string")) {
        lines.push(`${envKey}=${(value as string[]).join(",")}`);
      } else if (value !== undefined) {
        lines.push(`${envKey}=${String(value)}`);
      }
    }
  }

  flatten(config as unknown as Record<string, unknown>);

  return lines.join("\n");
}

export interface ConfigDiff {
  added: Array<{ path: string; value: unknown }>;
  removed: Array<{ path: string; value: unknown }>;
  modified: Array<{ path: string; oldValue: unknown; newValue: unknown }>;
}

export function diffConfigs(
  oldConfig: PreflightConfig,
  newConfig: PreflightConfig,
): ConfigDiff {
  const added: ConfigDiff["added"] = [];
  const removed: ConfigDiff["removed"] = [];
  const modified: ConfigDiff["modified"] = [];

  const oldFlat = flattenConfig(oldConfig);
  const newFlat = flattenConfig(newConfig);

  for (const key of Object.keys(oldFlat)) {
    if (!(key in newFlat)) {
      removed.push({ path: key, value: oldFlat[key] });
    } else if (oldFlat[key] !== newFlat[key]) {
      modified.push({
        path: key,
        oldValue: oldFlat[key],
        newValue: newFlat[key],
      });
    }
  }

  for (const key of Object.keys(newFlat)) {
    if (!(key in oldFlat)) {
      added.push({ path: key, value: newFlat[key] });
    }
  }

  return { added, removed, modified };
}

function flattenConfig(
  config: PreflightConfig,
  prefix = "",
): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(config)) {
    const fullKey = prefix.length > 0 ? `${prefix}.${key}` : key;

    if (
      typeof value === "object" &&
      value !== null &&
      !Array.isArray(value)
    ) {
      Object.assign(
        result,
        flattenConfig(value as unknown as PreflightConfig, fullKey),
      );
    } else {
      result[fullKey] = value;
    }
  }

  return result;
}
