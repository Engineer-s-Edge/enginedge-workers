# Resume Worker Deployment Guide

## Overview

This guide covers deployment strategies for the Resume Worker and Resume NLP Service across different environments.

---

## Table of Contents

- [Prerequisites](#prerequisites)
- [Environment Configuration](#environment-configuration)
- [Local Development](#local-development)
- [Docker Deployment](#docker-deployment)
- [Kubernetes Deployment](#kubernetes-deployment)
- [Production Checklist](#production-checklist)
- [Monitoring Setup](#monitoring-setup)
- [Backup and Recovery](#backup-and-recovery)

---

## Prerequisites

### Resume Worker (NestJS)
- Node.js 18+
- npm or yarn
- MongoDB 7+
- Kafka 3.7+
- Redis 7+

### Resume NLP Service (Python)
- Python 3.9+
- pip
- spaCy 3.7+
- NLTK 3.8+
- PyMuPDF 1.23+

---

## Environment Configuration

### Resume Worker (.env)

```env
# Server
NODE_ENV=production
PORT=3006
LOG_LEVEL=info

# MongoDB
MONGODB_URI=mongodb://mongodb:27017/resume-worker
MONGODB_MAX_POOL_SIZE=50
MONGODB_MIN_POOL_SIZE=10

# Kafka
KAFKA_BROKERS=kafka:9092
KAFKA_CLIENT_ID=resume-worker
KAFKA_GROUP_ID=resume-worker-group
KAFKA_TOPIC_PREFIX=resume

# Redis
REDIS_URL=redis://redis:6379/1
REDIS_MAX_RETRIES=3

# Integration URLs
LATEX_WORKER_URL=http://latex-worker:3005
ASSISTANT_WORKER_URL=http://assistant-worker:3001
DATA_PROCESSING_WORKER_URL=http://data-processing-worker:3003
RESUME_NLP_SERVICE_URL=http://resume-nlp-service:8001

# LLM (Optional)
OPENAI_API_KEY=your_key_here
ANTHROPIC_API_KEY=your_key_here

# Security
JWT_SECRET=your_secret_here
ENCRYPTION_KEY=your_encryption_key_here

# Monitoring
PROMETHEUS_ENABLED=true
METRICS_PORT=9090
```

### Resume NLP Service (.env)

```env
# Server
PORT=8001
WORKERS=4
LOG_LEVEL=info

# Kafka
KAFKA_BROKERS=kafka:9092
KAFKA_GROUP_ID=resume-nlp-group

# spaCy
SPACY_MODEL=en_core_web_sm

# Processing
MAX_CONCURRENT_REQUESTS=10
REQUEST_TIMEOUT=30
```

---

## Local Development

### Resume Worker

```bash
# Navigate to directory
cd enginedge-workers/resume-worker

# Install dependencies
npm install

# Set up environment
cp .env.example .env
# Edit .env with local values

# Run migrations (if any)
npm run migration:run

# Start in development mode
npm run start:dev

# Or watch mode
npm run start
```

### Resume NLP Service

```bash
# Navigate to directory
cd enginedge-workers/resume-nlp-service

# Create virtual environment
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Download spaCy model
python -m spacy download en_core_web_sm

# Run service
uvicorn src.main:app --reload --host 0.0.0.0 --port 8001
```

---

## Docker Deployment

### Via Platform Docker Compose

**Recommended for development and testing**

```bash
# From platform directory
cd enginedge-core/platform

# Start all infrastructure
docker-compose up -d mongodb kafka redis

# Start resume services
docker-compose up -d resume-worker resume-nlp-service

# Check status
docker-compose ps

# View logs
docker-compose logs -f resume-worker
docker-compose logs -f resume-nlp-service

# Stop services
docker-compose down
```

### Standalone Docker

#### Resume Worker

```bash
# Build image
cd enginedge-workers/resume-worker
docker build -t resume-worker:latest .

# Run container
docker run -d \
  --name resume-worker \
  -p 3006:3006 \
  -e NODE_ENV=production \
  -e PORT=3006 \
  -e MONGODB_URI=mongodb://host.docker.internal:27017/resume-worker \
  -e KAFKA_BROKERS=host.docker.internal:9094 \
  -e REDIS_URL=redis://host.docker.internal:6379/1 \
  --add-host=host.docker.internal:host-gateway \
  resume-worker:latest

# Check logs
docker logs -f resume-worker

# Stop container
docker stop resume-worker
docker rm resume-worker
```

#### Resume NLP Service

```bash
# Build image
cd enginedge-workers/resume-nlp-service
docker build -t resume-nlp-service:latest .

# Run container
docker run -d \
  --name resume-nlp-service \
  -p 8001:8001 \
  -e PORT=8001 \
  -e KAFKA_BROKERS=host.docker.internal:9094 \
  -e WORKERS=4 \
  --add-host=host.docker.internal:host-gateway \
  resume-nlp-service:latest

# Check logs
docker logs -f resume-nlp-service
```

---

## Kubernetes Deployment

### Namespace

```yaml
# namespace.yaml
apiVersion: v1
kind: Namespace
metadata:
  name: resume-worker
```

### ConfigMap

```yaml
# configmap.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: resume-worker-config
  namespace: resume-worker
data:
  NODE_ENV: "production"
  PORT: "3006"
  LOG_LEVEL: "info"
  KAFKA_BROKERS: "kafka-service:9092"
  MONGODB_URI: "mongodb://mongodb-service:27017/resume-worker"
  REDIS_URL: "redis://redis-service:6379/1"
```

### Secrets

```yaml
# secrets.yaml
apiVersion: v1
kind: Secret
metadata:
  name: resume-worker-secrets
  namespace: resume-worker
type: Opaque
stringData:
  OPENAI_API_KEY: "your_key_here"
  JWT_SECRET: "your_secret_here"
  ENCRYPTION_KEY: "your_encryption_key_here"
```

### Deployment - Resume Worker

```yaml
# deployment-resume-worker.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: resume-worker
  namespace: resume-worker
spec:
  replicas: 3
  selector:
    matchLabels:
      app: resume-worker
  template:
    metadata:
      labels:
        app: resume-worker
    spec:
      containers:
      - name: resume-worker
        image: resume-worker:latest
        ports:
        - containerPort: 3006
        envFrom:
        - configMapRef:
            name: resume-worker-config
        - secretRef:
            name: resume-worker-secrets
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
            port: 3006
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /health
            port: 3006
          initialDelaySeconds: 10
          periodSeconds: 5
```

### Deployment - Resume NLP Service

```yaml
# deployment-resume-nlp.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: resume-nlp-service
  namespace: resume-worker
spec:
  replicas: 4
  selector:
    matchLabels:
      app: resume-nlp-service
  template:
    metadata:
      labels:
        app: resume-nlp-service
    spec:
      containers:
      - name: resume-nlp-service
        image: resume-nlp-service:latest
        ports:
        - containerPort: 8001
        env:
        - name: PORT
          value: "8001"
        - name: KAFKA_BROKERS
          value: "kafka-service:9092"
        - name: WORKERS
          value: "4"
        resources:
          requests:
            memory: "1Gi"
            cpu: "1000m"
          limits:
            memory: "4Gi"
            cpu: "4000m"
        livenessProbe:
          httpGet:
            path: /health
            port: 8001
          initialDelaySeconds: 60
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /health
            port: 8001
          initialDelaySeconds: 30
          periodSeconds: 5
```

### Service

```yaml
# service.yaml
apiVersion: v1
kind: Service
metadata:
  name: resume-worker-service
  namespace: resume-worker
spec:
  selector:
    app: resume-worker
  ports:
  - protocol: TCP
    port: 3006
    targetPort: 3006
  type: ClusterIP
---
apiVersion: v1
kind: Service
metadata:
  name: resume-nlp-service
  namespace: resume-worker
spec:
  selector:
    app: resume-nlp-service
  ports:
  - protocol: TCP
    port: 8001
    targetPort: 8001
  type: ClusterIP
```

### Ingress

```yaml
# ingress.yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: resume-worker-ingress
  namespace: resume-worker
  annotations:
    nginx.ingress.kubernetes.io/rewrite-target: /
spec:
  rules:
  - host: resume.yourdomain.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: resume-worker-service
            port:
              number: 3006
```

### HorizontalPodAutoscaler

```yaml
# hpa.yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: resume-worker-hpa
  namespace: resume-worker
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: resume-worker
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
---
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: resume-nlp-hpa
  namespace: resume-worker
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: resume-nlp-service
  minReplicas: 4
  maxReplicas: 20
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 75
```

### Deploy to Kubernetes

```bash
# Apply all manifests
kubectl apply -f namespace.yaml
kubectl apply -f configmap.yaml
kubectl apply -f secrets.yaml
kubectl apply -f deployment-resume-worker.yaml
kubectl apply -f deployment-resume-nlp.yaml
kubectl apply -f service.yaml
kubectl apply -f ingress.yaml
kubectl apply -f hpa.yaml

# Check status
kubectl get pods -n resume-worker
kubectl get svc -n resume-worker
kubectl get hpa -n resume-worker

# View logs
kubectl logs -f deployment/resume-worker -n resume-worker
kubectl logs -f deployment/resume-nlp-service -n resume-worker

# Scale manually
kubectl scale deployment resume-worker --replicas=5 -n resume-worker
```

---

## Production Checklist

### Pre-Deployment

- [ ] Environment variables configured
- [ ] Secrets properly set
- [ ] MongoDB indexes created
- [ ] Redis configured
- [ ] Kafka topics created
- [ ] spaCy models downloaded
- [ ] SSL certificates configured
- [ ] Monitoring set up
- [ ] Logging configured
- [ ] Backup strategy in place

### MongoDB Indexes

```javascript
// Run in MongoDB shell
use resume-worker

// Experience Bank
db.experienceBankItems.createIndex({userId: 1, "metadata.reviewed": 1})
db.experienceBankItems.createIndex({hash: 1}, {unique: true})
db.experienceBankItems.createIndex({"metadata.technologies": 1})
db.experienceBankItems.createIndex({"metadata.category": 1})
db.experienceBankItems.createIndex({userId: 1, "metadata.reviewed": 1, "metadata.category": 1})

// Resumes
db.resumes.createIndex({userId: 1})
db.resumes.createIndex({userId: 1, createdAt: -1})
db.resumes.createIndex({"metadata.status": 1})

// Job Postings
db.jobPostings.createIndex({userId: 1, createdAt: -1})

// Evaluation Reports
db.evaluationReports.createIndex({resumeId: 1, createdAt: -1})
db.evaluationReports.createIndex({userId: 1, createdAt: -1})
```

### Kafka Topics

```bash
# Create topics with proper configuration
kafka-topics --bootstrap-server localhost:9094 --create \
  --topic resume.bullet.evaluate.request \
  --partitions 6 \
  --replication-factor 3

kafka-topics --bootstrap-server localhost:9094 --create \
  --topic resume.bullet.evaluate.response \
  --partitions 6 \
  --replication-factor 3

kafka-topics --bootstrap-server localhost:9094 --create \
  --topic resume.posting.extract.request \
  --partitions 4 \
  --replication-factor 3

kafka-topics --bootstrap-server localhost:9094 --create \
  --topic resume.posting.extract.response \
  --partitions 4 \
  --replication-factor 3

kafka-topics --bootstrap-server localhost:9094 --create \
  --topic resume.pdf.parse.request \
  --partitions 4 \
  --replication-factor 3

kafka-topics --bootstrap-server localhost:9094 --create \
  --topic resume.pdf.parse.response \
  --partitions 4 \
  --replication-factor 3
```

### Post-Deployment

- [ ] Health checks passing
- [ ] Metrics being collected
- [ ] Logs being aggregated
- [ ] Alerts configured
- [ ] Load testing completed
- [ ] Documentation updated
- [ ] Team trained
- [ ] Rollback plan tested

---

## Monitoring Setup

### Prometheus

```yaml
# prometheus.yml
scrape_configs:
  - job_name: 'resume-worker'
    static_configs:
      - targets: ['resume-worker:3006']
    metrics_path: '/metrics'
    scrape_interval: 15s
```

### Grafana

Import dashboard from `grafana-dashboard.json`

---

## Backup and Recovery

### MongoDB Backup

```bash
# Daily backup
mongodump --uri="mongodb://mongodb:27017/resume-worker" \
  --out=/backup/resume-worker-$(date +%Y%m%d)

# Restore
mongorestore --uri="mongodb://mongodb:27017/resume-worker" \
  /backup/resume-worker-20251103
```

### Redis Backup

```bash
# Enable AOF persistence
redis-cli CONFIG SET appendonly yes

# Manual snapshot
redis-cli BGSAVE
```

---

## Rollback Procedure

```bash
# Kubernetes rollback
kubectl rollout undo deployment/resume-worker -n resume-worker
kubectl rollout undo deployment/resume-nlp-service -n resume-worker

# Docker rollback
docker-compose down
docker-compose up -d --force-recreate
```

---

## Troubleshooting Deployment

See [TROUBLESHOOTING.md](TROUBLESHOOTING.md) for detailed troubleshooting guide.

---

**Last Updated:** November 3, 2025  
**Version:** 1.0.0
