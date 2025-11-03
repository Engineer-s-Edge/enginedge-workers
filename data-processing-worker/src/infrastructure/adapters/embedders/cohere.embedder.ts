import { Injectable, Logger } from '@nestjs/common';
import { EmbedderPort } from '@domain/ports/processing.port';

/**
 * Cohere Embeddings Adapter (Disabled - Infrastructure Layer)
 *
 * This implementation is disabled but kept for future use.
 * Would generate embeddings using Cohere's API.
 */
@Injectable()
export class CohereEmbedderAdapter implements EmbedderPort {
  private readonly logger = new Logger(CohereEmbedderAdapter.name);

  constructor() {
    this.logger.warn(
      'Cohere embedder is disabled. This is a placeholder implementation.',
    );
  }

  async embedText(_text: string): Promise<number[]> {
    throw new Error(
      'Cohere embedder is disabled. Please use OpenAI or Google embedders.',
    );
  }

  async embedBatch(_texts: string[]): Promise<number[][]> {
    throw new Error(
      'Cohere embedder is disabled. Please use OpenAI or Google embedders.',
    );
  }

  getDimensions(): number {
    return 0;
  }

  getModelName(): string {
    return 'cohere-embed-disabled';
  }
}
