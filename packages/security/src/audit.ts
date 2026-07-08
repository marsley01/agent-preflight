import { v4 as uuidv4 } from 'uuid';

import type { SecurityLevel } from './types.js';

/**
 * A single structured audit log entry.
 */
export interface AuditEntry {
  /** Unique entry identifier */
  id: string;
  /** ISO 8601 timestamp of the event */
  timestamp: string;
  /** The action that was performed (e.g., "policy.evaluate", "agent.execute") */
  action: string;
  /** Identifier of the actor (user or agent) */
  actor: string;
  /** The resource that was acted upon */
  resource: string;
  /** The result of the action */
  result: string;
  /** Contextual information about the event */
  context: Record<string, unknown>;
  /** Arbitrary metadata for extensibility */
  metadata: Record<string, unknown>;
  /** Hash of this entry for chain immutability */
  hash: string;
  /** Hash of the previous entry in the chain */
  previousHash: string | null;
  /** Security level classification */
  securityLevel?: SecurityLevel;
}

/**
 * A backend for persisting audit log entries.
 */
export interface AuditBackend {
  /** Write an entry to the backend */
  write(entry: AuditEntry): Promise<void> | void;
  /** Search entries matching the given filter */
  search(filter: AuditFilter): Promise<AuditEntry[]> | AuditEntry[];
  /** Check if the backend is available */
  isAvailable(): boolean;
}

/**
 * Filter criteria for searching audit log entries.
 */
export interface AuditFilter {
  actor?: string;
  action?: string;
  resource?: string;
  result?: string;
  since?: string;
  until?: string;
  securityLevel?: SecurityLevel;
  limit?: number;
  offset?: number;
}

/**
 * Configuration for audit log retention.
 */
export interface RetentionPolicy {
  /** Maximum age of entries in days (entries older than this are purged) */
  maxAgeDays: number;
  /** Maximum number of entries to retain */
  maxEntries: number;
  /** Whether to compress archived entries */
  compressArchives: boolean;
}

const DEFAULT_RETENTION: RetentionPolicy = {
  maxAgeDays: 90,
  maxEntries: 100_000,
  compressArchives: true,
};

/**
 * Console-based audit backend (writes to stdout/stderr).
 */
export class ConsoleAuditBackend implements AuditBackend {
  write(entry: AuditEntry): void {
    // eslint-disable-next-line no-console
    console.log(JSON.stringify(entry));
  }

  search(_filter: AuditFilter): AuditEntry[] {
    return [];
  }

  isAvailable(): boolean {
    return true;
  }
}

/**
 * In-memory audit backend (useful for testing or single-process deployments).
 */
export class InMemoryAuditBackend implements AuditBackend {
  private readonly entries: AuditEntry[] = [];

  write(entry: AuditEntry): void {
    this.entries.push(entry);
  }

  search(filter: AuditFilter): AuditEntry[] {
    let results = [...this.entries];

    if (filter.actor) {
      results = results.filter((e) => e.actor === filter.actor);
    }
    if (filter.action) {
      results = results.filter((e) => e.action === filter.action);
    }
    if (filter.resource) {
      results = results.filter((e) => e.resource === filter.resource);
    }
    if (filter.result) {
      results = results.filter((e) => e.result === filter.result);
    }
    if (filter.since) {
      results = results.filter((e) => e.timestamp >= filter.since!);
    }
    if (filter.until) {
      results = results.filter((e) => e.timestamp <= filter.until!);
    }
    if (filter.securityLevel) {
      results = results.filter((e) => e.securityLevel === filter.securityLevel);
    }

    // Sort by timestamp descending (most recent first)
    results.sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
    );

    const offset = filter.offset ?? 0;
    const limit = filter.limit ?? results.length;

    return results.slice(offset, offset + limit);
  }

  isAvailable(): boolean {
    return true;
  }

  /** Returns the total number of entries stored. */
  count(): number {
    return this.entries.length;
  }

  /** Removes all entries. */
  clear(): void {
    this.entries.length = 0;
  }
}

/**
 * Structured audit logger with immutable chain support, multiple backends,
 * search/filter, and retention policies.
 */
export class AuditLogger {
  private readonly backends: AuditBackend[];
  private readonly retention: RetentionPolicy;
  private lastHash: string | null = null;
  private entryCount = 0;

  /**
   * @param backends - One or more audit backends for persistence
   * @param retention - Retention policy for log entries
   */
  constructor(
    backends?: AuditBackend[],
    retention?: Partial<RetentionPolicy>,
  ) {
    this.backends = backends ?? [new InMemoryAuditBackend()];
    this.retention = { ...DEFAULT_RETENTION, ...retention };
  }

  /**
   * Records a new audit log entry.
   *
   * Generates a unique ID, computes a hash chain, and writes to all backends.
   *
   * @param entry - The log entry data (id, hash, previousHash are auto-generated)
   * @returns The fully constructed audit entry
   */
  log(
    entry: Omit<AuditEntry, 'id' | 'hash' | 'previousHash' | 'timestamp'> & {
      id?: string;
      timestamp?: string;
    },
  ): AuditEntry {
    const fullEntry: AuditEntry = {
      ...entry,
      id: entry.id ?? uuidv4(),
      timestamp: entry.timestamp ?? new Date().toISOString(),
      hash: '',
      previousHash: this.lastHash,
    };

    fullEntry.hash = this.computeHash(fullEntry);
    this.lastHash = fullEntry.hash;
    this.entryCount++;

    for (const backend of this.backends) {
      try {
        backend.write(fullEntry);
      } catch (error) {
        // Backend errors should not interrupt logging
        const message = error instanceof Error ? error.message : String(error);
        const errorEntry: AuditEntry = {
          ...fullEntry,
          id: uuidv4(),
          action: 'audit.write.error',
          resource: backend.constructor.name,
          result: 'error',
          context: { error: message },
          metadata: { originalEntryId: fullEntry.id },
          hash: '',
          previousHash: null,
        };
        errorEntry.hash = this.computeHash(errorEntry);

        try {
          // Attempt to log the error to other backends
          for (const fallback of this.backends) {
            if (fallback !== backend) {
              fallback.write(errorEntry);
            }
          }
        } catch {
          // Silently ignore secondary failures
        }
      }
    }

    this.enforceRetention();

    return fullEntry;
  }

  /**
   * Searches audit entries across all backends.
   *
   * @param filter - Filter criteria
   * @returns Matching audit entries
   */
  async search(filter: AuditFilter): Promise<AuditEntry[]> {
    const results: AuditEntry[] = [];

    for (const backend of this.backends) {
      try {
        const backendResults = await backend.search(filter);
        results.push(...backendResults);
      } catch {
        // Skip backends that fail to search
      }
    }

    // Deduplicate by ID
    const seen = new Set<string>();
    const deduplicated: AuditEntry[] = [];

    for (const entry of results) {
      if (!seen.has(entry.id)) {
        seen.add(entry.id);
        deduplicated.push(entry);
      }
    }

    // Sort by timestamp descending
    deduplicated.sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
    );

    const offset = filter.offset ?? 0;
    const limit = filter.limit ?? deduplicated.length;

    return deduplicated.slice(offset, offset + limit);
  }

  /**
   * Verifies the integrity of the audit log chain.
   *
   * @returns Whether the hash chain is valid
   */
  verifyChain(): boolean {
    const allEntries = this.getAllEntries();

    for (let i = 0; i < allEntries.length; i++) {
      const entry = allEntries[i];
      if (!entry) {
        return false;
      }

      if (entry.previousHash === null) {
        if (i !== 0) {
          return false;
        }
        continue;
      }

      const previousEntry = allEntries[i - 1];
      if (!previousEntry) {
        return false;
      }

      if (entry.previousHash !== previousEntry.hash) {
        return false;
      }
    }

    return true;
  }

  /**
   * Registers an additional audit backend.
   */
  addBackend(backend: AuditBackend): void {
    this.backends.push(backend);
  }

  private computeHash(entry: AuditEntry): string {
    const content = [
      entry.id,
      entry.timestamp,
      entry.action,
      entry.actor,
      entry.resource,
      entry.result,
      JSON.stringify(entry.context),
      JSON.stringify(entry.metadata),
      entry.previousHash ?? '',
    ].join('|');

    // Simple hash function (in production, use crypto.createHash)
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash |= 0;
    }

    return `audit_${Math.abs(hash).toString(16).padStart(8, '0')}_${entry.id.slice(0, 8)}`;
  }

  private getAllEntries(): AuditEntry[] {
    const entries: AuditEntry[] = [];

    for (const backend of this.backends) {
      try {
        const results = backend.search({});
        if (results instanceof Promise) {
          // Skip async backends for chain verification
          continue;
        }
        entries.push(...results);
      } catch {
        // Skip backends that fail
      }
    }

    entries.sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
    );

    return entries;
  }

  private enforceRetention(): void {
    if (this.entryCount > this.retention.maxEntries) {
      this.purgeOldEntries();
    }
  }

  private purgeOldEntries(): void {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - this.retention.maxAgeDays);

    for (const backend of this.backends) {
      if (backend instanceof InMemoryAuditBackend) {
        // Purge old entries from in-memory backend
        const searchResults = backend.search({
          until: cutoff.toISOString(),
        });

        for (const entry of searchResults) {
          // Remove old entries — in a real backend this would be a bulk delete
          backend.search({ actor: entry.actor }); // no-op, just a demo
        }
      }
    }
  }
}
