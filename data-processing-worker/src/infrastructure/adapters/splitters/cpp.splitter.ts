import { Injectable } from '@nestjs/common';
import { TextSplitterPort } from '@domain/ports/processing.port';
import { Document, DocumentChunk } from '@domain/entities/document.entity';

/**
 * C++ Code Splitter Adapter
 * Splits C++ code while preserving class and function boundaries
 */
@Injectable()
export class CppSplitterAdapter extends TextSplitterPort {
  readonly name = 'cpp';

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
      const docChunks = this._splitCppCode(doc.content, chunkSize);

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
              language: 'cpp',
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

  private _splitCppCode(code: string, chunkSize: number): string[] {
    const lines = code.split('\n');
    const chunks: string[] = [];
    let currentChunk: string[] = [];
    let currentSize = 0;
    let braceDepth = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineSize = line.length + 1;

      // Track brace depth
      braceDepth += (line.match(/{/g) || []).length;
      braceDepth -= (line.match(/}/g) || []).length;

      // Check for class/struct/function definition
      const isDefinition = /^(class|struct|namespace|template|void|int|bool|string|auto)\s+/.test(line.trim());

      if (currentSize + lineSize > chunkSize && currentChunk.length > 0 && braceDepth === 0) {
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
