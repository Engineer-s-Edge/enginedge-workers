/**
 * LocalDB Actor - Unit Tests
 */

import { Test, TestingModule } from '@nestjs/testing';
import {
  LocalDBActor,
  DatabaseArgs,
  DatabaseOutput,
  DatabaseRecord,
} from '@infrastructure/tools/actors/local-db.actor';

// Mock DB Implementation
const createMockDb = () => {
  const collections = new Map<string, any[]>();

  return {
    listCollections: jest.fn().mockImplementation((filter) => ({
      toArray: jest.fn().mockImplementation(async () => {
        if (filter && filter.name) {
          return collections.has(filter.name) ? [{ name: filter.name }] : [];
        }
        return Array.from(collections.keys()).map((name) => ({ name }));
      }),
    })),
    createCollection: jest.fn().mockImplementation(async (name) => {
      if (collections.has(name)) throw new Error('Collection exists');
      collections.set(name, []);
      return {};
    }),
    collection: jest.fn().mockImplementation((name) => {
      return {
        createIndexes: jest.fn().mockResolvedValue([]),
        insertOne: jest.fn().mockImplementation(async (doc) => {
          if (!collections.has(name))
            throw new Error(`Table '${name}' not found`);
          doc._id = doc._id || 'generated-id-' + Math.random();
          collections.get(name)!.push({ ...doc });
          return { insertedId: doc._id };
        }),
        find: jest.fn().mockImplementation((query, options) => {
          const data = collections.get(name) || [];
          let results = data.filter((item) => {
            for (const key in query) {
              if (getNested(item, key) !== query[key]) return false;
            }
            return true;
          });

          if (options && options.projection) {
            results = results.map((item) => {
              const projected: any = {};
              for (const key in options.projection) {
                if (options.projection[key]) {
                  const val = getNested(item, key);
                  if (val !== undefined) {
                    const parts = key.split('.');
                    let curr = projected;
                    for (let i = 0; i < parts.length - 1; i++) {
                      curr[parts[i]] = curr[parts[i]] || {};
                      curr = curr[parts[i]];
                    }
                    curr[parts[parts.length - 1]] = val;
                  }
                }
              }
              return projected;
            });
          }

          return {
            toArray: jest.fn().mockResolvedValue(results),
            sort: jest.fn().mockReturnThis(),
            skip: jest.fn().mockReturnThis(),
            limit: jest.fn().mockImplementation((limit) => ({
              toArray: jest.fn().mockResolvedValue(results.slice(0, limit)),
            })),
          };
        }),
        findOne: jest.fn().mockImplementation(async (query) => {
          const data = collections.get(name) || [];
          return (
            data.find((item) => {
              for (const key in query) {
                if (getNested(item, key) !== query[key]) return false;
              }
              return true;
            }) || null
          );
        }),
        findOneAndUpdate: jest
          .fn()
          .mockImplementation(async (query, update, options) => {
            const data = collections.get(name) || [];
            const index = data.findIndex((item) => {
              for (const key in query) {
                if (getNested(item, key) !== query[key]) return false;
              }
              return true;
            });

            if (index !== -1) {
              const item = data[index];
              if (update.$set) {
                for (const k in update.$set) {
                  item[k] = update.$set[k];
                }
              }
              return options?.returnDocument === 'after' ? item : data[index];
            }
            return null;
          }),
        findOneAndDelete: jest.fn().mockImplementation(async (query) => {
          const data = collections.get(name) || [];
          const index = data.findIndex((item) => {
            for (const key in query) {
              if (getNested(item, key) !== query[key]) return false;
            }
            return true;
          });

          if (index !== -1) {
            const deleted = data[index];
            data.splice(index, 1);
            return deleted;
          }
          return null;
        }),
        countDocuments: jest.fn().mockImplementation(async () => {
          return (collections.get(name) || []).length;
        }),
      };
    }),
  };
};

function getNested(obj: any, path: string) {
  return path.split('.').reduce((o, i) => (o ? o[i] : undefined), obj);
}

describe('LocalDBActor', () => {
  let actor: LocalDBActor;
  let mockDb: any;

  beforeEach(async () => {
    mockDb = createMockDb();
    const module: TestingModule = await Test.createTestingModule({
      providers: [LocalDBActor, { provide: 'MONGODB_DB', useValue: mockDb }],
    }).compile();

    actor = module.get<LocalDBActor>(LocalDBActor);
  });

  describe('Basic Properties', () => {
    it('should have correct name and description', () => {
      expect(actor.name).toBe('local-db-actor');
      expect(actor.description).toBe(
        'Provides local database operations for data persistence and querying',
      );
    });

    it('should have correct category and auth requirements', () => {
      expect(actor.category).toBeDefined();
      expect(actor.requiresAuth).toBe(false);
    });
  });

  describe('Table Operations', () => {
    it('should create a table successfully', async () => {
      const args: DatabaseArgs = {
        operation: 'create-table',
        schema: {
          table: 'users',
          fields: {
            name: { type: 'string', required: true },
            email: { type: 'string', required: true, unique: true },
            age: { type: 'number' },
            active: { type: 'boolean', default: true },
          },
        },
      };

      const result = await actor.execute({ name: 'local-db-actor', args });

      expect(result.success).toBe(true);
      expect(result.output!.operation).toBe('create-table');
      expect(result.output!.tableCreated).toBe(true);
    });

    it('should list tables', async () => {
      // Create a couple of tables
      await actor.execute({
        name: 'local-db-actor',
        args: {
          operation: 'create-table',
          schema: {
            table: 'users',
            fields: { name: { type: 'string' } },
          },
        },
      });

      await actor.execute({
        name: 'local-db-actor',
        args: {
          operation: 'create-table',
          schema: {
            table: 'products',
            fields: { title: { type: 'string' } },
          },
        },
      });

      const result = await actor.execute({
        name: 'local-db-actor',
        args: { operation: 'list-tables' },
      });

      expect(result.success).toBe(true);
      expect(result.output!.operation).toBe('list-tables');
      expect(result.output!.tables).toContain('users');
      expect(result.output!.tables).toContain('products');
      expect(result.output!.tables!.length).toBe(2);
    });
  });

  describe('Record Operations', () => {
    beforeEach(async () => {
      // Create a test table
      await actor.execute({
        name: 'local-db-actor',
        args: {
          operation: 'create-table',
          schema: {
            table: 'users',
            fields: {
              name: { type: 'string', required: true },
              email: { type: 'string', required: true },
              age: { type: 'number' },
              active: { type: 'boolean', default: true },
            },
          },
        },
      });
    });

    describe('Create Record', () => {
      it('should create a record successfully', async () => {
        const args: DatabaseArgs = {
          operation: 'create',
          table: 'users',
          data: { name: 'John Doe', email: 'john@example.com', age: 30 },
        };

        const result = await actor.execute({ name: 'local-db-actor', args });

        expect(result.success).toBe(true);
        expect(result.output!.success).toBe(true);
        expect(result.output!.operation).toBe('create');
        expect(result.output!.record).toBeDefined();
        expect(result.output!.record!.table).toBe('users');
        expect(result.output!.record!.data.name).toBe('John Doe');
        expect(result.output!.record!.data.email).toBe('john@example.com');
        expect(result.output!.record!.data.age).toBe(30);
        expect(result.output!.record!.id).toBeDefined();
        expect(result.output!.record!.createdAt).toBeInstanceOf(Date);
        expect(result.output!.record!.updatedAt).toBeInstanceOf(Date);
      });

      it('should create a record with auto-generated ID', async () => {
        const args: DatabaseArgs = {
          operation: 'create',
          table: 'users',
          data: { name: 'Jane Doe', email: 'jane@example.com' },
        };

        const result = await actor.execute({ name: 'local-db-actor', args });

        expect(result.success).toBe(true);
        expect(result.output!.record!.id).toMatch(/^db-\d+-[a-z0-9]+$/);
      });

      it('should create a record with custom ID', async () => {
        const args: DatabaseArgs = {
          operation: 'create',
          table: 'users',
          id: 'custom-id-123',
          data: { name: 'Bob Smith', email: 'bob@example.com' },
        };

        const result = await actor.execute({ name: 'local-db-actor', args });

        expect(result.success).toBe(true);
        expect(result.output!.record!.id).toBe('custom-id-123');
      });

      it('should throw error when creating record without table', async () => {
        const args: DatabaseArgs = {
          operation: 'create',
          data: { name: 'John Doe' },
        };

        const result = await actor.execute({ name: 'local-db-actor', args });

        expect(result.success).toBe(false);
        expect(result.error!.message).toBe(
          'Table and data are required for record creation',
        );
      });

      it('should throw error when creating record in non-existent table', async () => {
        const args: DatabaseArgs = {
          operation: 'create',
          table: 'nonexistent',
          data: { name: 'John Doe' },
        };

        const result = await actor.execute({ name: 'local-db-actor', args });

        expect(result.success).toBe(false);
        expect(result.error!.message).toBe("Table 'nonexistent' not found");
      });

      it('should throw error when creating record with missing required fields', async () => {
        const args: DatabaseArgs = {
          operation: 'create',
          table: 'users',
          data: { email: 'john@example.com' }, // Missing required 'name'
        };

        const result = await actor.execute({ name: 'local-db-actor', args });

        expect(result.success).toBe(false);
        expect(result.error!.message).toBe("Required field 'name' is missing");
      });

      it('should throw error when creating record with invalid field types', async () => {
        const args: DatabaseArgs = {
          operation: 'create',
          table: 'users',
          data: { name: 'John Doe', email: 'john@example.com', age: 'thirty' }, // age should be number
        };

        const result = await actor.execute({ name: 'local-db-actor', args });

        expect(result.success).toBe(false);
        expect(result.error!.message).toBe("Field 'age' must be a number");
      });
    });

    describe('Read Record', () => {
      let createdRecord: DatabaseRecord;

      beforeEach(async () => {
        // Create a test record
        const createResult = await actor.execute({
          name: 'local-db-actor',
          args: {
            operation: 'create',
            table: 'users',
            id: 'user-123',
            data: { name: 'John Doe', email: 'john@example.com', age: 30 },
          },
        });
        createdRecord = createResult.output!.record!;
      });

      it('should read a record successfully', async () => {
        const args: DatabaseArgs = {
          operation: 'read',
          table: 'users',
          id: 'user-123',
        };

        const result = await actor.execute({ name: 'local-db-actor', args });

        expect(result.success).toBe(true);
        expect(result.output!.success).toBe(true);
        expect(result.output!.operation).toBe('read');
        expect(result.output!.record).toEqual(createdRecord);
      });

      it('should throw error when reading non-existent record', async () => {
        const args: DatabaseArgs = {
          operation: 'read',
          table: 'users',
          id: 'nonexistent',
        };

        const result = await actor.execute({ name: 'local-db-actor', args });

        expect(result.success).toBe(false);
        expect(result.error!.message).toBe(
          "Record with ID 'nonexistent' not found in table 'users'",
        );
      });

      it('should throw error when reading without table and ID', async () => {
        const args: DatabaseArgs = {
          operation: 'read',
          table: 'users',
        };

        const result = await actor.execute({ name: 'local-db-actor', args });

        expect(result.success).toBe(false);
        expect(result.error!.message).toBe(
          'Table and ID are required for record reading',
        );
      });
    });

    describe('Update Record', () => {
      beforeEach(async () => {
        // Create a test record
        await actor.execute({
          name: 'local-db-actor',
          args: {
            operation: 'create',
            table: 'users',
            id: 'user-123',
            data: { name: 'John Doe', email: 'john@example.com', age: 30 },
          },
        });
      });

      it('should update a record successfully', async () => {
        const args: DatabaseArgs = {
          operation: 'update',
          table: 'users',
          id: 'user-123',
          data: { age: 31, name: 'John Smith' },
        };

        const result = await actor.execute({ name: 'local-db-actor', args });

        expect(result.success).toBe(true);
        expect(result.output!.success).toBe(true);
        expect(result.output!.operation).toBe('update');
        expect(result.output!.record!.data.name).toBe('John Smith');
        expect(result.output!.record!.data.age).toBe(31);
        expect(result.output!.record!.data.email).toBe('john@example.com'); // Unchanged
        expect(
          result.output!.record!.updatedAt.getTime(),
        ).toBeGreaterThanOrEqual(result.output!.record!.createdAt.getTime());
      });

      it('should throw error when updating non-existent record', async () => {
        const args: DatabaseArgs = {
          operation: 'update',
          table: 'users',
          id: 'nonexistent',
          data: { age: 31 },
        };

        const result = await actor.execute({ name: 'local-db-actor', args });

        expect(result.success).toBe(false);
        expect(result.error!.message).toBe(
          "Record with ID 'nonexistent' not found in table 'users'",
        );
      });

      it('should throw error when updating without table, ID, and data', async () => {
        const args: DatabaseArgs = {
          operation: 'update',
          table: 'users',
          id: 'user-123',
        };

        const result = await actor.execute({ name: 'local-db-actor', args });

        expect(result.success).toBe(false);
        expect(result.error!.message).toBe(
          'Table, ID, and data are required for record update',
        );
      });
    });

    describe('Delete Record', () => {
      beforeEach(async () => {
        // Create a test record
        await actor.execute({
          name: 'local-db-actor',
          args: {
            operation: 'create',
            table: 'users',
            id: 'user-123',
            data: { name: 'John Doe', email: 'john@example.com', age: 30 },
          },
        });
      });

      it('should delete a record successfully', async () => {
        const args: DatabaseArgs = {
          operation: 'delete',
          table: 'users',
          id: 'user-123',
        };

        const result = await actor.execute({ name: 'local-db-actor', args });

        expect(result.success).toBe(true);
        expect(result.output!.success).toBe(true);
        expect(result.output!.operation).toBe('delete');

        // Verify record is gone
        const readArgs: DatabaseArgs = {
          operation: 'read',
          table: 'users',
          id: 'user-123',
        };
        const readResult = await actor.execute({
          name: 'local-db-actor',
          args: readArgs,
        });

        expect(readResult.success).toBe(false);
        expect(readResult.error!.message).toBe(
          "Record with ID 'user-123' not found in table 'users'",
        );
      });

      it('should throw error when deleting non-existent record', async () => {
        const args: DatabaseArgs = {
          operation: 'delete',
          table: 'users',
          id: 'nonexistent',
        };

        const result = await actor.execute({ name: 'local-db-actor', args });

        expect(result.success).toBe(false);
        expect(result.error!.message).toBe(
          "Record with ID 'nonexistent' not found in table 'users'",
        );
      });

      it('should throw error when deleting without table and ID', async () => {
        const args: DatabaseArgs = {
          operation: 'delete',
          table: 'users',
        };

        const result = await actor.execute({ name: 'local-db-actor', args });

        expect(result.success).toBe(false);
        expect(result.error!.message).toBe(
          'Table and ID are required for record deletion',
        );
      });
    });

    describe('Query Records', () => {
      beforeEach(async () => {
        // Create test data
        await actor.execute({
          name: 'local-db-actor',
          args: {
            operation: 'create',
            table: 'users',
            id: 'user-1',
            data: {
              name: 'John Doe',
              email: 'john@example.com',
              age: 30,
              active: true,
            },
          },
        });

        await actor.execute({
          name: 'local-db-actor',
          args: {
            operation: 'create',
            table: 'users',
            id: 'user-2',
            data: {
              name: 'Jane Smith',
              email: 'jane@example.com',
              age: 25,
              active: true,
            },
          },
        });

        await actor.execute({
          name: 'local-db-actor',
          args: {
            operation: 'create',
            table: 'users',
            id: 'user-3',
            data: {
              name: 'Bob Johnson',
              email: 'bob@example.com',
              age: 35,
              active: false,
            },
          },
        });
      });

      it('should query all records', async () => {
        const args: DatabaseArgs = {
          operation: 'query',
          query: {
            table: 'users',
          },
        };

        const result = await actor.execute({ name: 'local-db-actor', args });

        expect(result.success).toBe(true);
        expect(result.output!.success).toBe(true);
        expect(result.output!.operation).toBe('query');
        expect(result.output!.records).toHaveLength(3);
        expect(result.output!.total).toBe(3);
      });

      it('should query with where clause', async () => {
        const args: DatabaseArgs = {
          operation: 'query',
          query: {
            table: 'users',
            where: { active: true },
          },
        };

        const result = await actor.execute({ name: 'local-db-actor', args });

        expect(result.success).toBe(true);
        expect(result.output!.records).toHaveLength(2);
        expect(
          result.output!.records!.every(
            (record) => record.data.active === true,
          ),
        ).toBe(true);
      });

      it('should query with limit', async () => {
        const args: DatabaseArgs = {
          operation: 'query',
          query: {
            table: 'users',
            limit: 2,
          },
        };

        const result = await actor.execute({ name: 'local-db-actor', args });

        expect(result.success).toBe(true);
        expect(result.output!.records).toHaveLength(2);
      });

      it('should query with select fields', async () => {
        const args: DatabaseArgs = {
          operation: 'query',
          query: {
            table: 'users',
            select: ['name', 'email'],
          },
        };

        const result = await actor.execute({ name: 'local-db-actor', args });

        expect(result.success).toBe(true);
        expect(
          result.output!.records!.every(
            (record) =>
              'name' in record.data &&
              'email' in record.data &&
              !('age' in record.data) &&
              !('active' in record.data),
          ),
        ).toBe(true);
      });
    });
  });
});
