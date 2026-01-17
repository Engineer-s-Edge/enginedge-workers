import { Injectable, Logger, Optional, Inject } from '@nestjs/common';
import { OpenAIEmbeddings } from '@langchain/openai';
import { EmbedderPort } from '@domain/ports/processing.port';

/**
 * OpenAI Embeddings Adapter (Infrastructure Layer)
 *
 * Generates embeddings using OpenAI's API.
 * Default model: text-embedding-3-small (1536 dimensions)
 */
@Injectable()
export class OpenAIEmbedderAdapter implements EmbedderPort {
  private readonly logger = new Logger(OpenAIEmbedderAdapter.name);
  private readonly embeddings: OpenAIEmbeddings;
  private readonly modelName: string;
  private readonly dimensions: number;

  constructor(
    @Optional() @Inject('OPENAI_API_KEY') apiKey?: string,
    @Optional() @Inject('OPENAI_MODEL_NAME') modelName?: string,
    @Optional() @Inject('OPENAI_DIMENSIONS') dimensions?: number,
  ) {
    this.modelName = modelName || 'text-embedding-3-small';
    this.dimensions = dimensions || 1536;

    const key = apiKey || process.env.OPENAI_API_KEY;
    if (!key) {
      this.logger.warn(
        'OpenAI API key not provided. Embedder will not be functional.',
      );
      // Create a dummy embeddings object to prevent crashes
      this.embeddings = null as any;
      return;
    }

    this.embeddings = new OpenAIEmbeddings({
      openAIApiKey: key,
      modelName: this.modelName,
      dimensions: this.dimensions,
    });

    this.logger.log(
      `Initialized OpenAI embedder: ${this.modelName} (${this.dimensions}d)`,
    );
  }

  async embedText(text: string): Promise<number[]> {
    if (!this.embeddings) {
      throw new Error(
        'OpenAI embedder not configured. Please set OPENAI_API_KEY environment variable.',
      );
    }

    this.logger.debug(`Generating embedding for text (${text.length} chars)`);

    try {
      const embedding = await this.embeddings.embedQuery(text);
      this.logger.debug(
        `Generated embedding with ${embedding.length} dimensions`,
      );
      return embedding;
    } catch (error) {
      this.logger.error(
        `Error generating embedding: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      throw new Error(
        `Failed to generate embedding: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    if (!this.embeddings) {
      throw new Error(
        'OpenAI embedder not configured. Please set OPENAI_API_KEY environment variable.',
      );
    }

    this.logger.log(`Generating embeddings for ${texts.length} texts`);

    try {
      const embeddings = await this.embeddings.embedDocuments(texts);
      this.logger.log(`Generated ${embeddings.length} embeddings`);
      return embeddings;
    } catch (error) {
      this.logger.error(
        `Error generating batch embeddings: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      throw new Error(
        `Failed to generate batch embeddings: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  getDimensions(): number {
    return this.dimensions;
  }

  getModelName(): string {
    return this.modelName;
  }
}
