import { Injectable } from '@nestjs/common';
import { WebLoaderPort } from '@domain/ports/loader.port';
import { Document } from '@domain/entities/document.entity';
import axios from 'axios';
import * as crypto from 'crypto';
import { CheerioWebLoaderAdapter } from './cheerio.loader';

/**
 * Sitemap Loader Adapter
 * Loads and parses XML sitemaps to extract URLs
 * Supports sitemap index files and regular sitemaps
 */
@Injectable()
export class SitemapLoaderAdapter extends WebLoaderPort {
  readonly name = 'sitemap';
  readonly supportedProtocols = ['http', 'https'];

  constructor(private readonly cheerioLoader: CheerioWebLoaderAdapter) {
    super();
  }

  /**
   * Load URLs from a sitemap
   */
  async loadUrl(
    url: string,
    options?: {
      loadPages?: boolean;
      maxPages?: number;
      filterUrls?: (url: string) => boolean;
    },
  ): Promise<Document[]> {
    try {
      const urls = await this._parseSitemap(url);
      
      // Filter URLs if filter function provided
      const filteredUrls = options?.filterUrls 
        ? urls.filter(options.filterUrls)
        : urls;

      // Limit number of URLs
      const maxPages = options?.maxPages || 100;
      const limitedUrls = filteredUrls.slice(0, maxPages);

      // If loadPages is true, fetch content from each URL
      if (options?.loadPages) {
        const documents: Document[] = [];
        
        for (const pageUrl of limitedUrls) {
          try {
            const pageDocs = await this.cheerioLoader.loadUrl(pageUrl);
            if (pageDocs.length > 0) {
              const doc = pageDocs[0];
              const enrichedDoc = new Document(
                doc.id,
                doc.content,
                {
                  ...doc.metadata,
                  sitemapSource: url,
                  loader: this.name,
                },
              );
              documents.push(enrichedDoc);
            }
          } catch (error: any) {
            console.warn(`Failed to load page ${pageUrl}: ${error.message}`);
          }
        }
        
        return documents;
      } else {
        // Just return the list of URLs as a single document
        const documentId = `sitemap-${crypto.createHash('md5').update(`${url}-${Date.now()}`).digest('hex')}`;
        return [
          new Document(
            documentId,
            limitedUrls.join('\n'),
            {
              source: url,
              sourceType: 'url',
              loader: this.name,
              urlCount: limitedUrls.length,
              totalUrls: urls.length,
              urls: limitedUrls,
              timestamp: new Date().toISOString(),
            },
          ),
        ];
      }
    } catch (error: any) {
      throw new Error(
        `Failed to load sitemap: ${error.message}`,
      );
    }
  }

  /**
   * Parse sitemap XML and extract URLs
   */
  private async _parseSitemap(url: string): Promise<string[]> {
    const response = await axios.get(url);
    const xml = response.data;
    const $ = require('cheerio').load(xml, { xmlMode: true });

    const urls: string[] = [];

    // Check if it's a sitemap index
    const sitemapElements = $('sitemap loc');
    if (sitemapElements.length > 0) {
      // It's a sitemap index, recursively load each sitemap
      for (let i = 0; i < sitemapElements.length; i++) {
        const sitemapUrl = $(sitemapElements[i]).text().trim();
        if (sitemapUrl) {
          try {
            const childUrls = await this._parseSitemap(sitemapUrl);
            urls.push(...childUrls);
          } catch (error: any) {
            console.warn(`Failed to parse child sitemap ${sitemapUrl}: ${error.message}`);
          }
        }
      }
    } else {
      // Regular sitemap, extract URLs
      const urlElements = $('url loc');
      urlElements.each((_: any, element: any) => {
        const loc = $(element).text().trim();
        if (loc) {
          urls.push(loc);
        }
      });
    }

    return [...new Set(urls)]; // Remove duplicates
  }

  /**
   * Check if this loader supports the given URL
   */
  canLoad(url: string): boolean {
    try {
      const urlObj = new URL(url);
      const path = urlObj.pathname.toLowerCase();
      return (
        this.supportedProtocols.includes(urlObj.protocol.replace(':', '')) &&
        (path.includes('sitemap') && path.endsWith('.xml'))
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
