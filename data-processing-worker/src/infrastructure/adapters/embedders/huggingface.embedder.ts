import { Injectable, Logger } from '@nestjs/common';
import { EmbedderPort } from '@domain/ports/processing.port';

/**
 * Hugging Face Embeddings Adapter (Disabled - Infrastructure Layer)
 *
 * This implementation is disabled but kept for future use.
 * Would generate embeddings using Hugging Face models.
 */
@Injectable()
export class HuggingFaceEmbedderAdapter implements EmbedderPort {
  private readonly logger = new Logger(HuggingFaceEmbedderAdapter.name);

  constructor() {
    this.logger.warn(
      'Hugging Face embedder is disabled. This is a placeholder implementation.',
    );
  }

  async embedText(_text: string): Promise<number[]> {
    throw new Error(
      'Hugging Face embedder is disabled. Please use OpenAI or Google embedders.',
    );
  }

  async embedBatch(_texts: string[]): Promise<number[][]> {
    throw new Error(
      'Hugging Face embedder is disabled. Please use OpenAI or Google embedders.',
    );
  }

  getDimensions(): number {
    return 0;
  }

  getModelName(): string {
    return 'huggingface-disabled';
  }
}
