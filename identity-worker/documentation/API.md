# Identity Worker - API Documentation

## Table of Contents

- [Overview](#overview)
- [Authentication](#authentication)
- [Base URL](#base-url)
- [Response Format](#response-format)
- [Error Handling](#error-handling)
- [Authentication API](#authentication-api)
- [OAuth API](#oauth-api)
- [User Management API](#user-management-api)
- [JWKS API](#jwks-api)
- [Health & Metrics](#health--metrics)

---

## Overview

The Identity Worker exposes **REST API endpoints** for authentication, authorization, and user management:

| Category | Endpoints | Description |
|----------|-----------|-------------|
| **Authentication** | 5 | Login, register, profile, token refresh/revoke |
| **OAuth** | 3 | OAuth2/OIDC provider integration |
| **Users** | 5 | User CRUD operations |
| **JWKS** | 1 | JSON Web Key Set for token validation |
| **Health/Metrics** | 2 | System health |

---

## Authentication

All endpoints require authentication via JWT Bearer tokens:

```bash
# Include token in Authorization header
Authorization: Bearer <jwt_token>
```

For OAuth endpoints, use the provider-specific authentication flow.

---

## Base URL

```
Development: http://localhost:3008
Production: https://identity.yourdomain.com
```

---

## Response Format

### Success Response

```json
{
  "id": "user_123",
  "email": "user@example.com",
  "name": "John Doe",
  "status": "success",
  "timestamp": "2025-10-24T12:00:00.000Z"
}
```

### Error Response

```json
{
  "statusCode": 400,
  "message": "Invalid credentials",
  "error": "Bad Request",
  "timestamp": "2025-10-24T12:00:00.000Z",
  "path": "/internal/auth/login"
}
```

---

## Error Handling

### HTTP Status Codes

| Code | Meaning | Description |
|------|---------|-------------|
| `200` | OK | Request successful |
| `201` | Created | Resource created |
| `204` | No Content | Successful, no response body |
| `400` | Bad Request | Invalid input |
| `401` | Unauthorized | Authentication required |
| `403` | Forbidden | Access denied |
| `404` | Not Found | Resource not found |
| `409` | Conflict | Resource conflict |
| `422` | Unprocessable Entity | Validation error |
| `500` | Internal Server Error | Server error |

---

## Authentication API

### Login

**Endpoint:** `POST /internal/auth/login`

**Description:** Authenticate user with email and password

**Request:**
```json
{
  "email": "user@example.com",
  "password": "securepassword"
}
```

**Response:** `200 OK`
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expiresIn": 900,
  "user": {
    "id": "user_123",
    "email": "user@example.com",
    "name": "John Doe"
  }
}
```

---

### Register

**Endpoint:** `POST /internal/auth/register`

**Description:** Register a new user account

**Request:**
```json
{
  "email": "user@example.com",
  "password": "securepassword",
  "name": "John Doe",
  "tenantId": "tenant_123"
}
```

**Response:** `201 Created`
```json
{
  "id": "user_123",
  "email": "user@example.com",
  "name": "John Doe",
  "createdAt": "2025-10-24T12:00:00.000Z"
}
```

---

### Get Profile

**Endpoint:** `GET /internal/auth/profile?userId={userId}`

**Description:** Get user profile information

**Query Parameters:**
- `userId` (required): User identifier

**Response:** `200 OK`
```json
{
  "id": "user_123",
  "email": "user@example.com",
  "name": "John Doe",
  "tenantId": "tenant_123",
  "createdAt": "2025-10-24T12:00:00.000Z"
}
```

---

### Refresh Token

**Endpoint:** `POST /internal/auth/token/refresh`

**Description:** Refresh access token using refresh token

**Request:**
```json
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Response:** `200 OK`
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expiresIn": 900
}
```

---

### Revoke Token

**Endpoint:** `POST /internal/auth/token/revoke`

**Description:** Revoke a refresh token

**Request:**
```json
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Response:** `200 OK`
```json
{
  "success": true,
  "message": "Token revoked"
}
```

---

## OAuth API

### Get Auth URL

**Endpoint:** `GET /internal/oauth/:provider/auth?userId={userId}`

**Description:** Get OAuth authorization URL for provider

**Path Parameters:**
- `provider` (required): OAuth provider (google, github, etc.)

**Query Parameters:**
- `userId` (optional): User identifier

**Response:** `200 OK`
```json
{
  "authUrl": "https://accounts.google.com/o/oauth2/v2/auth?...",
  "state": "random_state_string"
}
```

---

### OAuth Callback

**Endpoint:** `GET /internal/oauth/:provider/callback?code={code}&state={state}&userId={userId}`

**Description:** Handle OAuth callback and link account

**Path Parameters:**
- `provider` (required): OAuth provider

**Query Parameters:**
- `code` (required): Authorization code
- `state` (optional): State parameter
- `userId` (optional): User identifier

**Response:** `200 OK`
```json
{
  "success": true,
  "account": {
    "provider": "google",
    "providerId": "google_user_id",
    "email": "user@gmail.com"
  }
}
```

---

### Unlink Account

**Endpoint:** `DELETE /internal/oauth/:provider/unlink?userId={userId}`

**Description:** Unlink OAuth account from user

**Path Parameters:**
- `provider` (required): OAuth provider

**Query Parameters:**
- `userId` (required): User identifier

**Response:** `200 OK`
```json
{
  "success": true,
  "message": "Account unlinked"
}
```

---

## User Management API

### Get User by ID

**Endpoint:** `GET /internal/users/:id`

**Description:** Get user by identifier

**Response:** `200 OK`
```json
{
  "id": "user_123",
  "email": "user@example.com",
  "name": "John Doe",
  "tenantId": "tenant_123"
}
```

---

### Get User by Email

**Endpoint:** `GET /internal/users?email={email}`

**Description:** Get user by email address

**Query Parameters:**
- `email` (required): User email

**Response:** `200 OK`
```json
[
  {
    "id": "user_123",
    "email": "user@example.com",
    "name": "John Doe"
  }
]
```

---

### Create User

**Endpoint:** `POST /internal/users`

**Description:** Create a new user

**Request:**
```json
{
  "email": "user@example.com",
  "password": "securepassword",
  "name": "John Doe",
  "tenantId": "tenant_123"
}
```

**Response:** `201 Created`
```json
{
  "id": "user_123",
  "email": "user@example.com",
  "name": "John Doe",
  "createdAt": "2025-10-24T12:00:00.000Z"
}
```

---

### Update User

**Endpoint:** `PATCH /internal/users/:id`

**Description:** Update user information

**Request:**
```json
{
  "name": "John Updated",
  "email": "newemail@example.com"
}
```

**Response:** `200 OK`
```json
{
  "id": "user_123",
  "email": "newemail@example.com",
  "name": "John Updated"
}
```

---

### Delete User

**Endpoint:** `DELETE /internal/users/:id`

**Description:** Delete a user account

**Response:** `204 No Content`

---

## JWKS API

### Get JWKS

**Endpoint:** `GET /.well-known/jwks.json`

**Description:** Get JSON Web Key Set for token validation

**Response:** `200 OK`
```json
{
  "keys": [
    {
      "kty": "RSA",
      "kid": "key_1",
      "use": "sig",
      "n": "...",
      "e": "AQAB"
    }
  ]
}
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
  "memory": {
    "used": 50000000,
    "total": 100000000
  }
}
```

---

### Metrics

**Endpoint:** `GET /metrics`

**Description:** Prometheus metrics endpoint

**Response:** Prometheus format metrics

---

For complete OpenAPI 3.0 specification, see [openapi.yaml](openapi.yaml).
