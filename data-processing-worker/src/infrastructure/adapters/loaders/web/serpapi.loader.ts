import { Injectable } from '@nestjs/common';
import { WebLoaderPort } from '@domain/ports/loader.port';
import { Document } from '@domain/entities/document.entity';
import axios from 'axios';
import * as crypto from 'crypto';

/**
 * SerpAPI Loader Adapter
 * Loads search results from Google, Bing, Yahoo, etc. via SerpAPI
 * Requires SerpAPI API key
 */
@Injectable()
export class SerpApiLoaderAdapter extends WebLoaderPort {
  readonly name = 'serpapi';
  readonly supportedProtocols = ['https'];

  /**
   * Load search results from SerpAPI
   */
  async loadUrl(
    url: string,
    options?: {
      apiKey?: string;
      engine?: 'google' | 'bing' | 'yahoo' | 'duckduckgo';
      query?: string;
      numResults?: number;
      location?: string;
      language?: string;
    },
  ): Promise<Document[]> {
    try {
      const apiKey = options?.apiKey || process.env.SERPAPI_API_KEY;
      if (!apiKey) {
        throw new Error('SerpAPI key required. Set SERPAPI_API_KEY env var or pass apiKey option.');
      }

      const engine = options?.engine || 'google';
      const query = options?.query || this._extractQueryFromUrl(url);
      const num = options?.numResults || 10;

      const params: any = {
        api_key: apiKey,
        engine,
        q: query,
        num,
      };

      if (options?.location) {
        params.location = options.location;
      }

      if (options?.language) {
        params.hl = options.language;
      }

      const response = await axios.get('https://serpapi.com/search', {
        params,
      });

      const results = response.data.organic_results || [];
      const documents: Document[] = [];

      for (const result of results) {
        const documentId = `serpapi-${crypto.createHash('md5').update(`${query}-${result.position}-${Date.now()}`).digest('hex')}`;
        const doc = new Document(
          documentId,
          `${result.title}\n\n${result.snippet}`,
          {
            source: result.link,
            sourceType: 'url',
            loader: this.name,
            title: result.title,
            snippet: result.snippet,
            position: result.position,
            searchEngine: engine,
            query,
            timestamp: new Date().toISOString(),
          },
        );
        documents.push(doc);
      }

      return documents;
    } catch (error: any) {
      throw new Error(
        `Failed to load search results from SerpAPI: ${error.message}`,
      );
    }
  }

  /**
   * Extract query from search URL
   */
  private _extractQueryFromUrl(url: string): string {
    try {
      const urlObj = new URL(url);
      return urlObj.searchParams.get('q') || urlObj.searchParams.get('query') || '';
    } catch {
      return '';
    }
  }

  /**
   * Check if this loader supports the given URL
   */
  canLoad(url: string): boolean {
    try {
      const urlObj = new URL(url);
      // Can load search engine URLs or be used programmatically
      return (
        urlObj.hostname.includes('google.com') ||
        urlObj.hostname.includes('bing.com') ||
        urlObj.hostname.includes('yahoo.com') ||
        urlObj.hostname.includes('duckduckgo.com')
      );
    } catch {
      return false;
    }
  }

  supports(source: string | Blob): boolean {
    if (typeof source !== 'string') return false;
    try {
      const url = new URL(source);
      return this.supportedProtocols?.includes(url.protocol.replace(':', '')) ?? 
             ['http', 'https'].includes(url.protocol.replace(':', ''));
    } catch {
      return false;
    }
  }

  getSupportedTypes(): string[] {
    return this.supportedProtocols ?? ['http', 'https'];
  }
}
