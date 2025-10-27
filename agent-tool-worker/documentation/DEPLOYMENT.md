# Agent Tool Worker - Deployment Guide

## Table of Contents

- [Deployment Options](#deployment-options)
- [Prerequisites](#prerequisites)
- [Local Development](#local-development)
- [Docker Deployment](#docker-deployment)
- [Kubernetes Deployment](#kubernetes-deployment)
- [Environment Configuration](#environment-configuration)
- [Health Checks](#health-checks)
- [Monitoring Setup](#monitoring-setup)
- [Security](#security)
- [Scaling](#scaling)
- [Troubleshooting](#troubleshooting)

---

## Deployment Options

| Option | Complexity | Best For | Scalability |
|--------|------------|----------|-------------|
| **Local Development** | Low | Development, testing | Single machine |
| **Docker** | Medium | Single server, staging | Limited horizontal scaling |
| **Kubernetes** | High | Production, high availability | Full horizontal scaling |
| **Cloud (AWS/GCP/Azure)** | Medium-High | Managed infrastructure | Full cloud-native scaling |

---

## Prerequisites

### System Requirements
- **Node.js:** 18.x or higher
- **npm:** 9.x or higher
- **Memory:** 512 MB minimum (1GB recommended)
- **Disk Space:** 500 MB for dependencies

### Required Accounts
- **Google Cloud:** OAuth credentials for Google Drive/Calendar APIs
- **Notion:** Integration token for Notion API
- **Todoist:** API token for Todoist API
- **Tavily:** API key for web search
- **OpenWeather:** API key for weather data
- **YouTube:** API key for video search

### Network Requirements
- **Outbound:** HTTPS to external APIs (443)
- **Inbound:** Port 3001 (configurable)
- **Time Sync:** NTP synchronized for token expiration

---

## Local Development

### Installation

```bash
# 1. Clone repository
git clone https://github.com/your-org/enginedge.git
cd enginedge/enginedge-workers/agent-tool-worker

# 2. Install dependencies
npm install

# 3. Create environment file
cp .env.example .env

# 4. Configure environment variables (see Environment Configuration)
nano .env
```

### Environment Variables Setup

```bash
# API Keys & Tokens
GOOGLE_CLIENT_ID=your_client_id
GOOGLE_CLIENT_SECRET=your_client_secret
GOOGLE_ACCESS_TOKEN=your_access_token
GOOGLE_API_KEY=your_api_key
NOTION_API_TOKEN=your_notion_token
TODOIST_API_TOKEN=your_todoist_token
TAVILY_API_KEY=your_tavily_key
OPENWEATHER_API_KEY=your_weather_key
YOUTUBE_API_KEY=your_youtube_key

# Service Configuration
PORT=3001
NODE_ENV=development
LOG_LEVEL=debug

# Rate Limiting (optional)
RATE_LIMIT_ENABLED=true
RATE_LIMIT_WINDOW=60
RATE_LIMIT_MAX_REQUESTS=100
```

### Development Server

```bash
# Start in watch mode
npm run start:dev

# Output:
# [Nest] 12:34:56 AM     - 01/01/2025, 12:34:56 AM LOG [NestFactory] Starting Nest application...
# [Nest] 12:34:57 AM     - 01/01/2025, 12:34:57 AM LOG [InstanceLoader] AgentToolWorkerModule dependencies initialized
# [Nest] 12:34:58 AM     - 01/01/2025, 12:34:58 AM LOG [RoutesResolver] AgentToolWorkerController {...}
# [Nest] 12:34:58 AM     - 01/01/2025, 12:34:58 AM LOG [RouterExplorer] Mapped {/health, GET} route
# [Nest] 12:34:58 AM     - 01/01/2025, 12:34:58 AM LOG [NestApplication] Nest application successfully started
```

### Test the Installation

```bash
# 1. Health check
curl http://localhost:3001/health

# Expected response:
# {
#   "status": "healthy",
#   "timestamp": "2025-10-24T12:00:00.000Z",
#   "uptime": 5
# }

# 2. List available tools
curl http://localhost:3001/tools

# 3. Execute a tool
curl -X POST http://localhost:3001/tools/weather_retriever/execute \
  -H "Content-Type: application/json" \
  -d '{"input": {"location": "New York"}}'
```

---

## Docker Deployment

### Build Docker Image

```bash
# 1. Navigate to project root
cd enginedge-workers/agent-tool-worker

# 2. Create Dockerfile (if not exists)
cat > Dockerfile << 'EOF'
FROM node:18-alpine

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci --only=production

# Copy source code
COPY . .

# Build TypeScript
RUN npm run build

# Expose port
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3001/health || exit 1

# Start application
CMD ["npm", "run", "start:prod"]
EOF

# 3. Build image
docker build -t agent-tool-worker:latest .

# 4. Tag for registry
docker tag agent-tool-worker:latest your-registry/agent-tool-worker:1.0.0

# 5. Push to registry
docker push your-registry/agent-tool-worker:1.0.0
```

### Run Docker Container

```bash
# Basic run
docker run -d \
  --name agent-tool-worker \
  -p 3001:3001 \
  -e PORT=3001 \
  -e NODE_ENV=production \
  -e GOOGLE_API_KEY=your_key \
  -e NOTION_API_TOKEN=your_token \
  -e TODOIST_API_TOKEN=your_token \
  agent-tool-worker:latest

# With volume for logs
docker run -d \
  --name agent-tool-worker \
  -p 3001:3001 \
  -v /var/log/agent-tool-worker:/app/logs \
  -e LOG_LEVEL=info \
  agent-tool-worker:latest

# Check status
docker ps | grep agent-tool-worker

# View logs
docker logs -f agent-tool-worker

# Health check
docker exec agent-tool-worker curl http://localhost:3001/health
```

### Docker Compose Deployment

```yaml
version: '3.8'

services:
  agent-tool-worker:
    image: agent-tool-worker:latest
    build:
      context: .
      dockerfile: Dockerfile
    container_name: agent-tool-worker
    ports:
      - "3001:3001"
    environment:
      - PORT=3001
      - NODE_ENV=production
      - LOG_LEVEL=info
      - GOOGLE_API_KEY=${GOOGLE_API_KEY}
      - GOOGLE_CLIENT_ID=${GOOGLE_CLIENT_ID}
      - GOOGLE_CLIENT_SECRET=${GOOGLE_CLIENT_SECRET}
      - NOTION_API_TOKEN=${NOTION_API_TOKEN}
      - TODOIST_API_TOKEN=${TODOIST_API_TOKEN}
      - TAVILY_API_KEY=${TAVILY_API_KEY}
      - OPENWEATHER_API_KEY=${OPENWEATHER_API_KEY}
      - YOUTUBE_API_KEY=${YOUTUBE_API_KEY}
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3001/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 10s
    restart: unless-stopped
    volumes:
      - ./logs:/app/logs
    networks:
      - enginedge-network

networks:
  enginedge-network:
    driver: bridge
```

**Deploy with Docker Compose:**

```bash
# Create .env file
cat > .env << 'EOF'
GOOGLE_API_KEY=your_key
GOOGLE_CLIENT_ID=your_id
GOOGLE_CLIENT_SECRET=your_secret
NOTION_API_TOKEN=your_token
TODOIST_API_TOKEN=your_token
EOF

# Start services
docker-compose up -d

# Check logs
docker-compose logs -f agent-tool-worker

# Stop services
docker-compose down

# View running services
docker-compose ps
```

---

## Kubernetes Deployment

### Create Kubernetes Resources

**1. ConfigMap for non-sensitive config:**

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: agent-tool-worker-config
  namespace: default
data:
  PORT: "3001"
  NODE_ENV: "production"
  LOG_LEVEL: "info"
```

**2. Secret for sensitive credentials:**

```bash
# Create secret from environment file
kubectl create secret generic agent-tool-worker-secrets \
  --from-literal=GOOGLE_API_KEY=your_key \
  --from-literal=GOOGLE_CLIENT_ID=your_id \
  --from-literal=GOOGLE_CLIENT_SECRET=your_secret \
  --from-literal=NOTION_API_TOKEN=your_token \
  --from-literal=TODOIST_API_TOKEN=your_token \
  --from-literal=TAVILY_API_KEY=your_key \
  --from-literal=OPENWEATHER_API_KEY=your_key \
  --from-literal=YOUTUBE_API_KEY=your_key
```

**3. Deployment manifest:**

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: agent-tool-worker
  namespace: default
  labels:
    app: agent-tool-worker
    version: v1
spec:
  replicas: 3
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1
      maxUnavailable: 0
  selector:
    matchLabels:
      app: agent-tool-worker
  template:
    metadata:
      labels:
        app: agent-tool-worker
        version: v1
    spec:
      serviceAccountName: agent-tool-worker
      imagePullSecrets:
        - name: registry-credentials
      
      containers:
      - name: agent-tool-worker
        image: your-registry/agent-tool-worker:1.0.0
        imagePullPolicy: Always
        
        ports:
        - name: http
          containerPort: 3001
          protocol: TCP
        
        envFrom:
        - configMapRef:
            name: agent-tool-worker-config
        - secretRef:
            name: agent-tool-worker-secrets
        
        resources:
          requests:
            memory: "256Mi"
            cpu: "250m"
          limits:
            memory: "512Mi"
            cpu: "500m"
        
        livenessProbe:
          httpGet:
            path: /health
            port: http
          initialDelaySeconds: 30
          periodSeconds: 10
          timeoutSeconds: 5
          failureThreshold: 3
        
        readinessProbe:
          httpGet:
            path: /health
            port: http
          initialDelaySeconds: 10
          periodSeconds: 5
          timeoutSeconds: 3
          failureThreshold: 3
        
        securityContext:
          runAsNonRoot: true
          runAsUser: 1000
          readOnlyRootFilesystem: true
          allowPrivilegeEscalation: false
          capabilities:
            drop:
            - ALL
        
        volumeMounts:
        - name: tmp
          mountPath: /tmp
      
      volumes:
      - name: tmp
        emptyDir: {}
```

**4. Service manifest:**

```yaml
apiVersion: v1
kind: Service
metadata:
  name: agent-tool-worker
  namespace: default
  labels:
    app: agent-tool-worker
spec:
  type: ClusterIP
  ports:
  - name: http
    port: 80
    targetPort: 3001
    protocol: TCP
  selector:
    app: agent-tool-worker
```

**5. HorizontalPodAutoscaler:**

```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: agent-tool-worker-hpa
  namespace: default
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: agent-tool-worker
  minReplicas: 3
  maxReplicas: 10
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

### Deploy to Kubernetes

```bash
# Apply manifests
kubectl apply -f configmap.yaml
kubectl apply -f deployment.yaml
kubectl apply -f service.yaml
kubectl apply -f hpa.yaml

# Check deployment status
kubectl get deployments

# Check pods
kubectl get pods -l app=agent-tool-worker

# Check service
kubectl get svc agent-tool-worker

# View logs
kubectl logs -f deployment/agent-tool-worker

# Port forward for testing
kubectl port-forward svc/agent-tool-worker 3001:80

# Access service
curl http://localhost:3001/health
```

---

## Environment Configuration

### Environment Variables Reference

```bash
# === PORT AND ENVIRONMENT ===
PORT=3001                              # Server port
NODE_ENV=production|development|test   # Environment mode
LOG_LEVEL=debug|info|warn|error       # Logging level

# === GOOGLE APIs ===
GOOGLE_CLIENT_ID=xxx                   # OAuth client ID
GOOGLE_CLIENT_SECRET=xxx               # OAuth client secret
GOOGLE_ACCESS_TOKEN=xxx                # OAuth access token
GOOGLE_API_KEY=xxx                     # API key for Drive/Calendar

# === EXTERNAL INTEGRATIONS ===
NOTION_API_TOKEN=xxx                   # Notion integration token
TODOIST_API_TOKEN=xxx                  # Todoist API token
TAVILY_API_KEY=xxx                     # Tavily web search API key
OPENWEATHER_API_KEY=xxx                # OpenWeather API key
YOUTUBE_API_KEY=xxx                    # YouTube API key

# === RATE LIMITING ===
RATE_LIMIT_ENABLED=true|false          # Enable/disable rate limiting
RATE_LIMIT_WINDOW=60                   # Rate limit window in seconds
RATE_LIMIT_MAX_REQUESTS=100            # Max requests per window

# === FEATURES ===
ENABLE_OAUTH_FLOW=true                 # Enable OAuth authentication
ENABLE_API_CACHING=true                # Enable response caching
CACHE_TTL=3600                         # Cache TTL in seconds

# === MONITORING ===
METRICS_ENABLED=true                   # Enable Prometheus metrics
TRACING_ENABLED=false                  # Enable distributed tracing
```

### Configuration Files

**1. `.env.development`:**
```bash
PORT=3001
NODE_ENV=development
LOG_LEVEL=debug
RATE_LIMIT_ENABLED=false
```

**2. `.env.production`:**
```bash
PORT=3001
NODE_ENV=production
LOG_LEVEL=warn
RATE_LIMIT_ENABLED=true
ENABLE_API_CACHING=true
METRICS_ENABLED=true
```

**3. `.env.test`:**
```bash
PORT=3001
NODE_ENV=test
LOG_LEVEL=error
RATE_LIMIT_ENABLED=true
```

---

## Health Checks

### Manual Health Check

```bash
curl http://localhost:3001/health
```

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2025-10-24T12:00:00.000Z",
  "uptime": 3600,
  "services": {
    "google_drive": "connected",
    "notion": "connected",
    "todoist": "connected",
    "weather": "connected",
    "youtube": "connected"
  }
}
```

### Kubernetes Liveness Probe
- **Endpoint:** `/health`
- **Initial Delay:** 30 seconds
- **Period:** 10 seconds
- **Timeout:** 5 seconds
- **Failure Threshold:** 3

### Kubernetes Readiness Probe
- **Endpoint:** `/health`
- **Initial Delay:** 10 seconds
- **Period:** 5 seconds
- **Timeout:** 3 seconds
- **Failure Threshold:** 3

---

## Monitoring Setup

### Prometheus Metrics

```bash
# Access metrics endpoint
curl http://localhost:3001/metrics
```

**Key Metrics:**
- `agent_tool_worker_requests_total` - Total requests
- `agent_tool_worker_request_duration_seconds` - Request duration
- `agent_tool_worker_errors_total` - Total errors
- `agent_tool_worker_rate_limit_exceeded_total` - Rate limit violations
- `agent_tool_worker_tool_execution_time_seconds` - Tool execution time

### Grafana Dashboard

Import dashboard ID: `12345` (example)

**Key panels:**
- Requests per second (RPS)
- Error rate
- Response time (p50, p95, p99)
- Tool execution distribution
- Rate limit status
- Service health status

### ELK Stack Integration

**Logstash configuration:**
```logstash
input {
  file {
    path => "/app/logs/agent-tool-worker.log"
    start_position => "beginning"
    codec => "json"
  }
}

filter {
  mutate {
    add_field => { "[@metadata][index_name]" => "agent-tool-worker-%{+YYYY.MM.dd}" }
  }
}

output {
  elasticsearch {
    hosts => ["elasticsearch:9200"]
    index => "%{[@metadata][index_name]}"
  }
}
```

---

## Security

### Network Security

```yaml
# NetworkPolicy for Kubernetes
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: agent-tool-worker-netpol
spec:
  podSelector:
    matchLabels:
      app: agent-tool-worker
  policyTypes:
  - Ingress
  - Egress
  ingress:
  - from:
    - namespaceSelector:
        matchLabels:
          name: ingress-nginx
    ports:
    - protocol: TCP
      port: 3001
  egress:
  - to:
    - namespaceSelector: {}
    ports:
    - protocol: TCP
      port: 443  # HTTPS for external APIs
    - protocol: TCP
      port: 53   # DNS
```

### Secrets Management

```bash
# Use Kubernetes Secrets for sensitive data
kubectl create secret generic api-keys \
  --from-literal=GOOGLE_API_KEY=$GOOGLE_API_KEY \
  --from-literal=NOTION_API_TOKEN=$NOTION_API_TOKEN

# Or use external secret manager
# - HashiCorp Vault
# - AWS Secrets Manager
# - Azure Key Vault
# - Google Secret Manager
```

### SSL/TLS Setup

```bash
# Create self-signed certificate (development)
openssl req -x509 -newkey rsa:4096 -keyout key.pem -out cert.pem -days 365 -nodes

# Create Kubernetes Secret
kubectl create secret tls agent-tool-worker-tls \
  --cert=cert.pem \
  --key=key.pem

# Configure Ingress with TLS
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: agent-tool-worker-ingress
spec:
  tls:
  - hosts:
    - agent-tool.example.com
    secretName: agent-tool-worker-tls
  rules:
  - host: agent-tool.example.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: agent-tool-worker
            port:
              number: 80
```

---

## Scaling

### Horizontal Scaling

```bash
# Manual scaling
kubectl scale deployment agent-tool-worker --replicas=5

# Auto-scaling setup (see HPA example above)
kubectl autoscale deployment agent-tool-worker \
  --min=3 \
  --max=10 \
  --cpu-percent=70
```

### Vertical Scaling

```yaml
# Adjust resource requests/limits
resources:
  requests:
    memory: "512Mi"    # Increase from 256Mi
    cpu: "500m"        # Increase from 250m
  limits:
    memory: "1Gi"      # Increase from 512Mi
    cpu: "1000m"       # Increase from 500m
```

### Load Testing

```bash
# Using Apache Bench
ab -n 10000 -c 100 http://localhost:3001/health

# Using hey
hey -n 10000 -c 100 http://localhost:3001/health

# Using k6
k6 run load-test.js
```

---

## Troubleshooting

### Common Issues

#### 1. Container fails to start
```bash
# Check logs
docker logs agent-tool-worker

# Check environment variables
docker inspect agent-tool-worker | grep -A 20 Env

# Solution: Ensure all required environment variables are set
```

#### 2. Health check failing
```bash
# Manual test
curl -v http://localhost:3001/health

# Check service connectivity
docker exec agent-tool-worker curl http://localhost:3001/health

# Solution: Verify port is exposed and service is running
```

#### 3. OAuth token expiration
```bash
# Check token expiration
curl http://localhost:3001/oauth/accounts

# Refresh token
curl -X POST http://localhost:3001/oauth/refresh \
  -H "Content-Type: application/json" \
  -d '{"provider": "google", "refreshToken": "..."}'

# Solution: Implement token refresh before expiration
```

#### 4. Rate limiting blocking requests
```bash
# Check rate limit status
curl http://localhost:3001/rate-limits/status

# Wait for reset or increase limits
# Solution: Configure appropriate rate limits or implement request queuing
```

### Debugging Commands

```bash
# Kubernetes
kubectl describe pod <pod-name>
kubectl logs <pod-name> --tail=100 -f
kubectl exec -it <pod-name> -- /bin/sh

# Docker
docker ps
docker logs -f <container-name>
docker inspect <container-name>
docker exec -it <container-name> /bin/sh
```

