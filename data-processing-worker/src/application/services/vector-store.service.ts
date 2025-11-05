/**
 * Vector Store Service
 *
 * Orchestrates vector store operations including:
 * - Document storage with permissions
 * - Semantic search (vector similarity)
 * - BM25 text search
 * - Access control
 */

import { Injectable, Logger, Inject, Optional } from '@nestjs/common';
import { VectorStorePort } from '@domain/ports/processing.port';
import { Document } from '@domain/entities/document.entity';
import { BM25SearchService } from './bm25-search.service';
import { EmbedderService } from './embedder.service';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { DocumentModel } from '../../infrastructure/database/schemas/document.schema';

export interface DocumentSearchResult {
  document: Document;
  score: number;
  bertScore?: number;
  combinedScore?: number;
}

export interface SearchOptions {
  conversationId?: string;
  global?: boolean;
  useBertScore?: boolean;
  bertScoreAlpha?: number;
}

@Injectable()
export class VectorStoreService {
  private readonly logger = new Logger(VectorStoreService.name);

  constructor(
    @Inject('VectorStorePort')
    private readonly vectorStore: VectorStorePort,
    private readonly bm25Service: BM25SearchService,
    @Optional() @Inject('EmbedderService')
    private readonly embedderService?: EmbedderService,
    @Optional() @InjectModel(DocumentModel.name)
    private readonly documentModel?: Model<DocumentModel>,
  ) {}

  /**
   * Store documents with permissions
   */
  async storeDocuments(
    documents: Document[],
    embeddings: number[][],
    metadata?: {
      ownerId?: string;
      allowedUserIds?: string[];
      userId?: string;
      conversationId?: string;
      [key: string]: unknown;
    },
  ): Promise<string[]> {
    const enrichedMetadata = {
      ...metadata,
      ownerId: metadata?.ownerId || metadata?.userId,
    };

    return await this.vectorStore.storeDocuments(
      documents,
      embeddings,
      enrichedMetadata,
    );
  }

  /**
   * Semantic search (vector similarity) with access control
   */
  async semanticSearchDocs(
    query: string,
    topK: number,
    userId: string,
    options: SearchOptions = {},
    embedderConfig?: { provider?: string },
  ): Promise<DocumentSearchResult[]> {
    this.logger.log(
      `Semantic search for user ${userId}, query length: ${query.length}, topK: ${topK}${options.useBertScore ? ' (BERT-score enabled)' : ''}`,
    );

    // Generate query embedding
    if (!this.embedderService) {
      throw new Error('Embedder service not available');
    }

    if (embedderConfig?.provider) {
      this.embedderService.setEmbedder(embedderConfig.provider);
    }

    const queryEmbedding = await this.embedderService.embedText(query);

    // Build access filter
    const filter: Record<string, unknown> = {};

    // Access control: user can access documents they own or are allowed to access
    filter.$or = [
      { ownerId: userId },
      { allowedUserIds: userId },
      { userId },
    ];

    if (options.conversationId && !options.global) {
      filter.conversationId = options.conversationId;
    }

    // Perform vector search
    const vectorResults = await this.vectorStore.similaritySearch(
      queryEmbedding,
      options.useBertScore ? topK * 2 : topK,
      filter,
    );

    // If BERT-score is enabled, rerank results
    if (options.useBertScore && this.embedderService) {
      // Get all documents for reranking
      const allDocs = await this.getAllDocumentsByAccess(userId, filter);

      const searchResults = options.bertScoreAlpha !== undefined
        ? this.embedderService.searchByHybridScore(
            queryEmbedding,
            allDocs,
            topK,
            (doc) => doc.embedding || [],
            (doc) => doc.content,
            query,
            options.bertScoreAlpha,
          )
        : this.embedderService.searchByBertScore(
            queryEmbedding,
            allDocs,
            topK,
            (doc) => doc.embedding || [],
            (doc) => doc.content,
            query,
          );

      return searchResults.map((result) => ({
        document: result.item,
        score: result.score,
        bertScore: result.bertScore,
        combinedScore: result.combinedScore,
      }));
    }

    return vectorResults.map((r) => ({
      document: r.document,
      score: r.score,
    }));
  }

  /**
   * BM25 text search with access control
   */
  async textSearchDocs(
    query: string,
    topK: number,
    userId: string,
    options: SearchOptions = {},
  ): Promise<DocumentSearchResult[]> {
    this.logger.log(
      `BM25 text search for user ${userId}, query: "${query}", topK: ${topK}`,
    );

    // Get all accessible documents
    const allDocs = await this.getAllDocumentsByAccess(userId, {
      conversationId: options.conversationId && !options.global ? options.conversationId : undefined,
    });

    if (allDocs.length === 0) {
      this.logger.warn('BM25 text search requested on empty corpus');
      return [];
    }

    // Prepare documents for BM25 search
    const bm25Docs = allDocs.map((doc) => ({
      id: doc.id,
      text: doc.content,
    }));

    // Perform BM25 search
    const bm25Results = await this.bm25Service.searchDocuments(
      bm25Docs,
      query,
      { limit: topK },
    );

    // Map results back to documents
    const results: DocumentSearchResult[] = [];
    for (const result of bm25Results) {
      const doc = allDocs.find((d) => d.id === result.id);
      if (doc) {
        results.push({
          document: doc,
          score: result.score,
        });
      }
    }

    this.logger.log(`BM25 text search completed, returning ${results.length} results`);
    return results;
  }

  /**
   * Get all documents accessible by user
   */
  private async getAllDocumentsByAccess(
    userId: string,
    filter: Record<string, unknown> = {},
  ): Promise<Document[]> {
    if (!this.documentModel) {
      this.logger.warn('Document model not available for getAllDocumentsByAccess');
      return [];
    }

    // Access control: user can access documents they own or are allowed to access
    const accessFilter: any = {
      $or: [
        { ownerId: userId },
        { allowedUserIds: userId },
        { userId },
      ],
      ...filter,
    };

    // Remove conversationId from filter if it's in the filter object (it's already in accessFilter)
    if (filter.conversationId) {
      accessFilter.conversationId = filter.conversationId;
    }

    const results = await this.documentModel.find(accessFilter).exec();

    return results.map((result) =>
      new Document(
        result.documentId,
        result.content,
        {
          ...result.metadata,
          ownerId: result.ownerId,
          allowedUserIds: result.allowedUserIds,
          userId: result.userId,
          conversationId: result.conversationId,
        },
        result.createdAt,
      )
    );
  }

  /**
   * Delete document with permission check
   */
  async deleteDocument(docId: string, userId: string): Promise<void> {
    const doc = await this.vectorStore.getDocument(docId);
    if (!doc) {
      throw new Error('Document not found');
    }

    // Check permissions
    const metadata = doc.metadata as any;
    const ownerId = metadata?.ownerId || metadata?.userId;

    if (ownerId !== userId) {
      throw new Error('Unauthorized: Only the document owner can delete this document');
    }

    await this.vectorStore.deleteDocuments([docId]);
  }

  /**
   * Get document by ID with access check
   */
  async getDocument(docId: string, userId: string): Promise<Document | null> {
    const doc = await this.vectorStore.getDocument(docId);
    if (!doc) {
      return null;
    }

    // Check access
    const metadata = doc.metadata as any;
    const ownerId = metadata?.ownerId || metadata?.userId;
    const allowedUserIds = metadata?.allowedUserIds || [];

    if (ownerId !== userId && !allowedUserIds.includes(userId)) {
      throw new Error('Unauthorized: You do not have access to this document');
    }

    return doc;
  }
}
