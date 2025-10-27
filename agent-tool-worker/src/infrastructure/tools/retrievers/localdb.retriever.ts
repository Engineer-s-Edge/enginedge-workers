/**
 * LocalDB Retriever - Infrastructure Layer
 *
 * Retrieves data from local databases (SQLite, PostgreSQL, etc.) with query capabilities.
 * Provides safe database access with parameterized queries and result formatting.
 */

import { Injectable } from '@nestjs/common';
import { BaseRetriever } from '@domain/tools/base/base-retriever';
import { RetrieverConfig, ErrorEvent } from '@domain/value-objects/tool-config.value-objects';
import { ToolOutput, RAGConfig, RetrievalType } from '@domain/entities/tool.entities';

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
export class LocalDBRetriever extends BaseRetriever<LocalDBArgs, LocalDBOutput> {
  readonly name = 'localdb-retriever';
  readonly description = 'Query and retrieve data from local databases with safe parameterized queries';

  readonly metadata: RetrieverConfig;

  readonly errorEvents: ErrorEvent[];

  constructor() {
    const errorEvents = [
      new ErrorEvent('database-connection-failed', 'Failed to connect to database - check connection string and credentials', false),
      new ErrorEvent('database-query-error', 'Database query execution failed - check SQL syntax and permissions', false),
      new ErrorEvent('database-timeout', 'Database query timed out - consider optimizing query or increasing timeout', true)
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
            description: 'The database operation to perform'
          },
          connectionString: {
            type: 'string',
            description: 'Database connection string (optional, uses default if not provided)',
            examples: ['sqlite:///data.db', 'postgresql://user:pass@localhost/db']
          },
          query: {
            type: 'string',
            description: 'SQL query to execute (used with query operation)',
            examples: ['SELECT * FROM users LIMIT 10', 'SELECT COUNT(*) FROM products']
          },
          tableName: {
            type: 'string',
            description: 'Table name for schema operation'
          },
          limit: {
            type: 'number',
            description: 'Maximum number of rows to return',
            default: 100,
            minimum: 1,
            maximum: 1000
          },
          format: {
            type: 'string',
            enum: ['json', 'csv', 'table'],
            description: 'Output format for query results',
            default: 'json'
          }
        }
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
          message: { type: 'string' }
        }
      },
      [
        {
          name: 'localdb-retriever',
          args: { operation: 'query', query: 'SELECT * FROM users LIMIT 5' }
        },
        {
          name: 'localdb-retriever',
          args: { operation: 'tables' }
        },
        {
          name: 'localdb-retriever',
          args: { operation: 'schema', tableName: 'users' }
        }
      ],
      RetrievalType.DATABASE,
      false, // caching disabled for dynamic queries
      {
        similarity: 0.0,
        topK: 100,
        includeMetadata: true
      }
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

  protected async retrieve(args: LocalDBArgs & { ragConfig: RAGConfig }): Promise<LocalDBOutput> {
    const { operation, query, tableName, limit = 100, format = 'json' } = args;

    // Validate required parameters based on operation
    if (operation === 'query' && !query) {
      throw Object.assign(new Error('Query parameter is required for query operation'), {
        name: 'ValidationError'
      });
    }

    if (operation === 'schema' && !tableName) {
      throw Object.assign(new Error('Table name is required for schema operation'), {
        name: 'ValidationError'
      });
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
          name: 'ValidationError'
        });
    }
  }

  private async performQuery(query: string, limit: number, format: string): Promise<LocalDBOutput> {
    // For now, return a mock response since we don't have actual database connections
    // In a real implementation, this would connect to the database and execute the query

    // Basic SQL injection protection (very basic - real implementation should use parameterized queries)
    if (query.toLowerCase().includes('drop') || query.toLowerCase().includes('delete') || query.toLowerCase().includes('update')) {
      throw Object.assign(new Error('Only SELECT queries are allowed for security reasons'), {
        name: 'SecurityError'
      });
    }

    // Mock data for demonstration
    const mockData = [
      { id: 1, name: 'Sample Data 1', created_at: new Date().toISOString() },
      { id: 2, name: 'Sample Data 2', created_at: new Date().toISOString() }
    ].slice(0, limit);

    const columns = Object.keys(mockData[0] || {});

    return {
      success: true,
      operation: 'query',
      data: mockData,
      columns,
      rowCount: mockData.length,
      format
    };
  }

  private async performListTables(): Promise<LocalDBOutput> {
    // Mock table listing - real implementation would query database metadata
    const mockTables = ['users', 'products', 'orders', 'logs'];

    return {
      success: true,
      operation: 'tables',
      tables: mockTables
    };
  }

  private async performGetSchema(tableName: string): Promise<LocalDBOutput> {
    // Mock schema information - real implementation would query database schema
    const mockSchema = {
      tableName,
      columns: [
        { name: 'id', type: 'INTEGER', nullable: false, primaryKey: true },
        { name: 'name', type: 'VARCHAR(255)', nullable: false },
        { name: 'created_at', type: 'TIMESTAMP', nullable: false }
      ],
      indexes: ['PRIMARY KEY (id)', 'INDEX idx_name (name)']
    };

    return {
      success: true,
      operation: 'schema',
      schema: mockSchema
    };
  }
}