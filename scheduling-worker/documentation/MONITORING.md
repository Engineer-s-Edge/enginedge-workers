# Scheduling Worker - Monitoring & Observability

## Overview

The Scheduling Worker implements comprehensive monitoring and observability to ensure reliable operation, performance tracking, and proactive issue detection.

## Metrics Collection

### Prometheus Metrics

The service exposes Prometheus-compatible metrics at `/metrics`:

```text
# HELP scheduling_api_requests_total Total number of API requests
# TYPE scheduling_api_requests_total counter
scheduling_api_requests_total{method="GET",endpoint="/calendars",status="200"} 12543

# HELP scheduling_api_request_duration_seconds API request duration in seconds
# TYPE scheduling_api_request_duration_seconds histogram
scheduling_api_request_duration_seconds_bucket{method="POST",endpoint="/events",le="0.1"} 45
scheduling_api_request_duration_seconds_bucket{method="POST",endpoint="/events",le="0.5"} 123
scheduling_api_request_duration_seconds_bucket{method="POST",endpoint="/events",le="1.0"} 234
scheduling_api_request_duration_seconds_bucket{method="POST",endpoint="/events",le="2.0"} 345
scheduling_api_request_duration_seconds_bucket{method="POST",endpoint="/events",le="5.0"} 456
scheduling_api_request_duration_seconds_bucket{method="POST",endpoint="/events",le="+Inf"} 567
scheduling_api_request_duration_seconds_sum{method="POST",endpoint="/events"} 1234.56
scheduling_api_request_duration_seconds_count{method="POST",endpoint="/events"} 567
```

### Key Metrics

#### API Metrics
- `scheduling_api_requests_total` - Total API requests by method, endpoint, status
- `scheduling_api_request_duration_seconds` - Request duration histogram
- `scheduling_api_request_size_bytes` - Request payload size
- `scheduling_api_response_size_bytes` - Response payload size

#### Calendar Metrics
- `scheduling_calendar_sync_total` - Total calendar sync operations
- `scheduling_calendar_sync_duration_seconds` - Sync operation duration
- `scheduling_calendar_events_processed_total` - Events processed per sync
- `scheduling_calendar_api_calls_total` - Google Calendar API calls
- `scheduling_calendar_api_errors_total` - Google Calendar API errors

#### Goal & Habit Metrics
- `scheduling_goals_created_total` - Goals created
- `scheduling_goals_completed_total` - Goals completed
- `scheduling_habits_created_total` - Habits created
- `scheduling_habits_completed_total` - Habit completions
- `scheduling_habit_streaks_current` - Current habit streaks
- `scheduling_habit_reminders_sent_total` - Reminders sent

#### ML Scheduling Metrics
- `scheduling_ml_recommendations_total` - ML recommendations generated
- `scheduling_ml_recommendation_confidence` - Recommendation confidence scores
- `scheduling_ml_model_inference_duration_seconds` - ML inference time
- `scheduling_ml_training_duration_seconds` - Model training time

#### System Metrics
- `scheduling_db_connections_active` - Active database connections
- `scheduling_db_query_duration_seconds` - Database query duration
- `scheduling_redis_operations_total` - Redis operations
- `scheduling_kafka_messages_produced_total` - Kafka messages produced
- `scheduling_kafka_messages_consumed_total` - Kafka messages consumed

## Health Checks

### Endpoints

#### Basic Health Check
```http
GET /health
```

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2025-10-27T10:00:00Z",
  "uptime": 3600,
  "version": "1.0.0"
}
```

#### Readiness Check
```http
GET /health/ready
```

**Checks:**
- Database connectivity
- Redis connectivity
- Kafka connectivity
- Google Calendar API accessibility

#### Liveness Check
```http
GET /health/live
```

**Checks:**
- Memory usage within limits
- No critical errors in last 5 minutes
- Event loop not blocked

## Logging

### Log Levels

- **ERROR**: System errors, failed operations
- **WARN**: Warning conditions, retry attempts
- **INFO**: General operational messages
- **DEBUG**: Detailed debugging information

### Structured Logging

All logs use structured JSON format:

```json
{
  "timestamp": "2025-10-27T10:00:00Z",
  "level": "INFO",
  "service": "scheduling-worker",
  "component": "calendar-sync",
  "userId": "user123",
  "operation": "sync_calendar",
  "duration": 1500,
  "eventsProcessed": 25,
  "message": "Calendar sync completed successfully"
}
```

### Log Aggregation

Logs are aggregated using ELK stack:

- **Elasticsearch**: Log storage and search
- **Logstash**: Log processing and enrichment
- **Kibana**: Log visualization and dashboards

## Alerting

### Alert Rules

#### Critical Alerts
```yaml
# Database connectivity lost
- alert: SchedulingWorkerDatabaseDown
  expr: up{job="scheduling-worker"} == 0
  for: 5m
  labels:
    severity: critical
  annotations:
    summary: "Scheduling Worker database connection lost"

# High error rate
- alert: SchedulingWorkerHighErrorRate
  expr: rate(scheduling_api_requests_total{status=~"5.."}[5m]) / rate(scheduling_api_requests_total[5m]) > 0.1
  for: 5m
  labels:
    severity: critical
  annotations:
    summary: "High error rate detected"

# Calendar sync failures
- alert: SchedulingWorkerCalendarSyncFailed
  expr: increase(scheduling_calendar_api_errors_total[10m]) > 5
  for: 5m
  labels:
    severity: warning
  annotations:
    summary: "Calendar sync failures increasing"
```

#### Warning Alerts
```yaml
# High latency
- alert: SchedulingWorkerHighLatency
  expr: histogram_quantile(0.95, rate(scheduling_api_request_duration_seconds_bucket[5m])) > 5
  for: 5m
  labels:
    severity: warning
  annotations:
    summary: "API latency above threshold"

# Memory usage high
- alert: SchedulingWorkerHighMemoryUsage
  expr: process_resident_memory_bytes{job="scheduling-worker"} / process_virtual_memory_max_bytes > 0.8
  for: 5m
  labels:
    severity: warning
  annotations:
    summary: "High memory usage detected"
```

#### Info Alerts
```yaml
# Service restarted
- alert: SchedulingWorkerRestarted
  expr: increase(process_start_time_seconds{job="scheduling-worker"}[5m]) > 0
  for: 0m
  labels:
    severity: info
  annotations:
    summary: "Scheduling Worker restarted"
```

## Dashboards

### Grafana Dashboard

#### API Performance Dashboard
- Request rate over time
- Response time percentiles (P50, P95, P99)
- Error rate by endpoint
- Throughput by HTTP method

#### Calendar Sync Dashboard
- Sync operation success/failure rates
- Sync duration trends
- Events processed per sync
- Google API quota usage

#### Goal & Habit Dashboard
- Goal completion rates
- Habit streak distributions
- Reminder delivery success
- User engagement metrics

#### System Resources Dashboard
- CPU usage
- Memory usage
- Database connection pool
- Redis cache hit rates

### Custom Panels

#### Calendar Sync Status
```sql
SELECT
  time_bucket('1 hour', timestamp) AS hour,
  count(*) FILTER (WHERE status = 'success') as successful_syncs,
  count(*) FILTER (WHERE status = 'failed') as failed_syncs,
  avg(duration_ms) as avg_duration
FROM calendar_sync_logs
WHERE timestamp > now() - interval '24 hours'
GROUP BY hour
ORDER BY hour;
```

#### ML Model Performance
```sql
SELECT
  model_version,
  avg(confidence_score) as avg_confidence,
  count(*) as recommendations_count,
  avg(processing_time_ms) as avg_processing_time
FROM ml_recommendations
WHERE created_at > now() - interval '7 days'
GROUP BY model_version
ORDER BY created_at DESC;
```

## Tracing

### Distributed Tracing

The service integrates with Jaeger for distributed tracing:

```typescript
const tracer = initTracer('scheduling-worker', {
  serviceName: 'scheduling-worker'
});

// Trace API requests
app.use((req, res, next) => {
  const span = tracer.startSpan('http_request');
  span.setTag('http.method', req.method);
  span.setTag('http.url', req.url);

  res.on('finish', () => {
    span.setTag('http.status_code', res.statusCode);
    span.finish();
  });

  next();
});
```

### Trace Context

- **Request ID**: Unique identifier for each request
- **User ID**: Associated user for privacy compliance
- **Operation Type**: Type of operation being performed
- **Duration**: Time taken for operation completion

## Error Tracking

### Sentry Integration

```typescript
import * as Sentry from '@sentry/node';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
  release: process.env.npm_package_version,
  beforeSend: (event) => {
    // Sanitize sensitive data
    return event;
  }
});
```

### Error Classification

- **Critical**: System unavailable, data loss
- **Error**: Operation failed, user impact
- **Warning**: Degraded performance, potential issues
- **Info**: Notable events, successful recoveries

## Performance Monitoring

### APM (Application Performance Monitoring)

Using New Relic or DataDog for detailed performance insights:

- **Transaction Tracing**: End-to-end request tracing
- **Database Monitoring**: Query performance and optimization
- **External Service Calls**: Google Calendar API performance
- **Memory Profiling**: Memory leak detection
- **CPU Profiling**: Performance bottleneck identification

### Custom Performance Metrics

```typescript
// Calendar sync performance
const syncStart = Date.now();
try {
  await performCalendarSync();
  const duration = Date.now() - syncStart;

  performanceMetrics.record('calendar_sync_duration', duration, {
    userId,
    eventsCount
  });
} catch (error) {
  performanceMetrics.record('calendar_sync_error', 1, {
    userId,
    error: error.message
  });
}
```

## Incident Response

### Runbooks

#### Database Connection Issues
1. Check database server status
2. Verify connection string
3. Check connection pool limits
4. Restart application if needed
5. Escalate to DBA team

#### Google Calendar API Issues
1. Check API quota usage
2. Verify OAuth credentials
3. Review recent API changes
4. Implement exponential backoff
5. Contact Google support if needed

#### High Memory Usage
1. Check for memory leaks
2. Review recent deployments
3. Adjust resource limits
4. Implement garbage collection
5. Scale horizontally if needed

### Post-Mortem Process

1. **Incident Timeline**: Document when issue started and was resolved
2. **Impact Assessment**: Determine affected users and systems
3. **Root Cause Analysis**: Identify underlying cause
4. **Action Items**: Define preventive measures
5. **Follow-up**: Implement fixes and monitor

## Configuration

### Monitoring Configuration

```typescript
export const monitoringConfig = {
  prometheus: {
    port: 9090,
    path: '/metrics',
    collectDefaultMetrics: true
  },
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    format: 'json',
    destination: 'stdout'
  },
  alerting: {
    webhookUrl: process.env.ALERT_WEBHOOK_URL,
    thresholds: {
      errorRate: 0.05,
      latency95p: 5000,
      memoryUsage: 0.8
    }
  },
  tracing: {
    serviceName: 'scheduling-worker',
    jaegerEndpoint: process.env.JAEGER_ENDPOINT
  }
};
```

### Environment Variables

```bash
# Monitoring
PROMETHEUS_PORT=9090
LOG_LEVEL=info
SENTRY_DSN=https://...

# Alerting
ALERT_WEBHOOK_URL=https://hooks.slack.com/...
ALERT_EMAIL_TO=alerts@company.com

# Tracing
JAEGER_ENDPOINT=http://jaeger:14268/api/traces
```

## Best Practices

### Monitoring
1. **Define SLOs**: Service Level Objectives for availability and performance
2. **Monitor Dependencies**: Track external service health
3. **Alert on Anomalies**: Use statistical alerting for unusual patterns
4. **Keep Dashboards Current**: Regularly update monitoring dashboards

### Logging
1. **Structured Logs**: Use consistent log format across services
2. **Appropriate Levels**: Don't log sensitive data or excessive debug info
3. **Context Information**: Include relevant context in log messages
4. **Log Rotation**: Implement log rotation and retention policies

### Alerting
1. **Actionable Alerts**: Only alert on issues requiring human intervention
2. **Escalation Paths**: Define clear escalation procedures
3. **Alert Fatigue**: Avoid alert spam through proper thresholds
4. **Testing**: Regularly test alert configurations

### Observability
1. **Metrics First**: Instrument code with metrics from the start
2. **Tracing for Debugging**: Use distributed tracing for complex issues
3. **Correlation IDs**: Use request IDs to correlate logs and traces
4. **Cost Optimization**: Balance observability needs with resource costs