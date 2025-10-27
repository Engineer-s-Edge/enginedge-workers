# Interview Worker - Performance

## Overview

The Interview Worker handles real-time interview processing with high throughput requirements. This document covers performance characteristics, optimization strategies, and monitoring guidelines.

## Performance Targets

### Latency Requirements
- **API Response Time**: < 200ms for 95th percentile
- **Transcription Latency**: < 5 seconds for real-time processing
- **Analysis Completion**: < 30 seconds for comprehensive analysis
- **Scheduling Response**: < 100ms for availability checks

### Throughput Requirements
- **Concurrent Interviews**: 100+ simultaneous sessions
- **API Requests**: 1000+ RPS
- **Transcription Processing**: 50+ concurrent streams
- **Analysis Queue**: 200+ interviews/hour

### Resource Utilization
- **CPU**: < 70% average utilization
- **Memory**: < 80% of allocated resources
- **Network**: < 50% of available bandwidth
- **Storage**: < 70% of allocated disk space

## Architecture Performance

### Horizontal Scaling
```
Load Balancer → API Gateway → Interview Worker Instances
                     ↓
              Database Cluster (MongoDB)
                     ↓
            Cache Layer (Redis)
                     ↓
         Message Queue (Kafka)
```

### Performance Patterns
- **CQRS**: Separate read/write models for optimal performance
- **Event-Driven**: Asynchronous processing for heavy operations
- **Caching Strategy**: Multi-level caching (application, Redis, CDN)
- **Database Optimization**: Indexing, sharding, and query optimization

## Database Performance

### MongoDB Optimization

#### Indexes
```javascript
// High-cardinality indexes
db.interviews.createIndex({ "interviewId": 1 }, { unique: true })
db.interviews.createIndex({ "candidateId": 1 })
db.interviews.createIndex({ "status": 1 })
db.interviews.createIndex({ "scheduledAt": 1 })

// Compound indexes for queries
db.interviews.createIndex({
  "status": 1,
  "scheduledAt": 1,
  "candidateId": 1
})

// Text indexes for search
db.interviews.createIndex({
  "transcription.segments.text": "text",
  "analysis.keywords.word": "text"
})
```

#### Sharding Strategy
```javascript
// Shard by interview date for temporal distribution
sh.shardCollection("interview_worker.interviews", { "scheduledAt": 1 })

// Shard by candidate for user-specific queries
sh.shardCollection("interview_worker.candidates", { "candidateId": "hashed" })
```

#### Query Optimization
```javascript
// Efficient pagination
db.interviews.find({
  status: "completed",
  scheduledAt: { $gte: ISODate("2024-01-01") }
})
.sort({ scheduledAt: -1 })
.limit(20)
.skip(0)

// Aggregation pipeline for analytics
db.interviews.aggregate([
  { $match: { status: "completed" } },
  { $group: {
    _id: { $dateToString: { format: "%Y-%m-%d", date: "$scheduledAt" } },
    count: { $sum: 1 },
    avgDuration: { $avg: "$duration" }
  }},
  { $sort: { "_id": 1 } }
])
```

### Redis Caching

#### Cache Keys
```
interview:{interviewId}              # Interview data (TTL: 1h)
candidate:{candidateId}              # Candidate info (TTL: 24h)
analysis:{interviewId}               # Analysis results (TTL: 7d)
availability:{userId}:{date}         # Calendar availability (TTL: 1h)
transcription:{interviewId}:{segment} # Transcription segments (TTL: 24h)
```

#### Cache Strategy
```typescript
// Cache-aside pattern
async getInterview(interviewId: string) {
  let interview = await redis.get(`interview:${interviewId}`);
  if (!interview) {
    interview = await mongo.findOne({ interviewId });
    await redis.setex(`interview:${interviewId}`, 3600, JSON.stringify(interview));
  }
  return interview;
}

// Write-through caching
async updateInterview(interviewId: string, data: any) {
  await mongo.updateOne({ interviewId }, data);
  await redis.del(`interview:${interviewId}`);
}
```

## Application Performance

### Memory Management

#### Object Pooling
```typescript
// Reuse transcription processors
class TranscriptionPool {
  private pool: TranscriptionProcessor[] = [];
  private maxSize = 10;

  getProcessor(): TranscriptionProcessor {
    if (this.pool.length > 0) {
      return this.pool.pop()!;
    }
    return new TranscriptionProcessor();
  }

  returnProcessor(processor: TranscriptionProcessor) {
    if (this.pool.length < this.maxSize) {
      this.pool.push(processor);
    }
  }
}
```

#### Garbage Collection Tuning
```bash
# JVM-like GC tuning for Node.js
node --max-old-space-size=1024 \
     --optimize-for-size \
     --gc-interval=100 \
     app.js
```

### CPU Optimization

#### Worker Threads
```typescript
// CPU-intensive analysis in worker threads
const { Worker } = require('worker_threads');

function analyzeInterview(interviewData) {
  return new Promise((resolve, reject) => {
    const worker = new Worker('./analysis-worker.js', {
      workerData: interviewData
    });

    worker.on('message', resolve);
    worker.on('error', reject);
  });
}
```

#### Async Processing
```typescript
// Non-blocking I/O operations
async function processInterview(interviewId) {
  // Parallel processing
  const [transcription, analysis, scheduling] = await Promise.all([
    transcribeAudio(interviewId),
    analyzeContent(interviewId),
    updateCalendar(interviewId)
  ]);

  return { transcription, analysis, scheduling };
}
```

## External Service Performance

### AI Service Optimization

#### Provider Selection
```typescript
// Dynamic provider selection based on load
class AIServiceRouter {
  async routeAnalysis(type: string, data: any) {
    const providers = await this.getAvailableProviders();
    const fastest = providers.sort((a, b) => a.latency - b.latency)[0];

    return this.callProvider(fastest, type, data);
  }
}
```

#### Request Batching
```typescript
// Batch multiple analysis requests
async function batchAnalysis(requests: AnalysisRequest[]) {
  const batches = chunk(requests, 10); // 10 requests per batch

  const results = [];
  for (const batch of batches) {
    const batchResults = await Promise.all(
      batch.map(req => analyzeSingle(req))
    );
    results.push(...batchResults);

    // Rate limiting delay
    await delay(100);
  }

  return results;
}
```

### Speech Service Optimization

#### Streaming Processing
```typescript
// Real-time streaming transcription
class StreamingTranscriber {
  private buffer: Buffer[] = [];
  private processing = false;

  async processChunk(chunk: Buffer) {
    this.buffer.push(chunk);

    if (!this.processing && this.buffer.length >= 10) {
      this.processing = true;
      await this.transcribeBuffer();
      this.processing = false;
    }
  }

  private async transcribeBuffer() {
    const audio = Buffer.concat(this.buffer);
    this.buffer = [];

    const transcription = await speechService.transcribe(audio);
    await this.emitTranscription(transcription);
  }
}
```

## Network Performance

### Connection Pooling
```typescript
// HTTP client configuration
const axiosConfig = {
  timeout: 5000,
  maxSockets: 100,
  maxFreeSockets: 10,
  keepAlive: true,
  keepAliveMsecs: 30000
};
```

### Compression
```typescript
// Response compression
app.use(compression({
  level: 6,
  threshold: 1024,
  filter: (req, res) => {
    if (req.headers['x-no-compression']) return false;
    return compression.filter(req, res);
  }
}));
```

## Monitoring & Alerting

### Key Metrics

#### Application Metrics
```
http_request_duration_seconds{quantile="0.95"} < 0.2
http_requests_total{status="500"} / http_requests_total * 100 < 1
interview_processing_duration_seconds{quantile="0.95"} < 30
transcription_latency_seconds{quantile="0.95"} < 5
```

#### System Metrics
```
process_cpu_usage < 0.7
process_memory_usage < 0.8
nodejs_heap_size_used_bytes / nodejs_heap_size_total_bytes < 0.8
```

#### Business Metrics
```
interview_completion_rate > 0.95
average_interview_duration_minutes > 30
candidate_satisfaction_score > 4.0
```

### Performance Dashboards

#### Real-time Dashboard
- Current active interviews
- Processing queue length
- API response times
- Error rates by endpoint

#### Historical Dashboard
- Interview completion trends
- Performance by time of day
- Resource utilization patterns
- AI service response times

## Load Testing

### Test Scenarios

#### Normal Load
```bash
# 100 concurrent users, 10 RPS each
artillery quick --count 100 --num 10 \
  http://localhost:3001/api/v1/interviews
```

#### Peak Load
```bash
# 500 concurrent users, 50 RPS each
artillery run load-test.yml
```

#### Stress Testing
```bash
# Gradually increase load until failure
artillery run stress-test.yml --target http://localhost:3001
```

### Load Test Configuration
```yaml
# load-test.yml
config:
  target: 'http://localhost:3001'
  phases:
    - duration: 60
      arrivalRate: 10
      name: Warm up
    - duration: 300
      arrivalRate: 50
      name: Sustained load
    - duration: 60
      arrivalRate: 100
      name: Peak load

scenarios:
  - name: Create Interview
    weight: 30
    flow:
      - post:
          url: '/api/v1/interviews'
          json:
            candidateId: 'candidate-{{ $randomInt(1, 1000) }}'
            scheduledAt: '2024-01-01T10:00:00Z'

  - name: Get Interview
    weight: 50
    flow:
      - get:
          url: '/api/v1/interviews/{{ $randomInt(1, 1000) }}'

  - name: Analyze Interview
    weight: 20
    flow:
      - post:
          url: '/api/v1/analysis/{{ $randomInt(1, 1000) }}/analyze'
```

## Optimization Strategies

### Database Optimization
1. **Index Optimization**: Regular index usage analysis
2. **Query Profiling**: Identify slow queries
3. **Connection Pooling**: Efficient connection management
4. **Read Replicas**: Offload read operations

### Application Optimization
1. **Caching**: Implement multi-level caching
2. **Async Processing**: Move heavy operations to background
3. **Resource Pooling**: Reuse expensive resources
4. **Code Profiling**: Identify performance bottlenecks

### Infrastructure Optimization
1. **Auto-scaling**: Horizontal pod scaling
2. **Load Balancing**: Distribute load evenly
3. **CDN**: Static asset delivery
4. **Database Sharding**: Distribute data across nodes

## Troubleshooting Performance Issues

### High Latency Issues

#### API Response Time
```bash
# Check slow queries
db.currentOp({
  "secs_running": { "$gt": 5 }
})

# Profile application code
clinic flame -- node dist/main.js
```

#### Database Latency
```bash
# MongoDB profiling
db.setProfilingLevel(2, { slowms: 100 })

# Check slow query log
db.system.profile.find().sort({ ts: -1 }).limit(5)
```

### High Memory Usage
```bash
# Memory leak detection
clinic heapprofiler -- node dist/main.js

# Check for memory leaks
heapdump.writeSnapshot('./before.heapsnapshot');
```

### High CPU Usage
```bash
# CPU profiling
clinic bubbleprof -- node dist/main.js

# Check thread utilization
ps -T -p $(pgrep node)
```

### Network Issues
```bash
# Network monitoring
tcpdump -i eth0 port 3001

# Connection analysis
netstat -antp | grep :3001
```

## Capacity Planning

### Current Capacity
- **Concurrent Interviews**: 100
- **Daily Interviews**: 1000
- **Storage**: 1TB/month
- **API Calls**: 1M/day

### Growth Projections
- **Year 1**: 500 concurrent, 5000 daily
- **Year 2**: 1000 concurrent, 10000 daily
- **Year 3**: 2000 concurrent, 20000 daily

### Scaling Strategy
1. **Horizontal Scaling**: Add more instances
2. **Database Scaling**: Implement sharding
3. **Caching**: Increase Redis cluster size
4. **CDN**: Implement global content delivery

## Performance Benchmarks

### Baseline Performance
```
API Response Time (p95): 150ms
Interview Processing: 25s
Transcription Latency: 3s
Memory Usage: 600MB
CPU Usage: 45%
Throughput: 800 RPS
```

### Target Performance
```
API Response Time (p95): 100ms
Interview Processing: 20s
Transcription Latency: 2s
Memory Usage: 512MB
CPU Usage: 35%
Throughput: 1200 RPS
```

### Monitoring Performance
Regular performance audits and capacity reviews ensure the system maintains optimal performance as load increases.