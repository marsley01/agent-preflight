# Security Guide

---

## Overview of Security Architecture

Agent Preflight implements a defense-in-depth security model with multiple independent layers:

```
                      ┌─────────────────────────────────┐
                      │         Network Perimeter          │
                      │    (TLS, mTLS, IP allowlisting)    │
                      └──────────────┬──────────────────┘
                                     │
                      ┌──────────────▼──────────────────┐
                      │        Authentication             │
                      │  (API Keys / JWT / OAuth / mTLS)  │
                      └──────────────┬──────────────────┘
                                     │
                      ┌──────────────▼──────────────────┐
                      │         Authorization             │
                      │      (RBAC + ABAC + Policy)       │
                      └──────────────┬──────────────────┘
                                     │
                      ┌──────────────▼──────────────────┐
                      │        Input Validation           │
                      │  (Injection Detection / Sanitizer)│
                      └──────────────┬──────────────────┘
                                     │
                      ┌──────────────▼──────────────────┐
                      │        Execution Sandbox          │
                      │   (Resource Limits / Isolation)   │
                      └──────────────┬──────────────────┘
                                     │
                      ┌──────────────▼──────────────────┐
                      │        Data Protection            │
                      │  (Encryption / Audit / Secrets)   │
                      └─────────────────────────────────┘
```

---

## Securing API Keys and Secrets

### API Key Best Practices

1. **Use environment variables** — Never hardcode keys in source code
2. **Rotate keys regularly** — Set expiry dates on all keys
3. **Scope keys appropriately** — Grant minimum required permissions
4. **Use separate keys** — Different keys for development, staging, production

```bash
# .env (never commit to version control)
OPENAI_API_KEY=sk-proj-...
ANTHROPIC_API_KEY=sk-ant-...
PREFLIGHT_API_KEY=ap_...
PREFLIGHT_ENCRYPTION_KEY=hex-encoded-32-byte-key
```

### Secret Storage

```typescript
import { EncryptionService } from '@agent-preflight/security';

const encryption = new EncryptionService({
  algorithm: 'aes-256-gcm',
  key: process.env.PREFLIGHT_ENCRYPTION_KEY,
});

// Encrypt sensitive configuration
const encrypted = encryption.encrypt(sensitiveApiKey);

// Store in memory with restricted access
await memory.save('ENCRYPTED', 'stripe-key', encrypted, {
  accessControl: [
    { principalId: 'payment-agent', permission: 'READ' },
  ],
});
```

### API Key Management CLI

```bash
# Generate a new API key
preflight api-key create --label "CI/CD Pipeline" --scopes "agent:read,task:write"

# List existing keys
preflight api-key list

# Revoke a key
preflight api-key revoke ap_abc123def456
```

---

## Configuring RBAC

### Built-in Roles

```json
{
  "security": {
    "rbac": {
      "roles": {
        "admin": {
          "permissions": ["*:*"]
        },
        "operator": {
          "permissions": [
            "agent:*", "task:*", "memory:*",
            "model:read", "plugin:*", "config:read"
          ]
        },
        "developer": {
          "permissions": [
            "agent:*", "task:*", "memory:*",
            "model:read", "plugin:read", "config:read"
          ],
          "inherits": ["viewer"]
        },
        "agent": {
          "permissions": [
            "task:read", "task:write",
            "memory:read", "memory:write",
            "model:read"
          ]
        },
        "viewer": {
          "permissions": ["agent:read", "task:read", "memory:read"]
        }
      }
    }
  }
}
```

### Custom Role Example

```typescript
const rbac = new RBACManager();

rbac.addRole(
  'compliance-officer',
  ['audit:read', 'log:read', 'agent:read', 'task:read', 'memory:read'],
  ['viewer'],
  'Compliance officer with read-only access to audit trails',
);

rbac.assignRole('user-456', 'compliance-officer');
```

### Permission Checking

```typescript
const result = rbac.checkPermission('user-456', 'memory', 'write');
if (result.decision === 'denied') {
  throw new Error('Access denied');
}
```

---

## Writing ABAC Policies

ABAC policies evaluate access based on attributes of the subject, resource, action, and environment.

### Policy Structure

```typescript
interface ABACPolicy {
  id: string;
  name: string;
  effect: 'ALLOW' | 'DENY';
  conditions: {
    subject?: AttributeCondition[];   // Who is making the request
    resource?: AttributeCondition[];  // What resource is being accessed
    action?: string[];                // What action is being performed
    context?: AttributeCondition[];   // Under what circumstances
  };
  priority: number;
  enabled: boolean;
}
```

### Example Policies

**Time-based access:**

```typescript
abac.definePolicy({
  name: 'Restrict production access to business hours',
  effect: 'ALLOW',
  conditions: {
    subject: [
      { field: 'role', operator: 'in', value: ['developer', 'operator'] },
    ],
    resource: [
      { field: 'environment', operator: 'equals', value: 'production' },
    ],
    action: ['deploy', 'config:write'],
    context: [
      { field: 'timeOfDay', operator: 'greaterThanOrEqual', value: 9 },
      { field: 'timeOfDay', operator: 'lessThanOrEqual', value: 17 },
      { field: 'dayOfWeek', operator: 'in', value: [1, 2, 3, 4, 5] }, // Mon-Fri
    ],
  },
  priority: 100,
  enabled: true,
});
```

**Geo-restriction:**

```typescript
abac.definePolicy({
  name: 'Allow access only from corporate IP range',
  effect: 'ALLOW',
  conditions: {
    context: [
      { field: 'ipAddress', operator: 'matches', value: '10\\.0\\..*' },
    ],
    action: ['*'],
  },
  priority: 200,
  enabled: true,
});
```

**Deny sensitive operations:**

```typescript
abac.definePolicy({
  name: 'Deny deletion of audit logs',
  effect: 'DENY',
  conditions: {
    resource: [
      { field: 'type', operator: 'equals', value: 'audit-log' },
    ],
    action: ['delete'],
  },
  priority: 999,  // DENY with high priority overrides ALLOW
  enabled: true,
});
```

### Policy Evaluation

```typescript
const decision = abac.evaluate({
  subject: { role: 'developer', department: 'engineering' },
  resource: { type: 'agent', environment: 'production', id: 'agent-42' },
  action: 'deploy',
  context: { timeOfDay: 14, dayOfWeek: 3, ipAddress: '10.0.1.100' },
});
```

---

## Setting Up Audit Logging

### Configuration

```json
{
  "security": {
    "audit": {
      "enabled": true,
      "backend": "elasticsearch",
      "retention": {
        "maxEntries": 1000000,
        "maxAgeDays": 90
      },
      "events": [
        "AUTH_SUCCESS", "AUTH_FAILURE", "ACCESS_DENIED",
        "API_KEY_CREATED", "API_KEY_REVOKED",
        "SANDBOX_VIOLATION", "MALICIOUS_INPUT_DETECTED",
        "SECRET_ACCESSED", "SECRET_ROTATED",
        "CONFIG_CHANGE", "ROLE_CHANGE"
      ]
    }
  }
}
```

### Programmatic Audit

```typescript
const audit = new AuditLogger(new ConsoleAuditBackend());

await audit.log({
  eventType: 'ACCESS_DENIED',
  actorId: 'user-456',
  actorType: 'USER',
  resourceType: 'agent',
  resourceId: 'agent-42',
  action: 'deploy',
  result: 'DENIED',
  context: requestContext,
  details: { reason: 'Production deploys restricted to business hours' },
});
```

### Querying Audit Logs

```bash
preflight audit query --event-type ACCESS_DENIED --actor user-456 --from 2026-01-01
```

---

## Prompt Injection Prevention

The `InjectionDetector` scans all LLM-bound inputs for malicious content:

```typescript
import { InjectionDetector } from '@agent-preflight/security';

const detector = new InjectionDetector({
  sensitivity: 'high',
  patterns: ['jailbreak', 'prompt-leak', 'role-play'],
});

// Before sending to LLM
const result = detector.detect(userInput);
if (result.detected) {
  // Sanitize or reject
  const sanitized = detector.sanitize(userInput);
  log.warn('Prompt injection detected', { input: userInput, type: result.type });
}
```

### Best Practices

1. **Always validate user inputs** before passing to LLM context
2. **Separate system prompts from user content** with delimiters
3. **Apply principle of least privilege** in system prompts
4. **Monitor and log** all injection detection events
5. **Use output validation** to detect leaked system prompts

---

## Best Practices Checklist

### Authentication
- [ ] API keys use minimum required scopes
- [ ] JWT tokens have reasonable expiry (1 hour default)
- [ ] MFA enabled for admin accounts
- [ ] Session management enabled for user-facing access
- [ ] Revoked tokens and keys are immediately invalidated

### Authorization
- [ ] RBAC roles follow least privilege principle
- [ ] ABAC policies enforce time/geo/resource constraints
- [ ] Default-deny for all cross-agent memory access
- [ ] Regular audit of role assignments and policies

### Data Protection
- [ ] Encryption enabled for sensitive memory entries
- [ ] Encryption keys rotated every 90 days
- [ ] Secrets never logged or exposed in error messages
- [ ] Audit logging enabled for all security events

### Execution Safety
- [ ] Sandbox enabled for custom tool/plugin execution
- [ ] Network access restricted for untrusted agents
- [ ] Rate limiting configured per agent and per provider
- [ ] Prompt injection detection enabled for all user-facing inputs

### Operations
- [ ] TLS enabled for all network communication
- [ ] Health checks configured for all agents
- [ ] Crash recovery and restart policies configured
- [ ] Monitoring alerts for security events (severity: HIGH+)
- [ ] Regular security reviews of agent capabilities and permissions
