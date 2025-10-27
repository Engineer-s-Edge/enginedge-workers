import { Injectable } from '@nestjs/common';
import { TextSplitterPort } from '@domain/ports/processing.port';
import { Document, DocumentChunk } from '@domain/entities/document.entity';

/**
 * Markdown Splitter Adapter
 * Splits Markdown documents while preserving heading structure
 */
@Injectable()
export class MarkdownSplitterAdapter extends TextSplitterPort {
  readonly name = 'markdown';

  async splitDocuments(
    documents: Document[],
    options?: {
      chunkSize?: number;
      chunkOverlap?: number;
      respectHeadings?: boolean;
    },
  ): Promise<DocumentChunk[]> {
    const chunkSize = options?.chunkSize || 1500;
    const respectHeadings = options?.respectHeadings !== false;
    const chunks: DocumentChunk[] = [];

    for (const doc of documents) {
      const docChunks = this._splitMarkdown(doc.content, chunkSize, respectHeadings);

      for (let i = 0; i < docChunks.length; i++) {
        chunks.push(
          new DocumentChunk(
            doc.id,
            docChunks[i],
            {
              ...doc.metadata,
              chunkIndex: i,
              totalChunks: docChunks.length,
              splitter: this.name,
              format: 'markdown',
            },
            doc.id, // parentDocumentId
            i, // chunkIndex
            docChunks.length, // totalChunks
            ),
        );
      }
    }

    return chunks;
  }

  private _splitMarkdown(markdown: string, chunkSize: number, respectHeadings: boolean): string[] {
    const lines = markdown.split('\n');
    const chunks: string[] = [];
    let currentChunk: string[] = [];
    let currentSize = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineSize = line.length + 1;

      // Check for heading
      const isHeading = /^#{1,6}\s+/.test(line.trim());

      if (respectHeadings && isHeading && currentSize + lineSize > chunkSize && currentChunk.length > 0) {
        chunks.push(currentChunk.join('\n'));
        currentChunk = [];
        currentSize = 0;
      } else if (!respectHeadings && currentSize + lineSize > chunkSize && currentChunk.length > 0) {
        chunks.push(currentChunk.join('\n'));
        currentChunk = [];
        currentSize = 0;
      }

      currentChunk.push(line);
      currentSize += lineSize;
    }

    if (currentChunk.length > 0) {
      chunks.push(currentChunk.join('\n'));
    }

    return chunks.filter(c => c.trim().length > 0);
  }
}
