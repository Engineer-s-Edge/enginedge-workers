# Resume Worker Troubleshooting Guide

## Overview

This guide covers common issues, error messages, and solutions for the Resume Worker and Resume NLP Service.

---

## Table of Contents

- [Service Startup Issues](#service-startup-issues)
- [Resume NLP Service Issues](#spacy-service-issues)
- [Kafka Connectivity](#kafka-connectivity)
- [MongoDB Issues](#mongodb-issues)
- [PDF Parsing Errors](#pdf-parsing-errors)
- [LaTeX Compilation Failures](#latex-compilation-failures)
- [Vector Search Problems](#vector-search-problems)
- [Agent Iteration Issues](#agent-iteration-issues)
- [Performance Problems](#performance-problems)
- [WebSocket Connection Issues](#websocket-connection-issues)

---

## Service Startup Issues

### Issue: Service fails to start

**Symptoms:**
```
Error: Cannot connect to MongoDB
```

**Causes:**
- MongoDB not running
- Incorrect connection string
- Network connectivity issues

**Solutions:**

1. **Check MongoDB status:**
```bash
# Via Docker
docker ps | grep mongodb

# Via platform
cd enginedge-core/platform
docker-compose ps mongodb
```

2. **Verify connection string:**
```bash
# Check environment variable
echo $MONGODB_URI

# Should be: mongodb://localhost:27017/resume-worker
```

3. **Start MongoDB:**
```bash
cd enginedge-core/platform
docker-compose up -d mongodb
```

4. **Test connection:**
```bash
mongosh mongodb://localhost:27017/resume-worker
```

---

### Issue: Port already in use

**Symptoms:**
```
Error: listen EADDRINUSE: address already in use :::3006
```

**Solutions:**

1. **Find process using port:**
```bash
# Windows
netstat -ano | findstr :3006

# Linux/Mac
lsof -i :3006
```

2. **Kill process:**
```bash
# Windows
taskkill /PID <PID> /F

# Linux/Mac
kill -9 <PID>
```

3. **Change port:**
```bash
# Set different port
export PORT=3007
npm run start:dev
```

---

## Resume NLP Service Issues

### Issue: spaCy model not found

**Symptoms:**
```
OSError: [E050] Can't find model 'en_core_web_sm'
```

**Solutions:**

1. **Download spaCy model:**
```bash
python -m spacy download en_core_web_sm
```

2. **Verify installation:**
```bash
python -c "import spacy; nlp = spacy.load('en_core_web_sm'); print('OK')"
```

3. **Rebuild Docker image:**
```bash
cd enginedge-workers/spacy-service
docker build -t spacy-service .
```

---

### Issue: NLP service not responding

**Symptoms:**
- Bullet evaluations timeout
- Job posting extractions fail
- No response from Kafka

**Diagnosis:**

1. **Check service status:**
```bash
curl http://localhost:8001/health
```

2. **Check logs:**
```bash
docker logs spacy-service
```

3. **Check Kafka connectivity:**
```bash
# From NLP service container
docker exec -it spacy-service python -c "from kafka import KafkaProducer; print('OK')"
```

**Solutions:**

1. **Restart service:**
```bash
docker-compose restart spacy-service
```

2. **Check Kafka brokers:**
```bash
# Verify KAFKA_BROKERS environment variable
docker exec spacy-service env | grep KAFKA
```

3. **Increase timeout:**
```python
# In src/main.py
KAFKA_TIMEOUT = 60000  # Increase to 60 seconds
```

---

## Kafka Connectivity

### Issue: Cannot connect to Kafka

**Symptoms:**
```
KafkaTimeoutError: Failed to update metadata after 60.0 secs
```

**Solutions:**

1. **Check Kafka status:**
```bash
docker ps | grep kafka
```

2. **Verify broker address:**
```bash
# Should be kafka:9092 inside Docker network
# Should be localhost:9094 from host
echo $KAFKA_BROKERS
```

3. **Test connectivity:**
```bash
# From inside container
docker exec -it resume-worker nc -zv kafka 9092

# From host
nc -zv localhost 9094
```

4. **Check Kafka logs:**
```bash
docker logs kafka
```

---

### Issue: Consumer lag increasing

**Symptoms:**
- Slow processing
- Messages piling up
- High consumer lag metric

**Diagnosis:**
```promql
# Check consumer lag
kafka_consumer_lag{topic="resume.bullet.evaluate.request"}
```

**Solutions:**

1. **Scale consumers:**
```bash
# Increase NLP service replicas
docker-compose up -d --scale spacy-service=3
```

2. **Increase partition count:**
```bash
kafka-topics --bootstrap-server localhost:9094 \
  --alter --topic resume.bullet.evaluate.request \
  --partitions 12
```

3. **Optimize processing:**
- Batch messages
- Reduce processing time
- Add caching

---

## MongoDB Issues

### Issue: Slow queries

**Symptoms:**
- High latency on experience bank searches
- Slow resume retrieval
- Timeouts

**Diagnosis:**
```javascript
// In MongoDB shell
db.experienceBankItems.find({userId: "user123"}).explain("executionStats")
```

**Solutions:**

1. **Create indexes:**
```javascript
// Experience bank indexes
db.experienceBankItems.createIndex({userId: 1, "metadata.reviewed": 1})
db.experienceBankItems.createIndex({hash: 1}, {unique: true})
db.experienceBankItems.createIndex({"metadata.technologies": 1})

// Resume indexes
db.resumes.createIndex({userId: 1})
db.resumes.createIndex({userId: 1, createdAt: -1})

// Job posting indexes
db.jobPostings.createIndex({userId: 1, createdAt: -1})
```

2. **Analyze slow queries:**
```javascript
db.setProfilingLevel(2)  // Profile all queries
db.system.profile.find().sort({millis: -1}).limit(10)
```

3. **Optimize queries:**
```typescript
// Use projection to limit fields
await this.model.find({userId}, {bulletText: 1, metadata: 1})

// Use lean() for read-only queries
await this.model.find({userId}).lean()
```

---

### Issue: Connection pool exhausted

**Symptoms:**
```
MongoServerSelectionError: connection pool exhausted
```

**Solutions:**

1. **Increase pool size:**
```typescript
// In app.module.ts
MongooseModule.forRoot(process.env.MONGODB_URI, {
  maxPoolSize: 50,  // Increase from default 10
  minPoolSize: 10,
})
```

2. **Check for connection leaks:**
```typescript
// Always close cursors
const cursor = this.model.find().cursor()
try {
  // Process
} finally {
  await cursor.close()
}
```

---

## PDF Parsing Errors

### Issue: PDF parsing fails

**Symptoms:**
```
Error: Failed to parse PDF
```

**Causes:**
- Corrupted PDF
- Unsupported PDF format
- Missing PyMuPDF

**Solutions:**

1. **Verify PDF:**
```bash
# Check if PDF is valid
pdfinfo resume.pdf
```

2. **Try OCR fallback:**
```json
{
  "options": {
    "ocrFallback": true
  }
}
```

3. **Check PyMuPDF installation:**
```bash
python -c "import fitz; print(fitz.__version__)"
```

---

### Issue: Layout detection errors

**Symptoms:**
- Tables not detected
- Columns misaligned
- Incorrect section extraction

**Solutions:**

1. **Simplify resume layout:**
- Avoid complex tables
- Use single column
- Remove graphics/icons

2. **Manual section specification:**
```json
{
  "sections": {
    "experience": {
      "start": 100,
      "end": 500
    }
  }
}
```

---

## LaTeX Compilation Failures

### Issue: LaTeX compilation fails

**Symptoms:**
```
Error: pdflatex exited with code 1
```

**Diagnosis:**
```bash
# Check LaTeX logs
cat /tmp/latex_compile_123.log
```

**Common Errors:**

1. **Missing package:**
```latex
! LaTeX Error: File `geometry.sty' not found
```
**Solution:** Install package in latex-worker

2. **Syntax error:**
```latex
! Undefined control sequence
```
**Solution:** Fix LaTeX syntax

3. **Timeout:**
```
Error: Compilation timeout after 30s
```
**Solution:** Increase timeout or simplify document

---

## Vector Search Problems

### Issue: Poor search results

**Symptoms:**
- Irrelevant bullets returned
- Low similarity scores
- Missing expected results

**Solutions:**

1. **Check embedding model:**
```typescript
// Verify model name
console.log(item.vectorModel)  // Should be "text-embedding-004"
```

2. **Regenerate embeddings:**
```typescript
// Re-embed all bullets
await this.experienceBankService.regenerateEmbeddings(userId)
```

3. **Adjust search parameters:**
```typescript
// Increase limit
const results = await this.search(userId, {
  query,
  limit: 20,  // Increase from 10
  minScore: 0.7,  // Lower threshold
})
```

4. **Add metadata filters:**
```typescript
// Combine vector + metadata search
const results = await this.search(userId, {
  query: "microservices",
  filters: {
    technologies: ["Docker"],
    reviewed: true,
  }
})
```

---

### Issue: Slow vector search

**Symptoms:**
- High search latency (>1s)
- Timeouts

**Solutions:**

1. **Check vector index:**
```javascript
// In data-processing-worker
db.vectors.getIndexes()
```

2. **Reduce search scope:**
```typescript
// Add filters to reduce search space
filters: {
  category: "work",
  reviewed: true,
}
```

3. **Cache frequent searches:**
```typescript
// Add Redis caching
const cacheKey = `search:${userId}:${query}`
const cached = await redis.get(cacheKey)
if (cached) return JSON.parse(cached)
```

---

## Agent Iteration Issues

### Issue: Agent not responding

**Symptoms:**
- WebSocket connection established but no messages
- Agent stuck in "thinking" state
- No evaluation updates

**Diagnosis:**

1. **Check WebSocket connection:**
```javascript
// In browser console
socket.on('connect', () => console.log('Connected'))
socket.on('disconnect', () => console.log('Disconnected'))
```

2. **Check agent status:**
```bash
# Check assistant-worker logs
docker logs assistant-worker | grep "agent_123"
```

**Solutions:**

1. **Restart iteration:**
```javascript
socket.emit('stop-iteration')
socket.emit('start-iteration', {resumeId, jobPostingId})
```

2. **Check assistant-worker:**
```bash
curl http://localhost:3001/health
```

3. **Increase timeouts:**
```typescript
// In resume-iterator.gateway.ts
const AGENT_TIMEOUT = 120000  // 2 minutes
```

---

### Issue: Iteration not improving score

**Symptoms:**
- Score stays the same
- No fixes applied
- Iterations complete without changes

**Solutions:**

1. **Check evaluation results:**
```typescript
// Get latest report
const report = await this.evaluatorService.getReportById(reportId)
console.log(report.findings)  // Check what issues were found
```

2. **Verify auto-fix generation:**
```typescript
// Check if fixes are being generated
console.log(report.suggestedSwaps)
```

3. **Lower target score:**
```json
{
  "targetScore": 90  // Lower from 95
}
```

---

## Performance Problems

### Issue: High memory usage

**Symptoms:**
- Memory usage > 80%
- Out of memory errors
- Slow performance

**Diagnosis:**
```promql
# Check memory usage
nodejs_heap_size_used_bytes / nodejs_heap_size_total_bytes
```

**Solutions:**

1. **Increase heap size:**
```bash
export NODE_OPTIONS="--max-old-space-size=4096"
npm run start:prod
```

2. **Find memory leaks:**
```bash
npm install -g clinic
clinic doctor -- node dist/main.js
```

3. **Optimize queries:**
```typescript
// Use lean() for read-only
.lean()

// Use select() to limit fields
.select('bulletText metadata')

// Stream large results
.cursor()
```

---

### Issue: High CPU usage

**Symptoms:**
- CPU usage > 80%
- Slow response times
- Event loop lag

**Solutions:**

1. **Profile CPU:**
```bash
npm install -g clinic
clinic flame -- node dist/main.js
```

2. **Optimize hot paths:**
- Add caching
- Batch operations
- Use async/await properly

3. **Scale horizontally:**
```bash
# Run multiple instances
docker-compose up -d --scale resume-worker=3
```

---

## WebSocket Connection Issues

### Issue: WebSocket disconnects frequently

**Symptoms:**
- Connection drops every few minutes
- "disconnect" events
- Lost messages

**Solutions:**

1. **Enable heartbeat:**
```typescript
// In gateway
@WebSocketServer()
server: Server;

ngAfterInit() {
  this.server.engine.pingInterval = 10000;
  this.server.engine.pingTimeout = 5000;
}
```

2. **Implement reconnection:**
```javascript
// Client-side
socket.on('disconnect', () => {
  setTimeout(() => socket.connect(), 1000)
})
```

3. **Check reverse proxy:**
```nginx
# Nginx config
proxy_http_version 1.1;
proxy_set_header Upgrade $http_upgrade;
proxy_set_header Connection "upgrade";
proxy_read_timeout 86400;
```

---

## Common Error Messages

### `ECONNREFUSED`
**Meaning:** Service not running or wrong port
**Solution:** Check service status and port configuration

### `ETIMEDOUT`
**Meaning:** Request timeout
**Solution:** Increase timeout or check network connectivity

### `ValidationError`
**Meaning:** Invalid input data
**Solution:** Check request body against schema

### `MongoServerError: E11000 duplicate key`
**Meaning:** Duplicate entry
**Solution:** Check for existing record or update instead of insert

### `KafkaJSError: The group coordinator is not available`
**Meaning:** Kafka consumer group issue
**Solution:** Restart Kafka or wait for rebalancing

---

## Debug Mode

Enable debug logging:

```bash
# Set log level
export LOG_LEVEL=debug

# Enable Kafka debug
export KAFKAJS_LOG_LEVEL=debug

# Enable MongoDB debug
export DEBUG=mongoose:*
```

---

## Getting Help

1. **Check logs:**
```bash
docker logs resume-worker
docker logs spacy-service
```

2. **Check metrics:**
```bash
curl http://localhost:3006/metrics
```

3. **Check health:**
```bash
curl http://localhost:3006/health
curl http://localhost:8001/health
```

4. **GitHub Issues:** [Report issues](https://github.com/yourusername/enginedge/issues)

---

**Last Updated:** November 3, 2025
**Version:** 1.0.0
