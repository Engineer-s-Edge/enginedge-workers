# Agent Tool Worker - API Documentation

## Table of Contents

- [Overview](#overview)
- [Authentication](#authentication)
- [Base URL](#base-url)
- [Response Format](#response-format)
- [Error Handling](#error-handling)
- [Tool Registration API](#tool-registration-api)
- [Tool Execution API](#tool-execution-api)
- [Retriever API](#retriever-api)
- [Actor API](#actor-api)
- [OAuth Management API](#oauth-management-api)
- [Rate Limiting API](#rate-limiting-api)
- [Health & Metrics](#health--metrics)

---

## Overview

The Agent Tool Worker exposes **50+ REST API endpoints** organized into the following categories:

| Category | Endpoints | Description |
|----------|-----------|-------------|
| **Tool Management** | 5 | Register, list, execute, validate tools |
| **Tool Execution** | 8 | Execute tools with various configurations |
| **Retrievers** | 12 | Query and retrieve data from external sources |
| **Actors** | 10 | Execute agent-like workflows |
| **OAuth Management** | 5 | Manage OAuth tokens and authentication |
| **Rate Limiting** | 6 | Monitor and manage API rate limits |
| **Health/Metrics** | 4 | System health, metrics, and status |

---

## Authentication

The API supports multiple authentication methods:

```bash
# API Key Authentication
curl -H "X-API-Key: your-api-key" http://localhost:3001/tools

# Bearer Token (OAuth)
curl -H "Authorization: Bearer your-token" http://localhost:3001/tools

# Basic Authentication
curl -u username:password http://localhost:3001/tools
```

For tool execution with external APIs, include credentials:

```json
{
  "toolName": "google_drive_retriever",
  "input": {
    "query": "project documents"
  },
  "credentials": {
    "accessToken": "google-oauth-token",
    "apiKey": "google-api-key"
  }
}
```

---

## Base URL

```
Development: http://localhost:3001
Staging: https://agent-tool-staging.yourdomain.com
Production: https://agent-tool.yourdomain.com
```

---

## Response Format

### Success Response

```json
{
  "success": true,
  "data": {
    "toolName": "google_drive_retriever",
    "result": {
      "files": [
        {
          "id": "file_123",
          "name": "Project Plan.pdf",
          "mimeType": "application/pdf",
          "size": 2048000
        }
      ],
      "totalResults": 1,
      "nextPageToken": "token_123"
    }
  },
  "timestamp": "2025-10-24T12:00:00.000Z",
  "executionTime": 234
}
```

### Error Response

```json
{
  "success": false,
  "error": {
    "code": "TOOL_NOT_FOUND",
    "message": "Tool 'invalid_tool' not found in registry",
    "details": {
      "availableTools": ["google_drive_retriever", "notion_retriever", "todoist_retriever"]
    }
  },
  "timestamp": "2025-10-24T12:00:00.000Z",
  "path": "/tools/invalid_tool/execute"
}
```

---

## Error Handling

### HTTP Status Codes

| Code | Meaning | Description |
|------|---------|-------------|
| 200 | OK | Successful request |
| 201 | Created | Resource created successfully |
| 400 | Bad Request | Invalid input parameters |
| 401 | Unauthorized | Missing or invalid authentication |
| 403 | Forbidden | Insufficient permissions |
| 404 | Not Found | Tool or resource not found |
| 429 | Too Many Requests | Rate limit exceeded |
| 500 | Internal Server Error | Server error |
| 503 | Service Unavailable | Dependency service unavailable |

### Error Response Types

#### Tool Not Found
```json
{
  "success": false,
  "error": {
    "code": "TOOL_NOT_FOUND",
    "message": "Tool 'weather_retriever' not found",
    "statusCode": 404
  }
}
```

#### Authentication Failed
```json
{
  "success": false,
  "error": {
    "code": "AUTHENTICATION_FAILED",
    "message": "Invalid OAuth token for Google Drive",
    "statusCode": 401,
    "details": {
      "provider": "google_drive",
      "reason": "Token expired"
    }
  }
}
```

#### Rate Limit Exceeded
```json
{
  "success": false,
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Rate limit exceeded for Notion API",
    "statusCode": 429,
    "details": {
      "retryAfter": 45,
      "limit": "3 requests per second",
      "current": 3,
      "resetTime": "2025-10-24T12:01:00.000Z"
    }
  }
}
```

#### Validation Error
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Input validation failed",
    "statusCode": 400,
    "details": {
      "fields": {
        "query": "Query is required",
        "max_results": "Must be between 1 and 100"
      }
    }
  }
}
```

---

## Tool Registration API

### List All Tools

```http
GET /tools HTTP/1.1
Host: localhost:3001
X-API-Key: your-api-key
```

**Response:**
```json
{
  "success": true,
  "data": {
    "tools": [
      {
        "name": "google_drive_retriever",
        "type": "retriever",
        "description": "Search and retrieve files from Google Drive",
        "authentication": "oauth2",
        "rateLimit": "10000 requests/day",
        "enabled": true
      },
      {
        "name": "notion_retriever",
        "type": "retriever",
        "description": "Query and retrieve pages from Notion",
        "authentication": "bearer_token",
        "rateLimit": "3 requests/second",
        "enabled": true
      }
    ],
    "totalTools": 12,
    "categories": {
      "retrievers": 8,
      "actors": 6
    }
  }
}
```

### Get Tool Details

```http
GET /tools/google_drive_retriever HTTP/1.1
Host: localhost:3001
X-API-Key: your-api-key
```

**Response:**
```json
{
  "success": true,
  "data": {
    "name": "google_drive_retriever",
    "type": "retriever",
    "description": "Search and retrieve files from Google Drive",
    "version": "1.0.0",
    "authentication": {
      "type": "oauth2",
      "requiredScopes": [
        "https://www.googleapis.com/auth/drive.readonly"
      ]
    },
    "inputSchema": {
      "query": {
        "type": "string",
        "description": "Search query",
        "required": true
      },
      "max_results": {
        "type": "number",
        "description": "Maximum results to return",
        "minimum": 1,
        "maximum": 1000,
        "default": 10
      },
      "file_types": {
        "type": "array",
        "description": "File types to filter",
        "items": ["pdf", "doc", "xlsx", "image"]
      }
    },
    "rateLimit": {
      "requestsPerDay": 10000,
      "requestsPerSecond": 5
    },
    "endpoints": [
      "https://www.googleapis.com/drive/v3/files"
    ]
  }
}
```

### Register Custom Tool

```http
POST /tools/register HTTP/1.1
Host: localhost:3001
Content-Type: application/json
X-API-Key: your-api-key

{
  "name": "custom_tool",
  "type": "actor",
  "description": "Custom tool implementation",
  "handlerPath": "./handlers/custom-tool.handler",
  "authentication": "api_key",
  "config": {
    "timeout": 30000,
    "retries": 3
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "toolId": "tool_abc123",
    "name": "custom_tool",
    "registered": true,
    "timestamp": "2025-10-24T12:00:00.000Z"
  }
}
```

---

## Tool Execution API

### Execute Tool

```http
POST /tools/google_drive_retriever/execute HTTP/1.1
Host: localhost:3001
Content-Type: application/json
X-API-Key: your-api-key

{
  "input": {
    "query": "project documents",
    "max_results": 10,
    "file_types": ["pdf", "doc"]
  },
  "timeout": 30000,
  "retryPolicy": "exponential"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "toolName": "google_drive_retriever",
    "result": {
      "query": "project documents",
      "totalFiles": 5,
      "files": [
        {
          "id": "file_123",
          "name": "Project Charter.pdf",
          "mimeType": "application/pdf",
          "size": 2048000,
          "modifiedTime": "2025-10-20T10:30:00.000Z",
          "createdTime": "2025-10-15T14:20:00.000Z",
          "owners": [
            {
              "name": "John Doe",
              "email": "john@example.com"
            }
          ],
          "webViewLink": "https://drive.google.com/file/d/file_123/view"
        }
      ],
      "nextPageToken": "token_123"
    }
  },
  "executionTime": 342,
  "timestamp": "2025-10-24T12:00:00.000Z"
}
```

### Batch Execute Tools

```http
POST /tools/batch/execute HTTP/1.1
Host: localhost:3001
Content-Type: application/json
X-API-Key: your-api-key

{
  "requests": [
    {
      "toolName": "google_drive_retriever",
      "input": {
        "query": "reports",
        "max_results": 5
      }
    },
    {
      "toolName": "notion_retriever",
      "input": {
        "query": "Q4 planning",
        "max_results": 10
      }
    }
  ],
  "parallel": true,
  "timeout": 60000
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "results": [
      {
        "toolName": "google_drive_retriever",
        "status": "success",
        "result": { /* ... */ },
        "executionTime": 342
      },
      {
        "toolName": "notion_retriever",
        "status": "success",
        "result": { /* ... */ },
        "executionTime": 256
      }
    ],
    "totalExecutionTime": 378,
    "successCount": 2,
    "failureCount": 0
  }
}
```

---

## Retriever API

### Google Drive Retriever

```http
POST /tools/google_drive_retriever/execute HTTP/1.1

{
  "input": {
    "query": "budget 2025",
    "folder_id": "folder_abc123",
    "file_types": ["spreadsheet", "document"],
    "owner": "user@example.com",
    "modified_after": "2025-10-01",
    "modified_before": "2025-10-31",
    "min_size": 1000,
    "max_size": 10000000,
    "max_results": 50,
    "order_by": "modifiedTime",
    "include_trash": false
  }
}
```

### Notion Retriever

```http
POST /tools/notion_retriever/execute HTTP/1.1

{
  "input": {
    "query": "team meeting notes",
    "database_id": "db_xyz789",
    "filter": {
      "property": "Status",
      "select": {
        "equals": "Done"
      }
    },
    "sort": [
      {
        "property": "Created",
        "direction": "descending"
      }
    ],
    "max_results": 25,
    "search_in": "content"
  }
}
```

### Todoist Retriever

```http
POST /tools/todoist_retriever/execute HTTP/1.1

{
  "input": {
    "query": "urgent tasks",
    "filter": "@work & (priority = 4 | due = today)",
    "project_id": "project_123",
    "priority": [3, 4],
    "status": "active",
    "due_after": "2025-10-20",
    "sort_by": "due_date",
    "sort_order": "ascending",
    "max_results": 100,
    "offset": 0
  }
}
```

---

## OAuth Management API

### Authenticate with OAuth Provider

```http
POST /oauth/authenticate HTTP/1.1
Content-Type: application/json

{
  "provider": "google",
  "redirectUri": "http://localhost:3000/oauth/callback",
  "scopes": [
    "https://www.googleapis.com/auth/drive.readonly",
    "https://www.googleapis.com/auth/calendar.readonly"
  ]
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "authorizationUrl": "https://accounts.google.com/o/oauth2/v2/auth?...",
    "state": "state_token_abc123",
    "expiresIn": 3600
  }
}
```

### Exchange Code for Token

```http
POST /oauth/token HTTP/1.1
Content-Type: application/json

{
  "provider": "google",
  "code": "authorization_code_xyz",
  "state": "state_token_abc123"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "accessToken": "access_token_abc123...",
    "refreshToken": "refresh_token_xyz789...",
    "expiresIn": 3600,
    "tokenType": "Bearer",
    "scope": "https://www.googleapis.com/auth/drive.readonly"
  }
}
```

### Refresh Access Token

```http
POST /oauth/refresh HTTP/1.1
Content-Type: application/json

{
  "provider": "google",
  "refreshToken": "refresh_token_xyz789..."
}
```

### List Connected Accounts

```http
GET /oauth/accounts HTTP/1.1
X-API-Key: your-api-key
```

**Response:**
```json
{
  "success": true,
  "data": {
    "accounts": [
      {
        "provider": "google",
        "email": "user@example.com",
        "connectedAt": "2025-10-01T10:00:00.000Z",
        "expiresAt": "2025-10-24T12:00:00.000Z",
        "scopes": [
          "https://www.googleapis.com/auth/drive.readonly",
          "https://www.googleapis.com/auth/calendar.readonly"
        ]
      },
      {
        "provider": "notion",
        "workspace": "My Workspace",
        "connectedAt": "2025-10-05T14:30:00.000Z",
        "expiresAt": null
      }
    ]
  }
}
```

---

## Rate Limiting API

### Get Rate Limit Status

```http
GET /rate-limits/status HTTP/1.1
X-API-Key: your-api-key
```

**Response:**
```json
{
  "success": true,
  "data": {
    "apis": {
      "google_drive": {
        "requestsPerSecond": {
          "limit": 10,
          "current": 3,
          "available": 7
        },
        "requestsPerMinute": {
          "limit": 300,
          "current": 45,
          "available": 255
        },
        "requestsPerHour": {
          "limit": 10000,
          "current": 800,
          "available": 9200
        },
        "quotaPercentage": 8,
        "nextReset": "2025-10-24T13:00:00.000Z"
      },
      "notion": {
        "requestsPerSecond": {
          "limit": 3,
          "current": 2,
          "available": 1
        },
        "quotaPercentage": 67
      }
    }
  }
}
```

### Check Request Feasibility

```http
POST /rate-limits/check HTTP/1.1
Content-Type: application/json
X-API-Key: your-api-key

{
  "apis": ["google_drive", "notion", "todoist"]
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "canMakeRequest": {
      "google_drive": true,
      "notion": false,
      "todoist": true
    },
    "waitTimes": {
      "google_drive": 0,
      "notion": 45,
      "todoist": 0
    }
  }
}
```

---

## Health & Metrics

### Health Check

```http
GET /health HTTP/1.1
```

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2025-10-24T12:00:00.000Z",
  "uptime": 345600,
  "services": {
    "google_drive": "connected",
    "notion": "connected",
    "todoist": "connected"
  }
}
```

### Metrics

```http
GET /metrics HTTP/1.1
```

**Response:**
```json
{
  "success": true,
  "data": {
    "uptime": 345600,
    "requestsTotal": 5432,
    "requestsPerSecond": 0.23,
    "errorRate": 0.02,
    "averageResponseTime": 234,
    "toolsRegistry": {
      "total": 12,
      "active": 11,
      "failed": 1
    },
    "rateLimit": {
      "exceedances": 3,
      "lastExceededAt": "2025-10-24T11:30:00.000Z"
    }
  }
}
```

