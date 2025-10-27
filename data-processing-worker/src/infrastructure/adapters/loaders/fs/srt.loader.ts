import { Injectable, Logger } from '@nestjs/common';
import { SRTLoader } from '@langchain/community/document_loaders/fs/srt';
import { FilesystemLoaderPort } from '../../../../domain/ports/loader.port';
import { Document, DocumentMetadata } from '../../../../domain/entities/document.entity';
import * as crypto from 'crypto';

@Injectable()
export class SrtLoaderAdapter extends FilesystemLoaderPort {
  private readonly logger = new Logger(SrtLoaderAdapter.name);

  async load(source: string | Blob, options?: Record<string, unknown>): Promise<Document[]> {
    if (source instanceof Blob) {
      const fileName = (options?.fileName as string) || 'document.srt';
      return this.loadBlob(source, fileName, options);
    }
    throw new Error('SRT loader only supports Blob input.');
  }

  async loadBlob(blob: Blob, fileName: string, options?: Record<string, unknown>): Promise<Document[]> {
    this.logger.log(`Loading SRT blob: ${fileName}`);
    const metadata = (options?.metadata as Record<string, unknown>) || {};

    try {
      const loader = new SRTLoader(blob);
      const langchainDocs = await loader.load();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const documents = langchainDocs.map((doc: any, index: number) => {
        return new Document(
          this.generateDocumentId(fileName, index),
          doc.pageContent,
          { source: fileName, sourceType: 'file', mimeType: 'application/x-subrip', fileName, fileExtension: '.srt', ...metadata, ...doc.metadata } as DocumentMetadata,
        );
      });
      this.logger.log(`Loaded ${documents.length} subtitle entries from SRT`);
      return documents;
    } catch (error) {
      this.logger.error(`Error loading SRT: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw new Error(`Failed to load SRT: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  supports(source: string | Blob): boolean {
    if (source instanceof Blob) return source.type === 'application/x-subrip';
    return source.toLowerCase().endsWith('.srt');
  }

  getSupportedTypes(): string[] {
    return ['.srt'];
  }

  private generateDocumentId(fileName: string, index: number): string {
    return `srt-${crypto.createHash('md5').update(`${fileName}-${index}-${Date.now()}`).digest('hex')}`;
  }
}
