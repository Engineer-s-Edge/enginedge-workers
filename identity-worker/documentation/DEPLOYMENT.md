# Identity Worker - Deployment Guide

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
docker build -t identity-worker:latest .

# Tag for registry
docker tag identity-worker:latest your-registry/identity-worker:1.0.0

# Push to registry
docker push your-registry/identity-worker:1.0.0
```

### Run Container

```bash
# Run with environment variables
docker run -d \
  --name identity-worker \
  -p 3008:3008 \
  -e PORT=3008 \
  -e NODE_ENV=production \
  -e MONGODB_URI=mongodb://mongo:27017/identity-service \
  -e REDIS_URL=redis://redis:6379/8 \
  -e OAUTH_ENCRYPTION_KEY=your-encryption-key \
  -e GOOGLE_CLIENT_ID=your-google-client-id \
  -e GOOGLE_CLIENT_SECRET=your-google-client-secret \
  identity-worker:latest

# Check logs
docker logs -f identity-worker

# Check health
curl http://localhost:3008/health
```

### Docker Compose

Create `docker-compose.yml`:

```yaml
version: '3.8'

services:
  identity-worker:
    image: identity-worker:latest
    build:
      context: .
      dockerfile: Dockerfile
    ports:
      - "3008:3008"
    environment:
      PORT: 3008
      NODE_ENV: production
      MONGODB_URI: mongodb://mongo:27017/identity-service
      REDIS_URL: redis://redis:6379/8
      OAUTH_ENCRYPTION_KEY: ${OAUTH_ENCRYPTION_KEY}
      GOOGLE_CLIENT_ID: ${GOOGLE_CLIENT_ID}
      GOOGLE_CLIENT_SECRET: ${GOOGLE_CLIENT_SECRET}
    depends_on:
      - mongo
      - redis
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3008/health"]
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

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis-data:/data
    restart: unless-stopped

volumes:
  mongo-data:
  redis-data:
```

Start stack:

```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f identity-worker

# Stop all services
docker-compose down
```

---

## Environment Configuration

### Required Variables

```env
# Server
PORT=3008
NODE_ENV=production

# MongoDB
MONGODB_URI=mongodb://localhost:27017/identity-service
MONGODB_DB=identity-service

# Redis
REDIS_URL=redis://localhost:6379/8
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_KEY_PREFIX=identity:

# JWT
ACCESS_TOKEN_TTL=15m
REFRESH_TOKEN_TTL=30d
OAUTH_ENCRYPTION_KEY=your-encryption-key-change-in-prod

# OAuth (Google)
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_REDIRECT_URI=http://localhost:3008/internal/oauth/google/callback
FRONTEND_URL=http://localhost:3000

# Kafka (optional)
KAFKA_BROKERS=localhost:9092
KAFKA_CLIENT_ID=identity-worker
KAFKA_LOG_LEVEL=INFO
```

---

## Health Checks

### Basic Health Check

```bash
curl http://localhost:3008/health
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

Checks MongoDB and Redis connectivity:
```bash
curl http://localhost:3008/health/ready
```

---

## Security

### Production Checklist

- [ ] Change `OAUTH_ENCRYPTION_KEY` to strong random value
- [ ] Use HTTPS in production
- [ ] Set secure CORS origins
- [ ] Enable rate limiting
- [ ] Use strong JWT signing keys
- [ ] Rotate keys regularly
- [ ] Enable audit logging
- [ ] Use secrets management (Vault, AWS Secrets Manager)

### JWT Key Management

Generate RSA key pair:
```bash
# Generate private key
openssl genrsa -out private.pem 2048

# Generate public key
openssl rsa -in private.pem -pubout -out public.pem
```

---

## Scaling

### Horizontal Scaling

The Identity Worker is stateless and can be scaled horizontally:

```bash
# Scale to 3 instances
docker-compose up -d --scale identity-worker=3
```

### Load Balancing

Use a load balancer (nginx, HAProxy) in front of multiple instances:

```nginx
upstream identity_worker {
    server identity-worker-1:3008;
    server identity-worker-2:3008;
    server identity-worker-3:3008;
}

server {
    listen 80;
    location / {
        proxy_pass http://identity_worker;
    }
}
```

---

## Monitoring

### Prometheus Metrics

Metrics available at `/metrics`:
- HTTP request metrics
- Authentication metrics
- OAuth operation metrics
- Database operation metrics
- System resource metrics

### Grafana Dashboard

Import dashboard from `documentation/grafana-dashboard.json`

---

## Troubleshooting

See [TROUBLESHOOTING.md](TROUBLESHOOTING.md) for common issues and solutions.
