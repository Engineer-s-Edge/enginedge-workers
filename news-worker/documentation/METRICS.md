# News Worker - Metrics & Monitoring

## Metrics Endpoint

```bash
curl http://localhost:3009/metrics
```

## Available Metrics

- `news_worker_requests_total` - Total HTTP requests
- `news_worker_response_time_seconds` - Response time histogram
- `news_worker_cache_hits_total` - Cache hit counter
- `news_worker_cache_misses_total` - Cache miss counter
- `news_worker_thread_pool_active_tasks` - Active thread pool tasks
