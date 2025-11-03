/**
 * LocalDB Actor - Infrastructure Layer
 *
 * Provides local database operations for data persistence and querying.
 */

import { Injectable } from '@nestjs/common';
import { BaseActor } from '@domain/tools/base/base-actor';
import {
  ActorConfig,
  ErrorEvent,
} from '@domain/value-objects/tool-config.value-objects';
import { ToolOutput, ActorCategory } from '@domain/entities/tool.entities';

export type DatabaseOperation =
  | 'create'
  | 'read'
  | 'update'
  | 'delete'
  | 'query'
  | 'list-tables'
  | 'create-table';

export interface DatabaseRecord {
  id: string;
  table: string;
  data: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface DatabaseArgs {
  operation: DatabaseOperation;
  // For create/update/delete
  table?: string;
  id?: string;
  data?: Record<string, unknown>;
  // For read/query
  query?: {
    table: string;
    where?: Record<string, unknown>;
    select?: string[];
    limit?: number;
    offset?: number;
    orderBy?: {
      field: string;
      direction: 'asc' | 'desc';
    };
  };
  // For create-table
  schema?: {
    table: string;
    fields: Record<
      string,
      {
        type: 'string' | 'number' | 'boolean' | 'date' | 'json';
        required?: boolean;
        unique?: boolean;
        default?: unknown;
      }
    >;
    primaryKey?: string;
  };
  [key: string]: unknown; // Index signature for compatibility
}

export interface DatabaseOutput extends ToolOutput {
  success: boolean;
  operation: DatabaseOperation;
  // For create/update/delete/read
  record?: DatabaseRecord;
  // For query/list-tables
  records?: DatabaseRecord[];
  tables?: string[];
  total?: number;
  // For create-table
  tableCreated?: boolean;
}

@Injectable()
export class LocalDBActor extends BaseActor<DatabaseArgs, DatabaseOutput> {
  readonly name = 'local-db-actor';
  readonly description =
    'Provides local database operations for data persistence and querying';

  readonly errorEvents: ErrorEvent[];

  readonly metadata: ActorConfig;

  // In-memory storage for tables and records (in production, this would be a real database)
  private tables: Map<string, Map<string, DatabaseRecord>> = new Map();
  private tableSchemas: Map<string, DatabaseArgs['schema']> = new Map();

  constructor() {
    const errorEvents = [
      new ErrorEvent(
        'TableNotFound',
        'The specified table was not found',
        false,
      ),
      new ErrorEvent(
        'RecordNotFound',
        'The specified record was not found',
        false,
      ),
      new ErrorEvent(
        'ValidationError',
        'Invalid database operation data provided',
        false,
      ),
      new ErrorEvent(
        'TableExists',
        'A table with this name already exists',
        false,
      ),
      new ErrorEvent(
        'SchemaValidationError',
        'Data does not match table schema',
        false,
      ),
    ];

    const metadata = new ActorConfig(
      'local-db-actor',
      'Local database operations',
      'Create, read, update, delete, and query data in local database tables',
      {
        type: 'object',
        additionalProperties: false,
        required: ['operation'],
        properties: {
          operation: {
            type: 'string',
            enum: [
              'create',
              'read',
              'update',
              'delete',
              'query',
              'list-tables',
              'create-table',
            ],
            description: 'The database operation to perform',
          },
          table: {
            type: 'string',
            minLength: 1,
            maxLength: 100,
            description: 'Table name (required for most operations)',
          },
          id: {
            type: 'string',
            minLength: 1,
            maxLength: 100,
            description: 'Record ID (required for read/update/delete)',
          },
          data: {
            type: 'object',
            description: 'Data to store (required for create/update)',
          },
          query: {
            type: 'object',
            required: ['table'],
            properties: {
              table: { type: 'string' },
              where: { type: 'object' },
              select: {
                type: 'array',
                items: { type: 'string' },
              },
              limit: {
                type: 'number',
                minimum: 1,
                maximum: 1000,
              },
              offset: {
                type: 'number',
                minimum: 0,
              },
              orderBy: {
                type: 'object',
                properties: {
                  field: { type: 'string' },
                  direction: { type: 'string', enum: ['asc', 'desc'] },
                },
              },
            },
          },
          schema: {
            type: 'object',
            required: ['table', 'fields'],
            properties: {
              table: { type: 'string' },
              fields: {
                type: 'object',
                patternProperties: {
                  '.*': {
                    type: 'object',
                    properties: {
                      type: {
                        type: 'string',
                        enum: ['string', 'number', 'boolean', 'date', 'json'],
                      },
                      required: { type: 'boolean' },
                      unique: { type: 'boolean' },
                      default: {},
                    },
                  },
                },
              },
              primaryKey: { type: 'string' },
            },
          },
        },
      },
      {
        type: 'object',
        properties: {
          success: { type: 'boolean' },
          operation: { type: 'string' },
          record: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              table: { type: 'string' },
              data: { type: 'object' },
              createdAt: { type: 'string', format: 'date-time' },
              updatedAt: { type: 'string', format: 'date-time' },
            },
          },
          records: {
            type: 'array',
            items: { $ref: '#/properties/record' },
          },
          tables: {
            type: 'array',
            items: { type: 'string' },
          },
          total: { type: 'number' },
          tableCreated: { type: 'boolean' },
        },
      },
      [
        {
          operation: 'create-table',
          schema: {
            table: 'users',
            fields: {
              name: { type: 'string', required: true },
              email: { type: 'string', required: true, unique: true },
              age: { type: 'number' },
              active: { type: 'boolean', default: true },
            },
            primaryKey: 'email',
          },
        },
        {
          operation: 'create',
          table: 'users',
          data: { name: 'John Doe', email: 'john@example.com', age: 30 },
        },
        {
          operation: 'query',
          query: {
            table: 'users',
            where: { active: true },
            select: ['name', 'email'],
            limit: 10,
            orderBy: { field: 'name', direction: 'asc' },
          },
        },
        {
          operation: 'update',
          table: 'users',
          id: 'john@example.com',
          data: { age: 31 },
        },
      ],
      ActorCategory.INTERNAL_SANDBOX,
      false,
    );

    super(metadata, errorEvents);
    this.metadata = metadata;
    this.errorEvents = errorEvents;
  }

  get category(): ActorCategory {
    return ActorCategory.INTERNAL_SANDBOX;
  }

  get requiresAuth(): boolean {
    return false;
  }

  protected async act(args: DatabaseArgs): Promise<DatabaseOutput> {
    switch (args.operation) {
      case 'create':
        return this.createRecord(args);
      case 'read':
        return this.readRecord(args);
      case 'update':
        return this.updateRecord(args);
      case 'delete':
        return this.deleteRecord(args);
      case 'query':
        return this.queryRecords(args);
      case 'list-tables':
        return this.listTables();
      case 'create-table':
        return this.createTable(args);
      default:
        throw Object.assign(
          new Error(`Unsupported operation: ${args.operation}`),
          {
            name: 'ValidationError',
          },
        );
    }
  }

  private createTable(args: DatabaseArgs): DatabaseOutput {
    if (!args.schema) {
      throw Object.assign(new Error('Schema is required for table creation'), {
        name: 'ValidationError',
      });
    }

    const { table, fields } = args.schema;

    if (this.tables.has(table)) {
      throw Object.assign(new Error(`Table '${table}' already exists`), {
        name: 'TableExists',
      });
    }

    // Validate schema
    if (!fields || Object.keys(fields).length === 0) {
      throw Object.assign(new Error('Table must have at least one field'), {
        name: 'ValidationError',
      });
    }

    // Store schema
    this.tableSchemas.set(table, args.schema);
    this.tables.set(table, new Map());

    return {
      success: true,
      operation: 'create-table',
      tableCreated: true,
    };
  }

  private createRecord(args: DatabaseArgs): DatabaseOutput {
    if (!args.table || !args.data) {
      throw Object.assign(
        new Error('Table and data are required for record creation'),
        {
          name: 'ValidationError',
        },
      );
    }

    const table = this.getTable(args.table);
    const schema = this.tableSchemas.get(args.table);

    // Validate data against schema
    if (schema) {
      this.validateData(args.data, schema);
    }

    const id = args.id || this.generateId();
    const now = new Date();

    const record: DatabaseRecord = {
      id,
      table: args.table,
      data: args.data,
      createdAt: now,
      updatedAt: now,
    };

    table.set(id, record);

    return {
      success: true,
      operation: 'create',
      record,
    };
  }

  private readRecord(args: DatabaseArgs): DatabaseOutput {
    if (!args.table || !args.id) {
      throw Object.assign(
        new Error('Table and ID are required for record reading'),
        {
          name: 'ValidationError',
        },
      );
    }

    const table = this.getTable(args.table);
    const record = table.get(args.id);

    if (!record) {
      throw Object.assign(
        new Error(
          `Record with ID '${args.id}' not found in table '${args.table}'`,
        ),
        {
          name: 'RecordNotFound',
        },
      );
    }

    return {
      success: true,
      operation: 'read',
      record,
    };
  }

  private updateRecord(args: DatabaseArgs): DatabaseOutput {
    if (!args.table || !args.id || !args.data) {
      throw Object.assign(
        new Error('Table, ID, and data are required for record update'),
        {
          name: 'ValidationError',
        },
      );
    }

    const table = this.getTable(args.table);
    const record = table.get(args.id);

    if (!record) {
      throw Object.assign(
        new Error(
          `Record with ID '${args.id}' not found in table '${args.table}'`,
        ),
        {
          name: 'RecordNotFound',
        },
      );
    }

    const schema = this.tableSchemas.get(args.table);

    // Validate data against schema (only for fields being updated)
    if (schema) {
      this.validateUpdateData(args.data, schema);
    }

    // Update data
    Object.assign(record.data, args.data);
    record.updatedAt = new Date();

    table.set(args.id, record);

    return {
      success: true,
      operation: 'update',
      record,
    };
  }

  private deleteRecord(args: DatabaseArgs): DatabaseOutput {
    if (!args.table || !args.id) {
      throw Object.assign(
        new Error('Table and ID are required for record deletion'),
        {
          name: 'ValidationError',
        },
      );
    }

    const table = this.getTable(args.table);
    const record = table.get(args.id);

    if (!record) {
      throw Object.assign(
        new Error(
          `Record with ID '${args.id}' not found in table '${args.table}'`,
        ),
        {
          name: 'RecordNotFound',
        },
      );
    }

    table.delete(args.id);

    return {
      success: true,
      operation: 'delete',
      record,
    };
  }

  private queryRecords(args: DatabaseArgs): DatabaseOutput {
    if (!args.query) {
      throw Object.assign(new Error('Query is required for record querying'), {
        name: 'ValidationError',
      });
    }

    const {
      table: tableName,
      where,
      select,
      limit,
      offset,
      orderBy,
    } = args.query;
    const table = this.getTable(tableName);

    let records = Array.from(table.values());

    // Apply where filter
    if (where) {
      records = records.filter((record) => {
        return Object.entries(where).every(([key, value]) => {
          return record.data[key] === value;
        });
      });
    }

    // Apply select (field filtering)
    if (select && select.length > 0) {
      records = records.map((record) => ({
        ...record,
        data: Object.fromEntries(
          Object.entries(record.data).filter(([key]) => select.includes(key)),
        ),
      }));
    }

    // Apply ordering
    if (orderBy) {
      records.sort((a, b) => {
        const aValue = a.data[orderBy.field];
        const bValue = b.data[orderBy.field];

        let comparison = 0;
        if (typeof aValue === 'string' && typeof bValue === 'string') {
          comparison = aValue.localeCompare(bValue);
        } else if (typeof aValue === 'number' && typeof bValue === 'number') {
          comparison = aValue - bValue;
        } else {
          // For other types, convert to string for comparison
          const aStr = String(aValue || '');
          const bStr = String(bValue || '');
          comparison = aStr.localeCompare(bStr);
        }

        return orderBy.direction === 'desc' ? -comparison : comparison;
      });
    }

    // Apply pagination
    const queryLimit = limit || 100;
    const queryOffset = offset || 0;
    const total = records.length;
    const paginatedRecords = records.slice(
      queryOffset,
      queryOffset + queryLimit,
    );

    return {
      success: true,
      operation: 'query',
      records: paginatedRecords,
      total,
    };
  }

  private listTables(): DatabaseOutput {
    return {
      success: true,
      operation: 'list-tables',
      tables: Array.from(this.tables.keys()),
    };
  }

  private getTable(tableName: string): Map<string, DatabaseRecord> {
    const table = this.tables.get(tableName);
    if (!table) {
      throw Object.assign(new Error(`Table '${tableName}' not found`), {
        name: 'TableNotFound',
      });
    }
    return table;
  }

  private validateData(
    data: Record<string, unknown>,
    schema: DatabaseArgs['schema'],
  ): void {
    if (!schema) return;

    const { fields } = schema;

    // Check required fields
    for (const [fieldName, fieldDef] of Object.entries(fields)) {
      if (
        fieldDef.required &&
        (data[fieldName] === undefined || data[fieldName] === null)
      ) {
        throw Object.assign(
          new Error(`Required field '${fieldName}' is missing`),
          {
            name: 'SchemaValidationError',
          },
        );
      }
    }

    // Validate field types and constraints
    for (const [fieldName, value] of Object.entries(data)) {
      const fieldDef = fields[fieldName];
      if (!fieldDef) continue; // Allow extra fields for now

      // Type validation
      switch (fieldDef.type) {
        case 'string':
          if (typeof value !== 'string') {
            throw Object.assign(
              new Error(`Field '${fieldName}' must be a string`),
              {
                name: 'SchemaValidationError',
              },
            );
          }
          break;
        case 'number':
          if (typeof value !== 'number') {
            throw Object.assign(
              new Error(`Field '${fieldName}' must be a number`),
              {
                name: 'SchemaValidationError',
              },
            );
          }
          break;
        case 'boolean':
          if (typeof value !== 'boolean') {
            throw Object.assign(
              new Error(`Field '${fieldName}' must be a boolean`),
              {
                name: 'SchemaValidationError',
              },
            );
          }
          break;
        case 'date':
          if (!(value instanceof Date) && typeof value !== 'string') {
            throw Object.assign(
              new Error(`Field '${fieldName}' must be a date`),
              {
                name: 'SchemaValidationError',
              },
            );
          }
          break;
        case 'json':
          // JSON can be any object
          break;
      }
    }
  }

  private validateUpdateData(
    data: Record<string, unknown>,
    schema: DatabaseArgs['schema'],
  ): void {
    if (!schema) return;

    const { fields } = schema;

    // Validate field types and constraints for fields being updated
    for (const [fieldName, value] of Object.entries(data)) {
      const fieldDef = fields[fieldName];
      if (!fieldDef) continue; // Allow extra fields for now

      // Type validation
      switch (fieldDef.type) {
        case 'string':
          if (typeof value !== 'string') {
            throw Object.assign(
              new Error(`Field '${fieldName}' must be a string`),
              {
                name: 'SchemaValidationError',
              },
            );
          }
          break;
        case 'number':
          if (typeof value !== 'number') {
            throw Object.assign(
              new Error(`Field '${fieldName}' must be a number`),
              {
                name: 'SchemaValidationError',
              },
            );
          }
          break;
        case 'boolean':
          if (typeof value !== 'boolean') {
            throw Object.assign(
              new Error(`Field '${fieldName}' must be a boolean`),
              {
                name: 'SchemaValidationError',
              },
            );
          }
          break;
        case 'date':
          if (!(value instanceof Date) && typeof value !== 'string') {
            throw Object.assign(
              new Error(`Field '${fieldName}' must be a date`),
              {
                name: 'SchemaValidationError',
              },
            );
          }
          break;
        case 'json':
          // JSON can be any object
          break;
      }
    }
  }

  private generateId(): string {
    return `db-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}
