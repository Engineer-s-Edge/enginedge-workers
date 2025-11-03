import { Injectable, Logger } from '@nestjs/common';
import { VectorStorePort } from '@domain/ports/processing.port';
import { Document } from '@domain/entities/document.entity';

/**
 * PgVector Vector Store Adapter (DISABLED - Placeholder)
 *
 * PgVector is a PostgreSQL extension for vector similarity search.
 * To enable: Install pg and enable pgvector extension in PostgreSQL.
 *
 * Installation: npm install pg
 * PostgreSQL: CREATE EXTENSION vector;
 */
@Injectable()
export class PgVectorStoreAdapter implements VectorStorePort {
  private readonly logger = new Logger(PgVectorStoreAdapter.name);
  readonly name = 'pgvector';
  private readonly enabled = false;

  constructor() {
    if (!this.enabled) {
      this.logger.warn(
        'PgVector vector store is DISABLED. To enable, set PGVECTOR_CONNECTION_STRING and install dependencies.',
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
        'PgVector vector store is disabled. Enable it by setting PGVECTOR_CONNECTION_STRING.',
      );
    }

    /*
    const { Pool } = require('pg');

    const pool = new Pool({
      connectionString: process.env.PGVECTOR_CONNECTION_STRING,
    });

    const client = await pool.connect();

    try {
      for (let i = 0; i < documents.length; i++) {
        const doc = documents[i];
        const embedding = embeddings[i];

        await client.query(
          `INSERT INTO documents (id, content, embedding, metadata)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (id) DO UPDATE
           SET content = $2, embedding = $3, metadata = $4`,
          [
            doc.id,
            doc.content,
            `[${embedding.join(',')}]`, // pgvector format
            JSON.stringify({ ...doc.metadata, ...metadata }),
          ]
        );
      }

      return documents.map(d => d.id);
    } finally {
      client.release();
    }
    */

    return [];
  }

  async similaritySearch(
    queryEmbedding: number[],
    limit: number = 5,
    filter?: Record<string, unknown>,
  ): Promise<Array<{ document: Document; score: number }>> {
    if (!this.enabled) {
      throw new Error('PgVector vector store is disabled.');
    }

    /*
    const { Pool } = require('pg');

    const pool = new Pool({
      connectionString: process.env.PGVECTOR_CONNECTION_STRING,
    });

    const client = await pool.connect();

    try {
      const embeddingStr = `[${queryEmbedding.join(',')}]`;

      const result = await client.query(
        `SELECT id, content, metadata,
                1 - (embedding <=> $1::vector) as score
         FROM documents
         ORDER BY embedding <=> $1::vector
         LIMIT $2`,
        [embeddingStr, limit]
      );

      return result.rows.map((row: any) => ({
        document: new Document(
          row.id,
          row.content,
          JSON.parse(row.metadata || '{}'),
        ),
        score: row.score,
      }));
    } finally {
      client.release();
    }
    */

    return [];
  }

  async deleteDocuments(ids: string[]): Promise<void> {
    if (!this.enabled) {
      throw new Error('PgVector vector store is disabled.');
    }

    /*
    const { Pool } = require('pg');

    const pool = new Pool({
      connectionString: process.env.PGVECTOR_CONNECTION_STRING,
    });

    const client = await pool.connect();

    try {
      await client.query(
        'DELETE FROM documents WHERE id = ANY($1)',
        [ids]
      );
    } finally {
      client.release();
    }
    */
  }

  async getDocument(id: string): Promise<Document | null> {
    if (!this.enabled) {
      throw new Error('PgVector vector store is disabled.');
    }

    /*
    const { Pool } = require('pg');

    const pool = new Pool({
      connectionString: process.env.PGVECTOR_CONNECTION_STRING,
    });

    const client = await pool.connect();

    try {
      const result = await client.query(
        'SELECT id, content, metadata FROM documents WHERE id = $1',
        [id]
      );

      if (result.rows.length === 0) return null;

      const row = result.rows[0];
      return new Document(
        row.id,
        row.content,
        JSON.parse(row.metadata || '{}'),
      );
    } finally {
      client.release();
    }
    */

    return null;
  }
}
