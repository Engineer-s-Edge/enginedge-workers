# resume Worker Troubleshooting Guide

## Overview

This guide provides systematic troubleshooting procedures for common issues encountered with the resume Worker. Issues are categorized by severity and include diagnostic steps, solutions, and prevention measures.

## Quick Health Check

### Service Status Check

```bash
# Check if service is running
curl -f http://localhost:3001/health

# Check detailed health status
curl http://localhost:3001/health | jq .

# Check Kubernetes pod status
kubectl get pods -n enginedge-workers -l app=resume-worker

# Check service logs
kubectl logs -f deployment/resume-worker -n enginedge-workers --tail=100
```

### Key Metrics to Monitor

```bash
# Command processing rate
curl http://localhost:9090/metrics | grep command_processing_total

# Error rate
curl http://localhost:9090/metrics | grep "status=\"failed\""

# Queue depth
curl http://localhost:9090/metrics | grep command_queue_depth

# System resources
curl http://localhost:9090/metrics | grep "process_"
```

## Critical Issues

### 1. Service Completely Down

**Symptoms:**
- Health endpoint returns 503 or connection refused
- No response to any API calls
- Pod status shows CrashLoopBackOff or Error

**Diagnostic Steps:**

1. **Check Pod Status:**
```bash
kubectl describe pod <pod-name> -n enginedge-workers
kubectl logs <pod-name> -n enginedge-workers --previous
```

2. **Verify Environment Variables:**
```bash
kubectl exec -it <pod-name> -n enginedge-workers -- env | grep -E "(PORT|KAFKA|MONGODB)"
```

3. **Check Dependencies:**
```bash
# Test Kafka connectivity
kubectl exec -it <pod-name> -n enginedge-workers -- nc -zv kafka-service 9092

# Test MongoDB connectivity
kubectl exec -it <pod-name> -n enginedge-workers -- mongosh mongodb://$MONGODB_URI --eval "db.runCommand('ping')"
```

**Common Causes & Solutions:**

| Cause | Solution |
|-------|----------|
| Invalid environment variables | Check ConfigMap and Secret values |
| Database connection failure | Verify MongoDB credentials and network policies |
| Kafka broker unreachable | Check Kafka cluster status and network connectivity |
| Insufficient resources | Increase memory/CPU limits or scale horizontally |
| Application crash | Check application logs for stack traces |

**Emergency Recovery:**
```bash
# Restart deployment
kubectl rollout restart deployment/resume-worker -n enginedge-workers

# Scale down and up
kubectl scale deployment resume-worker --replicas=0 -n enginedge-workers
kubectl scale deployment resume-worker --replicas=3 -n enginedge-workers

# Force recreate pods
kubectl delete pods -l app=resume-worker -n enginedge-workers
```

### 2. High Error Rate (>5%)

**Symptoms:**
- Increased 5xx HTTP status codes
- Command processing failures
- Alert triggers for error rate

**Diagnostic Steps:**

1. **Check Error Logs:**
```bash
kubectl logs -f deployment/resume-worker -n enginedge-workers | grep ERROR
```

2. **Analyze Error Patterns:**
```bash
# Check error distribution by type
curl http://localhost:9090/metrics | grep "command_processing_total" | grep "failed"

# Check HTTP error codes
curl http://localhost:9090/metrics | grep "http_requests_total" | grep "status="
```

3. **Database Issues:**
```bash
# Check MongoDB connection pool
kubectl exec -it <pod-name> -n enginedge-workers -- mongosh --eval "db.serverStatus().connections"

# Check for database locks
kubectl exec -it <pod-name> -n enginedge-workers -- mongosh --eval "db.currentOp()"
```

**Common Causes & Solutions:**

| Cause | Solution |
|-------|----------|
| Database connection pool exhausted | Increase connection pool size or add more instances |
| Invalid command payloads | Add input validation and error handling |
| External service failures | Implement circuit breakers and retry logic |
| Resource constraints | Scale vertically or horizontally |
| Code bugs | Review recent deployments and rollback if necessary |

### 3. High Latency (>500ms P95)

**Symptoms:**
- Slow response times
- Timeout errors
- User experience degradation

**Diagnostic Steps:**

1. **Check Latency Metrics:**
```bash
# P95 latency
curl http://localhost:9090/metrics | grep "command_processing_duration_seconds" | grep "quantile=\"0.95\""

# HTTP request duration
curl http://localhost:9090/metrics | grep "http_request_duration_seconds"
```

2. **Profile Application:**
```bash
# Enable profiling
kubectl exec -it <pod-name> -n enginedge-workers -- node --prof -- node dist/main.js

# Check event loop lag
curl http://localhost:9090/metrics | grep eventloop
```

3. **Database Performance:**
```bash
# Check slow queries
kubectl exec -it <pod-name> -n enginedge-workers -- mongosh --eval "db.system.profile.find().sort({ts: -1}).limit(5)"

# Check index usage
kubectl exec -it <pod-name> -n enginedge-workers -- mongosh --eval "db.commands.getIndexes()"
```

**Optimization Steps:**

1. **Database Optimization:**
```javascript
// Add missing indexes
db.commands.createIndex({ taskType: 1, createdAt: -1 });
db.commands.createIndex({ status: 1, updatedAt: -1 });
```

2. **Application Optimization:**
```typescript
// Implement caching
@Injectable()
export class CachedCommandService {
  @UseInterceptors(CacheInterceptor)
  async getCommand(taskId: string): Promise<Command> {
    // Cached implementation
  }
}
```

3. **Infrastructure Scaling:**
```bash
# Horizontal scaling
kubectl scale deployment resume-worker --replicas=5 -n enginedge-workers

# Vertical scaling
kubectl patch deployment resume-worker -n enginedge-workers --type='json' -p='[{"op": "replace", "path": "/spec/template/spec/containers/0/resources/limits/cpu", "value": "1000m"}]'
```

## Warning Issues

### 4. High Queue Depth

**Symptoms:**
- Increasing command queue depth
- Processing lag
- Delayed command execution

**Diagnostic Steps:**

1. **Check Queue Metrics:**
```bash
curl http://localhost:9090/metrics | grep queue_depth
```

2. **Monitor Processing Rate:**
```bash
# Commands processed per second
curl http://localhost:9090/metrics | grep "rate(command_processing_total"
```

3. **Check Consumer Lag:**
```bash
# Kafka consumer lag
kubectl exec -it kafka-pod -- kafka-consumer-groups --describe --group resume-worker-group
```

**Solutions:**

1. **Scale Processing Capacity:**
```bash
# Increase replica count
kubectl scale deployment resume-worker --replicas=5 -n enginedge-workers
```

2. **Optimize Processing:**
```typescript
// Implement batch processing
@Injectable()
export class BatchCommandProcessor {
  async processBatch(commands: Command[]): Promise<CommandResult[]> {
    // Process multiple commands concurrently
    return Promise.all(commands.map(cmd => this.processCommand(cmd)));
  }
}
```

### 5. Memory Usage High

**Symptoms:**
- Memory usage >80% of limits
- Frequent garbage collection
- Out of memory errors

**Diagnostic Steps:**

1. **Check Memory Metrics:**
```bash
curl http://localhost:9090/metrics | grep "process_resident_memory_bytes"
```

2. **Memory Profiling:**
```bash
# Generate heap snapshot
kubectl exec -it <pod-name> -n enginedge-workers -- node --inspect --heap-snapshot
```

3. **Check Connection Pools:**
```bash
# MongoDB connections
kubectl exec -it <pod-name> -n enginedge-workers -- mongosh --eval "db.serverStatus().connections"
```

**Solutions:**

1. **Memory Leak Detection:**
```typescript
// Add memory monitoring
import * as memwatch from 'memwatch-next';

memwatch.on('leak', (info) => {
  this.logger.error('Memory leak detected', info);
});
```

2. **Optimize Data Structures:**
```typescript
// Use streams for large data processing
import { Readable } from 'stream';

export class StreamingCommandProcessor {
  async processLargeCommand(command: Command): Promise<CommandResult> {
    const stream = this.createDataStream(command.payload);
    return this.processStream(stream);
  }
}
```

### 6. Kafka Connection Issues

**Symptoms:**
- Message publishing failures
- Consumer lag increasing
- Connection timeout errors

**Diagnostic Steps:**

1. **Check Kafka Metrics:**
```bash
curl http://localhost:9090/metrics | grep kafka
```

2. **Test Connectivity:**
```bash
# Test broker connectivity
kubectl exec -it <pod-name> -n enginedge-workers -- nc -zv kafka-service 9092

# Check Kafka cluster status
kubectl exec -it kafka-pod -- kafka-broker-api-versions --bootstrap-server localhost:9092
```

3. **Check Consumer Group:**
```bash
kubectl exec -it kafka-pod -- kafka-consumer-groups --describe --group resume-worker-group --bootstrap-server localhost:9092
```

**Solutions:**

1. **Connection Configuration:**
```typescript
const kafka = new Kafka({
  clientId: 'resume-worker',
  brokers: process.env.KAFKA_BROKERS.split(','),
  retry: {
    initialRetryTime: 100,
    retries: 8,
    maxRetryTime: 30000,
  },
  connectionTimeout: 30000,
  requestTimeout: 60000,
});
```

2. **Network Policies:**
```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: resume-worker-kafka-access
spec:
  podSelector:
    matchLabels:
      app: resume-worker
  policyTypes:
  - Egress
  egress:
  - to:
    - podSelector:
        matchLabels:
          app: kafka
    ports:
    - protocol: TCP
      port: 9092
```

## Info-Level Issues

### 7. Configuration Drift

**Symptoms:**
- Inconsistent behavior across instances
- Environment variable mismatches

**Diagnostic Steps:**

1. **Compare Configurations:**
```bash
# Check ConfigMaps
kubectl get configmap resume-worker-config -n enginedge-workers -o yaml

# Check Secrets
kubectl get secret resume-worker-secrets -n enginedge-workers -o yaml
```

2. **Verify Pod Configurations:**
```bash
kubectl describe pod <pod-name> -n enginedge-workers | grep -A 10 "Environment"
```

**Solutions:**

1. **Configuration Synchronization:**
```bash
# Update ConfigMap
kubectl apply -f updated-configmap.yaml

# Rolling restart
kubectl rollout restart deployment/resume-worker -n enginedge-workers
```

### 8. Log Volume High

**Symptoms:**
- Large log files
- Log aggregation overload
- Storage space issues

**Diagnostic Steps:**

1. **Check Log Volume:**
```bash
kubectl logs deployment/resume-worker -n enginedge-workers --since=1h | wc -l
```

2. **Analyze Log Patterns:**
```bash
kubectl logs deployment/resume-worker -n enginedge-workers | grep "ERROR\|WARN" | head -20
```

**Solutions:**

1. **Log Level Adjustment:**
```yaml
env:
- name: LOG_LEVEL
  value: "warn"  # Reduce from "info" or "debug"
```

2. **Log Sampling:**
```typescript
// Implement log sampling
@Injectable()
export class SampledLogger {
  private sampleRate = 0.1; // Log 10% of info messages

  info(message: string, meta?: any) {
    if (Math.random() < this.sampleRate) {
      this.logger.info(message, meta);
    }
  }
}
```

## Diagnostic Tools

### Built-in Diagnostics

```bash
# Health check with dependencies
curl http://localhost:3001/health?full=true

# Metrics endpoint
curl http://localhost:9090/metrics

# Application profiling
curl http://localhost:3001/debug/pprof/heap
curl http://localhost:3001/debug/pprof/profile
```

### External Tools

```bash
# Network connectivity testing
kubectl run test-pod --image=busybox --rm -it -- nc -zv resume-worker-service 3001

# Database connectivity
kubectl run mongo-test --image=mongo --rm -it -- mongosh mongodb://user:pass@mongodb:27017/resume_worker

# Kafka testing
kubectl run kafka-test --image=confluentinc/cp-kafka --rm -it -- kafka-console-producer --broker-list kafka:9092 --topic test
```

## Prevention Measures

### Monitoring Setup

1. **Alert Configuration:**
```yaml
groups:
  - name: resume-worker-prevention
    rules:
      - alert: ServiceDegraded
        expr: up{job="resume-worker"} < 1
        for: 5m
        labels:
          severity: critical

      - alert: HighErrorRate
        expr: rate(http_requests_total{status=~"5..", job="resume-worker"}[5m]) > 0.05
        for: 5m
        labels:
          severity: warning
```

2. **Dashboard Monitoring:**
- Set up Grafana dashboards for real-time monitoring
- Configure alerting for key metrics
- Implement automated remediation where possible

### Best Practices

1. **Deployment Strategy:**
```yaml
strategy:
  type: RollingUpdate
  rollingUpdate:
    maxUnavailable: 1
    maxSurge: 1
```

2. **Resource Management:**
```yaml
resources:
  requests:
    memory: "256Mi"
    cpu: "100m"
  limits:
    memory: "512Mi"
    cpu: "500m"
```

3. **Circuit Breakers:**
```typescript
@Injectable()
export class CircuitBreakerService {
  async executeWithCircuitBreaker(fn: () => Promise<any>) {
    // Implement circuit breaker pattern
  }
}
```

## Emergency Procedures

### Incident Response

1. **Immediate Actions:**
   - Assess impact and severity
   - Notify stakeholders
   - Start incident timeline

2. **Containment:**
   - Isolate affected components
   - Implement temporary fixes
   - Scale resources if needed

3. **Recovery:**
   - Deploy fixes
   - Validate recovery
   - Monitor for recurrence

4. **Post-Mortem:**
   - Document root cause
   - Implement preventive measures
   - Update runbooks

### Contact Information

- **Development Team:** dev-team@enginedge.com
- **Infrastructure Team:** infra-team@enginedge.com
- **On-Call Engineer:** oncall@enginedge.com
- **Emergency Hotline:** +1-800-ENG-EDGE

### Escalation Matrix

| Severity | Response Time | Escalation |
|----------|---------------|------------|
| Critical | 15 minutes | On-call engineer + management |
| High | 1 hour | Development team lead |
| Medium | 4 hours | Development team |
| Low | 24 hours | Development team |

## Runbook Updates

This troubleshooting guide should be updated whenever:

- New error patterns are discovered
- Infrastructure changes are made
- New monitoring alerts are added
- Incident post-mortems reveal new issues

**Last Updated:** October 2024
**Version:** 1.0