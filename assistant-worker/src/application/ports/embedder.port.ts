/**
 * Embedder Port
 *
 * Interface for generating embeddings from text.
 * Implemented by adapters that call data-processing-worker or local embedders.
 */

export interface IEmbedder {
  /**
   * Generate embedding for a single text
   */
  embedText(text: string): Promise<number[]>;

  /**
   * Generate embeddings for multiple texts (batch)
   */
  embedBatch(texts: string[]): Promise<number[][]>;

  /**
   * Calculate cosine similarity between two embeddings
   */
  cosineSimilarity(embedding1: number[], embedding2: number[]): number;
}
