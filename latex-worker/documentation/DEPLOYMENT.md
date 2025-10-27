# LaTeX Worker Deployment Guide

## Prerequisites

- Docker 20.10+
- Docker Compose 2.0+
- Kubernetes 1.24+ (for K8s deployment)
- TeX Live 2023+ (pre-installed in Docker image)
- MongoDB 5.0+
- Kafka 3.0+

## Docker Deployment

### Building the Image

```bash
# Build Docker image
docker build -t enginedge/latex-worker:latest .

# With build arguments
docker build -t enginedge/latex-worker:1.0.0 \
  --build-arg NODE_ENV=production \
  --build-arg TEXLIVE_YEAR=2023 \
  .

# Scan for vulnerabilities
docker scan enginedge/latex-worker:latest
```

### Docker Compose (Development)

```yaml
# docker-compose.dev.yml
version: '3.8'

services:
  mongo:
    image: mongo:5.0
    environment:
      MONGO_INITDB_ROOT_USERNAME: root
      MONGO_INITDB_ROOT_PASSWORD: password
    ports:
      - "27017:27017"
    volumes:
      - mongo_data:/data/db

  kafka:
    image: confluentinc/cp-kafka:7.0.0
    environment:
      KAFKA_BROKER_ID: 1
      KAFKA_ZOOKEEPER_CONNECT: zookeeper:2181
      KAFKA_ADVERTISED_LISTENERS: PLAINTEXT://kafka:29092,PLAINTEXT_HOST://kafka:9092
      KAFKA_LISTENER_SECURITY_PROTOCOL_MAP: PLAINTEXT:PLAINTEXT,PLAINTEXT_HOST:PLAINTEXT
      KAFKA_INTER_BROKER_LISTENER_NAME: PLAINTEXT
    depends_on:
      - zookeeper
    ports:
      - "9092:9092"

  zookeeper:
    image: confluentinc/cp-zookeeper:7.0.0
    environment:
      ZOOKEEPER_CLIENT_PORT: 2181

  latex-worker:
    build:
      context: .
      dockerfile: Dockerfile
    environment:
      NODE_ENV: development
      MONGODB_URI: mongodb://root:password@mongo:27017/latex-worker?authSource=admin
      KAFKA_BROKERS: kafka:9092
      XELATEX_PATH: /usr/bin/xelatex
      LUALATEX_PATH: /usr/bin/lualatex
      TEXMF_HOME: /tmp/texmf
    ports:
      - "3003:3003"
    depends_on:
      - mongo
      - kafka
    volumes:
      - ./src:/app/src
      - /tmp/latex-worker:/tmp/latex-worker
    command: npm run dev

volumes:
  mongo_data:
```

**Start services:**
```bash
docker-compose -f docker-compose.dev.yml up -d
```

### Docker Compose (Production)

```bash
docker-compose -f docker-compose.prod.yml up -d

# View logs
docker-compose logs -f latex-worker

# Scale service
docker-compose up -d --scale latex-worker=3
```

## Kubernetes Deployment

### Namespace

```bash
kubectl create namespace latex-worker
```

### ConfigMap

```yaml
# k8s/configmap.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: latex-worker-config
  namespace: latex-worker
data:
  NODE_ENV: "production"
  LOG_LEVEL: "info"
  XELATEX_PATH: "/usr/bin/xelatex"
  LUALATEX_PATH: "/usr/bin/lualatex"
  TEXMF_HOME: "/tmp/texmf"
  MAX_MEMORY: "2048"
  TIMEOUT: "60000"
```

### Secrets

```bash
# Create secret for MongoDB
kubectl create secret generic latex-worker-db-secret \
  --from-literal=mongodb-uri=mongodb+srv://user:pass@cluster.mongodb.net/latex-worker \
  -n latex-worker

# Create secret for Kafka
kubectl create secret generic latex-worker-kafka-secret \
  --from-literal=brokers=kafka-0.kafka:9092,kafka-1.kafka:9092,kafka-2.kafka:9092 \
  -n latex-worker
```

### Deployment

```yaml
# k8s/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: latex-worker
  namespace: latex-worker
spec:
  replicas: 3
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1
      maxUnavailable: 0
  selector:
    matchLabels:
      app: latex-worker
  template:
    metadata:
      labels:
        app: latex-worker
    spec:
      containers:
      - name: latex-worker
        image: enginedge/latex-worker:1.0.0
        imagePullPolicy: IfNotPresent
        ports:
        - containerPort: 3003
          name: http
        env:
        - name: NODE_ENV
          valueFrom:
            configMapKeyRef:
              name: latex-worker-config
              key: NODE_ENV
        - name: MONGODB_URI
          valueFrom:
            secretKeyRef:
              name: latex-worker-db-secret
              key: mongodb-uri
        - name: KAFKA_BROKERS
          valueFrom:
            secretKeyRef:
              name: latex-worker-kafka-secret
              key: brokers
        resources:
          requests:
            cpu: "500m"
            memory: "512Mi"
          limits:
            cpu: "1000m"
            memory: "2Gi"
        livenessProbe:
          httpGet:
            path: /health
            port: 3003
          initialDelaySeconds: 30
          periodSeconds: 10
          timeoutSeconds: 5
          failureThreshold: 3
        readinessProbe:
          httpGet:
            path: /health
            port: 3003
          initialDelaySeconds: 10
          periodSeconds: 5
          timeoutSeconds: 3
          failureThreshold: 2
        volumeMounts:
        - name: tmp-volume
          mountPath: /tmp/latex-worker
        securityContext:
          runAsNonRoot: true
          runAsUser: 1000
          readOnlyRootFilesystem: true
          allowPrivilegeEscalation: false
      volumes:
      - name: tmp-volume
        emptyDir:
          sizeLimit: 10Gi
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
                  - latex-worker
              topologyKey: kubernetes.io/hostname
```

### Service

```yaml
# k8s/service.yaml
apiVersion: v1
kind: Service
metadata:
  name: latex-worker
  namespace: latex-worker
spec:
  type: ClusterIP
  selector:
    app: latex-worker
  ports:
  - port: 3003
    targetPort: 3003
    protocol: TCP
    name: http
```

### HorizontalPodAutoscaler

```yaml
# k8s/hpa.yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: latex-worker-hpa
  namespace: latex-worker
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: latex-worker
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

### Apply to Kubernetes

```bash
kubectl apply -f k8s/configmap.yaml
kubectl apply -f k8s/secrets.yaml
kubectl apply -f k8s/deployment.yaml
kubectl apply -f k8s/service.yaml
kubectl apply -f k8s/hpa.yaml

# Verify deployment
kubectl get pods -n latex-worker
kubectl logs -n latex-worker -f deployment/latex-worker
```

## Environment Variables

```bash
# Node environment
NODE_ENV=production

# Logging
LOG_LEVEL=info
LOG_FORMAT=json

# Database
MONGODB_URI=mongodb://user:pass@mongo:27017/latex-worker
MONGODB_POOL_SIZE=50

# Messaging
KAFKA_BROKERS=kafka-0:9092,kafka-1:9092,kafka-2:9092
KAFKA_CONSUMER_GROUP=latex-worker
KAFKA_SASL_ENABLED=false

# LaTeX
XELATEX_PATH=/usr/bin/xelatex
LUALATEX_PATH=/usr/bin/lualatex
TEXMF_HOME=/tmp/texmf
TEXMF_CONFIG=/tmp/texmf-config

# Compilation Limits
MAX_MEMORY=2048
TIMEOUT=60000
MAX_PASSES=3
MAX_CONCURRENT_JOBS=10
QUEUE_DEPTH=100

# File Storage
PDF_STORAGE_DIR=/tmp/latex-worker
MAX_UPLOAD_SIZE=10485760

# Performance
WORKER_THREADS=4
CACHE_SIZE=1000
FONT_CACHE_TTL=3600000
```

## Monitoring Setup

### Prometheus Metrics

```yaml
# prometheus/prometheus.yml
scrape_configs:
  - job_name: 'latex-worker'
    static_configs:
      - targets: ['localhost:3003']
    metrics_path: '/metrics'
```

### Grafana Dashboard

Create dashboard with metrics:
- `latex_compilation_duration_ms` (histogram)
- `latex_compilation_total` (counter)
- `latex_compilation_errors_total` (counter)
- `latex_queue_depth` (gauge)
- `latex_worker_memory_bytes` (gauge)
- `latex_worker_cpu_seconds_total` (counter)

### Health Checks

```bash
# Liveness probe
curl http://localhost:3003/health

# Readiness probe
curl http://localhost:3003/health/ready

# Metrics
curl http://localhost:3003/metrics
```

## Troubleshooting

### No TeX Live installation
```
Error: xelatex: command not found
```
Solution: Check Dockerfile or install TeX Live:
```bash
apt-get update && apt-get install -y texlive-full
```

### MongoDB connection failed
```
MongooseError: connect ECONNREFUSED
```
Solution: Verify MongoDB is running and accessible

### Kafka broker unavailable
```
KafkaJSConnectionError: Failed to connect to broker
```
Solution: Check Kafka brokers are running and accessible

### Out of memory
```
FATAL ERROR: CALL_AND_RETRY_LAST Allocation failed
```
Solution: Increase memory limits or reduce max concurrent jobs

### Slow compilations
```
Compilation exceeded timeout threshold
```
Solution: Check system resources or optimize LaTeX document

## Backup & Recovery

### MongoDB Backup

```bash
# Full backup
mongodump --uri="mongodb://user:pass@mongo:27017/latex-worker" \
  --out=/backups/mongodb

# Restore
mongorestore --uri="mongodb://user:pass@mongo:27017" /backups/mongodb
```

### GridFS Backup (PDFs)

```bash
# Export GridFS files
mongoexport --collection fs.files --out=/backups/fs.files.json
mongoexport --collection fs.chunks --out=/backups/fs.chunks.json
```

## Scaling Considerations

### Horizontal Scaling
- Use Kubernetes HPA for automatic scaling
- Monitor queue depth
- Set minimum replicas = 2 for HA
- Set maximum replicas = 10 based on resource limits

### Vertical Scaling
- Increase CPU limits to 2 cores for better performance
- Increase memory to 4GB for large documents
- Monitor per-job resource usage

### Caching Strategy
- Enable Redis for distributed caching (future)
- Persist package cache in shared volume
- Use CDN for static templates
