# Phase 8 Load Testing

This directory contains load testing scripts for the Phase 8 RAG pipeline integration.

## 📋 Test Coverage

- **Document Processing**: POST /documents/process-for-rag
- **Vector Search**: POST /vector-store/search-conversations
- **RAG Pipeline**: End-to-end search flow
- **Kafka Message Throughput**: Message processing under load
- **Health Checks**: Service availability monitoring

## 🛠️ Tools

### k6 (Recommended)
High-performance load testing tool written in Go.

**Installation:**
```bash
# Windows (via Chocolatey)
choco install k6

# macOS
brew install k6

# Linux
sudo apt-get install k6
```

**Run Tests:**
```bash
# Basic run
k6 run phase8-rag-load-test.js

# Custom duration
k6 run --duration 5m phase8-rag-load-test.js

# More VUs
k6 run --vus 100 phase8-rag-load-test.js

# Custom endpoints
k6 run -e BASE_URL=http://prod-assistant:3002 phase8-rag-load-test.js
```

### Artillery (Alternative)
Simple YAML-based load testing.

**Installation:**
```bash
npm install -g artillery
```

**Run Tests:**
```bash
artillery run phase8-rag-artillery.yml
artillery run --target http://prod:3003 phase8-rag-artillery.yml
```

## 📊 Test Scenarios

### Scenario 1: Steady Load (Default)
- Ramp up: 10 VUs over 30s
- Sustain: 10 VUs for 2 minutes
- Spike: 50 VUs for 30s
- Ramp down: 0 VUs over 30s

### Scenario 2: Stress Test
```bash
k6 run --vus 200 --duration 5m phase8-rag-load-test.js
```

### Scenario 3: Soak Test
```bash
k6 run --vus 50 --duration 1h phase8-rag-load-test.js
```

## 🎯 Performance Targets

| Metric | Target | Threshold |
|--------|--------|-----------|
| **Document Processing** | < 3s (p95) | < 5s (p99) |
| **Vector Search** | < 1.5s (p95) | < 2.5s (p99) |
| **RAG Search** | < 2s (p95) | < 3s (p99) |
| **Error Rate** | < 1% | < 5% |
| **Throughput** | 100 req/s | 50 req/s |

## 📈 Metrics Collected

### k6 Metrics
- `http_req_duration`: HTTP request latency
- `http_req_failed`: Failed request rate
- `rag_search_duration`: RAG search latency
- `document_process_duration`: Document processing time
- `vector_search_duration`: Vector search time
- `rag_search_errors`: RAG search error count
- `document_process_errors`: Document processing errors

### Prometheus Metrics (from services)
- `rag_search_duration_seconds`: RAG search histogram
- `rag_search_count`: Total RAG searches
- `dlq_messages_total`: Dead letter queue messages
- `kafka_messages_total`: Kafka messages processed
- `data_processing_requests_total`: Data processing requests

## 🔍 Monitoring During Tests

### Prometheus Queries
```promql
# RAG search latency (p95)
histogram_quantile(0.95, rate(rag_search_duration_seconds_bucket[5m]))

# Document processing rate
rate(data_processing_requests_total{endpoint="/documents/process-for-rag"}[1m])

# Error rate
rate(http_requests_total{status=~"5.."}[1m]) / rate(http_requests_total[1m])

# DLQ growth
rate(dlq_messages_total[5m])
```

### Grafana Dashboards
- Phase 8 RAG Pipeline Performance
- Kafka Message Throughput
- DLQ Monitoring
- Data Processing Worker Health

## 🚨 Test Validation

### Pre-test Checklist
- [ ] All services running (Assistant Worker, Data Processing Worker)
- [ ] Kafka broker accessible
- [ ] Prometheus scraping metrics
- [ ] Database connections healthy
- [ ] Vector store initialized

### Post-test Analysis
1. Check k6 summary output
2. Review Prometheus metrics
3. Inspect DLQ for failed messages
4. Analyze service logs for errors
5. Validate data consistency

## 🐛 Troubleshooting

### Common Issues

**Connection Refused:**
```bash
# Check services are running
curl http://localhost:3002/health
curl http://localhost:3003/health
```

**High Error Rate:**
- Check service logs: `docker logs assistant-worker`
- Review DLQ messages in Kafka
- Verify database capacity

**Slow Performance:**
- Monitor Prometheus metrics
- Check Kafka lag: `kafka-consumer-groups --describe`
- Review vector store performance

## 📝 Test Results Template

```markdown
## Load Test Results - [Date]

**Configuration:**
- VUs: 50
- Duration: 5 minutes
- Target: http://localhost:3002

**Results:**
- Requests: 15,234 total
- Success Rate: 98.7%
- p95 Latency: 1.2s
- p99 Latency: 2.1s
- Throughput: 50.78 req/s

**Errors:**
- Document Processing: 34 (0.5%)
- Vector Search: 12 (0.2%)
- RAG Search: 8 (0.1%)

**DLQ Messages:** 54 total
- TimeoutError: 32
- ValidationError: 22

**Recommendations:**
- Increase Kafka partitions for better throughput
- Optimize vector search index
- Add caching for frequent queries
```

## 🔗 Related Documentation
- [PHASE_8_QUICK_REFERENCE.md](../../migration/PHASE_8_QUICK_REFERENCE.md)
- [WORKER_MIGRATION_CHECKLISTS.md](../../migration/WORKER_MIGRATION_CHECKLISTS.md)
- [Prometheus Metrics Guide](../docs/monitoring.md)
