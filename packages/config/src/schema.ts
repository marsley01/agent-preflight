import { z } from "zod";

export const loggingConfigSchema = z.object({
  level: z.enum(["TRACE", "DEBUG", "INFO", "WARN", "ERROR", "FATAL"]).default("INFO"),
  format: z.enum(["TEXT", "JSON", "STRUCTURED"]).default("JSON"),
  output: z.enum(["CONSOLE", "FILE", "BOTH"]).default("CONSOLE"),
  filePath: z.string().optional(),
  maxFileSize: z.number().positive().default(10485760),
  maxFiles: z.number().positive().default(5),
  includeTimestamp: z.boolean().default(true),
  includeCorrelationId: z.boolean().default(true),
  colorize: z.boolean().default(true),
});

export const providerConfigSchema = z.object({
  name: z.string().min(1),
  type: z.enum([
    "OPENAI",
    "ANTHROPIC",
    "GOOGLE",
    "META",
    "MISTRAL",
    "DEEPSEEK",
    "QWEN",
    "OPENROUTER",
    "TOGETHER",
    "GROQ",
    "AZURE",
    "OLLAMA",
    "CUSTOM",
  ]),
  apiKey: z.string().optional(),
  baseUrl: z.string().url().optional(),
  organizationId: z.string().optional(),
  deploymentId: z.string().optional(),
  timeout: z.number().positive().default(30000),
  maxRetries: z.number().int().nonnegative().default(3),
  rateLimit: z
    .object({
      requestsPerMinute: z.number().positive().default(60),
      tokensPerMinute: z.number().positive().default(100000),
    })
    .default({}),
  models: z
    .array(
      z.object({
        name: z.string().min(1),
        family: z.string().min(1),
        maxTokens: z.number().positive(),
        enabled: z.boolean().default(true),
      }),
    )
    .default([]),
});

export const securityConfigSchema = z.object({
  encryption: z
    .object({
      enabled: z.boolean().default(true),
      algorithm: z.enum(["AES-256-GCM", "AES-128-GCM", "CHACHA20-POLY1305"]).default("AES-256-GCM"),
      keyRotationDays: z.number().positive().default(90),
    })
    .default({}),
  authentication: z
    .object({
      enabled: z.boolean().default(true),
      provider: z.enum(["JWT", "API_KEY", "OAUTH2", "BASIC", "NONE"]).default("JWT"),
      tokenExpiry: z.number().positive().default(3600000),
      refreshTokenExpiry: z.number().positive().default(604800000),
      requireApiKey: z.boolean().default(true),
    })
    .default({}),
  authorization: z
    .object({
      enabled: z.boolean().default(true),
      defaultRole: z.string().default("viewer"),
      roles: z.record(z.array(z.string())).default({}),
    })
    .default({}),
  sandbox: z
    .object({
      enabled: z.boolean().default(true),
      runtime: z.enum(["NONE", "VM2", "DENO", "CONTAINER", "WEB_WORKER"]).default("DENO"),
      memoryLimit: z.number().positive().default(524288000),
      cpuLimit: z.number().min(0).max(1).default(0.5),
      networkAccess: z.boolean().default(false),
      allowedDomains: z.array(z.string()).default([]),
      allowedModules: z.array(z.string()).default([]),
      timeout: z.number().positive().default(30000),
      readOnlyFilesystem: z.boolean().default(true),
    })
    .default({}),
  rateLimiting: z
    .object({
      enabled: z.boolean().default(true),
      maxRequests: z.number().positive().default(1000),
      windowMs: z.number().positive().default(60000),
      strategy: z
        .enum(["TOKEN_BUCKET", "FIXED_WINDOW", "SLIDING_WINDOW", "ADAPTIVE"])
        .default("TOKEN_BUCKET"),
      burstAllowed: z.number().positive().default(10),
    })
    .default({}),
  auditLogging: z
    .object({
      enabled: z.boolean().default(true),
      retentionDays: z.number().positive().default(90),
      events: z.array(z.string()).default([]),
    })
    .default({}),
});

export const memoryConfigSchema = z.object({
  defaultLayer: z
    .enum(["WORKING", "SESSION", "LONG_TERM", "SEMANTIC", "KNOWLEDGE_GRAPH", "VECTOR", "PROJECT", "USER", "SHARED", "ENCRYPTED"])
    .default("WORKING"),
  maxEntriesPerAgent: z.number().positive().default(10000),
  maxEntrySize: z.number().positive().default(1048576),
  ttl: z
    .record(
      z.enum(["WORKING", "SESSION", "LONG_TERM", "SEMANTIC", "KNOWLEDGE_GRAPH", "VECTOR", "PROJECT", "USER", "SHARED", "ENCRYPTED"]),
      z.number().positive(),
    )
    .default({
      WORKING: 300000,
      SESSION: 3600000,
      LONG_TERM: 2592000000,
      SEMANTIC: 2592000000,
      KNOWLEDGE_GRAPH: 2592000000,
      VECTOR: 2592000000,
      PROJECT: 604800000,
      USER: 2592000000,
      SHARED: 2592000000,
      ENCRYPTED: 3600000,
    }),
  vectorDimension: z.number().positive().optional().default(1536),
  similarityMetric: z.enum(["cosine", "euclidean", "dotProduct"]).default("cosine"),
  encryptionEnabled: z.boolean().default(false),
  storage: z
    .object({
      type: z.enum(["MEMORY", "REDIS", "POSTGRES", "MONGODB", "FILESYSTEM"]).default("MEMORY"),
      connectionString: z.string().optional(),
      poolSize: z.number().positive().default(10),
    })
    .default({}),
});

export const pluginConfigSchema = z.object({
  enabled: z.boolean().default(true),
  directory: z.string().default("./plugins"),
  autoLoad: z.boolean().default(false),
  allowlist: z.array(z.string()).default([]),
  blocklist: z.array(z.string()).default([]),
  timeout: z.number().positive().default(30000),
  maxMemory: z.number().positive().default(268435456),
  permissions: z
    .object({
      requireExplicitConsent: z.boolean().default(true),
      defaultPermissions: z.array(z.string()).default([]),
    })
    .default({}),
  registries: z
    .array(
      z.object({
        type: z.enum(["NPM", "GIT", "LOCAL"]),
        url: z.string().optional(),
        token: z.string().optional(),
      }),
    )
    .default([]),
});

export const apiConfigSchema = z.object({
  port: z.number().int().positive().default(4000),
  host: z.string().default("0.0.0.0"),
  basePath: z.string().default("/api/v1"),
  cors: z
    .object({
      enabled: z.boolean().default(true),
      origins: z.array(z.string()).default(["*"]),
      methods: z.array(z.string()).default(["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"]),
      allowedHeaders: z.array(z.string()).default(["Content-Type", "Authorization"]),
      credentials: z.boolean().default(true),
      maxAge: z.number().positive().default(86400),
    })
    .default({}),
  bodyLimit: z.number().positive().default(1048576),
  timeout: z.number().positive().default(30000),
  compression: z.boolean().default(true),
  trustProxy: z.boolean().default(false),
  rateLimit: z
    .object({
      enabled: z.boolean().default(true),
      maxRequests: z.number().positive().default(100),
      windowMs: z.number().positive().default(60000),
    })
    .default({}),
  ssl: z
    .object({
      enabled: z.boolean().default(false),
      cert: z.string().optional(),
      key: z.string().optional(),
    })
    .default({}),
});

export const observabilityConfigSchema = z.object({
  tracing: z
    .object({
      enabled: z.boolean().default(true),
      samplingRate: z.number().min(0).max(1).default(0.1),
      exporter: z.enum(["CONSOLE", "OTLP", "ZIPKIN", "JAEGER", "NONE"]).default("CONSOLE"),
      batchSize: z.number().positive().default(100),
      batchInterval: z.number().positive().default(5000),
      endpoint: z.string().optional(),
    })
    .default({}),
  metrics: z
    .object({
      enabled: z.boolean().default(true),
      exporter: z.enum(["CONSOLE", "OTLP", "PROMETHEUS", "DATADOG", "NONE"]).default("CONSOLE"),
      batchSize: z.number().positive().default(100),
      batchInterval: z.number().positive().default(10000),
      endpoint: z.string().optional(),
      prefix: z.string().default("preflight_"),
    })
    .default({}),
  logging: loggingConfigSchema.default({}),
  healthCheck: z
    .object({
      enabled: z.boolean().default(true),
      path: z.string().default("/health"),
      interval: z.number().positive().default(30000),
      timeout: z.number().positive().default(5000),
    })
    .default({}),
});

export const runtimeConfigSchema = z.object({
  environment: z.enum(["development", "staging", "production", "test", "local"]).default("development"),
  nodeEnv: z.enum(["development", "production", "test"]).default("development"),
  debug: z.boolean().default(false),
  logLevel: z.enum(["TRACE", "DEBUG", "INFO", "WARN", "ERROR", "FATAL"]).default("INFO"),
  concurrency: z.number().positive().default(4),
  shutdownTimeout: z.number().positive().default(30000),
  gracefulShutdown: z.boolean().default(true),
  tempDir: z.string().default("./tmp"),
  dataDir: z.string().default("./data"),
  cache: z
    .object({
      enabled: z.boolean().default(true),
      ttl: z.number().positive().default(300000),
      maxSize: z.number().positive().default(104857600),
    })
    .default({}),
  scheduling: z
    .object({
      maxQueueSize: z.number().positive().default(1000),
      pollingInterval: z.number().positive().default(100),
      preemptionEnabled: z.boolean().default(true),
    })
    .default({}),
});

export const agentConfigSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(100),
  description: z.string().optional(),
  version: z.string().default("0.1.0"),
  enabled: z.boolean().default(true),
  model: z.string().min(1),
  provider: z.string().min(1),
  systemPrompt: z.string().optional(),
  maxConcurrency: z.number().positive().default(1),
  maxQueueSize: z.number().positive().default(100),
  timeout: z.number().positive().default(60000),
  tags: z.array(z.string()).default([]),
  metadata: z.record(z.unknown()).default({}),
  retryPolicy: z
    .object({
      maxRetries: z.number().int().nonnegative().default(3),
      baseDelay: z.number().positive().default(1000),
      maxDelay: z.number().positive().default(30000),
      backoffFactor: z.number().min(1).default(2),
    })
    .default({}),
  memory: memoryConfigSchema.optional(),
  tools: z.array(z.string()).default([]),
});

export const deploymentConfigSchema = z.object({
  id: z.string().min(1),
  target: z.enum(["LOCAL", "DOCKER", "KUBERNETES", "CLOUD", "SERVERLESS", "EDGE"]).default("LOCAL"),
  version: z.string().default("0.1.0"),
  replicas: z.number().int().positive().default(1),
  resources: z
    .object({
      cpu: z.string().default("1"),
      memory: z.string().default("512Mi"),
      disk: z.string().default("1Gi"),
    })
    .default({}),
  environment: z.string().default("development"),
  env: z.record(z.string()).default({}),
  secrets: z.record(z.string()).default({}),
  ports: z
    .array(
      z.object({
        name: z.string().min(1),
        port: z.number().int().positive(),
        protocol: z.enum(["TCP", "UDP"]).default("TCP"),
      }),
    )
    .default([]),
  healthCheck: z
    .object({
      path: z.string().default("/health"),
      interval: z.number().positive().default(30000),
      timeout: z.number().positive().default(5000),
      healthyThreshold: z.number().positive().default(2),
      unhealthyThreshold: z.number().positive().default(3),
    })
    .default({}),
  labels: z.record(z.string()).default({}),
  annotations: z.record(z.string()).default({}),
});

export const preflightConfigSchema = z.object({
  version: z.string().default("1.0.0"),
  name: z.string().default("agent-preflight"),
  description: z.string().optional(),
  runtime: runtimeConfigSchema.default({}),
  security: securityConfigSchema.default({}),
  api: apiConfigSchema.default({}),
  observability: observabilityConfigSchema.default({}),
  memory: memoryConfigSchema.default({}),
  plugins: pluginConfigSchema.default({}),
  deployment: deploymentConfigSchema.optional(),
  agents: z.array(agentConfigSchema).default([]),
  providers: z.array(providerConfigSchema).default([]),
});

export const configFileSchema = z.union([
  preflightConfigSchema,
  z.object({
    extends: z.string().optional(),
  }),
]);
