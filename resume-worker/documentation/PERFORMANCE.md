# Resume Worker Performance Guide

## Overview

This guide covers performance optimization strategies, benchmarks, and tuning recommendations for the Resume Worker and Resume NLP Service.

---

## Performance Targets

| Operation | Target | P95 | P99 |
|-----------|--------|-----|-----|
| Bullet Evaluation | < 1s | < 2s | < 3s |
| Job Posting Extraction | < 2s | < 4s | < 6s |
| Resume Evaluation | < 5s | < 10s | < 15s |
| Experience Bank Search | < 500ms | < 1s | < 2s |
| Full Tailoring Workflow | < 5min | < 8min | < 10min |
| Vector Search | < 100ms | < 200ms | < 500ms |
| HTTP API Response | < 200ms | < 500ms | < 1s |

---

## Optimization Strategies

### 1. Experience Bank Search Optimization

#### Problem: Slow vector searches

**Current Performance:**
- 1000ms for 10 results
- High CPU usage
- Memory spikes

**Optimizations:**

1. **Add MongoDB Indexes:**
```javascript
// Critical indexes
db.experienceBankItems.createIndex({userId: 1, "metadata.reviewed": 1})
db.experienceBankItems.createIndex({"metadata.technologies": 1})
db.experienceBankItems.createIndex({"metadata.category": 1})
db.experienceBankItems.createIndex({hash: 1}, {unique: true})

// Compound index for common queries
db.experienceBankItems.createIndex({
  userId: 1,
  "metadata.reviewed": 1,
  "metadata.category": 1
})
```

2. **Implement Caching:**
```typescript
// Redis cache for frequent searches
@Injectable()
export class ExperienceBankService {
  private readonly CACHE_TTL = 300; // 5 minutes

  async search(userId: string, params: SearchParams) {
    const cacheKey = `search:${userId}:${JSON.stringify(params)}`;
    
    // Check cache
    const cached = await this.redis.get(cacheKey);
    if (cached) return JSON.parse(cached);

    // Perform search
    const results = await this.performSearch(userId, params);

    // Cache results
    await this.redis.setex(cacheKey, this.CACHE_TTL, JSON.stringify(results));

    return results;
  }
}
```

3. **Optimize Vector Search:**
```typescript
// Pre-filter with metadata before vector search
async search(userId: string, params: SearchParams) {
  // Step 1: Filter by metadata (fast)
  const candidates = await this.model.find({
    userId,
    'metadata.reviewed': params.filters?.reviewed,
    'metadata.technologies': { $in: params.filters?.technologies },
  }).select('_id vector bulletText metadata');

  // Step 2: Vector search on filtered set (smaller dataset)
  const results = await this.vectorSearch(candidates, params.query);

  return results.slice(0, params.limit);
}
```

**Expected Improvement:** 500ms → 100ms (5x faster)

---

### 2. Bullet Evaluation Batching

#### Problem: Evaluating bullets one at a time is slow

**Current Performance:**
- 1s per bullet
- 10 bullets = 10s total

**Optimization:**

```typescript
// Batch evaluation
async evaluateBullets(bullets: string[], role?: string) {
  // Send single Kafka message with all bullets
  const requestId = uuid();
  
  await this.kafkaClient.emit('resume.bullet.evaluate.batch.request', {
    requestId,
    bullets,
    role,
    timestamp: new Date().toISOString(),
  });

  // Wait for batch response
  return this.waitForBatchResponse(requestId);
}
```

**Python NLP Service:**
```python
# Process bullets in parallel
async def evaluate_bullets_batch(bullets: List[str], role: str):
    # Use asyncio to process in parallel
    tasks = [evaluate_bullet(bullet, role) for bullet in bullets]
    results = await asyncio.gather(*tasks)
    return results
```

**Expected Improvement:** 10s → 2s (5x faster)

---

### 3. PDF Parsing Optimization

#### Problem: PDF parsing is slow and memory-intensive

**Current Performance:**
- 3-5s per PDF
- High memory usage

**Optimizations:**

1. **Stream Processing:**
```python
# Don't load entire PDF into memory
def parse_pdf_stream(pdf_path: str):
    with fitz.open(pdf_path) as doc:
        for page_num in range(len(doc)):
            page = doc[page_num]
            text = page.get_text()
            yield process_page(text)
```

2. **Parallel Page Processing:**
```python
# Process pages in parallel
from multiprocessing import Pool

def parse_pdf_parallel(pdf_path: str):
    with fitz.open(pdf_path) as doc:
        page_count = len(doc)
        
    with Pool(processes=4) as pool:
        results = pool.map(process_page, range(page_count))
    
    return combine_results(results)
```

3. **Cache Parsed PDFs:**
```python
# Cache parsed results
@lru_cache(maxsize=100)
def parse_pdf_cached(pdf_hash: str):
    return parse_pdf(pdf_hash)
```

**Expected Improvement:** 4s → 1s (4x faster)

---

### 4. Resume Evaluation Optimization

#### Problem: Full evaluation takes too long

**Current Performance:**
- 10-15s per evaluation
- Sequential processing

**Optimization:**

```typescript
async evaluateResume(resumeId: string, options: EvaluateOptions) {
  // Step 1: Compile LaTeX (parallel with parsing prep)
  const [pdfUrl] = await Promise.all([
    this.latexWorker.compile(resume.latexContent),
    this.prepareEvaluation(resumeId),
  ]);

  // Step 2: Parse PDF
  const parsed = await this.nlpService.parsePDF(pdfUrl);

  // Step 3: Parallel evaluations
  const [bulletScores, atsChecks, roleAlignment] = await Promise.all([
    this.evaluateBullets(parsed.bullets),
    this.checkATS(parsed),
    this.checkRoleAlignment(parsed, options.targetRole),
  ]);

  // Step 4: Generate report
  return this.generateReport({bulletScores, atsChecks, roleAlignment});
}
```

**Expected Improvement:** 15s → 5s (3x faster)

---

### 5. Kafka Message Optimization

#### Problem: High Kafka latency

**Optimizations:**

1. **Batch Messages:**
```typescript
// Producer config
const producer = kafka.producer({
  allowAutoTopicCreation: false,
  transactionTimeout: 30000,
  // Batch settings
  compression: CompressionTypes.GZIP,
  batch: {
    size: 16384,  // 16KB batches
    maxBytes: 1048576,  // 1MB max
  },
});
```

2. **Increase Partitions:**
```bash
# More partitions = more parallelism
kafka-topics --bootstrap-server localhost:9094 \
  --alter --topic resume.bullet.evaluate.request \
  --partitions 12
```

3. **Optimize Consumer:**
```typescript
// Consumer config
const consumer = kafka.consumer({
  groupId: 'resume-worker-bullet-eval',
  // Fetch settings
  maxBytesPerPartition: 1048576,  // 1MB
  maxWaitTimeInMs: 100,  // Don't wait too long
  // Session settings
  sessionTimeout: 30000,
  heartbeatInterval: 3000,
});
```

**Expected Improvement:** 500ms → 100ms latency

---

### 6. Database Query Optimization

#### Problem: Slow MongoDB queries

**Optimizations:**

1. **Use Projections:**
```typescript
// Only fetch needed fields
await this.model.find({userId})
  .select('bulletText metadata.technologies metadata.role')
  .lean();  // Return plain objects, not Mongoose documents
```

2. **Use Aggregation Pipeline:**
```typescript
// Complex queries
await this.model.aggregate([
  { $match: { userId } },
  { $group: {
    _id: '$metadata.category',
    count: { $sum: 1 },
    avgScore: { $avg: '$metadata.impactScore' }
  }},
  { $sort: { count: -1 } }
]);
```

3. **Connection Pooling:**
```typescript
MongooseModule.forRoot(uri, {
  maxPoolSize: 50,
  minPoolSize: 10,
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 45000,
});
```

**Expected Improvement:** 200ms → 50ms query time

---

### 7. BullMQ Job Queue Optimization

#### Problem: Job queue bottleneck

**Optimizations:**

1. **Increase Concurrency:**
```typescript
// Process multiple jobs in parallel
@Processor('resume-tailoring')
export class TailoringProcessor {
  @Process({ concurrency: 10 })  // Process 10 jobs at once
  async handleTailoringJob(job: Job) {
    // Process job
  }
}
```

2. **Job Prioritization:**
```typescript
// High priority for paid users
await this.tailoringQueue.add('tailor-resume', data, {
  priority: user.isPremium ? 1 : 10,
});
```

3. **Rate Limiting:**
```typescript
// Limit jobs per user
const limiter = {
  max: 5,  // Max 5 jobs
  duration: 60000,  // Per minute
  groupKey: userId,
};

await this.tailoringQueue.add('tailor-resume', data, { limiter });
```

---

### 8. WebSocket Optimization

#### Problem: High WebSocket overhead

**Optimizations:**

1. **Message Compression:**
```typescript
@WebSocketGateway({
  namespace: '/resume-iterator',
  transports: ['websocket'],
  perMessageDeflate: true,  // Enable compression
})
```

2. **Throttle Updates:**
```typescript
// Don't send every tiny update
private throttledEmit = throttle((client, event, data) => {
  client.emit(event, data);
}, 100);  // Max 10 updates/second
```

3. **Binary Messages:**
```typescript
// Use binary for large data
client.emit('evaluation-update', {
  reportId,
  score: 85,
  // Send large data as binary
  details: Buffer.from(JSON.stringify(details)),
});
```

---

## Caching Strategy

### Redis Cache Layers

```typescript
// Layer 1: Hot data (1 minute TTL)
const HOT_CACHE_TTL = 60;
// - Active sessions
// - Recent evaluations
// - Frequent searches

// Layer 2: Warm data (5 minutes TTL)
const WARM_CACHE_TTL = 300;
// - User experience bank
// - Job postings
// - Resume versions

// Layer 3: Cold data (1 hour TTL)
const COLD_CACHE_TTL = 3600;
// - Parsed PDFs
// - Compiled LaTeX
// - Vector embeddings
```

### Cache Invalidation

```typescript
// Invalidate on write
async add(data: ExperienceBankItemData) {
  const item = await this.model.create(data);
  
  // Invalidate user's cache
  await this.redis.del(`search:${data.userId}:*`);
  await this.redis.del(`list:${data.userId}`);
  
  return item;
}
```

---

## Load Testing

### Test Scenarios

1. **Baseline Load:**
```bash
# 10 concurrent users, 1000 requests
artillery quick --count 10 --num 1000 http://localhost:3006/health
```

2. **Experience Bank Search:**
```yaml
# artillery-search.yml
config:
  target: http://localhost:3006
  phases:
    - duration: 60
      arrivalRate: 10
scenarios:
  - name: Search experience bank
    flow:
      - post:
          url: /experience-bank/search
          json:
            userId: "user123"
            query: "microservices"
            limit: 10
```

3. **Full Tailoring Workflow:**
```yaml
# artillery-tailoring.yml
config:
  target: http://localhost:3006
  phases:
    - duration: 300
      arrivalRate: 2
scenarios:
  - name: Tailor resume
    flow:
      - post:
          url: /tailoring/tailor
          json:
            userId: "user123"
            resumeId: "resume123"
            jobPostingText: "Senior Engineer..."
```

### Performance Benchmarks

**Hardware:** 4 CPU, 8GB RAM

| Scenario | Throughput | P95 Latency | Success Rate |
|----------|-----------|-------------|--------------|
| Health Check | 1000 req/s | 10ms | 100% |
| Experience Bank Search | 100 req/s | 500ms | 99.9% |
| Bullet Evaluation | 50 req/s | 2s | 99.5% |
| Resume Evaluation | 10 req/s | 8s | 99% |
| Full Tailoring | 2 req/s | 4min | 98% |

---

## Scaling Recommendations

### Vertical Scaling

**Small (Development):**
- 2 CPU, 4GB RAM
- Handles 10 concurrent users

**Medium (Production):**
- 4 CPU, 8GB RAM
- Handles 50 concurrent users

**Large (High Load):**
- 8 CPU, 16GB RAM
- Handles 200 concurrent users

### Horizontal Scaling

```yaml
# docker-compose scale
services:
  resume-worker:
    deploy:
      replicas: 3

  resume-nlp-service:
    deploy:
      replicas: 4
```

**Load Balancer:**
```nginx
upstream resume_worker {
  least_conn;
  server resume-worker-1:3006;
  server resume-worker-2:3006;
  server resume-worker-3:3006;
}
```

---

## Monitoring Performance

### Key Metrics to Watch

```promql
# P95 latency
histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))

# Throughput
rate(http_requests_total[5m])

# Error rate
rate(http_requests_total{status_code=~"5.."}[5m]) / rate(http_requests_total[5m])

# Queue size
bullmq_queue_size{state="waiting"}

# Memory usage
nodejs_heap_size_used_bytes / nodejs_heap_size_total_bytes
```

---

## Best Practices

1. **Use async/await properly** - Don't block the event loop
2. **Batch operations** - Reduce network round trips
3. **Cache aggressively** - Especially for read-heavy operations
4. **Index strategically** - Based on query patterns
5. **Monitor continuously** - Set up alerts for degradation
6. **Load test regularly** - Before major releases
7. **Profile in production** - Use APM tools
8. **Optimize hot paths** - Focus on 80/20 rule

---

**Last Updated:** November 3, 2025  
**Version:** 1.0.0
