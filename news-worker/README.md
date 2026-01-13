# News Worker - News Aggregation Service

<div align="center">

![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)
![Status](https://img.shields.io/badge/status-production--ready-brightgreen.svg)
![Node](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen.svg)
![TypeScript](https://img.shields.io/badge/typescript-5.0-blue.svg)
![NestJS](https://img.shields.io/badge/nestjs-10.0-red.svg)
![License](https://img.shields.io/badge/license-Proprietary-yellow.svg)

![Build](https://img.shields.io/badge/build-passing-brightgreen.svg)
![Redis](https://img.shields.io/badge/redis-cached-orange.svg)
![Threading](https://img.shields.io/badge/threading-multithreaded-blue.svg)

</div>

---

A production-ready microservice for news aggregation, feed management, and article search with Redis caching and multi-threaded processing. Built with hexagonal architecture for scalability and maintainability.

## 🎯 Overview

<div align="center">

**🚀 Production-Grade News Aggregation Platform**

[![Architecture](https://img.shields.io/badge/architecture-hexagonal-purple.svg)](#architecture)
[![API](https://img.shields.io/badge/API-REST-orange.svg)](#api-endpoints)
[![Caching](https://img.shields.io/badge/caching-redis-red.svg)](#caching)
[![Threading](https://img.shields.io/badge/threading-multithreaded-blue.svg)](#threading)

</div>

The **News Worker** is a highly scalable, production-grade microservice that provides:

- **News Feed Management** - Paginated news feeds with filtering and search
- **Redis Caching** - Distributed caching for improved performance and rate limit avoidance
- **Multi-threaded Processing** - Worker thread pool for concurrent article processing
- **Article Search** - Full-text search across titles, descriptions, and content
- **Trending Articles** - Real-time trending article discovery
- **RESTful API** - Comprehensive REST API endpoints

## ✨ Features

<div align="center">

| 📰 **News Feed** | 🔍 **Search** | 📊 **Trending** | ⚡ **Caching** |
|:----------------:|:-------------:|:---------------:|:--------------:|
| Paginated feeds  | Full-text search | Trending discovery | Redis caching |
| Filtering        | Relevance scoring | Category-based | TTL management |
| Sorting          | Query optimization | Recency-based | Pattern invalidation |

</div>

### Core Capabilities

- **News Feed API** - Get paginated news feeds with category, source, date, and tag filtering
- **Search API** - Full-text search with relevance scoring across article content
- **Trending API** - Discover trending articles by category or globally
- **Redis Caching** - Distributed caching with configurable TTLs and pattern-based invalidation
- **Multi-threading** - Worker thread pool for concurrent article processing and aggregation
- **Metrics & Monitoring** - Prometheus metrics for observability

### Architecture

- **Hexagonal Architecture** - Clean separation of domain, application, and infrastructure layers
- **Domain-Driven Design** - Rich domain models with business logic encapsulation
- **Port & Adapters** - Technology-agnostic design with easy adapter swapping
- **Dependency Injection** - NestJS-based DI for testability and modularity

## 🚀 Quick Start

### Prerequisites

```bash
- Node.js 18+
- npm or yarn
- Redis (for caching)
```

### Installation

```bash
# Navigate to news-worker
cd enginedge-workers/news-worker

# Install dependencies
npm install

# Build the project
npm run build
```

### Configuration

Create a `.env` file:

```env
# Server
PORT=3009
NODE_ENV=development

# Redis Configuration
REDIS_URL=redis://localhost:6379/0
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_KEY_PREFIX=news:

# Cache Configuration
CACHE_DEFAULT_TTL=3600  # 1 hour in seconds

# Threading Configuration
WORKER_THREAD_MIN=2
WORKER_THREAD_MAX=8
WORKER_THREAD_IDLE_TIMEOUT=30000
WORKER_THREAD_TASK_TIMEOUT=60000
```

### Running the Service

```bash
# Development mode with hot reload
npm run start:dev

# Production mode
npm run start:prod

# Watch mode
npm run start
```

The service will start on `http://localhost:3009` (or your configured PORT).

### Health Check

```bash
curl http://localhost:3009/health
```

Expected response:
```json
{
  "status": "ok",
  "timestamp": "2025-10-24T...",
  "uptime": 123.45,
  "memory": {
    "used": 50000000,
    "total": 100000000
  },
  "redis": {
    "status": "healthy",
    "latency": 2
  }
}
```

## 🔌 API Endpoints

### Get News Feed

Get a paginated news feed with optional filtering.

```bash
GET /news/feed?page=1&pageSize=20&category=Technology&source=TechNews
```

**Query Parameters:**
- `page` (number, default: 1) - Page number
- `pageSize` (number, default: 20, max: 100) - Items per page
- `category` (string, optional) - Filter by category
- `source` (string, optional) - Filter by source
- `dateFrom` (string, optional) - Filter by start date (ISO 8601)
- `dateTo` (string, optional) - Filter by end date (ISO 8601)
- `tags` (string[], optional) - Filter by tags

**Response:**
```json
{
  "articles": [
    {
      "id": "1",
      "title": "Sample Technology News",
      "description": "A sample technology article",
      "content": "This is sample content...",
      "url": "https://example.com/article1",
      "published_date": "2025-10-24T10:00:00Z",
      "author": "Sample Author",
      "source": "Tech News",
      "category": "Technology",
      "tags": ["tech", "sample"],
      "image_url": "https://example.com/image.jpg"
    }
  ],
  "totalCount": 100,
  "page": 1,
  "pageSize": 20,
  "hasMore": true,
  "filters": {
    "availableCategories": ["Technology", "Business"],
    "availableSources": ["Tech News", "Business Daily"],
    "availableTags": ["tech", "business", "sample"]
  }
}
```

### Search Articles

Search articles with full-text search and relevance scoring.

```bash
GET /news/search?query=technology&page=1&pageSize=20
```

**Query Parameters:**
- `query` (string, required) - Search query
- `page` (number, default: 1) - Page number
- `pageSize` (number, default: 20, max: 100) - Items per page
- All filter parameters from feed endpoint are also supported

**Response:** Same format as feed endpoint, with articles sorted by relevance.

### Get Trending Articles

Get trending articles by category or globally.

```bash
GET /news/trending?limit=10&category=Technology
```

**Query Parameters:**
- `limit` (number, default: 10, max: 100) - Number of trending articles
- `category` (string, optional) - Filter by category

**Response:**
```json
[
  {
    "id": "1",
    "title": "Trending Technology News",
    ...
  }
]
```

## 🏗️ Architecture

### Hexagonal Architecture

The service follows hexagonal architecture principles:

```
┌─────────────────────────────────────────────────┐
│           Infrastructure Layer                  │
│  Controllers | Adapters | External Services    │
└─────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────┐
│           Application Layer                     │
│  Services | Use Cases | DTOs                    │
└─────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────┐
│           Domain Layer                          │
│  Entities | Value Objects | Domain Services     │
└─────────────────────────────────────────────────┘
```

### Layer Responsibilities

**Domain Layer** (`src/domain/`)
- `NewsArticle` - Core news article entity with business logic
- `NewsFeed` - Paginated feed entity
- Pure business logic with no external dependencies

**Application Layer** (`src/application/`)
- `NewsService` - Application service for news operations
- DTOs for request/response validation
- Port interfaces for repositories and external services

**Infrastructure Layer** (`src/infrastructure/`)
- `NewsController` - HTTP API endpoints
- `InMemoryNewsRepository` - In-memory repository (replace with DB adapter)
- `RedisCacheAdapter` - Redis caching implementation
- `WorkerThreadPool` - Multi-threaded processing

## 💾 Caching

### Redis Caching Strategy

The service uses Redis for distributed caching:

- **Feed Cache** - 15 minutes TTL
- **Search Cache** - 10 minutes TTL
- **Trending Cache** - 5 minutes TTL

### Cache Keys

- `news:feed:page:1:pageSize:20:category:Technology`
- `news:search:query:technology:page:1`
- `news:trending:limit:10:category:Technology`

### Cache Invalidation

```typescript
// Invalidate all feed caches
await cache.deletePattern('feed:*');

// Invalidate specific category
await cache.deletePattern('feed:*:category:Technology');
```

## 🧵 Threading

### Worker Thread Pool

The service uses a worker thread pool for concurrent processing:

- **Min Workers** - 2 (configurable)
- **Max Workers** - CPU count * 2 (configurable)
- **Idle Timeout** - 30 seconds (configurable)
- **Task Timeout** - 60 seconds (configurable)

### Usage

```typescript
// Execute task in worker thread
const result = await workerThreadPool.execute(
  'task-id',
  { articles: articles },
  priority
);
```

## 📊 Metrics & Monitoring

### Prometheus Metrics

The service exposes Prometheus metrics at `/metrics`:

- `news_worker_requests_total` - Total HTTP requests
- `news_worker_response_time_seconds` - Response time histogram
- `news_worker_cache_hits_total` - Cache hit counter
- `news_worker_cache_misses_total` - Cache miss counter
- `news_worker_thread_pool_active_tasks` - Active thread pool tasks

### Health Endpoints

- `GET /health` - Basic health check
- `GET /health/ready` - Readiness probe (checks Redis)
- `GET /health/live` - Liveness probe

## 🧪 Testing

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:cov

# Run unit tests only
npm run test:unit

# Run e2e tests
npm run test:e2e
```

## 🐳 Docker

### Build Image

```bash
docker build -t news-worker:latest .
```

### Run Container

```bash
docker run -p 3009:3009 \
  -e REDIS_URL=redis://redis:6379/0 \
  -e PORT=3009 \
  news-worker:latest
```

### Docker Compose

```yaml
services:
  news-worker:
    build: ./news-worker
    ports:
      - "3009:3009"
    environment:
      REDIS_URL: redis://redis:6379/0
      PORT: 3009
    depends_on:
      - redis
```

## 🔧 Development

### Project Structure

```
src/
├── domain/              # Domain layer
│   └── entities/       # NewsArticle, NewsFeed
├── application/        # Application layer
│   ├── dto/           # DTOs
│   ├── services/      # NewsService
│   └── ports/         # Port interfaces
├── infrastructure/     # Infrastructure layer
│   ├── adapters/      # Redis, Repository adapters
│   ├── controllers/   # NewsController
│   └── threading/     # Worker thread pool
└── health/            # Health check endpoints
```

### Code Quality

```bash
# Lint code
npm run lint

# Format code
npm run format

# Type check
npm run build
```

## 📝 License

Proprietary - All rights reserved

## 🤝 Contributing

This is a private project. For contributions, please contact the EnginEdge team.

---

**Part of the EnginEdge Platform** | [System Overview](../../README.md) | [API Documentation](./documentation/API.md)
