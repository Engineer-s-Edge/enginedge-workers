import { Injectable, Logger } from '@nestjs/common';
import { CSVLoader } from '@langchain/community/document_loaders/fs/csv';
import { FilesystemLoaderPort } from '../../../../domain/ports/loader.port';
import { Document, DocumentMetadata } from '../../../../domain/entities/document.entity';
import * as crypto from 'crypto';

/**
 * CSV Document Loader (Infrastructure Layer)
 * 
 * Loads and parses CSV files using LangChain's CSVLoader.
 */
@Injectable()
export class CsvLoaderAdapter extends FilesystemLoaderPort {
  private readonly logger = new Logger(CsvLoaderAdapter.name);

  async load(source: string | Blob, options?: Record<string, unknown>): Promise<Document[]> {
    if (source instanceof Blob) {
      const fileName = (options?.fileName as string) || 'document.csv';
      return this.loadBlob(source, fileName, options);
    }
    throw new Error('CSV loader only supports Blob input.');
  }

  async loadBlob(
    blob: Blob,
    fileName: string,
    options?: Record<string, unknown>,
  ): Promise<Document[]> {
    this.logger.log(`Loading CSV blob: ${fileName} (${blob.size} bytes)`);

    const metadata = (options?.metadata as Record<string, unknown>) || {};
    const column = (options?.column as string) || undefined;

    try {
      const loader = new CSVLoader(blob, { column });
      const langchainDocs = await loader.load();

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const documents = langchainDocs.map((doc: any, index: number) => {
        const docId = this.generateDocumentId(fileName, index);
        const docMetadata: DocumentMetadata = {
          source: fileName,
          sourceType: 'file',
          mimeType: 'text/csv',
          fileName,
          fileExtension: '.csv',
          ...metadata,
          ...doc.metadata,
        };

        return new Document(docId, doc.pageContent, docMetadata);
      });

      this.logger.log(`Successfully loaded ${documents.length} rows from CSV`);
      return documents;
    } catch (error) {
      this.logger.error(`Error loading CSV: ${error instanceof Error ? error.message : 'Unknown error'}`, error instanceof Error ? error.stack : undefined);
      throw new Error(`Failed to load CSV: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  supports(source: string | Blob): boolean {
    if (source instanceof Blob) {
      return source.type === 'text/csv' || source.type === 'application/csv';
    }
    return source.toLowerCase().endsWith('.csv');
  }

  getSupportedTypes(): string[] {
    return ['.csv'];
  }

  private generateDocumentId(fileName: string, index: number): string {
    const hash = crypto.createHash('md5').update(`${fileName}-${index}-${Date.now()}`).digest('hex');
    return `csv-${hash}`;
  }
}
