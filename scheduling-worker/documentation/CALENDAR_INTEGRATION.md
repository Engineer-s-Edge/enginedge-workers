# Google Calendar Integration Guide

## Overview

The Scheduling Worker integrates with Google Calendar API to provide bidirectional synchronization of calendar events, enabling seamless calendar management within the EnginEdge platform.

## Prerequisites

### Google Cloud Project Setup

1. **Create Google Cloud Project**
   - Visit [Google Cloud Console](https://console.cloud.google.com/)
   - Create a new project or select an existing one

2. **Enable Google Calendar API**
   - Navigate to "APIs & Services" > "Library"
   - Search for "Google Calendar API"
   - Click "Enable"

3. **Create OAuth 2.0 Credentials**
   - Go to "APIs & Services" > "Credentials"
   - Click "Create Credentials" > "OAuth 2.0 Client IDs"
   - Choose "Web application" as application type
   - Add authorized redirect URIs:
     - `http://localhost:3003/auth/google/callback` (development)
     - `https://yourdomain.com/auth/google/callback` (production)

4. **Configure Consent Screen**
   - Go to "OAuth consent screen"
   - Choose "External" user type
   - Fill in app information
   - Add scopes: `https://www.googleapis.com/auth/calendar`

## Authentication Flow

### OAuth 2.0 Authorization Code Flow

```
1. User initiates auth → GET /auth/google
2. Redirect to Google → User grants permission
3. Google redirects back → POST /auth/google/callback
4. Exchange code for tokens → Store refresh token
5. Use access token → Make API calls
```

### Environment Configuration

```env
# Google OAuth Credentials
GOOGLE_CLIENT_ID=your_client_id_here
GOOGLE_CLIENT_SECRET=your_client_secret_here
GOOGLE_REDIRECT_URI=http://localhost:3003/auth/google/callback

# Token Storage
JWT_SECRET=your_jwt_secret_here
TOKEN_ENCRYPTION_KEY=your_encryption_key_here
```

## API Integration

### Authentication Endpoints

#### Initiate OAuth Flow
```http
GET /auth/google
```

**Response:** Redirects to Google OAuth consent screen

#### OAuth Callback
```http
GET /auth/google/callback?code=auth_code&state=state
```

**Response:** Redirects to frontend with JWT token

#### Get User Profile
```http
GET /auth/profile
Authorization: Bearer <jwt_token>
```

**Response:**
```json
{
  "id": "google_user_id",
  "email": "user@example.com",
  "name": "John Doe",
  "picture": "https://...",
  "calendars": ["primary", "work@example.com"]
}
```

### Calendar Operations

#### List Calendars
```http
GET /calendars
Authorization: Bearer <jwt_token>
```

**Response:**
```json
{
  "calendars": [
    {
      "id": "primary",
      "name": "Primary Calendar",
      "primary": true,
      "accessRole": "owner",
      "backgroundColor": "#3788d8",
      "foregroundColor": "#ffffff"
    },
    {
      "id": "work@example.com",
      "name": "Work Calendar",
      "primary": false,
      "accessRole": "writer"
    }
  ]
}
```

#### Get Events
```http
GET /events?calendarId=primary&start=2025-01-01T00:00:00Z&end=2025-12-31T23:59:59Z
Authorization: Bearer <jwt_token>
```

**Parameters:**
- `calendarId`: Calendar identifier (default: "primary")
- `start`: Start time (ISO 8601, required)
- `end`: End time (ISO 8601, required)
- `maxResults`: Maximum events to return (default: 250, max: 2500)
- `singleEvents`: Expand recurring events (default: true)
- `orderBy`: Sort order ("startTime" or "updated")

**Response:**
```json
{
  "events": [
    {
      "id": "event_id_123",
      "summary": "Team Standup",
      "description": "Daily team sync",
      "start": {
        "dateTime": "2025-10-27T09:00:00Z",
        "timeZone": "America/New_York"
      },
      "end": {
        "dateTime": "2025-10-27T09:30:00Z",
        "timeZone": "America/New_York"
      },
      "attendees": [
        {
          "email": "alice@example.com",
          "displayName": "Alice Johnson",
          "responseStatus": "accepted"
        }
      ],
      "location": "Conference Room A",
      "status": "confirmed",
      "created": "2025-10-20T08:00:00Z",
      "updated": "2025-10-20T08:00:00Z"
    }
  ],
  "nextPageToken": "token_for_next_page"
}
```

#### Create Event
```http
POST /events
Authorization: Bearer <jwt_token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "calendarId": "primary",
  "summary": "Product Review Meeting",
  "description": "Quarterly product review with stakeholders",
  "start": {
    "dateTime": "2025-10-30T14:00:00Z",
    "timeZone": "America/New_York"
  },
  "end": {
    "dateTime": "2025-10-30T15:30:00Z",
    "timeZone": "America/New_York"
  },
  "attendees": [
    {
      "email": "stakeholder1@company.com",
      "displayName": "Jane Smith"
    },
    {
      "email": "stakeholder2@company.com",
      "displayName": "Bob Wilson"
    }
  ],
  "location": "Virtual - Zoom",
  "reminders": {
    "useDefault": false,
    "overrides": [
      {"method": "email", "minutes": 30},
      {"method": "popup", "minutes": 10}
    ]
  }
}
```

**Response:**
```json
{
  "id": "new_event_id_456",
  "summary": "Product Review Meeting",
  "htmlLink": "https://www.google.com/calendar/event?eid=...",
  "status": "confirmed",
  "created": "2025-10-27T10:00:00Z"
}
```

#### Update Event
```http
PUT /events/{eventId}
Authorization: Bearer <jwt_token>
Content-Type: application/json
```

**Request Body:** Same as create, plus:
```json
{
  "calendarId": "primary",
  "summary": "Updated: Product Review Meeting",
  "start": {
    "dateTime": "2025-10-30T15:00:00Z"  // Changed time
  }
}
```

#### Delete Event
```http
DELETE /events/{eventId}?calendarId=primary
Authorization: Bearer <jwt_token>
```

**Response:** `204 No Content`

## Synchronization

### Bidirectional Sync

The service maintains synchronization between EnginEdge and Google Calendar:

1. **Initial Sync**: Downloads all existing events
2. **Real-time Updates**: Webhooks notify of changes
3. **Conflict Resolution**: Last-write-wins strategy
4. **Error Handling**: Retry failed operations

### Sync Configuration

```typescript
{
  syncEnabled: true,
  syncInterval: 300000,  // 5 minutes
  maxRetries: 3,
  batchSize: 50,
  conflictResolution: 'lastWriteWins',
  webhookUrl: 'https://your-app.com/webhooks/calendar'
}
```

### Webhook Setup

To receive real-time updates from Google Calendar:

1. **Register Webhook**:
```http
POST /calendars/{calendarId}/watch
Authorization: Bearer <jwt_token>
Content-Type: application/json
```

```json
{
  "id": "enginedge-calendar-watch",
  "type": "web_hook",
  "address": "https://your-app.com/webhooks/calendar"
}
```

2. **Handle Webhook Payload**:
```json
{
  "kind": "calendar#push",
  "id": "0123456789",
  "resourceId": "resource_id",
  "resourceUri": "https://www.googleapis.com/calendar/v3/calendars/primary/events",
  "channelId": "channel_id",
  "channelToken": "channel_token"
}
```

3. **Fetch Changes**:
```http
GET /events?calendarId=primary&updatedMin=2025-10-27T00:00:00Z
Authorization: Bearer <jwt_token>
```

## Error Handling

### Common Error Codes

- `400 Bad Request`: Invalid request parameters
- `401 Unauthorized`: Invalid or expired access token
- `403 Forbidden`: Insufficient calendar permissions
- `404 Not Found`: Calendar or event doesn't exist
- `409 Conflict`: Event update conflict
- `429 Too Many Requests`: Rate limit exceeded
- `500 Internal Server Error`: Google API error

### Rate Limiting

Google Calendar API has these limits:
- **Read operations**: 1,000,000 queries per day
- **Write operations**: 500,000 operations per day
- **Per user**: 5 requests per second

The service implements:
- Request queuing
- Exponential backoff
- Batch operations
- Caching to reduce API calls

### Token Management

Access tokens expire after 1 hour. The service automatically:

1. **Refresh Tokens**: Uses refresh token to get new access token
2. **Token Storage**: Securely stores tokens (encrypted)
3. **Token Validation**: Checks token validity before API calls
4. **Re-authentication**: Prompts user when refresh token expires

## Best Practices

### Performance Optimization

1. **Use Pagination**: Always use `maxResults` and `pageToken`
2. **Batch Operations**: Group multiple operations when possible
3. **Caching**: Cache frequently accessed calendar data
4. **Webhooks**: Use push notifications instead of polling
5. **Selective Sync**: Only sync relevant calendars

### Data Consistency

1. **ETags**: Use ETags to detect concurrent modifications
2. **Optimistic Locking**: Handle concurrent update conflicts
3. **Idempotency**: Ensure operations can be safely retried
4. **Backup**: Maintain local backup of critical events

### Security Considerations

1. **Token Security**: Never expose tokens in logs or client-side code
2. **Scope Limitation**: Request only necessary OAuth scopes
3. **HTTPS Only**: Always use HTTPS for API communications
4. **Input Validation**: Validate all user inputs and API responses

## Troubleshooting

### Common Issues

#### "Access denied" Error
- Check OAuth scopes in Google Cloud Console
- Verify user has granted necessary permissions
- Ensure calendar sharing settings allow access

#### Sync Not Working
- Verify webhook endpoint is accessible
- Check Google Cloud Console for API enablement
- Review application logs for detailed error messages

#### Rate Limit Exceeded
- Implement exponential backoff
- Reduce sync frequency
- Use batch operations
- Consider upgrading Google Workspace plan

#### Token Expired
- Implement automatic token refresh
- Handle re-authentication flow gracefully
- Store refresh tokens securely

### Debug Mode

Enable debug logging:
```env
LOG_LEVEL=debug
GOOGLE_API_DEBUG=true
```

Check logs for detailed API request/response information.