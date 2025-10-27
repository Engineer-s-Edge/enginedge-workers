import { Injectable } from '@nestjs/common';
import { WebLoaderPort } from '@domain/ports/loader.port';
import { Document } from '@domain/entities/document.entity';
import axios from 'axios';
import * as crypto from 'crypto';

/**
 * Notion API Loader Adapter
 * Loads pages and databases from Notion using the official API
 * Requires Notion integration token
 */
@Injectable()
export class NotionApiLoaderAdapter extends WebLoaderPort {
  readonly name = 'notion-api';
  readonly supportedProtocols = ['https'];

  /**
   * Load content from Notion
   */
  async loadUrl(
    url: string,
    options?: {
      apiKey?: string;
      notionVersion?: string;
    },
  ): Promise<Document[]> {
    try {
      const apiKey = options?.apiKey || process.env.NOTION_API_KEY;
      if (!apiKey) {
        throw new Error('Notion API key required. Set NOTION_API_KEY env var or pass apiKey option.');
      }

      const pageId = this._extractPageId(url);
      if (!pageId) {
        throw new Error('Invalid Notion URL: could not extract page ID');
      }

      const notionVersion = options?.notionVersion || '2022-06-28';

      const headers = {
        'Authorization': `Bearer ${apiKey}`,
        'Notion-Version': notionVersion,
        'Content-Type': 'application/json',
      };

      // Get page details
      const pageResponse = await axios.get(
        `https://api.notion.com/v1/pages/${pageId}`,
        { headers },
      );

      // Get page content (blocks)
      const blocksResponse = await axios.get(
        `https://api.notion.com/v1/blocks/${pageId}/children`,
        { headers },
      );

      // Extract text content from blocks
      const content = this._extractTextFromBlocks(blocksResponse.data.results);

      // Extract title from properties
      const properties = pageResponse.data.properties;
      const title = this._extractTitle(properties);

      const documentId = `notion-api-${crypto.createHash('md5').update(`${pageId}-${Date.now()}`).digest('hex')}`;
      const document = new Document(
        documentId,
        `${title}\n\n${content}`,
        {
          source: url,
          sourceType: 'url',
          loader: this.name,
          pageId,
          title,
          createdTime: pageResponse.data.created_time,
          lastEditedTime: pageResponse.data.last_edited_time,
          archived: pageResponse.data.archived,
          timestamp: new Date().toISOString(),
        },
      );

      return [document];
    } catch (error: any) {
      throw new Error(
        `Failed to load Notion content: ${error.message}`,
      );
    }
  }

  /**
   * Extract page ID from Notion URL
   */
  private _extractPageId(url: string): string | null {
    try {
      const urlObj = new URL(url);
      const pathname = urlObj.pathname;
      
      // Extract ID from URL (last part after the last dash)
      const parts = pathname.split('-');
      const lastPart = parts[parts.length - 1];
      
      // Remove query params if present
      const pageId = lastPart.split('?')[0];
      
      // Notion page IDs are 32 characters (UUID without dashes)
      if (pageId.length === 32) {
        return pageId;
      }

      return null;
    } catch {
      return null;
    }
  }

  /**
   * Extract title from page properties
   */
  private _extractTitle(properties: any): string {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    for (const [_key, value] of Object.entries(properties)) {
      const prop = value as any;
      if (prop.type === 'title' && prop.title && prop.title.length > 0) {
        return prop.title.map((t: any) => t.plain_text).join('');
      }
    }
    return 'Untitled';
  }

  /**
   * Extract text content from Notion blocks
   */
  private _extractTextFromBlocks(blocks: any[]): string {
    const textParts: string[] = [];

    for (const block of blocks) {
      const type = block.type;
      const data = block[type];

      if (!data) continue;

      // Handle different block types
      if (data.rich_text && Array.isArray(data.rich_text)) {
        const text = data.rich_text.map((t: any) => t.plain_text).join('');
        if (text) {
          textParts.push(text);
        }
      }

      // Handle code blocks
      if (type === 'code' && data.rich_text) {
        const code = data.rich_text.map((t: any) => t.plain_text).join('');
        textParts.push(`\`\`\`${data.language || ''}\n${code}\n\`\`\``);
      }
    }

    return textParts.join('\n\n');
  }

  /**
   * Check if this loader supports the given URL
   */
  canLoad(url: string): boolean {
    try {
      const urlObj = new URL(url);
      return urlObj.hostname.includes('notion.so') || urlObj.hostname.includes('notion.site');
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
