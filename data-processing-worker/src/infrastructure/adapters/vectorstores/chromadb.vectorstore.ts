import { Injectable, Logger } from '@nestjs/common';
import { VectorStorePort } from '@domain/ports/processing.port';
import { Document } from '@domain/entities/document.entity';

/**
 * ChromaDB Vector Store Adapter (DISABLED - Placeholder)
 *
 * ChromaDB is an open-source embedding database.
 * To enable: Install chromadb and configure endpoint.
 *
 * Installation: npm install chromadb
 */
@Injectable()
export class ChromaDBVectorStoreAdapter implements VectorStorePort {
  private readonly logger = new Logger(ChromaDBVectorStoreAdapter.name);
  readonly name = 'chromadb';
  private readonly enabled = false;

  constructor() {
    if (!this.enabled) {
      this.logger.warn(
        'ChromaDB vector store is DISABLED. To enable, set CHROMADB_URL and install dependencies.',
      );
    }
  }

  async storeDocuments(
    documents: Document[],
    embeddings: number[][],
    metadata?: Record<string, unknown>,
  ): Promise<string[]> {
    if (!this.enabled) {
      throw new Error(
        'ChromaDB vector store is disabled. Enable it by setting CHROMADB_URL.',
      );
    }

    /*
    const { ChromaClient } = require('chromadb');

    const client = new ChromaClient({
      path: process.env.CHROMADB_URL || 'http://localhost:8000',
    });

    const collection = await client.getOrCreateCollection({
      name: 'documents',
    });

    await collection.add({
      ids: documents.map(d => d.id),
      embeddings: embeddings,
      documents: documents.map(d => d.content),
      metadatas: documents.map(d => ({ ...d.metadata, ...metadata })),
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
      throw new Error('ChromaDB vector store is disabled.');
    }

    /*
    const { ChromaClient } = require('chromadb');

    const client = new ChromaClient({
      path: process.env.CHROMADB_URL || 'http://localhost:8000',
    });

    const collection = await client.getCollection({ name: 'documents' });

    const results = await collection.query({
      queryEmbeddings: [queryEmbedding],
      nResults: limit,
      where: filter,
    });

    if (!results.ids || !results.ids[0]) return [];

    return results.ids[0].map((id: string, i: number) => ({
      document: new Document(
        id,
        results.documents?.[0]?.[i] || '',
        results.metadatas?.[0]?.[i] || {},
      ),
      score: results.distances?.[0]?.[i] || 0,
    }));
    */

    return [];
  }

  async deleteDocuments(ids: string[]): Promise<void> {
    if (!this.enabled) {
      throw new Error('ChromaDB vector store is disabled.');
    }

    /*
    const { ChromaClient } = require('chromadb');

    const client = new ChromaClient({
      path: process.env.CHROMADB_URL || 'http://localhost:8000',
    });

    const collection = await client.getCollection({ name: 'documents' });

    await collection.delete({
      ids: ids,
    });
    */
  }

  async getDocument(id: string): Promise<Document | null> {
    if (!this.enabled) {
      throw new Error('ChromaDB vector store is disabled.');
    }

    /*
    const { ChromaClient } = require('chromadb');

    const client = new ChromaClient({
      path: process.env.CHROMADB_URL || 'http://localhost:8000',
    });

    const collection = await client.getCollection({ name: 'documents' });

    const result = await collection.get({
      ids: [id],
    });

    if (!result.ids || result.ids.length === 0) return null;

    return new Document(
      id,
      result.documents?.[0] || '',
      result.metadatas?.[0] || {},
    );
    */

    return null;
  }
}
