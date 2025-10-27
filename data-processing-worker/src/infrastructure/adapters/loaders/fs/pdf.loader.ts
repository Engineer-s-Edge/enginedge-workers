import { Injectable, Logger } from '@nestjs/common';
import { PDFLoader } from '@langchain/community/document_loaders/fs/pdf';
import { FilesystemLoaderPort } from '../../../../domain/ports/loader.port';
import { Document, DocumentMetadata } from '../../../../domain/entities/document.entity';
import * as crypto from 'crypto';

/**
 * PDF Document Loader (Infrastructure Layer)
 * 
 * Loads and parses PDF files using LangChain's PDFLoader.
 * Supports OCR for image extraction (OCR handled via separate service).
 */
@Injectable()
export class PdfLoaderAdapter extends FilesystemLoaderPort {
  private readonly logger = new Logger(PdfLoaderAdapter.name);

  /**
   * Load PDF from string path or Blob
   */
  async load(source: string | Blob, options?: Record<string, unknown>): Promise<Document[]> {
    if (source instanceof Blob) {
      const fileName = (options?.fileName as string) || 'document.pdf';
      return this.loadBlob(source, fileName, options);
    }
    throw new Error('PDF loader only supports Blob input. For file paths, convert to Blob first.');
  }

  /**
   * Load PDF from Blob
   */
  async loadBlob(
    blob: Blob,
    fileName: string,
    options?: Record<string, unknown>,
  ): Promise<Document[]> {
    this.logger.log(`Loading PDF blob: ${fileName} (${blob.size} bytes)`);

    const splitPages = (options?.splitPages as boolean) ?? true;
    const metadata = (options?.metadata as Record<string, unknown>) || {};

    try {
      // Create PDFLoader instance
      const loader = new PDFLoader(blob, {
        splitPages,
        parsedItemSeparator: '\n',
      });

      // Load and parse PDF
      const langchainDocs = await loader.load();

      // Convert LangChain documents to our domain documents
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const documents = langchainDocs.map((doc: any, index: number) => {
        const docId = this.generateDocumentId(fileName, index);
        const docMetadata: DocumentMetadata = {
          source: fileName,
          sourceType: 'file',
          mimeType: 'application/pdf',
          fileName,
          fileExtension: '.pdf',
          pageNumber: doc.metadata.loc?.pageNumber,
          totalPages: langchainDocs.length,
          ...metadata,
          ...doc.metadata,
        };

        return new Document(docId, doc.pageContent, docMetadata);
      });

      this.logger.log(`Successfully loaded ${documents.length} documents from PDF`);
      return documents;
    } catch (error) {
      this.logger.error(`Error loading PDF: ${error instanceof Error ? error.message : 'Unknown error'}`, error instanceof Error ? error.stack : undefined);
      throw new Error(`Failed to load PDF: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Check if this loader supports the source
   */
  supports(source: string | Blob): boolean {
    if (source instanceof Blob) {
      return source.type === 'application/pdf';
    }
    return source.toLowerCase().endsWith('.pdf');
  }

  /**
   * Get supported file types
   */
  getSupportedTypes(): string[] {
    return ['.pdf'];
  }

  /**
   * Generate unique document ID
   */
  private generateDocumentId(fileName: string, index: number): string {
    const hash = crypto.createHash('md5').update(`${fileName}-${index}-${Date.now()}`).digest('hex');
    return `pdf-${hash}`;
  }
}
