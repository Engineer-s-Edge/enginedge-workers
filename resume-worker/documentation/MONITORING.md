# Resume Worker Monitoring

## Overview

The Resume Worker exposes comprehensive Prometheus metrics for monitoring service health, performance, and business metrics. This document describes all available metrics, alerting rules, and Grafana dashboards.

## Metrics Endpoint

```
GET http://localhost:3006/metrics
```

Returns Prometheus-formatted metrics.

---

## Business Metrics

### Resume Evaluations

#### `resume_evaluations_total`
**Type:** Counter  
**Description:** Total number of resume evaluations  
**Labels:**
- `mode` - Evaluation mode (standalone, role-guided, jd-match)
- `status` - Result status (success, failure)

```promql
# Rate of evaluations per second
rate(resume_evaluations_total[5m])

# Success rate
rate(resume_evaluations_total{status="success"}[5m]) / rate(resume_evaluations_total[5m])
```

---

#### `resume_evaluation_duration_seconds`
**Type:** Histogram  
**Description:** Duration of resume evaluations  
**Labels:**
- `mode` - Evaluation mode
**Buckets:** 0.5, 1, 2, 5, 10, 30, 60

```promql
# P95 evaluation duration
histogram_quantile(0.95, rate(resume_evaluation_duration_seconds_bucket[5m]))

# Average duration by mode
rate(resume_evaluation_duration_seconds_sum[5m]) / rate(resume_evaluation_duration_seconds_count[5m])
```

---

#### `resume_evaluation_score`
**Type:** Gauge  
**Description:** Latest evaluation score (0-100)  
**Labels:**
- `resume_id` - Resume identifier
- `mode` - Evaluation mode

```promql
# Average evaluation score
avg(resume_evaluation_score)

# Resumes below threshold
count(resume_evaluation_score < 80)
```

---

### Bullet Point Evaluations

#### `bullet_evaluations_total`
**Type:** Counter  
**Description:** Total number of bullet point evaluations  
**Labels:**
- `passed` - Whether bullet passed quality checks (true, false)
- `mode` - Evaluation mode (nlp-only, llm-assisted)

```promql
# Pass rate
rate(bullet_evaluations_total{passed="true"}[5m]) / rate(bullet_evaluations_total[5m])
```

---

#### `bullet_evaluation_score`
**Type:** Histogram  
**Description:** Bullet point quality scores (0-1)  
**Buckets:** 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0

```promql
# Distribution of scores
histogram_quantile(0.5, rate(bullet_evaluation_score_bucket[5m]))
```

---

### Experience Bank

#### `experience_bank_operations_total`
**Type:** Counter  
**Description:** Total experience bank operations  
**Labels:**
- `operation` - Operation type (add, search, list, update)
- `status` - Result status (success, failure)

```promql
# Operations per second
rate(experience_bank_operations_total[5m])

# Search operations
rate(experience_bank_operations_total{operation="search"}[5m])
```

---

#### `experience_bank_search_duration_seconds`
**Type:** Histogram  
**Description:** Duration of experience bank searches  
**Buckets:** 0.01, 0.05, 0.1, 0.5, 1, 2, 5

```promql
# P95 search latency
histogram_quantile(0.95, rate(experience_bank_search_duration_seconds_bucket[5m]))
```

---

#### `experience_bank_items_total`
**Type:** Gauge  
**Description:** Total number of items in experience bank  
**Labels:**
- `user_id` - User identifier
- `reviewed` - Review status (true, false)

```promql
# Total items
sum(experience_bank_items_total)

# Reviewed items percentage
sum(experience_bank_items_total{reviewed="true"}) / sum(experience_bank_items_total)
```

---

### Resume Tailoring

#### `tailoring_jobs_total`
**Type:** Counter  
**Description:** Total tailoring jobs  
**Labels:**
- `status` - Job status (queued, processing, completed, failed, cancelled)
- `mode` - Tailoring mode (auto, manual)

```promql
# Job completion rate
rate(tailoring_jobs_total{status="completed"}[5m]) / rate(tailoring_jobs_total[5m])

# Failed jobs
rate(tailoring_jobs_total{status="failed"}[5m])
```

---

#### `tailoring_job_duration_seconds`
**Type:** Histogram  
**Description:** Duration of tailoring jobs  
**Labels:**
- `mode` - Tailoring mode
**Buckets:** 10, 30, 60, 120, 300, 600

```promql
# Average job duration
rate(tailoring_job_duration_seconds_sum[5m]) / rate(tailoring_job_duration_seconds_count[5m])
```

---

#### `tailoring_job_iterations`
**Type:** Histogram  
**Description:** Number of iterations per job  
**Buckets:** 1, 2, 3, 5, 10, 20

```promql
# Average iterations
rate(tailoring_job_iterations_sum[5m]) / rate(tailoring_job_iterations_count[5m])
```

---

#### `tailoring_job_score_improvement`
**Type:** Histogram  
**Description:** Score improvement (final - initial)  
**Buckets:** 0, 5, 10, 15, 20, 30, 50

```promql
# Average improvement
rate(tailoring_job_score_improvement_sum[5m]) / rate(tailoring_job_score_improvement_count[5m])
```

---

### Job Posting Extraction

#### `job_posting_extractions_total`
**Type:** Counter  
**Description:** Total job posting extractions  
**Labels:**
- `mode` - Extraction mode (nlp-only, llm-assisted)
- `status` - Result status (success, failure)

```promql
# Extraction rate
rate(job_posting_extractions_total[5m])
```

---

#### `job_posting_extraction_confidence`
**Type:** Histogram  
**Description:** Extraction confidence scores (0-1)  
**Buckets:** 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0

```promql
# Average confidence
rate(job_posting_extraction_confidence_sum[5m]) / rate(job_posting_extraction_confidence_count[5m])
```

---

### Cover Letters

#### `cover_letter_generations_total`
**Type:** Counter  
**Description:** Total cover letter generations  
**Labels:**
- `tone` - Letter tone (professional, casual, enthusiastic)
- `length` - Letter length (short, medium, long)

```promql
# Generations per second
rate(cover_letter_generations_total[5m])
```

---

## Technical Metrics

### HTTP Requests

#### `http_requests_total`
**Type:** Counter  
**Description:** Total HTTP requests  
**Labels:**
- `method` - HTTP method (GET, POST, PATCH, DELETE)
- `route` - Request route
- `status_code` - HTTP status code

```promql
# Request rate
rate(http_requests_total[5m])

# Error rate (5xx)
rate(http_requests_total{status_code=~"5.."}[5m])

# Request rate by endpoint
sum by (route) (rate(http_requests_total[5m]))
```

---

#### `http_request_duration_seconds`
**Type:** Histogram  
**Description:** HTTP request duration  
**Labels:**
- `method` - HTTP method
- `route` - Request route
**Buckets:** 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10

```promql
# P95 latency
histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))

# P99 latency by endpoint
histogram_quantile(0.99, sum by (route, le) (rate(http_request_duration_seconds_bucket[5m])))
```

---

### WebSocket Connections

#### `websocket_connections_active`
**Type:** Gauge  
**Description:** Active WebSocket connections  
**Labels:**
- `namespace` - WebSocket namespace (resume-iterator, bullet-review, resume-builder)

```promql
# Active connections
sum(websocket_connections_active)

# Connections by namespace
sum by (namespace) (websocket_connections_active)
```

---

#### `websocket_messages_total`
**Type:** Counter  
**Description:** Total WebSocket messages  
**Labels:**
- `namespace` - WebSocket namespace
- `direction` - Message direction (inbound, outbound)
- `event` - Event type

```promql
# Message rate
rate(websocket_messages_total[5m])

# Messages by event type
sum by (event) (rate(websocket_messages_total[5m]))
```

---

### Kafka Integration

#### `kafka_messages_produced_total`
**Type:** Counter  
**Description:** Total Kafka messages produced  
**Labels:**
- `topic` - Kafka topic

```promql
# Production rate
rate(kafka_messages_produced_total[5m])

# Messages by topic
sum by (topic) (rate(kafka_messages_produced_total[5m]))
```

---

#### `kafka_messages_consumed_total`
**Type:** Counter  
**Description:** Total Kafka messages consumed  
**Labels:**
- `topic` - Kafka topic
- `consumer_group` - Consumer group

```promql
# Consumption rate
rate(kafka_messages_consumed_total[5m])
```

---

#### `kafka_consumer_lag`
**Type:** Gauge  
**Description:** Consumer lag per topic  
**Labels:**
- `topic` - Kafka topic
- `partition` - Partition number

```promql
# Total lag
sum(kafka_consumer_lag)

# Lag by topic
sum by (topic) (kafka_consumer_lag)
```

---

### Database Operations

#### `mongodb_operations_total`
**Type:** Counter  
**Description:** Total MongoDB operations  
**Labels:**
- `operation` - Operation type (find, insert, update, delete)
- `collection` - Collection name

```promql
# Operations per second
rate(mongodb_operations_total[5m])

# Operations by collection
sum by (collection) (rate(mongodb_operations_total[5m]))
```

---

#### `mongodb_operation_duration_seconds`
**Type:** Histogram  
**Description:** MongoDB operation duration  
**Labels:**
- `operation` - Operation type
- `collection` - Collection name
**Buckets:** 0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 5

```promql
# P95 query latency
histogram_quantile(0.95, rate(mongodb_operation_duration_seconds_bucket[5m]))
```

---

### BullMQ Job Queue

#### `bullmq_jobs_total`
**Type:** Counter  
**Description:** Total BullMQ jobs  
**Labels:**
- `queue` - Queue name
- `status` - Job status (completed, failed, delayed, active)

```promql
# Job completion rate
rate(bullmq_jobs_total{status="completed"}[5m])

# Failed jobs
rate(bullmq_jobs_total{status="failed"}[5m])
```

---

#### `bullmq_job_duration_seconds`
**Type:** Histogram  
**Description:** Job processing duration  
**Labels:**
- `queue` - Queue name
**Buckets:** 1, 5, 10, 30, 60, 120, 300

```promql
# Average job duration
rate(bullmq_job_duration_seconds_sum[5m]) / rate(bullmq_job_duration_seconds_count[5m])
```

---

#### `bullmq_queue_size`
**Type:** Gauge  
**Description:** Current queue size  
**Labels:**
- `queue` - Queue name
- `state` - Job state (waiting, active, delayed)

```promql
# Total queue size
sum(bullmq_queue_size)

# Waiting jobs
sum(bullmq_queue_size{state="waiting"})
```

---

## System Metrics

### Node.js Process

#### `nodejs_heap_size_total_bytes`
**Type:** Gauge  
**Description:** Total heap size

#### `nodejs_heap_size_used_bytes`
**Type:** Gauge  
**Description:** Used heap size

#### `nodejs_external_memory_bytes`
**Type:** Gauge  
**Description:** External memory usage

#### `nodejs_eventloop_lag_seconds`
**Type:** Gauge  
**Description:** Event loop lag

```promql
# Heap usage percentage
(nodejs_heap_size_used_bytes / nodejs_heap_size_total_bytes) * 100

# Event loop lag
nodejs_eventloop_lag_seconds
```

---

## Grafana Dashboards

### Main Dashboard

**File:** `grafana-dashboard.json`

**Panels:**
1. **Overview**
   - Total evaluations
   - Active tailoring jobs
   - Experience bank size
   - Success rate

2. **Performance**
   - P95 evaluation latency
   - P95 search latency
   - HTTP request rate
   - Error rate

3. **Business Metrics**
   - Evaluations per hour
   - Average evaluation score
   - Bullet pass rate
   - Job completion rate

4. **System Health**
   - CPU usage
   - Memory usage
   - Event loop lag
   - Kafka consumer lag

5. **Queue Status**
   - BullMQ queue size
   - Job processing rate
   - Failed jobs
   - Average job duration

---

## Alerting Rules

**File:** `prometheus-alerts.yml`

### Critical Alerts

1. **High Error Rate**
   - Condition: Error rate > 5% for 5 minutes
   - Severity: Critical

2. **High Evaluation Latency**
   - Condition: P95 latency > 30s for 5 minutes
   - Severity: Critical

3. **Kafka Consumer Lag**
   - Condition: Lag > 1000 messages for 10 minutes
   - Severity: Critical

4. **Service Down**
   - Condition: No metrics for 2 minutes
   - Severity: Critical

### Warning Alerts

1. **High Queue Size**
   - Condition: Queue size > 100 for 10 minutes
   - Severity: Warning

2. **Low Success Rate**
   - Condition: Success rate < 95% for 15 minutes
   - Severity: Warning

3. **High Memory Usage**
   - Condition: Memory usage > 80% for 10 minutes
   - Severity: Warning

---

## Query Examples

### Business KPIs

```promql
# Daily evaluations
sum(increase(resume_evaluations_total[24h]))

# Average evaluation score
avg(resume_evaluation_score)

# Bullet pass rate
sum(rate(bullet_evaluations_total{passed="true"}[1h])) / sum(rate(bullet_evaluations_total[1h]))

# Job success rate
sum(rate(tailoring_jobs_total{status="completed"}[1h])) / sum(rate(tailoring_jobs_total[1h]))
```

### Performance Monitoring

```promql
# P95 API latency
histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))

# Slow endpoints (>1s)
topk(10, histogram_quantile(0.95, sum by (route, le) (rate(http_request_duration_seconds_bucket[5m]))))

# Error rate by endpoint
sum by (route) (rate(http_requests_total{status_code=~"5.."}[5m]))
```

### Capacity Planning

```promql
# Request rate trend
predict_linear(http_requests_total[1h], 3600 * 24)

# Queue growth rate
deriv(bullmq_queue_size[10m])

# Memory growth rate
deriv(nodejs_heap_size_used_bytes[1h])
```

---

## Best Practices

1. **Set up alerts** for critical metrics
2. **Monitor trends** over time for capacity planning
3. **Track business KPIs** alongside technical metrics
4. **Use dashboards** for at-a-glance health checks
5. **Set SLOs** for key metrics (e.g., P95 latency < 5s)
6. **Review metrics regularly** to identify optimization opportunities

---

**Last Updated:** November 3, 2025  
**Version:** 1.0.0  
**Prometheus Version:** 2.45+
