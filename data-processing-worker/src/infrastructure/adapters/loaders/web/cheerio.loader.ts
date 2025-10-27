import { Injectable, Logger } from '@nestjs/common';
import { CheerioWebBaseLoader } from '@langchain/community/document_loaders/web/cheerio';
import { WebLoaderPort } from '../../../../domain/ports/loader.port';
import { Document, DocumentMetadata } from '../../../../domain/entities/document.entity';
import * as crypto from 'crypto';

@Injectable()
export class CheerioWebLoaderAdapter extends WebLoaderPort {
  private readonly logger = new Logger(CheerioWebLoaderAdapter.name);

  async load(source: string | Blob, options?: Record<string, unknown>): Promise<Document[]> {
    if (typeof source === 'string') {
      return this.loadUrl(source, options);
    }
    throw new Error('Cheerio loader only supports URL strings.');
  }

  async loadUrl(url: string, options?: Record<string, unknown>): Promise<Document[]> {
    this.logger.log(`Loading webpage with Cheerio: ${url}`);
    const metadata = (options?.metadata as Record<string, unknown>) || {};
    const selector = (options?.selector as string) || 'body';

    try {
      const loader = new CheerioWebBaseLoader(url, { selector: selector as any });
      const langchainDocs = await loader.load();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const documents = langchainDocs.map((doc: any, index: number) => {
        const docMetadata: DocumentMetadata = {
          source: url,
          sourceType: 'url',
          ...metadata,
          ...doc.metadata,
        };
        return new Document(
          this.generateDocumentId(url, index),
          doc.pageContent,
          docMetadata,
        );
      });
      this.logger.log(`Loaded ${documents.length} documents from ${url}`);
      return documents;
    } catch (error) {
      this.logger.error(`Error loading URL with Cheerio: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw new Error(`Failed to load URL: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  supports(source: string | Blob): boolean {
    if (typeof source === 'string') {
      return source.startsWith('http://') || source.startsWith('https://');
    }
    return false;
  }

  getSupportedTypes(): string[] {
    return ['http', 'https'];
  }

  private generateDocumentId(url: string, index: number): string {
    return `cheerio-${crypto.createHash('md5').update(`${url}-${index}-${Date.now()}`).digest('hex')}`;
  }
}
