# Google Calendar Setup Guide

This guide walks you through setting up Google Calendar integration for the Scheduling Worker.

## Prerequisites

- Google Cloud Platform (GCP) account
- Access to Google Cloud Console
- Basic understanding of OAuth 2.0
- Node.js and npm installed

## Google Cloud Setup

### 1. Create a Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Click "Select a project" → "New Project"
3. Enter a project name (e.g., "EnginEdge Scheduling")
4. Click "Create"

### 2. Enable Google Calendar API

1. In the Google Cloud Console, navigate to "APIs & Services" → "Library"
2. Search for "Google Calendar API"
3. Click on "Google Calendar API"
4. Click "Enable"

### 3. Create OAuth 2.0 Credentials

1. Navigate to "APIs & Services" → "Credentials"
2. Click "Create Credentials" → "OAuth client ID"
3. If prompted, configure the OAuth consent screen:
   - Choose "External" (unless you have a Google Workspace)
   - Fill in the required fields:
     - App name: "EnginEdge Scheduling Worker"
     - User support email: Your email
     - Developer contact information: Your email
   - Add scopes:
     - `https://www.googleapis.com/auth/calendar`
     - `https://www.googleapis.com/auth/calendar.events`
   - Add test users (for development)
   - Save and continue
4. Back in Credentials, create OAuth client ID:
   - Application type: "Web application"
   - Name: "Scheduling Worker OAuth Client"
   - Authorized JavaScript origins:
     - `http://localhost:3007` (for development)
     - Your production URL (for production)
   - Authorized redirect URIs:
     - `http://localhost:3007/auth/google/callback` (for development)
     - Your production callback URL (for production)
   - Click "Create"
5. **Save the Client ID and Client Secret** - you'll need these for environment variables

### 4. Service Account Setup (Optional)

For server-to-server authentication without user interaction:

1. Navigate to "APIs & Services" → "Credentials"
2. Click "Create Credentials" → "Service account"
3. Fill in:
   - Service account name: "scheduling-worker-service"
   - Service account ID: (auto-generated)
   - Description: "Service account for Scheduling Worker"
4. Click "Create and Continue"
5. Grant roles (optional for Calendar API):
   - "Service Account User"
6. Click "Continue" → "Done"
7. Click on the created service account
8. Go to "Keys" tab → "Add Key" → "Create new key"
9. Choose "JSON" format
10. Download the JSON key file
11. **Save the JSON file securely** - you'll need it for environment variables

## Environment Variables

Add the following to your `.env` file:

```env
# Google OAuth 2.0 Credentials
GOOGLE_CLIENT_ID=your_client_id_here
GOOGLE_CLIENT_SECRET=your_client_secret_here
GOOGLE_REDIRECT_URI=http://localhost:3007/auth/google/callback

# Service Account (Optional - for server-to-server)
GOOGLE_SERVICE_ACCOUNT_EMAIL=your-service-account@project.iam.gserviceaccount.com
GOOGLE_SERVICE_ACCOUNT_KEY_PATH=./path/to/service-account-key.json

# Calendar Configuration
DEFAULT_CALENDAR_ID=primary
CALENDAR_SYNC_INTERVAL=300000  # 5 minutes in milliseconds
```

## Testing Calendar Connection

### 1. Start the Scheduling Worker

```bash
npm run start:dev
```

### 2. Test OAuth Flow

1. Navigate to `http://localhost:3007/auth/google`
2. You should be redirected to Google's OAuth consent screen
3. Sign in and authorize the application
4. You should be redirected back with an authorization code

### 3. Test Calendar API

Use the API endpoint to test calendar access:

```bash
# Get calendars
curl http://localhost:3007/calendars \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"

# Get events
curl "http://localhost:3007/events?calendarId=primary&start=2025-01-01T00:00:00Z&end=2025-12-31T23:59:59Z" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

## Troubleshooting

### Issue: "Redirect URI mismatch"

**Solution:**
- Ensure the redirect URI in your OAuth client matches exactly with `GOOGLE_REDIRECT_URI`
- Check for trailing slashes and protocol (http vs https)

### Issue: "Access denied" or "Insufficient permissions"

**Solution:**
- Verify the OAuth consent screen has the correct scopes
- Check that the user has granted the necessary permissions
- For service accounts, ensure the service account has access to the calendar

### Issue: "API not enabled"

**Solution:**
- Go to Google Cloud Console → APIs & Services → Library
- Search for "Google Calendar API"
- Ensure it's enabled for your project

### Issue: "Invalid credentials"

**Solution:**
- Verify `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are correct
- Check for extra spaces or quotes in environment variables
- Regenerate credentials if needed

### Issue: "Rate limit exceeded"

**Solution:**
- Google Calendar API has rate limits (default: 1,000,000 queries per day)
- Implement request throttling
- Use exponential backoff for retries
- Consider using batch requests for multiple operations

## Security Best Practices

1. **Never commit credentials to version control**
   - Use `.env` files (add to `.gitignore`)
   - Use environment variables in production
   - Use secret management services (AWS Secrets Manager, Google Secret Manager, etc.)

2. **Use service accounts for server-to-server communication**
   - More secure than OAuth for automated processes
   - No user interaction required
   - Better for background sync operations

3. **Limit OAuth scopes**
   - Only request scopes you actually need
   - Use the principle of least privilege

4. **Rotate credentials regularly**
   - Change OAuth client secrets periodically
   - Rotate service account keys

5. **Monitor API usage**
   - Set up alerts for unusual API activity
   - Monitor rate limit usage
   - Track authentication failures

6. **Use HTTPS in production**
   - Always use HTTPS for OAuth redirect URIs
   - Never use HTTP in production environments

## Production Deployment

### Environment Variables

Set these in your production environment:

```env
GOOGLE_CLIENT_ID=your_production_client_id
GOOGLE_CLIENT_SECRET=your_production_client_secret
GOOGLE_REDIRECT_URI=https://your-domain.com/auth/google/callback
GOOGLE_SERVICE_ACCOUNT_KEY_PATH=/secure/path/to/service-account-key.json
```

### OAuth Consent Screen

For production:
1. Complete the OAuth consent screen verification process
2. Submit for verification if using sensitive scopes
3. Add production domains to authorized domains

### Service Account

For production service accounts:
1. Create a dedicated service account for production
2. Store the key file securely (encrypted at rest)
3. Use IAM roles to limit permissions
4. Enable audit logging

## Additional Resources

- [Google Calendar API Documentation](https://developers.google.com/calendar/api)
- [OAuth 2.0 for Web Server Applications](https://developers.google.com/identity/protocols/oauth2/web-server)
- [Service Account Authentication](https://cloud.google.com/iam/docs/service-accounts)
- [Google Calendar API Quotas](https://developers.google.com/calendar/api/guides/quota)
