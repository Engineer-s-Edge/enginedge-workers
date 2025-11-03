import { Document } from '../entities/document.entity';

/**
 * Text Splitter Port - Interface for splitting documents into chunks
 */
export abstract class TextSplitterPort {
  /**
   * Split documents into smaller chunks
   * @param documents - Documents to split
   * @param options - Splitter-specific options
   * @returns Promise<Document[]> - Array of document chunks
   */
  abstract splitDocuments(
    documents: Document[],
    options?: Record<string, unknown>,
  ): Promise<Document[]>;

  /**
   * Split text directly into chunks (default implementation extracts from splitDocuments)
   * @param text - Text to split
   * @param options - Splitter-specific options
   * @returns Promise<string[]> - Array of text chunks
   */
  async splitText(
    text: string,
    options?: Record<string, unknown>,
  ): Promise<string[]> {
    // Default implementation: create temp document, split, extract content
    const tempDoc = new Document('temp', text, {
      source: 'text',
      sourceType: 'text' as const,
    });
    const chunks = await this.splitDocuments([tempDoc], options);
    return chunks.map((chunk) => chunk.content);
  }
}

/**
 * Embedder Port - Interface for generating embeddings
 */
export interface EmbedderPort {
  /**
   * Generate embedding for a single text
   */
  embedText(text: string): Promise<number[]>;

  /**
   * Generate embeddings for multiple texts (batch)
   */
  embedBatch(texts: string[]): Promise<number[][]>;

  /**
   * Get embedding dimensions
   */
  getDimensions(): number;

  /**
   * Get model name
   */
  getModelName(): string;
}

/**
 * Vector Store Port - Interface for vector storage and retrieval
 */
export interface VectorStorePort {
  /**
   * Store document embeddings
   */
  storeDocuments(
    documents: Document[],
    embeddings: number[][],
    metadata?: Record<string, unknown>,
  ): Promise<string[]>;

  /**
   * Similarity search
   */
  similaritySearch(
    queryEmbedding: number[],
    limit: number,
    filter?: Record<string, unknown>,
  ): Promise<Array<{ document: Document; score: number }>>;

  /**
   * Delete documents by IDs
   */
  deleteDocuments(ids: string[]): Promise<void>;

  /**
   * Get document by ID
   */
  getDocument(id: string): Promise<Document | null>;
}

/**
 * Document Repository Port - For MongoDB persistence
 */
export interface DocumentRepositoryPort {
  /**
   * Save a document
   */
  save(document: Document): Promise<string>;

  /**
   * Find by ID
   */
  findById(id: string): Promise<Document | null>;

  /**
   * Find by query
   */
  find(query: Record<string, unknown>): Promise<Document[]>;

  /**
   * Delete by ID
   */
  deleteById(id: string): Promise<void>;

  /**
   * Update document
   */
  update(id: string, updates: Partial<Document>): Promise<void>;
}
