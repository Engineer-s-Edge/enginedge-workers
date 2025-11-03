import { Injectable } from '@nestjs/common';
import { WebLoaderPort } from '@domain/ports/loader.port';
import { Document } from '@domain/entities/document.entity';
import axios from 'axios';
import * as crypto from 'crypto';

/**
 * Tavily Search Loader Adapter
 * Loads search results from Tavily AI Search API
 * Optimized for LLM-based applications with clean, relevant results
 */
@Injectable()
export class TavilySearchLoaderAdapter extends WebLoaderPort {
  readonly name = 'tavily';
  readonly supportedProtocols = ['https'];

  /**
   * Load search results from Tavily
   */
  async loadUrl(
    url: string,
    options?: {
      apiKey?: string;
      query?: string;
      searchDepth?: 'basic' | 'advanced';
      maxResults?: number;
      includeAnswer?: boolean;
      includeRawContent?: boolean;
      includeDomains?: string[];
      excludeDomains?: string[];
    },
  ): Promise<Document[]> {
    try {
      const apiKey = options?.apiKey || process.env.TAVILY_API_KEY;
      if (!apiKey) {
        throw new Error(
          'Tavily API key required. Set TAVILY_API_KEY env var or pass apiKey option.',
        );
      }

      const query = options?.query || this._extractQueryFromUrl(url);
      if (!query) {
        throw new Error('Search query required');
      }

      const payload: any = {
        api_key: apiKey,
        query,
        search_depth: options?.searchDepth || 'basic',
        max_results: options?.maxResults || 5,
        include_answer: options?.includeAnswer !== false,
        include_raw_content: options?.includeRawContent || false,
      };

      if (options?.includeDomains) {
        payload.include_domains = options.includeDomains;
      }

      if (options?.excludeDomains) {
        payload.exclude_domains = options.excludeDomains;
      }

      const response = await axios.post(
        'https://api.tavily.com/search',
        payload,
      );

      const documents: Document[] = [];

      // Add the AI-generated answer if included
      if (response.data.answer) {
        const answerId = `tavily-answer-${crypto.createHash('md5').update(`${query}-${Date.now()}`).digest('hex')}`;
        documents.push(
          new Document(answerId, response.data.answer, {
            source: 'tavily-answer',
            sourceType: 'url',
            loader: this.name,
            type: 'answer',
            query,
            timestamp: new Date().toISOString(),
          }),
        );
      }

      // Add search results
      const results = response.data.results || [];
      for (const result of results) {
        const content = options?.includeRawContent
          ? result.raw_content || result.content
          : result.content;

        const documentId = `tavily-${crypto.createHash('md5').update(`${result.url}-${Date.now()}`).digest('hex')}`;
        documents.push(
          new Document(documentId, content, {
            source: result.url,
            sourceType: 'url',
            loader: this.name,
            title: result.title,
            score: result.score,
            query,
            timestamp: new Date().toISOString(),
          }),
        );
      }

      return documents;
    } catch (error: any) {
      throw new Error(
        `Failed to load search results from Tavily: ${error.message}`,
      );
    }
  }

  /**
   * Extract query from URL or return empty string
   */
  private _extractQueryFromUrl(url: string): string {
    try {
      const urlObj = new URL(url);
      return (
        urlObj.searchParams.get('q') || urlObj.searchParams.get('query') || ''
      );
    } catch {
      return '';
    }
  }

  /**
   * Check if this loader supports the given URL
   */
  canLoad(url: string): boolean {
    // Tavily is primarily used programmatically, not for loading specific URLs
    // But we can support it being called with search URLs
    return true;
  }

  supports(source: string | Blob): boolean {
    if (typeof source !== 'string') return false;
    try {
      const url = new URL(source);
      return (
        this.supportedProtocols?.includes(url.protocol.replace(':', '')) ??
        ['http', 'https'].includes(url.protocol.replace(':', ''))
      );
    } catch {
      return false;
    }
  }

  getSupportedTypes(): string[] {
    return this.supportedProtocols ?? ['http', 'https'];
  }
}
