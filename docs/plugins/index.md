# Plugin Development Guide

---

## Plugin Architecture

Plugins extend Agent Preflight with custom functionality. They are self-contained packages that hook into the runtime lifecycle and can add new capabilities, providers, tools, memory backends, security policies, or UI components.

```
┌────────────────────────────────────────────────────┐
│                    Runtime                           │
│                                                      │
│  ┌─────────────┐    ┌───────────────────────────┐   │
│  │ Plugin      │    │  Plugin Instance           │   │
│  │ Registry    │───►│                            │   │
│  │             │    │  ┌─────────────────────┐   │   │
│  │ load()      │    │  │  Lifecycle Hooks    │   │   │
│  │ unload()    │    │  │  onActivate()       │   │   │
│  │ get()       │    │  │  onDeactivate()     │   │   │
│  │ list()      │    │  │  onMessage()        │   │   │
│  └─────────────┘    │  └─────────────────────┘   │   │
│                      │                            │   │
│                      │  ┌─────────────────────┐   │   │
│                      │  │  Exported Hooks      │   │   │
│                      │  │  middleware()        │   │   │
│                      │  │  capabilities()      │   │   │
│                      │  │  tools()             │   │   │
│                      │  └─────────────────────┘   │   │
│                      └────────────────────────────┘   │
└────────────────────────────────────────────────────┘
```

### Plugin Types

| Type | Description |
|---|---|
| `INTEGRATION` | External service integration (Slack, GitHub, Jira, etc.) |
| `PROVIDER` | Custom LLM provider implementation |
| `MEMORY` | Custom memory backend (e.g., Pinecone, Weaviate) |
| `SECURITY` | Custom security policy, auth provider, or audit backend |
| `EVALUATION` | Custom evaluation metric or framework |
| `OBSERVABILITY` | Custom telemetry exporter |
| `UI` | Custom UI components for the dashboard |
| `TOOL` | Custom tool definitions |

---

## Creating a Plugin

### Project Structure

```
my-plugin/
├── package.json
├── plugin.json          # Plugin manifest
├── src/
│   ├── index.ts         # Main entry point
│   ├── hooks.ts         # Lifecycle hooks
│   └── tools.ts         # Tool definitions
├── tsconfig.json
└── README.md
```

### Plugin Entry Point

```typescript
// src/index.ts
import type { PluginManifest } from '@agent-preflight/types';

export const manifest: PluginManifest = {
  id: 'my-plugin',
  name: 'My Custom Plugin',
  version: '1.0.0',
  type: 'INTEGRATION',
  description: 'Integrates with Example Service',
  author: 'Your Name',
  license: 'MIT',
  entryPoint: './dist/index.js',
  dependencies: [],
  permissions: ['memory:read', 'memory:write'],
  capabilities: ['example-integration'],
};

// Lifecycle hooks
export async function onActivate(context: PluginContext): Promise<void> {
  context.logger.info('My plugin activated');
  await context.memory.save('WORKING', 'plugin:my-plugin:status', 'active');
}

export async function onDeactivate(context: PluginContext): Promise<void> {
  context.logger.info('My plugin deactivated');
}

// Middleware hook
export function middleware(context: PluginContext): PluginMiddleware {
  return async (message, next) => {
    context.logger.debug(`Intercepted message: ${message.header.messageType}`);
    return next(message);
  };
}

// Capability registration
export function capabilities(): PluginCapability[] {
  return [
    {
      name: 'example-integration',
      description: 'Integrates with Example Service API',
      tools: ['example-query', 'example-mutate'],
    },
  ];
}
```

---

## Plugin Manifest Format

The `plugin.json` (or `manifest` export) describes the plugin's identity and requirements:

```json
{
  "id": "my-plugin",
  "name": "My Custom Plugin",
  "version": "1.0.0",
  "type": "INTEGRATION",
  "description": "Integrates with Example Service API",
  "author": "Your Name",
  "license": "MIT",
  "entryPoint": "./dist/index.js",
  "dependencies": [
    { "pluginId": "core-utils", "version": ">=1.0.0" }
  ],
  "optionalDependencies": [
    { "pluginId": "analytics", "version": ">=2.0.0" }
  ],
  "permissions": [
    "memory:read",
    "memory:write",
    "network:connect"
  ],
  "capabilities": [
    "example-integration",
    "data-transformation"
  ],
  "homepage": "https://github.com/me/my-plugin",
  "repository": "https://github.com/me/my-plugin.git",
  "documentation": "https://docs.example.com/my-plugin"
}
```

### Manifest Fields

| Field | Type | Required | Description |
|---|---|---|---|
| `id` | string | Yes | Unique plugin identifier |
| `name` | string | Yes | Human-readable name |
| `version` | SemVer | Yes | Plugin version |
| `type` | PluginType | Yes | Plugin classification |
| `description` | string | Yes | Short description |
| `author` | string | Yes | Plugin author |
| `license` | string | Yes | SPDX license identifier |
| `entryPoint` | string | Yes | Path to plugin entry module |
| `dependencies` | array | No | Required plugin dependencies |
| `optionalDependencies` | array | No | Optional plugin dependencies |
| `permissions` | string[] | Yes | Required permissions |
| `capabilities` | string[] | No | Exported capabilities |

---

## Plugin Lifecycle Hooks

### Activation Flow

```
Runtime Start → Discover Plugins → Load Manifests → Validate Dependencies
                                                      │
                                                      ▼
                                              Grant Permissions
                                                      │
                                                      ▼
                                              Call onActivate()
                                                      │
                                                      ▼
                                              Register Capabilities
                                                      │
                                                      ▼
                                              Plugin Ready
```

### Available Hooks

```typescript
export interface PluginHooks {
  // Called when the plugin is activated and loaded into the runtime
  onActivate?(context: PluginContext): Promise<void>;

  // Called when the plugin is deactivated or the runtime shuts down
  onDeactivate?(context: PluginContext): Promise<void>;

  // Called for every message passing through the runtime
  middleware?(context: PluginContext): PluginMiddleware;

  // Returns the capabilities this plugin provides
  capabilities?(context: PluginContext): PluginCapability[];

  // Returns custom tool definitions
  tools?(context: PluginContext): ToolDefinition[];

  // Called when configuration changes at runtime
  onConfigChange?(config: Record<string, unknown>): Promise<void>;

  // Called periodically for health checks
  healthCheck?(): Promise<{ healthy: boolean; message?: string }>;
}
```

### Plugin Context

```typescript
interface PluginContext {
  pluginId: string;
  config: Record<string, unknown>;     // Plugin-specific configuration
  logger: Logger;                       // Scoped logger
  memory: MemoryStore;                  // Plugin-scoped memory
  eventBus: EventBus;                   // Plugin event bus
  http: HTTPClient;                     // HTTP client with rate limiting
  secrets: SecretsManager;             // Secure secret storage
}
```

---

## Publishing Plugins

### Package as npm Module

```bash
# Build the plugin
npm run build

# Publish to npm
npm publish --access public
```

### Plugin Marketplace

Plugins can be published to the Agent Preflight Plugin Marketplace:

```bash
preflight plugins publish ./my-plugin
```

### Versioning

Follow semantic versioning:

- **MAJOR**: Breaking changes to the plugin API or manifest format
- **MINOR**: New capabilities, tools, or hooks (backward compatible)
- **PATCH**: Bug fixes, performance improvements

---

## Plugin Marketplace

### Discover Plugins

```bash
# Search the marketplace
preflight plugins search slack
preflight plugins search --type integration

# List installed plugins
preflight plugins list

# Show plugin details
preflight plugins info @agent-preflight/plugin-slack
```

### Install Plugins

```bash
# Install from npm
preflight plugins install @agent-preflight/plugin-slack

# Install from marketplace
preflight plugins install slack-integration

# Install local plugin
preflight plugins install ./path/to/my-plugin
```

### Configuration

```json
{
  "plugins": [
    {
      "id": "@agent-preflight/plugin-slack",
      "enabled": true,
      "settings": {
        "botToken": "xoxb-...",
        "signingSecret": "...",
        "channels": ["general", "engineering"]
      }
    },
    {
      "id": "@agent-preflight/plugin-github",
      "enabled": true,
      "settings": {
        "token": "ghp_...",
        "repositories": ["anomalyco/agent-preflight"]
      }
    }
  ]
}
```

### Security

- Plugins run in the configured sandbox (`SandboxManager`)
- Permissions are declared in the manifest and must be approved during installation
- Plugins cannot access other plugins' data without explicit grants
- Network access is controlled by sandbox network rules
