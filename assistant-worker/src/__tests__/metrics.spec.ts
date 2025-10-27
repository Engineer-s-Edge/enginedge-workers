/**
 * Phase 8 Monitoring Metrics Tests
 * Tests for RAG, Kafka/DLQ, and Data Processing Worker metrics
 */

import { MetricsAdapter } from '../infrastructure/adapters/monitoring/metrics.adapter';

describe('Phase 8 Monitoring Metrics', () => {
  let metrics: MetricsAdapter;

  beforeEach(() => {
    metrics = new MetricsAdapter();
  });

  afterEach(() => {
    // Clean up registry
    metrics.registry.clear();
  });

  // ===== RAG PIPELINE METRICS =====
  describe('RAG Pipeline Metrics', () => {
    // Test ID: metrics-rag-001
    it('should record successful RAG search', async () => {
      metrics.recordRAGSearch('success', 'conv-123', 1.5, 5);

      const metricsOutput = await metrics.getMetrics();
      
      expect(metricsOutput).toContain('assistant_worker_rag_searches_total');
      expect(metricsOutput).toContain('status="success"');
      expect(metricsOutput).toContain('conversation_id="conv-123"');
    });

    // Test ID: metrics-rag-002
    it('should record failed RAG search', async () => {
      metrics.recordRAGSearch('error', 'conv-456', 0.5, 0);

      const metricsOutput = await metrics.getMetrics();
      
      expect(metricsOutput).toContain('assistant_worker_rag_searches_total');
      expect(metricsOutput).toContain('status="error"');
    });

    // Test ID: metrics-rag-003
    it('should track RAG search duration histogram', async () => {
      metrics.recordRAGSearch('success', 'conv-1', 0.1, 3);
      metrics.recordRAGSearch('success', 'conv-1', 2.5, 10);
      metrics.recordRAGSearch('success', 'conv-1', 5.0, 15);

      const metricsOutput = await metrics.getMetrics();
      
      expect(metricsOutput).toContain('assistant_worker_rag_search_duration_seconds');
      expect(metricsOutput).toContain('le="0.1"');
      expect(metricsOutput).toContain('le="5"');
    });

    // Test ID: metrics-rag-004
    it('should track RAG search results count', async () => {
      metrics.recordRAGSearch('success', 'conv-1', 1.0, 5);
      metrics.recordRAGSearch('success', 'conv-1', 1.0, 10);

      const metricsOutput = await metrics.getMetrics();
      
      expect(metricsOutput).toContain('assistant_worker_rag_search_results_count');
    });

    // Test ID: metrics-rag-005
    it('should record successful document processing', async () => {
      metrics.recordRAGDocumentProcessing('success', 'conv-789', 3.5);

      const metricsOutput = await metrics.getMetrics();
      
      expect(metricsOutput).toContain('assistant_worker_rag_documents_processed_total');
      expect(metricsOutput).toContain('status="success"');
      expect(metricsOutput).toContain('conversation_id="conv-789"');
    });

    // Test ID: metrics-rag-006
    it('should record failed document processing', async () => {
      metrics.recordRAGDocumentProcessing('error', 'conv-error', 1.0);

      const metricsOutput = await metrics.getMetrics();
      
      expect(metricsOutput).toContain('status="error"');
    });

    // Test ID: metrics-rag-007
    it('should track document processing duration', async () => {
      metrics.recordRAGDocumentProcessing('success', 'conv-1', 0.5);
      metrics.recordRAGDocumentProcessing('success', 'conv-1', 5.0);
      metrics.recordRAGDocumentProcessing('success', 'conv-1', 15.0);

      const metricsOutput = await metrics.getMetrics();
      
      expect(metricsOutput).toContain('assistant_worker_rag_document_processing_duration_seconds');
      expect(metricsOutput).toContain('le="5"');
      expect(metricsOutput).toContain('le="30"');
    });

    // Test ID: metrics-rag-008
    it('should set embedding cache hit rate', async () => {
      metrics.setRAGEmbeddingCacheHitRate(0.75);

      const metricsOutput = await metrics.getMetrics();
      
      expect(metricsOutput).toContain('assistant_worker_rag_embedding_cache_hit_rate');
      expect(metricsOutput).toContain('0.75');
    });

    // Test ID: metrics-rag-009
    it('should update embedding cache hit rate', async () => {
      metrics.setRAGEmbeddingCacheHitRate(0.5);
      metrics.setRAGEmbeddingCacheHitRate(0.8);
      metrics.setRAGEmbeddingCacheHitRate(0.95);

      const metricsOutput = await metrics.getMetrics();
      
      expect(metricsOutput).toContain('0.95');
    });

    // Test ID: metrics-rag-010
    it('should handle zero results in search', async () => {
      metrics.recordRAGSearch('success', 'conv-empty', 0.5, 0);

      const metricsOutput = await metrics.getMetrics();
      
      expect(metricsOutput).toContain('assistant_worker_rag_searches_total');
      expect(metricsOutput).toContain('assistant_worker_rag_search_results_count');
    });
  });

  // ===== KAFKA/DLQ METRICS =====
  describe('Kafka and DLQ Metrics', () => {
    // Test ID: metrics-kafka-001
    it('should record Kafka message produced', async () => {
      metrics.recordKafkaMessageProduced('user-events');

      const metricsOutput = await metrics.getMetrics();
      
      expect(metricsOutput).toContain('assistant_worker_kafka_messages_produced_total');
      expect(metricsOutput).toContain('topic="user-events"');
    });

    // Test ID: metrics-kafka-002
    it('should track messages produced to multiple topics', async () => {
      metrics.recordKafkaMessageProduced('topic-1');
      metrics.recordKafkaMessageProduced('topic-1');
      metrics.recordKafkaMessageProduced('topic-2');

      const metricsOutput = await metrics.getMetrics();
      
      expect(metricsOutput).toContain('topic="topic-1"');
      expect(metricsOutput).toContain('topic="topic-2"');
    });

    // Test ID: metrics-kafka-003
    it('should record successful message consumption', async () => {
      metrics.recordKafkaMessageConsumed('tasks', 'success');

      const metricsOutput = await metrics.getMetrics();
      
      expect(metricsOutput).toContain('assistant_worker_kafka_messages_consumed_total');
      expect(metricsOutput).toContain('topic="tasks"');
      expect(metricsOutput).toContain('status="success"');
    });

    // Test ID: metrics-kafka-004
    it('should record failed message consumption', async () => {
      metrics.recordKafkaMessageConsumed('tasks', 'error');

      const metricsOutput = await metrics.getMetrics();
      
      expect(metricsOutput).toContain('status="error"');
    });

    // Test ID: metrics-kafka-005
    it('should record message retry consumption', async () => {
      metrics.recordKafkaMessageConsumed('tasks', 'retry');

      const metricsOutput = await metrics.getMetrics();
      
      expect(metricsOutput).toContain('status="retry"');
    });

    // Test ID: metrics-kafka-006
    it('should track message processing duration', async () => {
      metrics.recordKafkaMessageProcessingDuration('events', 0.05);
      metrics.recordKafkaMessageProcessingDuration('events', 1.5);

      const metricsOutput = await metrics.getMetrics();
      
      expect(metricsOutput).toContain('assistant_worker_kafka_message_processing_duration_seconds');
      expect(metricsOutput).toContain('topic="events"');
    });

    // Test ID: metrics-kafka-007
    it('should set Kafka consumer lag', async () => {
      metrics.setKafkaConsumerLag('user-events', 0, 100);
      metrics.setKafkaConsumerLag('user-events', 1, 50);

      const metricsOutput = await metrics.getMetrics();
      
      expect(metricsOutput).toContain('assistant_worker_kafka_consumer_lag');
      expect(metricsOutput).toContain('topic="user-events"');
      expect(metricsOutput).toContain('partition="0"');
      expect(metricsOutput).toContain('partition="1"');
    });

    // Test ID: metrics-kafka-008
    it('should record DLQ messages', async () => {
      metrics.recordDLQMessage('tasks', 'TimeoutError');

      const metricsOutput = await metrics.getMetrics();
      
      expect(metricsOutput).toContain('assistant_worker_dlq_messages_total');
      expect(metricsOutput).toContain('topic="tasks"');
      expect(metricsOutput).toContain('error_type="TimeoutError"');
    });

    // Test ID: metrics-kafka-009
    it('should track DLQ messages by error type', async () => {
      metrics.recordDLQMessage('tasks', 'TimeoutError');
      metrics.recordDLQMessage('tasks', 'ValidationError');
      metrics.recordDLQMessage('events', 'TimeoutError');

      const metricsOutput = await metrics.getMetrics();
      
      expect(metricsOutput).toContain('error_type="TimeoutError"');
      expect(metricsOutput).toContain('error_type="ValidationError"');
    });

    // Test ID: metrics-kafka-010
    it('should record message retry attempts', async () => {
      metrics.recordMessageRetry('tasks', 1);
      metrics.recordMessageRetry('tasks', 2);
      metrics.recordMessageRetry('tasks', 3);

      const metricsOutput = await metrics.getMetrics();
      
      expect(metricsOutput).toContain('assistant_worker_message_retries_total');
      expect(metricsOutput).toContain('attempt="1"');
      expect(metricsOutput).toContain('attempt="2"');
      expect(metricsOutput).toContain('attempt="3"');
    });

    // Test ID: metrics-kafka-011
    it('should handle high consumer lag', async () => {
      metrics.setKafkaConsumerLag('high-traffic', 0, 10000);

      const metricsOutput = await metrics.getMetrics();
      
      expect(metricsOutput).toContain('10000');
    });

    // Test ID: metrics-kafka-012
    it('should track zero lag', async () => {
      metrics.setKafkaConsumerLag('up-to-date', 0, 0);

      const metricsOutput = await metrics.getMetrics();
      
      expect(metricsOutput).toContain('topic="up-to-date"');
    });
  });

  // ===== DATA PROCESSING WORKER METRICS =====
  describe('Data Processing Worker Metrics', () => {
    // Test ID: metrics-dpw-001
    it('should record successful Data Processing request', async () => {
      metrics.recordDataProcessingRequest('/documents/process-for-rag', 'success', 2.5);

      const metricsOutput = await metrics.getMetrics();
      
      expect(metricsOutput).toContain('assistant_worker_data_processing_requests_total');
      expect(metricsOutput).toContain('endpoint="/documents/process-for-rag"');
      expect(metricsOutput).toContain('status="success"');
    });

    // Test ID: metrics-dpw-002
    it('should record failed Data Processing request', async () => {
      metrics.recordDataProcessingRequest('/vector-store/search', 'error', 1.0);

      const metricsOutput = await metrics.getMetrics();
      
      expect(metricsOutput).toContain('status="error"');
    });

    // Test ID: metrics-dpw-003
    it('should track request duration histogram', async () => {
      metrics.recordDataProcessingRequest('/embedders/embed', 'success', 0.5);
      metrics.recordDataProcessingRequest('/embedders/embed', 'success', 2.0);
      metrics.recordDataProcessingRequest('/embedders/embed', 'success', 10.0);

      const metricsOutput = await metrics.getMetrics();
      
      expect(metricsOutput).toContain('assistant_worker_data_processing_request_duration_seconds');
      expect(metricsOutput).toContain('le="2"');
      expect(metricsOutput).toContain('le="10"');
    });

    // Test ID: metrics-dpw-004
    it('should record Data Processing errors', async () => {
      metrics.recordDataProcessingError('/documents/process-for-rag', 'NetworkError');

      const metricsOutput = await metrics.getMetrics();
      
      expect(metricsOutput).toContain('assistant_worker_data_processing_errors_total');
      expect(metricsOutput).toContain('error_type="NetworkError"');
    });

    // Test ID: metrics-dpw-005
    it('should track errors by endpoint and type', async () => {
      metrics.recordDataProcessingError('/vector-store/search', 'TimeoutError');
      metrics.recordDataProcessingError('/vector-store/search', 'ValidationError');
      metrics.recordDataProcessingError('/embedders/embed', 'TimeoutError');

      const metricsOutput = await metrics.getMetrics();
      
      expect(metricsOutput).toContain('endpoint="/vector-store/search"');
      expect(metricsOutput).toContain('endpoint="/embedders/embed"');
      expect(metricsOutput).toContain('error_type="TimeoutError"');
      expect(metricsOutput).toContain('error_type="ValidationError"');
    });

    // Test ID: metrics-dpw-006
    it('should track multiple endpoints', async () => {
      metrics.recordDataProcessingRequest('/documents/process-for-rag', 'success', 3.0);
      metrics.recordDataProcessingRequest('/vector-store/search-conversations', 'success', 1.5);
      metrics.recordDataProcessingRequest('/embedders/models', 'success', 0.1);

      const metricsOutput = await metrics.getMetrics();
      
      expect(metricsOutput).toContain('/documents/process-for-rag');
      expect(metricsOutput).toContain('/vector-store/search-conversations');
      expect(metricsOutput).toContain('/embedders/models');
    });

    // Test ID: metrics-dpw-007
    it('should handle fast requests', async () => {
      metrics.recordDataProcessingRequest('/embedders/models', 'success', 0.05);

      const metricsOutput = await metrics.getMetrics();
      
      expect(metricsOutput).toContain('assistant_worker_data_processing_request_duration_seconds');
    });

    // Test ID: metrics-dpw-008
    it('should handle slow requests', async () => {
      metrics.recordDataProcessingRequest('/documents/process-for-rag', 'success', 25.0);

      const metricsOutput = await metrics.getMetrics();
      
      expect(metricsOutput).toContain('le="30"');
    });
  });

  // ===== INTEGRATED WORKFLOW METRICS =====
  describe('Integrated Workflow Metrics', () => {
    // Test ID: metrics-workflow-001
    it('should track complete RAG search workflow', async () => {
      // Document processing
      metrics.recordRAGDocumentProcessing('success', 'conv-workflow', 5.0);
      metrics.recordDataProcessingRequest('/documents/process-for-rag', 'success', 5.0);
      
      // RAG search
      metrics.recordRAGSearch('success', 'conv-workflow', 1.5, 10);
      metrics.recordDataProcessingRequest('/vector-store/search-conversations', 'success', 1.5);
      
      const metricsOutput = await metrics.getMetrics();
      
      expect(metricsOutput).toContain('assistant_worker_rag_documents_processed_total');
      expect(metricsOutput).toContain('assistant_worker_rag_searches_total');
      expect(metricsOutput).toContain('assistant_worker_data_processing_requests_total');
    });

    // Test ID: metrics-workflow-002
    it('should track Kafka message with retry and DLQ', async () => {
      // Message consumed
      metrics.recordKafkaMessageConsumed('tasks', 'retry');
      metrics.recordMessageRetry('tasks', 1);
      
      // Another retry
      metrics.recordKafkaMessageConsumed('tasks', 'retry');
      metrics.recordMessageRetry('tasks', 2);
      
      // Final DLQ
      metrics.recordKafkaMessageConsumed('tasks', 'error');
      metrics.recordDLQMessage('tasks', 'ProcessingError');
      
      const metricsOutput = await metrics.getMetrics();
      
      expect(metricsOutput).toContain('status="retry"');
      expect(metricsOutput).toContain('status="error"');
      expect(metricsOutput).toContain('assistant_worker_dlq_messages_total');
      expect(metricsOutput).toContain('assistant_worker_message_retries_total');
    });

    // Test ID: metrics-workflow-003
    it('should track error propagation through stack', async () => {
      // RAG search fails
      metrics.recordRAGSearch('error', 'conv-error', 0.5, 0);
      
      // Data Processing Worker error
      metrics.recordDataProcessingRequest('/vector-store/search-conversations', 'error', 0.5);
      metrics.recordDataProcessingError('/vector-store/search-conversations', 'NetworkError');
      
      const metricsOutput = await metrics.getMetrics();
      
      expect(metricsOutput).toContain('assistant_worker_rag_searches_total{status="error"');
      expect(metricsOutput).toContain('assistant_worker_data_processing_requests_total{endpoint="/vector-store/search-conversations",status="error"');
      expect(metricsOutput).toContain('assistant_worker_data_processing_errors_total');
    });

    // Test ID: metrics-workflow-004
    it('should provide metrics for Prometheus scraping', async () => {
      metrics.recordRAGSearch('success', 'conv-1', 1.0, 5);
      metrics.recordKafkaMessageProduced('events');
      metrics.recordDataProcessingRequest('/embedders/embed', 'success', 0.5);

      const metricsOutput = await metrics.getMetrics();
      
      // Should be in Prometheus format
      expect(metricsOutput).toMatch(/# HELP/);
      expect(metricsOutput).toMatch(/# TYPE/);
      expect(typeof metricsOutput).toBe('string');
    });

    // Test ID: metrics-workflow-005
    it('should handle high-volume metrics efficiently', async () => {
      const start = Date.now();
      
      // Simulate high volume
      for (let i = 0; i < 1000; i++) {
        metrics.recordKafkaMessageProduced('high-volume');
        metrics.recordKafkaMessageConsumed('high-volume', 'success');
      }
      
      const duration = Date.now() - start;
      
      // Should complete quickly (< 100ms for 2000 metric recordings)
      expect(duration).toBeLessThan(100);
      
      const metricsOutput = await metrics.getMetrics();
      expect(metricsOutput).toContain('assistant_worker_kafka_messages_produced_total');
    });
  });
});
