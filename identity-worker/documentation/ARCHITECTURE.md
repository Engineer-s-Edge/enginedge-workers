# Identity Worker - Architecture Documentation

## Table of Contents

- [Overview](#overview)
- [Hexagonal Architecture](#hexagonal-architecture)
- [System Architecture](#system-architecture)
- [Authentication Flow](#authentication-flow)
- [OAuth Flow](#oauth-flow)
- [Component Diagrams](#component-diagrams)
- [Layer Details](#layer-details)

---

## Overview

The Identity Worker implements **Hexagonal Architecture** (Ports & Adapters pattern) to ensure clean separation of concerns, testability, and maintainability. The system is organized into three main layers:

1. **Domain Layer** - Pure business logic
2. **Application Layer** - Use cases and orchestration
3. **Infrastructure Layer** - External integrations

---

## Hexagonal Architecture

```
┌─────────────────────────────────────────────────┐
│           Infrastructure Layer                  │
│  Controllers | Adapters | External Services    │
└─────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────┐
│           Application Layer                     │
│  Services | Use Cases | Ports                  │
└─────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────┐
│           Domain Layer                          │
│  Entities | Value Objects | Domain Services   │
└─────────────────────────────────────────────────┘
```

### Key Principles

1. **Dependencies point inward** - Infrastructure depends on Application, Application depends on Domain
2. **Domain is pure** - No external dependencies in domain layer
3. **Ports define contracts** - Application layer defines interfaces
4. **Adapters implement ports** - Infrastructure provides concrete implementations

---

## System Architecture

```
┌─────────────────────────────────────────────────┐
│           Identity Worker                       │
│  REST API | Auth Service | OAuth Service       │
│  User Management | JWT Issuer | JWKS         │
└─────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────┐
│           External Services                     │
│  MongoDB | Redis | OAuth Providers             │
│  (Google, GitHub, etc.)                        │
└─────────────────────────────────────────────────┘
```

---

## Authentication Flow

### Login Flow

1. Client sends credentials to `/internal/auth/login`
2. IdentityService validates credentials
3. UserRepository checks user in MongoDB
4. JWT Issuer generates access and refresh tokens
5. Tokens returned to client

### Token Refresh Flow

1. Client sends refresh token to `/internal/auth/token/refresh`
2. JWT Issuer validates refresh token
3. New access token generated
4. New access token returned to client

---

## OAuth Flow

### OAuth Authorization Flow

1. Client requests auth URL from `/internal/oauth/:provider/auth`
2. OAuthService generates authorization URL
3. Client redirects user to provider
4. Provider redirects to callback with code
5. OAuthService exchanges code for tokens
6. Account linked to user

---

## Layer Details

### Domain Layer (`src/domain/`)

- `User` - Core user entity
- `Role` - User role entity
- `Tenant` - Multi-tenancy support
- `OAuthAccount` - OAuth account linking
- `Key` - JWT signing keys

### Application Layer (`src/application/`)

- `IdentityService` - Authentication and authorization
- `OAuthService` - OAuth provider integration
- `CommandApplicationService` - Command processing
- Ports for repositories and external services

### Infrastructure Layer (`src/infrastructure/`)

- `AuthController` - Authentication endpoints
- `OauthController` - OAuth endpoints
- `UsersController` - User management endpoints
- `JwksController` - JWKS endpoint
- `MongoUserRepository` - MongoDB user storage
- `RedisCacheAdapter` - Redis caching
- `JwtIssuerService` - JWT token generation
- `GoogleOAuthAdapter` - Google OAuth integration

---

## Security

### JWT Token Structure

- **Access Token**: Short-lived (15 minutes default)
- **Refresh Token**: Long-lived (30 days default)
- **Algorithm**: RS256 (RSA with SHA-256)
- **Claims**: sub, iat, exp, email, name, tenantId

### Password Security

- Passwords hashed with bcrypt (10 rounds)
- Never stored in plain text
- Password validation on registration

### OAuth Security

- State parameter for CSRF protection
- Secure token storage
- Account linking validation

---

## Multi-Tenancy

The Identity Worker supports multi-tenancy:

- Each user belongs to a tenant
- Tenant isolation at data level
- Tenant-specific configurations

---

## Caching Strategy

- Redis used for session caching
- Token blacklist for revoked tokens
- User profile caching
- TTL-based expiration

---

## Database Schema

### Users Collection

```javascript
{
  _id: ObjectId,
  email: String,
  passwordHash: String,
  name: String,
  tenantId: String,
  roles: [String],
  createdAt: Date,
  updatedAt: Date
}
```

### OAuth Accounts Collection

```javascript
{
  _id: ObjectId,
  userId: String,
  provider: String,
  providerId: String,
  email: String,
  linkedAt: Date
}
```

---

## Error Handling

- Global exception filter for consistent error responses
- Validation pipes for input validation
- Structured error logging
- Error codes for client handling

---

## Monitoring

- Prometheus metrics for observability
- Health check endpoints
- Request/response logging
- Performance metrics
