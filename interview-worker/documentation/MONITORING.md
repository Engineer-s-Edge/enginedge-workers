# Interview Worker - Monitoring

## Overview

The Interview Worker implements comprehensive monitoring using Prometheus metrics, Grafana dashboards, and alerting rules. This document describes the monitoring setup and key metrics to track.

## Metrics Collection

### Application Metrics

#### HTTP Metrics
```
http_requests_total{path="/api/v1/interviews", method="POST", status="200"} 1250
http_request_duration_seconds{path="/api/v1/interviews", method="GET", quantile="0.95"} 0.15
http_requests_in_flight{path="/api/v1/interviews"} 3
```

#### Interview Processing Metrics
```
interview_processing_total{status="success"} 980
interview_processing_total{status="failed"} 20
interview_processing_duration_seconds{quantile="0.95"} 25.5
interviews_active_total 12
```

#### Transcription Metrics
```
transcription_requests_total{provider="google", status="success"} 850
transcription_duration_seconds{provider="google", quantile="0.95"} 3.2
transcription_confidence_score{provider="google", quantile="0.95"} 0.92
```

#### Analysis Metrics
```
analysis_requests_total{type="sentiment", provider="openai", status="success"} 720
analysis_duration_seconds{type="competency", provider="anthropic", quantile="0.95"} 8.5
analysis_confidence_score{type="overall", quantile="0.95"} 0.88
```

#### Scheduling Metrics
```
scheduling_requests_total{status="success"} 650
scheduling_duration_seconds{quantile="0.95"} 2.1
calendar_api_calls_total{provider="google", status="success"} 3200
```

### System Metrics

#### Resource Usage
```
process_cpu_usage 0.45
process_memory_usage_bytes 650000000
nodejs_heap_size_used_bytes 450000000
nodejs_heap_size_total_bytes 800000000
process_open_fds 125
process_max_fds 1024
```

#### Database Metrics
```
mongodb_connections_active{type="primary"} 15
mongodb_connections_available 35
mongodb_op_counters_total{type="query"} 12500
mongodb_op_counters_total{type="insert"} 850
mongodb_op_counters_total{type="update"} 420
```

#### Cache Metrics
```
redis_connected_clients 25
redis_keyspace_hits_total 45000
redis_keyspace_misses_total 1200
redis_memory_used_bytes 150000000
redis_evicted_keys_total 150
```

#### External API Metrics
```
external_api_requests_total{service="openai", endpoint="/v1/chat/completions", status="200"} 2800
external_api_duration_seconds{service="google_speech", quantile="0.95"} 2.8
external_api_errors_total{service="anthropic"} 12
```

## Grafana Dashboards

### Production Dashboard

The main dashboard provides real-time visibility into:
- Service health and availability
- Interview processing throughput
- Error rates and latency percentiles
- Resource utilization trends
- External service dependencies

#### Key Panels

**Service Overview:**
- Service uptime and health status
- Active interview sessions
- Processing queue length
- Error rate trends

**Performance Metrics:**
- API response time percentiles (p50, p95, p99)
- Interview processing duration
- Transcription latency
- Analysis completion time

**Resource Monitoring:**
- CPU and memory usage
- Database connection pools
- Cache hit rates
- Network I/O

**External Dependencies:**
- AI service response times
- Speech API performance
- Calendar integration status
- Message queue throughput

### Detailed Dashboards

#### Interview Processing Dashboard
- Interview lifecycle tracking
- Processing stage breakdowns
- Success/failure rates by type
- Queue depth and processing rates

#### AI Analysis Dashboard
- Model performance by provider
- Token usage and costs
- Analysis accuracy metrics
- Fallback mechanism usage

#### Transcription Dashboard
- Real-time vs batch processing
- Audio quality metrics
- Provider comparison
- Error recovery rates

## Alerting Rules

### Critical Alerts (P1)

#### Service Down
```yaml
alert: InterviewWorkerDown
expr: up{job="interview-worker"} == 0
for: 5m
labels:
  severity: critical
annotations:
  summary: "Interview Worker is down"
  description: "Interview Worker has been down for more than 5 minutes"
```

#### High Error Rate
```yaml
alert: InterviewWorkerCriticalErrorRate
expr: rate(http_requests_total{job="interview-worker", status=~"5.."}[5m]) / rate(http_requests_total{job="interview-worker"}[5m]) > 0.25
for: 5m
labels:
  severity: critical
annotations:
  summary: "Critical error rate"
  description: "HTTP 5xx error rate is {{ $value | printf "%.2f" }}%"
```

#### Database Connection Failure
```yaml
alert: InterviewWorkerDatabaseDown
expr: mongodb_connections_active{job="interview-worker-mongodb"} == 0
for: 2m
labels:
  severity: critical
annotations:
  summary: "Database connection lost"
  description: "No active database connections"
```

### Warning Alerts (P2)

#### High Latency
```yaml
alert: InterviewWorkerHighLatency
expr: histogram_quantile(0.95, rate(http_request_duration_seconds_bucket{job="interview-worker"}[5m])) > 5
for: 10m
labels:
  severity: warning
annotations:
  summary: "High API latency"
  description: "95th percentile response time is {{ $value | printf "%.2f" }}s"
```

#### Resource Saturation
```yaml
alert: InterviewWorkerHighMemoryUsage
expr: process_memory_usage_bytes{job="interview-worker"} / 1024 / 1024 > 900
for: 10m
labels:
  severity: warning
annotations:
  summary: "High memory usage"
  description: "Memory usage is {{ $value | printf "%.0f" }}MB"
```

#### External Service Issues
```yaml
alert: InterviewWorkerAIServiceDown
expr: rate(external_api_requests_total{job="interview-worker", service="openai", status!="200"}[5m]) / rate(external_api_requests_total{job="interview-worker", service="openai"}[5m]) > 0.5
for: 5m
labels:
  severity: warning
annotations:
  summary: "AI service issues"
  description: "OpenAI API error rate is {{ $value | printf "%.2f" }}%"
```

### Info Alerts (P3)

#### Performance Degradation
```yaml
alert: InterviewWorkerSlowProcessing
expr: histogram_quantile(0.95, rate(interview_processing_duration_seconds_bucket{job="interview-worker"}[5m])) > 60
for: 15m
labels:
  severity: info
annotations:
  summary: "Slow interview processing"
  description: "Interview processing taking longer than expected"
```

## Logging

### Log Levels
- **ERROR:** Application errors, failed operations
- **WARN:** Performance issues, retry attempts
- **INFO:** Normal operations, state changes
- **DEBUG:** Detailed operation tracing

### Structured Logging
All logs follow structured format:
```json
{
  "timestamp": "2024-01-01T00:00:00Z",
  "level": "INFO",
  "service": "interview-worker",
  "component": "interview-service",
  "operation": "createInterview",
  "interviewId": "interview-123",
  "userId": "user-456",
  "duration": 150,
  "status": "success",
  "message": "Interview created successfully"
}
```

### Log Aggregation
- Logs collected by Fluentd
- Indexed in Elasticsearch
- Visualized in Kibana
- Retention: 90 days

## Health Checks

### Application Health
```http
GET /health
```
Response:
```json
{
  "status": "ok",
  "timestamp": "2024-01-01T00:00:00Z",
  "version": "1.0.0",
  "uptime": 3600,
  "checks": {
    "database": "ok",
    "redis": "ok",
    "kafka": "ok",
    "external_apis": "ok"
  }
}
```

### Dependency Health
- **Database:** Connection pool status, query performance
- **Redis:** Connection status, memory usage
- **Kafka:** Producer/consumer health, lag monitoring
- **External APIs:** Response times, error rates

## Tracing

### Distributed Tracing
- OpenTelemetry integration
- Jaeger for trace visualization
- Trace sampling: 10% of requests

### Key Traces
- Interview creation flow
- Transcription processing
- AI analysis pipeline
- Scheduling operations

## Metrics Export

### Prometheus Configuration
```yaml
scrape_configs:
  - job_name: 'interview-worker'
    static_configs:
      - targets: ['interview-worker:3001']
    metrics_path: '/metrics'
    scrape_interval: 15s

  - job_name: 'interview-worker-mongodb'
    static_configs:
      - targets: ['mongodb-exporter:9216']
    scrape_interval: 30s
```

### Custom Metrics
```typescript
// Interview processing metrics
const interviewProcessingDuration = new Histogram({
  name: 'interview_processing_duration_seconds',
  help: 'Duration of interview processing',
  labelNames: ['status', 'type'],
  buckets: [1, 5, 10, 30, 60, 120, 300]
});

// External API metrics
const externalApiDuration = new Histogram({
  name: 'external_api_duration_seconds',
  help: 'Duration of external API calls',
  labelNames: ['service', 'endpoint', 'status'],
  buckets: [0.1, 0.5, 1, 2, 5, 10, 30]
});
```

## Monitoring Best Practices

### Alert Fatigue Prevention
- Use appropriate alert thresholds
- Implement alert silencing during maintenance
- Regular alert review and tuning
- Escalation policies for different severity levels

### Dashboard Organization
- Separate dashboards for different audiences
- Consistent color schemes and layouts
- Clear labeling and documentation
- Regular dashboard maintenance

### Metric Naming Conventions
```
{component}_{metric}_{unit}
interview_processing_duration_seconds
external_api_requests_total
mongodb_connections_active
redis_memory_used_bytes
```

### SLO/SLI Tracking
- **Availability:** 99.9% uptime
- **Latency:** p95 < 500ms for APIs
- **Error Rate:** < 1% for critical operations
- **Data Freshness:** < 5 minutes for analytics

## Troubleshooting with Monitoring

### High Error Rate Investigation
1. Check error logs in Kibana
2. Review error metrics in Grafana
3. Examine traces in Jaeger
4. Check external service status
5. Review recent deployments

### Performance Degradation
1. Check resource usage dashboards
2. Review slow query logs
3. Analyze trace spans
4. Check cache hit rates
5. Monitor external API performance

### Incident Response
1. Acknowledge alert in monitoring system
2. Gather relevant metrics and logs
3. Create incident ticket
4. Communicate with stakeholders
5. Implement fix and monitor recovery

## Continuous Improvement

### Regular Reviews
- Weekly metric reviews
- Monthly dashboard updates
- Quarterly alerting rule tuning
- Annual monitoring strategy review

### Automation
- Automated alert remediation
- Predictive scaling based on metrics
- Automated dashboard generation
- Continuous monitoring configuration

### Documentation
- Keep runbooks current
- Document alert responses
- Maintain metric definitions
- Update troubleshooting guides