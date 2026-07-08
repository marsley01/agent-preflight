import type { PreflightConfig } from "./types.js";

const ENV_PREFIX = "PREF_";

const ENV_MAPPINGS: Array<{
  envVar: string;
  configPath: string;
  transform?: (value: string) => unknown;
}> = [
  { envVar: `${ENV_PREFIX}VERSION`, configPath: "version" },
  { envVar: `${ENV_PREFIX}NAME`, configPath: "name" },
  { envVar: `${ENV_PREFIX}DESCRIPTION`, configPath: "description" },
  { envVar: `${ENV_PREFIX}RUNTIME_ENVIRONMENT`, configPath: "runtime.environment" },
  { envVar: `${ENV_PREFIX}RUNTIME_NODE_ENV`, configPath: "runtime.nodeEnv" },
  { envVar: `${ENV_PREFIX}RUNTIME_DEBUG`, configPath: "runtime.debug", transform: (v) => v === "true" },
  { envVar: `${ENV_PREFIX}RUNTIME_LOG_LEVEL`, configPath: "runtime.logLevel" },
  { envVar: `${ENV_PREFIX}RUNTIME_CONCURRENCY`, configPath: "runtime.concurrency", transform: Number },
  { envVar: `${ENV_PREFIX}RUNTIME_SHUTDOWN_TIMEOUT`, configPath: "runtime.shutdownTimeout", transform: Number },
  { envVar: `${ENV_PREFIX}RUNTIME_TEMP_DIR`, configPath: "runtime.tempDir" },
  { envVar: `${ENV_PREFIX}RUNTIME_DATA_DIR`, configPath: "runtime.dataDir" },
  { envVar: `${ENV_PREFIX}RUNTIME_CACHE_ENABLED`, configPath: "runtime.cache.enabled", transform: (v) => v === "true" },
  { envVar: `${ENV_PREFIX}RUNTIME_CACHE_TTL`, configPath: "runtime.cache.ttl", transform: Number },
  { envVar: `${ENV_PREFIX}API_PORT`, configPath: "api.port", transform: Number },
  { envVar: `${ENV_PREFIX}API_HOST`, configPath: "api.host" },
  { envVar: `${ENV_PREFIX}API_BASE_PATH`, configPath: "api.basePath" },
  { envVar: `${ENV_PREFIX}API_CORS_ORIGINS`, configPath: "api.cors.origins", transform: (v) => v.split(",") },
  { envVar: `${ENV_PREFIX}API_BODY_LIMIT`, configPath: "api.bodyLimit", transform: Number },
  { envVar: `${ENV_PREFIX}API_TIMEOUT`, configPath: "api.timeout", transform: Number },
  { envVar: `${ENV_PREFIX}API_SSL_ENABLED`, configPath: "api.ssl.enabled", transform: (v) => v === "true" },
  { envVar: `${ENV_PREFIX}SECURITY_ENCRYPTION_ENABLED`, configPath: "security.encryption.enabled", transform: (v) => v === "true" },
  { envVar: `${ENV_PREFIX}SECURITY_SANDBOX_ENABLED`, configPath: "security.sandbox.enabled", transform: (v) => v === "true" },
  { envVar: `${ENV_PREFIX}SECURITY_RATE_LIMITING_ENABLED`, configPath: "security.rateLimiting.enabled", transform: (v) => v === "true" },
  { envVar: `${ENV_PREFIX}SECURITY_RATE_LIMITING_MAX_REQUESTS`, configPath: "security.rateLimiting.maxRequests", transform: Number },
  { envVar: `${ENV_PREFIX}OBSERVABILITY_TRACING_ENABLED`, configPath: "observability.tracing.enabled", transform: (v) => v === "true" },
  { envVar: `${ENV_PREFIX}OBSERVABILITY_TRACING_EXPORTER`, configPath: "observability.tracing.exporter" },
  { envVar: `${ENV_PREFIX}OBSERVABILITY_METRICS_ENABLED`, configPath: "observability.metrics.enabled", transform: (v) => v === "true" },
  { envVar: `${ENV_PREFIX}OBSERVABILITY_METRICS_EXPORTER`, configPath: "observability.metrics.exporter" },
  { envVar: `${ENV_PREFIX}OBSERVABILITY_LOGGING_LEVEL`, configPath: "observability.logging.level" },
  { envVar: `${ENV_PREFIX}OBSERVABILITY_LOGGING_FORMAT`, configPath: "observability.logging.format" },
  { envVar: `${ENV_PREFIX}MEMORY_STORAGE_TYPE`, configPath: "memory.storage.type" },
  { envVar: `${ENV_PREFIX}MEMORY_STORAGE_CONNECTION`, configPath: "memory.storage.connectionString" },
  { envVar: `${ENV_PREFIX}MEMORY_ENCRYPTION_ENABLED`, configPath: "memory.encryptionEnabled", transform: (v) => v === "true" },
  { envVar: `${ENV_PREFIX}PLUGINS_ENABLED`, configPath: "plugins.enabled", transform: (v) => v === "true" },
  { envVar: `${ENV_PREFIX}PLUGINS_DIRECTORY`, configPath: "plugins.directory" },
  { envVar: `${ENV_PREFIX}PLUGINS_AUTO_LOAD`, configPath: "plugins.autoLoad", transform: (v) => v === "true" },
  { envVar: `${ENV_PREFIX}DEPLOYMENT_TARGET`, configPath: "deployment.target" },
  { envVar: `${ENV_PREFIX}DEPLOYMENT_REPLICAS`, configPath: "deployment.replicas", transform: Number },
];

function setNestedValue(
  obj: Record<string, unknown>,
  path: string,
  value: unknown,
): void {
  const keys = path.split(".");
  let current = obj;

  for (let i = 0; i < keys.length; i++) {
    const key = keys[i] as string;
    const isLast = i === keys.length - 1;

    if (isLast) {
      current[key] = value;
    } else {
      const existing = current[key];
      if (typeof existing !== "object" || existing === null) {
        const next: Record<string, unknown> = {};
        current[key] = next;
        current = next;
      } else {
        current = existing as Record<string, unknown>;
      }
    }
  }
}

export function loadEnvConfig(): Partial<PreflightConfig> {
  const config: Record<string, unknown> = {};

  for (const mapping of ENV_MAPPINGS) {
    const envValue = process.env[mapping.envVar];

    if (envValue === undefined || envValue === "") {
      continue;
    }

    const value =
      mapping.transform !== undefined
        ? mapping.transform(envValue)
        : envValue;

    setNestedValue(config, mapping.configPath, value);
  }

  return config as Partial<PreflightConfig>;
}
