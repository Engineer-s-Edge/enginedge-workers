# Interview Worker - Troubleshooting

## Overview

This guide provides systematic troubleshooting procedures for common issues in the Interview Worker service. Issues are categorized by component and severity.

## Quick Health Check

### Service Status
```bash
# Check service health
curl http://localhost:3004/health

# Check Kubernetes pod status
kubectl get pods -n interview-worker

# Check service logs
kubectl logs -n interview-worker deployment/interview-worker
```

### Dependency Status
```bash
# MongoDB connection
kubectl exec -it deployment/interview-worker -n interview-worker -- mongo mongodb://interview-mongodb:27017/interview_worker --eval "db.stats()"

# Redis connection
kubectl exec -it deployment/interview-worker -n interview-worker -- redis-cli -h interview-redis ping

# Kafka connection
kubectl exec -it deployment/interview-worker -n interview-worker -- kafka-console-producer --broker-list kafka-cluster:9092 --topic test <<< "test message"
```

## Common Issues

### 1. Service Unavailable

#### Symptoms
- HTTP 503 errors
- Pod status: CrashLoopBackOff
- Health check failures

#### Troubleshooting Steps
```bash
# Check pod events
kubectl describe pod -n interview-worker -l app=interview-worker

# Check resource usage
kubectl top pods -n interview-worker

# Check application logs
kubectl logs -n interview-worker deployment/interview-worker --previous

# Check configuration
kubectl get configmap interview-worker-config -n interview-worker -o yaml
```

#### Common Causes & Solutions

**Memory Issues:**
```yaml
# Check memory limits
resources:
  limits:
    memory: 1Gi
  requests:
    memory: 512Mi
```
```bash
# Increase memory if needed
kubectl edit deployment interview-worker -n interview-worker
```

**Database Connection:**
```bash
# Test MongoDB connectivity
kubectl exec -it deployment/interview-worker -n interview-worker -- mongo --eval "db.serverStatus()"
```

**Configuration Issues:**
```bash
# Validate environment variables
kubectl exec -it deployment/interview-worker -n interview-worker -- env | grep -E "(MONGO|REDIS|KAFKA)"
```

### 2. High Error Rates

#### Symptoms
- HTTP 5xx errors > 5%
- Failed interview processing
- Alert: `AssistantWorkerHighErrorRate`

#### Error Analysis
```bash
# Check error logs
kubectl logs -n interview-worker deployment/interview-worker | grep ERROR

# Check error metrics
curl http://localhost:3004/metrics | grep http_requests_total

# Analyze error patterns
kubectl logs -n interview-worker deployment/interview-worker | \
  grep ERROR | \
  jq -r '.error' | \
  sort | \
  uniq -c | \
  sort -nr
```

#### Common Error Types

**Database Errors:**
```
MongoError: connection timed out
MongoError: authentication failed
```
```javascript
// Check MongoDB status
db.serverStatus().connections
db.serverStatus().asserts
```

**AI Service Errors:**
```
OpenAI API rate limit exceeded
Anthropic API authentication failed
```
```bash
# Check API key validity
curl -H "Authorization: Bearer $OPENAI_API_KEY" \
  https://api.openai.com/v1/models
```

**Transcription Errors:**
```
Google Speech API quota exceeded
Azure Speech service unavailable
```
```bash
# Check service quotas
gcloud quota list --filter="speech"
```

### 3. High Latency

#### Symptoms
- API response time > 500ms (p95)
- Interview processing > 60s
- Alert: `AssistantWorkerHighExecutionLatency`

#### Performance Analysis
```bash
# Check response time metrics
curl http://localhost:3004/metrics | grep http_request_duration

# Profile application performance
kubectl exec -it deployment/interview-worker -n interview-worker -- \
  npx clinic doctor -- node --prof app.js

# Check database performance
db.currentOp({ "secs_running": { "$gt": 5 } })
```

#### Optimization Steps

**Database Optimization:**
```javascript
// Check slow queries
db.system.profile.find(
  { millis: { $gt: 1000 } }
).sort({ ts: -1 }).limit(5)

// Add missing indexes
db.interviews.createIndex({ "status": 1, "scheduledAt": 1 })
```

**Cache Optimization:**
```bash
# Check Redis performance
kubectl exec -it deployment/interview-worker -n interview-worker -- \
  redis-cli info stats

# Clear cache if corrupted
kubectl exec -it deployment/interview-worker -n interview-worker -- \
  redis-cli FLUSHALL
```

**Application Profiling:**
```bash
# CPU profiling
npx clinic bubbleprof -- node dist/main.js

# Memory profiling
npx clinic heapprofiler -- node dist/main.js
```

### 4. Transcription Issues

#### Symptoms
- Transcription fails to start
- Poor transcription quality
- High latency in real-time transcription

#### Audio Troubleshooting
```bash
# Check audio file format
file interview_audio.wav

# Test transcription service
curl -X POST http://localhost:3004/transcription/upload \
  -F "file=@test_audio.wav" \
  -F "interviewId=test-123"
```

#### Service-Specific Issues

**Google Speech-to-Text:**
```bash
# Check API key permissions
gcloud auth list

# Test API connectivity
gcloud ml speech recognize test_audio.wav --language-code=en-US
```

**Azure Speech Services:**
```bash
# Check subscription quota
az cognitiveservices account list-usage \
  --name interview-speech \
  --resource-group interview-rg
```

### 5. Analysis Failures

#### Symptoms
- Analysis jobs fail
- Incomplete analysis results
- AI service timeouts

#### Analysis Debugging
```bash
# Check analysis queue
kubectl logs -n interview-worker deployment/interview-worker | grep analysis

# Test AI service connectivity
curl -H "Authorization: Bearer $OPENAI_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"model": "gpt-4", "messages": [{"role": "user", "content": "test"}]}' \
  https://api.openai.com/v1/chat/completions
```

#### Model-Specific Issues

**OpenAI GPT-4:**
```bash
# Check rate limits
curl https://api.openai.com/v1/usage \
  -H "Authorization: Bearer $OPENAI_API_KEY"
```

**Anthropic Claude:**
```bash
# Check API status
curl https://status.anthropic.com/api/v2/status.json
```

### 6. Calendar Integration Issues

#### Symptoms
- Scheduling fails
- Calendar sync errors
- Meeting creation failures

#### Calendar Debugging
```bash
# Test calendar API
curl -H "Authorization: Bearer $GOOGLE_CALENDAR_TOKEN" \
  https://www.googleapis.com/calendar/v3/calendars/primary/events

# Check calendar permissions
gcloud auth application-default print-access-token
```

### 7. WebSocket Connection Issues

#### Symptoms
- Real-time features not working
- WebSocket connection failures
- Audio streaming interruptions

#### WebSocket Troubleshooting
```bash
# Check WebSocket endpoint
wscat -c ws://localhost:3004/transcription/stream/test-interview

# Monitor WebSocket connections
kubectl logs -n interview-worker deployment/interview-worker | grep websocket
```

## Monitoring & Alerting

### Key Alerts to Monitor

#### Critical Alerts
- `InterviewWorkerDown`: Service unavailable
- `InterviewWorkerCriticalErrorRate`: > 25% error rate
- `InterviewWorkerCriticalExecutionLatency`: > 120s latency

#### Warning Alerts
- `InterviewWorkerHighErrorRate`: > 10% error rate
- `InterviewWorkerHighExecutionLatency`: > 60s latency
- `InterviewWorkerHighMemoryUsage`: > 80% memory usage

### Log Analysis

#### Error Log Patterns
```bash
# Search for specific errors
kubectl logs -n interview-worker deployment/interview-worker | \
  grep -i "error\|exception\|failed"

# Analyze error frequency
kubectl logs -n interview-worker deployment/interview-worker --since=1h | \
  grep ERROR | \
  cut -d' ' -f1 | \
  sort | \
  uniq -c | \
  sort -nr
```

#### Performance Log Analysis
```bash
# Check slow operations
kubectl logs -n interview-worker deployment/interview-worker | \
  grep "duration\|latency" | \
  tail -20

# Monitor resource usage
kubectl logs -n interview-worker deployment/interview-worker | \
  grep "memory\|cpu" | \
  tail -10
```

## Database Issues

### MongoDB Troubleshooting

#### Connection Issues
```javascript
// Check connection pool
db.serverStatus().connections

// Test database operations
db.interviews.findOne()
db.candidates.count()
```

#### Performance Issues
```javascript
// Check slow queries
db.currentOp({
  "secs_running": { "$gt": 10 }
})

// Analyze query performance
db.interviews.find({
  status: "completed"
}).explain("executionStats")
```

#### Replication Issues
```javascript
// Check replica set status
rs.status()

// Check oplog status
db.getReplicationInfo()
```

### Redis Troubleshooting

#### Connection Issues
```bash
# Test Redis connectivity
redis-cli -h interview-redis ping

# Check Redis info
redis-cli -h interview-redis info
```

#### Performance Issues
```bash
# Monitor Redis commands
redis-cli -h interview-redis monitor

# Check slow commands
redis-cli -h interview-redis slowlog get 10
```

## Network Issues

### Connectivity Problems
```bash
# Test service mesh connectivity
kubectl exec -it deployment/interview-worker -n interview-worker -- \
  curl http://interview-mongodb:27017

# Check network policies
kubectl get networkpolicies -n interview-worker

# Test external API connectivity
kubectl exec -it deployment/interview-worker -n interview-worker -- \
  curl https://api.openai.com/v1/models
```

### DNS Resolution
```bash
# Check DNS resolution
kubectl exec -it deployment/interview-worker -n interview-worker -- \
  nslookup interview-mongodb

# Check service discovery
kubectl get endpoints -n interview-worker
```

## Resource Issues

### Memory Problems
```bash
# Check memory usage
kubectl top pods -n interview-worker

# Analyze memory leaks
kubectl exec -it deployment/interview-worker -n interview-worker -- \
  npx heapdump
```

### CPU Issues
```bash
# Check CPU usage
kubectl top pods -n interview-worker

# Profile CPU usage
kubectl exec -it deployment/interview-worker -n interview-worker -- \
  npx clinic bubbleprof -- node dist/main.js
```

### Disk Issues
```bash
# Check disk usage
kubectl exec -it deployment/interview-worker -n interview-worker -- \
  df -h

# Check log file sizes
kubectl exec -it deployment/interview-worker -n interview-worker -- \
  du -sh /var/log/*
```

## External Service Issues

### AI Service Problems
```bash
# Check service status pages
curl https://status.openai.com/api/v1/status
curl https://status.anthropic.com/api/v2/status.json

# Test API endpoints
curl -H "Authorization: Bearer $API_KEY" \
  https://api.openai.com/v1/chat/completions \
  -d '{"model": "gpt-3.5-turbo", "messages": [{"role": "user", "content": "test"}]}'
```

### Speech Service Issues
```bash
# Google Speech API status
curl https://status.cloud.google.com/incidents.json | jq '.[] | select(.service_name == "Speech-to-Text API")'

# Azure Cognitive Services status
curl https://status.azure.com/en-us/status
```

### Calendar Service Issues
```bash
# Google Calendar API status
curl https://www.google.com/appsstatus/json/Google%20Calendar

# Microsoft Graph API status
curl https://portal.office.com/servicestatus/json
```

## Recovery Procedures

### Service Restart
```bash
# Restart deployment
kubectl rollout restart deployment/interview-worker -n interview-worker

# Check rollout status
kubectl rollout status deployment/interview-worker -n interview-worker
```

### Database Recovery
```bash
# MongoDB backup
kubectl exec -it deployment/interview-worker -n interview-worker -- \
  mongodump --db interview_worker --out /tmp/backup

# MongoDB restore
kubectl exec -it deployment/interview-worker -n interview-worker -- \
  mongorestore --db interview_worker /tmp/backup/interview_worker
```

### Cache Recovery
```bash
# Clear Redis cache
kubectl exec -it deployment/interview-worker -n interview-worker -- \
  redis-cli FLUSHALL

# Redis cluster reset
kubectl exec -it deployment/interview-worker -n interview-worker -- \
  redis-cli CLUSTER RESET
```

## Prevention Measures

### Proactive Monitoring
1. Set up comprehensive alerting
2. Monitor error rates and latency trends
3. Regular capacity planning reviews
4. Automated health checks

### Maintenance Tasks
1. Regular dependency updates
2. Database index optimization
3. Log rotation configuration
4. Backup verification

### Best Practices
1. Implement circuit breakers for external services
2. Use retry logic with exponential backoff
3. Implement graceful degradation
4. Regular load testing and performance audits

## Escalation Procedures

### Severity Levels

#### P1 - Critical
- Service completely down
- Data loss or corruption
- Security breach
- **Response Time:** 15 minutes
- **Contact:** On-call engineer + management

#### P2 - High
- Major functionality broken
- High error rates (>25%)
- Performance degradation
- **Response Time:** 1 hour
- **Contact:** On-call engineer

#### P3 - Medium
- Minor functionality issues
- Intermittent problems
- Performance warnings
- **Response Time:** 4 hours
- **Contact:** Development team

#### P4 - Low
- Cosmetic issues
- Non-critical warnings
- **Response Time:** Next business day
- **Contact:** Development team

### Escalation Contacts
- **Primary:** DevOps Team (devops@enginedge.com)
- **Secondary:** Development Team (dev@enginedge.com)
- **Management:** CTO (cto@enginedge.com)
- **External:** Service providers (support@openai.com, etc.)

## Documentation Updates

When resolving issues, update this troubleshooting guide with:
1. New error patterns discovered
2. Resolution procedures that worked
3. Prevention measures implemented
4. Contact information changes

Regular review and updates ensure the guide remains current and effective.