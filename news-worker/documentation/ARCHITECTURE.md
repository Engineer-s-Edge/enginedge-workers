# News Worker - Architecture Documentation

## Overview

The News Worker implements **Hexagonal Architecture** (Ports & Adapters pattern) for clean separation of concerns.

## System Architecture

```
┌─────────────────────────────────────────────────┐
│           News Worker                           │
│  REST API | News Service | Cache Service       │
│  Search | Trending | Feed Management          │
└─────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────┐
│           External Services                     │
│  MongoDB | Redis | Kafka                      │
└─────────────────────────────────────────────────┘
```

## Layer Details

### Domain Layer
- `NewsArticle` - Core news article entity
- `NewsFeed` - Paginated feed entity

### Application Layer
- `NewsService` - Application service for news operations
- DTOs for request/response validation

### Infrastructure Layer
- `NewsController` - HTTP API endpoints
- `InMemoryNewsRepository` - In-memory repository
- `RedisCacheAdapter` - Redis caching
- `WorkerThreadPool` - Multi-threaded processing

## Caching Strategy

- **Feed Cache** - 15 minutes TTL
- **Search Cache** - 10 minutes TTL
- **Trending Cache** - 5 minutes TTL

## Threading

Worker thread pool for concurrent processing:
- Min Workers: 2
- Max Workers: CPU count * 2
- Idle Timeout: 30 seconds
