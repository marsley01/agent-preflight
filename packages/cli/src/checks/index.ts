/**
 * Scanner check modules.
 * Each module exports a single async function that takes a project directory
 * path and returns an array of {@link import('../scan').CheckResult}.
 *
 * @module checks
 */

export { runSecurityChecks } from './security';
export { runAuthChecks } from './auth';
export { runPaymentChecks } from './payments';
export { runDatabaseChecks } from './database';
export { runApiChecks } from './api';
export { runWebChecks } from './web';
export { runGraphqlChecks } from './graphql';
export { runRealtimeChecks } from './realtime';
export { runSupabaseChecks } from './supabase';
export { runVulnerabilityChecks } from './vulnerabilities';
