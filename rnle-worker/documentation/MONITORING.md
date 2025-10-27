# RNLE Worker Monitoring Guide

## Overview

The RNLE Worker implements comprehensive monitoring using Prometheus metrics, structured logging, and Grafana dashboards. This guide covers monitoring setup, key metrics, alerting rules, and troubleshooting procedures.

## Monitoring Architecture

### Components

```
RNLE Worker
    ↓
Prometheus Metrics (/metrics)
    ↓
Prometheus Server
    ↓
Grafana Dashboards + AlertManager
```

### Metrics Collection

The service exposes metrics on port 9090 at `/metrics` endpoint using the Prometheus client library.

## Key Metrics

### Application Metrics

#### Command Processing Metrics

```prometheus
# Command processing rate
rate(command_processing_total{job="rnle-worker"}[5m])

# Command processing latency (histogram)
histogram_quantile(0.95, rate(command_processing_duration_seconds_bucket{job="rnle-worker"}[5m]))

# Command processing status breakdown
sum by (status) (rate(command_processing_total{job="rnle-worker"}[5m]))

# Active command count
command_active_total{job="rnle-worker"}

# Queue depth
command_queue_depth{job="rnle-worker"}
```

#### HTTP Metrics

```prometheus
# HTTP request rate
rate(http_requests_total{job="rnle-worker"}[5m])

# HTTP request duration by endpoint
histogram_quantile(0.95, rate(http_request_duration_seconds_bucket{job="rnle-worker", route="/command/process"}[5m]))

# HTTP status codes
rate(http_requests_total{job="rnle-worker", status="200"}[5m])
rate(http_requests_total{job="rnle-worker", status=~"5.."}[5m])
```

### System Metrics

#### Resource Usage

```prometheus
# CPU usage
rate(process_cpu_user_seconds_total{job="rnle-worker"}[5m]) * 100

# Memory usage
process_resident_memory_bytes{job="rnle-worker"} / 1024 / 1024

# Heap usage
nodejs_heap_size_used_bytes{job="rnle-worker"} / nodejs_heap_size_total_bytes{job="rnle-worker"}

# Event loop lag
nodejs_eventloop_lag_seconds{job="rnle-worker"}
```

#### Garbage Collection

```prometheus
# GC duration
rate(nodejs_gc_duration_seconds_total{job="rnle-worker"}[5m])

# GC pause time
histogram_quantile(0.95, rate(nodejs_gc_pause_seconds_bucket{job="rnle-worker"}[5m]))
```

### External Service Metrics

#### Kafka Metrics

```prometheus
# Producer metrics
rate(kafka_producer_requests_total{job="rnle-worker"}[5m])
rate(kafka_producer_errors_total{job="rnle-worker"}[5m])

# Consumer metrics
kafka_consumer_group_lag{group="rnle-worker-commands"}
rate(kafka_consumer_messages_consumed_total{group="rnle-worker-commands"}[5m])

# Connection status
kafka_producer_connection_count{job="rnle-worker"}
```

#### Database Metrics

```prometheus
# Connection pool
mongodb_connections_active{job="rnle-worker"}
mongodb_connections_available{job="rnle-worker"}

# Query performance
histogram_quantile(0.95, rate(mongodb_query_duration_seconds_bucket{job="rnle-worker"}[5m]))

# Operation counts
rate(mongodb_queries_total{job="rnle-worker"}[5m])
rate(mongodb_inserts_total{job="rnle-worker"}[5m])
```

## Grafana Dashboard

### Dashboard Layout

The Grafana dashboard is organized into the following sections:

#### 1. Service Overview
- Service health status
- Active command count
- Queue depth
- Error rate overview

#### 2. Performance Metrics
- Command processing rate (RPS)
- Processing latency (P50, P95, P99)
- HTTP request latency
- Throughput trends

#### 3. System Resources
- CPU usage percentage
- Memory usage (MB)
- Network I/O
- Disk usage

#### 4. External Services
- Kafka producer/consumer metrics
- Database connection pool status
- External API response times

#### 5. Error Analysis
- Error rate by type
- Top error messages
- Error trends over time

#### 6. Business Metrics
- Commands processed by type
- Success/failure ratios
- Processing time distribution

### Dashboard Configuration

```json
{
  "dashboard": {
    "title": "RNLE Worker - Production Dashboard",
    "tags": ["rnle", "worker", "command-processing", "production"],
    "timezone": "UTC",
    "refresh": "30s",
    "time": {
      "from": "now-1h",
      "to": "now"
    }
  }
}
```

## Alerting Rules

### Critical Alerts

```yaml
groups:
  - name: rnle-worker-critical
    rules:
      - alert: RNLEWorkerDown
        expr: up{job="rnle-worker"} == 0
        for: 5m
        labels:
          severity: critical
          service: rnle-worker
        annotations:
          summary: "RNLE Worker is down"
          description: "RNLE Worker has been down for more than 5 minutes."
          runbook_url: "https://github.com/enginedge/enginedge-workers/blob/main/rnle-worker/documentation/TROUBLESHOOTING.md#service-completely-down"

      - alert: RNLEWorkerHighErrorRate
        expr: rate(command_processing_total{status="failed", job="rnle-worker"}[5m]) / rate(command_processing_total{job="rnle-worker"}[5m]) > 0.1
        for: 5m
        labels:
          severity: critical
          service: rnle-worker
        annotations:
          summary: "High command failure rate"
          description: "Command failure rate is {{ $value | printf \"%.2f\" }}% over the last 5 minutes."
          runbook_url: "https://github.com/enginedge/enginedge-workers/blob/main/rnle-worker/documentation/TROUBLESHOOTING.md#high-error-rate"
```

### Warning Alerts

```yaml
  - name: rnle-worker-warning
    rules:
      - alert: RNLEWorkerHighLatency
        expr: histogram_quantile(0.95, rate(command_processing_duration_seconds_bucket{job="rnle-worker"}[5m])) > 5
        for: 5m
        labels:
          severity: warning
          service: rnle-worker
        annotations:
          summary: "High processing latency"
          description: "P95 processing latency is {{ $value | printf \"%.2f\" }}s over the last 5 minutes."
          runbook_url: "https://github.com/enginedge/enginedge-workers/blob/main/rnle-worker/documentation/PERFORMANCE.md#high-latency"

      - alert: RNLEWorkerHighQueueDepth
        expr: command_queue_depth{job="rnle-worker"} > 100
        for: 5m
        labels:
          severity: warning
          service: rnle-worker
        annotations:
          summary: "High queue depth"
          description: "Command queue depth is {{ $value }} over the last 5 minutes."
          runbook_url: "https://github.com/enginedge/enginedge-workers/blob/main/rnle-worker/documentation/PERFORMANCE.md#high-queue-depth"

      - alert: RNLEWorkerHighMemoryUsage
        expr: process_resident_memory_bytes{job="rnle-worker"} / 1024 / 1024 > 400
        for: 10m
        labels:
          severity: warning
          service: rnle-worker
        annotations:
          summary: "High memory usage"
          description: "Memory usage is {{ $value | printf \"%.0f\" }}MB over the last 10 minutes."
          runbook_url: "https://github.com/enginedge/enginedge-workers/blob/main/rnle-worker/documentation/TROUBLESHOOTING.md#memory-usage-high"
```

### Info Alerts

```yaml
  - name: rnle-worker-info
    rules:
      - alert: RNLEWorkerLowThroughput
        expr: rate(command_processing_total{job="rnle-worker"}[15m]) < 10
        for: 30m
        labels:
          severity: info
          service: rnle-worker
        annotations:
          summary: "Low processing throughput"
          description: "Command processing rate is {{ $value | printf \"%.1f\" }} commands/minute over the last 30 minutes."

      - alert: RNLEWorkerNoActiveCommands
        expr: command_active_total{job="rnle-worker"} == 0
        for: 30m
        labels:
          severity: info
          service: rnle-worker
        annotations:
          summary: "No active commands"
          description: "No commands have been processed for the last 30 minutes."
```

## Logging

### Log Levels

- **ERROR**: Application errors, failed operations
- **WARN**: Warning conditions, retry attempts
- **INFO**: General operational messages, command processing
- **DEBUG**: Detailed debugging information

### Structured Logging

All logs follow a structured format with consistent fields:

```json
{
  "timestamp": "2024-01-15T10:30:00.000Z",
  "level": "info",
  "service": "rnle-worker",
  "workerId": "worker-pod-abc-123",
  "correlationId": "req-abc-123",
  "taskId": "assist-001",
  "message": "Command processing started",
  "metadata": {
    "taskType": "EXECUTE_ASSISTANT",
    "payloadSize": 1024
  }
}
```

### Log Aggregation

Logs are aggregated using ELK stack (Elasticsearch, Logstash, Kibana):

- **Elasticsearch**: Log storage and search
- **Logstash**: Log processing and enrichment
- **Kibana**: Log visualization and analysis

### Log Queries

```bash
# Search for errors in last hour
GET /logs-*/_search
{
  "query": {
    "bool": {
      "must": [
        { "match": { "service": "rnle-worker" } },
        { "match": { "level": "error" } },
        { "range": { "@timestamp": { "gte": "now-1h" } } }
      ]
    }
  }
}

# Command processing summary
GET /logs-*/_search
{
  "query": {
    "bool": {
      "must": [
        { "match": { "service": "rnle-worker" } },
        { "match": { "message": "Command processing completed" } }
      ]
    }
  },
  "aggs": {
    "by_task_type": {
      "terms": { "field": "metadata.taskType" }
    },
    "avg_processing_time": {
      "avg": { "field": "metadata.processingTime" }
    }
  }
}
```

## Health Checks

### Application Health

The service provides multiple health check endpoints:

#### GET /health

Basic health check:

```json
{
  "status": "ok",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "uptime": 3600,
  "version": "1.0.0"
}
```

#### GET /health/detailed

Detailed health check including dependencies:

```json
{
  "status": "ok",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "uptime": 3600,
  "version": "1.0.0",
  "checks": {
    "kafka": {
      "status": "up",
      "responseTime": 45,
      "details": {
        "brokers": 3,
        "topics": ["rnle.commands", "rnle.command-results"]
      }
    },
    "database": {
      "status": "up",
      "responseTime": 23,
      "details": {
        "connections": {
          "active": 5,
          "available": 20,
          "total": 25
        }
      }
    },
    "memory": {
      "status": "up",
      "details": {
        "used": 180,
        "total": 512,
        "percentage": 35
      }
    }
  }
}
```

### Kubernetes Probes

```yaml
livenessProbe:
  httpGet:
    path: /health
    port: 3001
  initialDelaySeconds: 30
  periodSeconds: 10
  timeoutSeconds: 5
  failureThreshold: 3

readinessProbe:
  httpGet:
    path: /health
    port: 3001
  initialDelaySeconds: 5
  periodSeconds: 5
  timeoutSeconds: 3
  failureThreshold: 3

startupProbe:
  httpGet:
    path: /health
    port: 3001
  initialDelaySeconds: 10
  periodSeconds: 10
  timeoutSeconds: 5
  failureThreshold: 30
```

## Performance Benchmarks

### Baseline Metrics

| Metric | Value | Target | Status |
|--------|-------|--------|--------|
| P95 Latency | <500ms | <1s | ✅ |
| Error Rate | <1% | <5% | ✅ |
| CPU Usage | <50% | <70% | ✅ |
| Memory Usage | <256MB | <512MB | ✅ |
| Queue Depth | <50 | <100 | ✅ |

### Load Testing Results

**Test Scenario:** 100 concurrent users, 1000 commands/minute

| Metric | Result | Threshold |
|--------|--------|-----------|
| Average Latency | 245ms | <500ms |
| P95 Latency | 450ms | <1s |
| Error Rate | 0.2% | <1% |
| CPU Usage | 65% | <80% |
| Memory Usage | 320MB | <512MB |
| Throughput | 980 cmd/min | >900 cmd/min |

## Troubleshooting with Metrics

### High Latency Investigation

1. **Check System Resources:**
```prometheus
# CPU saturation
rate(process_cpu_user_seconds_total{job="rnle-worker"}[5m]) > 0.8

# Memory pressure
process_resident_memory_bytes{job="rnle-worker"} / 1024 / 1024 > 400

# Network saturation
rate(process_io_read_bytes_total{job="rnle-worker"}[5m]) > 10485760
```

2. **Check External Dependencies:**
```prometheus
# Kafka lag
kafka_consumer_group_lag{group="rnle-worker-commands"} > 100

# Database slow queries
histogram_quantile(0.95, rate(mongodb_query_duration_seconds_bucket{job="rnle-worker"}[5m])) > 1
```

3. **Check Application Bottlenecks:**
```prometheus
# Queue buildup
command_queue_depth{job="rnle-worker"} > 50

# Thread pool exhaustion
nodejs_active_handles_total{job="rnle-worker"} > 100
```

### Memory Leak Detection

1. **Monitor Heap Growth:**
```prometheus
# Heap size trend
increase(nodejs_heap_size_used_bytes{job="rnle-worker"}[1h])

# GC frequency
rate(nodejs_gc_duration_seconds_total{job="rnle-worker"}[5m])
```

2. **Profile Memory Usage:**
```bash
# Generate heap snapshot
kubectl exec -it <pod-name> -n enginedge-workers -- node --inspect --heap-snapshot

# Analyze with Chrome DevTools
# Open chrome://inspect and analyze heap snapshot
```

### Error Pattern Analysis

1. **Categorize Errors:**
```prometheus
# Errors by type
sum by (error_type) (rate(command_processing_total{status="failed", job="rnle-worker"}[5m]))

# HTTP errors by status
rate(http_requests_total{status=~"5..", job="rnle-worker"}[5m])
```

2. **Correlate with Logs:**
```bash
# Find error logs with correlation IDs
kubectl logs deployment/rnle-worker -n enginedge-workers | grep "correlationId.*error"
```

## Monitoring Best Practices

### Alert Fatigue Prevention

1. **Alert Grouping:** Group related alerts to reduce noise
2. **Alert Escalation:** Use different severity levels appropriately
3. **Auto-Resolution:** Configure alerts to auto-resolve when conditions clear

### Dashboard Organization

1. **Role-Based Views:** Different dashboards for different user roles
2. **Time-Based Analysis:** Support for historical trend analysis
3. **Comparative Views:** Compare metrics across different time periods

### Metric Naming Conventions

```prometheus
# Format: namespace_subsystem_metric_name
rnle_worker_command_processing_total{status="success"}
rnle_worker_http_request_duration_seconds_bucket{le="0.1"}
rnle_worker_kafka_consumer_lag
```

### Documentation Updates

- Update metric definitions when adding new metrics
- Document alert conditions and thresholds
- Maintain runbook URLs in alert annotations
- Review and update dashboards quarterly

## Integration with Other Tools

### APM Integration (Application Performance Monitoring)

```typescript
// New Relic integration
import newrelic from 'newrelic';

@Injectable()
export class MonitoringService {
  recordCommandProcessing(taskId: string, duration: number, status: string) {
    newrelic.recordCustomEvent('CommandProcessing', {
      taskId,
      duration,
      status,
      timestamp: Date.now()
    });
  }
}
```

### Log Correlation

```typescript
@Injectable()
export class CorrelationService {
  private correlationId: string;

  startCorrelation() {
    this.correlationId = uuidv4();
    // Set in async local storage or continuation-local-storage
  }

  getCorrelationId(): string {
    return this.correlationId;
  }
}
```

This comprehensive monitoring setup ensures the RNLE Worker operates reliably with full observability into its performance, health, and behavior.