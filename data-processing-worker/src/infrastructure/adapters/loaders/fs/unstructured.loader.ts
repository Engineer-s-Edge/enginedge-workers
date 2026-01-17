import { Injectable, Logger } from '@nestjs/common';
import { UnstructuredLoader } from '@langchain/community/document_loaders/fs/unstructured';
import { FilesystemLoaderPort } from '../../../../domain/ports/loader.port';
import {
  Document,
  DocumentMetadata,
} from '../../../../domain/entities/document.entity';
import * as crypto from 'crypto';

@Injectable()
export class UnstructuredLoaderAdapter extends FilesystemLoaderPort {
  private readonly logger = new Logger(UnstructuredLoaderAdapter.name);

  async load(
    source: string | Blob,
    options?: Record<string, unknown>,
  ): Promise<Document[]> {
    if (source instanceof Blob) {
      const fileName = (options?.fileName as string) || 'document';
      return this.loadBlob(source, fileName, options);
    }
    throw new Error('Unstructured loader only supports Blob input.');
  }

  async loadBlob(
    blob: Blob,
    fileName: string,
    options?: Record<string, unknown>,
  ): Promise<Document[]> {
    this.logger.log(`Loading unstructured document blob: ${fileName}`);
    const metadata = (options?.metadata as Record<string, unknown>) || {};

    try {
      // UnstructuredLoader expects a file path, not a Blob
      // For now, we'll use the fileName as path (caller should provide actual path)
      const tempPath = (options?.filePath as string) || fileName;

      const loader = new UnstructuredLoader(tempPath);
      const langchainDocs = await loader.load();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const documents = langchainDocs.map((doc: any, index: number) => {
        return new Document(
          this.generateDocumentId(fileName, index),
          doc.pageContent,
          {
            source: fileName,
            sourceType: 'file',
            fileName,
            ...metadata,
            ...doc.metadata,
          } as DocumentMetadata,
        );
      });
      this.logger.log(
        `Loaded ${documents.length} documents using Unstructured`,
      );
      return documents;
    } catch (error) {
      this.logger.error(
        `Error loading with Unstructured: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      throw new Error(
        `Failed to load with Unstructured: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  supports(source: string | Blob): boolean {
    return true; // Unstructured can handle many file types
  }

  getSupportedTypes(): string[] {
    return ['*']; // Universal fallback
  }

  private generateDocumentId(fileName: string, index: number): string {
    return `unstructured-${crypto.createHash('md5').update(`${fileName}-${index}-${Date.now()}`).digest('hex')}`;
  }
}
