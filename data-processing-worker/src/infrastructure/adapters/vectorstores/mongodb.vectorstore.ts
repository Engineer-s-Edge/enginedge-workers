import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { DocumentModel } from '../../database/schemas/document.schema';
import { VectorStorePort } from '@domain/ports/processing.port';
import { Document } from '@domain/entities/document.entity';

/**
 * MongoDB Vector Store Adapter (Infrastructure Layer)
 *
 * Stores document embeddings in MongoDB with vector search support.
 * Requires MongoDB Atlas with vector search enabled for similarity search.
 */
@Injectable()
export class MongoDBVectorStoreAdapter implements VectorStorePort {
  private readonly logger = new Logger(MongoDBVectorStoreAdapter.name);

  constructor(
    @InjectModel(DocumentModel.name)
    private readonly documentModel: Model<DocumentModel>,
  ) {
    this.logger.log('MongoDB Vector Store initialized');
  }

  async storeDocuments(
    documents: Document[],
    embeddings: number[][],
    metadata?: Record<string, unknown>,
  ): Promise<string[]> {
    this.logger.log(`Storing ${documents.length} documents with embeddings`);

    if (documents.length !== embeddings.length) {
      throw new Error(
        'Documents and embeddings arrays must have the same length',
      );
    }

    const documentIds: string[] = [];

    for (let i = 0; i < documents.length; i++) {
      const doc = documents[i];
      const embedding = embeddings[i];

      const mongoDoc = new this.documentModel({
        documentId: doc.id,
        content: doc.content,
        metadata: { ...doc.metadata, ...metadata },
        embedding,
        embeddingModel: metadata?.embeddingModel || 'unknown',
        userId: metadata?.userId,
        conversationId: metadata?.conversationId,
        createdAt: doc.createdAt,
      });

      await mongoDoc.save();
      documentIds.push(doc.id);
    }

    this.logger.log(`Stored ${documentIds.length} documents`);
    return documentIds;
  }

  async similaritySearch(
    queryEmbedding: number[],
    limit: number,
    filter?: Record<string, unknown>,
  ): Promise<Array<{ document: Document; score: number }>> {
    this.logger.log(`Performing vector similarity search (limit: ${limit})`);

    try {
      // MongoDB Atlas Vector Search aggregation pipeline
      const pipeline: unknown[] = [
        {
          $vectorSearch: {
            queryVector: queryEmbedding,
            path: 'embedding',
            numCandidates: limit * 10,
            limit,
            index: 'vector_index', // Must be created in MongoDB Atlas
          },
        },
        {
          $project: {
            documentId: 1,
            content: 1,
            metadata: 1,
            score: { $meta: 'vectorSearchScore' },
          },
        },
      ];

      // Add filter if provided
      if (filter) {
        pipeline.push({ $match: filter } as any);
      }

      const results = await this.documentModel
        .aggregate(pipeline as any)
        .exec();

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mappedResults = results.map((result: any) => ({
        document: new Document(
          result.documentId,
          result.content,
          result.metadata,
        ),
        score: result.score,
      }));

      this.logger.log(`Found ${mappedResults.length} similar documents`);
      return mappedResults;
    } catch (error) {
      this.logger.error(
        `Vector search failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );

      // Fallback to text search if vector search is not available
      this.logger.warn(
        'Falling back to text search (vector search may not be configured)',
      );
      return this.textSearch((filter?.query as string) || '', limit);
    }
  }

  /**
   * Fallback text search using MongoDB text index
   */
  private async textSearch(
    query: string,
    limit: number,
  ): Promise<Array<{ document: Document; score: number }>> {
    const results = await this.documentModel
      .find({ $text: { $search: query } })
      .limit(limit)
      .exec();

    return results.map((result) => ({
      document: new Document(
        result.documentId,
        result.content,
        result.metadata as any,
      ),
      score: 0.5, // Placeholder score for text search
    }));
  }

  async deleteDocuments(ids: string[]): Promise<void> {
    this.logger.log(`Deleting ${ids.length} documents`);
    await this.documentModel.deleteMany({ documentId: { $in: ids } }).exec();
  }

  async getDocument(id: string): Promise<Document | null> {
    const result = await this.documentModel.findOne({ documentId: id }).exec();

    if (!result) {
      return null;
    }

    return new Document(
      result.documentId,
      result.content,
      result.metadata as any,
      result.createdAt,
    );
  }

  /**
   * Update document metadata and content
   */
  async updateDocument(
    id: string,
    updates: {
      content?: string;
      metadata?: Record<string, unknown>;
    },
  ): Promise<void> {
    this.logger.log(`Updating document: ${id}`);

    const updateData: any = {};
    if (updates.content) {
      updateData.content = updates.content;
    }
    if (updates.metadata) {
      updateData.metadata = { ...updates.metadata, updatedAt: new Date() };
    }

    const result = await this.documentModel
      .updateOne({ documentId: id }, updateData)
      .exec();

    if (result.matchedCount === 0) {
      throw new Error(`Document not found: ${id}`);
    }

    this.logger.log(`Document updated successfully: ${id}`);
  }

  /**
   * Hybrid search combining vector similarity with text search
   */
  async hybridSearch(
    queryEmbedding: number[],
    queryText: string,
    limit: number = 5,
    filter?: Record<string, unknown>,
  ): Promise<Array<{ document: Document; score: number }>> {
    this.logger.log(`Hybrid search for "${queryText}" (limit: ${limit})`);

    try {
      // Get vector search results
      const vectorResults = await this.similaritySearch(
        queryEmbedding,
        limit * 2,
        filter,
      );

      // Get text search results
      let textResults: Array<{ document: Document; score: number }> = [];
      try {
        textResults = await this.textSearch(queryText, limit * 2);
      } catch (error) {
        this.logger.warn('Text search failed in hybrid search');
      }

      // Combine and deduplicate results
      const combinedMap = new Map<
        string,
        { document: Document; vectorScore: number; textScore: number }
      >();

      // Add vector results
      for (const result of vectorResults) {
        combinedMap.set(result.document.id, {
          document: result.document,
          vectorScore: result.score,
          textScore: 0,
        });
      }

      // Add/merge text results
      for (const result of textResults) {
        const existing = combinedMap.get(result.document.id);
        if (existing) {
          existing.textScore = result.score;
        } else {
          combinedMap.set(result.document.id, {
            document: result.document,
            vectorScore: 0,
            textScore: result.score,
          });
        }
      }

      // Calculate hybrid scores (weighted average: 60% vector, 40% text)
      const hybridResults = Array.from(combinedMap.values())
        .map((item) => ({
          document: item.document,
          score: item.vectorScore * 0.6 + item.textScore * 0.4,
        }))
        .sort((a, b) => b.score - a.score)
        .slice(0, limit);

      this.logger.log(`Hybrid search found ${hybridResults.length} results`);
      return hybridResults;
    } catch (error) {
      this.logger.error(
        `Hybrid search failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      // Fallback to vector search only
      return this.similaritySearch(queryEmbedding, limit, filter);
    }
  }

  /**
   * Search with access control by userId/conversationId
   */
  async searchWithAccessControl(
    queryEmbedding: number[],
    userId: string,
    conversationId?: string,
    limit: number = 5,
  ): Promise<Array<{ document: Document; score: number }>> {
    this.logger.log(`Searching with access control for user: ${userId}`);

    const accessFilter: any = { userId };
    if (conversationId) {
      accessFilter.conversationId = conversationId;
    }

    return this.similaritySearch(queryEmbedding, limit, accessFilter);
  }

  /**
   * Search with metadata filtering
   */
  async searchWithMetadataFilter(
    queryEmbedding: number[],
    limit: number = 5,
    metadataFilter?: {
      sourceType?: string;
      mimeType?: string;
      createdAfter?: Date;
      createdBefore?: Date;
      [key: string]: unknown;
    },
  ): Promise<Array<{ document: Document; score: number }>> {
    this.logger.log(`Searching with metadata filter`);

    const mongoFilter: any = {};

    if (metadataFilter) {
      if (metadataFilter.sourceType) {
        mongoFilter['metadata.sourceType'] = metadataFilter.sourceType;
      }
      if (metadataFilter.mimeType) {
        mongoFilter['metadata.mimeType'] = metadataFilter.mimeType;
      }
      if (metadataFilter.createdAfter || metadataFilter.createdBefore) {
        mongoFilter.createdAt = {};
        if (metadataFilter.createdAfter) {
          mongoFilter.createdAt.$gte = metadataFilter.createdAfter;
        }
        if (metadataFilter.createdBefore) {
          mongoFilter.createdAt.$lte = metadataFilter.createdBefore;
        }
      }
    }

    return this.similaritySearch(queryEmbedding, limit, mongoFilter);
  }

  /**
   * Batch search for multiple queries
   */
  async batchSearch(
    queryEmbeddings: number[][],
    limit: number = 5,
    filter?: Record<string, unknown>,
  ): Promise<Array<Array<{ document: Document; score: number }>>> {
    this.logger.log(`Batch searching ${queryEmbeddings.length} queries`);

    const results: Array<Array<{ document: Document; score: number }>> = [];

    for (const embedding of queryEmbeddings) {
      const searchResult = await this.similaritySearch(
        embedding,
        limit,
        filter,
      );
      results.push(searchResult);
    }

    return results;
  }
}
