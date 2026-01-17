import { Injectable } from '@nestjs/common';
import { TextSplitterPort } from '@domain/ports/processing.port';
import { Document, DocumentChunk } from '@domain/entities/document.entity';

/**
 * LaTeX Splitter Adapter
 * Splits LaTeX documents while preserving section and environment boundaries
 */
@Injectable()
export class LatexSplitterAdapter extends TextSplitterPort {
  readonly name = 'latex';

  async splitDocuments(
    documents: Document[],
    options?: {
      chunkSize?: number;
      chunkOverlap?: number;
    },
  ): Promise<DocumentChunk[]> {
    const chunkSize = options?.chunkSize || 2000;
    const chunks: DocumentChunk[] = [];

    for (const doc of documents) {
      const docChunks = this._splitLatex(doc.content, chunkSize);

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
              format: 'latex',
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

  private _splitLatex(latex: string, chunkSize: number): string[] {
    const lines = latex.split('\n');
    const chunks: string[] = [];
    let currentChunk: string[] = [];
    let currentSize = 0;
    let inEnvironment = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineSize = line.length + 1;

      // Check for environment boundaries
      if (/\\begin\{/.test(line)) {
        inEnvironment = true;
      }
      if (/\\end\{/.test(line)) {
        inEnvironment = false;
      }

      // Check for section boundaries
      const isSection = /^\\(section|subsection|subsubsection|chapter)\{/.test(
        line.trim(),
      );

      if (
        currentSize + lineSize > chunkSize &&
        currentChunk.length > 0 &&
        !inEnvironment
      ) {
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

    return chunks.filter((c) => c.trim().length > 0);
  }
}
