# Scheduling Worker - Deployment Guide

## Prerequisites

- Node.js 18+
- PostgreSQL 13+
- Redis 6+
- Google Cloud Project (for Calendar API)
- Kafka 3.0+ (optional)

## Local Development

### Environment Setup

1. **Clone the repository**
```bash
git clone https://github.com/your-org/enginedge-workers.git
cd enginedge-workers/scheduling-worker
```

2. **Install dependencies**
```bash
npm install
```

3. **Set up databases**
```bash
# PostgreSQL
createdb scheduling_worker
# Redis (if using local)
redis-server
```

4. **Configure environment**
```bash
cp .env.example .env
# Edit .env with your configuration
```

5. **Run database migrations**
```bash
npm run migration:run
```

6. **Start the service**
```bash
npm run start:dev
```

## Docker Deployment

### Single Container

```bash
# Build image
docker build -t scheduling-worker:latest .

# Run container
docker run -p 3003:3003 \
  -e DATABASE_URL=postgresql://user:pass@host:5432/db \
  -e REDIS_URL=redis://host:6379 \
  -e GOOGLE_CLIENT_ID=your_id \
  -e GOOGLE_CLIENT_SECRET=your_secret \
  scheduling-worker:latest
```

### Docker Compose

```yaml
version: '3.8'
services:
  scheduling-worker:
    build: .
    ports:
      - "3003:3003"
    environment:
      - NODE_ENV=production
      - DATABASE_URL=postgresql://user:pass@postgres:5432/scheduling
      - REDIS_URL=redis://redis:6379
      - GOOGLE_CLIENT_ID=${GOOGLE_CLIENT_ID}
      - GOOGLE_CLIENT_SECRET=${GOOGLE_CLIENT_SECRET}
    depends_on:
      - postgres
      - redis
    restart: unless-stopped

  postgres:
    image: postgres:15
    environment:
      - POSTGRES_DB=scheduling
      - POSTGRES_USER=user
      - POSTGRES_PASSWORD=pass
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    volumes:
      - redis_data:/data

volumes:
  postgres_data:
  redis_data:
```

## Kubernetes Deployment

### Manifest Structure

```
k8s/
├── configmap.yaml          # Environment configuration
├── secret.yaml            # Sensitive data (encrypted)
├── deployment.yaml        # Application deployment
├── service.yaml           # Service exposure
├── ingress.yaml           # External access
├── postgres/
│   ├── statefulset.yaml   # PostgreSQL database
│   └── pvc.yaml          # Persistent volume
└── redis/
    ├── deployment.yaml    # Redis cache
    └── service.yaml
```

### Key Components

#### ConfigMap
```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: scheduling-worker-config
data:
  NODE_ENV: "production"
  PORT: "3003"
  LOG_LEVEL: "info"
  SYNC_INTERVAL: "300000"
```

#### Secret
```yaml
apiVersion: v1
kind: Secret
metadata:
  name: scheduling-worker-secret
type: Opaque
data:
  database-url: <base64-encoded>
  redis-url: <base64-encoded>
  google-client-id: <base64-encoded>
  google-client-secret: <base64-encoded>
  jwt-secret: <base64-encoded>
```

#### Deployment
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: scheduling-worker
spec:
  replicas: 3
  selector:
    matchLabels:
      app: scheduling-worker
  template:
    metadata:
      labels:
        app: scheduling-worker
    spec:
      containers:
      - name: scheduling-worker
        image: your-registry/scheduling-worker:latest
        ports:
        - containerPort: 3003
        envFrom:
        - configMapRef:
            name: scheduling-worker-config
        - secretRef:
            name: scheduling-worker-secret
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
            port: 3003
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /health/ready
            port: 3003
          initialDelaySeconds: 5
          periodSeconds: 5
```

### Database Setup

#### PostgreSQL StatefulSet
```yaml
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: postgres
spec:
  serviceName: postgres
  replicas: 1
  selector:
    matchLabels:
      app: postgres
  template:
    metadata:
      labels:
        app: postgres
    spec:
      containers:
      - name: postgres
        image: postgres:15
        env:
        - name: POSTGRES_DB
          value: "scheduling"
        - name: POSTGRES_USER
          value: "scheduling"
        - name: POSTGRES_PASSWORD
          valueFrom:
            secretKeyRef:
              name: postgres-secret
              key: password
        ports:
        - containerPort: 5432
        volumeMounts:
        - name: postgres-storage
          mountPath: /var/lib/postgresql/data
  volumeClaimTemplates:
  - metadata:
      name: postgres-storage
    spec:
      accessModes: ["ReadWriteOnce"]
      resources:
        requests:
          storage: 10Gi
```

## Production Considerations

### Environment Variables

| Variable | Description | Required | Default |
|----------|-------------|----------|---------|
| `NODE_ENV` | Environment mode | Yes | `development` |
| `PORT` | Service port | No | `3003` |
| `DATABASE_URL` | PostgreSQL connection | Yes | - |
| `REDIS_URL` | Redis connection | Yes | - |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID | Yes | - |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret | Yes | - |
| `JWT_SECRET` | JWT signing secret | Yes | - |
| `SYNC_INTERVAL` | Calendar sync interval (ms) | No | `300000` |
| `MAX_RETRIES` | Max retry attempts | No | `3` |
| `LOG_LEVEL` | Logging level | No | `info` |

### Health Checks

The service provides multiple health check endpoints:

- `GET /health` - Basic health check
- `GET /health/ready` - Readiness probe
- `GET /health/live` - Liveness probe
- `GET /metrics` - Prometheus metrics

### Monitoring Setup

```yaml
# ServiceMonitor for Prometheus
apiVersion: monitoring.coreos.com/v1
kind: ServiceMonitor
metadata:
  name: scheduling-worker-monitor
spec:
  selector:
    matchLabels:
      app: scheduling-worker
  endpoints:
  - port: http
    path: /metrics
    interval: 30s
```

### Scaling

#### Horizontal Pod Autoscaling
```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: scheduling-worker-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: scheduling-worker
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

### Backup Strategy

#### Database Backup
```yaml
apiVersion: batch/v1
kind: CronJob
metadata:
  name: postgres-backup
spec:
  schedule: "0 2 * * *"  # Daily at 2 AM
  jobTemplate:
    spec:
      template:
        spec:
          containers:
          - name: backup
            image: postgres:15
            command:
            - pg_dump
            - -h
            - postgres
            - -U
            - scheduling
            - scheduling
            volumeMounts:
            - name: backup-storage
              mountPath: /backup
          volumes:
          - name: backup-storage
            persistentVolumeClaim:
              claimName: backup-pvc
          restartPolicy: OnFailure
```

### Security

#### Network Policies
```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: scheduling-worker-netpol
spec:
  podSelector:
    matchLabels:
      app: scheduling-worker
  policyTypes:
  - Ingress
  - Egress
  ingress:
  - from:
    - podSelector:
        matchLabels:
          app: ingress-nginx
    ports:
    - protocol: TCP
      port: 3003
  egress:
  - to:
    - podSelector:
        matchLabels:
          app: postgres
    ports:
    - protocol: TCP
      port: 5432
  - to:
    - podSelector:
        matchLabels:
          app: redis
    ports:
    - protocol: TCP
      port: 6379
  - to: []  # Allow external access for Google APIs
    ports:
    - protocol: TCP
      port: 443
```

#### TLS Configuration
```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: scheduling-worker-ingress
  annotations:
    cert-manager.io/cluster-issuer: "letsencrypt-prod"
spec:
  tls:
  - hosts:
    - scheduling.yourdomain.com
    secretName: scheduling-tls
  rules:
  - host: scheduling.yourdomain.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: scheduling-worker
            port:
              number: 3003
```

## Troubleshooting

### Common Issues

#### Database Connection Failed
```bash
# Check database connectivity
kubectl exec -it postgres-pod -- psql -U scheduling -d scheduling

# Verify connection string
kubectl logs deployment/scheduling-worker
```

#### Google Calendar Sync Issues
```bash
# Check OAuth configuration
kubectl logs deployment/scheduling-worker | grep google

# Verify API credentials
kubectl get secret scheduling-worker-secret -o yaml
```

#### High Memory Usage
```bash
# Check memory usage
kubectl top pods

# Adjust resource limits
kubectl edit deployment scheduling-worker
```

### Logs and Debugging

```bash
# View application logs
kubectl logs -f deployment/scheduling-worker

# View previous container logs
kubectl logs -f deployment/scheduling-worker --previous

# Debug with temporary pod
kubectl run debug-pod --image=busybox --rm -it -- sh
```

### Performance Tuning

- **Database**: Use connection pooling, optimize queries
- **Cache**: Implement Redis caching for frequent data
- **Async Processing**: Use background jobs for heavy operations
- **Monitoring**: Set up alerts for performance degradation