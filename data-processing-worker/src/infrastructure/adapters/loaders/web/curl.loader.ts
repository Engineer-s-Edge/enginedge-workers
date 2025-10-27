import { Injectable } from '@nestjs/common';
import { WebLoaderPort } from '@domain/ports/loader.port';
import { Document } from '@domain/entities/document.entity';
import axios, { AxiosRequestConfig } from 'axios';
import * as crypto from 'crypto';

/**
 * Curl Web Loader Adapter
 * Uses axios to fetch content from URLs with custom headers and options
 * Supports GET, POST, and other HTTP methods
 */
@Injectable()
export class CurlWebLoaderAdapter extends WebLoaderPort {
  readonly name = 'curl';
  readonly supportedProtocols = ['http', 'https'];

  /**
   * Load content from a URL using axios (curl-like functionality)
   */
  async loadUrl(
    url: string,
    options?: {
      method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
      headers?: Record<string, string>;
      body?: any;
      timeout?: number;
      followRedirects?: boolean;
      maxRedirects?: number;
    },
  ): Promise<Document[]> {
    try {
      const config: AxiosRequestConfig = {
        method: options?.method || 'GET',
        url,
        headers: options?.headers || {},
        timeout: options?.timeout || 30000,
        maxRedirects: options?.maxRedirects || 5,
        validateStatus: (status) => status < 500, // Accept 4xx as valid
      };

      if (options?.body) {
        config.data = options.body;
      }

      const response = await axios(config);

      // Determine content type
      const contentType = response.headers['content-type'] || 'text/plain';
      
      let content: string;
      if (typeof response.data === 'string') {
        content = response.data;
      } else if (typeof response.data === 'object') {
        content = JSON.stringify(response.data, null, 2);
      } else {
        content = String(response.data);
      }

      const documentId = `curl-${crypto.createHash('md5').update(`${url}-${Date.now()}`).digest('hex')}`;
      const document = new Document(
        documentId,
        content,
        {
          source: url,
          sourceType: 'url',
          loader: this.name,
          contentType,
          statusCode: response.status,
          statusText: response.statusText,
          headers: response.headers,
          method: config.method,
          timestamp: new Date().toISOString(),
        },
      );

      return [document];
    } catch (error: any) {
      throw new Error(
        `Failed to load URL with curl loader: ${error.message}`,
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
