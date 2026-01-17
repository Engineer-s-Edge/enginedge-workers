import { Injectable, Logger } from '@nestjs/common';
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';
import { TextSplitterPort } from '@domain/ports/processing.port';
import { Document, DocumentChunk } from '@domain/entities/document.entity';
import * as crypto from 'crypto';

/**
 * Recursive Character Text Splitter (Infrastructure Layer)
 *
 * Splits text recursively by trying different separators in order.
 * Default separators: ["\n\n", "\n", " ", ""]
 */
@Injectable()
export class RecursiveCharacterSplitterAdapter extends TextSplitterPort {
  private readonly logger = new Logger(RecursiveCharacterSplitterAdapter.name);

  async splitDocuments(
    documents: Document[],
    options?: Record<string, unknown>,
  ): Promise<Document[]> {
    const chunkSize = (options?.chunkSize as number) || 1000;
    const chunkOverlap = (options?.chunkOverlap as number) || 200;

    this.logger.log(
      `Splitting ${documents.length} documents (chunkSize: ${chunkSize}, overlap: ${chunkOverlap})`,
    );

    const splitter = new RecursiveCharacterTextSplitter({
      chunkSize,
      chunkOverlap,
    });

    const allChunks: Document[] = [];

    for (const doc of documents) {
      const textChunks = await splitter.splitText(doc.content);

      textChunks.forEach((chunk: string, index: number) => {
        const chunkId = this.generateChunkId(doc.id, index);
        const documentChunk = new DocumentChunk(
          chunkId,
          chunk,
          {
            ...doc.metadata,
            chunkIndex: index,
            totalChunks: textChunks.length,
          },
          doc.id,
          index,
          textChunks.length,
        );
        allChunks.push(documentChunk);
      });
    }

    this.logger.log(`Split into ${allChunks.length} total chunks`);
    return allChunks;
  }

  async splitText(
    text: string,
    options?: Record<string, unknown>,
  ): Promise<string[]> {
    const chunkSize = (options?.chunkSize as number) || 1000;
    const chunkOverlap = (options?.chunkOverlap as number) || 200;

    const splitter = new RecursiveCharacterTextSplitter({
      chunkSize,
      chunkOverlap,
    });

    return splitter.splitText(text);
  }

  private generateChunkId(parentId: string, chunkIndex: number): string {
    return `chunk-${crypto.createHash('md5').update(`${parentId}-${chunkIndex}`).digest('hex')}`;
  }
}
