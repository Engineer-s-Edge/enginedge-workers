import { Injectable, Logger, Optional, Inject } from '@nestjs/common';
import { GoogleGenerativeAIEmbeddings } from '@langchain/google-genai';
import { EmbedderPort } from '@domain/ports/processing.port';

/**
 * Google Generative AI Embeddings Adapter (Infrastructure Layer)
 * 
 * Generates embeddings using Google's Generative AI API.
 * Default model: text-embedding-004 (768 dimensions)
 */
@Injectable()
export class GoogleEmbedderAdapter implements EmbedderPort {
  private readonly logger = new Logger(GoogleEmbedderAdapter.name);
  private readonly embeddings: GoogleGenerativeAIEmbeddings;
  private readonly modelName: string;
  private readonly dimensions: number;

  constructor(
    @Optional() @Inject('GOOGLE_API_KEY') apiKey?: string,
    @Optional() @Inject('GOOGLE_MODEL_NAME') modelName?: string
  ) {
    this.modelName = modelName || 'text-embedding-004';
    this.dimensions = 768; // Google's embedding dimension
    
    const key = apiKey || process.env.GOOGLE_API_KEY;
    if (!key) {
      this.logger.warn('Google API key not provided. Embedder will not be functional.');
      this.embeddings = null as any;
      return;
    }
    
    this.embeddings = new GoogleGenerativeAIEmbeddings({
      apiKey: key,
      modelName: this.modelName,
    });

    this.logger.log(`Initialized Google embedder: ${this.modelName} (${this.dimensions}d)`);
  }

  async embedText(text: string): Promise<number[]> {
    if (!this.embeddings) {
      throw new Error('Google embedder not configured. Please set GOOGLE_API_KEY environment variable.');
    }
    
    this.logger.debug(`Generating Google embedding for text (${text.length} chars)`);
    
    try {
      const embedding = await this.embeddings.embedQuery(text);
      return embedding;
    } catch (error) {
      this.logger.error(`Error generating Google embedding: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw new Error(`Failed to generate Google embedding: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    if (!this.embeddings) {
      throw new Error('Google embedder not configured. Please set GOOGLE_API_KEY environment variable.');
    }
    
    this.logger.log(`Generating Google embeddings for ${texts.length} texts`);
    
    try {
      const embeddings = await this.embeddings.embedDocuments(texts);
      this.logger.log(`Generated ${embeddings.length} Google embeddings`);
      return embeddings;
    } catch (error) {
      this.logger.error(`Error generating Google batch embeddings: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw new Error(`Failed to generate Google batch embeddings: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  getDimensions(): number {
    return this.dimensions;
  }

  getModelName(): string {
    return this.modelName;
  }
}
