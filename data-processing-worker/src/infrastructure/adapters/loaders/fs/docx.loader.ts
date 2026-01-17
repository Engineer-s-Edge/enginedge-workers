import { Injectable, Logger } from '@nestjs/common';
import { DocxLoader } from '@langchain/community/document_loaders/fs/docx';
import { FilesystemLoaderPort } from '../../../../domain/ports/loader.port';
import {
  Document,
  DocumentMetadata,
} from '../../../../domain/entities/document.entity';
import * as crypto from 'crypto';

/**
 * DOCX Document Loader (Infrastructure Layer)
 *
 * Loads and parses Microsoft Word (.docx) files using LangChain's DocxLoader.
 */
@Injectable()
export class DocxLoaderAdapter extends FilesystemLoaderPort {
  private readonly logger = new Logger(DocxLoaderAdapter.name);

  async load(
    source: string | Blob,
    options?: Record<string, unknown>,
  ): Promise<Document[]> {
    if (source instanceof Blob) {
      const fileName = (options?.fileName as string) || 'document.docx';
      return this.loadBlob(source, fileName, options);
    }
    throw new Error('DOCX loader only supports Blob input.');
  }

  async loadBlob(
    blob: Blob,
    fileName: string,
    options?: Record<string, unknown>,
  ): Promise<Document[]> {
    this.logger.log(`Loading DOCX blob: ${fileName} (${blob.size} bytes)`);

    const metadata = (options?.metadata as Record<string, unknown>) || {};

    try {
      const loader = new DocxLoader(blob);
      const langchainDocs = await loader.load();

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const documents = langchainDocs.map((doc: any, index: number) => {
        const docId = this.generateDocumentId(fileName, index);
        const docMetadata: DocumentMetadata = {
          source: fileName,
          sourceType: 'file',
          mimeType:
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          fileName,
          fileExtension: '.docx',
          ...metadata,
          ...doc.metadata,
        };

        return new Document(docId, doc.pageContent, docMetadata);
      });

      this.logger.log(
        `Successfully loaded ${documents.length} documents from DOCX`,
      );
      return documents;
    } catch (error) {
      this.logger.error(
        `Error loading DOCX: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw new Error(
        `Failed to load DOCX: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  supports(source: string | Blob): boolean {
    if (source instanceof Blob) {
      return (
        source.type ===
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      );
    }
    return source.toLowerCase().endsWith('.docx');
  }

  getSupportedTypes(): string[] {
    return ['.docx'];
  }

  private generateDocumentId(fileName: string, index: number): string {
    const hash = crypto
      .createHash('md5')
      .update(`${fileName}-${index}-${Date.now()}`)
      .digest('hex');
    return `docx-${hash}`;
  }
}
