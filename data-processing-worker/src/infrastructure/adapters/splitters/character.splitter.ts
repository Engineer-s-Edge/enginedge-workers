import { Injectable } from '@nestjs/common';
import { TextSplitterPort } from '@domain/ports/processing.port';
import { Document, DocumentChunk } from '@domain/entities/document.entity';

/**
 * Character Text Splitter Adapter
 * Splits text by character count with configurable separator
 */
@Injectable()
export class CharacterSplitterAdapter extends TextSplitterPort {
  readonly name = 'character';

  /**
   * Split documents by character count
   */
  async splitDocuments(
    documents: Document[],
    options?: {
      chunkSize?: number;
      chunkOverlap?: number;
      separator?: string;
      keepSeparator?: boolean;
    },
  ): Promise<DocumentChunk[]> {
    const chunkSize = options?.chunkSize || 1000;
    const chunkOverlap = options?.chunkOverlap || 200;
    const separator = options?.separator || '\n\n';
    const keepSeparator = options?.keepSeparator !== false;

    const chunks: DocumentChunk[] = [];

    for (const doc of documents) {
      const docChunks = this._splitText(
        doc.content,
        chunkSize,
        chunkOverlap,
        separator,
        keepSeparator,
      );

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

  /**
   * Split text by character count
   */
  private _splitText(
    text: string,
    chunkSize: number,
    chunkOverlap: number,
    separator: string,
    keepSeparator: boolean,
  ): string[] {
    const chunks: string[] = [];
    const splits = text.split(separator);

    let currentChunk = '';

    for (let i = 0; i < splits.length; i++) {
      const part = keepSeparator && i > 0 ? separator + splits[i] : splits[i];

      if ((currentChunk + part).length <= chunkSize) {
        currentChunk += part;
      } else {
        if (currentChunk) {
          chunks.push(currentChunk.trim());
        }

        // Handle overlap
        if (chunkOverlap > 0 && currentChunk.length > chunkOverlap) {
          currentChunk = currentChunk.slice(-chunkOverlap) + part;
        } else {
          currentChunk = part;
        }
      }
    }

    if (currentChunk) {
      chunks.push(currentChunk.trim());
    }

    return chunks.filter((c) => c.length > 0);
  }
}
