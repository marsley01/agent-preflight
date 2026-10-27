/**
 * Scanner check modules.
 * Each category receives the pre-loaded {@link ProjectContext} and returns
 * an array of {@link CheckResult}.
 *
 * @module checks
 */
import type { Category } from '../types.js';
import { runSecurityChecks } from './security.js';
import { runVulnerabilityChecks } from './vulnerabilities.js';
import { runDependencyChecks } from './dependencies.js';
import { runAuthChecks } from './auth.js';
import { runApiChecks } from './api.js';
import { runDatabaseChecks } from './database.js';
import { runPaymentChecks } from './payments.js';
import { runWebChecks } from './web.js';
import { runAiChecks } from './ai.js';
import { runGraphqlChecks } from './graphql.js';
import { runRealtimeChecks } from './realtime.js';
import { runUiChecks } from './ui.js';

export const CATEGORIES: Category[] = [
  { id: 'security', name: 'Secrets', run: runSecurityChecks },
  { id: 'vulnerabilities', name: 'Code Vulnerabilities', run: runVulnerabilityChecks },
  { id: 'dependencies', name: 'Dependencies', run: runDependencyChecks },
  { id: 'auth', name: 'Authentication', run: runAuthChecks },
  { id: 'api', name: 'API & Validation', run: runApiChecks },
  { id: 'database', name: 'Database', run: runDatabaseChecks },
  { id: 'payments', name: 'Payments', run: runPaymentChecks },
  { id: 'web', name: 'Web Security', run: runWebChecks },
  { id: 'ai', name: 'AI / LLM', run: runAiChecks },
  { id: 'graphql', name: 'GraphQL', run: runGraphqlChecks },
  { id: 'realtime', name: 'Real-Time', run: runRealtimeChecks },
  { id: 'ui', name: 'UI & Content', run: runUiChecks },
];
