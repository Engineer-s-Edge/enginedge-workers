/**
 * Embedding Similarity Service
 *
 * Provides BERT-score similarity, hybrid scoring, normalization, and search utilities
 * for embedding-based similarity operations.
 */

import { Injectable, Logger } from '@nestjs/common';

export interface Embedding {
  embedding: number[];
  size?: number;
}

export interface SearchResult<T> {
  item: T;
  score: number;
  distance?: number;
  bertScore?: number;
  combinedScore?: number;
}

@Injectable()
export class EmbeddingSimilarityService {
  private readonly logger = new Logger(EmbeddingSimilarityService.name);

  /**
   * Normalize a vector to unit length (L2 norm = 1)
   */
  normalize(vec: number[]): number[] {
    const norm = Math.sqrt(vec.reduce((sum, v) => sum + v * v, 0));
    return norm > 0 ? vec.map((v) => v / norm) : vec;
  }

  /**
   * Pad with zeros or truncate a vector to the given target dimension
   */
  adjustDimension(vec: number[], targetDim: number): number[] {
    const currentLen = vec.length;
    if (currentLen > targetDim) {
      return vec.slice(0, targetDim);
    } else if (currentLen < targetDim) {
      return [...vec, ...new Array(targetDim - currentLen).fill(0)];
    }
    return vec;
  }

  /**
   * Compute cosine similarity between two vectors
   */
  cosineSimilarity(a: number[], b: number[]): number {
    const minLen = Math.min(a.length, b.length);
    let dot = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < minLen; i++) {
      dot += a[i] * b[i];
      normA += a[i] ** 2;
      normB += b[i] ** 2;
    }

    const denominator = Math.sqrt(normA) * Math.sqrt(normB);
    return denominator > 0 ? dot / denominator : 0;
  }

  /**
   * Compute Euclidean distance between two vectors
   */
  euclideanDistance(a: number[], b: number[]): number {
    const minLen = Math.min(a.length, b.length);
    let sumSq = 0;

    for (let i = 0; i < minLen; i++) {
      const d = a[i] - b[i];
      sumSq += d * d;
    }

    // Handle length differences
    if (a.length > minLen) {
      sumSq += a.slice(minLen).reduce((s, v) => s + v * v, 0);
    }
    if (b.length > minLen) {
      sumSq += b.slice(minLen).reduce((s, v) => s + v * v, 0);
    }

    return Math.sqrt(sumSq);
  }

  /**
   * Compute BERT-score-inspired similarity between query and text
   * Uses weighted cosine similarity with length penalty and magnitude confidence
   */
  bertScoreSimilarity(
    queryEmbed: number[],
    textEmbed: number[],
    queryText?: string,
    text?: string,
  ): number {
    // Base cosine similarity
    const cosineSim = this.cosineSimilarity(queryEmbed, textEmbed);

    // Length penalty (similar to BERT-score's precision/recall balance)
    let lengthPenalty = 1.0;
    if (queryText && text) {
      const queryLen = queryText.split(/\s+/).length;
      const textLen = text.split(/\s+/).length;

      // Penalize large length mismatches
      const lengthRatio =
        Math.min(queryLen, textLen) / Math.max(queryLen, textLen);
      lengthPenalty = 0.8 + 0.2 * lengthRatio; // Range: 0.8 to 1.0
    }

    // Magnitude-based confidence
    const queryMag = Math.sqrt(
      queryEmbed.reduce((s, v) => s + v * v, 0),
    );
    const textMag = Math.sqrt(textEmbed.reduce((s, v) => s + v * v, 0));
    const avgMag = (queryMag + textMag) / 2;

    // Normalize magnitude to 0-1 range
    const magConfidence = Math.min(avgMag, 1.0);

    // Combine scores
    const bertScore = cosineSim * lengthPenalty * magConfidence;

    return Math.max(0, Math.min(1, bertScore)); // Clamp to [0, 1]
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
    const cosineSim = this.cosineSimilarity(queryEmbed, textEmbed);
    const bertScore = this.bertScoreSimilarity(
      queryEmbed,
      textEmbed,
      queryText,
      text,
    );

    return alpha * cosineSim + (1 - alpha) * bertScore;
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
    return this.search(
      query,
      items,
      k,
      (q, e) => this.cosineSimilarity(q, e),
      embeddingAccessor,
      true,
    );
  }

  /**
   * Search for items by Euclidean distance
   */
  searchByDistance<T>(
    query: number[],
    items: T[],
    k: number = 10,
    embeddingAccessor: (item: T) => number[],
  ): SearchResult<T>[] {
    return this.search(
      query,
      items,
      k,
      (q, e) => this.euclideanDistance(q, e),
      embeddingAccessor,
      false,
    );
  }

  /**
   * Search for items using BERT-score-inspired similarity
   */
  searchByBertScore<T>(
    query: number[],
    items: T[],
    k: number = 10,
    embeddingAccessor: (item: T) => number[],
    textAccessor?: (item: T) => string,
    queryText?: string,
  ): SearchResult<T>[] {
    const validItems = items.filter((item) => {
      const emb = embeddingAccessor(item);
      return Array.isArray(emb) && emb.length > 0;
    });

    const results = validItems.map((item) => {
      const emb = embeddingAccessor(item);
      const itemText = textAccessor ? textAccessor(item) : undefined;
      const bertScore = this.bertScoreSimilarity(query, emb, queryText, itemText);

      return {
        item,
        score: bertScore,
        bertScore: bertScore,
        distance: 1 - bertScore,
      };
    });

    results.sort((a, b) => b.score - a.score);
    return results.slice(0, k);
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
    const validItems = items.filter((item) => {
      const emb = embeddingAccessor(item);
      return Array.isArray(emb) && emb.length > 0;
    });

    const results = validItems.map((item) => {
      const emb = embeddingAccessor(item);
      const itemText = textAccessor ? textAccessor(item) : undefined;

      const hybridScore = this.hybridSimilarity(
        query,
        emb,
        queryText,
        itemText,
        alpha,
      );
      const bertScore = this.bertScoreSimilarity(
        query,
        emb,
        queryText,
        itemText,
      );

      return {
        item,
        score: hybridScore,
        bertScore: bertScore,
        combinedScore: hybridScore,
        distance: 1 - hybridScore,
      };
    });

    results.sort((a, b) => b.score - a.score);
    return results.slice(0, k);
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
    return initialResults
      .map((result) => {
        const itemEmbed = embeddingAccessor(result.item);
        const itemText = textAccessor ? textAccessor(result.item) : undefined;

        const bertScore = this.bertScoreSimilarity(
          query,
          itemEmbed,
          queryText,
          itemText,
        );

        return {
          ...result,
          bertScore: bertScore,
          combinedScore: (result.score + bertScore) / 2, // Average original and BERT score
        };
      })
      .sort((a, b) => (b.bertScore || 0) - (a.bertScore || 0));
  }

  /**
   * Generic search function that can use any distance/similarity metric
   */
  private search<T>(
    query: number[],
    items: T[],
    k: number,
    metric: (q: number[], e: number[]) => number,
    embeddingAccessor: (item: T) => number[],
    higherIsBetter: boolean,
  ): SearchResult<T>[] {
    const validItems = items.filter((item) => {
      const emb = embeddingAccessor(item);
      return Array.isArray(emb) && emb.length > 0;
    });

    const results = validItems.map((item) => {
      const emb = embeddingAccessor(item);
      const score = metric(query, emb);
      return {
        item,
        score,
        distance: higherIsBetter ? 1 - score : score,
      };
    });

    results.sort((a, b) =>
      higherIsBetter ? b.score - a.score : a.score - b.score,
    );

    return results.slice(0, k);
  }
}
