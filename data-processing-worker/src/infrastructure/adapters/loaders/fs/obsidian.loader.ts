import { Injectable, Logger } from '@nestjs/common';
import { FilesystemLoaderPort } from '../../../../domain/ports/loader.port';
import { Document, DocumentMetadata } from '../../../../domain/entities/document.entity';
import * as crypto from 'crypto';

@Injectable()
export class ObsidianLoaderAdapter extends FilesystemLoaderPort {
  private readonly logger = new Logger(ObsidianLoaderAdapter.name);

  async load(source: string | Blob, options?: Record<string, unknown>): Promise<Document[]> {
    if (source instanceof Blob) {
      const fileName = (options?.fileName as string) || 'obsidian.md';
      return this.loadBlob(source, fileName, options);
    }
    throw new Error('Obsidian loader only supports Blob input.');
  }

  async loadBlob(blob: Blob, fileName: string, options?: Record<string, unknown>): Promise<Document[]> {
    this.logger.log(`Loading Obsidian Markdown blob: ${fileName}`);
    const metadata = (options?.metadata as Record<string, unknown>) || {};

    try {
      // Read blob as text
      const content = await blob.text();
      
      const document = new Document(
        this.generateDocumentId(fileName, 0),
        content,
        { source: fileName, sourceType: 'file', mimeType: 'text/markdown', fileName, fileExtension: '.md', ...metadata } as DocumentMetadata,
      );
      
      this.logger.log(`Loaded Obsidian document from ${fileName}`);
      return [document];
    } catch (error) {
      this.logger.error(`Error loading Obsidian: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw new Error(`Failed to load Obsidian: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  supports(source: string | Blob): boolean {
    return false; // Will be detected by file extension
  }

  getSupportedTypes(): string[] {
    return ['.md'];
  }

  private generateDocumentId(fileName: string, index: number): string {
    return `obsidian-${crypto.createHash('md5').update(`${fileName}-${index}-${Date.now()}`).digest('hex')}`;
  }
}
