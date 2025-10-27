import { Injectable } from '@nestjs/common';
import { TextSplitterPort } from '@domain/ports/processing.port';
import { Document, DocumentChunk } from '@domain/entities/document.entity';

/**
 * HTML Splitter Adapter
 * Splits HTML documents while preserving tag structure
 */
@Injectable()
export class HtmlSplitterAdapter extends TextSplitterPort {
  readonly name = 'html';

  async splitDocuments(
    documents: Document[],
    options?: {
      chunkSize?: number;
      chunkOverlap?: number;
      stripTags?: boolean;
    },
  ): Promise<DocumentChunk[]> {
    const chunkSize = options?.chunkSize || 1500;
    const stripTags = options?.stripTags || false;
    const chunks: DocumentChunk[] = [];

    for (const doc of documents) {
      let content = doc.content;
      
      if (stripTags) {
        // Simple tag stripping
        content = content.replace(/<[^>]*>/g, '').trim();
      }

      const docChunks = this._splitHtml(content, chunkSize, stripTags);

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
              format: 'html',
              tagsStripped: stripTags,
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

  private _splitHtml(html: string, chunkSize: number, stripTags: boolean): string[] {
    if (stripTags) {
      // If tags are stripped, use simple text splitting
      const chunks: string[] = [];
      let currentChunk = '';
      const sentences = html.split(/[.!?]+/);

      for (const sentence of sentences) {
        if ((currentChunk + sentence).length > chunkSize && currentChunk.length > 0) {
          chunks.push(currentChunk.trim());
          currentChunk = sentence;
        } else {
          currentChunk += sentence + '. ';
        }
      }

      if (currentChunk.trim().length > 0) {
        chunks.push(currentChunk.trim());
      }

      return chunks;
    }

    // Preserve HTML structure
    const lines = html.split('\n');
    const chunks: string[] = [];
    let currentChunk: string[] = [];
    let currentSize = 0;
    let tagDepth = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineSize = line.length + 1;

      // Track tag depth
      const openTags = (line.match(/<[^/][^>]*>/g) || []).length;
      const closeTags = (line.match(/<\/[^>]*>/g) || []).length;
      tagDepth += openTags - closeTags;

      if (currentSize + lineSize > chunkSize && currentChunk.length > 0 && tagDepth === 0) {
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
