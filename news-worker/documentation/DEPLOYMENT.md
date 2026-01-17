# News Worker - Deployment Guide

## Docker Deployment

### Build Image

```bash
docker build -t news-worker:latest .
```

### Run Container

```bash
docker run -d \
  --name news-worker \
  -p 3009:3009 \
  -e PORT=3009 \
  -e REDIS_URL=redis://redis:6379/0 \
  -e MONGODB_URI=mongodb://mongo:27017/news \
  news-worker:latest
```

## Environment Configuration

```env
PORT=3009
NODE_ENV=production
REDIS_URL=redis://localhost:6379/0
MONGODB_URI=mongodb://localhost:27017/news
CACHE_DEFAULT_TTL=3600
WORKER_THREAD_MIN=2
WORKER_THREAD_MAX=8
```

## Health Checks

```bash
curl http://localhost:3009/health
```
