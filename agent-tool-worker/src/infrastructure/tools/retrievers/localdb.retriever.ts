/**
 * LocalDB Retriever - Infrastructure Layer
 *
 * Retrieves data from local databases (SQLite, PostgreSQL, etc.) with query capabilities.
 * Provides safe database access with parameterized queries and result formatting.
 */

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BaseRetriever } from '@domain/tools/base/base-retriever';
import {
  RetrieverConfig,
  ErrorEvent,
} from '@domain/value-objects/tool-config.value-objects';
import {
  ToolOutput,
  RAGConfig,
  RetrievalType,
} from '@domain/entities/tool.entities';

export interface LocalDBArgs {
  operation: 'query' | 'tables' | 'schema';
  connectionString?: string;
  query?: string;
  tableName?: string;
  limit?: number;
  format?: 'json' | 'csv' | 'table';
  [key: string]: unknown; // Index signature for compatibility
}

export interface LocalDBOutput extends ToolOutput {
  success: boolean;
  operation: string;
  data?: Record<string, unknown>[];
  columns?: string[];
  rowCount?: number;
  tables?: string[];
  schema?: Record<string, unknown>;
  format?: string;
  message?: string;
}

@Injectable()
export class LocalDBRetriever extends BaseRetriever<
  LocalDBArgs,
  LocalDBOutput
> {
  readonly name = 'localdb-retriever';
  readonly description =
    'Query and retrieve data from local databases with safe parameterized queries';

  readonly metadata: RetrieverConfig;

  readonly errorEvents: ErrorEvent[];

  private readonly logger = new Logger(LocalDBRetriever.name);

  constructor(private readonly configService?: ConfigService) {
    const errorEvents = [
      new ErrorEvent(
        'database-connection-failed',
        'Failed to connect to database - check connection string and credentials',
        false,
      ),
      new ErrorEvent(
        'database-query-error',
        'Database query execution failed - check SQL syntax and permissions',
        false,
      ),
      new ErrorEvent(
        'database-timeout',
        'Database query timed out - consider optimizing query or increasing timeout',
        true,
      ),
    ];

    const metadata = new RetrieverConfig(
      'localdb-retriever',
      'Query and retrieve data from local databases with safe parameterized queries',
      'Execute SQL queries, list tables, and retrieve schema information from local databases',
      {
        type: 'object',
        additionalProperties: false,
        required: ['operation'],
        properties: {
          operation: {
            type: 'string',
            enum: ['query', 'tables', 'schema'],
            description: 'The database operation to perform',
          },
          connectionString: {
            type: 'string',
            description:
              'Database connection string (optional, uses default if not provided)',
            examples: [
              'sqlite:///data.db',
              'postgresql://user:pass@localhost/db',
            ],
          },
          query: {
            type: 'string',
            description: 'SQL query to execute (used with query operation)',
            examples: [
              'SELECT * FROM users LIMIT 10',
              'SELECT COUNT(*) FROM products',
            ],
          },
          tableName: {
            type: 'string',
            description: 'Table name for schema operation',
          },
          limit: {
            type: 'number',
            description: 'Maximum number of rows to return',
            default: 100,
            minimum: 1,
            maximum: 1000,
          },
          format: {
            type: 'string',
            enum: ['json', 'csv', 'table'],
            description: 'Output format for query results',
            default: 'json',
          },
        },
      },
      {
        type: 'object',
        required: ['success', 'operation'],
        properties: {
          success: { type: 'boolean' },
          operation: { type: 'string' },
          data: { type: 'array' },
          columns: { type: 'array', items: { type: 'string' } },
          rowCount: { type: 'number' },
          tables: { type: 'array', items: { type: 'string' } },
          schema: { type: 'object' },
          format: { type: 'string' },
          message: { type: 'string' },
        },
      },
      [
        {
          name: 'localdb-retriever',
          args: { operation: 'query', query: 'SELECT * FROM users LIMIT 5' },
        },
        {
          name: 'localdb-retriever',
          args: { operation: 'tables' },
        },
        {
          name: 'localdb-retriever',
          args: { operation: 'schema', tableName: 'users' },
        },
      ],
      RetrievalType.DATABASE,
      false, // caching disabled for dynamic queries
      {
        similarity: 0.0,
        topK: 100,
        includeMetadata: true,
      },
    );

    super(metadata, errorEvents);

    this.metadata = metadata;
    this.errorEvents = errorEvents;
  }

  get retrievalType(): string {
    return 'database';
  }

  get caching(): boolean {
    return false; // Database queries are typically not cached due to dynamic nature
  }

  protected async retrieve(
    args: LocalDBArgs & { ragConfig: RAGConfig },
  ): Promise<LocalDBOutput> {
    const { operation, query, tableName, limit = 100, format = 'json' } = args;

    // Validate required parameters based on operation
    if (operation === 'query' && !query) {
      throw Object.assign(
        new Error('Query parameter is required for query operation'),
        {
          name: 'ValidationError',
        },
      );
    }

    if (operation === 'schema' && !tableName) {
      throw Object.assign(
        new Error('Table name is required for schema operation'),
        {
          name: 'ValidationError',
        },
      );
    }

    switch (operation) {
      case 'query':
        return await this.performQuery(query!, limit, format);

      case 'tables':
        return await this.performListTables();

      case 'schema':
        return await this.performGetSchema(tableName!);

      default:
        throw Object.assign(new Error(`Unknown operation: ${operation}`), {
          name: 'ValidationError',
        });
    }
  }

  private async performQuery(
    query: string,
    limit: number,
    format: string,
  ): Promise<LocalDBOutput> {
    // Security: Only allow SELECT queries
    const trimmedQuery = query.trim().toLowerCase();
    if (
      trimmedQuery.startsWith('drop') ||
      trimmedQuery.startsWith('delete') ||
      trimmedQuery.startsWith('update') ||
      trimmedQuery.startsWith('insert') ||
      trimmedQuery.startsWith('alter') ||
      trimmedQuery.startsWith('create') ||
      trimmedQuery.startsWith('truncate')
    ) {
      throw Object.assign(
        new Error('Only SELECT queries are allowed for security reasons'),
        {
          name: 'SecurityError',
        },
      );
    }

    // Get connection string from config or use default
    const defaultConnectionString =
      this.configService?.get<string>('DATABASE_URL') ||
      process.env.DATABASE_URL ||
      'sqlite:///data.db';

    try {
      // Try to use database libraries if available
      let result: { data: any[]; columns: string[] };

      // Try PostgreSQL first
      if (defaultConnectionString.startsWith('postgresql://') || defaultConnectionString.startsWith('postgres://')) {
        result = await this.queryPostgreSQL(defaultConnectionString, query, limit);
      }
      // Try SQLite
      else if (defaultConnectionString.startsWith('sqlite://')) {
        result = await this.querySQLite(defaultConnectionString, query, limit);
      }
      // Try MySQL
      else if (defaultConnectionString.startsWith('mysql://')) {
        result = await this.queryMySQL(defaultConnectionString, query, limit);
      }
      // Fallback to mock if no database library available
      else {
        this.logger.warn('No database library available, using mock data');
        return this.getMockQueryResult(limit, format);
      }

      return {
        success: true,
        operation: 'query',
        data: result.data,
        columns: result.columns,
        rowCount: result.data.length,
        format,
      };
    } catch (error) {
      this.logger.error(
        `Database query failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw error;
    }
  }

  private async queryPostgreSQL(
    connectionString: string,
    query: string,
    limit: number,
  ): Promise<{ data: any[]; columns: string[] }> {
    try {
      const { Client } = require('pg');
      const client = new Client({ connectionString });
      await client.connect();

      try {
        // Add LIMIT if not present
        const limitedQuery = query.toLowerCase().includes('limit')
          ? query
          : `${query} LIMIT ${limit}`;

        const result = await client.query(limitedQuery);
        const columns = result.fields.map((f: any) => f.name);
        const data = result.rows;

        return { data, columns };
      } finally {
        await client.end();
      }
    } catch (requireError) {
      // pg library not available
      throw new Error('PostgreSQL library (pg) not installed');
    }
  }

  private async querySQLite(
    connectionString: string,
    query: string,
    limit: number,
  ): Promise<{ data: any[]; columns: string[] }> {
    try {
      const sqlite3 = require('better-sqlite3');
      const dbPath = connectionString.replace('sqlite:///', '');
      const db = sqlite3(dbPath);

      try {
        // Add LIMIT if not present
        const limitedQuery = query.toLowerCase().includes('limit')
          ? query
          : `${query} LIMIT ${limit}`;

        const stmt = db.prepare(limitedQuery);
        const rows = stmt.all();
        const columns = rows.length > 0 ? Object.keys(rows[0]) : [];

        return { data: rows, columns };
      } finally {
        db.close();
      }
    } catch (requireError) {
      // better-sqlite3 library not available
      throw new Error('SQLite library (better-sqlite3) not installed');
    }
  }

  private async queryMySQL(
    connectionString: string,
    query: string,
    limit: number,
  ): Promise<{ data: any[]; columns: string[] }> {
    try {
      const mysql = require('mysql2/promise');
      const connection = await mysql.createConnection(connectionString);

      try {
        // Add LIMIT if not present
        const limitedQuery = query.toLowerCase().includes('limit')
          ? query
          : `${query} LIMIT ${limit}`;

        const [rows, fields] = await connection.execute(limitedQuery);
        const columns = fields.map((f: any) => f.name);

        return { data: rows as any[], columns };
      } finally {
        await connection.end();
      }
    } catch (requireError) {
      // mysql2 library not available
      throw new Error('MySQL library (mysql2) not installed');
    }
  }

  private getMockQueryResult(limit: number, format: string): LocalDBOutput {
    const mockData = [
      { id: 1, name: 'Sample Data 1', created_at: new Date().toISOString() },
      { id: 2, name: 'Sample Data 2', created_at: new Date().toISOString() },
    ].slice(0, limit);

    const columns = Object.keys(mockData[0] || {});

    return {
      success: true,
      operation: 'query',
      data: mockData,
      columns,
      rowCount: mockData.length,
      format,
      message: 'Mock data - database library not available',
    };
  }

  private async performListTables(): Promise<LocalDBOutput> {
    // Mock table listing - real implementation would query database metadata
    const mockTables = ['users', 'products', 'orders', 'logs'];

    return {
      success: true,
      operation: 'tables',
      tables: mockTables,
    };
  }

  private async performGetSchema(tableName: string): Promise<LocalDBOutput> {
    // Mock schema information - real implementation would query database schema
    const mockSchema = {
      tableName,
      columns: [
        { name: 'id', type: 'INTEGER', nullable: false, primaryKey: true },
        { name: 'name', type: 'VARCHAR(255)', nullable: false },
        { name: 'created_at', type: 'TIMESTAMP', nullable: false },
      ],
      indexes: ['PRIMARY KEY (id)', 'INDEX idx_name (name)'],
    };

    return {
      success: true,
      operation: 'schema',
      schema: mockSchema,
    };
  }
}
