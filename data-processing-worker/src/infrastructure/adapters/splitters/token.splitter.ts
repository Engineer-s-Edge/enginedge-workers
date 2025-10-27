import { Injectable } from '@nestjs/common';
import { TextSplitterPort } from '@domain/ports/processing.port';
import { Document, DocumentChunk } from '@domain/entities/document.entity';

/**
 * Token Text Splitter Adapter
 * Splits text by token count (approximate, based on common tokenization)
 */
@Injectable()
export class TokenSplitterAdapter extends TextSplitterPort {
  readonly name = 'token';

  /**
   * Split documents by token count
   */
  async splitDocuments(
    documents: Document[],
    options?: {
      chunkSize?: number;
      chunkOverlap?: number;
      encodingName?: string;
    },
  ): Promise<DocumentChunk[]> {
    const chunkSize = options?.chunkSize || 500; // tokens
    const chunkOverlap = options?.chunkOverlap || 50;

    const chunks: DocumentChunk[] = [];

    for (const doc of documents) {
      const docChunks = this._splitByTokens(doc.content, chunkSize, chunkOverlap);

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
   * Split text by approximate token count
   * Note: This is a simplified implementation
   * For production, use tiktoken or similar library
   */
  private _splitByTokens(
    text: string,
    chunkSize: number,
    chunkOverlap: number,
  ): string[] {
    // Approximate: 1 token ≈ 4 characters for English
    const approxCharsPerToken = 4;
    const chunkSizeChars = chunkSize * approxCharsPerToken;
    const overlapChars = chunkOverlap * approxCharsPerToken;

    const chunks: string[] = [];
    const words = text.split(/\s+/);
    
    let currentChunk = '';
    let currentTokens = 0;
    
    for (const word of words) {
      const wordTokens = Math.ceil(word.length / approxCharsPerToken);
      
      if (currentTokens + wordTokens <= chunkSize) {
        currentChunk += (currentChunk ? ' ' : '') + word;
        currentTokens += wordTokens;
      } else {
        if (currentChunk) {
          chunks.push(currentChunk);
        }
        
        // Handle overlap
        if (chunkOverlap > 0) {
          const overlapWords = currentChunk.split(/\s+/).slice(-Math.ceil(chunkOverlap / 10));
          currentChunk = overlapWords.join(' ') + ' ' + word;
          currentTokens = Math.ceil(currentChunk.length / approxCharsPerToken);
        } else {
          currentChunk = word;
          currentTokens = wordTokens;
        }
      }
    }
    
    if (currentChunk) {
      chunks.push(currentChunk);
    }
    
    return chunks.filter(c => c.length > 0);
  }
}
