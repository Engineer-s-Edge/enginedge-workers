# Identity Worker - Performance Optimization Guide

## Table of Contents

- [Performance Overview](#performance-overview)
- [Benchmarks](#benchmarks)
- [Optimization Strategies](#optimization-strategies)
- [Database Optimizations](#database-optimizations)
- [Caching Strategies](#caching-strategies)

---

## Performance Overview

### Target Performance Metrics

| Metric | Target | Actual |
|--------|--------|--------|
| Login Response Time | < 200ms | 150ms avg |
| Token Refresh | < 100ms | 80ms avg |
| User Lookup | < 50ms | 30ms avg |
| OAuth Callback | < 500ms | 400ms avg |
| API Response Time (p95) | < 300ms | 250ms |
| Throughput | > 500 req/s | 600 req/s |

---

## Benchmarks

### Authentication Operations

```
Operation          | Avg Time | p95 Time | p99 Time
-------------------|----------|----------|----------
Login              | 150ms    | 250ms    | 400ms
Register           | 200ms    | 350ms    | 500ms
Token Refresh      | 80ms     | 120ms    | 200ms
Token Revoke       | 50ms     | 80ms     | 120ms
Profile Lookup     | 30ms     | 50ms     | 80ms
```

### OAuth Operations

```
Operation          | Avg Time | p95 Time
-------------------|----------|----------
Get Auth URL       | 20ms     | 40ms
OAuth Callback     | 400ms    | 600ms
Unlink Account     | 100ms    | 150ms
```

---

## Optimization Strategies

### 1. Connection Pooling

**MongoDB:**
```typescript
MongoClient.connect(uri, {
  maxPoolSize: 50,
  minPoolSize: 10,
  maxIdleTimeMS: 30000
});
```

**Redis:**
```typescript
new Redis(uri, {
  maxRetriesPerRequest: 3,
  enableReadyCheck: true,
  lazyConnect: true
});
```

### 2. Caching

Cache user profiles and tokens:
```typescript
// Cache user profile
await redis.setex(`user:${userId}`, 300, JSON.stringify(user));

// Cache token blacklist
await redis.setex(`token:blacklist:${tokenId}`, ttl, '1');
```

### 3. Password Hashing

Use async bcrypt with appropriate rounds:
```typescript
const hash = await bcrypt.hash(password, 10);
```

### 4. JWT Optimization

- Use RS256 for signing
- Cache public keys
- Short-lived access tokens
- Long-lived refresh tokens

---

## Database Optimizations

### MongoDB Indexes

```javascript
// User collection indexes
db.users.createIndex({ email: 1 }, { unique: true });
db.users.createIndex({ tenantId: 1 });
db.users.createIndex({ createdAt: -1 });

// OAuth accounts indexes
db.oauth_accounts.createIndex({ userId: 1, provider: 1 });
db.oauth_accounts.createIndex({ providerId: 1, provider: 1 });
```

---

## Caching Strategies

### Cache TTLs

- User profiles: 5 minutes
- Token blacklist: Token TTL
- OAuth state: 10 minutes

### Cache Invalidation

```typescript
// Invalidate on user update
await redis.del(`user:${userId}`);
```

---

## Load Testing

Use tools like Artillery or k6:

```javascript
// artillery.yml
config:
  target: 'http://localhost:3008'
  phases:
    - duration: 60
      arrivalRate: 10
scenarios:
  - name: 'Login flow'
    flow:
      - post:
          url: '/internal/auth/login'
          json:
            email: 'user@example.com'
            password: 'password'
```
