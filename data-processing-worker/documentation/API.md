# Data Processing Worker - API Documentation

## Table of Contents

- [Overview](#overview)
- [Authentication](#authentication)
- [Base URL](#base-url)
- [Response Format](#response-format)
- [Error Handling](#error-handling)
- [Document Processing API](#document-processing-api)
- [Vector Store API](#vector-store-api)
- [Embedder API](#embedder-api)
- [Health & Status](#health--status)

---

## Overview

The Data Processing Worker exposes **16+ REST API endpoints** organized into the following categories:

| Category | Endpoints | Description |
|----------|-----------|-------------|
| **Document Processing** | 4 | Load, parse, process documents |
| **Vector Store** | 8 | Search, store, update documents |
| **Embedders** | 4 | Generate embeddings, batch processing |
| **Health** | 1 | System health check |

**Total Endpoints:** 16+

---

## Authentication

Currently, the API uses user-based identification:

```bash
# Include userId in request body or header
{
  "userId": "user123",
  ...
}
```

For production, implement one of:
- **API Keys:** Header-based authentication
- **JWT Tokens:** Bearer token authentication
- **OAuth 2.0:** Third-party authentication

---

## Base URL

```
Development: http://localhost:3002
Production: https://data-processing.yourdomain.com
```

---

## Response Format

### Success Response

```json
{
  "id": "doc_123",
  "status": "success",
  "data": {
    // Response payload
  },
  "timestamp": "2025-10-24T12:00:00.000Z"
}
```

### Error Response

```json
{
  "statusCode": 400,
  "message": "Invalid document format",
  "error": "Bad Request",
  "details": "File must be PDF, DOCX, or TXT",
  "timestamp": "2025-10-24T12:00:00.000Z",
  "path": "/documents/process"
}
```

---

## Error Handling

### HTTP Status Codes

| Code | Meaning | Description |
|------|---------|-------------|
| 200 | OK | Request succeeded |
| 201 | Created | Resource created successfully |
| 400 | Bad Request | Invalid request parameters |
| 401 | Unauthorized | Authentication required |
| 403 | Forbidden | Access denied |
| 404 | Not Found | Resource not found |
| 409 | Conflict | Resource already exists |
| 429 | Too Many Requests | Rate limit exceeded |
| 500 | Server Error | Internal server error |
| 503 | Service Unavailable | Service temporarily unavailable |

### Common Error Responses

**Invalid File Format**
```json
{
  "statusCode": 400,
  "message": "Unsupported file type",
  "error": "Bad Request",
  "details": "Supported formats: PDF, DOCX, TXT, CSV, EPUB, PPTX, SRT, MD"
}
```

**Document Not Found**
```json
{
  "statusCode": 404,
  "message": "Document not found",
  "error": "Not Found",
  "id": "doc_invalid"
}
```

**Vector Store Error**
```json
{
  "statusCode": 500,
  "message": "Vector store operation failed",
  "error": "Internal Server Error",
  "operation": "similaritySearch"
}
```

---

## Document Processing API

### Load Document

**Endpoint:** `POST /documents/load`

**Description:** Load a document from file or URL

**Request Body:**
```json
{
  "userId": "user123",
  "source": "file",
  "format": "pdf",
  "filePath": "/path/to/document.pdf",
  "metadata": {
    "title": "My Document",
    "category": "research"
  }
}
```

**Response:**
```json
{
  "id": "doc_abc123",
  "fileName": "document.pdf",
  "status": "loaded",
  "pageCount": 42,
  "totalCharacters": 125400,
  "metadata": {
    "source": "file",
    "loadedAt": "2025-10-24T12:00:00.000Z"
  }
}
```

**cURL Example:**
```bash
curl -X POST http://localhost:3002/documents/load \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "user123",
    "source": "file",
    "format": "pdf",
    "filePath": "/documents/research.pdf"
  }'
```

---

### Process Document

**Endpoint:** `POST /documents/process`

**Description:** Process document with text splitting and chunking

**Request Body:**
```json
{
  "userId": "user123",
  "documentId": "doc_abc123",
  "splitter": "recursive-character",
  "chunkSize": 512,
  "chunkOverlap": 50,
  "metadata": {
    "sourceType": "file",
    "mimeType": "application/pdf"
  }
}
```

**Response:**
```json
{
  "id": "doc_abc123",
  "status": "processed",
  "chunksCreated": 247,
  "totalTokens": 58904,
  "processingTime": "2.3s",
  "chunks": [
    {
      "id": "chunk_001",
      "content": "Introduction to machine learning...",
      "tokens": 245,
      "startPage": 1,
      "endPage": 2
    }
  ]
}
```

**Supported Splitters:**
- `recursive-character` - Splits on \n\n, \n, space (best for general text)
- `character` - Splits on single character
- `token` - Splits on tokens (LLM-aware)
- `semantic` - Semantic splitting (requires embeddings)
- `python`, `javascript`, `typescript` - Language-specific
- `java`, `cpp`, `go` - Language-specific
- `latex`, `markdown`, `html` - Format-specific

---

### Extract Text

**Endpoint:** `POST /documents/extract`

**Description:** Extract raw text from document

**Request Body:**
```json
{
  "userId": "user123",
  "documentId": "doc_abc123"
}
```

**Response:**
```json
{
  "id": "doc_abc123",
  "fileName": "document.pdf",
  "text": "Full document text...",
  "characterCount": 125400,
  "pageCount": 42,
  "extractedAt": "2025-10-24T12:00:00.000Z"
}
```

---

### Get Document

**Endpoint:** `GET /documents/:id`

**Description:** Get document metadata and info

**Response:**
```json
{
  "id": "doc_abc123",
  "fileName": "document.pdf",
  "format": "pdf",
  "size": 2584576,
  "pageCount": 42,
  "status": "processed",
  "chunks": 247,
  "createdAt": "2025-10-24T12:00:00.000Z",
  "updatedAt": "2025-10-24T12:05:30.000Z",
  "metadata": {
    "title": "My Document",
    "category": "research",
    "sourceType": "file"
  }
}
```

---

## Vector Store API

### Store Documents

**Endpoint:** `POST /vector-store/store`

**Description:** Store documents with embeddings in vector store

**Request Body:**
```json
{
  "userId": "user123",
  "documents": [
    {
      "id": "chunk_001",
      "content": "Document content...",
      "embedding": [0.1, 0.2, 0.3, ...],
      "metadata": {
        "documentId": "doc_abc123",
        "sourceType": "pdf",
        "pageNumber": 1
      }
    }
  ]
}
```

**Response:**
```json
{
  "status": "success",
  "stored": 247,
  "failed": 0,
  "totalTokens": 58904,
  "collectionId": "col_123"
}
```

---

### Similarity Search

**Endpoint:** `POST /vector-store/search`

**Description:** Search for similar documents by embedding

**Request Body:**
```json
{
  "userId": "user123",
  "queryEmbedding": [0.1, 0.2, 0.3, ...],
  "limit": 5,
  "filter": {
    "documentId": "doc_abc123"
  }
}
```

**Response:**
```json
{
  "results": [
    {
      "id": "chunk_001",
      "content": "Most similar content...",
      "score": 0.92,
      "metadata": {
        "documentId": "doc_abc123",
        "pageNumber": 5
      }
    }
  ],
  "count": 5,
  "searchTime": "45ms"
}
```

---

### Hybrid Search

**Endpoint:** `POST /vector-store/hybrid-search`

**Description:** Combined text and vector similarity search

**Request Body:**
```json
{
  "userId": "user123",
  "queryEmbedding": [0.1, 0.2, 0.3, ...],
  "queryText": "machine learning algorithms",
  "limit": 5,
  "filter": {}
}
```

**Response:**
```json
{
  "results": [
    {
      "id": "chunk_005",
      "content": "Machine learning algorithms...",
      "vectorScore": 0.85,
      "textScore": 0.78,
      "hybridScore": 0.83,
      "metadata": {}
    }
  ],
  "count": 5
}
```

**Hybrid Score Calculation:**
- `hybridScore = (vectorScore * 0.6) + (textScore * 0.4)`

---

### Search with Access Control

**Endpoint:** `POST /vector-store/search-with-access`

**Description:** Search with user/conversation access control

**Request Body:**
```json
{
  "userId": "user123",
  "queryEmbedding": [0.1, 0.2, 0.3, ...],
  "conversationId": "conv_456",
  "limit": 5
}
```

**Response:**
```json
{
  "results": [...],
  "count": 5,
  "accessControl": {
    "userId": "user123",
    "conversationId": "conv_456",
    "filtered": true
  }
}
```

---

### Search with Metadata Filter

**Endpoint:** `POST /vector-store/search-metadata`

**Description:** Search with metadata filtering

**Request Body:**
```json
{
  "userId": "user123",
  "queryEmbedding": [0.1, 0.2, 0.3, ...],
  "limit": 5,
  "sourceType": "pdf",
  "mimeType": "application/pdf",
  "createdAfter": "2025-10-01T00:00:00.000Z",
  "createdBefore": "2025-10-31T23:59:59.999Z"
}
```

**Response:**
```json
{
  "results": [...],
  "count": 5,
  "filters": {
    "sourceType": "pdf",
    "mimeType": "application/pdf",
    "dateRange": "2025-10-01 to 2025-10-31"
  }
}
```

---

### Batch Search

**Endpoint:** `POST /vector-store/batch-search`

**Description:** Execute multiple searches in batch

**Request Body:**
```json
{
  "userId": "user123",
  "queryEmbeddings": [
    [0.1, 0.2, 0.3, ...],
    [0.4, 0.5, 0.6, ...],
    [0.7, 0.8, 0.9, ...]
  ],
  "limit": 5
}
```

**Response:**
```json
{
  "results": [
    [/* results for query 1 */],
    [/* results for query 2 */],
    [/* results for query 3 */]
  ],
  "queriesCount": 3,
  "totalResults": 15
}
```

---

### Update Document

**Endpoint:** `POST /vector-store/document/:id`

**Description:** Update document content or metadata

**Request Body:**
```json
{
  "userId": "user123",
  "content": "Updated document content...",
  "metadata": {
    "category": "updated",
    "lastReview": "2025-10-24"
  }
}
```

**Response:**
```json
{
  "id": "doc_abc123",
  "status": "updated",
  "updatedAt": "2025-10-24T12:00:00.000Z",
  "metadata": {
    "updatedFields": ["content", "metadata"]
  }
}
```

---

### Get Document

**Endpoint:** `GET /vector-store/document/:id`

**Description:** Get document from vector store

**Response:**
```json
{
  "id": "chunk_001",
  "content": "Document content...",
  "metadata": {
    "documentId": "doc_abc123",
    "pageNumber": 5
  },
  "storedAt": "2025-10-24T12:00:00.000Z"
}
```

---

### Delete Documents

**Endpoint:** `DELETE /vector-store/documents`

**Description:** Delete multiple documents

**Request Body:**
```json
{
  "userId": "user123",
  "ids": ["chunk_001", "chunk_002", "chunk_003"]
}
```

**Response:**
```json
{
  "status": "deleted",
  "deletedCount": 3,
  "message": "Documents deleted successfully"
}
```

---

## Embedder API

### Generate Embedding

**Endpoint:** `POST /embedders/embed`

**Description:** Generate embedding for single text

**Request Body:**
```json
{
  "userId": "user123",
  "text": "Machine learning is a subset of AI",
  "provider": "openai"
}
```

**Response:**
```json
{
  "text": "Machine learning is a subset of AI",
  "embedding": [0.1, 0.2, 0.3, ...],
  "dimensions": 1536,
  "provider": "openai",
  "model": "text-embedding-3-small",
  "cached": false,
  "generatedAt": "2025-10-24T12:00:00.000Z"
}
```

---

### Batch Embedding

**Endpoint:** `POST /embedders/batch`

**Description:** Generate embeddings for multiple texts (with deduplication)

**Request Body:**
```json
{
  "userId": "user123",
  "texts": [
    "Machine learning",
    "Deep learning",
    "Machine learning"
  ],
  "provider": "openai"
}
```

**Response:**
```json
{
  "count": 3,
  "embeddings": [
    [0.1, 0.2, 0.3, ...],
    [0.4, 0.5, 0.6, ...],
    [0.1, 0.2, 0.3, ...]
  ],
  "dimensions": 1536,
  "provider": "openai",
  "deduplication": {
    "unique": 2,
    "duplicates": 1,
    "apiCallsReduced": 1
  },
  "cached": 1,
  "processingTime": "1.2s"
}
```

**Deduplication Benefits:**
- Reduces API calls by 30-40%
- Caches duplicate embeddings
- Maps results back to original array order

---

### List Available Embedders

**Endpoint:** `GET /embedders/available`

**Description:** Get list of available embedder providers

**Response:**
```json
{
  "count": 5,
  "embedders": [
    {
      "name": "OpenAI",
      "provider": "openai",
      "models": ["text-embedding-3-small", "text-embedding-3-large"],
      "dimensions": 1536,
      "costPerMillion": 0.02,
      "description": "SOTA embeddings, best quality"
    },
    {
      "name": "Google",
      "provider": "google",
      "models": ["embedding-001"],
      "dimensions": 768,
      "costPerMillion": 0.0,
      "description": "Free tier available, good quality"
    },
    {
      "name": "Cohere",
      "provider": "cohere",
      "models": ["embed-english-v3.0"],
      "dimensions": 1024,
      "costPerMillion": 0.10,
      "description": "Fast, production-ready"
    },
    {
      "name": "Local",
      "provider": "local",
      "models": ["all-minilm-l6-v2"],
      "dimensions": 384,
      "costPerMillion": 0.0,
      "description": "Offline, no network latency"
    },
    {
      "name": "HuggingFace",
      "provider": "huggingface",
      "models": ["all-MiniLM-L6-v2"],
      "dimensions": 384,
      "costPerMillion": 0.0,
      "description": "Open source models, free"
    }
  ]
}
```

---

### Get Embedder Statistics

**Endpoint:** `GET /embedders/stats`

**Description:** Get embedder cache and performance statistics

**Response:**
```json
{
  "currentEmbedder": "openai",
  "cacheSize": 1247,
  "cacheSizeBytes": 8192000,
  "cacheSizeMB": 7.8,
  "cacheMetrics": {
    "hits": 245,
    "misses": 58,
    "hitRate": 0.809,
    "avgLookupTime": "0.5ms"
  },
  "availableEmbedders": [
    "openai",
    "google",
    "cohere",
    "local",
    "huggingface"
  ],
  "performanceMetrics": {
    "totalEmbeddings": 12847,
    "uniqueTexts": 8904,
    "deduplicationRate": 0.308,
    "apiCallsSaved": 3943,
    "costSavings": "$78.86"
  }
}
```

---

## Health & Status

### Health Check

**Endpoint:** `GET /health`

**Description:** Get system health status

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2025-10-24T12:00:00.000Z",
  "services": {
    "documentProcessing": "operational",
    "vectorStore": "operational",
    "embedders": "operational",
    "mongodb": "connected",
    "kafka": "connected"
  },
  "metrics": {
    "uptime": 86400,
    "processedDocuments": 1247,
    "activeConnections": 5,
    "memoryUsage": "245MB"
  }
}
```

---

## Rate Limiting

The API implements rate limiting:

| Endpoint | Limit | Window |
|----------|-------|--------|
| `/documents/*` | 100 | 1 minute |
| `/vector-store/*` | 500 | 1 minute |
| `/embedders/*` | 200 | 1 minute |
| `/health` | 1000 | 1 minute |

**Rate Limit Headers:**
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 45
X-RateLimit-Reset: 2025-10-24T12:01:00.000Z
```

---

## Best Practices

### 1. **Batch Operations**
Use batch endpoints when processing multiple items:
- `/embedders/batch` for multiple embeddings
- `/vector-store/batch-search` for multiple searches

### 2. **Caching**
The system automatically caches embeddings. For best results:
- Reuse embeddings when possible
- Check cache statistics via `/embedders/stats`

### 3. **Error Handling**
Always implement retry logic with exponential backoff:
```javascript
async function retryRequest(fn, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      await new Promise(r => setTimeout(r, 1000 * Math.pow(2, i)));
    }
  }
}
```

### 4. **Memory Management**
- Monitor cache size via `/embedders/stats`
- Clear cache periodically for long-running processes
- Consider batch processing for large datasets

### 5. **Monitoring**
- Check `/health` endpoint regularly
- Monitor rate limit headers
- Log API response times

---

**API Version:** 1.0  
**Last Updated:** October 24, 2025  
**Status:** Stable
