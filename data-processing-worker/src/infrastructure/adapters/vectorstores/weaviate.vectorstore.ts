import { Injectable, Logger } from '@nestjs/common';
import { VectorStorePort } from '@domain/ports/processing.port';
import { Document } from '@domain/entities/document.entity';

/**
 * Weaviate Vector Store Adapter (DISABLED - Placeholder)
 *
 * Weaviate is an open-source vector database with GraphQL API.
 * To enable: Install weaviate-ts-client and configure endpoint.
 *
 * Installation: npm install weaviate-ts-client
 */
@Injectable()
export class WeaviateVectorStoreAdapter implements VectorStorePort {
  private readonly logger = new Logger(WeaviateVectorStoreAdapter.name);
  readonly name = 'weaviate';
  private readonly enabled = false;

  constructor() {
    if (!this.enabled) {
      this.logger.warn(
        'Weaviate vector store is DISABLED. To enable, set WEAVIATE_URL and install dependencies.',
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
        'Weaviate vector store is disabled. Enable it by setting WEAVIATE_URL.',
      );
    }

    /*
    const weaviate = require('weaviate-ts-client');

    const client = weaviate.client({
      scheme: 'http',
      host: process.env.WEAVIATE_URL || 'localhost:8080',
    });

    const className = 'Document';

    for (let i = 0; i < documents.length; i++) {
      const doc = documents[i];
      const embedding = embeddings[i];

      await client.data
        .creator()
        .withClassName(className)
        .withId(doc.id)
        .withProperties({
          content: doc.content,
          metadata: JSON.stringify({ ...doc.metadata, ...metadata }),
        })
        .withVector(embedding)
        .do();
    }

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
      throw new Error('Weaviate vector store is disabled.');
    }

    /*
    const weaviate = require('weaviate-ts-client');

    const client = weaviate.client({
      scheme: 'http',
      host: process.env.WEAVIATE_URL || 'localhost:8080',
    });

    const className = 'Document';

    const result = await client.graphql
      .get()
      .withClassName(className)
      .withFields('content metadata _additional { id certainty }')
      .withNearVector({ vector: queryEmbedding })
      .withLimit(limit)
      .do();

    const objects = result.data.Get[className] || [];

    return objects.map((obj: any) => {
      const metadata = JSON.parse(obj.metadata || '{}');
      return {
        document: new Document(
          obj._additional.id,
          obj.content,
          metadata,
        ),
        score: obj._additional.certainty,
      };
    });
    */

    return [];
  }

  async deleteDocuments(ids: string[]): Promise<void> {
    if (!this.enabled) {
      throw new Error('Weaviate vector store is disabled.');
    }

    /*
    const weaviate = require('weaviate-ts-client');

    const client = weaviate.client({
      scheme: 'http',
      host: process.env.WEAVIATE_URL || 'localhost:8080',
    });

    const className = 'Document';

    for (const id of ids) {
      await client.data
        .deleter()
        .withClassName(className)
        .withId(id)
        .do();
    }
    */
  }

  async getDocument(id: string): Promise<Document | null> {
    if (!this.enabled) {
      throw new Error('Weaviate vector store is disabled.');
    }

    /*
    const weaviate = require('weaviate-ts-client');

    const client = weaviate.client({
      scheme: 'http',
      host: process.env.WEAVIATE_URL || 'localhost:8080',
    });

    const className = 'Document';

    const result = await client.data
      .getterById()
      .withClassName(className)
      .withId(id)
      .do();

    if (!result) return null;

    const metadata = JSON.parse(result.properties.metadata || '{}');

    return new Document(
      id,
      result.properties.content,
      metadata,
    );
    */

    return null;
  }
}
