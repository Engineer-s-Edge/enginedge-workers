# News Worker - API Documentation

## Table of Contents

- [Overview](#overview)
- [Authentication](#authentication)
- [Base URL](#base-url)
- [Response Format](#response-format)
- [Error Handling](#error-handling)
- [News Feed API](#news-feed-api)
- [Search API](#search-api)
- [Trending API](#trending-api)
- [Health & Metrics](#health--metrics)

---

## Overview

The News Worker exposes **REST API endpoints** for news aggregation, feed management, and article search:

| Category | Endpoints | Description |
|----------|-----------|-------------|
| **News Feed** | 2 | Get paginated feeds, get article by ID |
| **Search** | 1 | Full-text article search |
| **Trending** | 1 | Get trending articles |
| **Health/Metrics** | 2 | System health |

---

## Base URL

```
Development: http://localhost:3009
Production: https://news.yourdomain.com
```

---

## News Feed API

### Get News Feed

**Endpoint:** `GET /news/feed`

**Description:** Get paginated news feed with optional filtering

**Query Parameters:**
- `page` (number, default: 1) - Page number
- `pageSize` (number, default: 20, max: 100) - Items per page
- `category` (string, optional) - Filter by category
- `source` (string, optional) - Filter by source
- `dateFrom` (string, optional) - Filter by start date (ISO 8601)
- `dateTo` (string, optional) - Filter by end date (ISO 8601)
- `tags` (string[], optional) - Filter by tags

**Response:** `200 OK`
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
  "hasMore": true
}
```

---

### Get Article by ID

**Endpoint:** `GET /news/:id`

**Description:** Get a specific article by ID

**Response:** `200 OK`
```json
{
  "id": "1",
  "title": "Sample Technology News",
  "description": "A sample technology article",
  "content": "Full article content...",
  "url": "https://example.com/article1",
  "published_date": "2025-10-24T10:00:00Z",
  "author": "Sample Author",
  "source": "Tech News",
  "category": "Technology",
  "tags": ["tech", "sample"],
  "image_url": "https://example.com/image.jpg"
}
```

---

## Search API

### Search Articles

**Endpoint:** `GET /news/search`

**Description:** Search articles with full-text search and relevance scoring

**Query Parameters:**
- `query` (string, required) - Search query
- `page` (number, default: 1) - Page number
- `pageSize` (number, default: 20, max: 100) - Items per page
- All filter parameters from feed endpoint are also supported

**Response:** `200 OK`
```json
{
  "articles": [...],
  "totalCount": 50,
  "page": 1,
  "pageSize": 20,
  "hasMore": true,
  "query": "technology"
}
```

---

## Trending API

### Get Trending Articles

**Endpoint:** `GET /news/trending`

**Description:** Get trending articles by category or globally

**Query Parameters:**
- `limit` (number, default: 10, max: 100) - Number of trending articles
- `category` (string, optional) - Filter by category

**Response:** `200 OK`
```json
[
  {
    "id": "1",
    "title": "Trending Technology News",
    "description": "...",
    "trendingScore": 0.95,
    "published_date": "2025-10-24T10:00:00Z"
  }
]
```

---

## Health & Metrics

### Health Check

**Endpoint:** `GET /health`

**Response:** `200 OK`
```json
{
  "status": "ok",
  "timestamp": "2025-10-24T12:00:00.000Z",
  "uptime": 123.45,
  "redis": {
    "status": "healthy",
    "latency": 2
  }
}
```

---

For complete OpenAPI 3.0 specification, see [openapi.yaml](openapi.yaml).
