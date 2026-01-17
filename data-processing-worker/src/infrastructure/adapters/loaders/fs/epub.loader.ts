import { Injectable, Logger } from '@nestjs/common';
import { EPubLoader } from '@langchain/community/document_loaders/fs/epub';
import { FilesystemLoaderPort } from '../../../../domain/ports/loader.port';
import {
  Document,
  DocumentMetadata,
} from '../../../../domain/entities/document.entity';
import * as crypto from 'crypto';

@Injectable()
export class EpubLoaderAdapter extends FilesystemLoaderPort {
  private readonly logger = new Logger(EpubLoaderAdapter.name);

  async load(
    source: string | Blob,
    options?: Record<string, unknown>,
  ): Promise<Document[]> {
    if (source instanceof Blob) {
      const fileName = (options?.fileName as string) || 'document.epub';
      return this.loadBlob(source, fileName, options);
    }
    throw new Error('EPUB loader only supports Blob input.');
  }

  async loadBlob(
    blob: Blob,
    fileName: string,
    options?: Record<string, unknown>,
  ): Promise<Document[]> {
    this.logger.log(`Loading EPUB blob: ${fileName}`);
    const metadata = (options?.metadata as Record<string, unknown>) || {};

    try {
      // Convert Blob to Buffer for EPubLoader
      const arrayBuffer = await blob.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      // Create a temporary file path (EPubLoader expects string path)
      // In production, you might want to use a temp file system
      const tempPath = `${fileName}`;

      const loader = new EPubLoader(tempPath);
      const langchainDocs = await loader.load();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const documents = langchainDocs.map((doc: any, index: number) => {
        return new Document(
          this.generateDocumentId(fileName, index),
          doc.pageContent,
          {
            source: fileName,
            sourceType: 'file',
            mimeType: 'application/epub+zip',
            fileName,
            fileExtension: '.epub',
            ...metadata,
            ...doc.metadata,
          } as DocumentMetadata,
        );
      });
      this.logger.log(`Loaded ${documents.length} documents from EPUB`);
      return documents;
    } catch (error) {
      this.logger.error(
        `Error loading EPUB: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      throw new Error(
        `Failed to load EPUB: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  supports(source: string | Blob): boolean {
    if (source instanceof Blob) return source.type === 'application/epub+zip';
    return source.toLowerCase().endsWith('.epub');
  }

  getSupportedTypes(): string[] {
    return ['.epub'];
  }

  private generateDocumentId(fileName: string, index: number): string {
    return `epub-${crypto.createHash('md5').update(`${fileName}-${index}-${Date.now()}`).digest('hex')}`;
  }
}
