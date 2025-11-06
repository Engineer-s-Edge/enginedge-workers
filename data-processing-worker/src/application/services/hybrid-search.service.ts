/**
 * Hybrid Search Service
 *
 * Combines multiple search strategies:
 * - BM25 text search
 * - Semantic search (vector similarity)
 * - BERT-score reranking
 *
 * This service orchestrates calls to embedder and vector store services.
 */

import { Injectable, Logger, Inject, Optional } from '@nestjs/common';
import { BM25SearchService } from './bm25-search.service';
import { EmbedderService } from './embedder.service';
import {
  VectorStoreService,
  DocumentSearchResult,
} from './vector-store.service';

export interface HybridSearchOptions {
  alpha?: number; // Weight for semantic vs BM25 (0-1, default 0.5)
  useBertScore?: boolean;
  bertScoreAlpha?: number; // Weight for cosine vs BERT-score (0-1, default 0.5)
  conversationId?: string;
  global?: boolean;
}

export interface HybridSearchResult extends DocumentSearchResult {
  bm25Score?: number;
  semanticScore?: number;
  bertScore?: number;
}

@Injectable()
export class HybridSearchService {
  private readonly logger = new Logger(HybridSearchService.name);

  constructor(
    private readonly bm25Service: BM25SearchService,
    @Optional()
    @Inject('EmbedderService')
    private readonly embedderService?: EmbedderService,
    @Optional()
    @Inject('VectorStoreService')
    private readonly vectorStoreService?: VectorStoreService,
  ) {}

  /**
   * Hybrid search for documents
   */
  async searchDocuments(
    query: string,
    topK: number,
    userId: string,
    options: HybridSearchOptions = {},
  ): Promise<HybridSearchResult[]> {
    this.logger.log(
      `Hybrid search for documents, userId: ${userId}, query: "${query}", topK: ${topK}, alpha: ${options.alpha || 0.5}`,
    );

    const alpha = options.alpha ?? 0.5;

    // Get BM25 results
    this.logger.debug('Running BM25 text search');
    const bm25Results = this.vectorStoreService
      ? await this.vectorStoreService.textSearchDocs(query, topK * 2, userId, {
          conversationId: options.conversationId,
          global: options.global,
        })
      : [];

    // Get semantic results
    this.logger.debug('Running semantic search');
    const semanticResults = this.vectorStoreService
      ? await this.vectorStoreService.semanticSearchDocs(
          query,
          topK * 2,
          userId,
          {
            conversationId: options.conversationId,
            global: options.global,
            useBertScore: options.useBertScore,
            bertScoreAlpha: options.bertScoreAlpha,
          },
        )
      : [];

    // Combine results
    this.logger.debug(
      `Combining ${bm25Results.length} BM25 results with ${semanticResults.length} semantic results`,
    );

    const combined = new Map<string, HybridSearchResult>();

    // Add BM25 results
    for (const result of bm25Results) {
      combined.set(result.document.id, {
        ...result,
        bm25Score: result.score,
        semanticScore: 0,
      });
    }

    // Add/merge semantic results
    for (const result of semanticResults) {
      const existing = combined.get(result.document.id);
      if (existing) {
        existing.semanticScore = result.score;
        existing.bertScore = result.bertScore;
        existing.combinedScore = result.combinedScore;
        // Calculate hybrid score: alpha * semantic + (1-alpha) * BM25
        existing.score =
          alpha * result.score + (1 - alpha) * existing.bm25Score!;
      } else {
        combined.set(result.document.id, {
          ...result,
          bm25Score: 0,
          semanticScore: result.score,
        });
      }
    }

    // Sort by hybrid score and limit
    const results = Array.from(combined.values())
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);

    this.logger.log(
      `Hybrid search completed, returning ${results.length} results`,
    );
    return results;
  }

  /**
   * Hybrid search for conversations (messages/snippets)
   * This would integrate with the Conversations Service
   */
  async searchConversations(
    query: string,
    topK: number,
    userId: string,
    options: {
      useSnippets?: boolean;
      conversationIds?: string[];
      alpha?: number;
      useBertScore?: boolean;
      bertScoreAlpha?: number;
    } = {},
  ): Promise<
    Array<{
      id: string;
      conversationId: string;
      content: string;
      score: number;
      bm25Score?: number;
      semanticScore?: number;
      bertScore?: number;
    }>
  > {
    this.logger.log(
      `Hybrid search for conversations, userId: ${userId}, query: "${query}", topK: ${topK}, useSnippets: ${options.useSnippets || false}`,
    );

    // This would need to call the Conversations Service
    // For now, return empty - would need to integrate with assistant-worker
    // In production, this could make HTTP calls to assistant-worker's conversation search endpoints

    this.logger.warn(
      'Conversation hybrid search not yet fully implemented - requires integration with assistant-worker',
    );
    return [];
  }

  /**
   * Rerank existing results using BERT-score
   */
  async rerankWithBertScore(
    query: string,
    queryEmbedding: number[],
    results: Array<{ id: string; text: string; score: number }>,
  ): Promise<
    Array<{ id: string; text: string; score: number; bertScore: number }>
  > {
    if (!this.embedderService) {
      this.logger.warn(
        'Embedder service not available for BERT-score reranking',
      );
      return results.map((r) => ({ ...r, bertScore: r.score }));
    }

    this.logger.debug(`Reranking ${results.length} results with BERT-score`);

    type BM25ResultItem = { id: string; text: string; score: number };
    const reranked = this.embedderService.rerankWithBertScore<BM25ResultItem>(
      queryEmbedding,
      results.map((r) => ({
        item: r,
        score: r.score,
      })),
      (item: BM25ResultItem) => {
        // BM25 results don't have embeddings, return empty array
        // The reranker will compute embeddings from text if needed
        return [] as number[];
      },
      (item: BM25ResultItem) => item.text,
      query,
    );

    return reranked.map((r) => ({
      id: r.item.id,
      text: r.item.text,
      score: r.combinedScore || r.score,
      bertScore: r.bertScore || r.score,
    }));
  }
}
