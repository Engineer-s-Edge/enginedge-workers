# Data Processing Worker - Troubleshooting Guide

## Table of Contents

- [Common Issues](#common-issues)
- [Error Messages](#error-messages)
- [Performance Issues](#performance-issues)
- [Memory Issues](#memory-issues)
- [Database Issues](#database-issues)
- [API Issues](#api-issues)
- [Debugging Tips](#debugging-tips)
- [FAQ](#faq)

---

## Common Issues

### Service Won't Start

**Symptoms:**
- Service crashes on startup
- Port already in use error
- Module not found errors
- Database connection fails

**Solutions:**

1. **Port Already in Use**
```bash
# Check if port 3002 is in use (Windows)
netstat -ano | findstr :3002

# Check (Mac/Linux)
lsof -i :3002

# Kill process using the port
taskkill /PID <PID> /F       # Windows
kill -9 <PID>                 # Mac/Linux

# Or change port in .env
PORT=3003
```

2. **Missing Dependencies**
```bash
# Clean install
rm -rf node_modules package-lock.json
npm install

# Check for peer dependency issues
npm ls

# If issues persist
npm install --legacy-peer-deps
```

3. **MongoDB Connection Fails**
```bash
# Verify MongoDB is running
mongosh

# Check connection string in .env
MONGODB_URI=mongodb://localhost:27017/enginedge

# If remote MongoDB
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/enginedge

# Test connection
npm run test:db
```

4. **TypeScript Build Errors**
```bash
# Clean build
rm -rf dist
npm run build

# Check for type errors
npm run build --verbose

# Update types if needed
npm install --save-dev @types/node@latest
```

5. **Module Not Found**
```bash
# Check if adapters are imported correctly
grep -r "adapters/loaders" src/

# If missing files, rebuild from scratch
npm run build:clean
npm run build
```

---

### Document Loading Fails

**Symptoms:**
- "Unsupported file type" error
- Document loads but content is empty
- Encoding issues with special characters
- Timeout loading large files

**Solutions:**

1. **Unsupported File Type**
```typescript
// Check supported formats
const loader = await loaderFactory.getAvailableLoaders();
console.log(loader.map(l => l.format));

// Currently supported:
// PDF, DOCX, TXT, CSV, EPUB, PPTX, SRT, Markdown, URLs, GitHub repos, Notion, Obsidian
```

2. **File Too Large**
```bash
# Increase file size limit in .env
MAX_FILE_SIZE=104857600  # 100MB (default is 50MB)

# Or process in chunks
const doc = await documentService.loadDocumentStreaming(filePath, {
  chunkSize: 1024 * 1024  // 1MB chunks
});
```

3. **Special Characters Not Displaying**
```bash
# Ensure UTF-8 encoding in .env
NODE_ENV=production
ENCODING=utf-8

# Check file encoding before loading
file --mime-encoding document.txt
# Should output: document.txt: utf-8
```

4. **Web Document Loading Times Out**
```bash
# Increase timeout in .env
WEB_LOADER_TIMEOUT=30000  # 30 seconds

# Check URL is accessible
curl -I https://example.com/document

# Check internet connectivity
ping google.com
```

---

### Text Splitting Issues

**Symptoms:**
- Chunks are too large or too small
- Logical content boundaries not preserved
- Code is split incorrectly
- Memory issues during splitting

**Solutions:**

1. **Suboptimal Chunk Size**
```typescript
// Analyze your use case
// For search: smaller chunks (256 tokens)
// For summarization: larger chunks (1024 tokens)

const chunks = await splitter.split(text, {
  chunkSize: 512,       // Tokens, not characters
  chunkOverlap: 50      // Helps maintain context
});

// Check chunk distribution
const sizes = chunks.map(c => c.length);
console.log({
  min: Math.min(...sizes),
  max: Math.max(...sizes),
  avg: sizes.reduce((a,b) => a+b) / sizes.length
});
```

2. **Code Splitting Issues**
```typescript
// Use language-specific splitter
const splitter = await textSplitterFactory
  .getSplitterByFileExtension('algorithm.py');

// Or detect from content
const splitter = await textSplitterFactory
  .getByContentDetection(code);

// Preserves logical units (functions, classes)
```

3. **Memory Issues During Splitting**
```bash
# Increase Node.js memory limit
NODE_OPTIONS=--max-old-space-size=4096  # 4GB

# Or process in streaming fashion
const readable = fs.createReadStream(filePath);
readable.on('data', chunk => {
  const chunks = splitter.split(chunk.toString());
  processChunks(chunks);
});
```

4. **Wrong Splitter Selected**
```typescript
// Verify auto-detection
const detected = await textSplitterFactory
  .getSplitterByContentDetection(text);
console.log(detected.constructor.name);

// Manual override if needed
const splitter = textSplitterFactory.getSplitterByType('python');
```

---

### Embedding Generation Issues

**Symptoms:**
- API key errors (401/403)
- Rate limiting (429 Too Many Requests)
- Timeout errors
- Embedding dimensions mismatch
- High costs

**Solutions:**

1. **API Key Missing or Invalid**
```bash
# For OpenAI
OPENAI_API_KEY=sk-...

# For Google
GOOGLE_API_KEY=AIza...

# Test key validity
npm run test:embedders

# Check key has right permissions
# OpenAI: https://platform.openai.com/account/api-keys
# Google: https://console.cloud.google.com
```

2. **Rate Limiting**
```bash
# Check rate limit status
curl -i https://api.openai.com/v1/embeddings \
  -H "Authorization: Bearer $OPENAI_API_KEY"

# Headers show:
# x-ratelimit-limit-requests: 3500
# x-ratelimit-remaining-requests: 3400

# Implement backoff
const embedding = await embedderService.embedWithFallback(
  text,
  'openai',
  ['google', 'local']  // Fallback to other providers
);
```

3. **Timeout Errors**
```bash
# Increase timeout in .env
EMBEDDER_TIMEOUT=30000  # 30 seconds

# Use batch processing for better performance
const embeddings = await embedderService.embedBatch(texts, {
  batchSize: 100
});
```

4. **Embedding Dimension Mismatch**
```typescript
// Check available embedders
const available = await embedderFactory.getAvailableEmbedders();

// OpenAI: 1536 dimensions
// Google: 768 dimensions
// Cohere: 1024 dimensions
// Local: 384 dimensions

// Ensure vector store handles different dimensions
const embedding = await embedderService.embedText(text);
console.log(embedding.length);  // 1536 for OpenAI
```

5. **High Costs**
```bash
# Use cost-optimized provider
EMBEDDER_PROVIDER=google  # Free tier available

# Or use local provider
EMBEDDER_PROVIDER=local   # No cost

# Check deduplication is working
const stats = await embedderService.getStats();
console.log(stats.deduplicationRate);  // Should be >0.2 (20%)
```

---

## Error Messages

### "Document not found"

**Cause:** Document ID doesn't exist in MongoDB

**Fix:**
```typescript
// Verify document exists
const doc = await documentCollection.findOne({ _id: documentId });
if (!doc) {
  // Document was deleted or ID is wrong
}

// Check document status
const doc = await documentService.getDocument(documentId);
```

### "Unsupported MIME type"

**Cause:** File format not supported

**Fix:**
```bash
# Check supported formats
npm run list:supported-formats

# Convert file to supported format
# PDF → PDF is native
# Word → Convert to PDF or extract as text
# Excel → Export as CSV
```

### "Vector dimension mismatch"

**Cause:** Embeddings have different dimensions

**Fix:**
```typescript
// Ensure consistent embedder
const embedderService.setEmbedder('openai');

// All new embeddings will have 1536 dimensions
const embedding = await embedderService.embedText(text);
```

### "Collection not initialized"

**Cause:** MongoDB vector store not connected

**Fix:**
```bash
# Check MongoDB connection
MONGODB_URI=mongodb://localhost:27017/enginedge

# Initialize collection
npm run init:db

# Verify connection
npm run test:db
```

### "Rate limit exceeded"

**Cause:** Too many API requests to provider

**Fix:**
```bash
# Check rate limit status
npm run check:rate-limits

# Implement exponential backoff (automatic in service)
# Or switch to rate-limited provider
EMBEDDER_PROVIDER=google
```

### "Out of memory"

**Cause:** Cache too large or memory leak

**Fix:**
```bash
# Increase Node.js memory
NODE_OPTIONS=--max-old-space-size=4096

# Clear cache
await embedderService.clearCache();

# Check cache size
const stats = await embedderService.getStats();
console.log(stats.cacheSizeBytes);
```

---

## Performance Issues

### Slow Document Loading

**Symptoms:**
- Takes > 5 seconds to load a 5MB PDF
- Memory usage spikes during loading

**Solutions:**

1. **Use Streaming Loading**
```typescript
const doc = await documentService.loadDocumentStreaming(filePath, {
  chunkSize: 1024 * 1024,
  onChunk: (chunk) => {
    // Process chunk immediately
    processChunk(chunk);
  }
});
```

2. **Check File Type**
```bash
# Text/CSV loads fast
# PDF/DOCX might need extraction
# Large files should use streaming
```

3. **Monitor Disk I/O**
```bash
# On Windows
wmic logicaldisk get name,size,freespace

# On Mac/Linux
df -h
```

### Slow Search Queries

**Symptoms:**
- Similarity search takes > 500ms
- Search timeout errors

**Solutions:**

1. **Check Indexes**
```bash
# Verify vector index exists
db.embeddings.getIndexes()

# Should see cosmosSearch index

# If missing, create it
db.embeddings.createIndex({
  embedding: "cosmosSearch",
  metadata: 1
})
```

2. **Limit Results**
```typescript
// Always specify reasonable limit
const results = await vectorStore.search(queryEmbedding, {
  limit: 10  // Don't fetch 1000 results
});
```

3. **Add Metadata Filtering**
```typescript
// Filter at database level
const results = await vectorStore.searchWithMetadataFilter(
  queryEmbedding,
  10,
  {
    sourceType: 'pdf',
    'metadata.category': 'research'
  }
);
```

### Slow Embedding Generation

**Symptoms:**
- Single embedding takes > 500ms
- Batch processing is slow

**Solutions:**

1. **Check Cache Hit Rate**
```typescript
const stats = await embedderService.getStats();
console.log(stats.cacheMetrics.hitRate);
// Should be > 0.6 (60%)
```

2. **Use Batch Processing**
```typescript
// Faster than individual requests
const embeddings = await embedderService.embedBatch(texts, {
  batchSize: 100
});
```

3. **Switch Provider for Speed**
```typescript
const embedder = embedderFactory.getFastestEmbedder();
// Returns: LocalEmbedder (80ms vs 150ms for OpenAI)
```

---

## Memory Issues

### High Memory Usage

**Symptoms:**
- Process using 500MB+ when idle
- Memory grows continuously (leak)
- OOM (Out of Memory) errors

**Solutions:**

1. **Check Cache Size**
```typescript
const stats = await embedderService.getStats();
console.log(stats.cacheSizeMB);

// If > 500MB, it's the cache
// Clear it periodically
setInterval(() => {
  embedderService.clearCache();
}, 3600000);  // Every hour
```

2. **Check for Memory Leaks**
```bash
# Enable memory profiling
NODE_OPTIONS=--expose-gc npm run start:dev

# Monitor memory over time
while true; do
  ps aux | grep node
  sleep 5
done
```

3. **Reduce Cache Size**
```bash
# In .env
CACHE_MAX_SIZE=5000  # Reduce from 10000
```

---

## Database Issues

### MongoDB Connection Fails

**Symptoms:**
- "MongoServerError: connect ECONNREFUSED"
- "Authentication failed"
- Connection timeout

**Solutions:**

1. **Check MongoDB is Running**
```bash
# Windows
Get-Service MongoDB

# Mac/Linux
systemctl status mongod
```

2. **Check Connection String**
```bash
# Local MongoDB
MONGODB_URI=mongodb://localhost:27017/enginedge

# MongoDB Atlas (cloud)
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/enginedge

# Verify connection
mongosh "mongodb://localhost:27017"
```

3. **Authentication Error**
```bash
# Create database user if needed
mongosh
use admin
db.createUser({
  user: 'enginedge',
  pwd: 'password',
  roles: ['readWrite']
})

# Update connection string
MONGODB_URI=mongodb://enginedge:password@localhost:27017/enginedge
```

### Vector Search Returns No Results

**Symptoms:**
- Search queries return empty results
- Vector index not used

**Solutions:**

1. **Check Embeddings Are Stored**
```bash
# Verify documents exist
db.embeddings.countDocuments()

# Should return > 0
```

2. **Verify Vector Index**
```bash
# Check index exists
db.embeddings.getIndexes()

# Create if missing
db.embeddings.createIndex({
  embedding: "cosmosSearch"
})
```

3. **Check Query Vector Dimensions**
```typescript
// Ensure query embedding matches stored embeddings
const queryEmbedding = await embedderService.embedText('query');
console.log(queryEmbedding.length);  // Should be 1536 for OpenAI

// Verify stored embeddings have same dimension
const sample = await collection.findOne();
console.log(sample.embedding.length);  // Should match
```

---

## API Issues

### CORS Errors

**Symptoms:**
- "Access to XMLHttpRequest blocked by CORS policy"

**Solution:**
```typescript
// In app.module.ts
app.enableCors({
  origin: process.env.CORS_ORIGIN || '*',
  credentials: true,
  methods: ['GET', 'POST', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
});
```

### Invalid Request Body

**Symptoms:**
- "400 Bad Request"
- Validation errors

**Solution:**
```bash
# Check request format matches API spec
# Verify required fields are present
# Check data types match schema

# Example:
{
  "userId": "string",          // Required
  "text": "string",            // Required
  "provider": "string"         // Optional
}
```

### 404 Endpoint Not Found

**Symptoms:**
- "Cannot POST /embedders/embed"

**Solution:**
```bash
# Verify endpoint exists
npm run list:endpoints

# Check endpoint is registered in controller
# Verify port is correct (3002 default)
# Check URL spelling and method (POST vs GET)
```

---

## Debugging Tips

### Enable Debug Logging

```bash
# Enable all debug logs
DEBUG=enginedge:* npm run start:dev

# Enable specific module
DEBUG=enginedge:embedder npm run start:dev

# Show all HTTP requests
DEBUG=enginedge:http npm run start:dev
```

### Check Logs

```bash
# Recent logs
tail -f logs/application.log

# Error logs
grep ERROR logs/application.log

# By module
grep "EmbedderService" logs/application.log
```

### Test Individual Components

```bash
# Test database connection
npm run test:db

# Test embedders
npm run test:embedders

# Test loaders
npm run test:loaders

# Test splitters
npm run test:splitters

# Run full test suite
npm test
```

### Monitor in Real-Time

```bash
# Watch logs
npm run logs:watch

# Monitor resource usage
npm run monitor

# Check health status
curl http://localhost:3002/health
```

---

## FAQ

### Q: How do I add a custom document loader?

**A:** Follow the loader pattern:

```typescript
export class CustomLoaderAdapter extends LoaderPort {
  async loadFile(file: string): Promise<Document[]> {
    // Implementation
  }
  
  async loadURL(url: string): Promise<Document[]> {
    // Implementation
  }
}

// Register in module
{
  provide: LoaderPort,
  useClass: CustomLoaderAdapter,
  multi: true
}
```

### Q: How do I use a different embedding provider?

**A:** Switch via environment or code:

```bash
# Via .env
EMBEDDER_PROVIDER=google

# Or in code
await embedderService.setEmbedder('google');
```

### Q: How often should I clear the embedding cache?

**A:** Based on your usage:
- High-volume production: Every 1-2 hours
- Moderate usage: Every 6 hours
- Low volume: Daily or on-demand

### Q: Can I use the worker offline?

**A:** Partially:
- Local embedder works offline
- Document loading works for local files
- Web loading requires internet
- MongoDB requires connection (use embedded if needed)

### Q: How do I scale to multiple workers?

**A:** Use load balancing:
```
Load Balancer
├── Worker 1
├── Worker 2
└── Worker 3
↓
Shared MongoDB
```

### Q: What's the maximum document size?

**A:** Default 50MB (configurable):
```bash
MAX_FILE_SIZE=104857600  # 100MB
```

Larger documents work with streaming loading.

---

**Troubleshooting Guide Version:** 1.0  
**Last Updated:** October 24, 2025  
**Maintained By:** Engineering Team
