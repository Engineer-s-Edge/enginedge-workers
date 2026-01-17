import { Injectable, Logger } from '@nestjs/common';
import { FilesystemLoaderPort } from '@domain/ports/loader.port';
import { Document, DocumentMetadata } from '@domain/entities/document.entity';
import * as crypto from 'crypto';

@Injectable()
export class NotionLoaderAdapter extends FilesystemLoaderPort {
  private readonly logger = new Logger(NotionLoaderAdapter.name);

  async loadBlob(
    blob: Blob,
    fileName: string,
    options?: Record<string, unknown>,
  ): Promise<Document[]> {
    this.logger.log(`Loading Notion Markdown blob: ${fileName}`);
    const metadata = (options?.metadata as Record<string, unknown>) ?? {};

    try {
      // Convert Blob to string path (NotionLoader expects file path)
      const arrayBuffer = await blob.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const textContent = buffer.toString('utf-8');

      // Create a temporary document since LangChain's NotionLoader expects filesystem path
      const document = new Document(
        this.generateDocumentId(fileName, 0),
        textContent,
        {
          source: fileName,
          sourceType: 'file' as const,
          mimeType: 'text/markdown',
          fileName,
          fileExtension: '.md',
          ...metadata,
        } as DocumentMetadata,
      );

      this.logger.log(`Loaded 1 document from Notion`);
      return [document];
    } catch (error) {
      this.logger.error(
        `Error loading Notion: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      throw new Error(
        `Failed to load Notion: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  supports(source: string | Blob): boolean {
    return source instanceof Blob; // Notion loader only supports Blob input
  }

  getSupportedTypes(): string[] {
    return ['.md'];
  }

  private generateDocumentId(fileName: string, index: number): string {
    return `notion-${crypto.createHash('md5').update(`${fileName}-${index}-${Date.now()}`).digest('hex')}`;
  }
}
