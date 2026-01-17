# Identity Worker - Metrics & Monitoring

## Table of Contents

- [Overview](#overview)
- [Metrics Endpoint](#metrics-endpoint)
- [Available Metrics](#available-metrics)
- [Prometheus Integration](#prometheus-integration)
- [Grafana Dashboards](#grafana-dashboards)
- [Alerting Rules](#alerting-rules)

---

## Overview

The Identity Worker exposes comprehensive metrics in **Prometheus format** for monitoring performance, health, and business KPIs.

### Key Features

- ✅ **Prometheus-compatible format**
- ✅ **Authentication metrics**
- ✅ **OAuth operation metrics**
- ✅ **User management metrics**
- ✅ **System resource metrics**

---

## Metrics Endpoint

### Accessing Metrics

```bash
# Get all metrics
curl http://localhost:3008/metrics

# Get specific metric (filter with grep)
curl http://localhost:3008/metrics | grep auth_operations
```

---

## Available Metrics

### Authentication Metrics

#### `auth_operations_total`
**Type:** Counter
**Description:** Total authentication operations
**Labels:**
- `operation` - Operation type (login, register, refresh, revoke)
- `status` - Operation status (success, error)

**Example:**
```prometheus
auth_operations_total{operation="login",status="success"} 145
auth_operations_total{operation="login",status="error"} 3
```

#### `auth_operation_duration_seconds`
**Type:** Histogram
**Description:** Duration of authentication operations
**Labels:**
- `operation` - Operation type

**Buckets:** 0.01, 0.05, 0.1, 0.5, 1, 5 seconds

---

### OAuth Metrics

#### `oauth_operations_total`
**Type:** Counter
**Description:** Total OAuth operations
**Labels:**
- `operation` - Operation type (auth_url, callback, unlink)
- `provider` - OAuth provider (google, github, etc.)
- `status` - Operation status (success, error)

#### `oauth_operation_duration_seconds`
**Type:** Histogram
**Description:** Duration of OAuth operations

---

### User Management Metrics

#### `user_operations_total`
**Type:** Counter
**Description:** Total user operations
**Labels:**
- `operation` - Operation type (create, read, update, delete)
- `status` - Operation status (success, error)

#### `user_operation_duration_seconds`
**Type:** Histogram
**Description:** Duration of user operations

---

### HTTP Metrics

#### `http_requests_total`
**Type:** Counter
**Description:** Total HTTP requests
**Labels:**
- `method` - HTTP method
- `route` - Route path
- `code` - HTTP status code

#### `http_request_duration_seconds`
**Type:** Histogram
**Description:** HTTP request duration

---

### System Metrics

#### `process_cpu_user_seconds_total`
**Type:** Counter
**Description:** Total CPU user time

#### `process_resident_memory_bytes`
**Type:** Gauge
**Description:** Resident memory usage in bytes

---

## Prometheus Integration

### Prometheus Configuration

Add to `prometheus.yml`:

```yaml
scrape_configs:
  - job_name: 'identity-worker'
    scrape_interval: 15s
    static_configs:
      - targets: ['localhost:3008']
```

---

## Grafana Dashboards

Import dashboard from `documentation/grafana-dashboard.json`

---

## Alerting Rules

See `documentation/prometheus-alerts.yml` for alerting rules.
