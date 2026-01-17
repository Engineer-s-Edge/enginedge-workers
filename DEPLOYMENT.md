# EnginEdge Workers - Deployment Guide

> Complete deployment documentation for all EnginEdge worker nodes.

## Table of Contents

- [Overview](#overview)
- [Worker Types](#worker-types)
- [Prerequisites](#prerequisites)
- [Local Development](#local-development)
- [Docker Deployment](#docker-deployment)
- [Kubernetes Deployment](#kubernetes-deployment)
- [Configuration](#configuration)
- [Monitoring & Scaling](#monitoring--scaling)
- [Worker-Specific Configuration](#worker-specific-configuration)
- [Troubleshooting](#troubleshooting)

## Overview

The EnginEdge Workers are specialized microservices that handle domain-specific AI/ML processing. Each worker implements hexagonal architecture and communicates asynchronously via Kafka messaging.

### Deployment Architecture

```
┌─────────────────┐    ┌─────────────────┐
│   Main Hexagon  │────│     Kafka       │
│   Orchestrator  │    │   Message Bus   │
└─────────────────┘    └─────────────────┘
         │                       │
         ├───────────────────────┤
         │                       │
┌────────┴────────┐   ┌──────────┴──────────┐
│   Worker Node   │   │   Worker Node       │
│     (LLM)       │   │   (Data Processing) │
│                 │   │                     │
│  ┌────────────┐ │   │  ┌────────────┐     │
│  │  Domain    │ │   │  │  Domain    │     │
│  │  Logic     │ │   │  │  Logic     │     │
│  └────────────┘ │   │  └────────────┘     │
│  ┌────────────┐ │   │  ┌────────────┐     │
│  │ Adapters   │ │   │  │ Adapters   │     │
│  │ (OpenAI,   │ │   │  │ (Pinecone, │     │
│  │ Anthropic) │ │   │  │  PgVector) │     │
│  └────────────┘ │   │  └────────────┘     │
└─────────────────┘   └─────────────────────┘
```

## Worker Types

### 1. Assistant Worker
**Purpose**: Large Language Model Agent/Assistant interactions
**Port**: 3001
**External Dependencies**: OpenAI API, Anthropic API, Hugging Face
**Resource Requirements**: High CPU for inference, moderate memory

### 2. Agent Tool Worker
**Purpose**: External tool integration and execution
**Port**: 3002
**External Dependencies**: Various APIs, web services, databases
**Resource Requirements**: Moderate CPU, moderate memory

### 3. Data Processing Worker
**Purpose**: Document processing and vector operations
**Port**: 3003
**External Dependencies**: Vector databases (Pinecone, Weaviate), OCR services
**Resource Requirements**: High CPU for embeddings, high memory for document processing

### 4. Interview Worker
**Purpose**: Interview processing and assessment
**Port**: 3004
**External Dependencies**: Speech-to-Text APIs, video processing services
**Resource Requirements**: Moderate CPU, moderate memory

### 5. LaTeX Worker
**Purpose**: Mathematical document generation
**Port**: 3005
**External Dependencies**: LaTeX distribution, math rendering engines
**Resource Requirements**: High CPU for compilation, moderate memory

### 6. Resume Worker
**Purpose**: Resume parsing and matching
**Port**: 3006
**External Dependencies**: NLP libraries, data enrichment services
**Resource Requirements**: High CPU for NLP, moderate memory

### 7. Scheduling Worker
**Purpose**: Calendar management and task scheduling
**Port**: 3007
**External Dependencies**: Google Calendar, Outlook Calendar, scheduling APIs
**Resource Requirements**: Low CPU, moderate memory

### 8. Identity Worker
**Purpose**: User identity and profile management
**Port**: 3008
**External Dependencies**: OAuth providers (LinkedIn, GitHub), identity databases
**Resource Requirements**: Low CPU, moderate memory

### 9. News Worker
**Purpose**: Market intelligence and news aggregation
**Port**: 3009
**External Dependencies**: News APIs, RSS feeds, content scrapers
**Resource Requirements**: Moderate CPU, moderate memory

### 10. SpaCy Service
**Purpose**: Advanced NLP processing (Python)
**Port**: 8001
**External Dependencies**: SpaCy models, NLP libraries
**Resource Requirements**: High CPU for NLP, high memory for models

## Prerequisites

### System Requirements (Per Worker)

| Worker Type | CPU Cores | Memory | Storage | Network |
|-------------|-----------|--------|---------|---------|
| Assistant | 2+ | 4GB+ | 10GB+ | High |
| Agent Tool | 2+ | 4GB+ | 10GB+ | Moderate |
| Data Processing | 4+ | 8GB+ | 20GB+ | High |
| Interview | 2+ | 4GB+ | 10GB+ | Moderate |
| LaTeX | 2+ | 4GB+ | 10GB+ | Low |
| Resume | 2+ | 4GB+ | 10GB+ | Moderate |
| Scheduling | 1+ | 2GB+ | 5GB+ | Moderate |
| Identity | 1+ | 2GB+ | 5GB+ | Low |
| News | 2+ | 4GB+ | 10GB+ | High |
| SpaCy Service | 2+ | 4GB+ | 10GB+ | Moderate |

### External Dependencies

- **Apache Kafka**: Message broker for communication
- **Redis**: Caching and temporary storage
- **Worker-specific APIs**: As listed above

## Local Development

### Multi-Worker Docker Compose

```yaml
version: '3.8'
services:
  # Shared infrastructure
  kafka:
    image: confluentinc/cp-kafka:7.3.0
    ports:
      - "9092:9092"
    environment:
      KAFKA_BROKER_ID: 1
      KAFKA_ZOOKEEPER_CONNECT: zookeeper:2181
      KAFKA_LISTENER_SECURITY_PROTOCOL_MAP: PLAINTEXT:PLAINTEXT,PLAINTEXT_INTERNAL:PLAINTEXT
      KAFKA_ADVERTISED_LISTENERS: PLAINTEXT://localhost:9092,PLAINTEXT_INTERNAL://kafka:29092
      KAFKA_OFFSETS_TOPIC_REPLICATION_FACTOR: 1
    depends_on:
      - zookeeper

  zookeeper:
    image: confluentinc/cp-zookeeper:7.3.0
    environment:
      ZOOKEEPER_CLIENT_PORT: 2181

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"

  # Worker services
  assistant-worker:
    build:
      context: ../enginedge-workers/assistant-worker
      dockerfile: Dockerfile.dev
    ports:
      - "3001:3001"
    environment:
      WORKER_TYPE: llm
      KAFKA_BROKERS: kafka:29092
      REDIS_URL: redis://redis:6379
      OPENAI_API_KEY: ${OPENAI_API_KEY}
    depends_on:
      - kafka
      - redis

  agent-tool-worker:
    build:
      context: ../enginedge-workers/agent-tool-worker
      dockerfile: Dockerfile.dev
    ports:
      - "3002:3002"
    environment:
      WORKER_TYPE: agent_tool
      KAFKA_BROKERS: kafka:29092
      REDIS_URL: redis://redis:6379
    depends_on:
      - kafka
      - redis

  data-processing-worker:
    build:
      context: ../enginedge-workers/data-processing-worker
      dockerfile: Dockerfile.dev
    ports:
      - "3003:3003"
    environment:
      WORKER_TYPE: data_processing
      KAFKA_BROKERS: kafka:29092
      REDIS_URL: redis://redis:6379
      PINECONE_API_KEY: ${PINECONE_API_KEY}
    depends_on:
      - kafka
      - redis

  # Add other workers similarly...

networks:
  default:
    driver: bridge
```

### Development Workflow

```bash
# Start all workers and infrastructure
docker-compose -f docker-compose.workers.dev.yml up -d

# View logs for specific worker
docker-compose -f docker-compose.workers.dev.yml logs -f assistant-worker

# Run tests for all workers
docker-compose -f docker-compose.workers.dev.yml exec assistant-worker npm test
docker-compose -f docker-compose.workers.dev.yml exec agent-tool-worker npm test

# Stop all services
docker-compose -f docker-compose.workers.dev.yml down
```

## Docker Deployment

### Base Worker Dockerfile

```dockerfile
FROM node:18-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Build application
RUN npm run build

# Production image
FROM node:18-alpine AS production

# Install dumb-init
RUN apk add --no-cache dumb-init

WORKDIR /app

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S enginedge -u 1001

# Copy package files
COPY package*.json ./

# Install production dependencies
RUN npm ci --only=production && \
    npm cache clean --force

# Copy built application
COPY --from=builder /app/dist ./dist

# Change ownership
RUN chown -R enginedge:nodejs /app
USER enginedge

EXPOSE ${PORT}

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/main.js"]
```

### Worker-Specific Dockerfiles

#### LLM Worker Dockerfile
```dockerfile
FROM node:18-alpine AS builder

# Same as base builder...

FROM node:18-alpine AS production

# Install Python for some ML libraries (if needed)
RUN apk add --no-cache python3 py3-pip

# Install worker
COPY --from=builder /app/dist ./dist
# ... rest of base production setup

EXPOSE 3001
ENV PORT=3001
ENV WORKER_TYPE=llm
```

#### Data Processing Worker Dockerfile
```dockerfile
FROM node:18-alpine AS builder

# Same as base builder...

FROM node:18-alpine AS production

# Install additional packages for document processing
RUN apk add --no-cache \
    poppler-utils \
    tesseract-ocr \
    tesseract-ocr-data-eng

# Install worker
COPY --from=builder /app/dist ./dist
# ... rest of base production setup

EXPOSE 3003
ENV PORT=3003
ENV WORKER_TYPE=data_processing
```

### Building Workers

```bash
# Build all workers
for worker in llm agent-tool data-processing interview latex resume; do
  docker build -t enginedge/${worker}-worker:latest ./enginedge-workers/${worker}-worker
done

# Or build individually
docker build -t enginedge/assistant-worker:latest ./enginedge-workers/assistant-worker
```

## Kubernetes Deployment

### Shared Configuration

```yaml
# ConfigMap for shared configuration
apiVersion: v1
kind: ConfigMap
metadata:
  name: worker-shared-config
  namespace: enginedge
data:
  NODE_ENV: "production"
  LOG_LEVEL: "info"
  KAFKA_BROKERS: "kafka-cluster.enginedge.svc.cluster.local:9092"
  REDIS_URL: "redis://redis-cluster.enginedge.svc.cluster.local:6379"
  HEALTH_CHECK_INTERVAL: "30"
  MAX_CONCURRENCY: "10"
```

### Worker-Specific Secrets

```yaml
# LLM Worker secrets
apiVersion: v1
kind: Secret
metadata:
  name: assistant-worker-secrets
  namespace: enginedge
type: Opaque
data:
  OPENAI_API_KEY: <base64-encoded-key>
  ANTHROPIC_API_KEY: <base64-encoded-key>
  HUGGINGFACE_API_KEY: <base64-encoded-key>

---
# Data Processing Worker secrets
apiVersion: v1
kind: Secret
metadata:
  name: data-processing-worker-secrets
  namespace: enginedge
type: Opaque
data:
  PINECONE_API_KEY: <base64-encoded-key>
  WEAVIATE_API_KEY: <base64-encoded-key>
```

### Base Worker Deployment Template

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: {{WORKER_NAME}}-worker
  namespace: enginedge
  labels:
    app: {{WORKER_NAME}}-worker
    worker-type: {{WORKER_TYPE}}
spec:
  replicas: {{REPLICAS}}
  selector:
    matchLabels:
      app: {{WORKER_NAME}}-worker
  template:
    metadata:
      labels:
        app: {{WORKER_NAME}}-worker
        worker-type: {{WORKER_TYPE}}
    spec:
      containers:
      - name: {{WORKER_NAME}}-worker
        image: enginedge/{{WORKER_NAME}}-worker:latest
        ports:
        - containerPort: {{PORT}}
          name: http
        env:
        - name: NODE_ENV
          valueFrom:
            configMapKeyRef:
              name: worker-shared-config
              key: NODE_ENV
        - name: WORKER_TYPE
          value: "{{WORKER_TYPE}}"
        - name: PORT
          value: "{{PORT}}"
        # Worker-specific environment variables
        {{- range .WorkerEnvVars}}
        - name: {{.Name}}
          valueFrom:
            secretKeyRef:
              name: {{WORKER_NAME}}-worker-secrets
              key: {{.Key}}
        {{- end}}
        resources:
          requests:
            memory: "{{MEMORY_REQUEST}}"
            cpu: "{{CPU_REQUEST}}"
          limits:
            memory: "{{MEMORY_LIMIT}}"
            cpu: "{{CPU_LIMIT}}"
        livenessProbe:
          httpGet:
            path: /health
            port: http
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /health
            port: http
          initialDelaySeconds: 5
          periodSeconds: 5
      affinity:
        podAntiAffinity:
          preferredDuringSchedulingIgnoredDuringExecution:
          - weight: 100
            podAffinityTerm:
              labelSelector:
                matchLabels:
                  worker-type: {{WORKER_TYPE}}
              topologyKey: kubernetes.io/hostname
```

### Worker-Specific Deployments

#### LLM Worker Deployment
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: assistant-worker
  namespace: enginedge
spec:
  replicas: 3
  template:
    spec:
      containers:
      - name: assistant-worker
        resources:
          requests:
            memory: "2Gi"
            cpu: "1000m"
          limits:
            memory: "4Gi"
            cpu: "2000m"
        env:
        - name: OPENAI_API_KEY
          valueFrom:
            secretKeyRef:
              name: assistant-worker-secrets
              key: OPENAI_API_KEY
        - name: ANTHROPIC_API_KEY
          valueFrom:
            secretKeyRef:
              name: assistant-worker-secrets
              key: ANTHROPIC_API_KEY
```

#### Data Processing Worker Deployment
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: data-processing-worker
  namespace: enginedge
spec:
  replicas: 2
  template:
    spec:
      containers:
      - name: data-processing-worker
        resources:
          requests:
            memory: "4Gi"
            cpu: "1000m"
          limits:
            memory: "8Gi"
            cpu: "2000m"
        volumeMounts:
        - name: temp-storage
          mountPath: /tmp/processing
      volumes:
      - name: temp-storage
        emptyDir:
          sizeLimit: 10Gi
```

### Services and Ingress

```yaml
# Worker services (ClusterIP for internal communication)
apiVersion: v1
kind: Service
metadata:
  name: assistant-worker
  namespace: enginedge
spec:
  selector:
    app: assistant-worker
  ports:
  - port: 80
    targetPort: 3001
    name: http

---
# Optional: Ingress for external access (development/testing)
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: workers-ingress
  namespace: enginedge
spec:
  rules:
  - host: workers.enginedge.local
    http:
      paths:
      - path: /llm
        pathType: Prefix
        backend:
          service:
            name: assistant-worker
            port:
              number: 80
      - path: /data-processing
        pathType: Prefix
        backend:
          service:
            name: data-processing-worker
            port:
              number: 80
```

## Configuration

### Shared Environment Variables

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `NODE_ENV` | Environment | production | No |
| `WORKER_TYPE` | Worker type identifier | - | Yes |
| `PORT` | HTTP server port | - | Yes |
| `KAFKA_BROKERS` | Kafka broker addresses | - | Yes |
| `REDIS_URL` | Redis connection URL | - | Yes |
| `LOG_LEVEL` | Logging level | info | No |
| `MAX_CONCURRENCY` | Max concurrent commands | 10 | No |
| `HEALTH_CHECK_INTERVAL` | Health check interval (seconds) | 30 | No |

### Worker-Specific Configuration

#### LLM Worker
```bash
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
HUGGINGFACE_API_KEY=hf_...
DEFAULT_MODEL=gpt-4
MAX_TOKENS_PER_REQUEST=4000
RATE_LIMIT_REQUESTS_PER_MINUTE=60
```

#### Data Processing Worker
```bash
PINECONE_API_KEY=...
PINECONE_INDEX_NAME=enginedge-docs
WEAVIATE_URL=http://weaviate:8080
DEFAULT_CHUNK_SIZE=1000
DEFAULT_CHUNK_OVERLAP=200
SUPPORTED_FORMATS=pdf,docx,txt,html,md
```

#### Agent Tool Worker
```bash
TOOL_TIMEOUT_SECONDS=300
MAX_TOOL_EXECUTIONS_PER_COMMAND=10
ALLOWED_DOMAINS=*.example.com,api.github.com
RATE_LIMIT_PER_TOOL=10
```

## Monitoring & Scaling

### Horizontal Pod Autoscaler

```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: assistant-worker-hpa
  namespace: enginedge
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: assistant-worker
  minReplicas: 1
  maxReplicas: 10
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
  - type: External
    external:
      metric:
        name: kafka_consumergroup_lag
        selector:
          matchLabels:
            topic: worker.llm.requests
      target:
        type: AverageValue
        averageValue: "50"
```

### Prometheus Metrics

Each worker exposes metrics at `/metrics`:

```prometheus
# Command processing metrics
worker_commands_total{worker_type="llm", status="success"} 15432
worker_commands_total{worker_type="llm", status="error"} 168
worker_command_duration_seconds{worker_type="llm", quantile="0.95"} 8.5

# Resource usage
worker_memory_usage_bytes{worker_type="llm"} 1073741824
worker_cpu_usage_percent{worker_type="llm"} 65.2

# External API metrics
worker_external_api_calls_total{worker_type="llm", api="openai"} 15432
worker_external_api_errors_total{worker_type="llm", api="openai"} 23
```

### Logging

Structured JSON logging for all workers:

```json
{
  "timestamp": "2024-01-15T10:30:00Z",
  "level": "info",
  "workerType": "llm",
  "commandId": "cmd_1234567890abcdef",
  "message": "Command processed successfully",
  "processingTime": 2500,
  "model": "gpt-4",
  "tokensUsed": 1250
}
```

## Worker-Specific Configuration

### LLM Worker Configuration

**Models Configuration:**
```typescript
export const llmConfig = {
  models: {
    'gpt-4': {
      provider: 'openai',
      contextWindow: 8192,
      maxTokens: 4096,
      costPerToken: 0.00003,
    },
    'claude-2': {
      provider: 'anthropic',
      contextWindow: 100000,
      maxTokens: 4096,
      costPerToken: 0.000011,
    },
  },
  defaultModel: 'gpt-4',
  rateLimits: {
    requestsPerMinute: 60,
    tokensPerMinute: 40000,
  },
};
```

**Prompt Engineering:**
```typescript
export const promptTemplates = {
  code_generation: {
    system: "You are an expert software engineer...",
    user: "Generate {language} code for: {task}",
  },
  analysis: {
    system: "You are a technical analyst...",
    user: "Analyze the following {content_type}: {content}",
  },
};
```

### Data Processing Worker Configuration

**Document Processing Pipeline:**
```typescript
export const processingConfig = {
  chunking: {
    defaultSize: 1000,
    overlap: 200,
    strategies: {
      recursive: { separators: ['\n\n', '\n', ' ', ''] },
      token: { encoding: 'cl100k_base', size: 512 },
    },
  },
  embeddings: {
    model: 'text-embedding-ada-002',
    dimensions: 1536,
    batchSize: 100,
  },
  vectorStores: {
    pinecone: {
      indexName: 'enginedge-docs',
      dimension: 1536,
      metric: 'cosine',
    },
  },
};
```

**Supported Formats:**
```typescript
export const supportedFormats = {
  pdf: { loader: 'PDFLoader', parser: 'LangChainPDF' },
  docx: { loader: 'DocxLoader', parser: 'Mammoth' },
  html: { loader: 'WebLoader', parser: 'Cheerio' },
  md: { loader: 'TextLoader', parser: 'Markdown' },
};
```

## Troubleshooting

### Common Issues

#### Worker Not Processing Commands

**Symptoms:** Commands remain in PENDING status

**Diagnosis:**
```bash
# Check Kafka consumer groups
kubectl exec -it kafka-pod -- kafka-consumer-groups --describe --group workers

# Check worker logs
kubectl logs -f deployment/assistant-worker -n enginedge

# Verify worker health
curl http://assistant-worker/health
```

**Solutions:**
- Check Kafka connectivity
- Verify worker registration with main hexagon
- Check resource constraints
- Review worker logs for errors

#### High Latency

**Symptoms:** Commands taking longer than expected

**Diagnosis:**
```bash
# Check external API response times
kubectl logs deployment/assistant-worker -n enginedge | grep "API call"

# Monitor resource usage
kubectl top pods -n enginedge

# Check network latency
kubectl run nettest --image=busybox --rm -it -- wget -O- http://external-api.com/health
```

**Solutions:**
- Optimize external API calls
- Implement caching
- Scale worker replicas
- Check network policies

#### Memory Issues

**Symptoms:** OOMKilled pods

**Diagnosis:**
```bash
# Check memory usage patterns
kubectl logs deployment/data-processing-worker -n enginedge | grep "heap used"

# Monitor pod events
kubectl get events -n enginedge --field-selector reason=OOMKilled
```

**Solutions:**
- Increase memory limits
- Optimize document processing batch sizes
- Implement streaming for large documents
- Add memory profiling

#### External API Rate Limiting

**Symptoms:** Commands failing with rate limit errors

**Diagnosis:**
```bash
# Check API error logs
kubectl logs deployment/assistant-worker -n enginedge | grep "rate limit"

# Monitor API usage
kubectl exec -it assistant-worker-pod -- cat /app/metrics | grep external_api
```

**Solutions:**
- Implement exponential backoff
- Add request queuing
- Switch to alternative providers
- Upgrade API plans

### Debug Commands

```bash
# View worker-specific logs
kubectl logs -f deployment/assistant-worker -n enginedge --tail=100

# Debug worker pod
kubectl exec -it assistant-worker-pod -n enginedge -- /bin/sh

# Check Kafka topics
kubectl exec -it kafka-pod -- kafka-topics --list --bootstrap-server localhost:9092

# Monitor consumer lag
kubectl exec -it kafka-pod -- kafka-consumer-groups --describe --group workers --bootstrap-server localhost:9092

# Check worker metrics
curl http://assistant-worker/metrics

# View pod resource usage
kubectl top pods -n enginedge -l app=assistant-worker
```

### Performance Optimization

```yaml
# Resource optimization
resources:
  requests:
    memory: "1Gi"
    cpu: "500m"
  limits:
    memory: "2Gi"
    cpu: "1000m"

# JVM-like options for heavy workers
env:
- name: NODE_OPTIONS
  value: "--max-old-space-size=2048 --optimize-for-size"
```

```typescript
// Connection pooling
export const externalApiConfig = {
  poolSize: 20,
  retryDelay: 1000,
  retryAttempts: 3,
  timeout: 30000,
  rateLimit: {
    requests: 60,
    windowMs: 60000,
  },
};
```

This deployment guide provides comprehensive instructions for deploying and managing all EnginEdge worker nodes in various environments.