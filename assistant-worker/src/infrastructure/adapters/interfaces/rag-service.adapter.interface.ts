/**
 * RAG Service Adapter Interface
 * 
 * Port interface for Data Processing Worker RAG integration
 * Provides document processing and vector search capabilities for Expert Agent
 */

/**
 * Document to be processed for RAG
 */
export interface RAGDocument {
  content: string;
  userId: string;
  conversationId?: string;
  metadata?: {
    fileName?: string;
    mimeType?: string;
    title?: string;
    [key: string]: unknown;
  };
  chunkingStrategy?: {
    method?: 'semantic' | 'fixed' | 'recursive';
    chunkSize?: number;
    overlap?: number;
  };
  embeddingConfig?: {
    model?: string;
    batchSize?: number;
  };
}

/**
 * Result of document processing
 */
export interface RAGDocumentProcessingResult {
  success: boolean;
  documentId: string;
  chunks: number;
  embeddings: number;
  stored: boolean;
  metadata: {
    processingTime: number;
    embeddingModel: string;
    chunkingMethod: string;
  };
}

/**
 * Vector search parameters
 */
export interface RAGSearchRequest {
  query: string;
  userId: string;
  conversationId: string;
  limit?: number;
  similarityThreshold?: number;
  includeMetadata?: boolean;
  filters?: Record<string, unknown>;
}

/**
 * Vector search result item
 */
export interface RAGSearchResultItem {
  id: string;
  content: string;
  score: number;
  metadata: Record<string, unknown>;
  documentId: string;
  chunkIndex: number;
  conversationId: string;
}

/**
 * Vector search results
 */
export interface RAGSearchResult {
  success: boolean;
  conversationId: string;
  query: {
    userId: string;
    limit: number;
    similarityThreshold: number;
  };
  results: RAGSearchResultItem[];
  count: number;
  totalMatches: number;
}

/**
 * Conversation documents request
 */
export interface RAGConversationDocsRequest {
  conversationId: string;
  userId: string;
  limit?: number;
  offset?: number;
}

/**
 * Conversation document
 */
export interface RAGConversationDocument {
  id: string;
  content: string;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  chunkCount: number;
}

/**
 * Conversation documents result
 */
export interface RAGConversationDocsResult {
  success: boolean;
  conversationId: string;
  count: number;
  total: number;
  documents: RAGConversationDocument[];
}

/**
 * Available embedding model
 */
export interface EmbeddingModel {
  id: string;
  provider: string;
  displayName: string;
  dimensions: number;
  maxTokens: number;
  maxBatchSize: number;
  costPer1kTokens: number;
  capabilities: string[];
  performance: {
    avgLatency: number;
    throughput: number;
  };
  recommended: boolean;
}

/**
 * Embedding models result
 */
export interface EmbeddingModelsResult {
  count: number;
  models: EmbeddingModel[];
}

/**
 * RAG Service Adapter Interface
 */
export interface IRAGServiceAdapter {
  /**
   * Process a document for RAG (chunking + embedding + storage)
   * @param document Document to process
   * @returns Processing result with document ID and statistics
   */
  processDocument(document: RAGDocument): Promise<RAGDocumentProcessingResult>;

  /**
   * Search for relevant content in conversation context
   * @param request Search request with query and filters
   * @returns Search results with relevant chunks and scores
   */
  searchConversation(request: RAGSearchRequest): Promise<RAGSearchResult>;

  /**
   * Get all documents for a conversation
   * @param request Conversation documents request
   * @returns List of documents in conversation
   */
  getConversationDocuments(request: RAGConversationDocsRequest): Promise<RAGConversationDocsResult>;

  /**
   * Get available embedding models
   * @param provider Optional provider filter
   * @returns List of available models with specifications
   */
  getEmbeddingModels(provider?: string): Promise<EmbeddingModelsResult>;

  /**
   * Check if RAG service is available
   * @returns True if service is reachable
   */
  isAvailable(): Promise<boolean>;
}
