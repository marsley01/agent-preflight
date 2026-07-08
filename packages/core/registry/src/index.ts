export { AgentRegistry } from "./registry.js";
export type { RegistryOptions } from "./registry.js";

export { CapabilityMatcher } from "./capabilities.js";
export type {
  CapabilityCandidate,
  CapabilityMatch,
} from "./capabilities.js";

export { DiscoveryService } from "./discovery.js";
export type { DiscoveryOptions, DiscoveredAgent } from "./discovery.js";

export { HealthMonitor } from "./health.js";
export type { HealthMonitorOptions, HealthMetrics } from "./health.js";

export type {
  AgentRegistration,
  RegistryQuery,
  RegistryStats,
  RegistrationResult,
  AgentVersionRecord,
  HeartbeatRecord,
} from "./types.js";
