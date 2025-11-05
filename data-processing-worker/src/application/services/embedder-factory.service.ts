import { Inject, Injectable, Logger } from '@nestjs/common';
import { EmbedderPort } from '@domain/ports/processing.port';

/**
 * Embedder Factory Service
 *
 * Factory for creating appropriate embedder instances based on provider,
 * model selection, or explicitly requested embedder type.
 */
@Injectable()
export class EmbedderFactoryService {
  private readonly logger = new Logger(EmbedderFactoryService.name);
  private readonly defaultEmbedder: EmbedderPort;

  constructor(
    @Inject('Embedder.openai') private readonly openAIEmbedder: EmbedderPort,
    @Inject('Embedder.google') private readonly googleEmbedder: EmbedderPort,
    @Inject('Embedder.cohere') private readonly cohereEmbedder: EmbedderPort,
    @Inject('Embedder.local') private readonly localEmbedder: EmbedderPort,
    @Inject('Embedder.huggingface')
    private readonly huggingFaceEmbedder: EmbedderPort,
  ) {
    this.logger.log('EmbedderFactory initialized with 5 embedders');
    // Default to OpenAI, fallback to local if unavailable
    this.defaultEmbedder = this.openAIEmbedder;
  }

  /**
   * Get embedder by provider name
   */
  getEmbedderByProvider(provider: string): EmbedderPort {
    const normalizedProvider = provider.toLowerCase().trim();

    switch (normalizedProvider) {
      case 'openai':
      case 'openai-3-small':
      case 'openai-3-large':
        return this.openAIEmbedder;
      case 'google':
      case 'google-genai':
      case 'google-generative-ai':
        return this.googleEmbedder;
      case 'cohere':
        return this.cohereEmbedder;
      case 'local':
      case 'ollama':
      case 'llama':
        return this.localEmbedder;
      case 'huggingface':
      case 'hf':
        return this.huggingFaceEmbedder;
      default:
        this.logger.warn(
          `Unknown embedder provider: ${provider}, using default (OpenAI)`,
        );
        return this.defaultEmbedder;
    }
  }

  /**
   * Get embedder by model name
   */
  getEmbedderByModel(modelName: string): EmbedderPort {
    const normalized = modelName.toLowerCase();

    // OpenAI models
    if (
      normalized.includes('text-embedding-3-small') ||
      normalized.includes('text-embedding-3-large') ||
      normalized.includes('text-embedding-ada-002')
    ) {
      return this.openAIEmbedder;
    }

    // Google models
    if (
      normalized.includes('text-embedding-004') ||
      normalized.includes('google')
    ) {
      return this.googleEmbedder;
    }

    // Cohere models
    if (
      normalized.includes('embed-english-v3.0') ||
      normalized.includes('embed-english-light-v3.0') ||
      normalized.includes('cohere')
    ) {
      return this.cohereEmbedder;
    }

    // Local models
    if (
      normalized.includes('ollama') ||
      normalized.includes('llama') ||
      normalized.includes('nomic') ||
      normalized.includes('local')
    ) {
      return this.localEmbedder;
    }

    // HuggingFace models
    if (
      normalized.includes('huggingface') ||
      normalized.includes('sentence-transformers')
    ) {
      return this.huggingFaceEmbedder;
    }

    return this.defaultEmbedder;
  }

  /**
   * Get embedder by dimension requirements
   * Different embedders support different output dimensions
   */
  getEmbedderByDimension(dimensions: number): EmbedderPort {
    switch (dimensions) {
      case 1536: // OpenAI text-embedding-3-small
        return this.openAIEmbedder;
      case 3072: // OpenAI text-embedding-3-large
        return this.openAIEmbedder;
      case 768: // Google text-embedding-004
        return this.googleEmbedder;
      case 1024: // Cohere embed-english-v3.0
        return this.cohereEmbedder;
      default:
        this.logger.warn(
          `No embedder found for ${dimensions} dimensions, using default`,
        );
        return this.defaultEmbedder;
    }
  }

  /**
   * Get fastest embedder (latency optimized)
   */
  getFastestEmbedder(): EmbedderPort {
    // Local embedder is typically fastest (no network overhead)
    return this.localEmbedder;
  }

  /**
   * Get most accurate embedder
   */
  getMostAccurateEmbedder(): EmbedderPort {
    // OpenAI text-embedding-3-large typically has best quality
    return this.openAIEmbedder;
  }

  /**
   * Get cost-optimized embedder
   */
  getCostOptimizedEmbedder(): EmbedderPort {
    // OpenAI text-embedding-3-small has best cost/quality ratio
    return this.openAIEmbedder;
  }

  /**
   * Get default embedder
   */
  getDefaultEmbedder(): EmbedderPort {
    return this.defaultEmbedder;
  }

  /**
   * Get all available embedders with their characteristics
   */
  getAvailableEmbedders(): Array<{
    name: string;
    provider: string;
    models: string[];
    dimensions: number;
    costPerMillion?: number;
    description: string;
  }> {
    return [
      {
        name: 'OpenAI',
        provider: 'openai',
        models: [
          'text-embedding-3-small',
          'text-embedding-3-large',
          'text-embedding-ada-002',
        ],
        dimensions: 1536,
        costPerMillion: 0.02,
        description: 'State-of-the-art embeddings from OpenAI',
      },
      {
        name: 'Google Generative AI',
        provider: 'google',
        models: ['text-embedding-004'],
        dimensions: 768,
        costPerMillion: 0,
        description: 'Free embeddings from Google',
      },
      {
        name: 'Cohere',
        provider: 'cohere',
        models: ['embed-english-v3.0', 'embed-english-light-v3.0'],
        dimensions: 1024,
        costPerMillion: 0.1,
        description: 'Semantic embeddings from Cohere',
      },
      {
        name: 'Local/Ollama',
        provider: 'local',
        models: ['nomic-embed-text-1.5', 'all-minilm', 'mistral-7b'],
        dimensions: 768,
        costPerMillion: 0,
        description: 'Local embeddings with no API cost',
      },
      {
        name: 'HuggingFace',
        provider: 'huggingface',
        models: [
          'sentence-transformers/all-minilm-l6-v2',
          'sentence-transformers/all-mpnet-base-v2',
        ],
        dimensions: 384,
        costPerMillion: 0,
        description: 'Open-source models from HuggingFace',
      },
    ];
  }

  /**
   * Get embedder recommendations based on use case
   */
  getRecommendation(useCase: string): {
    embedder: EmbedderPort;
    reason: string;
  } {
    const normalized = useCase.toLowerCase();

    if (
      normalized.includes('production') ||
      normalized.includes('high-quality') ||
      normalized.includes('accurate')
    ) {
      return {
        embedder: this.openAIEmbedder,
        reason: 'OpenAI provides highest quality embeddings for production use',
      };
    }

    if (
      normalized.includes('cost') ||
      normalized.includes('budget') ||
      normalized.includes('cheap')
    ) {
      return {
        embedder: this.googleEmbedder,
        reason: 'Google Generative AI offers free, high-quality embeddings',
      };
    }

    if (normalized.includes('fast') || normalized.includes('latency')) {
      return {
        embedder: this.localEmbedder,
        reason:
          'Local embeddings have minimal latency with no network overhead',
      };
    }

    if (normalized.includes('offline') || normalized.includes('private')) {
      return {
        embedder: this.localEmbedder,
        reason:
          'Local embeddings work completely offline without data transmission',
      };
    }

    return {
      embedder: this.defaultEmbedder,
      reason: 'Default embedder provides good balance of quality and cost',
    };
  }
}
