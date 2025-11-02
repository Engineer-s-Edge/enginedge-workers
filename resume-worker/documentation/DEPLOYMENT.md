# resume Worker Deployment Guide

## Overview

This document provides comprehensive deployment instructions for the resume Worker across different environments including local development, Docker containers, and Kubernetes production deployments.

## Prerequisites

### System Requirements
- Node.js 18+ (for local development)
- Docker 24.0+ (for containerized deployment)
- Kubernetes 1.24+ (for production deployment)
- Kafka 3.0+ cluster
- MongoDB 5.0+ database

### External Dependencies
- Kafka brokers (accessible from deployment environment)
- MongoDB instance (with authentication configured)
- Redis instance (optional, for caching)

## Environment Configuration

### Environment Variables

Create a `.env` file in the project root:

```bash
# Service Configuration
PORT=3001
NODE_ENV=production

# Kafka Configuration
KAFKA_BROKERS=kafka-1:9092,kafka-2:9092,kafka-3:9092
KAFKA_CLIENT_ID=resume-worker
KAFKA_GROUP_ID=resume-worker-group

# Database Configuration
MONGODB_URI=mongodb://username:password@mongodb-host:27017/resume_worker
MONGODB_DATABASE=resume_worker

# Redis Configuration (Optional)
REDIS_URL=redis://redis-host:6379
REDIS_PASSWORD=your-redis-password

# Monitoring Configuration
PROMETHEUS_METRICS_PORT=9090
GRAFANA_DASHBOARD_URL=http://grafana:3000

# Logging Configuration
LOG_LEVEL=info
LOG_FORMAT=json

# Security Configuration
API_KEY=your-api-key-here
CORS_ORIGINS=http://localhost:3000,https://yourdomain.com
```

## Local Development

### Quick Start

```bash
# Clone the repository
git clone <repository-url>
cd enginedge-workers/resume-worker

# Install dependencies
npm install

# Copy environment configuration
cp .env.example .env

# Start in development mode
npm run start:dev
```

### Development with Docker

```bash
# Build development image
docker build -t resume-worker:dev -f Dockerfile.dev .

# Run with docker-compose
docker-compose -f docker-compose.dev.yml up

# Or run directly
docker run -p 3001:3001 \
  --env-file .env \
  --network enginedge-network \
  resume-worker:dev
```

## Docker Deployment

### Production Docker Image

```dockerfile
FROM node:18-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
RUN npm ci --only=production

# Copy source code
COPY . .

# Build application
RUN npm run build

FROM node:18-alpine AS production

WORKDIR /app

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nestjs -u 1001

# Copy built application
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package*.json ./

# Change ownership
RUN chown -R nestjs:nodejs /app
USER nestjs

EXPOSE 3001

CMD ["npm", "run", "start:prod"]
```

### Build and Push Image

```bash
# Build production image
docker build -t resume-worker:latest .

# Tag for registry
docker tag resume-worker:latest your-registry.com/resume-worker:v1.0.0

# Push to registry
docker push your-registry.com/resume-worker:v1.0.0
```

## Kubernetes Deployment

### Namespace Setup

```yaml
apiVersion: v1
kind: Namespace
metadata:
  name: enginedge-workers
  labels:
    name: enginedge-workers
```

### ConfigMap for Configuration

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: resume-worker-config
  namespace: enginedge-workers
data:
  KAFKA_CLIENT_ID: "resume-worker"
  KAFKA_GROUP_ID: "resume-worker-group"
  LOG_LEVEL: "info"
  LOG_FORMAT: "json"
  NODE_ENV: "production"
```

### Secret for Sensitive Data

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: resume-worker-secrets
  namespace: enginedge-workers
type: Opaque
data:
  # Base64 encoded values
  MONGODB_URI: bW9uZ29kYjovL3VzZXJuYW1lOnBhc3N3b3JkQG1vbmdvLWhvc3Q6MjcwMTcvcm5sZV93b3Jrcw==
  REDIS_PASSWORD: eW91ci1yZWRpcy1wYXNzd29yZA==
  API_KEY: eW91ci1hcGkta2V5LWhlcmU=
```

### Deployment Manifest

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: resume-worker
  namespace: enginedge-workers
  labels:
    app: resume-worker
    version: v1.0.0
spec:
  replicas: 3
  selector:
    matchLabels:
      app: resume-worker
  template:
    metadata:
      labels:
        app: resume-worker
        version: v1.0.0
    spec:
      containers:
      - name: resume-worker
        image: your-registry.com/resume-worker:v1.0.0
        ports:
        - containerPort: 3001
          name: http
        - containerPort: 9090
          name: metrics
        env:
        - name: PORT
          value: "3001"
        - name: PROMETHEUS_METRICS_PORT
          value: "9090"
        envFrom:
        - configMapRef:
            name: resume-worker-config
        - secretRef:
            name: resume-worker-secrets
        resources:
          requests:
            memory: "256Mi"
            cpu: "100m"
          limits:
            memory: "512Mi"
            cpu: "500m"
        livenessProbe:
          httpGet:
            path: /health
            port: 3001
          initialDelaySeconds: 30
          periodSeconds: 10
          timeoutSeconds: 5
          failureThreshold: 3
        readinessProbe:
          httpGet:
            path: /health
            port: 3001
          initialDelaySeconds: 5
          periodSeconds: 5
          timeoutSeconds: 3
          failureThreshold: 3
        startupProbe:
          httpGet:
            path: /health
            port: 3001
          initialDelaySeconds: 10
          periodSeconds: 10
          timeoutSeconds: 5
          failureThreshold: 30
```

### Service Manifest

```yaml
apiVersion: v1
kind: Service
metadata:
  name: resume-worker-service
  namespace: enginedge-workers
  labels:
    app: resume-worker
spec:
  selector:
    app: resume-worker
  ports:
  - name: http
    port: 3001
    targetPort: 3001
    protocol: TCP
  - name: metrics
    port: 9090
    targetPort: 9090
    protocol: TCP
  type: ClusterIP
```

### Horizontal Pod Autoscaler

```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: resume-worker-hpa
  namespace: enginedge-workers
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: resume-worker
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

### Network Policies

```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: resume-worker-network-policy
  namespace: enginedge-workers
spec:
  podSelector:
    matchLabels:
      app: resume-worker
  policyTypes:
  - Ingress
  - Egress
  ingress:
  - from:
    - namespaceSelector:
        matchLabels:
          name: enginedge-services
    ports:
    - protocol: TCP
      port: 3001
  - from:
    - namespaceSelector:
        matchLabels:
          name: monitoring
    ports:
    - protocol: TCP
      port: 9090
  egress:
  - to:
    - podSelector:
        matchLabels:
          app: kafka
    ports:
    - protocol: TCP
      port: 9092
  - to:
    - podSelector:
        matchLabels:
          app: mongodb
    ports:
    - protocol: TCP
      port: 27017
  - to:
    - podSelector:
        matchLabels:
          app: redis
    ports:
    - protocol: TCP
      port: 6379
```

## Helm Deployment

### Chart Structure

```
charts/resume-worker/
├── Chart.yaml
├── values.yaml
├── templates/
│   ├── deployment.yaml
│   ├── service.yaml
│   ├── configmap.yaml
│   ├── secret.yaml
│   ├── hpa.yaml
│   └── networkpolicy.yaml
└── charts/
```

### Values Configuration

```yaml
# values.yaml
replicaCount: 3

image:
  repository: your-registry.com/resume-worker
  tag: v1.0.0
  pullPolicy: IfNotPresent

service:
  type: ClusterIP
  port: 3001
  metricsPort: 9090

config:
  kafka:
    brokers: "kafka-1:9092,kafka-2:9092,kafka-3:9092"
    clientId: "resume-worker"
    groupId: "resume-worker-group"
  mongodb:
    uri: "mongodb://username:password@mongodb-host:27017/resume_worker"
  redis:
    url: "redis://redis-host:6379"

resources:
  requests:
    memory: "256Mi"
    cpu: "100m"
  limits:
    memory: "512Mi"
    cpu: "500m"

autoscaling:
  enabled: true
  minReplicas: 2
  maxReplicas: 10
  targetCPUUtilizationPercentage: 70
  targetMemoryUtilizationPercentage: 80
```

### Install Chart

```bash
# Install with custom values
helm install resume-worker ./charts/resume-worker \
  --namespace enginedge-workers \
  --create-namespace \
  --values values-production.yaml

# Upgrade deployment
helm upgrade resume-worker ./charts/resume-worker \
  --namespace enginedge-workers \
  --values values-production.yaml
```

## Monitoring Setup

### Prometheus ServiceMonitor

```yaml
apiVersion: monitoring.coreos.com/v1
kind: ServiceMonitor
metadata:
  name: resume-worker-monitor
  namespace: monitoring
  labels:
    app: resume-worker
spec:
  selector:
    matchLabels:
      app: resume-worker
  endpoints:
  - port: metrics
    path: /metrics
    interval: 30s
    scrapeTimeout: 10s
```

### Grafana Dashboard

Import the dashboard from `documentation/grafana-dashboard.json` into Grafana.

### AlertManager Rules

Apply the alert rules from `documentation/prometheus-alerts.yml` to AlertManager.

## Health Checks

### Readiness and Liveness Probes

The deployment includes comprehensive health checks:

- **Liveness Probe**: Ensures the application is running and responsive
- **Readiness Probe**: Ensures the application is ready to accept traffic
- **Startup Probe**: Allows slow-starting containers to initialize properly

### Health Check Endpoints

- `GET /health` - Overall service health
- `GET /health/kafka` - Kafka connectivity
- `GET /health/database` - Database connectivity

## Scaling Considerations

### Horizontal Scaling

- Stateless design allows easy horizontal scaling
- Use HPA based on CPU/memory utilization
- Consider custom metrics for queue depth

### Vertical Scaling

- Monitor resource usage patterns
- Adjust resource requests/limits based on load
- Consider node affinity for performance-critical workloads

## Backup and Recovery

### Data Backup

- MongoDB data should be backed up regularly
- Use Kubernetes persistent volumes with backup solutions
- Implement cross-region replication for high availability

### Disaster Recovery

- Multi-zone deployment for high availability
- Automated failover procedures
- Regular disaster recovery testing

## Troubleshooting

### Common Issues

1. **Pod CrashLoopBackOff**
   - Check environment variables
   - Verify external service connectivity
   - Review application logs

2. **High Memory Usage**
   - Monitor for memory leaks
   - Adjust resource limits
   - Implement connection pooling

3. **Kafka Connection Issues**
   - Verify broker addresses
   - Check network policies
   - Review Kafka cluster health

### Debugging Commands

```bash
# Check pod status
kubectl get pods -n enginedge-workers

# View pod logs
kubectl logs -f deployment/resume-worker -n enginedge-workers

# Execute into pod
kubectl exec -it deployment/resume-worker -n enginedge-workers -- /bin/sh

# Check service endpoints
kubectl get endpoints -n enginedge-workers
```

## Security Considerations

### Network Security

- Use network policies to restrict traffic
- Implement TLS for external communications
- Regular security updates for base images

### Access Control

- Implement RBAC for Kubernetes resources
- Use secrets for sensitive configuration
- Regular rotation of API keys and passwords

### Compliance

- Audit logging for security events
- Regular security scans of container images
- Compliance with organizational security policies

## Performance Optimization

### Application Tuning

- Connection pooling for external services
- Implement caching for frequently accessed data
- Optimize database queries and indexes

### Infrastructure Optimization

- Use appropriate resource requests and limits
- Implement pod anti-affinity for high availability
- Consider using node pools for different workload types

## Rollback Procedures

### Deployment Rollback

```bash
# Rollback to previous Helm release
helm rollback resume-worker 1 -n enginedge-workers

# Or rollback Kubernetes deployment
kubectl rollout undo deployment/resume-worker -n enginedge-workers
```

### Database Rollback

- Use database backup and restore procedures
- Implement schema migration rollback scripts
- Test rollback procedures regularly

## Maintenance Procedures

### Regular Maintenance

- Update dependencies regularly
- Monitor for security vulnerabilities
- Review and optimize resource usage
- Update Kubernetes manifests for new features

### Emergency Procedures

- Document incident response procedures
- Define escalation paths
- Regular incident response drills