# Agent Tool Worker - Performance Guide

## Table of Contents

- [Performance Metrics](#performance-metrics)
- [Benchmarks](#benchmarks)
- [Optimization Strategies](#optimization-strategies)
- [Rate Limiting](#rate-limiting)
- [Caching](#caching)
- [Load Testing](#load-testing)
- [Monitoring](#monitoring)
- [Troubleshooting](#troubleshooting)

---

## Performance Metrics

### Key Performance Indicators (KPIs)

| Metric | Target | Warning | Critical |
|--------|--------|---------|----------|
| Response Time (p50) | <200ms | >300ms | >500ms |
| Response Time (p95) | <500ms | >750ms | >1000ms |
| Response Time (p99) | <1000ms | >1500ms | >2000ms |
| Error Rate | <0.1% | >1% | >5% |
| Availability | >99.5% | <99% | <95% |
| Rate Limit Violations | <1% | >5% | >10% |
| Memory Usage | <256MB | >400MB | >512MB |
| CPU Usage | <50% | >75% | >90% |

### Response Time Breakdown

Typical request execution time for tool retrieval:

```
┌──────────────────────────────────────────────────────────┐
│ Total: ~250ms average                                     │
├──────────────────────────────────────────────────────────┤
│ 1. Request parsing & validation     : 5ms                │
│ 2. Rate limit check                 : 2ms                │
│ 3. OAuth token validation           : 10ms               │
│ 4. External API request             : 200ms              │
│ 5. Response transformation          : 20ms               │
│ 6. Error handling & logging         : 13ms               │
└──────────────────────────────────────────────────────────┘
```

---

## Benchmarks

### Retriever Performance

#### Google Drive Retriever
```
Test: Search 1000 files, max_results=50

Execution Time Statistics:
├─ Min:     150ms
├─ Max:     850ms
├─ Mean:    320ms
├─ Median:  280ms
├─ P95:     620ms
└─ P99:     780ms

Memory Usage: 45 MB
Error Rate: 0.2%
Throughput: 3,125 requests/hour
```

#### Notion Retriever
```
Test: Query database with 100 pages

Execution Time Statistics:
├─ Min:     180ms
├─ Max:     920ms
├─ Mean:    380ms
├─ Median:  350ms
├─ P95:     750ms
└─ P99:     890ms

Memory Usage: 52 MB
Error Rate: 0.3%
Throughput: 2,632 requests/hour
```

#### Todoist Retriever
```
Test: Query 200 tasks with filters

Execution Time Statistics:
├─ Min:     120ms
├─ Max:     680ms
├─ Mean:    280ms
├─ Median:  250ms
├─ P95:     520ms
└─ P99:     650ms

Memory Usage: 38 MB
Error Rate: 0.1%
Throughput: 4,286 requests/hour
```

### Rate Limiting Performance

```
Sliding Window Check Time: <1ms
Request Recording Time: <0.5ms
Status Query Time: <2ms
Wait Time Calculation: <1ms

Per-Second Limits:
├─ Per-API overhead: <0.1ms
├─ Memory per API: ~1KB
└─ Maximum tracking: 1,000 APIs

Per-Minute Limits:
├─ Per-API overhead: <0.2ms
├─ Memory per API: ~60KB
└─ Maximum tracking: 1,000 APIs

Per-Hour Limits:
├─ Per-API overhead: <1ms
├─ Memory per API: ~3.6MB
└─ Maximum tracking: 100 APIs simultaneously
```

---

## Optimization Strategies

### 1. Request Deduplication

```typescript
// Cache identical requests within a time window
interface CacheEntry {
  hash: string;
  result: ToolResult;
  timestamp: number;
}

class RequestCache {
  private cache = new Map<string, CacheEntry>();
  private readonly TTL = 60000; // 1 minute

  get(input: any): ToolResult | null {
    const hash = this.hashInput(input);
    const entry = this.cache.get(hash);
    
    if (entry && Date.now() - entry.timestamp < this.TTL) {
      return entry.result;
    }
    
    this.cache.delete(hash);
    return null;
  }

  set(input: any, result: ToolResult): void {
    const hash = this.hashInput(input);
    this.cache.set(hash, { hash, result, timestamp: Date.now() });
  }

  private hashInput(input: any): string {
    return crypto.createHash('sha256')
      .update(JSON.stringify(input))
      .digest('hex');
  }
}
```

### 2. Connection Pooling

```typescript
// Reuse HTTP connections across requests
const axiosInstance = axios.create({
  httpAgent: new http.Agent({
    keepAlive: true,
    maxSockets: 50,
    maxFreeSockets: 10,
    timeout: 60000,
    freeSocketTimeout: 30000
  }),
  httpsAgent: new https.Agent({
    keepAlive: true,
    maxSockets: 50,
    maxFreeSockets: 10,
    timeout: 60000,
    freeSocketTimeout: 30000
  })
});
```

### 3. Batch Processing

```typescript
// Process multiple requests efficiently
async executeMultiple(requests: ExecutionRequest[]): Promise<ToolResult[]> {
  // Group by API to maximize connection reuse
  const grouped = this.groupByApi(requests);
  
  // Execute in parallel with concurrency limit
  const results = await Promise.allSettled(
    Array.from(grouped.entries()).map(([api, reqs]) =>
      this.executeApiRequests(api, reqs)
    )
  );
  
  return results
    .filter(r => r.status === 'fulfilled')
    .map(r => (r as PromiseFulfilledResult<ToolResult>).value);
}

private groupByApi(requests: ExecutionRequest[]): Map<string, ExecutionRequest[]> {
  const grouped = new Map<string, ExecutionRequest[]>();
  
  for (const req of requests) {
    const api = req.toolName;
    if (!grouped.has(api)) {
      grouped.set(api, []);
    }
    grouped.get(api)!.push(req);
  }
  
  return grouped;
}
```

### 4. Lazy Loading

```typescript
// Load tools only when needed
class LazyToolRegistry {
  private tools = new Map<string, Tool>();
  private loaders = new Map<string, () => Promise<Tool>>();

  registerLoader(name: string, loader: () => Promise<Tool>): void {
    this.loaders.set(name, loader);
  }

  async getTool(name: string): Promise<Tool> {
    if (!this.tools.has(name)) {
      const loader = this.loaders.get(name);
      if (!loader) throw new Error(`Tool ${name} not found`);
      this.tools.set(name, await loader());
    }
    return this.tools.get(name)!;
  }
}
```

### 5. Compression

```typescript
// Enable response compression
import compression from 'compression';

app.use(compression({
  level: 6,              // Compression level (0-9)
  threshold: 1024,       // Only compress >1KB
  type: [
    'application/json',
    'application/ld+json'
  ]
}));
```

---

## Rate Limiting

### Configuration Recommendations

```typescript
const rateLimitConfigs: Record<string, RateLimitQuota> = {
  google_drive: {
    requestsPerSecond: 10,
    requestsPerMinute: 300,
    requestsPerHour: 10000,
    burstLimit: 50
  },
  notion: {
    requestsPerSecond: 3,
    requestsPerMinute: 180,
    requestsPerHour: 10000,
    burstLimit: 10
  },
  todoist: {
    requestsPerSecond: 5,
    requestsPerMinute: 30,
    requestsPerHour: 450,
    burstLimit: 10
  },
  youtube: {
    requestsPerSecond: 10,
    requestsPerMinute: 600,
    requestsPerHour: 10000,
    burstLimit: 50
  }
};
```

### Backoff Strategy

```typescript
// Exponential backoff with jitter
async function executeWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries = 3
): Promise<T> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (error.response?.status !== 429 && attempt < maxRetries - 1) {
        throw error; // Not a rate limit error
      }
      
      const waitTime = calculateBackoff(attempt);
      const jitter = Math.random() * 1000;
      await new Promise(resolve => 
        setTimeout(resolve, waitTime + jitter)
      );
    }
  }
  throw new Error('Max retries exceeded');
}

function calculateBackoff(attempt: number): number {
  // Exponential backoff: 2^attempt * 1000ms
  return Math.pow(2, attempt) * 1000;
}
```

---

## Caching

### Cache Strategy

```typescript
interface CacheConfig {
  enabled: boolean;
  ttl: number;                    // Time to live in seconds
  maxSize: number;                // Max cache size in bytes
  evictionPolicy: 'LRU' | 'LFU';  // Cache eviction policy
}

class ToolResultCache {
  private cache: LRU<string, ToolResult>;
  private stats = {
    hits: 0,
    misses: 0,
    evictions: 0
  };

  constructor(config: CacheConfig) {
    this.cache = new LRU({
      max: config.maxSize,
      length: (entry) => JSON.stringify(entry).length
    });
  }

  get(key: string): ToolResult | null {
    const result = this.cache.get(key);
    if (result) {
      this.stats.hits++;
      return result;
    }
    this.stats.misses++;
    return null;
  }

  set(key: string, value: ToolResult, ttl: number): void {
    this.cache.set(key, value);
    setTimeout(() => this.cache.del(key), ttl);
  }

  getStats(): CacheStats {
    const total = this.stats.hits + this.stats.misses;
    return {
      ...this.stats,
      hitRate: total > 0 ? this.stats.hits / total : 0
    };
  }
}
```

---

## Load Testing

### k6 Load Test Script

```javascript
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '30s', target: 10 },    // Ramp-up
    { duration: '60s', target: 50 },    // Steady
    { duration: '30s', target: 100 },   // Peak
    { duration: '30s', target: 0 }      // Ramp-down
  ],
  thresholds: {
    http_req_duration: ['p(95)<500', 'p(99)<1000'],
    http_req_failed: ['rate<0.1']
  }
};

export default function () {
  const tools = [
    'google_drive_retriever',
    'notion_retriever',
    'todoist_retriever',
    'weather_retriever'
  ];

  const tool = tools[Math.floor(Math.random() * tools.length)];
  
  const payload = JSON.stringify({
    input: {
      query: `test query ${Date.now()}`,
      max_results: 10
    }
  });

  const params = {
    headers: { 'Content-Type': 'application/json' }
  };

  const response = http.post(
    `http://localhost:3001/tools/${tool}/execute`,
    payload,
    params
  );

  check(response, {
    'status is 200': (r) => r.status === 200,
    'response time < 500ms': (r) => r.timings.duration < 500,
    'has data': (r) => r.json('data') !== null
  });

  sleep(1);
}
```

### Run Load Test

```bash
# Install k6
# See: https://k6.io/docs/getting-started/installation/

# Run test
k6 run load-test.js

# Run with output
k6 run load-test.js -o json=results.json

# Run with InfluxDB backend
k6 run load-test.js --vus 100 --duration 10m -o influxdb=http://localhost:8086
```

---

## Monitoring

### Prometheus Queries

```promql
# Request rate (requests per second)
rate(agent_tool_worker_requests_total[1m])

# Error rate
rate(agent_tool_worker_errors_total[1m]) / rate(agent_tool_worker_requests_total[1m])

# P95 response time
histogram_quantile(0.95, agent_tool_worker_request_duration_seconds_bucket)

# Tool execution time distribution
histogram_quantile(0.95, agent_tool_worker_tool_execution_time_seconds_bucket)

# Rate limit violations per minute
rate(agent_tool_worker_rate_limit_exceeded_total[1m])

# Memory usage
process_resident_memory_bytes

# CPU usage
rate(process_cpu_seconds_total[1m])
```

### Grafana Dashboard Panels

**Panel 1: Request Rate**
```
Query: rate(agent_tool_worker_requests_total[1m])
Type: Graph
Legend: {{method}} {{endpoint}}
```

**Panel 2: Error Rate**
```
Query: rate(agent_tool_worker_errors_total[1m])
Type: Graph
Threshold: 0.001 (0.1%)
```

**Panel 3: Response Time**
```
Query: histogram_quantile(0.95, agent_tool_worker_request_duration_seconds_bucket)
Type: Graph
Unit: seconds
```

---

## Troubleshooting

### High Response Time

1. **Check external API latency:**
   ```bash
   time curl -w "@curl-format.txt" https://api.notion.com/v1/search
   ```

2. **Enable request profiling:**
   ```typescript
   app.use((req, res, next) => {
     const start = Date.now();
     res.on('finish', () => {
       console.log(`${req.path}: ${Date.now() - start}ms`);
     });
     next();
   });
   ```

3. **Check memory usage:**
   ```bash
   # Node.js heap snapshot
   kill -USR2 <pid>
   # Generates heapdump
   ```

### High Memory Usage

1. **Check for memory leaks:**
   ```javascript
   setInterval(() => {
     const usage = process.memoryUsage();
     console.log(`Memory: ${Math.round(usage.heapUsed / 1024 / 1024)}MB`);
   }, 5000);
   ```

2. **Enable garbage collection logging:**
   ```bash
   node --trace-gc app.js
   ```

3. **Clear caches periodically:**
   ```typescript
   setInterval(() => {
     toolResultCache.clear();
     console.log('Cache cleared');
   }, 3600000); // 1 hour
   ```

### Rate Limit Violations

1. **Check current limits:**
   ```bash
   curl http://localhost:3001/rate-limits/status
   ```

2. **Implement request queuing:**
   ```typescript
   const queue = new PQueue({ 
     concurrency: 1,
     interval: 1000,
     intervalCap: 10  // Max 10 requests per second
   });
   ```

