import { Injectable } from '@nestjs/common';
import { TextSplitterPort } from '@domain/ports/processing.port';
import { Document, DocumentChunk } from '@domain/entities/document.entity';

/**
 * Python Code Splitter Adapter
 * Splits Python code while preserving function and class boundaries
 */
@Injectable()
export class PythonSplitterAdapter extends TextSplitterPort {
  readonly name = 'python';

  async splitDocuments(
    documents: Document[],
    options?: {
      chunkSize?: number;
      chunkOverlap?: number;
    },
  ): Promise<DocumentChunk[]> {
    const chunkSize = options?.chunkSize || 1500;
    const chunks: DocumentChunk[] = [];

    for (const doc of documents) {
      const docChunks = this._splitPythonCode(doc.content, chunkSize);

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
              language: 'python',
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

  private _splitPythonCode(code: string, chunkSize: number): string[] {
    const lines = code.split('\n');
    const chunks: string[] = [];
    let currentChunk: string[] = [];
    let currentSize = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineSize = line.length + 1; // +1 for newline

      // Check for function or class definition
      const isFunctionOrClass = /^(def|class)\s+/.test(line.trim());

      if (currentSize + lineSize > chunkSize && currentChunk.length > 0) {
        // Don't split in the middle of a function/class
        if (!isFunctionOrClass) {
          chunks.push(currentChunk.join('\n'));
          currentChunk = [];
          currentSize = 0;
        }
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
