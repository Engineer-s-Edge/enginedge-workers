# Assistant Worker - Troubleshooting Guide

## Table of Contents

- [Common Issues](#common-issues)
- [Error Messages](#error-messages)
- [Performance Issues](#performance-issues)
- [Memory Issues](#memory-issues)
- [Network Issues](#network-issues)
- [Debugging Tips](#debugging-tips)
- [FAQ](#faq)

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
# Check if port 3001 is in use
netstat -ano | findstr :3001  # Windows
lsof -i :3001                 # Mac/Linux

# Kill process using the port
# Windows: taskkill /PID <PID> /F
# Mac/Linux: kill -9 <PID>

# Or change port in .env
PORT=3002
```

2. **Missing Dependencies**
```bash
# Clean install
rm -rf node_modules package-lock.json
npm install

# Check for peer dependency issues
npm ls
```

3. **TypeScript Build Errors**
```bash
# Clean build
rm -rf dist
npm run build

# Check for type errors
npm run build --verbose
```

---

### Agent Execution Failures

**Symptoms:**
- Agents timeout
- "Agent not found" errors
- Execution hangs indefinitely

**Solutions:**

1. **Agent Timeout**
```typescript
// Increase timeout in config
{
  config: {
    timeout: 60000  // 60 seconds instead of default 30s
  }
}
```

2. **Agent Not Found**
```bash
# Verify agent was created
curl http://localhost:3001/agents?userId=user123

# Check agent ID is correct
curl http://localhost:3001/agents/{agentId}
```

3. **Execution Hangs**
- Check if LLM provider is responding
- Verify network connectivity
- Check for infinite loops in agent logic
- Enable debug logging:

```typescript
// In .env
LOG_LEVEL=debug
```

---

### Memory System Issues

**Symptoms:**
- Memory not persisting
- "Conversation not found" errors
- Memory retrieval slow

**Solutions:**

1. **Memory Not Persisting**
```bash
# Check MongoDB connection
# In .env
MONGODB_URI=mongodb://localhost:27017/assistant-worker

# Test connection
mongosh mongodb://localhost:27017/assistant-worker
```

2. **Conversation Not Found**
```bash
# List all conversations
curl http://localhost:3001/memory/conversations/list?userId=user123

# Create conversation explicitly
curl -X POST http://localhost:3001/memory/{conversationId}/messages \
  -H "Content-Type: application/json" \
  -d '{"role": "user", "content": "Hello"}'
```

3. **Memory Retrieval Slow**
```javascript
// Use appropriate memory type
// Buffer: Fast, small conversations
// Window: Fast, recent messages only
// Vector: Slower, semantic search
// Summary: Medium, compressed history

// Choose based on use case
{
  memoryType: "window",  // Fastest for recent context
  windowSize: 10
}
```

---

### Knowledge Graph Issues

**Symptoms:**
- Nodes not created
- Query errors
- Slow traversal

**Solutions:**

1. **Neo4j Connection Issues**
```bash
# Check Neo4j is running
curl http://localhost:7474

# Test connection
# In .env
NEO4J_URI=bolt://localhost:7687
NEO4J_USER=neo4j
NEO4J_PASSWORD=your_password
```

2. **Cypher Query Errors**
```bash
# Test query directly in Neo4j Browser
# Navigate to http://localhost:7474

# Example query
MATCH (n) RETURN n LIMIT 10
```

3. **Slow Traversal**
```cypher
# Add indexes for better performance
CREATE INDEX ON :Node(label);
CREATE INDEX ON :Node(type);
CREATE INDEX ON :Node(layer);
```

---

## Error Messages

### "ECONNREFUSED"

**Full Error:**
```
Error: connect ECONNREFUSED 127.0.0.1:27017
```

**Cause:** MongoDB is not running or connection refused

**Solution:**
```bash
# Start MongoDB
# Windows
net start MongoDB

# Mac/Linux
sudo systemctl start mongod

# Docker
docker run -d -p 27017:27017 mongo:latest
```

---

### "UnauthorizedError"

**Full Error:**
```
UnauthorizedError: Invalid credentials
```

**Cause:** LLM API key missing or invalid

**Solution:**
```bash
# Add API key to .env
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...

# Verify key is loaded
curl http://localhost:3001/health
# Check logs for "API key configured"
```

---

### "Memory Limit Exceeded"

**Full Error:**
```
Error: Memory limit exceeded: 4096 tokens
```

**Cause:** Conversation exceeds token limit

**Solution:**
```typescript
// Use summary memory for long conversations
{
  memoryType: "summary",
  maxTokens: 8000  // Increase limit
}

// Or clear old conversations
await memoryService.clearMemory(conversationId);
```

---

### "Agent Loop Detected"

**Full Error:**
```
Error: Agent loop detected: exceeded max iterations (10)
```

**Cause:** ReAct agent stuck in reasoning loop

**Solution:**
```typescript
// Increase max iterations
{
  config: {
    maxIterations: 20  // Default is 10
  }
}

// Or refine system prompt to guide agent
{
  config: {
    systemPrompt: "Be concise. Provide final answer when sufficient information is available."
  }
}
```

---

### "Checkpoint Not Found"

**Full Error:**
```
Error: Checkpoint 'checkpoint_123' not found
```

**Cause:** Checkpoint expired or deleted

**Solution:**
```bash
# List available checkpoints
curl http://localhost:3001/checkpoints?agentId={agentId}

# Create new checkpoint before resuming
curl -X POST http://localhost:3001/checkpoints \
  -d '{"agentId": "...", "state": {...}}'
```

---

## Performance Issues

### Slow Agent Execution

**Symptoms:**
- Execution takes > 10 seconds
- High response times
- Timeouts

**Diagnosis:**
```bash
# Check metrics
curl http://localhost:3001/metrics | grep agent_execution_duration

# Enable profiling
NODE_ENV=production node --prof dist/main.js

# Analyze profile
node --prof-process isolate-*.log > profile.txt
```

**Solutions:**

1. **Optimize Prompts**
   - Reduce prompt length
   - Use more specific instructions
   - Avoid unnecessary context

2. **Use Appropriate Agent Type**
   - ReAct: Fast, conversational tasks
   - Graph: Medium, structured workflows
   - Expert: Slow, deep research

3. **Enable Caching**
```typescript
// Cache LLM responses (if supported)
{
  config: {
    cacheEnabled: true,
    cacheTTL: 3600  // 1 hour
  }
}
```

4. **Parallel Execution**
```typescript
// For Graph agent, enable parallel nodes
{
  config: {
    allowParallel: true,
    maxParallelNodes: 3
  }
}
```

---

### High Memory Usage

**Symptoms:**
- Process using > 1GB RAM
- Out of memory errors
- Slow garbage collection

**Diagnosis:**
```bash
# Check memory usage
curl http://localhost:3001/metrics | grep process_resident_memory

# Take heap snapshot
node --inspect dist/main.js
# Connect Chrome DevTools, take heap snapshot
```

**Solutions:**

1. **Limit Conversation Length**
```typescript
// Use window memory
{
  memoryType: "window",
  windowSize: 10  // Keep only last 10 messages
}
```

2. **Clear Old Data**
```bash
# Schedule cleanup job
# Cron: 0 2 * * * (daily at 2 AM)
curl -X DELETE http://localhost:3001/memory/{old_conversation_id}
```

3. **Increase Node.js Heap**
```bash
# In package.json scripts
"start:prod": "node --max-old-space-size=2048 dist/main.js"
```

---

### High CPU Usage

**Symptoms:**
- CPU at 100%
- Slow response times
- Event loop lag

**Diagnosis:**
```bash
# Check CPU metrics
curl http://localhost:3001/metrics | grep process_cpu

# Profile CPU usage
node --prof dist/main.js
```

**Solutions:**

1. **Optimize Heavy Operations**
   - Move heavy computations to worker threads
   - Use streaming instead of buffering
   - Batch database operations

2. **Rate Limiting**
```typescript
// Add rate limiting middleware
import { ThrottlerModule } from '@nestjs/throttler';

@Module({
  imports: [
    ThrottlerModule.forRoot({
      ttl: 60,
      limit: 10  // 10 requests per minute
    })
  ]
})
```

---

## Memory Issues

### Memory Leaks

**Symptoms:**
- Memory usage grows over time
- Eventually crashes with OOM

**Diagnosis:**
```bash
# Monitor memory over time
watch -n 5 'curl -s http://localhost:3001/metrics | grep process_resident_memory'

# Take multiple heap snapshots and compare
```

**Common Causes:**
1. Event listeners not removed
2. Circular references
3. Large objects in closures
4. Uncleared timers/intervals

**Solutions:**
```typescript
// Remove event listeners
agent.off('event', handler);

// Clear timers
clearTimeout(timeoutId);
clearInterval(intervalId);

// Null large objects when done
largeObject = null;
```

---

## Network Issues

### Connection Timeout to External Services

**Symptoms:**
- "ETIMEDOUT" errors
- "ECONNRESET" errors
- Slow API calls

**Solutions:**

1. **Increase Timeout**
```typescript
// In LLM adapter
axios.get(url, {
  timeout: 30000  // 30 seconds
});
```

2. **Retry Logic**
```typescript
import { retry } from 'axios-retry';

const client = axios.create();
retry(client, {
  retries: 3,
  retryDelay: retry.exponentialDelay
});
```

3. **Check Network**
```bash
# Test connectivity
curl https://api.openai.com/v1/models
curl http://localhost:27017  # MongoDB
curl http://localhost:7687   # Neo4j
```

---

## Debugging Tips

### Enable Debug Logging

```bash
# In .env
LOG_LEVEL=debug
NODE_ENV=development

# Or at runtime
DEBUG=* npm run start:dev
```

### Inspect Agent State

```bash
# Get current agent state
curl http://localhost:3001/agents/{agentId}/state

# Get execution history
curl http://localhost:3001/agents/{agentId}/history
```

### Use Health Check

```bash
# Check service health
curl http://localhost:3001/health

# Expected response
{
  "status": "ok",
  "timestamp": "2025-10-24T...",
  "uptime": 123.45,
  "dependencies": {
    "mongodb": "connected",
    "neo4j": "connected",
    "kafka": "connected"
  }
}
```

### Test Individual Components

```typescript
// Unit test a specific agent
import { ReActAgent } from '@domain/agents/react-agent';

const agent = new ReActAgent(llm, logger, ...);
const result = await agent.execute('test input', {});
console.log(result);
```

### Use cURL for API Testing

```bash
# Create agent
curl -X POST http://localhost:3001/agents/create \
  -H "Content-Type: application/json" \
  -d '{"name": "test", "type": "react", "userId": "test"}'

# Execute agent
curl -X POST http://localhost:3001/agents/{id}/execute \
  -H "Content-Type: application/json" \
  -d '{"input": "test", "userId": "test"}'
```

---

## FAQ

### Q: Why is my agent not using tools?

**A:** Check the following:
1. Tools are enabled in config: `enableTools: true`
2. Tool names are specified: `toolNames: ["search", "calculator"]`
3. Agent type supports tools (ReAct, Graph)

---

### Q: How do I reset an agent's state?

**A:** Call the reset endpoint or delete and recreate:
```bash
# Delete agent
curl -X DELETE http://localhost:3001/agents/{agentId}?userId=user123

# Create new agent
curl -X POST http://localhost:3001/agents/create ...
```

---

### Q: Can I use multiple LLM providers?

**A:** Yes, configure multiple adapters:
```typescript
// OpenAI for fast tasks
const openai = new OpenAILLMAdapter(openaiKey);

// Anthropic for complex reasoning
const anthropic = new AnthropicLLMAdapter(anthropicKey);

// Choose based on task
const adapter = task.complex ? anthropic : openai;
```

---

### Q: How do I backup conversation data?

**A:** Export from MongoDB:
```bash
# Backup all conversations
mongodump --db assistant-worker --collection conversations --out /backup

# Restore
mongorestore /backup
```

---

### Q: What's the maximum conversation length?

**A:** Depends on memory type:
- Buffer: Unlimited (but slow with many messages)
- Window: Last N messages (configurable)
- Summary: Compressed, supports very long conversations
- Vector: Unlimited (semantic search finds relevant)

Recommended: Use Summary or Vector for conversations > 100 messages

---

### Q: How do I migrate to production LLM providers?

**A:** Replace MockLLMAdapter:

1. Install provider SDK:
```bash
npm install openai
```

2. Configure adapter:
```typescript
// In infrastructure module
{
  provide: 'ILLMProvider',
  useClass: OpenAILLMAdapter  // Instead of MockLLMAdapter
}
```

3. Add API key:
```bash
# .env
OPENAI_API_KEY=sk-...
```

---

### Q: How do I scale horizontally?

**A:** The service is stateless. Scale with:

**Docker:**
```bash
docker-compose up --scale assistant-worker=3
```

**Kubernetes:**
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: assistant-worker
spec:
  replicas: 3  # Scale to 3 pods
```

**Note:** Use Redis for shared state if needed.

---

## Getting Help

If you're still experiencing issues:

1. **Check Logs:**
   ```bash
   # View logs
   docker logs assistant-worker
   kubectl logs -f deployment/assistant-worker
   ```

2. **Check Metrics:**
   ```bash
   curl http://localhost:3001/metrics
   ```

3. **Enable Debug Mode:**
   ```bash
   LOG_LEVEL=debug npm run start:dev
   ```

4. **Review Documentation:**
   - [ARCHITECTURE.md](ARCHITECTURE.md)
   - [API.md](API.md)
   - [PERFORMANCE.md](PERFORMANCE.md)

5. **File an Issue:**
   - Include error messages
   - Include relevant logs
   - Include configuration (redact secrets)
   - Include steps to reproduce

---

**Last Updated:** October 24, 2025

