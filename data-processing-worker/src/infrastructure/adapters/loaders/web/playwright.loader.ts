import { Injectable, Logger } from '@nestjs/common';
import { PlaywrightWebBaseLoader } from '@langchain/community/document_loaders/web/playwright';
import { WebLoaderPort } from '../../../../domain/ports/loader.port';
import { Document, DocumentMetadata } from '../../../../domain/entities/document.entity';
import * as crypto from 'crypto';

@Injectable()
export class PlaywrightWebLoaderAdapter extends WebLoaderPort {
  private readonly logger = new Logger(PlaywrightWebLoaderAdapter.name);

  async load(source: string | Blob, options?: Record<string, unknown>): Promise<Document[]> {
    if (typeof source === 'string') {
      return this.loadUrl(source, options);
    }
    throw new Error('Playwright loader only supports URL strings.');
  }

  async loadUrl(url: string, options?: Record<string, unknown>): Promise<Document[]> {
    this.logger.log(`Loading webpage with Playwright: ${url}`);
    const metadata = (options?.metadata as Record<string, unknown>) || {};

    try {
      const loader = new PlaywrightWebBaseLoader(url, {
        launchOptions: { headless: true },
        gotoOptions: { waitUntil: 'networkidle' },
      });
      const langchainDocs = await loader.load();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const documents = langchainDocs.map((doc: any, index: number) => {
        return new Document(
          this.generateDocumentId(url, index),
          doc.pageContent,
          { source: url, sourceType: 'url', ...metadata, ...doc.metadata } as DocumentMetadata,
        );
      });
      this.logger.log(`Loaded ${documents.length} documents from ${url}`);
      return documents;
    } catch (error) {
      this.logger.error(`Error loading URL with Playwright: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw new Error(`Failed to load URL: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  supports(source: string | Blob): boolean {
    return typeof source === 'string' && (source.startsWith('http://') || source.startsWith('https://'));
  }

  getSupportedTypes(): string[] {
    return ['http', 'https'];
  }

  private generateDocumentId(url: string, index: number): string {
    return `playwright-${crypto.createHash('md5').update(`${url}-${index}-${Date.now()}`).digest('hex')}`;
  }
}
