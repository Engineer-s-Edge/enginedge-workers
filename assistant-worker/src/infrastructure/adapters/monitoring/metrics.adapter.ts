/**
 * Metrics Adapter
 *
 * Provides Prometheus metrics for monitoring and observability.
 */

import { Injectable } from '@nestjs/common';
import { Counter, Histogram, Gauge, Registry } from 'prom-client';

/**
 * Metrics Adapter for Prometheus
 */
@Injectable()
export class MetricsAdapter {
  public readonly registry: Registry;

  // Request metrics
  private requestCounter: Counter<string>;
  private responseTimeHistogram: Histogram<string>;
  private errorCounter: Counter<string>;

  // Agent metrics
  private activeAgentsGauge: Gauge<string>;
  private agentExecutionDuration: Histogram<string>;
  private agentExecutionCounter: Counter<string>;

  // Memory metrics
  private memoryOperationsCounter: Counter<string>;
  private memoryOperationDuration: Histogram<string>;
  private conversationsGauge: Gauge<string>;

  // Knowledge graph metrics
  private kgQueryCounter: Counter<string>;
  private kgQueryDuration: Histogram<string>;
  private kgNodesGauge: Gauge<string>;
  private kgEdgesGauge: Gauge<string>;

  // Database metrics
  private dbConnectionsGauge: Gauge<string>;
  private dbQueryDuration: Histogram<string>;

  // System metrics
  private memoryUsageGauge: Gauge<string>;
  private cpuUsageGauge: Gauge<string>;

  // Phase 8: RAG Pipeline metrics
  private ragSearchCounter: Counter<string>;
  private ragSearchDuration: Histogram<string>;
  private ragDocumentProcessingCounter: Counter<string>;
  private ragDocumentProcessingDuration: Histogram<string>;
  private ragEmbeddingCacheHitRate: Gauge<string>;
  private ragSearchResultsHistogram: Histogram<string>;

  // Phase 8: Kafka/DLQ metrics
  private kafkaMessagesProduced: Counter<string>;
  private kafkaMessagesConsumed: Counter<string>;
  private kafkaMessageProcessingDuration: Histogram<string>;
  private kafkaConsumerLagGauge: Gauge<string>;
  private dlqMessagesCounter: Counter<string>;
  private messageRetryCounter: Counter<string>;

  // Phase 8: Data Processing Worker integration
  private dataProcessingRequestCounter: Counter<string>;
  private dataProcessingRequestDuration: Histogram<string>;
  private dataProcessingErrorCounter: Counter<string>;

  // Expert Pool metrics
  private expertPoolActiveExperts: Gauge<string>;
  private expertPoolExecutionsTotal: Counter<string>;
  private expertPoolExecutionDuration: Histogram<string>;
  private expertPoolCollisionsTotal: Counter<string>;
  private expertPoolModificationsTotal: Counter<string>;

  // Conversations metrics
  private conversationEventsTotal: Counter<string>;
  private conversationMessageEditsTotal: Counter<string>;
  private conversationToolCallDuration: Histogram<string>;

  constructor() {
    this.registry = new Registry();

    // Initialize request metrics
    this.requestCounter = new Counter({
      name: 'assistant_worker_requests_total',
      help: 'Total number of HTTP requests',
      labelNames: ['method', 'endpoint', 'status'],
      registers: [this.registry],
    });

    this.responseTimeHistogram = new Histogram({
      name: 'assistant_worker_response_time_seconds',
      help: 'HTTP response time in seconds',
      labelNames: ['method', 'endpoint'],
      buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5, 10],
      registers: [this.registry],
    });

    this.errorCounter = new Counter({
      name: 'assistant_worker_errors_total',
      help: 'Total number of errors',
      labelNames: ['type', 'endpoint'],
      registers: [this.registry],
    });

    // Initialize agent metrics
    this.activeAgentsGauge = new Gauge({
      name: 'assistant_worker_active_agents',
      help: 'Number of currently executing agents',
      labelNames: ['type'],
      registers: [this.registry],
    });

    this.agentExecutionDuration = new Histogram({
      name: 'assistant_worker_agent_execution_duration_seconds',
      help: 'Agent execution duration in seconds',
      labelNames: ['type', 'status'],
      buckets: [0.5, 1, 2, 5, 10, 30, 60],
      registers: [this.registry],
    });

    this.agentExecutionCounter = new Counter({
      name: 'assistant_worker_agent_executions_total',
      help: 'Total number of agent executions',
      labelNames: ['type', 'status'],
      registers: [this.registry],
    });

    // Initialize memory metrics
    this.memoryOperationsCounter = new Counter({
      name: 'assistant_worker_memory_operations_total',
      help: 'Total number of memory operations',
      labelNames: ['operation', 'memory_type'],
      registers: [this.registry],
    });

    this.memoryOperationDuration = new Histogram({
      name: 'assistant_worker_memory_operation_duration_seconds',
      help: 'Memory operation duration in seconds',
      labelNames: ['operation', 'memory_type'],
      buckets: [0.01, 0.05, 0.1, 0.5, 1],
      registers: [this.registry],
    });

    this.conversationsGauge = new Gauge({
      name: 'assistant_worker_conversations_total',
      help: 'Total number of active conversations',
      registers: [this.registry],
    });

    // Conversations metrics
    this.conversationEventsTotal = new Counter({
      name: 'assistant_worker_conversation_events_total',
      help: 'Total number of conversation events',
      labelNames: ['type'],
      registers: [this.registry],
    });

    this.conversationMessageEditsTotal = new Counter({
      name: 'assistant_worker_conversation_message_edits_total',
      help: 'Total number of message edits',
      labelNames: ['role'],
      registers: [this.registry],
    });

    this.conversationToolCallDuration = new Histogram({
      name: 'assistant_worker_conversation_tool_call_duration_seconds',
      help: 'Tool call duration in seconds',
      labelNames: ['name', 'status'],
      buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5, 10],
      registers: [this.registry],
    });

    // Initialize knowledge graph metrics
    this.kgQueryCounter = new Counter({
      name: 'assistant_worker_kg_queries_total',
      help: 'Total number of knowledge graph queries',
      labelNames: ['operation'],
      registers: [this.registry],
    });

    this.kgQueryDuration = new Histogram({
      name: 'assistant_worker_kg_query_duration_seconds',
      help: 'Knowledge graph query duration in seconds',
      labelNames: ['operation'],
      buckets: [0.01, 0.05, 0.1, 0.5, 1, 2],
      registers: [this.registry],
    });

    this.kgNodesGauge = new Gauge({
      name: 'assistant_worker_kg_nodes_total',
      help: 'Total number of knowledge graph nodes',
      labelNames: ['layer'],
      registers: [this.registry],
    });

    this.kgEdgesGauge = new Gauge({
      name: 'assistant_worker_kg_edges_total',
      help: 'Total number of knowledge graph edges',
      registers: [this.registry],
    });

    // Initialize database metrics
    this.dbConnectionsGauge = new Gauge({
      name: 'assistant_worker_db_connections',
      help: 'Number of active database connections',
      labelNames: ['database'],
      registers: [this.registry],
    });

    this.dbQueryDuration = new Histogram({
      name: 'assistant_worker_db_query_duration_seconds',
      help: 'Database query duration in seconds',
      labelNames: ['database', 'operation'],
      buckets: [0.01, 0.05, 0.1, 0.5, 1, 2],
      registers: [this.registry],
    });

    // Initialize system metrics
    this.memoryUsageGauge = new Gauge({
      name: 'assistant_worker_memory_usage_bytes',
      help: 'Memory usage in bytes',
      registers: [this.registry],
    });

    this.cpuUsageGauge = new Gauge({
      name: 'assistant_worker_cpu_usage_percent',
      help: 'CPU usage percentage',
      registers: [this.registry],
    });

    // Initialize Phase 8: RAG Pipeline metrics
    this.ragSearchCounter = new Counter({
      name: 'assistant_worker_rag_searches_total',
      help: 'Total number of RAG searches',
      labelNames: ['status', 'conversation_id'],
      registers: [this.registry],
    });

    this.ragSearchDuration = new Histogram({
      name: 'assistant_worker_rag_search_duration_seconds',
      help: 'RAG search duration in seconds',
      labelNames: ['status'],
      buckets: [0.1, 0.5, 1, 2, 5, 10],
      registers: [this.registry],
    });

    this.ragDocumentProcessingCounter = new Counter({
      name: 'assistant_worker_rag_documents_processed_total',
      help: 'Total number of documents processed for RAG',
      labelNames: ['status', 'conversation_id'],
      registers: [this.registry],
    });

    this.ragDocumentProcessingDuration = new Histogram({
      name: 'assistant_worker_rag_document_processing_duration_seconds',
      help: 'RAG document processing duration in seconds',
      labelNames: ['status'],
      buckets: [0.5, 1, 2, 5, 10, 30],
      registers: [this.registry],
    });

    this.ragEmbeddingCacheHitRate = new Gauge({
      name: 'assistant_worker_rag_embedding_cache_hit_rate',
      help: 'RAG embedding cache hit rate (0-1)',
      registers: [this.registry],
    });

    this.ragSearchResultsHistogram = new Histogram({
      name: 'assistant_worker_rag_search_results_count',
      help: 'Number of results returned by RAG searches',
      buckets: [0, 1, 5, 10, 20, 50, 100],
      registers: [this.registry],
    });

    // Initialize Phase 8: Kafka/DLQ metrics
    this.kafkaMessagesProduced = new Counter({
      name: 'assistant_worker_kafka_messages_produced_total',
      help: 'Total number of Kafka messages produced',
      labelNames: ['topic'],
      registers: [this.registry],
    });

    this.kafkaMessagesConsumed = new Counter({
      name: 'assistant_worker_kafka_messages_consumed_total',
      help: 'Total number of Kafka messages consumed',
      labelNames: ['topic', 'status'],
      registers: [this.registry],
    });

    this.kafkaMessageProcessingDuration = new Histogram({
      name: 'assistant_worker_kafka_message_processing_duration_seconds',
      help: 'Kafka message processing duration in seconds',
      labelNames: ['topic'],
      buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5],
      registers: [this.registry],
    });

    this.kafkaConsumerLagGauge = new Gauge({
      name: 'assistant_worker_kafka_consumer_lag',
      help: 'Kafka consumer lag (messages behind)',
      labelNames: ['topic', 'partition'],
      registers: [this.registry],
    });

    this.dlqMessagesCounter = new Counter({
      name: 'assistant_worker_dlq_messages_total',
      help: 'Total number of messages sent to Dead Letter Queue',
      labelNames: ['topic', 'error_type'],
      registers: [this.registry],
    });

    this.messageRetryCounter = new Counter({
      name: 'assistant_worker_message_retries_total',
      help: 'Total number of message retry attempts',
      labelNames: ['topic', 'attempt'],
      registers: [this.registry],
    });

    // Initialize Phase 8: Data Processing Worker integration
    this.dataProcessingRequestCounter = new Counter({
      name: 'assistant_worker_data_processing_requests_total',
      help: 'Total number of requests to Data Processing Worker',
      labelNames: ['endpoint', 'status'],
      registers: [this.registry],
    });

    this.dataProcessingRequestDuration = new Histogram({
      name: 'assistant_worker_data_processing_request_duration_seconds',
      help: 'Data Processing Worker request duration in seconds',
      labelNames: ['endpoint'],
      buckets: [0.1, 0.5, 1, 2, 5, 10, 30],
      registers: [this.registry],
    });

    this.dataProcessingErrorCounter = new Counter({
      name: 'assistant_worker_data_processing_errors_total',
      help: 'Total number of Data Processing Worker errors',
      labelNames: ['endpoint', 'error_type'],
      registers: [this.registry],
    });

    // Initialize Expert Pool metrics
    this.expertPoolActiveExperts = new Gauge({
      name: 'assistant_worker_expert_pool_active_experts',
      help: 'Number of currently active expert executions',
      registers: [this.registry],
    });

    this.expertPoolExecutionsTotal = new Counter({
      name: 'assistant_worker_expert_pool_executions_total',
      help: 'Total number of expert executions',
      labelNames: ['status'],
      registers: [this.registry],
    });

    this.expertPoolExecutionDuration = new Histogram({
      name: 'assistant_worker_expert_pool_execution_duration_seconds',
      help: 'Expert execution duration in seconds',
      labelNames: ['status'],
      buckets: [1, 5, 10, 30, 60, 300, 600],
      registers: [this.registry],
    });

    this.expertPoolCollisionsTotal = new Counter({
      name: 'assistant_worker_expert_pool_collisions_total',
      help: 'Total number of knowledge graph node collisions',
      labelNames: ['resolution'],
      registers: [this.registry],
    });

    this.expertPoolModificationsTotal = new Counter({
      name: 'assistant_worker_expert_pool_modifications_total',
      help: 'Total number of knowledge graph modifications by experts',
      labelNames: ['operation_type', 'success'],
      registers: [this.registry],
    });

    // Start collecting system metrics
    this.startSystemMetricsCollection();
  }

  /**
   * Record HTTP request
   */
  recordRequest(method: string, endpoint: string, status: number): void {
    this.requestCounter.inc({ method, endpoint, status: status.toString() });
  }

  /**
   * Record response time
   */
  recordResponseTime(
    method: string,
    endpoint: string,
    durationSeconds: number,
  ): void {
    this.responseTimeHistogram.observe({ method, endpoint }, durationSeconds);
  }

  /**
   * Record error
   */
  recordError(type: string, endpoint: string): void {
    this.errorCounter.inc({ type, endpoint });
  }

  /**
   * Set active agents count
   */
  setActiveAgents(type: string, count: number): void {
    this.activeAgentsGauge.set({ type }, count);
  }

  /**
   * Record agent execution
   */
  recordAgentExecution(
    type: string,
    status: string,
    durationSeconds: number,
  ): void {
    this.agentExecutionCounter.inc({ type, status });
    this.agentExecutionDuration.observe({ type, status }, durationSeconds);
  }

  /**
   * Record memory operation
   */
  recordMemoryOperation(
    operation: string,
    memoryType: string,
    durationSeconds: number,
  ): void {
    this.memoryOperationsCounter.inc({ operation, memory_type: memoryType });
    this.memoryOperationDuration.observe(
      { operation, memory_type: memoryType },
      durationSeconds,
    );
  }

  /**
   * Set conversations count
   */
  setConversationsCount(count: number): void {
    this.conversationsGauge.set(count);
  }

  /**
   * Record knowledge graph query
   */
  recordKGQuery(operation: string, durationSeconds: number): void {
    this.kgQueryCounter.inc({ operation });
    this.kgQueryDuration.observe({ operation }, durationSeconds);
  }

  /**
   * Set knowledge graph nodes count
   */
  setKGNodesCount(layer: string, count: number): void {
    this.kgNodesGauge.set({ layer }, count);
  }

  /**
   * Set knowledge graph edges count
   */
  setKGEdgesCount(count: number): void {
    this.kgEdgesGauge.set(count);
  }

  /**
   * Set database connections count
   */
  setDBConnections(database: string, count: number): void {
    this.dbConnectionsGauge.set({ database }, count);
  }

  /**
   * Record database query
   */
  recordDBQuery(
    database: string,
    operation: string,
    durationSeconds: number,
  ): void {
    this.dbQueryDuration.observe({ database, operation }, durationSeconds);
  }

  // ===== Expert Pool Metrics =====

  /**
   * Update active experts count
   */
  updateExpertPoolActiveExperts(count: number): void {
    this.expertPoolActiveExperts.set(count);
  }

  /**
   * Record expert execution
   */
  recordExpertExecution(agentType: string, status: string): void {
    this.expertPoolExecutionsTotal.inc({ status });
    this.agentExecutionCounter.inc({ type: agentType, status });
  }

  /**
   * Record expert execution duration
   */
  recordExpertExecutionDuration(
    durationSeconds: number,
    status: string,
  ): void {
    this.expertPoolExecutionDuration.observe({ status }, durationSeconds);
  }

  /**
   * Record expert pool allocation
   */
  recordExpertPoolAllocation(): void {
    // This can be used for additional tracking if needed
    // For now, we track through executions
  }

  /**
   * Record knowledge graph collision
   */
  recordKGCollision(resolution: string): void {
    this.expertPoolCollisionsTotal.inc({ resolution });
  }

  /**
   * Record knowledge graph modification
   */
  recordKGModification(operationType: string, success: boolean): void {
    this.expertPoolModificationsTotal.inc({
      operation_type: operationType,
      success: success.toString(),
    });
  }

  /**
   * Get metrics in Prometheus format
   */
  async getMetrics(): Promise<string> {
    return this.registry.metrics();
  }

  // ===== Conversations Metrics =====
  recordConversationEvent(type: string): void {
    this.conversationEventsTotal.inc({ type });
  }

  recordMessageEdit(role: string): void {
    this.conversationMessageEditsTotal.inc({ role });
  }

  observeToolCallDuration(name: string, status: string, seconds: number): void {
    this.conversationToolCallDuration.observe({ name, status }, seconds);
  }

  // ===== Phase 8: RAG Pipeline Metrics =====

  /**
   * Record RAG search operation
   */
  recordRAGSearch(
    status: 'success' | 'error',
    conversationId: string,
    durationSeconds: number,
    resultCount: number,
  ): void {
    this.ragSearchCounter.inc({ status, conversation_id: conversationId });
    this.ragSearchDuration.observe({ status }, durationSeconds);
    this.ragSearchResultsHistogram.observe(resultCount);
  }

  /**
   * Record RAG document processing
   */
  recordRAGDocumentProcessing(
    status: 'success' | 'error',
    conversationId: string,
    durationSeconds: number,
  ): void {
    this.ragDocumentProcessingCounter.inc({
      status,
      conversation_id: conversationId,
    });
    this.ragDocumentProcessingDuration.observe({ status }, durationSeconds);
  }

  /**
   * Set RAG embedding cache hit rate
   */
  setRAGEmbeddingCacheHitRate(hitRate: number): void {
    this.ragEmbeddingCacheHitRate.set(hitRate);
  }

  // ===== Phase 8: Kafka/DLQ Metrics =====

  /**
   * Record Kafka message produced
   */
  recordKafkaMessageProduced(topic: string): void {
    this.kafkaMessagesProduced.inc({ topic });
  }

  /**
   * Record Kafka message consumed
   */
  recordKafkaMessageConsumed(
    topic: string,
    status: 'success' | 'error' | 'retry',
  ): void {
    this.kafkaMessagesConsumed.inc({ topic, status });
  }

  /**
   * Record Kafka message processing duration
   */
  recordKafkaMessageProcessingDuration(
    topic: string,
    durationSeconds: number,
  ): void {
    this.kafkaMessageProcessingDuration.observe({ topic }, durationSeconds);
  }

  /**
   * Set Kafka consumer lag
   */
  setKafkaConsumerLag(topic: string, partition: number, lag: number): void {
    this.kafkaConsumerLagGauge.set(
      { topic, partition: partition.toString() },
      lag,
    );
  }

  /**
   * Record DLQ message
   */
  recordDLQMessage(topic: string, errorType: string): void {
    this.dlqMessagesCounter.inc({ topic, error_type: errorType });
  }

  /**
   * Record message retry attempt
   */
  recordMessageRetry(topic: string, attempt: number): void {
    this.messageRetryCounter.inc({ topic, attempt: attempt.toString() });
  }

  // ===== Phase 8: Data Processing Worker Metrics =====

  /**
   * Record Data Processing Worker request
   */
  recordDataProcessingRequest(
    endpoint: string,
    status: 'success' | 'error',
    durationSeconds: number,
  ): void {
    this.dataProcessingRequestCounter.inc({ endpoint, status });
    this.dataProcessingRequestDuration.observe({ endpoint }, durationSeconds);
  }

  /**
   * Record Data Processing Worker error
   */
  recordDataProcessingError(endpoint: string, errorType: string): void {
    this.dataProcessingErrorCounter.inc({ endpoint, error_type: errorType });
  }

  /**
   * Start collecting system metrics
   */
  private startSystemMetricsCollection(): void {
    setInterval(() => {
      const memUsage = process.memoryUsage();
      this.memoryUsageGauge.set(memUsage.heapUsed);

      // CPU usage (simplified)
      const usage = process.cpuUsage();
      const totalUsage = (usage.user + usage.system) / 1000000; // Convert to seconds
      this.cpuUsageGauge.set(totalUsage);
    }, 10000); // Every 10 seconds
  }
}
