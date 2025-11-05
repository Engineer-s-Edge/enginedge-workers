/**
 * BM25 Text Search Service
 *
 * Provides BM25-based text search using wink-bm25-text-search library.
 * Supports both document and conversation search.
 */

import { Injectable, Logger } from '@nestjs/common';
import BM25 = require('wink-bm25-text-search');
import nlpUtils from 'wink-nlp-utils';

export interface BM25SearchResult {
  id: string;
  score: number;
}

export interface BM25SearchOptions {
  minDocs?: number; // Minimum docs needed for stable BM25 (default: 3)
  limit?: number;
}

@Injectable()
export class BM25SearchService {
  private readonly logger = new Logger(BM25SearchService.name);
  private readonly MIN_DOCS_FOR_BM25 = 3;

  /**
   * Create a BM25 engine with proper configuration
   */
  createEngine(): ReturnType<typeof BM25> {
    const engine = BM25();
    engine.defineConfig({ fldWeights: { text: 1 } });

    // Tokenize and stem: normalize, lowercase, strip punctuation, tokenize, stem
    const tokenizeAndStem = (input: string): string[] => {
      const normalized = String(input)
        .toLowerCase()
        .replace(/[^a-z0-9\s]/gi, ' ');
      const tokens = nlpUtils.string.tokenize0(normalized);
      return nlpUtils.tokens.stem(tokens);
    };

    engine.definePrepTasks([tokenizeAndStem]);
    return engine;
  }

  /**
   * Search documents using BM25
   */
  async searchDocuments(
    documents: Array<{ id: string; text: string }>,
    query: string,
    options: BM25SearchOptions = {},
  ): Promise<BM25SearchResult[]> {
    const { minDocs = this.MIN_DOCS_FOR_BM25, limit } = options;

    if (documents.length === 0) {
      this.logger.warn('BM25 search requested on empty corpus');
      return [];
    }

    // Build a fresh BM25 engine per search
    const engine = this.createEngine();

    // Index all documents
    this.logger.debug(`Indexing ${documents.length} documents in BM25 engine`);
    for (const doc of documents) {
      engine.addDoc({ text: doc.text }, doc.id);
    }

    let hits: Array<{ id: string; value: number }> = [];

    if (documents.length >= minDocs) {
      // Use proper BM25 search
      this.logger.debug('Consolidating BM25 engine and performing search');
      engine.consolidate();
      hits = engine.search(query, limit);
    } else {
      // Fallback lightweight scoring for small corpora: overlap count
      const tokenizeAndStem = (input: string): string[] => {
        const normalized = String(input)
          .toLowerCase()
          .replace(/[^a-z0-9\s]/gi, ' ');
        const tokens = nlpUtils.string.tokenize0(normalized);
        return nlpUtils.tokens.stem(tokens);
      };

      const qTokens = tokenizeAndStem(query).filter(Boolean);
      if (qTokens.length === 0) {
        this.logger.debug('BM25 fallback: empty/stopword-only query');
        return [];
      }

      const overlapScore = (text: string): number => {
        const tks = new Set(tokenizeAndStem(text));
        let count = 0;
        for (const qt of qTokens) {
          if (tks.has(qt)) count++;
        }
        return count;
      };

      hits = documents
        .map((d) => ({
          id: d.id,
          value: overlapScore(d.text),
        }))
        .filter((h) => h.value > 0)
        .sort((a, b) => b.value - a.value);

      if (limit) {
        hits = hits.slice(0, limit);
      }
    }

    // Rescore with fallback overlap for better results
    const tokenizeAndStem = (input: string): string[] => {
      const normalized = String(input)
        .toLowerCase()
        .replace(/[^a-z0-9\s]/gi, ' ');
      const tokens = nlpUtils.string.tokenize0(normalized);
      return nlpUtils.tokens.stem(tokens);
    };

    const qTokensForFallback = tokenizeAndStem(query).filter(Boolean);
    const fallbackOverlap = (text: string): number => {
      if (qTokensForFallback.length === 0) return 0;
      const tks = new Set(tokenizeAndStem(text));
      let count = 0;
      for (const qt of qTokensForFallback) {
        if (tks.has(qt)) count++;
      }
      return count;
    };

    const rescored = hits.map((h) => {
      const doc = documents.find((d) => d.id === h.id);
      const bm25Score = typeof h.value === 'number' ? h.value : 0;
      const fb = doc ? fallbackOverlap(doc.text) : 0;
      const score = Math.max(bm25Score, fb);
      return {
        id: h.id,
        score,
      };
    });

    // Sort by final score descending
    let sorted = rescored.sort((a, b) => b.score - a.score);

    // If all scores are 0 and we have tokens, try pure-overlap fallback
    if (sorted.every((r) => r.score === 0) && qTokensForFallback.length > 0) {
      const fbAll = documents
        .map((d) => ({
          id: d.id,
          score: fallbackOverlap(d.text),
        }))
        .filter((r) => r.score > 0)
        .sort((a, b) => b.score - a.score);

      if (fbAll.length > 0) {
        sorted = fbAll;
      }
    }

    if (limit) {
      sorted = sorted.slice(0, limit);
    }

    this.logger.debug(
      `BM25 search completed, returning ${sorted.length} results`,
    );
    return sorted;
  }

  /**
   * Search conversation messages/snippets using BM25
   */
  async searchConversations(
    items: Array<{ id: string; text: string }>,
    query: string,
    options: BM25SearchOptions = {},
  ): Promise<BM25SearchResult[]> {
    // Use the same search logic as documents
    return this.searchDocuments(items, query, options);
  }
}
