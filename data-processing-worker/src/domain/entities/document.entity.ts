/**
 * Document Entity - Core domain entity for loaded documents
 *
 * Represents a document that has been loaded from various sources
 * (filesystem, web, etc.) with its content and metadata.
 */

export interface DocumentMetadata {
  source: string;
  sourceType: 'file' | 'url' | 'text';
  mimeType?: string;
  fileName?: string;
  fileExtension?: string;
  pageNumber?: number;
  totalPages?: number;
  author?: string;
  createdAt?: Date;
  modifiedAt?: Date;
  title?: string;
  language?: string;
  encoding?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any; // Allow additional custom metadata
}

export class Document {
  public readonly embedding?: number[] | Embedding; // Optional embedding vector

  constructor(
    public readonly id: string,
    public readonly content: string,
    public readonly metadata: DocumentMetadata,
    public readonly createdAt: Date = new Date(),
    embedding?: number[] | Embedding,
  ) {
    this.embedding = embedding;
  }

  /**
   * Create a new document with updated content
   */
  withContent(newContent: string): Document {
    return new Document(this.id, newContent, this.metadata, this.createdAt);
  }

  /**
   * Create a new document with additional metadata
   */
  withMetadata(additionalMetadata: Partial<DocumentMetadata>): Document {
    return new Document(
      this.id,
      this.content,
      { ...this.metadata, ...additionalMetadata },
      this.createdAt,
    );
  }

  /**
   * Get document size in bytes
   */
  get size(): number {
    return Buffer.byteLength(this.content, 'utf8');
  }

  /**
   * Get document word count
   */
  get wordCount(): number {
    return this.content.split(/\s+/).filter((word) => word.length > 0).length;
  }

  /**
   * Get document line count
   */
  get lineCount(): number {
    return this.content.split('\n').length;
  }
}

/**
 * Document chunk - represents a split portion of a larger document
 */
export class DocumentChunk extends Document {
  constructor(
    id: string,
    content: string,
    metadata: DocumentMetadata,
    public readonly parentDocumentId: string,
    public readonly chunkIndex: number,
    public readonly totalChunks: number,
    createdAt: Date = new Date(),
  ) {
    super(id, content, metadata, createdAt);
  }
}

/**
 * Embedding vector for document or chunk
 */
export interface Embedding {
  vector: number[];
  model: string;
  dimensions: number;
}

/**
 * Document with embedding
 */
export class EmbeddedDocument extends Document {
  constructor(
    id: string,
    content: string,
    metadata: DocumentMetadata,
    embedding: Embedding,
    createdAt: Date = new Date(),
  ) {
    super(id, content, metadata, createdAt, embedding);
  }

  get embeddingVector(): number[] {
    if (
      this.embedding &&
      typeof this.embedding === 'object' &&
      'vector' in this.embedding
    ) {
      return (this.embedding as Embedding).vector;
    }
    return [];
  }
}
