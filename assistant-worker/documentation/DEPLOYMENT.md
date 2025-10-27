# Assistant Worker - Deployment Guide

## Table of Contents

- [Deployment Options](#deployment-options)
- [Docker Deployment](#docker-deployment)
- [Kubernetes Deployment](#kubernetes-deployment)
- [Environment Configuration](#environment-configuration)
- [Health Checks](#health-checks)
- [Monitoring Setup](#monitoring-setup)
- [Security](#security)
- [Scaling](#scaling)

---

## Deployment Options

| Option | Complexity | Best For |
|--------|------------|----------|
| **Local** | Low | Development, testing |
| **Docker** | Medium | Single server, staging |
| **Kubernetes** | High | Production, high availability |
| **Cloud (AWS/GCP/Azure)** | Medium-High | Managed infrastructure |

---

## Docker Deployment

### Build Image

```bash
# Build image
docker build -t assistant-worker:latest .

# Tag for registry
docker tag assistant-worker:latest your-registry/assistant-worker:1.0.0

# Push to registry
docker push your-registry/assistant-worker:1.0.0
```

### Run Container

```bash
# Run with environment variables
docker run -d \
  --name assistant-worker \
  -p 3001:3001 \
  -e PORT=3001 \
  -e NODE_ENV=production \
  -e OPENAI_API_KEY=your_key \
  -e MONGODB_URI=mongodb://mongo:27017/assistant \
  -e NEO4J_URI=bolt://neo4j:7687 \
  -e NEO4J_USER=neo4j \
  -e NEO4J_PASSWORD=password \
  assistant-worker:latest

# Check logs
docker logs -f assistant-worker

# Check health
curl http://localhost:3001/health
```

### Docker Compose

Create `docker-compose.yml`:

```yaml
version: '3.8'

services:
  assistant-worker:
    image: assistant-worker:latest
    build:
      context: .
      dockerfile: Dockerfile
    ports:
      - "3001:3001"
    environment:
      PORT: 3001
      NODE_ENV: production
      MONGODB_URI: mongodb://mongo:27017/assistant
      NEO4J_URI: bolt://neo4j:7687
      NEO4J_USER: neo4j
      NEO4J_PASSWORD: ${NEO4J_PASSWORD}
      OPENAI_API_KEY: ${OPENAI_API_KEY}
    depends_on:
      - mongo
      - neo4j
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3001/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s

  mongo:
    image: mongo:7
    ports:
      - "27017:27017"
    volumes:
      - mongo-data:/data/db
    restart: unless-stopped

  neo4j:
    image: neo4j:5
    ports:
      - "7474:7474"
      - "7687:7687"
    environment:
      NEO4J_AUTH: neo4j/${NEO4J_PASSWORD}
    volumes:
      - neo4j-data:/data
    restart: unless-stopped

  prometheus:
    image: prom/prometheus:latest
    ports:
      - "9090:9090"
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml
      - prometheus-data:/prometheus
    command:
      - '--config.file=/etc/prometheus/prometheus.yml'
      - '--storage.tsdb.path=/prometheus'
    restart: unless-stopped

  grafana:
    image: grafana/grafana:latest
    ports:
      - "3000:3000"
    environment:
      GF_SECURITY_ADMIN_PASSWORD: ${GRAFANA_PASSWORD}
    volumes:
      - grafana-data:/var/lib/grafana
    depends_on:
      - prometheus
    restart: unless-stopped

volumes:
  mongo-data:
  neo4j-data:
  prometheus-data:
  grafana-data:
```

Create `.env` file:

```bash
NEO4J_PASSWORD=your_password
OPENAI_API_KEY=sk-...
GRAFANA_PASSWORD=admin
```

Start stack:

```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f assistant-worker

# Stop all services
docker-compose down

# Stop and remove volumes
docker-compose down -v
```

---

## Kubernetes Deployment

### Prerequisites

```bash
# Install kubectl
curl -LO "https://dl.k8s.io/release/$(curl -L -s https://dl.k8s.io/release/stable.txt)/bin/linux/amd64/kubectl"
chmod +x kubectl
sudo mv kubectl /usr/local/bin/

# Verify
kubectl version --client
```

### Namespace

Create `k8s/namespace.yaml`:

```yaml
apiVersion: v1
kind: Namespace
metadata:
  name: assistant-worker
  labels:
    name: assistant-worker
```

```bash
kubectl apply -f k8s/namespace.yaml
```

### ConfigMap

Create `k8s/configmap.yaml`:

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: assistant-worker-config
  namespace: assistant-worker
data:
  PORT: "3001"
  NODE_ENV: "production"
  LOG_LEVEL: "info"
  MONGODB_URI: "mongodb://mongo:27017/assistant"
  NEO4J_URI: "bolt://neo4j:7687"
  NEO4J_USER: "neo4j"
```

### Secrets

Create `k8s/secrets.yaml`:

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: assistant-worker-secrets
  namespace: assistant-worker
type: Opaque
stringData:
  OPENAI_API_KEY: "sk-..."
  ANTHROPIC_API_KEY: "sk-ant-..."
  NEO4J_PASSWORD: "your_password"
  MONGODB_PASSWORD: "your_password"
```

**Important:** Don't commit secrets to git. Use Sealed Secrets or external secret management.

```bash
kubectl apply -f k8s/secrets.yaml
```

### Deployment

Create `k8s/deployment.yaml`:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: assistant-worker
  namespace: assistant-worker
  labels:
    app: assistant-worker
spec:
  replicas: 3
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1
      maxUnavailable: 0
  selector:
    matchLabels:
      app: assistant-worker
  template:
    metadata:
      labels:
        app: assistant-worker
      annotations:
        prometheus.io/scrape: "true"
        prometheus.io/port: "3001"
        prometheus.io/path: "/metrics"
    spec:
      containers:
      - name: assistant-worker
        image: your-registry/assistant-worker:1.0.0
        imagePullPolicy: IfNotPresent
        ports:
        - name: http
          containerPort: 3001
          protocol: TCP
        envFrom:
        - configMapRef:
            name: assistant-worker-config
        - secretRef:
            name: assistant-worker-secrets
        resources:
          requests:
            memory: "512Mi"
            cpu: "500m"
          limits:
            memory: "2Gi"
            cpu: "2000m"
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
        lifecycle:
          preStop:
            exec:
              command: ["/bin/sh", "-c", "sleep 15"]
      terminationGracePeriodSeconds: 30
```

```bash
kubectl apply -f k8s/deployment.yaml
```

### Service

Create `k8s/service.yaml`:

```yaml
apiVersion: v1
kind: Service
metadata:
  name: assistant-worker
  namespace: assistant-worker
  labels:
    app: assistant-worker
spec:
  type: ClusterIP
  ports:
  - name: http
    port: 80
    targetPort: 3001
    protocol: TCP
  selector:
    app: assistant-worker
```

```bash
kubectl apply -f k8s/service.yaml
```

### Ingress

Create `k8s/ingress.yaml`:

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: assistant-worker
  namespace: assistant-worker
  annotations:
    kubernetes.io/ingress.class: nginx
    cert-manager.io/cluster-issuer: letsencrypt-prod
    nginx.ingress.kubernetes.io/rate-limit: "100"
    nginx.ingress.kubernetes.io/ssl-redirect: "true"
spec:
  tls:
  - hosts:
    - assistant.yourdomain.com
    secretName: assistant-worker-tls
  rules:
  - host: assistant.yourdomain.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: assistant-worker
            port:
              number: 80
```

```bash
kubectl apply -f k8s/ingress.yaml
```

### HorizontalPodAutoscaler

Create `k8s/hpa.yaml`:

```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: assistant-worker
  namespace: assistant-worker
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: assistant-worker
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
  behavior:
    scaleUp:
      stabilizationWindowSeconds: 60
      policies:
      - type: Percent
        value: 50
        periodSeconds: 60
    scaleDown:
      stabilizationWindowSeconds: 300
      policies:
      - type: Percent
        value: 10
        periodSeconds: 60
```

```bash
kubectl apply -f k8s/hpa.yaml
```

### Deploy All

```bash
# Create namespace
kubectl apply -f k8s/namespace.yaml

# Deploy resources
kubectl apply -f k8s/configmap.yaml
kubectl apply -f k8s/secrets.yaml
kubectl apply -f k8s/deployment.yaml
kubectl apply -f k8s/service.yaml
kubectl apply -f k8s/ingress.yaml
kubectl apply -f k8s/hpa.yaml

# Check status
kubectl get all -n assistant-worker

# Check logs
kubectl logs -f deployment/assistant-worker -n assistant-worker

# Check health
kubectl exec -it deployment/assistant-worker -n assistant-worker -- curl http://localhost:3001/health
```

---

## Environment Configuration

### Required Environment Variables

```bash
# Server
PORT=3001
NODE_ENV=production

# LLM Providers
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...

# MongoDB
MONGODB_URI=mongodb://localhost:27017/assistant
MONGODB_USER=admin
MONGODB_PASSWORD=password

# Neo4j
NEO4J_URI=bolt://localhost:7687
NEO4J_USER=neo4j
NEO4J_PASSWORD=password

# Kafka (optional)
KAFKA_BROKERS=localhost:9092
KAFKA_CLIENT_ID=assistant-worker
KAFKA_GROUP_ID=assistant-worker-group
```

### Optional Environment Variables

```bash
# Logging
LOG_LEVEL=info  # debug, info, warn, error
LOG_FORMAT=json  # json or pretty

# Performance
MAX_OLD_SPACE_SIZE=2048  # MB
WORKER_THREADS=4

# Security
CORS_ORIGIN=*
API_KEY_REQUIRED=false

# Features
ENABLE_STREAMING=true
ENABLE_CHECKPOINTING=true
ENABLE_HITL=true
```

---

## Health Checks

### Liveness Probe

Tests if the application is running:

```bash
curl http://localhost:3001/health
```

Expected response:
```json
{
  "status": "ok",
  "timestamp": "2025-10-24T12:00:00.000Z",
  "uptime": 123.45
}
```

### Readiness Probe

Tests if the application is ready to accept traffic:

```bash
curl http://localhost:3001/health/ready
```

Checks:
- Database connections (MongoDB, Neo4j)
- External service availability
- Resource availability

---

## Monitoring Setup

### Prometheus

Create `prometheus.yml`:

```yaml
global:
  scrape_interval: 15s
  evaluation_interval: 15s

scrape_configs:
  - job_name: 'assistant-worker'
    static_configs:
      - targets: ['assistant-worker:3001']
    metrics_path: '/metrics'
    scrape_interval: 10s
```

### Grafana

1. **Add Prometheus data source:**
   - URL: `http://prometheus:9090`

2. **Import dashboard:**
   - Use dashboard ID: 11159 (NestJS dashboard)
   - Or create custom dashboard (see METRICS.md)

3. **Create alerts:**
   - High error rate
   - High response time
   - Memory usage

---

## Security

### 1. API Authentication

Add authentication middleware:

```typescript
// In main.ts
app.use(authMiddleware);

// Or use guards
@UseGuards(AuthGuard)
@Controller('agents')
export class AgentController {
  // ...
}
```

### 2. Rate Limiting

```typescript
import { ThrottlerModule } from '@nestjs/throttler';

@Module({
  imports: [
    ThrottlerModule.forRoot({
      ttl: 60,
      limit: 10  // 10 requests per minute
    })
  ]
})
```

### 3. CORS Configuration

```typescript
// In main.ts
app.enableCors({
  origin: process.env.CORS_ORIGIN || '*',
  credentials: true
});
```

### 4. HTTPS

Use reverse proxy (nginx, traefik) for SSL termination:

```nginx
server {
    listen 443 ssl http2;
    server_name assistant.yourdomain.com;
    
    ssl_certificate /etc/ssl/certs/cert.pem;
    ssl_certificate_key /etc/ssl/private/key.pem;
    
    location / {
        proxy_pass http://assistant-worker:3001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

### 5. Secrets Management

**Kubernetes Secrets:**
```bash
kubectl create secret generic assistant-worker-secrets \
  --from-literal=OPENAI_API_KEY=sk-... \
  --namespace=assistant-worker
```

**AWS Secrets Manager:**
```typescript
import { SecretsManager } from 'aws-sdk';

const sm = new SecretsManager();
const secret = await sm.getSecretValue({ SecretId: 'assistant-worker' }).promise();
const config = JSON.parse(secret.SecretString);
```

**HashiCorp Vault:**
```typescript
import Vault from 'node-vault';

const vault = Vault({
  endpoint: 'http://vault:8200',
  token: process.env.VAULT_TOKEN
});

const secret = await vault.read('secret/data/assistant-worker');
```

---

## Scaling

### Horizontal Scaling

**Stateless Design:**
- No local state in application
- Session data in external store (Redis/MongoDB)
- Shared databases

**Load Balancing:**
```yaml
# Kubernetes Service
apiVersion: v1
kind: Service
spec:
  type: LoadBalancer
  sessionAffinity: None  # Round-robin
```

**Auto-scaling:**
```yaml
# Based on CPU/Memory
minReplicas: 3
maxReplicas: 20

# Based on custom metrics
- type: Pods
  pods:
    metric:
      name: agent_executions_total
    target:
      type: AverageValue
      averageValue: "100"
```

### Vertical Scaling

**Increase resources per pod:**
```yaml
resources:
  requests:
    memory: "1Gi"
    cpu: "1000m"
  limits:
    memory: "4Gi"
    cpu: "4000m"
```

**Node.js tuning:**
```bash
node --max-old-space-size=4096 dist/main.js
```

---

## Backup & Recovery

### MongoDB Backup

```bash
# Backup
mongodump --uri="mongodb://localhost:27017/assistant" --out=/backup

# Restore
mongorestore /backup
```

### Neo4j Backup

```bash
# Backup
neo4j-admin backup --database=neo4j --to=/backup

# Restore
neo4j-admin restore --from=/backup/neo4j
```

### Automated Backups

```yaml
# Kubernetes CronJob
apiVersion: batch/v1
kind: CronJob
metadata:
  name: mongodb-backup
spec:
  schedule: "0 2 * * *"  # Daily at 2 AM
  jobTemplate:
    spec:
      template:
        spec:
          containers:
          - name: backup
            image: mongo:7
            command:
            - /bin/sh
            - -c
            - mongodump --uri=$MONGODB_URI --out=/backup
            volumeMounts:
            - name: backup
              mountPath: /backup
          restartPolicy: OnFailure
          volumes:
          - name: backup
            persistentVolumeClaim:
              claimName: backup-pvc
```

---

## Rollback

### Docker

```bash
# Rollback to previous image
docker stop assistant-worker
docker rm assistant-worker
docker run -d ... assistant-worker:previous-tag
```

### Kubernetes

```bash
# Check rollout history
kubectl rollout history deployment/assistant-worker -n assistant-worker

# Rollback to previous version
kubectl rollout undo deployment/assistant-worker -n assistant-worker

# Rollback to specific revision
kubectl rollout undo deployment/assistant-worker --to-revision=2 -n assistant-worker
```

---

## Troubleshooting Deployment

### Pods Not Starting

```bash
# Check pod status
kubectl get pods -n assistant-worker

# Check events
kubectl describe pod assistant-worker-xxx -n assistant-worker

# Check logs
kubectl logs assistant-worker-xxx -n assistant-worker
```

### Image Pull Errors

```bash
# Create imagePullSecret
kubectl create secret docker-registry regcred \
  --docker-server=your-registry.com \
  --docker-username=user \
  --docker-password=pass \
  --namespace=assistant-worker

# Add to deployment
spec:
  template:
    spec:
      imagePullSecrets:
      - name: regcred
```

### Health Check Failures

```bash
# Test health endpoint manually
kubectl exec -it assistant-worker-xxx -n assistant-worker -- curl http://localhost:3001/health

# Increase timeouts
readinessProbe:
  initialDelaySeconds: 30  # Increase if slow startup
  timeoutSeconds: 10
```

---

## Summary

### Quick Start Checklist

- [ ] Build Docker image
- [ ] Push to registry
- [ ] Create Kubernetes namespace
- [ ] Configure ConfigMap
- [ ] Create Secrets (securely)
- [ ] Deploy application
- [ ] Configure autoscaling
- [ ] Set up monitoring
- [ ] Configure backups
- [ ] Test health checks
- [ ] Test scaling
- [ ] Document rollback procedure

### Production Checklist

- [ ] HTTPS enabled
- [ ] Authentication configured
- [ ] Rate limiting enabled
- [ ] Monitoring dashboards created
- [ ] Alerts configured
- [ ] Backups automated
- [ ] Disaster recovery plan
- [ ] Load testing completed
- [ ] Security audit passed
- [ ] Documentation updated

---

**Last Updated:** October 24, 2025

