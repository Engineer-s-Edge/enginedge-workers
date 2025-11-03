import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Param,
  UploadedFile,
  UseInterceptors,
  HttpCode,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { DocumentProcessingService } from '../../application/services/document-processing.service';
import { LoaderRegistryService } from '../../application/services/loader-registry.service';

interface MulterFile {
  fieldname: string;
  originalname: string;
  encoding: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

/**
 * Document Controller (Infrastructure Layer)
 *
 * REST API endpoints for document processing operations.
 */
@Controller('documents')
export class DocumentController {
  private readonly logger = new Logger(DocumentController.name);

  constructor(
    private readonly documentProcessingService: DocumentProcessingService,
    private readonly loaderRegistry: LoaderRegistryService,
  ) {}

  /**
   * Upload and process a document file
   * POST /documents/upload
   */
  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  @HttpCode(HttpStatus.CREATED)
  async uploadDocument(
    @UploadedFile() file: MulterFile,
    @Body('split') split?: string,
    @Body('embed') embed?: string,
    @Body('store') store?: string,
    @Body('metadata') metadata?: string,
  ) {
    this.logger.log(
      `Uploading document: ${file.originalname} (${file.size} bytes)`,
    );

    const blob = new Blob([new Uint8Array(file.buffer)], {
      type: file.mimetype,
    });

    const options = {
      loaderOptions: { fileName: file.originalname },
      split: split !== 'false',
      embed: embed !== 'false',
      store: store !== 'false',
      metadata: metadata ? JSON.parse(metadata) : {},
    };

    const result = await this.documentProcessingService.processDocument(
      blob,
      options,
    );

    return {
      success: true,
      fileName: file.originalname,
      ...result,
    };
  }

  /**
   * Process a document from URL
   * POST /documents/process-url
   */
  @Post('process-url')
  @HttpCode(HttpStatus.CREATED)
  async processUrl(
    @Body('url') url: string,
    @Body('split') split?: boolean,
    @Body('embed') embed?: boolean,
    @Body('store') store?: boolean,
    @Body('metadata') metadata?: Record<string, unknown>,
  ) {
    this.logger.log(`Processing document from URL: ${url}`);

    const options = {
      split: split !== false,
      embed: embed !== false,
      store: store !== false,
      metadata: metadata || {},
    };

    const result = await this.documentProcessingService.processDocument(
      url,
      options,
    );

    return {
      success: true,
      url,
      ...result,
    };
  }

  /**
   * Process document optimized for RAG (Retrieval Augmented Generation)
   * Returns chunks with embeddings in agent-friendly format
   * POST /documents/process-for-rag
   */
  @Post('process-for-rag')
  @HttpCode(HttpStatus.CREATED)
  async processForRAG(
    @Body('url') url?: string,
    @Body('content') content?: string,
    @Body('similarity') similarity?: 'cosine' | 'euclidean' | 'dotProduct',
    @Body('topK') topK?: number,
    @Body('filters') filters?: Record<string, unknown>,
    @Body('chunkSize') chunkSize?: number,
    @Body('chunkOverlap') chunkOverlap?: number,
    @Body('metadata') metadata?: Record<string, unknown>,
  ) {
    this.logger.log(`Processing document for RAG: ${url || 'inline content'}`);

    const source = url || content;
    if (!source) {
      return {
        success: false,
        error: 'Either url or content must be provided',
      };
    }

    const options = {
      split: true,
      embed: true,
      store: true,
      metadata: {
        ...metadata,
        processedForRAG: true,
        similarity: similarity || 'cosine',
        topK: topK || 5,
        timestamp: new Date().toISOString(),
      },
      splitterOptions: {
        chunkSize: chunkSize || 1000,
        chunkOverlap: chunkOverlap || 200,
      },
    };

    const result = await this.documentProcessingService.processDocument(
      source,
      options,
    );

    // Return in RAG-friendly format
    return {
      success: true,
      ragConfig: {
        similarity: similarity || 'cosine',
        topK: topK || 5,
        filters: filters || {},
      },
      chunks:
        result.documents?.map((doc) => ({
          id: doc.id,
          content: doc.content,
          metadata: doc.metadata,
          embedding: doc.embedding,
        })) || [],
      totalChunks: result.documents?.length || 0,
      processingTime: result.processingTime,
    };
  }

  /**
   * Search for similar documents
   * POST /documents/search
   */
  @Post('search')
  @HttpCode(HttpStatus.OK)
  async searchDocuments(
    @Body('query') query: string,
    @Body('limit') limit?: number,
    @Body('filter') filter?: Record<string, unknown>,
  ) {
    this.logger.log(`Searching documents: "${query}"`);

    const results = await this.documentProcessingService.searchSimilar(
      query,
      limit || 5,
      filter,
    );

    return {
      success: true,
      query,
      results: results.map((r) => ({
        documentId: r.document.id,
        content: r.document.content.substring(0, 500), // Truncate for response
        metadata: r.document.metadata,
        score: r.score,
      })),
    };
  }

  /**
   * Get document by ID
   * GET /documents/:id
   */
  @Get(':id')
  async getDocument(@Param('id') id: string) {
    this.logger.log(`Getting document: ${id}`);

    const document = await this.documentProcessingService.getDocument(id);

    if (!document) {
      return {
        success: false,
        message: 'Document not found',
      };
    }

    return {
      success: true,
      document: {
        id: document.id,
        content: document.content,
        metadata: document.metadata,
        createdAt: document.createdAt,
      },
    };
  }

  /**
   * Get documents by conversation ID
   * GET /documents/by-conversation/:conversationId
   */
  @Get('by-conversation/:conversationId')
  async getDocumentsByConversation(
    @Param('conversationId') conversationId: string,
  ) {
    this.logger.log(`Getting documents for conversation: ${conversationId}`);

    const results = await this.documentProcessingService.searchSimilar(
      '', // Empty query to get all
      100, // Limit
      { 'metadata.conversationId': conversationId }, // Filter by conversation
    );

    return {
      success: true,
      conversationId,
      documents: results.map((r) => ({
        id: r.document.id,
        content: r.document.content.substring(0, 500),
        metadata: r.document.metadata,
        createdAt: r.document.createdAt,
      })),
      count: results.length,
    };
  }

  /**
   * Delete documents
   * DELETE /documents
   */
  @Delete()
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteDocuments(@Body('ids') ids: string[]) {
    this.logger.log(`Deleting ${ids.length} documents`);
    await this.documentProcessingService.deleteDocuments(ids);
  }

  /**
   * Get supported file types
   * GET /documents/supported-types
   */
  @Get('info/supported-types')
  getSupportedTypes() {
    const types = this.documentProcessingService.getSupportedTypes();
    return {
      success: true,
      supportedTypes: types,
      count: types.length,
    };
  }

  /**
   * Get loader information
   * GET /documents/info/loaders
   */
  @Get('info/loaders')
  getLoaders() {
    const loaders = this.loaderRegistry.getAllLoaders();
    const loaderInfo = Array.from(loaders.entries()).map(([name, loader]) => ({
      name,
      supportedTypes: loader.getSupportedTypes(),
    }));

    return {
      success: true,
      loaders: loaderInfo,
      count: loaderInfo.length,
    };
  }
}
