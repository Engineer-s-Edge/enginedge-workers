import { Injectable } from '@nestjs/common';
import { WebLoaderPort } from '@domain/ports/loader.port';
import { Document } from '@domain/entities/document.entity';
import axios from 'axios';
import * as crypto from 'crypto';

/**
 * HTML Web Loader Adapter
 * Simple loader for fetching and parsing raw HTML content
 * Extracts text content without JavaScript execution
 */
@Injectable()
export class HtmlLoaderAdapter extends WebLoaderPort {
  readonly name = 'html';
  readonly supportedProtocols = ['http', 'https'];

  /**
   * Load HTML content from a URL
   */
  async loadUrl(
    url: string,
    options?: {
      selector?: string;
      stripTags?: boolean;
      timeout?: number;
    },
  ): Promise<Document[]> {
    try {
      const response = await axios.get(url, {
        timeout: options?.timeout || 30000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; DataProcessingWorker/1.0)',
        },
      });

      let content = response.data;

      // Parse with cheerio if selector provided or stripTags is true
      if (options?.selector || options?.stripTags) {
        const cheerio = require('cheerio');
        const $ = cheerio.load(content);

        if (options.selector) {
          content = $(options.selector).html() || '';
        }

        if (options.stripTags) {
          content = $.text();
        }
      }

      const documentId = `html-${crypto.createHash('md5').update(`${url}-${Date.now()}`).digest('hex')}`;
      const document = new Document(
        documentId,
        content,
        {
          source: url,
          sourceType: 'url',
          loader: this.name,
          contentType: response.headers['content-type'],
          statusCode: response.status,
          timestamp: new Date().toISOString(),
        },
      );

      return [document];
    } catch (error: any) {
      throw new Error(
        `Failed to load HTML from URL: ${error.message}`,
      );
    }
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
