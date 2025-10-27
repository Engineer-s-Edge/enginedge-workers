# Data Processing Worker - Deployment Guide

## Table of Contents

- [Overview](#overview)
- [Prerequisites](#prerequisites)
- [Local Development Setup](#local-development-setup)
- [Docker Deployment](#docker-deployment)
- [Kubernetes Deployment](#kubernetes-deployment)
- [Environment Configuration](#environment-configuration)
- [Database Migration](#database-migration)
- [Health Checks](#health-checks)
- [Monitoring & Logging](#monitoring--logging)
- [Troubleshooting Deployments](#troubleshooting-deployments)

---

## Overview

The Data Processing Worker can be deployed in multiple environments:

1. **Local Development** - Single machine with hot reload
2. **Docker Container** - Containerized deployment
3. **Kubernetes** - Orchestrated microservices
4. **Production** - Multi-region, load-balanced setup

### Deployment Matrix

| Environment | Deployment | Replicas | Auto-scaling | HA |
|-------------|-----------|----------|--------------|-----|
| Development | Docker Compose | 1 | No | No |
| Staging | Kubernetes | 2 | Yes | Yes |
| Production | Kubernetes | 3-5 | Yes | Yes |

---

## Prerequisites

### System Requirements

**Development:**
- Node.js 18.x or higher
- npm or yarn
- MongoDB 5.x or Docker
- 2GB RAM minimum
- 500MB disk space

**Production:**
- Kubernetes 1.24+
- Docker 20.10+
- MongoDB Replica Set
- 4GB RAM per pod
- 50GB persistent storage

### Required Software

```bash
# Check versions
node --version
npm --version
docker --version
kubectl version --client

# Should output:
# v18.x.x
# 9.x.x
# Docker version 20.x
# Client Version: v1.27+
```

### Access & Credentials

- Docker Registry credentials
- MongoDB connection string
- AWS/GCP/Azure credentials (if cloud-based)
- API keys (OpenAI, Google, etc.)

---

## Local Development Setup

### 1. Clone Repository

```bash
git clone https://github.com/your-org/enginedge.git
cd enginedge/enginedge-workers/data-processing-worker
```

### 2. Install Dependencies

```bash
npm install

# If peer dependency issues
npm install --legacy-peer-deps
```

### 3. Setup Environment Variables

```bash
# Copy example file
cp .env.example .env

# Edit with your values
nano .env
```

**Required variables:**
```
NODE_ENV=development
PORT=3002
MONGODB_URI=mongodb://localhost:27017/enginedge
OPENAI_API_KEY=sk-...
GOOGLE_API_KEY=AIza...
```

### 4. Start MongoDB (Docker)

```bash
# Start MongoDB container
docker run -d \
  --name mongodb \
  -p 27017:27017 \
  -e MONGO_INITDB_ROOT_USERNAME=admin \
  -e MONGO_INITDB_ROOT_PASSWORD=password \
  mongo:latest

# Update .env
MONGODB_URI=mongodb://admin:password@localhost:27017/enginedge
```

### 5. Start Development Server

```bash
# Development with hot reload
npm run start:dev

# Production build
npm run build
npm run start

# Expected output:
# [Nest] 12345  - 10/24/2025, 12:00:00 AM     LOG [NestFactory] Starting Nest application...
# [Nest] 12345  - 10/24/2025, 12:00:01 AM     LOG [InstanceLoader] ApplicationModule dependencies initialized
# [Nest] 12345  - 10/24/2025, 12:00:02 AM     LOG [NestApplication] Nest application successfully started +123ms
```

### 6. Verify Installation

```bash
# Test health endpoint
curl http://localhost:3002/health

# Expected response:
# {"status":"healthy","timestamp":"...","services":{...}}

# Run tests
npm test

# Run linting
npm run lint
```

---

## Docker Deployment

### 1. Build Docker Image

```bash
# Build image
docker build -t data-processing-worker:1.0.0 .

# Tag for registry
docker tag data-processing-worker:1.0.0 \
  your-registry/data-processing-worker:1.0.0

# Push to registry
docker push your-registry/data-processing-worker:1.0.0
```

### 2. Docker Compose for Local

```yaml
# docker-compose.yml
version: '3.8'

services:
  mongodb:
    image: mongo:latest
    ports:
      - "27017:27017"
    environment:
      MONGO_INITDB_ROOT_USERNAME: admin
      MONGO_INITDB_ROOT_PASSWORD: password
    volumes:
      - mongo_data:/data/db

  data-processing-worker:
    build: .
    ports:
      - "3002:3002"
    environment:
      NODE_ENV: development
      PORT: 3002
      MONGODB_URI: mongodb://admin:password@mongodb:27017/enginedge
      OPENAI_API_KEY: ${OPENAI_API_KEY}
      GOOGLE_API_KEY: ${GOOGLE_API_KEY}
    depends_on:
      - mongodb
    volumes:
      - ./src:/app/src
    command: npm run start:dev

volumes:
  mongo_data:
```

### 3. Run Docker Compose

```bash
# Start services
docker-compose up

# In background
docker-compose up -d

# View logs
docker-compose logs -f data-processing-worker

# Stop services
docker-compose down
```

### 4. Single Container Deployment

```bash
# Run container
docker run -d \
  --name dpw \
  -p 3002:3002 \
  -e NODE_ENV=production \
  -e MONGODB_URI=mongodb://mongo:27017/enginedge \
  -e OPENAI_API_KEY=${OPENAI_API_KEY} \
  -e GOOGLE_API_KEY=${GOOGLE_API_KEY} \
  your-registry/data-processing-worker:1.0.0

# Check logs
docker logs -f dpw

# Health check
curl http://localhost:3002/health
```

---

## Kubernetes Deployment

### 1. Create Namespace

```bash
kubectl create namespace enginedge

# Set default namespace
kubectl config set-context --current --namespace=enginedge
```

### 2. Create ConfigMap for Non-Sensitive Config

```yaml
# config.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: dpw-config
  namespace: enginedge
data:
  NODE_ENV: production
  PORT: "3002"
  LOG_LEVEL: info
  CACHE_MAX_SIZE: "10000"
  MAX_FILE_SIZE: "52428800"
```

```bash
kubectl apply -f config.yaml
```

### 3. Create Secret for Sensitive Data

```bash
# Create secret with credentials
kubectl create secret generic dpw-secrets \
  --from-literal=MONGODB_URI="mongodb://user:pass@mongo:27017/enginedge" \
  --from-literal=OPENAI_API_KEY="${OPENAI_API_KEY}" \
  --from-literal=GOOGLE_API_KEY="${GOOGLE_API_KEY}" \
  -n enginedge

# Or use secret file
kubectl create secret generic dpw-secrets \
  --from-file=.env \
  -n enginedge
```

### 4. Create Deployment

```yaml
# deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: data-processing-worker
  namespace: enginedge
  labels:
    app: dpw
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
      app: dpw
  template:
    metadata:
      labels:
        app: dpw
        version: v1
    spec:
      serviceAccountName: dpw-sa
      containers:
      - name: dpw
        image: your-registry/data-processing-worker:1.0.0
        imagePullPolicy: IfNotPresent
        ports:
        - containerPort: 3002
          name: http
        
        # Environment variables
        envFrom:
        - configMapRef:
            name: dpw-config
        - secretRef:
            name: dpw-secrets
        
        # Resource limits
        resources:
          requests:
            memory: "512Mi"
            cpu: "500m"
          limits:
            memory: "2Gi"
            cpu: "2000m"
        
        # Health checks
        livenessProbe:
          httpGet:
            path: /health
            port: 3002
          initialDelaySeconds: 30
          periodSeconds: 10
          timeoutSeconds: 5
          failureThreshold: 3
        
        readinessProbe:
          httpGet:
            path: /health
            port: 3002
          initialDelaySeconds: 10
          periodSeconds: 5
          timeoutSeconds: 3
          failureThreshold: 2
        
        # Logging
        volumeMounts:
        - name: logs
          mountPath: /app/logs
      
      volumes:
      - name: logs
        emptyDir: {}
      
      # Pod affinity (spread across nodes)
      affinity:
        podAntiAffinity:
          preferredDuringSchedulingIgnoredDuringExecution:
          - weight: 100
            podAffinityTerm:
              labelSelector:
                matchExpressions:
                - key: app
                  operator: In
                  values:
                  - dpw
              topologyKey: kubernetes.io/hostname

---
apiVersion: v1
kind: Service
metadata:
  name: dpw-service
  namespace: enginedge
  labels:
    app: dpw
spec:
  type: ClusterIP
  ports:
  - port: 3002
    targetPort: 3002
    protocol: TCP
    name: http
  selector:
    app: dpw

---
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: dpw-hpa
  namespace: enginedge
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: data-processing-worker
  minReplicas: 2
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

### 5. Create Service Account & RBAC

```yaml
# rbac.yaml
apiVersion: v1
kind: ServiceAccount
metadata:
  name: dpw-sa
  namespace: enginedge

---
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: dpw-role
  namespace: enginedge
rules:
- apiGroups: [""]
  resources: ["configmaps"]
  verbs: ["get", "list", "watch"]
- apiGroups: [""]
  resources: ["secrets"]
  verbs: ["get"]

---
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
  name: dpw-rolebinding
  namespace: enginedge
roleRef:
  apiGroup: rbac.authorization.k8s.io
  kind: Role
  name: dpw-role
subjects:
- kind: ServiceAccount
  name: dpw-sa
  namespace: enginedge
```

### 6. Deploy to Kubernetes

```bash
# Apply configurations
kubectl apply -f config.yaml
kubectl apply -f rbac.yaml
kubectl apply -f deployment.yaml

# Check deployment status
kubectl get deployments -n enginedge

# Check pods
kubectl get pods -n enginedge

# Check service
kubectl get svc -n enginedge

# View logs
kubectl logs -f deployment/data-processing-worker -n enginedge

# Check events
kubectl describe pod <pod-name> -n enginedge
```

---

## Environment Configuration

### Development (.env)

```bash
NODE_ENV=development
PORT=3002
LOG_LEVEL=debug

# Database
MONGODB_URI=mongodb://localhost:27017/enginedge

# APIs
OPENAI_API_KEY=sk-test-...
GOOGLE_API_KEY=AIza-test-...

# Optional
DEBUG=enginedge:*
```

### Staging (.env.staging)

```bash
NODE_ENV=staging
PORT=3002
LOG_LEVEL=info

MONGODB_URI=mongodb+srv://user:pass@staging.mongodb.net/enginedge

OPENAI_API_KEY=${OPENAI_API_KEY}
GOOGLE_API_KEY=${GOOGLE_API_KEY}

# Staging optimizations
CACHE_MAX_SIZE=5000
```

### Production (.env.production)

```bash
NODE_ENV=production
PORT=3002
LOG_LEVEL=warn

MONGODB_URI=mongodb+srv://user:pass@prod.mongodb.net/enginedge
MONGODB_POOL_SIZE=50

OPENAI_API_KEY=${OPENAI_API_KEY}
GOOGLE_API_KEY=${GOOGLE_API_KEY}

# Production optimizations
CACHE_MAX_SIZE=10000
MAX_FILE_SIZE=104857600
EMBEDDER_TIMEOUT=30000

# Security
CORS_ORIGIN=https://app.yourdomain.com
```

---

## Database Migration

### 1. Connect to MongoDB

```bash
# Local
mongosh mongodb://localhost:27017/enginedge

# Remote
mongosh "mongodb+srv://user:pass@cluster.mongodb.net/enginedge"
```

### 2. Initialize Collections

```bash
# Create collections
db.createCollection("documents")
db.createCollection("embeddings")

# Create indexes
db.documents.createIndex({ userId: 1 })
db.documents.createIndex({ createdAt: 1 })

db.embeddings.createIndex({ embedding: "cosmosSearch" })
db.embeddings.createIndex({ userId: 1, conversationId: 1 })
db.embeddings.createIndex({ "metadata.sourceType": 1 })

# TTL index for auto-cleanup (30 days)
db.embeddings.createIndex(
  { createdAt: 1 },
  { expireAfterSeconds: 2592000 }
)
```

### 3. Data Migration (if upgrading)

```bash
# Export data
mongoexport --uri="mongodb://localhost:27017/enginedge" \
  --collection=embeddings \
  --out=embeddings.json

# Transform if needed
# ... process embeddings.json ...

# Import data
mongoimport --uri="mongodb+srv://user:pass@prod.mongodb.net/enginedge" \
  --collection=embeddings \
  --file=embeddings.json
```

---

## Health Checks

### Liveness Probe

```bash
# HTTP GET /health
curl http://localhost:3002/health

# Response should include:
{
  "status": "healthy",
  "services": {
    "mongodb": "connected",
    "embedders": "operational"
  }
}
```

### Readiness Probe

```bash
# Check all dependencies ready
# Same as liveness, but ensures full startup

# In Kubernetes, use separate endpoints for more granular control
livenessProbe:
  httpGet:
    path: /health/live
    port: 3002
  initialDelaySeconds: 30
  periodSeconds: 10

readinessProbe:
  httpGet:
    path: /health/ready
    port: 3002
  initialDelaySeconds: 10
  periodSeconds: 5
```

---

## Monitoring & Logging

### Logs

```bash
# View recent logs
npm run logs

# Filter by level
npm run logs -- --level=error

# Follow logs
npm run logs -- --follow

# Kubernetes
kubectl logs deployment/data-processing-worker -n enginedge --follow
```

### Metrics

```bash
# Prometheus metrics endpoint
curl http://localhost:3002/metrics

# Includes:
# - HTTP request count/duration
# - Database operation metrics
# - Embedding generation metrics
# - Cache statistics
```

### Dashboards

Set up Grafana dashboards to monitor:
- Request latency (p50, p95, p99)
- Throughput (requests/sec)
- Error rate
- Memory usage
- CPU usage
- Database connection pool
- Cache hit rate
- API quota usage

---

## Troubleshooting Deployments

### Pod Won't Start

```bash
# Check pod events
kubectl describe pod <pod-name> -n enginedge

# Check logs
kubectl logs <pod-name> -n enginedge

# Common causes:
# - ImagePullBackOff: Fix image name or credentials
# - CrashLoopBackOff: Check environment variables
# - Pending: Check resource requests/node capacity
```

### Service Unreachable

```bash
# Check service exists
kubectl get svc -n enginedge

# Check endpoints
kubectl get endpoints -n enginedge

# Port forward for debugging
kubectl port-forward svc/dpw-service 3002:3002 -n enginedge

# Test locally
curl http://localhost:3002/health
```

### MongoDB Connection Fails

```bash
# Check connection string
kubectl exec -it <pod-name> -n enginedge -- env | grep MONGODB_URI

# Test connectivity from pod
kubectl exec -it <pod-name> -n enginedge -- \
  mongosh "mongodb://..."

# Check secret
kubectl get secret dpw-secrets -n enginedge -o yaml
```

### High Memory Usage

```bash
# Check limits
kubectl describe pod <pod-name> -n enginedge | grep -A 5 Limits

# Check actual usage
kubectl top pod <pod-name> -n enginedge

# Restart pod if needed
kubectl delete pod <pod-name> -n enginedge
```

---

## Rollback Procedures

### Docker

```bash
# Revert to previous image
docker stop dpw
docker rm dpw
docker run -d ... your-registry/data-processing-worker:1.0.0 ...
```

### Kubernetes

```bash
# Check rollout history
kubectl rollout history deployment/data-processing-worker -n enginedge

# Rollback to previous version
kubectl rollout undo deployment/data-processing-worker -n enginedge

# Rollback to specific revision
kubectl rollout undo deployment/data-processing-worker \
  --to-revision=2 -n enginedge

# Check status
kubectl rollout status deployment/data-processing-worker -n enginedge
```

---

## Performance Tuning

### Kubernetes Resource Tuning

```yaml
resources:
  requests:
    memory: "1Gi"      # Guaranteed reservation
    cpu: "1000m"       # 1 CPU core
  limits:
    memory: "4Gi"      # Maximum allowed
    cpu: "4000m"       # 4 CPU cores
```

### Scaling Configuration

```bash
# Manual scaling
kubectl scale deployment data-processing-worker \
  --replicas=5 -n enginedge

# Verify
kubectl get deployment data-processing-worker -n enginedge
```

---

**Deployment Guide Version:** 1.0  
**Last Updated:** October 24, 2025  
**Reviewed By:** DevOps Team
