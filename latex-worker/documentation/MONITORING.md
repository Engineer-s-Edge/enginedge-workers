# LaTeX Worker - Monitoring & Error Tracking

## Prometheus Metrics

The LaTeX worker exposes metrics at `http://localhost:3005/metrics` in Prometheus format.

### Available Metrics

#### Compilation Metrics

**latex_compilation_duration_seconds** (Histogram)
- Description: Duration of LaTeX compilations in seconds
- Labels: `document_type`, `success`
- Buckets: 0.5, 1, 2, 5, 10, 30, 60 seconds
- Use: Track compilation performance, identify slow documents

**latex_compilation_total** (Counter)
- Description: Total number of LaTeX compilations
- Labels: `document_type`
- Use: Track overall compilation volume

**latex_compilation_success_total** (Counter)
- Description: Total number of successful compilations
- Labels: `document_type`
- Use: Calculate success rate

**latex_compilation_error_total** (Counter)
- Description: Total number of failed compilations
- Labels: `document_type`, `error_type`
- Use: Track error patterns and types

#### Queue Metrics

**latex_queue_depth** (Gauge)
- Description: Number of jobs waiting in queue
- Use: Monitor backlog, trigger scaling decisions

**latex_active_jobs** (Gauge)
- Description: Number of currently processing jobs
- Use: Monitor concurrency, detect deadlocks

#### Error Metrics

**latex_errors_by_type_total** (Counter)
- Description: Errors categorized by type
- Labels: `error_type`, `error_category`
- Use: Identify most common error patterns

#### Performance Metrics

**latex_package_cache_hits_total** (Counter)
- Description: Package cache hits
- Use: Monitor cache effectiveness

**latex_package_cache_misses_total** (Counter)
- Description: Package cache misses
- Use: Monitor cache effectiveness

**latex_compilation_steps_total** (Counter)
- Description: Compilation steps (multi-pass)
- Labels: `pass_type`
- Use: Track multi-pass compilation frequency

#### Resource Metrics

**latex_memory_usage_bytes** (Gauge)
- Description: Current memory usage in bytes
- Use: Monitor memory consumption, prevent OOM

**latex_cpu_usage_percent** (Gauge)
- Description: Current CPU usage percentage
- Use: Monitor CPU load

**process_cpu_seconds_total** (Counter)
- Description: Total CPU time consumed
- Use: Calculate CPU usage rate

---

## Grafana Dashboard

Import `documentation/grafana-dashboard.json` into Grafana.

### Dashboard Panels

1. **Compilation Success Rate** (Stat)
   - Shows: Current success rate percentage
   - Thresholds: Red (<80%), Yellow (80-95%), Green (>95%)

2. **Queue Depth** (Gauge)
   - Shows: Current queue depth
   - Thresholds: Green (<50), Yellow (50-80), Red (>80)

3. **Active Jobs** (Stat)
   - Shows: Currently processing jobs
   - Thresholds: Green (<5), Yellow (5-10), Red (>10)

4. **Total Compilations** (Stat)
   - Shows: Compilations per minute (5m rate)

5. **Compilation Duration** (Graph)
   - Shows: p50, p95, p99 latencies
   - Y-axis: Seconds

6. **Compilation Rate by Document Type** (Graph)
   - Shows: Compilations/sec by type
   - Stacked area chart

7. **Error Rate by Type** (Graph)
   - Shows: Errors/sec by error type
   - Line graph

8. **Package Cache Hit Rate** (Stat)
   - Shows: Cache effectiveness percentage
   - Thresholds: Red (<70%), Yellow (70-90%), Green (>90%)

9. **Memory Usage** (Graph)
   - Shows: Heap memory usage over time
   - Y-axis: Bytes

10. **Compilation Steps** (Graph)
    - Shows: Multi-pass compilation frequency
    - By pass type (xelatex, bibtex, etc.)

11. **CPU Usage** (Graph)
    - Shows: CPU percentage over time
    - Max: 100%

12. **Error Distribution** (Pie Chart)
    - Shows: Errors by category (1h window)

13. **Average Compilation Time** (Table)
    - Shows: Avg duration by document type

---

## Prometheus Alerts

Load `documentation/prometheus-alerts.yml` into Prometheus.

### Critical Alerts

**LatexCriticalErrorRate**
- Trigger: Error rate > 25% for 2 minutes
- Action: Check logs, investigate root cause immediately

**LatexCriticalQueueDepth**
- Trigger: Queue depth > 100 for 2 minutes
- Action: Scale up workers, check for processing issues

**LatexVerySlowCompilations**
- Trigger: p95 latency > 30s for 2 minutes
- Action: Check system resources, investigate slow documents

**LatexCriticalMemoryUsage**
- Trigger: Memory > 1.8GB for 2 minutes
- Action: Restart pod, investigate memory leak

**LatexWorkerDown**
- Trigger: Service unreachable for 1 minute
- Action: Check pod status, review logs

**LatexPodRestartLoop**
- Trigger: Pod restarting repeatedly
- Action: Check crash logs, review resource limits

### Warning Alerts

**LatexHighErrorRate**
- Trigger: Error rate > 10% for 5 minutes
- Action: Monitor, investigate if persists

**LatexHighQueueDepth**
- Trigger: Queue depth > 50 for 5 minutes
- Action: Consider scaling, monitor trend

**LatexSlowCompilations**
- Trigger: p95 latency > 10s for 5 minutes
- Action: Check resource availability

**LatexLowCacheHitRate**
- Trigger: Cache hit rate < 70% for 10 minutes
- Action: Review cache configuration

**LatexHighMemoryUsage**
- Trigger: Memory > 1.5GB for 5 minutes
- Action: Monitor, prepare to scale if needed

**LatexNoCompilations**
- Trigger: No compilations for 15 minutes
- Action: Check Kafka connectivity, verify traffic

**LatexHighActiveJobs**
- Trigger: >10 active jobs for 10 minutes
- Action: Check for deadlocks, review job processing

**LatexErrorTypeSpike**
- Trigger: Specific error type > 0.5/sec for 3 minutes
- Action: Investigate error cause

---

## Structured Logging

All logs are output in JSON format to stdout for easy parsing by logging aggregators.

### Log Format

```json
{
  "timestamp": "2025-10-27T10:30:45.123Z",
  "level": "info",
  "context": "LaTeXCompilerService",
  "message": "Compilation completed successfully",
  "jobId": "abc-123",
  "userId": "user-456",
  "documentType": "resume",
  "duration": 1250,
  "event": "compilation.success"
}
```

### Log Levels

- **fatal**: Unrecoverable errors (process will exit)
- **error**: Compilation failures, exceptions
- **warn**: Performance warnings, deprecated usage
- **log**: Normal operations (compilations, cache hits)
- **debug**: Detailed execution flow (set `LOG_LEVEL=debug`)
- **verbose**: Very detailed (internal state, set `LOG_LEVEL=verbose`)

### Event Types

**compilation.started**
- When: Job begins processing
- Fields: `jobId`, `userId`, `documentType`

**compilation.success**
- When: Compilation completes successfully
- Fields: `jobId`, `userId`, `documentType`, `duration`

**compilation.error**
- When: Compilation fails
- Fields: `jobId`, `userId`, `documentType`, `duration`, `errorType`, `error` (stack trace)

**package.installation**
- When: LaTeX package installed
- Fields: `packageName`, `success`, `duration`

**cache.access**
- When: Cache hit/miss
- Fields: `cacheType`, `hit`, `key`

**performance.warning**
- When: Operation exceeds threshold
- Fields: `operation`, `duration`, `threshold`

### Query Examples (CloudWatch Insights)

**Find all compilation errors:**
```
fields @timestamp, jobId, userId, errorType, message
| filter event = "compilation.error"
| sort @timestamp desc
```

**Average compilation time by document type:**
```
fields documentType, duration
| filter event = "compilation.success"
| stats avg(duration) by documentType
```

**Cache hit rate:**
```
fields @timestamp, hit
| filter event = "cache.access"
| stats count(hit) as hits, count() as total
| fields hits / total * 100 as hit_rate
```

---

## Error Monitoring

### Error Categories

1. **COMPILATION_ERROR** - LaTeX syntax/compilation errors
2. **UNDEFINED_COMMAND** - Unknown LaTeX command
3. **MISSING_PACKAGE** - Required package not installed
4. **MISSING_FILE** - File referenced but not found
5. **TIMEOUT** - Compilation exceeded time limit
6. **MEMORY_LIMIT** - Out of memory during compilation
7. **INVALID_REQUEST** - Malformed API request
8. **UNAUTHORIZED** - Authentication failed
9. **NOT_FOUND** - Resource not found
10. **INTERNAL_ERROR** - Unexpected server error

### Error Response Format

```json
{
  "success": false,
  "errors": [
    {
      "line": 42,
      "message": "Undefined control sequence: \\unknowncommand",
      "severity": "error",
      "type": "UNDEFINED_COMMAND"
    }
  ],
  "errorCode": "COMPILATION_ERROR",
  "timestamp": "2025-10-27T10:30:45.123Z"
}
```

### Common Error Patterns

**Pattern: "Undefined control sequence"**
- Cause: Typo or missing package
- Fix: Verify command spelling, add required package
- Alert: LatexErrorTypeSpike (if >0.5/sec)

**Pattern: "File not found"**
- Cause: Missing include/input file
- Fix: Ensure all files uploaded with project
- Alert: LatexErrorTypeSpike

**Pattern: "Timeout"**
- Cause: Document too complex, infinite loop
- Fix: Simplify document, increase timeout
- Alert: LatexSlowCompilations

**Pattern: "Out of memory"**
- Cause: Large images, complex rendering
- Fix: Compress images, increase memory limit
- Alert: LatexCriticalMemoryUsage

---

## Health Checks

**Liveness Probe**
- Endpoint: `GET /health`
- Interval: 10 seconds
- Timeout: 5 seconds
- Failure threshold: 3

**Readiness Probe**
- Endpoint: `GET /health`
- Interval: 5 seconds
- Timeout: 3 seconds
- Failure threshold: 3

**Health Response**

```json
{
  "status": "ok",
  "timestamp": "2025-10-27T10:30:45.123Z",
  "uptime": 123456,
  "memory": {
    "heapUsed": 150000000,
    "heapTotal": 200000000,
    "external": 5000000
  },
  "checks": {
    "kafka": "ok",
    "mongodb": "ok",
    "xelatex": "ok"
  }
}
```

---

## Monitoring Best Practices

1. **Set up alerts for all critical metrics**
   - Error rate, queue depth, latency, memory

2. **Monitor trends, not just thresholds**
   - Gradual degradation may not trigger alerts

3. **Correlate metrics with logs**
   - Use jobId/userId to trace end-to-end

4. **Review dashboards daily**
   - Check for anomalies, optimization opportunities

5. **Test alerts in staging**
   - Ensure alerts fire correctly

6. **Document incident responses**
   - Build runbooks for common issues

7. **Track SLOs**
   - 95% success rate
   - p95 latency < 5s
   - Queue depth < 20

8. **Optimize based on data**
   - Use cache hit rate to tune cache size
   - Use latency data to identify slow patterns
