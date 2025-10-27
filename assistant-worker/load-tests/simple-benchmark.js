#!/usr/bin/env node

/**
 * Simple Performance Benchmark Script
 * 
 * This script provides basic load testing capabilities without requiring k6 or Artillery.
 * It's useful for quick performance checks during development.
 * 
 * Usage:
 *   node simple-benchmark.js
 *   node simple-benchmark.js --vus 20 --duration 60
 */

const http = require('http');
const https = require('https');
const { performance } = require('perf_hooks');

// Configuration
const config = {
  assistantWorkerUrl: process.env.ASSISTANT_WORKER_URL || 'http://localhost:3002',
  dataProcessingUrl: process.env.DATA_PROCESSING_URL || 'http://localhost:3003',
  vus: parseInt(process.argv.find(arg => arg.startsWith('--vus'))?.split('=')[1]) || 10,
  duration: parseInt(process.argv.find(arg => arg.startsWith('--duration'))?.split('=')[1]) || 60, // seconds
};

// Metrics
const metrics = {
  requests: 0,
  errors: 0,
  latencies: [],
  startTime: Date.now(),
  endTime: 0,
};

// Test data
const testDocuments = [
  'Machine learning models require large datasets for training.',
  'Cloud computing provides scalable infrastructure on demand.',
  'TypeScript is a typed superset of JavaScript.',
  'Kubernetes orchestrates containerized applications.',
  'React is a JavaScript library for building UIs.',
];

const testQueries = [
  'machine learning',
  'cloud computing',
  'TypeScript',
  'Kubernetes',
  'React',
];

// Make HTTP request
function makeRequest(url, method, data) {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const httpModule = parsedUrl.protocol === 'https:' ? https : http;
    
    const options = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port,
      path: parsedUrl.pathname + parsedUrl.search,
      method: method,
      headers: {
        'Content-Type': 'application/json',
      },
    };

    if (data && method !== 'GET') {
      const body = JSON.stringify(data);
      options.headers['Content-Length'] = Buffer.byteLength(body);
    }

    const startTime = performance.now();
    
    const req = httpModule.request(options, (res) => {
      let responseData = '';

      res.on('data', (chunk) => {
        responseData += chunk;
      });

      res.on('end', () => {
        const endTime = performance.now();
        const latency = endTime - startTime;
        
        metrics.requests++;
        metrics.latencies.push(latency);

        if (res.statusCode >= 400) {
          metrics.errors++;
        }

        resolve({
          statusCode: res.statusCode,
          data: responseData,
          latency,
        });
      });
    });

    req.on('error', (error) => {
      metrics.errors++;
      reject(error);
    });

    if (data && method !== 'GET') {
      req.write(JSON.stringify(data));
    }

    req.end();
  });
}

// Test document processing
async function testDocumentProcessing() {
  const userId = `bench-user-${Math.floor(Math.random() * 1000)}`;
  const conversationId = `bench-conv-${Math.floor(Math.random() * 1000)}`;
  const content = testDocuments[Math.floor(Math.random() * testDocuments.length)];

  try {
    await makeRequest(
      `${config.dataProcessingUrl}/documents/process-for-rag`,
      'POST',
      {
        content,
        userId,
        conversationId,
        metadata: { title: 'Benchmark Document' },
      }
    );
    return { userId, conversationId };
  } catch (error) {
    console.error('Document processing error:', error.message);
    return null;
  }
}

// Test vector search
async function testVectorSearch(userId, conversationId) {
  const query = testQueries[Math.floor(Math.random() * testQueries.length)];

  try {
    await makeRequest(
      `${config.dataProcessingUrl}/vector-store/search-conversations`,
      'POST',
      {
        query,
        userId,
        conversationId,
        limit: 5,
        similarityThreshold: 0.7,
      }
    );
  } catch (error) {
    console.error('Vector search error:', error.message);
  }
}

// Run single virtual user
async function runVirtualUser(vuId, durationMs) {
  const endTime = Date.now() + durationMs;
  
  while (Date.now() < endTime) {
    try {
      // Process document
      const context = await testDocumentProcessing();
      
      // Small delay
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Search if processing succeeded
      if (context) {
        await testVectorSearch(context.userId, context.conversationId);
      }
      
      // Random delay between requests (1-3 seconds)
      const delay = Math.random() * 2000 + 1000;
      await new Promise(resolve => setTimeout(resolve, delay));
    } catch (error) {
      console.error(`VU ${vuId} error:`, error.message);
    }
  }
}

// Calculate statistics
function calculateStats() {
  if (metrics.latencies.length === 0) {
    return {
      min: 0,
      max: 0,
      avg: 0,
      p50: 0,
      p95: 0,
      p99: 0,
    };
  }

  const sorted = metrics.latencies.sort((a, b) => a - b);
  const len = sorted.length;

  return {
    min: sorted[0].toFixed(2),
    max: sorted[len - 1].toFixed(2),
    avg: (sorted.reduce((a, b) => a + b, 0) / len).toFixed(2),
    p50: sorted[Math.floor(len * 0.5)].toFixed(2),
    p95: sorted[Math.floor(len * 0.95)].toFixed(2),
    p99: sorted[Math.floor(len * 0.99)].toFixed(2),
  };
}

// Print results
function printResults() {
  metrics.endTime = Date.now();
  const durationSeconds = (metrics.endTime - metrics.startTime) / 1000;
  const stats = calculateStats();
  const rps = (metrics.requests / durationSeconds).toFixed(2);
  const errorRate = ((metrics.errors / metrics.requests) * 100).toFixed(2);

  console.log('\n' + '='.repeat(60));
  console.log('BENCHMARK RESULTS');
  console.log('='.repeat(60));
  console.log(`Duration:        ${durationSeconds.toFixed(2)}s`);
  console.log(`Virtual Users:   ${config.vus}`);
  console.log(`Total Requests:  ${metrics.requests}`);
  console.log(`Errors:          ${metrics.errors} (${errorRate}%)`);
  console.log(`Requests/sec:    ${rps}`);
  console.log('');
  console.log('LATENCY (ms):');
  console.log(`  Min:     ${stats.min}`);
  console.log(`  Max:     ${stats.max}`);
  console.log(`  Avg:     ${stats.avg}`);
  console.log(`  p50:     ${stats.p50}`);
  console.log(`  p95:     ${stats.p95}`);
  console.log(`  p99:     ${stats.p99}`);
  console.log('='.repeat(60) + '\n');
}

// Main execution
async function main() {
  console.log('Starting Simple Performance Benchmark');
  console.log(`Virtual Users: ${config.vus}`);
  console.log(`Duration: ${config.duration}s`);
  console.log(`Assistant Worker: ${config.assistantWorkerUrl}`);
  console.log(`Data Processing: ${config.dataProcessingUrl}`);
  console.log('');

  // Check health
  try {
    await makeRequest(`${config.dataProcessingUrl}/health`, 'GET');
    console.log('✓ Data Processing Worker is healthy');
  } catch (error) {
    console.error('✗ Data Processing Worker health check failed');
  }

  console.log('\nRunning benchmark...\n');

  // Start virtual users
  const vus = [];
  const durationMs = config.duration * 1000;
  
  for (let i = 0; i < config.vus; i++) {
    vus.push(runVirtualUser(i, durationMs));
  }

  // Wait for all VUs to complete
  await Promise.all(vus);

  // Print results
  printResults();
}

// Handle SIGINT
process.on('SIGINT', () => {
  console.log('\n\nBenchmark interrupted by user');
  printResults();
  process.exit(0);
});

// Run
main().catch((error) => {
  console.error('Benchmark failed:', error);
  process.exit(1);
});
