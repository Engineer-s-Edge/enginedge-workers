import { Injectable, Logger } from '@nestjs/common';
import { VectorStorePort } from '@domain/ports/processing.port';
import { Document } from '@domain/entities/document.entity';

/**
 * Qdrant Vector Store Adapter (DISABLED - Placeholder)
 * 
 * Qdrant is an open-source vector similarity search engine.
 * To enable: Install @qdrant/js-client-rest and configure endpoint.
 * 
 * Installation: npm install @qdrant/js-client-rest
 */
@Injectable()
export class QdrantVectorStoreAdapter implements VectorStorePort {
  private readonly logger = new Logger(QdrantVectorStoreAdapter.name);
  readonly name = 'qdrant';
  private readonly enabled = false;

  constructor() {
    if (!this.enabled) {
      this.logger.warn('Qdrant vector store is DISABLED. To enable, set QDRANT_URL and install dependencies.');
    }
  }

  async storeDocuments(
    documents: Document[],
    embeddings: number[][],
    metadata?: Record<string, unknown>,
  ): Promise<string[]> {
    if (!this.enabled) {
      throw new Error('Qdrant vector store is disabled. Enable it by setting QDRANT_URL.');
    }

    /*
    const { QdrantClient } = require('@qdrant/js-client-rest');
    
    const client = new QdrantClient({
      url: process.env.QDRANT_URL || 'http://localhost:6333',
    });

    const collectionName = 'documents';

    // Ensure collection exists
    try {
      await client.getCollection(collectionName);
    } catch {
      await client.createCollection(collectionName, {
        vectors: {
          size: embeddings[0].length,
          distance: 'Cosine',
        },
      });
    }

    const points = documents.map((doc, i) => ({
      id: doc.id,
      vector: embeddings[i],
      payload: {
        content: doc.content,
        ...doc.metadata,
        ...metadata,
      },
    }));

    await client.upsert(collectionName, {
      wait: true,
      points,
    });

    return documents.map(d => d.id);
    */

    return [];
  }

  async similaritySearch(
    queryEmbedding: number[],
    limit: number = 5,
    filter?: Record<string, unknown>,
  ): Promise<Array<{ document: Document; score: number }>> {
    if (!this.enabled) {
      throw new Error('Qdrant vector store is disabled.');
    }

    /*
    const { QdrantClient } = require('@qdrant/js-client-rest');
    
    const client = new QdrantClient({
      url: process.env.QDRANT_URL || 'http://localhost:6333',
    });

    const collectionName = 'documents';

    const searchResult = await client.search(collectionName, {
      vector: queryEmbedding,
      limit,
      filter: filter ? { must: Object.entries(filter).map(([key, value]) => ({
        key,
        match: { value },
      })) } : undefined,
    });

    return searchResult.map((result: any) => ({
      document: new Document(
        result.id,
        result.payload.content,
        result.payload,
      ),
      score: result.score,
    }));
    */

    return [];
  }

  async deleteDocuments(ids: string[]): Promise<void> {
    if (!this.enabled) {
      throw new Error('Qdrant vector store is disabled.');
    }

    /*
    const { QdrantClient } = require('@qdrant/js-client-rest');
    
    const client = new QdrantClient({
      url: process.env.QDRANT_URL || 'http://localhost:6333',
    });

    const collectionName = 'documents';

    await client.delete(collectionName, {
      wait: true,
      points: ids,
    });
    */
  }

  async getDocument(id: string): Promise<Document | null> {
    if (!this.enabled) {
      throw new Error('Qdrant vector store is disabled.');
    }

    /*
    const { QdrantClient } = require('@qdrant/js-client-rest');
    
    const client = new QdrantClient({
      url: process.env.QDRANT_URL || 'http://localhost:6333',
    });

    const collectionName = 'documents';

    const result = await client.retrieve(collectionName, {
      ids: [id],
    });

    if (!result || result.length === 0) return null;

    const point = result[0];
    return new Document(
      point.id as string,
      point.payload.content,
      point.payload,
    );
    */

    return null;
  }
}
