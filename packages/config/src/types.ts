import type { z } from "zod";
import type {
  preflightConfigSchema,
  agentConfigSchema,
  providerConfigSchema,
  runtimeConfigSchema,
  securityConfigSchema,
  memoryConfigSchema,
  pluginConfigSchema,
  apiConfigSchema,
  observabilityConfigSchema,
  loggingConfigSchema,
  deploymentConfigSchema,
} from "./schema.js";

export type PreflightConfig = z.infer<typeof preflightConfigSchema>;
export type AgentConfig = z.infer<typeof agentConfigSchema>;
export type ProviderConfig = z.infer<typeof providerConfigSchema>;
export type RuntimeConfig = z.infer<typeof runtimeConfigSchema>;
export type SecurityConfig = z.infer<typeof securityConfigSchema>;
export type MemoryConfig = z.infer<typeof memoryConfigSchema>;
export type PluginConfig = z.infer<typeof pluginConfigSchema>;
export type APIConfig = z.infer<typeof apiConfigSchema>;
export type ObservabilityConfig = z.infer<typeof observabilityConfigSchema>;
export type LoggingConfig = z.infer<typeof loggingConfigSchema>;
export type DeploymentConfig = z.infer<typeof deploymentConfigSchema>;

export type ConfigChangeEvent =
  | { type: "update"; path: string; oldValue: unknown; newValue: unknown }
  | { type: "reset"; previousConfig: PreflightConfig }
  | { type: "hotReload"; source: string; config: PreflightConfig };

export type ConfigChangeHandler = (event: ConfigChangeEvent) => void;
