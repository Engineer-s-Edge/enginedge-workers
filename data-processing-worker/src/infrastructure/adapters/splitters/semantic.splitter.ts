import { Injectable } from '@nestjs/common';
import { TextSplitterPort } from '@domain/ports/processing.port';
import { Document, DocumentChunk } from '@domain/entities/document.entity';

/**
 * Semantic Text Splitter Adapter
 * Splits text based on semantic boundaries (sentences, paragraphs)
 */
@Injectable()
export class SemanticSplitterAdapter extends TextSplitterPort {
  readonly name = 'semantic';

  /**
   * Split documents by semantic boundaries
   */
  async splitDocuments(
    documents: Document[],
    options?: {
      chunkSize?: number;
      chunkOverlap?: number;
      respectParagraphs?: boolean;
      respectSentences?: boolean;
    },
  ): Promise<DocumentChunk[]> {
    const chunkSize = options?.chunkSize || 1000;
    const chunkOverlap = options?.chunkOverlap || 200;
    const respectParagraphs = options?.respectParagraphs !== false;
    const respectSentences = options?.respectSentences !== false;

    const chunks: DocumentChunk[] = [];

    for (const doc of documents) {
      const docChunks = this._splitSemantically(
        doc.content,
        chunkSize,
        chunkOverlap,
        respectParagraphs,
        respectSentences,
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
   * Split text semantically
   */
  private _splitSemantically(
    text: string,
    chunkSize: number,
    chunkOverlap: number,
    respectParagraphs: boolean,
    respectSentences: boolean,
  ): string[] {
    const chunks: string[] = [];
    
    // Split by paragraphs first
    const paragraphs = respectParagraphs ? text.split(/\n\n+/) : [text];
    
    let currentChunk = '';
    
    for (const paragraph of paragraphs) {
      if (respectSentences) {
        // Split paragraph into sentences
        const sentences = this._splitIntoSentences(paragraph);
        
        for (const sentence of sentences) {
          if ((currentChunk + sentence).length <= chunkSize) {
            currentChunk += (currentChunk ? ' ' : '') + sentence;
          } else {
            if (currentChunk) {
              chunks.push(currentChunk.trim());
            }
            
            // Handle overlap
            if (chunkOverlap > 0 && currentChunk.length > chunkOverlap) {
              const overlapSentences = this._splitIntoSentences(currentChunk).slice(-2);
              currentChunk = overlapSentences.join(' ') + ' ' + sentence;
            } else {
              currentChunk = sentence;
            }
          }
        }
      } else {
        // Use whole paragraphs
        if ((currentChunk + paragraph).length <= chunkSize) {
          currentChunk += (currentChunk ? '\n\n' : '') + paragraph;
        } else {
          if (currentChunk) {
            chunks.push(currentChunk.trim());
          }
          currentChunk = paragraph;
        }
      }
    }
    
    if (currentChunk) {
      chunks.push(currentChunk.trim());
    }
    
    return chunks.filter(c => c.length > 0);
  }

  /**
   * Split text into sentences
   */
  private _splitIntoSentences(text: string): string[] {
    // Simple sentence splitting (can be improved with NLP)
    const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
    return sentences.map(s => s.trim()).filter(s => s.length > 0);
  }
}
