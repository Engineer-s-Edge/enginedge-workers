# Scheduling Worker - Troubleshooting Guide

## Overview

This guide provides solutions for common issues encountered when running the Scheduling Worker, including debugging techniques, error resolution, and maintenance procedures.

## Common Issues and Solutions

### Database Connection Issues

#### Connection Timeout

**Symptoms:**
- `Connection timeout` errors in logs
- Slow database queries
- Application startup failures

**Solutions:**

1. **Check Database Connectivity**
```bash
# Test database connection
mongosh $MONGODB_URI --eval "db.runCommand({ping: 1})"

# Check connection pool status
curl http://localhost:3007/health/database
```

2. **Optimize Connection Pool Settings**
```typescript
// config/database.config.ts
export const dbConfig = {
  // Increase timeouts for slow networks
  serverSelectionTimeoutMS: 30000,
  socketTimeoutMS: 45000,
  connectTimeoutMS: 30000,

  // Adjust pool size based on load
  maxPoolSize: 20,
  minPoolSize: 5,
  maxIdleTimeMS: 30000,
};
```

3. **Network Configuration**
```bash
# Check network connectivity
ping $DB_HOST

# Test port accessibility
telnet $MONGODB_HOST 27017

# Check firewall rules
sudo ufw status
```

#### Connection Pool Exhausted

**Symptoms:**
- `Pool exhausted` errors
- High memory usage
- Degraded performance

**Solutions:**

1. **Monitor Pool Usage**
```typescript
// Add pool monitoring
import { MongoClient } from 'mongodb';

const client = new MongoClient(uri, options);
client.on('connectionCreated', (event) => {
  console.log('New connection created');
});
client.on('connectionClosed', (event) => {
  console.log('Connection closed');
});
client.on('connectionCheckOutFailed', (event) => {
  console.error('Connection checkout failed');
});
```

2. **Implement Connection Leak Detection**
```typescript
// config/database.config.ts
export const dbConfig = {
  // Enable leak detection
  maxIdleTimeMS: 30000, // Close connections after 30 seconds of inactivity
  heartbeatFrequencyMS: 10000, // Check connection health every 10 seconds

  // Log slow operations
  monitorCommands: true,
};
```

3. **Scale Database Resources**
```yaml
# k8s/deployment.yaml
resources:
  requests:
    memory: "512Mi"
    cpu: "500m"
  limits:
    memory: "1Gi"
    cpu: "1000m"
```

### Redis Cache Issues

#### Cache Connection Failed

**Symptoms:**
- `Redis connection failed` errors
- Slow application performance
- Cache miss warnings

**Solutions:**

1. **Verify Redis Configuration**
```bash
# Test Redis connection
redis-cli -h $REDIS_HOST -p $REDIS_PORT ping

# Check Redis info
redis-cli info
```

2. **Redis Cluster Issues**
```typescript
// config/redis.config.ts
export const redisConfig = {
  // Enable retry logic
  retryDelayOnFailover: 100,
  maxRetriesPerRequest: 3,
  enableReadyCheck: true,

  // Cluster configuration
  cluster: {
    enableOfflineQueue: false,
  }
};
```

3. **Memory Issues**
```bash
# Check Redis memory usage
redis-cli info memory

# Configure memory limits
redis-cli config set maxmemory 512mb
redis-cli config set maxmemory-policy allkeys-lru
```

#### Cache Invalidation Problems

**Symptoms:**
- Stale data in responses
- Inconsistent application state
- Cache not updating

**Solutions:**

1. **Implement Cache Versioning**
```typescript
export class CacheService {
  private readonly version = 'v1';

  async set(key: string, value: any, ttl?: number) {
    const versionedKey = `${this.version}:${key}`;
    await this.redis.setex(versionedKey, ttl || 3600, JSON.stringify(value));
  }

  async invalidatePattern(pattern: string) {
    const keys = await this.redis.keys(`${this.version}:${pattern}`);
    if (keys.length > 0) {
      await this.redis.del(keys);
    }
  }
}
```

2. **Manual Cache Clearing**
```bash
# Clear all cache
redis-cli flushall

# Clear specific pattern
redis-cli --eval clear_pattern.lua , scheduling:user:*

# Lua script for pattern clearing
local keys = redis.call('keys', ARGV[1])
for i=1,#keys do
  redis.call('del', keys[i])
end
```

### Google Calendar API Issues

#### Authentication Errors

**Symptoms:**
- `Invalid credentials` errors
- `Access denied` responses
- Token refresh failures

**Solutions:**

1. **Verify OAuth Configuration**
```typescript
// Check token validity
const tokenInfo = await this.googleAuth.getTokenInfo(accessToken);

// Refresh token if needed
if (tokenInfo.expiry_date < Date.now()) {
  const newTokens = await this.googleAuth.refreshAccessToken();
  await this.tokenStore.saveTokens(userId, newTokens);
}
```

2. **Handle Rate Limits**
```typescript
export class GoogleCalendarService {
  private async executeWithRetry<T>(
    operation: () => Promise<T>,
    maxRetries = 3
  ): Promise<T> {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        if (error.code === 403 && attempt < maxRetries) {
          // Rate limited, wait with exponential backoff
          const delay = Math.pow(2, attempt) * 1000;
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
        throw error;
      }
    }
  }
}
```

3. **Scope Permissions**
```typescript
// Ensure correct scopes
const SCOPES = [
  'https://www.googleapis.com/auth/calendar.readonly',
  'https://www.googleapis.com/auth/calendar.events'
];

const authUrl = this.googleAuth.generateAuthUrl({
  access_type: 'offline',
  scope: SCOPES,
  prompt: 'consent'
});
```

#### Sync Failures

**Symptoms:**
- Calendar events not syncing
- Partial sync completion
- Sync timeout errors

**Solutions:**

1. **Implement Incremental Sync**
```typescript
export class CalendarSyncService {
  async syncCalendar(userId: string, calendarId: string) {
    const lastSync = await this.getLastSyncTime(userId, calendarId);
    const syncToken = await this.getSyncToken(userId, calendarId);

    const events = await this.googleCalendar.events.list({
      calendarId,
      syncToken: syncToken || undefined,
      updatedMin: lastSync?.toISOString(),
      singleEvents: true,
      orderBy: 'updated'
    });

    // Process changes
    await this.processSyncResults(userId, calendarId, events.data.items);

    // Update sync token
    await this.saveSyncToken(userId, calendarId, events.data.nextSyncToken);
  }
}
```

2. **Handle Large Calendars**
```typescript
// Paginated sync
async syncLargeCalendar(userId: string, calendarId: string) {
  let pageToken: string | undefined;
  const allEvents: any[] = [];

  do {
    const response = await this.googleCalendar.events.list({
      calendarId,
      pageToken,
      maxResults: 2500, // Maximum allowed
      singleEvents: true,
      orderBy: 'startTime'
    });

    allEvents.push(...response.data.items);
    pageToken = response.data.nextPageToken;

    // Process in batches to avoid memory issues
    if (allEvents.length >= 10000) {
      await this.processBatch(userId, calendarId, allEvents.splice(0));
    }
  } while (pageToken);

  // Process remaining events
  if (allEvents.length > 0) {
    await this.processBatch(userId, calendarId, allEvents);
  }
}
```

### Kafka Messaging Issues

#### Message Processing Failures

**Symptoms:**
- Messages stuck in queue
- Consumer lag increasing
- Processing errors in logs

**Solutions:**

1. **Monitor Consumer Lag**
```bash
# Check consumer group lag
kafka-consumer-groups --bootstrap-server localhost:9092 \
  --group scheduling-worker \
  --describe

# Check topic partitions
kafka-topics --bootstrap-server localhost:9092 \
  --topic scheduling-events \
  --describe
```

2. **Implement Dead Letter Queue**
```typescript
export class MessageProcessor {
  async processMessage(message: KafkaMessage) {
    try {
      await this.process(message);
      await this.consumer.commitOffsets([{
        topic: message.topic,
        partition: message.partition,
        offset: message.offset + 1
      }]);
    } catch (error) {
      // Send to dead letter queue
      await this.deadLetterProducer.send({
        topic: 'scheduling-dlq',
        messages: [{
          key: message.key,
          value: JSON.stringify({
            originalMessage: message,
            error: error.message,
            timestamp: new Date().toISOString()
          })
        }]
      });

      this.logger.error('Message processing failed', {
        messageId: message.key,
        error: error.message
      });
    }
  }
}
```

3. **Handle Message Duplicates**
```typescript
export class IdempotentProcessor {
  async processWithIdempotency(messageId: string, operation: () => Promise<void>) {
    const processed = await this.redis.get(`processed:${messageId}`);

    if (processed) {
      this.logger.warn('Duplicate message detected', { messageId });
      return;
    }

    await operation();

    // Mark as processed with TTL
    await this.redis.setex(`processed:${messageId}`, 3600, 'true');
  }
}
```

### Memory and Performance Issues

#### Memory Leaks

**Symptoms:**
- Increasing memory usage over time
- Out of memory errors
- Application restarts

**Solutions:**

1. **Memory Profiling**
```typescript
// Add memory monitoring
import * as v8 from 'v8';

setInterval(() => {
  const heapStats = v8.getHeapStatistics();
  console.log('Heap usage:', {
    used: Math.round(heapStats.used_heap_size / 1024 / 1024) + 'MB',
    total: Math.round(heapStats.total_heap_size / 1024 / 1024) + 'MB',
    limit: Math.round(heapStats.heap_size_limit / 1024 / 1024) + 'MB'
  });
}, 30000);
```

2. **Garbage Collection Tuning**
```bash
# Node.js GC tuning
node --max-old-space-size=4096 \
     --optimize-for-size \
     --max-new-space-size=1024 \
     app.js
```

3. **Connection Cleanup**
```typescript
export class ConnectionManager {
  private connections = new Map<string, any>();

  async getConnection(key: string): Promise<any> {
    if (this.connections.has(key)) {
      return this.connections.get(key);
    }

    const connection = await this.createConnection(key);
    this.connections.set(key, connection);

    // Auto cleanup after inactivity
    setTimeout(() => {
      this.connections.delete(key);
      connection.close();
    }, 300000); // 5 minutes

    return connection;
  }
}
```

#### High CPU Usage

**Symptoms:**
- High CPU utilization
- Slow response times
- Application freezing

**Solutions:**

1. **Profile CPU Usage**
```bash
# Generate CPU profile
node --prof app.js

# Analyze profile
node --prof-process isolate-*.log > profile.txt
```

2. **Optimize Heavy Operations**
```typescript
// Move heavy computations to worker threads
import { Worker } from 'worker_threads';

export class HeavyProcessor {
  async processData(data: any): Promise<any> {
    return new Promise((resolve, reject) => {
      const worker = new Worker('./heavy-processor.js', {
        workerData: data
      });

      worker.on('message', resolve);
      worker.on('error', reject);
      worker.on('exit', (code) => {
        if (code !== 0) {
          reject(new Error(`Worker stopped with exit code ${code}`));
        }
      });
    });
  }
}
```

### Activity Model Service Issues

#### Activity Tracking Not Working

**Symptoms:**
- Activity events not being tracked
- Activity patterns not updating
- No productivity insights available

**Solutions:**

1. **Check Activity Model Service Status**
```bash
# Check if activity model is enabled
echo $ACTIVITY_MODEL_ENABLED

# Test activity tracking endpoint
curl -X POST http://localhost:3007/activity/events/event_123/complete \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "user_123",
    "scheduledTime": "2025-01-10T09:00:00Z",
    "actualStartTime": "2025-01-10T09:05:00Z",
    "actualEndTime": "2025-01-10T11:00:00Z",
    "productivityScore": 0.85
  }'
```

2. **Verify MongoDB Collections**
```bash
# Check if collections exist
mongosh $MONGODB_URI --eval "db.getCollectionNames()"

# Check activity events
mongosh $MONGODB_URI --eval "db.activity_events.countDocuments()"

# Check activity patterns
mongosh $MONGODB_URI --eval "db.activity_patterns.countDocuments()"
```

3. **Check Pattern Update Interval**
```env
# Ensure pattern update is configured
ACTIVITY_MODEL_ENABLED=true
ACTIVITY_PATTERN_UPDATE_INTERVAL=3600  # Update every hour
```

#### Pattern Analysis Failures

**Symptoms:**
- Patterns not being generated
- Pattern analysis errors
- Default patterns always returned

**Solutions:**

1. **Verify Event Data**
```typescript
// Check if events exist for pattern analysis
const events = await eventRepository.findCompletedByUserId(userId);
if (events.length === 0) {
  // No events to analyze - this is expected for new users
  return createDefaultPattern(userId);
}
```

2. **Check Pattern Analyzer Service**
```bash
# Check logs for pattern analyzer errors
grep "PatternAnalyzerService" logs/application.log | grep ERROR
```

3. **Validate Event Data Quality**
- Ensure events have required fields (scheduledTime, completed, etc.)
- Check for null or invalid dates
- Verify productivity scores are in valid range (0-1)

#### ML Prediction Failures

**Symptoms:**
- Predictions always return default values
- ML service connection errors
- High prediction latency

**Solutions:**

1. **Check ML Service Health**
```bash
# Test ML service health
curl http://localhost:8000/health

# Check ML service logs
docker logs scheduling-model-api
```

2. **Verify ML Service Configuration**
```env
# Ensure ML service URL is correct
ML_SERVICE_URL=http://scheduling-model:8000
ML_SERVICE_TIMEOUT=10000
```

3. **Check Feature Extraction**
- Verify all required features are being extracted
- Check feature data types and ranges
- Ensure user patterns are available

#### Efficiency Metrics Calculation Errors

**Symptoms:**
- Efficiency metrics return zeros
- Calculation timeouts
- Invalid metric values

**Solutions:**

1. **Verify Date Range**
```typescript
// Ensure valid date range
const startDate = new Date('2025-01-01');
const endDate = new Date('2025-01-31');
if (endDate <= startDate) {
  throw new Error('Invalid date range');
}
```

2. **Check Event Data Completeness**
- Ensure events have completion data
- Verify actual start/end times are recorded
- Check for missing productivity scores

3. **Handle Edge Cases**
```typescript
// Handle division by zero
const completionRate = events.length > 0
  ? completedEvents.length / events.length
  : 0;
```

### Application Startup Issues

#### Dependency Injection Failures

**Symptoms:**
- `Cannot resolve dependency` errors
- Module loading failures
- Application won't start

**Solutions:**

1. **Check Module Registration**
```typescript
// Verify module imports
@Module({
  imports: [
    TypeOrmModule.forFeature([CalendarEvent, Goal, Habit]),
    JwtModule.register({
      secret: process.env.JWT_SECRET,
      signOptions: { expiresIn: '24h' }
    }),
    CacheModule.register({
      store: redisStore,
      host: process.env.REDIS_HOST,
      port: parseInt(process.env.REDIS_PORT)
    })
  ],
  controllers: [SchedulingController],
  providers: [CalendarService, GoalService, HabitService],
  exports: [CalendarService, GoalService, HabitService]
})
export class SchedulingModule {}
```

2. **Environment Variables**
```bash
# Check required environment variables
echo "DB_HOST: $DB_HOST"
echo "DB_USER: $DB_USER"
echo "REDIS_HOST: $REDIS_HOST"
echo "JWT_SECRET: $JWT_SECRET"
echo "GOOGLE_CLIENT_ID: $GOOGLE_CLIENT_ID"
```

3. **Circular Dependencies**
```typescript
// Break circular dependencies
@Injectable()
export class ServiceA {
  constructor(
    @Inject(forwardRef(() => ServiceB))
    private serviceB: ServiceB
  ) {}
}

@Injectable()
export class ServiceB {
  constructor(
    @Inject(forwardRef(() => ServiceA))
    private serviceA: ServiceA
  ) {}
}
```

### Testing and Debugging

#### Unit Test Failures

**Symptoms:**
- Tests failing intermittently
- Mock setup issues
- Database test isolation problems

**Solutions:**

1. **Database Test Setup**
```typescript
// config/test-database.config.ts
export const testDbConfig = {
  type: 'sqlite',
  database: ':memory:',
  dropSchema: true,
  entities: [CalendarEvent, Goal, Habit],
  synchronize: true,
  logging: false
};
```

2. **Mock External Services**
```typescript
// Mock Google Calendar API
const mockGoogleCalendar = {
  events: {
    list: jest.fn(),
    insert: jest.fn(),
    update: jest.fn(),
    delete: jest.fn()
  }
};

jest.mock('googleapis', () => ({
  google: {
    calendar: jest.fn(() => mockGoogleCalendar)
  }
}));
```

3. **Async Test Handling**
```typescript
describe('CalendarService', () => {
  let service: CalendarService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [CalendarService]
    }).compile();

    service = module.get<CalendarService>(CalendarService);
  });

  it('should sync calendar events', async () => {
    // Increase timeout for async operations
    jest.setTimeout(10000);

    const result = await service.syncCalendar('user-1', 'calendar-1');
    expect(result).toBeDefined();
  });
});
```

#### Debug Logging

**Enable Debug Mode**
```typescript
// config/logger.config.ts
export const loggerConfig = {
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console({
      level: 'debug',
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    }),
    new winston.transports.File({
      filename: 'logs/error.log',
      level: 'error'
    })
  ]
};
```

**Structured Logging**
```typescript
export class LoggingService {
  debug(message: string, context?: any) {
    this.logger.debug(message, {
      service: 'scheduling-worker',
      timestamp: new Date().toISOString(),
      ...context
    });
  }

  error(message: string, error?: Error, context?: any) {
    this.logger.error(message, {
      service: 'scheduling-worker',
      timestamp: new Date().toISOString(),
      error: error?.message,
      stack: error?.stack,
      ...context
    });
  }
}
```

### Health Checks and Monitoring

#### Health Check Endpoints

```typescript
// health.controller.ts
@Controller('health')
export class HealthController {
  constructor(
    private readonly db: DatabaseHealthIndicator,
    private readonly redis: RedisHealthIndicator,
    private readonly kafka: KafkaHealthIndicator
  ) {}

  @Get()
  @HealthCheck()
  check() {
    return HealthCheckService
      .builder()
      .addCheck('database', () => this.db.pingCheck('database'))
      .addCheck('redis', () => this.redis.pingCheck('redis'))
      .addCheck('kafka', () => this.kafka.pingCheck('kafka'))
      .build()
      .check();
  }
}
```

#### Readiness and Liveness Probes

```yaml
# k8s/deployment.yaml
livenessProbe:
  httpGet:
    path: /health
    port: 3003
  initialDelaySeconds: 30
  periodSeconds: 10
  timeoutSeconds: 5
  failureThreshold: 3

readinessProbe:
  httpGet:
    path: /health
    port: 3003
  initialDelaySeconds: 5
  periodSeconds: 5
  timeoutSeconds: 3
  failureThreshold: 3
```

### Emergency Procedures

#### Application Restart

```bash
# Graceful shutdown
curl -X POST http://localhost:3003/shutdown

# Force restart
docker restart scheduling-worker

# Kubernetes rollout
kubectl rollout restart deployment/scheduling-worker
```

#### Database Recovery

```bash
# Check database status
psql -c "SELECT version();"

# Restore from backup
pg_restore -d scheduling_db backup.dump

# Rebuild indexes
REINDEX DATABASE scheduling_db;
```

#### Cache Recovery

```bash
# Clear corrupted cache
redis-cli flushall

# Restart Redis cluster
redis-cli cluster failover

# Warm cache
curl -X POST http://localhost:3003/cache/warm
```

## Support and Escalation

### Log Collection

**Collect Diagnostic Information**
```bash
# System information
uname -a
docker --version
node --version

# Application logs
tail -f logs/application.log | grep ERROR

# Database logs
tail -f /var/log/postgresql/postgresql.log

# Container logs
docker logs scheduling-worker --tail 100
```

### Escalation Matrix

| Issue Severity | Response Time | Escalation Path |
|----------------|---------------|-----------------|
| Critical (app down) | < 15 minutes | On-call engineer → Tech lead |
| High (degraded performance) | < 1 hour | On-call engineer → SRE team |
| Medium (partial functionality) | < 4 hours | Development team |
| Low (minor issues) | < 24 hours | Development team |

### Contact Information

- **Development Team**: dev-team@company.com
- **SRE Team**: sre@company.com
- **On-call Engineer**: +1-555-0123
- **Documentation**: https://docs.company.com/scheduling-worker

## Prevention Best Practices

### Code Quality

1. **Implement Comprehensive Testing**
   - Unit tests for all services
   - Integration tests for API endpoints
   - Load tests for performance validation

2. **Code Reviews**
   - Require peer reviews for all changes
   - Check for error handling and logging
   - Validate performance implications

3. **Static Analysis**
   - Run ESLint and Prettier
   - Use TypeScript strict mode
   - Implement security scanning

### Infrastructure

1. **Monitoring and Alerting**
   - Set up comprehensive monitoring
   - Configure appropriate alerts
   - Regular log analysis

2. **Backup and Recovery**
   - Daily database backups
   - Test backup restoration
   - Document recovery procedures

3. **Capacity Planning**
   - Monitor resource usage trends
   - Plan for scaling requirements
   - Regular performance testing

### Operational Excellence

1. **Documentation**
   - Keep runbooks current
   - Document known issues and solutions
   - Maintain troubleshooting guides

2. **Training**
   - Train team on troubleshooting procedures
   - Conduct regular incident reviews
   - Share lessons learned

3. **Automation**
   - Automate deployment and rollback
   - Implement automated testing
   - Use infrastructure as code
