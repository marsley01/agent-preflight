# Deployment Guide

---

## Local Development Setup

The simplest deployment for development and testing:

```bash
# Start the runtime in development mode
preflight dev

# In another terminal, register agents
preflight registry register agents/*.ts

# Check health
preflight health
```

All communication uses in-memory transport. No external dependencies required.

### Configuration

```json
{
  "runtime": {
    "provider": "openai",
    "model": "gpt-4o",
    "temperature": 0.7,
    "maxConcurrency": 10,
    "logLevel": "debug"
  },
  "telemetry": {
    "enabled": true,
    "level": "debug"
  }
}
```

---

## Docker Deployment

### Build Image

```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN npm install -g pnpm && pnpm install
COPY . .
RUN pnpm build

FROM node:20-alpine AS runner
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY preflight.json .
EXPOSE 8080
CMD ["node", "dist/index.js"]
```

```bash
docker build -t agent-preflight:latest .
docker run -d --name preflight \
  -p 8080:8080 \
  -e OPENAI_API_KEY=$OPENAI_API_KEY \
  -v $(pwd)/agents:/app/agents \
  agent-preflight:latest
```

### Docker Compose (Full Stack)

```yaml
version: '3.8'
services:
  preflight:
    build: .
    ports:
      - "8080:8080"
    environment:
      - OPENAI_API_KEY=${OPENAI_API_KEY}
      - PREFLIGHT_LOG_LEVEL=info
      - REDIS_URL=redis://redis:6379
      - DATABASE_URL=postgresql://preflight:${DB_PASS}@postgres:5432/preflight
    depends_on:
      redis:
        condition: service_healthy
      postgres:
        condition: service_healthy
    volumes:
      - ./agents:/app/agents
      - ./config:/app/config

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
    volumes:
      - redis-data:/data

  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: preflight
      POSTGRES_USER: preflight
      POSTGRES_PASSWORD: ${DB_PASS}
    ports:
      - "5432:5432"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U preflight"]
      interval: 5s
    volumes:
      - pg-data:/var/lib/postgresql/data

volumes:
  redis-data:
  pg-data:
```

---

## Kubernetes Deployment

### Prerequisites

- Kubernetes 1.24+
- Helm 3+ (optional)
- kubectl configured

### Helm Chart

```bash
helm repo add agent-preflight https://anomalyco.github.io/agent-preflight-helm
helm install preflight agent-preflight/agent-preflight \
  --namespace preflight-system \
  --create-namespace \
  --set image.tag=latest \
  --set openai.apiKey=$OPENAI_API_KEY \
  --set replicas=3 \
  --set resources.requests.memory=256Mi \
  --set resources.requests.cpu=250m
```

### Manual Deployment

```yaml
# k8s/namespace.yaml
apiVersion: v1
kind: Namespace
metadata:
  name: preflight-system

---
# k8s/configmap.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: preflight-config
  namespace: preflight-system
data:
  preflight.json: |
    {
      "runtime": {
        "maxConcurrency": 20,
        "logLevel": "info"
      },
      "telemetry": {
        "enabled": true,
        "level": "info"
      }
    }

---
# k8s/secrets.yaml
apiVersion: v1
kind: Secret
metadata:
  name: preflight-secrets
  namespace: preflight-system
type: Opaque
stringData:
  OPENAI_API_KEY: "sk-..."
  PREFLIGHT_API_KEY: "ap_..."

---
# k8s/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: agent-preflight
  namespace: preflight-system
spec:
  replicas: 3
  selector:
    matchLabels:
      app: agent-preflight
  template:
    metadata:
      labels:
        app: agent-preflight
    spec:
      containers:
      - name: preflight
        image: ghcr.io/anomalyco/agent-preflight:latest
        ports:
        - containerPort: 8080
          name: http
        - containerPort: 9090
          name: metrics
        envFrom:
        - secretRef:
            name: preflight-secrets
        volumeMounts:
        - name: config
          mountPath: /etc/preflight
        - name: agents
          mountPath: /app/agents
        livenessProbe:
          httpGet:
            path: /health
            port: 8080
          initialDelaySeconds: 10
          periodSeconds: 15
        readinessProbe:
          httpGet:
            path: /health/ready
            port: 8080
          initialDelaySeconds: 5
          periodSeconds: 10
        resources:
          requests:
            memory: "256Mi"
            cpu: "250m"
          limits:
            memory: "1Gi"
            cpu: "1"
      volumes:
      - name: config
        configMap:
          name: preflight-config
      - name: agents
        configMap:
          name: agent-definitions

---
# k8s/service.yaml
apiVersion: v1
kind: Service
metadata:
  name: agent-preflight
  namespace: preflight-system
spec:
  selector:
    app: agent-preflight
  ports:
  - name: http
    port: 8080
    targetPort: 8080
  - name: metrics
    port: 9090
    targetPort: 9090

---
# k8s/hpa.yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: agent-preflight
  namespace: preflight-system
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: agent-preflight
  minReplicas: 3
  maxReplicas: 20
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
  - type: Resource
    resource:
      name: memory
      target:
        type: Utilization
        averageUtilization: 80
```

---

## Cloud Deployment

### AWS (ECS Fargate)

```bash
# Build and push to ECR
aws ecr create-repository --repository-name agent-preflight
docker tag agent-preflight:latest $AWS_ACCOUNT.dkr.ecr.$REGION.amazonaws.com/agent-preflight:latest
docker push $AWS_ACCOUNT.dkr.ecr.$REGION.amazonaws.com/agent-preflight:latest

# Deploy via ECS
aws ecs create-service \
  --cluster preflight-cluster \
  --service-name agent-preflight \
  --task-definition agent-preflight \
  --desired-count 3 \
  --launch-type FARGATE \
  --network-configuration "awsvpcConfiguration={subnets=[...],securityGroups=[...],assignPublicIp=ENABLED}"
```

### GCP (Cloud Run)

```bash
# Build and push to Artifact Registry
gcloud builds submit --tag $REGION-docker.pkg.dev/$PROJECT/agent-preflight

# Deploy
gcloud run deploy agent-preflight \
  --image $REGION-docker.pkg.dev/$PROJECT/agent-preflight \
  --memory 1Gi \
  --cpu 2 \
  --min-instances 2 \
  --max-instances 20 \
  --concurrency 80 \
  --set-env-vars "OPENAI_API_KEY=$OPENAI_API_KEY"
```

### Azure (Container Instances)

```bash
az container create \
  --resource-group preflight-rg \
  --name agent-preflight \
  --image ghcr.io/anomalyco/agent-preflight:latest \
  --cpu 2 --memory 2 \
  --ports 8080 \
  --environment-variables OPENAI_API_KEY=$OPENAI_API_KEY
```

---

## Serverless Deployment

### AWS Lambda

```yaml
# serverless.yml
service: agent-preflight

provider:
  name: aws
  runtime: nodejs20.x
  memorySize: 1024
  timeout: 300

functions:
  agent-handler:
    handler: dist/handler.lambdaHandler
    events:
      - http:
          path: /agent/{agentId}/message
          method: POST
      - http:
          path: /health
          method: GET
    environment:
      OPENAI_API_KEY: ${env:OPENAI_API_KEY}
```

```typescript
// handler.ts
import { createLambdaHandler } from '@agent-preflight/serverless';

export const lambdaHandler = createLambdaHandler({
  agentPath: './agents',
  runtime: {
    provider: 'openai',
    model: 'gpt-4o-mini',
  },
});
```

---

## Edge Deployment

### Cloudflare Workers

```typescript
// wrangler.toml
// name = "agent-preflight-edge"
// main = "src/edge.ts"

// src/edge.ts
import { createEdgeHandler } from '@agent-preflight/edge';

export default createEdgeHandler({
  agents: {
    'chatbot': {
      model: 'gpt-4o-mini',
      systemPrompt: 'You are a helpful assistant',
    },
  },
  kv: {
    namespace: 'PREFLIGHT_MEMORY',
  },
});
```

---

## Environment Configuration

### Environment Variables

| Variable | Description | Required |
|---|---|---|
| `OPENAI_API_KEY` | OpenAI API key | Model-dependent |
| `ANTHROPIC_API_KEY` | Anthropic API key | Model-dependent |
| `PREFLIGHT_API_KEY` | API key for the preflight API | Yes |
| `PREFLIGHT_LOG_LEVEL` | Log level (trace, debug, info, warn, error) | No |
| `PREFLIGHT_ENCRYPTION_KEY` | 32-byte hex key for encryption | Recommended |
| `REDIS_URL` | Redis connection string | For distributed memory |
| `DATABASE_URL` | PostgreSQL connection string | For persistent storage |
| `OTLP_ENDPOINT` | OpenTelemetry collector endpoint | For observability |

### Configuration Precedence

1. CLI flags (`--config`)
2. Environment variables
3. `preflight.json` in project root
4. `~/.config/preflight/config.json`
5. Default values

---

## Monitoring and Alerting Setup

### Metrics Endpoint

```bash
# Prometheus metrics available at /metrics
preflight deploy --metrics-port 9090
```

```yaml
# prometheus.yml
scrape_configs:
  - job_name: 'agent-preflight'
    static_configs:
      - targets: ['localhost:9090']
    metrics_path: '/metrics'
```

### Key Metrics

| Metric | Type | Description |
|---|---|---|
| `agent_up` | Gauge | 1 if agent is healthy |
| `agent_tasks_total` | Counter | Total tasks processed |
| `agent_tasks_failed` | Counter | Failed tasks |
| `agent_latency_ms` | Histogram | Request latency |
| `agent_tokens_total` | Counter | Total tokens consumed |
| `agent_memory_bytes` | Gauge | Memory usage per layer |
| `runtime_active_agents` | Gauge | Currently active agents |

### Alerting Rules

```yaml
# alerts.yml
groups:
  - name: agent-preflight
    rules:
      - alert: AgentDown
        expr: agent_up == 0
        for: 5m
        labels:
          severity: critical

      - alert: HighErrorRate
        expr: rate(agent_tasks_failed[5m]) / rate(agent_tasks_total[5m]) > 0.05
        for: 5m
        labels:
          severity: warning

      - alert: HighLatency
        expr: histogram_quantile(0.95, rate(agent_latency_ms[5m])) > 10000
        for: 5m
        labels:
          severity: warning

      - alert: TokenBudgetExceeded
        expr: rate(agent_tokens_total[1h]) > 1000000
        for: 5m
        labels:
          severity: info
```
