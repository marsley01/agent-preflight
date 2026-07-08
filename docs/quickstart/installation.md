# Installation

---

## Global CLI Installation

Install the `preflight` CLI globally for system-wide access:

### npm

```bash
npm install -g @agent-preflight/cli
```

### pnpm

```bash
pnpm add -g @agent-preflight/cli
```

### yarn

```bash
yarn global add @agent-preflight/cli
```

### Verify

```bash
preflight --version
# Example output: 0.1.0
```

---

## Local Project Installation

Add Agent Preflight as a project dependency:

```bash
npm install @agent-preflight/core @agent-preflight/runtime
# or
pnpm add @agent-preflight/core @agent-preflight/runtime
```

Initialize a new project:

```bash
npx @agent-preflight/cli init my-project
cd my-project
npm install
```

---

## Docker Installation

### Pull the Image

```bash
docker pull ghcr.io/anomalyco/agent-preflight:latest
```

### Run a Container

```bash
docker run -d \
  --name preflight-agent \
  -p 8080:8080 \
  -e OPENAI_API_KEY=sk-... \
  -e PREFLIGHT_LOG_LEVEL=info \
  -v $(pwd)/config:/etc/preflight \
  ghcr.io/anomalyco/agent-preflight:latest
```

### Docker Compose

```yaml
# docker-compose.yml
version: '3.8'
services:
  preflight:
    image: ghcr.io/anomalyco/agent-preflight:latest
    ports:
      - "8080:8080"
    environment:
      - OPENAI_API_KEY=${OPENAI_API_KEY}
      - PREFLIGHT_LOG_LEVEL=info
    volumes:
      - ./config:/etc/preflight
      - ./agents:/app/agents
    healthcheck:
      test: ["CMD", "preflight", "health"]
      interval: 30s
      timeout: 10s
      retries: 3

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"

  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: preflight
      POSTGRES_USER: preflight
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    volumes:
      - pgdata:/var/lib/postgresql/data

volumes:
  pgdata:
```

---

## Kubernetes Installation

### Using Helm

```bash
helm repo add agent-preflight https://anomalyco.github.io/agent-preflight-helm
helm install my-release agent-preflight/agent-preflight \
  --set apiKey=${PREFLIGHT_API_KEY} \
  --set openai.apiKey=${OPENAI_API_KEY}
```

### Manual Deployment

```yaml
# k8s-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: agent-preflight
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
        env:
        - name: OPENAI_API_KEY
          valueFrom:
            secretKeyRef:
              name: llm-keys
              key: openai-api-key
        - name: PREFLIGHT_LOG_LEVEL
          value: "info"
        livenessProbe:
          httpGet:
            path: /health
            port: 8080
          initialDelaySeconds: 10
        resources:
          requests:
            memory: "256Mi"
            cpu: "250m"
          limits:
            memory: "1Gi"
            cpu: "1"
---
apiVersion: v1
kind: Service
metadata:
  name: agent-preflight
spec:
  selector:
    app: agent-preflight
  ports:
  - port: 8080
    targetPort: 8080
---
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: agent-preflight
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: agent-preflight
  minReplicas: 3
  maxReplicas: 10
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
```

---

## Platform-Specific Notes

### Windows

**Prerequisites:**
- Node.js 20+ (use [nvm-windows](https://github.com/coreybutler/nvm-windows) or official installer)
- PowerShell 5.1+ or Windows Terminal

**Known Issues:**

- Long path support: Enable via `Set-ItemProperty -Path 'HKLM:\SYSTEM\CurrentControlSet\Control\FileSystem' -Name 'LongPathsEnabled' -Value 1`
- Native modules: If you encounter build errors, install `windows-build-tools`: `npm install --global windows-build-tools`

```powershell
# Install CLI
npm install -g @agent-preflight/cli

# Initialize with PowerShell-friendly path
preflight init .\my-project
```

### macOS

**Prerequisites:**
- Node.js 20+ (use `nvm` or `brew install node@20`)
- Xcode Command Line Tools: `xcode-select --install`

```bash
# Using Homebrew
brew install node@20

# Install CLI
npm install -g @agent-preflight/cli

# Initialize
preflight init my-project
```

### Linux

**Prerequisites:**
- Node.js 20+ (use `nvm` or distribution package manager)
- Essential build tools: `build-essential` (Debian/Ubuntu) or `base-devel` (Arch)

```bash
# Debian/Ubuntu
sudo apt update && sudo apt install nodejs npm build-essential

# Install CLI
npm install -g @agent-preflight/cli

# Initialize
preflight init my-project
```

---

## Post-Installation Checklist

Run the diagnostic tool to verify your installation:

```bash
preflight doctor
```

This checks:

- Node.js version compatibility
- CLI binary accessibility
- Configuration file validity
- Provider API key presence
- Docker availability (if applicable)
- Kubernetes context (if applicable)

### Expected Output

```
✅ Node.js 20.5.1 — OK
✅ CLI binary — OK
✅ Configuration — OK
⚠️  OPENAI_API_KEY — not set
ℹ️  Docker — not available
ℹ️  kubectl — not available

Run `preflight init` to create a new project, or set OPENAI_API_KEY in your environment.
```
