/**
 * Embedder Adapter
 *
 * Calls data-processing-worker to generate embeddings.
 */

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IEmbedder } from '@application/ports/embedder.port';

@Injectable()
export class EmbedderAdapter implements IEmbedder {
  private readonly logger = new Logger(EmbedderAdapter.name);
  private readonly dataProcessingWorkerUrl: string;

  constructor(private readonly configService: ConfigService) {
    this.dataProcessingWorkerUrl =
      this.configService.get<string>('DATA_PROCESSING_WORKER_URL') ||
      'http://localhost:3003';
  }

  async embedText(text: string): Promise<number[]> {
    try {
      const response = await fetch(`${this.dataProcessingWorkerUrl}/embed`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text }),
      });

      if (!response.ok) {
        throw new Error(
          `Embedding service returned error: ${response.status} ${response.statusText}`,
        );
      }

      const result = await response.json();
      return result.embedding || result;
    } catch (error) {
      this.logger.error(
        `Error calling embedding service: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw error;
    }
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    try {
      const response = await fetch(
        `${this.dataProcessingWorkerUrl}/embed/batch`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ texts }),
        },
      );

      if (!response.ok) {
        throw new Error(
          `Embedding service returned error: ${response.status} ${response.statusText}`,
        );
      }

      const result = await response.json();
      return result.embeddings || result;
    } catch (error) {
      this.logger.error(
        `Error calling batch embedding service: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw error;
    }
  }

  cosineSimilarity(embedding1: number[], embedding2: number[]): number {
    if (embedding1.length !== embedding2.length) {
      throw new Error('Embeddings must have the same length');
    }

    let dotProduct = 0;
    let norm1 = 0;
    let norm2 = 0;

    for (let i = 0; i < embedding1.length; i++) {
      dotProduct += embedding1[i] * embedding2[i];
      norm1 += embedding1[i] * embedding1[i];
      norm2 += embedding2[i] * embedding2[i];
    }

    const denominator = Math.sqrt(norm1) * Math.sqrt(norm2);
    return denominator === 0 ? 0 : dotProduct / denominator;
  }
}
