import { Injectable, Logger } from '@nestjs/common';
import { EmbedderPort } from '@domain/ports/processing.port';
import { EmbedderFactoryService } from './embedder-factory.service';
import {
  EmbeddingSimilarityService,
  SearchResult,
} from './embedding-similarity.service';

/**
 * Embedder Service (Application Layer)
 *
 * Orchestrates embedder operations including:
 * - Dynamic embedder selection
 * - Batch embedding with caching
 * - Multi-embedder strategies
 * - Embedding reuse and deduplication
 * - BERT-score similarity and hybrid scoring
 * - Search and reranking with advanced similarity metrics
 */
@Injectable()
export class EmbedderService {
  private readonly logger = new Logger(EmbedderService.name);
  private embeddingCache: Map<string, number[]> = new Map();
  private currentEmbedder: EmbedderPort;

  constructor(
    private readonly embedderFactory: EmbedderFactoryService,
    private readonly similarityService: EmbeddingSimilarityService,
  ) {
    this.currentEmbedder = this.embedderFactory.getDefaultEmbedder();
    this.logger.log('EmbedderService initialized');
  }

  /**
   * Set active embedder by provider name
   */
  setEmbedder(provider: string): void {
    this.currentEmbedder = this.embedderFactory.getEmbedderByProvider(provider);
    this.logger.log(`Active embedder switched to: ${provider}`);
    // Clear cache when switching embedders
    this.embeddingCache.clear();
  }

  /**
   * Embed single text
   */
  async embedText(text: string): Promise<number[]> {
    if (!this.currentEmbedder) {
      throw new Error('No embedder configured');
    }

    // Check cache
    const cacheKey = this.getCacheKey(text);
    if (this.embeddingCache.has(cacheKey)) {
      this.logger.debug('Cache hit for embedding');
      return this.embeddingCache.get(cacheKey)!;
    }

    const embedding = await this.currentEmbedder.embedText(text);
    this.embeddingCache.set(cacheKey, embedding);

    return embedding;
  }

  /**
   * Embed batch of texts with deduplication
   */
  async embedBatch(texts: string[]): Promise<number[][]> {
    if (!this.currentEmbedder) {
      throw new Error('No embedder configured');
    }

    this.logger.log(`Embedding batch of ${texts.length} texts`);

    // Deduplicate texts and track indices
    const uniqueTexts = new Map<string, number>();
    const textsToEmbed: string[] = [];
    const cachedEmbeddings: (number[] | null)[] = new Array(texts.length).fill(
      null,
    );

    for (let i = 0; i < texts.length; i++) {
      const cacheKey = this.getCacheKey(texts[i]);

      // Check cache
      if (this.embeddingCache.has(cacheKey)) {
        cachedEmbeddings[i] = this.embeddingCache.get(cacheKey)!;
      } else if (!uniqueTexts.has(texts[i])) {
        // Track unique texts
        uniqueTexts.set(texts[i], textsToEmbed.length);
        textsToEmbed.push(texts[i]);
      }
    }

    // Embed unique texts only
    let uniqueEmbeddings: number[][] = [];
    if (textsToEmbed.length > 0) {
      uniqueEmbeddings = await this.currentEmbedder.embedBatch(textsToEmbed);
    }

    // Reconstruct full embeddings array with caching
    const result: number[][] = [];
    for (let i = 0; i < texts.length; i++) {
      if (cachedEmbeddings[i] !== null) {
        result.push(cachedEmbeddings[i]!);
      } else {
        const uniqueIndex = uniqueTexts.get(texts[i])!;
        const embedding = uniqueEmbeddings[uniqueIndex];
        const cacheKey = this.getCacheKey(texts[i]);
        this.embeddingCache.set(cacheKey, embedding);
        result.push(embedding);
      }
    }

    this.logger.log(
      `Generated ${result.length} embeddings (${textsToEmbed.length} unique)`,
    );
    return result;
  }

  /**
   * Get embeddings with fallback strategy
   * Tries primary embedder, falls back to alternatives if needed
   */
  async embedWithFallback(
    text: string,
    primaryProvider: string,
    fallbackProviders: string[] = [],
  ): Promise<number[]> {
    const providers = [primaryProvider, ...fallbackProviders];

    for (const provider of providers) {
      try {
        const embedder = this.embedderFactory.getEmbedderByProvider(provider);
        return await embedder.embedText(text);
      } catch {
        this.logger.warn(
          `Failed to embed with ${provider}, trying next provider`,
        );
      }
    }

    throw new Error(`Failed to embed text with any available provider`);
  }

  /**
   * Batch embed with multi-embedder strategy
   * Embeds same texts with multiple embedders for ensemble
   */
  async embedWithEnsemble(
    texts: string[],
    providers: string[] = [],
  ): Promise<Map<string, number[][]>> {
    const activeProviders =
      providers.length > 0 ? providers : ['openai', 'google'];

    const results = new Map<string, number[][]>();

    for (const provider of activeProviders) {
      try {
        const embedder = this.embedderFactory.getEmbedderByProvider(provider);
        const embeddings = await embedder.embedBatch(texts);
        results.set(provider, embeddings);
        this.logger.log(`Ensemble embedding with ${provider} completed`);
      } catch {
        this.logger.warn(`Failed to embed ensemble with ${provider}`);
      }
    }

    if (results.size === 0) {
      throw new Error('Failed to embed with any provider in ensemble strategy');
    }

    return results;
  }

  /**
   * Get embedding statistics and diagnostics
   */
  getStats(): {
    cacheSize: number;
    currentEmbedder: string;
    availableEmbedders: number;
  } {
    return {
      cacheSize: this.embeddingCache.size,
      currentEmbedder: this.currentEmbedder?.constructor.name || 'None',
      availableEmbedders: this.embedderFactory.getAvailableEmbedders().length,
    };
  }

  /**
   * Clear embedding cache
   */
  clearCache(): void {
    const previousSize = this.embeddingCache.size;
    this.embeddingCache.clear();
    this.logger.log(`Cleared embedding cache (${previousSize} entries)`);
  }

  /**
   * Get cache size in bytes (approximate)
   */
  getCacheSizeInBytes(): number {
    let size = 0;
    for (const [key, value] of this.embeddingCache) {
      size += key.length * 2; // UTF-16
      size += value.length * 8; // float64
    }
    return size;
  }

  /**
   * Generate cache key with hash
   */
  private getCacheKey(text: string): string {
    // Simple hash for cache key (in production, use proper hash function)
    return `${text.substring(0, 50)}_${text.length}`;
  }

  /**
   * Get cache hit ratio
   */
  getCacheMetrics(): { hits: number; misses: number; ratio: number } {
    // This would require tracking in production
    return {
      hits: 0,
      misses: 0,
      ratio: 0,
    };
  }

  // ============================
  // Similarity Operations
  // ============================

  /**
   * Normalize an embedding vector to unit length
   */
  normalizeEmbedding(embedding: number[]): number[] {
    return this.similarityService.normalize(embedding);
  }

  /**
   * Adjust embedding dimension (pad or truncate)
   */
  adjustDimension(embedding: number[], targetDim: number): number[] {
    return this.similarityService.adjustDimension(embedding, targetDim);
  }

  /**
   * Compute cosine similarity between two embeddings
   */
  cosineSimilarity(a: number[], b: number[]): number {
    return this.similarityService.cosineSimilarity(a, b);
  }

  /**
   * Compute BERT-score similarity between query and text embeddings
   */
  bertScoreSimilarity(
    queryEmbed: number[],
    textEmbed: number[],
    queryText?: string,
    text?: string,
  ): number {
    return this.similarityService.bertScoreSimilarity(
      queryEmbed,
      textEmbed,
      queryText,
      text,
    );
  }

  /**
   * Compute hybrid score combining cosine similarity and BERT-score
   */
  hybridSimilarity(
    queryEmbed: number[],
    textEmbed: number[],
    queryText?: string,
    text?: string,
    alpha: number = 0.5,
  ): number {
    return this.similarityService.hybridSimilarity(
      queryEmbed,
      textEmbed,
      queryText,
      text,
      alpha,
    );
  }

  /**
   * Search for items by cosine similarity
   */
  searchBySimilarity<T>(
    query: number[],
    items: T[],
    k: number = 10,
    embeddingAccessor: (item: T) => number[],
  ): SearchResult<T>[] {
    return this.similarityService.searchBySimilarity(
      query,
      items,
      k,
      embeddingAccessor,
    );
  }

  /**
   * Search for items using BERT-score similarity
   */
  searchByBertScore<T>(
    query: number[],
    items: T[],
    k: number = 10,
    embeddingAccessor: (item: T) => number[],
    textAccessor?: (item: T) => string,
    queryText?: string,
  ): SearchResult<T>[] {
    return this.similarityService.searchByBertScore(
      query,
      items,
      k,
      embeddingAccessor,
      textAccessor,
      queryText,
    );
  }

  /**
   * Search with hybrid scoring (cosine + BERT-score)
   */
  searchByHybridScore<T>(
    query: number[],
    items: T[],
    k: number = 10,
    embeddingAccessor: (item: T) => number[],
    textAccessor?: (item: T) => string,
    queryText?: string,
    alpha: number = 0.5,
  ): SearchResult<T>[] {
    return this.similarityService.searchByHybridScore(
      query,
      items,
      k,
      embeddingAccessor,
      textAccessor,
      queryText,
      alpha,
    );
  }

  /**
   * Rerank initial search results using BERT-score
   */
  rerankWithBertScore<T>(
    query: number[],
    initialResults: SearchResult<T>[],
    embeddingAccessor: (item: T) => number[],
    textAccessor?: (item: T) => string,
    queryText?: string,
  ): SearchResult<T>[] {
    return this.similarityService.rerankWithBertScore(
      query,
      initialResults,
      embeddingAccessor,
      textAccessor,
      queryText,
    );
  }
}
