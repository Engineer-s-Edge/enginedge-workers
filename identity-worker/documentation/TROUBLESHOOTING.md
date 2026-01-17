# Identity Worker - Troubleshooting Guide

## Table of Contents

- [Common Issues](#common-issues)
- [Error Messages](#error-messages)
- [Performance Issues](#performance-issues)
- [Authentication Issues](#authentication-issues)
- [OAuth Issues](#oauth-issues)
- [Database Issues](#database-issues)
- [Debugging Tips](#debugging-tips)

---

## Common Issues

### Service Won't Start

**Symptoms:**
- Service crashes on startup
- Port already in use error
- Module not found errors

**Solutions:**

1. **Port Already in Use**
```bash
# Check if port 3008 is in use
netstat -ano | findstr :3008  # Windows
lsof -i :3008                 # Mac/Linux

# Kill process using the port
# Windows: taskkill /PID <PID> /F
# Mac/Linux: kill -9 <PID>

# Or change port in .env
PORT=3009
```

2. **Missing Dependencies**
```bash
# Clean install
rm -rf node_modules package-lock.json
npm install
```

---

### Authentication Failures

**Symptoms:**
- Login fails with "Invalid credentials"
- Token refresh fails
- Tokens not validating

**Solutions:**

1. **Invalid Credentials**
```bash
# Verify user exists
curl http://localhost:3008/internal/users?email=user@example.com

# Check password hash in database
# Verify bcrypt is working correctly
```

2. **Token Validation Fails**
```bash
# Check JWKS endpoint
curl http://localhost:3008/.well-known/jwks.json

# Verify token signature
# Check token expiration
```

---

### OAuth Issues

**Symptoms:**
- OAuth callback fails
- Account linking errors
- Provider errors

**Solutions:**

1. **OAuth Callback Fails**
```bash
# Verify OAuth credentials
# Check GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET
# Verify redirect URI matches provider settings
```

2. **State Mismatch**
- Ensure state parameter is properly handled
- Check Redis connectivity for state storage

---

### Database Issues

**Symptoms:**
- MongoDB connection errors
- Redis connection errors
- Query timeouts

**Solutions:**

1. **MongoDB Connection**
```bash
# Check MongoDB is running
mongosh mongodb://localhost:27017/identity-service

# Verify connection string
MONGODB_URI=mongodb://localhost:27017/identity-service
```

2. **Redis Connection**
```bash
# Check Redis is running
redis-cli ping

# Verify connection string
REDIS_URL=redis://localhost:6379/8
```

---

## Error Messages

### "ECONNREFUSED"

**Full Error:**
```
Error: connect ECONNREFUSED 127.0.0.1:27017
```

**Cause:** MongoDB is not running

**Solution:**
```bash
# Start MongoDB
# Windows: net start MongoDB
# Mac/Linux: sudo systemctl start mongod
```

### "Invalid token"

**Full Error:**
```
Error: Invalid token
```

**Cause:** Token expired, invalid signature, or malformed

**Solution:**
- Check token expiration
- Verify JWKS endpoint
- Ensure token format is correct

---

## Performance Issues

### Slow Login

**Causes:**
- Slow password hashing
- Database query slow
- Network latency

**Solutions:**
- Optimize bcrypt rounds (balance security/performance)
- Add database indexes
- Use connection pooling

---

## Debugging Tips

### Enable Debug Logging

```env
LOG_LEVEL=debug
```

### Check Health Endpoint

```bash
curl http://localhost:3008/health
```

### Monitor Metrics

```bash
curl http://localhost:3008/metrics
```

---

## FAQ

### Q: How do I reset a user's password?

A: Update the password hash in MongoDB or implement a password reset flow.

### Q: How do I rotate JWT keys?

A: Generate new key pair and update the JWT issuer service. Old tokens will be invalid.

### Q: How do I enable additional OAuth providers?

A: Add provider adapter in infrastructure layer and configure credentials.
