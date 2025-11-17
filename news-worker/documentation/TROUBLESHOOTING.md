# News Worker - Troubleshooting Guide

## Common Issues

### Service Won't Start

**Port Already in Use:**
```bash
# Change port in .env
PORT=3010
```

### Redis Connection Issues

```bash
# Check Redis is running
redis-cli ping

# Verify connection string
REDIS_URL=redis://localhost:6379/0
```

### Slow Feed Response

- Check Redis cache hit rate
- Verify database indexes
- Check worker thread pool utilization
