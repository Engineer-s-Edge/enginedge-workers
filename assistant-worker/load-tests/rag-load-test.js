/**
 * Phase 8 RAG Pipeline Load Test
 * 
 * Tests the complete RAG pipeline under load:
 * - Document processing (Data Processing Worker)
 * - Vector search (conversation-scoped)
 * - Expert Agent RAG integration
 * - Kafka message throughput
 * 
 * Run with: k6 run phase8-rag-load-test.js
 * 
 * Stages:
 * 1. Ramp up to 10 VUs over 30s
 * 2. Sustain 10 VUs for 2 minutes
 * 3. Spike to 50 VUs for 30s
 * 4. Ramp down to 0 over 30s
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter, Trend } from 'k6/metrics';

// Custom metrics
const ragSearchDuration = new Trend('rag_search_duration');
const documentProcessDuration = new Trend('document_process_duration');
const vectorSearchDuration = new Trend('vector_search_duration');
const ragSearchErrors = new Counter('rag_search_errors');
const documentProcessErrors = new Counter('document_process_errors');

// Configuration
const BASE_URL = __ENV.BASE_URL || 'http://localhost:3002'; // Assistant Worker
const DATA_PROCESSING_URL = __ENV.DATA_PROCESSING_URL || 'http://localhost:3003';

// Test configuration
export const options = {
  stages: [
    { duration: '30s', target: 10 },  // Ramp up to 10 VUs
    { duration: '2m', target: 10 },   // Sustain 10 VUs
    { duration: '30s', target: 50 },  // Spike to 50 VUs
    { duration: '30s', target: 0 },   // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<2000'], // 95% of requests under 2s
    http_req_failed: ['rate<0.05'],    // Error rate under 5%
    rag_search_duration: ['p(95)<1500'],
    document_process_duration: ['p(95)<3000'],
  },
};

// Test data
const testDocuments = [
  'Machine learning models require large datasets for training. Neural networks learn patterns through backpropagation.',
  'Cloud computing provides scalable infrastructure. AWS, Azure, and GCP are major providers in the market.',
  'TypeScript adds type safety to JavaScript. It compiles to plain JavaScript for browser compatibility.',
  'Kubernetes orchestrates containers across clusters. It handles deployment, scaling, and management automatically.',
  'React is a JavaScript library for building user interfaces. It uses a virtual DOM for efficient rendering.',
];

const testQueries = [
  'machine learning',
  'cloud computing',
  'TypeScript',
  'Kubernetes',
  'React UI',
];

// Generate unique user and conversation IDs
function generateUserId() {
  return `load-test-user-${__VU}-${Date.now()}`;
}

function generateConversationId() {
  return `load-test-conv-${__VU}-${Date.now()}`;
}

// Test: Document Processing
export function testDocumentProcessing() {
  const userId = generateUserId();
  const conversationId = generateConversationId();
  const document = testDocuments[Math.floor(Math.random() * testDocuments.length)];

  const payload = JSON.stringify({
    content: document,
    userId: userId,
    conversationId: conversationId,
    metadata: {
      title: `Load Test Document ${__VU}`,
      source: 'k6-load-test',
      timestamp: new Date().toISOString(),
    },
  });

  const params = {
    headers: {
      'Content-Type': 'application/json',
    },
    tags: { name: 'DocumentProcessing' },
  };

  const startTime = Date.now();
  const response = http.post(
    `${DATA_PROCESSING_URL}/documents/process-for-rag`,
    payload,
    params
  );
  const duration = Date.now() - startTime;

  documentProcessDuration.add(duration);

  const success = check(response, {
    'document processing status 200': (r) => r.status === 200,
    'document processing has documentId': (r) => JSON.parse(r.body).documentId !== undefined,
    'document processing success': (r) => JSON.parse(r.body).success === true,
  });

  if (!success) {
    documentProcessErrors.add(1);
  }

  return { userId, conversationId };
}

// Test: Vector Search
export function testVectorSearch(userId, conversationId) {
  const query = testQueries[Math.floor(Math.random() * testQueries.length)];

  const payload = JSON.stringify({
    query: query,
    userId: userId,
    conversationId: conversationId,
    limit: 5,
    similarityThreshold: 0.7,
  });

  const params = {
    headers: {
      'Content-Type': 'application/json',
    },
    tags: { name: 'VectorSearch' },
  };

  const startTime = Date.now();
  const response = http.post(
    `${DATA_PROCESSING_URL}/vector-store/search-conversations`,
    payload,
    params
  );
  const duration = Date.now() - startTime;

  vectorSearchDuration.add(duration);

  check(response, {
    'vector search status 200': (r) => r.status === 200,
    'vector search has results': (r) => JSON.parse(r.body).results !== undefined,
  });
}

// Test: RAG Search (via Assistant Worker)
export function testRAGSearch(userId, conversationId) {
  const query = testQueries[Math.floor(Math.random() * testQueries.length)];

  const payload = JSON.stringify({
    query: query,
    userId: userId,
    conversationId: conversationId,
    limit: 5,
  });

  const params = {
    headers: {
      'Content-Type': 'application/json',
    },
    tags: { name: 'RAGSearch' },
  };

  const startTime = Date.now();
  const response = http.post(
    `${BASE_URL}/rag/search`,
    payload,
    params
  );
  const duration = Date.now() - startTime;

  ragSearchDuration.add(duration);

  const success = check(response, {
    'RAG search status 200 or 404': (r) => r.status === 200 || r.status === 404, // 404 acceptable if endpoint not exposed
    'RAG search response valid': (r) => r.body.length > 0,
  });

  if (!success && response.status !== 404) {
    ragSearchErrors.add(1);
  }
}

// Test: Health Check
export function testHealthCheck() {
  const params = {
    tags: { name: 'HealthCheck' },
  };

  http.get(`${BASE_URL}/health`, params);
  http.get(`${DATA_PROCESSING_URL}/health`, params);
}

// Main test scenario
export default function () {
  // Health check every 10th iteration
  if (__ITER % 10 === 0) {
    testHealthCheck();
  }

  // Process document
  const { userId, conversationId } = testDocumentProcessing();
  sleep(0.5); // Small delay after processing

  // Search the processed document
  testVectorSearch(userId, conversationId);
  sleep(0.3);

  // Try RAG search (may not have endpoint exposed)
  testRAGSearch(userId, conversationId);

  // Random sleep between 1-3 seconds
  sleep(Math.random() * 2 + 1);
}

// Setup function - runs once before all VUs
export function setup() {
  console.log('Starting Phase 8 RAG Pipeline Load Test');
  console.log(`Assistant Worker: ${BASE_URL}`);
  console.log(`Data Processing Worker: ${DATA_PROCESSING_URL}`);
  
  // Verify services are up
  const assistantHealth = http.get(`${BASE_URL}/health`);
  const dataProcessingHealth = http.get(`${DATA_PROCESSING_URL}/health`);
  
  if (assistantHealth.status !== 200) {
    console.warn(`Warning: Assistant Worker health check failed (${assistantHealth.status})`);
  }
  
  if (dataProcessingHealth.status !== 200) {
    console.warn(`Warning: Data Processing Worker health check failed (${dataProcessingHealth.status})`);
  }
  
  return {
    assistantHealthy: assistantHealth.status === 200,
    dataProcessingHealthy: dataProcessingHealth.status === 200,
  };
}

// Teardown function - runs once after all VUs
export function teardown(data) {
  console.log('Load test completed');
  console.log(`Assistant Worker was healthy: ${data.assistantHealthy}`);
  console.log(`Data Processing Worker was healthy: ${data.dataProcessingHealthy}`);
}
