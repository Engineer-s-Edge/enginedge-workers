# Interview Worker - Deployment

## Overview

The Interview Worker is deployed as a containerized microservice in the EnginEdge Kubernetes cluster. This document covers deployment strategies, configuration, and operational procedures.

## Prerequisites

### Infrastructure Requirements
- **Kubernetes**: 1.24+ cluster
- **Helm**: 3.8+ for package management
- **kubectl**: Configured for cluster access
- **Docker Registry**: Access to EnginEdge container registry

### External Dependencies
- **MongoDB**: 6.0+ with replica set
- **Redis**: 7.0+ with persistence
- **Kafka**: 3.0+ with topic replication
- **MinIO**: S3-compatible object storage

## Container Configuration

### Dockerfile
```dockerfile
FROM node:18-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

FROM node:18-alpine AS runtime

RUN apk add --no-cache dumb-init
USER node

WORKDIR /app
COPY --from=builder /app/node_modules ./node_modules
COPY --chown=node:node . .

EXPOSE 3001
ENTRYPOINT ["dumb-init", "--"]
CMD ["npm", "run", "start:prod"]
```

### Docker Build
```bash
# Build locally
docker build -t enginedge/interview-worker:latest .

# Push to registry
docker push enginedge/interview-worker:latest
```

## Kubernetes Deployment

### Namespace
```yaml
apiVersion: v1
kind: Namespace
metadata:
  name: interview-worker
  labels:
    name: interview-worker
    app: interview-worker
```

### ConfigMap
```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: interview-worker-config
  namespace: interview-worker
data:
  NODE_ENV: "production"
  LOG_LEVEL: "info"
  PORT: "3001"
  MONGODB_URI: "mongodb://interview-mongodb:27017/interview_worker"
  REDIS_URL: "redis://interview-redis:6379"
  KAFKA_BROKERS: "kafka-cluster:9092"
  MINIO_ENDPOINT: "minio-service:9000"
  AI_PROVIDER: "openai"
  SPEECH_PROVIDER: "google"
  CALENDAR_PROVIDER: "google"
```

### Secrets
```yaml
apiVersion: v1
kind: Secret
metadata:
  name: interview-worker-secrets
  namespace: interview-worker
type: Opaque
data:
  MONGODB_PASSWORD: <base64-encoded>
  REDIS_PASSWORD: <base64-encoded>
  KAFKA_PASSWORD: <base64-encoded>
  MINIO_ACCESS_KEY: <base64-encoded>
  MINIO_SECRET_KEY: <base64-encoded>
  OPENAI_API_KEY: <base64-encoded>
  GOOGLE_SPEECH_KEY: <base64-encoded>
  GOOGLE_CALENDAR_KEY: <base64-encoded>
  JWT_SECRET: <base64-encoded>
```

### Deployment
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: interview-worker
  namespace: interview-worker
spec:
  replicas: 3
  selector:
    matchLabels:
      app: interview-worker
  template:
    metadata:
      labels:
        app: interview-worker
    spec:
      containers:
      - name: interview-worker
        image: enginedge/interview-worker:latest
        ports:
        - containerPort: 3001
          name: http
        envFrom:
        - configMapRef:
            name: interview-worker-config
        - secretRef:
            name: interview-worker-secrets
        resources:
          requests:
            memory: "512Mi"
            cpu: "250m"
          limits:
            memory: "1Gi"
            cpu: "500m"
        livenessProbe:
          httpGet:
            path: /health
            port: 3001
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /health
            port: 3001
          initialDelaySeconds: 5
          periodSeconds: 5
        volumeMounts:
        - name: tmp-volume
          mountPath: /tmp
      volumes:
      - name: tmp-volume
        emptyDir: {}
```

### Service
```yaml
apiVersion: v1
kind: Service
metadata:
  name: interview-worker-service
  namespace: interview-worker
spec:
  selector:
    app: interview-worker
  ports:
  - port: 3001
    targetPort: 3001
    protocol: TCP
  type: ClusterIP
```

### Ingress
```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: interview-worker-ingress
  namespace: interview-worker
  annotations:
    nginx.ingress.kubernetes.io/ssl-redirect: "true"
    cert-manager.io/cluster-issuer: "letsencrypt-prod"
spec:
  ingressClassName: nginx
  tls:
  - hosts:
    - interview.enginedge.com
    secretName: interview-worker-tls
  rules:
  - host: interview.enginedge.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: interview-worker-service
            port:
              number: 3001
```

## Helm Chart

### Chart Structure
```
interview-worker/
├── Chart.yaml
├── values.yaml
├── templates/
│   ├── deployment.yaml
│   ├── service.yaml
│   ├── configmap.yaml
│   ├── secret.yaml
│   ├── ingress.yaml
│   ├── hpa.yaml
│   └── pdb.yaml
```

### Values Configuration
```yaml
# values.yaml
replicaCount: 3

image:
  repository: enginedge/interview-worker
  tag: latest
  pullPolicy: IfNotPresent

service:
  type: ClusterIP
  port: 3001

ingress:
  enabled: true
  className: nginx
  hosts:
    - host: interview.enginedge.com
      paths:
        - path: /
          pathType: Prefix

resources:
  requests:
    memory: 512Mi
    cpu: 250m
  limits:
    memory: 1Gi
    cpu: 500m

config:
  nodeEnv: production
  logLevel: info
  mongodbUri: mongodb://interview-mongodb:27017/interview_worker
  redisUrl: redis://interview-redis:6379
  kafkaBrokers: kafka-cluster:9092

secrets:
  mongodbPassword: ""
  redisPassword: ""
  openaiApiKey: ""
  jwtSecret: ""
```

## Scaling Configuration

### Horizontal Pod Autoscaler
```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: interview-worker-hpa
  namespace: interview-worker
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: interview-worker
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

### Pod Disruption Budget
```yaml
apiVersion: policy/v1
kind: PodDisruptionBudget
metadata:
  name: interview-worker-pdb
  namespace: interview-worker
spec:
  minAvailable: 2
  selector:
    matchLabels:
      app: interview-worker
```

## Database Setup

### MongoDB Configuration
```javascript
// Initialize database
use interview_worker

// Create collections with indexes
db.interviews.createIndex({ "interviewId": 1 }, { unique: true })
db.interviews.createIndex({ "candidateId": 1 })
db.interviews.createIndex({ "status": 1 })
db.interviews.createIndex({ "scheduledAt": 1 })

db.candidates.createIndex({ "candidateId": 1 }, { unique: true })
db.candidates.createIndex({ "email": 1 }, { unique: true })

// Create user
db.createUser({
  user: "interview_worker",
  pwd: "secure_password",
  roles: [
    { role: "readWrite", db: "interview_worker" }
  ]
})
```

### Redis Configuration
```redis
# redis.conf
bind 0.0.0.0
protected-mode no
tcp-keepalive 300
timeout 0
tcp-backlog 511
databases 16
always-show-logo yes
save 900 1
save 300 10
save 60 10000
stop-writes-on-bgsave-error yes
rdbcompression yes
rdbchecksum yes
dbfilename dump.rdb
dir /data
appendonly yes
appendfilename "appendonly.aof"
appendfsync everysec
no-appendfsync-on-rewrite no
auto-aof-rewrite-percentage 100
auto-aof-rewrite-min-size 64mb
lua-time-limit 5000
```

## Monitoring Setup

### Prometheus ServiceMonitor
```yaml
apiVersion: monitoring.coreos.com/v1
kind: ServiceMonitor
metadata:
  name: interview-worker-monitor
  namespace: interview-worker
spec:
  selector:
    matchLabels:
      app: interview-worker
  endpoints:
  - port: http
    path: /metrics
    interval: 30s
```

### Grafana Dashboard
Import the dashboard from `grafana-dashboard.json` in the monitoring namespace.

## Backup Strategy

### Database Backup
```yaml
# MongoDB backup cron job
apiVersion: batch/v1beta1
kind: CronJob
metadata:
  name: mongodb-backup
  namespace: interview-worker
spec:
  schedule: "0 2 * * *"  # Daily at 2 AM
  jobTemplate:
    spec:
      template:
        spec:
          containers:
          - name: backup
            image: mongo:6.0
            command:
            - mongodump
            - --host=interview-mongodb
            - --db=interview_worker
            - --out=/backup
            volumeMounts:
            - name: backup-volume
              mountPath: /backup
          volumes:
          - name: backup-volume
            persistentVolumeClaim:
              claimName: backup-pvc
          restartPolicy: OnFailure
```

### Configuration Backup
All Kubernetes manifests are version controlled and backed up via Git.

## Troubleshooting

### Common Issues

#### Pod CrashLoopBackOff
```bash
# Check pod logs
kubectl logs -n interview-worker deployment/interview-worker

# Check events
kubectl get events -n interview-worker

# Check resource usage
kubectl top pods -n interview-worker
```

#### Database Connection Issues
```bash
# Test MongoDB connection
kubectl exec -it deployment/interview-worker -n interview-worker -- mongo mongodb://interview-mongodb:27017/interview_worker

# Check MongoDB logs
kubectl logs -n interview-worker deployment/interview-mongodb
```

#### High Memory Usage
```bash
# Check memory usage
kubectl top pods -n interview-worker

# Adjust resource limits in deployment
kubectl edit deployment interview-worker -n interview-worker
```

### Health Checks

#### Application Health
```bash
curl http://interview.enginedge.com/health
```

#### Dependency Health
```bash
# MongoDB
kubectl exec -it deployment/interview-worker -n interview-worker -- mongo --eval "db.stats()"

# Redis
kubectl exec -it deployment/interview-worker -n interview-worker -- redis-cli ping

# Kafka
kubectl exec -it deployment/interview-worker -n interview-worker -- kafka-console-producer --broker-list kafka-cluster:9092 --topic test
```

## Rollback Procedure

### Rolling Back Deployment
```bash
# Check deployment history
kubectl rollout history deployment/interview-worker -n interview-worker

# Rollback to previous version
kubectl rollout undo deployment/interview-worker -n interview-worker

# Rollback to specific revision
kubectl rollout undo deployment/interview-worker --to-revision=2 -n interview-worker
```

### Database Rollback
For database rollbacks, restore from backup:
```bash
# Restore MongoDB from backup
kubectl exec -it deployment/interview-worker -n interview-worker -- mongorestore --host=interview-mongodb /backup/interview_worker
```

## Security Considerations

### Network Policies
```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: interview-worker-netpol
  namespace: interview-worker
spec:
  podSelector:
    matchLabels:
      app: interview-worker
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
    - podSelector:
        matchLabels:
          app: interview-mongodb
    ports:
    - protocol: TCP
      port: 27017
  - to:
    - podSelector:
        matchLabels:
          app: interview-redis
    ports:
    - protocol: TCP
      port: 6379
  - to:
    - podSelector:
        matchLabels:
          app: kafka
    ports:
    - protocol: TCP
      port: 9092
```

### Security Context
```yaml
securityContext:
  runAsNonRoot: true
  runAsUser: 101  # node user
  runAsGroup: 101
  fsGroup: 101
  readOnlyRootFilesystem: true
  allowPrivilegeEscalation: false
  capabilities:
    drop:
    - ALL
```

### Secret Management
- Use Kubernetes secrets for sensitive data
- Rotate secrets regularly
- Use external secret management (Vault, AWS Secrets Manager) for production