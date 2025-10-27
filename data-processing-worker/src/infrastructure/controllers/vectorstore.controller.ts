import { Controller, Get, Post, Delete, Body, Param, Logger } from '@nestjs/common';
import { MongoDBVectorStoreAdapter } from '../adapters/vectorstores/mongodb.vectorstore';

interface MetadataFilter extends Record<string, unknown> {
  sourceType?: string;
  mimeType?: string;
  createdAfter?: Date;
  createdBefore?: Date;
}

/**
 * Vector Store Controller
 * 
 * REST API endpoints for vector store operations:
 * - Similarity search
 * - Metadata search
 * - Hybrid search (text + vector)
 * - Document management
 * - Access control
 */
@Controller('vector-store')
export class VectorStoreController {
  private readonly logger = new Logger(VectorStoreController.name);

  constructor(
    private readonly vectorStore: MongoDBVectorStoreAdapter,
  ) {}

  /**
   * POST /vector-store/search
   * Similarity search by embedding
   */
  @Post('search')
  async search(
    @Body()
    body: {
      queryEmbedding: number[];
      limit?: number;
      filter?: Record<string, unknown>;
    },
  ) {
    this.logger.log('Similarity search requested');

    const { queryEmbedding, limit = 5, filter } = body;

    if (!queryEmbedding || !Array.isArray(queryEmbedding)) {
      throw new Error('queryEmbedding must be an array of numbers');
    }

    const results = await this.vectorStore.similaritySearch(
      queryEmbedding,
      limit,
      filter,
    );

    return {
      results,
      count: results.length,
    };
  }

  /**
   * POST /vector-store/hybrid-search
   * Hybrid search combining text and vector similarity
   */
  @Post('hybrid-search')
  async hybridSearch(
    @Body()
    body: {
      queryEmbedding: number[];
      queryText: string;
      limit?: number;
      filter?: Record<string, unknown>;
    },
  ) {
    this.logger.log('Hybrid search requested');

    const { queryEmbedding, queryText, limit = 5, filter } = body;

    if (!queryEmbedding || !queryText) {
      throw new Error('queryEmbedding and queryText are required');
    }

    const results = await this.vectorStore.hybridSearch(
      queryEmbedding,
      queryText,
      limit,
      filter,
    );

    return {
      results,
      count: results.length,
    };
  }

  /**
   * POST /vector-store/search-with-access
   * Search with user/conversation access control
   */
  @Post('search-with-access')
  async searchWithAccess(
    @Body()
    body: {
      queryEmbedding: number[];
      userId: string;
      conversationId?: string;
      limit?: number;
    },
  ) {
    this.logger.log(`Search with access control for user: ${body.userId}`);

    const { queryEmbedding, userId, conversationId, limit = 5 } = body;

    const results = await this.vectorStore.searchWithAccessControl(
      queryEmbedding,
      userId,
      conversationId,
      limit,
    );

    return {
      results,
      count: results.length,
    };
  }

  /**
   * POST /vector-store/search-conversations
   * Search specifically for conversation-scoped documents
   * Used by Assistant Worker for RAG with conversation context
   */
  @Post('search-conversations')
  async searchConversations(
    @Body()
    body: {
      queryEmbedding: number[];
      conversationId: string;
      userId: string;
      limit?: number;
      includeGlobalDocuments?: boolean;
    },
  ) {
    this.logger.log(`Conversation search for: ${body.conversationId}`);

    const { queryEmbedding, conversationId, userId, limit = 5, includeGlobalDocuments = true } = body;

    // Build filter for conversation-scoped documents
    const filter: Record<string, unknown> = {
      $or: [
        { 'metadata.conversationId': conversationId },
      ],
    };

    // Optionally include global/shared documents
    if (includeGlobalDocuments) {
      filter.$or.push(
        { 'metadata.scope': 'global' },
        { 'metadata.userId': userId, 'metadata.scope': 'user' },
      );
    }

    const results = await this.vectorStore.similaritySearch(
      queryEmbedding,
      limit,
      filter,
    );

    return {
      results,
      conversationId,
      count: results.length,
    };
  }

  /**
   * POST /vector-store/search-metadata
   * Search with metadata filtering
   */
  @Post('search-metadata')
  async searchWithMetadata(
    @Body()
    body: {
      queryEmbedding: number[];
      limit?: number;
      sourceType?: string;
      mimeType?: string;
      createdAfter?: string;
      createdBefore?: string;
    },
  ) {
    this.logger.log('Metadata-filtered search requested');

    const {
      queryEmbedding,
      limit = 5,
      sourceType,
      mimeType,
      createdAfter,
      createdBefore,
    } = body;

    const metadataFilter: MetadataFilter = {};
    if (sourceType) metadataFilter.sourceType = sourceType;
    if (mimeType) metadataFilter.mimeType = mimeType;
    if (createdAfter) metadataFilter.createdAfter = new Date(createdAfter);
    if (createdBefore) metadataFilter.createdBefore = new Date(createdBefore);

    const results = await this.vectorStore.searchWithMetadataFilter(
      queryEmbedding,
      limit,
      metadataFilter,
    );

    return {
      results,
      count: results.length,
    };
  }

  /**
   * POST /vector-store/batch-search
   * Batch search for multiple queries
   */
  @Post('batch-search')
  async batchSearch(
    @Body()
    body: {
      queryEmbeddings: number[][];
      limit?: number;
      filter?: Record<string, unknown>;
    },
  ) {
    this.logger.log(`Batch search for ${body.queryEmbeddings.length} queries`);

    const { queryEmbeddings, limit = 5, filter } = body;

    const results = await this.vectorStore.batchSearch(
      queryEmbeddings,
      limit,
      filter,
    );

    return {
      results,
      queriesCount: queryEmbeddings.length,
      totalResults: results.reduce((sum, r) => sum + r.length, 0),
    };
  }

  /**
   * GET /vector-store/document/:id
   * Get document by ID
   */
  @Get('document/:id')
  async getDocument(@Param('id') id: string) {
    this.logger.log(`Fetching document: ${id}`);

    const document = await this.vectorStore.getDocument(id);

    if (!document) {
      return { error: 'Document not found', id };
    }

    return { document };
  }

  /**
   * POST /vector-store/document/:id
   * Update document
   */
  @Post('document/:id')
  async updateDocument(
    @Param('id') id: string,
    @Body()
    body: {
      content?: string;
      metadata?: Record<string, unknown>;
    },
  ) {
    this.logger.log(`Updating document: ${id}`);

    await this.vectorStore.updateDocument(id, body);

    return {
      message: 'Document updated successfully',
      id,
    };
  }

  /**
   * DELETE /vector-store/documents
   * Delete multiple documents
   */
  @Delete('documents')
  async deleteDocuments(
    @Body() body: { ids: string[] },
  ) {
    this.logger.log(`Deleting ${body.ids.length} documents`);

    await this.vectorStore.deleteDocuments(body.ids);

    return {
      message: 'Documents deleted successfully',
      deletedCount: body.ids.length,
    };
  }
}
