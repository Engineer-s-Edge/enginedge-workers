import { Controller, Post, Get, Body, Logger } from '@nestjs/common';
import { EmbedderService } from '../../application/services/embedder.service';
import { EmbedderFactoryService } from '../../application/services/embedder-factory.service';

/**
 * Embedder Controller
 * 
 * REST API endpoints for embedder operations:
 * - Embed text
 * - Batch embed
 * - Embedder selection and info
 */
@Controller('embedders')
export class EmbedderController {
  private readonly logger = new Logger(EmbedderController.name);

  constructor(
    private readonly embedderService: EmbedderService,
    private readonly embedderFactory: EmbedderFactoryService,
  ) {}

  /**
   * POST /embedders/embed
   * Embed single text
   */
  @Post('embed')
  async embedText(
    @Body()
    body: {
      text: string;
      provider?: string;
    },
  ) {
    this.logger.log('Embed text requested');

    const { text, provider } = body;

    if (!text) {
      throw new Error('text is required');
    }

    if (provider) {
      this.embedderService.setEmbedder(provider);
    }

    const embedding = await this.embedderService.embedText(text);

    return {
      text: text.substring(0, 100),
      embedding,
      dimensions: embedding.length,
    };
  }

  /**
   * POST /embedders/batch
   * Batch embed texts
   */
  @Post('batch')
  async batchEmbed(
    @Body()
    body: {
      texts: string[];
      provider?: string;
    },
  ) {
    this.logger.log(`Batch embed ${body.texts.length} texts`);

    const { texts, provider } = body;

    if (!texts || !Array.isArray(texts)) {
      throw new Error('texts must be an array of strings');
    }

    if (provider) {
      this.embedderService.setEmbedder(provider);
    }

    const embeddings = await this.embedderService.embedBatch(texts);

    return {
      count: texts.length,
      embeddings,
      dimensions: embeddings[0]?.length || 0,
    };
  }

  /**
   * GET /embedders/available
   * Get available embedders
   */
  @Get('available')
  getAvailableEmbedders() {
    this.logger.log('Fetching available embedders');

    const embedders = this.embedderFactory.getAvailableEmbedders();

    return {
      count: embedders.length,
      embedders,
    };
  }

  /**
   * GET /embedders/models
   * Get available embedding models with details
   */
  @Get('models')
  getEmbeddingModels() {
    this.logger.log('Fetching embedding models');

    const models = [
      {
        provider: 'openai',
        model: 'text-embedding-3-small',
        dimensions: 1536,
        maxTokens: 8191,
        available: !!process.env.OPENAI_API_KEY,
      },
      {
        provider: 'openai',
        model: 'text-embedding-3-large',
        dimensions: 3072,
        maxTokens: 8191,
        available: !!process.env.OPENAI_API_KEY,
      },
      {
        provider: 'openai',
        model: 'text-embedding-ada-002',
        dimensions: 1536,
        maxTokens: 8191,
        available: !!process.env.OPENAI_API_KEY,
      },
      {
        provider: 'google',
        model: 'text-embedding-004',
        dimensions: 768,
        maxTokens: 2048,
        available: !!process.env.GOOGLE_API_KEY,
      },
      {
        provider: 'cohere',
        model: 'embed-english-v3.0',
        dimensions: 1024,
        maxTokens: 512,
        available: !!process.env.COHERE_API_KEY,
      },
      {
        provider: 'huggingface',
        model: 'sentence-transformers/all-MiniLM-L6-v2',
        dimensions: 384,
        maxTokens: 256,
        available: true, // Local model
      },
    ];

    return {
      models,
      count: models.length,
      availableCount: models.filter(m => m.available).length,
    };
  }

  /**
   * GET /embedders/stats
   * Get embedder service statistics
   */
  @Get('stats')
  getStats() {
    this.logger.log('Fetching embedder stats');

    const stats = this.embedderService.getStats();
    const cacheSize = this.embedderService.getCacheSizeInBytes();

    return {
      ...stats,
      cacheSizeBytes: cacheSize,
      cacheSizeMB: (cacheSize / 1024 / 1024).toFixed(2),
    };
  }
}
