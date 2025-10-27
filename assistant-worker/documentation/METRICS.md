# Assistant Worker - Metrics & Monitoring

## Table of Contents

- [Overview](#overview)
- [Metrics Endpoint](#metrics-endpoint)
- [Available Metrics](#available-metrics)
- [Prometheus Integration](#prometheus-integration)
- [Grafana Dashboards](#grafana-dashboards)
- [Alerting Rules](#alerting-rules)
- [Custom Metrics](#custom-metrics)

---

## Overview

The Assistant Worker exposes comprehensive metrics in **Prometheus format** for monitoring performance, health, and business KPIs. All metrics follow Prometheus naming conventions and best practices.

### Key Features

- ✅ **Prometheus-compatible format**
- ✅ **80+ metrics exposed**
- ✅ **Request/response tracking**
- ✅ **Agent execution metrics**
- ✅ **Memory operation metrics**
- ✅ **Knowledge graph metrics**
- ✅ **System resource metrics**

---

## Metrics Endpoint

### Accessing Metrics

```bash
# Get all metrics
curl http://localhost:3001/metrics

# Get specific metric (filter with grep)
curl http://localhost:3001/metrics | grep agent_executions
```

### Response Format

```prometheus
# HELP agent_executions_total Total number of agent executions
# TYPE agent_executions_total counter
agent_executions_total{agent_type="react",status="success"} 145
agent_executions_total{agent_type="react",status="error"} 3
agent_executions_total{agent_type="graph",status="success"} 89

# HELP agent_execution_duration_seconds Agent execution duration in seconds
# TYPE agent_execution_duration_seconds histogram
agent_execution_duration_seconds_bucket{agent_type="react",le="1"} 45
agent_execution_duration_seconds_bucket{agent_type="react",le="5"} 120
agent_execution_duration_seconds_bucket{agent_type="react",le="10"} 145
```

---

## Available Metrics

### Agent Execution Metrics

#### `agent_executions_total`
**Type:** Counter  
**Description:** Total number of agent executions  
**Labels:**
- `agent_type` - Type of agent (react, graph, expert, genius, collective, manager)
- `status` - Execution status (success, error, aborted)
- `user_id` - User identifier

**Example:**
```prometheus
agent_executions_total{agent_type="react",status="success",user_id="user123"} 145
```

#### `agent_execution_duration_seconds`
**Type:** Histogram  
**Description:** Duration of agent execution  
**Labels:**
- `agent_type` - Type of agent
- `user_id` - User identifier

**Buckets:** 0.5, 1, 2, 5, 10, 30, 60, 120 seconds

**Example:**
```prometheus
agent_execution_duration_seconds_bucket{agent_type="graph",le="5"} 78
agent_execution_duration_seconds_sum{agent_type="graph"} 234.5
agent_execution_duration_seconds_count{agent_type="graph"} 89
```

#### `agent_streaming_duration_seconds`
**Type:** Histogram  
**Description:** Duration of streaming executions  
**Labels:**
- `agent_type` - Type of agent
- `user_id` - User identifier

#### `agent_token_count_total`
**Type:** Counter  
**Description:** Total tokens processed (input + output)  
**Labels:**
- `agent_type` - Type of agent
- `token_type` - Token type (input, output)

**Example:**
```prometheus
agent_token_count_total{agent_type="react",token_type="input"} 12450
agent_token_count_total{agent_type="react",token_type="output"} 34780
```

---

### Memory Metrics

#### `memory_operations_total`
**Type:** Counter  
**Description:** Total memory operations  
**Labels:**
- `operation` - Operation type (add, get, clear, search)
- `memory_type` - Memory type (buffer, window, summary, vector, entity)
- `status` - Operation status (success, error)

**Example:**
```prometheus
memory_operations_total{operation="add",memory_type="buffer",status="success"} 456
```

#### `memory_operation_duration_seconds`
**Type:** Histogram  
**Description:** Duration of memory operations  
**Labels:**
- `operation` - Operation type
- `memory_type` - Memory type

**Buckets:** 0.01, 0.05, 0.1, 0.5, 1, 5 seconds

#### `memory_size_bytes`
**Type:** Gauge  
**Description:** Current size of memory in bytes  
**Labels:**
- `conversation_id` - Conversation identifier
- `memory_type` - Memory type

**Example:**
```prometheus
memory_size_bytes{conversation_id="conv_123",memory_type="buffer"} 15840
```

#### `memory_message_count`
**Type:** Gauge  
**Description:** Number of messages in memory  
**Labels:**
- `conversation_id` - Conversation identifier
- `memory_type` - Memory type

---

### Knowledge Graph Metrics

#### `knowledge_graph_operations_total`
**Type:** Counter  
**Description:** Total knowledge graph operations  
**Labels:**
- `operation` - Operation type (create_node, create_edge, query, traverse)
- `status` - Operation status (success, error)

**Example:**
```prometheus
knowledge_graph_operations_total{operation="create_node",status="success"} 234
```

#### `knowledge_graph_operation_duration_seconds`
**Type:** Histogram  
**Description:** Duration of KG operations  
**Labels:**
- `operation` - Operation type

**Buckets:** 0.01, 0.05, 0.1, 0.5, 1, 5 seconds

#### `knowledge_graph_node_count`
**Type:** Gauge  
**Description:** Total number of nodes in graph  
**Labels:**
- `layer` - ICS layer (L1-L6)
- `type` - Node type

**Example:**
```prometheus
knowledge_graph_node_count{layer="L1_OBSERVATIONS",type="concept"} 156
```

#### `knowledge_graph_edge_count`
**Type:** Gauge  
**Description:** Total number of edges in graph  
**Labels:**
- `relationship_type` - Type of relationship

---

### HTTP Metrics

#### `http_requests_total`
**Type:** Counter  
**Description:** Total HTTP requests  
**Labels:**
- `method` - HTTP method (GET, POST, DELETE, etc.)
- `path` - Request path
- `status` - HTTP status code

**Example:**
```prometheus
http_requests_total{method="POST",path="/agents/:id/execute",status="200"} 145
```

#### `http_request_duration_seconds`
**Type:** Histogram  
**Description:** HTTP request duration  
**Labels:**
- `method` - HTTP method
- `path` - Request path

**Buckets:** 0.01, 0.05, 0.1, 0.5, 1, 5, 10 seconds

#### `http_request_size_bytes`
**Type:** Histogram  
**Description:** HTTP request body size  
**Labels:**
- `method` - HTTP method

#### `http_response_size_bytes`
**Type:** Histogram  
**Description:** HTTP response body size  
**Labels:**
- `method` - HTTP method

---

### System Metrics

#### `process_cpu_seconds_total`
**Type:** Counter  
**Description:** Total CPU time consumed by the process

#### `process_resident_memory_bytes`
**Type:** Gauge  
**Description:** Resident memory size in bytes

#### `process_heap_bytes`
**Type:** Gauge  
**Description:** Heap memory size in bytes

#### `nodejs_eventloop_lag_seconds`
**Type:** Gauge  
**Description:** Event loop lag in seconds

#### `nodejs_active_handles`
**Type:** Gauge  
**Description:** Number of active handles

#### `nodejs_active_requests`
**Type:** Gauge  
**Description:** Number of active requests

---

### Business Metrics

#### `agent_success_rate`
**Type:** Gauge  
**Description:** Success rate of agent executions (0-1)  
**Labels:**
- `agent_type` - Type of agent

**Calculated:** `success_count / total_count`

#### `agent_average_response_time_seconds`
**Type:** Gauge  
**Description:** Average response time per agent type  
**Labels:**
- `agent_type` - Type of agent

#### `active_agents_count`
**Type:** Gauge  
**Description:** Number of currently active agents

#### `active_conversations_count`
**Type:** Gauge  
**Description:** Number of active conversations

---

## Prometheus Integration

### Prometheus Configuration

Add the Assistant Worker as a scrape target in `prometheus.yml`:

```yaml
scrape_configs:
  - job_name: 'assistant-worker'
    scrape_interval: 15s
    scrape_timeout: 10s
    metrics_path: '/metrics'
    static_configs:
      - targets: ['assistant-worker:3001']
        labels:
          service: 'assistant-worker'
          environment: 'production'
```

### Kubernetes Service Monitor

For Kubernetes with Prometheus Operator:

```yaml
apiVersion: monitoring.coreos.com/v1
kind: ServiceMonitor
metadata:
  name: assistant-worker
  labels:
    app: assistant-worker
spec:
  selector:
    matchLabels:
      app: assistant-worker
  endpoints:
    - port: http
      path: /metrics
      interval: 15s
```

---

## Grafana Dashboards

### Dashboard Template

Here's a sample Grafana dashboard configuration:

```json
{
  "dashboard": {
    "title": "Assistant Worker Metrics",
    "panels": [
      {
        "title": "Agent Executions per Second",
        "targets": [
          {
            "expr": "rate(agent_executions_total[5m])"
          }
        ]
      },
      {
        "title": "Agent Execution Duration (p95)",
        "targets": [
          {
            "expr": "histogram_quantile(0.95, rate(agent_execution_duration_seconds_bucket[5m]))"
          }
        ]
      },
      {
        "title": "Memory Operations Rate",
        "targets": [
          {
            "expr": "rate(memory_operations_total[5m])"
          }
        ]
      }
    ]
  }
}
```

### Key Dashboards to Create

1. **Overview Dashboard**
   - Total requests per second
   - Error rate
   - Average response time
   - Active agents

2. **Agent Performance Dashboard**
   - Executions by agent type
   - Duration percentiles (p50, p95, p99)
   - Success rate
   - Token usage

3. **Memory Dashboard**
   - Operations per second
   - Memory size by conversation
   - Operation duration
   - Error rate

4. **Knowledge Graph Dashboard**
   - Node/edge count over time
   - Operations per second
   - Query duration
   - Graph depth metrics

5. **System Health Dashboard**
   - CPU usage
   - Memory usage
   - Event loop lag
   - Active handles/requests

---

## Alerting Rules

### Critical Alerts

```yaml
groups:
  - name: assistant_worker_critical
    rules:
      # High error rate
      - alert: HighErrorRate
        expr: rate(agent_executions_total{status="error"}[5m]) > 0.1
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "High agent execution error rate"
          description: "Error rate is {{ $value }} errors/sec"

      # High response time
      - alert: HighResponseTime
        expr: histogram_quantile(0.95, rate(agent_execution_duration_seconds_bucket[5m])) > 30
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High agent execution duration"
          description: "P95 duration is {{ $value }} seconds"

      # Memory leak
      - alert: MemoryLeak
        expr: rate(process_resident_memory_bytes[15m]) > 1000000
        for: 15m
        labels:
          severity: warning
        annotations:
          summary: "Possible memory leak detected"
          description: "Memory growing at {{ $value }} bytes/sec"
```

### Warning Alerts

```yaml
groups:
  - name: assistant_worker_warnings
    rules:
      # High event loop lag
      - alert: HighEventLoopLag
        expr: nodejs_eventloop_lag_seconds > 0.1
        for: 2m
        labels:
          severity: warning
        annotations:
          summary: "High event loop lag"
          description: "Event loop lag is {{ $value }} seconds"

      # Low success rate
      - alert: LowSuccessRate
        expr: agent_success_rate < 0.95
        for: 10m
        labels:
          severity: warning
        annotations:
          summary: "Agent success rate below 95%"
          description: "Success rate is {{ $value }}"
```

---

## Custom Metrics

### Adding Custom Metrics

To add custom metrics to the Assistant Worker:

1. **Create Metric in Service**

```typescript
import { Counter, Histogram, Gauge } from 'prom-client';

// Counter example
private readonly customOperationCounter = new Counter({
  name: 'custom_operation_total',
  help: 'Total custom operations',
  labelNames: ['operation_type', 'status']
});

// Increment counter
this.customOperationCounter.inc({ 
  operation_type: 'my_operation', 
  status: 'success' 
});
```

2. **Histogram Example**

```typescript
private readonly customDurationHistogram = new Histogram({
  name: 'custom_operation_duration_seconds',
  help: 'Duration of custom operations',
  labelNames: ['operation_type'],
  buckets: [0.1, 0.5, 1, 5, 10]
});

// Measure duration
const end = this.customDurationHistogram.startTimer({ 
  operation_type: 'my_operation' 
});
// ... do work ...
end();
```

3. **Gauge Example**

```typescript
private readonly customQueueSize = new Gauge({
  name: 'custom_queue_size',
  help: 'Current size of custom queue',
  labelNames: ['queue_name']
});

// Set gauge value
this.customQueueSize.set({ queue_name: 'processing' }, 42);
```

---

## Querying Metrics

### Common Prometheus Queries

#### Request Rate
```promql
# Requests per second
rate(http_requests_total[5m])

# By endpoint
rate(http_requests_total{path="/agents/:id/execute"}[5m])
```

#### Error Rate
```promql
# Error rate
rate(agent_executions_total{status="error"}[5m]) / 
rate(agent_executions_total[5m])
```

#### Percentiles
```promql
# p50 (median)
histogram_quantile(0.50, rate(agent_execution_duration_seconds_bucket[5m]))

# p95
histogram_quantile(0.95, rate(agent_execution_duration_seconds_bucket[5m]))

# p99
histogram_quantile(0.99, rate(agent_execution_duration_seconds_bucket[5m]))
```

#### Memory Usage
```promql
# Total memory by memory type
sum(memory_size_bytes) by (memory_type)

# Average memory per conversation
avg(memory_size_bytes) by (memory_type)
```

---

## Best Practices

### Metric Naming

✅ **DO:**
- Use snake_case: `agent_execution_duration_seconds`
- Include units in name: `_seconds`, `_bytes`, `_total`
- Use descriptive labels: `agent_type="react"`

❌ **DON'T:**
- Use camelCase: `agentExecutionDuration`
- Omit units: `agent_execution_duration`
- Create high-cardinality labels (e.g., `user_id` with millions of values)

### Label Cardinality

- Keep label cardinality low (< 10 unique values per label)
- Avoid user-specific labels in high-traffic metrics
- Use separate metrics for high-cardinality data

### Performance Considerations

- Metrics collection adds ~1-2ms overhead per request
- Histogram buckets should cover expected value ranges
- Limit number of active metrics (< 10,000)

---

## Integration with README

Here's how you can include metrics information in your README:

```markdown
## 📊 Metrics & Monitoring

The Assistant Worker exposes Prometheus-compatible metrics:

**Metrics Endpoint:**
\`\`\`bash
curl http://localhost:3001/metrics
\`\`\`

**Key Metrics:**
- \`agent_executions_total\` - Total executions by type and status
- \`agent_execution_duration_seconds\` - Execution duration (histogram)
- \`memory_operations_total\` - Memory operations counter
- \`knowledge_graph_operations_total\` - KG operations counter
- \`http_requests_total\` - HTTP request counter

**Example Query:**
\`\`\`promql
# Agent execution rate
rate(agent_executions_total[5m])

# p95 execution duration
histogram_quantile(0.95, rate(agent_execution_duration_seconds_bucket[5m]))
\`\`\`

For complete metrics documentation, see [METRICS.md](documentation/METRICS.md).
```

---

## Summary

The Assistant Worker provides comprehensive metrics for:

- ✅ **Performance Monitoring** - Track execution times and throughput
- ✅ **Error Tracking** - Monitor error rates and types
- ✅ **Resource Usage** - CPU, memory, and event loop metrics
- ✅ **Business KPIs** - Agent usage, success rates, token consumption
- ✅ **Alerting** - Define alerts based on metric thresholds

**Next Steps:**
1. Configure Prometheus to scrape `/metrics`
2. Create Grafana dashboards
3. Set up alerting rules
4. Monitor and tune based on metrics

For implementation details, see the metrics controller in `src/infrastructure/controllers/metrics.controller.ts`.

