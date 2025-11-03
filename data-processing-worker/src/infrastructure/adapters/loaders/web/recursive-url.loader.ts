import { Injectable } from '@nestjs/common';
import { WebLoaderPort } from '@domain/ports/loader.port';
import { Document } from '@domain/entities/document.entity';
import { CheerioWebLoaderAdapter } from './cheerio.loader';

/**
 * Recursive URL Loader Adapter
 * Crawls a website recursively, following links up to a specified depth
 * Uses Cheerio for parsing and link extraction
 */
@Injectable()
export class RecursiveUrlLoaderAdapter extends WebLoaderPort {
  readonly name = 'recursive-url';
  readonly supportedProtocols = ['http', 'https'];

  private visitedUrls = new Set<string>();

  constructor(private readonly cheerioLoader: CheerioWebLoaderAdapter) {
    super();
  }

  /**
   * Load content from a URL recursively
   */
  async loadUrl(
    url: string,
    options?: {
      maxDepth?: number;
      maxPages?: number;
      sameOriginOnly?: boolean;
      excludePatterns?: RegExp[];
      includePatterns?: RegExp[];
      selector?: string;
    },
  ): Promise<Document[]> {
    const maxDepth = options?.maxDepth || 2;
    const maxPages = options?.maxPages || 50;
    const sameOriginOnly = options?.sameOriginOnly !== false;
    const excludePatterns = options?.excludePatterns || [];
    const includePatterns = options?.includePatterns || [];

    this.visitedUrls.clear();
    const documents: Document[] = [];

    await this._crawl(
      url,
      0,
      maxDepth,
      maxPages,
      sameOriginOnly,
      excludePatterns,
      includePatterns,
      options?.selector,
      documents,
    );

    return documents;
  }

  /**
   * Recursive crawling logic
   */
  private async _crawl(
    url: string,
    currentDepth: number,
    maxDepth: number,
    maxPages: number,
    sameOriginOnly: boolean,
    excludePatterns: RegExp[],
    includePatterns: RegExp[],
    selector: string | undefined,
    documents: Document[],
  ): Promise<void> {
    // Check limits
    if (currentDepth > maxDepth || documents.length >= maxPages) {
      return;
    }

    // Normalize URL
    const normalizedUrl = this._normalizeUrl(url);
    if (this.visitedUrls.has(normalizedUrl)) {
      return;
    }

    // Check patterns
    if (!this._shouldVisit(normalizedUrl, excludePatterns, includePatterns)) {
      return;
    }

    this.visitedUrls.add(normalizedUrl);

    try {
      // Load the page
      const pageDocs = await this.cheerioLoader.loadUrl(url, { selector });

      if (pageDocs.length > 0) {
        const doc = pageDocs[0];
        const enrichedDoc = new Document(doc.id, doc.content, {
          ...doc.metadata,
          depth: currentDepth,
          crawler: this.name,
        });
        documents.push(enrichedDoc);
      }

      // Extract links and crawl recursively
      if (currentDepth < maxDepth && documents.length < maxPages) {
        const links = await this._extractLinks(url, sameOriginOnly);

        for (const link of links) {
          if (documents.length >= maxPages) break;

          await this._crawl(
            link,
            currentDepth + 1,
            maxDepth,
            maxPages,
            sameOriginOnly,
            excludePatterns,
            includePatterns,
            selector,
            documents,
          );
        }
      }
    } catch (error: any) {
      console.warn(`Failed to crawl ${url}: ${error.message}`);
    }
  }

  /**
   * Extract links from a page
   */
  private async _extractLinks(
    url: string,
    sameOriginOnly: boolean,
  ): Promise<string[]> {
    try {
      const docs = await this.cheerioLoader.loadUrl(url);
      if (docs.length === 0) return [];

      const $ = require('cheerio').load(docs[0].content);
      const links: string[] = [];
      const baseUrl = new URL(url);

      $('a[href]').each((_: any, element: any) => {
        const href = $(element).attr('href');
        if (!href) return;

        try {
          const absoluteUrl = new URL(href, url).href;
          const linkUrl = new URL(absoluteUrl);

          if (sameOriginOnly && linkUrl.origin !== baseUrl.origin) {
            return;
          }

          // Remove hash
          linkUrl.hash = '';
          links.push(linkUrl.href);
        } catch {
          // Invalid URL, skip
        }
      });

      return [...new Set(links)];
    } catch (error: any) {
      return [];
    }
  }

  /**
   * Normalize URL for deduplication
   */
  private _normalizeUrl(url: string): string {
    try {
      const urlObj = new URL(url);
      urlObj.hash = '';
      // Remove trailing slash
      const path = urlObj.pathname.endsWith('/')
        ? urlObj.pathname.slice(0, -1)
        : urlObj.pathname;
      return `${urlObj.origin}${path}${urlObj.search}`;
    } catch {
      return url;
    }
  }

  /**
   * Check if URL should be visited based on patterns
   */
  private _shouldVisit(
    url: string,
    excludePatterns: RegExp[],
    includePatterns: RegExp[],
  ): boolean {
    // Check exclude patterns
    for (const pattern of excludePatterns) {
      if (pattern.test(url)) return false;
    }

    // Check include patterns (if any)
    if (includePatterns.length > 0) {
      return includePatterns.some((pattern) => pattern.test(url));
    }

    return true;
  }

  /**
   * Check if this loader supports the given URL
   */
  canLoad(url: string): boolean {
    try {
      const urlObj = new URL(url);
      return this.supportedProtocols.includes(urlObj.protocol.replace(':', ''));
    } catch {
      return false;
    }
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
