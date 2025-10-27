import { Injectable, Logger } from '@nestjs/common';
import { EmbedderPort } from '@domain/ports/processing.port';

/**
 * Local Embeddings Adapter (Disabled - Infrastructure Layer)
 * 
 * This implementation is disabled but kept for future use.
 * Would generate embeddings using local models (e.g., BERT, Sentence Transformers).
 */
@Injectable()
export class LocalEmbedderAdapter implements EmbedderPort {
  private readonly logger = new Logger(LocalEmbedderAdapter.name);

  constructor() {
    this.logger.warn('Local embedder is disabled. This is a placeholder implementation.');
  }

  async embedText(_text: string): Promise<number[]> {
    throw new Error('Local embedder is disabled. Please use OpenAI or Google embedders.');
  }

  async embedBatch(_texts: string[]): Promise<number[][]> {
    throw new Error('Local embedder is disabled. Please use OpenAI or Google embedders.');
  }

  getDimensions(): number {
    return 0;
  }

  getModelName(): string {
    return 'local-disabled';
  }
}
