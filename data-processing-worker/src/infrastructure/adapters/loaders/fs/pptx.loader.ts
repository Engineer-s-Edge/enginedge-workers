import { Injectable, Logger } from '@nestjs/common';
import { PPTXLoader } from '@langchain/community/document_loaders/fs/pptx';
import { FilesystemLoaderPort } from '../../../../domain/ports/loader.port';
import {
  Document,
  DocumentMetadata,
} from '../../../../domain/entities/document.entity';
import * as crypto from 'crypto';

@Injectable()
export class PptxLoaderAdapter extends FilesystemLoaderPort {
  private readonly logger = new Logger(PptxLoaderAdapter.name);

  async load(
    source: string | Blob,
    options?: Record<string, unknown>,
  ): Promise<Document[]> {
    if (source instanceof Blob) {
      const fileName = (options?.fileName as string) || 'document.pptx';
      return this.loadBlob(source, fileName, options);
    }
    throw new Error('PPTX loader only supports Blob input.');
  }

  async loadBlob(
    blob: Blob,
    fileName: string,
    options?: Record<string, unknown>,
  ): Promise<Document[]> {
    this.logger.log(`Loading PPTX blob: ${fileName}`);
    const metadata = (options?.metadata as Record<string, unknown>) || {};

    try {
      const loader = new PPTXLoader(blob);
      const langchainDocs = await loader.load();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const documents = langchainDocs.map((doc: any, index: number) => {
        return new Document(
          this.generateDocumentId(fileName, index),
          doc.pageContent,
          {
            source: fileName,
            sourceType: 'file',
            mimeType:
              'application/vnd.openxmlformats-officedocument.presentationml.presentation',
            fileName,
            fileExtension: '.pptx',
            ...metadata,
            ...doc.metadata,
          } as DocumentMetadata,
        );
      });
      this.logger.log(`Loaded ${documents.length} slides from PPTX`);
      return documents;
    } catch (error) {
      this.logger.error(
        `Error loading PPTX: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      throw new Error(
        `Failed to load PPTX: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  supports(source: string | Blob): boolean {
    if (source instanceof Blob)
      return (
        source.type ===
        'application/vnd.openxmlformats-officedocument.presentationml.presentation'
      );
    return source.toLowerCase().endsWith('.pptx');
  }

  getSupportedTypes(): string[] {
    return ['.pptx'];
  }

  private generateDocumentId(fileName: string, index: number): string {
    return `pptx-${crypto.createHash('md5').update(`${fileName}-${index}-${Date.now()}`).digest('hex')}`;
  }
}
