import { Injectable, Logger, Inject, Optional } from '@nestjs/common';
import { LoaderRegistryService } from './loader-registry.service';
import { Document } from '../../domain/entities/document.entity';
import {
  TextSplitterPort,
  EmbedderPort,
  VectorStorePort,
} from '../../domain/ports/processing.port';

/**
 * Document Processing Service (Application Layer)
 *
 * Orchestrates the complete document processing pipeline:
 * 1. Load documents
 * 2. Split into chunks
 * 3. Generate embeddings
 * 4. Store in vector database
 */
@Injectable()
export class DocumentProcessingService {
  private readonly logger = new Logger(DocumentProcessingService.name);

  constructor(
    private readonly loaderRegistry: LoaderRegistryService,
    @Optional()
    @Inject('TextSplitterPort')
    private readonly textSplitter?: TextSplitterPort,
    @Optional()
    @Inject('EmbedderPort')
    private readonly embedder?: EmbedderPort,
    @Optional()
    @Inject('VectorStorePort')
    private readonly vectorStore?: VectorStorePort,
  ) {
    this.logger.log('Document Processing Service initialized');
  }

  /**
   * Process a document: load, split, embed, and store
   */
  async processDocument(
    source: string | Blob,
    options?: {
      loaderName?: string;
      loaderOptions?: Record<string, unknown>;
      split?: boolean;
      splitOptions?: Record<string, unknown>;
      embed?: boolean;
      store?: boolean;
      metadata?: Record<string, unknown>;
    },
  ): Promise<{ documentIds: string[]; chunks: number }> {
    this.logger.log(
      `Processing document from source: ${typeof source === 'string' ? source : 'Blob'}`,
    );

    // 1. Load documents
    const documents = await this.loadDocument(
      source,
      options?.loaderName,
      options?.loaderOptions,
    );
    this.logger.log(`Loaded ${documents.length} documents`);

    // 2. Split into chunks (optional)
    let processedDocs = documents;
    if (options?.split !== false) {
      if (!this.textSplitter) {
        throw new Error(
          'TextSplitter not configured. Please configure a text splitter to enable document splitting.',
        );
      }
      processedDocs = await this.textSplitter.splitDocuments(
        documents,
        options?.splitOptions,
      );
      this.logger.log(`Split into ${processedDocs.length} chunks`);
    }

    // 3. Generate embeddings and store (optional)
    if (options?.embed !== false && options?.store !== false) {
      if (!this.embedder) {
        throw new Error(
          'Embedder not configured. Please configure an embedder to enable embedding generation.',
        );
      }
      if (!this.vectorStore) {
        throw new Error(
          'VectorStore not configured. Please configure a vector store to enable document storage.',
        );
      }

      const texts = processedDocs.map((doc) => doc.content);
      const embeddings = await this.embedder.embedBatch(texts);
      this.logger.log(`Generated ${embeddings.length} embeddings`);

      const documentIds = await this.vectorStore.storeDocuments(
        processedDocs,
        embeddings,
        options?.metadata,
      );
      this.logger.log(`Stored ${documentIds.length} documents in vector store`);

      return { documentIds, chunks: processedDocs.length };
    }

    return {
      documentIds: processedDocs.map((d) => d.id),
      chunks: processedDocs.length,
    };
  }

  /**
   * Load document with auto-detection or specific loader
   */
  private async loadDocument(
    source: string | Blob,
    loaderName?: string,
    options?: Record<string, unknown>,
  ): Promise<Document[]> {
    if (loaderName) {
      const loader = this.loaderRegistry.getLoader(loaderName);
      if (!loader) {
        throw new Error(`Loader not found: ${loaderName}`);
      }
      return loader.load(source, options);
    }

    return this.loaderRegistry.loadAuto(source, options);
  }

  /**
   * Search for similar documents
   */
  async searchSimilar(
    query: string,
    limit: number = 5,
    filter?: Record<string, unknown>,
  ): Promise<Array<{ document: Document; score: number }>> {
    this.logger.log(
      `Searching for similar documents: "${query}" (limit: ${limit})`,
    );

    if (!this.embedder) {
      throw new Error(
        'Embedder not configured. Please configure an embedder to enable similarity search.',
      );
    }
    if (!this.vectorStore) {
      throw new Error(
        'VectorStore not configured. Please configure a vector store to enable similarity search.',
      );
    }

    const queryEmbedding = await this.embedder.embedText(query);
    const results = await this.vectorStore.similaritySearch(
      queryEmbedding,
      limit,
      filter,
    );

    this.logger.log(`Found ${results.length} similar documents`);
    return results;
  }

  /**
   * Delete documents by IDs
   */
  async deleteDocuments(ids: string[]): Promise<void> {
    this.logger.log(`Deleting ${ids.length} documents`);

    if (!this.vectorStore) {
      throw new Error(
        'VectorStore not configured. Please configure a vector store to enable document deletion.',
      );
    }

    await this.vectorStore.deleteDocuments(ids);
  }

  /**
   * Get document by ID
   */
  async getDocument(id: string): Promise<Document | null> {
    if (!this.vectorStore) {
      throw new Error(
        'VectorStore not configured. Please configure a vector store to retrieve documents.',
      );
    }

    return this.vectorStore.getDocument(id);
  }

  /**
   * Get supported file types
   */
  getSupportedTypes(): string[] {
    return this.loaderRegistry.getSupportedTypes();
  }

  /**
   * Detect and load URLs from text content
   */
  async detectAndLoadURLs(
    content: string,
    options?: {
      maxUrls?: number;
      loaderOptions?: Record<string, unknown>;
    },
  ): Promise<Document[]> {
    this.logger.log('Detecting URLs in content');

    // URL regex pattern
    const urlRegex =
      /https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)/gi;
    const urls = content.match(urlRegex) || [];
    const uniqueUrls = [...new Set(urls)];

    const maxUrls = options?.maxUrls || 10;
    const limitedUrls = uniqueUrls.slice(0, maxUrls);

    this.logger.log(
      `Found ${uniqueUrls.length} unique URLs, loading ${limitedUrls.length}`,
    );

    const allDocuments: Document[] = [];

    for (const url of limitedUrls) {
      try {
        const docs = await this.loaderRegistry.loadAuto(
          url,
          options?.loaderOptions,
        );
        allDocuments.push(...docs);
        this.logger.log(`Loaded ${docs.length} documents from ${url}`);
      } catch (error: any) {
        this.logger.warn(`Failed to load URL ${url}: ${error.message}`);
      }
    }

    return allDocuments;
  }

  /**
   * Process attachments (files) from a list
   */
  async processAttachments(
    attachments: Array<{ filename: string; content: Blob }>,
    options?: {
      split?: boolean;
      embed?: boolean;
      store?: boolean;
      metadata?: Record<string, unknown>;
    },
  ): Promise<{ documentIds: string[]; totalChunks: number }> {
    this.logger.log(`Processing ${attachments.length} attachments`);

    const allDocumentIds: string[] = [];
    let totalChunks = 0;

    for (const attachment of attachments) {
      try {
        const result = await this.processDocument(attachment.content, {
          ...options,
          metadata: {
            ...options?.metadata,
            filename: attachment.filename,
            attachmentSource: true,
          },
        });

        allDocumentIds.push(...result.documentIds);
        totalChunks += result.chunks;

        this.logger.log(
          `Processed attachment: ${attachment.filename} (${result.chunks} chunks)`,
        );
      } catch (error: any) {
        this.logger.error(
          `Failed to process attachment ${attachment.filename}: ${error.message}`,
        );
      }
    }

    return { documentIds: allDocumentIds, totalChunks };
  }

  /**
   * Process references (URLs or document IDs) and retrieve their content
   */
  async processReferences(
    references: string[],
    options?: {
      split?: boolean;
      embed?: boolean;
      store?: boolean;
      metadata?: Record<string, unknown>;
    },
  ): Promise<{ documentIds: string[]; totalChunks: number }> {
    this.logger.log(`Processing ${references.length} references`);

    const allDocumentIds: string[] = [];
    let totalChunks = 0;

    for (const reference of references) {
      try {
        // Check if it's a URL
        if (
          reference.startsWith('http://') ||
          reference.startsWith('https://')
        ) {
          const result = await this.processDocument(reference, {
            ...options,
            metadata: {
              ...options?.metadata,
              referenceUrl: reference,
            },
          });

          allDocumentIds.push(...result.documentIds);
          totalChunks += result.chunks;
        } else {
          // Assume it's a document ID, retrieve and reprocess
          const doc = await this.getDocument(reference);
          if (doc) {
            this.logger.log(`Retrieved reference document: ${reference}`);
            allDocumentIds.push(doc.id);
          } else {
            this.logger.warn(`Reference document not found: ${reference}`);
          }
        }
      } catch (error: any) {
        this.logger.error(
          `Failed to process reference ${reference}: ${error.message}`,
        );
      }
    }

    return { documentIds: allDocumentIds, totalChunks };
  }

  /**
   * Shorten content to a maximum length while preserving meaning
   */
  async shortenContent(
    content: string,
    maxLength: number = 1000,
    options?: {
      preserveStructure?: boolean;
      summarize?: boolean;
    },
  ): Promise<string> {
    this.logger.log(
      `Shortening content from ${content.length} to max ${maxLength} characters`,
    );

    // Simple truncation if content is already short enough
    if (content.length <= maxLength) {
      return content;
    }

    if (options?.summarize) {
      // TODO: Implement LLM-based summarization
      // For now, use intelligent truncation
      this.logger.warn(
        'LLM summarization not yet implemented, using truncation',
      );
    }

    if (options?.preserveStructure) {
      // Try to preserve paragraph structure
      const paragraphs = content.split('\n\n');
      let shortened = '';

      for (const paragraph of paragraphs) {
        if ((shortened + paragraph).length <= maxLength - 50) {
          shortened += paragraph + '\n\n';
        } else {
          break;
        }
      }

      if (shortened.length > 0) {
        return shortened.trim() + '\n\n[Content truncated...]';
      }
    }

    // Simple truncation with ellipsis
    return content.substring(0, maxLength - 20) + '\n\n[Content truncated...]';
  }
}
